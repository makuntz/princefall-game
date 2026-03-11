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
  onJoinGameByCode?: (gameId: string) => void;
  onOpenLeaderboard?: () => void;
}

export function GameList({ token, onCreateGame, onJoinGame, onSelectGame, onJoinGameByCode, onOpenLeaderboard }: GameListProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    loadGames();
    const interval = setInterval(loadGames, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadGames = async () => {
    try {
      setError(null);
      const res = await api.get('/games', { token });
      setGames(res.games || []);
    } catch (err) {
      console.error('Error loading games:', err);
      setError('Erro ao carregar partidas');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGame = async () => {
    setCreating(true);
    try {
      await onCreateGame();
    } catch (err) {
      console.error('Error creating game:', err);
      alert('Erro ao criar partida');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinByCode = async () => {
    if (!joinCode.trim()) {
      alert('Por favor, insira um código de convite');
      return;
    }

    setJoining(true);
    try {
      const code = joinCode.toUpperCase().trim();
      const res = await api.post('/games/join-by-code', { inviteCode: code }, { token });
      
      if (onJoinGameByCode) {
        onJoinGameByCode(res.game.id);
      } else {
        await onJoinGame(res.game.id, code);
      }
    } catch (err: any) {
      console.error('Error joining game:', err);
      let errorMessage = 'Erro ao entrar na partida';
      if (err.message) {
        errorMessage = err.message;
      } else if (err.response) {
        try {
          const errorData = await err.response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = `Erro ${err.response.status}: ${err.response.statusText}`;
        }
      }
      alert(errorMessage);
    } finally {
      setJoining(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', minHeight: '100vh', background: '#1a1a1a' }}>
      <h1 style={{ marginBottom: '2rem', color: '#fff' }}>Minhas Partidas</h1>

      {error && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#ff4444', color: '#fff', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <button
          onClick={handleCreateGame}
          disabled={creating}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '4px',
            border: 'none',
            background: creating ? '#666' : '#4a9eff',
            color: '#fff',
            cursor: creating ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            opacity: creating ? 0.7 : 1,
          }}
        >
          {creating ? 'Criando...' : 'Nova Partida Online'}
        </button>
        {!import.meta.env.PROD && (
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
        )}
        {/* {onOpenLeaderboard && (
          <button
            onClick={onOpenLeaderboard}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '4px',
              border: 'none',
              background: '#FFD700',
              color: '#000',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            🏆 Ranking
          </button>
        )} */}

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
            disabled={joining || !joinCode.trim()}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '4px',
              border: 'none',
              background: joining || !joinCode.trim() ? '#666' : '#2a7a2a',
              color: '#fff',
              cursor: joining || !joinCode.trim() ? 'not-allowed' : 'pointer',
              opacity: joining || !joinCode.trim() ? 0.7 : 1,
            }}
          >
            {joining ? 'Entrando...' : 'Entrar'}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#aaa' }}>
          Carregando partidas...
        </div>
      ) : games.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#aaa' }}>
          <p>Nenhuma partida encontrada.</p>
          <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
            Crie uma nova partida ou entre com um código de convite.
          </p>
        </div>
      ) : (
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
      )}
    </div>
  );
}

