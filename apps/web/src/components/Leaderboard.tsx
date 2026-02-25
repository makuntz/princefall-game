import { useState, useEffect } from 'react';
import { api } from '../api';

interface LeaderboardItem {
  rank: number;
  userId: string;
  username: string;
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
}

interface LeaderboardProps {
  token: string;
  onBack: () => void;
}

export function Leaderboard({ token, onBack }: LeaderboardProps) {
  const [items, setItems] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    try {
      setError(null);
      const res = await api.get('/leaderboard?limit=100', { token });
      setItems(res.leaderboard || []);
    } catch (err: any) {
      console.error('Error loading leaderboard:', err);
      setError('Erro ao carregar ranking');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', marginBottom: '1rem' }}>Carregando ranking...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>
        <button onClick={onBack}>Voltar</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <button 
        onClick={onBack}
        style={{
          marginBottom: '2rem',
          padding: '10px 20px',
          background: '#4a9eff',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '14px'
        }}
      >
        ← Voltar
      </button>

      <h1 style={{ fontSize: '32px', marginBottom: '2rem', textAlign: 'center' }}>
        🏆 Ranking
      </h1>

      <div style={{
        background: '#1a1a1a',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid #333'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#2a2a2a', borderBottom: '2px solid #4a9eff' }}>
              <th style={{ padding: '12px', textAlign: 'left', color: '#fff' }}>#</th>
              <th style={{ padding: '12px', textAlign: 'left', color: '#fff' }}>Username</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#fff' }}>Rating</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#fff' }}>W</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#fff' }}>L</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#fff' }}>D</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#fff' }}>Games</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr 
                key={item.userId}
                style={{
                  borderBottom: '1px solid #333',
                  background: index % 2 === 0 ? '#1a1a1a' : '#222'
                }}
              >
                <td style={{ padding: '12px', color: '#fff', fontWeight: 'bold' }}>
                  {item.rank}
                </td>
                <td style={{ padding: '12px', color: '#fff' }}>{item.username}</td>
                <td style={{ padding: '12px', textAlign: 'center', color: '#4a9eff', fontWeight: 'bold' }}>
                  {item.rating}
                </td>
                <td style={{ padding: '12px', textAlign: 'center', color: '#4ade80' }}>
                  {item.wins}
                </td>
                <td style={{ padding: '12px', textAlign: 'center', color: '#f87171' }}>
                  {item.losses}
                </td>
                <td style={{ padding: '12px', textAlign: 'center', color: '#a3a3a3' }}>
                  {item.draws}
                </td>
                <td style={{ padding: '12px', textAlign: 'center', color: '#fff' }}>
                  {item.gamesPlayed}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#aaa' }}>
          Nenhum jogador no ranking ainda.
        </div>
      )}
    </div>
  );
}

