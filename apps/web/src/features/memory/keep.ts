/**
 * A MEMORY THAT KEEPS YOUR WORD, on the phone (NEXT ROUND, MEMORY lane). The brain keeps his word (apps/edge/src/keep.ts: promises
 * caught from his own turns, where he put things, why he chose, the Sunday week); this phone keeps a copy (`ghosty.keep`) so the
 * answers come with no signal, and his "the spare key is in the blue tin" said with none is kept here and sent when it comes back.
 *
 *  - MEMORY → YOUR WORD: his open promises (DONE, LATER, LET GO; done ones with REOPEN), where things are and why he chose (FORGET with
 *    UNDO), and YOUR WEEK (what he asked about most, what he finished, what is still open, what never got an answer);
 *  - the chat, answered here with no model (keepTurn): "where's the spare key?", "the spare key is in the blue tin", "why did I pick the
 *    canal flat?", "what did I say I'd do?", "my week", "what did I never get an answer to?", "what was I doing on the 3rd?".
 * His own words only; nothing about anyone else is kept beyond the sentence he said.
 */
import { dayAsked, dateSpan, dueWords, listWords, promisesAsked, unanswered, weekLines, whereAsked, whereIn, whyAsked, type KeepItem, type WeekReview } from '../../../../../packages/shared/src/keep';
import { stampOf } from '../../../../../packages/shared/src/recall';
import { headers } from '../../api/brain';
import type { LocalAnswer } from '../../assistant/local';
import { clear, h } from '../../core/dom';
import { createStore } from '../../core/store';
import { timeZone } from '../../state/app';
import { button, panel, toast, undo, type Panel } from '../../ui/components';
import { sayError } from '../../ui/hisWords';
import { findLocal, recallWarm } from './recall';
import { K } from './keepwords';

export interface KeepCopy {
  items: KeepItem[];
  week: WeekReview | null;
  lines: string[];
  at: number;
}

/** The copy of his word on this phone, and what waits to be sent ("the spare key is in the blue tin" said with no signal). */
export const keepStore = createStore({ items: [] as KeepItem[], week: null as WeekReview | null, lines: [] as string[], at: 0, queue: [] as string[] }, { persist: 'ghosty.keep' });
/** What a spec reads: window.__ghosty.keep. */
export const keepState = { state: 'idle' as 'idle' | 'loading' | 'shown' | 'offline' | 'error', items: 0, open: 0 };

async function call<T>(method: 'GET' | 'POST', body?: unknown): Promise<T> {
  const r = await fetch('/api/profile/keep', { method, headers: headers(body ? { 'content-type': 'application/json' } : {}), ...(body ? { body: JSON.stringify(body) } : {}), credentials: 'same-origin' });
  if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { error?: string } | null)?.error || `the brain answered ${r.status}`);
  return (await r.json()) as T;
}

/** A fresh copy from the brain (what waits in the queue goes first). False when the brain cannot be reached: the copy stands. */
export async function refreshKeep(): Promise<boolean> {
  try {
    for (const words of [...keepStore.get().queue]) {
      await call('POST', { op: 'add', text: words });
      keepStore.set((s) => ({ queue: s.queue.filter((x) => x !== words) }));
    }
    const r = await call<{ items: KeepItem[]; week: WeekReview; lines: string[] }>('GET');
    keepStore.set({ items: r.items, week: r.week, lines: r.lines, at: Date.now() });
    return true;
  } catch {
    return false;
  }
}

/** One change on the brain (DONE, LATER, LET GO, REOPEN, FORGET, UNDO): the copy follows its answer. */
export async function changeKeep(op: string, id: string, extra: Record<string, unknown> = {}): Promise<boolean> {
  try {
    const r = await call<{ items: KeepItem[] }>('POST', { op, id, ...extra });
    keepStore.set({ items: r.items });
    return true;
  } catch (e) {
    toast(sayError(e, 'change that'), 'warn');
    return false;
  }
}

const open = (): KeepItem[] => keepStore.get().items.filter((x) => x.kind === 'promise' && x.state === 'open').sort((a, b) => (a.remindAt ?? a.at) - (b.remindAt ?? b.at));
const day = (at: number) => new Date(at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const norm = (s: string) => s.toLowerCase().replace(/^(?:the|my|our) /, '').replace(/[^a-z0-9 ]/g, '').trim();

// ---------------------------------------------------------------- the chat, answered here

type Opts = { voice?: boolean; private?: boolean };
type Answer = (text: string, reply: string, local: LocalAnswer, opts: Opts) => true;

/** Does his message ask about his word (so assistant/local.ts tries keepTurn)? */
export const keepAsked = (t: string): boolean => !!whereAsked(t) || !!whereIn(t) || !!whyAsked(t) || promisesAsked(t) || weekAsked(t) || unansweredAsked(t) || !!dayAsked(t);
export const weekAsked = (t: string): boolean => /^(?:(?:hey )?ghosty[, ]+)?(?:(?:show me |give me |what'?s |read me )?my week(?: in review)?|(?:how was|how's|review) my week|week in review|what did I do this week|sum up my week|my weekly review)[?.!]*$/i.test(t.trim());
export const unansweredAsked = (t: string): boolean => /^(?:(?:hey )?ghosty[, ]+)?(?:what did I never get an answer to|what (?:questions )?(?:did|have) you (?:never|not) answer(?:ed)?|(?:my |any )?(?:open|unanswered) questions|what's still unanswered|what did you not know)[?.!]*$/i.test(t.trim());

export async function keepTurn(text: string, opts: Opts, answer: Answer): Promise<boolean> {
  const t = text.trim();
  const go: LocalAnswer['go'] = [{ id: 'screen:memory', ask: -1, label: 'Open Your word', open: 'memory', panel: 'YOUR WORD' }];
  // "the spare key is in the blue tin": kept now, here, and on the brain (or as soon as there is a signal)
  const said = whereIn(t);
  if (said) {
    const now = Date.now();
    keepStore.set((s) => ({ items: [...s.items.filter((x) => !(x.kind === 'where' && norm(x.what) === norm(said.what))), { id: `local-${now}`, kind: 'where' as const, at: now, via: 'phone', text: t.slice(0, 160), what: said.what, detail: said.where }] }));
    const sent = await Promise.race([call('POST', { op: 'add', text: t }).then(() => true, () => false), new Promise<boolean>((r) => setTimeout(() => r(false), 4000))]);
    if (!sent) keepStore.set((s) => ({ queue: [...s.queue.filter((x) => x !== t), t].slice(-30) }));
    else void refreshKeep();
    return answer(t, K.whereKept(said.what, said.where, sent), { kind: 'pack', go }, opts);
  }
  const thing = whereAsked(t);
  if (thing) {
    const hit = keepStore.get().items.filter((x) => x.kind === 'where' && (norm(x.what).includes(norm(thing)) || norm(thing).includes(norm(x.what)))).sort((a, b) => b.at - a.at)[0];
    if (hit) return answer(t, K.whereFound(hit.what, hit.detail ?? '', day(hit.at)), { kind: 'pack', go }, opts);
    // not in the copy: the brain may know it from a chat (its recall), so it is asked when it can be; else said plainly
    if (navigator.onLine && !keepStore.get().at) return false;
    return answer(t, K.whereNone(thing), { kind: 'pack' }, opts);
  }
  const chose = whyAsked(t);
  if (chose) {
    const hit = keepStore.get().items.filter((x) => x.kind === 'why' && (norm(x.what).includes(norm(chose)) || norm(chose).includes(norm(x.what)))).sort((a, b) => b.at - a.at);
    if (hit.length) return answer(t, K.whyFound(hit[0]!.what, hit.map((x) => x.detail ?? '').filter(Boolean), day(hit[0]!.at)), { kind: 'pack', go }, opts);
    // the turns may hold his reason ("…because…") even when it was not caught as one
    if (await recallWarm()) {
      const turns = (await findLocal(chose, { turns: true, k: 12 })).filter((f) => /\b(?:because|cos|as it|since)\b/i.test(f.line));
      if (turns.length) return answer(t, K.whyFromChat(chose, turns[0]!.line, turns[0]!.stamp), { kind: 'recall', found: turns.slice(0, 3).map((f) => ({ key: f.key, kind: f.kind, id: f.id, title: f.title, line: f.line, at: f.at, stamp: f.stamp, day: f.day })) }, opts);
    }
    if (navigator.onLine) return false;
    return answer(t, K.whyNone(chose), { kind: 'pack' }, opts);
  }
  if (promisesAsked(t)) {
    // (a promise said a moment ago is on the brain: a fresh copy is waited for a little, else the one on the phone is used)
    if (navigator.onLine) await Promise.race([refreshKeep(), new Promise((r) => setTimeout(r, 2500))]);
    const list = open();
    return answer(t, list.length ? K.promises(list.map((p) => `${p.what}${p.due ? ` (${dueWords(p.due)})` : ''}`)) : K.NO_PROMISES, { kind: 'pack', go, ...(list.length ? { promises: list.slice(0, 6).map((p) => ({ id: p.id, what: p.what, due: p.due ? dueWords(p.due) : '' })) } : {}) }, opts);
  }
  if (weekAsked(t)) {
    await Promise.race([refreshKeep(), new Promise((r) => setTimeout(r, 2500))]);
    const lines = keepStore.get().lines;
    return answer(t, lines.length ? lines.join('\n') : K.WEEK_NONE, { kind: 'pack', go: [{ id: 'screen:memory', ask: -1, label: 'Open Your week', open: 'memory', panel: 'YOUR WORD' }] }, opts);
  }
  if (unansweredAsked(t)) {
    const list = (await recallWarm()) ? (await openQuestions()).slice(0, 5) : (keepStore.get().week?.unanswered ?? []).map((x) => ({ q: x.q, at: x.at, stamp: day(x.at) }));
    if (!list.length) return answer(t, K.ALL_ANSWERED, { kind: 'pack' }, opts);
    return answer(t, K.openQuestions(list.map((x) => `“${x.q.slice(0, 70)}” (${x.stamp})`)), { kind: 'pack', go: list.slice(0, 3).map((x, i) => ({ id: `ask:${i}`, ask: -1, label: K.askAgain(x.q), words: x.q })) }, opts);
  }
  const when = dayAsked(t);
  if (when) {
    const span = dateSpan(when, Date.now(), timeZone);
    if (!span) return false;
    const turns = (await recallWarm()) ? await turnsBetween(span.from, span.to) : [];
    const kept = keepStore.get().items.filter((x) => x.at >= span.from && x.at < span.to);
    const lines = [...turns.slice(0, 6).map((x) => `you asked “${x.line.slice(0, 70)}”`), ...kept.slice(0, 4).map((x) => (x.kind === 'promise' ? `you said you'd ${x.what}` : x.kind === 'where' ? `you put ${x.what} ${x.detail}` : `you chose ${x.what}`))];
    if (!lines.length) return answer(t, K.dayNone(span.said), { kind: 'pack' }, opts);
    return answer(t, K.dayLines(span.said, lines), { kind: 'recall', found: turns.slice(0, 6).map((f) => ({ key: f.key, kind: f.kind, id: f.id, title: f.title, line: f.line, at: f.at, stamp: f.stamp, day: f.day })) }, opts);
  }
  return false;
}

/** His questions of the last 30 days that never got a real answer (the answer said "I don't know", "I couldn't…", or nothing came). */
export async function openQuestions(): Promise<{ q: string; at: number; stamp: string }[]> {
  const { allThings } = await import('./recall');
  const since = Date.now() - 30 * 86_400_000;
  return (await allThings())
    .filter((x) => x.kind === 'turn' && x.at >= since && /\?\s*$|^(?:what|how|why|when|where|who|which|can|could|is|are|do|does|should)\b/i.test(x.text) && unanswered(x.a))
    .sort((a, b) => b.at - a.at)
    .map((x) => ({ q: x.text, at: x.at, stamp: stampOf(x.at, x.via ?? 'app', timeZone) }));
}

/** The turns of a span of days, oldest first (for "what was I doing on the 3rd?" and "what did I ask in October?"). */
export async function turnsBetween(from: number, to: number): Promise<{ key: string; kind: 'turn'; id: string; title: string; line: string; at: number; stamp: string; day: string }[]> {
  const { allThings } = await import('./recall');
  return (await allThings())
    .filter((x) => x.kind === 'turn' && x.at >= from && x.at < to)
    .sort((a, b) => a.at - b.at)
    .map((x) => ({ key: x.key, kind: 'turn' as const, id: x.id, title: '', line: x.text, at: x.at, stamp: stampOf(x.at, x.via ?? 'app', timeZone), day: day(x.at) }));
}

// ---------------------------------------------------------------- MEMORY → YOUR WORD

export function keepPanel(): Panel & { refresh(): Promise<void> } {
  const p = panel('YOUR WORD', { cls: 'keep', status: '' });
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.keep = keepState;
  p.body.append(h('p.note', K.LEAD));
  const box = h('div.keepbody', { dataset: { case: 'keep' } });
  p.body.append(box);

  const row = (it: KeepItem, keys: HTMLElement[], line: string, sub: string) =>
    h('div.keeprow', { dataset: { id: it.id, kind: it.kind, state: it.state ?? '', case: 'keep' } }, h('span.keeptxt', h('b', line), h('small', sub)), h('span.keepkeys', ...keys));
  const key = (label: string, aria: string, fn: (b: HTMLButtonElement) => Promise<void> | void, cls = '') => {
    const b = button(label, (x) => void fn(x), cls);
    b.setAttribute('aria-label', aria);
    b.dataset.case = 'keep';
    return b;
  };
  const forget = (it: KeepItem) =>
    key('FORGET', `Forget: ${it.what}`, async (b) => {
      b.disabled = true;
      if (await changeKeep('forget', it.id)) undo(K.forgotten(it.what), () => void changeKeep('restore', it.id));
      else b.disabled = false;
    }, 'warn');

  const paint = () => {
    const s = keepStore.get();
    const promises = open();
    const done = s.items.filter((x) => x.kind === 'promise' && x.state !== 'open').sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)).slice(0, 6);
    const where = s.items.filter((x) => x.kind === 'where').sort((a, b) => b.at - a.at);
    const why = s.items.filter((x) => x.kind === 'why').sort((a, b) => b.at - a.at);
    keepState.items = s.items.length;
    keepState.open = promises.length;
    p.setStatus(promises.length ? `${promises.length} OPEN` : s.at ? 'ALL KEPT' : '', promises.length ? 'mid' : 'ok');
    const head = (t: string) => h('h4.keephead', t);
    clear(
      box,
      head(K.H_PROMISES),
      ...(promises.length
        ? promises.map((it) =>
            row(it, [
              key('DONE', `Done: ${it.what}`, async (b) => {
                b.disabled = true;
                if (await changeKeep('done', it.id)) undo(K.doneLine(it.what), () => void changeKeep('reopen', it.id));
                else b.disabled = false;
              }, 'on'),
              key('LATER', `Remind me tomorrow: ${it.what}`, async (b) => {
                b.disabled = true;
                if (await changeKeep('snooze', it.id, { days: 1 })) toast(K.later(it.what), 'ok');
                b.disabled = false;
              }),
              key('LET GO', `Let go: ${it.what}`, async (b) => {
                b.disabled = true;
                if (await changeKeep('drop', it.id)) undo(K.letGo(it.what), () => void changeKeep('reopen', it.id));
                else b.disabled = false;
              }),
            ], it.what, K.promiseSub(day(it.at), it.via, it.due ? dueWords(it.due) : '', it.remindAt, !!it.nudged)),
          )
        : [h('p.note.keepempty', K.PROMISES_EMPTY)] /* state: memory.keep empty */),
      ...(done.length ? [h('details.keepdone', h('summary', K.doneHead(done.length)), ...done.map((it) => row(it, [key('REOPEN', `Reopen: ${it.what}`, () => void changeKeep('reopen', it.id))], it.what, K.doneSub(it.state === 'done', it.doneAt ?? it.at, day))))] : []),
      head(K.H_WHERE),
      ...(where.length ? where.map((it) => row(it, [forget(it)], `${cap(it.what)} ${it.detail ?? ''}`, K.saidOn(day(it.at), it.via))) : [h('p.note.keepempty', K.WHERE_EMPTY)]),
      head(K.H_WHY),
      ...(why.length ? why.map((it) => row(it, [forget(it)], `${cap(it.what)}: ${it.detail ?? ''}`, K.saidOn(day(it.at), it.via))) : [h('p.note.keepempty', K.WHY_EMPTY)]),
      head(K.H_WEEK),
      ...(s.lines.length ? s.lines.map((l) => h('p.keepweek', l)) : [h('p.note.keepempty', K.WEEK_EMPTY)]),
      ...(s.queue.length ? [h('p.note.keepqueue', K.queued(s.queue.length))] : []),
    );
  };
  keepStore.subscribe(paint);

  const state = (cls: string, head: string, line: string, retry = false) => {
    const el = h(`div.empty.${cls}` as 'div', { dataset: { case: 'keep' } }, h('b', head), h('span', line));
    if (retry) el.append(key('RETRY', 'Try reading your word again', () => void refresh(), 'on'));
    return el;
  };
  const refresh = async () => {
    const first = !keepStore.get().at;
    if (first) {
      /* state: memory.keep loading */
      keepState.state = 'loading';
      clear(box, state('wait', K.LOADING, K.LOADING_NEXT));
    }
    const ok = await refreshKeep();
    keepState.state = ok ? 'shown' : keepStore.get().at ? 'offline' : navigator.onLine ? 'error' : 'offline';
    if (!ok && !keepStore.get().at) {
      clear(box, navigator.onLine ? state('bad', K.ERROR, K.ERROR_NEXT, true) /* state: memory.keep error */ : state('bad', K.OFFLINE, K.OFFLINE_NEXT) /* state: memory.keep offline */);
      return;
    }
    paint();
    if (!ok) p.setStatus('OFFLINE', 'off');
  };
  addEventListener('online', () => void refreshKeep());
  return Object.assign(p, { refresh });
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export { listWords, weekLines };
