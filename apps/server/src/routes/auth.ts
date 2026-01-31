import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
});

export async function authRoutes(fastify: FastifyInstance) {
  // POST /api/auth/login
  // Magic link login (simplificado para V1)
  fastify.post('/login', async (request, reply) => {
    const { email } = loginSchema.parse(request.body);

    // Em produção, enviar email com magic link
    // Por enquanto, apenas criar/retornar usuário
    let user = await fastify.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Criar usuário
      user = await fastify.prisma.user.create({
        data: {
          email,
          username: email.split('@')[0],
        },
      });

      // Criar rating inicial
      await fastify.prisma.rating.create({
        data: {
          userId: user.id,
          rating: 1500,
        },
      });
    }

    const token = fastify.jwt.sign({ userId: user.id, email: user.email });

    return { token, user: { id: user.id, email: user.email, username: user.username } };
  });

  // GET /api/auth/me
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
}

// Middleware de autenticação
async function authenticate(request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
}

