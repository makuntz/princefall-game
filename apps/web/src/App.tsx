import { useState, useEffect } from 'react';
import { GameBoard } from './components/game/GameBoard';
import { Login } from './components/Login';
import { GameList } from './components/GameList';
import { LocalGame } from './components/LocalGame';
import { api } from './api';

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [view, setView] = useState<'login' | 'list' | 'game' | 'local'>('login');

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

  const handleCreateGame = async () => {
    if (!token) {
      console.warn('Cannot create game: no token');
      return;
    }
    try {
      const res = await api.post('/games', {}, { token });
      setCurrentGameId(res.game.id);
      setView('game');
    } catch (err) {
      console.error('Create game error:', err);
      alert('Erro ao criar partida');
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

  if (view === 'login') {
    return <Login onLogin={handleLogin} />;
  }

  if (view === 'list') {
    return (
      <GameList
        token={token!}
        onCreateGame={handleCreateGame}
        onJoinGame={handleJoinGame}
        onJoinGameByCode={handleJoinGameByCode}
        onSelectGame={(gameId) => {
          setCurrentGameId(gameId);
          setView('game');
        }}
      />
    );
  }

  if (view === 'game' && currentGameId) {
    return (
      <GameBoard
        gameId={currentGameId}
        token={token!}
        onBack={() => setView('list')}
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

