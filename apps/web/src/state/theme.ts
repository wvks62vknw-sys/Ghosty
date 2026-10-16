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
  // --- the originals ---
  stark: { c: '#62e4ff', a: '#ffb23e', r: '#ff3b3b', label: 'JARVIS' },
  arc: { c: '#d8f6ff', a: '#4fc3ff', r: '#ff5470', label: 'ARC CORE' },
  mark3: { c: '#ff3b30', a: '#ffc233', r: '#ff8a00', label: 'MARK III' },
  nano: { c: '#ffc233', a: '#ff5a36', r: '#ff2b4d', label: 'NANOTECH' },
  warmachine: { c: '#b8c7d1', a: '#ff6a3a', r: '#ff2b4d', label: 'WAR MACHINE' },
  friday: { c: '#52f2b5', a: '#d6ff5c', r: '#ff4d6a', label: 'FRIDAY' },
  ultron: { c: '#a58bff', a: '#ff4fa3', r: '#ff3b3b', label: 'ULTRON' },
  stealth: { c: '#7a8cff', a: '#e8ecff', r: '#ff4060', label: 'STEALTH' },
  // --- suits & armour ---
  hotrod: { c: '#ff2e4d', a: '#ffce3a', r: '#ff6a3a', label: 'HOT ROD' },
  extremis: { c: '#ff6a00', a: '#ffd166', r: '#ff2d55', label: 'EXTREMIS' },
  hulkbuster: { c: '#ff5a2e', a: '#45c6ff', r: '#ffd23a', label: 'HULKBUSTER' },
  bleedingedge: { c: '#2bd0ff', a: '#c9d6e0', r: '#ff3b6b', label: 'BLEEDING EDGE' },
  endgame: { c: '#e03a4a', a: '#8ab4ff', r: '#ffcf3a', label: 'MARK 85' },
  // --- allies & others ---
  bifrost: { c: '#3b82ff', a: '#16e0ff', r: '#ff5ed6', label: 'BIFROST' },
  banner: { c: '#39ff6a', a: '#b26bff', r: '#ff3b3b', label: 'GAMMA' },
  loki: { c: '#1fd67a', a: '#ffcf3a', r: '#ff3b6b', label: 'ASGARD' },
  vibranium: { c: '#9b7bff', a: '#35e0d0', r: '#ff4d6a', label: 'VIBRANIUM' },
  widow: { c: '#ff2b4d', a: '#e8ecff', r: '#ff8a3a', label: 'WIDOW' },
  cap: { c: '#2d6cff', a: '#ff4060', r: '#ffd23a', label: 'SENTINEL' },
  // --- systems & moods ---
  synthwave: { c: '#ff2bd6', a: '#16e0ff', r: '#ffd23a', label: 'SYNTHWAVE' },
  matrix: { c: '#39ff6e', a: '#b6ffcb', r: '#ff5a3a', label: 'TERMINAL' },
  inferno: { c: '#ff5a1f', a: '#ffcf3a', r: '#ff2b4d', label: 'INFERNO' },
  plasma: { c: '#ff3ea5', a: '#b26bff', r: '#ff5a5a', label: 'PLASMA' },
  solaris: { c: '#ffd76a', a: '#ff8a3a', r: '#ff3b3b', label: 'SOLARIS' },
  voidstar: { c: '#6c7bff', a: '#ff4fe0', r: '#ff4060', label: 'VOIDSTAR' },
  kryo: { c: '#8fe8ff', a: '#4f8bff', r: '#ff5470', label: 'KRYO' },
};

/** Old theme names → the theme that replaced them. */
const ALIASES: Record<string, string> = {
  cyan: 'stark', jarvis: 'stark', ocean: 'stark', ice: 'kryo', crimson: 'mark3', iron_man: 'mark3', gold: 'nano', arc_reactor: 'nano', sunrise: 'solaris', emerald: 'friday', forest: 'friday', violet: 'ultron', midnight: 'stealth', hulk: 'banner', neon: 'synthwave', terminal: 'matrix',
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
