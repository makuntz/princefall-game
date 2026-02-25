import { useState } from 'react';

interface LoginProps {
  onLogin: (email: string) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError('Por favor, insira um email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Por favor, insira um email válido');
      return;
    }

    setLoading(true);
    onLogin(email);
    setTimeout(() => setLoading(false), 1000);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#1a1a1a' }}>
      <div style={{ background: '#2a2a2a', padding: '2rem', borderRadius: '8px', minWidth: '300px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)' }}>
        <h1 style={{ marginBottom: '1rem', color: '#fff', textAlign: 'center' }}>PrinceFall Game</h1>
        <p style={{ marginBottom: '1.5rem', color: '#aaa', textAlign: 'center', fontSize: '0.9rem' }}>
          Jogo de xadrez customizado 9x9
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              marginBottom: error ? '0.5rem' : '1rem',
              borderRadius: '4px',
              border: error ? '1px solid #ff4444' : '1px solid #444',
              background: '#1a1a1a',
              color: '#fff',
              boxSizing: 'border-box',
            }}
          />
          {error && (
            <div style={{ marginBottom: '1rem', color: '#ff4444', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '4px',
              border: 'none',
              background: loading ? '#666' : '#4a9eff',
              color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

