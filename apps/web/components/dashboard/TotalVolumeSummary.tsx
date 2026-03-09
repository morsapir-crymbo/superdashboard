'use client';

import { memo, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, DollarSign, Calendar, CalendarDays, CalendarCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CustomerVolumeStats, MetricSet } from '@/lib/types/stats';
import { CustomerBreakdownCard } from './CustomerBreakdownCard';

interface TotalVolumeSummaryProps {
  stats: CustomerVolumeStats[];
}

function formatCurrency(value: number): string {
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

function formatFullCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

interface MetricCardProps {
  label: string;
  icon: React.ReactNode;
  metrics: MetricSet;
  accentColor?: string;
  iconBgColor?: string;
}

function MetricCard({ label, icon, metrics, accentColor = 'text-slate-900', iconBgColor = 'bg-slate-100' }: MetricCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/60 p-5 hover:shadow-md hover:border-slate-300/60 transition-all duration-200">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-5">
        <div className={cn('p-2 rounded-lg', iconBgColor)}>
          {icon}
        </div>
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          {label}
        </span>
      </div>
      
      {/* Volume */}
      <div className="mb-4">
        <p className={cn('text-3xl font-bold tabular-nums tracking-tight leading-none', accentColor)}>
          {formatCurrency(metrics.volume)}
        </p>
        <p className="text-[11px] text-slate-400 tabular-nums mt-1.5">
          {formatFullCurrency(metrics.volume)}
        </p>
      </div>
      
      {/* Stats Footer */}
      <div className="pt-4 border-t border-slate-100">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Deposits</span>
            <span className="font-semibold text-slate-700 tabular-nums text-sm">
              {formatNumber(metrics.depositCount)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Avg / deposit</span>
            <span className="font-semibold text-slate-700 tabular-nums text-sm">
              {metrics.depositCount > 0 ? formatCurrency(metrics.avgPerDeposit) : 'N/A'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TotalVolumeSummaryComponent({ stats }: TotalVolumeSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const totals = stats.reduce(
    (acc, customer) => ({
      last30Days: {
        volume: acc.last30Days.volume + customer.summary.last30Days.volume,
        depositCount: acc.last30Days.depositCount + customer.summary.last30Days.depositCount,
        avgPerDeposit: 0,
      },
      today: {
        volume: acc.today.volume + customer.summary.today.volume,
        depositCount: acc.today.depositCount + customer.summary.today.depositCount,
        avgPerDeposit: 0,
      },
      monthToDate: {
        volume: acc.monthToDate.volume + customer.summary.monthToDate.volume,
        depositCount: acc.monthToDate.depositCount + customer.summary.monthToDate.depositCount,
        avgPerDeposit: 0,
      },
      previousMonth: {
        volume: acc.previousMonth.volume + (customer.summary.previousMonth?.volume || 0),
        depositCount: acc.previousMonth.depositCount + (customer.summary.previousMonth?.depositCount || 0),
        avgPerDeposit: 0,
      },
    }),
    {
      last30Days: { volume: 0, depositCount: 0, avgPerDeposit: 0 },
      today: { volume: 0, depositCount: 0, avgPerDeposit: 0 },
      monthToDate: { volume: 0, depositCount: 0, avgPerDeposit: 0 },
      previousMonth: { volume: 0, depositCount: 0, avgPerDeposit: 0 },
    }
  );

  totals.last30Days.avgPerDeposit = totals.last30Days.depositCount > 0 
    ? Math.round((totals.last30Days.volume / totals.last30Days.depositCount) * 100) / 100 
    : 0;
  totals.today.avgPerDeposit = totals.today.depositCount > 0 
    ? Math.round((totals.today.volume / totals.today.depositCount) * 100) / 100 
    : 0;
  totals.monthToDate.avgPerDeposit = totals.monthToDate.depositCount > 0 
    ? Math.round((totals.monthToDate.volume / totals.monthToDate.depositCount) * 100) / 100 
    : 0;
  totals.previousMonth.avgPerDeposit = totals.previousMonth.depositCount > 0 
    ? Math.round((totals.previousMonth.volume / totals.previousMonth.depositCount) * 100) / 100 
    : 0;
  
  const prevMonth = new Date();
  prevMonth.setMonth(prevMonth.getMonth() - 1);
  const prevMonthName = prevMonth.toLocaleString('en-US', { month: 'long' });

  const activeCustomers = stats.filter(
    (c) => c.summary.last30Days.volume > 0 || c.summary.today.volume > 0
  ).length;

  return (
    <div className="space-y-8">
      <Card className="overflow-hidden bg-gradient-to-br from-slate-50 to-white border-slate-200/60 shadow-sm">
        <div className="p-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-slate-900 rounded-xl shadow-lg">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Total System Volume
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {activeCustomers} active customer{activeCustomers !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <button
              className={cn(
                'flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all',
                isExpanded 
                  ? 'bg-slate-900 text-white shadow-lg' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              )}
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Hide Details' : 'View Details'}
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            <MetricCard
              label="Last 30 Days"
              icon={<CalendarDays className="h-4 w-4 text-slate-600" />}
              metrics={totals.last30Days}
              iconBgColor="bg-slate-100"
            />
            <MetricCard
              label="Today"
              icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
              metrics={totals.today}
              accentColor="text-emerald-600"
              iconBgColor="bg-emerald-50"
            />
            <MetricCard
              label="Month to Date"
              icon={<Calendar className="h-4 w-4 text-slate-600" />}
              metrics={totals.monthToDate}
              iconBgColor="bg-slate-100"
            />
            <MetricCard
              label={prevMonthName}
              icon={<CalendarCheck className="h-4 w-4 text-blue-600" />}
              metrics={totals.previousMonth}
              accentColor="text-blue-600"
              iconBgColor="bg-blue-50"
            />
          </div>

          {/* Expand Hint */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center">
              {isExpanded ? 'Showing breakdown by customer below' : 'Click "View Details" to see breakdown by customer'}
            </p>
          </div>
        </div>
      </Card>

      {/* Customer Breakdown */}
      <div
        className={cn(
          'space-y-5 transition-all duration-300 ease-in-out',
          isExpanded
            ? 'opacity-100 max-h-[5000px]'
            : 'opacity-0 max-h-0 overflow-hidden'
        )}
      >
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider px-1">
          Volume by Customer
        </h3>
        {stats.map((customer) => (
          <CustomerBreakdownCard key={customer.customerId} customer={customer} />
        ))}
      </div>
    </div>
  );
}

export const TotalVolumeSummary = memo(TotalVolumeSummaryComponent);
