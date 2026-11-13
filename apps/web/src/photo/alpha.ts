/**
 * A BRUSH'S ALPHA PICTURE (BRIEF-EDITOR-PHOTO): what a brush painted, or what the SUBJECT cut found, kept small (at most 640 px on the
 * long side, one byte a pixel) in the original's own frame. A recipe only names it by an id; each stroke makes a new picture (the old one
 * stays for UNDO), and the store keeps the ones a saved recipe names. Pure.
 */
export interface Alpha {
  w: number;
  h: number;
  data: Uint8Array;
}

export const ALPHA_SIDE = 640;
const bank = new Map<string, Alpha>();
const versions = new Map<string, number>();
let counter = 0;

export const alphaSizeFor = (w: number, h: number): { w: number; h: number } => {
  const k = ALPHA_SIDE / Math.max(w, h);
  return { w: Math.max(2, Math.round(w * Math.min(1, k))), h: Math.max(2, Math.round(h * Math.min(1, k))) };
};
export const blankAlpha = (w: number, h: number): Alpha => ({ w, h, data: new Uint8Array(w * h) });
export function putAlpha(a: Alpha, id = ''): string {
  const key = id || `a${Date.now().toString(36)}${(counter++).toString(36)}`;
  bank.set(key, a);
  versions.set(key, (versions.get(key) ?? 0) + 1);
  return key;
}
/** How many times a picture was put under this id (a picture changed in place is uploaded again when this moves). */
export const alphaVersion = (id: string): number => versions.get(id) ?? 0;
export const getAlpha = (id: string): Alpha | null => bank.get(id) ?? null;
export const forgetAlphas = (keep: Set<string>): void => {
  for (const k of [...bank.keys()]) if (!keep.has(k)) (bank.delete(k), versions.delete(k));
};

/** The picture's value 0..1 at (u, v), bilinear between the texel centres, the edge held. */
export function alphaAt(a: Alpha, u: number, v: number): number {
  const x = u * a.w - 0.5;
  const y = v * a.h - 0.5;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const at = (i: number, j: number) => a.data[Math.min(a.h - 1, Math.max(0, j)) * a.w + Math.min(a.w - 1, Math.max(0, i))]! / 255;
  const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
  const bot = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
  return top * (1 - fy) + bot * fy;
}

/**
 * A stroke from (x0, y0) to (x1, y1) (the original's frame, 0..1) of radius `r` (a fraction of the long side), added to a copy of the picture
 * (or taken away from it when `erase`), the edge soft. Returns the new picture.
 */
export function stroke(a: Alpha, from: { x: number; y: number }, to: { x: number; y: number }, r: number, erase: boolean, ow: number, oh: number, inPlace = false): Alpha {
  const out: Alpha = inPlace ? a : { w: a.w, h: a.h, data: a.data.slice() };
  const L = Math.max(ow, oh);
  const rpx = r * L * (a.w / ow);
  const pad = Math.ceil(rpx) + 1;
  const fx = from.x * a.w;
  const fy = from.y * a.h;
  const tx = to.x * a.w;
  const ty = to.y * a.h;
  const minX = Math.max(0, Math.floor(Math.min(fx, tx) - pad));
  const maxX = Math.min(a.w - 1, Math.ceil(Math.max(fx, tx) + pad));
  const minY = Math.max(0, Math.floor(Math.min(fy, ty) - pad));
  const maxY = Math.min(a.h - 1, Math.ceil(Math.max(fy, ty) + pad));
  const dx = tx - fx;
  const dy = ty - fy;
  const len2 = dx * dx + dy * dy;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const t = len2 ? Math.min(1, Math.max(0, ((x + 0.5 - fx) * dx + (y + 0.5 - fy) * dy) / len2)) : 0;
      const d = Math.hypot(x + 0.5 - (fx + dx * t), y + 0.5 - (fy + dy * t)) / Math.max(0.5, rpx);
      if (d >= 1) continue;
      // a hard middle and a soft edge (the last 35 %)
      const f = d < 0.65 ? 1 : 1 - (d - 0.65) / 0.35;
      const i = y * a.w + x;
      const old = out.data[i]! / 255;
      out.data[i] = Math.round((erase ? old * (1 - f) : old + (1 - old) * f) * 255);
    }
  }
  return out;
}

/** How much of the picture is covered, 0..1 (an empty brush mask says so). */
export function coverage(a: Alpha): number {
  let n = 0;
  for (let i = 0; i < a.data.length; i++) n += a.data[i]!;
  return n / (255 * a.data.length);
}

// ----------------------------------------------------------------- a soft mask, brought up to the picture's own edges (BRIEF-EDITOR-PHOTO-2)

/** Where a picture of w × h sits when it is letterboxed into an N × N square (its long side N, the rest left empty, centred), in pixels of the square. */
export function letterbox(w: number, h: number, n: number): { x: number; y: number; w: number; h: number; scale: number } {
  const scale = n / Math.max(w, h);
  const rw = Math.max(1, Math.round(w * scale));
  const rh = Math.max(1, Math.round(h * scale));
  return { x: Math.floor((n - rw) / 2), y: Math.floor((n - rh) / 2), w: rw, h: rh, scale };
}

/** A float picture of one channel (0..1). */
export interface Plane {
  w: number;
  h: number;
  data: Float32Array;
}

/** A plane's value at (u, v) of its own frame (0..1), bilinear between the texel centres, the edge held. */
export function planeAt(p: Plane, u: number, v: number): number {
  const x = Math.min(p.w - 1, Math.max(0, u * p.w - 0.5));
  const y = Math.min(p.h - 1, Math.max(0, v * p.h - 0.5));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(p.w - 1, x0 + 1);
  const y1 = Math.min(p.h - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  const d = p.data;
  return (d[y0 * p.w + x0]! * (1 - fx) + d[y0 * p.w + x1]! * fx) * (1 - fy) + (d[y1 * p.w + x0]! * (1 - fx) + d[y1 * p.w + x1]! * fx) * fy;
}

/** The part of a letterboxed N × N plane that is the picture, resampled to tw × th (the empty bars cut away). */
export function unletterbox(sq: Plane, picW: number, picH: number, tw: number, th: number): Plane {
  const r = letterbox(picW, picH, sq.w);
  const out = new Float32Array(tw * th);
  for (let j = 0; j < th; j++)
    for (let i = 0; i < tw; i++) out[j * tw + i] = planeAt(sq, (r.x + ((i + 0.5) / tw) * r.w) / sq.w, (r.y + ((j + 0.5) / th) * r.h) / sq.h);
  return { w: tw, h: th, data: out };
}

/** A box blur of radius r over a plane (the mean of the (2r+1)² window, edges clamped) by running sums. */
function boxMean(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float64Array(w * h);
  const out = new Float32Array(w * h);
  const k = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let i = -r; i <= r; i++) s += src[y * w + Math.min(w - 1, Math.max(0, i))]!;
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = s / k;
      s += src[y * w + Math.min(w - 1, x + r + 1)]! - src[y * w + Math.max(0, x - r)]!;
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let i = -r; i <= r; i++) s += tmp[Math.min(h - 1, Math.max(0, i)) * w + x]!;
    for (let y = 0; y < h; y++) {
      out[y * w + x] = s / k;
      s += tmp[Math.min(h - 1, y + r + 1) * w + x]! - tmp[Math.max(0, y - r) * w + x]!;
    }
  }
  return out;
}

/**
 * A GUIDED UPSAMPLE (the guided filter of He, Sun and Tang, the app's own): a soft mask made at a small size (`low`, 0..1) brought to the
 * size of `guide` (the picture's brightness at that size, 0..1) so its edge follows the picture's edges where the picture has them, and
 * stays flat where it has none. Each small window gives the mask as a straight line of the picture's brightness (q = a · I + b); where
 * the picture is flat a is near 0 and the mask is its local mean, where there is an edge a is large and the mask snaps to it. `radius` is
 * in pixels of the guide, `eps` how much brightness change counts as an edge (the variance, 0..1).
 */
export function guidedUpsample(low: Plane, guide: Plane, radius = 6, eps = 0.0015): Plane {
  const { w, h } = guide;
  const p = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) p[j * w + i] = planeAt(low, (i + 0.5) / w, (j + 0.5) / h);
  const I = guide.data;
  const n = w * h;
  const Ip = new Float32Array(n);
  const II = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    Ip[i] = I[i]! * p[i]!;
    II[i] = I[i]! * I[i]!;
  }
  const mI = boxMean(I, w, h, radius);
  const mp = boxMean(p, w, h, radius);
  const mIp = boxMean(Ip, w, h, radius);
  const mII = boxMean(II, w, h, radius);
  const a = new Float32Array(n);
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const varI = mII[i]! - mI[i]! * mI[i]!;
    const cov = mIp[i]! - mI[i]! * mp[i]!;
    a[i] = cov / (varI + eps);
    b[i] = mp[i]! - a[i]! * mI[i]!;
  }
  const ma = boxMean(a, w, h, radius);
  const mb = boxMean(b, w, h, radius);
  const q = new Float32Array(n);
  for (let i = 0; i < n; i++) q[i] = Math.min(1, Math.max(0, ma[i]! * I[i]! + mb[i]!));
  return { w, h, data: q };
}

/** A plane as a brush picture (one byte a pixel). */
export function planeToAlpha(p: Plane): Alpha {
  const data = new Uint8Array(p.w * p.h);
  for (let i = 0; i < data.length; i++) data[i] = Math.round(Math.min(1, Math.max(0, p.data[i]!)) * 255);
  return { w: p.w, h: p.h, data };
}
