export const OVERLAY_SVG_PAD_PX = 4.0;
export const MONTH_OUTLINE_STROKE_PX = 1.5;

export function overlay_view_box(width: number, height: number): string {
  if (width <= 0.0 || height <= 0.0) {
    return '0 0 100 100';
  }
  return `0 0 ${width.toFixed(1)} ${height.toFixed(1)}`;
}

export function inset_points_from_viewport_edges(
  points: Array<[number, number]>,
  width: number,
  height: number,
  inset: number
) {
  const EPS = 0.001;

  if (width <= 0.0 || height <= 0.0 || inset <= 0.0) {
    return;
  }

  const inset_x = Math.min(inset, width / 2.0);
  const inset_y = Math.min(inset, height / 2.0);

  for (let i = 0; i < points.length; i++) {
    let [x, y] = points[i];

    if (Math.abs(x) <= EPS) {
      x = inset_x;
    } else if (Math.abs(x - width) <= EPS) {
      x = width - inset_x;
    }

    if (Math.abs(y) <= EPS) {
      y = inset_y;
    } else if (Math.abs(y - height) <= EPS) {
      y = height - inset_y;
    }

    points[i] = [x, y];
  }
}

export function dedup_polygon(points: Array<[number, number]>) {
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

  let changed = true;
  while (changed && points.length >= 3) {
    changed = false;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const prev = points[(i + n - 1) % n];
      const curr = points[i];
      const next = points[(i + 1) % n];
      const collinear_vert = Math.abs(prev[0] - curr[0]) <= EPS && Math.abs(curr[0] - next[0]) <= EPS;
      const collinear_horz = Math.abs(prev[1] - curr[1]) <= EPS && Math.abs(curr[1] - next[1]) <= EPS;
      if (collinear_vert || collinear_horz) {
        points.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
}

export function round_polygon_svg(points: Array<[number, number]>, radius: number): string {
  const EPS = 0.001;

  if (points.length < 3 || radius <= EPS) {
    let d = '';
    for (let i = 0; i < points.length; i++) {
      const [x, y] = points[i];
      if (i === 0) {
        d += `M ${x.toFixed(3)} ${y.toFixed(3)}`;
      } else {
        d += ` L ${x.toFixed(3)} ${y.toFixed(3)}`;
      }
    }
    d += ' Z';
    return d;
  }

  const n = points.length;
  const edge_len: number[] = [];
  const edge_unit: Array<[number, number]> = [];

  for (let i = 0; i < n; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % n];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy);
    edge_len.push(len);
    if (len > EPS) {
      edge_unit.push([dx / len, dy / len]);
    } else {
      edge_unit.push([0.0, 0.0]);
    }
  }

  const t: number[] = [];
  for (let i = 0; i < n; i++) {
    const len_in = edge_len[(i + n - 1) % n];
    const len_out = edge_len[i];
    const ti = Math.min(radius, len_in / 2.0, len_out / 2.0);
    t.push(ti > EPS ? ti : 0.0);
  }

  for (let i = 0; i < n; i++) {
    const l = edge_len[i];
    if (l <= EPS) {
      t[i] = 0.0;
      t[(i + 1) % n] = 0.0;
      continue;
    }
    const a = t[i];
    const b = t[(i + 1) % n];
    const sum = a + b;
    if (sum > l) {
      const s = l / sum;
      t[i] *= s;
      t[(i + 1) % n] *= s;
    }
  }

  let d = '';
  let started = false;

  for (let i = 0; i < n; i++) {
    const [cx, cy] = points[i];
    const [u_in_x, u_in_y] = edge_unit[(i + n - 1) % n];
    const [u_out_x, u_out_y] = edge_unit[i];
    const ti = t[i];

    if (
      ti <= EPS ||
      (Math.abs(u_in_x) <= EPS && Math.abs(u_in_y) <= EPS) ||
      (Math.abs(u_out_x) <= EPS && Math.abs(u_out_y) <= EPS)
    ) {
      if (!started) {
        d += `M ${cx.toFixed(3)} ${cy.toFixed(3)}`;
        started = true;
      } else {
        d += ` L ${cx.toFixed(3)} ${cy.toFixed(3)}`;
      }
      continue;
    }

    const p_in_x = cx - u_in_x * ti;
    const p_in_y = cy - u_in_y * ti;
    const p_out_x = cx + u_out_x * ti;
    const p_out_y = cy + u_out_y * ti;

    if (!started) {
      d += `M ${p_in_x.toFixed(3)} ${p_in_y.toFixed(3)}`;
      started = true;
    } else {
      d += ` L ${p_in_x.toFixed(3)} ${p_in_y.toFixed(3)}`;
    }

    const cross = u_in_x * u_out_y - u_in_y * u_out_x;
    if (Math.abs(cross) <= EPS) {
      d += ` L ${p_out_x.toFixed(3)} ${p_out_y.toFixed(3)}`;
      continue;
    }

    const sweep_flag = cross > 0.0 ? 1 : 0;
    d += ` A ${ti.toFixed(3)} ${ti.toFixed(3)} 0 0 ${sweep_flag} ${p_out_x.toFixed(3)} ${p_out_y.toFixed(3)}`;
  }

  d += ' Z';
  return d;
}

export function append_selectively_rounded_rect_path(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  radius: number,
  round_top_left: boolean,
  round_top_right: boolean,
  round_bottom_right: boolean,
  round_bottom_left: boolean
): string {
  const EPS = 0.001;

  const width = Math.max(x2 - x1, 0.0);
  const height = Math.max(y2 - y1, 0.0);
  if (width <= EPS || height <= EPS) {
    return '';
  }

  const base_r = Math.max(Math.min(radius, width / 2.0, height / 2.0), 0.0);
  const rtl = round_top_left ? base_r : 0.0;
  const rtr = round_top_right ? base_r : 0.0;
  const rbr = round_bottom_right ? base_r : 0.0;
  const rbl = round_bottom_left ? base_r : 0.0;

  let d = '';

  d += `M ${(x1 + rtl).toFixed(3)} ${y1.toFixed(3)}`;
  d += ` L ${(x2 - rtr).toFixed(3)} ${y1.toFixed(3)}`;
  if (rtr > EPS) {
    d += ` A ${rtr.toFixed(3)} ${rtr.toFixed(3)} 0 0 1 ${x2.toFixed(3)} ${(y1 + rtr).toFixed(3)}`;
  }

  d += ` L ${x2.toFixed(3)} ${(y2 - rbr).toFixed(3)}`;
  if (rbr > EPS) {
    d += ` A ${rbr.toFixed(3)} ${rbr.toFixed(3)} 0 0 1 ${(x2 - rbr).toFixed(3)} ${y2.toFixed(3)}`;
  }

  d += ` L ${(x1 + rbl).toFixed(3)} ${y2.toFixed(3)}`;
  if (rbl > EPS) {
    d += ` A ${rbl.toFixed(3)} ${rbl.toFixed(3)} 0 0 1 ${x1.toFixed(3)} ${(y2 - rbl).toFixed(3)}`;
  }

  d += ` L ${x1.toFixed(3)} ${(y1 + rtl).toFixed(3)}`;
  if (rtl > EPS) {
    d += ` A ${rtl.toFixed(3)} ${rtl.toFixed(3)} 0 0 1 ${(x1 + rtl).toFixed(3)} ${y1.toFixed(3)}`;
  }

  d += ' Z';
  return d;
}
