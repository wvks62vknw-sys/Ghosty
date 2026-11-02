/**
 * [tabs] A hub card's reading as one line (BRIEF-TABS 2): the screens the sheets became show their card's first reading at the
 * top (ui/sheetpage.ts) and as their live line in Every screen (TabDef.now), so the screen, its card and the deck say the same
 * thing from the same state (shell/hubcards.ts CARDS). Nothing is fetched here but the card's own light read, when its screen
 * comes on; a reading the phone has not got is said as the card says it ("Not yet", "None yet").
 */
import type { Readout } from './hubcards';
import { ui } from '../state/app';

let cards: typeof import('./hubcards') | null = null;
// (taken once the app's modules are all up — the cards are part of the first load already — so the deck's lines read them too)
void import('./hubcards').then((m) => (cards = m)).catch(() => undefined);

const said = (r: Readout) => `${r.value}${r.unit ? ` ${r.unit}` : ''}`;
/** The cards whose read has been made (and finished) since this screen came on: a card still without a reading after it was
 * not answered (its read fails quietly, hubcards.ts `every`). */
const tried = new Set<string>();

/**
 * The top of the card's screen: its reading as a person says it (HubCard.say: "Recycling tomorrow", "No timers running"), and
 * while it has none, what is happening: reading it; offline (the signal down, so my brain cannot be reached); or read and not
 * answered (my brain down or slow), said plainly rather than left on "Reading…".
 */
export function cardBig(id: string): string {
  const c = cards?.CARDS[id];
  const said = c?.say?.() ?? '';
  if (said) return said;
  if (c?.idle) return c.idle;
  if (ui.get().connected === false) return 'Offline: this needs my brain, and I can’t reach it right now';
  if (tried.has(id)) return 'My brain didn’t answer, so I can’t read this just now';
  return 'Reading…';
}

/** Its reading as a line for the deck's live line ('' while there is none: the deck shows nothing then). */
export function cardNow(id: string): string {
  const c = cards?.CARDS[id];
  if (c?.say) return c.say();
  const r = c?.readouts().find((x) => x.value != null);
  return r ? `${r.label} ${said(r)}` : '';
}

/** The card's own light read (throttled inside the card), made when its screen comes on. */
export async function cardLoad(id: string): Promise<void> {
  cards ??= await import('./hubcards');
  await cards.CARDS[id]?.load?.();
  tried.add(id);
}
