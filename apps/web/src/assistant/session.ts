/**
 * The conversation with Ghosty: sends messages to the brain, turns the streamed events
 * into chat entries, runs on-screen actions the brain asks for, and handles approvals.
 */
import { normalisePlate, redactPlates } from '../../../../packages/shared/src/plates';
import type { ChatEvent, CitedInfo } from '../../../../packages/shared/src/protocol';
import type { Card } from '../../../../packages/shared/src/cards';
import { citedBody, looksCited, spokenOf } from '../cited/text';
import { AuthError, brain, unreachable } from '../api/brain';
import { enqueue } from '../api/offline';
import { offlineAnswer, passagesFor } from '../library/local';
import { answerOffline, modelWarm, offlineReady, stopOffline, translateOffline, trustFirst, warmUp, type First } from '../offline/brain';
import { categorise, keptAnswer, keptTurn, mayGoFirst, noteMiss, workedOut, type AskCat } from '../offline/trust';
import { recheckThink, stopThinking, thinkHere } from '../offline/harder';
import { offlineSiteReply, offlineSiteTurn } from '../offline/site';
import { cleanReply, cleanTranslation, noModelError, shouldFallBack, translateAsk } from '../offline/prompt';
import { thinkAsk, type ThinkResult } from '../offline/think';
import { run } from '../commands/registry';
import { createStore } from '../core/store';
import { stopwatch } from '../core/stopwatch';
import { noteAnswer, noteStopped, unnoteAnswer } from '../core/independence';
import { progressOf, type Progress } from '../features/core/progress';
import { clientContext } from '../shell/awareness';
import { clearTag, graceOn, hear, heardNote, hold, labelOf, type Label } from './voiceknown';
import { home, settings, timeZone, ui } from '../state/app';
import { fmt } from '../core/dom';
import { flushUndo, toast, undo } from '../ui/components';
import { onCutOff, speak, speakStream, stopListening, stopSpeaking, takeSound, type SpokenStream } from './voice';
import { BARE, afterLine, askLine, progressLine, toolLine } from './narrate';
import { continueIntent, stopIntent } from '../../../../packages/shared/src/intent';
import { feelHere, setMood } from '../state/mood';
import { localTurn, type LocalAnswer } from './local';
import { REBOOT } from './phrases';
import { guardTurn } from './guard'; // [guardian] the panic phrase and the walk home (OWNER-ISSUES 55, 60)
import { faceTurn } from '../features/lens/people'; // [guardian] PEOPLE: "this is Sam", "who's this?", "who am I?" (OWNER-ISSUES 56)
import { argWords } from '../../../../packages/shared/src/abilities';
import { wallSplit, wallTurn } from '../wall/phone'; // [wall] THE WALL: "pair the wall", "on the wall", "clear the wall" (BRIEF-MACHINE-WALL)
import { showBegin, showEnd, showNote } from '../show/turn'; // [showme] the Stage: what a turn brought, and the picture after the sentence (BRIEF-SHOW-ME-1)
import { sayError } from '../ui/hisWords';
import { readBack, ruleFor, SAY_NO, type Rule, type Verified } from './verify'; // [health] a thing the brain says it did is read back before "Done"
import { openDocData } from '../docs/live'; // [document] the document open in the editor goes with his message, as data (BRIEF-KERNEL-2)
import { withoutOpenDoc } from '../../../../packages/shared/src/opendoc';
import { SIGNAL_WENT, type Phase } from '../features/core/words';
import { withoutOpenWork } from '../../../../packages/shared/src/openwork';
import { openWorkData, readyWork } from '../proposals/live'; // [kernel3] a deck, video, workspace or game open in its editor goes with his message, as data (BRIEF-KERNEL-3)

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

/**
 * `private` (user and assistant entries): a task kept on the phone (OWNER-ISSUES 72: the offline brain set to "always", or
 * ON THIS PHONE for that message). Its words never go to the brain afterwards either: not as recent turns, not in a rating.
 * An error's `ask`: the question the phone could not answer, offered to the brain only by a tap (ASK THE BIG BRAIN).
 */
export type Entry =
  | { kind: 'user'; text: string; at: number; private?: boolean }
  /** `offline`: answered by the small model on the phone itself (offline/brain.ts); `once`: it gave a vehicle record, shown and never kept on this device. */
  /** `cited`: a cited answer's sources and claim checks (chips, the SOURCES list, the check line). `think`: a THINK HARDER answer. */
  /** `cut`: the owner interrupted while it was being read out (a tap, or talking over it): the rest was never said.
   *  `site`: a website built on this phone (offline/site.ts), kept under `key` for PREVIEW / SAVE / PUBLISH.
   *  `tr`: a translation made on the phone with no signal (rough): `text` is the translation, `to` its language's code. */
  /** `first`: answered on this phone FIRST, its kind being trusted (offline/trust.ts), with ASK THE CLOUD under it;
   *  `struck`: he tapped ASK THE CLOUD, so the cloud's answer follows and this one stays above it, struck faintly. */
  /** [talk] `heard`: of a reply cut off, the sentences he heard; `carried`: he said "go on" and it was carried on below.
   *  `carries`: this is that carrying on (BRIEF-TALK-1A 2), of the reply at that tag, `heardBefore` being what he had heard of
   *  it, `head` that reply's first words as said (so the brain can tell which of its replies he means). */
  | { kind: 'assistant'; text: string; at: number; model?: string; offline?: boolean; once?: boolean; cited?: CitedInfo; think?: ThinkInfo; cut?: boolean; site?: { key: string; title: string; pages: string[]; score: number }; tr?: { to: string }; private?: boolean; local?: LocalAnswer; first?: First; struck?: boolean; heard?: string; carried?: boolean; carries?: number; heardBefore?: string; head?: string;
      /** [health] `held`: the reply's line waits as "Setting it…" while what it did is read back; `verify`: how that went (assistant/verify.ts). */
      held?: boolean; verify?: Verified }
  /** A tool at work; `progress` is what it is doing right now, replaced as it reports and gone once it finishes.
   *  `tool`, `args`: its name and its arguments in plain words, for WHY (features/core/why.ts). */
  | { kind: 'activity'; id: string; label: string; state: 'running' | 'ok' | 'fail'; detail?: string; progress?: Progress; tool?: string; args?: string }
  /** `via`: answered on Telegram (its APPROVE / NOT NOW buttons), not here. */
  | { kind: 'approval'; id: string; name: string; reason: string; args: Record<string, unknown>; state: 'waiting' | 'approved' | 'declined'; via?: 'telegram' }
  /** [talk] `cool`: every model cooling down, said at once with the time the first is back (BRIEF-TALK-1A 5); `cool.ask`, when the
   *  phone's brain was awake: the question ASK MY PHONE answers there. */
  | { kind: 'error'; text: string; ask?: string; cool?: { ask?: string }; /** The signal went with part of a reply on screen: what reached me stays above, and RETRY asks again */ lost?: boolean; /** A plain note in the log, not a failure: why a picture was not drawn (show/stage.ts); not kept */ note?: boolean; /** His words, when the send did not land: RETRY sends them again */ retry?: string }
  | { kind: 'link'; url: string; title: string }
  /** A plan design_home drew from the owner's words (features/core/homecard.ts): `id` is the kept plan's (features/space/home.ts). */
  | { kind: 'home'; id: string; rooms: number; m2: number; storeys: number }
  /** A live card (features/core/cards.ts): from a tool's result, the trigger table or a piece of the day. `once`: a vehicle's record, never kept. */
  | { kind: 'card'; card: Card; at: number; once?: boolean };

/**
 * A vehicle check from the chat is shown once (integrations/vehicle.ts on the brain): the plates
 * checked in this session (memory only) and whether this turn ran one. What the device keeps
 * leaves out the reply that gave the record and has "[plate]" for the plate.
 */
const checkedPlates = new Set<string>();
let vehicleTurn = false;
/** A plate whose car was shown from a card (features/core/cards.ts): kept on this phone as "[plate]" from now on, as a check's. */
export function notePlate(plate: string): void {
  const p = normalisePlate(plate);
  if (!p || checkedPlates.has(p)) return;
  checkedPlates.add(p);
  chat.set((s) => ({ entries: [...s.entries] }));
}
function kept(entries: Entry[]): Entry[] {
  const out = entries
    .filter((e) => !(e.kind === 'assistant' && e.once) && !(e.kind === 'card' && (e.once || e.card.once)) && !(e.kind === 'error' && e.note))
    // A THINK HARDER still running when Ghosty closes would come back as running for ever: it is kept as stopped.
    .map((e) => (e.kind === 'assistant' && e.think?.state === 'running' ? { ...e, think: { ...e.think, state: 'stopped' as const, line: 'I was closed while I was thinking, so I stopped.' } } : e));
  if (!checkedPlates.size) return out;
  return out.map((e) => (e.kind === 'user' || e.kind === 'assistant' || e.kind === 'error' ? { ...e, text: redactPlates(e.text, checkedPlates) } : e.kind === 'activity' && (e.detail || e.args) ? { ...e, ...(e.detail ? { detail: redactPlates(e.detail, checkedPlates) } : {}), ...(e.args ? { args: redactPlates(e.args, checkedPlates) } : {}) } : e.kind === 'card' ? { ...e, card: { ...e.card, title: redactPlates(e.card.title, checkedPlates), line: redactPlates(e.card.line, checkedPlates) } } : e));
}

/** The conversation is also kept on this device, so it's there even when the brain's history can't be read. */
export const chat = createStore({ entries: [] as Entry[], live: '' }, { persist: 'ghosty.chat', save: (s) => ({ entries: kept(s.entries) }) });
/**
 * WHERE THE TURN IS (BRIEF-QUALITY-CHAT: a turn's every state in one line under his words, features/core/words.ts turnWords): sending,
 * waiting for the brain, running a step (the narration's own line is the status), a reply being written, or stopped by him. Words only:
 * what is sent and what each streamed event means is not touched.
 */
export const turn = createStore({ phase: 'idle' as Phase });
const phase = (p: Phase): void => {
  if (turn.get().phase !== p) turn.set({ phase: p });
};
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
  social: 'Your accounts', // [social] a draft, a read or a search of his own accounts (BRIEF-SOCIAL)
};

/** A tool as one line of words ("Searching the web: …"): the thing an approval asks about. */
export const toolWords = (name: string, args: Record<string, unknown>): string => label(name, args);

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
  const tag = Number(c.owner);
  const reply = chat.get().entries.find((e): e is Extract<Entry, { kind: 'assistant' }> => e.kind === 'assistant' && e.at === tag);
  if (!reply) return;
  patch((e) => e === reply, (e) => ({ ...(e as Extract<Entry, { kind: 'assistant' }>), cut: true, heard: c.said }));
  // (a carrying on that is cut again: what he has heard of the brain's reply is what he heard before, and what he heard since)
  const said = reply.carries !== undefined ? [reply.heardBefore ?? '', c.said.replace(BRIDGE, '')].filter(Boolean).join(' ') : c.said;
  lastCut = { tag, parts: c.parts, at: c.at, said, head: reply.carries !== undefined ? (reply.head ?? '') : headOf(c.parts), when: Date.now() };
});

/**
 * [talk] The reply he cut off last as it was read out (BRIEF-TALK-1A 2; STARS 2): the pieces it was saying and the one it was
 * in (for "go on"), what he heard of the brain's reply it belongs to and that reply's first words (for the brain's next turn).
 * Good while that reply is still the latest; cleared once he says "go on" or the brain has been told.
 */
let lastCut: { tag: number; parts: string[]; at: number; said: string; head: string; when: number } | null = null;
/** How long after a cut "go on" still carries the reply on (later, it is an ordinary message). */
const CARRY_MS = 10 * 60_000;
/** The bridge back into a reply he cut off: what Ghosty says before the sentence he was cut in. */
const BRIDGE = /^…as I was saying,\s*/i;
/** A reply's first words as said (its first piece, at most eight words): how the brain finds which reply was cut. */
const headOf = (parts: string[]): string => (parts[0] ?? '').split(/\s+/).slice(0, 8).join(' ');
/** The latest reply in the chat, if any. */
const latestReply = (): Extract<Entry, { kind: 'assistant' }> | undefined => [...chat.get().entries].reverse().find((e): e is Extract<Entry, { kind: 'assistant' }> => e.kind === 'assistant');
/**
 * [reader] He cut a reply off after `t` and "go on" would still carry it on (BRIEF-LIBRARY-READER 3): a book stopped at `t` waits
 * while the reply he asked for mid-read is carried on first; the next "go on" goes back to the book.
 */
export function replyCutSince(t: number): boolean {
  const c = lastCut;
  return !!c && c.when > t && Date.now() - c.when <= CARRY_MS && latestReply()?.at === c.tag;
}
/** Words a sentence can start with that are lower-cased after the bridge ("…as I was saying, it changes"); a name keeps its capital. */
const COMMON = /^(?:the|a|an|it|it's|its|there|there's|that|that's|this|these|those|then|so|and|but|or|if|when|while|you|your|you're|we|our|they|their|he|she|his|her|my|on|in|at|for|from|to|with|after|before|once|also|just|both|each|every|most|some|all|no|not|one|two|three|here|here's|what|which|who|how|why|where|as|by|of|up|out|over|more|less|only|even|still|now|today|tomorrow|tonight|yes|sure|right|well|first|next|last)$/i;
const lowerFirst = (s: string): string => (COMMON.test(s.split(/\s+/)[0]!.replace(/[^\p{L}']/gu, '')) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

/**
 * "Go on", "and then?", "sorry, continue" just after he cut a reply off (BRIEF-TALK-1A 2): it carries on from the sentence he
 * cut it in, after "…as I was saying," — here at once, with no model and nothing sent: never again from the top. His words and
 * the carrying on are in the chat; the cut reply keeps its mark. False when there is nothing to carry on (an ordinary message).
 */
function carryOn(t: string, speakIt: boolean): boolean {
  const c = lastCut;
  if (!c || Date.now() - c.when > CARRY_MS || !continueIntent(t)) return false;
  const reply = latestReply();
  if (!reply || reply.at !== c.tag) return false;
  const rest = c.parts.slice(c.at);
  if (!rest.length) return false;
  lastCut = null;
  // (cut again in its own first sentence: one bridge, not two)
  const text = `…as I was saying, ${lowerFirst(rest[0]!.replace(BRIDGE, ''))}${rest.length > 1 ? ` ${rest.slice(1).join(' ')}` : ''}`;
  const asked = stamp();
  const at = stamp();
  const priv = reply.private ? { private: true } : {};
  chat.set((s) => ({
    entries: [
      ...s.entries.map((e) => (e === reply ? { ...reply, carried: true } : e)),
      { kind: 'user' as const, text: t, at: asked, ...priv },
      { kind: 'assistant' as const, text, at, ...(reply.model ? { model: reply.model } : {}), carries: reply.carries ?? reply.at, heardBefore: c.said, head: c.head, ...priv },
    ].slice(-120),
    live: text,
  }));
  if (speakIt && settings.get().speak) void speak(text, { owner: String(at), here: !!reply.private });
  return true;
}

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
function settle(ids?: Set<string>): void {
  patch(
    // (`ids`: this stream's own tools only — a newer turn may already be at work beside it: BRIEF-TALK-1A)
    (e) => e.kind === 'activity' && e.state === 'running' && (!ids || ids.has(e.id)),
    (e) => ({ ...(e as Extract<Entry, { kind: 'activity' }>), state: 'fail', detail: 'stopped', progress: undefined }),
  );
}

/** What goes with every turn (shell/awareness.ts: one function for the chat and the Lens: his time, name and saved place, and what is on screen). */
const context = () => clientContext(spokenTurn, turnVoice, heardNote());

let speakReplies = true;
/** This message was spoken, not typed. */
let spokenTurn = false;
/** Whose voice it was, when the phone knew voices and scored it (assistant/voiceknown.ts): the label the brain is told. */
let turnVoice: Label | undefined;

/** The entry (by its tag) a reply is being drawn in, a sentence at a time (BRIEF-KERNEL-YES 2); null when none is. */
let drawing: number | null = null;
/** [ci] The reply being said as it is written (NEXT ci.u1): its pieces go to the voice as they come. */
let saying: SpokenStream | null = null;

function handle(ev: ChatEvent): void {
  showNote(ev); // [showme] what this turn brought, for the Stage (nothing is drawn here)
  // (once he has stopped the turn, what still comes in never takes the line back from "Stopped")
  if (turn.get().phase !== 'stopped') {
    if (ev.t === 'tool' || ev.t === 'progress' || ev.t === 'status') phase('running');
    else if (ev.t === 'text' && (ev.part || ev.text)) phase('streaming');
  }
  switch (ev.t) {
    case 'status': {
      // [talk] a bare "thinking…" from the brain: the narration says what he is doing instead (BRIEF-TALK-1A 3)
      if (narr.on && BARE.test(ev.text.trim())) narrate(`step:${++narr.steps}`, narr.lastTool ? afterLine(narr.lastTool) : askLine(narr.ask));
      else ui.set({ status: ev.text });
      // [talk] every model it could use is cooling down: said in the chat at once, with the time (BRIEF-TALK-1A 5)
      const wait = WAITING.exec(ev.text.trim());
      if (wait) cooling(Number(wait[1]) * 1000);
      break;
    }
    case 'tool':
      toolRan = true;
      toolArgs.set(ev.id, ev.args);
      narr.lastTool = ev.name;
      narrate(`tool:${ev.id}`, toolLine(ev.name, label(ev.name, ev.args)));
      if (ev.name === 'vehicle_check') {
        vehicleTurn = true;
        if (typeof ev.args.plate === 'string' && normalisePlate(ev.args.plate)) checkedPlates.add(normalisePlate(ev.args.plate));
      }
      push({ kind: 'activity', id: ev.id, label: label(ev.name, ev.args), state: 'running', tool: ev.name, args: argWords(ev.args) });
      break;
    case 'progress':
      // (a count is said; a tool's own words — "fetching bbc.co.uk…" — go up but are not read out)
      narrate(`progress:${ev.id}:${ev.done ?? ev.label}`, progressLine(ev.label, ev.done, ev.total), typeof ev.done === 'number' && typeof ev.total === 'number');
      // Under the running tool's line, in place (never a new entry); the same id's tool_result removes it.
      patch(
        (e) => e.kind === 'activity' && e.id === ev.id && e.state === 'running',
        (e) => ({ ...(e as Extract<Entry, { kind: 'activity' }>), progress: progressOf(ev) }),
      );
      break;
    case 'tool_result': {
      // [health] it says it did a thing that leaves a record: read it back through the route that lists it (verify.ts)
      const rule = ev.ok ? ruleFor(ev.name, toolArgs.get(ev.id) ?? {}, ev.summary) : null;
      if (rule) {
        const args = toolArgs.get(ev.id) ?? {};
        verifies.push({ p: readBack(rule, args, ev.summary), rule, args, summary: ev.summary, tool: ev.name });
      }
      patch(
        (e) => e.kind === 'activity' && e.id === ev.id,
        (e) => ({ ...(e as Extract<Entry, { kind: 'activity' }>), state: ev.ok ? 'ok' : 'fail', detail: ev.ok ? undefined : ev.summary, progress: undefined }),
      );
      if (!chat.get().entries.some((e) => e.kind === 'activity' && e.id === ev.id)) push({ kind: 'activity', id: ev.id, label: label(ev.name, {}), state: ev.ok ? 'ok' : 'fail', detail: ev.ok ? undefined : ev.summary });
      break;
    }
    case 'client':
      void run(ev.name, ev.args);
      break;
    case 'approval':
      approvalAsked = true;
      push({ kind: 'approval', id: ev.id, name: ev.name, reason: ev.reason, args: ev.args, state: 'waiting' });
      followApproval(ev.id);
      if (speakReplies && settings.get().speak) void speak(ev.reason);
      break;
    case 'text': {
      narr.replied = true; // (no aside once the reply has begun: it is said instead)
      // [kernel-yes] The reply arrives a sentence at a time (`part`): drawn as it comes, one entry that grows; the whole reply, when it
      // lands, sets that entry's words (and is the one spoken); an empty whole takes the pieces back (the brain turned to a tool).
      // [health] while a thing it did is being read back, the pieces are not drawn: the whole reply is held as "Setting it…" below
      if (ev.part && verifies.length) break;
      if (ev.part) {
        const first = drawing === null;
        if (first) drawing = stamp();
        const at = drawing!;
        // [ci] said as it is written (NEXT ci.u1): the voice starts on the first sentence while the rest is still coming
        if (first && speakReplies && settings.get().speak) saying = speakStream({ owner: String(at), brief: true });
        saying?.add(ev.text);
        if (first) chat.set((s) => ({ entries: [...s.entries, { kind: 'assistant' as const, text: ev.text, at, ...(vehicleTurn ? { once: true } : {}) }].slice(-120), live: ev.text }));
        else {
          let grown = ev.text;
          chat.set((s) => ({ entries: s.entries.map((e) => (e.kind === 'assistant' && e.at === at ? ((grown = e.text + ev.text), { ...e, text: grown }) : e)), live: grown }));
        }
        break;
      }
      const drawn = drawing;
      drawing = null;
      // (what was being said of the pieces: finished from the whole below, or let go when the brain took them back)
      const said = saying;
      saying = null;
      if (drawn !== null && !ev.text) {
        said?.drop();
        chat.set((s) => ({ entries: s.entries.filter((e) => !(e.kind === 'assistant' && e.at === drawn)), live: '' }));
        break;
      }
      const at = drawn ?? stamp();
      // [health] the reply's line is held as "Setting it…" until what it says it did has been read back: then its sentence stands
      // with the tick, or it says it cannot see it yet (never a bare "Done")
      if (verifies.length && ev.text) {
        said?.drop();
        const pend = verifies;
        verifies = [];
        chat.set((s) => ({ entries: [...s.entries.filter((e) => !(e.kind === 'assistant' && e.at === at)), { kind: 'assistant' as const, text: 'Setting it…', at, held: true }].slice(-120), live: 'Setting it…' }));
        void Promise.all(pend.map((v) => v.p)).then((rs) => {
          const bad = rs.findIndex((r) => r === 'no');
          const first = bad >= 0 ? pend[bad]! : null;
          const text = first ? SAY_NO : ev.text;
          const verify: Verified = first
            ? { state: 'no', where: [], fail: { tool: first.tool, args: first.args, summary: first.summary, original: ev.text, show: first.rule.show } }
            : { state: 'ok', where: [...new Set(pend.map((v) => v.rule.where))] };
          chat.set((s) => ({ entries: s.entries.map((e) => (e.kind === 'assistant' && e.at === at ? { ...e, text, held: undefined, verify } : e)), live: text }));
          if (speakReplies && settings.get().speak) void speak(text, { owner: String(at), brief: true });
        });
        break;
      }
      // A cited answer: the caption leaves out the source list, and the voice the [n] markers too.
      const cited = looksCited(ev.text);
      // [talk] the voice is asked first, then the chat and the caption in one repaint: the first word does not wait on drawing
      if (said) said.end(cited ? spokenOf(ev.text) : ev.text);
      else if (speakReplies && settings.get().speak) void speak(cited ? spokenOf(ev.text) : ev.text, { owner: String(at), brief: true });
      if (drawn !== null) chat.set((s) => ({ entries: s.entries.map((e) => (e.kind === 'assistant' && e.at === drawn ? { ...e, text: ev.text } : e)), live: cited ? citedBody(ev.text) : ev.text }));
      else chat.set((s) => ({ entries: [...s.entries, { kind: 'assistant' as const, text: ev.text, at, ...(vehicleTurn ? { once: true } : {}) }].slice(-120), live: cited ? citedBody(ev.text) : ev.text }));
      break;
    }
    case 'mood':
      // his mood moved with this message (the brain's mood.ts): shown at once
      setMood(ev.mood);
      break;
    case 'cards':
      // [cards] what a tool found, as live cards under its line (built by code on the brain: packages/shared/src/cards.ts)
      for (const card of ev.cards) push({ kind: 'card', card, at: stamp(), ...(vehicleTurn || card.once ? { once: true } : {}) });
      // a plate he named shows its car at once; a car he just named is known from now on (cards.ts)
      void import('../features/core/cards').then((c) => c.arrived(ev.cards)).catch(() => undefined);
      break;
    case 'cited': {
      // Belongs to the reply just sent (the latest one still without its model line).
      const last = [...chat.get().entries].reverse().find((e) => e.kind === 'assistant');
      if (last) patch((e) => e === last, (e) => ({ ...(e as Extract<Entry, { kind: 'assistant' }>), cited: { citations: ev.citations, checks: ev.checks } }));
      break;
    }
    case 'error':
      vehicleTurn = false;
      // (the turn ends here: its tools still shown as running are settled by its stream, stream() below)
      push({ kind: 'error', text: ev.message, ...(retryAsk ? { retry: retryAsk } : {}) });
      chat.set({ live: ev.message });
      // [talk] no model free at all, in a spoken turn: said aloud too, in one sentence with the time (BRIEF-TALK-1A 5)
      if (noModelError(ev.message) && spokenTurn && speakReplies && settings.get().speak) void speak(coolSaid(ev.message));
      break;
    case 'done':
      vehicleTurn = false;
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
/** The words of the turn at work, for RETRY on an error card (a send that did not land). */
let retryAsk = '';
async function stream(fn: (cb: (e: ChatEvent) => void) => Promise<void>, offline?: () => Promise<string | null>, rescue?: (e: unknown) => Promise<boolean>, ask?: string): Promise<void> {
  // `ask`: a turn of the brain's, narrated from his words on (BRIEF-TALK-1A 3); without one, this phone's own work says its own.
  // "Sending…" while the words go out; once that has taken a moment, "Asking my brain…" (the first thing it says moves the line on)
  phase('sending');
  const waitTimer = window.setTimeout(() => turn.get().phase === 'sending' && phase('waiting'), SEND_MS);
  ui.set({ busy: true, voice: ui.get().voice === 'listening' ? 'listening' : 'thinking', status: ask === undefined ? 'thinking…' : askLine(ask) });
  const told = ask !== undefined ? narrateTurn(ask) : 0;
  retryAsk = ask ?? '';
  // [talk] Streams can overlap (he spoke again while a turn was at work, or talked over an aside): each settles only its own
  // tools when it ends, and the screen stops being busy only when the last of them has ended.
  streams++;
  const mine = new Set<string>();
  const cb = (ev: ChatEvent) => {
    if (ev.t === 'tool' || ev.t === 'tool_result' || ev.t === 'approval') mine.add(ev.id);
    if (ev.t === 'done' || ev.t === 'error') settle(mine);
    handle(ev);
  };
  const since = Date.now();
  toolRan = approvalAsked = false;
  verifies = [];
  toolArgs.clear();
  try {
    await fn(cb);
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') {
      // the owner said stop (or STOP, or spoke over him): he goes quiet, and the line under his words says so once
      phase('stopped');
    } else if (drawing !== null && !(e instanceof AuthError)) {
      // THE SIGNAL WENT with part of a reply on screen: what reached me stays, said once, and RETRY asks for the rest
      sayError(e, 'finish that');
      push({ kind: 'error', text: SIGNAL_WENT, lost: true, ...(ask ? { retry: ask } : {}) });
      drawing = null;
    } else if (!(e instanceof AuthError) && rescue && (await rescue(e).catch(() => false))) {
      // answered on the phone
    } else if (e instanceof AuthError) {
      ui.set({ connected: false });
      push({ kind: 'error', text: sayError(e, 'reach my brain'), ...(ask ? { retry: ask } : {}) });
      toast(sayError(e, 'reach the brain'), 'bad');
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
        const msg = sayError(e, 'answer that');
        push({ kind: 'error', text: msg, ...(ask ? { retry: ask } : {}) });
        toast(msg, 'bad');
      }
    }
  } finally {
    clearTimeout(waitTimer);
    if (told && narr.told === told) narrateEnd();
    vehicleTurn = false;
    settle(mine); // a stream that broke off (connection lost, stopped) sent no done or error event
    tally(since);
    if (--streams <= 0) {
      streams = 0;
      drawing = null; // (a reply drawn in pieces that never finished must not take the next turn's pieces in)
      saying = null;
      if (turn.get().phase !== 'stopped') phase('idle');
      ui.set({ busy: false, status: '' });
      if (ui.get().voice === 'thinking') ui.set({ voice: 'idle' });
    }
  }
}

/** How long a turn says "Sending…" before it says "Asking my brain…". */
const SEND_MS = 600;
/** [talk] How many streams are running now (they can overlap: see stream). */
let streams = 0;

/** What this stream did (for the independence meter): a tool ran; it ended asking for an approval (its answer comes after). */
let toolRan = false;
let approvalAsked = false;
/** [health] The things this turn's tools say they did, each being read back (assistant/verify.ts); the reply waits for them. */
let verifies: { p: Promise<'ok' | 'no'>; rule: Rule; args: Record<string, unknown>; summary: string; tool: string }[] = [];
const toolArgs = new Map<string, Record<string, unknown>>();

/**
 * [talk] NARRATION (BRIEF-TALK-1A 3; STARS 9): while the brain works, the status line says what he is doing in his own words,
 * from his ask, then each tool and its own report (narrate.ts) — never a bare "thinking". In a spoken turn, once the brain has
 * worked for ASIDE_AFTER_MS, each new step is also said as a short aside ("reading that page…"): once per step, never the
 * same words twice in a turn, never while he is talking or being listened to, ASIDE_GAP_MS apart at least, and never once
 * the reply has begun (it is said instead, and an aside still being said gives way to it at once: voice.ts).
 */
const narr = { on: false, told: 0, t0: 0, ask: '', key: '', say: '', sayAt: 0, steps: 0, lastTool: '', said: new Set<string>(), asideAt: 0, replied: false, spoken: false, timer: 0 };
const ASIDE_AFTER_MS = 1500;
const ASIDE_GAP_MS = 2000;
/** A step must last this long to be said (a step the reply follows at once gets no aside to be cut short). */
const STEP_GRACE_MS = 400;
/** The newest turn is narrated (one at a time: the newest is what he is waiting on); its number, so only it ends its narration. */
function narrateTurn(ask: string): number {
  clearInterval(narr.timer);
  const now = Date.now();
  Object.assign(narr, { on: true, told: narr.told + 1, t0: now, ask, key: '', say: askLine(ask), sayAt: now, steps: 0, lastTool: '', said: new Set<string>(), asideAt: 0, replied: false, spoken: spokenTurn && speakReplies });
  // (the first aside can only come at 1.5 s; this also catches a moment the voice or the ear has just let go)
  narr.timer = window.setInterval(aside, 250);
  return narr.told;
}
function narrateEnd(): void {
  narr.on = false;
  clearInterval(narr.timer);
}
/** A new step of the turn at work: its line goes up; `say` (a tool, a count, the step after the tools) may also be said. */
function narrate(key: string, line: string | null, say = true): void {
  if (!narr.on || narr.replied || !line || key === narr.key) return;
  narr.key = key;
  ui.set({ status: line });
  if (!say) return;
  narr.say = line;
  narr.sayAt = Date.now();
}
/**
 * [talk] MODEL SUPPLY, as the phone says it (BRIEF-TALK-1A 5; STARS 83). The brain counts down "waiting for free AI room · N s"
 * while every model it could use is cooling down or full (llm/router.ts): a wait of COOL_SAY_MS or more is said in the chat at
 * once — one sentence with the time the first is back — and aloud in a spoken turn; when the brain on this phone is awake,
 * ASK MY PHONE under it ends the wait and the phone answers. A turn with no model at all says the same in its error.
 */
const WAITING = /^waiting for free AI room · (\d+) s$/;
const COOL_SAY_MS = 4000;
/** The brain's turn now under way: his ask and recent turns (for ASK MY PHONE), how to end its request, and when it is over. */
let cloudTurn: { ask: string; recent: { role: 'user' | 'assistant'; text: string }[]; stop: AbortController; done: Promise<void>; said: boolean } | null = null;
/** The time a wait of `ms` from now ends, as he reads times ("14:32"). */
const backAt = (ms: number): string => fmt.time(new Date(Date.now() + ms));
function cooling(ms: number): void {
  const c = cloudTurn;
  if (!c || c.said || ms < COOL_SAY_MS) return;
  c.said = true;
  ui.set({ coolUntil: Date.now() + ms });
  const phone = settings.get().offlineBrain !== 'off' && modelWarm();
  const at = backAt(ms);
  const text = phone ? `My models are all cooling down until ${at}; tap ASK MY PHONE and the brain on your phone answers now.` : `My models are all cooling down; the first is back at ${at}, and I'll answer then.`;
  push({ kind: 'error', text, cool: phone ? { ask: c.ask } : {} });
  chat.set({ live: text });
  if (spokenTurn && speakReplies && settings.get().speak) void speak(text, { aside: true });
}
/** The brain's "no model is free" as one sentence said aloud, with the time the first is back when it gives one. */
function coolSaid(message: string): string {
  const secs = /frees up in about (\d+) seconds?/.exec(message)?.[1];
  const at = /back at (\d{1,2}:\d{2})/.exec(message)?.[1] ?? (secs ? backAt(Number(secs) * 1000) : '');
  return at ? `My models are all cooling down; the first is back at ${at}.` : 'My models are all cooling down, and none can answer right now.';
}

/**
 * ASK MY PHONE (BRIEF-TALK-1A 5): the turn waiting for a model ends, here and in the brain (a quiet cancel: no stop, no mood),
 * and the brain on this phone answers his question now, as when there is no signal.
 */
export async function askPhone(ask: string): Promise<void> {
  const c = cloudTurn && cloudTurn.ask === ask ? cloudTurn : null;
  patch((e) => e.kind === 'error' && e.cool?.ask === ask, (e) => ({ ...(e as Extract<Entry, { kind: 'error' }>), cool: {} }));
  if (c) {
    c.stop.abort();
    void brain.cancel().catch(() => undefined);
    await c.done.catch(() => undefined);
  }
  await stream(async () => {
    if (!(await answerHere(ask, c?.recent ?? []))) push({ kind: 'error', text: "The brain on your phone couldn't answer that either; I'll answer it as soon as a model is back." });
  });
}

function aside(): void {
  if (!narr.on || narr.replied || !narr.spoken || !settings.get().speak) return;
  const now = Date.now();
  const v = ui.get().voice;
  if (now - narr.t0 < ASIDE_AFTER_MS || now - narr.sayAt < STEP_GRACE_MS || now - narr.asideAt < ASIDE_GAP_MS || v === 'speaking' || v === 'listening' || narr.said.has(narr.say)) return;
  narr.said.add(narr.say);
  narr.asideAt = now;
  void speak(narr.say, { aside: true }).finally(() => (narr.asideAt = Date.now()));
}

/**
 * The independence meter (core/independence.ts): the answer this stream gave, counted once by where it was answered (its
 * model line). One that ended asking for an approval is counted when the approved part answers; THINK HARDER counts itself.
 */
function tally(since: number): void {
  if (approvalAsked) return;
  const a = [...chat.get().entries].reverse().find((e): e is Extract<Entry, { kind: 'assistant' }> => e.kind === 'assistant' && e.at >= since && !!e.text.trim() && !e.think);
  // (each answer once: with two streams at work, the one that ends second must not count the other's answer again)
  if (!a || counted.has(a.at)) return;
  counted.add(a.at);
  noteAnswer(a.model, { kept: !!a.private, tool: toolRan, length: a.text.length, ...(turnCat ? { cat: turnCat } : {}) });
}
/** The answers the meter has counted (their tags), this session. */
const counted = new Set<number>();
/** The kind of ask this turn is (offline/trust.ts `categorise`): the meter counts each answer by it too. */
let turnCat: AskCat | undefined;

const OFFLINE_MODEL = 'On this phone · offline';
/** [offline2] An answer the phone gave FIRST (its kind trusted), and one worked out on it with no model (a sum). */
const FIRST_MODEL = 'On this phone · first';
const WORKED_MODEL = 'On this phone · worked out';
/** A question answered on the phone with no model at all ("can you…?", a timer…): his own, for the meter. */
const LOCAL_MODEL = 'On this phone · no model';
/** An offline fallback that already put its own answer in the log. */
const HANDLED = '\u0000handled';

/** A website built on the phone (no brain needed): the questions, or the finished site with its buttons. */
async function siteHere(t: string, priv = false): Promise<void> {
  phase('running');
  ui.set({ status: 'building on your phone…' });
  const r = await offlineSiteReply(t);
  push({ kind: 'assistant', text: r.text, at: Date.now(), model: 'On this phone · website kit', offline: true, ...(r.site ? { site: r.site } : {}), ...(priv ? { private: true } : {}) });
  chat.set({ live: r.text });
}

/**
 * A phone-first answer (offline/trust.ts) is an optimisation and never holds a turn hostage (the owner, 2 Nov, speaking to
 * Ghosty: "he literally isn't responding, just thinking for so long and not responding at all, to the point I talk like 10
 * times back to back with 0 response"): it gets this long to its first word and this long in all, then the cloud answers.
 */
const FIRST_WORD_MS = 5_000;
const FIRST_ALL_MS = 20_000;

type FirstEnd = 'cloud' | 'stopped';
/**
 * The phone-first attempt being made now, if any (one at a time: it needs the model free). `end('cloud')` gives it up so the
 * cloud answers the ask instead (it ran out of time, or a newer message came); `end('stopped')` is the owner's stop in words:
 * nothing more is said or sent. Only this path: a task kept on the phone is never ended by either (it has no cloud to go to).
 */
let firstTry: { end(how: FirstEnd): void } | null = null;

/** The budget of one phone-first attempt: the signal that ends its generation, the way it left, and the timers that give it up. */
function budgeted() {
  const ctl = new AbortController();
  const state = { how: null as FirstEnd | null };
  let leave: () => void = () => undefined;
  // (what the turn waits on besides the model: an engine that never answers its abort must not keep the turn)
  const left = new Promise<void>((resolve) => (leave = resolve));
  const end = (how: FirstEnd): void => {
    if (state.how) return;
    state.how = how;
    ctl.abort();
    leave();
  };
  const word = setTimeout(() => end('cloud'), FIRST_WORD_MS);
  const all = setTimeout(() => end('cloud'), FIRST_ALL_MS);
  firstTry = { end };
  return {
    signal: ctl.signal,
    state,
    left,
    /** A first word came: only the whole-answer limit is left. */
    heard: () => clearTimeout(word),
    /** The attempt is over, however it ended. */
    over: () => {
      clearTimeout(word);
      clearTimeout(all);
      if (firstTry?.end === end) firstTry = null;
    },
  };
}

/**
 * Answer on the phone itself with the offline brain (offline/brain.ts): the reply streams into
 * its entry like any other and is spoken the usual way. False (and nothing left on screen) if the
 * model could not answer; true, with nothing spoken, when the owner said "stop". `priv`: a task kept on the phone (its
 * reply is marked private and read out in the phone's own voice: Ghosty's voice is made by the brain).
 * `first`: answered here FIRST (its kind is trusted): then it has a budget (above) and never loads the model inside the
 * turn; false means the cloud answers, exactly as when the phone could not answer after all.
 */
async function answerHere(t: string, recent: { role: 'user' | 'assistant'; text: string }[], priv = false, first: First | null = null): Promise<boolean> {
  // The model is not in memory (a cold load on a phone takes tens of seconds and can hang), or another job has it: the cloud
  // answers at once, with no card shown, and the model is warmed in the background so the next ask can go first.
  if (first && !modelWarm()) {
    warmUp();
    return false;
  }
  const at = stamp();
  const mine = (e: Entry) => e.kind === 'assistant' && e.at === at && !!e.offline;
  const show = (text: string) => patch(mine, (e) => ({ ...(e as Extract<Entry, { kind: 'assistant' }>), text }));
  const remove = () => chat.set((s) => ({ entries: s.entries.filter((x) => !mine(x)) }));
  // "Translate this into Spanish" with no signal: the same small model, asked only to translate (roughly; the card says so).
  const tr = translateAsk(t, [...recent].reverse().find((x) => x.role === 'assistant')?.text ?? '');
  // [health] the phone's own brain answering because the cloud could not: a fallback in use, said on the health marks
  if (!first) void import('../abilities/health').then((m) => m.noteFallback('brain')).catch(() => undefined);
  push({ kind: 'assistant', text: '', at, model: first ? FIRST_MODEL : OFFLINE_MODEL, offline: true, ...(tr ? { tr: { to: tr.to } } : {}), ...(priv ? { private: true } : {}), ...(first ? { first } : {}) });
  phase('running');
  ui.set({ status: tr ? 'translating on your phone…' : modelWarm() ? 'thinking on your phone…' : 'Waking the brain on this phone. Twenty seconds or so.' });
  let raw = '';
  let painted = 0;
  const b = first ? budgeted() : null;
  try {
    const run = tr ? translateOffline(tr.text, tr.to, (piece) => {
      b?.heard();
      raw += piece;
      if (Date.now() - painted > 120) {
        painted = Date.now();
        show(cleanTranslation(raw, tr.to));
      }
    }, b?.signal) : answerOffline(t, recent, (piece) => {
      b?.heard();
      raw += piece;
      // A repaint per word redraws the whole log: a few times a second is smooth enough.
      if (Date.now() - painted > 120) {
        painted = Date.now();
        show(cleanReply(raw));
      }
    }, { first: !!first, ...(b ? { signal: b.signal } : {}) });
    if (b) void run.catch(() => undefined); // (let go of: whatever it does after the turn has gone on is not this turn's)
    const r = b ? await Promise.race([run, b.left.then(() => null)]) : await run;
    // Given up (late, or a newer message): the card goes, with whatever it had, so nothing of it is counted as the phone's
    // answer (the meter counts the reply the cloud gives instead), and the cloud answers.
    if (b?.state.how === 'cloud') {
      remove();
      return false;
    }
    if (b?.state.how === 'stopped') throw Object.assign(new Error('stopped'), { name: 'AbortError' });
    if (!r?.text) throw new Error('no reply');
    show(r.text);
    chat.set({ live: r.text });
    // (a translation is read aloud in its own language's voice by its READ ALOUD button, not in Ghosty's English one)
    if (speakReplies && settings.get().speak && !tr) void speak(r.text, { owner: String(at), brief: true, here: priv });
    return true;
  } catch (e) {
    if (b?.state.how === 'cloud') {
      remove();
      return false;
    }
    // Stopped by the owner: what was written so far stays, nothing is spoken, and no error shows.
    const said = (tr ? cleanTranslation(raw, tr.to) : cleanReply(raw)).trim();
    if ((e as Error)?.name === 'AbortError' && said) {
      show(said);
      return true;
    }
    remove();
    if ((e as Error)?.name === 'AbortError') return true;
    // A brain that closed Ghosty before is refused in plain words (offline/brain.ts): said, so the silence is explained.
    if ((e as { refuse?: boolean })?.refuse) toast(sayError(e, 'start that brain'), 'warn');
    console.warn('offline brain', e);
    return false;
  } finally {
    b?.over();
  }
}

const THINK_MODEL = 'On this phone · THINK HARDER';

/** The owner's last real question (not a "think harder" or a "stop"), for "think harder" said on its own. */
function lastQuestion(): string {
  const users = chat.get().entries.filter((e): e is Extract<Entry, { kind: 'user' }> => e.kind === 'user');
  for (const u of users.reverse()) {
    const ask = thinkAsk(u.text);
    if (ask) return ask;
    if (ask === null && !stopIntent(u.text)) return u.text;
  }
  return '';
}

/**
 * THINK HARDER: the offline brain on this phone spends up to about a minute on the question (several
 * attempts, a search over reasoning steps, exact checks where there are any) and answers with how sure it
 * is. Never a cloud model. `asked`: the owner's message is already in the log (they typed "think harder"); `private`: a
 * task kept on the phone (its entries are marked so, and the answer is read out in the phone's own voice).
 */
export async function thinkHarderAbout(question: string, opts: { asked?: boolean; private?: boolean } = {}): Promise<void> {
  const q = question.trim() || lastQuestion();
  // A question that was kept on the phone stays there when it is thought about harder (its button, or "think harder" said
  // after it): its entries are private too, and the answer is read in the phone's own voice (OWNER-ISSUES 72).
  const kept = !!opts.private || chat.get().entries.some((e) => e.kind === 'user' && !!e.private && (e.text === q || e.text === `Think harder: ${q}`));
  const priv = kept ? { private: true } : {};
  if (!opts.asked) push({ kind: 'user', text: `Think harder: ${q || '(no question)'}`, at: stamp(), ...priv });
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
  push({ kind: 'assistant', text: '', at, model: THINK_MODEL, offline: true, think: { q, state: 'running', line: 'starting…' }, ...priv });
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
    if (!r.stopped && (r.text || r.answer)) noteAnswer(THINK_MODEL, { kept, length: (r.text || r.answer || '').length, cat: categorise(q) });
    const said = r.answer ? `${r.answer} (${r.line})` : r.line;
    chat.set({ live: said });
    if (speakReplies && settings.get().speak && r.answer) void speak(`${r.answer}. ${r.line.split(' (')[0]}.`, { owner: String(at), here: kept });
  } catch (e) {
    chat.set((s) => ({ entries: s.entries.filter((x) => !mine(x)) }));
    if ((e as Error)?.name !== 'AbortError') push({ kind: 'error', text: sayError(e, 'answer that') });
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

/**
 * ASK THE CLOUD under an answer the phone gave FIRST (offline/trust.ts): the same ask to the cloud, the phone's answer
 * kept above it and struck faintly; a miss for its kind on that brain (three in a week put the kind back to the cloud
 * until its next report card), and the meter counts the ask where it was answered in the end.
 */
export async function askCloud(at: number): Promise<void> {
  const es = chat.get().entries;
  const i = es.findIndex((e) => e.kind === 'assistant' && e.at === at);
  const a = es[i] as Extract<Entry, { kind: 'assistant' }> | undefined;
  if (!a?.first || a.struck) return;
  const q = es.slice(0, i).reverse().find((e): e is Extract<Entry, { kind: 'user' }> => e.kind === 'user')?.text;
  if (!q) return;
  patch((e) => e.kind === 'assistant' && e.at === at, (e) => ({ ...(e as Extract<Entry, { kind: 'assistant' }>), struck: true }));
  noteMiss(a.first.cat, a.first.model);
  unnoteAnswer(a.model, a.at, { cat: a.first.cat });
  await send(q, { speak: settings.get().speak, cloud: true, again: true });
}

/**
 * Send a message to Ghosty. `cloud`: the owner asked for the brain's models (ASK THE BIG BRAIN), even with the offline
 * brain on "always". `here`: ON THIS PHONE for this one message, as "always" is for every message. `plain`: never answered
 * here from what Ghosty knows of himself (DO IT under such an answer sends his words on, as a request). `again`: ASK THE
 * CLOUD (the question is on screen already, above the phone's answer).
 */
export async function send(text: string, opts: { speak?: boolean; voice?: boolean; cloud?: boolean; here?: boolean; plain?: boolean; again?: boolean; as?: Label } = {}): Promise<void> {
  const t = wallSplit(text.trim()); // [wall] "where is Lisbon, on the wall": the ask, with this turn's picture bound for the wall
  if (!t) return;
  showBegin(t); // [showme] his next word takes the Stage away and starts this turn's tally
  // [voiceknown] the sound of this spoken turn is taken now, before anything waits (a later listen would replace it)
  const snd = opts.voice ? takeSound() : null;
  // [guardian] Before anything reads his words: the panic phrase (the message goes at once, and nothing of it reaches the
  // chat or the model), then the walk home's words; with PEOPLE open in the Lens, an introduction or "who's this?" is
  // answered there, on the phone — the stop and the raising readings never see them, and the brain never does.
  if (await guardTurn(t, { voice: opts.voice })) return;
  if (await faceTurn(t, opts.voice)) return;
  // [wall] his words about the wall (pairing it, sending a picture, resting it) are answered on the phone, with no model
  if (await wallTurn(t)) return;
  // [reader] a book read to him, by words, with no model (BRIEF-LIBRARY-READER 4): "go on" just after the book was cut (from the
  // sentence he was in), a plain "stop" while it is read (the page said; a harsh one stays the silent stop below), "read me …",
  // "carry on reading", "where were we", a chapter, a page, "just this chapter", "stop reading"
  if (await import('../features/library/reader').then((r) => r.readingTurn(t, { voice: opts.voice, speak: opts.speak })).catch(() => false)) return;
  // A stop by intent, not a keyword (OWNER-ISSUES 70a: "shut the fuck up", "enough", "leave it", typos and all; intent.ts):
  // absolute and at once, whatever he was saying or arguing, and never answered.
  const stop = stopIntent(t);
  if (stop) {
    stopSpeaking();
    stopListening();
    stopOffline();
    firstTry?.end('stopped'); // (a phone-first answer still being thought: ended now, even if the model is slow to hear it)
    stopThinking();
    // His mood (OWNER-ISSUES 70b): a harsh stop leaves him subdued, any other puts him back to calm — here at once, and in
    // the brain; with everything kept on this phone ("always") not even that a stop happened leaves it.
    feelHere({ kind: 'stop', harsh: stop.harsh });
    if (ui.get().busy) phase('stopped');
    const kept = settings.get().offlineBrain === 'always';
    if (ui.get().busy || !kept) await brain.stop(kept ? undefined : stop.harsh).catch(() => undefined);
    return;
  }
  // [voiceknown] WHOSE VOICE (BRIEF-VOICE-KNOWN 3): scored on the phone and shown on the talk bar; a voice I don't know holds the
  // turn for a tap (GO ON sends it, still as unknown) unless the hour's grace is on. Never a lock: the stop above and the panic
  // phrase before it are never held, and nothing the confirm tap guards is opened or closed by it. Typed turns clear the tag.
  let who: Label | undefined = opts.as;
  if (!opts.voice) clearTag();
  else if (!who) {
    const h = await hear(snd);
    who = labelOf(h);
    if (h && h.label === 'unknown' && !graceOn()) {
      hold(t, () => void send(t, { ...opts, as: labelOf(h) ?? 'unknown' }));
      return;
    }
  }
  // The phone's library passages for the brain (api/brain.ts chat) are looked up from now, while the rest of this is decided,
  // so they never hold the message back (BRIEF-TALK-1A 1).
  const library = passagesFor(t).catch(() => [] as unknown[]);
  // "reboot": the boot cinematic again, here on the phone (shell/boot.ts); the brain is not asked
  if (REBOOT.test(t)) {
    await import('../shell/boot').then((b) => b.reboot());
    return;
  }
  // "go on" after a reply he cut off: carried on from where he cut it, on the phone (BRIEF-TALK-1A 2)
  if (carryOn(t, opts.speak ?? true)) return;
  // A newer message while a phone-first answer is still being thought (he spoke again, or tapped the mic and said it again):
  // that attempt is cut short first, so it never makes this message wait, and the cloud answers its ask. Only that path:
  // what is kept on the phone is never ended by a newer message (it has no cloud to go to).
  firstTry?.end('cloud');
  // A change still waiting for its UNDO bar (a cleared conversation) is made before the brain hears the new message.
  await flushUndo();
  // About Ghosty himself ("can you …?"): answered here from what is really there, with no model (assistant/local.ts)
  const localPriv = settings.get().offlineBrain === 'always' || !!opts.here;
  if (!opts.cloud && !opts.plain && (await localTurn(t, { voice: opts.voice, private: localPriv }))) {
    // [offline2] answered on the phone with no model: his own, on the independence meter too
    noteAnswer(LOCAL_MODEL, { kept: localPriv, cat: categorise(t) });
    return;
  }
  // [voice lane] MANY WORDINGS, ONE MEANING (assistant/meaningturn.ts): "put some tunes on", "log a pint", "kill the lights" — read
  // to the one ability they mean, after every table had his words as said; "play something" asks which, with both as keys
  if (!opts.cloud && !opts.plain && (await import('./meaningturn').then((m) => m.meaningTurn(t, { voice: opts.voice, private: localPriv })).catch(() => false))) {
    noteAnswer(LOCAL_MODEL, { kept: localPriv, cat: categorise(t) });
    return;
  }
  speakReplies = opts.speak ?? true;
  spokenTurn = opts.voice === true;
  turnVoice = spokenTurn ? who : undefined;
  const mode = settings.get().offlineBrain;
  // Kept on the phone (OWNER-ISSUES 72: it fails CLOSED): "always", or ON THIS PHONE for this message. Only ASK THE BIG
  // BRAIN, which he taps, ever sends such a message to the brain.
  const priv = keptTurn({ cloud: opts.cloud, here: opts.here, mode });
  const turns = chat
    .get()
    .entries.filter((e): e is Extract<Entry, { kind: 'user' | 'assistant' }> => e.kind === 'user' || e.kind === 'assistant')
    .slice(-12);
  // (a reply he cut off is, to whatever reads it next, only what he heard of it: BRIEF-TALK-1A 2)
  const asHeard = (e: Extract<Entry, { kind: 'user' | 'assistant' }>) => (e.kind === 'assistant' && e.cut && e.heard !== undefined ? `${e.heard}${e.heard ? ' ' : ''}[cut off here: he heard no more of this reply]` : e.text);
  const recent = turns.map((e) => ({ role: e.kind, text: asHeard(e).slice(0, 1500) }));
  // [offline2] the kind of ask (offline/trust.ts): whether the phone may answer it first, and the meter's count by kind
  turnCat = categorise(t, [...turns].reverse().find((e) => e.kind === 'assistant')?.text ?? '');
  // What the brain may read of the conversation: never a turn that was kept on the phone, nor an answer he sent on to the cloud.
  let shared = turns.filter((e) => !e.private && !(e.kind === 'assistant' && e.struck)).map((e) => ({ role: e.kind, text: asHeard(e).slice(0, 1500) }));
  // ASK THE CLOUD: the question is on screen already, above the phone's answer: not shown again, nor sent twice.
  if (opts.again) {
    const k = shared.map((x) => x.role === 'user' && x.text === t.slice(0, 1500)).lastIndexOf(true);
    if (k >= 0) shared = shared.filter((_, i) => i !== k);
    chat.set({ live: t });
  } else chat.set((s) => ({ entries: [...s.entries, { kind: 'user' as const, text: t, at: Date.now(), ...(priv ? { private: true } : {}) }].slice(-120), live: t })); // (one repaint, not two)
  phase('sending'); // (the line under his words says so until the turn is at work)
  // The stopwatch (core/stopwatch.ts): a reply from the brain, from here to its first words and its end, as the owner sees them.
  const lap = stopwatch.reply();
  // "think harder" (alone: the last question; or with one): the phone's model, with more effort.
  // Never with the offline brain switched off: then it is an ordinary message for the brain.
  const harder = opts.cloud || mode === 'off' ? null : thinkAsk(t);
  if (harder !== null) {
    phase('idle'); // (THINK HARDER keeps its own live line in its card)
    return thinkHarderAbout(harder, { asked: true, private: priv });
  }
  // A website with no brain to ask (kept on the phone, or no connection): built here from the website kit. Never a
  // message taken over while the brain can be asked (the answers to the phone's questions then go to the brain too).
  if (!opts.cloud && offlineSiteTurn(t) && (priv || navigator.onLine === false)) {
    await stream(async () => siteHere(t, priv));
    return;
  }
  if (priv) {
    // The phone's own brain or nothing: not the first try, not a retry, not a fallback reaches the brain. When it cannot
    // answer, the task stops and says why; the brain is only an offer (ASK THE BIG BRAIN on the message, a tap).
    await stream(async () => {
      // Never a 352 MB download on the first message (perhaps on mobile data): only DOWNLOAD in Settings fetches it.
      // (offline/trust.ts keptAnswer: the phone's brain or the stop in words; it has no way to the cloud in it)
      await keptAnswer(mode, {
        ready: () => offlineReady(),
        answer: () => answerHere(t, recent, true),
        stop: (why, words) => {
          push({ kind: 'error', text: words, ask: t });
          // SOVEREIGN MODE's list (core/independence.ts): what stopped for want of the cloud, kept on this phone only
          noteStopped(t, why);
        },
      });
    });
    return;
  }
  // [offline2] TRUST BY GRADE (offline/trust.ts): what the brain sitting on this phone has passed is answered here FIRST,
  // tagged "on this phone", with ASK THE CLOUD under it; a sum is worked out with no model first. Should the phone not
  // answer after all, the cloud does, as before: this is not a task he kept on the phone (those never reach this line).
  // That includes the model not being in memory (it is not loaded inside this turn: it is warmed for the next ask), a first
  // word that does not come in 5 s or an answer not done in 20 s (answerHere), and a newer message (above).
  // (not DO IT under a "can you…?" answer: he meant it as a request for the brain)
  if (!opts.plain && mayGoFirst({ cloud: opts.cloud, here: opts.here, again: opts.again, mode, cat: turnCat })) {
    const first = await trustFirst(turnCat);
    if (first) {
      let done = false;
      await stream(async () => {
        const sum = first.cat === 'sums' ? workedOut(t) : null;
        if (!sum) return void (done = await answerHere(t, recent, false, first));
        const at = stamp();
        push({ kind: 'assistant', text: sum, at, model: WORKED_MODEL, offline: true, first });
        chat.set({ live: sum });
        if (speakReplies && settings.get().speak) void speak(sum, { owner: String(at), brief: true });
        done = true;
      });
      if (done) return;
    }
  }
  // When the brain can't answer (no connection, a server error, no free model), the phone's own model does — if it's here.
  // (not for ASK THE CLOUD: he asked for the cloud's answer; if it cannot give one, he is told so)
  const here = !opts.again && mode !== 'off' && (await offlineReady().catch(() => false));
  // The brain already said or did something this turn (a reply, a tool run, an approval asked, an
  // on-screen action): the small model can't see any of it, so the brain's own error stands.
  let acted = false;
  let held: Extract<ChatEvent, { t: 'error' }> | null = null;
  // A reply he cut off is still the latest: the brain is told what he heard of it (BRIEF-TALK-1A 2), so its next turn never
  // assumes he heard the rest. The cut reply itself stays on screen as it was.
  const cut = lastCut && latestReply()?.at === lastCut.tag ? lastCut : null;
  const heard = cut ? { said: cut.said, head: cut.head } : undefined;
  lastCut = null;
  const rescue = async (e: unknown) => here && !acted && shouldFallBack(e) && answerHere(t, recent);
  const ended = new AbortController();
  let over: () => void = () => undefined;
  const turn = { ask: t, recent, stop: ended, done: new Promise<void>((r) => (over = r)), said: false };
  cloudTurn = turn;
  await stream(
    async (cb) => {
      await readyWork(t); // [sites] the game open in the studio goes to the brain first, for "put it on my sites"
      await brain.chat(t + openDocData() + openWorkData(t) + (await import('./meaningturn').then((m) => m.meaningNote(t)).catch(() => '')), context(), (ev) => {
        lap.saw(ev.t);
        if (ev.t === 'text' || ev.t === 'tool' || ev.t === 'tool_result' || ev.t === 'progress' || ev.t === 'approval' || ev.t === 'client') acted = true;
        // "No model is free" before anything happened: held back, answered on the phone instead (shown as usual if that fails).
        if (here && !acted && ev.t === 'error' && noModelError(ev.message)) {
          held = ev;
          return;
        }
        cb(ev);
      }, ended.signal, shared, settings.get().cited, library, heard);
      if (held) {
        // [talk] no model is free, and the brain on this phone answers instead: said, so the wait for it is never silent
        const said = `${coolSaid((held as { message: string }).message).replace(/\.$/, '')}, so the brain on your phone is answering this one.`;
        phase('running');
        ui.set({ status: 'the brain on your phone is answering…' });
        if (spokenTurn && speakReplies && settings.get().speak) void speak(said, { aside: true });
        if (!(await answerHere(t, recent))) cb(held);
      }
    },
    // [resta] a "what is X?" with no connection also offers X from the Wikipedia file on this phone (wiki/ask.ts)
    () => (offlineSiteTurn(t) ? siteHere(t).then(() => HANDLED) : offlineAnswer(t).then((a) => import('../wiki/ask').then((w) => w.offlineWiki(t, a)).catch(() => a))),
    rescue,
    t,
  );
  over();
  if (cloudTurn === turn) cloudTurn = null;
  lap.end();
  // [reste] a letter or a document he asked me to write: offered laid out as a DOCUMENT under the reply (docs/ask.ts)
  void import('../docs/ask').then((d) => d.offerDocument(t)).catch(() => undefined);
  // He brings things up himself (BRIEF-SIDEWAYS 2): the trigger table's cards for what his words called for (assistant/triggers.ts,
  // features/core/cards.ts bringUp); with none, the abilities revealed in context (OWNER-ISSUES 67b: abilities/offer.ts)
  void import('../features/core/cards').then((c) => c.bringUp(t)).catch(() => undefined);
  // [showme] the thing the answer is about, on the Stage (show/stage.ts): begun after the reply is on screen, never before it
  showEnd(t);
  // A reminder Ghosty just set may already be due ("in 1 minute"): check soon.
  setTimeout(() => void import('./notices').then((n) => n.pollInbox()), 2500);
}

export async function answerApproval(id: string, allow: boolean): Promise<void> {
  patch(
    (e) => e.kind === 'approval' && e.id === id,
    (e) => ({ ...(e as Extract<Entry, { kind: 'approval' }>), state: allow ? 'approved' : 'declined' }),
  );
  await stream((cb) => brain.approve(id, allow, cb), undefined, undefined, '');
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
    // [security] the same card on the lock screen as a phone notification, once (security.s10): a tap opens the chat at it
    void brain.approvalPush(id).catch(() => null);
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

/** [talk] What a spoken conversation ends on when he says "that's all" or "bye" (in turn, never the same twice running). */
const SIGN_OFFS = ['Okay. Shout if you need me.', "Right. I'm here when you want me.", 'Bye for now.'];
let signed = -1;
/**
 * He ended a spoken conversation ("that's all", "bye": BRIEF-TALK-1A 4): his words and a short sign-off go in the chat and the
 * sign-off is said. Answered here with no model (core/index.ts has already let the microphone go); nothing is sent.
 */
export function signOff(words: string): Promise<void> {
  const hour = new Date().getHours();
  const line = hour >= 22 || hour < 5 ? "Night. I'm here if you need me." : SIGN_OFFS[(signed = (signed + 1) % SIGN_OFFS.length)]!;
  const asked = stamp();
  const at = stamp();
  chat.set((s) => ({ entries: [...s.entries, { kind: 'user' as const, text: words, at: asked }, { kind: 'assistant' as const, text: line, at, model: LOCAL_MODEL }].slice(-120), live: line }));
  return settings.get().speak ? speak(line, { owner: String(at) }) : Promise.resolve();
}

/** Load recent conversation from the brain on start-up. */
export type HistoryReply = Awaited<ReturnType<typeof brain.history>>;
/** `ahead`: the history already asked for (main.ts asks while the brain's status is still on its way); null when that request failed. */
export async function loadHistory(ahead?: Promise<HistoryReply | null>): Promise<void> {
  try {
    const h = (await ahead) ?? (await brain.history());
    const entries: Entry[] = h.turns.slice(-30).flatMap((t): Entry[] => {
      if (t.role === 'user') return [{ kind: 'user', text: withoutOpenWork(withoutOpenDoc(t.text)), at: t.at }];
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
      // [recall] and from the phone's own recall index (features/memory/recall.ts)
      await import('../features/memory/recall').then((r) => r.clearTurns()).catch(() => undefined);
    },
  );
}
