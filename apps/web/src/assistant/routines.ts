/**
 * HIS OWN ONE-WORD ROUTINES (NEXT-ROUND consistency.s2, voice.s7): one word of his ("morning", "wind down", "movie time") runs a
 * few things in turn: a screen opened, a command of the app, words said to Ghosty. Made in Settings → ROUTINES
 * (features/settings/routines.ts) from the very YOU CAN lines the deck already has, or any words he types; kept on this phone
 * (`ghosty.routines`), carried by the backup with the rest of his settings' keys.
 *
 * His rule (NEXT-ROUND, "Approvals"): a routine never sends, posts, pays or publishes by itself. A step is only ever a screen, a
 * command of the app that moves him around (the deck's own), or his words to Ghosty, and words that would send something reach
 * the brain like any message of his, so the APPROVE card stops it there, every time.
 *
 * Pure: no screen code here, so the spec reads these very rules.
 */

/** What one step does: the deck's YOU CAN act (shell/deckcopy.ts DeckAct), kept as plain data. */
export type RoutineAct = { open: string; panel?: string } | { run: string; args?: Record<string, unknown> } | { ask: string };
export interface RoutineStep {
  /** As he reads it in the list ("Brief: your day in one look", "Say: how much water today?"). */
  label: string;
  act: RoutineAct;
}
export interface Routine {
  /** The word he says, as he typed it ("Morning"). */
  word: string;
  steps: RoutineStep[];
  at: number;
}

export const ROUTINES_KEY = 'ghosty.routines';
/** At most this many steps in one routine, and this many routines: one word, a handful of things. */
export const MAX_STEPS = 8;
export const MAX_ROUTINES = 24;

/** His words, as one word is compared: lower case, no punctuation, no spaces ("Movie time!" and "movietime" are one). */
export const wordKey = (s: string): string => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');

/** What he says to run one, beyond the bare word: "run morning", "start my wind down", "do movie time", "morning routine". */
const RUN = /^(?:(?:please\s+)?(?:run|start|do|play|begin)\s+(?:my\s+|the\s+)?)?(.+?)(?:\s+routine)?[\s.!?]*$/i;

/** A word he cannot use: these already mean something everywhere, whatever a routine says (the stop, the boot, the panic words). */
// (and the goodnight words: PLAN's wind-down, features/core/goodnight.ts, answers them — lights off, the night look, the radio's sleep timer)
const RESERVED = new Set(['stop', 'quiet', 'shutup', 'enough', 'cancel', 'reboot', 'help', 'undo', 'yes', 'no', 'approve', 'hi', 'hello', 'goodnight', 'nightnight', 'bedtime', 'timeforbed']);

/** Why a word will not do, in his words, or '' when it will. */
export function wordProblem(word: string, list: Routine[], editing?: string): string {
  const k = wordKey(word);
  if (!k) return 'Give it a word to say first.';
  if (word.trim().split(/\s+/).length > 3) return 'Keep it to three words at most, so it is quick to say.';
  if (RESERVED.has(k)) return `“${word.trim()}” already means something everywhere, so pick another word.`;
  if (list.some((r) => wordKey(r.word) === k && wordKey(r.word) !== wordKey(editing ?? ''))) return `You already have “${word.trim()}”: change that one instead.`;
  return '';
}

/** The routine his words run, if they are one of his words (alone, or with "run …" / "… routine"). */
export function routineFor(text: string, list: Routine[]): Routine | null {
  if (!list.length) return null;
  const t = text.trim();
  if (!t || t.length > 60) return null;
  const m = RUN.exec(t);
  const k = wordKey(m?.[1] ?? t);
  // (a word reserved since a routine was kept under it is never taken from what it means everywhere)
  if (RESERVED.has(k)) return null;
  return list.find((r) => wordKey(r.word) === k) ?? null;
}

/** "make a routine", "my routines", "new routine": where they are made. */
export const ROUTINES_ASKED = /^(?:(?:make|create|add|new|set up|edit|show)(?:\s+(?:me|a|my))?\s+(?:new\s+)?routines?|my routines|routines)[\s.!?]*$/i;

/** A step that stays inside the app: a screen, the deck's own commands, or his words to Ghosty. Anything else is dropped on load. */
export function safeAct(a: unknown): a is RoutineAct {
  if (!a || typeof a !== 'object') return false;
  const o = a as Record<string, unknown>;
  if (typeof o.ask === 'string') return o.ask.trim().length > 0 && o.ask.length <= 300;
  if (typeof o.open === 'string') return /^[\w-]+(?:\?[\w=-]+)?$/.test(o.open) && (o.panel === undefined || typeof o.panel === 'string');
  // (only commands that move him around, as the deck's own lines use: open_gym, show_cameras, journey_planner…)
  if (typeof o.run === 'string') return /^(?:(?:open|show|start)_[a-z_]+|journey_planner)$/.test(o.run);
  return false;
}

/** The list as it is kept, checked (a broken or old entry is left out, never run). */
export function parseRoutines(raw: string | null): Routine[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .filter((r): r is Routine => !!r && typeof r === 'object' && typeof (r as Routine).word === 'string' && Array.isArray((r as Routine).steps))
      .map((r) => ({ word: r.word.trim().slice(0, 40), at: typeof r.at === 'number' ? r.at : 0, steps: r.steps.filter((s) => s && typeof s.label === 'string' && safeAct(s.act)).slice(0, MAX_STEPS) }))
      .filter((r) => wordKey(r.word) && r.steps.length)
      .slice(0, MAX_ROUTINES);
  } catch {
    return [];
  }
}

export function loadRoutines(): Routine[] {
  try {
    return parseRoutines(localStorage.getItem(ROUTINES_KEY));
  } catch {
    return [];
  }
}

/** Kept on this phone; false when the phone would not keep it (a private window, storage full). */
export function saveRoutines(list: Routine[]): boolean {
  try {
    localStorage.setItem(ROUTINES_KEY, JSON.stringify(list.slice(0, MAX_ROUTINES)));
    return true;
  } catch {
    return false;
  }
}

/** The reply when one runs: what it will do, in order. */
export function runLine(r: Routine): string {
  return `${r.word.trim()}: ${r.steps.length} ${r.steps.length === 1 ? 'thing' : 'things'}, in turn.\n${r.steps.map((s, i) => `${i + 1}. ${s.label}`).join('\n')}${r.steps.some((s) => 'ask' in s.act) ? '\nAnything that would send or post still waits for your APPROVE.' : ''}`;
}

/** Starters he can add in one tap (the screens and words exist in every build: the spec checks each one opens). */
export const STARTERS: Routine[] = [
  {
    word: 'Morning',
    at: 0,
    steps: [
      { label: 'Brief: your day in one look', act: { open: 'brief' } },
      { label: 'Say: how much water have I had today?', act: { ask: 'How much water have I had today?' } },
      { label: 'Say: how are the roads?', act: { ask: 'How are the roads near me?' } },
    ],
  },
  {
    word: 'Wind down',
    at: 0,
    steps: [
      { label: 'Say: what is on tomorrow?', act: { ask: 'What is on tomorrow?' } },
      { label: 'Agenda: your days', act: { open: 'agenda' } },
    ],
  },
];
