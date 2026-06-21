import { deserializeState } from '@princefall/game-core';
import { chooseBestComputerMove } from '@princefall/game-ai';
import type { ComputerMoveRequest, ComputerMoveResponse } from './computerMove.types';

self.onmessage = (event: MessageEvent<ComputerMoveRequest>) => {
  const { state, computerColor, humanColor, difficulty } = event.data;
  const gameState = deserializeState(state);
  const move = chooseBestComputerMove(gameState, computerColor, humanColor, difficulty);
  const response: ComputerMoveResponse = { move };
  self.postMessage(response);
};
