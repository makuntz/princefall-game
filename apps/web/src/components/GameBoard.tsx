import { useState, useEffect } from 'react';
import { api } from '../api';
import { GameState, Position, deserializeState } from '@princefall/game-core';
import { positionToString } from '@princefall/game-core';

interface GameBoardProps {
  gameId: string;
  token: string;
  onBack: () => void;
}

export function GameBoard({ gameId, token, onBack }: GameBoardProps) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const [loading, setLoading] = useState(false);
  const [gameInfo, setGameInfo] = useState<any>(null);

  useEffect(() => {
    loadGame();
    const interval = setInterval(loadGame, 2000); // Polling a cada 2s
    return () => clearInterval(interval);
  }, [gameId]);

  const loadGame = async () => {
    try {
      const res = await api.get(`/games/${gameId}`, { token });
      setGameInfo(res.game);
      setGameState(deserializeState(res.gameState));
    } catch (err) {
      console.error('Error loading game:', err);
    }
  };

  const handleCellClick = async (pos: Position) => {
    if (!gameState || gameState.status !== 'playing') return;

    if (selectedPos) {
      // Tentar fazer movimento
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

  if (!gameState || !gameInfo) {
    return <div>Carregando...</div>;
  }

  const columns = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
  const rows = [9, 8, 7, 6, 5, 4, 3, 2, 1];

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <button onClick={onBack} style={{ marginBottom: '1rem', padding: '0.5rem 1rem' }}>
        ← Voltar
      </button>

      <div style={{ marginBottom: '1rem' }}>
        <div>Status: {gameState.status}</div>
        <div>Turno: {gameState.currentTurn === 'white' ? 'Brancas' : 'Pretas'}</div>
        {gameState.status === 'finished' && gameState.winner && (
          <div>Vencedor: {gameState.winner === 'white' ? 'Brancas' : 'Pretas'}</div>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(9, 50px)',
          gap: '2px',
          background: '#444',
          padding: '2px',
        }}
      >
        {rows.map((row) =>
          columns.map((col) => {
            const pos: Position = { col: col as any, row };
            const key = positionToString(pos);
            const piece = gameState.board.get(key);
            const isSelected = selectedPos && selectedPos.col === col && selectedPos.row === row;
            const isLight = (columns.indexOf(col) + row) % 2 === 0;

            return (
              <div
                key={key}
                onClick={() => {
                  if (gameState.status === 'setup') {
                    handleSetupGeneral(pos);
                  } else {
                    handleCellClick(pos);
                  }
                }}
                style={{
                  width: '50px',
                  height: '50px',
                  background: isSelected
                    ? '#4a9eff'
                    : isLight
                    ? '#f0d9b5'
                    : '#b58863',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                {piece && (
                  <span style={{ fontSize: '32px' }}>
                    {getPieceEmoji(piece.type, piece.color)}
                  </span>
                )}
                {row === 9 && (
                  <span style={{ position: 'absolute', bottom: '2px', left: '2px', fontSize: '10px' }}>
                    {col}
                  </span>
                )}
                {col === 'A' && (
                  <span style={{ position: 'absolute', top: '2px', right: '2px', fontSize: '10px' }}>
                    {row}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {loading && <div style={{ marginTop: '1rem' }}>Processando...</div>}
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
    prince: { white: '👑', black: '👑' },
    general: { white: '⚔️', black: '⚔️' },
  };
  return pieces[type]?.[color as 'white' | 'black'] || '?';
}

