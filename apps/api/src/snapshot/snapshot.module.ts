import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SnapshotScheduler } from './snapshot.scheduler';
import { VolumeModule } from '../volume/volume.module';

@Module({
  imports: [ScheduleModule.forRoot(), VolumeModule],
  providers: [SnapshotScheduler],
})
export class SnapshotModule {}
