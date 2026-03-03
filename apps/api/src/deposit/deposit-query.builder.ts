import { CustomerVolumeConfig, CustomerQueryFilter } from './types/customer-config';

export interface BuiltQuery {
  sql: string;
  params: (string | number)[];
}

export class DepositQueryBuilder {
  private config: CustomerVolumeConfig;

  constructor(config: CustomerVolumeConfig) {
    this.config = config;
  }

  buildVolumeQuery(startDate: Date, endDate: Date): BuiltQuery {
    const params: (string | number)[] = [];
    
    const startStr = this.formatDateUTC(startDate);
    const endStr = this.formatDateUTC(endDate) + ' 23:59:59';
    
    params.push(startStr, endStr);

    const amountExpression = this.getAmountExpression();
    const filterClauses = this.buildFilterClauses(params);
    const joinClause = this.needsCurrencyJoin() ? 'JOIN currencies c ON d.currency_id = c.id' : '';
    const groupByClause = this.getGroupByClause();

    const sql = `
      SELECT 
        ${amountExpression} AS total_amount,
        d.currency,
        d.currency_id
      FROM deposits d
      ${joinClause}
      WHERE d.updated_at BETWEEN ? AND ?
      ${filterClauses}
      GROUP BY ${groupByClause}
    `.trim();

    return { sql, params };
  }

  private getAmountExpression(): string {
    if (this.config.decimalStrategy === 'fixed') {
      const divisor = Math.pow(10, this.config.fixedDecimals || 2);
      return `SUM(d.amount) / ${divisor}`;
    }
    return 'SUM(d.amount) / POWER(10, c.decimals)';
  }

  private needsCurrencyJoin(): boolean {
    return this.config.decimalStrategy === 'power';
  }

  private getGroupByClause(): string {
    if (this.config.decimalStrategy === 'fixed') {
      return 'd.currency_id, d.currency';
    }
    return 'd.currency, d.currency_id, c.decimals';
  }

  private buildFilterClauses(params: (string | number)[]): string {
    if (this.config.filters.length === 0) {
      return '';
    }

    const clauses: string[] = [];

    for (const filter of this.config.filters) {
      const clause = this.buildSingleFilter(filter, params);
      if (clause) {
        clauses.push(clause);
      }
    }

    return clauses.length > 0 ? 'AND ' + clauses.join(' AND ') : '';
  }

  private buildSingleFilter(filter: CustomerQueryFilter, params: (string | number)[]): string {
    switch (filter.operator) {
      case '=':
      case '<>':
        params.push(filter.value as string);
        return `${filter.column} ${filter.operator} ?`;

      case 'IN':
      case 'NOT IN':
        const values = Array.isArray(filter.value) ? filter.value : [filter.value];
        const placeholders = values.map(() => '?').join(', ');
        params.push(...values);
        return `${filter.column} ${filter.operator} (${placeholders})`;

      default:
        return '';
    }
  }

  private formatDateUTC(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
