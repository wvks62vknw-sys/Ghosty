/**
 * THE CREATIVE PACK, the pictures (BRIEF-PACKS-2): a POSTER laid out from his words, a BIRTHDAY CARD, a four-panel COMIC STRIP
 * of stick figures with expressions and his words for captions, a LOGO sketch in simple shapes, and a PALETTE from a photo's
 * pixels or a colour he names. Everything is made of a few shapes (`Prim`): the same list is drawn on the phone's canvas
 * (exported as a PNG) and written out as an SVG, so the layout is checked here, in code, before anything is drawn. All of it
 * is ours — shapes and stick figures made by these functions, never anyone's art. Pure: no canvas, no network.
 */
import { hashSeed, rng } from './creative';

export type Prim =
  | { t: 'rect'; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; sw?: number; r?: number }
  | { t: 'circle'; x: number; y: number; r: number; fill?: string; stroke?: string; sw?: number }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; sw: number }
  | { t: 'poly'; pts: [number, number][]; fill?: string; stroke?: string; sw?: number }
  | { t: 'arc'; x: number; y: number; r: number; a0: number; a1: number; stroke: string; sw: number }
  /** `y` is the top of the line; `align` is where `x` sits; `font` is the display face (the poster's) or the plain body one. */
  | { t: 'text'; x: number; y: number; text: string; size: number; fill: string; align?: 'left' | 'center' | 'right'; weight?: number; font?: 'display' | 'body' };

export type Measure = (text: string, size: number, weight?: number) => number;
/** Without a canvas to measure with: a condensed display face is about 0.45 of its size wide a letter. */
export const approxMeasure: Measure = (text, size, weight = 400) => text.length * size * (weight >= 600 ? 0.47 : 0.43);

const r1 = (n: number) => Math.round(n * 10) / 10;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Lines of words that fit `maxW` (a word longer than the line goes on a line of its own). */
export function wrap(text: string, maxW: number, size: number, measure: Measure = approxMeasure, weight = 400): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const w of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${w}` : w;
      if (measure(next, size, weight) <= maxW || !line) line = next;
      else {
        out.push(line);
        line = w;
      }
    }
    out.push(line);
  }
  return out.filter((l, i, a) => l || i < a.length - 1 || a.length === 1);
}

/** The page as an SVG document: the same shapes the phone draws (the poster's face is named in font-family). */
export function primsToSvg(prims: Prim[], w: number, h: number, bg = '#ffffff'): string {
  const fl = (p: { fill?: string; stroke?: string; sw?: number }) => `fill="${p.fill ?? 'none'}"${p.stroke ? ` stroke="${p.stroke}" stroke-width="${p.sw ?? 2}" stroke-linecap="round" stroke-linejoin="round"` : ''}`;
  const body = prims.map((p) => {
    switch (p.t) {
      case 'rect': return `<rect x="${r1(p.x)}" y="${r1(p.y)}" width="${r1(p.w)}" height="${r1(p.h)}"${p.r ? ` rx="${r1(p.r)}"` : ''} ${fl(p)}/>`;
      case 'circle': return `<circle cx="${r1(p.x)}" cy="${r1(p.y)}" r="${r1(p.r)}" ${fl(p)}/>`;
      case 'line': return `<line x1="${r1(p.x1)}" y1="${r1(p.y1)}" x2="${r1(p.x2)}" y2="${r1(p.y2)}" stroke="${p.stroke}" stroke-width="${p.sw}" stroke-linecap="round"/>`;
      case 'poly': return `<polygon points="${p.pts.map(([x, y]) => `${r1(x)},${r1(y)}`).join(' ')}" ${fl(p)}/>`;
      case 'arc': {
        const x0 = p.x + p.r * Math.cos(p.a0);
        const y0 = p.y + p.r * Math.sin(p.a0);
        const x1 = p.x + p.r * Math.cos(p.a1);
        const y1 = p.y + p.r * Math.sin(p.a1);
        return `<path d="M${r1(x0)} ${r1(y0)}A${r1(p.r)} ${r1(p.r)} 0 ${Math.abs(p.a1 - p.a0) > Math.PI ? 1 : 0} 1 ${r1(x1)} ${r1(y1)}" fill="none" stroke="${p.stroke}" stroke-width="${p.sw}" stroke-linecap="round"/>`;
      }
      case 'text': return `<text x="${r1(p.x)}" y="${r1(p.y + p.size * 0.82)}" font-size="${p.size}" fill="${p.fill}" font-weight="${p.weight ?? 400}" text-anchor="${p.align === 'center' ? 'middle' : p.align === 'right' ? 'end' : 'start'}" font-family="${p.font === 'display' ? 'Oswald, Impact, sans-serif' : 'system-ui, sans-serif'}">${esc(p.text)}</text>`;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${bg}"/>${body.join('')}</svg>`;
}

export interface TextBox {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
/** Where each line of text sits on the page (to check it stays inside the margins and never lands on another line). */
export function textBoxes(prims: Prim[], measure: Measure = approxMeasure): TextBox[] {
  return prims.flatMap((p) => {
    if (p.t !== 'text') return [];
    const w = measure(p.text, p.size, p.weight);
    const x0 = p.align === 'center' ? p.x - w / 2 : p.align === 'right' ? p.x - w : p.x;
    return [{ text: p.text, x0, y0: p.y, x1: x0 + w, y1: p.y + p.size * 1.05 }];
  });
}

// ---------------------------------------------------------------- colour

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
/** The WCAG contrast of two colours, 1 to 21 (4.5 for body text, 3 for large). */
export const contrast = (a: string, b: string): number => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return Math.round(((x! + 0.05) / (y! + 0.05)) * 100) / 100;
};
export const hexOf = (r: number, g: number, b: number): string => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
const rgbOf = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

export type ThemeName = 'bold' | 'party' | 'calm' | 'nature' | 'formal' | 'night';
export const THEMES: Record<ThemeName, { bg: string; fg: string; accent: string; alt: string }> = {
  bold: { bg: '#111827', fg: '#ffffff', accent: '#fbbf24', alt: '#ef4444' },
  party: { bg: '#5b21b6', fg: '#ffffff', accent: '#fde047', alt: '#f472b6' },
  calm: { bg: '#e0f2fe', fg: '#0c4a6e', accent: '#0369a1', alt: '#7dd3fc' },
  nature: { bg: '#14532d', fg: '#f0fdf4', accent: '#bef264', alt: '#facc15' },
  formal: { bg: '#fafaf9', fg: '#1c1917', accent: '#92400e', alt: '#a8a29e' },
  night: { bg: '#020617', fg: '#e2e8f0', accent: '#38bdf8', alt: '#a78bfa' },
};
export const themeFor = (words: string): ThemeName => (/party|birthday|celebrat|bbq|barbecue|fun/i.test(words) ? 'party' : /garden|nature|walk|hike|picnic|green|plant/i.test(words) ? 'nature' : /wedding|formal|dinner|memorial|funeral|christening|anniversary/i.test(words) ? 'formal' : /gig|club|band|music|night|disco|concert/i.test(words) ? 'night' : /yoga|calm|quiet|sale|coffee|bake|market/i.test(words) ? 'calm' : 'bold');

// ---------------------------------------------------------------- the poster

export interface PosterFields {
  title: string;
  subtitle?: string;
  lines?: string[];
  theme?: ThemeName;
  seed?: number;
}
export const POSTER_W = 1080;
export const POSTER_H = 1528;
/**
 * A page laid out from his words: the title as large as it can be and still fit (up to four lines), the day and time under it,
 * the details under that, and shapes in whatever room is left. Every line of text stays inside the margins and above the next.
 */
export function posterPrims(f: PosterFields, measure: Measure = approxMeasure, w = POSTER_W, h = POSTER_H): { prims: Prim[]; theme: (typeof THEMES)[ThemeName]; w: number; h: number } {
  const th = THEMES[f.theme ?? 'bold'];
  const m = 84;
  const maxW = w - 2 * m;
  const prims: Prim[] = [{ t: 'rect', x: m, y: m, w: 150, h: 14, fill: th.accent }];
  let y = m + 56;
  const title = (f.title.trim() || 'Your title').toUpperCase().slice(0, 90);
  let size = 200;
  let tl = wrap(title, maxW, size, measure, 700);
  while (size > 36 && (tl.length > 4 || tl.some((l) => measure(l, size, 700) > maxW) || tl.length * size * 1.06 > h * 0.42)) {
    size -= 8;
    tl = wrap(title, maxW, size, measure, 700);
  }
  for (const l of tl) {
    prims.push({ t: 'text', x: m, y, text: l, size, fill: th.fg, weight: 700, font: 'display' });
    y += size * 1.06;
  }
  y += 28;
  const block = (text: string, sz: number, fill: string, weight: number, font: 'display' | 'body', gap: number) => {
    for (const l of wrap(text, maxW, sz, measure, weight)) {
      if (y + sz > h - m) return;
      prims.push({ t: 'text', x: m, y, text: l, size: sz, fill, weight, font });
      y += sz * 1.18;
    }
    y += gap;
  };
  if (f.subtitle?.trim()) block(f.subtitle.trim().slice(0, 80), 68, th.accent, 600, 'display', 34);
  for (const l of (f.lines ?? []).slice(0, 6)) if (l.trim()) block(l.trim().slice(0, 120), 46, th.fg, 400, 'display', 16);
  // shapes in the room that is left
  const room = h - m - y;
  if (room > 200) {
    const r = rng(f.seed ?? hashSeed(title));
    for (let i = 0; i < 4; i++) {
      const rad = 28 + r() * Math.min(110, room / 3);
      prims.push({ t: 'circle', x: m + rad + r() * (maxW - 2 * rad), y: y + 30 + rad + r() * Math.max(0, room - 60 - 2 * rad), r: rad, fill: i % 2 ? th.alt : th.accent });
    }
  }
  return { prims, theme: th, w, h };
}

/** A poster's fields from his words: "birthday party for Sam, Saturday 14 November at 7pm at the village hall, bring a dish". */
export function posterFields(words: string, when: string): PosterFields {
  const clean = words.replace(/\s+/g, ' ').trim().replace(/^(?:make|design|create|do)\s+(?:me\s+)?(?:an?\s+)?(?:poster|flyer)\s+(?:for|about|of)\s+/i, '').replace(/^(?:a|an|the)\s+poster\s+(?:for|about)\s+/i, '');
  const parts = clean.split(/[,;.]\s*|\s+-\s+/).map((x) => x.trim()).filter(Boolean);
  const venueIn = (s: string) => /\b(?:at|in)\s+((?:the\s+)?[A-Za-z][\w'’&. -]*?)$/i.exec(s.replace(/\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, ' ').replace(/\s+/g, ' ').trim())?.[1];
  const timey = parts.find((p) => /\b(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)|monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|\d{1,2}(?:st|nd|rd|th)?\s+[a-z]{3,9})\b/i.test(p));
  const wherePart = parts.find((p) => p !== timey && /^(?:at|in)\s+/i.test(p));
  const where = wherePart ? wherePart.replace(/^(?:at|in)\s+/i, '') : timey ? venueIn(timey) : undefined;
  const title = parts[0] && parts[0] !== timey && parts[0] !== wherePart ? parts[0] : clean.slice(0, 40);
  const rest = parts.filter((p) => p !== title && p !== timey && p !== wherePart);
  return { title, ...(when || timey ? { subtitle: when || timey! } : {}), lines: [...(where ? [where.replace(/^./, (c) => c.toUpperCase())] : []), ...rest].slice(0, 5), theme: themeFor(clean) };
}

// ---------------------------------------------------------------- a birthday card

export const CARD_W = 1080;
export const CARD_H = 1350;
/** The front (balloons, confetti, the name and the age) or the inside (his message, centred) of a birthday card. */
export function cardPrims(o: { name: string; age?: number | null; message?: string; side: 'front' | 'inside'; seed?: number }, measure: Measure = approxMeasure): { prims: Prim[]; bg: string; w: number; h: number } {
  const w = CARD_W;
  const h = CARD_H;
  const r = rng(o.seed ?? hashSeed(o.name));
  const cols = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];
  const prims: Prim[] = [];
  if (o.side === 'front') {
    for (let i = 0; i < 5; i++) {
      const x = 170 + i * 185 + (r() - 0.5) * 40;
      const y = 250 + (r() - 0.5) * 120;
      const rad = 85 + r() * 20;
      prims.push({ t: 'line', x1: x, y1: y + rad, x2: 540 + (i - 2) * 30, y2: 560, stroke: '#94a3b8', sw: 4 }, { t: 'circle', x, y, r: rad, fill: cols[i % cols.length] }, { t: 'circle', x: x - rad * 0.3, y: y - rad * 0.35, r: rad * 0.18, fill: 'rgba(255,255,255,0.45)' });
    }
    for (let i = 0; i < 30; i++) {
      const cx = 30 + r() * (w - 60);
      const cy = i % 2 ? 30 + r() * 100 : h - 30 - r() * 120;
      prims.push(r() < 0.5 ? { t: 'rect', x: cx, y: cy, w: 16, h: 8, fill: cols[Math.floor(r() * 6)]! } : { t: 'circle', x: cx, y: cy, r: 8, fill: cols[Math.floor(r() * 6)]! });
    }
    let size = 170;
    while (size > 60 && measure('HAPPY BIRTHDAY', size, 700) > w - 160) size -= 8;
    prims.push({ t: 'text', x: w / 2, y: 640, text: 'HAPPY BIRTHDAY', size, fill: '#7c2d12', align: 'center', weight: 700, font: 'display' });
    let ns = 190;
    const name = o.name.trim().slice(0, 24) || 'You';
    while (ns > 60 && measure(name.toUpperCase(), ns, 700) > w - 200) ns -= 8;
    prims.push({ t: 'text', x: w / 2, y: 640 + size * 1.1, text: name.toUpperCase(), size: ns, fill: '#be185d', align: 'center', weight: 700, font: 'display' });
    if (o.age && o.age > 0 && o.age < 130) {
      const cx = 540;
      const cy = 1100;
      prims.push({ t: 'poly', pts: Array.from({ length: 20 }, (_, i) => [cx + (i % 2 ? 120 : 170) * Math.cos((i * Math.PI) / 10 - Math.PI / 2), cy + (i % 2 ? 120 : 170) * Math.sin((i * Math.PI) / 10 - Math.PI / 2)] as [number, number]), fill: '#fbbf24' }, { t: 'text', x: cx, y: cy - 70, text: String(o.age), size: 140, fill: '#7c2d12', align: 'center', weight: 700, font: 'display' });
    }
    return { prims, bg: '#fff7ed', w, h };
  }
  prims.push({ t: 'rect', x: 0, y: 0, w, h: 26, fill: cols[0]! }, { t: 'rect', x: 0, y: h - 26, w, h: 26, fill: cols[3]! });
  const msg = (o.message ?? `Happy birthday, ${o.name}!`).slice(0, 400);
  let size = 64;
  let lines = wrap(msg, w - 220, size, measure, 400);
  while (size > 30 && (lines.length * size * 1.35 > h - 420 || lines.some((l) => measure(l, size, 400) > w - 220))) {
    size -= 4;
    lines = wrap(msg, w - 220, size, measure, 400);
  }
  let y = (h - lines.length * size * 1.35) / 2;
  for (const l of lines) {
    prims.push({ t: 'text', x: w / 2, y, text: l, size, fill: '#1c1917', align: 'center', font: 'body' });
    y += size * 1.35;
  }
  for (let i = 0; i < 3; i++) prims.push({ t: 'circle', x: 440 + i * 100, y: 170, r: 22, fill: cols[(i + 1) * 2 % 6]! });
  return { prims, bg: '#ffffff', w, h };
}

// ---------------------------------------------------------------- a comic strip of stick figures

export type Expression = 'happy' | 'sad' | 'angry' | 'surprised' | 'thinking' | 'laugh';
/** The face a caption calls for (happy when nothing says otherwise). */
export function expressionOf(text: string): Expression {
  const t = text.toLowerCase();
  if (/\b(angry|mad|furious|cross|annoyed|shout|yell|rage|grr)\b/.test(t)) return 'angry';
  if (/\b(sad|cry|crying|tears|lost|miss|lonely|sorry|upset|rain|wet|broke|spilled)\w*/.test(t)) return 'sad';
  if (/\b(wow|surprise|shock|suddenly|gasp|oh no|no way|huge|boom)\w*|!{2,}/.test(t)) return 'surprised';
  if (/\b(laugh|lol|haha|funny|joke|giggle)\w*/.test(t)) return 'laugh';
  if (/\b(hmm|think|wonder|maybe|idea|why|how)\b|\?/.test(t)) return 'thinking';
  return 'happy';
}
/** A story or a joke cut into four captions (setup, build, turn, ending): by its sentences, else its "then", "but" and "so". */
export function splitStory(text: string, n = 4): string[] {
  let parts = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+|\s*;\s*|\s+(?:and then|then|but|so|suddenly)\s+/i).map((s) => s.trim().replace(/^[,.\s]+/, '')).filter(Boolean);
  if (parts.length < n) parts = parts.flatMap((p) => (p.length > 50 ? p.split(/,\s+/) : [p])).filter(Boolean);
  while (parts.length > n) {
    // join the two shortest neighbours
    let k = 0;
    for (let i = 1; i < parts.length - 1; i++) if (parts[i]!.length + parts[i + 1]!.length < parts[k]!.length + parts[k + 1]!.length) k = i;
    parts.splice(k, 2, `${parts[k]!.replace(/[.!?]$/, '')}, ${parts[k + 1]!.charAt(0).toLowerCase()}${parts[k + 1]!.slice(1)}`);
  }
  while (parts.length < n) parts.push(parts.length === n - 1 ? 'The end.' : '…');
  return parts.map((p) => p.slice(0, 110));
}

/** One stick figure: a head with a face, a body, arms in a pose, legs; `s` is its scale and (cx, cy) where its feet are. */
export function figurePrims(cx: number, cy: number, s: number, expr: Expression, pose: 'wave' | 'up' | 'down' | 'point', color = '#1f2937'): Prim[] {
  const sw = Math.max(3, s * 0.12);
  const head = { x: cx, y: cy - 3.4 * s };
  const sh = { x: cx, y: cy - 2.5 * s };
  const hip = { x: cx, y: cy - 1.0 * s };
  const p: Prim[] = [
    { t: 'circle', x: head.x, y: head.y, r: 0.62 * s, fill: '#ffffff', stroke: color, sw },
    { t: 'line', x1: sh.x, y1: sh.y, x2: hip.x, y2: hip.y, stroke: color, sw },
    { t: 'line', x1: hip.x, y1: hip.y, x2: cx - 0.8 * s, y2: cy, stroke: color, sw },
    { t: 'line', x1: hip.x, y1: hip.y, x2: cx + 0.8 * s, y2: cy, stroke: color, sw },
  ];
  const arm = (dx: number, dy: number) => p.push({ t: 'line', x1: sh.x, y1: sh.y + 0.2 * s, x2: sh.x + dx * s, y2: sh.y + 0.2 * s + dy * s, stroke: color, sw });
  if (pose === 'wave') (arm(1.2, -1.1), arm(-1.0, 0.9));
  else if (pose === 'up') (arm(1.1, -1.2), arm(-1.1, -1.2));
  else if (pose === 'point') (arm(1.7, 0), arm(-0.9, 0.9));
  else (arm(1.0, 1.0), arm(-1.0, 1.0));
  const ey = head.y - 0.12 * s;
  const eye = expr === 'surprised' ? 0.1 * s : 0.07 * s;
  p.push({ t: 'circle', x: head.x - 0.22 * s, y: ey, r: eye, fill: color }, { t: 'circle', x: head.x + 0.22 * s, y: ey, r: eye, fill: color });
  const my = head.y + 0.2 * s;
  if (expr === 'happy' || expr === 'laugh') p.push({ t: 'arc', x: head.x, y: my - 0.12 * s, r: (expr === 'laugh' ? 0.3 : 0.24) * s, a0: 0.15 * Math.PI, a1: 0.85 * Math.PI, stroke: color, sw: Math.max(2, s * 0.08) });
  else if (expr === 'sad') p.push({ t: 'arc', x: head.x, y: my + 0.22 * s, r: 0.24 * s, a0: 1.15 * Math.PI, a1: 1.85 * Math.PI, stroke: color, sw: Math.max(2, s * 0.08) });
  else if (expr === 'surprised') p.push({ t: 'circle', x: head.x, y: my + 0.04 * s, r: 0.13 * s, stroke: color, sw: Math.max(2, s * 0.08) });
  else if (expr === 'angry') p.push({ t: 'line', x1: head.x - 0.38 * s, y1: ey - 0.22 * s, x2: head.x - 0.1 * s, y2: ey - 0.1 * s, stroke: color, sw: Math.max(2, s * 0.09) }, { t: 'line', x1: head.x + 0.38 * s, y1: ey - 0.22 * s, x2: head.x + 0.1 * s, y2: ey - 0.1 * s, stroke: color, sw: Math.max(2, s * 0.09) }, { t: 'line', x1: head.x - 0.2 * s, y1: my + 0.08 * s, x2: head.x + 0.2 * s, y2: my + 0.08 * s, stroke: color, sw: Math.max(2, s * 0.08) });
  else p.push({ t: 'line', x1: head.x - 0.18 * s, y1: my + 0.05 * s, x2: head.x + 0.22 * s, y2: my - 0.02 * s, stroke: color, sw: Math.max(2, s * 0.08) }, { t: 'circle', x: head.x + 0.9 * s, y: head.y - 0.9 * s, r: 0.1 * s, fill: '#cbd5e1' }, { t: 'circle', x: head.x + 1.25 * s, y: head.y - 1.2 * s, r: 0.16 * s, fill: '#cbd5e1' });
  return p;
}

export interface ComicPanel {
  caption: string;
  expression: Expression;
  scene: 'day' | 'night' | 'indoor' | 'rain';
  props: string[];
  names: string[];
}
export const PANEL_PROPS: [RegExp, string][] = [[/\b(?:car|drive|driving|road|taxi)\b/i, 'car'], [/\b(?:house|home|flat|door)\b/i, 'house'], [/\b(?:tree|park|garden|forest)\b/i, 'tree'], [/\b(?:love|heart|date|kiss)\b/i, 'heart'], [/\b(?:birthday|party|cake|balloon)\b/i, 'cake'], [/\b(?:phone|text|call|message)\b/i, 'phone']];
export const sceneOf = (t: string): ComicPanel['scene'] => (/\b(?:night|dark|moon|stars?|bed|sleep|midnight)\b/i.test(t) ? 'night' : /\b(?:rain\w*|storm\w*|wet|umbrella)\b/i.test(t) ? 'rain' : /\b(?:home|house|kitchen|room|office|sofa|table|desk|work|shop|school|inside|indoors)\b/i.test(t) ? 'indoor' : 'day');
export function comicPanels(captions: string[], names: string[]): ComicPanel[] {
  return captions.slice(0, 4).map((c) => ({ caption: c, expression: expressionOf(c), scene: sceneOf(c), props: PANEL_PROPS.filter(([re]) => re.test(c)).map(([, p]) => p).slice(0, 2), names: names.slice(0, 3) }));
}
export const COMIC_W = 1080;
export const COMIC_H = 1240;
const prop = (name: string, x: number, y: number, s: number): Prim[] => {
  switch (name) {
    case 'car': return [{ t: 'rect', x: x - 2.2 * s, y: y - 1.1 * s, w: 4.4 * s, h: 1.1 * s, fill: '#ef4444', r: s * 0.3 }, { t: 'rect', x: x - 1.2 * s, y: y - 1.9 * s, w: 2.4 * s, h: 0.9 * s, fill: '#fca5a5', r: s * 0.25 }, { t: 'circle', x: x - 1.3 * s, y, r: 0.45 * s, fill: '#111827' }, { t: 'circle', x: x + 1.3 * s, y, r: 0.45 * s, fill: '#111827' }];
    case 'house': return [{ t: 'rect', x: x - 1.6 * s, y: y - 2.2 * s, w: 3.2 * s, h: 2.2 * s, fill: '#fbbf24', stroke: '#92400e', sw: 3 }, { t: 'poly', pts: [[x - 2 * s, y - 2.2 * s], [x, y - 3.6 * s], [x + 2 * s, y - 2.2 * s]], fill: '#b45309' }, { t: 'rect', x: x - 0.35 * s, y: y - 1.2 * s, w: 0.7 * s, h: 1.2 * s, fill: '#78350f' }];
    case 'tree': return [{ t: 'rect', x: x - 0.25 * s, y: y - 1.6 * s, w: 0.5 * s, h: 1.6 * s, fill: '#78350f' }, { t: 'circle', x, y: y - 2.5 * s, r: 1.2 * s, fill: '#16a34a' }];
    case 'heart': return [{ t: 'poly', pts: Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * 2 * Math.PI; return [x + (s * 0.1 * 16 * Math.sin(a) ** 3) / 1.6, y - (s * 0.1 * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a))) / 1.6] as [number, number]; }), fill: '#ec4899' }];
    case 'cake': return [{ t: 'rect', x: x - 1.3 * s, y: y - 1.1 * s, w: 2.6 * s, h: 1.1 * s, fill: '#fcd34d', stroke: '#b45309', sw: 3 }, { t: 'rect', x: x - 1.3 * s, y: y - 1.1 * s, w: 2.6 * s, h: 0.35 * s, fill: '#f9a8d4' }, { t: 'rect', x: x - 0.06 * s, y: y - 1.8 * s, w: 0.12 * s, h: 0.7 * s, fill: '#3b82f6' }, { t: 'circle', x, y: y - 1.95 * s, r: 0.1 * s, fill: '#f97316' }];
    default: return [{ t: 'rect', x: x - 0.4 * s, y: y - 1.2 * s, w: 0.8 * s, h: 1.2 * s, fill: '#1f2937', r: s * 0.12 }, { t: 'rect', x: x - 0.3 * s, y: y - 1.05 * s, w: 0.6 * s, h: 0.8 * s, fill: '#7dd3fc' }];
  }
};
/** The whole strip as shapes: a page of four panels (a scene, figures with the face the caption calls for, a prop or two) with the captions under them. */
export function comicPrims(captions: string[], names: string[], seed = 1, measure: Measure = approxMeasure): { prims: Prim[]; w: number; h: number } {
  const panels = comicPanels(captions, names);
  const r = rng(seed);
  const prims: Prim[] = [];
  const pw = 500;
  const ph = 540;
  const art = 410;
  panels.forEach((p, i) => {
    const x0 = 30 + (i % 2) * (pw + 20);
    const y0 = 30 + Math.floor(i / 2) * (ph + 20);
    const sky = p.scene === 'night' ? '#1e293b' : p.scene === 'rain' ? '#cbd5e1' : p.scene === 'indoor' ? '#fef3c7' : '#bae6fd';
    const ground = p.scene === 'night' ? '#334155' : p.scene === 'indoor' ? '#d6a77a' : '#86efac';
    prims.push({ t: 'rect', x: x0, y: y0, w: pw, h: art, fill: sky }, { t: 'rect', x: x0, y: y0 + art - 70, w: pw, h: 70, fill: ground });
    if (p.scene === 'night') {
      prims.push({ t: 'circle', x: x0 + pw - 90, y: y0 + 80, r: 38, fill: '#fef9c3' });
      for (let k = 0; k < 6; k++) prims.push({ t: 'circle', x: x0 + 30 + r() * (pw - 160), y: y0 + 25 + r() * 110, r: 3, fill: '#f8fafc' });
    } else if (p.scene === 'rain') {
      for (let k = 0; k < 14; k++) {
        const rx = x0 + 20 + r() * (pw - 40);
        const ry = y0 + 20 + r() * (art - 130);
        prims.push({ t: 'line', x1: rx, y1: ry, x2: rx - 8, y2: ry + 22, stroke: '#64748b', sw: 3 });
      }
    } else if (p.scene === 'indoor') prims.push({ t: 'rect', x: x0 + 40, y: y0 + 40, w: 110, h: 90, fill: '#bae6fd', stroke: '#92400e', sw: 5 });
    else prims.push({ t: 'circle', x: x0 + pw - 80, y: y0 + 70, r: 36, fill: '#fde047' }, { t: 'circle', x: x0 + 120, y: y0 + 80, r: 22, fill: '#ffffff' }, { t: 'circle', x: x0 + 145, y: y0 + 72, r: 28, fill: '#ffffff' });
    const feet = y0 + art - 22;
    const n = Math.max(1, p.names.length);
    const s = n === 1 ? 52 : n === 2 ? 46 : 38;
    p.props.forEach((pr, k) => prims.push(...prop(pr, x0 + (k ? 0.2 : 0.8) * pw - (k ? 0 : 0), feet, 30)));
    for (let k = 0; k < n; k++) {
      const cx = x0 + pw * ((k + 1) / (n + 1)) + (p.props.length && n === 1 ? -80 : 0);
      prims.push(...figurePrims(cx, feet, s, p.expression, (['wave', 'up', 'point', 'down'] as const)[(i + k) % 4]!, p.scene === 'night' ? '#e2e8f0' : '#1f2937'));
      if (p.names[k]) prims.push({ t: 'text', x: cx, y: feet + 2, text: p.names[k]!.slice(0, 14), size: 20, fill: p.scene === 'night' ? '#e2e8f0' : '#1f2937', align: 'center', font: 'body' });
    }
    prims.push({ t: 'rect', x: x0, y: y0, w: pw, h: art, stroke: '#111827', sw: 6 }, { t: 'rect', x: x0, y: y0 + art, w: pw, h: ph - art, fill: '#ffffff', stroke: '#111827', sw: 6 });
    let sz = 30;
    let ls = wrap(p.caption, pw - 36, sz, measure, 400);
    while (sz > 18 && (ls.length * sz * 1.2 > ph - art - 16 || ls.some((l) => measure(l, sz, 400) > pw - 36))) {
      sz -= 2;
      ls = wrap(p.caption, pw - 36, sz, measure, 400);
    }
    ls.slice(0, 4).forEach((l, k) => prims.push({ t: 'text', x: x0 + pw / 2, y: y0 + art + 10 + k * sz * 1.2, text: l, size: sz, fill: '#111827', align: 'center', font: 'body' }));
  });
  prims.push({ t: 'text', x: COMIC_W / 2, y: COMIC_H - 62, text: 'Drawn by Ghosty in code: stick figures and shapes, not anyone’s art.', size: 24, fill: '#475569', align: 'center', font: 'body' });
  return { prims, w: COMIC_W, h: COMIC_H };
}

// ---------------------------------------------------------------- a logo in simple shapes

export interface LogoSpec {
  name: string;
  shape: 'circle' | 'square' | 'hex' | 'shield';
  icon: 'wave' | 'bolt' | 'star' | 'leaf' | 'mountain' | 'heart' | 'sun' | 'ring' | 'none';
  colours: [string, string, string];
}
const LOOKS: [RegExp, LogoSpec['shape'], LogoSpec['icon'], [string, string, string]][] = [
  [/calm|sea|water|ocean|spa|clean/, 'circle', 'wave', ['#0f4c81', '#e0f2fe', '#38bdf8']],
  [/bold|strong|power|gym|fast|sport/, 'hex', 'bolt', ['#7f1d1d', '#fff1f2', '#f59e0b']],
  [/nature|green|garden|eco|organic|farm|plant/, 'circle', 'leaf', ['#14532d', '#f0fdf4', '#a3e635']],
  [/playful|fun|kids|toy|party|happy/, 'circle', 'star', ['#7c3aed', '#fefce8', '#f472b6']],
  [/premium|luxury|classic|elegant|law|finance|boutique/, 'shield', 'ring', ['#111827', '#f8fafc', '#d4af37']],
  [/tech|code|digital|data|app|cyber|robot/, 'square', 'bolt', ['#0b1220', '#e2e8f0', '#22d3ee']],
  [/love|care|health|family|heart|friend/, 'circle', 'heart', ['#9d174d', '#fdf2f8', '#fb7185']],
  [/outdoor|adventure|climb|hike|travel|mountain/, 'shield', 'mountain', ['#1e3a5f', '#f1f5f9', '#f97316']],
  [/sun|bright|summer|energy|solar/, 'circle', 'sun', ['#b45309', '#fffbeb', '#facc15']],
];
export function logoSpec(name: string, vibe: string, seed = 0): LogoSpec {
  const look = LOOKS.find(([re]) => re.test(vibe.toLowerCase())) ?? LOOKS[hashSeed(`${name}:${seed}`) % LOOKS.length]!;
  const shapes: LogoSpec['shape'][] = ['circle', 'square', 'hex', 'shield'];
  return { name: name.trim().slice(0, 28) || 'Name', shape: seed ? shapes[hashSeed(`${name}:${seed}:s`) % 4]! : look[1], icon: look[2], colours: look[3] };
}
/** The logo as shapes on a square page: a shape in the dark colour, an icon in the accent, the name under it. */
export function logoPrims(spec: LogoSpec, measure: Measure = approxMeasure, size = 1000): { prims: Prim[]; bg: string; w: number; h: number } {
  const [dark, light, accent] = spec.colours;
  const cx = size / 2;
  const cy = size * 0.42;
  const R = size * 0.3;
  const prims: Prim[] = [];
  if (spec.shape === 'circle') prims.push({ t: 'circle', x: cx, y: cy, r: R, fill: dark });
  else if (spec.shape === 'square') prims.push({ t: 'rect', x: cx - R, y: cy - R, w: 2 * R, h: 2 * R, fill: dark, r: R * 0.22 });
  else if (spec.shape === 'hex') prims.push({ t: 'poly', pts: Array.from({ length: 6 }, (_, i) => [cx + R * 1.08 * Math.cos((i * Math.PI) / 3 + Math.PI / 6), cy + R * 1.08 * Math.sin((i * Math.PI) / 3 + Math.PI / 6)] as [number, number]), fill: dark });
  else prims.push({ t: 'poly', pts: [[cx - R, cy - R], [cx + R, cy - R], [cx + R, cy + R * 0.2], [cx, cy + R * 1.15], [cx - R, cy + R * 0.2]], fill: dark });
  const k = R * 0.5;
  switch (spec.icon) {
    case 'bolt': prims.push({ t: 'poly', pts: [[cx + 0.15 * k, cy - 1.5 * k], [cx - 0.9 * k, cy + 0.1 * k], [cx - 0.1 * k, cy + 0.1 * k], [cx - 0.3 * k, cy + 1.5 * k], [cx + 0.9 * k, cy - 0.2 * k], [cx + 0.1 * k, cy - 0.2 * k]], fill: accent }); break;
    case 'star': prims.push({ t: 'poly', pts: Array.from({ length: 10 }, (_, i) => [cx + (i % 2 ? 0.6 : 1.5) * k * Math.cos((i * Math.PI) / 5 - Math.PI / 2), cy + (i % 2 ? 0.6 : 1.5) * k * Math.sin((i * Math.PI) / 5 - Math.PI / 2)] as [number, number]), fill: accent }); break;
    case 'leaf': prims.push({ t: 'poly', pts: [[cx - 1.2 * k, cy + 1.2 * k], [cx - 1.4 * k, cy - 0.2 * k], [cx - 0.3 * k, cy - 1.4 * k], [cx + 1.3 * k, cy - 1.4 * k], [cx + 1.3 * k, cy + 0.1 * k], [cx + 0.2 * k, cy + 1.2 * k]], fill: accent }, { t: 'line', x1: cx - 1.1 * k, y1: cy + 1.2 * k, x2: cx + 0.7 * k, y2: cy - 0.8 * k, stroke: dark, sw: size * 0.012 }); break;
    case 'mountain': prims.push({ t: 'poly', pts: [[cx - 1.7 * k, cy + 1.1 * k], [cx - 0.5 * k, cy - 0.9 * k], [cx + 0.2 * k, cy + 0.1 * k], [cx + 0.8 * k, cy - 0.6 * k], [cx + 1.7 * k, cy + 1.1 * k]], fill: accent }); break;
    case 'heart': prims.push({ t: 'poly', pts: Array.from({ length: 28 }, (_, i) => { const a = (i / 28) * 2 * Math.PI; return [cx + (k * 0.095 * 16 * Math.sin(a) ** 3), cy - 0.2 * k - k * 0.095 * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a))] as [number, number]; }), fill: accent }); break;
    case 'sun': prims.push({ t: 'circle', x: cx, y: cy, r: 0.8 * k, fill: accent }, ...Array.from({ length: 8 }, (_, i) => ({ t: 'line' as const, x1: cx + 1.15 * k * Math.cos((i * Math.PI) / 4), y1: cy + 1.15 * k * Math.sin((i * Math.PI) / 4), x2: cx + 1.6 * k * Math.cos((i * Math.PI) / 4), y2: cy + 1.6 * k * Math.sin((i * Math.PI) / 4), stroke: accent, sw: size * 0.014 }))); break;
    case 'ring': prims.push({ t: 'circle', x: cx, y: cy, r: 1.2 * k, stroke: accent, sw: size * 0.02 }, { t: 'circle', x: cx, y: cy, r: 0.5 * k, fill: accent }); break;
    case 'wave': prims.push(...[-0.7, 0, 0.7].map((dy) => ({ t: 'arc' as const, x: cx, y: cy + dy * k + 1.1 * k, r: 1.3 * k, a0: 1.2 * Math.PI, a1: 1.8 * Math.PI, stroke: accent, sw: size * 0.02 }))); break;
    default: prims.push({ t: 'text', x: cx, y: cy - size * 0.13, text: spec.name.charAt(0).toUpperCase(), size: size * 0.26, fill: accent, align: 'center', weight: 700, font: 'display' });
  }
  let ns = size * 0.12;
  const name = spec.name.toUpperCase();
  while (ns > 30 && measure(name, ns, 700) > size * 0.84) ns -= 4;
  prims.push({ t: 'text', x: cx, y: size * 0.8, text: name, size: ns, fill: dark, align: 'center', weight: 700, font: 'display' });
  return { prims, bg: light, w: size, h: size };
}

// ---------------------------------------------------------------- a palette from a photo, or from a colour

const NAMED: [string, string][] = [['Red', '#e11d48'], ['Crimson', '#9f1239'], ['Orange', '#f97316'], ['Amber', '#f59e0b'], ['Yellow', '#facc15'], ['Lime', '#84cc16'], ['Green', '#22c55e'], ['Forest', '#166534'], ['Teal', '#0d9488'], ['Cyan', '#06b6d4'], ['Sky', '#38bdf8'], ['Blue', '#2563eb'], ['Navy', '#1e3a8a'], ['Indigo', '#4f46e5'], ['Purple', '#9333ea'], ['Violet', '#5b3aa8'], ['Pink', '#ec4899'], ['Magenta', '#c026d3'], ['Brown', '#78350f'], ['Tan', '#d2b48c'], ['Beige', '#e7d8c0'], ['White', '#fafafa'], ['Grey', '#9ca3af'], ['Charcoal', '#374151'], ['Black', '#0a0a0a'], ['Cream', '#fef3c7'], ['Olive', '#6b7a2a'], ['Maroon', '#7f1d1d'], ['Coral', '#fb7185'], ['Salmon', '#fda4af'], ['Sand', '#e9d5a1']];
const dist = (a: number[], b: number[]) => (a[0]! - b[0]!) ** 2 + (a[1]! - b[1]!) ** 2 + (a[2]! - b[2]!) ** 2;
/** The nearest plain name for a colour. */
export const colourName = (hex: string): string => NAMED.reduce((best, [n, h]) => (dist(rgbOf(hex), rgbOf(h)) < dist(rgbOf(hex), rgbOf(best[1])) ? [n, h] : best), NAMED[0]!)[0];
/** A colour he named or typed in his words ("#3a7bd5", "teal"), as hex; null when none. */
export function colourIn(words: string): string | null {
  const hex = /#([0-9a-f]{6}|[0-9a-f]{3})\b/i.exec(words);
  if (hex) return `#${hex[1]!.length === 3 ? [...hex[1]!].map((c) => c + c).join('') : hex[1]!}`.toLowerCase();
  const rgb = /rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)/i.exec(words);
  if (rgb) return hexOf(+rgb[1]!, +rgb[2]!, +rgb[3]!);
  const w = words.toLowerCase();
  return NAMED.find(([n]) => new RegExp(`\\b${n.toLowerCase()}\\b`).test(w))?.[1] ?? null;
}
export interface Swatch {
  hex: string;
  name: string;
  share: number;
  /** A readable text colour on it. */
  on: string;
}
/** The main colours of a picture (RGBA bytes, any size): k-means on a sample of its pixels, the biggest group first. The same pixels give the same palette. */
export function paletteOf(rgba: ArrayLike<number>, k = 5): Swatch[] {
  const pts: number[][] = [];
  const total = Math.floor(rgba.length / 4);
  const step = Math.max(1, Math.floor(total / 3000));
  for (let i = 0; i < total; i += step) if ((rgba[i * 4 + 3] ?? 255) >= 128) pts.push([rgba[i * 4]!, rgba[i * 4 + 1]!, rgba[i * 4 + 2]!]);
  if (!pts.length) return [];
  const r = rng(11);
  const cs: number[][] = [pts[Math.floor(r() * pts.length)]!];
  while (cs.length < Math.min(k, pts.length)) {
    const d = pts.map((p) => Math.min(...cs.map((c) => dist(p, c))));
    const sum = d.reduce((a, b) => a + b, 0);
    if (sum === 0) break;
    let t = r() * sum;
    let j = 0;
    while (j < d.length - 1 && (t -= d[j]!) > 0) j++;
    cs.push(pts[j]!);
  }
  const owner = new Array<number>(pts.length).fill(0);
  for (let it = 0; it < 10; it++) {
    pts.forEach((p, i) => {
      let b = 0;
      for (let c = 1; c < cs.length; c++) if (dist(p, cs[c]!) < dist(p, cs[b]!)) b = c;
      owner[i] = b;
    });
    cs.forEach((_, c) => {
      const mine = pts.filter((_p, i) => owner[i] === c);
      if (mine.length) cs[c] = [0, 1, 2].map((ch) => mine.reduce((a, p) => a + p[ch]!, 0) / mine.length);
    });
  }
  const counts = cs.map((_, c) => owner.filter((o) => o === c).length);
  const out = cs.map((c, i) => ({ c, n: counts[i]! })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  const merged: { c: number[]; n: number }[] = [];
  for (const x of out) {
    const near = merged.find((m) => dist(m.c, x.c) < 30 * 30);
    if (near) near.n += x.n;
    else merged.push({ ...x });
  }
  return merged.map((m) => {
    const hex = hexOf(m.c[0]!, m.c[1]!, m.c[2]!);
    return { hex, name: colourName(hex), share: Math.round((m.n / pts.length) * 100), on: contrast(hex, '#ffffff') >= contrast(hex, '#000000') ? '#ffffff' : '#000000' };
  });
}
const hsl = (hex: string): [number, number, number] => {
  const [r, g, b] = rgbOf(hex).map((v) => v / 255) as [number, number, number];
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const h = d === 0 ? 0 : mx === r ? ((g - b) / d + (g < b ? 6 : 0)) * 60 : mx === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
  return [h, s, l];
};
const fromHsl = (h: number, s: number, l: number): string => {
  const hh = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = hh < 60 ? [c, x, 0] : hh < 120 ? [x, c, 0] : hh < 180 ? [0, c, x] : hh < 240 ? [0, x, c] : hh < 300 ? [x, 0, c] : [c, 0, x];
  return hexOf((r + m) * 255, (g + m) * 255, (b + m) * 255);
};
/** Colours that go with one: its opposite, its neighbours, a triad and three shades — each a plain rule of the colour wheel. */
export function harmony(hex: string): Record<'complement' | 'analogous' | 'triad' | 'shades', string[]> {
  const [h, s, l] = hsl(hex);
  return {
    complement: [fromHsl(h + 180, s, l)],
    analogous: [fromHsl(h - 30, s, l), fromHsl(h + 30, s, l)],
    triad: [fromHsl(h + 120, s, l), fromHsl(h + 240, s, l)],
    shades: [fromHsl(h, s, Math.min(0.9, l + 0.25)), fromHsl(h, s, l), fromHsl(h, s, Math.max(0.1, l - 0.25))],
  };
}
