import './GameStyles.css';

interface ColorSelectionScreenProps {
  onSelectWhite: () => void;
  onSelectBlack: () => void;
  onBack: () => void;
}

export function ColorSelectionScreen({
  onSelectWhite,
  onSelectBlack,
  onBack,
}: ColorSelectionScreenProps) {
  return (
    <div className="game-container game-container-dark">
      <button type="button" className="back-btn" onClick={onBack}>
        ← Voltar
      </button>
      <div className="setup-screen">
        <div className="setup-title">Escolha sua cor</div>
        <div className="setup-instruction">
          O computador posicionará o General adversário automaticamente.
        </div>
        <div className="setup-actions">
          <button type="button" className="confirm-btn" onClick={onSelectWhite}>
            Jogar com Brancas
          </button>
          <button type="button" className="confirm-btn" onClick={onSelectBlack}>
            Jogar com Pretas
          </button>
        </div>
      </div>
    </div>
  );
}
