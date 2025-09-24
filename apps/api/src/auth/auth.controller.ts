import { Body, Controller, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';


@Controller('auth')
export class AuthController {
constructor(private auth: AuthService) {}


@Post('login')
async login(@Body() body: any, @Res({ passthrough: true }) res: Response) {
const { username, password } = body;
await this.auth.validate(username, password);
const token = this.auth.issueToken(username);
res.cookie('token', token, {
httpOnly: true,
sameSite: 'lax',
secure: process.env.NODE_ENV === 'production',
// ללא maxAge => Session cookie; לבקשתך אפשר גם לשים 10 שנים:
// maxAge: 10 * 365 * 24 * 60 * 60 * 1000,
});
return { ok: true };
}
}