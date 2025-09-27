import axios from 'axios';

const api = axios.create({ baseURL: '/backend' });

if (typeof window !== 'undefined') {
  api.interceptors.request.use((cfg) => {
    const token = getToken();
    if (token) {
      const h: any = cfg.headers ?? {};
      if (typeof h.set === 'function') h.set('Authorization', `Bearer ${token}`);
      else h['Authorization'] = `Bearer ${token}`;
      cfg.headers = h;
    }
    return cfg;
  });
}

function getToken(): string | null {
  const m = typeof document !== 'undefined'
    ? document.cookie.match(/(?:^|;\s*)sd_token=([^;]+)/)
    : null;
  if (m) return decodeURIComponent(m[1]);
  try { return localStorage.getItem('token'); } catch { return null; }
}

export default api;
