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
export type Finish = 'glass' | 'carbon' | 'plate' | 'neon' | 'crt' | 'nano' | 'graphite' | 'reactor';

export interface Theme {
  c: string;
  a: string;
  r: string;
  label: string;
  /** One line shown in the picker. */
  tag: string;
  /** Deep background colour behind everything (the 3D space, the page). */
  bg: string;
  /** Surface finish of the glass panes: what the interface is "made of". */
  finish: Finish;
  /**
   * The whole interface's design language. 'hud' (default): the Stark HUD — display font, wide caps,
   * outlined panes. 'pro': calm Apple-style glass — system font, sentence case, rounded translucent
   * cards, pill buttons, a quieter room and a refined reactor (styles.css `html[data-look="pro"]`).
   */
  look?: 'hud' | 'pro';
}

export const THEMES: Record<string, Theme> = {
  // --- the calm looks: Apple-style glass around the arc reactor ---
  graphite: { c: '#64d2ff', a: '#ffb340', r: '#ff6961', label: 'Graphite', tag: 'space grey, a cyan reactor', bg: '#060708', finish: 'graphite', look: 'pro' },
  reactor: { c: '#ffc56e', a: '#ff9f0a', r: '#ff6b5e', label: 'Reactor', tag: 'warm glass, a gold reactor', bg: '#0a0806', finish: 'reactor', look: 'pro' },
  // --- the originals ---
  stark: { c: '#62e4ff', a: '#ffb23e', r: '#ff3b3b', label: 'JARVIS', tag: 'arc-reactor cyan · gold data', bg: '#02050a', finish: 'glass' },
  arc: { c: '#d8f6ff', a: '#4fc3ff', r: '#ff5470', label: 'Arc Core', tag: 'white-hot palladium light', bg: '#030810', finish: 'neon' },
  mark3: { c: '#ff3b30', a: '#ffc233', r: '#ff8a00', label: 'Mark III', tag: 'hot-rod red & gold plating', bg: '#0a0303', finish: 'plate' },
  nano: { c: '#ffc233', a: '#ff5a36', r: '#ff2b4d', label: 'Nanotech', tag: 'gold particles, forming', bg: '#0a0602', finish: 'nano' },
  warmachine: { c: '#b8c7d1', a: '#ff6a3a', r: '#ff2b4d', label: 'War Machine', tag: 'gunmetal · targeting orange', bg: '#050607', finish: 'carbon' },
  friday: { c: '#52f2b5', a: '#d6ff5c', r: '#ff4d6a', label: 'Friday', tag: 'mint & lime, quick and bright', bg: '#02080a', finish: 'glass' },
  ultron: { c: '#a58bff', a: '#ff4fa3', r: '#ff3b3b', label: 'Ultron', tag: 'violet circuitry, no strings', bg: '#06030c', finish: 'crt' },
  stealth: { c: '#7a8cff', a: '#e8ecff', r: '#ff4060', label: 'Stealth', tag: 'night ops, low glow', bg: '#020308', finish: 'carbon' },
  // --- suits & armour ---
  hotrod: { c: '#ff2e4d', a: '#ffce3a', r: '#ff6a3a', label: 'Hot Rod', tag: 'candy-apple red, chrome trim', bg: '#0a0204', finish: 'plate' },
  extremis: { c: '#ff6a00', a: '#ffd166', r: '#ff2d55', label: 'Extremis', tag: 'burning orange under the skin', bg: '#0a0401', finish: 'neon' },
  hulkbuster: { c: '#ff5a2e', a: '#45c6ff', r: '#ffd23a', label: 'Hulkbuster', tag: 'heavy plate, blue readouts', bg: '#080404', finish: 'plate' },
  bleedingedge: { c: '#2bd0ff', a: '#c9d6e0', r: '#ff3b6b', label: 'Bleeding Edge', tag: 'nano-silver, ice blue', bg: '#02060c', finish: 'nano' },
  endgame: { c: '#e03a4a', a: '#8ab4ff', r: '#ffcf3a', label: 'Mark 85', tag: 'crimson & gauntlet blue', bg: '#080306', finish: 'nano' },
  // --- allies & others ---
  bifrost: { c: '#3b82ff', a: '#16e0ff', r: '#ff5ed6', label: 'Bifrost', tag: 'rainbow bridge, deep blue', bg: '#02040e', finish: 'neon' },
  banner: { c: '#39ff6a', a: '#b26bff', r: '#ff3b3b', label: 'Gamma', tag: 'radioactive green & purple', bg: '#020904', finish: 'crt' },
  loki: { c: '#1fd67a', a: '#ffcf3a', r: '#ff3b6b', label: 'Asgard', tag: 'emerald and gold horns', bg: '#030805', finish: 'plate' },
  vibranium: { c: '#9b7bff', a: '#35e0d0', r: '#ff4d6a', label: 'Vibranium', tag: 'wakandan purple, kinetic', bg: '#05030c', finish: 'nano' },
  widow: { c: '#ff2b4d', a: '#e8ecff', r: '#ff8a3a', label: 'Widow', tag: 'red hourglass on black', bg: '#070203', finish: 'carbon' },
  cap: { c: '#2d6cff', a: '#ff4060', r: '#ffd23a', label: 'Sentinel', tag: 'shield blue, red & star', bg: '#02040c', finish: 'plate' },
  // --- systems & moods ---
  synthwave: { c: '#ff2bd6', a: '#16e0ff', r: '#ffd23a', label: 'Synthwave', tag: 'magenta sunset, 1986', bg: '#0a0212', finish: 'neon' },
  matrix: { c: '#39ff6e', a: '#b6ffcb', r: '#ff5a3a', label: 'Terminal', tag: 'green phosphor, scanlines', bg: '#010703', finish: 'crt' },
  inferno: { c: '#ff5a1f', a: '#ffcf3a', r: '#ff2b4d', label: 'Inferno', tag: 'ember orange, molten gold', bg: '#0b0301', finish: 'plate' },
  plasma: { c: '#ff3ea5', a: '#b26bff', r: '#ff5a5a', label: 'Plasma', tag: 'pink plasma, violet arcs', bg: '#0a020a', finish: 'neon' },
  solaris: { c: '#ffd76a', a: '#ff8a3a', r: '#ff3b3b', label: 'Solaris', tag: 'sunlight through amber', bg: '#0a0702', finish: 'glass' },
  voidstar: { c: '#6c7bff', a: '#ff4fe0', r: '#ff4060', label: 'Voidstar', tag: 'deep space indigo', bg: '#030210', finish: 'glass' },
  kryo: { c: '#8fe8ff', a: '#4f8bff', r: '#ff5470', label: 'Kryo', tag: 'frost white, liquid nitrogen', bg: '#030810', finish: 'nano' },
};

/** Old theme names → the theme that replaced them. */
const ALIASES: Record<string, string> = {
  cyan: 'stark', jarvis: 'stark', ocean: 'stark', ice: 'kryo', crimson: 'mark3', iron_man: 'mark3', gold: 'nano', arc_reactor: 'nano', sunrise: 'solaris', emerald: 'friday', forest: 'friday', violet: 'ultron', midnight: 'stealth', hulk: 'banner', neon: 'synthwave', terminal: 'matrix',
};

export const themeKey = (name: string): string => (THEMES[name] ? name : ALIASES[name] && THEMES[ALIASES[name]!] ? ALIASES[name]! : 'stark');

/** True while a calm 'pro' look (Graphite, Reactor) is on: the reactor, its HUD and the room draw quieter. */
export const proLook = (): boolean => document.documentElement.dataset.look === 'pro';

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
  s.setProperty('--bg', t.bg);
  s.setProperty('--bgr', rgbTriplet(t.bg));
  document.documentElement.dataset.finish = t.finish;
  document.documentElement.dataset.look = t.look ?? 'hud';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.look === 'pro' ? t.bg : '#04070c');
  gfx.theme = { c: hex2rgb(t.c), a: hex2rgb(t.a), r: hex2rgb(t.r), bg: hex2rgb(t.bg) };
  if (settings.get().theme !== key) settings.set({ theme: key });
  themeEvents.emit('change', key);
}
