import type {
  TimeReference,
  BaseOrVagueReference,
  StartOrEnd,
  DateInformation
} from './types.ts';
import {
  VAGUE_MINUTES,
  VAGUE_DAYS,
  VAGUE_MONTHS,
  type VagueMinuteCode,
  type VagueDayCode,
  type VagueMonthCode
} from './vague-time.ts';
import {
  extractDateWindow,
  weekModeFor
} from './time-week.ts';
import {
  explicitTimeReference,
  relativeTimeReference,
  resolveEnd,
  resolveStart,
  type ResolveContext
} from './time-reference.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TimeReferenceField = 'y' | 'm' | 'w' | 'd' | 'i';
export type TimeReferenceSide = 's' | 'e';

export interface TimeReferenceValidationIssue {
  code:
    | 'vague_month_has_day'
    | 'vague_month_has_week'
    | 'vague_month_has_time'
    | 'vague_day_has_time'
    | 'end_before_start'
    | 'missing_start_date'
    | 'unsupported_reference';
  side?: TimeReferenceSide;
  field?: TimeReferenceField;
  message: string;
}

export interface TimeReferenceValidationResult {
  valid: boolean;
  issues: TimeReferenceValidationIssue[];
}

export interface NormalizeTimeReferenceOptions {
  pruneInvalidEnd?: boolean;
  trimImplicitEnds?: boolean;
  sanitizeVague?: boolean;
}

export interface NormalizeDateInformationForPersistenceOptions {
  /**
   * `preserve` keeps the edited TimeReference shape and only normalizes it.
   * `absolute` resolves and stores base date/time refs.
   * `relative` resolves and stores offsets from `relativeAnchor`.
   */
  output?: 'preserve' | 'absolute' | 'relative';
  resolveNow?: Date;
  resolveContext?: ResolveContext;
  relativeAnchor?: Date;
  relativeAnchorType?: 'up' | 'pr';
  dateOnly?: boolean;
  timeReference?: NormalizeTimeReferenceOptions;
}

export interface FormatTimeReferenceOptions {
  includeDate?: boolean;
  includeTime?: boolean;
  side?: 'start' | 'end' | 'range';
  fallback?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function cloneRef<VRT extends string, T>(
  value: BaseOrVagueReference<VRT, T> | undefined
): BaseOrVagueReference<VRT, T> | undefined {
  return value ? { ...value } : undefined;
}

function cloneStartOrEnd<VRT extends string, T>(
  value: StartOrEnd<VRT, T> | undefined
): StartOrEnd<VRT, T> | undefined {
  if (!value) return undefined;
  return {
    ...(value.s ? { s: cloneRef(value.s) } : {}),
    ...(value.e ? { e: cloneRef(value.e) } : {})
  };
}

export function cloneTimeReference(value: TimeReference | undefined): TimeReference {
  if (!value) return {};
  return {
    ...(value.y ? { y: cloneStartOrEnd(value.y) } : {}),
    ...(value.m ? { m: cloneStartOrEnd(value.m) } : {}),
    ...(value.w ? { w: cloneStartOrEnd(value.w) } : {}),
    ...(value.d ? { d: cloneStartOrEnd(value.d) } : {}),
    ...(value.i ? { i: cloneStartOrEnd(value.i) } : {}),
    ...(value.wm ? { wm: value.wm } : {}),
    ...(typeof value.ws === 'number' ? { ws: value.ws } : {})
  };
}

export function getSideRef<VRT extends string>(
  value: TimeReference | undefined,
  field: TimeReferenceField,
  side: TimeReferenceSide
): BaseOrVagueReference<VRT, number> | undefined {
  if (!value) return undefined;
  const f = value[field];
  if (!f) return undefined;
  return f[side] as BaseOrVagueReference<VRT, number> | undefined;
}

export function setSideRef<VRT extends string>(
  value: TimeReference,
  field: TimeReferenceField,
  side: TimeReferenceSide,
  ref: BaseOrVagueReference<VRT, number> | undefined
): void {
  const existing = value[field];
  if (ref) {
    value[field] = {
      ...(existing || {}),
      [side]: ref
    } as StartOrEnd<VRT, number>;
  } else if (existing) {
    const { [side]: _, ...rest } = existing;
    if (Object.keys(rest).length > 0) {
      value[field] = rest as StartOrEnd<VRT, number>;
    } else {
      delete (value as any)[field];
    }
  }
}

export function isVague(ref: BaseOrVagueReference<string, number> | undefined): boolean {
  return ref?.type === 'vg';
}

export function isBase(ref: BaseOrVagueReference<string, number> | undefined): boolean {
  return ref?.type === 'ba';
}

export function isOffset(ref: BaseOrVagueReference<string, number> | undefined): boolean {
  return ref?.type === 'of';
}

export function refsEqual(
  a: BaseOrVagueReference<string, number> | undefined,
  b: BaseOrVagueReference<string, number> | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.type !== b.type) return false;
  if (a.type === 'ba') return a.v === (b as typeof a).v;
  if (a.type === 'vg') return a.t === (b as typeof a).t;
  if (a.type === 'of') return a.v === (b as typeof a).v && a.a === (b as typeof a).a;
  return false;
}

export function cleanupEmptyFields(value: TimeReference): TimeReference {
  for (const field of ['y', 'm', 'w', 'd', 'i'] as TimeReferenceField[]) {
    const f = value[field];
    if (f && !f.s && !f.e) {
      delete (value as any)[field];
    }
  }
  return value;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateTimeReferenceStructure(
  value: TimeReference | undefined,
  options: { allowOffsets?: boolean; requireStartDate?: boolean } = {}
): TimeReferenceValidationResult {
  const issues: TimeReferenceValidationIssue[] = [];
  const { allowOffsets = false, requireStartDate = true } = options;

  if (!value) {
    if (requireStartDate) {
      issues.push({ code: 'missing_start_date', message: 'A start date is required.' });
    }
    return { valid: issues.length === 0, issues };
  }

  // Missing start date check
  if (requireStartDate) {
    const hasStartDate = Boolean(value.y?.s || value.m?.s || value.w?.s || value.d?.s);
    if (!hasStartDate) {
      issues.push({ code: 'missing_start_date', message: 'A start date is required.' });
    }
  }

  // Unsupported offset references
  if (!allowOffsets) {
    for (const field of ['y', 'm', 'w', 'd', 'i'] as TimeReferenceField[]) {
      for (const side of ['s', 'e'] as TimeReferenceSide[]) {
        const ref = getSideRef(value, field, side);
        if (ref?.type === 'of') {
          issues.push({
            code: 'unsupported_reference',
            field,
            side,
            message: `Offset references are not supported in this editor.`
          });
        }
      }
    }
  }

  // Vague hierarchy rules per side
  for (const side of ['s', 'e'] as TimeReferenceSide[]) {
    const monthRef = getSideRef(value, 'm', side);
    const weekRef = getSideRef(value, 'w', side);
    const dayRef = getSideRef(value, 'd', side);
    const minuteRef = getSideRef(value, 'i', side);

    if (isVague(weekRef)) {
      issues.push({
        code: 'unsupported_reference',
        field: 'w',
        side,
        message: side === 's'
          ? 'Vague start week is no longer supported. Please clear or choose an exact week.'
          : 'Vague end week is no longer supported. Please clear or choose an exact week.'
      });
    }

    if (isVague(monthRef)) {
      if (isBase(weekRef) || isVague(weekRef)) {
        issues.push({
          code: 'vague_month_has_week',
          side,
          message: side === 's'
            ? 'Vague start month cannot have a week. Please clear the week first.'
            : 'Vague end month cannot have a week. Please clear the week first.'
        });
      }
      if (isBase(dayRef) || isVague(dayRef)) {
        issues.push({
          code: 'vague_month_has_day',
          side,
          message: side === 's'
            ? 'Vague start month cannot have a day. Please clear the day first.'
            : 'Vague end month cannot have a day. Please clear the day first.'
        });
      }
      if (isBase(minuteRef) || isVague(minuteRef)) {
        issues.push({
          code: 'vague_month_has_time',
          side,
          message: side === 's'
            ? 'Vague start month cannot have a time. Please clear the time first.'
            : 'Vague end month cannot have a time. Please clear the time first.'
        });
      }
    }

    if (isVague(dayRef) && (isBase(minuteRef) || isVague(minuteRef))) {
      issues.push({
        code: 'vague_day_has_time',
        side,
        message: side === 's'
          ? 'Vague start day cannot have a time. Please clear the time first.'
          : 'Vague end day cannot have a time. Please clear the time first.'
      });
    }
  }

  // End-before-start checks (only when deterministically comparable)
  const startYear = getSideRef(value, 'y', 's');
  const startMonth = getSideRef(value, 'm', 's');
  const startWeek = getSideRef(value, 'w', 's');
  const startDay = getSideRef(value, 'd', 's');
  const startMinute = getSideRef(value, 'i', 's');
  const endYear = getSideRef(value, 'y', 'e');;
  const endMonth = getSideRef(value, 'm', 'e');
  const endWeek = getSideRef(value, 'w', 'e');
  const endDay = getSideRef(value, 'd', 'e');
  const endMinute = getSideRef(value, 'i', 'e');

  // Build comparable values for base refs only
  function baValue(ref: BaseOrVagueReference<string, number> | undefined): number | null {
    return ref?.type === 'ba' ? ref.v : null;
  }

  const sy = baValue(startYear);
  const sm = baValue(startMonth);
  const sw = baValue(startWeek);
  const sd = baValue(startDay);
  const si = baValue(startMinute);
  const ey = baValue(endYear) ?? sy;
  const em = baValue(endMonth) ?? sm;
  const hasEndMinute = endMinute !== undefined;
  const ew = baValue(endWeek) ?? sw;
  const ed = baValue(endDay) ?? (hasEndMinute ? sd : null);
  const ei = baValue(endMinute);

  const comparable = extractDateWindow(value);
  if (comparable && (ed !== null || ew !== null || em !== null || ey !== null || endMinute !== undefined)) {
    const startTs = new Date(comparable.start).setHours(si !== null ? Math.floor(si / 60) : 0, si !== null ? si % 60 : 0, 0, 0);
    const endTs = new Date(comparable.end).setHours(ei !== null ? Math.floor(ei / 60) : 0, ei !== null ? ei % 60 : 0, 0, 0);
    if (endTs < startTs) {
      issues.push({
        code: 'end_before_start',
        message: 'End date/time cannot be before start date/time.'
      });
    }
  }

  return { valid: issues.length === 0, issues };
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function sanitizeVagueReferences(value: TimeReference): TimeReference {
  for (const side of ['s', 'e'] as TimeReferenceSide[]) {
    const monthRef = getSideRef(value, 'm', side);
    const weekRef = getSideRef(value, 'w', side);
    if (isVague(weekRef)) {
      setSideRef(value, 'w', side, undefined);
    }
    if (isVague(monthRef)) {
      if (weekRef) setSideRef(value, 'w', side, undefined);
      const dayRef = getSideRef(value, 'd', side);
      if (dayRef) setSideRef(value, 'd', side, undefined);
      const minuteRef = getSideRef(value, 'i', side);
      if (minuteRef) setSideRef(value, 'i', side, undefined);
    }
    const dayRef = getSideRef(value, 'd', side);
    if (isVague(dayRef)) {
      const minuteRef = getSideRef(value, 'i', side);
      if (minuteRef) setSideRef(value, 'i', side, undefined);
    }
  }
  return value;
}

function pruneInvalidEndReferences(value: TimeReference): TimeReference {
  // Remove end values that are structurally invalid (e.g. end before start)
  // This is already covered by validation, but we do a light cleanup here.
  const sy = getSideRef(value, 'y', 's');
  const sm = getSideRef(value, 'm', 's');
  const sw = getSideRef(value, 'w', 's');
  const sd = getSideRef(value, 'd', 's');
  const si = getSideRef(value, 'i', 's');
  const ey = getSideRef(value, 'y', 'e');
  const em = getSideRef(value, 'm', 'e');
  const ew = getSideRef(value, 'w', 'e');
  const ed = getSideRef(value, 'd', 'e');
  const ei = getSideRef(value, 'i', 'e');

  function baValue(ref: BaseOrVagueReference<string, number> | undefined): number | null {
    return ref?.type === 'ba' ? ref.v : null;
  }

  const syv = baValue(sy);
  const smv = baValue(sm);
  const swv = baValue(sw);
  const sdv = baValue(sd);
  const siv = baValue(si);
  const eyv = baValue(ey);
  const emv = baValue(em);
  const ewv = baValue(ew);
  const edv = baValue(ed);
  const eiv = baValue(ei);

  if (syv !== null && eyv !== null && eyv < syv) {
    setSideRef(value, 'y', 'e', undefined);
  }
  if (smv !== null && emv !== null && (eyv === syv || eyv === null) && emv < smv) {
    setSideRef(value, 'm', 'e', undefined);
  }
  if (swv !== null && ewv !== null && (eyv === syv || eyv === null) && (emv === smv || emv === null) && ewv < swv) {
    setSideRef(value, 'w', 'e', undefined);
  }
  if (sdv !== null && edv !== null && (eyv === syv || eyv === null) && (emv === smv || emv === null) && (ewv === swv || ewv === null) && edv < sdv) {
    setSideRef(value, 'd', 'e', undefined);
  }
  if (siv !== null && eiv !== null && (eyv === syv || eyv === null) && (emv === smv || emv === null) && (edv === sdv || edv === null) && eiv < siv) {
    setSideRef(value, 'i', 'e', undefined);
  }

  return value;
}

function trimImplicitEndReferences(value: TimeReference): TimeReference {
  for (const field of ['y', 'm', 'w', 'd', 'i'] as TimeReferenceField[]) {
    const startRef = getSideRef(value, field, 's');
    const endRef = getSideRef(value, field, 'e');
    if (refsEqual(startRef, endRef)) {
      setSideRef(value, field, 'e', undefined);
    }
  }
  return value;
}

export function normalizeTimeReference(
  value: TimeReference | undefined,
  options: NormalizeTimeReferenceOptions = {}
): TimeReference {
  const opts = {
    sanitizeVague: true,
    pruneInvalidEnd: true,
    trimImplicitEnds: true,
    ...options
  };

  let next = cloneTimeReference(value);

  if (opts.sanitizeVague) {
    next = sanitizeVagueReferences(next);
  }

  if (opts.pruneInvalidEnd) {
    next = pruneInvalidEndReferences(next);
  }

  if (opts.trimImplicitEnds) {
    next = trimImplicitEndReferences(next);
  }

  return cleanupEmptyFields(next);
}

export function hasAnyMinuteReference(value: TimeReference | undefined): boolean {
  return Boolean(value?.i?.s || value?.i?.e);
}

export function shouldTreatAsDateOnlyForPersistence(value: TimeReference | undefined): boolean {
  if (!value?.i?.s && !value?.i?.e) return true;
  const start = value.i?.s;
  const end = value.i?.e;
  return start?.type === 'ba' && start.v === 0 && end === undefined;
}

export function restoreVagueReferences(
  source: TimeReference | undefined,
  target: TimeReference | undefined
): TimeReference | undefined {
  if (!source || !target) return target;
  const next = cloneTimeReference(target);
  for (const key of ['y', 'm', 'w', 'd', 'i'] as TimeReferenceField[]) {
    const sourceField = source[key];
    if (!sourceField) continue;
    if (!next[key]) next[key] = {};
    if (sourceField.s?.type === 'vg') {
      next[key]!.s = cloneRef(sourceField.s);
    }
    if (sourceField.e?.type === 'vg') {
      next[key]!.e = cloneRef(sourceField.e);
    }
  }
  if (source.wm) next.wm = source.wm;
  if (typeof source.ws === 'number') next.ws = source.ws;
  return next;
}

export function normalizeDateInformationForPersistence(
  dateInfo: DateInformation,
  options: NormalizeDateInformationForPersistenceOptions = {}
): DateInformation {
  const output = options.output ?? 'preserve';
  const sourceValue = cloneTimeReference(dateInfo.value);
  const next = cloneDateInformation(dateInfo);

  if (output === 'preserve') {
    next.value = normalizeTimeReference(sourceValue, options.timeReference);
    return next;
  }

  const resolveNow = options.resolveNow ?? new Date();
  const resolveContext = options.resolveContext ?? {};
  const start = resolveStart(sourceValue, resolveNow, resolveContext);
  const end = resolveEnd(sourceValue, resolveNow, resolveContext);
  const explicitEnd = hasExplicitEnd(sourceValue);
  const dateOnly = options.dateOnly ?? !hasAnyMinuteReference(sourceValue);

  const rebuilt = output === 'relative'
    ? relativeTimeReference(
        start,
        explicitEnd ? end : null,
        options.relativeAnchor ?? resolveNow,
        options.relativeAnchorType ?? 'up'
      )
    : explicitTimeReference(start, explicitEnd ? end : null);

  if (dateOnly) {
    delete rebuilt.i;
  }

  next.value = normalizeTimeReference(
    restoreVagueReferences(sourceValue, rebuilt) ?? rebuilt,
    options.timeReference
  );
  if (dateOnly) {
    delete next.value.i;
  }
  return next;
}

// ---------------------------------------------------------------------------
// Predicates
// ---------------------------------------------------------------------------

export function hasExplicitEnd(value: TimeReference | undefined): boolean {
  if (!value) return false;
  return Boolean(value.y?.e || value.m?.e || value.w?.e || value.d?.e || value.i?.e);
}

export function hasExplicitStartDate(value: TimeReference | undefined): boolean {
  if (!value) return false;
  return Boolean(value.y?.s || value.m?.s || value.w?.s || value.d?.s);
}

export function hasExplicitStartTime(value: TimeReference | undefined): boolean {
  if (!value) return false;
  return Boolean(value.i?.s);
}

export function hasExplicitEndDate(value: TimeReference | undefined): boolean {
  if (!value) return false;
  return Boolean(value.y?.e || value.m?.e || value.w?.e || value.d?.e);
}

export function hasExplicitEndTime(value: TimeReference | undefined): boolean {
  if (!value) return false;
  return Boolean(value.i?.e);
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function monthName(m: number): string {
  return [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ][m - 1] ?? 'Unknown';
}

function formatMinute(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export function formatDateReferenceLabel(value: TimeReference | undefined, side: 'start' | 'end'): string {
  if (!value) return '';
  const s = side === 'start' ? 's' : 'e';
  const yr = value.y?.[s];
  const mo = value.m?.[s];
  const wk = value.w?.[s];
  const da = value.d?.[s];

  // For end side, fall back to start year/month/day when end is absent
  const fallbackYr = side === 'end' ? value.y?.s : undefined;
  const fallbackMo = side === 'end' ? value.m?.s : undefined;
  const fallbackWk = side === 'end' ? value.w?.s : undefined;
  const fallbackDa = side === 'end' ? value.d?.s : undefined;

  const yv = yr?.type === 'ba' ? yr.v : (fallbackYr?.type === 'ba' ? fallbackYr.v : null);
  const mv = mo?.type === 'ba' ? mo.v : (fallbackMo?.type === 'ba' ? fallbackMo.v : null);
  const wv = wk?.type === 'ba' ? wk.v : (fallbackWk?.type === 'ba' ? fallbackWk.v : null);
  const dv = da?.type === 'ba' ? da.v : (fallbackDa?.type === 'ba' ? fallbackDa.v : null);

  if (mo?.type === 'vg') {
    const info = VAGUE_MONTHS[mo.t as VagueMonthCode];
    if (info) return info.label + (yv !== null ? ` ${yv}` : '');
  }

  if (da?.type === 'vg') {
    const info = VAGUE_DAYS[da.t as VagueDayCode];
    if (info) {
      if (mv !== null) return `${monthName(mv)} ${info.label}${yv !== null ? `, ${yv}` : ''}`;
      return info.label;
    }
  }

  if (wv !== null) {
    const mode = weekModeFor(value);
    const modeLabel = mode === 'iso' ? 'ISO week' : mode === 'row' ? 'Week row' : 'Week';
    if (mv !== null && dv !== null) return `${monthName(mv)} ${modeLabel} ${wv}, day ${dv}${yv !== null ? `, ${yv}` : ''}`;
    if (mv !== null) return `${monthName(mv)} ${modeLabel} ${wv}${yv !== null ? `, ${yv}` : ''}`;
    if (dv !== null) return `${modeLabel} ${wv}, day ${dv}${yv !== null ? `, ${yv}` : ''}`;
    return `${modeLabel} ${wv}${yv !== null ? ` ${yv}` : ''}`;
  }

  if (yv !== null && mv !== null && dv !== null) {
    return `${monthName(mv)} ${dv}, ${yv}`;
  }
  if (mv !== null && dv !== null) {
    return `${monthName(mv)} ${dv}`;
  }
  if (yv !== null && mv !== null) {
    return `${monthName(mv)} ${yv}`;
  }
  if (yv !== null) {
    return String(yv);
  }

  return '';
}

export function formatTimeReferenceLabel(value: TimeReference | undefined, side: 'start' | 'end'): string {
  if (!value) return '';
  const s = side === 'start' ? 's' : 'e';
  const minuteRef = value.i?.[s];

  if (minuteRef?.type === 'vg') {
    const info = VAGUE_MINUTES[minuteRef.t as VagueMinuteCode];
    return info?.label ?? minuteRef.t;
  }

  if (minuteRef?.type === 'ba') {
    return formatMinute(minuteRef.v);
  }

  return '';
}

export function formatTimeReferenceRangeLabel(value: TimeReference | undefined): string {
  if (!value) return 'Scheduled';

  const hasEnd = hasExplicitEnd(value);
  const startDateLabel = formatDateReferenceLabel(value, 'start');
  const startTimeLabel = formatTimeReferenceLabel(value, 'start');
  const endDateLabel = formatDateReferenceLabel(value, 'end');
  const endTimeLabel = formatTimeReferenceLabel(value, 'end');

  // Helper to build a same-year range string like "May 13 – May 15, 2026"
  function formatDateRange(start: string, end: string): string {
    const startYearMatch = start.match(/, (\d{4})$/);
    const endYearMatch = end.match(/, (\d{4})$/);
    if (startYearMatch && endYearMatch && startYearMatch[1] === endYearMatch[1]) {
      const startWithoutYear = start.replace(/, \d{4}$/, '');
      return `${startWithoutYear} – ${end}`;
    }
    return `${start} – ${end}`;
  }

  // Date only (no time at all)
  if (!startTimeLabel && !endTimeLabel) {
    if (hasEnd && endDateLabel && endDateLabel !== startDateLabel) {
      return formatDateRange(startDateLabel, endDateLabel);
    }
    return startDateLabel || 'Scheduled';
  }

  // Same date with time range (no end date, or same date)
  if (!hasEnd || startDateLabel === endDateLabel || (!endDateLabel && endTimeLabel)) {
    if (startTimeLabel && endTimeLabel) {
      return `${startDateLabel} · ${startTimeLabel} – ${endTimeLabel}`;
    }
    if (startTimeLabel) {
      return `${startDateLabel} · ${startTimeLabel}`;
    }
    return startDateLabel || 'Scheduled';
  }

  // Multi-day with times
  if (startTimeLabel && endTimeLabel) {
    return `${startDateLabel} · ${startTimeLabel} – ${endDateLabel} · ${endTimeLabel}`;
  }

  // Multi-day without times (shouldn't happen here but handle)
  if (hasEnd && endDateLabel) {
    return formatDateRange(startDateLabel, endDateLabel);
  }

  return startDateLabel || 'Scheduled';
}

// ---------------------------------------------------------------------------
// DateInformation helpers
// ---------------------------------------------------------------------------

export function cloneDateInformation(
  value: DateInformation | null | undefined,
  fallbackDate?: Date
): DateInformation {
  if (value) {
    return {
      ...value,
      value: cloneTimeReference(value.value)
    };
  }
  if (fallbackDate) {
    return {
      value: {
        y: { s: { type: 'ba', v: fallbackDate.getFullYear() } },
        m: { s: { type: 'ba', v: fallbackDate.getMonth() + 1 } },
        d: { s: { type: 'ba', v: fallbackDate.getDate() } }
      },
      is_status: false,
      is: false,
      ds: 'mj',
      display_as: 'mj'
    };
  }
  return {
    value: {},
    is_status: false,
    is: false
  };
}

export function defaultCalendarDateInfo(date: Date): DateInformation {
  return {
    value: {
      y: { s: { type: 'ba', v: date.getFullYear() } },
      m: { s: { type: 'ba', v: date.getMonth() + 1 } },
      d: { s: { type: 'ba', v: date.getDate() } }
    },
    is_status: false,
    is: false,
    ds: 'mj',
    display_as: 'mj'
  };
}

export function applyDisplayFlags(
  dateInfo: DateInformation,
  session: { formIsStatus?: boolean; formIsMinor?: boolean }
): DateInformation {
  return {
    ...dateInfo,
    is_status: session.formIsStatus ?? dateInfo.is_status ?? false,
    is: session.formIsStatus ?? dateInfo.is ?? false,
    ds: session.formIsMinor ? 'mi' : 'mj',
    display_as: session.formIsMinor ? 'mi' : 'mj'
  };
}
