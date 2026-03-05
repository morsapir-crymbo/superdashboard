import { Injectable, Logger } from '@nestjs/common';
import { ConnectionPoolManager } from './connection-pool.manager';
import { DepositQueryBuilder } from './deposit-query.builder';
import {
  CustomerVolumeConfig,
  getCustomerConfig,
  getCustomerConfigs,
} from './types/customer-config';
import {
  DepositVolumeRow,
  DepositVolumeResult,
  normalizeDepositRow,
  DateRange,
} from './types/deposit.dto';

@Injectable()
export class DepositRepository {
  private readonly logger = new Logger(DepositRepository.name);

  constructor(private poolManager: ConnectionPoolManager) {}

  async getVolumeByDateRange(
    customerId: string,
    dateRange: DateRange,
  ): Promise<DepositVolumeResult[]> {
    const config = getCustomerConfig(customerId);
    if (!config) {
      throw new Error(`Unknown customer: ${customerId}`);
    }

    const queryBuilder = new DepositQueryBuilder(config);
    const { sql, params } = queryBuilder.buildVolumeQuery(dateRange.start, dateRange.end);

    const startStr = dateRange.start.toISOString().split('T')[0];
    const endStr = dateRange.end.toISOString().split('T')[0];
    
    this.logger.log(`[Query] ${customerId}: ${startStr} to ${endStr}`);
    this.logger.debug(`[Query] ${customerId} SQL: ${sql.replace(/\s+/g, ' ').substring(0, 200)}...`);
    this.logger.debug(`[Query] ${customerId} Params: ${JSON.stringify(params)}`);

    try {
      const rows = await this.poolManager.executeQuery<DepositVolumeRow>(
        customerId,
        config.db,
        sql,
        params,
      );

      this.logger.log(`[Query] ${customerId}: Got ${rows.length} currency rows`);
      
      if (rows.length > 0) {
        const currencies = rows.map(r => r.currency).join(', ');
        this.logger.debug(`[Query] ${customerId} currencies: ${currencies}`);
      }

      return rows.map(normalizeDepositRow);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[Query] ${customerId} FAILED: ${message}`);
      throw error;
    }
  }

  async getVolumeForMultipleDateRanges(
    customerId: string,
    dateRanges: DateRange[],
  ): Promise<Map<string, DepositVolumeResult[]>> {
    const results = new Map<string, DepositVolumeResult[]>();

    for (const range of dateRanges) {
      const key = `${this.formatDate(range.start)}_${this.formatDate(range.end)}`;
      try {
        const volume = await this.getVolumeByDateRange(customerId, range);
        results.set(key, volume);
      } catch (error) {
        this.logger.error(`Failed to get volume for ${customerId} range ${key}`, error);
        results.set(key, []);
      }
    }

    return results;
  }

  async batchGetDailyVolumes(
    customerId: string,
    dates: Date[],
  ): Promise<Map<string, DepositVolumeResult[]>> {
    if (dates.length === 0) {
      return new Map();
    }

    if (dates.length === 1) {
      const date = dates[0];
      const results = await this.getVolumeByDateRange(customerId, {
        start: date,
        end: date,
      });
      return new Map([[this.formatDate(date), results]]);
    }

    const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
    const minDate = sortedDates[0];
    const maxDate = sortedDates[sortedDates.length - 1];

    const config = getCustomerConfig(customerId);
    if (!config) {
      throw new Error(`Unknown customer: ${customerId}`);
    }

    const sql = this.buildBatchDailyQuery(config, minDate, maxDate);
    
    try {
      const rows = await this.poolManager.executeQuery<DepositVolumeRow & { query_date: string }>(
        customerId,
        config.db,
        sql.sql,
        sql.params,
      );

      const resultMap = new Map<string, DepositVolumeResult[]>();
      
      for (const date of dates) {
        resultMap.set(this.formatDate(date), []);
      }

      for (const row of rows) {
        const dateKey = row.query_date;
        if (!resultMap.has(dateKey)) {
          resultMap.set(dateKey, []);
        }
        resultMap.get(dateKey)!.push(normalizeDepositRow(row));
      }

      return resultMap;
    } catch (error) {
      this.logger.error(`Batch query failed for ${customerId}, falling back to individual queries`);
      return this.fallbackIndividualQueries(customerId, dates);
    }
  }

  private buildBatchDailyQuery(
    config: CustomerVolumeConfig,
    minDate: Date,
    maxDate: Date,
  ): { sql: string; params: (string | number)[] } {
    const params: (string | number)[] = [];
    const startStr = this.formatDate(minDate);
    const endStr = this.formatDate(maxDate) + ' 23:59:59';
    
    params.push(startStr, endStr);

    const amountExpression = config.decimalStrategy === 'fixed'
      ? `SUM(d.amount) / ${Math.pow(10, config.fixedDecimals || 2)}`
      : 'SUM(d.amount) / POWER(10, c.decimals)';

    const joinClause = config.decimalStrategy === 'power'
      ? 'JOIN currencies c ON d.currency_id = c.id'
      : '';

    const filterClauses = this.buildFilterParams(config.filters, params);

    const groupByBase = config.decimalStrategy === 'fixed'
      ? 'd.currency_id, d.currency'
      : 'd.currency, d.currency_id, c.decimals';

    const sql = `
      SELECT 
        DATE(d.updated_at) AS query_date,
        ${amountExpression} AS total_amount,
        COUNT(*) AS deposit_count,
        d.currency,
        d.currency_id
      FROM deposits d
      ${joinClause}
      WHERE d.updated_at BETWEEN ? AND ?
      ${filterClauses}
      GROUP BY DATE(d.updated_at), ${groupByBase}
      ORDER BY query_date
    `.trim();

    return { sql, params };
  }

  private buildFilterParams(
    filters: CustomerVolumeConfig['filters'],
    params: (string | number)[],
  ): string {
    if (filters.length === 0) return '';

    const clauses: string[] = [];
    for (const filter of filters) {
      if (filter.operator === '=' || filter.operator === '<>') {
        params.push(filter.value as string);
        clauses.push(`${filter.column} ${filter.operator} ?`);
      } else if (filter.operator === 'IN' || filter.operator === 'NOT IN') {
        const values = Array.isArray(filter.value) ? filter.value : [filter.value];
        params.push(...values);
        clauses.push(`${filter.column} ${filter.operator} (${values.map(() => '?').join(', ')})`);
      }
    }

    return clauses.length > 0 ? 'AND ' + clauses.join(' AND ') : '';
  }

  private async fallbackIndividualQueries(
    customerId: string,
    dates: Date[],
  ): Promise<Map<string, DepositVolumeResult[]>> {
    const results = new Map<string, DepositVolumeResult[]>();

    for (const date of dates) {
      try {
        const volume = await this.getVolumeByDateRange(customerId, {
          start: date,
          end: date,
        });
        results.set(this.formatDate(date), volume);
      } catch (error) {
        this.logger.error(`Individual query failed for ${customerId} on ${date}`);
        results.set(this.formatDate(date), []);
      }
    }

    return results;
  }

  getAllCustomerIds(): string[] {
    return getCustomerConfigs().map((c) => c.id);
  }

  getCustomerConfig(customerId: string): CustomerVolumeConfig | undefined {
    return getCustomerConfig(customerId);
  }

  getAllCustomerConfigs(): CustomerVolumeConfig[] {
    return getCustomerConfigs();
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
