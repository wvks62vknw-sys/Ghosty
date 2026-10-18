/**
 * CODE BREAKER (Mastermind): a hidden code of `pegs` symbols from `colours` (repeats allowed); each guess
 * is answered "right symbol right place" (●) and "right symbol wrong place" (○). Ghosty learns a guessing
 * policy (guess.ts). The yardstick is Knuth's minimax rule — the guess whose worst case leaves the fewest
 * codes — played exhaustively over every secret. For the classic game (4 pegs, 6 colours, Level 10) that
 * rule needs 4.476 guesses on average and never more than 5 (Knuth, 1977); the best possible average is
 * 4.340 (Koyama & Lai, 1993), so a learner can beat the yardstick on average and mastery is capped at 100%.
 * He starts naive (guess the first code that still fits). Mastery = how much of the gap between that naive
 * start (0%) and the yardstick (100%) he has closed, by average guesses over all secrets.
 */
import { type Cell, finalLine, type Env, type Frame, type Game, type Learner, lvl, type Problem, rng, savedFor, type Verdict } from './core';
import { CODEBREAKER } from './meta';
import { closed, GuessPolicy, type GuessSave, minimax, naiveAvg, playAll, playOne, type Space, split, weighted } from './guess';

/** [pegs, colours] for Levels 1–10; Level 10 is the classic game. */
export const VARIANTS: [number, number][] = [
  [2, 4],
  [3, 3],
  [2, 5],
  [2, 6],
  [3, 4],
  [3, 5],
  [4, 4],
  [3, 6],
  [4, 5],
  [4, 6],
];

export const variant = (level: number) => VARIANTS[lvl(level) - 1]!;

export function digits(i: number, pegs: number, colours: number): number[] {
  const d: number[] = [];
  for (let p = 0; p < pegs; p++) {
    d.unshift(i % colours);
    i = Math.floor(i / colours);
  }
  return d;
}

/** "1 2 2 3" style: symbols 1..colours. */
export const codeText = (i: number, pegs: number, colours: number) => digits(i, pegs, colours).map((x) => x + 1).join('');

export function parseCode(text: string, pegs: number, colours: number): number {
  const d = text.replace(/[^0-9]/g, '').split('').map(Number);
  if (d.length !== pegs || d.some((x) => x < 1 || x > colours)) return -1;
  return d.reduce((a, x) => a * colours + (x - 1), 0);
}

/** ● (right place) and ○ (wrong place) for guess g against secret s. */
export function score(g: number[], s: number[], colours: number): [number, number] {
  let black = 0;
  const cg = new Array(colours).fill(0);
  const cs = new Array(colours).fill(0);
  for (let i = 0; i < g.length; i++) {
    if (g[i] === s[i]) black++;
    cg[g[i]!]++;
    cs[s[i]!]++;
  }
  let common = 0;
  for (let c = 0; c < colours; c++) common += Math.min(cg[c], cs[c]);
  return [black, common - black];
}

const spaces = new Map<number, Space>();
/** The feedback table for a level (made once). */
export function spaceFor(level: number): Space {
  const L = lvl(level);
  const hit = spaces.get(L);
  if (hit) return hit;
  const [p, k] = variant(L);
  const n = k ** p;
  const codes = [...Array(n).keys()].map((i) => digits(i, p, k));
  const fb = new Uint8Array(n * n);
  for (let g = 0; g < n; g++)
    for (let s = 0; s < n; s++) {
      const [b, w] = score(codes[g]!, codes[s]!, k);
      fb[g * n + s] = b * (p + 1) + w;
    }
  const sp = { n, fb, nf: (p + 1) * (p + 1), win: p * (p + 1) };
  spaces.set(L, sp);
  return sp;
}

const yard = new Map<number, { avg: number; worst: number }>();
/** Knuth's minimax over every secret at this level: average and worst number of guesses. */
export function yardstick(level: number): { avg: number; worst: number } {
  const L = lvl(level);
  const hit = yard.get(L);
  if (hit) return hit;
  const s = spaceFor(L);
  const r = playAll(s, minimax);
  const y = { avg: r.total / s.n, worst: r.worst };
  yard.set(L, y);
  return y;
}

const pegsText = (b: number, w: number) => `${'●'.repeat(b)}${'○'.repeat(w)}` || '–';
const PALETTE = ['#ff4d6a', '#ffd24d', '#52f2b5', '#62e4ff', '#b38cff', '#ff9a3c'];

class CodeEnv implements Env {
  secret = 0;
  guesses: [number, number, number][] = [];
  constructor(private level: number) {}
  reset(seed: number) {
    const [p, k] = variant(this.level);
    this.secret = Math.floor(rng(seed)() * k ** p);
    this.guesses = [];
  }
  actions() {
    return [...Array(spaceFor(this.level).n).keys()];
  }
  step(a: number) {
    const [p, k] = variant(this.level);
    const [b, w] = score(digits(a, p, k), digits(this.secret, p, k), k);
    this.guesses.push([a, b, w]);
    return { reward: -1, done: b === p || this.guesses.length >= 12 };
  }
  describe() {
    const [p, k] = variant(this.level);
    const lines = this.guesses.map(([g, b, w]) => `${codeText(g, p, k)} → ${b} right place, ${w} wrong place`);
    return `Code of ${p} symbols, each 1–${k} (repeats allowed).${lines.length ? `\n${lines.join('\n')}` : ' No guesses yet.'}`;
  }
}

interface CodeSaveData extends GuessSave {
  game: 'codebreaker';
  level: number;
}

class CodeLearner implements Learner {
  pol: GuessPolicy;
  constructor(
    private level: number,
    seed: number,
    saved?: unknown,
  ) {
    // Weights carry over between levels: the same facts about a guess matter in every variant.
    const s = savedFor<CodeSaveData>(saved, 'codebreaker');
    const same = s?.level === level;
    this.pol = new GuessPolicy(spaceFor(level), seed, s ? { ...s, avg: same ? s.avg : NaN, games: same ? s.games : 0 } : null);
    if (Number.isNaN(this.pol.avg)) this.pol.avg = this.pol.score(this.pol.w);
  }
  train(n: number) {
    return this.pol.train(n);
  }
  measure() {
    const y = yardstick(this.level);
    const [p, k] = variant(this.level);
    const his = this.pol.avg;
    const n = spaceFor(this.level).n;
    const known = lvl(this.level) === 10 ? ' (best possible: 4.340)' : '';
    return {
      mastery: closed(his, naiveAvg(spaceFor(this.level)), y.avg),
      detail: `${p} pegs, ${k} symbols: he needs ${his.toFixed(3)} guesses on average over all ${n.toLocaleString('en-GB')} codes; Knuth's minimax needs ${y.avg.toFixed(3)}, never more than ${y.worst}${known}; guessing the first code that fits needs ${naiveAvg(spaceFor(this.level)).toFixed(3)} (0%).`,
    };
  }
  save(): CodeSaveData {
    return { game: 'codebreaker', level: this.level, ...this.pol.save() };
  }
  view(): Frame {
    const names = ['biggest group left', 'average group', 'information left', 'not a possible code', 'few groups'];
    const w = this.pol.w;
    const mx = Math.max(...w.map(Math.abs)) || 1;
    return {
      bars: names.map((nm, i) => [nm, Math.abs(w[i]!) / mx, w[i]! > 0 ? 'avoids' : 'seeks'] as [string, number, string]),
      caption: 'What he looks at when choosing a guess, and how much (avoids = counts against a guess).',
    };
  }
  watch(seed: number, secret?: string): Frame[] {
    const [p, k] = variant(this.level);
    const sp = spaceFor(this.level);
    let sec = secret ? parseCode(secret, p, k) : -1;
    if (sec < 0) sec = Math.floor(rng(seed)() * sp.n);
    const gs = playOne(sp, weighted(this.pol.w), sec);
    const frames: Frame[] = [];
    const rowsSoFar: Cell[] = [];
    let cand = [...Array(sp.n).keys()];
    gs.forEach((g, i) => {
      const [b, w] = score(digits(g, p, k), digits(sec, p, k), k);
      for (const d of digits(g, p, k)) rowsSoFar.push({ t: String(d + 1), c: PALETTE[d % PALETTE.length] });
      rowsSoFar.push({ t: pegsText(b, w), c: 'dim' });
      cand = split(sp, g, cand).get(b * (p + 1) + w) ?? [];
      const done = b === p;
      frames.push({
        grid: { w: p + 1, h: i + 1, cells: rowsSoFar.slice() },
        caption: done ? `Cracked ${codeText(sec, p, k)} in ${i + 1} guesses.` : `Guess ${i + 1}: ${cand.length} possible code${cand.length === 1 ? '' : 's'} left.`,
      });
    });
    return frames;
  }
}

function generate(level: number, seed: number): Problem {
  const L = lvl(level);
  const [p, k] = variant(L);
  const sp = spaceFor(L);
  for (let t = 0; ; t++) {
    const sec = Math.floor(rng(seed + t * 7777)() * sp.n);
    let cand = [...Array(sp.n).keys()];
    const clues: string[] = [];
    while (cand.length > 1) {
      const g = minimax(sp, cand, clues.length + 1);
      const [b, w] = score(digits(g, p, k), digits(sec, p, k), k);
      if (b === p) break;
      clues.push(`${codeText(g, p, k)} → ${b} right place, ${w} wrong place`);
      cand = cand.filter((c) => sp.fb[g * sp.n + c] === sp.fb[g * sp.n + sec]);
    }
    if (cand.length !== 1 || !clues.length) continue;
    const text = `Mastermind: a hidden code of ${p} symbols, each from 1 to ${k} (repeats allowed). Clues:\n${clues.join('\n')}\nExactly one code fits every clue. What is it? Answer with the ${p} digits.`;
    return { game: 'codebreaker', level: L, seed, text, data: { level: L, answer: codeText(sec, p, k) } };
  }
}

function check(p: Problem, answer: string): Verdict {
  const d = p.data as { level: number; answer: string };
  // The last group of exactly as many digits as the code has ("After 2 clues the code is 3 1 2" → 312).
  const groups = (finalLine(answer).match(/\d(?:[\s,-]*\d)*/g) ?? []).map((g) => g.replace(/\D/g, ''));
  const got = groups.filter((g) => g.length === d.answer.length).pop() ?? '';
  const ok = got === d.answer;
  return { correct: ok, score: ok ? 1 : 0, why: ok ? 'That is the only code that fits.' : `The code is ${d.answer}.` };
}

export const codebreaker: Game = {
  ...CODEBREAKER,
  env: (level) => new CodeEnv(level),
  generate,
  check,
  learner: (level, seed, saved) => new CodeLearner(level, seed, saved),
};
