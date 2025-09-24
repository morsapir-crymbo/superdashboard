import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { EnvsModule } from './envs/envs.module';
import { PrismaService } from './prisma.service';


@Module({
imports: [AuthModule, EnvsModule],
providers: [PrismaService],
})
export class AppModule {}