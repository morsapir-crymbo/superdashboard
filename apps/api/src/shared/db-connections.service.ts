import { Injectable } from '@nestjs/common';
import { getCustomerConfigs, CustomerVolumeConfig } from '../deposit/types/customer-config';

/**
 * @deprecated Use DepositRepository instead for all deposit-related queries.
 * This service is kept for backward compatibility but delegates to the new system.
 */
@Injectable()
export class DbConnectionsService {
  getCustomerConfigs(): { id: string; displayName: string; startDate: Date }[] {
    return getCustomerConfigs().map((c) => ({
      id: c.id,
      displayName: c.displayName,
      startDate: c.startDate,
    }));
  }
}
