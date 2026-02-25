import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { GameService } from '../services/GameService';
import { createInitialState, applyAction, serializeState, deserializeState } from '@princefall/game-core';
import { GameAction } from '@princefall/game-core';

const gameService = new GameService();

const createGameSchema = z.object({
  inviteCode: z.string().optional(),
});

const joinGameSchema = z.object({
  inviteCode: z.string(),
});

const submitMoveSchema = z.object({
  from: z.object({
    col: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']),
    row: z.number().int().min(1).max(9),
  }),
  to: z.object({
    col: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']),
    row: z.number().int().min(1).max(9),
  }),
  promotion: z.string().optional(),
  isSwap: z.boolean().optional(),
  moveNumber: z.number().int(),
});

const setupGeneralSchema = z.object({
  position: z.object({
    col: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']),
    row: z.number().int().min(1).max(9),
  }),
});

async function authenticate(request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
}

export async function gameRoutes(fastify: FastifyInstance) {
  fastify.post('/', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { inviteCode } = createGameSchema.parse(request.body);

    const game = await gameService.createGame(fastify.prisma, userId, inviteCode);

    return { 
      game: {
        ...game,
        playerColor: 'white' as const,
      }
    };
  });

  fastify.post('/join-by-code', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { inviteCode } = joinGameSchema.parse(request.body);

    const normalizedCode = inviteCode.toUpperCase().trim();

    fastify.log.info(`Tentativa de entrar no jogo com código: ${normalizedCode} (usuário: ${userId})`);

    const game = await fastify.prisma.game.findUnique({
      where: { inviteCode: normalizedCode },
    });

    if (!game) {
      fastify.log.warn(`Código não encontrado: ${normalizedCode}`);
      return reply.code(404).send({ error: 'Código de convite inválido' });
    }

    fastify.log.info(`Jogo encontrado: ${game.id}, status: ${game.status}, blackPlayerId: ${game.blackPlayerId}`);

    if (game.blackPlayerId) {
      return reply.code(400).send({ error: 'Esta partida já está completa' });
    }

    if (game.whitePlayerId === userId) {
      return reply.code(400).send({ error: 'Você já é o criador desta partida' });
    }

    const joinedGame = await gameService.joinGame(fastify.prisma, game.id, userId, normalizedCode);

    if (!joinedGame) {
      fastify.log.error(`Erro ao entrar no jogo ${game.id} com código ${normalizedCode}`);
      return reply.code(404).send({ error: 'Erro ao entrar na partida' });
    }

    fastify.log.info(`Usuário ${userId} entrou no jogo ${game.id} com sucesso`);
    return { 
      game: {
        ...joinedGame,
        playerColor: 'black' as const,
      }
    };
  });

  fastify.post('/:id/join', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { id } = request.params as { id: string };
    const { inviteCode } = joinGameSchema.parse(request.body);

    const game = await gameService.joinGame(fastify.prisma, id, userId, inviteCode);

    if (!game) {
      return reply.code(404).send({ error: 'Game not found or invalid invite code' });
    }

    const playerColor = game.whitePlayerId === userId ? 'white' : 'black';

    return { 
      game: {
        ...game,
        playerColor,
      }
    };
  });

  fastify.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { id } = request.params as { id: string };

    const game = await fastify.prisma.game.findUnique({
      where: { id },
      include: {
        whitePlayer: { select: { id: true, username: true } },
        blackPlayer: { select: { id: true, username: true } },
        moves: { orderBy: { moveNumber: 'asc' } },
      },
    });

    if (!game) {
      return reply.code(404).send({ error: 'Game not found' });
    }

    if (game.whitePlayerId !== userId && game.blackPlayerId !== userId) {
      return reply.code(403).send({ error: 'Not a participant' });
    }

    const playerColor = game.whitePlayerId === userId ? 'white' : 'black';

    const gameState = deserializeState(game.gameState as any);

    return {
      game: {
        id: game.id,
        status: game.status,
        whitePlayer: game.whitePlayer,
        blackPlayer: game.blackPlayer,
        currentTurn: game.currentTurn,
        moveNumber: game.moveNumber,
        winnerId: game.winnerId,
        inviteCode: game.inviteCode,
        createdAt: game.createdAt,
        updatedAt: game.updatedAt,
        playerColor,
      },
      gameState,
    };
  });

  fastify.post('/:id/coinflip', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { id } = request.params as { id: string };

    const result = await gameService.doCoinflip(fastify.prisma, id, userId);

    if (!result.success) {
      return reply.code(400).send({ error: result.error });
    }

    if (!result.game) {
      return reply.code(500).send({ error: 'Game not found after coinflip' });
    }

    const playerColor = result.game.whitePlayerId === userId ? 'white' : 'black';

    return {
      game: {
        ...result.game,
        playerColor,
      },
      gameState: result.gameState,
      coinflipDone: result.coinflipDone,
      coinflipResult: result.coinflipResult,
      currentTurn: result.currentTurn,
    };
  });

  fastify.post('/:id/setup', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { id } = request.params as { id: string };
    const { position } = setupGeneralSchema.parse(request.body);

    const result = await gameService.setupGeneral(
      fastify.prisma,
      id,
      userId,
      { col: position.col, row: position.row as any }
    );

    if (!result.success) {
      return reply.code(400).send({ error: result.error });
    }

    if (!result.game) {
      return reply.code(500).send({ error: 'Game not found after setup' });
    }

    const playerColor = result.game.whitePlayerId === userId ? 'white' : 'black';

    return { 
      game: {
        ...result.game,
        playerColor,
      }, 
      gameState: result.gameState 
    };
  });

  fastify.post('/:id/moves', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { id } = request.params as { id: string };
    const moveData = submitMoveSchema.parse(request.body);

      const result = await gameService.submitMove(
        fastify.prisma,
        id,
        userId,
        {
          from: { col: moveData.from.col, row: moveData.from.row as any },
          to: { col: moveData.to.col, row: moveData.to.row as any },
          promotion: moveData.promotion,
          isSwap: moveData.isSwap,
          moveNumber: moveData.moveNumber,
        }
      );

    if (!result.success) {
      return reply.code(400).send({ error: result.error });
    }

    if (!result.game) {
      return reply.code(500).send({ error: 'Game not found after move' });
    }

    const playerColor = result.game.whitePlayerId === userId ? 'white' : 'black';

    return {
      game: {
        ...result.game,
        playerColor,
      },
      gameState: result.gameState,
      move: result.move,
    };
  });

  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = (request.user as any).userId;

    const games = await fastify.prisma.game.findMany({
      where: {
        OR: [{ whitePlayerId: userId }, { blackPlayerId: userId }],
      },
      include: {
        whitePlayer: { select: { id: true, username: true } },
        blackPlayer: { select: { id: true, username: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    return { games };
  });
}

