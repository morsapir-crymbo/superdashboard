'use client';

import { memo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Shield,
  ChevronDown,
  ChevronRight,
  Coins,
  Banknote,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  CustomerExtendedStats,
  ExtendedMetricSet,
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

interface MetricCardProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconBgColor: string;
  volume: number;
  count: number;
  fees: number;
  volumeColor?: string;
}

function MetricCard({
  title,
  subtitle,
  icon,
  iconBgColor,
  volume,
  count,
  fees,
  volumeColor = 'text-slate-900',
}: MetricCardProps) {
  const avgPerTxn = count > 0 ? volume / count : 0;

  return (
    <Card className="p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className={cn('p-3 rounded-xl', iconBgColor)}>{icon}</div>
        <div>
          <h3 className="font-semibold text-slate-800 text-base">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>

      {/* Main Metrics */}
      <div className="space-y-5">
        {/* Volume */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Volume</p>
          <p className={cn('text-3xl font-bold tabular-nums', volumeColor)}>
            {formatCompactCurrency(volume)}
          </p>
        </div>

        {/* Count & Fees Row */}
        <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-100">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Transactions</p>
            <p className="text-xl font-semibold tabular-nums text-slate-700">
              {formatNumber(count)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Fees</p>
            <p className="text-xl font-semibold tabular-nums text-amber-600">
              {formatCompactCurrency(fees)}
            </p>
          </div>
        </div>

        {/* Average */}
        {count > 0 && (
          <div className="pt-4 border-t border-slate-100">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">Avg per transaction</span>
              <span className="text-sm font-semibold text-slate-700 tabular-nums">
                {formatCompactCurrency(avgPerTxn)}
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function KytCard({ count, totalFees }: { count: number; totalFees: number }) {
  return (
    <Card className="p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-purple-50">
          <Shield className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-800 text-base">KYT Events</h3>
          <p className="text-xs text-slate-500">Compliance checks</p>
        </div>
      </div>

      {/* Main Metric */}
      <div className="text-center py-6">
        <p className="text-4xl font-bold tabular-nums text-purple-600">{formatNumber(count)}</p>
        <p className="text-sm text-slate-500 mt-2">Total Events</p>
      </div>

      {/* Total Fees */}
      <div className="pt-4 border-t border-slate-100">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-500">Total Fees Collected</span>
          <span className="text-lg font-bold text-amber-600 tabular-nums">
            {formatCompactCurrency(totalFees)}
          </span>
        </div>
      </div>
    </Card>
  );
}

interface CustomerRowProps {
  customer: CustomerExtendedStats;
  period: MetricType;
}

function CustomerRow({ customer, period }: CustomerRowProps) {
  const [expanded, setExpanded] = useState(false);
  const metrics = customer[period];

  // Combine crypto deposits + transfers as "Crypto Deposits"
  const cryptoDeposits = {
    volume: metrics.deposits.crypto.volume + metrics.transfers.volume,
    count: metrics.deposits.crypto.count + metrics.transfers.count,
    fees: metrics.deposits.crypto.fees + metrics.transfers.fees,
  };

  // Fiat deposits
  const fiatDeposits = {
    volume: metrics.deposits.fiat.volume,
    count: metrics.deposits.fiat.count,
    fees: metrics.deposits.fiat.fees,
  };

  // Fiat withdrawals (from withdrawals table)
  const fiatWithdrawals = {
    volume: metrics.withdrawals.fiat.volume,
    count: metrics.withdrawals.fiat.count,
    fees: metrics.withdrawals.fiat.fees,
  };

  const totalFees = metrics.fees.total;
  const hasActivity = cryptoDeposits.count > 0 || fiatDeposits.count > 0 || fiatWithdrawals.count > 0;

  return (
    <Card className={cn('overflow-hidden', !hasActivity && 'opacity-50')}>
      {/* Header Row */}
      <div
        className="px-6 py-5 cursor-pointer hover:bg-slate-50/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          {/* Customer Info */}
          <div className="flex items-center gap-4">
            <button className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors">
              {expanded ? (
                <ChevronDown className="h-5 w-5 text-slate-400" />
              ) : (
                <ChevronRight className="h-5 w-5 text-slate-400" />
              )}
            </button>
            <div>
              <h4 className="font-semibold text-slate-900 text-base">{customer.customerName}</h4>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{customer.customerId}</p>
            </div>
          </div>

          {/* Metrics Summary */}
          <div className="flex items-center gap-12">
            {/* Crypto Deposits */}
            <div className="text-right min-w-[120px]">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Crypto Deposits</p>
              <p className="text-lg font-bold tabular-nums text-orange-600">
                {formatCompactCurrency(cryptoDeposits.volume)}
              </p>
              <p className="text-xs text-slate-400 tabular-nums mt-0.5">
                {formatNumber(cryptoDeposits.count)} txns
              </p>
            </div>

            {/* Fiat Deposits */}
            <div className="text-right min-w-[120px]">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Fiat Deposits</p>
              <p className="text-lg font-bold tabular-nums text-emerald-600">
                {formatCompactCurrency(fiatDeposits.volume)}
              </p>
              <p className="text-xs text-slate-400 tabular-nums mt-0.5">
                {formatNumber(fiatDeposits.count)} txns
              </p>
            </div>

            {/* Fiat Withdrawals */}
            <div className="text-right min-w-[120px]">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Fiat Withdrawals</p>
              <p className="text-lg font-bold tabular-nums text-red-600">
                {formatCompactCurrency(fiatWithdrawals.volume)}
              </p>
              <p className="text-xs text-slate-400 tabular-nums mt-0.5">
                {formatNumber(fiatWithdrawals.count)} txns
              </p>
            </div>

            {/* KYT */}
            <div className="text-right min-w-[80px]">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">KYT</p>
              <p className="text-lg font-bold tabular-nums text-purple-600">
                {formatNumber(metrics.kyt.count)}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">events</p>
            </div>

            {/* Total Fees */}
            <div className="text-right min-w-[100px]">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Fees</p>
              <p className="text-lg font-bold tabular-nums text-amber-600">
                {formatCompactCurrency(totalFees)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-slate-200 bg-slate-50/70 px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Crypto Deposits Detail */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Coins className="h-4 w-4 text-orange-500" />
                <h5 className="text-sm font-semibold text-slate-700">Crypto Deposits</h5>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Volume</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-800">
                    {formatCompactCurrency(cryptoDeposits.volume)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Transactions</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-800">
                    {formatNumber(cryptoDeposits.count)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                  <span className="text-sm text-slate-500">Fees</span>
                  <span className="text-sm font-semibold tabular-nums text-amber-600">
                    {formatCompactCurrency(cryptoDeposits.fees)}
                  </span>
                </div>
              </div>
            </div>

            {/* Fiat Deposits Detail */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Banknote className="h-4 w-4 text-emerald-500" />
                <h5 className="text-sm font-semibold text-slate-700">Fiat Deposits</h5>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Volume</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-800">
                    {formatCompactCurrency(fiatDeposits.volume)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Transactions</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-800">
                    {formatNumber(fiatDeposits.count)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                  <span className="text-sm text-slate-500">Fees</span>
                  <span className="text-sm font-semibold tabular-nums text-amber-600">
                    {formatCompactCurrency(fiatDeposits.fees)}
                  </span>
                </div>
              </div>
            </div>

            {/* Fiat Withdrawals Detail */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <ArrowUpFromLine className="h-4 w-4 text-red-500" />
                <h5 className="text-sm font-semibold text-slate-700">Fiat Withdrawals</h5>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Volume</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-800">
                    {formatCompactCurrency(fiatWithdrawals.volume)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Transactions</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-800">
                    {formatNumber(fiatWithdrawals.count)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                  <span className="text-sm text-slate-500">Fees</span>
                  <span className="text-sm font-semibold tabular-nums text-amber-600">
                    {formatCompactCurrency(fiatWithdrawals.fees)}
                  </span>
                </div>
              </div>
            </div>

            {/* KYT Detail */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-4 w-4 text-purple-500" />
                <h5 className="text-sm font-semibold text-slate-700">KYT Events</h5>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Total Events</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-800">
                    {formatNumber(metrics.kyt.count)}
                  </span>
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

      // Crypto deposits = deposits.crypto + transfers
      const cryptoDeposits = {
        volume: metrics.deposits.crypto.volume + metrics.transfers.volume,
        count: metrics.deposits.crypto.count + metrics.transfers.count,
        fees: metrics.deposits.crypto.fees + metrics.transfers.fees,
      };

      return {
        cryptoDeposits: {
          volume: acc.cryptoDeposits.volume + cryptoDeposits.volume,
          count: acc.cryptoDeposits.count + cryptoDeposits.count,
          fees: acc.cryptoDeposits.fees + cryptoDeposits.fees,
        },
        fiatDeposits: {
          volume: acc.fiatDeposits.volume + metrics.deposits.fiat.volume,
          count: acc.fiatDeposits.count + metrics.deposits.fiat.count,
          fees: acc.fiatDeposits.fees + metrics.deposits.fiat.fees,
        },
        fiatWithdrawals: {
          volume: acc.fiatWithdrawals.volume + metrics.withdrawals.fiat.volume,
          count: acc.fiatWithdrawals.count + metrics.withdrawals.fiat.count,
          fees: acc.fiatWithdrawals.fees + metrics.withdrawals.fiat.fees,
        },
        kyt: {
          count: acc.kyt.count + metrics.kyt.count,
        },
        totalFees: acc.totalFees + metrics.fees.total,
      };
    },
    {
      cryptoDeposits: { volume: 0, count: 0, fees: 0 },
      fiatDeposits: { volume: 0, count: 0, fees: 0 },
      fiatWithdrawals: { volume: 0, count: 0, fees: 0 },
      kyt: { count: 0 },
      totalFees: 0,
    }
  );

  return (
    <div className="space-y-10">
      {/* Section Header */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-6">
          {PERIOD_LABELS[selectedPeriod]} — Detailed Metrics
        </h3>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <MetricCard
            title="Crypto Deposits"
            subtitle="Blockchain transactions"
            icon={<Coins className="h-5 w-5 text-orange-600" />}
            iconBgColor="bg-orange-50"
            volume={totals.cryptoDeposits.volume}
            count={totals.cryptoDeposits.count}
            fees={totals.cryptoDeposits.fees}
            volumeColor="text-orange-600"
          />

          <MetricCard
            title="Fiat Deposits"
            subtitle="Bank transfers"
            icon={<ArrowDownToLine className="h-5 w-5 text-emerald-600" />}
            iconBgColor="bg-emerald-50"
            volume={totals.fiatDeposits.volume}
            count={totals.fiatDeposits.count}
            fees={totals.fiatDeposits.fees}
            volumeColor="text-emerald-600"
          />

          <MetricCard
            title="Fiat Withdrawals"
            subtitle="Bank payouts"
            icon={<ArrowUpFromLine className="h-5 w-5 text-red-600" />}
            iconBgColor="bg-red-50"
            volume={totals.fiatWithdrawals.volume}
            count={totals.fiatWithdrawals.count}
            fees={totals.fiatWithdrawals.fees}
            volumeColor="text-red-600"
          />

          <KytCard count={totals.kyt.count} totalFees={totals.totalFees} />
        </div>
      </div>

      {/* Customer Breakdown */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-6">
          By Customer
        </h3>
        <div className="space-y-4">
          {customers.map((customer) => (
            <CustomerRow key={customer.customerId} customer={customer} period={selectedPeriod} />
          ))}
        </div>
      </div>
    </div>
  );
}

export const ExtendedMetricsSection = memo(ExtendedMetricsSectionComponent);
