import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { MetricsRepository } from './metrics.repository';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [MetricsController],
  providers: [MetricsService, MetricsRepository, PrismaService],
  exports: [MetricsService],
})
export class MetricsModule {}
