import { GameState, MoveIntent, Color } from '@princefall/game-core';

/**
 * Interface para bot players (V2)
 */
export interface BotPlayer {
  /**
   * Escolhe um movimento baseado no estado atual
   */
  chooseMove(state: GameState, playerColor: Color): MoveIntent | null;
  
  /**
   * Nível de dificuldade do bot
   */
  level: 'easy' | 'medium' | 'hard';
  
  /**
   * Nome do bot
   */
  name: string;
}

/**
 * Interface para escolha de posição do general no setup
 */
export interface BotSetupStrategy {
  chooseGeneralPosition(state: GameState, playerColor: Color): { col: string; row: number } | null;
}

