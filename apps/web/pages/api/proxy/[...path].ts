import type { NextApiRequest, NextApiResponse } from 'next';

export const config = { api: { bodyParser: false } };

const API_BASE =
  process.env.NODE_ENV === 'production'
    ? 'https://superdashboard-app.vercel.app'
    : 'http://localhost:3001';

function targetUrl(segments?: string[] | string): string {
  const parts = Array.isArray(segments) ? segments : segments ? [segments] : [];
  return `${API_BASE}/${parts.join('/')}`;
}

function sanitizeHeaders(incoming: NextApiRequest['headers']): Headers {
  const out = new Headers();
  for (const [k, v] of Object.entries(incoming)) {
    if (!v) continue;
    const key = k.toLowerCase();

    if (
      key === 'host' ||
      key === 'connection' ||
      key === 'content-length' ||
      key === 'content-encoding' 
    ) {
      continue;
    }

    if (Array.isArray(v)) out.set(k, v.join(', '));
    else out.set(k, String(v));
  }
  return out;
}

async function readRawBody(req: NextApiRequest): Promise<Buffer | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve());
    req.on('error', (err) => reject(err));
  });
  return Buffer.concat(chunks);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const url = targetUrl(req.query.path as any);
    const headers = sanitizeHeaders(req.headers);
    const body = await readRawBody(req);


    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body: body && body.length > 0 ? (body as any) : undefined,
      redirect: 'manual',
    });

    res.status(upstream.status);
    upstream.headers.forEach((val, key) => res.setHeader(key, val));

    const reader = upstream.body?.getReader?.();
    if (reader) {
      res.setHeader('Transfer-Encoding', 'chunked');
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) res.write(Buffer.from(value));
      }
      res.end();
    } else {
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.send(buf);
    }
  } catch (err: any) {
    res
      .status(502)
      .json({ ok: false, error: 'Proxy error', detail: err?.message || String(err) });
  }
}
