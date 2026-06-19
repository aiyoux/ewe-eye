<script lang="ts">
  import { sanitizeSvg, PartialReference, Badge } from "@modular-app/ui";
  import {
    type AppRuntime,
    type Item,
    isProgressAdditional,
    getProgressAdditionalData,
    patchProgressAdditional,
    readProgressAdditional
  } from '@modular-app/module-sdk';
  import RecordTreeView from './RecordTreeView.svelte';
  import TreeAdditionals from './TreeAdditionals.svelte';
  import {
    startDrag,
    stopDrag,
    getDragState,
    getDropState,
    setDropTarget,
    clearDropTarget,
    calculateMidOrder
  } from './tree-dnd.svelte.ts';
  import {
    applyRecordTreeMove,
    type RecordTreeMovePayload
  } from './record-tree-move.ts';

  type RowClickBehavior = 'select' | 'toggle-or-select';

  export interface TreeCustomRowProps {
    item: Item;
    level: number;
    isExpanded: boolean;
    hasChildren: boolean;
    toggleExpand: (e: MouseEvent) => void;
    isSelected: boolean;
    dragOverZone: 'before' | 'after' | 'into' | null;
  }

  let {
    id,
    runtime,
    level = 0,
    seen = new Set<string>(),
    parentId = null,
    edgeId = null,
    order = 0,
    selectedId = null,
    draggable = false,
    editable = false,
    showAdditionals = true,
    showGraphParents = false,
    showGroupingParents = false,
    showActions = false,
    hydrateRoot = true,
    badgePlacement = 'inline',
    labelLines = 1,
    compact = false,
    rowClickBehavior = 'select',
    editTrigger = 'double-click',
    badgeForItem = null,
    linkHref = (itemId: string) => `/records/${itemId.replace(/^records:/, '')}`,
    onSelect = null,
    onAddChild = null,
    onCreateInlineChild = null,
    inlineChildPlaceholder = 'New item...',
    onOpenSettings = null,
    onRemove = null,
    onRequestDelete = null,
    onDelete = null,
    onRename = null,
    onMove = null,
    defaultExpanded = undefined,
    customRow = undefined,
    unstyledWrapper = false
  }: {
    id: string;
    runtime: AppRuntime | null | undefined;
    level?: number;
    seen?: Set<string>;
    parentId?: string | null;
    edgeId?: string | null;
    order?: number;
    selectedId?: string | null;
    draggable?: boolean;
    editable?: boolean;
    showAdditionals?: boolean;
    showGraphParents?: boolean;
    showGroupingParents?: boolean;
    showActions?: boolean;
    hydrateRoot?: boolean;
    badgePlacement?: 'inline' | 'below-label';
    labelLines?: 1 | 2;
    /**
     * When true, render the tree in a more compact style: smaller label
     * text and tighter row padding. Useful for side-panel tree views where
     * vertical space is at a premium.
     */
    compact?: boolean;
    rowClickBehavior?: RowClickBehavior;
    editTrigger?: 'click' | 'double-click';
    badgeForItem?: ((item: Item) => { label: string; tone?: 'neutral' | 'accent' | 'primary' } | null) | null;
    /** Return the href for a node, or null to suppress link rendering */
    linkHref?: ((id: string) => string | null) | null;
    onSelect?: ((id: string) => void) | null;
    onAddChild?: ((parentId: string) => void) | null;
    onCreateInlineChild?: ((payload: { parentId: string; text: string }) => void) | null;
    inlineChildPlaceholder?: string;
    onOpenSettings?: ((id: string) => void) | null;
    onRemove?: ((payload: { id: string; parentId: string | null; edgeId: string | null }) => void) | null;
    onRequestDelete?: ((payload: { id: string; text: string }) => void) | null;
    onDelete?: ((id: string) => void) | null;
    /**
     * Optional interceptor for inline text rename. When provided the tree
     * delegates the mutation + queue to the caller (letting them route it
     * through an operation pipeline). When omitted, the tree falls back to
     * patching the cache and queuing `UpdateRecord` directly.
     */
    onRename?: ((payload: { id: string; text: string }) => void) | null;
    /**
     * Optional interceptor for drag-reorder. When provided the tree
     * delegates the mutation + queue to the caller. When omitted, the tree
     * applies the shared record-tree move behavior.
     */
    onMove?: ((payload: RecordTreeMovePayload) => void) | null;
    /** Defaults to true at level 0, false otherwise */
    defaultExpanded?: boolean;
    /**
     * Allows consumers to provide a completely custom UI for the row while
     * keeping the tree drag-and-drop and recursion mechanics.
     */
    customRow?: import('svelte').Snippet<[TreeCustomRowProps]>;
    /**
     * If true, removes flex, padding, and default background classes from the row wrapper
     * so that the customRow can dictate layout (e.g. using CSS Grid).
     */
    unstyledWrapper?: boolean;
  } = $props();

  let item = $derived(runtime?.cache.getItem(id) as Item | undefined ?? null);
  let childrenEdges = $derived(runtime?.cache.get_children_for_parent(id) ?? []);
  let hasChildren = $derived(childrenEdges.length > 0);
  let isSelected = $derived(selectedId === id);
  let itemBadge = $derived(item && badgeForItem ? badgeForItem(item) : null);
  let rowRef = $state<HTMLElement | null>(null);
  let progressAdditional = $derived(
    item ? (item.additionals ?? []).find((additional) => isProgressAdditional(additional)) ?? null : null
  );
  let progressData = $derived(progressAdditional ? getProgressAdditionalData(progressAdditional) : null);
  // Full shape (kind + computed flag) so the row can render a non-editable
  // pill for server-computed progresses and a clickable checkbox otherwise.
  let progressShape = $derived(progressAdditional ? readProgressAdditional(progressAdditional) : null);
  let progressIsComplete = $derived.by(() => {
    if (!progressShape) return false;
    if (progressShape.kind === 'check') return progressShape.value === 'True';
    return typeof progressShape.value === 'number' && progressShape.value >= 100;
  });

  let allParentEdges = $derived(runtime?.cache.get_parents_for_child(id) ?? []);
  let graphParentEdges = $derived(
    allParentEdges.filter((e) => !e.edge_id.startsWith('groups:') && e.parent_id !== parentId)
  );
  let graphParentItems = $derived(
    graphParentEdges
      .map((e) => runtime?.cache.getItem(e.parent_id) as Item | undefined)
      .filter((p): p is Item => !!p)
  );
  let groupingParentEdges = $derived(
    allParentEdges.filter((e) => e.edge_id.startsWith('groups:'))
  );
  let groupingParentItems = $derived(
    groupingParentEdges
      .map((e) => runtime?.cache.getItem(e.parent_id) as Item | undefined)
      .filter((p): p is Item => !!p)
  );

  let isExpanded = $state(false);
  let didInitExpand = $state(false);
  let isEditing = $state(false);
  let editValue = $state('');
  let isAddingInlineChild = $state(false);
  let inlineChildValue = $state('');
  let treeLoadSeq = 0;

  function subtreeContainsSelected(currentId: string, targetId: string, visited = new Set<string>()): boolean {
    if (!runtime) return false;
    if (currentId === targetId) return true;
    if (visited.has(currentId)) return false;
    visited.add(currentId);

    const children = runtime.cache.get_children_for_parent(currentId);
    for (const edge of children) {
      if (edge.child_id === targetId) return true;
      if (subtreeContainsSelected(edge.child_id, targetId, visited)) return true;
    }
    return false;
  }

  let hasSelectedDescendant = $derived.by(() => {
    if (!selectedId || selectedId === id || !runtime) return false;
    return subtreeContainsSelected(id, selectedId);
  });

  const refPattern = /^reference:(records:[^#]+)#(.+)$/;
  let refMatch = $derived(item?.text ? item.text.match(refPattern) : null);

  let isRichTextActive = $derived.by(() => {
    if (!item || !runtime) return false;
    if (item.markup && item.markup.trim().length > 0) return true;
    const cache = runtime.cache;
    const visited = new Set<string>();
    function checkParents(currId: string): boolean {
      if (visited.has(currId)) return false;
      visited.add(currId);
      const parents = cache.get_parents_for_child(currId) ?? [];
      for (const edge of parents) {
        const parentItem = cache.getItem(edge.parent_id);
        if (parentItem) {
          if (parentItem.markup && parentItem.markup.trim().length > 0) {
            return true;
          }
          if (checkParents(edge.parent_id)) {
            return true;
          }
        }
      }
      return false;
    }
    return checkParents(id);
  });

  function labelClasses(isHeader: boolean): string {
    const sizeClass = compact ? 'text-[var(--tree-font-size-compact)]' : 'text-[var(--tree-font-size-normal)]';
    // Strikethrough is automated when the item's progress reads as complete,
    // so server-computed parents and user-checked items both get a clear
    // "done" treatment without anyone toggling it explicitly.
    const completeClass = progressIsComplete ? 'line-through opacity-60' : '';
    const base = `block ${sizeClass} font-medium leading-tight ${isHeader ? 'font-bold' : ''} ${completeClass}`;
    if (labelLines > 1) {
      return `${base} overflow-hidden break-words`;
    }
    return `${base} truncate`;
  }

  function labelStyle(): string | undefined {
    if (labelLines <= 1) return undefined;
    return '-webkit-box-orient: vertical; display: -webkit-box; -webkit-line-clamp: 2;';
  }

  $effect(() => {
    if (didInitExpand) return;
    isExpanded = defaultExpanded !== undefined ? defaultExpanded : level === 0;
    didInitExpand = true;
  });

  $effect(() => {
    if (hasSelectedDescendant) {
      isExpanded = true;
    }
  });

  $effect(() => {
    if (!isSelected || !rowRef) return;
    rowRef.scrollIntoView({ block: 'nearest' });
  });

  $effect(() => {
    const rt = runtime;
    const rootId = id;
    if (!hydrateRoot || !rt || !rootId || level !== 0) return;

    const requestId = ++treeLoadSeq;
    void rt
      .fetchAndCache(
        {
          type: 'FetchRecordGraph',
          id: rootId,
          includeParents: true,
          includeChildren: true,
          recursiveChildren: true,
          includeGrouping: true,
          includeConnections: true
        },
        15000
      )
      .catch(() => {
        if (requestId !== treeLoadSeq) return;
      });
  });

  function toggleExpand(e: MouseEvent) {
    e.stopPropagation();
    isExpanded = !isExpanded;
  }

  function startEditing() {
    if (!editable || !item) return;
    if (isRichTextActive) return;
    isEditing = true;
    editValue = item.text ?? '';
  }

  function handleRowClick(e: MouseEvent) {
    e.stopPropagation();
    if (editable && editTrigger === 'click') {
      startEditing();
      return;
    }
    if (rowClickBehavior === 'toggle-or-select' && hasChildren) {
      isExpanded = !isExpanded;
    }
    onSelect?.(id);
  }

  function handleRowDblClick(e: MouseEvent) {
    if (editTrigger !== 'double-click') return;
    e.stopPropagation();
    startEditing();
  }

  function saveEdit() {
    if (!isEditing || !item) return;
    const newText = editValue.trim();
    isEditing = false;
    if (newText && newText !== item.text && runtime) {
      if (onRename) {
        onRename({ id, text: newText });
      } else {
        runtime.cache.patch_item_text(id, newText);
        runtime.queueAndWake('UpdateRecord', { id, text: newText });
      }
    }
  }

  function handleEditKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') saveEdit();
    else if (e.key === 'Escape') isEditing = false;
  }

  function handleAddChild(e: MouseEvent) {
    e.stopPropagation();
    if (onCreateInlineChild) {
      isExpanded = true;
      inlineChildValue = '';
      isAddingInlineChild = true;
      return;
    }
    if (onAddChild) {
      onAddChild(id);
      isExpanded = true;
    }
  }

  function commitInlineChild() {
    if (!isAddingInlineChild) return;
    const text = inlineChildValue.trim();
    isAddingInlineChild = false;
    inlineChildValue = '';
    if (text) {
      onCreateInlineChild?.({ parentId: id, text });
    }
  }

  function cancelInlineChild() {
    isAddingInlineChild = false;
    inlineChildValue = '';
  }

  function handleInlineChildKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitInlineChild();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelInlineChild();
    }
  }

  function handleOpenSettings(e: MouseEvent) {
    e.stopPropagation();
    onOpenSettings?.(id);
  }

  function toggleProgress(e: MouseEvent | KeyboardEvent) {
    e.stopPropagation();
    if (!runtime || !item || !progressAdditional) return;
    const next = !(progressData?.checked ?? false);
    const nextAdditionals = (item.additionals ?? []).map((entry) =>
      entry === progressAdditional || entry.id === progressAdditional.id
        ? patchProgressAdditional(entry, { checked: next })
        : entry
    );
    runtime.cache.patch_item_additionals(id, nextAdditionals);
    runtime.queueAndWake('UpdateRecord', { id, additionals: nextAdditionals });
  }

  function handleDelete(e: MouseEvent) {
    e.stopPropagation();
    if (!onDelete || !item) return;
    if (onRequestDelete) {
      onRequestDelete({ id, text: item.text || 'Untitled' });
      return;
    }
    if (confirm('Delete this item and all its children?')) {
      onDelete(id);
    }
  }

  function handleRemove(e: MouseEvent) {
    e.stopPropagation();
    if (onRemove) {
      onRemove({ id, parentId, edgeId });
    }
  }

  // Drag and drop
  let dragOverZone = $state<'before' | 'after' | 'into' | null>(null);
  const pointerDropState = getDropState();
  let activeDragZone = $derived(
    dragOverZone ?? (pointerDropState.targetId === id ? pointerDropState.zone : null)
  );
  let stopPointerDragListeners: (() => void) | null = null;

  function handleDragStart(e: DragEvent) {
    if (!draggable || !edgeId || !parentId) {
      e.preventDefault();
      return;
    }
    startDrag(id, edgeId, parentId);
    e.dataTransfer?.setData('text/plain', id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragEnd() {
    stopDrag();
    dragOverZone = null;
    clearDropTarget();
  }

  function handleDragOver(e: DragEvent) {
    if (!draggable) return;
    const state = getDragState();
    if (!state.itemId || state.itemId === id) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const y = e.clientY - rect.top;
    if (y < rect.height * 0.25) dragOverZone = 'before';
    else if (y > rect.height * 0.75) dragOverZone = 'after';
    else dragOverZone = 'into';
  }

  function handleDragLeave() {
    dragOverZone = null;
  }

  function handleDrop(e: DragEvent) {
    if (!draggable || !runtime) return;
    const state = getDragState();
    if (!state.itemId || !state.edgeId || state.itemId === id) return;
    e.preventDefault();
    e.stopPropagation();

    const cache = runtime.cache;
    const oldEdge = cache.childrenEdges.get(state.edgeId);
    if (!oldEdge) { dragOverZone = null; return; }

    let newParentId: string;
    let newOrder: number = 0;

    if (activeDragZone === 'into') {
      newParentId = id;
      const children = Array.from(cache.get_children_for_parent(id));
      const lastChildOrder = children.length > 0 ? children[children.length - 1].order : null;
      newOrder = calculateMidOrder(lastChildOrder, null);
      isExpanded = true;
    } else {
      newParentId = parentId as string;
      if (!newParentId) { dragOverZone = null; return; }
      const siblings = Array.from(cache.get_children_for_parent(newParentId));
      const myIdx = siblings.findIndex(s => s.child_id === id);
      if (activeDragZone === 'before') {
        const prevOrder = myIdx > 0 ? siblings[myIdx - 1].order : null;
        newOrder = calculateMidOrder(prevOrder, order);
      } else {
        const nextOrder = myIdx < siblings.length - 1 ? siblings[myIdx + 1].order : null;
        newOrder = calculateMidOrder(order, nextOrder);
      }
    }

    const payload: RecordTreeMovePayload = {
      edgeId: oldEdge.edge_id,
      itemId: state.itemId,
      newParentId,
      newOrder,
      oldEdge: {
        edge_id: oldEdge.edge_id,
        parent_id: oldEdge.parent_id,
        is_key_parent: oldEdge.is_key_parent,
        module_data: oldEdge.module_data,
        clone_setting: oldEdge.clone_setting
      }
    };
    if (onMove) onMove(payload);
    else applyRecordTreeMove(runtime, payload);
    dragOverZone = null;
    stopDrag();
    clearDropTarget();
  }

  function commitMove(itemId: string, sourceEdgeId: string, newParentId: string, newOrder: number) {
    if (!runtime) return;
    const cache = runtime.cache;
    const oldEdge = cache.childrenEdges.get(sourceEdgeId);
    if (!oldEdge) return;

    const payload: RecordTreeMovePayload = {
      edgeId: oldEdge.edge_id,
      itemId,
      newParentId,
      newOrder,
      oldEdge: {
        edge_id: oldEdge.edge_id,
        parent_id: oldEdge.parent_id,
        is_key_parent: oldEdge.is_key_parent,
        module_data: oldEdge.module_data,
        clone_setting: oldEdge.clone_setting
      }
    };
    if (onMove) onMove(payload);
    else applyRecordTreeMove(runtime, payload);
  }

  function dropZoneForElement(target: HTMLElement, clientY: number): 'before' | 'after' | 'into' {
    const rect = target.getBoundingClientRect();
    const y = clientY - rect.top;
    if (y < rect.height * 0.25) return 'before';
    if (y > rect.height * 0.75) return 'after';
    return 'into';
  }

  function rowElementFromPoint(clientX: number, clientY: number): HTMLElement | null {
    return document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>('[data-tree-row-id]') ?? null;
  }

  function commitPointerDrop(target: HTMLElement, zone: 'before' | 'after' | 'into') {
    if (!runtime) return;
    const state = getDragState();
    if (!state.itemId || !state.edgeId) return;
    const targetId = target.dataset.treeRowId;
    if (!targetId || targetId === state.itemId) return;

    const cache = runtime.cache;
    let newParentId: string | null = null;
    let newOrder = 0;

    if (zone === 'into') {
      newParentId = targetId;
      const children = Array.from(cache.get_children_for_parent(targetId));
      const lastChildOrder = children.length > 0 ? children[children.length - 1].order : null;
      newOrder = calculateMidOrder(lastChildOrder, null);
    } else {
      newParentId = target.dataset.treeParentId ?? null;
      if (!newParentId) return;
      const siblings = Array.from(cache.get_children_for_parent(newParentId));
      const targetEdgeId = target.dataset.treeEdgeId;
      const targetIndex = siblings.findIndex((sibling) =>
        targetEdgeId ? sibling.edge_id === targetEdgeId : sibling.child_id === targetId
      );
      if (targetIndex < 0) return;
      if (zone === 'before') {
        const prevOrder = targetIndex > 0 ? siblings[targetIndex - 1].order : null;
        newOrder = calculateMidOrder(prevOrder, siblings[targetIndex].order);
      } else {
        const nextOrder = targetIndex < siblings.length - 1 ? siblings[targetIndex + 1].order : null;
        newOrder = calculateMidOrder(siblings[targetIndex].order, nextOrder);
      }
    }

    commitMove(state.itemId, state.edgeId, newParentId, newOrder);
  }

  function handleDragHandlePointerDown(e: PointerEvent) {
    if (!isSelected || !draggable || !edgeId || !parentId) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    startDrag(id, edgeId, parentId);

    const move = (event: PointerEvent) => {
      const target = rowElementFromPoint(event.clientX, event.clientY);
      const targetId = target?.dataset.treeRowId ?? null;
      if (!target || !targetId || targetId === id) {
        clearDropTarget();
        return;
      }
      setDropTarget(targetId, dropZoneForElement(target, event.clientY));
    };

    const finish = (event: PointerEvent) => {
      const target = rowElementFromPoint(event.clientX, event.clientY);
      if (target) {
        const targetId = target.dataset.treeRowId;
        if (targetId && targetId !== id) {
          commitPointerDrop(target, dropZoneForElement(target, event.clientY));
        }
      }
      stopPointerDragListeners?.();
      stopPointerDragListeners = null;
      clearDropTarget();
      stopDrag();
    };

    stopPointerDragListeners?.();
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', finish, { once: true });
    document.addEventListener('pointercancel', finish, { once: true });
    stopPointerDragListeners = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', finish);
      document.removeEventListener('pointercancel', finish);
    };
  }

  function moveSibling(direction: -1 | 1, e: MouseEvent) {
    e.stopPropagation();
    if (!draggable || !runtime || !edgeId || !parentId) return;

    const cache = runtime.cache;
    const oldEdge = cache.childrenEdges.get(edgeId);
    if (!oldEdge) return;

    const siblings = Array.from(cache.get_children_for_parent(parentId));
    const currentIndex = siblings.findIndex((sibling) => sibling.edge_id === edgeId);
    if (currentIndex < 0) return;

    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;

    const beforeOrder =
      direction < 0
        ? (siblings[targetIndex - 1]?.order ?? null)
        : (siblings[targetIndex]?.order ?? null);
    const afterOrder =
      direction < 0
        ? (siblings[targetIndex]?.order ?? null)
        : (siblings[targetIndex + 1]?.order ?? null);
    const newOrder = calculateMidOrder(beforeOrder, afterOrder);

    commitMove(id, oldEdge.edge_id, parentId, newOrder);
  }
</script>

{#if item}
  <div class="tree-node-wrapper flex flex-col relative w-full">
    <!-- Node Row -->
    <div
      bind:this={rowRef}
      class={`group relative cursor-pointer outline-none ${
        unstyledWrapper
          ? 'block'
          : `flex ${compact ? 'gap-1' : 'gap-1.5'} rounded-[var(--radius-sm)] px-2 ${compact ? 'py-1' : 'py-1.5'} transition-colors tree-row-wrap ${badgePlacement === 'below-label' ? 'items-start' : 'items-center'}`
      } ${
        isSelected && activeDragZone !== 'into' && !unstyledWrapper
          ? 'ring-1 ring-[color-mix(in_srgb,var(--color-primary),transparent_55%)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-primary),transparent_78%)] bg-[var(--color-muted)]'
          : ''
      } ${
        !isSelected && activeDragZone !== 'into' && !unstyledWrapper ? 'hover:bg-[var(--color-muted)]' : ''
      } ${
        activeDragZone === 'into' && !unstyledWrapper ? 'bg-[var(--color-primary)] text-white' : ''
      }`}
      style:padding-left={unstyledWrapper ? undefined : `calc(${level} * var(--tree-indent) + 0.5rem)`}
      draggable={false}
      ondragend={handleDragEnd}
      ondragover={handleDragOver}
      ondragleave={handleDragLeave}
      ondrop={handleDrop}
      onclick={handleRowClick}
      ondblclick={handleRowDblClick}
      role="treeitem"
      data-tree-row-id={id}
      data-tree-parent-id={parentId ?? undefined}
      data-tree-edge-id={edgeId ?? undefined}
      data-tree-order={order}
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-selected={isSelected}
      tabindex="0"
      onkeydown={(e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (rowClickBehavior === 'toggle-or-select' && hasChildren) {
          isExpanded = !isExpanded;
        }
        onSelect?.(id);
      }}
    >
      <!-- Drop indicators -->
      {#if activeDragZone === 'before'}
        <div class="absolute top-0 left-0 right-0 h-0.5 bg-[var(--color-primary)] z-[var(--z-raised)] pointer-events-none rounded-full"></div>
      {/if}
      {#if activeDragZone === 'after'}
        <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)] z-[var(--z-raised)] pointer-events-none rounded-full"></div>
      {/if}

      {#if customRow}
        {@render customRow({ item, level, isExpanded, hasChildren, toggleExpand, isSelected, dragOverZone: activeDragZone })}
      {:else}
        <!-- Drag handle -->
        {#if draggable && edgeId}
          <span
            class="flex w-3 h-5 shrink-0 touch-none select-none cursor-grab items-center justify-center rounded-sm text-[var(--color-muted-foreground)] transition-all duration-150 hover:bg-[var(--color-input)] hover:text-[var(--color-foreground)] active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:opacity-100 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
            class:opacity-100={isSelected}
            draggable={false}
            role="button"
            tabindex={isSelected ? 0 : -1}
            aria-label="Drag to reorder"
            title="Drag to reorder"
            ondragstart={handleDragStart}
            ondragend={handleDragEnd}
            onpointerdown={handleDragHandlePointerDown}
            onclick={(e) => e.stopPropagation()}
            onkeydown={(e) => e.stopPropagation()}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="9" cy="6" r="1.5" />
              <circle cx="15" cy="6" r="1.5" />
              <circle cx="9" cy="12" r="1.5" />
              <circle cx="15" cy="12" r="1.5" />
              <circle cx="9" cy="18" r="1.5" />
              <circle cx="15" cy="18" r="1.5" />
            </svg>
          </span>
        {/if}

        <!-- Expand/collapse toggle -->
        <button
          class="flex items-center justify-center size-5 shrink-0 rounded-sm hover:bg-[var(--color-input)] text-[var(--color-muted-foreground)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          onclick={toggleExpand}
          style:visibility={hasChildren ? 'visible' : 'hidden'}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="transition-transform {isExpanded ? 'rotate-90' : ''}"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>

        {#if progressAdditional}
          {#if progressShape?.computed}
            <!-- Server-computed: non-editable status indicator. Reflects the
                 current value (Done / In progress / Not done) for check kind,
                 or "47%" for percentage kind. -->
            {#if progressShape.kind === 'check'}
              {@const cv = progressShape.value as 'True' | 'False' | 'Partial'}
              <Badge
                variant={cv === 'True' ? 'success' : cv === 'Partial' ? 'warn' : 'neutral'}
                size="sm"
                class="shrink-0 whitespace-nowrap select-none border {cv === 'True' ? 'border-emerald-500/40' : cv === 'Partial' ? 'border-amber-500/40' : 'border-muted-foreground/30'}"
                title="Auto-calculated from descendants"
                aria-label={cv === 'True' ? 'Done (auto)' : cv === 'Partial' ? 'In progress (auto)' : 'Not done (auto)'}
              >{cv === 'True' ? 'Done' : cv === 'Partial' ? 'Partial' : 'Not done'}</Badge>
            {:else}
              <Badge
                variant={progressIsComplete ? 'success' : 'neutral'}
                size="sm"
                class="shrink-0 whitespace-nowrap tabular-nums select-none border {progressIsComplete ? 'border-emerald-500/40' : 'border-muted-foreground/30'}"
                title="Auto-calculated from descendants"
              >{typeof progressShape.value === 'number' ? progressShape.value : 0}%</Badge>
            {/if}
          {:else}
            <div
              class="flex size-4 shrink-0 items-center justify-center rounded border-2 transition-colors {progressData?.checked ? 'border-primary bg-primary text-primary-foreground' : 'custom-checkbox'}"
              aria-checked={progressData?.checked ?? false}
              role="checkbox"
              tabindex="0"
              title={progressData?.checked ? 'Mark incomplete' : 'Mark complete'}
              onclick={toggleProgress}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleProgress(e);
                }
              }}
            >
              {#if progressData?.checked}
                <svg viewBox="0 0 16 16" class="size-3" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 8.5 6.5 12 13 4.5" />
                </svg>
              {/if}
            </div>
          {/if}
        {/if}

        <!-- Label column: graph parents above, grouping pills + label inline -->
        <div class="min-w-0 flex-1 basis-40">
          {#if showGraphParents && graphParentItems.length > 0}
            <div class="flex flex-wrap gap-1 mb-1">
              {#each graphParentItems as parent (parent.id)}
                <a
                  href={linkHref?.(parent.id) ?? `/records/${parent.id.replace(/^records:/, '')}`}
                  class="text-[10px] leading-none text-muted-foreground border-b border-dashed border-muted-foreground/40 hover:text-foreground hover:border-foreground/40 transition-colors"
                  onclick={(e) => {
                    e.stopPropagation();
                    if (activeDragZone) e.preventDefault();
                  }}
                >
                  {parent.text || 'Untitled'}
                </a>
              {/each}
            </div>
          {/if}

          <div class="flex items-center gap-1 min-w-0 overflow-hidden">
            {#if showGroupingParents && groupingParentItems.length > 0}
              {#each groupingParentItems as group (group.id)}
                <a
                  href={linkHref?.(group.id) ?? `/records/${group.id.replace(/^records:/, '')}`}
                  class="shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none max-w-[120px] truncate {group.custom_color ? '' : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'}"
                  style={group.custom_color ? `background: hsl(${group.custom_color}, 70%, 30%); color: hsl(${group.custom_color}, 70%, 80%);` : undefined}
                  onclick={(e) => {
                    e.stopPropagation();
                    if (activeDragZone) e.preventDefault();
                  }}
                  title={group.text || 'Untitled'}
                >
                  {#if group.svg}
                    <span class="mr-1 inline-flex items-center justify-center size-3">
                      {@html sanitizeSvg(group.svg)}
                    </span>
                  {:else if group.short}
                    <span class="mr-1 opacity-80">{group.short}</span>
                  {/if}
                  <span class="truncate">{group.text || 'Untitled'}</span>
                </a>
              {/each}
            {/if}

            {#if isEditing}
              <!-- svelte-ignore a11y_autofocus -->
              <input
                bind:value={editValue}
                onblur={saveEdit}
                onkeydown={handleEditKeydown}
                onclick={(e) => e.stopPropagation()}
                ondblclick={(e) => e.stopPropagation()}
                class="flex-1 min-w-0 w-full rounded border border-[var(--color-primary)] px-1 py-0.5 text-sm bg-[var(--color-background)] outline-none"
                autofocus
              />
            {:else}
              {#if refMatch}
                <PartialReference
                  {runtime}
                  sourceRecordId={refMatch[1]}
                  referenceId={refMatch[2]}
                  class={labelClasses(Boolean(item.show_as_header))}
                  style={labelStyle()}
                />
              {:else if linkHref}
                {@const href = linkHref(id)}
                {#if href}
                  <a
                    {href}
                    class={`${labelClasses(Boolean(item.show_as_header))} hover:underline decoration-1 underline-offset-2`}
                    style={labelStyle()}
                    onclick={(e) => {
                      if (activeDragZone) e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    {item.text || 'Untitled'}
                  </a>
                {:else}
                  <span class={labelClasses(Boolean(item.show_as_header))} style={labelStyle()}>
                    {item.text || 'Untitled'}
                  </span>
                {/if}
              {:else}
                <span class={labelClasses(Boolean(item.show_as_header))} style={labelStyle()}>
                  {item.text || 'Untitled'}
                </span>
              {/if}

              {#if itemBadge && badgePlacement === 'inline'}
                <span
                  class="shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none"
                  class:border-primary={itemBadge.tone === 'primary'}
                  class:bg-primary={itemBadge.tone === 'primary'}
                  class:text-primary-foreground={itemBadge.tone === 'primary'}
                  class:border-accent={itemBadge.tone === 'accent'}
                  class:bg-accent={itemBadge.tone === 'accent'}
                  class:text-accent-foreground={itemBadge.tone === 'accent'}
                  class:bg-[var(--color-muted)]={itemBadge.tone !== 'primary' && itemBadge.tone !== 'accent'}
                  class:text-[var(--color-foreground)]={itemBadge.tone !== 'primary' && itemBadge.tone !== 'accent'}
                >
                  {itemBadge.label}
                </span>
              {/if}
            {/if}
          </div>

          {#if itemBadge && badgePlacement === 'below-label'}
            <span
              class="mt-1 inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none"
              class:border-primary={itemBadge.tone === 'primary'}
              class:bg-primary={itemBadge.tone === 'primary'}
              class:text-primary-foreground={itemBadge.tone === 'primary'}
              class:border-accent={itemBadge.tone === 'accent'}
              class:bg-accent={itemBadge.tone === 'accent'}
              class:text-accent-foreground={itemBadge.tone === 'accent'}
              class:bg-[var(--color-muted)]={itemBadge.tone !== 'primary' && itemBadge.tone !== 'accent'}
              class:text-[var(--color-foreground)]={itemBadge.tone !== 'primary' && itemBadge.tone !== 'accent'}
            >
              <span class="truncate">{itemBadge.label}</span>
            </span>
          {/if}
        </div>

        <!-- Additionals badges -->
        {#if showAdditionals && !isEditing}
          <TreeAdditionals additionals={item.additionals} {runtime} itemId={id} />
        {/if}

        <!-- Row action buttons. Keep them inline so selected-row actions feel
             attached to the row instead of floating over the content. -->
        {#if showActions && !isEditing}
          <div
            class="tree-actions-wrap sm:ml-2 sm:flex sm:max-w-[14rem] sm:shrink-0 sm:items-center gap-1 sm:overflow-hidden sm:transition-opacity sm:duration-150 {isSelected ? 'flex pointer-events-auto opacity-100' : 'hidden pointer-events-none opacity-0 sm:flex sm:group-hover:pointer-events-auto sm:group-hover:opacity-100 sm:group-focus-within:pointer-events-auto sm:group-focus-within:opacity-100'}"
          >
            {#if onAddChild || onCreateInlineChild}
              <button
                class="rounded p-1 text-[var(--color-muted-foreground)] transition hover:bg-[color-mix(in_srgb,var(--color-primary),transparent_88%)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                onclick={handleAddChild}
                title="Add child"
                aria-label="Add child"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
              </button>
            {/if}
            {#if draggable && edgeId && parentId}
              <button
                class="rounded p-1 text-[var(--color-muted-foreground)] transition hover:bg-[color-mix(in_srgb,var(--color-primary),transparent_88%)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                onclick={(e) => moveSibling(-1, e)}
                title="Move up"
                aria-label="Move up"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>
              </button>
              <button
                class="rounded p-1 text-[var(--color-muted-foreground)] transition hover:bg-[color-mix(in_srgb,var(--color-primary),transparent_88%)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                onclick={(e) => moveSibling(1, e)}
                title="Move down"
                aria-label="Move down"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </button>
            {/if}
            {#if onOpenSettings}
              <button
                class="rounded p-1 text-[var(--color-muted-foreground)] transition hover:bg-[color-mix(in_srgb,var(--color-primary),transparent_88%)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                onclick={handleOpenSettings}
                title="Open settings"
                aria-label="Open settings"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .66.39 1.26 1 1.51.16.07.33.11.51.11H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
            {/if}
            {#if onRemove && edgeId && parentId}
              <button
                class="rounded p-1 text-[var(--color-muted-foreground)] transition hover:bg-amber-500/15 hover:text-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                onclick={handleRemove}
                title="Remove from parent"
                aria-label="Remove from parent"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>
              </button>
            {/if}
            {#if onDelete}
              <button
                class="rounded p-1 text-[var(--color-muted-foreground)] transition hover:bg-red-500/15 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                onclick={handleDelete}
                title="Delete"
                aria-label="Delete"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            {/if}
          </div>
        {/if}
      {/if}
    </div>

    <!-- Recursive children -->
    {#if isExpanded && (hasChildren || isAddingInlineChild) && !seen.has(id)}
      <div class="flex flex-col">
        {#each childrenEdges as edge (edge.edge_id)}
          <RecordTreeView
            id={edge.child_id}
            {runtime}
            parentId={id}
            edgeId={edge.edge_id}
            order={edge.order}
            level={level + 1}
            seen={new Set([...seen, id])}
            {selectedId}
            {draggable}
            {editable}
            {showAdditionals}
            {showGraphParents}
            {showGroupingParents}
            {showActions}
            {hydrateRoot}
            {badgePlacement}
            {labelLines}
            {compact}
            {rowClickBehavior}
            {editTrigger}
            {badgeForItem}
            {linkHref}
            {defaultExpanded}
            {customRow}
            {unstyledWrapper}
            {onSelect}
            {onAddChild}
            {onCreateInlineChild}
            {inlineChildPlaceholder}
            {onOpenSettings}
            {onRemove}
            {onRequestDelete}
            {onDelete}
            {onRename}
            {onMove}
          />
        {/each}
        {#if isAddingInlineChild}
          <div
            class="flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1"
            style:padding-left={`calc(${(level + 1)} * var(--tree-indent) + 0.5rem)`}
          >
            <span class="size-5 shrink-0"></span>
            <span
              class="flex size-4 shrink-0 items-center justify-center rounded border-2 custom-checkbox"
              aria-hidden="true"
            ></span>
            <!-- svelte-ignore a11y_autofocus -->
            <input
              bind:value={inlineChildValue}
              placeholder={inlineChildPlaceholder}
              onblur={commitInlineChild}
              onkeydown={handleInlineChildKeydown}
              onclick={(e) => e.stopPropagation()}
              class="min-w-0 flex-1 rounded border border-[var(--color-primary)] bg-[var(--color-background)] px-2 py-1 text-[var(--text-sm)] outline-none placeholder:text-[var(--color-muted-foreground)]"
              autofocus
            />
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .tree-node-wrapper {
    container-type: inline-size;
    --tree-indent: 0.75rem;
    --tree-font-size-compact: 10px;
    --tree-font-size-normal: 12px;
  }
  @container (max-width: 480px) {
    .tree-row-wrap {
      flex-wrap: wrap;
    }
    .tree-actions-wrap {
      margin-left: 0;
      flex-basis: 100%;
      justify-content: flex-end;
      gap: 0.5rem;
      padding-top: 0.25rem;
    }
  }
  @media (min-width: 640px) {
    .tree-node-wrapper {
      --tree-indent: 1.5rem;
      --tree-font-size-compact: var(--text-xs, 12px);
      --tree-font-size-normal: var(--text-sm, 14px);
    }
  }
  .custom-checkbox {
    border-color: color-mix(in srgb, var(--color-muted-foreground) 55%, transparent);
    background-color: color-mix(in srgb, var(--color-input), transparent 60%);
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }
  .custom-checkbox:hover {
    border-color: var(--color-primary);
    background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
  }
</style>
