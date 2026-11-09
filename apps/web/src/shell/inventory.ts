/**
 * THE INVENTORY (BRIEF-SHELL-2): what the house, a room, Every screen and the jump bar say about a thing, read from what this phone
 * already holds and never fetched here. One true line for each (its live line, else its card's two readings, else its card's own
 * words), whether it is IN THE WORKS, whether it is recent or starred; and what a number means where he types or says one.
 * The list of things is shell/rooms.ts; the screens' own cards are shell/hubcards.ts.
 */
import { tabs } from './tabs';
import { CARDS } from './hubcards';
import { THINGS, ROOMS, roomOf, thingOf, numberIn, roomNumberIn, type Room } from './rooms';
import { DECK } from './deckcopy';
import { favourites } from './favourites';
import { recentTabs } from './areas';

/** One thing's card readings that the phone has (a value it has not got is left out: never "Not yet" in a list). */
export function readings(id: string): { label: string; value: string }[] {
  const t = tabs().find((x) => x.id === id);
  const c = CARDS[id];
  try {
    const rs = (t?.readouts ?? c?.readouts)?.() ?? [];
    return rs.filter((r) => r.value != null).slice(0, 2).map((r) => ({ label: r.label, value: r.unit ? `${r.value} ${r.unit}` : (r.value as string) }));
  } catch {
    return [];
  }
}

/** The one true line about a thing: its live line, else what its two readings say, else its card's own words, else the deck's promise. */
export function thingLine(id: string): string {
  const t = tabs().find((x) => x.id === id);
  if (id === 'origin') return 'Who made me, and when';
  if (id === 'deck') return 'All of Ghosty at once';
  try {
    const now = t?.now?.() ?? '';
    if (now) return now;
  } catch {
    /* a line that could not be read is not said */
  }
  const rs = readings(id);
  if (rs.length) return rs.map((r) => `${r.label.charAt(0)}${r.label.slice(1).toLowerCase()} ${r.value}`).join(' · ');
  const c = CARDS[id];
  const w = c ? (typeof c.title === 'function' ? c.title() : c.title) : '';
  return w || DECK[id]?.promise || t?.blurb || '';
}

/** What on it is still a stand-in, in one plain line (shell/hubcards.ts `works`): '' when it is the real thing. */
export const worksLine = (id: string): string => CARDS[id]?.works ?? '';

/** Recent (the last screens opened, not pinned) and starred (pinned), by id. */
export const recentIds = (): string[] => recentTabs().filter((id) => !!thingOf(id) && !favourites().includes(id));
export const starredIds = (): string[] => favourites().filter((id) => !!thingOf(id));

/** A room's things that are at hand: his recents (newest first) then his starred, at most four. */
export function atHand(room: Room): { id: string; why: 'recent' | 'starred' }[] {
  const mine = new Set(room.things.map((t) => t.id));
  const out = [...recentIds().filter((id) => mine.has(id)).slice(0, 3).map((id) => ({ id, why: 'recent' as const })), ...starredIds().filter((id) => mine.has(id)).map((id) => ({ id, why: 'starred' as const }))];
  return out.slice(0, 4);
}

/**
 * What a number means where he is: in a room, that room's thing; anywhere else his FAVOURITES first, then his recents (the lists at the
 * top of Every screen and the jump bar). A room and a number ("learn 5") means that room's thing, anywhere. null: not a number, or none there.
 */
export function thingForNumber(text: string, here: string): { id: string; screen: string | null } | null {
  const rn = roomNumberIn(text);
  if (rn) return rn.room.things[rn.n - 1] ?? null;
  const n = numberIn(text);
  if (!n) return null;
  const room = here.startsWith('area-') ? ROOMS.find((r) => r.screen === here) : undefined;
  if (room) return room.things[n - 1] ?? null;
  const list = [...starredIds(), ...recentIds()];
  const id = list[n - 1];
  const t = id ? thingOf(id) : undefined;
  return t ? { id: t.id, screen: t.screen } : null;
}

/** The room a thing is in, for "In Plan · …" (its title in his words). */
export const roomWord = (id: string): string => {
  const r = roomOf(id);
  return r ? r.title.charAt(0) + r.title.slice(1).toLowerCase() : '';
};
export { THINGS, ROOMS, numberIn, roomNumberIn };
