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

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://princefall-game-c4i256t2p-makuntzs-projects.vercel.app',
      'https://princefall-game-web.vercel.app'
    ];

fastify.register(cors, {
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
});

fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
});

fastify.decorate('prisma', prisma);

fastify.register(authRoutes, { prefix: '/api/auth' });
fastify.register(gameRoutes, { prefix: '/api/games' });
fastify.register(leaderboardRoutes, { prefix: '/api/leaderboard' });

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

process.on('SIGTERM', async () => {
  await fastify.close();
  await prisma.$disconnect();
});

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

