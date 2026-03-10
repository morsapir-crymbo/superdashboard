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
    <div className="flex flex-col items-end">
      <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-2">
        {label}
      </p>
      <p className={cn('text-xl font-bold tabular-nums whitespace-nowrap', volumeColor)}>
        {formatCurrency(metrics.volume)}
      </p>
      <div className="flex flex-col items-end gap-0.5 mt-2 text-xs text-slate-500 tabular-nums">
        <span className="whitespace-nowrap">
          <span className="text-slate-400">#</span> {formatNumber(metrics.depositCount)}
        </span>
        <span className="whitespace-nowrap text-slate-400">
          {metrics.depositCount > 0 ? `avg ${formatCurrency(metrics.avgPerDeposit)}` : 'N/A'}
        </span>
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
          'p-5 sm:p-6 lg:p-8 transition-colors',
          hasEnvironments && 'cursor-pointer hover:bg-slate-50/50'
        )}
        onClick={() => hasEnvironments && setIsExpanded(!isExpanded)}
      >
        {/* Customer Header Row */}
        <div className="flex items-center gap-4 mb-6">
          {hasEnvironments ? (
            <button className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors -ml-1 shrink-0">
              {isExpanded ? (
                <ChevronDown className="h-5 w-5 text-slate-400" />
              ) : (
                <ChevronRight className="h-5 w-5 text-slate-400" />
              )}
            </button>
          ) : (
            <div className="w-8" />
          )}
          <div className="p-3 bg-slate-100 rounded-xl shrink-0">
            <Building2 className="h-5 w-5 text-slate-600" />
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-slate-900 text-lg truncate">
              {customer.customerName}
            </h4>
            <p className="text-sm text-slate-400 font-mono truncate">
              {customer.customerId}
            </p>
          </div>
        </div>

        {/* Metrics Grid - Responsive with proper spacing */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6 pl-0 sm:pl-12">
          <MetricColumn 
            label="30 Days" 
            metrics={customer.summary.last30Days} 
          />
          <MetricColumn 
            label="Today" 
            metrics={customer.summary.today} 
            isToday 
          />
          <MetricColumn 
            label="MTD" 
            metrics={customer.summary.monthToDate} 
          />
          <MetricColumn 
            label="Prev Month" 
            metrics={customer.summary.previousMonth || { volume: 0, depositCount: 0, avgPerDeposit: 0 }} 
          />
        </div>
      </div>

      {hasEnvironments && (
        <div
          className={cn(
            'overflow-hidden transition-all duration-300 ease-in-out',
            isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
          )}
        >
          <div className="border-t border-slate-100 bg-slate-50/50">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-200/60">
                    <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Environment
                    </th>
                    <th className="text-right py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      30 Days
                    </th>
                    <th className="text-right py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      Today
                    </th>
                    <th className="text-right py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      MTD
                    </th>
                    <th className="text-right py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
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
                        <td className="py-5 px-6">
                          <span className="font-medium text-slate-700">
                            {env.environmentId}
                          </span>
                        </td>
                        <td className="py-5 px-6 text-right">
                          <div className={cn('font-semibold tabular-nums text-base whitespace-nowrap', getVolumeColor(env.last30Days.volume))}>
                            {formatCurrency(env.last30Days.volume)}
                          </div>
                          <div className="text-xs text-slate-400 tabular-nums mt-1 whitespace-nowrap">
                            {formatNumber(env.last30Days.depositCount)} deposits
                          </div>
                        </td>
                        <td className="py-5 px-6 text-right">
                          <div className={cn('font-semibold tabular-nums text-base whitespace-nowrap', env.today.volume > 0 ? 'text-emerald-600' : 'text-slate-400')}>
                            {formatCurrency(env.today.volume)}
                          </div>
                          <div className="text-xs text-slate-400 tabular-nums mt-1 whitespace-nowrap">
                            {formatNumber(env.today.depositCount)} deposits
                          </div>
                        </td>
                        <td className="py-5 px-6 text-right">
                          <div className={cn('font-semibold tabular-nums text-base whitespace-nowrap', getVolumeColor(env.monthToDate.volume))}>
                            {formatCurrency(env.monthToDate.volume)}
                          </div>
                          <div className="text-xs text-slate-400 tabular-nums mt-1 whitespace-nowrap">
                            {formatNumber(env.monthToDate.depositCount)} deposits
                          </div>
                        </td>
                        <td className="py-5 px-6 text-right">
                          <div className={cn('font-semibold tabular-nums text-base whitespace-nowrap', getVolumeColor(prevMonth.volume))}>
                            {formatCurrency(prevMonth.volume)}
                          </div>
                          <div className="text-xs text-slate-400 tabular-nums mt-1 whitespace-nowrap">
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
