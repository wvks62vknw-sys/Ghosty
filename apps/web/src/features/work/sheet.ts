/**
 * THE WORK PACK on the phone (BRIEF-PACKS-2): a sheet over whatever is showing (the open_work command; the chat's "interview
 * practice"). DOC: a CV, a cover letter, an email draft, a meeting summary or a timesheet, as text he can COPY, SHARE or (an
 * email) open in his mail app on his tap — nothing is sent for him. INTERVIEW: the questions for the job one at a time, asked
 * aloud, his answer timed (by voice or typed) and a plain critique back from my brain's code. TODO: his list, ticked on the
 * phone. The state sits on window.__ghosty.work for the specs.
 */
import { h } from '../../core/dom';
import { button, modal } from '../../ui/components';
import { brain } from '../../api/brain';
import { clockNow } from '../kitchen/timers';
import { sayError } from '../../ui/hisWords';
import { adoptTodos, loadTodos, syncTodos, tickTodo } from '../agenda/todo';
import { daysTo, dueWords, emptyState, lacksSignal, phrases, stateIn, stateLine, troubleWords, waitFor } from '../lifeui';
import { forgetFromLibrary, keepInLibrary, KIND_WORDS, listLibrary, type LibDoc } from './library';
import { run as runCommand } from '../../commands/registry';
import { fromText, newDoc } from '../../docs/model';

export type WorkWhat = 'doc' | 'interview' | 'todo';
/** Each sheet's name, as its title and as its panel on the WORK screen (features/work/index.ts). */
export const WORK_TITLES: Record<WorkWhat, string> = { doc: 'DOCUMENT', interview: 'INTERVIEW PRACTICE', todo: 'TO-DO' };
const TITLES = WORK_TITLES;

export const workState = {
  open: '' as '' | WorkWhat,
  doc: { title: '', text: '', done: '' },
  interview: { q: 0, of: 0, question: '', secs: 0, running: false, critique: '', answered: 0 },
  todo: [] as { id?: string; text: string; done: boolean; due?: string }[],
  library: [] as string[],
};

let open: { close(): void } | null = null;
let stopNow: (() => void) | null = null;

export async function openWork(what: string, args: Record<string, unknown> = {}): Promise<void> {
  const w: WorkWhat = what === 'interview' || what === 'todo' ? what : 'doc';
  open?.close();
  const s = workScreen(w, args);
  workState.open = w;
  stopNow = s.stop;
  open = modal(typeof args.title === 'string' && w === 'doc' ? args.title.slice(0, 30) : TITLES[w], h('div.pk', { dataset: { pack: 'work', screen: w } }, s.el), () => {
    stopNow?.();
    stopNow = null;
    open = null;
    workState.open = '';
  });
}

interface Screen {
  el: HTMLElement;
  stop(): void;
}

/** One sheet's page, made by its own function (the sheet's, and the WORK screen's panels). */
export function workScreen(w: WorkWhat, args: Record<string, unknown> = {}): Screen {
  const win = window as unknown as { __ghosty?: Record<string, unknown> };
  if (win.__ghosty) win.__ghosty.work = workState;
  return w === 'interview' ? interviewScreen(args) : w === 'todo' ? todoScreen() : docScreen(args);
}

/** A document as text he can copy or share; an email also opens in his mail app on his tap. */
function docScreen(a: Record<string, unknown>): Screen {
  const text = String(a.text ?? '').slice(0, 20_000);
  const title = String(a.title ?? 'DOCUMENT');
  workState.doc = { title, text, done: '' };
  const nWords = (text.match(/\S+/g) ?? []).length;
  // [moneynext] every document I write is kept in his library on this phone as it is shown, a new version when its words change
  const kept = a.keep === false ? null : keepInLibrary(title, String(a.kind ?? 'document'), text);
  const status = h('p.pknote', { 'aria-live': 'polite' }, `${nWords} word${nWords === 1 ? '' : 's'}. Shown for you to check: nothing is sent unless you send it yourself.${kept ? (kept.added ? ' Kept in your library on WORK → Document.' : ' Already in your library.') : ''}`);
  const note = (t: string) => {
    workState.doc.done = t;
    status.textContent = t;
  };
  const body = h('pre.pkdoc', { tabindex: '0', 'aria-label': `${title}, as text` }, text);
  const copy = button('Copy', async () => {
    try {
      await navigator.clipboard.writeText(text);
      note('Copied: paste it where you need it.');
    } catch {
      note('Select the text above and copy it.');
    }
  }, 'on');
  copy.setAttribute('aria-label', `Copy the ${title.toLowerCase()}`);
  const share = button('Share', async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title, text });
        note('Shared by you.');
      } else {
        await navigator.clipboard.writeText(text);
        note('Copied: sharing isn’t available here, so paste it where you need it.');
      }
    } catch {
      note('Not shared.');
    }
  });
  share.setAttribute('aria-label', `Share the ${title.toLowerCase()}`);
  const mail = typeof a.mailto === 'string' && a.mailto.startsWith('mailto:') ? a.mailto : '';
  const edit = button('Edit in Documents', () => void editInDocs(title, text, note));
  edit.setAttribute('aria-label', `Open the ${title.toLowerCase()} in Documents to edit it`);
  const rowButtons = [copy, share, edit];
  if (mail) {
    const m = button('Open in mail', () => {
      note('Opened in your mail app. You press send, not me.');
      location.href = mail;
    });
    m.setAttribute('aria-label', 'Open the draft in your mail app');
    rowButtons.push(m);
  }
  return { el: h('div.pkcol', body, h('div.pkrow', ...rowButtons), status), stop: () => undefined };
}

/** A document opened in DOCUMENTS (the editor) as a new document there: his library copy stays as it was. */
async function editInDocs(title: string, text: string, note: (t: string) => void): Promise<void> {
  const name = title.charAt(0) + title.slice(1).toLowerCase();
  const ok = await runCommand('open_docs', { doc: newDoc(name, fromText(text)) }).catch(() => false);
  note(ok ? 'Opened in Documents: your edits are kept there, and this copy stays in your library.' : 'Documents could not open just now. Copy it instead.');
}

const DAY = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/** WORK → DOCUMENT: his library, newest first, each to open, edit in Documents, see its older versions or forget (asked once more). */
export function libraryScreen(): Screen {
  const win = window as unknown as { __ghosty?: Record<string, unknown> };
  if (win.__ghosty) win.__ghosty.work = workState;
  const status = h('p.pknote', { 'aria-live': 'polite' });
  const list = h('div.pkcol', { 'aria-live': 'polite' });
  const find = h('input.mnsearch', { type: 'search', placeholder: 'Find a document: CV, Tesco, cover', 'aria-label': 'Find a document', enterKeyHint: 'search' }) as HTMLInputElement;
  const named = (b: HTMLButtonElement, l: string) => (b.setAttribute('aria-label', l), b);
  const openOne = (d: LibDoc, v = d.versions.length - 1) => void openWork('doc', { title: d.title, text: d.versions[v]!.text, kind: d.kind, keep: false });
  const paint = () => {
    const all = listLibrary();
    workState.library = all.map((d) => `${d.title} ${d.versions.length}`);
    const q = find.value.trim().toLowerCase();
    const docs = q ? all.filter((d) => d.title.toLowerCase().includes(q) || d.kind.includes(q) || d.versions[d.versions.length - 1]!.text.toLowerCase().includes(q)) : all;
    find.hidden = all.length < 4;
    if (!all.length) {
      /* state: work.doc empty */
      list.replaceChildren(emptyState('No document yet', 'Ask me in the chat for a CV, a cover letter or an email.'));
      return;
    }
    list.replaceChildren(
      h('p.pknote', { dataset: { case: 'keep' } }, `${all.length} document${all.length === 1 ? '' : 's'} kept on this phone, newest first.`),
      ...(docs.length ? docs : [null]).map((d) => {
        if (!d) return h('p.pknote', { dataset: { case: 'keep' } }, `No document matches “${find.value.trim()}”.`);
        const last = d.versions[d.versions.length - 1]!;
        const n = (last.text.match(/\S+/g) ?? []).length;
        const older = h('div.pkcol', { hidden: true });
        const box = h('div.pkperson.wklib', { role: 'group', dataset: { doc: d.id }, 'aria-label': `${d.title}, ${KIND_WORDS[d.kind] ?? d.kind}` },
          h('b', d.title.charAt(0) + d.title.slice(1).toLowerCase()),
          h('span.pklab', `${KIND_WORDS[d.kind] ?? d.kind} · ${DAY(last.at)} · ${n} word${n === 1 ? '' : 's'}${d.versions.length > 1 ? ` · ${d.versions.length} versions` : ''}`),
          h('div.pkrow',
            named(button('Open', () => openOne(d), 'on'), `Open ${d.title.toLowerCase()}`),
            named(button('Edit in Documents', () => void editInDocs(d.title, last.text, (t) => stateIn(status, '', t))), `Edit ${d.title.toLowerCase()} in Documents`),
            ...(d.versions.length > 1 ? [named(button('Older versions', () => {
              older.hidden = !older.hidden;
              older.replaceChildren(...d.versions.slice(0, -1).map((v, i) => h('div.pkrow', named(button(`${DAY(v.at)} · version ${i + 1}`, () => openOne(d, i)), `Open version ${i + 1} from ${DAY(v.at)}`))).reverse());
            }), `Show the older versions of ${d.title.toLowerCase()}`)] : []),
            named(button('Forget', () => {
              const m = modal('Forget it?', h('div.pkcol', h('p.pknote', `Forget ${d.title.toLowerCase()} and its ${d.versions.length === 1 ? 'one version' : `${d.versions.length} versions`}? This can’t be undone.`),
                h('div.pkrow', named(button('Forget it', () => { forgetFromLibrary(d.id); m.close(); stateIn(status, '', `Forgot ${d.title.toLowerCase()}.`); paint(); }, 'on'), `Yes, forget ${d.title.toLowerCase()}`),
                  named(button('Keep it', () => m.close()), 'No, keep it'))));
            }), `Forget ${d.title.toLowerCase()}`)),
          older);
        return box;
      }),
    );
  };
  find.addEventListener('input', paint);
  paint();
  return { el: h('div.pkcol', find, list, status, phrases(['my documents library', 'my cvs and letters'])), stop: () => undefined };
}

interface Crit {
  words: number;
  secs: number;
  wpm: number;
  length: 'short' | 'good' | 'long';
  numbers: number;
  names: number;
  example: boolean;
  star: { situation: boolean; task: boolean; action: boolean; result: boolean };
  fillers: [string, number][];
  next: string;
}
/** The brain's critique, put in plain words for him (a time said as "62 seconds, measured by the phone"): '' when it sent none. */
function plainCritique(d: { critique?: Crit } | undefined): string {
  const c = d?.critique;
  if (!c) return '';
  const len = c.length === 'good' ? 'about right. Aim for 45 to 90 seconds.' : c.length === 'short' ? 'a bit short. Aim for 45 to 90 seconds, with a real example.' : 'a bit long. Aim for 45 to 90 seconds, with your best example.';
  const lines = [c.secs > 0 ? `You spoke for ${c.secs} seconds, measured by the phone: ${len}` : `You wrote ${c.words} words: ${len}`];
  if (c.secs > 0 && c.words >= 20) lines.push(`Your pace was ${c.wpm} words a minute: ${c.wpm < 110 ? 'slow, which is fine if you were thinking' : c.wpm > 170 ? 'quick, so slow down a little' : 'comfortable'}.`);
  lines.push(`You gave ${c.numbers} number${c.numbers === 1 ? '' : 's'} and ${c.names} name${c.names === 1 ? '' : 's'}. ${c.numbers + c.names + (c.example ? 1 : 0) >= 3 ? 'That sounds real.' : 'Add a figure or a name so it sounds real.'}`);
  const miss = ([['situation', 'what was going on'], ['task', 'what you had to do'], ['action', 'what you did'], ['result', 'what came of it']] as const).filter(([k]) => !c.star[k]).map(([, w]) => w);
  lines.push(miss.length ? `Still missing: ${miss.join(', ')}.` : 'You covered what was going on, the job, what you did and what came of it.');
  if (c.fillers.length) lines.push(`Filler words: ${c.fillers.slice(0, 3).map(([w, n]) => `“${w}” ${n} time${n === 1 ? '' : 's'}`).join(', ')}. A short pause says it better.`);
  lines.push(`Next time: ${c.next}`);
  return lines.join('\n');
}

/** Interview practice: a question, his answer timed, a plain critique, the next. */
function interviewScreen(a: Record<string, unknown>): Screen {
  const qs = (Array.isArray(a.questions) ? (a.questions as unknown[]).map(String) : ['Tell me about yourself.', 'Why do you want this job?', 'What are your strengths?', 'Tell me about a time you dealt with a difficult situation.', 'Why should we hire you?']).slice(0, 9);
  let i = 0;
  let t0 = 0;
  let timer = 0;
  let listening = false;
  const clock = (): number => (t0 ? Math.max(0, Math.round((clockNow() - t0) / 1000)) : 0);
  const q = h('b.pkmid', { 'aria-live': 'polite' });
  const count = h('span.pklab');
  const time = h('b.pkbig', { role: 'timer', 'aria-label': 'Time on this answer' }, '0:00');
  const box = h('textarea.pkpaste', { rows: 5, placeholder: 'Type your answer here, or press Answer by voice.', 'aria-label': 'Your answer, typed' }) as HTMLTextAreaElement;
  const out = h('pre.pkdoc', { 'aria-live': 'polite', tabindex: '0', 'aria-label': 'The critique' });
  const status = h('p.pknote', { 'aria-live': 'polite' }, 'A rough guide from your words and your time, not a verdict on you.');
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const tick = () => {
    workState.interview.secs = clock();
    time.textContent = mmss(workState.interview.secs);
  };
  const stopTimer = () => {
    clearInterval(timer);
    timer = 0;
    workState.interview.running = false;
  };
  const show = () => {
    q.textContent = qs[i]!;
    count.textContent = `Question ${i + 1} of ${qs.length}`;
    box.value = '';
    out.textContent = '';
    time.textContent = '0:00';
    t0 = 0;
    stopTimer();
    Object.assign(workState.interview, { q: i + 1, of: qs.length, question: qs[i]!, secs: 0, critique: '' });
  };
  const start = () => {
    if (!t0) t0 = clockNow();
    if (!timer) timer = window.setInterval(tick, 250);
    workState.interview.running = true;
  };
  const finish = async (spoken = '') => {
    const answer = (spoken || box.value).trim();
    const secs = clock();
    stopTimer();
    tick();
    if (!answer) {
      status.textContent = 'I didn’t get an answer to look at: type it, or press Answer by voice.';
      return;
    }
    if (spoken) box.value = spoken;
    if (lacksSignal()) {
      /* state: work.interview offline */
      stateIn(status, 'offline', 'No signal. I look at your answer when the phone is back online.');
      return;
    }
    stateIn(status, '', '');
    /* state: work.interview loading */
    const done = waitFor(el, 'Looking at your answer…');
    try {
      const r = await brain.packDo('work', 'critique', { text: answer, secs });
      const plain = plainCritique(r.data as { critique?: Crit } | undefined) || r.text;
      out.textContent = plain;
      workState.interview.critique = plain;
      workState.interview.answered++;
      status.textContent = 'A rough guide from your words and your time, not a verdict on you.';
    } catch (e) {
      /* state: work.interview error */
      stateIn(status, 'error', `${sayError(e, 'get an answer from my brain')} Your answer is still here.`);
    } finally {
      done();
    }
  };
  const ask = button('Ask it aloud', async () => {
    try {
      const v = await import('../../assistant/voice');
      void v.speak(qs[i]!).catch(() => undefined);
    } catch {
      /* no voice here: the question is on the screen */
    }
  });
  ask.setAttribute('aria-label', 'Ask me the question aloud');
  const startBtn = button('Start timing', start, 'on');
  startBtn.setAttribute('aria-label', 'Start the timer for your answer');
  const done = button('Done: how was it?', () => void finish());
  // (the critique's wait and its answer are drawn into `el`, below)
  done.setAttribute('aria-label', 'Stop the timer and critique my answer');
  const voice = button('Answer by voice', async () => {
    if (listening) return;
    listening = true;
    start();
    status.textContent = 'Listening… speak your answer, then stop talking.';
    try {
      const v = await import('../../assistant/voice');
      const heard = await v.listen(true, (t) => (status.textContent = `Listening… ${t.slice(-60)}`));
      listening = false;
      await finish(heard);
    } catch (e) {
      listening = false;
      stopTimer();
      status.textContent = `${sayError(e, 'hear you')} Type your answer instead.`;
    }
  });
  voice.setAttribute('aria-label', 'Answer by voice');
  const next = button('Next question', () => {
    i = (i + 1) % qs.length;
    show();
  });
  show();
  const el = h('div.pkcol', count, q, h('div.pkhero', time, h('span.pklab', 'on this answer, measured')), h('div.pkrow', ask, startBtn, voice), box, h('div.pkrow', done, next), out, status);
  return { el, stop: () => (stopTimer(), void import('../../assistant/voice').then((v) => v.stopListening()).catch(() => undefined)) };
}

/** The to-do list, ticked on the phone and kept in my brain: the one list the Agenda's TO-DO, Home and the Brief read too. */
function todoScreen(): Screen {
  const items = h('ul.pkitems', { 'aria-label': 'To-do list' });
  const count = h('p.pknote.pktodocount', { dataset: { case: 'keep' }, hidden: true });
  const slot = h('div.pkcol', { 'aria-live': 'polite' });
  const status = h('p.pknote', { 'aria-live': 'polite' }, 'Kept in my brain. Add by voice too: “add to my to-do: send the invoice by Friday”.');
  let loaded = false;
  const act = async (words: string) => {
    if (lacksSignal()) {
      /* state: work.todo offline */
      if (!loaded) slot.replaceChildren(stateLine('offline', 'No signal. Your list opens when the phone is back online.'));
      else stateIn(status, 'offline', 'No signal. I do that when the phone is back online.');
      paint();
      return '';
    }
    try {
      const r = await brain.packDo('work', 'todo', { words });
      workState.todo = ((r.data as { list?: typeof workState.todo } | undefined)?.list ?? []).map((t) => ({ ...(t.id ? { id: t.id } : {}), text: t.text, done: !!t.done, ...(t.due ? { due: t.due } : {}) }));
      // [planlane2:onelist] the same one list as the Agenda's TO-DO, Home and the Brief: their copy on this phone follows
      adoptTodos((r.data as { list?: unknown } | undefined)?.list);
      loaded = true;
      paint();
      return r.text;
    } catch (e) {
      /* state: work.todo error */
      if (!loaded) slot.replaceChildren(stateLine('error', troubleWords(false)));
      else stateIn(status, 'error', `${sayError(e, 'get an answer from my brain')} Nothing changed.`);
      // (a tick the brain did not take is put back)
      paint();
      return '';
    }
  };
  const paint = () => {
    /* state: work.todo empty */
    if (loaded) slot.replaceChildren(...(workState.todo.length ? [] : [emptyState('Your list is clear', 'Type the next job below.')]));
    // [moneylane] in the order a good to-do app keeps: what is late, then today, then what is coming (soonest first), then any time, then done
    const groupOf = (t: (typeof workState.todo)[number]): number => {
      if (t.done) return 4;
      const n = t.due ? daysTo(t.due) : null;
      return n === null ? 3 : n < 0 ? 0 : n === 0 ? 1 : 2;
    };
    const HEADS = ['LATE', 'TODAY', 'COMING UP', 'ANY TIME', 'DONE'];
    const sorted = workState.todo.map((t, i) => ({ t, i, g: groupOf(t) })).sort((a, b) => a.g - b.g || (a.t.due ?? '').localeCompare(b.t.due ?? '') || a.i - b.i);
    const open = workState.todo.filter((t) => !t.done).length;
    const late = sorted.filter((x) => x.g === 0).length;
    count.textContent = workState.todo.length ? `${open} to do${late ? ` · ${late} late` : ''}${open < workState.todo.length ? ` · ${workState.todo.length - open} done` : ''}` : '';
    count.hidden = !workState.todo.length;
    let last = -1;
    items.replaceChildren(
      ...sorted.flatMap(({ t, g }) => {
        const when = t.due ? dueWords(t.due) || t.due : '';
        const box = h('input', { type: 'checkbox', checked: t.done, 'aria-label': `${t.text}${when ? `, ${when}` : ''}${t.done ? ', done' : ''}` }) as HTMLInputElement;
        // [planlane2:onelist] the box ticks this very item by its id through the one list's outbox (so a repeat's done copies are never mixed up,
        // and with no signal the tick waits on the phone and goes when the signal is back); words only when the copy does not have it yet
        box.addEventListener('change', () => {
          if (t.id && loadTodos().some((x) => x.id === t.id && x.done !== box.checked) && tickTodo(t.id)) {
            workState.todo = loadTodos().map((x) => ({ id: x.id, text: x.text, done: x.done, ...(x.due ? { due: x.due } : {}) }));
            loaded = true;
            paint();
            return;
          }
          void act(`${box.checked ? 'tick' : 'untick'} ${t.text}`);
        });
        const head = g !== last && sorted.some((x) => x.g !== g) ? [h('li.pktodohead', { role: 'presentation', dataset: { group: String(g) } }, HEADS[g]!)] : [];
        last = g;
        return [...head, h(`li.pkitem${t.done ? '.done' : ''}${g === 0 ? '.late' : ''}` as 'li', h('label', box, `${t.text}${when ? ` · ${when}` : ''}`))];
      }),
    );
    clear.hidden = !workState.todo.some((t) => t.done);
  };
  const input = h('input', { type: 'text', placeholder: 'send the invoice by Friday', 'aria-label': 'Add a job', enterKeyHint: 'done' }) as HTMLInputElement;
  const add = async () => {
    if (!input.value.trim()) return;
    const words = `add: ${input.value}`;
    const t = await act(words);
    // (what he typed stays in the box until my brain has kept it)
    if (t) {
      input.value = '';
      stateIn(status, '', t);
    }
  };
  input.addEventListener('keydown', (e) => e.key === 'Enter' && void add());
  const addBtn = button('Add', () => void add(), 'on');
  addBtn.setAttribute('aria-label', 'Add the job');
  const clear = button('Clear done', () => void act('clear done'));
  clear.hidden = true;
  const el = h('div.pkcol', h('div.pkadd', input, addBtn), slot, count, items, h('div.pkrow', clear), status, phrases(['interview practice', 'add to my to-do: send the invoice by Friday']));
  /* state: work.todo loading */
  const done = waitFor(el, 'Opening your list…');
  // ([planlane2:onelist] changes made on the Agenda with no signal go first, so this screen opens on the one list as it is)
  void syncTodos(true).finally(() => void act('').finally(done));
  return { el, stop: () => undefined };
}
