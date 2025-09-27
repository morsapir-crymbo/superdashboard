// apps/api/api/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createNestServer } from '../server';

let server: any;

function parseAllowedOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN ?? '';
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function setCors(res: VercelResponse, origin: string, allow: string[]) {
  const isAllowed = allow.length === 0 || allow.includes(origin);
  if (isAllowed && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,PATCH,DELETE,OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type,Authorization,Accept,X-Requested-With'
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = (req.headers.origin as string) || '';
  const allow = parseAllowedOrigins();

  if (req.method === 'OPTIONS') {
    setCors(res, origin, allow);
    res.status(204).end();
    return;
  }

  if (!server) server = await createNestServer();

  setCors(res, origin, allow); 
  return server(req, res);
}
