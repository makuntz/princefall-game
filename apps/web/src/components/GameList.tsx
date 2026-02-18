import { useState, useEffect } from 'react';
import { api } from '../api';

interface Game {
  id: string;
  status: string;
  whitePlayer: { id: string; username: string };
  blackPlayer: { id: string; username: string } | null;
  inviteCode: string;
}

interface GameListProps {
  token: string;
  onCreateGame: () => void;
  onJoinGame: (gameId: string, inviteCode: string) => void;
  onSelectGame: (gameId: string) => void;
}

export function GameList({ token, onCreateGame, onJoinGame, onSelectGame }: GameListProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    loadGames();
  }, []);

  const loadGames = async () => {
    try {
      const res = await api.get('/games', { token });
      setGames(res.games);
    } catch (err) {
      console.error('Error loading games:', err);
    }
  };

  const handleJoinByCode = () => {
    // Tentar encontrar jogo pelo código
    const game = games.find((g) => g.inviteCode === joinCode.toUpperCase());
    if (game) {
      onJoinGame(game.id, joinCode.toUpperCase());
    } else {
      alert('Código inválido');
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem' }}>Minhas Partidas</h1>

      <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <button
          onClick={onCreateGame}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '4px',
            border: 'none',
            background: '#4a9eff',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          Nova Partida Online
        </button>
        <button
          onClick={() => {
            const event = new CustomEvent('startLocalGame');
            window.dispatchEvent(event);
          }}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '4px',
            border: 'none',
            background: '#4CAF50',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          🎮 Jogar Local (Teste)
        </button>

        <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
          <input
            type="text"
            placeholder="Código de convite"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            style={{
              flex: 1,
              padding: '0.75rem',
              borderRadius: '4px',
              border: '1px solid #444',
              background: '#1a1a1a',
              color: '#fff',
            }}
          />
          <button
            onClick={handleJoinByCode}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '4px',
              border: 'none',
              background: '#2a7a2a',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Entrar
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {games.map((game) => (
          <div
            key={game.id}
            onClick={() => onSelectGame(game.id)}
            style={{
              padding: '1rem',
              background: '#2a2a2a',
              borderRadius: '4px',
              cursor: 'pointer',
              border: '1px solid #444',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div>
                  <strong>Brancas:</strong> {game.whitePlayer.username}
                </div>
                <div>
                  <strong>Pretas:</strong> {game.blackPlayer?.username || 'Aguardando...'}
                </div>
                <div style={{ marginTop: '0.5rem', color: '#aaa' }}>
                  Status: {game.status} | Código: {game.inviteCode}
                </div>
              </div>
              <div style={{ color: '#4a9eff' }}>→</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

