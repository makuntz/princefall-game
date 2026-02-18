import { useState, useEffect } from 'react';
import { GameBoard } from './components/GameBoard';
import { Login } from './components/Login';
import { GameList } from './components/GameList';
import { api } from './api';

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [view, setView] = useState<'login' | 'list' | 'game'>('login');

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

  const handleCreateGame = () => {
    if (!token) return;
    api.post('/games', {}, { token })
      .then((res) => {
        setCurrentGameId(res.game.id);
        setView('game');
      })
      .catch((err) => {
        console.error('Create game error:', err);
        alert('Erro ao criar partida');
      });
  };

  const handleJoinGame = (gameId: string, inviteCode: string) => {
    if (!token) return;
    api.post(`/games/${gameId}/join`, { inviteCode }, { token })
      .then(() => {
        setCurrentGameId(gameId);
        setView('game');
      })
      .catch((err) => {
        console.error('Join game error:', err);
        alert('Erro ao entrar na partida');
      });
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

  return null;
}

export default App;

