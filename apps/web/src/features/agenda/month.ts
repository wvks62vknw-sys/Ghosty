/**
 * MONTH (the planlane pass): the agenda as a calendar. This month as a grid, Monday first; a day with events has a dot, a day with
 * a to-do due a ring, today is lit. Tap a day and its events and to-dos are listed under the grid. ‹ and › step a month (this one
 * and the next: the diary reads 42 days ahead); a day past that range or gone says so instead of looking empty.
 */
import type { AgendaEventInfo } from '../../../../../packages/shared/src/protocol';
import { clear, fmt, h } from '../../core/dom';
import { button, panel } from '../../ui/components';
import { AHEAD_DAYS, beyondWords, dayLine, dayOf, monthGrid, pastWords, WEEKDAY_NAMES, WEEKDAYS, weekWords, type Todo } from './todowords';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function monthPanel(get: () => { events: AgendaEventInfo[]; todos: Todo[] }): { el: HTMLElement; paint(): void } {
  const p = panel('MONTH', { grow: false, cls: 'month' });
  let shift = 0; // 0 this month, 1 the next
  let picked = dayOf(Date.now());
  const paint = () => {
    const { events, todos } = get();
    // (today read at each paint: a page left open past midnight moves on with the day)
    const now0 = new Date();
    const base = new Date(now0.getFullYear(), now0.getMonth() + shift, 1);
    const y = base.getFullYear();
    const m = base.getMonth();
    const byDay = new Map<string, AgendaEventInfo[]>();
    for (const e of events) {
      const k = dayOf(e.start);
      byDay.set(k, [...(byDay.get(k) ?? []), e]);
    }
    const dueDays = new Map<string, number>();
    for (const t of todos) if (!t.done && t.due) dueDays.set(t.due, (dueDays.get(t.due) ?? 0) + 1);
    const today = dayOf(Date.now());
    const prev = button('‹', () => {
      shift = 0;
      paint();
    }, 'monnav');
    prev.setAttribute('aria-label', 'This month');
    prev.disabled = shift === 0;
    const next = button('›', () => {
      shift = 1;
      paint();
    }, 'monnav');
    next.setAttribute('aria-label', 'Next month');
    next.disabled = shift === 1;
    const grid = h('div.mongrid', { role: 'grid', 'aria-label': `${MONTHS[m]} ${y}` },
      h('div.monrow.monhead', { role: 'row' }, ...WEEKDAYS.map((d, i) => h('span', { role: 'columnheader', 'aria-label': WEEKDAY_NAMES[i] }, d))),
      ...monthGrid(y, m).map((w) => h('div.monrow', { role: 'row' }, ...w.map((d) => {
        if (d == null) return h('span.mday.out', { role: 'gridcell' });
        const k = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const n = byDay.get(k)?.length ?? 0;
        const due = dueDays.get(k) ?? 0;
        const b = button(String(d), () => {
          picked = k;
          paint();
        }, `mday${k === today ? ' today' : ''}${k === picked ? ' on' : ''}${n ? ' has' : ''}${due ? ' due' : ''}${k < today ? ' past' : ''}`);
        b.setAttribute('role', 'gridcell');
        b.setAttribute('aria-label', dayLine(new Date(y, m, d).getTime(), n, due));
        b.setAttribute('aria-selected', String(k === picked));
        return b;
      }))));
    // the day picked, said under the grid with what is on it
    const [py, pm, pd] = picked.split('-').map(Number);
    const pt = new Date(py!, pm! - 1, pd!).getTime();
    const evs = (byDay.get(picked) ?? []).sort((a, b) => a.start - b.start);
    const tds = todos.filter((t) => !t.done && t.due === picked);
    // (the brain reads from the start of today for AHEAD_DAYS days: the day that starts at that edge is already outside it)
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const far = pt >= startToday.getTime() + AHEAD_DAYS * 86400_000;
    const gone = picked < today;
    const list = h('div.monlist', { 'aria-live': 'polite' },
      h('b.mdayline', { dataset: { case: 'keep' } }, dayLine(pt, evs.length, tds.length)),
      ...(gone && !evs.length ? [h('small.note', pastWords)] : far && !evs.length ? [h('small.note', beyondWords)] : []),
      ...evs.map((e) => h('div.monev', { dataset: { case: 'keep' } }, h('span.monwhen', e.allDay ? 'All day' : fmt.time(new Date(e.start))), h('span', e.title, e.location ? ` · ${e.location}` : ''))),
      ...tds.map((t) => h('div.monev.todo', { dataset: { case: 'keep' } }, h('span.monwhen', 'To-do'), h('span', t.text))));
    // THIS WEEK (Monday to Sunday), each day with what it holds in a line; a tap shows the day whole under the grid
    const week = h('div.monweek', { role: 'list', 'aria-label': 'This week' });
    const mon = new Date(now0.getFullYear(), now0.getMonth(), now0.getDate() - ((now0.getDay() + 6) % 7));
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i);
      const k = dayOf(d.getTime());
      const de = (byDay.get(k) ?? []).sort((a, b) => a.start - b.start);
      const dt = todos.filter((t) => !t.done && t.due === k);
      const b = button('', () => {
        picked = k;
        if (k.slice(0, 7) !== `${y}-${String(m + 1).padStart(2, '0')}`) shift = k > today ? 1 : 0;
        paint();
      }, `monwk${k === today ? ' today' : ''}${k === picked ? ' on' : ''}${k < today ? ' past' : ''}`);
      b.setAttribute('role', 'listitem');
      // a day gone this week was never read (the diary shows what is still to come): "Gone", never "Nothing on"
      const gone = k < today && !de.length && !dt.length;
      b.setAttribute('aria-label', gone ? `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}: gone` : dayLine(d.getTime(), de.length, dt.length));
      b.dataset.case = 'keep';
      b.append(h('b', d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })),
        h('span', gone ? 'Gone' : weekWords(de.map((e) => `${e.title}${e.allDay ? '' : ` ${fmt.time(new Date(e.start))}`}`), dt.length)));
      week.append(b);
    }
    clear(p.body, h('div.keyrow.monbar', prev, h('span.monname', { dataset: { case: 'keep' } }, `${MONTHS[m]} ${y}`), next), grid, list, h('b.monwkh', 'This week'), week);
  };
  // "show me next month" from the chat (turn.ts)
  addEventListener('ghosty:month', (e) => {
    shift = (e as CustomEvent<{ next?: boolean }>).detail?.next ? 1 : 0;
    const n = new Date();
    picked = shift ? dayOf(new Date(n.getFullYear(), n.getMonth() + 1, 1).getTime()) : dayOf(n.getTime());
    paint();
  });
  paint();
  return { el: p.el, paint };
}
