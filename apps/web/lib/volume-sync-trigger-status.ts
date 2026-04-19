export type VolumeSyncTriggerResponse = {
  inProgress?: boolean;
  success?: boolean;
  timestamp?: string;
  summary?: { total: number; successful: number; failed: number };
  results?: Array<{ customerId: string; success: boolean; message: string }>;
};

function truncateMessage(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function formatFailures(
  results: Array<{ customerId: string; success: boolean; message: string }>,
): string {
  const failed = results.filter((r) => !r.success);
  if (!failed.length) return '';
  return ` — ${failed.map((r) => `${r.customerId}: ${truncateMessage(r.message, 90)}`).join('; ')}`;
}

/**
 * Maps POST /volume/sync/trigger JSON to UI status text.
 * When another sync is already running, the API returns success:false with an empty summary.
 */
export function volumeSyncTriggerStatus(result: VolumeSyncTriggerResponse): {
  status: string;
  refreshSuccess: boolean;
} {
  const summary = result.summary;
  const isConcurrentRun =
    result.inProgress ||
    (result.success === false &&
      summary?.total === 0 &&
      summary?.failed === 0 &&
      summary?.successful === 0);

  if (isConcurrentRun) {
    return { status: 'Sync already running — loading latest data...', refreshSuccess: false };
  }

  if (result.success && summary) {
    return {
      status: `Synced ${summary.successful}/${summary.total} customers`,
      refreshSuccess: true,
    };
  }

  if (summary && summary.successful > 0) {
    const detail = formatFailures(result.results ?? []);
    return {
      status: `Partial sync: ${summary.successful}/${summary.total} customers${detail}`,
      refreshSuccess: true,
    };
  }

  if (summary && summary.failed > 0) {
    const detail = formatFailures(result.results ?? []);
    return {
      status: `Sync failed: ${summary.failed} error(s)${detail}`,
      refreshSuccess: false,
    };
  }

  return { status: 'Sync failed', refreshSuccess: false };
}
