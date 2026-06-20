import { randomBytes } from 'crypto';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  isBrStateCode,
  isKnownCountryCode,
} from '@princefall/shared';
import { buildEmailVerificationUrl, sendVerificationEmail } from '../email';
import { isGoogleAuthConfigured, registerGoogleAuthRoutes } from '../googleAuth';

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

const googleRegisterSchema = z
  .object({
    pendingToken: z.string().min(16, 'Sessão Google inválida.'),
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
  await registerGoogleAuthRoutes(fastify);

  fastify.get('/providers', async () => ({
    google: isGoogleAuthConfigured(),
  }));

  fastify.get('/google/pending', async (request, reply) => {
    const token = (request.query as { token?: string }).token;
    if (!token) {
      return reply.code(400).send({ error: 'Token inválido.' });
    }

    try {
      const payload = fastify.jwt.verify(token) as {
        purpose?: string;
        email?: string;
        suggestedUsername?: string;
      };
      if (payload.purpose !== 'google-pending' || !payload.email) {
        throw new Error('invalid');
      }
      return {
        email: payload.email,
        suggestedUsername: payload.suggestedUsername ?? '',
      };
    } catch {
      return reply.code(400).send({
        error: 'Sessão Google expirada. Clique em «Entrar com Google» novamente.',
      });
    }
  });

  fastify.post('/google/register', async (request, reply) => {
    const parsed = googleRegisterSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: firstZodIssue(parsed.error) });
    }
    const body = parsed.data;

    let googlePayload: { purpose?: string; sub?: string; email?: string };
    try {
      googlePayload = fastify.jwt.verify(body.pendingToken) as typeof googlePayload;
      if (googlePayload.purpose !== 'google-pending' || !googlePayload.sub || !googlePayload.email) {
        throw new Error('invalid');
      }
    } catch {
      return reply.code(400).send({
        error: 'Sessão Google expirada. Clique em «Entrar com Google» novamente.',
      });
    }

    const username = normalizeUsername(body.username);
    const email = googlePayload.email;

    const emailTaken = await fastify.prisma.user.findUnique({ where: { email } });
    if (emailTaken) {
      return reply.code(409).send({
        error: 'Este e-mail já está cadastrado. Use Entrar com Google ou e-mail.',
      });
    }

    const usernameTaken = await fastify.prisma.user.findUnique({ where: { username } });
    if (usernameTaken) {
      return reply.code(409).send({
        error: 'Este nome de usuário já está em uso. Escolha outro.',
      });
    }

    const identityTaken = await fastify.prisma.authIdentity.findUnique({
      where: {
        provider_providerId: { provider: 'google', providerId: googlePayload.sub },
      },
    });
    if (identityTaken) {
      return reply.code(409).send({
        error: 'Esta conta Google já está vinculada. Use Entrar.',
      });
    }

    const stateStored =
      body.country === 'BR' ? body.stateProvince.trim().toUpperCase() : body.stateProvince.trim();

    const user = await fastify.prisma.user.create({
      data: {
        email,
        username,
        country: body.country,
        stateProvince: stateStored,
        city: body.city.trim(),
        privacyAcceptedAt: new Date(),
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
        authIdentities: {
          create: {
            provider: 'google',
            providerId: googlePayload.sub,
            email,
          },
        },
      },
    });

    await fastify.prisma.rating.create({
      data: {
        userId: user.id,
        rating: 1500,
      },
    });

    const token = fastify.jwt.sign({ userId: user.id, email: user.email });

    return {
      token,
      user: userPublic(user),
    };
  });

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

    if (process.env.NODE_ENV !== 'production' && !process.env.BREVO_API_KEY) {
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
    if (process.env.NODE_ENV !== 'production' && !process.env.BREVO_API_KEY) {
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
