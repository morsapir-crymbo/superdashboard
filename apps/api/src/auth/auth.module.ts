import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtGuard } from './jwt.guard';
import { GoogleOAuthService } from './google-oauth.service';

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '30d' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtGuard,
    {
      provide: GoogleOAuthService,
      useFactory: () => {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const apiUrl = process.env.API_URL || 'http://localhost:3001';
        const allowedDomain = process.env.GOOGLE_ALLOWED_DOMAIN;

        if (!clientId || !clientSecret) {
          console.warn(
            '[Auth] Google OAuth not configured - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET required',
          );
          return new GoogleOAuthService({
            clientId: 'not-configured',
            clientSecret: 'not-configured',
            redirectUri: `${apiUrl}/auth/google/callback`,
          });
        }

        return new GoogleOAuthService({
          clientId,
          clientSecret,
          redirectUri: `${apiUrl}/auth/google/callback`,
          allowedDomain,
        });
      },
    },
  ],
  exports: [AuthService, JwtModule, JwtGuard, GoogleOAuthService],
})
export class AuthModule {}
