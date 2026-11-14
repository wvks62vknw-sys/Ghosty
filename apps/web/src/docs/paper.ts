/**
 * PAPER INTO AN EDITABLE DOCUMENT (NEXT ROUND, editors.s3): what the scan's page reader read (vision/ocr.ts, its words with their
 * boxes) laid out as a document he can edit — headings by the size of their letters, paragraphs by the gaps between lines, a letter's
 * address and date kept to the right with their line breaks, bullets and numbered lines as lists, a page break between pages — as
 * well as the reader can. Text he edited after the reading (no boxes any more) is laid out from its blank lines and short lines. A
 * receipt becomes a row of a spreadsheet: its date, shop and total (packages/shared homeadmin.ts readReceipt), added through the
 * sheets' model to the RECEIPTS spreadsheet on this phone. Pure but for the stores; nothing is sent anywhere.
 */
import type { OcrWord } from '../vision/ocrtext';
import { joinHyphens } from '../vision/ocrtext';
import { readReceipt } from '../../../../packages/shared/src/homeadmin';
import { block, blockId, newDoc, tidyRuns, type Block, type Doc } from './model';

/** One page as the reader gave it: its cleaned text and, when the reading is fresh, its words with their boxes. */
export interface PaperPage {
  text: string;
  words?: OcrWord[];
}

interface Line {
  text: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  h: number;
}
const median = (xs: number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
};
const LIST = /^\s*(?:([•·▪●◦\-–*])|(\d{1,2}|[a-z])[.)])\s+/;
const sentenceEnd = /[.!?:;,]$/;
/** A line in capitals ("MEETING NOTES"): words of letters, not a postcode or a reference. */
const capsLine = (t: string): boolean => (t.match(/\p{Lu}{3,}/gu) ?? []).length >= 1 && !/\p{Ll}/u.test(t) && (t.match(/\d/g) ?? []).length <= 2;

/** The reader's words grouped into lines, top to bottom, each line's words left to right. */
export function linesOf(words: OcrWord[], minConf = 30): Line[] {
  const ws = words.filter((w) => w.text?.trim() && w.bbox && w.bbox.y1 > w.bbox.y0 && w.bbox.x1 > w.bbox.x0 && (w.confidence ?? 100) >= minConf);
  if (!ws.length) return [];
  const H = median(ws.map((w) => w.bbox.y1 - w.bbox.y0)) || 1;
  const sorted = [...ws].sort((a, b) => (a.bbox.y0 + a.bbox.y1) / 2 - (b.bbox.y0 + b.bbox.y1) / 2);
  const groups: OcrWord[][] = [];
  for (const w of sorted) {
    const yc = (w.bbox.y0 + w.bbox.y1) / 2;
    const g = groups[groups.length - 1];
    if (g) {
      const gc = median(g.map((x) => (x.bbox.y0 + x.bbox.y1) / 2));
      if (Math.abs(yc - gc) < H * 0.55) {
        g.push(w);
        continue;
      }
    }
    groups.push([w]);
  }
  return groups.map((g) => {
    g.sort((a, b) => a.bbox.x0 - b.bbox.x0);
    return {
      text: g.map((w) => w.text.trim()).join(' '),
      x0: Math.min(...g.map((w) => w.bbox.x0)),
      x1: Math.max(...g.map((w) => w.bbox.x1)),
      y0: Math.min(...g.map((w) => w.bbox.y0)),
      y1: Math.max(...g.map((w) => w.bbox.y1)),
      h: median(g.map((w) => w.bbox.y1 - w.bbox.y0)),
    };
  });
}

const listBlock = (t: string): Block | null => {
  const m = LIST.exec(t);
  if (!m) return null;
  return block(m[1] ? 'ul' : 'ol', t.slice(m[0].length).trim());
};

/** One page laid out from its lines' boxes: sizes make headings, gaps make paragraphs, a block on the right half stays there. */
export function blocksFromLines(lines: Line[]): Block[] {
  if (!lines.length) return [];
  const H = median(lines.map((l) => l.h)) || 1;
  const left = Math.min(...lines.map((l) => l.x0));
  const right = Math.max(...lines.map((l) => l.x1));
  const W = Math.max(1, right - left);
  const out: Block[] = [];
  let para: Line[] = [];
  const kindOf = (l: Line): 'h1' | 'h2' | 'right' | 'p' => {
    // a block on the right half (a letter's address and date) stays there, whatever its letters
    if (l.x0 > left + W * 0.45) return 'right';
    if (l.h >= H * 1.6 && l.text.length <= 90) return 'h1';
    if ((l.h >= H * 1.22 || capsLine(l.text)) && l.text.length <= 80 && !sentenceEnd.test(l.text)) return 'h2';
    return 'p';
  };
  const flush = () => {
    if (!para.length) return;
    const k = kindOf(para[0]!);
    if (k === 'right') out.push(block('right', para.map((l) => l.text).join('\n')));
    else if (k === 'h1' || k === 'h2') out.push(block(k, para.map((l) => l.text).join(' ')));
    else {
      // a short line or two (a greeting, a sign-off, an address on the left) keep their breaks; prose is joined
      const short = para.every((l) => l.x1 - l.x0 < W * 0.6) && para.slice(1).every((l) => !/^\p{Ll}/u.test(l.text));
      const words = short && para.length <= 6 ? para.map((l) => l.text).join('\n') : joinHyphens(para.map((l) => l.text).join('\n')).replace(/\n/g, ' ');
      const b = block('p', words);
      const mid = (para[0]!.x0 + para[0]!.x1) / 2;
      if (para.length <= 3 && para[0]!.x0 > left + W * 0.12 && Math.abs(mid - (left + right) / 2) < W * 0.08) b.align = 'center';
      out.push(b);
    }
    para = [];
  };
  // the usual step from one line to the next: a paragraph break is a clearly bigger step (a blank line between)
  const steps = lines.slice(1).map((l, k) => l.y0 - lines[k]!.y0).filter((d) => d > 0 && d < H * 2.6);
  const pitch = median(steps) || H * 1.4;
  const breakAt = Math.max(H * 1.6, pitch * 1.4);
  let prev: Line | null = null;
  for (const l of lines) {
    const li = listBlock(l.text);
    if (li) {
      flush();
      out.push(li);
      prev = l;
      continue;
    }
    if (prev && para.length) {
      const step = l.y0 - prev.y0;
      const sizeJump = Math.max(l.h, prev.h) > Math.min(l.h, prev.h) * 1.4;
      const sideJump = (kindOf(l) === 'right') !== (kindOf(para[0]!) === 'right');
      const headingDone = kindOf(para[0]!) === 'h1' || kindOf(para[0]!) === 'h2' ? kindOf(l) !== kindOf(para[0]!) : false;
      if (step > breakAt || sizeJump || sideJump || headingDone) flush();
    } else if (!prev || l.y0 - prev.y0 > breakAt) flush();
    para.push(l);
    prev = l;
  }
  flush();
  return out;
}

/** Text (edited by him, or read without boxes) laid out: blank lines part paragraphs, a short line alone over others is a heading. */
export function blocksFromText(text: string): Block[] {
  const groups = text.replace(/\r/g, '').split(/\n\s*\n/).map((g) => g.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)).filter((g) => g.length);
  const out: Block[] = [];
  groups.forEach((g, gi) => {
    if (g.every((l) => LIST.test(l))) {
      for (const l of g) out.push(listBlock(l)!);
      return;
    }
    const first = g[0]!;
    // a short line with no full stop, standing over more words (or in capitals): a heading; the first one of all is the top heading
    const headish = first.length <= 70 && !sentenceEnd.test(first) && (capsLine(first) || g.length > 1 || (groups[gi + 1]?.length ?? 0) > 0) && /\p{L}{2}/u.test(first) && !/^(?:dear|to|from|yours|kind regards|best wishes|regards)\b/i.test(first) && !/\d{3,}|@|£/.test(first);
    let rest = g;
    if (headish && (g.length === 1 || g.slice(1).some((l) => l.length > first.length))) {
      out.push(block(out.some((b) => b.t === 'h1') ? 'h2' : 'h1', first));
      rest = g.slice(1);
    }
    if (!rest.length) return;
    // an address or a date block (all short lines) keeps its breaks; prose is joined into one paragraph
    const short = rest.every((l) => l.length <= 44) && rest.length <= 7 && rest.length > 1 && rest.slice(1).every((l) => !/^\p{Ll}/u.test(l));
    out.push(block('p', short ? rest.join('\n') : joinHyphens(rest.join('\n')).replace(/\n/g, ' ')));
  });
  return out;
}

/** "— Page 2 —", as READ ALL heads each page: taken off, the pages parted where they were. */
const PAGE_HEAD = /^—\s*Page\s+\d+\s*—\s*$/m;
export function pagesOfText(text: string): string[] {
  if (!PAGE_HEAD.test(text)) return [text];
  return text.split(/^—\s*Page\s+\d+\s*—\s*$/m).map((t) => t.trim()).filter(Boolean);
}

/** The pages as one document's blocks: from the boxes while the reading is fresh, from the text when not; a page break between pages. */
export function paperBlocks(pages: PaperPage[]): Block[] {
  const out: Block[] = [];
  pages.forEach((p, k) => {
    const lines = p.words?.length ? linesOf(p.words) : [];
    const blocks = lines.length >= 2 ? blocksFromLines(lines) : blocksFromText(p.text);
    if (!blocks.length) return;
    if (k && out.length) out.push({ id: blockId(), t: 'pb', runs: [] });
    out.push(...blocks.map((b) => ({ ...b, runs: tidyRuns(b.runs) })));
  });
  return out;
}

/** What the document is called: its first heading, else "Scanned letter, 14 November 2026". */
export function paperTitle(blocks: Block[], day = new Date()): string {
  const h = blocks.find((b) => b.t === 'h1') ?? blocks.find((b) => b.t === 'h2');
  const words = h?.runs.map((r) => r.text).join('').trim();
  if (words) return words.length > 70 ? `${words.slice(0, 68).trim()}…` : words;
  return `Scanned letter, ${day.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

/** The scan made a document (kind 'document', from "scanned on this phone"), its heading taken as the title when it starts with one. */
export function paperDoc(pages: PaperPage[], day = new Date()): Doc | null {
  const blocks = paperBlocks(pages);
  if (!blocks.some((b) => b.runs.some((r) => r.text.trim()))) return null;
  const title = paperTitle(blocks, day);
  // the heading that is the title is not said twice: the first heading, when nothing but an address or a date stands before it
  const at = blocks.findIndex((b) => (b.t === 'h1' || b.t === 'h2') && b.runs.map((r) => r.text).join('').trim() === title);
  const body = at >= 0 && blocks.length > 1 && blocks.slice(0, at).every((b) => b.t === 'right') ? blocks.filter((_, k) => k !== at) : blocks;
  return newDoc(title, body, 'document', 'scanned on this phone');
}

// ---------------------------------------------------------------- a receipt, a row

export interface ReceiptRow {
  /** YYYY-MM-DD, or '' when the reader found none. */
  date: string;
  shop: string;
  /** "12.40", or '' when none was found. */
  total: string;
}
/** Today in London (YYYY-MM-DD): a receipt's year is guessed from it. */
export const londonToday = (now = new Date()): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
/** The date, the shop and the total on a receipt's text, as well as the reader can (he checks them before they are added). */
export function receiptOf(text: string, today = londonToday()): ReceiptRow {
  const r = readReceipt(text, today);
  return { date: r.date, shop: r.store, total: r.total == null ? '' : r.total.toFixed(2) };
}

/** The spreadsheet receipts go into, its header row: DATE, SHOP, TOTAL. */
export const RECEIPTS_TITLE = 'Receipts';
export const RECEIPTS_HEAD = ['Date', 'Shop', 'Total'] as const;
