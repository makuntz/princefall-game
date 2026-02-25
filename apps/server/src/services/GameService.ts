import { PrismaClient } from '@prisma/client';
import {
  createInitialState,
  applyAction,
  serializeState,
  deserializeState,
  GameState,
  GameAction,
  Position,
} from '@princefall/game-core';
import { randomBytes } from 'crypto';

export class GameService {
  /**
   * Cria uma nova partida
   */
  async createGame(
    prisma: PrismaClient,
    whitePlayerId: string,
    customInviteCode?: string
  ) {
    // Normalizar código (uppercase e trim) se fornecido, senão gerar novo
    const inviteCode = customInviteCode 
      ? customInviteCode.toUpperCase().trim() 
      : this.generateInviteCode();
    const initialState = createInitialState();

    const game = await prisma.game.create({
      data: {
        whitePlayerId,
        status: 'waiting',
        inviteCode,
        gameState: serializeState(initialState) as any,
        version: 1,
      },
      include: {
        whitePlayer: { select: { id: true, username: true } },
      },
    });

    return game;
  }

  /**
   * Entra em uma partida existente
   */
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

    // Comparar códigos de forma case-insensitive
    if (game.inviteCode.toUpperCase().trim() !== inviteCode.toUpperCase().trim()) {
      return null;
    }

    if (game.blackPlayerId) {
      return null; // Já tem jogador preto
    }

    const updatedGame = await prisma.game.update({
      where: { id: gameId },
      data: {
        blackPlayerId,
        status: 'setup',
      },
      include: {
        whitePlayer: { select: { id: true, username: true } },
        blackPlayer: { select: { id: true, username: true } },
      },
    });

    return updatedGame;
  }

  /**
   * Setup do general (fase de preparação)
   */
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

      // Verificar se usuário é participante
      const playerColor =
        game.whitePlayerId === playerId
          ? 'white'
          : game.blackPlayerId === playerId
          ? 'black'
          : null;

      if (!playerColor) {
        return { success: false, error: 'Not a participant' };
      }

      // Permitir setup quando status é 'waiting' (jogador branco) ou 'setup' (ambos podem fazer setup)
      if (game.status !== 'setup' && game.status !== 'waiting') {
        return { success: false, error: 'Game not in setup phase' };
      }
      
      // Se status é 'waiting', significa que só o jogador branco entrou
      // Nesse caso, só o jogador branco pode fazer setup
      if (game.status === 'waiting' && playerColor !== 'white') {
        return { success: false, error: 'Waiting for second player to join' };
      }

      const gameState = deserializeState(game.gameState as any);

      // Verificar se já escolheu
      if (
        (playerColor === 'white' && gameState.whiteGeneralPosition) ||
        (playerColor === 'black' && gameState.blackGeneralPosition)
      ) {
        return { success: false, error: 'General already placed' };
      }

      // Aplicar ação
      const action: GameAction = {
        type: 'SETUP_GENERAL',
        payload: { position },
        playerColor,
      };

      const newState = applyAction(gameState, action);
      
      // Debug: verificar se o board está vazio após aplicar ação
      if (newState.board.size === 0 && gameState.board.size > 0) {
        console.error('⚠️ Board foi limpo após applyAction!', {
          beforeSize: gameState.board.size,
          afterSize: newState.board.size,
          actionType: action.type,
        });
      }
      
      const serialized = serializeState(newState);
      
      // Debug: verificar serialização
      if (Object.keys(serialized.board).length === 0 && newState.board.size > 0) {
        console.error('⚠️ Board não foi serializado corretamente!', {
          boardSize: newState.board.size,
          serializedKeys: Object.keys(serialized.board).length,
        });
      }

      // Atualizar jogo
      // Se estava 'waiting', mudar para 'setup' (ou 'playing' se ambos já escolheram)
      const newStatus = game.status === 'waiting' ? (newState.status === 'playing' ? 'playing' : 'setup') : newState.status;
      
      const updatedGame = await tx.game.update({
        where: { id: gameId },
        data: {
          gameState: serialized as any,
          status: newStatus,
          currentTurn: newState.currentTurn,
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
        gameState: newState,
      };
    });
  }

  /**
   * Submete uma jogada (servidor autoritativo)
   */
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

      // Verificar se usuário é participante
      const playerColor =
        game.whitePlayerId === playerId
          ? 'white'
          : game.blackPlayerId === playerId
          ? 'black'
          : null;

      if (!playerColor) {
        return { success: false, error: 'Not a participant' };
      }

      if (game.status !== 'playing') {
        return { success: false, error: 'Game not in playing phase' };
      }

      // ANTI-CHEAT: Validar moveNumber esperado
      if (moveData.moveNumber !== game.moveNumber) {
        return {
          success: false,
          error: `Invalid move number. Expected ${game.moveNumber}, got ${moveData.moveNumber}`,
        };
      }

      // ANTI-CHEAT: Verificar se já existe movimento com esse número (idempotência)
      const existingMove = await tx.gameMove.findUnique({
        where: {
          gameId_moveNumber: {
            gameId,
            moveNumber: moveData.moveNumber,
          },
        },
      });

      if (existingMove) {
        // Idempotência: retornar estado atual
        const gameState = deserializeState(game.gameState as any);
        return {
          success: true,
          game,
          gameState,
          move: existingMove,
        };
      }

      const gameState = deserializeState(game.gameState as any);

      // ANTI-CHEAT: Validar turno
      if (gameState.currentTurn !== playerColor) {
        return { success: false, error: 'Not your turn' };
      }

      // Se for swap, usar ação SWAP_KING_PRINCE
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

      // ANTI-CHEAT: Validar que o movimento foi aplicado (se não, é inválido)
      if (newState.moveNumber === gameState.moveNumber) {
        return { success: false, error: 'Invalid move' };
      }

      const serialized = serializeState(newState);

      // Criar registro do movimento
      const move = await tx.gameMove.create({
        data: {
          gameId,
          moveNumber: newState.moveNumber,
          playerId,
          from: `${moveData.from.col}${moveData.from.row}`,
          to: `${moveData.to.col}${moveData.to.row}`,
          promotion: moveData.promotion,
          isSwap: moveData.isSwap || false,
        },
      });

      // Atualizar jogo
      const updateData: any = {
        gameState: serialized,
        currentTurn: newState.currentTurn,
        moveNumber: newState.moveNumber,
        version: game.version + 1,
      };

      if (newState.status === 'finished') {
        updateData.status = 'finished';
        updateData.winnerId = playerId;
        updateData.finishedAt = new Date();
      }

      const updatedGame = await tx.game.update({
        where: { id: gameId },
        data: updateData,
        include: {
          whitePlayer: { select: { id: true, username: true } },
          blackPlayer: { select: { id: true, username: true } },
        },
      });

      // Se jogo terminou, atualizar ratings
      if (newState.status === 'finished') {
        await this.updateRatings(tx, game.whitePlayerId, game.blackPlayerId!, playerId);
      }

      return {
        success: true,
        game: updatedGame,
        gameState: newState,
        move,
      };
    });
  }

  /**
   * Atualiza ratings após partida (Elo simplificado)
   */
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

    const K = 32; // Fator K do Elo
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

