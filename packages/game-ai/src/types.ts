import { GameState, MoveIntent, Color } from '@princefall/game-core';

export type AiDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Interface para bot players (V2)
 */
export interface BotPlayer {
  chooseMove(state: GameState, playerColor: Color): MoveIntent | null;
  level: AiDifficulty;
  name: string;
}

/**
 * Interface para escolha de posição do general no setup
 */
export interface BotSetupStrategy {
  chooseGeneralPosition(state: GameState, playerColor: Color): { col: string; row: number } | null;
}
