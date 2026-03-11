export interface ExtendedMetricSet {
  volume: number;
  count: number;
  fees: number;
  avgPerTransaction: number;
  avgFeePerTransaction: number;
}

export interface CryptoFiatMetrics {
  crypto: ExtendedMetricSet;
  fiat: ExtendedMetricSet;
  total: ExtendedMetricSet;
}

export interface CustomerExtendedMetrics {
  customerId: string;
  customerName: string;

  deposits: CryptoFiatMetrics;
  withdrawals: CryptoFiatMetrics;
  transfers: ExtendedMetricSet;
  trades: ExtendedMetricSet;

  kyt: {
    count: number;
  };

  fees: {
    deposits: number;
    withdrawals: number;
    transfers: number;
    trades: number;
    total: number;
  };
}

export interface AggregatedExtendedMetrics {
  today: CustomerExtendedMetrics;
  last30Days: CustomerExtendedMetrics;
  monthToDate: CustomerExtendedMetrics;
  previousMonth: CustomerExtendedMetrics;
}

export interface DailyMetricsRow {
  id: number;
  customerId: string;
  date: Date;

  cryptoDepositVolume: number;
  cryptoDepositCount: number;
  cryptoDepositFees: number;

  fiatDepositVolume: number;
  fiatDepositCount: number;
  fiatDepositFees: number;

  cryptoWithdrawalVolume: number;
  cryptoWithdrawalCount: number;
  cryptoWithdrawalFees: number;

  fiatWithdrawalVolume: number;
  fiatWithdrawalCount: number;
  fiatWithdrawalFees: number;

  transferVolume: number;
  transferCount: number;
  transferFees: number;

  tradeVolume: number;
  tradeCount: number;
  tradeFees: number;

  kytEventCount: number;
}

export function createEmptyMetricSet(): ExtendedMetricSet {
  return {
    volume: 0,
    count: 0,
    fees: 0,
    avgPerTransaction: 0,
    avgFeePerTransaction: 0,
  };
}

export function createEmptyCryptoFiatMetrics(): CryptoFiatMetrics {
  return {
    crypto: createEmptyMetricSet(),
    fiat: createEmptyMetricSet(),
    total: createEmptyMetricSet(),
  };
}

export function createEmptyCustomerMetrics(customerId: string, customerName: string): CustomerExtendedMetrics {
  return {
    customerId,
    customerName,
    deposits: createEmptyCryptoFiatMetrics(),
    withdrawals: createEmptyCryptoFiatMetrics(),
    transfers: createEmptyMetricSet(),
    trades: createEmptyMetricSet(),
    kyt: { count: 0 },
    fees: {
      deposits: 0,
      withdrawals: 0,
      transfers: 0,
      trades: 0,
      total: 0,
    },
  };
}

export function calculateAvg(total: number, count: number): number {
  if (count === 0) return 0;
  return Math.round((total / count) * 100) / 100;
}

export function combineMetricSets(a: ExtendedMetricSet, b: ExtendedMetricSet): ExtendedMetricSet {
  const volume = a.volume + b.volume;
  const count = a.count + b.count;
  const fees = a.fees + b.fees;
  
  return {
    volume: Math.round(volume * 100) / 100,
    count,
    fees: Math.round(fees * 100) / 100,
    avgPerTransaction: calculateAvg(volume, count),
    avgFeePerTransaction: calculateAvg(fees, count),
  };
}
