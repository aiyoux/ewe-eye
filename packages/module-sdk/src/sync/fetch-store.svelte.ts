import { SvelteMap } from 'svelte/reactivity';

/**
 * Reactive, per-namespace store of in-flight reads (`fetchAndCache` calls).
 *
 * The sync ops store tracks durable write ops; this store is its read-side
 * counterpart. There is no durable log for fetches — they are ephemeral — so
 * this store IS the source of truth for "is anything loading right now". UI
 * loading indicators (top progress strip, per-connection spinners) read from
 * here to distinguish fetch (read) activity from sync (write) activity and to
 * color them differently.
 *
 * Entries are added on entry to `fetchAndCache` and removed on settle
 * (success or failure), keyed by a unique id per call.
 */

export type FetchRecord = {
  /** Unique id for this in-flight fetch (one per fetchAndCache call). */
  id: string;
  /** The LeaderRpcCall type, e.g. `FetchRecordsByDateRange`. */
  type: string;
  /** Epoch ms when the fetch started. */
  startedAt: number;
};

const stores = new Map<string, SvelteMap<string, FetchRecord>>();

function bucketFor(namespace: string): SvelteMap<string, FetchRecord> {
  let bucket = stores.get(namespace);
  if (!bucket) {
    bucket = new SvelteMap<string, FetchRecord>();
    stores.set(namespace, bucket);
  }
  return bucket;
}

export function startFetch(namespace: string, record: FetchRecord): void {
  bucketFor(namespace).set(record.id, record);
}

export function endFetch(namespace: string, id: string): void {
  stores.get(namespace)?.delete(id);
}

export function getFetchStore(namespace: string): SvelteMap<string, FetchRecord> {
  return bucketFor(namespace);
}

export function listActiveFetches(namespace: string): FetchRecord[] {
  const bucket = stores.get(namespace);
  if (!bucket) return [];
  return Array.from(bucket.values()).sort((a, b) => a.startedAt - b.startedAt);
}

/**
 * All active fetches across every namespace (profile). Used by global
 * indicators that must react to loading on any connection.
 */
export function listAllActiveFetches(): Array<{ namespace: string; fetch: FetchRecord }> {
  const all: Array<{ namespace: string; fetch: FetchRecord }> = [];
  for (const [namespace, bucket] of stores) {
    for (const fetch of bucket.values()) {
      all.push({ namespace, fetch });
    }
  }
  return all.sort((a, b) => a.fetch.startedAt - b.fetch.startedAt);
}

/** Total active fetch count across all namespaces. Reactive when read in a $derived. */
export function totalActiveFetchCount(): number {
  let n = 0;
  for (const bucket of stores.values()) n += bucket.size;
  return n;
}