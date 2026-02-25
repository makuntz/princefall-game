import { useState } from 'react';
import './GameStyles.css';

interface CoinflipScreenProps {
  onResult: () => void;
  coinflipDone?: boolean;
  currentTurn?: 'white' | 'black';
}

export function CoinflipScreen({ onResult, coinflipDone, currentTurn }: CoinflipScreenProps) {
  const [flipping, setFlipping] = useState(false);
  const result = coinflipDone && currentTurn ? currentTurn : null;
  const showResult = coinflipDone || false;

  const handleFlip = () => {
    if (coinflipDone) return;
    
    setFlipping(true);
    onResult();
    
    setTimeout(() => {
      setFlipping(false);
    }, 3000);
  };

  const handleStart = () => {
    if (coinflipDone) {
      onResult();
    }
  };

  return (
    <div className="coinflip-screen">
      <div className="coinflip-title">Quem Começa?</div>
      <div className={`coin ${flipping ? 'flipping' : ''}`} style={result ? { transform: result === 'white' ? 'rotateY(0deg)' : 'rotateY(180deg)' } : {}}>
        <div className="coin-face coin-white">♔</div>
        <div className="coin-face coin-black">♚</div>
      </div>
      {!coinflipDone ? (
        <button className="flip-btn" onClick={handleFlip} disabled={flipping}>
          {flipping ? 'Girando...' : 'Jogar Moeda!'}
        </button>
      ) : (
        <>
          <div className={`result-message ${showResult ? 'show' : ''}`}>
            <strong>{currentTurn === 'white' ? 'BRANCAS COMECAM!' : 'PRETAS COMECAM!'}</strong>
            <br />
            {currentTurn === 'white' ? '♔ As peças brancas fazem a primeira jogada' : '♚ As peças pretas fazem a primeira jogada'}
          </div>
          <button className="flip-btn" onClick={handleStart}>
            Continuar Jogo
          </button>
        </>
      )}
    </div>
  );
}

