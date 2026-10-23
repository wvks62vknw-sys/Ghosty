/**
 * The phone's stopwatch (SPEED, part 1: measure first, fix the worst after): how long Ghosty
 * takes as the owner sees it. Cold start (from the tap to the first paint and to the first
 * screen), each tab's open time (from `go()` to the first paint after it), each reply from the
 * brain (from sending to the first words and to done) and the brain's round trip (each request
 * in api/brain.ts). Measured with `performance.now()` at the moments themselves, never with
 * timers; nothing runs while Ghosty is idle.
 *
 * Kept in IndexedDB (`ghosty-speed`, the last 500 samples, round trips at most 150 of them),
 * written at most once a minute: when something is timed and the last write is a minute old,
 * or when Ghosty is put away. `stopwatch.summary()` gives the medians and the plain-words lines
 * for the SPEED card (and a test at window.__ghosty.stopwatch).
 */

export type Sample =
  /** A cold start: ms from the tap to the first paint and to the first screen. */
  | { k: 'start'; at: number; paint: number | null; screen: number }
  /** A tab opened (`first`: built for the first time). */
  | { k: 'tab'; at: number; id: string; title: string; ms: number; first?: 1 }
  /** A reply from the brain: to the first words, and to done. */
  | { k: 'reply'; at: number; first: number; done: number }
  /** One request to the brain (`path`: its first part, e.g. "/status"). */
  | { k: 'trip'; at: number; path: string; ms: number };

export interface Stat {
  median: number;
  p90: number;
  n: number;
}
export interface ScreenSpeed {
  id: string;
  title: string;
  median: number;
  n: number;
}
/** What the SPEED card shows from this phone. */
export interface PhoneSpeed {
  replies: { today: { first: Stat | null; done: Stat | null }; week: { first: Stat | null; done: Stat | null } };
  screens: ScreenSpeed[];
  start: { paint: Stat | null; screen: Stat | null };
  trip: Stat | null;
  /** The slowest kind of request (by its median), when there are a few kinds. */
  slowTrip: { path: string; median: number } | null;
  lines: string[];
  samples: number;
}

export const KEEP = 500;
export const KEEP_TRIPS = 150;
export const SAVE_MS = 60_000;

/** The value with `q` of the samples at or below it (nearest rank): q 0.5 the median, 0.9 the slow end. */
export function quantile(xs: number[], q: number): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))]!;
}
export const stat = (xs: number[]): Stat | null => (xs.length ? { median: quantile(xs, 0.5), p90: quantile(xs, 0.9), n: xs.length } : null);

/** A duration in plain words: "84 ms", "0.6 s", "1.4 s", "12 s", "1 min 5 s". */
export function dur(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 95) return `${Math.round(ms)} ms`;
  if (ms < 9_950) return `${(ms / 1000).toFixed(1)} s`;
  if (ms < 60_000) return `${Math.round(ms / 1000)} s`;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ''}`;
}

/** A tab's title for a sentence: "GOD'S EYE" → "God's Eye" (a word with a digit stays as it is: "3D Studio"). */
export const titleWords = (t: string) =>
  t
    .split(/\s+/)
    .map((w) => (/\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');

const localDay = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/** The medians and lines from a list of samples (pure: the edge tests run it). `now` decides what "today" is. */
export function summarise(samples: Sample[], now = Date.now()): PhoneSpeed {
  const today = localDay(now);
  const weekAgo = now - 7 * 86_400_000;
  const replies = samples.filter((s): s is Extract<Sample, { k: 'reply' }> => s.k === 'reply');
  const mine = replies.filter((r) => localDay(r.at) === today);
  const before = replies.filter((r) => localDay(r.at) !== today && r.at >= weekAgo && r.at < now);
  const tabs = samples.filter((s): s is Extract<Sample, { k: 'tab' }> => s.k === 'tab');
  const byTab = new Map<string, { title: string; ms: number[] }>();
  for (const t of tabs) {
    const e = byTab.get(t.id) ?? { title: t.title, ms: [] };
    e.title = t.title;
    e.ms.push(t.ms);
    byTab.set(t.id, e);
  }
  const screens = [...byTab].map(([id, e]) => ({ id, title: e.title, median: quantile(e.ms, 0.5), n: e.ms.length })).sort((a, b) => b.n - a.n || a.title.localeCompare(b.title));
  const starts = samples.filter((s): s is Extract<Sample, { k: 'start' }> => s.k === 'start');
  const trips = samples.filter((s): s is Extract<Sample, { k: 'trip' }> => s.k === 'trip');
  const byPath = new Map<string, number[]>();
  for (const t of trips) byPath.set(t.path, [...(byPath.get(t.path) ?? []), t.ms]);
  const paths = [...byPath].map(([path, ms]) => ({ path, median: quantile(ms, 0.5) })).sort((a, b) => b.median - a.median);
  const out: PhoneSpeed = {
    replies: {
      today: { first: stat(mine.map((r) => r.first)), done: stat(mine.map((r) => r.done)) },
      week: { first: stat(before.map((r) => r.first)), done: stat(before.map((r) => r.done)) },
    },
    screens,
    start: { paint: stat(starts.map((s) => s.paint).filter((x): x is number => typeof x === 'number')), screen: stat(starts.map((s) => s.screen)) },
    trip: stat(trips.map((t) => t.ms)),
    slowTrip: paths.length > 2 ? paths[0]! : null,
    lines: [],
    samples: samples.length,
  };
  out.lines = phoneLines(out);
  return out;
}

/** The plain-words lines for the SPEED card. */
export function phoneLines(s: PhoneSpeed): string[] {
  const out: string[] = [];
  const { today, week } = s.replies;
  const last = week.first && week.done ? ` · last week ${dur(week.first.median)} / ${dur(week.done.median)}` : '';
  if (today.first && today.done) out.push(`Replies: first word in ${dur(today.first.median)}, done in ${dur(today.done.median)} (today's medians, ${today.done.n} repl${today.done.n === 1 ? 'y' : 'ies'})${last}`);
  else if (last) out.push(`Replies: none timed yet today${last}`);
  if (s.screens.length) {
    const shown = s.screens.slice(0, 6);
    const slowest = shown.length > 1 ? shown.reduce((a, b) => (b.median > a.median ? b : a)) : null;
    out.push(`Screens: ${shown.map((x, i) => `${titleWords(x.title)}${i ? '' : ' opens in'} ${dur(x.median)}${x === slowest ? ' (slowest)' : ''}`).join(', ')}`);
  }
  if (s.start.screen) out.push(`Start: ${s.start.paint ? `first paint ${dur(s.start.paint.median)}, ` : ''}first screen ${dur(s.start.screen.median)} (median of ${s.start.screen.n} start${s.start.screen.n === 1 ? '' : 's'})`);
  if (s.trip) out.push(`Brain round trip ${dur(s.trip.median)}${s.slowTrip ? ` · slowest: ${s.slowTrip.path} ${dur(s.slowTrip.median)}` : ''}`);
  return out;
}

/** Add a sample: the newest 500 kept, round trips (the most frequent) at most 150 of them. */
export function keep(list: Sample[], s: Sample): Sample[] {
  const out = [...list, s];
  let trips = out.filter((x) => x.k === 'trip').length;
  for (let i = 0; trips > KEEP_TRIPS && i < out.length; ) {
    if (out[i]!.k === 'trip') {
      out.splice(i, 1);
      trips--;
    } else i++;
  }
  return out.slice(-KEEP);
}

// ---------------------------------------------------------------------------------------------
// The live stopwatch: samples in memory, IndexedDB at most once a minute.
// ---------------------------------------------------------------------------------------------

const DB = 'ghosty-speed';
const KEY = 'samples';
const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
let samples: Sample[] = [];
let loaded: Promise<void> | null = null;
let dirty = false;
let saved = false;
/** Counted from the page's start: the first write waits a minute (or until Ghosty is put away), so a cold start writes nothing. */
let lastSave = clock();
let opening: Promise<IDBDatabase | null> | null = null;

function idb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  opening ??= new Promise((resolve) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv');
      };
      r.onsuccess = () => {
        const db = r.result;
        db.onversionchange = () => {
          db.close();
          opening = null;
        };
        resolve(db);
      };
      r.onerror = () => resolve(null);
      r.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opening;
}

/** What earlier visits kept (once); what was timed before it arrived comes after it. */
function load(): Promise<void> {
  loaded ??= (async () => {
    const db = await idb();
    if (!db) return;
    const kept = await new Promise<Sample[]>((resolve) => {
      try {
        const req = db.transaction('kv').objectStore('kv').get(KEY);
        req.onsuccess = () => resolve(Array.isArray(req.result) ? (req.result as Sample[]) : []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
    let all = kept.slice(-KEEP);
    for (const s of samples) all = keep(all, s);
    samples = all;
  })();
  return loaded;
}

/** Write when something changed and the last write is a minute old (`away`: Ghosty is being put away; the first write may come sooner). */
async function flush(away = false): Promise<void> {
  if (!dirty) return;
  if (clock() - lastSave < SAVE_MS && !(away && !saved)) return;
  lastSave = clock();
  saved = true;
  await load();
  const db = await idb();
  if (!db) return;
  dirty = false;
  try {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(samples, KEY);
    tx.onerror = () => (dirty = true);
  } catch {
    dirty = true;
  }
}

if (typeof document !== 'undefined') {
  // Put away (another app, the lock button): the last minute's samples are kept. A listener, not a timer.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush(true);
  });
}

function add(s: Sample): void {
  samples = keep(samples, s);
  dirty = true;
  expose();
  void flush();
}

function expose(): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty && !w.__ghosty.stopwatch) w.__ghosty.stopwatch = stopwatch;
}

const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible';
/** Just after the next paint: the frame callback runs before it, the task it queues after it. */
const afterPaint = (fn: () => void) => requestAnimationFrame(() => setTimeout(fn, 0));

let started = false;

export const stopwatch = {
  /** shell/tabs.ts `go()`: call at its start; the returned function at its end (the tab is on screen after the next paint). */
  tab(id: string, title: string, first: boolean): () => void {
    const t0 = clock();
    const cold = !started;
    started = true;
    if (!visible() || typeof requestAnimationFrame === 'undefined') return () => undefined;
    return () =>
      afterPaint(() => {
        if (!visible()) return; // put away meanwhile: the frame waited for the owner, not for Ghosty
        const now = clock();
        add({ k: 'tab', at: Date.now(), id, title, ms: now - t0, ...(first ? { first: 1 as const } : {}) });
        if (cold) {
          const fcp = performance.getEntriesByType?.('paint').find((e) => e.name === 'first-contentful-paint') ?? performance.getEntriesByType?.('paint')[0];
          add({ k: 'start', at: Date.now(), paint: fcp ? Math.round(fcp.startTime) : null, screen: Math.round(now) });
        }
      });
  },

  /** assistant/session.ts: one reply from the brain. `saw(event)` for each streamed event, `end()` when the stream is over. */
  reply(): { saw: (t: string) => void; end: () => void } {
    const t0 = clock();
    let first = 0;
    let done = 0;
    return {
      saw(t) {
        if (t === 'text' && !first) first = clock() - t0;
        if ((t === 'done' || t === 'error') && !done) done = clock() - t0;
      },
      end() {
        // Only a reply with words counts (an approval asked, or an error, is not a reply).
        if (first) add({ k: 'reply', at: Date.now(), first, done: done || clock() - t0 });
      },
    };
  },

  /** api/brain.ts: one request to the brain took `ms`. */
  trip(path: string, ms: number): void {
    add({ k: 'trip', at: Date.now(), path: `/${path.replace(/^\//, '').split(/[/?]/)[0] ?? ''}`, ms: Math.round(ms) });
  },

  /** For the SPEED card: medians per screen, for replies, the start and the round trip, with plain-words lines. */
  async summary(): Promise<PhoneSpeed> {
    await load();
    return summarise(samples);
  },

  /** performance.now(), for the hooks' start times. */
  now: clock,
};
