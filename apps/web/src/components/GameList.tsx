import { useState, useEffect } from 'react';
import { api } from '../api';
import './game/GameStyles.css';

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

export function GameList({ token, onCreateGame, onJoinGame, onSelectGame, onJoinGameByCode, /*onOpenLeaderboard*/ }: GameListProps) {
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
    <div className="game-list-page">
      <h1 className="game-list-title">Minhas Partidas</h1>

      {error && <div className="game-list-error">{error}</div>}

      <div className="game-list-toolbar">
        <div className="game-list-actions-row">
          <button
            type="button"
            className="game-list-btn game-list-btn--primary"
            onClick={handleCreateGame}
            disabled={creating}
          >
            {creating ? 'Criando...' : 'Nova Partida Online'}
          </button>
          {!import.meta.env.PROD && (
            <button
              type="button"
              className="game-list-btn game-list-btn--outline"
              onClick={() => {
                const event = new CustomEvent('startLocalGame');
                window.dispatchEvent(event);
              }}
            >
              🎮 Jogar local (teste)
            </button>
          )}
        </div>

        <div className="game-list-invite">
          <input
            type="text"
            className="game-list-input"
            placeholder="Código de convite"
            aria-label="Digite o código de convite para entrar numa partida"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
          />
          <button
            type="button"
            className="game-list-btn game-list-btn--primary game-list-btn--compact"
            onClick={handleJoinByCode}
            disabled={joining || !joinCode.trim()}
          >
            {joining ? 'Entrando...' : 'Entrar'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="game-list-loading">Carregando partidas...</div>
      ) : games.length === 0 ? (
        <div className="game-list-empty">
          <p>Nenhuma partida encontrada.</p>
          <p className="game-list-empty-hint">Crie uma nova partida ou entre com um código de convite.</p>
        </div>
      ) : (
        <div className="game-list-cards">
          {games.map((game) => (
            <div
              key={game.id}
              role="button"
              tabIndex={0}
              className="game-list-card"
              onClick={() => onSelectGame(game.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectGame(game.id);
                }
              }}
            >
              <div className="game-list-card-inner">
                <div>
                  <div className="game-list-card-line">
                    <strong>Brancas:</strong> {game.whitePlayer.username}
                  </div>
                  <div className="game-list-card-line">
                    <strong>Pretas:</strong> {game.blackPlayer?.username || 'Aguardando...'}
                  </div>
                  <div className="game-list-card-meta">
                    Status: {game.status} | Código: {game.inviteCode}
                  </div>
                </div>
                <span className="game-list-card-arrow" aria-hidden>
                  →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

