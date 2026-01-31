import { useState } from 'react';

interface LoginProps {
  onLogin: (email: string) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      onLogin(email);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <div style={{ background: '#2a2a2a', padding: '2rem', borderRadius: '8px', minWidth: '300px' }}>
        <h1 style={{ marginBottom: '1rem' }}>PrinceFall Game</h1>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              marginBottom: '1rem',
              borderRadius: '4px',
              border: '1px solid #444',
              background: '#1a1a1a',
              color: '#fff',
            }}
          />
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '4px',
              border: 'none',
              background: '#4a9eff',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}

