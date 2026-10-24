/**
 * Themes: colour variants of the one design (route C). A theme is an accent and a few tokens made from it; it never
 * changes layout, type or spacing. It sets, on <html>:
 *   --c, --cr   the accent (what is live or active: the lit tab, the reactor, Mind's light, a filled pill) and its
 *               "r,g,b" triplet; styles.css reads it as --acc / --accr
 *   --c2        a pale tint of the accent (Mind's crisp rim, its listening ring and the pulses on its links)
 *   --halo1, --halo2, --room   the soft glow behind Home's hero and over the room, at the theme's own strength
 * and gives the 3D engine the same accent. Amber (warnings), red (alerts) and the graphite canvas are the same in
 * every theme (styles.css :root).
 */
import { gfx } from '../engine/gfx';
import { hex2rgb } from '../engine/math';
import { settings } from './app';
import { Emitter } from '../core/store';

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

/** Apply a theme at once (every screen, Mind and the 3D engine) and remember it on this phone. */
export function applyTheme(name: string): void {
  const key = themeKey(name);
  const t = THEMES[key]!;
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
  document.documentElement.dataset.theme = key;
  gfx.theme = { c: hex2rgb(t.c), a: hex2rgb(AMBER), r: hex2rgb(ALERT), bg: hex2rgb(CANVAS) };
  if (settings.get().theme !== key) settings.set({ theme: key });
  themeEvents.emit('change', key);
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
