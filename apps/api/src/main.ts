import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

function getCorsOrigins(): string[] | boolean {
  const envOrigins = process.env.CORS_ORIGIN;
  
  if (envOrigins) {
    return envOrigins.split(',').map(o => o.trim());
  }
  
  if (process.env.VERCEL) {
    return [
      /\.vercel\.app$/,
      'http://localhost:3000',
      'http://localhost:3001',
    ] as any;
  }
  
  return true;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  app.use(cookieParser());
  app.enableCors({
    origin: getCorsOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });
  
  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`API server running on port ${port}`);
}
bootstrap();