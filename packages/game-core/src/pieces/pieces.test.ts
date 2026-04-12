import { createImperialInitialState, applyAction } from '../reducer';
import { getLegalMoves } from './index';
import { GameAction } from '../types';

function toPlayingAfterSetup(): ReturnType<typeof createImperialInitialState> {
  let gameState = createImperialInitialState();
  const setupWhite: GameAction = {
    type: 'SETUP_GENERAL',
    payload: { position: { col: 'E', row: 7 } },
    playerColor: 'white',
  };
  const setupBlack: GameAction = {
    type: 'SETUP_GENERAL',
    payload: { position: { col: 'E', row: 3 } },
    playerColor: 'black',
  };
  gameState = applyAction(gameState, setupWhite);
  gameState = applyAction(gameState, setupBlack);
  const starter: 'white' | 'black' = 'white';
  gameState = applyAction(gameState, {
    type: 'RESOLVE_COINFLIP',
    payload: { starter },
  });
  gameState = applyAction(gameState, { type: 'BEGIN_PLAYING' });
  return gameState;
}

describe('Piece Movements', () => {
  describe('Prince', () => {
    it('should move 1 square in any direction', () => {
      const gameState = toPlayingAfterSetup();

      const princePos = { col: 'E' as const, row: 9 as const };
      const moves = getLegalMoves(gameState, princePos);

      expect(moves.length).toBeGreaterThan(0);
      const moveStrings = moves.map(m => `${m.col}${m.row}`);
      expect(moveStrings).toContain('E8');
      expect(moveStrings).toContain('D8');
      expect(moveStrings).toContain('F8');
    });
  });

  describe('King (Imperial warrior)', () => {
    it('allows 1 or 2 cardinal steps without jump and 1 diagonal step', () => {
      const gameState = toPlayingAfterSetup();

      const kingPos = { col: 'F' as const, row: 9 as const };
      const moves = getLegalMoves(gameState, kingPos);
      const moveStrings = moves.map(m => `${m.col}${m.row}`);

      expect(moveStrings).toContain('F8');
      expect(moveStrings).toContain('G9');
      expect(moveStrings).toContain('H9');
      expect(moveStrings).toContain('E8');
    });
  });

  describe('General', () => {
    it('moves only forward (no retreat) with optional double forward and forward diagonals', () => {
      const gameState = toPlayingAfterSetup();

      const generalPos = { col: 'E' as const, row: 7 as const };
      const moves = getLegalMoves(gameState, generalPos);
      const moveStrings = moves.map(m => `${m.col}${m.row}`);

      expect(moveStrings).toContain('E6');
      expect(moveStrings).toContain('E5');
      expect(moveStrings).toContain('D6');
      expect(moveStrings).toContain('F6');
      expect(moveStrings).not.toContain('E8');
    });
  });

  describe('Game flow', () => {
    it('enters coinflip after both generals, then ready/playing via actions', () => {
      let gameState = createImperialInitialState();
      gameState = applyAction(gameState, {
        type: 'SETUP_GENERAL',
        payload: { position: { col: 'E', row: 7 } },
        playerColor: 'white',
      });
      expect(gameState.status).toBe('setup');
      gameState = applyAction(gameState, {
        type: 'SETUP_GENERAL',
        payload: { position: { col: 'E', row: 3 } },
        playerColor: 'black',
      });
      expect(gameState.status).toBe('coinflip');
      gameState = applyAction(gameState, {
        type: 'RESOLVE_COINFLIP',
        payload: { starter: 'black' },
      });
      expect(gameState.status).toBe('ready');
      expect(gameState.currentTurn).toBe('black');
      gameState = applyAction(gameState, { type: 'BEGIN_PLAYING' });
      expect(gameState.status).toBe('playing');
    });
  });
});
