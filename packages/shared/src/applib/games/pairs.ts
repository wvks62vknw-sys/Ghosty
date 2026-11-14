/**
 * PAIRS (the memory-matching genre). Options the board reads from GameConfig.options:
 *   pairs: number (4 to 15, default 8)
 *   cols:  number (2 to 6, default 4)
 *   set:   string[] (the faces: 'France|Paris' makes a pair of two halves that match; other entries show as words)
 *   levels: string[] (pair counts offered in a picker, e.g. ['6', '8', '12'])
 * Cards are dealt face down; turn two, keep them if they match. Fewer turns is a better score.
 */
import { rng, shuffle } from './rng';

export interface Pairs {
  cards: number[];
  gone: boolean[];
  up: number[];
  turns: number;
}

export function deal(pairs: number, seed: number): Pairs {
  const ids = [...Array(pairs).keys()];
  return { cards: shuffle(rng(seed), [...ids, ...ids]), gone: Array(pairs * 2).fill(false), up: [], turns: 0 };
}

/** Turn a card. Returns 'match' or 'miss' when it is the second of two, 'one' for the first, '' when not allowed. */
export function flip(p: Pairs, i: number): '' | 'one' | 'match' | 'miss' {
  if (p.gone[i] || p.up.includes(i) || p.up.length >= 2) return '';
  p.up.push(i);
  if (p.up.length === 1) return 'one';
  p.turns++;
  const [a, b] = p.up as [number, number];
  if (p.cards[a] === p.cards[b]) {
    p.gone[a] = p.gone[b] = true;
    p.up = [];
    return 'match';
  }
  return 'miss';
}

/** Turn a missed pair back face down. */
export const hide = (p: Pairs): void => void (p.up = []);
export const done = (p: Pairs): boolean => p.gone.every(Boolean);
/** Perfect play takes as many turns as pairs; each extra turn costs. */
export const score = (p: Pairs, secs: number): number => Math.max(10, Math.round((p.cards.length / 2) * 200 - (p.turns - p.cards.length / 2) * 40 - secs));

/** What each card shows for a set of faces: a text pair's halves (first and second card of the pair), or the word. */
export function faces(p: Pairs, set: readonly string[]): string[] {
  const seen = new Set<number>();
  return p.cards.map((id) => {
    const e = set[id % Math.max(1, set.length)] ?? '';
    const [a, b] = e.split('|').map((x) => x.trim());
    const second = seen.has(id);
    seen.add(id);
    return b !== undefined ? (second ? b : a!) : e;
  });
}
