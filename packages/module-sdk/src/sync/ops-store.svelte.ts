import { SvelteMap } from 'svelte/reactivity';
import type { Op, OpStatus } from '../cache/types.ts';

/**
 * Reactive, per-namespace store of sync engine ops.
 *
 * The sync engine's oplog in IndexedDB is the durable source of truth; this
 * store is the live projection that UI code reads from. Every lifecycle
 * transition (queue, inflight, accepted, rejected, retry) updates an entry
 * here so the activity panel reflects actual queue state rather than
 * one-shot event notifications.
 */

const stores = new Map<string, SvelteMap<string, Op>>();

function bucketFor(namespace: string): SvelteMap<string, Op> {
  let bucket = stores.get(namespace);
  if (!bucket) {
    bucket = new SvelteMap<string, Op>();
    stores.set(namespace, bucket);
  }
  return bucket;
}

export function setSyncOp(namespace: string, op: Op): void {
  bucketFor(namespace).set(op.id, { ...op, updated: op.updated ?? Date.now() });
}

export function removeSyncOp(namespace: string, id: string): void {
  stores.get(namespace)?.delete(id);
}

export function clearSyncOpsNamespace(namespace: string): void {
  stores.get(namespace)?.clear();
}

export function getSyncOpsStore(namespace: string): SvelteMap<string, Op> {
  return bucketFor(namespace);
}

export function listSyncOps(namespace: string, statuses?: OpStatus[]): Op[] {
  const bucket = stores.get(namespace);
  if (!bucket) return [];
  const values = Array.from(bucket.values());
  const filtered = statuses ? values.filter((op) => statuses.includes(op.status)) : values;
  return filtered.sort((a, b) => (b.updated ?? b.created) - (a.updated ?? a.created));
}

export function listAllSyncOps(): Array<{ namespace: string; op: Op }> {
  const all: Array<{ namespace: string; op: Op }> = [];
  for (const [namespace, bucket] of stores) {
    for (const op of bucket.values()) {
      all.push({ namespace, op });
    }
  }
  return all.sort((a, b) => (b.op.updated ?? b.op.created) - (a.op.updated ?? a.op.created));
}
