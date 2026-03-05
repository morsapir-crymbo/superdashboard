'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { RefreshCw, Activity } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { TotalVolumeSummary } from '@/components/dashboard/TotalVolumeSummary';
import { useAutoRefresh } from '@/lib/hooks/useAutoRefresh';
import { CustomerVolumeStats } from '@/lib/types/stats';

export default function StatsPage() {
  const [stats, setStats] = useState<CustomerVolumeStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  const fetchStats = useCallback(async (showLoading = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    if (showLoading) setLoading(true);
    setIsRefreshing(true);

    try {
      const { data } = await api.get('/volume/stats', { signal });

      if (!isMountedRef.current) return;

      setStats(data);
      setError('');
      setLastRefresh(new Date());
    } catch (err: any) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') {
        return;
      }

      if (!isMountedRef.current) return;

      const errorMessage =
        err?.response?.data?.message || err?.message || 'Failed to load volume stats';
      const statusCode = err?.response?.status;
      const fullError = statusCode ? `[${statusCode}] ${errorMessage}` : errorMessage;

      console.error('Stats API error:', {
        status: statusCode,
        message: errorMessage,
        data: err?.response?.data,
      });

      setError(fullError);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchStats(true);

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchStats]);

  const { resetInterval } = useAutoRefresh({
    intervalMs: 5 * 60 * 1000,
    enabled: true,
    onRefresh: () => fetchStats(false),
  });

  const handleManualRefresh = useCallback(() => {
    fetchStats(false);
    resetInterval();
  }, [fetchStats, resetInterval]);

  const formatLastRefresh = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-5xl mx-auto p-6">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-slate-900 rounded-xl shadow-lg">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Volume Analytics
                </h1>
                <p className="text-sm text-slate-500">
                  Real-time transaction volume monitoring
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {lastRefresh && (
                <div className="text-right">
                  <p className="text-xs text-slate-400">Last updated</p>
                  <p className="text-sm font-medium text-slate-600">
                    {formatLastRefresh(lastRefresh)}
                  </p>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="h-9 px-4"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`}
                />
                Refresh
              </Button>
            </div>
          </div>
        </header>

        <main>
          {loading ? (
            <div className="flex items-center justify-center py-32">
              <div className="text-center">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-slate-200 rounded-full" />
                  <div className="absolute top-0 left-0 w-16 h-16 border-4 border-slate-900 rounded-full border-t-transparent animate-spin" />
                </div>
                <p className="text-sm text-slate-500 mt-4">Loading volume data...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-8">
              <div className="text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">⚠️</span>
                </div>
                <p className="text-red-600 font-semibold mb-2">
                  Failed to load stats
                </p>
                <p className="text-red-500 text-sm font-mono bg-red-100 rounded-lg px-4 py-2 inline-block max-w-full break-words">
                  {error}
                </p>
              </div>
              <div className="flex justify-center mt-6">
                <Button variant="outline" size="sm" onClick={() => fetchStats(true)}>
                  Try Again
                </Button>
              </div>
            </div>
          ) : stats.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Activity className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-slate-600 font-medium">No customer data available</p>
              <p className="text-sm text-slate-400 mt-2">
                Configure environment connections to see volume stats
              </p>
            </div>
          ) : (
            <TotalVolumeSummary stats={stats} />
          )}
        </main>

        <footer className="mt-8 text-center">
          <p className="text-xs text-slate-400">
            Auto-refreshes every 5 minutes • Data updates in real-time
          </p>
        </footer>
      </div>
    </div>
  );
}
