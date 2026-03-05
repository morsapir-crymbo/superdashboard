import { Controller, Get, Logger } from '@nestjs/common';
import {
  getAllDefinedCustomerIds,
  getMissingCustomerConfigs,
  getCustomerConfigs,
} from '../deposit/types/customer-config';
import { PrismaService } from '../prisma.service';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private prisma: PrismaService) {}

  @Get()
  async healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  @Get('config')
  async configStatus() {
    const allDefined = getAllDefinedCustomerIds();
    const configured = getCustomerConfigs().map((c) => c.id);
    const missing = getMissingCustomerConfigs();

    this.logger.log(`[Health] Config check - Defined: ${allDefined.length}, Configured: ${configured.length}`);

    return {
      timestamp: new Date().toISOString(),
      customers: {
        defined: allDefined,
        configured: configured,
        missing: missing,
      },
      status: configured.length === 0 ? 'NO_CUSTOMERS_CONFIGURED' : 'OK',
      message: configured.length === 0
        ? 'No customer databases configured. Set environment variables: DIGIBLOX_DB_HOST, JAVASHK_DB_HOST, MONTREX_DB_HOST (and corresponding _DATABASE, _USER, _PASSWORD)'
        : `${configured.length} of ${allDefined.length} customers configured`,
    };
  }

  @Get('db')
  async dbStatus() {
    try {
      const recordCount = await this.prisma.dailyEnvironmentVolume.count();
      
      const recentRecords = await this.prisma.dailyEnvironmentVolume.findMany({
        orderBy: { date: 'desc' },
        take: 10,
        select: {
          customerId: true,
          date: true,
          volume: true,
        },
      });

      const byCustomer: Record<string, number> = {};
      for (const r of recentRecords) {
        byCustomer[r.customerId] = (byCustomer[r.customerId] || 0) + 1;
      }

      return {
        timestamp: new Date().toISOString(),
        status: 'OK',
        totalRecords: recordCount,
        recentRecords: recentRecords.map((r) => ({
          customer: r.customerId,
          date: r.date.toISOString().split('T')[0],
          volume: Number(r.volume),
        })),
        recordsByCustomer: byCustomer,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[Health] DB check failed: ${message}`);
      return {
        timestamp: new Date().toISOString(),
        status: 'ERROR',
        error: message,
      };
    }
  }
}
