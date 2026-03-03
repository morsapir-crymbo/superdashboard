import { useEffect, useRef, useCallback } from 'react';

interface UseAutoRefreshOptions {
  intervalMs?: number;
  enabled?: boolean;
  onRefresh: () => Promise<void> | void;
}

interface UseAutoRefreshReturn {
  refresh: () => Promise<void>;
  resetInterval: () => void;
}

export function useAutoRefresh({
  intervalMs = 5 * 60 * 1000,
  enabled = true,
  onRefresh,
}: UseAutoRefreshOptions): UseAutoRefreshReturn {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRefreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  onRefreshRef.current = onRefresh;

  const clearExistingInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const refresh = useCallback(async () => {
    if (isRefreshingRef.current) return;

    isRefreshingRef.current = true;
    try {
      await onRefreshRef.current();
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  const startInterval = useCallback(() => {
    clearExistingInterval();
    if (enabled && intervalMs > 0) {
      intervalRef.current = setInterval(refresh, intervalMs);
    }
  }, [enabled, intervalMs, refresh, clearExistingInterval]);

  const resetInterval = useCallback(() => {
    startInterval();
  }, [startInterval]);

  useEffect(() => {
    startInterval();
    return clearExistingInterval;
  }, [startInterval, clearExistingInterval]);

  return { refresh, resetInterval };
}
