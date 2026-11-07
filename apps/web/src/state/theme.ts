/**
 * Themes: colour variants of the one design. A theme is the design system's ACCENT BLOCK (apps/web/src/design/tokens.css:
 * `:root[data-theme="<key>"]`, BRIEF-DESIGN-SYSTEM 4): the accent, its pale tint, its text variant and its glow. The twelve
 * are Reactor and Graphite, then BRIEF-THEMES' ten exactly as rendered on 2 Nov. Their colours live in tokens.css alone; this
 * file holds their names and tag lines, and READS the colours from the stylesheet (a hidden probe carrying
 * `data-accent="<key>"`), so the page, the 3-D engine and Mind all take one source. A theme never changes layout, type or
 * spacing. It sets, on <html>:
 *   data-theme  the key: tokens.css swaps the system's accent block (--g-accent, --g-accent-rgb, --g-accent-pale…)
 *   --c, --cr   today's accent aliases (what is live or active in today's look) and its "r,g,b" triplet; styles.css reads
 *               them as --acc / --accr; they keep their meaning until the shell pass moves them onto the system's tokens
 *   --c2        a pale tint of the accent (Mind's crisp rim, its listening ring and the pulses on its links)
 *   --halo1, --halo2, --room   the soft glow behind Home's hero and over the room, at the theme's own strength
 * and gives the 3D engine the same accent. Amber (warnings), red (alerts) and the canvas are the same in every theme.
 *
 * His mood (OWNER-ISSUES 63, packages/shared/src/mood.ts) is a live overlay on the same accent, never the saved theme:
 * cross red, protective amber, pleased gold, focused a steadier deeper blue, subdued the theme's own accent dimmed with the
 * glow low, calm the theme exactly as chosen. It eases over about a second (at once with Reduce Motion), and everything
 * that reads the accent follows: Mind, the HUD, the glow, the 3D engine, the system's marks (their --g-accent block is
 * written on <html> while a mood lasts, and taken off again when he is calm, so the stylesheet's block rules exactly).
 */
import { gfx } from '../engine/gfx';
import { hex2rgb } from '../engine/math';
import { settings } from './app';
import { Emitter } from '../core/store';
import type { MoodKind } from '../../../../packages/shared/src/mood';
import { parseColour, textVariant, toHex, type RGB } from '../design/contrast';

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

/** An accent as the page and the 3D engine draw it: the accent, its pale tint, how strongly it lights the room. */
export interface Light {
  c: string;
  pale: string;
  glow: number;
}

/** Reactor's block, for the one moment before the stylesheet can be read (look.test.mjs holds it equal to tokens.css). */
export const FALLBACK: Light = { c: '#64d2ff', pale: '#bff0ff', glow: 1 };

/** What every theme shares: the warning amber, the alert red and today's canvas (the 3-D engine's). */
const AMBER = '#ffb340';
const ALERT = '#ff6961';
const CANVAS = '#050607';

/** A saved name that is not one of the themes (the classic looks' names, from before there was one look): Reactor. */
export const themeKey = (name: string): string => (THEMES[name] ? name : DEFAULT_THEME);

export const themeEvents = new Emitter<{ change: string }>();

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

/** Apply a theme at once (every screen, Mind and the 3D engine) and remember it on this phone — under his mood, if he has one. */
export function applyTheme(name: string): void {
  const key = themeKey(name);
  cancelAnimationFrame(easing);
  document.documentElement.dataset.theme = key;
  paint(lit(key, moodKind), key);
  if (settings.get().theme !== key) settings.set({ theme: key });
  themeEvents.emit('change', key);
}

/** His mood on the whole interface (state/mood.ts calls it): eased over about a second, at once with Reduce Motion; never saved. */
export function applyMood(kind: MoodKind): void {
  if (kind === moodKind && shown) return;
  moodKind = kind;
  document.documentElement.dataset.mood = kind;
  const key = themeKey(settings.get().theme);
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

/** The system's surfaces, for the text variant of a mood's accent (tokens.css; read once). */
let surfaces: RGB[] | null = null;
function surfacesNow(): RGB[] {
  if (surfaces) return surfaces;
  const cs = getComputedStyle(document.documentElement);
  const got = ['--g-canvas', '--g-plate', '--g-plate-strong'].map((n) => parseColour(cs.getPropertyValue(n)));
  if (got.every(Boolean)) surfaces = got as RGB[];
  return (got.every(Boolean) ? got : [[16, 19, 23], [23, 27, 32], [30, 35, 41]]) as RGB[];
}

const ACCENT_PROPS = ['--g-accent', '--g-accent-rgb', '--g-accent-pale', '--g-accent-pale-rgb', '--g-accent-text', '--g-accent-glow'];

/** The accent tokens on <html> and the 3D engine's colours (`key`: the theme under it). */
function paint(t: Light, key: string): void {
  shown = t;
  const cr = rgbTriplet(t.c);
  const s = document.documentElement.style;
  s.setProperty('--c', t.c);
  s.setProperty('--cr', cr);
  s.setProperty('--c2', t.pale);
  // the glow behind Home's hero (.rcglow) and the room's light (body::after), at the theme's strength
  const a = (v: number) => `rgba(${cr}, ${+(v * t.glow).toFixed(3)})`;
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
    s.setProperty('--g-accent', t.c);
    s.setProperty('--g-accent-rgb', c.join(', '));
    s.setProperty('--g-accent-pale', t.pale);
    s.setProperty('--g-accent-pale-rgb', pale.join(', '));
    s.setProperty('--g-accent-text', toHex(textVariant(c, pale, surfacesNow())));
    s.setProperty('--g-accent-glow', String(+t.glow.toFixed(3)));
  }
  gfx.theme = { c: hex2rgb(t.c), a: hex2rgb(AMBER), r: hex2rgb(ALERT), bg: hex2rgb(CANVAS) };
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
