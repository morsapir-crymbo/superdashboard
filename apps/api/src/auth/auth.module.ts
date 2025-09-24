import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';


@Module({
imports: [
JwtModule.register({
secret: process.env.JWT_SECRET,
signOptions: { /* ללא exp בכוונה */ },
}),
],
controllers: [AuthController],
providers: [AuthService],
exports: [AuthService],
})
export class AuthModule {}