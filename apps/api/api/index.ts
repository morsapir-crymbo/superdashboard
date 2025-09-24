import { createNestServer } from '../server';
let server: any;

export default async function handler(req: any, res: any) {
  if (!server) server = await createNestServer();
  return server(req, res);
}

export const config = { api: { bodyParser: false } };
