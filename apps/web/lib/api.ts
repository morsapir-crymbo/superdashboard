import axios from 'axios';

const api = axios.create({
  baseURL:
    typeof window !== 'undefined' && window.location.hostname.endsWith('vercel.app')
      ? 'https://superdashboard-app.vercel.app'
      : 'http://localhost:3001',
});

if (typeof window !== 'undefined') {
  api.interceptors.request.use((cfg) => {
    const url = (cfg.url || '').toString();
    const isLogin = /\/auth\/login(?:$|\?)/.test(url);
    if (!isLogin) {
      const token = getToken();
      if (token) {
        const h: any = cfg.headers ?? {};
        if (typeof h.set === 'function') h.set('Authorization', `Bearer ${token}`);
        else h['Authorization'] = `Bearer ${token}`;
        cfg.headers = h;
      }
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
