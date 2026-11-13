/**
 * CRASH RECORDS, NEVER A BLANK (BRIEF-RELIABILITY 4; STARS 90): the owner never sees a stack trace, a blank or a frozen spinner.
 * window.onerror and unhandledrejection, the service worker's failed fetches of the app's own files, a screen's mount that throws,
 * and a frame that stays frozen over two seconds on a screen that draws each write a record on this phone (the last 40: the time, the
 * screen, the error's kind and his words for it; the raw text goes to the WHY trail only, ui/hisWords.ts) and put his words where the
 * blank would have been:
 *   a screen's mount failing     "This screen fell over. RELOAD IT." in the room's own frame, with RELOAD IT and HOME
 *   a frozen draw                "Still drawing…" after two seconds, "This stopped. RELOAD IT." after eight
 * SYSTEM → HEALTH lists the records ("No crashes this week." or each: the screen, the hour, his words) with THAT FELT OFF.
 *
 * A screen that draws tells this file it is drawing (`draws(screen, true)`) and beats once a frame (`beat(screen)`); the watchdog
 * only looks at the screen he is on, with the page showing.
 */
import { h } from './dom';
import { createStore } from './store';
import { kindOf, sayError, type ErrorKind } from '../ui/hisWords';
import { ui } from '../state/app';

export type CrashKind = ErrorKind | 'frozen';
export interface CrashRecord {
  id: string;
  at: number;
  screen: string;
  kind: CrashKind;
  /** His words for it. Never the raw text. */
  words: string;
}

export const MAX_RECORDS = 40;
export const crashes = createStore({ list: [] as CrashRecord[] }, { persist: 'ghosty.crashes' });

let lastKey = '';
let lastAt = 0;
/** Write a record (the same thing within five seconds is one record). Returns his words for it. */
export function record(e: unknown, what: string, screen = ui.get().tab, kind?: CrashKind): string {
  const words = sayError(e, what);
  const k = kind ?? kindOf(e);
  const key = `${screen}|${k}|${what}`;
  const now = Date.now();
  if (key === lastKey && now - lastAt < 5000) return words;
  lastKey = key;
  lastAt = now;
  const r: CrashRecord = { id: now.toString(36) + Math.random().toString(36).slice(2, 5), at: now, screen, kind: k, words };
  crashes.set((s) => ({ list: [...(Array.isArray(s.list) ? s.list : []), r].slice(-MAX_RECORDS) }));
  return words;
}

/** The records of the last seven days, newest first. */
export const thisWeek = (now = Date.now()): CrashRecord[] => (Array.isArray(crashes.get().list) ? crashes.get().list : []).filter((r) => now - r.at <= 7 * 86_400_000).reverse();

// ---------------------------------------------------------------- a screen that fell over

/** The room's own frame in place of a screen whose mount threw: his words, RELOAD IT and HOME, never white. */
export function fallenFrame(root: HTMLElement, screen: string, e: unknown): void {
  record(e, 'open that screen', screen, 'rest');
  root.replaceChildren(
    h('div.fallen', { role: 'alert', dataset: { case: 'keep', fallen: screen } },
      h('p.g-truth', 'This screen fell over.'),
      h('p.fallenwords', { dataset: { case: 'keep' } }, 'This screen fell over. RELOAD IT.'),
      h('div.row.wrap',
        h('button.on.fallenreload', { type: 'button', onclick: () => location.reload() }, 'RELOAD IT'),
        h('button.fallenhome', { type: 'button', onclick: () => void import('../shell/tabs').then((t) => t.go('core')) }, 'HOME'))),
  );
}

/** For the checks: make the next mount of this screen throw (only under a test runner). */
export const hook = (screen: string): boolean => {
  const w = globalThis as { __ghostyCrashIn?: string };
  return typeof navigator !== 'undefined' && navigator.webdriver === true && w.__ghostyCrashIn === screen;
};

// ---------------------------------------------------------------- a frame that stays frozen

const drawn = new Map<string, { on: boolean; at: number }>();
/** A screen that draws says so when its loop starts and stops. */
export function draws(screen: string, on: boolean): void {
  drawn.set(screen, { on, at: performance.now() });
  if (on) ensureWatch();
  else clearStall(screen);
}
/** Once a frame. */
export function beat(screen: string): void {
  const d = drawn.get(screen);
  if (d) d.at = performance.now();
  else drawn.set(screen, { on: true, at: performance.now() });
}

const STILL_MS = 2000;
const STOPPED_MS = 8000;
const stalls = new Map<string, { el: HTMLElement; stage: 0 | 1 | 2 }>();
function clearStall(screen: string): void {
  const s = stalls.get(screen);
  if (!s) return;
  s.el.remove();
  stalls.delete(screen);
}
let watching = 0;
function ensureWatch(): void {
  if (watching || typeof window === 'undefined') return;
  watching = window.setInterval(() => {
    const now = performance.now();
    const tab = ui.get().tab;
    for (const [screen, d] of drawn) {
      const here = d.on && tab === screen && document.visibilityState === 'visible';
      const gap = now - d.at;
      if (!here || gap < STILL_MS) {
        clearStall(screen);
        continue;
      }
      const root = document.getElementById(`pg-${screen}`);
      if (!root) continue;
      let s = stalls.get(screen);
      if (!s) {
        s = { el: h('div.stalled', { role: 'status', 'aria-live': 'polite', dataset: { case: 'keep', stall: screen } }, h('p.g-truth.stalledline', { dataset: { wait: 'Still drawing…', case: 'keep' } }, 'Still drawing…')), stage: 1 };
        root.append(s.el);
        stalls.set(screen, s);
      }
      if (gap >= STOPPED_MS && s.stage < 2) {
        s.stage = 2;
        record(new Error('the frame stopped'), 'draw that', screen, 'frozen');
        s.el.replaceChildren(
          h('p.g-truth.stalledline', { dataset: { case: 'keep' } }, 'This stopped. RELOAD IT.'),
          h('div.row.wrap',
            h('button.on.fallenreload', { type: 'button', onclick: () => location.reload() }, 'RELOAD IT'),
            h('button.fallenhome', { type: 'button', onclick: () => void import('../shell/tabs').then((t) => t.go('core')) }, 'HOME')),
        );
      }
    }
  }, 500);
}

// ---------------------------------------------------------------- the net: errors nobody caught

const NOISE = /ResizeObserver loop|^Script error\.?$|Non-Error promise rejection/i;
let installed = false;
export function installCrashNet(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  addEventListener('error', (ev) => {
    // a picture or a script that did not load is an element's event, not a thrown error: not a crash
    if (ev.target && ev.target !== window) return;
    if (NOISE.test(ev.message ?? '')) return;
    record(ev.error ?? ev.message, 'do that');
  });
  addEventListener('unhandledrejection', (ev) => {
    const msg = (ev.reason as { message?: string } | undefined)?.message ?? String(ev.reason ?? '');
    if (NOISE.test(msg)) return;
    record(ev.reason, 'do that');
  });
  // the service worker could not fetch one of the app's own files (public/sw.js tells the pages)
  try {
    navigator.serviceWorker?.addEventListener('message', (ev: MessageEvent) => {
      const d = ev.data as { ghosty?: string; path?: string } | null;
      if (d?.ghosty === 'fetch-failed') record(new Error('failed to fetch'), 'load one of my own files');
    });
  } catch {
    /* no service worker here */
  }
}

/** For the checks (window.__ghosty.crash). */
export const crashCheck = () => ({ records: crashes.get().list, week: thisWeek().length });
