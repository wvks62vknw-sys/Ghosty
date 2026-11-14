/**
 * HIGHLIGHTS AND NOTES IN HIS BOOKS (learn.u4), kept on this phone only: he selects a sentence in the reader and taps HIGHLIGHT
 * (or HIGHLIGHT AND NOTE to add his own words); the reader marks it from then on, ABOUT lists every one for the book (a tap
 * goes there), and EXPORT NOTES gives them all as one Markdown file (or copies them), quote, note and where it is.
 */
import { createStore } from '../core/store';

export interface Highlight {
  id: string;
  /** The passage and the paragraph (its offset in the passage), and the range inside the paragraph's text. */
  n: number;
  at: number;
  start: number;
  end: number;
  text: string;
  note?: string;
  /** Where it is, as the reader names it ("Chapter 3", "page 12"), for the list and the export. */
  where?: string;
  made: number;
}

export const highlights = createStore<{ byDoc: Record<string, Highlight[]> }>({ byDoc: {} }, { persist: 'ghosty.highlights', keys: ['byDoc'] });

export const highlightsOf = (doc: string): Highlight[] => [...(highlights.get().byDoc[doc] ?? [])].sort((a, b) => a.n - b.n || a.at - b.at || a.start - b.start);

/** Kept (a range overlapping one already there joins it, his notes kept). */
export function addHighlight(doc: string, x: Omit<Highlight, 'id' | 'made'>): Highlight {
  const all = highlights.get().byDoc[doc] ?? [];
  const over = all.filter((y) => y.n === x.n && y.at === x.at && y.start < x.end && x.start < y.end);
  const merged: Highlight = over.length
    ? { ...x, id: over[0]!.id, made: over[0]!.made, start: Math.min(x.start, ...over.map((y) => y.start)), end: Math.max(x.end, ...over.map((y) => y.end)), note: [x.note, ...over.map((y) => y.note)].filter(Boolean).join(' · ') || undefined }
    : { ...x, id: `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, made: Date.now() };
  if (over.length) merged.text = x.text.length >= merged.end - merged.start ? x.text : merged.text;
  highlights.set((s) => ({ byDoc: { ...s.byDoc, [doc]: [...all.filter((y) => !over.includes(y)), merged] } }));
  return merged;
}
export const removeHighlight = (doc: string, id: string): void =>
  highlights.set((s) => ({ byDoc: { ...s.byDoc, [doc]: (s.byDoc[doc] ?? []).filter((y) => y.id !== id) } }));
export const setNote = (doc: string, id: string, note: string): void =>
  highlights.set((s) => ({ byDoc: { ...s.byDoc, [doc]: (s.byDoc[doc] ?? []).map((y) => (y.id === id ? { ...y, note: note.trim() || undefined } : y)) } }));

/** A paragraph's text split into plain and highlighted parts (ranges clipped, overlaps joined). Pure. */
export function hlParts(text: string, hs: Pick<Highlight, 'start' | 'end' | 'id'>[]): { text: string; id?: string }[] {
  const rs = hs.map((x) => ({ s: Math.max(0, x.start), e: Math.min(text.length, x.end), id: x.id })).filter((r) => r.e > r.s).sort((a, b) => a.s - b.s);
  const out: { text: string; id?: string }[] = [];
  let at = 0;
  for (const r of rs) {
    if (r.s < at) continue;
    if (r.s > at) out.push({ text: text.slice(at, r.s) });
    out.push({ text: text.slice(r.s, r.e), id: r.id });
    at = r.e;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}

/** Every highlight of a book as Markdown: the title, then each quote, his note and where it is. Pure. */
export function notesMarkdown(title: string, hs: Highlight[]): string {
  const lines = [`# ${title}`, '', `My highlights and notes (${hs.length}), from Ghosty.`, ''];
  for (const x of hs) {
    lines.push(`> ${x.text.replace(/\s+/g, ' ').trim()}`, '');
    if (x.note) lines.push(x.note, '');
    if (x.where) lines.push(`*${x.where}*`, '');
  }
  return lines.join('\n');
}
