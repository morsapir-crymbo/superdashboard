import axios from 'axios';

function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';
  }
  
  if (process.env.NEXT_PUBLIC_API_BASE) {
    return process.env.NEXT_PUBLIC_API_BASE;
  }
  
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3001';
  }
  
  if (hostname.endsWith('vercel.app')) {
    return 'https://superdashboard-api.vercel.app';
  }
  
  return `${window.location.protocol}//${hostname.replace('web', 'api')}`;
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
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
