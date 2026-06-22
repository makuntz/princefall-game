import {
  applyAction,
  Color,
  GameState,
  IMPERIAL_PIECE_VALUES,
  MoveIntent,
  Piece,
  PieceType,
  Position,
} from '@princefall/game-core';
import { getLegalMoves, getPieceAt } from '@princefall/game-core';
import { stringToPosition } from '@princefall/game-core';
import {
  findPrince,
  getCenterBonus,
  getPieceValue,
  isSquareAttackedBy,
} from './computerPlayer';
import type { AiDifficulty } from './types';

export interface ScoredMove extends MoveIntent {
  capturedPiece: Piece | null;
  score: number;
}

const WIN_SCORE = 100_000;

interface DifficultyConfig {
  depth: number;
  mistakeChance: number;
  mistakeDelta: number;
  maxThinkMs: number;
}

interface EvalProfile {
  /** Bonus when a piece attacks the enemy princess square. */
  princessAttackBonus: number;
  /** Penalty when the own princess is under attack. */
  princessDefensePenalty: number;
  /** How much to reward moving pieces closer to the enemy princess (0 = off). */
  distanceToPrincessFactor: number;
  materialWeight: number;
  imperialCaptureWeight: number;
  /** Penalty per point of hanging (undefended) material. */
  hangingPenalty: number;
  centerWeight: number;
  mobilityWeight: number;
}

export const AI_DIFFICULTY_CONFIG: Record<AiDifficulty, DifficultyConfig> = {
  easy: { depth: 2, mistakeChance: 0.45, mistakeDelta: 120, maxThinkMs: 350 },
  medium: { depth: 4, mistakeChance: 0, mistakeDelta: 0, maxThinkMs: 800 },
  hard: { depth: 5, mistakeChance: 0, mistakeDelta: 0, maxThinkMs: 1200 },
};

const EVAL_PROFILES: Record<AiDifficulty, EvalProfile> = {
  easy: {
    princessAttackBonus: 900,
    princessDefensePenalty: 6_000,
    distanceToPrincessFactor: 0.35,
    materialWeight: 14,
    imperialCaptureWeight: 7,
    hangingPenalty: 40,
    centerWeight: 1.5,
    mobilityWeight: 0.8,
  },
  medium: {
    princessAttackBonus: 3_200,
    princessDefensePenalty: 7_000,
    distanceToPrincessFactor: 1.0,
    materialWeight: 12,
    imperialCaptureWeight: 5,
    hangingPenalty: 48,
    centerWeight: 2.5,
    mobilityWeight: 1.2,
  },
  hard: {
    princessAttackBonus: 4_000,
    princessDefensePenalty: 10_000,
    distanceToPrincessFactor: 0.55,
    materialWeight: 13,
    imperialCaptureWeight: 6,
    hangingPenalty: 58,
    centerWeight: 4,
    mobilityWeight: 2.2,
  },
};

export const AI_DIFFICULTY_LABELS: Record<
  AiDifficulty,
  { title: string; description: string }
> = {
  easy: {
    title: 'Facil',
    description: 'Desenvolve pecas, protege material e evita erros grosseiros.',
  },
  medium: {
    title: 'Medio',
    description: 'Equilibra desenvolvimento, capturas e pressao na princesa.',
  },
  hard: {
    title: 'Dificil',
    description: 'Jogo tatico: defesa, troca Rei–Princesa e ataques calculados.',
  },
};

const TRADITIONAL_VALUES: Record<PieceType, number> = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  king: 4,
  rook: 5,
  general: 6,
  queen: 9,
  prince: 2.5,
};

function evalMaterialValue(piece: Piece, gameMode: GameState['gameMode']): number {
  if (gameMode === 'imperial') {
    return IMPERIAL_PIECE_VALUES[piece.type] ?? 0;
  }
  return TRADITIONAL_VALUES[piece.type] ?? 0;
}

function isSquareDefendedBy(state: GameState, square: Position, color: Color): boolean {
  return isSquareAttackedBy(state, square, color);
}

/** Material value of pieces that the opponent can capture for free on the next turn. */
function hangingMaterial(state: GameState, color: Color): number {
  const enemy: Color = color === 'white' ? 'black' : 'white';
  let total = 0;

  for (const [key, piece] of state.board) {
    if (piece.color !== color || piece.type === 'prince') {
      continue;
    }
    const pos = stringToPosition(key);
    if (
      isSquareAttackedBy(state, pos, enemy) &&
      !isSquareDefendedBy(state, pos, color)
    ) {
      total += evalMaterialValue(piece, state.gameMode);
    }
  }

  return total;
}

function mobilityScore(state: GameState, color: Color): number {
  if (state.status !== 'playing' || state.currentTurn !== color) {
    return 0;
  }

  let count = 0;
  for (const key of state.board.keys()) {
    const pos = stringToPosition(key);
    const piece = getPieceAt(state.board, pos);
    if (!piece || piece.color !== color) {
      continue;
    }
    count += getLegalMoves(state, pos).length;
  }
  return count;
}

function centerControlScore(state: GameState, color: Color): number {
  let score = 0;
  for (const [key, piece] of state.board) {
    if (piece.color !== color) {
      continue;
    }
    score += getCenterBonus(stringToPosition(key));
  }
  return score;
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

function getKingPrinceSwapMove(state: GameState, color: Color): ScoredMove | null {
  if (state.gameMode !== 'imperial' || state.status !== 'playing' || state.currentTurn !== color) {
    return null;
  }

  const alreadySwapped = color === 'white' ? state.whiteKingSwapped : state.blackKingSwapped;
  if (alreadySwapped) {
    return null;
  }

  let kingPos: Position | null = null;
  let princePos: Position | null = null;

  for (const [key, piece] of state.board) {
    if (piece.color !== color) continue;
    if (piece.type === 'king') kingPos = stringToPosition(key);
    if (piece.type === 'prince') princePos = stringToPosition(key);
  }

  if (!kingPos || !princePos) {
    return null;
  }

  return {
    from: kingPos,
    to: princePos,
    isSwap: true,
    capturedPiece: null,
    score: 0,
  };
}

function getAllActions(state: GameState, color: Color, difficulty: AiDifficulty): ScoredMove[] {
  const moves = getAllMovesForColor(state, color);
  if (difficulty === 'hard') {
    const swap = getKingPrinceSwapMove(state, color);
    if (swap) {
      moves.push(swap);
    }
  }
  return orderMoves(moves);
}

function applyComputerAction(state: GameState, move: ScoredMove): GameState {
  if (move.isSwap) {
    return applyAction(state, {
      type: 'SWAP_KING_PRINCE',
      payload: { swapFrom: move.from, swapTo: move.to },
      playerColor: state.currentTurn,
    });
  }

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
export function evaluatePosition(
  state: GameState,
  computerColor: Color,
  difficulty: AiDifficulty = 'medium'
): number {
  const humanColor: Color = computerColor === 'white' ? 'black' : 'white';
  const profile = EVAL_PROFILES[difficulty];

  if (state.status === 'finished') {
    if (state.winner === computerColor) return WIN_SCORE;
    if (state.winner === humanColor) return -WIN_SCORE;
    return 0;
  }

  const enemyPrincess = findPrince(state, humanColor);
  const ownPrincess = findPrince(state, computerColor);

  if (!enemyPrincess) return WIN_SCORE - state.moveNumber;
  if (!ownPrincess) return -WIN_SCORE + state.moveNumber;

  let score = 0;

  for (const piece of state.board.values()) {
    const value = evalMaterialValue(piece, state.gameMode) * profile.materialWeight;
    score += piece.color === computerColor ? value : -value;
  }

  if (state.gameMode === 'imperial') {
    score +=
      (state.whiteImperialCapturePoints ?? 0) *
      (computerColor === 'white' ? profile.imperialCaptureWeight : -profile.imperialCaptureWeight);
    score +=
      (state.blackImperialCapturePoints ?? 0) *
      (computerColor === 'black' ? profile.imperialCaptureWeight : -profile.imperialCaptureWeight);
  }

  if (isSquareAttackedBy(state, enemyPrincess, computerColor)) {
    score += profile.princessAttackBonus;
  }

  if (isSquareAttackedBy(state, ownPrincess, humanColor)) {
    score -= profile.princessDefensePenalty;
  }

  if (profile.distanceToPrincessFactor > 0) {
    let minDist = 99;
    for (const [key, piece] of state.board) {
      if (piece.color !== computerColor || piece.type === 'prince') continue;
      const pos = stringToPosition(key);
      const dist =
        Math.abs(pos.col.charCodeAt(0) - enemyPrincess.col.charCodeAt(0)) +
        Math.abs(pos.row - enemyPrincess.row);
      minDist = Math.min(minDist, dist);
    }
    score += (14 - minDist) * profile.distanceToPrincessFactor;
  }

  const ownHanging = hangingMaterial(state, computerColor);
  const enemyHanging = hangingMaterial(state, humanColor);
  score -= ownHanging * profile.hangingPenalty;
  score += enemyHanging * profile.hangingPenalty * 0.85;

  score += centerControlScore(state, computerColor) * profile.centerWeight;
  score -= centerControlScore(state, humanColor) * profile.centerWeight * 0.7;

  score += mobilityScore(state, computerColor) * profile.mobilityWeight;
  score -= mobilityScore(state, humanColor) * profile.mobilityWeight * 0.75;

  return score;
}

function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  computerColor: Color,
  difficulty: AiDifficulty,
  deadline?: number
): number {
  if (deadline && Date.now() >= deadline) {
    return evaluatePosition(state, computerColor, difficulty);
  }

  if (depth === 0 || state.status === 'finished') {
    return evaluatePosition(state, computerColor, difficulty);
  }

  const side = state.currentTurn;
  const moves = orderMoves(getAllActions(state, side, difficulty));
  if (moves.length === 0) {
    return evaluatePosition(state, computerColor, difficulty);
  }

  const maximizing = side === computerColor;

  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      if (deadline && Date.now() >= deadline) {
        break;
      }
      const next = applyComputerAction(state, move);
      const evalScore = minimax(next, depth - 1, alpha, beta, computerColor, difficulty, deadline);
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  }

  let minEval = Infinity;
  for (const move of moves) {
    if (deadline && Date.now() >= deadline) {
      break;
    }
    const next = applyComputerAction(state, move);
    const evalScore = minimax(next, depth - 1, alpha, beta, computerColor, difficulty, deadline);
    minEval = Math.min(minEval, evalScore);
    beta = Math.min(beta, evalScore);
    if (beta <= alpha) break;
  }
  return minEval;
}

function safetyScore(state: GameState, move: ScoredMove, computerColor: Color): number {
  const next = applyComputerAction(state, move);
  return -hangingMaterial(next, computerColor);
}

function pickMoveWithMistake(
  scored: Array<{ move: ScoredMove; score: number }>,
  config: DifficultyConfig,
  state: GameState,
  computerColor: Color,
  difficulty: AiDifficulty
): ScoredMove {
  scored.sort((a, b) => b.score - a.score);
  const bestScore = scored[0].score;

  if (config.mistakeChance > 0 && Math.random() < config.mistakeChance) {
    let candidates = scored.filter(m => m.score >= bestScore - config.mistakeDelta);
    if (difficulty === 'easy') {
      candidates = [...candidates].sort(
        (a, b) => safetyScore(state, b.move, computerColor) - safetyScore(state, a.move, computerColor)
      );
      const saferCount = Math.max(1, Math.ceil(candidates.length * 0.65));
      candidates = candidates.slice(0, saferCount);
    }
    return candidates[Math.floor(Math.random() * candidates.length)].move;
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
  const moves = getAllActions(state, computerColor, difficulty);

  if (moves.length === 0) {
    return null;
  }

  for (const move of moves) {
    const next = applyComputerAction(state, move);
    if (next.status === 'finished' && next.winner === computerColor) {
      return { from: move.from, to: move.to, isSwap: move.isSwap };
    }
  }

  const deadline = Date.now() + config.maxThinkMs;
  let bestScored: Array<{ move: ScoredMove; score: number }> = [];
  const startDepth = difficulty === 'easy' ? config.depth : 1;

  for (let depth = startDepth; depth <= config.depth; depth++) {
    if (Date.now() >= deadline) {
      break;
    }

    const scored: Array<{ move: ScoredMove; score: number }> = [];
    let completed = true;

    for (const move of moves) {
      if (Date.now() >= deadline) {
        completed = false;
        break;
      }

      const next = applyComputerAction(state, move);
      const score = minimax(
        next,
        depth - 1,
        -Infinity,
        Infinity,
        computerColor,
        difficulty,
        deadline
      );
      scored.push({ move, score });
    }

    if (completed && scored.length === moves.length) {
      bestScored = scored;
    }
  }

  if (bestScored.length === 0) {
    bestScored = moves.map(move => ({
      move,
      score: move.capturedPiece ? evalMaterialValue(move.capturedPiece, state.gameMode) : 0,
    }));
  }

  const chosen = pickMoveWithMistake(bestScored, config, state, computerColor, difficulty);

  return {
    from: chosen.from,
    to: chosen.to,
    promotion: chosen.promotion,
    isSwap: chosen.isSwap,
  };
}
