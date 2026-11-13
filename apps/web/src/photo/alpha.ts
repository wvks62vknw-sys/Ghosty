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
