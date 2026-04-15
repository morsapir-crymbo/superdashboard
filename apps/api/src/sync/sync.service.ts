import { Injectable, Logger } from '@nestjs/common';
import { QuotesService } from '../shared/quotes.service';
import { SyncRepository } from './sync.repository';
import { getCustomerApiConfigs } from './customer-config';
import { getJwt, fetchRecentUpdatedListAll, toFiatAmount } from './api-client';
import {
  CustomerApiConfig,
  SyncSource,
  SyncSourceRecordInput,
  DailyMetricsDelta,
  SyncResult,
} from './types';

const SOURCES: SyncSource[] = ['deposits', 'transfers', 'withdrawals', 'trades'];
const UPDATED_AFTER_LOOKBACK_MS = 5 * 60 * 1000;

function dateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function emptyDelta(): DailyMetricsDelta {
  return {
    cryptoDepositVolume: 0, cryptoDepositCount: 0, cryptoDepositFees: 0,
    fiatDepositVolume: 0, fiatDepositCount: 0, fiatDepositFees: 0,
    cryptoWithdrawalVolume: 0, cryptoWithdrawalCount: 0, cryptoWithdrawalFees: 0,
    fiatWithdrawalVolume: 0, fiatWithdrawalCount: 0, fiatWithdrawalFees: 0,
    transferVolume: 0, transferCount: 0, transferFees: 0,
    tradeVolume: 0, tradeCount: 0, tradeFees: 0,
    kytEventCount: 0,
  };
}

function addMetricDelta(
  map: Map<string, DailyMetricsDelta>,
  date: string,
  updater: (delta: DailyMetricsDelta) => void,
) {
  let delta = map.get(date);
  if (!delta) {
    delta = emptyDelta();
    map.set(date, delta);
  }
  updater(delta);
}

function addDepositVolumeDelta(
  map: Map<string, { volume: number; depositCount: number }>,
  date: string,
  volume: number,
  depositCount: number,
) {
  const existing = map.get(date) ?? { volume: 0, depositCount: 0 };
  existing.volume += volume;
  existing.depositCount += depositCount;
  map.set(date, existing);
}

function pathForSource(source: SyncSource): string {
  switch (source) {
    case 'deposits': return '/v1/v3/deposits';
    case 'transfers': return '/v1/v3/transfers';
    case 'withdrawals': return '/v1/v3/withdrawals';
    case 'trades': return '/v1/trades';
    default: return `/v1/v3/${source}`;
  }
}

function parseItemAmount(item: Record<string, unknown>, quotes: Record<string, number>): number {
  const amt =
    item.amount != null ? Number(item.amount)
    : item.receive_amount != null ? Number(item.receive_amount)
    : item.spend_amount != null ? Number(item.spend_amount)
    : 0;
  const currency = (item.currency ?? item.receive_currency ?? item.spend_currency ?? 'USD') as string;
  return toFiatAmount(amt, currency, quotes);
}

function parseItemFee(item: Record<string, unknown>, quotes: Record<string, number>): number {
  const fee =
    item.system_fee != null ? Number(item.system_fee)
    : item.fee != null ? Number(item.fee)
    : 0;
  const currency = (item.currency ?? item.fee_currency ?? 'USD') as string;
  return toFiatAmount(fee, currency, quotes);
}

function isCrypto(item: Record<string, unknown>): boolean {
  const t = (item.currency_type ?? item.type ?? '').toString().toUpperCase();
  if (t === 'CRYPTO') return true;
  if (t === 'FIAT') return false;
  const c = (item.currency ?? item.receive_currency ?? item.spend_currency ?? '').toString().toUpperCase();
  const fiat = ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD'];
  return !fiat.includes(c);
}

function hasKyt(item: Record<string, unknown>): boolean {
  return Boolean(
    item.kyt_score != null ||
    item.kyt_result != null ||
    (item.Kyt && typeof item.Kyt === 'object') ||
    item.kyt_status != null,
  );
}

function statusOf(item: Record<string, unknown>): string {
  return (item.status ?? '').toString().toUpperCase();
}

function shouldIncludeItem(source: SyncSource, item: Record<string, unknown>): boolean {
  switch (source) {
    case 'deposits':
      return ['CONFIRMED', 'COMPLETED'].includes(statusOf(item))
        && String(item.to_address ?? '') !== 'INTERNAL_TRANSFER';
    case 'transfers':
      return ['CONFIRMED', 'ADMIN_APPROVED'].includes(statusOf(item))
        && String(item.recipient_address ?? '') !== 'INTERNAL_TRANSFER';
    case 'withdrawals':
      return ['DONE', 'ADMIN_APPROVED'].includes(statusOf(item));
    case 'trades':
      return ['FILLED', 'COMPLETED', 'DONE'].includes(statusOf(item));
    default:
      return true;
  }
}

function effectiveEventDate(item: Record<string, unknown>): Date {
  const ts = item.updated_at ?? item.updatedAt ?? item.created_at ?? item.createdAt;
  return ts ? new Date(ts as string) : new Date();
}

function normalizeRecord(
  source: SyncSource,
  item: Record<string, unknown>,
  quotes: Record<string, number>,
): SyncSourceRecordInput | null {
  const sourceKey = item.id != null ? String(item.id) : '';
  if (!sourceKey) return null;

  const sourceUpdatedAtRaw = item.updated_at ?? item.updatedAt ?? item.created_at ?? item.createdAt;
  const sourceUpdatedAt = sourceUpdatedAtRaw ? new Date(sourceUpdatedAtRaw as string) : null;
  const eventDate = dateStr(effectiveEventDate(item));
  const isIncluded = shouldIncludeItem(source, item);
  const isCryptoValue = isCrypto(item);

  return {
    sourceKey,
    eventDate,
    sourceUpdatedAt,
    status: statusOf(item) || null,
    isIncluded,
    isCrypto: isIncluded ? isCryptoValue : null,
    amountUsd: parseItemAmount(item, quotes),
    feeUsd: parseItemFee(item, quotes),
    kytEvent: source === 'deposits' ? hasKyt(item) : false,
  };
}

function applyRecordContribution(
  source: SyncSource,
  record: SyncSourceRecordInput,
  sign: 1 | -1,
  metricDeltasByDate: Map<string, DailyMetricsDelta>,
  depositVolumeDeltasByDate: Map<string, { volume: number; depositCount: number }>,
) {
  if (!record.isIncluded) return;

  const amount = record.amountUsd * sign;
  const fee = record.feeUsd * sign;
  const count = sign;

  switch (source) {
    case 'deposits':
      addDepositVolumeDelta(depositVolumeDeltasByDate, record.eventDate, amount, count);
      addMetricDelta(metricDeltasByDate, record.eventDate, (delta) => {
        if (record.isCrypto) {
          delta.cryptoDepositVolume += amount;
          delta.cryptoDepositCount += count;
          delta.cryptoDepositFees += fee;
        } else {
          delta.fiatDepositVolume += amount;
          delta.fiatDepositCount += count;
          delta.fiatDepositFees += fee;
        }
        if (record.kytEvent) delta.kytEventCount += count;
      });
      break;
    case 'withdrawals':
      addMetricDelta(metricDeltasByDate, record.eventDate, (delta) => {
        if (record.isCrypto) {
          delta.cryptoWithdrawalVolume += amount;
          delta.cryptoWithdrawalCount += count;
          delta.cryptoWithdrawalFees += fee;
        } else {
          delta.fiatWithdrawalVolume += amount;
          delta.fiatWithdrawalCount += count;
          delta.fiatWithdrawalFees += fee;
        }
      });
      break;
    case 'transfers':
      addMetricDelta(metricDeltasByDate, record.eventDate, (delta) => {
        delta.transferVolume += amount;
        delta.transferCount += count;
        delta.transferFees += fee;
      });
      break;
    case 'trades':
      addMetricDelta(metricDeltasByDate, record.eventDate, (delta) => {
        delta.tradeVolume += amount;
        delta.tradeCount += count;
        delta.tradeFees += fee;
      });
      break;
  }
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private running = false;

  constructor(
    private quotesService: QuotesService,
    private syncRepo: SyncRepository,
  ) {}

  async runIncrementalSync(): Promise<SyncResult> {
    if (this.running) {
      return {
        success: false,
        timestamp: new Date().toISOString(),
        results: [],
        summary: { total: 0, successful: 0, failed: 0 },
      };
    }

    this.running = true;
    try {
      return await this.executeSync();
    } finally {
      this.running = false;
    }
  }

  private async executeSync(): Promise<SyncResult> {
    const configs = getCustomerApiConfigs();
    const results: Array<{ customerId: string; success: boolean; message: string }> = [];

    if (configs.length === 0) {
      this.logger.warn('No customer API configs found (set CUSTOMER_*_API_* env vars)');
      return {
        success: true,
        timestamp: new Date().toISOString(),
        results: [],
        summary: { total: 0, successful: 0, failed: 0 },
      };
    }

    let quotes: Record<string, number>;
    try {
      quotes = await this.quotesService.getQuotes();
    } catch (e) {
      this.logger.error('Failed to fetch quotes', e);
      return {
        success: false,
        timestamp: new Date().toISOString(),
        results: configs.map((c) => ({
          customerId: c.id, success: false, message: 'Quotes fetch failed',
        })),
        summary: { total: configs.length, successful: 0, failed: configs.length },
      };
    }

    const DEADLINE_MS = 50_000;
    const deadline = Date.now() + DEADLINE_MS;

    const withTimeout = (promise: Promise<any>, customerId: string) => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        return Promise.resolve({ customerId, success: false, message: 'Skipped — deadline reached' });
      }
      return Promise.race([
        promise,
        new Promise<{ customerId: string; success: boolean; message: string }>((resolve) =>
          setTimeout(() => resolve({ customerId, success: false, message: 'Timeout — took too long' }), remaining),
        ),
      ]);
    };

    const settled = await Promise.allSettled(
      configs.map((config) => withTimeout(this.syncCustomer(config, quotes), config.id)),
    );

    for (let i = 0; i < configs.length; i++) {
      const s = settled[i];
      if (s.status === 'fulfilled') {
        results.push(s.value);
      } else {
        const msg = s.reason instanceof Error ? s.reason.message : String(s.reason);
        this.logger.error(`${configs[i].id}: ${msg}`);
        results.push({ customerId: configs[i].id, success: false, message: msg });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return {
      success: failed === 0,
      timestamp: new Date().toISOString(),
      results,
      summary: { total: results.length, successful, failed },
    };
  }

  private async syncCustomer(
    config: CustomerApiConfig,
    quotes: Record<string, number>,
  ): Promise<{ customerId: string; success: boolean; message: string }> {
    const envId = config.id;
    try {
      this.logger.log(`Syncing ${config.id}...`);
      const jwt = await getJwt(config);

      for (const source of SOURCES) {
        const checkpoint = await this.syncRepo.getCheckpointState(config.id, envId, source);
        const path = pathForSource(source);
        const cutoff = checkpoint.lastUpdatedAt
          ? new Date(checkpoint.lastUpdatedAt.getTime() - UPDATED_AFTER_LOOKBACK_MS)
          : new Date(Date.now() - 24 * 60 * 60 * 1000);

        const recentItems = await fetchRecentUpdatedListAll(config.baseUrl, jwt, path, cutoff);

        const mergedById = new Map<string, Record<string, unknown>>();
        for (const item of recentItems) {
          const id = item.id != null ? String(item.id) : '';
          if (id) mergedById.set(id, item);
        }

        if (mergedById.size === 0) continue;

        const sourceKeys = [...mergedById.keys()];
        const existingRecords = await this.syncRepo.getExistingSourceRecords(
          config.id, envId, source, sourceKeys,
        );

        const metricDeltasByDate = new Map<string, DailyMetricsDelta>();
        const depositVolumeDeltasByDate = new Map<string, { volume: number; depositCount: number }>();
        const recordsToPersist: SyncSourceRecordInput[] = [];

        const maxId = checkpoint.lastId ?? 0;
        let maxUpdatedAt = checkpoint.lastUpdatedAt;

        for (const item of mergedById.values()) {
          const normalized = normalizeRecord(source, item, quotes);
          if (!normalized) continue;

          const previous = existingRecords.get(normalized.sourceKey);
          if (previous) {
            applyRecordContribution(source, previous, -1, metricDeltasByDate, depositVolumeDeltasByDate);
          }
          applyRecordContribution(source, normalized, 1, metricDeltasByDate, depositVolumeDeltasByDate);

          recordsToPersist.push(normalized);
          if (normalized.sourceUpdatedAt && (!maxUpdatedAt || normalized.sourceUpdatedAt > maxUpdatedAt)) {
            maxUpdatedAt = normalized.sourceUpdatedAt;
          }
        }

        await this.syncRepo.applySourceRecordChangesAndCheckpoint(
          config.id, envId, source,
          recordsToPersist, metricDeltasByDate, depositVolumeDeltasByDate,
          maxId, maxUpdatedAt,
        );
      }

      this.logger.log(`${config.id}: sync completed`);
      return { customerId: config.id, success: true, message: 'OK' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`${config.id}: ${msg}`);
      return { customerId: config.id, success: false, message: msg };
    }
  }
}
