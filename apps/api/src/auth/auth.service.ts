import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';


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
// בלי exp לבקשתך — שיקול אבטחה: הטוקן לא יפוג.
return this.jwt.sign({ sub: username, role: 'admin' });
}
}