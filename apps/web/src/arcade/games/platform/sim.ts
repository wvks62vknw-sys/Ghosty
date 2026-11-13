/**
 * THE PLATFORMER's rules, with no drawing in them. A run is one of the eight levels (the level of the measure picks it, and
 * every eight levels the same eight come round again: faster walkers, more of them, less time). The jump is the point: coyote
 * time 80 ms, a jump buffer of 100 ms, a rise cut short when the button is let go, a cap on the fall, a squash on landing.
 * A stomp, a one-hit power (bigger, breaks crates, lost on a hit), a shell that is kicked, springs, falling blocks, moving
 * platforms, three lives, a flag in the middle and one at the end, a timer. Ghosty plays it with a bot whose three weights
 * he tunes. The engine draws it; the node test plays it; the GYM can learn it through `platformLearnable`.
 */
import type { Learnable } from '../../learnable';
import { fall, intensity, rise, rng } from '../two/skill';
import { type Body, body, FEEL, moveBody, overlaps, TS, toward } from './core';
import { build, GROUND, LEVELS, ROWS, type Theme } from './levels';

export const VIEW_W = 14;
export const SIGMA: readonly number[] = [6, 12, 0.4];
export const THETA0: readonly number[] = [10, 26, -0.2];
export const LIVES = 3;

export type Kind = 'walker' | 'hopper' | 'flyer' | 'shell';
export interface Enemy extends Body {
  kind: Kind;
  dir: number;
  alive: boolean;
  state: 'walk' | 'still' | 'kicked';
  t: number;
  hx: number;
  hy: number;
  hop: number;
  die: number;
  grace: number;
}
export interface Mover {
  x: number;
  y: number;
  w: number;
  h: number;
  x0: number;
  dx: number;
  ph: number;
}
export interface Drop {
  x: number;
  y: number;
  w: number;
  h: number;
  state: 0 | 1 | 2;
  t: number;
  vy: number;
}
export interface Fruit extends Body {
  alive: boolean;
}
export interface Player extends Body {
  big: boolean;
  face: number;
  coyote: number;
  buffer: number;
  cut: boolean;
  /** Squash and stretch for the drawing: positive squashed wide (just landed), negative stretched tall (rising). */
  sq: number;
  inv: number;
  springCool: number;
  dead: boolean;
  anim: number;
}
export interface Cmd {
  left: boolean;
  right: boolean;
  jump: boolean;
  jumpPressed: boolean;
  run: boolean;
}
export type PlatEvent = { type: string; x?: number; y?: number; n?: number; kind?: string };

export interface Run {
  seed: number;
  level: number;
  idx: number;
  lap: number;
  name: string;
  theme: Theme;
  tiles: string[][];
  W: number;
  starts: number[];
  startX: number;
  checkX: number;
  flagX: number;
  rnd: () => number;
  p: Player;
  enemies: Enemy[];
  movers: Mover[];
  drops: Drop[];
  fruits: Fruit[];
  t: number;
  limit: number;
  timeLeft: number;
  coins: number;
  stomps: number;
  crates: number;
  lives: number;
  checked: boolean;
  maxX: number;
  won: boolean;
  wonT: number;
  deadT: number;
  out: boolean;
  events: PlatEvent[];
  cmd: Cmd;
  bot: boolean;
  botHold: number;
  camX: number;
  /** A spec's switch: nothing hurts. */
  calm: boolean;
  /** The ground the player rides (a moving platform or a falling block). */
  ride: Mover | Drop | null;
  /** The path of this run, a point every sixth of a second, for a ghost. */
  path: number[];
}

// ---------------------------------------------------------------- what a level asks (all rising or closing to a floor, none with a ceiling on the measure)
export const idxOf = (level: number): number => (Math.max(1, Math.floor(level)) - 1) % LEVELS.length;
export const lapOf = (level: number): number => Math.floor((Math.max(1, Math.floor(level)) - 1) / LEVELS.length);
export const enemySpeed = (level: number): number => 1 + Math.min(1.4, 0.09 * lapOf(level));
export const extraOf = (level: number): number => Math.min(0.9, 0.22 * lapOf(level));
export const timeOf = (level: number): number => Math.round(fall(lapOf(level) + 1, 140, 16, 55, 2));
/** One number for how hard a level is, strictly increasing at every level (the speed and the time meet their limits; the crowd and the level itself do not). */
export const hardness = (level: number): number => intensity(level, [idxOf(level) * 0.6, lapOf(level) * 6, (enemySpeed(level) - 1) * 4, (140 - timeOf(level)) / 20, extraOf(level) * 5]);
export const targetOf = (level: number): number => {
  const { width } = build(LEVELS[idxOf(level)]!);
  return Math.round(width + 300 + rise(lapOf(level) + 1, 0, 40, 3));
};

export const SOLID = '#pBPU';
const isSolid = (r: Run, tx: number, ty: number): boolean => (tx < 0 ? true : ty < 0 || ty >= ROWS || tx >= r.W ? tx >= r.W : SOLID.includes(r.tiles[ty]![tx]!));
export const tileAt = (r: Run, tx: number, ty: number): string => (tx < 0 || tx >= r.W || ty < 0 || ty >= ROWS ? '.' : r.tiles[ty]![tx]!);

const SIZE: Record<Kind, [number, number]> = { walker: [12, 12], hopper: [12, 12], flyer: [14, 10], shell: [12, 12] };
const mkEnemy = (kind: Kind, tx: number, ty: number, dir: number): Enemy => {
  const [w, h] = SIZE[kind];
  const b = body(tx * TS + (TS - w) / 2, ty * TS + (TS - h), w, h);
  return { ...b, kind, dir, alive: true, state: 'walk', t: 0, hx: b.x, hy: b.y, hop: 0.6, die: 0, grace: 0 };
};

const NOCMD = (): Cmd => ({ left: false, right: false, jump: false, jumpPressed: false, run: false });

export function newRun(seed: number, level: number): Run {
  const idx = idxOf(level);
  const lap = lapOf(level);
  const def = LEVELS[idx]!;
  const { rows, starts, width } = build(def);
  const rnd = rng(seed);
  const tiles = rows.map((r) => r.split(''));
  const enemies: Enemy[] = [];
  const movers: Mover[] = [];
  const drops: Drop[] = [];
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < width; x++) {
      const c = tiles[y]![x]!;
      if (c === 'w' || c === 'h' || c === 'f' || c === 's') {
        enemies.push(mkEnemy(({ w: 'walker', h: 'hopper', f: 'flyer', s: 'shell' } as const)[c], x, y, rnd() < 0.5 ? -1 : 1));
        tiles[y]![x] = '.';
      } else if (c === 'M') {
        movers.push({ x: x * TS, y: y * TS, w: 3 * TS, h: 8, x0: x * TS, dx: 0, ph: rnd() * 6 });
        tiles[y]![x] = '.';
      } else if (c === 'F') {
        drops.push({ x: x * TS, y: y * TS, w: TS, h: TS, state: 0, t: 0, vy: 0 });
        tiles[y]![x] = '.';
      }
    }
  // a lap on, a crowd: more walkers on the open ground, from a seed so the same level is the same crowd
  const more = extraOf(level);
  if (more > 0)
    starts.forEach((s0, i) => {
      if (i === 0 || i === starts.length - 1) return;
      const w = (starts[i + 1] ?? width) - s0;
      if (rnd() >= more) return;
      const tx = s0 + 2 + Math.floor(rnd() * (w - 4));
      if (isSolidTile(tiles, tx, GROUND) && !tiles[9]![tx]!.match(/[#pBPU^]/)) enemies.push(mkEnemy('walker', tx, 9, 1));
    });
  const mid = starts[Math.floor(starts.length / 2)]!;
  const startX = 2 * TS;
  const limit = timeOf(level);
  const p: Player = { ...body(startX, GROUND * TS - 14, 10, 14), big: false, face: 1, coyote: 0, buffer: 0, cut: false, sq: 0, inv: 0, springCool: 0, dead: false, anim: 0 };
  return { seed, level, idx, lap, name: def.name, theme: def.theme, tiles, W: width, starts, startX, checkX: mid * TS + 8, flagX: (width - 4) * TS, rnd, p, enemies, movers, drops, fruits: [], t: 0, limit, timeLeft: limit, coins: 0, stomps: 0, crates: 0, lives: LIVES, checked: false, maxX: startX, won: false, wonT: 0, deadT: 0, out: false, events: [], cmd: NOCMD(), bot: false, botHold: 0, camX: 0, calm: false, ride: null, path: [] };
}
const isSolidTile = (tiles: string[][], tx: number, ty: number): boolean => ty >= 0 && ty < ROWS && tx >= 0 && tx < tiles[0]!.length && SOLID.includes(tiles[ty]![tx]!);

const ev = (r: Run, type: string, extra: Omit<PlatEvent, 'type'> = {}): void => void r.events.push({ type, ...extra });

export function score(r: Run): number {
  return Math.floor(r.maxX / TS) + r.coins * 10 + r.stomps * 20 + r.crates * 5 + (r.won ? 300 + Math.floor(r.timeLeft) * 2 : 0);
}
export const isOver = (r: Run): boolean => r.out || (r.won && r.wonT > 1.4);

function grow(r: Run, big: boolean): void {
  const p = r.p;
  if (p.big === big) return;
  const foot = p.y + p.h;
  p.big = big;
  p.h = big ? 24 : 14;
  p.y = foot - p.h;
}

function hurt(r: Run): void {
  const p = r.p;
  if (r.calm || p.dead || p.inv > 0 || r.won) return;
  if (p.big) {
    grow(r, false);
    p.inv = 1.6;
    ev(r, 'hurt', { x: p.x, y: p.y });
    return;
  }
  lose(r);
}
function lose(r: Run): void {
  const p = r.p;
  if (p.dead) return;
  p.dead = true;
  r.deadT = 0;
  r.lives--;
  p.vy = -260;
  p.vx = 0;
  ev(r, 'die', { x: p.x, y: p.y, n: r.lives });
}
function respawn(r: Run): void {
  const p = r.p;
  const x = r.checked ? r.checkX : r.startX;
  grow(r, false);
  p.x = x;
  p.y = GROUND * TS - p.h;
  p.vx = 0;
  p.vy = 0;
  p.dead = false;
  p.inv = 1.4;
  r.timeLeft = Math.max(r.timeLeft, r.limit * 0.4);
  for (const e of r.enemies) if (e.alive && Math.abs(e.x - x) < 56) e.x += 96 * Math.sign(e.x - x || 1);
  ev(r, 'respawn', { x, y: p.y });
}

/** Whether the ground is under the point (a tile, a ledge a platform carries). */
const standing = (r: Run, b: Body): boolean => {
  const row = Math.floor((b.y + b.h + 0.5) / TS);
  for (let tx = Math.floor(b.x / TS); tx <= Math.floor((b.x + b.w - 1e-3) / TS); tx++) if (isSolid(r, tx, row)) return true;
  return false;
};

function stepEnemy(r: Run, e: Enemy, dt: number): void {
  const k = enemySpeed(r.level);
  e.t += dt;
  e.grace = Math.max(0, e.grace - dt);
  if (e.kind === 'flyer') {
    e.x = e.hx + Math.sin(e.t * 0.9 * k) * 40;
    e.y = e.hy + Math.sin(e.t * 2.2) * 8;
    e.dir = Math.cos(e.t * 0.9 * k) > 0 ? 1 : -1;
    return;
  }
  e.vy = Math.min(FEEL.fall, e.vy + FEEL.gravity * dt);
  if (e.kind === 'hopper') {
    e.vx = 0;
    if (e.onGround) {
      e.hop -= dt;
      if (e.hop <= 0) {
        const dx = r.p.x - e.x;
        e.dir = dx < 0 ? -1 : 1;
        e.vx = Math.abs(dx) < 120 ? e.dir * 46 * k : 0;
        e.vy = -210;
        e.hop = 1.1 / k;
      }
    } else e.vx = e.dir * (Math.abs(r.p.x - e.x) < 120 ? 46 * k : 0);
  } else if (e.state === 'still') e.vx = 0;
  else e.vx = e.dir * (e.state === 'kicked' ? 170 : e.kind === 'shell' ? 26 : 30) * (e.state === 'kicked' ? 1 : k);
  const wasOn = e.onGround;
  moveBody(e, dt, (tx, ty) => isSolid(r, tx, ty));
  if (e.wall) e.dir = -e.dir;
  else if (e.kind !== 'hopper' && e.state !== 'kicked' && (wasOn || e.onGround) && e.onGround) {
    // turn at an edge: no ground under the front foot
    const fx = e.x + (e.dir > 0 ? e.w + 2 : -2);
    if (!isSolid(r, Math.floor(fx / TS), Math.floor((e.y + e.h + 2) / TS))) e.dir = -e.dir;
  }
  if (e.y > ROWS * TS + 40) e.alive = false;
}

/** One fixed step. `c` is what the player does (the bot's own `r.cmd` when `r.bot`). */
export function step(r: Run, dt: number, input: Cmd): void {
  const p = r.p;
  r.t += dt;
  p.anim += dt;
  p.sq *= 0.86;
  p.inv = Math.max(0, p.inv - dt);
  p.springCool = Math.max(0, p.springCool - dt);
  const c = r.bot ? r.cmd : input;
  if (r.t - (r.path.length / 3) * (1 / 6) >= 1 / 6) r.path.push(Math.round(p.x), Math.round(p.y), p.face);
  // the world moves on its own
  for (const m of r.movers) {
    const nx = m.x0 + Math.sin(r.t * 0.9 + m.ph) * 28;
    m.dx = nx - m.x;
    m.x = nx;
  }
  for (const d of r.drops) {
    if (d.state === 1 && (d.t -= dt) <= 0) d.state = 2;
    else if (d.state === 2) {
      d.vy = Math.min(FEEL.fall, d.vy + FEEL.gravity * dt);
      d.y += d.vy * dt;
    }
  }
  if (r.won) {
    r.wonT += dt;
    p.vx = toward(p.vx, 70, 6);
    p.vy = Math.min(FEEL.fall, p.vy + FEEL.gravity * dt);
    moveBody(p, dt, (tx, ty) => isSolid(r, tx, ty));
    p.face = 1;
    return;
  }
  if (p.dead) {
    r.deadT += dt;
    p.vy = Math.min(FEEL.fall, p.vy + FEEL.gravity * dt);
    p.y += p.vy * dt;
    if (r.deadT > 0.9) {
      if (r.lives > 0) respawn(r);
      else r.out = true;
    }
    return;
  }
  if ((r.timeLeft -= dt) <= 0) {
    r.timeLeft = r.limit * 0.4;
    ev(r, 'time');
    lose(r);
    return;
  }
  // ---- the feel of the jump
  if (r.ride) {
    p.x += 'dx' in r.ride ? r.ride.dx : 0;
  }
  const want = (c.right ? 1 : 0) - (c.left ? 1 : 0);
  const top = c.run ? FEEL.run : FEEL.walk;
  const a = (p.onGround ? FEEL.accelGround : FEEL.accelAir) * dt * 60;
  p.vx = want ? toward(p.vx, want * top, a) : toward(p.vx, 0, (p.onGround ? FEEL.accelGround : FEEL.accelAir * 0.5) * dt * 60);
  if (want) p.face = want;
  p.coyote = p.onGround ? FEEL.coyote : Math.max(0, p.coyote - dt);
  p.buffer = c.jumpPressed ? FEEL.buffer : Math.max(0, p.buffer - dt);
  if (p.buffer > 0 && p.coyote > 0) {
    p.vy = -FEEL.jump;
    p.buffer = 0;
    p.coyote = 0;
    p.cut = false;
    p.sq = -0.35;
    p.onGround = false;
    r.ride = null;
    ev(r, 'jump', { x: p.x, y: p.y + p.h });
  }
  if (!c.jump && p.vy < 0 && !p.cut) {
    p.vy *= FEEL.cut;
    p.cut = true;
  }
  p.vy = Math.min(FEEL.fall, p.vy + FEEL.gravity * dt);
  const prevBottom = p.y + p.h;
  const vy0 = p.vy;
  const wasAir = !p.onGround;
  moveBody(p, dt, (tx, ty) => isSolid(r, tx, ty));
  // a head against a crate
  for (const [tx, ty] of p.bumped) {
    const t = tileAt(r, tx, ty);
    if (t === 'B') {
      if (p.big) {
        r.tiles[ty]![tx] = '.';
        r.crates++;
        ev(r, 'crate', { x: tx * TS, y: ty * TS, kind: 'break' });
      } else {
        r.tiles[ty]![tx] = 'U';
        r.coins++;
        r.crates++;
        ev(r, 'coin', { x: tx * TS, y: ty * TS });
        ev(r, 'crate', { x: tx * TS, y: ty * TS, kind: 'bump' });
      }
    } else if (t === 'P') {
      r.tiles[ty]![tx] = 'U';
      const f: Fruit = { ...body(tx * TS + 2, (ty - 1) * TS + 2, 12, 12), alive: true };
      f.vx = 40;
      r.fruits.push(f);
      ev(r, 'crate', { x: tx * TS, y: ty * TS, kind: 'fruit' });
    } else if (t === 'U') ev(r, 'crate', { x: tx * TS, y: ty * TS, kind: 'thud' });
  }
  // platforms that carry: a moving one, a falling block (landing on top only)
  r.ride = null;
  for (const pl of [...r.movers, ...r.drops]) {
    if (pl === undefined || ('state' in pl && pl.state === 2 && pl.y > ROWS * TS)) continue;
    const overX = p.x + p.w > pl.x + 1 && p.x < pl.x + pl.w - 1;
    if (overX && vy0 >= 0 && prevBottom <= pl.y + 2 && p.y + p.h >= pl.y) {
      p.y = pl.y - p.h;
      p.vy = 0;
      p.onGround = true;
      r.ride = pl;
      if ('state' in pl && pl.state === 0) (pl.state = 1), (pl.t = 0.45), ev(r, 'rumble', { x: pl.x, y: pl.y });
    }
  }
  if (p.onGround && wasAir && vy0 > 120) {
    p.sq = Math.min(0.5, 0.15 + vy0 / 1200);
    ev(r, 'land', { x: p.x, y: p.y + p.h, n: vy0 });
  }
  if (p.onGround) p.cut = false;
  // coins, springs
  const x0 = Math.floor(p.x / TS);
  const x1 = Math.floor((p.x + p.w - 1e-3) / TS);
  const y0 = Math.floor(p.y / TS);
  const y1 = Math.floor((p.y + p.h - 1e-3) / TS);
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++) {
      const t = tileAt(r, tx, ty);
      if (t === 'o') {
        r.tiles[ty]![tx] = '.';
        r.coins++;
        ev(r, 'coin', { x: tx * TS, y: ty * TS, n: r.coins });
      } else if (t === '^' && p.springCool <= 0 && p.y + p.h > ty * TS + 6) {
        p.vy = c.jump ? -FEEL.jump * 1.62 : -FEEL.jump * 1.3;
        p.cut = true;
        p.springCool = 0.4;
        p.sq = -0.5;
        ev(r, 'spring', { x: tx * TS, y: ty * TS });
      }
    }
  // the fruit that makes him bigger
  for (const f of r.fruits) {
    if (!f.alive) continue;
    f.vy = Math.min(FEEL.fall, f.vy + FEEL.gravity * dt);
    moveBody(f, dt, (tx, ty) => isSolid(r, tx, ty));
    if (f.wall) f.vx = -f.vx;
    if (f.y > ROWS * TS) f.alive = false;
    if (overlaps(p, f)) {
      f.alive = false;
      if (!p.big) grow(r, true);
      r.coins += 0;
      ev(r, 'power', { x: f.x, y: f.y });
    }
  }
  // the creatures
  const near = (e: Enemy) => Math.abs(e.x - p.x) < VIEW_W * TS + 90;
  for (const e of r.enemies) {
    if (!e.alive) {
      e.die += dt;
      continue;
    }
    if (!near(e)) continue;
    stepEnemy(r, e, dt);
    if (e.kind === 'shell' && e.state === 'kicked')
      for (const o of r.enemies) if (o !== e && o.alive && overlaps(e, o)) ((o.alive = false), (r.stomps += 0), ev(r, 'kill', { x: o.x, y: o.y }));
  }
  for (const e of r.enemies) {
    if (!e.alive || !overlaps({ x: p.x + 1, y: p.y + 1, w: p.w - 2, h: p.h - 2 }, e)) continue;
    const above = vy0 > 0 && prevBottom <= e.y + 6;
    const mid = p.x + p.w / 2 < e.x + e.w / 2 ? -1 : 1;
    if (e.kind === 'shell' && e.state === 'still') {
      e.state = 'kicked';
      e.dir = -mid;
      e.grace = 0.35;
      if (above) p.vy = c.jump ? -300 : -200;
      ev(r, 'kick', { x: e.x, y: e.y });
    } else if (above) {
      p.vy = c.jump ? -310 : -210;
      p.cut = false;
      r.stomps++;
      if (e.kind === 'shell') {
        e.state = 'still';
      } else e.alive = false;
      ev(r, 'stomp', { x: e.x, y: e.y, kind: e.kind });
    } else if (!(e.kind === 'shell' && e.state === 'kicked' && e.grace > 0)) hurt(r);
  }
  // ---- the way on, the flags, a fall
  r.maxX = Math.max(r.maxX, p.x);
  if (!r.checked && p.x + p.w / 2 >= r.checkX) {
    r.checked = true;
    ev(r, 'checkpoint', { x: r.checkX, y: GROUND * TS });
  }
  if (p.x + p.w / 2 >= r.flagX) {
    r.won = true;
    r.wonT = 0;
    ev(r, 'flag', { x: r.flagX, y: GROUND * TS, n: Math.round(r.timeLeft) });
  }
  if (p.y > ROWS * TS + 24) lose(r);
  const want0 = p.x - 5 * TS;
  r.camX += (Math.max(0, Math.min(r.W * TS - VIEW_W * TS, want0)) - r.camX) * Math.min(1, dt * 9);
}

// ---------------------------------------------------------------- Ghosty's hands

/**
 * A STOMP WHEN A STOMP IS THE SHORTEST WAY: a walker on the open floor ahead, with nothing else in the way (no pit, no wall, no
 * second creature close behind it), is jumped at from the distance at which the jump comes down on it (a jump takes about
 * two thirds of a second, and he closes on it at his run speed plus its own walk), not from the few pixels at which he would
 * go over it. The early distance is only used when the floor under the whole jump is there.
 */
const STOMP_LAG = 0.57;
function stompNow(r: Run, e: Enemy, dx: number, groundAhead: (dx: number) => boolean): boolean {
  const p = r.p;
  if (Math.abs(e.y - (p.y + p.h - e.h)) > 6 || !e.onGround) return false;
  const mine = p.vx + (FEEL.run - p.vx) * 0.8;
  const closing = Math.max(60, mine - (Number.isFinite(e.vx) ? e.vx : 0));
  const reach = closing * STOMP_LAG;
  if (dx < 0 || dx > reach) return false;
  const frontX = p.x + p.w;
  const feet = Math.floor((p.y + p.h - 1) / TS);
  for (let k = 0; k <= reach + 150; k += 14) {
    if (!groundAhead(k)) return false;
    const tx = Math.floor((frontX + k) / TS);
    if (isSolid(r, tx, feet) || isSolid(r, tx, feet - 1)) return false;
  }
  for (const o of r.enemies) if (o !== e && o.alive && o.x > frontX - 10 && o.x < e.x + 70) return false;
  return true;
}

/**
 * Ghosty's rule: always on the way right; jump a pit when its edge is `th[0]` pixels off, jump a creature that is `th[1]`
 * pixels ahead (a stomp when it comes), and run when `th[2]` is above zero (a slower walk is steadier and a run clears the wide pits).
 */
export function botStep(r: Run, th: readonly number[]): void {
  const p = r.p;
  r.bot = true;
  const c = r.cmd;
  c.left = false;
  c.right = true;
  c.run = (th[2] ?? 0) > 0 || p.onGround === false || !r.enemies.some((e) => e.alive && e.x > p.x && e.x - p.x < 70);
  c.jumpPressed = false;
  const d0 = Math.max(2, th[0] ?? 10);
  const d1 = Math.max(10, th[1] ?? 40);
  const feet = Math.floor((p.y + p.h - 1) / TS);
  const frontX = p.x + p.w;
  const groundAhead = (dx: number): boolean => {
    const tx = Math.floor((frontX + dx) / TS);
    for (let ty = feet; ty <= feet + 2; ty++) if (isSolid(r, tx, ty)) return true;
    return r.movers.some((m) => frontX + dx > m.x && frontX + dx < m.x + m.w) || r.drops.some((d) => frontX + dx > d.x && frontX + dx < d.x + d.w && d.state !== 2);
  };
  let want = false;
  if (p.onGround) {
    if (!groundAhead(d0)) want = true;
    if (isSolid(r, Math.floor((frontX + 3) / TS), feet) || isSolid(r, Math.floor((frontX + 3) / TS), feet - 1)) want = true;
    for (const e of r.enemies) {
      if (!e.alive || (e.kind === 'shell' && e.state === 'still')) continue;
      const dx = e.x - frontX;
      const dy = e.y - p.y;
      if (dx > -4 && dx < d1 && dy > -22 && dy < 18 && (e.kind !== 'flyer' || dy > -12)) want = true;
      else if (e.kind === 'walker' && stompNow(r, e, dx, groundAhead)) want = true;
    }
    // a pit's far side may be a platform that moves or falls: jump from the very edge, at a run
    if (want) {
      r.botHold = 0.32;
      c.jumpPressed = true;
      c.run = true;
    }
  }
  c.jump = want || r.botHold > 0 || (!p.onGround && p.vy < 0 && r.botHold > 0);
  r.botHold = Math.max(0, r.botHold - 1 / 60);
  // a kicked shell or a creature in the air ahead: nothing more to do, the rule is the whole of it
  if (r.cmd.jumpPressed === false && p.onGround && p.vy === 0) c.jump = false;
}

/** One whole run of the real rules played by the bot `theta` at a level, headless (Ghosty's practice, the node test): the score, whether the flag was reached, and the run. */
export function headless(theta: readonly number[], level: number, seed: number, maxSeconds = 240): { score: number; passed: boolean; run: Run } {
  const r = newRun(seed, level);
  const none: Cmd = { left: false, right: false, jump: false, jumpPressed: false, run: false };
  const dt = 1 / 60;
  for (let n = 0; !isOver(r) && n < maxSeconds * 60; n++) {
    botStep(r, theta);
    step(r, dt, none);
    r.events.length = 0;
  }
  return { score: score(r), passed: r.won, run: r };
}

// ---------------------------------------------------------------- the GYM's way in

export interface PlatObs {
  /** A window of the world round the player, 9 × 7, each 0 air, 1 solid, 2 coin, 3 a creature. */
  tiles: number[];
  vx: number;
  vy: number;
  onGround: boolean;
  big: boolean;
  lives: number;
  /** How far from the flag, in tiles. */
  toFlag: number;
}
export const PLAT_ACTIONS = ['none', 'left', 'right', 'jump', 'rightjump', 'runright'] as const;
export type PlatAction = (typeof PLAT_ACTIONS)[number];
export function platformLearnable(seed = 1, level = 1): Learnable<PlatObs, PlatAction> & { run: Run } {
  const run = newRun(seed, level);
  let jumpHeld = false;
  return {
    run,
    id: 'platform',
    actions: PLAT_ACTIONS,
    observe: () => {
      const p = run.p;
      const cx = Math.floor((p.x + p.w / 2) / TS);
      const cy = Math.floor((p.y + p.h / 2) / TS);
      const tiles: number[] = [];
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -4; dx <= 4; dx++) {
          const t = tileAt(run, cx + dx, cy + dy);
          const foe = run.enemies.some((e) => e.alive && Math.floor((e.x + e.w / 2) / TS) === cx + dx && Math.floor((e.y + e.h / 2) / TS) === cy + dy);
          tiles.push(foe ? 3 : SOLID.includes(t) ? 1 : t === 'o' ? 2 : 0);
        }
      return { tiles, vx: p.vx, vy: p.vy, onGround: p.onGround, big: p.big, lives: run.lives, toFlag: (run.flagX - p.x) / TS };
    },
    act(a) {
      const c: Cmd = { left: a === 'left', right: a === 'right' || a === 'rightjump' || a === 'runright', jump: a === 'jump' || a === 'rightjump', jumpPressed: false, run: a === 'runright' };
      c.jumpPressed = c.jump && !jumpHeld;
      jumpHeld = c.jump;
      step(run, 1 / 60, c);
      run.events.length = 0;
    },
    score: () => score(run),
    done: () => isOver(run),
  };
}
