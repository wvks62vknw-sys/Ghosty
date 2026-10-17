/**
 * The conversation with Ghosty: sends messages to the brain, turns the streamed events
 * into chat entries, runs on-screen actions the brain asks for, and handles approvals.
 */
import { normalisePlate, redactPlates } from '../../../../packages/shared/src/plates';
import type { ChatEvent } from '../../../../packages/shared/src/protocol';
import { AuthError, brain, unreachable } from '../api/brain';
import { enqueue } from '../api/offline';
import { offlineAnswer } from '../library/local';
import { answerOffline, offlineReady, stopOffline } from '../offline/brain';
import { cleanReply, noModelError, shouldFallBack } from '../offline/prompt';
import { run } from '../commands/registry';
import { createStore } from '../core/store';
import { progressOf, type Progress } from '../features/core/progress';
import { currentTab } from '../shell/tabs';
import { home, settings, timeZone, ui } from '../state/app';
import { toast } from '../ui/components';
import { speak, stopListening, stopSpeaking } from './voice';

export type Entry =
  | { kind: 'user'; text: string; at: number }
  /** `offline`: answered by the small model on the phone itself (offline/brain.ts); `once`: it gave a vehicle record, shown and never kept on this device. */
  | { kind: 'assistant'; text: string; at: number; model?: string; offline?: boolean; once?: boolean }
  /** A tool at work; `progress` is what it is doing right now, replaced as it reports and gone once it finishes. */
  | { kind: 'activity'; id: string; label: string; state: 'running' | 'ok' | 'fail'; detail?: string; progress?: Progress }
  | { kind: 'approval'; id: string; name: string; reason: string; args: Record<string, unknown>; state: 'waiting' | 'approved' | 'declined' }
  | { kind: 'error'; text: string }
  | { kind: 'link'; url: string; title: string };

/**
 * A vehicle check from the chat is shown once (integrations/vehicle.ts on the brain): the plates
 * checked in this session (memory only) and whether this turn ran one. What the device keeps
 * leaves out the reply that gave the record and has "[plate]" for the plate.
 */
const checkedPlates = new Set<string>();
let vehicleTurn = false;
function kept(entries: Entry[]): Entry[] {
  const out = entries.filter((e) => !(e.kind === 'assistant' && e.once));
  if (!checkedPlates.size) return out;
  return out.map((e) => (e.kind === 'user' || e.kind === 'assistant' || e.kind === 'error' ? { ...e, text: redactPlates(e.text, checkedPlates) } : e.kind === 'activity' && e.detail ? { ...e, detail: redactPlates(e.detail, checkedPlates) } : e));
}

/** The conversation is also kept on this device, so it's there even when the brain's history can't be read. */
export const chat = createStore({ entries: [] as Entry[], live: '' }, { persist: 'ghosty.chat', save: (s) => ({ entries: kept(s.entries) }) });
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
  vehicle_check: 'Checking a vehicle',
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
      if (ev.name === 'vehicle_check') {
        vehicleTurn = true;
        if (typeof ev.args.plate === 'string' && normalisePlate(ev.args.plate)) checkedPlates.add(normalisePlate(ev.args.plate));
      }
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
      push({ kind: 'assistant', text: ev.text, at: Date.now(), ...(vehicleTurn ? { once: true } : {}) });
      chat.set({ live: ev.text });
      if (speakReplies && settings.get().speak) void speak(ev.text);
      break;
    case 'error':
      vehicleTurn = false;
      settle(); // the turn ends here: nothing is running any more
      push({ kind: 'error', text: ev.message });
      chat.set({ live: ev.message });
      break;
    case 'done':
      vehicleTurn = false;
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

/**
 * `rescue`: a last try before the error is shown (the offline brain on the phone); true when it answered.
 */
async function stream(fn: (cb: (e: ChatEvent) => void) => Promise<void>, offline?: () => Promise<string | null>, rescue?: (e: unknown) => Promise<boolean>): Promise<void> {
  ui.set({ busy: true, voice: ui.get().voice === 'listening' ? 'listening' : 'thinking', status: 'thinking…' });
  try {
    await fn(handle);
  } catch (e) {
    if (!(e instanceof AuthError) && rescue && (await rescue(e).catch(() => false))) {
      // answered on the phone
    } else if (e instanceof AuthError) {
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
    vehicleTurn = false;
    settle(); // a stream that broke off (connection lost, stopped) sent no done or error event
    ui.set({ busy: false, status: '' });
    if (ui.get().voice === 'thinking') ui.set({ voice: 'idle' });
  }
}

const OFFLINE_MODEL = 'On this phone · offline';

/**
 * Answer on the phone itself with the offline brain (offline/brain.ts): the reply streams into
 * its entry like any other and is spoken the usual way. False (and nothing left on screen) if the
 * model could not answer; true, with nothing spoken, when the owner said "stop".
 */
async function answerHere(t: string, recent: { role: 'user' | 'assistant'; text: string }[]): Promise<boolean> {
  const at = Date.now();
  const mine = (e: Entry) => e.kind === 'assistant' && e.at === at && !!e.offline;
  const show = (text: string) => patch(mine, (e) => ({ ...(e as Extract<Entry, { kind: 'assistant' }>), text }));
  push({ kind: 'assistant', text: '', at, model: OFFLINE_MODEL, offline: true });
  ui.set({ status: 'thinking on your phone…' });
  let raw = '';
  let painted = 0;
  try {
    const r = await answerOffline(t, recent, (piece) => {
      raw += piece;
      // A repaint per word redraws the whole log: a few times a second is smooth enough.
      if (Date.now() - painted > 120) {
        painted = Date.now();
        show(cleanReply(raw));
      }
    });
    if (!r.text) throw new Error('no reply');
    show(r.text);
    chat.set({ live: r.text });
    if (speakReplies && settings.get().speak) void speak(r.text);
    return true;
  } catch (e) {
    // Stopped by the owner: what was written so far stays, nothing is spoken, and no error shows.
    const said = cleanReply(raw).trim();
    if ((e as Error)?.name === 'AbortError' && said) {
      show(said);
      return true;
    }
    chat.set((s) => ({ entries: s.entries.filter((x) => !mine(x)) }));
    if ((e as Error)?.name === 'AbortError') return true;
    console.warn('offline brain', e);
    return false;
  }
}

/** Send a message to Ghosty. */
export async function send(text: string, opts: { speak?: boolean } = {}): Promise<void> {
  const t = text.trim();
  if (!t) return;
  if (/^(stop|cancel|quiet|be quiet|shut up)$/i.test(t)) {
    stopSpeaking();
    stopListening();
    stopOffline();
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
  const mode = settings.get().offlineBrain;
  if (mode === 'always') {
    // The owner chose the phone's own brain: the cloud brain is never asked.
    await stream(async () => {
      // Never a 352 MB download on the first message (perhaps on mobile data): only DOWNLOAD in Settings fetches it.
      const ready = await offlineReady().catch(() => false);
      if (ready && (await answerHere(t, recent))) return;
      push({ kind: 'error', text: ready ? "The offline brain on this phone couldn't answer. Try again, or set it to 'only when needed' in Settings → Offline brain." : "Offline brain is set to 'always', but it isn't on this phone yet: Settings → Offline brain → DOWNLOAD (on Wi-Fi)." });
    });
    return;
  }
  // When the brain can't answer (no connection, a server error, no free model), the phone's own model does — if it's here.
  const here = mode !== 'off' && (await offlineReady().catch(() => false));
  // The brain already said or did something this turn (a reply, a tool run, an approval asked, an
  // on-screen action): the small model can't see any of it, so the brain's own error stands.
  let acted = false;
  let held: Extract<ChatEvent, { t: 'error' }> | null = null;
  const rescue = async (e: unknown) => here && !acted && shouldFallBack(e) && answerHere(t, recent);
  await stream(
    async (cb) => {
      await brain.chat(t, context(), (ev) => {
        if (ev.t === 'text' || ev.t === 'tool' || ev.t === 'tool_result' || ev.t === 'progress' || ev.t === 'approval' || ev.t === 'client') acted = true;
        // "No model is free" before anything happened: held back, answered on the phone instead (shown as usual if that fails).
        if (here && !acted && ev.t === 'error' && noModelError(ev.message)) {
          held = ev;
          return;
        }
        cb(ev);
      }, undefined, recent);
      if (held && !(await answerHere(t, recent))) cb(held);
    },
    () => offlineAnswer(t),
    rescue,
  );
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
