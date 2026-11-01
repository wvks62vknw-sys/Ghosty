/**
 * THE KART RACER's rules, with no screen: four karts (you, Ghosty and two of his bots, Rivet and Pebble) on a track
 * from tracks.ts, stepped 120 times a second whatever the screen's rate. Arcade physics: the throttle eases off toward
 * the top speed, the steering is sharper when slow, sideways speed is gripped away (less so in a drift, so the kart
 * slides), a drift held through a bend charges a boost in three levels that a clean release spends, karts bump as equal
 * masses, and the walls push back. Items from boxes: a boost, a shield, an oil slick and a homing orb. The bots drive
 * the racing line with a wander that their difficulty sets, brake for the bends, drift the long ones and use their items
 * with sense; a bot behind you is a little quicker and one ahead a little slower (the catch-up, capped), so a race
 * stays close. Laps count only forwards; the finish order is the order karts cross the line the last time.
 */
import { along, buildTrack, locate, pointAt, type Track, type TrackDef, trackOf, type TrackId, wrapAngle } from './tracks';

export const STEP = 1 / 120;
export const LAPS = 3;
/** Top speeds (m/s): on the road, in a boost. */
export const TOP = 26;
export const BOOST_TOP = 35;
export const ACCEL = 15;
export const BRAKE = 28;
export const REVERSE = 8;
/** Turning rate at full lock (radians a second). */
export const TURN = 2.15;
/** How fast sideways speed is gripped away (per second): on the road, in a drift. */
export const GRIP = 11;
export const DRIFT_GRIP = 2.4;
/** A kart's radius for bumps (m), and how much of the speed into a bump comes back out. */
export const KART_R = 0.95;
export const BOUNCE = 0.85;
/** A drift needs this much speed (m/s). */
export const DRIFT_MIN = 9;
/** The drift's charge (seconds, steering into it counts more) for boost levels 1, 2 and 3; each level's boost (s). */
export const BOOST_AT = [1.0, 2.1, 3.3] as const;
export const BOOST_FOR = [0, 0.75, 1.2, 1.75] as const;
export const ITEM_BOOST = 1.3;
export const SHIELD_FOR = 8;
export const ROLL_FOR = 1;
export const BOX_BACK = 3;
/** The catch-up: a bot this far behind you (m) is at most CATCH_UP_CAP quicker; as far ahead, CATCH_DOWN_CAP slower. */
export const CATCH_UP_CAP = 0.1;
export const CATCH_DOWN_CAP = 0.06;
export const CATCH_RANGE = 160;
/** The clock starts here: three red lights at −3, −2 and −1 s, GO at 0. */
export const COUNTDOWN = 3.6;

export type ItemKind = 'boost' | 'shield' | 'oil' | 'orb';
export const ITEMS: readonly ItemKind[] = ['boost', 'shield', 'oil', 'orb'];
export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];
/** The bots' driving by difficulty: their pace (of the top speed and the plan), how far they wander off the line (m),
 *  whether they drift, and how long they hold an item before using it (s). Ghosty drives a notch above. */
export const SKILL: Record<Difficulty, { pace: number; noise: number; drift: boolean; wait: number }> = {
  easy: { pace: 0.86, noise: 1.5, drift: false, wait: 2.2 },
  normal: { pace: 0.94, noise: 0.85, drift: true, wait: 1.2 },
  hard: { pace: 1.0, noise: 0.4, drift: true, wait: 0.6 },
};
export const RACERS = [
  { name: 'You', colour: 0xff6a3d },
  { name: 'Ghosty', colour: 0x64d2ff },
  { name: 'Rivet', colour: 0xffc83d },
  { name: 'Pebble', colour: 0x6ad38a },
] as const;

export interface Controls {
  /** −1 (left) … 1 (right). */
  steer: number;
  throttle: number;
  brake: number;
  drift: boolean;
  item: boolean;
}
export interface Bot {
  pace: number;
  noise: number;
  drift: boolean;
  wait: number;
  seed: number;
  holding: boolean;
}
export interface Kart {
  i: number;
  name: string;
  you: boolean;
  ghosty: boolean;
  x: number;
  z: number;
  y: number;
  /** Heading: the kart faces (sin h, cos h) in x, z. */
  h: number;
  vx: number;
  vz: number;
  steer: number;
  hopT: number;
  /** −1 drifting left, 1 right, 0 not. */
  drift: number;
  charge: number;
  level: number;
  clean: boolean;
  prevDrift: boolean;
  prevItem: boolean;
  boostT: number;
  spinT: number;
  shieldT: number;
  wobble: number;
  item: ItemKind | null;
  rollT: number;
  holdT: number;
  idx: number;
  s: number;
  lat: number;
  /** Metres driven along the track since the start line (negative on the grid). */
  prog: number;
  lastS: number;
  offroad: boolean;
  wrongT: number;
  lap: number;
  lapStart: number;
  laps: number[];
  done: boolean;
  finishT: number;
  place: number;
  catchK: number;
  ctl: Controls;
  bot: Bot | null;
}
export interface Box {
  x: number;
  z: number;
  y: number;
  /** Seconds until it is back (0: there). */
  t: number;
}
export interface Slick {
  x: number;
  z: number;
  y: number;
  age: number;
  owner: number;
}
export interface Orb {
  prog: number;
  lat: number;
  x: number;
  z: number;
  y: number;
  owner: number;
  target: number;
  age: number;
  v: number;
}
export type RaceEvent =
  | { type: 'light'; n: number }
  | { type: 'go' }
  | { type: 'hop'; kart: number }
  | { type: 'drift'; kart: number; level: number }
  | { type: 'boost'; kart: number; level: number }
  | { type: 'box'; kart: number }
  | { type: 'item'; kart: number; item: ItemKind }
  | { type: 'use'; kart: number; item: ItemKind }
  | { type: 'spin'; kart: number; by: 'oil' | 'orb' }
  | { type: 'shield'; kart: number }
  | { type: 'bump'; a: number; b: number; force: number }
  | { type: 'wall'; kart: number; force: number }
  | { type: 'lap'; kart: number; lap: number; time: number }
  | { type: 'finish'; kart: number; place: number }
  | { type: 'done' };

export interface Race {
  track: Track;
  laps: number;
  diff: Difficulty;
  karts: Kart[];
  boxes: Box[];
  slicks: Slick[];
  orbs: Orb[];
  /** Seconds since GO (negative in the countdown). */
  t: number;
  phase: 'countdown' | 'race' | 'done';
  lights: number;
  finished: number;
  youDoneAt: number | null;
  rnd: () => number;
  events: RaceEvent[];
}

export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
/** The kart's speed along its heading (m/s). */
export const speedOf = (k: Kart) => k.vx * Math.sin(k.h) + k.vz * Math.cos(k.h);

/** The catch-up for a bot `gap` metres behind you (negative: ahead): its top speed's factor, within its caps. */
export function catchUp(gap: number): number {
  const f = clamp(gap / CATCH_RANGE, -1, 1);
  return 1 + (f > 0 ? f * CATCH_UP_CAP : f * CATCH_DOWN_CAP);
}

const makeBot = (d: Difficulty, seed: number, ghosty = false): Bot => {
  const s = SKILL[d];
  return { pace: ghosty ? Math.min(1.02, s.pace + 0.03) : s.pace, noise: ghosty ? s.noise * 0.6 : s.noise, drift: s.drift || ghosty, wait: s.wait, seed, holding: false };
};

export interface RaceOptions {
  seed?: number;
  laps?: number;
  difficulty?: Difficulty;
  /** A kart for you (false: four bots, for the tests and the GYM). */
  you?: boolean;
  /** Your kart driven by the bots' code (the harness, and a lap after the finish). */
  auto?: boolean;
}

/** A race on the grid: Ghosty and Rivet on the front row, you and Pebble behind them, the lights about to come on. */
export function newRace(track: TrackId | TrackDef, o: RaceOptions = {}): Race {
  const T = typeof track === 'string' ? trackOf(track) : buildTrack(track);
  const diff = o.difficulty ?? 'normal';
  const rnd = rng(o.seed ?? 1);
  const grid: [number, number][] = [[-12, -2.7], [-5, -2.7], [-5, 2.7], [-12, 2.7]];
  const karts: Kart[] = RACERS.map((r, i) => {
    const [prog, lat] = grid[i]!;
    const p = pointAt(T, prog, lat);
    const you = i === 0 && o.you !== false;
    const w = locate(T, p.x, p.z, -1);
    return {
      i, name: you ? 'You' : i === 0 ? 'Spark' : r.name, you, ghosty: i === 1,
      x: p.x, z: p.z, y: p.y, h: Math.atan2(p.tx, p.tz), vx: 0, vz: 0,
      steer: 0, hopT: 0, drift: 0, charge: 0, level: 0, clean: true, prevDrift: false, prevItem: false,
      boostT: 0, spinT: 0, shieldT: 0, wobble: 0, item: null, rollT: 0, holdT: 0,
      idx: w.i, s: w.s, lat: w.lat, prog, lastS: w.s, offroad: false, wrongT: 0,
      lap: 0, lapStart: 0, laps: [], done: false, finishT: 0, place: i + 1, catchK: 1,
      ctl: { steer: 0, throttle: 0, brake: 0, drift: false, item: false },
      bot: you && !o.auto ? null : makeBot(diff, i * 7.13 + 1.7, i === 1),
    };
  });
  const boxes: Box[] = [];
  for (const f of T.def.boxes) {
    for (const lat of [-4.2, -1.4, 1.4, 4.2]) {
      const p = pointAt(T, f * T.length, lat * (T.def.half / 6.6));
      boxes.push({ x: p.x, z: p.z, y: p.y, t: 0 });
    }
  }
  const r: Race = { track: T, laps: o.laps ?? LAPS, diff, karts, boxes, slicks: [], orbs: [], t: -COUNTDOWN, phase: 'countdown', lights: 0, finished: 0, youDoneAt: null, rnd, events: [] };
  placeKarts(r);
  return r;
}

const emit = (r: Race, e: RaceEvent) => {
  r.events.push(e);
  if (r.events.length > 400) r.events.splice(0, r.events.length - 400);
};

/** One step of the race. */
export function step(r: Race, dt = STEP): void {
  r.t += dt;
  const lights = r.t >= 0 ? 4 : r.t >= -1 ? 3 : r.t >= -2 ? 2 : r.t >= -3 ? 1 : 0;
  if (lights !== r.lights) {
    r.lights = lights;
    emit(r, lights === 4 ? { type: 'go' } : { type: 'light', n: lights });
  }
  if (r.phase === 'countdown' && r.t >= 0) r.phase = 'race';
  const you = r.karts.find((k) => k.you);
  const ref = you ? you.prog : r.karts.reduce((s, k) => s + k.prog, 0) / r.karts.length;
  for (const k of r.karts) {
    k.catchK = k.bot && !k.you ? catchUp(ref - k.prog) : 1;
    if (k.bot) botDrive(r, k, dt);
  }
  for (const k of r.karts) drive(r, k, dt);
  for (let a = 0; a < r.karts.length; a++) for (let b = a + 1; b < r.karts.length; b++) bump(r.karts[a]!, r.karts[b]!, r);
  items(r, dt);
  for (const k of r.karts) laps(r, k);
  placeKarts(r);
  if (r.phase === 'race' && (you ? you.done : r.karts.every((k) => k.done))) {
    r.youDoneAt ??= r.t;
    if (r.karts.every((k) => k.done) || r.t - r.youDoneAt > 7) finishRest(r);
  }
}

/** Drive one kart by its controls: the hop and the drift, the steering, the engine, the grip, the walls, the progress. */
export function drive(r: Race, k: Kart, dt: number): void {
  const T = r.track, c = k.ctl;
  const live = r.t >= 0;
  const spin = k.spinT > 0;
  k.steer += (clamp(c.steer, -1, 1) - k.steer) * Math.min(1, dt * 12);
  let vF = speedOf(k);
  if (c.drift && !k.prevDrift && k.hopT <= 0 && live && !spin && vF > 3) {
    k.hopT = 0.24;
    emit(r, { type: 'hop', kart: k.i });
  }
  k.prevDrift = c.drift;
  k.hopT = Math.max(0, k.hopT - dt);
  if (!k.drift && c.drift && live && !spin && vF > DRIFT_MIN && Math.abs(k.steer) > 0.3) {
    k.drift = Math.sign(k.steer);
    k.charge = 0;
    k.level = 0;
    k.clean = true;
  }
  if (k.drift) {
    if (!c.drift || spin || vF < DRIFT_MIN * 0.6) {
      if (!spin && !c.drift && k.clean && k.level > 0) {
        k.boostT = Math.max(k.boostT, BOOST_FOR[k.level]!);
        emit(r, { type: 'boost', kart: k.i, level: k.level });
      }
      k.drift = 0;
      k.charge = 0;
      k.level = 0;
    } else {
      k.charge += dt * (0.8 + 0.6 * Math.max(0, k.steer * k.drift));
      const lv = k.clean ? BOOST_AT.filter((a) => k.charge >= a).length : 0;
      if (lv > k.level) {
        k.level = lv;
        emit(r, { type: 'drift', kart: k.i, level: lv });
      }
    }
  }
  // turning: sharper when slow, a touch wider at the top; a drift swings into its side and the stick only tightens it
  const speedK = Math.min(1, Math.abs(vF) / 6) * (1 - 0.25 * Math.min(1, Math.max(0, vF) / TOP));
  let yaw = -k.steer * TURN * speedK * (vF < -0.5 ? -1 : 1);
  if (k.drift) yaw = -TURN * 1.15 * speedK * (k.drift * 0.6 + k.steer * 0.55);
  if (spin || !live) yaw = 0;
  k.h += yaw * dt;
  const fx = Math.sin(k.h), fz = Math.cos(k.h), rx = -fz, rz = fx;
  vF = k.vx * fx + k.vz * fz;
  let vR = k.vx * rx + k.vz * rz;
  const boost = k.boostT > 0;
  k.boostT = Math.max(0, k.boostT - dt);
  const top = (boost ? BOOST_TOP : TOP) * (k.offroad && !boost ? 0.55 : 1) * k.catchK * (k.bot && !k.you ? k.bot.pace : 1) * (spin ? 0.3 : 1);
  if (!live) vF *= Math.exp(-4 * dt);
  else if (c.brake > 0.1) vF = vF > 0.3 ? vF - BRAKE * c.brake * dt : Math.max(-REVERSE, vF - ACCEL * 0.6 * c.brake * dt);
  else if (vF > top) vF -= (vF - top) * (spin ? 2.5 : k.offroad ? 3 : 1.4) * dt;
  else if (c.throttle > 0) vF += (ACCEL * (1 - Math.max(0, vF) / top) + (boost ? 16 : 0)) * c.throttle * dt;
  if (live && c.throttle <= 0 && c.brake <= 0.1) vF -= Math.sign(vF) * Math.min(Math.abs(vF), 3 * dt);
  const g = k.drift ? DRIFT_GRIP : k.offroad ? GRIP * 0.6 : GRIP;
  const keep = Math.exp(-g * dt);
  const lost = Math.abs(vR) * (1 - keep);
  vR *= keep;
  if (vF > 0) vF += lost * (k.drift ? 0.6 : 0.3);
  k.vx = fx * vF + rx * vR;
  k.vz = fz * vF + rz * vR;
  k.x += k.vx * dt;
  k.z += k.vz * dt;
  k.spinT = Math.max(0, k.spinT - dt);
  k.shieldT = Math.max(0, k.shieldT - dt);
  k.wobble = Math.max(0, k.wobble - dt * 2.5);
  // where it is; the walls push back (and a drift that touches one is not clean any more)
  const w = locate(T, k.x, k.z, k.idx);
  k.idx = w.i;
  k.lat = w.lat;
  k.y = w.y;
  const W = T.wall[w.i]! - KART_R * 0.85;
  if (Math.abs(w.lat) > W) {
    const sg = Math.sign(w.lat), over = Math.abs(w.lat) - W;
    const nx = -T.tz[w.i]! * sg, nz = T.tx[w.i]! * sg;
    k.x -= nx * over;
    k.z -= nz * over;
    const vn = k.vx * nx + k.vz * nz;
    if (vn > 0) {
      k.vx -= nx * vn * 1.4;
      k.vz -= nz * vn * 1.4;
      const f = 1 - Math.min(0.3, vn * 0.022);
      k.vx *= f;
      k.vz *= f;
      if (k.drift) k.clean = false;
      if (vn > 2.5) emit(r, { type: 'wall', kart: k.i, force: vn });
    }
    k.lat = sg * W;
  }
  k.offroad = Math.abs(k.lat) > T.def.half + 0.7 && !T.tunnel[w.i];
  if (k.offroad && k.drift) k.clean = false;
  let d = w.s - k.lastS;
  if (d < -T.length / 2) d += T.length;
  else if (d > T.length / 2) d -= T.length;
  k.prog += d;
  k.lastS = w.s;
  k.s = w.s;
  const facing = fx * T.tx[w.i]! + fz * T.tz[w.i]!;
  k.wrongT = facing < -0.35 && Math.abs(vF) > 3 ? k.wrongT + dt : 0;
}

/** Two karts that touch: pushed apart, and the speed along the line between them shared as equal masses do (a little
 *  lost: BOUNCE), so the sum of their speeds holds. */
export function bump(A: Kart, B: Kart, r?: Race): boolean {
  const dx = B.x - A.x, dz = B.z - A.z, d2 = dx * dx + dz * dz;
  if (d2 >= 4 * KART_R * KART_R || d2 < 1e-8) return false;
  const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, over = (2 * KART_R - d) / 2;
  A.x -= nx * over;
  A.z -= nz * over;
  B.x += nx * over;
  B.z += nz * over;
  const vrel = (A.vx - B.vx) * nx + (A.vz - B.vz) * nz;
  if (vrel <= 0) return true;
  const J = ((1 + BOUNCE) / 2) * vrel;
  A.vx -= J * nx;
  A.vz -= J * nz;
  B.vx += J * nx;
  B.vz += J * nz;
  A.wobble = B.wobble = Math.min(1, vrel / 8);
  if (r && vrel > 1.5) emit(r, { type: 'bump', a: A.i, b: B.i, force: vrel });
  return true;
}

/** The bots' driving: the racing line ahead with a wander, round anyone in the way and any slick, braking for the
 *  bends by the track's plan, drifting the long ones, and their items used with some sense. */
export function botDrive(r: Race, k: Kart, dt: number): void {
  const T = r.track, b = k.bot!;
  const v = speedOf(k);
  const look = 6 + Math.max(v, 8) * 0.45;
  const wob = (Math.sin(r.t * 0.41 + b.seed * 3.1) + 0.6 * Math.sin(r.t * 0.17 + b.seed * 7.3)) * 0.62 * b.noise;
  let dodge = 0;
  for (const o of r.karts) {
    if (o === k) continue;
    const gap = o.prog - k.prog;
    if (gap > 0.5 && gap < 10 && Math.abs(o.lat - k.lat) < 2.2) dodge += (o.lat > k.lat ? -1 : 1) * 2.4 * (1 - gap / 10);
  }
  for (const s of r.slicks) {
    const w = locate(T, s.x, s.z, k.idx, 14);
    let gap = w.s - k.s;
    if (gap < -T.length / 2) gap += T.length;
    if (gap > 2 && gap < 22 && Math.abs(w.lat - k.lat) < 2.4) dodge += (w.lat > k.lat ? -1 : 1) * 2.6;
  }
  const lim = T.def.half - 1.5;
  const target = clamp(along(T, T.line, k.s + look) + wob + dodge, -lim, lim);
  const p = pointAt(T, k.s + look, target);
  const d = wrapAngle(Math.atan2(p.x - k.x, p.z - k.z) - k.h);
  const steer = clamp(-d * 2.4, -1, 1);
  const vt = Math.min(along(T, T.plan, k.s + 3), along(T, T.plan, k.s + 10), along(T, T.plan, k.s + 18)) * (k.done && k.you ? 0.75 : b.pace);
  let throttle = 1, brake = 0;
  if (v > vt + 0.8) (throttle = 0), (brake = clamp((v - vt) / 5, 0.15, 1));
  else if (v > vt - 0.5) throttle = 0.4;
  // a drift through a long bend at speed
  let drift = false;
  if (b.drift && r.t > 0 && !k.done) {
    let sum = 0;
    for (let j = 2; j <= 14; j++) sum += T.k[(k.idx + j) % T.n]!;
    const bend = sum / 13;
    drift = (k.drift !== 0 ? Math.abs(bend) > 1 / 75 && Math.sign(bend) === -k.drift : Math.abs(bend) > 1 / 42) && v > 15;
    // let go before the drift carries it off the road
    if (Math.abs(k.lat) > T.def.half - 1.1) drift = false;
  }
  let item = false;
  if (k.item && !k.done) {
    k.holdT += dt;
    if (k.holdT > b.wait) {
      const behind = r.karts.some((o) => o !== k && k.prog - o.prog > 2 && k.prog - o.prog < 25);
      const ahead = r.karts.some((o) => o !== k && o.prog - k.prog > 3 && o.prog - k.prog < 90);
      item =
        k.item === 'shield' ||
        (k.item === 'boost' && Math.abs(steer) < 0.35 && vt > 20) ||
        (k.item === 'oil' && (behind || k.holdT > b.wait + 9)) ||
        (k.item === 'orb' && (ahead || k.holdT > b.wait + 10));
    }
  }
  k.ctl = { steer, throttle, brake, drift, item };
}

const TABLE: Record<number, [ItemKind, number][]> = {
  1: [['oil', 45], ['shield', 35], ['boost', 15], ['orb', 5]],
  2: [['orb', 30], ['boost', 25], ['oil', 25], ['shield', 20]],
  3: [['orb', 40], ['boost', 35], ['shield', 15], ['oil', 10]],
  4: [['boost', 45], ['orb', 45], ['shield', 10]],
};
/** What a box gives, by your place: the leaders get defence, the ones behind get speed and the orb. */
export function pickItem(place: number, rnd: () => number): ItemKind {
  const t = TABLE[clamp(place, 1, 4)]!;
  let x = rnd() * t.reduce((s, [, w]) => s + w, 0);
  for (const [it, w] of t) if ((x -= w) < 0) return it;
  return t[0]![0];
}

function hit(r: Race, k: Kart, by: 'oil' | 'orb'): void {
  if (k.shieldT > 0) {
    k.shieldT = 0;
    emit(r, { type: 'shield', kart: k.i });
    return;
  }
  k.spinT = by === 'orb' ? 1.3 : 1.05;
  k.drift = 0;
  k.charge = 0;
  k.level = 0;
  k.boostT = 0;
  emit(r, { type: 'spin', kart: k.i, by });
}

function use(r: Race, k: Kart): void {
  const it = k.item!;
  k.item = null;
  k.holdT = 0;
  const T = r.track;
  if (it === 'boost') k.boostT = Math.max(k.boostT, ITEM_BOOST);
  else if (it === 'shield') k.shieldT = SHIELD_FOR;
  else if (it === 'oil') {
    const x = k.x - Math.sin(k.h) * 2.6, z = k.z - Math.cos(k.h) * 2.6;
    r.slicks.push({ x, z, y: locate(T, x, z, k.idx).y, age: 0, owner: k.i });
    if (r.slicks.length > 6) r.slicks.shift();
  } else {
    const target = r.karts.find((o) => o.place === k.place - 1 && !o.done);
    r.orbs.push({ prog: k.prog + 2.5, lat: k.lat, x: k.x, z: k.z, y: k.y, owner: k.i, target: target ? target.i : -1, age: 0, v: Math.max(speedOf(k) + 14, 40) });
  }
  emit(r, { type: 'use', kart: k.i, item: it });
}

/** The boxes, the roulette, the items used, the slicks and the orbs. */
function items(r: Race, dt: number): void {
  for (const b of r.boxes) if (b.t > 0) b.t = Math.max(0, b.t - dt);
  for (const k of r.karts) {
    if (k.rollT > 0) {
      k.rollT -= dt;
      if (k.rollT <= 0) {
        k.rollT = 0;
        k.item = pickItem(k.place, r.rnd);
        emit(r, { type: 'item', kart: k.i, item: k.item });
      }
    } else if (r.t > 0 && !k.item && !k.done) {
      for (const b of r.boxes) {
        if (b.t <= 0 && (k.x - b.x) ** 2 + (k.z - b.z) ** 2 < 1.9 * 1.9) {
          b.t = BOX_BACK;
          k.rollT = ROLL_FOR;
          emit(r, { type: 'box', kart: k.i });
          break;
        }
      }
    }
    if (k.ctl.item && !k.prevItem && k.item && r.t > 0) use(r, k);
    k.prevItem = k.ctl.item;
  }
  for (let i = r.slicks.length - 1; i >= 0; i--) {
    const s = r.slicks[i]!;
    s.age += dt;
    let gone = s.age > 30;
    for (const k of r.karts) {
      if (gone || k.hopT > 0.05 || (s.owner === k.i && s.age < 1.2)) continue;
      if ((k.x - s.x) ** 2 + (k.z - s.z) ** 2 < 1.5 * 1.5) {
        hit(r, k, 'oil');
        gone = true;
      }
    }
    if (gone) r.slicks.splice(i, 1);
  }
  const T = r.track;
  for (let i = r.orbs.length - 1; i >= 0; i--) {
    const o = r.orbs[i]!;
    o.age += dt;
    const tg = o.target >= 0 ? r.karts[o.target]! : null;
    if (tg && !tg.done) {
      const gap = tg.prog - o.prog;
      if (gap < 70) o.lat += clamp(tg.lat - o.lat, -12 * dt, 12 * dt);
      if (gap < 12) o.v = Math.max(speedOf(tg) + 9, 18);
    }
    o.prog += o.v * dt;
    const p = pointAt(T, o.prog, o.lat);
    o.x = p.x;
    o.z = p.z;
    o.y = p.y;
    let gone = o.age > 7;
    for (const k of r.karts) {
      if (gone || k.done || (k.i === o.owner && o.age < 0.8)) continue;
      if (Math.abs(k.prog - o.prog) < 1.5 && Math.abs(k.lat - o.lat) < 1.4) {
        hit(r, k, 'orb');
        gone = true;
      }
    }
    if (gone) r.orbs.splice(i, 1);
  }
}

/** Laps count forwards only (backing over the line and crossing again is no lap); the last one is the finish. */
function laps(r: Race, k: Kart): void {
  if (k.done || r.t <= 0) return;
  const n = Math.floor(k.prog / r.track.length);
  if (n <= k.lap) return;
  const time = r.t - k.lapStart;
  k.laps.push(time);
  k.lapStart = r.t;
  k.lap = n;
  emit(r, { type: 'lap', kart: k.i, lap: n, time });
  if (n >= r.laps) {
    k.done = true;
    k.finishT = r.t;
    k.place = ++r.finished;
    emit(r, { type: 'finish', kart: k.i, place: k.place });
    if (k.you) k.bot = makeBot('easy', 3.3);
  }
}

/** Places: those home in the order they crossed, then everyone else by how far round they are. */
export function placeKarts(r: Race): void {
  const order = [...r.karts].sort((a, b) => (a.done !== b.done ? (a.done ? -1 : 1) : a.done ? a.place - b.place : b.prog - a.prog));
  order.forEach((k, i) => {
    if (!k.done) k.place = i + 1;
  });
}

/** The race is called: those still out are placed where they are, their times guessed from their pace. */
function finishRest(r: Race): void {
  const L = r.track.length * r.laps;
  const out = r.karts.filter((k) => !k.done).sort((a, b) => b.prog - a.prog);
  for (const k of out) {
    const pace = Math.max(8, k.prog / Math.max(1, r.t));
    k.finishT = r.t + Math.max(0, L - k.prog) / pace;
    k.done = true;
    k.place = ++r.finished;
  }
  r.phase = 'done';
  emit(r, { type: 'done' });
}

/** Lap n of the race (1-based) the kart is on, for the HUD. */
export const lapOf = (r: Race, k: Kart) => clamp(k.lap + 1, 1, r.laps);
/** The best lap a kart has done in this race (s), or null. */
export const bestLap = (k: Kart) => (k.laps.length ? Math.min(...k.laps) : null);
/** 1st, 2nd, 3rd, 4th. */
export const ordinal = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
/** 1:02.3 */
export const clock = (s: number) => {
  const m = Math.floor(Math.max(0, s) / 60), r = Math.max(0, s) - m * 60;
  return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}`;
};
/** A race's points: 10 for a win, 7, 5, 3 for the others, one more for each clean drift's boost. */
export const POINTS = [10, 7, 5, 3] as const;
