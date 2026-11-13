/**
 * TO-DO (the planlane pass): his to-do list inside the agenda, kept on this phone. Type it, give it a day if it has one, tick it
 * off; late ones come first and say so, the done ones go to the bottom with CLEAR DONE. Every removal has UNDO. The words and the
 * order are in todowords.ts (pure, the spec reads them).
 */
import { clear, h } from '../../core/dom';
import { button, panel, toast, undo } from '../../ui/components';
import { dayOf, dueWords, sortTodos, TODO_ALL_DONE, TODO_EMPTY, TODO_NEED_TEXT, todoLine, daysTo, type Todo } from './todowords';

const KEY = 'ghosty.agenda.todo';
export function loadTodos(): Todo[] {
  try {
    const l = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Todo[];
    return Array.isArray(l) ? l.filter((t) => t && typeof t.id === 'string' && typeof t.text === 'string') : [];
  } catch {
    return [];
  }
}
function saveTodos(l: Todo[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(l.slice(0, 300)));
  } catch {
    toast('This phone would not keep the list (its storage is full or blocked)', 'warn');
  }
}

export function todoPanel(onChange: () => void): { el: HTMLElement; paint(): void; list(): Todo[] } {
  const p = panel('TO-DO', { cls: 'scroll.todo' });
  const text = h('input', { placeholder: 'Add a to-do (e.g. Renew passport)', 'aria-label': 'To-do', maxlength: '200' });
  const due = h('input', { type: 'date', 'aria-label': 'Due day (optional)' });
  const add = () => {
    const v = text.value.trim();
    if (!v) return toast(TODO_NEED_TEXT, 'warn');
    const l = loadTodos();
    l.push({ id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, text: v, due: due.value || '', done: false, at: Date.now() });
    saveTodos(l);
    text.value = '';
    due.value = '';
    paint();
    onChange();
  };
  text.addEventListener('keydown', (e) => e.key === 'Enter' && add());
  p.el.insertBefore(h('div.keyrow.wrapit.addev.todoadd', text, due, button('ADD', add)), p.body);
  const line = h('p.todoline', { 'aria-live': 'polite', dataset: { case: 'keep' } });
  p.el.insertBefore(line, p.body);

  const change = (fn: (l: Todo[]) => void) => {
    const l = loadTodos();
    fn(l);
    saveTodos(l);
    paint();
    onChange();
  };
  const item = (t: Todo) => {
    const now = Date.now();
    const late = !t.done && !!t.due && daysTo(t.due, now) < 0;
    const tick = button(t.done ? '✓' : '', () =>
      change((l) => {
        const x = l.find((y) => y.id === t.id);
        if (!x) return;
        x.done = !x.done;
        x.doneAt = x.done ? Date.now() : undefined;
      }), `todotick${t.done ? ' on' : ''}`);
    tick.setAttribute('role', 'checkbox');
    tick.setAttribute('aria-checked', String(t.done));
    tick.setAttribute('aria-label', t.done ? `Not done: ${t.text}` : `Done: ${t.text}`);
    const del = button('✕', () => {
      const before = loadTodos();
      const at = before.findIndex((y) => y.id === t.id);
      change((l) => l.splice(l.findIndex((y) => y.id === t.id), 1));
      undo(`Removed: ${t.text}`, () => change((l) => l.splice(Math.max(0, Math.min(at, l.length)), 0, t)));
    }, 'todox');
    del.setAttribute('aria-label', `Remove ${t.text}`);
    const words = t.done ? 'Done' : dueWords(t.due, now);
    return h(`div.todoit${t.done ? '.done' : ''}${late ? '.late' : ''}` as 'div', { role: 'listitem', dataset: { case: 'keep' } },
      tick,
      h('span.todotx', h('b', t.text), words ? h('small', words) : null),
      del);
  };
  const paint = () => {
    const l = sortTodos(loadTodos());
    const now = Date.now();
    clear(p.body);
    const open = l.filter((t) => !t.done).length;
    p.setStatus(l.length ? `${open}` : '', open ? 'ok' : 'mid');
    line.textContent = todoLine(l, now);
    /* state: agenda.todo empty */
    if (!l.length) return void p.body.append(h('div.empty', { dataset: { case: 'keep', state: 'empty' } }, h('b', TODO_EMPTY.head), h('span', TODO_EMPTY.line)));
    if (!open) p.body.append(h('p.todoline.alldone', TODO_ALL_DONE));
    p.body.append(h('div.todolist', { role: 'list', 'aria-label': 'To-do' }, ...l.map(item)));
    const done = l.filter((t) => t.done);
    if (done.length)
      p.body.append(h('div.keyrow', button(`CLEAR DONE (${done.length})`, () => {
        const kept = loadTodos();
        change((x) => x.splice(0, x.length, ...x.filter((t) => !t.done)));
        undo(`Cleared ${done.length} done`, () => {
          saveTodos(kept);
          paint();
          onChange();
        });
      })));
  };
  paint();
  return { el: p.el, paint, list: loadTodos };
}

/** The open to-dos due on a day (for the month). */
export const dueOn = (l: readonly Todo[], day: string) => l.filter((t) => !t.done && t.due === day);
export { dayOf };
