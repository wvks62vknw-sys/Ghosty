/**
 * Notifications from the brain (reminders, results of scheduled tasks). While Ghosty is
 * open it checks the inbox every 45 seconds and shows anything new as a toast, speaks
 * short reminders, and (if allowed) raises a system notification when the tab is hidden.
 */
import type { InboxEntry } from '../../../../packages/shared/src/protocol';
import { brain } from '../api/brain';
import { createStore } from '../core/store';
import { settings } from '../state/app';
import { toast } from '../ui/components';
import { speak } from './voice';

export const inbox = createStore({ items: [] as InboxEntry[], unread: 0 });

const SEEN = 'ghosty.inbox.seen';
const seen = {
  get(): number {
    try {
      return Number(localStorage.getItem(SEEN)) || 0;
    } catch {
      return 0;
    }
  },
  set(v: number) {
    try {
      localStorage.setItem(SEEN, String(v));
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
    const last = seen.get();
    const fresh = r.items.filter((i) => i.at > last && !i.read).reverse();
    if (fresh.length) seen.set(Math.max(...fresh.map((i) => i.at)));
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
  toast(`${head}: ${it.text.slice(0, 220)}`, it.kind === 'error' ? 'warn' : 'ok');
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(it.kind === 'reminder' ? 'Ghosty reminder' : `Ghosty · ${it.title}`, { body: it.text.slice(0, 300), tag: it.id, icon: '/icon-192.png' });
    } catch {
      /* some browsers only allow notifications from a service worker */
    }
  }
  if (settings.get().speak && !document.hidden) void speak(it.kind === 'reminder' ? `Reminder: ${it.text}` : `${it.title}. ${it.text}`.slice(0, 400));
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
