/**
 * THE CAVE's rules, with no drawing in them. A cave of twelve rooms (rooms.ts) crossed on the same feel as the platformer's
 * jump (platform/core.ts), with three tools found in order: boots (a second jump in the air), a blaster that grows on the
 * crystals it collects and loses a level on a hit, a lamp that lights the dark and shows the hidden steps. Six creature kinds
 * with their own patterns, two bosses with three phases each and a health bar, hearts that a lantern mends and a lantern
 * that saves the place, dialogue from the dwellers, a map that fills as rooms are seen, an ending with the time and the
 * crystals. Ghosty plays it with a bot that follows each room's route and fights what is in the way. The measure is the rooms
 * seen, then the way out and the time, with a level that has no top (a deeper cave is a tougher one).
 */
import type { Learnable } from '../../learnable';
import { type Body, body, FEEL, moveBody, overlaps, TS, toward } from '../platform/core';
import { rng } from '../two/skill';
import { RH, type RoomDef, roomOf, ROOMS, RW, TALK, type Tool, TOOL_FOUND } from './rooms';

export const SIGMA: readonly number[] = [14, 30, 0.2];
export const THETA0: readonly number[] = [100, 150, 0];
export const HEARTS = 5;
/** Crystals for each blaster level (1, 2, 3). */
export const XP_AT = [0, 4, 10];
export const ENDING_BASE = 2000;
export const ENDING_SECONDS = 3600;

export type Creature = Body & {
  kind: string;
  hp: number;
  max: number;
  dir: number;
  t: number;
  hx: number;
  hy: number;
  hop: number;
  alive: boolean;
  flash: number;
  boss: boolean;
  phase: number;
  cd: number;
  stagger: number;
};
export interface Proj {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  foe: boolean;
  dmg: number;
  life: number;
  grav: boolean;
  kind: string;
}
export interface Drop {
  x: number;
  y: number;
  t: number;
  state: 0 | 1;
  vy: number;
}
export interface Player extends Body {
  face: number;
  coyote: number;
  buffer: number;
  cut: boolean;
  jumps: number;
  inv: number;
  fireCool: number;
  aimUp: boolean;
  wet: boolean;
  anim: number;
  sq: number;
}
export interface Cmd {
  left: boolean;
  right: boolean;
  up: boolean;
  jump: boolean;
  jumpPressed: boolean;
  fire: boolean;
  use: boolean;
}
export interface Card {
  title: string;
  pages: string[];
}
export type CaveEvent = { type: string; x?: number; y?: number; n?: number; kind?: string; id?: string };

export interface SaveData {
  v: 1;
  room: string;
  x: number;
  y: number;
  hearts: number;
  tools: Tool[];
  xp: number;
  crystals: number;
  taken: string[];
  visited: string[];
  bosses: string[];
  seen: string[];
  time: number;
  deaths: number;
  level: number;
  seed: number;
}

export interface Run {
  level: number;
  seed: number;
  rnd: () => number;
  room: RoomDef;
  tiles: string[][];
  creatures: Creature[];
  projs: Proj[];
  drips: Drop[];
  p: Player;
  hearts: number;
  maxHearts: number;
  tools: Record<Tool, boolean>;
  xp: number;
  crystals: number;
  taken: Set<string>;
  visited: Set<string>;
  bosses: Set<string>;
  seen: Set<string>;
  /** Where the last lantern was lit (null: none yet). */
  lantern: { room: string; x: number; y: number } | null;
  entry: { x: number; y: number };
  time: number;
  deaths: number;
  dead: boolean;
  deadT: number;
  ended: boolean;
  endT: number;
  out: boolean;
  t: number;
  events: CaveEvent[];
  cards: Card[];
  cmd: Cmd;
  bot: boolean;
  camX: number;
  mapOpen: boolean;
  lastNew: number;
  botIdx: number;
  botStuck: number;
  botX: number;
  botUse: number;
  botHold: number;
  /** A spec's switch: nothing hurts. */
  calm: boolean;
  shake: number;
}

const NOCMD = (): Cmd => ({ left: false, right: false, up: false, jump: false, jumpPressed: false, fire: false, use: false });
const scaleOf = (level: number): number => 1 + 0.25 * (Math.max(1, level) - 1);
export const weaponLevel = (xp: number): number => (xp >= XP_AT[2]! ? 3 : xp >= XP_AT[1]! ? 2 : 1);

const SIZES: Record<string, [number, number, number]> = {
  crawler: [12, 10, 2],
  flutter: [12, 9, 1],
  slug: [14, 10, 3],
  frog: [12, 11, 3],
  spike: [12, 10, 4],
  fish: [12, 8, 2],
  boss1: [46, 30, 30],
  boss2: [34, 34, 48],
};

function mkCreature(kind: string, cx: number, cy: number, level: number): Creature {
  const [w, h, hp0] = SIZES[kind]!;
  const boss = kind.startsWith('boss');
  const hp = Math.ceil(hp0 * (boss ? 1 + (scaleOf(level) - 1) * 0.8 : scaleOf(level)));
  const x = cx * TS + (TS - w) / 2;
  const y = kind === 'slug' ? cy * TS : cy * TS + (TS - h);
  return { ...body(x, boss && kind === 'boss1' ? cy * TS + TS - h : y, w, h), kind, hp, max: hp, dir: -1, t: 0, hx: x, hy: y, hop: 1, alive: true, flash: 0, boss, phase: 1, cd: 2, stagger: 0 };
}

const SOLID = '#xG';
function solidAt(r: Run, tx: number, ty: number): boolean {
  if (tx < 0) return !r.room.exits.L;
  if (tx >= RW) return !r.room.exits.R;
  if (ty < 0 || ty >= RH) return false;
  const c = r.tiles[ty]![tx]!;
  return SOLID.includes(c) || (c === 'v' && r.tools.lamp);
}
export const tileAt = (r: Run, tx: number, ty: number): string => (tx < 0 || tx >= RW || ty < 0 || ty >= RH ? '#' : r.tiles[ty]![tx]!);
const wet = (r: Run, b: Box4): boolean => tileAt(r, Math.floor((b.x + b.w / 2) / TS), Math.floor((b.y + b.h * 0.6) / TS)) === '~';
type Box4 = { x: number; y: number; w: number; h: number };

const ev = (r: Run, type: string, extra: Omit<CaveEvent, 'type'> = {}): void => void r.events.push({ type, ...extra });

export function loadRoom(r: Run, id: string, at?: { x: number; y: number }): void {
  const def = roomOf(id);
  r.room = def;
  r.tiles = def.rows.map((s) => s.split(''));
  r.creatures = [];
  r.projs = [];
  r.drips = [];
  r.botIdx = 0;
  r.botStuck = 0;
  if (r.bosses.has('boss1')) for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) if (r.tiles[y]![x] === 'G') r.tiles[y]![x] = '.';
  for (const s of def.spawns) {
    if (s.kind === 'drip') r.drips.push({ x: s.x * TS + 8, y: s.y * TS + 6, t: (s.x * 0.37) % 2, state: 0, vy: 0 });
    else if (SIZES[s.kind]) {
      if (s.kind === 'boss1' && r.bosses.has('boss1')) continue;
      if (s.kind === 'boss2' && r.bosses.has('boss2')) continue;
      r.creatures.push(mkCreature(s.kind, s.x, s.y, r.level));
    }
  }
  if (at) {
    r.p.x = at.x;
    r.p.y = at.y;
    r.p.vx = 0;
    r.p.vy = 0;
  }
  r.entry = { x: r.p.x, y: r.p.y };
  if (!r.visited.has(id)) {
    r.visited.add(id);
    r.lastNew = r.time;
    ev(r, 'room', { id, n: r.visited.size });
  }
  r.camX = Math.max(0, Math.min(RW * TS - 14 * TS, r.p.x - 5 * TS));
}

export function newRun(seed: number, level: number): Run {
  const def = ROOMS[0]!;
  const p: Player = { ...body(3 * TS, 15 * TS - 14, 10, 14), face: 1, coyote: 0, buffer: 0, cut: false, jumps: 1, inv: 0, fireCool: 0, aimUp: false, wet: false, anim: 0, sq: 0 };
  const r: Run = { level, seed, rnd: rng(seed), room: def, tiles: [], creatures: [], projs: [], drips: [], p, hearts: HEARTS, maxHearts: HEARTS, tools: { boots: false, blaster: false, lamp: false }, xp: 0, crystals: 0, taken: new Set(), visited: new Set(), bosses: new Set(), seen: new Set(), lantern: null, entry: { x: p.x, y: p.y }, time: 0, deaths: 0, dead: false, deadT: 0, ended: false, endT: 0, out: false, t: 0, events: [], cards: [], cmd: NOCMD(), bot: false, camX: 0, mapOpen: false, lastNew: 0, botIdx: 0, botStuck: 0, botX: 0, botUse: 0, botHold: 0, calm: false, shake: 0 };
  loadRoom(r, def.id);
  r.events.length = 0;
  return r;
}

export function restore(save: SaveData, seed: number): Run {
  const r = newRun(seed, save.level);
  r.level = save.level;
  r.hearts = Math.max(1, save.hearts);
  r.tools = { boots: save.tools.includes('boots'), blaster: save.tools.includes('blaster'), lamp: save.tools.includes('lamp') };
  r.xp = save.xp;
  r.crystals = save.crystals;
  r.taken = new Set(save.taken);
  r.visited = new Set(save.visited);
  r.bosses = new Set(save.bosses);
  r.seen = new Set(save.seen);
  r.time = save.time;
  r.deaths = save.deaths;
  r.lantern = { room: save.room, x: save.x, y: save.y };
  loadRoom(r, save.room, { x: save.x, y: save.y });
  r.events.length = 0;
  return r;
}
export function snapshot(r: Run): SaveData {
  const at = r.lantern ?? { room: 'landing', x: 3 * TS, y: 14 * TS - 14 };
  return { v: 1, room: at.room, x: at.x, y: at.y, hearts: r.hearts, tools: (Object.keys(r.tools) as Tool[]).filter((k) => r.tools[k]), xp: r.xp, crystals: r.crystals, taken: [...r.taken], visited: [...r.visited], bosses: [...r.bosses], seen: [...r.seen], time: Math.round(r.time), deaths: r.deaths, level: r.level, seed: r.seed };
}
export function readSave(raw: unknown): SaveData | null {
  const s = raw as SaveData | null;
  if (!s || s.v !== 1 || typeof s.room !== 'string' || !ROOMS.some((q) => q.id === s.room)) return null;
  const nums = [s.x, s.y, s.hearts, s.xp, s.crystals, s.time, s.deaths, s.level, s.seed];
  if (!nums.every(Number.isFinite) || !Array.isArray(s.tools) || !Array.isArray(s.taken) || !Array.isArray(s.visited) || !Array.isArray(s.bosses) || !Array.isArray(s.seen)) return null;
  return s;
}

export function score(r: Run): number {
  return r.ended ? ENDING_BASE + Math.max(0, ENDING_SECONDS - Math.floor(r.time)) : r.visited.size * 100 + r.crystals;
}
export const isOver = (r: Run): boolean => r.out || (r.ended && r.endT > 1.4);
export const targetOf = (): number => ENDING_BASE;
export const clock = (secs: number): string => `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;
export const wordsOf = (n: number): string => (n >= ENDING_BASE ? `out in ${clock(Math.max(0, ENDING_SECONDS - (n - ENDING_BASE)))}` : `${Math.floor(n / 100)} of ${ROOMS.length} rooms`);
/** The one number for how tough a cave is at a level, strictly increasing with no ceiling (the creatures' hearts rise with it). */
export const hardness = (level: number): number => 12 * scaleOf(level) + level * 1e-3;

function hurt(r: Run, dmg = 1, from?: Box4): void {
  const p = r.p;
  if (r.calm || p.inv > 0 || r.dead) return;
  r.hearts -= dmg;
  p.inv = 1.3;
  r.xp = r.xp > 0 ? (weaponLevel(r.xp) > 1 ? XP_AT[weaponLevel(r.xp) - 2]! : Math.max(0, r.xp - 1)) : 0;
  p.vy = -170;
  p.vx = from ? (p.x + p.w / 2 < from.x + from.w / 2 ? -110 : 110) : 0;
  r.shake = 0.25;
  ev(r, 'hurt', { x: p.x, y: p.y, n: r.hearts });
  if (r.hearts <= 0) die(r);
}
function die(r: Run): void {
  r.dead = true;
  r.deadT = 0;
  r.deaths++;
  r.p.vy = -240;
  ev(r, 'die', { n: r.deaths });
}
function respawn(r: Run): void {
  const at = r.lantern ?? { room: 'landing', x: 3 * TS, y: 14 * TS - 14 };
  r.hearts = r.maxHearts;
  r.dead = false;
  r.p.inv = 1.5;
  loadRoom(r, at.room, { x: at.x, y: at.y });
  ev(r, 'respawn', { id: at.room });
}
const card = (r: Run, key: string, title: string, pages: string[]): void => {
  if (r.seen.has(key) && key.startsWith('once:')) return;
  r.seen.add(key);
  r.cards.push({ title, pages });
  ev(r, 'card', { id: key });
};
function heal(r: Run): void {
  r.hearts = r.maxHearts;
}
export function use(r: Run): void {
  const p = r.p;
  const near = (s: { x: number; y: number }) => Math.abs(s.x * TS + 8 - (p.x + p.w / 2)) < 26 && Math.abs(s.y * TS + 8 - (p.y + p.h / 2)) < 26;
  for (const s of r.room.spawns) {
    if (s.kind === 'lantern' && near(s)) {
      r.lantern = { room: r.room.id, x: s.x * TS + 3, y: s.y * TS + TS - p.h };
      heal(r);
      ev(r, 'save', { id: r.room.id });
      return;
    }
    if (s.kind === 'npc' && near(s)) {
      const t = TALK[s.id ?? ''];
      if (t) {
        r.cards.push({ title: t.name, pages: t.lines });
        ev(r, 'card', { id: `talk:${s.id}` });
      }
      return;
    }
  }
}

function fireBlaster(r: Run): void {
  const p = r.p;
  if (!r.tools.blaster || p.fireCool > 0) return;
  const lv = weaponLevel(r.xp);
  p.fireCool = 0.34 - lv * 0.05;
  const up = p.aimUp;
  const sp = 240 + lv * 30;
  r.projs.push({ x: p.x + p.w / 2 - 2 + (up ? 0 : p.face * 8), y: p.y + (up ? -2 : p.h / 2 - 2), vx: up ? 0 : p.face * sp, vy: up ? -sp : 0, w: 4 + lv, h: 4 + lv, foe: false, dmg: lv, life: 0.9, grav: false, kind: 'shot' });
  ev(r, 'fire', { n: lv });
}

function hitCreature(r: Run, c: Creature, dmg: number): void {
  if (!c.alive || c.stagger > 0 && c.boss) return;
  c.hp -= dmg;
  c.flash = 0.12;
  ev(r, 'hit', { x: c.x, y: c.y, kind: c.kind });
  if (c.boss) {
    const ph = c.hp > (c.max * 2) / 3 ? 1 : c.hp > c.max / 3 ? 2 : 3;
    if (ph > c.phase && c.hp > 0) {
      c.phase = ph;
      c.stagger = 0.9;
      c.cd = 1.2;
      ev(r, 'phase', { n: ph, kind: c.kind });
    }
  }
  if (c.hp <= 0) {
    c.alive = false;
    ev(r, 'kill', { x: c.x, y: c.y, kind: c.kind });
    if (c.boss) {
      r.bosses.add(c.kind);
      r.projs = r.projs.filter((q) => !q.foe);
      for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) if (r.tiles[y]![x] === 'G') r.tiles[y]![x] = '.';
      ev(r, 'boss', { kind: c.kind });
      card(r, `boss:${c.kind}`, c.kind === 'boss1' ? 'The Brood Mother' : 'The Warden', c.kind === 'boss1' ? ['She is only asleep again. The gate to the right has opened.'] : ['The Heart is quiet. The way out is open at the far end.']);
    } else {
      // a creature leaves a crystal
      r.xp++;
      r.crystals++;
      ev(r, 'crystal', { x: c.x, y: c.y });
    }
  }
}

function stepCreature(r: Run, c: Creature, dt: number): void {
  const p = r.p;
  c.t += dt;
  c.flash = Math.max(0, c.flash - dt);
  c.stagger = Math.max(0, c.stagger - dt);
  const dx = p.x + p.w / 2 - (c.x + c.w / 2);
  const dy = p.y + p.h / 2 - (c.y + c.h / 2);
  const ground = (b: Body) => moveBody(b, dt, (tx, ty) => solidAt(r, tx, ty));
  if (c.stagger > 0) return;
  switch (c.kind) {
    case 'crawler': {
      c.vy = Math.min(FEEL.fall, c.vy + FEEL.gravity * dt);
      c.vx = c.dir * 26;
      ground(c);
      if (c.wall) c.dir = -c.dir;
      else if (c.onGround && !solidAt(r, Math.floor((c.x + (c.dir > 0 ? c.w + 2 : -2)) / TS), Math.floor((c.y + c.h + 2) / TS))) c.dir = -c.dir;
      break;
    }
    case 'frog': {
      c.vy = Math.min(FEEL.fall, c.vy + FEEL.gravity * dt);
      if (c.onGround) {
        c.vx = 0;
        c.hop -= dt;
        if (c.hop <= 0) {
          c.dir = dx < 0 ? -1 : 1;
          if (Math.abs(dx) < 130) (c.vx = c.dir * 52), (c.vy = -230);
          c.hop = 1.3;
        }
      }
      ground(c);
      break;
    }
    case 'flutter': {
      const home = Math.abs(dx) < 100 ? Math.sign(dx) * 34 : Math.cos(c.t * 0.8) * 20;
      c.x += home * dt;
      c.y = c.hy + Math.sin(c.t * 2.6) * 18 + (Math.abs(dx) < 100 ? Math.max(-20, Math.min(20, dy)) * 0.4 : 0);
      c.x = Math.max(TS, Math.min((RW - 1) * TS - c.w, c.x));
      c.dir = home >= 0 ? 1 : -1;
      break;
    }
    case 'slug': {
      c.cd -= dt;
      if (c.cd <= 0 && Math.abs(dx) < 4 * TS) {
        c.cd = 2.4;
        r.projs.push({ x: c.x + c.w / 2 - 2, y: c.y + c.h, vx: 0, vy: 40, w: 5, h: 6, foe: true, dmg: 1, life: 3, grav: true, kind: 'goo' });
        ev(r, 'drip', { x: c.x, y: c.y });
      }
      break;
    }
    case 'fish': {
      const x0 = c.x;
      c.x += c.dir * (28 + (Math.abs(dx) < 90 ? 18 : 0)) * dt;
      c.y += Math.sin(c.t * 3) * 8 * dt + (Math.abs(dx) < 90 ? Math.sign(dy) * 12 * dt : 0);
      const tx = Math.floor((c.x + (c.dir > 0 ? c.w : 0)) / TS);
      if (tileAt(r, tx, Math.floor((c.y + c.h / 2) / TS)) !== '~') ((c.x = x0), (c.dir = -c.dir));
      if (tileAt(r, Math.floor((c.x + c.w / 2) / TS), Math.floor((c.y - 2) / TS)) !== '~') c.y += 3;
      if (tileAt(r, Math.floor((c.x + c.w / 2) / TS), Math.floor((c.y + c.h + 2) / TS)) !== '~') c.y -= 3;
      break;
    }
    case 'boss1': {
      // the Brood Mother: walks, charges, then calls her young, then lobs goo
      c.vy = Math.min(FEEL.fall, c.vy + FEEL.gravity * dt);
      c.cd -= dt;
      const charging = c.t % (c.phase === 1 ? 5 : c.phase === 2 ? 4.2 : 3.6) > (c.phase === 1 ? 4 : c.phase === 2 ? 3.3 : 2.7);
      c.dir = dx < 0 ? -1 : 1;
      c.vx = c.dir * (charging ? 105 + c.phase * 8 : 24);
      ground(c);
      if (c.wall) c.t -= 1.2;
      if (c.phase >= 2 && c.cd <= 0) {
        c.cd = c.phase === 2 ? 5 : 7;
        const k = mkCreature('crawler', Math.floor(c.x / TS), Math.floor((c.y + c.h - 4) / TS), r.level);
        k.hp = 1;
        k.max = 1;
        r.creatures.push(k);
        ev(r, 'spawn', { x: c.x, y: c.y });
      }
      if (c.phase === 3 && Math.floor(c.t * 2) % 5 === 0 && Math.floor(c.t * 2 - dt * 2) % 5 !== 0) for (let i = -1; i <= 1; i++) r.projs.push({ x: c.x + c.w / 2, y: c.y, vx: i * 50 + c.dir * 30, vy: -170, w: 6, h: 6, foe: true, dmg: 1, life: 3, grav: true, kind: 'goo' });
      break;
    }
    case 'boss2': {
      // the Warden: hangs over you, fires bolts, then slams the floor, then both
      const want = Math.max(2 * TS, Math.min((RW - 2) * TS - c.w, p.x - c.w / 2 + Math.sin(c.t * 0.9) * 50));
      c.x += (want - c.x) * Math.min(1, dt * (0.9 + c.phase * 0.5));
      c.y = 5 * TS + Math.sin(c.t * 1.6) * 14 + (c.phase === 3 ? 20 : 0);
      c.dir = dx < 0 ? -1 : 1;
      c.cd -= dt;
      if (c.cd <= 0) {
        const n = c.phase === 3 ? 3 : 1;
        for (let i = 0; i < n; i++) {
          const a = Math.atan2(dy + (i - (n - 1) / 2) * 30, dx || 1);
          r.projs.push({ x: c.x + c.w / 2, y: c.y + c.h / 2, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, w: 7, h: 7, foe: true, dmg: 1, life: 4, grav: false, kind: 'bolt' });
        }
        ev(r, 'bolt', { x: c.x, y: c.y });
        c.cd = c.phase === 1 ? 2.2 : c.phase === 2 ? 1.9 : 1.5;
        if (c.phase >= 2 && Math.floor(c.t / c.cd) % 2 === 0) {
          for (const d of [-1, 1]) r.projs.push({ x: c.x + c.w / 2 - 6, y: (RH - 2) * TS + 4, vx: d * 80, vy: 0, w: 12, h: 10, foe: true, dmg: 1, life: 5, grav: false, kind: 'wave' });
          ev(r, 'slam', { x: c.x, y: c.y });
        }
      }
      break;
    }
    default:
      break;
  }
}

/** One fixed step. */
export function step(r: Run, dt: number, input: Cmd): void {
  const p = r.p;
  r.t += dt;
  p.anim += dt;
  p.sq *= 0.86;
  p.inv = Math.max(0, p.inv - dt);
  p.fireCool = Math.max(0, p.fireCool - dt);
  r.shake = Math.max(0, r.shake - dt);
  if (r.ended) {
    r.endT += dt;
    return;
  }
  r.time += dt;
  const c = r.bot ? r.cmd : input;
  if (r.dead) {
    r.deadT += dt;
    p.vy = Math.min(FEEL.fall, p.vy + FEEL.gravity * dt);
    p.y += p.vy * dt;
    if (r.deadT > 1.1) respawn(r);
    return;
  }
  if (r.bot && r.time - r.lastNew > 300) {
    r.out = true;
    return;
  }
  // ---- the body
  p.wet = wet(r, p);
  const swim = p.wet ? 0.55 : 1;
  const want = (c.right ? 1 : 0) - (c.left ? 1 : 0);
  const a = (p.onGround ? FEEL.accelGround : FEEL.accelAir) * dt * 60;
  p.vx = want ? toward(p.vx, want * FEEL.walk * (p.wet ? 0.6 : 1), a) : toward(p.vx, 0, a);
  if (want) p.face = want;
  p.aimUp = c.up && !want ? true : c.up;
  p.coyote = p.onGround ? FEEL.coyote : Math.max(0, p.coyote - dt);
  if (p.onGround) p.jumps = r.tools.boots ? 2 : 1;
  p.buffer = c.jumpPressed ? FEEL.buffer : Math.max(0, p.buffer - dt);
  if (p.buffer > 0 && (p.coyote > 0 || (p.jumps > 0 && !p.onGround && (r.tools.boots || p.wet)))) {
    const ground = p.coyote > 0;
    p.vy = -FEEL.jump * (p.wet ? 0.72 : ground ? 1 : 0.92);
    p.buffer = 0;
    p.coyote = 0;
    p.cut = false;
    p.sq = -0.3;
    if (!ground && !p.wet) p.jumps = Math.max(0, p.jumps - 1);
    else if (ground) p.jumps = Math.max(0, (r.tools.boots ? 2 : 1) - 1);
    ev(r, ground ? 'jump' : 'jump2', { x: p.x, y: p.y + p.h });
  }
  if (!c.jump && p.vy < 0 && !p.cut) {
    p.vy *= FEEL.cut;
    p.cut = true;
  }
  p.vy = Math.min(FEEL.fall * swim, p.vy + FEEL.gravity * dt * (p.wet ? 0.45 : 1));
  const vy0 = p.vy;
  const wasAir = !p.onGround;
  moveBody(p, dt, (tx, ty) => solidAt(r, tx, ty));
  if (p.onGround && wasAir && vy0 > 140) {
    p.sq = Math.min(0.45, 0.12 + vy0 / 1300);
    ev(r, 'land', { x: p.x, y: p.y + p.h, n: vy0 });
  }
  if (c.fire) fireBlaster(r);
  if (c.use) use(r);
  // ---- the doors
  const cx = p.x + p.w / 2;
  const ex = r.room.exits;
  const go = (e: { to: string; ax?: number; ay?: number }, side: 'L' | 'R' | 'U' | 'D') => {
    const y = p.y;
    const from = r.room.id;
    if (side === 'L') loadRoom(r, e.to, { x: (RW - 1) * TS - p.w - 1, y: Math.min(y, 14 * TS - p.h) });
    else if (side === 'R') loadRoom(r, e.to, { x: TS + 1, y: Math.min(y, 14 * TS - p.h) });
    else loadRoom(r, e.to, { x: (e.ax ?? 14) * TS + 3, y: (e.ay ?? 14) * TS + TS - p.h });
    if (side === 'U') p.vy = 0;
    ev(r, 'door', { id: e.to, kind: from });
  };
  if (cx < 0 && ex.L) go(ex.L, 'L');
  else if (cx > RW * TS && ex.R) go(ex.R, 'R');
  else if (p.y + p.h / 2 < 0 && ex.U) {
    if (!ex.U.needs || r.tools[ex.U.needs]) go(ex.U, 'U');
    else p.y = -p.h / 2;
  } else if (p.y > RH * TS + 6) {
    if (ex.D) go(ex.D, 'D');
    else {
      ev(r, 'slip');
      p.x = r.entry.x;
      p.y = r.entry.y;
      p.vx = 0;
      p.vy = 0;
      hurt(r, 1);
    }
  }
  // ---- what lies in the room
  for (const s of r.room.spawns) {
    const key = s.id ?? `${r.room.id}:${s.kind}:${s.x}:${s.y}`;
    if (s.kind === 'crystal' || s.kind === 'boots' || s.kind === 'blaster' || s.kind === 'lamp') {
      if (r.taken.has(key)) continue;
      const box = { x: s.x * TS + 2, y: s.y * TS + 2, w: 12, h: 12 };
      if (!overlaps(p, box)) continue;
      r.taken.add(key);
      if (s.kind === 'crystal') {
        r.xp++;
        r.crystals++;
        ev(r, 'crystal', { x: box.x, y: box.y });
      } else {
        r.tools[s.kind] = true;
        ev(r, 'tool', { kind: s.kind, id: s.kind });
        card(r, `tool:${s.kind}`, s.kind === 'boots' ? 'Spring Boots' : s.kind === 'blaster' ? 'Blaster' : 'Lamp', TOOL_FOUND[s.kind].card);
      }
    } else if (s.kind === 'end' && r.bosses.has('boss2') && overlaps(p, { x: s.x * TS - 8, y: s.y * TS - 40, w: 40, h: 64 })) {
      r.ended = true;
      r.endT = 0;
      ev(r, 'end', { n: r.crystals });
    }
  }
  // ---- creatures, shots, drops
  for (const cr of r.creatures) {
    if (!cr.alive) continue;
    stepCreature(r, cr, dt);
    if (cr.y > RH * TS + 30) cr.alive = false;
    if (cr.kind !== 'fish' || p.wet || true) if (overlaps({ x: p.x + 1, y: p.y + 1, w: p.w - 2, h: p.h - 2 }, cr)) hurt(r, 1, cr);
  }
  r.creatures = r.creatures.filter((q) => q.alive || q.flash > 0);
  for (const q of r.projs) {
    q.life -= dt;
    if (q.grav) q.vy += 420 * dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    const tx = Math.floor((q.x + q.w / 2) / TS);
    const ty = Math.floor((q.y + q.h / 2) / TS);
    const t = tileAt(r, tx, ty);
    if (!q.foe && (t === 'x' || t === '#' || t === 'G')) {
      q.life = 0;
      if (t === 'x') {
        // rubble gives way, a column at a time
        r.tiles[ty]![tx] = '.';
        if (tileAt(r, tx, ty - 1) === 'x') r.tiles[ty - 1]![tx] = '.';
        if (tileAt(r, tx, ty + 1) === 'x') r.tiles[ty + 1]![tx] = '.';
        ev(r, 'rubble', { x: tx * TS, y: ty * TS });
      } else ev(r, 'spark', { x: q.x, y: q.y });
    } else if (q.foe && (t === '#' || t === 'G') && q.kind !== 'wave') q.life = 0;
    if (!q.foe) {
      for (const cr of r.creatures) if (cr.alive && q.life > 0 && overlaps(q, cr)) (hitCreature(r, cr, q.dmg), (q.life = 0));
    } else if (q.life > 0 && overlaps(q, { x: p.x + 1, y: p.y + 1, w: p.w - 2, h: p.h - 2 })) {
      hurt(r, q.dmg, q);
      if (q.kind !== 'wave') q.life = 0;
    }
  }
  r.projs = r.projs.filter((q) => q.life > 0 && q.x > -20 && q.x < RW * TS + 20 && q.y < RH * TS + 20);
  for (const d of r.drips) {
    d.t += dt;
    if (d.state === 0 && d.t > 2.4) {
      d.state = 1;
      d.vy = 0;
      d.y = d.y;
    }
    if (d.state === 1) {
      d.vy += 380 * dt;
      d.y += d.vy * dt;
      const ty = Math.floor((d.y + 3) / TS);
      if (solidAt(r, Math.floor(d.x / TS), ty) || d.y > RH * TS) {
        d.state = 0;
        d.t = 0;
        d.y = 6 + 0 * ty;
        ev(r, 'splash', { x: d.x });
      } else if (overlaps(p, { x: d.x - 2, y: d.y - 2, w: 4, h: 8 })) {
        hurt(r, 1);
        d.state = 0;
        d.t = 0;
        d.y = 6;
      }
    }
  }
  r.camX += (Math.max(0, Math.min(RW * TS - 14 * TS, p.x - 5 * TS)) - r.camX) * Math.min(1, dt * 9);
}

/** Open or close the map. */
export const toggleMap = (r: Run): void => void (r.mapOpen = !r.mapOpen);
/** The boss in the room, if there is one alive. */
export const bossOf = (r: Run): Creature | null => r.creatures.find((c) => c.boss && c.alive) ?? null;

// ---------------------------------------------------------------- Ghosty's hands

/**
 * Ghosty's walk through the cave: head for the next cell of the room's route, jump what is in the way, take the second jump
 * at the top of a hop that needs it, shoot what is in front and the rubble, stand off a boss and fire, and light a lantern when
 * hurt. `th[0]` is how far off he starts a hop, `th[1]` how far off he fires at a creature, `th[2]` leans him toward the safe side
 * of a boss (above zero, further back).
 */
export function botStep(r: Run, th: readonly number[]): void {
  const p = r.p;
  r.bot = true;
  const c = r.cmd;
  c.left = false;
  c.right = false;
  c.up = false;
  c.fire = false;
  c.use = false;
  c.jumpPressed = false;
  const cxp = p.x + p.w / 2;
  const feet = Math.floor((p.y + p.h - 1) / TS);
  const route = r.room.route;
  const boss = bossOf(r);
  // a lantern when hurt, in a room that has one
  const lan = r.room.spawns.find((s) => s.kind === 'lantern');
  let goalX = 0;
  let goalCellY = 0;
  let toLantern = false;
  if (lan && r.hearts < r.maxHearts && (!boss || Math.abs(boss.x - p.x) > 200)) {
    goalX = lan.x * TS + 8;
    goalCellY = lan.y;
    toLantern = true;
  } else {
    const wp = route[Math.min(r.botIdx, route.length - 1)]!;
    goalX = wp[0] * TS + 8;
    goalCellY = wp[1];
    if (r.botIdx < route.length - 1 && Math.abs(cxp - goalX) < 9 && Math.abs(feet - goalCellY) <= 1) r.botIdx++;
    else if (r.botIdx === route.length - 1 && goalCellY >= 0 && Math.abs(cxp - goalX) < 6 && r.room.id !== 'landing') {
      /* at the last cell: walk on to the door */
    }
    if (r.botIdx === route.length - 1) {
      const last = route[route.length - 1]!;
      if (last[1] >= 0) goalX = last[0] >= 24 ? (RW + 1) * TS : goalX;
    }
  }
  if (boss && !toLantern) {
    // stand off the boss, face it, fire, hop what comes
    const bx = boss.x + boss.w / 2;
    const dist = Math.abs(cxp - bx);
    const keep = Math.max(110, Math.min(190, th[1] ?? 150)) * (1 + Math.max(0, Math.min(0.25, th[2] ?? 0)));
    const dir = bx < cxp ? -1 : 1;
    if (boss.kind === 'boss1') {
      if (dist > keep + 80) (c.left = dir < 0), (c.right = dir > 0);
      p.face = dir;
      if (p.onGround && ((dist < 170 && dist > 110 && Math.abs(boss.vx) > 60 && r.t % 1 < 0.5) || dist < 40)) {
        c.jump = true;
        c.jumpPressed = true;
        r.botHold = 0.34;
      }
      c.jump = c.jump || r.botHold > 0;
      r.botHold = Math.max(0, r.botHold - 1 / 60);
      if (!c.left && !c.right) p.face = dir;
    } else {
      p.face = dir;
      c.up = boss.y + boss.h < p.y - 10 && Math.abs(cxp - bx) < 28;
      c.fire = true;
      if (cxp < 40) c.right = true;
      else if (cxp > (RW - 2) * TS) c.left = true;
      else if (Math.abs(r.t % 3 - 1.5) < 0.75) c.left = true;
      else c.right = true;
      c.fire = true;
      c.up = c.up || boss.y + boss.h < p.y - 30;
      if (p.onGround && r.projs.some((q) => q.foe && q.kind === 'wave' && Math.abs(q.x - cxp) < 30)) (c.jump = true), (c.jumpPressed = true);
    }
    c.fire = true;
    return;
  }
  const dx = goalX - cxp;
  if (Math.abs(dx) > 5) {
    c.right = dx > 0;
    c.left = dx < 0;
  }
  const dir = dx > 0 ? 1 : -1;
  const frontX = dir > 0 ? p.x + p.w : p.x;
  const solid = (tx: number, ty: number) => solidAt(r, tx, ty) || tileAt(r, tx, ty) === 'x';
  let want = false;
  const dyCells = goalCellY - feet;
  if (p.onGround) {
    if (dyCells <= -1) {
      const roofed = (col: number) => [1, 2, 3, 4].some((k) => solid(col, Math.floor(p.y / TS) - k));
      const under = (x: number) => roofed(Math.floor((x - 3) / TS)) || roofed(Math.floor((x + p.w + 3) / TS));
      if (Math.abs(dx) <= (th[0] ?? 100) && under(p.x)) {
        // under a ledge: step out to the nearest open place before the hop
        for (let k = 1; k <= 12; k++) {
          const side = [-k, k].find((q) => !under(p.x + q * 8));
          if (side !== undefined) {
            c.left = side < 0;
            c.right = side > 0;
            break;
          }
        }
      } else if (Math.abs(dx) <= (th[0] ?? 100)) want = true;
    }
    if (solid(Math.floor((frontX + dir * 4) / TS), feet) && tileAt(r, Math.floor((frontX + dir * 4) / TS), feet) !== 'x') want = true;
    if (goalCellY < 0 && Math.abs(dx) < 10) want = true;
  } else if (dyCells <= -1) {
    // rising beside a ledge: go straight up until the feet are above its top, then over
    const fx = Math.floor((frontX + dir * 3) / TS);
    if (solid(fx, Math.floor(p.y / TS)) || solid(fx, feet) || solid(fx, Math.floor(p.y / TS) - 1)) (c.left = false), (c.right = false);
  }
  if (!p.onGround && r.tools.boots && p.jumps > 0 && p.vy > -60 && (goalCellY < 0 || p.y + p.h > (goalCellY + 1) * TS - 1) && dyCells <= -1 && Math.abs(dx) < 140) {
    c.jumpPressed = true;
    r.botHold = 0.34;
    want = true;
  }
  // a creature in the way: fire if armed, hop it if not
  const armed = r.tools.blaster;
  for (const cr of r.creatures) {
    if (!cr.alive || cr.boss) continue;
    const ddx = cr.x + cr.w / 2 - cxp;
    const ddy = cr.y + cr.h / 2 - (p.y + p.h / 2);
    if (Math.sign(ddx) !== dir && Math.abs(ddx) > 4) continue;
    if (cr.kind === 'slug') continue;
    if (armed && Math.abs(ddx) < (th[1] ?? 150) && Math.abs(ddy) < 22) {
      c.fire = true;
      p.face = dir;
    } else if (armed && Math.abs(ddx) < 80 && ddy < -22 && ddy > -80) {
      c.fire = true;
      c.up = Math.abs(ddx) < 22;
    } else if (!armed && Math.abs(ddx) < 38 && Math.abs(ddy) < 20 && p.onGround) want = true;
  }
  // rubble in the way: shoot it
  if (armed) for (let k = 1; k <= 4; k++) if (tileAt(r, Math.floor((frontX + dir * k * 8) / TS), feet) === 'x') (c.fire = true), (p.face = dir);
  if (want && p.onGround) {
    c.jumpPressed = true;
    r.botHold = 0.34;
  }
  c.jump = want || r.botHold > 0;
  r.botHold = Math.max(0, r.botHold - 1 / 60);
  if (toLantern && Math.abs(dx) < 12 && Math.abs(feet - goalCellY) <= 1) {
    r.botUse -= 1 / 60;
    if (r.botUse <= 0) (c.use = true), (r.botUse = 0.5);
  }
  // not getting anywhere: a hop and a turn
  r.botStuck += Math.abs(p.x - r.botX) < 0.3 && Math.abs(dx) > 10 ? 1 / 60 : -r.botStuck;
  r.botX = p.x;
  if (r.botStuck > 0.8) {
    c.jumpPressed = true;
    c.jump = true;
    r.botHold = 0.3;
    if (r.botStuck > 2.4) r.botStuck = 0;
  }
}

/** One whole run of the real rules played by the bot `theta`, headless (Ghosty's practice, the node test). */
export function headless(theta: readonly number[], level: number, seed: number, maxSeconds = 360): { score: number; passed: boolean; run: Run } {
  const r = newRun(seed, level);
  for (let n = 0; !isOver(r) && n < maxSeconds * 60; n++) {
    botStep(r, theta);
    step(r, 1 / 60, NOCMD());
    r.events.length = 0;
  }
  return { score: score(r), passed: r.ended, run: r };
}

// ---------------------------------------------------------------- the GYM's way in

export interface CaveObs {
  tiles: number[];
  vx: number;
  vy: number;
  onGround: boolean;
  hearts: number;
  room: number;
  tools: number;
  boss: number;
}
export const CAVE_ACTIONS = ['none', 'left', 'right', 'jump', 'rightjump', 'fire', 'use'] as const;
export type CaveAction = (typeof CAVE_ACTIONS)[number];
export function caveLearnable(seed = 1, level = 1): Learnable<CaveObs, CaveAction> & { run: Run } {
  const run = newRun(seed, level);
  let held = false;
  return {
    run,
    id: 'cave',
    actions: CAVE_ACTIONS,
    observe: () => {
      const p = run.p;
      const cx = Math.floor((p.x + p.w / 2) / TS);
      const cy = Math.floor((p.y + p.h / 2) / TS);
      const tiles: number[] = [];
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -4; dx <= 4; dx++) {
          const t = tileAt(run, cx + dx, cy + dy);
          const foe = run.creatures.some((e) => e.alive && Math.floor((e.x + e.w / 2) / TS) === cx + dx && Math.floor((e.y + e.h / 2) / TS) === cy + dy);
          tiles.push(foe ? 3 : t === '#' || t === 'x' || t === 'G' ? 1 : t === '~' ? 2 : 0);
        }
      const boss = bossOf(run);
      return { tiles, vx: p.vx, vy: p.vy, onGround: p.onGround, hearts: run.hearts, room: run.room.n, tools: Object.values(run.tools).filter(Boolean).length, boss: boss ? boss.hp / boss.max : 0 };
    },
    act(a) {
      const jump = a === 'jump' || a === 'rightjump';
      const c: Cmd = { left: a === 'left', right: a === 'right' || a === 'rightjump', up: false, jump, jumpPressed: jump && !held, fire: a === 'fire', use: a === 'use' };
      held = jump;
      step(run, 1 / 60, c);
      run.events.length = 0;
    },
    score: () => score(run),
    done: () => isOver(run),
  };
}
