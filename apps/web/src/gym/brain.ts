/**
 * MINI-BRAIN LAB: tiny neural networks, trained here in plain TypeScript, on toy data made in code — XOR
 * corners, a disc inside a ring, a checkerboard, spirals, and 5×5 pixel digits with noise. He searches over
 * network shapes and settings (how many hidden layers, how wide, tanh or ReLU, how fast it learns), trying
 * each on practice datasets of the level's kind and keeping score on their check split.
 *
 * Ground truth: his chosen shape is trained on held-out datasets (new samples he never saw) and scored on
 * their held-out test split, next to a fixed baseline network for the level trained the same way. From
 * Level 7 an energy budget counts too: the multiply-adds it takes to train the network must be at most
 * half the baseline's. Mastery = the share of held-out datasets where his network is at least as
 * accurate as the baseline (within 2 points) and within the energy budget. Compute is phone-sized: a
 * network learns from 120 points for a few dozen passes.
 */
import { type Env, finalLine, type Frame, type Game, type Learner, lvl, type Problem, randInt, rng, savedFor, shuffle, type Verdict } from './core';
import { BRAIN } from './meta';

// ---- data ---------------------------------------------------------------------------------------------------

export type Kind = 'xor' | 'circles' | 'checker' | 'spiral2' | 'spiral3' | 'digits';

export interface Data {
  x: Float64Array[];
  y: number[];
  inputs: number;
  classes: number;
}

/** The ten digits drawn on 5×5 pixels (row by row). */
const GLYPHS = [
  '.###.#...##...##...#.###.',
  '..#...##....#....#...###.',
  '####.....#.###.#....#####',
  '####.....#.###.....#####.',
  '#..#.#..#.#####...#....#.',
  '######....####.....#####.',
  '.###.#....####.#...#.###.',
  '#####...#...#...#....#...',
  '.###.#...#.###.#...#.###.',
  '.###.#...#.####....#.###.',
];
const CANVAS = 6;

function sample(kind: Kind, n: number, r: () => number, classes: number): Data {
  const x: Float64Array[] = [];
  const y: number[] = [];
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(2 * Math.PI * r());
  while (x.length < n) {
    if (kind === 'digits') {
      // A digit at a random spot on a 6×6 canvas, with about one pixel in ten flipped.
      const c = Math.floor(r() * classes);
      const g = GLYPHS[c]!;
      const dx = Math.floor(r() * 2);
      const dy = Math.floor(r() * 2);
      const px = new Float64Array(CANVAS * CANVAS).fill(-1);
      for (let i = 0; i < 25; i++) if (g[i] === '#') px[(Math.floor(i / 5) + dy) * CANVAS + (i % 5) + dx] = 1;
      for (let i = 0; i < px.length; i++) if (r() < 0.1) px[i] = -px[i]!;
      x.push(px);
      y.push(c);
      continue;
    }
    if (kind === 'spiral2' || kind === 'spiral3') {
      const arms = kind === 'spiral2' ? 2 : 3;
      const c = Math.floor(r() * arms);
      const t = 0.15 + 0.85 * r();
      const a = 2.6 * Math.PI * t + (2 * Math.PI * c) / arms + 0.18 * gauss();
      x.push(Float64Array.of(t * Math.cos(a), t * Math.sin(a)));
      y.push(c);
      continue;
    }
    const p = r() * 2 - 1;
    const q = r() * 2 - 1;
    if (kind === 'xor') {
      if (Math.abs(p) < 0.08 || Math.abs(q) < 0.08) continue;
      x.push(Float64Array.of(p, q));
      y.push(p * q > 0 ? 1 : 0);
    } else if (kind === 'circles') {
      const d = Math.hypot(p, q);
      if (d > 1 || (d > 0.45 && d < 0.6)) continue;
      x.push(Float64Array.of(p, q));
      y.push(d < 0.5 ? 0 : 1);
    } else {
      const i = Math.min(2, Math.floor((p + 1) * 1.5));
      const j = Math.min(2, Math.floor((q + 1) * 1.5));
      x.push(Float64Array.of(p, q));
      y.push((i + j) % 2);
    }
  }
  return { x, y, inputs: x[0]!.length, classes: kind === 'spiral3' ? 3 : kind === 'digits' ? classes : kind === 'spiral2' ? 2 : 2 };
}

export interface Spec {
  kind: Kind;
  classes: number;
  epochs: number;
  /** Energy counts from here (multiply-adds to train ≤ half the baseline's). */
  energy: boolean;
  base: Shape;
}

export interface Shape {
  layers: number;
  width: number;
  act: 'tanh' | 'relu';
  lr: number;
}

export const specFor = (level: number): Spec =>
  [
    { kind: 'xor', classes: 2, epochs: 40, energy: false, base: { layers: 1, width: 4, act: 'tanh', lr: 0.1 } },
    { kind: 'circles', classes: 2, epochs: 40, energy: false, base: { layers: 1, width: 4, act: 'tanh', lr: 0.1 } },
    { kind: 'checker', classes: 2, epochs: 60, energy: false, base: { layers: 2, width: 8, act: 'tanh', lr: 0.1 } },
    { kind: 'spiral2', classes: 2, epochs: 60, energy: false, base: { layers: 2, width: 8, act: 'tanh', lr: 0.1 } },
    { kind: 'digits', classes: 4, epochs: 30, energy: false, base: { layers: 1, width: 8, act: 'tanh', lr: 0.1 } },
    { kind: 'spiral3', classes: 3, epochs: 60, energy: false, base: { layers: 2, width: 8, act: 'tanh', lr: 0.1 } },
    { kind: 'xor', classes: 2, epochs: 40, energy: true, base: { layers: 2, width: 8, act: 'tanh', lr: 0.1 } },
    { kind: 'circles', classes: 2, epochs: 40, energy: true, base: { layers: 2, width: 8, act: 'tanh', lr: 0.1 } },
    { kind: 'digits', classes: 4, epochs: 30, energy: true, base: { layers: 2, width: 16, act: 'relu', lr: 0.03 } },
    { kind: 'checker', classes: 2, epochs: 60, energy: true, base: { layers: 2, width: 16, act: 'tanh', lr: 0.1 } },
  ][lvl(level) - 1] as Spec;

export interface Split {
  train: Data;
  check: Data;
  test: Data;
}

/** One dataset of the level's kind: 120 points to learn from, 80 to check on while searching, 200 held out for the test. */
export function dataset(level: number, seed: number): Split {
  const sp = specFor(level);
  const r = rng(seed * 2654435761 + lvl(level));
  return { train: sample(sp.kind, 120, r, sp.classes), check: sample(sp.kind, 80, r, sp.classes), test: sample(sp.kind, 200, r, sp.classes) };
}

// ---- tiny networks ------------------------------------------------------------------------------------------

export const LAYERS = [0, 1, 2];
export const WIDTHS = [2, 4, 8, 16];
export const ACTS = ['tanh', 'relu'] as const;
export const RATES = [0.003, 0.03, 0.1, 0.3, 1];

export const sizes = (s: Shape, inputs: number, classes: number) => [inputs, ...new Array(s.layers).fill(s.width), classes];
/** Multiply-adds for one pass through the network (weights only). */
export const macs = (s: Shape, inputs: number, classes: number) => {
  const z = sizes(s, inputs, classes);
  let t = 0;
  for (let i = 1; i < z.length; i++) t += z[i - 1]! * z[i]!;
  return t;
};
/** Energy: multiply-adds to train (forward and backward, about 3 passes' worth, for every point and every pass). */
export const energy = (s: Shape, d: Data, epochs: number) => 3 * macs(s, d.inputs, d.classes) * d.x.length * epochs;

export class Net {
  w: Float64Array[];
  b: Float64Array[];
  z: number[];
  /** Working space: each layer's values, and the error flowing back (made once, reused). */
  private acts: Float64Array[];
  private errs: Float64Array[];
  constructor(
    public s: Shape,
    inputs: number,
    classes: number,
    seed: number,
  ) {
    this.z = sizes(s, inputs, classes);
    const r = rng(seed);
    this.w = [];
    this.b = [];
    for (let i = 1; i < this.z.length; i++) {
      const scale = Math.sqrt((s.act === 'relu' ? 2 : 1) / this.z[i - 1]!);
      this.w.push(Float64Array.from({ length: this.z[i - 1]! * this.z[i]! }, () => (r() * 2 - 1) * scale * 1.7));
      this.b.push(new Float64Array(this.z[i]!));
    }
    this.acts = this.z.map((n) => new Float64Array(n));
    this.errs = this.z.map((n) => new Float64Array(n));
  }
  /** Run a point through; returns the class probabilities (the network's own buffer: read it before the next call). */
  forward(x: Float64Array): Float64Array {
    this.acts[0]!.set(x);
    const last = this.w.length - 1;
    for (let l = 0; l <= last; l++) {
      const a = this.acts[l]!;
      const h = this.acts[l + 1]!;
      const n = this.z[l + 1]!;
      const m = this.z[l]!;
      const W = this.w[l]!;
      const B = this.b[l]!;
      for (let j = 0; j < n; j++) h[j] = B[j]!;
      for (let i = 0; i < m; i++) {
        const ai = a[i]!;
        if (ai === 0) continue;
        const row = i * n;
        for (let j = 0; j < n; j++) h[j]! += ai * W[row + j]!;
      }
      if (l < last) {
        if (this.s.act === 'tanh') for (let j = 0; j < n; j++) h[j] = Math.tanh(h[j]!);
        else for (let j = 0; j < n; j++) if (h[j]! < 0) h[j] = 0;
      } else {
        let mx = -Infinity;
        for (let j = 0; j < n; j++) if (h[j]! > mx) mx = h[j]!;
        let sum = 0;
        for (let j = 0; j < n; j++) sum += h[j] = Math.exp(h[j]! - mx);
        for (let j = 0; j < n; j++) h[j]! /= sum;
      }
    }
    return this.acts[last + 1]!;
  }
  /** One step of gradient descent on one point (cross-entropy). */
  learn(x: Float64Array, y: number) {
    const p = this.forward(x);
    const L = this.w.length;
    const top = this.errs[L]!;
    for (let j = 0; j < p.length; j++) top[j] = p[j]!;
    top[y]! -= 1;
    const lr = this.s.lr;
    for (let l = L - 1; l >= 0; l--) {
      const a = this.acts[l]!;
      const delta = this.errs[l + 1]!;
      const back = this.errs[l]!;
      const n = this.z[l + 1]!;
      const m = this.z[l]!;
      const W = this.w[l]!;
      for (let i = 0; i < m; i++) {
        const row = i * n;
        const ai = a[i]!;
        let t = 0;
        for (let j = 0; j < n; j++) {
          t += W[row + j]! * delta[j]!;
          W[row + j]! -= lr * delta[j]! * ai;
        }
        back[i] = l > 0 ? t * (this.s.act === 'tanh' ? 1 - ai * ai : ai > 0 ? 1 : 0) : 0;
      }
      const B = this.b[l]!;
      for (let j = 0; j < n; j++) B[j]! -= lr * delta[j]!;
    }
  }
  predict(x: Float64Array): number {
    const p = this.forward(x);
    let best = 0;
    for (let j = 1; j < p.length; j++) if (p[j]! > p[best]!) best = j;
    return best;
  }
  accuracy(d: Data): number {
    let ok = 0;
    d.x.forEach((x, i) => this.predict(x) === d.y[i] && ok++);
    return ok / d.x.length;
  }
}

/** Train a network of this shape on a dataset's learning split (seeded: the same every time). */
export function trainNet(s: Shape, d: Split, epochs: number, seed: number): Net {
  const net = new Net(s, d.train.inputs, d.train.classes, seed);
  const r = rng(seed + 1);
  const order = d.train.x.map((_, i) => i);
  for (let e = 0; e < epochs; e++) {
    shuffle(r, order);
    for (const i of order) net.learn(d.train.x[i]!, d.train.y[i]!);
  }
  return net;
}

export const shapeKey = (s: Shape) => (s.layers ? `${s.layers}x${s.width}-${s.act}-${s.lr}` : `0-${s.lr}`);
export const shapeOf = (k: string): Shape => {
  const [a, b, c] = k.split('-');
  if (a === '0') return { layers: 0, width: 2, act: 'tanh', lr: Number(b) };
  const [layers, width] = a!.split('x').map(Number) as [number, number];
  return { layers, width, act: b as 'tanh' | 'relu', lr: Number(c) };
};
export const shapeWords = (s: Shape) => `${s.layers ? `${s.layers} hidden layer${s.layers > 1 ? 's' : ''} of ${s.width} (${s.act})` : 'no hidden layer'}, learning speed ${s.lr}`;

/** Where he starts, knowing nothing: the first choice of each (the smallest network, the slowest learning). */
export const FIRST: Shape = { layers: LAYERS[0]!, width: WIDTHS[0]!, act: ACTS[0], lr: RATES[0]! };

// ---- the yardstick ---------------------------------------------------------------------------------------------

const HELD = 5;
const heldSeeds = (level: number) => Array.from({ length: HELD }, (_, i) => 70000 + i + 100 * lvl(level));
/**
 * The baseline network's test accuracy on each held-out dataset, in percent, one row per level — stored so
 * the phone does not retrain it; `baseline(level, true)` trains it again (the tests check they agree).
 */
const BASE_ACC: number[][] = [
  [980, 970, 995, 835, 995],
  [1000, 975, 970, 960, 995],
  [815, 570, 655, 685, 580],
  [645, 830, 750, 540, 875],
  [865, 830, 815, 765, 800],
  [535, 525, 530, 640, 610],
  [1000, 995, 925, 1000, 1000],
  [1000, 1000, 995, 1000, 1000],
  [890, 865, 780, 860, 895],
  [860, 700, 630, 705, 675],
];
/** The baseline network's test accuracy (0–1) on each held-out dataset. */
export function baseline(level: number, fresh = false): number[] {
  const L = lvl(level);
  const st = BASE_ACC[L - 1];
  if (st && !fresh) return st.map((x) => x / 1000);
  const sp = specFor(L);
  return heldSeeds(L).map((seed) => {
    const d = dataset(L, seed);
    return Math.round(1000 * trainNet(sp.base, d, sp.epochs, seed).accuracy(d.test)) / 1000;
  });
}

/** Does a shape match the baseline on each held-out dataset (accuracy within 2 points; energy within budget)? */
export function grade(level: number, s: Shape) {
  const L = lvl(level);
  const sp = specFor(L);
  const base = baseline(L);
  let ok = 0;
  let acc = 0;
  const ds = heldSeeds(L).map((seed) => dataset(L, seed));
  const within = !sp.energy || energy(s, ds[0]!.train, sp.epochs) <= 0.5 * energy(sp.base, ds[0]!.train, sp.epochs);
  heldSeeds(L).forEach((seed, i) => {
    const a = trainNet(s, ds[i]!, sp.epochs, seed).accuracy(ds[i]!.test);
    acc += a;
    if (within && a >= base[i]! - 0.02) ok++;
  });
  return { ok, of: HELD, acc: acc / HELD, base: base.reduce((t, x) => t + x, 0) / HELD, within };
}

// ---- his search -------------------------------------------------------------------------------------------------

interface Stat {
  n: number;
  sum: number;
}

/** A neighbour of a shape: one setting changed one notch (or a random shape now and then). */
function neighbour(s: Shape, r: () => number): Shape {
  if (r() < 0.15) return { layers: LAYERS[randInt(r, 0, 2)]!, width: WIDTHS[randInt(r, 0, 3)]!, act: ACTS[randInt(r, 0, 1)]!, lr: RATES[randInt(r, 0, 4)]! };
  const n = { ...s };
  const step = <T>(list: readonly T[], v: T) => list[Math.max(0, Math.min(list.length - 1, list.indexOf(v) + (r() < 0.5 ? -1 : 1)))]!;
  const what = randInt(r, 0, 3);
  if (what === 0) n.layers = step(LAYERS, s.layers);
  else if (what === 1) n.width = step(WIDTHS, s.width);
  else if (what === 2) n.act = s.act === 'tanh' ? 'relu' : 'tanh';
  else n.lr = step(RATES, s.lr);
  return n;
}

class BrainEnv implements Env {
  /** Choosing a shape one setting at a time: layers, width, activation, learning speed; then it is trained. */
  pick: number[] = [];
  d: Split = dataset(1, 1);
  constructor(private level: number) {}
  reset(seed: number) {
    this.pick = [];
    this.d = dataset(this.level, seed);
  }
  private lists(): readonly (number | string)[][] {
    return [LAYERS, WIDTHS, ACTS as unknown as string[], RATES];
  }
  actions() {
    return this.lists()[this.pick.length]!.map((_, i) => i);
  }
  step(a: number) {
    this.pick.push(a);
    if (this.pick.length < 4) return { reward: 0, done: false };
    const s: Shape = { layers: LAYERS[this.pick[0]!]!, width: WIDTHS[this.pick[1]!]!, act: ACTS[this.pick[2]!]!, lr: RATES[this.pick[3]!]! };
    const sp = specFor(this.level);
    return { reward: trainNet(s, this.d, sp.epochs, 1).accuracy(this.d.check), done: true };
  }
  describe() {
    const sp = specFor(this.level);
    const names = ['hidden layers (0, 1, 2)', 'width (2, 4, 8, 16)', 'activation (tanh, relu)', 'learning speed (0.003 … 1)'];
    return `Data: ${sp.kind}, ${sp.classes} classes. Choose ${names[this.pick.length] ?? 'nothing more'}; chosen so far: ${this.pick.join(', ') || 'nothing'}.`;
  }
}

interface BrainSave {
  game: 'brain';
  level: number;
  stats: Record<string, [number, number]>;
  best: string;
  nets: number;
  rand: number;
}

class BrainLearner implements Learner {
  stats = new Map<string, Stat>();
  best: Shape = FIRST;
  nets: number;
  rand: number;
  r: () => number;
  constructor(
    private level: number,
    seed: number,
    saved?: unknown,
  ) {
    const s = savedFor<BrainSave>(saved, 'brain');
    this.rand = s?.rand ?? seed;
    this.r = rng(this.rand);
    this.nets = s?.nets ?? 0;
    // A new level is a new kind of data: the scores start again, his last favourite is where he starts looking.
    if (s?.best) this.best = shapeOf(s.best);
    if (s && s.level === level) for (const [k, [n, sum]] of Object.entries(s.stats)) this.stats.set(k, { n, sum });
  }
  /** His score for a shape on a practice dataset: check accuracy (0 when over the energy budget). */
  private score(s: Shape, k: number): number {
    const sp = specFor(this.level);
    const d = dataset(this.level, 1_000_000 + k);
    if (sp.energy && energy(s, d.train, sp.epochs) > 0.5 * energy(sp.base, d.train, sp.epochs)) return 0;
    return trainNet(s, d, sp.epochs, 1_000_000 + k).accuracy(d.check);
  }
  /** The best-scoring shape he has tried at least twice (where he starts, until then). */
  private favourite(): Shape {
    let best: string | null = null;
    let bv = -1;
    for (const [k, st] of this.stats) if (st.n >= 2 && st.sum / st.n > bv + 1e-9) (bv = st.sum / st.n), (best = k);
    return best ? shapeOf(best) : this.best;
  }
  /** Each unit: train one candidate shape on one practice dataset (shapes he likes get tried again on new data). */
  train(n: number) {
    for (let i = 0; i < n; i++) {
      const fav = this.favourite();
      const favStat = this.stats.get(shapeKey(fav));
      const cand = favStat && favStat.n < 4 ? fav : neighbour(fav, this.r);
      const k = shapeKey(cand);
      const st = this.stats.get(k) ?? { n: 0, sum: 0 };
      st.sum += this.score(cand, (this.nets + i) % 8);
      st.n++;
      this.stats.set(k, st);
    }
    this.nets += n;
    this.best = this.favourite();
    this.rand = (this.rand + n * 2654435761) >>> 0;
    return n;
  }
  measure() {
    const g = grade(this.level, this.best);
    const sp = specFor(this.level);
    return {
      mastery: g.ok / g.of,
      detail: `${sp.kind === 'digits' ? `${sp.classes} digits` : sp.kind}: his pick (${shapeWords(this.best)}) scores ${Math.round(g.acc * 100)}% on held-out test data vs the baseline's ${Math.round(g.base * 100)}%; it matches the baseline on ${g.ok} of ${g.of} datasets${sp.energy ? (g.within ? ', within the energy budget' : ' — but it is over the energy budget') : ''}.`,
    };
  }
  save(): BrainSave {
    const stats: Record<string, [number, number]> = {};
    for (const [k, v] of this.stats) stats[k] = [v.n, v.sum];
    return { game: 'brain', level: this.level, stats, best: shapeKey(this.best), nets: this.nets, rand: this.rand };
  }
  view(): Frame {
    const rows = [...this.stats.entries()].filter(([, s]) => s.n >= 2).sort((a, b) => b[1].sum / b[1].n - a[1].sum / a[1].n).slice(0, 6);
    if (!rows.length) return { lines: [`He has not tried anything yet: he would use ${shapeWords(FIRST)}.`], caption: 'The shapes he rates best.' };
    return { bars: rows.map(([k, s]) => [shapeWords(shapeOf(k)), s.sum / s.n, `${Math.round((100 * s.sum) / s.n)}%`] as [string, number, string]), caption: 'The shapes he rates best (average check score).' };
  }
  watch(seed: number): Frame[] {
    const sp = specFor(this.level);
    const d = dataset(this.level, seed);
    const head = `Data: ${sp.kind === 'digits' ? `5×5 pixel digits, ${sp.classes} kinds` : sp.kind}, ${d.train.x.length} points to learn from.`;
    const frames: Frame[] = [{ lines: [head], caption: 'He tries a few shapes he rates, then trains his favourite.' }];
    const lines: string[] = [];
    const tried = [this.best, neighbour(this.best, rng(seed)), neighbour(this.best, rng(seed + 1))];
    for (const s of tried) {
      const net = trainNet(s, d, sp.epochs, seed);
      const e = energy(s, d.train, sp.epochs);
      lines.push(`${shapeWords(s)} → ${Math.round(net.accuracy(d.check) * 100)}% on the check points · ${Math.round(e / 1000).toLocaleString('en-GB')} thousand multiply-adds`);
      frames.push({ lines: [head, ...lines], caption: 'Trying a shape' });
    }
    const net = trainNet(this.best, d, sp.epochs, seed);
    const base = trainNet(sp.base, d, sp.epochs, seed);
    const fin = `His pick: ${Math.round(net.accuracy(d.test) * 100)}% on the held-out test points; the baseline (${shapeWords(sp.base)}) ${Math.round(base.accuracy(d.test) * 100)}%.`;
    const f: Frame = { lines: [head, ...lines, fin], caption: sp.kind === 'digits' ? 'Done.' : 'Done. The picture: what his network answers across the square.' };
    if (sp.kind !== 'digits') {
      const W = 14;
      const colours = ['hsl(195 80% 40%)', 'hsl(30 85% 45%)', 'hsl(140 60% 38%)'];
      const cells = [];
      for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) cells.push({ c: colours[net.predict(Float64Array.of(((i + 0.5) / W) * 2 - 1, 1 - ((j + 0.5) / W) * 2))]! });
      f.grid = { w: W, h: W, cells };
    }
    frames.push(f);
    return frames;
  }
}

// ---- problems: counting a network's multiply-adds, and working one through by hand ------------------------------

function generate(level: number, seed: number): Problem {
  const L = lvl(level);
  const r = rng(seed * 977 + L);
  if (L <= 3) {
    const z = [randInt(r, 2, 6), ...Array.from({ length: L }, () => randInt(r, 2, 12)), randInt(r, 2, 5)];
    const withBias = L >= 2;
    let w = 0;
    for (let i = 1; i < z.length; i++) w += z[i - 1]! * z[i]! + (withBias ? z[i]! : 0);
    const text = `A small neural network has ${z[0]} inputs, ${z.length - 2 === 1 ? 'one hidden layer' : `${z.length - 2} hidden layers`} of ${z.slice(1, -1).join(' and ')} units, and ${z[z.length - 1]} outputs. Every unit is connected to every unit of the next layer${withBias ? ', and every hidden and output unit also has one bias' : ''}. How many ${withBias ? 'numbers (weights plus biases)' : 'weights'} does it have? Answer with one number.`;
    return { game: 'brain', level: L, seed, text, data: { kind: 'count', answer: w } };
  }
  // A forward pass with small whole-number weights: hidden units use ReLU (negative becomes 0); outputs are plain sums.
  const nIn = L <= 6 ? 2 : 3;
  const hidden = L <= 5 ? [2] : L <= 8 ? [3] : [3, 2];
  const nOut = L <= 6 ? 2 : 3;
  const z = [nIn, ...hidden, nOut];
  const x = Array.from({ length: nIn }, () => randInt(r, -3, 3));
  const W = z.slice(1).map((n, l) => Array.from({ length: n }, () => Array.from({ length: z[l]! }, () => randInt(r, -2, 2))));
  const B = z.slice(1).map((n) => Array.from({ length: n }, () => randInt(r, -1, 1)));
  let a = x;
  for (let l = 0; l < W.length; l++) {
    const out = W[l]!.map((row, j) => row.reduce((t, w, i) => t + w * a[i]!, B[l]![j]!));
    a = l < W.length - 1 ? out.map((v) => Math.max(0, v)) : out;
  }
  const layerText = W.map((rows, l) => {
    const name = l < W.length - 1 ? `hidden layer ${l + 1}` : 'the output layer';
    return `In ${name}: ${rows.map((row, j) => `unit ${j + 1} = ${row.map((w, i) => `${w < 0 ? `(${w})` : w} × ${l === 0 ? `x${i + 1}` : `h${l}.${i + 1}`}`).join(' + ')} + (${B[l]![j]})`).join('; ')}.`;
  });
  const text = [
    `Work this tiny network through by hand. Inputs: ${x.map((v, i) => `x${i + 1} = ${v}`).join(', ')}.`,
    ...layerText,
    `Hidden units use ReLU: a negative sum becomes 0 (call hidden layer k's units hk.1, hk.2, …). Output units keep their sum as it is.`,
    `What are the ${nOut} output values, in order? Answer like: 3, -2, 5`,
  ].join('\n');
  return { game: 'brain', level: L, seed, text, data: { kind: 'forward', answer: a } };
}

function check(prob: Problem, answer: string): Verdict {
  const d = prob.data as { kind: 'count' | 'forward'; answer: number | number[] };
  const raw = finalLine(answer).replace(/[−–]/g, '-');
  // ("1,234" is one number when counting; a list of outputs is split at its commas.)
  const line = d.kind === 'count' ? raw.replace(/(\d),(?=\d{3}\b)/g, '$1') : raw;
  const nums = (line.match(/-?\d+/g) ?? []).map(Number);
  if (d.kind === 'count') {
    const v = nums[nums.length - 1];
    if (v == null) return { correct: false, score: 0, why: 'No number found.' };
    const want = d.answer as number;
    return v === want ? { correct: true, score: 1, why: `${want} — right.` } : { correct: false, score: Math.max(0, 1 - Math.abs(v - want) / want), why: `It has ${want}.` };
  }
  const want = d.answer as number[];
  const got = nums.slice(-want.length);
  if (got.length < want.length) return { correct: false, score: 0, why: `Give ${want.length} numbers.` };
  const right = got.filter((v, i) => v === want[i]).length;
  return right === want.length ? { correct: true, score: 1, why: `${want.join(', ')} — right.` } : { correct: false, score: (0.5 * right) / want.length, why: `The outputs are ${want.join(', ')}.` };
}

export const brain: Game = {
  ...BRAIN,
  env: (level) => new BrainEnv(level),
  generate,
  check,
  learner: (level, seed, saved) => new BrainLearner(level, seed, saved),
};
