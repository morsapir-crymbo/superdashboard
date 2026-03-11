import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { GoogleOAuthService } from './google-oauth.service';
import { PrismaService } from '../prisma.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private auth: AuthService,
    private googleOAuth: GoogleOAuthService,
    private prisma: PrismaService,
  ) {}

  @Post('login')
  async login(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const { username, password } = body;
    await this.auth.validate(username, password);
    const token = this.auth.issueToken(username);
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    return { ok: true, token };
  }

  @Get('google')
  async googleAuth(
    @Query('returnTo') returnTo: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const state = this.googleOAuth.generateState();
    const safeReturnTo = this.isReturnToAllowed(returnTo) ? returnTo : '/dashboard';

    res.cookie('oauth_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 5 * 60 * 1000,
    });

    res.cookie('oauth_return_to', safeReturnTo, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 5 * 60 * 1000,
    });

    const authUrl = this.googleOAuth.generateAuthUrl({ state, returnTo: safeReturnTo });
    res.redirect(authUrl);
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const storedState = req.cookies?.oauth_state;
    const returnTo = req.cookies?.oauth_return_to || '/dashboard';
    const safeReturnTo = this.isReturnToAllowed(returnTo) ? returnTo : '/dashboard';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    res.clearCookie('oauth_state');
    res.clearCookie('oauth_return_to');

    if (error) {
      this.logger.warn(`Google OAuth error: ${error}`);
      res.redirect(`${frontendUrl}/login?error=google_error`);
      return;
    }

    if (!state || !storedState || state !== storedState) {
      this.logger.warn('Invalid OAuth state');
      res.redirect(`${frontendUrl}/login?error=invalid_state`);
      return;
    }

    if (!code) {
      this.logger.warn('Missing authorization code');
      res.redirect(`${frontendUrl}/login?error=missing_code`);
      return;
    }

    try {
      const tokens = await this.googleOAuth.getTokenFromCode(code);
      const idToken = tokens.id_token;

      if (!idToken) {
        res.redirect(`${frontendUrl}/login?error=no_id_token`);
        return;
      }

      const payload = await this.googleOAuth.verifyIdToken(idToken);

      if (!this.googleOAuth.validateDomain(payload)) {
        const email = payload.email || '';
        this.logger.warn(`Domain validation failed for ${email}`);
        res.redirect(
          `${frontendUrl}/login?error=domain_mismatch&email=${encodeURIComponent(email)}`,
        );
        return;
      }

      const email = payload.email;
      if (!email) {
        res.redirect(`${frontendUrl}/login?error=no_email`);
        return;
      }

      const user = await this.upsertUser({
        email,
        googleId: payload.sub,
        name: payload.name || null,
        picture: payload.picture || null,
      });

      const token = this.auth.issueTokenForUser(user);

      res.cookie('token', token, {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      res.redirect(`${frontendUrl}${safeReturnTo}`);
    } catch (err) {
      this.logger.error('Google OAuth callback error', err);
      res.redirect(`${frontendUrl}/login?error=auth_failed`);
    }
  }

  @Get('me')
  async me(@Req() req: Request, @Res() res: Response) {
    const token = req.cookies?.token;

    if (!token) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    try {
      const payload = this.auth.verifyToken(token);
      res.json({
        email: payload.email,
        name: payload.name,
        role: payload.role,
        userId: payload.sub,
      });
    } catch {
      res.status(401).json({ message: 'Invalid token' });
    }
  }

  @Post('logout')
  async logout(@Res() res: Response) {
    res.clearCookie('token');
    res.json({ ok: true });
  }

  private isReturnToAllowed(returnTo?: string): boolean {
    if (!returnTo) return false;
    if (!returnTo.startsWith('/')) return false;
    if (returnTo.includes('//')) return false;
    return true;
  }

  private async upsertUser(profile: {
    email: string;
    googleId: string;
    name: string | null;
    picture: string | null;
  }) {
    const now = new Date();

    const existingByGoogleId = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
    });

    if (existingByGoogleId) {
      return this.prisma.user.update({
        where: { id: existingByGoogleId.id },
        data: {
          email: profile.email,
          name: profile.name,
          picture: profile.picture,
          lastSeenAt: now,
        },
      });
    }

    return this.prisma.user.upsert({
      where: { email: profile.email },
      create: {
        email: profile.email,
        googleId: profile.googleId,
        name: profile.name,
        picture: profile.picture,
        lastSeenAt: now,
      },
      update: {
        googleId: profile.googleId,
        name: profile.name,
        picture: profile.picture,
        lastSeenAt: now,
      },
    });
  }
}
