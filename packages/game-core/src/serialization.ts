import { GameState, SerializedGameState, Piece } from './types';
import { positionToString, stringToPosition } from './utils/position';

/**
 * Serializa GameState para JSON
 */
export function serializeState(state: GameState): SerializedGameState {
  const board: Record<string, { type: Piece['type']; color: Piece['color']; hasMoved?: boolean; canSwapWithPrince?: boolean }> = {};
  
  state.board.forEach((piece, key) => {
    board[key] = {
      type: piece.type,
      color: piece.color,
      hasMoved: piece.hasMoved,
      canSwapWithPrince: piece.canSwapWithPrince,
    };
  });

  return {
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
  };
}

/**
 * Deserializa JSON para GameState
 */
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

  return {
    board,
    currentTurn: serialized.currentTurn,
    moveNumber: serialized.moveNumber,
    whiteGeneralPosition: serialized.whiteGeneralPosition,
    blackGeneralPosition: serialized.blackGeneralPosition,
    whiteKingSwapped: serialized.whiteKingSwapped,
    blackKingSwapped: serialized.blackKingSwapped,
    status: serialized.status,
    winner: serialized.winner,
    endedAt: serialized.endedAt,
    lastMove: serialized.lastMove,
  };
}

