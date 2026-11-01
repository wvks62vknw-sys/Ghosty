/**
 * HE BRINGS THINGS UP HIMSELF — THE TRIGGER TABLE (BRIEF-SIDEWAYS item 2; OWNER-ISSUES 91b "i want it to be there"): what
 * in his words plainly calls for a card, in code, with no model. Pure: the phone's acting half is features/core/cards.ts
 * (`bringUp`), the camera's is the Lens's READ, the day's is the brain's speak-first job (apps/edge/src/speak.ts).
 *
 *   a UK plate, in any spacing          → the CAR card offer ("That's a plate. Want the car?"); a plate he named: the card at once
 *   "my dad's car is RX15 KNG"          → kept as a car fact in his memory (whose, plate, nickname); the PERSON card shows it
 *   a postcode                          → the MAP offer (the brain's postcode tool draws it, by code)
 *   a saved place's name                → MAP
 *   the name of a person he introduced  → PERSON (only what GUARDIAN already shows; never anyone else)
 *   "tomorrow", a weekday, a time       → the diary piece for that day
 *   a YouTube link, a receipt, a worry  → the offers of batch 4 (abilities/offer.ts, with their own rules: once ever, one a day)
 *
 * A stranger's name, a random word, a dateless "A1" or "M6", a time with no day: nothing.
 */
import { carSaid, platesIn, type NamedCar } from '../../../../packages/shared/src/cards';
import { normalisePlate } from '../../../../packages/shared/src/plates';
import type { SavedPlace } from '../../../../packages/shared/src/places';

/** What the phone knows to match against: his saved places, the people he introduced, the cars he named. */
export interface Known {
  places: Pick<SavedPlace, 'id' | 'label' | 'address' | 'lat' | 'lon'>[];
  /** The guardian's named person and the people whose cars he named ("Dad", "Haris"). */
  people: string[];
  cars: NamedCar[];
}

export type Hit =
  | { row: 'car'; car: NamedCar }
  | { row: 'plate'; plate: string; named?: NamedCar; bare: boolean }
  | { row: 'postcode'; postcode: string }
  | { row: 'place'; place: Known['places'][number] }
  | { row: 'person'; name: string }
  | { row: 'day'; label: string; offset: number }
  | { row: 'offers' };

/** The table as data: each row, what it answers, an example he could say (the catalogue and the docs read it). */
export const TRIGGERS: { row: Hit['row']; does: string; example: string }[] = [
  { row: 'car', does: 'keeps a car you name as yours or a person’s you introduced, and shows it under them', example: 'my dad’s car is RX15 KNG' },
  { row: 'plate', does: 'offers the car: make, colour, MOT and tax from the public record', example: 'AB12 CDE' },
  { row: 'postcode', does: 'offers the postcode on the map', example: 'B13 9AB' },
  { row: 'place', does: 'shows a saved place on the map', example: 'how far is Nan’s?' },
  { row: 'person', does: 'shows a person you introduced: what the guardian knows, their car', example: 'is Dad around?' },
  { row: 'day', does: 'shows your diary for that day', example: 'what’s on tomorrow?' },
  { row: 'offers', does: 'a YouTube link, a receipt or a worry: the one-line offers', example: 'I’m worried about my exam' },
];

const POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s?(\d[A-Z]{2})\b/i;
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const TIME = /\b(?:(?:[01]?\d|2[0-3])[:.][0-5]\d|(?:1[0-2]|0?[1-9])\s?(?:am|pm)|(?:at|by|for|from|until|till)\s+(?:1[0-2]|[1-9])(?:\s?o'?clock)?)\b/i;
/** Names that are everyday words too: only with a capital letter. */
const COMMON = new Set(['will', 'may', 'mark', 'bill', 'pat', 'rob', 'grace', 'hope', 'joy', 'june', 'april', 'august', 'rose', 'jack', 'frank', 'sue', 'ray', 'dawn', 'faith', 'summer', 'sky', 'rich', 'art', 'max', 'sunny', 'page', 'bob', 'chance', 'guy', 'don']);
/** Relations that are everyday words: only as "my mate", "my boss". */
const LOOSE = new Set(['mate', 'friend', 'boss', 'partner', 'son']);
/** Words before "home" or "work" that make it the place, not the word. */
const CUE = /\b(?:to|at|from|near|leave|leaving|left|reach|me|get|got|getting|back|going|go|head|heading|walk|walking|drive|driving|way)\s+(?:the\s+)?$/i;

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Whole word, in any case (or as written, for an everyday word). */
function said(text: string, word: string, exact: boolean): RegExpExecArray | null {
  return new RegExp(`(?<![\\w'])${esc(word).replace(/'/g, "['’]")}(?![\\w])`, exact ? '' : 'i').exec(text);
}

/** "Saturday" → days from today (0 today … 6), on the phone's clock. */
function dayOffset(word: string, now: number): number {
  const want = WEEKDAYS.indexOf(word.toLowerCase());
  return (want - new Date(now).getDay() + 7) % 7;
}

/**
 * Everything in one message the table answers, in its order. A car he names is the whole message (nothing else is
 * looked for); the offers row is always last, for abilities/offer.ts to decide.
 */
export function triggersIn(text: string, known: Known, now = Date.now()): Hit[] {
  const t = String(text ?? '').replace(/[‘’]/g, "'").trim();
  if (!t) return [];
  const people = [...new Set([...known.people, ...known.cars.filter((c) => c.whose !== 'me').map((c) => c.whose)])].filter(Boolean);
  const car = carSaid(t, people.map((p) => p.toLowerCase()));
  if (car) return [{ row: 'car', car }];
  const hits: Hit[] = [];
  const plates = platesIn(t);
  for (const p of plates) {
    const named = known.cars.find((c) => normalisePlate(c.plate) === p);
    const bare = normalisePlate(t.replace(/[?!.]+$/, '')) === p && /^[\sA-Za-z0-9?!.]+$/.test(t);
    hits.push({ row: 'plate', plate: p, ...(named ? { named } : {}), bare });
  }
  const pc = POSTCODE.exec(t);
  // (a plate can look like half a postcode: never both)
  if (pc && !plates.length) hits.push({ row: 'postcode', postcode: `${pc[1]!.toUpperCase()} ${pc[2]!.toUpperCase()}` });
  for (const place of known.places) {
    const m = said(t, place.label, false);
    if (!m) continue;
    if (/^(home|work)$/i.test(place.label) && !CUE.test(t.slice(0, m.index))) continue;
    hits.push({ row: 'place', place });
  }
  for (const name of people) {
    const low = name.toLowerCase();
    const exact = COMMON.has(low);
    const m = said(t, name, exact);
    if (!m) continue;
    if (LOOSE.has(low) && !/\bmy\s+$/i.test(t.slice(0, m.index))) continue;
    hits.push({ row: 'person', name });
  }
  // (a relation he has not introduced is nobody yet: "my dad" with no car and no guardian entry gives nothing)
  const day = /\btomorrow\b/i.test(t) ? { label: 'Tomorrow', offset: 1 } : /\b(?:today|tonight|this (?:morning|afternoon|evening))\b/i.test(t) ? { label: 'Today', offset: 0 } : null;
  const wd = new RegExp(`\\b(${WEEKDAYS.join('|')})\\b`, 'i').exec(t);
  if (day) hits.push({ row: 'day', ...day });
  else if (wd) {
    const offset = dayOffset(wd[1]!, now);
    hits.push({ row: 'day', label: offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : wd[1]!.charAt(0).toUpperCase() + wd[1]!.slice(1).toLowerCase(), offset });
  } else if (TIME.test(t)) hits.push({ row: 'day', label: 'Today', offset: 0 });
  hits.push({ row: 'offers' });
  return hits;
}
