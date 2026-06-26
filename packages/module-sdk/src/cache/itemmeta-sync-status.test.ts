import { describe, it, expect } from 'vitest';
import { createAppCache } from './store.svelte.ts';

/**
 * Guards the regression trap documented in the user's memory note
 * (itemmeta-sync-status-not-pending-for-updates): `itemMeta.sync_status` goes
 * `pending` ONLY for optimistic temp creates — never for updates to an existing
 * committed record. Per-item optimistic indicators must therefore read the
 * reactive op store, NOT this flag. If a future change flips sync_status to
 * pending on update, real records would falsely render as "pending" forever.
 */
describe('itemMeta.sync_status pending-only-for-temp-creates', () => {
  it('temp create marks the item pending', () => {
    const cache = createAppCache();
    cache.normalizeItem({ id: 'temp:new1', text: 'Optimistic', is_temp: true, dirty: false, sync_status: 'accepted' });
    expect(cache.itemMeta.get('temp:new1')?.sync_status).toBe('pending');
    cache.clear();
  });

  it('updating an existing committed record does NOT flip sync_status to pending', () => {
    const cache = createAppCache();
    // Seed a committed (non-temp) record.
    cache.normalizeItem({ id: 'records:e1', text: 'V1', is_temp: false, dirty: false, sync_status: 'accepted' });
    expect(cache.itemMeta.get('records:e1')?.sync_status).not.toBe('pending');

    // Update it (still non-temp).
    cache.normalizeItem({ id: 'records:e1', text: 'V2', is_temp: false, dirty: false, sync_status: 'accepted' });
    expect(cache.itemMeta.get('records:e1')?.sync_status).not.toBe('pending');
    cache.clear();
  });
});
