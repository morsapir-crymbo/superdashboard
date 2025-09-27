// apps/web/pages/api/auth/login.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const API_BASE =
  process.env.NODE_ENV === 'production'
    ? 'https://superdashboard-app.vercel.app'
    : 'http://localhost:3001';

export const config = {
  api: { bodyParser: false }, // נעביר את ה־raw לגוף
};

function readRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // לוגים — יופיעו ב־“Functions / Logs” בפרויקט web ב-Vercel
  console.log('[WEB->API] /api/auth/login', {
    method: req.method,
    url: req.url,
    headers: req.headers,
  });

  if (req.method !== 'POST' && req.method !== 'OPTIONS') {
    console.warn('[WEB->API] 405 (method not allowed)');
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    if (req.method === 'OPTIONS') {
      // לא אמור להיות צריך כאן, אבל נשיב בכל זאת
      return res.status(204).end();
    }

    const bodyBuf = await readRawBody(req);

    // נבנה headers נקיים להעברה הלאה
    const fwd = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (!v) continue;
      const key = k.toLowerCase();
      if (key === 'host' || key === 'connection' || key === 'content-length') continue;
      if (Array.isArray(v)) fwd.set(k, v.join(', '));
      else fwd.set(k, String(v));
    }
    // נבטיח Content-Type ברירת מחדל
    if (!fwd.has('content-type')) fwd.set('content-type', 'application/json');

    const upstreamUrl = `${API_BASE}/auth/login`;
    console.log('[WEB->API] forwarding to', upstreamUrl);

    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: fwd,
      body: bodyBuf,
      redirect: 'manual',
    });

    console.log('[WEB->API] upstream status', upstream.status);

    res.status(upstream.status);
    upstream.headers.forEach((val, key) => {
      res.setHeader(key, val);
    });

    const arr = Buffer.from(await upstream.arrayBuffer());
    // לוג קצר של הגוף (slice כדי לא לשפוך טוקן ללוגים בטעות)
    console.log('[WEB->API] upstream body (first 200 bytes)', arr.slice(0, 200).toString('utf8'));
    res.send(arr);
  } catch (err: any) {
    console.error('[WEB->API] Proxy error', err?.message || err);
    return res.status(502).json({ ok: false, error: 'Proxy error', detail: err?.message || String(err) });
  }
}
