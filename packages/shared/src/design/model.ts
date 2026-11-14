/**
 * DESIGN (THE APPS ROUND, lane SITES): the model behind one free canvas for posters, invitations, cards, menus, stories, posts
 * and thumbnails. Pure data and pure functions, so the brain's tests check exactly what the phone draws: the sizes, the designed
 * templates (laid out in proportions, so each one fits every size), magic resize, snapping with guides, alignment, text wrapping,
 * and the exports (SVG, and a print PDF with bleed around a picture drawn on the phone). Nothing here reaches the network.
 */

export type LayerKind = 'text' | 'rect' | 'ellipse' | 'image' | 'line';
export type Align = 'left' | 'center' | 'right';
export type FontId = 'sans' | 'serif' | 'display' | 'round' | 'mono' | 'script' | 'condensed';

export interface Layer {
  id: string;
  kind: LayerKind;
  /** What the layers list calls it. */
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Degrees, clockwise, about the layer's centre. */
  rot: number;
  fill: string;
  opacity: number;
  stroke?: string;
  sw?: number;
  /** Corner radius for a rectangle, in canvas pixels. */
  radius?: number;
  text?: string;
  font?: FontId;
  size?: number;
  weight?: number;
  align?: Align;
  /** Line height as a multiple of the size. */
  lh?: number;
  /** Letter spacing in px. */
  ls?: number;
  upper?: boolean;
  /** A picture: a data URL made on the phone (his photo), never fetched by the model. */
  src?: string;
  /** A public picture's credit, kept with it and printed with every export (his rule: public images keep their credit). */
  credit?: string;
  locked?: boolean;
  hidden?: boolean;
}

export type SizeId = 'post' | 'story' | 'flyer' | 'a4' | 'invitation' | 'menu' | 'thumbnail' | 'card';
export interface Size {
  id: SizeId;
  name: string;
  w: number;
  h: number;
  /** The printed size in millimetres, for the PDF; screen sizes print at 96 px to the inch. */
  mm?: [number, number];
}
export const SIZES: Size[] = [
  { id: 'post', name: 'Square post', w: 1080, h: 1080 },
  { id: 'story', name: 'Story', w: 1080, h: 1920 },
  { id: 'thumbnail', name: 'Video thumbnail', w: 1280, h: 720 },
  { id: 'flyer', name: 'Flyer (A5)', w: 1748, h: 2480, mm: [148, 210] },
  { id: 'a4', name: 'Poster (A4)', w: 2480, h: 3508, mm: [210, 297] },
  { id: 'invitation', name: 'Invitation (5 × 7 in)', w: 1500, h: 2100, mm: [127, 178] },
  { id: 'menu', name: 'Menu (DL)', w: 1169, h: 2480, mm: [99, 210] },
  { id: 'card', name: 'Card (A6)', w: 1240, h: 1748, mm: [105, 148] },
];
export const sizeOf = (id: string): Size => SIZES.find((s) => s.id === id) ?? SIZES[0]!;

export const FONTS: Record<FontId, { name: string; css: string }> = {
  sans: { name: 'Clean', css: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  display: { name: 'Poster', css: "'Oswald', Impact, 'Arial Narrow', sans-serif" },
  serif: { name: 'Classic', css: "'New York', Georgia, 'Times New Roman', serif" },
  round: { name: 'Friendly', css: "ui-rounded, 'SF Pro Rounded', 'Nunito', system-ui, sans-serif" },
  condensed: { name: 'Narrow', css: "'Avenir Next Condensed', 'Arial Narrow', 'Roboto Condensed', sans-serif" },
  script: { name: 'Script', css: "'Snell Roundhand', 'Brush Script MT', 'Segoe Script', cursive" },
  mono: { name: 'Typewriter', css: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" },
};
export const isFont = (f: unknown): f is FontId => typeof f === 'string' && f in FONTS;

export interface Design {
  v: 1;
  id: string;
  name: string;
  size: SizeId;
  w: number;
  h: number;
  bg: string;
  layers: Layer[];
  at: number;
}

let seq = 0;
export const newId = (p = 'l'): string => `${p}${Date.now().toString(36)}${(seq++).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

/** A brand kit: his colours (the first is the main one) and two faces, one for headings and one for the rest. */
export interface Brand {
  colours: string[];
  head: FontId;
  body: FontId;
}
export const DEFAULT_BRAND: Brand = { colours: ['#64d2ff', '#0b1220', '#ffffff', '#ffd24d'], head: 'display', body: 'sans' };
const isHex = (s: unknown): s is string => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s);
export function readBrand(x: unknown): Brand {
  const b = (x ?? {}) as Partial<Brand>;
  const colours = Array.isArray(b.colours) ? b.colours.filter(isHex).slice(0, 8) : [];
  return { colours: colours.length ? colours : DEFAULT_BRAND.colours, head: isFont(b.head) ? b.head : DEFAULT_BRAND.head, body: isFont(b.body) ? b.body : DEFAULT_BRAND.body };
}

/** Relative luminance, and the contrast ratio between two colours (WCAG). */
const lum = (hex: string): number => {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
};
export const contrastOf = (a: string, b: string): number => {
  if (!isHex(a) || !isHex(b)) return 21;
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};
/** Black or white, whichever reads better on this colour. */
export const inkOn = (bg: string): string => (contrastOf(bg, '#000000') >= contrastOf(bg, '#ffffff') ? '#111111' : '#ffffff');

// ---------------------------------------------------------------- templates (laid out in proportions, so each fits every size)

/** A layer laid out in fractions of the page: x, y, w, h in 0..1; text size as a fraction of the page's shorter side. */
type Rel = Omit<Layer, 'id' | 'x' | 'y' | 'w' | 'h' | 'size' | 'radius'> & { x: number; y: number; w: number; h: number; size?: number; radius?: number };
export interface Template {
  id: string;
  name: string;
  /** Which occasion it is for (the gallery's filter). */
  for: string;
  /** The size it is drawn for first. */
  size: SizeId;
  bg: (b: Brand) => string;
  layers: (b: Brand) => Rel[];
}
const T = (name: string, text: string, o: Partial<Rel> & Pick<Rel, 'x' | 'y' | 'w' | 'h'>): Rel => ({ kind: 'text', name, text, rot: 0, fill: '#ffffff', opacity: 1, font: 'sans', size: 0.06, weight: 700, align: 'center', lh: 1.15, ...o });
const R = (name: string, o: Partial<Rel> & Pick<Rel, 'x' | 'y' | 'w' | 'h'>): Rel => ({ kind: 'rect', name, rot: 0, fill: '#ffffff', opacity: 1, ...o });
const E = (name: string, o: Partial<Rel> & Pick<Rel, 'x' | 'y' | 'w' | 'h'>): Rel => ({ kind: 'ellipse', name, rot: 0, fill: '#ffffff', opacity: 1, ...o });
const [c0, c1, c2, c3] = [(b: Brand) => b.colours[0] ?? '#64d2ff', (b: Brand) => b.colours[1] ?? '#0b1220', (b: Brand) => b.colours[2] ?? '#ffffff', (b: Brand) => b.colours[3] ?? b.colours[0] ?? '#ffd24d'];

export const TEMPLATES: Template[] = [
  {
    id: 'party', name: 'Birthday party', for: 'Birthday', size: 'invitation', bg: c1,
    layers: (b) => [
      E('Balloon', { x: 0.62, y: -0.08, w: 0.55, h: 0.4, fill: c0(b), opacity: 0.9 }),
      E('Balloon', { x: -0.15, y: 0.7, w: 0.5, h: 0.36, fill: c3(b), opacity: 0.85 }),
      T('Kicker', 'YOU’RE INVITED', { x: 0.1, y: 0.2, w: 0.8, h: 0.06, size: 0.04, fill: c0(b), font: b.body, weight: 700, ls: 6 }),
      T('Title', 'Sam is 30', { x: 0.08, y: 0.3, w: 0.84, h: 0.2, size: 0.17, fill: c2(b), font: b.head, lh: 1 }),
      T('When', 'Saturday 6 December · 8pm', { x: 0.1, y: 0.56, w: 0.8, h: 0.05, size: 0.045, fill: c2(b), font: b.body, weight: 600 }),
      T('Where', 'The Robin, Bilston', { x: 0.1, y: 0.62, w: 0.8, h: 0.05, size: 0.04, fill: c2(b), font: b.body, weight: 400, opacity: 0.85 }),
      T('RSVP', 'RSVP by 1 December', { x: 0.2, y: 0.8, w: 0.6, h: 0.05, size: 0.035, fill: c0(b), font: b.body, weight: 700 }),
    ],
  },
  {
    id: 'menu', name: 'Café menu', for: 'Menu', size: 'menu', bg: () => '#f6f1e7',
    layers: (b) => [
      T('Name', 'Little Fern', { x: 0.08, y: 0.06, w: 0.84, h: 0.08, size: 0.13, fill: '#1f2a1f', font: 'serif', weight: 700 }),
      R('Rule', { x: 0.3, y: 0.155, w: 0.4, h: 0.003, fill: c0(b) }),
      T('Section', 'BREAKFAST', { x: 0.08, y: 0.2, w: 0.84, h: 0.03, size: 0.05, fill: '#1f2a1f', font: b.body, weight: 700, ls: 4 }),
      T('Items', 'Eggs on sourdough  ·  £7.50\nPorridge, honey, pear  ·  £5.00\nFull breakfast  ·  £10.50', { x: 0.08, y: 0.25, w: 0.84, h: 0.16, size: 0.042, fill: '#2d3a2d', font: 'serif', weight: 400, lh: 1.6 }),
      T('Section', 'LUNCH', { x: 0.08, y: 0.46, w: 0.84, h: 0.03, size: 0.05, fill: '#1f2a1f', font: b.body, weight: 700, ls: 4 }),
      T('Items', 'Soup of the day  ·  £6.00\nToastie and slaw  ·  £8.00\nGarden salad  ·  £8.50', { x: 0.08, y: 0.51, w: 0.84, h: 0.16, size: 0.042, fill: '#2d3a2d', font: 'serif', weight: 400, lh: 1.6 }),
      T('Footer', 'Open 8 till 4 · Tuesday to Sunday', { x: 0.08, y: 0.9, w: 0.84, h: 0.03, size: 0.036, fill: '#2d3a2d', font: b.body, weight: 500 }),
    ],
  },
  {
    id: 'sale', name: 'Big sale', for: 'Sale', size: 'post', bg: c0,
    layers: (b) => [
      R('Band', { x: -0.1, y: 0.34, w: 1.2, h: 0.32, fill: c1(b), rot: -6 }),
      T('Title', 'SALE', { x: 0.05, y: 0.36, w: 0.9, h: 0.26, size: 0.24, fill: c2(b), font: b.head, lh: 1 }),
      T('Offer', 'Up to 50% off, this weekend only', { x: 0.1, y: 0.72, w: 0.8, h: 0.06, size: 0.05, fill: inkOn(c0(b)), font: b.body, weight: 700 }),
      T('Where', 'In store and at our stall', { x: 0.1, y: 0.8, w: 0.8, h: 0.05, size: 0.04, fill: inkOn(c0(b)), font: b.body, weight: 500, opacity: 0.85 }),
    ],
  },
  {
    id: 'event', name: 'Club night', for: 'Event', size: 'a4', bg: () => '#0a0a0f',
    layers: (b) => [
      E('Glow', { x: 0.1, y: 0.05, w: 0.8, h: 0.56, fill: c0(b), opacity: 0.35 }),
      T('Kicker', 'FRIDAY 12 DECEMBER', { x: 0.1, y: 0.12, w: 0.8, h: 0.04, size: 0.045, fill: c0(b), font: b.body, weight: 700, ls: 8 }),
      T('Title', 'Northern\nSoul Night', { x: 0.06, y: 0.2, w: 0.88, h: 0.3, size: 0.16, fill: '#ffffff', font: b.head, lh: 0.95 }),
      T('Lineup', 'All-nighter · Four DJs · Dancing till 3', { x: 0.1, y: 0.6, w: 0.8, h: 0.04, size: 0.04, fill: '#ffffff', font: b.body, weight: 600 }),
      R('Ticket', { x: 0.25, y: 0.75, w: 0.5, h: 0.07, fill: c0(b), radius: 0.035 }),
      T('Ticket text', '£10 on the door', { x: 0.25, y: 0.765, w: 0.5, h: 0.04, size: 0.045, fill: inkOn(c0(b)), font: b.body, weight: 800 }),
    ],
  },
  {
    id: 'quote', name: 'Quote', for: 'Social', size: 'post', bg: () => '#111318',
    layers: (b) => [
      T('Mark', '“', { x: 0.08, y: 0.06, w: 0.3, h: 0.25, size: 0.4, fill: c0(b), font: 'serif', align: 'left', lh: 1 }),
      T('Quote', 'Make something every day, even if it’s small.', { x: 0.1, y: 0.3, w: 0.8, h: 0.36, size: 0.08, fill: '#ffffff', font: 'serif', weight: 600, align: 'left', lh: 1.25 }),
      T('Who', '— Your name', { x: 0.1, y: 0.76, w: 0.8, h: 0.05, size: 0.045, fill: c0(b), font: b.body, weight: 600, align: 'left' }),
    ],
  },
  {
    id: 'thumb', name: 'Video thumbnail', for: 'Social', size: 'thumbnail', bg: c3,
    layers: (b) => [
      R('Panel', { x: 0.52, y: 0, w: 0.48, h: 1, fill: c1(b) }),
      T('Title', 'I built a\ngame in a day', { x: 0.04, y: 0.18, w: 0.5, h: 0.6, size: 0.14, fill: inkOn(c3(b)), font: b.head, align: 'left', lh: 1 }),
      E('Badge', { x: 0.64, y: 0.24, w: 0.26, h: 0.46, fill: c0(b) }),
      T('Badge text', 'NEW', { x: 0.64, y: 0.4, w: 0.26, h: 0.12, size: 0.1, fill: inkOn(c0(b)), font: b.head }),
    ],
  },
  {
    id: 'story', name: 'Announcement', for: 'Social', size: 'story', bg: c1,
    layers: (b) => [
      R('Card', { x: 0.08, y: 0.25, w: 0.84, h: 0.5, fill: c2(b), radius: 0.04 }),
      T('Kicker', 'BIG NEWS', { x: 0.12, y: 0.3, w: 0.76, h: 0.04, size: 0.05, fill: c0(b), font: b.body, weight: 800, ls: 6 }),
      T('Title', 'We’re opening\na second shop', { x: 0.12, y: 0.37, w: 0.76, h: 0.2, size: 0.11, fill: c1(b), font: b.head, lh: 1.05 }),
      T('When', 'From 1 March, on the high street', { x: 0.12, y: 0.62, w: 0.76, h: 0.05, size: 0.045, fill: c1(b), font: b.body, weight: 500 }),
    ],
  },
  {
    id: 'thanks', name: 'Thank you card', for: 'Thank you', size: 'card', bg: () => '#fffaf3',
    layers: (b) => [
      R('Frame', { x: 0.06, y: 0.045, w: 0.88, h: 0.91, fill: '#fffaf3', stroke: c0(b), sw: 0.008, radius: 0.02 }),
      T('Title', 'Thank you', { x: 0.1, y: 0.32, w: 0.8, h: 0.2, size: 0.17, fill: '#2a2320', font: 'script', weight: 400, lh: 1 }),
      T('Line', 'for everything this year', { x: 0.1, y: 0.56, w: 0.8, h: 0.05, size: 0.05, fill: '#2a2320', font: 'serif', weight: 400 }),
      E('Heart', { x: 0.45, y: 0.7, w: 0.1, h: 0.07, fill: c0(b) }),
    ],
  },
  {
    id: 'garage', name: 'Garage sale', for: 'Sale', size: 'flyer', bg: () => '#ffd24d',
    layers: () => [
      T('Title', 'GARAGE\nSALE', { x: 0.06, y: 0.1, w: 0.88, h: 0.36, size: 0.2, fill: '#111111', font: 'display', lh: 0.95 }),
      R('Rule', { x: 0.06, y: 0.5, w: 0.88, h: 0.006, fill: '#111111' }),
      T('When', 'Sunday 9am till 1pm', { x: 0.06, y: 0.55, w: 0.88, h: 0.05, size: 0.06, fill: '#111111', font: 'sans', weight: 800 }),
      T('What', 'Books · toys · tools · bikes · plants', { x: 0.06, y: 0.63, w: 0.88, h: 0.05, size: 0.045, fill: '#111111', font: 'sans', weight: 500 }),
      T('Where', '12 Elm Road', { x: 0.06, y: 0.8, w: 0.88, h: 0.06, size: 0.07, fill: '#111111', font: 'display' }),
    ],
  },
  {
    id: 'blank', name: 'Blank', for: 'Any', size: 'post', bg: () => '#ffffff',
    layers: () => [],
  },
];
export const OCCASIONS = [...new Set(TEMPLATES.map((t) => t.for))];

/** A template made at a size: proportions turned into pixels, text sized from the page's shorter side. */
export function fromTemplate(t: Template, sizeId: SizeId = t.size, brand: Brand = DEFAULT_BRAND, name = t.name): Design {
  const s = sizeOf(sizeId);
  const short = Math.min(s.w, s.h);
  const layers = t.layers(brand).map((r) => {
    const l: Layer = { ...r, id: newId(), x: Math.round(r.x * s.w), y: Math.round(r.y * s.h), w: Math.round(r.w * s.w), h: Math.round(r.h * s.h) } as Layer;
    if (r.size !== undefined) l.size = Math.max(8, Math.round(r.size * short));
    if (r.radius !== undefined) l.radius = Math.round(r.radius * short);
    if (r.sw !== undefined) l.sw = Math.max(1, Math.round(r.sw * short));
    if (r.ls !== undefined) l.ls = r.ls * (short / 1080);
    if (l.kind === 'text') l.h = Math.max(l.h, Math.round((l.size ?? 40) * (l.lh ?? 1.2) * Math.max(1, (l.text ?? '').split('\n').length)));
    return l;
  });
  return { v: 1, id: newId('d'), name, size: s.id, w: s.w, h: s.h, bg: t.bg(brand), layers, at: Date.now() };
}

/** Magic resize: the same design at another size, each part kept in its place and in proportion; a full-page part fills the new page. */
export function magicResize(d: Design, sizeId: SizeId): Design {
  const s = sizeOf(sizeId);
  const sx = s.w / d.w;
  const sy = s.h / d.h;
  const k = Math.min(sx, sy);
  const layers = d.layers.map((l) => {
    const full = l.x <= 0 && l.y <= 0 && l.x + l.w >= d.w && l.y + l.h >= d.h;
    if (full) return { ...l, x: 0, y: 0, w: s.w, h: s.h };
    // its centre keeps its place on the page; its shape keeps its proportions (text and pictures never stretch)
    const cx = (l.x + l.w / 2) * sx;
    const cy = (l.y + l.h / 2) * sy;
    const wide = l.kind === 'text' ? Math.min(s.w, l.w * Math.max(k, Math.min(sx, 1.6 * k))) : l.w * k;
    const w = Math.round(wide);
    const h = Math.round(l.h * k);
    const out: Layer = { ...l, x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h };
    if (l.size) out.size = Math.max(8, Math.round(l.size * k));
    if (l.radius) out.radius = Math.round(l.radius * k);
    if (l.sw) out.sw = Math.max(1, Math.round(l.sw * k));
    if (l.ls) out.ls = l.ls * k;
    return out;
  });
  return { ...d, id: newId('d'), size: s.id, w: s.w, h: s.h, layers, name: `${d.name} (${s.name})`, at: Date.now() };
}

// ---------------------------------------------------------------- snapping, alignment, order

export interface Guide {
  axis: 'x' | 'y';
  at: number;
}
/** Where a moving box snaps: to the page's edges and centre, and to every other visible part's edges and centre. */
export function snapBox(d: Design, id: string, box: { x: number; y: number; w: number; h: number }, tol: number): { x: number; y: number; guides: Guide[] } {
  const xs = [0, d.w / 2, d.w];
  const ys = [0, d.h / 2, d.h];
  for (const l of d.layers) {
    if (l.id === id || l.hidden) continue;
    xs.push(l.x, l.x + l.w / 2, l.x + l.w);
    ys.push(l.y, l.y + l.h / 2, l.y + l.h);
  }
  const best = (edges: number[], lines: number[]): { d: number; at: number } | null => {
    let out: { d: number; at: number } | null = null;
    for (const e of edges) for (const at of lines) {
      const dd = at - e;
      if (Math.abs(dd) <= tol && (!out || Math.abs(dd) < Math.abs(out.d))) out = { d: dd, at };
    }
    return out;
  };
  const bx = best([box.x, box.x + box.w / 2, box.x + box.w], xs);
  const by = best([box.y, box.y + box.h / 2, box.y + box.h], ys);
  const guides: Guide[] = [];
  if (bx) guides.push({ axis: 'x', at: bx.at });
  if (by) guides.push({ axis: 'y', at: by.at });
  return { x: box.x + (bx?.d ?? 0), y: box.y + (by?.d ?? 0), guides };
}

export type AlignHow = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
/** Line parts up on the page (one part) or on the box around them (several). */
export function alignLayers(d: Design, ids: string[], how: AlignHow): Design {
  const sel = d.layers.filter((l) => ids.includes(l.id) && !l.locked);
  if (!sel.length) return d;
  const box = sel.length === 1 ? { x: 0, y: 0, w: d.w, h: d.h } : (() => {
    const x = Math.min(...sel.map((l) => l.x));
    const y = Math.min(...sel.map((l) => l.y));
    return { x, y, w: Math.max(...sel.map((l) => l.x + l.w)) - x, h: Math.max(...sel.map((l) => l.y + l.h)) - y };
  })();
  const layers = d.layers.map((l) => {
    if (!sel.includes(l)) return l;
    const n = { ...l };
    if (how === 'left') n.x = box.x;
    if (how === 'center') n.x = Math.round(box.x + (box.w - l.w) / 2);
    if (how === 'right') n.x = box.x + box.w - l.w;
    if (how === 'top') n.y = box.y;
    if (how === 'middle') n.y = Math.round(box.y + (box.h - l.h) / 2);
    if (how === 'bottom') n.y = box.y + box.h - l.h;
    return n;
  });
  return { ...d, layers };
}

/** Move a part up or down the stack (the last is on top), or to the very top or bottom. */
export function reorder(d: Design, id: string, to: 'up' | 'down' | 'top' | 'bottom'): Design {
  const i = d.layers.findIndex((l) => l.id === id);
  if (i < 0) return d;
  const layers = [...d.layers];
  const [l] = layers.splice(i, 1);
  const j = to === 'top' ? layers.length : to === 'bottom' ? 0 : Math.max(0, Math.min(layers.length, i + (to === 'up' ? 1 : -1)));
  layers.splice(j, 0, l!);
  return { ...d, layers };
}

// ---------------------------------------------------------------- text

export type Measure = (text: string, l: Layer) => number;
/** A text part's lines: his own line breaks kept, and each one wrapped to the part's width. */
export function wrapText(l: Layer, measure: Measure): string[] {
  const raw = l.upper ? (l.text ?? '').toUpperCase() : (l.text ?? '');
  const out: string[] = [];
  for (const para of raw.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push('');
      continue;
    }
    let line = words[0]!;
    for (const w of words.slice(1)) {
      const next = `${line} ${w}`;
      if (measure(next, l) <= l.w) line = next;
      else {
        out.push(line);
        line = w;
      }
    }
    out.push(line);
  }
  return out;
}

// ---------------------------------------------------------------- the store's checks

/** A design read back from the phone's storage: anything malformed is dropped, never drawn. */
export function readDesign(x: unknown): Design | null {
  const d = x as Design;
  if (!d || typeof d !== 'object' || d.v !== 1 || typeof d.id !== 'string' || !Array.isArray(d.layers)) return null;
  const n = (v: unknown, dflt = 0) => (Number.isFinite(v) ? (v as number) : dflt);
  const s = sizeOf(d.size);
  const layers = d.layers
    .filter((l) => l && typeof l === 'object' && ['text', 'rect', 'ellipse', 'image', 'line'].includes(l.kind))
    .map((l) => ({ ...l, id: typeof l.id === 'string' ? l.id : newId(), name: typeof l.name === 'string' ? l.name.slice(0, 40) : l.kind, x: n(l.x), y: n(l.y), w: Math.max(1, n(l.w, 100)), h: Math.max(1, n(l.h, 100)), rot: n(l.rot), opacity: Math.max(0, Math.min(1, n(l.opacity, 1))), fill: typeof l.fill === 'string' ? l.fill : '#000000', ...(l.src !== undefined && !(typeof l.src === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(l.src)) ? { src: undefined } : {}) }));
  return { v: 1, id: d.id, name: typeof d.name === 'string' ? d.name.slice(0, 80) : 'Untitled design', size: s.id, w: n(d.w, s.w), h: n(d.h, s.h), bg: typeof d.bg === 'string' ? d.bg : '#ffffff', layers, at: n(d.at, Date.now()) };
}

/** Every public picture's credit, in the order the parts sit (his rule: public images keep their credit). */
export const creditsOf = (d: Design): string[] => [...new Set(d.layers.filter((l) => !l.hidden && l.credit).map((l) => l.credit!))];

// ---------------------------------------------------------------- exports

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const safeFill = (s: string | undefined) => (s && /^(#[0-9a-f]{3,8}|transparent|none)$/i.test(s) ? s : '#000000');

/** The design as an SVG: shapes as shapes, text as text (wrapped as on the phone), pictures embedded, credits as metadata. */
export function toSvg(d: Design, measure: Measure): string {
  const parts = d.layers.filter((l) => !l.hidden).map((l) => {
    const cx = l.x + l.w / 2;
    const cy = l.y + l.h / 2;
    const t = l.rot ? ` transform="rotate(${l.rot} ${cx} ${cy})"` : '';
    const op = l.opacity < 1 ? ` opacity="${l.opacity}"` : '';
    const st = l.stroke && l.sw ? ` stroke="${safeFill(l.stroke)}" stroke-width="${l.sw}"` : '';
    if (l.kind === 'rect') return `<rect x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}"${l.radius ? ` rx="${l.radius}"` : ''} fill="${safeFill(l.fill)}"${st}${op}${t}/>`;
    if (l.kind === 'ellipse') return `<ellipse cx="${cx}" cy="${cy}" rx="${l.w / 2}" ry="${l.h / 2}" fill="${safeFill(l.fill)}"${st}${op}${t}/>`;
    if (l.kind === 'line') return `<line x1="${l.x}" y1="${cy}" x2="${l.x + l.w}" y2="${cy}" stroke="${safeFill(l.fill)}" stroke-width="${Math.max(1, l.h)}" stroke-linecap="round"${op}${t}/>`;
    if (l.kind === 'image') return l.src ? `<image href="${esc(l.src)}" x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" preserveAspectRatio="xMidYMid slice"${op}${t}/>` : '';
    const size = l.size ?? 40;
    const lh = size * (l.lh ?? 1.2);
    const lines = wrapText(l, measure);
    const anchor = l.align === 'left' ? 'start' : l.align === 'right' ? 'end' : 'middle';
    const ax = l.align === 'left' ? l.x : l.align === 'right' ? l.x + l.w : cx;
    const top = l.y + (l.h - lh * lines.length) / 2 + lh / 2;
    const spans = lines.map((s, i) => `<tspan x="${ax}" y="${(top + i * lh).toFixed(1)}">${esc(s)}</tspan>`).join('');
    return `<text font-family="${esc(FONTS[l.font ?? 'sans'].css)}" font-size="${size}" font-weight="${l.weight ?? 400}" fill="${safeFill(l.fill)}" text-anchor="${anchor}" dominant-baseline="central"${l.ls ? ` letter-spacing="${l.ls}"` : ''}${op}${t}>${spans}</text>`;
  });
  const credits = creditsOf(d);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d.w} ${d.h}" width="${d.w}" height="${d.h}"><title>${esc(d.name)}</title>${credits.length ? `<desc>Pictures: ${esc(credits.join('; '))}</desc>` : ''}<rect width="${d.w}" height="${d.h}" fill="${safeFill(d.bg)}"/>${parts.join('')}</svg>`;
}

/** Points in a millimetre, and the bleed a printer asks for (3 mm each side). */
export const PT_PER_MM = 72 / 25.4;
export const BLEED_MM = 3;
/** The printed size in points: a print size from its millimetres, a screen size at 96 px to the inch. */
export const printSize = (d: Design): { w: number; h: number } => {
  const mm = sizeOf(d.size).mm;
  return mm && d.size === sizeOf(d.size).id && Math.abs(d.w / d.h - mm[0] / mm[1]) < 0.02 ? { w: mm[0] * PT_PER_MM, h: mm[1] * PT_PER_MM } : { w: (d.w * 72) / 96, h: (d.h * 72) / 96 };
};

/**
 * A one-page print PDF around a JPEG of the page drawn with its bleed: the MediaBox is the trimmed size plus the bleed on every side,
 * the TrimBox the finished size, so a printer cuts it clean. The JPEG must already include the bleed (the page's edges extended).
 */
export function pdfOf(jpeg: Uint8Array, imgW: number, imgH: number, trim: { w: number; h: number }, bleedPt: number, title: string): Uint8Array {
  const W = trim.w + bleedPt * 2;
  const H = trim.h + bleedPt * 2;
  const f = (n: number) => n.toFixed(2);
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let len = 0;
  const put = (x: string | Uint8Array) => {
    const b = typeof x === 'string' ? enc.encode(x) : x;
    chunks.push(b);
    len += b.length;
  };
  const obj = (n: number, body: string | (() => void)) => {
    offsets[n] = len;
    put(`${n} 0 obj\n`);
    if (typeof body === 'string') put(body);
    else body();
    put('\nendobj\n');
  };
  const pdfText = (s: string) => `(${s.replace(/[\\()]/g, (c) => `\\${c}`).replace(/[^\x20-\x7e]/g, '')})`;
  put('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
  const content = `q ${f(W)} 0 0 ${f(H)} 0 0 cm /Im0 Do Q`;
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(W)} ${f(H)}] /BleedBox [0 0 ${f(W)} ${f(H)}] /TrimBox [${f(bleedPt)} ${f(bleedPt)} ${f(W - bleedPt)} ${f(H - bleedPt)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  obj(4, () => {
    put(`<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    put(jpeg);
    put('\nendstream');
  });
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  obj(6, `<< /Title ${pdfText(title)} /Producer (Ghosty Design) >>`);
  const xref = len;
  put(`xref\n0 7\n0000000000 65535 f \n${[1, 2, 3, 4, 5, 6].map((n) => `${String(offsets[n]).padStart(10, '0')} 00000 n \n`).join('')}`);
  put(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(len);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/** The page for his sites: the design as one picture with its words as the alt text, and every credit under it. */
export function sitePageOf(d: Design, pictureUrl: string, words: string): string {
  const credits = creditsOf(d);
  return `<!doctype html>\n<html lang="en-GB">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${esc(d.name)}</title>\n<style>body{margin:0;background:#111;color:#eee;font:16px/1.5 system-ui,sans-serif;display:flex;flex-direction:column;align-items:center}img{display:block;width:100%;max-width:${Math.min(d.w, 1080)}px;height:auto}p{margin:12px 16px;font-size:14px;opacity:.8}.vh{position:absolute;left:-9999px}</style>\n</head>\n<body>\n<main>\n<h1 class="vh">${esc(d.name)}</h1>\n<img src="${esc(pictureUrl)}" width="${d.w}" height="${d.h}" alt="${esc(words.slice(0, 300) || d.name)}">\n${credits.length ? `<p>Pictures: ${esc(credits.join('; '))}</p>\n` : ''}</main>\n</body>\n</html>\n`;
}

/** All the words on the page, top to bottom, for the alt text and for search. */
export const wordsOf = (d: Design): string => d.layers.filter((l) => l.kind === 'text' && !l.hidden).sort((a, b) => a.y - b.y || a.x - b.x).map((l) => (l.text ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean).join('. ');
