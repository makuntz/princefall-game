import { useState, useEffect } from 'react';
import { GameBoard } from './components/game/GameBoard';
import { Login, type RegisterPayload } from './components/Login';
import { GameList } from './components/GameList';
import { LocalGame } from './components/LocalGame';
import { Leaderboard } from './components/Leaderboard';
import { ModeSelectionScreen, type LocalPlayChoice } from './components/game/ModeSelectionScreen';
import { EditProfile } from './components/EditProfile';
import { api } from './api';

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [view, setView] = useState<
    'login' | 'list' | 'game' | 'local' | 'leaderboard' | 'pickOnlineMode' | 'profile'
  >('login');
  const [creatingOnline, setCreatingOnline] = useState(false);
  const [sessionBanner, setSessionBanner] = useState<string | null>(null);
  /** Incrementado após confirmar e-mail pela URL — força GameList a atualizar /auth/me */
  const [emailVerifyNonce, setEmailVerifyNonce] = useState(0);

  useEffect(() => {
    const onExpired = () => {
      localStorage.removeItem('token');
      setToken(null);
      setCurrentGameId(null);
      setView('login');
      setSessionBanner('Sessão expirada ou inválida. Entre novamente.');
    };
    window.addEventListener('auth:session-expired', onExpired);
    return () => window.removeEventListener('auth:session-expired', onExpired);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get('verifyEmail');
    if (!verifyToken) return undefined;

    let cancelled = false;
    (async () => {
      try {
        await api.post('/auth/verify-email', { token: verifyToken }, { skipSessionRedirect: true });
        params.delete('verifyEmail');
        const q = params.toString();
        window.history.replaceState(
          {},
          '',
          `${window.location.pathname}${q ? `?${q}` : ''}${window.location.hash}`,
        );
        if (!cancelled) {
          setSessionBanner('E-mail confirmado com sucesso.');
          setEmailVerifyNonce((n) => n + 1);
        }
      } catch (e) {
        if (!cancelled) {
          setSessionBanner(e instanceof Error ? e.message : 'Não foi possível confirmar o e-mail.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (token) {
      // Verificar se token é válido
      api.get('/auth/me', { token })
        .then(() => {
          setView('list');
        })
        .catch(() => {
          localStorage.removeItem('token');
          setToken(null);
        });
    }

    // Listener para modo local
    const handleLocalGame = () => {
      setView('local');
    };
    window.addEventListener('startLocalGame', handleLocalGame);
    return () => window.removeEventListener('startLocalGame', handleLocalGame);
  }, [token]);

  const handleLogin = async (email: string) => {
    const res = await api.post('/auth/login', { email });
    setToken(res.token);
    localStorage.setItem('token', res.token);
    setView('list');
  };

  const handleRegister = async (data: RegisterPayload) => {
    const res = (await api.post('/auth/register', data)) as {
      token: string;
      devVerificationUrl?: string;
    };
    setToken(res.token);
    localStorage.setItem('token', res.token);
    if (res.devVerificationUrl) {
      setSessionBanner(
        'Sem envio de e-mail (BREVO_API_KEY não configurada no servidor). Confirme sua conta abrindo: ' +
          res.devVerificationUrl,
      );
    } else {
      setSessionBanner(null);
    }
    setView('list');
  };

  const handleStartCreateOnline = () => {
    setView('pickOnlineMode');
  };

  const handlePickOnlineMode = async (mode: LocalPlayChoice) => {
    if (!token) {
      console.warn('Cannot create game: no token');
      return;
    }
    setCreatingOnline(true);
    try {
      const res = await api.post('/games', { gameMode: mode }, { token });
      setCurrentGameId(res.game.id);
      setView('game');
    } catch (err) {
      console.error('Create game error:', err);
      alert('Erro ao criar partida');
    } finally {
      setCreatingOnline(false);
    }
  };

  const handleJoinGame = async (gameId: string, inviteCode: string) => {
    if (!token) {
      console.warn('Cannot join game: no token');
      return;
    }
    try {
      await api.post(`/games/${gameId}/join`, { inviteCode }, { token });
      setCurrentGameId(gameId);
      setView('game');
    } catch (err) {
      console.error('Join game error:', err);
      alert('Erro ao entrar na partida');
    }
  };

  // Handler para quando já entrou via join-by-code (não precisa chamar join novamente)
  const handleJoinGameByCode = (gameId: string) => {
    setCurrentGameId(gameId);
    setView('game');
  };

  const handleOpenLeaderboard = () => {
    setView('leaderboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setCurrentGameId(null);
    setSessionBanner(null);
    setView('login');
  };

  if (view === 'login') {
    return (
      <Login
        onLogin={handleLogin}
        onRegister={handleRegister}
        sessionBanner={sessionBanner}
        onDismissSessionBanner={() => setSessionBanner(null)}
      />
    );
  }

  if (view === 'list') {
    return (
      <GameList
        token={token!}
        emailVerifyNonce={emailVerifyNonce}
        onCreateGame={handleStartCreateOnline}
        onJoinGame={handleJoinGame}
        onJoinGameByCode={handleJoinGameByCode}
        onOpenLeaderboard={handleOpenLeaderboard}
        onOpenProfile={() => setView('profile')}
        onLogout={handleLogout}
        sessionNotice={sessionBanner}
        onDismissSessionNotice={() => setSessionBanner(null)}
        onSelectGame={(gameId) => {
          setCurrentGameId(gameId);
          setView('game');
        }}
      />
    );
  }

  if (view === 'pickOnlineMode') {
    return (
      <>
        <ModeSelectionScreen
          onSelectMode={handlePickOnlineMode}
          onBack={() => setView('list')}
        />
        {creatingOnline && (
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(0,0,0,0.85)',
              color: '#f4e5c3',
              padding: '20px 28px',
              borderRadius: '12px',
              border: '2px solid #d4af37',
              zIndex: 9999,
              fontFamily: 'Cinzel, serif',
            }}
          >
            Criando partida...
          </div>
        )}
      </>
    );
  }

  if (view === 'profile') {
    return <EditProfile token={token!} onBack={() => setView('list')} />;
  }

  if (view === 'leaderboard') {
    return (
      <Leaderboard
        token={token!}
        onBack={() => setView('list')}
      />
    );
  }

  if (view === 'game' && currentGameId) {
    return (
      <GameBoard
        gameId={currentGameId}
        token={token!}
        onBack={() => setView('list')}
        onOpenLeaderboard={handleOpenLeaderboard}
      />
    );
  }

  if (view === 'local') {
    return <LocalGame onBack={() => setView('list')} />;
  }

  // Fallback: should not reach here, but provide a safe default
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <p>Estado inválido. Por favor, recarregue a página.</p>
      <button onClick={() => setView('login')}>Voltar ao Login</button>
    </div>
  );
}

export default App;

