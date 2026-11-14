/**
 * MONTH (the planlane pass): the agenda as a calendar. This month as a grid, Monday first; a day with events has a dot, a day with
 * a to-do due a ring, today is lit. Tap a day and its events and to-dos are listed under the grid. ‹ and › step a month back or on,
 * as far as he likes [planlane2:timeline]: each month reads its own days from the brain (GET /agenda?from=&days=), kept for the visit,
 * and says so when it can't (then it shows what the diary already has, and a day outside that says so instead of looking empty).
 */
import type { AgendaEventInfo } from '../../../../../packages/shared/src/protocol';
import { brain } from '../../api/brain';
import { clear, fmt, h } from '../../core/dom';
import { button, panel } from '../../ui/components';
import { AHEAD_DAYS, beyondWords, dayLine, dayOf, monthGrid, pastWords, WEEKDAY_NAMES, WEEKDAYS, weekWords, type Todo } from './todowords';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function monthPanel(get: () => { events: AgendaEventInfo[]; todos: Todo[] }): { el: HTMLElement; paint(): void } {
  const p = panel('MONTH', { grow: false, cls: 'month' });
  let shift = 0; // months from this one: -1 the last, 1 the next, as far either way as he steps
  let picked = dayOf(Date.now());
  // [planlane2:timeline] each month's own days, read once per visit ('YYYY-MM' → its events, or 'failed', or on its way)
  const months = new Map<string, AgendaEventInfo[] | 'failed' | 'reading'>();
  // (a month whose read failed is tried again only when he steps to it, never in a loop of paints)
  let again = false;
  const read = (y: number, m: number) => {
    const k = `${y}-${String(m + 1).padStart(2, '0')}`;
    const was = months.get(k);
    if (was !== undefined && !(was === 'failed' && again)) return;
    months.set(k, 'reading');
    const from = new Date(y, m, 1).getTime();
    const days = Math.round((new Date(y, m + 1, 1).getTime() - from) / 86400_000);
    brain.agendaFrom(from, days).then((r) => months.set(k, r.events), () => months.set(k, 'failed')).finally(() => paint());
  };
  const paint = () => {
    const { todos } = get();
    // (today read at each paint: a page left open past midnight moves on with the day)
    const now0 = new Date();
    const base = new Date(now0.getFullYear(), now0.getMonth() + shift, 1);
    const y = base.getFullYear();
    const m = base.getMonth();
    const mk = `${y}-${String(m + 1).padStart(2, '0')}`;
    read(y, m);
    again = false;
    const own = months.get(mk);
    // what the diary already has (today on, for its six weeks: always the freshest, a change shows at once), and this month's own
    // read for the days outside that
    const d0 = new Date(now0.getFullYear(), now0.getMonth(), now0.getDate()).getTime();
    const d1 = new Date(now0.getFullYear(), now0.getMonth(), now0.getDate() + AHEAD_DAYS).getTime();
    const events = [...(Array.isArray(own) ? own.filter((e) => e.start < d0 || e.start >= d1) : []), ...get().events];
    const byDay = new Map<string, AgendaEventInfo[]>();
    for (const e of events) {
      const k = dayOf(e.start);
      byDay.set(k, [...(byDay.get(k) ?? []), e]);
    }
    const dueDays = new Map<string, number>();
    for (const t of todos) if (!t.done && t.due) dueDays.set(t.due, (dueDays.get(t.due) ?? 0) + 1);
    const today = dayOf(Date.now());
    const prev = button('‹', () => {
      shift--;
      again = true;
      paint();
    }, 'monnav');
    prev.setAttribute('aria-label', 'Last month');
    const next = button('›', () => {
      shift++;
      again = true;
      paint();
    }, 'monnav');
    next.setAttribute('aria-label', 'Next month');
    // back to this month in one tap, once he has stepped away from it
    const home = shift ? button('THIS MONTH', () => {
      shift = 0;
      picked = dayOf(Date.now());
      again = true;
      paint();
    }, 'monhome') : null;
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
    // (this month read whole: a day of it, gone or far, is said as it is; only when its read failed is the diary's six weeks the edge)
    const whole = Array.isArray(own) && picked.slice(0, 7) === mk;
    const far = !whole && pt >= startToday.getTime() + AHEAD_DAYS * 86400_000;
    const gone = !whole && picked < today;
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
        if (k.slice(0, 7) !== mk) shift = (d.getFullYear() - now0.getFullYear()) * 12 + d.getMonth() - now0.getMonth();
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
    /* state: agenda.monthread loading */
    /* state: agenda.monthread error */
    const said = own === 'reading' ? h('small.note.monread', { dataset: { case: 'keep', state: 'loading' } }, `Reading ${MONTHS[m]}’s days…`)
      : own === 'failed' ? h('small.note.bad.monread', { dataset: { case: 'keep', state: 'error' } }, `I couldn’t read ${MONTHS[m]}’s days from your brain, so this shows only what your diary already has. Step away and back to try again.`)
      : null;
    clear(p.body, h('div.keyrow.monbar', prev, h('span.monname', { dataset: { case: 'keep' } }, `${MONTHS[m]} ${y}`), next), ...(home ? [h('div.keyrow.monhomerow', home)] : []), ...(said ? [said] : []), grid, list, h('b.monwkh', 'This week'), week);
  };
  // "show me next month" from the chat (turn.ts)
  addEventListener('ghosty:month', (e) => {
    shift = (e as CustomEvent<{ next?: boolean }>).detail?.next ? 1 : 0;
    // (a month that failed is read again when it is asked for)
    again = true;
    const n = new Date();
    picked = shift ? dayOf(new Date(n.getFullYear(), n.getMonth() + 1, 1).getTime()) : dayOf(n.getTime());
    paint();
  });
  paint();
  return { el: p.el, paint };
}
