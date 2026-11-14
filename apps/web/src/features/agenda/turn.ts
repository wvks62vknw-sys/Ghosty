/** THE AGENDA FROM THE CHAT (planlane): what was asked, done on the phone, and said back in one line (assistant/local.ts calls this). */
import type { PackReply } from '../../assistant/packs';
import { agendaAsked, type AgendaAsk } from './asks';
import { undo } from '../../ui/components';
import { addTodo, clearDone, loadTodos, removeTodo, syncTodos, tickTodo } from './todo';
import { daysTo, dayOf, dueWords, everyWords, findTodo, sortTodos, type Todo } from './todowords';

// (the panel too: the chip opens the agenda on the to-do list or the month, not on whichever section was last chosen)
const OPEN_TODO = { id: 'screen:agenda', ask: -1, label: 'Open the to-do list', open: 'agenda', panel: 'TO-DO' };
const OPEN_MONTH = { id: 'screen:agenda', ask: -1, label: 'Open the month', open: 'agenda', panel: 'MONTH' };
const OPEN_TIMELINE = { id: 'screen:agenda', ask: -1, label: 'Open your day by the hour', open: 'agenda', panel: 'TIMELINE' };
/* state: agenda.todo error */
const NOT_KEPT = 'This phone would not keep your to-do list (its storage is full or blocked), so nothing changed. Free some space, or leave private browsing, and try again.';

/** One to-do in a sentence: "Buy milk (due today)", "Renew passport (2 days late)". */
const one = (t: Todo, now: number) => {
  const w = dueWords(t.due, now).replace(/^Due /, 'due ');
  return `${t.star ? '★ ' : ''}${t.text}${w ? ` (${w})` : ''}`;
};
const join = (l: string[]) => (l.length <= 1 ? l.join('') : `${l.slice(0, -1).join('; ')}; and ${l[l.length - 1]}`);
const reply = (said: string, words: string, go = OPEN_TODO): PackReply => ({ said, reply: words, go: [go] });

/** Show the agenda's to-do list (or its month) on the screen, as he asked. */
async function show(title: 'TO-DO' | 'MONTH', next = false): Promise<void> {
  const { goToPanel } = await import('../../ui/sections');
  goToPanel('agenda', title);
  if (title === 'MONTH') dispatchEvent(new CustomEvent('ghosty:month', { detail: { next } }));
}

function listWords(ask: Extract<AgendaAsk, { what: 'list' }>, now: number): string {
  const all = sortTodos(loadTodos(), now);
  const open = all.filter((t) => !t.done);
  if (!all.length) return 'Your to-do list is empty. Say “add buy milk to my to-do list”, or type one on Agenda › To-do.';
  if (!open.length) return `Everything on your list is done (${all.length}). Say “clear my done to-dos” to tidy it.`;
  const late = open.filter((t) => t.due && daysTo(t.due, now) < 0);
  const today = open.filter((t) => t.due && daysTo(t.due, now) === 0);
  if (ask.when === 'today') {
    if (!late.length && !today.length) {
      // the one due soonest (not the first starred one, which may be weeks away)
      const next = open.filter((t) => t.due).sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0))[0] ?? open[0]!;
      return `Nothing due today. ${open.length} on your list; next: ${one(next, now)}.`;
    }
    return [today.length ? `Due today: ${join(today.map((t) => one(t, now).replace(/ \(due today\)$/, '')))}.` : 'Nothing new due today.', late.length ? `Late: ${join(late.map((t) => one(t, now)))}.` : ''].filter(Boolean).join(' ');
  }
  if (ask.when === 'late') return late.length ? `${late.length} late: ${join(late.map((t) => one(t, now)))}.` : 'Nothing is late. Well done.';
  if (ask.when === 'starred') {
    const st = open.filter((t) => t.star);
    return st.length ? `Starred: ${join(st.map((t) => one(t, now)))}.` : 'Nothing starred. Tap ☆ on a to-do that matters, or say “add … to my list, it’s important”.';
  }
  if (ask.when === 'week') {
    const wk = open.filter((t) => t.due && daysTo(t.due, now) <= 7);
    return wk.length ? `This week: ${join(wk.map((t) => one(t, now)))}.` : `Nothing due in the next seven days. ${open.length} on your list with a later day or none.`;
  }
  const shown = open.slice(0, 8).map((t) => one(t, now));
  const more = open.length > 8 ? ` And ${open.length - 8} more on Agenda › To-do.` : '';
  const done = all.length - open.length;
  return `${open.length} to do: ${join(shown)}.${more}${done ? ` ${done} done.` : ''}`;
}

/** What is on in a month, from his diary (the brain's, or the last copy on this phone, said so) and his to-dos. */
async function monthWords(next: boolean, now: number): Promise<string> {
  const base = new Date(now);
  const from = new Date(base.getFullYear(), base.getMonth() + (next ? 1 : 0), 1);
  const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
  const name = from.toLocaleDateString('en-GB', { month: 'long' });
  const [{ brain }, { offline }] = await Promise.all([import('../../api/brain'), import('../../api/offline')]);
  const was = offline.get().agenda;
  // enough days to reach the month's last day (the brain reads from the start of today, up to 62 days: always enough)
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate()).getTime();
  const days = Math.min(62, Math.max(1, Math.ceil((to.getTime() - start) / 86400_000)));
  const got = await Promise.race([brain.agenda(days).then((a) => a.events), new Promise<null>((r) => setTimeout(() => r(null), 6000))]).catch(() => null);
  const copy = !got || (was !== null && offline.get().agenda === was);
  const events = (got ?? offline.get().agenda?.events ?? []).filter((e) => e.start >= Math.max(from.getTime(), next ? 0 : new Date(base.getFullYear(), base.getMonth(), base.getDate()).getTime()) && e.start < to.getTime());
  const fromDay = dayOf(from.getTime());
  const toDay = dayOf(to.getTime());
  const todos = loadTodos().filter((t) => !t.done && t.due && t.due >= fromDay && t.due < toDay);
  const evs = events.sort((a, b) => a.start - b.start).slice(0, 6).map((e) => {
    const d = new Date(e.start).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    return `${e.title}, ${d}${e.allDay ? '' : ` ${new Date(e.start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}`;
  });
  const head = `${name}${next ? '' : ' (from today)'}: ${events.length} ${events.length === 1 ? 'event' : 'events'}${todos.length ? ` and ${todos.length} ${todos.length === 1 ? 'to-do' : 'to-dos'} due` : ''}.`;
  /* state: agenda.month offline */
  const stale = !got && !was ? ' I can’t reach your diary right now, so this is only your to-dos.' : copy ? ' I can’t reach your brain right now, so this is the last copy on this phone.' : '';
  const body = evs.length ? ` ${join(evs)}${events.length > 6 ? `, and ${events.length - 6} more` : ''}.` : events.length ? '' : ' Nothing in the diary.';
  const tds = todos.length ? ` To-dos: ${join(todos.slice(0, 5).map((t) => one(t, now)))}.` : '';
  return `${head}${body}${tds}${stale}`;
}

/** [planlane2:timeline] The free time today or tomorrow, or the week to plan, worked out on this phone from his diary (said when it is a copy). */
async function timelineWords(view: 'today' | 'tomorrow' | 'week', now: number): Promise<string> {
  const [{ brain }, { offline }, tl] = await Promise.all([import('../../api/brain'), import('../../api/offline'), import('./timeline')]);
  const was = offline.get().agenda;
  const got = await Promise.race([brain.agenda(8).then((a) => a.events), new Promise<null>((r) => setTimeout(() => r(null), 6000))]).catch(() => null);
  /* state: agenda.timeline offline */
  if (!got && !was) return 'I can’t reach your diary right now, so I can’t work out your free time. Your day by the hour fills in when I can.';
  const copy = !got || (was !== null && offline.get().agenda === was);
  const events = got ?? offline.get().agenda?.events ?? [];
  const tail = copy ? ' I can’t reach your brain right now, so this is from the last copy on this phone.' : '';
  const d0 = new Date(now);
  d0.setHours(0, 0, 0, 0);
  if (view === 'week') return `${tl.weekPlan(events, loadTodos(), d0.getTime(), now).line}${tail}`;
  const day = view === 'today' ? d0.getTime() : new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + 1).getTime();
  const gaps = tl.freeGaps(events.filter((e) => tl.onDay(e, day)), day, view === 'today' ? now : 0);
  const name = view === 'today' ? 'Today' : 'Tomorrow';
  return `${name}: ${gaps.length ? `${join(gaps.map((g) => tl.gapWords(g, day)))}.` : 'no free half hour between 08:00 and 22:00.'}${tail}`;
}

/** The answer, or null to let the next table (and then the brain) answer. */
export async function agendaTurn(text: string): Promise<PackReply | null> {
  const ask = agendaAsked(text);
  if (!ask) return null;
  // the copy follows the one list first (a change the brain made, e.g. "add to my to-do: …" through the model), never waiting long
  if (ask.what !== 'add') await Promise.race([syncTodos(true), new Promise((r) => setTimeout(r, 2500))]);
  const now = Date.now();
  if (ask.what === 'add') {
    const t = addTodo(ask.text, ask.due, ask.every, ask.star);
    if (!t) return reply(text, NOT_KEPT);
    const when = [t.due ? dueWords(t.due, now).replace(/^Due /, 'due ') : '', ask.every ? `repeats ${everyWords(ask.every)}` : '', ask.star ? 'starred' : ''].filter(Boolean).join(', ');
    return reply(text, `Added to your to-do list: ${t.text}${when ? `, ${when}` : ''}. ${loadTodos().filter((x) => !x.done).length} to do.`);
  }
  if (ask.what === 'list') {
    if (ask.when === 'all') void show('TO-DO');
    return reply(text, listWords(ask, now));
  }
  if (ask.what === 'tick' || ask.what === 'remove') {
    const l = loadTodos();
    // a loose wording ("I've done the car", "mark step 2 as done") takes only a to-do whose own words he said, never one shared word
    const t = findTodo(l, ask.text, false, ask.what === 'tick' && ask.loose);
    if (!t) {
      const already = ask.what === 'tick' ? findTodo(l, ask.text, true, ask.loose) : null;
      if (already) return reply(text, `“${already.text}” is already ticked off.`);
      // nothing like it on his list: not about this list (the shopping list, the work pack's to-dos, a roadmap step, a practice
      // logged): the next table, or the brain, has it
      return null;
    }
    if (ask.what === 'remove') {
      if (!removeTodo(t.id)) return reply(text, NOT_KEPT);
      return reply(text, `Taken off your list: ${t.text}. UNDO brings it back.`);
    }
    const r = tickTodo(t.id);
    if (!r) return reply(text, NOT_KEPT);
    // UNDO ticks it back on (and takes away the next one a repeating one made)
    undo(`Ticked off: ${t.text}`, () => {
      if (loadTodos().find((x) => x.id === t.id)?.done) tickTodo(t.id);
    });
    const left = loadTodos().filter((x) => !x.done).length;
    return reply(text, `Ticked off: ${t.text}.${r.next ? ` It repeats: the next one is ${dueWords(r.next.due, now).replace(/^Due /, 'due ')}.` : ''} ${left ? `${left} left to do.` : 'Nothing left to do.'} UNDO puts it back.`);
  }
  if (ask.what === 'clear') {
    const n = clearDone();
    if (n < 0) return reply(text, NOT_KEPT);
    return reply(text, n ? `Cleared ${n} done ${n === 1 ? 'to-do' : 'to-dos'}. UNDO brings ${n === 1 ? 'it' : 'them'} back.` : 'There are no done to-dos to clear.');
  }
  if (ask.what === 'timeline') {
    const { goToPanel } = await import('../../ui/sections');
    goToPanel('agenda', 'TIMELINE');
    dispatchEvent(new CustomEvent('ghosty:timeline', { detail: { view: ask.view } }));
    return reply(text, await timelineWords(ask.view, now), OPEN_TIMELINE);
  }
  if (ask.show) void show('MONTH', ask.next);
  return reply(text, await monthWords(ask.next, now), OPEN_MONTH);
}
