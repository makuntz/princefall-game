import { useState, useEffect } from 'react';
import { GameBoard } from './components/game/GameBoard';
import { Login } from './components/Login';
import { GameList } from './components/GameList';
import { LocalGame } from './components/LocalGame';
import { Leaderboard } from './components/Leaderboard';
import { ModeSelectionScreen, type LocalPlayChoice } from './components/game/ModeSelectionScreen';
import { api } from './api';

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [view, setView] = useState<
    'login' | 'list' | 'game' | 'local' | 'leaderboard' | 'pickOnlineMode'
  >('login');
  const [creatingOnline, setCreatingOnline] = useState(false);

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

  const handleLogin = (email: string) => {
    api.post('/auth/login', { email })
      .then((res) => {
        setToken(res.token);
        localStorage.setItem('token', res.token);
        setView('list');
      })
      .catch((err) => {
        console.error('Login error:', err);
        alert('Erro ao fazer login');
      });
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

  if (view === 'login') {
    return <Login onLogin={handleLogin} />;
  }

  if (view === 'list') {
    return (
      <GameList
        token={token!}
        onCreateGame={handleStartCreateOnline}
        onJoinGame={handleJoinGame}
        onJoinGameByCode={handleJoinGameByCode}
        onOpenLeaderboard={handleOpenLeaderboard}
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

