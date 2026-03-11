import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  allowedDomain?: string;
}

export interface GoogleAuthUrlOptions {
  state: string;
  returnTo?: string;
}

export interface GoogleIdTokenPayload {
  email?: string;
  email_verified?: boolean;
  hd?: string;
  sub: string;
  name?: string;
  picture?: string;
}

@Injectable()
export class GoogleOAuthService {
  private readonly client: OAuth2Client;
  private readonly allowedDomain?: string;

  constructor(config: GoogleOAuthConfig) {
    this.client = new OAuth2Client(
      config.clientId,
      config.clientSecret,
      config.redirectUri,
    );
    this.allowedDomain = config.allowedDomain;
  }

  generateState(): string {
    return randomBytes(32).toString('hex');
  }

  generateAuthUrl(options: GoogleAuthUrlOptions): string {
    const authUrlOptions: any = {
      scope: ['email', 'profile', 'openid'],
      access_type: 'offline',
      prompt: 'consent',
      state: options.state,
    };

    if (this.allowedDomain) {
      authUrlOptions.hd = this.allowedDomain;
    }

    return this.client.generateAuthUrl(authUrlOptions);
  }

  async getTokenFromCode(code: string) {
    const { tokens } = await this.client.getToken(code);
    return tokens;
  }

  async verifyIdToken(idToken: string): Promise<GoogleIdTokenPayload> {
    const ticket = await this.client.verifyIdToken({ idToken });
    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('ID token payload is empty');
    }
    return payload as GoogleIdTokenPayload;
  }

  validateDomain(payload: GoogleIdTokenPayload): boolean {
    if (!this.allowedDomain) {
      return true;
    }
    if (!payload.hd || payload.hd !== this.allowedDomain) {
      return false;
    }
    return true;
  }
}
