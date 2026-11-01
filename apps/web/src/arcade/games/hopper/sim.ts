/**
 * THE HOPPER's rules, with no screen: rows laid out ahead from a seed — grass with trees and rocks, roads with cars and
 * lorries, rivers with logs or lily pads, railways with a train and its warning light — never an impossible row: every
 * road leaves gaps a hopper fits through, every river brings a log in time or has a pad to stand on, every train
 * leaves a window, and grass always leaves a way on. He hops a row at a time (forward, back, left, right); a log
 * carries him; a hit, the water or the edge ends the run; so does the fog that rolls in behind and never stops
 * coming, slowly at first. The score is the rows crossed; coins are picked up on the way. Every moving thing's place
 * is a function of the clock, so the rules are exact whatever the screen's rate, and Ghosty can practise on his own.
 */

export const COLS = 4;
/** Moving things go round across −SPAN…SPAN (the screen shows about ±5). */
export const SPAN = 10;
export const HOP_T = 0.14;
export const STEP = 1 / 120;
/** The narrowest gap between two vehicles (cells): a hopper fits in it with time to spare. */
export const GAP_MIN = 2.6;
/** The widest gap between two logs (cells): the next log always comes in time. */
export const LOG_GAP_MAX = 4.6;
/** A train's warning light comes on this long before it arrives (s); a train leaves this long a window at least. */
export const WARN = 1.6;
export const TRAIN_WINDOW = 2.5;
/** The fog: how far behind his furthest row it waits (rows), its pace (rows a second) at the start, its top pace. */
export const FOG_LEASH = 3.2;
export const FOG_PACE = 0.45;
export const FOG_TOP = 0.7;
export const MOVES = ['none', 'up', 'left', 'right', 'down'] as const;
export type Move = (typeof MOVES)[number];
export type RowKind = 'grass' | 'road' | 'river' | 'rail';
export type Death = 'car' | 'lorry' | 'train' | 'water' | 'edge' | 'fog';
export type Face = 'up' | 'down' | 'left' | 'right';

export interface Mover {
  /** Its centre at t = 0. */
  x0: number;
  len: number;
  kind: 'car' | 'lorry' | 'log';
  /** A colour index (cars and lorries). */
  c: number;
}
export interface Train {
  period: number;
  phase: number;
  len: number;
  speed: number;
}
export interface Row {
  r: number;
  kind: RowKind;
  /** Grass: the columns with a tree or a rock, as a set of column numbers (−SPAN…SPAN). */
  block: number[];
  dir: number;
  /** Cells a second. */
  speed: number;
  movers: Mover[];
  /** A river of lily pads: their columns (no logs). */
  pads: number[];
  train: Train | null;
  coin: number | null;
  /** The columns one can stand on and reach, coming into this row (for the generator's own check). */
  reach: number[];
  deco: number;
}
export type HopEvent =
  | { type: 'hop'; face: Face }
  | { type: 'bonk' }
  | { type: 'land'; kind: RowKind; log: boolean }
  | { type: 'row'; r: number }
  | { type: 'coin'; r: number; x: number }
  | { type: 'die'; how: Death };

export interface Hopper {
  x: number;
  r: number;
  fromX: number;
  fromR: number;
  toX: number;
  hopT: number;
  face: Face;
  onLog: boolean;
  alive: boolean;
  death: Death | null;
  deadT: number;
}
export interface Run {
  seed: number;
  rnd: () => number;
  rows: Map<number, Row>;
  /** The furthest row laid out so far. */
  laid: number;
  /** The generator's state: what group of rows it is in, how many are left, the last row's reach. */
  group: RowKind;
  left: number;
  lastDir: number;
  t: number;
  best: number;
  coins: number;
  fog: number;
  p: Hopper;
  queued: Move | null;
  events: HopEvent[];
  taken: Set<number>;
}

export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const ALL = Array.from({ length: COLS * 2 + 1 }, (_, i) => i - COLS);
/** A position on the loop moving things go round. */
export const wrap = (x: number) => (((x + SPAN) % (2 * SPAN)) + 2 * SPAN) % (2 * SPAN) - SPAN;
/** How hard the rows are this far on (0…1). */
export const hardness = (r: number) => clamp(r / 260, 0, 1);

/** Where a moving thing is at time t. */
export const moverX = (row: Row, m: Mover, t: number) => wrap(m.x0 + row.dir * row.speed * t);
/** The train on a railway at time t: its front and back (null when it is not on the row), and whether the light is on. */
export function trainAt(row: Row, t: number): { a: number; b: number; light: boolean } | null {
  const tr = row.train;
  if (!tr) return null;
  const tau = (((t + tr.phase) % tr.period) + tr.period) % tr.period;
  const pass = (2 * SPAN + tr.len) / tr.speed;
  const light = tau > tr.period - WARN || tau < pass;
  if (tau >= pass) return { a: 99, b: 99, light };
  const head = -row.dir * SPAN + row.dir * tr.speed * tau;
  const tail = head - row.dir * tr.len;
  return { a: Math.min(head, tail), b: Math.max(head, tail), light };
}

// ---------------------------------------------------------------- laying rows out

function grassRow(run: Run, r: number, reachIn: number[], safe: boolean): Row {
  const d = hardness(r);
  const block: number[] = [];
  for (let c = -SPAN; c <= SPAN; c++) {
    if (Math.abs(c) > COLS) {
      if (run.rnd() < 0.55) block.push(c);
    } else if (!safe && run.rnd() < 0.16 + 0.1 * d) block.push(c);
  }
  // never cut every way on: from where he can come in, a free column must lead on
  let reach = spread(reachIn.filter((c) => !block.includes(c)), block);
  if (!reach.length) {
    const c = reachIn[Math.floor(run.rnd() * reachIn.length)] ?? 0;
    block.splice(block.indexOf(c), 1);
    reach = spread([c], block);
  }
  return { r, kind: 'grass', block, dir: 1, speed: 0, movers: [], pads: [], train: null, coin: null, reach, deco: Math.floor(run.rnd() * 1e6) };
}
/** Columns reached from `from` by walking sideways along a grass row (between its trees). */
function spread(from: number[], block: number[]): number[] {
  const out = new Set<number>();
  for (const c0 of from) {
    for (const s of [-1, 1]) {
      for (let c = c0; Math.abs(c) <= COLS && !block.includes(c); c += s) out.add(c);
    }
  }
  return [...out].sort((a, b) => a - b);
}

function roadRow(run: Run, r: number): Row {
  const d = hardness(r);
  const dir = -run.lastDir || 1;
  run.lastDir = dir;
  const speed = 1.5 + run.rnd() * 1.3 + d * 2.1;
  const movers: Mover[] = [];
  let x = -SPAN + run.rnd() * 2;
  const lorries = 0.18 + 0.3 * d;
  for (;;) {
    const kind = run.rnd() < lorries ? 'lorry' : 'car';
    const len = kind === 'lorry' ? 2.7 : 1.5;
    if (x + len > SPAN - 0.01) break;
    movers.push({ x0: x + len / 2, len, kind, c: Math.floor(run.rnd() * 8) });
    x += len + GAP_MIN + run.rnd() * (5.2 - 2.4 * d);
  }
  // the gap that wraps round must be wide enough too
  while (movers.length > 1) {
    const first = movers[0]!, last = movers[movers.length - 1]!;
    const wrapGap = 2 * SPAN - (last.x0 + last.len / 2 - (first.x0 - first.len / 2));
    if (wrapGap >= GAP_MIN) break;
    movers.pop();
  }
  return { r, kind: 'road', block: [], dir, speed, movers, pads: [], train: null, coin: null, reach: ALL, deco: 0 };
}

function riverRow(run: Run, r: number, reachIn: number[], prevPads: boolean): Row {
  const d = hardness(r);
  const dir = -run.lastDir || 1;
  run.lastDir = dir;
  if (!prevPads && run.rnd() < 0.24 - 0.1 * d) {
    // lily pads: still, two to four of them, one at least where he can hop on
    const pads = new Set<number>([reachIn[Math.floor(run.rnd() * reachIn.length)] ?? 0]);
    const n = 2 + Math.floor(run.rnd() * 3);
    while (pads.size < n) pads.add(Math.floor(run.rnd() * (COLS * 2 + 1)) - COLS);
    const list = [...pads].sort((a, b) => a - b);
    const onto = list.filter((c) => reachIn.includes(c));
    return { r, kind: 'river', block: [], dir, speed: 0, movers: [], pads: list, train: null, coin: null, reach: spreadPads(onto, list), deco: 0 };
  }
  const speed = 0.9 + run.rnd() * 0.9 + d * 1.1;
  const movers: Mover[] = [];
  let x = -SPAN + run.rnd() * 1.5;
  for (;;) {
    const len = 2 + run.rnd() * (2.2 - 0.8 * d);
    if (x + len > SPAN - 0.01) break;
    movers.push({ x0: x + len / 2, len, kind: 'log', c: 0 });
    x += len + 1.1 + run.rnd() * (LOG_GAP_MAX - 1.1 - 0.4);
  }
  // the wrapping gap: no wider than the rest (a log in the middle of it closes it)
  const first = movers[0]!, last = movers[movers.length - 1]!;
  const wrapGap = first.x0 - first.len / 2 + 2 * SPAN - (last.x0 + last.len / 2);
  if (wrapGap > LOG_GAP_MAX) movers.push({ x0: wrap(last.x0 + last.len / 2 + wrapGap / 2), len: Math.min(2.2, wrapGap - 2.2), kind: 'log', c: 0 });
  return { r, kind: 'river', block: [], dir, speed, movers, pads: [], train: null, coin: null, reach: ALL, deco: 0 };
}
const spreadPads = (from: number[], pads: number[]) => {
  const out = new Set<number>();
  for (const c0 of from) for (const s of [-1, 1]) for (let c = c0; pads.includes(c); c += s) out.add(c);
  return [...out].sort((a, b) => a - b);
};

function railRow(run: Run, r: number): Row {
  const d = hardness(r);
  const speed = 24;
  const len = 9 + Math.floor(run.rnd() * 4) * 2.5;
  const pass = (2 * SPAN + len) / speed;
  const period = pass + TRAIN_WINDOW + WARN + run.rnd() * (4 - 1.6 * d);
  const dir = run.rnd() < 0.5 ? 1 : -1;
  return { r, kind: 'rail', block: [], dir, speed, movers: [], pads: [], train: { period, phase: run.rnd() * period, len, speed }, coin: null, reach: ALL, deco: 0 };
}

/** Lays rows out up to `upto`. */
export function layOut(run: Run, upto: number): void {
  while (run.laid < upto) {
    const r = ++run.laid;
    const prev = run.rows.get(r - 1);
    const reachIn = prev ? prev.reach : ALL;
    let row: Row;
    if (r <= 3) row = grassRow(run, r, reachIn, true);
    else {
      if (run.left <= 0) {
        const d = hardness(r);
        const after = run.group;
        if (after !== 'grass' && run.rnd() < 0.62 - 0.2 * d) (run.group = 'grass'), (run.left = 1 + Math.floor(run.rnd() * 2));
        else {
          const x = run.rnd();
          run.group = x < 0.46 ? 'road' : x < 0.76 ? 'river' : x < 0.9 ? 'rail' : 'grass';
          if (run.group === after && after !== 'grass') run.group = 'grass';
          run.left = run.group === 'road' ? 1 + Math.floor(run.rnd() * (2 + 3 * d)) : run.group === 'river' ? 1 + Math.floor(run.rnd() * (2 + 2 * d)) : run.group === 'rail' ? 1 + Math.floor(run.rnd() * 2) : 1 + Math.floor(run.rnd() * 3);
        }
      }
      run.left--;
      row =
        run.group === 'road' ? roadRow(run, r)
        : run.group === 'river' ? riverRow(run, r, reachIn, !!prev && prev.kind === 'river' && prev.pads.length > 0)
        : run.group === 'rail' ? railRow(run, r)
        : grassRow(run, r, reachIn, false);
    }
    // a coin now and then, where a hopper can stand
    if (r > 3 && row.kind !== 'river' && run.rnd() < 0.13) {
      const free = ALL.filter((c) => !row.block.includes(c));
      row.coin = free[Math.floor(run.rnd() * free.length)] ?? null;
    }
    run.rows.set(r, row);
    run.rows.delete(r - 60);
  }
}

/** The row at r (behind the start: grass and trees). */
export function rowAt(run: Run, r: number): Row {
  if (r > run.laid) layOut(run, r + 4);
  const row = run.rows.get(r);
  if (row) return row;
  const block: number[] = [];
  for (let c = -SPAN; c <= SPAN; c++) if (Math.abs(c) > COLS || (r < -1 && ((c * 7 + r * 13) & 3) === 0)) block.push(c);
  return { r, kind: 'grass', block, dir: 1, speed: 0, movers: [], pads: [], train: null, coin: null, reach: ALL, deco: r * 977 };
}

export function newRun(seed: number): Run {
  const run: Run = {
    seed, rnd: rng(seed), rows: new Map(), laid: -1, group: 'grass', left: 0, lastDir: 1, t: 0, best: 0, coins: 0, fog: -FOG_LEASH, queued: null, events: [], taken: new Set(),
    p: { x: 0, r: 0, fromX: 0, fromR: 0, toX: 0, hopT: 0, face: 'up', onLog: false, alive: true, death: null, deadT: 0 },
  };
  layOut(run, 30);
  return run;
}

// ---------------------------------------------------------------- what is where

/** The log under x on a river row at time t (null: water). */
export function logAt(row: Row, x: number, t: number): Mover | null {
  for (const m of row.movers) {
    const c = moverX(row, m, t);
    if (Math.abs(c - x) <= m.len / 2 + 0.05) return m;
  }
  return null;
}
/** What would hit a hopper at x on this row at time t (null: nothing). */
export function hitAt(row: Row, x: number, t: number): Death | null {
  if (row.kind === 'road') {
    for (const m of row.movers) if (Math.abs(moverX(row, m, t) - x) < m.len / 2 + 0.3) return m.kind === 'lorry' ? 'lorry' : 'car';
  } else if (row.kind === 'rail') {
    const tr = trainAt(row, t);
    if (tr && x > tr.a - 0.3 && x < tr.b + 0.3) return 'train';
  }
  return null;
}
/** The fog's pace (rows a second) once he has got this far. */
export const fogPace = (best: number) => Math.min(FOG_TOP, FOG_PACE + 0.0025 * best);

// ---------------------------------------------------------------- moving

const emit = (run: Run, e: HopEvent) => {
  run.events.push(e);
  if (run.events.length > 200) run.events.splice(0, run.events.length - 200);
};

function die(run: Run, how: Death): void {
  const p = run.p;
  if (!p.alive) return;
  p.alive = false;
  p.death = how;
  p.deadT = 0;
  p.hopT = 0;
  emit(run, { type: 'die', how });
}

function tryHop(run: Run, m: Move): void {
  const p = run.p;
  if (m === 'none' || !p.alive) return;
  const face: Face = m;
  const tr = m === 'up' ? p.r + 1 : m === 'down' ? p.r - 1 : p.r;
  let tx = m === 'left' ? p.x - 1 : m === 'right' ? p.x + 1 : p.x;
  const target = rowAt(run, tr);
  if (target.kind !== 'river') tx = Math.round(tx);
  p.face = face;
  if (Math.abs(Math.round(tx)) > COLS || (target.kind === 'grass' && target.block.includes(Math.round(tx)))) {
    emit(run, { type: 'bonk' });
    return;
  }
  p.fromX = p.x;
  p.fromR = p.r;
  p.toX = tx;
  p.r = tr;
  p.hopT = HOP_T;
  p.onLog = false;
  emit(run, { type: 'hop', face });
}

function land(run: Run): void {
  const p = run.p;
  p.x = p.toX;
  const row = rowAt(run, p.r);
  if (row.kind === 'river') {
    if (row.pads.length) {
      const c = Math.round(p.x);
      if (row.pads.includes(c)) p.x = c;
      else return die(run, 'water');
    } else if (logAt(row, p.x, run.t)) p.onLog = true;
    else return die(run, 'water');
  } else p.x = Math.round(p.x);
  emit(run, { type: 'land', kind: row.kind, log: p.onLog });
  if (p.r > run.best) {
    run.best = p.r;
    emit(run, { type: 'row', r: p.r });
  }
  const key = p.r * 100 + Math.round(p.x);
  if (row.coin !== null && row.coin === Math.round(p.x) && !run.taken.has(key)) {
    run.taken.add(key);
    run.coins++;
    emit(run, { type: 'coin', r: p.r, x: row.coin });
  }
}

/** Where he is drawn (the hop's arc between its ends), and the row that can hit him now. */
export function hopperAt(run: Run): { x: number; z: number; y: number; row: number } {
  const p = run.p;
  if (p.hopT > 0) {
    const f = 1 - p.hopT / HOP_T;
    return { x: p.fromX + (p.toX - p.fromX) * f, z: p.fromR + (p.r - p.fromR) * f, y: Math.sin(f * Math.PI) * 0.5, row: f < 0.5 ? p.fromR : p.r };
  }
  return { x: p.x, z: p.r, y: 0, row: p.r };
}

/** One step: a move (or the one waiting), the hop, the log, the hits, the fog. */
export function step(run: Run, move: Move, dt = STEP): void {
  const p = run.p;
  run.t += dt;
  if (!p.alive) {
    p.deadT += dt;
    return;
  }
  if (move !== 'none') {
    if (p.hopT > 0) run.queued = move;
    else tryHop(run, move);
  } else if (p.hopT <= 0 && run.queued) {
    const q = run.queued;
    run.queued = null;
    tryHop(run, q);
  }
  if (p.hopT > 0) {
    p.hopT -= dt;
    if (p.hopT <= 0) {
      p.hopT = 0;
      land(run);
      if (!p.alive) return;
    }
  }
  if (p.hopT <= 0 && p.onLog) {
    const row = rowAt(run, p.r);
    p.x += row.dir * row.speed * dt;
    if (Math.abs(p.x) > COLS + 0.6) return die(run, 'edge');
  }
  const at = hopperAt(run);
  const hit = hitAt(rowAt(run, at.row), at.x, run.t);
  if (hit) return die(run, hit);
  run.fog = Math.max(run.fog + fogPace(run.best) * dt, run.best - FOG_LEASH);
  if (run.fog >= p.r) die(run, 'fog');
  layOut(run, p.r + 30);
}

// ---------------------------------------------------------------- checks the tests (and Ghosty) use

/** The gaps between a row's moving things, all the way round (cells). */
export function gaps(row: Row): number[] {
  const ms = [...row.movers].sort((a, b) => wrap(a.x0) - wrap(b.x0));
  return ms.map((m, i) => {
    const n = ms[(i + 1) % ms.length]!;
    return wrap(n.x0) - n.len / 2 - (wrap(m.x0) + m.len / 2) + (i === ms.length - 1 ? 2 * SPAN : 0);
  });
}

/** What is wrong with a row (nothing: a hopper can always get across it). */
export function rowProblems(row: Row): string[] {
  const out: string[] = [];
  if (row.kind === 'road') {
    if (!row.movers.length) out.push(`row ${row.r}: a road with nothing on it`);
    for (const g of gaps(row)) if (g < GAP_MIN - 1e-6) out.push(`row ${row.r}: a gap of ${g.toFixed(2)} cells between vehicles`);
  } else if (row.kind === 'river') {
    if (row.pads.length) {
      if (!row.reach.length) out.push(`row ${row.r}: no pad he can hop onto`);
    } else {
      if (!row.movers.length) out.push(`row ${row.r}: a river with no logs`);
      for (const g of gaps(row)) if (g > LOG_GAP_MAX + 1e-6 || g < 0) out.push(`row ${row.r}: a gap of ${g.toFixed(2)} cells between logs`);
    }
  } else if (row.kind === 'rail') {
    const tr = row.train!;
    if (tr.period - (2 * SPAN + tr.len) / tr.speed - WARN < TRAIN_WINDOW - 1e-6) out.push(`row ${row.r}: the train leaves no window`);
  } else if (!row.reach.length) out.push(`row ${row.r}: the trees close every way on`);
  return out;
}

/** Is (row, x) safe from t0 to t1 (a log under him, nothing coming)? */
export function safeFor(run: Run, r: number, x: number, t0: number, t1: number): boolean {
  const row = rowAt(run, r);
  if (row.kind === 'grass') return !row.block.includes(Math.round(x)) && Math.abs(Math.round(x)) <= COLS;
  if (row.kind === 'river' && row.pads.length) return row.pads.includes(Math.round(x));
  for (let t = t0; t <= t1 + 1e-9; t += 0.04) {
    if (row.kind === 'river') {
      const dx = row.dir * row.speed * (t - t0);
      if (!logAt(row, x + dx, t) || Math.abs(x + dx) > COLS + 0.3) return false;
    } else if (hitAt(row, x, t) || (row.kind === 'rail' && trainAt(row, t)?.light)) return false;
  }
  return true;
}

/** Ghosty's own way of hopping (code, no model): forward when the next row is safe to land on and stay a moment;
 *  round a tree or to a pad along the row; else wait where he is if that is safe; else step aside, else back. The
 *  nearer the fog, the less he waits. */
export function ghostyMove(run: Run): Move {
  const p = run.p;
  if (!p.alive || p.hopT > 0) return 'none';
  const t = run.t, here = rowAt(run, p.r), next = rowAt(run, p.r + 1);
  const hurry = p.r - run.fog < 1.6;
  const landX = (m: Move) => {
    const tr = m === 'up' ? p.r + 1 : m === 'down' ? p.r - 1 : p.r;
    let x = m === 'left' ? p.x - 1 : m === 'right' ? p.x + 1 : p.x;
    if (rowAt(run, tr).kind !== 'river') x = Math.round(x);
    return { tr, x };
  };
  const enter = (row: Row, c: number) => (row.kind === 'grass' ? !row.block.includes(c) : row.kind === 'river' && row.pads.length ? row.pads.includes(c) : true);
  // a still row (grass, pads) is only worth hopping onto where a way on is in reach along it
  const leadsOn = (r: number, c: number) => {
    const row = rowAt(run, r);
    if (row.kind !== 'grass' && !(row.kind === 'river' && row.pads.length)) return true;
    const nx = rowAt(run, r + 1);
    for (const sd of [-1, 1]) for (let c2 = c; Math.abs(c2) <= COLS && enter(row, c2); c2 += sd) if (enter(nx, c2)) return true;
    return false;
  };
  const ok = (m: Move, stay: number) => {
    const { tr, x } = landX(m);
    if (Math.abs(Math.round(x)) > COLS || tr <= run.fog + 0.8) return false;
    if (m === 'up' && !leadsOn(tr, Math.round(x))) return false;
    return safeFor(run, tr, x, t + HOP_T * 0.5, t + HOP_T + stay);
  };
  if (ok('up', hurry ? 0.12 : 0.32)) return 'up';
  // something still ahead (a tree, a pad elsewhere): go along this row towards a column that leads on
  const staticAhead = next.kind === 'grass' || (next.kind === 'river' && next.pads.length > 0);
  const solidHere = here.kind === 'grass' || here.kind === 'road' || here.kind === 'rail' || (here.kind === 'river' && here.pads.length > 0);
  if (staticAhead && solidHere) {
    const open = (c: number) => enter(next, c) && leadsOn(p.r + 1, c);
    const x = Math.round(p.x);
    if (!open(x)) {
      // along this row as far as it goes each way (trees and pads end it), the nearest column that leads on
      const walk = (c: number) => (here.kind === 'grass' ? !here.block.includes(c) : here.kind === 'river' ? here.pads.includes(c) : true);
      let lo = x, hi = x;
      while (lo - 1 >= -COLS && walk(lo - 1)) lo--;
      while (hi + 1 <= COLS && walk(hi + 1)) hi++;
      let best: number | null = null;
      for (let c = lo; c <= hi; c++) if (open(c) && (best === null || Math.abs(c - x) < Math.abs(best - x))) best = c;
      if (best !== null) {
        const m: Move = best < x ? 'left' : 'right';
        if (ok(m, 0.25) || (here.kind === 'grass' && !here.block.includes(x + (best < x ? -1 : 1)))) return m;
      } else if (ok('down', 0.3)) return 'down';
    }
  }
  const stayOk = here.kind === 'grass' || (here.kind === 'river' && here.pads.length > 0) ? true : safeFor(run, p.r, p.x, t, t + 0.3);
  if (stayOk && !hurry && !(p.onLog && Math.abs(p.x) > COLS - 1)) return 'none';
  const sides: Move[] = p.onLog && p.x > 0 ? ['left', 'right'] : ['right', 'left'];
  for (const m of sides) if (ok(m, 0.3)) return m;
  if (hurry && ok('up', 0)) return 'up';
  if (!stayOk && ok('down', 0.3)) return 'down';
  return 'none';
}

/** Ghosty plays a run on his own for up to `seconds`: the rows he crossed. */
export function ghostyPractice(seed: number, seconds = 75): number {
  const run = newRun(seed);
  let think = 0;
  while (run.p.alive && run.t < seconds) {
    let m: Move = 'none';
    if ((think -= STEP) <= 0) {
      m = ghostyMove(run);
      think = 0.06;
    }
    step(run, m);
    run.events.length = 0;
  }
  return run.best;
}

/** The hopper's moves from a controller's d-pad and stick (on their edges), A forward and B back. */
export interface PadState {
  mx: number;
  my: number;
  held: Set<string>;
}
export function padMoves(prev: PadState, intent: { moveX: number; moveY: number; held: ReadonlySet<string> }): Move[] {
  const out: Move[] = [];
  const mx = intent.moveX > 0.5 ? 1 : intent.moveX < -0.5 ? -1 : 0;
  const my = intent.moveY > 0.5 ? 1 : intent.moveY < -0.5 ? -1 : 0;
  if (mx !== prev.mx && mx) out.push(mx < 0 ? 'left' : 'right');
  if (my !== prev.my && my) out.push(my > 0 ? 'up' : 'down');
  if (intent.held.has('jump') && !prev.held.has('jump')) out.push('up');
  if (intent.held.has('use') && !prev.held.has('use')) out.push('down');
  prev.mx = mx;
  prev.my = my;
  prev.held = new Set(intent.held);
  return out;
}
