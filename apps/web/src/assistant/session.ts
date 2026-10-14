/**
 * The conversation with Ghosty: sends messages to the brain, turns the streamed events
 * into chat entries, runs on-screen actions the brain asks for, and handles approvals.
 */
import type { ChatEvent } from '../../../../packages/shared/src/protocol';
import { AuthError, brain } from '../api/brain';
import { run } from '../commands/registry';
import { createStore } from '../core/store';
import { currentTab } from '../shell/tabs';
import { home, settings, timeZone, ui } from '../state/app';
import { toast } from '../ui/components';
import { speak, stopListening, stopSpeaking } from './voice';

export type Entry =
  | { kind: 'user'; text: string; at: number }
  | { kind: 'assistant'; text: string; at: number; model?: string }
  | { kind: 'activity'; id: string; label: string; state: 'running' | 'ok' | 'fail'; detail?: string }
  | { kind: 'approval'; id: string; name: string; reason: string; args: Record<string, unknown>; state: 'waiting' | 'approved' | 'declined' }
  | { kind: 'error'; text: string };

export const chat = createStore({ entries: [] as Entry[], live: '' });

const TOOL_LABELS: Record<string, string> = {
  web_search: 'Searching the web',
  web_fetch: 'Reading a page',
  weather: 'Checking the weather',
  earthquakes: 'Checking earthquakes',
  remember: 'Saving to memory',
  forget: 'Updating memory',
  list_memory: 'Recalling memory',
  create_widget: 'Building a widget',
  repo_tree: 'Looking through my code',
  repo_read: 'Reading my code',
  repo_search: 'Searching my code',
  propose_change: 'Writing a change to myself',
  update_change: 'Fixing my change',
  change_status: 'Checking the build',
  ship_change: 'Shipping the change',
  restore_version: 'Rolling back',
};

const label = (name: string, args: Record<string, unknown>) => {
  const base = TOOL_LABELS[name] ?? name.replace(/_/g, ' ');
  const detail = (args.query ?? args.place ?? args.path ?? args.url ?? args.title ?? args.tab ?? '') as string;
  return detail ? `${base}: ${String(detail).slice(0, 60)}` : base;
};

function push(e: Entry): void {
  chat.set((s) => ({ entries: [...s.entries, e].slice(-120) }));
}

function patch(match: (e: Entry) => boolean, change: (e: Entry) => Entry): void {
  chat.set((s) => ({ entries: s.entries.map((e) => (match(e) ? change(e) : e)) }));
}

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

let speakReplies = true;

function handle(ev: ChatEvent): void {
  switch (ev.t) {
    case 'status':
      ui.set({ status: ev.text });
      break;
    case 'tool':
      push({ kind: 'activity', id: ev.id, label: label(ev.name, ev.args), state: 'running' });
      break;
    case 'tool_result':
      patch(
        (e) => e.kind === 'activity' && e.id === ev.id,
        (e) => ({ ...(e as Extract<Entry, { kind: 'activity' }>), state: ev.ok ? 'ok' : 'fail', detail: ev.ok ? undefined : ev.summary }),
      );
      if (!chat.get().entries.some((e) => e.kind === 'activity' && e.id === ev.id)) push({ kind: 'activity', id: ev.id, label: label(ev.name, {}), state: ev.ok ? 'ok' : 'fail', detail: ev.ok ? undefined : ev.summary });
      break;
    case 'client':
      void run(ev.name, ev.args);
      break;
    case 'approval':
      push({ kind: 'approval', id: ev.id, name: ev.name, reason: ev.reason, args: ev.args, state: 'waiting' });
      if (speakReplies && settings.get().speak) void speak(ev.reason);
      break;
    case 'text':
      push({ kind: 'assistant', text: ev.text, at: Date.now() });
      chat.set({ live: ev.text });
      if (speakReplies && settings.get().speak) void speak(ev.text);
      break;
    case 'error':
      push({ kind: 'error', text: ev.message });
      chat.set({ live: ev.message });
      break;
    case 'done':
      patch(
        (e) => e.kind === 'assistant' && !e.model,
        (e) => ({ ...(e as Extract<Entry, { kind: 'assistant' }>), model: ev.model }),
      );
      break;
  }
}

async function stream(fn: (cb: (e: ChatEvent) => void) => Promise<void>): Promise<void> {
  ui.set({ busy: true, voice: ui.get().voice === 'listening' ? 'listening' : 'thinking', status: 'thinking…' });
  try {
    await fn(handle);
  } catch (e) {
    if (e instanceof AuthError) {
      ui.set({ connected: false });
      push({ kind: 'error', text: `I can't reach my brain: ${e.message}` });
    } else push({ kind: 'error', text: String((e as Error)?.message ?? e) });
  } finally {
    ui.set({ busy: false, status: '' });
    if (ui.get().voice === 'thinking') ui.set({ voice: 'idle' });
  }
}

/** Send a message to Ghosty. */
export async function send(text: string, opts: { speak?: boolean } = {}): Promise<void> {
  const t = text.trim();
  if (!t) return;
  if (/^(stop|cancel|quiet|be quiet|shut up)$/i.test(t)) {
    stopSpeaking();
    stopListening();
    if (ui.get().busy) await brain.stop().catch(() => undefined);
    return;
  }
  speakReplies = opts.speak ?? true;
  push({ kind: 'user', text: t, at: Date.now() });
  chat.set({ live: t });
  await stream((cb) => brain.chat(t, context(), cb));
}

export async function answerApproval(id: string, allow: boolean): Promise<void> {
  patch(
    (e) => e.kind === 'approval' && e.id === id,
    (e) => ({ ...(e as Extract<Entry, { kind: 'approval' }>), state: allow ? 'approved' : 'declined' }),
  );
  await stream((cb) => brain.approve(id, allow, cb));
}

/** Load recent conversation from the brain on start-up. */
export async function loadHistory(): Promise<void> {
  try {
    const h = await brain.history();
    const entries: Entry[] = h.turns.slice(-30).map((t) => (t.role === 'user' ? { kind: 'user', text: t.text, at: t.at } : { kind: 'assistant', text: t.text, at: t.at, model: t.model }));
    if (h.pending) entries.push({ kind: 'approval', id: h.pending.id, name: h.pending.name, reason: `Waiting for your approval: ${h.pending.name.replace(/_/g, ' ')}`, args: h.pending.args, state: 'waiting' });
    chat.set({ entries });
  } catch (e) {
    if (!(e instanceof AuthError)) toast('Could not load conversation history', 'warn');
  }
}

export async function clearConversation(): Promise<void> {
  await brain.clearHistory();
  chat.set({ entries: [], live: '' });
}
