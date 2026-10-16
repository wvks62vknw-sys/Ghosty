/**
 * The conversation with Ghosty: sends messages to the brain, turns the streamed events
 * into chat entries, runs on-screen actions the brain asks for, and handles approvals.
 */
import type { ChatEvent } from '../../../../packages/shared/src/protocol';
import { AuthError, brain, unreachable } from '../api/brain';
import { enqueue } from '../api/offline';
import { offlineAnswer } from '../library/local';
import { run } from '../commands/registry';
import { createStore } from '../core/store';
import { progressOf, type Progress } from '../features/core/progress';
import { currentTab } from '../shell/tabs';
import { home, settings, timeZone, ui } from '../state/app';
import { toast } from '../ui/components';
import { speak, stopListening, stopSpeaking } from './voice';

export type Entry =
  | { kind: 'user'; text: string; at: number }
  | { kind: 'assistant'; text: string; at: number; model?: string }
  /** A tool at work; `progress` is what it is doing right now, replaced as it reports and gone once it finishes. */
  | { kind: 'activity'; id: string; label: string; state: 'running' | 'ok' | 'fail'; detail?: string; progress?: Progress }
  | { kind: 'approval'; id: string; name: string; reason: string; args: Record<string, unknown>; state: 'waiting' | 'approved' | 'declined' }
  | { kind: 'error'; text: string }
  | { kind: 'link'; url: string; title: string };

/** The conversation is also kept on this device, so it's there even when the brain's history can't be read. */
export const chat = createStore({ entries: [] as Entry[], live: '' }, { persist: 'ghosty.chat', keys: ['entries'] });
/** Turns said while the brain's database was paused are sent to its history afterwards (from this time on). */
let pausedFrom = 0;

const TOOL_LABELS: Record<string, string> = {
  web_search: 'Searching the web',
  web_fetch: 'Reading a page',
  weather: 'Checking the weather',
  earthquakes: 'Checking earthquakes',
  remember: 'Saving to memory',
  forget: 'Updating memory',
  list_memory: 'Recalling memory',
  create_widget: 'Building a widget',
  study_site: 'Studying the site',
  publish_site: 'Publishing the page',
  draft_site: 'Writing the page',
  list_sites: 'Listing published pages',
  unpublish_site: 'Taking the page down',
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

/** A link Ghosty made (e.g. a site it published), shown as a big tappable card in the chat. */
export function addLink(url: string, title: string): void {
  push({ kind: 'link', url, title });
}

function patch(match: (e: Entry) => boolean, change: (e: Entry) => Entry): void {
  chat.set((s) => ({ entries: s.entries.map((e) => (match(e) ? change(e) : e)) }));
}

/**
 * The turn is over (its stream ended with `done` or `error`, or broke off): a tool still shown
 * as running has no result coming, so its row stops blinking and its step leaves the HUD,
 * instead of being shown as the task at work through the whole next turn.
 */
function settle(): void {
  patch(
    (e) => e.kind === 'activity' && e.state === 'running',
    (e) => ({ ...(e as Extract<Entry, { kind: 'activity' }>), state: 'fail', detail: 'stopped', progress: undefined }),
  );
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
    case 'progress':
      // Under the running tool's line, in place (never a new entry); the same id's tool_result removes it.
      patch(
        (e) => e.kind === 'activity' && e.id === ev.id && e.state === 'running',
        (e) => ({ ...(e as Extract<Entry, { kind: 'activity' }>), progress: progressOf(ev) }),
      );
      break;
    case 'tool_result':
      patch(
        (e) => e.kind === 'activity' && e.id === ev.id,
        (e) => ({ ...(e as Extract<Entry, { kind: 'activity' }>), state: ev.ok ? 'ok' : 'fail', detail: ev.ok ? undefined : ev.summary, progress: undefined }),
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
      settle(); // the turn ends here: nothing is running any more
      push({ kind: 'error', text: ev.message });
      chat.set({ live: ev.message });
      break;
    case 'done':
      settle();
      if (/memory paused/.test(ev.model)) {
        // Only this exchange: the message that got the paused reply, and the replies since.
        const es = chat.get().entries;
        const lastUser = [...es].reverse().find((e) => e.kind === 'user');
        const from = Math.max(pausedFrom, (lastUser && 'at' in lastUser ? lastUser.at : Date.now()) - 1);
        const turns = es
          .filter((e): e is Extract<Entry, { kind: 'user' | 'assistant' }> => (e.kind === 'user' || (e.kind === 'assistant' && !e.model)) && e.at > from)
          .map((e) => ({ role: e.kind, text: e.text, at: e.at, ...(e.kind === 'assistant' ? { model: ev.model } : {}) }));
        if (turns.length) {
          pausedFrom = turns.at(-1)!.at;
          enqueue({ kind: 'addTurns', turns });
        }
      }
      patch(
        (e) => e.kind === 'assistant' && !e.model,
        (e) => ({ ...(e as Extract<Entry, { kind: 'assistant' }>), model: ev.model }),
      );
      break;
  }
}

async function stream(fn: (cb: (e: ChatEvent) => void) => Promise<void>, offline?: () => Promise<string | null>): Promise<void> {
  ui.set({ busy: true, voice: ui.get().voice === 'listening' ? 'listening' : 'thinking', status: 'thinking…' });
  try {
    await fn(handle);
  } catch (e) {
    if (e instanceof AuthError) {
      ui.set({ connected: false });
      push({ kind: 'error', text: `I can't reach my brain: ${e.message}` });
      toast(`Can't reach the brain: ${e.message}`, 'bad');
    } else {
      // No connection at all: answer from the library copy on this device.
      const answer = e instanceof TypeError && offline ? await offline().catch(() => null) : null;
      if (answer) {
        push({ kind: 'assistant', text: answer, at: Date.now(), model: 'Library on this device · offline' });
        chat.set({ live: answer });
        if (speakReplies && settings.get().speak) void speak(answer.split('\n\n')[1] ?? answer);
      } else {
        const msg = String((e as Error)?.message ?? e);
        push({ kind: 'error', text: msg });
        toast(msg.length > 140 ? `${msg.slice(0, 140)}…` : msg, 'bad');
      }
    }
  } finally {
    settle(); // a stream that broke off (connection lost, stopped) sent no done or error event
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
  const recent = chat
    .get()
    .entries.filter((e): e is Extract<Entry, { kind: 'user' | 'assistant' }> => e.kind === 'user' || e.kind === 'assistant')
    .slice(-12)
    .map((e) => ({ role: e.kind, text: e.text.slice(0, 1500) }));
  push({ kind: 'user', text: t, at: Date.now() });
  chat.set({ live: t });
  await stream((cb) => brain.chat(t, context(), cb, undefined, recent), () => offlineAnswer(t));
  // A reminder Ghosty just set may already be due ("in 1 minute"): check soon.
  setTimeout(() => void import('./notices').then((n) => n.pollInbox()), 2500);
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
    const entries: Entry[] = h.turns.slice(-30).flatMap((t): Entry[] => {
      if (t.role === 'user') return [{ kind: 'user', text: t.text, at: t.at }];
      // A page published in that turn keeps its live-link card under the reply.
      return [{ kind: 'assistant', text: t.text, at: t.at, model: t.model }, ...(t.link ? [{ kind: 'link', url: t.link.url, title: t.link.title } as Entry] : [])];
    });
    if (h.pending) entries.push({ kind: 'approval', id: h.pending.id, name: h.pending.name, reason: `Waiting for your approval: ${h.pending.name.replace(/_/g, ' ')}`, args: h.pending.args, state: 'waiting' });
    chat.set({ entries });
  } catch (e) {
    // Database paused or offline: the conversation kept on this device stays on screen.
    if (!(e instanceof AuthError) && !(unreachable(e) && chat.get().entries.length)) toast('Could not load conversation history', 'warn');
  }
}

export async function clearConversation(): Promise<void> {
  await brain.clearHistory();
  chat.set({ entries: [], live: '' });
}
