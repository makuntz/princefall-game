import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { GameService } from '../services/GameService';
import { serializeState } from '@princefall/game-core';

const gameService = new GameService();
const MATCH_CLOCK_MS = 10 * 60 * 1000;

const createGameSchema = z.object({
  inviteCode: z.string().optional(),
  gameMode: z.enum(['imperial', 'traditional']).optional(),
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

const saveVsComputerSchema = z.object({
  humanColor: z.enum(['white', 'black']),
  gameState: z.object({
    gameMode: z.enum(['imperial', 'traditional']).optional(),
    board: z.record(
      z.object({
        type: z.string(),
        color: z.enum(['white', 'black']),
        hasMoved: z.boolean().optional(),
        canSwapWithPrince: z.boolean().optional(),
      })
    ),
    currentTurn: z.enum(['white', 'black']),
    moveNumber: z.number().int(),
    whiteGeneralPosition: z
      .object({
        col: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']),
        row: z.number().int().min(1).max(9),
      })
      .optional(),
    blackGeneralPosition: z
      .object({
        col: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']),
        row: z.number().int().min(1).max(9),
      })
      .optional(),
    whiteKingSwapped: z.boolean(),
    blackKingSwapped: z.boolean(),
    status: z.enum(['setup', 'coinflip', 'ready', 'playing', 'finished']),
    winner: z.enum(['white', 'black']).optional(),
    finishedReason: z
      .enum(['prince_capture', 'king_capture', 'timeout', 'timeout_draw', 'resign', 'aborted'])
      .optional(),
    whiteImperialCapturePoints: z.number().optional(),
    blackImperialCapturePoints: z.number().optional(),
  }),
  whiteTimeMs: z.number().int().min(0).optional(),
  blackTimeMs: z.number().int().min(0).optional(),
});

async function authenticate(request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
}

function turnStartedAtIso(game: { turnStartedAt?: Date | string | null }) {
  if (!game.turnStartedAt) return null;
  if (typeof game.turnStartedAt === 'string') return game.turnStartedAt;
  return game.turnStartedAt.toISOString();
}

export async function gameRoutes(fastify: FastifyInstance) {
  fastify.post('/', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { inviteCode, gameMode: modeFromBody } = createGameSchema.parse(request.body);
    const gameMode = modeFromBody ?? 'imperial';

    const game = await gameService.createGame(
      fastify.prisma,
      userId,
      inviteCode,
      gameMode
    );
    const gameState = gameService.dbToGameState(game);
    const serializedGameState = serializeState(gameState);

    return { 
      game: {
        id: game.id,
        inviteCode: game.inviteCode,
        phase: game.phase,
        currentTurn: game.currentTurn,
        moveNumber: game.moveNumber,
        whitePlayer: game.whitePlayer,
        blackPlayer: null,
        whiteGeneralPos: game.whiteGeneralPos,
        blackGeneralPos: game.blackGeneralPos,
        gameMode: game.gameMode ?? 'imperial',
        playerColor: 'white' as const,
      },
      gameState: serializedGameState,
    };
  });

  fastify.post('/join-by-code', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { inviteCode } = joinGameSchema.parse(request.body);

    const normalizedCode = inviteCode.toUpperCase().trim();

    const game = await fastify.prisma.game.findUnique({
      where: { inviteCode: normalizedCode },
    });

    if (!game) {
      return reply.code(404).send({ error: 'Código de convite inválido' });
    }

    if (game.blackPlayerId) {
      return reply.code(400).send({ error: 'Esta partida já está completa' });
    }

    if (game.whitePlayerId === userId) {
      return reply.code(400).send({ error: 'Você já é o criador desta partida' });
    }

    const joinedGame = await gameService.joinGame(fastify.prisma, game.id, userId, normalizedCode);

    if (!joinedGame) {
      return reply.code(404).send({ error: 'Erro ao entrar na partida' });
    }

    const gameState = gameService.dbToGameState(joinedGame);
    const serializedGameState = serializeState(gameState);

    return { 
      game: {
        id: joinedGame.id,
        inviteCode: joinedGame.inviteCode,
        phase: joinedGame.phase,
        currentTurn: joinedGame.currentTurn,
        moveNumber: joinedGame.moveNumber,
        whitePlayer: joinedGame.whitePlayer,
        blackPlayer: joinedGame.blackPlayer,
        whiteGeneralPos: joinedGame.whiteGeneralPos,
        blackGeneralPos: joinedGame.blackGeneralPos,
        gameMode: joinedGame.gameMode ?? 'imperial',
        playerColor: 'black' as const,
      },
      gameState: serializedGameState,
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

    const game = await gameService.loadGameSyncingTimeout(fastify.prisma, id);

    if (!game) {
      return reply.code(404).send({ error: 'Game not found' });
    }

    if (game.whitePlayerId !== userId && game.blackPlayerId !== userId) {
      return reply.code(403).send({ error: 'Not a participant' });
    }

    const playerColor = game.whitePlayerId === userId ? 'white' : 'black';
    const gameState = gameService.dbToGameState(game);
    const serializedGameState = serializeState(gameState);

    return {
      game: {
        id: game.id,
        inviteCode: game.inviteCode,
        phase: game.phase,
        currentTurn: game.currentTurn,
        moveNumber: game.moveNumber,
        whitePlayer: game.whitePlayer,
        blackPlayer: game.blackPlayer,
        whiteGeneralPos: game.whiteGeneralPos,
        blackGeneralPos: game.blackGeneralPos,
        gameMode: game.gameMode ?? 'imperial',
        whiteTimeMs: game.whiteTimeMs ?? MATCH_CLOCK_MS,
        blackTimeMs: game.blackTimeMs ?? MATCH_CLOCK_MS,
        turnStartedAt: turnStartedAtIso(game),
        winnerId: game.winnerId,
        finishedReason: game.finishedReason ?? null,
        createdAt: game.createdAt,
        updatedAt: game.updatedAt,
        playerColor,
      },
      gameState: serializedGameState,
    };
  });

  fastify.post('/:id/begin', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { id } = request.params as { id: string };

    const result = await gameService.beginPlaying(fastify.prisma, id, userId);

    if (!result.success) {
      return reply.code(400).send({ error: result.error });
    }

    if (!result.game) {
      return reply.code(500).send({ error: 'Game not found after begin' });
    }

    const game = result.game as any;
    const playerColor = game.whitePlayerId === userId ? 'white' : 'black';
    const gameState = gameService.dbToGameState(game);
    const serializedGameState = serializeState(gameState);

    return {
      game: {
        id: game.id,
        inviteCode: game.inviteCode,
        phase: game.phase,
        currentTurn: game.currentTurn,
        moveNumber: game.moveNumber,
        whitePlayer: game.whitePlayer || null,
        blackPlayer: game.blackPlayer || null,
        whiteGeneralPos: game.whiteGeneralPos,
        blackGeneralPos: game.blackGeneralPos,
        gameMode: game.gameMode ?? 'imperial',
        whiteTimeMs: game.whiteTimeMs ?? MATCH_CLOCK_MS,
        blackTimeMs: game.blackTimeMs ?? MATCH_CLOCK_MS,
        turnStartedAt: turnStartedAtIso(game),
        playerColor,
      },
      gameState: serializedGameState,
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
    const gameState = gameService.dbToGameState(result.game);
    const serializedGameState = serializeState(gameState);
    const gameWithPlayers = result.game as any;

    return {
      game: {
        id: result.game.id,
        inviteCode: result.game.inviteCode,
        phase: result.game.phase,
        currentTurn: result.game.currentTurn,
        moveNumber: result.game.moveNumber,
        whitePlayer: gameWithPlayers.whitePlayer || null,
        blackPlayer: gameWithPlayers.blackPlayer || null,
        whiteGeneralPos: result.game.whiteGeneralPos,
        blackGeneralPos: result.game.blackGeneralPos,
        gameMode: result.game.gameMode ?? 'imperial',
        playerColor,
      },
      gameState: serializedGameState,
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
    const serializedGameState = serializeState(result.gameState);

    return { 
      game: {
        id: result.game.id,
        inviteCode: result.game.inviteCode,
        phase: result.game.phase,
        currentTurn: result.game.currentTurn,
        moveNumber: result.game.moveNumber,
        whitePlayer: result.game.whitePlayer,
        blackPlayer: result.game.blackPlayer,
        whiteGeneralPos: result.game.whiteGeneralPos,
        blackGeneralPos: result.game.blackGeneralPos,
        gameMode: result.game.gameMode ?? 'imperial',
        playerColor,
      }, 
      gameState: serializedGameState 
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

    if (!result.gameState) {
      return reply.code(500).send({ error: 'Missing game state after move' });
    }

    const playerColor = result.game.whitePlayerId === userId ? 'white' : 'black';
    const serializedGameState = serializeState(result.gameState);
    const movePayload =
      'move' in result && result.move !== undefined ? { move: result.move } : {};

    return {
      game: {
        id: result.game.id,
        inviteCode: result.game.inviteCode,
        phase: result.game.phase,
        currentTurn: result.game.currentTurn,
        moveNumber: result.game.moveNumber,
        whitePlayer: 'whitePlayer' in result.game ? result.game.whitePlayer : null,
        blackPlayer: 'blackPlayer' in result.game ? result.game.blackPlayer : null,
        whiteGeneralPos: result.game.whiteGeneralPos,
        blackGeneralPos: result.game.blackGeneralPos,
        gameMode: result.game.gameMode ?? 'imperial',
        whiteTimeMs: result.game.whiteTimeMs ?? MATCH_CLOCK_MS,
        blackTimeMs: result.game.blackTimeMs ?? MATCH_CLOCK_MS,
        turnStartedAt: turnStartedAtIso(result.game),
        finishedReason: result.game.finishedReason ?? null,
        playerColor,
      },
      gameState: serializedGameState,
      ...movePayload,
    };
  });

  fastify.post('/vs-computer', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const body = saveVsComputerSchema.parse(request.body);

    const result = await gameService.saveVsComputerGame(fastify.prisma, userId, {
      humanColor: body.humanColor,
      gameState: body.gameState as import('@princefall/game-core').SerializedGameState,
      whiteTimeMs: body.whiteTimeMs,
      blackTimeMs: body.blackTimeMs,
    });

    if (!result.success) {
      return reply.code(400).send({ error: result.error });
    }

    const saved = result.game as typeof result.game & {
      whitePlayer: { id: string; username: string };
      blackPlayer: { id: string; username: string } | null;
    };

    return {
      game: {
        id: saved.id,
        inviteCode: saved.inviteCode,
        phase: saved.phase,
        whitePlayer: saved.whitePlayer,
        blackPlayer: saved.blackPlayer,
      },
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

  fastify.delete('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { id } = request.params as { id: string };

    const result = await gameService.deleteGame(fastify.prisma, id, userId);

    if (!result.success) {
      const status = result.error === 'Partida não encontrada' ? 404 : 403;
      return reply.code(status).send({ error: result.error });
    }

    return { ok: true };
  });
}

