/**
 * THE GAME STUDIO's data (BRIEF-EDITOR-GAME-STUDIO): a game is plain data, so it is saved, undone, shared and exported as
 * the same JSON. Pure: no screen, no storage, nothing that asks the page for anything, so the node test bundles this very
 * file. Rooms are grids of tile letters in the platformer's little language, extended with ours; the grid is the
 * platformer's 16-pixel one (arcade/games/platform/core.ts). Every colour a game uses comes from the kit's own worlds
 * (arcade/games/platform/levels.ts THEMES): a game picks one and never brings a new hex.
 *
 * The letters: . air (floor, top-down) · # ground · W wall · B crate · p ledge (stand on it from above) · ~ water (slows) ·
 * D door · ^ spikes · u spring · o coin · c chest · i sign · V save point · F flag · P where you start · N a character ·
 * T a thing of his · w walker · h hopper · f flyer · s shell · x chaser · A to H his own tiles.
 */
import { THEMES } from '../arcade/games/platform/levels';

export const TS = 16;
export const MAX_W = 64;
export const MAX_H = 32;
export const MIN_W = 8;
export const MIN_H = 6;
export const MAX_FRAMES = 8;
export const UNDO_DEPTH = 60;
export const MAX_ROOMS = 24;
export const MAX_TILES = 8;
export const ANIMS = ['idle', 'walk', 'jump', 'hurt', 'talk'] as const;
export type Anim = (typeof ANIMS)[number];
export type Kind = 'platformer' | 'topdown';
export const KINDS: Kind[] = ['platformer', 'topdown'];
export const ENEMY_KINDS = ['walker', 'hopper', 'flyer', 'shell', 'chaser'] as const;
export type EnemyKind = (typeof ENEMY_KINDS)[number];
export const ENEMY_LETTER: Record<string, EnemyKind> = { w: 'walker', h: 'hopper', f: 'flyer', s: 'shell', x: 'chaser' };
export const LETTER_OF: Record<EnemyKind, string> = { walker: 'w', hopper: 'h', flyer: 'f', shell: 's', chaser: 'x' };
export const BEHAVIOURS = ['stand', 'walk', 'follow', 'flee', 'patrol'] as const;
export type Behaviour = (typeof BEHAVIOURS)[number];
export const DOES = ['coin', 'heart', 'key', 'quest', 'jump', 'crates', 'sell'] as const;
export type Does = (typeof DOES)[number];

/** The kit's worlds a game can be set in (its palette and its backgrounds): the platformer's eight. */
export const PALETTES = THEMES.map((t) => ({ id: t.id, name: t.name }));
export const themeOf = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[0]!;

/**
 * The sixteen inks of the pixel editor (0 is clear), all taken from the kit's worlds: a colour is a slot, never a new hex.
 * Slot names are said by VoiceOver.
 */
const T = (id: string) => themeOf(id);
export const INKS: { name: string; hex: string }[] = [
  { name: 'Clear', hex: '' },
  { name: 'Night', hex: T('tower').sky[0] },
  { name: 'Snow', hex: T('snow').top },
  { name: 'Earth', hex: T('hills').ground },
  { name: 'Grass', hex: T('hills').top },
  { name: 'Sand', hex: T('hills').ledge },
  { name: 'Sky', hex: T('hills').sky[0] },
  { name: 'Sunset', hex: T('roofs').sky[0] },
  { name: 'Amber', hex: T('factory').top },
  { name: 'Violet', hex: T('caves').top },
  { name: 'Lagoon', hex: T('ship').sky[1] },
  { name: 'Moss', hex: T('ship').top },
  { name: 'Rose', hex: T('roofs').far },
  { name: 'Steel', hex: T('factory').ground },
  { name: 'Mist', hex: T('clouds').ledge },
  { name: 'Frost', hex: T('snow').ground },
];
export const BLANK: Frame = '0'.repeat(256);
/** A 16 × 16 picture: 256 characters, each an ink 0 to f, row by row. */
export type Frame = string;

export interface Sprite {
  id: string;
  name: string;
  anims: Partial<Record<Anim, Frame[]>>;
}
export interface CustomTile {
  /** One letter from A to H. */
  id: string;
  name: string;
  px: Frame;
  solid: boolean;
}
export interface Door {
  id: string;
  x: number;
  y: number;
  /** Where it opens: the room, and the door there ('' for that room's first). */
  room: string;
  door: string;
  /** Shut until its key (the thing with `door` naming this one) or a quest's reward opens it. */
  locked: boolean;
}
export interface Room {
  id: string;
  name: string;
  w: number;
  h: number;
  rows: string[];
  /** A world of the kit (its sky and its far hills) behind it. */
  bg: string;
  doors: Door[];
  /** What a character, a thing, a chest or a sign at a tile holds, by "x,y". */
  marks: Record<string, string>;
  /** Shut until a quest is done or a thing is held. */
  lock: { quest: string; thing: string };
}
export interface Line {
  text: string;
  once: boolean;
}
export interface ShopItem {
  thing: string;
  price: number;
}
export interface Npc {
  id: string;
  name: string;
  sprite: string;
  lines: Line[];
  behaviour: Behaviour;
  shop: ShopItem[];
}
export interface Thing {
  id: string;
  name: string;
  sprite: string;
  does: Does;
  /** A key's door. */
  door: string;
  /** A coin's worth, a heart's hearts, a power's seconds, a sellable's coins. */
  value: number;
}
export type Step = { t: 'talk'; npc: string } | { t: 'collect'; thing: string; n: number } | { t: 'reach'; room: string; x?: number; y?: number } | { t: 'defeat'; kind: string; n: number };
export interface Reward {
  coins: number;
  item: string;
  door: string;
  line: string;
  /** Kept in a chest (a chest with "q:<quest id>") that opens once the quest is done. */
  inChest: boolean;
}
export interface Quest {
  id: string;
  name: string;
  steps: Step[];
  reward: Reward;
}
export interface Rules {
  lives: number;
  end: 'quests' | 'room' | 'lives';
  endRoom: string;
  /** Seconds, or 0 for none. */
  timer: number;
  keepCoins: boolean;
}
export interface Game {
  v: 1;
  id: string;
  name: string;
  kind: Kind;
  /** Who made it, when the file named a maker (a game from someone else). */
  maker: string;
  palette: string;
  tiles: CustomTile[];
  rooms: Room[];
  sprites: Sprite[];
  player: { sprite: string; speed: number; jump: number; hearts: number };
  npcs: Npc[];
  things: Thing[];
  quests: Quest[];
  enemySprites: Record<string, string>;
  rules: Rules;
  ui: { hearts: boolean; coins: boolean; quest: boolean; sign: boolean };
  /** One of the preset tunes by name, or '' for silence; `tune` is his own eight bars when typed. */
  music: string;
  tune: string;
  fx: boolean;
  start: string;
  at: number;
}

// ---------------------------------------------------------------- the words he reads
/** A change refused in his words (the one error voice says it whole). */
export class Refused extends Error {
  readonly refuse = true;
}
const no = (words: string): never => {
  throw new Refused(words);
};

export const SOLID_BUILT = '#WB';
export const TERRAIN = '.#WBp~^uo';
export const isCustom = (c: string) => c >= 'A' && c <= 'H';
export const ALL_LETTERS = `${TERRAIN}DciVFPNTwhfsx`;
export const LETTER_NAMES: Record<string, string> = { '.': 'Air', '#': 'Ground', W: 'Wall', B: 'Crate', p: 'Ledge', '~': 'Water', D: 'Door', '^': 'Spikes', u: 'Spring', o: 'Coin', c: 'Chest', i: 'Sign', V: 'Save point', F: 'Flag', P: 'Start', N: 'Character', T: 'Thing', w: 'Walker', h: 'Hopper', f: 'Flyer', s: 'Shell', x: 'Chaser' };
export const isSolidLetter = (g: Pick<Game, 'tiles'>, c: string): boolean => SOLID_BUILT.includes(c) || (isCustom(c) && !!g.tiles.find((t) => t.id === c)?.solid);

// ---------------------------------------------------------------- ids
let counter = 0;
export function makeId(prefix: string, seed?: string): string {
  counter++;
  const r = seed ?? `${Date.now().toString(36)}${Math.floor(Math.random() * 1679616).toString(36)}`;
  return `${prefix}${r}${counter.toString(36)}`;
}
const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'x';
const uniq = (taken: string[], base: string): string => {
  let id = slug(base);
  let n = 2;
  while (taken.includes(id)) id = `${slug(base)}-${n++}`;
  return id;
};

// ---------------------------------------------------------------- rooms and rows
export const blankRow = (w: number): string => '.'.repeat(w);
export function newRoom(game: Pick<Game, 'rooms' | 'palette' | 'kind'>, name: string, w = 24, h = 14): Room {
  if (game.rooms.length >= MAX_ROOMS) no(`A game keeps ${MAX_ROOMS} rooms at most, and you have ${game.rooms.length}. Take one away to make another.`);
  const [cw, ch] = clampSize(w, h);
  const rows = Array.from({ length: ch }, (_, y) => (game.kind === 'platformer' ? (y >= ch - 2 ? '#'.repeat(cw) : blankRow(cw)) : y === 0 || y === ch - 1 ? 'W'.repeat(cw) : `W${blankRow(cw - 2)}W`));
  return { id: uniq(game.rooms.map((r) => r.id), name), name, w: cw, h: ch, rows, bg: game.palette, doors: [], marks: {}, lock: { quest: '', thing: '' } };
}
export function clampSize(w: number, h: number): [number, number] {
  return [Math.max(MIN_W, Math.min(MAX_W, Math.round(w))), Math.max(MIN_H, Math.min(MAX_H, Math.round(h)))];
}
/** Resize a room from its top left: rows cut or padded with air (a door or a mark cut off goes with its tile). */
export function resizeRoom(room: Room, w: number, h: number): void {
  if (!Number.isFinite(w) || !Number.isFinite(h)) no('Give the room a width and a height in tiles.');
  if (w > MAX_W || h > MAX_H) no(`A room is ${MAX_W} tiles wide and ${MAX_H} high at most. You asked for ${Math.round(w)} × ${Math.round(h)}.`);
  if (w < MIN_W || h < MIN_H) no(`A room is ${MIN_W} × ${MIN_H} tiles at the least. You asked for ${Math.round(w)} × ${Math.round(h)}.`);
  w = Math.round(w);
  h = Math.round(h);
  const rows: string[] = [];
  for (let y = 0; y < h; y++) rows.push(((room.rows[y] ?? '') + blankRow(w)).slice(0, w));
  room.rows = rows;
  room.w = w;
  room.h = h;
  room.doors = room.doors.filter((d) => d.x < w && d.y < h);
  for (const k of Object.keys(room.marks)) {
    const [x, y] = k.split(',').map(Number);
    if ((x ?? 0) >= w || (y ?? 0) >= h) delete room.marks[k];
  }
}
export const tileAt = (room: Pick<Room, 'rows' | 'w' | 'h'>, x: number, y: number): string => (x < 0 || y < 0 || x >= room.w || y >= room.h ? ' ' : (room.rows[y]?.[x] ?? ' '));
export const markKey = (x: number, y: number) => `${x},${y}`;

/** Put a letter at a tile. Removing a door, character, thing, chest or sign takes what it carried with it. */
export function setTile(room: Room, x: number, y: number, c: string): boolean {
  if (x < 0 || y < 0 || x >= room.w || y >= room.h) return false;
  const row = room.rows[y]!;
  const was = row[x]!;
  if (was === c) return false;
  room.rows[y] = row.slice(0, x) + c + row.slice(x + 1);
  if (was === 'D') room.doors = room.doors.filter((d) => !(d.x === x && d.y === y));
  if ('NTci'.includes(was) && !'NTci'.includes(c)) delete room.marks[markKey(x, y)];
  return true;
}
/** FILL: every connected tile of the same letter becomes `c` (four-way, a flood). Returns how many changed. */
export function fillTiles(room: Room, x: number, y: number, c: string): number {
  const from = tileAt(room, x, y);
  if (from === ' ' || from === c) return 0;
  const seen = new Set<number>();
  const stack: [number, number][] = [[x, y]];
  let n = 0;
  while (stack.length) {
    const [cx, cy] = stack.pop()!;
    const k = cy * MAX_W + cx;
    if (cx < 0 || cy < 0 || cx >= room.w || cy >= room.h || seen.has(k) || tileAt(room, cx, cy) !== from) continue;
    seen.add(k);
    if (setTile(room, cx, cy, c)) n++;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return n;
}
export const rowsText = (room: Pick<Room, 'rows'>): string => room.rows.join('\n');
/**
 * Rows of the little language from text (a sketch from the chat, or a file): letters not in `allowed` become air and are
 * counted, rows are cut to 64 × 32. Returns the rows and how many tiles were not understood.
 */
export function parseRows(text: string, allowed: string = TERRAIN): { rows: string[]; w: number; h: number; dropped: number } {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+$/g, '')).filter((l) => l.length > 0).slice(0, MAX_H);
  const w = Math.max(MIN_W, Math.min(MAX_W, Math.max(0, ...lines.map((l) => l.length))));
  let dropped = 0;
  const rows = lines.map((l) => {
    let out = '';
    for (const ch of l.slice(0, w)) {
      if (allowed.includes(ch)) out += ch;
      else (out += '.'), dropped++;
    }
    return out.padEnd(w, '.');
  });
  while (rows.length < MIN_H) rows.push(blankRow(w));
  return { rows, w, h: rows.length, dropped };
}
/** A room's rows out of a reply: the longest run of lines made only of the language's letters. */
export function sketchFrom(reply: string): { rows: string[]; w: number; h: number; dropped: number } | null {
  const fenced = reply.match(/```[a-z]*\n([\s\S]*?)```/);
  const body = fenced ? fenced[1]! : reply;
  const ok = new RegExp(`^[${TERRAIN.replace(/[\]\\^-]/g, '\\$&')}]{${MIN_W},${MAX_W}}$`);
  const lines = body.split(/\r?\n/).map((l) => l.trim());
  let best: string[] = [];
  let cur: string[] = [];
  for (const l of lines) {
    if (ok.test(l)) cur.push(l);
    else {
      if (cur.length > best.length) best = cur;
      cur = [];
    }
  }
  if (cur.length > best.length) best = cur;
  if (best.length < 3) return null;
  return parseRows(best.join('\n'));
}
/** The lines of a character's talk out of a reply: one per line, bullets and numbers off, at most eight. */
export function linesFrom(reply: string): string[] {
  return reply
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/^["“]|["”]$/g, '').trim())
    .filter((l) => l.length >= 2 && l.length <= 160 && !/^(here|sure|these|certainly)\b.*:$/i.test(l))
    .slice(0, 8);
}

// ---------------------------------------------------------------- sprites: pixels
export const frameAt = (f: Frame, x: number, y: number): number => parseInt(f[y * 16 + x] ?? '0', 16) || 0;
export function setPixel(f: Frame, x: number, y: number, ink: number): Frame {
  if (x < 0 || y < 0 || x > 15 || y > 15) return f;
  const i = y * 16 + x;
  return f.slice(0, i) + (ink & 15).toString(16) + f.slice(i + 1);
}
export function fillPixels(f: Frame, x: number, y: number, ink: number): Frame {
  const from = frameAt(f, x, y);
  if (from === ink || x < 0 || y < 0 || x > 15 || y > 15) return f;
  const out = f.split('');
  const stack: [number, number][] = [[x, y]];
  const c = (ink & 15).toString(16);
  while (stack.length) {
    const [cx, cy] = stack.pop()!;
    if (cx < 0 || cy < 0 || cx > 15 || cy > 15 || (parseInt(out[cy * 16 + cx]!, 16) || 0) !== from) continue;
    out[cy * 16 + cx] = c;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return out.join('');
}
export function mirrorFrame(f: Frame): Frame {
  let out = '';
  for (let y = 0; y < 16; y++) out += f.slice(y * 16, y * 16 + 16).split('').reverse().join('');
  return out;
}
export const validFrame = (f: unknown): f is Frame => typeof f === 'string' && /^[0-9a-f]{256}$/.test(f);

/** A frame of an animation, going round (an animation with no frames shows its idle's first). */
export function frameOf(s: Sprite | undefined, anim: Anim, t: number, fps = 6): Frame {
  const list = s?.anims[anim]?.length ? s.anims[anim]! : (s?.anims.idle ?? []);
  if (!list.length) return BLANK;
  return list[Math.floor(t * fps) % list.length] ?? BLANK;
}
export function addFrame(s: Sprite, anim: Anim, from?: Frame): number {
  const list = (s.anims[anim] ??= []);
  if (list.length >= MAX_FRAMES) no(`An animation holds ${MAX_FRAMES} frames at most, and "${anim}" has ${list.length}.`);
  list.push(from ?? list[list.length - 1] ?? BLANK);
  return list.length - 1;
}
export function removeFrame(s: Sprite, anim: Anim, i: number): void {
  const list = s.anims[anim];
  if (!list || list.length <= 1) no('An animation keeps at least one frame.');
  list!.splice(i, 1);
}

// ---------------------------------------------------------------- things and the pictures they get
const rect = (px: number[], x: number, y: number, w: number, h: number, ink: number) => {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (xx >= 0 && xx < 16 && yy >= 0 && yy < 16) px[yy * 16 + xx] = ink;
};
const disc = (px: number[], cx: number, cy: number, r: number, ink: number) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) px[y * 16 + x] = ink;
};
const toFrame = (px: number[]): Frame => px.map((v) => v.toString(16)).join('');
const canvas = (): number[] => new Array<number>(256).fill(0);

/** The studio's own drawn sprites (made here, in the kit's inks), so a new game has a hero, friends, foes and things at once. */
function person(body: number, hair: number, step: 0 | 1 | 2): Frame {
  const px = canvas();
  rect(px, 5, 1, 6, 3, hair);
  rect(px, 5, 4, 6, 4, 5);
  px[5 * 16 + 6] = 1;
  px[5 * 16 + 9] = 1;
  rect(px, 4, 8, 8, 4, body);
  rect(px, 3, 8, 1, 3, body);
  rect(px, 12, 8, 1, 3, body);
  if (step === 0) rect(px, 5, 12, 2, 3, 1), rect(px, 9, 12, 2, 3, 1);
  else if (step === 1) rect(px, 4, 12, 2, 3, 1), rect(px, 10, 12, 2, 3, 1);
  else rect(px, 6, 12, 2, 3, 1), rect(px, 8, 12, 2, 3, 1);
  return toFrame(px);
}
function foe(kind: EnemyKind, body: number, step: 0 | 1): Frame {
  const px = canvas();
  if (kind === 'flyer') {
    disc(px, 8, 8, 3, body);
    rect(px, step ? 1 : 2, step ? 4 : 6, 5, 2, 2);
    rect(px, step ? 10 : 9, step ? 4 : 6, 5, 2, 2);
    px[7 * 16 + 7] = 1;
    px[7 * 16 + 9] = 1;
  } else if (kind === 'shell') {
    disc(px, 8, 10, 5, body);
    rect(px, 3, 11, 10, 3, body);
    rect(px, 6, 8, 4, 1, 2);
    rect(px, step ? 4 : 5, 14, 2, 1, 1);
    rect(px, step ? 10 : 9, 14, 2, 1, 1);
  } else if (kind === 'chaser') {
    disc(px, 8, 9, 5, body);
    px[8 * 16 + 6] = 2;
    px[8 * 16 + 10] = 2;
    px[9 * 16 + 6] = 1;
    px[9 * 16 + 10] = 1;
    rect(px, 5, 12, 6, 1, 1);
  } else {
    rect(px, 3, 6 + (kind === 'hopper' && step ? -1 : 0), 10, 7, body);
    rect(px, 4, 4 + (kind === 'hopper' && step ? -1 : 0), 8, 2, body);
    px[7 * 16 + 5] = 2;
    px[7 * 16 + 10] = 2;
    px[8 * 16 + 5] = 1;
    px[8 * 16 + 10] = 1;
    rect(px, step ? 3 : 4, 13, 3, 2, 1);
    rect(px, step ? 10 : 9, 13, 3, 2, 1);
  }
  return toFrame(px);
}
function iconOf(does: Does): Frame {
  const px = canvas();
  if (does === 'coin') {
    disc(px, 8, 8, 5, 8);
    disc(px, 8, 8, 3, 5);
    rect(px, 7, 6, 2, 4, 8);
  } else if (does === 'heart') {
    disc(px, 5.5, 6, 3, 12);
    disc(px, 10.5, 6, 3, 12);
    for (let y = 7; y < 13; y++) rect(px, 3 + (y - 7), y, 10 - (y - 7) * 2, 1, 12);
  } else if (does === 'key') {
    disc(px, 5, 8, 3, 8);
    disc(px, 5, 8, 1, 0);
    rect(px, 8, 7, 6, 2, 8);
    rect(px, 12, 9, 1, 2, 8);
    rect(px, 10, 9, 1, 2, 8);
  } else if (does === 'quest') {
    rect(px, 4, 3, 8, 10, 2);
    rect(px, 5, 5, 6, 1, 6);
    rect(px, 5, 7, 6, 1, 6);
    rect(px, 5, 9, 4, 1, 6);
  } else if (does === 'jump') {
    rect(px, 3, 11, 10, 2, 13);
    rect(px, 4, 9, 8, 2, 7);
    rect(px, 5, 7, 6, 2, 8);
    rect(px, 7, 4, 2, 3, 2);
  } else if (does === 'crates') {
    rect(px, 3, 3, 10, 10, 5);
    rect(px, 3, 3, 10, 1, 3);
    rect(px, 3, 12, 10, 1, 3);
    rect(px, 3, 3, 1, 10, 3);
    rect(px, 12, 3, 1, 10, 3);
    rect(px, 7, 4, 2, 8, 3);
  } else {
    disc(px, 8, 9, 4, 9);
    rect(px, 7, 3, 2, 3, 5);
    rect(px, 6, 3, 4, 1, 2);
  }
  return toFrame(px);
}
const one = (id: string, name: string, f: Frame[], walk?: Frame[]): Sprite => ({ id, name, anims: { idle: [f[0]!], ...(walk ? { walk } : {}), jump: [f[0]!], hurt: [f[0]!], talk: [f[0]!] } });
export function defaultSprites(): Sprite[] {
  return [
    one('hero', 'Hero', [person(8, 3, 0)], [person(8, 3, 1), person(8, 3, 2)]),
    one('villager', 'Villager', [person(9, 12, 0)], [person(9, 12, 1), person(9, 12, 2)]),
    one('walker', 'Walker', [foe('walker', 12, 0)], [foe('walker', 12, 0), foe('walker', 12, 1)]),
    one('hopper', 'Hopper', [foe('hopper', 11, 0)], [foe('hopper', 11, 0), foe('hopper', 11, 1)]),
    one('flyer', 'Flyer', [foe('flyer', 9, 0)], [foe('flyer', 9, 0), foe('flyer', 9, 1)]),
    one('shell', 'Shell', [foe('shell', 4, 0)], [foe('shell', 4, 0), foe('shell', 4, 1)]),
    one('chaser', 'Chaser', [foe('chaser', 13, 0)], [foe('chaser', 13, 0), foe('chaser', 13, 1)]),
  ];
}
export const thingIcon = (does: Does): Frame => iconOf(does);
export function newThing(game: Pick<Game, 'things' | 'sprites'>, name: string, does: Does = 'quest'): Thing {
  const id = uniq(game.things.map((t) => t.id), name);
  const sid = `icon-${id}`;
  game.sprites.push(one(sid, name, [iconOf(does)]));
  return { id, name, sprite: sid, does, door: '', value: does === 'jump' || does === 'crates' ? 10 : does === 'heart' ? 1 : does === 'coin' ? 1 : does === 'sell' ? 3 : 0 };
}
export function newNpc(game: Pick<Game, 'npcs'>, name: string, sprite = 'villager'): Npc {
  return { id: uniq(game.npcs.map((n) => n.id), name), name, sprite, lines: [], behaviour: 'stand', shop: [] };
}
export function newQuest(game: Pick<Game, 'quests'>, name: string): Quest {
  return { id: uniq(game.quests.map((q) => q.id), name), name, steps: [], reward: { coins: 0, item: '', door: '', line: '', inChest: false } };
}
export function newSprite(game: Pick<Game, 'sprites'>, name: string): Sprite {
  return { id: uniq(game.sprites.map((s) => s.id), name), name, anims: { idle: [BLANK] } };
}
export function newTile(game: Pick<Game, 'tiles'>, name: string, px: Frame = BLANK, solid = true): CustomTile {
  if (game.tiles.length >= MAX_TILES) no(`A game has ${MAX_TILES} tiles of its own at most, and you have ${game.tiles.length}.`);
  const id = 'ABCDEFGH'.split('').find((l) => !game.tiles.some((t) => t.id === l))!;
  return { id, name, px, solid };
}
export function newDoor(game: Pick<Game, 'rooms'>, room: Room, x: number, y: number): Door {
  const all = game.rooms.flatMap((r) => r.doors.map((d) => d.id));
  const d: Door = { id: uniq(all, `${room.id}-door`), x, y, room: '', door: '', locked: false };
  room.doors.push(d);
  return d;
}
/** Link a door to a room (and, if it has one, a door there): the room must exist. A door back is made when the room has none. */
export function linkDoor(game: Game, from: Room, door: Door, toRoom: string, toDoor = ''): void {
  const to = game.rooms.find((r) => r.id === toRoom);
  if (!to) no(`There is no room called "${toRoom}", so the door cannot open into it. Make the room first.`);
  door.room = toRoom;
  door.door = toDoor && to!.doors.some((d) => d.id === toDoor) ? toDoor : (to!.doors.find((d) => !d.room || d.room === from.id)?.id ?? '');
  const back = to!.doors.find((d) => d.id === door.door);
  if (back && !back.room) {
    back.room = from.id;
    back.door = door.id;
  }
}

// ---------------------------------------------------------------- the quest line
export const stepWords = (g: Pick<Game, 'npcs' | 'things' | 'rooms'>, s: Step, have = 0): string => {
  if (s.t === 'talk') return `Talk to ${g.npcs.find((n) => n.id === s.npc)?.name ?? 'someone'}`;
  if (s.t === 'collect') return `Collect ${g.things.find((t) => t.id === s.thing)?.name.toLowerCase() ?? s.thing} (${Math.min(have, s.n)} of ${s.n})`;
  if (s.t === 'reach') return `Reach ${g.rooms.find((r) => r.id === s.room)?.name ?? 'a room'}`;
  return `Defeat ${s.n} ${s.kind}${s.n === 1 ? '' : 's'} (${Math.min(have, s.n)} of ${s.n})`;
};

// ---------------------------------------------------------------- what is wrong, said before PLAY
export interface Problem {
  /** Where to look: a pill of the editor. */
  at: 'rooms' | 'characters' | 'things' | 'quests' | 'rules';
  text: string;
  /** Stops PLAY. */
  hard: boolean;
}
const placed = (g: Game, letter: string, mark?: string): number => g.rooms.reduce((n, r) => n + r.rows.reduce((m, row, y) => m + [...row].filter((c, x) => c === letter && (!mark || r.marks[markKey(x, y)] === mark)).length, 0), 0);
export const coinsIn = (g: Game): number => placed(g, 'o') + g.rooms.reduce((n, r) => n + Object.entries(r.marks).filter(([k, v]) => v === 'coin' && r.rows[Number(k.split(',')[1])]?.[Number(k.split(',')[0])] === 'T').length, 0);
const enemiesOf = (g: Game, kind: string): number => placed(g, LETTER_OF[kind as EnemyKind] ?? '?');
/** How many of a thing the game can give: placed, in a chest, in a shop, or a quest's reward. */
export function holds(g: Game, thingId: string): number {
  const t = g.things.find((x) => x.id === thingId);
  if (!t) return 0;
  let n = t.does === 'coin' ? coinsIn(g) : 0;
  for (const r of g.rooms) for (const [k, v] of Object.entries(r.marks)) {
    const [x, y] = k.split(',').map(Number) as [number, number];
    const c = r.rows[y]?.[x];
    if ((c === 'T' || c === 'c') && v === thingId) n++;
  }
  if (g.npcs.some((p) => p.shop.some((s) => s.thing === thingId)) && placed(g, 'N') > 0) n += 99;
  if (g.quests.some((q) => q.reward.item === thingId)) n++;
  return n;
}
export function problems(g: Game): Problem[] {
  const out: Problem[] = [];
  const add = (at: Problem['at'], text: string, hard = false) => out.push({ at, text, hard });
  if (!g.rooms.length) add('rooms', 'The game has no rooms yet. Add one and it can be played.', true);
  const start = g.rooms.find((r) => r.id === g.start) ?? g.rooms[0];
  if (start && !start.rows.some((row) => row.includes('P'))) add('rooms', `"${start.name}" has no start. Put the Start tile where you begin.`, true);
  for (const r of g.rooms) {
    if (g.rooms.length > 1 && !r.doors.length) add('rooms', `"${r.name}" has no way out: no door leads from it.`);
    for (const d of r.doors) {
      if (!d.room) add('rooms', `A door in "${r.name}" goes nowhere yet. Tap it, then pick the room it opens into.`, true);
      else if (!g.rooms.some((x) => x.id === d.room)) add('rooms', `A door in "${r.name}" opens into a room that is not there any more.`, true);
      if (d.locked && !g.things.some((t) => t.does === 'key' && t.door === d.id)) add('things', `A locked door in "${r.name}" has no key: make a key thing and choose this door for it.`);
    }
    if (r.lock.quest && !g.quests.some((q) => q.id === r.lock.quest)) add('quests', `"${r.name}" waits on a quest that is not there any more.`);
  }
  for (const q of g.quests) {
    if (!q.steps.length) add('quests', `The quest "${q.name}" has no steps yet.`, true);
    for (const s of q.steps) {
      if (s.t === 'collect' && holds(g, s.thing) < s.n) add('quests', `"${q.name}" cannot be finished: it asks for ${s.n} ${g.things.find((t) => t.id === s.thing)?.name.toLowerCase() ?? 'thing'}${s.n === 1 ? '' : 's'} and the rooms hold ${Math.min(holds(g, s.thing), s.n - 1)}.`, true);
      if (s.t === 'talk' && !(g.npcs.some((n) => n.id === s.npc) && placed(g, 'N') > 0)) add('quests', `"${q.name}" cannot be finished: ${g.npcs.find((n) => n.id === s.npc)?.name ?? 'the person'} is not standing in any room.`, true);
      if (s.t === 'reach' && !g.rooms.some((r) => r.id === s.room)) add('quests', `"${q.name}" cannot be finished: the room it sends you to is not there.`, true);
      if (s.t === 'defeat' && enemiesOf(g, s.kind) < s.n) add('quests', `"${q.name}" cannot be finished: it asks you to defeat ${s.n} ${s.kind}s and the rooms hold ${enemiesOf(g, s.kind)}.`, true);
    }
    if (q.reward.inChest && !g.rooms.some((r) => Object.values(r.marks).includes(`q:${q.id}`))) add('quests', `The reward of "${q.name}" is in a chest, and no room has that chest yet.`, true);
  }
  if (g.rules.end === 'room' && !g.rooms.some((r) => r.id === g.rules.endRoom)) add('rules', 'The game ends when a room is reached, and that room is not there.', true);
  if (g.rules.end === 'quests' && !g.quests.length) add('rules', 'The game ends with the last quest, and there are no quests yet.');
  return out;
}
export const hardProblems = (g: Game): Problem[] => problems(g).filter((p) => p.hard);

// ---------------------------------------------------------------- templates
const make = (rows: string[]): string[] => rows;
function grid(w: number, h: number, fill = '.'): string[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
}
const put = (g: string[][], x: number, y: number, c: string) => {
  if (g[y] && x >= 0 && x < g[y]!.length) g[y]![x] = c;
};
const box = (g: string[][], x: number, y: number, w: number, h: number, c: string) => {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) put(g, xx, yy, c);
};
const join = (g: string[][]): string[] => g.map((r) => r.join(''));
const base = (kind: Kind, name: string, palette: string): Game => ({
  v: 1,
  id: makeId('g'),
  name,
  kind,
  maker: '',
  palette,
  tiles: [],
  rooms: [],
  sprites: defaultSprites(),
  player: { sprite: 'hero', speed: kind === 'platformer' ? 88 : 64, jump: 340, hearts: 3 },
  npcs: [],
  things: [],
  quests: [],
  enemySprites: { walker: 'walker', hopper: 'hopper', flyer: 'flyer', shell: 'shell', chaser: 'chaser' },
  rules: { lives: 3, end: 'lives', endRoom: '', timer: 0, keepCoins: true },
  ui: { hearts: true, coins: true, quest: true, sign: true },
  music: palette,
  tune: '',
  fx: true,
  start: '',
  at: Date.now(),
});
const room = (id: string, name: string, bg: string, rows: string[]): Room => ({ id, name, w: rows[0]!.length, h: rows.length, rows, bg, doors: [], marks: {}, lock: { quest: '', thing: '' } });

export const TEMPLATES = [
  { id: 'platformer', name: 'A platformer', line: 'Two rooms, coins, a walker and a flag to reach.' },
  { id: 'adventure', name: 'An adventure', line: 'Top-down: a village, a cave behind a locked door, one person with a quest.' },
  { id: 'collect', name: 'Collect them all', line: 'One big room and a counter: pick up every coin.' },
  { id: 'blank', name: 'Blank', line: 'An empty room and a hero, nothing else.' },
] as const;
export type TemplateId = (typeof TEMPLATES)[number]['id'];

export function template(id: TemplateId, name?: string): Game {
  if (id === 'platformer') {
    const g = base('platformer', name ?? 'My platformer', 'hills');
    const a = grid(40, 12);
    box(a, 0, 10, 40, 2, '#');
    box(a, 10, 10, 3, 2, '.'); // a pit
    put(a, 2, 9, 'P');
    for (const x of [6, 7, 8]) put(a, x, 7, 'o');
    box(a, 14, 7, 4, 1, 'p');
    for (const x of [14, 15, 16, 17]) put(a, x, 6, 'o');
    put(a, 22, 9, 'w');
    box(a, 25, 8, 3, 1, 'p');
    put(a, 32, 9, 'u');
    box(a, 34, 6, 3, 1, 'p');
    put(a, 35, 5, 'o');
    put(a, 38, 9, 'D');
    const b = grid(30, 12);
    box(b, 0, 10, 30, 2, '#');
    put(b, 1, 9, 'D');
    for (const x of [5, 6, 7]) put(b, x, 8, 'o');
    box(b, 9, 10, 2, 2, '^');
    box(b, 13, 8, 3, 1, 'p');
    put(b, 19, 9, 'h');
    box(b, 21, 7, 4, 1, 'p');
    put(b, 22, 6, 'o');
    put(b, 28, 9, 'F');
    g.rooms.push(room('hills', 'Green hills', 'hills', join(a)), room('cave', 'Glow cave', 'caves', join(b)));
    g.rooms[1]!.bg = 'caves';
    const d1 = newDoor(g, g.rooms[0]!, 38, 9);
    const d2 = newDoor(g, g.rooms[1]!, 1, 9);
    d1.room = 'cave';
    d1.door = d2.id;
    d2.room = 'hills';
    d2.door = d1.id;
    g.start = 'hills';
    g.rules.end = 'lives';
    return g;
  }
  if (id === 'adventure') {
    const g = base('topdown', name ?? 'My adventure', 'hills');
    const a = grid(24, 16);
    box(a, 0, 0, 24, 1, 'W');
    box(a, 0, 15, 24, 1, 'W');
    box(a, 0, 0, 1, 16, 'W');
    box(a, 23, 0, 1, 16, 'W');
    box(a, 8, 3, 3, 3, 'W');
    box(a, 14, 9, 4, 2, '~');
    put(a, 4, 8, 'P');
    put(a, 6, 4, 'N');
    put(a, 3, 12, 'V');
    put(a, 23, 8, 'D');
    for (const [x, y] of [[12, 3], [16, 5], [19, 12], [10, 12], [6, 10], [20, 3], [13, 13], [21, 7]] as const) put(a, x, y, 'o');
    put(a, 17, 4, 'i');
    const b = grid(20, 14);
    box(b, 0, 0, 20, 1, 'W');
    box(b, 0, 13, 20, 1, 'W');
    box(b, 0, 0, 1, 14, 'W');
    box(b, 19, 0, 1, 14, 'W');
    put(b, 0, 7, 'D');
    box(b, 6, 4, 2, 6, 'W');
    put(b, 12, 4, 'x');
    put(b, 14, 9, 'x');
    put(b, 17, 6, 'c');
    put(b, 10, 10, 'o');
    g.rooms.push(room('village', 'The village', 'hills', join(a)), room('cave', 'The cave', 'caves', join(b)));
    const d1 = newDoor(g, g.rooms[0]!, 23, 8);
    const d2 = newDoor(g, g.rooms[1]!, 0, 7);
    d1.room = 'cave';
    d1.door = d2.id;
    d1.locked = true;
    d2.room = 'village';
    d2.door = d1.id;
    const mara = newNpc(g, 'Mara');
    mara.lines = [{ text: 'Welcome to the village! The cave to the east has been shut since the storm.', once: true }, { text: 'Bring me three coins and I will give you the key.', once: false }];
    g.npcs.push(mara);
    const key = newThing(g, 'Cave key', 'key');
    key.door = d1.id;
    const heart = newThing(g, 'Heart', 'heart');
    g.things.push(key, heart);
    g.rooms[0]!.marks['6,4'] = mara.id;
    g.rooms[0]!.marks['17,4'] = 'Mara keeps the key for anyone who helps. Ask her.';
    g.rooms[1]!.marks['17,6'] = heart.id;
    const q = newQuest(g, 'Mara’s key');
    q.steps = [{ t: 'talk', npc: mara.id }, { t: 'collect', thing: 'coin', n: 3 }, { t: 'talk', npc: mara.id }];
    q.reward = { coins: 0, item: key.id, door: '', line: 'Mara gives you the cave key.', inChest: false };
    g.quests.push(q);
    g.things.unshift({ id: 'coin', name: 'Coin', sprite: 'icon-coin', does: 'coin', door: '', value: 1 });
    g.sprites.push(one('icon-coin', 'Coin', [iconOf('coin')]));
    g.start = 'village';
    g.rules.end = 'room';
    g.rules.endRoom = 'cave';
    return g;
  }
  if (id === 'collect') {
    const g = base('topdown', name ?? 'Collect them all', 'clouds');
    const a = grid(40, 24);
    box(a, 0, 0, 40, 1, 'W');
    box(a, 0, 23, 40, 1, 'W');
    box(a, 0, 0, 1, 24, 'W');
    box(a, 39, 0, 1, 24, 'W');
    box(a, 10, 6, 1, 8, 'W');
    box(a, 22, 10, 8, 1, 'W');
    box(a, 28, 14, 3, 3, '~');
    put(a, 3, 3, 'P');
    for (let i = 0; i < 16; i++) put(a, 4 + ((i * 7) % 33), 3 + ((i * 5) % 18), 'o');
    put(a, 30, 4, 'x');
    put(a, 14, 18, 'x');
    g.rooms.push(room('meadow', 'The meadow', 'clouds', join(a)));
    g.things.push({ id: 'coin', name: 'Coin', sprite: 'icon-coin', does: 'coin', door: '', value: 1 });
    g.sprites.push(one('icon-coin', 'Coin', [iconOf('coin')]));
    g.start = 'meadow';
    g.rules.end = 'lives';
    return g;
  }
  const g = base('platformer', name ?? 'My game', 'hills');
  const a = grid(30, 12);
  box(a, 0, 10, 30, 2, '#');
  put(a, 3, 9, 'P');
  g.rooms.push(room('first', 'First room', 'hills', join(a)));
  g.start = 'first';
  g.things.push({ id: 'coin', name: 'Coin', sprite: 'icon-coin', does: 'coin', door: '', value: 1 });
  g.sprites.push(one('icon-coin', 'Coin', [iconOf('coin')]));
  return g;
}
void make;

/** The first room's rows as a small picture's source (the thumbnail): the start room, or the first. */
export const firstRoom = (g: Game): Room | undefined => g.rooms.find((r) => r.id === g.start) ?? g.rooms[0];

// ---------------------------------------------------------------- reading a game back (an import, a stored copy)
const str = (v: unknown, max = 80, d = ''): string => (typeof v === 'string' ? v.slice(0, max) : d);
const int = (v: unknown, lo: number, hi: number, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d);
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export interface Read {
  game: Game;
  /** How many things the file had that this phone's studio kept none of (a room, a sprite, a quest step it could not use). */
  lost: number;
  read: number;
}
/** A game out of JSON from anywhere: whatever is usable is kept, what is not is counted (never thrown at him). */
export function readGame(raw: unknown): Read | null {
  const r = rec(raw);
  if (typeof r.name !== 'string' || !Array.isArray(r.rooms)) return null;
  let lost = 0;
  let total = 0;
  const keep = <T>(list: unknown[], one: (x: Record<string, unknown>) => T | null): T[] => {
    const out: T[] = [];
    for (const x of list) {
      total++;
      const v = x && typeof x === 'object' ? one(x as Record<string, unknown>) : null;
      if (v) out.push(v);
      else lost++;
    }
    return out;
  };
  const kind: Kind = r.kind === 'topdown' ? 'topdown' : 'platformer';
  const g = base(kind, str(r.name, 60, 'A game'), PALETTES.some((p) => p.id === r.palette) ? (r.palette as string) : 'hills');
  g.id = str(r.id, 40) || g.id;
  g.maker = str(r.maker, 40);
  g.at = int(r.at, 0, Number.MAX_SAFE_INTEGER, Date.now());
  g.sprites = keep(arr(r.sprites), (s) => {
    const anims: Partial<Record<Anim, Frame[]>> = {};
    for (const a of ANIMS) {
      const list = arr(rec(s.anims)[a]).filter(validFrame).slice(0, MAX_FRAMES);
      if (list.length) anims[a] = list;
    }
    return anims.idle ? { id: str(s.id, 40), name: str(s.name, 40, 'Sprite'), anims } : null;
  });
  if (!g.sprites.some((s) => s.id === 'hero')) g.sprites.push(...defaultSprites().filter((s) => !g.sprites.some((x) => x.id === s.id)));
  g.tiles = keep(arr(r.tiles).slice(0, MAX_TILES), (t) => (isCustom(str(t.id, 1)) && validFrame(t.px) ? { id: str(t.id, 1), name: str(t.name, 24, 'Tile'), px: t.px as Frame, solid: t.solid !== false } : null));
  const allowed = ALL_LETTERS + g.tiles.map((t) => t.id).join('');
  g.rooms = keep(arr(r.rooms).slice(0, MAX_ROOMS), (x) => {
    const rows = arr(x.rows).filter((l): l is string => typeof l === 'string').slice(0, MAX_H);
    if (rows.length < MIN_H) return null;
    const w = Math.max(MIN_W, Math.min(MAX_W, Math.max(...rows.map((l) => l.length))));
    const clean = rows.map((l) => [...l.slice(0, w)].map((c) => (allowed.includes(c) ? c : '.')).join('').padEnd(w, '.'));
    const rm: Room = { id: str(x.id, 40), name: str(x.name, 40, 'Room'), w, h: clean.length, rows: clean, bg: PALETTES.some((p) => p.id === x.bg) ? (x.bg as string) : g.palette, doors: [], marks: {}, lock: { quest: str(rec(x.lock).quest, 40), thing: str(rec(x.lock).thing, 40) } };
    rm.doors = keep(arr(x.doors), (d) => (typeof d.x === 'number' && typeof d.y === 'number' && tileAt(rm, d.x, d.y) === 'D' ? { id: str(d.id, 40), x: d.x, y: d.y, room: str(d.room, 40), door: str(d.door, 40), locked: d.locked === true } : null));
    for (const [k, v] of Object.entries(rec(x.marks))) if (/^\d+,\d+$/.test(k) && typeof v === 'string') rm.marks[k] = v.slice(0, 200);
    return rm.id ? rm : null;
  });
  g.npcs = keep(arr(r.npcs), (n) => ({
    id: str(n.id, 40),
    name: str(n.name, 30, 'Someone'),
    sprite: str(n.sprite, 40, 'villager'),
    behaviour: (BEHAVIOURS as readonly string[]).includes(str(n.behaviour)) ? (n.behaviour as Behaviour) : 'stand',
    lines: arr(n.lines).filter((l): l is Record<string, unknown> => !!l && typeof l === 'object').map((l) => ({ text: str(l.text, 200), once: l.once === true })).filter((l) => l.text).slice(0, 24),
    shop: arr(n.shop).filter((s): s is Record<string, unknown> => !!s && typeof s === 'object').map((s) => ({ thing: str(s.thing, 40), price: int(s.price, 0, 9999, 1) })).filter((s) => s.thing).slice(0, 12),
  }));
  g.things = keep(arr(r.things), (t) => ((DOES as readonly string[]).includes(str(t.does)) ? { id: str(t.id, 40), name: str(t.name, 30, 'Thing'), sprite: str(t.sprite, 40), does: t.does as Does, door: str(t.door, 40), value: int(t.value, 0, 9999, 1) } : null));
  g.quests = keep(arr(r.quests), (q) => {
    const steps = arr(q.steps).flatMap((s): Step[] => {
      const x = rec(s);
      if (x.t === 'talk') return [{ t: 'talk', npc: str(x.npc, 40) }];
      if (x.t === 'collect') return [{ t: 'collect', thing: str(x.thing, 40), n: int(x.n, 1, 999, 1) }];
      if (x.t === 'reach') return [{ t: 'reach', room: str(x.room, 40), ...(typeof x.x === 'number' && typeof x.y === 'number' ? { x: x.x, y: x.y } : {}) }];
      if (x.t === 'defeat') return [{ t: 'defeat', kind: str(x.kind, 20), n: int(x.n, 1, 999, 1) }];
      lost++;
      return [];
    });
    const w = rec(q.reward);
    return { id: str(q.id, 40), name: str(q.name, 40, 'Quest'), steps, reward: { coins: int(w.coins, 0, 9999, 0), item: str(w.item, 40), door: str(w.door, 40), line: str(w.line, 200), inChest: w.inChest === true } };
  });
  const pl = rec(r.player);
  g.player = { sprite: str(pl.sprite, 40, 'hero'), speed: int(pl.speed, 40, 160, g.player.speed), jump: int(pl.jump, 200, 480, 340), hearts: int(pl.hearts, 1, 9, 3) };
  const ru = rec(r.rules);
  g.rules = { lives: int(ru.lives, 1, 9, 3), end: ru.end === 'quests' || ru.end === 'room' ? ru.end : 'lives', endRoom: str(ru.endRoom, 40), timer: int(ru.timer, 0, 3600, 0), keepCoins: ru.keepCoins !== false };
  const ui = rec(r.ui);
  g.ui = { hearts: ui.hearts !== false, coins: ui.coins !== false, quest: ui.quest !== false, sign: ui.sign !== false };
  g.enemySprites = { ...g.enemySprites };
  for (const [k, v] of Object.entries(rec(r.enemySprites))) if ((ENEMY_KINDS as readonly string[]).includes(k) && typeof v === 'string') g.enemySprites[k] = v.slice(0, 40);
  g.music = str(r.music, 20, g.palette);
  g.tune = str(r.tune, 600);
  g.fx = r.fx !== false;
  g.start = g.rooms.some((x) => x.id === r.start) ? (r.start as string) : (g.rooms[0]?.id ?? '');
  return { game: g, lost, read: total };
}

export const clone = (g: Game): Game => JSON.parse(JSON.stringify(g)) as Game;

// ---------------------------------------------------------------- undo, sixty deep
export class History {
  private past: string[] = [];
  private future: string[] = [];
  constructor(public game: Game) {}
  /** Remember the state before a change (call it before changing `game`). */
  push(): void {
    this.past.push(JSON.stringify(this.game));
    if (this.past.length > UNDO_DEPTH) this.past.shift();
    this.future.length = 0;
  }
  /** Forget the last remembered state (a touch that changed nothing is not a step to undo). */
  drop(): void {
    this.past.pop();
  }
  get canUndo(): boolean {
    return this.past.length > 0;
  }
  get canRedo(): boolean {
    return this.future.length > 0;
  }
  get depth(): number {
    return this.past.length;
  }
  undo(): boolean {
    const s = this.past.pop();
    if (s === undefined) return false;
    this.future.push(JSON.stringify(this.game));
    this.game = JSON.parse(s) as Game;
    return true;
  }
  redo(): boolean {
    const s = this.future.pop();
    if (s === undefined) return false;
    this.past.push(JSON.stringify(this.game));
    this.game = JSON.parse(s) as Game;
    return true;
  }
}

/** How big a game is as text (for the store's room and the size said on SHARE). */
export const gameBytes = (g: Game): number => JSON.stringify(g).length;
