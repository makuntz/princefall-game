import { GameState, SerializedGameState, Piece, GameMode, GameLifecycleStatus } from './types';
import { positionToString } from './utils/position';

export function serializeState(state: GameState): SerializedGameState {
  const board: SerializedGameState['board'] = {};

  state.board.forEach((piece, key) => {
    board[key] = {
      type: piece.type,
      color: piece.color,
      hasMoved: piece.hasMoved,
      canSwapWithPrince: piece.canSwapWithPrince,
    };
  });

  const base = {
    gameMode: state.gameMode,
    board,
    currentTurn: state.currentTurn,
    moveNumber: state.moveNumber,
    whiteGeneralPosition: state.whiteGeneralPosition,
    blackGeneralPosition: state.blackGeneralPosition,
    whiteKingSwapped: state.whiteKingSwapped,
    blackKingSwapped: state.blackKingSwapped,
    status: state.status,
    winner: state.winner,
    endedAt: state.endedAt,
    lastMove: state.lastMove,
    coinflipResolved: state.coinflipResolved,
    finishedReason: state.finishedReason,
  };

  if (state.gameMode === 'imperial') {
    return {
      ...base,
      whiteImperialCapturePoints: state.whiteImperialCapturePoints ?? 0,
      blackImperialCapturePoints: state.blackImperialCapturePoints ?? 0,
    };
  }

  return base;
}

export function deserializeState(serialized: SerializedGameState): GameState {
  const board = new Map<string, Piece>();

  Object.entries(serialized.board).forEach(([key, pieceData]) => {
    board.set(key, {
      type: pieceData.type,
      color: pieceData.color,
      hasMoved: pieceData.hasMoved,
      canSwapWithPrince: pieceData.canSwapWithPrince,
    });
  });

  const gameMode: GameMode = serialized.gameMode ?? 'imperial';
  const rawStatus = serialized.status;
  const status: GameLifecycleStatus =
    rawStatus === 'playing' ||
    rawStatus === 'finished' ||
    rawStatus === 'setup' ||
    rawStatus === 'coinflip' ||
    rawStatus === 'ready'
      ? rawStatus
      : 'setup';

  const captureWhite =
    gameMode === 'imperial' ? serialized.whiteImperialCapturePoints ?? 0 : undefined;
  const captureBlack =
    gameMode === 'imperial' ? serialized.blackImperialCapturePoints ?? 0 : undefined;

  return {
    gameMode,
    board,
    currentTurn: serialized.currentTurn,
    moveNumber: serialized.moveNumber,
    whiteGeneralPosition: serialized.whiteGeneralPosition,
    blackGeneralPosition: serialized.blackGeneralPosition,
    whiteKingSwapped: serialized.whiteKingSwapped,
    blackKingSwapped: serialized.blackKingSwapped,
    status,
    winner: serialized.winner,
    endedAt: serialized.endedAt,
    lastMove: serialized.lastMove,
    coinflipResolved: serialized.coinflipResolved,
    finishedReason: serialized.finishedReason,
    ...(gameMode === 'imperial'
      ? {
          whiteImperialCapturePoints: captureWhite,
          blackImperialCapturePoints: captureBlack,
        }
      : {}),
  };
}
