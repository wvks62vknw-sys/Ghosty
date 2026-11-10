/**
 * THE CLIMB's rules, with no drawing in them: Doodle Jump mechanics. The jumper bounces on its own whenever it comes down
 * onto a platform; you steer sideways (the screen wraps at the edges) and the tower goes up for as long as you can keep
 * landing: still platforms, ones that slide, ones that crumble after one bounce, springs that throw you high and a jet
 * that lifts you for a moment. Height is the score. A level sets how far apart platforms are (never more than a bounce
 * can reach), how wide they are (to a floor), how many slide or crumble, from level 6 a sideways wind, and always keeps
 * a safe platform within reach of the last, so no tower is ever impossible. Ghosty plays it by steering for the best
 * platform by distance, height and kind, with weights he tunes. The engine draws it; the node test plays it; the GYM can
 * learn it through `climbLearnable`.
 */
import type { Learnable } from '../../learnable';
import { fall, intensity, rise } from './skill';

export const WORLD_W = 360;
const GRAV = 1500;
export const BOUNCE_V = 720;
export const SPRING_V = 1150;
export const JET_V = 640;
/** The highest a plain bounce goes (px). */
export const BOUNCE_H = (BOUNCE_V * BOUNCE_V) / (2 * GRAV);
/** Pixels of height to a point of score. */
export const PX_PER_M = 12;
export type Kind = 'still' | 'slide' | 'crumble';
export interface Platform {
  x: number;
  y: number;
  w: number;
  kind: Kind;
  /** Slides: its range and phase. */
  range: number;
  phase: number;
  spring: boolean;
  jet: boolean;
  /** Crumbled: falling away. */
  broken: number;
  homeX: number;
}
export type ClimbEvent = { type: 'bounce' | 'spring' | 'crumble' | 'jet' | 'die' } | { type: 'milestone'; n: number };
export interface Run {
  seed: number;
  level: number;
  rnd: () => number;
  t: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  cam: number;
  best: number;
  jetT: number;
  platforms: Platform[];
  topY: number;
  lastSafeY: number;
  dead: boolean;
  deadT: number;
  events: ClimbEvent[];
  face: number;
  milestone: number;
  /** A spec's switch: the floor of the screen bounces him, so he cannot fall. */
  calm: boolean;
}

export const gapMaxOf = (level: number): number => Math.min(BOUNCE_H * 0.82, rise(level, 78, 11, 4));
export const widthOf = (level: number): number => fall(level, 74, 7, 38, 5);
export const slideP = (level: number): number => Math.min(0.42, 0.04 * Math.log1p(level) * 3 - 0.03);
export const crumbleP = (level: number): number => Math.min(0.4, level < 2 ? 0 : 0.035 * Math.log1p(level - 1) * 3);
export const slideSpeed = (level: number): number => rise(level, 40, 22, 4);
export const windOf = (level: number): number => (level < 6 ? 0 : Math.min(260, rise(level - 5, 40, 30, 4)));
export const targetOf = (level: number): number => Math.round(rise(level, 100, 60, 3));
export const hardness = (level: number): number => intensity(level, [gapMaxOf(level) / 20, (74 - widthOf(level)) / 10, slideP(level) * 4, crumbleP(level) * 4, slideSpeed(level) / 40, windOf(level) / 60]);

const mk = (seed: number): (() => number) => {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};
export const THETA0: readonly number[] = [0.4, 110, 14];
export const SIGMA: readonly number[] = [0.12, 40, 12];

export function newRun(seed: number, level: number): Run {
  const r: Run = { seed, level, rnd: mk(seed), t: 0, x: WORLD_W / 2, y: 60, vx: 0, vy: BOUNCE_V, cam: 0, best: 0, jetT: 0, platforms: [], topY: 0, lastSafeY: 0, dead: false, deadT: 0, events: [], face: 1, milestone: 0, calm: false };
  r.platforms.push({ x: WORLD_W / 2, y: 40, w: 120, kind: 'still', range: 0, phase: 0, spring: false, jet: false, broken: 0, homeX: WORLD_W / 2 });
  r.topY = 40;
  r.lastSafeY = 40;
  fill(r);
  return r;
}
/** Lay platforms above until the tower reaches well past the camera. Always a safe one within the bounce's reach. */
function fill(r: Run): void {
  const L = r.level;
  while (r.topY < r.cam + 1100) {
    const gapMax = gapMaxOf(L);
    const y = Math.max(r.topY + 10, Math.min(r.topY + 34 + r.rnd() * (gapMax - 34), r.lastSafeY + BOUNCE_H * 0.9));
    const w = widthOf(L);
    let kind: Kind = 'still';
    const roll = r.rnd();
    const forceSafe = y - r.lastSafeY > gapMax * 0.95;
    if (!forceSafe) kind = roll < crumbleP(L) ? 'crumble' : roll < crumbleP(L) + slideP(L) ? 'slide' : 'still';
    if (kind !== 'crumble') r.lastSafeY = y;
    const x = w / 2 + r.rnd() * (WORLD_W - w);
    const spring = kind === 'still' && r.rnd() < 0.07;
    const jet = kind === 'still' && !spring && r.rnd() < 0.012 && y > 600;
    r.platforms.push({ x, y, w, kind, range: kind === 'slide' ? 40 + r.rnd() * 70 : 0, phase: r.rnd() * 6.28, spring, jet, broken: 0, homeX: x });
    r.topY = y;
  }
}
const wrapDx = (a: number, b: number): number => {
  let d = a - b;
  if (d > WORLD_W / 2) d -= WORLD_W;
  if (d < -WORLD_W / 2) d += WORLD_W;
  return d;
};
export interface Steer {
  /** −1…1 from a key or a stick. */
  ax: number;
  /** Where a finger is (world x), or null. */
  aim: number | null;
}
export function step(r: Run, dt: number, s: Steer): void {
  r.t += dt;
  if (r.dead) {
    r.deadT += dt;
    r.vy -= GRAV * dt;
    r.y += r.vy * dt;
    return;
  }
  const wind = windOf(r.level) * Math.sin(r.t * 0.8);
  const want = s.aim !== null ? Math.max(-420, Math.min(420, wrapDx(s.aim, r.x) * 7)) : s.ax * 400;
  r.vx += (want + wind - r.vx) * Math.min(1, dt * 10);
  if (Math.abs(r.vx) > 20) r.face = r.vx > 0 ? 1 : -1;
  r.x = (((r.x + r.vx * dt) % WORLD_W) + WORLD_W) % WORLD_W;
  const prevY = r.y;
  if (r.jetT > 0) {
    r.jetT -= dt;
    r.vy = JET_V;
  } else r.vy -= GRAV * dt;
  r.y += r.vy * dt;
  for (const p of r.platforms) {
    if (p.kind === 'slide') p.x = p.homeX + Math.sin(r.t * (slideSpeed(r.level) / Math.max(30, p.range)) + p.phase) * p.range;
    if (p.broken > 0) {
      p.broken += dt;
      p.y -= 500 * p.broken * dt;
      continue;
    }
    if (r.vy <= 0 && prevY >= p.y && r.y <= p.y && Math.abs(wrapDx(r.x, p.x)) <= p.w / 2 + 9) {
      r.y = p.y;
      if (p.spring) (r.vy = SPRING_V), r.events.push({ type: 'spring' });
      else (r.vy = BOUNCE_V), r.events.push({ type: 'bounce' });
      if (p.jet) (r.jetT = 1.7), (p.jet = false), r.events.push({ type: 'jet' });
      if (p.kind === 'crumble') (p.broken = 0.001), r.events.push({ type: 'crumble' });
    }
  }
  r.best = Math.max(r.best, r.y);
  const m = Math.floor(r.best / PX_PER_M / 100);
  if (m > r.milestone) (r.milestone = m), r.events.push({ type: 'milestone', n: m * 100 });
  r.cam = Math.max(r.cam, r.y - 300);
  if (r.platforms.length > 80) r.platforms = r.platforms.filter((p) => p.y > r.cam - 200 && p.broken < 2);
  fill(r);
  if (r.calm && r.y < r.cam + 10) {
    r.y = r.cam + 10;
    r.vy = BOUNCE_V;
  }
  if (r.y < r.cam - 30) {
    r.dead = true;
    r.vy = 0;
    r.events.push({ type: 'die' });
  }
}
export const heightOf = (r: Run): number => Math.floor(r.best / PX_PER_M);

/**
 * Ghosty's steering: of the platforms he can still land on (below the top of this bounce, and near enough to reach
 * sideways in the time it takes to come down onto them), head for the highest, less its distance and a penalty for kind.
 */
export function botSteer(r: Run, th: readonly number[]): Steer {
  const apex = r.y + (r.vy > 0 ? (r.vy * r.vy) / (2 * GRAV) : 0);
  let best: Platform | null = null;
  let bv = -Infinity;
  for (const p of r.platforms) {
    if (p.broken > 0 || p.y > apex - 4 || p.y < r.y - 380) continue;
    const t = (r.vy + Math.sqrt(Math.max(0, r.vy * r.vy + 2 * GRAV * (r.y - p.y)))) / GRAV;
    const dx = Math.abs(wrapDx(p.x, r.x));
    if (dx > 340 * t + p.w / 2) continue;
    const v = p.y - dx * (th[0] ?? 0.4) - (p.kind === 'crumble' ? (th[1] ?? 100) : 0) - (p.kind === 'slide' ? (th[2] ?? 10) : 0) + (p.spring ? 40 : 0);
    if (v > bv) {
      bv = v;
      best = p;
    }
  }
  return { ax: 0, aim: best ? best.x : null };
}
export function botStep(r: Run, th: readonly number[], dt: number): void {
  void dt;
  (r as Run & { botAim?: Steer }).botAim = botSteer(r, th);
}
export const aimOf = (r: Run): Steer => (r as Run & { botAim?: Steer }).botAim ?? { ax: 0, aim: null };

// ---------------------------------------------------------------- the GYM's way in

export interface ClimbObs {
  x: number;
  y: number;
  vy: number;
  /** The nearest platforms above and below: [dx, dy, width, kind 0/1/2]. */
  near: number[][];
  height: number;
}
export const CLIMB_ACTIONS = ['none', 'left', 'right'] as const;
export function climbLearnable(seed = 1, level = 1): Learnable<ClimbObs, 'none' | 'left' | 'right'> & { run: Run } {
  const run = newRun(seed, level);
  return {
    run,
    id: 'climb',
    actions: CLIMB_ACTIONS,
    observe: () => ({ x: run.x, y: run.y - run.cam, vy: run.vy, near: run.platforms.filter((p) => Math.abs(p.y - run.y) < 300 && p.broken === 0).slice(0, 8).map((p) => [wrapDx(p.x, run.x), p.y - run.y, p.w, p.kind === 'still' ? 0 : p.kind === 'slide' ? 1 : 2]), height: heightOf(run) }),
    act(a) {
      step(run, 1 / 60, { ax: a === 'left' ? -1 : a === 'right' ? 1 : 0, aim: null });
      run.events.length = 0;
    },
    score: () => heightOf(run),
    done: () => run.dead,
  };
}
