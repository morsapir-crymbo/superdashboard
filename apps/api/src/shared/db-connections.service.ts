import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as mysql from 'mysql2/promise';

export interface CustomerDbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  api?: string;
}

export interface CustomerConfig {
  id: string;
  displayName: string;
  startDate: Date;
  db: CustomerDbConfig;
}

@Injectable()
export class DbConnectionsService implements OnModuleDestroy {
  private connections: Map<string, mysql.Connection> = new Map();

  getCustomerConfigs(): CustomerConfig[] {
    return [
      {
        id: 'orocalab',
        displayName: 'Orocalab',
        startDate: new Date('2025-01-01'),
        db: {
          host: process.env.OROCALAB_DB_HOST || '',
          port: parseInt(process.env.OROCALAB_DB_PORT || '3306', 10),
          user: process.env.OROCALAB_DB_USER || '',
          password: process.env.OROCALAB_DB_PASSWORD || '',
          database: process.env.OROCALAB_DB_DATABASE || '',
          api: process.env.OROCALAB,
        },
      },
      {
        id: 'montrex',
        displayName: 'Montrex',
        startDate: new Date('2025-01-01'),
        db: {
          host: process.env.MONTREX_DB_HOST || '',
          port: parseInt(process.env.MONTREX_DB_PORT || '3306', 10),
          user: process.env.MONTREX_DB_USER || '',
          password: process.env.MONTREX_DB_PASSWORD || '',
          database: process.env.MONTREX_DB_DATABASE || '',
        },
      },
      {
        id: 'wyrei',
        displayName: 'Wyrei',
        startDate: new Date('2024-01-01'),
        db: {
          host: process.env.WYREI_DB_HOST || '',
          port: parseInt(process.env.WYREI_DB_PORT || '3306', 10),
          user: process.env.WYREI_DB_USER || '',
          password: process.env.WYREI_DB_PASSWORD || '',
          database: process.env.WYREI_DB_DATABASE || '',
          api: process.env.WYREI,
        },
      },
      {
        id: 'bnp',
        displayName: 'BNP',
        startDate: new Date('2024-01-01'),
        db: {
          host: process.env.BNP_DB_HOST || '',
          port: parseInt(process.env.BNP_DB_PORT || '3306', 10),
          user: process.env.BNP_DB_USER || '',
          password: process.env.BNP_DB_PASSWORD || '',
          database: process.env.BNP_DB_DATABASE || '',
          api: process.env.BNP,
        },
      },
      {
        id: 'javashk',
        displayName: 'Javashk',
        startDate: new Date('2025-07-01'),
        db: {
          host: process.env.JAVASHK_DB_HOST || '',
          port: parseInt(process.env.JAVASHK_DB_PORT || '3306', 10),
          user: process.env.JAVASHK_DB_USER || '',
          password: process.env.JAVASHK_DB_PASSWORD || '',
          database: process.env.JAVASHK_DB_DATABASE || '',
        },
      },
      {
        id: 'digiblox',
        displayName: 'Digiblox',
        startDate: new Date('2026-02-01'),
        db: {
          host: process.env.DIGIBLOX_DB_HOST || '',
          port: parseInt(process.env.DIGIBLOX_DB_PORT || '3306', 10),
          user: process.env.DIGIBLOX_DB_USER || '',
          password: process.env.DIGIBLOX_DB_PASSWORD || '',
          database: process.env.DIGIBLOX_DB_DATABASE || '',
        },
      },
    ].filter((c) => c.db.host && c.db.database);
  }

  async queryCustomerDb<T = any>(customerId: string, query: string): Promise<T[]> {
    const config = this.getCustomerConfigs().find((c) => c.id === customerId);
    if (!config) {
      throw new Error(`Unknown customer: ${customerId}`);
    }

    const connection = await mysql.createConnection({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
    });

    try {
      const [rows] = await connection.execute(query);
      return rows as T[];
    } finally {
      await connection.end();
    }
  }

  getVolumeQuery(customerId: string, startDate: string, endDate: string): string {
    switch (customerId) {
      case 'javashk':
        return `
          SELECT 
            SUM(d.amount) / POWER(10, c.decimals) AS total_amount,
            d.currency,
            d.currency_id
          FROM deposits d
          JOIN currencies c ON d.currency_id = c.id
          WHERE d.updated_at BETWEEN '${startDate}' AND '${endDate}'
          GROUP BY d.currency, d.currency_id, c.decimals
        `;

      case 'digiblox':
        return `
          SELECT 
            SUM(d.amount) / POWER(10, c.decimals) AS total_amount,
            d.currency,
            d.currency_id
          FROM deposits d
          JOIN currencies c ON d.currency_id = c.id
          WHERE d.updated_at BETWEEN '${startDate}' AND '${endDate}'
            AND d.to_address <> 'INTERNAL_TRANSFER'
          GROUP BY d.currency, d.currency_id, c.decimals
        `;

      case 'orocalab':
        return `
          SELECT currency_id, currency, SUM(amount) / 100 AS total_amount
          FROM deposits 
          WHERE updated_at BETWEEN '${startDate}' AND '${endDate}'
          GROUP BY currency_id, currency
        `;

      case 'montrex':
        return `
          SELECT 
            SUM(d.amount) / POWER(10, c.decimals) AS total_amount,
            d.currency,
            d.currency_id
          FROM deposits d
          JOIN currencies c ON d.currency_id = c.id
          WHERE d.updated_at BETWEEN '${startDate}' AND '${endDate}'
            AND d.currency_type = 'FIAT'
          GROUP BY d.currency, d.currency_id, c.decimals
        `;

      case 'wyrei':
      case 'bnp':
      default:
        return `
          SELECT 
            SUM(d.amount) / POWER(10, c.decimals) AS total_amount,
            d.currency,
            d.currency_id
          FROM deposits d
          JOIN currencies c ON d.currency_id = c.id
          WHERE d.updated_at BETWEEN '${startDate}' AND '${endDate}'
          GROUP BY d.currency, d.currency_id, c.decimals
        `;
    }
  }

  async onModuleDestroy() {
    for (const conn of this.connections.values()) {
      await conn.end();
    }
    this.connections.clear();
  }
}
