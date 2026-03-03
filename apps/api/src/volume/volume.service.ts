import { Injectable, Logger } from '@nestjs/common';
import { VolumeRepository } from './volume.repository';
import { DepositRepository } from '../deposit/deposit.repository';
import { QuotesService } from '../shared/quotes.service';
import { DepositVolumeResult } from '../deposit/types/deposit.dto';

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

@Injectable()
export class VolumeService {
  private readonly logger = new Logger(VolumeService.name);
  private readonly backfillLocks: Map<string, Promise<void>> = new Map();
  private readonly CONCURRENCY_LIMIT = 3;

  constructor(
    private repository: VolumeRepository,
    private depositRepository: DepositRepository,
    private quotesService: QuotesService,
  ) {}

  async getAllCustomersStats(): Promise<CustomerVolumeDetail[]> {
    const customerIds = this.depositRepository.getAllCustomerIds();
    const results: CustomerVolumeDetail[] = [];

    for (let i = 0; i < customerIds.length; i += this.CONCURRENCY_LIMIT) {
      const batch = customerIds.slice(i, i + this.CONCURRENCY_LIMIT);
      const batchResults = await Promise.all(
        batch.map((id) => this.getCustomerStatsSafe(id)),
      );
      results.push(...batchResults);
    }

    return results;
  }

  private async getCustomerStatsSafe(customerId: string): Promise<CustomerVolumeDetail> {
    try {
      return await this.getCustomerStats(customerId);
    } catch (error) {
      this.logger.error(`Failed to get stats for ${customerId}`, error);
      const config = this.depositRepository.getCustomerConfig(customerId);
      return {
        customerId,
        customerName: config?.displayName || customerId,
        summary: { last30Days: 0, today: 0, monthToDate: 0 },
        environments: [],
      };
    }
  }

  async getCustomerStats(customerId: string): Promise<CustomerVolumeDetail> {
    const config = this.depositRepository.getCustomerConfig(customerId);
    if (!config) {
      throw new Error(`Unknown customer: ${customerId}`);
    }

    const now = this.getNowUTC();
    const today = this.getDateOnlyUTC(now);
    const thirtyDaysAgo = this.getDateOnlyUTC(
      new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    );
    const monthStart = this.getMonthStartUTC(now);

    const [last30Days, todayVolume, mtd] = await Promise.all([
      this.getVolumeForRange(customerId, thirtyDaysAgo, today),
      this.getRealTimeVolumeUsd(customerId, today, today),
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
    const yesterday = this.getYesterdayUTC();
    const cachedEndDate = endDate > yesterday ? yesterday : endDate;

    let cachedTotal = 0;

    if (startDate <= cachedEndDate) {
      await this.ensureDataBackfilled(customerId, startDate, cachedEndDate);
      cachedTotal = await this.repository.sumVolumeForDateRange(
        customerId,
        startDate,
        cachedEndDate,
      );
    }

    const today = this.getDateOnlyUTC(this.getNowUTC());
    let todayTotal = 0;

    if (endDate >= today) {
      todayTotal = await this.getRealTimeVolumeUsd(customerId, today, today);
    }

    return Math.round((cachedTotal + todayTotal) * 100) / 100;
  }

  private async getMonthToDateVolume(
    customerId: string,
    monthStart: Date,
    today: Date,
  ): Promise<number> {
    const yesterday = this.getYesterdayUTC();

    let cachedVolume = 0;
    if (monthStart <= yesterday) {
      await this.ensureDataBackfilled(customerId, monthStart, yesterday);
      cachedVolume = await this.repository.sumVolumeForDateRange(
        customerId,
        monthStart,
        yesterday,
      );
    }

    const todayVolume = await this.getRealTimeVolumeUsd(customerId, today, today);

    return Math.round((cachedVolume + todayVolume) * 100) / 100;
  }

  private async ensureDataBackfilled(
    customerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    const lockKey = `${customerId}:${this.formatDate(startDate)}:${this.formatDate(endDate)}`;
    
    const existingLock = this.backfillLocks.get(lockKey);
    if (existingLock) {
      await existingLock;
      return;
    }

    const backfillPromise = this.performBackfill(customerId, startDate, endDate);
    this.backfillLocks.set(lockKey, backfillPromise);

    try {
      await backfillPromise;
    } finally {
      this.backfillLocks.delete(lockKey);
    }
  }

  private async performBackfill(
    customerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    const missingDates = await this.repository.getMissingDates(
      customerId,
      startDate,
      endDate,
    );

    if (missingDates.length === 0) {
      return;
    }

    this.logger.log(`Backfilling ${missingDates.length} dates for ${customerId}`);

    try {
      const volumesByDate = await this.depositRepository.batchGetDailyVolumes(
        customerId,
        missingDates,
      );

      const quotes = await this.quotesService.getQuotes();

      for (const date of missingDates) {
        const dateKey = this.formatDate(date);
        const volumes = volumesByDate.get(dateKey) || [];
        const totalUsd = this.calculateTotalUsd(volumes, quotes);

        await this.repository.upsertDailyVolume(customerId, customerId, date, totalUsd);
      }

      this.logger.log(`Backfill completed for ${customerId}`);
    } catch (error) {
      this.logger.error(`Backfill failed for ${customerId}`, error);
    }
  }

  async getRealTimeVolumeUsd(
    customerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    try {
      const volumes = await this.depositRepository.getVolumeByDateRange(customerId, {
        start: startDate,
        end: endDate,
      });

      const quotes = await this.quotesService.getQuotes();
      return this.calculateTotalUsd(volumes, quotes);
    } catch (error) {
      this.logger.error(`Failed to get real-time volume for ${customerId}`, error);
      return 0;
    }
  }

  private calculateTotalUsd(
    volumes: DepositVolumeResult[],
    quotes: Record<string, number>,
  ): number {
    let total = 0;

    for (const vol of volumes) {
      total += this.quotesService.convertToUsd(vol.amount, vol.currency, quotes);
    }

    return Math.round(total * 100) / 100;
  }

  async captureSnapshotForDate(date: Date): Promise<{ success: string[]; failed: string[] }> {
    const customerIds = this.depositRepository.getAllCustomerIds();
    const dateOnly = this.getDateOnlyUTC(date);
    const success: string[] = [];
    const failed: string[] = [];

    for (const customerId of customerIds) {
      try {
        const volume = await this.getRealTimeVolumeUsd(customerId, dateOnly, dateOnly);
        await this.repository.upsertDailyVolume(customerId, customerId, dateOnly, volume);
        this.logger.log(`Snapshot captured for ${customerId}: $${volume}`);
        success.push(customerId);
      } catch (error) {
        this.logger.error(`Snapshot failed for ${customerId}`, error);
        failed.push(customerId);
      }
    }

    return { success, failed };
  }

  private getNowUTC(): Date {
    return new Date();
  }

  private getDateOnlyUTC(date: Date): Date {
    const utcDate = new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    ));
    return utcDate;
  }

  private getYesterdayUTC(): Date {
    const now = this.getNowUTC();
    return this.getDateOnlyUTC(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  }

  private getMonthStartUTC(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
