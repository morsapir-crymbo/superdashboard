import { Controller, Get, Logger } from '@nestjs/common';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  private readonly logger = new Logger(MetricsController.name);

  constructor(private readonly metricsService: MetricsService) {}

  @Get('extended')
  async getExtendedStats() {
    this.logger.log('GET /metrics/extended - Fetching extended metrics');
    
    try {
      const result = await this.metricsService.getAllCustomersExtendedStats();
      this.logger.log(`Returning extended metrics for ${result.customers.length} customers`);
      return result;
    } catch (error) {
      this.logger.error('Failed to fetch extended metrics', error);
      throw error;
    }
  }
}
