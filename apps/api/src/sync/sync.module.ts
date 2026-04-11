import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncRepository } from './sync.repository';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [SyncService, SyncRepository, PrismaService],
  exports: [SyncService],
})
export class SyncModule {}
