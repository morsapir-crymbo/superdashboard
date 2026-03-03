export interface EnvironmentVolume {
  environmentId: string;
  last30Days: number;
  today: number;
  monthToDate: number;
}

export interface CustomerVolumeStats {
  customerId: string;
  customerName: string;
  summary: {
    last30Days: number;
    today: number;
    monthToDate: number;
  };
  environments: EnvironmentVolume[];
}

export type MetricType = 'last30Days' | 'today' | 'monthToDate';

export interface MetricConfig {
  key: MetricType;
  label: string;
  shortLabel: string;
  description: string;
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
    description: 'Real-time volume for today',
  },
  {
    key: 'monthToDate',
    label: 'Month to Date',
    shortLabel: 'MTD',
    description: 'Total volume from the 1st of the month until now',
  },
];
