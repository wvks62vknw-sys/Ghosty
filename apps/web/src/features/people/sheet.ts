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
import { forgetReceipt, keepReceipt, receiptOf } from '../homeadmin/receipts';
import { emptyState, inWords, lacksSignal, phrases, stateIn, stateLine, troubleWords, waitFor } from '../lifeui';

export type PeopleWhat = 'who' | 'plan' | 'coming';
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
export const PEOPLE_TITLES: Record<PeopleWhat, string> = { who: 'YOUR PEOPLE', plan: 'GROUP PLAN', coming: 'COMING UP' };
const TITLES = PEOPLE_TITLES;

export const peopleState = { open: '' as '' | PeopleWhat, people: [] as PersonRow[], plan: null as PlanRow | null, said: '', coming: [] as string[], shown: 0, gifts: [] as string[], photos: 0 };

let open: { close(): void } | null = null;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** "2027-03-14" → "14 March"; "--03-14" too; anything else as it came. */
const dayOf = (iso: string): string => {
  const m = /(?:\d{4})?-{1,2}(\d{2})-(\d{2})$/.exec(iso);
  return m && Number(m[1]) >= 1 && Number(m[1]) <= 12 ? `${Number(m[2])} ${MONTHS[Number(m[1]) - 1]}` : iso;
};

export async function openPeople(what: string): Promise<void> {
  const w: PeopleWhat = what === 'plan' ? 'plan' : what === 'coming' ? 'coming' : 'who';
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
  return { el: w === 'plan' ? planSheet() : w === 'coming' ? comingSheet() : whoSheet(), stop: () => undefined };
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
  const find = h('input.ppfind', { type: 'search', placeholder: 'Find someone: a name, “cousin”, “fishing”', 'aria-label': 'Find someone', enterKeyHint: 'search', hidden: true }) as HTMLInputElement;
  find.addEventListener('input', () => paint());
  const paint = () => {
    const q = find.value.trim().toLowerCase();
    find.hidden = peopleState.people.length < 2;
    const sorted = [...peopleState.people].sort((a, b) => a.name.localeCompare(b.name, 'en-GB', { sensitivity: 'base' }));
    const shown = q ? sorted.filter((p) => [p.name, p.rel, ...p.notes].some((x) => x.toLowerCase().includes(q))) : sorted;
    peopleState.shown = shown.length;
    list.replaceChildren(
      ...(peopleState.people.length && !shown.length ? [h('p.pknote', { dataset: { case: 'keep' } }, `No one I know matches “${find.value.trim()}”.`)] : []),
      ...(peopleState.people.length
        ? shown.map((p) => {
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
                // [moneynext] money.u9: each thing he said, to change or take away; his own photo of them, kept on this phone
                ...(p.notes.length ? p.notes.map((n) => noteRow(p, n)) : [h('p.pknote', 'Nothing else said yet.')]),
                photoRow(p),
                giftRow(p),
                ...(p.phone ? [button(`Copy number ${p.phone}`, () => void copy(p.phone, 'the number'))] : []),
                ...(p.email ? [button(`Copy email ${p.email}`, () => void copy(p.email, 'the email'))] : []),
                ...(p.address ? [button('Copy address', () => void copy(p.address, 'the address'))] : []),
                birthdayRow(p),
                forgetRow(p),
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
  /** One thing he said about them, with CHANGE (in a box) and TAKE AWAY. */
  const noteRow = (p: PersonRow, n: string): HTMLElement => {
    const edit = button('Change', () => {
      const box = h('input', { type: 'text', value: n, 'aria-label': `What it should say about ${p.name}` }) as HTMLInputElement;
      const m = modal(`About ${p.name}`, h('div.pkcol', box, h('div.pkrow',
        button('Keep it', async () => {
          if (box.value.trim().length < 2) return;
          m.close();
          const r = await say('notes', { who: p.name, text: n, to: box.value.trim() });
          if (r.failed) return void stateIn(status, r.offline ? 'offline' : 'error', troubleWords(!!r.offline));
          stateIn(status, '', r.text);
          await load();
        }, 'on'),
        button('Leave it', () => m.close()))));
      box.focus();
    });
    edit.setAttribute('aria-label', `Change “${n}” about ${p.name}`);
    const drop = button('Take away', async () => {
      const r = await say('notes', { who: p.name, text: n, op: 'remove' });
      if (r.failed) return void stateIn(status, r.offline ? 'offline' : 'error', troubleWords(!!r.offline));
      stateIn(status, '', r.text);
      await load();
    });
    drop.setAttribute('aria-label', `Take away “${n}” about ${p.name}`);
    return h('div.pkcol.ppnote', h('p.pknote', { dataset: { case: 'keep' } }, n), h('div.pkrow', edit, drop));
  };
  /** His own photo of someone he introduced: kept on this phone only, never sent, never used to identify anyone. */
  const photoRow = (p: PersonRow): HTMLElement => {
    const key = `person:${p.name.toLowerCase()}`;
    const img = h('div.pkcol');
    const input = h('input', { type: 'file', accept: 'image/*', hidden: true, 'aria-label': `A photo of ${p.name}` }) as HTMLInputElement;
    const show = async () => {
      const b = await receiptOf(key);
      if (!b) return void img.replaceChildren();
      const url = URL.createObjectURL(b);
      const pic = h('img.pkreceiptimg.ppphoto', { src: url, alt: `Your photo of ${p.name}` }) as HTMLImageElement;
      pic.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
      img.replaceChildren(pic);
      peopleState.photos = Math.max(peopleState.photos, 1);
    };
    input.addEventListener('change', async () => {
      const f = input.files?.[0];
      input.value = '';
      if (!f) return;
      try {
        await keepReceipt(key, f);
        stateIn(status, '', `Your photo of ${p.name} is kept on this phone only. It is never sent.`);
        await show();
      } catch (e) {
        stateIn(status, 'error', sayError(e, 'keep that photo'));
      }
    });
    const add = button('Add your photo', () => input.click());
    add.setAttribute('aria-label', `Add your own photo of ${p.name}`);
    const drop = button('Take it away', async () => { await forgetReceipt(key); img.replaceChildren(); stateIn(status, '', `Your photo of ${p.name} is gone from this phone.`); });
    drop.setAttribute('aria-label', `Take away your photo of ${p.name}`);
    void show();
    return h('div.pkcol', img, input, h('div.pkrow', add, drop));
  };
  /** money.u10: a gift list for them: ideas, bought with a price, and what he gave last year so a present is never repeated. */
  const giftRow = (p: PersonRow): HTMLElement => {
    const box = h('div.pkcol.ppgifts', { 'aria-live': 'polite' });
    const idea = h('input', { type: 'text', placeholder: 'a fishing reel', 'aria-label': `A gift idea for ${p.name}` }) as HTMLInputElement;
    const price = h('input', { type: 'text', inputMode: 'decimal', placeholder: '£25', 'aria-label': `What it costs (you can leave it)` }) as HTMLInputElement;
    type G = { id: string; idea: string; price?: number; bought?: string };
    const paint = (d: { gifts: G[]; lastYear: string[]; spentThisYear: number }) => {
      peopleState.gifts = d.gifts.map((g) => `${p.name}: ${g.idea}${g.bought ? ' bought' : ''}`);
      const ideas = d.gifts.filter((g) => !g.bought);
      const bought = d.gifts.filter((g) => g.bought);
      box.replaceChildren(
        h('div.lab', 'GIFT LIST'),
        ...(d.lastYear.length ? [h('p.pknote', { dataset: { case: 'keep' } }, `Last year you gave: ${d.lastYear.join(', ')}.`)] : []),
        ...(d.spentThisYear ? [h('p.pknote', { dataset: { case: 'keep' } }, `£${d.spentThisYear.toFixed(2)} on presents for ${p.name} this year.`)] : []),
        ...ideas.map((g) => {
          const b = button('Bought', () => void run({ op: 'bought', id: g.id, price: g.price }));
          b.setAttribute('aria-label', `Mark ${g.idea} bought`);
          const x = button('Take off', () => void run({ op: 'remove', id: g.id }));
          x.setAttribute('aria-label', `Take ${g.idea} off the list`);
          return h('div.pkcol', h('p.pknote', { dataset: { case: 'keep' } }, `${g.idea}${g.price ? ` · £${g.price.toFixed(2)}` : ''}`), h('div.pkrow', b, x));
        }),
        ...bought.map((g) => h('p.pknote.ppbought', { dataset: { case: 'keep' } }, `Bought ${new Date(`${g.bought}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}: ${g.idea}${g.price ? `, £${g.price.toFixed(2)}` : ''}`)),
        ...(d.gifts.length ? [] : [h('p.pknote', { dataset: { case: 'keep' } }, 'No ideas kept yet. Add one below as it comes to you.')]),
        idea, price,
        h('div.pkrow', (() => { const k = button('Keep idea', () => void addIt(), 'on'); k.setAttribute('aria-label', `Keep this gift idea for ${p.name}`); return k; })()),
      );
    };
    const run = async (args: Record<string, unknown>) => {
      const r = await say('gifts', { who: p.name, ...args });
      if (r.failed) return void stateIn(status, r.offline ? 'offline' : 'error', troubleWords(!!r.offline));
      if (args.op) stateIn(status, '', r.text);
      paint(r.data as { gifts: G[]; lastYear: string[]; spentThisYear: number });
    };
    const addIt = async () => {
      if (!idea.value.trim()) return void stateIn(status, '', `Type the idea first, like “a fishing reel”.`);
      const n = Number(price.value.replace(/[£,\s]/g, ''));
      await run({ op: 'add', idea: idea.value.trim(), ...(n > 0 ? { price: n } : {}) });
      idea.value = '';
      price.value = '';
    };
    void run({});
    return box;
  };
  /** His own birthday for them, kept in two taps (the brain sets the reminders a week before and on the day). */
  const birthdayRow = (p: PersonRow): HTMLElement => {
    const day = h('input', { type: 'text', placeholder: '14 March', 'aria-label': `${p.name}’s birthday`, enterKeyHint: 'done' }) as HTMLInputElement;
    const keep = button(p.born ? 'Change birthday' : 'Keep birthday', async () => {
      if (!day.value.trim()) return void stateIn(status, '', `Type ${p.name}’s birthday first, like 14 March.`);
      const r = await say('birthday', { who: p.name, words: `${p.name}’s birthday is ${day.value.trim()}` });
      if (r.failed) return void stateIn(status, r.offline ? 'offline' : 'error', `${troubleWords(!!r.offline)} What you typed is still here.`);
      stateIn(status, '', r.text);
      await load();
    });
    keep.setAttribute('aria-label', `Keep ${p.name}’s birthday`);
    return h('div.pkadd', day, keep);
  };
  /** Forget them (all of it, the birthday reminders too), asked once more first. */
  const forgetRow = (p: PersonRow): HTMLElement => {
    const b = button(`Forget ${p.name}`, () => {
      const m = modal(`Forget ${p.name}?`, h('div.pkcol',
        h('p.pknote', `Everything you told me about ${p.name} goes, with their birthday reminders. Nobody is told.`),
        h('div.pkrow',
          button('Keep them', () => m.close()),
          button(`Forget ${p.name}`, async () => {
            m.close();
            const r = await say('forget', { who: p.name });
            if (r.failed) return void stateIn(status, r.offline ? 'offline' : 'error', troubleWords(!!r.offline));
            stateIn(status, '', r.text);
            await load();
          }, 'warn'))));
    }, 'warn');
    b.setAttribute('aria-label', `Forget ${p.name}`);
    return h('div.pkrow', b);
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
  const el = h('div.pkcol', find, list, h('div.pkadd', name, what, addBtn), status, phrases(['who\'s who', 'Sam is my cousin']));
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
  // [moneylane] a plan made or called off here, in his words (the brain reads them as the chat's would); nobody is messaged
  const words = h('input', { type: 'text', placeholder: 'pub on Friday at 8 at the Crown, asked Ali, Sam and Jo', 'aria-label': 'The plan, in your words', enterKeyHint: 'done' }) as HTMLInputElement;
  const make = async (said: string, clearIt: boolean) => {
    const r = await say('plan', { words: said });
    if (r.failed) return void stateIn(status, r.offline ? 'offline' : 'error', `${troubleWords(!!r.offline)} What you typed is still here.`);
    peopleState.plan = ((r.data as { plan?: PlanRow | null } | undefined)?.plan ?? null) as PlanRow | null;
    stateIn(status, '', r.text);
    if (clearIt) words.value = '';
    paint();
    cancel.hidden = !peopleState.plan;
  };
  const go = button('Make the plan', () => (words.value.trim() ? void make(`new plan: ${words.value.trim().replace(/^(?:new )?plan:\s*/i, '')}`, true) : stateIn(status, '', 'Say the plan first: what, when, where and who you asked.')), 'on');
  go.setAttribute('aria-label', 'Make this plan');
  words.addEventListener('keydown', (e) => e.key === 'Enter' && go.click());
  const cancel = button('Call off the plan', () => void make('cancel the plan', false), 'warn');
  cancel.setAttribute('aria-label', 'Call off the plan');
  cancel.hidden = true;
  const el = h('div.pkcol', box, h('div.lab', 'A NEW PLAN'), words, h('div.pkrow', go, cancel), status);
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
    cancel.hidden = !peopleState.plan;
  });
  return el;
}

/** COMING UP: every birthday, date, plan and call he told me about, in date order, a year ahead (the brain's `coming`), and a birthday
 * or a date kept here. Nothing is looked up and nobody is told. */
function comingSheet(): HTMLElement {
  const list = h('div.pkcol', { 'aria-live': 'polite' });
  const status = h('p.pknote', { 'aria-live': 'polite' }, 'Birthdays and dates you told me, a year ahead. I remind you a week before and on the day.');
  const who = h('input', { type: 'text', placeholder: 'Mum', 'aria-label': 'Whose birthday', enterKeyHint: 'next' }) as HTMLInputElement;
  const day = h('input', { type: 'text', placeholder: '14 March 1962', 'aria-label': 'The day of the birthday', enterKeyHint: 'done' }) as HTMLInputElement;
  const date = h('input', { type: 'text', placeholder: 'our anniversary is 12 June', 'aria-label': 'A date to keep, in your words', enterKeyHint: 'done' }) as HTMLInputElement;
  const load = async () => {
    list.replaceChildren();
    /* state: people.coming loading */
    const done = waitFor(el, 'Opening what is coming up…');
    const r = await say('coming', { days: 366 });
    done();
    if (r.failed || !r.text) {
      const again = button('Try again', () => void load());
      again.setAttribute('aria-label', 'Try reading what is coming up again');
      /* state: people.coming error */
      /* state: people.coming offline */
      list.replaceChildren(stateLine(r.offline ? 'offline' : 'error', r.offline ? 'No signal. I read your dates when the phone is back online.' : 'My brain isn’t answering, so I can’t read your dates just now.'), again);
      return;
    }
    const items = r.text.split('\n').filter((l) => /^- /.test(l)).map((l) => l.slice(2));
    peopleState.coming = items;
    list.replaceChildren(
      ...(items.length
        ? items.map((l) => {
            const at = l.indexOf(': ');
            const when = at > 0 ? l.slice(0, at) : '';
            const what = at > 0 ? l.slice(at + 2) : l;
            return h('div.pkperson', { role: 'group', 'aria-label': `${what}, ${when}`, dataset: { case: 'keep' } }, h('b', what), h('span.pklab', when));
          })
        /* state: people.coming empty */
        : [emptyState('Nothing coming up', 'Keep a birthday or a date below, and I remind you a week before and on the day.')]),
    );
  };
  const keep = async (args: Record<string, unknown>, action: string, clearIt: HTMLInputElement[]) => {
    const r = await say(action, args);
    if (r.failed) return void stateIn(status, r.offline ? 'offline' : 'error', `${troubleWords(!!r.offline)} What you typed is still here.`);
    stateIn(status, '', r.text);
    for (const x of clearIt) x.value = '';
    await load();
  };
  const addB = button('Keep birthday', () => (who.value.trim() && day.value.trim() ? void keep({ who: who.value.trim(), words: `${who.value.trim()}’s birthday is ${day.value.trim()}` }, 'birthday', [who, day]) : stateIn(status, '', 'Give me a name and the day, like Mum and 14 March.')), 'on');
  addB.setAttribute('aria-label', 'Keep this birthday');
  const addD = button('Keep date', () => (date.value.trim() ? void keep({ words: date.value.trim() }, 'date', [date]) : stateIn(status, '', 'Say the date first, like “our anniversary is 12 June”.')));
  addD.setAttribute('aria-label', 'Keep this date');
  const el = h('div.pkcol', list, h('div.lab', 'A BIRTHDAY'), h('div.pkadd', who, day), h('div.pkrow', addB), h('div.lab', 'A DATE'), date, h('div.pkrow', addD), status, phrases(['birthdays coming', 'whose birthday is next']));
  void load();
  return el;
}
