/**
 * ONE SENTENCE A SCREEN (POLISH 3): a line a screen says is one sentence; the rest of what it said goes behind a "?" right under it
 * (a tap, never a smaller type). Pure helpers and the one element, used where a long text comes from a table (a theme's notes, a mark's rule).
 */
import { h } from '../core/dom';

/** The first sentence of a text and what followed it ('' when it is one). */
export function firstSentence(text: string): [string, string] {
  const t = text.replace(/\s+/g, ' ').trim();
  const m = /^(.*?[.!?…]["”’)]*)\s+(?=[A-Z“"‘(‹])([\s\S]*)$/.exec(t);
  return m ? [m[1]!, m[2]!] : [t, ''];
}

/** How many sentences a text has (a terminal full stop, question or exclamation mark, or the text's end). */
export function sentenceCount(text: string): number {
  const t = text.replace(/\s+/g, ' ').trim();
  return t ? (t.match(/[.!?…]["”’)]*(?=\s+[A-Z“"‘(‹]|$)/g) ?? []).length || 1 : 0;
}

/** A "WHY" for the rest: a details element, its key 44 pt (the .pkmore rule). */
export const rest = (text: string, key = 'WHY'): HTMLElement => h('details.pkmore', h('summary', key), h('p.pknote', { dataset: { case: 'keep' } }, text));

/** A line in one sentence with the rest behind a "?": the nodes to put where the paragraph was. */
export function para(selector: `${'p' | 'div' | 'span' | 'small'}.${string}`, text: string, laterOrKey?: string, key = 'WHY'): HTMLElement[] {
  // (the rest may be given as its own text: each sentence its own literal)
  const [first, more] = laterOrKey === undefined || laterOrKey === 'WHY' ? firstSentence(text) : [text, laterOrKey];
  return [h(selector as 'div', { dataset: { case: 'keep' } }, first), ...(more ? [rest(more, key)] : [])];
}
