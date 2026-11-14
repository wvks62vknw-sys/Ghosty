/**
 * WORKSPACE DEADLINES ON THE AGENDA AND IN THE BRIEF (editors.c4): the due dates in his Workspace databases, read where his day is read: the
 * Agenda's TO-DO section lists them (read-only, a tap opens the row's page) and the Brief's YOUR DAY says them in one line. A database with a
 * date named like a deadline ("Due", "Deadline", "By", "End") counts only that one; otherwise every date of a row counts, as the workspace's
 * own "what is due this week" does. A row that is done (its Done ticked, its Status Done) is left out. Late ones come first. Pure:
 * apps/edge/test/workspace.test.mjs.
 */
import { addDays, dateWords, isDone } from './db';
import { live, rowsOf, titleOf, type Workspace } from './model';

export interface Deadline {
  /** The row's page id (a tap opens it). */
  id: string;
  title: string;
  /** "Tasks · My project": the database, and the page it sits in. */
  where: string;
  date: string;
  late: boolean;
}
const DUEISH = /\b(?:due|deadline|by|end|ends|finish|until)\b/i;
const iso = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** The deadlines from `back` days ago to `ahead` days on (today counted), late first then by date; one line a row (its earliest). */
export function deadlines(ws: Workspace, today: string, ahead = 14, back = 30): Deadline[] {
  const from = addDays(today, -back);
  const to = addDays(today, ahead - 1);
  const out: Deadline[] = [];
  for (const d of live(ws).filter((p) => p.db)) {
    const dates = d.db!.props.filter((p) => p.kind === 'date');
    const dueish = dates.filter((p) => DUEISH.test(p.name));
    const use = dueish.length ? dueish : dates;
    if (!use.length) continue;
    const parent = d.parent ? ws.pages[d.parent] : undefined;
    for (const r of rowsOf(ws, d.id)) {
      if (isDone(ws, d.id, r)) continue;
      const ds = use.map((p) => r.vals?.[p.id]).filter(iso).filter((v) => v >= from && v <= to).sort();
      if (!ds.length) continue;
      out.push({ id: r.id, title: titleOf(r), where: parent && !parent.deleted ? `${titleOf(d)} · ${titleOf(parent)}` : titleOf(d), date: ds[0]!, late: ds[0]! < today });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

/** "today", "tomorrow", "Fri 20 Nov", "late, since Mon 9 Nov". */
export function whenWords(date: string, today: string): string {
  if (date === today) return 'today';
  if (date === addDays(today, 1)) return 'tomorrow';
  return date < today ? `late, since ${dateWords(date)}` : dateWords(date);
}

/** The Brief's one line ('' with nothing due this week or late): "Book the tiler is due today in your workspace, and 2 more this week". */
export function deadlineLine(list: Deadline[], today: string): string {
  const week = addDays(today, 6);
  const now = list.filter((d) => d.date <= week);
  if (!now.length) return '';
  const late = now.filter((d) => d.late).length;
  const first = now[0]!;
  const rest = now.length - 1;
  const lead = first.late ? `${first.title} is late in your workspace (due ${dateWords(first.date)})` : `${first.title} is due ${whenWords(first.date, today)} in your workspace`;
  const more = rest ? `, and ${rest} more this week${late > 1 ? ` (${late} late in all)` : ''}` : '';
  return `${lead}${more}`;
}
