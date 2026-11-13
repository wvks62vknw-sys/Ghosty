/**
 * THE SPEED RAMP'S TIME (BRIEF-EDITOR-VIDEO-2), pure. A clip's speed can change along it: keys of `{ t, v }` where `t` is how far
 * into the picture (milliseconds of the source, counted in the direction it plays: from the in point, or from the out point on a
 * reversed clip) and `v` the speed there, 0.25 to 4. The pace (seconds of playing for each second of picture, the reciprocal of
 * the speed) changes in a straight line between keys and is held outside the first and last, so a ramp from 1x to 2x over ten
 * seconds of picture plays in 7.5 s: the average of the ten seconds at 1x and the five at 2x. `speed` (the clip's one speed) still
 * multiplies the whole. The inverse, from playing time back to picture, solves the quadratic that integral makes, so the
 * screen, the sound and the export all read the same mapping.
 */
export interface SpeedKey {
  t: number;
  v: number;
}
export const RAMP_MIN = 0.25;
export const RAMP_MAX = 4;

interface Seg {
  a: number;
  b: number;
  pa: number;
  pb: number;
  /** Playing time (ms, at speed 1) up to a. */
  at: number;
}
const sorted = (keys: SpeedKey[]): SpeedKey[] => [...keys].sort((x, y) => x.t - y.t);
const pace = (v: number): number => 1 / Math.min(RAMP_MAX, Math.max(RAMP_MIN, v));

/** The straight stretches of pace over [0, span]. */
function segments(keys: SpeedKey[], span: number): Seg[] {
  const k = sorted(keys);
  const pts: [number, number][] = [];
  pts.push([0, pace(k[0]!.v)]);
  for (const x of k) if (x.t > 0 && x.t < span) pts.push([x.t, pace(x.v)]);
  pts.push([span, pace(k[k.length - 1]!.v)]);
  // the pace at 0 and at span, when keys lie inside, is the line's own value there (held ends: the first and last key's)
  const at = (t: number): number => {
    if (t <= k[0]!.t) return pace(k[0]!.v);
    const last = k[k.length - 1]!;
    if (t >= last.t) return pace(last.v);
    for (let i = 0; i < k.length - 1; i++) {
      const a = k[i]!;
      const b = k[i + 1]!;
      if (t >= a.t && t <= b.t) return pace(a.v) + ((pace(b.v) - pace(a.v)) * (t - a.t)) / Math.max(1, b.t - a.t);
    }
    return pace(last.v);
  };
  pts[0] = [0, at(0)];
  pts[pts.length - 1] = [span, at(span)];
  const out: Seg[] = [];
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, pa] = pts[i]!;
    const [b, pb] = pts[i + 1]!;
    if (b <= a) continue;
    out.push({ a, b, pa, pb, at: acc });
    acc += ((pa + pb) / 2) * (b - a);
  }
  return out;
}

/** The pace (playing ms per ms of picture) at `u` ms into the picture. */
export function paceAt(keys: SpeedKey[], u: number): number {
  const k = sorted(keys);
  if (u <= k[0]!.t) return pace(k[0]!.v);
  const last = k[k.length - 1]!;
  if (u >= last.t) return pace(last.v);
  for (let i = 0; i < k.length - 1; i++) {
    const a = k[i]!;
    const b = k[i + 1]!;
    if (u >= a.t && u <= b.t) return pace(a.v) + ((pace(b.v) - pace(a.v)) * (u - a.t)) / Math.max(1, b.t - a.t);
  }
  return pace(last.v);
}

/** The speed at `u` ms into the picture. */
export const speedAt = (keys: SpeedKey[], u: number): number => 1 / paceAt(keys, u);

/** Playing time (ms) taken to reach `u` ms into the picture, at the clip's own speed 1 (divide by `speed` for the clip's). */
export function playTime(keys: SpeedKey[], u: number, span: number): number {
  if (!keys.length) return u;
  const x = Math.min(Math.max(0, u), span);
  let t = 0;
  for (const s of segments(keys, span)) {
    if (x >= s.b) {
      t = s.at + ((s.pa + s.pb) / 2) * (s.b - s.a);
      continue;
    }
    if (x > s.a) {
      const d = x - s.a;
      const p = s.pa + ((s.pb - s.pa) * d) / (s.b - s.a) / 2;
      t = s.at + p * d;
    } else t = s.at;
    break;
  }
  return t;
}

/** How far into the picture (ms) `t` ms of playing (at speed 1) reaches: the inverse of `playTime`. */
export function pictureAt(keys: SpeedKey[], t: number, span: number): number {
  if (!keys.length) return Math.min(Math.max(0, t), span);
  const segs = segments(keys, span);
  const total = playTime(keys, span, span);
  if (t <= 0) return 0;
  if (t >= total) return span;
  for (const s of segs) {
    const len = ((s.pa + s.pb) / 2) * (s.b - s.a);
    if (t > s.at + len) continue;
    const rem = t - s.at;
    const slope = (s.pb - s.pa) / (s.b - s.a);
    if (Math.abs(slope) < 1e-12) return s.a + rem / s.pa;
    // pa d + slope d^2 / 2 = rem
    const disc = Math.max(0, s.pa * s.pa + 2 * slope * rem);
    return s.a + (-s.pa + Math.sqrt(disc)) / slope;
  }
  return span;
}
