/**
 * Themes: a theme is a RECIPE (BRIEF-THEMES-2; his words, OWNER-ISSUES 141; the pure model in packages/shared/src/themes.ts):
 * the GROUND (what everything sits on), the COLOUR (the design system's ACCENT BLOCK, tokens.css `:root[data-theme="<key>"]`),
 * the WORLD (the drawing tokens of a direction seen along the way) and the SWITCHES. The twelve colours are Reactor and
 * Graphite, then BRIEF-THEMES' ten exactly as rendered on 2 Nov; their colours live in tokens.css alone, and this file holds
 * their names and tag lines and READS the colours from the stylesheet (a hidden probe carrying `data-accent="<key>"`), so the
 * page, the 3-D engine and Mind all take one source. Applying a recipe sets, on <html>:
 *   data-theme  the colour: tokens.css swaps the system's accent block (--g-accent, --g-accent-rgb, --g-accent-pale…)
 *   data-ground the ground in force (following the day: Paper by day, the night ground after; never live GPS)
 *   data-night  the dark ground today's rooms stand on (the ground, or the chosen night ground under Paper)
 *   data-world  the world; data-glow, data-floor, data-corners, data-readings, data-body, data-motion, data-sound, data-day the switches
 *   --c, --cr   today's accent aliases (what is live or active in today's look) and its "r,g,b" triplet; styles.css reads
 *               them as --acc / --accr; they keep their meaning until the shell pass moves them onto the system's tokens
 *   --c2        a pale tint of the accent (Mind's crisp rim, its listening ring and the pulses on its links)
 *   --halo1, --halo2, --room   the soft glow behind Home's hero and over the room, at the theme's own strength times the
 *               world's glow (the GLOW switch, the ground's glow floor)
 * and gives the 3D engine the same accent and the floor's colour. A recipe is kept on this phone: `settings.theme` (the colour,
 * as ever: a bare colour key from before reads as Graphite + it + The Scan) and `settings.look` (the rest).
 *
 * His mood (OWNER-ISSUES 63, packages/shared/src/mood.ts) is a live overlay on the same accent, never the saved theme:
 * cross red, protective amber, pleased gold, focused a steadier deeper blue, subdued the theme's own accent dimmed with the
 * glow low, calm the theme exactly as chosen. It eases over about a second (at once with Reduce Motion), and everything
 * that reads the accent follows: Mind, the HUD, the glow, the 3D engine, the system's marks (their --g-accent block is
 * written on <html> while a mood lasts, worked out for the ground in force — its ink on Paper — and taken off again when he is
 * calm, so the stylesheet's block rules exactly).
 */
import { gfx } from '../engine/gfx';
import { hex2rgb } from '../engine/math';
import { settings } from './app';
import { Emitter } from '../core/store';
import type { MoodKind } from '../../../../packages/shared/src/mood';
import { inkVariant, parseColour, textVariant, toHex, type RGB } from '../design/contrast';
import { daylight, groundAt, groundOf, isColour, keptLook, presetOf, presetRecipe, presets, recipeFrom, recipeWords, sameRecipe, type ColourKey, type GroundKey, type HomePlace, type Preset, type Recipe } from '../../../../packages/shared/src/themes';

export interface Theme {
  label: string;
  /** One line shown under its swatch in Settings → Theme. */
  tag: string;
}

/** The twelve, Reactor first (the default), then Graphite, then BRIEF-THEMES' ten in its order. Colours: tokens.css. */
export const THEMES: Record<string, Theme> = {
  reactor: { label: 'Reactor', tag: 'Reactor cyan, bright and alive' },
  graphite: { label: 'Graphite', tag: 'Cool steel, a quieter light' },
  ember: { label: 'Ember', tag: 'Forge orange, warm and bright' },
  gold: { label: 'Gold', tag: 'The armour’s gold, amber light' },
  crimson: { label: 'Crimson', tag: 'Deep red, the suit at night' },
  violet: { label: 'Violet', tag: 'Electric purple' },
  emerald: { label: 'Emerald', tag: 'Green glass, calm and alive' },
  ice: { label: 'Ice', tag: 'Pale blue-white, a low cold glow' },
  rose: { label: 'Rose', tag: 'Coral pink, soft' },
  lime: { label: 'Lime', tag: 'Acid green, the loud one' },
  sunset: { label: 'Sunset', tag: 'Orange into pink' },
  mono: { label: 'Mono', tag: 'White light, glow off, the quietest' },
};
export const DEFAULT_THEME = 'reactor';

/** Every preset, in the order Settings shows them: the twelve (their own tag lines), then the five directions. */
export const PRESETS: Preset[] = presets(Object.fromEntries(Object.entries(THEMES).map(([k, t]) => [k, t.tag])));

/** An accent as the page and the 3D engine draw it: the accent, its pale tint, how strongly it lights the room. */
export interface Light {
  c: string;
  pale: string;
  glow: number;
}

/** Reactor's block, for the one moment before the stylesheet can be read (look.test.mjs holds it equal to tokens.css). */
export const FALLBACK: Light = { c: '#64d2ff', pale: '#bff0ff', glow: 1 };

/** What every theme shares: the warning amber, the alert red and today's canvas (the subdued mood dims towards it). */
const AMBER = '#ffb340';
const ALERT = '#ff6961';
const CANVAS = '#050607';

/** A saved name that is not one of the themes (the classic looks' names, from before there was one look): Reactor. */
export const themeKey = (name: string): string => (THEMES[name] ? name : DEFAULT_THEME);

export const themeEvents = new Emitter<{ change: string }>();
/** The whole recipe changed (a ground, a world, a switch, a preset, the day turning): the dials and THE LOOK repaint. */
export const recipeEvents = new Emitter<{ change: Recipe }>();

const rgbTriplet = (hex: string) =>
  hex2rgb(hex)
    .map((v) => Math.round(v * 255))
    .join(',');

/** A hidden element that carries one theme's block (`data-accent`), to read its colours from the stylesheet. */
let probe: HTMLElement | null = null;
/** A theme's colours, as tokens.css defines them (Reactor's if the stylesheet cannot be read yet). */
export function themeLight(key: string): Light {
  try {
    if (!probe) {
      probe = document.createElement('i');
      probe.hidden = true;
      probe.setAttribute('aria-hidden', 'true');
      probe.className = 'themeprobe';
    }
    if (!probe.isConnected) (document.body ?? document.documentElement).append(probe);
    probe.dataset.accent = themeKey(key);
    // (on a dark ground of its own, so it reads the accent itself whatever ground the page is on)
    probe.dataset.ground = 'graphite';
    const cs = getComputedStyle(probe);
    const c = cs.getPropertyValue('--g-accent').trim();
    const pale = cs.getPropertyValue('--g-accent-pale').trim();
    const glow = parseFloat(cs.getPropertyValue('--g-accent-glow'));
    if (/^#[0-9a-f]{6}$/i.test(c) && /^#[0-9a-f]{6}$/i.test(pale) && Number.isFinite(glow)) return { c: c.toLowerCase(), pale: pale.toLowerCase(), glow };
  } catch {
    /* no document (a test bundle): Reactor's */
  }
  return FALLBACK;
}

/** His mood's light (a design pick the owner may change): the overlay each mood lays on the accent. */
export const MOOD_LIGHT: Partial<Record<MoodKind, Light>> = {
  cross: { c: '#ff453a', pale: '#ffc9c5', glow: 1 },
  protective: { c: '#ffb340', pale: '#ffe3b8', glow: 0.9 },
  pleased: { c: '#ffd60a', pale: '#fff3b0', glow: 1 },
  focused: { c: '#2f7cf6', pale: '#b9d3ff', glow: 0.6 },
};

/** `a` moved `t` of the way to `b`, as "#rrggbb". */
const mixHex = (a: string, b: string, t: number) =>
  `#${hex2rgb(a)
    .map((v, i) => Math.round((v + (hex2rgb(b)[i]! - v) * t) * 255).toString(16).padStart(2, '0'))
    .join('')}`;

/** The light a theme shows under a mood: the mood's own, the theme dimmed (subdued), or the theme exactly (calm). */
function lit(key: string, kind: MoodKind): Light {
  const t = themeLight(key);
  if (kind === 'subdued') return { c: mixHex(t.c, CANVAS, 0.45), pale: mixHex(t.pale, CANVAS, 0.35), glow: t.glow * 0.3 };
  return MOOD_LIGHT[kind] ?? t;
}

/** What the page shows now, and his mood under it. */
let shown: Light | null = null;
let moodKind: MoodKind = 'calm';
let easing = 0;

// ---------------------------------------------------------------- the recipe

let current: Recipe = recipeFrom(DEFAULT_THEME);
/** His recipe as it is now. */
export const recipe = (): Recipe => current;

/** His home as he saved it in Settings (never the phone's live position): what ground-follows-the-day reads, with the clock. */
export function savedHome(): HomePlace | null {
  const h = settings.get().home;
  return h && Number.isFinite(h.lat) && Number.isFinite(h.lon) ? { lat: h.lat, lon: h.lon } : null;
}

/** The ground in force now: the chosen one, or (following the day) Paper by day and the night ground after. */
export function groundNow(r: Recipe = current, now = Date.now()): GroundKey {
  return groundAt(r, now, savedHome());
}

/** The recipe in words, for the Theme row ("Ember · Black · The Scan"; following the day, "Paper till 16:32"). */
export const recipeNow = (r: Recipe = current): string => recipeWords(r, { now: Date.now(), home: savedHome() });

/** The preset the recipe is exactly, or null ("Custom"). */
export const presetNow = (r: Recipe = current): Preset | null => presetOf(r, PRESETS);

/** For the checks and the console (window.__ghosty.theme): the recipe, the ground in force, the preset, the day's next flip. */
export const themeState = {
  recipe: () => JSON.parse(JSON.stringify(current)) as Recipe,
  ground: () => groundNow(),
  preset: () => presetNow()?.key ?? 'custom',
  words: () => recipeNow(),
  day: () => (current.switches.day === 'on' ? daylight(Date.now(), savedHome()) : null),
  applied: 0,
};

/** The world's glow on today's rooms (the world's glow × the GLOW switch × the night ground's floor), read from the tokens. */
let roomGlow = 1;
/** The floor today's rooms stand on (the night ground's canvas): the 3-D scene behind them clears to it. */
let roomBg = CANVAS;
function readGlow(): void {
  try {
    const cs = getComputedStyle(document.documentElement);
    const g = parseFloat(cs.getPropertyValue('--g-glow'));
    const floor = parseFloat(cs.getPropertyValue('--g-room-glow'));
    roomGlow = (Number.isFinite(g) ? g : 1) * (Number.isFinite(floor) ? floor : 1);
    const room = parseColour(cs.getPropertyValue('--g-room-canvas'));
    roomBg = room ? toHex(room) : CANVAS;
  } catch {
    roomGlow = 1;
  }
}
/** How much my orb's halo glows in this recipe (Mind reads it: the world governs its glow, never its draw). */
export const glowNow = (): number => roomGlow;

/** A probe standing on the night ground in the theme's colour: what the orb's tokens are under Paper. */
let orbProbe: HTMLElement | null = null;
/**
 * The orb's light, from the tokens (BRIEF-ORB-AND-BOOT, "lit in his colour from the tokens"): --g-accent-rgb, --g-accent-pale-rgb and
 * the colour's own glow --g-accent-glow (Mono's .25) as they stand on <html>, his mood's written over them while one lasts.
 * Under Paper the orb lives on a room still drawn on the night ground (Home, the boot), so its tokens are read from the theme's
 * block standing on that ground (a probe), not the ink <html> carries; a mood under Paper keeps the mood's own light.
 */
export function orbTokens(): Light {
  try {
    const el = document.documentElement;
    const light = !!groundOf(el.dataset.ground ?? '')?.light;
    if (light && shown && moodKind !== 'calm') return shown;
    let cs: CSSStyleDeclaration;
    if (light) {
      if (!orbProbe) {
        orbProbe = document.createElement('i');
        orbProbe.hidden = true;
        orbProbe.setAttribute('aria-hidden', 'true');
        orbProbe.className = 'themeprobe';
      }
      if (!orbProbe.isConnected) (document.body ?? el).append(orbProbe);
      orbProbe.dataset.accent = themeKey(current.colour);
      orbProbe.dataset.ground = el.dataset.night || 'graphite';
      cs = getComputedStyle(orbProbe);
    } else cs = getComputedStyle(el);
    const c = parseColour(cs.getPropertyValue('--g-accent-rgb'));
    const pale = parseColour(cs.getPropertyValue('--g-accent-pale-rgb'));
    const glow = parseFloat(cs.getPropertyValue('--g-accent-glow'));
    if (c && pale) return { c: toHex(c), pale: toHex(pale), glow: Number.isFinite(glow) ? glow : 1 };
  } catch {
    /* no document (a test bundle): what is shown, or Reactor's */
  }
  return shown ?? FALLBACK;
}

let dayTimer = 0;
/** Following the day: the ground changes by itself at sunrise and at sunset (a second after, so the clock is past it). */
function scheduleDay(): void {
  clearTimeout(dayTimer);
  if (current.switches.day !== 'on') return;
  const dl = daylight(Date.now(), savedHome());
  dayTimer = window.setTimeout(() => applyRecipe(current, { save: false }), Math.min(Math.max(1000, dl.flipAt - Date.now() + 1000), 2_147_000_000));
}

/**
 * Apply a recipe at once (every screen, Mind and the 3D engine) and keep it on this phone — under his mood, if he has one.
 * `save: false`: the day turning, or a reload reading what is kept, changes nothing that is kept.
 */
export function applyRecipe(r: Recipe, o: { save?: boolean } = {}): void {
  current = { ...r, switches: { ...r.switches } };
  const el = document.documentElement;
  const ground = groundNow(current);
  const d = el.dataset;
  d.theme = current.colour;
  d.ground = ground;
  d.night = ground === 'paper' ? current.night : ground;
  d.world = current.world;
  const s = current.switches;
  d.glow = s.glow;
  d.floor = s.floor;
  d.corners = s.corners;
  d.readings = s.readings;
  d.body = String(s.body);
  d.motion = s.motion;
  d.sound = s.sound;
  d.day = s.day;
  // the ground may have changed: the surfaces a mood's text variant is worked out on are read again
  surfaces = null;
  readGlow();
  cancelAnimationFrame(easing);
  paint(lit(current.colour, moodKind), current.colour);
  if (o.save !== false) {
    const now = settings.get();
    const kept = keptLook(current);
    if (now.theme !== current.colour || JSON.stringify(now.look) !== JSON.stringify(kept)) settings.set({ theme: current.colour, look: kept });
  }
  scheduleDay();
  themeState.applied++;
  themeEvents.emit('change', current.colour);
  recipeEvents.emit('change', current);
}

/** Apply a colour at once and keep the rest of the recipe (the twelve, by words, a mood's end: what a theme always did). */
export function applyTheme(name: string): void {
  const key = themeKey(name);
  applyRecipe({ ...current, colour: (isColour(key) ? key : DEFAULT_THEME) as ColourKey });
}

/** Apply a preset whole (its ground, colour, world and switches). */
export function applyPreset(p: Preset): void {
  applyRecipe(presetRecipe(p));
}

/** The recipe the phone keeps (its colour from `settleTheme`), for the start. */
export const keptRecipe = (colour: string): Recipe => recipeFrom(colour, settings.get().look);

/** Whether `r` is what is applied now. */
export const isCurrent = (r: Recipe): boolean => sameRecipe(r, current) && r.night === current.night;

// the day's turn while the phone was asleep or away: looked at again when it comes back, and when his home changes
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && current.switches.day === 'on' && groundNow() !== document.documentElement.dataset.ground) applyRecipe(current, { save: false });
  });
  settings.subscribe((st, prev) => {
    if (st.home !== prev.home && current.switches.day === 'on') applyRecipe(current, { save: false });
  });
}

/** His mood on the whole interface (state/mood.ts calls it): eased over about a second, at once with Reduce Motion; never saved. */
export function applyMood(kind: MoodKind): void {
  if (kind === moodKind && shown) return;
  moodKind = kind;
  document.documentElement.dataset.mood = kind;
  const key = current.colour;
  const to = lit(key, kind);
  const from = shown;
  cancelAnimationFrame(easing);
  if (!from || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    paint(to, key);
    themeEvents.emit('change', key);
    return;
  }
  const t0 = performance.now();
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / 1000);
    const e = k * k * (3 - 2 * k);
    // the last frame is the target exactly: calm is the theme to the letter
    paint(k >= 1 ? to : { c: mixHex(from.c, to.c, e), pale: mixHex(from.pale, to.pale, e), glow: from.glow + (to.glow - from.glow) * e }, key);
    themeEvents.emit('change', key);
    if (k < 1) easing = requestAnimationFrame(step);
  };
  easing = requestAnimationFrame(step);
}

/** A ground's surfaces and its first ink, read from the stylesheet through a probe standing on it (read again when it changes). */
const groundProbe: Record<string, { surfaces: RGB[]; ink: RGB } | undefined> = {};
function groundColours(ground: string): { surfaces: RGB[]; ink: RGB } {
  const kept = groundProbe[ground];
  if (kept) return kept;
  const fallback = { surfaces: [[16, 19, 23], [23, 27, 32], [30, 35, 41]] as RGB[], ink: [236, 232, 223] as RGB };
  try {
    const p = document.createElement('i');
    p.hidden = true;
    p.dataset.ground = ground;
    (document.body ?? document.documentElement).append(p);
    const cs = getComputedStyle(p);
    const got = ['--g-canvas', '--g-plate', '--g-plate-strong'].map((n) => parseColour(cs.getPropertyValue(n)));
    const ink = parseColour(cs.getPropertyValue('--g-ink-1'));
    p.remove();
    if (!got.every(Boolean) || !ink) return fallback;
    return (groundProbe[ground] = { surfaces: got as RGB[], ink });
  } catch {
    return fallback;
  }
}
/** The surfaces of the ground in force, for the text variant of a mood's accent (read again when the ground changes). */
let surfaces: RGB[] | null = null;
function surfacesNow(): RGB[] {
  if (surfaces) return surfaces;
  return (surfaces = groundColours(document.documentElement.dataset.ground || 'graphite').surfaces);
}

const ACCENT_PROPS = ['--g-accent', '--g-accent-rgb', '--g-accent-pale', '--g-accent-pale-rgb', '--g-accent-text', '--g-accent-glow', '--g-accent-ink', '--g-accent-ink-rgb'];

/** The accent tokens on <html> and the 3D engine's colours (`key`: the theme under it). */
function paint(t: Light, key: string): void {
  shown = t;
  const cr = rgbTriplet(t.c);
  const s = document.documentElement.style;
  s.setProperty('--c', t.c);
  s.setProperty('--cr', cr);
  s.setProperty('--c2', t.pale);
  // the glow behind Home's hero (.rcglow) and the room's light (body::after), at the theme's strength times the world's glow
  const a = (v: number) => `rgba(${cr}, ${+(v * t.glow * roomGlow).toFixed(3)})`;
  s.setProperty('--halo1', a(0.17));
  s.setProperty('--halo2', a(0.06));
  s.setProperty('--room', a(0.09));
  s.setProperty('--room2', a(0.16));
  // the system's accent block: the stylesheet's own while he is calm, his mood's written over it while one lasts
  const own = themeLight(key);
  if (t.c === own.c && t.pale === own.pale && t.glow === own.glow) for (const p of ACCENT_PROPS) s.removeProperty(p);
  else {
    const c = parseColour(t.c) ?? [100, 210, 255];
    const pale = parseColour(t.pale) ?? c;
    const paper = groundColours('paper');
    const ink = inkVariant(c, paper.ink, paper.surfaces);
    const light = !!groundOf(document.documentElement.dataset.ground ?? '')?.light;
    // on a light ground the mood's accent is drawn in its ink, as a theme's is (tokens.css, the Paper block)
    const shownC = light ? ink : c;
    s.setProperty('--g-accent', toHex(shownC));
    s.setProperty('--g-accent-rgb', shownC.join(', '));
    s.setProperty('--g-accent-pale', light ? toHex(ink) : t.pale);
    s.setProperty('--g-accent-pale-rgb', (light ? ink : pale).join(', '));
    s.setProperty('--g-accent-text', toHex(light ? ink : textVariant(c, pale, surfacesNow())));
    s.setProperty('--g-accent-glow', String(+t.glow.toFixed(3)));
    s.setProperty('--g-accent-ink', toHex(ink));
    s.setProperty('--g-accent-ink-rgb', ink.join(', '));
  }
  // the 3-D scene behind today's rooms clears to their floor (the night ground's canvas)
  gfx.theme = { c: hex2rgb(t.c), a: hex2rgb(AMBER), r: hex2rgb(ALERT), bg: hex2rgb(roomBg) };
}

/**
 * Once per phone, at the first start of the one look (24 Oct): Graphite used to be the cyan look every phone was
 * moved to, and that cyan is now Reactor. A phone that was on it stays on the colour it had; a phone on a classic
 * look's name goes to Reactor too (themeKey). Kept on this device (`ghosty.themes1`).
 */
export function settleTheme(): string {
  try {
    if (localStorage.getItem('ghosty.themes1')) return themeKey(settings.get().theme);
    localStorage.setItem('ghosty.themes1', '1');
  } catch {
    return themeKey(settings.get().theme);
  }
  const was = settings.get().theme;
  return was === 'graphite' || !THEMES[was] ? DEFAULT_THEME : was;
}
