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
