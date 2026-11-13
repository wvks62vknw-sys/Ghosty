/**
 * Notifications from the brain (reminders, results of scheduled tasks). While Ghosty is
 * open it checks the inbox every 45 seconds and shows anything new as a toast, speaks
 * short reminders, and (if allowed) raises a system notification when the tab is hidden.
 *
 * [talk] What is said waits its turn (BRIEF-TALK-1A; OWNER-ISSUES 123): a notice is read out only once the boot and its
 * greeting are over, nothing else is being said, no turn is at work and the microphone is closed; several are said one
 * after another, never one over another, oldest first. A reply he asks for while one is being read cuts it (voice.ts: the
 * newest speech wins), and it is not read again: the toast and the Agenda inbox keep it. One that finds no quiet moment in
 * half a minute (a conversation under way) is dropped the same way.
 */
import type { InboxEntry } from '../../../../packages/shared/src/protocol';
import { brain } from '../api/brain';
import { createStore } from '../core/store';
import { bootState } from '../shell/boot';
import { settings, ui } from '../state/app';
import { toast } from '../ui/components';
import { speak } from './voice';

export const inbox = createStore({ items: [] as InboxEntry[], unread: 0 });

// What was already announced, by id (the last 300). A time watermark was the record before: one item stamped ahead of the
// clock (a piece set for the morning) raised it past everything that arrived before that time, and those were never announced.
const SEEN = 'ghosty.inbox.seen.ids';
const seen = {
  get(): Set<string> {
    try {
      const v = JSON.parse(localStorage.getItem(SEEN) ?? '[]');
      return new Set(Array.isArray(v) ? v.map(String) : []);
    } catch {
      return new Set();
    }
  },
  add(ids: string[]) {
    if (!ids.length) return;
    try {
      localStorage.setItem(SEEN, JSON.stringify([...seen.get(), ...ids].slice(-300)));
    } catch {
      /* ignore */
    }
  },
};

let first = true;

export async function pollInbox(): Promise<void> {
  try {
    const r = await brain.inbox();
    inbox.set({ items: r.items, unread: r.unread });
    const had = seen.get();
    const fresh = r.items.filter((i) => !i.read && !had.has(i.id)).reverse();
    seen.add(fresh.map((i) => i.id));
    // On first load only announce things from the last 10 minutes.
    // A kind switched off in LINKS → NOTIFICATIONS comes marked quiet: it stays in the Agenda inbox, with no toast, voice or notification.
    for (const it of (first ? fresh.filter((i) => Date.now() - i.at < 10 * 60_000) : fresh).filter((i) => !i.quiet)) announce(it);
    first = false;
  } catch {
    /* offline: try again next round */
  }
}

function announce(it: InboxEntry): void {
  const head = it.kind === 'reminder' ? '⏰ REMINDER' : it.kind === 'task' ? `✦ ${it.title.toUpperCase()}` : `⚠ ${it.title.toUpperCase()}`;
  // The pop-up shows the start (three lines at most); a tap opens the whole notification.
  toast(`${head}: ${it.text.slice(0, 220)}`, it.kind === 'error' ? 'warn' : 'ok', { title: it.kind === 'reminder' ? 'REMINDER' : it.title.toUpperCase(), full: `${head}: ${it.text}` });
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(it.kind === 'reminder' ? 'Ghosty reminder' : `Ghosty · ${it.title}`, { body: it.text.slice(0, 300), tag: it.id, icon: '/icon-192.png' });
    } catch {
      /* some browsers only allow notifications from a service worker */
    }
  }
  if (settings.get().speak && !document.hidden) say(it.kind === 'reminder' ? `Reminder: ${it.text}` : `${it.title}. ${it.text}`.slice(0, 400));
  // [cards] a piece of the day — a reminder, the morning, a warning near his places — as its card in the chat (BRIEF-SIDEWAYS 2c)
  const card = it.card;
  if (card) void import('../features/core/cards').then((c) => c.dayCard(card)).catch(() => undefined);
}

// ---------------------------------------------------------------- said in turn, in a quiet moment

/** How long a notice waits for a quiet moment before it is left to the toast and the inbox. */
const WAIT_MS = 30_000;
/** What is still to be said, oldest first. */
const queue: string[] = [];
let draining = false;

/**
 * A quiet moment: the boot and its greeting over (a cold open's greeting may wait for his first tap: so does this), nothing
 * being said or heard, no turn at work. (The boot's state is not a store: `turn` looks again every quarter second.)
 */
function quiet(): boolean {
  const u = ui.get();
  return (bootState.phase === '' || bootState.phase === 'done') && bootState.spoken !== 'waiting' && u.voice === 'idle' && !u.busy;
}

/** Resolves true at the next quiet moment, false when none comes within WAIT_MS. */
function turn(): Promise<boolean> {
  if (quiet()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const t0 = Date.now();
    let over = false;
    const done = (ok: boolean) => {
      if (over) return;
      over = true;
      off();
      clearInterval(tick);
      resolve(ok);
    };
    const look = () => {
      if (quiet()) done(true);
      else if (Date.now() - t0 > WAIT_MS) done(false);
    };
    const off = ui.subscribe(look);
    const tick = setInterval(look, 250);
  });
}

/** [lifeeasier] A quiet moment for something said by itself (the Brief read aloud on the first open): true at the next one, false when none comes in half a minute. */
export const whenQuiet = (): Promise<boolean> => turn();

/** A notice to be read out: queued behind whatever is being said, and said at the next quiet moment. */
function say(text: string): void {
  queue.push(text);
  if (draining) return;
  draining = true;
  void (async () => {
    try {
      while (queue.length) {
        if (!(await turn())) {
          queue.length = 0; // (no quiet moment in half a minute: he is talking with Ghosty; the toast and the inbox have them)
          return;
        }
        const next = queue.shift()!;
        if (!settings.get().speak || document.hidden) continue;
        // (cut by a reply he asked for meanwhile: speak settles at once, and the notice is not said again)
        await speak(next).catch(() => undefined);
      }
    } finally {
      draining = false;
    }
  })();
}

export function startNotices(): void {
  void pollInbox();
  setInterval(() => {
    if (!document.hidden) void pollInbox();
  }, 45_000);
  // Hidden tabs still check, less often, so system notifications can appear.
  setInterval(() => {
    if (document.hidden) void pollInbox();
  }, 120_000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void pollInbox();
  });
  inbox.subscribe((s) => {
    const b = document.querySelector<HTMLElement>('#dock button[data-id="agenda"]');
    if (b) b.dataset.badge = s.unread ? String(Math.min(99, s.unread)) : '';
  });
}
