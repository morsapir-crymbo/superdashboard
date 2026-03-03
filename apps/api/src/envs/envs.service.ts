import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import Redis from 'ioredis';

@Injectable()
export class EnvsService {
  private readonly logger = new Logger(EnvsService.name);
  private redis?: Redis;
  private redisConnected = false;
  private CACHE_KEY = 'envs:list';

  constructor(private prisma: PrismaService) {
    this.initRedis();
  }

  private initRedis() {
    const url = process.env.REDIS_URL;
    if (!url) {
      this.logger.warn('REDIS_URL not set, caching disabled');
      return;
    }

    try {
      this.redis = new Redis(url, {
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => {
          if (times > 2) {
            this.logger.warn('Redis connection failed, disabling cache');
            return null;
          }
          return Math.min(times * 100, 1000);
        },
        lazyConnect: true,
      });

      this.redis.on('connect', () => {
        this.redisConnected = true;
        this.logger.log('Redis connected');
      });

      this.redis.on('error', (err) => {
        this.redisConnected = false;
        this.logger.warn(`Redis error: ${err.message}`);
      });

      this.redis.connect().catch((err) => {
        this.logger.warn(`Redis connect failed: ${err.message}`);
        this.redisConnected = false;
      });
    } catch (err) {
      this.logger.warn(`Redis init failed: ${err}`);
    }
  }

  private async safeRedisGet(key: string): Promise<string | null> {
    if (!this.redis || !this.redisConnected) return null;
    try {
      return await this.redis.get(key);
    } catch (err) {
      this.logger.warn(`Redis get failed: ${err}`);
      return null;
    }
  }

  private async safeRedisSet(key: string, value: string, ttl: number): Promise<void> {
    if (!this.redis || !this.redisConnected) return;
    try {
      await this.redis.set(key, value, 'EX', ttl);
    } catch (err) {
      this.logger.warn(`Redis set failed: ${err}`);
    }
  }

  private async safeRedisDel(key: string): Promise<void> {
    if (!this.redis || !this.redisConnected) return;
    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.warn(`Redis del failed: ${err}`);
    }
  }

  async list() {
    const cached = await this.safeRedisGet(this.CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }

    const rows = await this.prisma.environment.findMany({ orderBy: { name: 'asc' } });
    await this.safeRedisSet(this.CACHE_KEY, JSON.stringify(rows), 60);
    return rows;
  }

  async create(name: string) {
    const row = await this.prisma.environment.create({ data: { name, version: '0.0.0' } });
    await this.safeRedisDel(this.CACHE_KEY);
    return row;
  }

  async updateVersion(name: string, version: string) {
    const row = await this.prisma.environment.update({
      where: { name },
      data: { version, updatedAt: new Date() },
    });
    await this.safeRedisDel(this.CACHE_KEY);
    return row;
  }
}