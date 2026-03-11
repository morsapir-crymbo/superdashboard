'use client';

import { memo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Shield,
  DollarSign,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  CustomerExtendedStats,
  ExtendedMetricSet,
  CryptoFiatMetrics,
  MetricType,
  formatCompactCurrency,
  formatNumber,
} from '@/lib/types/stats';

interface ExtendedMetricsSectionProps {
  customers: CustomerExtendedStats[];
  selectedPeriod: MetricType;
}

const PERIOD_LABELS: Record<MetricType, string> = {
  last30Days: 'Last 30 Days',
  today: 'Today',
  monthToDate: 'Month to Date',
  previousMonth: 'Previous Month',
};

function MetricValue({
  value,
  label,
  isCurrency = true,
  colorClass = 'text-slate-900',
}: {
  value: number;
  label: string;
  isCurrency?: boolean;
  colorClass?: string;
}) {
  return (
    <div className="text-center">
      <p className={cn('text-2xl font-bold tabular-nums', colorClass)}>
        {isCurrency ? formatCompactCurrency(value) : formatNumber(value)}
      </p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}

function SummaryCard({
  title,
  icon,
  iconBgColor,
  metrics,
  showCryptoFiat = false,
  cryptoFiatMetrics,
}: {
  title: string;
  icon: React.ReactNode;
  iconBgColor: string;
  metrics: ExtendedMetricSet;
  showCryptoFiat?: boolean;
  cryptoFiatMetrics?: CryptoFiatMetrics;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="p-5 hover:shadow-md transition-shadow">
      <div
        className={cn('cursor-pointer', showCryptoFiat && 'cursor-pointer')}
        onClick={() => showCryptoFiat && setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn('p-2.5 rounded-xl', iconBgColor)}>{icon}</div>
            <h3 className="font-semibold text-slate-700">{title}</h3>
          </div>
          {showCryptoFiat && (
            <button className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-400" />
              )}
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <MetricValue
            value={metrics.volume}
            label="Volume"
            colorClass={metrics.volume > 0 ? 'text-slate-900' : 'text-slate-400'}
          />
          <MetricValue
            value={metrics.count}
            label="Count"
            isCurrency={false}
            colorClass={metrics.count > 0 ? 'text-slate-700' : 'text-slate-400'}
          />
          <MetricValue
            value={metrics.fees}
            label="Fees"
            colorClass={metrics.fees > 0 ? 'text-amber-600' : 'text-slate-400'}
          />
        </div>

        {metrics.count > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between text-sm">
            <span className="text-slate-500">Avg per txn</span>
            <span className="font-medium text-slate-700 tabular-nums">
              {formatCompactCurrency(metrics.avgPerTransaction)}
            </span>
          </div>
        )}
      </div>

      {showCryptoFiat && cryptoFiatMetrics && expanded && (
        <div className="mt-4 pt-4 border-t border-slate-200 space-y-4">
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-orange-500 rounded-full" />
              <span className="text-sm font-medium text-slate-600">Crypto</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-slate-500">Volume</p>
                <p className="font-semibold tabular-nums">
                  {formatCompactCurrency(cryptoFiatMetrics.crypto.volume)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Count</p>
                <p className="font-semibold tabular-nums">
                  {formatNumber(cryptoFiatMetrics.crypto.count)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Fees</p>
                <p className="font-semibold tabular-nums text-amber-600">
                  {formatCompactCurrency(cryptoFiatMetrics.crypto.fees)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-sm font-medium text-slate-600">Fiat</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-slate-500">Volume</p>
                <p className="font-semibold tabular-nums">
                  {formatCompactCurrency(cryptoFiatMetrics.fiat.volume)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Count</p>
                <p className="font-semibold tabular-nums">
                  {formatNumber(cryptoFiatMetrics.fiat.count)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Fees</p>
                <p className="font-semibold tabular-nums text-amber-600">
                  {formatCompactCurrency(cryptoFiatMetrics.fiat.fees)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function CustomerMetricsRow({ customer, period }: { customer: CustomerExtendedStats; period: MetricType }) {
  const [expanded, setExpanded] = useState(false);
  const metrics = customer[period];
  const hasActivity =
    metrics.deposits.total.count > 0 ||
    metrics.withdrawals.total.count > 0 ||
    metrics.transfers.count > 0;

  return (
    <Card className={cn('overflow-hidden', !hasActivity && 'opacity-60')}>
      <div
        className="p-5 cursor-pointer hover:bg-slate-50/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="p-1 hover:bg-slate-200 rounded-lg transition-colors">
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-400" />
              )}
            </button>
            <div>
              <h4 className="font-semibold text-slate-900">{customer.customerName}</h4>
              <p className="text-xs text-slate-400 font-mono">{customer.customerId}</p>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Deposits</p>
              <p className="font-semibold tabular-nums text-emerald-600">
                {formatCompactCurrency(metrics.deposits.total.volume)}
              </p>
              <p className="text-xs text-slate-400 tabular-nums">
                {formatNumber(metrics.deposits.total.count)} txns
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Withdrawals</p>
              <p className="font-semibold tabular-nums text-red-600">
                {formatCompactCurrency(metrics.withdrawals.total.volume)}
              </p>
              <p className="text-xs text-slate-400 tabular-nums">
                {formatNumber(metrics.withdrawals.total.count)} txns
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Transfers</p>
              <p className="font-semibold tabular-nums text-blue-600">
                {formatCompactCurrency(metrics.transfers.volume)}
              </p>
              <p className="text-xs text-slate-400 tabular-nums">
                {formatNumber(metrics.transfers.count)} txns
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-wide">KYT</p>
              <p className="font-semibold tabular-nums text-purple-600">
                {formatNumber(metrics.kyt.count)}
              </p>
              <p className="text-xs text-slate-400">events</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Total Fees</p>
              <p className="font-semibold tabular-nums text-amber-600">
                {formatCompactCurrency(metrics.fees.total)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <h5 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                <ArrowDownToLine className="h-4 w-4 text-emerald-500" />
                Deposits Breakdown
              </h5>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Crypto</span>
                  <span className="font-medium tabular-nums">
                    {formatCompactCurrency(metrics.deposits.crypto.volume)} ({metrics.deposits.crypto.count})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Fiat</span>
                  <span className="font-medium tabular-nums">
                    {formatCompactCurrency(metrics.deposits.fiat.volume)} ({metrics.deposits.fiat.count})
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-100">
                  <span className="text-slate-500">Fees</span>
                  <span className="font-medium tabular-nums text-amber-600">
                    {formatCompactCurrency(metrics.fees.deposits)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <h5 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                <ArrowUpFromLine className="h-4 w-4 text-red-500" />
                Withdrawals Breakdown
              </h5>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Crypto</span>
                  <span className="font-medium tabular-nums">
                    {formatCompactCurrency(metrics.withdrawals.crypto.volume)} ({metrics.withdrawals.crypto.count})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Fiat</span>
                  <span className="font-medium tabular-nums">
                    {formatCompactCurrency(metrics.withdrawals.fiat.volume)} ({metrics.withdrawals.fiat.count})
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-100">
                  <span className="text-slate-500">Fees</span>
                  <span className="font-medium tabular-nums text-amber-600">
                    {formatCompactCurrency(metrics.fees.withdrawals)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <h5 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-blue-500" />
                Transfers
              </h5>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Volume</span>
                  <span className="font-medium tabular-nums">
                    {formatCompactCurrency(metrics.transfers.volume)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Count</span>
                  <span className="font-medium tabular-nums">{formatNumber(metrics.transfers.count)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-100">
                  <span className="text-slate-500">Fees</span>
                  <span className="font-medium tabular-nums text-amber-600">
                    {formatCompactCurrency(metrics.fees.transfers)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <h5 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4 text-purple-500" />
                KYT Events
              </h5>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Events</span>
                  <span className="font-medium tabular-nums">{formatNumber(metrics.kyt.count)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function ExtendedMetricsSectionComponent({ customers, selectedPeriod }: ExtendedMetricsSectionProps) {
  // Aggregate totals across all customers
  const totals = customers.reduce(
    (acc, customer) => {
      const metrics = customer[selectedPeriod];
      return {
        deposits: {
          crypto: {
            volume: acc.deposits.crypto.volume + metrics.deposits.crypto.volume,
            count: acc.deposits.crypto.count + metrics.deposits.crypto.count,
            fees: acc.deposits.crypto.fees + metrics.deposits.crypto.fees,
          },
          fiat: {
            volume: acc.deposits.fiat.volume + metrics.deposits.fiat.volume,
            count: acc.deposits.fiat.count + metrics.deposits.fiat.count,
            fees: acc.deposits.fiat.fees + metrics.deposits.fiat.fees,
          },
          total: {
            volume: acc.deposits.total.volume + metrics.deposits.total.volume,
            count: acc.deposits.total.count + metrics.deposits.total.count,
            fees: acc.deposits.total.fees + metrics.deposits.total.fees,
          },
        },
        withdrawals: {
          crypto: {
            volume: acc.withdrawals.crypto.volume + metrics.withdrawals.crypto.volume,
            count: acc.withdrawals.crypto.count + metrics.withdrawals.crypto.count,
            fees: acc.withdrawals.crypto.fees + metrics.withdrawals.crypto.fees,
          },
          fiat: {
            volume: acc.withdrawals.fiat.volume + metrics.withdrawals.fiat.volume,
            count: acc.withdrawals.fiat.count + metrics.withdrawals.fiat.count,
            fees: acc.withdrawals.fiat.fees + metrics.withdrawals.fiat.fees,
          },
          total: {
            volume: acc.withdrawals.total.volume + metrics.withdrawals.total.volume,
            count: acc.withdrawals.total.count + metrics.withdrawals.total.count,
            fees: acc.withdrawals.total.fees + metrics.withdrawals.total.fees,
          },
        },
        transfers: {
          volume: acc.transfers.volume + metrics.transfers.volume,
          count: acc.transfers.count + metrics.transfers.count,
          fees: acc.transfers.fees + metrics.transfers.fees,
        },
        kyt: {
          count: acc.kyt.count + metrics.kyt.count,
        },
        fees: {
          total: acc.fees.total + metrics.fees.total,
        },
      };
    },
    {
      deposits: {
        crypto: { volume: 0, count: 0, fees: 0 },
        fiat: { volume: 0, count: 0, fees: 0 },
        total: { volume: 0, count: 0, fees: 0 },
      },
      withdrawals: {
        crypto: { volume: 0, count: 0, fees: 0 },
        fiat: { volume: 0, count: 0, fees: 0 },
        total: { volume: 0, count: 0, fees: 0 },
      },
      transfers: { volume: 0, count: 0, fees: 0 },
      kyt: { count: 0 },
      fees: { total: 0 },
    }
  );

  // Calculate averages
  const depositMetrics: ExtendedMetricSet = {
    ...totals.deposits.total,
    avgPerTransaction:
      totals.deposits.total.count > 0
        ? Math.round((totals.deposits.total.volume / totals.deposits.total.count) * 100) / 100
        : 0,
    avgFeePerTransaction:
      totals.deposits.total.count > 0
        ? Math.round((totals.deposits.total.fees / totals.deposits.total.count) * 100) / 100
        : 0,
  };

  const withdrawalMetrics: ExtendedMetricSet = {
    ...totals.withdrawals.total,
    avgPerTransaction:
      totals.withdrawals.total.count > 0
        ? Math.round((totals.withdrawals.total.volume / totals.withdrawals.total.count) * 100) / 100
        : 0,
    avgFeePerTransaction:
      totals.withdrawals.total.count > 0
        ? Math.round((totals.withdrawals.total.fees / totals.withdrawals.total.count) * 100) / 100
        : 0,
  };

  const transferMetrics: ExtendedMetricSet = {
    ...totals.transfers,
    avgPerTransaction:
      totals.transfers.count > 0
        ? Math.round((totals.transfers.volume / totals.transfers.count) * 100) / 100
        : 0,
    avgFeePerTransaction:
      totals.transfers.count > 0
        ? Math.round((totals.transfers.fees / totals.transfers.count) * 100) / 100
        : 0,
  };

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
          {PERIOD_LABELS[selectedPeriod]} - Detailed Metrics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <SummaryCard
            title="Deposits"
            icon={<ArrowDownToLine className="h-5 w-5 text-emerald-600" />}
            iconBgColor="bg-emerald-50"
            metrics={depositMetrics}
            showCryptoFiat
            cryptoFiatMetrics={{
              crypto: {
                ...totals.deposits.crypto,
                avgPerTransaction: 0,
                avgFeePerTransaction: 0,
              },
              fiat: { ...totals.deposits.fiat, avgPerTransaction: 0, avgFeePerTransaction: 0 },
              total: depositMetrics,
            }}
          />
          <SummaryCard
            title="Withdrawals"
            icon={<ArrowUpFromLine className="h-5 w-5 text-red-600" />}
            iconBgColor="bg-red-50"
            metrics={withdrawalMetrics}
            showCryptoFiat
            cryptoFiatMetrics={{
              crypto: {
                ...totals.withdrawals.crypto,
                avgPerTransaction: 0,
                avgFeePerTransaction: 0,
              },
              fiat: {
                ...totals.withdrawals.fiat,
                avgPerTransaction: 0,
                avgFeePerTransaction: 0,
              },
              total: withdrawalMetrics,
            }}
          />
          <SummaryCard
            title="Transfers"
            icon={<ArrowLeftRight className="h-5 w-5 text-blue-600" />}
            iconBgColor="bg-blue-50"
            metrics={transferMetrics}
          />
          <Card className="p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-purple-50">
                <Shield className="h-5 w-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-slate-700">KYT Events</h3>
            </div>
            <div className="text-center py-4">
              <p className="text-4xl font-bold tabular-nums text-purple-600">
                {formatNumber(totals.kyt.count)}
              </p>
              <p className="text-sm text-slate-500 mt-2">Total Events</p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Total Fees Collected</span>
                <span className="font-semibold text-amber-600 tabular-nums">
                  {formatCompactCurrency(totals.fees.total)}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Customer Breakdown */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
          By Customer
        </h3>
        <div className="space-y-4">
          {customers.map((customer) => (
            <CustomerMetricsRow key={customer.customerId} customer={customer} period={selectedPeriod} />
          ))}
        </div>
      </div>
    </div>
  );
}

export const ExtendedMetricsSection = memo(ExtendedMetricsSectionComponent);
