/**
 * SOCIAL's words, pure (the spec imports this file): the queue in one line, what exactly goes out, a failed post said with APPROVE again, and the key
 * that drops a draft. The posting rule (nothing leaves without his APPROVE, every time) is the code's, not these words'.
 */
export const APPROVE = 'APPROVE';
export const NO = 'NO';

/** The queue's line: how many wait, and that nothing goes until he taps (one sentence). */
export const queueNote = (n: number): string => (n ? `${n} waiting for your APPROVE. Nothing goes out until you tap it; a draft goes after 24 hours.` : 'Nothing waiting. Ask me to draft a post, and it waits here for your APPROVE.');
export const QUEUE_LOADING = 'Reading the queue…';
export const QUEUE_ERROR = 'I can’t reach my brain, so I can’t read the queue. Try again in a moment.';

/** The exact line above APPROVE: what leaves, and where, word for word as shown. */
export function exactLine(kind: 'post' | 'follow' | 'unfollow', where: string, who?: string, key = APPROVE): string {
  return kind === 'post' ? `I will post exactly this on ${where}, only when you tap ${key}.` : `I will ${kind} ${who ?? 'them'} on ${where}, only when you tap ${key}.`;
}

/** A post that did not go: it says so, that nothing went out, and that APPROVE sends it once. */
export function failedWords(fault?: string): string {
  const why = (fault ?? '').trim().replace(/[.!?]+$/, '');
  return `Not sent${why && why.split(/\s+/).length <= 14 && !/undefined|\[object|TypeError|HTTP \d/i.test(why) ? `: ${why}` : ''}. Nothing went out. APPROVE sends it once.`;
}
/** The key that sends: APPROVE, while it waits and after it failed (every send is his tap, every time). */
export const sendKey = (_state: string): string => APPROVE;
