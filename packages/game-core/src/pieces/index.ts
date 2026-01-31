import { Piece, Position, Color, GameState } from '../types';
import { positionToString, addOffset, isValidPosition, getDistance } from '../utils/position';

export function getPieceAt(board: Map<string, Piece>, pos: Position): Piece | null {
  const key = positionToString(pos);
  return board.get(key) || null;
}

export function setPieceAt(board: Map<string, Piece>, pos: Position, piece: Piece | null): void {
  const key = positionToString(pos);
  if (piece === null) {
    board.delete(key);
  } else {
    board.set(key, piece);
  }
}

/**
 * Gera movimentos legais para uma peça
 */
export function getLegalMoves(
  state: GameState,
  from: Position
): Position[] {
  const piece = getPieceAt(state.board, from);
  if (!piece) {
    return [];
  }

  if (state.currentTurn !== piece.color) {
    return [];
  }

  switch (piece.type) {
    case 'pawn':
      return getPawnMoves(state, from, piece);
    case 'rook':
      return getRookMoves(state, from, piece);
    case 'knight':
      return getKnightMoves(state, from, piece);
    case 'bishop':
      return getBishopMoves(state, from, piece);
    case 'queen':
      return getQueenMoves(state, from, piece);
    case 'king':
      return getKingMoves(state, from, piece);
    case 'prince':
      return getPrinceMoves(state, from, piece);
    case 'general':
      return getGeneralMoves(state, from, piece);
    default:
      return [];
  }
}

function getPawnMoves(state: GameState, from: Position, piece: Piece): Position[] {
  const moves: Position[] = [];
  const direction = piece.color === 'white' ? -1 : 1; // White vai para linha menor, black para maior
  const startRow = piece.color === 'white' ? 7 : 3;

  // Movimento para frente (1 casa)
  const forward1 = addOffset(from, 0, direction);
  if (forward1 && !getPieceAt(state.board, forward1)) {
    moves.push(forward1);
  }

  // Movimento inicial (2 casas)
  if (from.row === startRow && forward1 && !getPieceAt(state.board, forward1)) {
    const forward2 = addOffset(forward1, 0, direction);
    if (forward2 && !getPieceAt(state.board, forward2)) {
      moves.push(forward2);
    }
  }

  // Captura diagonal
  for (const colOffset of [-1, 1]) {
    const capturePos = addOffset(from, colOffset, direction);
    if (capturePos) {
      const target = getPieceAt(state.board, capturePos);
      if (target && target.color !== piece.color) {
        moves.push(capturePos);
      }
    }
  }

  return moves;
}

function getRookMoves(state: GameState, from: Position, piece: Piece): Position[] {
  return getSlidingMoves(state, from, piece, [
    [0, 1], [0, -1], [1, 0], [-1, 0] // Vertical e horizontal
  ]);
}

function getBishopMoves(state: GameState, from: Position, piece: Piece): Position[] {
  return getSlidingMoves(state, from, piece, [
    [1, 1], [1, -1], [-1, 1], [-1, -1] // Diagonais
  ]);
}

function getQueenMoves(state: GameState, from: Position, piece: Piece): Position[] {
  return getSlidingMoves(state, from, piece, [
    [0, 1], [0, -1], [1, 0], [-1, 0], // Vertical e horizontal
    [1, 1], [1, -1], [-1, 1], [-1, -1] // Diagonais
  ]);
}

function getSlidingMoves(
  state: GameState,
  from: Position,
  piece: Piece,
  directions: number[][]
): Position[] {
  const moves: Position[] = [];

  for (const [colOffset, rowOffset] of directions) {
    let current = addOffset(from, colOffset, rowOffset);
    while (current) {
      const target = getPieceAt(state.board, current);
      if (!target) {
        moves.push(current);
      } else {
        if (target.color !== piece.color) {
          moves.push(current); // Captura
        }
        break; // Bloqueado
      }
      current = addOffset(current, colOffset, rowOffset);
    }
  }

  return moves;
}

function getKnightMoves(state: GameState, from: Position, piece: Piece): Position[] {
  const moves: Position[] = [];
  const offsets = [
    [2, 1], [2, -1], [-2, 1], [-2, -1],
    [1, 2], [1, -2], [-1, 2], [-1, -2]
  ];

  for (const [colOffset, rowOffset] of offsets) {
    const target = addOffset(from, colOffset, rowOffset);
    if (target) {
      const pieceAtTarget = getPieceAt(state.board, target);
      if (!pieceAtTarget || pieceAtTarget.color !== piece.color) {
        moves.push(target);
      }
    }
  }

  return moves;
}

function getKingMoves(state: GameState, from: Position, piece: Piece): Position[] {
  const moves: Position[] = [];
  
  // 2 casas nas direções cardinais
  const cardinalOffsets = [[0, 2], [0, -2], [2, 0], [-2, 0]];
  for (const [colOffset, rowOffset] of cardinalOffsets) {
    const target = addOffset(from, colOffset, rowOffset);
    if (target) {
      const pieceAtTarget = getPieceAt(state.board, target);
      if (!pieceAtTarget || pieceAtTarget.color !== piece.color) {
        moves.push(target);
      }
    }
  }

  // 1 casa nas diagonais
  const diagonalOffsets = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (const [colOffset, rowOffset] of diagonalOffsets) {
    const target = addOffset(from, colOffset, rowOffset);
    if (target) {
      const pieceAtTarget = getPieceAt(state.board, target);
      if (!pieceAtTarget || pieceAtTarget.color !== piece.color) {
        moves.push(target);
      }
    }
  }

  return moves;
}

function getPrinceMoves(state: GameState, from: Position, piece: Piece): Position[] {
  const moves: Position[] = [];
  // Move 1 casa em qualquer direção (8 direções)
  const offsets = [
    [0, 1], [0, -1], [1, 0], [-1, 0], // Cardinais
    [1, 1], [1, -1], [-1, 1], [-1, -1] // Diagonais
  ];

  for (const [colOffset, rowOffset] of offsets) {
    const target = addOffset(from, colOffset, rowOffset);
    if (target) {
      const pieceAtTarget = getPieceAt(state.board, target);
      if (!pieceAtTarget || pieceAtTarget.color !== piece.color) {
        moves.push(target);
      }
    }
  }

  return moves;
}

function getGeneralMoves(state: GameState, from: Position, piece: Piece): Position[] {
  const moves: Position[] = [];
  
  // 1 casa nas direções cardinais
  const cardinalOffsets = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  for (const [colOffset, rowOffset] of cardinalOffsets) {
    const target = addOffset(from, colOffset, rowOffset);
    if (target) {
      const pieceAtTarget = getPieceAt(state.board, target);
      if (!pieceAtTarget || pieceAtTarget.color !== piece.color) {
        moves.push(target);
      }
    }
  }

  // 2 casas nas diagonais (pulo de 2, sem verificar casa intermediária)
  const diagonalOffsets = [[2, 2], [2, -2], [-2, 2], [-2, -2]];
  for (const [colOffset, rowOffset] of diagonalOffsets) {
    const target = addOffset(from, colOffset, rowOffset);
    if (target) {
      const pieceAtTarget = getPieceAt(state.board, target);
      if (!pieceAtTarget || pieceAtTarget.color !== piece.color) {
        moves.push(target);
      }
    }
  }

  return moves;
}

