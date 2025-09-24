// apps/api/server.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import cookieParser from 'cookie-parser';
import type { Request, Response, NextFunction } from 'express';

export async function createNestServer() {
  const app = await NestFactory.create(AppModule);

  // חייבים לטוקנים מהקוקי
  app.use(cookieParser());

  // 🔎 שלב דיאגנוסטיקה: פותחים CORS לכולם (זמני),
  // ומחזירים כותרות גם ל-OPTIONS כדי לוודא שה-preflight עובר.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin as string | undefined;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');

    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  });

  app.enableCors({
    origin: true, // זמני. אחרי שזה עובד נחזיר ל-CORS_ORIGIN רשום.
    credentials: true,
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization','Accept','X-Requested-With'],
    optionsSuccessStatus: 204,
  });

  await app.init();
  return app.getHttpAdapter().getInstance();
}
