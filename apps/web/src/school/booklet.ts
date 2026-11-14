/**
 * WORKED ANSWERS YOU CAN STUDY (learn.u1): every paper Ghosty sat becomes a step-by-step worked-answers booklet for him to revise
 * from. Each question with its passage and choices; then, on his tap, Ghosty's own working (written in full when it was sat
 * online), the right answer and the mark scheme. He marks each one GOT IT or STILL LEARNING, and the ones still to learn come
 * first next time. A booklet is kept on this phone only (private, as the papers are: never shared, never sent anywhere).
 */
import { createStore } from '../core/store';
import { clear, h } from '../core/dom';
import { button, modal } from '../ui/components';

export interface BookletItem {
  id: string;
  q: string;
  options?: string[];
  passage?: string;
  /** Ghosty's own answer, in full working when it was sat online. */
  working: string;
  /** The right answer (a multiple-choice item's letter and words) and the mark scheme. */
  right: string;
  scheme?: string;
  got: number;
  max: number;
  /** He marked it STILL LEARNING the last time he studied it. */
  learning?: boolean;
}
export interface Booklet {
  id: string;
  title: string;
  at: number;
  items: BookletItem[];
  /** Times studied, and how many he had got at the last go. */
  studied?: number;
  lastGot?: number;
}

const MAX_BOOKLETS = 20;
export const booklets = createStore<{ list: Booklet[] }>({ list: [] }, { persist: 'ghosty.school.booklets', keys: ['list'] });
export const bookletState = { open: '', i: 0, of: 0, shown: false, got: 0, done: false, line: '' };

/** A paper as SCHOOL shows it (with its answers, marks and mark schemes) made into a booklet. */
export function bookletOf(paperId: string, title: string, at: number, items: { id: string; q: string; type: string; options?: string[]; answer?: string; rubric?: string; passage?: string; marks: number }[], answers: Map<string, { given: string; got: number; max: number }>, passages: { id: string; title: string; text: string }[]): Booklet {
  return {
    id: paperId,
    title,
    at,
    items: items.map((it) => {
      const a = answers.get(it.id);
      const idx = 'abcdefgh'.indexOf((it.answer ?? '').toLowerCase());
      const p = it.passage ? passages.find((x) => x.id === it.passage) : undefined;
      return {
        id: it.id,
        q: it.q,
        ...(it.options ? { options: [...it.options] } : {}),
        ...(p ? { passage: `${p.title}\n\n${p.text}` } : {}),
        working: a?.given?.trim() || 'I did not answer this one.',
        right: it.type === 'mcq' ? `${(it.answer ?? '').toUpperCase()}) ${it.options?.[idx] ?? ''}` : it.answer ?? '',
        ...(it.rubric ? { scheme: it.rubric } : {}),
        got: a?.got ?? 0,
        max: a?.max ?? it.marks,
      };
    }),
  };
}

/** Kept on this phone (the newest first, at most twenty; the same paper again replaces its old booklet, keeping what he marked). */
export function keepBooklet(b: Booklet): void {
  booklets.set((s) => {
    const was = s.list.find((x) => x.id === b.id);
    const merged = was ? { ...b, studied: was.studied, lastGot: was.lastGot, items: b.items.map((it) => ({ ...it, learning: was.items.find((x) => x.id === it.id)?.learning })) } : b;
    return { list: [merged, ...s.list.filter((x) => x.id !== b.id)].slice(0, MAX_BOOKLETS) };
  });
}
export const forgetBooklet = (id: string): void => booklets.set((s) => ({ list: s.list.filter((x) => x.id !== id) }));

/** The order to study in: the ones he is still learning first, then the ones Ghosty lost marks on, then the rest. */
export function studyOrder(items: BookletItem[]): BookletItem[] {
  const rank = (x: BookletItem) => (x.learning ? 0 : x.got < x.max ? 1 : 2);
  return items.map((x, i) => ({ x, i })).sort((a, b) => rank(a.x) - rank(b.x) || a.i - b.i).map((p) => p.x);
}

/** Study a booklet: a question at a time, the working on his tap, GOT IT or STILL LEARNING, and the count at the end. */
export function studyBooklet(b: Booklet): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.booklet = bookletState;
  const order = studyOrder(b.items);
  const body = h('div.bkstudy');
  const marks = new Map<string, boolean>();
  Object.assign(bookletState, { open: b.id, i: 0, of: order.length, shown: false, got: 0, done: false, line: '' });
  const m = modal('WORKED ANSWERS', body, () => Object.assign(bookletState, { open: '' }));
  const show = (i: number) => {
    const it = order[i]!;
    Object.assign(bookletState, { i: i + 1, shown: false });
    const reveal = h('div.bkreveal', { hidden: true },
      h('div.schans', h('small', 'MY WORKING'), h('p.bkworking', it.working)),
      h('div.schans', h('small', it.options ? 'RIGHT ANSWER' : 'MODEL ANSWER'), h('p', it.right || '—')),
      it.scheme ? h('div.schans', h('small', 'MARK SCHEME'), h('p', it.scheme)) : null,
      h('small.note', `I got ${it.got} of ${it.max} mark${it.max === 1 ? '' : 's'} on it.`));
    const showKey = button('SHOW THE WORKING', () => {
      reveal.hidden = false;
      showKey.hidden = true;
      judge.hidden = false;
      bookletState.shown = true;
    }, 'on');
    const mark = (ok: boolean) => {
      marks.set(it.id, ok);
      return i + 1 < order.length ? show(i + 1) : end();
    };
    const judge = h('div.keyrow', button('GOT IT', () => mark(true), 'on'), button('STILL LEARNING', () => mark(false)));
    judge.hidden = true;
    clear(body,
      h('p.bkhead', `${b.title} · question ${i + 1} of ${order.length}${it.learning ? ' · still learning' : ''}`),
      it.passage ? h('details.schpassage', h('summary', 'The passage'), h('p', it.passage)) : null,
      h('p.bkq', it.q),
      it.options ? h('ol.bkopts', ...it.options.map((o, k) => h('li', `${'ABCDEFGH'[k]}) ${o}`))) : null,
      h('small.note', 'Work it out yourself first, then look.'),
      h('div.keyrow', showKey), reveal, judge);
  };
  const end = () => {
    const got = [...marks.values()].filter(Boolean).length;
    Object.assign(bookletState, { got, done: true, line: `You got ${got} of ${order.length}. The ones still to learn come first next time.` });
    booklets.set((s) => ({ list: s.list.map((x) => (x.id === b.id ? { ...x, studied: (x.studied ?? 0) + 1, lastGot: got, items: x.items.map((y) => (marks.has(y.id) ? { ...y, learning: !marks.get(y.id) } : y)) } : x)) }));
    clear(body, h('p.bkq', bookletState.line), h('div.keyrow', button('STUDY IT AGAIN', () => (m.close(), studyBooklet(booklets.get().list.find((x) => x.id === b.id) ?? b)), 'on'), button('DONE', () => m.close())));
  };
  if (!order.length) return void clear(body, h('p.note', 'This paper has no questions to study.'));
  show(0);
}
