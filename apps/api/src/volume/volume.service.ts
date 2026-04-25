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

/** Latest `daily_environment_volume` row used for stats freshness (by `updatedAt`). */
export interface LastCalculatedDailyVolumeRow {
  environmentId: string;
  date: string;
  volume: number;
  depositCount: number;
  updatedAt: string;
}

export interface CustomerVolumeDetail {
  customerId: string;
  customerName: string;
  summary: {
    last30Days: MetricSet;
    today: MetricSet;
    monthToDate: MetricSet;
    previousMonth: MetricSet;
  };
  environments: {
    environmentId: string;
    last30Days: MetricSet;
    today: MetricSet;
    monthToDate: MetricSet;
    previousMonth: MetricSet;
  }[];
  /** Most recently updated snapshot row for this customer (null if none). */
  lastCalculatedDailyVolume?: LastCalculatedDailyVolumeRow | null;
  /** Snapshot row for `statsTodayDate` specifically (may differ from lastCalculated when sync updates older event days). */
  dailyVolumeForStatsToday?: LastCalculatedDailyVolumeRow | null;
  /** Which calendar day is treated as "today" for snapshot stats. */
  statsTodayDate?: string;
  /** IANA zone when `VOLUME_STATS_TIMEZONE` is set; otherwise server UTC calendar. */
  statsTimeZone?: string | null;
}

const CUSTOMER_DISPLAY_NAMES: Record<string, string> = {
  digiblox: 'Digiblox',
  coincashy: 'Coincashy',
  javashk: 'Javashk',
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

  private volumeStatsTimeZone(): string | undefined {
    const tz = process.env.VOLUME_STATS_TIMEZONE?.trim();
    return tz || undefined;
  }

  /** Calendar YYYY-MM-DD in UTC (matches Postgres `date` stored at UTC midnight). */
  private formatDateUTC(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** "Today" calendar date in optional IANA zone, else UTC calendar date (Vercel-friendly). */
  private calendarYmdNow(timeZone?: string): string {
    if (timeZone) {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(new Date());
      const y = parts.find((p) => p.type === 'year')!.value;
      const m = parts.find((p) => p.type === 'month')!.value;
      const d = parts.find((p) => p.type === 'day')!.value;
      return `${y}-${m}-${d}`;
    }
    return this.formatDateUTC(new Date());
  }

  private parseYmd(ymd: string): { y: number; m: number; d: number } {
    const [y, m, d] = ymd.split('-').map(Number);
    return { y, m, d };
  }

  private addDaysYmd(ymd: string, deltaDays: number): string {
    const { y, m, d } = this.parseYmd(ymd);
    const t = Date.UTC(y, m - 1, d + deltaDays, 12, 0, 0);
    return this.formatDateUTC(new Date(t));
  }

  private monthStartYmd(ymd: string): string {
    const { y, m } = this.parseYmd(ymd);
    return `${y}-${String(m).padStart(2, '0')}-01`;
  }

  private prevMonthFullRange(ymd: string): { start: string; end: string } {
    const { y, m } = this.parseYmd(ymd);
    const firstThisMonth = new Date(Date.UTC(y, m - 1, 1));
    const lastPrev = new Date(firstThisMonth.getTime() - 86400000);
    const py = lastPrev.getUTCFullYear();
    const pm = lastPrev.getUTCMonth() + 1;
    const end = this.formatDateUTC(lastPrev);
    const start = `${py}-${String(pm).padStart(2, '0')}-01`;
    return { start, end };
  }

  private toLastCalculatedRow(r: {
    environmentId: string;
    date: Date;
    volume: { toNumber(): number } | number;
    depositCount: number;
    updatedAt: Date;
  }): LastCalculatedDailyVolumeRow {
    const vol = typeof r.volume === 'number' ? r.volume : r.volume.toNumber();
    return {
      environmentId: r.environmentId,
      date: this.formatDateUTC(r.date),
      volume: Math.round(vol * 100) / 100,
      depositCount: r.depositCount,
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  async getAllCustomersStats(): Promise<CustomerVolumeDetail[]> {
    const isVercel = !!process.env.VERCEL;
    const configuredCustomerIds = this.depositRepository.getAllCustomerIds();
    this.logger.log(`Configured customers (with DB creds): ${configuredCustomerIds.length > 0 ? configuredCustomerIds.join(', ') : '(none)'}`);
    this.logger.log(`Environment: ${isVercel ? 'Vercel (serverless)' : 'Local/Other'}`);
    
    // In Vercel environment, always use snapshot data to avoid timeout issues
    // Real-time data fetching only works from environments that can reach AWS RDS
    if (isVercel) {
      this.logger.log('Running in Vercel - using cached snapshot data (RDS not accessible from serverless)');
      return this.getStatsFromSnapshotOnly();
    }
    
    if (configuredCustomerIds.length > 0) {
      try {
        const realTimeResults = await this.getStatsWithRealTimeData(configuredCustomerIds);
        const snapshotResults = await this.getStatsFromSnapshotOnly();
        const existing = new Set(realTimeResults.map((r) => r.customerId));
        const missingFromRealtime = snapshotResults.filter((r) => !existing.has(r.customerId));
        return [...realTimeResults, ...missingFromRealtime];
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
    const tz = this.volumeStatsTimeZone();
    const todayStr = this.calendarYmdNow(tz);
    const thirtyDaysAgoStr = this.addDaysYmd(todayStr, -30);
    const monthStartStr = this.monthStartYmd(todayStr);
    const { start: prevMonthStartStr, end: prevMonthEndStr } = this.prevMonthFullRange(todayStr);

    this.logger.log(`[Snapshot] Date calculations: today=${todayStr}, tz=${tz ?? '(UTC calendar)'}`);
    this.logger.log(`[Snapshot]   30 days ago: ${thirtyDaysAgoStr}, month start: ${monthStartStr}`);
    this.logger.log(`[Snapshot]   Previous month: ${prevMonthStartStr} to ${prevMonthEndStr}`);

    const prevMonthStartDate = new Date(prevMonthStartStr + 'T00:00:00Z');
    const todayDate = new Date(todayStr + 'T00:00:00Z');

    const allRecords = await this.repository.findByDateRange(prevMonthStartDate, todayDate);
    this.logger.log(`[Snapshot] Found ${allRecords.length} records for extended range`);

    if (allRecords.length === 0) {
      this.logger.warn('[Snapshot] No snapshot data found in database');
      return [];
    }

    const customerIds = [...new Set(allRecords.map((r) => r.customerId))];
    this.logger.log(`[Snapshot] Customers with data: ${customerIds.join(', ')}`);

    const latestRows = await Promise.all(
      customerIds.map((id) => this.repository.findLatestSnapshotByCustomer(id)),
    );
    const latestById = new Map<string, LastCalculatedDailyVolumeRow | null>();
    customerIds.forEach((id, i) => {
      const row = latestRows[i];
      latestById.set(id, row ? this.toLastCalculatedRow(row) : null);
    });

    const todayRows = await Promise.all(
      customerIds.map((id) => this.repository.findSnapshotByCustomerAndUtcYmd(id, todayStr)),
    );
    const todayRowById = new Map<string, LastCalculatedDailyVolumeRow | null>();
    customerIds.forEach((id, i) => {
      const row = todayRows[i];
      todayRowById.set(id, row ? this.toLastCalculatedRow(row) : null);
    });

    const results: CustomerVolumeDetail[] = [];

    for (const customerId of customerIds) {
      const customerRecords = allRecords.filter((r) => r.customerId === customerId);
      
      let last30DaysVolume = 0;
      let last30DaysCount = 0;
      let todayVolume = 0;
      let todayCount = 0;
      let mtdVolume = 0;
      let mtdCount = 0;
      let prevMonthVolume = 0;
      let prevMonthCount = 0;
      let hasTodayRecord = false;

      for (const record of customerRecords) {
        const recordDate = this.formatDateUTC(record.date);
        const volume = Number(record.volume);
        const count = record.depositCount || 0;

        if (recordDate >= thirtyDaysAgoStr && recordDate <= todayStr) {
          last30DaysVolume += volume;
          last30DaysCount += count;
        }

        if (recordDate === todayStr) {
          todayVolume = volume;
          todayCount = count;
          hasTodayRecord = true;
          this.logger.log(`[Snapshot] ${customerId}: Today (${todayStr}) = $${volume}, ${count} deposits`);
        }

        if (recordDate >= monthStartStr && recordDate <= todayStr) {
          mtdVolume += volume;
          mtdCount += count;
        }

        if (recordDate >= prevMonthStartStr && recordDate <= prevMonthEndStr) {
          prevMonthVolume += volume;
          prevMonthCount += count;
        }
      }

      if (!hasTodayRecord) {
        this.logger.log(`[Snapshot] ${customerId}: No record for today (${todayStr}) - showing $0`);
      }

      const last30DaysMetrics: MetricSet = {
        volume: Math.round(last30DaysVolume * 100) / 100,
        depositCount: last30DaysCount,
        avgPerDeposit: calculateAvgPerDeposit(last30DaysVolume, last30DaysCount),
      };
      const todayMetrics: MetricSet = {
        volume: Math.round(todayVolume * 100) / 100,
        depositCount: todayCount,
        avgPerDeposit: calculateAvgPerDeposit(todayVolume, todayCount),
      };
      const mtdMetrics: MetricSet = {
        volume: Math.round(mtdVolume * 100) / 100,
        depositCount: mtdCount,
        avgPerDeposit: calculateAvgPerDeposit(mtdVolume, mtdCount),
      };
      const prevMonthMetrics: MetricSet = {
        volume: Math.round(prevMonthVolume * 100) / 100,
        depositCount: prevMonthCount,
        avgPerDeposit: calculateAvgPerDeposit(prevMonthVolume, prevMonthCount),
      };

      results.push({
        customerId,
        customerName: CUSTOMER_DISPLAY_NAMES[customerId] || customerId,
        summary: {
          last30Days: last30DaysMetrics,
          today: todayMetrics,
          monthToDate: mtdMetrics,
          previousMonth: prevMonthMetrics,
        },
        environments: [
          {
            environmentId: customerId,
            last30Days: last30DaysMetrics,
            today: todayMetrics,
            monthToDate: mtdMetrics,
            previousMonth: prevMonthMetrics,
          },
        ],
        lastCalculatedDailyVolume: latestById.get(customerId) ?? null,
        dailyVolumeForStatsToday: todayRowById.get(customerId) ?? null,
        statsTodayDate: todayStr,
        statsTimeZone: tz ?? null,
      });
    }

    this.logger.log(`[Snapshot] Returning stats for ${results.length} customers`);
    return results;
  }

  /**
   * Format date as YYYY-MM-DD using LOCAL timezone (not UTC).
   * This ensures consistency with volume-sync service.
   */
  private formatDateLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
          previousMonth: this.createEmptyMetricSet(),
        },
        environments: [],
        lastCalculatedDailyVolume: null,
        dailyVolumeForStatsToday: null,
        statsTodayDate: this.calendarYmdNow(this.volumeStatsTimeZone()),
        statsTimeZone: this.volumeStatsTimeZone() ?? null,
      };
    }
  }

  async getCustomerStats(customerId: string): Promise<CustomerVolumeDetail> {
    const config = this.depositRepository.getCustomerConfig(customerId);
    if (!config) {
      throw new Error(`Unknown customer: ${customerId}`);
    }

    const tz = this.volumeStatsTimeZone();
    const todayStr = this.calendarYmdNow(tz);
    const today = new Date(todayStr + 'T00:00:00Z');
    const thirtyDaysAgoStr = this.addDaysYmd(todayStr, -30);
    const thirtyDaysAgo = new Date(thirtyDaysAgoStr + 'T00:00:00Z');
    const monthStartStr = this.monthStartYmd(todayStr);
    const monthStart = new Date(monthStartStr + 'T00:00:00Z');
    const { start: prevMonthStartStr, end: prevMonthEndStr } = this.prevMonthFullRange(todayStr);
    const prevMonthStart = new Date(prevMonthStartStr + 'T00:00:00Z');
    const prevMonthEnd = new Date(prevMonthEndStr + 'T00:00:00Z');

    this.logger.log(`[Stats] ${customerId}: today=${todayStr}, tz=${tz ?? '(UTC calendar)'}`);

    const [last30DaysMetrics, realTimeTodayMetrics, mtdMetrics, prevMonthMetrics] = await Promise.all([
      this.getMetricsForRange(customerId, thirtyDaysAgo, today),
      this.getRealTimeMetrics(customerId, today, today),
      this.getMonthToDateMetrics(customerId, monthStart, today),
      this.getPreviousMonthMetrics(customerId, prevMonthStart, prevMonthEnd),
    ]);

    // If real-time fetch returned 0 volume, try to get today's value from snapshot table
    let todayMetrics = realTimeTodayMetrics;
    if (todayMetrics.volume === 0) {
      try {
        const snapshotMetrics = await this.repository.getMetricsForDate(customerId, today);
        if (snapshotMetrics.volume > 0) {
          todayMetrics = {
            volume: snapshotMetrics.volume,
            depositCount: snapshotMetrics.depositCount,
            avgPerDeposit: calculateAvgPerDeposit(snapshotMetrics.volume, snapshotMetrics.depositCount),
          };
          this.logger.log(`[Stats] ${customerId}: Real-time returned 0, using snapshot: $${snapshotMetrics.volume}, ${snapshotMetrics.depositCount} deposits`);
        }
      } catch (error) {
        this.logger.debug(`[Stats] ${customerId}: Could not get snapshot value for today`);
      }
    }

    // Upsert today's volume and deposit count to the snapshot table on each refresh
    // Only save if we got actual data from real-time (not from snapshot fallback)
    if (realTimeTodayMetrics.volume > 0 || realTimeTodayMetrics.depositCount > 0) {
      try {
        await this.repository.upsertDailyVolume(
          customerId,
          customerId,
          today,
          realTimeTodayMetrics.volume,
          realTimeTodayMetrics.depositCount,
        );
        this.logger.debug(`[Stats] Upserted today's data for ${customerId}: $${realTimeTodayMetrics.volume}, ${realTimeTodayMetrics.depositCount} deposits`);
      } catch (error) {
        this.logger.warn(`[Stats] Failed to upsert today's data for ${customerId}`, error);
      }
    } else {
      this.logger.debug(`[Stats] Skipping upsert for ${customerId} - no real-time data returned`);
    }

    const [latest, todaySnapshot] = await Promise.all([
      this.repository.findLatestSnapshotByCustomer(customerId),
      this.repository.findSnapshotByCustomerAndUtcYmd(customerId, todayStr),
    ]);

    return {
      customerId,
      customerName: config.displayName,
      summary: {
        last30Days: last30DaysMetrics,
        today: todayMetrics,
        monthToDate: mtdMetrics,
        previousMonth: prevMonthMetrics,
      },
      environments: [
        {
          environmentId: customerId,
          last30Days: last30DaysMetrics,
          today: todayMetrics,
          monthToDate: mtdMetrics,
          previousMonth: prevMonthMetrics,
        },
      ],
      lastCalculatedDailyVolume: latest ? this.toLastCalculatedRow(latest) : null,
      dailyVolumeForStatsToday: todaySnapshot ? this.toLastCalculatedRow(todaySnapshot) : null,
      statsTodayDate: todayStr,
      statsTimeZone: tz ?? null,
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
    let cachedCount = 0;

    if (startDate <= cachedEndDate) {
      await this.ensureDataBackfilled(customerId, startDate, cachedEndDate);
      const cachedMetrics = await this.repository.sumMetricsForDateRange(
        customerId,
        startDate,
        cachedEndDate,
      );
      cachedVolume = cachedMetrics.volume;
      cachedCount = cachedMetrics.depositCount;
    }

    const today = this.getDateOnlyUTC(this.getNowUTC());
    let todayMetrics: MetricSet = this.createEmptyMetricSet();

    if (endDate >= today) {
      todayMetrics = await this.getRealTimeMetrics(customerId, today, today);
    }

    const totalVolume = Math.round((cachedVolume + todayMetrics.volume) * 100) / 100;
    const totalCount = cachedCount + todayMetrics.depositCount;
    
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
    let cachedCount = 0;
    if (monthStart <= yesterday) {
      await this.ensureDataBackfilled(customerId, monthStart, yesterday);
      const cachedMetrics = await this.repository.sumMetricsForDateRange(
        customerId,
        monthStart,
        yesterday,
      );
      cachedVolume = cachedMetrics.volume;
      cachedCount = cachedMetrics.depositCount;
    }

    const todayMetrics = await this.getRealTimeMetrics(customerId, today, today);

    const totalVolume = Math.round((cachedVolume + todayMetrics.volume) * 100) / 100;
    const totalCount = cachedCount + todayMetrics.depositCount;
    
    return {
      volume: totalVolume,
      depositCount: totalCount,
      avgPerDeposit: calculateAvgPerDeposit(totalVolume, totalCount),
    };
  }

  private async getPreviousMonthMetrics(
    customerId: string,
    prevMonthStart: Date,
    prevMonthEnd: Date,
  ): Promise<MetricSet> {
    // Previous month is fully in the past, so we can use cached data only
    await this.ensureDataBackfilled(customerId, prevMonthStart, prevMonthEnd);
    const cachedMetrics = await this.repository.sumMetricsForDateRange(
      customerId,
      prevMonthStart,
      prevMonthEnd,
    );

    return {
      volume: Math.round(cachedMetrics.volume * 100) / 100,
      depositCount: cachedMetrics.depositCount,
      avgPerDeposit: calculateAvgPerDeposit(cachedMetrics.volume, cachedMetrics.depositCount),
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
        const { totalUsd, totalCount } = this.calculateTotals(volumes, quotes);

        await this.repository.upsertDailyVolume(customerId, customerId, date, totalUsd, totalCount);
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

    this.logger.log(`[Snapshot] Starting capture for ${dateStr} (input: ${date.toISOString()}, dateOnly: ${dateOnly.toISOString()})`);
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
        const { totalUsd: volume, totalCount: depositCount } = this.calculateTotals(volumes, quotes);
        this.logger.log(`[Snapshot] ${customerId}: Calculated USD volume = $${volume.toFixed(2)}, deposits = ${depositCount}`);

        const record = await this.repository.upsertDailyVolume(customerId, customerId, dateOnly, volume, depositCount);
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
