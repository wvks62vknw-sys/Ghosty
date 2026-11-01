/**
 * The typing test in the chat's own box (BRIEF-PACKS-3): "typing test" shows a passage in the chat, and the next thing he sends
 * is scored if it looks like an attempt at it (the same maths as the sheet's TYPING page: packages/shared/src/learning.ts).
 * The clock starts at his first key in the box (the chat's #cin), not when the passage was shown; a paste is not timed.
 * Anything he sends that is not an attempt is answered as anything else would be, and the test is over. Nothing here is sent
 * anywhere: the score is worked out on this phone, and logged in his brain by assistant/packs.ts.
 */
import { asciiText, levenshtein } from '../../../../../packages/shared/src/learning';

interface Pending {
  target: string;
  first: number;
  pasted: boolean;
  armed: number;
  until: number;
  off: () => void;
}
let pending: Pending | null = null;
/** How long the passage waits for him. */
const WINDOW = 5 * 60_000;

export const typingPending = (): boolean => !!pending && pending.until > Date.now();

function disarm(): void {
  pending?.off();
  pending = null;
}

/** A passage is up: watch the chat's box for the first key. */
export function armTyping(target: string): void {
  disarm();
  const now = Date.now();
  const p: Pending = { target, first: 0, pasted: false, armed: now, until: now + WINDOW, off: () => undefined };
  const box = typeof document === 'undefined' ? null : document.getElementById('cin');
  const onInput = (e: Event) => {
    if (!p.first) p.first = performance.now();
    const kind = (e as InputEvent).inputType;
    if (kind === 'insertFromPaste' || kind === 'insertFromDrop' || kind === 'insertFromYank') p.pasted = true;
  };
  box?.addEventListener('input', onInput);
  p.off = () => box?.removeEventListener('input', onInput);
  pending = p;
}

export type TypedAnswer = { kind: 'cancel' } | { kind: 'score'; target: string; ms: number; pasted: boolean; timed: boolean } | null;

/** What he sent while a test was up: cancelled, an attempt (with its time), or not for the test at all (null; the test is over). */
export function answerTyping(text: string): TypedAnswer {
  const p = pending;
  if (!p) return null;
  if (p.until <= Date.now()) {
    disarm();
    return null;
  }
  if (/^(?:cancel|stop|skip|never ?mind|forget it|quit)[.!]*$/i.test(text.trim())) {
    disarm();
    return { kind: 'cancel' };
  }
  const t = asciiText(p.target);
  const y = asciiText(text);
  const like = 1 - levenshtein(t, y) / Math.max(t.length, y.length, 1);
  if (like < 0.4) {
    disarm();
    return null;
  }
  const out: TypedAnswer = { kind: 'score', target: p.target, ms: p.first ? performance.now() - p.first : Date.now() - p.armed, pasted: p.pasted, timed: p.first > 0 };
  disarm();
  return out;
}
