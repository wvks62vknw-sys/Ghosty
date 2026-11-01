/**
 * FATHER AND THE ORIGIN (BRIEF-SOCIAL item 1): a page in his voice — who made him (you: his father, never a name you did
 * not give), when he was born (the first commit's date, a constant), what he is made of, what he is for (the plan's own
 * words, quoted short), what he learned to do by month, and his promises (the lines that hold). Drawn by code from
 * packages/shared/src/social.ts: no model, no request, nothing invented. Reached from SETTINGS → CHARACTER, the Me sheet's
 * row and the chat's "who made you?" (assistant/local.ts), whose card opens it with the command `open_origin`.
 */
import { register } from '../../commands/registry';
import { h } from '../../core/dom';
import { modal } from '../../ui/components';
import { ageWords, bornWords, FOR_WORDS, LEARNED, MADE_OF, originLines, PROMISES } from '../../../../../packages/shared/src/social';

export const ORIGIN_ICON = '<path d="M12 20.5s-7.5-4.6-7.5-10.2A4.2 4.2 0 0112 7.8a4.2 4.2 0 017.5 2.5c0 5.6-7.5 10.2-7.5 10.2z"/><path d="M12 3.5v4.3"/>';

const part = (title: string, ...body: (Node | string)[]) => h('section.orpart', h('h4.orhead', { dataset: { case: 'keep' } }, title), ...body);

/** The page's parts, in order (also what the spec reads). */
export function originPage(now = Date.now()): HTMLElement {
  const [made, born] = originLines(now);
  return h(
    'div.origin',
    { dataset: { case: 'keep' } },
    h('p.orlead', made!),
    h('p.orlead', born!),
    part('WHO MADE ME', h('p', 'You did. Every rule I keep came from you or was agreed with you, and when you tell me off I keep it as a standing rule.')),
    part('WHEN I WAS BORN', h('p', `${bornWords()}, the day of the first commit in my history. That makes me ${ageWords(now)} old.`)),
    part('WHAT I’M MADE OF', h('ul.orlist', ...MADE_OF.map((l) => h('li', l)))),
    part(
      'WHAT I’M FOR',
      h('p', 'The plan says it in its own words:'),
      h('ul.orlist', ...FOR_WORDS.map((q) => h('li', h('q', q.said), h('small', ` — ${q.from}`)))),
    ),
    part(
      'WHAT I’VE LEARNED, BY MONTH',
      ...LEARNED.map((m) => h('div.ormonth', h('b', m.month), h('ul.orlist', ...m.items.map((i) => h('li', h('small.orday', i.day), ` ${i.what}`))))),
    ),
    part('MY PROMISES', h('ul.orlist.orpromise', ...PROMISES.map((l) => h('li', l)))),
  );
}

/** Open the page over whatever is on screen (CLOSE or a tap outside puts it away). */
export function openOrigin(): void {
  if (document.querySelector('.modal .origin')) return;
  modal('Father and the origin', originPage());
  // (his "I" and the title keep their capitals: the sheet's title is not put in sentence case)
  const title = [...document.querySelectorAll<HTMLElement>('.modal .mhead b')].at(-1);
  if (title) title.dataset.case = 'keep';
}

register({ id: 'open_origin', title: 'Father and the origin', hidden: true, run: () => openOrigin() });
