/**
 * THE DECK'S THEMES (BRIEF-EDITOR-PRESENTATIONS): the design system's own palette first (the graphite ground, bone ink, Reactor's
 * accent), then Paper (the light ground, for a printed or a bright-room deck), then the app's other accents on the same graphite
 * ground (state/theme.ts THEMES, their colours read from design/tokens.css: nothing new). Each is a named set: the ground, a plate
 * one step up, the ink and its softer second, the accent and a sequence of five for shapes and charts (the accent, the warning amber,
 * the go-ahead green, the alert red and the accent's pale tint; Paper's own inks). A deck opened from a .pptx keeps the file's own
 * colours as its palette until he picks one of these.
 */
export interface Palette {
  name: string;
  ground: string;
  plate: string;
  ink: string;
  ink2: string;
  accent: string;
  seq: string[];
  dark: boolean;
}

const GROUND = { ground: '#101317', plate: '#171b20', ink: '#ece8df', ink2: '#c8c5bd', dark: true };
const dark = (name: string, accent: string, pale: string): Palette => ({ name, ...GROUND, accent, seq: [accent, '#ffb340', '#30d158', '#ff6961', pale] });

export const THEME_KEYS = ['ghosty', 'paper', 'graphite', 'ember', 'gold', 'crimson', 'violet', 'emerald', 'ice', 'rose', 'lime', 'sunset', 'mono'] as const;
export const THEMES: Record<string, Palette> = {
  ghosty: dark('Ghosty', '#64d2ff', '#bff0ff'),
  paper: { name: 'Paper', ground: '#f3efe6', plate: '#e9e4d9', ink: '#1a1a18', ink2: '#383733', accent: '#355c6b', seq: ['#355c6b', '#8a4f00', '#196530', '#b02a20', '#4e4c46'], dark: false },
  graphite: dark('Graphite', '#9db7cc', '#dbe6ef'),
  ember: dark('Ember', '#ff7a3d', '#ffd2bd'),
  gold: dark('Gold', '#ffc53d', '#ffeab8'),
  crimson: dark('Crimson', '#ff3b4a', '#ffc2c6'),
  violet: dark('Violet', '#b18cff', '#e0d2ff'),
  emerald: dark('Emerald', '#3ddc97', '#bff4dc'),
  ice: dark('Ice', '#cfe9ff', '#f0f8ff'),
  rose: dark('Rose', '#ff7eb6', '#ffd0e4'),
  lime: dark('Lime', '#c6ff3d', '#eaffb8'),
  sunset: dark('Sunset', '#ff7f6e', '#ffd3c8'),
  mono: dark('Mono', '#ffffff', '#ffffff'),
};
export const DEFAULT_THEME = 'ghosty';

const hexOk = (c: string) => /^#[0-9a-f]{6}$/i.test(c);
const lum = (c: string): number => {
  const n = parseInt(c.slice(1), 16);
  const f = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
};
/** A palette from a file's own colours (ground, ink, accent, and what it offers as a sequence); null when the colours are not usable. */
export function paletteFrom(name: string, ground: string, ink: string, accent: string, more: string[] = []): Palette | null {
  const g = ground.startsWith('#') ? ground : `#${ground}`;
  const t = ink.startsWith('#') ? ink : `#${ink}`;
  const a = accent.startsWith('#') ? accent : `#${accent}`;
  if (![g, t, a].every(hexOk)) return null;
  const seq = [a, ...more.map((c) => (c.startsWith('#') ? c : `#${c}`)).filter(hexOk)].slice(0, 5);
  while (seq.length < 5) seq.push(seq[seq.length % Math.max(1, seq.length)] ?? a);
  const dk = lum(g) < 0.4;
  return { name, ground: g.toLowerCase(), plate: dk ? '#171b20' : '#e9e4d9', ink: t.toLowerCase(), ink2: t.toLowerCase(), accent: a.toLowerCase(), seq: seq.map((c) => c.toLowerCase()), dark: dk };
}
/** Hex without the hash, upper case, as a .pptx writes it. */
export const rgb = (c: string): string => c.replace('#', '').toUpperCase();
