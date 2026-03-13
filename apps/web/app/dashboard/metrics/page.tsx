'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { RefreshCw, Loader2, BarChart3 } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ExtendedMetricsSection } from '@/components/dashboard/ExtendedMetricsSection';
import { useAutoRefresh } from '@/lib/hooks/useAutoRefresh';
import {
  CustomerExtendedStats,
  ExtendedMetricsResponse,
  MetricType,
} from '@/lib/types/stats';
import { cn } from '@/lib/utils';

const AUTO_REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

const TIME_PERIODS: { key: MetricType; label: string }[] = [
  { key: 'last30Days', label: '30 Days' },
  { key: 'today', label: 'Today' },
  { key: 'monthToDate', label: 'MTD' },
  { key: 'previousMonth', label: 'Prev Month' },
];

export default function MetricsPage() {
  const [extendedStats, setExtendedStats] = useState<CustomerExtendedStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastSuccessfulSync, setLastSuccessfulSync] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<MetricType>('last30Days');

  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  const triggerSync = useCallback(async (): Promise<{ success: boolean; timestamp?: Date }> => {
    try {
      console.log('[Metrics] Triggering volume-sync via superdashboard API');
      setSyncStatus('Syncing from customer databases...');

      const response = await api.post('/volume/sync/trigger');
      const result = response.data;
      console.log('[Metrics] Sync result:', result);

      if (result.success) {
        setSyncStatus(`Synced ${result.summary.successful}/${result.summary.total} customers`);
        return { success: true, timestamp: new Date(result.timestamp) };
      } else if (result.summary?.successful > 0) {
        setSyncStatus(`Partial sync: ${result.summary.successful}/${result.summary.total} customers`);
        return { success: true, timestamp: new Date(result.timestamp) };
      } else {
        setSyncStatus(`Sync failed: ${result.summary?.failed || 0} errors`);
        return { success: false };
      }
    } catch (err) {
      console.warn('[Metrics] Sync trigger failed:', err);
      setSyncStatus('Sync service unavailable - using cached data');
      return { success: false };
    }
  }, []);

  const fetchMetrics = useCallback(
    async (showLoading = false, recalculate = false) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      if (showLoading) setLoading(true);
      setIsRefreshing(true);
      if (recalculate) setIsRecalculating(true);

      try {
        if (recalculate) {
          const syncResult = await triggerSync();

          if (syncResult.success && syncResult.timestamp) {
            setLastSuccessfulSync(syncResult.timestamp);
          }
        }

        const extendedResponse = await api.get('/metrics/extended', { signal });

        if (!isMountedRef.current) return;

        const extendedData: ExtendedMetricsResponse = extendedResponse.data;
        setExtendedStats(extendedData.customers || []);
        setError('');

        if (!recalculate) {
          setLastSuccessfulSync(new Date());
        }

        setTimeout(() => {
          if (isMountedRef.current) setSyncStatus('');
        }, 3000);
      } catch (err: any) {
        if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') {
          return;
        }

        if (!isMountedRef.current) return;

        const errorMessage =
          err?.response?.data?.message || err?.message || 'Failed to load metrics';
        const statusCode = err?.response?.status;
        const fullError = statusCode ? `[${statusCode}] ${errorMessage}` : errorMessage;

        console.error('Metrics API error:', {
          status: statusCode,
          message: errorMessage,
          data: err?.response?.data,
        });

        setError(fullError);
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setIsRefreshing(false);
          setIsRecalculating(false);
        }
      }
    },
    [triggerSync]
  );

  useEffect(() => {
    isMountedRef.current = true;
    fetchMetrics(true, false);

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchMetrics]);

  const { resetInterval } = useAutoRefresh({
    intervalMs: AUTO_REFRESH_INTERVAL_MS,
    enabled: true,
    onRefresh: () => fetchMetrics(false, true),
  });

  const handleManualRefresh = useCallback(() => {
    fetchMetrics(false, true);
    resetInterval();
  }, [fetchMetrics, resetInterval]);

  const formatLastRefresh = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatNextRefresh = () => {
    if (!lastSuccessfulSync) return '';
    const nextRefresh = new Date(lastSuccessfulSync.getTime() + AUTO_REFRESH_INTERVAL_MS);
    return nextRefresh.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header */}
        <header className="mb-8 sm:mb-12">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="p-3 sm:p-4 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl sm:rounded-2xl shadow-lg shrink-0">
                <BarChart3 className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  Detailed Metrics
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Deposits, Withdrawals, Transfers, Trades & KYT
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 sm:gap-6">
              {syncStatus && (
                <div className="text-right hidden sm:block">
                  <p className="text-sm text-blue-600 font-medium animate-pulse">{syncStatus}</p>
                </div>
              )}
              {lastSuccessfulSync && !syncStatus && (
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">
                    Last sync
                  </p>
                  <p className="text-base font-semibold text-slate-700 tabular-nums mt-1">
                    {formatLastRefresh(lastSuccessfulSync)}
                  </p>
                </div>
              )}
              <Button
                variant="outline"
                size="default"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="h-11 sm:h-12 px-5 sm:px-6 font-semibold shadow-sm hover:shadow-md transition-all rounded-xl"
              >
                {isRecalculating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2.5 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className={`h-4 w-4 mr-2.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Mobile sync status */}
          {syncStatus && (
            <div className="mt-4 sm:hidden">
              <p className="text-sm text-blue-600 font-medium animate-pulse text-center">
                {syncStatus}
              </p>
            </div>
          )}
        </header>

        {/* Main Content */}
        <main>
          {loading ? (
            <div className="flex items-center justify-center py-32">
              <div className="text-center">
                <div className="relative inline-block">
                  <div className="w-16 h-16 border-4 border-slate-200 rounded-full" />
                  <div className="absolute top-0 left-0 w-16 h-16 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin" />
                </div>
                <p className="text-sm text-slate-500 mt-6">Loading metrics data...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-8">
              <div className="text-center">
                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">⚠️</span>
                </div>
                <p className="text-red-700 font-semibold text-lg mb-2">Failed to load metrics</p>
                <p className="text-red-600 text-sm font-mono bg-red-100 rounded-lg px-4 py-2 inline-block max-w-full break-words">
                  {error}
                </p>
              </div>
              <div className="flex justify-center mt-6">
                <Button variant="outline" size="default" onClick={() => fetchMetrics(true, false)}>
                  Try Again
                </Button>
              </div>
            </div>
          ) : extendedStats.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-slate-700 font-semibold text-lg">No metrics data available</p>
              <p className="text-sm text-slate-500 mt-2">
                Configure environment connections to see detailed metrics
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Time Period Selector */}
              <div className="flex items-center justify-center">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  {TIME_PERIODS.map((period) => (
                    <button
                      key={period.key}
                      onClick={() => setSelectedPeriod(period.key)}
                      className={cn(
                        'px-4 py-2 text-sm font-medium rounded-lg transition-all',
                        selectedPeriod === period.key
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      )}
                    >
                      {period.label}
                    </button>
                  ))}
                </div>
              </div>

              <ExtendedMetricsSection
                customers={extendedStats}
                selectedPeriod={selectedPeriod}
              />
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="mt-16 text-center space-y-2">
          <p className="text-sm text-slate-400">
            Data syncs from customer databases every 15 minutes
            {lastSuccessfulSync && (
              <>
                <span className="mx-2.5 text-slate-300">•</span>
                <span>Next sync at {formatNextRefresh()}</span>
              </>
            )}
          </p>
          <p className="text-xs text-slate-400/80">
            Click Refresh to sync latest data from all customer databases
          </p>
        </footer>
      </div>
    </div>
  );
}
