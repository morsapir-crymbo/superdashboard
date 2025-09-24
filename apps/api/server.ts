import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import cookieParser from 'cookie-parser';

export async function createNestServer() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || true,
    credentials: true,
  });
  await app.init(); 
  return app.getHttpAdapter().getInstance(); 
}