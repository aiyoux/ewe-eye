import type { DateRangeSelection } from './date-range.ts';
import { sameDay, stripTime } from './date-range.ts';

export function monthKey(date: { year: number; month: number }) {
  return `${date.year}-${String(date.month).padStart(2, '0')}`;
}

export function monthLabel(date: { year: number; month: number }) {
  return new Date(date.year, date.month - 1, 1).toLocaleString('default', {
    month: 'long',
    year: 'numeric'
  });
}

export function addMonths(date: { year: number; month: number }, delta: number) {
  const next = new Date(date.year, date.month - 1 + delta, 1);
  return { year: next.getFullYear(), month: next.getMonth() + 1, day: 1 };
}

export function startOfWeek(date: Date, firstDayOfWeek: number) {
  const next = new Date(date);
  const distance = (next.getDay() - firstDayOfWeek + 7) % 7;
  next.setDate(next.getDate() - distance);
  return stripTime(next);
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return stripTime(next);
}

export function monthForDate(date: Date) {
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: 1 };
}

export function infiniteTotalRows(
  visible_rows: number,
  bufferRows: number | undefined,
  windowRows: number | undefined,
  windowMultiplier: number
) {
  if (typeof bufferRows === 'number' && Number.isFinite(bufferRows)) {
    const hiddenRowsPerSide = Math.max(2, Math.floor(bufferRows));
    return visible_rows + hiddenRowsPerSide * 2;
  }
  if (typeof windowRows === 'number' && Number.isFinite(windowRows)) {
    return Math.max(visible_rows + 4, Math.floor(windowRows));
  }
  return Math.ceil(visible_rows * Math.max(2, windowMultiplier));
}

export function infiniteBufferRows(
  visible_rows: number,
  bufferRows: number | undefined,
  windowRows: number | undefined,
  windowMultiplier: number
) {
  return Math.max(1, Math.floor((infiniteTotalRows(visible_rows, bufferRows, windowRows, windowMultiplier) - visible_rows) / 2));
}

export function monthBufferedGridOrigin(
  anchor: { year: number; month: number },
  firstDayOfWeek: number,
  visible_rows: number,
  bufferRows: number | undefined,
  windowRows: number | undefined,
  windowMultiplier: number
) {
  const buffer = infiniteBufferRows(visible_rows, bufferRows, windowRows, windowMultiplier);
  const monthStart = new Date(anchor.year, anchor.month - 1, 1);
  const firstVisibleWeek = startOfWeek(monthStart, firstDayOfWeek);
  firstVisibleWeek.setDate(firstVisibleWeek.getDate() - buffer * 7);
  return stripTime(firstVisibleWeek);
}

export function logicalCenterRow(
  visible_rows: number,
  bufferRows: number | undefined,
  windowRows: number | undefined,
  windowMultiplier: number
) {
  return Math.floor(infiniteTotalRows(visible_rows, bufferRows, windowRows, windowMultiplier) / 2);
}

export function recenterThresholdRows(
  visible_rows: number,
  bufferRows: number | undefined,
  windowRows: number | undefined,
  windowMultiplier: number
) {
  return Math.max(2, Math.floor(infiniteBufferRows(visible_rows, bufferRows, windowRows, windowMultiplier) / 2));
}

export function buildInfiniteGridSetup(
  origin: Date,
  anchorRow: number,
  visible_rows: number,
  bufferRows: number | undefined,
  windowRows: number | undefined,
  windowMultiplier: number
) {
  const totalRows = infiniteTotalRows(visible_rows, bufferRows, windowRows, windowMultiplier);
  const firstVisibleWeek = addDays(origin, anchorRow * 7);
  return {
    first_day_of_grid: firstVisibleWeek,
    days_in_grid: totalRows * 7
  };
}

export function computeSelectionOutlinePath<T extends { date: Date }>(
  grid_data: T[][],
  selectionForDate: (date: Date) => DateRangeSelection,
  simpleCellMode: boolean
): string {
  if (simpleCellMode) return '';
  const rows = grid_data.length;
  if (rows === 0) return '';
  const cols = grid_data[0].length;
  if (cols === 0) return '';

  const in_selection = grid_data.map((row) =>
    row.map((cell) => {
      const selection = selectionForDate(cell.date);
      return selection !== 'none' && selection !== 'single';
    })
  );

  const active_rows: Array<[number, number, number]> = [];
  for (let r = 0; r < rows; r++) {
    let first = -1;
    let last = -1;
    for (let c = 0; c < cols; c++) {
      if (in_selection[r][c]) {
        if (first === -1) first = c;
        last = c;
      }
    }
    if (first !== -1) {
      active_rows.push([r, first, last]);
    }
  }

  if (active_rows.length === 0) return '';

  const cell_w = 100;
  const cell_h = 100;
  const points: Array<[number, number]> = [];

  const [first_row, first_left, first_right] = active_rows[0];
  points.push([first_left * cell_w, first_row * cell_h]);
  points.push([(first_right + 1) * cell_w, first_row * cell_h]);

  for (let i = 0; i < active_rows.length; i++) {
    const [row, _left, right] = active_rows[i];
    const right_x = (right + 1) * cell_w;
    const top_y = row * cell_h;
    const bot_y = (row + 1) * cell_h;

    if (i > 0) {
      const [, , prev_right] = active_rows[i - 1];
      const prev_right_x = (prev_right + 1) * cell_w;
      if (Math.abs(right_x - prev_right_x) > 0.001) {
        points.push([prev_right_x, top_y]);
        points.push([right_x, top_y]);
      }
    }
    points.push([right_x, bot_y]);
  }

  const [last_row, last_left] = active_rows[active_rows.length - 1];
  const bot_y = (last_row + 1) * cell_h;
  points.push([last_left * cell_w, bot_y]);

  for (let i = active_rows.length - 1; i >= 0; i--) {
    const [row, left] = active_rows[i];
    const left_x = left * cell_w;
    const top_y = row * cell_h;
    const bot = (row + 1) * cell_h;

    if (i < active_rows.length - 1) {
      const [, next_left] = active_rows[i + 1];
      const next_left_x = next_left * cell_w;
      if (Math.abs(left_x - next_left_x) > 0.001) {
        points.push([next_left_x, bot]);
        points.push([left_x, bot]);
      }
    }
    points.push([left_x, top_y]);
  }

  // Dedup adjacent identical points
  const EPS = 0.001;
  for (let i = points.length - 1; i > 0; i--) {
    const a = points[i];
    const b = points[i - 1];
    if (Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS) {
      points.splice(i, 1);
    }
  }
  if (points.length >= 2) {
    const first = points[0];
    const last = points[points.length - 1];
    if (Math.abs(first[0] - last[0]) < EPS && Math.abs(first[1] - last[1]) < EPS) {
      points.pop();
    }
  }

  if (points.length < 3) return '';

  // Inset from grid boundary to avoid clipping
  const strokeWidth = 2;
  const halfStroke = strokeWidth / 2;
  const maxX = 700;
  const maxY = rows * 100;

  const adjustedPoints = points.map(([x, y]) => {
    let nx = x;
    let ny = y;
    if (x === 0) nx = halfStroke;
    else if (x === maxX) nx = maxX - halfStroke;
    if (y === 0) ny = halfStroke;
    else if (y === maxY) ny = maxY - halfStroke;
    return [nx, ny];
  });

  let path = '';
  for (let i = 0; i < adjustedPoints.length; i++) {
    const [x, y] = adjustedPoints[i];
    path += (i === 0 ? 'M' : 'L') + ` ${x} ${y}`;
  }
  path += ' Z';
  return path;
}

export interface RowBandSegment {
  key: string;
  row: number;
  start_col: number;
  span: number;
  preview: boolean;
  shape: 'full' | 'left' | 'right' | 'middle';
}

export function computeSimpleRowBands<T extends { date: Date }>(
  grid_data: T[][],
  selectionForDate: (date: Date) => DateRangeSelection,
  simpleCellMode: boolean
): RowBandSegment[] {
  if (!simpleCellMode) return [];

  const isBandActive = (selection: DateRangeSelection) => {
    return (
      selection === 'start' ||
      selection === 'end' ||
      selection === 'in-range' ||
      selection === 'preview-start' ||
      selection === 'preview-end' ||
      selection === 'preview'
    );
  };

  const segments: RowBandSegment[] = [];

  for (let rowIdx = 0; rowIdx < grid_data.length; rowIdx++) {
    const row = grid_data[rowIdx];
    let currentStart: number | null = null;
    let currentPreview = false;

    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      const selection = selectionForDate(row[colIdx].date);
      const active = isBandActive(selection);
      const preview = selection === 'preview' || selection === 'preview-start' || selection === 'preview-end';

      if (active && currentStart === null) {
        currentStart = colIdx;
        currentPreview = preview;
        continue;
      }

      if (active && currentStart !== null) {
        currentPreview = currentPreview || preview;
        continue;
      }

      if (!active && currentStart !== null) {
        const startCol = currentStart;
        const endCol = colIdx - 1;
        const startDate = row[startCol].date;
        const endDate = row[endCol].date;
        const continuedFromPrev = isBandActive(selectionForDate(addDays(startDate, -1)));
        const continuedToNext = isBandActive(selectionForDate(addDays(endDate, 1)));
        const shape =
          !continuedFromPrev && !continuedToNext
            ? 'full'
            : !continuedFromPrev && continuedToNext
              ? 'left'
              : continuedFromPrev && !continuedToNext
                ? 'right'
                : 'middle';

        segments.push({
          key: `${startDate.getTime()}-${endDate.getTime()}-${currentPreview ? 'p' : 'n'}-${shape}`,
          row: rowIdx,
          start_col: startCol,
          span: endCol - startCol + 1,
          preview: currentPreview,
          shape
        });
        currentStart = null;
        currentPreview = false;
      }
    }

    if (currentStart !== null) {
      const startCol = currentStart;
      const endCol = row.length - 1;
      const startDate = row[startCol].date;
      const endDate = row[endCol].date;
      const continuedFromPrev = isBandActive(selectionForDate(addDays(startDate, -1)));
      const continuedToNext = isBandActive(selectionForDate(addDays(endDate, 1)));
      const shape =
        !continuedFromPrev && !continuedToNext
          ? 'full'
          : !continuedFromPrev && continuedToNext
            ? 'left'
            : continuedFromPrev && !continuedToNext
              ? 'right'
              : 'middle';

      segments.push({
        key: `${startDate.getTime()}-${endDate.getTime()}-${currentPreview ? 'p' : 'n'}-${shape}`,
        row: rowIdx,
        start_col: startCol,
        span: endCol - startCol + 1,
        preview: currentPreview,
        shape
      });
    }
  }

  return segments;
}
