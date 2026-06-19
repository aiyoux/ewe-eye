export const SYNC_TRACE_EVENT = '__modular_sync_trace__';
const SYNC_TRACE_STORAGE_KEY = 'modular.sync.trace';
const SYNC_TRACE_QUERY_PARAM = 'syncTrace';
const SYNC_TRACE_LIMIT = 400;

export interface SyncTraceEntry {
  ts: number;
  scope: string;
  event: string;
  data: Record<string, unknown>;
}

function readTraceFlag(value: string | null): boolean | null {
  if (value === null) return null;
  if (value === '1' || value === 'true' || value === 'on') return true;
  if (value === '0' || value === 'false' || value === 'off') return false;
  return null;
}

export function isSyncTraceEnabled(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const fromQuery = readTraceFlag(new URL(window.location.href).searchParams.get(SYNC_TRACE_QUERY_PARAM));
    if (fromQuery !== null) {
      return fromQuery;
    }
  } catch {
    // Ignore malformed URL environments.
  }

  try {
    const fromStorage = readTraceFlag(window.localStorage.getItem(SYNC_TRACE_STORAGE_KEY));
    return fromStorage ?? false;
  } catch {
    return false;
  }
}

export function emitSyncTrace(scope: string, event: string, data: Record<string, unknown> = {}): void {
  if (!isSyncTraceEnabled() || typeof window === 'undefined') {
    return;
  }

  const entry: SyncTraceEntry = {
    ts: Date.now(),
    scope,
    event,
    data
  };

  const target = window as Window & { __modularSyncTrace?: SyncTraceEntry[] };
  const traceLog = target.__modularSyncTrace ?? [];
  traceLog.push(entry);
  if (traceLog.length > SYNC_TRACE_LIMIT) {
    traceLog.splice(0, traceLog.length - SYNC_TRACE_LIMIT);
  }
  target.__modularSyncTrace = traceLog;

  window.dispatchEvent(new CustomEvent(SYNC_TRACE_EVENT, { detail: entry }));
  console.debug('[sync-trace]', scope, event, data);
}
