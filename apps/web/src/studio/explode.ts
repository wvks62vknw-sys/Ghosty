/**
 * TAKE APART, as plain numbers (no three.js here, so it is unit-tested in Node): where each part
 * goes when a model is exploded. Each part moves out along the line from the model's centre to
 * its own centre, further the further out it already is, plus a little for everyone so parts
 * that touch come clear of each other. Parts sitting right at the centre (an axle, a core, rings
 * round the same middle) have no line of their own: those are stacked along one axis — the
 * model's thinnest, as in a drawn exploded view — so nothing stays buried.
 */
export type V3 = [number, number, number];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);

/**
 * How far each part travels at 100 % (added to where it sits). `size` is the model's largest
 * dimension; `spread` (default 1) scales the whole explosion; `axis` (a unit vector, default up)
 * is where parts at the centre are stacked, in the order given, the middle one staying put.
 */
export function explodeOffsets(center: V3, parts: V3[], size: number, spread = 1, axis: V3 = [0, 1, 0]): V3[] {
  const s = Math.max(size, 1e-9);
  const lone: number[] = [];
  const out: V3[] = parts.map((c, i) => {
    const d = sub(c, center);
    const l = len(d);
    if (l < s * 0.02) {
      lone.push(i);
      return [0, 0, 0];
    }
    const k = (l * 1.2 + s * 0.35) * spread;
    return [(d[0] / l) * k, (d[1] / l) * k, (d[2] / l) * k];
  });
  const al = len(axis) || 1;
  lone.forEach((idx, j) => {
    const k = (j - (lone.length - 1) / 2) * s * 0.4 * spread;
    out[idx] = [(axis[0] / al) * k, (axis[1] / al) * k, (axis[2] / al) * k];
  });
  return out;
}

/** The axis a model is thinnest along (x, y or z), from its size. */
export function thinnestAxis(size: V3): V3 {
  const i = size[0] <= size[1] && size[0] <= size[2] ? 0 : size[1] <= size[2] ? 1 : 2;
  return [i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0];
}

/** Ease in and out, for the take-apart and reassemble animations. */
export const ease = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};

/** A part's position at explosion fraction `t` (0 together, 1 fully apart). */
export const at = (home: V3, offset: V3, t: number): V3 => [home[0] + offset[0] * t, home[1] + offset[1] * t, home[2] + offset[2] * t];

/**
 * A distance for the MEASURE readout. `metres` says the model is in real metres (rooms, and
 * glTF models are metres by convention but a made-up model is not), so it shows cm/m; otherwise
 * plain model units.
 */
export function fmtLength(d: number, metres: boolean): string {
  if (!Number.isFinite(d)) return '—';
  if (!metres) return `${d < 10 ? d.toFixed(3) : d.toFixed(2)} units`;
  if (d < 1) return `${(d * 100).toFixed(1)} cm`;
  return `${d.toFixed(2)} m`;
}
