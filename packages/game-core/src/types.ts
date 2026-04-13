/**
 * Core types for PrinceFall game engine
 * Pure TypeScript, no dependencies
 */

export type Color = 'white' | 'black';

export type GameMode = 'imperial' | 'traditional';

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
  hasMoved?: boolean;
  canSwapWithPrince?: boolean;
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
  promotion?: PieceType;
  isSwap?: boolean;
}

export type GameLifecycleStatus = 'setup' | 'coinflip' | 'ready' | 'playing' | 'finished';

export type FinishedReason =
  | 'prince_capture'
  | 'king_capture'
  | 'timeout'
  | 'timeout_draw'
  | 'resign'
  | 'aborted';

export interface GameState {
  gameMode: GameMode;
  board: Map<string, Piece>;
  currentTurn: Color;
  moveNumber: number;
  whiteGeneralPosition?: Position;
  blackGeneralPosition?: Position;
  whiteKingSwapped: boolean;
  blackKingSwapped: boolean;
  status: GameLifecycleStatus;
  winner?: Color;
  endedAt?: number;
  lastMove?: Move;
  /** After coin flip: who moves first once play begins. */
  coinflipResolved?: boolean;
  finishedReason?: FinishedReason;
}

export interface MoveIntent {
  from: Position;
  to: Position;
  promotion?: PieceType;
  isSwap?: boolean;
}

export type GameAction =
  | {
      type: 'SETUP_GENERAL';
      payload: { position?: Position };
      playerColor: Color;
    }
  | {
      type: 'MOVE';
      payload: { move?: MoveIntent };
      playerColor: Color;
    }
  | {
      type: 'SWAP_KING_PRINCE';
      payload: { swapFrom?: Position; swapTo?: Position };
      playerColor: Color;
    }
  | {
      type: 'RESOLVE_COINFLIP';
      payload: { starter: Color };
    }
  | {
      type: 'BEGIN_PLAYING';
    }
  | {
      type: 'FORFEIT_ON_TIME';
      payload: { timedOutColor: Color };
    };

/**
 * Serialized version of GameState (JSON-safe)
 */
export interface SerializedGameState {
  gameMode?: GameMode;
  board: Record<string, { type: PieceType; color: Color; hasMoved?: boolean; canSwapWithPrince?: boolean }>;
  currentTurn: Color;
  moveNumber: number;
  whiteGeneralPosition?: Position;
  blackGeneralPosition?: Position;
  whiteKingSwapped: boolean;
  blackKingSwapped: boolean;
  status: GameLifecycleStatus;
  winner?: Color;
  endedAt?: number;
  lastMove?: Move;
  coinflipResolved?: boolean;
  finishedReason?: FinishedReason;
}
