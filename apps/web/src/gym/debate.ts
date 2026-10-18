/**
 * DEBATE ARENA: two sides argue over a claim from the fact book (facts.ts) — one says TRUE, one says FALSE —
 * by citing numbered facts from the ones on the table, at most k each. A strict judge checks every
 * citation (it must be a real fact on the table; the judge reads the fact itself, so nothing can be
 * misquoted) and the logic: do the cited facts, and nothing else, settle the claim the way that side says?
 * (Three-valued: the same evaluator as FACT-CHECK, given only the cited facts.) A side whose facts settle
 * it wins; if neither does, nobody wins. Because the judge is exact, the false side can never win — the
 * tests check that, with cheats too (made-up ids, facts not on the table, too many citations).
 *
 * Ground truth: when both sides argue as well as they can, the true side wins (the reference arguer cites
 * the fewest facts that settle the claim). Ghosty argues by adding facts in the order his weights score
 * them (is it about a thing the claim names, the claim's measure, the link "whose capital is …", the
 * biggest value on the table…) until his side is settled or he reaches k — so what he learns is which
 * evidence to cite. Mastery = the share of held-out debates he wins from the true side against the
 * reference arguer; winning from the false side even once is a hard failure (mastery 0).
 */
import { type Env, type Frame, type Game, type Learner, lvl, type Problem, rng, savedFor, type Verdict } from './core';
import { BOOK, byName, claimSentence, evaluate, type Fact, factById, factsFor, knowOnly, LINKS, makeSpec, type Ref, roster, rosterLine, type Spec, support, type Truth } from './facts';
import { DEBATE } from './meta';
import { gauss } from './logic';
import { WORD } from './factcheck';

export interface Debate {
  s: Spec;
  truth: Truth;
  /** The facts on the table. */
  pool: Fact[];
  /** Citations allowed per side. */
  k: number;
}

const slack = (level: number) => [3, 3, 2, 2, 2, 1, 1, 1, 0, 0][lvl(level) - 1]!;

export function makeDebate(level: number, seed: number): Debate {
  const truth: Truth = seed % 2 ? 'T' : 'F';
  const s = makeSpec(level, seed, truth);
  const pool = factsFor(s, seed, 4 + 2 * lvl(level));
  return { s, truth, pool, k: support(s).length + slack(level) };
}

export interface Ruling {
  ok: boolean;
  why: string;
}

/** The judge on one side's argument: real facts from the table, no more than k, and they settle the claim that side's way. */
export function judge(d: Debate, side: Truth, cited: string[]): Ruling {
  if (!cited.length) return { ok: false, why: 'cited nothing' };
  if (cited.length > d.k) return { ok: false, why: `cited ${cited.length} facts (at most ${d.k} allowed)` };
  const facts: Fact[] = [];
  for (const id of cited) {
    const f = factById.get(id);
    if (!f) return { ok: false, why: `${id} is not a fact` };
    if (!d.pool.includes(f)) return { ok: false, why: `${id} is not one of the facts on the table` };
    if (!facts.includes(f)) facts.push(f);
  }
  const got = evaluate(d.s, knowOnly(facts));
  if (got === side) return { ok: true, why: `these facts settle it: ${WORD[side]}` };
  return { ok: false, why: got === 'U' ? 'these facts do not settle it' : `these facts show the opposite (${WORD[got]})` };
}

/** Who wins: the side whose argument holds (both cannot); nobody if neither holds. */
export function winner(d: Debate, t: string[], f: string[]): Truth | null {
  const a = judge(d, 'T', t).ok;
  const b = judge(d, 'F', f).ok;
  return a && !b ? 'T' : b && !a ? 'F' : null;
}

/** The reference arguer: on the true side the fewest facts that settle it; on the false side its best try (facts about what the claim names). */
export function reference(d: Debate, side: Truth): string[] {
  if (side === d.truth) return support(d.s).map((f) => f.id);
  const named = new Set(names(d.s));
  const field = d.s.k === 'flows' ? 'through' : d.s.field;
  const tries = d.pool.filter((f) => named.has(f.ent) && f.field === field);
  return (tries.length ? tries : d.pool).slice(0, d.k).map((f) => f.id);
}

function names(s: Spec): string[] {
  const out: string[] = [];
  const add = (r: Ref) => 'name' in r && out.push(r.name);
  add(s.a);
  if (s.k === 'cmp' || s.k === 'flows') add(s.b);
  return out;
}

export const FEATURES = 12;

/** Facts about a fact, as it bears on the claim (from the claim's words and the table only — never the answer). */
export function features(d: Debate, f: Fact, side: Truth): number[] {
  const s = d.s;
  const field = s.k === 'flows' ? 'through' : s.field;
  const named = names(s).includes(f.ent);
  const refs: Ref[] = [s.a, ...(s.k === 'cmp' || s.k === 'flows' ? [s.b] : [])];
  const isLink = refs.some((r) => !('name' in r) && f.field === r.by && f.v === r.v);
  const pointed = refs.some((r) => !('name' in r) && d.pool.some((g) => g.ent === f.ent && g.field === r.by && g.v === r.v));
  const group = s.k === 'super' && roster(s.kind, s.group).includes(f.ent);
  const same = d.pool.filter((g) => g.field === f.field && typeof g.v === 'number' && (s.k !== 'super' || roster(s.kind, s.group).includes(g.ent)));
  const rank = typeof f.v === 'number' && same.length > 1 ? same.filter((g) => (g.v as number) < (f.v as number)).length / (same.length - 1) : 0;
  const kind = byName.get(f.ent)!.kind;
  const mainKind = 'name' in s.a ? byName.get(s.a.name)?.kind : s.a.kind;
  return [
    named ? 1 : 0,
    f.field === field ? 1 : 0,
    isLink ? 1 : 0,
    pointed ? 1 : 0,
    group ? 1 : 0,
    rank === 1 && f.field === field ? 1 : 0,
    kind === mainKind ? 1 : 0,
    f.field === field ? rank : 0,
    f.field !== field && !LINKS[kind].includes(f.field) ? 1 : 0,
    LINKS[kind].includes(f.field) ? 1 : 0,
    side === 'T' && group && f.field === field ? 1 : 0,
    side === 'F' && rank === 1 && f.field === field ? 1 : 0,
  ];
}

/** His argument: facts added best-scored first until his side is settled, at most k. */
export function argue(d: Debate, side: Truth, w: number[]): string[] {
  const scored = d.pool.map((f, i) => ({ f, i, sc: features(d, f, side).reduce((t, x, j) => t + x * w[j]!, 0) })).sort((a, b) => b.sc - a.sc || a.i - b.i);
  const out: Fact[] = [];
  for (const { f } of scored) {
    if (out.length >= d.k) break;
    out.push(f);
    if (evaluate(d.s, knowOnly(out)) === side) break;
  }
  return out.map((f) => f.id);
}

const sets = new Map<string, Debate[]>();
function set(level: number, from: number, n: number): Debate[] {
  const key = `${lvl(level)}:${from}`;
  let b = sets.get(key);
  if (!b) {
    b = [];
    for (let i = 0; i < n; i++) b.push(makeDebate(level, from + i));
    sets.set(key, b);
  }
  return b;
}
/** The held-out debates (30) and the practice ones he learns from (24, other seeds). */
export const bench = (level: number) => set(level, 70000, 30);
const practice = (level: number) => set(level, 80000, 24);

/** Grade an arguer: wins from the true side against the reference; any win from the false side is a hard failure. */
export function grade(level: number, arguer: (d: Debate, side: Truth) => string[]) {
  let wins = 0;
  let falseWins = 0;
  const b = bench(level);
  for (const d of b) {
    const lie: Truth = d.truth === 'T' ? 'F' : 'T';
    const mine = arguer(d, d.truth);
    if (winner(d, d.truth === 'T' ? mine : reference(d, 'T'), d.truth === 'F' ? mine : reference(d, 'F')) === d.truth) wins++;
    const bad = arguer(d, lie);
    if (winner(d, lie === 'T' ? bad : reference(d, 'T'), lie === 'F' ? bad : reference(d, 'F')) === lie) falseWins++;
  }
  return { wins, of: b.length, falseWins, mastery: falseWins ? 0 : wins / b.length };
}

class DebateEnv implements Env {
  d = makeDebate(1, 1);
  cited: Fact[] = [];
  constructor(private level: number) {}
  reset(seed: number) {
    this.d = makeDebate(this.level, seed);
    this.cited = [];
  }
  /** Cite the fact at this index of the table (he argues the true side). */
  actions() {
    return this.d.pool.map((_, i) => i).filter((i) => !this.cited.includes(this.d.pool[i]!));
  }
  step(a: number) {
    const f = this.d.pool[a];
    if (!f || this.cited.includes(f)) return { reward: -1, done: true };
    this.cited.push(f);
    const won = judge(this.d, this.d.truth, this.cited.map((x) => x.id)).ok;
    return { reward: won ? 10 : -0.5, done: won || this.cited.length >= this.d.k };
  }
  describe() {
    return `Claim: ${claimSentence(this.d.s)} You argue ${WORD[this.d.truth]}. Facts on the table: ${this.d.pool.map((f) => `[${f.id}] ${f.text}`).join(' ')} Cited: ${this.cited.map((f) => f.id).join(', ') || 'none'} (at most ${this.d.k}).`;
  }
}

interface DebateSave {
  game: 'debate';
  level: number;
  w: number[];
  best: number;
  sigma: number;
  rand: number;
}

class DebateLearner implements Learner {
  w: number[];
  best: number;
  sigma: number;
  rand: number;
  r: () => number;
  constructor(
    private level: number,
    seed: number,
    saved?: unknown,
  ) {
    const s = savedFor<DebateSave>(saved, 'debate');
    this.rand = s?.rand ?? seed;
    this.r = rng(this.rand);
    // He starts knowing nothing: every fact looks the same, so he cites them in the order they lie on the table.
    this.w = s?.w?.length === FEATURES ? s.w.slice() : new Array(FEATURES).fill(0);
    this.sigma = s?.sigma ?? 1;
    this.best = s?.level === level ? s.best : this.practiceScore(this.w);
  }
  practiceScore(w: number[]): number {
    let sc = 0;
    for (const d of practice(this.level)) {
      const mine = argue(d, d.truth, w);
      if (judge(d, d.truth, mine).ok) sc += 1000 - mine.length;
    }
    return sc;
  }
  train(n: number) {
    let done = 0;
    while (done < n) {
      const cand = this.w.map((x) => x + this.sigma * gauss(this.r));
      const sc = this.practiceScore(cand);
      done += practice(this.level).length;
      if (sc >= this.best) {
        this.w = cand;
        this.best = sc;
        this.sigma = Math.min(3, this.sigma * 1.4);
      } else this.sigma = Math.max(0.05, this.sigma * 0.9);
    }
    this.rand = (this.rand + done * 2654435761) >>> 0;
    return done;
  }
  measure() {
    const g = grade(this.level, (d, side) => argue(d, side, this.w));
    return {
      mastery: g.mastery,
      detail: g.falseWins
        ? `HARD FAILURE: he won ${g.falseWins} debate(s) from the false side — mastery 0.`
        : `From the true side he wins ${g.wins} of ${g.of} held-out debates against the reference arguer (at most ${bench(this.level)[0]!.k} citations or so each); from the false side he won none — the judge checks every fact.`,
    };
  }
  save(): DebateSave {
    return { game: 'debate', level: this.level, w: this.w.slice(), best: this.best, sigma: this.sigma, rand: this.rand };
  }
  view(): Frame {
    const names = ['about a thing the claim names', 'the claim’s measure', 'the link the claim uses (“whose capital is …”)', 'about the thing a link points to', 'in the claim’s group', 'the biggest value on the table', 'the same kind of thing', 'a big value', 'an unrelated measure', 'a linking fact', 'arguing TRUE: the group’s values', 'arguing FALSE: the biggest rival'];
    const mx = Math.max(0.01, ...this.w.map(Math.abs));
    return { bars: names.map((nm, i) => [nm, Math.abs(this.w[i]!) / mx, this.w[i]! >= 0 ? 'cites first' : 'cites later'] as [string, number, string]), caption: 'Which facts he reaches for first.' };
  }
  watch(seed: number): Frame[] {
    const d = makeDebate(this.level, seed);
    const head = [`Claim: ${claimSentence(d.s)}`, `Each side may cite up to ${d.k} of the ${d.pool.length} facts on the table.`];
    const frames: Frame[] = [{ lines: head, caption: `The truth (from the book): ${WORD[d.truth]}. Ghosty argues ${WORD[d.truth]} first.` }];
    const round = (gSide: Truth): string[] => {
      const other: Truth = gSide === 'T' ? 'F' : 'T';
      const mine = argue(d, gSide, this.w);
      const ref = reference(d, other);
      const lines = [`Ghosty argues ${WORD[gSide]}:`, ...mine.map((id) => `  [${id}] ${factById.get(id)!.text}`)];
      const jm = judge(d, gSide, mine);
      lines.push(`  Judge: every fact checked against the book — ${jm.why}.`);
      lines.push(`The reference arguer argues ${WORD[other]}:`, ...ref.map((id) => `  [${id}] ${factById.get(id)!.text}`));
      lines.push(`  Judge: ${judge(d, other, ref).why}.`);
      const w = gSide === 'T' ? winner(d, mine, ref) : winner(d, ref, mine);
      lines.push(w === gSide ? 'Ghosty wins.' : w ? 'The reference arguer wins.' : 'Nobody wins.');
      return lines;
    };
    const a = round(d.truth);
    a.forEach((_, i) => i % 3 === 2 && frames.push({ lines: [...head, ...a.slice(0, i + 1)], caption: 'Round 1: Ghosty on the true side' }));
    frames.push({ lines: [...head, ...a], caption: 'Round 1: Ghosty on the true side' });
    const b = round(d.truth === 'T' ? 'F' : 'T');
    frames.push({ lines: [...head, ...b], caption: 'Round 2: Ghosty on the false side — the judge never lets that side win.' });
    return frames;
  }
}

// ---- problems ---------------------------------------------------------------------------------------------

function generate(level: number, seed: number): Problem {
  const d = makeDebate(level, seed);
  const text = [
    `Two sides debate a claim: one says TRUE, one says FALSE. Each may cite at most ${d.k} of the facts below by their ids; a strict judge accepts a side only if the facts it cites, on their own, settle the claim its way. Use ONLY these facts.`,
    rosterLine(d.s),
    'Facts:',
    ...d.pool.map((f) => `[${f.id}] ${f.text}`),
    `Claim: ${claimSentence(d.s)}`,
    `Which side is right? Cite the fewest facts that prove it. Answer like "TRUE: F3, F17" or "FALSE: F8, F12".`,
  ].join('\n');
  return { game: 'debate', level: lvl(level), seed, text, data: { level: lvl(level), seed, truth: d.truth, best: support(d.s).map((f) => f.id) } };
}

/** The side and the cited ids from a reply's last line. */
export function readArgument(answer: string): { side: Truth | null; ids: string[] } {
  const lines = answer
    .split('\n')
    .map((l) => l.replace(/\*\*|__|`/g, ' ').trim())
    .filter(Boolean);
  const last = (lines[lines.length - 1] ?? '').toUpperCase();
  const ids = [...last.matchAll(/\bF(\d+)\b/g)].map((m) => `F${Number(m[1])}`);
  const words = last.replace(/\bF\d+\b/g, ' ');
  const side: Truth | null = /\b(FALSE|NOT TRUE)\b/.test(words) ? 'F' : /\bTRUE\b/.test(words) ? 'T' : null;
  return { side, ids };
}

function check(prob: Problem, answer: string): Verdict {
  const p = prob.data as { level: number; seed: number; truth: Truth; best: string[] };
  const d = makeDebate(p.level, p.seed);
  const { side, ids } = readArgument(answer);
  if (!side) return { correct: false, score: 0, why: 'No side (TRUE or FALSE) found.' };
  if (side !== d.truth) return { correct: false, score: 0, why: `The facts show the claim is ${WORD[d.truth]}.` };
  const j = judge(d, side, [...new Set(ids)]);
  if (!j.ok) return { correct: false, score: 0.25, why: `Right side, but the judge rejects the argument: ${j.why}.` };
  return { correct: true, score: Math.min(1, p.best.length / new Set(ids).size), why: `${WORD[side]} — the cited facts settle it.` };
}

export const debate: Game = {
  ...DEBATE,
  env: (level) => new DebateEnv(level),
  generate,
  check,
  learner: (level, seed, saved) => new DebateLearner(level, seed, saved),
};

/** (For the tests.) */
export const bookTruth = (s: Spec) => evaluate(s, BOOK);
