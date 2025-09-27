export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const API_BASE = 'https://superdashboard-app.vercel.app';

function toTargetUrl(path: string[] | undefined) {
  const joined = (path ?? []).join('/');
  return `${API_BASE}/${joined}`;
}

function sanitizeHeaders(h: Headers) {
  const out = new Headers(h);
  out.delete('host');
  out.delete('content-length');
  out.delete('connection');
  return out;
}

async function forward(method: string, req: Request, path: string[] | undefined) {
  const target = toTargetUrl(path);
  const headers = sanitizeHeaders(req.headers);
  const hasBody = !(method === 'GET' || method === 'HEAD');

  const init: RequestInit = {
    method,
    headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
    redirect: 'manual',
  };

  const res = await fetch(target, init);
  const respHeaders = new Headers(res.headers);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: respHeaders,
  });
}

// Explicit handlers for all methods so שלא נקבל 405
export async function GET(req: Request, ctx: { params: { path: string[] } }) {
  return forward('GET', req, ctx.params?.path);
}
export async function POST(req: Request, ctx: { params: { path: string[] } }) {
  return forward('POST', req, ctx.params?.path);
}
export async function PUT(req: Request, ctx: { params: { path: string[] } }) {
  return forward('PUT', req, ctx.params?.path);
}
export async function PATCH(req: Request, ctx: { params: { path: string[] } }) {
  return forward('PATCH', req, ctx.params?.path);
}
export async function DELETE(req: Request, ctx: { params: { path: string[] } }) {
  return forward('DELETE', req, ctx.params?.path);
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
