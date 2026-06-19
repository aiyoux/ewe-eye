import { describe, expect, it } from 'vitest';
import {
  buildQuickAddDateTimePreset,
  dateRangeReference,
  exactDateTimeReference,
  quarterForMonth,
  rowWeekReference,
  sameOrNextWeekday,
  vagueMonthReference,
  vagueRef
} from './quick-add-date-time.ts';

describe('quick-add date/time presets', () => {
  const now = new Date(2026, 4, 13, 9, 0);

  it('builds a vague morning preset for today', () => {
    expect(buildQuickAddDateTimePreset('today-morning', { now })).toEqual(
      exactDateTimeReference(now, vagueRef('mo'))
    );
  });

  it('builds tomorrow afternoon without mutating the source date', () => {
    const result = buildQuickAddDateTimePreset('tomorrow-afternoon', { now });
    expect(result.d?.s).toEqual({ type: 'ba', v: 14 });
    expect(result.i?.s).toEqual({ type: 'vg', t: 'af' });
    expect(now.getDate()).toBe(13);
  });

  it('builds the coming weekend as a date range', () => {
    const saturday = new Date(2026, 4, 16, 9, 0);
    const sunday = new Date(2026, 4, 17, 9, 0);
    expect(buildQuickAddDateTimePreset('weekend', { now })).toEqual(dateRangeReference(saturday, sunday));
  });

  it('builds next week as a stored calendar-row week even when today is Monday', () => {
    const monday = new Date(2026, 4, 18, 9, 0);
    const result = buildQuickAddDateTimePreset('next-week', { now: monday });
    expect(result).toEqual(rowWeekReference(new Date(2026, 4, 25, 9, 0), 1));
  });

  it('maps months to quarter vague month codes', () => {
    expect(quarterForMonth(1)).toBe('q1');
    expect(quarterForMonth(6)).toBe('q2');
    expect(quarterForMonth(9)).toBe('q3');
    expect(quarterForMonth(12)).toBe('q4');
  });

  it('builds vague month presets without lower date fields', () => {
    expect(buildQuickAddDateTimePreset('this-quarter', { now })).toEqual(vagueMonthReference(2026, 'q2'));
    expect(buildQuickAddDateTimePreset('second-half', { now })).toEqual(vagueMonthReference(2026, 'sh'));
  });

  it('finds the same or next weekday', () => {
    expect(sameOrNextWeekday(now, 3).getDate()).toBe(13);
    expect(sameOrNextWeekday(now, 6).getDate()).toBe(16);
  });
});
