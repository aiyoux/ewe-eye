import { calculateMidOrder } from './order.ts';

export { calculateMidOrder };

let dragState: {
  itemId: string | null;
  edgeId: string | null;
  parentId: string | null;
} = $state({
  itemId: null,
  edgeId: null,
  parentId: null
});

let dropState: {
  targetId: string | null;
  zone: 'before' | 'after' | 'into' | null;
} = $state({
  targetId: null,
  zone: null
});

export function getDragState() {
  return dragState;
}

export function getDropState() {
  return dropState;
}

export function startDrag(itemId: string, edgeId: string | null, parentId: string | null) {
  dragState.itemId = itemId;
  dragState.edgeId = edgeId;
  dragState.parentId = parentId;
}

export function stopDrag() {
  dragState.itemId = null;
  dragState.edgeId = null;
  dragState.parentId = null;
}

export function setDropTarget(targetId: string | null, zone: 'before' | 'after' | 'into' | null) {
  dropState.targetId = targetId;
  dropState.zone = zone;
}

export function clearDropTarget() {
  dropState.targetId = null;
  dropState.zone = null;
}
