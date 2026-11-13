/**
 * THE LIFE PACKS' SHARED STATES (BRIEF-QUALITY-LIFE): the one place each pack's empty, loading, error and offline states are
 * drawn, so all eight read as one app and each state carries its marker (`data-state="empty|loading|error|offline"`) for the
 * specs and for THE STATES RATCHET (apps/edge/test/ratchet.test.mjs reads the `state: <screen> <kind>` comments the packs keep
 * where each is drawn). Nothing here keeps or sends anything: it only draws words, in his voice.
 *
 *   emptyState(head, line)         nothing kept yet: what it is and the one next thing
 *   stateLine(kind, words)         an error, offline or loading line in the page's own note
 *   stateIn(el, kind, words)       the same, put into an element that already stands (a status line)
 *   lacksSignal()                  true when the phone says it has no signal
 *   waitFor(el, words)             waiting() with its state marker
 *   phrases(says)                  the chat phrases that open this screen, in one line (OWNER-ISSUES 119)
 *   dueWords(ymd)                  "due tomorrow", "due in 3 days", "due today", "3 days late"
 *   sizeWords(bytes)               "612 bytes", "84 KB", "1.2 MB"
 */
import { h } from '../core/dom';
import { waiting } from '../ui/wait';

export type LifeState = 'empty' | 'loading' | 'error' | 'offline';

/** No signal, as the phone says it (the specs flip this through navigator.onLine). */
export const lacksSignal = (): boolean => typeof navigator !== 'undefined' && navigator.onLine === false;

/** Nothing kept yet: a head and the one next thing, drawn as the other screens draw an empty one. */
export function emptyState(head: string, line: string): HTMLElement {
  // (the shell's own empty shape: ui/components.ts empty(), drawn here so a phone with no signal still gets THIS words)
  return h('div.empty', { dataset: { case: 'keep', state: 'empty' } }, h('b', { dataset: { label: head } }, head), h('span', { dataset: { label: line } }, line));
}

/** A state said in the page's own note (a line, never a toast): an error, no signal, or a wait. */
export function stateLine(kind: Exclude<LifeState, 'empty'>, words: string): HTMLElement {
  return h('p.pknote.pkstate', { dataset: { state: kind, case: 'keep' }, role: kind === 'error' ? 'alert' : 'status' }, words);
}

/** The same, put into a status line that already stands: its words and its state. */
export function stateIn(el: HTMLElement, kind: LifeState | '', words: string): void {
  el.textContent = words;
  if (kind) el.dataset.state = kind;
  else delete el.dataset.state;
}

/** A wait said where it happens (ui/wait.ts), marked as the loading state. */
export function waitFor(el: HTMLElement, words: string): () => void {
  const done = waiting(el, words);
  const line = el.lastElementChild as HTMLElement | null;
  if (line?.dataset.wait === words) line.dataset.state = 'loading';
  return done;
}

/** The chat phrases that open this screen, listed in one line so they can be found. */
export function phrases(says: string[]): HTMLElement {
  return h('p.pknote.pkphrases', { dataset: { says: says.join('|'), case: 'keep' } }, `Or say: ${says.map((s) => `“${s}”`).join(', ')}`);
}

/** Days from today to a day, whole days: 0 today, 1 tomorrow, negative past. */
export function daysTo(ymd: string, now = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  return Math.round((Date.UTC(y, m - 1, d) - a) / 864e5);
}

/** "today", "tomorrow", "in 8 days" (a day in the past: "8 days ago"). */
export function inWords(ymd: string, now = new Date()): string {
  const n = daysTo(ymd, now);
  return n === null ? '' : n === 0 ? 'today' : n === 1 ? 'tomorrow' : n > 1 ? `in ${n} days` : n === -1 ? 'yesterday' : `${-n} days ago`;
}

/** A day as the days to it: "due tomorrow", "due in 3 days", "2 days late". */
export function dueWords(ymd: string, now = new Date()): string {
  const n = daysTo(ymd, now);
  if (n === null) return '';
  return n === 0 ? 'due today' : n === 1 ? 'due tomorrow' : n > 1 ? `due in ${n} days` : n === -1 ? '1 day late' : `${-n} days late`;
}

/** A file's size as he reads it: "612 bytes", "84 KB", "1.2 MB". */
export function sizeWords(bytes: number): string {
  if (bytes < 1000) return `${Math.max(0, Math.round(bytes))} bytes`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/** What a pack's brain not answering looks like, in his words (a signal that is gone, or a brain that is silent). */
export const BRAIN_SILENT = 'My brain isn’t answering just now. What you typed is still here; try again in a moment.';
export const NO_SIGNAL = 'No signal. What you type waits here until the phone is back online.';

/** A pack's brain call that did not land: no signal, or a brain that is silent, in his words. */
export const troubleWords = (offline: boolean): string => (offline ? 'No signal. Try again when the phone is back online.' : 'My brain isn’t answering just now. Try again in a moment.');
