/**
 * THE WORKBENCH's answer card (OWNER-ISSUES 61b): the standing label FIRST ESTIMATE · NOT CERTIFIED (a shape and its words,
 * never colour alone), the title, the numbers (each a row of text VoiceOver reads), the confidence as a word with three bars,
 * then ASSUMED, HOW and WHAT WOULD CHANGE IT folded, and the caveat. A case outside a formula's range shows what it says and
 * no numbers.
 */
import { h, icon } from '../../core/dom';
import { LABEL, type Estimate } from '../../../../../packages/shared/src/workbench';

/** The caution shape: a triangle with a mark in it (the shape carries the meaning as well as the words). */
const CAUTION = '<path d="M12 3.5 21.5 20h-19z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 10v4.5M12 17v.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>';

/** The standing label row (its own words: VoiceOver reads "First estimate, not certified"). */
export function labelRow(words = LABEL, extra = ''): HTMLElement {
  return h('div.wblabel', { role: 'note', 'aria-label': `${words.replace(' · ', ', ').toLowerCase().replace(/^f/, 'F')}${extra ? `. ${extra}` : ''}` }, icon(CAUTION, 'wbcaut'), h('span', words), extra ? h('small', extra) : null);
}

const CONF: Record<Estimate['confidence'], number> = { rough: 1, fair: 2, good: 3 };

function fold(title: string, body: Node): HTMLElement {
  return h('details.wbfold', h('summary', title), body);
}

/** One estimate as a card. */
export function estimateCard(e: Estimate): HTMLElement {
  const card = h('div.wbcard', { role: 'group', 'aria-label': `${e.title}, first estimate, not certified`, dataset: { kind: e.kind } });
  card.append(labelRow(), h('div.wbtitle', e.title));
  if (e.problem) {
    card.append(h('div.wbproblem', { role: 'alert' }, icon(CAUTION, 'wbcaut'), h('span', `${e.problem.charAt(0).toUpperCase()}${e.problem.slice(1)}.`.replace(/\.\.$/, '.'))));
  } else {
    card.append(
      h('div.wblines', ...e.lines.map((l) => h('div.wbline', h('span.k', h('span', l.label), l.note ? h('small.n', l.note) : null), h('span.v', l.value)))),
      h('div.wbconf', { 'aria-label': `Confidence: ${e.confidence}` }, h('span.wbbars', { 'aria-hidden': 'true' }, ...[1, 2, 3].map((i) => h(`i${i <= CONF[e.confidence] ? '.on' : ''}` as 'i'))), h('span', `Confidence: ${e.confidence}`)),
    );
    if (e.assumptions.length) card.append(fold('ASSUMED', h('ul', ...e.assumptions.map((a) => h('li', a)))));
    if (e.method) card.append(fold('HOW', h('p', e.method)));
    if (e.changes.length) card.append(fold('WHAT WOULD CHANGE IT', h('ul', ...e.changes.map((c) => h('li', c)))));
  }
  card.append(h('p.wbcaveat', e.caveat));
  return card;
}
