/**
 * [tabs] A hub card's reading as one line (BRIEF-TABS 2): the screens the sheets became show their card's first reading at the
 * top (ui/sheetpage.ts) and as their live line in Every screen (TabDef.now), so the screen, its card and the deck say the same
 * thing from the same state (shell/hubcards.ts CARDS). Nothing is fetched here but the card's own light read, when its screen
 * comes on; a reading the phone has not got is said as the card says it ("Not yet", "None yet").
 */
import type { Readout } from './hubcards';

let cards: typeof import('./hubcards') | null = null;
// (taken once the app's modules are all up — the cards are part of the first load already — so the deck's lines read them too)
void import('./hubcards').then((m) => (cards = m)).catch(() => undefined);

const said = (r: Readout) => `${r.value}${r.unit ? ` ${r.unit}` : ''}`;

/** The card's first reading for its screen's top: "Due soon · 3", "Timers · None". */
export function cardBig(id: string): string {
  const r = cards?.CARDS[id]?.readouts()[0];
  return r ? `${r.label} · ${r.value != null ? said(r) : r.none ?? 'Not yet'}` : '';
}

/** The card's first reading the phone has, for the deck's live line ('' when it has none yet: the deck shows nothing). */
export function cardNow(id: string): string {
  const r = cards?.CARDS[id]?.readouts().find((x) => x.value != null);
  return r ? `${r.label} ${said(r)}` : '';
}

/** The card's own light read (throttled inside the card), made when its screen comes on. */
export async function cardLoad(id: string): Promise<void> {
  cards ??= await import('./hubcards');
  await cards.CARDS[id]?.load?.();
}
