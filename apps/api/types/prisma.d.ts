// apps/api/types/prisma.d.ts
declare module '@prisma/client' {

    export class PrismaClient {
      $connect(): Promise<void>;
      $disconnect(): Promise<void>;

    }
  }
  