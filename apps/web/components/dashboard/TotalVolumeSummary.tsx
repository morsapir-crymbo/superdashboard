'use client';

import { memo, useState } from 'react';
import { ChevronDown, ChevronRight, TrendingUp, DollarSign, Calendar, CalendarDays } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CustomerVolumeStats } from '@/lib/types/stats';
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

function TotalVolumeSummaryComponent({ stats }: TotalVolumeSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const totals = stats.reduce(
    (acc, customer) => ({
      last30Days: acc.last30Days + customer.summary.last30Days,
      today: acc.today + customer.summary.today,
      monthToDate: acc.monthToDate + customer.summary.monthToDate,
    }),
    { last30Days: 0, today: 0, monthToDate: 0 }
  );

  const activeCustomers = stats.filter(
    (c) => c.summary.last30Days > 0 || c.summary.today > 0
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
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-slate-500">
                <CalendarDays className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">
                  Last 30 Days
                </span>
              </div>
              <p className="text-3xl font-bold text-slate-900 tabular-nums">
                {formatCurrency(totals.last30Days)}
              </p>
              <p className="text-xs text-slate-400 tabular-nums">
                {formatFullCurrency(totals.last30Days)}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-slate-500">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">
                  Today
                </span>
              </div>
              <p className="text-3xl font-bold text-emerald-600 tabular-nums">
                {formatCurrency(totals.today)}
              </p>
              <p className="text-xs text-slate-400 tabular-nums">
                {formatFullCurrency(totals.today)}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-slate-500">
                <Calendar className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">
                  Month to Date
                </span>
              </div>
              <p className="text-3xl font-bold text-slate-900 tabular-nums">
                {formatCurrency(totals.monthToDate)}
              </p>
              <p className="text-xs text-slate-400 tabular-nums">
                {formatFullCurrency(totals.monthToDate)}
              </p>
            </div>
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
            ? 'opacity-100 max-h-[2000px]'
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
