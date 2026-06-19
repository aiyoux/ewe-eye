import type { AppCache } from './store.svelte.ts';
import {
  cleanupOldOps,
  loadAllItems,
  loadAllChildEdges,
  loadAllAppliesEdges,
  loadAllScopeDays,
  loadAllMeta,
  persistItems,
  persistChildEdges,
  persistAppliesEdges,
  deleteItem,
  deleteChildEdge,
  deleteAppliesEdge,
  persistScopeDay,
  setMeta,
  deleteMeta,
  clearAllCache
} from './persist.ts';
import type { CacheItem, CacheMutationEvent, ChildEdge, AppliesEdge } from './types.ts';

import type { EntityMeta } from './types.ts';

/**
 * Hydrates the in-memory Svelte cache from the IndexedDB snapshot
 * for the given namespace.
 */
export async function hydrateCache(cache: AppCache, namespace: string): Promise<void> {
  // Clear any existing in-memory state
  cache.clear();

  // Run initial cleanup tasks (like dropping old sync ops)
  await cleanupOldOps(namespace).catch(e => console.error('Failed to cleanup old ops:', e));

  // Load state from IndexedDB
  const [items, edges, appliesEdges, scopes, metas] = await Promise.all([
    loadAllItems(namespace),
    loadAllChildEdges(namespace),
    loadAllAppliesEdges(namespace),
    loadAllScopeDays(namespace),
    loadAllMeta(namespace)
  ]);

  // We manually populate the cache so everything is ready
  // before the persistence watcher is attached.
  cache.batch_upsert(items);

  for (const edge of edges) {
    cache.upsert_graph_child_of_edge(
      edge.edge_id,
      edge.child_id,
      edge.parent_id,
      edge.order,
      edge.is_key_parent,
      edge.module_data,
      edge.clone_setting
    );
  }

  for (const edge of appliesEdges) {
    cache.upsert_applies_edge(
      edge.edge_id,
      edge.src_id,
      edge.dst_id,
      edge.module_data
    );
  }

  for (const scope of scopes) {
    cache.hydrate_scope_day(scope.scope, scope.bucket, scope.item_ids);
  }

  for (const meta of metas) {
    cache.hydrate_meta(meta.key, meta.value as EntityMeta);
  }
}

/**
 * Binds the AppCache mutation emitter to the IndexedDB persistence layer.
 *
 * Cache events from a single mutation pass (e.g. a snapshot reconcile that
 * upserts hundreds of records) are coalesced into per-microtask batches and
 * flushed as a small number of bulk IDB transactions instead of one
 * transaction per event. A `pagehide` listener also flushes any pending
 * batch synchronously-as-possible so writes aren't lost on tab close.
 *
 * Returns an unsubscribe function to detach the listener.
 */
export function createCachePersistence(cache: AppCache, namespace: string): () => void {
  type Pending = {
    itemUpserts: Map<string, CacheItem>;
    itemDeletes: Set<string>;
    childEdgeUpserts: Map<string, ChildEdge>;
    childEdgeDeletes: Set<string>;
    appliesUpserts: Map<string, AppliesEdge>;
    appliesDeletes: Set<string>;
    scopeDayUpserts: Map<string, { scope: string; bucket: string; itemIds: string[] }>;
    metaSets: Map<string, EntityMeta>;
    metaDeletes: Set<string>;
    clearAll: boolean;
  };

  function emptyPending(): Pending {
    return {
      itemUpserts: new Map(),
      itemDeletes: new Set(),
      childEdgeUpserts: new Map(),
      childEdgeDeletes: new Set(),
      appliesUpserts: new Map(),
      appliesDeletes: new Set(),
      scopeDayUpserts: new Map(),
      metaSets: new Map(),
      metaDeletes: new Set(),
      clearAll: false
    };
  }

  let pending: Pending = emptyPending();
  let flushScheduled = false;
  let unsubscribed = false;

  function scheduleFlush() {
    if (flushScheduled || unsubscribed) return;
    flushScheduled = true;
    queueMicrotask(() => {
      flushScheduled = false;
      void flush();
    });
  }

  async function flush(): Promise<void> {
    if (
      !pending.clearAll &&
      pending.itemUpserts.size === 0 &&
      pending.itemDeletes.size === 0 &&
      pending.childEdgeUpserts.size === 0 &&
      pending.childEdgeDeletes.size === 0 &&
      pending.appliesUpserts.size === 0 &&
      pending.appliesDeletes.size === 0 &&
      pending.scopeDayUpserts.size === 0 &&
      pending.metaSets.size === 0 &&
      pending.metaDeletes.size === 0
    ) {
      return;
    }

    const batch = pending;
    pending = emptyPending();

    try {
      // A `Clear` supersedes everything else queued before it.
      if (batch.clearAll) {
        await clearAllCache(namespace);
        return;
      }

      const tasks: Promise<unknown>[] = [];

      if (batch.itemUpserts.size > 0) {
        tasks.push(persistItems(namespace, [...batch.itemUpserts.values()]));
      }
      for (const id of batch.itemDeletes) {
        tasks.push(deleteItem(namespace, id));
      }

      if (batch.childEdgeUpserts.size > 0) {
        tasks.push(persistChildEdges(namespace, [...batch.childEdgeUpserts.values()]));
      }
      for (const edgeId of batch.childEdgeDeletes) {
        tasks.push(deleteChildEdge(namespace, edgeId));
      }

      if (batch.appliesUpserts.size > 0) {
        tasks.push(persistAppliesEdges(namespace, [...batch.appliesUpserts.values()]));
      }
      for (const edgeId of batch.appliesDeletes) {
        tasks.push(deleteAppliesEdge(namespace, edgeId));
      }

      for (const { scope, bucket, itemIds } of batch.scopeDayUpserts.values()) {
        tasks.push(persistScopeDay(namespace, scope, bucket, itemIds));
      }

      for (const [id, meta] of batch.metaSets.entries()) {
        tasks.push(setMeta(namespace, id, meta));
      }
      for (const id of batch.metaDeletes) {
        tasks.push(deleteMeta(namespace, id));
      }

      await Promise.all(tasks);
    } catch (e) {
      console.error('cache persistence flush failed', e);
    }
  }

  const unsub = cache.subscribe((event: CacheMutationEvent) => {
    switch (event.type) {
      case 'ItemUpsert':
        pending.itemUpserts.set(event.item.id, event.item);
        pending.itemDeletes.delete(event.item.id);
        break;
      case 'ItemDelete':
        pending.itemDeletes.add(event.id);
        pending.itemUpserts.delete(event.id);
        pending.metaDeletes.add(event.id);
        pending.metaSets.delete(event.id);
        break;
      case 'EdgeUpsert':
        pending.childEdgeUpserts.set(event.edge.edge_id, event.edge);
        pending.childEdgeDeletes.delete(event.edge.edge_id);
        break;
      case 'EdgeDelete':
        pending.childEdgeDeletes.add(event.edgeId);
        pending.childEdgeUpserts.delete(event.edgeId);
        break;
      case 'AppliesUpsert':
        pending.appliesUpserts.set(event.edge.edge_id, event.edge);
        pending.appliesDeletes.delete(event.edge.edge_id);
        break;
      case 'AppliesDelete':
        pending.appliesDeletes.add(event.edgeId);
        pending.appliesUpserts.delete(event.edgeId);
        break;
      case 'ScopeDayUpsert': {
        const key = `${event.scope}:${event.bucket}`;
        pending.scopeDayUpserts.set(key, {
          scope: event.scope,
          bucket: event.bucket,
          itemIds: event.itemIds
        });
        break;
      }
      case 'RecordSyncStatus': {
        const meta = cache.itemMeta.get(event.id);
        if (meta) {
          pending.metaSets.set(event.id, meta);
          pending.metaDeletes.delete(event.id);
        } else {
          pending.metaDeletes.add(event.id);
          pending.metaSets.delete(event.id);
        }
        break;
      }
      case 'TempIdRemap': {
        // Drop the temp row outright; persist the real row + meta.
        pending.itemDeletes.add(event.tempId);
        pending.metaDeletes.add(event.tempId);
        pending.itemUpserts.delete(event.tempId);
        pending.metaSets.delete(event.tempId);

        const realItem = cache.getItem(event.realId);
        if (realItem) {
          pending.itemUpserts.set(event.realId, realItem);
          pending.itemDeletes.delete(event.realId);
        }
        const realMeta = cache.itemMeta.get(event.realId);
        if (realMeta) {
          pending.metaSets.set(event.realId, realMeta);
          pending.metaDeletes.delete(event.realId);
        } else {
          pending.metaDeletes.add(event.realId);
          pending.metaSets.delete(event.realId);
        }
        break;
      }
      case 'Clear':
        pending = emptyPending();
        pending.clearAll = true;
        break;
    }
    scheduleFlush();
  });

  // Best-effort flush on tab close. We can't await async work in pagehide,
  // but kicking the queued microtask immediately gives the browser the best
  // chance to commit the in-flight IDB transaction before tearing down.
  function handlePageHide() {
    void flush();
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);
  }

  return () => {
    unsubscribed = true;
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
    }
    // Final flush so unsubscribing doesn't strand pending writes.
    void flush();
    unsub();
  };
}
