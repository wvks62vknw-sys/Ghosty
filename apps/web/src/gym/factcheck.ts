/**
 * FACT-CHECK DUEL: a claim made from the fact book (facts.ts) is TRUE, FALSE, or CAN'T TELL — the book does
 * not record what it needs, or does not list the thing at all. Some need two steps ("the country whose
 * capital is Ottawa has more than 30 million people"; "X has more people than Y"), some a whole group ("of
 * the listed countries in Asia, India has the most people"). Ground truth is the book itself, judged by a
 * three-valued evaluator.
 *
 * He checks a claim by looking facts up one at a time (each lookup costs a little) and then answering. What
 * he sees is only the SHAPE of what he has found — "the first value is known, the second is not recorded",
 * "the first is bigger", "someone in the group beats the claimed one" — never the names or numbers, so he
 * cannot memorise the book: he has to learn a strategy. A table of how good each move is in each situation
 * (Q-learning) teaches him which facts to look up, when he has enough, and how the findings combine into
 * TRUE, FALSE or CAN'T TELL. Mastery = his accuracy on a fixed held-out set of claims; where a level has
 * undecidable claims, also his accuracy on those (the lower of the two counts).
 */
import { type Env, finalLine, type Frame, type Game, type Learner, lvl, type Problem, rng, savedFor, type Verdict } from './core';
import { BOOK, byName, claimSentence, evaluate, factsFor, gapsFor, listed, makeSpec, planFor, type Ref, resolveRef, roster, rosterLine, type Spec, type Truth, truthsFor, type Value } from './facts';
import { FACTCHECK } from './meta';

export const ACTIONS = ['answer TRUE', 'answer FALSE', 'answer CAN’T TELL', 'look up the first thing', 'look up the other thing'];
const TRUTHS: Truth[] = ['T', 'F', 'U'];
export const WORD: Record<Truth, string> = { T: 'TRUE', F: 'FALSE', U: 'CAN’T TELL' };
const COST = 0.03;

/** One claim being checked: what he has looked up so far. */
export class Check {
  /** The first thing: its name once found (null = not in the book), its value once looked up (null = not recorded). */
  aName: string | null | undefined;
  aVal: Value | null | undefined;
  bName: string | null | undefined;
  bVal: Value | null | undefined;
  /** For "the most …" claims: the others in the group, and how many he has looked at. */
  others: string[] = [];
  seen = 0;
  beaten = false;
  open = false;
  lookups = 0;
  log: string[] = [];
  constructor(public s: Spec) {
    if (s.k === 'super') this.others = roster(s.kind, s.group).filter((o) => !('name' in s.a) || o !== s.a.name);
  }
  private field(): string {
    return this.s.k === 'flows' ? 'through' : this.s.field;
  }
  private refWords(r: Ref) {
    return 'name' in r ? r.name : `the ${r.kind} whose ${r.by} is ${r.v}`;
  }
  canA(): boolean {
    return this.aVal === undefined && this.aName !== null;
  }
  canB(): boolean {
    const s = this.s;
    if (s.k === 'cmp') return this.bVal === undefined && this.bName !== null;
    if (s.k === 'flows') return this.bName === undefined;
    if (s.k === 'super') return this.seen < this.others.length;
    return false;
  }
  legal(): number[] {
    const out = [0, 1, 2];
    if (this.canA()) out.push(3);
    if (this.canB()) out.push(4);
    return out;
  }
  /** Look one fact up in the book (one step of the chain to the value). */
  look(which: 'a' | 'b') {
    this.lookups++;
    const s = this.s;
    if (which === 'a' || s.k !== 'super') {
      const isA = which === 'a';
      const ref = isA ? s.a : (s as { b: Ref }).b;
      const nameKey = isA ? 'aName' : 'bName';
      const valKey = isA ? 'aVal' : 'bVal';
      if (this[nameKey] === undefined && !('name' in ref)) {
        const n = resolveRef(ref, BOOK);
        this[nameKey] = n;
        this.log.push(n ? `Look up ${this.refWords(ref)}: it is ${n}.` : `Look up ${this.refWords(ref)}: nothing in the book.`);
        return;
      }
      const name = this[nameKey] ?? ('name' in ref ? ref.name : null);
      if (!isA && s.k === 'flows') {
        this.bName = name && listed(name) ? name : null;
        this.log.push(this.bName ? `${name} is in the book.` : `${name} is not in the book.`);
        return;
      }
      this[nameKey] = name && listed(name) ? name : null;
      const field = this.field();
      const v = this[nameKey] ? BOOK.get(this[nameKey]!, field) : null;
      this[valKey] = v;
      this.log.push(!this[nameKey] ? `Look up ${name}: not in the book.` : v == null ? `Look up ${name}'s ${field}: not recorded.` : `Look up ${name}'s ${field}: ${Array.isArray(v) ? v.join(', ') : String(v)}.`);
      if (s.k === 'super' && this.aVal != null) this.rescan();
      return;
    }
    const o = this.others[this.seen++]!;
    const v = BOOK.get(o, s.field);
    this.log.push(v == null ? `Look up ${o}'s ${s.field}: not recorded.` : `Look up ${o}'s ${s.field}: ${String(v)}.`);
    this.rescan();
  }
  private rescan() {
    const s = this.s as Extract<Spec, { k: 'super' }>;
    this.beaten = false;
    this.open = false;
    for (const o of this.others.slice(0, this.seen)) {
      const v = BOOK.get(o, s.field) as number | null;
      if (v == null) this.open = true;
      else if (this.aVal != null && v > (this.aVal as number)) this.beaten = true;
    }
  }
  /** What he can see: the claim's shape and what his lookups found — no names, no numbers. */
  sig(): string {
    const s = this.s;
    const st = (name: string | null | undefined, val: Value | null | undefined) => (name === null || val === null ? 'u' : val !== undefined ? 'k' : name !== undefined ? 'h' : '-');
    const A = st(this.aName, this.aVal);
    let B = '';
    let rel = '';
    if (s.k === 'eq' && A === 'k') rel = this.aVal === s.v ? 'same' : 'differs';
    if (s.k === 'gt' && A === 'k') rel = (this.aVal as number) > s.n ? 'above' : 'below';
    if (s.k === 'cmp') {
      B = st(this.bName, this.bVal);
      if (A === 'k' && B === 'k') rel = (this.aVal as number) > (this.bVal as number) ? 'bigger' : 'not bigger';
    }
    if (s.k === 'flows') {
      B = this.bName === undefined ? '-' : this.bName === null ? 'u' : 'k';
      if (A === 'k' && B === 'k') rel = (this.aVal as string[]).includes(this.bName!) ? 'in' : 'not in';
    }
    if (s.k === 'super') {
      B = this.seen === 0 ? 'none' : this.seen < this.others.length ? 'some' : 'all';
      rel = `${this.beaten ? 'beaten' : 'unbeaten'}${this.open ? ', a gap' : ''}`;
    }
    return `${s.k}|${A}|${B}|${rel}`;
  }
}

/** Plain words for a situation (the learned table on screen). */
export function sigWords(sig: string): string {
  const [k, A, B, rel] = sig.split('|');
  const what: Record<string, string> = { eq: 'a fact about one thing', gt: 'a number above a line', cmp: 'one thing bigger than another', flows: 'a river through a country', super: 'the most in a group' };
  const st: Record<string, string> = { '-': 'nothing looked up', h: 'found, value not yet', k: 'known', u: 'missing' };
  const b = k === 'super' ? `others looked at: ${B}` : B ? `second: ${st[B!] ?? B}` : '';
  return [what[k!] ?? k, `first: ${st[A!] ?? A}`, b, rel].filter(Boolean).join(' · ');
}

interface Episode {
  answer: Truth;
  lookups: number;
  log: string[];
}

/** Check one claim with Q-values q (ε-greedy when exploring). */
function run(s: Spec, q: Map<string, Float64Array>, eps: number, r: () => number, learn?: { alpha: number; truth: Truth }): Episode {
  const c = new Check(s);
  for (let guard = 0; guard < 20; guard++) {
    const sig = c.sig();
    let row = q.get(sig);
    if (!row) q.set(sig, (row = new Float64Array(5)));
    const legal = c.legal();
    let a = legal[0]!;
    if (r() < eps) a = legal[Math.floor(r() * legal.length)]!;
    else for (const x of legal) if (row[x]! > row[a]!) a = x;
    if (a < 3) {
      const ans = TRUTHS[a]!;
      if (learn) row[a]! += learn.alpha * ((ans === learn.truth ? 1 : -1) - row[a]!);
      return { answer: ans, lookups: c.lookups, log: c.log };
    }
    c.look(a === 3 ? 'a' : 'b');
    if (learn) {
      const next = q.get(c.sig());
      let best = next ? -Infinity : 0;
      if (next) for (const x of c.legal()) best = Math.max(best, next[x]!);
      row[a]! += learn.alpha * (-COST + best - row[a]!);
    }
  }
  return { answer: 'U', lookups: c.lookups, log: c.log };
}

const benches = new Map<number, { s: Spec; t: Truth }[]>();
/** The held-out claims: 20 of each truth the level has (never trained on: different seeds from practice). */
export function bench(level: number): { s: Spec; t: Truth }[] {
  const L = lvl(level);
  let b = benches.get(L);
  if (!b) {
    b = [];
    for (let i = 0; i < 20; i++) for (const t of truthsFor(L)) b.push({ s: makeSpec(L, 70000 + i, t), t });
    benches.set(L, b);
  }
  return b;
}

class FactEnv implements Env {
  c = new Check(makeSpec(1, 1, 'T'));
  truth: Truth = 'T';
  constructor(private level: number) {}
  reset(seed: number) {
    const ts = truthsFor(this.level);
    this.truth = ts[seed % ts.length]!;
    this.c = new Check(makeSpec(this.level, seed, this.truth));
  }
  /** 0 TRUE, 1 FALSE, 2 CAN'T TELL, 3 look up the first thing, 4 the other thing. */
  actions() {
    return this.c.legal();
  }
  step(a: number) {
    if (a < 3) return { reward: TRUTHS[a] === this.truth ? 1 : -1, done: true };
    if (!this.c.legal().includes(a)) return { reward: -1, done: true };
    this.c.look(a === 3 ? 'a' : 'b');
    return { reward: -COST, done: false };
  }
  describe() {
    return `Claim: ${claimSentence(this.c.s)} Looked up so far: ${this.c.log.join(' ') || 'nothing'}.`;
  }
}

interface FactSave {
  game: 'factcheck';
  level: number;
  q: Record<string, number[]>;
  claims: number;
  rand: number;
}

class FactLearner implements Learner {
  q = new Map<string, Float64Array>();
  claims: number;
  rand: number;
  r: () => number;
  constructor(
    private level: number,
    seed: number,
    saved?: unknown,
  ) {
    const s = savedFor<FactSave>(saved, 'factcheck');
    // What he learned carries over to the next level: the situations are the same kinds.
    if (s) for (const [k, v] of Object.entries(s.q)) this.q.set(k, Float64Array.from(v));
    this.claims = s?.claims ?? 0;
    this.rand = s?.rand ?? seed;
    this.r = rng(this.rand);
  }
  train(n: number) {
    const ts = truthsFor(this.level);
    for (let i = 0; i < n; i++) {
      // Practice claims come from seeds far from the test's.
      const t = ts[Math.floor(this.r() * ts.length)]!;
      const s = makeSpec(this.level, 1_000_000 + Math.floor(this.r() * 1e8), t);
      run(s, this.q, 0.25, this.r, { alpha: 0.2, truth: t });
    }
    this.claims += n;
    this.rand = (this.rand + n * 2654435761) >>> 0;
    return n;
  }
  measure() {
    const set = bench(this.level);
    let ok = 0;
    let unsure = 0;
    let unsureOk = 0;
    let looks = 0;
    const r = rng(1);
    for (const { s, t } of set) {
      const e = run(s, this.q, 0, r);
      looks += e.lookups;
      if (e.answer === t) ok++;
      if (t === 'U') {
        unsure++;
        if (e.answer === 'U') unsureOk++;
      }
    }
    const acc = ok / set.length;
    const accU = unsure ? unsureOk / unsure : 1;
    return {
      mastery: Math.min(acc, accU),
      detail: `${ok} of ${set.length} held-out claims right (${(looks / set.length).toFixed(1)} lookups each)${unsure ? `; “can’t tell” said rightly ${unsureOk} of ${unsure} times` : ''} — judged by the fact book.`,
    };
  }
  save(): FactSave {
    const q: Record<string, number[]> = {};
    for (const [k, v] of this.q) q[k] = Array.from(v);
    return { game: 'factcheck', level: this.level, q, claims: this.claims, rand: this.rand };
  }
  view(): Frame {
    // The situations he has met most confidently, with what he does there.
    const rows = [...this.q.entries()]
      .map(([k, v]) => {
        const a = v.indexOf(Math.max(...v));
        return { k, a, conf: Math.max(...v) - Math.min(...v) };
      })
      .filter((x) => x.conf > 0.05)
      .sort((x, y) => y.conf - x.conf)
      .slice(0, 8);
    if (!rows.length) return { lines: ['He has not learned anything yet: he would answer TRUE to everything.'], caption: 'What he does in each situation.' };
    return { lines: rows.map((x) => `${sigWords(x.k)} → ${ACTIONS[x.a]}`), caption: 'What he does in each situation (his most confident ones).' };
  }
  watch(seed: number): Frame[] {
    const ts = truthsFor(this.level);
    const t = ts[seed % ts.length]!;
    const s = makeSpec(this.level, seed, t);
    const e = run(s, this.q, 0, rng(seed));
    const head = `Claim: ${claimSentence(s)}`;
    const frames: Frame[] = [{ lines: [head], caption: 'He decides what to look up.' }];
    e.log.forEach((_, i) => frames.push({ lines: [head, ...e.log.slice(0, i + 1)], caption: `Lookup ${i + 1}` }));
    frames.push({ lines: [head, ...e.log, `He answers ${WORD[e.answer]}.`], caption: e.answer === t ? `Right — the book says ${WORD[t]}.` : `Wrong — the book says ${WORD[t]}.` });
    return frames;
  }
}

// ---- problems ---------------------------------------------------------------------------------------------

function generate(level: number, seed: number): Problem {
  const ts = truthsFor(level);
  const t = ts[seed % ts.length]!;
  const s = makeSpec(level, seed, t);
  const facts = factsFor(s, seed, 4 + lvl(level));
  const gaps = gapsFor(s);
  const text = [
    `Using ONLY the facts below (not anything else you know), decide whether the claim is TRUE, FALSE, or CAN'T TELL (the facts do not settle it — a value is not recorded, or the thing is not in the book).`,
    rosterLine(s),
    'Facts:',
    ...facts.map((f) => `[${f.id}] ${f.text}`),
    ...gaps,
    `Claim: ${claimSentence(s)}`,
    planFor(level).unsure ? `Answer TRUE, FALSE or CAN'T TELL.` : 'Answer TRUE or FALSE.',
  ].join('\n');
  return { game: 'factcheck', level: lvl(level), seed, text, data: { spec: s, truth: t } };
}

/** TRUE / FALSE / CAN'T TELL from a reply's last line ("not true" is FALSE; "cannot be determined" is CAN'T TELL). */
export function readTruth(answer: string): Truth | null {
  const t = finalLine(answer).toLowerCase().replace(/[’`]/g, "'");
  if (/can'?t tell|cannot tell|can not tell|not enough|undecid|cannot be (determined|decided|told)|can'?t be (determined|decided|told)|not (determinable|decidable)|insufficient|unknown/.test(t)) return 'U';
  if (/\b(false|not true|incorrect|wrong)\b/.test(t)) return 'F';
  if (/\b(true|correct|right)\b/.test(t)) return 'T';
  return null;
}

function check(prob: Problem, answer: string): Verdict {
  const d = prob.data as { truth: Truth };
  const said = readTruth(answer);
  if (!said) return { correct: false, score: 0, why: "No TRUE, FALSE or CAN'T TELL found." };
  return said === d.truth ? { correct: true, score: 1, why: `${WORD[d.truth]} — right.` } : { correct: false, score: 0, why: `The facts say ${WORD[d.truth]}.` };
}

export const factcheck: Game = {
  ...FACTCHECK,
  env: (level) => new FactEnv(level),
  generate,
  check,
  learner: (level, seed, saved) => new FactLearner(level, seed, saved),
};

/** (For the tests: the book's verdict on a claim.) */
export const truthOf = (s: Spec) => evaluate(s, BOOK);
export { byName };
