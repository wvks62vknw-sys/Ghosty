/**
 * MEMORY's words, pure (the spec imports this file): a day said as he says it, a search with no hit that names what he typed, the waits and the
 * one next thing on every empty state. What memory keeps and FORGET's effect are not here: only what the screen says.
 */
const midnight = (t: number): number => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** A day as he says it: "Today", "Yesterday", else "Sat 17 Oct" (the year only when it is not this one). */
export function dayWords(at: number, now: number = Date.now()): string {
  const days = Math.round((midnight(now) - midnight(at)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  const d = new Date(at);
  const year = d.getFullYear() === new Date(now).getFullYear() ? {} : { year: 'numeric' as const };
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...year });
}

/** The line under the title. */
export const PAGE_SUB = 'Kept in your private brain, the same on all your devices.';
export const OFFLINE_SUB = 'You’re offline: this is what I knew before. It updates by itself when you’re back.';

/** A search with no hit: what he typed, and what to try. */
export function noHitWords(query: string, kindIsEverything: boolean): { head: string; next: string } {
  const q = query.trim();
  return {
    head: q ? `Nothing matches “${q.length > 40 ? `${q.slice(0, 40)}…` : q}”` : 'Nothing in this list',
    next: kindIsEverything ? 'Try other words, or fewer of them.' : 'Try other words, or show Everything.',
  };
}

export const LOADING = 'Reading your memory…';
export const READ_FAILED = { head: 'I couldn’t read my memory just now', next: 'Nothing was lost. Tap RETRY.' };
export const OFFLINE_EMPTY = { head: 'You’re offline', next: 'My memory shows again as soon as the phone has a signal.' };
export const PATTERNS_EMPTY = 'Nothing yet. After a few days of chats I point out what keeps coming up, and how often.';
/** The fact cut from PATTERNS' empty state, kept where he can ask for it. */
export const PATTERNS_WHY = 'Each one is worked out by counting what is stored in your brain, never guessed.';

// ---------------------------------------------------------------- [recall] RECALL and FIND (BRIEF-DEPTH-MEMORY 5)

/** The index not built yet. */
export const RECALL_COLD = 'Still reading your things; ask me again in a minute.';
/** "what did I ask you about X?" with no match. */
export const recallNone = (about: string): string => `Nothing like that: I can’t find a time you asked me about “${about.slice(0, 40)}”.`;
/** The RECALL card's head. */
export const recallHead = (n: number, about: string): string => `${n === 1 ? 'Once' : `${n} times`} you asked me about “${about.slice(0, 40)}”${n > 3 ? '; the best three first' : ''}:`;
/** FIND with no match. */
export const findNone = (q: string): string => `Nothing like “${q.slice(0, 40)}” in your documents, pages, decks, sheets or chats on this phone.`;
/** FIND's head. */
export const findHead = (n: number, q: string): string => `${n} thing${n === 1 ? '' : 's'} of yours about “${q.slice(0, 40)}”:`;
/** A chase set while my brain is out of reach. */
export const CHASE_OFFLINE = 'I can’t reach my brain right now, and it is the brain that checks on the day, so the chase isn’t set. Ask me again when I’m back online.';
/** A turn forgotten from RECALL. */
export const TURN_FORGOTTEN = 'Forgotten: it won’t come up in recall again.';
/** SYSTEM → STORAGE's line for the index. */
export const indexLine = (items: number, bytes: number): string => (items ? `Recall index: ${items} thing${items === 1 ? '' : 's'}, ${bytes < 1_000_000 ? `${Math.max(1, Math.round(bytes / 1000))} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`}, kept only on this phone.` : 'Recall index: empty; it builds while the phone sits idle.');
/** "what are you chasing?" */
export const chasingLine = (items: string[]): string => `I'm chasing ${items.length === 1 ? 'one reply' : `${items.length} replies`}: ${items.join('; ')}.`;
export const CHASING_NONE = 'I’m not chasing anything for you. Say “remind me to chase this if Sam doesn’t reply by Thursday” and I will.';
export const CHASE_LIST_OFFLINE = 'I can’t reach my brain right now, and it is the brain that keeps the chases. Ask me again when I’m back online.';
/** [keep] Recall within days he named ("last March", "in October"). */
export const recallOn = (n: number, said: string): string => `${n === 1 ? 'One thing' : `${n} things`} you asked me ${said.replace(/^(?:on|in) /, 'on ')}:`.replace(/ on (last|this) /, ' $1 ').replace(/ on ((?:january|february|march|april|may|june|july|august|september|october|november|december)\b)/i, ' in $1');
export const recallNoneOn = (said: string, about?: string): string => `Nothing${about ? ` about “${about.slice(0, 40)}”` : ''} from ${said.replace(/^(?:on|in) /, '')}.`;
/** Meaning search downloaded but not ready this moment: the answer came by its words. */
export const BY_WORDS = '(By words only: meaning search is still waking up.)';
