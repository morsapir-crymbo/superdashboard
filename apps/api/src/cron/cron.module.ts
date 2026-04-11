import { Module } from '@nestjs/common';
import { CronController } from './cron.controller';
import { VolumeModule } from '../volume/volume.module';
import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [VolumeModule, SyncModule],
  controllers: [CronController],
})
export class CronModule {}
