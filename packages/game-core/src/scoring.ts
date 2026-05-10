import { Color, FinishedReason, GameMode, GameState, Piece, PieceType } from './types';

/** Material values for Imperial mode (remaining pieces on board / captures). */
export const IMPERIAL_PIECE_VALUES: Record<PieceType, number> = {
  pawn: 1,
  general: 2.5,
  knight: 3,
  rook: 5,
  bishop: 5,
  king: 7,
  queen: 9,
  prince: 2.5,
};

/** Bonus score for a decisive imperial win (captura da princesa). */
export const IMPERIAL_DECISIVE_WIN_POINTS = 60;

/** Extra points for the winner when the game ends on time (além das capturas). */
export const IMPERIAL_TIMEOUT_WIN_BONUS = 10;

export function imperialMaterialScoreForColor(state: GameState, color: Color): number {
  let total = 0;
  for (const piece of state.board.values()) {
    if (piece.color === color) {
      total += IMPERIAL_PIECE_VALUES[piece.type] ?? 0;
    }
  }
  return total;
}

/** Value of a captured piece for imperial scoring (uses current piece type, e.g. dama promovida). */
export function imperialCaptureValueForPiece(piece: Piece): number {
  return IMPERIAL_PIECE_VALUES[piece.type] ?? 0;
}

/** Running capture total during play (starts at 0). */
export function imperialCapturePointsForColor(state: GameState, color: Color): number {
  if (state.gameMode !== 'imperial') return 0;
  return color === 'white'
    ? state.whiteImperialCapturePoints ?? 0
    : state.blackImperialCapturePoints ?? 0;
}

/**
 * Final imperial tournament totals after the game ends.
 * Decisive win: winner 60, loser keeps capture points only.
 * Win on time (ou equivalente): winner capturas + 10, loser capturas.
 * Empate no tempo: só capturas de cada lado.
 */
export function imperialTournamentTotals(
  gameMode: GameMode,
  finishedReason: FinishedReason | undefined,
  winner: Color | null | undefined,
  whiteCaptures: number,
  blackCaptures: number
): { white: number; black: number } {
  if (gameMode !== 'imperial') {
    return { white: 0, black: 0 };
  }

  if (!winner || finishedReason === 'timeout_draw') {
    return { white: whiteCaptures, black: blackCaptures };
  }

  if (finishedReason === 'prince_capture') {
    return {
      white: winner === 'white' ? IMPERIAL_DECISIVE_WIN_POINTS : whiteCaptures,
      black: winner === 'black' ? IMPERIAL_DECISIVE_WIN_POINTS : blackCaptures,
    };
  }

  if (
    finishedReason === 'timeout' ||
    finishedReason === 'resign' ||
    finishedReason === 'aborted'
  ) {
    return {
      white:
        winner === 'white'
          ? whiteCaptures + IMPERIAL_TIMEOUT_WIN_BONUS
          : whiteCaptures,
      black:
        winner === 'black'
          ? blackCaptures + IMPERIAL_TIMEOUT_WIN_BONUS
          : blackCaptures,
    };
  }

  return { white: whiteCaptures, black: blackCaptures };
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
