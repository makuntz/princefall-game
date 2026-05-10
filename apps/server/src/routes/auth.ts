import { randomBytes } from 'crypto';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  isBrStateCode,
  isKnownCountryCode,
} from '@princefall/shared';
import { buildEmailVerificationUrl, sendVerificationEmail } from '../email';

const loginSchema = z.object({
  email: z.string().email(),
});

const usernameSchema = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, ' '))
  .pipe(
    z
      .string()
      .min(2, 'Nome de usuário deve ter pelo menos 2 caracteres.')
      .max(48, 'Nome de usuário deve ter no máximo 48 caracteres.')
      .regex(
        /^[\p{L}\p{N} _-]+$/u,
        'Use apenas letras, números, espaços, _ e hífen.',
      ),
  );

const countrySchema = z
  .string()
  .transform((s) => s.trim().toUpperCase())
  .pipe(
    z
      .string()
      .length(2, 'Use o código ISO do país (duas letras, ex.: BR).')
      .refine((code) => isKnownCountryCode(code), {
        message: 'Selecione um país da lista.',
      }),
  );

const stateProvinceSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string().min(1, 'Informe o estado ou província.').max(120));

const citySchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string().min(1, 'Informe a cidade.').max(120));

function refineBrazilState(data: { country: string; stateProvince: string }, ctx: z.RefinementCtx) {
  if (data.country !== 'BR') return;
  const uf = data.stateProvince.trim().toUpperCase();
  if (!isBrStateCode(uf)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Selecione um estado brasileiro válido (UF).',
      path: ['stateProvince'],
    });
  }
}

const registerBodySchema = z
  .object({
    email: z.string().email(),
    acceptedPrivacyPolicy: z.literal(true, {
      errorMap: () => ({
        message: 'É necessário aceitar o tratamento dos dados conforme a política.',
      }),
    }),
    username: usernameSchema,
    country: countrySchema,
    stateProvince: stateProvinceSchema,
    city: citySchema,
  })
  .superRefine(refineBrazilState);

const profileBodySchema = z
  .object({
    username: usernameSchema,
    country: countrySchema,
    stateProvince: stateProvinceSchema,
    city: citySchema,
  })
  .superRefine(refineBrazilState);

const verifyEmailSchema = z.object({
  token: z.string().min(16, 'Token inválido.'),
});

function normalizeUsername(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function firstZodIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? 'Dados inválidos.';
}

function userPublic(u: {
  id: string;
  email: string;
  username: string;
  country: string | null;
  stateProvince: string | null;
  city: string | null;
  privacyAcceptedAt: Date | null;
  emailVerifiedAt: Date | null;
}) {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    country: u.country,
    stateProvince: u.stateProvince,
    city: u.city,
    privacyAccepted: !!u.privacyAcceptedAt,
    emailVerified: !!u.emailVerifiedAt,
  };
}

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/register', async (request, reply) => {
    const parsed = registerBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: firstZodIssue(parsed.error) });
    }
    const body = parsed.data;
    const username = normalizeUsername(body.username);

    const emailTaken = await fastify.prisma.user.findUnique({
      where: { email: body.email },
    });
    if (emailTaken) {
      return reply.code(409).send({
        error: 'Este e-mail já está cadastrado. Use Entrar.',
      });
    }

    const usernameTaken = await fastify.prisma.user.findUnique({
      where: { username },
    });
    if (usernameTaken) {
      return reply.code(409).send({
        error: 'Este nome de usuário já está em uso. Escolha outro.',
      });
    }

    const emailVerificationToken = randomBytes(32).toString('hex');
    const stateStored =
      body.country === 'BR' ? body.stateProvince.trim().toUpperCase() : body.stateProvince.trim();

    const user = await fastify.prisma.user.create({
      data: {
        email: body.email,
        username,
        country: body.country,
        stateProvince: stateStored,
        city: body.city.trim(),
        privacyAcceptedAt: new Date(),
        emailVerifiedAt: null,
        emailVerificationToken,
      },
    });

    await fastify.prisma.rating.create({
      data: {
        userId: user.id,
        rating: 1500,
      },
    });

    const verifyUrl = buildEmailVerificationUrl(emailVerificationToken);
    try {
      await sendVerificationEmail(user.email, verifyUrl);
    } catch (err) {
      console.error('[email] Falha ao enviar verificação:', err);
    }

    const token = fastify.jwt.sign({ userId: user.id, email: user.email });

    const payload: Record<string, unknown> = {
      token,
      user: userPublic(user),
    };

    if (process.env.NODE_ENV !== 'production' && !process.env.SMTP_HOST) {
      payload.devVerificationUrl = verifyUrl;
    }

    return payload;
  });

  fastify.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: firstZodIssue(parsed.error) });
    }
    const { email } = parsed.data;

    const user = await fastify.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return reply.code(404).send({
        error: 'Conta não encontrada. Cadastre-se primeiro.',
      });
    }

    const jwtToken = fastify.jwt.sign({ userId: user.id, email: user.email });

    return {
      token: jwtToken,
      user: userPublic(user),
    };
  });

  fastify.post('/verify-email', async (request, reply) => {
    const parsed = verifyEmailSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: firstZodIssue(parsed.error) });
    }

    const user = await fastify.prisma.user.findFirst({
      where: { emailVerificationToken: parsed.data.token },
    });

    if (!user) {
      return reply.code(400).send({
        error: 'Link inválido ou já utilizado. Peça um novo e-mail na lista de partidas.',
      });
    }

    const updated = await fastify.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
      },
    });

    return {
      ok: true,
      message: 'E-mail confirmado com sucesso.',
      user: userPublic(updated),
    };
  });

  fastify.post('/resend-verification', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = (request.user as any).userId as string;

    const user = await fastify.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return reply.code(404).send({ error: 'Usuário não encontrado.' });
    }

    if (user.emailVerifiedAt) {
      return reply.code(400).send({ error: 'Este e-mail já está confirmado.' });
    }

    const emailVerificationToken = randomBytes(32).toString('hex');
    await fastify.prisma.user.update({
      where: { id: user.id },
      data: { emailVerificationToken },
    });

    const verifyUrl = buildEmailVerificationUrl(emailVerificationToken);
    try {
      await sendVerificationEmail(user.email, verifyUrl);
    } catch (err) {
      console.error('[email] Falha ao reenviar verificação:', err);
      return reply.code(500).send({ error: 'Não foi possível enviar o e-mail. Tente mais tarde.' });
    }

    const out: Record<string, unknown> = { ok: true, message: 'Novo link enviado para seu e-mail.' };
    if (process.env.NODE_ENV !== 'production' && !process.env.SMTP_HOST) {
      out.devVerificationUrl = verifyUrl;
    }
    return out;
  });

  fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: (request.user as any).userId },
      include: { rating: true },
    });

    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    return { user };
  });

  fastify.patch('/profile', { preHandler: [authenticate] }, async (request, reply) => {
    const parsed = profileBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: firstZodIssue(parsed.error) });
    }

    const userId = (request.user as any).userId as string;
    const body = parsed.data;
    const username = normalizeUsername(body.username);

    const current = await fastify.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!current) {
      return reply.code(404).send({ error: 'Usuário não encontrado.' });
    }

    if (username !== current.username) {
      const other = await fastify.prisma.user.findUnique({
        where: { username },
      });
      if (other && other.id !== userId) {
        return reply.code(409).send({
          error: 'Este nome de usuário já está em uso. Escolha outro.',
        });
      }
    }

    const stateStored =
      body.country === 'BR' ? body.stateProvince.trim().toUpperCase() : body.stateProvince.trim();

    const user = await fastify.prisma.user.update({
      where: { id: userId },
      data: {
        username,
        country: body.country,
        stateProvince: stateStored,
        city: body.city.trim(),
      },
    });

    return {
      user: userPublic(user),
    };
  });
}

async function authenticate(request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
}
