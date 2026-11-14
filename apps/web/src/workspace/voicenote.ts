/**
 * VOICE NOTES INTO TIDY PAGES (editors.s6): he talks for a few minutes with the phone's own recorder (or picks a recording from Voice Memos),
 * the sound is written down by his brain's hearing route in pieces of 25 seconds (the way the video's subtitles are, video/subs.ts), and
 * Ghosty tidies the words into a clean page: short paragraphs in his own words, and every action pulled out as a to-do. With the brain
 * away the phone tidies it itself (plainer, never invented). The words of the asks, the brain's message, reading its reply, and the
 * phone's own tidy are here. Pure: apps/edge/test/workspace.test.mjs.
 */
import { wblock, type WBlock } from './model';

export { voiceNoteAsked } from './asks';

/** The whole tidy page: its title, its paragraphs (a "## " line is a heading), the actions, and the words as said. */
export interface Tidy {
  title: string;
  paras: string[];
  actions: string[];
  said: string;
  /** Who tidied it: his brain, or the phone itself (said on the page and in the done line). */
  by: 'brain' | 'phone';
}

/** One turn's message to the brain: his words as the data, the shape of the reply asked for. */
export function tidyAsk(transcript: string): string {
  return [
    'Turn this voice note of mine into a tidy page. Reply in Markdown only, nothing before or after it:',
    'the first line "# " and a short title; then short paragraphs (a "## " heading where the subject changes) in my own words, without ums, repeats or filler;',
    'then a line "## To do" and each thing I said I must do as "- [ ] " and the action. Keep every fact I said and add nothing I did not say.',
    '',
    'My voice note, as it was written down:',
    `"""${transcript.trim().slice(0, 12000)}"""`,
  ].join('\n');
}

const clean = (s: string): string => s.replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim();

/** The brain's reply read as a Tidy; null when it is not the shape asked for (then the phone tidies it). */
export function parseTidy(reply: string, said: string): Tidy | null {
  const lines = reply.replace(/\r/g, '').split('\n');
  let title = '';
  const paras: string[] = [];
  const actions: string[] = [];
  let inTodo = false;
  for (const raw of lines) {
    const l = raw.trim();
    if (!l || /^```/.test(l)) continue;
    const h1 = /^#\s+(.+)$/.exec(l);
    if (h1 && !title) {
      title = clean(h1[1]!);
      continue;
    }
    const h2 = /^#{2,3}\s+(.+)$/.exec(l);
    if (h2) {
      inTodo = /^(?:to ?-?dos?|actions?|next steps?|things to do)$/i.test(clean(h2[1]!));
      if (!inTodo) paras.push(`## ${clean(h2[1]!)}`);
      continue;
    }
    const todo = /^[-*]\s+\[[ xX]?\]\s+(.+)$/.exec(l);
    if (todo) {
      actions.push(clean(todo[1]!));
      continue;
    }
    const bullet = /^(?:[-*]|\d+[.)])\s+(.+)$/.exec(l);
    if (bullet && inTodo) {
      actions.push(clean(bullet[1]!));
      continue;
    }
    paras.push(clean(bullet ? bullet[1]! : l));
  }
  if (!title || (!paras.length && !actions.length)) return null;
  return { title: title.slice(0, 120), paras, actions, said: said.trim(), by: 'brain' };
}

const FILLER = /\b(?:um+|uh+|erm*|er|ah+|hmm+|you know|i mean|sort of|kind of|basically)\b,?\s*/gi;
const ACTION = /\b(?:i (?:need|have|must|should|ought|want|'ve got|got) to|i'?ve got to|i must|i'll|i will|remember to|don'?t forget to|need to|have to|must|got to|gotta|let'?s|we (?:need|have|should|must) to|to-?do:?)\s+(.+)$/i;
const cap = (s: string): string => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const sentence = (s: string): string => {
  const t = cap(s.trim().replace(/\s+/g, ' '));
  return t && !/[.!?]$/.test(t) ? `${t}.` : t;
};

/** The phone's own tidy (no brain): the filler taken out, sentences made, three to a paragraph, and the actions found by their words. */
export function tidyHere(transcript: string): Tidy {
  const said = transcript.trim();
  const plain = said.replace(FILLER, '').replace(/\s+([,.!?])/g, '$1').replace(/\s+/g, ' ').trim();
  const sentences = plain.split(/(?<=[.!?])\s+|\s+(?:and then|then|also|so)\s+(?=i\b|we\b|remember\b|don'?t\b)/i).map((s) => s.trim()).filter((s) => s.replace(/[^a-z0-9]/gi, '').length > 1);
  const actions: string[] = [];
  const kept: string[] = [];
  for (const s of sentences) {
    const m = ACTION.exec(s.replace(/[.!?]+$/, ''));
    if (m && m[1]!.split(/\s+/).length >= 2) actions.push(cap(m[1]!.replace(/[.!?,]+$/, '').trim()));
    else kept.push(sentence(s));
  }
  const paras: string[] = [];
  for (let i = 0; i < kept.length; i += 3) paras.push(kept.slice(i, i + 3).join(' '));
  const first = (kept[0] ?? actions[0] ?? 'Voice note').replace(/[.!?]+$/, '').split(/\s+/);
  const title = first.length > 7 ? `${first.slice(0, 7).join(' ')}…` : first.join(' ');
  return { title: cap(title) || 'Voice note', paras, actions, said, by: 'phone' };
}

const dayWords = (at: number): string => new Date(at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** The tidy page as the workspace's blocks: the paragraphs, TO DO with a to-do each, and the words as said at the end. */
export function voiceBlocks(t: Tidy, at = Date.now()): WBlock[] {
  return [
    wblock('callout', `A voice note of ${dayWords(at)}, tidied ${t.by === 'brain' ? 'by Ghosty' : 'on this phone'}. Every word is yours to change.`),
    ...t.paras.map((p) => (p.startsWith('## ') ? wblock('h2', p.slice(3)) : wblock('p', p))),
    ...(t.actions.length ? [wblock('h2', 'To do'), ...t.actions.map((a) => wblock('todo', a))] : []),
    wblock('h2', 'What I said'),
    wblock('quote', t.said),
  ];
}

/** "Done: “Kitchen plans” is a page with 3 to-dos." */
export function doneWords(t: Tidy, where: 'page' | 'document'): string {
  const n = t.actions.length;
  return `Done: “${t.title}” is ${where === 'page' ? 'a page in your workspace' : 'in MY DOCUMENTS'}${n ? `, with ${n} to-do${n === 1 ? '' : 's'}` : ', with no actions in it'}${t.by === 'phone' ? '. I tidied it on this phone, as my brain was away' : ''}.`;
}

/** "2:05" */
export const clockWords = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
/** The longest note: ten minutes (twenty-four pieces for the hearing route). */
export const MAX_NOTE_MS = 10 * 60_000;
