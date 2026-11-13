/**
 * THE RIBBON'S WORDS (BRIEF-QUALITY-BOOT-ORB 2, THE RIBBON): the line that says what Ghosty is doing, one sentence per state, in his voice,
 * as a pure function with no screen in it (features/core/ribbon.ts draws it; tests/bootpass.spec.mjs imports it). No developer word is
 * ever on it: the tilt and the hour's light are never named, a tool's line is never a bare verb, a long one stops at its first clause.
 */

/** What the ribbon reads, all from the phone's own state. */
export interface Doing {
  online: boolean;
  /** The brain's reachability: false when it is not answering, null before it has been asked. */
  brain: boolean | null;
  busy: boolean;
  /** The line the turn is showing (a tool's own words: "looking that up…"), '' when none. */
  status: string;
  /** The time the models are back ("14:32") while he waits on them, else ''. */
  cool: string;
  /** The last turn did not land, and whether RETRY can send it again. */
  failed: boolean;
  retry: boolean;
  /** A turn finished a moment ago and went well. */
  done: boolean;
  /** Something else he started that runs in the background. */
  live: '' | 'training' | 'sitting' | 'report' | 'download';
}

/** The longest a ribbon sentence runs before it keeps only its first clause (at BODY 21 it would wrap, never cut). */
export const RIBBON_MAX = 44;

/** A status line as a sentence: "LOOKING THAT UP…" → "Looking that up."; a bare verb or a bare "thinking" says what it is for. */
export function toolSentence(status: string): string {
  let s = status.replace(/…|\.{3}/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!s || /^(thinking|processing|working|ready|online|offline|init|ws|fetch|busy)$/.test(s) || !/\s/.test(s)) return 'Thinking it over.';
  if (s.length > RIBBON_MAX) s = s.split(/[,;:–—]/)[0]!.trim();
  if (s.length > RIBBON_MAX) s = s.slice(0, RIBBON_MAX).replace(/\s+\S*$/, '');
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}.`;
}

/** The ribbon's last part, one sentence for whichever state he is in (the first that is true, in this order). */
export function doingWords(f: Doing): string {
  /* state: core.ribbon offline */
  if (!f.online) return 'No signal, so I’m resting.';
  if (f.brain === false) return 'I can’t reach my brain.';
  if (f.busy && f.cool) return `Cooling down until ${f.cool}.`;
  if (f.busy) return toolSentence(f.status);
  /* state: core.ribbon error */
  if (f.failed) return f.retry ? 'That didn’t go through. Tap RETRY.' : 'That didn’t go through.';
  if (f.live === 'training') return 'Training in the background.';
  if (f.live === 'sitting') return 'Sitting a paper for you.';
  if (f.live === 'report') return 'Making your report.';
  if (f.live === 'download') return 'Downloading for you.';
  if (f.done) return 'Done.';
  return 'Waiting.';
}
