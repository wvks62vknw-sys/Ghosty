/**
 * THE PEOPLE PACK on the phone (BRIEF-PACKS-2): a sheet over whatever is showing (the open_people command; the chat's "who's
 * who"). WHO: everyone he told Ghosty about, each with how he knows them, the birthday, what he last said, and buttons for
 * gift ideas and the details he gave (copied on a tap, never sent anywhere); PLAN: the group plan with a yes, maybe or no
 * under each name. Everything is read from and kept in his own brain (POST /packs/do, no model); nothing is looked up.
 * The state sits on window.__ghosty.people for the specs.
 */
import { h } from '../../core/dom';
import { button, modal, toast } from '../../ui/components';
import { brain } from '../../api/brain';
import { sayError } from '../../ui/hisWords';
import { emptyState, inWords, lacksSignal, phrases, stateIn, stateLine, troubleWords, waitFor } from '../lifeui';

export type PeopleWhat = 'who' | 'plan';
interface PersonRow {
  id: string;
  name: string;
  rel: string;
  born: string;
  next: string;
  notes: string[];
  phone: string;
  address: string;
  email: string;
}
interface PlanRow {
  what: string;
  where?: string;
  when?: string;
  time?: string;
  yes: string[];
  no: string[];
  maybe: string[];
  asked: string[];
}
/** Each sheet's name, as its title and as its panel on the PEOPLE screen (features/people/index.ts). */
export const PEOPLE_TITLES: Record<PeopleWhat, string> = { who: 'YOUR PEOPLE', plan: 'GROUP PLAN' };
const TITLES = PEOPLE_TITLES;

export const peopleState = { open: '' as '' | PeopleWhat, people: [] as PersonRow[], plan: null as PlanRow | null, said: '' };

let open: { close(): void } | null = null;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** "2027-03-14" → "14 March"; "--03-14" too; anything else as it came. */
const dayOf = (iso: string): string => {
  const m = /(?:\d{4})?-{1,2}(\d{2})-(\d{2})$/.exec(iso);
  return m && Number(m[1]) >= 1 && Number(m[1]) <= 12 ? `${Number(m[2])} ${MONTHS[Number(m[1]) - 1]}` : iso;
};

export async function openPeople(what: string): Promise<void> {
  const w: PeopleWhat = what === 'plan' ? 'plan' : 'who';
  open?.close();
  const { el } = peopleScreen(w);
  peopleState.open = w;
  open = modal(TITLES[w], h('div.pk', { dataset: { pack: 'people', screen: w } }, el), () => {
    open = null;
    peopleState.open = '';
  });
}

/** One sheet's page, made by its own function (the sheet's, and the PEOPLE screen's panels). */
export function peopleScreen(w: PeopleWhat): { el: HTMLElement; stop(): void } {
  const win = window as unknown as { __ghosty?: Record<string, unknown> };
  if (win.__ghosty) win.__ghosty.people = peopleState;
  return { el: w === 'plan' ? planSheet() : whoSheet(), stop: () => undefined };
}

/** One brain action. `failed` when it did not land (no signal, or a silent brain): the caller says so in the page, never a toast. */
async function say(action: string, args: Record<string, unknown>): Promise<{ text: string; data?: unknown; failed?: boolean; offline?: boolean }> {
  if (lacksSignal()) return { text: '', failed: true, offline: true };
  try {
    const r = await brain.packDo('people', action, args);
    peopleState.said = r.text;
    return r;
  } catch (e) {
    sayError(e, 'get an answer from my brain');
    return { text: '', failed: true };
  }
}

function whoSheet(): HTMLElement {
  const list = h('div.pkcol', { 'aria-live': 'polite' });
  const status = h('p.pknote', { 'aria-live': 'polite' }, 'Only the people you told me about, kept in your brain. I never look anyone up.');
  const name = h('input', { type: 'text', placeholder: 'Sam', 'aria-label': 'Who you are telling me about', enterKeyHint: 'next' }) as HTMLInputElement;
  const what = h('input', { type: 'text', placeholder: 'loves fishing', 'aria-label': 'What to remember about them', enterKeyHint: 'done' }) as HTMLInputElement;
  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = `Copied ${label}.`;
    } catch {
      status.textContent = text;
    }
  };
  const paint = () => {
    list.replaceChildren(
      ...(peopleState.people.length
        ? peopleState.people.map((p) => {
            const more = h('div.pkcol', { hidden: true });
            const gift = h('p.pknote', { 'aria-live': 'polite' });
            const day = p.next || p.born;
            const bits = [p.rel.toLowerCase() === p.name.toLowerCase() ? '' : p.rel, p.born ? `birthday ${dayOf(day)}${p.next ? ` · ${inWords(p.next)}` : ''}` : '', p.notes[p.notes.length - 1] ?? ''].filter(Boolean).join(' · ');
            const details = button('Details', () => {
              more.hidden = !more.hidden;
              details.textContent = more.hidden ? 'Details' : 'Hide details';
              details.setAttribute('aria-expanded', String(!more.hidden));
              details.setAttribute('aria-label', `${more.hidden ? 'Details' : 'Hide details'} for ${p.name}`);
              more.replaceChildren(
                h('p.pknote', p.notes.length ? p.notes.join('; ') : 'Nothing else said yet.'),
                ...(p.phone ? [button(`Copy number ${p.phone}`, () => void copy(p.phone, 'the number'))] : []),
                ...(p.email ? [button(`Copy email ${p.email}`, () => void copy(p.email, 'the email'))] : []),
                ...(p.address ? [button('Copy address', () => void copy(p.address, 'the address'))] : []),
              );
            });
            details.setAttribute('aria-label', `Details for ${p.name}`);
            details.setAttribute('aria-expanded', 'false');
            const ideas = button('Gift ideas', async () => {
              gift.textContent = '';
              delete gift.dataset.state;
              const done = waitFor(card, `Thinking of gifts for ${p.name}…`);
              const r = await say('gift', { who: p.name });
              done();
              if (r.failed) stateIn(gift, 'error', troubleWords(!!r.offline));
              else gift.textContent = r.text;
            });
            ideas.setAttribute('aria-label', `Gift ideas for ${p.name}`);
            const card = h('div.pkperson', { role: 'group', 'aria-label': p.name }, h('b', p.name), h('span.pklab', bits || 'You told me about them'), h('div.pkrow', ideas, details), gift, more);
            return card;
          })
        /* state: people.who empty */
        : [emptyState('Tell me about someone.', 'Type a name and one thing to remember below, or say “Sam is my cousin”.')]),
    );
  };
  const load = async () => {
    list.replaceChildren();
    /* state: people.who loading */
    const done = waitFor(el, 'Opening your people…');
    const r = await say('who', { words: 'everyone' });
    done();
    if (r.failed || (!r.text && r.data === undefined)) {
      const again = button('Try again', () => void load());
      again.setAttribute('aria-label', 'Try reading your people again');
      /* state: people.who error */
      /* state: people.who offline */
      list.replaceChildren(h('div.pkcol', stateLine(r.offline ? 'offline' : 'error', r.offline ? 'No signal. I read your people when the phone is back online.' : 'My brain isn’t answering, so I can’t read your people just now.'), again));
      return;
    }
    peopleState.people = ((r.data as { people?: PersonRow[] } | undefined)?.people ?? []).slice();
    paint();
  };
  const add = async () => {
    if (!name.value.trim() || !what.value.trim()) {
      stateIn(status, '', 'Give me a name and one thing to remember.');
      return;
    }
    const r = await say('note', { who: name.value.trim(), words: `${name.value.trim()} ${what.value.trim()}` });
    if (r.failed) {
      stateIn(status, r.offline ? 'offline' : 'error', `${troubleWords(!!r.offline)} What you typed is still here.`);
      return;
    }
    stateIn(status, '', r.text);
    name.value = '';
    what.value = '';
    await load();
  };
  what.addEventListener('keydown', (e) => e.key === 'Enter' && void add());
  const addBtn = button('Keep it', () => void add(), 'on');
  addBtn.setAttribute('aria-label', 'Keep what I said about them');
  const el = h('div.pkcol', list, h('div.pkadd', name, what, addBtn), status, phrases(['who\'s who', 'Sam is my cousin']));
  void load();
  return el;
}

function planSheet(): HTMLElement {
  const box = h('div.pkcol', { 'aria-live': 'polite' });
  const status = h('p.pknote', { 'aria-live': 'polite' }, 'Tap yes, maybe or no under a name, or tell me in the chat. I message nobody.');
  const paint = () => {
    const p = peopleState.plan;
    if (!p) {
      /* state: people.plan empty */
      box.replaceChildren(emptyState('No plan yet', 'Say “plan: pub on Friday at 8 at the Crown, asked Ali, Sam and Jo”.'));
      return;
    }
    const names = [...new Set([...p.asked, ...p.yes, ...p.maybe, ...p.no])];
    const now = (n: string) => (p.yes.includes(n) ? 'yes' : p.no.includes(n) ? 'no' : p.maybe.includes(n) ? 'maybe' : '');
    box.replaceChildren(
      h('b.pkmid', p.what),
      h('span.pklab', [p.when, p.time, p.where ? `at ${p.where}` : ''].filter(Boolean).join(' · ') || 'No day or place yet'),
      ...names.map((n) =>
        h('div.pkperson', { role: 'group', 'aria-label': `${n}: ${now(n) || 'not heard from'}` }, h('b', n),
          h('div.pkrow', ...(['yes', 'maybe', 'no'] as const).map((s) => {
            const b = button(s, async () => {
              const r = await say('plan', { words: `${n} ${s === 'yes' ? 'is in' : s === 'no' ? 'is out' : 'maybe'}` });
              if (r.failed) return void stateIn(status, r.offline ? 'offline' : 'error', troubleWords(!!r.offline));
              peopleState.plan = ((r.data as { plan?: PlanRow } | undefined)?.plan ?? peopleState.plan) as PlanRow | null;
              stateIn(status, '', r.text);
              paint();
            }, now(n) === s ? 'on' : '');
            b.setAttribute('aria-label', `${n}: ${s}`);
            b.setAttribute('aria-pressed', String(now(n) === s));
            return b;
          }))),
      ),
    );
  };
  const el = h('div.pkcol', box, status);
  /* state: people.plan loading */
  const done = waitFor(el, 'Opening your plan…');
  void say('plan', { words: '' }).then((r) => {
    done();
    if (r.failed) {
      /* state: people.plan error */
      /* state: people.plan offline */
      box.replaceChildren(stateLine(r.offline ? 'offline' : 'error', r.offline ? 'No signal. I read your plan when the phone is back online.' : 'My brain isn’t answering, so I can’t read your plan just now.'));
      return;
    }
    peopleState.plan = ((r.data as { plan?: PlanRow | null } | undefined)?.plan ?? null) as PlanRow | null;
    paint();
  });
  return el;
}
