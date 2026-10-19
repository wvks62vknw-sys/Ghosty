/**
 * The GYM's side of the Web Worker: training runs here so the page never freezes. It is bundled into the
 * existing worker file (workers/textures.worker.ts hands every `{ gym }` message to `gymMessage`), because
 * the build's worker list is a protected file; the page starts its own instance of that worker for the
 * GYM. One game trains at a time, in slices of ~50 ms with a pause between them (messages get through,
 * the phone stays cool). It is measured every ~1.5 s — or less often when measuring itself is slow (at
 * least five times as long as a measurement takes) — and its full state is posted every ~8 s for the page
 * to keep in IndexedDB.
 *
 * Every message names the game's `epoch`: the page bumps it when the owner RESETs a game, and drops any
 * message still in flight from before (so a wiped game can't come back).
 *
 * In:  { gym: 'train', id, rec, epoch } · { gym: 'pause' } · { gym: 'reset', id, epoch }
 *      { gym: 'watch' | 'move' | 'view', id, rec, epoch, req, seed?, secret?, board? }
 *      { gym: 'bench', req } (the report card's gym questions) · { gym: 'judge', req, id, reply } (one judged)
 *      { gym: 'exact', req, question, reply? } (the exact check THINK HARDER can use for a chat question; with a reply, its verdict)
 * Out: { gym: 'progress', rec, view, training, epoch } (rec without the learner's state)
 *      { gym: 'save', rec, epoch } (with it) · { gym: 'reply', req, frames | move | view | items | verdict | exact | error }
 *      { gym: 'error', id, message, epoch } (training itself failed and stopped)
 */
import { benchItems, gymCheck, gymCheckable, judgeItem, type BenchItem } from './bench';
import type { Frame, Verdict } from './core';
import { gameById } from './index';
import { type GymRecord, Session } from './session';

export type GymIn =
  | { gym: 'train'; id: string; rec?: GymRecord | null; epoch?: number }
  | { gym: 'pause' }
  | { gym: 'reset'; id: string; epoch?: number }
  | { gym: 'watch' | 'move' | 'view'; id: string; rec?: GymRecord | null; epoch?: number; req: number; seed?: number; secret?: string; board?: number[] }
  | { gym: 'bench'; req: number }
  | { gym: 'judge'; req: number; id: string; reply: string }
  | { gym: 'exact'; req: number; question: string; reply?: string };

export type GymOut =
  | { gym: 'progress'; rec: GymRecord; view: Frame; training: boolean; epoch: number; event?: 'level' | 'mastered' | null }
  | { gym: 'save'; rec: GymRecord; epoch: number }
  | { gym: 'reply'; req: number; frames?: Frame[]; move?: number; view?: Frame; items?: BenchItem[]; verdict?: Verdict | null; exact?: { label: string; kind: 'verifier' | 'key' } | null; error?: string }
  | { gym: 'error'; id: string; message: string; epoch: number };

interface Live {
  s: Session;
  epoch: number;
}

const sessions = new Map<string, Live>();
let active: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let perUnit = 1;
let lastMeasure = 0;
let measureGap = 1500;
let lastSave = 0;

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** The live session for a game at this epoch (a newer epoch replaces an older session: the game was reset). */
function live(id: string, rec: GymRecord | null | undefined, epoch = 0): Live {
  let l = sessions.get(id);
  if (!l || l.epoch < epoch) {
    const game = gameById(id);
    if (!game) throw new Error(`no game ${id}`);
    if (active === id) active = null;
    l = { s: new Session(game, rec), epoch };
    sessions.set(id, l);
  }
  return l;
}

const meta = (s: Session): GymRecord => ({ ...s.rec, saved: null });

function progress(post: (m: GymOut) => void, l: Live, event: 'level' | 'mastered' | null = null) {
  post({ gym: 'progress', rec: meta(l.s), view: l.s.learner.view(), training: active === l.s.game.id, epoch: l.epoch, event });
}

/** Measure, and space the next measurement by how long this one took. */
function measure(l: Live): 'level' | 'mastered' | null {
  const t = now();
  const ev = l.s.measure();
  const took = now() - t;
  lastMeasure = now();
  // While a match is being played (in slices), measuring gets a fair share of the worker: a slice every
  // ~¼ s instead of every 1½ s, so a match does not take all day.
  measureGap = l.s.pending ? Math.max(250, 2 * took) : Math.max(1500, 5 * took);
  return ev;
}
let lastProgress = 0;

function tick(post: (m: GymOut) => void) {
  timer = null;
  if (!active) return;
  const l = sessions.get(active);
  if (!l) return;
  try {
    const t0 = now();
    while (now() - t0 < 50) {
      const n = Math.max(1, Math.min(100_000, Math.round(15 / perUnit)));
      const a = now();
      const k = l.s.train(n);
      if (!k) break;
      perUnit = 0.7 * perUnit + 0.3 * Math.max(0.0005, (now() - a) / k);
    }
    if (now() - lastMeasure > measureGap) {
      const ev = measure(l);
      if (ev) perUnit = 1;
      if (l.s.rec.mastered) active = null;
      // (Slices of a match come quickly: the page hears about them every 1½ s.)
      if (ev || !l.s.pending || now() - lastProgress > 1500 || !active) {
        lastProgress = now();
        progress(post, l, ev);
      }
      if (ev) {
        lastSave = now();
        post({ gym: 'save', rec: l.s.snapshot(), epoch: l.epoch });
      }
    }
    if (now() - lastSave > 8000) {
      lastSave = now();
      post({ gym: 'save', rec: l.s.snapshot(), epoch: l.epoch });
    }
  } catch (e) {
    post({ gym: 'error', id: active ?? '', message: String((e as Error)?.message ?? e), epoch: l.epoch });
    active = null;
    return;
  }
  if (active) timer = setTimeout(() => tick(post), 8);
}

export function gymMessage(m: GymIn, post: (m: GymOut) => void): void {
  // The offline brain's report card and THINK HARDER (gym/bench.ts): quick, answered at once.
  if (m.gym === 'bench' || m.gym === 'judge' || m.gym === 'exact') {
    try {
      if (m.gym === 'bench') post({ gym: 'reply', req: m.req, items: benchItems() });
      else if (m.gym === 'judge') post({ gym: 'reply', req: m.req, verdict: judgeItem(m.id, m.reply) });
      else if (m.reply == null) post({ gym: 'reply', req: m.req, exact: gymCheckable(m.question) });
      else {
        const g = gymCheck(m.question, m.reply);
        post({ gym: 'reply', req: m.req, exact: g && { label: g.label, kind: g.kind }, verdict: g?.verdict ?? null });
      }
    } catch (e) {
      post({ gym: 'reply', req: m.req, error: String((e as Error)?.message ?? e) });
    }
    return;
  }
  if (m.gym === 'watch' || m.gym === 'move' || m.gym === 'view') {
    try {
      const l = live(m.id, m.rec, m.epoch);
      if (m.gym === 'view') post({ gym: 'reply', req: m.req, view: l.s.learner.view() });
      else if (m.gym === 'watch') post({ gym: 'reply', req: m.req, frames: l.s.learner.watch(m.seed ?? Date.now() % 100000, m.secret) });
      else post({ gym: 'reply', req: m.req, move: l.s.learner.move?.(m.board ?? []) ?? -1 });
    } catch (e) {
      post({ gym: 'reply', req: m.req, error: String((e as Error)?.message ?? e) });
    }
    return;
  }
  if (m.gym === 'train') {
    let l: Live;
    try {
      l = live(m.id, m.rec, m.epoch);
    } catch (e) {
      post({ gym: 'error', id: m.id, message: String((e as Error)?.message ?? e), epoch: m.epoch ?? 0 });
      return;
    }
    if (active && active !== m.id) {
      const prev = sessions.get(active);
      if (prev) post({ gym: 'save', rec: prev.s.snapshot(), epoch: prev.epoch });
    }
    active = l.s.rec.mastered ? null : m.id;
    perUnit = 1;
    lastMeasure = now();
    measureGap = 1500;
    lastSave = now();
    progress(post, l);
    if (active && !timer) timer = setTimeout(() => tick(post), 0);
  } else if (m.gym === 'pause') {
    // Just stop and keep what he knows: no measuring first (the app may be on its way out).
    const l = active ? sessions.get(active) : null;
    active = null;
    if (l) {
      progress(post, l);
      post({ gym: 'save', rec: l.s.snapshot(), epoch: l.epoch });
    }
  } else if (m.gym === 'reset') {
    if (active === m.id) active = null;
    sessions.delete(m.id);
  }
}
