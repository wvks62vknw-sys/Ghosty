/**
 * Abilities revealed in context (OWNER-ISSUES 67b, 53; 68c "an occasional gentle 'did you know I can…', never nagging"):
 *  - after a turn whose context plainly matches an ability he has never used — a number plate typed, a YouTube link, a
 *    worry, a receipt or his spending — ONE line offers it ("I can check that plate for you…"), with a tap that goes there;
 *  - once a day, when he opens the app and nothing is under way, at most one "Did you know I can …?" for an ability he has
 *    never used and was never offered.
 * Each is offered once and remembered in the brain (`abilities:offered`, with when) and on this phone; never more than one
 * unprompted line a day of either kind, and never while he is mid-task (a reply or a tool working, an approval waiting, a
 * paper being sat, the GYM training). The rules are packages/shared/src/abilities.ts `offerFor` / `didYouKnow`.
 *
 * Under a test runner nothing is offered unless the spec asks for it (`window.__ghostyOffers`: true for both, 'context' for
 * the offers after a turn only), as the first run waits: every spec starts on a fresh phone, and a line offered after its
 * replies would sit in every one of its conversations.
 */
import { didYouKnow, offerFor, type Offer, type Offered } from '../../../../packages/shared/src/abilities';
import { brain } from '../api/brain';
import { DIRECT, type LocalAnswer } from '../assistant/local';
import { chat } from '../assistant/session';
import { liveIn } from '../shell/areas';
import { ui } from '../state/app';
import { allAbilities, brainSide, loadBrainSide } from './registry';

const OFFERED = 'ghosty.offered';
const OPENED = 'ghosty.opened';

const read = <T>(key: string, none: T): T => {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? 'null') as T) ?? none;
  } catch {
    return none;
  }
};
const write = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable: remembered by the brain only */
  }
};

/** The screens he has opened on this phone (an app ability whose screen he has seen is not news to him). */
ui.subscribe((s, p) => {
  if (s.tab === p.tab || s.tab.startsWith('area-')) return;
  const seen = read<string[]>(OPENED, []);
  if (!seen.includes(s.tab)) write(OPENED, [...seen, s.tab].slice(-60));
});

const allowed = (daily = false) => {
  const asked = (globalThis as { __ghostyOffers?: boolean | 'context' }).__ghostyOffers;
  return !navigator.webdriver || asked === true || (!daily && asked === 'context');
};

/** What was offered: the brain's list (as last heard) and this phone's, together. */
function offered(): Offered[] {
  const mine = read<Offered[]>(OFFERED, []);
  const theirs = brainSide.get().info.offered ?? [];
  return [...theirs, ...mine.filter((m) => !theirs.some((t) => t.id === m.id))];
}

/** Mid-task: a reply or a tool working, an approval waiting, a paper being sat, the GYM training, a download running. */
export function midTask(): boolean {
  const es = chat.get().entries;
  return !!ui.get().busy || es.some((e) => (e.kind === 'activity' && e.state === 'running') || (e.kind === 'approval' && e.state === 'waiting')) || Object.keys(liveIn()).length > 0;
}

/** Remember it (here at once, in the brain as well) and say the one line, with its tap, in the chat and on Home's line. */
export function say(o: Offer, now = Date.now()): void {
  write(OFFERED, [...read<Offered[]>(OFFERED, []).filter((x) => x.id !== o.id), { id: o.id, at: now }].slice(-200));
  brainSide.set((s) => ({ info: { ...s.info, offered: [...(s.info.offered ?? []).filter((x) => x.id !== o.id), { id: o.id, at: now }] } }));
  void brain.abilityOffered(o.id).catch(() => undefined);
  const go: NonNullable<LocalAnswer['go']>[number] = !o.go ? { id: o.ability, ask: -1, label: o.label } : 'run' in o.go ? { id: o.ability, ask: -1, label: o.label, run: o.go.run, args: o.go.args } : { id: o.ability, ask: -1, label: o.label, words: o.go.ask };
  chat.set((s) => ({ entries: [...s.entries, { kind: 'assistant' as const, text: o.line, at: now, model: DIRECT, local: { kind: 'offer' as const, go: [go] } }].slice(-120) }));
  chat.set({ live: o.line });
}

/** After a turn (assistant/session.ts, once its reply is in): the one line its context calls for, if any. */
export function offerAfterTurn(text: string, now = Date.now()): Offer | null {
  if (!allowed()) return null;
  const es = chat.get().entries;
  let i = es.length - 1;
  while (i >= 0 && es[i]!.kind !== 'user') i--;
  const ran = es.slice(i + 1).flatMap((e) => (e.kind === 'activity' && e.tool ? [e.tool] : []));
  const o = offerFor({ text, ran, busy: midTask() }, { offered: offered(), used: brainSide.get().info.used ?? [] }, now);
  if (o) say(o, now);
  return o;
}

/** Once a day, a while after he opens the app and with nothing under way: "Did you know I can …?" */
export async function dailyOffer(now = Date.now()): Promise<Offer | null> {
  if (!allowed(true)) return null;
  await loadBrainSide();
  const o = didYouKnow(allAbilities(), { offered: offered(), used: brainSide.get().info.used ?? [], opened: read<string[]>(OPENED, []) }, midTask(), now);
  if (o) say(o, now);
  return o;
}

/** The first run counts as the day's line: nothing else unprompted that day. */
export function noteFirstRun(now = Date.now()): void {
  write(OFFERED, [...read<Offered[]>(OFFERED, []), { id: 'first', at: now }]);
}
