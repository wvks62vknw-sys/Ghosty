/**
 * THE HOUSE'S ROOMS, as one list (BRIEF-SHELL-2; OWNER-ISSUES 143, 155): HOME, SEE, MAKE, LEARN, PLAN, LIFE and ME, each with its
 * things numbered 01, 02, 03 in the Machine's index. This is the one source: THE PLAN (the house unfolded), a room's band and its
 * AT HAND and THE REST, Every screen and the finding test (apps/edge/test/finding.test.mjs) all read it, so a screen added to an
 * area's list is in all of them by itself and no list is kept by hand twice. Pure: no document, no state, so the test can bundle it.
 */
import { AREAS, EDITORS, EDITORS_ID, folds, ME_ROWS } from './areadefs';
import { DECK } from './deckcopy';

export interface Thing {
  /** A screen's id, or 'origin' / 'deck' for the two things under ME that are not screens of their own. */
  id: string;
  /** As he says it ("God’s eye", "Household"). */
  name: string;
  /** The screen it opens (null: it opens something that is not a screen: the origin, Every screen). */
  screen: string | null;
  /** Its number in its room: 1, 2, 3. */
  n: number;
}
export interface Room {
  key: string;
  /** "HOME", "SEE" … as the house writes it. */
  title: string;
  /** The area it is (shell/areadefs.ts). */
  area: string;
  /** What its key in the house opens: Home (the reactor) or the room's hub. */
  screen: string;
  things: Thing[];
}

/** The names the plan says where the deck's name for a screen is not the one he says in a list. */
const SAID: Record<string, string> = { brief: 'The Brief', learn: 'Courses', homeadmin: 'Household', origin: 'The origin', deck: 'Every screen' };
const nice = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);
/** A thing's name: from this list, else the deck's own words (shell/deckcopy.ts), else its id. */
export const thingName = (id: string): string => SAID[id] ?? DECK[id]?.name ?? nice(id);

/** The things of a room: its area's screens in the hub's order; Home is the Brief; ME also holds the origin and Every screen. */
function thingsOf(areaId: string): { id: string; screen: string | null }[] {
  const a = AREAS.find((x) => x.id === areaId)!;
  const screens = a.tabs.filter((t) => t !== 'core').map((id) => ({ id, screen: id as string | null }));
  if (areaId !== 'me') return screens;
  // (the Me sheet's rows that are not screens: FATHER AND THE ORIGIN and Every screen; the hub of Me is the room itself)
  const extra = ME_ROWS.filter((r) => r.id === 'origin' || r.id === 'deck').map((r) => ({ id: r.id, screen: null as string | null }));
  return [...screens, ...extra];
}

export const ROOMS: Room[] = AREAS.map((a) => ({
  key: a.id === 'ask' ? 'home' : a.id,
  title: a.id === 'ask' ? 'HOME' : a.title.toUpperCase(),
  area: a.id,
  screen: a.id === 'ask' ? 'core' : `area-${a.id}`,
  things: thingsOf(a.id).map((t, i) => ({ id: t.id, name: thingName(t.id), screen: t.screen, n: i + 1 })),
}));

/**
 * What a room's hub draws as its band and its cards: the plan's things, with the editors folded under one EDITORS thing where the room holds more
 * than ten (areadefs.ts). THE PLAN itself (and Every screen, the jump bar, "open seven") still numbers every screen: the EDITORS thing keeps the
 * number of the first editor it holds, so a gap in the band's numbers is the editors inside it, never a renumbering.
 */
export function hubThings(room: Room): Thing[] {
  const a = AREAS.find((x) => x.id === room.area)!;
  if (!folds(a)) return room.things;
  const ids = new Set(EDITORS.map((e) => e.id));
  const first = room.things.find((t) => ids.has(t.id))!;
  return room.things.flatMap((t) => (ids.has(t.id) ? (t.id === first.id ? [{ id: EDITORS_ID, name: 'Editors', screen: null, n: t.n }] : []) : [t]));
}

/** Every numbered thing in the house, in order. */
export const THINGS: (Thing & { room: string })[] = ROOMS.flatMap((r) => r.things.map((t) => ({ ...t, room: r.key })));

/** The room a screen (or a thing) belongs to; a screen that sits inside another (THE LOOK, the reader) is its parent's. */
const INSIDE: Record<string, string> = { look: 'settings', reader: 'library', lab: 'workshop' };
export function roomOf(screen: string): Room | undefined {
  const id = INSIDE[screen] ?? screen;
  if (id === 'core') return ROOMS[0];
  return ROOMS.find((r) => r.things.some((t) => t.id === id || t.screen === id) || r.screen === id);
}
/** The thing a screen is, with its number ("04 Radio"). */
export const thingOf = (screen: string): (Thing & { room: string }) | undefined => THINGS.find((t) => t.screen === screen || t.id === screen);

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8 };
/** A number said or typed ("2", "02", "two", "open two", "number 3", "the second one"), or null. Pure. */
export function numberIn(text: string): number | null {
  const t = String(text ?? '').trim().toLowerCase().replace(/[.!?]+$/g, '').replace(/^(?:ok(?:ay)?|please|now)[, ]+/, '');
  const m = /^(?:(?:open|go to|show|take me to|number|no\.?|#)\s+)*(?:number\s+)?(?:the\s+)?(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|first|second|third|fourth|fifth|sixth|seventh|eighth)(?:\s+one)?$/.exec(t);
  if (!m) return null;
  const n = /^\d/.test(m[1]!) ? Number(m[1]) : NUMBER_WORDS[m[1]!];
  return n && n > 0 ? n : null;
}
/** "learn 5", "plan four", "open make 3": a room and a number, or null. */
export function roomNumberIn(text: string): { room: Room; n: number } | null {
  const t = String(text ?? '').trim().toLowerCase().replace(/[.!?]+$/g, '').replace(/^(?:open|go to|show)\s+/, '');
  const m = /^(home|see|make|learn|plan|life|me)\s+(?:number\s+)?(.+)$/.exec(t);
  const n = m ? numberIn(m[2]!) : null;
  const room = m ? ROOMS.find((r) => r.key === m[1]) : undefined;
  return room && n ? { room, n } : null;
}

