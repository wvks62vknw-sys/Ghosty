/**
 * THE RUNNER's rules, with no drawing in them: three lanes, a runner who changes lane, jumps and rolls, a world laid
 * out ahead from a seed in rows that always leave a way through (low barriers to jump, high beams to roll under,
 * pillars to dodge, gaps to leap), coins in lines and arcs, four power-ups on timers, speed that rises with distance,
 * and a shadow that closes in on a stumble and catches him on the second (a stumble is recoverable once). The engine
 * draws it; the node test plays it; the GYM can learn it through `runnerLearnable` (observe, act, score).
 */
import type { Learnable } from '../../learnable';
import type { Intent } from '../../input';

export const LANE_W = 1.9;
/** One tick of the Learnable (a sixtieth of a second). */
export const TICK = 1 / 60;
export const MOVES = ['none', 'left', 'right', 'jump', 'roll'] as const;
export type Move = (typeof MOVES)[number];
export const OB_KINDS = ['barrier', 'beam', 'pillar', 'gap'] as const;
export type ObKind = (typeof OB_KINDS)[number];
export const POWERS = ['magnet', 'shield', 'double', 'boost'] as const;
export type Power = (typeof POWERS)[number];
export const POWER_SECONDS: Record<Power, number> = { magnet: 10, shield: 15, double: 12, boost: 10 };
export const SECTIONS = ['city', 'tunnel', 'bridge', 'roof'] as const;
export type Section = (typeof SECTIONS)[number];

/** Heights (m): a barrier's top, a beam's underside, the runner standing and rolling. */
export const BARRIER_TOP = 0.95;
export const BEAM_LOW = 1.15;
export const BEAM_HIGH = 2.0;
export const TALL = 1.8;
export const LOW = 0.9;
/** Seconds the shadow stays close after a stumble. */
export const CHASE = 7;
export const ROLL_SECONDS = 0.62;
const G = 30;
const JUMP_V = 9.2;
const BOOST_V = 12.5;

export interface Ob {
  kind: ObKind;
  lane: number;
  /** Where it starts along the run (m) and how long it is. */
  d: number;
  len: number;
  hit: boolean;
  /** A number for its look (colour, shape). */
  style: number;
}
export interface Coin {
  lane: number;
  d: number;
  y: number;
  taken: boolean;
  /** When it was taken (the run's seconds), for the drawing. */
  at: number;
}
export interface Up {
  kind: Power;
  lane: number;
  d: number;
  taken: boolean;
}
export type RunEvent =
  | { type: 'coin' | 'jump' | 'roll' | 'lane' | 'land' | 'shield' | 'caught' | 'clear' | 'bump' }
  | { type: 'stumble'; kind: ObKind }
  | { type: 'power' | 'expire'; kind: Power };

export interface Run {
  seed: number;
  rnd: () => number;
  /** Seconds run. */
  t: number;
  d: number;
  speed: number;
  lane: number;
  x: number;
  y: number;
  vy: number;
  air: boolean;
  rollT: number;
  jumpBuf: number;
  rollBuf: number;
  /** Seconds the shadow stays close (0: it is far back). */
  chase: number;
  slowT: number;
  invuln: number;
  stumbles: number;
  over: boolean;
  coins: number;
  points: number;
  powers: Record<Power, number>;
  obs: Ob[];
  coinList: Coin[];
  ups: Up[];
  /** How far ahead the world is laid out, and where the next power-up goes. */
  genD: number;
  nextUp: number;
  sections: { start: number; kind: Section }[];
  events: RunEvent[];
  gen: boolean;
}

export function rng(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The speed the run settles to at a distance: 10.5 m/s at the start, 22 at the limit. */
export const speedAt = (d: number) => 10.5 + 11.5 * (1 - Math.exp(-d / 1800));

export function newRun(seed: number, o: { gen?: boolean } = {}): Run {
  const r: Run = {
    seed, rnd: rng(seed), t: 0, d: 0, speed: 0, lane: 0, x: 0, y: 0, vy: 0, air: false, rollT: 0, jumpBuf: 0, rollBuf: 0,
    chase: 0, slowT: 0, invuln: 0, stumbles: 0, over: false, coins: 0, points: 0,
    powers: { magnet: 0, shield: 0, double: 0, boost: 0 }, obs: [], coinList: [], ups: [], genD: 45, nextUp: 260,
    sections: [{ start: 0, kind: 'city' }], events: [], gen: o.gen !== false,
  };
  if (r.gen) layOut(r, 220);
  return r;
}

/** The section at a distance: city at dawn, a tunnel, a bridge, the rooftops, round again (lengths vary by seed). */
export function sectionAt(r: Run, d: number): Section {
  const LEN: Record<Section, [number, number]> = { city: [420, 640], tunnel: [200, 300], bridge: [360, 480], roof: [380, 560] };
  while (r.sections[r.sections.length - 1]!.start < d + 400) {
    const last = r.sections[r.sections.length - 1]!;
    const [a, b] = LEN[last.kind];
    const h = Math.sin(last.start * 12.9898 + r.seed * 0.001) * 43758.5453;
    const len = a + (h - Math.floor(h)) * (b - a);
    const next = SECTIONS[(SECTIONS.indexOf(last.kind) + 1) % SECTIONS.length]!;
    r.sections.push({ start: Math.round(last.start + len), kind: next });
  }
  for (let i = r.sections.length - 1; i >= 0; i--) if (r.sections[i]!.start <= d) return r.sections[i]!.kind;
  return 'city';
}

const pickLane = (r: Run) => Math.floor(r.rnd() * 3) - 1;
const others = (l: number) => [-1, 0, 1].filter((x) => x !== l);

/** Coins: a line along a lane, or an arc over something to jump. */
function coinLine(r: Run, lane: number, d: number, n: number): void {
  for (let i = 0; i < n; i++) r.coinList.push({ lane, d: d + i * 2.2, y: 0.8, taken: false, at: 0 });
}
function coinArc(r: Run, lane: number, d: number, len: number): void {
  const n = 7;
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    r.coinList.push({ lane, d: d - 3 + f * (len + 6), y: 0.8 + Math.sin(f * Math.PI) * 1.5, taken: false, at: 0 });
  }
}

/** Lay out rows until `until` metres: each row leaves a way through, and the next starts far enough on to react. */
export function layOut(r: Run, until: number): void {
  while (r.genD < until) {
    const sp = speedAt(r.genD);
    const d = r.genD;
    const sec = sectionAt(r, d);
    const early = d < 320;
    const ob = (kind: ObKind, lane: number, len = kind === 'pillar' ? 1.2 : 0.4) => r.obs.push({ kind, lane, d, len, hit: false, style: Math.floor(r.rnd() * 1000) });
    let rowLen = 1.2;
    const w: [string, number][] = early
      ? [['bar1', 3], ['beam1', 2], ['pil1', 3], ['pil2', 1]]
      : sec === 'tunnel'
        ? [['beam3', 3], ['beam1', 2], ['pil2', 3], ['mix', 3], ['long', 2], ['bar3', 1]]
        : sec === 'bridge'
          ? [['bar3', 2], ['gap', 2], ['mix', 3], ['pil2', 2], ['bar1', 2], ['long', 1]]
          : sec === 'roof'
            ? [['gap', 4], ['mix', 2], ['bar3', 1], ['beam3', 1], ['pil2', 2], ['long', 1]]
            : [['bar1', 2], ['bar3', 2], ['beam1', 2], ['beam3', 1], ['pil2', 3], ['mix', 3], ['long', 2]];
    let total = 0;
    for (const [, n] of w) total += n;
    let pick = r.rnd() * total;
    let pat = w[0]![0];
    for (const [p, n] of w) if ((pick -= n) < 0) {
      pat = p;
      break;
    }
    const L = pickLane(r);
    switch (pat) {
      case 'bar1':
        ob('barrier', L);
        if (r.rnd() < 0.5) coinArc(r, L, d, 0.4);
        else coinLine(r, others(L)[Math.floor(r.rnd() * 2)]!, d - 8, 6);
        break;
      case 'bar3':
        for (const l of [-1, 0, 1]) ob('barrier', l);
        coinArc(r, L, d, 0.4);
        break;
      case 'beam1':
        ob('beam', L);
        coinLine(r, L, d - 6, 4);
        break;
      case 'beam3':
        for (const l of [-1, 0, 1]) ob('beam', l);
        r.coinList.push({ lane: L, d: d + 0.2, y: 0.45, taken: false, at: 0 });
        break;
      case 'pil1':
        ob('pillar', L);
        coinLine(r, others(L)[Math.floor(r.rnd() * 2)]!, d - 10, 6);
        break;
      case 'pil2': {
        for (const l of others(L)) ob('pillar', l);
        coinLine(r, L, d - 10, 6);
        break;
      }
      case 'mix': {
        const kinds: ObKind[] = ['barrier', 'beam', 'pillar'];
        for (let i = kinds.length - 1; i > 0; i--) {
          const j = Math.floor(r.rnd() * (i + 1));
          [kinds[i], kinds[j]] = [kinds[j]!, kinds[i]!];
        }
        [-1, 0, 1].forEach((l, i) => ob(kinds[i]!, l));
        break;
      }
      case 'long': {
        const len = 8 + Math.floor(r.rnd() * 9);
        const two = r.rnd() < 0.5;
        for (const l of two ? others(L) : [L]) ob('pillar', l, len);
        coinLine(r, two ? L : others(L)[0]!, d, Math.floor(len / 2.2));
        rowLen = len;
        break;
      }
      case 'gap': {
        const len = Math.min(4.2, 2.6 + sp * 0.07);
        for (const l of [-1, 0, 1]) ob('gap', l, len);
        coinArc(r, L, d, len);
        rowLen = len;
        break;
      }
    }
    // a power-up now and then, in a lane the row leaves free at that point
    if (d > r.nextUp) {
      const free = [-1, 0, 1].filter((l) => !r.obs.some((o) => o.lane === l && o.d >= d - 0.1 && o.d < d + 0.5 && o.kind !== 'gap'));
      const lane = free[Math.floor(r.rnd() * free.length)] ?? 0;
      r.ups.push({ kind: POWERS[Math.floor(r.rnd() * POWERS.length)]!, lane, d: d - 7, taken: false });
      r.nextUp = d + 300 + r.rnd() * 220;
    }
    // far enough on to see the next one and react, a little more early on
    r.genD = d + rowLen + Math.max(13, speedAt(d) * 1.05) + r.rnd() * 8 + (early ? 6 : 0);
  }
}

/** Put a thing on the run by hand (the tests). */
export const place = (r: Run, o: Omit<Ob, 'hit' | 'style'>): Ob => {
  const ob = { ...o, hit: false, style: 0 };
  r.obs.push(ob);
  r.obs.sort((a, b) => a.d - b.d);
  return ob;
};

const overlaps = (r: Run, o: Ob, pad = 0.3) => r.d + pad > o.d && r.d - pad < o.d + o.len;
/** The lane his body is in now (between lanes while changing: the nearer). */
export const laneOf = (r: Run) => Math.max(-1, Math.min(1, Math.round(r.x / LANE_W)));
/** Over a gap: no ground under him. */
export const overGap = (r: Run) => r.obs.some((o) => o.kind === 'gap' && o.lane === laneOf(r) && r.d > o.d + 0.3 && r.d < o.d + o.len - 0.3);

function stumble(r: Run, kind: ObKind): void {
  if (r.invuln > 0 || r.over) return;
  if (r.powers.shield > 0) {
    r.powers.shield = 0;
    r.invuln = 1;
    r.events.push({ type: 'shield' });
    return;
  }
  if (r.chase > 0) {
    r.over = true;
    r.events.push({ type: 'caught' });
    return;
  }
  r.stumbles++;
  r.chase = CHASE;
  r.slowT = 1.2;
  r.invuln = 1;
  r.events.push({ type: 'stumble', kind });
}

/** One step of the run: a move (one a step), then dt seconds of running. */
export function step(r: Run, move: Move, dt: number): void {
  if (r.over) return;
  r.t += dt;
  const ground = !overGap(r);
  // the move
  if (move === 'left' || move === 'right') {
    const to = r.lane + (move === 'left' ? -1 : 1);
    if (to >= -1 && to <= 1) {
      // a pillar right beside him: a bump, and he stays in his lane
      const block = r.obs.find((o) => o.kind === 'pillar' && o.lane === to && overlaps(r, o, 0.45));
      if (block) {
        r.events.push({ type: 'bump' });
        stumble(r, 'pillar');
      } else {
        r.lane = to;
        r.events.push({ type: 'lane' });
      }
    }
  } else if (move === 'jump') {
    if (!r.air && ground) {
      r.vy = r.powers.boost > 0 ? BOOST_V : JUMP_V;
      r.air = true;
      r.rollT = 0;
      r.events.push({ type: 'jump' });
    } else r.jumpBuf = 0.15;
  } else if (move === 'roll') {
    if (r.air) {
      r.vy = Math.min(r.vy, -22);
      r.rollBuf = 0.25;
    } else {
      r.rollT = ROLL_SECONDS;
      r.events.push({ type: 'roll' });
    }
  }
  // running
  const target = speedAt(r.d);
  r.slowT = Math.max(0, r.slowT - dt);
  const ramp = Math.min(1, r.t / 0.8);
  r.speed = target * ramp * (r.slowT > 0 ? 0.62 + 0.38 * (1 - r.slowT / 1.2) : 1);
  const dd = r.speed * dt;
  r.d += dd;
  r.points += dd * (r.powers.double > 0 ? 2 : 1);
  r.x += (r.lane * LANE_W - r.x) * Math.min(1, dt * 16);
  r.rollT = Math.max(0, r.rollT - dt);
  r.jumpBuf = Math.max(0, r.jumpBuf - dt);
  r.rollBuf = Math.max(0, r.rollBuf - dt);
  r.invuln = Math.max(0, r.invuln - dt);
  // up and down; over a gap there is no ground to land on
  if (r.air || !ground) {
    r.air = true;
    r.vy -= G * dt;
    r.y += r.vy * dt;
    if (r.y <= 0 && !overGap(r)) {
      r.y = 0;
      r.vy = 0;
      r.air = false;
      r.events.push({ type: 'land' });
      if (r.jumpBuf > 0) step(r, 'jump', 0);
      else if (r.rollBuf > 0) step(r, 'roll', 0);
    } else if (r.y < -0.25 && overGap(r)) {
      // he dropped into a gap: he scrambles up the far edge, and that is a stumble
      const gap = r.obs.find((o) => o.kind === 'gap' && o.lane === laneOf(r) && r.d > o.d && r.d < o.d + o.len + 1);
      stumble(r, 'gap');
      r.d = (gap ? gap.d + gap.len : r.d) + 0.4;
      r.y = 0;
      r.vy = 0;
      r.air = false;
      if (r.over) return;
    }
  }
  // what he runs into, in the lane his body is in
  const lane = laneOf(r);
  for (const o of r.obs) {
    if (o.d > r.d + 1) break;
    if (o.hit || o.lane !== lane || o.kind === 'gap' || !overlaps(r, o)) continue;
    const top = r.y + (r.rollT > 0 ? LOW : TALL);
    const hit = o.kind === 'pillar' || (o.kind === 'barrier' && r.y < BARRIER_TOP) || (o.kind === 'beam' && top > BEAM_LOW && r.y < BEAM_HIGH);
    if (!hit) continue;
    o.hit = true;
    if (o.kind === 'pillar' && !r.over && r.invuln <= 0) {
      // head on into a pillar: he is knocked into the freer lane beside it
      const free = [lane - 1, lane + 1].filter((l) => l >= -1 && l <= 1).sort((a, b) => nextIn(r, b) - nextIn(r, a));
      r.lane = free[0] ?? lane;
    }
    stumble(r, o.kind);
    if (r.over) return;
  }
  // coins and power-ups
  const mag = r.powers.magnet > 0;
  const bodyLow = r.y - 0.2, bodyHigh = r.y + (r.rollT > 0 ? LOW : TALL) + 0.3;
  for (const c of r.coinList) {
    if (c.taken) continue;
    if (c.d > r.d + (mag ? 7 : 1)) break;
    const near = mag ? c.d > r.d - 1 : Math.abs(c.d - r.d) < 0.8 && c.lane === lane && c.y >= bodyLow && c.y <= bodyHigh;
    if (near) {
      c.taken = true;
      c.at = r.t;
      r.coins++;
      r.points += 10 * (r.powers.double > 0 ? 2 : 1);
      r.events.push({ type: 'coin' });
    }
  }
  for (const u of r.ups) {
    if (!u.taken && Math.abs(u.d - r.d) < 0.9 && u.lane === lane && r.y < 2) {
      u.taken = true;
      r.powers[u.kind] = POWER_SECONDS[u.kind];
      r.events.push({ type: 'power', kind: u.kind });
    }
  }
  for (const p of POWERS) {
    if (r.powers[p] > 0) {
      r.powers[p] = Math.max(0, r.powers[p] - dt);
      if (r.powers[p] === 0) r.events.push({ type: 'expire', kind: p });
    }
  }
  if (r.chase > 0) {
    r.chase = Math.max(0, r.chase - dt);
    if (r.chase === 0) r.events.push({ type: 'clear' });
  }
  if (r.events.length > 64) r.events.splice(0, r.events.length - 64); // nobody draining them (the GYM): keep the last few
  // what is behind is gone; what is ahead is laid out
  if (r.gen) {
    if (r.obs.length && r.obs[0]!.d + r.obs[0]!.len < r.d - 30) r.obs = r.obs.filter((o) => o.d + o.len > r.d - 30);
    if (r.coinList.length > 200) r.coinList = r.coinList.filter((c) => c.d > r.d - 30);
    if (r.ups.length > 6) r.ups = r.ups.filter((u) => u.d > r.d - 30);
    layOut(r, r.d + 220);
    r.obs.sort((a, b) => a.d - b.d);
    r.coinList.sort((a, b) => a.d - b.d);
  }
}

/** How far ahead the next thing in a lane is (m). */
function nextIn(r: Run, lane: number): number {
  for (const o of r.obs) if (o.lane === lane && o.d + o.len > r.d - 0.3) return o.d - r.d;
  return 999;
}

/** The score a run is worth: its points, whole. */
export const scoreOf = (r: Run) => Math.round(r.points);

// ---------------------------------------------------------------- the GYM's door (no GYM change now)

export interface RunnerObs {
  lane: number;
  y: number;
  rolling: number;
  /** The next three things ahead: kind (0 barrier, 1 beam, 2 pillar, 3 gap; −1 none), lane, distance (m). */
  next: number[];
  coins: number;
  speed: number;
  shield: number;
  chase: number;
}

export function observe(r: Run): RunnerObs {
  const next: number[] = [];
  for (const o of r.obs) {
    if (next.length >= 9) break;
    if (o.d + o.len < r.d - 0.3 || o.hit) continue;
    next.push(OB_KINDS.indexOf(o.kind), o.lane, Math.max(0, Math.round((o.d - r.d) * 100) / 100));
  }
  while (next.length < 9) next.push(-1, 0, 999);
  return { lane: r.lane, y: Math.round(r.y * 100) / 100, rolling: r.rollT > 0 ? 1 : 0, next, coins: r.coins, speed: Math.round(r.speed * 100) / 100, shield: r.powers.shield > 0 ? 1 : 0, chase: r.chase > 0 ? 1 : 0 };
}

/** The runner as a Learnable: one move a tick, the score the distance run. */
export function runnerLearnable(seed = 1): Learnable<RunnerObs, Move> & { run: Run } {
  const run = newRun(seed);
  return {
    id: 'runner',
    actions: MOVES,
    run,
    observe: () => observe(run),
    act: (m: Move) => step(run, m, TICK),
    score: () => Math.floor(run.d),
    done: () => run.over,
  };
}

// ---------------------------------------------------------------- a controller

/** The pad's state last frame, for its edges. */
export interface PadState {
  mx: number;
  my: number;
  held: Set<string>;
}
/** A controller through the Intent → moves: the d-pad or stick pushed (left, right, up to jump, down to roll), A jumps, B rolls. */
export function padMoves(prev: PadState, intent: Intent): Move[] {
  const out: Move[] = [];
  const mx = intent.moveX > 0.5 ? 1 : intent.moveX < -0.5 ? -1 : 0;
  const my = intent.moveY > 0.5 ? 1 : intent.moveY < -0.5 ? -1 : 0;
  if (mx !== prev.mx && mx) out.push(mx < 0 ? 'left' : 'right');
  if (my !== prev.my && my) out.push(my > 0 ? 'jump' : 'roll');
  if (intent.held.has('jump') && !prev.held.has('jump')) out.push('jump');
  if (intent.held.has('use') && !prev.held.has('use')) out.push('roll');
  prev.mx = mx;
  prev.my = my;
  prev.held = new Set(intent.held);
  return out;
}
