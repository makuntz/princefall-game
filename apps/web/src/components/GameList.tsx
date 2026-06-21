import { useState, useEffect } from 'react';
import { api } from '../api';
import './game/GameStyles.css';

interface Game {
  id: string;
  status?: string;
  phase?: string;
  whitePlayer: { id: string; username: string };
  blackPlayer: { id: string; username: string } | null;
  inviteCode: string;
}

interface SessionUser {
  emailVerifiedAt?: string | null;
}

interface GameListProps {
  token: string;
  /** Quando > 0 e muda, atualiza /auth/me para esconder o aviso de “reenviar link” após verificar e-mail */
  emailVerifyNonce?: number;
  onCreateGame: () => void;
  onJoinGame: (gameId: string, inviteCode: string) => void;
  onSelectGame: (gameId: string) => void;
  onJoinGameByCode?: (gameId: string) => void;
  onOpenLeaderboard?: () => void;
  onOpenProfile?: () => void;
  onLogout?: () => void;
  /** Aviso vindo do App (ex.: link de confirmação em dev sem BREVO_API_KEY) */
  sessionNotice?: string | null;
  onDismissSessionNotice?: () => void;
}

export function GameList({
  token,
  emailVerifyNonce = 0,
  onCreateGame,
  onJoinGame,
  onSelectGame,
  onJoinGameByCode,
  onOpenProfile,
  onLogout,
  sessionNotice,
  onDismissSessionNotice,
  /*onOpenLeaderboard*/
}: GameListProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [gamePendingDelete, setGamePendingDelete] = useState<Game | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refreshSessionUser = async () => {
    try {
      const res = await api.get('/auth/me', { token });
      setSessionUser(res.user ?? null);
    } catch {
      setSessionUser(null);
    }
  };

  useEffect(() => {
    refreshSessionUser();
  }, [token]);

  useEffect(() => {
    if (emailVerifyNonce > 0) {
      refreshSessionUser();
    }
  }, [emailVerifyNonce, token]);

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

  const handleResendVerification = async () => {
    try {
      const res = await api.post('/auth/resend-verification', {}, { token });
      await refreshSessionUser();
      let msg = (res as { message?: string }).message || 'Enviamos um novo link para seu e-mail.';
      if (import.meta.env.DEV && (res as { devVerificationUrl?: string }).devVerificationUrl) {
        console.info('[dev] Link de verificação:', (res as { devVerificationUrl?: string }).devVerificationUrl);
        msg += ' (veja também o console em modo dev.)';
      }
      alert(msg);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao reenviar.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!gamePendingDelete) return;

    setDeleting(true);
    try {
      await api.delete(`/games/${gamePendingDelete.id}`, { token });
      setGames(prev => prev.filter(g => g.id !== gamePendingDelete.id));
      setGamePendingDelete(null);
    } catch (err) {
      console.error('Error deleting game:', err);
      alert(err instanceof Error ? err.message : 'Erro ao excluir partida');
    } finally {
      setDeleting(false);
    }
  };

  const needsEmailVerify = sessionUser != null && !sessionUser.emailVerifiedAt;

  return (
    <div className="game-list-page">
      <header className="game-list-header">
        <h1 className="game-list-title">Minhas Partidas</h1>
        {(onOpenProfile || onLogout) && (
          <div className="game-list-header-actions">
            {onOpenProfile && (
              <button
                type="button"
                className="game-list-btn game-list-btn--outline game-list-profile-btn"
                onClick={onOpenProfile}
              >
                Meu perfil
              </button>
            )}
            {onLogout && (
              <button type="button" className="game-list-btn game-list-btn--outline" onClick={onLogout}>
                Sair
              </button>
            )}
          </div>
        )}
      </header>

      {sessionNotice && (
        <div className="game-list-notice" role="status">
          <p className="game-list-notice-text">{sessionNotice}</p>
          {onDismissSessionNotice && (
            <button type="button" className="game-list-notice-dismiss" onClick={onDismissSessionNotice}>
              Fechar
            </button>
          )}
        </div>
      )}

      {needsEmailVerify && (
        <div className="game-list-banner" role="status">
          <div className="game-list-banner-main">
            <strong>E-mail não confirmado.</strong>
            <span>
              Abra o link enviado para sua caixa de entrada (e spam). Sem BREVO_API_KEY no servidor, o link também
              aparece no terminal do backend em desenvolvimento.
            </span>
          </div>
          <button
            type="button"
            className="game-list-btn game-list-btn--outline game-list-btn--compact"
            onClick={handleResendVerification}
          >
            Reenviar link
          </button>
        </div>
      )}

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
          <button
            type="button"
            className="game-list-btn game-list-btn--outline"
            onClick={() => {
              const event = new CustomEvent('startLocalGame');
              window.dispatchEvent(event);
            }}
          >
            Jogar offline
          </button>
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
                    Status: {game.phase || game.status || '—'} | Código: {game.inviteCode}
                  </div>
                </div>
                <div className="game-list-card-actions">
                  <button
                    type="button"
                    className="game-list-card-delete"
                    aria-label={`Excluir partida ${game.inviteCode}`}
                    title="Excluir partida"
                    onClick={(e) => {
                      e.stopPropagation();
                      setGamePendingDelete(game);
                    }}
                  >
                    <svg
                      className="game-list-delete-icon"
                      viewBox="0 0 24 24"
                      aria-hidden
                      focusable="false"
                    >
                      <path
                        fill="currentColor"
                        d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                      />
                    </svg>
                  </button>
                  <span className="game-list-card-arrow" aria-hidden>
                    →
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {gamePendingDelete && (
        <div
          className="game-list-modal-backdrop"
          role="presentation"
          onClick={() => {
            if (!deleting) setGamePendingDelete(null);
          }}
        >
          <div
            className="game-list-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-game-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-game-title" className="game-list-modal-title">
              Excluir partida?
            </h2>
            <p className="game-list-modal-text">
              Tem certeza que deseja excluir esta partida? Esta ação não pode ser desfeita.
            </p>
            <p className="game-list-modal-meta">
              Código: <strong>{gamePendingDelete.inviteCode}</strong>
            </p>
            <div className="game-list-modal-actions">
              <button
                type="button"
                className="game-list-btn game-list-btn--outline"
                disabled={deleting}
                onClick={() => setGamePendingDelete(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="game-list-btn game-list-btn--danger"
                disabled={deleting}
                onClick={handleConfirmDelete}
              >
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

