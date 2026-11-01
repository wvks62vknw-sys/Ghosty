/**
 * THE DOCUMENT LAYOUT (BRIEF-REST-E part 2, used by part 1's "anything readable → PDF"): a document set on A4 pages —
 * 2.5 cm margins, the title and headings in Helvetica, the words in Times at 11.5 pt with room between the lines, bold
 * and italic kept, bullets and numbers hung, a quotation indented in italic, a letter's name and date on the right,
 * headings kept with what follows, "page 1 of 3" at the foot. Lines are broken by the fonts' own widths. A document with
 * letters the standard fonts lack (Urdu, Greek, Chinese) is drawn by the phone instead (docs/render.ts), the same layout
 * on a canvas. Pure.
 */
import { A4, writePdf, type PdfPage, type PdfRun } from '../convert/pdfwrite';
import { fitsAnsi, textWidth, type PdfFont } from '../convert/fonts';
import { docText, textOf, type Block, type Doc, type Run } from './model';

export const MARGIN = 70.87; // 2.5 cm
const BODY = 11.5;
const LEAD = 1.42;
const STYLE: Record<Block['t'] | 'title', { size: number; font: 'serif' | 'sans'; before: number; after: number; indent?: number; italic?: boolean }> = {
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

function fontFor(kind: 'serif' | 'sans', b: boolean, i: boolean): PdfFont {
  if (kind === 'sans') return 'Helvetica-Bold';
  return b && i ? 'Times-BoldItalic' : b ? 'Times-Bold' : i ? 'Times-Italic' : 'Times-Roman';
}

/** One laid-out line: its pieces, each with its font, and its width. */
interface Piece {
  text: string;
  font: PdfFont;
  w: number;
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
        line.push({ text: ' ', font, w });
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
        line.push({ text: word.slice(0, n), font, w: textWidth(word.slice(0, n), font, size) });
        push();
        word = word.slice(n);
        w = textWidth(word, font, size);
      }
      line.push({ text: word, font, w });
      lw += w;
    }
  }
  if (line.length || !lines.length) push();
  return lines;
}

/** The document's pages for the PDF writer (only when every letter is one the standard fonts have: `canSetAsText`). */
export function layoutPages(d: Doc): PdfPage[] {
  const pages: PdfPage[] = [];
  const width = A4.w - 2 * MARGIN;
  let page: PdfPage = { w: A4.w, h: A4.h, runs: [], lines: [] };
  let y = A4.h - MARGIN;
  const newPage = () => {
    pages.push(page);
    page = { w: A4.w, h: A4.h, runs: [], lines: [] };
    y = A4.h - MARGIN;
  };
  const items: { t: Block['t'] | 'title'; runs: Run[]; n: number }[] = [{ t: 'title', runs: [{ text: d.title, b: true }], n: 0 }];
  let n = 0;
  d.blocks.forEach((b, k) => {
    n = b.t === 'ol' ? (d.blocks[k - 1]?.t === 'ol' ? n + 1 : 1) : 0;
    items.push({ t: b.t, runs: b.runs, n });
  });
  items.forEach((it, k) => {
    const s = STYLE[it.t];
    const indent = s.indent ?? 0;
    const lines = breakLines(it.runs, s.font, s.size, width - indent, !!s.italic);
    const lh = s.size * LEAD;
    y -= s.before;
    // a heading keeps the first two lines of what follows with it
    const next = items[k + 1];
    const keep = (it.t === 'h1' || it.t === 'h2' || it.t === 'h3') && next ? 2 * STYLE[next.t].size * LEAD : 0;
    if (y - lh - keep < MARGIN && page.runs!.length) newPage();
    lines.forEach((line, i) => {
      if (y - lh < MARGIN) newPage();
      y -= lh;
      const base = y + (lh - s.size) / 2 + s.size * 0.2;
      const lw = line.reduce((a, p) => a + p.w, 0);
      let x = it.t === 'right' ? MARGIN + width - lw : MARGIN + indent;
      if (i === 0 && (it.t === 'ul' || it.t === 'ol')) {
        const mark = it.t === 'ul' ? '•' : `${it.n}.`;
        page.runs!.push({ x: MARGIN + indent - 4 - textWidth(mark, 'Times-Roman', s.size), y: base, text: mark, font: 'Times-Roman', size: s.size });
      }
      for (const p of line) {
        if (p.text.trim()) page.runs!.push({ x, y: base, text: p.text, font: p.font, size: s.size, ...(it.t === 'quote' ? { rgb: [0.27, 0.27, 0.27] as [number, number, number] } : {}) });
        x += p.w;
      }
    });
    if (it.t === 'quote') page.lines!.push({ x1: MARGIN + 8, y1: y - 2, x2: MARGIN + 8, y2: y + lines.length * lh, width: 1.5, rgb: [0.6, 0.6, 0.6] });
    if (it.t === 'title') page.lines!.push({ x1: MARGIN, y1: y - 6, x2: MARGIN + width, y2: y - 6, width: 0.8, rgb: [0.55, 0.55, 0.55] });
    y -= s.after;
  });
  pages.push(page);
  const total = pages.length;
  pages.forEach((p, i) => {
    const words = `${i + 1} of ${total}`;
    const run: PdfRun = { x: (A4.w - textWidth(words, 'Helvetica', 8.5)) / 2, y: MARGIN / 2, text: words, font: 'Helvetica', size: 8.5, rgb: [0.45, 0.45, 0.45] };
    p.runs!.push(run);
  });
  return pages;
}

/** The standard fonts have every letter of it (else the phone draws its pages). */
export const canSetAsText = (d: Doc): boolean => fitsAnsi(`${d.title}\n${docText(d)}`);

/** The document as a PDF of words (null: it has letters only the phone can draw; docs/render.ts does those). */
export function pdfOfDoc(d: Doc, author = ''): Uint8Array | null {
  if (!canSetAsText(d)) return null;
  return writePdf(layoutPages(d), { title: d.title, ...(author ? { author } : {}) });
}

/** How long a document is, in words ("1 page", "about 3 minutes to read"). */
export function readingWords(d: Doc): string {
  const words = d.blocks.reduce((n, b) => n + (textOf(b).match(/\S+/g)?.length ?? 0), 0);
  const mins = Math.max(1, Math.round(words / 200));
  return `${words.toLocaleString('en-GB')} word${words === 1 ? '' : 's'}, about ${mins} minute${mins === 1 ? '' : 's'} to read`;
}
