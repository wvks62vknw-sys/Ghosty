/**
 * THE WORKBENCH in his words (OWNER-ISSUES 61b), pure: "3 m steel beam 5 kN in the middle" → the beam and its inputs;
 * "what's the gear ratio of 50 and 11 teeth" → the gears; "led resistor 5v 20ma" → the circuit. In the style of the home
 * planner's reading (apps/edge/src/tools/homeplan.ts): his words normalised, every number read with its own unit, each one
 * given to the input its unit and its neighbouring words say, and nothing guessed — what is not in the words is left to the
 * solver's stated default.
 *
 * `workbenchAsked` is what the chat answers with no model (apps/web/src/assistant/local.ts): a short command naming a panel
 * ("wind tunnel", "beam calculator") opens it; a bare problem with its numbers ("3 m steel beam 5 kN in the middle") fills
 * the form and answers; a question ("how strong is…?") goes to the brain, whose `estimate` tool runs the same solvers.
 */
import { materialOf, type SectionIn } from './beams';
import type { WorkKind } from './estimate';
import { LAYER_MATS, type Layer } from './heat';
import { parseQuantity, UNITS, type QtyKind } from './units';

/** The WORKBENCH screen's panels (a kind's panel: the bicycle is in GEARS, the car and a fall in WING & CAR). */
export type Panel = 'tunnel' | 'beam' | 'column' | 'gears' | 'engine' | 'wing' | 'projectile' | 'orbit' | 'heat' | 'sun' | 'circuit';

export const PANEL_OF: Record<WorkKind, Panel> = {
  beam: 'beam', column: 'column', gears: 'gears', bike: 'gears', engine: 'engine', wing: 'wing', car: 'wing', fall: 'wing',
  projectile: 'projectile', orbit: 'orbit', heat: 'heat', sun: 'sun', circuit: 'circuit', tunnel: 'tunnel',
};

export interface Problem {
  kind: WorkKind;
  inputs: Record<string, unknown>;
  /** What was read from his words, by input name. */
  filled: string[];
}

/** His words, lower case, with the symbols and spellings that vary made one way. */
export function normalise(text: string): string {
  return ` ${String(text ?? '')} `
    .toLowerCase()
    .replace(/[×✕]/g, ' x ')
    .replace(/[–—−]/g, '-')
    .replace(/[’‘`]/g, "'")
    .replace(/(\d),(\d{3})(?!\d)/g, '$1$2')
    .replace(/\bmetres?\b|\bmeters?\b/g, 'm')
    .replace(/\bkilo ?newtons?\b/g, 'kn')
    .replace(/\s+/g, ' ');
}

interface Tok {
  value: number;
  unit: string;
  at: number;
  end: number;
}

// every unit's written forms, longest first (so "kn/m" wins over "kn", "mph" over "m")
const FORMS = [...new Set(UNITS.flatMap((u) => [u.u.toLowerCase(), ...(u.al ?? [])]))].filter((f) => f && !/^['"″′]$/.test(f)).sort((a, b) => b.length - a.length);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const TOK = new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*(${FORMS.map(esc).join('|')})(?![a-z0-9µΩ°²³])`, 'g');

/** Every number written with a unit, in order. */
function tokens(s: string): Tok[] {
  const out: Tok[] = [];
  TOK.lastIndex = 0;
  for (let m = TOK.exec(s); m; m = TOK.exec(s)) out.push({ value: Number(m[1]), unit: m[2]!, at: m.index, end: m.index + m[0].length });
  return out;
}

/** The tokens that read as `kind`, in SI, with where they were. */
function of(toks: Tok[], kind: QtyKind): { si: number; at: number; end: number }[] {
  const out: { si: number; at: number; end: number }[] = [];
  for (const t of toks) {
    const q = parseQuantity(`${t.value} ${t.unit}`, kind);
    if (q) out.push({ si: q.si, at: t.at, end: t.end });
  }
  return out;
}

const before = (s: string, at: number, n = 18) => s.slice(Math.max(0, at - n), at);
const after = (s: string, end: number, n = 18) => s.slice(end, end + n);

const KIND_WORDS: [WorkKind, RegExp][] = [
  ['tunnel', /\bwind ?tunnel\b|\bair ?flow over\b|\bflow (?:over|around|past)\b/],
  ['fall', /\bterminal (?:velocity|speed)\b|\bskydiv\w*|\bfree ?fall\w*/],
  ['orbit', /\borbit\w*|\bescape (?:velocity|speed)\b|\bhohmann\b|\bgeostationary\b|\bdelta-?v\b/],
  ['sun', /\bshadows?\b|\bsun ?(?:angle|position|path|light)\b|\bsun and shadow\b|\bsunrise\b|\bsunset\b|\bsolar (?:altitude|angle|elevation)\b|\bhow high is the sun\b/],
  ['circuit', /\bleds?\b|\bresistors?\b|\bohms?\b|\bΩ|\bvoltage divider\b|\bcapacitors?\b|\btime constant\b|\bin parallel\b|\bin series\b|\brunning cost\b|\bcost to run\b|\bcircuits?\b/],
  ['heat', /\bu-?values?\b|\bheat(?:ing)? loss\b|\binsulation\b|\bradiators?\b|\bcavity wall\b|\bsolid wall\b|\bheating (?:bill|cost)\b|\bkeep (?:a |the )?room warm\b/],
  ['car', /\b(?:car|van|hatchback|saloon|suv|lorry|truck)\b.*\b(?:drag|aero\w*|downforce|power to)\b|\bdrag coefficient\b|\bdownforce\b|\bfrontal area\b|\bcd ?(?:of )?0?\.\d/],
  ['wing', /\bwings?\b|\baero ?foils?\b|\bair ?foils?\b|\bnaca\b|\bangle of attack\b|\bstall speed\b|\blift and drag\b|\blift\b.*\bdrag\b/],
  ['column', /\bcolumns?\b|\bposts?\b|\bstruts?\b|\bpillars?\b|\bstanchions?\b|\bbuckl\w*/],
  ['beam', /\bbeams?\b|\bjoists?\b|\blintels?\b|\brsj\b|\bcantilever\w*|\bdeflect\w*|\bload[- ]bearing\b|\bshelf\b|\bspan(?:s|ning)?\b/],
  ['bike', /\bbikes?\b|\bbicycles?\b|\bchain ?rings?\b|\bcassette\b|\bgear inches\b|\bcadence\b/],
  ['gears', /\bgears?\b|\bteeth\b|\btooth\b|\bgearbox\b|\bpulleys?\b|\bsprockets?\b|\bgear ratio\b/],
  ['engine', /\bengines?\b|\bbhp\b|\bhorse ?power\b|\bbmep\b|\bcompression ratio\b|\btorque curve\b|\b\d(?:\.\d)? ?(?:l|litre|liter)\b.*\b(?:petrol|diesel|turbo|engine|rpm|bhp|hp|kw)\b|\b(?:petrol|diesel|turbo)\b.*\brpm\b/],
  ['projectile', /\bprojectiles?\b|\btrajector\w*|\bthrow\w*|\bkick\w*|\blaunch\w*|\bcannon\b|\bhow far (?:will|would|does|can)\b.*\b(?:go|fly|travel|land)\b/],
];

/** Which kind of problem his words are about (null: none the workbench solves). */
export function kindOf(text: string): WorkKind | null {
  const s = normalise(text);
  for (const [k, re] of KIND_WORDS) if (re.test(s)) return k;
  return null;
}

/** "100x200", "47 x 195 mm", "10 by 20 cm": a rectangle's sizes in m (the smaller is the width: a beam stands on its edge). */
function rectIn(s: string): { sec: SectionIn; text: string } | null {
  const m = /(\d+(?:\.\d+)?)\s*(mm|cm|in)?\s*(?:x|by)\s*(\d+(?:\.\d+)?)\s*(mm|cm|in)?(?![\d.]|\s*(?:x|by)\s*\d)/.exec(s);
  if (!m) return null;
  const u = m[4] ?? m[2] ?? 'mm';
  const k = u === 'cm' ? 0.01 : u === 'in' ? 0.0254 : 0.001;
  const a = Number(m[1]) * k;
  const b = Number(m[3]) * k;
  if (!(a > 0 && b > 0) || Math.max(a, b) > 3) return null;
  return { sec: { shape: 'rect', b: Math.min(a, b), h: Math.max(a, b) }, text: m[0] };
}

function sectionIn(s: string): { sec: SectionIn; text: string } | null {
  const tube = /(\d+(?:\.\d+)?)\s*(?:mm)?\s*(?:x|by)\s*(\d+(?:\.\d+)?)\s*(?:mm)?\s*(?:tube|pipe|chs)\b/.exec(s);
  if (tube) return { sec: { shape: 'tube', d: Number(tube[1]) / 1000, t: Number(tube[2]) / 1000 }, text: tube[0] };
  const round = /(\d+(?:\.\d+)?)\s*mm\s*(?:round|rod|bar|diameter|dia\.?)\b|(?:round|rod|bar)\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*mm\b/.exec(s);
  if (round) return { sec: { shape: 'round', d: Number(round[1] ?? round[2]) / 1000 }, text: round[0] };
  return rectIn(s);
}

const MIDDLE = /\b(?:in the (?:middle|centre|center)|at (?:the )?(?:middle|centre|center|mid-?span|half ?way)|mid-?span|central(?:ly)?|halfway)\b/;

function beamFrom(s0: string): { inputs: Record<string, unknown>; filled: string[] } {
  const inputs: Record<string, unknown> = {};
  const sec = sectionIn(s0);
  const s = sec ? s0.replace(sec.text, ' ') : s0;
  if (sec) inputs.section = sec.sec;
  const toks = tokens(s);
  const lens = of(toks, 'length');
  const atTok = lens.find((l) => /\b(?:at|from)\s*$/.test(before(s, l.at, 6)) && !/\bspan\b/.test(after(s, l.end, 8)));
  const spanTok = lens.find((l) => l !== atTok);
  if (spanTok) inputs.span = spanTok.si;
  if (atTok) inputs.at = atTok.si;
  const udl = of(toks, 'lineload')[0];
  if (udl) inputs.udl = udl.si;
  const force = of(toks, 'force').find((f) => !udl || f.at !== udl.at);
  if (force) inputs.load = force.si;
  else {
    const mass = of(toks, 'mass')[0];
    if (mass) inputs.load = mass.si * 9.80665;
  }
  if (inputs.at == null && MIDDLE.test(s) && typeof inputs.span === 'number') inputs.at = inputs.span / 2;
  if (/\bcantilever\w*|\bsticks? out\b|\bbracket\b/.test(s)) inputs.support = 'cantilever';
  else if (/\bfixed (?:at )?both ends\b|\bbuilt[- ]in (?:at )?both\b|\bboth ends fixed\b|\bencastr\w*/.test(s)) inputs.support = 'fixed';
  else if (/\bsimply supported\b|\bsits? on (?:two|2) (?:walls|supports)\b/.test(s)) inputs.support = 'simple';
  const mat = materialOf(s);
  if (mat) inputs.material = mat;
  if (/\bown weight\b|\bself[- ]weight\b/.test(s)) inputs.selfWeight = true;
  return { inputs, filled: Object.keys(inputs) };
}

function columnFrom(s0: string): { inputs: Record<string, unknown>; filled: string[] } {
  const inputs: Record<string, unknown> = {};
  const sec = sectionIn(s0);
  const s = sec ? s0.replace(sec.text, ' ') : s0;
  if (sec) inputs.section = sec.sec;
  const toks = tokens(s);
  const len = of(toks, 'length')[0];
  if (len) inputs.length = len.si;
  const f = of(toks, 'force')[0];
  if (f) inputs.load = f.si;
  else {
    const mass = of(toks, 'mass')[0];
    if (mass) inputs.load = mass.si * 9.80665;
  }
  if (/\bflag ?pole\b|\bfree (?:at the )?top\b|\bfixed (?:at the )?(?:base|foot|bottom)\b(?! and)/.test(s)) inputs.ends = 'fixed-free';
  else if (/\bfixed\b.*\bpinned\b|\bpinned\b.*\bfixed\b/.test(s)) inputs.ends = 'fixed-pinned';
  else if (/\bfixed (?:at )?both\b|\bboth ends fixed\b/.test(s)) inputs.ends = 'fixed';
  else if (/\bpinned\b/.test(s)) inputs.ends = 'pinned';
  const mat = materialOf(s);
  if (mat) inputs.material = mat;
  return { inputs, filled: Object.keys(inputs) };
}

function gearsFrom(s: string): { inputs: Record<string, unknown>; filled: string[] } {
  const inputs: Record<string, unknown> = {};
  const toks = tokens(s);
  const rpm = of(toks, 'rpm')[0];
  if (rpm) inputs.rpm = rpm.si;
  const torque = of(toks, 'torque')[0];
  if (torque) inputs.torque = torque.si;
  if (/\bpulleys?\b|\bbelt\b/.test(s)) {
    const d = of(toks, 'length').map((x) => x.si);
    const stages: { kind: string; driver: number; driven: number }[] = [];
    for (let i = 0; i + 1 < d.length; i += 2) stages.push({ kind: 'belt', driver: d[i]!, driven: d[i + 1]! });
    if (stages.length) inputs.stages = stages;
  } else {
    // "3:1" or "3.5 to 1" is a ratio, not teeth
    const ratio = /(?<![\d.])(\d+(?:\.\d+)?)\s*(?::|to)\s*1(?![\d.])/.exec(s);
    if (ratio && !/\bteeth\b|\btooth\b/.test(s) && Number(ratio[1]) > 0) inputs.stages = [{ kind: 'ratio', driver: 1, driven: Number(ratio[1]) }];
    else {
      // the teeth: every whole number not written with a unit, in order, paired driver → driven
      const used = new Set(toks.flatMap((t) => Array.from({ length: t.end - t.at }, (_, i) => t.at + i)));
      const teeth: number[] = [];
      const re = /(?<![\d.])(\d{1,3})(?![\d.])/g;
      for (let m = re.exec(s); m; m = re.exec(s)) if (!used.has(m.index)) teeth.push(Number(m[1]));
      if (teeth.length >= 2) {
        const stages: { kind: string; driver: number; driven: number }[] = [];
        for (let i = 0; i + 1 < teeth.length; i += 2) stages.push({ kind: 'gear', driver: teeth[i]!, driven: teeth[i + 1]! });
        inputs.stages = stages;
      }
    }
  }
  return { inputs, filled: Object.keys(inputs) };
}

function bikeFrom(s: string): { inputs: Record<string, unknown>; filled: string[] } {
  const inputs: Record<string, unknown> = {};
  const pair = /(?<![\d.])(\d{2})\s*(?:\/|x|-|and|by)\s*(\d{1,2})(?![\d.])/.exec(s);
  if (pair) {
    inputs.chainring = Number(pair[1]);
    inputs.sprocket = Number(pair[2]);
  }
  if (/\b700 ?c\b/.test(s)) inputs.wheel = 0.672;
  else if (/\b650 ?b\b|\b27\.5\b/.test(s)) inputs.wheel = 0.69;
  else if (/\b29(?:er| ?inch| ?in\b|")/.test(s)) inputs.wheel = 0.74;
  else {
    const w = /(\d{2}(?:\.\d)?)\s*(?:inch|in|")\s*wheels?/.exec(s);
    if (w) inputs.wheel = Number(w[1]) * 0.0254;
  }
  const rpm = of(tokens(s), 'rpm')[0];
  if (rpm) inputs.cadence = rpm.si;
  return { inputs, filled: Object.keys(inputs) };
}

function engineFrom(s: string): { inputs: Record<string, unknown>; filled: string[] } {
  const inputs: Record<string, unknown> = {};
  const toks = tokens(s);
  const vol = of(toks, 'volume')[0];
  if (vol && vol.si > 1e-5 && vol.si < 0.03) inputs.displacement = vol.si;
  const rpm = of(toks, 'rpm')[0];
  if (rpm) inputs.rpm = rpm.si;
  const p = of(toks, 'power')[0];
  if (p) inputs.power = p.si;
  if (/\bdiesel\b|\btdi\b|\bcdti\b|\bhdi\b|\bcrdi\b|\bdci\b/.test(s)) inputs.type = 'diesel';
  else if (/\bturbo\w*|\btsi\b|\btfsi\b|\becoboost\b|\bsuper ?charged\b|\bboosted\b/.test(s)) inputs.type = 'turbo';
  else if (/\bpetrol\b|\bnaturally aspirated\b|\bn\/a\b/.test(s)) inputs.type = 'na';
  const cr = /\bcompression(?: ratio)?(?: of)?\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*:\s*1\s*compression/.exec(s);
  if (cr) inputs.cr = Number(cr[1] ?? cr[2]);
  return { inputs, filled: Object.keys(inputs) };
}

function speedIn(toks: Tok[]): number | undefined {
  return of(toks, 'speed')[0]?.si;
}

function wingFrom(s0: string): { inputs: Record<string, unknown>; filled: string[] } {
  const inputs: Record<string, unknown> = {};
  const naca = /\bnaca\s*-?\s*(\d{4})\b/.exec(s0);
  if (naca) inputs.naca = naca[1];
  const s = naca ? s0.replace(naca[0], ' ') : s0;
  const toks = tokens(s);
  const area = of(toks, 'area')[0];
  if (area) inputs.area = area.si;
  const lens = of(toks, 'length');
  const spanTok = lens.find((l) => /\bspan\b/.test(after(s, l.end, 10)) || /\bspan(?: of)?\s*$/.test(before(s, l.at, 10)));
  if (spanTok) inputs.span = spanTok.si;
  const altTok = lens.find((l) => l !== spanTok && (/\b(?:altitude|up|high|feet up)\b/.test(after(s, l.end, 12)) || /\b(?:altitude(?: of)?|at)\s*$/.test(before(s, l.at, 12))));
  if (altTok) inputs.altitude = altTok.si;
  const v = speedIn(toks);
  if (v != null) inputs.speed = v;
  const a = of(toks, 'angle')[0];
  if (a) inputs.alpha = a.si;
  const m = of(toks, 'mass')[0];
  if (m) inputs.mass = m.si;
  return { inputs, filled: Object.keys(inputs) };
}

function carFrom(s: string): { inputs: Record<string, unknown>; filled: string[] } {
  const inputs: Record<string, unknown> = {};
  const toks = tokens(s);
  const v = speedIn(toks);
  if (v != null) inputs.speed = v;
  const cd = /\b(?:cd|drag coefficient)\s*(?:of|=|is)?\s*(0?\.\d+|\d(?:\.\d+)?)\b/.exec(s);
  if (cd) inputs.cd = Number(cd[1]);
  const areas = of(toks, 'area');
  const wingA = areas.find((a) => /\b(?:rear )?wing\b/.test(after(s, a.end, 12)));
  if (wingA) inputs.wingArea = wingA.si;
  const front = areas.find((a) => a !== wingA);
  if (front) inputs.area = front.si;
  const m = of(toks, 'mass')[0];
  if (m) inputs.mass = m.si;
  return { inputs, filled: Object.keys(inputs) };
}

function fallFrom(s: string): { inputs: Record<string, unknown>; filled: string[] } {
  const inputs: Record<string, unknown> = {};
  const toks = tokens(s);
  const m = of(toks, 'mass')[0];
  if (m) inputs.mass = m.si;
  const a = of(toks, 'area')[0];
  if (a) inputs.area = a.si;
  const cd = /\b(?:cd|drag coefficient)\s*(?:of|=|is)?\s*(0?\.\d+|\d(?:\.\d+)?)\b/.exec(s);
  if (cd) inputs.cd = Number(cd[1]);
  return { inputs, filled: Object.keys(inputs) };
}

function projectileFrom(s: string): { inputs: Record<string, unknown>; filled: string[] } {
  const inputs: Record<string, unknown> = {};
  const toks = tokens(s);
  const v = speedIn(toks);
  if (v != null) inputs.speed = v;
  const a = of(toks, 'angle')[0];
  if (a) inputs.angle = a.si;
  const h = of(toks, 'length').find((l) => /\b(?:from|off|height of|at a height of)\s*(?:a\s*)?$/.test(before(s, l.at, 16)) || /\b(?:high|up|tall)\b/.test(after(s, l.end, 8)));
  if (h) inputs.height = h.si;
  const m = of(toks, 'mass')[0];
  if (m) inputs.mass = m.si;
  if (/\bvacuum\b|\bno (?:air|drag)\b|\bwithout (?:air|drag)\b/.test(s)) inputs.drag = false;
  return { inputs, filled: Object.keys(inputs) };
}

function orbitFrom(s: string): { inputs: Record<string, unknown>; filled: string[] } {
  const inputs: Record<string, unknown> = {};
  if (/\bmoon\b|\blunar\b/.test(s)) inputs.body = 'moon';
  else if (/\bmars\b|\bmartian\b/.test(s)) inputs.body = 'mars';
  else if (/\bearth\b/.test(s)) inputs.body = 'earth';
  const lens = of(tokens(s), 'length');
  const toTok = lens.find((l) => /\bto\s*$/.test(before(s, l.at, 4)));
  const alt = lens.find((l) => l !== toTok);
  if (alt) inputs.altitude = alt.si;
  else if (/\biss\b|\bspace station\b/.test(s)) inputs.altitude = 420_000;
  if (toTok) inputs.to = toTok.si;
  else if (/\bto (?:a )?geo(?:stationary)?\b/.test(s)) inputs.to = 35_786_000;
  return { inputs, filled: Object.keys(inputs) };
}

const MAT_WORDS = Object.keys(LAYER_MATS).concat(['bricks', 'brickwork', 'blockwork', 'blocks', 'insulation', 'wool', 'rockwool', 'celotex', 'kingspan', 'polystyrene', 'drywall', 'air gap', 'mineral wool', 'plaster board', 'lightweight block']).sort((a, b) => b.length - a.length);
const LAYER_RE = new RegExp(`(?:(\\d+(?:\\.\\d+)?)\\s*(mm|cm)\\s*(?:of\\s*)?(${MAT_WORDS.map(esc).join('|')})|(${MAT_WORDS.map(esc).join('|')})\\s*(\\d+(?:\\.\\d+)?)\\s*(mm|cm)?)(?![a-z])`, 'g');
const MAT_KEY: [RegExp, string][] = [
  [/^brick/, 'brick'], [/^(?:dense )?(?:block|blockwork|blocks)$/, 'block'], [/^lightweight block|^lightblock/, 'lightblock'], [/^(?:mineral ?wool|wool|rockwool|insulation|mineralwool)$/, 'mineralwool'],
  [/^(?:pir|celotex|kingspan)$/, 'pir'], [/^(?:eps|polystyrene)$/, 'eps'], [/^(?:plaster ?board|drywall)$/, 'plasterboard'], [/^(?:cavity|air gap)$/, 'cavity'],
];

function heatFrom(s: string): { inputs: Record<string, unknown>; filled: string[] } {
  const inputs: Record<string, unknown> = {};
  const layers: Layer[] = [];
  LAYER_RE.lastIndex = 0;
  for (let m = LAYER_RE.exec(s); m; m = LAYER_RE.exec(s)) {
    const word = (m[3] ?? m[4] ?? '').trim();
    const n = Number(m[1] ?? m[5]);
    const u = m[2] ?? m[6] ?? 'mm';
    const key = MAT_KEY.find(([re]) => re.test(word))?.[1] ?? (LAYER_MATS[word] ? word : null);
    if (key && n > 0) layers.push({ mat: key, thickness: n * (u === 'cm' ? 0.01 : 0.001) });
  }
  if (layers.length) inputs.layers = layers;
  const rest = layers.length ? s.replace(LAYER_RE, ' ') : s;
  const toks = tokens(rest);
  const area = of(toks, 'area')[0];
  if (area) inputs.floor = area.si;
  const temps = of(toks, 'temperature');
  for (const t of temps) {
    if (/\b(?:inside|indoors|in)\b/.test(after(rest, t.end, 10)) || /\binside(?: at)?\s*$/.test(before(rest, t.at, 10))) inputs.inside = t.si;
    else if (/\b(?:outside|outdoors|out)\b/.test(after(rest, t.end, 10)) || /\boutside(?: at)?\s*$/.test(before(rest, t.at, 10))) inputs.outside = t.si;
  }
  const dT = of(toks, 'deltaT').find((d) => /\b(?:k|kelvin)\b/.test(rest.slice(d.at, d.end + 2)) || /\b(?:difference|colder|warmer)\b/.test(after(rest, d.end, 14)));
  if (dT && inputs.inside == null && inputs.outside == null) {
    inputs.inside = 294.15;
    inputs.outside = 294.15 - dT.si;
  }
  const ach = /(\d+(?:\.\d+)?)\s*(?:air changes|ach)\b/.exec(rest);
  if (ach) inputs.ach = Number(ach[1]);
  const p = /(\d+(?:\.\d+)?)\s*p(?:ence)?\s*(?:\/|per|a)\s*kwh/.exec(rest);
  const pounds = /£\s*(\d+(?:\.\d+)?)\s*(?:\/|per|a)\s*kwh/.exec(rest);
  if (p) inputs.tariff = Number(p[1]) / 100;
  else if (pounds) inputs.tariff = Number(pounds[1]);
  if (/\bheat ?pump\b/.test(rest)) inputs.fuel = 'heatpump';
  else if (/\belectric\b/.test(rest)) inputs.fuel = 'electric';
  return { inputs, filled: Object.keys(inputs) };
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function sunFrom(s: string): { inputs: Record<string, unknown>; filled: string[] } {
  const inputs: Record<string, unknown> = {};
  const h = of(tokens(s), 'length')[0];
  if (h) inputs.height = h.si;
  const t = /\bat (\d{1,2})(?::(\d\d))?\s*(am|pm)?\b/.exec(s);
  if (t && (t[2] || t[3])) {
    let hr = Number(t[1]) % 12;
    if (t[3] === 'pm') hr += 12;
    if (!t[3]) hr = Number(t[1]);
    if (hr < 24) inputs.time = `${String(hr).padStart(2, '0')}:${t[2] ?? '00'}`;
  } else if (/\bat (?:mid-?day|noon)\b/.test(s)) inputs.time = 'noon';
  const d = /\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:of\s*)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{1,2})(?:st|nd|rd|th)?\b/.exec(s);
  if (d) inputs.date = `${String(MONTHS.indexOf((d[2] ?? d[3])!) + 1).padStart(2, '0')}-${String(Number(d[1] ?? d[4])).padStart(2, '0')}`;
  else if (/\bmid-?summer\b|\bsummer solstice\b|\blongest day\b/.test(s)) inputs.date = '06-21';
  else if (/\bmid-?winter\b|\bwinter solstice\b|\bshortest day\b/.test(s)) inputs.date = '12-21';
  else if (/\b(?:spring )?equinox\b/.test(s)) inputs.date = /\bautumn\b/.test(s) ? '09-22' : '03-20';
  return { inputs, filled: Object.keys(inputs) };
}

function circuitFrom(s: string): { inputs: Record<string, unknown>; filled: string[] } {
  const inputs: Record<string, unknown> = {};
  // "100 and 100 ohm": a unit written once after a list of numbers
  const listed = s.replace(/(\d+(?:\.\d+)?)\s*(?:,|and|&|\+)\s*(?=\d+(?:\.\d+)?\s*(?:,|and|&|\+)?\s*\d*\s*(k|m)?\s*(?:ohms?|Ω|r)\b)/g, (_m, n: string, k?: string) => `${n} ${k ?? ''}ohm, `);
  const toks = tokens(listed);
  const volts = of(toks, 'voltage');
  const amps = of(toks, 'current');
  const ohms = of(toks, 'resistance');
  const caps = of(toks, 'capacitance');
  const watts = of(toks, 'power');
  let mode: string;
  if (/\bleds?\b/.test(s)) mode = 'led';
  else if (/\bdivider\b/.test(s)) mode = 'divider';
  else if (/\bparallel\b|\bseries\b/.test(s)) mode = 'resistors';
  else if (/\bcapacitors?\b|\btime constant\b|\brc\b/.test(s) || caps.length) mode = 'rc';
  else if (/\brunning cost\b|\bcost to run\b|\bkwh\b|\bper (?:day|year)\b|\ba (?:day|year)\b/.test(s) && watts.length) mode = 'power';
  else mode = 'ohm';
  inputs.mode = mode;
  if (mode === 'led') {
    const vfTok = volts.find((v) => /\b(?:vf|forward(?: voltage)?)\s*(?:of\s*)?$/.test(before(listed, v.at, 16)) || /\b(?:forward|vf)\b/.test(after(listed, v.end, 10)));
    const sup = volts.find((v) => v !== vfTok);
    if (sup) inputs.supply = sup.si;
    if (vfTok) inputs.vf = vfTok.si;
    else if (/\b(?:blue|white|uv)\b/.test(s)) inputs.vf = 3.1;
    else if (/\bgreen\b/.test(s)) inputs.vf = 2.1;
    else if (/\b(?:red|yellow|orange|amber)\b/.test(s)) inputs.vf = 2;
    if (amps[0]) inputs.current = amps[0].si;
  } else if (mode === 'divider') {
    const vout = volts.find((v) => /\b(?:to get|want|out(?:put)?|for)\s*(?:a\s*)?$/.test(before(listed, v.at, 12)));
    const vin = volts.find((v) => v !== vout);
    if (vin) inputs.vin = vin.si;
    if (vout) inputs.vout = vout.si;
    if (ohms[0]) inputs.r1 = ohms[0].si;
    if (ohms[1]) inputs.r2 = ohms[1].si;
  } else if (mode === 'resistors') {
    if (ohms.length) inputs.rs = ohms.map((o) => o.si);
  } else if (mode === 'rc') {
    if (ohms[0]) inputs.r = ohms[0].si;
    if (caps[0]) inputs.c = caps[0].si;
  } else if (mode === 'power') {
    inputs.watts = watts[0]!.si;
    const hrs = /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\s*(?:a|per|each)\s*day/.exec(s);
    if (hrs) inputs.hours = Number(hrs[1]);
    const p = /(\d+(?:\.\d+)?)\s*p(?:ence)?\s*(?:\/|per|a)\s*kwh/.exec(s);
    if (p) inputs.tariff = Number(p[1]) / 100;
  } else {
    if (volts[0]) inputs.v = volts[0].si;
    if (amps[0]) inputs.i = amps[0].si;
    if (ohms[0]) inputs.r = ohms[0].si;
  }
  return { inputs, filled: Object.keys(inputs).filter((k) => k !== 'mode') };
}

const READERS: Record<WorkKind, (s: string) => { inputs: Record<string, unknown>; filled: string[] }> = {
  beam: beamFrom, column: columnFrom, gears: gearsFrom, bike: bikeFrom, engine: engineFrom, wing: wingFrom, car: carFrom, fall: fallFrom,
  projectile: projectileFrom, orbit: orbitFrom, heat: heatFrom, sun: sunFrom, circuit: circuitFrom, tunnel: () => ({ inputs: {}, filled: [] }),
};

/** His words → the kind of problem and the inputs they carry (null: nothing the workbench solves). `kind` forces the kind. */
export function parseProblem(text: string, kind?: WorkKind): Problem | null {
  const k = kind && READERS[kind] ? kind : kindOf(text);
  if (!k) return null;
  const { inputs, filled } = READERS[k](normalise(text));
  return { kind: k, inputs, filled };
}

/** A short command naming a panel ("wind tunnel", "open the beam calculator", "sun and shadow") → the panel; null otherwise. */
const COMMANDS: [RegExp, Panel | ''][] = [
  [/^(?:the )?wind ?tunnel$/, 'tunnel'],
  [/^(?:the |my )?(?:engineering )?workbench$/, ''],
  [/^(?:a |the )?(?:beams?|joists?|lintels?|deflection)(?: calculator| calc| sizer)?$/, 'beam'],
  [/^(?:a |the )?(?:columns?|buckling)(?: calculator| calc)?$/, 'column'],
  [/^(?:the )?(?:gears?|gear ratios?|gearbox|bike gears?|gear inches)(?: calculator| calc)?$/, 'gears'],
  [/^(?:the )?(?:engine(?: power)?|horse ?power|bhp|engine cycle)(?: calculator| calc)?$/, 'engine'],
  [/^(?:the )?(?:wings?|lift and drag|aero ?foils?|air ?foils?|car drag|terminal velocity|aero(?:dynamics)?)(?: calculator| calc)?$/, 'wing'],
  [/^(?:the )?(?:projectiles?|trajectory)(?: calculator| calc)?$/, 'projectile'],
  [/^(?:the )?(?:orbits?|escape velocity|hohmann(?: transfer)?)(?: calculator| calc)?$/, 'orbit'],
  [/^(?:the )?(?:heat ?loss|u-?values?|insulation|radiator size)(?: calculator| calc)?$/, 'heat'],
  [/^(?:the )?(?:sun (?:and|&) shadows?|shadows?|sun angles?|sun position)(?: calculator| calc)?$/, 'sun'],
  [/^(?:an? |the )?(?:led resistor|resistors?|circuits?|ohm'?s law|voltage divider)(?: calculator| calc)?$/, 'circuit'],
];

const QUESTION = /^(?:how|what|what's|whats|why|when|where|which|who|is|are|can|could|would|will|do|does|did|should|shall|tell|explain|please explain|help|i want|i need|i'd like|work out|calculate|estimate|compute|find)\b/;

/**
 * What the chat answers on the phone with no model: a command opening a panel (`problem` null), or a bare problem with at
 * least two of its numbers (`problem` filled: the form takes them and the chat gets the estimate). A question, or anything
 * else, is null: it goes to the brain as ever.
 */
export function workbenchAsked(text: string): { panel: Panel | ''; problem: Problem | null } | null {
  const raw = String(text ?? '').trim();
  if (!raw || raw.length > 160) return null;
  const s = raw.toLowerCase().replace(/[.!]+$/, '').replace(/^(?:please |ghosty,? |hey ghosty,? )/, '').replace(/^(?:open|show|launch|start|run|bring up|go to|take me to)\s+(?:me\s+)?(?:up\s+)?/, '').replace(/\s+please$/, '').replace(/\s+on the workbench$/, '').trim();
  for (const [re, panel] of COMMANDS) if (re.test(s)) return { panel, problem: null };
  if (/\?\s*$/.test(raw) || QUESTION.test(raw.toLowerCase())) return null;
  const p = parseProblem(raw);
  if (!p || p.kind === 'tunnel' || p.filled.length < 2) return null;
  return { panel: PANEL_OF[p.kind], problem: p };
}
