import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { EnvsModule } from './envs/envs.module';
import { VolumeModule } from './volume/volume.module';
import { SnapshotModule } from './snapshot/snapshot.module';
import { CronModule } from './cron/cron.module';
import { SharedModule } from './shared/shared.module';
import { DepositModule } from './deposit/deposit.module';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    SharedModule,
    DepositModule,
    AuthModule,
    EnvsModule,
    VolumeModule,
    SnapshotModule,
    CronModule,
  ],
  providers: [PrismaService],
})
export class AppModule {}