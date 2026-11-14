/**
 * TIMELINE (planlane2): the day by the hour and the week to plan, worked out on this phone from the diary he already has.
 * TODAY and TOMORROW: his events laid out by time (two at once side by side), the free gaps said in words ("Free 10:00–12:30"),
 * a line at now, all-day events at the top and his to-dos due that day beside it. WEEK (plan my week): the next seven days, each
 * with its events, its to-dos and its free slots, and the freest day said. Nothing here goes to the brain: it reads what the
 * diary was given and his list through todo.ts's own read functions.
 */
import type { AgendaEventInfo } from '../../../../../packages/shared/src/protocol';
import { clear, fmt, h } from '../../core/dom';
import { button, panel } from '../../ui/components';
import { dueOn, loadTodos } from './todo';
import { dayOf } from './todowords';
import { longGap } from './words';

const HOUR = 3600_000;
/** The waking day the free gaps are counted in: 08:00 to 22:00 (a gap at 03:00 is not free time anyone plans). */
export const WAKE = 8;
export const SLEEP = 22;
/** A gap shorter than this is not said: it is the walk between two things. */
export const MIN_GAP = 30;
/** An event with no end is laid out as an hour long (what calendars assume), and said as having no end. */
const endOf = (e: Pick<AgendaEventInfo, 'start' | 'end'>) => (e.end && e.end > e.start ? e.end : e.start + HOUR);
const hm = (ms: number) => fmt.time(new Date(ms));
const midnight = (ms: number) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};
/** `n` days after the midnight of `ms`, by the calendar (a clock change day is 23 or 25 hours, never a shifted midnight). */
const dayAfter = (ms: number, n: number) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime();
};
const at = (day: number, hour: number) => {
  const d = new Date(day);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour).getTime();
};

export interface Gap {
  from: number;
  to: number;
}

/** The free gaps of the day that starts at `day` (its midnight), inside the waking day and, for today, from now on; each at least MIN_GAP. */
export function freeGaps(events: readonly Pick<AgendaEventInfo, 'start' | 'end' | 'allDay'>[], day: number, now = Date.now()): Gap[] {
  const lo = Math.max(at(day, WAKE), now);
  const hi = at(day, SLEEP);
  if (lo >= hi) return [];
  const busy = events.filter((e) => !e.allDay && e.start < hi && endOf(e) > lo).map((e) => [Math.max(e.start, lo), Math.min(endOf(e), hi)] as const).sort((a, b) => a[0] - b[0]);
  const out: Gap[] = [];
  let t = lo;
  for (const [s, e] of busy) {
    if (s - t >= MIN_GAP * 60_000) out.push({ from: t, to: s });
    t = Math.max(t, e);
  }
  if (hi - t >= MIN_GAP * 60_000) out.push({ from: t, to: hi });
  return out;
}

/** A free gap in his words: "Free 10:00–12:30 (2 h 30 min)"; the whole waking day, "Free all day (08:00–22:00)". */
export function gapWords(g: Gap, day: number): string {
  const len = Math.round((g.to - g.from) / 60_000);
  if (g.from === at(day, WAKE) && g.to === at(day, SLEEP)) return `Free all day (${hm(g.from)}–${hm(g.to)})`;
  return `Free ${hm(g.from)}–${hm(g.to)} (${longGap(len)})`;
}

/** Side by side: each timed event gets a column and the number of columns its cluster of overlaps needs. */
export function columns<T extends Pick<AgendaEventInfo, 'start' | 'end'>>(events: readonly T[]): { e: T; col: number; cols: number }[] {
  const sorted = [...events].sort((a, b) => a.start - b.start || endOf(b) - endOf(a));
  const out: { e: T; col: number; cols: number }[] = [];
  let cluster: { e: T; col: number; cols: number }[] = [];
  let ends: number[] = [];
  let clusterEnd = -Infinity;
  const close = () => {
    const n = Math.max(1, ends.length);
    for (const c of cluster) c.cols = n;
    out.push(...cluster);
    cluster = [];
    ends = [];
  };
  for (const e of sorted) {
    if (e.start >= clusterEnd) close();
    let col = ends.findIndex((x) => x <= e.start);
    if (col < 0) col = ends.push(0) - 1;
    ends[col] = endOf(e);
    cluster.push({ e, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd === -Infinity ? 0 : clusterEnd, endOf(e));
  }
  close();
  return out;
}

/** The seven days from `day` laid out to plan: each day's events, to-dos due and free slots, and the week said in one line. */
export function weekPlan(events: readonly AgendaEventInfo[], todos: readonly { text: string; due: string; done: boolean }[], day: number, now = Date.now()) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = dayAfter(day, i);
    const evs = events.filter((e) => midnight(e.start) === d).sort((a, b) => Number(!a.allDay) - Number(!b.allDay) || a.start - b.start);
    const gaps = freeGaps(evs, d, now);
    const free = gaps.reduce((n, g) => n + (g.to - g.from), 0);
    return { day: d, key: dayOf(d), events: evs, todos: todos.filter((t) => !t.done && t.due === dayOf(d)), gaps, free: Math.round(free / 60_000) };
  });
  const freest = [...days].sort((a, b) => b.free - a.free)[0]!;
  const nEv = days.reduce((n, d) => n + d.events.length, 0);
  const nTd = days.reduce((n, d) => n + d.todos.length, 0);
  const freeH = Math.round(days.reduce((n, d) => n + d.free, 0) / 60);
  const line = `${nEv} ${nEv === 1 ? 'event' : 'events'} and ${nTd} ${nTd === 1 ? 'to-do' : 'to-dos'} in the next seven days; ${freeH} h free in the daytime.${freest.free ? ` Freest: ${freest.day === midnight(now) ? 'today' : new Date(freest.day).toLocaleDateString('en-GB', { weekday: 'long' })} (${longGap(freest.free)}).` : ''}`;
  return { days, line };
}

type View = 'today' | 'tomorrow' | 'week';
const VIEW_KEY = 'ghosty.agenda.timeline';

/**
 * The TIMELINE panel. `get` gives what the diary was given (the brain's next six weeks) and whether it is read yet;
 * `pick` opens an event whole in the diary (its change box), so a tap on the timeline is the way to change it.
 */
export function timelinePanel(get: () => { events: AgendaEventInfo[]; loaded: boolean; offline: boolean }, pick: (id: string) => void): { el: HTMLElement; paint(): void } {
  const p = panel('TIMELINE', { grow: false, cls: 'timeline' });
  let view: View = 'today';
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === 'tomorrow' || v === 'week') view = v;
  } catch {
    /* a private window: today, as it opens */
  }
  const setView = (v: View) => {
    view = v;
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* kept for this visit only */
    }
    paint();
  };
  const evRow = (e: AgendaEventInfo, cls: string, label: string) => {
    const b = button('', () => pick(e.id), cls);
    b.dataset.case = 'keep';
    b.dataset.id = e.id;
    b.append(h('span.tlwhen', label), h('b.tltitle', e.title), e.location ? h('small.tlwhere', e.location) : '');
    b.setAttribute('aria-label', `${e.title}, ${label}${e.location ? `, at ${e.location}` : ''}. Tap to see it whole or change it.`);
    return b;
  };

  const dayView = (events: AgendaEventInfo[], day: number, now: number): HTMLElement[] => {
    const isToday = day === midnight(now);
    const todays = events.filter((e) => midnight(e.start) === day);
    const allDay = todays.filter((e) => e.allDay);
    const timed = todays.filter((e) => !e.allDay).sort((a, b) => a.start - b.start);
    const todos = dueOn(loadTodos(), dayOf(day));
    const gaps = freeGaps(timed, day, isToday ? now : 0);
    const out: HTMLElement[] = [];
    // the free time said first: what he opens a timeline to find
    const freeLine = gaps.length
      ? gaps.map((g) => gapWords(g, day))
      : [isToday && now >= at(day, SLEEP) ? 'The day is over: nothing more to plan today.' : 'No free gap of half an hour or more between 08:00 and 22:00.'];
    /* state: agenda.timeline empty */
    if (!todays.length && !todos.length) out.push(h('p.note.tlempty', { dataset: { case: 'keep', state: 'empty' } }, isToday ? 'Nothing in your diary for the rest of today.' : 'Nothing in your diary tomorrow.'));
    out.push(h('div.tlfree', { role: 'list', 'aria-label': 'Free time' }, ...freeLine.map((t) => h('span.tlgap', { role: 'listitem', dataset: { case: 'keep' } }, t))));
    if (allDay.length) out.push(h('div.tlallday', { role: 'list', 'aria-label': 'All day' }, ...allDay.map((e) => evRow(e, 'tlad', 'All day'))));
    if (todos.length) out.push(h('div.tltodo', { role: 'list', 'aria-label': 'To-dos due' }, ...todos.map((t) => h('span.tltd', { role: 'listitem', dataset: { case: 'keep' } }, h('span.tlwhen', 'To-do'), h('span', t.text)))));
    // the hours: from 08:00 (or the first thing, if earlier) to 22:00 (or the last thing's end)
    const first = Math.min(WAKE, ...timed.map((e) => new Date(e.start).getHours()));
    const lastEnd = Math.max(at(day, SLEEP), ...timed.map((e) => Math.min(endOf(e), dayAfter(day, 1))));
    const last = Math.min(24, Math.ceil((lastEnd - day) / HOUR - 0.001));
    const top = at(day, first);
    const span = last - first;
    // (each hour is a share of the grid's height, so the layout scales with his text size and never needs a px size)
    const pct = (ms: number) => `${Math.max(0, Math.min(100, ((ms - top) / (span * HOUR)) * 100))}%`;
    const grid = h('div.tlgrid', { style: `--tlhours:${span}`, role: 'list', 'aria-label': isToday ? 'Today by the hour' : 'Tomorrow by the hour' });
    for (let hr = first; hr < last; hr++) grid.append(h('span.tlhour', { 'aria-hidden': 'true', style: `top:${pct(at(day, hr))}` }, `${String(hr).padStart(2, '0')}:00`));
    for (const g of gaps) grid.append(h('span.tlband', { 'aria-hidden': 'true', style: `top:${pct(g.from)};height:calc(${pct(g.to)} - ${pct(g.from)})` }));
    for (const { e, col, cols } of columns(timed)) {
      const label = `${hm(e.start)}${e.end ? `–${hm(e.end)}` : ''}`;
      const b = evRow(e, `tlev${endOf(e) <= now ? ' past' : ''}${e.start <= now && endOf(e) > now ? ' live' : ''}`, label);
      b.setAttribute('role', 'listitem');
      b.style.cssText = `top:${pct(e.start)};--tlh:calc(${pct(endOf(e))} - ${pct(e.start)});left:calc(var(--tlgut) + (100% - var(--tlgut)) * ${col / cols});width:calc((100% - var(--tlgut)) / ${cols})`;
      grid.append(b);
    }
    if (isToday && now >= top && now < at(day, last)) grid.append(h('span.tlnow', { style: `top:${pct(now)}`, role: 'listitem', 'aria-label': `Now, ${hm(now)}` }, h('b', `Now ${hm(now)}`)));
    out.push(grid);
    return out;
  };

  const weekView = (events: AgendaEventInfo[], now: number): HTMLElement[] => {
    const w = weekPlan(events, loadTodos(), midnight(now), now);
    const list = h('div.tlweek', { role: 'list', 'aria-label': 'The next seven days' });
    for (const d of w.days) {
      const name = d.day === midnight(now) ? 'Today' : d.day === dayAfter(now, 1) ? 'Tomorrow' : new Date(d.day).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
      const free = d.gaps.length ? d.gaps.slice(0, 3).map((g) => `${hm(g.from)}–${hm(g.to)}`).join(', ') + (d.gaps.length > 3 ? ` and ${d.gaps.length - 3} more` : '') : '';
      list.append(h('div.tlday', { role: 'listitem', dataset: { case: 'keep', day: d.key } },
        h('b.tldayname', name),
        ...d.events.map((e) => evRow(e, 'tlwev', e.allDay ? 'All day' : `${hm(e.start)}${e.end ? `–${hm(e.end)}` : ''}`)),
        ...d.todos.map((t) => h('span.tltd', h('span.tlwhen', 'To-do'), h('span', t.text))),
        h('small.tlwfree', { dataset: { case: 'keep' } }, d.gaps.length ? `Free ${free} · ${longGap(d.free)} in all` : d.day === midnight(now) && now >= at(d.day, SLEEP) ? 'The day is over.' : 'No free gap of half an hour or more.')));
    }
    return [h('p.tlweekline', { dataset: { case: 'keep' } }, w.line), list];
  };

  const paint = () => {
    const { events, loaded, offline } = get();
    const now = Date.now();
    const keys = (['today', 'tomorrow', 'week'] as View[]).map((v) => {
      const b = button(v === 'today' ? 'TODAY' : v === 'tomorrow' ? 'TOMORROW' : 'PLAN MY WEEK', () => setView(v), `tlkey${view === v ? ' on' : ''}`);
      b.setAttribute('aria-pressed', String(view === v));
      return b;
    });
    const bar = h('div.keyrow.wrapit.tlbar', ...keys);
    /* state: agenda.timeline loading */
    if (!loaded) return void clear(p.body, bar, h('p.note.wait', { dataset: { case: 'keep', state: 'loading' } }, 'Reading your diary to lay out the day.'));
    const body = view === 'week' ? weekView(events, now) : dayView(events, view === 'today' ? midnight(now) : dayAfter(now, 1), now);
    /* state: agenda.timeline offline */
    const note = offline ? [h('p.note.bad.tlcopy', { dataset: { case: 'keep', state: 'offline' } }, 'Laid out from the last copy of your diary on this phone: I can’t reach your brain right now.')] : [];
    clear(p.body, bar, ...note, ...body);
  };
  // his list changed somewhere (the TO-DO panel, the chat): the to-dos beside the day follow it
  // (the list's own change signal, by its name: todo.ts is the list's to change, so only its read functions are imported)
  addEventListener('ghosty:todo', () => paint());
  // "plan my week" / "show my day" from elsewhere (the chat's lines): open that view
  addEventListener('ghosty:timeline', (e) => {
    const v = (e as CustomEvent<{ view?: View }>).detail?.view;
    if (v === 'today' || v === 'tomorrow' || v === 'week') setView(v);
  });
  paint();
  return { el: p.el, paint };
}
