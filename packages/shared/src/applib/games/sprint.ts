/**
 * SPRINT (the quick-fire mental-arithmetic genre). Options the board reads from GameConfig.options:
 *   secs: number (seconds a run lasts, 30 to 180, default 60)
 *   ops:  string ('+-' or any of + - × ÷, default '+-×÷')
 *   max:  number (the largest number in a sum, 10 to 100, default 20)
 * Division sums always come out whole, and subtraction never goes below zero.
 */
import { type Rng, int, pick } from './rng';

export interface Sum {
  text: string;
  answer: number;
}

export function sum(r: Rng, ops: string, max: number): Sum {
  const allowed = [...ops].filter((o) => '+-×÷'.includes(o));
  const op = pick(r, allowed.length ? allowed : ['+']);
  if (op === '+') {
    const a = int(r, 1, max);
    const b = int(r, 1, max);
    return { text: `${a} + ${b}`, answer: a + b };
  }
  if (op === '-') {
    const a = int(r, 1, max);
    const b = int(r, 0, a);
    return { text: `${a} − ${b}`, answer: a - b };
  }
  const lim = Math.max(2, Math.min(12, Math.round(Math.sqrt(max * 7))));
  const a = int(r, 2, lim);
  const b = int(r, 2, lim);
  return op === '×' ? { text: `${a} × ${b}`, answer: a * b } : { text: `${a * b} ÷ ${a}`, answer: b };
}

/** Ten points a right answer, with a run bonus of two for each in a row after the first. */
export const points = (streak: number): number => 10 + Math.max(0, streak - 1) * 2;
