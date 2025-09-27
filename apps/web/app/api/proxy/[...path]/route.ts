// Next.js App Router proxy -> API (no CORS)
const API_BASE = 'https://superdashboard-app.vercel.app';

function toTargetUrl(path: string[] | undefined) {
  const joined = (path ?? []).join('/');
  return `${API_BASE}/${joined}`;
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

async function proxy(req: Request, ctx: { params: { path: string[] } }) {
  const target = toTargetUrl(ctx.params?.path);
  const method = req.method;

  const h = new Headers(req.headers);
  h.delete('host'); h.delete('content-length'); h.delete('connection');

  const init: RequestInit = {
    method,
    headers: h,
    body: method === 'GET' || method === 'HEAD' ? undefined : await req.arrayBuffer(),
    redirect: 'manual',
  };

  const res = await fetch(target, init);
  const respHeaders = new Headers(res.headers);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: respHeaders });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
