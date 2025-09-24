// apps/api/types/express.d.ts
import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Response {
    cookie(name: string, val: any, options?: any): this;
  }
}
