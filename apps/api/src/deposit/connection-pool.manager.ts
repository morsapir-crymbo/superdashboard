import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { CustomerDbConfig } from './types/customer-config';

interface PoolEntry {
  pool: mysql.Pool;
  lastUsed: number;
  healthCheckFailed: boolean;
}

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
  };

  async getConnection(customerId: string, dbConfig: CustomerDbConfig): Promise<mysql.PoolConnection> {
    let poolEntry = this.pools.get(customerId);

    if (!poolEntry || poolEntry.healthCheckFailed) {
      poolEntry = await this.createPool(customerId, dbConfig);
    }

    poolEntry.lastUsed = Date.now();

    try {
      return await poolEntry.pool.getConnection();
    } catch (error) {
      this.logger.error(`Failed to get connection for ${customerId}`, error);
      poolEntry.healthCheckFailed = true;
      
      poolEntry = await this.createPool(customerId, dbConfig);
      return await poolEntry.pool.getConnection();
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
      const [rows] = await connection.execute(sql, params);
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

    this.logger.log(`Creating connection pool for ${customerId}`);

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
