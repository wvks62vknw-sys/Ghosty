/**
 * Questions about Ghosty himself, answered on the phone from what is really there, with no model (BRIEF-ABILITIES):
 *  - "can you …?" (OWNER-ISSUES 68): the same search as the ABILITIES box — the ability and a way straight to it, or
 *    "Not yet. Want me to learn it?", whose YES becomes a learning goal. Only a question about him is taken: a polite
 *    request ("can you remind me at 5 to call mum") goes to the brain as always (shared/abilities.ts canYouAsked);
 *  - "why did you do that?" (OWNER-ISSUES 67d): the last reply's trail in plain words (features/core/why.ts); a bare "why?"
 *    after a reply that ran nothing is about what was said, so it goes to the brain;
 *  - "what did you do today?" (OWNER-ISSUES 68c): the brain's day (GET /api/today) with this phone's own (the GYM's games
 *    and the games he played me), one short list, newest first;
 *  - FORESIGHT (OWNER-ISSUES 61a): "what do you expect today?", "how often are you right?", "were you right?" from the
 *    brain's ledger (GET /api/foresight, kept a minute), and "you were right" / "you were wrong" on his latest open question
 *    (under seven days old): his word kept with POST /api/foresight/resolve;
 *  - THE MACHINE VIEW (OWNER-ISSUES 61c): "machine view", "show me my city", "what are you watching?", "what can you see?"
 *    open God's Eye in the mode, and the answer is its count line (features/eye/machine.ts);
 *  - THE WORKBENCH (OWNER-ISSUES 61b): "wind tunnel", "beam calculator", "sun and shadow" open its panel; a bare problem
 *    with its numbers ("3 m steel beam 5 kN in the middle") fills the panel from his words and is answered with the estimate
 *    (packages/shared/src/workbench words.ts `workbenchAsked`); a question goes to the brain, whose `estimate` tool runs the
 *    same solvers.
 *  - THE CAR (BRIEF-CAR): what is wrong with a car ("my dad's car grinds when I brake") puts the fault table's suspects on
 *    its CAR card, and "open the bonnet", "show me the brakes", "what's under it" open the 3D STUDIO on it (car/ask.ts).
 * The reply is an ordinary chat entry with `local` (what its buttons do); session.ts calls `localTurn` first.
 */
import { bestAsk, canYouAsked, dayLines, searchAbilities, whyAsked, whyLines, type Ability, type DayItem } from '../../../../packages/shared/src/abilities';
import { ANSWER_DAYS, foresightAsked, foresightWords, notedWords, rightSaid } from '../../../../packages/shared/src/foresight';
import { loadForesight, resolveForesight } from '../state/foresight';
import { machineState } from '../features/eye/machine';
import { estimateText, workbenchAsked } from '../../../../packages/shared/src/workbench';
import { openWorkbench } from '../features/workbench/index';
import { PANELS as BENCH } from '../features/workbench/panels';
import { timeZone, ui } from '../state/app';
import { lastReplyAt, resolveTrail } from '../features/core/why';
import { brain } from '../api/brain';
import { allAbilities, loadBrainSide, type AppAbility } from '../abilities/registry';
import { chat, type Entry } from './session';
import { LOCAL_ASKS, type LocalAsk } from './phrases';
import { bodyTurn, creativeTurn, kitchenTurn, peopleTurn, statementOrBox, workTurn, type PackReply } from './packs';
import { chessRatingTurn, coachTurn } from './restb';
import { convertTurn, numbersTurn } from './reste';
import { carFaultTurn, carViewTurn } from '../car/ask';
import { fromMorse, morseAsked, toMorse } from '../morse/code';
import { speak } from './voice';
import { originLines } from '../../../../packages/shared/src/social';
import { card } from '../../../../packages/shared/src/cards';

/** What a local answer's buttons do: GO to what was found, YES / NO to learning it, DO IT (his words to the brain after all). */
export interface LocalAnswer {
  kind: 'can' | 'why' | 'today' | 'first' | 'offer' | 'foresight' | 'machine' | 'workbench' | 'pack' | 'car' | 'origin';
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

/** One question and its answer, said here: in the chat (and aloud when he asked by voice). */
function answer(text: string, reply: string, local: LocalAnswer, opts: { voice?: boolean; private?: boolean }): true {
  add({ kind: 'user', text, at: stamp(), ...(opts.private ? { private: true } : {}) });
  add({ kind: 'assistant', text: reply, at: stamp(), model: DIRECT, local, ...(opts.private ? { private: true } : {}) });
  chat.set({ live: reply });
  if (opts.voice) void speak(reply).catch(() => undefined);
  return true;
}

/** [packs] A pack's answer: his message as it shows (a statement never shown back whole), the reply, its cards in the chat. */
function packAnswer(r: PackReply, opts: Opts): true {
  answer(r.said, r.reply, { kind: 'pack', ...(r.go ? { go: r.go } : {}) }, opts);
  if (r.cards?.length) void import('../features/core/cards').then((c) => r.cards!.forEach((x) => c.postCard(x))).catch(() => undefined);
  return true;
}

/** A read of the brain that gives up after six seconds (null), so the chat never hangs on it. */
const within = <T>(p: Promise<T>, ms = 6000): Promise<T | null> => Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]).catch(() => null);

type Opts = { voice?: boolean; private?: boolean };

/**
 * Each table's answer, by its id in assistant/phrases.ts LOCAL_ASKS (the order they are tried in): true when it answered,
 * false to let the next table try (the Lens's "what can you see?", "you were right" with no question open, a bare "why?"
 * after a reply that ran nothing).
 */
const ANSWERS: Record<LocalAsk, (text: string, opts: Opts) => Promise<boolean> | boolean> = {
  // the car (car/ask.ts): its views open in the Studio; what is wrong with it lands on its CAR card
  carview: (text, opts) => carViewTurn(text, opts, answer),
  carfault: (text, opts) => carFaultTurn(text, opts),
  // [packs] THE PACKS (BRIEF-PACKS-1, assistant/packs.ts): a pasted statement read on its way to his brain, never by a model
  statement: async (text, opts) => packAnswer(await statementOrBox(text), opts),
  reps: async (text, opts) => packAnswer(await bodyTurn(text), opts),
  run: async (text, opts) => packAnswer(await bodyTurn(text), opts),
  breathe: async (text, opts) => packAnswer(await bodyTurn(text), opts),
  stretch: async (text, opts) => packAnswer(await bodyTurn(text), opts),
  water: async (text, opts) => packAnswer(await bodyTurn(text), opts),
  timer: async (text, opts) => packAnswer(await kitchenTurn(text), opts),
  shopping: async (text, opts) => packAnswer(await kitchenTurn(text), opts),
  oven: async (text, opts) => packAnswer(await kitchenTurn(text), opts),
  // [social] FATHER AND THE ORIGIN (BRIEF-SOCIAL item 1): the page's first lines, and its card to open the whole page
  origin(text, opts) {
    answer(text, originLines().join(' '), { kind: 'origin' }, opts);
    const c = card({ id: 'origin', kind: 'brief', title: 'Father and the origin', line: 'Who made me, when, of what, what I learned and my promises', brief: { icon: 'origin' }, acts: [{ label: 'OPEN', run: { name: 'open_origin', args: {} } }] });
    void import('../features/core/cards').then((c2) => c2.postCard(c)).catch(() => undefined);
    return true;
  },
  // [resta] WIKIPEDIA, OFFLINE from the file on this phone (wiki/ask.ts): the first paragraph and a card that opens it; with no
  // file here, "what does wikipedia say about …" (no "offline") is the brain's as before
  async wiki(text, opts) {
    const last = [...chat.get().entries].reverse().find((e) => e.kind === 'user')?.text ?? '';
    const r = await import('../wiki/ask').then((w) => w.wikiTurn(text, last)).catch(() => null);
    return r ? packAnswer(r, opts) : false;
  },
  // [resta] MORSE: the sheet on the side his words asked for, and the conversion said in the chat (morse/sheet.ts)
  async morse(text, opts) {
    const ask = morseAsked(text);
    if (!ask) return false;
    void import('../morse/sheet').then((s) => s.openMorse(ask));
    const reply =
      ask.mode === 'text' && ask.text
        ? `“${ask.text}” in Morse: ${toMorse(ask.text) || '(no letters Morse has)'}`
        : ask.mode === 'decode' && ask.text
          ? `${ask.text} reads “${fromMorse(ask.text)}”.`
          : ask.mode === 'learn'
            ? 'Morse, a letter a day: today’s is on the sheet, with a five-letter quiz.'
            : ask.mode === 'tap'
              ? 'Tap on the pad: a short press is a dot, a long one a dash.'
              : 'The Morse sheet is open: type words or dots and dashes, play them, flash them, or tap them out.';
    return answer(text, reply, { kind: 'pack' }, opts);
  },
  people: async (text, opts) => packAnswer(await peopleTurn(text), opts),
  interview: async (text, opts) => packAnswer(await workTurn(text), opts),
  pomodoro: async (text, opts) => packAnswer(await workTurn(text), opts),
  beat: async (text, opts) => packAnswer(await creativeTurn(text), opts),
  drawing: async (text, opts) => packAnswer(await creativeTurn(text), opts),
  // (with the Lens open, "what can you see?" is about what its camera sees: that stays the Lens's and the brain's)
  async machine(text, opts) {
    if (ui.get().tab === 'lens' && /\bsee\b/i.test(text)) return false;
    location.hash = 'eye?machine';
    const t0 = Date.now();
    while (!(machineState.on && machineState.ready) && Date.now() - t0 < 6000) await new Promise((r) => setTimeout(r, 150));
    return answer(text, machineState.line || 'I couldn’t open God’s Eye just now. Try MACHINE VIEW in its bar.', { kind: 'machine' }, opts);
  },
  // the Workbench: a panel opened, or his problem filled in and answered on the phone (no model, no request)
  workbench(text, opts) {
    const bench = workbenchAsked(text);
    if (!bench) return false;
    const e = openWorkbench(bench.panel, bench.problem);
    const title = BENCH.find((p) => p.id === bench.panel)?.title;
    const name = bench.panel === 'tunnel' ? 'the wind tunnel' : title ? title.toLowerCase() : '';
    return answer(text, e ? estimateText(e) : name ? `The Workbench is open on ${name}. Change any number and the answer follows; every one is a first estimate, never certified.` : 'The Workbench is open: beams, gears, engines, flight, heat, sun and circuits. Every answer is a first estimate, never certified.', { kind: 'workbench' }, opts);
  },
  async foresight(text, opts) {
    const fore = foresightAsked(text);
    if (!fore) return false;
    const info = await within(loadForesight());
    return answer(text, info ? foresightWords(fore, info) : 'I can’t reach my brain right now, so I can’t read my predictions.', { kind: 'foresight' }, opts);
  },
  async right(text, opts) {
    const verdict = rightSaid(text);
    if (!verdict) return false;
    // only while one of his questions is open and under a week old; otherwise the words go to the brain as ever
    const info = await within(loadForesight(true));
    const open = info?.items.filter((p) => p.kind === 'answer' && !p.outcome && Date.now() - p.at < ANSWER_DAYS * 86_400_000).sort((a, b) => b.at - a.at)[0];
    if (!open) return false;
    const done = await within(resolveForesight(open.id, verdict.right));
    return answer(text, done ? notedWords(verdict.right) : 'I couldn’t reach my brain to note that. Try again when you’re back online.', { kind: 'foresight' }, opts);
  },
  today: (text, opts) => todayTurn(text, opts),
  why: (text, opts) => whyTurn(text, opts),
  chessrating: (text, opts) => packAnswer(chessRatingTurn(text), opts),
  tuner: async (text, opts) => packAnswer(await coachTurn(text), opts),
  coach: async (text, opts) => packAnswer(await coachTurn(text), opts),
  skill: async (text, opts) => packAnswer(await coachTurn(text), opts),
  // [reste] the converter, and its units and numbers answered here (assistant/reste.ts, convert/)
  convert: async (text, opts) => packAnswer(await convertTurn(text), opts),
  units: (text, opts) => numberAnswer(text, opts),
  base64: (text, opts) => numberAnswer(text, opts),
  unixtime: (text, opts) => numberAnswer(text, opts),
  canyou: (text, opts) => canYouTurn(text, opts),
};

/** A unit, base64 or Unix-time answer, or the next table's turn. */
function numberAnswer(text: string, opts: Opts): boolean {
  const r = numbersTurn(text);
  return r ? packAnswer(r, opts) : false;
}

/** The questions about Ghosty himself, answered here with no model: the first table that matches and has an answer. */
export async function localTurn(text: string, opts: Opts = {}): Promise<boolean> {
  for (const p of LOCAL_ASKS) if (p.test(text) && (await ANSWERS[p.id](text, opts))) return true;
  return false;
}

async function todayTurn(text: string, opts: Opts): Promise<boolean> {
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

async function whyTurn(text: string, opts: Opts): Promise<boolean> {
  const why = whyAsked(text);
  if (!why) return false;
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

async function canYouTurn(text: string, opts: Opts): Promise<boolean> {
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
