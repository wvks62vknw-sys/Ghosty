/**
 * His words for DESIGN A BUILD (BRIEF-REST-D 1), read with no model. Pure, so the phrases registry (assistant/phrases.ts)
 * and the node test read them too.
 *  - a design: "design me a shed three by two", "build me a garden room with a desk", "spec me a gaming PC under £800",
 *    "I want a bookshelf for this wall, 2 metres"; in the sheet's own box the words alone do ("a garden shed 3 m by 2 m");
 *  - "show me the build" (the Studio's pane); "price the roof" (a part's lines);
 *  - a change to the design on show: "make it 4 by 3", "make it 3.5 m wide", "an apex roof", "add a window", "double doors",
 *    "underfloor heating", "block walls", "a budget of £1,000".
 * A size with no unit is metres up to 15, centimetres to 300, millimetres beyond; a shed's two sizes from 4 to 20 with no
 * unit are feet (sheds are sold as 8 by 6), and said so.
 */
import { DEFAULTS, paramsFor, type Kind, type Params } from './kits';

const NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20 };
const lower = (t: string) => t.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();

/** Number words as digits: "three and a half" → "3.5", "two point four" → "2.4", "a metre" → "1 metre". */
export function digits(t: string): string {
  const w = Object.keys(NUM).join('|');
  return lower(t)
    .replace(new RegExp(`\\b(${w}) point (${w}|zero)\\b`, 'g'), (_, a: string, b: string) => `${NUM[a]}.${NUM[b] ?? 0}`)
    .replace(new RegExp(`\\b(${w}) and a half\\b`, 'g'), (_, a: string) => `${NUM[a]! + 0.5}`)
    .replace(new RegExp(`\\b(${w})\\b`, 'g'), (_, a: string) => String(NUM[a]))
    .replace(/\bhalf a (metre|meter)\b/g, '0.5 $1')
    .replace(/\ba (metre|meter)\b/g, '1 $1')
    .replace(/(\d),(\d{3})\b/g, '$1$2');
}

/** The kinds by their words, matched where they first appear (a garden room before its desk). */
const KINDS: [Kind, RegExp][] = [
  ['gardenroom', /\b(?:garden (?:room|office|studio|gym)|summer ?house|log cabin|garden building)\b/],
  ['shed', /\b(?:(?:garden|bike|tool|potting|storage) )?sheds?\b/],
  ['garage', /\bgarages?\b/],
  ['pc', /\b(?:gaming |editing |school )?(?:pc|computer|desktop|gaming rig)\b(?! desk)/],
  ['shelf', /\b(?:book ?shel(?:f|ves)|book ?case|shel(?:f|ves|ving)(?: unit)?)\b/],
  ['desk', /\bdesk\b/],
  ['bench', /\b(?:garden |picnic )?bench\b(?! ?press)/],
  ['room', /\b(?:bed ?room|living room|lounge|home office|nursery|play ?room|games room|dining room|spare room|box ?room|room)\b/],
  ['robot', /\brobots?\b/],
  ['car', /\b(?:electric )?(?:car|go-?kart|kart|buggy)\b(?! ?(?:port|park|wash|boot))/],
  ['tv', /\b(?:tv|telly|television)(?: screen)?\b(?! ?(?:stand|unit|cabinet|bench|show|series|programme|channel|guide|licence))|\bbig screen\b/],
];

/** The kind his words name first, and where. */
export function kindIn(t: string): { kind: Kind; at: number; word: string } | null {
  let best: { kind: Kind; at: number; word: string } | null = null;
  for (const [kind, re] of KINDS) {
    const m = re.exec(t);
    if (m && (!best || m.index < best.at || (m.index === best.at && m[0].length > best.word.length))) best = { kind, at: m.index, word: m[0] };
  }
  return best;
}

const VERB = /\b(?:design|build|make|plan|spec|create)(?: me| us| him)?\b|\bi (?:want|need|would like|'d like|wanna) (?:to (?:build|make) )?(?:a|an)\b|\bhow (?:do|would|could|can|should) i (?:build|make)\b|\bwhat would (?:a|an) .{1,40} cost to build\b/;
/** Words that make it something else: a picture, a 3-D model, a game, a plan for a day. */
const NOT_BUILD = /\b(?:3-?d|model|picture|image|drawing|photo|cartoon|logo|icon|song|game|app|website|site|story|poem|playlist|video|booking|reservation|appointment|reminder|list)\b|\b(?:with|using) (?:my )?(?:hands?|fingers?)\b|\bin the air\b/;
const ARTICLE = /\b(?:a|an|new|one|my own)\s+(?:[\w.'-]+\s+){0,4}?$/;

export type BuildAsk =
  | { kind: 'design'; params: Params }
  | { kind: 'show' }
  | { kind: 'price'; group: string }
  | { kind: 'change'; change: Partial<Params>; words: string };

/** A design's sizes and choices from his words (none of the verbs needed: the sheet's box sends its words here). */
export function paramsFromWords(text: string): Params | null {
  const t = digits(text);
  const k = kindIn(t);
  if (!k) return null;
  const over: Partial<Params> = { ...choices(t), notes: [] };
  const notes: string[] = [];
  const pair = /(\d+(?:\.\d+)?)\s*(m\b|metres?|meters?|ft\b|feet|foot|'|cm|mm)?\s*(?:by|x|×|\*)\s*(\d+(?:\.\d+)?)\s*(m\b|metres?|meters?|ft\b|feet|foot|'|cm|mm)?/.exec(t);
  if (pair) {
    const u2 = pair[4] ?? pair[2] ?? '';
    const a = Number(pair[1]);
    const b = Number(pair[3]);
    let unit = u2;
    if (!unit && k.kind === 'shed' && Math.min(a, b) >= 4 && Math.max(a, b) <= 20) {
      unit = 'ft';
      notes.push(`${a} by ${b} read as feet (sheds are sold that way): ${toM(a, 'ft').toFixed(2)} × ${toM(b, 'ft').toFixed(2)} m`);
    }
    over.w = toM(a, pair[2] ?? unit);
    over.d = toM(b, unit);
  }
  const one = (what: RegExp) => {
    const m = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(m\\b|metres?|meters?|ft\\b|feet|foot|cm|mm)?\\s*(?:${what.source})`).exec(t);
    return m ? toM(Number(m[1]), m[2] ?? '') : null;
  };
  const wide = one(/wide|long|across/);
  const deep = one(/deep/);
  const high = one(/high|tall/);
  if (wide) over.w = wide;
  if (deep) over.d = deep;
  if (high) over.h = high;
  // "a bookshelf for this wall, 2 metres": one size, the width (furniture) or both (a square room)
  if (!pair && !wide && !deep && !high) {
    const single = /(\d+(?:\.\d+)?)\s*(m\b|metres?|meters?|ft\b|feet|foot|cm|mm)/.exec(t);
    if (single && !/£|pounds?|quid/.test(t.slice(Math.max(0, single.index - 2), single.index + single[0].length + 7))) over.w = toM(Number(single[1]), single[2] ?? '');
  }
  const budget = /(?:£\s?(\d{2,5}(?:\.\d+)?)k?|(\d{2,5})\s?(?:pounds|quid|gbp))/.exec(t);
  if (budget) over.budget = Number(budget[1] ?? budget[2]) * (/£\s?\d+(?:\.\d+)?k\b/.test(t) ? 1000 : 1);
  if (k.kind === 'room') over.room = k.word.trim();
  return paramsFor(k.kind, { ...over, notes });
}

/** Feet, centimetres or millimetres to metres; a bare number by its size. */
function toM(v: number, unit: string): number {
  const u = unit.trim();
  if (/^(?:ft|feet|foot|')$/.test(u)) return Math.round(v * 0.3048 * 100) / 100;
  if (u === 'cm') return v / 100;
  if (u === 'mm') return v / 1000;
  if (u) return v;
  return v > 300 ? v / 1000 : v > 15 ? v / 100 : v;
}

/** The choices his words make, beyond the sizes. */
function choices(t: string): Partial<Params> {
  const c: Partial<Params> = {};
  if (/\bapex\b|\bpitched\b|\bgable/.test(t)) c.roof = 'apex';
  else if (/\bpent\b|\bsloping roof\b|\blean-to\b/.test(t)) c.roof = 'pent';
  else if (/\bflat roof\b/.test(t)) c.roof = 'flat';
  if (/\bdouble doors?\b|\btwo doors\b/.test(t)) c.doors = 'double';
  else if (/\bsingle door\b/.test(t)) c.doors = 'single';
  if (/\b(?:block|blockwork|brick|concrete) (?:walls?|garage|built)\b|\bin (?:block|brick)\b/.test(t)) c.walls = 'block';
  else if (/\btimber (?:walls?|garage|frame)\b|\bwooden garage\b/.test(t)) c.walls = 'timber';
  const win = /\b(no|\d+) windows?\b/.exec(t) ?? (/\b(?:a|one|with a|add a) window\b/.test(t) ? ['', '1'] : null);
  if (win) c.windows = win[1] === 'no' ? 0 : Number(win[1]);
  if (/\bunderfloor\b/.test(t)) c.heat = 'underfloor';
  else if (/\bradiator\b/.test(t)) c.heat = 'radiator';
  if (/\blaminate\b|\bwood(?:en)? floor\b/.test(t)) c.floor = 'laminate';
  else if (/\bcarpet\b/.test(t)) c.floor = 'carpet';
  if (/\bwardrobes?\b|\bfitted wardrobe\b/.test(t)) c.wardrobe = true;
  if (/\bwith a desk\b|\band a desk\b|\boffice\b/.test(t)) c.desk = true;
  if (/\bmdf\b/.test(t)) c.material = 'mdf';
  else if (/\boak\b/.test(t)) c.material = 'oak';
  else if (/\bply(?:wood)?\b/.test(t)) c.material = 'ply';
  else if (/\bpine\b/.test(t)) c.material = 'pine';
  if (/\b(?:edit|editing|video|photos?|render)/.test(t)) c.use = 'editing';
  else if (/\b(?:school|homework|study|office work|cheap(?:est)? (?:pc|computer))\b/.test(t)) c.use = 'school';
  else if (/\bgam(?:e|es|ing)\b/.test(t)) c.use = 'gaming';
  return c;
}

/** The part groups he can name to price ("the roof", "the frame"). */
const GROUPS: [string, RegExp][] = [
  ['roof', /roof|rafters?|felt/], ['frame', /frame|framing|studs?/], ['floor', /floor(?:ing)?|joists?|bearers?/], ['base', /base|slabs?|foundations?|ground screws?/],
  ['cladding', /cladding|walls?|shiplap/], ['insulation', /insulation/], ['door', /doors?/], ['window', /windows?|glazing/], ['fixings', /fixings|screws|nails/],
  ['finish', /finish|paint|treatment|varnish/], ['electrics', /electrics?|wiring/], ['heating', /heating|radiator/], ['wardrobe', /wardrobe/], ['slab', /slab|concrete/],
  ['shelves', /shelves/], ['top', /top|worktop/], ['gpu', /graphics(?: card)?|gpu/], ['cpu', /cpu|processor/],
];

/** His words as a DESIGN A BUILD ask, or null (the brain's as ever). */
export function buildAsked(text: string): BuildAsk | null {
  const t = digits(text);
  if (!t || t.length > 300) return null;
  // the design on show: the Studio's pane, or a part's prices
  if (/^(?:(?:can you |please )?show me|let me see) (?:the|my) (?:build|design|shed|garden room|garage|bookshelf|shelf|desk|bench|pc|computer|wardrobe)(?: in 3-?d)?[.!?]?$/.test(t) || /^(?:show me )?(?:the )?build in 3-?d[.!?]?$/.test(t)) return { kind: 'show' };
  const price = /^(?:price|cost)(?: up)? (?:the|my) (.{2,30}?)[.!?]?$/.exec(t) ?? /^how much (?:is|are|would|will) the (.{2,30}?)(?: cost| be)?[.!?]?$/.exec(t);
  if (price) {
    const g = GROUPS.find(([, re]) => re.test(price[1]!));
    if (g) return { kind: 'price', group: g[0] };
  }
  // a new design: a verb, then a/an/new and a kind (never "design my home": that is SPACE's DESIGN MY HOME)
  const k = kindIn(t);
  const verb = VERB.exec(t);
  if (k && verb && verb.index <= k.at && ARTICLE.test(t.slice(0, k.at)) && !/\b(?:my home|my house|a house|a home)\b/.test(t) && !NOT_BUILD.test(t)) {
    const p = paramsFromWords(t);
    if (p) return { kind: 'design', params: p };
  }
  // a change to the design on show
  const change = changeOf(t);
  if (change) return { kind: 'change', change, words: text.trim() };
  return null;
}

/** "make it 4 by 3", "make it 3.5 m wide", "an apex roof", "add a window", "a budget of £1,000". */
export function changeOf(t: string): Partial<Params> | null {
  const m = /^(?:(?:now |ok |okay )?(?:make|change) (?:it|the (?:build|design|shed|garden room|garage|room|shelf|bookshelf|desk|bench|pc))(?: to)?|(?:change|make) (?:the )?(width|depth|height) (?:to )?)\s*(.*?)[.!?]?$/.exec(t);
  const out: Partial<Params> = {};
  if (m) {
    const rest = m[2] ?? '';
    const pair = /^(\d+(?:\.\d+)?)\s*(?:m|metres?|meters?)?\s*(?:by|x|×)\s*(\d+(?:\.\d+)?)\s*(?:m|metres?|meters?)?$/.exec(rest);
    const one = /^(\d+(?:\.\d+)?)\s*(m|metres?|meters?|cm|mm|ft|feet)?\s*(wide|long|deep|high|tall)?$/.exec(rest);
    if (pair) {
      out.w = Number(pair[1]);
      out.d = Number(pair[2]);
    } else if (one && (m[1] || one[2] || one[3])) {
      const v = toM(Number(one[1]), one[2] ?? (Number(one[1]) > 15 ? '' : 'm'));
      const what = m[1] ?? one[3] ?? 'wide';
      if (/width|wide|long/.test(what)) out.w = v;
      else if (/depth|deep/.test(what)) out.d = v;
      else out.h = v;
    } else Object.assign(out, choices(rest));
    return Object.keys(out).length ? out : null;
  }
  if (/^(?:(?:give it|use|with|make it|go for) )?(?:an? )?(apex|pent|flat) roof[.!?]?$/.test(t) || /^(?:add|give it) (?:a|another|one more) window[.!?]?$/.test(t) || /^(?:no|without) windows?[.!?]?$/.test(t) || /^(?:give it |with )?(?:double doors|a single door|underfloor heating|a radiator|block walls|timber walls|a wardrobe(?: wall)?|laminate|carpet)[.!?]?$/.test(t)) {
    Object.assign(out, choices(t));
    if (/^(?:add|give it) (?:a|another|one more) window/.test(t)) out.windows = -1; // one more than now
    return Object.keys(out).length ? out : null;
  }
  const budget = /^(?:a |with a |make it a )?budget of £?\s?(\d{3,5})[.!?]?$/.exec(t) ?? /^(?:make it |keep it )?under £\s?(\d{3,5})[.!?]?$/.exec(t);
  if (budget) return { budget: Number(budget[1]) };
  return null;
}

/** The change applied to the design he has (`windows: -1` adds one). */
export function applyChange(p: Params, c: Partial<Params>): Params {
  const next: Params = { ...p, ...c, notes: [] };
  if (c.windows === -1) next.windows = p.windows + 1;
  // a new budget or use picks the parts again
  if (c.budget !== undefined || c.use !== undefined) delete next.pc;
  return paramsFor(p.kind, next);
}

/** The defaults a kind starts from, for the sheet's chips. */
export const startFor = (kind: Kind) => paramsFor(kind, { ...DEFAULTS[kind] });
