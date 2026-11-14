/**
 * HIS OWN WORDINGS, LEARNED, on the phone (NEXT ROUND, voice.u1; packages/shared/src/learned.ts holds the rules). A miss is a turn of
 * his that went to the brain (no table and no meaning took it). If, within half a minute, HE taps to another screen (not the brain
 * opening one for him), a small bar asks "Next time you say “money stuff”, open Money?" with REMEMBER IT and NO. REMEMBER IT keeps the
 * wording on this phone; next time those words open that screen at once, before anything else reads them. NO is remembered too, so
 * the same words are never offered twice. "My wordings" lists them, each with FORGET; "forget the wording money stuff" forgets one.
 * Nothing leaves the phone: the list is in this phone's storage, like his other preferences.
 */
import { h, clear } from '../core/dom';
import { LEARNED_KEY, learnedAsked, learnedFor, learnKey, offerLine, keptLine, storedLearned, usedLine, withLearned, withoutLearned, type Learned } from '../../../../packages/shared/src/learned';
import { ui } from '../state/app';
import { button, toast, undo } from '../ui/components';
import { go, tabs } from '../shell/tabs';
import { register } from '../commands/registry';

const KEY = LEARNED_KEY;
const NO_KEY = 'ghosty.wordings.no';
/** How long after a missed turn his tap to a screen still counts as "the screen I meant". */
export const MISS_MS = 30_000;
/** How long the bar stays. */
const BAR_MS = 15_000;

const read = <T>(k: string, none: T): T => {
  try {
    return (JSON.parse(localStorage.getItem(k) ?? 'null') as T) ?? none;
  } catch {
    return none;
  }
};
const write = (k: string, v: unknown): void => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage refused (a private window): it lasts this visit only */
  }
};

let memory: Learned[] | null = null;
export const learned = (): Learned[] => (memory ??= storedLearned());
const keep = (list: Learned[]) => {
  memory = list;
  write(KEY, list);
};
const declined = (): string[] => read<string[]>(NO_KEY, []);

/** A screen's name as shown ("Money", "God's eye"), or null when there is no such screen. */
function screenName(tab: string): string | null {
  const d = tabs().find((t) => t.id === tab);
  return d ? d.title.charAt(0).toUpperCase() + d.title.slice(1).toLowerCase() : null;
}

// ---------------------------------------------------------------- the miss, and his tap

/** The last turn that went to the brain, while it can still be taught. */
let miss: { text: string; key: string; at: number; tab: string; byBrain: boolean } | null = null;

/** session.ts: this turn went to the brain (nothing on the phone took it). */
export function noteWordMiss(text: string, now = Date.now()): void {
  const key = learnKey(text);
  miss = key && !declined().includes(key) && !learned().some((l) => l.key === key) ? { text: text.trim(), key, at: now, tab: ui.get().tab, byBrain: false } : null;
}
/** session.ts: the brain moved the screen itself (a client command): a screen change now is the brain's, not his tap. */
export function noteBrainActed(): void {
  if (miss) miss.byBrain = true;
}

ui.subscribe((s, p) => {
  if (s.tab === p.tab || !miss) return;
  const m = miss;
  if (m.byBrain || Date.now() - m.at > MISS_MS) {
    miss = null;
    return;
  }
  // a hub, Home or the chat itself is on the way to the screen, not the screen he meant: keep waiting
  if (s.tab === 'core' || s.tab.startsWith('area-') || s.tab === m.tab) return;
  const label = screenName(s.tab);
  if (!label) return;
  miss = null;
  offer(m.text, m.key, s.tab, label);
});

// ---------------------------------------------------------------- the bar

let bar: HTMLElement | null = null;
let barTimer = 0;
/** What the bar offers now (for the checks: window.__ghosty.learnwords). */
export const offered: { words: string; tab: string } = { words: '', tab: '' };

function offer(words: string, key: string, tab: string, label: string): void {
  if (!bar) {
    bar = h('div.undo.rcundo.undofloat.wordbar#wordbar', { role: 'status', 'aria-live': 'polite', hidden: true });
    document.body.append(bar);
  }
  Object.assign(offered, { words, tab });
  const close = () => {
    clearTimeout(barTimer);
    if (bar) bar.hidden = true;
    Object.assign(offered, { words: '', tab: '' });
  };
  clear(
    bar,
    h('span', offerLine(words, label)),
    button('REMEMBER IT', () => {
      remember(words, key, tab, label);
      close();
      // (a few seconds to take it back: UNDO forgets it again)
      undo(keptLine(words, label), () => void forget(words));
    }, 'on'),
    button('NO', () => {
      write(NO_KEY, [key, ...declined().filter((k) => k !== key)].slice(0, 200));
      close();
    }),
  );
  for (const b of bar.querySelectorAll('button')) b.setAttribute('aria-label', b.textContent === 'NO' ? `No: don't remember “${words}”` : `Remember it: “${words}” opens ${label}`);
  bar.hidden = false;
  clearTimeout(barTimer);
  barTimer = window.setTimeout(close, BAR_MS);
}

/** Keep a wording (REMEMBER IT, or a check): it opens `tab` from now on. */
export function remember(words: string, key: string, tab: string, label: string, now = Date.now()): void {
  keep(withLearned(learned(), { words: words.trim(), key, tab, label, at: now }));
}

/** Forget one by its words; the one that went, or null. */
export function forget(words: string): Learned | null {
  const r = withoutLearned(learned(), words);
  if (r.gone) keep(r.list);
  return r.gone;
}

register({ id: 'forget_wording', title: 'Forget a wording I learned', hidden: true, run: (a) => void (typeof a?.words === 'string' && forget(a.words) && toast(`Forgotten: “${a.words}”.`, 'ok')) });

// ---------------------------------------------------------------- the turn

type Answer = (text: string, reply: string, local: import('./local').LocalAnswer, opts: { voice?: boolean; private?: boolean }) => true;

/** His own wording opens its screen; "my wordings" lists them; "forget the wording …" forgets one. True when answered here. */
export function learnedTurn(text: string, opts: { voice?: boolean; private?: boolean }, answer: Answer): boolean {
  const ask = learnedAsked(text);
  if (ask?.kind === 'list') {
    const list = learned();
    /* state: core.learned empty */
    if (!list.length) return answer(text, 'I haven’t learned any of your own wordings yet. Say something your way, then tap the screen you meant, and I’ll offer to remember it.', { kind: 'can' }, opts);
    const lines = list.slice(0, 12).map((l) => `“${l.words}” opens ${l.label}`);
    return answer(text, `Your own wordings (${list.length}):\n${lines.join('\n')}`, { kind: 'can', go: list.slice(0, 6).map((l) => ({ id: `wording:${l.key}`, ask: -1, label: `FORGET “${l.words.slice(0, 24)}”`, run: 'forget_wording', args: { words: l.words } })) }, opts);
  }
  if (ask?.kind === 'forget') {
    const gone = forget(ask.words);
    return answer(text, gone ? `Forgotten: “${gone.words}” no longer opens ${gone.label}.` : `I don’t have “${ask.words}” as one of your wordings. Say “my wordings” to see them.`, { kind: 'can' }, opts);
  }
  const l = learnedFor(learned(), text);
  if (!l) return false;
  if (!go(l.tab)) {
    // the screen is gone from this build: the wording is let go, and the brain has his words as ever
    forget(l.words);
    return false;
  }
  return answer(text, usedLine(l), { kind: 'can', go: [{ id: `wording:${l.key}`, ask: -1, label: 'FORGET THIS WORDING', run: 'forget_wording', args: { words: l.words } }] }, opts);
}

// for the checks and the console (window.__ghosty.learnwords, set in main.ts)
export const probe = { learned, offered, remember, forget, noteWordMiss, MISS_MS };
