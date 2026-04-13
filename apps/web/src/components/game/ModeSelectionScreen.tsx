import './GameStyles.css';

export type LocalPlayChoice = 'imperial' | 'traditional';

interface ModeSelectionScreenProps {
  onSelectMode: (mode: LocalPlayChoice) => void;
  onBack: () => void;
}

export function ModeSelectionScreen({ onSelectMode, onBack }: ModeSelectionScreenProps) {
  return (
    <div className="mode-selection-page">
      <button type="button" className="back-btn mode-selection-back" onClick={onBack}>
        ← Voltar
      </button>
      <h1 className="mode-selection-title">Xadrez Imperial</h1>
      <p className="mode-selection-subtitle">Escolha seu modo de jogo</p>

      <div className="mode-selection-cards">
        <button type="button" className="mode-card" onClick={() => onSelectMode('imperial')}>
          <div className="mode-card-icon" aria-hidden>
            👑
          </div>
          <div className="mode-card-heading">Xadrez Imperial</div>
          <p className="mode-card-desc">
            A revolução do xadrez com novas peças e regras inovadoras!
          </p>
          <ul className="mode-card-features">
            <li>✨ Tabuleiro 9x9 (81 casas)</li>
            <li>⚔️ General com movimentos únicos</li>
            <li>👸 Princesa como objetivo</li>
            <li>♔ Rei Guerreiro poderoso</li>
            <li>🎲 Escolha inicial do General</li>
            <li>🪙 Sorteio de quem começa</li>
          </ul>
          <span className="mode-badge">Inovador</span>
        </button>

        <button type="button" className="mode-card mode-card-traditional" onClick={() => onSelectMode('traditional')}>
          <div className="mode-card-icon" aria-hidden>
            ♔
          </div>
          <div className="mode-card-heading">Xadrez Tradicional</div>
          <p className="mode-card-desc">
            O xadrez clássico de sempre com todas as regras oficiais.
          </p>
          <ul className="mode-card-features">
            <li>♟️ Tabuleiro 8x8 padrão</li>
            <li>👑 Rei como objetivo</li>
            <li>♕ Rainha poderosa</li>
            <li>🏰 Roque disponível</li>
            <li>⚡ En passant</li>
            <li>📜 Regras oficiais FIDE</li>
          </ul>
          <span className="mode-badge mode-badge-classic">Clássico</span>
        </button>
      </div>
    </div>
  );
}
