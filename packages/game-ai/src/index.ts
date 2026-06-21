/**
 * @princefall/game-ai
 * AI players for PrinceFall
 */

export type * from './types';
export type { AiDifficulty } from './types';
export type { ScoredMove } from './minimax';
export {
  AI_DIFFICULTY_CONFIG,
  AI_DIFFICULTY_LABELS,
  chooseBestComputerMove,
  evaluatePosition,
  getAllMovesForColor,
} from './minimax';
export {
  chooseComputerGeneralPosition,
  findPrince,
  formatMoveDescription,
  getCenterBonus,
  getPieceValue,
  isSquareAttackedBy,
} from './computerPlayer';
