import { useState } from 'react';
import { createInitialState, applyAction, GameState, GameAction, Position, getLegalMoves, positionToString } from '@princefall/game-core';
import { SetupScreen } from './game/SetupScreen';
import { CoinflipScreen } from './game/CoinflipScreen';
import './game/GameStyles.css';

type GamePhase = 'setup-white' | 'setup-black' | 'coinflip' | 'playing' | 'finished';

export function LocalGame({ onBack }: { onBack: () => void }) {
  const [gameState, setGameState] = useState<GameState>(createInitialState());
  const [phase, setPhase] = useState<GamePhase>('setup-white');
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const [swapMode, setSwapMode] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState<'white' | 'black'>('white');

  const handleSetupWhite = (pos: Position) => {
    const action: GameAction = {
      type: 'SETUP_GENERAL',
      payload: { position: pos },
      playerColor: 'white',
    };
    const newState = applyAction(gameState, action);
    setGameState(newState);
    setPhase('setup-black');
  };

  const handleSetupBlack = (pos: Position) => {
    const action: GameAction = {
      type: 'SETUP_GENERAL',
      payload: { position: pos },
      playerColor: 'black',
    };
    const newState = applyAction(gameState, action);
    setGameState(newState);
    setPhase('coinflip');
  };

  const handleCoinflipResult = (starter: 'white' | 'black') => {
    // Atualizar o currentTurn no gameState
    const updatedState = {
      ...gameState,
      currentTurn: starter,
    };
    setGameState(updatedState);
    setCurrentPlayer(starter);
    setPhase('playing');
  };

  const handleCellClick = (pos: Position) => {
    if (gameState.status !== 'playing' || phase !== 'playing') return;
    
    // Garantir sincronização entre currentPlayer e gameState.currentTurn
    if (currentPlayer !== gameState.currentTurn) {
      console.warn('Sincronizando currentPlayer com gameState.currentTurn');
      setCurrentPlayer(gameState.currentTurn);
    }

    if (swapMode) {
      handleSwapClick(pos);
      return;
    }

    if (selectedPos) {
      // Fazer movimento
      const legalMoves = getLegalMoves(gameState, selectedPos);
      const isValidMove = legalMoves.some(m => m.col === pos.col && m.row === pos.row);

      if (!isValidMove) {
        alert('Movimento inválido!');
        setSelectedPos(null);
        return;
      }

      const action: GameAction = {
        type: 'MOVE',
        payload: {
          move: {
            from: selectedPos,
            to: pos,
          },
        },
        playerColor: currentPlayer,
      };

      const newState = applyAction(gameState, action);
      setGameState(newState);
      setSelectedPos(null);

      // Alternar jogador
      if (newState.status === 'playing') {
        setCurrentPlayer(newState.currentTurn);
      } else {
        setPhase('finished');
      }
    } else {
      // Selecionar peça
      const piece = gameState.board.get(positionToString(pos));
      if (piece && piece.color === currentPlayer) {
        setSelectedPos(pos);
      }
    }
  };

  const handleSwapClick = (pos: Position) => {
    if (!selectedPos) return;

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
      piece1.color === currentPlayer;

    if (!isKingAndPrince) {
      alert('Selecione o Rei e o Príncipe do mesmo jogador para trocar!');
      setSelectedPos(null);
      setSwapMode(false);
      return;
    }

    const canSwap = currentPlayer === 'white' 
      ? !gameState.whiteKingSwapped 
      : !gameState.blackKingSwapped;

    if (!canSwap) {
      alert('Você já usou sua troca neste jogo!');
      setSelectedPos(null);
      setSwapMode(false);
      return;
    }

    const action: GameAction = {
      type: 'SWAP_KING_PRINCE',
      payload: {
        swapFrom: selectedPos,
        swapTo: pos,
      },
      playerColor: currentPlayer,
    };

    const newState = applyAction(gameState, action);
    setGameState(newState);
    setSelectedPos(null);
    setSwapMode(false);

    if (newState.status === 'playing') {
      setCurrentPlayer(newState.currentTurn);
    }
  };

  const handleSwapMode = () => {
    if (gameState.status !== 'playing') return;
    
    const canSwap = currentPlayer === 'white' 
      ? !gameState.whiteKingSwapped 
      : !gameState.blackKingSwapped;

    if (!canSwap) {
      alert('Você já usou sua troca neste jogo!');
      return;
    }

    setSwapMode(true);
    setSelectedPos(null);
  };

  const columns: Array<'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I'> = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
  const rows: Array<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9> = [9, 8, 7, 6, 5, 4, 3, 2, 1];

  if (phase === 'setup-white') {
    return (
      <div className="game-container">
        <button className="back-btn" onClick={onBack}>← Voltar</button>
        <SetupScreen
          playerColor="white"
          onConfirm={handleSetupWhite}
          waiting={false}
        />
      </div>
    );
  }

  if (phase === 'setup-black') {
    return (
      <div className="game-container">
        <button className="back-btn" onClick={onBack}>← Voltar</button>
        <SetupScreen
          playerColor="black"
          onConfirm={handleSetupBlack}
          waiting={false}
        />
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
  const canSwapButton = gameState.status === 'playing' &&
    (currentPlayer === 'white' ? !gameState.whiteKingSwapped : !gameState.blackKingSwapped);
  const legalMoves = selectedPos && !swapMode ? getLegalMoves(gameState, selectedPos) : [];

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
          <div className={`status ${gameState.status === 'finished' ? 'game-over' : currentPlayer === 'white' ? 'turn-white' : 'turn-black'}`}>
            {gameState.status === 'finished' 
              ? `XEQUE-MATE! ${gameState.winner === 'white' ? 'BRANCAS' : 'PRETAS'} VENCERAM!`
              : `Vez das ${currentPlayer === 'white' ? 'Brancas' : 'Pretas'}`}
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
              disabled={!canSwapButton || gameState.status === 'finished'}
            >
              {swapMode 
                ? 'Cancelar Troca'
                : currentPlayer === 'white'
                  ? `Troca Rei-Príncipe BRANCAS: ${gameState.whiteKingSwapped ? 'Usado' : 'Disponível'}`
                  : `Troca Rei-Príncipe PRETAS: ${gameState.blackKingSwapped ? 'Usado' : 'Disponível'}`}
            </button>
          </div>

          <button className="reset-btn" onClick={() => window.location.reload()}>
            Reiniciar Jogo
          </button>

          <div className="rules">
            <strong>OBJETIVO:</strong> Capturar o Príncipe inimigo<br />
            <strong>TROCA ESPECIAL:</strong> Rei pode trocar com Príncipe 1x por jogo<br />
            <br />
            <strong>MOVIMENTOS:</strong><br />
            • <strong>Peão:</strong> 1 casa frente (2 na primeira), captura diagonal<br />
            • <strong>Torre:</strong> Linha reta (horizontal/vertical)<br />
            • <strong>Bispo:</strong> Diagonal<br />
            • <strong>Dama:</strong> Linha reta OU diagonal<br />
            • <strong>Cavalo:</strong> Forma de "L" (pula peças)<br />
            • <strong>Rei:</strong> 2 casas ortogonal + 1 diagonal<br />
            • <strong>Príncipe:</strong> 1 casa qualquer direção<br />
            • <strong>General:</strong> 1 casa cardinais + 2 casas diagonais<br />
            <br />
            <strong>💡 DICA:</strong> Clique na peça para ver movimentos válidos!
          </div>
        </div>
      </div>
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

