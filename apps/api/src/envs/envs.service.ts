import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import Redis from 'ioredis';

export interface CreateCustomerDto {
  name: string;
  version?: string;
  customerType?: string;
  status?: string;
  signedDate?: string;
  goLiveDate?: string;
  openRequests?: number;
  comment?: string;
}

export interface UpdateCustomerDto {
  name?: string;
  version?: string;
  customerType?: string;
  status?: string;
  signedDate?: string | null;
  goLiveDate?: string | null;
  openRequests?: number;
  comment?: string | null;
}

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

  async create(dto: CreateCustomerDto) {
    const row = await this.prisma.environment.create({
      data: {
        name: dto.name,
        version: dto.version || '0.0.0',
        customerType: dto.customerType || null,
        status: dto.status || 'onboarding',
        signedDate: dto.signedDate ? new Date(dto.signedDate) : null,
        goLiveDate: dto.goLiveDate ? new Date(dto.goLiveDate) : null,
        openRequests: dto.openRequests || 0,
        comment: dto.comment || null,
      },
    });
    await this.safeRedisDel(this.CACHE_KEY);
    return row;
  }

  async update(id: number, dto: UpdateCustomerDto) {
    const existing = await this.prisma.environment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Customer with id ${id} not found`);
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.version !== undefined) data.version = dto.version;
    if (dto.customerType !== undefined) data.customerType = dto.customerType || null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.signedDate !== undefined) {
      data.signedDate = dto.signedDate ? new Date(dto.signedDate) : null;
    }
    if (dto.goLiveDate !== undefined) {
      data.goLiveDate = dto.goLiveDate ? new Date(dto.goLiveDate) : null;
    }
    if (dto.openRequests !== undefined) data.openRequests = dto.openRequests;
    if (dto.comment !== undefined) data.comment = dto.comment || null;

    const row = await this.prisma.environment.update({
      where: { id },
      data,
    });
    await this.safeRedisDel(this.CACHE_KEY);
    return row;
  }

  async delete(id: number) {
    const existing = await this.prisma.environment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Customer with id ${id} not found`);
    }

    await this.prisma.environment.delete({ where: { id } });
    await this.safeRedisDel(this.CACHE_KEY);
    return { success: true, id };
  }

  async updateVersion(name: string, version: string) {
    const row = await this.prisma.environment.update({
      where: { name },
      data: { version },
    });
    await this.safeRedisDel(this.CACHE_KEY);
    return row;
  }
}