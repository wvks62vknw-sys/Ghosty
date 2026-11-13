/**
 * ONE RUNTIME PLAYS ANY GAME (BRIEF-EDITOR-GAME-STUDIO): the rules of a game of the studio, pure and headless. It stands on
 * the platformer's and the cave's body core (arcade/games/platform/core.ts: a body moving through a grid of 16-pixel tiles
 * one axis at a time, the platformer's jump feel) and on the cave's idea of rooms, doors and save points; a top-down game
 * is the same body with gravity off. Nothing here draws or touches the page: the arcade's engine (runtime.ts) and the
 * exported page (player.ts) both step this and draw it with draw.ts, and the node test steps it with scripted inputs.
 */
import { type Body, body, FEEL, moveBody, overlaps, toward } from '../arcade/games/platform/core';
import { ENEMY_LETTER, type EnemyKind, type Game, isSolidLetter, type Npc, type Quest, type Room, stepWords, type Thing, tileAt, TS } from './model';

export interface Input {
  held: ReadonlySet<string>;
  pressed: ReadonlySet<string>;
}
export const NOINPUT: Input = { held: new Set(), pressed: new Set() };
export const STEP = 1 / 60;

export interface Ev {
  type: string;
  text?: string;
  n?: number;
  id?: string;
}
export interface Enemy {
  key: string;
  kind: EnemyKind;
  b: Body;
  x0: number;
  y0: number;
  dir: number;
  t: number;
  alive: boolean;
  hop: number;
}
export interface NpcState {
  key: string;
  id: string;
  b: Body;
  x0: number;
  y0: number;
  dir: number;
  t: number;
}
export interface QuestState {
  i: number;
  base: number;
  done: boolean;
}
export interface Dialog {
  npc: string;
  name: string;
  pages: string[];
  i: number;
}
export type Sheet = null | { kind: 'shop'; npc: string } | { kind: 'items' };

export interface Play {
  game: Game;
  rid: string;
  room: Room;
  b: Body;
  face: number;
  anim: 'idle' | 'walk' | 'jump' | 'hurt' | 'talk';
  hearts: number;
  lives: number;
  coins: number;
  inv: Record<string, number>;
  opened: Set<string>;
  gone: Set<string>;
  chests: Set<string>;
  seen: Set<string>;
  quests: Record<string, QuestState>;
  picked: Record<string, number>;
  kills: Record<string, number>;
  talked: Record<string, number>;
  ready: Set<string>;
  enemies: Map<string, Enemy[]>;
  npcs: Map<string, NpcState[]>;
  spawn: { rid: string; x: number; y: number };
  atSave: string;
  sign: string;
  said: string;
  saidT: number;
  dialog: Dialog | null;
  sheet: Sheet;
  power: { jump: number; crates: number };
  invuln: number;
  coyote: number;
  buffer: number;
  cool: number;
  axis: 'x' | 'y';
  timeLeft: number;
  t: number;
  over: '' | 'won' | 'lost';
  why: string;
  events: Ev[];
  lastDoor: number;
  /** Standing on the door he just came through: it does not take him back until he has stepped off it. */
  arrived: boolean;
}

const platformer = (p: Play) => p.game.kind === 'platformer';
const PW = 10;
const PH = 14;
const emit = (p: Play, type: string, extra: Partial<Ev> = {}) => p.events.push({ type, ...extra });
const say = (p: Play, text: string, secs = 3) => {
  p.said = text;
  p.saidT = secs;
  emit(p, 'say', { text });
};
export const drain = (p: Play): Ev[] => p.events.splice(0);

const thingOf = (g: Game, id: string): Thing | undefined => g.things.find((t) => t.id === id);
const npcOf = (g: Game, id: string): Npc | undefined => g.npcs.find((n) => n.id === id);
const roomOf = (g: Game, id: string): Room | undefined => g.rooms.find((r) => r.id === id);
const keyOf = (rid: string, x: number, y: number) => `${rid}:${x},${y}`;

function findStart(room: Room): [number, number] {
  for (let y = 0; y < room.h; y++) {
    const x = room.rows[y]!.indexOf('P');
    if (x >= 0) return [x, y];
  }
  return [1, 1];
}

/** Put the player on a tile (feet at the tile's bottom for a platformer, centred for a top-down game). */
function place(p: Play, x: number, y: number): void {
  const [bw, bh] = platformer(p) ? [PW, PH] : [12, 12];
  p.b = body(x * TS + (TS - bw) / 2, platformer(p) ? (y + 1) * TS - bh : y * TS + (TS - bh) / 2, bw, bh);
}

function populate(p: Play, rid: string): void {
  const room = roomOf(p.game, rid);
  if (!room) return;
  if (!p.enemies.has(rid)) {
    const list: Enemy[] = [];
    const nl: NpcState[] = [];
    for (let y = 0; y < room.h; y++)
      for (let x = 0; x < room.w; x++) {
        const c = room.rows[y]![x]!;
        const k = ENEMY_LETTER[c];
        if (k) {
          const key = keyOf(rid, x, y);
          const sz = k === 'flyer' ? 12 : 12;
          list.push({ key, kind: k, b: body(x * TS + 2, y * TS + (TS - sz), sz, sz), x0: x * TS + 2, y0: y * TS + (TS - sz), dir: -1, t: 0, alive: !p.gone.has(key), hop: 0 });
        } else if (c === 'N') {
          const id = room.marks[`${x},${y}`] ?? '';
          if (npcOf(p.game, id)) nl.push({ key: keyOf(rid, x, y), id, b: body(x * TS + 2, y * TS + 2, 12, 12), x0: x * TS + 2, y0: y * TS + 2, dir: 1, t: 0 });
        }
      }
    p.enemies.set(rid, list);
    p.npcs.set(rid, nl);
  }
}

export function newPlay(game: Game, o: { resume?: string | null; room?: string; at?: [number, number]; seed?: number } = {}): Play {
  const room = roomOf(game, o.room ?? game.start) ?? game.rooms[0]!;
  const p: Play = {
    game,
    rid: room.id,
    room,
    b: body(0, 0, PW, PH),
    face: 1,
    anim: 'idle',
    hearts: game.player.hearts,
    lives: game.rules.lives,
    coins: 0,
    inv: {},
    opened: new Set(),
    gone: new Set(),
    chests: new Set(),
    seen: new Set(),
    quests: {},
    picked: {},
    kills: {},
    talked: {},
    ready: new Set(),
    enemies: new Map(),
    npcs: new Map(),
    spawn: { rid: room.id, x: 0, y: 0 },
    atSave: '',
    sign: '',
    said: '',
    saidT: 0,
    dialog: null,
    sheet: null,
    power: { jump: 0, crates: 0 },
    invuln: 0,
    coyote: 0,
    buffer: 0,
    cool: 0,
    axis: 'x',
    timeLeft: game.rules.timer,
    t: 0,
    over: '',
    why: '',
    events: [],
    lastDoor: 0,
    arrived: false,
  };
  for (const q of game.quests) p.quests[q.id] = { i: 0, base: 0, done: false };
  const [sx, sy] = o.at ?? findStart(room);
  p.spawn = { rid: room.id, x: sx, y: sy };
  place(p, sx, sy);
  populate(p, room.id);
  if (o.resume) restore(p, o.resume);
  else for (const q of game.quests) activate(p, q);
  return p;
}

// ---------------------------------------------------------------- the save: the whole game state
export function snap(p: Play): string {
  return JSON.stringify({
    v: 1,
    game: p.game.id,
    rid: p.rid,
    x: Math.round(p.b.x * 100) / 100,
    y: Math.round(p.b.y * 100) / 100,
    face: p.face,
    hearts: p.hearts,
    lives: p.lives,
    coins: p.coins,
    inv: p.inv,
    opened: [...p.opened].sort(),
    gone: [...p.gone].sort(),
    chests: [...p.chests].sort(),
    seen: [...p.seen].sort(),
    quests: p.quests,
    picked: p.picked,
    kills: p.kills,
    talked: p.talked,
    ready: [...p.ready].sort(),
    spawn: p.spawn,
    timeLeft: Math.round(p.timeLeft * 10) / 10,
    power: p.power,
  });
}
function restore(p: Play, raw: string): void {
  let s: Record<string, unknown>;
  try {
    s = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return;
  }
  const room = roomOf(p.game, String(s.rid));
  if (!room) return;
  p.rid = room.id;
  p.room = room;
  p.face = Number(s.face) || 1;
  p.hearts = Number(s.hearts) || p.game.player.hearts;
  p.lives = Number(s.lives) || p.game.rules.lives;
  p.coins = Number(s.coins) || 0;
  p.inv = (s.inv as Record<string, number>) ?? {};
  p.opened = new Set(s.opened as string[]);
  p.gone = new Set(s.gone as string[]);
  p.chests = new Set(s.chests as string[]);
  p.seen = new Set(s.seen as string[]);
  p.quests = { ...p.quests, ...((s.quests as Record<string, QuestState>) ?? {}) };
  p.picked = (s.picked as Record<string, number>) ?? {};
  p.kills = (s.kills as Record<string, number>) ?? {};
  p.talked = (s.talked as Record<string, number>) ?? {};
  p.ready = new Set(s.ready as string[]);
  p.spawn = (s.spawn as Play['spawn']) ?? p.spawn;
  p.timeLeft = Number(s.timeLeft) || p.game.rules.timer;
  p.power = (s.power as Play['power']) ?? { jump: 0, crates: 0 };
  p.enemies.clear();
  p.npcs.clear();
  populate(p, room.id);
  place(p, 0, 0);
  p.b.x = Number(s.x);
  p.b.y = Number(s.y);
  p.atSave = 'restored';
  p.arrived = true;
}

// ---------------------------------------------------------------- quests
const stepOf = (q: Quest, st: QuestState) => q.steps[st.i];
function counter(p: Play, s: NonNullable<ReturnType<typeof stepOf>>): number {
  if (s.t === 'talk') return p.talked[s.npc] ?? 0;
  if (s.t === 'collect') return p.picked[s.thing] ?? 0;
  if (s.t === 'defeat') return p.kills[s.kind] ?? 0;
  return 0;
}
function activate(p: Play, q: Quest): void {
  const st = p.quests[q.id]!;
  const s = stepOf(q, st);
  st.base = s ? counter(p, s) : 0;
}
export function progress(p: Play, q: Quest): number {
  const st = p.quests[q.id]!;
  const s = stepOf(q, st);
  return s ? counter(p, s) - st.base : 0;
}
function giveReward(p: Play, q: Quest): void {
  const w = q.reward;
  if (w.coins) p.coins += w.coins;
  if (w.item) {
    p.inv[w.item] = (p.inv[w.item] ?? 0) + 1;
    p.picked[w.item] = (p.picked[w.item] ?? 0) + 1;
  }
  if (w.door) p.opened.add(w.door);
  const bits = [w.coins ? `${w.coins} coin${w.coins === 1 ? '' : 's'}` : '', w.item ? (thingOf(p.game, w.item)?.name ?? '') : ''].filter(Boolean);
  say(p, w.line || (bits.length ? `Reward: ${bits.join(' and ')}.` : `Done: ${q.name}.`));
}
function advance(p: Play): void {
  for (const q of p.game.quests) {
    const st = p.quests[q.id]!;
    let guard = 0;
    while (!st.done && q.steps.length && guard++ < 12) {
      const s = stepOf(q, st)!;
      let ok = false;
      if (s.t === 'reach') {
        const tx = Math.floor((p.b.x + p.b.w / 2) / TS);
        const ty = Math.floor((p.b.y + p.b.h / 2) / TS);
        ok = p.rid === s.room && (s.x === undefined || s.y === undefined || (Math.abs(tx - s.x) <= 1 && Math.abs(ty - s.y) <= 1));
      } else ok = counter(p, s) - st.base >= needOf(s);
      if (!ok) break;
      st.i++;
      emit(p, 'step', { id: q.id, n: st.i });
      if (st.i >= q.steps.length) {
        st.done = true;
        emit(p, 'quest', { id: q.id, text: q.name });
        if (q.reward.inChest) {
          p.ready.add(q.id);
          say(p, `Done: ${q.name}. Its reward waits in a chest.`);
        } else giveReward(p, q);
      } else activate(p, q);
    }
  }
}
export const needOf = (s: { t: string; n?: number }): number => (s.t === 'talk' ? 1 : (s.n ?? 1));

/** The quest line as the player reads it: the first quest not done, its step as words. */
export function questLine(p: Play): string {
  for (const q of p.game.quests) {
    const st = p.quests[q.id];
    if (!st || st.done || !q.steps.length) continue;
    const s = stepOf(q, st);
    if (!s) continue;
    return `${q.name}: ${stepWords(p.game, s, progress(p, q))}`;
  }
  return p.game.quests.some((q) => q.steps.length) ? 'All quests done.' : '';
}

// ---------------------------------------------------------------- hurt, die, respawn
function hurt(p: Play, from: number): void {
  if (p.invuln > 0 || p.over) return;
  p.hearts--;
  p.invuln = 1.2;
  p.anim = 'hurt';
  p.b.vy = platformer(p) ? -150 : 0;
  p.b.vx = from * 110;
  emit(p, 'hurt');
  if (p.hearts <= 0) die(p);
}
function die(p: Play): void {
  p.lives--;
  emit(p, 'die');
  if (p.lives <= 0) {
    p.over = 'lost';
    p.why = 'Out of lives.';
    emit(p, 'lose');
    return;
  }
  p.hearts = p.game.player.hearts;
  respawn(p);
  say(p, `Back at your last safe spot. ${p.lives} ${p.lives === 1 ? 'life' : 'lives'} left.`);
}
function respawn(p: Play): void {
  if (p.rid !== p.spawn.rid) enter(p, p.spawn.rid);
  place(p, p.spawn.x, p.spawn.y);
  p.arrived = true;
  p.invuln = 1.5;
  emit(p, 'respawn');
}
function enter(p: Play, rid: string): void {
  const room = roomOf(p.game, rid);
  if (!room) return;
  p.rid = rid;
  p.room = room;
  p.sign = '';
  populate(p, rid);
  if (!p.game.rules.keepCoins) p.coins = 0;
}

// ---------------------------------------------------------------- the world as the body sees it
function solidFn(p: Play): (tx: number, ty: number) => boolean {
  const room = p.room;
  const g = p.game;
  const top = !platformer(p);
  return (tx, ty) => {
    if (tx < 0 || tx >= room.w) return true;
    if (ty < 0) return top;
    if (ty >= room.h) return top;
    const c = room.rows[ty]![tx]!;
    if (c === 'B') return !p.gone.has(keyOf(room.id, tx, ty));
    return isSolidLetter(g, c);
  };
}
const tileUnder = (p: Play, b: Body, dy = 0): string[] => {
  const out: string[] = [];
  for (let tx = Math.floor(b.x / TS); tx <= Math.floor((b.x + b.w - 0.01) / TS); tx++) out.push(tileAt(p.room, tx, Math.floor((b.y + b.h + dy) / TS)));
  return out;
};
const centre = (b: Body): [number, number] => [Math.floor((b.x + b.w / 2) / TS), Math.floor((b.y + b.h / 2) / TS)];
const touching = (p: Play, letter: string): [number, number] | null => {
  for (let ty = Math.floor(p.b.y / TS); ty <= Math.floor((p.b.y + p.b.h - 0.01) / TS); ty++)
    for (let tx = Math.floor(p.b.x / TS); tx <= Math.floor((p.b.x + p.b.w - 0.01) / TS); tx++) if (tileAt(p.room, tx, ty) === letter) return [tx, ty];
  return null;
};
const inWater = (p: Play): boolean => {
  const [cx, cy] = centre(p.b);
  return tileAt(p.room, cx, cy) === '~';
};

// ---------------------------------------------------------------- dialogue, shop, items
export function startDialog(p: Play, n: Npc): void {
  const fresh = n.lines.filter((l, i) => !(l.once && p.seen.has(`${n.id}#${i}`)));
  const pages = (fresh.length ? fresh : n.lines.slice(-1)).map((l) => l.text);
  n.lines.forEach((l, i) => {
    if (l.once) p.seen.add(`${n.id}#${i}`);
  });
  p.talked[n.id] = (p.talked[n.id] ?? 0) + 1;
  p.dialog = { npc: n.id, name: n.name, pages: pages.length ? pages : ['…'], i: 0 };
  p.b.vx = 0;
  emit(p, 'talk', { id: n.id });
  advance(p);
}
export function nextLine(p: Play): void {
  const d = p.dialog;
  if (!d) return;
  if (d.i < d.pages.length - 1) {
    d.i++;
    return;
  }
  p.dialog = null;
  emit(p, 'dlgend');
  const n = npcOf(p.game, d.npc);
  if (n?.shop.length) openShop(p, n.id);
}
export function openShop(p: Play, npc: string): void {
  p.sheet = { kind: 'shop', npc };
  emit(p, 'shop');
}
export function openItems(p: Play): void {
  if (p.dialog || p.over) return;
  p.sheet = { kind: 'items' };
  emit(p, 'items');
}
export function closeSheet(p: Play): void {
  p.sheet = null;
}
export function buy(p: Play, npcId: string, i: number): boolean {
  const it = npcOf(p.game, npcId)?.shop[i];
  const t = it && thingOf(p.game, it.thing);
  if (!it || !t) return false;
  if (p.coins < it.price) {
    say(p, `You need ${it.price} coin${it.price === 1 ? '' : 's'} for the ${t.name.toLowerCase()}, and you have ${p.coins}.`);
    emit(p, 'refuse');
    return false;
  }
  p.coins -= it.price;
  collect(p, t, 1, true);
  say(p, `You bought the ${t.name.toLowerCase()} for ${it.price} coin${it.price === 1 ? '' : 's'}.`);
  emit(p, 'buy', { id: t.id });
  return true;
}
export function sell(p: Play, thingId: string): boolean {
  const t = thingOf(p.game, thingId);
  if (!t || t.does !== 'sell' || (p.inv[t.id] ?? 0) < 1) return false;
  p.inv[t.id]!--;
  p.coins += t.value;
  say(p, `You sold the ${t.name.toLowerCase()} for ${t.value} coin${t.value === 1 ? '' : 's'}.`);
  emit(p, 'buy', { id: t.id });
  return true;
}
const deny = (p: Play, text: string): false => (say(p, text), false);
export function useItem(p: Play, thingId: string): boolean {
  const t = thingOf(p.game, thingId);
  if (!t || (p.inv[t.id] ?? 0) < 1) return false;
  if (t.does === 'heart') {
    if (p.hearts >= p.game.player.hearts) return deny(p, 'Your hearts are full already.');
    p.hearts = Math.min(p.game.player.hearts, p.hearts + Math.max(1, t.value));
  } else if (t.does === 'jump') p.power.jump = Math.max(1, t.value);
  else if (t.does === 'crates') p.power.crates = Math.max(1, t.value);
  else if (t.does === 'coin') p.coins += Math.max(1, t.value);
  else if (t.does === 'key') return deny(p, `Take the ${t.name.toLowerCase()} to its door.`);
  else return deny(p, t.does === 'sell' ? 'Sell it to someone who buys.' : `${t.name}: you keep it for a quest.`);
  p.inv[t.id]!--;
  say(p, t.does === 'heart' ? 'A heart back.' : `${t.name}: ${Math.round(t.value)} seconds.`);
  emit(p, 'use', { id: t.id });
  return true;
}
export function dropItem(p: Play, thingId: string): boolean {
  if ((p.inv[thingId] ?? 0) < 1) return false;
  p.inv[thingId]!--;
  emit(p, 'drop', { id: thingId });
  return true;
}

/** A thing comes into the player's hands (picked up, bought, rewarded). */
function collect(p: Play, t: Thing, n: number, quiet = false): void {
  p.picked[t.id] = (p.picked[t.id] ?? 0) + n;
  if (t.does === 'coin') {
    p.coins += Math.max(1, t.value) * n;
    emit(p, 'coin');
  } else if (t.does === 'heart') {
    p.hearts = Math.min(p.game.player.hearts, p.hearts + Math.max(1, t.value));
    emit(p, 'heal');
    if (!quiet) say(p, `${t.name}: a heart back.`);
  } else {
    p.inv[t.id] = (p.inv[t.id] ?? 0) + n;
    emit(p, 'pick', { id: t.id });
    if (!quiet) say(p, `You found the ${t.name.toLowerCase()}.`);
  }
}

// ---------------------------------------------------------------- the step
function interact(p: Play, inp: Input): void {
  const top = !platformer(p);
  const use = inp.pressed.has('b') || (top && inp.pressed.has('a'));
  const pcx = p.b.x + p.b.w / 2;
  const pcy = p.b.y + p.b.h / 2;
  // a door: walk into it (top-down) or press up or USE on it
  const dt = touching(p, 'D');
  if (!dt) p.arrived = false;
  if (dt && !p.arrived && p.t - p.lastDoor > 0.6) {
    const wants = top ? true : inp.pressed.has('up') || inp.pressed.has('b');
    if (wants) goThrough(p, dt[0], dt[1]);
  }
  if (use && !p.dialog && p.cool <= 0) {
    // a person
    const list = p.npcs.get(p.rid) ?? [];
    const near = list.map((n) => ({ n, d: Math.hypot(n.b.x + n.b.w / 2 - pcx, n.b.y + n.b.h / 2 - pcy) })).filter((x) => x.d < 24).sort((a, b) => a.d - b.d)[0];
    if (near) {
      const n = npcOf(p.game, near.n.id);
      if (n) return startDialog(p, n);
    }
    // a chest: the tile I am on or the one I face
    const [cx, cy] = centre(p.b);
    for (const [tx, ty] of [[cx, cy], [cx + p.face, cy], [cx, cy - 1], [cx, cy + 1], [cx - p.face, cy]] as const) {
      if (tileAt(p.room, tx, ty) === 'c' && !p.chests.has(keyOf(p.rid, tx, ty))) return openChest(p, tx, ty);
    }
    // a foe in reach
    const foes = (p.enemies.get(p.rid) ?? []).filter((e) => e.alive && Math.hypot(e.b.x + e.b.w / 2 - pcx, e.b.y + e.b.h / 2 - pcy) < 24);
    if (foes[0]) {
      p.cool = 0.4;
      return kill(p, foes[0]);
    }
  }
}
function goThrough(p: Play, tx: number, ty: number): void {
  const d = p.room.doors.find((x) => x.x === tx && x.y === ty);
  if (!d || !d.room) return void say(p, 'This door opens onto nothing yet.');
  if (d.locked && !p.opened.has(d.id)) {
    const key = p.game.things.find((t) => t.does === 'key' && t.door === d.id && (p.inv[t.id] ?? 0) > 0);
    if (!key) {
      const need = p.game.things.find((t) => t.does === 'key' && t.door === d.id);
      p.lastDoor = p.t;
      say(p, need ? `Locked. It needs the ${need.name.toLowerCase()}.` : 'Locked.');
      emit(p, 'locked');
      return;
    }
    p.inv[key.id]!--;
    p.opened.add(d.id);
    say(p, `The ${key.name.toLowerCase()} opens it.`);
    emit(p, 'unlock');
  }
  const to = roomOf(p.game, d.room);
  if (!to) return;
  if (to.lock.quest && !p.quests[to.lock.quest]?.done) {
    p.lastDoor = p.t;
    return void say(p, `That way is shut until you finish "${p.game.quests.find((q) => q.id === to.lock.quest)?.name ?? 'a quest'}".`);
  }
  if (to.lock.thing && (p.inv[to.lock.thing] ?? 0) < 1 && !(p.picked[to.lock.thing] ?? 0)) {
    p.lastDoor = p.t;
    return void say(p, `That way is shut until you hold the ${thingOf(p.game, to.lock.thing)?.name.toLowerCase() ?? 'thing'}.`);
  }
  enter(p, to.id);
  const back = to.doors.find((x) => x.id === d.door) ?? to.doors[0];
  const [bx, by] = back ? [back.x, back.y] : findStart(to);
  place(p, bx, by);
  p.spawn = { rid: to.id, x: bx, y: by };
  p.lastDoor = p.t;
  p.arrived = true;
  p.invuln = Math.max(p.invuln, 0.4);
  emit(p, 'door', { id: to.id });
  if (p.game.rules.end === 'room' && to.id === p.game.rules.endRoom) win(p, 'You reached the end.');
}
function openChest(p: Play, tx: number, ty: number): void {
  const k = keyOf(p.rid, tx, ty);
  const v = p.room.marks[`${tx},${ty}`] ?? '';
  if (v.startsWith('q:')) {
    const q = p.game.quests.find((x) => x.id === v.slice(2));
    if (!q || !p.quests[q.id]?.done) return void say(p, q ? `It is shut tight. It opens when you finish "${q.name}".` : 'It is shut tight.');
    if (!p.ready.has(q.id)) return void say(p, 'The chest is empty: you took what it held.');
    p.ready.delete(q.id);
    p.chests.add(k);
    giveReward(p, q);
    emit(p, 'chest');
    return;
  }
  p.chests.add(k);
  const t = thingOf(p.game, v);
  if (t) {
    collect(p, t, 1, true);
    say(p, `In the chest: the ${t.name.toLowerCase()}.`);
  } else say(p, 'The chest is empty.');
  emit(p, 'chest');
}
function kill(p: Play, e: Enemy): void {
  e.alive = false;
  p.gone.add(e.key);
  p.kills[e.kind] = (p.kills[e.kind] ?? 0) + 1;
  emit(p, 'kill', { id: e.kind });
}
function win(p: Play, why: string): void {
  if (p.over) return;
  p.over = 'won';
  p.why = why;
  emit(p, 'win');
}

function movePlayer(p: Play, dt: number, inp: Input): void {
  const g = p.game;
  const L = inp.held.has('left');
  const R = inp.held.has('right');
  const U = inp.held.has('up');
  const D = inp.held.has('down');
  const water = inWater(p);
  const sp = g.player.speed * (water ? 0.55 : 1);
  const b = p.b;
  if (platformer(p)) {
    const dir = (R ? 1 : 0) - (L ? 1 : 0);
    if (dir) p.face = dir;
    b.vx = toward(b.vx, dir * sp, b.onGround ? FEEL.accelGround * 1.2 : FEEL.accelAir * 1.2);
    const jumpV = g.player.jump * (p.power.jump > 0 ? 1.41 : 1) * (water ? 0.8 : 1);
    if (inp.pressed.has('a') || inp.pressed.has('up')) p.buffer = FEEL.buffer;
    p.buffer = Math.max(0, p.buffer - dt);
    p.coyote = b.onGround ? FEEL.coyote : Math.max(0, p.coyote - dt);
    b.vy = Math.min(water ? 70 : FEEL.fall, b.vy + FEEL.gravity * (water ? 0.35 : 1) * dt);
    if (p.buffer > 0 && (p.coyote > 0 || (water && inp.held.has('a')))) {
      b.vy = -jumpV;
      p.buffer = 0;
      p.coyote = 0;
      emit(p, 'jump');
    }
    if (b.vy < 0 && !(inp.held.has('a') || inp.held.has('up'))) b.vy = Math.max(b.vy, -jumpV * FEEL.cut);
    const prevBottom = b.y + b.h;
    const vyBefore = b.vy;
    moveBody(b, dt, solidFn(p));
    // a ledge holds the feet, from above only
    if (!b.onGround && vyBefore >= 0 && !D) {
      const row = Math.floor((b.y + b.h) / TS);
      for (let tx = Math.floor(b.x / TS); tx <= Math.floor((b.x + b.w - 0.01) / TS); tx++) {
        if (tileAt(p.room, tx, row) === 'p' && prevBottom <= row * TS + 0.6 && b.y + b.h > row * TS) {
          b.y = row * TS - b.h;
          b.vy = 0;
          b.onGround = true;
        }
      }
    }
    // a spring throws him up
    if (b.onGround && tileUnder(p, b, 0.5).includes('u')) {
      b.vy = -FEEL.jump * 1.45;
      b.onGround = false;
      emit(p, 'spring');
    }
    // breaking crates with the power
    if (p.power.crates > 0) {
      for (const [tx, ty] of b.bumped) if (tileAt(p.room, tx, ty) === 'B') p.gone.add(keyOf(p.rid, tx, ty));
      if (b.wall) {
        const [cx, cy] = centre(b);
        if (tileAt(p.room, cx + b.wall, cy) === 'B') p.gone.add(keyOf(p.rid, cx + b.wall, cy));
      }
    }
    p.anim = p.invuln > 1 ? 'hurt' : !b.onGround ? 'jump' : Math.abs(b.vx) > 8 ? 'walk' : 'idle';
    if (b.y > p.room.h * TS + 40) {
      hurt(p, 0);
      if (!p.over) {
        p.hearts = Math.max(0, p.hearts);
        respawn(p);
      }
    }
  } else {
    // top-down: four ways, one axis at a time (the last one pressed wins when both are)
    if ((L || R) && !(U || D)) p.axis = 'x';
    else if ((U || D) && !(L || R)) p.axis = 'y';
    else if (inp.pressed.has('left') || inp.pressed.has('right')) p.axis = 'x';
    else if (inp.pressed.has('up') || inp.pressed.has('down')) p.axis = 'y';
    const dx = (R ? 1 : 0) - (L ? 1 : 0);
    const dy = (D ? 1 : 0) - (U ? 1 : 0);
    b.vx = p.axis === 'x' ? dx * sp : 0;
    b.vy = p.axis === 'y' ? dy * sp : 0;
    if (p.axis === 'x' && dx) p.face = dx;
    moveBody(b, dt, solidFn(p));
    if (p.power.crates > 0) {
      const [cx, cy] = centre(b);
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if ((b.wall || b.vy === 0) && tileAt(p.room, cx + ax, cy + ay) === 'B' && ((ax && dx === ax) || (ay && dy === ay))) p.gone.add(keyOf(p.rid, cx + ax, cy + ay));
    }
    p.anim = p.invuln > 1 ? 'hurt' : dx || dy ? 'walk' : 'idle';
  }
}

function pickups(p: Play): void {
  const [x0, x1] = [Math.floor(p.b.x / TS), Math.floor((p.b.x + p.b.w - 0.01) / TS)];
  const [y0, y1] = [Math.floor(p.b.y / TS), Math.floor((p.b.y + p.b.h - 0.01) / TS)];
  let onSave = '';
  p.sign = '';
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++) {
      const c = tileAt(p.room, tx, ty);
      const k = keyOf(p.rid, tx, ty);
      if (c === 'o' && !p.gone.has(k)) {
        p.gone.add(k);
        const coin = p.game.things.find((t) => t.does === 'coin' && t.id === 'coin') ?? { id: 'coin', name: 'Coin', sprite: '', does: 'coin' as const, door: '', value: 1 };
        collect(p, coin, 1, true);
      } else if (c === 'T' && !p.gone.has(k)) {
        const t = thingOf(p.game, p.room.marks[`${tx},${ty}`] ?? '');
        p.gone.add(k);
        if (t) collect(p, t, 1);
      } else if (c === '^') {
        if (!platformer(p) || p.b.y + p.b.h > ty * TS + 6) hurt(p, p.face * -1);
      } else if (c === 'F') win(p, 'You reached the flag.');
      else if (c === 'i') p.sign = p.room.marks[`${tx},${ty}`] ?? '';
      else if (c === 'V') onSave = k;
    }
  if (onSave && p.atSave !== onSave) {
    p.atSave = onSave;
    const [sx, sy] = onSave.split(':')[1]!.split(',').map(Number) as [number, number];
    p.spawn = { rid: p.rid, x: sx, y: sy };
    p.hearts = p.game.player.hearts;
    emit(p, 'save');
    say(p, 'Saved.', 2);
  } else if (!onSave && p.atSave) p.atSave = '';
}

function stepEnemies(p: Play, dt: number): void {
  const solid = solidFn(p);
  const top = !platformer(p);
  const pb = p.b;
  for (const e of p.enemies.get(p.rid) ?? []) {
    if (!e.alive) continue;
    e.t += dt;
    const b = e.b;
    const speed = e.kind === 'shell' ? 18 : e.kind === 'hopper' ? 36 : 30;
    if (e.kind === 'flyer') {
      b.x += e.dir * 30 * dt;
      b.y = e.y0 + Math.sin(e.t * 2.2) * 14;
      const tx = Math.floor((b.x + (e.dir > 0 ? b.w : 0)) / TS);
      if (solid(tx, Math.floor((b.y + b.h / 2) / TS))) e.dir = -e.dir;
    } else if (e.kind === 'chaser') {
      const dx = pb.x - b.x;
      const dy = pb.y - b.y;
      const near = Math.hypot(dx, dy) < 90;
      if (top) {
        b.vx = near ? Math.sign(dx) * 38 : 0;
        b.vy = near ? Math.sign(dy) * 38 : 0;
        if (near && Math.abs(dx) > Math.abs(dy)) b.vy = 0;
        else if (near) b.vx = 0;
        moveBody(b, dt, solid);
      } else {
        b.vx = near ? Math.sign(dx) * 40 : 0;
        b.vy = Math.min(FEEL.fall, b.vy + FEEL.gravity * dt);
        moveBody(b, dt, solid);
      }
    } else {
      if (top) {
        b.vx = e.dir * speed;
        b.vy = 0;
        moveBody(b, dt, solid);
        if (b.wall) e.dir = -e.dir;
      } else {
        b.vx = e.dir * speed;
        b.vy = Math.min(FEEL.fall, b.vy + FEEL.gravity * dt);
        if (e.kind === 'hopper' && b.onGround) {
          e.hop += dt;
          if (e.hop > 1.2) {
            b.vy = -210;
            e.hop = 0;
          }
        }
        moveBody(b, dt, solid);
        if (b.wall) e.dir = -e.dir;
        else if (b.onGround && e.kind !== 'hopper') {
          const ahead = Math.floor((b.x + (e.dir > 0 ? b.w + 2 : -2)) / TS);
          const below = Math.floor((b.y + b.h + 2) / TS);
          if (!solid(ahead, below) && tileAt(p.room, ahead, below) !== 'p') e.dir = -e.dir;
        }
        if (b.y > p.room.h * TS + 64) {
          e.alive = false;
          p.gone.add(e.key);
        }
      }
    }
    if (p.over || !overlaps(pb, b)) continue;
    if (platformer(p) && pb.vy > 0 && pb.y + pb.h < b.y + b.h * 0.7) {
      kill(p, e);
      pb.vy = -200;
      emit(p, 'stomp');
    } else hurt(p, Math.sign(pb.x - b.x) || 1);
  }
}

function stepNpcs(p: Play, dt: number): void {
  const solid = solidFn(p);
  const top = !platformer(p);
  for (const s of p.npcs.get(p.rid) ?? []) {
    const n = npcOf(p.game, s.id);
    if (!n) continue;
    const b = s.b;
    s.t += dt;
    let vx = 0;
    let vy = 0;
    const dx = p.b.x - b.x;
    const dy = p.b.y - b.y;
    const dist = Math.hypot(dx, dy);
    if (!p.dialog && !p.sheet) {
      if (n.behaviour === 'walk') {
        const phase = Math.floor(s.t / 1.5 + (s.x0 % 7)) % 4;
        vx = phase === 0 ? 24 : phase === 2 ? -24 : 0;
        if (b.x < s.x0 - 3 * TS) vx = 24;
        if (b.x > s.x0 + 3 * TS) vx = -24;
      } else if (n.behaviour === 'patrol') {
        if (b.x > s.x0 + 4 * TS) s.dir = -1;
        else if (b.x < s.x0) s.dir = 1;
        vx = s.dir * 26;
      } else if (n.behaviour === 'follow' && dist > 26) {
        vx = Math.sign(dx) * 36;
        if (top && Math.abs(dy) > 4) vy = Math.sign(dy) * 36;
      } else if (n.behaviour === 'flee' && dist < 52) {
        vx = -Math.sign(dx) * 44;
        if (top) vy = -Math.sign(dy) * 44;
      }
    }
    b.vx = vx;
    b.vy = top ? vy : Math.min(FEEL.fall, b.vy + FEEL.gravity * dt);
    if (vx) s.dir = Math.sign(vx);
    moveBody(b, dt, solid);
  }
}

/** One fixed step of the game. */
export function step(p: Play, dt: number, inp: Input): void {
  if (p.over) return;
  p.t += dt;
  p.saidT = Math.max(0, p.saidT - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  p.cool = Math.max(0, p.cool - dt);
  p.power.jump = Math.max(0, p.power.jump - dt);
  p.power.crates = Math.max(0, p.power.crates - dt);
  if (p.dialog || p.sheet) {
    p.b.vx = 0;
    if (p.dialog && (inp.pressed.has('a') || inp.pressed.has('b'))) nextLine(p);
    return;
  }
  if (inp.pressed.has('items')) openItems(p);
  if (p.game.rules.timer > 0) {
    p.timeLeft -= dt;
    if (p.timeLeft <= 0) {
      p.timeLeft = 0;
      p.over = 'lost';
      p.why = 'Out of time.';
      emit(p, 'lose');
      return;
    }
  }
  movePlayer(p, dt, inp);
  interact(p, inp);
  pickups(p);
  stepEnemies(p, dt);
  stepNpcs(p, dt);
  advance(p);
  if (!p.over && p.game.rules.end === 'quests' && p.game.quests.some((q) => q.steps.length) && p.game.quests.filter((q) => q.steps.length).every((q) => p.quests[q.id]?.done) && !(p.ready.size > 0)) win(p, 'Every quest is done.');
}

// ---------------------------------------------------------------- headless: scripted inputs
export interface Move {
  hold?: string[];
  press?: string[];
  frames: number;
}
/** Step a game with scripted inputs: each move holds its names for its frames (its presses on the first). */
export function headless(game: Game, script: Move[], o: { resume?: string | null } = {}): Play {
  const p = newPlay(game, o);
  runScript(p, script);
  return p;
}
export function runScript(p: Play, script: Move[]): void {
  for (const m of script) {
    const held = new Set(m.hold ?? []);
    for (let i = 0; i < m.frames; i++) {
      step(p, STEP, { held, pressed: i === 0 ? new Set(m.press ?? []) : new Set() });
      if (p.over) return;
    }
  }
}

/**
 * A scripted walk for the node test and the specs: the moves that take the player, tile by tile, along a route over the tiles he
 * can stand on (a breadth-first search), to a tile of this room. Steps the game as it goes (and stops if it ends or the room
 * changes). The inputs are the same ones a thumb gives.
 */
export function walk(p: Play, tx: number, ty: number, o: { door?: boolean; max?: number } = {}): boolean {
  const room = p.room;
  const free = (x: number, y: number) => {
    const c = tileAt(room, x, y);
    return c !== ' ' && !isSolidLetter(p.game, c) && (o.door || c !== 'D' || (x === tx && y === ty));
  };
  const sx = Math.floor((p.b.x + p.b.w / 2) / TS);
  const sy = Math.floor((p.b.y + p.b.h / 2) / TS);
  const prev = new Map<string, string | null>([[`${sx},${sy}`, null]]);
  const q: [number, number][] = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift()!;
    if (x === tx && y === ty) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const k = `${x + dx},${y + dy}`;
      if (!prev.has(k) && free(x + dx, y + dy)) {
        prev.set(k, `${x},${y}`);
        q.push([x + dx, y + dy]);
      }
    }
  }
  if (!prev.has(`${tx},${ty}`)) return false;
  const path: [number, number][] = [];
  for (let k: string | null = `${tx},${ty}`; k; k = prev.get(k) ?? null) path.unshift(k.split(',').map(Number) as [number, number]);
  for (const [x, y] of path.slice(1)) {
    const rid = p.rid;
    let guard = 0;
    while (guard++ < (o.max ?? 400) && p.rid === rid && !p.over) {
      const cx = p.b.x + p.b.w / 2;
      const cy = p.b.y + p.b.h / 2;
      const gx = x * TS + 8;
      const gy = y * TS + 8;
      const held = new Set<string>();
      if (Math.abs(gx - cx) > 1.2) held.add(gx > cx ? 'right' : 'left');
      else if (Math.abs(gy - cy) > 1.2) held.add(gy > cy ? 'down' : 'up');
      else break;
      step(p, STEP, { held, pressed: new Set() });
    }
    if (p.rid !== rid || p.over) return true;
  }
  return true;
}
