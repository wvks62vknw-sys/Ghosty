/**
 * Asking Ghosty about a picture: the question and a JPEG data URL go to the brain's normal chat
 * request as `images: [dataUrl]` (feature 3 in the brain). The exchange is also put in the chat
 * history on screen, like any other turn, and on-screen actions the brain asks for still run.
 * Nothing leaves the phone until the owner presses ASK GHOSTY.
 */
import type { ChatEvent } from '../../../../packages/shared/src/protocol';
import { streamEvents } from '../api/brain';
import { offlineContext } from '../api/offline';
import { chat, type Entry } from '../assistant/session';
import { run } from '../commands/registry';
import { passagesFor } from '../library/local';
import { currentTab } from '../shell/tabs';
import { home, settings, timeZone, ui } from '../state/app';

export interface AskResult {
  /** The reply (every text event joined), '' when none came. */
  text: string;
  model: string;
  error: string | null;
  /** The brain could not see the picture (no vision model reachable): offer the on-device description instead. */
  noVision: boolean;
}

/** The brain's own words when no model it can reach sees pictures. */
export const NO_VISION = /can'?t see pictures|no vision model|cannot see (the |this )?(picture|image|photo)/i;

/**
 * What goes with the question as its own fields, which the brain marks as data about the picture
 * (never as the owner's words): `seen` is what the phone's own detector and OCR saw, in plain
 * words; `scan` is text the phone read off a picture with OCR.
 */
export interface AskExtras {
  seen?: string;
  scan?: string;
}

const push = (e: Entry) => chat.set((s) => ({ entries: [...s.entries, e].slice(-120) }));

function context(): Record<string, unknown> {
  const now = new Date();
  return {
    now: now.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    tz: timeZone,
    tab: ui.get().tab,
    name: settings.get().name,
    location: home(),
    screen: currentTab()?.inst.describe?.() ?? '',
  };
}

/**
 * Ask with a picture (a JPEG data URL, ≤ 1024 px) or, with null, in text only. `onEvent` sees
 * every streamed event (for a status line); the result has the whole reply. `extras` ride along
 * as their own fields (the brain's caps: seen 1,500 characters, scan 6,000).
 */
export async function askWithImage(text: string, dataUrl: string | null, onEvent?: (e: ChatEvent) => void, extras: AskExtras = {}): Promise<AskResult> {
  const question = text.trim();
  const out: AskResult = { text: '', model: '', error: null, noVision: false };
  if (!question) return { ...out, error: 'Ask something first' };
  const seen = (extras.seen ?? '').trim().slice(0, 1500);
  const scan = (extras.scan ?? '').trim().slice(0, 6000);
  const recent = chat
    .get()
    .entries.filter((e): e is Extract<Entry, { kind: 'user' | 'assistant' }> => e.kind === 'user' || e.kind === 'assistant')
    .slice(-12)
    .map((e) => ({ role: e.kind, text: e.text.slice(0, 1500) }));
  push({ kind: 'user', text: dataUrl ? `[photo] ${question}` : question, at: Date.now() });
  ui.set({ busy: true, status: dataUrl ? 'looking at the picture…' : 'thinking…' });
  const texts: string[] = [];
  const handle = (ev: ChatEvent) => {
    onEvent?.(ev);
    switch (ev.t) {
      case 'status':
        ui.set({ status: ev.text });
        break;
      case 'text':
        texts.push(ev.text);
        push({ kind: 'assistant', text: ev.text, at: Date.now() });
        chat.set({ live: ev.text });
        break;
      case 'client':
        void run(ev.name, ev.args);
        break;
      case 'approval':
        push({ kind: 'approval', id: ev.id, name: ev.name, reason: ev.reason, args: ev.args, state: 'waiting' });
        break;
      case 'error':
        out.error = ev.message;
        push({ kind: 'error', text: ev.message });
        break;
      case 'done':
        out.model = ev.model;
        chat.set((s) => ({ entries: s.entries.map((e) => (e.kind === 'assistant' && !e.model ? { ...e, model: ev.model } : e)) }));
        break;
    }
  };
  try {
    const library = await passagesFor(question).catch(() => []);
    await streamEvents('/chat', { message: question, context: context(), recent, images: dataUrl ? [dataUrl] : undefined, offline: { ...offlineContext(), library }, ...(seen ? { seen } : {}), ...(scan ? { scan } : {}) }, handle);
  } catch (e) {
    out.error = String((e as Error)?.message ?? e);
    push({ kind: 'error', text: out.error });
  } finally {
    ui.set({ busy: false, status: '' });
  }
  out.text = texts.join('\n\n').trim();
  out.noVision = !!dataUrl && (NO_VISION.test(out.text) || NO_VISION.test(out.error ?? ''));
  return out;
}
