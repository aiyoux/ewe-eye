export type DateRangeValue = {
  start: Date | null;
  end: Date | null;
};

export type DateRangeSelection =
  | 'none'
  | 'single'
  | 'start'
  | 'end'
  | 'in-range'
  | 'preview'
  | 'preview-start'
  | 'preview-end';

export function sameDay(left: Date | null | undefined, right: Date | null | undefined) {
  if (!left || !right) return false;
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function normalizeRange(start: Date, end: Date): DateRangeValue {
  const left = stripTime(start);
  const right = stripTime(end);
  return left.getTime() <= right.getTime()
    ? { start: left, end: right }
    : { start: right, end: left };
}

export function stripTime(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function getDtf(locale: string): Intl.DateTimeFormat {
  const resolvedLocale = locale === 'default' ? 'en-US' : locale;
  let dtf = dtfCache.get(resolvedLocale);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat(resolvedLocale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    dtfCache.set(resolvedLocale, dtf);
  }
  return dtf;
}

export function formatRangeLabel(range: DateRangeValue, locale = 'default') {
  if (!range.start) return 'Pick a date range';
  const dtf = getDtf(locale);
  if (!range.end || sameDay(range.start, range.end)) {
    return dtf.format(range.start);
  }
  // Intl formatRange natively returns en-dash separators (often with thin spaces),
  // keeping the native formatting behavior is cleaner!
  return dtf.formatRange(range.start, range.end);
}
