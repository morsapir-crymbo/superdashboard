import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createNestServer } from './server';

let server: any; 

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!server) server = await createNestServer();
  return server(req, res); 
}
