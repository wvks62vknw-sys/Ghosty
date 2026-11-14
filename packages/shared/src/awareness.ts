/**
 * AWARENESS (BRIEF-AWARENESS PR A; the owner's decision of 5 Nov, OWNER-ISSUES 131: "the context line rides in his message to
 * the brain, never in the system prompt, so the prompt guard is untouched and nothing is trimmed").
 *
 * Every screen says what is open and what is selected in a `ScreenContext`. The phone sends it with each turn (`screen`, and
 * `screenLine`, the one line `contextWords` makes of it); the brain puts that line, marked as data, on the end of his message
 * (apps/edge/src/context.ts `withScreen`). The line never names a person the Lens saw, never a password, a key or anything
 * from the house's guarded set: nothing goes into it that was not already on the screen, plus the selection's label and detail.
 */
import type { Card } from './cards';
import type { ClientCommand } from './protocol';
import { CLIENT_COMMANDS } from './protocol';

/** What kind of thing is selected: a closed list, so the brain can rely on it. */
export const SELECTED_KINDS = ['item', 'wall', 'opening', 'room', 'part', 'fault', 'group', 'book', 'passage', 'card', 'thing'] as const;
export type SelectedKind = (typeof SELECTED_KINDS)[number];

/** The thing picked on a screen: `id` is what the brain's tools take; `label` is how he would say it; `detail` is one fact (≤80 chars: a wall's length, a part's state, a page). */
export interface Selected {
  kind: SelectedKind | string;
  id: string;
  label: string;
  detail?: string;
}

/** What one screen says about itself. `line`: one sentence of what is open (≤160 chars, no secrets, never who is in a picture). `at`: when it was made (ms). */
export interface ScreenContext {
  screen: string;
  title: string;
  line: string;
  selected?: Selected;
  /**
   * The short form a stamp line's LOOKING AT says (≤80 chars: "The Lighthouse Keeper", "the marks"), for a screen whose `line` is a
   * whole sentence; absent, the stamp says the line. It is never in `contextWords`: nothing else rides in his message.
   */
  looking?: string;
  at: number;
}

/** What the phone tells the brain with each message (moved here from apps/edge/src/prompt.ts: both sides use the one type). */
export interface ClientContext {
  now?: string;
  tz?: string;
  tab?: string;
  name?: string;
  location?: { name: string; lat: number; lon: number };
  /**
   * What is on screen: the phone sends a `ScreenContext`. (A string is Telegram's note, which agent.ts writes; the older phones
   * sent their one `describe()` line the same way.)
   */
  screen?: ScreenContext | string;
  /** `contextWords(screen)`, made on the phone for the brain to paste; the brain checks it and cuts it (`screenWords`). */
  screenLine?: string;
  /**
   * This turn was spoken (the app's microphone, a Telegram voice note): the reply will be heard. When the phone also scored the
   * voice (BRIEF-VOICE-KNOWN: a courtesy signal, never a lock) it is the label alone: 'owner', 'unknown' (also "not sure"), or
   * `{ name }` of a person he introduced; never a number. Any of them is true where `voice` was `true`. 'unsure' (FINAL ROUND, the
   * voice lane): a voice the phone heard but could not be sure of (between his and a stranger's, or two voices claiming it); the
   * phone treats it as unknown (it fails closed) and the brain is told "not sure".
   */
  voice?: boolean | 'owner' | 'unknown' | 'unsure' | { name: string };
  /**
   * What the phone knows of voices, on a turn from the app (FINAL ROUND, the voice lane: his "it says it recognises me in the
   * settings … but the actual chat says he has no way of recognising me"): `taught`, whether his own voice is taught to this phone
   * (Settings, Voices I know); `last`, whose voice it last recognised and `mins` how long ago (a typed turn, within half an hour).
   * Words and a whole number only, never a score; never a lock.
   */
  heard?: { taught: boolean; last?: 'owner' | { name: string }; mins?: number };
  /**
   * Where he is, as the phone decided it (BRIEF-HUD-SCAN-1 5; features/core/scan/place.ts): at most a word and a saved place's
   * NAME, only with his question, never a coordinate, never live GPS; absent when his switch is off.
   */
  place?: { word: 'home' | 'out' | 'on the way'; name: string };
}

export const LINE_MAX = 160;
export const DETAIL_MAX = 80;
export const WORDS_MAX = 220;
const LABEL_MAX = 60;
const ID_MAX = 80;

/** One line of plain text: control characters and line breaks become spaces, runs of spaces one, cut at `max` with an ellipsis. */
export function oneLineOf(s: unknown, max: number): string {
  const t = typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
  // a key, a token or a hash is never words: nothing that long and unbroken goes into the line
  const safe = t.replace(/[A-Za-z0-9_\-+/=]{32,}/g, '…');
  return safe.length > max ? `${safe.slice(0, Math.max(0, max - 1)).trimEnd()}…` : safe;
}

/** A selection made safe to send: its kind from the closed list (else `thing`), its words one line each, cut. Null when it names nothing. */
export function cleanSelected(s: unknown): Selected | null {
  if (!s || typeof s !== 'object') return null;
  const r = s as Record<string, unknown>;
  const label = oneLineOf(r.label, LABEL_MAX);
  const id = oneLineOf(r.id, ID_MAX);
  if (!label && !id) return null;
  const kind = (SELECTED_KINDS as readonly string[]).includes(String(r.kind)) ? String(r.kind) : 'thing';
  const detail = oneLineOf(r.detail, DETAIL_MAX);
  return { kind, id, label: label || id, ...(detail ? { detail } : {}) };
}

/** A screen's context made safe to send, or null when it carries nothing. */
export function cleanScreen(c: unknown): ScreenContext | null {
  if (!c || typeof c !== 'object') return null;
  const r = c as Record<string, unknown>;
  const screen = oneLineOf(r.screen, 40);
  const title = oneLineOf(r.title, 60);
  const line = oneLineOf(r.line, LINE_MAX);
  if (!screen || !line) return null;
  const selected = cleanSelected(r.selected);
  const looking = oneLineOf(r.looking, 80);
  return { screen, title: title || screen, line, ...(selected ? { selected } : {}), ...(looking ? { looking } : {}), at: Number.isFinite(r.at) ? Number(r.at) : 0 };
}

/**
 * THE ONE LINE that rides in his message (≤220 characters, the same for the same screen): `On screen: the room plan, bedroom
 * 3.2 × 4.1 m, 6 items; selected: the north wall (3.2 m).` Nothing else is in it: not the time and not the place, which stay
 * where they are. A long line gives way before the selection does.
 */
export function contextWords(c: ScreenContext): string {
  const s = cleanSelected(c.selected);
  const sel = s ? `; selected: ${s.label}${s.detail ? ` (${s.detail})` : ''}` : '';
  const head = 'On screen: ';
  const room = Math.max(24, WORDS_MAX - head.length - sel.length - 1);
  const line = oneLineOf(c.line, Math.min(LINE_MAX, room)).replace(/[.\s]+$/, '');
  const out = `${head}${line}${sel}.`;
  // (a selection that alone is too long is cut from its tail: the line stays)
  return out.length > WORDS_MAX ? `${out.slice(0, WORDS_MAX - 2).trimEnd()}….` : out;
}

/**
 * What the brain pastes on his message: the phone's own line when it is one (checked, one line, cut), else the line made
 * from the `screen` it sent; '' when there is none (Telegram, an older phone, a turn from the brain's own schedule).
 */
export function screenWords(c: ClientContext | undefined | null): string {
  if (!c || c.tab === 'telegram') return '';
  const given = oneLineOf(c.screenLine, WORDS_MAX);
  if (given.startsWith('On screen:')) return given;
  const made = typeof c.screen === 'object' ? cleanScreen(c.screen) : null;
  return made ? contextWords(made) : '';
}

/**
 * What the brain can ask the phone to show, typed. `client` runs one of the phone's commands (CLIENT_COMMANDS); `cards` are live
 * cards in the chat; `stage` is defined here and left for item 5, SHOW ME, to implement (STARS 164): the renderer's name and what
 * it draws. Nothing sends or runs a `stage` yet.
 */
export type Show = { t: 'client'; name: ClientCommand; args: Record<string, unknown> } | { t: 'cards'; cards: Card[] } | { t: 'stage'; renderer: string; payload: unknown };

/** Is this a `Show`? (Every command in CLIENT_COMMANDS is one.) */
export function isShow(x: unknown): x is Show {
  if (!x || typeof x !== 'object') return false;
  const r = x as Record<string, unknown>;
  if (r.t === 'client') return typeof r.name === 'string' && (CLIENT_COMMANDS as readonly string[]).includes(r.name) && !!r.args && typeof r.args === 'object';
  if (r.t === 'cards') return Array.isArray(r.cards);
  if (r.t === 'stage') return typeof r.renderer === 'string' && 'payload' in r;
  return false;
}
