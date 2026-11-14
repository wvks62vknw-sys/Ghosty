/**
 * REACTION (the wait-for-the-signal-then-tap genre). Options the board reads from GameConfig.options:
 *   rounds: number (3 to 10, default 5)
 *   minMs:  number (shortest wait before the signal, default 1200)
 *   maxMs:  number (longest wait, default 4000)
 * A tap before the signal is an early start and that round is taken again. The score is the average in milliseconds
 * (lower is better), so the best kept is the lowest.
 */
import { type Rng } from './rng';

export const waitMs = (r: Rng, minMs: number, maxMs: number): number => Math.round(minMs + r() * Math.max(0, maxMs - minMs));
export const average = (times: readonly number[]): number => (times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0);
/** Plain words for a time, from published reaction-time norms (about 200 to 300 ms for a simple visual signal). */
export function verdict(ms: number): string {
  if (ms < 200) return 'Very quick';
  if (ms < 260) return 'Quick';
  if (ms < 330) return 'Typical';
  return 'Steady';
}
