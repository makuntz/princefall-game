import type { AiDifficulty } from '@princefall/game-ai';
import { AI_DIFFICULTY_LABELS } from '@princefall/game-ai';
import './GameStyles.css';

interface DifficultySelectionScreenProps {
  onSelect: (difficulty: AiDifficulty) => void;
  onBack: () => void;
}

const DIFFICULTY_ORDER: AiDifficulty[] = ['easy', 'medium', 'hard'];

export function DifficultySelectionScreen({ onSelect, onBack }: DifficultySelectionScreenProps) {
  return (
    <div className="game-container game-container-dark">
      <button type="button" className="back-btn" onClick={onBack}>
        ← Voltar
      </button>
      <div className="setup-screen">
        <div className="setup-title">Nivel da IA</div>
        <div className="setup-instruction">
          Escolha o nivel de dificuldade do computador.
        </div>
        <div className="setup-actions">
          {DIFFICULTY_ORDER.map(level => {
            const { title, description } = AI_DIFFICULTY_LABELS[level];
            return (
              <button
                key={level}
                type="button"
                className="confirm-btn difficulty-btn"
                onClick={() => onSelect(level)}
              >
                <span className="difficulty-btn-title">{title}</span>
                <span className="difficulty-btn-desc">{description}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function aiDifficultyLabel(difficulty: AiDifficulty): string {
  return AI_DIFFICULTY_LABELS[difficulty].title;
}
