// ═══════════════════════════════════════════════════════════
// LEGACY TYPES (Volume Stats - kept for backward compatibility)
// ═══════════════════════════════════════════════════════════

export interface MetricSet {
  volume: number;
  depositCount: number;
  avgPerDeposit: number;
}

export interface EnvironmentVolume {
  environmentId: string;
  last30Days: MetricSet;
  today: MetricSet;
  monthToDate: MetricSet;
  previousMonth: MetricSet;
}

export interface CustomerVolumeStats {
  customerId: string;
  customerName: string;
  summary: {
    last30Days: MetricSet;
    today: MetricSet;
    monthToDate: MetricSet;
    previousMonth: MetricSet;
  };
  environments: EnvironmentVolume[];
}

// ═══════════════════════════════════════════════════════════
// EXTENDED TYPES (New comprehensive metrics)
// ═══════════════════════════════════════════════════════════

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

  kyt: {
    count: number;
  };

  fees: {
    deposits: number;
    withdrawals: number;
    transfers: number;
    total: number;
  };
}

export interface CustomerExtendedStats {
  customerId: string;
  customerName: string;
  today: CustomerExtendedMetrics;
  last30Days: CustomerExtendedMetrics;
  monthToDate: CustomerExtendedMetrics;
  previousMonth: CustomerExtendedMetrics;
}

export interface ExtendedMetricsResponse {
  customers: CustomerExtendedStats[];
}

// ═══════════════════════════════════════════════════════════
// SHARED TYPES
// ═══════════════════════════════════════════════════════════

export type MetricType = 'last30Days' | 'today' | 'monthToDate' | 'previousMonth';

export interface MetricConfig {
  key: MetricType;
  label: string;
  shortLabel: string;
  description: string;
}

function getPreviousMonthName(): string {
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return prevMonth.toLocaleString('en-US', { month: 'long' });
}

export const METRICS: MetricConfig[] = [
  {
    key: 'last30Days',
    label: 'Last 30 Days',
    shortLabel: '30D',
    description: 'Total volume over the past 30 days',
  },
  {
    key: 'today',
    label: 'Today',
    shortLabel: 'Today',
    description: 'Real-time volume for today (from 00:00 server time)',
  },
  {
    key: 'monthToDate',
    label: 'Month to Date',
    shortLabel: 'MTD',
    description: 'Total volume from the 1st of the month until now',
  },
  {
    key: 'previousMonth',
    label: `Previous Month`,
    shortLabel: 'Prev',
    description: `Total volume for the previous full calendar month`,
  },
];

// ═══════════════════════════════════════════════════════════
// FORMATTING UTILITIES
// ═══════════════════════════════════════════════════════════

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toFixed(2)}`;
}

export function createEmptyExtendedMetricSet(): ExtendedMetricSet {
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
    crypto: createEmptyExtendedMetricSet(),
    fiat: createEmptyExtendedMetricSet(),
    total: createEmptyExtendedMetricSet(),
  };
}
