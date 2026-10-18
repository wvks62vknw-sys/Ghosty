/**
 * A floor plan from a photo of a drawn or printed plan (pure, unit-tested in
 * apps/edge/test/measure.test.mjs): walls, rooms, doors and windows found in the picture, the
 * scale read from the written dimensions, the result a Room JSON v2 plan for the SPACE PLANNER.
 *
 * How, step by step (the browser part — straightening the page, reading the text — is in
 * features/space/fromphoto.ts):
 * 1. WALLS are the thick dark strokes. Every dark pixel gets its stroke width (the shorter of its
 *    horizontal and vertical dark runs); the commonest width among long strokes is the wall
 *    thickness, and walls are the strokes at least about that thick. Text, furniture symbols,
 *    door arcs and dimension lines are thin, so they drop out.
 * 2. STRAIGHT: the plan is turned (±15°) until the walls line up with the picture's edges.
 * 3. ROOMS are the enclosed white areas once the walls are thickened enough to close the door
 *    gaps; each becomes a polygon of straight, square edges (`spanPolygon`), then is grown back by
 *    the thickening so its edges sit on the walls' inner faces. Two rooms either side of one wall
 *    meet on the wall's middle line, the way the planner builds a shared wall once.
 * 4. SCALE from the written sizes (`parseDims`): "4.20 x 3.60 m" inside a room is matched to that
 *    room's width and depth (whichever way round agrees best), a single length to the nearest wall
 *    parallel to it; the median of every match wins and the spread says how sure it is.
 * 5. OPENINGS along each wall's middle: a gap with nothing drawn is a door (60–130 cm), a gap with
 *    only thin lines across it is a window (40 cm – 3 m).
 */
import { otsu } from '../scan/page';
import { DEFAULTS, LIMITS, edgeOf, pointInPoly, type Opening, type Pt, type RoomShape } from '../../../../packages/shared/src/design';
import { readPlan, type Plan } from './plan';

// ---------------------------------------------------------------- written sizes

/** One written size, millimetres: a single length, or a pair "width × depth" as written. */
export interface Dim {
  a: number;
  b?: number;
  text: string;
}

const UNIT = String.raw`(?:mm|cm|m(?:etres?|eters?)?)`;
const FTIN = String.raw`(\d{1,2})\s*(?:'|’|′|ft|feet)\s*-?\s*(?:(\d{1,2}(?:\.\d)?)\s*(?:"|”|″|''|in(?:ch(?:es)?)?)?)?`;
const METRIC = String.raw`(\d{1,5}(?:[.,]\d{1,3})?)\s*(${UNIT})?`;

/** A metric number with its unit (or a guess at it: plans write bare millimetres, or metres with a decimal point). */
function metricMm(num: string, unit: string | undefined): number | null {
  const n = Number(num.replace(',', '.'));
  if (!(n > 0)) return null;
  const u = (unit ?? '').toLowerCase();
  if (u === 'mm') return n;
  if (u === 'cm') return n * 10;
  if (u.startsWith('m')) return n * 1000;
  // bare: 3.60 → metres, 3600 → mm, 360 → cm (a room side of 3.6 m), 36 → nothing sensible
  if (/[.,]/.test(num)) return n < 40 ? n * 1000 : null;
  if (n >= 1000 && n <= 40000) return n;
  if (n >= 100 && n < 1000) return n * 10;
  return null;
}

const ftInMm = (ft: string, inch: string | undefined) => (Number(ft) * 12 + Number(inch ?? 0)) * 25.4;

/** Room-sized lengths only: 30 cm to 40 m. */
const sane = (mm: number | null): mm is number => mm != null && mm >= 300 && mm <= 40000;

/**
 * The sizes written in a line of plan text: "4.20 x 3.60m", "4200 × 3600", "13'9\" x 11'10\"",
 * "3.6 m", "12' 6\"", "360cm" (a pair's unit can be written once at the end). Metric first;
 * imperial pairs too ("Kitchen 13'9" x 11'10" (4.19 x 3.61 m)" gives both). Room names and other
 * words give nothing.
 */
export function parseDims(text: string): Dim[] {
  const t = text.replace(/[×X✕*]/g, 'x').replace(/\s+/g, ' ');
  const out: Dim[] = [];
  const used: [number, number][] = [];
  const free = (i: number, j: number) => !used.some(([a, b]) => i < b && j > a);
  const take = (m: RegExpMatchArray, d: Dim | null) => {
    if (!d) return;
    const i = m.index ?? 0;
    if (!free(i, i + m[0].length)) return;
    used.push([i, i + m[0].length]);
    out.push(d);
  };
  for (const m of t.matchAll(new RegExp(`${FTIN}\\s*x\\s*${FTIN}`, 'gi'))) {
    const a = ftInMm(m[1]!, m[2]);
    const b = ftInMm(m[3]!, m[4]);
    take(m, sane(a) && sane(b) ? { a, b, text: m[0].trim() } : null);
  }
  for (const m of t.matchAll(new RegExp(`${METRIC}\\s*x\\s*${METRIC}`, 'gi'))) {
    const unit = m[2] ?? m[4];
    const a = metricMm(m[1]!, m[2] ?? unit);
    const b = metricMm(m[3]!, m[4] ?? unit);
    take(m, sane(a) && sane(b) ? { a, b, text: m[0].trim() } : null);
  }
  for (const m of t.matchAll(new RegExp(FTIN, 'gi'))) {
    const a = ftInMm(m[1]!, m[2]);
    take(m, sane(a) ? { a, text: m[0].trim() } : null);
  }
  for (const m of t.matchAll(new RegExp(`(?<![\\d.,])${METRIC}(?![\\d])`, 'gi'))) {
    // a bare number counts only on its own (a line that is just "3600"), never inside a sentence
    if (!m[2] && t.trim() !== m[0].trim()) continue;
    const a = metricMm(m[1]!, m[2]);
    take(m, sane(a) ? { a, text: m[0].trim() } : null);
  }
  return out;
}

// ---------------------------------------------------------------- walls

export interface Gray {
  w: number;
  h: number;
  /** 0 (black) – 255 (white). */
  g: Uint8Array;
}

/**
 * Dark pixels (1) by Otsu's threshold, a little toward dark so grey shading stays light; with
 * `faint`, anything clearly darker than the paper (thin lines drawn lightly or blurred by the photo).
 */
export function darkMask(img: Gray, faint = false): Uint8Array {
  // (on a clean black-and-white drawing Otsu's level is 0: black itself)
  const o = Math.min(otsu(img.g), 200);
  let t = o * 0.92 + 1;
  if (faint) {
    const sorted = Uint8Array.from(img.g).sort();
    const paper = sorted[Math.floor(sorted.length * 0.9)]!;
    t = Math.max(t, o + 0.7 * (paper - o));
  }
  const m = new Uint8Array(img.w * img.h);
  for (let i = 0; i < m.length; i++) m[i] = img.g[i]! < t ? 1 : 0;
  return m;
}

/** For every dark pixel, the length of its horizontal and of its vertical dark run. */
export function runs(mask: Uint8Array, w: number, h: number): { hr: Uint16Array; vr: Uint16Array } {
  const hr = new Uint16Array(w * h);
  const vr = new Uint16Array(w * h);
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      if (!mask[y * w + x]) {
        x++;
        continue;
      }
      let e = x;
      while (e < w && mask[y * w + e]) e++;
      for (let k = x; k < e; k++) hr[y * w + k] = Math.min(65535, e - x);
      x = e;
    }
  }
  for (let x = 0; x < w; x++) {
    let y = 0;
    while (y < h) {
      if (!mask[y * w + x]) {
        y++;
        continue;
      }
      let e = y;
      while (e < h && mask[e * w + x]) e++;
      for (let k = y; k < e; k++) vr[k * w + x] = Math.min(65535, e - y);
      y = e;
    }
  }
  return { hr, vr };
}

/**
 * The wall thickness in pixels: the commonest stroke width (3 px or more) among strokes at least
 * eight times longer than wide. Null when there are no such strokes (not a plan).
 */
export function wallThickness(mask: Uint8Array, w: number, h: number, r = runs(mask, w, h)): number | null {
  const hist = new Array<number>(80).fill(0);
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const a = Math.min(r.hr[i]!, r.vr[i]!);
    const b = Math.max(r.hr[i]!, r.vr[i]!);
    if (a >= 3 && a < 80 && b >= 8 * a && b >= 24) hist[a]!++;
  }
  // a stroke of width t gives runs of about t (and t ± 1 at slanted edges): smooth, then the peak
  let best = 0;
  let at = 0;
  for (let t = 3; t < 79; t++) {
    const s = hist[t - 1]! * 0.5 + hist[t]! + hist[t + 1]! * 0.5;
    if (s > best) {
      best = s;
      at = t;
    }
  }
  return best >= 40 ? at : null;
}

/**
 * The wall pixels: what is left of the dark strokes after an "opening" with a square about
 * 0.6 × the wall thickness across (shrink, then grow back) — thin lines, text and the corners
 * where thin lines meet vanish, solid walls stay — and only strokes a couple of thicknesses long.
 */
export function wallMask(mask: Uint8Array, w: number, h: number, t: number, r = runs(mask, w, h)): Uint8Array {
  const k = Math.max(1, Math.floor(t * 0.3));
  const open = dilate(erode(mask, w, h, k), w, h, k);
  const out = new Uint8Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = open[i]! && mask[i]! && Math.max(r.hr[i]!, r.vr[i]!) >= 2 * t ? 1 : 0;
  return out;
}

/** The mask shrunk by `r` pixels (a square): what stays is at least 2r + 1 wide both ways. */
export function erode(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const inv = new Uint8Array(w * h);
  for (let i = 0; i < inv.length; i++) inv[i] = mask[i] ? 0 : 1;
  const grown = dilate(inv, w, h, r);
  // outside the picture counts as empty
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < r || y < r || x >= w - r || y >= h - r) grown[y * w + x] = 1;
  for (let i = 0; i < grown.length; i++) grown[i] = grown[i] ? 0 : 1;
  return grown;
}

/**
 * The turn (degrees, −15…15) that lines the walls up with the picture's edges: the angle at which
 * the wall pixels' row and column counts are most peaked.
 */
export function wallAngle(walls: Uint8Array, w: number, h: number): number {
  const pts: number[] = [];
  const step = Math.max(1, Math.round(Math.sqrt((w * h) / 400_000)));
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) if (walls[y * w + x]) pts.push(x - w / 2, y - h / 2);
  if (pts.length < 40) return 0;
  const n = Math.ceil(Math.hypot(w, h)) + 2;
  const score = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const rows = new Float64Array(n);
    const cols = new Float64Array(n);
    for (let i = 0; i < pts.length; i += 2) {
      const x = pts[i]! * c - pts[i + 1]! * s;
      const y = pts[i]! * s + pts[i + 1]! * c;
      cols[Math.round(x + n / 2)]!++;
      rows[Math.round(y + n / 2)]!++;
    }
    let q = 0;
    for (let i = 0; i < n; i++) q += rows[i]! ** 2 + cols[i]! ** 2;
    return q;
  };
  let best = 0;
  let bestQ = -1;
  for (let d = -15; d <= 15; d += 0.5) {
    const q = score(d);
    if (q > bestQ) {
      bestQ = q;
      best = d;
    }
  }
  // refine
  for (let d = best - 0.4; d <= best + 0.4; d += 0.1) {
    const q = score(d);
    if (q > bestQ) {
      bestQ = q;
      best = d;
    }
  }
  return Math.round(best * 10) / 10;
}

/** The picture turned by `deg` about its centre (bilinear; white outside). */
export function rotateGray(img: Gray, deg: number): Gray {
  if (!deg) return img;
  const a = (-deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const { w, h } = img;
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - w / 2;
      const dy = y - h / 2;
      const sx = dx * c - dy * s + w / 2;
      const sy = dx * s + dy * c + h / 2;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      if (x0 < 0 || y0 < 0 || x0 >= w - 1 || y0 >= h - 1) {
        out[y * w + x] = 255;
        continue;
      }
      const fx = sx - x0;
      const fy = sy - y0;
      const p = (xx: number, yy: number) => img.g[yy * w + xx]!;
      out[y * w + x] = (p(x0, y0) * (1 - fx) + p(x0 + 1, y0) * fx) * (1 - fy) + (p(x0, y0 + 1) * (1 - fx) + p(x0 + 1, y0 + 1) * fx) * fy;
    }
  }
  return { w, h, g: out };
}

/** The mask grown by `r` pixels (a square: two passes of a running maximum). */
export function dilate(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let last = -1e9;
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) last = x;
      if (x - last <= r) tmp[y * w + x] = 1;
    }
    last = 1e9;
    for (let x = w - 1; x >= 0; x--) {
      if (mask[y * w + x]) last = x;
      if (last - x <= r) tmp[y * w + x] = 1;
    }
  }
  for (let x = 0; x < w; x++) {
    let last = -1e9;
    for (let y = 0; y < h; y++) {
      if (tmp[y * w + x]) last = y;
      if (y - last <= r) out[y * w + x] = 1;
    }
    last = 1e9;
    for (let y = h - 1; y >= 0; y--) {
      if (tmp[y * w + x]) last = y;
      if (last - y <= r) out[y * w + x] = 1;
    }
  }
  return out;
}

/**
 * Windows drawn into a wall: the wall stops and thin glazing lines carry on across the gap. For
 * the rooms to close, those spans count as wall: a thin dark run that goes from the end of one
 * wall straight to the start of another running the same way (each end's wall at least two
 * thicknesses long that way), at most `30 × t` long. A kitchen worktop's line runs from wall to
 * wall too, but across them, so it is not mistaken for one.
 */
export function bridgeWindows(dark: Uint8Array, walls: Uint8Array, w: number, h: number, t: number, r: { hr: Uint16Array; vr: Uint16Array }): Uint8Array {
  const out = new Uint8Array(w * h);
  const maxGap = 30 * t;
  const along = (i: number, horizontal: boolean) => (horizontal ? r.hr[i]! : r.vr[i]!);
  for (const horizontal of [true, false]) {
    const outer = horizontal ? h : w;
    const inner = horizontal ? w : h;
    const idx = (o: number, k: number) => (horizontal ? o * w + k : k * w + o);
    for (let o = 0; o < outer; o++) {
      let k = 0;
      while (k < inner) {
        // the end of a wall run that runs this way
        if (!walls[idx(o, k)] || k + 1 >= inner || walls[idx(o, k + 1)] || !dark[idx(o, k + 1)] || along(idx(o, k), horizontal) < 2 * t) {
          k++;
          continue;
        }
        let e = k + 1;
        while (e < inner && dark[idx(o, e)] && !walls[idx(o, e)] && e - k <= maxGap) e++;
        if (e < inner && walls[idx(o, e)] && along(idx(o, e), horizontal) >= 2 * t && e - k > 1) {
          for (let q = k + 1; q < e; q++) out[idx(o, q)] = 1;
        }
        k = e;
      }
    }
  }
  // a glazing line is thin: thicken the bridge to the wall's thickness so it closes like a wall
  return dilate(out, w, h, Math.ceil(t / 2));
}

// ---------------------------------------------------------------- rooms

/** The free areas (0 in `blocked`) as numbered patches; 0 = blocked, -1 = touches the picture's edge (outside). */
export function patches(blocked: Uint8Array, w: number, h: number): { label: Int32Array; sizes: number[] } {
  const label = new Int32Array(w * h);
  const sizes: number[] = [0];
  let next = 1;
  const stack: number[] = [];
  for (let i = 0; i < label.length; i++) {
    if (blocked[i] || label[i]) continue;
    const id = next++;
    let n = 0;
    let edge = false;
    stack.push(i);
    label[i] = id;
    while (stack.length) {
      const j = stack.pop()!;
      n++;
      const x = j % w;
      const y = (j - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
      if (x > 0 && !blocked[j - 1] && !label[j - 1]) (label[j - 1] = id), stack.push(j - 1);
      if (x < w - 1 && !blocked[j + 1] && !label[j + 1]) (label[j + 1] = id), stack.push(j + 1);
      if (y > 0 && !blocked[j - w] && !label[j - w]) (label[j - w] = id), stack.push(j - w);
      if (y < h - 1 && !blocked[j + w] && !label[j + w]) (label[j + w] = id), stack.push(j + w);
    }
    sizes.push(edge ? -n : n);
  }
  return { label, sizes };
}

/**
 * A patch as a polygon of square corners (pixels, clockwise on screen, x right / y down): the
 * patch's span on every row, its left and right sides each simplified to straight runs (a change
 * of less than `tol` px is noise), joined up. Exact for rectangles, L-, T- and other shapes whose
 * every row and column is one span; a U-shape comes out with its notch filled.
 */
export function spanPolygon(label: Int32Array, w: number, h: number, id: number, tol: number): Pt[] | null {
  const rows: { y: number; l: number; r: number }[] = [];
  for (let y = 0; y < h; y++) {
    let l = -1;
    let r = -1;
    for (let x = 0; x < w; x++) {
      if (label[y * w + x] === id) {
        if (l < 0) l = x;
        r = x + 1;
      }
    }
    if (l >= 0) rows.push({ y, l, r });
  }
  if (rows.length < 2) return null;
  /** One side as steps: [y0, y1, x] runs where x stays within tol of the run's median. */
  const side = (get: (r: { l: number; r: number }) => number) => {
    const out: { y0: number; y1: number; x: number }[] = [];
    let start = 0;
    const median = (a: number, b: number) => {
      const xs = rows.slice(a, b).map(get).sort((p, q) => p - q);
      return xs[xs.length >> 1]!;
    };
    for (let i = 1; i <= rows.length; i++) {
      const x = i < rows.length ? get(rows[i]!) : NaN;
      const m = median(start, i);
      if (i === rows.length || Math.abs(x - m) > tol) {
        out.push({ y0: rows[start]!.y, y1: rows[i - 1]!.y + 1, x: m });
        start = i;
      }
    }
    // runs shorter than tol are noise: merge them into the longer neighbour
    for (let k = 0; k < out.length && out.length > 1; ) {
      const s = out[k]!;
      if (s.y1 - s.y0 < tol) {
        const prev = out[k - 1];
        const nxt = out[k + 1];
        const into = !prev ? nxt! : !nxt ? prev : prev.y1 - prev.y0 >= nxt.y1 - nxt.y0 ? prev : nxt;
        into.y0 = Math.min(into.y0, s.y0);
        into.y1 = Math.max(into.y1, s.y1);
        out.splice(k, 1);
        k = Math.max(0, k - 1);
      } else k++;
    }
    // neighbours that ended up level join
    for (let k = 1; k < out.length; ) {
      if (Math.abs(out[k]!.x - out[k - 1]!.x) <= tol) {
        const a = out[k - 1]!;
        const b = out[k]!;
        a.x = (a.x * (a.y1 - a.y0) + b.x * (b.y1 - b.y0)) / (b.y1 - a.y0);
        a.y1 = b.y1;
        out.splice(k, 1);
      } else k++;
    }
    return out;
  };
  const right = side((r) => r.r);
  const left = side((r) => r.l);
  const poly: Pt[] = [];
  const top = rows[0]!.y;
  const bottom = rows[rows.length - 1]!.y + 1;
  // down the right side
  right.forEach((s, i) => {
    const y0 = i === 0 ? top : s.y0;
    poly.push([s.x, y0]);
    poly.push([s.x, i === right.length - 1 ? bottom : s.y1]);
  });
  // back up the left side
  for (let i = left.length - 1; i >= 0; i--) {
    const s = left[i]!;
    poly.push([s.x, i === left.length - 1 ? bottom : s.y1]);
    poly.push([s.x, i === 0 ? top : s.y0]);
  }
  return squareUp(poly);
}

/** Corners on one straight line dropped, and repeated corners merged. */
function squareUp(poly: Pt[]): Pt[] {
  let p = poly.filter((q, i) => {
    const n = poly[(i + 1) % poly.length]!;
    return Math.abs(q[0] - n[0]) > 0.01 || Math.abs(q[1] - n[1]) > 0.01;
  });
  for (let changed = true; changed && p.length > 3; ) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length]!;
      const b = p[i]!;
      const c = p[(i + 1) % p.length]!;
      const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (Math.abs(cross) < 1e-6) {
        p = p.filter((_, k) => k !== i);
        changed = true;
        break;
      }
    }
  }
  return p;
}

/**
 * Each edge of a square-cornered polygon pushed out by `d` (pixels): undoes the thickening used to
 * close the door gaps, so the edges come back to the walls' inner faces.
 */
export function grow(poly: Pt[], d: number): Pt[] {
  const n = poly.length;
  // the polygon's turning direction: outward is to the left of travel for clockwise-on-screen polygons
  let area = 0;
  for (let i = 0; i < n; i++) area += poly[i]![0] * poly[(i + 1) % n]![1] - poly[(i + 1) % n]![0] * poly[i]![1];
  const sgn = area > 0 ? 1 : -1;
  const lines = poly.map((a, i) => {
    const b = poly[(i + 1) % n]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const ux = (b[0] - a[0]) / len;
    const uy = (b[1] - a[1]) / len;
    // outward normal
    const nx = uy * sgn;
    const ny = -ux * sgn;
    return { a: [a[0] + nx * d, a[1] + ny * d] as Pt, ux, uy };
  });
  return poly.map((_, i) => {
    const L1 = lines[(i + n - 1) % n]!;
    const L2 = lines[i]!;
    const den = L1.ux * L2.uy - L1.uy * L2.ux;
    if (Math.abs(den) < 1e-9) return L2.a;
    const t = ((L2.a[0] - L1.a[0]) * L2.uy - (L2.a[1] - L1.a[1]) * L2.ux) / den;
    return [L1.a[0] + L1.ux * t, L1.a[1] + L1.uy * t] as Pt;
  });
}

const bbox = (poly: Pt[]) => {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
};

/**
 * Rooms whose walls face each other across a gap of at most `gap` (pixels) are moved to meet on
 * the gap's middle line — the planner builds a wall two rooms share once, on that line. Only
 * square (horizontal / vertical) edges move; each room's corners move with its edge.
 */
export function meetShared(rooms: Pt[][], gap: number): Pt[][] {
  const out = rooms.map((p) => p.map((q): Pt => [q[0], q[1]]));
  type E = { r: number; i: number; axis: 0 | 1; at: number; lo: number; hi: number };
  const edges: E[] = [];
  out.forEach((poly, r) => {
    poly.forEach((a, i) => {
      const b = poly[(i + 1) % poly.length]!;
      if (Math.abs(a[1] - b[1]) < 0.5) edges.push({ r, i, axis: 1, at: a[1], lo: Math.min(a[0], b[0]), hi: Math.max(a[0], b[0]) });
      else if (Math.abs(a[0] - b[0]) < 0.5) edges.push({ r, i, axis: 0, at: a[0], lo: Math.min(a[1], b[1]), hi: Math.max(a[1], b[1]) });
    });
  });
  const moved = new Map<string, number>();
  for (let p = 0; p < edges.length; p++) {
    for (let q = p + 1; q < edges.length; q++) {
      const A = edges[p]!;
      const B = edges[q]!;
      if (A.r === B.r || A.axis !== B.axis) continue;
      const d = Math.abs(A.at - B.at);
      if (d < 0.5 || d > gap) continue;
      const overlap = Math.min(A.hi, B.hi) - Math.max(A.lo, B.lo);
      if (overlap < 0.5 * Math.min(A.hi - A.lo, B.hi - B.lo)) continue;
      // only walls that face each other: A's room on one side, B's on the other
      const ca = bbox(out[A.r]!);
      const cb = bbox(out[B.r]!);
      const ma = A.axis === 0 ? ca.x + ca.w / 2 : ca.y + ca.h / 2;
      const mb = B.axis === 0 ? cb.x + cb.w / 2 : cb.y + cb.h / 2;
      if (Math.sign(A.at - ma) === Math.sign(B.at - mb)) continue;
      const mid = (A.at + B.at) / 2;
      for (const e of [A, B]) {
        const key = `${e.r}:${e.i}`;
        if (moved.has(key)) continue;
        moved.set(key, mid);
      }
    }
  }
  for (const [key, at] of moved) {
    const [r, i] = key.split(':').map(Number) as [number, number];
    const poly = out[r]!;
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    if (Math.abs(a[1] - b[1]) < 0.5) a[1] = b[1] = at;
    else a[0] = b[0] = at;
  }
  return out;
}

// ---------------------------------------------------------------- scale

/** A line of text the reader found, with its box (pixels of the straightened plan). */
export interface TextLine {
  text: string;
  box: { x: number; y: number; w: number; h: number };
}

export interface ScaleFit {
  /** Millimetres per pixel, across (x) and down (y) the picture: a page flattened to the wrong shape stretches one way. */
  sx: number;
  sy: number;
  /** The two together (their geometric mean). */
  mmPerPx: number;
  /** Log-scale spread of the matches that agreed (0.02 ≈ ±2 %). */
  sigma: number;
  /** The written sizes that were used, in words. */
  used: string[];
  /** Written sizes that did not agree with the rest. */
  ignored: string[];
  /** Only one direction had written sizes: the other is assumed the same. */
  oneWay: boolean;
}

/**
 * The scale from the written sizes, each way: a pair inside a room against that room's width and
 * depth (the way round whose two scales agree best, within 20 %: the page may be stretched a
 * little one way), a single length against the nearest wall running the same way as the text
 * (within 30 % of the wall's length of it). Each way, the median of its matches; matches more than
 * 12 % from it are set aside. A direction with no sizes takes the other's scale; two directions
 * more than 20 % apart are not trusted apart, and their mean is used both ways. Null with no matches.
 */
export function fitScale(lines: TextLine[], rooms: Pt[][]): ScaleFit | null {
  const est: { s: number; axis: 'x' | 'y'; why: string }[] = [];
  for (const line of lines) {
    const dims = parseDims(line.text);
    if (!dims.length) continue;
    const cx = line.box.x + line.box.w / 2;
    const cy = line.box.y + line.box.h / 2;
    const room = rooms.find((p) => insidePoly([cx, cy], p));
    for (const d of dims) {
      if (d.b != null) {
        if (!room) continue;
        const b = bbox(room);
        const opts = [
          { x: d.a / b.w, y: d.b / b.h },
          { x: d.b / b.w, y: d.a / b.h },
        ].map((o) => ({ ...o, off: Math.abs(Math.log(o.x / o.y)) }));
        const best = opts[0]!.off <= opts[1]!.off ? opts[0]! : opts[1]!;
        if (best.off <= 0.2) {
          const why = `"${d.text}" (a room's width × depth)`;
          est.push({ s: best.x, axis: 'x', why }, { s: best.y, axis: 'y', why });
        }
        break;
      }
      // a single length: the nearest wall edge running the same way as the text
      const horizontal = line.box.w >= line.box.h;
      let bestE: { len: number; d: number } | null = null;
      for (const poly of rooms) {
        poly.forEach((a, i) => {
          const b = poly[(i + 1) % poly.length]!;
          const isH = Math.abs(a[1] - b[1]) < Math.abs(a[0] - b[0]);
          if (isH !== horizontal) return;
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
          const lo = isH ? Math.min(a[0], b[0]) : Math.min(a[1], b[1]);
          const hi = isH ? Math.max(a[0], b[0]) : Math.max(a[1], b[1]);
          const along = isH ? cx : cy;
          if (along < lo || along > hi) return;
          const dd = isH ? Math.abs(cy - a[1]) : Math.abs(cx - a[0]);
          if (dd > 0.3 * len) return;
          if (!bestE || dd < bestE.d) bestE = { len, d: dd };
        });
      }
      if (bestE) est.push({ s: d.a / (bestE as { len: number }).len, axis: horizontal ? 'x' : 'y', why: `"${d.text}" (a wall)` });
    }
  }
  if (!est.length) return null;
  const used = new Set<string>();
  const ignored = new Set<string>();
  const axisFit = (axis: 'x' | 'y') => {
    const mine = est.filter((e) => e.axis === axis);
    if (!mine.length) return null;
    const sorted = mine.map((e) => e.s).sort((p, q) => p - q);
    const mid = sorted[sorted.length >> 1]!;
    const keep = mine.filter((e) => Math.abs(Math.log(e.s / mid)) <= 0.12);
    for (const e of mine) (keep.includes(e) ? used : ignored).add(e.why);
    const logs = keep.map((e) => Math.log(e.s));
    const mean = logs.reduce((p, q) => p + q, 0) / logs.length;
    const sd = logs.length > 1 ? Math.sqrt(logs.reduce((p, q) => p + (q - mean) ** 2, 0) / (logs.length - 1)) : 0.03;
    return { s: Math.exp(mean), sigma: Math.max(0.01, sd / Math.sqrt(logs.length)) };
  };
  let X = axisFit('x');
  let Y = axisFit('y');
  const oneWay = !X || !Y;
  if (!X) X = Y;
  if (!Y) Y = X;
  if (Math.abs(Math.log(X!.s / Y!.s)) > 0.2) {
    const m = Math.sqrt(X!.s * Y!.s);
    X = Y = { s: m, sigma: Math.max(X!.sigma, Y!.sigma, Math.abs(Math.log(X!.s / Y!.s)) / 2) };
  }
  for (const u of used) ignored.delete(u);
  return { sx: X!.s, sy: Y!.s, mmPerPx: Math.sqrt(X!.s * Y!.s), sigma: Math.max(X!.sigma, Y!.sigma) + (oneWay ? 0.03 : 0), used: [...used], ignored: [...ignored], oneWay };
}

/** The share of a room's outline (sampled just outside its edges, half a wall out) that is wall. */
export function wallShare(poly: Pt[], solid: Uint8Array, w: number, h: number, t: number): number {
  let area = 0;
  for (let i = 0; i < poly.length; i++) area += poly[i]![0] * poly[(i + 1) % poly.length]![1] - poly[(i + 1) % poly.length]![0] * poly[i]![1];
  const sgn = area > 0 ? 1 : -1;
  let hit = 0;
  let n = 0;
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!len) return;
    const ux = (b[0] - a[0]) / len;
    const uy = (b[1] - a[1]) / len;
    for (let s = 0; s < len; s += 2) {
      const x = Math.round(a[0] + ux * s + uy * sgn * t * 0.5);
      const y = Math.round(a[1] + uy * s - ux * sgn * t * 0.5);
      n++;
      if (x >= 0 && y >= 0 && x < w && y < h && solid[y * w + x]) hit++;
    }
  });
  return n ? hit / n : 0;
}

function insidePoly(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

// ---------------------------------------------------------------- openings

export interface FoundOpening {
  room: number;
  wall: number;
  type: 'door' | 'window';
  /** Along the wall from its first corner, and how wide: pixels. */
  at: number;
  w: number;
}

/**
 * Doors and windows along every room edge: the wall's middle line (`t / 2` outside the edge) is
 * read pixel by pixel as wall (thick), thin (only thin lines: a window's glazing) or empty. An
 * empty stretch of `door` px is a door, a thin one of `window` px a window. A door seen from both
 * rooms is kept once.
 */
export function findOpenings(rooms: Pt[][], walls: Uint8Array, dark: Uint8Array, w: number, h: number, t: number, sizes: { door: [number, number]; window: [number, number] }): FoundOpening[] {
  const out: FoundOpening[] = [];
  const at = (x: number, y: number, m: Uint8Array) => {
    const xi = Math.round(x);
    const yi = Math.round(y);
    return xi >= 0 && yi >= 0 && xi < w && yi < h ? m[yi * w + xi]! : 0;
  };
  rooms.forEach((poly, r) => {
    let area = 0;
    for (let i = 0; i < poly.length; i++) area += poly[i]![0] * poly[(i + 1) % poly.length]![1] - poly[(i + 1) % poly.length]![0] * poly[i]![1];
    const sgn = area > 0 ? 1 : -1;
    poly.forEach((a, i) => {
      const b = poly[(i + 1) % poly.length]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 2 * t) return;
      const ux = (b[0] - a[0]) / len;
      const uy = (b[1] - a[1]) / len;
      const nx = uy * sgn;
      const ny = -ux * sgn;
      // eight samples across the wall's thickness: mostly wall, thin lines only, or nothing;
      // which of the eight were dark is kept, to tell glazing (lines all along) from a door's swing (a crossing)
      const kinds: ('W' | 'T' | 'O')[] = [];
      const lanes: number[] = [];
      for (let s = 0; s < len; s++) {
        let W = 0;
        let T = 0;
        let lane = 0;
        for (let k = 0; k < 8; k++) {
          const f = 0.1 + k * 0.115;
          const x = a[0] + ux * s + nx * t * f;
          const y = a[1] + uy * s + ny * t * f;
          if (at(x, y, walls)) W++;
          else if (at(x, y, dark)) {
            T++;
            lane |= 1 << k;
          }
        }
        kinds.push(W >= 4 ? 'W' : T >= 1 ? 'T' : W >= 1 ? 'W' : 'O');
        lanes.push(lane);
      }
      // a stretch of thin lines is glazing only when one line runs along most of it; otherwise it is a gap something crosses (a door's swing)
      for (let s = 0; s < kinds.length; ) {
        if (kinds[s] === 'W') {
          s++;
          continue;
        }
        let e = s;
        while (e < kinds.length && kinds[e] !== 'W') e++;
        const n = e - s;
        let best = 0;
        for (let k = 0; k < 8; k++) {
          let c = 0;
          // a line may wander one lane either way
          const mask = (1 << k) | (k > 0 ? 1 << (k - 1) : 0) | (k < 7 ? 1 << (k + 1) : 0);
          for (let q = s; q < e; q++) if (lanes[q]! & mask) c++;
          best = Math.max(best, c / n);
        }
        const glazing = best >= 0.7;
        for (let q = s; q < e; q++) kinds[q] = glazing ? 'T' : 'O';
        s = e;
      }
      // a speck of one or two pixels does not split a run
      for (let s = 1; s < kinds.length - 1; s++) {
        const before = kinds[s - 1]!;
        if (kinds[s] === before) continue;
        let e = s;
        while (e < kinds.length && kinds[e] === kinds[s] && e - s < 3) e++;
        if (e - s <= 2 && e < kinds.length && kinds[e] === before) for (let q = s; q < e; q++) kinds[q] = before;
      }
      // runs, ignoring the corners (a wall end is often ragged)
      let s = 0;
      while (s < kinds.length) {
        const k = kinds[s]!;
        let e = s;
        while (e < kinds.length && kinds[e] === k) e++;
        const runLen = e - s;
        const clearOfCorners = s > t * 0.5 && e < len - t * 0.5;
        if (clearOfCorners && k === 'O' && runLen >= sizes.door[0] && runLen <= sizes.door[1]) out.push({ room: r, wall: i, type: 'door', at: s, w: runLen });
        if (clearOfCorners && k === 'T' && runLen >= sizes.window[0] && runLen <= sizes.window[1]) out.push({ room: r, wall: i, type: 'window', at: s, w: runLen });
        s = e;
      }
    });
  });
  // a door between two rooms is found from both sides: keep the first
  const mid = (o: FoundOpening) => {
    const poly = rooms[o.room]!;
    const a = poly[o.wall]!;
    const b = poly[(o.wall + 1) % poly.length]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const f = (o.at + o.w / 2) / len;
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f] as Pt;
  };
  const kept: FoundOpening[] = [];
  for (const o of out) {
    const m = mid(o);
    if (kept.some((k) => k.type === o.type && Math.hypot(mid(k)[0] - m[0], mid(k)[1] - m[1]) <= 2 * t + 2)) continue;
    kept.push(o);
  }
  return kept;
}

/** A word the reader found, with its box (Tesseract's shape). */
export interface Word {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

/**
 * The reader's words joined into lines of text with boxes: a word joins the line before it when it
 * sits on the same row (centres within 60 % of the height) and close after it (a gap under twice
 * the height). Words the reader was unsure of (under `minConf`) are left out.
 */
export function linesFromWords(words: Word[], minConf = 45): TextLine[] {
  const out: TextLine[] = [];
  let cur: { text: string; x0: number; y0: number; x1: number; y1: number } | null = null;
  const flush = () => {
    if (cur) out.push({ text: cur.text, box: { x: cur.x0, y: cur.y0, w: cur.x1 - cur.x0, h: cur.y1 - cur.y0 } });
    cur = null;
  };
  for (const wd of words) {
    const t = wd.text.trim();
    if (!t || wd.confidence < minConf) continue;
    const b = wd.bbox;
    const hgt = Math.max(1, b.y1 - b.y0);
    if (cur) {
      const c = cur as { text: string; x0: number; y0: number; x1: number; y1: number };
      const sameRow = Math.abs((b.y0 + b.y1) / 2 - (c.y0 + c.y1) / 2) <= 0.6 * Math.max(hgt, c.y1 - c.y0);
      const near = b.x0 - c.x1 <= 2 * hgt && b.x0 >= c.x0;
      if (sameRow && near) {
        c.text += ` ${t}`;
        c.x1 = Math.max(c.x1, b.x1);
        c.y0 = Math.min(c.y0, b.y0);
        c.y1 = Math.max(c.y1, b.y1);
        continue;
      }
      flush();
    }
    cur = { text: t, x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 };
  }
  flush();
  return out;
}

/**
 * Is the picture a drawing of a plan (mostly paper, thick dark walls) rather than a photo of the
 * room itself? Two thirds or more of it near the paper's white, and walls found.
 */
export function looksLikeDrawing(img: Gray): boolean {
  const sorted = Uint8Array.from(img.g).sort();
  const paper = sorted[Math.floor(sorted.length * 0.9)]!;
  if (paper < 150) return false;
  let light = 0;
  for (let i = 0; i < img.g.length; i++) if (img.g[i]! >= paper - 40) light++;
  if (light / img.g.length < 0.66) return false;
  return wallThickness(darkMask(img), img.w, img.h) != null;
}

// ---------------------------------------------------------------- the whole plan

export interface PlanFromDrawing {
  plan: Plan;
  /** Millimetres per pixel of the straightened picture, and how sure (log spread). */
  mmPerPx: number;
  sigma: number;
  /** True when no written size could be matched: the scale is a guess from the wall thickness. */
  guessed: boolean;
  /** In plain words: what was found, which sizes set the scale, what to check. */
  notes: string[];
  /** The turn applied to straighten it (degrees). */
  angle: number;
  /** For drawing over the picture: each room's outline in its pixels. */
  outlines: Pt[][];
}

/**
 * The plan in a picture of a drawn or printed floor plan (already flat and upright: the browser
 * straightens a photo of a page first). `text` is what the reader found, in the same pixels.
 * Null with words when no walls or rooms can be found.
 */
export function planFromDrawing(img: Gray, text: TextLine[]): PlanFromDrawing | { error: string } {
  const dark0 = darkMask(img);
  const t0 = wallThickness(dark0, img.w, img.h);
  if (!t0) return { error: 'No walls found: is it a floor plan, drawn with thick lines for the walls?' };
  const angle = wallAngle(wallMask(dark0, img.w, img.h, t0), img.w, img.h);
  const pic = angle ? rotateGray(img, angle) : img;
  const turnText = (l: TextLine): TextLine => {
    if (!angle) return l;
    const a = (angle * Math.PI) / 180;
    const cx = l.box.x + l.box.w / 2 - img.w / 2;
    const cy = l.box.y + l.box.h / 2 - img.h / 2;
    const x = cx * Math.cos(a) - cy * Math.sin(a) + img.w / 2;
    const y = cx * Math.sin(a) + cy * Math.cos(a) + img.h / 2;
    return { text: l.text, box: { x: x - l.box.w / 2, y: y - l.box.h / 2, w: l.box.w, h: l.box.h } };
  };
  const { w, h } = pic;
  const dark = darkMask(pic);
  const rr = runs(dark, w, h);
  const t = wallThickness(dark, w, h, rr) ?? t0;
  const walls = wallMask(dark, w, h, t, rr);
  // close the door gaps: thicken the walls (and the windows' glazing) by R (a door is 6–9 wall thicknesses wide)
  const R = Math.max(3, Math.round(t * 4.5));
  const thin = darkMask(pic, true);
  const solid = bridgeWindows(thin, walls, w, h, t, rr);
  for (let i = 0; i < solid.length; i++) solid[i] = solid[i]! | walls[i]!;
  const closed = dilate(solid, w, h, R);
  const { label, sizes } = patches(closed, w, h);
  const minArea = Math.max(400, w * h * 0.004);
  const inner: Pt[][] = [];
  for (let id = 1; id < sizes.length && inner.length < LIMITS.rooms; id++) {
    if (sizes[id]! < minArea) continue;
    const poly = spanPolygon(label, w, h, id, Math.max(2, t));
    if (!poly || poly.length < 4 || poly.length > LIMITS.corners) continue;
    const room = grow(poly, R);
    // a room is walled in: a patch fenced only by thin lines (a bed, a rug drawn on the plan) is not one
    if (wallShare(room, solid, w, h, t) < 0.5) continue;
    inner.push(room);
  }
  if (!inner.length) return { error: 'Walls found, but no closed rooms: is the whole plan in the picture?' };
  const lines = text.map(turnText);
  // the scale and the openings from the rooms' inner faces (what plans write); then shared walls meet
  const fit = fitScale(lines, inner);
  const notes: string[] = [];
  let sx: number;
  let sy: number;
  let sigma: number;
  const guessed = !fit;
  if (fit) {
    sx = fit.sx;
    sy = fit.sy;
    sigma = fit.sigma;
    notes.push(`Scale from ${fit.used.length} written size${fit.used.length === 1 ? '' : 's'}: ${fit.used.slice(0, 3).join(', ')}${fit.used.length > 3 ? '…' : ''}`);
    if (fit.oneWay) notes.push('Sizes were written one way only: the other way is assumed to match (check one wall that way).');
    if (fit.ignored.length) notes.push(`Did not agree, so not used: ${fit.ignored.slice(0, 3).join(', ')}`);
  } else {
    // no sizes to read: guess from the walls (100 mm is a usual inside wall), and say so
    sx = sy = 100 / t;
    sigma = 0.35;
    notes.push('No written sizes could be read, so the scale is a guess (walls assumed 10 cm thick). Tap a wall and type its real length: everything rescales.');
  }
  const mmPerPx = Math.sqrt(sx * sy);
  const found = findOpenings(inner, walls, thin, w, h, t, {
    door: [600 / mmPerPx, 1300 / mmPerPx],
    window: [400 / mmPerPx, 3000 / mmPerPx],
  });
  const rooms = meetShared(inner, t * 1.8);
  const cm = (px: number) => (px * mmPerPx) / 10;
  const cmX = (px: number) => (px * sx) / 10;
  const cmY = (px: number) => (px * sy) / 10;
  // room names: words inside a room that are not sizes
  const names = rooms.map((poly, i) => {
    const words = lines.filter((l) => insidePoly([l.box.x + l.box.w / 2, l.box.y + l.box.h / 2], poly) && !parseDims(l.text).length && /[a-z]{3,}/i.test(l.text));
    const name = words.map((l) => l.text.replace(/[^\p{L}\p{N} '&-]/gu, '').trim()).filter(Boolean)[0];
    return name ? name.slice(0, 40).replace(/\b\w/g, (c) => c.toUpperCase()) : `Room ${i + 1}`;
  });
  const minX = Math.min(...rooms.flat().map((p) => p[0]));
  const minY = Math.min(...rooms.flat().map((p) => p[1]));
  const shapes: RoomShape[] = rooms.map((poly, i) => ({ id: `r${i + 1}`, name: names[i]!, poly: poly.map((p): Pt => [Math.round(cmX(p[0] - minX)), Math.round(cmY(p[1] - minY))]) }));
  const openings: Opening[] = found.map((o, k) => {
    const door = o.type === 'door';
    // along a wall that runs across the picture the across scale applies, down it the down scale
    const poly = inner[o.room]!;
    const ea = poly[o.wall]!;
    const eb = poly[(o.wall + 1) % poly.length]!;
    const along = Math.abs(eb[0] - ea[0]) >= Math.abs(eb[1] - ea[1]) ? cmX : cmY;
    // found on the walls' inner faces; placed on the final outline (a shared wall's corners moved to its middle):
    // the opening's middle, measured from the final edge's own first corner
    const len0 = Math.hypot(eb[0] - ea[0], eb[1] - ea[1]) || 1;
    const mid: Pt = [ea[0] + ((eb[0] - ea[0]) * (o.at + o.w / 2)) / len0, ea[1] + ((eb[1] - ea[1]) * (o.at + o.w / 2)) / len0];
    const fin = rooms[o.room]!;
    const fa = fin[o.wall]!;
    const fb = fin[(o.wall + 1) % fin.length]!;
    const flen = Math.hypot(fb[0] - fa[0], fb[1] - fa[1]) || 1;
    const midAlong = ((mid[0] - fa[0]) * (fb[0] - fa[0]) + (mid[1] - fa[1]) * (fb[1] - fa[1])) / flen;
    return {
      id: `${door ? 'd' : 'w'}${k + 1}`,
      type: o.type,
      room: shapes[o.room]!.id,
      wall: o.wall,
      at: Math.round(along(midAlong - o.w / 2)),
      w: Math.max(30, Math.round(along(o.w))),
      h: door ? DEFAULTS.door.h : DEFAULTS.window.h,
      sill: door ? 0 : DEFAULTS.window.sill,
      hinge: 'start',
      swing: 'in',
    };
  });
  const wallCm = Math.max(2, Math.min(60, Math.round(cm(t))));
  const box = bbox(shapes.flatMap((s) => s.poly));
  const raw = { v: 2 as const, room: { w: Math.max(50, Math.round(box.w)), d: Math.max(50, Math.round(box.h)) }, items: [], rooms: shapes, openings, wall: wallCm, h: DEFAULTS.h, north: 0 };
  const plan = readPlan(raw);
  if (!plan) return { error: 'The plan found could not be made into rooms the planner can hold' };
  const doors = (plan.openings ?? []).filter((o) => o.type === 'door').length;
  const windows = (plan.openings ?? []).length - doors;
  if (shapes.length > 1) notes.push('Rooms that share a wall reach to its middle line, where the planner builds a shared wall once: on the plan they are about half a wall bigger than inside. A wall’s real inside length typed on the plan allows for that.');
  notes.unshift(`Found ${shapes.length} room${shapes.length === 1 ? '' : 's'}, ${doors} door${doors === 1 ? '' : 's'} and ${windows} window${windows === 1 ? '' : 's'}; walls ${wallCm} cm.`);
  if ((plan.rooms?.length ?? 0) < shapes.length) notes.push(`${shapes.length - (plan.rooms?.length ?? 0)} room shape(s) could not be used.`);
  return { plan, mmPerPx, sigma, guessed, notes, angle, outlines: rooms };
}

// ---------------------------------------------------------------- correcting it

/**
 * The owner says one wall is really `cm` long inside: every room, door and window is scaled by the same
 * factor (the walls' thickness too, not the ceiling; furniture keeps its size and its place
 * scales). Returns the new plan and the factor; null when that wall does not exist.
 */
export function rescalePlan(plan: Plan, roomId: string, wall: number, cm: number): { plan: Plan; factor: number } | null {
  const room = plan.rooms?.find((r) => r.id === roomId);
  if (!room || !(cm > 0)) return null;
  const a = room.poly[wall];
  const b = room.poly[(wall + 1) % room.poly.length];
  if (!a || !b) return null;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (!(len > 0)) return null;
  // the typed length is the inside one: an end of this wall that meets a wall shared with another room
  // runs on to that wall's middle line, half a wall further than inside
  const t = plan.wall ?? DEFAULTS.wall;
  const others = plan.rooms!.filter((r) => r.id !== roomId);
  const shared = (i: number) => {
    const e = edgeOf(room.poly, ((i % room.poly.length) + room.poly.length) % room.poly.length);
    const probe: Pt = [(e.a[0] + e.b[0]) / 2 + e.nx * (t / 2 + 1), (e.a[1] + e.b[1]) / 2 + e.ny * (t / 2 + 1)];
    return others.some((r) => pointInPoly(probe, r.poly));
  };
  const inside = len - (shared(wall - 1) ? t / 2 : 0) - (shared(wall + 1) ? t / 2 : 0);
  if (!(inside > 0)) return null;
  const k = cm / inside;
  const rooms = plan.rooms!.map((r) => ({ ...r, poly: r.poly.map((p): Pt => [Math.round(p[0] * k * 10) / 10, Math.round(p[1] * k * 10) / 10]) }));
  const openings = (plan.openings ?? []).map((o) => ({ ...o, at: Math.round(o.at * k), w: Math.max(30, Math.round(o.w * k)) }));
  const items = plan.items.map((it) => ({ ...it, x: Math.round(it.x * k), y: Math.round(it.y * k) }));
  const next = readPlan({ ...plan, rooms, openings, items, room: { w: Math.round(plan.room.w * k), d: Math.round(plan.room.d * k) }, wall: Math.max(2, Math.min(60, Math.round((plan.wall ?? DEFAULTS.wall) * k))) });
  return next ? { plan: next, factor: k } : null;
}
