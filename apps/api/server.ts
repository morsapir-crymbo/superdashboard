import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import cookieParser from 'cookie-parser';

export async function createNestServer() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());

  // דיאגנוסטיקה: פותח CORS לכולם + עונה ל-OPTIONS גם אם Nest לא תפס
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

  // השאר גם את enableCors פתוח (זמנית)
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization','Accept','X-Requested-With'],
    optionsSuccessStatus: 204,
  });

  await app.init();
  return app.getHttpAdapter().getInstance();
}
