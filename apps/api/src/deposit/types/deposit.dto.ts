export interface DepositVolumeRow {
  total_amount: string | number;
  currency: string;
  currency_id: number;
}

export interface DepositVolumeResult {
  currency: string;
  currencyId: number;
  amount: number;
}

export interface AggregatedVolumeResult {
  customerId: string;
  totalUsd: number;
  breakdown: DepositVolumeResult[];
  fetchedAt: Date;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export function normalizeDepositRow(row: DepositVolumeRow): DepositVolumeResult {
  return {
    currency: row.currency,
    currencyId: Number(row.currency_id),
    amount: Number(row.total_amount) || 0,
  };
}
