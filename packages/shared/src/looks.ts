/**
 * THE SEVEN LOOKS (BRIEF-THEME-GALLERY; OWNER-ISSUES 155, 157): each an entirely different whole HUD, the colour the only choice
 * under it. Four are built (The Scan, The Map, One Ink and Glass: a tap applies that world); three are coming (a tap says so and changes nothing).
 * The words are the round-two mock's (docs/build-plan/mockups/hud/2026-11-08-2/theme.html). Pure: no DOM, no state.
 */
import { COLOUR_KEYS, type ColourKey, type WorldKey } from './themes';

export type LookKey = 'scan' | 'map' | 'eye' | 'orbit' | 'ink' | 'grown' | 'glass';

export interface LookDef {
  key: LookKey;
  /** As written ("The Scan"); the page sets it in the system's tag capitals. */
  name: string;
  /** Its one line under the name, and in the toast of a look that is coming. */
  line: string;
  /** The recipe's world a tap applies, or null where the look is not built yet. */
  world: WorldKey | null;
  built: boolean;
  /** The still of its Home under apps/web/public/looks/. */
  still: string;
}

/** In the page's order: two rows of three, then one. */
export const LOOKS: LookDef[] = [
  { key: 'scan', name: 'The Scan', line: 'The world, sampled as points', world: 'scan', built: true, still: 'looks/scan.webp' },
  { key: 'map', name: 'The Map', line: 'The field, from above', world: 'map', built: true, still: 'looks/map.webp' },
  { key: 'eye', name: 'The Eye', line: 'Attention is the material', world: null, built: false, still: 'looks/eye.webp' },
  { key: 'orbit', name: 'Orbit', line: 'Mind is the way in', world: null, built: false, still: 'looks/orbit.webp' },
  { key: 'ink', name: 'One Ink', line: 'A printed page', world: 'ink', built: true, still: 'looks/ink.webp' },
  { key: 'grown', name: 'Grown Up', line: 'Today, with less on it', world: null, built: false, still: 'looks/grown.webp' },
  { key: 'glass', name: 'Glass', line: 'Today’s look', world: 'glass', built: true, still: 'looks/glass.webp' },
];

export const lookOf = (k: string): LookDef | undefined => LOOKS.find((l) => l.key === k);

/** The look a recipe's world is, for the card marked as the one he is in (the Eye world is reached from THE LOOK). */
export function lookOfWorld(w: WorldKey): LookDef {
  const key: LookKey = w === 'ink' ? 'ink' : w;
  return lookOf(key)!;
}

/** What a look that is not built says, once, when it is tapped or asked for. */
export const comingLine = (l: LookDef): string => `${l.name} is coming: ${l.line}`;

export const GALLERY_COUNT = '7 · each a whole HUD';
export const ASK_LINE = 'Say a look, or a colour';

export type LooksAsked = { kind: 'coming'; look: LookDef } | { kind: 'world'; look: LookDef } | { kind: 'gallery' } | { kind: 'colour'; colour: ColourKey };

const WORDS: [RegExp, LookKey][] = [
  [/^(?:the )?eye$/, 'eye'],
  [/^orbit$/, 'orbit'],
  [/^grown[ -]?up$/, 'grown'],
];

/**
 * His words about the looks: "one ink" and "the map" (built: each switches to it); "switch to the eye", "orbit",
 * "grown up" (each answers with the card's one line and changes nothing); "show me the looks". Only clear asks: "the eye of the
 * storm" and "what is the map of London" are never taken.
 */
export function looksAsked(text: string): LooksAsked | null {
  let t = text.toLowerCase().replace(/[’']/g, "'").replace(/[.!?,]+$/g, '').replace(/\s+/g, ' ').trim();
  if (!t || t.length > 60) return null;
  for (let i = 0; i < 3; i++) t = t.replace(/^(?:hey |ok |okay |ghosty,? |please |can you |could you |i want |i'd like |let's |lets |give me )+/, '').replace(/(?: please| thanks)+$/, '').trim();
  if (/^(?:show me|let me see|open|see) (?:all )?(?:the |of the )?(?:looks|looks page|looks gallery|themes|theme page|gallery)$/.test(t)) return { kind: 'gallery' };
  // ("open the map" and "show me the map" are the map screen's words, not the look's: the map look is taken bare, or with a verb that changes a look)
  const opens = /^(?:show me |open |see )/.test(t);
  const noun = / (?:look|theme|world)$/.test(t);
  t = t.replace(/^(?:switch(?: it)? to |change(?: it)? to |go to |set it to |use |try |show me |back to |open |make it )/, '').replace(/ (?:look|theme|world)$/, '').trim();
  // ONE INK is built: its words switch to it (the colour stays his), where the looks still coming say their line and change nothing
  if (/^one ink$/.test(t)) return { kind: 'world', look: lookOf('ink')! };
  if (/^(?:the )?map$/.test(t) && (!opens || noun)) return { kind: 'world', look: lookOf('map')! };
  if (/^(?:the )?map$/.test(t)) return null;
  for (const [re, key] of WORDS) if (re.test(t)) return { kind: 'coming', look: lookOf(key)! };
  // the page asks "Say a look, or a colour": a colour's bare name is that colour ("ember"); with a verb or its noun, the look table already takes it
  const c = /^([a-z]+)(?: (?:colour|color|theme))?$/.exec(t.replace(/^the /, ''));
  if (c && (COLOUR_KEYS as readonly string[]).includes(c[1]!)) return { kind: 'colour', colour: c[1] as ColourKey };
  return null;
}
