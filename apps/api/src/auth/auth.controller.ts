import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('login')
  async login(@Body() body: any) {
    const { username, password } = body;
    await this.auth.validate(username, password);
    const token = this.auth.issueToken(username);
    return { ok: true, token };
  }
}
