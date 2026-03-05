import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { CustomerDbConfig } from './types/customer-config';

interface PoolEntry {
  pool: mysql.Pool;
  lastUsed: number;
  healthCheckFailed: boolean;
}

const CONNECTION_TIMEOUT_MS = 5000; // 5 second hard timeout

@Injectable()
export class ConnectionPoolManager implements OnModuleDestroy {
  private readonly logger = new Logger(ConnectionPoolManager.name);
  private readonly pools: Map<string, PoolEntry> = new Map();
  private readonly POOL_CONFIG = {
    connectionLimit: 5,
    queueLimit: 10,
    waitForConnections: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 30000,
    connectTimeout: 5000,
    acquireTimeout: 5000,
  };

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId!);
      return result;
    } catch (error) {
      clearTimeout(timeoutId!);
      throw error;
    }
  }

  async getConnection(customerId: string, dbConfig: CustomerDbConfig): Promise<mysql.PoolConnection> {
    let poolEntry = this.pools.get(customerId);

    if (!poolEntry || poolEntry.healthCheckFailed) {
      poolEntry = await this.createPool(customerId, dbConfig);
    }

    poolEntry.lastUsed = Date.now();

    try {
      return await this.withTimeout(
        poolEntry.pool.getConnection(),
        CONNECTION_TIMEOUT_MS,
        `getConnection for ${customerId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to get connection for ${customerId}`, error);
      poolEntry.healthCheckFailed = true;
      throw error;
    }
  }

  async executeQuery<T>(
    customerId: string,
    dbConfig: CustomerDbConfig,
    sql: string,
    params: (string | number)[],
  ): Promise<T[]> {
    const connection = await this.getConnection(customerId, dbConfig);

    try {
      const [rows] = await this.withTimeout(
        connection.execute(sql, params),
        CONNECTION_TIMEOUT_MS * 2,
        `executeQuery for ${customerId}`,
      );
      return rows as T[];
    } finally {
      connection.release();
    }
  }

  private async createPool(customerId: string, dbConfig: CustomerDbConfig): Promise<PoolEntry> {
    const existingEntry = this.pools.get(customerId);
    if (existingEntry) {
      try {
        await existingEntry.pool.end();
      } catch (error) {
        this.logger.warn(`Failed to close old pool for ${customerId}`, error);
      }
    }

    this.logger.log(`[Pool] Creating connection for ${customerId}`);
    this.logger.log(`[Pool] ${customerId} -> ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);

    const pool = mysql.createPool({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
      ...this.POOL_CONFIG,
    });

    const poolEntry: PoolEntry = {
      pool,
      lastUsed: Date.now(),
      healthCheckFailed: false,
    };

    this.pools.set(customerId, poolEntry);
    return poolEntry;
  }

  async healthCheck(customerId: string): Promise<boolean> {
    const poolEntry = this.pools.get(customerId);
    if (!poolEntry) return false;

    try {
      const connection = await poolEntry.pool.getConnection();
      await connection.ping();
      connection.release();
      poolEntry.healthCheckFailed = false;
      return true;
    } catch (error) {
      this.logger.warn(`Health check failed for ${customerId}`, error);
      poolEntry.healthCheckFailed = true;
      return false;
    }
  }

  async onModuleDestroy() {
    this.logger.log('Closing all connection pools...');
    
    const closePromises: Promise<void>[] = [];
    
    for (const [customerId, poolEntry] of this.pools.entries()) {
      closePromises.push(
        poolEntry.pool.end().catch((error) => {
          this.logger.warn(`Failed to close pool for ${customerId}`, error);
        }),
      );
    }

    await Promise.all(closePromises);
    this.pools.clear();
    
    this.logger.log('All connection pools closed');
  }

  getPoolStats(): Record<string, { lastUsed: number; healthy: boolean }> {
    const stats: Record<string, { lastUsed: number; healthy: boolean }> = {};
    
    for (const [customerId, poolEntry] of this.pools.entries()) {
      stats[customerId] = {
        lastUsed: poolEntry.lastUsed,
        healthy: !poolEntry.healthCheckFailed,
      };
    }
    
    return stats;
  }
}
