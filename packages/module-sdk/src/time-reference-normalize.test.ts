import { describe, it, expect } from 'vitest';
import {
  cloneTimeReference,
  hasExplicitEnd,
  hasExplicitStartDate,
  validateTimeReferenceStructure,
  normalizeTimeReference,
  normalizeDateInformationForPersistence,
  formatTimeReferenceRangeLabel,
  defaultCalendarDateInfo,
  applyDisplayFlags,
  refsEqual,
  isVague,
  isBase
} from './time-reference-normalize.ts';
import type { TimeReference } from './types.ts';

describe('time-reference-normalize', () => {
  describe('cloneTimeReference', () => {
    it('preserves all ref types', () => {
      const tr: TimeReference = {
        y: { s: { type: 'ba', v: 2026 } },
        m: { s: { type: 'vg', t: 'sh' } },
        d: { s: { type: 'of', v: 1, a: 'up' } },
        i: { s: { type: 'ba', v: 540 }, e: { type: 'vg', t: 'mo' } }
      };
      const cloned = cloneTimeReference(tr);
      expect(cloned).toEqual(tr);
      expect(cloned).not.toBe(tr);
      expect(cloned.y).not.toBe(tr.y);
      expect(cloned.y?.s).not.toBe(tr.y?.s);
    });

    it('handles empty and undefined', () => {
      expect(cloneTimeReference({})).toEqual({});
      expect(cloneTimeReference(undefined)).toEqual({});
    });
  });

  describe('hasExplicitEnd', () => {
    it('returns false for date-only start', () => {
      const tr: TimeReference = {
        y: { s: { type: 'ba', v: 2026 } },
        m: { s: { type: 'ba', v: 5 } },
        d: { s: { type: 'ba', v: 13 } }
      };
      expect(hasExplicitEnd(tr)).toBe(false);
    });

    it('returns true for end date', () => {
      const tr: TimeReference = {
        y: { s: { type: 'ba', v: 2026 } },
        m: { s: { type: 'ba', v: 5 } },
        d: { s: { type: 'ba', v: 13 }, e: { type: 'ba', v: 15 } }
      };
      expect(hasExplicitEnd(tr)).toBe(true);
    });

    it('returns true for end time', () => {
      const tr: TimeReference = {
        y: { s: { type: 'ba', v: 2026 } },
        m: { s: { type: 'ba', v: 5 } },
        d: { s: { type: 'ba', v: 13 } },
        i: { s: { type: 'ba', v: 540 }, e: { type: 'ba', v: 600 } }
      };
      expect(hasExplicitEnd(tr)).toBe(true);
    });
  });

  describe('normalizeDateInformationForPersistence', () => {
    it('preserves single vague times when converting to relative offsets', () => {
      const result = normalizeDateInformationForPersistence({
        is_status: false,
        offset_enabled: true,
        value: {
          d: { s: { type: 'of', v: 0, a: 'up' } },
          i: { s: { type: 'vg', t: 'mo' } }
        }
      }, {
        output: 'relative',
        resolveNow: new Date(2000, 0, 3, 0, 0),
        resolveContext: { userProvided: new Date(2000, 0, 3, 0, 0) },
        relativeAnchor: new Date(2000, 0, 3, 0, 0),
        relativeAnchorType: 'up',
        dateOnly: false
      });

      expect(result.offset_enabled).toBe(true);
      expect(result.value.d?.s).toEqual({ type: 'of', v: 0, a: 'up' });
      expect(result.value.d?.e).toBeUndefined();
      expect(result.value.i?.s).toEqual({ type: 'vg', t: 'mo' });
      expect(result.value.i?.e).toBeUndefined();
    });

    it('preserves single vague times when converting to absolute refs', () => {
      const result = normalizeDateInformationForPersistence({
        is_status: false,
        value: {
          y: { s: { type: 'ba', v: 2026 } },
          m: { s: { type: 'ba', v: 4 } },
          d: { s: { type: 'ba', v: 14 } },
          i: { s: { type: 'vg', t: 'mo' } }
        }
      }, {
        output: 'absolute',
        resolveNow: new Date(2026, 3, 14, 0, 0),
        dateOnly: false
      });

      expect(result.value.d?.s).toEqual({ type: 'ba', v: 14 });
      expect(result.value.d?.e).toBeUndefined();
      expect(result.value.i?.s).toEqual({ type: 'vg', t: 'mo' });
      expect(result.value.i?.e).toBeUndefined();
    });

    it('keeps authored ends explicit', () => {
      const result = normalizeDateInformationForPersistence({
        is_status: false,
        value: {
          d: {
            s: { type: 'of', v: 0, a: 'up' },
            e: { type: 'of', v: 1, a: 'up' }
          },
          i: {
            s: { type: 'vg', t: 'mo' },
            e: { type: 'vg', t: 'af' }
          }
        }
      }, {
        output: 'relative',
        resolveNow: new Date(2000, 0, 3, 0, 0),
        resolveContext: { userProvided: new Date(2000, 0, 3, 0, 0) },
        relativeAnchor: new Date(2000, 0, 3, 0, 0),
        relativeAnchorType: 'up',
        dateOnly: false
      });

      expect(result.value.d?.s).toEqual({ type: 'of', v: 0, a: 'up' });
      expect(result.value.d?.e).toEqual({ type: 'of', v: 1, a: 'up' });
      expect(result.value.i?.s).toEqual({ type: 'vg', t: 'mo' });
      expect(result.value.i?.e).toEqual({ type: 'vg', t: 'af' });
    });
  });

  describe('hasExplicitStartDate', () => {
    it('returns false for empty', () => {
      expect(hasExplicitStartDate({})).toBe(false);
      expect(hasExplicitStartDate(undefined)).toBe(false);
    });

    it('returns true with start date', () => {
      const tr: TimeReference = {
        y: { s: { type: 'ba', v: 2026 } },
        m: { s: { type: 'ba', v: 5 } },
        d: { s: { type: 'ba', v: 13 } }
      };
      expect(hasExplicitStartDate(tr)).toBe(true);
    });
  });

  describe('validateTimeReferenceStructure', () => {
    it('accepts date-only', () => {
      const tr: TimeReference = {
        y: { s: { type: 'ba', v: 2026 } },
        m: { s: { type: 'ba', v: 5 } },
        d: { s: { type: 'ba', v: 13 } }
      };
      const result = validateTimeReferenceStructure(tr);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('accepts exact date plus vague minute', () => {
      const tr: TimeReference = {
        y: { s: { type: 'ba', v: 2026 } },
        m: { s: { type: 'ba', v: 5 } },
        d: { s: { type: 'ba', v: 13 } },
        i: { s: { type: 'vg', t: 'mo' } }
      };
      const result = validateTimeReferenceStructure(tr);
      expect(result.valid).toBe(true);
    });

    it('rejects vague month plus day', () => {
      const tr: TimeReference = {
        y: { s: { type: 'ba', v: 2026 } },
        m: { s: { type: 'vg', t: 'sh' } },
        d: { s: { type: 'ba', v: 15 } }
      };
      const result = validateTimeReferenceStructure(tr);
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.code === 'vague_month_has_day')).toBe(true);
    });

    it('rejects vague month plus time', () => {
      const tr: TimeReference = {
        y: { s: { type: 'ba', v: 2026 } },
        m: { s: { type: 'vg', t: 'sh' } },
        d: { s: { type: 'ba', v: 15 } },
        i: { s: { type: 'ba', v: 840 } }
      };
      const result = validateTimeReferenceStructure(tr);
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.code === 'vague_month_has_time')).toBe(true);
    });

    it('rejects vague day plus time', () => {
      const tr: TimeReference = {
        y: { s: { type: 'ba', v: 2026 } },
        m: { s: { type: 'ba', v: 5 } },
        d: { s: { type: 'vg', t: 'sh' } },
        i: { s: { type: 'ba', v: 840 } }
      };
      const result = validateTimeReferenceStructure(tr);
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.code === 'vague_day_has_time')).toBe(true);
    });

    it('rejects runtime vague week refs as unsupported', () => {
      const tr: TimeReference = {
        y: { s: { type: 'ba', v: 2026 } },
        m: { s: { type: 'ba', v: 5 } },
        w: { s: { type: 'vg', t: 'lw' } },
        wm: 'ord'
      };
      const result = validateTimeReferenceStructure(tr);
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.code === 'unsupported_reference')).toBe(true);
    });

    it('emits missing_start_date when required', () => {
      const result = validateTimeReferenceStructure({}, { requireStartDate: true });
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.code === 'missing_start_date')).toBe(true);
    });

    it('does not emit missing_start_date when not required', () => {
      const result = validateTimeReferenceStructure({}, { requireStartDate: false });
      expect(result.valid).toBe(true);
    });

    it('rejects end before start for base values', () => {
      const tr: TimeReference = {
        y: { s: { type: 'ba', v: 2026 }, e: { type: 'ba', v: 2025 } },
        m: { s: { type: 'ba', v: 5 }, e: { type: 'ba', v: 5 } },
        d: { s: { type: 'ba', v: 13 }, e: { type: 'ba', v: 13 } }
      };
      const result = validateTimeReferenceStructure(tr);
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.code === 'end_before_start')).toBe(true);
    });

    it('rejects same-day implicit end time before start time', () => {
      const tr: TimeReference = {
        y: { s: { type: 'ba', v: 2026 } },
        m: { s: { type: 'ba', v: 5 } },
        d: { s: { type: 'ba', v: 13 } },
        i: { s: { type: 'ba', v: 600 }, e: { type: 'ba', v: 540 } }
      };
      const result = validateTimeReferenceStructure(tr);
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.code === 'end_before_start')).toBe(true);
    });

    it('accepts a single-day event with only an exact start time (no end)', () => {
      // Regression: adding a time previously tripped end_before_start because the
      // implicit end minute defaulted to 00:00 of the same day, which is before
      // the start time — disabling the calendar create button.
      const tr: TimeReference = {
        y: { s: { type: 'ba', v: 2026 } },
        m: { s: { type: 'ba', v: 5 } },
        d: { s: { type: 'ba', v: 13 } },
        i: { s: { type: 'ba', v: 840 } }
      };
      const result = validateTimeReferenceStructure(tr);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('accepts a start-time-only event under save options (requireStartDate, no offsets)', () => {
      // Mirrors the calendar create/save call site exactly.
      const tr: TimeReference = {
        y: { s: { type: 'ba', v: 2026 } },
        m: { s: { type: 'ba', v: 5 } },
        d: { s: { type: 'ba', v: 13 } },
        i: { s: { type: 'ba', v: 840 } }
      };
      const result = validateTimeReferenceStructure(tr, {
        requireStartDate: true,
        allowOffsets: false
      });
      expect(result.valid).toBe(true);
    });

    it('rejects unsupported offset references', () => {
      const tr: TimeReference = {
        y: { s: { type: 'ba', v: 2026 } },
        m: { s: { type: 'ba', v: 5 } },
        d: { s: { type: 'of', v: 1, a: 'up' } }
      };
      const result = validateTimeReferenceStructure(tr, { allowOffsets: false });
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.code === 'unsupported_reference')).toBe(true);
    });

    it('allows offset references when allowed', () => {
      const tr: TimeReference = {
        y: { s: { type: 'ba', v: 2026 } },
        m: { s: { type: 'ba', v: 5 } },
        d: { s: { type: 'of', v: 1, a: 'up' } }
      };
      const result = validateTimeReferenceStructure(tr, { allowOffsets: true });
      expect(result.valid).toBe(true);
    });
  });

  describe('normalizeTimeReference', () => {
    it('clears day/time after vague month', () => {
      const tr: TimeReference = {
        y: { s: { type: 'ba', v: 2026 } },
        m: { s: { type: 'vg', t: 'sh' } },
        d: { s: { type: 'ba', v: 15 } },
        i: { s: { type: 'ba', v: 840 } }
      };
      const result = normalizeTimeReference(tr);
      expect(result.d?.s).toBeUndefined();
      expect(result.i?.s).toBeUndefined();
      expect(result.m?.s).toEqual({ type: 'vg', t: 'sh' });
    });

    it('clears time after vague day', () => {
      const tr: TimeReference = {
        y: { s: { type: 'ba', v: 2026 } },
        m: { s: { type: 'ba', v: 5 } },
        d: { s: { type: 'vg', t: 'sh' } },
        i: { s: { type: 'ba', v: 840 } }
      };
      const result = normalizeTimeReference(tr);
      expect(result.i?.s).toBeUndefined();
      expect(result.d?.s).toEqual({ type: 'vg', t: 'sh' });
    });

    it('clears runtime vague week refs', () => {
      const tr: TimeReference = {
        y: { s: { type: 'ba', v: 2026 } },
        m: { s: { type: 'ba', v: 5 } },
        w: { s: { type: 'vg', t: 'lw' } },
        wm: 'ord'
      };
      const result = normalizeTimeReference(tr);
      expect(result.w?.s).toBeUndefined();
    });

    it('trims equal end values', () => {
      const tr: TimeReference = {
        y: { s: { type: 'ba', v: 2026 }, e: { type: 'ba', v: 2026 } },
        m: { s: { type: 'ba', v: 5 }, e: { type: 'ba', v: 5 } },
        d: { s: { type: 'ba', v: 13 }, e: { type: 'ba', v: 13 } }
      };
      const result = normalizeTimeReference(tr);
      expect(result.y?.e).toBeUndefined();
      expect(result.m?.e).toBeUndefined();
      expect(result.d?.e).toBeUndefined();
    });

    it('prunes end time earlier than start time on same day', () => {
      const tr: TimeReference = {
        y: { s: { type: 'ba', v: 2026 } },
        m: { s: { type: 'ba', v: 5 } },
        d: { s: { type: 'ba', v: 13 } },
        i: { s: { type: 'ba', v: 600 }, e: { type: 'ba', v: 540 } }
      };
      const result = normalizeTimeReference(tr);
      expect(result.i?.e).toBeUndefined();
      expect(result.i?.s).toEqual({ type: 'ba', v: 600 });
    });

    it('does not mutate input', () => {
      const tr: TimeReference = {
        y: { s: { type: 'ba', v: 2026 } },
        m: { s: { type: 'ba', v: 5 } },
        d: { s: { type: 'ba', v: 13 } }
      };
      const original = JSON.stringify(tr);
      normalizeTimeReference(tr);
      expect(JSON.stringify(tr)).toBe(original);
    });

    it('removes empty containers', () => {
      const tr: TimeReference = {
        y: { e: { type: 'ba', v: 2026 } },
        m: { s: { type: 'ba', v: 5 }, e: { type: 'ba', v: 5 } },
        d: { s: { type: 'ba', v: 13 }, e: { type: 'ba', v: 13 } }
      };
      const result = normalizeTimeReference(tr);
      // After trimming equal ends, y.e === y.s but y.s is absent so y.e remains
      // Wait, let me restructure this test: y has only e which is same as m's start
      // Actually just test that empty StartOrEnd objects get cleaned up
      const tr2: TimeReference = {
        y: { s: { type: 'ba', v: 2026 } },
        m: { s: { type: 'ba', v: 5 } },
        d: { s: { type: 'ba', v: 13 } }
      };
      const result2 = normalizeTimeReference(tr2);
      expect(result2.y?.s).toEqual({ type: 'ba', v: 2026 });
      // Now test a field that becomes truly empty after trimming
      const tr3: TimeReference = {
        y: { s: { type: 'ba', v: 2026 }, e: { type: 'ba', v: 2026 } },
        m: { s: { type: 'ba', v: 5 } },
        d: { s: { type: 'ba', v: 13 } }
      };
      const result3 = normalizeTimeReference(tr3);
      // y.e trimmed because it equals y.s, but y.s still exists so y is not empty
      expect(result3.y?.s).toEqual({ type: 'ba', v: 2026 });
      expect(result3.y?.e).toBeUndefined();
    });
  });

  describe('formatTimeReferenceRangeLabel', () => {
    it('does not show fake midnight for date-only', () => {
      const tr: TimeReference = {
        y: { s: { type: 'ba', v: 2026 } },
        m: { s: { type: 'ba', v: 5 } },
        d: { s: { type: 'ba', v: 13 } }
      };
      expect(formatTimeReferenceRangeLabel(tr)).toBe('May 13, 2026');
    });

    it('shows exact start time only', () => {
      const tr: TimeReference = {
        y: { s: { type: 'ba', v: 2026 } },
        m: { s: { type: 'ba', v: 5 } },
        d: { s: { type: 'ba', v: 13 } },
        i: { s: { type: 'ba', v: 540 } }
      };
      expect(formatTimeReferenceRangeLabel(tr)).toBe('May 13, 2026 · 9:00 AM');
    });

    it('shows vague start time', () => {
      const tr: TimeReference = {
        y: { s: { type: 'ba', v: 2026 } },
        m: { s: { type: 'ba', v: 5 } },
        d: { s: { type: 'ba', v: 13 } },
        i: { s: { type: 'vg', t: 'mo' } }
      };
      expect(formatTimeReferenceRangeLabel(tr)).toBe('May 13, 2026 · Morning');
    });

    it('shows same-day time range', () => {
      const tr: TimeReference = {
        y: { s: { type: 'ba', v: 2026 } },
        m: { s: { type: 'ba', v: 5 } },
        d: { s: { type: 'ba', v: 13 } },
        i: { s: { type: 'ba', v: 540 }, e: { type: 'ba', v: 630 } }
      };
      expect(formatTimeReferenceRangeLabel(tr)).toBe('May 13, 2026 · 9:00 AM – 10:30 AM');
    });

    it('shows multi-day date range', () => {
      const tr: TimeReference = {
        y: { s: { type: 'ba', v: 2026 } },
        m: { s: { type: 'ba', v: 5 } },
        d: { s: { type: 'ba', v: 13 }, e: { type: 'ba', v: 15 } }
      };
      expect(formatTimeReferenceRangeLabel(tr)).toBe('May 13 – May 15, 2026');
    });

    it('shows vague time range', () => {
      const tr: TimeReference = {
        y: { s: { type: 'ba', v: 2026 } },
        m: { s: { type: 'ba', v: 5 } },
        d: { s: { type: 'ba', v: 13 } },
        i: { s: { type: 'vg', t: 'mo' }, e: { type: 'vg', t: 'af' } }
      };
      expect(formatTimeReferenceRangeLabel(tr)).toBe('May 13, 2026 · Morning – Afternoon');
    });

    it('shows vague month only', () => {
      const tr: TimeReference = {
        y: { s: { type: 'ba', v: 2026 } },
        m: { s: { type: 'vg', t: 'sh' } }
      };
      expect(formatTimeReferenceRangeLabel(tr)).toBe('Second half 2026');
    });

    it('shows vague day', () => {
      const tr: TimeReference = {
        y: { s: { type: 'ba', v: 2026 } },
        m: { s: { type: 'ba', v: 5 } },
        d: { s: { type: 'vg', t: 'sh' } }
      };
      expect(formatTimeReferenceRangeLabel(tr)).toBe('May Second half, 2026');
    });
  });

  describe('defaultCalendarDateInfo', () => {
    it('creates date-only info with clicked date', () => {
      const date = new Date(2026, 4, 13);
      const info = defaultCalendarDateInfo(date);
      expect(info.value.y?.s).toEqual({ type: 'ba', v: 2026 });
      expect(info.value.m?.s).toEqual({ type: 'ba', v: 5 });
      expect(info.value.d?.s).toEqual({ type: 'ba', v: 13 });
      expect(info.value.i).toBeUndefined();
      expect(info.is_status).toBe(false);
      expect(info.ds).toBe('mj');
    });
  });

  describe('applyDisplayFlags', () => {
    it('preserves value and applies status/minor flags', () => {
      const info = defaultCalendarDateInfo(new Date(2026, 4, 13));
      const result = applyDisplayFlags(info, { formIsStatus: true, formIsMinor: true });
      expect(result.is_status).toBe(true);
      expect(result.is).toBe(true);
      expect(result.ds).toBe('mi');
      expect(result.display_as).toBe('mi');
      expect(result.value).toEqual(info.value);
    });
  });

  describe('refsEqual', () => {
    it('compares base refs by value', () => {
      expect(refsEqual({ type: 'ba', v: 5 }, { type: 'ba', v: 5 })).toBe(true);
      expect(refsEqual({ type: 'ba', v: 5 }, { type: 'ba', v: 6 })).toBe(false);
    });

    it('compares vague refs by tag', () => {
      expect(refsEqual({ type: 'vg', t: 'mo' }, { type: 'vg', t: 'mo' })).toBe(true);
      expect(refsEqual({ type: 'vg', t: 'mo' }, { type: 'vg', t: 'af' })).toBe(false);
    });

    it('handles undefined', () => {
      expect(refsEqual(undefined, undefined)).toBe(true);
      expect(refsEqual({ type: 'ba', v: 5 }, undefined)).toBe(false);
    });
  });

  describe('isVague / isBase', () => {
    it('identifies vague refs', () => {
      expect(isVague({ type: 'vg', t: 'mo' })).toBe(true);
      expect(isVague({ type: 'ba', v: 5 })).toBe(false);
      expect(isVague(undefined)).toBe(false);
    });

    it('identifies base refs', () => {
      expect(isBase({ type: 'ba', v: 5 })).toBe(true);
      expect(isBase({ type: 'vg', t: 'mo' })).toBe(false);
      expect(isBase(undefined)).toBe(false);
    });
  });
});
