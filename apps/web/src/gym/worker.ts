/**
 * The GYM's side of the Web Worker: training runs here so the page never freezes. It is bundled into the
 * existing worker file (workers/textures.worker.ts hands every `{ gym }` message to `gymMessage`), because
 * the build's worker list is a protected file; the page starts its own instance of that worker for the
 * GYM. One game trains at a time, in slices of ~50 ms with a pause between them (messages get through,
 * the phone stays cool); it is measured every ~1.5 s and its full state is posted every ~8 s for the
 * page to keep in IndexedDB.
 *
 * In:  { gym: 'train', id, rec } · { gym: 'pause' } · { gym: 'reset', id }
 *      { gym: 'watch' | 'move' | 'view', id, rec, req, seed?, secret?, board? }
 * Out: { gym: 'progress', rec, view, training } (rec without the learner's state)
 *      { gym: 'save', rec } (with it) · { gym: 'reply', req, frames | move | view } · { gym: 'error', id, message }
 */
import type { Frame } from './core';
import { gameById } from './index';
import { type GymRecord, Session } from './session';

export type GymIn =
  | { gym: 'train'; id: string; rec?: GymRecord | null }
  | { gym: 'pause' }
  | { gym: 'reset'; id: string }
  | { gym: 'watch' | 'move' | 'view'; id: string; rec?: GymRecord | null; req: number; seed?: number; secret?: string; board?: number[] };

export type GymOut =
  | { gym: 'progress'; rec: GymRecord; view: Frame; training: boolean; event?: 'level' | 'mastered' | null }
  | { gym: 'save'; rec: GymRecord }
  | { gym: 'reply'; req: number; frames?: Frame[]; move?: number; view?: Frame }
  | { gym: 'error'; id: string; message: string };

const sessions = new Map<string, Session>();
let active: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let perUnit = 1;
let lastMeasure = 0;
let lastSave = 0;

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function session(id: string, rec?: GymRecord | null): Session {
  let s = sessions.get(id);
  if (!s) {
    const game = gameById(id);
    if (!game) throw new Error(`no game ${id}`);
    s = new Session(game, rec);
    sessions.set(id, s);
  }
  return s;
}

const meta = (s: Session): GymRecord => ({ ...s.rec, saved: null });

function progress(post: (m: GymOut) => void, s: Session, event: 'level' | 'mastered' | null = null) {
  post({ gym: 'progress', rec: meta(s), view: s.learner.view(), training: active === s.game.id, event });
}

function tick(post: (m: GymOut) => void) {
  timer = null;
  if (!active) return;
  const s = sessions.get(active);
  if (!s) return;
  try {
    const t0 = now();
    while (now() - t0 < 50) {
      const n = Math.max(1, Math.min(100_000, Math.round(15 / perUnit)));
      const a = now();
      const k = s.train(n);
      if (!k) break;
      perUnit = 0.7 * perUnit + 0.3 * Math.max(0.0005, (now() - a) / k);
    }
    const t = now();
    if (t - lastMeasure > 1500) {
      lastMeasure = t;
      const ev = s.measure();
      if (ev) perUnit = 1;
      if (s.rec.mastered) active = null;
      progress(post, s, ev);
      if (ev) {
        lastSave = t;
        post({ gym: 'save', rec: s.snapshot() });
      }
    }
    if (t - lastSave > 8000) {
      lastSave = t;
      post({ gym: 'save', rec: s.snapshot() });
    }
  } catch (e) {
    post({ gym: 'error', id: active ?? '', message: String((e as Error)?.message ?? e) });
    active = null;
    return;
  }
  if (active) timer = setTimeout(() => tick(post), 8);
}

export function gymMessage(m: GymIn, post: (m: GymOut) => void): void {
  try {
    if (m.gym === 'train') {
      const s = session(m.id, m.rec);
      if (active && active !== m.id) {
        const prev = sessions.get(active);
        if (prev) post({ gym: 'save', rec: prev.snapshot() });
      }
      active = s.rec.mastered ? null : m.id;
      perUnit = 1;
      lastMeasure = now();
      lastSave = now();
      progress(post, s);
      if (active && !timer) timer = setTimeout(() => tick(post), 0);
    } else if (m.gym === 'pause') {
      const s = active ? sessions.get(active) : null;
      active = null;
      if (s) {
        s.measure();
        progress(post, s);
        post({ gym: 'save', rec: s.snapshot() });
      }
    } else if (m.gym === 'reset') {
      if (active === m.id) active = null;
      sessions.delete(m.id);
    } else {
      const s = session(m.id, m.rec);
      if (m.gym === 'view') post({ gym: 'reply', req: m.req, view: s.learner.view() });
      else if (m.gym === 'watch') post({ gym: 'reply', req: m.req, frames: s.learner.watch(m.seed ?? Date.now() % 100000, m.secret) });
      else post({ gym: 'reply', req: m.req, move: s.learner.move?.(m.board ?? []) ?? -1 });
    }
  } catch (e) {
    post({ gym: 'error', id: 'id' in m ? m.id : '', message: String((e as Error)?.message ?? e) });
  }
}
