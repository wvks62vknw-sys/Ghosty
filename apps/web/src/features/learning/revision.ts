/**
 * REVISION DAYS UP TO AN EXAM (learn.s12): he gives what the exam is, its date, a time of day and how long a session is; I spread
 * short revision sessions across his days up to it (every other day at first, every day in the last week, none on the day
 * itself), show them first, and put them in his agenda only when he taps ADD. Each session reminds him ten minutes before
 * (the brain's own reminder, so it reaches a locked phone). TAKE THEM OUT removes the ones it added.
 */
import { brain } from '../../api/brain';
import { clear, h } from '../../core/dom';
import { button } from '../../ui/components';
import { sayError } from '../../ui/hisWords';
import { londonAt, revisionDays, ymd } from './revisiondays';

export const revisionState = { subject: '', exam: '', days: [] as string[], added: [] as string[], line: '' };

/** The box under the Learning PLAN: the exam, its date, the time and length, a preview, ADD and TAKE THEM OUT. */
export function revisionBox(): HTMLElement {
  const subject = h('input', { type: 'text', 'aria-label': 'What the exam is', placeholder: 'e.g. driving theory, GCSE maths', autocomplete: 'off', maxlength: '60' }) as HTMLInputElement;
  const date = h('input', { type: 'date', 'aria-label': 'The exam date' }) as HTMLInputElement;
  const time = h('select', { 'aria-label': 'The time of day to revise' }, ...['07:30', '12:30', '17:30', '18:30', '19:30', '20:30'].map((t) => h('option', { value: t, ...(t === '18:30' ? { selected: true } : {}) }, t))) as HTMLSelectElement;
  const mins = h('select', { 'aria-label': 'How long each session is' }, ...[15, 20, 30, 45].map((m) => h('option', { value: String(m), ...(m === 20 ? { selected: true } : {}) }, `${m} minutes`))) as HTMLSelectElement;
  const say = h('p.pknote', { role: 'status' });
  const list = h('ul.pkrevlist');
  const add = button('ADD THEM TO MY DAYS', () => void addAll(), 'on');
  const out = button('TAKE THEM OUT', () => void takeOut());
  add.hidden = out.hidden = true;
  let plan: string[] = [];
  const preview = () => {
    const s = subject.value.trim();
    const today = ymd(Date.now());
    revisionState.subject = s;
    revisionState.exam = date.value;
    clear(list);
    add.hidden = true;
    if (!s || !date.value) return void (say.textContent = 'Say what the exam is and pick its date: I show the sessions before anything goes in your days.');
    if (date.value <= today) return void (say.textContent = 'Pick a date after today.');
    plan = revisionDays(today, date.value);
    revisionState.days = plan;
    if (!plan.length) return void (say.textContent = 'That is tomorrow: no days left to spread revision over. Good luck!');
    say.textContent = `${plan.length} sessions of ${mins.value} minutes at ${time.value}, every other day at first and every day in the last week, none on the day itself.`;
    list.append(...plan.map((d) => h('li', new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }))));
    add.textContent = `ADD ${plan.length} SESSIONS TO MY DAYS`;
    add.hidden = false;
  };
  for (const el of [subject, date, time, mins]) el.addEventListener('input', preview), el.addEventListener('change', preview);
  const addAll = async () => {
    add.disabled = true;
    const s = subject.value.trim();
    const len = Number(mins.value) * 60_000;
    const ids: string[] = [];
    try {
      for (const d of plan) {
        const start = londonAt(d, time.value);
        const r = await brain.addEvent({ title: `Revise: ${s}`, start, end: start + len, remindMin: 10 });
        if (r?.event?.id) ids.push(r.event.id);
      }
      revisionState.added = ids;
      revisionState.line = `In your days: ${plan.length} sessions of revision for ${s}, each with a reminder ten minutes before.`;
      say.textContent = revisionState.line;
      add.hidden = true;
      out.hidden = !ids.length;
    } catch (e) {
      revisionState.added = ids;
      say.textContent = `${sayError(e, 'add them to your days')}${ids.length ? ` ${ids.length} went in before it stopped: TAKE THEM OUT removes them.` : ''}`;
      out.hidden = !ids.length;
    } finally {
      add.disabled = false;
    }
  };
  const takeOut = async () => {
    out.disabled = true;
    let left = 0;
    for (const id of revisionState.added) await brain.deleteEvent(id).catch(() => void left++);
    revisionState.added = [];
    say.textContent = left ? `Taken out, except ${left} I couldn’t reach just now: they are in your agenda to remove.` : 'Taken out of your days.';
    out.hidden = true;
    out.disabled = false;
    preview();
  };
  preview();
  return h('div.pkrevision', h('b.pklab', 'REVISION UP TO AN EXAM'), h('label.pkfield', h('span.pklab', 'What the exam is'), subject), h('label.pkfield', h('span.pklab', 'Its date'), date), h('div.pkrow', h('label.pkfield', h('span.pklab', 'Time'), time), h('label.pkfield', h('span.pklab', 'Each session'), mins)), say, list, h('div.pkrow', add, out));
}
