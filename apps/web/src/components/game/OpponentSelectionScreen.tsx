import './GameStyles.css';

interface OpponentSelectionScreenProps {
  onSelectTwoPlayers: () => void;
  onSelectComputer: () => void;
  onBack: () => void;
}

export function OpponentSelectionScreen({
  onSelectTwoPlayers,
  onSelectComputer,
  onBack,
}: OpponentSelectionScreenProps) {
  return (
    <div className="game-container game-container-dark">
      <button type="button" className="back-btn" onClick={onBack}>
        ← Menu principal
      </button>
      <div className="setup-screen">
        <div className="setup-title">Escolha o modo de jogo</div>
        <div className="setup-instruction">
          Jogue com um amigo na mesma tela ou desafie o computador.
        </div>
        <div className="setup-actions">
          <button type="button" className="confirm-btn" onClick={onSelectTwoPlayers}>
            2 Jogadores
          </button>
          <button type="button" className="confirm-btn" onClick={onSelectComputer}>
            Contra o Computador
          </button>
        </div>
      </div>
    </div>
  );
}
