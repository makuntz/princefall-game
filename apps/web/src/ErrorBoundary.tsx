import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: '2rem',
            maxWidth: '720px',
            margin: '2rem auto',
            background: '#2a1a1a',
            color: '#fff',
            borderRadius: '12px',
            border: '1px solid #f44336',
            fontFamily: 'monospace',
            fontSize: '14px',
          }}
        >
          <h1 style={{ color: '#f44336', marginBottom: '1rem' }}>Erro ao carregar a interface</h1>
          <p style={{ marginBottom: '1rem', lineHeight: 1.5 }}>
            Abra o console do navegador (F12 → Console) para o stack completo. Em desenvolvimento, o
            detalhe abaixo ajuda a achar a causa.
          </p>
          <pre
            style={{
              overflow: 'auto',
              padding: '1rem',
              background: '#111',
              borderRadius: '8px',
              whiteSpace: 'pre-wrap',
            }}
          >
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button
            type="button"
            style={{
              marginTop: '1.5rem',
              padding: '0.75rem 1.25rem',
              cursor: 'pointer',
              borderRadius: '8px',
              border: 'none',
              background: '#4a9eff',
              color: '#fff',
              fontWeight: 'bold',
            }}
            onClick={() => window.location.reload()}
          >
            Recarregar página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
