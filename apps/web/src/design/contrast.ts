/**
 * Colour as the design system measures it (BRIEF-DESIGN-SYSTEM's readability floor): a colour from a token, its relative
 * luminance and the WCAG contrast between two colours. Pure, no DOM: Settings → THE LOOK prints the numbers from it live, and
 * apps/edge/test/look.test.mjs holds the floor with the same maths in every theme.
 */
export type RGB = [number, number, number];

/** "#ff7a3d", "#fff", "rgb(16, 19, 23)", "rgba(16, 19, 23, .72)" or "16, 19, 23" (a triplet token) → 0..255 channels,
 *  a colour with alpha laid over `under` (the surface it sits on). Null for anything that is not a plain colour. */
export function parseColour(value: string, under: RGB = [0, 0, 0]): RGB | null {
  const v = value.trim().toLowerCase();
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  if (m) {
    const h = m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join('') : m[1]!;
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
  }
  m = /^(?:rgba?\()?\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)?$/.exec(v);
  if (!m || (v.startsWith('rgb') !== v.endsWith(')'))) return null;
  const c = [m[1], m[2], m[3]].map(Number) as RGB;
  const a = m[4] === undefined ? 1 : Number(m[4]);
  if (c.some((x) => !Number.isFinite(x) || x < 0 || x > 255) || !(a >= 0 && a <= 1)) return null;
  return c.map((x, i) => Math.round(x * a + under[i]! * (1 - a))) as RGB;
}

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance, 0 (black) to 1 (white). */
export const luminance = ([r, g, b]: RGB): number => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

/** WCAG contrast ratio between two colours, 1 to 21. */
export function contrast(a: RGB, b: RGB): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** `a` moved `t` of the way to `b`. */
export const mix = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => Math.round(v + (b[i]! - v) * t)) as RGB;

export const toHex = (c: RGB): string => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;

/** The floor (BRIEF-DESIGN-SYSTEM): text at least 4.5:1, a line at least 3:1; the accent is used as text only where it clears
 *  5:1 on every surface, otherwise its text variant (moved towards its pale until it does). */
export const FLOOR = { text: 4.5, line: 3, accentAsText: 5 } as const;

/**
 * The accent as text over these surfaces: the accent itself where it clears 5:1 on every one, else the accent moved towards
 * its pale tint, in steps of 2 %, until it does (Crimson, and a red mood). Pale itself if nothing short of it clears.
 */
export function textVariant(accent: RGB, pale: RGB, surfaces: RGB[]): RGB {
  const clears = (c: RGB) => surfaces.every((s) => contrast(c, s) >= FLOOR.accentAsText);
  if (clears(accent)) return accent;
  for (let t = 0.02; t < 1; t += 0.02) {
    const c = mix(accent, pale, t);
    if (clears(c)) return c;
  }
  return pale;
}

/**
 * The accent on a light ground (Paper, BRIEF-THEMES-2): the accent itself where it clears 5:1 on every surface there, else the
 * accent moved towards the ground's ink, in steps of 2 %, until it does (as text that is 5:1, and so as a line well over 3:1).
 * The ink itself if nothing short of it clears. tokens.css holds each theme's (--g-accent-ink); a mood's is worked out so too.
 */
export function inkVariant(accent: RGB, ink: RGB, surfaces: RGB[]): RGB {
  const clears = (c: RGB) => surfaces.every((s) => contrast(c, s) >= FLOOR.accentAsText);
  if (clears(accent)) return accent;
  for (let t = 0.02; t < 1; t += 0.02) {
    const c = mix(accent, ink, t);
    if (clears(c)) return c;
  }
  return ink;
}

/** "9.2:1": a ratio as a person writes it (one decimal, never rounded up past the floor it is held to). */
export const ratioWords = (r: number): string => `${(Math.floor(r * 10) / 10).toFixed(1)}:1`;
