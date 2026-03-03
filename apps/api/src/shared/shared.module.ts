import { Module, Global } from '@nestjs/common';
import { DbConnectionsService } from './db-connections.service';
import { QuotesService } from './quotes.service';

@Global()
@Module({
  providers: [DbConnectionsService, QuotesService],
  exports: [DbConnectionsService, QuotesService],
})
export class SharedModule {}
