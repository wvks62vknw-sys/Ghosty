/**
 * [planlane4:calendar] ANY YEAR: the MONTH panel's YEAR view. Twelve small months of the year, Monday first, a dot under each day with events
 * (in its calendar's colour), today marked; ‹ and › step a year back or on without limit, THIS YEAR comes home, and a tap on a month opens it
 * in MONTH. Each month is read for itself through GET /agenda?from=&days= (month.ts keeps the reads, shared with MONTH), so the year says how
 * many of its months are in, and which it could not read.
 */
import type { AgendaEventInfo } from '../../../../../packages/shared/src/protocol';
import { h } from '../../core/dom';
import { button } from '../../ui/components';
import { dayOf, monthGrid, WEEKDAYS } from './todowords';

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export type MonthRead = AgendaEventInfo[] | 'failed' | 'offline' | 'reading' | undefined;

/** How many days of a month (by the calendar) have something on, and the days themselves: 'YYYY-MM-DD' → its events. */
export function daysWithEvents(events: readonly AgendaEventInfo[], y: number, m: number): Map<string, AgendaEventInfo[]> {
  const out = new Map<string, AgendaEventInfo[]>();
  const lo = new Date(y, m, 1).getTime();
  const hi = new Date(y, m + 1, 1).getTime();
  for (const e of events) {
    // (an event running across days counts on each day of this month it runs through; a whole-day one up to its last day)
    const end = e.end && e.end > e.start ? e.end : e.start + 1;
    for (let d = new Date(Math.max(e.start, lo)); d.getTime() < Math.min(end, hi); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const k = dayOf(d.getTime());
      out.set(k, [...(out.get(k) ?? []), e]);
      if (out.size > 31) break;
    }
  }
  return out;
}

/** The year in a line: "2027: 14 days with something on in the 12 months read." (or what is still to come in) */
export function yearWords(y: number, reads: readonly MonthRead[], busyDays: number): string {
  const inn = reads.filter(Array.isArray).length;
  const failed = reads.map((r, i) => (r === 'failed' || r === 'offline' ? MONTHS[i] : '')).filter(Boolean);
  if (inn < 12 && !failed.length) return `Reading ${y}: ${inn} of 12 months in.`;
  const days = `${busyDays} ${busyDays === 1 ? 'day' : 'days'} with something on`;
  if (!failed.length) return busyDays ? `${y}: ${days}.` : `Nothing in your diary in ${y}.`;
  return `${y}: ${days} in the ${inn} ${inn === 1 ? 'month' : 'months'} read.`;
}

/**
 * The year's body. `read(y, m)` gives a month's read (and starts it); `colour(e)` its calendar's colour; `step(n)` moves n years, `home()`
 * comes back to this year, `open(m)` opens that month in MONTH and `month()` goes back to MONTH as it was.
 */
export function yearView(o: { y: number; shifted: boolean; read(y: number, m: number): MonthRead; extra: readonly AgendaEventInfo[]; colour(e: AgendaEventInfo): string; step(n: number): void; home(): void; open(m: number): void; month(): void }): HTMLElement[] {
  const { y } = o;
  const today = dayOf(Date.now());
  const reads = MONTHS.map((_, m) => o.read(y, m));
  let busy = 0;
  const minis = MONTHS.map((name, m) => {
    const r = reads[m];
    const lo = new Date(y, m, 1).getTime();
    const hi = new Date(y, m + 1, 1).getTime();
    // (the diary's own six weeks are the freshest: a move shows at once; the month's read for the rest, once by id)
    const have = new Set(o.extra.map((e) => e.id));
    const events = [...(Array.isArray(r) ? r.filter((e) => !have.has(e.id)) : []), ...o.extra.filter((e) => e.start < hi && (e.end ?? e.start + 1) > lo)];
    const days = daysWithEvents(events, y, m);
    busy += days.size;
    const thisMonth = today.slice(0, 7) === `${y}-${String(m + 1).padStart(2, '0')}`;
    const grid = h('span.yrdays', { 'aria-hidden': 'true' },
      ...WEEKDAYS.map((d) => h('i.yrwd', d.slice(0, 1))),
      ...monthGrid(y, m).flat().map((d) => {
        if (d == null) return h('i.yrday.out');
        const k = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const evs = days.get(k);
        const c = h(`i.yrday${k === today ? '.today' : ''}${evs ? '.has' : ''}${k < today ? '.past' : ''}` as 'i', String(d));
        if (evs) c.style.setProperty('--c', o.colour(evs[0]!));
        return c;
      }));
    const n = days.size;
    const state = r === 'reading' || r === undefined ? 'still being read' : r === 'failed' || r === 'offline' ? 'not read' : n ? `${n} ${n === 1 ? 'day' : 'days'} with something on` : 'nothing on';
    const b = button('', () => o.open(m), `yrmon${thisMonth ? ' now' : ''}${r === 'failed' || r === 'offline' ? ' bad' : ''}`);
    b.dataset.case = 'keep';
    b.dataset.month = String(m + 1);
    b.setAttribute('role', 'listitem');
    b.setAttribute('aria-label', `${name} ${y}${thisMonth ? ', this month' : ''}: ${state}. Tap to open it.`);
    b.append(h('b.yrname', name.slice(0, 3)), grid);
    return b;
  });
  const prev = button('‹', () => o.step(-1), 'monnav');
  prev.setAttribute('aria-label', 'Last year');
  const next = button('›', () => o.step(1), 'monnav');
  next.setAttribute('aria-label', 'Next year');
  const failed = reads.some((r) => r === 'failed' || r === 'offline');
  const off = reads.some((r) => r === 'offline');
  const reading = reads.some((r) => r === 'reading' || r === undefined);
  const line = yearWords(y, reads, busy);
  /* state: agenda.year loading */
  /* state: agenda.year empty */
  /* state: agenda.year error */
  /* state: agenda.year offline */
  const said = off
    ? h('small.note.bad.yrsay', { dataset: { case: 'keep', state: 'offline' } }, `I can’t reach your brain, so the months marked not read show only what your diary already has. Step away and back to try again.`)
    : failed
      ? h('small.note.bad.yrsay', { dataset: { case: 'keep', state: 'error' } }, `I couldn’t read ${reads.map((r, i) => (r === 'failed' ? MONTHS[i] : '')).filter(Boolean).join(', ')} from your brain. Step away and back to try again.`)
      : h(`small.note.yrsay${reading ? '.wait' : ''}` as 'small', { dataset: { case: 'keep', state: reading ? 'loading' : busy ? 'shown' : 'empty' } }, line);
  return [
    h('div.keyrow.monbar.yrbar', prev, h('span.monname.yrnum', { dataset: { case: 'keep' } }, String(y)), next),
    h('div.keyrow.yrkeys', ...(o.shifted ? [button('THIS YEAR', o.home, 'yrhome')] : []), button('MONTH', o.month, 'yrback')),
    said,
    h('div.yrgrid', { role: 'list', 'aria-label': `${y}, month by month` }, ...minis),
    h('small.note.yrhint', { dataset: { case: 'keep' } }, 'A dot marks a day with something on. Tap a month to open it.'),
  ];
}
