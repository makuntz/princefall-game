import { GameState, imperialMaterialScoreForColor } from '@princefall/game-core';
import './GameStyles.css';

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

function statusHeading(gameState: GameState): string {
  if (gameState.status !== 'finished') {
    return `Vez das ${gameState.currentTurn === 'white' ? 'Brancas' : 'Pretas'}`;
  }
  const wr = gameState.finishedReason;
  if (wr === 'prince_capture' || wr === 'king_capture') {
    return `${gameState.winner === 'white' ? 'Brancas' : 'Pretas'} venceram por captura!`;
  }
  if (wr === 'timeout') {
    const side = gameState.winner === 'white' ? 'Brancas' : 'Pretas';
    if (gameState.gameMode === 'traditional') {
      return `Tempo esgotado — ${side} vencem!`;
    }
    return `Tempo esgotado — ${side} vencem por pontuação!`;
  }
  if (wr === 'timeout_draw') {
    return 'Empate por pontuação';
  }
  return 'Fim de jogo';
}

export interface LocalGameSidePanelProps {
  gameState: GameState;
  contextualMessage: string;
  whiteSeconds: number;
  blackSeconds: number;
  clockActiveColor: 'white' | 'black' | null;
  onReset: () => void;
  onBackToMenu: () => void;
  swapControls?: React.ReactNode;
}

export function LocalGameSidePanel({
  gameState,
  contextualMessage,
  whiteSeconds,
  blackSeconds,
  clockActiveColor,
  onReset,
  onBackToMenu,
  swapControls,
}: LocalGameSidePanelProps) {
  const imperial = gameState.gameMode === 'imperial';
  const whiteScore = imperial ? imperialMaterialScoreForColor(gameState, 'white') : null;
  const blackScore = imperial ? imperialMaterialScoreForColor(gameState, 'black') : null;

  const whiteWarn = whiteSeconds <= 180 && whiteSeconds > 60;
  const whiteDanger = whiteSeconds <= 60;
  const blackWarn = blackSeconds <= 180 && blackSeconds > 60;
  const blackDanger = blackSeconds <= 60;

  return (
    <div className="info-panel info-panel-local">
      <div className="timer-container">
        <div
          className={`timer-box ${clockActiveColor === 'white' ? 'active' : ''} ${whiteDanger ? 'danger' : whiteWarn ? 'warning' : ''}`}
        >
          <div className="timer-label">Brancas</div>
          <div className="timer-display">{formatClock(whiteSeconds)}</div>
          {imperial && whiteScore !== null && (
            <div className="score-display">
              Pontos: <span className="score-value">{whiteScore.toFixed(1)}</span>
            </div>
          )}
        </div>
        <div
          className={`timer-box ${clockActiveColor === 'black' ? 'active' : ''} ${blackDanger ? 'danger' : blackWarn ? 'warning' : ''}`}
        >
          <div className="timer-label">Pretas</div>
          <div className="timer-display">{formatClock(blackSeconds)}</div>
          {imperial && blackScore !== null && (
            <div className="score-display">
              Pontos: <span className="score-value">{blackScore.toFixed(1)}</span>
            </div>
          )}
        </div>
      </div>

      <div
        className={`status ${gameState.status === 'finished' ? 'game-over' : gameState.currentTurn === 'white' ? 'turn-white' : 'turn-black'}`}
      >
        {statusHeading(gameState)}
      </div>

      <div className="message">{contextualMessage}</div>

      {swapControls}

      <div className="local-game-actions">
        <button type="button" className="back-btn panel-back" onClick={onBackToMenu}>
          Voltar ao menu
        </button>
        <button type="button" className="reset-btn panel-reset" onClick={onReset}>
          Reiniciar
        </button>
      </div>

      <div className="rules">
        {imperial ? (
          <>
            <strong>Objetivo:</strong> capturar o Príncipe inimigo.
            <br />
            <strong>General:</strong> não recua; 1 ou 2 casas à frente; 1 casa nas diagonais da frente.
            <br />
            <strong>Rei guerreiro:</strong> 1 ou 2 casas em cruz (sem salto na segunda) e 1 casa nas diagonais.
            <br />
            <strong>Tempo:</strong> 10 minutos por lado; ao zerar, vencedor por material no tabuleiro (empate se igual).
          </>
        ) : (
          <>
            <strong>Objetivo:</strong> capturar o Rei inimigo.
            <br />
            <strong>Modo:</strong> movimentos clássicos no tabuleiro 8×8, sem peças nem regras do Imperial.
            <br />
            <strong>Tempo:</strong> 10 minutos por lado; relógio ativo só na vez do jogador; ao zerar, vitória do adversário.
          </>
        )}
      </div>
    </div>
  );
}
