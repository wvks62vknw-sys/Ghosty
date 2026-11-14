/**
 * TO-DO (the planlane pass): his to-do list inside the agenda, kept on this phone. Type it, give it a day and a repeat if it has
 * them, star the ones that matter, tick it off (a repeating one comes back on its next day); tap its words to change them or its
 * day. Late ones come first, then the starred ones; the done ones go to the bottom with CLEAR DONE. ALL · TODAY · UPCOMING · STARRED
 * narrow the list. Every removal has UNDO. The words and the order are in todowords.ts (pure, the spec reads them); the chat works
 * the same list through the functions below (turn.ts).
 *
 * ONELIST (plan.u1): this is a COPY of the one list, which the brain keeps (the work pack's to-do: WORK's screen, the Brief and
 * the chat's "add to my to-do: …" read and change the same one). Every change here shows at once, goes in an outbox kept on this
 * phone, and is sent to the brain by id in order (now, or when the signal is back); then the brain's list replaces this copy. The
 * first time, the list this phone kept on its own joins the brain's once (no duplicates, nothing lost), said in one line.
 */
import { clear, h } from '../../core/dom';
import { brain } from '../../api/brain';
import { button, panel, toast, undo } from '../../ui/components';
import { pushState } from '../../assistant/push';
import { londonNow, quickParse } from './quickadd';
import { listRow, skeleton, stateCard } from '../../ui/appkit';
import {
  dayOf, dueWords, EVERY, everyWords, inView, nextDue, sortTodos, TODO_ALL_DONE, TODO_EMPTY, TODO_NEED_TEXT, todoLine, todoWaitWords, daysTo, VIEW_EMPTY, VIEWS,
  ringDayOf, RING_OFF, whenWords, prioOf, PRIOS, tagWords, upcoming, upDayWords, upEventWhen, quietWords, UP_EMPTY, UP_LOADING, UP_NOCOPY, UP_OFFLINE,
  stepsWords, STEPS_EMPTY, projectsOf, projectSub, bySection, PROJECT_DONE,
  type UpEvent, type Step,
  type Every, type Todo, type TodoView,
} from './todowords';

const KEY = 'ghosty.agenda.todo';
const VIEW_KEY = 'ghosty.agenda.todoview';
/** Said on the window whenever the list changes. */
export const TODO_CHANGED = 'ghosty:todo';
export function loadTodos(): Todo[] {
  try {
    const l = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Todo[];
    return Array.isArray(l) ? l.filter((t) => t && typeof t.id === 'string' && typeof t.text === 'string') : [];
  } catch {
    return [];
  }
}
export function saveTodos(l: Todo[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(l.slice(0, 300)));
    // the list on the agenda, Home's Today card and the Brief read it: they repaint on this
    dispatchEvent(new Event(TODO_CHANGED));
    return true;
  } catch {
    toast('This phone would not keep the list (its storage is full or blocked)', 'warn');
    return false;
  }
}
const newId = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ---------------------------------------------------------------- ONELIST: the copy, the outbox, the one list in the brain
const OUTBOX = 'ghosty.agenda.todo.outbox';
/** set once the list this phone kept on its own has joined the brain's */
const JOINED = 'ghosty.agenda.todo.one';
type TodoOp = { op: 'add'; item: Todo } | { op: 'tick' | 'untick'; id: string; nextId?: string } | { op: 'remove'; id: string } | { op: 'edit'; id: string; text?: string; due?: string; high?: boolean; every?: string; time?: string; p?: number; project?: string; section?: string; tags?: string[]; notes?: string; steps?: Step[] } | { op: 'clear_done' } | { op: 'merge'; items: Todo[] };
const readJson = <T,>(k: string, d: T): T => {
  try {
    return (JSON.parse(localStorage.getItem(k) ?? 'null') as T) ?? d;
  } catch {
    return d;
  }
};
const writeKey = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* kept on the next change */
  }
};
const outbox = (): TodoOp[] => {
  const l = readJson<TodoOp[]>(OUTBOX, []);
  return Array.isArray(l) ? l : [];
};
/** How many changes made here are still to reach the brain (the panel says so). */
export const todoUnsent = (): number => outbox().length;
function queue(op: TodoOp): void {
  writeKey(OUTBOX, JSON.stringify([...outbox(), op].slice(-200)));
  void syncTodos(true);
}
/** The brain's to-do (its own shape: high is the star) as this phone's. */
type BrainTodo = { id: string; text: string; due?: string; high?: boolean; done?: boolean; at: number; every?: Every; doneAt?: number; nextId?: string; time?: string; p?: number; project?: string; section?: string; tags?: string[]; notes?: string; steps?: Step[] };
const fromBrain = (t: BrainTodo): Todo => ({
  id: t.id, text: t.text, due: t.due ?? '', done: !!t.done, at: t.at,
  ...(t.doneAt ? { doneAt: t.doneAt } : {}), ...(t.nextId ? { nextId: t.nextId } : {}), ...(t.high ? { star: true } : {}), ...(t.every ? { every: t.every } : {}),
  ...(typeof t.time === 'string' && /^\d\d:\d\d$/.test(t.time) ? { time: t.time } : {}),
  ...(!t.high && (t.p === 2 || t.p === 3) ? { p: t.p } : {}), ...(typeof t.project === 'string' && t.project ? { project: t.project, ...(typeof t.section === 'string' && t.section ? { section: t.section } : {}) } : {}),
  ...(Array.isArray(t.tags) && t.tags.length ? { tags: t.tags.filter((x) => typeof x === 'string') } : {}),
  ...(typeof t.notes === 'string' && t.notes ? { notes: t.notes } : {}),
  ...(Array.isArray(t.steps) && t.steps.length ? { steps: t.steps.filter((s) => s && typeof s.id === 'string' && typeof s.text === 'string').map((s) => ({ id: s.id, text: s.text, ...(s.done ? { done: true } : {}) })) } : {}),
});
/** The brain's list (from any screen that read it: WORK's too) becomes this phone's copy, unless changes made here are still to go
 * (then they are sent first, and the list read again). */
export function adoptTodos(list: unknown): void {
  if (!Array.isArray(list)) return;
  if (outbox().length || !readJson<boolean>(JOINED, false)) return void syncTodos(true);
  const mine = (list as BrainTodo[]).filter((t) => t && typeof t.id === 'string' && typeof t.text === 'string').map(fromBrain);
  const now = loadTodos();
  const same = (a: Todo[]) => JSON.stringify([...a].sort((x, y) => (x.id < y.id ? -1 : 1)));
  if (same(mine) !== same(now)) saveTodos(mine);
}
let syncing: Promise<boolean> | null = null;
let again = false;
let lastSync = 0;
let trouble = false;
/** Said on the window when a send to the brain has ended (the panel says what is still waiting). */
export const TODO_SYNCED = 'ghosty:todosync';
/** Changes made here that have not reached the one list yet, because there is no signal or the brain did not answer. */
export const todoWaiting = (): number => (trouble || (typeof navigator !== 'undefined' && navigator.onLine === false) ? outbox().length : 0);
/** Send what changed here, then read the one list back. True when the copy now matches the brain; false with no signal or no
 * answer (the copy and the outbox wait, and go on the next change, the next open, or when the signal is back). */
export function syncTodos(force = false): Promise<boolean> {
  if (syncing) {
    again ||= force;
    return syncing;
  }
  if (!force && Date.now() - lastSync < 20_000) return Promise.resolve(true);
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    dispatchEvent(new Event(TODO_SYNCED));
    return Promise.resolve(false);
  }
  syncing = (async () => {
    if (!readJson<boolean>(JOINED, false)) {
      const mine = loadTodos();
      if (mine.length) {
        const r = await brain.packDo('work', 'todo', { op: 'merge', items: mine });
        const n = Number((r.data as { added?: number } | undefined)?.added ?? 0);
        toast(n ? `One to-do list now: ${n} from this phone joined the one WORK and the chat use.` : 'One to-do list now: WORK and the chat already had everything on this phone.', 'ok');
      }
      writeKey(JOINED, 'true');
    }
    let list: unknown = null;
    for (let round = 0; round < 3; round++) {
      for (let op = outbox()[0]; op; op = outbox()[0]) {
        await brain.packDo('work', 'todo', op as unknown as Record<string, unknown>);
        // (sent: off the outbox; a change made meanwhile stays behind it)
        const left = outbox();
        writeKey(OUTBOX, left.length > 1 ? JSON.stringify(left.slice(1)) : null);
      }
      const r = await brain.packDo('work', 'todo', { op: 'list' });
      list = (r.data as { list?: unknown } | undefined)?.list;
      if (!outbox().length) break;
    }
    lastSync = Date.now();
    trouble = false;
    adoptTodos(list);
    return true;
  })()
    .catch(() => {
      trouble = true;
      return false;
    })
    .finally(() => {
      syncing = null;
      dispatchEvent(new Event(TODO_SYNCED));
      if (again) {
        again = false;
        void syncTodos(true);
      }
    });
  return syncing;
}
if (typeof addEventListener === 'function') {
  addEventListener('online', () => void syncTodos(true));
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void syncTodos());
}

/** Add a to-do (the box, or the chat): the one added, or null when this phone would not keep it. [planlane4:tasks] `time` ("15:00")
 * makes it ring at that time on its day (one with a time and no day rings today while the time is ahead, else tomorrow). */
export function addTodo(text: string, due = '', every?: Every, star?: boolean, time = '', more: Pick<Todo, 'p' | 'project' | 'section' | 'tags'> = {}): Todo | null {
  // (a repeating one with no day starts today: "water the plants every day" is due today)
  const day = due || (time ? ringDayOf(time, Date.now()) : every ? dayOf(Date.now()) : '');
  const t: Todo = {
    id: newId(), text: text.trim().slice(0, 200), due: day, done: false, at: Date.now(), ...(every ? { every } : {}), ...(star ? { star: true } : {}), ...(time ? { time } : {}),
    ...(!star && more.p ? { p: more.p } : {}), ...(more.project ? { project: more.project, ...(more.section ? { section: more.section } : {}) } : {}), ...(more.tags?.length ? { tags: more.tags } : {}),
  };
  const l = loadTodos();
  l.push(t);
  if (!saveTodos(l)) return null;
  queue({ op: 'add', item: t });
  return t;
}
/** Tick one off (or back on). A repeating one ticked off makes its next one, due on its next day: that one is returned. Ticked back
 * on, the next one it made goes again (while it is still open and unchanged), so a mis-tap never leaves two. Null when it was not
 * there or this phone would not keep the change. */
export function tickTodo(id: string): { done: boolean; next: Todo | null } | null {
  let l = loadTodos();
  const x = l.find((y) => y.id === id);
  if (!x) return null;
  x.done = !x.done;
  x.doneAt = x.done ? Date.now() : undefined;
  let next: Todo | null = null;
  if (x.done && x.every) {
    next = { id: newId(), text: x.text, due: nextDue(x.due, x.every, Date.now()), done: false, at: Date.now(), every: x.every, ...(x.star ? { star: true } : {}), ...(x.time ? { time: x.time } : {}),
      ...(x.p ? { p: x.p } : {}), ...(x.project ? { project: x.project } : {}), ...(x.section ? { section: x.section } : {}), ...(x.tags?.length ? { tags: [...x.tags] } : {}),
      ...(x.notes ? { notes: x.notes } : {}), ...(x.steps?.length ? { steps: x.steps.map((s) => ({ id: newId(), text: s.text })) } : {}) };
    l.push(next);
    x.nextId = next.id;
  } else if (!x.done && x.nextId) {
    const n = l.find((y) => y.id === x.nextId);
    if (n && !n.done && n.text === x.text && n.every === x.every) l = l.filter((y) => y !== n);
    delete x.nextId;
  }
  if (!saveTodos(l)) return null;
  // (the next one keeps the same id in the brain, so a tick made with no signal and then one on the next one both land)
  queue(x.done ? { op: 'tick', id, ...(next ? { nextId: next.id } : {}) } : { op: 'untick', id });
  return { done: x.done, next };
}
/** Take one off the list, with UNDO (it goes back where it was). False when it was not there. */
export function removeTodo(id: string): boolean {
  const l = loadTodos();
  const at = l.findIndex((y) => y.id === id);
  if (at < 0) return false;
  const [t] = l.splice(at, 1);
  if (!saveTodos(l)) return false;
  queue({ op: 'remove', id });
  undo(`Removed: ${t!.text}`, () => {
    const now = loadTodos();
    if (now.some((y) => y.id === t!.id)) return;
    now.splice(Math.min(at, now.length), 0, t!);
    if (saveTodos(now)) queue({ op: 'add', item: t! });
  });
  return true;
}
/** Clear the done ones, with UNDO (it puts back only the cleared ones: anything added or ticked since stays): how many went, or -1
 * when this phone would not keep the change. */
export function clearDone(): number {
  const gone = loadTodos().filter((t) => t.done);
  const n = gone.length;
  if (!n) return 0;
  if (!saveTodos(loadTodos().filter((t) => !t.done))) return -1;
  queue({ op: 'clear_done' });
  undo(`Cleared ${n} done`, () => {
    const now = loadTodos();
    const have = new Set(now.map((t) => t.id));
    const back = gone.filter((t) => !have.has(t.id));
    if (saveTodos([...now, ...back])) queue({ op: 'merge', items: back });
  });
  return n;
}
/** Change a to-do's words, day, repeat, star, the time it rings ('' takes the ring off), [planlane4:tasks] its priority (`prio`, 1 to
 * 4: 1 is the star), project or tags. */
export function editTodo(id: string, patch: Partial<Pick<Todo, 'text' | 'due' | 'every' | 'star' | 'time' | 'project' | 'section' | 'tags' | 'notes' | 'steps'>> & { prio?: number }): boolean {
  const l = loadTodos();
  const x = l.find((y) => y.id === id);
  if (!x) return false;
  const { prio, ...rest } = patch;
  Object.assign(x, rest);
  if (prio !== undefined) {
    x.star = prio === 1;
    if (prio === 2 || prio === 3) x.p = prio;
    else delete x.p;
  }
  if (x.star) delete x.p;
  if (!x.every) delete x.every;
  if (!x.star) delete x.star;
  if (!x.time) delete x.time;
  if (!x.project) delete x.project;
  if (!x.section || !x.project) delete x.section;
  if (!x.tags?.length) delete x.tags;
  if (!x.notes) delete x.notes;
  if (!x.steps?.length) delete x.steps;
  // (a time with no day rings today while it is ahead, else tomorrow: the brain rings only a to-do with both)
  if (x.time && !x.due) x.due = ringDayOf(x.time, Date.now());
  if (!saveTodos(l)) return false;
  queue({
    op: 'edit', id,
    ...('text' in patch ? { text: x.text } : {}), ...('due' in patch || ('time' in patch && x.time) ? { due: x.due } : {}),
    ...('every' in patch ? { every: x.every ?? '' } : {}), ...('star' in patch ? { high: !!x.star } : {}),
    ...('time' in patch ? { time: x.time ?? '' } : {}),
    ...(prio !== undefined ? { p: prioOf(x), high: !!x.star } : {}),
    ...('project' in patch ? { project: x.project ?? '' } : {}), ...('section' in patch || 'project' in patch ? { section: x.section ?? '' } : {}), ...('tags' in patch ? { tags: x.tags ?? [] } : {}),
    ...('notes' in patch ? { notes: x.notes ?? '' } : {}), ...('steps' in patch ? { steps: x.steps ?? [] } : {}),
  });
  return true;
}

const everySelect = (v: Every | '' = '') => {
  const s = h('select', { 'aria-label': 'Repeats' }, ...EVERY.map(([k, t]) => h('option', { value: k }, t)));
  s.value = v;
  return s;
};
const loadView = (): TodoView => {
  try {
    const v = localStorage.getItem(VIEW_KEY) as TodoView | null;
    return v && VIEWS.some(([k]) => k === v) ? v : 'all';
  } catch {
    return 'all';
  }
};

/** [planlane4:tasks] What UPCOMING reads from the agenda: its events for the next weeks, whether they have been read yet, and whether
 * they are the phone's copy (the brain out of reach) or nothing at all. */
export type UpAgenda = () => { events: UpEvent[]; loaded: boolean; offline: boolean; hasCopy: boolean };

export function todoPanel(onChange: () => void, agenda?: UpAgenda, openEvent?: (id: string) => void): { el: HTMLElement; paint(): void; list(): Todo[]; agendaRead(): void } {
  const p = panel('TO-DO', { cls: 'scroll.todo' });
  // [planlane4:tasks] QUICK ADD: the field reads the line as he would say it (quickadd.ts), and shows what it understood as chips
  const text = h('input', { placeholder: 'Add a to-do (e.g. Call Sam at 3pm)', 'aria-label': 'To-do', maxlength: '200', autocomplete: 'off' });
  const due = h('input', { type: 'date', 'aria-label': 'Due day (optional)' });
  const rep = everySelect();
  let view: TodoView = loadView();
  /** the to-do whose words are open to change (one at a time), and what he has typed there so far (kept across repaints) */
  let editing = '';
  let draft: { id: string; text: string; due: string; every: string; time: string; prio: string; project: string; section: string; tags: string; notes: string } | null = null;
  /** [planlane4:tasks] PROJECTS: the project or tag whose page is open ('' for the list of them) */
  let proj: { kind: 'project' | 'tag'; name: string } | null = null;
  /** [planlane4:tasks] what he is typing as the next step, and whether the step box (not the words) has the focus after a repaint */
  let stepDraft = '';
  let stepFocus = false;
  /** the chips he tapped away (their words stay words) */
  let dropped = new Set<string>();
  const chips = h('div.tqchips', { role: 'group', 'aria-label': 'What I understood (tap one to keep it as words)', hidden: true, dataset: { case: 'keep' } });
  const read = () => {
    const ln = londonNow();
    return quickParse(text.value, ln.day, ln.hm, dropped);
  };
  const paintChips = () => {
    const q = read();
    clear(chips);
    chips.hidden = !q.bits.length;
    for (const b of q.bits) {
      const c = button('', () => {
        dropped = new Set([...dropped, b.key]);
        paintChips();
        text.focus();
      }, `tqchip tq-${b.kind}`);
      c.append(h('span', b.label), h('i', { 'aria-hidden': 'true' }, '✕'));
      c.setAttribute('aria-label', `Keep ${b.label} as words`);
      chips.append(c);
    }
  };
  text.addEventListener('input', paintChips);
  const add = () => {
    // [planlane4:tasks] the line read: its words, day, time, repeat, priority, project and tags (the day and repeat keys win when set)
    const q = read();
    const v = q.text.trim();
    /* state: agenda.quickadd error */
    if (!v) return toast(TODO_NEED_TEXT, 'warn');
    addTodo(v, due.value || q.due, ((rep.value || q.every) || undefined) as Every | undefined, q.p === 1 || undefined, q.time, {
      ...(q.p === 2 || q.p === 3 ? { p: q.p } : {}), ...(q.project ? { project: q.project, ...(q.section ? { section: q.section } : {}) } : {}), ...(q.tags.length ? { tags: q.tags } : {}),
    });
    text.value = '';
    dropped = new Set();
    paintChips();
    due.value = '';
    rep.value = '';
    // a new one shows whatever the view: back to All when the view would hide it
    if (view !== 'all') setView('all');
  };
  text.addEventListener('keydown', (e) => e.key === 'Enter' && add());
  p.el.insertBefore(h('div.keyrow.wrapit.addev.todoadd', text, due, rep, button('ADD', add)), p.body);
  p.el.insertBefore(chips, p.body);
  const line = h('p.todoline', { 'aria-live': 'polite', dataset: { case: 'keep' } });
  p.el.insertBefore(line, p.body);
  // ONELIST: changes made with no signal are kept here and said; they go to the one list when the signal is back
  const waiting = h('p.todowait', { 'aria-live': 'polite', dataset: { case: 'keep', state: 'offline' }, hidden: true });
  p.el.insertBefore(waiting, p.body);
  const paintWaiting = () => {
    const n = todoWaiting();
    waiting.hidden = !n;
    /* state: agenda.todo offline */
    waiting.textContent = n ? todoWaitWords(n, typeof navigator !== 'undefined' && navigator.onLine === false) : '';
  };
  for (const ev of [TODO_SYNCED, 'online', 'offline']) addEventListener(ev, paintWaiting);
  const views = h('div.keyrow.wrapit.todoviews', { role: 'group', 'aria-label': 'Show' });
  p.el.insertBefore(views, p.body);
  const setView = (v: TodoView) => {
    view = v;
    proj = null;
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* the view is a convenience: it is simply not remembered */
    }
    paint();
  };

  const editor = (t: Todo) => {
    const d = draft?.id === t.id ? draft : null;
    const tx = h('input', { value: d ? d.text : t.text, 'aria-label': 'Change the words', maxlength: '200' });
    const dd = h('input', { type: 'date', value: d ? d.due : t.due, 'aria-label': 'Change the day' });
    // [planlane4:tasks] the time it rings on its day (cleared: no ring)
    const tm = h('input', { type: 'time', value: d ? d.time : t.time ?? '', 'aria-label': 'Change the time it rings' });
    const rp = everySelect((d ? d.every : t.every ?? '') as Every | '');
    // [planlane4:tasks] its priority, project and tags
    const pr = h('select', { 'aria-label': 'Priority' }, ...PRIOS.map(([k, w]) => h('option', { value: String(k) }, w)));
    pr.value = d ? d.prio : String(prioOf(t));
    const pj = h('input', { value: d ? d.project : t.project ?? '', 'aria-label': 'Project', placeholder: 'Project (e.g. Home)', maxlength: '40' });
    const se = h('input', { value: d ? d.section : t.section ?? '', 'aria-label': 'Section', placeholder: 'Section (e.g. Kitchen)', maxlength: '40' });
    const tg = h('input', { value: d ? d.tags : (t.tags ?? []).join(' '), 'aria-label': 'Tags', placeholder: 'Tags (e.g. phone)', maxlength: '120' });
    // [planlane4:tasks] its notes (kept with SAVE) and its checklist (each step's change kept at once, with UNDO)
    const nt = h('textarea', { 'aria-label': 'Notes', placeholder: 'Notes', rows: '3', maxlength: '2000' });
    nt.value = d ? d.notes : t.notes ?? '';
    const keep = () => void (draft = { id: t.id, text: tx.value, due: dd.value, every: rp.value, time: tm.value, prio: pr.value, project: pj.value, section: se.value, tags: tg.value, notes: nt.value });
    for (const x of [tx, dd, tm, rp, pr, pj, se, tg, nt]) x.addEventListener('input', keep);
    const steps = t.steps ?? [];
    const setSteps = (next: Step[], said: string) => {
      const was = steps.map((s) => ({ ...s }));
      keep();
      if (!editTodo(t.id, { steps: next })) return;
      undo(said, () => void editTodo(t.id, { steps: was }));
    };
    const stepIn = h('input', { 'aria-label': 'Add a step', placeholder: 'Add a step', maxlength: '200', value: stepDraft });
    stepIn.addEventListener('input', () => void (stepDraft = stepIn.value));
    const addStep = () => {
      const v = stepIn.value.replace(/\s+/g, ' ').trim().slice(0, 200);
      if (!v) return toast('Type the step first', 'warn');
      if (steps.length >= 50) return toast('Fifty steps is the most one to-do keeps', 'warn');
      stepDraft = '';
      stepFocus = true;
      setSteps([...steps, { id: newId(), text: v }], `Step added: ${v}`);
    };
    stepIn.addEventListener('keydown', (e) => e.key === 'Enter' && addStep());
    const stepRow = (s: Step) => {
      const tk = button(s.done ? '✓' : '', () => setSteps(steps.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)), s.done ? `Step not done: ${s.text}` : `Step done: ${s.text}`), `todotick tdsteptick${s.done ? ' on' : ''}`);
      tk.setAttribute('role', 'checkbox');
      tk.setAttribute('aria-checked', String(!!s.done));
      tk.setAttribute('aria-label', s.done ? `Not done: ${s.text}` : `Done: ${s.text}`);
      const rm = button('✕', () => setSteps(steps.filter((x) => x.id !== s.id), `Step removed: ${s.text}`), 'todox');
      rm.setAttribute('aria-label', `Remove the step ${s.text}`);
      return h(`div.tdstep${s.done ? '.done' : ''}` as 'div', { role: 'listitem', dataset: { id: s.id } }, tk, h('span.tdsteptx', s.text), rm);
    };
    const checklist = h('div.tdsteps', { dataset: { case: 'keep' } },
      h('b.tdstepshead', { role: 'heading', 'aria-level': '4' }, steps.length ? `Checklist · ${stepsWords(t)} done` : 'Checklist'),
      /* state: agenda.taskdetail empty */
      steps.length ? h('div.tdsteplist', { role: 'list', 'aria-label': 'Checklist' }, ...steps.map(stepRow)) : h('div.tdstepnone', { dataset: { state: 'empty' } }, stateCard('empty', STEPS_EMPTY)),
      h('div.keyrow.wrapit.addev.tdstepadd', stepIn, button('ADD STEP', addStep)));
    pr.addEventListener('change', keep);
    rp.addEventListener('change', keep);
    const save = () => {
      const v = tx.value.trim();
      if (!v) return toast(TODO_NEED_TEXT, 'warn');
      editing = '';
      draft = null;
      const was = { text: t.text, due: t.due, every: t.every, prio: prioOf(t), time: t.time ?? '', project: t.project ?? '', section: t.section ?? '', tags: t.tags ?? [], notes: t.notes ?? '' };
      const tags = [...new Set(tg.value.split(/[\s,]+/).map((x) => x.replace(/^@+/, '').toLowerCase().slice(0, 30)).filter(Boolean))].slice(0, 8);
      if (!editTodo(t.id, { text: v, due: dd.value || '', every: (rp.value || undefined) as Every | undefined, time: tm.value || '', prio: Number(pr.value) || 4, project: pj.value.replace(/^#+/, '').trim().slice(0, 40), section: se.value.trim().slice(0, 40), tags, notes: nt.value.trim().slice(0, 2000) })) return paint();
      undo(`Changed: ${v}`, () => void editTodo(t.id, was));
    };
    tx.addEventListener('keydown', (e) => e.key === 'Enter' && save());
    const focusStep = stepFocus;
    stepFocus = false;
    queueMicrotask(() => (focusStep ? stepIn : tx).focus());
    return h('div.todoedit', { dataset: { case: 'keep' } },
      h('div.keyrow.wrapit.addev', tx, dd, tm, rp, pr, pj, se, tg),
      h('div.tdnotes', nt),
      checklist,
      h('div.keyrow.wrapit', button('SAVE', save, 'on'), button('CANCEL', () => {
        editing = '';
        draft = null;
        paint();
      }), h('span.sp'), button('REMOVE', () => {
        editing = '';
        removeTodo(t.id);
      }, 'bad')));
  };

  const item = (t: Todo) => {
    const now = Date.now();
    const late = !t.done && !!t.due && daysTo(t.due, now) < 0;
    const tick = button(t.done ? '✓' : '', () => {
      const r = tickTodo(t.id);
      if (r?.next) toast(`Next one: ${dueWords(r.next.due, Date.now()).replace(/^Due /, '')}`, 'ok');
    }, `todotick${t.done ? ' on' : ''}`);
    tick.setAttribute('role', 'checkbox');
    tick.setAttribute('aria-checked', String(t.done));
    tick.setAttribute('aria-label', t.done ? `Not done: ${t.text}` : `Done: ${t.text}`);
    // [planlane4:tasks] the flag: its priority in a colour of the look (P1 the star, P2, P3; an open flag for none); a tap sets P1 or
    // takes it off, and P2 and P3 are set in its change box or typed as it is added
    const pv = prioOf(t);
    const star = button(pv < 4 ? '⚑' : '⚐', () => void editTodo(t.id, { prio: pv === 1 ? 4 : 1 }), `todostar tdp${pv}${t.star ? ' on' : ''}`);
    star.setAttribute('aria-pressed', String(!!t.star));
    star.setAttribute('aria-label', pv === 1 ? `Take priority 1 off ${t.text}` : `Make ${t.text} priority 1${pv < 4 ? ` (now priority ${pv})` : ''}`);
    const del = button('✕', () => void removeTodo(t.id), 'todox');
    del.setAttribute('aria-label', `Remove ${t.text}`);
    // ([planlane4:tasks] its steps done of all, "2/5", and its project and tags)
    const words = [t.done ? 'Done' : whenWords(t, now), t.every ? `repeats ${everyWords(t.every)}` : '', stepsWords(t), tagWords(t)].filter(Boolean).join(' · ');
    // tap the words to change them (and the day, and the repeat)
    const tx = h('button.todotx', { type: 'button', 'aria-label': `Change ${t.text}`, 'aria-expanded': String(editing === t.id) }, h('b', t.text), words ? h('small', words) : null);
    tx.addEventListener('click', () => {
      stepDraft = '';
      editing = editing === t.id ? '' : t.id;
      draft = null;
      paint();
    });
    return h(`div.todoit${t.done ? '.done' : ''}${late ? '.late' : ''}${t.star ? '.starred' : ''}` as 'div', { role: 'listitem', dataset: { case: 'keep', id: t.id } },
      h('div.todorow', tick, tx, star, del),
      editing === t.id ? editor(t) : null);
  };
  const paint = () => {
    const now = Date.now();
    const all = sortTodos(loadTodos(), now);
    clear(p.body);
    const open = all.filter((t) => !t.done).length;
    p.setStatus(all.length ? `${open}` : '', open ? 'ok' : 'mid');
    line.textContent = todoLine(all, now);
    clear(views);
    views.hidden = !all.length;
    for (const [v, label] of VIEWS) {
      const n = all.filter((t) => !t.done && inView(t, v, now)).length;
      const b = button(v === 'all' || v === 'projects' || !n ? label : `${label} ${n}`, () => setView(v), `todoview${v === view ? ' on' : ''}`);
      b.setAttribute('aria-pressed', String(v === view));
      views.append(b);
    }
    /* state: agenda.todo empty */
    if (!all.length) return void p.body.append(h('div.empty', { dataset: { case: 'keep', state: 'empty' } }, h('b', TODO_EMPTY.head), h('span', TODO_EMPTY.line)));
    // [planlane4:tasks] UPCOMING: the next fourteen days, each with its events and to-dos, then Later
    if (view === 'upcoming') return paintUpcoming(all, now);
    // [planlane4:tasks] PROJECTS: each project and tag with its count; a tap opens its page, grouped by section
    if (view === 'projects') return paintProjects(all, now);
    const l = all.filter((t) => inView(t, view, now));
    if (!open && view === 'all') p.body.append(h('p.todoline.alldone', TODO_ALL_DONE));
    if (!l.length && view !== 'all') p.body.append(h('div.empty', { dataset: { case: 'keep', state: 'empty' } }, h('b', 'Nothing here'), h('span', VIEW_EMPTY[view])));
    if (l.length) p.body.append(h('div.todolist', { role: 'list', 'aria-label': 'To-do' }, ...l.map(item)));
    const done = all.filter((t) => t.done);
    if (done.length) p.body.append(h('div.keyrow', button(`CLEAR DONE (${done.length})`, () => void clearDone())));
    // [planlane4:tasks] a timed one rings by notification: with none on this phone, said once under the list
    if (all.some((t) => !t.done && t.time) && pushState.get().status !== 'on') p.body.append(h('p.todoline.tdringoff', { dataset: { case: 'keep' } }, RING_OFF));
  };
  const paintUpcoming = (all: Todo[], now: number) => {
    const ag = agenda?.() ?? { events: [], loaded: true, offline: false, hasCopy: false };
    const up = upcoming(all, ag.events, now);
    const box = h('div.tdup', { dataset: { case: 'keep' } });
    if (!ag.loaded) {
      /* state: agenda.upcoming loading */
      box.append(h('p.todoline.tdupnote', { dataset: { state: 'loading' }, 'aria-live': 'polite' }, UP_LOADING), skeleton(2, UP_LOADING));
    } else if (ag.offline) {
      /* state: agenda.upcoming offline */
      box.append(h('p.todoline.tdupnote', { dataset: { state: 'offline' } }, ag.hasCopy ? UP_OFFLINE : UP_NOCOPY));
    }
    if (ag.loaded && !up.later.length && !up.days.some((d) => d.events.length || d.todos.length)) {
      /* state: agenda.upcoming empty */
      box.append(h('div.tdupempty', { dataset: { state: 'empty' } }, stateCard('empty', UP_EMPTY)));
      return void p.body.append(box);
    }
    // days with nothing on, side by side, are one short line (the view stays compact)
    let quiet: string[] = [];
    const flush = () => {
      if (quiet.length) box.append(h('p.tdupquiet', quietWords(quiet[0]!, quiet[quiet.length - 1]!, now)));
      quiet = [];
    };
    const group = (head: string, rows: HTMLElement[]) =>
      box.append(h('div.tdupday', h('b.tduphead', { role: 'heading', 'aria-level': '3' }, head), h('div.tduprows', { role: 'list', 'aria-label': head }, ...rows)));
    for (const d of up.days) {
      if (!d.events.length && !d.todos.length) {
        quiet.push(d.day);
        continue;
      }
      flush();
      // a tap on an event opens it whole in the diary; a tap on a to-do's words opens its change box, as in every view
      group(upDayWords(d.day, now), [
        ...d.events.map((e) => listRow({ id: e.id, title: e.title, sub: upEventWhen(e) }, openEvent ? { onTap: () => openEvent(e.id) } : {})),
        ...d.todos.map(item),
      ]);
    }
    flush();
    if (up.later.length) group('Later', up.later.map(item));
    p.body.append(box);
  };
  const paintProjects = (all: Todo[], now: number) => {
    const box = h('div.tdproj', { dataset: { case: 'keep' } });
    p.body.append(box);
    const open = (k: 'project' | 'tag', name: string) => () => {
      proj = { kind: k, name };
      paint();
      p.body.querySelector('.tdprojback')?.scrollIntoView({ block: 'nearest' });
    };
    if (proj) {
      const back = button('All projects', () => {
        proj = null;
        paint();
      }, 'tdprojback');
      back.setAttribute('aria-label', 'Back to all projects');
      const name = proj.kind === 'project' ? proj.name : `@${proj.name}`;
      box.append(h('div.tdprojtop', back, h('b.tdprojname', { role: 'heading', 'aria-level': '3' }, name)));
      const groups = proj.kind === 'project' ? bySection(all, proj.name, now) : [{ section: '', todos: sortTodos(all.filter((t) => !t.done && t.tags?.includes(proj!.name)), now) }];
      /* state: agenda.projects empty */
      if (!groups.some((g) => g.todos.length)) return void box.append(h('div.tdprojnone', { dataset: { state: 'empty' } }, stateCard('empty', PROJECT_DONE(name))));
      const named = groups.some((g) => g.section);
      for (const g of groups) {
        const head = g.section || (named ? 'No section' : '');
        box.append(h('div.tdupday', head ? h('b.tduphead', { role: 'heading', 'aria-level': '4' }, head) : null, h('div.tduprows', { role: 'list', 'aria-label': head || name }, ...g.todos.map(item))));
      }
      return;
    }
    const pr = projectsOf(all, now);
    if (!pr.projects.length && !pr.tags.length) return void box.append(h('div.tdprojnone', { dataset: { state: 'empty' } }, stateCard('empty', VIEW_EMPTY.projects)));
    if (pr.projects.length) {
      const rows = pr.projects.map((x) => listRow({ id: `project:${x.name}`, title: x.name, sub: projectSub(x), meta: String(x.open) }, { onTap: open('project', x.name) }));
      if (pr.loose) rows.push(h('p.tdupquiet', `${pr.loose} more in no project: All has them.`));
      box.append(h('div.tdupday', h('b.tduphead', { role: 'heading', 'aria-level': '3' }, 'Projects'), h('div.tduprows', { role: 'list', 'aria-label': 'Projects' }, ...rows)));
    }
    if (pr.tags.length)
      box.append(h('div.tdupday', h('b.tduphead', { role: 'heading', 'aria-level': '3' }, 'Tags'), h('div.tduprows', { role: 'list', 'aria-label': 'Tags' }, ...pr.tags.map((x) => listRow({ id: `tag:${x.name}`, title: `@${x.name}`, meta: String(x.open) }, { onTap: open('tag', x.name) })))));
  };
  // every change (here, from the chat, an UNDO) repaints the list, the month and the agenda's top line
  addEventListener(TODO_CHANGED, () => {
    paint();
    onChange();
  });
  paint();
  // the one list, read from the brain as the agenda opens (changes made here with no signal go first)
  void syncTodos(true);
  // [planlane4:tasks] the diary read (or not reached): UPCOMING, when it is the view, lays its days out again
  return { el: p.el, paint, list: loadTodos, agendaRead: () => view === 'upcoming' && paint() };
}

/** The open to-dos due on a day (for the month). */
export const dueOn = (l: readonly Todo[], day: string) => l.filter((t) => !t.done && t.due === day);
export { dayOf };
