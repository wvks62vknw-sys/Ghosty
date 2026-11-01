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

export type WorkWhat = 'doc' | 'interview' | 'todo';
const TITLES: Record<WorkWhat, string> = { doc: 'DOCUMENT', interview: 'INTERVIEW PRACTICE', todo: 'TO-DO' };

export const workState = {
  open: '' as '' | WorkWhat,
  doc: { title: '', text: '', done: '' },
  interview: { q: 0, of: 0, question: '', secs: 0, running: false, critique: '', answered: 0 },
  todo: [] as { text: string; done: boolean; due?: string }[],
};

let open: { close(): void } | null = null;
let stopNow: (() => void) | null = null;

export async function openWork(what: string, args: Record<string, unknown> = {}): Promise<void> {
  const w: WorkWhat = what === 'interview' || what === 'todo' ? what : 'doc';
  open?.close();
  const win = window as unknown as { __ghosty?: Record<string, unknown> };
  if (win.__ghosty) win.__ghosty.work = workState;
  const s = w === 'interview' ? interviewScreen(args) : w === 'todo' ? todoScreen() : docScreen(args);
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

/** A document as text he can copy or share; an email also opens in his mail app on his tap. */
function docScreen(a: Record<string, unknown>): Screen {
  const text = String(a.text ?? '').slice(0, 20_000);
  const title = String(a.title ?? 'DOCUMENT');
  workState.doc = { title, text, done: '' };
  const status = h('p.pknote', { 'aria-live': 'polite' }, 'Shown for you to check. Nothing is sent unless you send it yourself.');
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
  const rowButtons = [copy, share];
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
    status.textContent = 'Looking at it…';
    try {
      const r = await brain.packDo('work', 'critique', { text: answer, secs });
      out.textContent = r.text;
      workState.interview.critique = r.text;
      workState.interview.answered++;
      status.textContent = '';
    } catch (e) {
      status.textContent = `My brain didn’t answer: ${(e as Error).message}`;
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
      status.textContent = `I couldn’t hear you (${(e as Error).message}): type your answer instead.`;
    }
  });
  voice.setAttribute('aria-label', 'Answer by voice');
  const next = button('Next question', () => {
    i = (i + 1) % qs.length;
    show();
  });
  show();
  return { el: h('div.pkcol', count, q, h('div.pkhero', time, h('span.pklab', 'on this answer')), h('div.pkrow', ask, startBtn, voice), box, h('div.pkrow', done, next), out, status), stop: () => (stopTimer(), void import('../../assistant/voice').then((v) => v.stopListening()).catch(() => undefined)) };
}

/** The to-do list, ticked on the phone and kept in my brain. */
function todoScreen(): Screen {
  const items = h('ul.pkitems', { 'aria-label': 'To-do list' });
  const status = h('p.pknote', { 'aria-live': 'polite' }, 'Kept in my brain: add by voice in the chat too ("add to my to-do: send the invoice by Friday").');
  const act = async (words: string) => {
    try {
      const r = await brain.packDo('work', 'todo', { words });
      workState.todo = ((r.data as { list?: typeof workState.todo } | undefined)?.list ?? []).map((t) => ({ text: t.text, done: !!t.done, ...(t.due ? { due: t.due } : {}) }));
      paint();
      return r.text;
    } catch (e) {
      status.textContent = `My brain didn’t answer: ${(e as Error).message}`;
      return '';
    }
  };
  const paint = () => {
    items.replaceChildren(
      ...(workState.todo.length
        ? workState.todo.map((t) => {
            const box = h('input', { type: 'checkbox', checked: t.done, 'aria-label': `${t.text}${t.due ? `, by ${t.due}` : ''}${t.done ? ', done' : ''}` }) as HTMLInputElement;
            box.addEventListener('change', () => void act(`${box.checked ? 'tick' : 'untick'} ${t.text}`));
            return h(`li.pkitem${t.done ? '.done' : ''}` as 'li', h('label', box, `${t.text}${t.due ? ` · ${t.due}` : ''}`));
          })
        : [h('li.pknote', 'Nothing to do. Add something below.')]),
    );
  };
  const input = h('input', { type: 'text', placeholder: 'send the invoice by Friday', 'aria-label': 'Add a job', enterKeyHint: 'done' }) as HTMLInputElement;
  const add = async () => {
    if (!input.value.trim()) return;
    const words = `add: ${input.value}`;
    input.value = '';
    status.textContent = await act(words);
  };
  input.addEventListener('keydown', (e) => e.key === 'Enter' && void add());
  const addBtn = button('Add', () => void add(), 'on');
  addBtn.setAttribute('aria-label', 'Add the job');
  void act('');
  return { el: h('div.pkcol', h('div.pkadd', input, addBtn), items, h('div.pkrow', button('Clear done', () => void act('clear done'))), status), stop: () => undefined };
}

