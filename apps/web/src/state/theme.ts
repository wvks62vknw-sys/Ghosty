/** Colour themes. Each sets CSS variables for the interface and colours for the 3D engine. */
import { gfx } from '../engine/gfx';
import { hex2rgb } from '../engine/math';
import { settings } from './app';
import { Emitter } from '../core/store';

export const THEMES: Record<string, { c: string; a: string; r: string; label: string }> = {
  stark: { c: '#62e4ff', a: '#ffb23e', r: '#ff3b3b', label: 'STARK' },
  cyan: { c: '#5ce1ff', a: '#ffb000', r: '#ff4d6a', label: 'ARC CYAN' },
  crimson: { c: '#ff4d6a', a: '#ffc857', r: '#ff2b4d', label: 'WAR MACHINE' },
  gold: { c: '#ffc233', a: '#ff6a3a', r: '#ff4d6a', label: 'MARK III' },
  emerald: { c: '#52f2b5', a: '#d6ff5c', r: '#ff4d6a', label: 'FRIDAY' },
  violet: { c: '#a58bff', a: '#5ce1ff', r: '#ff5c9d', label: 'ULTRON' },
  ice: { c: '#d6f3ff', a: '#7fd6ff', r: '#ff6b7f', label: 'FROST' },
  sunrise: { c: '#ff9a56', a: '#ffd27f', r: '#ff4d4d', label: 'SUNRISE' },
  midnight: { c: '#7f9dff', a: '#9b59b6', r: '#e74c3c', label: 'MIDNIGHT' },
  forest: { c: '#2ecc71', a: '#f1c40f', r: '#e67e22', label: 'FOREST' },
  ocean: { c: '#3498db', a: '#1abc9c', r: '#e74c3c', label: 'OCEAN' },
  arc_reactor: { c: '#ff6a00', a: '#ffdd00', r: '#ff0000', label: 'ARC REACTOR' },
  iron_man: { c: '#ff6600', a: '#ffbb00', r: '#ff3300', label: 'IRON MAN' },
  jarvis: { c: '#00bfff', a: '#66ffff', r: '#ff6600', label: 'JARVIS' },
};

export const themeEvents = new Emitter<{ change: string }>();

const rgbTriplet = (hex: string) =>
  hex2rgb(hex)
    .map((v) => Math.round(v * 255))
    .join(',');

export function applyTheme(name: string): void {
  const key = THEMES[name] ? name : 'stark';
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
