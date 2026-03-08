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
