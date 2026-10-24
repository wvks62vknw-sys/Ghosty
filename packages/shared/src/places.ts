/**
 * SAVED PLACES, the pure parts shared by the brain and the phone: what a saved place is, the owner's words for
 * one ("home", "the office", "mum and dad's" → a label), and the honest refusal for a reminder that would need
 * to know where he is. Places live in the brain's memory and nowhere else (apps/edge/src/places.ts).
 */

/** A place the owner named: home, work, school, gym, his parents', or any name he gives. */
export interface SavedPlace {
  /** 'home', 'work', 'school', 'gym', 'parents' or a custom name in lower case. */
  id: string;
  /** How it reads: "Home", "Parents'", "Nan's". */
  label: string;
  /** What he typed: "12 Acacia Avenue, B13". */
  query: string;
  /** What the map found, which he said yes to. */
  address: string;
  lat: number;
  lon: number;
  at: number;
}

/** What the geocoder found, shown for a yes before it is kept. */
export interface PlaceCandidate {
  id: string;
  label: string;
  query: string;
  address: string;
  lat: number;
  lon: number;
}

export const NAMED_PLACES: { id: string; label: string; words: RegExp }[] = [
  { id: 'home', label: 'Home', words: /^(?:home|(?:my |our )(?:home|house|place|flat))$/ },
  { id: 'work', label: 'Work', words: /^(?:my |the )?(?:work|office|job|workplace|work place)$/ },
  { id: 'school', label: 'School', words: /^(?:my |the |the kids'? |kids'? |our )?school$/ },
  { id: 'gym', label: 'Gym', words: /^(?:my |the )?gym$/ },
  { id: 'parents', label: "Parents'", words: /^(?:my |the )?(?:parents'?s?|mum and dad'?s?|mom and dad'?s?|mum'?s|mom'?s|dad'?s|folks'?)(?: (?:house|place|home))?$/ },
];

const clean = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** The owner's words for a place → its id and how it reads ("the office" → work; "Nan's" → a place of his own called "Nan's"). '' when there are no words. */
export function placeLabel(words: string): { id: string; label: string } | null {
  const w = clean(words).replace(/^(?:to|at|from) /, '');
  if (!w) return null;
  for (const p of NAMED_PLACES) if (p.words.test(w)) return { id: p.id, label: p.label };
  const label = words.trim().replace(/\s+/g, ' ').slice(0, 40);
  return { id: w.replace(/^(?:my|the) /, '').slice(0, 40), label: label.charAt(0).toUpperCase() + label.slice(1) };
}

/**
 * The saved place the words mean, if any: "home", "my home", "work", "the office", "mum's", or the name of one he
 * saved ("Nan's"). Words that are an address or a stop are not a saved place (null), so they go to the map as before.
 */
export function matchPlace(words: string, places: SavedPlace[]): SavedPlace | null {
  if (!places.length) return null;
  const w = clean(words).replace(/^(?:to|at|from|near) /, '');
  if (!w) return null;
  for (const p of NAMED_PLACES) if (p.words.test(w)) return places.find((x) => x.id === p.id) ?? null;
  const bare = w.replace(/^(?:my|the) /, '');
  return places.find((x) => x.id === bare || clean(x.label) === w) ?? null;
}

/** Is this one of the named kinds (home, work…) — words that mean a saved place even before one is saved. */
export const isNamedPlace = (words: string) => NAMED_PLACES.some((p) => p.words.test(clean(words).replace(/^(?:to|at|from|near) /, '')));

/** "Remind me when I'm near Tesco", "when I get home": a reminder by where he is. */
export const NEAR_ASK = /\b(?:when|whenever|once|as soon as|next time)\s+(?:i'?m|i am|i get|i arrive|i reach|i pass|i walk|i drive|i leave|we'?re|we get)\b[^.?!]*\b(?:near|by|at|to|in|home|work|past|leave|there)\b|\bnear (?:me|tesco|the shop|the shops)\b.*\bremind/i;

/** The honest answer to one. */
export const NO_TRACKING =
  "I can't remind you by where you are: Ghosty never tracks your location, so he can't tell when you're near somewhere. I can remind you at a time instead — say when.";
