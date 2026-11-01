/**
 * RIGHTS AND LAW in the Library (BRIEF-REST-E part 3): a topic opened as a page of its documents — each with its tier,
 * its publisher, its date, what kind of document it is, its finding as it puts it, and a link to the document itself;
 * the UK topics with "not legal advice" and who to call. The base is the brain's own (apps/edge/src/knowledge/rights),
 * the same data on the phone, so it opens with no signal. ASK ME sends a question about it to the brain, which answers
 * with these documents listed as its sources.
 */
import { h, clear } from '../core/dom';
import { button, modal } from '../ui/components';
import { tierOf, tierWord } from '../../../../packages/shared/src/sources';
import { CHECKED, contactsOf, NOT_ADVICE, RIGHTS, rightsDocs, type RightsTopic } from '../../../edge/src/knowledge/rights';

export const rightsState = { open: false, topic: '', docs: 0 };
let current: { close(): void } | null = null;

/** The topics, for the Library's panel: the UK ones first. */
export const rightsTopics = (): RightsTopic[] => [...RIGHTS.filter((t) => t.scope === 'uk'), ...RIGHTS.filter((t) => t.scope === 'world')];
export const rightsCount = (): number => rightsDocs().length;

const QUESTION: Record<string, string> = {
  'stop-and-search': 'What are my rights if the police stop and search me?',
  'police-station': 'What are my rights if I get arrested and taken to a police station?',
  'renting-repairs': 'What can I do if my landlord won’t fix the damp and mould?',
  eviction: 'What are my rights if my landlord wants to evict me?',
  consumer: 'What are my rights if something I bought is faulty?',
  work: 'What is the minimum wage for my age?',
  'school-exclusion': 'How do you challenge an exclusion from school?',
  disability: 'What are reasonable adjustments under the Equality Act?',
  'your-data': 'How do I make a subject access request for my data?',
};

/** The page: a topic's documents (or, with none named, the list of topics). */
export function openRights(id = ''): void {
  current?.close();
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.rights = rightsState;
  rightsState.open = true;
  const body = h('div.rtsheet');
  const show = (t: RightsTopic | null) => {
    rightsState.topic = t?.id ?? '';
    rightsState.docs = t?.docs.length ?? 0;
    if (!t) {
      const group = (scope: 'uk' | 'world', label: string) => h('div.rtgroup', h('small.cvgh', label), ...rightsTopics().filter((x) => x.scope === scope).map((x) => button(h('span.dcdoc', h('b', x.title), h('small', `${x.docs.length} document${x.docs.length === 1 ? '' : 's'}`)), () => show(x), 'dcopen')));
      clear(body, h('p.dcnote', `What the documents themselves say, each read on ${CHECKED.split('-').reverse().join('/')} and dated, linked and tiered. Not legal advice.`), group('uk', 'YOUR RIGHTS IN THE UK'), group('world', 'DOCUMENTED INTERNATIONAL MATTERS'));
      return;
    }
    const ask = QUESTION[t.id] ?? `What do the documents say about ${t.title.toLowerCase()}?`;
    clear(body,
      button('ALL TOPICS', () => show(null)),
      h('h3.rttitle', t.title),
      t.scope === 'uk' ? h('p.rtadvice', NOT_ADVICE) : h('p.dcnote', 'Each finding is put as strongly as its document puts it: a provisional order is not a judgment, a warrant is not a conviction, a commission’s or an organisation’s finding is theirs.'),
      ...t.docs.map((d, i) => h('article.rtdoc', { 'aria-label': `Document ${i + 1}: ${d.title}` },
        h('div.rthead', h('small.ctier', { dataset: { tier: tierOf(d.url), case: 'keep' } }, tierWord(tierOf(d.url))), h('small.rtwhen', `${d.by} · ${d.dated} ${d.date} · ${d.kind}`)),
        h('b.rtt', d.title),
        h('p.rtfinding', d.finding),
        h('a.rtlink', { href: d.url, target: '_blank', rel: 'noopener noreferrer' }, 'OPEN THE DOCUMENT'),
      )),
      t.scope === 'uk' ? h('div.rtcall', h('small.cvgh', 'WHO TO CALL'), ...contactsOf(t).map((c) => h('p.rtcontact', h('b', c.name), h('a', { href: `tel:${c.number.replace(/\s+/g, '')}` }, c.number), h('small', `${c.what}${c.hours ? `. ${c.hours}` : ''}.`)))) : null,
      button('ASK ME ABOUT IT', () => {
        current?.close();
        void import('../features/core/cards').then((m) => m.askInBox(ask));
      }, 'on'),
    );
  };
  current = modal('RIGHTS AND LAW', body, () => {
    rightsState.open = false;
    current = null;
  });
  show(RIGHTS.find((t) => t.id === id) ?? null);
}

