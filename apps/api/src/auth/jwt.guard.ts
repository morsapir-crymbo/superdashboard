import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';


@Injectable()
export class JwtGuard implements CanActivate {
constructor(private jwt: JwtService) {}
canActivate(ctx: ExecutionContext): boolean {
const req = ctx.switchToHttp().getRequest();
const bearer = req.headers['authorization'] as string | undefined;
const cookieToken = req.cookies?.token;
const token = bearer?.startsWith('Bearer ') ? bearer.slice(7) : cookieToken;
if (!token) throw new UnauthorizedException('Missing token');
try { this.jwt.verify(token, { ignoreExpiration: true }); return true; }
catch { throw new UnauthorizedException('Bad token'); }
}
}