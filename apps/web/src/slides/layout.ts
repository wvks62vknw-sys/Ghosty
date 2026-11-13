/**
 * WHERE THINGS SIT ON A SLIDE (BRIEF-EDITOR-PRESENTATIONS): the 1,280 × 720 slide's boxes for each layout, the type each part is set
 * in, and the words broken into lines by a measure it is handed (the phone's canvas; a plain estimate in node). The screen's
 * drawing, the PNG, the PDF and the .pptx writer all stand on this one file, so a slide is the same wherever it is seen. Text
 * that does not fit its box is set smaller, never cut off, down to a little over half.
 */
import { textOf, type Block, type Run } from '../docs/model';
import { H, SLOTS, W, type Deck, type Elem, type Layout, type Slide } from './model';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Measure = (text: string, size: number, bold: boolean, italic: boolean) => number;
/** A width estimate for where there is no canvas (the tests, the .pptx writer's own fit). */
export const approx: Measure = (t, s, b) => [...t].length * s * (b ? 0.56 : 0.52);

const M = 72;
const TITLE: Rect = { x: M, y: 40, w: W - 2 * M, h: 104 };
const CONTENT: Rect = { x: M, y: 168, w: W - 2 * M, h: 492 };
const HALF_L: Rect = { x: M, y: 168, w: 560, h: 492 };
const HALF_R: Rect = { x: 668, y: 168, w: 540, h: 492 };
const MEDIA_LAYOUTS: Layout[] = ['picture', 'chart', 'table'];

/** The boxes of a slide's parts (null where the layout has none). */
export function boxes(s: Slide): Record<'title' | 'body' | 'body2' | 'media', Rect | null> {
  const slots = SLOTS[s.layout];
  const half = !!s.media && !MEDIA_LAYOUTS.includes(s.layout);
  const out: Record<'title' | 'body' | 'body2' | 'media', Rect | null> = { title: null, body: null, body2: null, media: null };
  switch (s.layout) {
    case 'title':
      out.title = { x: 96, y: 200, w: W - 192, h: 180 };
      out.body = { x: 96, y: 404, w: W - 192, h: 150 };
      break;
    case 'section':
      out.title = { x: 96, y: 244, w: W - 192, h: 200 };
      out.body = { x: 96, y: 460, w: W - 192, h: 120 };
      break;
    case 'bullets':
      out.title = TITLE;
      out.body = CONTENT;
      break;
    case 'two':
      out.title = TITLE;
      out.body = { x: M, y: 168, w: 548, h: 492 };
      out.body2 = { x: 660, y: 168, w: 548, h: 492 };
      break;
    case 'picture':
      out.title = TITLE;
      out.media = { x: M, y: 160, w: W - 2 * M, h: 424 };
      out.body = { x: M, y: 596, w: W - 2 * M, h: 76 };
      break;
    case 'chart':
    case 'table':
      out.title = TITLE;
      out.media = CONTENT;
      break;
    case 'quote':
      out.body = { x: 128, y: 140, w: W - 256, h: 350 };
      out.title = { x: 128, y: 520, w: W - 256, h: 80 };
      break;
    case 'blank':
      break;
  }
  if (half) {
    out.media = HALF_R;
    if (s.layout === 'bullets' || s.layout === 'two') {
      out.body = HALF_L;
      out.body2 = null;
    } else {
      for (const k of ['title', 'body'] as const) if (out[k]) out[k] = { ...out[k]!, x: Math.min(out[k]!.x, 96), w: Math.min(out[k]!.w, 560) };
    }
  }
  if (s.layout === 'blank' && s.media) out.media = CONTENT;
  if (!slots.title) out.title = null;
  return out;
}

export interface Style {
  size: number;
  bold: boolean;
  italic: boolean;
  align: 'left' | 'center';
  anchor: 't' | 'm' | 'b';
  /** A list item's marker is drawn for ul and ol blocks; a paragraph has none. */
  accent?: boolean;
}
/** How a part is set. */
export function styleOf(layout: Layout, el: 'title' | 'body' | 'body2', deck: Pick<Deck, 'master'>): Style {
  const al = deck.master.align;
  if (el === 'title') {
    if (layout === 'title') return { size: 68, bold: true, italic: false, align: al, anchor: 'b' };
    if (layout === 'section') return { size: 72, bold: true, italic: false, align: al, anchor: 'b', accent: true };
    if (layout === 'quote') return { size: 28, bold: false, italic: false, align: 'center', anchor: 't', accent: true };
    return { size: 44, bold: true, italic: false, align: al, anchor: 'm' };
  }
  if (layout === 'title' || layout === 'section') return { size: 32, bold: false, italic: false, align: al, anchor: 't' };
  if (layout === 'quote') return { size: 46, bold: false, italic: true, align: 'center', anchor: 'm' };
  if (layout === 'picture') return { size: 26, bold: false, italic: false, align: 'center', anchor: 't' };
  return { size: layout === 'two' ? 28 : 32, bold: false, italic: false, align: 'left', anchor: 't' };
}

export interface Piece extends Run {
  w: number;
}
export interface Line {
  pieces: Piece[];
  x: number;
  /** The baseline. */
  y: number;
  w: number;
  marker?: string;
  mx?: number;
}
export interface Laid {
  lines: Line[];
  size: number;
  h: number;
  /** The set size is under what was asked: it was made smaller to fit. */
  shrunk: boolean;
}
const LEAD = 1.26;

function words(runs: Run[]): { text: string; r: Run }[] {
  const out: { text: string; r: Run }[] = [];
  for (const r of runs) for (const part of r.text.split(/(\s+)/)) if (part) out.push({ text: part, r });
  return out;
}

/** Words set in a box at a size: broken into lines by the measure, each block its own paragraph. */
function lay(blocks: Block[], box: Rect, st: Style, size: number, m: Measure): Laid {
  const lines: Line[] = [];
  let y = 0;
  let n = 0;
  const live = blocks.filter((b) => textOf(b).trim() || b.runs.some((r) => r.text));
  live.forEach((b, bi) => {
    const list = b.t === 'ul' || b.t === 'ol';
    const quote = b.t === 'quote';
    const head = b.t === 'h1' || b.t === 'h2' || b.t === 'h3';
    const bold = st.bold || head;
    const italic = st.italic || quote;
    const indent = list ? size * 0.95 : 0;
    const avail = Math.max(40, box.w - indent);
    n = list && b.t === 'ol' && live[bi - 1]?.t === 'ol' ? n + 1 : b.t === 'ol' ? 1 : 0;
    let cur: Piece[] = [];
    let cw = 0;
    let startOfPara = true;
    const flush = () => {
      const w = cw;
      const align = b.t === 'right' ? 'right' : st.align;
      const x = box.x + indent + (align === 'center' ? (avail - w) / 2 : align === 'right' ? avail - w : 0);
      lines.push({ pieces: cur, x, y: 0, w, ...(startOfPara && list ? { marker: b.t === 'ol' ? `${n}.` : '•', mx: box.x } : {}) });
      startOfPara = false;
      cur = [];
      cw = 0;
    };
    const lineH = size * LEAD;
    const startY = lines.length;
    for (const wd of words(b.runs.length ? b.runs : [{ text: '' }])) {
      const parts = wd.text.split('\n');
      parts.forEach((part, pi) => {
        if (pi > 0) flush();
        if (!part) return;
        const w = m(part, size, !!(wd.r.b || bold), !!(wd.r.i || italic));
        if (/^\s+$/.test(part)) {
          if (cur.length) {
            cur.push({ ...wd.r, text: part, w });
            cw += w;
          }
          return;
        }
        if (cw + w > avail && cur.length) {
          while (cur.length && /^\s+$/.test(cur[cur.length - 1]!.text)) cw -= cur.pop()!.w;
          flush();
        }
        // a word wider than the line is broken by letters
        if (w > avail) {
          let rest = part;
          while (rest) {
            let k = rest.length;
            while (k > 1 && m(rest.slice(0, k), size, !!(wd.r.b || bold), !!(wd.r.i || italic)) > avail - cw) k--;
            const piece = rest.slice(0, k);
            cur.push({ ...wd.r, text: piece, w: m(piece, size, !!(wd.r.b || bold), !!(wd.r.i || italic)) });
            cw += cur[cur.length - 1]!.w;
            rest = rest.slice(k);
            if (rest) flush();
          }
        } else {
          cur.push({ ...wd.r, text: part, w });
          cw += w;
        }
      });
    }
    if (cur.length || startOfPara) flush();
    for (let li = startY; li < lines.length; li++) {
      y += lineH;
      lines[li]!.y = y - (lineH - size) * 0.45 - size * 0.18;
    }
    y += size * (list ? 0.32 : 0.5);
    for (const pc of lines.slice(startY).flatMap((l) => l.pieces)) {
      if (bold && !pc.b) pc.b = true;
      if (italic && !pc.i) pc.i = true;
    }
  });
  const h = Math.max(0, y - (live.length ? size * (live[live.length - 1]!.t === 'ul' || live[live.length - 1]!.t === 'ol' ? 0.32 : 0.5) : 0));
  return { lines, size, h, shrunk: size < st.size - 0.01 };
}

/** The words of a part set to fit its box (smaller, down to 55%, when they do not), their lines placed in slide pixels. */
export function setText(blocks: Block[], box: Rect, st: Style, m: Measure = approx): Laid {
  let size = st.size;
  let laid = lay(blocks, box, st, size, m);
  const floor = st.size * 0.55;
  while (laid.h > box.h && size > floor) {
    size = Math.max(floor, size * 0.94);
    laid = lay(blocks, box, st, size, m);
  }
  const dy = st.anchor === 'm' ? Math.max(0, (box.h - laid.h) / 2) : st.anchor === 'b' ? Math.max(0, box.h - laid.h) : 0;
  for (const l of laid.lines) l.y += box.y + dy;
  return laid;
}

/** Which element a tap on a slide's part means. */
export const ELEM_NAMES: Record<Elem, string> = { title: 'title', body: 'text', body2: 'right column', media: 'picture, chart or table', shape0: 'first shape', shape1: 'second shape' };
