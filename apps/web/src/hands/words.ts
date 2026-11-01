/**
 * SHAPES: his words, read on the phone with no model (BRIEF-REST-C part 2). Pure (unit-tested in restc.test.mjs).
 *  - one real length sets the scale: "that wall is four metres", "it's 3.5 m", "this one's twelve feet long";
 *  - furniture by its size words: "a bed here", "a single bed", "put a sofa here", "a 2 by 1 metre table";
 *  - north: "north is up", "north is to the left", "north is behind me" (down);
 *  - what the walls are: "brick walls", "it's a timber shed", "plasterboard" (a guess from his words, said so);
 *  - a room's name: "this is the kitchen", "call it the bedroom"; "make it a window"; undo, clear, done.
 */
import { CATALOGUE } from '../space/plan';

const NUM: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
};
const NUMWORD = `(?:\\d+(?:[.,]\\d+)?|${Object.keys(NUM).join('|')})`;

/** "four", "3.5", "twenty five", "four and a half", "three point five" → the LAST number in the words; null when none. */
export function numberIn(text: string): number | null {
  const t = text.toLowerCase().replace(/-/g, ' ');
  const all = [...t.matchAll(new RegExp(`\\b(${NUMWORD})(?:\\s+(${NUMWORD}))?(?:\\s+point\\s+(\\d|${Object.keys(NUM).join('|')}))?(\\s+and\\s+a\\s+(half|quarter))?\\b`, 'g'))];
  const m = all[all.length - 1];
  if (!m) return null;
  const word = (w: string) => (/^\d/.test(w) ? Number(w.replace(',', '.')) : NUM[w]!);
  let n = word(m[1]!);
  // "twenty five"
  if (m[2] && n >= 20 && n % 10 === 0 && word(m[2]) < 10) n += word(m[2]);
  if (m[3]) n += word(m[3]) / 10;
  if (m[5]) n += m[5] === 'half' ? 0.5 : 0.25;
  return Number.isFinite(n) ? n : null;
}

/** One real length: metres (feet and inches turned into metres); null when it is not a length. */
export function lengthSaid(text: string): number | null {
  const t = text.toLowerCase();
  if (!/\b(?:wall|side|it|it's|its|that|this|that's|this one|one)\b|^\s*[\d.]/.test(t)) return null;
  // each unit word in turn, with the number just before it ("is four and a half metres", "350 cm", "12'")
  for (const u of t.matchAll(/(metres?|meters?|\bm\b|centimetres?|centimeters?|\bcm\b|feet|foot|\bft\b|(?<=\d)\s*')/g)) {
    const n = numberIn(t.slice(Math.max(0, u.index! - 40), u.index).split(/\s+/).slice(-6).join(' '));
    if (n === null || n <= 0) continue;
    const w = u[1]!.trim();
    const m = /^c/.test(w) ? n / 100 : /^(feet|foot|ft|')$/.test(w) ? n * 0.3048 : n;
    if (m >= 0.2 && m <= 100) return Math.round(m * 1000) / 1000;
  }
  return null;
}

/** Furniture words → the planner's common UK sizes (space/plan.ts CATALOGUE), and a few more. */
const FURNITURE: { re: RegExp; kind: string; label: string; w: number; d: number; h: number }[] = [
  { re: /\bking(?:\s*size)?\s+bed\b/, kind: 'king', label: 'Bed, king', w: 160, d: 215, h: 50 },
  { re: /\bsingle\s+bed\b/, kind: 'single', label: 'Bed, single', w: 100, d: 200, h: 50 },
  { re: /\b(?:double\s+)?bed\b/, kind: 'double', label: 'Bed, double', w: 145, d: 205, h: 50 },
  { re: /\b(?:2|two)\s*seater\b|\bsmall\s+sofa\b|\bloveseat\b/, kind: 'sofa2', label: 'Sofa, 2-seater', w: 160, d: 90, h: 85 },
  { re: /\bsofa\b|\bcouch\b|\bsettee\b/, kind: 'sofa3', label: 'Sofa, 3-seater', w: 210, d: 95, h: 85 },
  { re: /\barm\s*chair\b|\bchair\b/, kind: 'armchair', label: 'Armchair', w: 85, d: 85, h: 85 },
  { re: /\bwardrobe\b|\bcloset\b/, kind: 'wardrobe', label: 'Wardrobe, double', w: 100, d: 60, h: 200 },
  { re: /\bdesk\b/, kind: 'desk', label: 'Desk', w: 120, d: 60, h: 75 },
  { re: /\b(?:dining\s+)?table\b/, kind: 'dining', label: 'Dining table, 4', w: 120, d: 80, h: 75 },
  { re: /\btv\b|\btelly\b|\btelevision\b/, kind: 'tv', label: 'TV unit', w: 150, d: 40, h: 50 },
  { re: /\bbook\s*(?:case|shelf)\b|\bshelves\b/, kind: 'bookcase', label: 'Bookcase', w: 80, d: 30, h: 180 },
  { re: /\bbath\b(?!room)/, kind: 'custom', label: 'Bath', w: 170, d: 70, h: 55 },
  { re: /\bshower\b/, kind: 'custom', label: 'Shower', w: 90, d: 90, h: 200 },
  { re: /\btoilet\b|\bloo\b|\bwc\b/, kind: 'custom', label: 'Toilet', w: 40, d: 65, h: 80 },
  { re: /\bfridge\b/, kind: 'custom', label: 'Fridge', w: 60, d: 65, h: 180 },
  { re: /\bworktop\b|\bcounter\b/, kind: 'custom', label: 'Worktop', w: 200, d: 60, h: 90 },
];

export interface ItemWords {
  kind: string;
  label: string;
  /** cm */
  w: number;
  d: number;
  h: number;
}

/** "a bed here", "put a sofa there", "a 2 by 1 metre table" → the piece, its size in cm; null when no piece is named. */
export function itemSaid(text: string): ItemWords | null {
  const t = text.toLowerCase();
  if (!/\b(?:a|an|the|put|add|place|one|some)\b/.test(t)) return null;
  // its own size first: "a 2 by 1 metre table", "a 200 by 90 cm desk"
  const sized = /(\d+(?:\.\d+)?)\s*(?:m|cm|metres?|meters?)?\s*(?:by|x|×)\s*(\d+(?:\.\d+)?)\s*(m|cm|metres?|meters?)?/.exec(t);
  for (const f of FURNITURE) {
    if (!f.re.test(t)) continue;
    // a word the planner's own list has keeps its own label
    const own = CATALOGUE.find((c) => c.kind === f.kind);
    const out: ItemWords = { kind: f.kind, label: own?.label ?? f.label, w: own?.w ?? f.w, d: own?.d ?? f.d, h: f.h };
    if (sized) {
      const cm = /^c/.test(sized[3] ?? '') || Number(sized[1]) > 20 ? 1 : 100;
      out.w = Math.round(Number(sized[1]) * cm);
      out.d = Math.round(Number(sized[2]) * cm);
      out.kind = 'custom';
    }
    return out.w >= 5 && out.d >= 5 && out.w <= 1000 && out.d <= 1000 ? out : null;
  }
  return null;
}

/** "north is up / to the left / right / down / behind me / in front" → the bearing of the plan's top edge, degrees. */
export function northSaid(text: string): number | null {
  const t = text.toLowerCase();
  if (!/\bnorth\b/.test(t)) return null;
  if (/\b(?:up|top|ahead|in front|forward|straight)\b/.test(t)) return 0;
  if (/\bleft\b/.test(t)) return 90;
  if (/\bright\b/.test(t)) return 270;
  if (/\b(?:down|bottom|behind|back)\b/.test(t)) return 180;
  return null;
}

/** What the walls are, guessed from his words (said as a guess wherever it shows). */
const MATERIALS: [RegExp, string][] = [
  [/\bbrick/, 'brick'],
  [/\b(?:breeze\s*)?blocks?\b|\bblockwork\b/, 'concrete block'],
  [/\bstone\b/, 'stone'],
  [/\bconcrete\b/, 'concrete'],
  [/\bplaster\s*board\b|\bdry\s*wall\b|\bstud\b/, 'plasterboard on studs'],
  [/\bglass\b|\bglazed\b/, 'glass'],
  [/\btimber\b|\bwood(?:en)?\b|\bshed\b|\bcabin\b|\bgarden room\b|\bsummer\s*house\b/, 'timber'],
  [/\bsteel\b|\bmetal\b/, 'steel'],
  [/\bextension\b|\bhouse\b|\bgarage\b/, 'brick and block'],
];
export function materialSaid(text: string): string | null {
  const t = text.toLowerCase();
  for (const [re, m] of MATERIALS) if (re.test(t)) return m;
  return null;
}

/** "this is the kitchen", "call it the bedroom", "name it office" → the room's name; null otherwise. */
export function nameSaid(text: string): string | null {
  const m = /\b(?:this is|that is|this's|that's|call it|name it|it's)\s+(?:the|a|my|our)?\s*([a-z][a-z ]{1,28}?)\s*(?:room)?[.!]?$/i.exec(text.trim());
  if (!m) return null;
  const name = m[1]!.trim();
  if (/\b(?:metres?|meters?|feet|foot|cm|wall|north|window|door|bed|sofa|table|it|that|this)\b/i.test(name) || /\d/.test(name)) return null;
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

export type ShapeCommand = 'undo' | 'clear' | 'done' | 'window' | 'door';
/** The small commands: undo, clear (start again), done (show the blueprint), "make it a window / door". */
export function commandSaid(text: string): ShapeCommand | null {
  const t = text.toLowerCase().trim().replace(/[.!]$/, '');
  if (/^(?:undo|take that back|scrap that|remove (?:that|the last one))$/.test(t)) return 'undo';
  if (/^(?:clear|clear it|start again|start over|wipe it)$/.test(t)) return 'clear';
  if (/^(?:done|finished|that's it|that's all|show me(?: the (?:plan|blueprint))?)$/.test(t)) return 'done';
  if (/\bwindow\b/.test(t) && /\b(?:make|it's|that's|is a|a)\b/.test(t)) return 'window';
  if (/\bdoor\b/.test(t) && /\b(?:make|it's|that's|is a|a)\b/.test(t)) return 'door';
  return null;
}

/** The chat's way in: "draw a room with my hands" (assistant/phrases.ts → the Lens on SHAPES). */
export function shapesAsked(text: string): boolean {
  const t = text.toLowerCase();
  return /\b(?:draw|sketch|trace|design|make|build)\b.*\b(?:with|using)\s+(?:my\s+)?(?:hands?|fingers?)\b/.test(t) || /\b(?:draw|sketch)\b.*\bin the air\b/.test(t) || /^(?:open\s+)?shapes(?: mode)?[.!]?$/.test(t.trim());
}
