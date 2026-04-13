import { Piece, Position, Color, GameState } from '../types';
import { positionToString, addOffsetInMode, isPositionOnBoard } from '../utils/position';

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

export function getLegalMoves(state: GameState, from: Position): Position[] {
  if (state.status !== 'playing') {
    return [];
  }

  const piece = getPieceAt(state.board, from);
  if (!piece) {
    return [];
  }

  if (state.currentTurn !== piece.color) {
    return [];
  }

  if (!isPositionOnBoard(state.gameMode, from)) {
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
  const mode = state.gameMode;
  const moves: Position[] = [];

  if (mode === 'traditional') {
    const direction = piece.color === 'white' ? 1 : -1;
    const startRow = piece.color === 'white' ? 2 : 7;

    const forward1 = addOffsetInMode(mode, from, 0, direction);
    if (forward1 && !getPieceAt(state.board, forward1)) {
      moves.push(forward1);
      if (from.row === startRow) {
        const forward2 = addOffsetInMode(mode, forward1, 0, direction);
        if (forward2 && !getPieceAt(state.board, forward2)) {
          moves.push(forward2);
        }
      }
    }

    for (const colOffset of [-1, 1]) {
      const capturePos = addOffsetInMode(mode, from, colOffset, direction);
      if (capturePos) {
        const target = getPieceAt(state.board, capturePos);
        if (target && target.color !== piece.color) {
          moves.push(capturePos);
        }
      }
    }
    return moves;
  }

  // Imperial
  const direction = piece.color === 'white' ? -1 : 1;
  const startRow = piece.color === 'white' ? 7 : 3;

  const forward1 = addOffsetInMode(mode, from, 0, direction);
  if (forward1 && !getPieceAt(state.board, forward1)) {
    moves.push(forward1);
  }

  if (from.row === startRow && forward1 && !getPieceAt(state.board, forward1)) {
    const forward2 = addOffsetInMode(mode, from, 0, direction * 2);
    if (forward2 && !getPieceAt(state.board, forward2)) {
      moves.push(forward2);
    }
  }

  for (const colOffset of [-1, 1]) {
    const capturePos = addOffsetInMode(mode, from, colOffset, direction);
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
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ]);
}

function getBishopMoves(state: GameState, from: Position, piece: Piece): Position[] {
  return getSlidingMoves(state, from, piece, [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]);
}

function getQueenMoves(state: GameState, from: Position, piece: Piece): Position[] {
  return getSlidingMoves(state, from, piece, [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]);
}

function getSlidingMoves(
  state: GameState,
  from: Position,
  piece: Piece,
  directions: number[][]
): Position[] {
  const mode = state.gameMode;
  const moves: Position[] = [];

  for (const [colOffset, rowOffset] of directions) {
    let current = addOffsetInMode(mode, from, colOffset, rowOffset);
    while (current) {
      const target = getPieceAt(state.board, current);
      if (!target) {
        moves.push(current);
      } else {
        if (target.color !== piece.color) {
          moves.push(current);
        }
        break;
      }
      current = addOffsetInMode(mode, current, colOffset, rowOffset);
    }
  }

  return moves;
}

function getKnightMoves(state: GameState, from: Position, piece: Piece): Position[] {
  const mode = state.gameMode;
  const moves: Position[] = [];
  const offsets = [
    [2, 1],
    [2, -1],
    [-2, 1],
    [-2, -1],
    [1, 2],
    [1, -2],
    [-1, 2],
    [-1, -2],
  ];

  for (const [colOffset, rowOffset] of offsets) {
    const target = addOffsetInMode(mode, from, colOffset, rowOffset);
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
  const mode = state.gameMode;
  if (mode === 'traditional') {
    const moves: Position[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const target = addOffsetInMode(mode, from, dc, dr);
        if (!target) continue;
        const pieceAtTarget = getPieceAt(state.board, target);
        if (!pieceAtTarget || pieceAtTarget.color !== piece.color) {
          moves.push(target);
        }
      }
    }
    return moves;
  }

  // Imperial — Rei Guerreiro
  const moves: Position[] = [];
  const cardinals: [number, number][] = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];

  for (const [dc, dr] of cardinals) {
    const one = addOffsetInMode(mode, from, dc, dr);
    if (!one) continue;
    const firstOccupant = getPieceAt(state.board, one);
    if (!firstOccupant || firstOccupant.color !== piece.color) {
      moves.push(one);
    }
    if (!firstOccupant) {
      const two = addOffsetInMode(mode, from, dc * 2, dr * 2);
      if (two) {
        const secondOccupant = getPieceAt(state.board, two);
        if (!secondOccupant || secondOccupant.color !== piece.color) {
          moves.push(two);
        }
      }
    }
  }

  const diagonals: [number, number][] = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  for (const [dc, dr] of diagonals) {
    const target = addOffsetInMode(mode, from, dc, dr);
    if (!target) continue;
    const pieceAtTarget = getPieceAt(state.board, target);
    if (!pieceAtTarget || pieceAtTarget.color !== piece.color) {
      moves.push(target);
    }
  }

  return moves;
}

function getPrinceMoves(state: GameState, from: Position, piece: Piece): Position[] {
  if (state.gameMode !== 'imperial') {
    return [];
  }
  const mode = state.gameMode;
  const moves: Position[] = [];
  const offsets: [number, number][] = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];

  for (const [colOffset, rowOffset] of offsets) {
    const target = addOffsetInMode(mode, from, colOffset, rowOffset);
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
  if (state.gameMode !== 'imperial') {
    return [];
  }
  const mode = state.gameMode;
  const forward = piece.color === 'white' ? -1 : 1;
  const moves: Position[] = [];

  const oneAhead = addOffsetInMode(mode, from, 0, forward);
  if (oneAhead) {
    const blocker = getPieceAt(state.board, oneAhead);
    if (!blocker || blocker.color !== piece.color) {
      moves.push(oneAhead);
    }
    if (!blocker) {
      const twoAhead = addOffsetInMode(mode, from, 0, forward * 2);
      if (twoAhead) {
        const t2 = getPieceAt(state.board, twoAhead);
        if (!t2 || t2.color !== piece.color) {
          moves.push(twoAhead);
        }
      }
    }
  }

  for (const dc of [-1, 1]) {
    const diag = addOffsetInMode(mode, from, dc, forward);
    if (!diag) continue;
    const t = getPieceAt(state.board, diag);
    if (!t || t.color !== piece.color) {
      moves.push(diag);
    }
  }

  return moves;
}
