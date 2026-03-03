import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { VolumeService } from '../volume/volume.service';

@Injectable()
export class SnapshotScheduler implements OnModuleInit {
  private readonly logger = new Logger(SnapshotScheduler.name);
  private isRunning = false;
  private lastRunAt: Date | null = null;
  private lastRunResult: { success: string[]; failed: string[] } | null = null;

  constructor(private volumeService: VolumeService) {}

  async onModuleInit() {
    this.logger.log('Snapshot scheduler initialized - runs daily at 00:00 UTC');
  }

  @Cron('0 0 * * *', {
    name: 'daily-volume-snapshot',
    timeZone: 'UTC',
  })
  async handleDailySnapshot() {
    if (this.isRunning) {
      this.logger.warn('Snapshot already in progress, skipping this run');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    this.logger.log('Starting daily volume snapshot...');

    try {
      const yesterday = this.getYesterdayUTC();
      this.logger.log(`Capturing snapshot for ${yesterday.toISOString().split('T')[0]}`);

      const result = await this.volumeService.captureSnapshotForDate(yesterday);
      
      this.lastRunAt = new Date();
      this.lastRunResult = result;

      const duration = Date.now() - startTime;
      
      if (result.failed.length === 0) {
        this.logger.log(
          `Daily snapshot completed successfully in ${duration}ms. ` +
          `Processed: ${result.success.length} customers`,
        );
      } else {
        this.logger.warn(
          `Daily snapshot completed with errors in ${duration}ms. ` +
          `Success: ${result.success.length}, Failed: ${result.failed.length} (${result.failed.join(', ')})`,
        );
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Daily snapshot failed after ${duration}ms`, error);
      this.lastRunResult = { success: [], failed: ['CRITICAL_ERROR'] };
    } finally {
      this.isRunning = false;
    }
  }

  async triggerManualSnapshot(date?: Date): Promise<{ success: string[]; failed: string[] }> {
    if (this.isRunning) {
      throw new Error('Snapshot already in progress');
    }

    const targetDate = date || this.getYesterdayUTC();
    this.logger.log(`Manual snapshot triggered for ${targetDate.toISOString().split('T')[0]}`);
    
    return this.volumeService.captureSnapshotForDate(targetDate);
  }

  getStatus(): {
    isRunning: boolean;
    lastRunAt: Date | null;
    lastRunResult: { success: string[]; failed: string[] } | null;
  } {
    return {
      isRunning: this.isRunning,
      lastRunAt: this.lastRunAt,
      lastRunResult: this.lastRunResult,
    };
  }

  private getYesterdayUTC(): Date {
    const now = new Date();
    return new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - 1,
    ));
  }
}
