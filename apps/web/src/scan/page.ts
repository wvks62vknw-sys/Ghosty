/**
 * A document page in a photo: find it, straighten it, make it easy to read. All on the phone.
 *
 * Finding: the photo is shrunk to ~256 px, turned grey and split into light and dark at the level
 * that best separates the two (Otsu); the biggest light patch is the page, and its corners are
 * the patch's points furthest towards each corner of the photo. Simple and quick, and right for
 * a light page on a darker table; when it is wrong the owner drags the four corners.
 *
 * Straightening: the four corners are mapped onto an upright A4-shaped page (a homography) and
 * every output pixel is sampled from the photo. Enhancing: grey, with the darkest and lightest
 * 2 % stretched to black and white, which is what a scanner app's "document" filter does.
 */

export interface Pt {
  x: number;
  y: number;
}
/** Corners in order: top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Pt, Pt, Pt, Pt];

/** A4's height over its width. */
export const A4_RATIO = 297 / 210;

/** Grey levels 0–255 from RGBA pixels (Rec. 601 weights). */
export function toGray(rgba: ArrayLike<number>, w: number, h: number): Uint8Array {
  const g = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (rgba[j]! * 299 + rgba[j + 1]! * 587 + rgba[j + 2]! * 114) / 1000;
  return g;
}

/** The grey level that best splits light from dark (Otsu's method). */
export function otsu(gray: ArrayLike<number>): number {
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i]!]!++;
  const total = gray.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t]!;
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let level = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]!;
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t]!;
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      level = t;
    }
  }
  return level;
}

/** Put four points in order: top-left, top-right, bottom-right, bottom-left. */
export function orderQuad(pts: Pt[]): Quad {
  const by = (f: (p: Pt) => number, max: boolean) => pts.reduce((a, b) => ((max ? f(b) > f(a) : f(b) < f(a)) ? b : a));
  return [by((p) => p.x + p.y, false), by((p) => p.x - p.y, true), by((p) => p.x + p.y, true), by((p) => p.x - p.y, false)];
}

/** Twice the area of a polygon (shoelace), always positive. */
export function quadArea(q: Pt[]): number {
  let a = 0;
  for (let i = 0; i < q.length; i++) {
    const p = q[i]!;
    const n = q[(i + 1) % q.length]!;
    a += p.x * n.y - n.x * p.y;
  }
  return Math.abs(a) / 2;
}

/**
 * The page in a grey picture: the corners of the biggest light patch, or null when no patch
 * covers between 12 % and 97 % of the picture (no page, or nothing but page).
 */
export function findPage(gray: ArrayLike<number>, w: number, h: number): Quad | null {
  const level = otsu(gray);
  const n = w * h;
  const label = new Int32Array(n).fill(-1);
  const queue = new Int32Array(n);
  let bestSize = 0;
  let bestId = -1;
  let id = 0;
  for (let start = 0; start < n; start++) {
    if (label[start] !== -1 || gray[start]! <= level) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    label[start] = id;
    while (head < tail) {
      const p = queue[head++]!;
      const x = p % w;
      const y = (p - x) / w;
      const near = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of near) {
        if (q >= 0 && label[q] === -1 && gray[q]! > level) {
          label[q] = id;
          queue[tail++] = q;
        }
      }
    }
    if (tail > bestSize) {
      bestSize = tail;
      bestId = id;
    }
    id++;
  }
  if (bestId < 0 || bestSize < 0.12 * n || bestSize > 0.97 * n) return null;
  let tl = { x: 0, y: 0, s: Infinity };
  let br = { x: 0, y: 0, s: -Infinity };
  let tr = { x: 0, y: 0, s: -Infinity };
  let bl = { x: 0, y: 0, s: Infinity };
  for (let p = 0; p < n; p++) {
    if (label[p] !== bestId) continue;
    const x = p % w;
    const y = (p - x) / w;
    if (x + y < tl.s) tl = { x, y, s: x + y };
    if (x + y > br.s) br = { x, y, s: x + y };
    if (x - y > tr.s) tr = { x, y, s: x - y };
    if (x - y < bl.s) bl = { x, y, s: x - y };
  }
  const q: Quad = [
    { x: tl.x, y: tl.y },
    { x: tr.x + 1, y: tr.y },
    { x: br.x + 1, y: br.y + 1 },
    { x: bl.x, y: bl.y + 1 },
  ];
  // A patch whose "corners" enclose little of it is not a page (a blob, a lamp): let the owner place them.
  return quadArea(q) > 0.08 * n ? q : null;
}

/** Corners covering the whole picture, inset a little (the starting point for dragging by hand). */
export const defaultQuad = (w: number, h: number, inset = 0.08): Quad => [
  { x: w * inset, y: h * inset },
  { x: w * (1 - inset), y: h * inset },
  { x: w * (1 - inset), y: h * (1 - inset) },
  { x: w * inset, y: h * (1 - inset) },
];

/** Solve A·x = b (n×n) by Gaussian elimination with partial pivoting. */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[piv]![c]!)) piv = r;
    [M[c], M[piv]] = [M[piv]!, M[c]!];
    const d = M[c]![c]!;
    if (Math.abs(d) < 1e-12) throw new Error('The corners do not make a page');
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r]![c]! / d;
      for (let k = c; k <= n; k++) M[r]![k]! -= f * M[c]![k]!;
    }
  }
  return M.map((row, i) => row[n]! / row[i]!);
}

/** The 3×3 homography (row-major, h33 = 1) taking each `from` corner to the matching `to` corner. */
export function homography(from: Quad, to: Quad): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i]!;
    const { x: u, y: v } = to[i]!;
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  return [...solve(A, b), 1];
}

export function applyH(H: number[], x: number, y: number): Pt {
  const d = H[6]! * x + H[7]! * y + H[8]!;
  return { x: (H[0]! * x + H[1]! * y + H[2]!) / d, y: (H[3]! * x + H[4]! * y + H[5]!) / d };
}

/** The upright page size for these corners: A4-shaped, portrait or landscape as the page lies, `long` px on the long side. */
export function pageSize(q: Quad, long = 1600): { w: number; h: number } {
  const d = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
  const wide = (d(q[0], q[1]) + d(q[3], q[2])) / 2;
  const tall = (d(q[0], q[3]) + d(q[1], q[2])) / 2;
  const short = Math.round(long / A4_RATIO);
  return tall >= wide ? { w: short, h: long } : { w: long, h: short };
}

/** The page cut out of the photo and straightened: RGBA pixels of outW × outH (bilinear sampling). */
export function warpPage(src: { data: ArrayLike<number>; width: number; height: number }, q: Quad, outW: number, outH: number): Uint8ClampedArray {
  const rect: Quad = [
    { x: 0, y: 0 },
    { x: outW, y: 0 },
    { x: outW, y: outH },
    { x: 0, y: outH },
  ];
  // Output pixel → photo position, so every output pixel gets exactly one sample.
  const H = homography(rect, q);
  const out = new Uint8ClampedArray(outW * outH * 4);
  const { data, width: W, height: Hh } = src;
  for (let v = 0; v < outH; v++) {
    for (let u = 0; u < outW; u++) {
      const p = applyH(H, u + 0.5, v + 0.5);
      const x = Math.min(W - 1.001, Math.max(0, p.x - 0.5));
      const y = Math.min(Hh - 1.001, Math.max(0, p.y - 0.5));
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const fx = x - x0;
      const fy = y - y0;
      const i00 = (y0 * W + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + W * 4;
      const i11 = i01 + 4;
      const o = (v * outW + u) * 4;
      for (let c = 0; c < 3; c++) {
        const top = data[i00 + c]! * (1 - fx) + data[i10 + c]! * fx;
        const bot = data[i01 + c]! * (1 - fx) + data[i11 + c]! * fx;
        out[o + c] = top * (1 - fy) + bot * fy;
      }
      out[o + 3] = 255;
    }
  }
  return out;
}

/** Grey, with the darkest 2 % → black and the lightest 2 % → white (in place, RGBA). */
export function enhance(rgba: Uint8ClampedArray): Uint8ClampedArray {
  const n = rgba.length / 4;
  const g = toGray(rgba, n, 1);
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < n; i++) hist[g[i]!]!++;
  const cut = n * 0.02;
  let lo = 0;
  let hi = 255;
  for (let acc = 0; lo < 255 && (acc += hist[lo]!) < cut; ) lo++;
  for (let acc = 0; hi > 0 && (acc += hist[hi]!) < cut; ) hi--;
  if (hi - lo < 16) {
    lo = Math.max(0, lo - 8);
    hi = Math.min(255, hi + 8);
  }
  const k = 255 / Math.max(1, hi - lo);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const v = (g[i]! - lo) * k;
    rgba[j] = rgba[j + 1] = rgba[j + 2] = v;
    rgba[j + 3] = 255;
  }
  return rgba;
}

// ---- on a canvas (the browser)

/** The page's corners in a canvas (in its pixels), or null when no page stands out. */
export function findPageIn(c: HTMLCanvasElement, work = 256): Quad | null {
  const k = Math.min(1, work / Math.max(c.width, c.height));
  const w = Math.max(1, Math.round(c.width * k));
  const h = Math.max(1, Math.round(c.height * k));
  const small = document.createElement('canvas');
  small.width = w;
  small.height = h;
  const g = small.getContext('2d', { willReadFrequently: true });
  if (!g) return null;
  g.drawImage(c, 0, 0, w, h);
  const q = findPage(toGray(g.getImageData(0, 0, w, h).data, w, h), w, h);
  return q ? (q.map((p) => ({ x: p.x / k, y: p.y / k })) as Quad) : null;
}

/** The page straightened (and enhanced) into a new canvas. */
export function straighten(c: HTMLCanvasElement, q: Quad, opts: { enhance?: boolean; long?: number } = {}): HTMLCanvasElement {
  const size = pageSize(q, opts.long ?? 1600);
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) throw new Error('The picture could not be read');
  const pixels = warpPage(g.getImageData(0, 0, c.width, c.height), q, size.w, size.h);
  if (opts.enhance !== false) enhance(pixels);
  const out = document.createElement('canvas');
  out.width = size.w;
  out.height = size.h;
  out.getContext('2d')?.putImageData(new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, size.w, size.h), 0, 0);
  return out;
}
