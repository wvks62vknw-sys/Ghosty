/**
 * Questions about Ghosty himself, answered on the phone from what is really there, with no model (BRIEF-ABILITIES):
 *  - "can you …?" (OWNER-ISSUES 68): the same search as the ABILITIES box — the ability and a way straight to it, or
 *    "Not yet. Want me to learn it?", whose YES becomes a learning goal. Only a question about him is taken: a polite
 *    request ("can you remind me at 5 to call mum") goes to the brain as always (shared/abilities.ts canYouAsked).
 * The reply is an ordinary chat entry with `local` (what its buttons do); session.ts calls `localTurn` first.
 */
import { bestAsk, canYouAsked, searchAbilities, type Ability } from '../../../../packages/shared/src/abilities';
import { brain } from '../api/brain';
import { allAbilities, loadBrainSide, type AppAbility } from '../abilities/registry';
import { chat, type Entry } from './session';
import { speak } from './voice';

/** What a local answer's buttons do: GO to what was found, YES / NO to learning it, DO IT (his words to the brain after all). */
export interface LocalAnswer {
  kind: 'can';
  /** Found, best first: the ability (by id) and which of its asks fits (−1: its own GO). */
  go?: { id: string; ask: number; label: string }[];
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
export async function localTurn(text: string, opts: { voice?: boolean; private?: boolean } = {}): Promise<boolean> {
  const thing = canYouAsked(text);
  if (thing === null) return false;
  // the brain's abilities as last heard (kept on this phone); a fresh look in the background for next time
  if (!allAbilities().some((a) => a.from === 'brain')) await Promise.race([loadBrainSide(), new Promise((r) => setTimeout(r, 1500))]);
  else void loadBrainSide();
  const { text: reply, local } = canAnswer(thing);
  // DO IT sends what he typed, as he typed it
  local.doIt = text;
  add({ kind: 'user', text, at: stamp(), ...(opts.private ? { private: true } : {}) });
  add({ kind: 'assistant', text: reply, at: stamp(), model: DIRECT, local, ...(opts.private ? { private: true } : {}) });
  if (opts.voice) void speak(reply).catch(() => undefined);
  return true;
}

/** The ability a GO chip names, as this phone knows it now (null: no longer there). */
export const abilityById = (id: string): Ability | AppAbility | null => allAbilities().find((a) => a.id === id) ?? null;
