import { Body, Controller, Post, Res, Options } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  // ✅ מענה ל־preflight
  @Options('login')
  preflight(@Res() res: Response) {
    // בשלב הדיאגנוסטיקה — נאפשר לכל מקור כדי לראות שזה עובר
    res.setHeader('Access-Control-Allow-Origin', (res.req.headers.origin as string) || '*');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');
    return res.status(204).end();
  }

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
    return { ok: true };
  }
}
