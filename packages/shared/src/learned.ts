/**
 * HIS OWN WORDINGS, LEARNED (NEXT ROUND, voice.u1; the big move "Talk to it your own way"). When he says something the phone did not
 * know and then taps the screen he meant, Ghosty offers to remember that wording; next time it opens that screen at once. The pure
 * rules live here: what can be learned (a short ask that opens a screen, never one that sends, pays, posts or deletes: those stay with
 * the brain and its APPROVE), how two wordings are the same (the polite wrapping taken off: meanings.ts plainWords), and his words for
 * listing and forgetting them. The list itself is kept on his phone only (assistant/learnwords.ts).
 */
import { plainWords } from './meanings';

export interface Learned {
  /** His wording, as he said it. */
  words: string;
  /** The key two wordings share (plainWords). */
  key: string;
  /** The screen it opens, and its name as shown. */
  tab: string;
  label: string;
  at: number;
}

/** Where the phone keeps them (assistant/learnwords.ts writes it; the phrases table reads it). */
export const LEARNED_KEY = 'ghosty.wordings';

/** The kept list, read from this phone's storage ([] where there is none, or no storage: a test, a private window). */
export function storedLearned(): Learned[] {
  try {
    const v = JSON.parse((globalThis as { localStorage?: { getItem(k: string): string | null } }).localStorage?.getItem(LEARNED_KEY) ?? '[]') as Learned[];
    return Array.isArray(v) ? v.filter((l) => l && typeof l.key === 'string' && typeof l.tab === 'string') : [];
  } catch {
    return [];
  }
}

/** At most this many wordings are kept. */
export const MAX_LEARNED = 100;

/** Words that do something to the world (send, pay, post, delete…): such an ask is never learned as "open a screen". */
const DOES = /\b(?:send|post|tweet|publish|pay|buy|order|book|transfer|delete|remove|erase|wipe|call|ring|text|email|e-mail|message|dm|reply|remind|approve|ship|share|upload|forget|cancel|unsubscribe)\b/;

/** His words → the key they are kept under ('' when they cannot be learned). */
export function learnKey(text: string): string {
  const k = plainWords(text).replace(/[“”"']/g, '').trim();
  if (k.length < 2 || k.length > 60) return '';
  if (k.split(' ').length > 8) return '';
  if (DOES.test(k)) return '';
  // a bare number or yes/no is an answer to something, not a name for a screen
  if (/^(?:\d+|yes|no|yeah|nope|ok|okay|thanks|thank you|cheers|hi|hello|hey)$/.test(k)) return '';
  return k;
}

/** The learned wording his words are, or null. */
export function learnedFor(list: readonly Learned[], text: string): Learned | null {
  const k = learnKey(text);
  return k ? (list.find((l) => l.key === k) ?? null) : null;
}

/** The list with this wording kept (a wording taught again points at its new screen), newest first, capped. */
export function withLearned(list: readonly Learned[], item: Learned): Learned[] {
  return [item, ...list.filter((l) => l.key !== item.key)].slice(0, MAX_LEARNED);
}

/** The list without the wording he named (matched the same way), and whether one went. */
export function withoutLearned(list: readonly Learned[], words: string): { list: Learned[]; gone: Learned | null } {
  const k = plainWords(words).replace(/[“”"']/g, '').trim();
  const gone = list.find((l) => l.key === k) ?? null;
  return { list: list.filter((l) => l !== gone), gone };
}

/** "What wordings have you learned?", "my wordings", "show the words you've learned". */
export const LIST_ASK = /^(?:(?:what|which) (?:wordings|words|phrases|sayings) (?:have you|did you|you've) (?:learn(?:ed|t)|picked up)(?: from me)?|(?:my|your) (?:own )?(?:wordings|learned words|learnt words|own words)|(?:show|list|see) (?:me )?(?:my|the|your) (?:own )?(?:wordings|learned words|learnt words|words you(?:'ve| have)? learn(?:ed|t)))$/;

/** "Forget the wording money stuff", "unlearn money stuff", "stop opening money for money stuff". */
export const FORGET_ASK = /^(?:forget (?:the |my )?(?:wording|words|phrase|saying)|unlearn|stop learning)\s+(.+)$/;

/** What his words ask of the learned list: list it, forget one (by its words), or nothing. */
export function learnedAsked(text: string): { kind: 'list' } | { kind: 'forget'; words: string } | null {
  const t = plainWords(text);
  if (LIST_ASK.test(t)) return { kind: 'list' };
  const f = FORGET_ASK.exec(t);
  if (f) return { kind: 'forget', words: f[1]!.replace(/^["“']|["”']$/g, '').trim() };
  return null;
}

/** The offer, in one line: "Next time you say “money stuff”, open Money?" */
export const offerLine = (words: string, label: string): string => `Next time you say “${words.trim().slice(0, 60)}”, open ${label}?`;
/** Said when it is kept, and when it is used. */
export const keptLine = (words: string, label: string): string => `Kept: “${words.trim().slice(0, 60)}” opens ${label}.`;
export const usedLine = (l: Learned): string => `Opening ${l.label}: you taught me “${l.words}”.`;
