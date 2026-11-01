/**
 * THE ARENA's rules, with no screen: you steer a cell on a square arena with twelve of Ghosty's bots; pellets make a
 * cell grow, a cell eats a smaller one it covers once it is bigger by EAT_RATIO, a cell splits in two (the half flung
 * ahead) and may not merge again until its timer runs out, and ejects a little of itself; spiky viruses pop a cell big
 * enough to cover them into pieces, and grow (then split) when fed. Bigger is slower. The bots have names of our own
 * and three temperaments — greedy, cautious, hunter — whose numbers (TEMPERS) the GYM may tune; they respawn when
 * eaten. A round is three minutes or until you are eaten. As a Learnable (arenaLearnable): it sees the nearest pellets,
 * the cells round it with their sizes and headings, and its own size; it does a heading, a split or an eject a tick;
 * its score is mass times seconds.
 */
import type { Learnable } from '../../learnable';

export const SIZE = 110;
export const PELLETS = 420;
export const BOTS = 12;
export const START_MASS = 18;
/** A cell eats another when it is this many times its mass and covers it (centres closer than rA − EAT_OVERLAP·rB). */
export const EAT_RATIO = 1.25;
export const EAT_OVERLAP = 0.4;
export const SPLIT_MIN = 36;
export const SPLIT_SPEED = 70;
export const EJECT_MIN = 32;
export const EJECT_COST = 14;
export const EJECT_MASS = 11;
export const MAX_CELLS = 8;
/** Seconds before split cells may merge again: a base and a little more for a heavier cell. */
export const MERGE_BASE = 8;
export const MERGE_PER_MASS = 0.012;
export const VIRUS_MASS = 100;
export const VIRUSES = 9;
export const VIRUS_FEEDS = 6;
export const ROUND = 180;
export const STEP = 1 / 60;
export const radius = (m: number) => 0.62 * Math.sqrt(m);
export const speedFor = (m: number) => 30 * Math.pow(m, -0.22);
export const mergeTime = (m: number) => MERGE_BASE + MERGE_PER_MASS * m;

export type TemperName = 'greedy' | 'cautious' | 'hunter';
/** A temperament's numbers: how much it wants pellets and prey, how much it fears bigger cells and from how far
 *  (radii), how readily it splits on prey (0…1), how much it wanders, and how much it keeps off viruses once big. */
export interface Temper {
  pellet: number;
  prey: number;
  threat: number;
  flee: number;
  split: number;
  wander: number;
  virus: number;
}
export const TEMPERS: Record<TemperName, Temper> = {
  greedy: { pellet: 1.6, prey: 1, threat: 0.4, flee: 1.8, split: 0.3, wander: 0.35, virus: 1 },
  cautious: { pellet: 1, prey: 0.4, threat: 1.8, flee: 5, split: 0, wander: 0.12, virus: 1.6 },
  hunter: { pellet: 0.4, prey: 2.4, threat: 0.75, flee: 3, split: 0.85, wander: 0.15, virus: 1 },
};
/** Ghosty's bots, with names of our own and their temperaments. */
export const BOT_NAMES: [string, TemperName][] = [
  ['Mochi', 'greedy'], ['Blip', 'cautious'], ['Zest', 'hunter'], ['Nimbus', 'greedy'], ['Fig', 'cautious'], ['Quill', 'hunter'],
  ['Juno', 'greedy'], ['Sprout', 'cautious'], ['Tango', 'hunter'], ['Oko', 'greedy'], ['Brisk', 'hunter'], ['Pip', 'cautious'],
];
export const COLOURS = [0xff7a59, 0x6ae0ff, 0xffd166, 0xb388ff, 0x7dff9a, 0xff6ad5, 0x5ad1c6, 0xffa94d, 0x8ab4ff, 0xf7f06d, 0xff8fa3, 0x9df5c3, 0xc3a6ff];

export interface Cell {
  id: number;
  owner: number;
  x: number;
  z: number;
  m: number;
  /** A fling (a split, a pop) that dies away. */
  vx: number;
  vz: number;
  /** Seconds until it may merge with its own again. */
  merge: number;
}
export interface Player {
  i: number;
  name: string;
  colour: number;
  temper: TemperName | 'you';
  cells: Cell[];
  /** Where it heads (a unit vector) and how hard (0…1). */
  hx: number;
  hz: number;
  push: number;
  alive: boolean;
  /** Seconds until a bot comes back after being eaten. */
  back: number;
  peak: number;
  /** Mass times seconds this round. */
  massTime: number;
  eatenBy: number | null;
  think: number;
  wanderA: number;
}
export interface Blob {
  x: number;
  z: number;
  m: number;
  vx: number;
  vz: number;
  owner: number;
  age: number;
}
export interface Virus {
  x: number;
  z: number;
  m: number;
  vx: number;
  vz: number;
  feeds: number;
  /** Seconds until a popped one grows back (0: here). */
  back: number;
}
export type ArenaEvent =
  | { type: 'pellet'; owner: number; x: number; z: number; c: number }
  | { type: 'eat'; eater: number; eaten: number; m: number; x: number; z: number; whole: boolean }
  | { type: 'split'; owner: number }
  | { type: 'eject'; owner: number }
  | { type: 'merge'; owner: number }
  | { type: 'pop'; owner: number; x: number; z: number }
  | { type: 'feed'; x: number; z: number }
  | { type: 'eaten'; owner: number; by: number }
  | { type: 'over'; eaten: boolean };

export interface Arena {
  t: number;
  round: number;
  players: Player[];
  /** Pellets: x, z in pairs; a colour index each; which moved this step (the drawing redoes those). */
  pellets: Float32Array;
  pcol: Uint8Array;
  moved: number[];
  blobs: Blob[];
  viruses: Virus[];
  tempers: Record<TemperName, Temper>;
  rnd: () => number;
  events: ArenaEvent[];
  over: boolean;
  nextId: number;
  /** The heaviest any bot of Ghosty's has been this round. */
  botPeak: number;
  you: boolean;
}

export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const massOf = (p: Player) => p.cells.reduce((s, c) => s + c.m, 0);
/** The centre of a player's cells, weighted by mass. */
export function centre(p: Player): { x: number; z: number } {
  let x = 0, z = 0, m = 0;
  for (const c of p.cells) (x += c.x * c.m), (z += c.z * c.m), (m += c.m);
  return m ? { x: x / m, z: z / m } : { x: 0, z: 0 };
}
const emit = (a: Arena, e: ArenaEvent) => {
  a.events.push(e);
  if (a.events.length > 300) a.events.splice(0, a.events.length - 300);
};

/** Somewhere clear of big cells to (re)appear. */
function clearSpot(a: Arena): { x: number; z: number } {
  let best = { x: 0, z: 0 }, bestD = -1;
  for (let k = 0; k < 12; k++) {
    const x = (a.rnd() * 2 - 1) * (SIZE - 10), z = (a.rnd() * 2 - 1) * (SIZE - 10);
    let near = Infinity;
    for (const p of a.players) for (const c of p.cells) near = Math.min(near, Math.hypot(c.x - x, c.z - z) - radius(c.m));
    if (near > bestD) (bestD = near), (best = { x, z });
    if (near > 40) break;
  }
  return best;
}
const newCell = (a: Arena, owner: number, x: number, z: number, m: number): Cell => ({ id: a.nextId++, owner, x, z, m, vx: 0, vz: 0, merge: 0 });

export interface ArenaOptions {
  /** A cell for you (false: the bots alone). */
  you?: boolean;
  round?: number;
  /** The GYM's tuning of the temperaments. */
  tempers?: Partial<Record<TemperName, Partial<Temper>>>;
}

export function newArena(seed: number, o: ArenaOptions = {}): Arena {
  const rnd = rng(seed);
  const tempers = { ...TEMPERS };
  for (const k of Object.keys(o.tempers ?? {}) as TemperName[]) tempers[k] = { ...TEMPERS[k], ...o.tempers![k] };
  const a: Arena = {
    t: 0, round: o.round ?? ROUND, players: [], pellets: new Float32Array(PELLETS * 2), pcol: new Uint8Array(PELLETS), moved: [], blobs: [], viruses: [],
    tempers, rnd, events: [], over: false, nextId: 1, botPeak: 0, you: o.you !== false,
  };
  for (let i = 0; i < PELLETS; i++) {
    a.pellets[i * 2] = (rnd() * 2 - 1) * SIZE;
    a.pellets[i * 2 + 1] = (rnd() * 2 - 1) * SIZE;
    a.pcol[i] = Math.floor(rnd() * COLOURS.length);
  }
  const names: [string, TemperName | 'you'][] = [['You', 'you'], ...BOT_NAMES];
  names.forEach(([name, temper], i) => {
    const p: Player = { i, name, colour: COLOURS[i % COLOURS.length]!, temper, cells: [], hx: 0, hz: -1, push: 0, alive: true, back: 0, peak: START_MASS, massTime: 0, eatenBy: null, think: rnd() * 0.1, wanderA: rnd() * Math.PI * 2 };
    a.players.push(p);
    if (i === 0 && !a.you) {
      p.alive = false;
      p.back = Infinity;
      return;
    }
    const s = i === 0 ? { x: 0, z: 0 } : clearSpot(a);
    // the bots join a round already under way: some small, some not
    p.cells.push(newCell(a, i, s.x, s.z, i === 0 ? START_MASS : START_MASS + rnd() * rnd() * 110));
  });
  for (let k = 0; k < VIRUSES; k++) {
    const s = clearSpot(a);
    a.viruses.push({ x: s.x, z: s.z, m: VIRUS_MASS, vx: 0, vz: 0, feeds: 0, back: 0 });
  }
  return a;
}

// ---------------------------------------------------------------- what a player can do

/** Split every cell big enough: the half flies ahead along the heading. */
export function split(a: Arena, p: Player): boolean {
  if (!p.alive) return false;
  let did = false;
  for (const c of [...p.cells].sort((x, y) => y.m - x.m)) {
    if (p.cells.length >= MAX_CELLS || c.m < SPLIT_MIN) continue;
    const half = c.m / 2;
    c.m = half;
    const r = radius(half);
    const n = newCell(a, p.i, c.x + p.hx * r, c.z + p.hz * r, half);
    n.vx = p.hx * SPLIT_SPEED;
    n.vz = p.hz * SPLIT_SPEED;
    c.merge = n.merge = mergeTime(half * 2);
    p.cells.push(n);
    did = true;
  }
  if (did) emit(a, { type: 'split', owner: p.i });
  return did;
}

/** Eject a little mass from every cell big enough, ahead along the heading. */
export function eject(a: Arena, p: Player): boolean {
  if (!p.alive) return false;
  let did = false;
  for (const c of p.cells) {
    if (c.m < EJECT_MIN) continue;
    c.m -= EJECT_COST;
    const r = radius(c.m) + 1.6;
    a.blobs.push({ x: c.x + p.hx * r, z: c.z + p.hz * r, m: EJECT_MASS, vx: p.hx * 70, vz: p.hz * 70, owner: p.i, age: 0 });
    did = true;
  }
  if (did) emit(a, { type: 'eject', owner: p.i });
  if (a.blobs.length > 80) a.blobs.splice(0, a.blobs.length - 80);
  return did;
}

/** Can a cell of mass ma eat one of mass mb (by the ratio alone)? */
export const canEat = (ma: number, mb: number) => ma >= EAT_RATIO * mb;
/** Does a cover b enough to eat it (by size and place)? */
export const covers = (a: { x: number; z: number; m: number }, b: { x: number; z: number; m: number }) => canEat(a.m, b.m) && Math.hypot(a.x - b.x, a.z - b.z) < radius(a.m) - EAT_OVERLAP * radius(b.m);

// ---------------------------------------------------------------- the bots

function botThink(a: Arena, p: Player): void {
  const T = a.tempers[p.temper as TemperName];
  const me = p.cells.reduce((b, c) => (c.m > b.m ? c : b), p.cells[0]!);
  const ctr = centre(p);
  const myM = me.m, myR = radius(myM);
  const view = 34 + myR * 5;
  let fx = 0, fz = 0;
  // pellets close by
  const P = a.pellets;
  for (let i = 0; i < PELLETS; i++) {
    const dx = P[i * 2]! - ctr.x, dz = P[i * 2 + 1]! - ctr.z;
    if (Math.abs(dx) > view * 0.6 || Math.abs(dz) > view * 0.6) continue;
    const d = Math.hypot(dx, dz) + 0.5;
    const w = T.pellet / (d * d * 0.05 + d);
    (fx += dx * w), (fz += dz * w);
  }
  for (const b of a.blobs) {
    const dx = b.x - ctr.x, dz = b.z - ctr.z, d = Math.hypot(dx, dz) + 0.5;
    if (d < view && canEat(myM, b.m)) (fx += (dx / d) * T.pellet * 0.5), (fz += (dz / d) * T.pellet * 0.5);
  }
  // other cells: prey and threats
  let prey: Cell | null = null, preyD = Infinity;
  for (const q of a.players) {
    if (q === p || !q.alive) continue;
    for (const c of q.cells) {
      const dx = c.x - ctr.x, dz = c.z - ctr.z, d = Math.hypot(dx, dz) + 0.01;
      const rc = radius(c.m);
      if (d > view + rc) continue;
      if (canEat(myM, c.m)) {
        const w = (T.prey * 12 * Math.sqrt(c.m / myM)) / (d + 4);
        (fx += (dx / d) * w), (fz += (dz / d) * w);
        if (d < preyD) (preyD = d), (prey = c);
      } else if (canEat(c.m, myM)) {
        const reach = rc * T.flee + myR;
        if (d < reach) {
          const w = T.threat * 14 * (1 - d / reach) * (1 - d / reach) * (1 + c.m / myM / 4);
          (fx -= (dx / d) * w), (fz -= (dz / d) * w);
        }
      }
    }
  }
  // viruses: big cells keep off them
  if (canEat(myM, VIRUS_MASS)) {
    for (const v of a.viruses) {
      if (v.back > 0) continue;
      const dx = v.x - ctr.x, dz = v.z - ctr.z, d = Math.hypot(dx, dz) + 0.01;
      if (d < myR + 14) (fx -= (dx / d) * T.virus * 4 * (1 - d / (myR + 14))), (fz -= (dz / d) * T.virus * 4 * (1 - d / (myR + 14)));
    }
  }
  // the walls
  const edge = 12 + myR;
  if (ctr.x > SIZE - edge) fx -= (ctr.x - (SIZE - edge)) * 0.2;
  if (ctr.x < -SIZE + edge) fx += (-SIZE + edge - ctr.x) * 0.2;
  if (ctr.z > SIZE - edge) fz -= (ctr.z - (SIZE - edge)) * 0.2;
  if (ctr.z < -SIZE + edge) fz += (-SIZE + edge - ctr.z) * 0.2;
  // a wander, so a bot with nothing round it still roams
  p.wanderA += (a.rnd() - 0.5) * 0.6;
  fx += Math.sin(p.wanderA) * T.wander;
  fz += Math.cos(p.wanderA) * T.wander;
  const l = Math.hypot(fx, fz);
  if (l > 1e-6) (p.hx = fx / l), (p.hz = fz / l);
  p.push = 1;
  // a hunter splits onto prey that half of it can still eat, close and ahead
  if (prey && T.split > 0 && p.cells.length < 3 && myM / 2 >= EAT_RATIO * prey.m && preyD < myR + 20) {
    const dx = prey.x - me.x, dz = prey.z - me.z, d = Math.hypot(dx, dz) || 1;
    if ((dx * p.hx + dz * p.hz) / d > 0.85 && a.rnd() < T.split) split(a, p);
  }
}

// ---------------------------------------------------------------- one step

function respawnPellet(a: Arena, i: number): void {
  a.pellets[i * 2] = (a.rnd() * 2 - 1) * SIZE;
  a.pellets[i * 2 + 1] = (a.rnd() * 2 - 1) * SIZE;
  a.moved.push(i);
}

/** One step of the arena. */
export function step(a: Arena, dt = STEP): void {
  if (a.over) return;
  a.t += dt;
  const P = a.pellets;
  // bots think a few times a second; dead bots come back
  for (const p of a.players) {
    if (!p.alive) {
      if (p.i !== 0 && (p.back -= dt) <= 0) {
        const s = clearSpot(a);
        p.cells = [newCell(a, p.i, s.x, s.z, START_MASS)];
        p.alive = true;
        p.peak = START_MASS;
      }
      continue;
    }
    if (p.temper !== 'you' && (p.think -= dt) <= 0) {
      p.think = 0.1;
      botThink(a, p);
    }
  }
  // movement: heading at the speed a mass allows, plus any fling; own cells keep apart until they may merge
  for (const p of a.players) {
    if (!p.alive) continue;
    const ctr = centre(p);
    for (const c of p.cells) {
      const v = speedFor(c.m) * p.push;
      let mx = p.hx * v, mz = p.hz * v;
      if (p.cells.length > 1) {
        const dx = ctr.x - c.x, dz = ctr.z - c.z, d = Math.hypot(dx, dz);
        if (d > 0.5) (mx += (dx / d) * Math.min(4, d)), (mz += (dz / d) * Math.min(4, d));
      }
      c.x = clamp(c.x + (mx + c.vx) * dt, -SIZE, SIZE);
      c.z = clamp(c.z + (mz + c.vz) * dt, -SIZE, SIZE);
      const k = Math.exp(-3.5 * dt);
      c.vx *= k;
      c.vz *= k;
      c.merge = Math.max(0, c.merge - dt);
      if (c.m > 60) c.m -= c.m * 0.002 * dt;
    }
    // own cells: apart while their timers run, together after
    for (let i = 0; i < p.cells.length; i++) {
      for (let j = i + 1; j < p.cells.length; j++) {
        const A = p.cells[i]!, B = p.cells[j]!;
        const dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz) || 0.001;
        const ra = radius(A.m), rb = radius(B.m);
        if (A.merge > 0 || B.merge > 0) {
          const over = ra + rb - d;
          if (over > 0 && Math.hypot(A.vx, A.vz) + Math.hypot(B.vx, B.vz) < 20) {
            const f = over * 0.5 * Math.min(1, dt * 12);
            A.x -= (dx / d) * f;
            A.z -= (dz / d) * f;
            B.x += (dx / d) * f;
            B.z += (dz / d) * f;
          }
        } else if (d < Math.max(ra, rb) * 0.85) {
          const big = A.m >= B.m ? A : B, small = big === A ? B : A;
          big.x = (big.x * big.m + small.x * small.m) / (big.m + small.m);
          big.z = (big.z * big.m + small.z * small.m) / (big.m + small.m);
          big.m += small.m;
          p.cells.splice(p.cells.indexOf(small), 1);
          emit(a, { type: 'merge', owner: p.i });
          j--;
        }
      }
    }
  }
  // pellets eaten
  a.moved.length = 0;
  for (const p of a.players) {
    if (!p.alive) continue;
    for (const c of p.cells) {
      const r = radius(c.m);
      for (let i = 0; i < PELLETS; i++) {
        const dx = P[i * 2]! - c.x;
        if (dx > r || dx < -r) continue;
        const dz = P[i * 2 + 1]! - c.z;
        if (dz > r || dz < -r || dx * dx + dz * dz > r * r) continue;
        c.m += 1;
        emit(a, { type: 'pellet', owner: p.i, x: P[i * 2]!, z: P[i * 2 + 1]!, c: a.pcol[i]! });
        respawnPellet(a, i);
      }
    }
  }
  // ejected blobs: fly, slow, feed viruses or get eaten
  for (let i = a.blobs.length - 1; i >= 0; i--) {
    const b = a.blobs[i]!;
    b.age += dt;
    b.x = clamp(b.x + b.vx * dt, -SIZE, SIZE);
    b.z = clamp(b.z + b.vz * dt, -SIZE, SIZE);
    const k = Math.exp(-5 * dt);
    b.vx *= k;
    b.vz *= k;
    let gone = false;
    for (const v of a.viruses) {
      if (v.back > 0 || Math.hypot(v.x - b.x, v.z - b.z) > radius(v.m)) continue;
      v.feeds++;
      v.m += b.m;
      emit(a, { type: 'feed', x: v.x, z: v.z });
      if (v.feeds >= VIRUS_FEEDS) {
        v.feeds = 0;
        v.m = VIRUS_MASS;
        const l = Math.hypot(b.vx, b.vz) || 1;
        a.viruses.push({ x: v.x, z: v.z, m: VIRUS_MASS, vx: (b.vx / l) * 60, vz: (b.vz / l) * 60, feeds: 0, back: 0 });
      }
      gone = true;
      break;
    }
    if (!gone) {
      for (const p of a.players) {
        if (!p.alive || gone) continue;
        for (const c of p.cells) {
          if ((p.i === b.owner && b.age < 0.5) || !canEat(c.m, b.m) || Math.hypot(c.x - b.x, c.z - b.z) > radius(c.m)) continue;
          c.m += b.m;
          gone = true;
          break;
        }
      }
    }
    if (gone) a.blobs.splice(i, 1);
  }
  // viruses: drift when shot, come back when popped; big cells that cover one pop
  for (const v of a.viruses) {
    if (v.back > 0) {
      if ((v.back -= dt) <= 0) {
        const s = clearSpot(a);
        (v.x = s.x), (v.z = s.z), (v.m = VIRUS_MASS), (v.feeds = 0), (v.back = 0);
      }
      continue;
    }
    v.x = clamp(v.x + v.vx * dt, -SIZE + 5, SIZE - 5);
    v.z = clamp(v.z + v.vz * dt, -SIZE + 5, SIZE - 5);
    v.vx *= Math.exp(-3 * dt);
    v.vz *= Math.exp(-3 * dt);
    for (const p of a.players) {
      if (!p.alive || v.back > 0) continue;
      for (const c of p.cells) {
        if (!covers(c, v)) continue;
        pop(a, p, c, v);
        break;
      }
    }
  }
  if (a.viruses.length > VIRUSES + 4) a.viruses.splice(VIRUSES, a.viruses.length - VIRUSES - 4);
  // cells eat cells
  const all: Cell[] = [];
  for (const p of a.players) if (p.alive) all.push(...p.cells);
  all.sort((x, y) => y.m - x.m);
  const eaten = new Set<Cell>();
  for (const A of all) {
    if (eaten.has(A)) continue;
    for (const B of all) {
      if (B === A || eaten.has(B) || B.owner === A.owner || B.m >= A.m) continue;
      if (!covers(A, B)) continue;
      A.m += B.m;
      eaten.add(B);
      const victim = a.players[B.owner]!;
      victim.cells.splice(victim.cells.indexOf(B), 1);
      const whole = victim.cells.length === 0;
      emit(a, { type: 'eat', eater: A.owner, eaten: B.owner, m: B.m, x: B.x, z: B.z, whole });
      if (whole) {
        victim.alive = false;
        victim.eatenBy = A.owner;
        victim.back = 4;
        emit(a, { type: 'eaten', owner: victim.i, by: A.owner });
      }
    }
  }
  // the round's tally
  for (const p of a.players) {
    if (!p.alive) continue;
    const m = massOf(p);
    p.massTime += m * dt;
    if (m > p.peak) p.peak = m;
    if (p.i !== 0 && m > a.botPeak) a.botPeak = m;
  }
  const you = a.players[0]!;
  if (a.you && !you.alive) {
    a.over = true;
    emit(a, { type: 'over', eaten: true });
  } else if (a.t >= a.round) {
    a.over = true;
    emit(a, { type: 'over', eaten: false });
  }
}

/** A cell big enough covers a virus: it bursts into pieces flung all round (the virus's mass shared out among them). */
export function pop(a: Arena, p: Player, c: Cell, v: Virus): void {
  const total = c.m + v.m * 0.5;
  const n = Math.max(1, Math.min(MAX_CELLS - p.cells.length + 1, 3 + Math.floor(c.m / 110)));
  v.back = 8;
  v.m = 0;
  emit(a, { type: 'pop', owner: p.i, x: v.x, z: v.z });
  if (n <= 1) {
    c.m = total;
    return;
  }
  c.m = total * 0.4;
  c.merge = mergeTime(total);
  const piece = (total * 0.6) / (n - 1);
  for (let k = 0; k < n - 1; k++) {
    const ang = (k / (n - 1)) * Math.PI * 2 + a.rnd() * 0.3;
    const q = newCell(a, p.i, c.x + Math.sin(ang) * radius(c.m), c.z + Math.cos(ang) * radius(c.m), piece);
    q.vx = Math.sin(ang) * 40;
    q.vz = Math.cos(ang) * 40;
    q.merge = mergeTime(total);
    p.cells.push(q);
  }
}

/** The round's table: the living by mass. */
export function standings(a: Arena): { i: number; name: string; m: number; you: boolean }[] {
  return a.players.filter((p) => p.alive).map((p) => ({ i: p.i, name: p.name, m: massOf(p), you: p.i === 0 })).sort((x, y) => y.m - x.m);
}

// ---------------------------------------------------------------- the Learnable

export const ACTIONS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw', 'split', 'eject'] as const;
export type ArenaAction = (typeof ACTIONS)[number];
const HEADINGS: Record<string, [number, number]> = { n: [0, -1], ne: [0.7071, -0.7071], e: [1, 0], se: [0.7071, 0.7071], s: [0, 1], sw: [-0.7071, 0.7071], w: [-1, 0], nw: [-0.7071, -0.7071] };
export interface ArenaObs {
  mass: number;
  cells: number;
  x: number;
  z: number;
  /** The eight nearest pellets: dx, dz each. */
  pellets: number[];
  /** The eight nearest cells of others: dx, dz, their mass over yours, their heading's x and z. */
  others: number[];
  /** The three nearest viruses: dx, dz each. */
  viruses: number[];
  timeLeft: number;
}
export function observe(a: Arena): ArenaObs {
  const you = a.players[0]!;
  const c = centre(you), m = massOf(you) || 1;
  const near = <T>(list: T[], at: (t: T) => [number, number], k: number) =>
    list.map((t) => {
      const [x, z] = at(t);
      return { t, dx: x - c.x, dz: z - c.z, d: Math.hypot(x - c.x, z - c.z) };
    }).sort((p, q) => p.d - q.d).slice(0, k);
  const pel: number[] = [];
  for (const q of near(Array.from({ length: PELLETS }, (_, i) => i), (i) => [a.pellets[i * 2]!, a.pellets[i * 2 + 1]!], 8)) pel.push(q.dx, q.dz);
  const others: number[] = [];
  const cells = a.players.filter((p) => p.i !== 0 && p.alive).flatMap((p) => p.cells.map((cl) => ({ cl, p })));
  for (const q of near(cells, (x) => [x.cl.x, x.cl.z], 8)) others.push(q.dx, q.dz, q.t.cl.m / m, q.t.p.hx, q.t.p.hz);
  const vir: number[] = [];
  for (const q of near(a.viruses.filter((v) => v.back <= 0), (v) => [v.x, v.z], 3)) vir.push(q.dx, q.dz);
  return { mass: m, cells: you.cells.length, x: c.x, z: c.z, pellets: pel, others, viruses: vir, timeLeft: Math.max(0, a.round - a.t) };
}

/** The arena as a Learnable: a heading, a split or an eject a tick; the score mass × seconds. */
export function arenaLearnable(seed = 1): Learnable<ArenaObs, ArenaAction> & { arena: Arena } {
  const arena = newArena(seed);
  return {
    id: 'arena',
    actions: ACTIONS,
    arena,
    observe: () => observe(arena),
    act: (x: ArenaAction) => {
      const you = arena.players[0]!;
      if (x === 'split') split(arena, you);
      else if (x === 'eject') eject(arena, you);
      else {
        const [hx, hz] = HEADINGS[x]!;
        you.hx = hx;
        you.hz = hz;
        you.push = 1;
      }
      step(arena, STEP);
    },
    score: () => arena.players[0]!.massTime,
    done: () => arena.over,
  };
}

/** The arena's inputs from a controller: the stick's heading and push; A splits, B ejects (on their edges). */
export function padHeading(intent: { moveX: number; moveY: number }): { hx: number; hz: number; push: number } | null {
  const x = Number.isFinite(intent.moveX) ? intent.moveX : 0, y = Number.isFinite(intent.moveY) ? intent.moveY : 0;
  const l = Math.hypot(x, y);
  if (l < 0.2) return null;
  return { hx: x / l, hz: -y / l, push: Math.min(1, l) };
}
