/**
 * KEEP IN TOUCH (APPS ROUND, MEMORY lane; like Dex or UpHabit, but only his own list): the people HE chooses to stay close to and how
 * often; I say when it has been a while. A page of PEOPLE, built from the App Kit's parts (listRow, stateCard). Kept on this phone in
 * `ghosty.touch` (and the encrypted backup); the nudge is a reminder on my brain holding only "Time to catch up with <name>?" and the
 * day. Nothing is looked up about anyone and nothing is guessed: only the dates he marks.
 */
import { brain } from '../../api/brain';
import { clear, h } from '../../core/dom';
import { button, toast, undo } from '../../ui/components';
import { listRow, stateCard } from '../../ui/appkit';

export interface TouchPerson {
  id: string;
  name: string;
  /** How often, in days. */
  every: number;
  /** When he last caught up (ms); 0 for not yet. */
  last: number;
  /** The brain's reminder that holds the next nudge. */
  jobId?: string;
}

export const TOUCH_KEY = 'ghosty.touch';
const DAY = 86_400_000;
export const EVERY: { days: number; words: string }[] = [
  { days: 7, words: 'every week' },
  { days: 14, words: 'every 2 weeks' },
  { days: 30, words: 'every month' },
  { days: 91, words: 'every 3 months' },
  { days: 182, words: 'every 6 months' },
];

export const T = {
  TITLE: 'KEEP IN TOUCH',
  HINT: 'Who do you want to stay close to?',
  ADD: 'ADD',
  EMPTY: 'No one yet. Add someone you want to stay close to and how often, and I’ll say when it’s been a while.',
  NOTE: 'Only the people you add, and only the dates you mark. Nothing is looked up about anyone.',
  TALKED: (n: string) => `Marked: you caught up with ${n} today.`,
  GONE: (n: string) => `${n} is off the list.`,
  NUDGE_OFF: 'Kept on this phone; I couldn’t reach my brain to set the nudge, so it is set next time you mark them.',
  NUDGE: (n: string) => `Time to catch up with ${n}?`,
};

export function loadTouch(): TouchPerson[] {
  try {
    const v = JSON.parse(localStorage.getItem(TOUCH_KEY) ?? '[]') as TouchPerson[];
    return Array.isArray(v) ? v.filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string' && p.every > 0) : [];
  } catch {
    return [];
  }
}
const saveTouch = (list: TouchPerson[]) => {
  try {
    localStorage.setItem(TOUCH_KEY, JSON.stringify(list));
  } catch {
    /* no room: what is open stays as it is */
  }
};

/** When the next catch-up is due (ms): `every` days after the last one, or today when there was none. */
export const dueAt = (p: TouchPerson, now = Date.now()): number => (p.last ? p.last + p.every * DAY : now);
/** The words at the right: "due", "3 days over", "in 4 days". */
export function dueWords(p: TouchPerson, now = Date.now()): string {
  const d = Math.floor((dueAt(p, now) - now) / DAY);
  if (!p.last) return 'Due';
  if (d < 0) return `${-d} day${d === -1 ? '' : 's'} over`;
  if (d === 0) return 'Due today';
  return `In ${d} day${d === 1 ? '' : 's'}`;
}
export const lastWords = (p: TouchPerson, now = Date.now()): string => {
  if (!p.last) return 'not marked yet';
  const d = Math.floor((now - p.last) / DAY);
  return d === 0 ? 'caught up today' : d === 1 ? 'caught up yesterday' : `last caught up ${d} days ago`;
};
/** Those due or over, most over first, then the rest by when they are due. */
export const ordered = (list: TouchPerson[], now = Date.now()): TouchPerson[] => [...list].sort((a, b) => dueAt(a, now) - dueAt(b, now));
export const dueCount = (list: TouchPerson[], now = Date.now()): number => list.filter((p) => dueAt(p, now) <= now + DAY / 2).length;

/** What a spec reads: window.__ghosty.touch. */
export const touchState = { people: 0, due: 0, state: 'idle' as 'idle' | 'empty' | 'shown' };

/** The nudge on the brain, at 10 in the morning on the day it is due, or tomorrow for someone not marked yet (an earlier one let go). False when the brain was not reached. */
async function nudge(p: TouchPerson): Promise<boolean> {
  try {
    if (p.jobId) await brain.deleteJob(p.jobId).catch(() => undefined);
    // (someone just added, never marked: tomorrow at 10, not while he is looking at the list)
    const at = new Date(p.last ? dueAt(p) : Date.now() + DAY);
    at.setHours(10, 0, 0, 0);
    if (at.getTime() <= Date.now()) at.setTime(Date.now() + 5 * 60_000);
    const r = await brain.addJob({ kind: 'reminder', title: 'Keep in touch', text: T.NUDGE(p.name), at: at.getTime(), repeat: 'none' });
    p.jobId = r.job.id;
    return true;
  } catch {
    delete p.jobId;
    return false;
  }
}

/** The page: who, how often, when it is due; tap a name when you have caught up; ✕ takes them off (with UNDO). */
export function touchSheet(names: () => string[] = () => []): HTMLElement {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.touch = touchState;
  const nameIn = h('input', { type: 'text', placeholder: T.HINT, 'aria-label': 'Their name', maxlength: 40 }) as HTMLInputElement;
  const known = h('datalist#tcnames');
  nameIn.setAttribute('list', 'tcnames');
  const every = h('select', { 'aria-label': 'How often' }, ...EVERY.map((e) => h('option', { value: String(e.days) }, e.words))) as HTMLSelectElement;
  every.value = '30';
  const list = h('div.tclist', { role: 'list', dataset: { case: 'keep' } });
  const note = h('p.note.tcnote', T.NOTE);
  const said = h('p.note.tcsaid', { role: 'status', 'aria-live': 'polite' });

  const paint = () => {
    const all = loadTouch();
    clear(known, ...names().map((n) => h('option', { value: n })));
    touchState.people = all.length;
    touchState.due = dueCount(all);
    touchState.state = all.length ? 'shown' : 'empty';
    if (!all.length) {
      /* state: people.touch empty */
      clear(list, stateCard('empty', T.EMPTY));
      return;
    }
    clear(list, ...ordered(all).map((p) => {
      const row = listRow({ id: p.id, title: p.name, sub: `${EVERY.find((e) => e.days === p.every)?.words ?? `every ${p.every} days`} · ${lastWords(p)}`, meta: dueWords(p) }, {
        onTap: () => void talked(p.id),
        onDelete: () => drop(p.id),
      });
      row.classList.toggle('tcdue', dueAt(p) <= Date.now() + DAY / 2);
      row.querySelector('.ak-rowmain')?.setAttribute('aria-label', `${p.name}: ${dueWords(p)}. Tap when you have caught up.`);
      return row;
    }));
  };
  const talked = async (id: string) => {
    const all = loadTouch();
    const p = all.find((x) => x.id === id);
    if (!p) return;
    const before = { ...p };
    p.last = Date.now();
    saveTouch(all);
    paint();
    undo(T.TALKED(p.name), () => {
      const now = loadTouch();
      const i = now.findIndex((x) => x.id === id);
      if (i >= 0) now[i] = { ...before, jobId: now[i]!.jobId };
      saveTouch(now);
      paint();
    });
    const ok = await nudge(p);
    const now = loadTouch();
    const q = now.find((x) => x.id === id);
    if (q) {
      if (ok) q.jobId = p.jobId;
      else delete q.jobId;
      saveTouch(now);
    }
    said.textContent = ok ? '' : T.NUDGE_OFF;
  };
  const drop = (id: string) => {
    const all = loadTouch();
    const p = all.find((x) => x.id === id);
    if (!p) return;
    saveTouch(all.filter((x) => x.id !== id));
    paint();
    if (p.jobId) void brain.deleteJob(p.jobId).catch(() => undefined);
    undo(T.GONE(p.name), () => {
      const back = { ...p };
      delete back.jobId;
      saveTouch([...loadTouch(), back]);
      paint();
      void nudge(back).then((ok) => {
        if (!ok) return;
        const now = loadTouch();
        const q = now.find((x) => x.id === back.id);
        if (q) q.jobId = back.jobId;
        saveTouch(now);
      });
    });
  };
  const add = button(T.ADD, async (b) => {
    const name = nameIn.value.replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!name) return nameIn.focus();
    const all = loadTouch();
    if (all.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      toast(`${name} is already on your list.`, 'warn');
      return;
    }
    const p: TouchPerson = { id: `t${Date.now().toString(36)}`, name, every: Number(every.value) || 30, last: 0 };
    saveTouch([...all, p]);
    nameIn.value = '';
    paint();
    b.disabled = true;
    const ok = await nudge(p);
    b.disabled = false;
    const now = loadTouch();
    const q = now.find((x) => x.id === p.id);
    if (q && ok) {
      q.jobId = p.jobId;
      saveTouch(now);
    }
    said.textContent = ok ? '' : T.NUDGE_OFF;
  }, 'on');
  nameIn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') add.click();
  });
  paint();
  return h('div.tcsheet', { dataset: { case: 'keep' } }, h('div.row.wrap.tcadd', nameIn, known, every, add), said, list, note);
}
