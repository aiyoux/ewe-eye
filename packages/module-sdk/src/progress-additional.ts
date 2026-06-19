import type { AdditionalWithId } from './types.ts';

/**
 * Helpers for the "progress" (user-checkbox) additional.
 *
 * Wire shape (flat, legacy-compatible):
 *   `{ id, type: 'pg', prog_type: { ch | pct }, weight, computed, desc }`
 */

export interface ProgressAdditionalData {
  checked: boolean;
}

export type ProgressKind = 'check' | 'percentage';
export type CheckProgressValue = 'True' | 'False' | 'Partial' | 'NA' | 'WontDo';

export interface CreateProgressOptions {
  /** 'check' (boolean) or 'percentage' (0-100). Default 'check'. */
  kind?: ProgressKind;
  /**
   * Initial value.
   * - For 'check': boolean (true→'t', false→'f') or 'True'|'False'|'Partial'|'NA'|'WontDo'.
   * - For 'percentage': number 0-100 (clamped).
   * Default: 'False' / 0.
   */
  value?: boolean | number | CheckProgressValue;
  /** When true, the value is auto-calculated server-side from descendants. */
  computed?: boolean;
  /** Relative weight when this progress contributes to a computed parent. Default 100. */
  weight?: number;
  /** Optional human-readable description. */
  desc?: string | null;
}

export interface ProgressShape {
  kind: ProgressKind;
  /** For check kind: 'True' | 'False' | 'Partial' | 'NA' | 'WontDo'. For percentage: number 0-100. */
  value: CheckProgressValue | number;
  computed: boolean;
  weight: number;
  desc: string | null;
}

/**
 * Reads the kind, value, computed flag, weight, and desc off any of the
 * progress additional shapes (flat, wrapped, simple). Returns null when the
 * additional isn't a progress one.
 */
export function readProgressAdditional(
  additional: AdditionalWithId | Record<string, any>
): ProgressShape | null {
  if (!isProgressAdditional(additional)) return null;
  const addObj = additional as any;
  const prog_type = addObj.prog_type;
  const computed = Boolean(addObj.computed ?? false);
  const weight = Number(addObj.weight ?? 100);
  const desc = addObj.desc as string | null;

  if (!prog_type) {
    return { kind: 'check', value: 'False', computed, weight, desc };
  }
  if ('ch' in prog_type) {
    const cv = prog_type.ch;
    return { kind: 'check', value: cv === 't' ? 'True' : cv === 'p' ? 'Partial' : cv === 'na' ? 'NA' : cv === 'wd' ? 'WontDo' : 'False', computed, weight, desc };
  }
  if ('pct' in prog_type) {
    return { kind: 'percentage', value: Number(prog_type.pct ?? 0), computed, weight, desc };
  }
  return { kind: 'check', value: 'False', computed, weight, desc };
}

export function isProgressAdditional(
  additional: AdditionalWithId | Record<string, any>
): boolean {
  return (additional as any).type === 'pg';
}

export function getProgressAdditionalData(
  additional: AdditionalWithId | Record<string, any>
): ProgressAdditionalData | null {
  if (!isProgressAdditional(additional)) return null;
  const prog_type = (additional as any).prog_type;

  if (!prog_type) {
    return { checked: false };
  }

  if ('ch' in prog_type) {
    return { checked: prog_type.ch === 't' || prog_type.ch === 'p' };
  } else if ('pct' in prog_type) {
    return { checked: Number(prog_type.pct ?? 0) >= 100 };
  }

  return { checked: false };
}

/**
 * Create a progress additional in the flat wire shape that the server-side
 * `fn::propagate_progress_change` understands:
 *   `{ id, type: 'pg', prog_type: { ch | pct }, weight, computed, desc }`
 *
 * Back-compat: calling with a boolean (`createProgressAdditional(true)`) is
 * equivalent to `createProgressAdditional({ kind: 'check', value: true })`.
 */
export function createProgressAdditional(opts?: boolean | CreateProgressOptions): AdditionalWithId {
  const o: CreateProgressOptions = typeof opts === 'boolean'
    ? { kind: 'check', value: opts }
    : (opts ?? {});
  const kind: ProgressKind = o.kind ?? 'check';
  const computed = Boolean(o.computed ?? false);
  const weight = Number.isFinite(o.weight) ? Number(o.weight) : 100;
  const desc = o.desc ?? null;
  const id = crypto.randomUUID();

  if (kind === 'check') {
    let ch: 't' | 'f' | 'p' | 'na' | 'wd' = 'f';
    if (o.value === true) ch = 't';
    else if (o.value === 'True') ch = 't';
    else if (o.value === 'Partial') ch = 'p';
    else if (o.value === 'NA') ch = 'na';
    else if (o.value === 'WontDo') ch = 'wd';
    return {
      id,
      type: 'pg',
      prog_type: { ch },
      weight,
      computed,
      desc
    } as unknown as AdditionalWithId;
  }
  // percentage
  let pct = 0;
  if (typeof o.value === 'number') pct = Math.max(0, Math.min(100, o.value));
  else if (o.value === true) pct = 100;
  return {
    id,
    type: 'pg',
    prog_type: { pct },
    weight,
    computed,
    desc
  } as unknown as AdditionalWithId;
}

/**
 * Toggle/replace an additional's computed flag. Server-side propagation only
 * fires for additionals where `computed: true`. Returns a new object so cache
 * reactivity sees the change.
 */
export function setProgressAdditionalComputed<T extends AdditionalWithId | Record<string, any>>(
  additional: T,
  computed: boolean
): T {
  if (!isProgressAdditional(additional)) return additional;
  return { ...(additional as any), computed } as T;
}

/**
 * Convert an additional between 'check' and 'percentage' kinds. The current
 * value is preserved as best-effort (True ↔ 100, False ↔ 0, Partial ↔ 50).
 */
export function setProgressAdditionalKind<T extends AdditionalWithId | Record<string, any>>(
  additional: T,
  kind: ProgressKind
): T {
  const shape = readProgressAdditional(additional);
  if (!shape || shape.kind === kind) return additional;
  // Translate the value across kinds so existing intent is preserved.
  let nextValue: CheckProgressValue | number;
  if (kind === 'percentage') {
    nextValue = shape.value === 'True' ? 100 : shape.value === 'Partial' ? 50 : 0;
  } else {
    const pct = typeof shape.value === 'number' ? shape.value : 0;
    nextValue = pct >= 100 ? 'True' : pct > 0 ? 'Partial' : 'False';
  }
  // Build a fresh additional preserving id, computed, weight, desc.
  const addObj = additional as any;
  const replacement = createProgressAdditional({
    kind,
    value: nextValue,
    computed: shape.computed,
    weight: shape.weight,
    desc: shape.desc
  }) as any;
  // Re-use the original id so cache patches and references stay stable.
  replacement.id = addObj.id ?? replacement.id;
  return replacement as T;
}

export function patchProgressAdditional<T extends AdditionalWithId | Record<string, any>>(
  additional: T,
  data: ProgressAdditionalData
): T {
  const shape = readProgressAdditional(additional);
  if (!shape) return additional;

  let nextValue: CheckProgressValue | number;
  if (shape.kind === 'percentage') {
    nextValue = data.checked ? 100 : 0;
  } else {
    nextValue = data.checked ? 'True' : 'False';
  }

  const replacement = createProgressAdditional({
    kind: shape.kind,
    value: nextValue,
    computed: false,
    weight: shape.weight,
    desc: shape.desc
  }) as any;

  const { t, d, c, p, ...rest } = additional as any;
  replacement.id = rest.id ?? replacement.id;

  return { ...rest, ...replacement } as T;
}
