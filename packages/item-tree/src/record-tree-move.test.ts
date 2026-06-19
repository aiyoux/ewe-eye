import { describe, expect, it, vi } from 'vitest';
import { createAppCache } from '@modular-app/module-sdk';
import { applyRecordTreeMove } from './record-tree-move.ts';

function makeRuntime() {
  return {
    cache: createAppCache(),
    queueAndWake: vi.fn()
  } as any;
}

describe('applyRecordTreeMove', () => {
  it('keeps same-parent reorder as a MoveChild on the existing edge', () => {
    const runtime = makeRuntime();
    runtime.cache.upsert_graph_child_of_edge(
      'graph_child_of:edge-1',
      'records:child',
      'records:parent',
      10,
      true
    );

    const result = applyRecordTreeMove(runtime, {
      edgeId: 'graph_child_of:edge-1',
      itemId: 'records:child',
      newParentId: 'records:parent',
      newOrder: 20,
      oldEdge: {
        edge_id: 'graph_child_of:edge-1',
        parent_id: 'records:parent',
        is_key_parent: true
      }
    });

    expect(result.movedAcrossParents).toBe(false);
    expect(runtime.cache.childrenEdges.get('graph_child_of:edge-1')).toMatchObject({
      child_id: 'records:child',
      parent_id: 'records:parent',
      order: 20
    });
    expect(runtime.queueAndWake).toHaveBeenCalledTimes(1);
    expect(runtime.queueAndWake).toHaveBeenCalledWith('MoveChild', {
      id: 'graph_child_of:edge-1',
      out: 'records:parent',
      order: 20
    });
  });

  it('moves across parents by removing the old edge and adding a new optimistic edge', () => {
    const runtime = makeRuntime();
    runtime.cache.upsert_graph_child_of_edge(
      'graph_child_of:edge-1',
      'records:child',
      'records:old-parent',
      10,
      true,
      { planner: { role: 'task' } }
    );

    const result = applyRecordTreeMove(runtime, {
      edgeId: 'graph_child_of:edge-1',
      itemId: 'records:child',
      newParentId: 'records:new-parent',
      newOrder: 5,
      oldEdge: {
        edge_id: 'graph_child_of:edge-1',
        parent_id: 'records:old-parent',
        is_key_parent: true,
        module_data: { planner: { role: 'task' } }
      }
    });

    expect(result.movedAcrossParents).toBe(true);
    expect(runtime.cache.childrenEdges.get('graph_child_of:edge-1')).toBeUndefined();
    const newEdge = runtime.cache.childrenEdges.get(result.newEdgeId);
    expect(result.newEdgeId.startsWith('temp-edge:')).toBe(true);
    expect(newEdge).toMatchObject({
      child_id: 'records:child',
      parent_id: 'records:new-parent',
      order: 5,
      is_key_parent: true,
      module_data: { planner: { role: 'task' } }
    });
    expect(runtime.queueAndWake).toHaveBeenNthCalledWith(1, 'RemoveChild', {
      id: 'graph_child_of:edge-1'
    });
    expect(runtime.queueAndWake).toHaveBeenNthCalledWith(2, 'AddChild', {
      id: result.newEdgeId,
      parent: 'records:new-parent',
      child: 'records:child',
      order: 5,
      key_parent: true,
      module_data: { planner: { role: 'task' } }
    });
  });
});
