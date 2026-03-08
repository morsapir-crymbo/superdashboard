'use client';

import { memo, useState } from 'react';
import { ChevronDown, ChevronRight, Building2, Hash, Calculator } from 'lucide-react';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { CustomerVolumeStats, MetricSet } from '@/lib/types/stats';

interface CustomerBreakdownCardProps {
  customer: CustomerVolumeStats;
}

function formatCurrency(value: number): string {
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

function getVolumeColor(value: number): string {
  if (value === 0) return 'text-slate-400';
  if (value >= 1_000_000) return 'text-emerald-600';
  if (value >= 100_000) return 'text-blue-600';
  return 'text-slate-900';
}

interface MetricCellProps {
  metrics: MetricSet;
  isToday?: boolean;
}

function MetricCell({ metrics, isToday = false }: MetricCellProps) {
  const volumeColor = isToday 
    ? (metrics.volume > 0 ? 'text-emerald-600' : 'text-slate-400')
    : getVolumeColor(metrics.volume);

  return (
    <div className="text-right space-y-1">
      <p className={cn('text-lg font-bold tabular-nums', volumeColor)}>
        {formatCurrency(metrics.volume)}
      </p>
      <div className="flex items-center justify-end gap-3 text-xs">
        <span className="text-slate-500 flex items-center gap-1">
          <Hash className="h-3 w-3" />
          {formatNumber(metrics.depositCount)}
        </span>
        <span className="text-slate-500 flex items-center gap-1">
          <Calculator className="h-3 w-3" />
          {metrics.depositCount > 0 ? formatCurrency(metrics.avgPerDeposit) : 'N/A'}
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
        'overflow-hidden transition-all duration-200',
        !isActive && 'opacity-60'
      )}
    >
      <div
        className={cn(
          'p-4 cursor-pointer hover:bg-slate-50 transition-colors',
          hasEnvironments && 'cursor-pointer'
        )}
        onClick={() => hasEnvironments && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {hasEnvironments ? (
              <button className="p-1 hover:bg-slate-200 rounded transition-colors">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-slate-600" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-600" />
                )}
              </button>
            ) : (
              <div className="w-6" />
            )}
            <div className="p-1.5 bg-slate-100 rounded-lg">
              <Building2 className="h-4 w-4 text-slate-600" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-900">
                {customer.customerName}
              </h4>
              <p className="text-xs text-slate-400 font-mono">
                {customer.customerId}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 lg:gap-6">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide text-right mb-1">
                30 Days
              </p>
              <MetricCell metrics={customer.summary.last30Days} />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide text-right mb-1">
                Today
              </p>
              <MetricCell metrics={customer.summary.today} isToday />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide text-right mb-1">
                MTD
              </p>
              <MetricCell metrics={customer.summary.monthToDate} />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide text-right mb-1">
                Prev Month
              </p>
              <MetricCell metrics={customer.summary.previousMonth || { volume: 0, depositCount: 0, avgPerDeposit: 0 }} />
            </div>
          </div>
        </div>
      </div>

      {hasEnvironments && (
        <div
          className={cn(
            'overflow-hidden transition-all duration-300',
            isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
          )}
        >
          <div className="border-t border-slate-100 bg-slate-50 p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left">Environment</TableHead>
                  <TableHead className="text-right">30D Volume</TableHead>
                  <TableHead className="text-right">30D #</TableHead>
                  <TableHead className="text-right">Today Vol</TableHead>
                  <TableHead className="text-right">Today #</TableHead>
                  <TableHead className="text-right">MTD Vol</TableHead>
                  <TableHead className="text-right">MTD #</TableHead>
                  <TableHead className="text-right">Prev Month</TableHead>
                  <TableHead className="text-right">Prev #</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.environments.map((env) => {
                  const prevMonth = env.previousMonth || { volume: 0, depositCount: 0, avgPerDeposit: 0 };
                  return (
                    <TableRow key={env.environmentId}>
                      <TableCell className="font-medium text-slate-900">
                        {env.environmentId}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className={getVolumeColor(env.last30Days.volume)}>
                          {formatFullCurrency(env.last30Days.volume)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-slate-600">
                        {formatNumber(env.last30Days.depositCount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className={env.today.volume > 0 ? 'text-emerald-600' : 'text-slate-400'}>
                          {formatFullCurrency(env.today.volume)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-slate-600">
                        {formatNumber(env.today.depositCount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className={getVolumeColor(env.monthToDate.volume)}>
                          {formatFullCurrency(env.monthToDate.volume)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-slate-600">
                        {formatNumber(env.monthToDate.depositCount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className={getVolumeColor(prevMonth.volume)}>
                          {formatFullCurrency(prevMonth.volume)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-slate-600">
                        {formatNumber(prevMonth.depositCount)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </Card>
  );
}

export const CustomerBreakdownCard = memo(CustomerBreakdownCardComponent);
