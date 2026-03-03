import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { VolumeService } from './volume.service';
import { JwtGuard } from '../auth/jwt.guard';

@Controller('volume')
@UseGuards(JwtGuard)
export class VolumeController {
  constructor(private volumeService: VolumeService) {}

  @Get('stats')
  async getAllStats() {
    return this.volumeService.getAllCustomersStats();
  }

  @Get('stats/:customerId')
  async getCustomerStats(@Param('customerId') customerId: string) {
    return this.volumeService.getCustomerStats(customerId);
  }

  @Get('customers')
  async getCustomers() {
    const stats = await this.volumeService.getAllCustomersStats();
    return stats.map((s) => ({
      id: s.customerId,
      name: s.customerName,
    }));
  }
}
