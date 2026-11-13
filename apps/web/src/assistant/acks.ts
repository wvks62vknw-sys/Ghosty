/**
 * SPOKEN ACKNOWLEDGEMENTS (BRIEF-OCT-IDEAS-1 5): a tap that starts work taking more than a beat gets one word or two, in my voice,
 * through speak(): "On it." / "Sitting it now.". The words are the small table below, chosen by the action (the key's
 * label, and where it is when the label is a common one), never by a model. Only when Voice is on and "A word when I start something"
 * is on (Settings → Voice); never twice for one tap (the same action inside a few seconds is the same tap); and never over a reply being
 * said (speak() gives way to whatever is said next, so a reply on the air is never cut for a word). The phone's own silent switch
 * silences the speech synthesis it uses, so a muted phone stays muted.
 */
import { settings, ui } from '../state/app';
import { speak } from './voice';

interface Ack {
  /** The action's name (what "once" counts). */
  action: string;
  /** The key's label, as written on it. */
  label: RegExp;
  /** Where it must be, for a label that is common ("START" is a course's only inside LEARN). */
  within?: string;
  say: string;
}

/** The table: TRAIN NOW, PUBLISH, a course's START, SIT, STUDY ALL turning on, WATCH. A download's GET and a run's RUN NOW are NOT here: a download asks for Wi-Fi or a confirm first (nothing is said before it is allowed), and RUN NOW says its word after its own confirm (sayOnIt). */
export const ACKS: Ack[] = [
  { action: 'train', label: /^TRAIN NOW$/, say: 'On it.' },
  { action: 'publish', label: /^PUBLISH$/, say: 'On it.' },
  { action: 'teach', label: /^START$/, within: '#pg-learn', say: 'On it.' },
  { action: 'sit', label: /^SIT(?: THE EXAM| ON THE FREE GPU| A PLACEMENT TEST| THE READING CHECK)?$/, say: 'Sitting it now.' },
  { action: 'study', label: /^STUDY ALL: OFF$/, say: 'On it.' },
  { action: 'watch', label: /^WATCH$/, say: 'On it.' },
];

/** The same action inside this many ms is the same tap. */
const ONCE_MS = 4000;

/** What the checks read (window.__ghosty.acks). */
export const ackState = { said: [] as string[], last: '', lastAt: 0 };
let lastAction = '';
let lastAt = 0;

/** The words for a key, or null when it starts nothing that takes a moment. */
export function ackFor(b: HTMLElement): Ack | null {
  const label = (b.textContent ?? '').replace(/\s+/g, ' ').trim();
  return ACKS.find((a) => a.label.test(label) && (!a.within || !!b.closest(a.within))) ?? null;
}

/** Say the word for this key, if the rules allow; true when it was said. */
export function acknowledge(b: HTMLElement, now = Date.now()): boolean {
  const a = ackFor(b);
  if (!a) return false;
  const s = settings.get();
  if (!s.speak || s.sayStart === false) return false;
  if (a.action === lastAction && now - lastAt < ONCE_MS) return false;
  // never over a reply being said: speak() would cut it
  if (ui.get().voice === 'speaking') return false;
  lastAction = a.action;
  lastAt = now;
  ackState.last = a.say;
  ackState.lastAt = now;
  ackState.said.push(a.say);
  void speak(a.say).catch(() => undefined);
  return true;
}

/** The word for work that starts only after a confirm (the training card's RUN NOW): the same rules, said once the confirm is answered yes. */
export function sayOnIt(action: string, now = Date.now()): boolean {
  const s = settings.get();
  if (!s.speak || s.sayStart === false) return false;
  if (action === lastAction && now - lastAt < ONCE_MS) return false;
  if (ui.get().voice === 'speaking') return false;
  lastAction = action;
  lastAt = now;
  ackState.last = 'On it.';
  ackState.lastAt = now;
  ackState.said.push('On it.');
  void speak('On it.').catch(() => undefined);
  return true;
}

// one listener for every key in the app, on the capture phase so a key that re-draws itself on its tap is still read as it was pressed
document.addEventListener('click', (e) => {
  const b = (e.target as Element | null)?.closest?.('button');
  if (b && !(b as HTMLButtonElement).disabled) acknowledge(b);
}, true);

const w = window as unknown as { __ghosty?: Record<string, unknown> };
const attach = (n = 0) => (w.__ghosty ? (w.__ghosty.acks = ackState) : n < 150 && setTimeout(() => attach(n + 1), 100));
attach();
