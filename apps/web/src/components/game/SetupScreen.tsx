import { useState } from 'react';
import { Position } from '@princefall/game-core';
import './GameStyles.css';

interface SetupScreenProps {
  playerColor: 'white' | 'black';
  onConfirm: (position: Position) => void;
  waiting?: boolean;
}

export function SetupScreen({ playerColor, onConfirm, waiting }: SetupScreenProps) {
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  
  const allowedRow = playerColor === 'white' ? 7 : 3;
  const columns: Array<'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I'> = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
  
  const positions: Position[] = columns.map(col => ({ col, row: allowedRow as any }));

  const handleSelect = (pos: Position) => {
    setSelectedPos(pos);
  };

  const handleConfirm = () => {
    if (selectedPos) {
      onConfirm(selectedPos);
    }
  };

  if (waiting) {
    return (
      <div className="setup-screen">
        <div className="setup-title">Aguardando {playerColor === 'white' ? 'Pretas' : 'Brancas'}...</div>
        <div className="waiting-message">O outro jogador está escolhendo a posição do General</div>
        <div className="setup-tip">
          💡 <strong>Dica para testar sozinho:</strong> abra outra aba ou janela, faça login com outro e-mail e entre na mesma partida com o código de convite.
        </div>
      </div>
    );
  }

  return (
    <div className="setup-screen">
      <div className="setup-title">
        JOGADOR {playerColor === 'white' ? 'BRANCAS' : 'PRETAS'} - Escolha a posição do General
      </div>
      <div className="setup-instruction">
        Escolha secretamente onde seu General será posicionado na linha {allowedRow}.
        <br />Esta escolha definirá sua estratégia inicial!
      </div>
      <div className="position-selector">
        {positions.map((pos) => (
          <button
            key={`${pos.col}${pos.row}`}
            className={`position-btn ${selectedPos?.col === pos.col && selectedPos?.row === pos.row ? 'selected' : ''}`}
            onClick={() => handleSelect(pos)}
          >
            {pos.col}{pos.row}
          </button>
        ))}
      </div>
      <button
        className="confirm-btn"
        onClick={handleConfirm}
        disabled={!selectedPos}
      >
        Confirmar Posição
      </button>
    </div>
  );
}

