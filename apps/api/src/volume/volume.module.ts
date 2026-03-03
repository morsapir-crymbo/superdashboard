import { Module } from '@nestjs/common';
import { VolumeController } from './volume.controller';
import { VolumeService } from './volume.service';
import { VolumeRepository } from './volume.repository';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [VolumeController],
  providers: [VolumeService, VolumeRepository, PrismaService],
  exports: [VolumeService, VolumeRepository],
})
export class VolumeModule {}
