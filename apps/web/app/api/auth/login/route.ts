// apps/web/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs'; 

const API_BASE =
  process.env.NODE_ENV === 'production'
    ? 'https://superdashboard-app.vercel.app'
    : 'http://localhost:3001';

function sanitizeHeaders(incoming: Headers): Headers {
  const out = new Headers();
  incoming.forEach((val, key) => {
    const k = key.toLowerCase();
    if (k === 'host' || k === 'connection' || k === 'content-length') return;
    out.set(key, val);
  });
  if (!out.has('content-type')) out.set('content-type', 'application/json');
  return out;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: NextRequest) {
  try {
    console.log('[WEB] /api/auth/login -> forward to API');

    const raw = await req.arrayBuffer();           
    const fwd = sanitizeHeaders(req.headers);     
    const upstreamUrl = `${API_BASE}/auth/login`;

    console.log('[WEB] forwarding to:', upstreamUrl);
    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: fwd,
      body: raw,               
      redirect: 'manual',
    });

    console.log('[WEB] upstream status:', upstream.status);

    const ab = await upstream.arrayBuffer();
    const res = new NextResponse(ab, { status: upstream.status });
    upstream.headers.forEach((val, key) => res.headers.set(key, val));
    return res;
  } catch (err: any) {
    console.error('[WEB] proxy error:', err?.message || err);
    return NextResponse.json(
      { ok: false, error: 'Proxy error', detail: err?.message || String(err) },
      { status: 502 }
    );
  }
}
