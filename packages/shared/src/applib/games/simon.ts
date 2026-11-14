/**
 * SIMON (the repeat-the-growing-sequence genre). Options the board reads from GameConfig.options:
 *   pads:  number (3 to 6 pads, default 4)
 *   speed: number (milliseconds each pad lights, 250 to 900, default 520; it quickens every five rounds)
 * Each round adds one pad to the end; he taps the whole sequence back. One wrong tap ends the game.
 */
import { type Rng } from './rng';

export interface Simon {
  pads: number;
  seq: number[];
  at: number;
  over: boolean;
}

export const start = (pads: number, r: Rng): Simon => ({ pads, seq: [Math.floor(r() * pads)], at: 0, over: false });

/** He taps a pad: 'next' (keep going), 'round' (sequence done; a new pad was added), or 'wrong'. */
export function tap(s: Simon, pad: number, r: Rng): 'next' | 'round' | 'wrong' {
  if (s.over) return 'wrong';
  if (s.seq[s.at] !== pad) {
    s.over = true;
    return 'wrong';
  }
  s.at++;
  if (s.at < s.seq.length) return 'next';
  s.seq.push(Math.floor(r() * s.pads));
  s.at = 0;
  return 'round';
}

/** Rounds fully repeated (the score). */
export const rounds = (s: Simon): number => s.seq.length - 1;
export const flashMs = (s: Simon, speed: number): number => Math.max(180, Math.round(speed * Math.pow(0.92, Math.floor(rounds(s) / 5))));
