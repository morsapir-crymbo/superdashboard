import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { EnvsService } from './envs.service';
import { JwtGuard } from '../auth/jwt.guard';


@UseGuards(JwtGuard)
@Controller()
export class EnvsController {
constructor(private envs: EnvsService) {}


@Get('envs')
list() { return this.envs.list(); }


@Post('envs')
create(@Body() body: any) { return this.envs.create(body.name); }


@Post('versions/update')
update(@Body() body: any) { return this.envs.updateVersion(body.name, body.version); }
}