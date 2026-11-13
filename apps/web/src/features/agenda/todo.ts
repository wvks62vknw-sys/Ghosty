/**
 * TO-DO (the planlane pass): his to-do list inside the agenda, kept on this phone. Type it, give it a day and a repeat if it has
 * them, star the ones that matter, tick it off (a repeating one comes back on its next day); tap its words to change them or its
 * day. Late ones come first, then the starred ones; the done ones go to the bottom with CLEAR DONE. ALL · TODAY · UPCOMING · STARRED
 * narrow the list. Every removal has UNDO. The words and the order are in todowords.ts (pure, the spec reads them); the chat works
 * the same list through the functions below (turn.ts).
 */
import { clear, h } from '../../core/dom';
import { button, panel, toast, undo } from '../../ui/components';
import {
  dayOf, dueWords, EVERY, everyWords, inView, nextDue, sortTodos, TODO_ALL_DONE, TODO_EMPTY, TODO_NEED_TEXT, todoLine, daysTo, VIEW_EMPTY, VIEWS,
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

/** Add a to-do (the box, or the chat): the one added, or null when this phone would not keep it. */
export function addTodo(text: string, due = '', every?: Every, star?: boolean): Todo | null {
  // (a repeating one with no day starts today: "water the plants every day" is due today)
  const t: Todo = { id: newId(), text: text.trim().slice(0, 200), due: due || (every ? dayOf(Date.now()) : ''), done: false, at: Date.now(), ...(every ? { every } : {}), ...(star ? { star: true } : {}) };
  const l = loadTodos();
  l.push(t);
  return saveTodos(l) ? t : null;
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
    next = { id: newId(), text: x.text, due: nextDue(x.due, x.every, Date.now()), done: false, at: Date.now(), every: x.every, ...(x.star ? { star: true } : {}) };
    l.push(next);
    x.nextId = next.id;
  } else if (!x.done && x.nextId) {
    const n = l.find((y) => y.id === x.nextId);
    if (n && !n.done && n.text === x.text && n.every === x.every) l = l.filter((y) => y !== n);
    delete x.nextId;
  }
  return saveTodos(l) ? { done: x.done, next } : null;
}
/** Take one off the list, with UNDO (it goes back where it was). False when it was not there. */
export function removeTodo(id: string): boolean {
  const l = loadTodos();
  const at = l.findIndex((y) => y.id === id);
  if (at < 0) return false;
  const [t] = l.splice(at, 1);
  if (!saveTodos(l)) return false;
  undo(`Removed: ${t!.text}`, () => {
    const now = loadTodos();
    if (!now.some((y) => y.id === t!.id)) now.splice(Math.min(at, now.length), 0, t!);
    saveTodos(now);
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
  undo(`Cleared ${n} done`, () => {
    const now = loadTodos();
    const have = new Set(now.map((t) => t.id));
    void saveTodos([...now, ...gone.filter((t) => !have.has(t.id))]);
  });
  return n;
}
/** Change a to-do's words, day, repeat or star. */
export function editTodo(id: string, patch: Partial<Pick<Todo, 'text' | 'due' | 'every' | 'star'>>): boolean {
  const l = loadTodos();
  const x = l.find((y) => y.id === id);
  if (!x) return false;
  Object.assign(x, patch);
  if (!x.every) delete x.every;
  if (!x.star) delete x.star;
  return saveTodos(l);
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

export function todoPanel(onChange: () => void): { el: HTMLElement; paint(): void; list(): Todo[] } {
  const p = panel('TO-DO', { cls: 'scroll.todo' });
  const text = h('input', { placeholder: 'Add a to-do (e.g. Renew passport)', 'aria-label': 'To-do', maxlength: '200' });
  const due = h('input', { type: 'date', 'aria-label': 'Due day (optional)' });
  const rep = everySelect();
  let view: TodoView = loadView();
  /** the to-do whose words are open to change (one at a time), and what he has typed there so far (kept across repaints) */
  let editing = '';
  let draft: { id: string; text: string; due: string; every: string } | null = null;
  const add = () => {
    const v = text.value.trim();
    if (!v) return toast(TODO_NEED_TEXT, 'warn');
    addTodo(v, due.value || '', (rep.value || undefined) as Every | undefined);
    text.value = '';
    due.value = '';
    rep.value = '';
    // a new one shows whatever the view: back to All when the view would hide it
    if (view !== 'all') setView('all');
  };
  text.addEventListener('keydown', (e) => e.key === 'Enter' && add());
  p.el.insertBefore(h('div.keyrow.wrapit.addev.todoadd', text, due, rep, button('ADD', add)), p.body);
  const line = h('p.todoline', { 'aria-live': 'polite', dataset: { case: 'keep' } });
  p.el.insertBefore(line, p.body);
  const views = h('div.keyrow.wrapit.todoviews', { role: 'group', 'aria-label': 'Show' });
  p.el.insertBefore(views, p.body);
  const setView = (v: TodoView) => {
    view = v;
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
    const rp = everySelect((d ? d.every : t.every ?? '') as Every | '');
    const keep = () => void (draft = { id: t.id, text: tx.value, due: dd.value, every: rp.value });
    for (const x of [tx, dd, rp]) x.addEventListener('input', keep);
    rp.addEventListener('change', keep);
    const save = () => {
      const v = tx.value.trim();
      if (!v) return toast(TODO_NEED_TEXT, 'warn');
      editing = '';
      draft = null;
      const was = { text: t.text, due: t.due, every: t.every, star: t.star };
      if (!editTodo(t.id, { text: v, due: dd.value || '', every: (rp.value || undefined) as Every | undefined })) return paint();
      undo(`Changed: ${v}`, () => void editTodo(t.id, was));
    };
    tx.addEventListener('keydown', (e) => e.key === 'Enter' && save());
    queueMicrotask(() => tx.focus());
    return h('div.todoedit', { dataset: { case: 'keep' } },
      h('div.keyrow.wrapit.addev', tx, dd, rp),
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
    const star = button(t.star ? '★' : '☆', () => void editTodo(t.id, { star: !t.star }), `todostar${t.star ? ' on' : ''}`);
    star.setAttribute('aria-pressed', String(!!t.star));
    star.setAttribute('aria-label', t.star ? `Unstar ${t.text}` : `Star ${t.text}`);
    const del = button('✕', () => void removeTodo(t.id), 'todox');
    del.setAttribute('aria-label', `Remove ${t.text}`);
    const words = [t.done ? 'Done' : dueWords(t.due, now), t.every ? `repeats ${everyWords(t.every)}` : ''].filter(Boolean).join(' · ');
    // tap the words to change them (and the day, and the repeat)
    const tx = h('button.todotx', { type: 'button', 'aria-label': `Change ${t.text}`, 'aria-expanded': String(editing === t.id) }, h('b', t.text), words ? h('small', words) : null);
    tx.addEventListener('click', () => {
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
      const b = button(v === 'all' || !n ? label : `${label} ${n}`, () => setView(v), `todoview${v === view ? ' on' : ''}`);
      b.setAttribute('aria-pressed', String(v === view));
      views.append(b);
    }
    /* state: agenda.todo empty */
    if (!all.length) return void p.body.append(h('div.empty', { dataset: { case: 'keep', state: 'empty' } }, h('b', TODO_EMPTY.head), h('span', TODO_EMPTY.line)));
    const l = all.filter((t) => inView(t, view, now));
    if (!open && view === 'all') p.body.append(h('p.todoline.alldone', TODO_ALL_DONE));
    if (!l.length && view !== 'all') p.body.append(h('div.empty', { dataset: { case: 'keep', state: 'empty' } }, h('b', 'Nothing here'), h('span', VIEW_EMPTY[view])));
    if (l.length) p.body.append(h('div.todolist', { role: 'list', 'aria-label': 'To-do' }, ...l.map(item)));
    const done = all.filter((t) => t.done);
    if (done.length) p.body.append(h('div.keyrow', button(`CLEAR DONE (${done.length})`, () => void clearDone())));
  };
  // every change (here, from the chat, an UNDO) repaints the list, the month and the agenda's top line
  addEventListener(TODO_CHANGED, () => {
    paint();
    onChange();
  });
  paint();
  return { el: p.el, paint, list: loadTodos };
}

/** The open to-dos due on a day (for the month). */
export const dueOn = (l: readonly Todo[], day: string) => l.filter((t) => !t.done && t.due === day);
export { dayOf };
