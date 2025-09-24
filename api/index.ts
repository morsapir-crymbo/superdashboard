let server: any;

// מייבא את השרת שלך מהנתיב היחסי הנכון (משורש -> api/ -> ../apps/api/server)
import { createNestServer } from '../apps/api/server';

export default async function handler(req: any, res: any) {
  if (!server) server = await createNestServer();
  return server(req, res);
}
