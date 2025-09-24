// apps/api/server.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import cookieParser from 'cookie-parser';

export async function createNestServer() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());

  // דיאגנוסטיקה: פותח CORS לכולם ומטפל ב-OPTIONS ידנית
  app.use((req: any, res: any, next: any) => {
    const origin = req.headers?.origin as string | undefined;
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
    origin: true, // זמני – אחרי שזה עובד נחזיר לרשימה מתוך CORS_ORIGIN
    credentials: true,
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization','Accept','X-Requested-With'],
    optionsSuccessStatus: 204,
  });

  await app.init();
  return app.getHttpAdapter().getInstance();
}
