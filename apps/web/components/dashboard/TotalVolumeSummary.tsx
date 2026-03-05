'use client';

import { memo, useState } from 'react';
import { ChevronDown, ChevronRight, TrendingUp, DollarSign, Calendar, CalendarDays, Hash, Calculator } from 'lucide-react';
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

interface MetricBlockProps {
  label: string;
  icon: React.ReactNode;
  metrics: MetricSet;
  volumeColor?: string;
}

function MetricBlock({ label, icon, metrics, volumeColor = 'text-slate-900' }: MetricBlockProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      
      <div className="space-y-2">
        <div>
          <p className={cn('text-2xl font-bold tabular-nums', volumeColor)}>
            {formatCurrency(metrics.volume)}
          </p>
          <p className="text-xs text-slate-400 tabular-nums">
            {formatFullCurrency(metrics.volume)}
          </p>
        </div>
        
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Hash className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-slate-600 font-medium">
              {formatNumber(metrics.depositCount)}
            </span>
            <span className="text-slate-400 text-xs">deposits</span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <Calculator className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-slate-600 font-medium">
              {metrics.depositCount > 0 ? formatCurrency(metrics.avgPerDeposit) : 'N/A'}
            </span>
            <span className="text-slate-400 text-xs">avg</span>
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
    }),
    {
      last30Days: { volume: 0, depositCount: 0, avgPerDeposit: 0 },
      today: { volume: 0, depositCount: 0, avgPerDeposit: 0 },
      monthToDate: { volume: 0, depositCount: 0, avgPerDeposit: 0 },
    }
  );

  // Calculate averages after summing
  totals.last30Days.avgPerDeposit = totals.last30Days.depositCount > 0 
    ? Math.round((totals.last30Days.volume / totals.last30Days.depositCount) * 100) / 100 
    : 0;
  totals.today.avgPerDeposit = totals.today.depositCount > 0 
    ? Math.round((totals.today.volume / totals.today.depositCount) * 100) / 100 
    : 0;
  totals.monthToDate.avgPerDeposit = totals.monthToDate.depositCount > 0 
    ? Math.round((totals.monthToDate.volume / totals.monthToDate.depositCount) * 100) / 100 
    : 0;

  const activeCustomers = stats.filter(
    (c) => c.summary.last30Days.volume > 0 || c.summary.today.volume > 0
  ).length;

  return (
    <div className="space-y-4">
      <Card
        className={cn(
          'overflow-hidden transition-all duration-200 cursor-pointer',
          isExpanded && 'ring-2 ring-slate-900'
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-900 rounded-lg">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Total System Volume
                </h2>
                <p className="text-sm text-slate-500">
                  {activeCustomers} active customer{activeCustomers !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <button
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-5 w-5 text-slate-600" />
              ) : (
                <ChevronRight className="h-5 w-5 text-slate-600" />
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricBlock
              label="Last 30 Days"
              icon={<CalendarDays className="h-4 w-4" />}
              metrics={totals.last30Days}
            />
            <MetricBlock
              label="Today"
              icon={<DollarSign className="h-4 w-4" />}
              metrics={totals.today}
              volumeColor="text-emerald-600"
            />
            <MetricBlock
              label="Month to Date"
              icon={<Calendar className="h-4 w-4" />}
              metrics={totals.monthToDate}
            />
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center">
              {isExpanded ? 'Click to collapse' : 'Click to see breakdown by customer'}
            </p>
          </div>
        </div>
      </Card>

      <div
        className={cn(
          'space-y-3 transition-all duration-300',
          isExpanded
            ? 'opacity-100 max-h-[4000px]'
            : 'opacity-0 max-h-0 overflow-hidden'
        )}
      >
        <h3 className="text-sm font-medium text-slate-600 px-1">
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
