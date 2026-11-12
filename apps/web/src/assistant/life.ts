/**
 * LIFE EASIER, in the ask line (BRIEF-OCT-IDEAS-2 3, 5, 7), answered on the phone with no model (assistant/local.ts calls these):
 *  - "what did I miss?": the same card Home draws after a day away (features/core/missed.ts), from his own data only;
 *  - "teach me what you learned this week": five plain sentences at most from the report card's numbers, the capability ledger
 *    (WHAT I LEARNED TO DO) and the loss he studied in the GYM, READ IT TO ME under it; when my brain is offline, a plain version
 *    from the last copy this phone kept;
 *  - "tell me when this price drops / this page changes / there's a strike on my line": a watcher on a public page he names
 *    (the brain's hourly beat reads it and tells him once; WATCHERS under PLAN lists it with STOP).
 * `answer` is local.ts's own: his words shown, the reply (with its buttons) under them, said aloud when he asked by voice.
 */
import { sayError } from '../ui/hisWords';
import { teachLines, watcherAsked, type ReportRun } from '../../../../packages/shared/src/lifeeasier';
import { brain, headers } from '../api/brain';
import { chat } from './session';
import type { LocalAnswer } from './local';

type Opts = { voice?: boolean; private?: boolean };
type Answer = (text: string, reply: string, local: LocalAnswer, opts: Opts) => true;

const within = <T>(p: Promise<T>, ms = 6000): Promise<T | null> => Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]).catch(() => null);

/**
 * A wait over half a second says what it is for, in my voice: his words go in, with the step I am on, and both come out again
 * when the answer is ready (the answer puts his words back above it). Quicker than half a second, nothing shows at all.
 */
function waiting(text: string, label: string, opts: Opts): () => void {
  const id = `life-${Date.now()}`;
  const at = Date.now();
  let shown = false;
  const timer = setTimeout(() => {
    shown = true;
    chat.set((s) => ({ entries: [...s.entries, { kind: 'user' as const, text, at, ...(opts.private ? { private: true } : {}) }, { kind: 'activity' as const, id, label, state: 'running' as const }].slice(-120) }));
  }, 450);
  return () => {
    clearTimeout(timer);
    if (shown) chat.set((s) => ({ entries: s.entries.filter((e) => !(e.kind === 'activity' && e.id === id) && !(e.kind === 'user' && e.at === at && e.text === text)) }));
  };
}

// ---------------------------------------------------------------- what did I miss

export async function missedTurn(text: string, opts: Opts, answer: Answer): Promise<boolean> {
  const m = await import('../features/core/missed');
  const done = waiting(text, 'Looking at what came while you were away…', opts);
  const r = await m.ask().finally(done);
  answer(text, r.reply, { kind: 'missed' }, opts);
  if (r.card) void import('../features/core/cards').then((c) => c.postCard(r.card!)).catch(() => undefined);
  return true;
}

// ---------------------------------------------------------------- teach me what you learned this week

const COPY = 'ghosty.ledger.copy';

/** The report card's runs, as this phone keeps them (offline/harder.ts persists the store under this name). */
function runsHere(): ReportRun[] {
  try {
    const v = JSON.parse(localStorage.getItem('ghosty.reportcard') ?? 'null') as { history?: ReportRun[] } | null;
    return Array.isArray(v?.history) ? v!.history! : [];
  } catch {
    return [];
  }
}

/** The ledger lines: the brain's word today (and a copy kept), else the last copy (marked), else none. */
async function ledger(): Promise<{ lines: string[] | null; kept: boolean }> {
  // (read directly, not through the phone's read cache: that would hand back the last answer without saying it is old)
  const got = await within(fetch('/api/training/ledger', { headers: headers(), credentials: 'same-origin' }).then((r) => (r.ok ? (r.json() as Promise<{ lines?: string[]; since?: number }>) : null)));
  if (got && Array.isArray(got.lines)) {
    try {
      localStorage.setItem(COPY, JSON.stringify({ lines: got.lines, since: got.since, at: Date.now() }));
    } catch {
      /* no storage: no copy kept */
    }
    return { lines: got.lines, kept: false };
  }
  try {
    const c = JSON.parse(localStorage.getItem(COPY) ?? 'null') as { lines?: string[] } | null;
    if (c && Array.isArray(c.lines)) return { lines: c.lines, kept: true };
  } catch {
    /* none kept */
  }
  return { lines: null, kept: false };
}

/** Losses to him at Connect 4 that I studied, and the latest one's move and idea. */
async function gymLoss(): Promise<{ lessons: number; latest: { wonAt: number; idea?: string } | null }> {
  try {
    const j = await (await import('../features/gym/store')).loadJournal();
    const studied = j.c4.filter((g) => !g.spec && g.result === 'you' && g.study).sort((a, b) => a.at - b.at);
    const last = studied[studied.length - 1]?.study;
    return { lessons: studied.length, latest: last ? { wonAt: last.wonAt, ...(last.idea ? { idea: last.idea } : {}) } : null };
  } catch {
    return { lessons: 0, latest: null };
  }
}

export async function teachTurn(text: string, opts: Opts, answer: Answer): Promise<boolean> {
  const done = waiting(text, 'Reading my report card and what I learned…', opts);
  const [l, gym] = await Promise.all([ledger(), gymLoss()]).finally(done);
  const lines = teachLines({ now: Date.now(), ledger: l.lines, ledgerKept: l.kept, runs: runsHere(), gym });
  const reply = lines.join(' ');
  answer(text, reply, { kind: 'teach', read: reply, go: [{ id: 'screen:system', ask: -1, label: 'Open the report card', open: 'system' }] }, opts);
  return true;
}

// ---------------------------------------------------------------- watchers

export async function watcherTurn(text: string, opts: Opts, answer: Answer): Promise<boolean> {
  const w = watcherAsked(text);
  if (!w) return false;
  const go: LocalAnswer['go'] = [{ id: 'screen:agenda', ask: -1, label: 'See my watchers', open: 'agenda', panel: 'WATCHERS' }];
  if (!w.url) {
    const what = w.kind === 'price' ? 'the page of the thing' : w.kind === 'page' ? 'the page' : 'the status page of your line’s operator';
    answer(text, `I can do that, but I need ${what}: its address, after your words, like “${w.words.replace(/\s+/g, ' ').slice(0, 60)} https://…”. I only watch public pages, never a login and never a person’s page.`, { kind: 'watcher' }, opts);
    void import('../features/core/cards').then((c) => c.askInBox(`${w.words} https://`)).catch(() => undefined);
    return true;
  }
  const done = waiting(text, 'Reading that page once, to be sure I can…', opts);
  const r = await within(brain.watchersAdd({ kind: w.kind, url: w.url }).then((x) => ({ ok: true as const, said: x.said }), (e: Error) => ({ ok: false as const, said: sayError(e, 'start watching that') })), 15_000).finally(done);
  if (!r) return answer(text, 'That page is slow to answer, so I haven’t started watching it. Ask me again in a minute.', { kind: 'watcher' }, opts), true;
  if (r.ok) return answer(text, r.said, { kind: 'watcher', go }, opts), true;
  const offline = /fetch|network|offline|reach/i.test(r.said) && !/page/i.test(r.said);
  answer(text, offline ? 'I can’t reach my brain right now, and it is the brain that looks at pages every hour, so I can’t start a watcher. Ask me again when I’m back online.' : r.said.replace(/^(?:.*?)error:\s*/i, ''), { kind: 'watcher' }, opts);
  return true;
}
