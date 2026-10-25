/**
 * The conversation with Ghosty: sends messages to the brain, turns the streamed events
 * into chat entries, runs on-screen actions the brain asks for, and handles approvals.
 */
import { normalisePlate, redactPlates } from '../../../../packages/shared/src/plates';
import type { ChatEvent, CitedInfo } from '../../../../packages/shared/src/protocol';
import { citedBody, looksCited, spokenOf } from '../cited/text';
import { AuthError, brain, unreachable } from '../api/brain';
import { enqueue } from '../api/offline';
import { offlineAnswer } from '../library/local';
import { answerOffline, offlineReady, stopOffline, translateOffline } from '../offline/brain';
import { recheckThink, stopThinking, thinkHere } from '../offline/harder';
import { offlineSiteReply, offlineSiteTurn } from '../offline/site';
import { cleanReply, cleanTranslation, noModelError, shouldFallBack, translateAsk } from '../offline/prompt';
import { thinkAsk, type ThinkResult } from '../offline/think';
import { run } from '../commands/registry';
import { createStore } from '../core/store';
import { stopwatch } from '../core/stopwatch';
import { progressOf, type Progress } from '../features/core/progress';
import { currentTab } from '../shell/tabs';
import { home, settings, timeZone, ui } from '../state/app';
import { flushUndo, toast, undo } from '../ui/components';
import { onCutOff, speak, stopListening, stopSpeaking } from './voice';

/**
 * A THINK HARDER answer (offline/think.ts): the question, how it is going (`line`, live), and once done
 * the answer, how sure it is and how long it took.
 */
export interface ThinkInfo {
  q: string;
  state: 'running' | 'done' | 'stopped';
  line: string;
  answer?: string;
  confidence?: ThinkResult['confidence'];
  secs?: number;
}

export type Entry =
  | { kind: 'user'; text: string; at: number }
  /** `offline`: answered by the small model on the phone itself (offline/brain.ts); `once`: it gave a vehicle record, shown and never kept on this device. */
  /** `cited`: a cited answer's sources and claim checks (chips, the SOURCES list, the check line). `think`: a THINK HARDER answer. */
  /** `cut`: the owner interrupted while it was being read out (a tap, or talking over it): the rest was never said.
   *  `site`: a website built on this phone (offline/site.ts), kept under `key` for PREVIEW / SAVE / PUBLISH.
   *  `tr`: a translation made on the phone with no signal (rough): `text` is the translation, `to` its language's code. */
  | { kind: 'assistant'; text: string; at: number; model?: string; offline?: boolean; once?: boolean; cited?: CitedInfo; think?: ThinkInfo; cut?: boolean; site?: { key: string; title: string; pages: string[]; score: number }; tr?: { to: string } }
  /** A tool at work; `progress` is what it is doing right now, replaced as it reports and gone once it finishes. */
  | { kind: 'activity'; id: string; label: string; state: 'running' | 'ok' | 'fail'; detail?: string; progress?: Progress }
  /** `via`: answered on Telegram (its APPROVE / NOT NOW buttons), not here. */
  | { kind: 'approval'; id: string; name: string; reason: string; args: Record<string, unknown>; state: 'waiting' | 'approved' | 'declined'; via?: 'telegram' }
  | { kind: 'error'; text: string }
  | { kind: 'link'; url: string; title: string }
  /** A plan design_home drew from the owner's words (features/core/homecard.ts): `id` is the kept plan's (features/space/home.ts). */
  | { kind: 'home'; id: string; rooms: number; m2: number; storeys: number };

/**
 * A vehicle check from the chat is shown once (integrations/vehicle.ts on the brain): the plates
 * checked in this session (memory only) and whether this turn ran one. What the device keeps
 * leaves out the reply that gave the record and has "[plate]" for the plate.
 */
const checkedPlates = new Set<string>();
let vehicleTurn = false;
function kept(entries: Entry[]): Entry[] {
  const out = entries
    .filter((e) => !(e.kind === 'assistant' && e.once))
    // A THINK HARDER still running when Ghosty closes would come back as running for ever: it is kept as stopped.
    .map((e) => (e.kind === 'assistant' && e.think?.state === 'running' ? { ...e, think: { ...e.think, state: 'stopped' as const, line: 'stopped: Ghosty was closed while it was thinking' } } : e));
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

/** A time for a new entry, never the same as the last one's (it tags the reply that is read out: voice.ts owner). */
let lastStamp = 0;
function stamp(): number {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return lastStamp;
}

function push(e: Entry): void {
  chat.set((s) => ({ entries: [...s.entries, e].slice(-120) }));
}

// The owner cut Ghosty off mid-reply (voice.ts interrupt): the reply being read out is marked, so the
// log shows it was not all said. (The approval question read out has no reply entry to mark.)
onCutOff((c) => {
  // Only the reply that was being read out (its tag is its time): never a later or earlier one.
  if (!c.owner) return;
  patch((e) => e.kind === 'assistant' && String(e.at) === c.owner, (e) => ({ ...(e as Extract<Entry, { kind: 'assistant' }>), cut: true }));
});

/** A link Ghosty made (e.g. a site it published), shown as a big tappable card in the chat. */
export function addLink(url: string, title: string): void {
  push({ kind: 'link', url, title });
}

/** A plan drawn from the owner's words: its card (rooms, floor area, OPEN IN SPACE, SEE IN 3-D) goes under the reply. */
export function addHomeCard(card: Omit<Extract<Entry, { kind: 'home' }>, 'kind'>): void {
  push({ kind: 'home', ...card });
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
    // Said into the microphone: the brain answers in its spoken style (persona.ts SPOKEN).
    ...(spokenTurn ? { voice: true } : {}),
  };
}

let speakReplies = true;
/** This message was spoken, not typed. */
let spokenTurn = false;

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
      followApproval(ev.id);
      if (speakReplies && settings.get().speak) void speak(ev.reason);
      break;
    case 'text': {
      const at = stamp();
      push({ kind: 'assistant', text: ev.text, at, ...(vehicleTurn ? { once: true } : {}) });
      // A cited answer: the caption leaves out the source list, and the voice the [n] markers too.
      const cited = looksCited(ev.text);
      chat.set({ live: cited ? citedBody(ev.text) : ev.text });
      if (speakReplies && settings.get().speak) void speak(cited ? spokenOf(ev.text) : ev.text, { owner: String(at), brief: true });
      break;
    }
    case 'cited': {
      // Belongs to the reply just sent (the latest one still without its model line).
      const last = [...chat.get().entries].reverse().find((e) => e.kind === 'assistant');
      if (last) patch((e) => e === last, (e) => ({ ...(e as Extract<Entry, { kind: 'assistant' }>), cited: { citations: ev.citations, checks: ev.checks } }));
      break;
    }
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
      if (answer === HANDLED) {
        // answered on the phone by its own builder (a website)
      } else if (answer) {
        const at = stamp();
        push({ kind: 'assistant', text: answer, at, model: 'Library on this device · offline' });
        chat.set({ live: answer });
        if (speakReplies && settings.get().speak) void speak(answer.split('\n\n')[1] ?? answer, { owner: String(at), brief: true });
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
/** An offline fallback that already put its own answer in the log. */
const HANDLED = '\u0000handled';

/** A website built on the phone (no brain needed): the questions, or the finished site with its buttons. */
async function siteHere(t: string): Promise<void> {
  ui.set({ status: 'building on your phone…' });
  const r = await offlineSiteReply(t);
  push({ kind: 'assistant', text: r.text, at: Date.now(), model: 'On this phone · website kit', offline: true, ...(r.site ? { site: r.site } : {}) });
  chat.set({ live: r.text });
}

/**
 * Answer on the phone itself with the offline brain (offline/brain.ts): the reply streams into
 * its entry like any other and is spoken the usual way. False (and nothing left on screen) if the
 * model could not answer; true, with nothing spoken, when the owner said "stop".
 */
async function answerHere(t: string, recent: { role: 'user' | 'assistant'; text: string }[]): Promise<boolean> {
  const at = stamp();
  const mine = (e: Entry) => e.kind === 'assistant' && e.at === at && !!e.offline;
  const show = (text: string) => patch(mine, (e) => ({ ...(e as Extract<Entry, { kind: 'assistant' }>), text }));
  // "Translate this into Spanish" with no signal: the same small model, asked only to translate (roughly; the card says so).
  const tr = translateAsk(t, [...recent].reverse().find((x) => x.role === 'assistant')?.text ?? '');
  push({ kind: 'assistant', text: '', at, model: OFFLINE_MODEL, offline: true, ...(tr ? { tr: { to: tr.to } } : {}) });
  ui.set({ status: tr ? 'translating on your phone…' : 'thinking on your phone…' });
  let raw = '';
  let painted = 0;
  try {
    const r = await (tr ? translateOffline(tr.text, tr.to, (piece) => {
      raw += piece;
      if (Date.now() - painted > 120) {
        painted = Date.now();
        show(cleanTranslation(raw, tr.to));
      }
    }) : answerOffline(t, recent, (piece) => {
      raw += piece;
      // A repaint per word redraws the whole log: a few times a second is smooth enough.
      if (Date.now() - painted > 120) {
        painted = Date.now();
        show(cleanReply(raw));
      }
    }));
    if (!r.text) throw new Error('no reply');
    show(r.text);
    chat.set({ live: r.text });
    // (a translation is read aloud in its own language's voice by its READ ALOUD button, not in Ghosty's English one)
    if (speakReplies && settings.get().speak && !tr) void speak(r.text, { owner: String(at), brief: true });
    return true;
  } catch (e) {
    // Stopped by the owner: what was written so far stays, nothing is spoken, and no error shows.
    const said = (tr ? cleanTranslation(raw, tr.to) : cleanReply(raw)).trim();
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

const THINK_MODEL = 'On this phone · THINK HARDER';

/** The owner's last real question (not a "think harder" or a "stop"), for "think harder" said on its own. */
function lastQuestion(): string {
  const users = chat.get().entries.filter((e): e is Extract<Entry, { kind: 'user' }> => e.kind === 'user');
  for (const u of users.reverse()) {
    const ask = thinkAsk(u.text);
    if (ask) return ask;
    if (ask === null && !/^(stop|cancel|quiet|be quiet|shut up)$/i.test(u.text.trim())) return u.text;
  }
  return '';
}

/**
 * THINK HARDER: the offline brain on this phone spends up to about a minute on the question (several
 * attempts, a search over reasoning steps, exact checks where there are any) and answers with how sure it
 * is. Never a cloud model. `asked`: the owner's message is already in the log (they typed "think harder").
 */
export async function thinkHarderAbout(question: string, opts: { asked?: boolean } = {}): Promise<void> {
  const q = question.trim() || lastQuestion();
  if (!opts.asked) push({ kind: 'user', text: `Think harder: ${q || '(no question)'}`, at: stamp() });
  if (!q) {
    push({ kind: 'error', text: 'Think harder about what? Ask the question first, or say "think harder: …" with it.' });
    return;
  }
  const at = stamp();
  const mine = (e: Entry) => e.kind === 'assistant' && e.at === at && !!e.think;
  const update = (think: Partial<ThinkInfo>, text?: string) =>
    patch(mine, (e) => {
      const a = e as Extract<Entry, { kind: 'assistant' }>;
      return { ...a, ...(text !== undefined ? { text } : {}), think: { ...a.think!, ...think } };
    });
  push({ kind: 'assistant', text: '', at, model: THINK_MODEL, offline: true, think: { q, state: 'running', line: 'starting…' } });
  ui.set({ busy: true, voice: ui.get().voice === 'listening' ? 'listening' : 'thinking', status: 'thinking harder on your phone…' });
  const t0 = Date.now();
  let painted = 0;
  // What the conversation was before this (as an ordinary offline answer sees it), without the "think harder" itself.
  const turns = chat
    .get()
    .entries.filter((e): e is Extract<Entry, { kind: 'user' | 'assistant' }> => (e.kind === 'user' || e.kind === 'assistant') && e.at < at - 1 && !(e.kind === 'assistant' && e.think))
    .filter((e) => !(e.kind === 'user' && thinkAsk(e.text) !== null))
    .slice(-6)
    .map((e) => ({ role: e.kind, text: e.text.slice(0, 1500) }));
  try {
    const r = await thinkHere(q, turns, (p) => {
      // A few repaints a second at most: each redraws the log.
      if (Date.now() - painted < 150 && p.phase !== 'done') return;
      painted = Date.now();
      update({ line: p.line });
      ui.set({ status: p.line });
    });
    const secs = Math.round((Date.now() - t0) / 1000);
    update({ state: r.stopped ? 'stopped' : 'done', line: r.line, answer: r.answer, confidence: r.confidence, secs }, r.text || r.answer || '(no answer)');
    const said = r.answer ? `${r.answer} (${r.line})` : r.line;
    chat.set({ live: said });
    if (speakReplies && settings.get().speak && r.answer) void speak(`${r.answer}. ${r.line.split(' (')[0]}.`, { owner: String(at) });
  } catch (e) {
    chat.set((s) => ({ entries: s.entries.filter((x) => !mine(x)) }));
    if ((e as Error)?.name !== 'AbortError') push({ kind: 'error', text: String((e as Error)?.message ?? e) });
    recheckThink(); // perhaps the model is not on this phone any more: the button goes
  } finally {
    ui.set({ busy: false, status: '' });
    if (ui.get().voice === 'thinking') ui.set({ voice: 'idle' });
  }
}

/** ASK THE BIG BRAIN: the same question to the brain's own (cloud) models — the owner asked, so even in "always". */
export function askBigBrain(question: string): Promise<void> {
  return send(question, { speak: settings.get().speak, cloud: true });
}

/** Send a message to Ghosty. `cloud`: the owner asked for the brain's models (ASK THE BIG BRAIN), even with the offline brain on "always". */
export async function send(text: string, opts: { speak?: boolean; voice?: boolean; cloud?: boolean } = {}): Promise<void> {
  const t = text.trim();
  if (!t) return;
  if (/^(stop|cancel|quiet|be quiet|shut up)$/i.test(t)) {
    stopSpeaking();
    stopListening();
    stopOffline();
    stopThinking();
    if (ui.get().busy) await brain.stop().catch(() => undefined);
    return;
  }
  // "reboot": the boot cinematic again, here on the phone (shell/boot.ts); the brain is not asked
  if (/^(reboot|reboot (him|yourself|ghosty)|restart yourself)[.!]?$/i.test(t)) {
    await import('../shell/boot').then((b) => b.reboot());
    return;
  }
  // A change still waiting for its UNDO bar (a cleared conversation) is made before the brain hears the new message.
  await flushUndo();
  speakReplies = opts.speak ?? true;
  spokenTurn = opts.voice === true;
  const recent = chat
    .get()
    .entries.filter((e): e is Extract<Entry, { kind: 'user' | 'assistant' }> => e.kind === 'user' || e.kind === 'assistant')
    .slice(-12)
    .map((e) => ({ role: e.kind, text: e.text.slice(0, 1500) }));
  push({ kind: 'user', text: t, at: Date.now() });
  chat.set({ live: t });
  // The stopwatch (core/stopwatch.ts): a reply from the brain, from here to its first words and its end, as the owner sees them.
  const lap = stopwatch.reply();
  // "think harder" (alone: the last question; or with one): the phone's model, with more effort.
  // Never with the offline brain switched off: then it is an ordinary message for the brain.
  const harder = opts.cloud || settings.get().offlineBrain === 'off' ? null : thinkAsk(t);
  if (harder !== null) return thinkHarderAbout(harder, { asked: true });
  const mode = settings.get().offlineBrain;
  // A website with no brain to ask (offline mode 'always', or no connection): built here from the website kit. Never a
  // message taken over while the brain can be asked (the answers to the phone's questions then go to the brain too).
  if (!opts.cloud && offlineSiteTurn(t) && (mode === 'always' || navigator.onLine === false)) {
    await stream(async () => siteHere(t));
    return;
  }
  if (mode === 'always' && !opts.cloud) {
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
        lap.saw(ev.t);
        if (ev.t === 'text' || ev.t === 'tool' || ev.t === 'tool_result' || ev.t === 'progress' || ev.t === 'approval' || ev.t === 'client') acted = true;
        // "No model is free" before anything happened: held back, answered on the phone instead (shown as usual if that fails).
        if (here && !acted && ev.t === 'error' && noModelError(ev.message)) {
          held = ev;
          return;
        }
        cb(ev);
      }, undefined, recent, settings.get().cited);
      if (held && !(await answerHere(t, recent))) cb(held);
    },
    () => (offlineSiteTurn(t) ? siteHere(t).then(() => HANDLED) : offlineAnswer(t)),
    rescue,
  );
  lap.end();
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

/** Approvals being followed (one watcher each). */
const following = new Set<string>();

/**
 * An approval left waiting here goes to the owner's Telegram too, once they have walked away
 * (the app hidden, or a minute with no answer), as APPROVE / NOT NOW buttons; an answer given
 * there then shows on this card, and the conversation is reloaded for what followed. Nothing
 * happens when Telegram is not paired (the brain says so and the watch ends).
 */
function followApproval(id: string): void {
  if (following.has(id)) return;
  following.add(id);
  const waiting = () => chat.get().entries.some((e) => e.kind === 'approval' && e.id === id && e.state === 'waiting');
  let sent = false;
  let polls = 0;
  const stop = () => {
    following.delete(id);
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onHide);
  };
  const poll = async (): Promise<void> => {
    if (!following.has(id)) return;
    if (!waiting() || polls++ > 360) return stop();
    const a = await brain.telegramAnswer(id).catch(() => null);
    if (a?.answered) {
      patch(
        (e) => e.kind === 'approval' && e.id === id,
        (e) => ({ ...(e as Extract<Entry, { kind: 'approval' }>), state: a.allow ? 'approved' : 'declined', via: 'telegram' }),
      );
      stop();
      // What the brain did next (the reply went to Telegram as it happened) is in the history.
      setTimeout(() => void loadHistory(), 4000);
      return;
    }
    setTimeout(() => void poll(), 5000);
  };
  const forward = async () => {
    if (!waiting()) return stop(); // answered in the app: stop following
    if (sent) return;
    sent = true;
    const r = await brain.telegramAsk(id).catch(() => null);
    if (r?.sent || r?.already) void poll();
    else stop();
  };
  const onHide = () => {
    if (document.hidden) void forward();
  };
  const timer = setTimeout(() => void forward(), 60_000);
  document.addEventListener('visibilitychange', onHide);
}

/** Load recent conversation from the brain on start-up. */
export async function loadHistory(): Promise<void> {
  try {
    const h = await brain.history();
    const entries: Entry[] = h.turns.slice(-30).flatMap((t): Entry[] => {
      if (t.role === 'user') return [{ kind: 'user', text: t.text, at: t.at }];
      // A page published in that turn keeps its live-link card under the reply.
      return [{ kind: 'assistant', text: t.text, at: t.at, model: t.model, ...(t.cited ? { cited: t.cited } : {}) }, ...(t.link ? [{ kind: 'link', url: t.link.url, title: t.link.title } as Entry] : [])];
    });
    if (h.pending) entries.push({ kind: 'approval', id: h.pending.id, name: h.pending.name, reason: `Waiting for your approval: ${h.pending.name.replace(/_/g, ' ')}`, args: h.pending.args, state: 'waiting' });
    chat.set({ entries });
    if (h.pending) followApproval(h.pending.id);
  } catch (e) {
    // Database paused or offline: the conversation kept on this device stays on screen.
    if (!(e instanceof AuthError) && !(unreachable(e) && chat.get().entries.length)) toast('Could not load conversation history', 'warn');
  }
}

/**
 * CLEAR CONVERSATION: off the screen at once, with UNDO for 12 s; the brain forgets it when the bar goes (or as
 * soon as a new message is sent, so the new one never meets the old conversation). UNDO puts every message back.
 */
export function clearConversation(): void {
  const was = chat.get().entries;
  chat.set({ entries: [], live: '' });
  undo(
    'Conversation cleared',
    () => {
      // anything said since stays after the old conversation
      chat.set((s) => ({ entries: [...was, ...s.entries] }));
      toast('The conversation is back', 'ok');
    },
    async () => {
      await brain.clearHistory();
      // What Ghosty noticed from the conversation (the patterns' day log) goes with it.
      await brain.clearPatterns().catch(() => undefined);
    },
  );
}
