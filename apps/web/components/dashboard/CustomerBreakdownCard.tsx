'use client';

import { memo, useState } from 'react';
import { ChevronDown, ChevronRight, Building2 } from 'lucide-react';
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
import { CustomerVolumeStats } from '@/lib/types/stats';

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

function getVolumeColor(value: number): string {
  if (value === 0) return 'text-slate-400';
  if (value >= 1_000_000) return 'text-emerald-600';
  if (value >= 100_000) return 'text-blue-600';
  return 'text-slate-900';
}

function CustomerBreakdownCardComponent({ customer }: CustomerBreakdownCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasEnvironments = customer.environments.length > 1;
  const isActive = customer.summary.last30Days > 0 || customer.summary.today > 0;

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

          <div className="flex items-center gap-8">
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                30 Days
              </p>
              <p
                className={cn(
                  'text-lg font-bold tabular-nums',
                  getVolumeColor(customer.summary.last30Days)
                )}
              >
                {formatCurrency(customer.summary.last30Days)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Today
              </p>
              <p
                className={cn(
                  'text-lg font-bold tabular-nums',
                  customer.summary.today > 0 ? 'text-emerald-600' : 'text-slate-400'
                )}
              >
                {formatCurrency(customer.summary.today)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                MTD
              </p>
              <p
                className={cn(
                  'text-lg font-bold tabular-nums',
                  getVolumeColor(customer.summary.monthToDate)
                )}
              >
                {formatCurrency(customer.summary.monthToDate)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {hasEnvironments && (
        <div
          className={cn(
            'overflow-hidden transition-all duration-300',
            isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
          )}
        >
          <div className="border-t border-slate-100 bg-slate-50 p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left">Environment</TableHead>
                  <TableHead>Last 30 Days</TableHead>
                  <TableHead>Today</TableHead>
                  <TableHead>Month to Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.environments.map((env) => (
                  <TableRow key={env.environmentId}>
                    <TableCell className="font-medium text-slate-900">
                      {env.environmentId}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className={getVolumeColor(env.last30Days)}>
                        {formatFullCurrency(env.last30Days)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span
                        className={
                          env.today > 0 ? 'text-emerald-600' : 'text-slate-400'
                        }
                      >
                        {formatFullCurrency(env.today)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className={getVolumeColor(env.monthToDate)}>
                        {formatFullCurrency(env.monthToDate)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </Card>
  );
}

export const CustomerBreakdownCard = memo(CustomerBreakdownCardComponent);
