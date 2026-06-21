import {
  applyAction,
  Color,
  GameState,
  MoveIntent,
  Piece,
} from '@princefall/game-core';
import { getLegalMoves, getPieceAt } from '@princefall/game-core';
import { stringToPosition } from '@princefall/game-core';
import { findPrince, getPieceValue, isSquareAttackedBy } from './computerPlayer';
import type { AiDifficulty } from './types';

export interface ScoredMove extends MoveIntent {
  capturedPiece: Piece | null;
  score: number;
}

const WIN_SCORE = 100_000;
const MATE_THREAT = 8_000;

interface DifficultyConfig {
  depth: number;
  /** 0–1 chance to pick a suboptimal move (easy only). */
  mistakeChance: number;
  /** Max score gap from best move when making a mistake. */
  mistakeDelta: number;
}

export const AI_DIFFICULTY_CONFIG: Record<AiDifficulty, DifficultyConfig> = {
  easy: { depth: 2, mistakeChance: 0.4, mistakeDelta: 150 },
  medium: { depth: 4, mistakeChance: 0, mistakeDelta: 0 },
  hard: { depth: 5, mistakeChance: 0, mistakeDelta: 0 },
};

export const AI_DIFFICULTY_LABELS: Record<
  AiDifficulty,
  { title: string; description: string }
> = {
  easy: {
    title: 'Facil',
    description: 'Joga rapido e pode errar combinacoes. Ideal para aprender.',
  },
  medium: {
    title: 'Medio',
    description: 'Planeja 2–3 lances, captura material e pressiona a princesa.',
  },
  hard: {
    title: 'Dificil',
    description: 'Busca mate e sequencias longas. Muito agressiva e precisa.',
  },
};

export function getAllMovesForColor(state: GameState, color: Color): ScoredMove[] {
  if (state.status !== 'playing' || state.currentTurn !== color) {
    return [];
  }

  const moves: ScoredMove[] = [];

  for (const key of state.board.keys()) {
    const pos = stringToPosition(key);
    const piece = getPieceAt(state.board, pos);
    if (!piece || piece.color !== color) continue;

    for (const to of getLegalMoves(state, pos)) {
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

function applyMove(state: GameState, move: MoveIntent): GameState {
  return applyAction(state, {
    type: 'MOVE',
    payload: { move },
    playerColor: state.currentTurn,
  });
}

function orderMoves(moves: ScoredMove[]): ScoredMove[] {
  return [...moves].sort((a, b) => {
    const capA = a.capturedPiece ? getPieceValue(a.capturedPiece) : 0;
    const capB = b.capturedPiece ? getPieceValue(b.capturedPiece) : 0;
    if (capB !== capA) return capB - capA;
    return 0;
  });
}

/** Static evaluation from the computer's perspective (higher = better for AI). */
export function evaluatePosition(state: GameState, computerColor: Color): number {
  const humanColor: Color = computerColor === 'white' ? 'black' : 'white';

  if (state.status === 'finished') {
    if (state.winner === computerColor) return WIN_SCORE;
    if (state.winner === humanColor) return -WIN_SCORE;
    return 0;
  }

  const enemyPrince = findPrince(state, humanColor);
  const ownPrince = findPrince(state, computerColor);

  if (!enemyPrince) return WIN_SCORE - state.moveNumber;
  if (!ownPrince) return -WIN_SCORE + state.moveNumber;

  let score = 0;

  for (const piece of state.board.values()) {
    const value = getPieceValue(piece) * 10;
    score += piece.color === computerColor ? value : -value;
  }

  if (state.gameMode === 'imperial') {
    score +=
      (state.whiteImperialCapturePoints ?? 0) * (computerColor === 'white' ? 5 : -5);
    score +=
      (state.blackImperialCapturePoints ?? 0) * (computerColor === 'black' ? 5 : -5);
  }

  if (isSquareAttackedBy(state, enemyPrince, computerColor)) {
    score += MATE_THREAT;
    if (state.currentTurn === computerColor) {
      score += 500;
    }
  }

  if (isSquareAttackedBy(state, ownPrince, humanColor)) {
    score -= MATE_THREAT * 0.8;
  }

  let minDistToEnemyPrince = 99;
  for (const [key, piece] of state.board) {
    if (piece.color !== computerColor || piece.type === 'prince') continue;
    const pos = stringToPosition(key);
    const dist =
      Math.abs(pos.col.charCodeAt(0) - enemyPrince.col.charCodeAt(0)) +
      Math.abs(pos.row - enemyPrince.row);
    minDistToEnemyPrince = Math.min(minDistToEnemyPrince, dist);
  }
  score += (14 - minDistToEnemyPrince) * 3;

  return score;
}

function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  computerColor: Color
): number {
  if (depth === 0 || state.status === 'finished') {
    return evaluatePosition(state, computerColor);
  }

  const moves = orderMoves(getAllMovesForColor(state, state.currentTurn));
  if (moves.length === 0) {
    return evaluatePosition(state, computerColor);
  }

  const maximizing = state.currentTurn === computerColor;

  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const next = applyMove(state, move);
      const evalScore = minimax(next, depth - 1, alpha, beta, computerColor);
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  }

  let minEval = Infinity;
  for (const move of moves) {
    const next = applyMove(state, move);
    const evalScore = minimax(next, depth - 1, alpha, beta, computerColor);
    minEval = Math.min(minEval, evalScore);
    beta = Math.min(beta, evalScore);
    if (beta <= alpha) break;
  }
  return minEval;
}

function pickMoveWithMistake(
  scored: Array<{ move: ScoredMove; score: number }>,
  config: DifficultyConfig
): ScoredMove {
  scored.sort((a, b) => b.score - a.score);
  const bestScore = scored[0].score;

  if (config.mistakeChance > 0 && Math.random() < config.mistakeChance) {
    const candidates = scored.filter(m => m.score >= bestScore - config.mistakeDelta);
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    return pick.move;
  }

  const top = scored.filter(m => m.score === bestScore);
  return top[Math.floor(Math.random() * top.length)].move;
}

export function chooseBestComputerMove(
  state: GameState,
  computerColor: Color,
  _humanColor: Color,
  difficulty: AiDifficulty = 'medium'
): MoveIntent | null {
  const config = AI_DIFFICULTY_CONFIG[difficulty];
  const moves = orderMoves(getAllMovesForColor(state, computerColor));

  if (moves.length === 0) {
    return null;
  }

  const scored: Array<{ move: ScoredMove; score: number }> = [];

  for (const move of moves) {
    const next = applyMove(state, move);

    if (next.status === 'finished' && next.winner === computerColor) {
      return { from: move.from, to: move.to };
    }

    const score = minimax(next, config.depth - 1, -Infinity, Infinity, computerColor);
    scored.push({ move, score });
  }

  const chosen = pickMoveWithMistake(scored, config);

  return {
    from: chosen.from,
    to: chosen.to,
    promotion: chosen.promotion,
    isSwap: chosen.isSwap,
  };
}
