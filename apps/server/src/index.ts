import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { PrismaClient } from '@prisma/client';
import { authRoutes } from './routes/auth';
import { gameRoutes } from './routes/games';
import { leaderboardRoutes } from './routes/leaderboard';

const prisma = new PrismaClient();

const fastify = Fastify({
  logger: true,
});

// Plugins
fastify.register(cors, {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
});

fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
});

// Decorators
fastify.decorate('prisma', prisma);

// Routes
fastify.register(authRoutes, { prefix: '/api/auth' });
fastify.register(gameRoutes, { prefix: '/api/games' });
fastify.register(leaderboardRoutes, { prefix: '/api/leaderboard' });

// Health check
fastify.get('/health', async () => {
  return { status: 'ok' };
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001', 10);
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await fastify.close();
  await prisma.$disconnect();
});

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

