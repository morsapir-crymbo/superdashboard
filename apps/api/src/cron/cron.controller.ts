import {
  Controller,
  Get,
  Post,
  Headers,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { VolumeService } from '../volume/volume.service';
import { getCustomerConfigs } from '../deposit/types/customer-config';

@Controller('cron')
export class CronController {
  private readonly logger = new Logger(CronController.name);

  constructor(private volumeService: VolumeService) {}

  @Get('snapshot')
  async handleCronSnapshot(@Headers('authorization') authHeader?: string) {
    this.logger.log('=== CRON SNAPSHOT TRIGGERED ===');
    this.logger.log(`Time: ${new Date().toISOString()}`);
    
    const isVercelCron = process.env.VERCEL && authHeader === `Bearer ${process.env.CRON_SECRET}`;
    const isDevelopment = !process.env.VERCEL;
    
    if (!isVercelCron && !isDevelopment) {
      this.logger.warn('Unauthorized cron access attempt');
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    return this.runSnapshot();
  }

  @Post('snapshot')
  async handleManualCronSnapshot(@Headers('authorization') authHeader?: string) {
    this.logger.log('=== MANUAL CRON SNAPSHOT TRIGGERED ===');
    this.logger.log(`Time: ${new Date().toISOString()}`);
    
    const isVercelCron = process.env.VERCEL && authHeader === `Bearer ${process.env.CRON_SECRET}`;
    const isDevelopment = !process.env.VERCEL;
    
    if (!isVercelCron && !isDevelopment) {
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
}
