// apps/api/types/express.cookie.d.ts
import 'express';

declare module 'express' {
  interface Response {
    cookie(name: string, val: any, options?: any): this;
  }
}
