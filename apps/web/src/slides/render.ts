/**
 * A SLIDE DRAWN (BRIEF-EDITOR-PRESENTATIONS): one slide as an SVG, 1,280 × 720, from the layout's boxes (layout.ts), the deck's palette
 * and the slide's own parts. The screen shows it as it is (real text, so it is read aloud and found), a PNG is this same drawing
 * rasterised, and the PDF's pages are those PNGs. In the editor an empty part says what goes there (never drawn in an export); in
 * a talk each part that comes in on a tap carries its place in the order (`data-b`) and how it comes in (`data-how`).
 */
import { figure } from '../../../../packages/shared/src/chart';
import { textOf, type Block } from '../docs/model';
import { boxes, setText, styleOf, type Laid, type Measure, type Rect, approx } from './layout';
import { H, W, slideName, type ChartData, type Deck, type Elem, type Shape, type Slide } from './model';
import { THEMES, type Palette } from './themes';

export const paletteOf = (d: Pick<Deck, 'theme' | 'palette'>): Palette => d.palette ?? THEMES[d.theme] ?? THEMES.ghosty!;
export const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, 'Helvetica Neue', Arial, sans-serif";

/** The width of text on the phone's canvas, in the font a slide is drawn in. */
export function canvasMeasure(): Measure {
  const c = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  if (!c) return approx;
  const cache = new Map<string, number>();
  return (t, s, b, i) => {
    const key = `${s}|${b ? 1 : 0}${i ? 1 : 0}|${t}`;
    let w = cache.get(key);
    if (w === undefined) {
      c.font = `${i ? 'italic ' : ''}${b ? 700 : 400} ${Math.round(s * 10) / 10}px ${FONT}`;
      w = c.measureText(t).width;
      if (cache.size > 5000) cache.clear();
      cache.set(key, w);
    }
    return w;
  };
}

// eslint-disable-next-line no-control-regex
const esc = (s: string): string => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n1 = (n: number): string => String(Math.round(n * 10) / 10);

export interface DrawOpts {
  /** The editor: an empty part says what goes there. */
  edit?: boolean;
  /** A picture's data address by its id (null: it is not here). */
  image?: (id: string) => string | null;
  measure?: Measure;
  /** This slide's number and the deck's count (the foot). */
  n?: number;
  of?: number;
  /** The part a finger last chose, outlined in the editor. */
  pick?: Elem | null;
}

function textSvg(laid: Laid, pal: Palette, family = FONT, accentText = false): string {
  let out = '';
  for (const l of laid.lines) {
    if (l.marker) out += `<text x="${n1(l.mx ?? l.x)}" y="${n1(l.y)}" font-size="${n1(laid.size)}" font-family="${esc(family)}" fill="${pal.accent}" font-weight="700">${esc(l.marker)}</text>`;
    let x = l.x;
    let spans = '';
    for (const p of l.pieces) {
      const col = p.href ? pal.accent : accentText ? pal.accent : pal.ink;
      spans += `<tspan x="${n1(x)}"${p.b ? ' font-weight="700"' : ''}${p.i ? ' font-style="italic"' : ''}${p.u || p.href ? ' text-decoration="underline"' : ''} fill="${col}">${esc(p.text)}</tspan>`;
      x += p.w;
    }
    if (spans) out += `<text y="${n1(l.y)}" font-size="${n1(laid.size)}" font-family="${esc(family)}" xml:space="preserve">${spans}</text>`;
  }
  return out;
}

const hint = (b: Rect, words: string, pal: Palette, size = 26): string =>
  `<rect x="${n1(b.x)}" y="${n1(b.y)}" width="${n1(b.w)}" height="${n1(b.h)}" fill="none" stroke="${pal.ink2}" stroke-opacity=".35" stroke-width="2" stroke-dasharray="10 8"/><text x="${n1(b.x + b.w / 2)}" y="${n1(b.y + b.h / 2 + size * 0.3)}" text-anchor="middle" font-size="${size}" font-family="${esc(FONT)}" fill="${pal.ink2}" fill-opacity=".6">${esc(words)}</text>`;

const PROMPTS: Record<string, string> = { title: 'Tap to add a title', body: 'Tap to add words', body2: 'Tap to add words' };

function chartSvg(c: ChartData, b: Rect, pal: Palette, m: Measure, edit: boolean): string {
  if (c.points.length < 2) return edit ? hint(b, 'No numbers yet: add some in the chart’s keys', pal) : '';
  const fam = esc(FONT);
  const pts = c.points;
  const vals = pts.map((p) => p.value);
  const lo = Math.min(0, ...vals);
  const hi = Math.max(0, ...vals);
  const span = hi - lo || 1;
  const left = 8;
  const top = 44;
  const bottom = 64;
  const ch = b.h - top - bottom;
  const cw = b.w - left * 2;
  const yOf = (v: number) => b.y + top + ch - ((v - lo) / span) * ch;
  const y0 = yOf(0);
  let out = '';
  for (let g = 0; g <= 3; g++) {
    const y = b.y + top + (ch * g) / 3;
    out += `<line x1="${n1(b.x + left)}" x2="${n1(b.x + b.w - left)}" y1="${n1(y)}" y2="${n1(y)}" stroke="${pal.ink}" stroke-opacity=".14" stroke-width="1.5"/>`;
  }
  out += `<line x1="${n1(b.x + left)}" x2="${n1(b.x + b.w - left)}" y1="${n1(y0)}" y2="${n1(y0)}" stroke="${pal.ink}" stroke-opacity=".5" stroke-width="2"/>`;
  const step = cw / pts.length;
  const size = Math.max(14, Math.min(22, step / 4.2));
  const fit = (t: string, w: number, s: number): string => {
    let x = t;
    while (x.length > 1 && m(x, s, false, false) > w) x = `${x.slice(0, -2)}…`;
    return x;
  };
  const lbl = (t: string, x: number, y: number, s: number, fill: string, bold = false): string => `<text x="${n1(x)}" y="${n1(y)}" text-anchor="middle" font-size="${n1(s)}" font-family="${fam}" fill="${fill}"${bold ? ' font-weight="700"' : ''}>${esc(t)}</text>`;
  if (c.kind === 'bars') {
    const bw = Math.min(110, step * 0.62);
    pts.forEach((p, i) => {
      const cx = b.x + left + step * (i + 0.5);
      const y = yOf(p.value);
      out += `<rect x="${n1(cx - bw / 2)}" y="${n1(Math.min(y, y0))}" width="${n1(bw)}" height="${n1(Math.max(2, Math.abs(y0 - y)))}" fill="${pal.accent}"/>`;
      out += lbl(figure(p.value, c), cx, p.value >= 0 ? y - 10 : y + size + 6, size, pal.ink, true);
      out += lbl(fit(p.label, step - 6, size), cx, b.y + b.h - 28, size, pal.ink2);
    });
  } else {
    const path = pts.map((p, i) => `${n1(b.x + left + step * (i + 0.5))},${n1(yOf(p.value))}`).join(' ');
    out += `<polyline points="${path}" fill="none" stroke="${pal.accent}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>`;
    pts.forEach((p, i) => {
      const cx = b.x + left + step * (i + 0.5);
      const y = yOf(p.value);
      out += `<circle cx="${n1(cx)}" cy="${n1(y)}" r="7" fill="${pal.accent}"/>`;
      if (pts.length <= 8 || i % 2 === 0) out += lbl(figure(p.value, c), cx, y - 16, size, pal.ink, true);
      out += lbl(fit(p.label, step - 6, size), cx, b.y + b.h - 28, size, pal.ink2);
    });
  }
  return out;
}

function tableSvg(t: Block, b: Rect, pal: Palette, m: Measure, edit: boolean): string {
  const rows = t.rows ?? [];
  if (!rows.length) return edit ? hint(b, 'No table yet', pal) : '';
  const cols = Math.max(1, ...rows.map((r) => r.length));
  const cw = b.w / cols;
  const rh = Math.min(76, b.h / rows.length);
  let out = '';
  const size = Math.max(15, Math.min(26, rh * 0.42, cw / 7));
  rows.forEach((r, ri) => {
    const head = !!t.head && ri === 0;
    const y = b.y + ri * rh;
    if (head) out += `<rect x="${n1(b.x)}" y="${n1(y)}" width="${n1(b.w)}" height="${n1(rh)}" fill="${pal.accent}" fill-opacity=".28"/>`;
    for (let ci = 0; ci < cols; ci++) {
      const cell = r[ci] ?? [];
      const box: Rect = { x: b.x + ci * cw + 12, y: y + 4, w: cw - 24, h: rh - 8 };
      const laid = setText([{ id: 'c', t: 'p', runs: cell }], box, { size, bold: head, italic: false, align: 'left', anchor: 'm' }, m);
      out += textSvg(laid, pal);
    }
    out += `<line x1="${n1(b.x)}" x2="${n1(b.x + b.w)}" y1="${n1(y + rh)}" y2="${n1(y + rh)}" stroke="${pal.ink}" stroke-opacity=".3" stroke-width="1.5"/>`;
  });
  out += `<line x1="${n1(b.x)}" x2="${n1(b.x + b.w)}" y1="${n1(b.y)}" y2="${n1(b.y)}" stroke="${pal.ink}" stroke-opacity=".3" stroke-width="1.5"/>`;
  return out;
}

export function shapeSvg(sh: Shape, pal: Palette): string {
  const fill = pal.seq[sh.fill % pal.seq.length]!;
  const { x, y, w, h } = sh;
  switch (sh.kind) {
    case 'rect':
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
    case 'round':
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.round(Math.min(w, h) * 0.18)}" fill="${fill}"/>`;
    case 'ellipse':
      return `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${fill}"/>`;
    case 'arrow':
      return `<polygon points="${[[x, y + h * 0.3], [x + w * 0.6, y + h * 0.3], [x + w * 0.6, y], [x + w, y + h / 2], [x + w * 0.6, y + h], [x + w * 0.6, y + h * 0.7], [x, y + h * 0.7]].map((p) => `${n1(p[0]!)},${n1(p[1]!)}`).join(' ')}" fill="${fill}"/>`;
    case 'line':
      return `<line x1="${x}" y1="${y}" x2="${x + w}" y2="${y}" stroke="${fill}" stroke-width="6" stroke-linecap="round"/>`;
  }
}

/** The slide as an SVG document's text. */
export function slideSvg(deck: Deck, s: Slide, o: DrawOpts = {}): string {
  const pal = paletteOf(deck);
  const m = o.measure ?? approx;
  const bx = boxes(s);
  const idx = new Map(s.builds.map((b, i) => [b.el, { i: i + 1, how: b.how }]));
  const group = (el: Elem, inner0: string, label = '', frame: Rect | null = null): string => {
    const inner = inner0 && o.edit && o.pick === el && frame ? `${inner0}<rect x="${n1(frame.x - 6)}" y="${n1(frame.y - 6)}" width="${n1(frame.w + 12)}" height="${n1(frame.h + 12)}" fill="none" stroke="${pal.accent}" stroke-width="3" stroke-dasharray="12 8" pointer-events="none"/>` : inner0;
    if (!inner) return '';
    const b = idx.get(el);
    return `<g class="slel" data-el="${el}"${b ? ` data-b="${b.i}" data-how="${b.how}"` : ''}${o.pick === el ? ' data-pick="1"' : ''}${label ? ` role="img" aria-label="${esc(label)}"` : ''}>${inner}</g>`;
  };
  let body = `<rect width="${W}" height="${H}" fill="${pal.ground}"/>`;
  // the marks that belong to the layout
  if (['bullets', 'two', 'picture', 'chart', 'table'].includes(s.layout)) body += `<rect x="72" y="148" width="88" height="4" fill="${pal.accent}"/>`;
  if (s.layout === 'title') body += `<rect x="96" y="386" width="120" height="5" fill="${pal.accent}"/>`;
  if (s.layout === 'section') body += `<rect x="72" y="244" width="8" height="200" fill="${pal.accent}"/>`;
  if (s.layout === 'quote') body += `<text x="${W / 2}" y="170" text-anchor="middle" font-size="150" font-family="${esc(FONT)}" fill="${pal.accent}" fill-opacity=".85" font-weight="700">“</text>`;
  const parts: [Elem, 'title' | 'body' | 'body2'][] = [['title', 'title'], ['body', 'body'], ['body2', 'body2']];
  for (const [el, key] of parts) {
    const box = bx[key];
    if (!box) continue;
    const blocks = key === 'title' ? [s.title] : key === 'body' ? s.body : s.body2;
    const st = styleOf(s.layout, key, deck);
    const has = blocks.some((b) => textOf(b).trim());
    let inner = '';
    if (has) inner = textSvg(setText(blocks, box, st, m), pal, FONT, !!st.accent && key === 'title');
    else if (o.edit) inner = hint(box, PROMPTS[key]!, pal, Math.min(26, box.h / 3));
    body += group(el, inner, '', box);
  }
  if (bx.media) {
    const mb = bx.media;
    let inner = '';
    let label = '';
    const md = s.media;
    if (!md) inner = o.edit ? hint(mb, s.layout === 'picture' ? 'Add a picture from INSERT' : s.layout === 'chart' ? 'Add a chart from INSERT' : 'Add a table from INSERT', pal) : '';
    else if (md.k === 'img') {
      const src = o.image?.(md.img) ?? null;
      label = md.alt || 'A picture';
      if (src) {
        const k = Math.min(mb.w / md.iw, mb.h / md.ih);
        const w = md.iw * k;
        const h = md.ih * k;
        inner = `<image href="${esc(src)}" x="${n1(mb.x + (mb.w - w) / 2)}" y="${n1(mb.y + (mb.h - h) / 2)}" width="${n1(w)}" height="${n1(h)}" preserveAspectRatio="xMidYMid meet"/>`;
      } else inner = hint(mb, 'This picture is not on this phone any more', pal);
    } else if (md.k === 'chart') {
      inner = chartSvg(md.chart, mb, pal, m, !!o.edit);
      label = `A ${md.chart.kind === 'line' ? 'line' : 'bar'} chart of ${md.chart.points.length} numbers`;
    } else {
      inner = tableSvg(md.table, mb, pal, m, !!o.edit);
      label = 'A table';
    }
    body += group('media', inner, label, mb);
  }
  s.shapes.forEach((sh, i) => (body += group(i === 0 ? 'shape0' : 'shape1', shapeSvg(sh, pal), `A ${sh.kind === 'round' ? 'rounded' : sh.kind} shape`, { x: sh.x, y: sh.y - (sh.kind === 'line' ? 12 : 0), w: sh.w, h: sh.kind === 'line' ? 24 : sh.h })));
  // the foot: the deck's name and the slide's number (not on a title slide)
  if (s.layout !== 'title' && s.layout !== 'blank') {
    const fam = esc(FONT);
    if (deck.master.footer && deck.title.trim()) body += `<text x="72" y="696" font-size="20" font-family="${fam}" fill="${pal.ink2}" fill-opacity=".7">${esc(deck.title)}</text>`;
    if (deck.master.numbers && o.n) body += `<text x="${W - 72}" y="696" text-anchor="end" font-size="20" font-family="${fam}" fill="${pal.ink2}" fill-opacity=".7">${o.n}${o.of ? ` of ${o.of}` : ''}</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" class="slsvg" role="group" aria-label="${esc(`Slide ${o.n ?? ''}: ${slideName(s, o.n)}`.replace('Slide : ', 'Slide: '))}">${body}</svg>`;
}
