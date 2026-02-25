import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
});

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/login', async (request, reply) => {
    const { email } = loginSchema.parse(request.body);

    let user = await fastify.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await fastify.prisma.user.create({
        data: {
          email,
          username: email.split('@')[0],
        },
      });

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

async function authenticate(request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
}

