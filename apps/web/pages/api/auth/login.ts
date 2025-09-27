import type { NextApiRequest, NextApiResponse } from 'next';

const API_BASE =
  process.env.NODE_ENV === 'production'
    ? 'https://superdashboard-app.vercel.app'
    : 'http://localhost:3001';

export const config = {
  api: { bodyParser: false }, 
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
      return res.status(204).end();
    }

    const buf = await readRawBody(req);

    const fwd = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (!v) continue;
      const key = k.toLowerCase();
      if (key === 'host' || key === 'connection' || key === 'content-length') continue;
      if (Array.isArray(v)) fwd.set(k, v.join(', '));
      else fwd.set(k, String(v));
    }
    if (!fwd.has('content-type')) fwd.set('content-type', 'application/json');

    const upstreamUrl = `${API_BASE}/auth/login`;
    console.log('[WEB->API] forwarding to', upstreamUrl);

    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;

    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: fwd,
      body: ab,             
      redirect: 'manual',
    });

    console.log('[WEB->API] upstream status', upstream.status);

    res.status(upstream.status);
    upstream.headers.forEach((val, key) => res.setHeader(key, val));

    const out = Buffer.from(await upstream.arrayBuffer());
    console.log('[WEB->API] upstream body (first 200B):', out.slice(0, 200).toString('utf8'));
    res.send(out);
  } catch (err: any) {
    console.error('[WEB->API] Proxy error', err?.message || err);
    return res.status(502).json({ ok: false, error: 'Proxy error', detail: err?.message || String(err) });
  }
}
