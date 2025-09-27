// apps/web/app/api/auth/login/route.ts
export const runtime = 'nodejs'; 

const API_BASE =
  process.env.NODE_ENV === 'production'
    ? 'https://superdashboard-app.vercel.app'
    : 'http://localhost:3001';

export async function GET() {
  return Response.json({
    ok: true,
    route: '/api/auth/login',
    supports: ['GET', 'POST', 'OPTIONS'],
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

function sanitizeHeaders(h: Headers): Headers {
  const out = new Headers();
  h.forEach((v, k) => {
    const key = k.toLowerCase();
    if (key === 'host' || key === 'connection' || key === 'content-length') return;
    out.set(k, v);
  });
  if (!out.has('content-type')) out.set('content-type', 'application/json');
  return out;
}

export async function POST(req: Request) {
  try {
    console.log('[WEB] /api/auth/login POST hit');

    const upstreamUrl = `${API_BASE}/auth/login`;
    const headers = sanitizeHeaders(req.headers);
    const raw = await req.text(); 

    console.log('[WEB] forwarding to', upstreamUrl);

    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers,
      body: raw,
      redirect: 'manual',
    });

    console.log('[WEB] upstream status', upstream.status);

    const resHeaders = new Headers(upstream.headers);

    const buf = await upstream.arrayBuffer();
    return new Response(buf, {
      status: upstream.status,
      headers: resHeaders,
    });
  } catch (err: any) {
    console.error('[WEB] /api/auth/login proxy error:', err?.message || err);
    return Response.json(
      { ok: false, error: 'Proxy error', detail: err?.message || String(err) },
      { status: 502 },
    );
  }
}
