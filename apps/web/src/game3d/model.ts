/**
 * GAME STUDIO 3D, the game itself (APPS ROUND, MAKE): what a 3-D game is, its six templates, and its logic without code.
 * Pure, no DOM, no three.js: the runtime (game3d/run.ts) draws it and Rapier moves it; the specs read this file directly.
 *
 * A game is a stage of THINGS (blocks, ramps, platforms that move, coins, gems, crates, pads, enemies, doors, switches and a goal),
 * a PLAYER (how it moves: run and jump, walk in first person, drive, roll, or fly a top-down ship), a look (sky, fog, light) and its
 * RULES: "when this happens, then do that" blocks (when the player touches a coin, add one to the score; when the score reaches 5,
 * open the door; when the time runs out, lose). Units are metres; y is up. Games are kept on this phone (`ghosty.game3d`).
 */

export type Kind = 'platformer' | 'explorer' | 'kart' | 'puzzle' | 'marble' | 'shooter';
export type ThingKind = 'block' | 'ramp' | 'platform' | 'coin' | 'gem' | 'crate' | 'pad' | 'enemy' | 'door' | 'switch' | 'goal' | 'bumper';
export type Body = 'fixed' | 'dynamic' | 'moving';

export interface Thing {
  id: string;
  kind: ThingKind;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  /** A ramp's slope, degrees, rising towards +z. */
  tilt?: number;
  body: Body;
  /** 0 (dead) to 1.2 (lively). */
  bounce: number;
  /** 0 (ice) to 1.5 (rubber). */
  friction: number;
  /** A platform that moves: along which axis, how far either way (m), how fast (m/s). */
  move?: { axis: 'x' | 'y' | 'z'; range: number; speed: number };
  /** Palette index (colour). */
  c: number;
}

export type When = 'start' | 'touch' | 'cover' | 'score' | 'timer' | 'fall' | 'all';
export type Then = 'score' | 'remove' | 'win' | 'lose' | 'open' | 'say' | 'respawn' | 'time';
export interface Rule {
  id: string;
  when: When;
  /** touch / all: the kind touched or gathered; score: at least n; timer: n seconds left (0 = run out). */
  what?: ThingKind;
  n?: number;
  then: Then;
  /** score / time: how many; say: the words; open: the kind opened (doors). */
  arg?: string;
}

export interface Game3D {
  id: string;
  name: string;
  kind: Kind;
  camera: 'third' | 'first' | 'chase' | 'top';
  sky: number;
  fog: number;
  /** The sun's brightness, 0.3 (dusk) to 2.5 (noon); absent: 1.5. */
  light?: number;
  /** Seconds on the clock (0: no clock). */
  time: number;
  /** Lives (0: no lives). */
  lives: number;
  gravity: number;
  spawn: { x: number; y: number; z: number };
  things: Thing[];
  rules: Rule[];
  at: number;
}

/** The palette (index → colour as a number for the 3-D materials), the design's own accents: blue, amber, green, red, ink, violet, white, stone. */
export const PALETTE = [0x4fb4ff, 0xffb547, 0x4fe3a8, 0xff6b6b, 0x2b3440, 0xb18cff, 0xf2f4f7, 0x8c96a3];
export const PALETTE_NAMES = ['Blue', 'Amber', 'Green', 'Red', 'Ink', 'Violet', 'White', 'Stone'];

export const KIND_WORDS: Record<Kind, { name: string; line: string; controls: string }> = {
  platformer: { name: 'Platformer', line: 'Run and jump across floating blocks and a moving platform, gather the coins, reach the flag.', controls: 'Stick to run, JUMP to jump.' },
  explorer: { name: 'First-person explorer', line: 'Walk a walled garden in first person and find the five gems before the clock runs out.', controls: 'Stick to walk, drag the view to look.' },
  kart: { name: 'Kart track', line: 'Drive a lap of the track through the three gates and back to the line, against the clock.', controls: 'Stick up to go, left and right to steer.' },
  puzzle: { name: 'Physics puzzle', line: 'Push the crates onto the glowing pads. Every crate is real: it slides, tips and stops.', controls: 'Stick to walk, walk into a crate to push it.' },
  marble: { name: 'Marble roll', line: 'Roll the marble down the ramps, off the bumpers and into the goal without falling.', controls: 'Stick to tip the marble.' },
  shooter: { name: 'Top-down shooter', line: 'Fly the ship, clear the enemies with FIRE, and keep away from them.', controls: 'Stick to fly, FIRE to shoot.' },
};
export const KINDS: Kind[] = ['platformer', 'explorer', 'kart', 'puzzle', 'marble', 'shooter'];

export const THING_WORDS: Record<ThingKind, string> = {
  block: 'Block', ramp: 'Ramp', platform: 'Moving platform', coin: 'Coin', gem: 'Gem', crate: 'Crate', pad: 'Pad', enemy: 'Enemy', door: 'Door', switch: 'Switch', goal: 'Goal', bumper: 'Bumper',
};
/** What each kind is, by default, when he adds one. */
export const THING_DEFAULTS: Record<ThingKind, Omit<Thing, 'id' | 'x' | 'y' | 'z'>> = {
  block: { kind: 'block', w: 2, h: 1, d: 2, body: 'fixed', bounce: 0, friction: 0.8, c: 7 },
  ramp: { kind: 'ramp', w: 3, h: 0.3, d: 5, tilt: 15, body: 'fixed', bounce: 0, friction: 0.8, c: 7 },
  platform: { kind: 'platform', w: 3, h: 0.4, d: 3, body: 'moving', bounce: 0, friction: 1, move: { axis: 'x', range: 3, speed: 1.2 }, c: 0 },
  coin: { kind: 'coin', w: 0.6, h: 0.6, d: 0.6, body: 'fixed', bounce: 0, friction: 0, c: 1 },
  gem: { kind: 'gem', w: 0.7, h: 0.7, d: 0.7, body: 'fixed', bounce: 0, friction: 0, c: 5 },
  crate: { kind: 'crate', w: 1, h: 1, d: 1, body: 'dynamic', bounce: 0.05, friction: 0.6, c: 1 },
  pad: { kind: 'pad', w: 1.4, h: 0.06, d: 1.4, body: 'fixed', bounce: 0, friction: 0.8, c: 2 },
  enemy: { kind: 'enemy', w: 0.9, h: 0.9, d: 0.9, body: 'moving', bounce: 0, friction: 0, move: { axis: 'x', range: 2, speed: 1 }, c: 3 },
  door: { kind: 'door', w: 2, h: 2.5, d: 0.3, body: 'fixed', bounce: 0, friction: 0.8, c: 5 },
  switch: { kind: 'switch', w: 0.8, h: 0.2, d: 0.8, body: 'fixed', bounce: 0, friction: 0.8, c: 2 },
  goal: { kind: 'goal', w: 1.6, h: 2.4, d: 1.6, body: 'fixed', bounce: 0, friction: 0, c: 2 },
  bumper: { kind: 'bumper', w: 1, h: 1, d: 1, body: 'fixed', bounce: 1.1, friction: 0.2, c: 3 },
};
/** Things the player passes through (gathered or reached), not stood on. */
export const PASS_THROUGH = new Set<ThingKind>(['coin', 'gem', 'goal', 'switch', 'pad']);

let n = 0;
const id = (p: string) => `${p}${(++n).toString(36)}`;
const T = (kind: ThingKind, x: number, y: number, z: number, over: Partial<Thing> = {}): Thing => ({ ...THING_DEFAULTS[kind], id: id(kind[0]!), x, y, z, ...over });
const R = (when: When, then: Then, extra: Partial<Rule> = {}): Rule => ({ id: id('r'), when, then, ...extra });
const ground = (w: number, d: number, c = 4, over: Partial<Thing> = {}) => T('block', 0, -0.5, 0, { w, h: 1, d, c, ...over });

/** A new game from one of the six templates, ready to play. */
export function template(kind: Kind, now = Date.now()): Game3D {
  const base = { id: `g${now.toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`, name: KIND_WORDS[kind].name, kind, at: now, gravity: 9.81, fog: 0.012, sky: 0x0d1620, lives: 0, time: 0 };
  switch (kind) {
    case 'platformer':
      return { ...base, camera: 'third', lives: 3, spawn: { x: 0, y: 1, z: 0 }, things: [
        ground(8, 8),
        T('block', 0, 0.5, 6, { w: 2, h: 1, d: 2 }), T('coin', 0, 1.6, 6),
        T('block', 3, 1.5, 9, { w: 2, h: 1, d: 2 }), T('coin', 3, 2.6, 9),
        T('platform', 0, 2.2, 13), T('coin', 0, 3.2, 13),
        T('block', 0, 2.5, 17.5, { w: 3, h: 1, d: 3 }), T('coin', -0.8, 3.6, 17.5), T('coin', 0.8, 3.6, 17.5),
        T('goal', 0, 4.2, 17.5),
      ], rules: [
        R('touch', 'score', { what: 'coin', arg: '1' }), R('touch', 'remove', { what: 'coin' }),
        R('touch', 'win', { what: 'goal' }), R('fall', 'respawn'),
      ] };
    case 'explorer':
      return { ...base, camera: 'first', time: 120, fog: 0.03, sky: 0x10202a, spawn: { x: 0, y: 1, z: 0 }, things: [
        ground(30, 30, 7),
        T('block', 0, 1.5, 15, { w: 30, h: 3, d: 0.5 }), T('block', 0, 1.5, -15, { w: 30, h: 3, d: 0.5 }),
        T('block', 15, 1.5, 0, { w: 0.5, h: 3, d: 30 }), T('block', -15, 1.5, 0, { w: 0.5, h: 3, d: 30 }),
        T('block', 5, 1, 5, { w: 4, h: 2, d: 0.5 }), T('block', -6, 1, -3, { w: 0.5, h: 2, d: 6 }), T('block', 2, 1, -8, { w: 6, h: 2, d: 0.5 }),
        T('gem', 10, 0.8, 10), T('gem', -10, 0.8, 9), T('gem', -11, 0.8, -11), T('gem', 9, 0.8, -10), T('gem', 0, 0.8, -12),
      ], rules: [
        R('touch', 'score', { what: 'gem', arg: '1' }), R('touch', 'remove', { what: 'gem' }),
        R('all', 'win', { what: 'gem' }), R('timer', 'lose', { n: 0 }),
      ] };
    case 'kart':
      return { ...base, camera: 'chase', time: 90, sky: 0x13202e, spawn: { x: 0, y: 0.6, z: -12 }, things: [
        ground(44, 44, 4),
        T('block', 0, 0.4, 0, { w: 20, h: 0.8, d: 16, c: 2 }),
        T('pad', 13, 0.04, 0, { w: 4, d: 1, c: 1 }), T('pad', 0, 0.04, 12, { w: 1, d: 4, c: 1 }), T('pad', -13, 0.04, 0, { w: 4, d: 1, c: 1 }),
        T('goal', 0, 0.6, -12, { w: 6, h: 0.2, d: 1, c: 6 }),
        T('bumper', 16, 0.5, 10), T('bumper', -16, 0.5, -10),
      ], rules: [
        R('touch', 'score', { what: 'pad', arg: '1' }), R('touch', 'remove', { what: 'pad' }),
        R('score', 'open', { n: 3, arg: 'goal' }), R('touch', 'win', { what: 'goal' }), R('timer', 'lose', { n: 0 }),
      ] };
    case 'puzzle':
      return { ...base, camera: 'third', sky: 0x161626, spawn: { x: 0, y: 1, z: -4 }, things: [
        ground(14, 14, 7),
        T('block', 0, 0.5, 7, { w: 14, h: 1, d: 0.4 }), T('block', 0, 0.5, -7, { w: 14, h: 1, d: 0.4 }), T('block', 7, 0.5, 0, { w: 0.4, h: 1, d: 14 }), T('block', -7, 0.5, 0, { w: 0.4, h: 1, d: 14 }),
        T('crate', -2, 0.5, 0), T('crate', 2, 0.5, 0),
        T('pad', -2, 0.03, 4), T('pad', 2, 0.03, 4),
      ], rules: [
        R('cover', 'score', { what: 'pad', arg: '1' }), R('cover', 'remove', { what: 'pad' }), R('score', 'win', { n: 2 }), R('start', 'say', { arg: 'Push both crates onto the green pads.' }),
      ] };
    case 'marble':
      return { ...base, camera: 'third', gravity: 9.81, sky: 0x0f1a24, spawn: { x: 0, y: 4.6, z: -10 }, things: [
        T('block', 0, 3.5, -10, { w: 4, h: 1, d: 4 }),
        T('ramp', 0, 2.6, -5, { tilt: 14, w: 3, d: 6 }),
        T('block', 0, 1, 0.5, { w: 6, h: 1, d: 5 }), T('bumper', -2, 2, 1.5), T('bumper', 2, 2, 1.5),
        T('ramp', 0, 0.2, 6, { tilt: 10, w: 3, d: 6 }),
        T('block', 0, -1, 11, { w: 5, h: 1, d: 5 }), T('goal', 0, 0.2, 12, { w: 1.4, h: 0.4, d: 1.4 }),
      ], rules: [R('touch', 'win', { what: 'goal' }), R('fall', 'respawn')] , lives: 3 };
    case 'shooter':
      return { ...base, camera: 'top', sky: 0x070b12, fog: 0, spawn: { x: 0, y: 0.6, z: -8 }, things: [
        ground(24, 24, 4),
        T('enemy', -6, 0.5, 6, { move: { axis: 'x', range: 3, speed: 1.4 } }), T('enemy', 6, 0.5, 6, { move: { axis: 'z', range: 3, speed: 1.2 } }),
        T('enemy', 0, 0.5, 9, { move: { axis: 'x', range: 5, speed: 1.8 } }), T('enemy', -8, 0.5, -2, { move: { axis: 'z', range: 4, speed: 1 } }),
        T('block', 4, 0.75, 0, { w: 2, h: 1.5, d: 2 }), T('block', -4, 0.75, 2, { w: 2, h: 1.5, d: 2 }),
      ], rules: [
        R('touch', 'lose', { what: 'enemy' }), R('all', 'win', { what: 'enemy' }),
      ] };
  }
}

// ---------------------------------------------------------------- the rules, worked out (pure)

export interface PlayState {
  score: number;
  lives: number;
  /** Seconds left (Infinity: no clock). */
  left: number;
  over: '' | 'won' | 'lost';
  /** Things taken off the stage this run. */
  gone: Set<string>;
  /** Kinds opened (a door, the goal). */
  open: Set<ThingKind>;
  said: string;
  /** Respawn asked for. */
  respawn: boolean;
}

export function startState(g: Game3D): PlayState {
  return { score: 0, lives: g.lives || 0, left: g.time > 0 ? g.time : Infinity, over: '', gone: new Set(), open: new Set(), said: '', respawn: false };
}

export type GameEvent = { e: 'start' } | { e: 'touch'; thing: Thing } | { e: 'cover'; thing: Thing } | { e: 'fall' } | { e: 'tick'; dt: number } | { e: 'shot'; thing: Thing };

/** Is a kind waiting to be opened (a rule opens it), so it stays shut until then? */
export const locked = (g: Game3D, k: ThingKind): boolean => g.rules.some((r) => r.then === 'open' && r.arg === k);

/** One event, through every rule: the new state (never throws; an unknown block does nothing). */
export function react(g: Game3D, s: PlayState, ev: GameEvent): PlayState {
  if (s.over) return s;
  const next: PlayState = { ...s, gone: new Set(s.gone), open: new Set(s.open), respawn: false };
  const run = (r: Rule, thing?: Thing) => {
    switch (r.then) {
      case 'score': next.score += Number(r.arg ?? 1) || 1; break;
      case 'remove': if (thing) next.gone.add(thing.id); break;
      case 'win': next.over = 'won'; break;
      case 'lose': next.over = 'lost'; break;
      case 'open': if (r.arg) next.open.add(r.arg as ThingKind); break;
      case 'say': next.said = String(r.arg ?? '').slice(0, 80); break;
      case 'respawn':
        if (next.lives > 0) {
          next.lives -= 1;
          if (next.lives === 0) next.over = 'lost';
        }
        next.respawn = true;
        break;
      case 'time': next.left += Number(r.arg ?? 10) || 10; break;
    }
  };
  const before = s.score;
  if (ev.e === 'start') for (const r of g.rules) if (r.when === 'start') run(r);
  if (ev.e === 'fall') for (const r of g.rules) if (r.when === 'fall') run(r);
  if (ev.e === 'cover') {
    if (next.gone.has(ev.thing.id)) return s;
    for (const r of g.rules) if (r.when === 'cover' && r.what === ev.thing.kind) run(r, ev.thing);
  }
  if (ev.e === 'touch' || ev.e === 'shot') {
    const t = ev.thing;
    if (next.gone.has(t.id)) return s;
    // a locked kind (the goal before its gates) does nothing until a rule opens it
    if (locked(g, t.kind) && !next.open.has(t.kind)) return s;
    // (a shot is not a touch: shooting an enemy never runs "when the player touches an enemy")
    if (ev.e === 'touch') for (const r of g.rules) if (r.when === 'touch' && r.what === t.kind) run(r, t);
    if (ev.e === 'shot' && t.kind === 'enemy') {
      next.gone.add(t.id);
      next.score += 1;
    }
  }
  if (ev.e === 'tick' && Number.isFinite(next.left)) {
    next.left = Math.max(0, next.left - ev.dt);
    if (next.left === 0) for (const r of g.rules) if (r.when === 'timer' && (r.n ?? 0) === 0) run(r);
  }
  // score thresholds crossed by this event
  if (next.score !== before) for (const r of g.rules) if (r.when === 'score' && before < (r.n ?? 0) && next.score >= (r.n ?? 0)) run(r);
  // every one of a kind gathered
  for (const r of g.rules) {
    if (r.when !== 'all' || !r.what || next.over) continue;
    const all = g.things.filter((t) => t.kind === r.what);
    if (all.length && all.every((t) => next.gone.has(t.id)) && !all.every((t) => s.gone.has(t.id))) run(r);
  }
  return next;
}

/** A rule as a sentence: "When the player touches a coin, add 1 to the score." */
export function ruleWords(r: Rule): string {
  const thing = (k?: ThingKind) => (k ? THING_WORDS[k].toLowerCase() : 'thing');
  const when = r.when === 'start' ? 'When the game starts' : r.when === 'touch' ? `When the player touches a ${thing(r.what)}` : r.when === 'cover' ? `When a crate rests on a ${thing(r.what)}` : r.when === 'score' ? `When the score reaches ${r.n ?? 0}` : r.when === 'timer' ? 'When the time runs out' : r.when === 'fall' ? 'When the player falls off' : `When every ${thing(r.what)} is gone`;
  const then = r.then === 'score' ? `add ${r.arg ?? 1} to the score` : r.then === 'remove' ? 'take it away' : r.then === 'win' ? 'you win' : r.then === 'lose' ? 'you lose' : r.then === 'open' ? `open the ${thing(r.arg as ThingKind)}` : r.then === 'say' ? `say “${r.arg ?? ''}”` : r.then === 'respawn' ? 'start again from the spawn (one life)' : `add ${r.arg ?? 10} seconds`;
  return `${when}, ${then}.`;
}

export const WHENS: [When, string][] = [['start', 'The game starts'], ['touch', 'The player touches'], ['cover', 'A crate rests on'], ['score', 'The score reaches'], ['timer', 'The time runs out'], ['fall', 'The player falls off'], ['all', 'Every one is gone']];
export const THENS: [Then, string][] = [['score', 'Add to the score'], ['remove', 'Take it away'], ['win', 'You win'], ['lose', 'You lose'], ['open', 'Open'], ['say', 'Say'], ['respawn', 'Start again'], ['time', 'Add seconds']];

/** A new rule. */
export const newRule = (when: When = 'touch', then: Then = 'score', extra: Partial<Rule> = {}): Rule => R(when, then, extra);

/** A thing added where he is building: snapped to the 1 m grid, standing on the ground. */
export function addThing(g: Game3D, kind: ThingKind, at: { x: number; z: number }): Thing {
  const d = THING_DEFAULTS[kind];
  const t: Thing = { ...d, ...(d.move ? { move: { ...d.move } } : {}), id: id(kind[0]!), x: Math.round(at.x), y: Math.round((d.h / 2) * 100) / 100, z: Math.round(at.z) };
  g.things.push(t);
  return t;
}

/** A thing nudged by whole grid steps (and kept above the floor). */
export function nudge(t: Thing, dx: number, dy: number, dz: number): void {
  t.x = Math.round((t.x + dx) * 100) / 100;
  t.y = Math.max(-5, Math.round((t.y + dy) * 100) / 100);
  t.z = Math.round((t.z + dz) * 100) / 100;
}

// ---------------------------------------------------------------- kept on the phone

export const SAVE_KEY = 'ghosty.game3d';
export function readGames(raw: string | null): Game3D[] {
  try {
    const v = JSON.parse(raw ?? '[]') as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter((g): g is Game3D => !!g && typeof g === 'object' && typeof (g as Game3D).id === 'string' && KINDS.includes((g as Game3D).kind) && Array.isArray((g as Game3D).things) && Array.isArray((g as Game3D).rules)).slice(0, 30);
  } catch {
    return [];
  }
}
/** The list with this game saved first (the same id is saved over). */
export const saveGame = (list: Game3D[], g: Game3D, now = Date.now()): Game3D[] => [{ ...g, at: now }, ...list.filter((x) => x.id !== g.id)].slice(0, 30);

// ---------------------------------------------------------------- DESCRIBE A GAME: a draft from his words, as marked changes

export interface Change {
  id: string;
  /** What it does, in his words: "10 coins", "a low-gravity world". */
  words: string;
  kind: 'count' | 'sky' | 'gravity' | 'time' | 'lives' | 'ice' | 'name';
  thing?: ThingKind;
  n?: number;
  value?: string;
}
export interface Draft {
  kind: Kind;
  /** Why this template: the words that chose it, or the default. */
  because: string;
  changes: Change[];
}

const NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, twenty: 20 };
const numOf = (w: string) => (/^\d+$/.test(w) ? Number(w) : NUM[w] ?? NaN);

/** His description read into a template and the changes to it, each to accept or reject (pure; nothing is changed until he says). */
export function draftFromWords(text: string): Draft | null {
  const t = String(text ?? '').toLowerCase().replace(/[^\w\s'-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length < 3) return null;
  const pick: [Kind, RegExp][] = [
    ['kart', /\b(kart|race|racing|racer|drive|driving|car|track|lap)s?\b/],
    ['marble', /\b(marble|roll|rolling|ball)s?\b/],
    ['shooter', /\b(shoot|shooter|shooting|space ?ship|ship|blast|laser)s?\b/],
    ['puzzle', /\b(puzzle|crate|crates|push|sokoban|box)s?\b/],
    ['explorer', /\b(explore|explorer|exploring|first[- ]person|maze|garden|find)\b/],
    ['platformer', /\b(platform|platformer|jump|jumping|run and jump|mario)s?\b/],
  ];
  const hit = pick.find(([, re]) => re.test(t));
  const kind = hit?.[0] ?? 'platformer';
  const changes: Change[] = [];
  let k = 0;
  const add = (c: Omit<Change, 'id'>) => changes.push({ ...c, id: `c${++k}` });
  const things: [ThingKind, RegExp][] = [['coin', /coins?/], ['gem', /gems?|jewels?|crystals?/], ['enemy', /enem(?:y|ies)|monsters?|baddies|aliens?/], ['crate', /crates?|boxes/], ['platform', /moving platforms?/], ['bumper', /bumpers?/]];
  for (const [th, re] of things) {
    const m = new RegExp(String.raw`\b(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve|twenty)\s+(?:\w+\s)?(?:${re.source})\b`).exec(t);
    if (!m) continue;
    const n = Math.max(1, Math.min(30, numOf(m[1]!)));
    if (Number.isFinite(n)) add({ kind: 'count', thing: th, n, words: `${n} ${n === 1 ? THING_WORDS[th].toLowerCase() : `${THING_WORDS[th].toLowerCase()}s`.replace(/ys$/, 'ies').replace('enemys', 'enemies')}` });
  }
  if (/\b(night|dark|space)\b/.test(t)) add({ kind: 'sky', value: '0d1620', words: 'a night sky' });
  else if (/\b(sunset|dusk|evening)\b/.test(t)) add({ kind: 'sky', value: 'c8743a', words: 'a sunset sky' });
  else if (/\b(day|sunny|daytime|bright)\b/.test(t)) add({ kind: 'sky', value: '3a6f9c', words: 'a daytime sky' });
  if (/\b(low[- ]gravity|moon|floaty|floating)\b/.test(t)) add({ kind: 'gravity', n: 1.62, words: 'low gravity, like the Moon (1.62 m/s²)' });
  else if (/\b(high[- ]gravity|heavy|jupiter)\b/.test(t)) add({ kind: 'gravity', n: 24.8, words: 'high gravity, like Jupiter (24.8 m/s²)' });
  if (/\b(ice|icy|slippery|frozen)\b/.test(t)) add({ kind: 'ice', words: 'slippery ice underfoot' });
  const time = /\b(\d+)\s*(second|sec|minute|min)s?\b/.exec(t);
  if (time) {
    const secs = Math.min(900, Number(time[1]) * (time[2]!.startsWith('min') ? 60 : 1));
    if (secs > 0) add({ kind: 'time', n: secs, words: `${secs} seconds on the clock` });
  }
  const lives = /\b(\d+|one|two|three|four|five)\s+lives\b/.exec(t);
  if (lives) add({ kind: 'lives', n: Math.min(9, numOf(lives[1]!)), words: `${numOf(lives[1]!)} lives` });
  const named = /\b(?:called|named)\s+([\w' -]{2,30})$/.exec(t);
  if (named) add({ kind: 'name', value: named[1]!.trim().replace(/\b\w/g, (c) => c.toUpperCase()), words: `called “${named[1]!.trim()}”` });
  return { kind, because: hit ? `“${hit[1].exec(t)![0]}”` : 'no kind named, so a platformer', changes };
}

/** One accepted change made to a game. */
export function applyChange(g: Game3D, c: Change): void {
  switch (c.kind) {
    case 'count': {
      const th = c.thing!;
      const have = g.things.filter((x) => x.kind === th);
      if (have.length > c.n!) {
        const drop = new Set(have.slice(c.n!).map((x) => x.id));
        g.things = g.things.filter((x) => !drop.has(x.id));
      }
      // more of them: set out on a ring round the spawn, a metre up, on the grid
      for (let i = have.length; i < c.n!; i++) {
        const a = (i / Math.max(1, c.n!)) * Math.PI * 2;
        const r = 4 + (i % 3) * 2;
        const t = addThing(g, th, { x: g.spawn.x + Math.cos(a) * r, z: g.spawn.z + Math.sin(a) * r });
        if (th === 'coin' || th === 'gem') t.y = 0.8;
      }
      // a game with gems or coins of its own gets the rules that gather them, if it has none
      if ((th === 'coin' || th === 'gem') && !g.rules.some((r) => r.when === 'touch' && r.what === th)) {
        g.rules.push(newRule('touch', 'score', { what: th, arg: '1' }), newRule('touch', 'remove', { what: th }));
      }
      if (th === 'enemy' && !g.rules.some((r) => r.what === 'enemy')) g.rules.push(newRule('touch', 'lose', { what: 'enemy' }));
      break;
    }
    case 'sky': g.sky = parseInt(c.value!, 16); break;
    case 'gravity': g.gravity = c.n!; break;
    case 'time':
      g.time = c.n!;
      if (!g.rules.some((r) => r.when === 'timer')) g.rules.push(newRule('timer', 'lose', { n: 0 }));
      break;
    case 'lives':
      g.lives = c.n!;
      if (!g.rules.some((r) => r.when === 'fall')) g.rules.push(newRule('fall', 'respawn'));
      break;
    case 'ice': for (const t of g.things) if (t.kind === 'block' || t.kind === 'ramp') t.friction = 0.05; break;
    case 'name': g.name = c.value!.slice(0, 40); break;
  }
}

/** The game the draft makes: its template, with only the changes he accepted. */
export function makeDraft(d: Draft, accepted: Set<string>, now = Date.now()): Game3D {
  const g = template(d.kind, now);
  for (const c of d.changes) if (accepted.has(c.id)) applyChange(g, c);
  return g;
}
