import { Module } from '@nestjs/common';
import { EnvsController } from './envs.controller';
import { EnvsService } from './envs.service';
import { PrismaService } from '../prisma.service';
import { JwtModule } from '@nestjs/jwt';
import { JwtGuard } from '../auth/jwt.guard';


@Module({
imports: [JwtModule.register({ secret: process.env.JWT_SECRET })],
controllers: [EnvsController],
providers: [EnvsService, PrismaService, JwtGuard],
})
export class EnvsModule {}