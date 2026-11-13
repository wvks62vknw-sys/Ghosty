/**
 * QUIET (BRIEF-EDITOR-VIDEO): silences in the mix found by the RMS of 50 ms windows staying under a threshold for over 600 ms,
 * and what cutting them saves. Pure.
 */

/** The RMS of each `win` ms window of a sound (mono is enough: the channels are averaged). */
export function rmsSeries(channels: Float32Array[], rate: number, win = 50): number[] {
  const n = channels[0]?.length ?? 0;
  const size = Math.max(1, Math.round((rate * win) / 1000));
  const out: number[] = [];
  for (let i = 0; i < n; i += size) {
    let s = 0;
    const end = Math.min(n, i + size);
    for (const ch of channels) for (let k = i; k < end; k++) s += ch[k]! * ch[k]!;
    out.push(Math.sqrt(s / ((end - i) * channels.length)));
  }
  return out;
}

export interface Pause {
  from: number;
  to: number;
}
/**
 * The pauses: stretches (ms) where the RMS stays under `threshold` for over `min` ms. Each is trimmed by `keep` ms at both ends
 * so the words either side are not clipped (the silence must be over `min` before it counts).
 */
export function findPauses(series: number[], win = 50, threshold = 0.02, min = 600, keep = 150): Pause[] {
  const out: Pause[] = [];
  let from = -1;
  const close = (end: number) => {
    if (from >= 0 && end - from > min) {
      const a = from + keep;
      const z = end - keep;
      if (z - a > 0) out.push({ from: a, to: z });
    }
    from = -1;
  };
  series.forEach((v, i) => {
    if (v < threshold) {
      if (from < 0) from = i * win;
    } else close(i * win);
  });
  close(series.length * win);
  return out;
}
export const timeSaved = (p: Pause[]): number => p.reduce((n, x) => n + (x.to - x.from), 0);
