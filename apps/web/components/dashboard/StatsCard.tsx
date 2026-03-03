'use client';

import { memo } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  label: string;
  value: number;
  description?: string;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
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

function StatsCardComponent({
  label,
  value,
  description,
  isActive,
  onClick,
  className,
}: StatsCardProps) {
  return (
    <Card
      className={cn(
        'p-4 cursor-pointer transition-all hover:shadow-md',
        isActive && 'ring-2 ring-slate-900 bg-slate-50',
        className
      )}
      onClick={onClick}
    >
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
        {formatCurrency(value)}
      </p>
      {description && (
        <p className="text-xs text-slate-400 mt-1">{description}</p>
      )}
    </Card>
  );
}

export const StatsCard = memo(StatsCardComponent);
