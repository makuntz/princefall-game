import { useState, useEffect, useMemo } from 'react';
import { api } from '../../api';
import { GameState, Position, deserializeState, getLegalMoves, positionToString } from '@princefall/game-core';
import { SetupScreen } from './SetupScreen';
import { CoinflipScreen } from './CoinflipScreen';
import './GameStyles.css';

interface GameBoardProps {
  gameId: string;
  token: string;
  onBack: () => void;
  playerColor?: 'white' | 'black';
}

type GamePhase = 'setup' | 'coinflip' | 'playing' | 'finished';

export function GameBoard({ gameId, token, onBack, playerColor }: GameBoardProps) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const [loading, setLoading] = useState(false);
  const [gameInfo, setGameInfo] = useState<any>(null);
  const [phase, setPhase] = useState<GamePhase>('setup');
  const [swapMode, setSwapMode] = useState(false);
  const [coinflipResult, setCoinflipResult] = useState<'white' | 'black' | null>(null);

  useEffect(() => {
    loadGame();
    const interval = setInterval(loadGame, 2000);
    return () => clearInterval(interval);
  }, [gameId]);

  useEffect(() => {
    if (gameState) {
      if (gameState.status === 'setup') {
        setPhase('setup');
      } else if (gameState.status === 'playing') {
        // Coinflip só aparece uma vez, quando transiciona de setup para playing pela primeira vez
        if (phase === 'setup' && !coinflipResult && gameState.moveNumber === 0) {
          setPhase('coinflip');
        } else {
          setPhase('playing');
        }
      } else if (gameState.status === 'finished') {
        setPhase('finished');
      }
    }
  }, [gameState, phase, coinflipResult]);

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
    if (!gameState || gameState.status !== 'setup') return;

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

  const handleCoinflipResult = (starter: 'white' | 'black') => {
    setCoinflipResult(starter);
    setPhase('playing');
  };

  const handleCellClick = async (pos: Position) => {
    if (!gameState || gameState.status !== 'playing' || phase !== 'playing') return;
    if (gameState.currentTurn !== playerColor) return;

    if (swapMode) {
      handleSwapClick(pos);
      return;
    }

    if (selectedPos) {
      // Tentar fazer movimento
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
      // Selecionar peça
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

    // Verificar se são rei e príncipe do mesmo jogador
    const isKingAndPrince = 
      ((piece1.type === 'king' && piece2.type === 'prince') ||
       (piece1.type === 'prince' && piece2.type === 'king')) &&
      piece1.color === piece2.color &&
      piece1.color === gameState.currentTurn;

    if (!isKingAndPrince) {
      alert('Selecione o Rei e o Príncipe do mesmo jogador para trocar!');
      setSelectedPos(null);
      setSwapMode(false);
      return;
    }

    // Verificar se ainda pode trocar
    const canSwap = gameState.currentTurn === 'white' 
      ? !gameState.whiteKingSwapped 
      : !gameState.blackKingSwapped;

    if (!canSwap) {
      alert('Você já usou sua troca neste jogo!');
      setSelectedPos(null);
      setSwapMode(false);
      return;
    }

    // Executar troca via API
    setLoading(true);
    try {
      // Usar endpoint de swap (precisa ser criado no backend)
      // Por enquanto, vamos usar o endpoint de move com flag isSwap
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
    if (!gameState || gameState.status !== 'playing') return;
    
    const canSwap = gameState.currentTurn === 'white' 
      ? !gameState.whiteKingSwapped 
      : !gameState.blackKingSwapped;

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

  const columns: Array<'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I'> = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
  const rows: Array<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9> = [9, 8, 7, 6, 5, 4, 3, 2, 1];

  if (!gameState || !gameInfo) {
    return (
      <div className="game-container">
        <div className="setup-screen">
          <div className="setup-title">Carregando...</div>
        </div>
      </div>
    );
  }

  // Determinar cor do jogador atual
  // Prioridade: 1) prop playerColor, 2) gameInfo.playerColor do backend, 3) default 'white'
  let currentPlayerColor: 'white' | 'black' = playerColor || gameInfo?.playerColor || 'white';

  if (phase === 'setup') {
    const waiting = currentPlayerColor === 'white'
      ? gameState.whiteGeneralPosition && !gameState.blackGeneralPosition
      : !gameState.whiteGeneralPosition && gameState.blackGeneralPosition;
    
    // Verificar se está aguardando segundo jogador (status 'waiting')
    const waitingForSecondPlayer = gameInfo?.status === 'waiting' && !gameInfo?.blackPlayer;

    return (
      <div className="game-container">
        <button className="back-btn" onClick={onBack}>← Voltar</button>
        {waitingForSecondPlayer && gameInfo?.inviteCode && (
          <div style={{
            marginBottom: '20px',
            padding: '20px',
            background: '#2a2a2a',
            borderRadius: '8px',
            textAlign: 'center',
            border: '2px solid #4a9eff'
          }}>
            <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '10px' }}>
              Compartilhe este código com seu oponente:
            </div>
            <div style={{
              fontSize: '32px',
              fontWeight: 'bold',
              color: '#4a9eff',
              letterSpacing: '4px',
              fontFamily: 'monospace',
              marginBottom: '10px'
            }}>
              {gameInfo.inviteCode}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(gameInfo.inviteCode);
                alert('Código copiado para a área de transferência!');
              }}
              style={{
                padding: '8px 16px',
                background: '#4a9eff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              📋 Copiar Código
            </button>
          </div>
        )}
        <SetupScreen
          playerColor={currentPlayerColor}
          onConfirm={handleSetupGeneral}
          waiting={!!waiting}
        />
        {waiting && (
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <button 
              onClick={onBack}
              style={{
                padding: '10px 20px',
                background: '#666',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Voltar para Lista de Partidas
            </button>
          </div>
        )}
      </div>
    );
  }

  if (phase === 'coinflip') {
    return (
      <div className="game-container">
        <button className="back-btn" onClick={onBack}>← Voltar</button>
        <CoinflipScreen onResult={handleCoinflipResult} />
      </div>
    );
  }

  // Game screen
  const piece = selectedPos ? gameState.board.get(positionToString(selectedPos)) : null;
  const canSwap = gameState.currentTurn === currentPlayerColor &&
    (gameState.currentTurn === 'white' ? !gameState.whiteKingSwapped : !gameState.blackKingSwapped);

  return (
    <div className="game-container">
      <button className="back-btn" onClick={onBack}>← Voltar</button>
      
      <div className="game-layout">
        <div className="board-wrapper">
          <div className="board-container">
            {/* Coordenadas */}
            {columns.map((col, idx) => (
              <div key={`top-${col}`} className="coord-label" style={{ gridColumn: idx + 2, gridRow: 1 }}>
                {col}
              </div>
            ))}
            {columns.map((col, idx) => (
              <div key={`bottom-${col}`} className="coord-label" style={{ gridColumn: idx + 2, gridRow: 11 }}>
                {col}
              </div>
            ))}
            {rows.map((row, idx) => (
              <div key={`left-${row}`} className="coord-label" style={{ gridColumn: 1, gridRow: idx + 2 }}>
                {row}
              </div>
            ))}
            {rows.map((row, idx) => (
              <div key={`right-${row}`} className="coord-label" style={{ gridColumn: 11, gridRow: idx + 2 }}>
                {row}
              </div>
            ))}

            {/* Tabuleiro */}
            <div className="board">
              {rows.map((row) =>
                columns.map((col) => {
                  const pos: Position = { col, row };
                  const key = positionToString(pos);
                  const squarePiece = gameState.board.get(key);
                  const isSelected = selectedPos?.col === col && selectedPos?.row === row;
                  const isHighlight = legalMoves.some(m => m.col === col && m.row === row);
                  const isCapture = isHighlight && squarePiece !== null;
                  const isLight = (columns.indexOf(col) + row) % 2 === 0;

                  return (
                    <div
                      key={key}
                      className={`square ${isLight ? 'light' : 'dark'} ${isSelected ? 'selected' : ''} ${isHighlight ? 'highlight' : ''} ${isCapture ? 'capture' : ''}`}
                      onClick={() => handleCellClick(pos)}
                    >
                      {squarePiece && (
                        <span className={squarePiece.color === 'white' ? 'piece-white' : 'piece-black'}>
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

        <div className="info-panel">
          <div className={`status ${gameState.status === 'finished' ? 'game-over' : gameState.currentTurn === 'white' ? 'turn-white' : 'turn-black'}`}>
            {gameState.status === 'finished' 
              ? `XEQUE-MATE! ${gameState.winner === 'white' ? 'BRANCAS' : 'PRETAS'} VENCERAM!`
              : `Vez das ${gameState.currentTurn === 'white' ? 'Brancas' : 'Pretas'}`}
          </div>

          <div className="message">
            {swapMode 
              ? 'Modo Troca: Selecione o Rei e o Príncipe para trocar'
              : selectedPos 
                ? `Peça selecionada: ${positionToString(selectedPos)} ${piece ? `(${piece.type})` : ''}`
                : gameState.lastMove
                  ? `Última jogada: ${positionToString(gameState.lastMove.from)} → ${positionToString(gameState.lastMove.to)}`
                  : 'Selecione uma peça para mover'}
          </div>

          <div className="swap-controls">
            <button
              className={`swap-btn ${swapMode ? 'active' : ''}`}
              onClick={handleSwapMode}
              disabled={!canSwap || gameState.status === 'finished' || gameState.currentTurn !== currentPlayerColor}
            >
              {swapMode 
                ? 'Cancelar Troca'
                : gameState.currentTurn === 'white'
                  ? `Troca Rei-Príncipe BRANCAS: ${gameState.whiteKingSwapped ? 'Usado' : 'Disponível'}`
                  : `Troca Rei-Príncipe PRETAS: ${gameState.blackKingSwapped ? 'Usado' : 'Disponível'}`}
            </button>
          </div>

          <button className="reset-btn" onClick={() => window.location.reload()}>
            Reiniciar Jogo
          </button>

          <div className="rules">
            <strong>OBJETIVO:</strong> Capturar o Príncipe inimigo (cheque-mate)<br />
            <strong>TROCA ESPECIAL:</strong> Rei pode trocar com Príncipe 1x por jogo<br />
            <strong>GENERAL:</strong> Move 1 casa nas direções cardinais + 2 casas nas diagonais<br />
            <strong>REI:</strong> Move 2 casas ortogonalmente + 1 casa diagonal<br />
            <strong>PRÍNCIPE:</strong> Move 1 casa em qualquer direção
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

function getPieceEmoji(type: string, color: string): string {
  const pieces: Record<string, { white: string; black: string }> = {
    pawn: { white: '♙', black: '♟' },
    rook: { white: '♖', black: '♜' },
    knight: { white: '♘', black: '♞' },
    bishop: { white: '♗', black: '♝' },
    queen: { white: '♕', black: '♛' },
    king: { white: '♔', black: '♚' },
    prince: { white: '🤴', black: '🤴' },
    general: { white: '⚔️', black: '⚔️' },
  };
  return pieces[type]?.[color as 'white' | 'black'] || '?';
}

