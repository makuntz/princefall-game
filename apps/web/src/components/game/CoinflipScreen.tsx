import { useCallback, useState } from 'react';
import './GameStyles.css';

export interface CoinflipScreenProps {
  /** Server/local phase: still flipping vs result shown waiting for “Iniciar jogo”. */
  phase: 'coinflip' | 'ready';
  /** Who starts once play begins (set when phase is `ready`). */
  starter: 'white' | 'black' | null;
  /** Run coin toss (API or random); parent should update phase + starter after this resolves. */
  onResolveFlip: () => Promise<void>;
  /** Start the match after the toss (e.g. BEGIN_PLAYING or POST /begin). */
  onBeginGame: () => Promise<void> | void;
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

export function CoinflipScreen({ phase, starter, onResolveFlip, onBeginGame }: CoinflipScreenProps) {
  const [flipping, setFlipping] = useState(false);
  const [beginBusy, setBeginBusy] = useState(false);
  const resolved = phase === 'ready' && starter !== null;

  const handleFlip = useCallback(async () => {
    if (flipping || resolved) return;
    setFlipping(true);
    const t0 = Date.now();
    try {
      await onResolveFlip();
    } catch {
      setFlipping(false);
      return;
    }
    const elapsed = Date.now() - t0;
    if (elapsed < 3000) {
      await sleep(3000 - elapsed);
    }
    setFlipping(false);
  }, [flipping, resolved, onResolveFlip]);

  const handleBegin = useCallback(async () => {
    if (!resolved || beginBusy) return;
    setBeginBusy(true);
    try {
      await onBeginGame();
    } finally {
      setBeginBusy(false);
    }
  }, [resolved, beginBusy, onBeginGame]);

  const showResult = resolved && !flipping;
  const coinTransform = starter === 'black' ? 'rotateY(180deg)' : 'rotateY(0deg)';

  return (
    <div className="coinflip-screen">
      <div className="coinflip-title">Quem Começa?</div>
      <div className="coin-stage">
        <div
          className={`coin ${flipping ? 'flipping' : ''}`}
          style={showResult ? { transform: coinTransform } : undefined}
        >
          <div className="coin-face coin-white">X</div>
          <div className="coin-face coin-black">I</div>
        </div>
      </div>

      {!resolved ? (
        <button className="flip-btn" onClick={handleFlip} disabled={flipping}>
          {flipping ? 'Girando...' : 'Jogar Moeda!'}
        </button>
      ) : (
        <>
          <button className="flip-btn" onClick={handleBegin} disabled={beginBusy}>
            {beginBusy ? 'Abrindo...' : 'Iniciar Jogo!'}
          </button>
          <div className={`result-message ${showResult ? 'show' : ''}`}>
            <strong>{starter === 'white' ? 'BRANCAS COMEÇAM!' : 'PRETAS COMEÇAM!'}</strong>
            <br />
            {starter === 'white' ? 'X — Xadrez' : 'I — Imperial'}
          </div>
        </>
      )}
    </div>
  );
}
