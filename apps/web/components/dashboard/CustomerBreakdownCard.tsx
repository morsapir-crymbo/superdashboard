'use client';

import { memo, useState } from 'react';
import { ChevronDown, ChevronRight, Building2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CustomerVolumeStats, MetricSet } from '@/lib/types/stats';

interface CustomerBreakdownCardProps {
  customer: CustomerVolumeStats;
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

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function getVolumeColor(value: number): string {
  if (value === 0) return 'text-slate-400';
  if (value >= 1_000_000) return 'text-emerald-600';
  if (value >= 100_000) return 'text-blue-600';
  return 'text-slate-900';
}

interface MetricColumnProps {
  label: string;
  metrics: MetricSet;
  isToday?: boolean;
}

function MetricColumn({ label, metrics, isToday = false }: MetricColumnProps) {
  const volumeColor = isToday 
    ? (metrics.volume > 0 ? 'text-emerald-600' : 'text-slate-400')
    : getVolumeColor(metrics.volume);

  return (
    <div className="flex flex-col items-end min-w-[120px]">
      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mb-1.5">
        {label}
      </p>
      <p className={cn('text-lg font-bold tabular-nums', volumeColor)}>
        {formatCurrency(metrics.volume)}
      </p>
      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-400 tabular-nums">
        <span className="inline-flex items-center">
          <span className="text-slate-300 mr-0.5">#</span>
          {formatNumber(metrics.depositCount)}
        </span>
        {metrics.depositCount > 0 && (
          <>
            <span className="text-slate-200">|</span>
            <span>{formatCurrency(metrics.avgPerDeposit)}</span>
          </>
        )}
      </div>
    </div>
  );
}

function CustomerBreakdownCardComponent({ customer }: CustomerBreakdownCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasEnvironments = customer.environments.length > 1;
  const isActive = customer.summary.last30Days.volume > 0 || customer.summary.today.volume > 0;

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all duration-200 border-slate-200/80',
        !isActive && 'opacity-60'
      )}
    >
      <div
        className={cn(
          'p-6 transition-colors',
          hasEnvironments && 'cursor-pointer hover:bg-slate-50/50'
        )}
        onClick={() => hasEnvironments && setIsExpanded(!isExpanded)}
      >
        {/* Customer Header Row */}
        <div className="flex items-center gap-3 mb-5">
          {hasEnvironments ? (
            <button className="p-1 hover:bg-slate-200 rounded transition-colors -ml-1 shrink-0">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-400" />
              )}
            </button>
          ) : (
            <div className="w-6" />
          )}
          <div className="p-2.5 bg-slate-100 rounded-lg shrink-0">
            <Building2 className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 text-base">
              {customer.customerName}
            </h4>
            <p className="text-xs text-slate-400 font-mono">
              {customer.customerId}
            </p>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pl-7">
          <MetricColumn 
            label="Last 30 Days" 
            metrics={customer.summary.last30Days} 
          />
          <MetricColumn 
            label="Today" 
            metrics={customer.summary.today} 
            isToday 
          />
          <MetricColumn 
            label="Month to Date" 
            metrics={customer.summary.monthToDate} 
          />
          <MetricColumn 
            label="Previous Month" 
            metrics={customer.summary.previousMonth || { volume: 0, depositCount: 0, avgPerDeposit: 0 }} 
          />
        </div>
      </div>

      {hasEnvironments && (
        <div
          className={cn(
            'overflow-hidden transition-all duration-300 ease-in-out',
            isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
          )}
        >
          <div className="border-t border-slate-100 bg-slate-50/30">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200/60">
                    <th className="text-left py-4 px-6 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Environment
                    </th>
                    <th className="text-right py-4 px-6 text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      30 Days
                    </th>
                    <th className="text-right py-4 px-6 text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      Today
                    </th>
                    <th className="text-right py-4 px-6 text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      Month to Date
                    </th>
                    <th className="text-right py-4 px-6 text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      Prev Month
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customer.environments.map((env, idx) => {
                    const prevMonth = env.previousMonth || { volume: 0, depositCount: 0, avgPerDeposit: 0 };
                    const isLast = idx === customer.environments.length - 1;
                    return (
                      <tr 
                        key={env.environmentId}
                        className={cn(
                          'transition-colors hover:bg-slate-100/50',
                          !isLast && 'border-b border-slate-100'
                        )}
                      >
                        <td className="py-4 px-6">
                          <span className="font-medium text-slate-700">
                            {env.environmentId}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className={cn('font-semibold tabular-nums', getVolumeColor(env.last30Days.volume))}>
                            {formatCurrency(env.last30Days.volume)}
                          </div>
                          <div className="text-[11px] text-slate-400 tabular-nums mt-0.5">
                            {formatNumber(env.last30Days.depositCount)} deposits
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className={cn('font-semibold tabular-nums', env.today.volume > 0 ? 'text-emerald-600' : 'text-slate-400')}>
                            {formatCurrency(env.today.volume)}
                          </div>
                          <div className="text-[11px] text-slate-400 tabular-nums mt-0.5">
                            {formatNumber(env.today.depositCount)} deposits
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className={cn('font-semibold tabular-nums', getVolumeColor(env.monthToDate.volume))}>
                            {formatCurrency(env.monthToDate.volume)}
                          </div>
                          <div className="text-[11px] text-slate-400 tabular-nums mt-0.5">
                            {formatNumber(env.monthToDate.depositCount)} deposits
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className={cn('font-semibold tabular-nums', getVolumeColor(prevMonth.volume))}>
                            {formatCurrency(prevMonth.volume)}
                          </div>
                          <div className="text-[11px] text-slate-400 tabular-nums mt-0.5">
                            {formatNumber(prevMonth.depositCount)} deposits
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

export const CustomerBreakdownCard = memo(CustomerBreakdownCardComponent);
