import { Injectable, Logger } from '@nestjs/common';
import { VolumeRepository } from './volume.repository';
import { DepositRepository } from '../deposit/deposit.repository';
import { QuotesService } from '../shared/quotes.service';
import { DepositVolumeResult, VolumeMetrics, calculateAvgPerDeposit } from '../deposit/types/deposit.dto';
import { getAllDefinedCustomerIds } from '../deposit/types/customer-config';

export interface MetricSet {
  volume: number;
  depositCount: number;
  avgPerDeposit: number;
}

export interface CustomerVolumeDetail {
  customerId: string;
  customerName: string;
  summary: {
    last30Days: MetricSet;
    today: MetricSet;
    monthToDate: MetricSet;
  };
  environments: {
    environmentId: string;
    last30Days: MetricSet;
    today: MetricSet;
    monthToDate: MetricSet;
  }[];
}

const CUSTOMER_DISPLAY_NAMES: Record<string, string> = {
  digiblox: 'Digiblox',
  javashk: 'Javashk',
  montrex: 'Montrex',
  orocalab: 'Orocalab',
  bnp: 'BNP',
};

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
    const configuredCustomerIds = this.depositRepository.getAllCustomerIds();
    this.logger.log(`Configured customers (with DB creds): ${configuredCustomerIds.length > 0 ? configuredCustomerIds.join(', ') : '(none)'}`);
    
    if (configuredCustomerIds.length > 0) {
      try {
        return await this.getStatsWithRealTimeData(configuredCustomerIds);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to get real-time data: ${message}`);
        this.logger.log('Falling back to cached snapshot data due to connection error');
        return this.getStatsFromSnapshotOnly();
      }
    }

    this.logger.log('No customers configured with DB credentials - falling back to cached snapshot data');
    return this.getStatsFromSnapshotOnly();
  }

  private async getStatsWithRealTimeData(customerIds: string[]): Promise<CustomerVolumeDetail[]> {
    const results: CustomerVolumeDetail[] = [];
    let connectionFailures = 0;

    for (let i = 0; i < customerIds.length; i += this.CONCURRENCY_LIMIT) {
      const batch = customerIds.slice(i, i + this.CONCURRENCY_LIMIT);
      this.logger.debug(`Processing batch: ${batch.join(', ')}`);
      const batchResults = await Promise.all(
        batch.map((id) => this.getCustomerStatsSafe(id)),
      );
      
      // Count how many returned zero data (likely connection failures)
      for (const result of batchResults) {
        if (result.summary.last30Days.volume === 0 && result.summary.today.volume === 0 && result.summary.monthToDate.volume === 0) {
          connectionFailures++;
        }
      }
      
      results.push(...batchResults);
      
      // If first batch all failed, likely network issue - fall back to cached data
      if (i === 0 && connectionFailures === batch.length) {
        this.logger.warn(`All ${batch.length} customers in first batch returned zero data - likely connection issue`);
        this.logger.log('Falling back to cached snapshot data');
        return this.getStatsFromSnapshotOnly();
      }
    }

    this.logger.log(`Completed fetching stats for ${results.length} customers (${connectionFailures} potential failures)`);
    return results;
  }

  private async getStatsFromSnapshotOnly(): Promise<CustomerVolumeDetail[]> {
    const now = this.getNowUTC();
    const today = this.getDateOnlyUTC(now);
    const thirtyDaysAgo = this.getDateOnlyUTC(
      new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    );
    const monthStart = this.getMonthStartUTC(now);

    const allRecords = await this.repository.findByDateRange(thirtyDaysAgo, today);
    this.logger.log(`Found ${allRecords.length} snapshot records for last 30 days`);

    if (allRecords.length === 0) {
      this.logger.warn('No snapshot data found in database');
      return [];
    }

    const customerIds = [...new Set(allRecords.map((r) => r.customerId))];
    this.logger.log(`Customers with snapshot data: ${customerIds.join(', ')}`);

    const results: CustomerVolumeDetail[] = [];

    for (const customerId of customerIds) {
      const customerRecords = allRecords.filter((r) => r.customerId === customerId);
      
      // Sort records by date descending to find the most recent non-zero value
      const sortedRecords = [...customerRecords].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      
      let last30Days = 0;
      let todayVolume = 0;
      let monthToDate = 0;
      let lastKnownDailyVolume = 0;

      // Find the most recent non-zero daily volume (for fallback)
      for (const record of sortedRecords) {
        const volume = Number(record.volume);
        if (volume > 0) {
          lastKnownDailyVolume = volume;
          break;
        }
      }

      for (const record of customerRecords) {
        const recordDate = record.date.toISOString().split('T')[0];
        const todayStr = today.toISOString().split('T')[0];
        const monthStartStr = monthStart.toISOString().split('T')[0];
        const volume = Number(record.volume);

        last30Days += volume;

        if (recordDate === todayStr) {
          todayVolume = volume > 0 ? volume : lastKnownDailyVolume;
          if (volume === 0 && lastKnownDailyVolume > 0) {
            this.logger.log(`[Snapshot] ${customerId}: Today value is 0, using last known value: $${lastKnownDailyVolume}`);
          }
        }

        if (recordDate >= monthStartStr) {
          monthToDate += volume;
        }
      }

      const hasTodayRecord = customerRecords.some(r => 
        r.date.toISOString().split('T')[0] === today.toISOString().split('T')[0]
      );
      if (!hasTodayRecord && lastKnownDailyVolume > 0) {
        todayVolume = lastKnownDailyVolume;
        this.logger.log(`[Snapshot] ${customerId}: No today record, using last known value: $${lastKnownDailyVolume}`);
      }

      // Note: Snapshot data doesn't include deposit counts, so we show 0 for those
      const last30DaysMetrics: MetricSet = {
        volume: Math.round(last30Days * 100) / 100,
        depositCount: 0,
        avgPerDeposit: 0,
      };
      const todayMetrics: MetricSet = {
        volume: Math.round(todayVolume * 100) / 100,
        depositCount: 0,
        avgPerDeposit: 0,
      };
      const mtdMetrics: MetricSet = {
        volume: Math.round(monthToDate * 100) / 100,
        depositCount: 0,
        avgPerDeposit: 0,
      };

      results.push({
        customerId,
        customerName: CUSTOMER_DISPLAY_NAMES[customerId] || customerId,
        summary: {
          last30Days: last30DaysMetrics,
          today: todayMetrics,
          monthToDate: mtdMetrics,
        },
        environments: [
          {
            environmentId: customerId,
            last30Days: last30DaysMetrics,
            today: todayMetrics,
            monthToDate: mtdMetrics,
          },
        ],
      });
    }

    this.logger.log(`Returning stats for ${results.length} customers from snapshot data`);
    return results;
  }

  private createEmptyMetricSet(): MetricSet {
    return { volume: 0, depositCount: 0, avgPerDeposit: 0 };
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
        summary: {
          last30Days: this.createEmptyMetricSet(),
          today: this.createEmptyMetricSet(),
          monthToDate: this.createEmptyMetricSet(),
        },
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

    const [last30DaysMetrics, realTimeTodayMetrics, mtdMetrics] = await Promise.all([
      this.getMetricsForRange(customerId, thirtyDaysAgo, today),
      this.getRealTimeMetrics(customerId, today, today),
      this.getMonthToDateMetrics(customerId, monthStart, today),
    ]);

    // If real-time fetch returned 0 volume, try to get today's value from snapshot table
    let todayMetrics = realTimeTodayMetrics;
    if (todayMetrics.volume === 0) {
      try {
        const snapshotValue = await this.repository.getVolumeForDate(customerId, today);
        if (snapshotValue > 0) {
          todayMetrics = {
            volume: snapshotValue,
            depositCount: 0, // We don't store deposit count in snapshot
            avgPerDeposit: 0,
          };
          this.logger.log(`[Stats] ${customerId}: Real-time returned 0, using snapshot value: $${snapshotValue}`);
        }
      } catch (error) {
        this.logger.debug(`[Stats] ${customerId}: Could not get snapshot value for today`);
      }
    }

    // Upsert today's volume to the snapshot table on each refresh
    // Only save if we got actual data from real-time (not from snapshot fallback)
    if (realTimeTodayMetrics.volume > 0) {
      try {
        await this.repository.upsertDailyVolume(customerId, customerId, today, realTimeTodayMetrics.volume);
        this.logger.debug(`[Stats] Upserted today's volume for ${customerId}: $${realTimeTodayMetrics.volume}`);
      } catch (error) {
        this.logger.warn(`[Stats] Failed to upsert today's volume for ${customerId}`, error);
      }
    } else {
      this.logger.debug(`[Stats] Skipping upsert for ${customerId} - no real-time data returned`);
    }

    return {
      customerId,
      customerName: config.displayName,
      summary: {
        last30Days: last30DaysMetrics,
        today: todayMetrics,
        monthToDate: mtdMetrics,
      },
      environments: [
        {
          environmentId: customerId,
          last30Days: last30DaysMetrics,
          today: todayMetrics,
          monthToDate: mtdMetrics,
        },
      ],
    };
  }

  private async getMetricsForRange(
    customerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<MetricSet> {
    const yesterday = this.getYesterdayUTC();
    const cachedEndDate = endDate > yesterday ? yesterday : endDate;

    let cachedVolume = 0;

    if (startDate <= cachedEndDate) {
      await this.ensureDataBackfilled(customerId, startDate, cachedEndDate);
      cachedVolume = await this.repository.sumVolumeForDateRange(
        customerId,
        startDate,
        cachedEndDate,
      );
    }

    const today = this.getDateOnlyUTC(this.getNowUTC());
    let todayMetrics: MetricSet = this.createEmptyMetricSet();

    if (endDate >= today) {
      todayMetrics = await this.getRealTimeMetrics(customerId, today, today);
    }

    const totalVolume = Math.round((cachedVolume + todayMetrics.volume) * 100) / 100;
    const totalCount = todayMetrics.depositCount; // Only today's count for now (historical not stored)
    
    return {
      volume: totalVolume,
      depositCount: totalCount,
      avgPerDeposit: calculateAvgPerDeposit(totalVolume, totalCount),
    };
  }

  private async getMonthToDateMetrics(
    customerId: string,
    monthStart: Date,
    today: Date,
  ): Promise<MetricSet> {
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

    const todayMetrics = await this.getRealTimeMetrics(customerId, today, today);

    const totalVolume = Math.round((cachedVolume + todayMetrics.volume) * 100) / 100;
    const totalCount = todayMetrics.depositCount; // Only today's count for now
    
    return {
      volume: totalVolume,
      depositCount: totalCount,
      avgPerDeposit: calculateAvgPerDeposit(totalVolume, totalCount),
    };
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
        const { totalUsd } = this.calculateTotals(volumes, quotes);

        await this.repository.upsertDailyVolume(customerId, customerId, date, totalUsd);
      }

      this.logger.log(`Backfill completed for ${customerId}`);
    } catch (error) {
      this.logger.error(`Backfill failed for ${customerId}`, error);
    }
  }

  async getRealTimeMetrics(
    customerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<MetricSet> {
    try {
      const volumes = await this.depositRepository.getVolumeByDateRange(customerId, {
        start: startDate,
        end: endDate,
      });

      const quotes = await this.quotesService.getQuotes();
      const { totalUsd, totalCount } = this.calculateTotals(volumes, quotes);
      
      return {
        volume: totalUsd,
        depositCount: totalCount,
        avgPerDeposit: calculateAvgPerDeposit(totalUsd, totalCount),
      };
    } catch (error) {
      this.logger.error(`Failed to get real-time metrics for ${customerId}`, error);
      return this.createEmptyMetricSet();
    }
  }

  private calculateTotals(
    volumes: DepositVolumeResult[],
    quotes: Record<string, number>,
  ): { totalUsd: number; totalCount: number } {
    let totalUsd = 0;
    let totalCount = 0;

    for (const vol of volumes) {
      totalUsd += this.quotesService.convertToUsd(vol.amount, vol.currency, quotes);
      totalCount += vol.depositCount;
    }

    return {
      totalUsd: Math.round(totalUsd * 100) / 100,
      totalCount,
    };
  }

  async captureSnapshotForDate(date: Date): Promise<{ success: string[]; failed: string[]; skipped: string[] }> {
    const customerIds = this.depositRepository.getAllCustomerIds();
    const dateOnly = this.getDateOnlyUTC(date);
    const dateStr = dateOnly.toISOString().split('T')[0];
    const success: string[] = [];
    const failed: string[] = [];
    const skipped: string[] = [];

    this.logger.log(`[Snapshot] Starting capture for ${dateStr}`);
    this.logger.log(`[Snapshot] Customers to process: ${customerIds.length > 0 ? customerIds.join(', ') : '(none)'}`);

    if (customerIds.length === 0) {
      this.logger.warn('[Snapshot] No customers configured - check environment variables');
      return { success: [], failed: [], skipped: [] };
    }

    for (const customerId of customerIds) {
      try {
        this.logger.log(`[Snapshot] Processing ${customerId} for ${dateStr}...`);
        
        const volumes = await this.depositRepository.getVolumeByDateRange(customerId, {
          start: dateOnly,
          end: dateOnly,
        });
        this.logger.log(`[Snapshot] ${customerId}: Got ${volumes.length} currency rows from DB`);

        // If no data returned, don't save 0 - this likely means connection failed
        if (volumes.length === 0) {
          this.logger.warn(`[Snapshot] ${customerId}: No data returned - skipping to preserve existing value`);
          skipped.push(customerId);
          continue;
        }

        const quotes = await this.quotesService.getQuotes();
        const { totalUsd: volume } = this.calculateTotals(volumes, quotes);
        this.logger.log(`[Snapshot] ${customerId}: Calculated USD volume = $${volume.toFixed(2)}`);

        const record = await this.repository.upsertDailyVolume(customerId, customerId, dateOnly, volume);
        this.logger.log(`[Snapshot] ${customerId}: Saved to daily_environment_volume (id=${record.id})`);
        
        success.push(customerId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`[Snapshot] ${customerId}: FAILED - ${message}`);
        failed.push(customerId);
      }
    }

    this.logger.log(`[Snapshot] Completed for ${dateStr}: ${success.length} success, ${failed.length} failed, ${skipped.length} skipped`);
    return { success, failed, skipped };
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
