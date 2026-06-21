/**
 * @princefall/game-ai
 * AI players for PrinceFall
 */

export type * from './types';
export {
  chooseBestComputerMove,
  chooseComputerGeneralPosition,
  evaluateMove,
  findPrince,
  formatMoveDescription,
  getAllMovesForColor,
  getPieceValue,
  isSquareAttackedBy,
} from './computerPlayer';
export type { ScoredMove } from './computerPlayer';
