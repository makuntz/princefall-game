import { useState } from 'react';
import './GameStyles.css';

interface CoinflipScreenProps {
  onResult: (starter: 'white' | 'black') => void;
}

export function CoinflipScreen({ onResult }: CoinflipScreenProps) {
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<'white' | 'black' | null>(null);
  const [showResult, setShowResult] = useState(false);

  const handleFlip = () => {
    setFlipping(true);
    setShowResult(false);
    
    // Sortear resultado
    const flipResult = Math.random() < 0.5 ? 'white' : 'black';
    
    setTimeout(() => {
      setFlipping(false);
      setResult(flipResult);
      setShowResult(true);
    }, 3000);
  };

  const handleStart = () => {
    if (result) {
      onResult(result);
    }
  };

  return (
    <div className="coinflip-screen">
      <div className="coinflip-title">Quem Começa?</div>
      <div className={`coin ${flipping ? 'flipping' : ''}`} style={result ? { transform: result === 'white' ? 'rotateY(0deg)' : 'rotateY(180deg)' } : {}}>
        <div className="coin-face coin-white">♔</div>
        <div className="coin-face coin-black">♚</div>
      </div>
      {!result ? (
        <button className="flip-btn" onClick={handleFlip} disabled={flipping}>
          {flipping ? 'Girando...' : 'Jogar Moeda!'}
        </button>
      ) : (
        <>
          <div className={`result-message ${showResult ? 'show' : ''}`}>
            <strong>{result === 'white' ? 'BRANCAS COMECAM!' : 'PRETAS COMECAM!'}</strong>
            <br />
            {result === 'white' ? '♔ As peças brancas fazem a primeira jogada' : '♚ As peças pretas fazem a primeira jogada'}
          </div>
          <button className="flip-btn" onClick={handleStart}>
            Iniciar Jogo!
          </button>
        </>
      )}
    </div>
  );
}

