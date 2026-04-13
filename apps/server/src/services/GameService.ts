import { PrismaClient } from '@prisma/client';
import {
  createInitialState,
  applyAction,
  GameState,
  GameAction,
  Position,
  Piece,
} from '@princefall/game-core';
import type { Color, GameLifecycleStatus } from '@princefall/game-core';
import { randomBytes } from 'crypto';

type BoardJson = Record<string, { type: Piece['type']; color: Piece['color']; hasMoved?: boolean; canSwapWithPrince?: boolean }>;

export class GameService {
  private boardToJson(board: Map<string, Piece>): BoardJson {
    const json: BoardJson = {};
    board.forEach((piece, key) => {
      json[key] = {
        type: piece.type,
        color: piece.color,
        hasMoved: piece.hasMoved,
        canSwapWithPrince: piece.canSwapWithPrince,
      };
    });
    return json;
  }

  private jsonToBoard(json: BoardJson): Map<string, Piece> {
    const board = new Map<string, Piece>();
    Object.entries(json).forEach(([key, pieceData]) => {
      board.set(key, {
        type: pieceData.type,
        color: pieceData.color,
        hasMoved: pieceData.hasMoved,
        canSwapWithPrince: pieceData.canSwapWithPrince,
      });
    });
    return board;
  }

  private phaseToLifecycleStatus(phase: string): GameLifecycleStatus {
    if (phase === 'finished') return 'finished';
    if (phase === 'playing') return 'playing';
    if (phase === 'ready') return 'ready';
    if (phase === 'coinflip') return 'coinflip';
    return 'setup';
  }

  dbToGameState(game: any): GameState {
    const board = this.jsonToBoard((game.board || {}) as BoardJson);
    const phase = String(game.phase || 'waiting');
    const status = this.phaseToLifecycleStatus(phase);
    const coinflipResolved = phase === 'ready' || phase === 'playing' || phase === 'finished';

    let winner: Color | undefined;
    if (game.winnerId && game.whitePlayerId) {
      if (game.winnerId === game.whitePlayerId) winner = 'white';
      else if (game.blackPlayerId && game.winnerId === game.blackPlayerId) winner = 'black';
    }

    return {
      gameMode: 'imperial',
      board,
      currentTurn: game.currentTurn as 'white' | 'black',
      moveNumber: game.moveNumber,
      whiteGeneralPosition: game.whiteGeneralPos as Position | undefined,
      blackGeneralPosition: game.blackGeneralPos as Position | undefined,
      whiteKingSwapped: game.whiteKingSwapped || false,
      blackKingSwapped: game.blackKingSwapped || false,
      status,
      winner,
      endedAt: game.finishedAt ? new Date(game.finishedAt).getTime() : undefined,
      finishedReason: game.finishedReason || undefined,
      coinflipResolved,
    };
  }

  async createGame(
    prisma: PrismaClient,
    whitePlayerId: string,
    customInviteCode?: string
  ) {
    const inviteCode = customInviteCode 
      ? customInviteCode.toUpperCase().trim() 
      : this.generateInviteCode();
    const initialState = createInitialState();
    const boardJson = this.boardToJson(initialState.board);

    const game = await prisma.game.create({
      data: {
        whitePlayerId,
        inviteCode,
        board: boardJson as any,
        phase: 'waiting',
        currentTurn: 'white',
        moveNumber: 0,
        version: 1,
      },
      include: {
        whitePlayer: { select: { id: true, username: true } },
      },
    });

    return game;
  }

  async joinGame(
    prisma: PrismaClient,
    gameId: string,
    blackPlayerId: string,
    inviteCode: string
  ) {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      return null;
    }

    if (game.inviteCode.toUpperCase().trim() !== inviteCode.toUpperCase().trim()) {
      return null;
    }

    if (game.blackPlayerId) {
      return null;
    }

    const updatedGame = await prisma.game.update({
      where: { id: gameId },
      data: {
        blackPlayerId,
        phase: 'setup',
      },
      include: {
        whitePlayer: { select: { id: true, username: true } },
        blackPlayer: { select: { id: true, username: true } },
      },
    });

    return updatedGame;
  }

  async setupGeneral(
    prisma: PrismaClient,
    gameId: string,
    playerId: string,
    position: Position
  ) {
    return await prisma.$transaction(async (tx) => {
      const game = await tx.game.findUnique({
        where: { id: gameId },
      });

      if (!game) {
        return { success: false, error: 'Game not found' };
      }

      const playerColor =
        game.whitePlayerId === playerId
          ? 'white'
          : game.blackPlayerId === playerId
          ? 'black'
          : null;

      if (!playerColor) {
        return { success: false, error: 'Not a participant' };
      }

      if (game.phase !== 'setup' && game.phase !== 'waiting') {
        return { success: false, error: 'Game not in setup phase' };
      }
      
      if (game.phase === 'waiting' && playerColor !== 'white') {
        return { success: false, error: 'Waiting for second player to join' };
      }

      const gameState = this.dbToGameState(game);

      if (
        (playerColor === 'white' && gameState.whiteGeneralPosition) ||
        (playerColor === 'black' && gameState.blackGeneralPosition)
      ) {
        return { success: false, error: 'General already placed' };
      }

      const action: GameAction = {
        type: 'SETUP_GENERAL',
        payload: { position },
        playerColor,
      };

      const newState = applyAction(gameState, action);
      const boardJson = this.boardToJson(newState.board);

      const updateData: any = {
        board: boardJson,
        currentTurn: newState.currentTurn,
        version: game.version + 1,
      };

      if (playerColor === 'white') {
        updateData.whiteGeneralPos = position;
      } else {
        updateData.blackGeneralPos = position;
      }

      if (newState.whiteGeneralPosition && newState.blackGeneralPosition) {
        updateData.phase = 'coinflip';
      } else if (game.phase === 'waiting') {
        updateData.phase = 'setup';
      }

      const updatedGame = await tx.game.update({
        where: { id: gameId },
        data: updateData,
        include: {
          whitePlayer: { select: { id: true, username: true } },
          blackPlayer: { select: { id: true, username: true } },
        },
      });

      return {
        success: true,
        game: updatedGame,
        gameState: newState,
      };
    });
  }

  async doCoinflip(
    prisma: PrismaClient,
    gameId: string,
    playerId: string
  ) {
    return await prisma.$transaction(async (tx) => {
      const game = await tx.game.findUnique({
        where: { id: gameId },
      });

      if (!game) {
        return { success: false, error: 'Game not found' };
      }

      const playerColor =
        game.whitePlayerId === playerId
          ? 'white'
          : game.blackPlayerId === playerId
          ? 'black'
          : null;

      if (!playerColor) {
        return { success: false, error: 'Not a participant' };
      }

      if (game.phase === 'ready') {
        const gameWithPlayers = await tx.game.findUnique({
          where: { id: gameId },
          include: {
            whitePlayer: { select: { id: true, username: true } },
            blackPlayer: { select: { id: true, username: true } },
          },
        });
        return {
          success: true,
          game: gameWithPlayers || game,
          coinflipDone: true,
          currentTurn: game.currentTurn as Color,
        };
      }

      if (game.phase !== 'coinflip') {
        return {
          success: false,
          error: `Game not in coinflip phase. Current phase: ${game.phase}`,
        };
      }

      const coinflipResult = Math.random() < 0.5 ? 'white' : 'black';

      const updatedGame = await tx.game.update({
        where: { id: gameId },
        data: {
          currentTurn: coinflipResult,
          phase: 'ready',
          version: game.version + 1,
        },
        include: {
          whitePlayer: { select: { id: true, username: true } },
          blackPlayer: { select: { id: true, username: true } },
        },
      });

      return {
        success: true,
        game: updatedGame,
        coinflipDone: false,
        coinflipResult,
      };
    });
  }

  async beginPlaying(prisma: PrismaClient, gameId: string, playerId: string) {
    return await prisma.$transaction(async (tx) => {
      const game = await tx.game.findUnique({
        where: { id: gameId },
      });

      if (!game) {
        return { success: false, error: 'Game not found' };
      }

      const isPlayer =
        game.whitePlayerId === playerId ||
        (game.blackPlayerId && game.blackPlayerId === playerId);
      if (!isPlayer) {
        return { success: false, error: 'Not a participant' };
      }

      if (game.phase !== 'ready') {
        return {
          success: false,
          error: `Cannot start: game phase is ${game.phase}`,
        };
      }

      const updatedGame = await tx.game.update({
        where: { id: gameId },
        data: {
          phase: 'playing',
          version: game.version + 1,
        },
        include: {
          whitePlayer: { select: { id: true, username: true } },
          blackPlayer: { select: { id: true, username: true } },
        },
      });

      return { success: true, game: updatedGame };
    });
  }

  async submitMove(
    prisma: PrismaClient,
    gameId: string,
    playerId: string,
    moveData: {
      from: Position;
      to: Position;
      promotion?: string;
      isSwap?: boolean;
      moveNumber: number;
    }
  ) {
    return await prisma.$transaction(async (tx) => {
      const game = await tx.game.findUnique({
        where: { id: gameId },
      });

      if (!game) {
        return { success: false, error: 'Game not found' };
      }

      const playerColor =
        game.whitePlayerId === playerId
          ? 'white'
          : game.blackPlayerId === playerId
          ? 'black'
          : null;

      if (!playerColor) {
        return { success: false, error: 'Not a participant' };
      }

      if (game.phase !== 'playing') {
        return { success: false, error: 'Game not in playing phase' };
      }

      if (moveData.moveNumber !== game.moveNumber) {
        return {
          success: false,
          error: `Invalid move number. Expected ${game.moveNumber}, got ${moveData.moveNumber}`,
        };
      }

      const nextMoveNumber = game.moveNumber + 1;

      const existingMove = await tx.gameMove.findUnique({
        where: {
          gameId_moveNumber: {
            gameId,
            moveNumber: nextMoveNumber,
          },
        },
      });

      if (existingMove) {
        const gameState = this.dbToGameState(game);
        const gameWithPlayers = await tx.game.findUnique({
          where: { id: gameId },
          include: {
            whitePlayer: { select: { id: true, username: true } },
            blackPlayer: { select: { id: true, username: true } },
          },
        });
        return {
          success: true,
          game: gameWithPlayers || game,
          gameState,
          move: existingMove,
        };
      }

      const gameState = this.dbToGameState(game);

      if (gameState.currentTurn !== playerColor) {
        return { success: false, error: 'Not your turn' };
      }

      let action: GameAction;
      if (moveData.isSwap) {
        action = {
          type: 'SWAP_KING_PRINCE',
          payload: {
            swapFrom: moveData.from,
            swapTo: moveData.to,
          },
          playerColor,
        };
      } else {
        action = {
          type: 'MOVE',
          payload: {
            move: {
              from: moveData.from,
              to: moveData.to,
              promotion: moveData.promotion as any,
              isSwap: false,
            },
          },
          playerColor,
        };
      }

      const newState = applyAction(gameState, action);

      if (newState.moveNumber === gameState.moveNumber) {
        return { success: false, error: 'Invalid move' };
      }

      const boardJson = this.boardToJson(newState.board);

      const move = await tx.gameMove.create({
        data: {
          gameId,
          moveNumber: nextMoveNumber,
          playerId,
          from: `${moveData.from.col}${moveData.from.row}`,
          to: `${moveData.to.col}${moveData.to.row}`,
          promotion: moveData.promotion,
          isSwap: moveData.isSwap || false,
        },
      });

      const updateData: any = {
        board: boardJson,
        currentTurn: newState.currentTurn,
        moveNumber: newState.moveNumber,
        whiteKingSwapped: newState.whiteKingSwapped,
        blackKingSwapped: newState.blackKingSwapped,
        version: game.version + 1,
      };

      if (newState.status === 'finished') {
        updateData.phase = 'finished';
        updateData.finishedAt = new Date();
        updateData.finishedReason = newState.finishedReason || 'prince_capture';
        if (newState.winner) {
          const winnerPlayerId =
            newState.winner === 'white' ? game.whitePlayerId : game.blackPlayerId!;
          updateData.winnerId = winnerPlayerId;
        } else {
          updateData.winnerId = null;
        }
      }

      const updatedGame = await tx.game.update({
        where: { id: gameId },
        data: updateData,
        include: {
          whitePlayer: { select: { id: true, username: true } },
          blackPlayer: { select: { id: true, username: true } },
        },
      });

      if (newState.status === 'finished' && newState.winner && game.blackPlayerId) {
        const winnerPlayerId =
          newState.winner === 'white' ? game.whitePlayerId : game.blackPlayerId;
        await this.updateRatings(tx, game.whitePlayerId, game.blackPlayerId, winnerPlayerId);
      }

      return {
        success: true,
        game: updatedGame,
        gameState: newState,
        move,
      };
    });
  }

  private async updateRatings(
    prisma: any,
    whitePlayerId: string,
    blackPlayerId: string,
    winnerId: string
  ) {
    const whiteRating = await prisma.rating.findUnique({
      where: { userId: whitePlayerId },
    });
    const blackRating = await prisma.rating.findUnique({
      where: { userId: blackPlayerId },
    });

    if (!whiteRating || !blackRating) {
      return;
    }

    const K = 32;
    const whiteExpected = 1 / (1 + Math.pow(10, (blackRating.rating - whiteRating.rating) / 400));
    const blackExpected = 1 / (1 + Math.pow(10, (whiteRating.rating - blackRating.rating) / 400));

    const whiteScore = winnerId === whitePlayerId ? 1 : 0;
    const blackScore = winnerId === blackPlayerId ? 1 : 0;

    const whiteNewRating = Math.round(whiteRating.rating + K * (whiteScore - whiteExpected));
    const blackNewRating = Math.round(blackRating.rating + K * (blackScore - blackExpected));

    await prisma.rating.update({
      where: { userId: whitePlayerId },
      data: {
        rating: whiteNewRating,
        gamesPlayed: whiteRating.gamesPlayed + 1,
        wins: whiteRating.wins + (whiteScore === 1 ? 1 : 0),
        losses: whiteRating.losses + (whiteScore === 0 ? 1 : 0),
      },
    });

    await prisma.rating.update({
      where: { userId: blackPlayerId },
      data: {
        rating: blackNewRating,
        gamesPlayed: blackRating.gamesPlayed + 1,
        wins: blackRating.wins + (blackScore === 1 ? 1 : 0),
        losses: blackRating.losses + (blackScore === 0 ? 1 : 0),
      },
    });
  }

  private generateInviteCode(): string {
    return randomBytes(6).toString('hex').toUpperCase();
  }
}
