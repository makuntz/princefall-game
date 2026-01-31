import { FastifyInstance } from 'fastify';

export async function leaderboardRoutes(fastify: FastifyInstance) {
  // GET /api/leaderboard
  fastify.get('/', async (request, reply) => {
    const limit = parseInt((request.query as any)?.limit || '100', 10);

    const ratings = await fastify.prisma.rating.findMany({
      orderBy: { rating: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    return {
      leaderboard: ratings.map((r, index) => ({
        rank: index + 1,
        userId: r.userId,
        username: r.user.username,
        rating: r.rating,
        gamesPlayed: r.gamesPlayed,
        wins: r.wins,
        losses: r.losses,
        draws: r.draws,
      })),
    };
  });
}

