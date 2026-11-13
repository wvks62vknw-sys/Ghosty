/**
 * THEMES THAT MEAN SOMETHING (BRIEF-THEMES-2; his words, OWNER-ISSUES 141: "the black background and then like the lighter one
 * and even different colours and other small cool changes we can do in the theme that actually mean something … or even like
 * all these design choices we've seen along the way as theme options"). A theme is a RECIPE of three choices and the switches:
 *
 *   THE GROUND   what everything sits on (the surfaces, the inks, the lines, the points): Black, Graphite, Slate, Warm, Paper
 *   THE COLOUR   the accent: the twelve of today (state/theme.ts THEMES; their blocks in design/tokens.css)
 *   THE WORLD    what the directions seen along the way each DID, as drawing tokens: The Scan, The Map, The Eye, One Ink, Glass
 *   THE SWITCHES each one visible thing: glow, the floor, corners, readings, body size, motion, the sound, ground follows the day
 *
 * The twelve themes of today and the directions are PRESETS (a recipe with a name); a dial changed under a preset makes "Custom",
 * kept exactly as set. The orb in every world is the hologram (his decision, OWNER-ISSUES 142): a world governs its floor and its
 * glow, never its draw. Orbit (D1) is the fifth whole HUD (BRIEF-ORBIT-HUD): no bar, the orb is the way in. Grown Up (D3) is the sixth (BRIEF-GROWN-UP-HUD): Glass's look with one capsule and less on each screen.
 *
 * Pure (no DOM, no storage, no clock of its own): the phone (state/theme.ts, ui/dials.ts, the chat's words) and the brain's tests
 * (apps/edge/test/look.test.mjs) read the same tables. NEVER live GPS: ground-follows-the-day reads the phone's clock and his
 * home as he saved it in Settings (sunTimes, from his latitude and longitude), else 08:00 to 18:00.
 */

// ---------------------------------------------------------------- the ground

export const GROUND_KEYS = ['black', 'graphite', 'slate', 'warm', 'paper'] as const;
export type GroundKey = (typeof GROUND_KEYS)[number];
/** A ground the rooms in today's look can stand on (they are drawn light on dark until the shell pass): every ground but Paper. */
export type NightKey = Exclude<GroundKey, 'paper'>;

export interface Ground {
  key: GroundKey;
  label: string;
  /** What it is, in one sentence in my voice (the Ground row and THE LOOK say it). */
  line: string;
  /** A light ground: dark ink on bone. */
  light: boolean;
}

/** The five grounds, darkest first; Graphite (the lit graphite of PR #60) is the default. Their values: design/tokens.css. */
export const GROUNDS: Ground[] = [
  { key: 'black', label: 'Black', line: 'Nothing lit but what I’m looking at.', light: false },
  { key: 'graphite', label: 'Graphite', line: 'A lit room, never true black: my everyday.', light: false },
  { key: 'slate', label: 'Slate', line: 'A cold blue-black: the night room.', light: false },
  { key: 'warm', label: 'Warm', line: 'A warm black and bone ink, for reading at night.', light: false },
  { key: 'paper', label: 'Paper', line: 'Bone paper and dark ink, for reading in daylight.', light: true },
];
export const DEFAULT_GROUND: GroundKey = 'graphite';
export const DEFAULT_NIGHT: NightKey = 'graphite';

export const groundOf = (k: string): Ground | undefined => GROUNDS.find((g) => g.key === k);

// ---------------------------------------------------------------- the colour

/** The twelve colours, in Settings' order (their names and tag lines: state/theme.ts THEMES; their blocks: tokens.css). */
export const COLOUR_KEYS = ['reactor', 'graphite', 'ember', 'gold', 'crimson', 'violet', 'emerald', 'ice', 'rose', 'lime', 'sunset', 'mono'] as const;
export type ColourKey = (typeof COLOUR_KEYS)[number];
export const COLOUR_LABELS: Record<ColourKey, string> = {
  reactor: 'Reactor', graphite: 'Graphite', ember: 'Ember', gold: 'Gold', crimson: 'Crimson', violet: 'Violet',
  emerald: 'Emerald', ice: 'Ice', rose: 'Rose', lime: 'Lime', sunset: 'Sunset', mono: 'Mono',
};
export const DEFAULT_COLOUR: ColourKey = 'reactor';
export const isColour = (k: string): k is ColourKey => (COLOUR_KEYS as readonly string[]).includes(k);

// ---------------------------------------------------------------- the world

export const WORLD_KEYS = ['scan', 'map', 'eye', 'ink', 'glass', 'orbit', 'grown'] as const;
export type WorldKey = (typeof WORLD_KEYS)[number];

export interface World {
  key: WorldKey;
  label: string;
  /** Which direction it was (W1–W3 the worlds of round two, D2 round one, route C today's look). */
  from: string;
  /** What it draws, in one sentence in my voice. */
  line: string;
}

/** The five worlds; The Scan (his pick, W1) is the default. Their drawing tokens: design/tokens.css. */
export const WORLDS: World[] = [
  { key: 'scan', label: 'The Scan', from: 'W1', line: 'Everything sampled as points, hairline edges, corner marks round what I watch.' },
  { key: 'map', label: 'The Map', from: 'W2', line: 'A plotting grid with a crosshair every five squares, square pins round what I watch.' },
  { key: 'eye', label: 'The Eye', from: 'W3', line: 'Grain everywhere but the one sharp box I’m looking at, my line of sight drawn to it.' },
  { key: 'ink', label: 'One Ink', from: 'D2', line: 'One ink, rules instead of boxes, and a serif when I talk.' },
  { key: 'glass', label: 'Glass', from: 'route C', line: 'Today’s look: blurred glass, rounded corners and the glow.' },
  { key: 'orbit', label: 'Orbit', from: 'D1', line: 'No bar: my orb is the way in, the six rooms stand on a ring round it.' },
  { key: 'grown', label: 'Grown Up', from: 'D3', line: 'Today’s look with less on it: one capsule at the bottom of every screen.' },
];
export const DEFAULT_WORLD: WorldKey = 'scan';
/** What a world reaches today, said once on THE LOOK and the Theme page. */
export const ROOMS_LINE = 'Every room follows the world fully with the shell.';
export const worldOf = (k: string): World | undefined => WORLDS.find((w) => w.key === k);

// ---------------------------------------------------------------- the switches

export interface Switches {
  glow: 'on' | 'off';
  floor: 'on' | 'off';
  corners: 'world' | 'sharp' | 'round';
  readings: 'mono' | 'system';
  body: 17 | 19 | 21;
  motion: 'alive' | 'calm';
  sound: 'tone' | 'click' | 'off';
  day: 'off' | 'on';
}
export type SwitchKey = keyof Switches;

export const SWITCH_DEFAULTS: Switches = { glow: 'on', floor: 'on', corners: 'world', readings: 'mono', body: 17, motion: 'alive', sound: 'tone', day: 'off' };

export interface SwitchDef<K extends SwitchKey = SwitchKey> {
  key: K;
  label: string;
  /** What the switch is, in a sentence. */
  line: string;
  /** Each value with its word and the sentence of what it does. */
  options: { value: Switches[K]; label: string; line: string }[];
}

/** The eight switches: each one visible thing, each a sentence, each kept. */
export const SWITCHES: SwitchDef[] = [
  { key: 'glow', label: 'Glow', line: 'Whether my light glows round what is lit.', options: [
    { value: 'on', label: 'On', line: 'My light glows round what is lit: the room, my orb’s halo.' },
    { value: 'off', label: 'Off', line: 'No glow anywhere: every light is a clean line.' },
  ] },
  { key: 'floor', label: 'The floor', line: 'The world’s pattern behind every screen.', options: [
    { value: 'on', label: 'On', line: 'The world’s floor behind every screen: its points, its grid or its grain.' },
    { value: 'off', label: 'Off', line: 'A plain floor: nothing behind the words but the ground.' },
  ] },
  { key: 'corners', label: 'Corners', line: 'How square I draw a control.', options: [
    { value: 'world', label: 'The world’s', line: 'The world decides: square in The Scan, rounded in Glass.' },
    { value: 'sharp', label: 'Sharp', line: 'Every corner square, in every world.' },
    { value: 'round', label: 'Round', line: 'Every corner rounded, in every world.' },
  ] },
  { key: 'readings', label: 'Readings', line: 'The face my readings, tags and truth lines are set in.', options: [
    { value: 'mono', label: 'Mono', line: 'My readings in mono, so numbers line up like an instrument’s.' },
    { value: 'system', label: 'System', line: 'My readings in the phone’s own type, softer to read.' },
  ] },
  { key: 'body', label: 'Body', line: 'The size of every sentence; readings and tags grow with it.', options: [
    { value: 17, label: '17', line: 'Body text at 17 points: the floor I never go under.' },
    { value: 19, label: '19', line: 'Body text at 19 points; readings and tags a step bigger too.' },
    { value: 21, label: '21', line: 'Body text at 21 points; readings and tags two steps bigger.' },
  ] },
  { key: 'motion', label: 'Motion', line: 'Whether my marks and my eye move.', options: [
    { value: 'alive', label: 'Alive', line: 'My eye breathes, my lines type out, my boxes travel to what they lock on.' },
    { value: 'calm', label: 'Calm', line: 'My eye holds still, my lines appear whole, my boxes land where they land.' },
  ] },
  { key: 'sound', label: 'The sound', line: 'What you hear when I recognise a thing, on top of your sound setting.', options: [
    { value: 'tone', label: 'Tone', line: 'One short level tone when the box locks on.' },
    { value: 'click', label: 'Click', line: 'One small click when the box locks on.' },
    { value: 'off', label: 'Off', line: 'The box locks on in silence.' },
  ] },
  { key: 'day', label: 'Ground follows the day', line: 'Paper by day, your night ground after sunset, from your home’s sun times.', options: [
    { value: 'off', label: 'Off', line: 'The ground stays as you chose it, day and night.' },
    { value: 'on', label: 'On', line: 'Paper from sunrise to sunset at your home, your night ground after. Never your live location.' },
  ] },
];
export const switchOf = <K extends SwitchKey>(k: K): SwitchDef<K> => SWITCHES.find((s) => s.key === k) as unknown as SwitchDef<K>;

// ---------------------------------------------------------------- the recipe

export interface Recipe {
  ground: GroundKey;
  colour: ColourKey;
  world: WorldKey;
  /** The chosen night ground: the rooms in today's look stand on it under Paper, and the day ends on it. */
  night: NightKey;
  switches: Switches;
}

/** What the phone keeps beside `theme` (the colour, as ever: a bare colour key from before reads as Graphite + it + The Scan). */
export interface KeptLook {
  ground?: string;
  world?: string;
  night?: string;
  switches?: Partial<Record<SwitchKey, unknown>>;
}

const pick = <T extends string | number>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);

/** Every switch at a value it can have (anything else falls back to the default). */
export function cleanSwitches(s: Partial<Record<SwitchKey, unknown>> = {}): Switches {
  const out = { ...SWITCH_DEFAULTS };
  for (const d of SWITCHES) (out as Record<string, unknown>)[d.key] = pick(s[d.key], d.options.map((o) => o.value), SWITCH_DEFAULTS[d.key]);
  return out;
}

/**
 * The recipe from what the phone keeps: `theme` (the colour key) and `look` (the rest). A bare colour key — every phone before
 * this — reads as Graphite + the colour + The Scan with the default switches; an unknown colour is Reactor (state/theme.ts).
 */
export function recipeFrom(theme: string, look?: KeptLook | null): Recipe {
  const colour = isColour(theme) ? theme : DEFAULT_COLOUR;
  const ground = pick(look?.ground, GROUND_KEYS, DEFAULT_GROUND);
  const night = pick(look?.night, GROUND_KEYS.filter((k) => k !== 'paper') as NightKey[], ground !== 'paper' ? (ground as NightKey) : DEFAULT_NIGHT);
  return { ground, colour, world: pick(look?.world, WORLD_KEYS, DEFAULT_WORLD), night: ground !== 'paper' ? (ground as NightKey) : night, switches: cleanSwitches(look?.switches ?? {}) };
}

/** What the phone keeps of a recipe (the colour goes in `theme`, as ever). */
export const keptLook = (r: Recipe): KeptLook => ({ ground: r.ground, world: r.world, night: r.night, switches: { ...r.switches } });

export const sameRecipe = (a: Recipe, b: Recipe): boolean =>
  a.ground === b.ground && a.colour === b.colour && a.world === b.world && SWITCHES.every((s) => a.switches[s.key] === b.switches[s.key]);

// ---------------------------------------------------------------- the presets

export interface Preset {
  key: string;
  label: string;
  /** Its line under the name (the twelve: their own tag lines, from state/theme.ts THEMES). */
  tag: string;
  ground: GroundKey;
  colour: ColourKey;
  world: WorldKey;
  switches: Partial<Switches>;
  /** Which direction it was (the five beyond the twelve). */
  from?: string;
}

/** The directions as presets (BRIEF-THEMES-2 5), after the twelve. */
export const DIRECTION_PRESETS: Preset[] = [
  { key: 'scan', label: 'The Scan', tag: 'W1 as rendered: true black, the points, no glow', ground: 'black', colour: 'reactor', world: 'scan', switches: { glow: 'off' }, from: 'W1' },
  { key: 'map', label: 'The Map', tag: 'Slate and the plotting grid, square pins', ground: 'slate', colour: 'reactor', world: 'map', switches: {}, from: 'W2' },
  { key: 'eye', label: 'The Eye', tag: 'Black, grain, and the one sharp box', ground: 'black', colour: 'reactor', world: 'eye', switches: {}, from: 'W3' },
  { key: 'oneink', label: 'One Ink', tag: 'Warm black, bone ink, one gold light', ground: 'warm', colour: 'gold', world: 'ink', switches: { readings: 'system' }, from: 'D2' },
  { key: 'glass', label: 'Glass', tag: 'Today’s look: glass, round corners, the glow', ground: 'graphite', colour: 'reactor', world: 'glass', switches: {}, from: 'route C' },
  { key: 'orbit', label: 'Orbit', tag: 'Black, a ring of rooms, the orb is the way in', ground: 'black', colour: 'reactor', world: 'orbit', switches: {}, from: 'D1' },
  { key: 'grown', label: 'Grown Up', tag: 'Graphite and glass, one capsule, less on each screen', ground: 'graphite', colour: 'reactor', world: 'grown', switches: {}, from: 'D3' },
];

/** The six directions seen along the way (OWNER-ISSUES 141), in the catalogue's order: each is a preset now that Orbit (D1) is built. */
export const DIRECTIONS: { key: string; label: string; from: string; preset: boolean }[] = DIRECTION_PRESETS.map((p) => ({ key: p.key, label: p.label, from: p.from ?? '', preset: true }));

/** Every preset: the twelve (Graphite + the colour + The Scan + the default switches), then the five directions. */
export function presets(tags: Partial<Record<ColourKey, string>> = {}): Preset[] {
  return [
    ...COLOUR_KEYS.map((k): Preset => ({ key: k, label: COLOUR_LABELS[k], tag: tags[k] ?? COLOUR_LABELS[k], ground: 'graphite', colour: k, world: 'scan', switches: {} })),
    ...DIRECTION_PRESETS,
  ];
}
export const PRESET_KEYS: string[] = presets().map((p) => p.key);

/** A preset as a whole recipe (its night ground is its own ground: every preset stands on a dark one). */
export function presetRecipe(p: Preset): Recipe {
  return { ground: p.ground, colour: p.colour, world: p.world, night: p.ground === 'paper' ? DEFAULT_NIGHT : (p.ground as NightKey), switches: { ...SWITCH_DEFAULTS, ...p.switches } };
}

/** The preset this recipe is exactly, or null: "Custom". (Following the day is a switch like the others: on, it is Custom.) */
export function presetOf(r: Recipe, list: Preset[] = presets()): Preset | null {
  return list.find((p) => sameRecipe(presetRecipe(p), r)) ?? null;
}

// ---------------------------------------------------------------- the sun: ground follows the day (never live GPS)

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const J1970 = 2440588;
const J2000 = 2451545;
const toDays = (ms: number) => ms / DAY_MS - 0.5 + J1970 - J2000;
const fromJulian = (j: number) => (j + 0.5 - J1970) * DAY_MS;

/**
 * Sunrise and sunset at a place on the day `at` falls on (ms since 1970; the standard astronomical sunrise equation, the sun's
 * upper edge at the horizon with refraction: −0.833°). Null where the sun does not rise or set that day (a polar day or night).
 */
export function sunTimes(at: number, lat: number, lon: number): { rise: number; set: number } | null {
  const lw = RAD * -lon;
  const phi = RAD * lat;
  // the solar noon nearest to the middle of that day where he is
  const d = toDays(at);
  const n = Math.round(d - 0.0009 - lw / (2 * Math.PI));
  const ds = 0.0009 + lw / (2 * Math.PI) + n;
  const M = RAD * (357.5291 + 0.98560028 * ds);
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + RAD * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(L) * Math.sin(RAD * 23.4397));
  const noon = J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  const cosW = (Math.sin(RAD * -0.833) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
  if (!Number.isFinite(cosW) || cosW < -1 || cosW > 1) return null;
  const w = Math.acos(cosW);
  const set = noon + w / (2 * Math.PI);
  return { rise: fromJulian(noon - (set - noon)), set: fromJulian(set) };
}

/** A saved home's place (Settings; never the phone's live position). */
export interface HomePlace {
  lat: number;
  lon: number;
}

/**
 * Day or night at `now` for his saved home, and when it next flips: the sun's times there; with no home saved, 08:00 to 18:00 on
 * the phone's clock. A polar day is all day, a polar night all night (flipping again at the next local midnight, looked at anew).
 */
export function daylight(now: number, home: HomePlace | null): { day: boolean; flipAt: number; rise: number; set: number } {
  const local = (h: number, base = now) => new Date(new Date(base).setHours(h, 0, 0, 0)).getTime();
  const times = (base: number) => {
    if (!home || !Number.isFinite(home.lat) || !Number.isFinite(home.lon)) return { rise: local(8, base), set: local(18, base) };
    // the sun's times for the local day `base` falls on (asked at local noon, so a far longitude lands on the right date)
    const t = sunTimes(local(12, base), home.lat, home.lon);
    if (t) return t;
    // polar: the whole local day is day (the sun up at noon) or night
    const up = Math.sin(RAD * home.lat) * Math.sin(RAD * 23.44 * Math.sin((2 * Math.PI * (dayOfYear(base) - 80)) / 365)) > 0;
    const midnight = local(0, base);
    return up ? { rise: midnight, set: midnight + DAY_MS } : { rise: midnight + DAY_MS, set: midnight + DAY_MS };
  };
  const today = times(now);
  if (now < today.rise) return { day: false, flipAt: today.rise, ...today };
  if (now < today.set) return { day: true, flipAt: today.set, ...today };
  const tomorrow = times(now + DAY_MS);
  return { day: false, flipAt: Math.max(tomorrow.rise, now + 60_000), ...today };
}
const dayOfYear = (ms: number) => {
  const d = new Date(ms);
  return Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / DAY_MS);
};

/** The ground in force now: the chosen one, or (following the day) Paper by day and the night ground after. */
export function groundAt(r: Recipe, now: number, home: HomePlace | null): GroundKey {
  if (r.switches.day !== 'on') return r.ground;
  return daylight(now, home).day ? 'paper' : r.night;
}

/** "16:32" on the phone's clock, the way he reads it (24-hour). */
export const clockWords = (ms: number): string => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

// ---------------------------------------------------------------- the recipe in words

/** "Ember · Black · The Scan"; following the day, the ground says when it flips: "Reactor · Paper till 16:32 · The Scan". */
export function recipeWords(r: Recipe, o: { now?: number; home?: HomePlace | null } = {}): string {
  let ground = groundOf(r.ground)!.label;
  if (r.switches.day === 'on' && o.now != null) {
    const dl = daylight(o.now, o.home ?? null);
    ground = `${groundOf(dl.day ? 'paper' : r.night)!.label} till ${clockWords(dl.flipAt)}`;
  }
  return `${COLOUR_LABELS[r.colour]} · ${ground} · ${worldOf(r.world)!.label}`;
}

// ---------------------------------------------------------------- by words, with no model

/** A change to the recipe asked for in his words. `step`: one ground lighter or darker. */
export interface LookAsk {
  ground?: GroundKey;
  step?: 'lighter' | 'darker';
  /** "dark mode": back to his night ground. */
  night?: true;
  /** A direction by its name: its ground, its world and its switches (his colour kept). */
  direction?: string;
  world?: WorldKey;
  colour?: ColourKey;
  switches?: Partial<Switches>;
  /** "bigger text" / "smaller text": one step of BODY. */
  body?: 'bigger' | 'smaller';
}

const DIRECTION_WORDS: [RegExp, string][] = [
  [/^the scan$/, 'scan'],
  [/^the map$/, 'map'],
  [/^the eye$/, 'eye'],
  [/^one ink$/, 'oneink'],
  [/^glass$/, 'glass'],
  [/^orbit$/, 'orbit'],
  [/^grown[ -]?up$/, 'grown'],
];

/** The polite wrapping round a request, which changes nothing of what is asked. */
function bare(text: string): string {
  let t = text.toLowerCase().replace(/[’']/g, "'").replace(/[.!?,]+$/g, '').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3; i++) {
    t = t
      .replace(/^(?:hey |ok |okay |right |so |now |ghosty,? )+/, '')
      .replace(/^(?:please |pls |can you |could you |would you |will you |i want |i'd like |id like |let's have |lets have |let's |give me |i want to |go for )+/, '')
      .replace(/(?: please| pls| thanks| thank you| for me| now| instead)+$/, '')
      .trim();
  }
  return t;
}

/** The verbs a theme word comes after ("switch to", "use", "make it"), taken off; what is left names the thing. */
const VERB = /^(?:switch(?: it)?(?: over)? to |change(?: it)? to |change to |go(?: to)? |set(?: it)? to |use |try |turn(?: it)? (?:to |into )?|make(?: it| everything| the screen)? |put (?:it|me) (?:on|in) |show me |back to |i'll have |i'll take )/;
const LOOKISH = /(?: look| theme| world| preset| mode| style)$/;

/**
 * His words → the change they ask for, or null when they are not about the look. Only clear asks: "black background",
 * "lighter", "paper", "the scan", "the map", "the eye", "one ink", "glass", "calm", "bigger text", "follow the day", the
 * switches by name ("glow off", "sharp corners"), a colour after a verb ("switch to ember", "ember theme"). A question about
 * something else is never taken ("what's the map of London", "the eye of the storm").
 */
export function lookAsked(text: string): LookAsk | null {
  const t0 = bare(text);
  if (!t0 || t0.length > 60) return null;
  const t = t0.replace(VERB, '').trim();
  const verb = t !== t0;
  // ---- the ground
  let m = /^(?:a |the )?(black|graphite|slate|warm|paper|white|light|dark|bone)(?: black)? (?:background|ground|floor|page|mode|backdrop|screen|bg)$/.exec(t)
    ?? /^(?:the )?(?:background|ground|floor|screen|page)(?: to)? (black|graphite|slate|warm|paper|white|light|dark)$/.exec(t);
  if (m) return groundWord(m[1]!);
  if (/^(?:paper|slate)(?: ground)?$/.test(t)) return { ground: t.startsWith('paper') ? 'paper' : 'slate' };
  if (/^(?:light mode|day mode|lights on)$/.test(t)) return { ground: 'paper' };
  if (/^(?:dark mode|night mode|lights off)$/.test(t)) return { night: true };
  if (/^(?:true black|pure black|all black|black)$/.test(t)) return { ground: 'black' };
  m = /^(?:(?:a )?(?:bit|little|touch|shade) )?(lighter|brighter|darker|dimmer)(?: please)?(?: background| ground| screen| one)?$/.exec(t);
  if (m) return { step: m[1] === 'lighter' || m[1] === 'brighter' ? 'lighter' : 'darker' };
  // ---- a direction by its name (with or without "look", "theme", "world")
  const named = t.replace(LOOKISH, '').trim();
  for (const [re, key] of DIRECTION_WORDS) if (re.test(named) && (verb || named === t || LOOKISH.test(t))) return { direction: key };
  // ---- the switches by name
  if (/^(?:(?:the )?glow off|no glow|lose the glow|off the glow|turn off the glow|without (?:the )?glow|kill the glow)$/.test(t)) return { switches: { glow: 'off' } };
  if (/^(?:(?:the )?glow on|on the glow|turn on the glow|the glow back|bring back the glow|more glow|glow)$/.test(t)) return { switches: { glow: 'on' } };
  if (/^(?:(?:the )?floor off|no floor|plain floor|hide the floor|no pattern|floor pattern off|no points|points off)$/.test(t)) return { switches: { floor: 'off' } };
  if (/^(?:(?:the )?floor on|show the floor|floor pattern on|the floor back|points on)$/.test(t)) return { switches: { floor: 'on' } };
  if (/^(?:sharp|square|sharper|squarer) corners$/.test(t)) return { switches: { corners: 'sharp' } };
  if (/^(?:round|rounded|rounder|soft|softer) corners$/.test(t)) return { switches: { corners: 'round' } };
  if (/^(?:the world's corners|default corners|normal corners)$/.test(t)) return { switches: { corners: 'world' } };
  if (/^(?:mono off|no mono|readings in (?:the )?system(?: type)?|system (?:type|font) for readings|normal font for readings)$/.test(t)) return { switches: { readings: 'system' } };
  if (/^(?:mono on|mono readings|readings in mono)$/.test(t)) return { switches: { readings: 'mono' } };
  if (/^(?:bigger|larger|big|large) (?:text|type|writing|font|words)$|^(?:the )?(?:text|type|font|writing) (?:bigger|larger)$/.test(t)) return { body: 'bigger' };
  if (/^(?:smaller|small) (?:text|type|writing|font|words)$|^(?:the )?(?:text|type|font|writing) smaller$/.test(t)) return { body: 'smaller' };
  if (/^(?:normal|regular|default) (?:text|type|font)(?: size)?$/.test(t)) return { switches: { body: 17 } };
  if (/^(?:calm|calmer|calm mode|calm motion|less motion|reduce motion|no motion|keep still|stay still|hold still|be still|stop moving)$/.test(t)) return { switches: { motion: 'calm' } };
  if (/^(?:alive|motion on|more motion|move again|come alive|lively)$/.test(t)) return { switches: { motion: 'alive' } };
  if (/^(?:(?:the )?(?:recognition|lock) (?:sound|tone) off|no (?:recognition|lock) (?:sound|tone)|silent (?:lock|recognition))$/.test(t)) return { switches: { sound: 'off' } };
  if (/^(?:(?:the )?(?:recognition|lock) (?:sound|tone) (?:to )?click|(?:the )?click (?:sound|for the lock)|click when you lock on)$/.test(t)) return { switches: { sound: 'click' } };
  if (/^(?:(?:the )?(?:recognition|lock) (?:sound|tone) (?:to )?tone|(?:the )?tone (?:sound|for the lock)|(?:the )?(?:recognition|lock) (?:sound|tone) on)$/.test(t)) return { switches: { sound: 'tone' } };
  if (/^(?:follow the (?:day|sun|daylight)|ground follows the day|paper by day|day and night|follow sunrise and sunset)$/.test(t)) return { switches: { day: 'on' } };
  if (/^(?:stop following the (?:day|sun)|don't follow the (?:day|sun)|(?:follow the day|ground follows the day) off)$/.test(t)) return { switches: { day: 'off' } };
  // ---- a colour, after a verb or with its noun ("switch to ember", "ember theme", "make it gold")
  m = /^([a-z]+)(?: (?:theme|colour|color|accent|light))?$/.exec(t);
  if (m && isColour(m[1]!) && (verb || /(?:theme|colour|color|accent|light)$/.test(t))) return { colour: m[1] as ColourKey };
  m = /^(?:the )?(?:theme|colour|color|accent) (?:to )?([a-z]+)$/.exec(t);
  if (m && isColour(m[1]!)) return { colour: m[1] as ColourKey };
  return null;
}

function groundWord(w: string): LookAsk {
  if (w === 'white' || w === 'light' || w === 'bone') return { ground: 'paper' };
  if (w === 'dark') return { night: true };
  return { ground: w as GroundKey };
}

/**
 * One ground lighter or darker, or null at the end: "lighter" from any dark ground is the lit graphite first (his "the lighter
 * one"), then Paper; "darker" is Graphite from Paper, then Black.
 */
export function stepGround(now: GroundKey, dir: 'lighter' | 'darker'): GroundKey | null {
  if (dir === 'lighter') return now === 'paper' ? null : now === 'graphite' ? 'paper' : 'graphite';
  return now === 'black' ? null : now === 'paper' ? 'graphite' : 'black';
}

/** One step of BODY up or down (never under 17, never over 21). */
const bodyStep = (b: Switches['body'], dir: 'bigger' | 'smaller'): Switches['body'] => {
  const sizes: Switches['body'][] = [17, 19, 21];
  const i = sizes.indexOf(b) + (dir === 'bigger' ? 1 : -1);
  return sizes[Math.max(0, Math.min(sizes.length - 1, i))]!;
};

/**
 * A change applied to a recipe: the new recipe, and what I say about it, in one or two sentences (what changed, what stayed,
 * and the honest edge where there is one). Pure: the phone applies the recipe (state/theme.ts) and says the words.
 */
export function applyAsk(r: Recipe, ask: LookAsk, o: { now?: number; home?: HomePlace | null } = {}): { recipe: Recipe; said: string } {
  const next: Recipe = { ...r, switches: { ...r.switches } };
  const setGround = (g: GroundKey) => {
    next.ground = g;
    if (g !== 'paper') next.night = g;
    // asking for a ground by name is choosing it: following the day would undo it at the next flip
    next.switches.day = 'off';
  };
  const g = (k: GroundKey) => groundOf(k)!;
  let said = '';
  if (ask.ground) {
    setGround(ask.ground);
    said = `${g(ask.ground).label}: ${lc(g(ask.ground).line)}`;
    if (ask.ground === 'paper') said += ' Paper reaches the pages I draw in the new system first; the other rooms stay on your night ground until the shell.';
  } else if (ask.night) {
    setGround(r.night);
    said = `${g(r.night).label}, your night ground: ${lc(g(r.night).line)}`;
  } else if (ask.step) {
    const to = stepGround(groundAt(r, o.now ?? 0, o.home ?? null), ask.step);
    if (!to) said = ask.step === 'lighter' ? 'Paper is the lightest ground I have.' : 'Black is the darkest ground I have.';
    else {
      setGround(to);
      said = `${g(to).label}: ${lc(g(to).line)}`;
    }
  } else if (ask.direction) {
    const p = DIRECTION_PRESETS.find((x) => x.key === ask.direction)!;
    next.ground = p.ground;
    next.night = p.ground === 'paper' ? r.night : (p.ground as NightKey);
    next.world = p.world;
    // the direction's look (glow, floor, corners, readings as it was drawn); his comfort kept: body size, motion, the sound
    next.switches = { ...SWITCH_DEFAULTS, body: r.switches.body, motion: r.switches.motion, sound: r.switches.sound, ...p.switches, day: 'off' };
    said = `${p.label}: ${lc(worldOf(p.world)!.line)} On ${g(p.ground).label}, still in ${COLOUR_LABELS[r.colour]}.${r.colour !== p.colour ? ` Say “${COLOUR_LABELS[p.colour].toLowerCase()}” for its own colour.` : ''}`;
  } else if (ask.world) {
    next.world = ask.world;
    said = `${worldOf(ask.world)!.label}: ${lc(worldOf(ask.world)!.line)}`;
  } else if (ask.colour) {
    next.colour = ask.colour;
    said = `${COLOUR_LABELS[ask.colour]}: my colour changes and nothing else.`;
  } else if (ask.body) {
    const b = bodyStep(r.switches.body, ask.body);
    next.switches.body = b;
    said = b === r.switches.body ? (ask.body === 'bigger' ? 'Body text is at 21 points already, my biggest.' : 'Body text is at 17 points already: I never go under it.') : `Body text at ${b} points: ${b === 17 ? 'my floor' : 'readings and tags grow with it'}. It reaches the pages I draw in the new system now; every room follows with the shell.`;
  } else if (ask.switches) {
    Object.assign(next.switches, ask.switches);
    const [k, v] = Object.entries(ask.switches)[0] as [SwitchKey, Switches[SwitchKey]];
    const def = switchOf(k);
    const opt = def.options.find((x) => x.value === v)!;
    said = `${def.label}: ${opt.label.toLowerCase()}. ${opt.line}`;
    if (k === 'day' && v === 'on') {
      const dl = daylight(o.now ?? 0, o.home ?? null);
      said = `Ground follows the day: ${dl.day ? `Paper till ${clockWords(dl.flipAt)}, then ${g(r.night).label}` : `${g(r.night).label} till ${clockWords(dl.flipAt)}, then Paper`}.${o.home ? ' From your home’s sun times, never your live location.' : ' With no home saved I use 08:00 to 18:00.'}`;
    }
  }
  return { recipe: next, said: said.replace(/\s+/g, ' ').trim() };
}
const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
