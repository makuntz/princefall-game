// API URL: usa variável de ambiente em produção, ou proxy local em dev
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

interface RequestOptions {
  token?: string;
  /** Evita disparar logout global em rotas públicas sem sessão */
  skipSessionRedirect?: boolean;
}

function dispatchSessionExpired() {
  window.dispatchEvent(new CustomEvent('auth:session-expired'));
}

async function parseJsonResponse(
  res: Response,
  options: RequestOptions,
): Promise<unknown> {
  if (res.status === 401 && options.token && !options.skipSessionRedirect) {
    dispatchSessionExpired();
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error((error as { error?: string }).error || 'Request failed');
  }

  return res.json();
}

export const api = {
  async get(endpoint: string, options: RequestOptions = {}) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'GET',
      headers,
    });

    return parseJsonResponse(res, options) as Promise<any>;
  },

  async post(endpoint: string, data: unknown, options: RequestOptions = {}) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    return parseJsonResponse(res, options) as Promise<any>;
  },

  async patch(endpoint: string, data: unknown, options: RequestOptions = {}) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data),
    });

    return parseJsonResponse(res, options) as Promise<any>;
  },
};
