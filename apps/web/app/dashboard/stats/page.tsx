'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { CustomerStatsRow } from '@/components/dashboard/CustomerStatsRow';
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

      const errorMessage = err?.response?.data?.message 
        || err?.message 
        || 'Failed to load volume stats';
      const statusCode = err?.response?.status;
      const fullError = statusCode 
        ? `[${statusCode}] ${errorMessage}` 
        : errorMessage;
      
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
    <div className="h-screen overflow-auto p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Volume Analytics</h1>
            <p className="text-sm text-slate-500 mt-1">
              Volume per customer and environment
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-xs text-slate-400">
                Last updated: {formatLastRefresh(lastRefresh)}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="h-8"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-slate-400 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Loading volume data...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-center">
              <p className="text-red-600 font-medium mb-1">Failed to load stats</p>
              <p className="text-red-500 text-sm font-mono bg-red-100 rounded px-2 py-1 inline-block max-w-full break-words">
                {error}
              </p>
            </div>
            <div className="flex justify-center mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchStats(true)}
              >
                Try Again
              </Button>
            </div>
          </div>
        ) : stats.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
            <p className="text-slate-500">No customer data available</p>
            <p className="text-xs text-slate-400 mt-1">
              Configure environment connections to see volume stats
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {stats.map((customer) => (
              <CustomerStatsRow key={customer.customerId} customer={customer} />
            ))}
          </div>
        )}

        <div className="mt-6 text-center">
          <p className="text-xs text-slate-400">
            Auto-refreshes every 5 minutes
          </p>
        </div>
      </div>
    </div>
  );
}
