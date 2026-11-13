/**
 * THE CHAT'S OWN WORDS (BRIEF-QUALITY-CHAT 4): every line the log, a turn, the sources, the Stage's note and the call-outs say about
 * themselves, in one pure file (no screen, no sound) that the page and its spec both read. One sentence each, Ghosty's own voice ("I"),
 * nothing a developer would say. A fact cut from a line goes to WHY or a sheet, never to smaller type.
 */

/** The log before he has said anything: what to do in one sentence, and three things he can say (each one the chat answers). */
export const FIRST_OPEN = {
  say: 'Say it or type it, and I’ll answer. Or try one of these.',
  tries: ['What should I know today?', 'What can you do here?', 'What did you do today?'],
  /** With no signal: what I can still do, and three things the phone answers by itself. */
  offlineSay: 'No signal. I’ll answer from what I keep on this phone. Try one of these.',
  offlineTries: ['What can you do here?', 'What did you do today?', 'Can you translate signs?'],
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A day's heading as he says it: "Today", "Yesterday", the weekday inside a week ("Monday"), the weekday and date beyond ("Friday 16 October"). Never a bare date. */
export function dayWords(at: number, now: number = Date.now()): string {
  const day = (t: number) => new Date(new Date(t).getFullYear(), new Date(t).getMonth(), new Date(t).getDate()).getTime();
  const ago = Math.round((day(now) - day(at)) / 864e5);
  const d = new Date(at);
  if (ago <= 0) return 'Today';
  if (ago === 1) return 'Yesterday';
  if (ago < 7) return DAYS[d.getDay()]!;
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() === new Date(now).getFullYear() ? '' : ` ${d.getFullYear()}`}`;
}

/** A reply is folded past this many lines (a line is about this many letters across the log's column). */
export const FOLD_LINES = 12;
export const FOLD_ACROSS = 40;
const linesOf = (s: string): number => s.split('\n').reduce((n, p) => n + Math.max(1, Math.ceil(p.trim().length / FOLD_ACROSS)), 0);

/**
 * A long reply cut for folding: its first sentences that fit twelve lines, and the rest. Never in the middle of a sentence (a
 * single sentence longer than twelve lines is the head whole). Null when the whole reply fits.
 */
export function foldReply(text: string): { head: string; rest: string } | null {
  if (linesOf(text) <= FOLD_LINES) return null;
  // a web address is one piece: its dots and its "?" are no sentence's end, so the fold never cuts a link in two (a cut link was no
  // link at all: a video reply's moment at the fold went missing from its card)
  const pieces = text.match(/(?:https?:\/\/\S+|www\.\S+|[^.!?\n])+(?:[.!?]+["')\]]*)?\s*|\n+/g) ?? [text];
  let head = '';
  for (const p of pieces) {
    if (head && linesOf(head + p) > FOLD_LINES) break;
    head += p;
  }
  const rest = text.slice(head.length);
  return rest.trim() ? { head: head.trimEnd(), rest: rest.trimStart() } : null;
}
export const REST_OPEN = 'The rest';
export const REST_SHUT = 'Less';

/** A reply as plain words for copying or sharing: the words, then each source and its address. */
export function shareText(body: string, sources: { n: number; title: string; url?: string; doc?: string; missing?: boolean }[] = []): string {
  const real = sources.filter((s) => !s.missing);
  if (!real.length) return body.trim();
  return `${body.trim()}\n\nSources:\n${real.map((s) => `${s.n}. ${s.title}${s.url ? `: ${s.url}` : s.doc ? ': in my library' : ''}`).join('\n')}`;
}
export const COPIED = 'Copied.';
export const COPY_FAILED = 'I couldn’t copy that. Hold the words to copy them yourself.';

/** The check line under a sourced answer, in words. */
export function checkWords(ok: number, total: number): string {
  const thing = (n: number) => (n === 1 ? 'thing' : 'things');
  if (total === 0) return '';
  if (ok === total) return total === 1 ? 'The one thing I said is in the sources.' : total === 2 ? 'Both things I said are in the sources.' : `All ${total} things I said are in the sources.`;
  if (ok === 0) return total === 1 ? 'The one thing I said is not in the sources, and it is marked.' : `None of the ${total} ${thing(total)} I said is in the sources, and they are marked.`;
  const miss = total - ok;
  return `${ok} of ${total} ${thing(total)} I said ${ok === 1 && total === 1 ? 'is' : 'are'} in the sources; ${miss === 1 ? 'the one that isn’t is marked' : `the ${miss} that aren’t are marked`}.`;
}

/** A source that was never opened this turn: what to do with what it backs, and its address to copy when there is one. */
export function sourceUnopened(n: number, url?: string): string {
  return `I never opened source ${n} this turn, so don’t lean on what it backs.${url ? ' Its address is below to copy.' : ' It came with no address.'}`;
}
export const COPY_ADDRESS = 'COPY ADDRESS';

/** The turn's one line under his words (the log's last line), by where the turn is. */
export type Phase = 'idle' | 'sending' | 'waiting' | 'running' | 'streaming' | 'stopped';
export function turnWords(phase: Phase, status = ''): string {
  switch (phase) {
    case 'sending':
      return 'Sending…';
    case 'waiting':
      return 'Asking my brain…';
    case 'streaming':
      return 'Writing it now…';
    case 'stopped':
      return 'Stopped. What came is above.';
    case 'running': {
      const s = status.replace(/\s+/g, ' ').trim();
      if (!s || /^(?:thinking|thinking about the results|processing|working)(?:…|\.\.\.)?$/i.test(s)) return 'Asking my brain…';
      if (/^waiting for free AI room/i.test(s)) return 'All my models are busy. Waiting for one…';
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
    default:
      return '';
  }
}

/** The cut stream: what reached me stays, and this says so once. */
export const SIGNAL_WENT = 'The signal went. This is what reached me.';
export const CUT_LABEL = 'CUT SHORT';
export const NEWEST = 'Newest';
export const NEWEST_LABEL = 'Jump to the newest message';

/** An approval, said as exactly what is asked: the thing in words, then the answer once it is given. */
export const approvalAsk = (thing: string): string => `This is exactly what I’ll do if you approve: ${thing}.`;
export const approvalDone = (allow: boolean, via?: string): string => (via === 'telegram' ? `${allow ? 'Approved' : 'Not now'} on Telegram.` : allow ? 'Approved. I’m on it.' : 'Declined. I won’t do it.');

/** The six call-outs when they have nothing to read (never a dash, never a made-up figure). */
export const CALLOUT = {
  uplinkDead: 'NOT ANSWERING',
  uplinkNoSignal: 'NO SIGNAL',
  libraryDead: 'NOT ANSWERING',
  powerNone: 'NO READING',
};
