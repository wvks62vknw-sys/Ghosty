/**
 * THE WORKSPACE'S FIVE TEMPLATES (NEW PAGE): PROJECT (a TASKS board, NOTES, a DECISIONS table and DEADLINES as a calendar, over the one
 * database), MEETING NOTES, A READING LIST, A TRIP and WEEKLY PLAN. Each is a seeded tree of real pages and blocks, in his own voice, every
 * word his to change. Pure.
 */
import { addDays, addRow, newDatabase, isoOf } from './db';
import { newPage, patchPage, wblock, type Page, type PVal, type Workspace } from './model';

export interface TemplateInfo {
  id: string;
  name: string;
  line: string;
  icon: string;
}
export const TEMPLATES: TemplateInfo[] = [
  { id: 'project', name: 'PROJECT', icon: 'project', line: 'Tasks on a board, notes, decisions and deadlines on a calendar, all over one list' },
  { id: 'meeting', name: 'MEETING NOTES', icon: 'meeting', line: 'Who was there, what was said, what was decided, what happens next' },
  { id: 'reading', name: 'A READING LIST', icon: 'book', line: 'Books and articles as a table, a board and a shelf' },
  { id: 'trip', name: 'A TRIP', icon: 'trip', line: 'Where and when, getting there, where I stay, things to do, packing' },
  { id: 'week', name: 'WEEKLY PLAN', icon: 'week', line: 'A line for each day, with to-dos I can tick' },
];

const table = (rows: string[][]) => wblock('table', '', { head: true, rows: rows.map((r) => r.map((c) => (c ? [{ text: c }] : []))) });
const todo = (t: string) => wblock('todo', t);

/** A template made as pages under `parent`; the root page is returned. `now`: the day the dates are counted from. */
export function fromTemplate(ws: Workspace, id: string, parent: string | null = null, now = new Date()): { ws: Workspace; root: Page } {
  const today = isoOf(now);
  const T = TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0]!;
  if (T.id === 'project') {
    let out = ws;
    const root = newPage(out, { title: 'My project', parent, icon: 'project', from: 'the project template' });
    out = root.ws;
    // the one database every part of the project is a view of
    const db = newDatabase(out, {
      title: 'Tasks', parent: root.page.id, icon: 'board', from: 'the project template',
      props: [
        { name: 'Status', kind: 'select', options: ['To do', 'Doing', 'Done'] },
        { name: 'Start', kind: 'date' },
        { name: 'Due', kind: 'date' },
        { name: 'Cost', kind: 'number' },
        { name: 'Done', kind: 'check' },
      ],
      views: ['board', 'table', 'calendar', 'timeline', 'gallery'],
    });
    out = db.ws;
    const d = db.page.db!;
    const status = d.props[0]!.id;
    const start = d.props[1]!.id;
    const due = d.props[2]!.id;
    const cost = d.props[3]!.id;
    const rows: [string, string, number, number, number][] = [
      ['Decide what finished looks like', 'To do', 0, 3, 0],
      ['Gather what I already have', 'To do', 1, 7, 0],
      ['Book the first step', 'To do', 3, 10, 0],
    ];
    for (const [title, st, a, b, c] of rows) {
      const r = addRow(out, db.page.id, title, { [status]: st, [start]: addDays(today, a), [due]: addDays(today, b), ...(c ? { [cost]: c } : {}) } as Record<string, PVal>);
      out = r.ws;
    }
    const boardId = d.views.find((v) => v.kind === 'board')!.id;
    const calId = d.views.find((v) => v.kind === 'calendar')!.id;
    const blocks = [
      wblock('h2', 'Tasks'),
      wblock('view', '', { db: db.page.id, view: boardId }),
      wblock('h2', 'Notes'),
      wblock('p', 'What I know so far, what I am unsure of, and what I need to ask someone.'),
      wblock('h2', 'Decisions'),
      table([['Decision', 'Why', 'When'], ['', '', ''], ['', '', '']]),
      wblock('h2', 'Deadlines'),
      wblock('view', '', { db: db.page.id, view: calId }),
    ];
    out = patchPage(out, root.page.id, (p) => ({ ...p, blocks }));
    return { ws: out, root: out.pages[root.page.id]! };
  }
  if (T.id === 'meeting') {
    const r = newPage(ws, {
      title: 'Meeting notes', parent, icon: 'meeting', from: 'the meeting template',
      blocks: [
        wblock('p', `Date: ${today}`),
        wblock('h2', 'Who was there'), wblock('p', ''),
        wblock('h2', 'What we said'), wblock('ul', ''),
        wblock('h2', 'What we decided'), wblock('ul', ''),
        wblock('h2', 'What happens next'), todo(''),
      ],
    });
    return { ws: r.ws, root: r.page };
  }
  if (T.id === 'reading') {
    const o = newDatabase(ws, {
      title: 'Reading list', parent, icon: 'book', from: 'the reading list template',
      props: [
        { name: 'Author', kind: 'text' },
        { name: 'Status', kind: 'select', options: ['To read', 'Reading', 'Read'] },
        { name: 'Finished', kind: 'date' },
        { name: 'Rating', kind: 'number' },
      ],
      views: ['table', 'board', 'gallery'],
    });
    let out = o.ws;
    const d = o.page.db!;
    for (const [title, st] of [['The book I keep meaning to start', 'To read'], ['The article a friend sent', 'To read'], ['What I am reading now', 'Reading']] as const) out = addRow(out, o.page.id, title, { [d.props[1]!.id]: st }).ws;
    return { ws: out, root: out.pages[o.page.id]! };
  }
  if (T.id === 'trip') {
    const r = newPage(ws, {
      title: 'My trip', parent, icon: 'trip', from: 'the trip template',
      blocks: [
        wblock('h2', 'Where and when'), wblock('p', ''),
        wblock('h2', 'Getting there'), wblock('p', ''),
        wblock('h2', 'Where I am staying'), wblock('p', ''),
        wblock('h2', 'Things I want to do'), todo(''),
        wblock('h2', 'What it costs'), table([['What', 'How much'], ['', ''], ['', '']]),
        wblock('h2', 'Packing'), todo('Passport and tickets'), todo('Charger'),
      ],
    });
    return { ws: r.ws, root: r.page };
  }
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const r = newPage(ws, { title: 'This week', parent, icon: 'week', from: 'the weekly plan template', blocks: days.flatMap((d) => [wblock('h2', d), todo('')]) });
  return { ws: r.ws, root: r.page };
}
