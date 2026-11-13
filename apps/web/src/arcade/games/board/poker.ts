/**
 * POKER, heads-up hold'em against Ghosty, in CHIPS ONLY (the card says so in one line: CHIPS_LINE). Nothing in this file is,
 * becomes or is worded as anything but a count of chips. The rules are the standard ones: a deck of 52, two cards each, five
 * on the board in three steps, the player on the button posts the small blind and acts first before the flop, the other acts
 * first after it; fold, check, call, bet or raise (to a total) with a minimum raise, all-in allowed. A session is 20 hands or a
 * bust; the deal of hand n is a seeded shuffle (seed + n), so a saved session replays exactly.
 *
 * GHOSTY'S PLAY (it runs in the board Worker, from `View`, which holds only what he may see). He keeps a weighted range for your
 * two cards that narrows with every action you took in the hand (a raise leaves the strong hands and a thin share of bluffs; a
 * call, the middling ones; a check, the weaker); he estimates his chance of winning by dealing the rest of the cards at random
 * against that range (Monte Carlo, as many as his thinking time allows); he weighs fold, call and raise by what the pot odds
 * and your likely folds make each worth, with a bet-sizing table by street; a bluff now and then (a share that rises with his
 * level); and a noise on every worth that shrinks with the level (level 1 misjudges a lot, level 20 almost never). The time gives
 * more deals and finer bet sizes, and there is no top level.
 */
import { rngAt, rngOf } from './kit';

export const CHIPS_LINE = 'Chips, never money.';
export const HANDS = 20;
export const START_CHIPS = 1000;

export type Seat = 0 | 1; // 0 is you, 1 is Ghosty

// ---------------------------------------------------------------- cards

export const rankOf = (c: number): number => (c % 13) + 2;
export const suitOf = (c: number): number => (c / 13) | 0;
const RANK_WORD = ['', '', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king', 'ace'];
const RANK_CH = '??23456789TJQKA';
const SUIT_CH = ['♣', '♦', '♥', '♠'];
const SUIT_WORD = ['clubs', 'diamonds', 'hearts', 'spades'];
export const cardText = (c: number): string => `${RANK_CH[rankOf(c)]!.replace('T', '10')}${SUIT_CH[suitOf(c)]}`;
export const cardWords = (c: number): string => `${RANK_WORD[rankOf(c)]} of ${SUIT_WORD[suitOf(c)]}`;
const plural = (r: number): string => (r === 6 ? 'sixes' : `${RANK_WORD[r]}s`);
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** A fair, seeded shuffle of the 52 cards (the same seed, the same deck). */
export function shuffled(rnd: () => number): number[] {
  const d = Array.from({ length: 52 }, (_, i) => i);
  for (let i = 51; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [d[i], d[j]] = [d[j]!, d[i]!];
  }
  return d;
}

// ---------------------------------------------------------------- ranking

const BASE = 15 ** 5;
const pack = (cat: number, ranks: readonly number[]): number => {
  let v = cat;
  for (let i = 0; i < 5; i++) v = v * 15 + (ranks[i] ?? 0);
  return v;
};
/** The high card of the best straight in a mask of ranks (bit r for rank r, 2…14), 0 if none; the ace also plays low. */
function straightHigh(mask: number): number {
  const m = mask | (mask & (1 << 14) ? 2 : 0);
  for (let hi = 14; hi >= 5; hi--) if (((m >> (hi - 4)) & 31) === 31) return hi;
  return 0;
}
/** The strength of the best five of up to seven cards, as one number (a higher number wins; equal numbers tie). */
export function evaluate(cards: readonly number[]): number {
  const rc = new Int8Array(15);
  const sc = [0, 0, 0, 0];
  const sm = [0, 0, 0, 0];
  let all = 0;
  for (const c of cards) {
    const r = rankOf(c);
    const s = suitOf(c);
    rc[r]!++;
    sc[s]!++;
    sm[s]! |= 1 << r;
    all |= 1 << r;
  }
  let fs = -1;
  for (let s = 0; s < 4; s++) if (sc[s]! >= 5) fs = s;
  if (fs >= 0) {
    const sf = straightHigh(sm[fs]!);
    if (sf) return pack(8, [sf]);
  }
  let quad = 0;
  const trips: number[] = [];
  const pairs: number[] = [];
  for (let r = 14; r >= 2; r--) {
    const n = rc[r]!;
    if (n === 4) quad = r;
    else if (n === 3) trips.push(r);
    else if (n === 2) pairs.push(r);
  }
  const others = (skip: readonly number[], n: number): number[] => {
    const out: number[] = [];
    for (let r = 14; r >= 2 && out.length < n; r--) if (rc[r]! > 0 && !skip.includes(r)) out.push(r);
    return out;
  };
  if (quad) return pack(7, [quad, ...others([quad], 1)]);
  if (trips.length && (trips.length > 1 || pairs.length)) return pack(6, [trips[0]!, Math.max(trips[1] ?? 0, pairs[0] ?? 0)]);
  if (fs >= 0) {
    const top: number[] = [];
    for (let r = 14; r >= 2 && top.length < 5; r--) if (sm[fs]! & (1 << r)) top.push(r);
    return pack(5, top);
  }
  const st = straightHigh(all);
  if (st) return pack(4, [st]);
  if (trips.length) return pack(3, [trips[0]!, ...others([trips[0]!], 2)]);
  if (pairs.length >= 2) return pack(2, [pairs[0]!, pairs[1]!, ...others([pairs[0]!, pairs[1]!], 1)]);
  if (pairs.length === 1) return pack(1, [pairs[0]!, ...others([pairs[0]!], 3)]);
  return pack(0, others([], 5));
}
export const categoryOf = (v: number): number => Math.floor(v / BASE);
const digits = (v: number): number[] => {
  const out: number[] = [];
  let x = v % BASE;
  for (let i = 0; i < 5; i++) {
    out.unshift(x % 15);
    x = Math.floor(x / 15);
  }
  return out;
};
/** A hand in words: "Two pair, kings and fours", "Flush, ace high", "A pair of nines". */
export function handName(v: number): string {
  const c = categoryOf(v);
  const d = digits(v);
  switch (c) {
    case 8:
      return d[0] === 14 ? 'Royal flush' : `Straight flush, ${RANK_WORD[d[0]!]} high`;
    case 7:
      return `Four of a kind, ${plural(d[0]!)}`;
    case 6:
      return `Full house, ${plural(d[0]!)} full of ${plural(d[1]!)}`;
    case 5:
      return `Flush, ${RANK_WORD[d[0]!]} high`;
    case 4:
      return `Straight, ${RANK_WORD[d[0]!]} high`;
    case 3:
      return `Three of a kind, ${plural(d[0]!)}`;
    case 2:
      return `Two pair, ${plural(d[0]!)} and ${plural(d[1]!)}`;
    case 1:
      return `A pair of ${plural(d[0]!)}`;
    default:
      return cap(`${RANK_WORD[d[0]!]} high`);
  }
}

// ---------------------------------------------------------------- the blinds

const BLINDS = [10, 20, 30, 40, 60, 80, 100, 150, 200, 300, 400, 600, 800, 1000];
/** The big blind of hand `n` (1…) at a level: it rises with the level (every second level) and with the hands (every fifth). */
export const bigBlind = (level: number, n: number): number => BLINDS[Math.min(BLINDS.length - 1, Math.floor((Math.max(1, level) - 1) / 2) + Math.floor((Math.max(1, n) - 1) / 5))]!;

// ---------------------------------------------------------------- a hand

export interface Act {
  by: Seat;
  t: 'fold' | 'check' | 'call' | 'raise';
  /** The total bet this street after it (a raise), else what it was called to. */
  to: number;
  /** Chips this action added. */
  amt: number;
  street: number;
  /** The pot with every chip in front of both before this action. */
  pot: number;
}
export interface Hand {
  n: number;
  sb: number;
  bb: number;
  button: Seat;
  start: [number, number];
  stacks: [number, number];
  bets: [number, number];
  pot: number;
  hole: [[number, number], [number, number]];
  board: number[];
  deck: number[];
  street: 0 | 1 | 2 | 3;
  toAct: Seat;
  acted: [boolean, boolean];
  raiseSize: number;
  over: boolean;
  folded: -1 | 0 | 1;
  /** -1 not yet, 0 you, 1 Ghosty, 2 split. */
  winner: -1 | 0 | 1 | 2;
  showdown: boolean;
  names: [string, string];
  won: number;
  log: Act[];
}
export interface Session {
  seed: number;
  level: number;
  /** Hands in the session (20) and the chips each side starts with: a spec or a test may shorten them. */
  limit: number;
  start: number;
  /** Hands finished. */
  n: number;
  stacks: [number, number];
  over: boolean;
  history: HandRec[];
}
export interface HandRec {
  n: number;
  button: Seat;
  bb: number;
  hole: [[number, number], [number, number]];
  board: number[];
  log: Act[];
  winner: 0 | 1 | 2;
  names: [string, string];
  showdown: boolean;
  /** Your chips gained (or lost) in the hand. */
  delta: number;
  line: string;
}

export const newSession = (seed: number, level: number, limit = HANDS, start = START_CHIPS): Session => ({ seed: seed >>> 0 || 1, level: Math.max(1, Math.floor(level)), limit: Math.max(1, Math.floor(limit)), start, n: 0, stacks: [start, start], over: false, history: [] });
const shown = (street: number): number => [0, 3, 4, 5][street]!;

/** Deal hand n+1: blinds posted, cards dealt from the seeded shuffle. */
export function deal(s: Session): Hand {
  const n = s.n + 1;
  const deck = shuffled(rngAt(s.seed, n));
  const bb = bigBlind(s.level, n);
  const sb = Math.max(1, Math.floor(bb / 2));
  const button: Seat = n % 2 === 1 ? 0 : 1;
  const h: Hand = {
    n,
    sb,
    bb,
    button,
    start: [s.stacks[0], s.stacks[1]],
    stacks: [s.stacks[0], s.stacks[1]],
    bets: [0, 0],
    pot: 0,
    hole: [[deck[0]!, deck[2]!], [deck[1]!, deck[3]!]],
    board: [],
    deck,
    street: 0,
    toAct: button,
    acted: [false, false],
    raiseSize: bb,
    over: false,
    folded: -1,
    winner: -1,
    showdown: false,
    names: ['', ''],
    won: 0,
    log: [],
  };
  const post = (p: Seat, amt: number) => {
    const a = Math.min(amt, h.stacks[p]);
    h.stacks[p] -= a;
    h.bets[p] += a;
  };
  post(button, sb);
  post((1 - button) as Seat, bb);
  settleStreet(h);
  return h;
}

export interface Legal {
  fold: boolean;
  check: boolean;
  /** Chips to call (0 when checking). */
  call: number;
  canRaise: boolean;
  minTo: number;
  maxTo: number;
}
export function legalOf(h: Hand): Legal {
  const me = h.toAct;
  const opp = (1 - me) as Seat;
  const owed = Math.max(0, h.bets[opp] - h.bets[me]);
  const maxTo = Math.min(h.bets[me] + h.stacks[me], h.bets[opp] + h.stacks[opp]);
  const canRaise = !h.over && maxTo > h.bets[opp];
  const minTo = Math.min(maxTo, h.bets[opp] + Math.max(h.raiseSize, h.bb));
  return { fold: !h.over && owed > 0, check: !h.over && owed === 0, call: Math.min(owed, h.stacks[me]), canRaise, minTo, maxTo };
}
export const potOf = (h: Hand): number => h.pot + h.bets[0] + h.bets[1];

/** Close the betting round if it is closed: a fold ends the hand, matched bets (or an all-in answered) deal the next cards. */
function settleStreet(h: Hand): void {
  for (let guard = 0; guard < 6 && !h.over; guard++) {
    const [a, b] = h.bets;
    const in0 = h.stacks[0] === 0;
    const in1 = h.stacks[1] === 0;
    let closed: boolean;
    if (in0 && in1) closed = true;
    else if (in0) closed = b >= a;
    else if (in1) closed = a >= b;
    else closed = a === b && h.acted[0] && h.acted[1];
    if (!closed) return;
    // an all-in that could not be fully answered gives the extra back
    if (a !== b) {
      const big: Seat = a > b ? 0 : 1;
      const back = Math.abs(a - b);
      h.bets[big] -= back;
      h.stacks[big] += back;
    }
    h.pot += h.bets[0] + h.bets[1];
    h.bets = [0, 0];
    if (h.street === 3 || in0 || in1) {
      h.board = h.deck.slice(4, 9);
      return showdown(h);
    }
    h.street = (h.street + 1) as 1 | 2 | 3;
    h.board = h.deck.slice(4, 4 + shown(h.street));
    h.acted = [false, false];
    h.raiseSize = h.bb;
    h.toAct = (1 - h.button) as Seat;
  }
}
function showdown(h: Hand): void {
  const v0 = evaluate([...h.hole[0], ...h.board]);
  const v1 = evaluate([...h.hole[1], ...h.board]);
  h.showdown = true;
  h.names = [handName(v0), handName(v1)];
  const pot = h.pot;
  h.pot = 0;
  h.over = true;
  h.won = pot;
  if (v0 === v1) {
    h.winner = 2;
    const half = Math.floor(pot / 2);
    h.stacks[0] += half;
    h.stacks[1] += half;
    if (pot % 2) h.stacks[(1 - h.button) as Seat]++;
  } else {
    h.winner = v0 > v1 ? 0 : 1;
    h.stacks[h.winner] += pot;
  }
}

/** Make a move for whoever is to act (it throws if the move is not legal). A raise's `to` is the new total bet this street. */
export function act(h: Hand, a: { t: Act['t']; to?: number }): Act {
  if (h.over) throw new Error('the hand is over');
  const me = h.toAct;
  const opp = (1 - me) as Seat;
  const L = legalOf(h);
  const pot = potOf(h);
  let rec: Act;
  if (a.t === 'fold') {
    if (!L.fold) throw new Error('nothing to fold to');
    rec = { by: me, t: 'fold', to: h.bets[me], amt: 0, street: h.street, pot };
    h.log.push(rec);
    h.folded = me;
    h.pot += h.bets[0] + h.bets[1];
    h.bets = [0, 0];
    h.over = true;
    h.winner = opp;
    h.won = h.pot;
    h.stacks[opp] += h.pot;
    h.pot = 0;
    return rec;
  }
  if (a.t === 'check') {
    if (!L.check) throw new Error('cannot check');
    rec = { by: me, t: 'check', to: h.bets[me], amt: 0, street: h.street, pot };
  } else if (a.t === 'call') {
    if (L.fold === false) throw new Error('nothing to call');
    h.stacks[me] -= L.call;
    h.bets[me] += L.call;
    rec = { by: me, t: 'call', to: h.bets[me], amt: L.call, street: h.street, pot };
  } else {
    const to = Math.round(a.to ?? 0);
    if (!L.canRaise || to > L.maxTo || (to < L.minTo && to !== L.maxTo)) throw new Error('that raise is not allowed');
    const add = to - h.bets[me];
    if (add <= 0) throw new Error('that raise is not allowed');
    if (to - h.bets[opp] >= Math.max(h.raiseSize, h.bb)) h.raiseSize = to - h.bets[opp];
    h.stacks[me] -= add;
    h.bets[me] = to;
    rec = { by: me, t: 'raise', to, amt: add, street: h.street, pot };
  }
  h.acted[me] = true;
  h.log.push(rec);
  h.toAct = opp;
  settleStreet(h);
  return rec;
}

/** After a hand: the stacks carry on, the hand is kept in the history, and the session is over after 20 hands or a bust. */
export function finishHand(s: Session, h: Hand, lineFor: string): HandRec {
  const rec: HandRec = { n: h.n, button: h.button, bb: h.bb, hole: h.hole, board: h.board.slice(), log: h.log.slice(), winner: h.winner < 0 ? 2 : (h.winner as 0 | 1 | 2), names: h.names, showdown: h.showdown, delta: h.stacks[0] - h.start[0], line: lineFor };
  s.history.push(rec);
  s.stacks = [h.stacks[0], h.stacks[1]];
  s.n = h.n;
  if (s.n >= s.limit || s.stacks[0] <= 0 || s.stacks[1] <= 0) s.over = true;
  return rec;
}
/** The result of a session for you: 1, ½ or 0 (the chips at the end, or a bust). */
export const sessionScore = (s: Session): number => (s.stacks[0] > s.stacks[1] ? 1 : s.stacks[0] < s.stacks[1] ? 0 : 0.5);

/** What a hand's end says, in his voice, naming the winning hand. */
export function resultLine(h: Hand): string {
  if (h.folded === 0) return 'You folded. The pot is mine.';
  if (h.folded === 1) return 'I fold. The pot is yours.';
  if (h.winner === 2) return `Same hand, ${h.names[0].toLowerCase()}. We split the pot.`;
  if (h.winner === 0) return `${h.names[0]}. The pot is yours.`;
  return `${h.names[1]}. The pot is mine.`;
}

// ---------------------------------------------------------------- what Ghosty may see

export interface View {
  me: Seat;
  hole: [number, number];
  board: number[];
  street: number;
  pot: number;
  bets: [number, number];
  stacks: [number, number];
  bb: number;
  button: Seat;
  toAct: Seat;
  raiseSize: number;
  log: Act[];
  n: number;
}
export const viewOf = (h: Hand, me: Seat): View => ({ me, hole: [h.hole[me][0], h.hole[me][1]], board: h.board.slice(), street: h.street, pot: h.pot, bets: [h.bets[0], h.bets[1]], stacks: [h.stacks[0], h.stacks[1]], bb: h.bb, button: h.button, toAct: h.toAct, raiseSize: h.raiseSize, log: h.log.map((x) => ({ ...x })), n: h.n });
export function legalOfView(v: View): Legal {
  const me = v.me;
  const opp = (1 - me) as Seat;
  const owed = Math.max(0, v.bets[opp] - v.bets[me]);
  const maxTo = Math.min(v.bets[me] + v.stacks[me], v.bets[opp] + v.stacks[opp]);
  return { fold: owed > 0, check: owed === 0, call: Math.min(owed, v.stacks[me]), canRaise: maxTo > v.bets[opp], minTo: Math.min(maxTo, v.bets[opp] + Math.max(v.raiseSize, v.bb)), maxTo };
}

// ---------------------------------------------------------------- the range and the chance of winning

const chen = (a: number, b: number): number => {
  let r1 = rankOf(a);
  let r2 = rankOf(b);
  if (r1 < r2) [r1, r2] = [r2, r1];
  const pts = (r: number) => (r === 14 ? 10 : r === 13 ? 8 : r === 12 ? 7 : r === 11 ? 6 : r / 2);
  if (r1 === r2) return Math.max(5, pts(r1) * 2);
  let s = pts(r1);
  if (suitOf(a) === suitOf(b)) s += 2;
  const gap = r1 - r2 - 1;
  s -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
  if (gap <= 1 && r1 < 12) s += 1;
  return s;
};
let PRE: Float32Array | null = null;
/** How a two-card hand ranks before the flop, 0 (worst) … 1 (best), as a share of all 1,326 hands. */
function preflopRank(a: number, b: number): number {
  if (!PRE) {
    const list: { k: number; s: number }[] = [];
    for (let i = 0; i < 52; i++) for (let j = i + 1; j < 52; j++) list.push({ k: i * 52 + j, s: chen(i, j) });
    list.sort((x, y) => x.s - y.s);
    PRE = new Float32Array(52 * 52);
    let i = 0;
    while (i < list.length) {
      let j = i;
      while (j < list.length && list[j]!.s === list[i]!.s) j++;
      const p = (i + (j - i) / 2) / list.length;
      for (let k = i; k < j; k++) PRE[list[k]!.k] = p;
      i = j;
    }
  }
  return PRE[a < b ? a * 52 + b : b * 52 + a]!;
}

export interface Range {
  /** Each combo as [low card, high card]; w is its weight. */
  c: [number, number][];
  w: number[];
}
const liveCombos = (dead: ReadonlySet<number>): [number, number][] => {
  const out: [number, number][] = [];
  for (let i = 0; i < 52; i++) {
    if (dead.has(i)) continue;
    for (let j = i + 1; j < 52; j++) if (!dead.has(j)) out.push([i, j]);
  }
  return out;
};
/** How strong each combo is on a board, 0…1 (the share of combos it beats, ties half). */
function strengths(combos: readonly [number, number][], board: readonly number[]): Float64Array {
  const out = new Float64Array(combos.length);
  if (board.length < 3) {
    for (let i = 0; i < combos.length; i++) out[i] = preflopRank(combos[i]![0], combos[i]![1]);
    return out;
  }
  const v = combos.map((c) => evaluate([c[0], c[1], ...board]));
  const order = v.map((x, i) => i).sort((a, b) => v[a]! - v[b]!);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j < order.length && v[order[j]!] === v[order[i]!]) j++;
    const p = (i + (j - i) / 2) / order.length;
    for (let k = i; k < j; k++) out[order[k]!] = p;
    i = j;
  }
  return out;
}
/** How likely an action is, for a hand of strength s: the model of what each action says about the hand. */
function likelihood(t: Act['t'], s: number, fracOfPot: number, preflop: boolean): number {
  if (t === 'raise') {
    const lo = Math.min(0.9, (preflop ? 0.35 : 0.3) + 0.45 * fracOfPot);
    return 0.12 + 0.88 * Math.max(0, Math.min(1, (s - lo) / (1 - lo)));
  }
  if (t === 'call') return s > 0.93 ? 0.7 : 0.15 + 0.85 * Math.min(1, s / 0.45);
  if (t === 'check') return 1 - 0.7 * Math.max(0, (s - 0.55) / 0.45);
  return 1;
}
/** The range for the other player's two cards, narrowed by everything they did in this hand. */
export function narrow(v: View): Range {
  const dead = new Set<number>([...v.hole, ...v.board]);
  const c = liveCombos(dead);
  const w = new Array<number>(c.length).fill(1);
  const opp = (1 - v.me) as Seat;
  const cache = new Map<number, Float64Array>();
  for (const a of v.log) {
    if (a.by !== opp || a.t === 'fold') continue;
    // the strength is read on the board as it was when they acted (the combos are those still possible now)
    const board = v.board.slice(0, shown(a.street));
    let st = cache.get(a.street);
    if (!st) {
      st = strengths(c, board);
      cache.set(a.street, st);
    }
    const frac = a.t === 'raise' ? Math.max(0, a.amt) / Math.max(1, a.pot + a.amt) : 0;
    for (let i = 0; i < c.length; i++) w[i] = w[i]! * likelihood(a.t, st[i]!, frac, a.street === 0);
  }
  return { c, w };
}

export interface Estimate {
  /** The chance of winning (a tie counts half), 0…1. */
  eq: number;
  n: number;
  /** For each sample: the strength of the other hand and 1, ½ or 0 for the player. */
  str: Float32Array;
  res: Float32Array;
}
/** Deal the rest of the board at random against a range, `samples` times (or until `until`), and count wins. */
export function estimate(hole: readonly [number, number], board: readonly number[], range: Range, rnd: () => number, o: { samples: number; until?: number; min?: number }): Estimate {
  const dead = new Set<number>([...hole, ...board]);
  const pool: number[] = [];
  for (let i = 0; i < 52; i++) if (!dead.has(i)) pool.push(i);
  const cum = new Float64Array(range.w.length);
  let t = 0;
  for (let i = 0; i < range.w.length; i++) cum[i] = t += range.w[i]!;
  const st = strengths(range.c, board);
  const max = Math.max(1, o.samples);
  const str = new Float32Array(max);
  const res = new Float32Array(max);
  let n = 0;
  let sum = 0;
  const need = 5 - board.length;
  const full = [...board];
  const mine = [hole[0], hole[1]];
  const theirs: number[] = [0, 0];
  const minN = o.min ?? 0;
  if (t <= 0) return { eq: 0.5, n: 0, str: str.subarray(0, 0), res: res.subarray(0, 0) };
  while (n < max) {
    if (o.until && n >= minN && (n & 63) === 0 && Date.now() >= o.until) break;
    const x = rnd() * t;
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid]! < x) lo = mid + 1;
      else hi = mid;
    }
    const cb = range.c[lo]!;
    theirs[0] = cb[0];
    theirs[1] = cb[1];
    full.length = board.length;
    for (let k = 0; k < need; k++) {
      let card: number;
      do card = pool[Math.floor(rnd() * pool.length)]!;
      while (card === cb[0] || card === cb[1] || full.includes(card));
      full.push(card);
    }
    const a = evaluate([mine[0]!, mine[1]!, ...full]);
    const b = evaluate([theirs[0]!, theirs[1]!, ...full]);
    const r = a > b ? 1 : a === b ? 0.5 : 0;
    str[n] = st[lo]!;
    res[n] = r;
    sum += r;
    n++;
  }
  return { eq: n ? sum / n : 0.5, n, str: str.subarray(0, n), res: res.subarray(0, n) };
}

// ---------------------------------------------------------------- his play

const SIZES: number[][] = [[0.5, 0.75, 1], [0.33, 0.5, 0.75], [0.5, 0.75, 1], [0.5, 0.75, 1.25]];
const EXTRA_SIZES = [0.25, 1.5, 2];
export const bluffShare = (level: number): number => Math.min(0.35, 0.05 + 0.03 * Math.max(1, level));
const gauss = (r: () => number): number => {
  let s = 0;
  for (let i = 0; i < 6; i++) s += r();
  return (s - 3) / 0.7071;
};

export interface Choice {
  t: Act['t'];
  to: number;
  /** His own estimate of winning, 0…1, and what he weighed (for the spec and the history). */
  eq: number;
  samples: number;
  bluff: boolean;
}
/**
 * Ghosty's move. `o.ms` is his thinking time (the dial of kit.ts) and `o.samples` a count of deals instead (the node tests).
 * Level 1 misjudges a lot (noise of three big blinds on each worth) and level 20 hardly at all; the bluff share and the finer
 * bet sizes rise with the level; there is no top.
 */
export function botAct(v: View, level: number, seed: number, o: { ms?: number; samples?: number } = {}): Choice {
  const rnd = rngOf(seed);
  const L = legalOfView(v);
  const me = v.me;
  const opp = (1 - me) as Seat;
  const range = narrow(v);
  const until = o.ms ? Date.now() + o.ms * 0.6 : undefined;
  const est = estimate(v.hole, v.board, range, rnd, { samples: o.samples ?? 60000, until, min: o.samples ? o.samples : 200 });
  const eq = est.eq;
  const pNow = v.pot + v.bets[0] + v.bets[1];
  const sigma = (v.bb * 3) / Math.max(1, level);
  const owed = L.call;
  const evs: { t: Act['t']; to: number; ev: number; bluff: boolean }[] = [];
  evs.push(L.check ? { t: 'check', to: v.bets[me], ev: eq * pNow, bluff: false } : { t: 'fold', to: v.bets[me], ev: 0, bluff: false });
  if (L.fold) evs.push({ t: 'call', to: v.bets[me] + owed, ev: eq * pNow - (1 - eq) * owed, bluff: false });
  // the raises: sizes by street as a share of the pot after a call, and all in
  if (L.canRaise) {
    const after = pNow + owed;
    const fr = [...SIZES[v.street]!, ...(level >= 8 ? EXTRA_SIZES : [])];
    const tos = new Set<number>([L.maxTo]);
    for (const f of fr) tos.add(Math.max(L.minTo, Math.min(L.maxTo, Math.round(v.bets[opp] + after * f))));
    const caution = level >= 3 ? 0.1 : 0;
    for (const to of tos) {
      const r = to - v.bets[me];
      const x = to - v.bets[opp];
      const frac = r / (pNow + r);
      const thr = 0.12 + 0.6 * frac;
      let folds = 0;
      let cw = 0;
      let cn = 0;
      let strong = 0;
      for (let i = 0; i < est.n; i++) {
        if (est.str[i]! < thr) folds++;
        else {
          cw += est.res[i]!;
          cn++;
          if (est.str[i]! > 0.88) strong++;
        }
      }
      const pf = est.n ? folds / est.n : 0;
      const eqC = cn ? cw / cn : eq;
      const pStrong = cn ? strong / cn : 0;
      const called = eqC * (pNow + x) - (1 - eqC) * r;
      evs.push({ t: 'raise', to, ev: pf * pNow + (1 - pf) * called * (1 - caution * pStrong * 4), bluff: eq < 0.4 });
    }
  }
  for (const e of evs) e.ev += gauss(rnd) * sigma;
  let best = evs[0]!;
  for (const e of evs) if (e.ev > best.ev) best = e;
  // a bluff now and then when nobody has bet: a share that rises with the level, if it would be folded to often enough
  if (L.canRaise && L.check && eq < 0.45 && rnd() < bluffShare(level)) {
    const f = SIZES[v.street]![1 + (rnd() < 0.5 ? 1 : 0)] ?? 0.5;
    const to = Math.max(L.minTo, Math.min(L.maxTo, Math.round(pNow * f)));
    const thr = 0.12 + 0.6 * (to / (pNow + to));
    let folds = 0;
    for (let i = 0; i < est.n; i++) if (est.str[i]! < thr) folds++;
    if (est.n && folds / est.n > 0.2) best = { t: 'raise', to, ev: 0, bluff: true };
  }
  // never an illegal move
  if (best.t === 'fold' && !L.fold) best = { t: 'check', to: v.bets[me], ev: 0, bluff: false };
  if (best.t === 'check' && !L.check) best = L.fold ? { t: 'call', to: v.bets[me] + owed, ev: 0, bluff: false } : { t: 'check', to: v.bets[me], ev: 0, bluff: false };
  if (best.t === 'raise' && (!L.canRaise || best.to > L.maxTo || best.to < Math.min(L.minTo, L.maxTo))) best = L.canRaise ? { ...best, to: Math.max(L.minTo, Math.min(L.maxTo, best.to)) } : L.check ? { t: 'check', to: v.bets[me], ev: 0, bluff: false } : { t: 'call', to: v.bets[me] + owed, ev: 0, bluff: false };
  return { t: best.t, to: best.to, eq, samples: est.n, bluff: best.t === 'raise' && best.bluff };
}

/** The hint for you: your chance of winning against the range his actions leave him, and the share a call must win to be worth it. */
export function hintFor(v: View, seed: number, o: { ms?: number; samples?: number } = {}): { eq: number; need: number; samples: number } {
  const rnd = rngOf(seed);
  const est = estimate(v.hole, v.board, narrow(v), rnd, { samples: o.samples ?? 40000, until: o.ms ? Date.now() + o.ms : undefined, min: o.samples ?? 300 });
  const L = legalOfView(v);
  const pNow = v.pot + v.bets[0] + v.bets[1];
  return { eq: est.eq, need: L.call > 0 ? L.call / (pNow + L.call) : 0, samples: est.n };
}
/** "about 61%": an estimate, said as one. */
export const aboutPercent = (eq: number): string => `about ${Math.round(eq * 100)}%`;

/** A hand as lines for the history: every card and every bet. */
export function historyLines(r: HandRec): string[] {
  const who = (p: Seat) => (p === 0 ? 'You' : 'Ghosty');
  const streetName = ['Before the flop', 'Flop', 'Turn', 'River'];
  const lines = [`Hand ${r.n} · blinds ${Math.max(1, Math.floor(r.bb / 2))}/${r.bb} · ${who(r.button)} on the button`, `Your cards ${r.hole[0].map(cardText).join(' ')} · Ghosty's ${r.hole[1].map(cardText).join(' ')}`];
  if (r.board.length) lines.push(`Board ${r.board.map(cardText).join(' ')}`);
  let street = -1;
  let top = 0;
  for (const a of r.log) {
    if (a.street !== street) {
      street = a.street;
      top = 0;
      lines.push(`${streetName[street]}${street > 0 ? ` (${r.board.slice(0, shown(street)).map(cardText).join(' ')})` : ''}`);
    }
    const said = a.t === 'raise' ? `${top > 0 || street === 0 ? 'raises to' : 'bets'} ${a.to}` : a.t === 'call' ? `calls ${a.amt}` : a.t === 'check' ? 'checks' : 'folds';
    if (a.t === 'raise') top = a.to;
    lines.push(`  ${who(a.by)} ${said}`);
  }
  lines.push(`${r.line} · you ${r.delta >= 0 ? '+' : ''}${r.delta} chips`);
  return lines;
}
