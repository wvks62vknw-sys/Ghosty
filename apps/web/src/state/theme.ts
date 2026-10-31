/**
 * Themes: colour variants of the one design (route C). A theme is an accent and a few tokens made from it; it never
 * changes layout, type or spacing. It sets, on <html>:
 *   --c, --cr   the accent (what is live or active: the lit tab, the reactor, Mind's light, a filled pill) and its
 *               "r,g,b" triplet; styles.css reads it as --acc / --accr
 *   --c2        a pale tint of the accent (Mind's crisp rim, its listening ring and the pulses on its links)
 *   --halo1, --halo2, --room   the soft glow behind Home's hero and over the room, at the theme's own strength
 * and gives the 3D engine the same accent. Amber (warnings), red (alerts) and the graphite canvas are the same in
 * every theme (styles.css :root).
 *
 * His mood (OWNER-ISSUES 63, packages/shared/src/mood.ts) is a live overlay on the same accent, never the saved theme:
 * cross red, protective amber, pleased gold, focused a steadier deeper blue, subdued the theme's own accent dimmed with the
 * glow low, calm the theme exactly as chosen. It eases over about a second (at once with Reduce Motion), and everything
 * that reads the accent follows: Mind, the HUD, the glow, the 3D engine, the whole interface.
 */
import { gfx } from '../engine/gfx';
import { hex2rgb } from '../engine/math';
import { settings } from './app';
import { Emitter } from '../core/store';
import type { MoodKind } from '../../../../packages/shared/src/mood';

export interface Theme {
  label: string;
  /** One line shown under its swatch in Settings → Theme. */
  tag: string;
  /** The accent. */
  c: string;
  /** A pale tint of the accent. */
  pale: string;
  /** How strongly the accent lights the room and the glow behind the hero (Reactor 1). */
  glow: number;
}

/** The two the owner knows, Reactor first (the default). */
export const THEMES: Record<string, Theme> = {
  reactor: { label: 'Reactor', tag: 'Reactor cyan, bright and alive', c: '#64d2ff', pale: '#bff0ff', glow: 1 },
  graphite: { label: 'Graphite', tag: 'Cool steel, a quieter light', c: '#9db7cc', pale: '#dbe6ef', glow: 0.55 },
};
export const DEFAULT_THEME = 'reactor';

/** What every theme shares: the warning amber, the alert red and the canvas. */
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

/** An accent as the page and the 3D engine draw it. */
type Light = Pick<Theme, 'c' | 'pale' | 'glow'>;

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
  const t = THEMES[key]!;
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
  paint(lit(key, moodKind));
  document.documentElement.dataset.theme = key;
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
    paint(to);
    themeEvents.emit('change', key);
    return;
  }
  const t0 = performance.now();
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / 1000);
    const e = k * k * (3 - 2 * k);
    // the last frame is the target exactly: calm is the theme to the letter
    paint(k >= 1 ? to : { c: mixHex(from.c, to.c, e), pale: mixHex(from.pale, to.pale, e), glow: from.glow + (to.glow - from.glow) * e });
    themeEvents.emit('change', key);
    if (k < 1) easing = requestAnimationFrame(step);
  };
  easing = requestAnimationFrame(step);
}

/** The accent tokens on <html> and the 3D engine's colours. */
function paint(t: Light): void {
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
