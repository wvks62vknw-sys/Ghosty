/**
 * A GUIDED TOUR OF THE HOUSE (NEXT-ROUND consistency.u4): "show me around" walks the seven rooms in about half a minute, a room
 * every few seconds, with one line on each and one thing to try there (the room's first screen's first YOU CAN line, from the deck),
 * then back to Home. For him or a friend he shows Ghosty to; the reply keeps a key into each room, and any new word of his stops it.
 * On the phone, with no model.
 */
import { AREAS } from '../shell/areadefs';
import { ROOMS } from '../shell/rooms';
import { DECK } from '../shell/deckcopy';
import { answer } from './local';

type Opts = { voice?: boolean; private?: boolean };

export const TOUR_ASKED = /^(?:hey |ok |okay )?(?:ghosty,? )?(?:(?:can you |please )?(?:show me around|give me (?:a|the) tour|take me on (?:a|the) tour|walk me (?:round|around|through) (?:the (?:app|house)|ghosty|everything))|(?:a |the )?(?:guided )?tour(?: of the (?:house|app))?)[\s.!?]*$/i;

/** How long each room stays on screen. */
export const ROOM_MS = 3500;
/** For the spec: the rooms the tour has shown, in order, and whether it ran to its end. */
export const tourState = { shown: [] as string[], done: false, stopped: false };
let run = 0;

/** One line per room: its name, what it is for, and one thing to try there. */
export function tourLines(): { room: string; screen: string; line: string; tryLine: string }[] {
  return ROOMS.map((r) => {
    const a = AREAS.find((x) => x.id === r.area)!;
    const first = a.tabs.find((t) => DECK[t]?.can.length) ?? a.tabs[0]!;
    const can = DECK[first]?.can[0]?.text.replace(/[“”]/g, '') ?? '';
    return { room: r.title, screen: r.screen, line: a.sub, tryLine: can ? `Try: ${can} (${DECK[first]!.name}).` : '' };
  });
}

/** A new word of his ends the tour where it is (session.ts calls this before anything reads his words). */
export function stopTour(): void {
  if (tourState.done || !tourState.shown.length) return;
  run++;
  tourState.stopped = true;
}

export async function tourTurn(text: string, opts: Opts = {}): Promise<boolean> {
  if (!TOUR_ASKED.test(text.trim())) return false;
  const lines = tourLines();
  const reply = `The house, room by room: ${lines.length} rooms, a few seconds each, then back to Home. Say anything to stop.\n${lines.map((l, i) => `${i + 1}. ${l.room.charAt(0)}${l.room.slice(1).toLowerCase()}: ${l.line} ${l.tryLine}`.trim()).join('\n')}`;
  answer(text, reply, { kind: 'can', go: lines.map((l) => ({ id: `tour:${l.screen}`, ask: -1, label: `${l.room.charAt(0)}${l.room.slice(1).toLowerCase()}`, open: l.screen })) }, opts);
  const me = ++run;
  Object.assign(tourState, { shown: [], done: false, stopped: false });
  // (the walk goes on by itself: the chat is free at once, and any new word of his stops it)
  void (async () => {
    const { perform } = await import('../shell/launcher');
    // (Home first is where he is already: the walk starts at the first room after it, and ends at Home)
    for (const l of lines.slice(1)) {
      await new Promise((r) => setTimeout(r, ROOM_MS));
      if (me !== run) return;
      perform({ open: l.screen });
      tourState.shown.push(l.screen);
    }
    await new Promise((r) => setTimeout(r, ROOM_MS));
    if (me !== run) return;
    perform({ open: 'core' });
    tourState.done = true;
  })();
  return true;
}

const w = globalThis as unknown as { __ghosty?: Record<string, unknown> };
const attach = (n = 0): unknown => (w.__ghosty ? (w.__ghosty.tour = tourState) : n < 150 && setTimeout(() => attach(n + 1), 100));
attach();
