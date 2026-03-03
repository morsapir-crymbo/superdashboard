'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { StatsCard } from './StatsCard';
import { EnvironmentTable } from './EnvironmentTable';
import { CustomerVolumeStats, MetricType, METRICS } from '@/lib/types/stats';
import { cn } from '@/lib/utils';

interface CustomerStatsRowProps {
  customer: CustomerVolumeStats;
}

export function CustomerStatsRow({ customer }: CustomerStatsRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeMetric, setActiveMetric] = useState<MetricType | null>(null);

  const handleCardClick = (metric: MetricType) => {
    if (activeMetric === metric) {
      setActiveMetric(null);
      setIsExpanded(false);
    } else {
      setActiveMetric(metric);
      setIsExpanded(true);
    }
  };

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
    if (isExpanded) {
      setActiveMetric(null);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={handleToggleExpand}
            className="flex items-center gap-2 hover:text-slate-600 transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <h3 className="text-lg font-semibold text-slate-900">
              {customer.customerName}
            </h3>
          </button>
          <span className="text-xs text-slate-400 font-mono">
            {customer.customerId}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {METRICS.map((metric) => (
            <StatsCard
              key={metric.key}
              label={metric.label}
              value={customer.summary[metric.key]}
              isActive={activeMetric === metric.key}
              onClick={() => handleCardClick(metric.key)}
            />
          ))}
        </div>
      </div>

      <div
        className={cn(
          'overflow-hidden transition-all duration-300',
          isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="border-t border-slate-100 p-4 bg-slate-50">
          <EnvironmentTable
            environments={customer.environments}
            highlightMetric={activeMetric}
          />
        </div>
      </div>
    </Card>
  );
}
