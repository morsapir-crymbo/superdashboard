'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { RefreshCw, Activity, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { TotalVolumeSummary } from '@/components/dashboard/TotalVolumeSummary';
import { useAutoRefresh } from '@/lib/hooks/useAutoRefresh';
import { CustomerVolumeStats } from '@/lib/types/stats';

const AUTO_REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const VOLUME_SYNC_URL = process.env.NEXT_PUBLIC_VOLUME_SYNC_URL || 'http://localhost:3014';

export default function StatsPage() {
  const [stats, setStats] = useState<CustomerVolumeStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastSuccessfulSync, setLastSuccessfulSync] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');

  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  const triggerVolumeSync = useCallback(async (): Promise<{ success: boolean; timestamp?: Date }> => {
    try {
      console.log('[Stats] Triggering volume-sync service at', VOLUME_SYNC_URL);
      setSyncStatus('Syncing from customer databases...');
      
      const response = await fetch(`${VOLUME_SYNC_URL}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('[Stats] Sync result:', result);
      
      if (result.success) {
        setSyncStatus(`Synced ${result.summary.successful}/${result.summary.total} customers`);
        return { success: true, timestamp: new Date(result.timestamp) };
      } else if (result.summary.successful > 0) {
        setSyncStatus(`Partial sync: ${result.summary.successful}/${result.summary.total} customers`);
        return { success: true, timestamp: new Date(result.timestamp) };
      } else {
        setSyncStatus(`Sync failed: ${result.summary.failed} errors`);
        return { success: false };
      }
    } catch (err) {
      console.warn('[Stats] Volume-sync service unavailable:', err);
      setSyncStatus('Sync service unavailable - using cached data');
      return { success: false };
    }
  }, []);

  const fetchStats = useCallback(async (showLoading = false, recalculate = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    if (showLoading) setLoading(true);
    setIsRefreshing(true);
    if (recalculate) setIsRecalculating(true);

    try {
      // If recalculating, first trigger the volume-sync service
      let syncSucceeded = false;
      if (recalculate) {
        const syncResult = await triggerVolumeSync();
        syncSucceeded = syncResult.success;
        
        // Only update last successful sync timestamp if sync actually succeeded
        if (syncResult.success && syncResult.timestamp) {
          setLastSuccessfulSync(syncResult.timestamp);
        }
      }

      // Then fetch the stats from the API (which reads from the database)
      const response = await api.get('/volume/stats', { signal });
      const data: CustomerVolumeStats[] = response.data;

      if (!isMountedRef.current) return;

      setStats(data);
      setError('');
      
      // If this was just a data fetch (not recalculate), update timestamp
      if (!recalculate) {
        setLastSuccessfulSync(new Date());
      }
      
      // Clear sync status after a delay
      setTimeout(() => {
        if (isMountedRef.current) setSyncStatus('');
      }, 3000);
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
      // Do NOT update lastSuccessfulSync on error
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setIsRefreshing(false);
        setIsRecalculating(false);
      }
    }
  }, [triggerVolumeSync]);

  useEffect(() => {
    isMountedRef.current = true;
    // Initial load - just fetch cached data quickly
    fetchStats(true, false);

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchStats]);

  const { resetInterval } = useAutoRefresh({
    intervalMs: AUTO_REFRESH_INTERVAL_MS,
    enabled: true,
    onRefresh: () => fetchStats(false, true), // Auto-refresh triggers recalculation
  });

  const handleManualRefresh = useCallback(() => {
    // Manual refresh triggers full recalculation
    fetchStats(false, true);
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

  const formatNextRefresh = () => {
    if (!lastSuccessfulSync) return '';
    const nextRefresh = new Date(lastSuccessfulSync.getTime() + AUTO_REFRESH_INTERVAL_MS);
    return nextRefresh.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
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
              {syncStatus && (
                <div className="text-right">
                  <p className="text-xs text-blue-600 font-medium animate-pulse">
                    {syncStatus}
                  </p>
                </div>
              )}
              {lastSuccessfulSync && !syncStatus && (
                <div className="text-right">
                  <p className="text-xs text-slate-400">Last successful sync</p>
                  <p className="text-sm font-medium text-slate-600">
                    {formatLastRefresh(lastSuccessfulSync)}
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
                {isRecalculating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw
                      className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`}
                    />
                    Refresh
                  </>
                )}
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
                <Button variant="outline" size="sm" onClick={() => fetchStats(true, false)}>
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

        <footer className="mt-8 text-center space-y-1">
          <p className="text-xs text-slate-400">
            Data syncs from customer databases every 15 minutes
            {lastSuccessfulSync && ` • Next sync at ${formatNextRefresh()}`}
          </p>
          <p className="text-xs text-slate-400">
            Click Refresh to sync latest data from all customer databases
          </p>
        </footer>
      </div>
    </div>
  );
}
