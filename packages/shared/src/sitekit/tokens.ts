/**
 * The design system every generated site is drawn with: colour palettes (light and dark, every text
 * pair checked against WCAG AA in the tests and again by the quality gates), font pairings (free Google
 * Fonts with system fallbacks, or the system stack alone), a fluid type scale and spacing, three shapes
 * (radii), layered shadows, motion, breakpoints, and the base CSS (reset, layout, buttons, cards, form
 * fields, focus rings, reduced motion). One theme = palette + fonts + shape + scheme.
 */
import type { FontsId, PaletteId, Scheme, ShapeId, Theme } from './types';

export interface Colours {
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
  onPrimary: string;
  accent: string;
  onAccent: string;
}
export interface Palette {
  id: PaletteId;
  label: string;
  light: Colours;
  dark: Colours;
}

export const PALETTES: Record<PaletteId, Palette> = {
  espresso: {
    id: 'espresso',
    label: 'Espresso: warm cream, roasted rust, honey',
    light: { bg: '#fbf7f2', surface: '#ffffff', surface2: '#f3ebe1', text: '#2a1d15', muted: '#6a5547', border: '#e6d9c9', primary: '#9a3412', onPrimary: '#ffffff', accent: '#e7b75f', onAccent: '#2a1d15' },
    dark: { bg: '#16100c', surface: '#211812', surface2: '#2b2018', text: '#f6ede4', muted: '#c4b3a3', border: '#3a2c22', primary: '#f0a36b', onPrimary: '#1b120c', accent: '#e7b75f', onAccent: '#1b120c' },
  },
  barber: {
    id: 'barber',
    label: 'Barber: charcoal, bone, brushed brass',
    light: { bg: '#f5f2ed', surface: '#ffffff', surface2: '#ebe5dc', text: '#151515', muted: '#5c5650', border: '#ddd5ca', primary: '#151515', onPrimary: '#f5f2ed', accent: '#8a6a35', onAccent: '#ffffff' },
    dark: { bg: '#0e0e0f', surface: '#171718', surface2: '#202022', text: '#f2eee8', muted: '#b3aca3', border: '#2d2d30', primary: '#c9a46a', onPrimary: '#141414', accent: '#c9a46a', onAccent: '#141414' },
  },
  trades: {
    id: 'trades',
    label: 'Trades: clean white, deep navy, safety orange',
    light: { bg: '#ffffff', surface: '#f6f8fb', surface2: '#eaf0f7', text: '#0f1b2d', muted: '#4a5a70', border: '#dbe3ed', primary: '#0b3a6e', onPrimary: '#ffffff', accent: '#c2410c', onAccent: '#ffffff' },
    dark: { bg: '#0a1422', surface: '#0f1d31', surface2: '#15273f', text: '#eef3f9', muted: '#a9b8cb', border: '#223650', primary: '#ff8a4c', onPrimary: '#1a0d05', accent: '#ff8a4c', onAccent: '#1a0d05' },
  },
  gym: {
    id: 'gym',
    label: 'Gym: black, chalk, electric lime',
    light: { bg: '#f7f7f5', surface: '#ffffff', surface2: '#ececea', text: '#0b0b0c', muted: '#55555a', border: '#dcdcd8', primary: '#0b0b0c', onPrimary: '#d4ff3a', accent: '#3f6212', onAccent: '#ffffff' },
    dark: { bg: '#0a0a0b', surface: '#141416', surface2: '#1d1d20', text: '#f4f4f2', muted: '#a8a8ad', border: '#2a2a2e', primary: '#d4ff3a', onPrimary: '#0a0a0b', accent: '#d4ff3a', onAccent: '#0a0a0b' },
  },
  clinic: {
    id: 'clinic',
    label: 'Clinic: calm white, deep teal, sky',
    light: { bg: '#f8fbfb', surface: '#ffffff', surface2: '#e8f3f2', text: '#0d2b30', muted: '#4b6468', border: '#d5e6e5', primary: '#0f766e', onPrimary: '#ffffff', accent: '#155e75', onAccent: '#ffffff' },
    dark: { bg: '#071a1c', surface: '#0c2427', surface2: '#113034', text: '#e8f6f5', muted: '#9fbfbf', border: '#1b3d41', primary: '#5eead4', onPrimary: '#052022', accent: '#7dd3fc', onAccent: '#04202c' },
  },
  estate: {
    id: 'estate',
    label: 'Estate: paper, forest green, old gold',
    light: { bg: '#fbfaf7', surface: '#ffffff', surface2: '#f1eee6', text: '#16231d', muted: '#56625b', border: '#e3ded2', primary: '#1e4634', onPrimary: '#ffffff', accent: '#8c6d2f', onAccent: '#ffffff' },
    dark: { bg: '#0d1612', surface: '#13201a', surface2: '#1a2a22', text: '#eef3ef', muted: '#a9b8af', border: '#263a31', primary: '#d8b56a', onPrimary: '#14110a', accent: '#d8b56a', onAccent: '#14110a' },
  },
  mono: {
    id: 'mono',
    label: 'Mono: gallery white, ink black, graphite',
    light: { bg: '#fafaf9', surface: '#ffffff', surface2: '#f0efed', text: '#111111', muted: '#5a5a5a', border: '#e2e1de', primary: '#111111', onPrimary: '#fafaf9', accent: '#5f5f5f', onAccent: '#ffffff' },
    dark: { bg: '#0c0c0c', surface: '#151515', surface2: '#1e1e1e', text: '#f2f2f0', muted: '#a3a3a3', border: '#2a2a2a', primary: '#f2f2f0', onPrimary: '#0c0c0c', accent: '#bdbdbd', onAccent: '#0c0c0c' },
  },
  charity: {
    id: 'charity',
    label: 'Charity: warm white, plum, coral',
    light: { bg: '#fffaf7', surface: '#ffffff', surface2: '#fbeee8', text: '#2a1730', muted: '#64536a', border: '#efdcd5', primary: '#7b2d6b', onPrimary: '#ffffff', accent: '#b93a26', onAccent: '#ffffff' },
    dark: { bg: '#170d19', surface: '#211424', surface2: '#2c1b30', text: '#f8eef6', muted: '#c7b1c4', border: '#3a2640', primary: '#f59ac8', onPrimary: '#2a0d22', accent: '#ff9a7a', onAccent: '#2a0f08' },
  },
  saas: {
    id: 'saas',
    label: 'Product: white, indigo, cyan',
    light: { bg: '#ffffff', surface: '#f8fafc', surface2: '#eef2ff', text: '#0f172a', muted: '#475569', border: '#e2e8f0', primary: '#4f46e5', onPrimary: '#ffffff', accent: '#0e7490', onAccent: '#ffffff' },
    dark: { bg: '#0b1020', surface: '#111831', surface2: '#18213f', text: '#e8ecf8', muted: '#a3adc8', border: '#24305a', primary: '#a5b4fc', onPrimary: '#0b1020', accent: '#67e8f9', onAccent: '#062029' },
  },
  sage: {
    id: 'sage',
    label: 'Sage: linen, sage green, terracotta',
    light: { bg: '#f8f6f1', surface: '#ffffff', surface2: '#ece9df', text: '#1f2a22', muted: '#59645b', border: '#dedad0', primary: '#3f5d4a', onPrimary: '#ffffff', accent: '#a84d33', onAccent: '#ffffff' },
    dark: { bg: '#111712', surface: '#182019', surface2: '#202a22', text: '#eef2ec', muted: '#aab5ab', border: '#2b372d', primary: '#a7c9a4', onPrimary: '#102012', accent: '#f0a585', onAccent: '#2a1208' },
  },
  neon: {
    id: 'neon',
    label: 'Night: midnight violet, hot pink, ice',
    light: { bg: '#fbf8ff', surface: '#ffffff', surface2: '#f1eafe', text: '#1a1030', muted: '#5d5270', border: '#e4dcf3', primary: '#6d28d9', onPrimary: '#ffffff', accent: '#be185d', onAccent: '#ffffff' },
    dark: { bg: '#0f0a1c', surface: '#181029', surface2: '#221637', text: '#f6f0ff', muted: '#b9aed0', border: '#2f2347', primary: '#ff5fb0', onPrimary: '#1a0712', accent: '#7cf0ff', onAccent: '#06222a' },
  },
  blush: {
    id: 'blush',
    label: 'Blush: soft blush, mulberry, rose',
    light: { bg: '#fcf7f5', surface: '#ffffff', surface2: '#f6e9e5', text: '#2b1a1d', muted: '#6d575b', border: '#eedcd7', primary: '#7a3e48', onPrimary: '#ffffff', accent: '#a3564d', onAccent: '#ffffff' },
    dark: { bg: '#1a1214', surface: '#24191c', surface2: '#2f2125', text: '#f8eeee', muted: '#c9b3b5', border: '#3d2b2f', primary: '#f2b8b5', onPrimary: '#2b1316', accent: '#f2b8b5', onAccent: '#2b1316' },
  },
  paprika: {
    id: 'paprika',
    label: 'Paprika: warm paper, chilli red, toasted amber',
    light: { bg: '#fffaf4', surface: '#ffffff', surface2: '#f8ebdd', text: '#24170f', muted: '#67564a', border: '#eddccb', primary: '#a8321b', onPrimary: '#ffffff', accent: '#7a4a06', onAccent: '#ffffff' },
    dark: { bg: '#16100c', surface: '#211813', surface2: '#2b2019', text: '#f8efe6', muted: '#c6b4a5', border: '#3b2d23', primary: '#ff9472', onPrimary: '#1d0c06', accent: '#ffc56e', onAccent: '#1d1306' },
  },
};

export interface FontPair {
  id: FontsId;
  label: string;
  display: string;
  body: string;
  /** Google Fonts css2 families (weights trimmed to what the kit uses); empty: system fonts only. */
  google: string[];
  /** Display tweaks: weight, letter-spacing, case. */
  displayWeight: number;
  displayTracking: string;
  displayCase?: 'uppercase';
  /** The italic accent inside headlines (<em>): its own style. */
  emStyle: 'italic' | 'normal';
}

const SANS = "system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
const SERIF = "ui-serif,Georgia,'Times New Roman',serif";

export const FONTS: Record<FontsId, FontPair> = {
  editorial: { id: 'editorial', label: 'Fraunces + Inter: warm editorial serif', display: `'Fraunces',${SERIF}`, body: `'Inter',${SANS}`, google: ['Fraunces:ital,opsz,wght@0,9..144,600;1,9..144,500', 'Inter:wght@400;500;600'], displayWeight: 600, displayTracking: '-0.02em', emStyle: 'italic' },
  classic: { id: 'classic', label: 'Playfair Display + Source Sans 3: classic and elegant', display: `'Playfair Display',${SERIF}`, body: `'Source Sans 3',${SANS}`, google: ['Playfair+Display:ital,wght@0,600;1,500', 'Source+Sans+3:wght@400;600'], displayWeight: 600, displayTracking: '-0.01em', emStyle: 'italic' },
  condensed: { id: 'condensed', label: 'Oswald + Inter: strong, condensed, uppercase', display: `'Oswald','Arial Narrow',${SANS}`, body: `'Inter',${SANS}`, google: ['Oswald:wght@500;600', 'Inter:wght@400;500;600'], displayWeight: 600, displayTracking: '0.01em', displayCase: 'uppercase', emStyle: 'normal' },
  refined: { id: 'refined', label: 'DM Serif Display + DM Sans: refined, reassuring', display: `'DM Serif Display',${SERIF}`, body: `'DM Sans',${SANS}`, google: ['DM+Serif+Display:ital@0;1', 'DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700'], displayWeight: 400, displayTracking: '-0.01em', emStyle: 'italic' },
  tech: { id: 'tech', label: 'Space Grotesk + Inter: crisp product', display: `'Space Grotesk',${SANS}`, body: `'Inter',${SANS}`, google: ['Space+Grotesk:wght@500;700', 'Inter:wght@400;500;600'], displayWeight: 700, displayTracking: '-0.03em', emStyle: 'normal' },
  friendly: { id: 'friendly', label: 'Bricolage Grotesque + Inter: friendly, modern', display: `'Bricolage Grotesque',${SANS}`, body: `'Inter',${SANS}`, google: ['Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800', 'Inter:wght@400;500;600'], displayWeight: 800, displayTracking: '-0.03em', emStyle: 'normal' },
  luxe: { id: 'luxe', label: 'Cormorant Garamond + Jost: quiet luxury', display: `'Cormorant Garamond',${SERIF}`, body: `'Jost',${SANS}`, google: ['Cormorant+Garamond:ital,wght@0,600;1,500', 'Jost:wght@400;500'], displayWeight: 600, displayTracking: '-0.01em', emStyle: 'italic' },
  geometric: { id: 'geometric', label: 'Outfit: clean geometric', display: `'Outfit',${SANS}`, body: `'Outfit',${SANS}`, google: ['Outfit:wght@400;500;700'], displayWeight: 700, displayTracking: '-0.025em', emStyle: 'normal' },
  system: { id: 'system', label: 'System fonts: fastest, nothing from Google', display: SANS, body: SANS, google: [], displayWeight: 750, displayTracking: '-0.025em', emStyle: 'italic' },
};

export interface Shape {
  id: ShapeId;
  r1: string;
  r2: string;
  r3: string;
  btn: string;
}
export const SHAPES: Record<ShapeId, Shape> = {
  sharp: { id: 'sharp', r1: '2px', r2: '4px', r3: '6px', btn: '2px' },
  soft: { id: 'soft', r1: '6px', r2: '12px', r3: '20px', btn: '10px' },
  round: { id: 'round', r1: '10px', r2: '18px', r3: '28px', btn: '999px' },
};

/** Breakpoints (px): a phone below `tablet`, tablets to `laptop`, wider screens above. */
export const BREAKPOINTS = { tablet: 600, laptop: 900, wide: 1200 } as const;

// ── colour maths (WCAG 2.x) ───────────────────────────────────────────────────────────

export function rgbOf(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function luminance(hex: string): number {
  const [r, g, b] = rgbOf(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** The contrast ratio of two colours, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/** Every text-on-background pair a theme uses, with the ratio it must reach (4.5 body text, 3 large text and outlines). */
export function textPairs(c: Colours): { what: string; fg: string; bg: string; min: number }[] {
  return [
    { what: 'text on page', fg: c.text, bg: c.bg, min: 4.5 },
    { what: 'text on cards', fg: c.text, bg: c.surface, min: 4.5 },
    { what: 'text on alternate sections', fg: c.text, bg: c.surface2, min: 4.5 },
    { what: 'quiet text on page', fg: c.muted, bg: c.bg, min: 4.5 },
    { what: 'quiet text on cards', fg: c.muted, bg: c.surface, min: 4.5 },
    { what: 'quiet text on alternate sections', fg: c.muted, bg: c.surface2, min: 4.5 },
    { what: 'button text', fg: c.onPrimary, bg: c.primary, min: 4.5 },
    { what: 'links and brand-coloured text', fg: c.primary, bg: c.bg, min: 4.5 },
    { what: 'accent button text', fg: c.onAccent, bg: c.accent, min: 4.5 },
  ];
}

/** Worked out once per look and kept (a build draws and checks the same theme several times). */
const memo = <T>(cache: Map<string, T>, key: string, make: () => T): T => {
  const had = cache.get(key);
  if (had !== undefined) return had;
  const v = make();
  if (cache.size > 64) cache.clear();
  cache.set(key, v);
  return v;
};
const themeKey = (t: Theme) => `${t.palette}|${t.fonts}|${t.shape}|${t.scheme}`;
const CONTRAST = new Map<string, string[]>();
const CSS = new Map<string, string>();

/** The pairs of a theme below their minimum, in plain words ("button text 3.2:1, needs 4.5:1"). */
export function contrastProblems(theme: Theme): string[] {
  return [...memo(CONTRAST, themeKey(theme), () => contrastOf(theme))];
}
function contrastOf(theme: Theme): string[] {
  const p = PALETTES[theme.palette];
  const sets: [string, Colours][] = theme.scheme === 'light' ? [['light', p.light]] : theme.scheme === 'dark' ? [['dark', p.dark]] : [['light', p.light], ['dark', p.dark]];
  const out: string[] = [];
  for (const [name, c] of sets) for (const x of textPairs(c)) {
    const r = contrast(x.fg, x.bg);
    if (r < x.min) out.push(`${x.what} (${name}) ${r.toFixed(2)}:1, needs ${x.min}:1`);
  }
  return out;
}

// ── CSS ───────────────────────────────────────────────────────────────────────────────

/** The footer: the text colour as a deep band on a light theme; on a dark theme a slightly raised surface. */
const footOf = (c: Colours) => (luminance(c.bg) < 0.1 ? { bg: '#050505', fg: c.text } : { bg: c.text, fg: c.bg });
const vars = (c: Colours) =>
  `--map-filter:${luminance(c.bg) < 0.1 ? 'invert(.92) hue-rotate(180deg) grayscale(.3) brightness(.95)' : 'none'};--foot-bg:${footOf(c).bg};--foot-fg:${footOf(c).fg};--rgb-foot-fg:${rgbOf(footOf(c).fg).join(' ')};--bg:${c.bg};--surface:${c.surface};--surface-2:${c.surface2};--text:${c.text};--muted:${c.muted};--border:${c.border};--primary:${c.primary};--on-primary:${c.onPrimary};--accent:${c.accent};--on-accent:${c.onAccent};--rgb-text:${rgbOf(c.text).join(' ')};--rgb-primary:${rgbOf(c.primary).join(' ')};--rgb-bg:${rgbOf(c.bg).join(' ')}`;

/** The Google Fonts stylesheet for a pairing (display=swap), or '' for system fonts. */
export function fontsHref(f: FontsId): string {
  const g = FONTS[f].google;
  return g.length ? `https://fonts.googleapis.com/css2?${g.map((x) => `family=${x}`).join('&')}&display=swap` : '';
}

/** The theme's tokens and base styles. Section tones (alt, inverse) and dark mode are variables, so blocks never hard-code a colour. */
export function themeCss(theme: Theme): string {
  return memo(CSS, themeKey(theme), () => themeCssOf(theme));
}
function themeCssOf(theme: Theme): string {
  const p = PALETTES[theme.palette];
  const f = FONTS[theme.fonts];
  const s = SHAPES[theme.shape];
  const first = theme.scheme === 'dark' ? p.dark : p.light;
  const scheme =
    theme.scheme === 'auto'
      ? `@media (prefers-color-scheme:dark){:root{${vars(p.dark)};color-scheme:dark}}`
      : '';
  const darkFirst = theme.scheme === 'dark';
  return `:root{${vars(first)};color-scheme:${darkFirst ? 'dark' : 'light'};
--font-display:${f.display};--font-body:${f.body};--display-weight:${f.displayWeight};--display-tracking:${f.displayTracking};--display-case:${f.displayCase ?? 'none'};--em-style:${f.emStyle};
--step--1:clamp(.84rem,.82rem + .1vw,.9rem);--step-0:clamp(1rem,.96rem + .2vw,1.125rem);--step-1:clamp(1.2rem,1.12rem + .4vw,1.42rem);--step-2:clamp(1.44rem,1.3rem + .7vw,1.8rem);--step-3:clamp(1.73rem,1.48rem + 1.2vw,2.4rem);--step-4:clamp(2.07rem,1.66rem + 2vw,3.3rem);--step-5:clamp(2.49rem,1.8rem + 3.4vw,4.6rem);
--space-2xs:clamp(.5rem,.48rem + .1vw,.56rem);--space-xs:clamp(.75rem,.71rem + .2vw,.88rem);--space-s:clamp(1rem,.95rem + .25vw,1.13rem);--space-m:clamp(1.5rem,1.42rem + .4vw,1.75rem);--space-l:clamp(2rem,1.86rem + .7vw,2.5rem);--space-xl:clamp(3rem,2.7rem + 1.5vw,4rem);--space-2xl:clamp(4rem,3.4rem + 3vw,6rem);--space-3xl:clamp(5rem,4rem + 5vw,8.5rem);
--r1:${s.r1};--r2:${s.r2};--r3:${s.r3};--r-btn:${s.btn};
--shadow-1:0 1px 2px rgb(var(--rgb-text) / .06),0 1px 1px rgb(var(--rgb-text) / .04);--shadow-2:0 2px 4px rgb(var(--rgb-text) / .05),0 8px 24px -6px rgb(var(--rgb-text) / .12);--shadow-3:0 4px 8px rgb(var(--rgb-text) / .05),0 24px 60px -12px rgb(var(--rgb-text) / .22);
--ease:cubic-bezier(.2,.7,.2,1);--t-fast:150ms;--t-mid:260ms;--t-slow:600ms;
--wrap:1200px;--gutter:clamp(16px,4vw,40px);--measure:62ch}
${scheme}
${BASE_CSS}`;
}

/** Reset, layout primitives, type, buttons, cards, fields, section tones, motion. */
const BASE_CSS = `*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%;scroll-behavior:smooth;scroll-padding-top:84px}
body{margin:0;min-height:100dvh;background:var(--bg);color:var(--text);font:400 var(--step-0)/1.6 var(--font-body);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;overflow-x:clip}
img,svg,video,iframe{display:block;max-width:100%}
img{height:auto}
a{color:inherit;text-decoration-thickness:1px;text-underline-offset:.18em}
p a,.prose a,li a{color:var(--link,var(--primary))}
h1,h2,h3,h4{font-family:var(--font-display);font-weight:var(--display-weight);letter-spacing:var(--display-tracking);text-transform:var(--display-case);line-height:1.08;margin:0;text-wrap:balance;overflow-wrap:break-word}
h1{font-size:var(--step-5)}h2{font-size:var(--step-4)}h3{font-size:var(--step-2);line-height:1.2}h4{font-size:var(--step-1);line-height:1.25}
h1 em,h2 em{font-style:var(--em-style);color:var(--hl,var(--primary))}
p{margin:0;text-wrap:pretty}
ul,ol{margin:0;padding:0}
button,input,select,textarea{font:inherit;color:inherit}
:focus-visible{outline:3px solid var(--primary);outline-offset:3px;border-radius:2px}
[tabindex="-1"]:focus{outline:none}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.skip{position:absolute;left:12px;top:-60px;z-index:100;padding:10px 16px;background:var(--primary);color:var(--on-primary);border-radius:var(--r1);text-decoration:none;font-weight:600}
.skip:focus{top:12px}
.wrap{width:min(100% - 2 * var(--gutter),var(--wrap));margin-inline:auto}
.wrap.narrow{--wrap:820px}
.sec{padding-block:var(--space-2xl);position:relative}
.sec.tight{padding-block:var(--space-xl)}
.tone-alt{background:var(--surface-2)}
.tone-inverse{background:var(--inv-bg,var(--text));color:var(--inv-text,var(--bg));--muted:rgb(var(--rgb-bg) / .74);--border:rgb(var(--rgb-bg) / .18);--link:currentColor;--hl:currentColor}
.tone-inverse .btn-primary{--b-bg:var(--bg);--b-fg:var(--text)}
.tone-inverse .btn-outline{--b-line:rgb(var(--rgb-bg) / .45);--b-fg:var(--bg)}
.eyebrow{display:inline-flex;align-items:center;gap:.6em;font:600 var(--step--1)/1.2 var(--font-body);letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:var(--space-s)}
.eyebrow::before{content:"";width:28px;height:1px;background:currentColor;opacity:.7}
.lead{font-size:var(--step-1);line-height:1.55;color:var(--muted);max-width:var(--measure)}
.muted{color:var(--muted)}
.head{display:grid;gap:var(--space-s);margin-bottom:var(--space-xl);max-width:760px}
.head.center{margin-inline:auto;text-align:center;justify-items:center}
.head.split{max-width:none;grid-template-columns:1fr;align-items:end}
@media (min-width:900px){.head.split{grid-template-columns:1.1fr .9fr;gap:var(--space-xl)}}
.btns{display:flex;flex-wrap:wrap;gap:var(--space-xs);align-items:center}
.btn{--b-bg:var(--primary);--b-fg:var(--on-primary);--b-line:var(--b-bg);display:inline-flex;align-items:center;justify-content:center;gap:.55em;min-height:48px;padding:.7em 1.4em;border-radius:var(--r-btn);border:1.5px solid var(--b-line);background:var(--b-bg);color:var(--b-fg);font:600 var(--step-0)/1.1 var(--font-body);letter-spacing:.01em;text-decoration:none;cursor:pointer;transition:transform var(--t-fast) var(--ease),box-shadow var(--t-mid) var(--ease),background-color var(--t-mid) var(--ease);touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.btn:hover{box-shadow:var(--shadow-2);transform:translateY(-1px)}
.btn:active{transform:translateY(0) scale(.98)}
.btn-accent{--b-bg:var(--accent);--b-fg:var(--on-accent)}
.btn-outline{--b-bg:transparent;--b-fg:var(--text);--b-line:color-mix(in srgb,var(--text) 35%,transparent)}
.btn-ghost{--b-bg:transparent;--b-fg:var(--text);--b-line:transparent;padding-inline:.4em}
.btn-ghost:hover{box-shadow:none;text-decoration:underline}
.btn .ic{width:1.15em;height:1.15em}
.btn-sm{min-height:44px;padding:.55em 1.1em;font-size:var(--step--1)}
@media (max-width:479px){section[class*="b-hero"] .btns .btn,.b-cta-banner .btns .btn{flex:1 1 100%}}
.ic{width:24px;height:24px;flex:none;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r2);padding:var(--space-m)}
.grid{display:grid;gap:var(--space-m)}
.g2{grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))}
.g3{grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))}
.g4{grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr))}
.media{position:relative;overflow:hidden;border-radius:var(--r3);background:var(--surface-2)}
.media img{width:100%;height:100%;object-fit:cover}
.ratio-43{aspect-ratio:4/3}.ratio-34{aspect-ratio:3/4}.ratio-11{aspect-ratio:1}.ratio-169{aspect-ratio:16/9}.ratio-32{aspect-ratio:3/2}
.badge{display:inline-flex;align-items:center;gap:.4em;padding:.3em .75em;border-radius:999px;background:var(--surface-2);color:var(--text);font:600 var(--step--1)/1.2 var(--font-body)}
.stars{display:inline-flex;gap:2px;color:var(--accent)}
.stars .ic{width:16px;height:16px;fill:currentColor;stroke:none}
.field{display:grid;gap:6px}
.field label{font-weight:600;font-size:var(--step--1)}
.field input,.field select,.field textarea{width:100%;min-height:50px;padding:.75em .95em;border-radius:var(--r1);border:1.5px solid var(--border);background:var(--surface);color:var(--text);font-size:16px;transition:border-color var(--t-fast)}
.field textarea{min-height:130px;resize:vertical}
.field input:focus,.field select:focus,.field textarea:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 4px rgb(var(--rgb-primary) / .18)}
.field .hint{font-size:var(--step--1);color:var(--muted)}
.prose{max-width:var(--measure)}
.prose>*+*{margin-top:1em}
.prose h2{font-size:var(--step-3);margin-top:1.6em}.prose h3{font-size:var(--step-2);margin-top:1.4em}
.prose ul{padding-left:1.2em}
.prose blockquote{margin:1.6em 0;padding-left:1em;border-left:3px solid var(--primary);font-size:var(--step-1)}
.reveal{opacity:1}
.js .reveal{opacity:0;transform:translateY(18px);transition:opacity var(--t-slow) var(--ease),transform var(--t-slow) var(--ease)}
.js .reveal.in{opacity:1;transform:none}
.js .page:not(.on){display:none}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}.js .reveal{opacity:1;transform:none}}
@media print{.nav,.no-print{display:none!important}.js .page{display:block!important}}`;

export const DEFAULT_THEME: Theme = { palette: 'espresso', fonts: 'editorial', shape: 'soft', scheme: 'light' };

export const PALETTE_IDS = Object.keys(PALETTES) as PaletteId[];
export const FONT_IDS = Object.keys(FONTS) as FontsId[];
export const SHAPE_IDS = Object.keys(SHAPES) as ShapeId[];
export const SCHEMES: Scheme[] = ['light', 'dark', 'auto'];
