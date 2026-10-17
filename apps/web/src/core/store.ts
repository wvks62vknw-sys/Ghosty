/**
 * A minimal reactive store: get(), set(partial), subscribe(fn).
 * The render loop reads stores directly with get() (no subscription needed), and UI
 * code subscribes to repaint when something changes.
 */
export type Listener<T> = (state: T, prev: T) => void;

export interface Store<T extends object> {
  get(): T;
  set(patch: Partial<T> | ((s: T) => Partial<T>)): void;
  subscribe(fn: Listener<T>): () => void;
}

/**
 * `persist`: kept in localStorage under this name; `keys`: only these fields; `save`: what is
 * written, worked out from the state each time (e.g. leaving out what must not be kept).
 */
export function createStore<T extends object>(initial: T, opts: { persist?: string; keys?: (keyof T)[]; save?: (s: T) => Partial<T> } = {}): Store<T> {
  let state = initial;
  if (opts.persist) {
    try {
      const saved = JSON.parse(localStorage.getItem(opts.persist) ?? 'null') as Partial<T> | null;
      if (saved) state = { ...state, ...saved };
    } catch {
      /* storage unavailable: run with defaults */
    }
  }
  const subs = new Set<Listener<T>>();
  let saveTimer = 0;
  const save = () => {
    if (!opts.persist) return;
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      try {
        const out = opts.save ? opts.save(state) : opts.keys ? Object.fromEntries(opts.keys.map((k) => [k, state[k]])) : state;
        localStorage.setItem(opts.persist!, JSON.stringify(out));
      } catch {
        /* ignore */
      }
    }, 200);
  };
  return {
    get: () => state,
    set(patch) {
      const prev = state;
      const p = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...p };
      save();
      for (const fn of [...subs]) {
        try {
          fn(state, prev);
        } catch (e) {
          console.error(e);
        }
      }
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

/** A simple named-event emitter. */
export class Emitter<E extends Record<string, unknown>> {
  private h = new Map<keyof E, Set<(d: never) => void>>();
  on<K extends keyof E>(e: K, fn: (d: E[K]) => void): () => void {
    if (!this.h.has(e)) this.h.set(e, new Set());
    this.h.get(e)!.add(fn as (d: never) => void);
    return () => this.h.get(e)!.delete(fn as (d: never) => void);
  }
  emit<K extends keyof E>(e: K, d: E[K]): void {
    for (const fn of [...(this.h.get(e) ?? [])]) {
      try {
        (fn as (d: E[K]) => void)(d);
      } catch (x) {
        console.error(String(e), x);
      }
    }
  }
}
