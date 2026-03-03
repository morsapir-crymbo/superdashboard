import { Module, Global } from '@nestjs/common';
import { DepositRepository } from './deposit.repository';
import { ConnectionPoolManager } from './connection-pool.manager';

@Global()
@Module({
  providers: [ConnectionPoolManager, DepositRepository],
  exports: [DepositRepository, ConnectionPoolManager],
})
export class DepositModule {}
