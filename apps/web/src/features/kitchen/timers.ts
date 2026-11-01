/**
 * VOICE TIMERS (BRIEF-PACKS-1 item 3): "timer 8 minutes for the pasta", several at once, each named, on the phone's own
 * clock — kept in this phone's storage by their end times, so a reload carries on. When one ends it rings: a sound
 * (made by the phone, no file), a buzz, the words said, and a card in the chat; it rings for a minute or until STOP.
 * They ring while Ghosty is open (a phone web app cannot ring from the lock screen: a reminder can). The words are read
 * by packages/shared/src/kitchen.ts timerAsked; the brain's kitchen tool sends the same timers here (kitchen_timer).
 */
import { card } from '../../../../../packages/shared/src/cards';
import { mmss, spanWords } from '../../../../../packages/shared/src/kitchen';
import { speakIn } from '../../assistant/voice';
import { toast } from '../../ui/components';

export interface Timer {
  id: string;
  name: string;
  secs: number;
  /** When it rings (ms on this phone's clock). */
  end: number;
  /** Ringing since (ms), or done. */
  ringing?: number;
  done?: boolean;
}

const KEY = 'ghosty:timers';
const RING_MS = 60_000;
let list: Timer[] = load();
let tick = 0;
const listeners = new Set<() => void>();
let audio: AudioContext | null = null;

function load(): Timer[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Timer[];
    return Array.isArray(v) ? v.filter((t) => t && typeof t.end === 'number' && !t.done) : [];
  } catch {
    return [];
  }
}
const keep = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.filter((t) => !t.done)));
  } catch {
    /* private mode: they still run */
  }
};

/** The timers now, with the seconds left on each (for the sheet and the specs: window.__ghosty.kitchen.timers). */
export const timersNow = (now = Date.now()) => list.filter((t) => !t.done).map((t) => ({ id: t.id, name: t.name, left: Math.max(0, Math.ceil((t.end - now) / 1000)), ringing: !!t.ringing }));
export const onTimers = (f: () => void): (() => void) => (listeners.add(f), () => listeners.delete(f));
const changed = () => {
  keep();
  for (const f of listeners) f();
};

export function startTimers(add: { secs: number; name: string }[], now = Date.now()): Timer[] {
  unlockAudio();
  const made = add.map((t) => ({ id: Math.random().toString(36).slice(2, 8), name: t.name || 'timer', secs: t.secs, end: now + t.secs * 1000 }));
  list = [...list.filter((t) => !t.done), ...made];
  run();
  changed();
  return made;
}

/** Stop the timers by name ('' for every one), ringing or not. How many stopped. */
export function stopTimers(name = ''): number {
  const n = name.toLowerCase();
  let k = 0;
  for (const t of list) if (!t.done && (!n || t.name.toLowerCase().includes(n) || n.includes(t.name.toLowerCase()))) (t.done = true), k++;
  list = list.filter((t) => !t.done);
  changed();
  return k;
}
export const stopTimer = (id: string): void => {
  list = list.filter((t) => t.id !== id);
  changed();
};

function run(): void {
  if (tick || !list.length) return;
  tick = window.setInterval(step, 250);
}
function step(): void {
  const now = Date.now();
  for (const t of list) {
    if (t.done) continue;
    if (!t.ringing && now >= t.end) ring(t, now);
    else if (t.ringing && now - t.ringing > RING_MS) t.done = true;
    else if (t.ringing && Math.floor((now - t.ringing) / 2000) !== Math.floor((now - t.ringing - 250) / 2000)) beep();
  }
  const before = list.length;
  list = list.filter((t) => !t.done);
  if (!list.length) {
    clearInterval(tick);
    tick = 0;
  }
  if (before !== list.length) keep();
  for (const f of listeners) f();
}

function ring(t: Timer, now: number): void {
  t.ringing = now;
  beep();
  navigator.vibrate?.([400, 200, 400, 200, 400]);
  const words = `The ${t.name === 'timer' ? 'timer' : `${t.name} timer`} is done: ${spanWords(t.secs)}.`;
  speakIn(words, 'en');
  toast(words, 'ok', { title: 'TIMER' });
  void import('../core/cards')
    .then((m) => m.postCard(card({ id: `kitchen:timer:${t.id}`, kind: 'brief', title: t.name === 'timer' ? 'Timer done' : `${t.name} done`, line: `${spanWords(t.secs)} is up`, brief: { icon: 'reminder' }, acts: [{ label: 'STOP', run: { name: 'kitchen_timer', args: { stop: t.name } } }] })))
    .catch(() => undefined);
}

/** A sound made by the phone (no file to fetch): three short tones. The first tap unlocks it on iOS. */
function unlockAudio(): void {
  try {
    audio ??= new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    void audio.resume().catch(() => undefined);
  } catch {
    audio = null;
  }
}
function beep(): void {
  try {
    unlockAudio();
    const ctx = audio;
    if (!ctx) return;
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.3);
      g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + i * 0.3 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.3 + 0.22);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.3);
      o.stop(ctx.currentTime + i * 0.3 + 0.25);
    }
  } catch {
    /* no sound here: the buzz and the words still come */
  }
}

/** The words for a set of timers just started ("pasta 8:00, rice 12:00"). */
export const startedWords = (made: Timer[]): string => made.map((t) => `${t.name} ${mmss(t.secs)}`).join(', ');

// a reload carries on the timers it kept
if (list.length) run();
