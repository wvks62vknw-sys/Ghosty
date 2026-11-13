/**
 * REVERSE'S WORDS (BRIEF-QUALITY-MAKE): the lines the report screen says in his voice, in one place and with no DOM, so the spec reads the
 * very words the page is built from. Without GitHub nothing starts, and that stays refused in the same place; here it is only said.
 */
import { agoWords } from '../threats/words';

/** A report's state in his words, with when: "Ready · 25 Oct", "Running · 3 min", "Didn’t finish · 25 Oct", "Starting · just now". */
export function jobState(j: { status: 'done' | 'failed' | 'running' | 'queued'; at: number; finishedAt?: number }, now = Date.now()): string {
  const date = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  switch (j.status) {
    case 'done':
      return `Ready${j.finishedAt ? ` · ${date(j.finishedAt)}` : ''}`;
    case 'failed':
      return `Didn’t finish · ${date(j.at)}`;
    case 'running':
      return `Running · ${Math.max(1, Math.round((now - j.at) / 60_000))} min`;
    default:
      return `Starting · ${agoWords(j.at, now)}`;
  }
}

/** The list before the brain has answered, and with nothing in it (the one next thing is the box above). */
export const REPORTS_LOADING = 'Looking for your reports…';
export const REPORTS_NONE = { head: 'No reports yet.', line: 'Paste a link above and I’ll take it apart.', key: 'PASTE A LINK' };

/** Without GitHub nothing can start: said before he types (what to connect and where), and again, shorter, if he taps START. */
export const GITHUB_NOTE = 'GitHub isn’t connected yet. I run reports on GitHub’s free computers, so add a free GitHub token in System, then Keys.';
export const START_REFUSED = 'I didn’t start it: GitHub isn’t connected. Tap CONNECT GITHUB above.';

/** A report opened, and one that would not open. */
export const OPENING = 'Opening the report…';
export const OPEN_FAILED = 'I can’t open that report just now. Tap RETRY and I’ll try again.';
export const RETRY = 'RETRY';

/** START pressed: the one wait, said where the answer will be. Refusals: nothing typed, and no signal. */
export const START_WAIT = 'Starting your report…';
export const START_EMPTY = 'Paste a link first, like bbc.co.uk';
export const START_OFFLINE = 'You’re offline, so nothing can start. Try again when you’re back';

/** The screen's one line: what it is for, and what comes back. */
export const REVERSE_SUB = 'Paste a link and I take it apart: what it is built with, and what it talks to.';

/** The chat words that open this screen, answered on the phone with no model (assistant/screenasks.ts). */
export const PHRASES = ['reverse this'];
