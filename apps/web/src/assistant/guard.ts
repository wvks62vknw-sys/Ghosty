/**
 * THE GUARDIAN on the phone (OWNER-ISSUES 55, 56, 60; apps/edge/src/walk.ts runs the clock):
 *
 *  - his PANIC PHRASE, read before anything else he types or says: the message goes to his named person at once, with
 *    where he is when the phone already may say so (never a permission prompt in a hurry). Nothing of it shows in the
 *    chat or goes to the model: one quiet "Sent." The phone keeps only a keyed hash of the phrase (Settings → GUARDIAN).
 *  - WALK ME HOME: "walk me home" takes one position fix (the browser asks the first time: that is his yes) and the
 *    walking time to his saved home, or asks "How long?". While the walk is under way and Ghosty is open, the phone
 *    watches his position and sends the brain only the last one, at most once a minute — dropped when the walk ends.
 *    "Home?" (the brain's, at the ETA) shows as a bar with I'M HOME; the second time it is said aloud. "Home", "yes" or
 *    the tap ends it.
 * session.ts calls `guardTurn` first in send(); the replies are ordinary chat entries marked as needing no model.
 */
import { brain } from '../api/brain';
import { h } from '../core/dom';
import { guardian, loadGuardian, setGuardian } from '../state/guardian';
import { button, toast } from '../ui/components';
import { homeSaid, minutesIn, panicSaid, walkCancelled, walkStart, type PanicSecret, type WalkInfo } from '../../../../packages/shared/src/guardian';
import { chat, type Entry } from './session';
import { speak } from './voice';

/** This phone's copy of the panic phrase's hash (never the words), for a cold start before the brain answers. */
const PANIC_KEY = 'ghosty.guardian.panic';
/** He let this phone use where he is for a walk (the browser's yes, given once). */
const POS_KEY = 'ghosty.guardian.pos';
const MIN = 60_000;

const DIRECT = 'Direct · no AI';
let lastStamp = 0;
const stamp = () => (lastStamp = Math.max(Date.now(), lastStamp + 1));

function store(k: string, v: string | null): void {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* no storage: kept for this visit only */
  }
}
function stored(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

/** The panic secret: the brain's last word, else this phone's copy. */
function panicHere(): PanicSecret | null {
  const fromBrain = guardian.get().info?.panic;
  if (fromBrain !== undefined && guardian.get().at) return fromBrain;
  try {
    return JSON.parse(stored(PANIC_KEY) ?? 'null') as PanicSecret | null;
  } catch {
    return null;
  }
}

// What the brain says (state/guardian.ts): this phone's copy of the panic hash, the bar and the watch follow.
guardian.subscribe((s) => {
  if (!s.info) return;
  store(PANIC_KEY, s.info.panic ? JSON.stringify(s.info.panic) : null);
  syncWalk();
});

const walking = (w: WalkInfo | null | undefined): w is WalkInfo => !!w && w.stage !== 'done';

// ---------------------------------------------------------------- where he is (a walk only)

/** One fix: only when he already allowed it, unless `ask` (his "walk me home", which may bring up the browser's question). */
async function onePos(ask: boolean, wait = 6000): Promise<{ lat: number; lon: number } | null> {
  if (!navigator.geolocation) return null;
  if (!ask) {
    const st = await navigator.permissions?.query({ name: 'geolocation' as PermissionName }).catch(() => null);
    if (st?.state !== 'granted' && stored(POS_KEY) !== '1') return null;
  }
  return new Promise((ok) => {
    const timer = setTimeout(() => ok(null), wait + 500);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(timer);
        store(POS_KEY, '1');
        ok({ lat: p.coords.latitude, lon: p.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        ok(null);
      },
      { enableHighAccuracy: true, timeout: wait, maximumAge: 30_000 },
    );
  });
}

let watchId = -1;
let sent = { at: 0, lat: 0, lon: 0 };
const metres = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const r = Math.PI / 180;
  const x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.hypot(x, y) * 6_371_000;
};
let poll = 0;

/** While a walk is under way and Ghosty is open: his position watched (the last one to the brain, once a minute at most), the walk looked at every 30 s. */
function syncWalk(): void {
  const w = guardian.get().info?.walk;
  const on = walking(w) && document.visibilityState === 'visible';
  if (on && watchId < 0 && navigator.geolocation && stored(POS_KEY) === '1') {
    watchId = navigator.geolocation.watchPosition(
      (p) => {
        const here = { lat: p.coords.latitude, lon: p.coords.longitude };
        if (Date.now() - sent.at < MIN && metres(sent, here) < 50) return;
        sent = { at: Date.now(), ...here };
        void brain.walkPos(here).catch(() => undefined);
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 15_000 },
    );
  }
  if (!on && watchId >= 0) {
    navigator.geolocation.clearWatch(watchId);
    watchId = -1;
  }
  if (on && !poll) poll = window.setInterval(() => void loadGuardian(), 30_000);
  if (!on && poll) {
    clearInterval(poll);
    poll = 0;
  }
  paintBar(w ?? null);
}

// ---------------------------------------------------------------- "Home?"

let bar: HTMLElement | null = null;
let spokenFor = '';
/** The bar while "Home?" is asked: I'M HOME ends the walk; the second "Home?" is said aloud, once. */
function paintBar(w: WalkInfo | null): void {
  const asking = !!w && (w.stage === 'asked' || w.stage === 'asked2' || w.stage === 'alerted');
  if (!asking) {
    bar?.remove();
    bar = null;
    return;
  }
  if (!bar) {
    bar = h('div#walkask', { role: 'alert' }, h('span'), button("I'M HOME", () => void endWalk('home', "I'm home"), 'warn'));
    document.body.append(bar);
  }
  (bar.firstChild as HTMLElement).textContent = w.stage === 'alerted' ? 'Home? I messaged your named person.' : 'Home?';
  if (w.stage === 'asked2' && spokenFor !== w.id) {
    spokenFor = w.id;
    void speak('Are you home?', { here: true }).catch(() => undefined);
  }
}

// ---------------------------------------------------------------- his words

function show(text: string, reply: string, voice: boolean): void {
  const add = (e: Entry) => chat.set((s) => ({ entries: [...s.entries, e].slice(-120) }));
  add({ kind: 'user', text, at: stamp() });
  add({ kind: 'assistant', text: reply, at: stamp(), model: DIRECT });
  chat.set({ live: reply });
  if (voice) void speak(reply).catch(() => undefined);
}

/** "How long?" was asked here: a number of minutes in the next ten minutes starts the walk. */
let askedAt = 0;

async function endWalk(how: 'home' | 'cancelled', text: string, voice = false): Promise<void> {
  try {
    const r = await brain.walkEnd(how);
    const info = guardian.get().info;
    if (info) setGuardian({ ...info, walk: r.walk });
    show(text, r.said, voice);
  } catch (e) {
    toast(`I couldn't reach my brain to end the walk: ${String((e as Error)?.message ?? e).slice(0, 120)}`, 'bad');
  }
}

async function begin(text: string, minutes: number | null, voice: boolean): Promise<void> {
  const from = minutes ? null : await onePos(true);
  try {
    const r = await brain.walkStart({ ...(minutes ? { minutes } : {}), ...(from ? { from } : {}) });
    if ('ask' in r) {
      askedAt = Date.now();
      show(text, r.ask, voice);
      return;
    }
    askedAt = 0;
    show(text, r.said, voice);
    await loadGuardian();
  } catch (e) {
    show(text, `I couldn't start the walk: my brain can't be reached (${String((e as Error)?.message ?? e).slice(0, 100)}). Tell someone you're on your way.`, voice);
  }
}

/**
 * His words, before anything else reads them (session.ts send): the panic phrase, then the walk home's. true: handled
 * here (the model never sees them).
 */
export async function guardTurn(text: string, opts: { voice?: boolean } = {}): Promise<boolean> {
  const voice = !!opts.voice;
  const secret = panicHere();
  if (secret && (await panicSaid(text, secret))) {
    const pos = await onePos(false, 2500);
    const r = await brain.panic(pos ?? undefined).catch((e: unknown) => ({ sent: false, why: String((e as Error)?.message ?? e).slice(0, 100) }));
    toast(r.sent ? 'Sent.' : `It couldn't go: ${r.why}`, r.sent ? 'ok' : 'bad');
    return true;
  }
  const w = guardian.get().info?.walk;
  // before "Home?" is asked, only "home" said plainly ends it: a bare "ok" or "yes" about something else never does
  if (walking(w) && homeSaid(text, w.stage !== 'walking')) {
    await endWalk('home', text, voice);
    return true;
  }
  if (walking(w) && walkCancelled(text)) {
    await endWalk('cancelled', text, voice);
    return true;
  }
  const start = walkStart(text);
  if (start) {
    if (walking(w) && !start.minutes) {
      const at = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(w.eta);
      show(text, `I'm already walking you home: I'll ask at ${at}. Say "home" when you're in.`, voice);
      return true;
    }
    await begin(text, start.minutes, voice);
    return true;
  }
  if (askedAt && Date.now() - askedAt < 10 * MIN) {
    const m = minutesIn(text);
    if (m) {
      await begin(text, m, voice);
      return true;
    }
  }
  return false;
}

// put away: the watch stops (it starts again when Ghosty is back in front and the walk is looked at)
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && syncWalk());
