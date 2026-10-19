/**
 * COLONY: Energy, Materials, Panels and the Day. Each day he does one thing — MINE (−2 energy, +2
 * materials), BUILD PANEL (−3 materials, −1 energy, +1 panel) or REST (+3 energy) — then every panel makes
 * 2 energy (that is the colony's output) and the colony uses its upkeep. Energy at zero or below ends the
 * run. Energy holds at most 20, materials 20, panels 10. He learns by tabular Q-learning on the exact
 * state. Ground truth: dynamic programming over every state finds the most output possible in the
 * horizon; mastery = his output ÷ that optimum. Levels lengthen the run (10 → 40 days), start him with less
 * energy and, from Level 6, double the upkeep.
 */
import { argmax, finalLine, type Env, type Frame, type Game, type Learner, lvl, type Problem, rng, savedFor, type Verdict } from './core';
import { COLONY } from './meta';

export const ACTIONS = ['MINE', 'BUILD PANEL', 'REST'];
export const E_MAX = 20;
export const M_MAX = 20;
export const P_MAX = 10;
const DEATH = -10;

export interface Rules {
  days: number;
  upkeep: number;
  e0: number;
}
export const rules = (level: number): Rules => {
  const L = lvl(level);
  return { days: [10, 12, 14, 16, 18, 20, 24, 28, 34, 40][L - 1]!, upkeep: L >= 6 ? 2 : 1, e0: L >= 4 ? 4 : 6 };
};

export interface ColonyState {
  e: number;
  m: number;
  p: number;
  day: number;
}

export const canDo = (s: ColonyState, a: number) => (a === 1 ? s.m >= 3 && s.p < P_MAX : true);

/** One day: the action, the panels' output (2 energy each), the upkeep. Reward = the day's output (−10 more if the lights go out). */
export function day(s: ColonyState, a: number, R: Rules): { next: ColonyState; reward: number; done: boolean } {
  let { e, m, p } = s;
  if (a === 0) (e -= 2), (m = Math.min(M_MAX, m + 2));
  else if (a === 1 && canDo(s, 1)) (m -= 3), (e -= 1), (p += 1);
  else if (a === 2) e += 3;
  e = Math.min(E_MAX, e + 2 * p) - R.upkeep;
  const next = { e, m, p, day: s.day + 1 };
  if (e <= 0) return { next, reward: 2 * p + DEATH, done: true };
  return { next, reward: 2 * p, done: next.day >= R.days };
}

const idx = (s: ColonyState) => ((s.day * (E_MAX + 1) + Math.max(0, s.e)) * (M_MAX + 1) + s.m) * (P_MAX + 1) + s.p;
const size = (R: Rules) => (R.days + 1) * (E_MAX + 1) * (M_MAX + 1) * (P_MAX + 1);

/** Ground truth: the best total from every state (dynamic programming, day by day from the end). */
export function optimum(R: Rules): Float32Array {
  const V = new Float32Array(size(R));
  for (let d = R.days - 1; d >= 0; d--)
    for (let e = 1; e <= E_MAX; e++)
      for (let m = 0; m <= M_MAX; m++)
        for (let p = 0; p <= P_MAX; p++) {
          const s = { e, m, p, day: d };
          let best = -Infinity;
          for (let a = 0; a < 3; a++) {
            if (!canDo(s, a)) continue;
            const r = day(s, a, R);
            const v = r.reward + (r.done ? 0 : V[idx(r.next)]!);
            if (v > best) best = v;
          }
          V[idx(s)] = best;
        }
  return V;
}

/** Play a plan (or a policy) from a state: output, days lived, actions taken. */
export function run(R: Rules, start: ColonyState, choose: (s: ColonyState) => number): { total: number; output: number; lived: number; acts: number[]; states: ColonyState[] } {
  let s = start;
  let total = 0;
  let output = 0;
  const acts: number[] = [];
  const states = [s];
  while (s.day < R.days) {
    let a = choose(s);
    if (!canDo(s, a)) a = 2;
    const r = day(s, a, R);
    acts.push(a);
    total += r.reward;
    output += 2 * r.next.p;
    s = r.next;
    states.push(s);
    if (r.done) break;
  }
  return { total, output, lived: s.e > 0 ? s.day : s.day - 1, acts, states };
}

const startOf = (R: Rules): ColonyState => ({ e: R.e0, m: 0, p: 0, day: 0 });

class ColonyEnv implements Env {
  R: Rules;
  s: ColonyState;
  constructor(level: number) {
    this.R = rules(level);
    this.s = startOf(this.R);
  }
  reset() {
    this.s = startOf(this.R);
  }
  actions() {
    return [0, 1, 2].filter((a) => canDo(this.s, a));
  }
  step(a: number) {
    const r = day(this.s, a, this.R);
    this.s = r.next;
    return { reward: r.reward, done: r.done };
  }
  describe() {
    return describeState(this.s, this.R);
  }
}

function describeState(s: ColonyState, R: Rules): string {
  return `Colony, day ${s.day + 1} of ${R.days}: energy ${s.e}/${E_MAX}, materials ${s.m}, panels ${s.p}. Upkeep ${R.upkeep} energy a day.`;
}

/** A fresh table that expects the most from every untried choice (as if every panel were already built), so he tries them all. */
function optimistic(R: Rules): Float32Array {
  const q = new Float32Array(size(R) * 3);
  const perDay = (E_MAX + 1) * (M_MAX + 1) * (P_MAX + 1) * 3;
  for (let i = 0; i < q.length; i++) q[i] = 2 * P_MAX * (R.days - Math.floor(i / perDay));
  return q;
}

interface ColonySave {
  game: 'colony';
  level: number;
  q: Float32Array;
  runs: number;
  rand: number;
}

const optCache = new Map<number, Float32Array>();
const optFor = (level: number) => {
  const L = lvl(level);
  let v = optCache.get(L);
  if (!v) optCache.set(L, (v = optimum(rules(L))));
  return v;
};

class ColonyLearner implements Learner {
  R: Rules;
  q: Float32Array;
  runs: number;
  rand: number;
  r: () => number;
  constructor(
    private level: number,
    seed: number,
    saved?: unknown,
  ) {
    this.R = rules(level);
    const s = savedFor<ColonySave>(saved, 'colony', level);
    this.q = s?.q?.length === size(this.R) * 3 ? s.q : optimistic(this.R);
    this.runs = s?.runs ?? 0;
    this.rand = s?.rand ?? seed;
    this.r = rng(this.rand);
  }
  greedy = (s: ColonyState) => {
    const i = idx(s) * 3;
    let best = 2;
    for (const a of [2, 0, 1]) if (canDo(s, a) && this.q[i + a]! > this.q[i + best]!) best = a;
    return best;
  };
  train(n: number) {
    const { q, r, R } = this;
    for (let k = 0; k < n; k++) {
      let s = startOf(R);
      while (s.day < R.days) {
        let a = r() < 0.15 ? Math.floor(r() * 3) : this.greedy(s);
        if (!canDo(s, a)) a = 2;
        const st = day(s, a, R);
        const i = idx(s) * 3 + a;
        const nx = st.done ? 0 : q[idx(st.next) * 3 + this.greedy(st.next)]!;
        q[i]! += 0.5 * (st.reward + nx - q[i]!);
        s = st.next;
        if (st.done) break;
      }
    }
    this.runs += n;
    this.rand = (this.rand + n * 2654435761) >>> 0;
    return n;
  }
  measure() {
    const best = optFor(this.level)[idx(startOf(this.R))]!;
    const his = run(this.R, startOf(this.R), this.greedy);
    return {
      mastery: best > 0 ? Math.max(0, his.total) / best : his.total >= best ? 1 : 0,
      detail: `${this.R.days}-day run, upkeep ${this.R.upkeep}: his colony scores ${his.total} (lived ${his.lived} days); the best possible is ${best} (dynamic programming over every state).`,
    };
  }
  save(): ColonySave {
    return { game: 'colony', level: this.level, q: this.q, runs: this.runs, rand: this.rand };
  }
  /** How his plan changes through the run: the share of each action in the first, middle and last third. */
  view(): Frame {
    const his = run(this.R, startOf(this.R), this.greedy);
    const third = Math.max(1, Math.ceil(this.R.days / 3));
    const bars: [string, number, string][] = [];
    ['EARLY', 'MIDDLE', 'LATE'].forEach((ph, i) => {
      const part = his.acts.slice(i * third, (i + 1) * third);
      if (!part.length) return;
      ACTIONS.forEach((nm, a) => {
        const share = part.filter((x) => x === a).length / part.length;
        bars.push([`${ph} · ${nm}`, share, `${Math.round(share * 100)}%`]);
      });
    });
    return { bars, caption: 'How his strategy shifts: early, middle and late in the run.' };
  }
  watch(): Frame[] {
    const his = run(this.R, startOf(this.R), this.greedy);
    return his.states.map((s, i) => ({
      bars: [
        ['ENERGY', Math.max(0, s.e) / E_MAX, String(s.e)],
        ['MATERIALS', s.m / M_MAX, String(s.m)],
        ['PANELS', s.p / P_MAX, String(s.p)],
      ],
      caption: i === 0 ? `Day 1: energy ${s.e}, nothing built yet.` : s.e <= 0 ? `Day ${s.day}: ${ACTIONS[his.acts[i - 1]!]} — the lights went out.` : `Day ${s.day}: ${ACTIONS[his.acts[i - 1]!]}.`,
    }));
  }
}

function generate(level: number, seed: number): Problem {
  const R = rules(level);
  const r = rng(seed);
  // A mid-run state: a few days in, with some stock.
  const start: ColonyState = { e: 3 + Math.floor(r() * 10), m: Math.floor(r() * 7), p: Math.floor(r() * 3), day: Math.floor(r() * Math.max(1, R.days - 6)) };
  const best = optFor(level)[idx(start)]!;
  const left = R.days - start.day;
  const text = `${describeState(start, R)}\nEach day choose one: MINE (−2 energy, +2 materials), BUILD (needs 3 materials: −3 materials, −1 energy, +1 panel), REST (+3 energy). Then each panel makes 2 energy (that is the output; energy holds at most ${E_MAX}), and the upkeep is paid. Energy at 0 or below ends the run with a penalty of 10. Score = total output. Give the plan for the remaining ${left} days as a list of MINE / BUILD / REST that scores the most.`;
  return { game: 'colony', level: lvl(level), seed, text, data: { level: lvl(level), start, best } };
}

function check(p: Problem, answer: string): Verdict {
  const d = p.data as { level: number; start: ColonyState; best: number };
  const R = rules(d.level);
  // The plan: the actions on the last line, or in the whole answer when it is written as a list.
  const act = /\b(MINE|BUILD|REST)\b/g;
  const last = finalLine(answer).toUpperCase().match(act) ?? [];
  const words = last.length > 1 ? last : (answer.toUpperCase().match(act) ?? []);
  const plan = words.map((w) => (w === 'MINE' ? 0 : w === 'BUILD' ? 1 : 2));
  let bad = false;
  const res = run(R, d.start, (s) => {
    const a = plan[s.day - d.start.day] ?? 2;
    if (!canDo(s, a)) bad = true;
    return a;
  });
  if (bad) return { correct: false, score: 0, why: 'The plan builds without 3 materials.' };
  const score = d.best > 0 ? Math.max(0, res.total) / d.best : res.total >= d.best ? 1 : 0;
  return { correct: res.total >= d.best, score: Math.min(1, score), why: `The plan scores ${res.total}; the best is ${d.best}.` };
}

export const colony: Game = {
  ...COLONY,
  env: (level) => new ColonyEnv(level),
  generate,
  check,
  learner: (level, seed, saved) => new ColonyLearner(level, seed, saved),
};
