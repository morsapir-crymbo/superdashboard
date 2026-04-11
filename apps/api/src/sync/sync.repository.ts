import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  SyncSource,
  CheckpointState,
  SyncSourceRecordInput,
  DailyMetricsDelta,
} from './types';

@Injectable()
export class SyncRepository {
  private readonly logger = new Logger(SyncRepository.name);

  constructor(private prisma: PrismaService) {}

  async getCheckpointState(
    customerId: string,
    environmentId: string,
    source: SyncSource,
  ): Promise<CheckpointState> {
    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT last_id, last_updated_at FROM sync_checkpoints
       WHERE customer_id = $1 AND environment_id = $2 AND source = $3`,
      customerId,
      environmentId,
      source,
    );
    const row = rows[0];
    return {
      lastId: row ? Number(row.last_id) : null,
      lastUpdatedAt: row?.last_updated_at ?? null,
    };
  }

  async getExistingSourceRecords(
    customerId: string,
    environmentId: string,
    source: SyncSource,
    sourceKeys: string[],
  ): Promise<Map<string, SyncSourceRecordInput>> {
    if (sourceKeys.length === 0) return new Map();

    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT source_key, event_date, source_updated_at, status,
              is_included, is_crypto, amount_usd, fee_usd, kyt_event
       FROM sync_source_records
       WHERE customer_id = $1 AND environment_id = $2 AND source = $3
         AND source_key = ANY($4::text[])`,
      customerId,
      environmentId,
      source,
      sourceKeys,
    );

    const map = new Map<string, SyncSourceRecordInput>();
    for (const row of rows) {
      map.set(String(row.source_key), {
        sourceKey: String(row.source_key),
        eventDate: row.event_date instanceof Date
          ? row.event_date.toISOString().split('T')[0]
          : String(row.event_date).split('T')[0],
        sourceUpdatedAt: row.source_updated_at ?? null,
        status: row.status ?? null,
        isIncluded: row.is_included,
        isCrypto: row.is_crypto,
        amountUsd: Number(row.amount_usd ?? 0),
        feeUsd: Number(row.fee_usd ?? 0),
        kytEvent: row.kyt_event,
      });
    }
    return map;
  }

  async applySourceRecordChangesAndCheckpoint(
    customerId: string,
    environmentId: string,
    source: SyncSource,
    records: SyncSourceRecordInput[],
    metricDeltasByDate: Map<string, DailyMetricsDelta>,
    depositVolumeDeltasByDate: Map<string, { volume: number; depositCount: number }>,
    maxId: number,
    lastUpdatedAt: Date | null,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const record of records) {
        await tx.$executeRawUnsafe(
          `INSERT INTO sync_source_records (
            customer_id, environment_id, source, source_key, event_date, source_updated_at,
            status, is_included, is_crypto, amount_usd, fee_usd, kyt_event, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
          ON CONFLICT (customer_id, environment_id, source, source_key)
          DO UPDATE SET
            event_date = EXCLUDED.event_date,
            source_updated_at = EXCLUDED.source_updated_at,
            status = EXCLUDED.status,
            is_included = EXCLUDED.is_included,
            is_crypto = EXCLUDED.is_crypto,
            amount_usd = EXCLUDED.amount_usd,
            fee_usd = EXCLUDED.fee_usd,
            kyt_event = EXCLUDED.kyt_event,
            updated_at = NOW()`,
          customerId,
          environmentId,
          source,
          record.sourceKey,
          record.eventDate,
          record.sourceUpdatedAt,
          record.status,
          record.isIncluded,
          record.isCrypto,
          record.amountUsd,
          record.feeUsd,
          record.kytEvent,
        );
      }

      for (const [date, delta] of metricDeltasByDate) {
        await tx.$executeRawUnsafe(
          `INSERT INTO daily_metrics (
            customer_id, date,
            crypto_deposit_volume, crypto_deposit_count, crypto_deposit_fees,
            fiat_deposit_volume, fiat_deposit_count, fiat_deposit_fees,
            crypto_withdrawal_volume, crypto_withdrawal_count, crypto_withdrawal_fees,
            fiat_withdrawal_volume, fiat_withdrawal_count, fiat_withdrawal_fees,
            transfer_volume, transfer_count, transfer_fees,
            trade_volume, trade_count, trade_fees,
            kyt_event_count, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW(), NOW())
          ON CONFLICT (customer_id, date)
          DO UPDATE SET
            crypto_deposit_volume = daily_metrics.crypto_deposit_volume + EXCLUDED.crypto_deposit_volume,
            crypto_deposit_count = daily_metrics.crypto_deposit_count + EXCLUDED.crypto_deposit_count,
            crypto_deposit_fees = daily_metrics.crypto_deposit_fees + EXCLUDED.crypto_deposit_fees,
            fiat_deposit_volume = daily_metrics.fiat_deposit_volume + EXCLUDED.fiat_deposit_volume,
            fiat_deposit_count = daily_metrics.fiat_deposit_count + EXCLUDED.fiat_deposit_count,
            fiat_deposit_fees = daily_metrics.fiat_deposit_fees + EXCLUDED.fiat_deposit_fees,
            crypto_withdrawal_volume = daily_metrics.crypto_withdrawal_volume + EXCLUDED.crypto_withdrawal_volume,
            crypto_withdrawal_count = daily_metrics.crypto_withdrawal_count + EXCLUDED.crypto_withdrawal_count,
            crypto_withdrawal_fees = daily_metrics.crypto_withdrawal_fees + EXCLUDED.crypto_withdrawal_fees,
            fiat_withdrawal_volume = daily_metrics.fiat_withdrawal_volume + EXCLUDED.fiat_withdrawal_volume,
            fiat_withdrawal_count = daily_metrics.fiat_withdrawal_count + EXCLUDED.fiat_withdrawal_count,
            fiat_withdrawal_fees = daily_metrics.fiat_withdrawal_fees + EXCLUDED.fiat_withdrawal_fees,
            transfer_volume = daily_metrics.transfer_volume + EXCLUDED.transfer_volume,
            transfer_count = daily_metrics.transfer_count + EXCLUDED.transfer_count,
            transfer_fees = daily_metrics.transfer_fees + EXCLUDED.transfer_fees,
            trade_volume = daily_metrics.trade_volume + EXCLUDED.trade_volume,
            trade_count = daily_metrics.trade_count + EXCLUDED.trade_count,
            trade_fees = daily_metrics.trade_fees + EXCLUDED.trade_fees,
            kyt_event_count = daily_metrics.kyt_event_count + EXCLUDED.kyt_event_count,
            updated_at = NOW()`,
          customerId,
          date,
          delta.cryptoDepositVolume, delta.cryptoDepositCount, delta.cryptoDepositFees,
          delta.fiatDepositVolume, delta.fiatDepositCount, delta.fiatDepositFees,
          delta.cryptoWithdrawalVolume, delta.cryptoWithdrawalCount, delta.cryptoWithdrawalFees,
          delta.fiatWithdrawalVolume, delta.fiatWithdrawalCount, delta.fiatWithdrawalFees,
          delta.transferVolume, delta.transferCount, delta.transferFees,
          delta.tradeVolume, delta.tradeCount, delta.tradeFees,
          delta.kytEventCount,
        );
      }

      for (const [date, delta] of depositVolumeDeltasByDate) {
        await tx.$executeRawUnsafe(
          `INSERT INTO daily_environment_volume (customer_id, environment_id, date, volume, deposit_count, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
           ON CONFLICT (customer_id, environment_id, date)
           DO UPDATE SET
             volume = daily_environment_volume.volume + EXCLUDED.volume,
             deposit_count = daily_environment_volume.deposit_count + EXCLUDED.deposit_count,
             updated_at = NOW()`,
          customerId,
          environmentId,
          date,
          delta.volume,
          delta.depositCount,
        );
      }

      await tx.$executeRawUnsafe(
        `INSERT INTO sync_checkpoints (customer_id, environment_id, source, last_id, last_updated_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (customer_id, environment_id, source)
         DO UPDATE SET
           last_id = GREATEST(sync_checkpoints.last_id, EXCLUDED.last_id),
           last_updated_at = GREATEST(COALESCE(sync_checkpoints.last_updated_at, EXCLUDED.last_updated_at), EXCLUDED.last_updated_at),
           updated_at = NOW()`,
        customerId,
        environmentId,
        source,
        maxId,
        lastUpdatedAt ?? new Date(),
      );
    }, { timeout: 55_000 });
  }
}
