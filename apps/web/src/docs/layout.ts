/**
 * THE DOCUMENT LAYOUT (BRIEF-REST-E part 2, used by part 1's "anything readable → PDF"; BRIEF-EDITOR-DOCUMENTS): a document set on
 * pages of the size he chose (A4 or Letter, upright or on its side) with his margins, the title and headings in Helvetica, the
 * words in Times at 11.5 pt with room between the lines, bold, italic, underline and links kept, bullets and numbers hung,
 * a quotation indented in italic, alignment (left, centre, right, justified), tables ruled cell by cell, pictures at their share of
 * the page, page breaks, headings kept with what follows, a header line, and a foot with his line and "page 1 of 3". Lines are
 * broken by the fonts' own widths. A document with letters the standard fonts lack (Urdu, Greek, Chinese) is drawn by the phone
 * instead (docs/read.ts), the same layout on a canvas. Pure.
 */
import { A4, writePdf, type PdfImage, type PdfPage, type PdfRun } from '../convert/pdfwrite';
import { fitsAnsi, textWidth, type PdfFont } from '../convert/fonts';
import { pageOf, textOf, type Block, type Doc, type PageSetup, type Run } from './model';

export const MARGIN = 70.87; // 2.5 cm
const MARGINS = { normal: 70.87, narrow: 36.85, wide: 107.7 } as const;
const PAGES = { a4: { w: A4.w, h: A4.h }, letter: { w: 612, h: 792 } } as const;
/** The page's size in points and its margin, as the setup says. */
export function pageBox(pg: PageSetup): { w: number; h: number; m: number } {
  const b = PAGES[pg.size];
  return { w: pg.landscape ? b.h : b.w, h: pg.landscape ? b.w : b.h, m: MARGINS[pg.margin] };
}
const BODY = 11.5;
const LEAD = 1.42;
type TextT = Exclude<Block['t'], 'table' | 'img' | 'pb'> | 'title';
const STYLE: Record<TextT, { size: number; font: 'serif' | 'sans'; before: number; after: number; indent?: number; italic?: boolean }> = {
  title: { size: 21, font: 'sans', before: 0, after: 14 },
  h1: { size: 16, font: 'sans', before: 14, after: 6 },
  h2: { size: 13.5, font: 'sans', before: 12, after: 5 },
  h3: { size: 12, font: 'sans', before: 10, after: 4 },
  p: { size: BODY, font: 'serif', before: 0, after: 8 },
  ul: { size: BODY, font: 'serif', before: 0, after: 3, indent: 18 },
  ol: { size: BODY, font: 'serif', before: 0, after: 3, indent: 18 },
  quote: { size: BODY, font: 'serif', before: 2, after: 8, indent: 22, italic: true },
  right: { size: BODY, font: 'serif', before: 0, after: 2 },
};
const LINK: [number, number, number] = [0.02, 0.39, 0.76];

function fontFor(kind: 'serif' | 'sans', b: boolean, i: boolean): PdfFont {
  if (kind === 'sans') return 'Helvetica-Bold';
  return b && i ? 'Times-BoldItalic' : b ? 'Times-Bold' : i ? 'Times-Italic' : 'Times-Roman';
}

/** One laid-out line: its pieces, each with its font, and its width. */
interface Piece {
  text: string;
  font: PdfFont;
  w: number;
  u?: boolean;
  link?: boolean;
}

/** Words broken into lines no wider than `width` (a word too long for a line is broken by letters). */
export function breakLines(runs: Run[], kind: 'serif' | 'sans', size: number, width: number, italic = false): Piece[][] {
  const lines: Piece[][] = [];
  let line: Piece[] = [];
  let lw = 0;
  const space = (f: PdfFont) => textWidth(' ', f, size);
  const push = () => {
    // no space at the end of a line
    const last = line[line.length - 1];
    if (last && last.text.endsWith(' ')) {
      last.text = last.text.replace(/ +$/, '');
      last.w = textWidth(last.text, last.font, size);
    }
    lines.push(line);
    line = [];
    lw = 0;
  };
  for (const r of runs) {
    const font = fontFor(kind, !!r.b, italic || !!r.i);
    const flags = { ...(r.u || r.href ? { u: true } : {}), ...(r.href ? { link: true } : {}) };
    const parts = r.text.split(/(\n| +)/);
    for (const part of parts) {
      if (!part) continue;
      if (part === '\n') {
        push();
        continue;
      }
      if (/^ +$/.test(part)) {
        if (!line.length) continue;
        const w = space(font);
        line.push({ text: ' ', font, w, ...flags });
        lw += w;
        continue;
      }
      let word = part;
      let w = textWidth(word, font, size);
      if (lw + w > width && line.length) push();
      while (w > width) {
        // a word wider than the line: as many letters as fit
        let n = word.length - 1;
        while (n > 1 && textWidth(word.slice(0, n), font, size) > width) n--;
        line.push({ text: word.slice(0, n), font, w: textWidth(word.slice(0, n), font, size), ...flags });
        push();
        word = word.slice(n);
        w = textWidth(word, font, size);
      }
      line.push({ text: word, font, w, ...flags });
      lw += w;
    }
  }
  if (line.length || !lines.length) push();
  return lines;
}

/** A picture's size on the page: its share of the text's width, never taller than the page's text. */
export function pictureBox(b: Block, textW: number, textH: number): { w: number; h: number } | null {
  if (!b.iw || !b.ih) return null;
  let w = (textW * Math.min(100, Math.max(10, b.w ?? 100))) / 100;
  let h = (w * b.ih) / b.iw;
  if (h > textH) {
    h = textH;
    w = (h * b.iw) / b.ih;
  }
  return { w, h };
}

/**
 * The document's pages for the PDF writer (only when every letter is one the standard fonts have: `canSetAsText`). `imageOf` gives a
 * picture's JPEG by its id; left out, pictures keep their room on the page and are not drawn (the count of pages is the same).
 */
export function layoutPages(d: Doc, imageOf?: (id: string) => PdfImage | null): PdfPage[] {
  const pg = pageOf(d);
  const box = pageBox(pg);
  const M = box.m;
  const pages: PdfPage[] = [];
  const width = box.w - 2 * M;
  const textH = box.h - 2 * M;
  let page: PdfPage = { w: box.w, h: box.h, runs: [], lines: [], images: [] };
  let y = box.h - M;
  const newPage = () => {
    pages.push(page);
    page = { w: box.w, h: box.h, runs: [], lines: [], images: [] };
    y = box.h - M;
  };
  const items: { t: TextT; b: Block; runs: Run[]; n: number }[] = [];
  const order: ({ kind: 'text'; at: number } | { kind: 'other'; b: Block })[] = [];
  const titleBlock: Block = { id: 'title', t: 'p', runs: [{ text: d.title, b: true }] };
  items.push({ t: 'title', b: titleBlock, runs: titleBlock.runs, n: 0 });
  order.push({ kind: 'text', at: 0 });
  let n = 0;
  d.blocks.forEach((b, k) => {
    if (b.t === 'table' || b.t === 'img' || b.t === 'pb') {
      order.push({ kind: 'other', b });
      n = 0;
      return;
    }
    n = b.t === 'ol' ? (d.blocks[k - 1]?.t === 'ol' ? n + 1 : 1) : 0;
    items.push({ t: b.t, b, runs: b.runs, n });
    order.push({ kind: 'text', at: items.length - 1 });
  });
  const drawLine = (line: Piece[], x0: number, base: number, size: number, extra: number, quote: boolean) => {
    let x = x0;
    for (const p of line) {
      if (p.text.trim()) page.runs!.push({ x, y: base, text: p.text, font: p.font, size, ...(p.link ? { rgb: LINK } : quote ? { rgb: [0.27, 0.27, 0.27] as [number, number, number] } : {}) });
      const adv = p.w + (p.text === ' ' ? extra : 0);
      if (p.u && p.text.trim()) page.lines!.push({ x1: x, y1: base - 1.6, x2: x + p.w, y2: base - 1.6, width: 0.6, ...(p.link ? { rgb: LINK } : {}) });
      x += adv;
    }
  };

  const text = (k: number) => {
    const it = items[k]!;
    const s = STYLE[it.t];
    const indent = s.indent ?? 0;
    const lines = breakLines(it.runs, s.font, s.size, width - indent, !!s.italic);
    const lh = s.size * LEAD;
    y -= s.before;
    // a heading keeps the first two lines of what follows with it
    const next = items[k + 1];
    const keepNext = (it.t === 'h1' || it.t === 'h2' || it.t === 'h3') && next ? 2 * STYLE[next.t].size * LEAD : 0;
    if (y - lh - keepNext < M && page.runs!.length) newPage();
    const align = it.t === 'right' ? 'right' : it.b.align ?? (d.rtl ? 'right' : 'left');
    lines.forEach((line, i) => {
      if (y - lh < M) newPage();
      y -= lh;
      const base = y + (lh - s.size) / 2 + s.size * 0.2;
      const lw = line.reduce((a, p) => a + p.w, 0);
      const room = width - indent;
      let x = align === 'right' ? M + width - lw : align === 'center' ? M + indent + (room - lw) / 2 : M + indent;
      let extra = 0;
      if (align === 'justify' && i < lines.length - 1) {
        const gaps = line.filter((p) => p.text === ' ').length;
        if (gaps) extra = Math.max(0, (room - lw) / gaps);
      }
      if (i === 0 && (it.t === 'ul' || it.t === 'ol')) {
        const mark = it.t === 'ul' ? '•' : `${it.n}.`;
        page.runs!.push({ x: M + indent - 4 - textWidth(mark, 'Times-Roman', s.size), y: base, text: mark, font: 'Times-Roman', size: s.size });
      }
      drawLine(line, x, base, s.size, extra, it.t === 'quote');
    });
    if (it.t === 'quote') page.lines!.push({ x1: M + 8, y1: y - 2, x2: M + 8, y2: y + lines.length * lh, width: 1.5, rgb: [0.6, 0.6, 0.6] });
    if (it.t === 'title') page.lines!.push({ x1: M, y1: y - 6, x2: M + width, y2: y - 6, width: 0.8, rgb: [0.55, 0.55, 0.55] });
    y -= s.after;
  };

  const table = (b: Block) => {
    const rows = b.rows ?? [];
    const cols = Math.max(1, ...rows.map((r) => r.length));
    const cw = width / cols;
    const pad = 4;
    const size = 10.5;
    const lh = size * LEAD;
    y -= 4;
    rows.forEach((r, ri) => {
      const head = !!b.head && ri === 0;
      const laid = Array.from({ length: cols }, (_, c) => breakLines((r[c] ?? []).map((x) => (head ? { ...x, b: true } : x)), 'serif', size, cw - 2 * pad));
      const rh = Math.max(...laid.map((l) => l.length)) * lh + 2 * pad;
      if (y - rh < M && page.runs!.length + page.lines!.length) newPage();
      const top = y;
      y -= rh;
      for (let c = 0; c <= cols; c++) page.lines!.push({ x1: M + c * cw, y1: y, x2: M + c * cw, y2: top, width: 0.6, rgb: [0.5, 0.5, 0.5] });
      page.lines!.push({ x1: M, y1: top, x2: M + width, y2: top, width: head ? 1 : 0.6, rgb: [0.5, 0.5, 0.5] }, { x1: M, y1: y, x2: M + width, y2: y, width: head || ri === rows.length - 1 ? 0.8 : 0.6, rgb: [0.5, 0.5, 0.5] });
      laid.forEach((lines, c) => lines.forEach((line, i) => drawLine(line, M + c * cw + pad, top - pad - (i + 1) * lh + (lh - size) / 2 + size * 0.2, size, 0, false)));
    });
    y -= 10;
  };

  const picture = (b: Block) => {
    const bx = pictureBox(b, width, textH);
    if (!bx) return;
    if (y - bx.h < M && page.runs!.length + page.lines!.length + page.images!.length) newPage();
    y -= bx.h;
    const img = b.img && imageOf ? imageOf(b.img) : null;
    const al = b.align ?? 'center';
    const x = al === 'left' ? M : al === 'right' ? M + width - bx.w : M + (width - bx.w) / 2;
    if (img) page.images!.push({ img, x, y, w: bx.w, h: bx.h });
    y -= 10;
  };

  for (const o of order) {
    if (o.kind === 'text') text(o.at);
    else if (o.b.t === 'pb') newPage();
    else if (o.b.t === 'table') table(o.b);
    else picture(o.b);
  }
  pages.push(page);
  const total = pages.length;
  pages.forEach((p, i) => {
    if (pg.header?.trim()) {
      const t = pg.header.trim();
      p.runs!.push({ x: (box.w - textWidth(t, 'Helvetica', 8.5)) / 2, y: box.h - M / 2 + 4, text: t, font: 'Helvetica', size: 8.5, rgb: [0.45, 0.45, 0.45] });
    }
    const foot = [pg.footer?.trim() ?? '', pg.numbers ? `${i + 1} of ${total}` : ''].filter(Boolean).join('  ·  ');
    if (foot) {
      const run: PdfRun = { x: (box.w - textWidth(foot, 'Helvetica', 8.5)) / 2, y: M / 2, text: foot, font: 'Helvetica', size: 8.5, rgb: [0.45, 0.45, 0.45] };
      p.runs!.push(run);
    }
  });
  return pages;
}

/** How many pages the document makes as the PDF sets it. */
export const pageCount = (d: Doc): number => layoutPages(d).length;

/** The standard fonts have every letter of it (else the phone draws its pages). */
export const canSetAsText = (d: Doc): boolean => {
  const pg = pageOf(d);
  return fitsAnsi(`${d.title}\n${d.blocks.filter((b) => b.t !== 'img').map(textOf).join('\n').replace(/\t/g, ' ')}\n${pg.header ?? ''}\n${pg.footer ?? ''}`);
};

/** The document as a PDF of words (null: it has letters only the phone can draw; docs/render.ts does those). */
export function pdfOfDoc(d: Doc, author = '', imageOf?: (id: string) => PdfImage | null): Uint8Array | null {
  if (!canSetAsText(d)) return null;
  return writePdf(layoutPages(d, imageOf), { title: d.title, ...(author ? { author } : {}) });
}

/** How long a document is, in words ("1 page", "about 3 minutes to read"). */
export function readingWords(d: Doc): string {
  const words = d.blocks.reduce((n, b) => n + (textOf(b).match(/\S+/g)?.length ?? 0), 0);
  const mins = Math.max(1, Math.round(words / 200));
  return `${words.toLocaleString('en-GB')} word${words === 1 ? '' : 's'}, about ${mins} minute${mins === 1 ? '' : 's'} to read`;
}
