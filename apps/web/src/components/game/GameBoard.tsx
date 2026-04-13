import { useState, useEffect, useMemo } from 'react';
import { api } from '../../api';
import {
  GameState,
  Position,
  deserializeState,
  getLegalMoves,
  imperialMaterialScoreForColor,
  positionToString,
} from '@princefall/game-core';
import { SetupScreen } from './SetupScreen';
import { CoinflipScreen } from './CoinflipScreen';
import { getPieceEmoji, pieceBoardClassName } from './pieceEmoji';
import { pieceLabelPt } from './pieceLabels';
import './GameStyles.css';

const MATCH_CLOCK_MS = 10 * 60 * 1000;

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

function onlineClockSeconds(
  gameInfo: {
    whiteTimeMs?: number;
    blackTimeMs?: number;
    turnStartedAt?: string | null;
    currentTurn?: string;
  },
  gameState: GameState,
  nowMs: number
): { white: number; black: number; active: 'white' | 'black' | null } {
  const wBank = (gameInfo.whiteTimeMs ?? MATCH_CLOCK_MS) / 1000;
  const bBank = (gameInfo.blackTimeMs ?? MATCH_CLOCK_MS) / 1000;
  if (gameState.status === 'finished') {
    return { white: wBank, black: bBank, active: null };
  }
  const started = gameInfo.turnStartedAt
    ? new Date(gameInfo.turnStartedAt).getTime()
    : null;
  const elapsed = started != null ? Math.max(0, (nowMs - started) / 1000) : 0;
  const ct = (gameInfo.currentTurn || gameState.currentTurn) as 'white' | 'black';
  if (ct === 'white') {
    return { white: Math.max(0, wBank - elapsed), black: bBank, active: 'white' };
  }
  return { white: wBank, black: Math.max(0, bBank - elapsed), active: 'black' };
}

interface GameBoardProps {
  gameId: string;
  token: string;
  onBack: () => void;
  playerColor?: 'white' | 'black';
  onOpenLeaderboard?: () => void;
}

type GamePhase = 'waiting' | 'setup' | 'coinflip' | 'ready' | 'playing' | 'finished';

const COLS_9 = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const;
const ROWS_9 = [9, 8, 7, 6, 5, 4, 3, 2, 1] as const;
const COLS_8 = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
const ROWS_8 = [8, 7, 6, 5, 4, 3, 2, 1] as const;

function boardLayoutFor(gameState: GameState | null) {
  if (gameState?.gameMode === 'traditional') {
    return {
      size: 8 as const,
      columns: COLS_8,
      rows: ROWS_8,
      gridLineEnd: 10,
      gridStyle: {
        gridTemplateColumns:
          'minmax(22px, 0.35fr) repeat(8, minmax(36px, 1fr)) minmax(22px, 0.35fr)',
        gridTemplateRows:
          'minmax(22px, 0.35fr) repeat(8, minmax(36px, 1fr)) minmax(22px, 0.35fr)',
      },
    };
  }
  return {
    size: 9 as const,
    columns: COLS_9,
    rows: ROWS_9,
    gridLineEnd: 11,
    gridStyle: {
      gridTemplateColumns:
        'minmax(22px, 0.35fr) repeat(9, minmax(36px, 1fr)) minmax(22px, 0.35fr)',
      gridTemplateRows:
        'minmax(22px, 0.35fr) repeat(9, minmax(36px, 1fr)) minmax(22px, 0.35fr)',
    },
  };
}

export function GameBoard({ gameId, token, onBack, playerColor, onOpenLeaderboard }: GameBoardProps) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const [loading, setLoading] = useState(false);
  const [gameInfo, setGameInfo] = useState<any>(null);
  const [swapMode, setSwapMode] = useState(false);

  useEffect(() => {
    loadGame();
    const interval = setInterval(loadGame, 2000);
    return () => clearInterval(interval);
  }, [gameId, token]);

  const loadGame = async () => {
    try {
      const res = await api.get(`/games/${gameId}`, { token });
      setGameInfo(res.game);
      setGameState(deserializeState(res.gameState));
    } catch (err) {
      console.error('Error loading game:', err);
    }
  };

  const handleSetupGeneral = async (pos: Position) => {
    if (!gameInfo || gameInfo.phase !== 'setup') return;

    setLoading(true);
    try {
      const res = await api.post(
        `/games/${gameId}/setup`,
        { position: pos },
        { token }
      );
      setGameState(deserializeState(res.gameState));
      setGameInfo(res.game);
    } catch (err: any) {
      alert(err.message || 'Erro ao posicionar general');
    } finally {
      setLoading(false);
    }
  };

  const handleCoinflipResolve = async () => {
    if (!gameInfo || gameInfo.phase !== 'coinflip') return;

    setLoading(true);
    try {
      const res = await api.post(`/games/${gameId}/coinflip`, {}, { token });
      setGameState(deserializeState(res.gameState));
      setGameInfo(res.game);
    } catch (err: any) {
      alert(err.message || 'Erro ao fazer coinflip');
    } finally {
      setLoading(false);
    }
  };

  const handleBeginPlaying = async () => {
    if (!gameInfo || gameInfo.phase !== 'ready') return;

    setLoading(true);
    try {
      const res = await api.post(`/games/${gameId}/begin`, {}, { token });
      setGameState(deserializeState(res.gameState));
      setGameInfo(res.game);
    } catch (err: any) {
      alert(err.message || 'Erro ao iniciar partida');
    } finally {
      setLoading(false);
    }
  };

  const handleCellClick = async (pos: Position) => {
    if (!gameState || !gameInfo || gameInfo.phase !== 'playing') return;
    if (gameState.currentTurn !== (gameInfo.playerColor || playerColor)) return;

    if (swapMode) {
      handleSwapClick(pos);
      return;
    }

    if (selectedPos) {
      const legalMoves = getLegalMoves(gameState, selectedPos);
      const isValidMove = legalMoves.some(
        m => m.col === pos.col && m.row === pos.row
      );

      if (!isValidMove) {
        alert('Movimento inválido!');
        setSelectedPos(null);
        return;
      }

      setLoading(true);
      try {
        const res = await api.post(
          `/games/${gameId}/moves`,
          {
            from: selectedPos,
            to: pos,
            moveNumber: gameState.moveNumber,
          },
          { token }
        );
        setGameState(deserializeState(res.gameState));
        setGameInfo(res.game);
        setSelectedPos(null);
      } catch (err: any) {
        alert(err.message || 'Movimento inválido');
      } finally {
        setLoading(false);
      }
    } else {
      const piece = gameState.board.get(positionToString(pos));
      if (piece && piece.color === gameState.currentTurn) {
        setSelectedPos(pos);
      }
    }
  };

  const handleSwapClick = async (pos: Position) => {
    if (!gameState || !selectedPos) return;

    const piece1 = gameState.board.get(positionToString(selectedPos));
    const piece2 = gameState.board.get(positionToString(pos));

    if (!piece1 || !piece2) {
      setSelectedPos(null);
      setSwapMode(false);
      return;
    }

    const isKingAndPrince = 
      ((piece1.type === 'king' && piece2.type === 'prince') ||
       (piece1.type === 'prince' && piece2.type === 'king')) &&
      piece1.color === piece2.color &&
      piece1.color === gameState.currentTurn;

    if (!isKingAndPrince) {
      alert('Selecione o Rei e a Princesa do mesmo jogador para trocar!');
      setSelectedPos(null);
      setSwapMode(false);
      return;
    }

    const canSwap = gameState.currentTurn === 'white' 
      ? !gameState.whiteKingSwapped 
      : !gameState.blackKingSwapped;

    if (!canSwap) {
      alert('Você já usou sua troca neste jogo!');
      setSelectedPos(null);
      setSwapMode(false);
      return;
    }

    setLoading(true);
    try {
      const res = await api.post(
        `/games/${gameId}/moves`,
        {
          from: selectedPos,
          to: pos,
          moveNumber: gameState.moveNumber,
          isSwap: true,
        },
        { token }
      );
      setGameState(deserializeState(res.gameState));
      setGameInfo(res.game);
      setSelectedPos(null);
      setSwapMode(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao realizar troca');
    } finally {
      setLoading(false);
    }
  };

  const handleSwapMode = () => {
    if (!gameState || !gameInfo || gameInfo.phase !== 'playing') return;
    if (gameState.gameMode !== 'imperial') return;

    const canSwap = gameState.currentTurn === (gameInfo.playerColor || playerColor) &&
      (gameState.currentTurn === 'white' ? !gameState.whiteKingSwapped : !gameState.blackKingSwapped);

    if (!canSwap) {
      alert('Você já usou sua troca neste jogo!');
      return;
    }

    setSwapMode(true);
    setSelectedPos(null);
  };

  const legalMoves = useMemo(() => {
    if (!gameState || !selectedPos || swapMode) return [];
    return getLegalMoves(gameState, selectedPos);
  }, [gameState, selectedPos, swapMode]);

  const [clockNow, setClockNow] = useState(() => Date.now());
  useEffect(() => {
    const playing =
      gameState &&
      gameInfo &&
      gameInfo.phase === 'playing' &&
      gameState.status !== 'finished';
    if (!playing) return;
    const id = setInterval(() => setClockNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [gameState, gameInfo]);

  const clockDisplay = useMemo(() => {
    if (!gameInfo || !gameState) {
      return { white: 0, black: 0, active: null as 'white' | 'black' | null };
    }
    return onlineClockSeconds(gameInfo, gameState, clockNow);
  }, [gameInfo, gameState, clockNow]);

  const boardLayout = useMemo(() => boardLayoutFor(gameState), [gameState?.gameMode]);

  if (!gameState || !gameInfo) {
    return (
      <div className="game-container game-container-dark">
        <button type="button" className="back-btn" onClick={onBack}>← Voltar</button>
        <div className="online-lobby">
          <div className="setup-screen">
            <div className="setup-title">Carregando...</div>
          </div>
        </div>
      </div>
    );
  }

  const currentPlayerColor: 'white' | 'black' = gameInfo.playerColor || playerColor || 'white';
  const phase: GamePhase = gameInfo.phase || 'waiting';

  if (phase === 'waiting') {
    return (
      <div className="game-container game-container-dark">
        <button type="button" className="back-btn" onClick={onBack}>← Voltar</button>
        <div className="online-lobby">
          {gameInfo?.inviteCode && (
            <div className="online-invite-card">
              <p className="online-invite-hint">Compartilhe este código com seu oponente:</p>
              <div className="online-invite-code">{gameInfo.inviteCode}</div>
              <button
                type="button"
                className="online-invite-copy-btn"
                onClick={() => {
                  navigator.clipboard.writeText(gameInfo.inviteCode);
                  alert('Código copiado para a área de transferência!');
                }}
              >
                Copiar código
              </button>
            </div>
          )}
          <div className="setup-screen">
            <div className="setup-title">Aguardando segundo jogador...</div>
            <p className="online-lobby-mode-line">
              Modo desta partida:{' '}
              <strong>
                {gameInfo.gameMode === 'traditional'
                  ? 'Xadrez Tradicional'
                  : 'Xadrez Imperial'}
              </strong>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'setup') {
    const waiting = currentPlayerColor === 'white'
      ? gameInfo.whiteGeneralPos && !gameInfo.blackGeneralPos
      : !gameInfo.whiteGeneralPos && gameInfo.blackGeneralPos;

    return (
      <div className="game-container game-container-dark">
        <button type="button" className="back-btn" onClick={onBack}>← Voltar</button>
        <div className="online-lobby" style={{ maxWidth: 720 }}>
          <SetupScreen
            playerColor={currentPlayerColor}
            onConfirm={handleSetupGeneral}
            waiting={!!waiting}
          />
          {waiting && (
            <div style={{ textAlign: 'center' }}>
              <button type="button" className="online-lobby-back-btn" onClick={onBack}>
                Voltar para lista de partidas
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'coinflip' || phase === 'ready') {
    return (
      <div className="game-container game-container-dark">
        <button type="button" className="back-btn" onClick={onBack}>← Voltar</button>
        <div className="online-lobby" style={{ maxWidth: 640 }}>
          <CoinflipScreen
            phase={phase === 'ready' ? 'ready' : 'coinflip'}
            starter={phase === 'ready' ? gameInfo.currentTurn : null}
            onResolveFlip={handleCoinflipResolve}
            onBeginGame={handleBeginPlaying}
          />
        </div>
      </div>
    );
  }

  if (phase === 'finished') {
    const white = gameInfo.whitePlayer;
    const black = gameInfo.blackPlayer;
    const winnerName = gameInfo.winnerId === white?.id ? white.username :
                       gameInfo.winnerId === black?.id ? black.username :
                       null;
    const winnerSide = gameInfo.winnerId === white?.id ? 'Brancas' :
                       gameInfo.winnerId === black?.id ? 'Pretas' :
                       null;
    const finishedReason = gameInfo.finishedReason || 'prince_capture';

    return (
      <div className="game-container game-container-dark">
        <button type="button" className="back-btn" onClick={onBack}>← Voltar</button>

        <div className="online-finished-wrap">
          <div className="online-finished-card">
            <div className="online-finished-emoji" aria-hidden>🏁</div>
            <h1 className="online-finished-title">Partida finalizada</h1>

            {winnerName && winnerSide ? (
              <div style={{ marginBottom: '1.5rem' }}>
                <div className="online-finished-winner">
                  Vencedor: <strong>{winnerName}</strong>
                </div>
                <div className="online-finished-side">({winnerSide})</div>
                <div className="online-finished-reason">
                  Motivo:{' '}
                  {finishedReason === 'timeout' || finishedReason === 'timeout_draw'
                    ? finishedReason === 'timeout_draw'
                      ? 'Empate por pontuação'
                      : 'Tempo esgotado'
                    : finishedReason === 'king_capture'
                      ? 'Rei capturado'
                      : 'Captura da princesa'}
                </div>
              </div>
            ) : (
              <div className="online-finished-muted">
                {finishedReason === 'timeout_draw' ? 'Empate por pontuação' : 'Partida finalizada'}
              </div>
            )}

            <div className="online-finished-actions">
              <button type="button" className="online-finished-btn online-finished-btn--primary" onClick={onBack}>
                Voltar
              </button>
              {onOpenLeaderboard && (
                <button
                  type="button"
                  className="online-finished-btn online-finished-btn--ranking"
                  onClick={onOpenLeaderboard}
                >
                  Ver ranking
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="game-layout game-layout-stacked" style={{ opacity: 0.5, pointerEvents: 'none' }}>
          <div className="board-wrapper">
            <div className="board-container" style={boardLayout.gridStyle}>
              {boardLayout.columns.map((col, idx) => (
                <div key={`top-${col}`} className="coord-label" style={{ gridColumn: idx + 2, gridRow: 1 }}>
                  {col}
                </div>
              ))}
              {boardLayout.columns.map((col, idx) => (
                <div
                  key={`bottom-${col}`}
                  className="coord-label"
                  style={{ gridColumn: idx + 2, gridRow: boardLayout.gridLineEnd }}
                >
                  {col}
                </div>
              ))}
              {boardLayout.rows.map((row, idx) => (
                <div key={`left-${row}`} className="coord-label" style={{ gridColumn: 1, gridRow: idx + 2 }}>
                  {row}
                </div>
              ))}
              {boardLayout.rows.map((row, idx) => (
                <div
                  key={`right-${row}`}
                  className="coord-label"
                  style={{ gridColumn: boardLayout.gridLineEnd, gridRow: idx + 2 }}
                >
                  {row}
                </div>
              ))}

              <div
                className="board"
                style={{
                  gridColumn: `2 / ${boardLayout.gridLineEnd}`,
                  gridRow: `2 / ${boardLayout.gridLineEnd}`,
                  gridTemplateColumns: `repeat(${boardLayout.size}, 1fr)`,
                  gridTemplateRows: `repeat(${boardLayout.size}, 1fr)`,
                }}
              >
                {boardLayout.rows.map((row) =>
                  boardLayout.columns.map((col) => {
                    const pos = { col, row } as Position;
                    const key = positionToString(pos);
                    const squarePiece = gameState?.board.get(key);
                    const isLight = (boardLayout.columns.indexOf(col) + row) % 2 === 0;

                    return (
                      <div
                        key={key}
                        className={`square ${isLight ? 'light' : 'dark'}`}
                      >
                        {squarePiece && (
                          <span className={pieceBoardClassName(squarePiece.color, squarePiece.type)}>
                            {getPieceEmoji(squarePiece.type, squarePiece.color)}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const piece = selectedPos ? gameState.board.get(positionToString(selectedPos)) : null;
  const canSwap =
    gameState.gameMode === 'imperial' &&
    gameState.currentTurn === currentPlayerColor &&
    (gameState.currentTurn === 'white' ? !gameState.whiteKingSwapped : !gameState.blackKingSwapped);

  const imperial = gameState.gameMode === 'imperial';
  const whiteScore = imperial ? imperialMaterialScoreForColor(gameState, 'white') : null;
  const blackScore = imperial ? imperialMaterialScoreForColor(gameState, 'black') : null;
  const whiteWarn = clockDisplay.white <= 180 && clockDisplay.white > 60;
  const whiteDanger = clockDisplay.white <= 60;
  const blackWarn = clockDisplay.black <= 180 && clockDisplay.black > 60;
  const blackDanger = clockDisplay.black <= 60;

  return (
    <div className="game-container game-container-dark">
      <button className="back-btn" onClick={onBack}>← Voltar</button>

      <h1 className="game-play-title">
        {gameState.gameMode === 'imperial' ? 'XADREZ IMPERIAL' : 'XADREZ TRADICIONAL'}
      </h1>

      <div className="game-layout game-layout-stacked">
        <div className="board-wrapper">
          <div className="board-container" style={boardLayout.gridStyle}>
            {boardLayout.columns.map((col, idx) => (
              <div key={`top-${col}`} className="coord-label" style={{ gridColumn: idx + 2, gridRow: 1 }}>
                {col}
              </div>
            ))}
            {boardLayout.columns.map((col, idx) => (
              <div
                key={`bottom-${col}`}
                className="coord-label"
                style={{ gridColumn: idx + 2, gridRow: boardLayout.gridLineEnd }}
              >
                {col}
              </div>
            ))}
            {boardLayout.rows.map((row, idx) => (
              <div key={`left-${row}`} className="coord-label" style={{ gridColumn: 1, gridRow: idx + 2 }}>
                {row}
              </div>
            ))}
            {boardLayout.rows.map((row, idx) => (
              <div
                key={`right-${row}`}
                className="coord-label"
                style={{ gridColumn: boardLayout.gridLineEnd, gridRow: idx + 2 }}
              >
                {row}
              </div>
            ))}

            <div
              className="board"
              style={{
                gridColumn: `2 / ${boardLayout.gridLineEnd}`,
                gridRow: `2 / ${boardLayout.gridLineEnd}`,
                gridTemplateColumns: `repeat(${boardLayout.size}, 1fr)`,
                gridTemplateRows: `repeat(${boardLayout.size}, 1fr)`,
              }}
            >
              {boardLayout.rows.map((row) =>
                boardLayout.columns.map((col) => {
                  const pos = { col, row } as Position;
                  const key = positionToString(pos);
                  const squarePiece = gameState.board.get(key);
                  const isSelected = selectedPos?.col === col && selectedPos?.row === row;
                  const isHighlight = legalMoves.some(m => m.col === col && m.row === row);
                  const isCapture = isHighlight && squarePiece !== null;
                  const isLight = (boardLayout.columns.indexOf(col) + row) % 2 === 0;

                  return (
                    <div
                      key={key}
                      className={`square ${isLight ? 'light' : 'dark'} ${isSelected ? 'selected' : ''} ${isHighlight ? 'highlight' : ''} ${isCapture ? 'capture' : ''}`}
                      onClick={() => handleCellClick(pos)}
                    >
                      {squarePiece && (
                        <span className={pieceBoardClassName(squarePiece.color, squarePiece.type)}>
                          {getPieceEmoji(squarePiece.type, squarePiece.color)}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="info-panel info-panel-local">
          <div className="timer-container">
            <div
              className={`timer-box ${clockDisplay.active === 'white' ? 'active' : ''} ${whiteDanger ? 'danger' : whiteWarn ? 'warning' : ''}`}
            >
              <div className="timer-label">Brancas</div>
              <div className="timer-display">{formatClock(clockDisplay.white)}</div>
              {imperial && whiteScore !== null && (
                <div className="score-display">
                  Pontos: <span className="score-value">{whiteScore.toFixed(1)}</span>
                </div>
              )}
            </div>
            <div
              className={`timer-box ${clockDisplay.active === 'black' ? 'active' : ''} ${blackDanger ? 'danger' : blackWarn ? 'warning' : ''}`}
            >
              <div className="timer-label">Pretas</div>
              <div className="timer-display">{formatClock(clockDisplay.black)}</div>
              {imperial && blackScore !== null && (
                <div className="score-display">
                  Pontos: <span className="score-value">{blackScore.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>

          <div className={`status ${gameState.status === 'finished' ? 'game-over' : gameState.currentTurn === 'white' ? 'turn-white' : 'turn-black'}`}>
            {gameState.status === 'finished'
              ? gameState.finishedReason === 'timeout_draw'
                ? 'Empate por pontuação'
                : gameState.winner
                  ? `${gameState.winner === 'white' ? 'Brancas' : 'Pretas'} venceram!`
                  : 'Fim de jogo'
              : `Vez das ${gameState.currentTurn === 'white' ? 'Brancas' : 'Pretas'}`}
          </div>

          <div className="message">
            {swapMode
              ? 'Modo Troca: Selecione o Rei e a Princesa para trocar'
              : selectedPos
                ? `Peça selecionada: ${positionToString(selectedPos)} ${piece ? `(${pieceLabelPt(piece.type)})` : ''}`
                : gameState.lastMove
                  ? `Última jogada: ${positionToString(gameState.lastMove.from)} → ${positionToString(gameState.lastMove.to)}`
                  : 'Selecione uma peça para mover'}
          </div>

          {imperial && (
            <div className="swap-controls">
              <button
                className={`swap-btn ${swapMode ? 'active' : ''}`}
                onClick={handleSwapMode}
                disabled={!canSwap || gameState.status === 'finished' || gameState.currentTurn !== currentPlayerColor}
              >
                {swapMode
                  ? 'Cancelar Troca'
                  : gameState.currentTurn === 'white'
                    ? `Troca Rei-Princesa BRANCAS: ${gameState.whiteKingSwapped ? 'Usado' : 'Disponível'}`
                    : `Troca Rei-Princesa PRETAS: ${gameState.blackKingSwapped ? 'Usado' : 'Disponível'}`}
              </button>
            </div>
          )}

          <button className="reset-btn" onClick={() => window.location.reload()}>
            Reiniciar Jogo
          </button>

          <div className="rules">
            <strong>Objetivo:</strong> capturar a princesa inimiga.
            <br />
            <strong>General:</strong> 1 ou 2 casas para a frente + 1 casa na diagonal à frente (não recua).
            <br />
            <strong>Rei guerreiro:</strong> 1 ou 2 casas na cruz (sem salto) + 1 casa nas diagonais.
            <br />
            <strong>Princesa:</strong> move 1 casa em qualquer direção.
            <br />
            <strong>Troca especial:</strong> o rei pode trocar de lugar com a princesa uma vez por jogo.
            <br />
            <strong>Tempo:</strong> 10 minutos por lado; ao zerar, vitória por pontuação no tabuleiro (empate se igual).
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.8)', color: 'white', padding: '20px', borderRadius: '10px' }}>
          Processando...
        </div>
      )}
    </div>
  );
}

