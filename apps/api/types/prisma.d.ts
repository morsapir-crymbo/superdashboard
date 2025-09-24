// apps/api/types/prisma.d.ts
declare module '@prisma/client' {
    export class PrismaClient {
      $connect(): Promise<void>;
      $disconnect(): Promise<void>;
  
      environment: {
        findMany(args?: any): Promise<any[]>;
        create(args: any): Promise<any>;
        update(args: any): Promise<any>;
      };
    }
  }
  