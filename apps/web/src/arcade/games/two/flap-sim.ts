/**
 * THE FLAP's rules, with no drawing in them: Flappy mechanics. A ghost falls under gravity and a tap flaps it up; pillars
 * come in from the right with a gap to pass through; each pillar passed is a point; a pillar, the ground or (from the
 * first flap) a missed gap ends the run. A level sets the speed (rising without end), how narrow the gap is (to a floor),
 * how far the next gap can be from the last (always within what the ghost can reach in the time between them), from
 * level 4 gaps that slide up and down, and from level 8 a gusting wind. Ghosty plays it with a flap rule whose two weights
 * he tunes. The engine draws it; the node test plays it; the GYM can learn it through `flapLearnable`.
 */
import type { Learnable } from '../../learnable';
import { fall, intensity, rise } from './skill';

export const WORLD_W = 360;
export const WORLD_H = 640;
export const BIRD_X = 96;
export const BIRD_R = 13;
export const GROUND = 56;
export const PILLAR_W = 58;
export const SPACING = 210;
const GRAV = 1400;
const FLAP_V = -430;

export interface Pillar {
  x: number;
  /** The gap's centre and the slide's phase. */
  cy: number;
  phase: number;
  passed: boolean;
  amp: number;
}
export type FlapEvent = { type: 'flap' | 'start' } | { type: 'pass'; n: number } | { type: 'die'; how: 'pillar' | 'ground' };
export interface Run {
  seed: number;
  level: number;
  rnd: () => number;
  t: number;
  y: number;
  vy: number;
  started: boolean;
  dead: boolean;
  how: 'pillar' | 'ground' | null;
  pillars: Pillar[];
  nextX: number;
  lastCy: number;
  score: number;
  events: FlapEvent[];
  /** The bird's tilt for the drawing. */
  tilt: number;
  flapCool: number;
  /** Distance scrolled (for the background). */
  dist: number;
  deadT: number;
  /** A spec's switch: the ghost cannot die (it rests on the ground). */
  calm: boolean;
}

/** What a level asks: all rising (or closing to a floor) with the level, none with a ceiling. */
export const speedOf = (level: number): number => rise(level, 130, 34, 5);
export const gapOf = (level: number): number => fall(level, 184, 16, 112, 4);
export const slideAmp = (level: number): number => (level < 4 ? 0 : Math.min(64, rise(level - 3, 12, 14, 3)));
export const slideRate = (level: number): number => (level < 4 ? 0 : Math.min(rise(level - 3, 1.1, 0.5, 4), 300 / Math.max(1, slideAmp(level))));
export const windOf = (level: number): number => (level < 8 ? 0 : Math.min(640, rise(level - 7, 140, 90, 4)));
export const targetOf = (level: number): number => Math.round(rise(level, 8, 4, 3));
/** One number for the level's hardness: strictly increasing at every level (the speed alone never stops rising). */
export const hardness = (level: number): number => intensity(level, [speedOf(level) / 100, (184 - gapOf(level)) / 20, slideAmp(level) / 20, windOf(level) / 100]);
/** How far (px) the next gap may lie from the last: what the ghost can climb or fall in the time between pillars. */
export const reachOf = (level: number): number => Math.max(50, Math.min(190, 40 + 140 * (SPACING / speedOf(level))));

const mk = (seed: number): (() => number) => {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};
export const THETA0: readonly number[] = [34, 0.05];
export const SIGMA: readonly number[] = [8, 0.02];

export function newRun(seed: number, level: number): Run {
  const rnd = mk(seed);
  const r: Run = { seed, level, rnd, t: 0, y: 300, vy: 0, started: false, dead: false, how: null, pillars: [], nextX: WORLD_W + 120, lastCy: 300, score: 0, events: [], tilt: 0, flapCool: 0, dist: 0, deadT: 0, calm: false };
  return r;
}
/** The gap's centre now (it slides from level 4). */
export const centreOf = (p: Pillar, t: number, level: number): number => p.cy + p.amp * Math.sin(p.phase + t * slideRate(level));
function addPillar(r: Run): void {
  const gap = gapOf(r.level);
  const amp = slideAmp(r.level);
  const half = gap / 2 + amp + 36;
  const lo = half;
  const hi = WORLD_H - GROUND - half;
  const want = r.lastCy + (r.rnd() * 2 - 1) * reachOf(r.level);
  const cy = lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, want));
  r.pillars.push({ x: r.nextX, cy, phase: r.rnd() * 6.28, passed: false, amp });
  r.lastCy = cy;
  r.nextX += SPACING;
}
export function flap(r: Run): void {
  if (r.dead) return;
  if (!r.started) {
    r.started = true;
    r.events.push({ type: 'start' });
  }
  r.vy = FLAP_V;
  r.flapCool = 0.1;
  r.events.push({ type: 'flap' });
}
export function step(r: Run, dt: number, pressed: boolean): void {
  r.t += dt;
  r.flapCool = Math.max(0, r.flapCool - dt);
  if (r.dead) {
    r.deadT += dt;
    if (r.y < WORLD_H - GROUND - BIRD_R) {
      r.vy += GRAV * dt;
      r.y = Math.min(WORLD_H - GROUND - BIRD_R, r.y + r.vy * dt);
    }
    r.tilt = Math.min(1.4, r.tilt + dt * 4);
    return;
  }
  if (pressed) flap(r);
  if (!r.started) {
    r.y = 300 + Math.sin(r.t * 4) * 8;
    return;
  }
  const sp = speedOf(r.level);
  const wind = windOf(r.level);
  r.vy += (GRAV + wind * Math.sin(r.t * 0.9) * 0.6) * dt;
  r.y += r.vy * dt;
  r.tilt = Math.max(-0.5, Math.min(1.2, r.vy / 600));
  r.dist += sp * dt;
  for (const p of r.pillars) p.x -= sp * dt;
  r.nextX -= sp * dt;
  while (r.nextX < WORLD_W + 80 || r.pillars.length < 3) addPillar(r);
  while (r.pillars.length && r.pillars[0]!.x < -PILLAR_W - 20) r.pillars.shift();
  if (r.y < BIRD_R) {
    r.y = BIRD_R;
    r.vy = Math.max(0, r.vy);
  }
  if (r.y > WORLD_H - GROUND - BIRD_R) return die(r, 'ground');
  const gap = gapOf(r.level);
  for (const p of r.pillars) {
    if (!p.passed && p.x + PILLAR_W < BIRD_X - BIRD_R) {
      p.passed = true;
      r.score++;
      r.events.push({ type: 'pass', n: r.score });
    }
    if (BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PILLAR_W) {
      const c = centreOf(p, r.t, r.level);
      if (r.y - BIRD_R < c - gap / 2 || r.y + BIRD_R > c + gap / 2) return die(r, 'pillar');
    }
  }
}
function die(r: Run, how: 'pillar' | 'ground'): void {
  if (r.calm) {
    r.y = Math.min(r.y, WORLD_H - GROUND - BIRD_R);
    r.vy = 0;
    return;
  }
  r.dead = true;
  r.how = how;
  r.vy = Math.min(r.vy, 0) - 80;
  r.events.push({ type: 'die', how });
}

/** Ghosty's flap rule: flap when where the ghost will be in a moment is below the gap's centre (plus a margin). */
export function botStep(r: Run, th: readonly number[]): boolean {
  if (r.dead) return false;
  if (!r.started) {
    flap(r);
    return true;
  }
  const p = r.pillars.find((q) => q.x + PILLAR_W > BIRD_X - BIRD_R - 2);
  const target = p ? centreOf(p, r.t, r.level) + (th[0] ?? 0) : 300;
  if (r.y + r.vy * (th[1] ?? 0.12) > target && r.flapCool <= 0) {
    flap(r);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- the GYM's way in

export interface FlapObs {
  y: number;
  vy: number;
  gapCentre: number;
  gapDx: number;
  nextCentre: number;
  speed: number;
  gap: number;
  score: number;
}
export const FLAP_ACTIONS = ['none', 'flap'] as const;
export function flapLearnable(seed = 1, level = 1): Learnable<FlapObs, 'none' | 'flap'> & { run: Run } {
  const run = newRun(seed, level);
  return {
    run,
    id: 'flap',
    actions: FLAP_ACTIONS,
    observe: () => {
      const ps = run.pillars.filter((q) => q.x + PILLAR_W > BIRD_X - BIRD_R);
      const a = ps[0], b = ps[1];
      return { y: run.y, vy: run.vy, gapCentre: a ? centreOf(a, run.t, run.level) : 300, gapDx: a ? a.x - BIRD_X : 400, nextCentre: b ? centreOf(b, run.t, run.level) : 300, speed: speedOf(run.level), gap: gapOf(run.level), score: run.score };
    },
    act(a) {
      step(run, 1 / 60, a === 'flap');
      run.events.length = 0;
    },
    score: () => run.score,
    done: () => run.dead,
  };
}
