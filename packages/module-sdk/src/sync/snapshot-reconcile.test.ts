import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppCache } from '../cache/store.svelte.ts';
import { createSyncEngine } from './engine.ts';
import { applyRecordSnapshot } from './runtime.ts';

/**
 * Regression guards for the fe8eafe "snapshot eviction fix" follow-on bug.
 *
 * `applyRecordSnapshot` runs the namespace-scope coarse snapshot
 * (`SELECT * FROM records`) as a catch-up `RecordBatchUpsert`. The old code
 * ALSO emitted a `RecordBatchDelete` for every cached id absent from that
 * coarse set. Under record-auth the coarse select is permission-narrowed — it
 * returns FEWER rows than the view-specific queries that populate the cache —
 * so "absent from snapshot" ≠ "deleted". Evicting on absence silently dropped
 * cached-but-off-screen records (a month you swiped away from) with no refetch
 * to recover them: events that "don't come back until a manual refresh".
 *
 * These tests lock the no-eviction contract: a coarse snapshot missing cached
 * records must NOT remove them, and the snapshot must never take a delete
 * path. Uses the real cache + real engine so the assertion exercises the actual
 * `applyRemote` → `batch_upsert`/`batch_delete` routing.
 */

const persistMocks = vi.hoisted(() => ({
  persistOp: vi.fn(),
  deleteOp: vi.fn(),
  updateOpStatus: vi.fn(),
  getPendingOps: vi.fn(),
  getAllOps: vi.fn()
}));

vi.mock('../cache/persist', () => ({
  persistOp: persistMocks.persistOp,
  deleteOp: persistMocks.deleteOp,
  updateOpStatus: persistMocks.updateOpStatus,
  getPendingOps: persistMocks.getPendingOps,
  getAllOps: persistMocks.getAllOps
}));

function createBusStub() {
  return {
    onMessage: vi.fn(() => () => {}),
    broadcast: vi.fn(),
    rpc: vi.fn()
  };
}

function createEngine(cache: ReturnType<typeof createAppCache>) {
  return createSyncEngine(cache as any, createBusStub() as any, {
    url: 'http://127.0.0.1:8000',
    namespace: 'db',
    storageNamespace: 'test-snapshot-reconcile',
    database: 'db',
    token: 'token',
    scopes: []
  });
}

describe('applyRecordSnapshot — no-eviction contract (fe8eafe regression)', () => {
  beforeEach(() => {
    persistMocks.getPendingOps.mockResolvedValue([]);
    persistMocks.getAllOps.mockResolvedValue([]);
    persistMocks.persistOp.mockResolvedValue(undefined);
    persistMocks.deleteOp.mockResolvedValue(undefined);
    persistMocks.updateOpStatus.mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does NOT evict cached-but-off-screen records absent from the coarse snapshot', () => {
    const cache = createAppCache();
    const engine = createEngine(cache);

    // Seed: a "visible" record (placed in an active scope slice) and an
    // "off-screen" record (cached only — e.g. a month you swiped away from —
    // not referenced by any active scope slice).
    cache.normalizeItem({ id: 'records:visible', text: 'V', is_temp: false, dirty: false, sync_status: 'accepted' });
    cache.normalizeItem({ id: 'records:offscreen', text: 'O', is_temp: false, dirty: false, sync_status: 'accepted' });
    cache.record_scope_bucket_items('work', '2026-07-05', ['records:visible']);

    const batchDeleteSpy = vi.spyOn(cache, 'batch_delete');
    const removeItemSpy = vi.spyOn(cache, 'removeItem');

    // Coarse snapshot includes only the visible record — the off-screen one is
    // absent, exactly as a permission-narrowed `SELECT * FROM records` would be.
    const fetched = applyRecordSnapshot(engine, [{ id: 'records:visible', text: 'V' }]);

    expect([...fetched]).toEqual(['records:visible']);

    // Both records remain cached — the off-screen one is NOT evicted.
    const ids = cache.getAllItems().map((i) => i.id);
    expect(ids).toContain('records:visible');
    expect(ids).toContain('records:offscreen');

    // No delete path was taken from the snapshot.
    expect(batchDeleteSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();

    cache.clear();
  });

  it('upserts every record present in the coarse snapshot (catch-up still works)', () => {
    const cache = createAppCache();
    const engine = createEngine(cache);

    applyRecordSnapshot(engine, [
      { id: 'records:a', text: 'A', is_temp: false, dirty: false, sync_status: 'accepted' },
      { id: 'records:b', text: 'B', is_temp: false, dirty: false, sync_status: 'accepted' }
    ]);

    const ids = cache.getAllItems().map((i) => i.id).sort();
    expect(ids).toEqual(['records:a', 'records:b']);
    cache.clear();
  });

  it('stringifies numeric ids and drops rows with null/missing ids', () => {
    const cache = createAppCache();
    const engine = createEngine(cache);

    const fetched = applyRecordSnapshot(engine, [
      { id: 'records:keep', text: 'K', is_temp: false, dirty: false, sync_status: 'accepted' },
      { id: null },
      { noId: true },
      { id: 123 }
    ]);

    // Numeric id is stringified (numbers have .toString); null/missing ids
    // are dropped before the upsert reaches the cache.
    expect([...fetched]).toEqual(['records:keep', '123']);
    expect(cache.getAllItems().map((i) => i.id).sort()).toEqual(['123', 'records:keep']);
    cache.clear();
  });
});