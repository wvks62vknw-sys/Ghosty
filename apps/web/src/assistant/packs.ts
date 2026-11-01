/**
 * THE PACKS on the phone (BRIEF-PACKS-1): what the chat does here, with no model, for the money, body and kitchen packs —
 * the tables are assistant/phrases.ts LOCAL_ASKS, and assistant/local.ts writes the chat from what these return.
 *  - MONEY: a statement pasted in the chat (its CSV, or the text copied out of its PDF) goes to his own brain's SPENDING
 *    with the rule table only (no model sees it, not even the shops' names), and comes back as the month's card: the top
 *    five categories and what changed. The chat shows "a statement pasted (N lines)", never the statement itself.
 *  - BODY: "count my squats", "start a run", "breathe", "stretch with me" open the phone's own screens (features/body);
 *    "had a glass of water" is kept in my brain by its own code (POST /packs/do), no model either way.
 *  - KITCHEN: "timer 8 minutes for the pasta" (several at once) set on this phone's clock; "shopping list" opens the list;
 *    "fan 180 in conventional?" answered here.
 */
import type { Card } from '../../../../packages/shared/src/cards';
import { monthCard, monthWords, unflatten } from '../../../../packages/shared/src/money';
import { bodyAsked, EXERCISES } from '../../../../packages/shared/src/body';
import { mmss, ovenAsked, shoppingAsked, timerAsked } from '../../../../packages/shared/src/kitchen';
import { INTERVIEW_ASK, POMO_ASK, pomodoroPlan, questionsFor } from '../../../../packages/shared/src/work';
import { beatFromWords, DRAW_ASK, drawingPrompt } from '../../../../packages/shared/src/creative';
import { outsideAsked, type OutsideView } from '../../../../packages/shared/src/outside';
import { homeAsked, type HomeView } from '../../../../packages/shared/src/homeadmin';
import { dailyWords, FIRST_AID_LINE, LANGS, learningAsked, lessonFor, TYPING_LINES, typingScore } from '../../../../packages/shared/src/learning';
import { answerTyping, armTyping } from '../features/learning/typing';
import { libraryPassage } from '../features/learning/library';
import { brain } from '../api/brain';

/** What local.ts writes: his message as the chat shows it, the reply, the cards, and the GO chips under it. */
export interface PackReply {
  said: string;
  reply: string;
  cards?: Card[];
  go?: { id: string; ask: number; label: string; open?: string; run?: string; args?: Record<string, unknown>; words?: string }[];
}

const prevMonth = (m: string) => (m.slice(5, 7) === '01' ? `${+m.slice(0, 4) - 1}-12` : `${m.slice(0, 4)}-${String(+m.slice(5, 7) - 1).padStart(2, '0')}`);

/** "paste a statement": the box that keeps a statement's lines (features/money); a statement itself: read at once. */
export const PASTE_ASK = /^(?:i want to |let me |can i )?(?:paste|add|read|send)\s+(?:in\s+)?(?:a|my)\s+(?:bank\s+)?statement[.!?]?$/i;
export async function statementOrBox(text: string): Promise<PackReply> {
  if (!PASTE_ASK.test(text.trim())) return statementTurn(text);
  const { openMoney } = await import('../features/money/sheet');
  openMoney();
  return { said: text, reply: 'Paste it in the box (it keeps the lines), or pick the CSV or PDF your bank gave you. It goes to my brain only, read by code.' };
}

export async function statementTurn(text: string): Promise<PackReply> {
  const lines = unflatten(text).split(/\r?\n/).filter((l) => l.trim()).length;
  const said = `A statement pasted (${lines} lines): read in code on its way to my brain, never shown to a model.`;
  try {
    const r = await brain.spendingImport(text, true);
    const v = r.view;
    if (!v) return { said, reply: 'I read it, but there were no payments in it I could keep.' };
    const res = r.result;
    const moves = r.moves ?? [];
    const head = `Read ${res.added} payment${res.added === 1 ? '' : 's'}${res.duplicates ? ` (${res.duplicates} I had already)` : ''}${res.unplaced ? `; ${res.unplaced} the rules couldn’t place are under “other” — a tap files them in Agenda → SPENDING` : ''}.`;
    return {
      said,
      reply: `${head} ${monthWords(v, moves, r.months.includes(prevMonth(v.month)))} Kept in your brain only; no bank access.`,
      cards: [monthCard(v, moves)],
      go: [{ id: 'spending', ask: -1, label: 'Open spending', open: 'agenda' }],
    };
  } catch (e) {
    const why = (e as Error).message || 'my brain did not answer';
    return { said, reply: `I couldn’t keep that statement: ${why}. Nothing was sent anywhere else.` };
  }
}

/** [packs2] "who's who", "my people": the people sheet (features/people), over the chat; nothing is looked up. */
export async function peopleTurn(text: string): Promise<PackReply> {
  const { openPeople } = await import('../features/people/sheet');
  void openPeople('who');
  return { said: text, reply: 'Here are the people you’ve told me about: tap one for gift ideas or the details you gave me. I only know what you tell me, and I never look anyone up.', go: [{ id: 'people', ask: -1, label: 'Open it again', run: 'open_people', args: { what: 'who' } }] };
}

/** [packs2] The work pack's words on this phone: interview practice opened, a pomodoro set on its own timers (and counted in my brain). */
export async function workTurn(text: string): Promise<PackReply> {
  const pomo = POMO_ASK.exec(text.trim());
  if (pomo) {
    const t = await import('../features/kitchen/timers');
    const k = await import('../features/kitchen/sheet');
    k.exposeKitchen();
    if (/^(?:stop|cancel|end)\b/i.test(text.trim())) {
      const n = t.stopTimers('pomodoro');
      return { said: text, reply: n ? 'Pomodoro stopped: its timers are cleared.' : 'No pomodoro is running.' };
    }
    const plan = pomodoroPlan(text);
    const made = t.startTimers(plan.timers);
    void brain.packDo('work', 'pomodoro', { words: text }).catch(() => undefined);
    const at = new Date(made[0]!.end - (t.clockNow() - Date.now())).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return { said: text, reply: `Pomodoro: ${plan.rounds} × ${plan.focus} minutes of focus with ${plan.rest}-minute breaks${plan.rounds >= 4 ? ` and a ${plan.long}-minute long break at the end` : ''}. The first focus ends at ${at}; they ring one after another while Ghosty is open.`, go: [{ id: 'timers', ask: -1, label: 'Open timers', run: 'open_kitchen', args: { what: 'timers' } }] };
  }
  const iv = INTERVIEW_ASK.exec(text.trim());
  const role = iv?.[1]?.trim() ?? '';
  const q = questionsFor(role);
  const { openWork } = await import('../features/work/sheet');
  void openWork('interview', { role, questions: q.questions });
  return { said: text, reply: `Interview practice is open${role ? ` for ${role}` : ''}: I ask each question aloud, you answer by voice or typing, and I time it and tell you plainly how it went.`, go: [{ id: 'interview', ask: -1, label: 'Open it again', run: 'open_work', args: { what: 'interview', role, questions: q.questions } }] };
}

/** [packs2] The creative pack's words on this phone: the drum pads opened, or the day's drawing prompt, with no model. */
export async function creativeTurn(text: string): Promise<PackReply> {
  if (DRAW_ASK.test(text.trim())) {
    const d = new Date();
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { said: text, reply: `Today's drawing prompt: ${drawingPrompt(day)} It stays the same all day; ask the chat for "another".` };
  }
  const beat = beatFromWords(text);
  const { openCreative } = await import('../features/creative/sheet');
  void openCreative('beat', { beat });
  return { said: text, reply: `The drum pads are open with a ${beat.name} beat at ${beat.bpm} bpm: tap the squares, or tap the pads along with the loop. You can save it as a WAV or a MIDI file.`, go: [{ id: 'beat', ask: -1, label: 'Open it again', run: 'open_creative', args: { what: 'beat', beat } }] };
}

/**
 * [packs3] The outside pack's words on this phone: "where did I park?" answered from my brain's notes; "I parked on Cannon
 * Street until 3pm" kept there; anything that needs where he is (toilets, cash, a car park near me, "I'm lost") opens the
 * OUTSIDE sheet, where one tap gives the spot once. No model, and I never see where he is on my own.
 */
export async function outsideTurn(text: string): Promise<PackReply> {
  const view: OutsideView = outsideAsked(text) ?? 'toilets';
  const t = text.trim();
  const again = (what: string) => [{ id: 'outside', ask: -1, label: 'Open it again', run: 'open_outside', args: { what } }];
  if (view === 'car') {
    try {
      const r = await brain.packDo('outside', 'parked', {});
      return { said: text, reply: r.text, ...(r.cards ? { cards: r.cards } : {}), go: again('car') };
    } catch {
      return { said: text, reply: 'My brain didn’t answer, so I can’t say where the car is just now: try again in a moment.' };
    }
  }
  if (view === 'parkedhere' && !/^(?:i(?:'ve| have)?|we(?:'ve| have)?)\s+(?:just\s+)?parked\s*(?:here)?$/i.test(t) && !/^parked here$/i.test(t)) {
    try {
      const r = await brain.packDo('outside', 'parked', { words: text });
      return { said: text, reply: r.text, ...(r.cards ? { cards: r.cards } : {}), go: again('car') };
    } catch {
      return { said: text, reply: 'My brain didn’t answer, so I haven’t kept where you parked: try again in a moment.' };
    }
  }
  const { openOutside } = await import('../features/outside/sheet');
  void openOutside(view === 'parkedhere' ? 'car' : view);
  const reply =
    view === 'parkedhere' ? 'Tell me the street or car park, or tap USE WHERE I AM NOW: I keep that one spot, and the time, so you can ask where the car is. I don’t track you.'
    : view === 'lost' ? 'Tap USE WHERE I AM NOW once: I show the nearest place you saved, the nearest station and the way. If you feel unsafe, call 999.'
    : view === 'safewalk' ? 'Pick where from and where to: I count police reports along each way and offer a way round the busiest stretch. “Fewer reports” is not “safe”.'
    : 'For somewhere near you, tap USE WHERE I AM NOW once (it is used and not kept), or name a place or pick one you saved.';
  return { said: text, reply, go: again(view === 'parkedhere' ? 'car' : view) };
}

/**
 * [packs3] The home pack's words on this phone: "when are the bins?", "what's due at home?" and "my bills" are answered from my
 * brain's own records with no model (and the HOME sheet a tap away); the meter and the rooms open their pages.
 */
export async function homeTurn(text: string): Promise<PackReply> {
  const view: HomeView = homeAsked(text) ?? 'due';
  const again = [{ id: 'homeadmin', ask: -1, label: 'Open the HOME sheet', run: 'open_homeadmin', args: { what: view } }];
  if (view === 'bins' || view === 'due' || view === 'bills') {
    try {
      const r = await brain.packDo('homeadmin', view, view === 'due' ? { days: 14 } : {});
      return { said: text, reply: r.text, ...(r.cards ? { cards: r.cards } : {}), go: again };
    } catch {
      return { said: text, reply: 'My brain didn’t answer, so I can’t read your home records just now: try again in a moment.' };
    }
  }
  const { openHomeadmin } = await import('../features/homeadmin/sheet');
  void openHomeadmin(view);
  return { said: text, reply: view === 'meter' ? 'The meter page is open: photograph the dial, or type the number. I keep the reading and the day, and tell you the usage since last time.' : 'The rooms page is open: list what is in a room, or photograph it and tick what is really there. I can make a CSV for your insurer.', go: again };
}

/** His local day (YYYY-MM-DD), for the day's ten words and the day's lesson. */
const localToday = (): string => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

/**
 * [packs3] The learning pack's words on this phone: "ten Spanish words" answered here from the tables, "typing test" run in
 * the chat's own box (the clock starts at his first key, the next thing he sends is scored on this phone and the result kept in
 * my brain), "how am I doing" read from my brain's log; every other practice opens its page of the LEARNING sheet. No model.
 * null: what he sent is not for the learning pack (a typing test was up and this is not an attempt at it).
 */
export async function learningTurn(text: string): Promise<PackReply | null> {
  const ans = answerTyping(text);
  if (ans?.kind === 'cancel') return { said: text, reply: 'The typing test is cancelled. Say “typing test” when you want another.' };
  if (ans?.kind === 'score') {
    if (ans.pasted) return { said: text, reply: 'That looks pasted, and a paste cannot be timed. Say “typing test” and type it by hand.' };
    const t = typingScore(ans.target, text, ans.ms);
    let logged = '';
    if (t.valid) {
      try {
        logged = (await brain.packDo('learning', 'done', { skill: 'typing', score: t.wpm, unit: 'wpm', detail: `${t.accuracy}%` })).text;
      } catch {
        logged = 'My brain didn’t answer, so this one is not in your streak.';
      }
    }
    return {
      said: text,
      reply: `${t.said}${ans.timed ? '' : ' (I did not see your first key, so this includes the time you spent reading.)'}${logged ? `\n${logged}` : ''}`,
      go: [{ id: 'learning', ask: -1, label: 'Another passage', run: 'open_learning', args: { what: 'typing' } }],
    };
  }
  const ask = learningAsked(text);
  if (!ask) return null;
  const again = (what: string, extra: Record<string, unknown> = {}) => [{ id: 'learning', ask: -1, label: 'Open the LEARNING sheet', run: 'open_learning', args: { what, ...extra } }];
  if (ask.view === 'typing') {
    const seed = Math.floor(Math.random() * 9973);
    const passage = (await libraryPassage(seed)) || TYPING_LINES[seed % TYPING_LINES.length]!;
    armTyping(passage);
    return { said: text, reply: `Typing test: type this as fast as you can, then send it. The clock starts at your first key in the box below, and I score words a minute (right letters only) and accuracy.\n\n“${passage}”`, go: again('typing', { passage }) };
  }
  if (ask.view === 'words') {
    let saved = '';
    try {
      saved = localStorage.getItem('ghosty.learning.lang') ?? '';
    } catch {
      /* a private window */
    }
    const l = LANGS.find((x) => x.id === (ask.lang ?? saved));
    if (!l) {
      const { openLearning } = await import('../features/learning/sheet');
      void openLearning('words');
      return { said: text, reply: `Which language? I have ${LANGS.slice(0, -1).map((x) => x.name).join(', ')} and ${LANGS[LANGS.length - 1]!.name}: say “ten Spanish words”, or pick one on the page.`, go: again('words') };
    }
    const d = dailyWords(l.id, localToday());
    return {
      said: text,
      reply: `${l.name}, today’s ten (${d.day}):\n${d.entries.map((e, i) => `${i + 1}. ${e.en} — ${e.word}${e.roman ? ` (${e.roman})` : ''}`).join('\n')}\nThe page says them in your phone’s own ${l.name} voice, and keeps them in a deck.`,
      go: again('words', { lang: l.id }),
    };
  }
  if (ask.view === 'progress') {
    try {
      const r = await brain.packDo('learning', 'progress', {});
      return { said: text, reply: r.text, ...(r.cards ? { cards: r.cards } : {}), go: again('progress') };
    } catch {
      return { said: text, reply: 'My brain didn’t answer, so I can’t read your streaks just now: try again in a moment.' };
    }
  }
  const { openLearning } = await import('../features/learning/sheet');
  const lesson = ask.view === 'draw' ? lessonFor(localToday(), ask.shape ?? '') : null;
  void openLearning(ask.view, lesson ? { shape: lesson.id } : {});
  const reply =
    ask.view === 'draw' && lesson ? `Drawing class: ${lesson.title}. ${lesson.tip} The guide is on the canvas: trace it with your finger, then SCORE IT.`
    : ask.view === 'maths' ? 'The maths drill is open: five minutes at your level. Answer each sum and press ENTER; it moves you up after two sets of 90%.'
    : ask.view === 'memory' ? 'The memory page is open: pick a number, a list or names, then START. Look, then cover it and say it back.'
    : ask.view === 'hand' ? 'The writing page is open: write the line on plain paper in dark ink, then photograph it. It is read on this phone and the photo stays here.'
    : ask.view === 'readfast' ? 'The reading page is open: pick a speed and START. You read one word at a time, then answer three questions about it.'
    : ask.view === 'firstaid' ? `The first aid page is open: read the steps, or tap them in order. ${FIRST_AID_LINE}`
    : 'The spelling page is open: I look through your latest messages for the words you often misspell, and say one for you to spell.';
  return { said: text, reply, go: again(ask.view, lesson ? { shape: lesson.id } : {}) };
}

/** The body pack's words: a screen opened here, or a glass of water kept by my brain's own code. */
export async function bodyTurn(text: string): Promise<PackReply> {
  const ask = bodyAsked(text);
  if (!ask) return { said: text, reply: 'I didn’t catch which: say "count my squats", "start a run", "breathe" or "stretch with me".' };
  if (ask.what === 'water') {
    try {
      const r = await brain.packDo('body', 'water', { words: text });
      return { said: text, reply: r.text, ...(r.cards ? { cards: r.cards } : {}) };
    } catch {
      return { said: text, reply: 'My brain didn’t answer, so that glass isn’t kept: try again in a moment.' };
    }
  }
  const { openBody } = await import('../features/body/sheet');
  void openBody(ask.what, ask.what === 'reps' ? { exercise: ask.exercise } : ask.what === 'breathe' ? { pattern: ask.pattern } : {});
  const reply =
    ask.what === 'reps' ? `The camera counts your ${EXERCISES.find((e) => e.id === ask.exercise)!.say} here on the phone and says each one. Prop it up so it sees all of you, then START.`
    : ask.what === 'run' ? 'The running coach is open: START when you set off. Your route stays on this phone; RUN SAVED sends me only the distance, time and splits.'
    : ask.what === 'breathe' ? `${ask.pattern === '478' ? '4-7-8' : 'Box'} breathing is open: follow the circle, four rounds.`
    : 'The stretch set is open: eight stretches, about four and a half minutes. Gently.';
  return { said: text, reply, go: [{ id: 'body', ask: -1, label: 'Open it again', run: 'open_body', args: { what: ask.what, ...(ask.what === 'reps' ? { exercise: ask.exercise } : {}) } }] };
}

/** The kitchen pack's words: timers on this phone's clock, the shopping list opened, the oven line. */
export async function kitchenTurn(text: string): Promise<PackReply> {
  const oven = ovenAsked(text);
  if (oven) return { said: text, reply: oven };
  const k = await import('../features/kitchen/sheet');
  if (shoppingAsked(text)) {
    void k.openKitchen('shopping');
    return { said: text, reply: 'Your shopping list is open: tick things off as you go, or SHARE AS TEXT to send it.' };
  }
  const ask = timerAsked(text);
  const t = await import('../features/kitchen/timers');
  k.exposeKitchen();
  if (!ask || 'list' in ask) {
    const now = t.timersNow();
    return { said: text, reply: now.length ? `Timers: ${now.map((x) => `${x.name} ${x.ringing ? 'ringing' : `${mmss(x.left)} left`}`).join(', ')}.` : 'No timers running.', go: [{ id: 'timers', ask: -1, label: 'Open timers', run: 'open_kitchen', args: { what: 'timers' } }] };
  }
  if ('stop' in ask) {
    const n = t.stopTimers(ask.stop);
    return { said: text, reply: n ? `Stopped ${n === 1 ? (ask.stop ? `the ${ask.stop} timer` : 'the timer') : `${n} timers`}.` : 'No timer by that name.' };
  }
  const made = t.startTimers(ask.start);
  const at = (x: { end: number }) => new Date(x.end - (t.clockNow() - Date.now())).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return {
    said: text,
    reply: `Set: ${made.map((x) => `${x.name} ${mmss(x.secs)} (rings at ${at(x)})`).join(', ')}. A sound and a buzz when ${made.length === 1 ? 'it’s' : 'each is'} done, while Ghosty is open.`,
    go: [{ id: 'timers', ask: -1, label: 'Open timers', run: 'open_kitchen', args: { what: 'timers' } }],
  };
}
