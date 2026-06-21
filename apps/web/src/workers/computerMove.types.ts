import type { AiDifficulty } from '@princefall/game-ai';
import type { Color, MoveIntent, SerializedGameState } from '@princefall/game-core';

export interface ComputerMoveRequest {
  state: SerializedGameState;
  computerColor: Color;
  humanColor: Color;
  difficulty: AiDifficulty;
}

export interface ComputerMoveResponse {
  move: MoveIntent | null;
}
