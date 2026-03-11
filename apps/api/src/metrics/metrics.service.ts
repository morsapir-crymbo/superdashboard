import { Injectable, Logger } from '@nestjs/common';
import { MetricsRepository } from './metrics.repository';
import {
  CustomerExtendedMetrics,
  DailyMetricsRow,
  ExtendedMetricSet,
  CryptoFiatMetrics,
  createEmptyCustomerMetrics,
  calculateAvg,
  combineMetricSets,
} from './metrics.types';

interface CustomerConfig {
  id: string;
  displayName: string;
}

const CUSTOMER_CONFIGS: CustomerConfig[] = [
  { id: 'digiblox', displayName: 'Digiblox' },
  { id: 'javashk', displayName: 'Javashk' },
  { id: 'montrex', displayName: 'Montrex' },
  { id: 'orocalab', displayName: 'Orocalab' },
  { id: 'bnp', displayName: 'BNP' },
];

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(private readonly repository: MetricsRepository) {}

  private formatDateLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getDateRanges(): {
    today: { start: Date; end: Date };
    last30Days: { start: Date; end: Date };
    monthToDate: { start: Date; end: Date };
    previousMonth: { start: Date; end: Date };
  } {
    const now = new Date();
    const todayStr = this.formatDateLocal(now);
    const today = new Date(todayStr + 'T00:00:00Z');

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    const thirtyDaysAgoStr = this.formatDateLocal(thirtyDaysAgo);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartStr = this.formatDateLocal(monthStart);

    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    return {
      today: {
        start: new Date(todayStr + 'T00:00:00Z'),
        end: new Date(todayStr + 'T23:59:59Z'),
      },
      last30Days: {
        start: new Date(thirtyDaysAgoStr + 'T00:00:00Z'),
        end: new Date(todayStr + 'T23:59:59Z'),
      },
      monthToDate: {
        start: new Date(monthStartStr + 'T00:00:00Z'),
        end: new Date(todayStr + 'T23:59:59Z'),
      },
      previousMonth: {
        start: new Date(this.formatDateLocal(prevMonthStart) + 'T00:00:00Z'),
        end: new Date(this.formatDateLocal(prevMonthEnd) + 'T23:59:59Z'),
      },
    };
  }

  private aggregateRows(rows: DailyMetricsRow[]): CustomerExtendedMetrics {
    const result = createEmptyCustomerMetrics('', '');

    for (const row of rows) {
      // Deposits - Crypto
      result.deposits.crypto.volume += row.cryptoDepositVolume;
      result.deposits.crypto.count += row.cryptoDepositCount;
      result.deposits.crypto.fees += row.cryptoDepositFees;

      // Deposits - Fiat
      result.deposits.fiat.volume += row.fiatDepositVolume;
      result.deposits.fiat.count += row.fiatDepositCount;
      result.deposits.fiat.fees += row.fiatDepositFees;

      // Withdrawals - Crypto
      result.withdrawals.crypto.volume += row.cryptoWithdrawalVolume;
      result.withdrawals.crypto.count += row.cryptoWithdrawalCount;
      result.withdrawals.crypto.fees += row.cryptoWithdrawalFees;

      // Withdrawals - Fiat
      result.withdrawals.fiat.volume += row.fiatWithdrawalVolume;
      result.withdrawals.fiat.count += row.fiatWithdrawalCount;
      result.withdrawals.fiat.fees += row.fiatWithdrawalFees;

      // Transfers
      result.transfers.volume += row.transferVolume;
      result.transfers.count += row.transferCount;
      result.transfers.fees += row.transferFees;

      // Trades
      result.trades.volume += row.tradeVolume;
      result.trades.count += row.tradeCount;
      result.trades.fees += row.tradeFees;

      // KYT
      result.kyt.count += row.kytEventCount;
    }

    // Calculate averages for deposits
    result.deposits.crypto.avgPerTransaction = calculateAvg(
      result.deposits.crypto.volume,
      result.deposits.crypto.count,
    );
    result.deposits.crypto.avgFeePerTransaction = calculateAvg(
      result.deposits.crypto.fees,
      result.deposits.crypto.count,
    );
    result.deposits.fiat.avgPerTransaction = calculateAvg(
      result.deposits.fiat.volume,
      result.deposits.fiat.count,
    );
    result.deposits.fiat.avgFeePerTransaction = calculateAvg(
      result.deposits.fiat.fees,
      result.deposits.fiat.count,
    );
    result.deposits.total = combineMetricSets(result.deposits.crypto, result.deposits.fiat);

    // Calculate averages for withdrawals
    result.withdrawals.crypto.avgPerTransaction = calculateAvg(
      result.withdrawals.crypto.volume,
      result.withdrawals.crypto.count,
    );
    result.withdrawals.crypto.avgFeePerTransaction = calculateAvg(
      result.withdrawals.crypto.fees,
      result.withdrawals.crypto.count,
    );
    result.withdrawals.fiat.avgPerTransaction = calculateAvg(
      result.withdrawals.fiat.volume,
      result.withdrawals.fiat.count,
    );
    result.withdrawals.fiat.avgFeePerTransaction = calculateAvg(
      result.withdrawals.fiat.fees,
      result.withdrawals.fiat.count,
    );
    result.withdrawals.total = combineMetricSets(result.withdrawals.crypto, result.withdrawals.fiat);

    // Calculate averages for transfers
    result.transfers.avgPerTransaction = calculateAvg(result.transfers.volume, result.transfers.count);
    result.transfers.avgFeePerTransaction = calculateAvg(result.transfers.fees, result.transfers.count);

    // Calculate averages for trades
    result.trades.avgPerTransaction = calculateAvg(result.trades.volume, result.trades.count);
    result.trades.avgFeePerTransaction = calculateAvg(result.trades.fees, result.trades.count);

    // Round volumes
    result.deposits.crypto.volume = Math.round(result.deposits.crypto.volume * 100) / 100;
    result.deposits.crypto.fees = Math.round(result.deposits.crypto.fees * 100) / 100;
    result.deposits.fiat.volume = Math.round(result.deposits.fiat.volume * 100) / 100;
    result.deposits.fiat.fees = Math.round(result.deposits.fiat.fees * 100) / 100;
    result.withdrawals.crypto.volume = Math.round(result.withdrawals.crypto.volume * 100) / 100;
    result.withdrawals.crypto.fees = Math.round(result.withdrawals.crypto.fees * 100) / 100;
    result.withdrawals.fiat.volume = Math.round(result.withdrawals.fiat.volume * 100) / 100;
    result.withdrawals.fiat.fees = Math.round(result.withdrawals.fiat.fees * 100) / 100;
    result.transfers.volume = Math.round(result.transfers.volume * 100) / 100;
    result.transfers.fees = Math.round(result.transfers.fees * 100) / 100;
    result.trades.volume = Math.round(result.trades.volume * 100) / 100;
    result.trades.fees = Math.round(result.trades.fees * 100) / 100;

    // Calculate fee totals
    result.fees.deposits = Math.round((result.deposits.crypto.fees + result.deposits.fiat.fees) * 100) / 100;
    result.fees.withdrawals = Math.round((result.withdrawals.crypto.fees + result.withdrawals.fiat.fees) * 100) / 100;
    result.fees.transfers = Math.round(result.transfers.fees * 100) / 100;
    result.fees.trades = Math.round(result.trades.fees * 100) / 100;
    result.fees.total = Math.round((result.fees.deposits + result.fees.withdrawals + result.fees.transfers + result.fees.trades) * 100) / 100;

    return result;
  }

  async getAllCustomersExtendedStats(): Promise<{
    customers: {
      customerId: string;
      customerName: string;
      today: CustomerExtendedMetrics;
      last30Days: CustomerExtendedMetrics;
      monthToDate: CustomerExtendedMetrics;
      previousMonth: CustomerExtendedMetrics;
    }[];
  }> {
    const ranges = this.getDateRanges();

    this.logger.log('Fetching extended metrics for all customers');
    this.logger.log(`  Today: ${this.formatDateLocal(ranges.today.start)}`);
    this.logger.log(`  Last 30 Days: ${this.formatDateLocal(ranges.last30Days.start)} to ${this.formatDateLocal(ranges.last30Days.end)}`);
    this.logger.log(`  MTD: ${this.formatDateLocal(ranges.monthToDate.start)} to ${this.formatDateLocal(ranges.monthToDate.end)}`);
    this.logger.log(`  Prev Month: ${this.formatDateLocal(ranges.previousMonth.start)} to ${this.formatDateLocal(ranges.previousMonth.end)}`);

    // Fetch all data in one query (from prev month start to today)
    const allRecords = await this.repository.findByDateRange(
      ranges.previousMonth.start,
      ranges.today.end,
    );

    this.logger.log(`  Fetched ${allRecords.length} daily records`);

    // Group by customer
    const recordsByCustomer = new Map<string, DailyMetricsRow[]>();
    for (const record of allRecords) {
      const existing = recordsByCustomer.get(record.customerId) || [];
      existing.push(record);
      recordsByCustomer.set(record.customerId, existing);
    }

    // Process each customer
    const customers = CUSTOMER_CONFIGS.map((config) => {
      const customerRecords = recordsByCustomer.get(config.id) || [];

      // Filter records for each time period
      const todayRecords = customerRecords.filter(
        (r) => r.date >= ranges.today.start && r.date <= ranges.today.end,
      );
      const last30DaysRecords = customerRecords.filter(
        (r) => r.date >= ranges.last30Days.start && r.date <= ranges.last30Days.end,
      );
      const mtdRecords = customerRecords.filter(
        (r) => r.date >= ranges.monthToDate.start && r.date <= ranges.monthToDate.end,
      );
      const prevMonthRecords = customerRecords.filter(
        (r) => r.date >= ranges.previousMonth.start && r.date <= ranges.previousMonth.end,
      );

      const today = this.aggregateRows(todayRecords);
      const last30Days = this.aggregateRows(last30DaysRecords);
      const monthToDate = this.aggregateRows(mtdRecords);
      const previousMonth = this.aggregateRows(prevMonthRecords);

      // Set customer info
      today.customerId = config.id;
      today.customerName = config.displayName;
      last30Days.customerId = config.id;
      last30Days.customerName = config.displayName;
      monthToDate.customerId = config.id;
      monthToDate.customerName = config.displayName;
      previousMonth.customerId = config.id;
      previousMonth.customerName = config.displayName;

      return {
        customerId: config.id,
        customerName: config.displayName,
        today,
        last30Days,
        monthToDate,
        previousMonth,
      };
    });

    return { customers };
  }
}
