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
  moveNumber: z.number().int(), // Move number esperado (anti-cheat)
});

const setupGeneralSchema = z.object({
  position: z.object({
    col: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']),
    row: z.number().int().min(1).max(9),
  }),
});

// Middleware de autenticação simples
async function authenticate(request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
}

export async function gameRoutes(fastify: FastifyInstance) {
  // POST /api/games - Criar partida
  fastify.post('/', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { inviteCode } = createGameSchema.parse(request.body);

    const game = await gameService.createGame(fastify.prisma, userId, inviteCode);

    return { game };
  });

  // POST /api/games/join-by-code - Entrar em partida apenas pelo código
  fastify.post('/join-by-code', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { inviteCode } = joinGameSchema.parse(request.body);

    // Buscar jogo pelo código
    const game = await fastify.prisma.game.findUnique({
      where: { inviteCode: inviteCode.toUpperCase().trim() },
    });

    if (!game) {
      return reply.code(404).send({ error: 'Código de convite inválido' });
    }

    // Verificar se já tem jogador preto
    if (game.blackPlayerId) {
      return reply.code(400).send({ error: 'Esta partida já está completa' });
    }

    // Verificar se o usuário não é o criador da partida
    if (game.whitePlayerId === userId) {
      return reply.code(400).send({ error: 'Você já é o criador desta partida' });
    }

    // Entrar na partida
    const joinedGame = await gameService.joinGame(fastify.prisma, game.id, userId, inviteCode);

    if (!joinedGame) {
      return reply.code(404).send({ error: 'Erro ao entrar na partida' });
    }

    return { game: joinedGame };
  });

  // POST /api/games/:id/join - Entrar em partida
  fastify.post('/:id/join', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { id } = request.params as { id: string };
    const { inviteCode } = joinGameSchema.parse(request.body);

    const game = await gameService.joinGame(fastify.prisma, id, userId, inviteCode);

    if (!game) {
      return reply.code(404).send({ error: 'Game not found or invalid invite code' });
    }

    return { game };
  });

  // GET /api/games/:id - Obter estado da partida
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

    // Verificar se usuário é participante
    if (game.whitePlayerId !== userId && game.blackPlayerId !== userId) {
      return reply.code(403).send({ error: 'Not a participant' });
    }

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
      },
      gameState,
    };
  });

  // POST /api/games/:id/setup - Setup do general
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

    return { game: result.game, gameState: result.gameState };
  });

  // POST /api/games/:id/moves - Fazer jogada
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

    return {
      game: result.game,
      gameState: result.gameState,
      move: result.move,
    };
  });

  // GET /api/games - Listar partidas do usuário
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

