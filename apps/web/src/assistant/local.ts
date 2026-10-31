/**
 * Questions about Ghosty himself, answered on the phone from what is really there, with no model (BRIEF-ABILITIES):
 *  - "can you …?" (OWNER-ISSUES 68): the same search as the ABILITIES box — the ability and a way straight to it, or
 *    "Not yet. Want me to learn it?", whose YES becomes a learning goal. Only a question about him is taken: a polite
 *    request ("can you remind me at 5 to call mum") goes to the brain as always (shared/abilities.ts canYouAsked);
 *  - "why did you do that?" (OWNER-ISSUES 67d): the last reply's trail in plain words (features/core/why.ts); a bare "why?"
 *    after a reply that ran nothing is about what was said, so it goes to the brain;
 *  - "what did you do today?" (OWNER-ISSUES 68c): the brain's day (GET /api/today) with this phone's own (the GYM's games
 *    and the games he played me), one short list, newest first.
 * The reply is an ordinary chat entry with `local` (what its buttons do); session.ts calls `localTurn` first.
 */
import { bestAsk, canYouAsked, dayLines, searchAbilities, todayAsked, whyAsked, whyLines, type Ability, type DayItem } from '../../../../packages/shared/src/abilities';
import { timeZone } from '../state/app';
import { lastReplyAt, resolveTrail } from '../features/core/why';
import { brain } from '../api/brain';
import { allAbilities, loadBrainSide, type AppAbility } from '../abilities/registry';
import { chat, type Entry } from './session';
import { speak } from './voice';

/** What a local answer's buttons do: GO to what was found, YES / NO to learning it, DO IT (his words to the brain after all). */
export interface LocalAnswer {
  kind: 'can' | 'why' | 'today' | 'first' | 'offer';
  /**
   * Found, best first: the ability (by id) and which of its asks fits (−1: its own GO); or a screen to open (`open`), a
   * command to run (`run` with `args`), or words to put in the chat box (`words`).
   */
  go?: { id: string; ask: number; label: string; open?: string; run?: string; args?: Record<string, unknown>; words?: string }[];
  /** The offer to learn it, with his words, and what he said to it. */
  learn?: { ask: string; state: 'open' | 'yes' | 'no' };
  /** His words, for DO IT: when he meant it as a request after all, the brain takes it from here. */
  doIt?: string;
}

/** The label of reply that needed no model (the brain's small talk carries the same). */
export const DIRECT = 'Direct · no AI';

let lastStamp = 0;
const stamp = () => (lastStamp = Math.max(Date.now(), lastStamp + 1));
function add(e: Entry): void {
  chat.set((s) => ({ entries: [...s.entries, e].slice(-120) }));
}

/** A screen's name for a GO chip ("Lens", "God’s eye"), or the ability's own first words. */
function goLabel(a: Ability, ask: number): string {
  if (ask >= 0 && a.asks[ask]) return a.asks[ask]!;
  return a.from === 'brain' ? 'Do it' : 'Go there';
}

/** "can you …?" in his words → the reply and its buttons, from the search over everything he can do. */
export function canAnswer(words: string, list: Ability[] = allAbilities()): { text: string; local: LocalAnswer } {
  const r = searchAbilities(list, words);
  const top = r.hits[0]?.ability;
  if (r.kind === 'hit' && top) {
    const ask = bestAsk(top, words);
    const tip = ask >= 0 && top.from === 'app' ? ` Try “${top.asks[ask]}”.` : '';
    const off = top.off ? ` (It ${top.off}.)` : '';
    const go = r.hits.slice(0, 2).map((h) => {
      const i = h.ability === top ? ask : bestAsk(h.ability, words);
      return { id: h.ability.id, ask: h.ability.from === 'app' ? i : -1, label: h.ability.off ? 'Set it up' : h.ability.from === 'brain' ? 'Do it' : goLabel(h.ability, i) };
    });
    return { text: `Yes. ${top.line}${tip}${off}`, local: { kind: 'can', go, doIt: words } };
  }
  if (r.kind === 'near' && top) {
    return {
      text: `Not quite. The nearest I’ve got: ${top.line} Want me to learn it properly?`,
      local: { kind: 'can', go: [{ id: top.id, ask: top.from === 'app' ? bestAsk(top, words) : -1, label: top.from === 'brain' ? 'Do it' : goLabel(top, bestAsk(top, words)) }], learn: { ask: words, state: 'open' }, doIt: words },
    };
  }
  return { text: 'Not yet. Want me to learn it?', local: { kind: 'can', learn: { ask: words, state: 'open' }, doIt: words } };
}

/** YES to "want me to learn it?": his words become a learning goal (ABILITIES → LEARNING, Workshop → UPGRADE IDEAS). */
export async function learnIt(at: number): Promise<boolean> {
  const e = chat.get().entries.find((x) => x.kind === 'assistant' && x.at === at) as Extract<Entry, { kind: 'assistant' }> | undefined;
  const ask = e?.local?.learn?.ask;
  if (!e || !ask) return false;
  try {
    await brain.learnGoal(ask);
  } catch {
    return false;
  }
  setLearn(at, 'yes');
  void loadBrainSide();
  return true;
}

/** NO just closes the offer. */
export function setLearn(at: number, state: 'yes' | 'no'): void {
  chat.set((s) => ({
    entries: s.entries.map((x) => (x.kind === 'assistant' && x.at === at && x.local?.learn ? { ...x, local: { ...x.local, learn: { ...x.local.learn, state } } } : x)),
  }));
}

/**
 * Answer here, with no model, when the message is a question about Ghosty himself; false when it is anything else (the
 * brain answers it as always). `voice`: he asked by voice, so the answer is said too.
 */
/** This phone's own doings today: the GYM's training (its day points) and the games he played me (the journal). */
export async function phoneDay(now = Date.now()): Promise<DayItem[]> {
  const out: DayItem[] = [];
  try {
    const gym = await import('../features/gym/store');
    const { META } = await import('../gym/meta');
    const name = (id: string) => {
      const t = META.find((g) => g.id === id)?.title ?? id;
      return t.charAt(0) + t.slice(1).toLowerCase();
    };
    const day = new Date(now).toISOString().slice(0, 10);
    const start = new Date(now).setHours(0, 0, 0, 0);
    for (const r of (await gym.loadAll()).values()) {
      const p = r.days?.find((x) => x.d === day);
      if (p && r.updated >= start) out.push({ at: r.updated, text: `Trained in the GYM at ${name(r.id)}: level ${r.level}, ${Math.round(r.mastery * 100)}% mastered` });
    }
    for (const g of (await gym.loadJournal()).c4) if (!g.spec && g.at >= start) out.push({ at: g.at, text: `You played me at Connect 4: ${g.result === 'you' ? 'you won' : g.result === 'me' ? 'I won' : 'a draw'}` });
  } catch {
    /* no GYM on this phone yet: nothing of it to say */
  }
  return out;
}

export async function localTurn(text: string, opts: { voice?: boolean; private?: boolean } = {}): Promise<boolean> {
  if (todayAsked(text)) {
    const tz = timeZone;
    const [brainSide, phone] = await Promise.all([
      Promise.race([brain.today(tz).then((r) => r.items), new Promise<null>((r) => setTimeout(() => r(null), 6000))]).catch(() => null),
      phoneDay(),
    ]);
    const lines = dayLines([...(brainSide ?? []), ...phone], tz);
    if (!brainSide) lines.push('I can’t reach my brain right now, so this is only what this phone did.');
    const reply = lines.join('\n');
    add({ kind: 'user', text, at: stamp(), ...(opts.private ? { private: true } : {}) });
    add({ kind: 'assistant', text: reply, at: stamp(), model: DIRECT, local: { kind: 'today' }, ...(opts.private ? { private: true } : {}) });
    chat.set({ live: reply });
    if (opts.voice) void speak(reply).catch(() => undefined);
    return true;
  }
  const why = whyAsked(text);
  if (why) {
    const at = lastReplyAt();
    const r = at ? await resolveTrail(at) : null;
    if (!r || (why === 'bare' && !r.trail.steps.length)) return false;
    const reply = ['Why I did that:', ...whyLines(r.trail, allAbilities()), ...(r.note ? [r.note] : [])].join('\n');
    add({ kind: 'user', text, at: stamp(), ...(opts.private ? { private: true } : {}) });
    add({ kind: 'assistant', text: reply, at: stamp(), model: DIRECT, local: { kind: 'why' }, ...(opts.private ? { private: true } : {}) });
    chat.set({ live: reply });
    if (opts.voice) void speak(reply).catch(() => undefined);
    return true;
  }
  const thing = canYouAsked(text);
  if (thing === null) return false;
  // the brain's abilities as last heard (kept on this phone); a fresh look in the background for next time
  if (!allAbilities().some((a) => a.from === 'brain')) await Promise.race([loadBrainSide(), new Promise((r) => setTimeout(r, 1500))]);
  else void loadBrainSide();
  const { text: reply, local } = canAnswer(thing);
  // DO IT sends what he typed, as he typed it; a learning goal keeps his own words too
  local.doIt = text;
  if (local.learn) local.learn.ask = text;
  add({ kind: 'user', text, at: stamp(), ...(opts.private ? { private: true } : {}) });
  add({ kind: 'assistant', text: reply, at: stamp(), model: DIRECT, local, ...(opts.private ? { private: true } : {}) });
  chat.set({ live: reply });
  if (opts.voice) void speak(reply).catch(() => undefined);
  return true;
}

/** The ability a GO chip names, as this phone knows it now (null: no longer there). */
export const abilityById = (id: string): Ability | AppAbility | null => allAbilities().find((a) => a.id === id) ?? null;
