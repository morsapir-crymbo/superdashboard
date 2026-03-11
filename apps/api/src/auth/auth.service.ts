import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface JwtPayload {
  sub: string;
  email: string;
  name?: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(private jwt: JwtService) {}

  async validate(username: string, password: string) {
    const u = process.env.ADMIN_USERNAME;
    const p = process.env.ADMIN_PASSWORD;
    if (username === u && password === p) return true;
    throw new UnauthorizedException('Invalid credentials');
  }

  issueToken(username: string) {
    return this.jwt.sign({ sub: username, email: username, role: 'admin' });
  }

  issueTokenForUser(user: {
    id: string;
    email: string;
    name?: string | null;
    role: string;
  }) {
    return this.jwt.sign({
      sub: user.id,
      email: user.email,
      name: user.name || undefined,
      role: user.role,
    });
  }

  verifyToken(token: string): JwtPayload {
    try {
      return this.jwt.verify(token) as JwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
