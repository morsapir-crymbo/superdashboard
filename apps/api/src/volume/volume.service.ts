import { Injectable, Logger } from '@nestjs/common';
import { VolumeRepository } from './volume.repository';
import { DbConnectionsService } from '../shared/db-connections.service';
import { QuotesService } from '../shared/quotes.service';

export interface EnvironmentVolumeStats {
  customerId: string;
  customerName: string;
  last30Days: number;
  today: number;
  monthToDate: number;
}

export interface CustomerVolumeDetail {
  customerId: string;
  customerName: string;
  summary: {
    last30Days: number;
    today: number;
    monthToDate: number;
  };
  environments: {
    environmentId: string;
    last30Days: number;
    today: number;
    monthToDate: number;
  }[];
}

interface DepositRow {
  total_amount: number;
  currency: string;
  currency_id?: number;
}

@Injectable()
export class VolumeService {
  private readonly logger = new Logger(VolumeService.name);

  constructor(
    private repository: VolumeRepository,
    private dbConnections: DbConnectionsService,
    private quotesService: QuotesService,
  ) {}

  async getAllCustomersStats(): Promise<CustomerVolumeDetail[]> {
    const customers = this.dbConnections.getCustomerConfigs();
    const results: CustomerVolumeDetail[] = [];

    for (const customer of customers) {
      try {
        const stats = await this.getCustomerStats(customer.id);
        results.push(stats);
      } catch (error) {
        this.logger.error(`Failed to get stats for ${customer.id}`, error);
        results.push({
          customerId: customer.id,
          customerName: customer.displayName,
          summary: { last30Days: 0, today: 0, monthToDate: 0 },
          environments: [],
        });
      }
    }

    return results;
  }

  async getCustomerStats(customerId: string): Promise<CustomerVolumeDetail> {
    const config = this.dbConnections
      .getCustomerConfigs()
      .find((c) => c.id === customerId);

    if (!config) {
      throw new Error(`Unknown customer: ${customerId}`);
    }

    const now = new Date();
    const today = this.getDateOnly(now);
    const thirtyDaysAgo = this.getDateOnly(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [last30Days, todayVolume, mtd] = await Promise.all([
      this.getVolumeForRange(customerId, thirtyDaysAgo, today),
      this.getRealTimeVolume(customerId, today, today),
      this.getMonthToDateVolume(customerId, monthStart, today),
    ]);

    return {
      customerId,
      customerName: config.displayName,
      summary: {
        last30Days,
        today: todayVolume,
        monthToDate: mtd,
      },
      environments: [
        {
          environmentId: customerId,
          last30Days,
          today: todayVolume,
          monthToDate: mtd,
        },
      ],
    };
  }

  private async getVolumeForRange(
    customerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const yesterday = this.getDateOnly(new Date(Date.now() - 24 * 60 * 60 * 1000));
    
    const cachedEndDate = endDate > yesterday ? yesterday : endDate;
    
    if (startDate <= cachedEndDate) {
      const missingDates = await this.repository.getMissingDates(
        customerId,
        startDate,
        cachedEndDate,
      );

      if (missingDates.length > 0) {
        await this.backfillMissingDates(customerId, missingDates);
      }
    }

    let total = 0;

    if (startDate <= cachedEndDate) {
      total += await this.repository.sumVolumeForDateRange(
        customerId,
        startDate,
        cachedEndDate,
      );
    }

    const today = this.getDateOnly(new Date());
    if (endDate >= today) {
      total += await this.getRealTimeVolume(customerId, today, today);
    }

    return total;
  }

  private async getMonthToDateVolume(
    customerId: string,
    monthStart: Date,
    today: Date,
  ): Promise<number> {
    const yesterday = this.getDateOnly(new Date(Date.now() - 24 * 60 * 60 * 1000));

    let cachedVolume = 0;
    if (monthStart <= yesterday) {
      const missingDates = await this.repository.getMissingDates(
        customerId,
        monthStart,
        yesterday,
      );

      if (missingDates.length > 0) {
        await this.backfillMissingDates(customerId, missingDates);
      }

      cachedVolume = await this.repository.sumVolumeForDateRange(
        customerId,
        monthStart,
        yesterday,
      );
    }

    const todayVolume = await this.getRealTimeVolume(customerId, today, today);

    return cachedVolume + todayVolume;
  }

  private async backfillMissingDates(customerId: string, dates: Date[]): Promise<void> {
    this.logger.log(`Backfilling ${dates.length} dates for ${customerId}`);

    for (const date of dates) {
      try {
        const volume = await this.getRealTimeVolume(customerId, date, date);
        await this.repository.upsertDailyVolume(customerId, customerId, date, volume);
      } catch (error) {
        this.logger.error(`Failed to backfill ${customerId} for ${date}`, error);
      }
    }
  }

  async getRealTimeVolume(
    customerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const startStr = this.formatDate(startDate);
    const endStr = this.formatDate(endDate) + ' 23:59:59';

    const query = this.dbConnections.getVolumeQuery(customerId, startStr, endStr);
    const quotes = await this.quotesService.getQuotes();

    try {
      const rows = await this.dbConnections.queryCustomerDb<DepositRow>(customerId, query);

      let totalUsd = 0;
      for (const row of rows) {
        const amount = Number(row.total_amount) || 0;
        totalUsd += this.quotesService.convertToUsd(amount, row.currency, quotes);
      }

      return Math.round(totalUsd * 100) / 100;
    } catch (error) {
      this.logger.error(`Failed to query ${customerId}`, error);
      return 0;
    }
  }

  async captureSnapshotForDate(date: Date): Promise<void> {
    const customers = this.dbConnections.getCustomerConfigs();
    const dateOnly = this.getDateOnly(date);

    for (const customer of customers) {
      try {
        const volume = await this.getRealTimeVolume(customer.id, dateOnly, dateOnly);
        await this.repository.upsertDailyVolume(
          customer.id,
          customer.id,
          dateOnly,
          volume,
        );
        this.logger.log(`Captured snapshot for ${customer.id}: $${volume}`);
      } catch (error) {
        this.logger.error(`Failed to capture snapshot for ${customer.id}`, error);
      }
    }
  }

  private getDateOnly(date: Date): Date {
    return new Date(date.toISOString().split('T')[0]);
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
