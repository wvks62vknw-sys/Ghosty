/**
 * PRESENTATIONS (BRIEF-EDITOR-PRESENTATIONS): the deck as the phone keeps it. A deck has a theme and a master (titles set left or
 * centred, a foot with the deck's name, the slide's number) and slides; a slide has a layout (title, title and bullets, two columns,
 * picture with a caption, chart, table, quote, section, blank), its words as the documents' own blocks and runs (so bold, italic,
 * underline, links and lists are the same code), at most one picture, chart or table, one or two shapes, speaker notes, a
 * transition and the order its parts come in on a tap. The picture is the documents' store's (docs/images.ts: shrunk to 1,280 px,
 * kept on the phone, never sent), a table is the documents' table block, a chart is the numbers it draws. A history for undo, sixty
 * deep. Pure: apps/edge/test/slides.test.mjs.
 */
import { block, blockId, textOf, type Block, type Run } from '../docs/model';
import type { Palette } from './themes';

export type Layout = 'title' | 'bullets' | 'two' | 'picture' | 'chart' | 'table' | 'quote' | 'section' | 'blank';
export const LAYOUTS: { id: Layout; name: string; line: string }[] = [
  { id: 'title', name: 'Title', line: 'A big title and a line under it' },
  { id: 'bullets', name: 'Bullets', line: 'A title and a list' },
  { id: 'two', name: 'Two columns', line: 'A title and two lists side by side' },
  { id: 'picture', name: 'Picture', line: 'A picture with a caption' },
  { id: 'chart', name: 'Chart', line: 'A title and a chart of your numbers' },
  { id: 'table', name: 'Table', line: 'A title and a table' },
  { id: 'quote', name: 'Quote', line: 'One quotation and who said it' },
  { id: 'section', name: 'Section', line: 'A new part of the talk' },
  { id: 'blank', name: 'Blank', line: 'Nothing but what you add' },
];

export interface ChartData {
  kind: 'bars' | 'line';
  points: { label: string; value: number }[];
  /** "£", "%", "kg" … ('' when none). */
  unit: string;
  /** The unit goes before the figure. */
  before: boolean;
}
export type Media = { k: 'img'; img: string; alt: string; iw: number; ih: number } | { k: 'chart'; chart: ChartData } | { k: 'table'; table: Block };
export type ShapeKind = 'rect' | 'round' | 'ellipse' | 'arrow' | 'line';
export interface Shape {
  id: string;
  kind: ShapeKind;
  /** On the 1,280 × 720 slide. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Which colour of the theme's sequence (0 to 4). */
  fill: number;
}
export type Elem = 'title' | 'body' | 'body2' | 'media' | 'shape0' | 'shape1';
export type Anim = 'appear' | 'fade' | 'rise';
export interface Build {
  el: Elem;
  how: Anim;
}
export type Transition = 'none' | 'fade' | 'push';
export interface Slide {
  id: string;
  layout: Layout;
  title: Block;
  body: Block[];
  body2: Block[];
  media?: Media;
  shapes: Shape[];
  notes: string;
  transition: Transition;
  builds: Build[];
}
export interface Master {
  align: 'left' | 'center';
  footer: boolean;
  numbers: boolean;
}
export interface Deck {
  id: string;
  title: string;
  theme: string;
  /** The colours a file brought, until a theme of ours is picked. */
  palette?: Palette;
  master: Master;
  slides: Slide[];
  /** Last changed (ms). */
  at: number;
  /** Where it came from: "written with Ghosty", a file's name, "a report". */
  from?: string;
}

export const W = 1280;
export const H = 720;
export const DEFAULT_MASTER: Master = { align: 'left', footer: true, numbers: true };

let seq = 0;
const uid = (p: string): string => `${p}${Date.now().toString(36)}${(++seq).toString(36)}`;
export const SHAPE_NAMES: Record<ShapeKind, string> = { rect: 'Rectangle', round: 'Rounded', ellipse: 'Ellipse', arrow: 'Arrow', line: 'Line' };
export const ANIMS: Anim[] = ['appear', 'fade', 'rise'];
export const TRANSITIONS: Transition[] = ['none', 'fade', 'push'];

export const bullets = (lines: string[]): Block[] => lines.map((l) => block('ul', l));
export const plainOf = (blocks: Block[]): string => blocks.map(textOf).join('\n');

export function newSlide(layout: Layout, over: Partial<Slide> = {}): Slide {
  return { id: uid('s'), layout, title: block('h1', ''), body: [], body2: [], shapes: [], notes: '', transition: 'none', builds: [], ...over };
}
export function newDeck(title: string, slides: Slide[], from = ''): Deck {
  return { id: uid('k'), title: title.trim() || 'Untitled deck', theme: 'ghosty', master: { ...DEFAULT_MASTER }, slides, at: Date.now(), ...(from ? { from } : {}) };
}
/** A blank deck: a title slide and a slide of bullets, both empty, for him to type into. */
export const blankDeck = (): Deck => newDeck('New deck', [newSlide('title'), newSlide('bullets')], 'written with Ghosty');

export const slideTitle = (s: Slide): string => textOf(s.title).trim();
/** What a slide says in a line (its title, else the first words it has, else its layout's name). */
export function slideName(s: Slide, n?: number): string {
  const t = slideTitle(s) || plainOf(s.body).split('\n')[0]?.trim() || plainOf(s.body2).split('\n')[0]?.trim() || '';
  return t || `${LAYOUTS.find((l) => l.id === s.layout)?.name ?? 'Slide'}${n ? ` ${n}` : ''}`;
}
/** Every word a slide holds, one line each (title, text, a table's cells, a chart's labels), for finding and for the tests. */
export function slideWords(s: Slide): string[] {
  const out = [slideTitle(s), ...s.body.map(textOf), ...s.body2.map(textOf)];
  if (s.media?.k === 'table') out.push(...(s.media.table.rows ?? []).map((r) => r.map((c) => c.map((x) => x.text).join('')).join('\t')));
  if (s.media?.k === 'chart') out.push(...s.media.chart.points.map((p) => `${p.label}\t${p.value}`));
  if (s.media?.k === 'img') out.push(s.media.alt);
  return out.filter((x) => x.trim());
}
export const deckWords = (d: Deck): number => d.slides.reduce((n, s) => n + slideWords(s).join(' ').split(/\s+/).filter(Boolean).length, 0);

// ---------------------------------------------------------------- changing a deck (each returns a new deck)

export const withSlide = (d: Deck, id: string, f: (s: Slide) => Slide): Deck => ({ ...d, slides: d.slides.map((s) => (s.id === id ? f(s) : s)) });
export const indexOf = (d: Deck, id: string): number => d.slides.findIndex((s) => s.id === id);
export function insertSlide(d: Deck, at: number, s: Slide): Deck {
  const slides = [...d.slides];
  slides.splice(Math.max(0, Math.min(slides.length, at)), 0, s);
  return { ...d, slides };
}
export function removeSlide(d: Deck, id: string): Deck {
  return { ...d, slides: d.slides.filter((s) => s.id !== id) };
}
/** A copy of a slide, with ids of its own, right after it. */
export function duplicateSlide(d: Deck, id: string): { deck: Deck; copy: Slide | null } {
  const at = indexOf(d, id);
  if (at < 0) return { deck: d, copy: null };
  const src = d.slides[at]!;
  const copy: Slide = JSON.parse(JSON.stringify(src));
  copy.id = uid('s');
  copy.title.id = blockId();
  for (const b of [...copy.body, ...copy.body2]) b.id = blockId();
  for (const sh of copy.shapes) sh.id = uid('h');
  if (copy.media?.k === 'table') copy.media.table.id = blockId();
  return { deck: insertSlide(d, at + 1, copy), copy };
}
/** A slide moved from one place to another (a drag, MOVE UP, MOVE DOWN). */
export function moveSlide(d: Deck, from: number, to: number): Deck {
  if (from < 0 || from >= d.slides.length) return d;
  const t = Math.max(0, Math.min(d.slides.length - 1, to));
  if (t === from) return d;
  const slides = [...d.slides];
  const [s] = slides.splice(from, 1);
  slides.splice(t, 0, s!);
  return { ...d, slides };
}

/** What a layout can hold: which of title, body, body2 and media it shows. */
export const SLOTS: Record<Layout, { title: boolean; body: boolean; body2: boolean; media: boolean }> = {
  title: { title: true, body: true, body2: false, media: false },
  bullets: { title: true, body: true, body2: false, media: false },
  two: { title: true, body: true, body2: true, media: false },
  picture: { title: true, body: true, body2: false, media: true },
  chart: { title: true, body: false, body2: false, media: true },
  table: { title: true, body: false, body2: false, media: true },
  quote: { title: true, body: true, body2: false, media: false },
  section: { title: true, body: true, body2: false, media: false },
  blank: { title: false, body: false, body2: false, media: false },
};
/** The layout a kind of media sits best in. */
export const LAYOUT_OF: Record<Media['k'], Layout> = { img: 'picture', chart: 'chart', table: 'table' };

/** Put a picture, chart or table on a slide (one at most: it takes the place of the last). A layout with no room for it becomes the one made for it; bullets and two columns keep their words and give it the right half. */
export function setMedia(s: Slide, media: Media | undefined): Slide {
  let layout = s.layout;
  if (media && !['bullets', 'two', 'picture', 'chart', 'table'].includes(layout)) layout = LAYOUT_OF[media.k];
  else if (media && ['picture', 'chart', 'table'].includes(layout)) layout = LAYOUT_OF[media.k];
  return tidyBuilds({ ...s, layout, media });
}
/** A slide's elements as it holds them now, in the order they are drawn. */
export function elements(s: Slide): Elem[] {
  const out: Elem[] = [];
  const slots = SLOTS[s.layout];
  if (slots.title) out.push('title');
  if (slots.body) out.push('body');
  if (slots.body2) out.push('body2');
  if (s.media) out.push('media');
  s.shapes.forEach((_, i) => out.push(i === 0 ? 'shape0' : 'shape1'));
  return out;
}
/** The builds that still name an element the slide has. */
export function tidyBuilds(s: Slide): Slide {
  const have = new Set(elements(s));
  const builds = s.builds.filter((b, i) => have.has(b.el) && s.builds.findIndex((x) => x.el === b.el) === i);
  return builds.length === s.builds.length ? s : { ...s, builds };
}
export function setLayout(s: Slide, layout: Layout): Slide {
  let next: Slide = { ...s, layout };
  // a layout of two columns keeps the words it had on the right; leaving it folds them back in under the first column
  if (s.layout === 'two' && layout !== 'two' && s.body2.length) next = { ...next, body: [...s.body, ...s.body2], body2: [] };
  // a media layout with the wrong kind of media drops nothing: the media stays and is drawn in its half
  return tidyBuilds(next);
}
export function addShape(s: Slide, kind: ShapeKind): Slide | null {
  if (s.shapes.length >= 2) return null;
  const n = s.shapes.length;
  const sh: Shape = kind === 'line' ? { id: uid('h'), kind, x: 160 + n * 80, y: 560 + n * 40, w: 400, h: 0, fill: 0 } : { id: uid('h'), kind, x: 880 - n * 120, y: 470 - n * 40, w: 260, h: kind === 'arrow' ? 120 : 160, fill: n };
  return tidyBuilds({ ...s, shapes: [...s.shapes, sh] });
}
export function reshape(s: Slide, id: string, f: (sh: Shape) => Shape): Slide {
  return { ...s, shapes: s.shapes.map((sh) => (sh.id === id ? clampShape(f(sh)) : sh)) };
}
export function clampShape(sh: Shape): Shape {
  const w = Math.max(24, Math.min(W, Math.round(sh.w)));
  const h = sh.kind === 'line' ? 0 : Math.max(24, Math.min(H, Math.round(sh.h)));
  return { ...sh, w, h, x: Math.max(0, Math.min(W - w, Math.round(sh.x))), y: Math.max(0, Math.min(H - h, Math.round(sh.y))), fill: ((sh.fill % 5) + 5) % 5 };
}
export const removeShape = (s: Slide, id: string): Slide => tidyBuilds({ ...s, shapes: s.shapes.filter((x) => x.id !== id) });
/** The build of one element: how it comes in, or off (it is there from the start). The order is the slide's own order of elements. */
export function setBuild(s: Slide, el: Elem, how: Anim | null): Slide {
  const rest = s.builds.filter((b) => b.el !== el);
  const order = elements(s);
  const builds = (how ? [...rest, { el, how }] : rest).sort((a, b) => order.indexOf(a.el) - order.indexOf(b.el));
  return { ...s, builds };
}
export const buildOf = (s: Slide, el: Elem): Anim | null => s.builds.find((b) => b.el === el)?.how ?? null;

// ---------------------------------------------------------------- undo

/** The editor's undo and redo: a copy of the deck at each change, sixty deep. */
export class History {
  private back: string[] = [];
  private fwd: string[] = [];
  constructor(private now: Deck) {}
  get deck(): Deck {
    return this.now;
  }
  push(next: Deck): Deck {
    this.back.push(JSON.stringify(this.now));
    if (this.back.length > 60) this.back.shift();
    this.fwd = [];
    this.now = { ...next, at: Date.now() };
    return this.now;
  }
  get canUndo(): boolean {
    return this.back.length > 0;
  }
  get canRedo(): boolean {
    return this.fwd.length > 0;
  }
  get depth(): number {
    return this.back.length;
  }
  undo(): Deck {
    const prev = this.back.pop();
    if (prev) {
      this.fwd.push(JSON.stringify(this.now));
      this.now = JSON.parse(prev) as Deck;
    }
    return this.now;
  }
  redo(): Deck {
    const next = this.fwd.pop();
    if (next) {
      this.back.push(JSON.stringify(this.now));
      this.now = JSON.parse(next) as Deck;
    }
    return this.now;
  }
}

export const runsOf = (blocks: Block[]): Run[] => blocks.flatMap((b) => b.runs);
