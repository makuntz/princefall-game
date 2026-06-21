import {
  Color,
  Column,
  GameState,
  MoveIntent,
  Piece,
  PieceType,
  Position,
  Row,
} from '@princefall/game-core';
import { getLegalMoves, getPieceAt } from '@princefall/game-core';
import { getColumnIndex, positionToString, stringToPosition } from '@princefall/game-core';

const PIECE_VALUES: Record<PieceType, number> = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  king: 4,
  rook: 5,
  general: 6,
  queen: 9,
  prince: 1000,
};

const GENERAL_COLUMNS: Column[] = ['E', 'D', 'F', 'C', 'G', 'B', 'H', 'A', 'I'];

export function getPieceValue(piece: Piece | null): number {
  if (!piece) return 0;
  return PIECE_VALUES[piece.type] ?? 0;
}

export function findPrince(state: GameState, color: Color): Position | null {
  for (const [key, piece] of state.board) {
    if (piece.color === color && piece.type === 'prince') {
      return stringToPosition(key);
    }
  }
  return null;
}

export function isSquareAttackedBy(
  state: GameState,
  square: Position,
  attackingColor: Color
): boolean {
  const tempState: GameState = {
    ...state,
    board: new Map(state.board),
    currentTurn: attackingColor,
  };

  for (const key of tempState.board.keys()) {
    const pos = stringToPosition(key);
    const piece = getPieceAt(tempState.board, pos);
    if (!piece || piece.color !== attackingColor) continue;

    const moves = getLegalMoves(tempState, pos);
    if (moves.some(m => m.col === square.col && m.row === square.row)) {
      return true;
    }
  }

  return false;
}

export function chooseComputerGeneralPosition(color: Color): Position {
  const row = (color === 'white' ? 7 : 3) as Row;

  const scoredPositions = GENERAL_COLUMNS.map((col, index) => ({
    pos: { col, row } as Position,
    score: 100 - index * 5 + Math.random() * 10,
  }));

  scoredPositions.sort((a, b) => b.score - a.score);
  return scoredPositions[0].pos;
}

export function formatMoveDescription(move: MoveIntent): string {
  return `${positionToString(move.from)} → ${positionToString(move.to)}`;
}

export function getCenterBonus(pos: Position): number {
  const col = getColumnIndex(pos.col);
  const row = pos.row - 1;
  const centerCol = 4;
  const centerRow = 4;
  const distanceFromCenter = Math.abs(col - centerCol) + Math.abs(row - centerRow);
  return Math.max(0, 8 - distanceFromCenter);
}
