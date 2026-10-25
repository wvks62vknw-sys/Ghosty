/**
 * TEXT ESCAPE ROOMS: a made-up set of rooms with things to take, boxes and doors that are locked (by a key,
 * a code, or nails), notes that tell codes, and an exit. He plays by typed commands — `open drawer`, `take
 * brass key`, `unlock box with brass key`, `read note`, `enter 472 on safe`, `use crowbar on crate`, `go hall`,
 * `go out`, and from Level 5 `push bookcase`, `lift rug`, … — and sees only what a player would see (what is in the room, what he carries; a box's contents
 * only once it is open).
 *
 * Rooms are built backwards from the exit: the exit's key (or code, or the crowbar) is inside something
 * locked, whose key is inside something else…, with doors between rooms on the way and some useless things
 * lying about. Ground truth: a breadth-first search over every state (where he is, what he carries, what is
 * open, which notes he has read) gives the shortest way out.
 *
 * He picks the command his weights score highest from what he can see (is it the exit, does the key's name
 * match the lock, did this thing just appear, is that room new…); he never types the same command twice
 * in the same situation (nothing changes by itself, so that could only go round in circles). He learns
 * the weights by evolution on practice rooms. Each level brings something new that every one of its rooms
 * needs — keys, then codes, a crowbar, a second room, then a new hiding place each level (a bookcase to
 * push, a rug to lift, …) — and he only types commands he has practised with, so a new one has to be
 * learned before he can get out. Mastery = the average over held-out rooms of (shortest ÷ his
 * steps) when he escapes within twice the shortest, 0 when he does not.
 */
import { type Env, type Frame, type Game, type Learner, lvl, pick, type Problem, randInt, rng, savedFor, shuffle, type Verdict } from './core';
import { ESCAPE_SETS } from './escapesets';
import { ESCAPE } from './meta';
import { gauss } from './logic';

type LockKind = 'key' | 'code' | 'nails' | 'none';

export interface Thing {
  name: string;
  /**
   * container (box, drawer…), door (between two rooms; to = -1 is the way out), or spot: a hiding place
   * (a bookcase to push, a rug to lift…) that shows what it hides once he does the right thing to it.
   */
  kind: 'container' | 'door' | 'spot';
  /** A spot's verb: push, lift, empty, turn, search, move. */
  verb?: string;
  room: number;
  to?: number;
  lock: LockKind;
  /** The key (item index) or the code that opens it. */
  key?: number;
  code?: string;
  /** Start: 0 locked (a spot: still hiding), 1 closed, 2 open (a spot: searched). */
  start: number;
}

export interface Item {
  name: string;
  kind: 'key' | 'note' | 'tool' | 'junk';
  /** On the floor of a room, or inside a thing. */
  room?: number;
  in?: number;
  /** A note's words; the code it tells and the thing it is for. */
  text?: string;
  code?: string;
}

export interface Room {
  rooms: string[];
  things: Thing[];
  items: Item[];
}

/** Where he is, what he carries, the state of every thing, the notes he has read. */
export interface State {
  at: number;
  held: number;
  st: number[];
  read: number;
  out: boolean;
}

const ROOM_NAMES = ['study', 'hall', 'kitchen', 'cellar', 'attic'];
const CONTAINERS = ['drawer', 'box', 'chest', 'cabinet', 'locker', 'trunk', 'cupboard', 'suitcase', 'safe'];
const METALS = ['brass', 'silver', 'iron', 'copper', 'red', 'blue', 'green', 'gold', 'black', 'white'];
const JUNK = ['spoon', 'candle', 'old map', 'teacup', 'pencil', 'glove'];
const NOTES = ['note', 'card', 'letter', 'scrap of paper', 'postcard', 'receipt', 'ticket'];

/** Hiding places: the verb that searches it, its name, and where the thing it hides is. */
export const SPOTS: [string, string, string][] = [
  ['push', 'bookcase', 'behind'],
  ['lift', 'rug', 'under'],
  ['empty', 'flowerpot', 'in'],
  ['turn', 'painting', 'behind'],
  ['search', 'coat', 'in a pocket of'],
  ['move', 'armchair', 'under'],
];
export const SPOT_VERBS = SPOTS.map(([v]) => v);

/**
 * Each level brings something he has not met: Level 1 keys and boxes; 2 notes with codes and keypads; 3
 * a crowbar for things nailed shut; 4 a second room behind a locked door; 5–10 a new hiding place each
 * (a bookcase to push, a rug to lift, …). Every room of a level needs its new thing to get out.
 */
export interface Spec {
  rooms: number;
  depth: number;
  junk: number;
  locks: LockKind[];
  spots: string[];
  /** What every room of the level needs. */
  need: 'key' | 'code' | 'nails' | 'door' | string;
}
export const specFor = (level: number): Spec =>
  (
    [
      { rooms: 1, depth: 2, junk: 1, locks: ['key'], spots: [], need: 'key' },
      { rooms: 1, depth: 2, junk: 2, locks: ['key', 'code'], spots: [], need: 'code' },
      { rooms: 1, depth: 3, junk: 2, locks: ['key', 'code', 'nails'], spots: [], need: 'nails' },
      { rooms: 2, depth: 3, junk: 2, locks: ['key', 'code', 'nails'], spots: [], need: 'door' },
      { rooms: 2, depth: 3, junk: 3, locks: ['key', 'code', 'nails'], spots: SPOT_VERBS.slice(0, 1), need: 'push' },
      { rooms: 2, depth: 4, junk: 3, locks: ['key', 'code', 'nails'], spots: SPOT_VERBS.slice(0, 2), need: 'lift' },
      { rooms: 3, depth: 4, junk: 3, locks: ['key', 'code', 'nails'], spots: SPOT_VERBS.slice(0, 3), need: 'empty' },
      { rooms: 3, depth: 4, junk: 4, locks: ['key', 'code', 'nails'], spots: SPOT_VERBS.slice(0, 4), need: 'turn' },
      { rooms: 3, depth: 5, junk: 4, locks: ['key', 'code', 'nails'], spots: SPOT_VERBS.slice(0, 5), need: 'search' },
      { rooms: 4, depth: 5, junk: 4, locks: ['key', 'code', 'nails'], spots: SPOT_VERBS.slice(0, 6), need: 'move' },
    ] as Spec[]
  )[lvl(level) - 1]!;

/** A room built in solving order: every lock's opener lies behind the lock before it (or in a hiding place). */
export function makeRoom(level: number, seed: number): Room {
  const sp = specFor(level);
  const r = rng(seed * 7477 + lvl(level) * 31);
  const rooms = ROOM_NAMES.slice(0, sp.rooms);
  const things: Thing[] = [];
  const items: Item[] = [];
  const metals = shuffle(r, METALS.slice());
  const boxes = shuffle(r, CONTAINERS.slice());
  const notes = shuffle(r, NOTES.slice());
  const junk = shuffle(r, JUNK.slice());
  const spotsLeft = shuffle(r, sp.spots.filter((v) => v !== sp.need));
  // Which links of the chain are doors: the exit last; the doors between rooms spread through the chain.
  const kinds: ('container' | 'door')[] = new Array(sp.depth).fill('container');
  kinds[sp.depth - 1] = 'door';
  const doorAt = shuffle(r, Array.from({ length: sp.depth - 1 }, (_, i) => i)).slice(0, sp.rooms - 1).sort((a, b) => a - b);
  for (const i of doorAt) kinds[i] = 'door';
  // The link that must use this level's new kind of lock (a code, or the crowbar on a box).
  const needAt = sp.need === 'code' ? randInt(r, 0, sp.depth - 1) : sp.need === 'nails' ? pick(r, kinds.map((k, i) => (k === 'container' ? i : -1)).filter((i) => i >= 0)) : -1;
  let room = 0;
  let nails = false;
  let needSpot = SPOT_VERBS.includes(sp.need);
  /** Where the opener of the next lock goes: loose in a room, or inside the last container. */
  let place: { room?: number; in?: number } = { room: 0 };
  /** A loose opener may lie in a hiding place instead (always the level's new one, the first time). */
  const hide = () => {
    if (place.room == null) return;
    const verb = needSpot ? sp.need : spotsLeft.length && r() < 0.4 ? spotsLeft.pop()! : null;
    if (!verb) return;
    needSpot = false;
    const [, name] = SPOTS.find(([v]) => v === verb)!;
    things.push({ name, kind: 'spot', verb, room: place.room, lock: 'none', start: 0 });
    place = { in: things.length - 1 };
  };
  const placeOpener = (lock: LockKind, target: string): { key?: number; code?: string } => {
    hide();
    if (lock === 'key') {
      const metal = metals.pop()!;
      items.push({ name: `${metal} key`, kind: 'key', ...place });
      return { key: items.length - 1 };
    }
    if (lock === 'code') {
      const code = String(randInt(r, 100, 999));
      items.push({ name: notes.pop() ?? 'note', kind: 'note', ...place, text: `the code for the ${target} is ${code}`, code });
      return { code };
    }
    if (lock === 'nails') items.push({ name: 'crowbar', kind: 'tool', ...place });
    return {};
  };
  // Build forwards in solving order (the first lock's opener lies loose in the start room).
  for (let i = 0; i < sp.depth; i++) {
    const kind = kinds[i]!;
    const exit = i === sp.depth - 1;
    const choices = sp.locks.filter((l) => l !== 'nails' || (!nails && kind === 'container'));
    const lock: LockKind = i === needAt ? (sp.need as LockKind) : pick(r, choices.length > 1 ? [choices[0]!, ...choices] : choices);
    if (lock === 'nails') nails = true;
    const name = kind === 'door' ? (exit ? 'exit' : `${rooms[room + 1]} door`) : boxes.pop() ?? `box ${i}`;
    const opener = placeOpener(lock, name);
    if (lock === 'key') things.push({ name, kind, room: pick(r, Array.from({ length: room + 1 }, (_, k) => k)), lock, key: opener.key, start: 0 });
    else things.push({ name, kind, room: pick(r, Array.from({ length: room + 1 }, (_, k) => k)), lock, code: opener.code, start: 0 });
    const t = things[things.length - 1]!;
    if (kind === 'door') {
      t.room = room;
      t.to = exit ? -1 : room + 1;
      if (!exit) room++;
      place = { room };
    } else place = { in: things.length - 1 };
  }
  // Useless things: junk, a key that fits nothing, an empty closed container, a note with no code.
  for (let j = 0; j < sp.junk; j++) {
    const roomJ = randInt(r, 0, rooms.length - 1);
    const what = r();
    if (what < 0.35 && junk.length) items.push({ name: junk.pop()!, kind: 'junk', room: roomJ });
    else if (what < 0.55 && metals.length) items.push({ name: `${metals.pop()} key`, kind: 'key', room: roomJ });
    else if (what < 0.8 && boxes.length) {
      things.push({ name: boxes.pop()!, kind: 'container', room: roomJ, lock: 'none', start: 1 });
      if (junk.length) items.push({ name: junk.pop()!, kind: 'junk', in: things.length - 1 });
    } else if (notes.length && sp.locks.includes('code')) items.push({ name: notes.pop()!, kind: 'note', room: roomJ, text: pick(r, ['buy milk', 'back in five minutes', 'the cat is called Biscuit']) });
    else if (junk.length) items.push({ name: junk.pop()!, kind: 'junk', room: roomJ });
  }
  return { rooms, things, items };
}

/**
 * The start. `codesKnown`: a written problem prints every note, so its reader already knows each code — the
 * notes count as read (in play, he has to read a note before he knows its code).
 */
export const startState = (m: Room, codesKnown = false): State => ({ at: 0, held: 0, st: m.things.map((t) => t.start), read: codesKnown ? m.items.reduce((mask, it, i) => (it.code ? mask | (1 << i) : mask), 0) : 0, out: false });
export const keyOf = (s: State) => `${s.at}|${s.held}|${s.st.join('')}|${s.read}|${s.out ? 1 : 0}`;

const has = (mask: number, i: number) => ((mask >> i) & 1) === 1;
/** Can he see this item here (on the floor, or in an open thing in this room)? */
export const visible = (m: Room, s: State, i: number) => {
  const it = m.items[i]!;
  if (has(s.held, i)) return false;
  if (it.room != null) return it.room === s.at;
  const t = m.things[it.in!]!;
  return t.room === s.at && s.st[it.in!] === 2;
};
const thingsHere = (m: Room, s: State) => m.things.map((t, i) => ({ t, i })).filter(({ t }) => t.room === s.at || (t.kind === 'door' && t.to === s.at));
const knownCodes = (m: Room, s: State) => [...new Set(m.items.map((it, i) => (it.code && has(s.read, i) ? it.code : '')).filter(Boolean))];

/** Every command that makes sense to type now (whether or not it will work). */
export function commands(m: Room, s: State): string[] {
  const out: string[] = [];
  const here = thingsHere(m, s);
  for (const { t } of here) if (t.kind === 'door') out.push(t.to === -1 ? 'go out' : `go ${m.rooms[t.room === s.at ? t.to! : t.room]}`);
  m.items.forEach((it, i) => visible(m, s, i) && out.push(`take ${it.name}`));
  for (const { t } of here) if (t.kind === 'container') out.push(`open ${t.name}`);
  for (const { t, i } of here) if (t.kind === 'spot' && s.st[i] === 0) out.push(`${t.verb} ${t.name}`);
  m.items.forEach((it, i) => it.kind === 'note' && (visible(m, s, i) || has(s.held, i)) && out.push(`read ${it.name}`));
  const keys = m.items.map((it, i) => ({ it, i })).filter(({ it, i }) => it.kind === 'key' && has(s.held, i));
  const locked = here.filter(({ t, i }) => t.kind !== 'spot' && s.st[i] === 0);
  for (const { t } of locked) for (const { it } of keys) out.push(`unlock ${t.name} with ${it.name}`);
  for (const code of knownCodes(m, s)) for (const { t } of locked) out.push(`enter ${code} on ${t.name}`);
  m.items.forEach((it, i) => {
    if (it.kind === 'tool' && has(s.held, i)) for (const { t } of locked) out.push(`use ${it.name} on ${t.name}`);
  });
  return out;
}

/** What a command does: the new state (or the same one) and what he is told. */
export function act(m: Room, s: State, cmd: string): { s: State; said: string } {
  const c = cmd
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\bthe /g, '')
    // Ways of saying the same thing: "leave through the exit", "take the key from the floor".
    .replace(/^(?:leave|exit|go through exit|leave through exit|walk out|go out through exit)$/, 'go out')
    .replace(/^((?:take|get|pick up) .+?) from (?:floor|.+)$/, '$1');
  const n: State = { ...s, st: s.st.slice() };
  const thing = (name: string) => m.things.findIndex((t) => t.name === name && (t.room === s.at || (t.kind === 'door' && t.to === s.at)));
  const item = (name: string) => m.items.findIndex((it) => it.name === name);
  let mm: RegExpMatchArray | null;
  if (c === 'go out' || c === 'go exit' || c === 'escape') {
    const t = thing('exit');
    if (t < 0) return { s, said: 'There is no way out here.' };
    if (s.st[t] !== 2) return { s, said: 'The exit is locked.' };
    n.out = true;
    return { s: n, said: 'You step outside. Free!' };
  }
  if ((mm = c.match(/^go (?:to )?(.+)$/))) {
    const room = m.rooms.indexOf(mm[1]!);
    const d = m.things.findIndex((t) => t.kind === 'door' && t.to !== -1 && ((t.room === s.at && t.to === room) || (t.to === s.at && t.room === room)));
    if (room < 0 || d < 0) return { s, said: 'You cannot go there from here.' };
    if (s.st[d] !== 2) return { s, said: `The ${m.things[d]!.name} is locked.` };
    n.at = room;
    return { s: n, said: `You go into the ${m.rooms[room]}.` };
  }
  if ((mm = c.match(/^(?:take|get|pick up) (.+)$/))) {
    const i = item(mm[1]!);
    if (i < 0 || !visible(m, s, i)) return { s, said: 'You do not see that here.' };
    n.held |= 1 << i;
    return { s: n, said: `You take the ${m.items[i]!.name}.` };
  }
  if ((mm = c.match(/^open (.+)$/))) {
    const t = thing(mm[1]!);
    if (t < 0) return { s, said: 'You do not see that here.' };
    if (s.st[t] === 2) return { s, said: 'It is already open.' };
    if (s.st[t] === 0) return { s, said: `The ${m.things[t]!.name} is locked.` };
    n.st[t] = 2;
    const inside = m.items.filter((it) => it.in === t).map((it) => it.name);
    return { s: n, said: `You open the ${m.things[t]!.name}${inside.length ? `. Inside: ${inside.join(', ')}` : '. It is empty'}.` };
  }
  if ((mm = c.match(/^read (.+)$/))) {
    const i = item(mm[1]!);
    if (i < 0 || !(visible(m, s, i) || has(s.held, i)) || m.items[i]!.kind !== 'note') return { s, said: 'You have nothing like that to read.' };
    n.read |= 1 << i;
    return { s: n, said: `It says: “${m.items[i]!.text}”.` };
  }
  if ((mm = c.match(/^unlock (.+) with (.+)$/))) {
    const t = thing(mm[1]!);
    const k = item(mm[2]!);
    if (t < 0 || k < 0 || !has(s.held, k)) return { s, said: 'You cannot do that.' };
    const th = m.things[t]!;
    if (s.st[t] !== 0 || th.lock !== 'key' || th.key !== k) return { s, said: 'The key does not fit.' };
    n.st[t] = th.kind === 'door' ? 2 : 1;
    return { s: n, said: `The ${th.name} is unlocked.` };
  }
  if ((mm = c.match(/^(?:enter|type|dial) (\d+) (?:on|into|in) (.+)$/))) {
    const t = thing(mm[2]!);
    if (t < 0) return { s, said: 'You do not see that here.' };
    const th = m.things[t]!;
    if (!knownCodes(m, s).includes(mm[1]!)) return { s, said: 'You do not know that code.' };
    if (s.st[t] !== 0 || th.lock !== 'code' || th.code !== mm[1]) return { s, said: 'Nothing happens.' };
    n.st[t] = 2;
    const inside = th.kind === 'container' ? m.items.filter((it) => it.in === t).map((it) => it.name) : [];
    return { s: n, said: `Click — the ${th.name} opens${inside.length ? `. Inside: ${inside.join(', ')}` : ''}.` };
  }
  if ((mm = c.match(/^use (.+) on (.+)$/))) {
    const k = item(mm[1]!);
    const t = thing(mm[2]!);
    if (t < 0 || k < 0 || !has(s.held, k)) return { s, said: 'You cannot do that.' };
    const th = m.things[t]!;
    if (m.items[k]!.kind !== 'tool' || s.st[t] !== 0 || th.lock !== 'nails') return { s, said: 'Nothing happens.' };
    n.st[t] = 2;
    const inside = m.items.filter((it) => it.in === t).map((it) => it.name);
    return { s: n, said: `You prise the ${th.name} open${inside.length ? `. Inside: ${inside.join(', ')}` : ''}.` };
  }
  if ((mm = c.match(new RegExp(`^(${SPOT_VERBS.join('|')}) (.+)$`)))) {
    const t = thing(mm[2]!);
    if (t < 0) return { s, said: 'You do not see that here.' };
    const th = m.things[t]!;
    if (th.kind !== 'spot' || th.verb !== mm[1]) return { s, said: 'Nothing happens.' };
    if (s.st[t] === 2) return { s, said: 'You find nothing more.' };
    n.st[t] = 2;
    const found = m.items.filter((it) => it.in === t).map((it) => it.name);
    const where = SPOTS.find(([v]) => v === th.verb)![2];
    return { s: n, said: `You ${th.verb} the ${th.name}${found.length ? `. Found: ${found.join(', ')} (${where} it)` : '. Nothing there'}.` };
  }
  return { s, said: 'I do not understand that.' };
}

/**
 * Commands that can never be part of a shortest way out, left out of the search to keep it small (and
 * exact): taking a thing no lock needs (junk, a key that fits nothing, a note — a note can be read where it
 * lies, and a code once read is remembered) and reading a note that tells no code. Each only changes
 * something nothing else ever looks at, so a way out that uses one is still a way out without it — and
 * shorter.
 */
export function useless(m: Room, c: string): boolean {
  const take = c.match(/^take (.+)$/);
  if (take) {
    const i = m.items.findIndex((it) => it.name === take[1]);
    const it = m.items[i];
    return !it || it.kind === 'junk' || it.kind === 'note' || (it.kind === 'key' && !m.things.some((t) => t.key === i));
  }
  const read = c.match(/^read (.+)$/);
  return !!read && !m.items.find((it) => it.name === read[1])?.code;
}

/** Ground truth: the shortest list of commands out (breadth-first over every state; see `useless`). */
export function shortest(m: Room, all = false, codesKnown = false): string[] | null {
  const s0 = startState(m, codesKnown);
  const prev = new Map<string, [string, string] | null>([[keyOf(s0), null]]);
  let frontier = [s0];
  while (frontier.length) {
    const next: State[] = [];
    for (const s of frontier)
      for (const c of commands(m, s)) {
        if (!all && useless(m, c)) continue;
        const r = act(m, s, c);
        const k = keyOf(r.s);
        if (prev.has(k)) continue;
        prev.set(k, [keyOf(s), c]);
        if (r.s.out) {
          const path: string[] = [];
          let at: string | undefined = k;
          while (at) {
            const p: [string, string] | null | undefined = prev.get(at);
            if (!p) break;
            path.unshift(p[1]);
            at = p[0];
          }
          return path;
        }
        next.push(r.s);
      }
    frontier = next;
  }
  return null;
}

// ---- what he sees ------------------------------------------------------------------------------------------

const PAST: Record<string, string> = { push: 'pushed', lift: 'lifted', empty: 'emptied', turn: 'turned', search: 'searched', move: 'moved' };
const lockWords = (m: Room, t: Thing, st: number) => (t.kind === 'spot' ? (st === 2 ? `already ${PAST[t.verb!]}` : `it looks as if it could be ${PAST[t.verb!]}`) : st === 2 ? 'open' : st === 1 ? 'closed' : t.lock === 'key' ? `locked — it has a ${m.items[t.key!]!.name.replace(' key', '')} lock` : t.lock === 'code' ? 'locked — it has a keypad' : t.lock === 'nails' ? 'nailed shut' : 'locked');

/** The room as a player sees it. */
export function look(m: Room, s: State): string {
  const here = thingsHere(m, s);
  const things = here.map(({ t, i }) => `${t.kind === 'door' ? (t.to === -1 ? 'the exit' : `a door to the ${m.rooms[t.room === s.at ? t.to! : t.room]}`) : `a ${t.name}`} (${lockWords(m, t, s.st[i]!)})`);
  const loose = m.items.map((it, i) => (visible(m, s, i) ? it.name : '')).filter(Boolean);
  const held = m.items.map((it, i) => (has(s.held, i) ? it.name : '')).filter(Boolean);
  return `You are in the ${m.rooms[s.at]}. You see: ${[...things, ...loose.map((x) => `a ${x}`)].join(', ') || 'nothing'}. You carry: ${held.join(', ') || 'nothing'}.`;
}

/** The whole room with nothing hidden (for a written problem). */
export function fullText(m: Room): string {
  const lines: string[] = [];
  m.rooms.forEach((rn, ri) => {
    const things = m.things.filter((t) => t.room === ri);
    const parts = things.map((t) => {
      const ti = m.things.indexOf(t);
      const what = t.kind === 'door' ? (t.to === -1 ? 'the exit' : `a door to the ${m.rooms[t.to!]}`) : `a ${t.name}`;
      const inside = m.items.filter((it) => it.in === ti).map((it) => `a ${it.name}${it.text ? ` (it reads “${it.text}”)` : ''}`);
      if (t.kind === 'spot') return `${what} (${lockWords(m, t, t.start)})${inside.length ? ` with ${inside.join(' and ')} ${SPOTS.find(([v]) => v === t.verb)![2]} it` : ''}`;
      return `${what} (${lockWords(m, t, t.start)})${inside.length ? ` containing ${inside.join(' and ')}` : t.kind === 'container' ? ' (empty)' : ''}`;
    });
    const loose = m.items.filter((it) => it.room === ri).map((it) => `a ${it.name}${it.text ? ` (it reads “${it.text}”)` : ''} on the floor`);
    lines.push(`The ${rn}${ri === 0 ? ' (you start here)' : ''}: ${[...parts, ...loose].join('; ') || 'nothing'}.`);
  });
  return lines.join('\n');
}

export const FEATURES = 32;
const VERBS_F = ['take', 'open', 'unlock', 'enter', 'read', 'use', 'go'];
/** The weight that says how much he likes a command's verb (-1: none); a verb whose weight is still exactly 0 he has never practised. */
export function verbFeature(cmd: string): number {
  if (cmd === 'go out') return 7;
  const v = cmd.split(' ')[0]!;
  const i = VERBS_F.indexOf(v);
  if (i >= 0) return i;
  const k = SPOT_VERBS.indexOf(v);
  return k >= 0 ? 25 + k : -1;
}
/** Does he know this command at all? Only the verbs he has practised with (a weight for the verb). */
export const knows = (w: number[], cmd: string) => {
  const f = verbFeature(cmd);
  return f < 0 || w[f] !== 0;
};
/** The weights a level's rooms bear on: everything general, and the verbs its rooms use. */
export function activeFeatures(level: number): boolean[] {
  const sp = specFor(level);
  const verbs = new Set(['take', 'open', 'unlock', 'go out', ...(sp.locks.includes('code') ? ['read', 'enter'] : []), ...(sp.locks.includes('nails') ? ['use'] : []), ...(sp.rooms > 1 ? ['go'] : []), ...sp.spots]);
  const on = new Array(FEATURES).fill(true);
  for (const v of [...VERBS_F, 'go out', ...SPOT_VERBS]) on[verbFeature(v === 'go out' ? v : `${v} x`)] = verbs.has(v);
  return on;
}

/** Facts about a command, from what he can see now (and what the last command showed him). */
function features(m: Room, s: State, cmd: string, fresh: Set<string>, visited: Set<number>): number[] {
  const [verb] = cmd.split(' ');
  const target = cmd.match(/(?:open|unlock|on) (.+?)(?: with .+)?$/)?.[1] ?? cmd.replace(/^(take|read|go|push|lift|empty|turn|search|move) /, '');
  const ti = m.things.findIndex((t) => t.name === target);
  const t = ti >= 0 ? m.things[ti] : null;
  const keyName = cmd.match(/ with (.+)$/)?.[1];
  const lockName = t && t.lock === 'key' && s.st[ti] === 0 ? m.items[t.key!]!.name.replace(' key', '') : '';
  const room = verb === 'go' && cmd !== 'go out' ? m.rooms.indexOf(cmd.slice(3)) : -1;
  const code = cmd.match(/^enter (\d+) on (.+)$/);
  const note = code ? m.items.find((it, i) => it.code === code[1] && has(s.read, i)) : null;
  // The door he would go through (or the exit), and whether it is still locked.
  const door = room >= 0 ? m.things.findIndex((x) => x.kind === 'door' && x.to !== -1 && ((x.room === s.at && x.to === room) || (x.to === s.at && x.room === room))) : cmd === 'go out' ? m.things.findIndex((x) => x.name === 'exit') : -1;
  const ii = m.items.findIndex((it) => it.name === target);
  const fits = t && s.st[ti] === 0 && ((verb === 'unlock' && t.lock === 'key') || (verb === 'enter' && t.lock === 'code') || (verb === 'use' && t.lock === 'nails'));
  // What he remembers of a room he has been in: something there still shut, or a lock there he can now open.
  const there = room >= 0 && visited.has(room) ? m.things.map((x, i) => ({ x, i })).filter(({ x }) => x.room === room || (x.kind === 'door' && x.to === room)) : [];
  const shutThere = there.some(({ i }) => s.st[i] !== 2);
  const canThere = there.some(({ x, i }) => s.st[i] === 0 && ((x.lock === 'key' && has(s.held, x.key!)) || (x.lock === 'code' && knownCodes(m, s).includes(x.code!)) || (x.lock === 'nails' && m.items.some((it, k) => it.kind === 'tool' && has(s.held, k)))));
  const unfinished = thingsHere(m, s).some(({ t: x, i }) => x.kind === 'container' && s.st[i] !== 2) || m.items.some((_, i) => visible(m, s, i));
  return [
    verb === 'take' ? 1 : 0,
    verb === 'open' ? 1 : 0,
    verb === 'unlock' ? 1 : 0,
    verb === 'enter' ? 1 : 0,
    verb === 'read' ? 1 : 0,
    verb === 'use' ? 1 : 0,
    room >= 0 ? 1 : 0,
    cmd === 'go out' ? 1 : 0,
    keyName && lockName && keyName.startsWith(lockName) ? 1 : 0,
    fresh.has(target) ? 1 : 0,
    room >= 0 && !visited.has(room) ? 1 : 0,
    verb === 'take' && target.endsWith('key') ? 1 : 0,
    verb === 'take' && ii >= 0 && m.items[ii]!.kind === 'tool' ? 1 : 0,
    note && code && note.text!.includes(`the ${code[2]} `) ? 1 : 0,
    room >= 0 && unfinished ? 1 : 0,
    t && s.st[ti] === 0 && (verb === 'unlock' || verb === 'use' || verb === 'enter') ? 1 : 0,
    verb === 'open' && t && s.st[ti] === 1 ? 1 : 0,
    verb === 'open' && t && s.st[ti] === 0 ? 1 : 0,
    door >= 0 && s.st[door] !== 2 ? 1 : 0,
    verb === 'read' && ii >= 0 && has(s.read, ii) ? 1 : 0,
    verb === 'take' && ii >= 0 && m.items[ii]!.kind === 'note' ? 1 : 0,
    fits ? 1 : 0,
    verb === 'take' && ii >= 0 && !/ key$/.test(target) && m.items[ii]!.kind !== 'tool' && m.items[ii]!.kind !== 'note' ? 1 : 0,
    shutThere ? 1 : 0,
    canThere ? 1 : 0,
    ...SPOT_VERBS.map((v) => (verb === v ? 1 : 0)),
    SPOT_VERBS.includes(verb!) ? 1 : 0,
  ];
}

export interface Play {
  out: boolean;
  steps: number;
  /** Locks he opened. */
  opened: number;
  log: { cmd: string; said: string }[];
}

const opened = (s: State) => s.st.filter((x) => x > 0).length;

/** He plays a room: the best-scored command each time (ties: a coin toss), never one that did nothing here before. */
export function play(m: Room, w: number[], budget: number, seed: number): Play {
  const r = rng(seed);
  let s = startState(m);
  /** (situation, command) pairs already tried: the world never changes by itself, so trying one again can only go round in a circle. */
  const tried = new Set<string>();
  const visited = new Set<number>([0]);
  let fresh = new Set<string>();
  const log: { cmd: string; said: string }[] = [];
  for (let step = 0; step < budget; step++) {
    const k = keyOf(s);
    // Only commands he knows how to give (a verb he has never practised is not in his head yet).
    const cmds = commands(m, s).filter((c) => !tried.has(`${k}|${c}`) && knows(w, c));
    if (!cmds.length) return { out: false, steps: budget, opened: opened(s), log };
    let best = '';
    let bs = -Infinity;
    for (const c of cmds) {
      const sc = features(m, s, c, fresh, visited).reduce((t, x, j) => t + x * w[j]!, 0) + r() * 1e-6;
      if (sc > bs) (bs = sc), (best = c);
    }
    const res = act(m, s, best);
    log.push({ cmd: best, said: res.said });
    tried.add(`${k}|${best}`);
    // What just appeared (opened things show their insides; a new room shows its things).
    fresh = new Set([...res.said.matchAll(/(?:Inside|Found): ([^.(]+)/g)].flatMap((x) => x[1]!.trim().split(', ')));
    if (res.s.at !== s.at) for (const { t } of thingsHere(m, res.s)) fresh.add(t.name);
    s = res.s;
    visited.add(s.at);
    if (s.out) return { out: true, steps: step + 1, opened: opened(s), log };
  }
  return { out: false, steps: budget, opened: opened(s), log };
}

export interface Graded {
  m: Room;
  best: number;
  seed: number;
}
/** The first n rooms from seed `from` on, with their shortest ways (worked out by the search). */
function fresh(level: number, from: number, n: number): Graded[] {
  const b: Graded[] = [];
  for (let seed = from; b.length < n; seed++) {
    const m = makeRoom(level, seed);
    const p = shortest(m);
    if (p) b.push({ m, best: p.length, seed });
  }
  return b;
}
const sets = new Map<string, Graded[]>();
/**
 * Held-out rooms (20, never practised on) and practice rooms (24, other seeds), with the shortest way out
 * of each — stored (escapesets.ts) so the phone does not wait on the searches; `bench(level, true)` /
 * `practiceRooms(level, true)` search again (the tests check they agree).
 */
function set(level: number, which: 'bench' | 'practice', fresh_ = false): Graded[] {
  const L = lvl(level);
  const [from, n] = which === 'bench' ? [70000, 20] : [80000, 24];
  if (fresh_) return fresh(L, from, n);
  const key = `${L}:${which}`;
  let b = sets.get(key);
  if (!b) {
    const st = ESCAPE_SETS[L - 1]?.[which === 'bench' ? 0 : 1];
    b = st ? st.split(' ').map((x) => x.split(':').map(Number) as [number, number]).map(([seed, best]) => ({ m: makeRoom(L, seed), best, seed })) : fresh(L, from, n);
    sets.set(key, b);
  }
  return b;
}
export const bench = (level: number, fresh_ = false) => set(level, 'bench', fresh_);
export const practiceRooms = (level: number, fresh_ = false) => set(level, 'practice', fresh_);
const practice = (level: number) => practiceRooms(level);

/** One room's score: shortest ÷ his steps if he escapes within twice the shortest, else 0. */
export const scoreRoom = (g: Graded, w: number[]) => {
  const p = play(g.m, w, 2 * g.best, g.seed);
  return { p, score: p.out ? g.best / p.steps : 0 };
};

class EscapeEnv implements Env {
  m: Room = makeRoom(1, 1);
  s: State = startState(this.m);
  constructor(private level: number) {}
  reset(seed: number) {
    this.m = makeRoom(this.level, seed);
    this.s = startState(this.m);
  }
  /** Index into commands() now. */
  actions() {
    return commands(this.m, this.s).map((_, i) => i);
  }
  step(a: number) {
    const c = commands(this.m, this.s)[a];
    if (!c) return { reward: -1, done: true };
    this.s = act(this.m, this.s, c).s;
    return { reward: this.s.out ? 10 : -0.1, done: this.s.out };
  }
  describe() {
    return `${look(this.m, this.s)} Commands: ${commands(this.m, this.s).join('; ')}.`;
  }
}

interface EscapeSave {
  game: 'escape';
  level: number;
  w: number[];
  best: number;
  sigma: number;
  rand: number;
}

class EscapeLearner implements Learner {
  w: number[];
  best: number;
  sigma: number;
  rand: number;
  r: () => number;
  constructor(
    private level: number,
    seed: number,
    saved?: unknown,
  ) {
    const s = savedFor<EscapeSave>(saved, 'escape');
    this.rand = s?.rand ?? seed;
    this.r = rng(this.rand);
    // He starts knowing nothing: every command looks as good as any other, so he tries them at random.
    this.w = s?.w?.length === FEATURES ? s.w.slice() : new Array(FEATURES).fill(0);
    // A new level: a fresh, wide search from what he knew (a narrow one could stay stuck where the last level left it).
    this.sigma = s?.level === level ? s.sigma : 1;
    this.best = s?.level === level ? s.best : this.practiceScore(this.w);
  }
  /** Practice score: escapes (and how quickly) first; for a room he does not get out of, how many locks he opened. */
  practiceScore(w: number[]) {
    let sc = 0;
    for (const g of practice(this.level)) {
      const p = play(g.m, w, 3 * g.best, g.seed);
      sc += p.out ? 1 + g.best / p.steps : (0.5 * p.opened) / g.m.things.filter((t) => t.start === 0).length;
    }
    return sc;
  }
  train(n: number) {
    let done = 0;
    while (done < n) {
      // Only what this level's rooms can show him is nudged: a verb he has not met stays unknown.
      const on = activeFeatures(this.level);
      const cand = this.w.map((x, i) => (on[i] ? x + this.sigma * gauss(this.r) : x));
      const sc = this.practiceScore(cand);
      done += practice(this.level).length;
      if (sc >= this.best) {
        this.w = cand;
        this.best = sc;
        this.sigma = Math.min(3, this.sigma * 1.4);
      } else this.sigma = Math.max(0.05, this.sigma * 0.9);
    }
    this.rand = (this.rand + done * 2654435761) >>> 0;
    return done;
  }
  measure() {
    const set = bench(this.level);
    let sum = 0;
    let out = 0;
    let steps = 0;
    let best = 0;
    for (const g of set) {
      const { p, score } = scoreRoom(g, this.w);
      sum += score;
      if (score > 0) (out++, (steps += p.steps), (best += g.best));
    }
    return {
      mastery: sum / set.length,
      detail: `I escape ${out} of ${set.length} held-out rooms within twice the shortest way${out ? ` (${steps} steps where the shortest ways take ${best})` : ''}; shortest ways found by searching every state.`,
    };
  }
  save(): EscapeSave {
    return { game: 'escape', level: this.level, w: this.w.slice(), best: this.best, sigma: this.sigma, rand: this.rand };
  }
  view(): Frame {
    const names = ['take', 'open', 'unlock … with …', 'enter a code', 'read', 'use a tool', 'go to a room', 'go out', 'the key matches the lock', 'it just appeared', 'a room not seen yet', 'take a key', 'take a tool', 'the code is for that thing', 'leave with things undone', 'try a lock', 'open something closed', 'open something locked', 'go through a locked door', 'read a note again', 'take a note', 'the right way for that lock', 'take something else', 'back to a room with things still shut', 'back to a lock he can now open', ...SPOT_VERBS, 'search a hiding place'];
    const on = activeFeatures(this.level);
    const mx = Math.max(0.01, ...this.w.map(Math.abs));
    return { bars: names.map((nm, i) => [nm, Math.abs(this.w[i]!) / mx, this.w[i]! >= 0 ? 'tries first' : 'tries later'] as [string, number, string]).filter((_, i) => on[i]), caption: 'Which commands he tries first (the ones this level uses).' };
  }
  watch(seed: number): Frame[] {
    const m = makeRoom(this.level, seed);
    const best = shortest(m)!;
    const p = play(m, this.w, 2 * best.length, seed);
    const frames: Frame[] = [{ lines: [look(m, startState(m))], caption: `The shortest way out takes ${best.length} commands.` }];
    const lines: string[] = [];
    // Each frame: what he sees now, then his last few commands and what they did.
    let s = startState(m);
    p.log.forEach((x, i) => {
      s = act(m, s, x.cmd).s;
      lines.push(`> ${x.cmd}`, `  ${x.said}`);
      frames.push({ lines: [look(m, s), ...lines.slice(-10)], caption: `Step ${i + 1}` });
    });
    frames.push({ lines: [look(m, s), ...lines.slice(-10)], caption: p.out ? `Out in ${p.steps} steps (shortest ${best.length}).` : `Still inside after ${p.steps} steps. The shortest way: ${best.join(', ')}.` });
    return frames;
  }
}

// ---- problems ---------------------------------------------------------------------------------------------

function generate(level: number, seed: number): Problem {
  const m = makeRoom(level, seed);
  // Every note is printed below, so its code is known from the start: no need to read it first.
  const best = shortest(m, false, true)!;
  const text = [
    'An escape room, with nothing hidden from you:',
    fullText(m),
    'Commands (one per line): go <room>, go out, take <thing>, open <thing>, read <note>, unlock <thing> with <key>, enter <code> on <thing>, use <tool> on <thing>, and for a hiding place push, lift, empty, turn, search or move <thing> (whichever its description says). A key opens the lock of its own colour; unlocking a box leaves it closed (open it next); a door opens once unlocked; you can only see inside a box once it is open, and only things in the room you are in.',
    'Every code written above is already known to you: you can enter it without reading its note first.',
    'Give the shortest list of commands that gets you out.',
  ].join('\n');
  return { game: 'escape', level: lvl(level), seed, text, data: { level: lvl(level), seed, best: best.length, solution: best } };
}

const VERBS = /^(go|take|get|pick up|open|read|unlock|enter|type|dial|use|escape|leave|exit|walk out|push|lift|empty|turn|search|move)\b/;
/** The commands in a reply: every line (or part split by ; , "then") that starts with a command word; numbering and quotes off. */
export function readCommands(answer: string): string[] {
  return answer
    .split(/\n|;|,|\bthen\b/i)
    .map((x) => x.replace(/\*\*|__|`|["“”]/g, '').replace(/^\s*(?:\d+[.)]|[-*•>])\s*/, '').trim().toLowerCase().replace(/\.$/, ''))
    .filter((x) => VERBS.test(x));
}

function check(prob: Problem, answer: string): Verdict {
  const d = prob.data as { level: number; seed: number; best: number };
  const m = makeRoom(d.level, d.seed);
  const cmds = readCommands(answer);
  if (!cmds.length) return { correct: false, score: 0, why: 'No commands found.' };
  let s = startState(m, true);
  for (let i = 0; i < cmds.length; i++) {
    s = act(m, s, cmds[i]!).s;
    if (s.out) {
      const steps = i + 1;
      return steps <= d.best ? { correct: true, score: 1, why: `Out in ${steps} — as short as it gets.` } : { correct: false, score: d.best / steps, why: `Out, but in ${steps} commands; the shortest way takes ${d.best}.` };
    }
  }
  return { correct: false, score: 0, why: `After ${cmds.length} commands you are still inside.` };
}

export const escape: Game = {
  ...ESCAPE,
  env: (level) => new EscapeEnv(level),
  generate,
  check,
  learner: (level, seed, saved) => new EscapeLearner(level, seed, saved),
};
