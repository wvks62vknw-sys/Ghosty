/**
 * MEETINGS (THE NEXT ROUND, the money lane; money.s9): before a meeting, its agenda; during it, notes typed as it goes (kept on this
 * phone as he types, so nothing is lost); after it, SUM IT UP turns the agenda and notes into the decisions, the actions and who has
 * them (the work pack's own `meeting` reading, no model), kept in his documents library, with his own actions one tap from his
 * to-do list. Nothing is sent to anyone.
 */
import { h } from '../../core/dom';
import { button, modal } from '../../ui/components';
import { brain } from '../../api/brain';
import { sayError } from '../../ui/hisWords';
import { emptyState, lacksSignal, phrases, stateIn, waitFor } from '../lifeui';
import { keepInLibrary } from './library';

export const MEETINGS_TITLE = 'MEETINGS';
interface Meeting {
  id: string;
  title: string;
  when: string;
  agenda: string;
  notes: string;
  summary?: string;
  mine?: string[];
  at: number;
}
const KEY = 'ghosty.work.meetings';
const MAX = 40;
export const meetingsState = { list: [] as string[], summed: 0 };

function all(): Meeting[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Meeting[];
    return Array.isArray(v) ? v.filter((m) => m && typeof m.id === 'string') : [];
  } catch {
    return [];
  }
}
function put(list: Meeting[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    return true;
  } catch {
    return false;
  }
}
const label = (b: HTMLButtonElement, l: string) => (b.setAttribute('aria-label', l), b);
const nice = (when: string) => (when ? new Date(when).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'no time set');

export function meetingsScreen(): { el: HTMLElement; stop(): void } {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.meetings = meetingsState;
  const status = h('p.pknote', { 'aria-live': 'polite' });
  const list = h('div.pkcol', { 'aria-live': 'polite' });
  const title = h('input', { type: 'text', placeholder: 'Team catch-up', 'aria-label': 'What the meeting is', enterKeyHint: 'next' }) as HTMLInputElement;
  const when = h('input', { type: 'datetime-local', 'aria-label': 'When it is (you can leave it)' }) as HTMLInputElement;
  const agenda = h('textarea', { rows: 3, placeholder: 'One point a line: the rota, the new starter, holidays', 'aria-label': 'The agenda, one point a line' }) as HTMLTextAreaElement;
  const save = (m: Meeting) => {
    const rest = all().filter((x) => x.id !== m.id);
    if (!put([m, ...rest])) stateIn(status, 'error', 'This phone’s storage is full, so the meeting could not be kept. Forget an old one first.');
  };
  const add = () => {
    if (!title.value.trim()) return void stateIn(status, '', 'Say what the meeting is first, like “team catch-up”.');
    const m: Meeting = { id: `m${Date.now().toString(36)}`, title: title.value.trim().slice(0, 80), when: when.value, agenda: agenda.value.trim().slice(0, 4000), notes: '', at: Date.now() };
    save(m);
    title.value = '';
    when.value = '';
    agenda.value = '';
    stateIn(status, '', `Kept: ${m.title}. Open it to take notes as it goes.`);
    paint();
  };
  const openOne = (m: Meeting) => {
    const notes = h('textarea', { rows: 8, placeholder: 'Notes as it goes: “Agreed: rota changes from Monday. Sam to send the plan by Friday.”', 'aria-label': `Notes for ${m.title}` }) as HTMLTextAreaElement;
    notes.value = m.notes;
    const said = h('p.pknote', { 'aria-live': 'polite' }, 'Kept on this phone as you type.');
    notes.addEventListener('input', () => save({ ...m, notes: (m.notes = notes.value.slice(0, 20_000)) }));
    const out = h('div.pkcol', { 'aria-live': 'polite' });
    const show = () => {
      if (!m.summary) return void out.replaceChildren();
      const todo = (m.mine ?? []).length
        ? [label(button(`Add my ${m.mine!.length} to the to-do list`, async () => {
            try {
              const r = await brain.packDo('work', 'todo', { words: `add: ${m.mine!.join('\n').slice(0, 540)}` });
              stateIn(said, '', r.text);
            } catch (e) {
              stateIn(said, 'error', sayError(e, 'add them'));
            }
          }, 'on'), 'Add my actions to the to-do list')]
        : [];
      out.replaceChildren(h('div.lab', 'SUMMED UP'), h('pre.pkdoc', { tabindex: '0', 'aria-label': `The summary of ${m.title}` }, m.summary), h('div.pkrow', ...todo), h('small.pklab', 'From your notes only. It is kept in your documents library on WORK → Document.'));
    };
    const sum = label(button('Sum it up', async () => {
      const text = `${m.title}\nAgenda:\n${m.agenda}\n\nNotes:\n${notes.value}`.trim();
      if (notes.value.trim().length < 20) return void stateIn(said, '', 'Type a few notes first: what was agreed and who is doing what.');
      if (lacksSignal()) return void stateIn(said, 'offline', 'No signal. Your notes are kept here; sum it up when the phone is back online.');
      const done = waitFor(out, 'Summing up your notes…');
      try {
        const r = await brain.packDo('work', 'meeting', { text });
        const data = r.data as { meeting?: { actions?: { who?: string; what: string; due?: string }[] } } | undefined;
        m.summary = r.text.replace(/\nFrom your notes only; nothing is added\.$/, '');
        m.mine = (data?.meeting?.actions ?? []).filter((x) => !x.who || /^(?:me|i)$/i.test(x.who)).map((x) => `${x.what}${x.due ? ` by ${x.due}` : ''}`);
        save(m);
        keepInLibrary(`Meeting: ${m.title}`, 'meeting', m.summary);
        meetingsState.summed++;
        stateIn(said, '', 'Summed up from your notes.');
        show();
      } catch (e) {
        stateIn(said, 'error', sayError(e, 'sum it up'));
      } finally {
        done();
      }
    }, 'on'), `Sum up ${m.title}`);
    show();
    modal(m.title.slice(0, 30).toUpperCase(), h('div.pk', { dataset: { pack: 'work', screen: 'meeting' } }, h('div.pkcol',
      h('span.pklab', nice(m.when)),
      ...(m.agenda ? [h('div.lab', 'AGENDA'), ...m.agenda.split('\n').filter((x) => x.trim()).map((x) => h('p.pknote', { dataset: { case: 'keep' } }, `• ${x.trim()}`))] : []),
      h('div.lab', 'NOTES'), notes, h('div.pkrow', sum), said, out)), () => paint());
  };
  const paint = () => {
    const ms = all();
    meetingsState.list = ms.map((m) => `${m.title}${m.summary ? ' summed' : ''}`);
    list.replaceChildren(
      ...(ms.length
        ? ms.map((m) => h('div.pkperson', { role: 'group', dataset: { id: m.id }, 'aria-label': m.title },
            h('b', m.title),
            h('span.pklab', `${nice(m.when)}${m.agenda ? ` · ${m.agenda.split('\n').filter((x) => x.trim()).length} on the agenda` : ''}${m.summary ? ' · summed up' : m.notes ? ' · notes taken' : ''}`),
            h('div.pkrow',
              label(button('Open', () => openOne(m), 'on'), `Open ${m.title}`),
              label(button('Forget', () => {
                put(all().filter((x) => x.id !== m.id));
                stateIn(status, '', `Forgot ${m.title}.`);
                paint();
              }), `Forget ${m.title}`))))
        /* state: work.meetings empty */
        : [emptyState('No meetings yet', 'Add one below with its agenda; take notes in it as it goes.')]),
    );
  };
  paint();
  const form = h('div.pkcol.pkform', h('div.lab', 'A NEW MEETING'), title, when, agenda, h('div.pkrow', label(button('Keep meeting', add, 'on'), 'Keep this meeting')));
  return { el: h('div.pkcol', list, form, status, phrases(['my meetings', 'meeting notes'])), stop: () => undefined };
}
