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
  DollarSign,
  ArrowLeftRight,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  CustomerExtendedStats,
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

// ═══════════════════════════════════════════════════════════
// SUMMARY CARDS
// ═══════════════════════════════════════════════════════════

interface MetricCardProps {
  title: string;
  icon: React.ReactNode;
  iconBgColor: string;
  children: React.ReactNode;
}

function MetricCard({ title, icon, iconBgColor, children }: MetricCardProps) {
  return (
    <Card className="p-6 hover:shadow-md transition-shadow h-full">
      <div className="flex items-center gap-3 mb-6">
        <div className={cn('p-3 rounded-xl', iconBgColor)}>{icon}</div>
        <h3 className="font-semibold text-slate-800 text-base">{title}</h3>
      </div>
      {children}
    </Card>
  );
}

interface CryptoFiatBreakdownProps {
  crypto: { volume: number; count: number };
  fiat: { volume: number; count: number };
}

function CryptoFiatBreakdown({ crypto, fiat }: CryptoFiatBreakdownProps) {
  const total = {
    volume: crypto.volume + fiat.volume,
    count: crypto.count + fiat.count,
  };
  const avgPerTxn = total.count > 0 ? total.volume / total.count : 0;

  return (
    <div className="space-y-5">
      {/* Total */}
      <div className="text-center pb-4 border-b border-slate-100">
        <p className="text-3xl font-bold tabular-nums text-slate-900">
          {formatCompactCurrency(total.volume)}
        </p>
        <p className="text-sm text-slate-500 mt-1">{formatNumber(total.count)} transactions</p>
      </div>

      {/* Crypto Row */}
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-500" />
          <span className="text-sm text-slate-600">Crypto</span>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums text-slate-800">
            {formatCompactCurrency(crypto.volume)}
          </p>
          <p className="text-xs text-slate-400 tabular-nums">{formatNumber(crypto.count)} txns</p>
        </div>
      </div>

      {/* Fiat Row */}
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-sm text-slate-600">Fiat</span>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums text-slate-800">
            {formatCompactCurrency(fiat.volume)}
          </p>
          <p className="text-xs text-slate-400 tabular-nums">{formatNumber(fiat.count)} txns</p>
        </div>
      </div>

      {/* Average */}
      {total.count > 0 && (
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
  );
}

function FeesCard({ totalFees }: { totalFees: number }) {
  return (
    <div className="space-y-5">
      <div className="text-center py-6">
        <p className="text-4xl font-bold tabular-nums text-amber-600">
          {formatCompactCurrency(totalFees)}
        </p>
        <p className="text-sm text-slate-500 mt-2">Total Fees Collected</p>
      </div>
    </div>
  );
}

function KytCard({ count }: { count: number }) {
  return (
    <div className="space-y-5">
      <div className="text-center py-6">
        <p className="text-4xl font-bold tabular-nums text-purple-600">{formatNumber(count)}</p>
        <p className="text-sm text-slate-500 mt-2">Compliance Events</p>
      </div>
    </div>
  );
}

interface TradesCardProps {
  volume: number;
  count: number;
  fees: number;
}

function TradesCard({ volume, count, fees }: TradesCardProps) {
  const avgPerTrade = count > 0 ? volume / count : 0;

  return (
    <div className="space-y-5">
      {/* Total */}
      <div className="text-center pb-4 border-b border-slate-100">
        <p className="text-3xl font-bold tabular-nums text-blue-600">
          {formatCompactCurrency(volume)}
        </p>
        <p className="text-sm text-slate-500 mt-1">{formatNumber(count)} trades</p>
      </div>

      {/* Fees */}
      <div className="flex items-center justify-between py-2">
        <span className="text-sm text-slate-600">Fees Collected</span>
        <p className="text-sm font-semibold tabular-nums text-amber-600">
          {formatCompactCurrency(fees)}
        </p>
      </div>

      {/* Average */}
      {count > 0 && (
        <div className="pt-4 border-t border-slate-100">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-500">Avg per trade</span>
            <span className="text-sm font-semibold text-slate-700 tabular-nums">
              {formatCompactCurrency(avgPerTrade)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CUSTOMER ROW
// ═══════════════════════════════════════════════════════════

interface CustomerRowProps {
  customer: CustomerExtendedStats;
  period: MetricType;
}

function CustomerRow({ customer, period }: CustomerRowProps) {
  const [expanded, setExpanded] = useState(false);
  const metrics = customer[period];

  // DEPOSITS: from deposits table (crypto + fiat)
  const deposits = {
    crypto: {
      volume: metrics.deposits.crypto.volume,
      count: metrics.deposits.crypto.count,
    },
    fiat: {
      volume: metrics.deposits.fiat.volume,
      count: metrics.deposits.fiat.count,
    },
    total: {
      volume: metrics.deposits.crypto.volume + metrics.deposits.fiat.volume,
      count: metrics.deposits.crypto.count + metrics.deposits.fiat.count,
    },
  };

  // WITHDRAWALS:
  // - Crypto withdrawals = transfers table
  // - Fiat withdrawals = withdrawals table (fiat only)
  const withdrawals = {
    crypto: {
      volume: metrics.transfers.volume,
      count: metrics.transfers.count,
    },
    fiat: {
      volume: metrics.withdrawals.fiat.volume,
      count: metrics.withdrawals.fiat.count,
    },
    total: {
      volume: metrics.transfers.volume + metrics.withdrawals.fiat.volume,
      count: metrics.transfers.count + metrics.withdrawals.fiat.count,
    },
  };

  // TRADES
  const trades = {
    volume: metrics.trades.volume,
    count: metrics.trades.count,
    fees: metrics.trades.fees,
  };

  const totalFees = metrics.fees.total;
  const kytCount = metrics.kyt.count;

  const hasActivity = deposits.total.count > 0 || withdrawals.total.count > 0 || trades.count > 0 || kytCount > 0;

  return (
    <Card className={cn('overflow-hidden', !hasActivity && 'opacity-50')}>
      {/* Header Row */}
      <div
        className="px-6 py-5 cursor-pointer hover:bg-slate-50/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          {/* Customer Info */}
          <div className="flex items-center gap-4 min-w-[180px]">
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

          {/* Metrics Summary - 5 columns */}
          <div className="grid grid-cols-5 gap-6 flex-1 max-w-4xl">
            {/* Deposits */}
            <div className="text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Deposits</p>
              <p className="text-lg font-bold tabular-nums text-emerald-600">
                {formatCompactCurrency(deposits.total.volume)}
              </p>
              <p className="text-xs text-slate-400 tabular-nums mt-1">
                {formatNumber(deposits.total.count)} txns
              </p>
            </div>

            {/* Withdrawals */}
            <div className="text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Withdrawals</p>
              <p className="text-lg font-bold tabular-nums text-red-600">
                {formatCompactCurrency(withdrawals.total.volume)}
              </p>
              <p className="text-xs text-slate-400 tabular-nums mt-1">
                {formatNumber(withdrawals.total.count)} txns
              </p>
            </div>

            {/* Trades */}
            <div className="text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Trades</p>
              <p className="text-lg font-bold tabular-nums text-blue-600">
                {formatCompactCurrency(trades.volume)}
              </p>
              <p className="text-xs text-slate-400 tabular-nums mt-1">
                {formatNumber(trades.count)} trades
              </p>
            </div>

            {/* Fees */}
            <div className="text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Fees</p>
              <p className="text-lg font-bold tabular-nums text-amber-600">
                {formatCompactCurrency(totalFees)}
              </p>
            </div>

            {/* KYT */}
            <div className="text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">KYT</p>
              <p className="text-lg font-bold tabular-nums text-purple-600">
                {formatNumber(kytCount)}
              </p>
              <p className="text-xs text-slate-400 mt-1">events</p>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-slate-200 bg-slate-50/70 px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Deposits Breakdown */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-5">
                <ArrowDownToLine className="h-4 w-4 text-emerald-500" />
                <h5 className="text-sm font-semibold text-slate-700">Deposits Breakdown</h5>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-orange-500" />
                    <span className="text-sm text-slate-600">Crypto</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">
                      {formatCompactCurrency(deposits.crypto.volume)}
                    </p>
                    <p className="text-xs text-slate-400">{formatNumber(deposits.crypto.count)} txns</p>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm text-slate-600">Fiat</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">
                      {formatCompactCurrency(deposits.fiat.volume)}
                    </p>
                    <p className="text-xs text-slate-400">{formatNumber(deposits.fiat.count)} txns</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Withdrawals Breakdown */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-5">
                <ArrowUpFromLine className="h-4 w-4 text-red-500" />
                <h5 className="text-sm font-semibold text-slate-700">Withdrawals Breakdown</h5>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-orange-500" />
                    <span className="text-sm text-slate-600">Crypto</span>
                    <span className="text-xs text-slate-400">(transfers)</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">
                      {formatCompactCurrency(withdrawals.crypto.volume)}
                    </p>
                    <p className="text-xs text-slate-400">{formatNumber(withdrawals.crypto.count)} txns</p>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm text-slate-600">Fiat</span>
                    <span className="text-xs text-slate-400">(withdrawals)</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">
                      {formatCompactCurrency(withdrawals.fiat.volume)}
                    </p>
                    <p className="text-xs text-slate-400">{formatNumber(withdrawals.fiat.count)} txns</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

function ExtendedMetricsSectionComponent({ customers, selectedPeriod }: ExtendedMetricsSectionProps) {
  // Aggregate totals across all customers
  // CORRECT MAPPING:
  // - Deposits: deposits table (crypto + fiat)
  // - Withdrawals: 
  //   - Crypto = transfers table
  //   - Fiat = withdrawals table (fiat only)
  // - Trades: trades table (spend amount based volume)
  const totals = customers.reduce(
    (acc, customer) => {
      const metrics = customer[selectedPeriod];

      return {
        deposits: {
          crypto: {
            volume: acc.deposits.crypto.volume + metrics.deposits.crypto.volume,
            count: acc.deposits.crypto.count + metrics.deposits.crypto.count,
          },
          fiat: {
            volume: acc.deposits.fiat.volume + metrics.deposits.fiat.volume,
            count: acc.deposits.fiat.count + metrics.deposits.fiat.count,
          },
        },
        withdrawals: {
          // Crypto withdrawals = transfers table
          crypto: {
            volume: acc.withdrawals.crypto.volume + metrics.transfers.volume,
            count: acc.withdrawals.crypto.count + metrics.transfers.count,
          },
          // Fiat withdrawals = withdrawals table (fiat)
          fiat: {
            volume: acc.withdrawals.fiat.volume + metrics.withdrawals.fiat.volume,
            count: acc.withdrawals.fiat.count + metrics.withdrawals.fiat.count,
          },
        },
        trades: {
          volume: acc.trades.volume + metrics.trades.volume,
          count: acc.trades.count + metrics.trades.count,
          fees: acc.trades.fees + metrics.trades.fees,
        },
        kyt: {
          count: acc.kyt.count + metrics.kyt.count,
        },
        totalFees: acc.totalFees + metrics.fees.total,
      };
    },
    {
      deposits: {
        crypto: { volume: 0, count: 0 },
        fiat: { volume: 0, count: 0 },
      },
      withdrawals: {
        crypto: { volume: 0, count: 0 },
        fiat: { volume: 0, count: 0 },
      },
      trades: { volume: 0, count: 0, fees: 0 },
      kyt: { count: 0 },
      totalFees: 0,
    }
  );

  return (
    <div className="space-y-10">
      {/* Section Header */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-6">
          {PERIOD_LABELS[selectedPeriod]} — Detailed Breakdown
        </h3>

        {/* 5 Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
          {/* Deposits */}
          <MetricCard
            title="Deposits"
            icon={<ArrowDownToLine className="h-5 w-5 text-emerald-600" />}
            iconBgColor="bg-emerald-50"
          >
            <CryptoFiatBreakdown crypto={totals.deposits.crypto} fiat={totals.deposits.fiat} />
          </MetricCard>

          {/* Withdrawals */}
          <MetricCard
            title="Withdrawals"
            icon={<ArrowUpFromLine className="h-5 w-5 text-red-600" />}
            iconBgColor="bg-red-50"
          >
            <CryptoFiatBreakdown crypto={totals.withdrawals.crypto} fiat={totals.withdrawals.fiat} />
          </MetricCard>

          {/* Trades */}
          <MetricCard
            title="Trades"
            icon={<ArrowLeftRight className="h-5 w-5 text-blue-600" />}
            iconBgColor="bg-blue-50"
          >
            <TradesCard 
              volume={totals.trades.volume} 
              count={totals.trades.count} 
              fees={totals.trades.fees} 
            />
          </MetricCard>

          {/* Fees */}
          <MetricCard
            title="Fees"
            icon={<DollarSign className="h-5 w-5 text-amber-600" />}
            iconBgColor="bg-amber-50"
          >
            <FeesCard totalFees={totals.totalFees} />
          </MetricCard>

          {/* KYT */}
          <MetricCard
            title="KYT"
            icon={<Shield className="h-5 w-5 text-purple-600" />}
            iconBgColor="bg-purple-50"
          >
            <KytCard count={totals.kyt.count} />
          </MetricCard>
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
