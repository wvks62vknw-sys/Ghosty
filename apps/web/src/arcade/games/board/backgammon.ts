/**
 * BACKGAMMON (no doubling cube): fifteen checkers each, twenty-four points, two dice rolled fairly (a seeded roll the game
 * makes and shows, never Ghosty). A side must use both dice if it can, or the larger if it can use only one; a lone checker
 * (a blot) that is hit goes to the bar and must come in before anything else moves; a point of two or more is blocked;
 * once all fifteen are in the home board they bear off; doubles play four times. The first to bear off all fifteen wins.
 *
 * Points are numbered 0…23 along the board's path. Side 1 starts at 0 and goes up, home is 18…23; side 2 starts at 23
 * and goes down, home is 0…5. A cell is a point 0…23, the bar is 24 and bearing off is 25. A move is one checker, one die.
 */
import type { BoardGame, Result, Side } from './kit';
import { other } from './kit';

export const BAR = 24;
export const OFF = 25;

export interface BgState {
  /** Checkers on each point: positive side 1, negative side 2. */
  p: Int8Array;
  /** On the bar, borne off: indexed by side (0 unused). */
  bar: Int8Array;
  off: Int8Array;
  /** The dice left to play, and the whole roll (to show). */
  dice: number[];
  roll: number[];
  side: Side;
  /** How many moves have been played (the seed of the next roll). */
  ply: number;
  w: Result;
}
export interface BgMove {
  f: number;
  t: number;
  d: number;
}

export function start(seed: number): BgState {
  const p = new Int8Array(24);
  p[0] = 2;
  p[11] = 5;
  p[16] = 3;
  p[18] = 5;
  p[23] = -2;
  p[12] = -5;
  p[7] = -3;
  p[5] = -5;
  const s: BgState = { p, bar: new Int8Array(3), off: new Int8Array(3), dice: [], roll: [], side: 1, ply: 0, w: 0 };
  let k = seed >>> 0 || 1;
  const rnd = () => ((k = (Math.imul(k, 1664525) + 1013904223) >>> 0) / 4294967296);
  rollFor(s, rnd);
  return s;
}
function rollFor(s: BgState, rnd: () => number): void {
  const a = 1 + Math.floor(rnd() * 6);
  const b = 1 + Math.floor(rnd() * 6);
  s.roll = [a, b];
  s.dice = a === b ? [a, a, a, a] : [a, b];
}
const clone = (s: BgState): BgState => ({ p: s.p.slice(), bar: s.bar.slice(), off: s.off.slice(), dice: s.dice.slice(), roll: s.roll.slice(), side: s.side, ply: s.ply, w: s.w });

const dirOf = (side: Side): number => (side === 1 ? 1 : -1);
const mineAt = (s: BgState, i: number, side: Side): number => (side === 1 ? Math.max(0, s.p[i]!) : Math.max(0, -s.p[i]!));
const theirsAt = (s: BgState, i: number, side: Side): number => mineAt(s, i, other(side));
const homeOf = (side: Side): [number, number] => (side === 1 ? [18, 23] : [0, 5]);
export function allHome(s: BgState, side: Side): boolean {
  if (s.bar[side]) return false;
  const [a, b] = homeOf(side);
  for (let i = 0; i < 24; i++) if (mineAt(s, i, side) && (i < a || i > b)) return false;
  return true;
}

/** Every single-checker move the dice allow, before the rule about using both dice. */
function singles(s: BgState): BgMove[] {
  const side = s.side;
  const out: BgMove[] = [];
  let seen = 0;
  const dir = dirOf(side);
  for (let di = 0; di < s.dice.length; di++) {
    const d = s.dice[di]!;
    if (seen & (1 << d)) continue;
    seen |= 1 << d;
    if (s.bar[side]) {
      const t = side === 1 ? d - 1 : 24 - d;
      if (theirsAt(s, t, side) < 2) out.push({ f: BAR, t, d });
      continue;
    }
    const home = allHome(s, side);
    for (let f = 0; f < 24; f++) {
      if (!mineAt(s, f, side)) continue;
      const t = f + dir * d;
      if (t >= 0 && t <= 23) {
        if (theirsAt(s, t, side) < 2) out.push({ f, t, d });
      } else if (home) {
        const exact = side === 1 ? f + d === 24 : f - d === -1;
        if (exact) out.push({ f, t: OFF, d });
        else {
          // a die bigger than the distance bears off the farthest checker only
          let behind = false;
          if (side === 1) {
            for (let i = 18; i < f; i++) if (mineAt(s, i, side)) behind = true;
          } else {
            for (let i = f + 1; i <= 5; i++) if (mineAt(s, i, side)) behind = true;
          }
          if (!behind) out.push({ f, t: OFF, d });
        }
      }
    }
  }
  return out;
}
function step(s: BgState, m: BgMove): BgState {
  const n = clone(s);
  const side = s.side;
  const sg = side === 1 ? 1 : -1;
  if (m.f === BAR) n.bar[side]!--;
  else n.p[m.f] = n.p[m.f]! - sg;
  if (m.t === OFF) n.off[side]!++;
  else {
    if (theirsAt(n, m.t, side) === 1) {
      n.p[m.t] = 0;
      n.bar[other(side)]!++;
    }
    n.p[m.t] = n.p[m.t]! + sg;
  }
  const i = n.dice.indexOf(m.d);
  if (i >= 0) n.dice.splice(i, 1);
  return n;
}
/** One die's move made on `n` in place (the search of what can be played goes in and out of it without copying); true if it hit. */
function doStep(n: BgState, m: BgMove): boolean {
  const side = n.side;
  const sg = side === 1 ? 1 : -1;
  if (m.f === BAR) n.bar[side]!--;
  else n.p[m.f] = n.p[m.f]! - sg;
  let hit = false;
  if (m.t === OFF) n.off[side]!++;
  else {
    if (theirsAt(n, m.t, side) === 1) {
      n.p[m.t] = 0;
      n.bar[other(side)]!++;
      hit = true;
    }
    n.p[m.t] = n.p[m.t]! + sg;
  }
  const i = n.dice.indexOf(m.d);
  if (i >= 0) {
    n.dice[i] = n.dice[n.dice.length - 1]!;
    n.dice.pop();
  }
  return hit;
}
function undoStep(n: BgState, m: BgMove, hit: boolean): void {
  const side = n.side;
  const sg = side === 1 ? 1 : -1;
  n.dice.push(m.d);
  if (m.t === OFF) n.off[side]!--;
  else {
    n.p[m.t] = n.p[m.t]! - sg;
    if (hit) {
      n.p[m.t] = -sg;
      n.bar[other(side)]!--;
    }
  }
  if (m.f === BAR) n.bar[side]!++;
  else n.p[m.f] = n.p[m.f]! + sg;
}
/** The most single moves that can still be played from here (the rule: play as many dice as you can); `w` is put back as it was. */
function maxPlies(w: BgState): number {
  if (!w.dice.length) return 0;
  const ms = singles(w);
  const cap = w.dice.length;
  let best = 0;
  for (const m of ms) {
    const hit = doStep(w, m);
    const v = 1 + maxPlies(w);
    undoStep(w, m, hit);
    if (v > best) best = v;
    if (best === cap) break;
  }
  return best;
}
const legalMemo = new WeakMap<BgState, BgMove[]>();
export function legalMoves(s: BgState): BgMove[] {
  const c = legalMemo.get(s);
  if (c) return c;
  if (s.w || !s.dice.length) return [];
  const ms = singles(s);
  const w = clone(s);
  const total = maxPlies(w);
  let ok = ms.filter((m) => {
    const hit = doStep(w, m);
    const v = 1 + maxPlies(w);
    undoStep(w, m, hit);
    return v === total;
  });
  // only one die can be played: it must be the larger one, if either could be
  if (total === 1 && s.dice.length >= 2 && s.dice[0] !== s.dice[1]) {
    const big = Math.max(...s.dice);
    if (ok.some((m) => m.d === big)) ok = ok.filter((m) => m.d === big);
  }
  legalMemo.set(s, ok);
  return ok;
}

/** After a move: hand over the dice (a fresh fair roll for the next side) when they are used or nothing can be played. */
function settle(s: BgState, rnd: () => number): BgState {
  for (let guard = 0; guard < 8; guard++) {
    if (s.w) return s;
    if (s.off[s.side]! >= 15) {
      s = clone(s);
      s.w = s.side;
      return s;
    }
    if (s.dice.length && legalMoves(s).length) return s;
    // a new object: what was worked out for this one (the memo) is about its old dice
    s = clone(s);
    s.side = other(s.side);
    s.ply++;
    rollFor(s, rnd);
  }
  return s;
}

export function pips(s: BgState, side: Side): number {
  let t = s.bar[side]! * 25;
  for (let i = 0; i < 24; i++) t += mineAt(s, i, side) * (side === 1 ? 24 - i : i + 1);
  return t;
}
const blots = (s: BgState, side: Side): number => {
  let n = 0;
  for (let i = 0; i < 24; i++) if (mineAt(s, i, side) === 1) n++;
  return n;
};
function prime(s: BgState, side: Side): number {
  let best = 0;
  let run = 0;
  for (let i = 0; i < 24; i++) {
    run = mineAt(s, i, side) >= 2 ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}
function features(s: BgState, side: Side): number[] {
  const opp = other(side);
  const [a, b] = homeOf(side);
  const [oa, ob] = homeOf(opp);
  let made = 0;
  let omade = 0;
  for (let i = a; i <= b; i++) if (mineAt(s, i, side) >= 2) made++;
  for (let i = oa; i <= ob; i++) if (mineAt(s, i, opp) >= 2) omade++;
  return [(pips(s, opp) - pips(s, side)) / 80, (s.off[side]! - s.off[opp]!) / 15, (s.bar[opp]! - s.bar[side]!) / 3, (blots(s, opp) - blots(s, side)) / 6, (made - omade) / 6, (prime(s, side) - prime(s, opp)) / 6];
}

export const backgammon: BoardGame<BgState, BgMove> = {
  id: 'backgammon',
  name: 'Backgammon',
  start,
  side: (s) => s.side,
  legal: (s) => legalMoves(s),
  apply: (s, m, rnd) => settle(step(s, m), rnd),
  result: (s) => s.w,
  features,
  hand: [2.4, 1.6, 0.9, 0.6, 0.9, 0.7],
  key: (m) => `${m.f}-${m.t}-${m.d}`,
  from: (m) => m.f,
  to: (m) => m.t,
  words: { first: 'White', second: 'Black' },
};
