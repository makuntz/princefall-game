import { Color, GameState, PieceType } from './types';

/** Material values for Imperial mode (remaining pieces on board). */
export const IMPERIAL_PIECE_VALUES: Record<PieceType, number> = {
  pawn: 1,
  general: 2.5,
  knight: 3,
  rook: 5,
  bishop: 5,
  king: 7,
  queen: 9,
  prince: 50,
};

export function imperialMaterialScoreForColor(state: GameState, color: Color): number {
  let total = 0;
  for (const piece of state.board.values()) {
    if (piece.color === color) {
      total += IMPERIAL_PIECE_VALUES[piece.type] ?? 0;
    }
  }
  return total;
}

/**
 * When `timedOutColor` runs out of time, pick winner per reference HTML:
 * if the player who still had time also has >= material, they win;
 * else compare material; tie -> draw (null winner).
 */
export function resolveImperialTimeout(
  state: GameState,
  timedOutColor: Color
): { winner: Color | null; finishedReason: 'timeout' | 'timeout_draw' } {
  const beneficiary: Color = timedOutColor === 'white' ? 'black' : 'white';
  const whiteScore = imperialMaterialScoreForColor(state, 'white');
  const blackScore = imperialMaterialScoreForColor(state, 'black');

  if (beneficiary === 'white' && whiteScore >= blackScore) {
    return { winner: 'white', finishedReason: 'timeout' };
  }
  if (beneficiary === 'black' && blackScore >= whiteScore) {
    return { winner: 'black', finishedReason: 'timeout' };
  }
  if (whiteScore > blackScore) {
    return { winner: 'white', finishedReason: 'timeout' };
  }
  if (blackScore > whiteScore) {
    return { winner: 'black', finishedReason: 'timeout' };
  }
  return { winner: null, finishedReason: 'timeout_draw' };
}
