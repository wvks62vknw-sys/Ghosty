/**
 * DESIGN MY HOME, the brain side (OWNER-ISSUES 7): `design_home` turns the owner's plain words —
 * "a flat with a 4 by 3.5 m living room, the kitchen off it to the right, two bedrooms and a
 * bathroom off the hall" — into a floor plan the SPACE PLANNER imports as it is and the 3D STUDIO
 * builds: Room JSON v2 (packages/shared/src/design.ts), one plan per storey.
 *
 * No AI here: the words are read by code (sizes in any unit, rooms and where they sit, doors,
 * windows, ceilings, furniture with UK sizes and where it goes) and the plan is worked out by code
 * (rooms packed as rectangles, or an L when said, on a grid in cm with shared walls; a hall joining
 * the rooms off it; doors on the shared walls; windows on outside walls; furniture against the
 * walls the words name, kept out of door swings and doorways, gaps under the 70 cm walkway
 * flagged). The reply says in plain words what was drawn, every size that was assumed and what
 * could not be done, then the plan itself; the model only puts that into words. A question about
 * a plan the owner already has goes to design_review instead.
 *
 * Measurements are kept exact in cm (10 ft 6 in is 320.04 cm) and shown in the owner's unit.
 * Nothing here says a plan meets planning or building rules.
 */
import { DEFAULTS, LIMITS, areaText, bounds, doorSwing, edgeOf, inSwing, lPoly, openingProblem, openingSpan, outsideWalls, polyArea, polysOverlap, rectInPoly, rectPoly, sharedWalls, type Opening, type PlanItem, type Pt, type Rect, type RoomShape, type WallSpan } from '../../../../packages/shared/src/design';
import { resultBudget } from '../context';
import { designTools } from './design';
import { arg, type Tool } from './types';

// ------------------------------------------------------------------ sizes in any unit

export type UnitSystem = 'metric' | 'imperial';
export type Unit = 'mm' | 'cm' | 'm' | 'in' | 'ft' | 'yd';
const CM_PER: Record<Unit, number> = { mm: 0.1, cm: 1, m: 100, in: 2.54, ft: 30.48, yd: 91.44 };
const IMPERIAL = new Set<Unit>(['in', 'ft', 'yd']);

function unitOf(u: string): Unit | null {
  if (/^(?:mm|millimet(?:re|er)s?)$/.test(u)) return 'mm';
  if (/^(?:cms?|centimet(?:re|er)s?)$/.test(u)) return 'cm';
  if (/^(?:m|mtrs?|met(?:re|er)s?)$/.test(u)) return 'm';
  if (/^(?:ft|foot|feet|')$/.test(u)) return 'ft';
  if (/^(?:in|inch|inches|")$/.test(u)) return 'in';
  if (/^(?:yds?|yards?)$/.test(u)) return 'yd';
  return null;
}

const SMALL: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

/**
 * The owner's words made easy to read, keeping every character's place meaningful: lower case,
 * "×" as x, curly quotes straight, numbers in words as digits ("four and a half" → 4.5, "half a
 * metre" → 0.5 metre), "m²"/"sq ft" as sqm/sqft, "3,6 m" as 3.6 m.
 */
export function normalise(text: string): string {
  let s = ` ${String(text ?? '')} `
    .toLowerCase()
    .replace(/[×✕✖]/g, ' x ')
    .replace(/[′’‘`´]/g, "'")
    .replace(/[″”“]/g, '"')
    .replace(/''/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ');
  s = s.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[ -](one|two|three|four|five|six|seven|eight|nine)\b/g, (_, t: string, u: string) => String(TENS[t]! + SMALL[u]!));
  s = s.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/g, (w) => String(SMALL[w] ?? TENS[w]));
  s = s.replace(/\ba (met(?:re|er)|foot|yard) and a half\b/g, (_, u: string) => `1.5 ${u === 'foot' ? 'feet' : `${u}s`}`);
  s = s.replace(/\b(\d+) and a half\b/g, (_, n: string) => `${n}.5`);
  s = s.replace(/\b(\d+) and a quarter\b/g, (_, n: string) => `${n}.25`);
  s = s.replace(/\bhalf an? (?=met|foot|feet|yard|inch)/g, '0.5 ');
  s = s.replace(/\ba (met(?:re|er)|yard)\b/g, '1 $1');
  s = s.replace(/\ba (?:couple|pair) of\b/g, '2');
  s = s.replace(/(\d),(\d{3})(?!\d)/g, '$1$2').replace(/(\d),(\d{1,2})(?=\s*(?:m|cm|met)\b)/g, '$1.$2');
  s = s.replace(/(\d)\s*(?:m²|m\^2|m2\b|sq\.? ?m\b|sq\.? ?met(?:re|er)s?\b|square met(?:re|er)s?\b)/g, '$1 sqm');
  s = s.replace(/(\d)\s*(?:ft²|ft\^2|ft2\b|sq\.? ?f(?:ee)?t\b|square f(?:ee|oo)t\b)/g, '$1 sqft');
  return s.replace(/\s+/g, ' ');
}

/** One number in the words, with its unit when it has one (cm, or cm² for an area). */
interface Tok {
  start: number;
  end: number;
  v: number;
  unit: Unit | null;
  cm: number;
  approx: boolean;
  area: boolean;
}

const UNIT_AT = /^(\s*)(millimet(?:re|er)s?|mm|centimet(?:re|er)s?|cms?|met(?:re|er)s?|mtrs?|m|feet|foot|ft|inch(?:es)?|in|yards?|yds?|'|")(?![a-z])/;
const APPROX_BEFORE = /(?:about|around|roughly|approximately|approx\.?|circa|nearly|almost|just (?:under|over)|maybe|perhaps|probably|~|give or take|say)\s*$/;

function tokens(s: string): Tok[] {
  const out: Tok[] = [];
  const re = /(?<![\d.])\d+(?:\.\d+)?(?!\d)/g;
  const ish = (at: number) => s.slice(at).match(/^\s*-?\s*ish\b/)?.[0].length ?? 0;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    const v = parseFloat(m[0]);
    let end = m.index + m[0].length;
    let approx = APPROX_BEFORE.test(s.slice(Math.max(0, m.index - 26), m.index));
    let k = ish(end);
    if (k) {
      approx = true;
      end += k;
    }
    let unit: Unit | null = null;
    let cm = NaN;
    let area = false;
    const ar = s.slice(end).match(/^\s*(sqm|sqft)\b/);
    if (ar) {
      unit = ar[1] === 'sqm' ? 'm' : 'ft';
      area = true;
      cm = v * CM_PER[unit] ** 2;
      end += ar[0].length;
    } else {
      const um = s.slice(end).match(UNIT_AT);
      if (um) {
        const after = s.slice(end + um[0].length);
        // "in" after a space is a unit only where a size ends ("6 in", "6 in by…"), never "2 in the kitchen"
        const ok = um[2] !== 'in' || um[1] === '' || /^\s*(?:$|[,.;:)!?/-]|x\b|by\b|wide|long|deep|high|tall|and\b|or\b|square)/.test(after);
        if (ok) {
          unit = unitOf(um[2]!);
          end += um[0].length;
          cm = v * CM_PER[unit!];
        }
      }
      if (unit === 'ft') {
        const rest = s.slice(end);
        const inch = rest.match(/^\s*(?:and\s*)?(\d+(?:\.\d+)?)\s*(?:inch(?:es)?|ins?|")(?![a-z])/) ?? rest.match(/^\s*(\d{1,2})(?![\d.])(?!\s*(?:x\b|by\b|to\b|or\b|-|ft|feet|foot|'|met|m\b|cm|mm|yards?|yds?|sqm|sqft|seat|bed|door|window|ish))/);
        if (inch && parseFloat(inch[1]!) < 12) {
          cm = v * CM_PER.ft + parseFloat(inch[1]!) * CM_PER.in;
          end += inch[0].length;
        }
      } else if (unit === 'm') {
        const rest = s.slice(end);
        const c = rest.match(/^\s*(\d{1,2})\s*(?:cms?|centimet(?:re|er)s?)(?![a-z])/) ?? rest.match(/^(\d{2})(?![\d.a-z])/);
        if (c) {
          cm = v * 100 + parseFloat(c[1]!);
          end += c[0].length;
        }
      }
      k = ish(end);
      if (k) {
        approx = true;
        end += k;
      }
    }
    const orSo = s.slice(end).match(/^\s*or so\b/);
    if (orSo) {
      approx = true;
      end += orSo[0].length;
    }
    // exact to a tenth of a millimetre: 2.2 m is 220 cm, not 220.00000000000003
    out.push({ start: m.index, end, v, unit, cm: Math.round(cm * 1000) / 1000, approx, area });
    re.lastIndex = end;
  }
  return out;
}

/** A size read from the words: w (and d, h), all in cm; an area in cm². */
export interface Dim {
  start: number;
  end: number;
  text: string;
  w: number;
  d?: number;
  h?: number;
  area?: number;
  /** One size with a word saying which way: wide, deep, high, or long (the longer side). */
  side?: 'w' | 'd' | 'h' | 'long';
  square?: boolean;
  approx: boolean;
  /** "3 to 3.5 m": the two ends (cm); w is the middle. */
  range?: [number, number];
  unit: Unit;
  /** No unit was given: `unit` is the likely one. */
  guessed: boolean;
}

interface Part {
  start: number;
  end: number;
  lo: Tok;
  hi?: Tok;
}

const SIDE_AFTER = /^\s*(?:or so\s*)?(wide|width|across|long|length|deep|depth|high|tall|height|in (?:width|length|depth|height))\b/;
const SIDE_BEFORE = /\b(width|depth|length|height)(?: of| is| =|:)?\s*(?:about |around |roughly |approximately )?$/;
const sideWord = (w: string): Dim['side'] => (/wide|width|across/.test(w) ? 'w' : /deep|depth/.test(w) ? 'd' : /high|tall|height/.test(w) ? 'h' : 'long');

/** The unit a bare number most likely is: cm or mm for big numbers, else feet or metres by what the owner uses. */
function guessUnit(v: number, pref: UnitSystem | undefined, imperialSaid: boolean): Unit {
  if (v >= 1000) return 'mm';
  if (v >= 100) return 'cm';
  if (pref === 'imperial') return 'ft';
  if (pref === 'metric') return 'm';
  return imperialSaid || v > 9 ? 'ft' : 'm';
}

/** Every size in (normalised) words: "12 by 10 feet", "3.6 m × 4.2 m", "360cm wide", "10ft 6in", "about 4 metres", "3 to 3.5 m", "16 sqm". */
export function sizesIn(s: string, pref?: UnitSystem): Dim[] {
  const toks = tokens(s);
  const imperialSaid = toks.some((t) => t.unit && IMPERIAL.has(t.unit));
  const parts: Part[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]!;
    const n = toks[i + 1];
    if (n && !t.area && !n.area && n.v >= t.v && (t.unit === null || t.unit === n.unit)) {
      const gap = s.slice(t.end, n.start);
      const between = /\bbetween\s*$/.test(s.slice(Math.max(0, t.start - 9), t.start));
      if (/^\s*(?:to|-|or)\s*$/.test(gap) || (between && /^\s*and\s*$/.test(gap))) {
        parts.push({ start: between ? s.lastIndexOf('between', t.start) : t.start, end: n.end, lo: t, hi: n });
        i++;
        continue;
      }
    }
    parts.push({ start: t.start, end: t.end, lo: t });
  }
  const out: Dim[] = [];
  for (let i = 0; i < parts.length; ) {
    const g = [parts[i]!];
    while (g.length < 3) {
      const n = parts[i + g.length];
      if (!n || n.lo.area || g[g.length - 1]!.lo.area || !/^\s*(?:x|by|\*|times)\s*$/.test(s.slice(g[g.length - 1]!.end, n.start))) break;
      g.push(n);
    }
    i += g.length;
    const units = g.map((p) => p.hi?.unit ?? p.lo.unit);
    let end = g[g.length - 1]!.end;
    let after = s.slice(end);
    const sideM = g.length === 1 ? after.match(SIDE_AFTER) : null;
    const sideB = g.length === 1 && !sideM ? s.slice(Math.max(0, g[0]!.start - 24), g[0]!.start).match(SIDE_BEFORE) : null;
    const square = g.length === 1 && /^\s*square\b/.test(after);
    // a bare number is a size only with a word saying so ("12 wide", "4 square")
    if (!units.some(Boolean) && g.length === 1 && !sideM && !sideB && !square) continue;
    const big = Math.max(...g.map((p) => (p.hi ?? p.lo).v));
    const fallback = guessUnit(big, pref, imperialSaid);
    const val = (t: Tok, u: Unit) => (t.unit ? t.cm : Math.round(t.v * CM_PER[u] * 1000) / 1000);
    const at = (k: number) => {
      const p = g[k]!;
      const u = units.slice(k).find(Boolean) ?? [...units.slice(0, k)].reverse().find(Boolean) ?? fallback;
      const lo = val(p.lo, u);
      if (!p.hi) return { v: lo, u, range: undefined as [number, number] | undefined };
      const hi = val(p.hi, u);
      return { v: Math.round(((lo + hi) / 2) * 1000) / 1000, u, range: [lo, hi] as [number, number] };
    };
    const first = at(0);
    const dim: Dim = { start: g[0]!.start, end, text: '', w: first.v, approx: g.some((p) => p.lo.approx || !!p.hi?.approx || !!p.hi), unit: first.u, guessed: !units.some(Boolean) };
    if (first.range) dim.range = first.range;
    if (g.length === 1 && g[0]!.lo.area) dim.area = g[0]!.lo.cm;
    if (g.length >= 2) dim.d = at(1).v;
    if (g.length === 3) dim.h = at(2).v;
    if (sideM) {
      dim.side = sideWord(sideM[1]!);
      end += sideM[0].length;
    } else if (sideB) dim.side = sideWord(sideB[1]!);
    if (square) {
      dim.square = true;
      dim.d = dim.w;
      end += after.match(/^\s*square\b/)![0].length;
    }
    dim.end = end;
    dim.text = s.slice(dim.start, end).trim();
    out.push(dim);
    after = '';
  }
  return out;
}

/** The first size in a phrase (any wording; see sizesIn). */
export function parseSize(phrase: string, pref?: UnitSystem): Dim | null {
  return sizesIn(normalise(phrase), pref)[0] ?? null;
}

// ------------------------------------------------------------------ showing sizes

const trimNum = (n: number, dp: number) => {
  const t = n.toFixed(dp);
  return t.includes('.') ? t.replace(/\.?0+$/, '') : t;
};
/** A piece's name in a sentence: "Bed, double" → "double bed", "Sofa, 3-seater" → "3-seater sofa". */
const spoken = (name: string) => name.replace(/^([A-Za-z ]+), (.+)$/, '$2 $1').toLowerCase();

/** A length in the owner's unit: "4.2 m" or "13 ft 9 in". */
export function lengthText(cm: number, unit: UnitSystem): string {
  if (unit === 'imperial') {
    const inches = Math.round(cm / 2.54);
    const ft = Math.floor(inches / 12);
    const i = inches % 12;
    return ft ? (i ? `${ft} ft ${i} in` : `${ft} ft`) : `${i} in`;
  }
  return cm < 100 ? `${trimNum(cm, 0)} cm` : `${trimNum(cm / 100, 2)} m`;
}

/** A room's two sides: "4.2 × 3.6 m" or "13 ft 9 in × 11 ft 10 in". */
export function sizeText(w: number, d: number, unit: UnitSystem): string {
  if (unit === 'imperial') return `${lengthText(w, unit)} × ${lengthText(d, unit)}`;
  return `${trimNum(w / 100, 2)} × ${trimNum(d / 100, 2)} m`;
}

/** A piece of furniture's footprint: "210 × 95 cm" or "6 ft 11 in × 3 ft 1 in". */
const itemSize = (w: number, d: number, unit: UnitSystem) => (unit === 'imperial' ? sizeText(w, d, unit) : `${trimNum(w, 0)} × ${trimNum(d, 0)} cm`);

// ------------------------------------------------------------------ the vocabulary

type Side = 'top' | 'right' | 'bottom' | 'left';
const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];
const FLIP: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
const sideOfNormal = (nx: number, ny: number): Side => (Math.abs(nx) > Math.abs(ny) ? (nx > 0 ? 'right' : 'left') : ny > 0 ? 'bottom' : 'top');
const COMPASS: Record<string, number> = { north: 0, northeast: 45, east: 90, southeast: 135, south: 180, southwest: 225, west: 270, northwest: 315 };
/** Which side of the plan looks to a compass bearing, given the bearing of the plan's top edge. */
const compassSide = (bearing: number, north: number): Side => SIDES[Math.round((((bearing - north) % 360) + 360) % 360 / 90) % 4]!;
const compassOf = (w: string) => COMPASS[w.replace(/[\s-]/g, '')];

interface RoomKind {
  kind: string;
  base: string;
  re: RegExp;
  w: number;
  d: number;
  /** A room that gets a window when the words don't say. */
  window: boolean;
}

/** Rooms by what people call them, most specific first; usual UK sizes (cm, w × d) when the words give none. */
const ROOM_KINDS: RoomKind[] = [
  // one open-plan room: "an open-plan kitchen and living room", "a living and dining area", "kitchen/lounge"
  { kind: 'living', base: 'Open-plan room', re: /\bopen[- ]plan (?:living|lounge|sitting|kitchen|dining)(?: room)?(?:\s*(?:and|&|\/|-|,)\s*(?:living|lounge|kitchen|dining|sitting)(?: room)?)+(?: rooms?| areas?| spaces?)?\b|\b(?:living|lounge|sitting|kitchen|dining)(?:\s*(?:and|&|\/|-)\s*(?:living|lounge|kitchen|dining|sitting))+ (?:areas?|spaces?)\b|\b(?:kitchen|living|lounge)\/(?:living|lounge|dining|kitchen)(?: rooms?)?\b/g, w: 600, d: 450, window: true },
  { kind: 'room', base: 'Studio', re: /\bstudio(?: flats?| apartments?)?\b|\bbedsits?\b/g, w: 600, d: 450, window: true },
  { kind: 'ensuite', base: 'En suite', re: /\ben[- ]?suites?(?: (?:bath|shower) ?rooms?)?\b/g, w: 200, d: 150, window: true },
  { kind: 'kitchen', base: 'Kitchen diner', re: /\bkitchen[- ](?:diners?|dining(?: rooms?| areas?)?)\b/g, w: 500, d: 350, window: true },
  { kind: 'bed', base: 'Bedroom', re: /\b(?:(\d+)[ -])?(?:(main|master|principal|first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|sixth|6th|spare|guest|double|single|small|smaller|smallest|little|big|bigger|biggest|large|larger|largest|kids'?|children'?s|baby'?s|other|twin|box) )?(bed ?room(?:ed)?s?|box ?rooms?|beds?(?= (?:house|flat|home|bungalow|apartment|maisonette|cottage|semi|terrace|place)\b))\b/g, w: 330, d: 300, window: true },
  { kind: 'living', base: 'Living room', re: /\b(?:living|sitting|family|reception|front|tv|day) ?rooms?\b|\blounges?\b|\bliving (?:areas?|spaces?)\b|\bsnugs?\b/g, w: 450, d: 380, window: true },
  { kind: 'kitchen', base: 'Kitchen', re: /\bkitchens?\b(?! (?:tables?|units?|islands?|sinks?|cupboards?|worktops?|counters?|chairs?|cabinets?|dressers?|doors?|areas?|corners?|nooks?))/g, w: 350, d: 300, window: true },
  { kind: 'dining', base: 'Dining room', re: /\bdining ?(?:rooms?|areas?)\b/g, w: 350, d: 320, window: true },
  { kind: 'bath', base: 'Bathroom', re: /\b(?:family )?bath ?rooms?\b(?! (?:sinks?|basins?|cabinets?|suites?|units?))|\bshower ?rooms?\b|\bwet ?rooms?\b/g, w: 210, d: 180, window: true },
  { kind: 'wc', base: 'WC', re: /\b(?:cloakrooms?|toilet rooms?|(?:separate|downstairs|ground floor|upstairs) (?:wc|w\.c\.|toilet|loo)s?|wcs?)(?![a-z])/g, w: 150, d: 100, window: false },
  { kind: 'hall', base: 'Hall', re: /\b(?:entrance |front )?hall(?:way)?s?\b(?! (?:tables?|stands?|cupboards?|mirrors?))|\bcorridors?\b|\bpassage(?:way)?s?\b|\blobby\b/g, w: 400, d: 110, window: false },
  { kind: 'landing', base: 'Landing', re: /\blandings?\b/g, w: 300, d: 110, window: false },
  { kind: 'study', base: 'Study', re: /\b(?:home )?(?:study|office)(?: rooms?)?\b(?! (?:chairs?|desks?))|\bstudies\b/g, w: 280, d: 250, window: true },
  { kind: 'utility', base: 'Utility room', re: /\butility(?: rooms?)?\b|\blaundry(?: rooms?)?\b/g, w: 250, d: 180, window: false },
  { kind: 'conservatory', base: 'Conservatory', re: /\bconservator(?:y|ies)\b|\bsun ?rooms?\b|\borangery\b/g, w: 350, d: 300, window: true },
  { kind: 'garage', base: 'Garage', re: /\bgarages?\b/g, w: 550, d: 300, window: false },
  { kind: 'porch', base: 'Porch', re: /\bporch(?:es)?\b/g, w: 150, d: 120, window: false },
  { kind: 'dressing', base: 'Dressing room', re: /\bdressing rooms?\b|\bwalk[- ]in (?:wardrobes?|closets?)\b/g, w: 200, d: 180, window: false },
  { kind: 'pantry', base: 'Pantry', re: /\bpantr(?:y|ies)\b|\blarders?\b/g, w: 150, d: 120, window: false },
  { kind: 'play', base: 'Playroom', re: /\bplay ?rooms?\b|\bnurser(?:y|ies)\b/g, w: 300, d: 280, window: true },
  { kind: 'gym', base: 'Gym', re: /\b(?:home )?gyms?\b/g, w: 350, d: 300, window: true },
  { kind: 'room', base: 'Room', re: /\brooms?\b/g, w: 350, d: 300, window: true },
];
const KIND = new Map(ROOM_KINDS.map((k) => [k.kind, k]));
const HUBS = new Set(['hall', 'landing']);
/** Usual bedroom sizes by how it is described (cm). */
const BED_SIZE = { big: [380, 340], mid: [330, 300], small: [270, 230] } as const;
const ORD_WORD: Record<string, number> = { main: 1, master: 1, principal: 1, first: 1, '1st': 1, second: 2, '2nd': 2, third: 3, '3rd': 3, fourth: 4, '4th': 4, fifth: 5, '5th': 5, sixth: 6, '6th': 6 };

/** How a piece of furniture is placed when the words don't say. */
type Place = 'wall' | 'centre' | 'corner' | 'bedside' | 'coffee' | 'tv' | 'window' | 'run' | 'fire';

interface ItemKind {
  kind: string;
  name: string;
  re: RegExp;
  w: number;
  d: number;
  h: number;
  /** The rooms it usually goes in (for a piece the words don't put in a room). */
  home: string[];
  place: Place;
}

/** Furniture and fittings with their usual UK sizes (cm: width along its back × depth × height; the planner's own catalogue where it has them). */
const ITEMS: ItemKind[] = [
  { kind: 'sofa', name: 'Corner sofa', re: /\b(?:corner|l[- ]shaped) (?:sofa|couch|settee)s?\b/g, w: 250, d: 200, h: 85, home: ['living'], place: 'corner' },
  { kind: 'sofa4', name: 'Sofa, 4-seater', re: /\b4[- ]seat(?:er|ed)?(?: (?:sofa|couch|settee)s?)?\b/g, w: 240, d: 95, h: 85, home: ['living'], place: 'wall' },
  { kind: 'sofa2', name: 'Sofa, 2-seater', re: /\b2[- ]seat(?:er|ed)?(?: (?:sofa|couch|settee)s?)?\b|\bloveseats?\b|\b(?:small|little) (?:sofa|couch|settee)s?\b/g, w: 160, d: 90, h: 85, home: ['living'], place: 'wall' },
  { kind: 'sofa3', name: 'Sofa, 3-seater', re: /\b(?:3[- ]seat(?:er|ed)? )?(?:sofa|couch|settee)s?\b|\b3[- ]seaters?\b/g, w: 210, d: 95, h: 85, home: ['living'], place: 'wall' },
  { kind: 'armchair', name: 'Armchair', re: /\b(?:arm ?chairs?|easy chairs?|accent chairs?|recliners?)\b/g, w: 85, d: 85, h: 90, home: ['living'], place: 'wall' },
  { kind: 'coffee', name: 'Coffee table', re: /\bcoffee tables?\b/g, w: 110, d: 60, h: 45, home: ['living'], place: 'coffee' },
  { kind: 'tv', name: 'TV unit', re: /\b(?:tv|television)(?: units?| stands?| cabinets?| benches?)?\b/g, w: 150, d: 40, h: 50, home: ['living'], place: 'tv' },
  { kind: 'fireplace', name: 'Fireplace', re: /\b(?:fireplaces?|wood ?burners?|log ?burners?|chimney breasts?)\b/g, w: 140, d: 40, h: 110, home: ['living'], place: 'fire' },
  { kind: 'bookcase', name: 'Bookcase', re: /\b(?:bookcases?|book ?shel(?:f|ves)|shelving units?)\b/g, w: 80, d: 30, h: 180, home: ['living', 'study'], place: 'wall' },
  { kind: 'sideboard', name: 'Sideboard', re: /\b(?:sideboards?|credenzas?|kitchen dressers?)\b/g, w: 160, d: 45, h: 80, home: ['dining', 'living'], place: 'wall' },
  { kind: 'dining', name: 'Dining table', re: /\b(?:(?:dining|kitchen) tables?|\d+[- ]seater (?:dining )?tables?|tables? (?:for|seating) \d+)\b/g, w: 120, d: 80, h: 75, home: ['dining', 'kitchen', 'living'], place: 'centre' },
  { kind: 'island', name: 'Kitchen island', re: /\b(?:kitchen )?islands?\b|\bbreakfast bars?\b/g, w: 180, d: 90, h: 90, home: ['kitchen'], place: 'centre' },
  { kind: 'king', name: 'Bed, super king', re: /\bsuper ?king(?:[- ]size(?:d)?)?(?: beds?)?\b/g, w: 190, d: 215, h: 50, home: ['bed'], place: 'wall' },
  { kind: 'king', name: 'Bed, king', re: /\bking(?:[- ]size(?:d)?)?(?: beds?)?\b/g, w: 160, d: 215, h: 50, home: ['bed'], place: 'wall' },
  { kind: 'double', name: 'Bed, double', re: /\b(?:double|queen(?:[- ]size(?:d)?)?|small double) beds?\b/g, w: 145, d: 205, h: 50, home: ['bed'], place: 'wall' },
  { kind: 'single', name: 'Bed, single', re: /\b(?:single|twin|kids'?|child'?s|bunk) ?beds?\b/g, w: 100, d: 200, h: 50, home: ['bed'], place: 'wall' },
  { kind: 'cot', name: 'Cot', re: /\b(?:cots?|cribs?)\b/g, w: 130, d: 70, h: 90, home: ['bed', 'play'], place: 'wall' },
  { kind: 'bedside', name: 'Bedside table', re: /\b(?:bedside (?:tables?|cabinets?|units?|drawers)|bedsides|nightstands?)\b/g, w: 45, d: 40, h: 55, home: ['bed'], place: 'bedside' },
  { kind: 'double', name: 'Bed, double', re: /\bbeds?\b/g, w: 145, d: 205, h: 50, home: ['bed'], place: 'wall' },
  { kind: 'wardrobe', name: 'Wardrobe, double', re: /\b(?:double |triple |single |fitted |built[- ]in )?wardrobes?\b/g, w: 100, d: 60, h: 200, home: ['bed', 'dressing'], place: 'wall' },
  { kind: 'drawers', name: 'Chest of drawers', re: /\bchests? of drawers\b|\bdrawers\b/g, w: 80, d: 45, h: 80, home: ['bed'], place: 'wall' },
  { kind: 'dressing', name: 'Dressing table', re: /\b(?:dressing|vanity) tables?\b/g, w: 100, d: 45, h: 75, home: ['bed'], place: 'window' },
  { kind: 'desk', name: 'Desk', re: /\b(?:desks?|work ?stations?|computer tables?)\b/g, w: 120, d: 60, h: 75, home: ['study', 'bed'], place: 'window' },
  { kind: 'fridge', name: 'Fridge freezer', re: /\b(?:fridge[- ]?freezers?|fridges?|freezers?|refrigerators?)\b/g, w: 60, d: 65, h: 180, home: ['kitchen', 'utility'], place: 'run' },
  { kind: 'hob', name: 'Cooker', re: /\b(?:range )?cookers?\b|\bovens?\b|\bstoves?\b|\bhobs?\b/g, w: 60, d: 60, h: 90, home: ['kitchen'], place: 'run' },
  { kind: 'dishwasher', name: 'Dishwasher', re: /\bdish ?washers?\b/g, w: 60, d: 60, h: 85, home: ['kitchen'], place: 'run' },
  { kind: 'washer', name: 'Washing machine', re: /\bwashing machines?\b|\bwasher(?:[- ]dryers?)?\b/g, w: 60, d: 60, h: 85, home: ['utility', 'kitchen'], place: 'run' },
  { kind: 'dryer', name: 'Tumble dryer', re: /\b(?:tumble )?dryers?\b/g, w: 60, d: 60, h: 85, home: ['utility', 'kitchen'], place: 'run' },
  { kind: 'units', name: 'Kitchen units', re: /\bkitchenettes?\b|\bkitchen (?:areas?|corners?|nooks?)\b|\b(?:kitchen )?(?:units|cupboards|worktops?|counters?|cabinets)\b/g, w: 240, d: 60, h: 90, home: ['kitchen', 'utility'], place: 'run' },
  { kind: 'bath', name: 'Bath', re: /\b(?:bath ?tubs?|baths?|tubs?)\b/g, w: 170, d: 70, h: 55, home: ['bath', 'ensuite'], place: 'corner' },
  { kind: 'shower', name: 'Shower', re: /\b(?:walk[- ]in )?shower(?: cubicles?| enclosures?| trays?| units?)?s?\b/g, w: 90, d: 90, h: 200, home: ['ensuite', 'bath'], place: 'corner' },
  { kind: 'toilet', name: 'Toilet', re: /\b(?:toilets?|loos?|wcs?)\b/g, w: 40, d: 70, h: 80, home: ['bath', 'wc', 'ensuite'], place: 'run' },
  { kind: 'basin', name: 'Basin', re: /\b(?:wash ?|hand ?)?basins?\b|\bvanity(?: units?)?\b/g, w: 55, d: 45, h: 85, home: ['bath', 'wc', 'ensuite'], place: 'run' },
  { kind: 'sink', name: 'Sink unit', re: /\b(?:kitchen )?sinks?\b/g, w: 100, d: 60, h: 90, home: ['kitchen', 'utility'], place: 'run' },
  { kind: 'piano', name: 'Piano', re: /\b(?:upright )?pianos?\b/g, w: 150, d: 60, h: 120, home: ['living'], place: 'wall' },
  { kind: 'stairs', name: 'Stairs', re: /\bstair(?:s|case|way)\b/g, w: 270, d: 90, h: 240, home: ['hall', 'landing', 'living'], place: 'wall' },
];
/** Things the plan does not draw: too small or flat to plan around. */
const NOT_DRAWN = /\b(rugs?|carpets?|lamps?|lights?|curtains?|blinds?|mirrors?|pictures?|paintings?|plants?|radiators?|cushions?|chairs?|stools?)\b/g;
const BEDS = new Set(['single', 'double', 'king', 'cot']);
const KITCHEN_RUN = new Set(['fridge', 'hob', 'dishwasher', 'washer', 'dryer', 'units', 'sink']);
const BATH_RUN = new Set(['toilet', 'basin', 'bath', 'shower']);
/** Dining tables by the number they seat (cm). */
const SEATS: [number, number, number][] = [
  [2, 80, 80],
  [4, 120, 80],
  [6, 180, 90],
  [8, 220, 100],
  [10, 260, 100],
];

// ------------------------------------------------------------------ reading the words

type WallWord = Side | 'long' | 'short' | 'far' | 'door' | 'window' | 'inside' | 'outside' | 'any';

/** The wall the words name ("against the long wall", "on the left", "facing south", "at the back"), if any. */
function wallWordIn(t: string, north: number): WallWord | undefined {
  const m = t.match(/\b(long(?:est)?|short(?:est)?|left|right|top|bottom|back|rear|front|far|end|north|south|east|west|inside|outside|internal|external|outer|inner|window|door)(?:[- ]hand)?(?: side)? walls?\b/);
  if (m) {
    const w = m[1]!;
    if (/^long/.test(w)) return 'long';
    if (/^short/.test(w)) return 'short';
    if (w === 'left' || w === 'right' || w === 'top' || w === 'bottom') return w;
    if (w === 'back' || w === 'rear') return 'top';
    if (w === 'front') return 'bottom';
    if (w === 'far' || w === 'end') return 'far';
    if (/^(?:inside|internal|inner)$/.test(w)) return 'inside';
    if (/^(?:outside|external|outer)$/.test(w)) return 'outside';
    if (w === 'window' || w === 'door') return w;
    return compassSide(COMPASS[w]!, north);
  }
  const f = t.match(/\b(north|south|east|west)[- ]?(east|west)?[- ]facing\b|\b(?:fac(?:es?|ing)|looks?|looking)(?: out)? (?:to the |towards the |the )?(north|south|east|west)[- ]?(east|west)?\b/);
  if (f) return compassSide(compassOf(`${f[1] ?? f[3]}${f[2] ?? f[4] ?? ''}`)!, north);
  if (/\b(?:facing|overlooking|onto|on to|looking (?:out )?(?:on)?to|over|out to) (?:the )?(?:back ?)?garden\b|\b(?:at|to) the (?:back|rear)\b/.test(t)) return 'top';
  if (/\b(?:facing|overlooking|onto|on to|looking (?:out )?(?:on)?to|over) (?:the )?(?:street|road|front)\b|\bat the front\b/.test(t)) return 'bottom';
  if (/\b(?:on|to|at) the left\b/.test(t)) return 'left';
  if (/\b(?:on|to|at) the right\b/.test(t)) return 'right';
  if (/\bat the (?:far )?end\b/.test(t)) return 'far';
  if (/\bagainst (?:the |a |one )?wall\b/.test(t)) return 'any';
  return undefined;
}

/** "X is to the right of / behind / in front of Y": the side X is on (the back of the home is the top of the plan). */
function dirIn(t: string, north: number): Side | undefined {
  if (/\b(?:to|on|at) (?:the|its|their) (?:far )?right\b|\bright(?:-hand)? side\b|\bright of\b/.test(t)) return 'right';
  if (/\b(?:to|on|at) (?:the|its|their) (?:far )?left\b|\bleft(?:-hand)? side\b|\bleft of\b/.test(t)) return 'left';
  if (/\bbehind\b|\b(?:at|to) the (?:back|rear)\b|\b(?:back|rear) of\b/.test(t)) return 'top';
  if (/\bin front of\b|\b(?:at|to) the front\b|\bfront of\b/.test(t)) return 'bottom';
  const c = t.match(/\b(north|south|east|west)(?: of|[- ]side)\b/);
  if (c) return compassSide(COMPASS[c[1]!]!, north);
  return undefined;
}

interface WinReq {
  n: number;
  side?: WallWord;
  w?: number;
  h?: number;
  sill?: number;
  /** Only to make sure there is one ("the bed under the window"). */
  ref: boolean;
  said: string;
}

export interface RoomSpec {
  id: string;
  kind: string;
  base: string;
  ord: number;
  storey: number;
  order: number;
  w?: number;
  d?: number;
  said: { w: boolean; d: boolean };
  approx: boolean;
  shape: 'box' | 'l';
  desc?: 'big' | 'small' | 'spare';
  fromCount: boolean;
  claimed: boolean;
  lastSeen: number;
  windows: WinReq[];
  noWindow: boolean;
  name: string;
}

interface Rel {
  a: string;
  b: string;
  /** The side of b that a is on. */
  side?: Side;
  door: boolean;
  open: boolean;
  opp: boolean;
  end: boolean;
  /** Worked out here, not said. */
  assumed?: string;
}

interface DoorReq {
  a: string;
  /** The other room; none for a door to the outside. */
  b?: string;
  kind: 'front' | 'back' | 'patio' | 'door' | 'open';
  w?: number;
  side?: WallWord;
  none?: boolean;
}

interface Hint {
  wall?: WallWord;
  under?: boolean;
  byWindow?: boolean;
  centre?: boolean;
  corner?: boolean;
  opposite?: string;
  beside?: string;
  foot?: boolean;
  said: string;
}

interface ItemReq {
  kind: ItemKind;
  room: string;
  w: number;
  d: number;
  h: number;
  sizeSaid: boolean;
  hint: Hint;
  order: number;
}

export interface HomeSpec {
  text: string;
  unit: UnitSystem;
  rooms: RoomSpec[];
  rels: Rel[];
  doors: DoorReq[];
  items: ItemReq[];
  /** Ceiling height per storey (cm); -1 is every storey. */
  ceilings: Map<number, number>;
  north: number;
  assumed: string[];
  cannot: string[];
}

type MType = 'room' | 'item' | 'door' | 'window' | 'ceiling';
interface Mention {
  type: MType;
  start: number;
  end: number;
  sentence: number;
  /** room: the rooms meant (several for "both bedrooms"). */
  ids: string[];
  plural: boolean;
  /** item / door / window details. */
  item?: ItemKind;
  count?: number;
  countSaid?: boolean;
  words?: string;
  dims: Dim[];
}

const ARTICLE_DEF = /\b(?:the|this|that|its|my|our|your|his|her|their|each|every|both|all|these|those|other)\s+(?:[\w'-]+\s+){0,2}$/;
const ARTICLE_INDEF = /\b(?:a|an|another|1|new|extra|separate)\s+(?:[\w'-]+\s+){0,2}$/;
const ALL_WORDS = /\b(?:both|each|all|every)\s+(?:of the\s+)?(?:\d+\s+)?(?:[\w'-]+\s+)?$/;
/** Words that say how two rooms sit (used to find a sentence's subject). */
const REL_WORDS = /\b(?:off|next to|beside|through|opens?|leads?|leading|connect\w*|join\w*|into|onto|from|between|opposite|behind|in front of|left|right|adjoin\w*|adjacent|alongside|by)\b/;
const NO_SIZE_AFTER = /(?!\s*(?:x\b|by\b|to\b|-|\.\d|\d|m\b|met|cm|mm|ft|feet|foot|'|"|yards?|yds?|sqm|sqft|ins?\b|inch|seat))/;

/** Sentence ranges ("." ends one only before a space or the end, so 3.6 m stays whole). */
function sentenceRanges(s: string): [number, number][] {
  const out: [number, number][] = [];
  let at = 0;
  for (const m of s.matchAll(/[.!?;\n]+(?=\s|$)/g)) {
    out.push([at, m.index!]);
    at = m.index! + m[0].length;
  }
  if (at < s.length) out.push([at, s.length]);
  return out;
}

/** Which storey each part of the words is about: 0 the ground floor, 1 upstairs, 2 the floor above that. Sticky until another storey is named. */
function storeyMarks(s: string): { at: number; storey: number }[] {
  const marks: { at: number; storey: number }[] = [{ at: 0, storey: 0 }];
  // the stairs going up are not the upstairs
  const t = s.replace(/\bstair(?:s|case|way)?\b[^.,;]{0,30}\bup(?:stairs)?\b/g, (x) => ' '.repeat(x.length));
  const upper = /\b(?:upstairs|first floor|1st floor)\b/.test(t);
  for (const m of t.matchAll(/\b(upstairs|up stairs|first floor|1st floor|second floor|2nd floor|top floor|floor above|loft|attic|downstairs|down stairs|ground floor|ground level)\b/g)) {
    const w = m[1]!;
    const storey = /down|ground/.test(w) ? 0 : /second|2nd/.test(w) || (/loft|attic|top floor/.test(w) && upper) ? 2 : 1;
    // the storey applies from the start of the clause it is in ("…, two bedrooms and a bathroom upstairs")
    const i = m.index!;
    const dot = s.lastIndexOf('. ', i - 1);
    let clause = Math.max(s.lastIndexOf(',', i), s.lastIndexOf(';', i), dot, s.lastIndexOf(':', i), 0);
    // "the kitchen is downstairs and the bedroom is upstairs": a part with its own verb starts at its "and"
    const conj = Math.max(...[' and ', ' but ', ' while ', ' whereas '].map((w) => s.lastIndexOf(w, i)));
    if (conj > clause && /\b(?:is|are|'s|sits?|goes|go)\b/.test(s.slice(conj, i))) clause = conj;
    marks.push({ at: clause, storey });
  }
  return marks.sort((a, b) => a.at - b.at);
}

const storeyAt = (marks: { at: number; storey: number }[], pos: number) => {
  let st = 0;
  for (const m of marks) if (m.at <= pos) st = m.storey;
  return st;
};

/** A copy of the words with every size blanked out (the same length), for reading the words around them. */
const blankDims = (s: string, dims: Dim[]) => {
  let t = s;
  for (const d of dims) t = t.slice(0, d.start) + ' '.repeat(d.end - d.start) + t.slice(d.end);
  return t;
};

/** Read the owner's description: the rooms, how they sit, doors, windows, ceilings and furniture. Pure. */
export function readHome(text: string, unit?: UnitSystem): HomeSpec {
  const s = normalise(text.slice(0, 4000));
  const assumed: string[] = [];
  const cannot: string[] = [];
  const dimsAll = sizesIn(s, unit);
  const metricN = dimsAll.filter((d) => !d.guessed && !IMPERIAL.has(d.unit)).length;
  const imperialN = dimsAll.filter((d) => !d.guessed && IMPERIAL.has(d.unit)).length;
  const shown: UnitSystem = unit ?? (imperialN > metricN ? 'imperial' : 'metric');
  const t = blankDims(s, dimsAll);
  const sentences = sentenceRanges(s);
  const sentenceOf = (pos: number) => Math.max(0, sentences.findIndex(([a, b]) => pos >= a && pos <= b));
  const marks = storeyMarks(s);
  const used = new Uint8Array(s.length);
  const free = (a: number, b: number) => !used.subarray(a, b).some((x) => x);
  const take = (a: number, b: number) => used.fill(1, a, b);
  for (const d of dimsAll) take(d.start, d.end);
  const north = readNorth(t);

  // --- rooms
  interface Hit { start: number; end: number; k: RoomKind; ord?: number; count?: number; plural: boolean; def: 'def' | 'indef' | 'none'; all: boolean; desc?: RoomSpec['desc']; box: boolean }
  const hits: Hit[] = [];
  for (const k of ROOM_KINDS) {
    for (const m of t.matchAll(k.re)) {
      const start = m.index!;
      let end = start + m[0].length;
      if (!free(start, end)) continue;
      const before = t.slice(Math.max(0, start - 30), start);
      let count = m[0].match(/^(\d+)[ -]/) ? parseInt(m[0], 10) : undefined;
      const pc = before.match(/(?:^|\s)(\d+)[ -](?:(?:good[- ]sized?|decent[- ]sized?|double|single|small|large|big|separate|little|more)\s+)?$/);
      if (count === undefined && pc && /s\b|s$/.test(m[0].trim())) count = parseInt(pc[1]!, 10);
      let ord: number | undefined;
      let desc: RoomSpec['desc'];
      const word = k.kind === 'bed' ? m[2] : undefined;
      if (word && ORD_WORD[word]) ord = ORD_WORD[word];
      if (word && /^(?:main|master|principal|double|big|bigger|biggest|large|larger|largest)$/.test(word)) desc = 'big';
      if (word && /^(?:single|small|smaller|smallest|little|kids'?|children'?s|baby'?s|box)$/.test(word)) desc = 'small';
      if (word && /^(?:spare|guest)$/.test(word)) desc = 'spare';
      const box = k.kind === 'bed' && /box/.test(m[3] ?? '');
      if (box) desc = 'small';
      const after = t.slice(end).match(new RegExp(`^ (\\d{1,2})(?![\\d.])${NO_SIZE_AFTER.source}`));
      if (after && !count) {
        ord = parseInt(after[1]!, 10);
        end += after[0].length;
      }
      const plural = /s$/.test(m[0].replace(/\s+$/, '')) && !/(?:ss|is|us)$/.test(m[0].trim()) && !/ensuite/.test(m[0]) ? true : !!(count && count > 1);
      const pre = before.replace(/\d+[ -]$/, '');
      const def = ARTICLE_DEF.test(pre) ? 'def' : ARTICLE_INDEF.test(pre) ? 'indef' : 'none';
      // the generic word "room" only when it stands alone ("a room 4 by 3 m"), never "the rooms off the hall" with no number
      if (k.kind === 'room' && plural && !count) continue;
      take(start, end);
      hits.push({ start, end, k, ord, count, plural, def, all: ALL_WORDS.test(pre) || (plural && def === 'def'), desc, box });
    }
  }
  hits.sort((a, b) => a.start - b.start);
  const rooms: RoomSpec[] = [];
  const mentions: Mention[] = [];
  let order = 0;
  const create = (k: RoomKind, storey: number, ord?: number, fromCount = false): RoomSpec => {
    const same = rooms.filter((r) => r.kind === k.kind);
    const o = ord ?? (Math.max(0, ...same.map((r) => r.ord)) + 1);
    const kind = k.kind === 'hall' && storey > 0 ? KIND.get('landing')! : k;
    const r: RoomSpec = { id: `${kind.kind}${o}`, kind: kind.kind, base: kind.base, ord: o, storey, order: order++, said: { w: false, d: false }, approx: false, shape: 'box', fromCount, claimed: !fromCount, lastSeen: -1, windows: [], noWindow: false, name: '' };
    while (rooms.some((x) => x.id === r.id)) r.id += '_';
    rooms.push(r);
    return r;
  };
  for (const h of hits) {
    const storey = storeyAt(marks, h.start);
    const kind = h.k.kind === 'hall' && storey > 0 ? 'landing' : h.k.kind;
    const ofKind = () => rooms.filter((r) => r.kind === kind);
    const recent = (list: RoomSpec[]) => [...list].sort((a, b) => b.lastSeen - a.lastSeen)[0];
    let ids: RoomSpec[] = [];
    const fresh = new Set<RoomSpec>();
    const make = (ord?: number) => {
      const r = create(h.k, storey, ord, true);
      fresh.add(r);
      return r;
    };
    if (h.count && h.count > 1) {
      const n = Math.min(h.count, 8);
      if (h.def !== 'indef' && (h.all || h.def === 'def') && ofKind().length) {
        while (ofKind().length < n) make();
        ids = ofKind().slice(0, n);
      } else {
        // "a 3 bed semi … upstairs two double bedrooms and a box room": the count said first is the total
        ids = ofKind().filter((r) => !r.claimed).slice(0, n);
        while (ids.length < n) ids.push(make());
      }
    } else if (h.plural && h.k.kind !== 'ensuite') {
      ids = ofKind();
      if (!ids.length) {
        ids = [create(h.k, storey, undefined, true), create(h.k, storey, undefined, true)];
        assumed.push(`you said ${h.k.base.toLowerCase()}s without a number: I drew 2`);
      }
    } else if (h.ord) {
      ids = [rooms.find((r) => r.kind === kind && r.ord === h.ord) ?? create(h.k, storey, h.ord)];
    } else if (h.k.kind === 'room' && ((h.def === 'def' && rooms.length) || (rooms.length === 1 && rooms[0]!.base === 'Studio'))) {
      ids = [recent(rooms)!];
    } else {
      const unclaimed = ofKind().find((r) => !r.claimed);
      const here = recent(ofKind().filter((r) => r.storey === storey)) ?? recent(ofKind());
      if (h.def === 'def') ids = [unclaimed ?? here ?? create(h.k, storey)];
      else if (h.def === 'indef') ids = [unclaimed ?? create(h.k, storey)];
      else ids = [unclaimed ?? here ?? create(h.k, storey)];
    }
    for (const r of ids) {
      if (fresh.has(r)) {
        r.lastSeen = h.start;
        continue;
      }
      if (!r.claimed) r.storey = h.k.kind === 'hall' && storey > 0 ? r.storey : storey;
      r.claimed = true;
      r.lastSeen = h.start;
      if (h.desc && !r.desc) r.desc = h.desc;
      if (h.box) r.base = 'Box room';
      if (h.k.base === 'Open-plan room') {
        const w = t.slice(h.start, h.end);
        r.base = /kitchen/.test(w) && /living|lounge|sitting/.test(w) ? 'Kitchen and living room' : /dining/.test(w) && /living|lounge|sitting/.test(w) ? 'Living and dining room' : /kitchen/.test(w) ? 'Kitchen diner' : 'Living room';
        if (/kitchen/.test(w) && !/living|lounge|sitting/.test(w)) r.kind = 'kitchen';
      }
    }
    // "an L-shaped living room"
    if (/\bl[- ]?shaped?\s*$/.test(t.slice(Math.max(0, h.start - 12), h.start)) || /^\s*(?:is |which is )?l[- ]?shaped?\b/.test(t.slice(h.end, h.end + 20))) for (const r of ids) r.shape = 'l';
    mentions.push({ type: 'room', start: h.start, end: h.end, sentence: sentenceOf(h.start), ids: ids.map((r) => r.id), plural: ids.length > 1, dims: [] });
  }

  // --- furniture, doors, windows, ceilings (in the words not already read as rooms)
  for (const k of ITEMS) {
    for (const m of t.matchAll(k.re)) {
      const start = m.index!;
      const end = start + m[0].length;
      if (!free(start, end)) continue;
      take(start, end);
      const before = t.slice(Math.max(0, start - 30), start);
      const cnt = before.match(/(?:^|\s)(\d+)\s+(?:(?:big|small|large|little|matching|tall|low|built[- ]in|fitted|double|single|new|old|white|wooden|grey|black)\s+)?$/);
      let count = cnt ? parseInt(cnt[1]!, 10) : 1;
      const plural = /s$/.test(m[0]) && !/(?:ss|us|is)$/.test(m[0]) && !/\bdrawers$/.test(m[0]) && !/\bstairs$/.test(m[0]) && !/\b(?:units|cupboards|worktops|counters|cabinets)$/.test(m[0]);
      if (!cnt && plural) count = 2;
      mentions.push({ type: 'item', start, end, sentence: sentenceOf(start), ids: [], plural, item: k, count: Math.max(1, Math.min(8, count)), countSaid: !!cnt || !plural || k.kind === 'bedside', words: m[0], dims: [] });
    }
  }
  for (const m of t.matchAll(/\b(front door|back door|side door|garden door|patio doors?|french doors?|bi-?fold(?:ing)? doors?|sliding (?:patio )?doors?|double doors|doors?|doorways?|archways?|openings?)\b/g)) {
    if (!free(m.index!, m.index! + m[0].length)) continue;
    take(m.index!, m.index! + m[0].length);
    mentions.push({ type: 'door', start: m.index!, end: m.index! + m[0].length, sentence: sentenceOf(m.index!), ids: [], plural: false, words: m[0], dims: [] });
  }
  for (const m of t.matchAll(/\b(?:(\d+)\s+)?((?:(?:big|large|huge|wide|small|little|tiny|tall|narrow|bay|sash|picture|floor[- ]to[- ]ceiling|double|casement|velux|roof|dormer|frosted)\s+)*)(windows?|skylights?|roof ?lights?|veluxe?s?|dormers?)\b|\bwindowless\b/g)) {
    if (!free(m.index!, m.index! + m[0].length)) continue;
    take(m.index!, m.index! + m[0].length);
    mentions.push({ type: 'window', start: m.index!, end: m.index! + m[0].length, sentence: sentenceOf(m.index!), ids: [], plural: /s$/.test(m[3] ?? ''), count: m[1] ? parseInt(m[1], 10) : /s$/.test(m[3] ?? '') ? 2 : 1, countSaid: !!m[1] || !/s$/.test(m[3] ?? ''), words: m[0], dims: [] });
  }
  for (const m of t.matchAll(/\b(?:(high|low|tall) )?ceilings?(?: heights?)?\b|\bheadroom\b/g)) {
    if (!free(m.index!, m.index! + m[0].length)) continue;
    take(m.index!, m.index! + m[0].length);
    mentions.push({ type: 'ceiling', start: m.index!, end: m.index! + m[0].length, sentence: sentenceOf(m.index!), ids: [], plural: false, words: m[0], dims: [] });
  }
  mentions.sort((a, b) => a.start - b.start);

  // --- each size goes to what it describes: "the kitchen is 3 by 3 m", "a 2 m sofa", "a sofa 2 m wide"
  for (const d of dimsAll) {
    const sent = sentenceOf(d.start);
    const prev = [...mentions].reverse().find((m) => m.end <= d.start && m.sentence === sent);
    const next = mentions.find((m) => m.start >= d.end && m.sentence === sent);
    const gp = prev ? t.slice(prev.end, d.start) : null;
    const gn = next ? t.slice(d.end, next.start) : null;
    const strongPrev = gp !== null && /^[\s,:(=-]*(?:(?:is|are|was|measures?|measuring|sized|of|at|that'?s|which is|it'?s|being|about|around|roughly|approx(?:imately)?|maybe|just|over|under|nearly|almost|say|each|both|all|roughly)\s+)*$/.test(gp);
    const strongNext = gn !== null && /^\s*(?:-|sized?|size)?\s*(?:(?:open[- ]plan|l[- ]shaped|square|big|small|large|little|double|single|spare|main|separate|good[- ]sized?|bright|new|modern|old|tiny|huge|narrow|long|cosy|family)\s+)*$/.test(gn);
    // "the kitchen is off the living room to the right, about 10ft by 9ft": the size set off by commas is the subject's
    const subject = mentions.find((m) => m.type === 'room' && m.sentence === sent && m.end <= d.start);
    const aside = gp !== null && /,\s*(?:(?:about|around|roughly|approx\w*|maybe|say|just|nearly|almost|probably)\s+)?$/.test(gp) && subject && prev && subject !== prev && prev.type === 'room' && REL_WORDS.test(t.slice(subject.end, prev.start));
    const owner = aside ? subject : strongPrev ? prev : strongNext ? next : gp !== null && gp.length < 30 && !/[,;]/.test(gp) ? prev : gn !== null && gn.length < 12 && !/\b(?:with|has|have|and)\b/.test(gn) ? next : prev && gp !== null && gp.length < 40 ? prev : undefined;
    if (owner) owner.dims.push(d);
  }

  // --- room sizes
  const ceilings = new Map<number, number>();
  for (const m of mentions.filter((x) => x.type === 'room')) {
    const each = m.ids.length > 1;
    for (const d of m.dims) {
      for (const id of m.ids) {
        const r = rooms.find((x) => x.id === id)!;
        if (d.h) ceilings.set(r.storey, d.h);
        if (d.side === 'h') {
          ceilings.set(r.storey, d.w);
          continue;
        }
        if (d.area && !d.d) {
          const side = Math.sqrt(d.area);
          if (!r.said.w) r.w = side;
          if (!r.said.d) r.d = r.said.w && r.w ? d.area / r.w : side;
          r.said = { w: true, d: true };
          assumed.push(`${id}|from the area you gave (${trimNum(d.area / 10000, 1)} m²), I made it ${'%size%'}`);
        } else if (d.d !== undefined) {
          r.w = d.w;
          r.d = d.d;
          r.said = { w: true, d: true };
        } else if (d.side === 'd' || d.side === 'long') {
          r.d = d.w;
          r.said.d = true;
        } else {
          r.w = d.w;
          r.said.w = true;
        }
        if (d.approx) r.approx = true;
        if (d.range) assumed.push(`${id}|you gave a range (${d.text}): I used the middle, ${lengthText(d.w, shown)}`);
        if (d.guessed) assumed.push(`you gave ${d.text} without a unit: I took it as ${d.unit === 'ft' ? 'feet' : d.unit === 'm' ? 'metres' : d.unit === 'cm' ? 'centimetres' : 'millimetres'}`);
      }
      if (each) break;
    }
  }

  // --- ceilings
  for (const m of mentions.filter((x) => x.type === 'ceiling')) {
    const d = m.dims[0];
    // "Ceilings are 8 foot" is every floor; "upstairs the ceilings are lower, 2.2 m" is that floor
    const [a0, a1] = sentences[m.sentence]!;
    const named = /\b(?:upstairs|downstairs|first floor|1st floor|second floor|ground floor|loft|attic|top floor)\b/.test(t.slice(a0, a1));
    const key = named ? storeyAt(marks, m.start) : -1;
    if (d) {
      const h = d.d !== undefined ? d.d : d.w;
      if (h >= 180 && h <= 600) ceilings.set(key, h);
      else cannot.push(`a ceiling of ${d.text} is not a height I can draw, so I used 2.4 m`);
      if (d.guessed) assumed.push(`you gave the ceiling (${d.text}) without a unit: I took it as ${d.unit === 'ft' ? 'feet' : 'metres'}`);
    } else if (m.words && /^(?:high|tall) /.test(m.words)) {
      ceilings.set(key, 270);
      assumed.push('you said high ceilings: I made them 2.7 m');
    } else if (m.words && /^low /.test(m.words)) {
      ceilings.set(key, 220);
      assumed.push('you said low ceilings: I made them 2.2 m');
    }
  }

  // --- how the rooms sit: relations
  const rels: Rel[] = [];
  const addRel = (a: string, b: string, r: Omit<Rel, 'a' | 'b'>) => {
    if (a === b || rels.some((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a && !r.side))) return;
    rels.push({ a, b, ...r });
  };
  const noDoor = new Set<string>();
  for (let si = 0; si < sentences.length; si++) {
    const [s0, s1] = sentences[si]!;
    const ms = mentions.filter((m) => m.sentence === si);
    const rm = ms.filter((m) => m.type === 'room');
    if (!rm.length) continue;
    let pending: Mention[] = [];
    let chain: { other: Mention; r: Omit<Rel, 'a' | 'b'> } | null = null;
    // words already read as a link ("…two bedrooms off it, and the bathroom") are not read again
    let usedTo = -1;
    const relOf = (gap: string, tail: string): Omit<Rel, 'a' | 'b'> | null => {
      const open = /\bopen[- ]plan\b|\bopen (?:to|onto|into)\b|\bknocked through\b|\barch(?:way)? (?:to|into|through)\b/.test(gap);
      const between = /\bbetween\b/.test(gap);
      const opp = /\bopposite\b|\bacross (?:the (?:hall(?:way)?|landing|corridor) )?from\b|\bfacing\b/.test(gap);
      const end = /\b(?:at|on) the (?:far )?end of\b/.test(gap);
      const door = /\boff\b|\bopens? (?:straight )?(?:on)?to\b|\bopens? (?:in|out)(?:to)?\b|\bopening (?:on)?to\b|\bleads? (?:in)?to\b|\bleading (?:in)?to\b|\bthrough(?: to)?\b|\bvia\b|\bconnect(?:s|ed)? (?:to|with)\b|\bjoin(?:s|ed)? (?:on)?to\b|\bgoes (?:in)?to\b|\binto\b|\bonto\b|\bfrom\b|\bdoor (?:to|into|from|through)\b|\baccess(?:ed)? (?:from|via|through)\b|\breached (?:from|through|via)\b|\bout of\b/.test(gap);
      const adj = /\bnext (?:door )?to\b|\bbeside\b|\balongside\b|\badjoin(?:s|ing)?\b|\badjacent to\b|\bby\b|\bagainst\b|\bbacks? (?:on)?to\b|\bshares? a wall with\b|\battached to\b|\bnear\b|\bbehind\b|\bin front of\b|\bbeyond\b|\bpast\b|\bafter\b/.test(gap);
      // "the kitchen is off the living room to the right": the kitchen's side; "open plan to a kitchen on the left": the kitchen's
      const inGap = dirIn(gap, north);
      const inTail = inGap ? undefined : dirIn(tail, north);
      const subject = /\b(?:is|are|sits?|lies?|goes|was|comes?)\b/.test(gap);
      const side = inGap ?? (inTail && !subject ? FLIP[inTail] : inTail);
      if (!(open || between || opp || end || door || adj || side)) return null;
      return { side: between ? undefined : side, door: (door || open || end) && !opp, open, opp, end };
    };
    const isJoiner = (g: string) => /^\s*(?:,\s*)?(?:(?:and|&|or|plus|with|as well as|then|also|both)\s+)*(?:(?:a|an|the|my|our|another|its|their|\d+)\s+)?(?:(?:big|small|large|little|good[- ]sized?|decent[- ]sized?|separate|double|single|spare|nice|new|open[- ]plan|l[- ]shaped|tiny|huge|bright|main|second|third|downstairs|upstairs)\s+)*$/.test(g);
    for (let i = 0; i < rm.length; i++) {
      const B = rm[i]!;
      const nextM = ms.find((m) => m.start >= B.end);
      const tailFull = t.slice(B.end, nextM ? nextM.start : s1);
      const tail = tailFull.split(/[,;]|\band\b|\bbut\b/)[0] ?? '';
      if (i === 0) {
        const prefix = t.slice(s0, B.start);
        const pre = prefix.match(/\b(off|from|along|leading off|around)\s+(?:the |my |our )?$/);
        const pd = prefix.match(/\b((?:to|on) the (?:left|right)|behind|in front|at the (?:back|front|rear))\s+of\s+(?:the |my |our )?$/);
        if (pre || pd) chain = { other: B, r: { side: pd ? dirIn(`${pd[1]} of`, north) : undefined, door: !!pre, open: false, opp: false, end: false } };
        pending = [B];
        continue;
      }
      const A = rm[i - 1]!;
      const gap = t.slice(Math.max(A.end, Math.min(usedTo, B.start)), B.start);
      const blocked = ms.some((m) => m.type !== 'room' && m.start >= A.end && m.end <= B.start);
      // "a living room with the kitchen off it": the second room's words point back at the first
      const back = tail.match(/^\s*(?:,\s*)?(?:which is |that is |is |are |sits? )?(off|next to|beside|through|opening (?:on)?to|leading (?:off|from)|to the (?:left|right) of|behind|in front of)\s+(?:it|this|that|them|which)\b/);
      if (back) {
        const r = relOf(back[1]!, '')!;
        // "a hall with the living room, kitchen and two bedrooms off it": the whole list is off the first
        const joined = isJoiner(gap) && pending.length > 1;
        const to = joined ? pending[0]! : A;
        for (const m of joined ? [...pending.slice(1), B] : [B]) for (const a of m.ids) for (const b of to.ids) addRel(a, b, r);
        usedTo = B.end + back.index! + back[0].length;
        pending = [B];
        continue;
      }
      if (blocked) {
        // "a living room with a bay window and a skylight, open plan to the kitchen": the words after the last thing in between
        const lastThing = [...ms].reverse().find((m) => m.type !== 'room' && m.start >= A.end && m.end <= B.start)!;
        const r = /^\s*,/.test(t.slice(lastThing.end, B.start)) ? relOf(t.slice(lastThing.end, B.start), tail) : null;
        if (r) for (const a of A.ids) for (const b of B.ids) addRel(a, b, r);
        pending = [B];
        chain = null;
        continue;
      }
      if (isJoiner(gap)) {
        const own = REL_WORDS.test(tail) || !!dirIn(tail, north);
        // "…the bathroom at the end": the end of the hall
        const hub = rm.find((m) => m.ids.some((id) => HUBS.has(rooms.find((r) => r.id === id)!.kind)));
        if (/\bat the (?:far )?end\b(?! of)/.test(tail) && hub && hub !== B) {
          for (const a of B.ids) for (const b of hub.ids) addRel(a, b, { door: true, open: false, opp: false, end: true });
          pending = [B];
          continue;
        }
        // "the hall leads to the kitchen, the lounge and the bathroom" — unless the new room starts its own part ("…, bathroom behind the kitchen")
        if (own && /,/.test(gap)) {
          pending = [B];
          chain = null;
        } else if (chain && !own && !/\b(?:is|are|has|have|sits?|leads?|opens?|goes)\b/.test(tail)) for (const a of B.ids) for (const b of chain.other.ids) addRel(a, b, chain.r);
        else pending.push(B);
        if (/\bside by side\b|\bnext to each other\b|\bbeside each other\b|\bshare a wall\b|\badjoin(?:ing)?\b|\bconnected\b|\bjoined\b|\bopen[- ]plan\b/.test(tailFull)) {
          const door = /\bconnected\b|\bjoined\b|\bdoor\b|\bopen[- ]plan\b/.test(tailFull);
          for (let k = 1; k < pending.length; k++) for (const a of pending[k]!.ids) for (const b of pending[k - 1]!.ids) addRel(a, b, { door, open: /open[- ]plan/.test(tailFull), opp: false, end: false });
        }
        // "an open-plan kitchen and living room"
        if (/\bopen[- ]plan\s+(?:[\w'-]+\s+){0,2}$/.test(t.slice(Math.max(s0, A.start - 20), A.start))) for (const a of B.ids) for (const b of A.ids) addRel(a, b, { door: true, open: true, opp: false, end: false });
        continue;
      }
      const r = relOf(gap, tail);
      if (r) {
        if (/\bbetween\b/.test(gap)) {
          const C = rm[i + 1];
          if (B.ids.length > 1) {
            for (const a of A.ids) {
              addRel(a, B.ids[0]!, { ...r, side: 'right' });
              addRel(a, B.ids[1]!, { ...r, side: 'left' });
            }
          } else if (C && isJoiner(t.slice(B.end, C.start))) {
            for (const a of A.ids) {
              for (const b of B.ids) addRel(a, b, { ...r, side: 'right' });
              for (const c of C.ids) addRel(a, c, { ...r, side: 'left' });
            }
            i++;
          } else for (const a of A.ids) for (const b of B.ids) addRel(a, b, r);
          pending = [B];
          continue;
        }
        if (/\bno door\b|\bwithout a door\b/.test(gap)) for (const p of pending) for (const a of p.ids) for (const b of B.ids) noDoor.add(`${a}|${b}`);
        for (const p of pending.length ? pending : [A]) for (const a of p.ids) for (const b of B.ids) addRel(a, b, r);
        chain = { other: B, r };
        pending = [B];
        continue;
      }
      // "to the right of the hall is the kitchen"
      if (chain && chain.other === A && /^\s*(?:,\s*)?(?:is|are|there'?s|there is|there are|sits?|you'?ll find|you find|we have|comes?|you have)?\s*(?:the|a|an|my|our)?\s*$/.test(gap)) {
        for (const a of B.ids) for (const b of A.ids) addRel(a, b, chain.r);
        pending = [B];
        continue;
      }
      // "the hall, then the kitchen on the left": a side said after the room, with no other link word
      const side = dirIn(tail, north);
      if (side) for (const a of B.ids) for (const b of A.ids) addRel(a, b, { side, door: false, open: false, opp: false, end: false });
      pending = [B];
      chain = null;
    }
  }

  // --- doors
  const doors: DoorReq[] = [];
  for (const m of mentions.filter((x) => x.type === 'door')) {
    const w = m.words ?? '';
    const sent = sentences[m.sentence]!;
    const clause = t.slice(sent[0], sent[1]);
    const near = t.slice(m.end, Math.min(sent[1], m.end + 60));
    const outside = /front|back|side|patio|french|fold|sliding|garden/.test(w) || /^\s*(?:\w+\s+){0,3}?(?:to|into|onto|out to|out onto|leading (?:out )?to|opening (?:on)?to) (?:the )?(?:garden|outside|street|road|yard|patio|terrace|drive(?:way)?|back ?yard|balcony)\b/.test(near) || /\b(?:external|outside) door\b/.test(clause);
    const rmS = mentions.filter((x) => x.type === 'room' && x.sentence === m.sentence);
    const byDist = [...rmS].sort((a, b) => Math.min(Math.abs(a.start - m.end), Math.abs(a.end - m.start)) - Math.min(Math.abs(b.start - m.end), Math.abs(b.end - m.start)));
    const width = m.dims[0] ? (m.dims[0].d !== undefined && m.dims[0].d < m.dims[0].w ? m.dims[0].d : m.dims[0].w) : undefined;
    const kind: DoorReq['kind'] = /front/.test(w) ? 'front' : /patio|french|fold|sliding|double/.test(w) ? 'patio' : /back|garden|side/.test(w) || outside ? 'back' : /arch|opening|doorway/.test(w) ? 'open' : 'door';
    const none = /\bno\s+(?:\w+\s+)?$/.test(t.slice(Math.max(0, m.start - 12), m.start)) || /\bwithout (?:a |any )?$/.test(t.slice(Math.max(0, m.start - 14), m.start));
    const side = wallWordIn(near.split(/[,;]/)[0] ?? '', north);
    if (outside) {
      const room = byDist[0]?.ids[0];
      if (room) doors.push({ a: room, kind: kind === 'door' || kind === 'open' ? 'back' : kind, w: width, side });
      else doors.push({ a: '', kind: kind === 'door' || kind === 'open' ? 'back' : kind, w: width, side });
      continue;
    }
    if (rmS.length >= 2) {
      const [x, y] = byDist.slice(0, 2).sort((a, b) => a.start - b.start);
      for (const a of x!.ids) for (const b of y!.ids) {
        if (none) noDoor.add(`${a}|${b}`);
        else {
          doors.push({ a, b, kind, w: width, side });
          addRel(a, b, { door: true, open: kind === 'open', opp: false, end: false });
        }
      }
    }
  }
  for (const k of noDoor) {
    const [a, b] = k.split('|');
    for (const r of rels) if ((r.a === a && r.b === b) || (r.a === b && r.b === a)) r.door = false;
  }

  // --- windows
  for (const m of mentions.filter((x) => x.type === 'window')) {
    const w = m.words ?? '';
    const before = t.slice(Math.max(0, m.start - 26), m.start);
    const room = windowRoom(m);
    if (!room.length) continue;
    if (/windowless/.test(w) || /\bno\s+$/.test(before) || /\bwithout (?:a |any )?$/.test(before)) {
      for (const id of room) rooms.find((r) => r.id === id)!.noWindow = true;
      continue;
    }
    if (/skylight|roof|velux|dormer/.test(w)) {
      cannot.push(`roof windows and skylights can't be drawn on a floor plan yet, so the ${w.trim()} is left out`);
      continue;
    }
    if (/\bbay\b/.test(w)) cannot.push('bay windows are drawn as flat windows (the planner has straight walls only)');
    const ref = /\b(?:under|below|beneath|by|near|next to|beside|in front of|facing|opposite|towards|to|at|out of|from|of)\s+(?:the|a|an|its|one of the)\s*$/.test(before);
    const d = m.dims[0];
    const near = t.slice(m.end, m.end + 50).split(/[,;.]/)[0] ?? '';
    const floor = /floor[- ]to[- ]ceiling/.test(w);
    const req: WinReq = { n: m.count ?? 1, side: wallWordIn(near, north), ref, said: w.trim() };
    if (d) {
      if (d.side === 'h') req.h = d.w;
      else {
        req.w = d.w;
        if (d.d !== undefined) req.h = d.d;
      }
    } else if (/big|large|huge|wide|picture/.test(w)) req.w = 160;
    else if (/small|little|tiny|narrow/.test(w)) req.w = 60;
    if (floor) req.sill = 10;
    for (const id of room) rooms.find((r) => r.id === id)!.windows.push(req);
  }
  function windowRoom(m: Mention): string[] {
    const rmS = mentions.filter((x) => x.type === 'room' && x.sentence === m.sentence);
    const prev = [...rmS].reverse().find((x) => x.end <= m.start);
    const next = rmS.find((x) => x.start >= m.end);
    if (next && /^\s*(?:\w+\s+){0,4}?(?:in|on|of|for|to)\s+(?:the|my|our|each|both|every|a|an)?\s*$/.test(t.slice(m.end, next.start))) return next.ids;
    // "the bed under the window": the window of the room the bed is in
    const item = [...mentions].reverse().find((x) => x.type === 'item' && x.end <= m.start && x.sentence === m.sentence);
    if (item && (!prev || item.start > prev.end)) {
      const r = itemRoom(item);
      if (r.length) return r;
    }
    if (prev) return prev.ids;
    if (next) return next.ids;
    // "The windows face south.": the last room named that has windows
    const back = [...mentions].reverse().filter((x) => x.type === 'room' && x.end <= m.start);
    const living = (x: Mention) => x.ids.some((id) => !['bath', 'ensuite', 'wc'].includes(rooms.find((r) => r.id === id)!.kind) && KIND.get(rooms.find((r) => r.id === id)!.kind)?.window);
    return (back.find(living) ?? back[0])?.ids ?? (rooms[0] ? [rooms[0].id] : []);
  }

  // --- furniture
  function itemRoom(m: Mention): string[] {
    const rmS = mentions.filter((x) => x.type === 'room' && x.sentence === m.sentence);
    const prev = [...rmS].reverse().find((x) => x.end <= m.start);
    const next = rmS.find((x) => x.start >= m.end);
    const itemBetween = (a: number, b: number) => mentions.some((x) => x.type === 'item' && x !== m && x.start >= a && x.end <= b);
    if (next && !itemBetween(m.end, next.start) && /^\s*(?:[\w'-]+\s+){0,6}?(?:in|into|inside|for|of|to go in|goes in|in the corner of)\s+(?:the|my|our|a|an|each|both|every|all)?\s*$/.test(t.slice(m.end, next.start))) return next.ids;
    if (prev) {
      // "the main bedroom has an en suite and a king size bed": the bed goes in the bedroom
      const before = [...rmS].reverse().filter((x) => x.end <= m.start);
      const home = before.find((x) => x.ids.some((id) => m.item!.home.includes(rooms.find((r) => r.id === id)!.kind)));
      return (home && !prev.ids.some((id) => m.item!.home.includes(rooms.find((r) => r.id === id)!.kind)) ? home : prev).ids;
    }
    if (next && /^\s*(?:[\w'-]+\s+){0,4}?(?:in|for)\s/.test(t.slice(m.end, next.start))) return next.ids;
    // "The bed goes against the back wall.": the last room named that such a piece goes in
    const back = [...mentions].reverse().filter((x) => x.type === 'room' && x.end <= m.start);
    const ctx = back.find((x) => x.ids.some((id) => m.item!.home.includes(rooms.find((r) => r.id === id)!.kind))) ?? back[0];
    if (ctx) return ctx.ids;
    const home = rooms.find((r) => m.item!.home.includes(r.kind));
    return home ? [home.id] : rooms[0] ? [rooms[0].id] : [];
  }
  const items: ItemReq[] = [];
  let itemOrder = 0;
  const notDrawn = new Set<string>();
  for (const m of t.matchAll(NOT_DRAWN)) if (free(m.index!, m.index! + m[0].length)) notDrawn.add(m[1]!.replace(/s$/, ''));
  const itemMs = mentions.filter((x) => x.type === 'item');
  if (itemMs.length && !rooms.length) {
    const r = create(KIND.get('room')!, 0);
    r.claimed = true;
    for (const d of dimsAll.filter((x) => !mentions.some((m) => m.dims.includes(x)))) {
      if (d.d !== undefined) {
        r.w = d.w;
        r.d = d.d;
        r.said = { w: true, d: true };
        break;
      }
    }
  }
  for (const m of itemMs) {
    const k = m.item!;
    let ids = itemRoom(m);
    if (!ids.length && rooms[0]) ids = [rooms[0].id];
    const sent = sentences[m.sentence]!;
    const nextM = mentions.find((x) => x.start >= m.end && x.sentence === m.sentence && x.type !== 'window');
    const after = t.slice(m.end, nextM && nextM.type !== 'window' ? nextM.start : sent[1]).split(/[,;]|\band (?:a|an|the|\d+)\b|\bbut\b/)[0] ?? '';
    const afterW = t.slice(m.end, sent[1]).split(/[,;]|\band (?:a|an|the|\d+)\b|\bbut\b/)[0] ?? '';
    const prevM = [...mentions].reverse().find((x) => x.end <= m.start && x.sentence === m.sentence);
    const prefix = t.slice(prevM ? prevM.end : sent[0], m.start);
    const hint = hintIn(`${/^\s*(?:,\s*)?(?:against|along|under|below|beneath|in the|in a|by|next to|beside|opposite|facing|on the|at the)\b/.test(prefix) && !prevM ? prefix : ''} ${afterW.length < after.length + 40 ? afterW : after}`, north);
    let { w, d, h } = k;
    let sizeSaid = false;
    const seats = (m.words ?? '').match(/(\d+)/)?.[1] ?? t.slice(m.end, m.end + 16).match(/^\s*(?:for|seating|that seats|seats) (\d+)\b/)?.[1];
    if (k.kind === 'dining' && seats) {
      const n = parseInt(seats, 10);
      const row = SEATS.find(([p]) => p >= n) ?? SEATS[SEATS.length - 1]!;
      w = row[1];
      d = row[2];
    }
    const dim = m.dims[0];
    if (dim) {
      sizeSaid = true;
      const bed = BEDS.has(k.kind);
      if (dim.d !== undefined) {
        [w, d] = bed ? [Math.min(dim.w, dim.d), Math.max(dim.w, dim.d)] : [Math.max(dim.w, dim.d), Math.min(dim.w, dim.d)];
        if (dim.h !== undefined) h = dim.h;
      } else if (dim.side === 'd') d = dim.w;
      else if (dim.side === 'h') h = dim.w;
      else if (dim.side === 'long' && bed) d = dim.w;
      else w = dim.w;
      if (dim.guessed) assumed.push(`you gave the ${spoken(k.name)} (${dim.text}) without a unit: I took it as ${dim.unit === 'ft' ? 'feet' : dim.unit === 'm' ? 'metres' : dim.unit === 'cm' ? 'centimetres' : 'millimetres'}`);
    }
    for (const id of ids) {
      const room = rooms.find((r) => r.id === id)!;
      // a sink in a bathroom is a basin
      const kind = k.kind === 'sink' && ['bath', 'ensuite', 'wc'].includes(room.kind) ? ITEMS.find((x) => x.kind === 'basin')! : k;
      const ww = kind === k ? w : kind.w;
      const dd = kind === k ? d : kind.d;
      for (let c = 0; c < (m.count ?? 1); c++) items.push({ kind, room: id, w: ww, d: dd, h, sizeSaid, hint, order: itemOrder++ });
      if (!m.countSaid && (m.count ?? 1) > 1) assumed.push(`you said ${spoken(kind.name)}s without a number: I drew ${m.count}`);
    }
  }
  if (notDrawn.size) cannot.push(`not drawn (too small or flat to plan with, or tucked under a table): ${[...notDrawn].join(', ')}${notDrawn.has('chair') ? ' — leave about 75 cm round a table for its chairs' : ''}`);

  // --- rooms nobody placed: the usual partner, said as an assumption
  const related = (id: string) => rels.some((r) => r.a === id || r.b === id);
  for (const r of rooms) {
    if (related(r.id)) continue;
    const pick = (kinds: string[]) => {
      for (const k of kinds) {
        const c = rooms.filter((x) => x.kind === k && x.storey === r.storey && x.id !== r.id);
        if (c.length) return c.find((x) => !rels.some((q) => (q.a === x.id || q.b === x.id) && rooms.find((y) => y.id === (q.a === x.id ? q.b : q.a))?.kind === r.kind)) ?? c[0];
      }
      return undefined;
    };
    const partner = r.kind === 'ensuite' || r.kind === 'dressing' ? pick(['bed']) : r.kind === 'pantry' || r.kind === 'utility' ? pick(['kitchen']) : r.kind === 'conservatory' ? pick(['living', 'dining', 'kitchen']) : r.kind === 'porch' ? pick(['hall', 'living']) : undefined;
    if (partner) {
      rels.push({ a: r.id, b: partner.id, door: true, open: false, opp: false, end: false, side: r.kind === 'conservatory' ? 'top' : r.kind === 'porch' ? 'bottom' : undefined, assumed: `${r.id}|I put it off ${partner.id}: you didn't say where it goes` });
    }
  }

  // --- names
  const byBase = new Map<string, RoomSpec[]>();
  for (const r of rooms) byBase.set(r.base, [...(byBase.get(r.base) ?? []), r]);
  for (const list of byBase.values()) {
    list.sort((a, b) => a.ord - b.ord);
    for (const r of list) r.name = list.length > 1 ? `${r.base} ${r.ord}` : r.base;
  }
  // storeys used with nothing between them close up
  const used2 = [...new Set(rooms.map((r) => r.storey))].sort();
  for (const r of rooms) r.storey = used2.indexOf(r.storey);
  if (rooms.filter((r) => r.storey === 0).length === 0 && rooms.length) for (const r of rooms) r.storey = Math.max(0, r.storey - 1);
  return { text: s, unit: shown, rooms, rels, doors, items, ceilings, north, assumed, cannot };
}

/** "The back of the house faces south" → the plan's top edge looks south (north = 180). */
function readNorth(t: string): number {
  const m = t.match(/\b(back|rear|garden|front)(?: of the (?:house|home|flat))?(?: garden)?\s+(?:is |faces |facing |looks )+(?:to the )?(north|south|east|west)[- ]?(east|west)?\b/) ?? t.match(/\b(north|south|east|west)[- ]?(east|west)?[- ]facing (back|rear|garden|front)\b/);
  if (!m) return 0;
  const [where, a, b] = /^(?:back|rear|garden|front)$/.test(m[1]!) ? [m[1]!, m[2]!, m[3] ?? ''] : [m[3]!, m[1]!, m[2] ?? ''];
  const bearing = compassOf(`${a}${b}`) ?? 0;
  return where === 'front' ? (bearing + 180) % 360 : bearing;
}

/** Where a piece of furniture goes, from the words after it: "against the long wall", "under the window", "in the middle", "opposite the sofa". */
function hintIn(t: string, north: number): Hint {
  const h: Hint = { said: t.trim().slice(0, 60) };
  const opp = t.match(/\b(?:opposite|facing|across from) (?:the |a )?(sofa|couch|settee|bed|tv|television|fireplace|armchair|desk|window|door)\b/);
  if (opp) {
    if (opp[1] === 'window' || opp[1] === 'door') h.wall = 'far';
    else h.opposite = /sofa|couch|settee/.test(opp[1]!) ? 'sofa' : opp[1] === 'television' ? 'tv' : opp[1]!;
  }
  if (/\b(?:under|below|beneath|in front of)\s+(?:the |a )?(?:\w+ )?window/.test(t)) h.under = true;
  else if (/\b(?:by|near|next to|beside|facing|towards|looking out of|at)\s+(?:the |a )?(?:\w+ )?window/.test(t)) h.byWindow = true;
  const by = t.match(/\b(?:next to|beside|by|alongside|either side of|each side of|on (?:each|either|both) sides? of|both sides of) (?:the )?(bed|sofa|couch|desk|fridge|sink|cooker|toilet|basin|bath|door)\b/);
  if (by) h.beside = /sofa|couch/.test(by[1]!) ? 'sofa' : by[1]!;
  if (/\b(?:at|by) the (?:foot|end) of the bed\b/.test(t)) h.foot = true;
  if (/\b(?:in|at) the (?:middle|centre|center)\b|\bcentred\b|\bfree[- ]?standing\b/.test(t)) h.centre = true;
  if (/\bin (?:the|a|one) corner\b/.test(t)) h.corner = true;
  if (!h.opposite && !h.under && !h.byWindow) {
    const w = wallWordIn(t, north);
    if (w && !(w === 'far' && h.foot)) h.wall = w;
  }
  return h;
}

// ------------------------------------------------------------------ the plan

export interface Storey {
  name: string;
  rooms: RoomShape[];
  openings: Opening[];
  items: PlanItem[];
  h: number;
  wall: number;
  north: number;
}

export interface HomePlan {
  unit: UnitSystem;
  storeys: Storey[];
  summary: string[];
  assumed: string[];
  cannot: string[];
  walkways: string[];
}

interface Placed {
  spec: RoomSpec;
  x: number;
  y: number;
  w: number;
  d: number;
  poly: Pt[];
}

const STOREY_NAMES = ['Ground floor', 'First floor', 'Second floor'];
const DOOR_MIN = 60;
const DOOR_W = DEFAULTS.door.w;
const WALKWAY = 70;
const r1 = (v: number) => Math.round(v * 10) / 10;

/** A room's usual size when the words give none or only one side (cm). */
function defaultSize(r: RoomSpec, storeys: number): [number, number] {
  const k = KIND.get(r.kind) ?? KIND.get('room')!;
  if (r.kind === 'bed') {
    const s = r.desc === 'big' || (r.ord === 1 && r.desc !== 'small') ? BED_SIZE.big : r.desc === 'small' || r.ord >= 3 ? BED_SIZE.small : BED_SIZE.mid;
    return [s[0], s[1]];
  }
  if (HUBS.has(r.kind)) return [k.w, storeys > 1 ? 190 : k.d];
  return [k.w, k.d];
}

/** Every room's size: the words', checked, or the usual size — said as an assumption. */
function sizeRooms(spec: HomeSpec, storeys: number): void {
  for (const r of spec.rooms) {
    const [dw, dd] = defaultSize(r, storeys);
    const bad = (v: number | undefined) => v !== undefined && (v < 50 || v > 3000);
    if (bad(r.w) || bad(r.d)) {
      const side = bad(r.w) ? r.w! : r.d!;
      spec.cannot.push(`${r.id}|a side of ${lengthText(side, spec.unit)} is not a room size I can draw (50 cm to 30 m), so I used the usual size`);
      r.w = undefined;
      r.d = undefined;
      r.said = { w: false, d: false };
    }
    if (HUBS.has(r.kind) && r.w !== undefined && r.d !== undefined) {
      // a hall is long and narrow: its length runs along the plan
      const [a, b] = [Math.max(r.w, r.d), Math.min(r.w, r.d)];
      r.w = a;
      r.d = b;
    }
    if (r.w === undefined && r.d === undefined) {
      r.w = dw;
      r.d = dd;
      spec.assumed.push(HUBS.has(r.kind) ? `@size|${r.id}|${lengthText(dd, spec.unit)} wide` : `@size|${r.id}|%size%`);
    } else if (r.w === undefined || r.d === undefined) {
      if (HUBS.has(r.kind)) {
        const said = (r.w ?? r.d)!;
        const along = r.said.d && !r.said.w ? said : said > 250 ? said : undefined;
        r.w = along ?? dw;
        r.d = along ? dd : said;
        if (along) spec.assumed.push(`@oneside|${r.id}|${lengthText(dd, spec.unit)} wide`);
      } else {
        r.w = r.w ?? dw;
        r.d = r.d ?? dd;
        spec.assumed.push(`@oneside|${r.id}|%size%`);
      }
    }
  }
}

const rectOverlap = (a: Rect, b: Rect, tol = 0.5) => a.x < b.x + b.w - tol && b.x < a.x + a.w - tol && a.y < b.y + b.h - tol && b.y < a.y + a.h - tol;
const boxOf = (p: Placed): Rect => ({ x: p.x, y: p.y, w: p.w, h: p.d });
/** How much wall two boxes share (cm). */
function rectTouch(A: Rect, B: Rect): number {
  const along = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
  if (Math.abs(A.x + A.w - B.x) < 0.5 || Math.abs(B.x + B.w - A.x) < 0.5) return along(A.y, A.y + A.h, B.y, B.y + B.h);
  if (Math.abs(A.y + A.h - B.y) < 0.5 || Math.abs(B.y + B.h - A.y) < 0.5) return along(A.x, A.x + A.w, B.x, B.x + B.w);
  return 0;
}

/** How much wall two rooms share (cm): plain arithmetic for two boxes, the shared contract's sharedWalls otherwise; nothing when they are apart. */
function sharedLen(a: Pt[], b: Pt[]): number {
  const A = bounds(a);
  const B = bounds(b);
  if (A.x > B.x + B.w + 0.5 || B.x > A.x + A.w + 0.5 || A.y > B.y + B.h + 0.5 || B.y > A.y + A.h + 0.5) return 0;
  if (a.length === 4 && b.length === 4) return rectTouch(A, B);
  return sharedWalls(a, b).reduce((s, x) => s + x.to - x.from, 0);
}
const roomPoly = (spec: RoomSpec, x: number, y: number, w: number, d: number): Pt[] =>
  spec.shape === 'l' ? lPoly(x, y, w, d, Math.round((w * 0.4) / 5) * 5, Math.round((d * 0.4) / 5) * 5, 'tr') : rectPoly(x, y, w, d);

/** Is room a on `side` of room b (next to it on that side, sharing some wall)? */
function onSide(a: Rect, b: Rect, side: Side): boolean {
  if (side === 'right') return a.x >= b.x + b.w - 1;
  if (side === 'left') return a.x + a.w <= b.x + 1;
  if (side === 'top') return a.y + a.h <= b.y + 1;
  return a.y >= b.y + b.h - 1;
}

/**
 * Lay out one storey: a hall (when there is one) as a corridor with the rooms off it in a row
 * either side, then every other room beside the rooms the words put it next to (the side said,
 * a wall long enough for a door), otherwise wherever keeps the home compact.
 */
function layoutStorey(spec: HomeSpec, st: number): Placed[] {
  const mine = spec.rooms.filter((r) => r.storey === st).sort((a, b) => a.order - b.order);
  const rels = spec.rels.filter((r) => mine.some((x) => x.id === r.a) && mine.some((x) => x.id === r.b));
  const placed: Placed[] = [];
  const put = (spec2: RoomSpec, x: number, y: number, w: number, d: number) => placed.push({ spec: spec2, x, y, w, d, poly: roomPoly(spec2, x, y, w, d) });
  const relsOf = (id: string) => rels.filter((r) => r.a === id || r.b === id);
  const otherOf = (r: Rel, id: string) => (r.a === id ? r.b : r.a);
  const hall = mine.find((r) => HUBS.has(r.kind));
  if (hall) {
    // the rooms off the hall: said to be, or not said to be reached through another room
    const viaOther = (r: RoomSpec) => relsOf(r.id).some((q) => q.door && !q.opp && otherOf(q, r.id) !== hall.id);
    const spine = mine.filter((r) => r !== hall && !['ensuite', 'dressing'].includes(r.kind) && (relsOf(r.id).some((q) => otherOf(q, r.id) === hall.id) || !viaOther(r)));
    const sideTo = (r: RoomSpec): Side | undefined => {
      const q = rels.find((x) => (x.a === r.id && x.b === hall.id) || (x.b === r.id && x.a === hall.id));
      if (!q) return undefined;
      if (q.end) return 'right';
      if (!q.side) return undefined;
      return q.a === r.id ? q.side : FLIP[q.side];
    };
    // rooms said to be next to each other go in the same row, left to right as said
    const groups: RoomSpec[][] = [];
    for (const r of spine) {
      const near = rels.filter((q) => !q.opp && (q.a === r.id || q.b === r.id) && otherOf(q, r.id) !== hall.id).map((q) => otherOf(q, r.id));
      const g = groups.find((x) => x.some((y) => near.includes(y.id)));
      if (g) g.push(r);
      else groups.push([r]);
    }
    for (let i = groups.length - 1; i > 0; i--) {
      const j = groups.findIndex((g, k) => k < i && g.some((x) => groups[i]!.some((y) => rels.some((q) => !q.opp && ((q.a === x.id && q.b === y.id) || (q.a === y.id && q.b === x.id))))));
      if (j >= 0) groups[j]!.push(...groups.splice(i, 1)[0]!);
    }
    const ordered = groups.map((g) => {
      const out = [...g];
      for (let pass = 0; pass < out.length * out.length; pass++) {
        let moved = false;
        for (const q of rels) {
          if (!q.side || (q.side !== 'left' && q.side !== 'right')) continue;
          const ia = out.findIndex((x) => x.id === q.a);
          const ib = out.findIndex((x) => x.id === q.b);
          if (ia < 0 || ib < 0) continue;
          // a to the right of b: a comes after b
          if ((q.side === 'right' && ia < ib) || (q.side === 'left' && ia > ib)) {
            const [x] = out.splice(ia, 1);
            out.splice(q.side === 'right' ? out.findIndex((y) => y.id === q.b) + 1 : out.findIndex((y) => y.id === q.b), 0, x!);
            moved = true;
          }
        }
        if (!moved) break;
      }
      return out;
    });
    const top: RoomSpec[] = [];
    const bottom: RoomSpec[] = [];
    const left: RoomSpec[] = [];
    const right: RoomSpec[] = [];
    const sum = (l: RoomSpec[]) => l.reduce((s2, r) => s2 + r.w!, 0);
    for (const g of ordered) {
      const sd = g.map(sideTo).find(Boolean);
      if (g.length === 1 && sd === 'left' && !left.length) left.push(g[0]!);
      else if (g.length === 1 && sd === 'right' && !right.length) right.push(g[0]!);
      else if (sd === 'top') top.push(...g);
      else if (sd === 'bottom') bottom.push(...g);
    }
    const byWidth = [...ordered].sort((a, b) => sum(b) - sum(a));
    for (const g of byWidth) {
      if (g.some((r) => [top, bottom, left, right].some((l) => l.includes(r)))) continue;
      const opp = rels.find((q) => q.opp && g.some((r) => q.a === r.id || q.b === r.id));
      const o = opp ? (g.some((r) => r.id === opp.a) ? opp.b : opp.a) : undefined;
      if (o && top.some((x) => x.id === o)) bottom.push(...g);
      else if (o && bottom.some((x) => x.id === o)) top.push(...g);
      else (sum(top) <= sum(bottom) ? top : bottom).push(...g);
    }
    // back in the order the words gave them
    const said = (l: RoomSpec[]) => l.sort((a, b) => ordered.flat().indexOf(a) - ordered.flat().indexOf(b));
    said(top);
    said(bottom);
    const hw = hall.d!;
    // with an upstairs, a clear stretch at the end of the hall for the stairs (doors leave no other 2.7 m of wall)
    const stairs = spec.rooms.some((r) => r.storey !== st) && !spec.items.some((i) => i.kind.kind === 'stairs' && i.room !== hall.id && mine.some((r) => r.id === i.room)) ? 280 : 0;
    const need = Math.max(sum(top), sum(bottom), Math.min(sum(top), sum(bottom)) + stairs, 100);
    let L = hall.w!;
    if (hall.said.w || hall.said.d) {
      if (L < need - 1) {
        spec.assumed.push(`${hall.id}|it had to be ${lengthText(need, spec.unit)} long for every room to open off it (you said ${lengthText(L, spec.unit)})`);
        L = need;
      }
    } else L = need;
    hall.w = L;
    put(hall, 0, 0, L, hw);
    let x = 0;
    for (const r of top) {
      put(r, x, -r.d!, r.w!, r.d!);
      x += r.w!;
    }
    x = 0;
    for (const r of bottom) {
      put(r, x, hw, r.w!, r.d!);
      x += r.w!;
    }
    for (const r of left) put(r, -r.w!, hw / 2 - r.d! * 0.5, r.w!, r.d!);
    for (const r of right) put(r, L, hw / 2 - r.d! * 0.5, r.w!, r.d!);
  }
  // everything else, the most connected first
  const rest = () => mine.filter((r) => !placed.some((p) => p.spec === r));
  while (rest().length) {
    const cands = rest();
    const score = (r: RoomSpec) => relsOf(r.id).filter((q) => placed.some((p) => p.spec.id === otherOf(q, r.id))).length;
    const r = placed.length ? [...cands].sort((a, b) => score(b) - score(a) || a.order - b.order)[0]! : [...cands].sort((a, b) => relsOf(b.id).length - relsOf(a.id).length || a.order - b.order)[0]!;
    if (!placed.length) {
      put(r, 0, 0, r.w!, r.d!);
      continue;
    }
    const best = bestSpot(r, placed, rels, spec);
    put(r, best.x, best.y, best.w, best.d);
  }
  // whether each relation came true
  for (const q of rels) {
    const a = placed.find((p) => p.spec.id === q.a);
    const b = placed.find((p) => p.spec.id === q.b);
    if (!a || !b || q.opp) continue;
    const touch = sharedLen(a.poly, b.poly);
    const sideOk = !q.side || onSide(boxOf(a), boxOf(b), q.side);
    if (touch < DOOR_MIN + 10 || !sideOk) spec.cannot.push(`I couldn't put ${a.spec.name} ${q.side && !sideOk ? `to the ${q.side === 'top' ? 'back' : q.side === 'bottom' ? 'front' : q.side} of` : 'next to'} ${b.spec.name} as well as everything else you described`);
  }
  // rooms start at 0, 0
  const b = bounds(placed.flatMap((p) => p.poly));
  for (const p of placed) {
    p.x -= b.x;
    p.y -= b.y;
    p.poly = p.poly.map(([x, y]): Pt => [x - b.x, y - b.y]);
  }
  return placed;
}

/** The best place for one more room beside those placed: its partners next to it (on the side said), compact, no overlap. */
function bestSpot(r: RoomSpec, placed: Placed[], rels: Rel[], spec: HomeSpec): { x: number; y: number; w: number; d: number } {
  const mine = rels.filter((q) => q.a === r.id || q.b === r.id);
  const partners = mine.map((q) => ({ q, p: placed.find((p) => p.spec.id === (q.a === r.id ? q.b : q.a)) })).filter((x): x is { q: Rel; p: Placed } => !!x.p);
  const box0 = bounds(placed.flatMap((p) => p.poly));
  const hub = placed.find((p) => HUBS.has(p.spec.kind)) ?? placed.find((p) => p.spec.kind === 'living') ?? placed[0]!;
  let best: { x: number; y: number; w: number; d: number; score: number } | null = null;
  const orients: [number, number, number][] = [[r.w!, r.d!, 0]];
  if (Math.abs(r.w! - r.d!) > 1 && r.shape === 'box') orients.push([r.d!, r.w!, 6]);
  const ys = [...new Set(placed.flatMap((p) => [p.y, p.y + p.d]))];
  const xs = [...new Set(placed.flatMap((p) => [p.x, p.x + p.w]))];
  for (const [w, d, swapCost] of orients) {
    const spots: [number, number][] = [];
    for (const q of placed) {
      const yAlong = [q.y, q.y + q.d - d, q.y + (q.d - d) / 2, ...ys, ...ys.map((y) => y - d)];
      const xAlong = [q.x, q.x + q.w - w, q.x + (q.w - w) / 2, ...xs, ...xs.map((x) => x - w)];
      for (const y of yAlong) {
        spots.push([q.x + q.w, y]);
        spots.push([q.x - w, y]);
      }
      for (const x of xAlong) {
        spots.push([x, q.y + q.d]);
        spots.push([x, q.y - d]);
      }
    }
    // rectangles throughout (a polygon only for an L), and each placed room's box worked out once: this loop runs thousands of times
    const boxes = placed.map(boxOf);
    const wantsWin = (spec2: RoomSpec) => [...new Set(spec2.windows.map((w2) => w2.side).filter((x): x is Side => SIDES.includes(x as Side)))];
    const theirWins = placed.map((p) => wantsWin(p.spec));
    const myWins = wantsWin(r);
    const hubAt = placed.indexOf(hub);
    for (const [x, y] of spots) {
      const box = { x, y, w, h: d };
      const poly = r.shape === 'l' ? roomPoly(r, x, y, w, d) : null;
      const touchOf = (i: number) => {
        const p = placed[i]!;
        return poly || p.poly.length !== 4 ? sharedLen(poly ?? roomPoly(r, x, y, w, d), p.poly) : rectTouch(box, boxes[i]!);
      };
      if (placed.some((p, i) => rectOverlap(box, boxes[i]!) && (!poly && p.poly.length === 4 ? true : polysOverlap(poly ?? roomPoly(r, x, y, w, d), p.poly)))) continue;
      const touch = placed.map((_, i) => touchOf(i));
      let score = -swapCost;
      for (const { q, p } of partners) {
        const i = placed.indexOf(p);
        const t2 = touch[i]!;
        score += t2 >= DOOR_MIN + 30 ? 100 + Math.min(t2, 200) / 20 : -120;
        if (q.side) {
          const side = q.a === r.id ? q.side : FLIP[q.side];
          score += onSide(box, boxes[i]!, side) && t2 >= 30 ? 80 : -60;
        }
      }
      // no partner said: off the hall (or the main room) where there is one, else anywhere compact
      if (!partners.length) score += touch[hubAt]! >= DOOR_MIN + 30 ? 60 : 0;
      // keep the walls the words want windows in on the outside
      placed.forEach((_, i) => {
        if (touch[i]! < 1) return;
        for (const sd of theirWins[i]!) if (onSide(box, boxes[i]!, sd)) score -= 90;
        for (const sd of myWins) if (onSide(boxes[i]!, box, sd)) score -= 90;
      });
      score += touch.reduce((a, b) => a + b, 0) / 60;
      const bw = Math.max(box0.x + box0.w, x + w) - Math.min(box0.x, x);
      const bh = Math.max(box0.y + box0.h, y + d) - Math.min(box0.y, y);
      score -= ((bw * bh - box0.w * box0.h) / 10000) * 2.5;
      if (!best || score > best.score + 1e-9) best = { x, y, w, d, score };
    }
  }
  if (!best) {
    spec.cannot.push(`${r.name} could not be placed beside the other rooms`);
    return { x: box0.x + box0.w, y: box0.y, w: r.w!, d: r.d! };
  }
  return best;
}

/** The plan for the whole description: rooms, doors, windows and furniture per storey, and what was assumed. Pure. */
export function designHome(text: string, unit?: UnitSystem): HomePlan {
  const spec = readHome(text, unit);
  const nStoreys = Math.min(3, Math.max(0, ...spec.rooms.map((r) => r.storey)) + 1);
  if (!spec.rooms.length) return { unit: spec.unit, storeys: [], summary: [], assumed: spec.assumed, cannot: spec.cannot, walkways: [] };
  // upstairs needs somewhere to arrive: a landing when it has several rooms
  for (let st = 1; st < nStoreys; st++) {
    const up = spec.rooms.filter((r) => r.storey === st);
    if (up.length >= 2 && !up.some((r) => HUBS.has(r.kind))) {
      const l: RoomSpec = { id: `landing${st}`, kind: 'landing', base: 'Landing', ord: st, storey: st, order: -1, said: { w: false, d: false }, approx: false, shape: 'box', fromCount: false, claimed: true, lastSeen: -1, windows: [], noWindow: false, name: 'Landing' };
      spec.rooms.push(l);
      spec.assumed.push(`${l.id}|I added a landing for the stairs to arrive on and the rooms upstairs to open off`);
    }
  }
  for (const [st, list] of [...Array(nStoreys).keys()].map((st) => [st, spec.rooms.filter((r) => r.storey === st)] as const)) {
    if (list.length > LIMITS.rooms) {
      const cut = list.slice(LIMITS.rooms);
      spec.rooms = spec.rooms.filter((r) => !cut.includes(r));
      spec.cannot.push(`a floor plan holds at most ${LIMITS.rooms} rooms, so ${cut.map((r) => r.name).join(', ')} on the ${STOREY_NAMES[st]!.toLowerCase()} ${cut.length > 1 ? 'are' : 'is'} left out`);
    }
  }
  sizeRooms(spec, nStoreys);
  const storeys: Storey[] = [];
  const walkways: string[] = [];
  const summary: string[] = [];
  for (let st = 0; st < nStoreys; st++) {
    const placed = layoutStorey(spec, st);
    if (!placed.length) continue;
    const h = spec.ceilings.get(st) ?? spec.ceilings.get(-1) ?? DEFAULTS.h;
    const rooms: RoomShape[] = placed.map((p) => ({ id: p.spec.id, name: p.spec.name, poly: p.poly.map(([x, y]): Pt => [r1(x), r1(y)]) }));
    const openings: Opening[] = [];
    placeDoors(spec, st, placed, rooms, openings, h);
    placeWindows(spec, placed, rooms, openings, h);
    const items = placeFurniture(spec, nStoreys, placed, rooms, openings, h, walkways);
    storeys.push({ name: nStoreys > 1 ? STOREY_NAMES[st]! : 'The home', rooms, openings, items, h, wall: DEFAULTS.wall, north: spec.north });
  }
  if (!spec.ceilings.size) spec.assumed.push(`ceilings ${lengthText(DEFAULTS.h, spec.unit)}: you didn't say`);
  // the words' own room ids become names, and "%size%" the size drawn
  const named = (line: string) => {
    const m = line.match(/^([a-z_]+\d+_*)\|(.*)$/);
    if (!m) return line;
    const st = storeys.flatMap((s) => s.rooms).find((r) => r.id === m[1]);
    const spec2 = spec.rooms.find((r) => r.id === m[1]);
    const b = st ? bounds(st.poly) : null;
    const body = m[2]!.replace('%size%', b ? sizeText(b.w, b.h, spec.unit) : '').replace(/\b(?:off|next to) ([a-z_]+\d+_*)\b/g, (x, id: string) => x.replace(id, spec.rooms.find((r) => r.id === id)?.name ?? id));
    return `${spec2?.name ?? m[1]}: ${body}`;
  };
  for (const q of spec.rels) if (q.assumed) spec.assumed.push(q.assumed);
  const GROUPS: Record<string, string> = {
    size: "sizes I chose (you didn't say)",
    oneside: 'you gave one side, so I chose the other',
    door: "doors I added so every room can be reached (you didn't say how you get in)",
    window: "a window I added on an outside wall (you didn't mention one)",
    furn: "furniture at the usual UK size (you didn't give one)",
  };
  const grouped = new Map<string, string[]>();
  const nameOf = (id: string) => spec.rooms.find((r) => r.id === id)?.name ?? id;
  for (const line of spec.assumed) {
    const g = line.match(/^@(\w+)\|(?:([a-z_]+\d+_*)\|)?(.*)$/);
    if (!g) continue;
    const st = g[2] ? storeys.flatMap((s) => s.rooms).find((r) => r.id === g[2]) : undefined;
    const b = st ? bounds(st.poly) : null;
    const value = `${g[2] ? nameOf(g[2]) : ''} ${g[3]!.replace('%size%', b ? sizeText(b.w, b.h, spec.unit) : '').replace(/\boff ([a-z_]+\d+_*)\b/, (_, id: string) => `off ${nameOf(id)}`)}`.trim();
    grouped.set(g[1]!, [...(grouped.get(g[1]!) ?? []), value]);
  }
  const groupLines = [...grouped].map(([k, v]) => `${GROUPS[k] ?? k}: ${[...new Set(v)].join(', ')}`);
  const assumed = [...groupLines, ...new Set(spec.assumed.filter((l) => !l.startsWith('@')).map(named))];
  const cannot = [...new Set(spec.cannot.map(named))];
  for (const s of storeys) summary.push(...describeStorey(s, spec.unit, nStoreys > 1));
  if (spec.rooms.some((r) => r.approx)) assumed.push('sizes you gave roughly ("about…") are drawn as you said them');
  return { unit: spec.unit, storeys, summary, assumed, cannot, walkways };
}

// ------------------------------------------------------------------ doors and windows

/** Two openings on the same line of wall that overlap (one each side of a shared wall counts). */
function clashOnLine(rooms: RoomShape[], all: Opening[], op: Opening): boolean {
  const room = rooms.find((r) => r.id === op.room)!;
  const a = openingSpan(room, op);
  for (const o of all) {
    if (o.id === op.id) continue;
    const r = rooms.find((x) => x.id === o.room);
    if (!r) continue;
    const b = openingSpan(r, o);
    // on the same line?
    const cross = (p: Pt) => Math.abs((p[0] - a.p0[0]) * a.edge.uy - (p[1] - a.p0[1]) * a.edge.ux);
    if (cross(b.p0) > 1 || cross(b.p1) > 1) continue;
    const along = (p: Pt) => (p[0] - a.p0[0]) * a.edge.ux + (p[1] - a.p0[1]) * a.edge.uy;
    const s0 = Math.min(along(b.p0), along(b.p1));
    const s1 = Math.max(along(b.p0), along(b.p1));
    if (s0 < op.w + 5 && s1 > -5) return true;
  }
  return false;
}

/** Two door swings in the same room that hit each other. */
function swingsClash(rooms: RoomShape[], all: Opening[], op: Opening): boolean {
  const room = rooms.find((r) => r.id === op.room)!;
  const s = doorSwing(room, op);
  if (!s) return false;
  return all.some((o) => {
    if (o.id === op.id || o.type !== 'door') return false;
    const r = rooms.find((x) => x.id === o.room);
    const t = r ? doorSwing(r, o) : null;
    return !!t && rectOverlap(s.box, t.box, 1);
  });
}

/** Put an opening on a stretch of wall: near an end for a door (furniture keeps the rest), the middle for a window; null when it does not fit. */
function fitOpening(rooms: RoomShape[], all: Opening[], h: number, base: Omit<Opening, 'at' | 'hinge'>, span: WallSpan, prefer: 'end' | 'middle'): Opening | null {
  const room = rooms.find((r) => r.id === base.room)!;
  const len = span.to - span.from;
  const w = Math.min(base.w, Math.floor(len - 10));
  if (w < (base.type === 'door' ? DOOR_MIN : 40)) return null;
  const lo = span.from + 5;
  const hi = span.to - w - 5;
  const mid = (span.from + span.to - w) / 2;
  const spots = prefer === 'end' ? [lo + 5, hi - 5, lo, hi, mid] : [mid];
  for (let a = lo; a <= hi; a += 10) spots.push(a);
  for (const at0 of spots) {
    const at = Math.round(Math.max(lo, Math.min(hi, at0)) * 10) / 10;
    const hinge: Opening['hinge'] = base.type === 'door' && at - span.from > span.to - (at + w) ? 'end' : 'start';
    const op: Opening = { ...base, w, at, hinge };
    if (openingProblem(room, op, all, h)) continue;
    if (clashOnLine(rooms, all, op)) continue;
    if (op.type === 'door' && swingsClash(rooms, all, op)) continue;
    return op;
  }
  return null;
}

const nextId = (all: Opening[], type: 'door' | 'window') => {
  let n = all.filter((o) => o.type === type).length + 1;
  while (all.some((o) => o.id === `${type[0]}${n}`)) n++;
  return `${type[0]}${n}`;
};

/** Doors: the front door first (where the 3-D walk starts), then those the words ask for, then enough for every room to be reached. */
function placeDoors(spec: HomeSpec, st: number, placed: Placed[], rooms: RoomShape[], all: Opening[], h: number): void {
  const name = (id: string) => placed.find((p) => p.spec.id === id)?.spec.name ?? id;
  const shape = (id: string) => rooms.find((r) => r.id === id);
  const outside = (id: string) => outsideWalls(shape(id)!, rooms);
  const sideOfSpan = (room: RoomShape, sp: WallSpan): Side => {
    const e = edgeOf(room.poly, sp.wall);
    return sideOfNormal(e.nx, e.ny);
  };
  const outsideDoor = (id: string, kind: DoorReq['kind'], w: number | undefined, side: WallWord | undefined): Opening | null => {
    const room = shape(id);
    if (!room) return null;
    const want: Side | undefined = side && SIDES.includes(side as Side) ? (side as Side) : kind === 'front' ? 'bottom' : 'top';
    const spans = outside(id).sort((a, b) => Number(sideOfSpan(room, b) === want) - Number(sideOfSpan(room, a) === want) || b.to - b.from - (a.to - a.from));
    const width = w ?? (kind === 'front' ? 90 : kind === 'patio' ? 150 : DOOR_W);
    for (const sp of spans) {
      const op = fitOpening(rooms, all, h, { id: nextId(all, 'door'), type: 'door', room: id, wall: sp.wall, w: width, h: DEFAULTS.door.h, sill: 0, swing: 'in' }, sp, kind === 'patio' ? 'middle' : 'end');
      if (op) {
        all.push(op);
        return op;
      }
    }
    return null;
  };
  const here = (id: string) => placed.some((p) => p.spec.id === id);
  // outside doors the words ask for (a door with no room named goes on the hall, else the main room)
  const pref = ['hall', 'landing', 'porch', 'living', 'kitchen', 'dining', 'room'];
  const rk = (k: string) => (pref.includes(k) ? pref.indexOf(k) : k === 'garage' ? 99 : 50);
  const fallbackRoom = [...placed].sort((a, b) => rk(a.spec.kind) - rk(b.spec.kind))[0]!.spec.id;
  const asked = spec.doors.filter((d) => !d.b && (d.a ? here(d.a) : st === 0)).sort((a, b) => Number(b.kind === 'front') - Number(a.kind === 'front'));
  for (const d of asked) {
    const id = d.a || (d.kind === 'front' ? fallbackRoom : placed.find((p) => ['living', 'kitchen', 'dining'].includes(p.spec.kind))?.spec.id ?? fallbackRoom);
    if (!outsideDoor(id, d.kind, d.w, d.side)) spec.cannot.push(`${name(id)} has no outside wall with room for the ${d.kind === 'front' ? 'front door' : d.kind === 'patio' ? 'patio doors' : 'outside door'}`);
    else if (d.kind === 'patio') spec.cannot.push('patio and French doors are drawn as one wide door');
  }
  if (st === 0 && !asked.some((d) => d.kind === 'front')) {
    const porch = placed.find((p) => p.spec.kind === 'porch')?.spec.id;
    const id = porch ?? fallbackRoom;
    const lone = placed.length === 1 && !HUBS.has(placed[0]!.spec.kind);
    if (outsideDoor(id, lone ? 'door' : 'front', lone ? DOOR_W : undefined, lone ? 'bottom' : undefined)) spec.assumed.push(lone ? `${id}|its door is on the front (bottom) wall: you didn't say where it is` : `${id}|the front door is here: you didn't say where it is`);
    else spec.cannot.push(`there was no outside wall for a front door`);
  }
  // doors between rooms
  const owner = (a: string, b: string): [string, string] => {
    const pa = placed.find((p) => p.spec.id === a)!;
    const pb = placed.find((p) => p.spec.id === b)!;
    if (HUBS.has(pa.spec.kind)) return [b, a];
    if (HUBS.has(pb.spec.kind)) return [a, b];
    return polyArea(pa.poly) <= polyArea(pb.poly) ? [a, b] : [b, a];
  };
  const linked = new Set<string>();
  const key = (a: string, b: string) => [a, b].sort().join('|');
  const between = (a: string, b: string, w: number, open: boolean): boolean => {
    if (linked.has(key(a, b))) return true;
    const [o, other] = owner(a, b);
    const ro = shape(o);
    const rt = shape(other);
    if (!ro || !rt) return false;
    const spans = sharedWalls(ro.poly, rt.poly).sort((x, y) => y.to - y.from - (x.to - x.from));
    for (const sp of spans) {
      const op = fitOpening(rooms, all, h, { id: nextId(all, 'door'), type: 'door', room: o, wall: sp.wall, w: open ? Math.min(180, sp.to - sp.from - 10) : w, h: DEFAULTS.door.h, sill: 0, swing: 'in' }, sp, open ? 'middle' : 'end');
      if (op) {
        all.push(op);
        linked.add(key(a, b));
        return true;
      }
    }
    return false;
  };
  for (const q of spec.rels.filter((x) => x.door && here(x.a) && here(x.b))) {
    const w = spec.doors.find((d) => d.b && ((d.a === q.a && d.b === q.b) || (d.a === q.b && d.b === q.a)))?.w ?? DOOR_W;
    if (!between(q.a, q.b, w, q.open)) spec.cannot.push(`there is no shared wall long enough for a door between ${name(q.a)} and ${name(q.b)}`);
    else if (q.open) spec.cannot.push(`open plan: the planner has no wall-less openings yet, so ${name(q.a)} and ${name(q.b)} are joined by a wide doorway`);
  }
  // every room reachable: from the front door downstairs, from the landing (or the first room) upstairs
  const ids = placed.map((p) => p.spec.id);
  const start = st === 0 ? all.find((o) => o.type === 'door' && !rooms.some((r) => r.id !== o.room && sharedWalls(shape(o.room)!.poly, r.poly).some((s) => s.wall === o.wall && o.at >= s.from - 1 && o.at + o.w <= s.to + 1)))?.room ?? fallbackRoom : placed.find((p) => HUBS.has(p.spec.kind))?.spec.id ?? ids[0]!;
  const reach = () => {
    const seen = new Set([start]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const k of linked) {
        const [a, b] = k.split('|') as [string, string];
        if (seen.has(a) !== seen.has(b)) {
          seen.add(a);
          seen.add(b);
          grew = true;
        }
      }
    }
    return seen;
  };
  const rank = (id: string) => {
    const k = placed.find((p) => p.spec.id === id)!.spec.kind;
    return HUBS.has(k) ? 0 : k === 'living' ? 1 : k === 'kitchen' ? 2 : k === 'dining' ? 3 : k === 'bed' ? 5 : 4;
  };
  for (let guard = 0; guard < ids.length * 2; guard++) {
    const seen = reach();
    const lost = ids.filter((id) => !seen.has(id));
    if (!lost.length) break;
    let done = false;
    for (const id of lost.sort((a, b) => placed.findIndex((p) => p.spec.id === a) - placed.findIndex((p) => p.spec.id === b))) {
      const me = placed.find((p) => p.spec.id === id)!;
      const wantBed = ['ensuite', 'dressing'].includes(me.spec.kind);
      const opts = ids.filter((o) => seen.has(o) && sharedLen(me.poly, placed.find((p) => p.spec.id === o)!.poly) >= DOOR_MIN + 10).sort((a, b) => (wantBed ? Number(placed.find((p) => p.spec.id === b)!.spec.kind === 'bed') - Number(placed.find((p) => p.spec.id === a)!.spec.kind === 'bed') : 0) || rank(a) - rank(b));
      for (const o of opts) {
        if (between(id, o, DOOR_W, false)) {
          spec.assumed.push(`@door|${id}|off ${o}`);
          done = true;
          break;
        }
      }
      if (done) break;
    }
    if (!done) {
      for (const id of lost) spec.cannot.push(`${name(id)} shares no wall with the rooms you can reach, so it has no door`);
      break;
    }
  }
}

/** Windows: those the words ask for, else one in each room that usually has one, on an outside wall. */
function placeWindows(spec: HomeSpec, placed: Placed[], rooms: RoomShape[], all: Opening[], h: number): void {
  for (const p of placed) {
    const room = rooms.find((r) => r.id === p.spec.id)!;
    const k = KIND.get(p.spec.kind);
    let reqs = p.spec.windows.filter((w) => !w.ref);
    if (!reqs.length && !p.spec.noWindow && (k?.window || p.spec.windows.some((w) => w.ref))) {
      reqs = [{ n: 1, ref: false, said: '', w: ['bath', 'ensuite'].includes(p.spec.kind) ? 60 : p.spec.kind === 'conservatory' ? 200 : undefined }];
      if (k?.window && !p.spec.windows.length) spec.assumed.push(`@window|${p.spec.id}|`);
    }
    if (!reqs.length) continue;
    const spans = outsideWalls(room, rooms).filter((s) => s.to - s.from >= 50);
    if (!spans.length) {
      spec.cannot.push(`${p.spec.name} has no outside wall, so it has no window`);
      continue;
    }
    const sideOf = (sp: WallSpan) => {
      const e = edgeOf(room.poly, sp.wall);
      return sideOfNormal(e.nx, e.ny);
    };
    for (const req of reqs) {
      const small = ['bath', 'ensuite', 'wc'].includes(p.spec.kind);
      const wh = req.h ?? (req.sill === 10 ? h - 30 : small ? 90 : DEFAULTS.window.h);
      const sill = req.sill ?? (small ? Math.min(110, h - wh - 10) : Math.min(DEFAULTS.window.sill, h - wh - 10));
      const want = req.side && SIDES.includes(req.side as Side) ? (req.side as Side) : undefined;
      let order = [...spans].sort((a, b) => b.to - b.from - (a.to - a.from));
      if (want) {
        const match = order.filter((sp) => sideOf(sp) === want);
        if (!match.length) spec.cannot.push(`${p.spec.name}'s ${want === 'top' ? 'back' : want === 'bottom' ? 'front' : want} wall is not an outside wall, so its window went on another wall`);
        order = [...match, ...order.filter((sp) => sideOf(sp) !== want)];
      }
      let left = Math.min(req.n, 6);
      for (const sp of order) {
        if (!left) break;
        // n windows on one wall: each in its own equal share of it
        const n = Math.max(1, Math.min(left, Math.floor((sp.to - sp.from) / ((req.w ?? DEFAULTS.window.w) + 30))));
        const share = (sp.to - sp.from) / n;
        for (let i = 0; i < n; i++) {
          const piece = { wall: sp.wall, from: sp.from + i * share, to: sp.from + (i + 1) * share };
          const op = fitOpening(rooms, all, h, { id: nextId(all, 'window'), type: 'window', room: room.id, wall: sp.wall, w: Math.min(req.w ?? DEFAULTS.window.w, piece.to - piece.from - 10), h: wh, sill, swing: 'in' }, piece, 'middle');
          if (op) {
            all.push(op);
            left--;
          }
        }
      }
      if (left) spec.cannot.push(`${p.spec.name}: ${left} of the windows you asked for did not fit on its outside walls`);
    }
  }
}

// ------------------------------------------------------------------ furniture

/** Quarter turn for a piece whose back is against a wall facing `side` (its front looks into the room). */
const ROT: Record<Side, number> = { top: 0, right: 90, bottom: 180, left: 270 };
const quarter = (rot: number) => (((Math.round(rot / 90) % 4) + 4) % 4) as 0 | 1 | 2 | 3;
const gapBetween = (a: Rect, b: Rect): number | null => {
  const yShare = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  const xShare = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  if (yShare >= 30) return Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
  if (xShare >= 30) return Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
  return null;
};
/** The strip of floor in front of a piece (rot: its back against the top wall at 0). */
function front(r: Rect, rot: number, depth: number): Rect {
  const q = quarter(rot);
  if (q === 0) return { x: r.x, y: r.y + r.h, w: r.w, h: depth };
  if (q === 1) return { x: r.x - depth, y: r.y, w: depth, h: r.h };
  if (q === 2) return { x: r.x, y: r.y - depth, w: r.w, h: depth };
  return { x: r.x + r.w, y: r.y, w: depth, h: r.h };
}

interface Spot {
  r: Rect;
  rot: number;
  /** The wall its back is against, if any. */
  wall?: number;
}

/** Pieces that belong together (they may stand closer than a walkway). */
const partners = (a: string, b: string) => {
  const pair = (x: string, y: string) => (a === x && y === b) || (a === y && b === x);
  return pair('bedside', 'double') || pair('bedside', 'single') || pair('bedside', 'king') || pair('coffee', 'sofa3') || pair('coffee', 'sofa2') || pair('coffee', 'sofa4') || pair('coffee', 'sofa') || pair('coffee', 'armchair') || (KITCHEN_RUN.has(a) && KITCHEN_RUN.has(b)) || (BATH_RUN.has(a) && BATH_RUN.has(b)) || a === b;
};

/** Furniture into its rooms: against the walls the words name, kept inside, off each other, out of door swings and doorways; tight gaps flagged. */
function placeFurniture(spec: HomeSpec, nStoreys: number, placed: Placed[], rooms: RoomShape[], openings: Opening[], h: number, walkways: string[]): PlanItem[] {
  const out: (PlanItem & { _rect: Rect; _room: string; _kind: string })[] = [];
  const reqs = spec.items.filter((i) => placed.some((p) => p.spec.id === i.room));
  // the stairs between storeys: in the hall or on the landing, else the main room
  if (nStoreys > 1 && !spec.items.some((i) => i.kind.kind === 'stairs' && placed.some((p) => p.spec.id === i.room))) {
    const where = placed.find((p) => HUBS.has(p.spec.kind)) ?? placed.find((p) => p.spec.kind === 'living') ?? placed[0]!;
    const kind = ITEMS.find((k) => k.kind === 'stairs')!;
    reqs.push({ kind, room: where.spec.id, w: kind.w, d: kind.d, h, sizeSaid: false, hint: { said: '' }, order: -1 });
    spec.assumed.push(`${where.spec.id}|the stairs are drawn here as a ${itemSize(kind.w, kind.d, spec.unit)} block (line the floors up in the planner)`);
  }
  const prio = (q: ItemReq) => (q.hint.wall || q.hint.under || q.hint.centre || q.hint.corner ? 0 : 1) * 10 + (['bedside', 'coffee', 'tv'].includes(q.kind.place) ? 2 : 0);
  const order = [...reqs].sort((a, b) => prio(a) - prio(b) || b.w * b.d - a.w * a.d || a.order - b.order);
  const doorBoxes = (roomId: string): Rect[] => {
    const room = rooms.find((r) => r.id === roomId)!;
    const boxes: Rect[] = [];
    for (const o of openings) {
      if (o.type !== 'door') continue;
      const owner = rooms.find((r) => r.id === o.room)!;
      const { p0, p1, edge } = openingSpan(owner, o);
      // the doorway itself, 70 cm into whichever room is on each side of it
      for (const k of [1, -1]) {
        const q0: Pt = [p0[0] + edge.nx * k * WALKWAY, p0[1] + edge.ny * k * WALKWAY];
        const q1: Pt = [p1[0] + edge.nx * k * WALKWAY, p1[1] + edge.ny * k * WALKWAY];
        const b = bounds([p0, p1, q0, q1]);
        const mid: Pt = [b.x + b.w / 2, b.y + b.h / 2];
        if (rectInPoly({ x: mid[0] - 0.5, y: mid[1] - 0.5, w: 1, h: 1 }, room.poly)) boxes.push(b);
      }
    }
    return boxes;
  };
  const swings = openings.filter((o) => o.type === 'door').map((o) => {
    const room = rooms.find((x) => x.id === o.room)!;
    return { o, room, box: doorSwing(room, o)!.box };
  });
  const doorsOf = new Map(rooms.map((r) => [r.id, doorBoxes(r.id)]));
  for (const q of order) {
    const room = rooms.find((r) => r.id === q.room)!;
    const inRoom = out.filter((o) => o._room === room.id);
    const doors = doorsOf.get(room.id)!;
    const wins = openings.filter((o) => o.type === 'window' && o.room === room.id);
    const isTall = (hgt: number, o: Opening) => hgt > o.sill;
    const winZone = (o: Opening): Rect => {
      const { p0, p1, edge } = openingSpan(room, o);
      return bounds([p0, p1, [p0[0] - edge.nx * 40, p0[1] - edge.ny * 40], [p1[0] - edge.nx * 40, p1[1] - edge.ny * 40]]);
    };
    // the cheap tests first; a door's swing is worked out once, its arc tested only inside its box
    const tallWins = wins.filter((o) => isTall(q.h, o)).map(winZone);
    const ok = (r: Rect) => {
      if (inRoom.some((o) => rectOverlap(o._rect, r, 0.5))) return false;
      if (doors.some((b) => rectOverlap(b, r, 0.5))) return false;
      if (tallWins.some((z) => rectOverlap(z, r, 0.5))) return false;
      if (swings.some((sw) => rectOverlap(sw.box, r, 1) && inSwing(sw.room, sw.o, r))) return false;
      return rectInPoly(r, room.poly);
    };
    const spots: Spot[] = [];
    const lens = room.poly.map((_, i) => edgeOf(room.poly, i).len);
    const longest = Math.max(...lens);
    const shortest = Math.min(...lens);
    // against each wall, sliding along it
    for (let i = 0; i < room.poly.length; i++) {
      const e = edgeOf(room.poly, i);
      if (Math.abs(e.ux) > 1e-6 && Math.abs(e.uy) > 1e-6) continue;
      const side = sideOfNormal(e.nx, e.ny);
      const rot = ROT[side];
      const fw = quarter(rot) % 2 ? q.d : q.w;
      const fh = quarter(rot) % 2 ? q.w : q.d;
      const step = e.len > 800 ? 10 : 5;
      for (let s = 0; s <= e.len + 0.01; s += step) {
        const px = e.a[0] + e.ux * s;
        const py = e.a[1] + e.uy * s;
        // the footprint's back on the wall, running along it from this point
        let r: Rect;
        if (side === 'top') r = { x: px, y: py, w: fw, h: fh };
        else if (side === 'bottom') r = { x: px - fw, y: py - fh, w: fw, h: fh };
        else if (side === 'right') r = { x: px - fw, y: py, w: fw, h: fh };
        else r = { x: px, y: py - fh, w: fw, h: fh };
        spots.push({ r, rot, wall: i });
      }
    }
    // free standing, across the floor
    if (['centre', 'coffee'].includes(q.kind.place) || q.hint.centre || q.kind.place === 'tv' || q.kind.place === 'bedside') {
      const b = bounds(room.poly);
      const step = Math.max(5, Math.ceil(Math.sqrt((b.w * b.h) / 4000) / 5) * 5);
      for (const rot of [0, 90]) {
        const fw = rot ? q.d : q.w;
        const fh = rot ? q.w : q.d;
        for (let y = b.y; y + fh <= b.y + b.h + 0.01; y += step) for (let x = b.x; x + fw <= b.x + b.w + 0.01; x += step) spots.push({ r: { x, y, w: fw, h: fh }, rot });
      }
    }
    const anchorOf = (kinds: string[]) => inRoom.find((o) => kinds.includes(o._kind));
    const sofa = anchorOf(['sofa', 'sofa2', 'sofa3', 'sofa4']) ?? anchorOf(['armchair']);
    const bed = anchorOf(['double', 'single', 'king']);
    const centre: Pt = [bounds(room.poly).x + bounds(room.poly).w / 2, bounds(room.poly).y + bounds(room.poly).h / 2];
    const cOf = (r: Rect): Pt => [r.x + r.w / 2, r.y + r.h / 2];
    const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const wallSide = (i: number) => {
      const e = edgeOf(room.poly, i);
      return sideOfNormal(e.nx, e.ny);
    };
    // the walls with a door in them, this room's own or the room next door's
    const doorWallList: number[] = [];
    for (const o of openings) {
      if (o.type !== 'door') continue;
      if (o.room === room.id) {
        doorWallList.push(o.wall);
        continue;
      }
      const mid = openingSpan(rooms.find((r) => r.id === o.room)!, o).mid;
      for (let i = 0; i < room.poly.length; i++) {
        const e = edgeOf(room.poly, i);
        const along = (mid[0] - e.a[0]) * e.ux + (mid[1] - e.a[1]) * e.uy;
        const across = Math.abs((mid[0] - e.a[0]) * e.nx + (mid[1] - e.a[1]) * e.ny);
        if (across < 1 && along > 0 && along < e.len) doorWallList.push(i);
      }
    }
    const doorWalls = new Set(doorWallList);
    // the far wall: facing the first door, the furthest from it
    const farWall = (() => {
      const dw = doorWallList[0];
      if (dw === undefined) return -1;
      const d = edgeOf(room.poly, dw);
      let best2 = -1;
      let far = -Infinity;
      for (let i = 0; i < room.poly.length; i++) {
        const e = edgeOf(room.poly, i);
        if (e.nx * d.nx + e.ny * d.ny > -0.99) continue;
        const gap2 = Math.abs((e.a[0] - d.a[0]) * d.nx + (e.a[1] - d.a[1]) * d.ny);
        if (gap2 > far) {
          far = gap2;
          best2 = i;
        }
      }
      return best2;
    })();
    const outsideSet = outsideWalls(room, rooms);
    let best: { s: Spot; score: number } | null = null;
    for (const sp of spots) {
      if (!ok(sp.r)) continue;
      let score = 0;
      const c = cOf(sp.r);
      const hint = q.hint;
      const place = q.kind.place;
      // what the words asked for
      if (hint.wall && sp.wall !== undefined) {
        const len = lens[sp.wall]!;
        const side = wallSide(sp.wall);
        const want = hint.wall;
        const hit = want === 'any' || want === side || (want === 'long' && len >= longest - 5) || (want === 'short' && len <= shortest + 5) || (want === 'far' && sp.wall === farWall) || (want === 'door' && doorWalls.has(sp.wall)) || (want === 'window' && wins.some((o) => o.wall === sp.wall)) || (want === 'outside' && outsideSet.some((o) => o.wall === sp.wall)) || (want === 'inside' && !outsideSet.some((o) => o.wall === sp.wall));
        score += hit ? 200 : 0;
      } else if (hint.wall && sp.wall === undefined) score -= 100;
      if (hint.under || hint.byWindow) {
        const w = wins.map((o) => openingSpan(room, o).mid).sort((a, b) => dist(a, c) - dist(b, c))[0];
        if (w) score += 200 - dist(w, c) / 2 + (hint.under && sp.wall !== undefined && wins.some((o) => o.wall === sp.wall) ? 60 : 0);
      }
      if (hint.centre) score += 150 - dist(c, centre) / 2;
      if (hint.corner || place === 'corner') {
        const b = sp.r;
        const touching = [
          rectInPoly({ x: b.x - 2, y: b.y, w: b.w, h: b.h }, room.poly),
          rectInPoly({ x: b.x + 2, y: b.y, w: b.w, h: b.h }, room.poly),
          rectInPoly({ x: b.x, y: b.y - 2, w: b.w, h: b.h }, room.poly),
          rectInPoly({ x: b.x, y: b.y + 2, w: b.w, h: b.h }, room.poly),
        ].filter((x) => !x).length;
        score += touching >= 2 ? (hint.corner ? 150 : 40) : 0;
      }
      if (hint.beside) {
        const target = inRoom.find((o) => o._kind === hint.beside || (hint.beside === 'bed' && BEDS.has(o._kind)) || (hint.beside === 'sofa' && /^sofa/.test(o._kind)));
        if (target) score += 150 - dist(cOf(target._rect), c) / 2;
      }
      if (hint.foot && bed) score += 150 - dist(cOf(front(bed._rect, bed.rot ?? 0, 60)), c) / 2;
      if (hint.opposite) {
        const target = inRoom.find((o) => o._kind === hint.opposite || (hint.opposite === 'sofa' && /^sofa/.test(o._kind)) || (hint.opposite === 'bed' && BEDS.has(o._kind)));
        if (target) score += (quarter(sp.rot) === quarter((target.rot ?? 0) + 180) ? 120 : 0) - dist(cOf(target._rect), c) / 4;
      }
      // the usual places, when the words don't say
      if (place === 'wall' || place === 'run' || place === 'corner' || place === 'window' || place === 'fire') score += sp.wall !== undefined ? 40 : -200;
      if (/^sofa/.test(q.kind.kind) && sp.wall !== undefined) score += (lens[sp.wall]! >= longest - 5 ? 30 : 0) - Math.abs(edgeAlong(room, sp) - lens[sp.wall]! * 0.5) / 20 - (doorWalls.has(sp.wall) ? 20 : 0);
      if (BEDS.has(q.kind.kind) && q.kind.kind !== 'cot' && sp.wall !== undefined) {
        score -= Math.abs(edgeAlong(room, sp) - lens[sp.wall]! * 0.5) / 10;
        score -= doorWalls.has(sp.wall) ? 15 : 0;
        const sides = [rectSide(sp.r, sp.rot, -60), rectSide(sp.r, sp.rot, 60)].filter((r) => rectInPoly(r, room.poly) && !inRoom.some((o) => rectOverlap(o._rect, r, 0.5))).length;
        score += sides * 25;
      }
      if (place === 'fire' && sp.wall !== undefined) score -= Math.abs(edgeAlong(room, sp) - lens[sp.wall]! * 0.5) / 5;
      if (place === 'window' && !hint.wall) {
        const w = wins.map((o) => openingSpan(room, o).mid).sort((a, b) => dist(a, c) - dist(b, c))[0];
        if (w) score += 80 - dist(w, c) / 4;
      }
      if (place === 'run') {
        const touchingRun = inRoom.some((o) => (KITCHEN_RUN.has(o._kind) && KITCHEN_RUN.has(q.kind.kind)) || (BATH_RUN.has(o._kind) && BATH_RUN.has(q.kind.kind)) ? Math.abs(gapBetween(o._rect, sp.r) ?? 99) < 1 : false);
        score += touchingRun ? 50 : 0;
        if (q.kind.kind === 'sink' && sp.wall !== undefined && wins.some((o) => o.wall === sp.wall)) score += 40;
      }
      if (place === 'centre' && !hint.centre) score += 100 - dist(c, centre) / 2;
      if (place === 'coffee' && sofa) {
        const f = front(sofa._rect, sofa.rot ?? 0, 45 + (quarter(sofa.rot ?? 0) % 2 ? q.d : q.d) / 2);
        const target: Pt = quarter(sofa.rot ?? 0) === 0 ? [cOf(sofa._rect)[0], f.y + f.h] : quarter(sofa.rot ?? 0) === 2 ? [cOf(sofa._rect)[0], f.y] : quarter(sofa.rot ?? 0) === 1 ? [f.x, cOf(sofa._rect)[1]] : [f.x + f.w, cOf(sofa._rect)[1]];
        score += 150 - dist(c, target) + (quarter(sp.rot) % 2 === quarter(sofa.rot ?? 0) % 2 ? 20 : 0);
      } else if (place === 'coffee') score += 100 - dist(c, centre) / 2;
      if (place === 'tv') {
        if (sofa && !hint.wall) score += (sp.wall !== undefined && quarter(sp.rot) === quarter((sofa.rot ?? 0) + 180) ? 150 : 0) - dist(cOf(sofa._rect), c) / 20 - Math.abs(quarter(sofa.rot ?? 0) % 2 ? c[1] - cOf(sofa._rect)[1] : c[0] - cOf(sofa._rect)[0]) / 3;
        score += sp.wall !== undefined ? 30 : -100;
      }
      if (place === 'bedside') {
        if (bed) {
          const lr = [rectSide(bed._rect, bed.rot ?? 0, -q.w - 2), rectSide(bed._rect, bed.rot ?? 0, q.w + 2)].filter((r) => !inRoom.some((o) => o._kind === 'bedside' && rectOverlap(o._rect, r, 0.5)));
          if (lr.length) score += 200 - Math.min(...lr.map((r) => dist(cOf(r), c))) / 2 + (quarter(sp.rot) === quarter(bed.rot ?? 0) ? 20 : 0);
        }
        score += sp.wall !== undefined ? 20 : 0;
      }
      if (place === 'wall' && /^armchair/.test(q.kind.kind) && sofa) score -= dist(cOf(sofa._rect), c) / 10;
      if (q.kind.kind === 'stairs' && sp.wall !== undefined) score -= doorWalls.has(sp.wall) ? 30 : 0;
      // walkways and the floor in front of other pieces
      for (const o of inRoom) {
        if (partners(o._kind, q.kind.kind)) continue;
        const g = gapBetween(o._rect, sp.r);
        if (g !== null && g > 0.5 && g < WALKWAY) score -= 60;
        if (rectOverlap(front(o._rect, o.rot ?? 0, 60), sp.r, 0.5)) score -= 80;
        if (BEDS.has(o._kind) && q.kind.kind !== 'bedside' && [rectSide(o._rect, o.rot ?? 0, -60), rectSide(o._rect, o.rot ?? 0, 60)].some((x) => rectOverlap(x, sp.r, 0.5))) score -= 80;
        if (sp.wall !== undefined && rectOverlap(front(sp.r, sp.rot, 60), o._rect, 0.5)) score -= 40;
      }
      if (!best || score > best.score + 1e-9) best = { s: sp, score };
    }
    if (!best) {
      spec.cannot.push(`${room.name}: the ${spoken(q.kind.name)} (${itemSize(q.w, q.d, spec.unit)}) did not fit${q.sizeSaid ? '' : ' at its usual size'} — clear of the doors${q.h > 90 ? ', windows' : ''} and the other furniture`);
      continue;
    }
    const { r, rot } = best.s;
    const side = quarter(rot) % 2 === 1;
    const x = side ? r.x + r.w / 2 - q.w / 2 : r.x;
    const y = side ? r.y + r.h / 2 - q.d / 2 : r.y;
    const count = out.filter((o) => o.name.startsWith(q.kind.name)).length;
    const it = { id: `${q.kind.kind}${count + 1}_${room.id}`.slice(0, 24), kind: q.kind.kind, name: q.kind.name, w: r1(q.w), d: r1(q.d), h: r1(q.kind.kind === 'stairs' ? h : q.h), x: r1(x), y: r1(y), rot, _rect: r, _room: room.id, _kind: q.kind.kind };
    out.push(it);
    if (!q.sizeSaid && q.kind.kind !== 'stairs') spec.assumed.push(`@furn|${spoken(q.kind.name)} ${itemSize(q.w, q.d, spec.unit)}`);
    if (q.hint.wall && best.score < 150 && best.s.wall !== undefined) spec.cannot.push(`${room.name}: the ${spoken(q.kind.name)} could not go where you said (${q.hint.said}), so it went on another wall`);
  }
  // walkways under 70 cm between pieces that do not belong together
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      const a = out[i]!;
      const b = out[j]!;
      if (a._room !== b._room || partners(a._kind, b._kind)) continue;
      const g = gapBetween(a._rect, b._rect);
      if (g !== null && g > 0.5 && g < WALKWAY) walkways.push(`${rooms.find((r) => r.id === a._room)!.name}: ${a.name} and ${b.name} are ${Math.round(g)} cm apart, under the ${WALKWAY} cm people need to walk between furniture`);
    }
  }
  return out.map(({ _rect, _room, _kind, ...it }) => it);
}

/** How far along its wall a piece's middle is (cm from the wall's first corner). */
function edgeAlong(room: RoomShape, sp: Spot): number {
  const e = edgeOf(room.poly, sp.wall!);
  const c: Pt = [sp.r.x + sp.r.w / 2, sp.r.y + sp.r.h / 2];
  return (c[0] - e.a[0]) * e.ux + (c[1] - e.a[1]) * e.uy;
}

/** The floor beside a piece at its back end, |k| cm wide: on one side for k < 0, the other for k > 0 (a bed's two sides); k = 0 is the piece itself. */
function rectSide(r: Rect, rot: number, k: number): Rect {
  if (!k) return r;
  const q = quarter(rot);
  const wdt = Math.abs(k);
  if (q % 2 === 0) return k < 0 ? { x: r.x - wdt, y: r.y, w: wdt, h: Math.min(r.h, 60) } : { x: r.x + r.w, y: r.y, w: wdt, h: Math.min(r.h, 60) };
  return k < 0 ? { x: r.x, y: r.y - wdt, w: Math.min(r.w, 60), h: wdt } : { x: r.x, y: r.y + r.h, w: Math.min(r.w, 60), h: wdt };
}

// ------------------------------------------------------------------ words for the owner

/** Which wall a piece stands against, in words ("the top wall"), or "in the middle". */
function whereText(room: RoomShape, it: PlanItem): string {
  const r = itemRectOf(it);
  for (let i = 0; i < room.poly.length; i++) {
    const e = edgeOf(room.poly, i);
    const side = sideOfNormal(e.nx, e.ny);
    const back = side === 'top' ? r.y : side === 'bottom' ? r.y + r.h : side === 'left' ? r.x : r.x + r.w;
    const line = side === 'top' || side === 'bottom' ? e.a[1] : e.a[0];
    if (Math.abs(back - line) < 1.5 && quarter(it.rot ?? 0) === quarter(ROT[side])) return `on the ${side === 'top' ? 'top (back)' : side === 'bottom' ? 'bottom (front)' : side} wall`;
  }
  return 'in the middle of the floor';
}

const itemRectOf = (it: PlanItem): Rect => {
  const side = quarter(it.rot ?? 0) % 2 === 1;
  const fw = side ? it.d : it.w;
  const fh = side ? it.w : it.d;
  return { x: it.x + it.w / 2 - fw / 2, y: it.y + it.d / 2 - fh / 2, w: fw, h: fh };
};

/** The storey in plain lines: its floor area, then each room with its size, doors, windows and furniture. */
function describeStorey(s: Storey, unit: UnitSystem, named: boolean): string[] {
  const floor = s.rooms.reduce((a, r) => a + polyArea(r.poly), 0);
  const lines = [`${named ? s.name : 'The home'}: ${s.rooms.length} room${s.rooms.length === 1 ? '' : 's'}, ${areaText(floor)} of floor, ceilings ${lengthText(s.h, unit)}.`];
  for (const r of s.rooms) {
    const b = bounds(r.poly);
    const doors = s.openings.filter((o) => o.type === 'door' && (o.room === r.id || sharesOpening(s, r, o)));
    const to = doors.map((o) => {
      const other = o.room === r.id ? s.rooms.find((x) => x.id !== r.id && onWallOf(s, x, o)) : s.rooms.find((x) => x.id === o.room);
      return other ? other.name : 'outside';
    });
    const wins = s.openings.filter((o) => o.type === 'window' && o.room === r.id);
    const winText = wins.length ? `${wins.length} window${wins.length > 1 ? 's' : ''} (${[...new Set(wins.map((o) => sideOfNormal(edgeOf(r.poly, o.wall).nx, edgeOf(r.poly, o.wall).ny)))].map((x) => (x === 'top' ? 'back' : x === 'bottom' ? 'front' : x)).join(', ')})` : 'no window';
    const furn = s.items.filter((it) => rectInPoly(itemRectOf(it), r.poly, 1)).map((it) => `${it.name} ${whereText(r, it)}`);
    lines.push(`- ${r.name} ${sizeText(b.w, b.h, unit)}${r.poly.length > 4 ? ' (L-shaped)' : ''}, ${areaText(polyArea(r.poly))}: ${to.length ? `door${to.length > 1 ? 's' : ''} to ${[...new Set(to)].join(', ')}` : 'no door'}; ${winText}${furn.length ? `; ${furn.join(', ')}` : ''}.`);
  }
  return lines;
}

function onWallOf(s: Storey, room: RoomShape, o: Opening): boolean {
  const owner = s.rooms.find((r) => r.id === o.room);
  if (!owner || owner.id === room.id) return false;
  const { mid, edge } = openingSpan(owner, o);
  const probe: Pt = [mid[0] + edge.nx * 2, mid[1] + edge.ny * 2];
  return rectInPoly({ x: probe[0] - 0.5, y: probe[1] - 0.5, w: 1, h: 1 }, room.poly);
}
const sharesOpening = (s: Storey, room: RoomShape, o: Opening) => onWallOf(s, room, o);

// ------------------------------------------------------------------ the reply

/** One storey as Room JSON v2 for the planner's IMPORT and the 3D STUDIO; `level` cuts precision and optional fields to fit the reply, never a room. */
export function storeyJson(s: Storey, level = 0): Record<string, unknown> {
  const n = (v: number) => (level >= 1 ? Math.round(v) : r1(v));
  const b = bounds(s.rooms.flatMap((r) => r.poly));
  const json: Record<string, unknown> = { v: 2, room: { w: n(b.w), d: n(b.h), h: n(s.h) } };
  if (level < 1 || s.wall !== DEFAULTS.wall) json.wall = s.wall;
  if (level < 1 || s.north) json.north = s.north;
  // at the last level the rooms' ids are just r1, r2… (the doors and windows say which room by id)
  const rid = (id: string) => (level >= 3 ? `r${s.rooms.findIndex((r) => r.id === id) + 1}` : id);
  json.rooms = s.rooms.map((r) => ({ id: rid(r.id), name: r.name, poly: r.poly.map(([x, y]) => [n(x), n(y)]) }));
  json.openings = s.openings.map((o) => {
    const x: Record<string, unknown> = { ...(level < 3 ? { id: o.id } : {}), type: o.type, room: rid(o.room), wall: o.wall, at: n(o.at), w: n(o.w) };
    const dh = o.type === 'door' ? DEFAULTS.door.h : DEFAULTS.window.h;
    if (level < 1 || o.h !== dh) x.h = n(o.h);
    if (o.type === 'window' && (level < 1 || o.sill !== DEFAULTS.window.sill)) x.sill = n(o.sill);
    if (o.type === 'door' && (level < 1 || o.hinge !== 'start')) x.hinge = o.hinge;
    if (o.type === 'door' && (level < 1 || o.swing !== 'in')) x.swing = o.swing;
    return x;
  });
  json.items = level >= 4 ? [] : s.items.map((it) => {
    const x: Record<string, unknown> = {};
    if (level < 1) x.id = it.id;
    if (level < 2) x.kind = it.kind;
    x.name = it.name;
    x.w = n(it.w);
    x.d = n(it.d);
    if (level < 2) x.h = n(it.h ?? 75);
    // the floor it covers is what is rounded (a turned piece's corner may then sit on a half centimetre)
    const f = itemRectOf(it);
    x.x = n(f.x) + (f.w - it.w) / 2;
    x.y = n(f.y) + (f.h - it.d) / 2;
    if (level < 1 || it.rot) x.rot = it.rot ?? 0;
    return x;
  });
  return json;
}

/** The most a design_home reply may be: what the model is given of a tool's result (context.ts). */
export const REPLY_MAX = resultBudget('design_home');

/**
 * The reply for the model: the plan in plain lines, the assumptions, what could not be done, the
 * tight walkways, how to open it, then each storey's Room JSON. Kept within the budget by cutting
 * the JSON's precision and the summary's detail first, never a room: a storey whose plan cannot fit
 * is left out whole, with how to get it (the same words with `floor`: the same plan, that floor
 * only). `floor` gives one storey's plan alone.
 */
export function homeReply(p: HomePlan, budget = REPLY_MAX, floor?: number): string {
  const only = floor !== undefined ? p.storeys.filter((_, i) => i === floor) : p.storeys;
  const build = (detail: number, level: number, carry: number) => {
    const lines: string[] = ["HOME PLAN, worked out by code from the owner's words (every number is measured on the plan, not guessed by a model):"];
    const mine = (l: string) => floor === undefined || p.storeys.length < 2 || only.some((s) => l.startsWith(`${s.name}:`)) || !/^(?:Ground|First|Second) floor:/.test(l);
    let inFloor = true;
    const summary = p.summary.filter((l) => (/^- /.test(l) ? inFloor : (inFloor = mine(l))));
    const sum = detail === 0 ? summary : detail === 1 ? summary.map((l) => l.replace(/; (?!.*;).*(?=\.$)/, '').replace(/: doors? to [^;]*; /, ': ')) : summary.map((l) => l.replace(/, [\d.]+ m² \(\d+ ft²\): .*$/, '.'));
    lines.push(...sum);
    const list = (title: string, xs: string[], max: number) => {
      if (!xs.length) return;
      const shown = xs.slice(0, max);
      lines.push(`${title}: ${shown.join('; ')}${xs.length > max ? `; and ${xs.length - max} more` : ''}.`);
    };
    const short = (a: string) =>
      a
        .replace(/^(doors I added so every room can be reached)[^:]*: (.*)$/, (_, h: string, v: string) => `${h}: ${v.split(', ').length}`)
        .replace(/^a window I added on an outside wall[^:]*: (.*)$/, (_, v: string) => `windows I added on outside walls: ${v.split(', ').length} rooms`)
        .replace(/^(furniture at the usual UK size)[^:]*: (.*)$/, (_, h: string, v: string) => `${h}: ${v.replace(/ [\d.]+(?: ft(?: \d+ in)?| in)? × [\d.]+(?: ft(?: \d+ in)?| in| cm)?/g, '')}`)
        .replace(/^(sizes I chose \(you didn't say\)): (.*)$/, (_, h: string, v: string) => `${h}, as in the lines above: ${v.split(', ').map((x) => x.replace(/ [\d.]+(?: ft| in| m| cm).*$/, '')).join(', ')}`)
        .replace(/ \(line the floors up in the planner\)/, '');
    if (floor !== undefined && detail >= 2) lines.push('ASSUMED, COULD NOT DO and TIGHT WALKWAYS: as in the first reply for this home.');
    else {
      list('ASSUMED (say so)', detail < 2 ? p.assumed : p.assumed.map(short), detail < 2 ? 40 : 14);
      list('COULD NOT DO', p.cannot, detail < 2 ? 20 : 8);
      list('TIGHT WALKWAYS', p.walkways, detail < 2 ? 12 : 4);
    }
    lines.push(`TO OPEN IT: save the plan below as a file ending .json, then SPACE → IMPORT and choose it${only.length > 1 ? ' (one floor at a time)' : ''}; in SPACE, SEE IN 3-D walks round it in the 3D STUDIO.`);
    only.forEach((s, i) => {
      const at = p.storeys.indexOf(s);
      if (i < carry) lines.push(`PLAN${p.storeys.length > 1 ? ` (${s.name})` : ''}: ${JSON.stringify(storeyJson(s, level))}`);
      else lines.push(`PLAN (${s.name}): too long to send with the rest — call design_home again with the same description and floor: ${at} for it.`);
    });
    if (level >= 4) lines.push('(The furniture was left out of the plan text to fit; the summary above still lists it.)');
    lines.push("SAY: tell the owner the plan in a few plain lines in their units, what you assumed and what could not be done, and how to open it. Don't change any number. It is a sketch to plan with, not a survey: it says nothing about planning permission or building regulations.");
    return lines.join('\n');
  };
  let last = '';
  // every floor's plan, as precise as fits; then fewer floors, each whole
  for (let carry = only.length; carry >= 1; carry--) {
    for (const detail of [0, 1, 2]) {
      for (const level of [0, 1, 2, 3]) {
        last = build(detail, level, carry);
        if (last.length <= budget) return last;
      }
    }
  }
  // one floor asked for that is still too big: its rooms, doors and windows without the furniture
  if (floor !== undefined) {
    last = build(2, 4, 1);
    if (last.length <= budget) return last;
  }
  // no plan fits beside the words: each floor on its own call
  for (const detail of [0, 1, 2]) {
    last = build(detail, 3, 0);
    if (last.length <= budget) return last;
  }
  return last;
}

// ------------------------------------------------------------------ the tool

/** A question about a plan the owner already has ("review my layout", "is my kitchen big enough?"), not a home to draw. */
export function isPlanQuestion(text: string): boolean {
  const s = normalise(text);
  const asks = /\?\s*$/.test(String(text).trim()) || /^\s*(?:is|are|does|do|will|would|can|could|should|how|what|which|why|where)\b/.test(s);
  const review = /\b(?:review|check|critique|feedback|what do you think|thoughts on|improve|feel bigger|any good|is it ok|does it work|better layout)\b/.test(s);
  const existing = /\b(?:my|our|this|the) (?:plan|layout|design|floor ?plan|room|home|house|flat|kitchen|bedroom|bathroom|living room|lounge)\b/.test(s);
  const build = /\b(?:design|draw|sketch|make|create|build|plan out|lay out|turn (?:it|this) into|floor ?plan (?:of|for))\b/.test(s) && !/\bdesign review\b/.test(s);
  const sized = sizesIn(s).some((d) => !d.guessed);
  return (review || (asks && existing)) && !build && !sized;
}

/** The words that turn the group on (tools/index.ts): describing rooms, a floor plan, a home to design. */
export const HOMEPLAN_WHEN = /\b(design (?:my|a|the|our) (?:home|house|flat|room|bungalow|apartment|layout|floor ?plan)|floor ?plans?|draw (?:my|a|the|our|me a) (?:home|house|flat|room|plan|floor ?plan|layout)|plan (?:my|a|the|our) (?:home|house|flat|room|layout)|room layout|bed ?rooms?|bath ?rooms?|kitchens?|living rooms?|lounges?|hallways?|en ?suites?|upstairs|downstairs|ground floor|first floor|sq ?ft|square (?:feet|metres|meters)|\d+(?:\.\d+)? ?(?:ft|feet|foot|m|metres?|meters?|cm) (?:by|x) \d)/i;
/** The group's line in the prompt (tools/index.ts). */
export const HOMEPLAN_ABOUT = "You can draw a home or a room from the owner's words, with sizes in any unit, doors, windows and furniture (design_home: a plan for SPACE and the 3D STUDIO; never invent sizes).";

export const homePlanTools: Tool[] = [
  {
    name: 'design_home',
    description:
      "Draw a home or a room from the owner's own words: rooms with sizes in any unit (feet, metres, cm), where they sit, doors, windows, ceiling height, furniture and where it goes, upstairs as another floor. Code works out the plan and returns a plain summary, every size it had to assume, what it could not do, and the plan as Room JSON for SPACE → IMPORT and the 3D STUDIO. Pass the owner's description whole, as they said it; never add sizes they did not give. `unit` only if they said which they want. A question about a plan they already have goes to design_review.",
    parameters: {
      type: 'object',
      properties: {
        description: { type: 'string', description: "the owner's description of the home or room, word for word" },
        unit: { type: 'string', enum: ['metric', 'imperial'], description: 'how to show sizes, only if the owner said (default: the units they used)' },
        floor: { type: 'number', description: 'only when a reply said so: that floor\'s plan alone (0 = ground)' },
      },
      required: ['description'],
    },
    risk: 'auto',
    // read-only, except a question passed on to design_review (which sends its changes to the phone)
    pure: (a) => !isPlanQuestion(typeof a.description === 'string' ? a.description : ''),
    async run(a, ctx) {
      const text = arg.str(a, 'description').slice(0, 4000);
      const unit = a.unit === 'imperial' || a.unit === 'metric' ? a.unit : undefined;
      if (isPlanQuestion(text)) return designTools[0]!.run({ goal: text.slice(0, 200) }, ctx);
      const plan = designHome(text, unit);
      if (!plan.storeys.length) throw new Error("I couldn't find any rooms in that: describe them, e.g. \"a living room 4 by 3.5 m with the kitchen off it to the right, a bathroom and a bedroom off the hall\"");
      const floor = typeof a.floor === 'number' && Number.isInteger(a.floor) && a.floor >= 0 && a.floor < plan.storeys.length ? a.floor : undefined;
      return homeReply(plan, REPLY_MAX, floor);
    },
  },
];
