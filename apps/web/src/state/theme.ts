/** Colour themes. Each sets CSS variables for the interface and colours for the 3D engine. */
import { gfx } from '../engine/gfx';
import { hex2rgb } from '../engine/math';
import { settings } from './app';
import { Emitter } from '../core/store';

/**
 * Each theme is one of Tony Stark's suits or systems, with its own distinct colours
 * (primary, accent, alert). No two are alike: earlier near-copies are mapped to the
 * closest one in ALIASES, so a saved choice still works.
 */
export const THEMES: Record<string, { c: string; a: string; r: string; label: string }> = {
  stark: { c: '#62e4ff', a: '#ffb23e', r: '#ff3b3b', label: 'JARVIS' },
  arc: { c: '#d8f6ff', a: '#4fc3ff', r: '#ff5470', label: 'ARC CORE' },
  mark3: { c: '#ff3b30', a: '#ffc233', r: '#ff8a00', label: 'MARK III' },
  nano: { c: '#ffc233', a: '#ff5a36', r: '#ff2b4d', label: 'NANOTECH' },
  warmachine: { c: '#b8c7d1', a: '#ff6a3a', r: '#ff2b4d', label: 'WAR MACHINE' },
  friday: { c: '#52f2b5', a: '#d6ff5c', r: '#ff4d6a', label: 'FRIDAY' },
  ultron: { c: '#a58bff', a: '#ff4fa3', r: '#ff3b3b', label: 'ULTRON' },
  stealth: { c: '#7a8cff', a: '#e8ecff', r: '#ff4060', label: 'STEALTH' },
};

/** Old theme names → the theme that replaced them. */
const ALIASES: Record<string, string> = {
  cyan: 'stark', jarvis: 'stark', ocean: 'stark', ice: 'arc', crimson: 'mark3', iron_man: 'mark3', gold: 'nano', arc_reactor: 'nano', sunrise: 'nano', emerald: 'friday', forest: 'friday', violet: 'ultron', midnight: 'stealth',
};

export const themeKey = (name: string): string => (THEMES[name] ? name : ALIASES[name] && THEMES[ALIASES[name]!] ? ALIASES[name]! : 'stark');

export const themeEvents = new Emitter<{ change: string }>();

const rgbTriplet = (hex: string) =>
  hex2rgb(hex)
    .map((v) => Math.round(v * 255))
    .join(',');

export function applyTheme(name: string): void {
  const key = themeKey(name);
  const t = THEMES[key]!;
  const s = document.documentElement.style;
  s.setProperty('--c', t.c);
  s.setProperty('--a', t.a);
  s.setProperty('--r', t.r);
  s.setProperty('--cr', rgbTriplet(t.c));
  s.setProperty('--ar', rgbTriplet(t.a));
  gfx.theme = { c: hex2rgb(t.c), a: hex2rgb(t.a), r: hex2rgb(t.r) };
  if (settings.get().theme !== key) settings.set({ theme: key });
  themeEvents.emit('change', key);
}
