import {
  Controller,
  Get,
  Post,
  Query,
  Headers,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { VolumeService } from '../volume/volume.service';
import { SyncService } from '../sync/sync.service';
import { getCustomerConfigs } from '../deposit/types/customer-config';

@Controller('cron')
export class CronController {
  private readonly logger = new Logger(CronController.name);

  constructor(
    private volumeService: VolumeService,
    private syncService: SyncService,
  ) {}

  @Get('snapshot')
  async handleCronSnapshot(
    @Headers('authorization') authHeader?: string,
    @Headers('x-vercel-cron') vercelCronHeader?: string,
  ) {
    this.logger.log('=== CRON SNAPSHOT TRIGGERED ===');
    this.logger.log(`Time: ${new Date().toISOString()}`);
    this.logger.log(`Headers: auth=${authHeader ? 'present' : 'none'}, x-vercel-cron=${vercelCronHeader || 'none'}`);
    
    const isVercelCron = vercelCronHeader === '1';
    const hasValidSecret = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
    const isDevelopment = !process.env.VERCEL;
    
    if (!isVercelCron && !hasValidSecret && !isDevelopment) {
      this.logger.warn('Unauthorized cron access attempt');
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    return this.runSnapshot();
  }

  @Post('snapshot')
  async handleManualCronSnapshot(
    @Headers('authorization') authHeader?: string,
    @Headers('x-vercel-cron') vercelCronHeader?: string,
  ) {
    this.logger.log('=== MANUAL CRON SNAPSHOT TRIGGERED ===');
    this.logger.log(`Time: ${new Date().toISOString()}`);
    
    const isVercelCron = vercelCronHeader === '1';
    const hasValidSecret = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
    const isDevelopment = !process.env.VERCEL;
    
    if (!isVercelCron && !hasValidSecret && !isDevelopment) {
      this.logger.warn('Unauthorized cron access attempt');
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    return this.runSnapshot();
  }

  private async runSnapshot() {
    const configured = getCustomerConfigs();
    this.logger.log(`Configured customers: ${configured.length}`);
    this.logger.log(`Customer IDs: ${configured.map(c => c.id).join(', ') || '(none)'}`);

    if (configured.length === 0) {
      this.logger.error('No customer databases configured - cannot run snapshot');
      return {
        success: false,
        message: 'No customer databases configured',
        timestamp: new Date().toISOString(),
        customersProcessed: 0,
        results: { success: [], failed: [] },
      };
    }

    const now = new Date();
    const yesterday = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - 1,
    ));
    const dateStr = yesterday.toISOString().split('T')[0];

    this.logger.log(`Running snapshot for date: ${dateStr}`);

    try {
      const result = await this.volumeService.captureSnapshotForDate(yesterday);

      this.logger.log('=== SNAPSHOT COMPLETED ===');
      this.logger.log(`Success: ${result.success.length} customers`);
      this.logger.log(`Failed: ${result.failed.length} customers`);
      
      if (result.success.length > 0) {
        this.logger.log(`Successful: ${result.success.join(', ')}`);
      }
      if (result.failed.length > 0) {
        this.logger.error(`Failed: ${result.failed.join(', ')}`);
      }

      return {
        success: result.failed.length === 0,
        message: result.failed.length === 0
          ? `Snapshot completed for ${result.success.length} customers`
          : `Snapshot completed with ${result.failed.length} failures`,
        timestamp: new Date().toISOString(),
        date: dateStr,
        customersProcessed: result.success.length + result.failed.length,
        results: result,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Snapshot failed: ${message}`);
      
      return {
        success: false,
        message: `Snapshot failed: ${message}`,
        timestamp: new Date().toISOString(),
        date: dateStr,
        customersProcessed: 0,
        results: { success: [], failed: ['CRITICAL_ERROR'] },
      };
    }
  }

  @Get('sync')
  async handleCronSync(
    @Headers('authorization') authHeader?: string,
    @Headers('x-vercel-cron') vercelCronHeader?: string,
  ) {
    this.logger.log('=== CRON INCREMENTAL SYNC TRIGGERED ===');
    this.logger.log(`Time: ${new Date().toISOString()}`);

    const isVercelCron = vercelCronHeader === '1';
    const hasValidSecret = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
    const isDevelopment = !process.env.VERCEL;

    if (!isVercelCron && !hasValidSecret && !isDevelopment) {
      this.logger.warn('Unauthorized cron sync access attempt');
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    try {
      const result = await this.syncService.runIncrementalSync();
      this.logger.log(`=== CRON SYNC COMPLETED === ${result.summary.successful}/${result.summary.total} customers`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron sync failed: ${message}`);
      return {
        success: false,
        message: `Sync failed: ${message}`,
        timestamp: new Date().toISOString(),
        summary: { total: 0, successful: 0, failed: 0 },
      };
    }
  }

  @Post('backfill')
  async backfillDateRange(
    @Query('startDate') startDateStr: string,
    @Query('endDate') endDateStr: string,
    @Headers('authorization') authHeader?: string,
    @Headers('x-vercel-cron') vercelCronHeader?: string,
  ) {
    this.logger.log('=== BACKFILL TRIGGERED ===');
    this.logger.log(`Range: ${startDateStr} to ${endDateStr}`);
    
    const isVercelCron = vercelCronHeader === '1';
    const hasValidSecret = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
    const isDevelopment = !process.env.VERCEL;
    
    if (!isVercelCron && !hasValidSecret && !isDevelopment) {
      this.logger.warn('Unauthorized backfill access attempt');
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    if (!startDateStr || !endDateStr) {
      throw new HttpException(
        'startDate and endDate query parameters are required (YYYY-MM-DD)',
        HttpStatus.BAD_REQUEST,
      );
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new HttpException(
        'Invalid date format. Use YYYY-MM-DD',
        HttpStatus.BAD_REQUEST,
      );
    }

    const configured = getCustomerConfigs();
    if (configured.length === 0) {
      return {
        success: false,
        message: 'No customer databases configured',
        timestamp: new Date().toISOString(),
      };
    }

    const results: { date: string; success: string[]; failed: string[] }[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      this.logger.log(`Backfilling ${dateStr}...`);

      try {
        const result = await this.volumeService.captureSnapshotForDate(new Date(currentDate));
        results.push({
          date: dateStr,
          success: result.success,
          failed: result.failed,
        });
        this.logger.log(`${dateStr}: ${result.success.length} success, ${result.failed.length} failed`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`${dateStr}: FAILED - ${message}`);
        results.push({
          date: dateStr,
          success: [],
          failed: ['CRITICAL_ERROR'],
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    const totalSuccess = results.reduce((sum, r) => sum + r.success.length, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.failed.length, 0);

    return {
      success: totalFailed === 0,
      message: `Backfill completed: ${results.length} dates, ${totalSuccess} successes, ${totalFailed} failures`,
      timestamp: new Date().toISOString(),
      dateRange: { start: startDateStr, end: endDateStr },
      results,
    };
  }
}
