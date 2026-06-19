export interface Item {
  id: string;
  profile_id?: string;
  text: string;
  markup?: string;
  children?: string[];
  additionals?: AdditionalWithId[];
  has_parent?: boolean;
  show_as_header?: boolean;
  parent?: string;
  /**
   * Clone/template lineage — PER-NODE provenance.
   *
   * INVARIANT: both of these are the id of THIS clone's own immediate
   * source record (the specific template node it was copied from). They are
   * NOT the template/container root, and NOT tree-wide. For a cloned tree,
   * every node carries a DIFFERENT pair pointing at its own source node.
   * In practice `original_template_id === copied_from_record`.
   *
   * This matches the original wisewords behaviour and the server clone
   * (`fn::group_for_clone`, `$original_source = NONE` →
   * `id AS copied_from_record`, `original_template_id`). Keep the client
   * clone paths (exec/calendar `apply-template-action`) in lockstep.
   *
   * ⚠️ ANTI-PATTERN — do NOT stamp the template *container root* here
   * tree-wide. That divergence (commit ba08375) broke VWT clone detection
   * (every nested descendant matched as a false "root"), made the field
   * path-dependent for every reader, and required this whole migration.
   *
   * Finding all clones of a template is a LOOKUP concern, not a stored
   * one: expand the template id to `{templateRoot} ∪ directChildren` and
   * match `copied_from_record INSIDE` that set — see
   * `fn::find_template_clones` (date_clone.surql), the `FetchTemplateClones`
   * RPC, and `vwt-logic.findCloneRoots`. The clone-parity integration
   * suite asserts this per-node invariant across both clone paths.
   */
  copied_from_record?: string;
  /** See `copied_from_record` above — same per-node invariant. */
  original_template_id?: string;
  svg?: string;
  short?: string;
  custom_color?: number;
  settings?: ItemSettings;
  module_settings?: Record<string, unknown>;
  // Fetch result items (inlined or as IDs)
  graph_children?: Item[];
  permissions?: ItemPermissions[];
  grouping?: Item[];
  connections?: Item[];
}

export interface ItemSettings {
  /** 'Full' (tree), 'Mini' (compact card), or a module-contributed key (e.g. 'calendar') */
  default_view?: string;
  /** 'Unset' | 'Paginate' | module-contributed display style key */
  display_style_graph?: string;
  /** 'Unset' | 'Paginate' | module-contributed display style key */
  display_style_group?: string;
}

export interface ItemPermissions {
  role: 'owner' | 'editor-adv' | 'editor' | 'viewer';
  user_id: string;
  username?: string;
  user_icon_small?: string;
}

export type AdditionalValue =
  | { type: 'pg'; prog_type: { ch?: string; pct?: number }; weight?: number; computed?: boolean; desc?: string | null }
  | { type: 'date'; date_info: DateInformation; source_additional_id?: string }
  | { type: 'distance'; value: number; unit: string; meters: number; computed?: boolean; desc?: string | null }
  | { type: 'duration'; value: number; unit: string; seconds: number; computed?: boolean; desc?: string | null }
  | { type: 'transaction'; currency: string; amount_minor: number; debit_credit: 'debit' | 'credit'; transfer_id?: string; counterparty_tx_id?: string }
  | { type: 'account_balance'; currency: string; balance_minor: number; computed?: boolean }
  | { type: string; [key: string]: unknown };

export type AdditionalWithId = AdditionalValue & {
  id: string;
};

// Date specific additionals
export interface DateInformation {
  value: TimeReference;
  is_status: boolean;
  is?: boolean;
  /**
   * UI intent marker for anchor-relative dates. A zero-day offset resolves the
   * same as the bare anchor, so this preserves whether the offset editor was
   * explicitly enabled when `value` itself cannot distinguish those states.
   */
  offset_enabled?: boolean;
  display_as?: 'Major' | 'Minor' | 'Mini' | 'None' | 'mj' | 'mi' | 'sm' | 'n';
  ds?: 'mj' | 'mi' | 'sm' | 'n';
  relevance_duration_minutes?: number;
  rv?: number;
  relevance_infinite?: boolean;
  ri?: boolean;
  pin_when_overdue?: boolean;
  po?: boolean;
  /**
   * Canonical relevance model (supersedes the legacy `rv`/`ri` scalars). Holds a
   * separate bound for the `before` (how early the item surfaces, relative to
   * its resolved start) and `after` (how long it lingers, relative to its
   * resolved end) sides. Legacy scalars are still read when this is absent — see
   * `readRelevanceWindow` in `relevance.ts`.
   */
  relevance?: RelevanceWindow;
  /** Short alias for `relevance`, mirroring the rv/ri short-field convention. */
  rl?: RelevanceWindow;
}

export type RelevancePeriodUnit = 'day' | 'week' | 'month' | 'year';

/**
 * One side of a relevance window. A bound answers "how far from the anchor is
 * this item still relevant?" in one of three ways:
 *  - `dur`: a fixed number of minutes (the legacy behavior).
 *  - `cal`: snap to the calendar period (day/week/month/year) containing the
 *    anchor — e.g. `{ type: 'cal', unit: 'day' }` on the `after` side keeps an
 *    item relevant until the end of its due date's calendar day.
 *  - `inf`: unbounded on this side.
 */
export type RelevanceBound =
  | { type: 'dur'; minutes: number }
  | { type: 'cal'; unit: RelevancePeriodUnit }
  | { type: 'inf' };

export interface RelevanceWindow {
  /** Bound applied to the resolved start (controls early surfacing). */
  before?: RelevanceBound;
  /** Bound applied to the resolved end (controls lingering after due). */
  after?: RelevanceBound;
}

export type BaseOrVagueReference<VRT, T> = 
  | { type: 'ba', v: T, a?: T } // Base
  | { type: 'vg', t: VRT }       // Vague
  | { type: 'of', v: number, a: 'nw' | 'up' | 'pr' }; // Offset

export interface StartOrEnd<VRT, T> {
  s?: BaseOrVagueReference<VRT, T>;
  e?: BaseOrVagueReference<VRT, T>;
}

export type WeekModeCode = 'ord' | 'iso' | 'row';

export interface TimeReference {
  y?: StartOrEnd<string, number>; // year
  m?: StartOrEnd<string, number>; // month
  w?: StartOrEnd<string, number>; // week
  d?: StartOrEnd<string, number>; // day
  i?: StartOrEnd<string, number>; // minutes
  wm?: WeekModeCode; // week mode: ordinal, ISO, or stored calendar row
  ws?: number; // stored first day of week for row mode, 0 = Sun ... 6 = Sat
}

export interface DateReference {
  date_info: DateInformation;
}
