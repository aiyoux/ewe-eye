import type { AppRuntime, CloneSetting } from '@modular-app/module-sdk';

export type RecordTreeMovePayload = {
  edgeId: string;
  itemId: string;
  newParentId: string;
  newOrder: number;
  oldEdge: {
    edge_id: string;
    parent_id: string;
    is_key_parent: boolean;
    module_data?: unknown;
    clone_setting?: unknown;
  };
};

export type RecordTreeMoveResult = {
  movedAcrossParents: boolean;
  oldParentId: string | null;
  newEdgeId: string;
  removedEdgeIds: string[];
};

function isGraphChildEdge(edgeId: string): boolean {
  return edgeId.startsWith('graph_child_of:');
}

function edgeModuleData(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object'
    ? value as Record<string, unknown>
    : undefined;
}

function edgeCloneSetting(value: unknown): CloneSetting | null {
  return value === 'default' ||
    value === 'link_to_common_clone' ||
    value === 'link_to_original'
    ? value
    : null;
}

export function applyRecordTreeMove(
  runtime: AppRuntime,
  payload: RecordTreeMovePayload
): RecordTreeMoveResult {
  const cache = runtime.cache;
  const childId = String(payload.itemId);
  const currentEdge =
    cache.childrenEdges.get(payload.edgeId) ??
    cache.childrenEdges.get(payload.oldEdge.edge_id);
  const sourceEdgeId = currentEdge?.edge_id ?? payload.oldEdge.edge_id;
  const oldParentId = currentEdge?.parent_id ?? payload.oldEdge.parent_id ?? null;
  const isKeyParent = currentEdge?.is_key_parent ?? payload.oldEdge.is_key_parent;
  const moduleData = edgeModuleData(currentEdge?.module_data ?? payload.oldEdge.module_data);
  const cloneSetting = edgeCloneSetting(currentEdge?.clone_setting ?? payload.oldEdge.clone_setting);

  if (oldParentId === payload.newParentId) {
    cache.remove_graph_child(sourceEdgeId);
    cache.upsert_graph_child_of_edge(
      sourceEdgeId,
      childId,
      payload.newParentId,
      payload.newOrder,
      isKeyParent,
      moduleData,
      cloneSetting
    );
    if (isGraphChildEdge(sourceEdgeId)) {
      runtime.queueAndWake('MoveChild', {
        id: sourceEdgeId,
        out: payload.newParentId,
        order: payload.newOrder
      });
    } else {
      runtime.queueAndWake('AddChild', {
        id: sourceEdgeId,
        parent: payload.newParentId,
        child: childId,
        order: payload.newOrder,
        key_parent: isKeyParent,
        ...(moduleData ? { module_data: moduleData } : {}),
        ...(cloneSetting ? { clone_setting: cloneSetting } : {})
      });
    }
    return {
      movedAcrossParents: false,
      oldParentId,
      newEdgeId: sourceEdgeId,
      removedEdgeIds: []
    };
  }

  const edgesToRemove = new Set<string>();
  if (sourceEdgeId) edgesToRemove.add(sourceEdgeId);
  if (oldParentId) {
    for (const edge of cache.get_parents_for_child(childId)) {
      if (edge.parent_id === oldParentId) edgesToRemove.add(edge.edge_id);
    }
  }

  const removedEdgeIds: string[] = [];
  for (const edgeId of edgesToRemove) {
    cache.remove_graph_child(edgeId);
    removedEdgeIds.push(edgeId);
    if (isGraphChildEdge(edgeId)) {
      runtime.queueAndWake('RemoveChild', { id: edgeId });
    }
  }

  const tempEdgeId = `temp-edge:${crypto.randomUUID()}`;
  cache.upsert_graph_child_of_edge(
    tempEdgeId,
    childId,
    payload.newParentId,
    payload.newOrder,
    isKeyParent,
    moduleData,
    cloneSetting
  );
  runtime.queueAndWake('AddChild', {
    id: tempEdgeId,
    parent: payload.newParentId,
    child: childId,
    order: payload.newOrder,
    key_parent: isKeyParent,
    ...(moduleData ? { module_data: moduleData } : {}),
    ...(cloneSetting ? { clone_setting: cloneSetting } : {})
  });

  return {
    movedAcrossParents: true,
    oldParentId,
    newEdgeId: tempEdgeId,
    removedEdgeIds
  };
}
