import { describe, it, expect } from 'vitest';
import { collectCloneRegion, collectTemplateCloneVisits, type CloneRegionCache } from './template-clone.ts';

/**
 * Mini cache fixture. Edges are graph_child_of unless edge_id starts with
 * `groups:`. `get_children_for_parent` returns them in insertion order.
 */
function mkCache(
  items: string[],
  edges: Array<{
    parent: string;
    child: string;
    order?: number;
    key_parent?: boolean;
    clone_setting?: any;
    module_data?: Record<string, unknown>;
    groups?: boolean;
  }>
): CloneRegionCache {
  const itemSet = new Set(items);
  const byParent = new Map<string, any[]>();
  for (const e of edges) {
    const arr = byParent.get(e.parent) ?? [];
    arr.push({
      child_id: e.child,
      order: e.order,
      is_key_parent: e.key_parent,
      clone_setting: e.clone_setting ?? null,
      module_data: e.module_data,
      edge_id: `${e.groups ? 'groups' : 'graph_child_of'}:${e.parent}-${e.child}`
    });
    byParent.set(e.parent, arr);
  }
  return {
    getItem: (id) => (itemSet.has(id) ? ({ id } as any) : undefined),
    get_children_for_parent: (id) => byParent.get(id) ?? []
  };
}

describe('collectCloneRegion', () => {
  it('captures region in pre-order with per-edge order/key_parent/cloneSetting', () => {
    const cache = mkCache(
      ['root', 'a', 'b', 'b1'],
      [
        { parent: 'root', child: 'a', order: 0, key_parent: true },
        { parent: 'root', child: 'b', order: 1, key_parent: true },
        {
          parent: 'b',
          child: 'b1',
          order: 5,
          key_parent: false,
          clone_setting: 'link_to_common_clone',
          module_data: { planner: { role: 'task', schedule: 'own_date' } }
        }
      ]
    );
    const r = collectCloneRegion(cache, { seedIds: ['root'] });

    expect(r.nodes.map((n) => n.sourceId)).toEqual(['root', 'a', 'b', 'b1']); // parent-before-child
    expect(r.nodes.find((n) => n.sourceId === 'b1')!.parentSourceId).toBe('b');

    const b1 = r.internalEdges.find((e) => e.childSourceId === 'b1')!;
    expect(b1).toMatchObject({
      parentSourceId: 'b',
      order: 5,
      keyParent: false,
      cloneSetting: 'link_to_common_clone',
      moduleData: { planner: { role: 'task', schedule: 'own_date' } }
    });
    const a = r.internalEdges.find((e) => e.childSourceId === 'a')!;
    expect(a).toMatchObject({ order: 0, keyParent: true, cloneSetting: null });
    expect(r.linkOriginal).toEqual([]);
  });

  it('defaults absent key_parent to true (the single canonical rule)', () => {
    const cache = mkCache(['p', 'c'], [{ parent: 'p', child: 'c' }]); // is_key_parent undefined
    const r = collectCloneRegion(cache, { seedIds: ['p'] });
    expect(r.internalEdges.find((e) => e.childSourceId === 'c')!.keyParent).toBe(true);
  });

  it('honours per-edge link_to_original: original child NOT cloned, link recorded', () => {
    const cache = mkCache(
      ['root', 'kept', 'ext', 'extChild'],
      [
        { parent: 'root', child: 'kept', order: 0 },
        { parent: 'root', child: 'ext', order: 1, key_parent: false, clone_setting: 'link_to_original' },
        { parent: 'ext', child: 'extChild' }
      ]
    );
    const r = collectCloneRegion(cache, { seedIds: ['root'], honorEdgeCloneSetting: true });

    expect(r.nodes.map((n) => n.sourceId).sort()).toEqual(['kept', 'root']); // ext + subtree NOT cloned
    expect(r.internalEdges.some((e) => e.childSourceId === 'ext')).toBe(false);
    expect(r.linkOriginal).toEqual([
      { childOriginalId: 'ext', parentSourceId: 'root', order: 1, keyParent: false }
    ]);
  });

  it('linkAllChildrenOfSeeds: clone only seeds, link their original children', () => {
    const cache = mkCache(
      ['s1', 's2', 'c1', 'c2'],
      [
        { parent: 's1', child: 'c1', order: 2 },
        { parent: 's2', child: 'c2', order: 0 }
      ]
    );
    const r = collectCloneRegion(cache, { seedIds: ['s1', 's2'], linkAllChildrenOfSeeds: true });
    expect(r.nodes.map((n) => n.sourceId).sort()).toEqual(['s1', 's2']);
    expect(r.internalEdges).toEqual([]);
    expect(r.linkOriginal.map((l) => l.childOriginalId).sort()).toEqual(['c1', 'c2']);
    expect(r.linkOriginal.find((l) => l.childOriginalId === 'c1')).toMatchObject({ parentSourceId: 's1', order: 2 });
  });

  it('NEVER traverses or emits groups: edges (tree edges only — server parity)', () => {
    const cache = mkCache(
      ['root', 'child', 'member'],
      [
        { parent: 'root', child: 'child', order: 0 },
        { parent: 'root', child: 'member', groups: true } // root is also a group
      ]
    );
    const r = collectCloneRegion(cache, { seedIds: ['root'] });
    expect(r.nodes.map((n) => n.sourceId).sort()).toEqual(['child', 'root']); // 'member' NOT pulled in
    expect(r.internalEdges.some((e) => e.childSourceId === 'member')).toBe(false);
  });

  it('multi-parent DAG region preserves every internal edge', () => {
    // shared 'leaf' under both seeds (includeRoot=false style: two seeds).
    const cache = mkCache(
      ['s1', 's2', 'leaf'],
      [
        { parent: 's1', child: 'leaf', order: 0, key_parent: true },
        { parent: 's2', child: 'leaf', order: 9, key_parent: false }
      ]
    );
    const r = collectCloneRegion(cache, { seedIds: ['s1', 's2'] });
    expect(r.nodes.map((n) => n.sourceId).sort()).toEqual(['leaf', 's1', 's2']);
    const leafEdges = r.internalEdges.filter((e) => e.childSourceId === 'leaf');
    expect(leafEdges).toHaveLength(2); // both parent edges preserved
    expect(leafEdges.find((e) => e.parentSourceId === 's2')).toMatchObject({ order: 9, keyParent: false });
  });
});

describe('collectTemplateCloneVisits', () => {
  it('attaches source items and incoming edge metadata in traversal order', () => {
    const cache = mkCache(
      ['root', 'a', 'b'],
      [
        { parent: 'root', child: 'a', order: 2, key_parent: false },
        { parent: 'root', child: 'b', order: 3, clone_setting: 'link_to_common_clone' }
      ]
    );

    const result = collectTemplateCloneVisits(cache, 'root');

    expect(result.ordered.map((entry) => entry.item.id)).toEqual(['root', 'a', 'b']);
    expect(result.ordered[0]).toMatchObject({ parentInTree: null, order: 0, keyParent: true, cloneSetting: null });
    expect(result.ordered[1]).toMatchObject({ parentInTree: 'root', order: 2, keyParent: false, cloneSetting: null });
    expect(result.ordered[2]).toMatchObject({ parentInTree: 'root', order: 3, keyParent: true, cloneSetting: 'link_to_common_clone' });
    expect(result.linkOriginal).toEqual([]);
  });

  it('returns link_to_original relationships when requested', () => {
    const cache = mkCache(
      ['root', 'clone', 'linked'],
      [
        { parent: 'root', child: 'clone', order: 0 },
        {
          parent: 'root',
          child: 'linked',
          order: 9,
          key_parent: false,
          clone_setting: 'link_to_original',
          module_data: { planner: { role: 'task', schedule: 'inherit_parent' } }
        }
      ]
    );

    const result = collectTemplateCloneVisits(cache, 'root', { honorEdgeCloneSetting: true });

    expect(result.ordered.map((entry) => entry.item.id)).toEqual(['root', 'clone']);
    expect(result.linkOriginal).toEqual([
      {
        childOriginalId: 'linked',
        parentInTree: 'root',
        order: 9,
        keyParent: false,
        moduleData: { planner: { role: 'task', schedule: 'inherit_parent' } }
      }
    ]);
  });
});
