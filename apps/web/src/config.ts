/** Origem do backend (sem /api). Em dev o OAuth não passa pelo proxy do Vite. */
export function getApiOrigin() {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }
  if (import.meta.env.DEV) {
    return 'http://localhost:3001';
  }
  return window.location.origin;
}

export function getGoogleLoginUrl() {
  return `${getApiOrigin()}/api/auth/google`;
}
