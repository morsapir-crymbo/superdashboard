export interface DepositVolumeRow {
  total_amount: string | number;
  deposit_count: string | number;
  currency: string;
  currency_id: number;
}

export interface DepositVolumeResult {
  currency: string;
  currencyId: number;
  amount: number;
  depositCount: number;
}

export interface AggregatedVolumeResult {
  customerId: string;
  totalUsd: number;
  totalDepositCount: number;
  breakdown: DepositVolumeResult[];
  fetchedAt: Date;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface VolumeMetrics {
  volume: number;
  depositCount: number;
  avgPerDeposit: number;
}

export function normalizeDepositRow(row: DepositVolumeRow): DepositVolumeResult {
  return {
    currency: row.currency,
    currencyId: Number(row.currency_id),
    amount: Number(row.total_amount) || 0,
    depositCount: Number(row.deposit_count) || 0,
  };
}

export function calculateAvgPerDeposit(volume: number, depositCount: number): number {
  if (depositCount === 0) return 0;
  return Math.round((volume / depositCount) * 100) / 100;
}
