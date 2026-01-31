/**
 * Core types for PrinceFall game engine
 * Pure TypeScript, no dependencies
 */

export type Color = 'white' | 'black';

export type PieceType =
  | 'pawn'
  | 'rook'
  | 'knight'
  | 'bishop'
  | 'queen'
  | 'king'
  | 'prince'
  | 'general';

export interface Piece {
  type: PieceType;
  color: Color;
  hasMoved?: boolean; // Para peões (primeiro movimento) e outras regras
  canSwapWithPrince?: boolean; // Para regra de troca rei/príncipe (1x por jogo)
}

export type Column = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I';
export type Row = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface Position {
  col: Column;
  row: Row;
}

export interface Move {
  from: Position;
  to: Position;
  promotion?: PieceType; // Para promoção de peão (futuro)
  isSwap?: boolean; // Para troca rei/príncipe
}

export interface GameState {
  board: Map<string, Piece>; // Key: "A1", "B2", etc.
  currentTurn: Color;
  moveNumber: number;
  whiteGeneralPosition?: Position; // Posição escolhida no setup
  blackGeneralPosition?: Position;
  whiteKingSwapped: boolean; // Flag para troca rei/príncipe
  blackKingSwapped: boolean;
  status: 'setup' | 'playing' | 'finished';
  winner?: Color;
  endedAt?: number; // Timestamp
  lastMove?: Move;
}

export interface MoveIntent {
  from: Position;
  to: Position;
  promotion?: PieceType;
  isSwap?: boolean;
}

export interface GameAction {
  type: 'SETUP_GENERAL' | 'MOVE' | 'SWAP_KING_PRINCE';
  payload: {
    position?: Position; // Para SETUP_GENERAL
    move?: MoveIntent; // Para MOVE
    swapFrom?: Position; // Para SWAP_KING_PRINCE
    swapTo?: Position;
  };
  playerColor: Color;
}

/**
 * Serialized version of GameState (JSON-safe)
 */
export interface SerializedGameState {
  board: Record<string, { type: PieceType; color: Color; hasMoved?: boolean; canSwapWithPrince?: boolean }>;
  currentTurn: Color;
  moveNumber: number;
  whiteGeneralPosition?: Position;
  blackGeneralPosition?: Position;
  whiteKingSwapped: boolean;
  blackKingSwapped: boolean;
  status: 'setup' | 'playing' | 'finished';
  winner?: Color;
  endedAt?: number;
  lastMove?: Move;
}

