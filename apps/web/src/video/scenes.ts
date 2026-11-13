/**
 * SCENES (BRIEF-EDITOR-VIDEO): a cut found where the picture's colour histogram jumps between sampled frames (four a second).
 * `histogram` reads a frame's pixels; `findCuts` judges the series. Pure.
 */

/** A 4 × 4 × 4 colour histogram of RGBA pixels, each bin a share of the pixels (the bins sum to one). */
export function histogram(rgba: Uint8ClampedArray | Uint8Array): Float32Array {
  const h = new Float32Array(64);
  const n = rgba.length / 4;
  for (let i = 0; i < rgba.length; i += 4) h[(rgba[i]! >> 6) * 16 + (rgba[i + 1]! >> 6) * 4 + (rgba[i + 2]! >> 6)]! += 1 / n;
  return h;
}
/** Half the sum of absolute differences: 0 for the same picture, 1 for none in common. */
export function histDistance(a: Float32Array, b: Float32Array): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += Math.abs(a[i]! - b[i]!);
  return d / 2;
}

/**
 * The times (ms) where the picture cuts: the distance between neighbouring samples over `threshold`, and the biggest of any
 * run of over-threshold neighbours (a fade is one cut, not five). `step` is the milliseconds between samples. The time said
 * is the first sample after the cut.
 */
export function findCuts(hists: Float32Array[], step = 250, threshold = 0.35): number[] {
  const d = hists.slice(1).map((h, i) => histDistance(hists[i]!, h));
  const cuts: number[] = [];
  for (let i = 0; i < d.length; i++) {
    if (d[i]! < threshold) continue;
    let best = i;
    while (i + 1 < d.length && d[i + 1]! >= threshold) {
      i++;
      if (d[i]! > d[best]!) best = i;
    }
    cuts.push((best + 1) * step);
  }
  return cuts;
}
