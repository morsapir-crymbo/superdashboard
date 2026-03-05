import { Module } from '@nestjs/common';
import { CronController } from './cron.controller';
import { VolumeModule } from '../volume/volume.module';

@Module({
  imports: [VolumeModule],
  controllers: [CronController],
})
export class CronModule {}
