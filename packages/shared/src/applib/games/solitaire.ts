/**
 * SOLITAIRE (the seven-column patience genre: build down in alternating colours, home up by suit from the ace).
 * Options the board reads from GameConfig.options:
 *   draw: number (1 or 3 cards turned from the stock at a time, default 1)
 * Winnable deals: each deal is played out by a solver before he sees it, and the first deal from the seed that the
 * solver wins is the one dealt, so he is never handed a game that cannot be won.
 */
import { rng, shuffle } from './rng';

export type Loc = { t: 'waste' } | { t: 'tab'; i: number } | { t: 'found'; i: number };
export interface Column {
  down: number[];
  up: number[];
}
export interface Sol {
  stock: number[];
  waste: number[];
  found: number[][];
  tab: Column[];
  draw: 1 | 3;
  moves: number;
  passes: number;
}

/** Card numbers 0 to 51: suit = ⌊c / 13⌋ (0 spades, 1 hearts, 2 diamonds, 3 clubs), rank = c mod 13 + 1 (1 ace … 13 king). */
export const suit = (c: number): number => Math.floor(c / 13);
export const rank = (c: number): number => (c % 13) + 1;
export const red = (c: number): boolean => suit(c) === 1 || suit(c) === 2;
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUITS = ['♠', '♥', '♦', '♣'];
export const name = (c: number): string => `${RANKS[rank(c) - 1]}${SUITS[suit(c)]}`;

function layout(order: number[], draw: 1 | 3): Sol {
  const deck = order.slice();
  const tab: Column[] = [];
  for (let i = 0; i < 7; i++) {
    const cards = deck.splice(0, i + 1);
    tab.push({ down: cards.slice(0, -1), up: cards.slice(-1) });
  }
  return { stock: deck, waste: [], found: [[], [], [], []], tab, draw, moves: 0, passes: 0 };
}

export const clone = (s: Sol): Sol => ({
  ...s,
  stock: s.stock.slice(),
  waste: s.waste.slice(),
  found: s.found.map((f) => f.slice()),
  tab: s.tab.map((c) => ({ down: c.down.slice(), up: c.up.slice() })),
});

/** Turn the stock: draw cards onto the waste, or when it is empty turn the waste back over. */
export function turnStock(s: Sol): boolean {
  if (s.stock.length) {
    const n = Math.min(s.draw, s.stock.length);
    for (let k = 0; k < n; k++) s.waste.push(s.stock.pop()!);
  } else if (s.waste.length) {
    s.stock = s.waste.reverse();
    s.waste = [];
    s.passes++;
  } else return false;
  s.moves++;
  return true;
}

export const canStack = (c: number, onto: number | undefined): boolean =>
  onto === undefined ? rank(c) === 13 : rank(onto) === rank(c) + 1 && red(onto) !== red(c);
export const canHome = (s: Sol, c: number): boolean => s.found[suit(c)]!.length === rank(c) - 1;

/** The cards a move would lift from a place: from the waste or a home, only the top; from a column, `count` from the top. */
function lifted(s: Sol, from: Loc, count: number): number[] | null {
  if (from.t === 'waste') return count === 1 && s.waste.length ? [s.waste[s.waste.length - 1]!] : null;
  if (from.t === 'found') return count === 1 && s.found[from.i]!.length ? [s.found[from.i]![s.found[from.i]!.length - 1]!] : null;
  const up = s.tab[from.i]!.up;
  return count >= 1 && count <= up.length ? up.slice(up.length - count) : null;
}

export function canMove(s: Sol, from: Loc, count: number, to: Loc): boolean {
  const cards = lifted(s, from, count);
  if (!cards || to.t === 'waste') return false;
  if (from.t === to.t && from.i === (to as { i: number }).i) return false;
  if (to.t === 'found') return cards.length === 1 && suit(cards[0]!) === to.i && canHome(s, cards[0]!);
  const col = s.tab[to.i]!;
  return canStack(cards[0]!, col.up[col.up.length - 1] ?? (col.down.length ? -1 : undefined)) && !(col.down.length && !col.up.length);
}

/** Make a move (checked). The column it left turns its next card face up. */
export function move(s: Sol, from: Loc, count: number, to: Loc): boolean {
  if (!canMove(s, from, count, to)) return false;
  let cards: number[];
  if (from.t === 'waste') cards = [s.waste.pop()!];
  else if (from.t === 'found') cards = [s.found[from.i]!.pop()!];
  else {
    const col = s.tab[from.i]!;
    cards = col.up.splice(col.up.length - count, count);
    if (!col.up.length && col.down.length) col.up.push(col.down.pop()!);
  }
  if (to.t === 'found') s.found[to.i]!.push(...cards);
  else s.tab[(to as { i: number }).i]!.up.push(...cards);
  s.moves++;
  return true;
}

/** Where a tapped card should go: home first (for one card), then the first column that takes it. */
export function bestTarget(s: Sol, from: Loc, count: number): Loc | null {
  const cards = lifted(s, from, count);
  if (!cards) return null;
  if (cards.length === 1 && from.t !== 'found') {
    const home: Loc = { t: 'found', i: suit(cards[0]!) };
    if (canMove(s, from, 1, home)) return home;
  }
  const order = [...Array(7).keys()].sort((a, b) => Number(!s.tab[a]!.up.length) - Number(!s.tab[b]!.up.length));
  for (const i of order) if (canMove(s, from, count, { t: 'tab', i })) return { t: 'tab', i };
  return null;
}

export const won = (s: Sol): boolean => s.found.every((f) => f.length === 13);
/** Everything is face up and the stock is spent: the rest can go home on its own. */
export const canFinish = (s: Sol): boolean => !s.stock.length && !s.waste.length && s.tab.every((c) => !c.down.length);

/** Send every card that can go home, home (one at a time, as many as can). Returns how many went. */
export function sweepHome(s: Sol): number {
  let n = 0;
  let again = true;
  while (again) {
    again = false;
    const froms: Loc[] = [{ t: 'waste' }, ...[...Array(7).keys()].map((i) => ({ t: 'tab', i }) as Loc)];
    for (const f of froms) {
      const c = lifted(s, f, 1);
      if (c && canHome(s, c[0]!) && move(s, f, 1, { t: 'found', i: suit(c[0]!) })) {
        n++;
        again = true;
      }
    }
  }
  return n;
}

const keyOf = (s: Sol) => `${s.stock.join(',')}|${s.waste.join(',')}|${s.found.map((f) => f.length).join(',')}|${s.tab.map((c) => `${c.down.length}:${c.up.join(',')}`).sort().join('/')}`;

/** Try to win the deal by search (never moving a card back from home). True when it finds a win within the budget. */
export function solvable(start: Sol, budget = 25000): boolean {
  const seen = new Set<string>();
  const stack: Sol[] = [clone(start)];
  let nodes = 0;
  while (stack.length && nodes < budget) {
    const s = stack.pop()!;
    nodes++;
    const k = keyOf(s);
    if (seen.has(k)) continue;
    seen.add(k);
    sweepHome(s);
    if (won(s) || canFinish(s)) return true;
    const next: Sol[] = [];
    // stock turn (least preferred, pushed first so it is tried last)
    if (s.stock.length || s.waste.length) {
      const t = clone(s);
      turnStock(t);
      next.push(t);
    }
    // waste to a column
    if (s.waste.length)
      for (let i = 0; i < 7; i++)
        if (canMove(s, { t: 'waste' }, 1, { t: 'tab', i })) {
          const t = clone(s);
          move(t, { t: 'waste' }, 1, { t: 'tab', i });
          next.push(t);
        }
    // column to column: only moves that turn a card or empty a column for a king to use
    for (let a = 0; a < 7; a++) {
      const col = s.tab[a]!;
      for (let cnt = col.up.length; cnt >= 1; cnt--) {
        if (cnt !== col.up.length) continue; // whole runs only (a part-run move is rarely needed and doubles the search)
        if (!col.down.length && rank(col.up[0]!) === 13) continue;
        for (let b = 0; b < 7; b++)
          if (canMove(s, { t: 'tab', i: a }, cnt, { t: 'tab', i: b })) {
            const t = clone(s);
            move(t, { t: 'tab', i: a }, cnt, { t: 'tab', i: b });
            next.push(t);
            break;
          }
      }
    }
    stack.push(...next);
  }
  return false;
}

/** Deal: the first winnable deal from the seed (up to 40 tried). `checked` says the solver won it. */
export function deal(seed: number, draw: 1 | 3 = 1): Sol & { seed: number; checked: boolean } {
  for (let k = 0; k < 40; k++) {
    const s = layout(shuffle(rng(seed + k), [...Array(52).keys()]), draw);
    if (solvable(s)) return { ...s, seed: seed + k, checked: true };
  }
  return { ...layout(shuffle(rng(seed), [...Array(52).keys()]), draw), seed, checked: false };
}

/** Fewer moves and less time is more; each card home is worth 10. */
export const score = (s: Sol, secs: number): number => Math.max(0, s.found.reduce((a, f) => a + f.length, 0) * 10 + (won(s) ? Math.max(0, 1500 - s.moves * 3 - secs) : 0));
