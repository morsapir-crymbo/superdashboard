import axios from 'axios';

const api = axios.create({
  baseURL: '/api/proxy',  
});

if (typeof window !== 'undefined') {
  api.interceptors.request.use((cfg) => {
    const token = getToken();
    if (token) cfg.headers = { ...(cfg.headers || {}), Authorization: `Bearer ${token}` };
    return cfg;
  });
}

function getToken(): string | null {
  const m = document.cookie.match(/(?:^|;\s*)sd_token=([^;]+)/);
  if (m) return decodeURIComponent(m[1]);
  try { return localStorage.getItem('token'); } catch { return null; }
}

export default api;
