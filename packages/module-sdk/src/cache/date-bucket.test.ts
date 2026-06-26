// Pin the timezone BEFORE importing anything that constructs Dates, so the
// UTC+10 day-boundary assertions below are deterministic on any CI machine.
// Brisbane is UTC+10 year-round (no DST), matching the app's primary user.
process.env.TZ = 'Australia/Brisbane';

import { describe, it, expect } from 'vitest';
import { date_to_local_bucket, date_to_bucket_key } from './types.ts';

describe('date_to_local_bucket (UTC+10 day-boundary consistency)', () => {
  it('buckets a UTC instant by the LOCAL calendar day, not UTC', () => {
    // 2026-07-04T14:00:00Z is 2026-07-05 00:00 local (UTC+10) → next day's bucket.
    expect(date_to_local_bucket(new Date('2026-07-04T14:00:00Z'))).toBe('2026-07-05');
    // 2026-07-04T13:59:00Z is 2026-07-04 23:59 local → still the same day.
    expect(date_to_local_bucket(new Date('2026-07-04T13:59:00Z'))).toBe('2026-07-04');
  });

  it('pads month/day and matches date_to_bucket_key for the local components', () => {
    const d = new Date('2026-01-05T03:00:00Z'); // local 2026-01-05 13:00
    expect(date_to_local_bucket(d)).toBe('2026-01-05');
    expect(date_to_local_bucket(d)).toBe(
      date_to_bucket_key(d.getFullYear(), d.getMonth() + 1, d.getDate())
    );
  });

  it('is the single source the hydrator and reconciler share (no divergence)', () => {
    // Both CalendarPage.to_bucket / sync_item_to_buckets and PlannerPage.toBucket
    // now delegate here, so a midnight-crossing instant lands in exactly one
    // bucket via every path. This test pins the contract those callers rely on.
    const midnightCrossing = new Date('2026-12-31T14:30:00Z'); // local 2027-01-01 00:30
    expect(date_to_local_bucket(midnightCrossing)).toBe('2027-01-01');
  });
});
