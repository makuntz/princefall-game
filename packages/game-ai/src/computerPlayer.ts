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
import { getLegalMoves, getPieceAt, setPieceAt } from '@princefall/game-core';
import { getColumnIndex, positionToString, stringToPosition } from '@princefall/game-core';

export interface ScoredMove extends MoveIntent {
  capturedPiece: Piece | null;
  score: number;
}

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

function cloneGameState(state: GameState): GameState {
  return {
    ...state,
    board: new Map(state.board),
  };
}

export function findPrince(state: GameState, color: Color): Position | null {
  for (const [key, piece] of state.board) {
    if (piece.color === color && piece.type === 'prince') {
      return stringToPosition(key);
    }
  }
  return null;
}

function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(getColumnIndex(a.col) - getColumnIndex(b.col)) + Math.abs(a.row - b.row);
}

function getCenterBonus(pos: Position): number {
  const col = getColumnIndex(pos.col);
  const row = pos.row - 1;
  const centerCol = 4;
  const centerRow = 4;
  const distanceFromCenter = Math.abs(col - centerCol) + Math.abs(row - centerRow);
  return Math.max(0, 8 - distanceFromCenter);
}

export function isSquareAttackedBy(
  state: GameState,
  square: Position,
  attackingColor: Color
): boolean {
  const tempState: GameState = {
    ...cloneGameState(state),
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

function simulateMove<T>(
  state: GameState,
  move: ScoredMove,
  callback: (simState: GameState) => T
): T {
  const sim = cloneGameState(state);
  const fromPiece = getPieceAt(sim.board, move.from);
  if (!fromPiece) {
    return callback(sim);
  }

  setPieceAt(sim.board, move.from, null);
  setPieceAt(sim.board, move.to, { ...fromPiece, hasMoved: true });
  sim.currentTurn = sim.currentTurn === 'white' ? 'black' : 'white';

  return callback(sim);
}

export function getAllMovesForColor(state: GameState, color: Color): ScoredMove[] {
  if (state.status !== 'playing' || state.currentTurn !== color) {
    return [];
  }

  const moves: ScoredMove[] = [];

  for (const key of state.board.keys()) {
    const pos = stringToPosition(key);
    const piece = getPieceAt(state.board, pos);
    if (!piece || piece.color !== color) continue;

    const validMoves = getLegalMoves(state, pos);
    for (const to of validMoves) {
      moves.push({
        from: pos,
        to,
        capturedPiece: getPieceAt(state.board, to),
        score: 0,
      });
    }
  }

  return moves;
}

export function evaluateMove(
  state: GameState,
  move: ScoredMove,
  computerColor: Color,
  humanColor: Color
): number {
  let score = 0;
  const movingPiece = getPieceAt(state.board, move.from);

  if (move.capturedPiece) {
    score += getPieceValue(move.capturedPiece) * 10;
    if (move.capturedPiece.type === 'prince') {
      score += 10000;
    }
  }

  if (movingPiece) {
    score -= getPieceValue(movingPiece) * 0.2;
  }

  const enemyPrincePos = findPrince(state, humanColor);
  if (enemyPrincePos) {
    const beforeDistance = manhattanDistance(move.from, enemyPrincePos);
    const afterDistance = manhattanDistance(move.to, enemyPrincePos);

    if (afterDistance < beforeDistance) {
      score += (beforeDistance - afterDistance) * 2;
    } else if (afterDistance > beforeDistance) {
      score -= afterDistance - beforeDistance;
    }
  }

  simulateMove(state, move, simState => {
    const ownPrincePos = findPrince(simState, computerColor);
    if (ownPrincePos && isSquareAttackedBy(simState, ownPrincePos, humanColor)) {
      score -= 500;
    }

    if (isSquareAttackedBy(simState, move.to, humanColor)) {
      const captureValue = move.capturedPiece ? getPieceValue(move.capturedPiece) * 10 : 0;
      const riskPenalty = getPieceValue(movingPiece) * 4;
      if (captureValue < riskPenalty) {
        score -= riskPenalty;
      }
    }
  });

  score += getCenterBonus(move.to) * 0.5;
  score += Math.random() * 0.5;

  return score;
}

export function chooseBestComputerMove(
  state: GameState,
  computerColor: Color,
  humanColor: Color
): MoveIntent | null {
  const moves = getAllMovesForColor(state, computerColor);
  if (moves.length === 0) {
    return null;
  }

  for (const move of moves) {
    move.score = evaluateMove(state, move, computerColor, humanColor);
  }

  const bestScore = Math.max(...moves.map(move => move.score));
  const bestMoves = moves.filter(move => move.score === bestScore);
  const chosen = bestMoves[Math.floor(Math.random() * bestMoves.length)];

  return {
    from: chosen.from,
    to: chosen.to,
    promotion: chosen.promotion,
    isSwap: chosen.isSwap,
  };
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
