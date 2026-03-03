'use client';

import { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { EnvironmentVolume, MetricType, METRICS } from '@/lib/types/stats';
import { cn } from '@/lib/utils';

interface EnvironmentTableProps {
  environments: EnvironmentVolume[];
  highlightMetric?: MetricType | null;
}

type SortDirection = 'asc' | 'desc' | null;
type SortField = MetricType | 'environmentId';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function EnvironmentTable({
  environments,
  highlightMetric,
}: EnvironmentTableProps) {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortField(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedEnvironments = useMemo(() => {
    if (!sortField || !sortDirection) return environments;

    return [...environments].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      if (sortField === 'environmentId') {
        aVal = a.environmentId;
        bVal = b.environmentId;
      } else {
        aVal = a[sortField];
        bVal = b[sortField];
      }

      if (typeof aVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }

      return sortDirection === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [environments, sortField, sortDirection]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3 w-3 ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 ml-1" />
    );
  };

  if (environments.length === 0) {
    return (
      <p className="text-sm text-slate-500 text-center py-4">
        No environment data available
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[200px]">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 -ml-2 font-medium"
              onClick={() => handleSort('environmentId')}
            >
              Environment
              <SortIcon field="environmentId" />
            </Button>
          </TableHead>
          {METRICS.map((metric) => (
            <TableHead key={metric.key} className="text-right">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-7 px-2 font-medium',
                  highlightMetric === metric.key && 'bg-slate-200'
                )}
                onClick={() => handleSort(metric.key)}
              >
                {metric.shortLabel}
                <SortIcon field={metric.key} />
              </Button>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedEnvironments.map((env) => (
          <TableRow key={env.environmentId}>
            <TableCell className="font-medium">{env.environmentId}</TableCell>
            {METRICS.map((metric) => (
              <TableCell
                key={metric.key}
                className={cn(
                  'text-right tabular-nums',
                  highlightMetric === metric.key && 'bg-slate-100 font-semibold'
                )}
              >
                {formatCurrency(env[metric.key])}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
