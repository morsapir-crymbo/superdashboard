import {
  Controller,
  Get,
  Param,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { VolumeService } from './volume.service';
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

  constructor(private volumeService: VolumeService) {}

  @Get('stats')
  async getAllStats() {
    this.logger.log('GET /volume/stats - Fetching all customer stats');
    
    const allDefined = getAllDefinedCustomerIds();
    const configured = getCustomerConfigs().map((c) => c.id);
    const missing = getMissingCustomerConfigs();
    
    this.logger.log(`[Config] All defined: ${allDefined.join(', ')}`);
    this.logger.log(`[Config] Configured (with DB creds): ${configured.join(', ') || '(none)'}`);
    if (missing.length > 0) {
      this.logger.warn(`[Config] Missing DB credentials for: ${missing.join(', ')}`);
    }
    
    try {
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
}
