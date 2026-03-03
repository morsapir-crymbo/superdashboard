import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { VolumeService } from '../volume/volume.service';

@Injectable()
export class SnapshotScheduler implements OnModuleInit {
  private readonly logger = new Logger(SnapshotScheduler.name);
  private isRunning = false;

  constructor(private volumeService: VolumeService) {}

  async onModuleInit() {
    this.logger.log('Snapshot scheduler initialized');
  }

  @Cron('0 0 * * *', {
    name: 'daily-volume-snapshot',
    timeZone: 'UTC',
  })
  async handleDailySnapshot() {
    if (this.isRunning) {
      this.logger.warn('Snapshot already in progress, skipping');
      return;
    }

    this.isRunning = true;
    this.logger.log('Starting daily volume snapshot...');

    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      await this.volumeService.captureSnapshotForDate(yesterday);
      this.logger.log('Daily volume snapshot completed successfully');
    } catch (error) {
      this.logger.error('Daily volume snapshot failed', error);
    } finally {
      this.isRunning = false;
    }
  }

  async triggerManualSnapshot(date?: Date): Promise<void> {
    const targetDate = date || new Date();
    this.logger.log(`Manual snapshot triggered for ${targetDate.toISOString()}`);
    await this.volumeService.captureSnapshotForDate(targetDate);
  }
}
