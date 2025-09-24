import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import Redis from 'ioredis';


@Injectable()
export class EnvsService {
private redis?: Redis;
private CACHE_KEY = 'envs:list';


constructor(private prisma: PrismaService) {
const url = process.env.REDIS_URL;
if (url) this.redis = new Redis(url);
}


async list() {
if (this.redis) {
const cached = await this.redis.get(this.CACHE_KEY);
if (cached) return JSON.parse(cached);
}
const rows = await this.prisma.environment.findMany({ orderBy: { name: 'asc' } });
if (this.redis) await this.redis.set(this.CACHE_KEY, JSON.stringify(rows), 'EX', 60);
return rows;
}


async create(name: string) {
const row = await this.prisma.environment.create({ data: { name, version: '0.0.0' } });
await this.invalidate();
return row;
}


async updateVersion(name: string, version: string) {
const row = await this.prisma.environment.update({
where: { name },
data: { version, updatedAt: new Date() },
});
await this.invalidate();
return row;
}


private async invalidate() { if (this.redis) await this.redis.del(this.CACHE_KEY); }
}