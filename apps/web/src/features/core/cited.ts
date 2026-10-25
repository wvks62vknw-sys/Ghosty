/**
 * A cited answer in the chat log: its [n] markers as chips that open the source (the page, or
 * the library passage it came from), the SOURCES list under the reply, and the check line
 * ("✓ 5 of 6 claims found in the sources", beside its readout: a segment per claim, the found ones lit) with the
 * claims no source backed marked in the reply.
 */
import type { Citation, CitedInfo } from '../../../../../packages/shared/src/protocol';
import { citedBody, citedPieces } from '../../cited/text';
import { h } from '../../core/dom';
import { go } from '../../shell/tabs';
import { button, modal, toast } from '../../ui/components';
import { claimsInst } from '../../ui/instruments';

/** A library source: the words that back the answer, and a way to the shelf. */
function openDoc(c: Citation): void {
  const box = h('div.citedoc', h('div.note', `From your library: ${c.doc ?? c.title}`), c.quote ? h('blockquote', c.quote) : h('div.note', 'The passage is in the library under this title.'));
  const m = modal(`[${c.n}] ${c.title}`, h('div', box, h('div.keyrow', button('OPEN LIBRARY', () => (m.close(), go('library')), 'on'))));
}

function missing(c: Citation): void {
  toast(`Source [${c.n}] was never looked up this turn — treat what it backs with care.`, 'warn');
}

/** The chip for source `n` (or a flagged one when the answer names no such source). */
function chip(n: number, info: CitedInfo, unconfirmed: boolean): HTMLElement {
  const c = info.citations.find((x) => x.n === n) ?? { n, title: 'no source was listed for this number', missing: true };
  const cls = `cite${c.missing ? '.miss' : ''}${unconfirmed ? '.un' : ''}`;
  const tip = c.missing ? `Source ${n}: never looked up` : `Source ${n}: ${c.title}`;
  if (c.url && !c.missing) return h(`a.${cls}` as 'a', { href: c.url, target: '_blank', rel: 'noopener noreferrer', title: tip, 'aria-label': tip, 'data-n': String(n) }, String(n));
  const b = h(`button.${cls}` as 'button', { type: 'button', title: tip, 'aria-label': tip, 'data-n': String(n) }, String(n));
  b.addEventListener('click', () => (c.missing ? missing(c) : openDoc(c)));
  return b;
}

/** One row of the SOURCES list. */
function sourceRow(c: Citation): HTMLElement {
  // "[1]": route C shows the number alone in a small square (the brackets are hidden there, styles.css)
  const label = h('b', h('i.br', '['), String(c.n), h('i.br', ']'));
  const where = c.url ? c.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : c.doc ? 'your library' : '';
  const inner = [label, h('span', c.title), where ? h('em', where) : null, c.missing ? h('i', 'never looked up — not a checked source') : null];
  if (c.url && !c.missing) return h('a.csrc', { href: c.url, target: '_blank', rel: 'noopener noreferrer' }, ...inner);
  const row = h(`button.csrc${c.missing ? '.miss' : ''}` as 'button', { type: 'button' }, ...inner);
  row.addEventListener('click', () => (c.missing ? missing(c) : openDoc(c)));
  return row;
}

/** The reply, drawn with its chips, sources and check line; `linked` makes web links in the words tappable. */
export function citedReply(text: string, info: CitedInfo, linked: (t: string) => HTMLElement): HTMLElement[] {
  const words = h('span.citedtext');
  for (const p of citedPieces(citedBody(text), info)) {
    if (p.kind === 'cite') words.append(chip(p.n, info, !!p.unconfirmed));
    else if (p.unconfirmed) words.append(h('mark.unconf', { title: 'Not found in the sources' }, linked(p.text)));
    else words.append(linked(p.text));
  }
  const out: HTMLElement[] = [words];
  if (info.citations.length) out.push(h('div.citesrc', h('small', 'SOURCES'), ...info.citations.map(sourceRow)));
  if (info.checks.length) {
    const ok = info.checks.filter((c) => c.status === 'supported').length;
    const all = ok === info.checks.length;
    // the claims readout: one segment per claim, the ones found in the sources lit, beside the check line
    out.push(h(`div.rcclaims.${all ? 'ok' : 'warn'}` as 'div', claimsInst(ok, info.checks.length),
      h(`div.citecheck.${all ? 'ok' : 'warn'}` as 'div', `${ok ? '✓' : '✕'} ${ok} of ${info.checks.length} claim${info.checks.length === 1 ? '' : 's'} found in the sources`, all ? null : h('span', ' · the unconfirmed ones are marked'))));
  }
  return out;
}
