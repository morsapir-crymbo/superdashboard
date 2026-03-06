import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { VolumeService } from './volume.service';
import { VolumeRepository } from './volume.repository';
import { JwtGuard } from '../auth/jwt.guard';
import {
  getAllDefinedCustomerIds,
  getMissingCustomerConfigs,
  getCustomerConfigs,
} from '../deposit/types/customer-config';

@Controller('volume')
@UseGuards(JwtGuard)
export class VolumeController {
  private readonly logger = new Logger(VolumeController.name);

  constructor(
    private volumeService: VolumeService,
    private volumeRepository: VolumeRepository,
  ) {}

  @Get('stats')
  async getAllStats(@Query('recalculate') recalculate?: string) {
    const shouldRecalculate = recalculate === 'true';
    this.logger.log(`GET /volume/stats - Fetching all customer stats (recalculate=${shouldRecalculate})`);
    
    const allDefined = getAllDefinedCustomerIds();
    const configured = getCustomerConfigs().map((c) => c.id);
    const missing = getMissingCustomerConfigs();
    
    this.logger.log(`[Config] All defined: ${allDefined.join(', ')}`);
    this.logger.log(`[Config] Configured (with DB creds): ${configured.join(', ') || '(none)'}`);
    if (missing.length > 0) {
      this.logger.warn(`[Config] Missing DB credentials for: ${missing.join(', ')}`);
    }
    
    try {
      // If recalculate is requested and we have configured customers, recalculate today's data first
      if (shouldRecalculate && configured.length > 0) {
        this.logger.log('[Recalculate] Starting recalculation of today\'s data...');
        const today = new Date();
        const result = await this.volumeService.captureSnapshotForDate(today);
        this.logger.log(`[Recalculate] Completed - Success: ${result.success.length}, Failed: ${result.failed.length}`);
      }
      
      const stats = await this.volumeService.getAllCustomersStats();
      this.logger.log(`GET /volume/stats - Returned ${stats.length} customers`);
      return stats;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : '';
      this.logger.error(`GET /volume/stats - Failed: ${message}`, stack);
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: `Failed to fetch volume stats: ${message}`,
          error: 'Internal Server Error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('stats/recalculate')
  async recalculateStats() {
    this.logger.log('POST /volume/stats/recalculate - Manual recalculation requested');
    
    const isVercel = !!process.env.VERCEL;
    
    // In Vercel, we cannot connect to RDS - return cached data immediately
    if (isVercel) {
      this.logger.log('[Recalculate] Running in Vercel - cannot connect to RDS, returning cached data');
      const stats = await this.volumeService.getAllCustomersStats();
      return {
        recalculated: false,
        reason: 'vercel_environment',
        message: 'Real-time recalculation is not available in Vercel due to network restrictions. Data is updated via scheduled backfill from a local environment. Returning cached snapshot data.',
        stats,
      };
    }
    
    const configured = getCustomerConfigs();
    if (configured.length === 0) {
      this.logger.warn('[Recalculate] No customers configured with DB credentials - returning cached data');
      const stats = await this.volumeService.getAllCustomersStats();
      return {
        recalculated: false,
        reason: 'no_credentials',
        message: 'No customer databases configured. Returning cached data.',
        stats,
      };
    }

    try {
      const today = new Date();
      this.logger.log(`[Recalculate] Starting recalculation for ${configured.length} customers...`);
      this.logger.log(`[Recalculate] Current time: ${today.toISOString()}, UTC date: ${today.toISOString().split('T')[0]}`);
      const result = await this.volumeService.captureSnapshotForDate(today);
      this.logger.log(`[Recalculate] Snapshot completed - Success: ${result.success.length}, Failed: ${result.failed.length}`);
      
      const stats = await this.volumeService.getAllCustomersStats();
      this.logger.log(`[Recalculate] Returning updated stats for ${stats.length} customers`);
      
      // If all customers failed or were skipped, it's likely a network issue
      const totalProcessed = result.success.length + result.failed.length + (result.skipped?.length || 0);
      if (result.success.length === 0 && totalProcessed > 0) {
        return {
          recalculated: false,
          reason: 'connection_failed',
          message: 'Could not connect to customer databases. This may be due to network restrictions. Returning cached data.',
          timestamp: new Date().toISOString(),
          snapshotResult: {
            success: result.success,
            failed: result.failed,
            skipped: result.skipped || [],
          },
          stats,
        };
      }
      
      return {
        recalculated: result.success.length > 0,
        timestamp: new Date().toISOString(),
        snapshotResult: {
          success: result.success,
          failed: result.failed,
          skipped: result.skipped || [],
        },
        stats,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[Recalculate] Failed: ${message}`);
      
      // On error, still try to return cached data
      try {
        const stats = await this.volumeService.getAllCustomersStats();
        return {
          recalculated: false,
          reason: 'error',
          message: `Recalculation failed: ${message}. Returning cached data.`,
          stats,
        };
      } catch (fallbackError) {
        throw new HttpException(
          {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: `Recalculation failed: ${message}`,
            error: 'Internal Server Error',
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  @Get('stats/:customerId')
  async getCustomerStats(@Param('customerId') customerId: string) {
    this.logger.log(`GET /volume/stats/${customerId} - Fetching customer stats`);
    try {
      const stats = await this.volumeService.getCustomerStats(customerId);
      this.logger.log(`GET /volume/stats/${customerId} - Success`);
      return stats;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : '';
      this.logger.error(`GET /volume/stats/${customerId} - Failed: ${message}`, stack);
      
      if (message.includes('Unknown customer')) {
        throw new HttpException(
          {
            statusCode: HttpStatus.NOT_FOUND,
            message: `Customer not found: ${customerId}`,
            error: 'Not Found',
          },
          HttpStatus.NOT_FOUND,
        );
      }
      
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: `Failed to fetch stats for ${customerId}: ${message}`,
          error: 'Internal Server Error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('customers')
  async getCustomers() {
    this.logger.log('GET /volume/customers - Fetching customer list');
    try {
      const stats = await this.volumeService.getAllCustomersStats();
      const customers = stats.map((s) => ({
        id: s.customerId,
        name: s.customerName,
      }));
      this.logger.log(`GET /volume/customers - Returned ${customers.length} customers`);
      return customers;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : '';
      this.logger.error(`GET /volume/customers - Failed: ${message}`, stack);
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: `Failed to fetch customers: ${message}`,
          error: 'Internal Server Error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('config/status')
  async getConfigStatus() {
    const allDefined = getAllDefinedCustomerIds();
    const configured = getCustomerConfigs().map((c) => c.id);
    const missing = getMissingCustomerConfigs();
    
    return {
      allDefinedCustomers: allDefined,
      configuredCustomers: configured,
      missingCredentials: missing,
      message: configured.length === 0
        ? 'No customer databases configured. Add environment variables: <CUSTOMER>_DB_HOST, <CUSTOMER>_DB_DATABASE, <CUSTOMER>_DB_USER, <CUSTOMER>_DB_PASSWORD'
        : `${configured.length} of ${allDefined.length} customers configured`,
    };
  }

  @Post('snapshot/trigger')
  async triggerSnapshot(@Query('date') dateStr?: string) {
    this.logger.log(`POST /volume/snapshot/trigger - Manual snapshot requested`);
    
    const configured = getCustomerConfigs();
    if (configured.length === 0) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'No customer databases configured. Cannot run snapshot.',
          error: 'Bad Request',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    let targetDate: Date;
    if (dateStr) {
      targetDate = new Date(dateStr);
      if (isNaN(targetDate.getTime())) {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            message: `Invalid date format: ${dateStr}. Use YYYY-MM-DD`,
            error: 'Bad Request',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    } else {
      const now = new Date();
      targetDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    }

    this.logger.log(`Running snapshot for date: ${targetDate.toISOString().split('T')[0]}`);
    this.logger.log(`Configured customers: ${configured.map(c => c.id).join(', ')}`);

    try {
      const result = await this.volumeService.captureSnapshotForDate(targetDate);
      
      this.logger.log(`Snapshot completed - Success: ${result.success.length}, Failed: ${result.failed.length}`);
      
      return {
        date: targetDate.toISOString().split('T')[0],
        success: result.success,
        failed: result.failed,
        message: result.failed.length === 0
          ? `Successfully captured snapshot for ${result.success.length} customers`
          : `Snapshot completed with ${result.failed.length} failures`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Snapshot failed: ${message}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: `Snapshot failed: ${message}`,
          error: 'Internal Server Error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('snapshot/status')
  async getSnapshotStatus() {
    const now = new Date();
    const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    try {
      const recentRecords = await this.volumeRepository.findByDateRange(thirtyDaysAgo, yesterday);
      
      const byCustomer = new Map<string, number>();
      const byDate = new Map<string, number>();
      
      for (const record of recentRecords) {
        const customerId = record.customerId;
        const dateStr = record.date.toISOString().split('T')[0];
        
        byCustomer.set(customerId, (byCustomer.get(customerId) || 0) + 1);
        byDate.set(dateStr, (byDate.get(dateStr) || 0) + 1);
      }

      return {
        totalRecords: recentRecords.length,
        recordsByCustomer: Object.fromEntries(byCustomer),
        recordsByDate: Object.fromEntries([...byDate.entries()].sort().slice(-7)),
        dateRange: {
          from: thirtyDaysAgo.toISOString().split('T')[0],
          to: yesterday.toISOString().split('T')[0],
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get snapshot status: ${message}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: `Failed to get snapshot status: ${message}`,
          error: 'Internal Server Error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
