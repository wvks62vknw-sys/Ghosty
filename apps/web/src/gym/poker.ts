/**
 * SIMPLE POKER: Kuhn poker (Levels 1–4: three cards J Q K, one card each, one round of betting) and then
 * Leduc hold'em (Levels 5–10: six cards, a shared board card, two rounds, bets of 2 then 4, at most a bet
 * and a raise per round). Ghosty learns by counterfactual regret minimisation (CFR+): he plays every deal
 * against himself, asks after each decision how much better every other choice would have done, and
 * leans towards the choices he regrets not making; his AVERAGE strategy over all those rounds is what
 * he plays. Ground truth: exploitability, computed exactly — a perfect opponent who knows his strategy
 * (the best response, worked out over the whole game tree) and how many chips a hand that opponent would
 * take from him on average. 0 = unbeatable (a Nash equilibrium). Mastery = 1 − his exploitability ÷ the
 * exploitability of playing every option equally often (so 0% untrained, 100% unbeatable). Kuhn poker's
 * equilibrium value is −1/18 of a chip a hand for the first player (tested).
 */
import { finalLine, type Env, type Frame, type Game, type Learner, lvl, type Problem, rng, savedFor, type Verdict } from './core';
import { POKER } from './meta';

export type Variant = 'kuhn' | 'leduc';
export const variantFor = (level: number): Variant => (lvl(level) <= 4 ? 'kuhn' : 'leduc');
const RANK = 'JQK';

// ---- the game tree ------------------------------------------------------------------------------------------

/** A node: chance (deal), a decision (player 0 or 1 at an information set), or the end (chips to player 0). */
export interface PNode {
  kind: 'chance' | 'act' | 'end';
  /** chance: probability of each child. */
  probs?: number[];
  kids?: PNode[];
  player?: number;
  /** Index of the information set (what the player to act can see). */
  info?: number;
  /** The actions' letters: f fold, c check/call, r bet/raise. */
  acts?: string;
  pay?: number;
  /** For the WATCH and problems: the cards dealt so far and the betting. */
  cards?: number[];
  board?: number;
  hist?: string;
}

export interface Tree {
  variant: Variant;
  root: PNode;
  /** Information sets: key, player, actions, and the nodes in it. */
  infos: { key: string; player: number; acts: string; nodes: PNode[]; depth: number }[];
}

const trees = new Map<Variant, Tree>();

/** The whole game tree (built once). */
export function tree(variant: Variant): Tree {
  const hit = trees.get(variant);
  if (hit) return hit;
  const infos: Tree['infos'] = [];
  const index = new Map<string, number>();
  const infoOf = (key: string, player: number, acts: string, node: PNode, depth: number) => {
    let i = index.get(key);
    if (i == null) {
      i = infos.length;
      index.set(key, i);
      infos.push({ key, player, acts, nodes: [], depth });
    }
    infos[i]!.nodes.push(node);
    return i;
  };
  const showdown = (c0: number, c1: number, board: number | undefined, pot0: number, pot1: number): number => {
    // Each put in pot0 / pot1: the winner takes the other's stake.
    const s0 = board != null && c0 === board ? 10 : c0;
    const s1 = board != null && c1 === board ? 10 : c1;
    return s0 > s1 ? pot1 : s0 < s1 ? -pot0 : 0;
  };
  /** One betting round. h = actions this round; bets = raises so far; in0/in1 = chips in. */
  const round = (cards: number[], board: number | undefined, hist: string, h: string, in0: number, in1: number, bets: number, depth: number, after: (in0: number, in1: number, hist: string) => PNode): PNode => {
    const player = h.length % 2;
    const size = variant === 'kuhn' ? 1 : board == null ? 2 : 4;
    const maxBets = variant === 'kuhn' ? 1 : 2;
    const last = h[h.length - 1];
    const facing = last === 'r';
    const acts = facing ? (bets < maxBets ? 'fcr' : 'fc') : 'cr';
    const node: PNode = { kind: 'act', player, acts, kids: [], cards, board, hist: hist + h };
    const priv = RANK[cards[player]!]!;
    node.info = infoOf(`${player}|${priv}|${board != null ? RANK[board] : ''}|${hist}/${h}`, player, acts, node, depth);
    for (const a of acts) {
      const h2 = h + a;
      let kid: PNode;
      if (a === 'f') {
        // The folder loses what they put in.
        kid = { kind: 'end', pay: player === 0 ? -in0 : in1, cards, board, hist: hist + h2 };
      } else if (a === 'c') {
        const n0 = player === 0 && facing ? in1 : in0;
        const n1 = player === 1 && facing ? in0 : in1;
        // A call ends the round; so does a second check.
        if (facing || h.length >= 1) kid = after(n0, n1, hist + h2);
        else kid = round(cards, board, hist, h2, n0, n1, bets, depth + 1, after);
      } else {
        const n0 = player === 0 ? in1 + size : in0;
        const n1 = player === 1 ? in0 + size : in1;
        kid = round(cards, board, hist, h2, n0, n1, bets + 1, depth + 1, after);
      }
      node.kids!.push(kid);
    }
    return node;
  };
  let root: PNode;
  if (variant === 'kuhn') {
    const kids: PNode[] = [];
    const probs: number[] = [];
    for (let a = 0; a < 3; a++)
      for (let b = 0; b < 3; b++) {
        if (a === b) continue;
        const cards = [a, b];
        kids.push(round(cards, undefined, '', '', 1, 1, 0, 0, (i0, i1, hist) => ({ kind: 'end', pay: showdown(a, b, undefined, i0, i1), cards, hist })));
        probs.push(1 / 6);
      }
    root = { kind: 'chance', probs, kids };
  } else {
    // Six cards: two of each rank. Deals by rank with their probabilities.
    const kids: PNode[] = [];
    const probs: number[] = [];
    for (let a = 0; a < 3; a++)
      for (let b = 0; b < 3; b++) {
        const pab = (2 / 6) * ((a === b ? 1 : 2) / 5);
        const cards = [a, b];
        kids.push(
          round(cards, undefined, '', '', 1, 1, 0, 0, (i0, i1, hist) => {
            // The board card: one of the four left.
            const bk: PNode[] = [];
            const bp: number[] = [];
            for (let c = 0; c < 3; c++) {
              const left = 2 - (a === c ? 1 : 0) - (b === c ? 1 : 0);
              if (!left) continue;
              bp.push(left / 4);
              bk.push(round(cards, c, `${hist}|`, '', i0, i1, 0, 10, (j0, j1, h2) => ({ kind: 'end', pay: showdown(a, b, c, j0, j1), cards, board: c, hist: h2 })));
            }
            return { kind: 'chance', probs: bp, kids: bk, cards, hist };
          }),
        );
        probs.push(pab);
      }
    root = { kind: 'chance', probs, kids };
  }
  const t: Tree = { variant, root, infos };
  trees.set(variant, t);
  return t;
}

// ---- strategies, CFR+ and the exact best response -------------------------------------------------------------

/** A strategy: for each information set, the probability of each of its actions (3 slots each). */
export type Strategy = Float64Array;

export function uniform(t: Tree): Strategy {
  const s = new Float64Array(t.infos.length * 3);
  t.infos.forEach((I, i) => {
    for (let a = 0; a < I.acts.length; a++) s[i * 3 + a] = 1 / I.acts.length;
  });
  return s;
}

/** The value of the game to player 0 when both play `s`. */
export function gameValue(t: Tree, s: Strategy): number {
  const v = (n: PNode): number => {
    if (n.kind === 'end') return n.pay!;
    if (n.kind === 'chance') return n.kids!.reduce((x, k, i) => x + n.probs![i]! * v(k), 0);
    let x = 0;
    n.kids!.forEach((k, a) => (x += s[n.info! * 3 + a]! * v(k)));
    return x;
  };
  return v(t.root);
}

/**
 * The best response: what a perfect opponent who knows strategy `s` wins. Returns the value to player
 * `br` when `br` plays the best response and the other side plays `s`. Information sets are decided
 * deepest first (perfect recall: a deeper choice never depends on a shallower one), each by the total
 * of its nodes weighted by how likely the other side and the cards are to reach them.
 */
export function bestResponse(t: Tree, s: Strategy, br: number): number {
  const reach = new Map<PNode, number>();
  const fwd = (n: PNode, p: number) => {
    reach.set(n, p);
    if (n.kind === 'end') return;
    if (n.kind === 'chance') n.kids!.forEach((k, i) => fwd(k, p * n.probs![i]!));
    else if (n.player === br) n.kids!.forEach((k) => fwd(k, p));
    else n.kids!.forEach((k, a) => fwd(k, p * s[n.info! * 3 + a]!));
  };
  fwd(t.root, 1);
  const choice = new Int8Array(t.infos.length).fill(-1);
  const sign = br === 0 ? 1 : -1;
  const val = (n: PNode): number => {
    if (n.kind === 'end') return sign * n.pay!;
    if (n.kind === 'chance') return n.kids!.reduce((x, k, i) => x + n.probs![i]! * val(k), 0);
    if (n.player === br) return val(n.kids![choice[n.info!]!]!);
    let x = 0;
    n.kids!.forEach((k, a) => {
      const p = s[n.info! * 3 + a]!;
      if (p) x += p * val(k);
    });
    return x;
  };
  const mine = t.infos.map((I, i) => [I, i] as const).filter(([I]) => I.player === br).sort((a, b) => b[0].depth - a[0].depth);
  for (const [I, i] of mine) {
    let best = 0;
    let bv = -Infinity;
    for (let a = 0; a < I.acts.length; a++) {
      let x = 0;
      for (const n of I.nodes) {
        // Only the part of the value that comes through this node: the reach of the cards and the other side.
        const r = reach.get(n)!;
        if (r) x += r * val(n.kids![a]!);
      }
      if (x > bv + 1e-12) (bv = x), (best = a);
    }
    choice[i] = best;
  }
  return val(t.root);
}

/** How many chips a hand a perfect opponent takes from `s`, averaged over both seats (0 at an equilibrium). */
export function exploitability(t: Tree, s: Strategy): number {
  return (bestResponse(t, s, 0) + bestResponse(t, s, 1)) / 2;
}

const uniformExpl = new Map<Variant, number>();
export function uniformExploitability(v: Variant): number {
  let x = uniformExpl.get(v);
  if (x == null) uniformExpl.set(v, (x = exploitability(tree(v), uniform(tree(v)))));
  return x;
}

/** CFR+: regrets that never go below zero, alternating updates, later rounds weighted more in the average. */
export class CFR {
  regret: Float64Array;
  sum: Float64Array;
  iters = 0;
  constructor(
    public t: Tree,
    regret?: Float64Array,
    sum?: Float64Array,
    iters = 0,
  ) {
    const n = t.infos.length * 3;
    this.regret = regret?.length === n ? regret : new Float64Array(n);
    this.sum = sum?.length === n ? sum : new Float64Array(n);
    this.iters = iters;
  }
  /** The current strategy at info set i (regret matching). */
  private current(i: number, k: number, out: Float64Array) {
    let pos = 0;
    for (let a = 0; a < k; a++) pos += Math.max(0, this.regret[i * 3 + a]!);
    for (let a = 0; a < k; a++) out[a] = pos > 0 ? Math.max(0, this.regret[i * 3 + a]!) / pos : 1 / k;
  }
  private walk(n: PNode, who: number, pMe: number, pOther: number, w: number): number {
    if (n.kind === 'end') return who === 0 ? n.pay! : -n.pay!;
    if (n.kind === 'chance') {
      let x = 0;
      n.kids!.forEach((k, i) => (x += n.probs![i]! * this.walk(k, who, pMe, pOther * n.probs![i]!, w)));
      return x;
    }
    const i = n.info!;
    const k = n.acts!.length;
    const sig = new Float64Array(3);
    this.current(i, k, sig);
    if (n.player === who) {
      const vals = [0, 0, 0];
      let v = 0;
      for (let a = 0; a < k; a++) {
        vals[a] = this.walk(n.kids![a]!, who, pMe * sig[a]!, pOther, w);
        v += sig[a]! * vals[a]!;
      }
      for (let a = 0; a < k; a++) this.regret[i * 3 + a] = Math.max(0, this.regret[i * 3 + a]! + pOther * (vals[a]! - v));
      return v;
    }
    // The other side: add to its average strategy (weighted by the round number), and follow its current strategy.
    for (let a = 0; a < k; a++) this.sum[i * 3 + a]! += w * pOther * sig[a]!;
    let v = 0;
    for (let a = 0; a < k; a++) if (sig[a]) v += sig[a]! * this.walk(n.kids![a]!, who, pMe, pOther * sig[a]!, w);
    return v;
  }
  /** One round of CFR+ (both players updated once). */
  iterate(): void {
    this.iters++;
    const w = this.iters;
    // pOther here is the reach of everyone but `who` (the other player and the cards).
    this.walk(this.t.root, 0, 1, 1, w);
    this.walk(this.t.root, 1, 1, 1, w);
  }
  /** The average strategy: what he actually plays (uniform where nothing has been learned yet). */
  average(): Strategy {
    const s = uniform(this.t);
    this.t.infos.forEach((I, i) => {
      let tot = 0;
      for (let a = 0; a < I.acts.length; a++) tot += this.sum[i * 3 + a]!;
      if (tot > 0) for (let a = 0; a < I.acts.length; a++) s[i * 3 + a] = this.sum[i * 3 + a]! / tot;
    });
    return s;
  }
}

// ---- the playable environment -----------------------------------------------------------------------------------

/** A hand you play as player 1 (first to act) against a fixed opponent who mixes evenly. Actions: 0 fold, 1 check/call, 2 bet/raise. */
class PokerEnv implements Env {
  t: Tree;
  n: PNode;
  r: () => number = rng(1);
  constructor(level: number) {
    this.t = tree(variantFor(level));
    this.n = this.t.root;
  }
  private settle() {
    // Deal cards and let the opponent (player 2, every choice equally likely) act until it is your turn.
    for (;;) {
      if (this.n.kind === 'chance') {
        let x = this.r();
        let i = 0;
        for (; i < this.n.probs!.length - 1; i++) if ((x -= this.n.probs![i]!) < 0) break;
        this.n = this.n.kids![i]!;
      } else if (this.n.kind === 'act' && this.n.player === 1) this.n = this.n.kids![Math.floor(this.r() * this.n.acts!.length)]!;
      else return;
    }
  }
  reset(seed: number) {
    this.r = rng(seed);
    this.n = this.t.root;
    this.settle();
  }
  actions() {
    return this.n.kind === 'act' ? [...this.n.acts!].map((a) => 'fcr'.indexOf(a)) : [];
  }
  step(a: number) {
    if (this.n.kind !== 'act') return { reward: 0, done: true };
    const i = this.n.acts!.indexOf('fcr'[a] ?? '?');
    if (i < 0) return { reward: -1, done: true };
    this.n = this.n.kids![i]!;
    this.settle();
    return this.n.kind === 'end' ? { reward: this.n.pay!, done: true } : { reward: 0, done: false };
  }
  describe() {
    return handText(this.t.variant, this.n, 0);
  }
}

const ACT = { f: 'fold', c: 'check', r: 'bet' } as const;
/** The betting so far in words. */
export function bettingWords(hist: string): string {
  const out: string[] = [];
  for (const part of hist.split('|')) {
    let facing = false;
    let p = 0;
    for (const a of part) {
      const who = `Player ${p + 1}`;
      out.push(`${who} ${a === 'c' ? (facing ? 'calls' : 'checks') : a === 'r' ? (facing ? 'raises' : 'bets') : 'folds'}`);
      facing = a === 'r';
      p = 1 - p;
    }
  }
  return out.length ? out.join(', ') : 'no betting yet';
}

function handText(v: Variant, n: PNode, seat: number): string {
  const cards = n.cards ?? [];
  const rules = v === 'kuhn' ? 'Kuhn poker (cards J < Q < K, ante 1, bets of 1, one round)' : "Leduc hold'em (two each of J Q K, ante 1, bets of 2 then 4, a shared board card after round one; a pair with the board beats any high card)";
  const lines = [`${rules}.`, `You are Player ${seat + 1} and hold ${cards[seat] != null ? RANK[cards[seat]!] : '?'}.`];
  if (n.board != null) lines.push(`Board card: ${RANK[n.board]}.`);
  lines.push(`Betting: ${bettingWords(n.hist ?? '')}.`);
  if (n.kind === 'end') lines.push(`Hand over: you ${n.pay! * (seat ? -1 : 1) >= 0 ? 'win' : 'lose'} ${Math.abs(n.pay!)}.`);
  else if (n.kind === 'act') lines.push(`Your options: ${[...n.acts!].map((a) => (a === 'c' && n.hist?.endsWith('r') ? 'call' : a === 'r' && n.hist?.endsWith('r') ? 'raise' : ACT[a as 'f' | 'c' | 'r'])).join(', ')}.`);
  return lines.join('\n');
}

// ---- the learner -------------------------------------------------------------------------------------------------

interface PokerSave {
  game: 'poker';
  variant: Variant;
  regret: Float64Array;
  sum: Float64Array;
  iters: number;
}

/** CFR+ rounds per training unit is one; a unit is called a "round" of self-play over every deal. */
class PokerLearner implements Learner {
  cfr: CFR;
  variant: Variant;
  constructor(level: number, _seed: number, saved?: unknown) {
    this.variant = variantFor(level);
    const t = tree(this.variant);
    // What he learned carries over while the game stays the same (Kuhn → Leduc starts afresh).
    const s = savedFor<PokerSave>(saved, 'poker');
    this.cfr = s && s.variant === this.variant ? new CFR(t, s.regret, s.sum, s.iters) : new CFR(t);
  }
  train(n: number) {
    // A Leduc round walks ~10,000 positions: keep each call short.
    const k = Math.max(1, Math.min(n, this.variant === 'kuhn' ? 2000 : 40));
    for (let i = 0; i < k; i++) this.cfr.iterate();
    return k;
  }
  measure() {
    const s = this.cfr.average();
    const e = exploitability(this.cfr.t, s);
    const u = uniformExploitability(this.variant);
    const name = this.variant === 'kuhn' ? 'Kuhn poker' : "Leduc hold'em";
    const v0 = gameValue(this.cfr.t, s);
    return {
      mastery: Math.max(0, Math.min(1, 1 - e / u)),
      detail: `${name}: a perfect opponent who knew his strategy would win ${(e * 1000).toFixed(1)} thousandths of a chip a hand from him (exact best response; playing every option equally often loses ${(u * 1000).toFixed(0)}; 0 is unbeatable). Against himself the first player makes ${v0.toFixed(3)} a hand${this.variant === 'kuhn' ? ' (the true value is −1/18 = −0.056)' : ''}.`,
    };
  }
  save(): PokerSave {
    return { game: 'poker', variant: this.variant, regret: this.cfr.regret, sum: this.cfr.sum, iters: this.cfr.iters };
  }
  /** His chance of betting / calling with each card at the first decisions. */
  view(): Frame {
    const s = this.cfr.average();
    const t = this.cfr.t;
    const bars: [string, number, string][] = [];
    const prob = (key: string, act: string) => {
      const i = t.infos.findIndex((I) => I.key === key);
      if (i < 0) return 0;
      return s[i * 3 + t.infos[i]!.acts.indexOf(act)]!;
    };
    for (let c = 0; c < 3; c++) {
      const p = prob(`0|${RANK[c]}||/`, 'r');
      bars.push([`P1 bets with ${RANK[c]}`, p, `${Math.round(p * 100)}%`]);
    }
    for (let c = 0; c < 3; c++) {
      const p = prob(`1|${RANK[c]}||/r`, 'c') + (this.variant === 'leduc' ? prob(`1|${RANK[c]}||/r`, 'r') : 0);
      bars.push([`P2 calls a bet with ${RANK[c]}`, p, `${Math.round(p * 100)}%`]);
    }
    return { bars, caption: `${this.variant === 'kuhn' ? 'Kuhn poker' : "Leduc hold'em (first round)"}: how often he bets or calls with each card, after ${this.cfr.iters.toLocaleString('en-GB')} rounds of self-play. At the equilibrium he bluffs with J now and then and never folds K.` };
  }
  watch(seed: number): Frame[] {
    const s = this.cfr.average();
    const r = rng(seed);
    const frames: Frame[] = [];
    let total = 0;
    for (let hand = 0; hand < 4; hand++) {
      let n = this.cfr.t.root;
      const lines: string[] = [];
      for (;;) {
        if (n.kind === 'end') break;
        if (n.kind === 'chance') {
          let x = r();
          let i = 0;
          for (; i < n.probs!.length - 1; i++) if ((x -= n.probs![i]!) < 0) break;
          n = n.kids![i]!;
          if (n.board != null && !lines.some((l) => l.startsWith('Board'))) lines.push(`Board card: ${RANK[n.board]}`);
          continue;
        }
        const i = n.info!;
        let x = r();
        let a = 0;
        for (; a < n.acts!.length - 1; a++) if ((x -= s[i * 3 + a]!) < 0) break;
        const facing = (n.hist ?? '').endsWith('r');
        const word = n.acts![a] === 'f' ? 'folds' : n.acts![a] === 'c' ? (facing ? 'calls' : 'checks') : facing ? 'raises' : 'bets';
        lines.push(`P${n.player! + 1} (${RANK[n.cards![n.player!]!]}) ${word} — ${Math.round(s[i * 3 + a]! * 100)}% of the time here`);
        n = n.kids![a]!;
        frames.push({ lines: [`Hand ${hand + 1}: P1 holds ${RANK[n.cards![0]!]}, P2 holds ${RANK[n.cards![1]!]}`, ...lines], caption: 'He plays both seats with his learned strategy.' });
      }
      total += n.pay!;
      frames.push({ lines: [`Hand ${hand + 1}: P1 holds ${RANK[n.cards![0]!]}, P2 holds ${RANK[n.cards![1]!]}`, ...lines, `P1 ${n.pay! >= 0 ? 'wins' : 'loses'} ${Math.abs(n.pay!)} · P1 total ${total >= 0 ? '+' : ''}${total}`], caption: 'He plays both seats with his learned strategy.' });
    }
    return frames;
  }
}

// ---- problems -----------------------------------------------------------------------------------------------------

/**
 * Kuhn levels: the best action against an opponent whose habits are stated (exact best response).
 * Leduc levels: how many chips Player 1 wins or loses in a hand that is written out (the rules worked through).
 */
function generate(level: number, seed: number): Problem {
  const L = lvl(level);
  const r = rng(seed * 7919 + L);
  if (variantFor(L) === 'kuhn') {
    // The opponent (Player 2) bets / calls with fixed probabilities; you are Player 1 and must pick your move.
    for (;;) {
      const t = tree('kuhn');
      const s = uniform(t);
      const habits: string[] = [];
      for (let c = 0; c < 3; c++) {
        const pb = Math.round(r() * 10) / 10;
        const pc = Math.round(r() * 10) / 10;
        const ib = t.infos.findIndex((I) => I.key === `1|${RANK[c]}||/c`);
        const ic = t.infos.findIndex((I) => I.key === `1|${RANK[c]}||/r`);
        s[ib * 3] = 1 - pb;
        s[ib * 3 + 1] = pb;
        s[ic * 3] = 1 - pc;
        s[ic * 3 + 1] = pc;
        habits.push(`with ${RANK[c]} they bet ${Math.round(pb * 100)}% of the time after a check, and call a bet ${Math.round(pc * 100)}% of the time`);
      }
      const card = Math.floor(r() * 3);
      const facing = L >= 3 && r() < 0.6;
      const key = `0|${RANK[card]}||/${facing ? 'cr' : ''}`;
      const i = t.infos.findIndex((I) => I.key === key);
      const I = t.infos[i]!;
      // Each action's value against those habits. The opponent's card is unknown: each of the two left,
      // weighed by how likely they were to act as they did; a later call-or-fold is chosen without seeing it.
      const opp = [0, 1, 2].filter((c) => c !== card);
      const pb = (c: number) => s[ib0(t, c) * 3 + 1]!;
      const pc = (c: number) => s[ib1(t, c) * 3 + 1]!;
      const sd = (c: number, k: number) => (card > c ? k : -k);
      const sum = (f: (c: number) => number) => opp.reduce((x, c) => x + f(c), 0);
      let vals: number[];
      if (facing) {
        const w = sum(pb);
        if (w <= 0) continue;
        vals = [-1, sum((c) => pb(c) * sd(c, 2)) / w];
      } else {
        const later = Math.max(sum((c) => pb(c) * sd(c, 2)), sum((c) => -pb(c)));
        vals = [(sum((c) => (1 - pb(c)) * sd(c, 1)) + later) / 2, sum((c) => pc(c) * sd(c, 2) + (1 - pc(c))) / 2];
      }
      const best = Math.max(...vals);
      const right = [...I.acts].filter((_, a) => vals[a]! > best - 1e-9);
      if (right.length !== 1 || vals.filter((v) => v > best - 0.05).length > 1) continue;
      const words = (a: string) => (a === 'f' ? 'fold' : a === 'c' ? (facing ? 'call' : 'check') : 'bet');
      const text = `Kuhn poker: three cards J < Q < K, each player antes 1 and gets one card; bets are 1 chip; the higher card wins at showdown.\nYou are Player 1 and hold ${RANK[card]}.${facing ? ' You checked, and Player 2 has bet.' : ' You act first.'}\nPlayer 2's habits: ${habits.join('; ')}.\nWhich action wins you the most chips on average: ${[...I.acts].map(words).join(' or ')}? Answer with one word.`;
      return { game: 'poker', level: L, seed, text, data: { kind: 'act', answer: words(right[0]!), options: [...I.acts].map(words) } };
    }
  }
  // Leduc: a random hand dealt and bet out, the chips to work out.
  const t = tree('leduc');
  let n = t.root;
  while (n.kind !== 'end') {
    if (n.kind === 'chance') {
      let x = r();
      let i = 0;
      for (; i < n.probs!.length - 1; i++) if ((x -= n.probs![i]!) < 0) break;
      n = n.kids![i]!;
    } else {
      // Long hands at higher levels: folding is rarer.
      const acts = n.acts!;
      let a = Math.floor(r() * acts.length);
      if (acts[a] === 'f' && r() < (L - 4) / 7) a = acts.indexOf('c');
      n = n.kids![a]!;
    }
  }
  const text = `Leduc hold'em: two each of J, Q, K; each player antes 1 chip; round one bets are 2 chips, round two bets are 4; at most a bet and a raise per round. After round one a board card is turned up. At showdown a card that pairs the board wins, otherwise the higher card; equal cards split the pot.\nPlayer 1 holds ${RANK[n.cards![0]!]}, Player 2 holds ${RANK[n.cards![1]!]}${n.board != null ? `, the board card is ${RANK[n.board]}` : ''}.\nThe betting: ${bettingWords(n.hist ?? '')}.\nHow many chips does Player 1 win or lose in this hand? Answer with a number (negative if Player 1 loses).`;
  return { game: 'poker', level: L, seed, text, data: { kind: 'chips', answer: n.pay! } };
}

/** Kuhn: the information set of Player 2 holding `card` after a check. */
const ib0 = (t: Tree, card: number) => t.infos.findIndex((I) => I.key === `1|${RANK[card]}||/c`);
/** …and facing a bet. */
const ib1 = (t: Tree, card: number) => t.infos.findIndex((I) => I.key === `1|${RANK[card]}||/r`);

/** Read a signed chip count: "−3", "loses 3", "Player 1 wins 4 chips". */
export function readChips(text: string): number {
  const line = finalLine(text).replace(/[−–]/g, '-');
  const m = line.match(/-?\d+/g);
  if (!m) return NaN;
  const v = Number(m[m.length - 1]);
  return v > 0 && /\b(lose|loses|lost|losing|down)\b/i.test(line) && !/\b(win|wins|won)\b/i.test(line) ? -v : v;
}

function check(p: Problem, answer: string): Verdict {
  const d = p.data as { kind: 'act' | 'chips'; answer: string | number; options?: string[] };
  if (d.kind === 'chips') {
    const v = readChips(answer);
    const ok = v === d.answer;
    return { correct: ok, score: ok ? 1 : 0, why: ok ? 'Right.' : `Player 1 ${Number(d.answer) >= 0 ? 'wins' : 'loses'} ${Math.abs(Number(d.answer))}.` };
  }
  const words = (finalLine(answer).toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => d.options!.includes(w));
  const said = words[words.length - 1];
  const ok = said === d.answer;
  return { correct: ok, score: ok ? 1 : 0, why: ok ? 'The best action.' : `Best: ${d.answer}.` };
}

export const poker: Game = {
  ...POKER,
  env: (level) => new PokerEnv(level),
  generate,
  check,
  learner: (level, seed, saved) => new PokerLearner(level, seed, saved),
};
