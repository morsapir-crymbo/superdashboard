import axios from 'axios';

const NEXT_PUBLIC_API_BASE = process.env.NEXT_PUBLIC_API_BASE;

function getApiBaseUrl(): string {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'server';
  
  console.log('[API Config]', {
    envVar: NEXT_PUBLIC_API_BASE || '(not set)',
    hostname,
  });
  
  if (NEXT_PUBLIC_API_BASE && !NEXT_PUBLIC_API_BASE.includes('localhost')) {
    return NEXT_PUBLIC_API_BASE;
  }
  
  if (typeof window === 'undefined') {
    return NEXT_PUBLIC_API_BASE || 'http://localhost:3001';
  }
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3001';
  }
  
  if (hostname.includes('superdashboard')) {
    const apiHost = hostname
      .replace('-app.', '-api.')
      .replace('-web.', '-api.');
    console.log('[API] Transformed hostname:', hostname, '->', apiHost);
    return `https://${apiHost}`;
  }
  
  if (hostname.endsWith('vercel.app')) {
    return 'https://superdashboard-api.vercel.app';
  }
  
  return `${window.location.protocol}//${hostname}:3001`;
}

const apiBaseUrl = getApiBaseUrl();
console.log('[API] Using base URL:', apiBaseUrl);

const api = axios.create({
  baseURL: apiBaseUrl,
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
