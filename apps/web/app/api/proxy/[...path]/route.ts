// App Router Proxy for ALL methods (GET/POST/PUT/PATCH/DELETE/OPTIONS)
// Works on Vercel (Edge/Node runtimes). We use Node runtime to allow Buffer streaming.

export const runtime = 'nodejs'; // ensure Node (not edge) so we can use Buffer

const API_BASE =
  process.env.NODE_ENV === 'production'
    ? 'https://superdashboard-app.vercel.app'
    : 'http://localhost:3001';

function targetUrl(segments?: string[] | string): string {
  const parts = Array.isArray(segments) ? segments : segments ? [segments] : [];
  return `${API_BASE}/${parts.join('/')}`;
}

function sanitizeHeaders(incoming: Headers): Headers {
  const out = new Headers();
  for (const [k, v] of incoming.entries()) {
    const key = k.toLowerCase();
    // drop hop-by-hop / problematic headers
    if (
      key === 'host' ||
      key === 'connection' ||
      key === 'content-length' ||
      key === 'content-encoding'
    ) continue;
    out.set(k, v);
  }
  return out;
}

async function readBody(req: Request): Promise<Buffer | undefined> {
  // No body for GET/HEAD/OPTIONS
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return undefined;
  const ab = await req.arrayBuffer();
  if (!ab || ab.byteLength === 0) return undefined;
  return Buffer.from(ab);
}

async function proxy(request: Request, { params }: { params: { path?: string[] } }) {
  const url = targetUrl(params?.path || []);
  const headers = sanitizeHeaders(request.headers);
  const body = await readBody(request);

  const upstream = await fetch(url, {
    method: request.method,
    headers,
    body: body as any, // only defined for non-GET/HEAD/OPTIONS
    redirect: 'manual',
  });

  // Build response, streaming if possible
  const respHeaders = new Headers();
  upstream.headers.forEach((val, key) => respHeaders.set(key, val));

  // Note: NextResponse doesn't support streaming arbitrary; use native Response
  if (!upstream.body) {
    const buf = Buffer.from(await upstream.arrayBuffer());
    return new Response(buf, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: respHeaders,
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}

export async function GET(request: Request, ctx: any)     { return proxy(request, ctx); }
export async function POST(request: Request, ctx: any)    { return proxy(request, ctx); }
export async function PUT(request: Request, ctx: any)     { return proxy(request, ctx); }
export async function PATCH(request: Request, ctx: any)   { return proxy(request, ctx); }
export async function DELETE(request: Request, ctx: any)  { return proxy(request, ctx); }
export async function OPTIONS(request: Request, ctx: any) {
  // quick preflight responder (you can also just proxy)
  const origin = request.headers.get('origin') || '*';
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Vary': 'Origin',
      'Access-Control-Allow-Credentials': 'false',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-Requested-With',
    },
  });
}
