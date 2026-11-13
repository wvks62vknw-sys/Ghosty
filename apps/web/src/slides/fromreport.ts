/**
 * A REPORT BECOMES A DECK (BRIEF-EDITOR-PRESENTATIONS; IDEAS-ROUND-1 item 6): a research report from the cited pipeline (its sections,
 * its sources, its chart), a document from MY DOCUMENTS, or any chat reply with headings, made into slides he can edit: a title
 * slide from the report's title and the date; one slide for each heading with its first lines as bullets (the section's whole
 * text goes to the speaker notes, so nothing the report said is lost); a chart slide where a section holds numbers that draw as a
 * chart; a sources slide at the end with the citations. Pure: apps/edge/test/slides.test.mjs.
 */
import { seriesFrom } from '../../../../packages/shared/src/chart';
import { block, fromMarkdown, textOf, type Block, type Doc, type Run } from '../docs/model';
import { bullets, newDeck, newSlide, setMedia, type Deck, type Slide } from './model';

export interface ReportOpts {
  /** The deck's title when the report has none of its own. */
  title?: string;
  /** Today, as he says it ("12 November 2026"). */
  date?: string;
  /** The citations, when they are not in the report's own words. */
  sources?: string[];
}

const SOURCES_HEAD = /^(?:sources?|references?|citations?|bibliography|further reading)\b/i;
const MAX_BULLETS = 5;
const MAX_LEN = 118;

/** One line short enough for a slide: whole sentences where they fit, else cut at a comma or a word. */
export function short(t: string): string {
  const s = t.replace(/\s+/g, ' ').trim();
  if (s.length <= MAX_LEN) return s.replace(/[.;]$/, '');
  const cut = s.slice(0, MAX_LEN);
  const at = Math.max(cut.lastIndexOf(', '), cut.lastIndexOf('; '), cut.lastIndexOf(' – '), cut.lastIndexOf(' — '));
  if (at > MAX_LEN * 0.5) return cut.slice(0, at).trim();
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:\s]+$/, '')}…`;
}
const sentences = (t: string): string[] => t.replace(/\s+/g, ' ').match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g)?.map((x) => x.trim()).filter((x) => x.length > 2) ?? [];
/** A block's words as runs, with a citation mark like [1] left in (a slide may show where a fact came from). */
const clip = (runs: Run[], n: number): Run[] => {
  let left = n;
  const out: Run[] = [];
  for (const r of runs) {
    if (left <= 0) break;
    out.push(r.text.length <= left ? r : { ...r, text: r.text.slice(0, left) });
    left -= r.text.length;
  }
  return out;
};

/** The bullets a section's blocks give: its list items first, else the first sentences of its paragraphs. */
export function bulletsOf(blocks: Block[]): Block[] {
  const list = blocks.filter((b) => b.t === 'ul' || b.t === 'ol');
  const out: Block[] = [];
  if (list.length) {
    for (const b of list.slice(0, MAX_BULLETS)) out.push(block('ul', textOf(b).length <= MAX_LEN ? b.runs : [{ text: short(textOf(b)) }]));
    return out;
  }
  for (const b of blocks) {
    if (b.t !== 'p' && b.t !== 'quote') continue;
    for (const s of sentences(textOf(b))) {
      if (out.length >= MAX_BULLETS) return out;
      out.push(block('ul', short(s)));
    }
  }
  return out;
}

const notesOf = (blocks: Block[]): string => blocks.filter((b) => b.t !== 'table' && b.t !== 'img' && b.t !== 'pb').map((b) => (b.t === 'ul' ? `• ${textOf(b)}` : b.t === 'ol' ? `– ${textOf(b)}` : textOf(b))).filter((l) => l.trim()).join('\n');

/** Slides from blocks: the title, then a slide for each heading; a leading text before the first heading becomes an overview. */
export function deckFromBlocks(title: string, blocks: Block[], o: ReportOpts = {}, from = 'a report'): Deck {
  const slides: Slide[] = [];
  // the sources: a section with that name, or the citations handed in
  const sections: { head: Block | null; body: Block[] }[] = [];
  let cur: { head: Block | null; body: Block[] } = { head: null, body: [] };
  const only1 = blocks[0]?.t === 'h1' && blocks.filter((b) => b.t === 'h1').length === 1 && !!textOf(blocks[0]!).trim();
  let deckTitle = o.title?.trim() || title.trim();
  let rest = blocks;
  if (only1) {
    deckTitle = textOf(blocks[0]!).trim() || deckTitle;
    rest = blocks.slice(1);
  }
  const top = rest.some((b) => b.t === 'h1' || b.t === 'h2');
  const splitAt = (b: Block) => b.t === 'h1' || b.t === 'h2' || (b.t === 'h3' && !top);
  for (const b of rest) {
    if (splitAt(b) && textOf(b).trim()) {
      sections.push(cur);
      cur = { head: b, body: [] };
    } else cur.body.push(b);
  }
  sections.push(cur);
  const sourceLines: string[] = [...(o.sources ?? [])];
  let charted = false;
  slides.push(newSlide('title', { title: block('h1', deckTitle || 'Untitled deck'), body: o.date ? [block('p', o.date)] : [] }));
  for (const sec of sections) {
    const head = sec.head ? textOf(sec.head).trim() : '';
    if (sec.head && SOURCES_HEAD.test(head)) {
      for (const b of sec.body) {
        if (b.t === 'ul' || b.t === 'ol') sourceLines.push(textOf(b));
        else if (b.t === 'p') sourceLines.push(...textOf(b).split('\n').map((l) => l.trim()).filter(Boolean));
      }
      continue;
    }
    if (!sec.head && !sec.body.some((b) => textOf(b).trim())) continue;
    const body = bulletsOf(sec.body);
    const text = sec.body.map(textOf).join('\n');
    const series = !charted ? seriesFrom(text) : null;
    slides.push(newSlide('bullets', { title: block('h1', sec.head ? head : 'Overview'), body, notes: notesOf(sec.body) }));
    if (series) {
      charted = true;
      let sl = newSlide('chart', { title: block('h1', head ? `${head}: the numbers` : 'The numbers'), notes: 'These are the numbers the report gives.' });
      sl = setMedia(sl, { k: 'chart', chart: { kind: series.kind, points: series.points, unit: series.unit, before: series.before } });
      slides.push(sl);
    }
  }
  // sources last, each a line; a long list is split over slides of eight
  const src = [...new Set(sourceLines.map((l) => l.replace(/^\s*(?:\[\d+\]|\d+[.)])\s*/, '').trim()).filter(Boolean))];
  for (let i = 0; i < src.length; i += 8) slides.push(newSlide('bullets', { title: block('h1', src.length > 8 ? `Sources (${Math.floor(i / 8) + 1} of ${Math.ceil(src.length / 8)})` : 'Sources'), body: src.slice(i, i + 8).map((l) => block('ol', clip([{ text: l.length > 150 ? `${l.slice(0, 147)}…` : l }], 150))) }));
  return newDeck(deckTitle || 'Untitled deck', slides, from);
}

/** A report in Markdown (a reply with headings) as a deck. */
export function deckFromMarkdown(md: string, o: ReportOpts = {}, from = 'a report'): Deck {
  return deckFromBlocks('', fromMarkdown(md.replace(/\r\n?/g, '\n')), o, from);
}
/** A document of his (MY DOCUMENTS) as a deck. */
export function deckFromDoc(d: Doc, o: ReportOpts = {}): Deck {
  return deckFromBlocks(d.title, d.blocks, { ...o, title: o.title || d.title }, `“${d.title}”`);
}
/** A chart the Stage showed, as a deck of two slides. */
export function deckFromChart(title: string, c: { kind: 'bars' | 'line'; points: { label: string; value: number }[]; unit: string; before: boolean }, o: ReportOpts = {}): Deck {
  const t = title.trim() || 'The numbers';
  let sl = newSlide('chart', { title: block('h1', t) });
  sl = setMedia(sl, { k: 'chart', chart: c });
  return newDeck(t, [newSlide('title', { title: block('h1', t), body: o.date ? [block('p', o.date)] : [] }), sl], 'a chart');
}
export { bullets };
