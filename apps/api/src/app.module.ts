import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { EnvsModule } from './envs/envs.module';
import { VolumeModule } from './volume/volume.module';
import { SnapshotModule } from './snapshot/snapshot.module';
import { SharedModule } from './shared/shared.module';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    SharedModule,
    AuthModule,
    EnvsModule,
    VolumeModule,
    SnapshotModule,
  ],
  providers: [PrismaService],
})
export class AppModule {}