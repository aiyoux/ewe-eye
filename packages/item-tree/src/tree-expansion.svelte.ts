import { SvelteSet } from 'svelte/reactivity';

/**
 * Shared expand/collapse state for a {@link RecordTreeView}. Without one, each
 * node tracks its own ephemeral open/closed flag (lost on remount). With one,
 * the whole tree shares a single source of truth that survives reloads and
 * supports expand-all / collapse-all.
 *
 * State is modelled as a `base` mode plus a set of per-id exceptions:
 *   - `default` → only level-0 (the root) is open
 *   - `all`     → everything open
 *   - `none`    → everything closed
 * Each id in `exceptions` is flipped relative to whatever the base implies, so
 * expand-all / collapse-all is just a base swap + clearing the exceptions.
 */
export interface TreeExpansion {
  isExpanded(id: string, level: number): boolean;
  toggle(id: string, level: number): void;
  set(id: string, expanded: boolean, level: number): void;
  expandAll(): void;
  collapseAll(): void;
  /**
   * Re-point the controller at a different persist key (e.g. when a reused page
   * component navigates to another record), reloading that key's saved state.
   * Lets callers keep a single controller instance instead of constructing one
   * inside a reactive scope.
   */
  reset(persistKey?: string): void;
}

type ExpansionBase = 'default' | 'all' | 'none';

export function createTreeExpansion(opts: { persistKey?: string } = {}): TreeExpansion {
  let base = $state<ExpansionBase>('default');
  const exceptions = new SvelteSet<string>();
  let storageKey = opts.persistKey ? `tree-expansion:${opts.persistKey}` : null;

  function load() {
    base = 'default';
    exceptions.clear();
    if (!storageKey || typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { base?: ExpansionBase; exceptions?: string[] };
        if (parsed.base === 'default' || parsed.base === 'all' || parsed.base === 'none') {
          base = parsed.base;
        }
        if (Array.isArray(parsed.exceptions)) {
          for (const id of parsed.exceptions) exceptions.add(id);
        }
      }
    } catch {
      /* corrupt entry — fall back to defaults */
    }
  }

  load();

  function reset(persistKey?: string) {
    storageKey = persistKey ? `tree-expansion:${persistKey}` : null;
    load();
  }

  function persist() {
    if (!storageKey || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ base, exceptions: [...exceptions] }));
    } catch {
      /* storage full / unavailable — non-fatal */
    }
  }

  function baseExpanded(level: number): boolean {
    if (base === 'all') return true;
    if (base === 'none') return false;
    return level === 0;
  }

  function isExpanded(id: string, level: number): boolean {
    // XOR the base default with whether this id is an explicit exception.
    return baseExpanded(level) !== exceptions.has(id);
  }

  function set(id: string, expanded: boolean, level: number): void {
    const isException = expanded !== baseExpanded(level);
    if (isException) exceptions.add(id);
    else exceptions.delete(id);
    persist();
  }

  function toggle(id: string, level: number): void {
    set(id, !isExpanded(id, level), level);
  }

  function expandAll(): void {
    base = 'all';
    exceptions.clear();
    persist();
  }

  function collapseAll(): void {
    base = 'none';
    exceptions.clear();
    persist();
  }

  return { isExpanded, toggle, set, expandAll, collapseAll, reset };
}
