<script lang="ts">
  import { onMount } from 'svelte';
  import type { RangeCalendarGridData, RangeCalendarViewOptions } from './range-calendar-types.ts';
  import { RangeCalendarOutlineStyle } from './range-calendar-types.ts';
  import {
    MONTH_OUTLINE_STROKE_PX,
    inset_points_from_viewport_edges,
    dedup_polygon,
    round_polygon_svg,
    append_selectively_rounded_rect_path
  } from './svg-utils.ts';

  let props: {
    grid_data: RangeCalendarGridData[][];
    view_options: RangeCalendarViewOptions;
    viewing_date: { year: number; month: number; day?: number };
    cell_inset_y_ratio?: number;
    cell_offset_y_ratio?: number;
    z_index?: number;
  } = $props();

  let svg_width = $state(0);
  let svg_height = $state(0);
  let container_ref = $state<HTMLDivElement | null>(null);

  onMount(() => {
    if (!container_ref) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        svg_width = entry.contentRect.width;
        svg_height = entry.contentRect.height;
      }
    });
    observer.observe(container_ref);
    return () => observer.disconnect();
  });

  function get_in_month_cells(grid: RangeCalendarGridData[][], target_year: number, target_month: number) {
    return grid.map((row) =>
      row.map((cell) => {
        const isTarget = cell.date.getFullYear() === target_year && cell.date.getMonth() + 1 === target_month;
        const mask = props.view_options.grey_weekday_mask || 0;
        const isHidden = (mask & (1 << (cell.date.getDay() || 7))) !== 0;
        return isTarget && !isHidden;
      })
    );
  }

  let month_path = $derived.by(() => {
    const style = props.view_options.outline_style;
    if (style !== RangeCalendarOutlineStyle.Month && style !== RangeCalendarOutlineStyle.Year) return '';
    const rows = props.grid_data.length;
    if (rows === 0) return '';
    const cols = props.grid_data[0].length;
    if (cols === 0 || svg_width <= 0 || svg_height <= 0) return '';

    const in_month = get_in_month_cells(props.grid_data, props.viewing_date.year, props.viewing_date.month);
    const active_rows: Array<[number, number, number]> = [];
    for (let r = 0; r < rows; r++) {
      let first = -1;
      let last = -1;
      for (let c = 0; c < cols; c++) {
        if (in_month[r][c]) {
          if (first === -1) first = c;
          last = c;
        }
      }
      if (first !== -1) {
        active_rows.push([r, first, last]);
      }
    }

    if (active_rows.length === 0) return '';

    const cell_w = svg_width / cols;
    const cell_h = svg_height / rows;
    const inset_y = Math.max(0, (props.cell_inset_y_ratio ?? 0) * cell_h);
    const offset_y = (props.cell_offset_y_ratio ?? 0) * cell_h;
    const points: Array<[number, number]> = [];

    const [first_row, first_left, first_right] = active_rows[0];
    points.push([first_left * cell_w, first_row * cell_h + inset_y + offset_y]);
    points.push([(first_right + 1) * cell_w, first_row * cell_h + inset_y + offset_y]);

    for (let i = 0; i < active_rows.length; i++) {
      const [row, _left, right] = active_rows[i];
      const right_x = (right + 1) * cell_w;
      const top_y = row * cell_h + inset_y + offset_y;
      const bot_y = (row + 1) * cell_h - inset_y + offset_y;

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
    const bot_y = (last_row + 1) * cell_h - inset_y + offset_y;
    points.push([last_left * cell_w, bot_y]);

    for (let i = active_rows.length - 1; i >= 0; i--) {
      const [row, left] = active_rows[i];
      const left_x = left * cell_w;
      const top_y = row * cell_h + inset_y + offset_y;
      const bot = (row + 1) * cell_h - inset_y + offset_y;

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

    dedup_polygon(points);
    if (points.length < 3) return '';
    inset_points_from_viewport_edges(points, svg_width, svg_height, MONTH_OUTLINE_STROKE_PX / 2.0);
    return round_polygon_svg(points, 8.0);
  });

  let cell_path = $derived.by(() => {
    if (!props.view_options.show_cell_outline) return '';
    const rows = props.grid_data.length;
    if (rows === 0) return '';
    const cols = props.grid_data[0].length;
    if (cols === 0 || svg_width <= 0 || svg_height <= 0) return '';

    const in_month = get_in_month_cells(props.grid_data, props.viewing_date.year, props.viewing_date.month);
    let has_any = false;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (in_month[r][c]) has_any = true;
      }
    }
    if (!has_any) return '';

    const cell_w = svg_width / cols;
    const cell_h = svg_height / rows;
    let d = '';

    const is_in_month = (r: number, c: number) => {
      if (r < 0 || c < 0 || r >= rows || c >= cols) return false;
      return in_month[r][c];
    };

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!in_month[r][c]) continue;
        const x1 = c * cell_w;
        const y1 = r * cell_h;
        const x2 = x1 + cell_w;
        const y2 = y1 + cell_h;
        const rtl = !is_in_month(r - 1, c) && !is_in_month(r, c - 1);
        const rtr = !is_in_month(r - 1, c) && !is_in_month(r, c + 1);
        const rbr = !is_in_month(r + 1, c) && !is_in_month(r, c + 1);
        const rbl = !is_in_month(r + 1, c) && !is_in_month(r, c - 1);
        d += append_selectively_rounded_rect_path(x1, y1, x2, y2, 8.0, rtl, rtr, rbr, rbl) + ' ';
      }
    }
    return d;
  });
</script>

<div bind:this={container_ref} class="pointer-events-none absolute inset-0" style={`z-index: ${props.z_index ?? 0};`}>
  <svg class="size-full" viewBox={`0 0 ${svg_width} ${svg_height}`} preserveAspectRatio="none" aria-hidden="true">
    {#if month_path}
      <path d={month_path} fill="none" stroke="var(--color-border)" stroke-width={MONTH_OUTLINE_STROKE_PX} />
    {/if}
    {#if cell_path}
      <path d={cell_path} fill="none" stroke="color-mix(in srgb, var(--color-border), transparent 28%)" stroke-width="1" />
    {/if}
  </svg>
</div>
