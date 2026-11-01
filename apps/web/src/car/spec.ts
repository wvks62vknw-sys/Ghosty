/**
 * THE CAR FROM THE FACTS (BRIEF-CAR item 1; OWNER-ISSUES 91a "he makes it in literal 3d"): what the vehicle check gives for
 * a plate — make, model (DVSA has it), colour, year, fuel, a body type where the record has one — becomes a CarSpec: the
 * silhouette (from the model's known family, then the body words, then the make; a sensible hatchback with `exact: false`
 * when it is a guess), the paint from the colour word, the doors, roof rails, a saloon's boot line and the proportions
 * (wheelbase, overhangs, greenhouse, shoulder line) the 3-D body is built from (car/body.ts). Pure: the brain's tests
 * read it (apps/edge/test/car.test.mjs). Nothing here is kept: the record is the public one, shown and never stored.
 *
 * There is no free photoreal model of a given car, so this is a stand-in, said once in the UI (STAND_IN): the shape,
 * colour and plate are the car's; the parts are where they are on most cars like it.
 */
import type { VehicleAnswer } from '../../../../packages/shared/src/plates';
import { formatPlate } from '../../../../packages/shared/src/plates';

export type Silhouette = 'hatchback' | 'saloon' | 'estate' | 'suv' | 'mpv' | 'van' | 'coupe' | 'pickup';
/** City car and supermini · family · large. */
export type Size = 'S' | 'M' | 'L';

/** What the record says about the car (any of it may be missing). */
export interface CarFacts {
  plate: string;
  make?: string;
  model?: string;
  colour?: string;
  year?: number | null;
  fuel?: string;
  /** A body type word when the record has one ("HATCHBACK", "ESTATE", "PANEL VAN"…). */
  body?: string;
}

export interface Paint {
  /** "metallic silver" */
  name: string;
  hex: number;
  metallic: boolean;
}

/** The proportions, in metres (x along the car, front +; y up; z across, the driver's side +). */
export interface CarDims {
  length: number;
  width: number;
  height: number;
  wheelbase: number;
  /** Front overhang: the front bumper to the front axle. */
  front: number;
  rear: number;
  clearance: number;
  /** The tyre's outer radius, the rim's radius, the tyre's width. */
  tyreR: number;
  rimR: number;
  tyreW: number;
}

/**
 * The side line along the car: `top` as [u, height ÷ H] from the front bumper (u 0) to the rear (u 1); where the
 * windscreen starts and ends (ws0, ws1), where the roof ends (r1), where the rear glass ends (tail), the shoulder line.
 */
export interface Profile {
  top: [number, number][];
  ws0: number;
  ws1: number;
  r1: number;
  tail: number;
  belt: number;
  /** The side windows run from `a` to `c`; the B-pillar is at `b` (0: none). */
  a: number;
  b: number;
  c: number;
}

export interface CarSpec {
  /** As written on the car ("AB12 CDE"); '' when there is none. */
  plate: string;
  make: string;
  model: string;
  /** "Blue Volkswagen Golf", or "A car" with nothing known. */
  title: string;
  silhouette: Silhouette;
  size: Size;
  /** False when the shape is a guess (the model is not one I know, or there is no record). */
  exact: boolean;
  /** False when there was no record at all (only a plate, or nothing). */
  known: boolean;
  paint: Paint;
  year: number | null;
  fuel: 'petrol' | 'diesel' | 'electric' | 'hybrid' | '';
  electric: boolean;
  doors: number;
  roofRails: boolean;
  /** A saloon's boot step behind the rear window. */
  bootLine: boolean;
  /** The load bed of a pickup, behind the cab. */
  bed: boolean;
  dims: CarDims;
  profile: Profile;
}

// ---------------------------------------------------------------- the paints

/** DVLA's and DVSA's colour words to a real paint: the common finish for that colour on UK cars. */
export const PAINTS: Record<string, Paint> = {
  black: { name: 'metallic black', hex: 0x0b0c0e, metallic: true },
  white: { name: 'solid white', hex: 0xf1f1ec, metallic: false },
  silver: { name: 'metallic silver', hex: 0xb9bdc1, metallic: true },
  grey: { name: 'metallic grey', hex: 0x5a5f65, metallic: true },
  blue: { name: 'metallic blue', hex: 0x1d4a96, metallic: true },
  red: { name: 'solid red', hex: 0xa3121b, metallic: false },
  green: { name: 'metallic green', hex: 0x1d4d33, metallic: true },
  yellow: { name: 'solid yellow', hex: 0xf0bf00, metallic: false },
  orange: { name: 'solid orange', hex: 0xdf5a0a, metallic: false },
  gold: { name: 'metallic gold', hex: 0xb38d55, metallic: true },
  beige: { name: 'metallic beige', hex: 0xc4b596, metallic: true },
  brown: { name: 'metallic brown', hex: 0x55372a, metallic: true },
  maroon: { name: 'metallic maroon', hex: 0x5a1420, metallic: true },
  purple: { name: 'metallic purple', hex: 0x48296a, metallic: true },
  pink: { name: 'solid pink', hex: 0xe28db2, metallic: false },
  turquoise: { name: 'metallic turquoise', hex: 0x168a8e, metallic: true },
  bronze: { name: 'metallic bronze', hex: 0x8a5a2c, metallic: true },
  cream: { name: 'solid cream', hex: 0xe6dcc2, metallic: false },
};
/** No colour on record (or "multi-colour", "not stated"): silver, the UK's commonest. */
export const NO_PAINT: Paint = { name: 'silver (colour not on record)', hex: 0xb9bdc1, metallic: true };

export function paintFor(colour: string | undefined): Paint {
  const w = String(colour ?? '').toLowerCase().replace(/[^a-z]/g, '');
  return PAINTS[w === 'gray' ? 'grey' : w] ?? NO_PAINT;
}

// ---------------------------------------------------------------- the families: a model's name to its shape

/** [silhouette, size, the model names that start with these words (DVSA's spelling, lower case)]. */
const FAMILIES: [Silhouette, Size, string][] = [
  ['hatchback', 'S', 'fiesta|ka|ka+|polo|up|lupo|fox|corsa|adam|agila|viva|clio|twingo|zoe|108|107|206|207|208|e-208|c1|c2|c3|ds3|yaris|aygo|iq|micra|note|i10|i20|picanto|rio|jazz|swift|alto|celerio|splash|baleno|fabia|citigo|ibiza|mii|500|panda|punto|mini|one|cooper|a1|mazda2|2|colt|space star|mirage|sandero|spark|matiz|i3|id.3|leaf|honda e|corsa-e|smart|fortwo|forfour|e-up'],
  ['hatchback', 'M', 'focus|golf|astra|megane|308|307|306|c4|ds4|auris|corolla|prius|i30|ceed|cee\'d|pro_ceed|civic|leon|octavia|scala|rapid|1 series|a3|a-class|a class|mazda3|3|tipo|bravo|delta|giulietta|mito|pulsar|almera|lancer|ioniq|e-golf|born|megane e-tech|v40|ct|insight|impreza|cruze|kona electric'],
  ['hatchback', 'L', 'insignia|mondeo|vectra|signum|laguna|talisman|arteon'],
  ['saloon', 'S', 'jetta|sentra'],
  ['saloon', 'M', '3 series|a4|c-class|c class|xe|is|passat|superb|model 3|giulia|mazda6|6|avensis|accord|508|407|406|cla|a5 sportback|4 series gran coupe|2 series gran coupe|polestar 2|s60|camry|cee\'d saloon'],
  ['saloon', 'L', '5 series|7 series|a6|a7|a8|e-class|e class|s-class|s class|xf|xj|gs|ls|model s|panamera|taycan|i4|i5|i7|eqe|eqs|s90|phaeton|quattroporte|ghibli'],
  ['estate', 'M', 'v50|v60|outback|levorg|cee\'d sw|octavia estate|focus estate|golf estate|astra estate|308 sw|leon st'],
  ['estate', 'L', 'v70|v90|xc70|legacy|passat estate|superb estate|mondeo estate|insignia sports tourer|5 series touring|a6 avant|e-class estate'],
  ['suv', 'S', 'juke|t-cross|t cross|stonic|captur|2008|e-2008|c3 aircross|crossland|mokka|ecosport|arona|kamiq|kona|tivoli|jimny|ignis|vitara|s-cross|x1|q2|gla|500x|renegade|cx-3|hr-v|yaris cross|aygo x|puma|duster|countryman|ev3|eq a|eqa|ux|c-hr|niro|soul|venue|bayon|taigo|a2'],
  ['suv', 'M', 'qashqai|x-trail|kuga|tiguan|t-roc|sportage|tucson|ix35|rav4|cr-v|cx-5|cx-30|3008|5008|c5 aircross|grandland|kadjar|koleos|austral|arkana|ateca|tarraco|karoq|kodiaq|yeti|x3|x2|q3|q5|glb|glc|xc40|xc60|evoque|discovery sport|freelander|e-pace|macan|outlander|asx|eclipse cross|forester|xv|korando|model y|id.4|id.5|enyaq|ioniq 5|ev6|mach-e|e-tron|q4|eqc|ix|nx|compass|cherokee|sorento|santa fe|edge|terrano|frontera|antara|captiva|sportage'],
  ['suv', 'L', 'range rover|range rover sport|velar|discovery|defender|land cruiser|x5|x6|x7|q7|q8|gle|gls|g-class|g class|xc90|cayenne|touareg|f-pace|model x|ix xdrive|eqs suv|rexton|wrangler|grand cherokee|shogun|pajero|explorer|navara suv'],
  ['mpv', 'S', 'b-max|meriva|note mpv|venga|ix20|roomster|modus|soul mpv'],
  ['mpv', 'M', 'c-max|grand c-max|touran|zafira|zafira tourer|scenic|grand scenic|c4 picasso|grand c4 picasso|c4 spacetourer|xsara picasso|verso|corolla verso|carens|b-class|b class|2 series active tourer|2 series gran tourer|altea|5008 mpv|rifter|berlingo multispace|partner tepee|caddy life|caddy maxi life|doblo'],
  ['mpv', 'L', 's-max|galaxy|sharan|alhambra|espace|grand espace|v-class|v class|multivan|caravelle|tourneo custom|zafira life|spacetourer|traveller|alphard'],
  ['van', 'S', 'transit connect|transit courier|caddy|berlingo|partner|combo|kangoo|citan|doblo cargo|nv200|bipper|nemo|fiorino|proace city|courier|connect|townstar|e-berlingo|e-partner|e-nv200'],
  ['van', 'M', 'transit custom|vivaro|trafic|primastar|vito|transporter|t5|t6|t6.1|expert|dispatch|scudo|proace|talento|nv300|e-transit custom|e-vivaro|abt e-transporter|ld|deliver 7|e-deliver 7'],
  ['van', 'L', 'transit|sprinter|crafter|movano|master|interstar|boxer|relay|ducato|daily|nv400|e-transit|e-sprinter|e-crafter|deliver 9|e-deliver 9|tge'],
  ['coupe', 'S', 'mx-5|mx5|z4|boxster|slk|slc|tt roadster|124 spider|gt86 roadster|elise|exige|s2000|spider'],
  ['coupe', 'M', 'tt|rcz|brz|gt86|gr86|86|370z|350z|z|scirocco|cayman|911|mustang|supra|gr supra|camaro|rc|4 series|2 series coupe|m2|m4|a5|a5 coupe|c-class coupe|e-class coupe|clk|f-type|sl|r8|gt-r|amg gt|cupra formentor coupe|celica|prelude|eclipse|veloster|elan|evora|emira|vantage|db11|continental gt|california|portofino|roma|huracan|720s|artura|i8'],
  ['pickup', 'M', 'hilux|ranger|l200|triton|navara|d-max|amarok|x-class|ranger raptor|musso|great wall|t60|isuzu tf|rodeo|maverick|ram|f-150|tundra|titan|gladiator'],
];

/** Every family name, longest first, so "transit custom" is found before "transit" and "range rover sport" before "range rover". */
const FAMILY_LIST: { words: string; s: Silhouette; size: Size }[] = FAMILIES.flatMap(([s, size, list]) => list.split('|').map((words) => ({ words, s, size }))).sort((a, b) => b.words.length - a.words.length);

/** What the make alone says when the model is not one I know: [silhouette, size]. */
const MAKES: Record<string, [Silhouette, Size]> = {
  'land rover': ['suv', 'L'], 'range rover': ['suv', 'L'], jeep: ['suv', 'M'], ssangyong: ['suv', 'M'], isuzu: ['pickup', 'M'], ldv: ['van', 'M'], maxus: ['van', 'M'],
  iveco: ['van', 'L'], man: ['van', 'L'], porsche: ['coupe', 'M'], tesla: ['saloon', 'M'], smart: ['hatchback', 'S'], mini: ['hatchback', 'S'], 'aston martin': ['coupe', 'M'],
  ferrari: ['coupe', 'M'], lamborghini: ['coupe', 'M'], mclaren: ['coupe', 'M'], lotus: ['coupe', 'S'], bentley: ['saloon', 'L'], 'rolls royce': ['saloon', 'L'], 'rolls-royce': ['saloon', 'L'],
  maserati: ['saloon', 'L'], jaguar: ['saloon', 'M'], 'london taxi': ['mpv', 'L'], lti: ['mpv', 'L'], lev: ['mpv', 'L'],
};

/** The body words a record or a model name can carry, which outrank the family (a Focus can be an estate). */
const BODY_WORDS: [RegExp, Silhouette][] = [
  [/\b(?:pick-?up|double cab|d\/cab|crew cab|dbl cab|super cab|king cab)\b/, 'pickup'],
  [/\b(?:panel van|van|l\dh\d|lwb|mwb|swb|crew van|window van|box van|luton|chassis cab|tipper)\b/, 'van'],
  [/\b(?:estate|tourer|touring|avant|variant|sw|sportwagon|sports? wagon|kombi|shooting brake|allroad|alltrack|wagon)\b/, 'estate'],
  [/\b(?:saloon|sedan|limousine)\b/, 'saloon'],
  [/\b(?:coupe|coupé|cabriolet|convertible|roadster|spider|spyder|targa)\b/, 'coupe'],
  [/\b(?:mpv|people carrier|multispace|spacetourer)\b/, 'mpv'],
  [/\b(?:suv|4x4|crossover|off-?road)\b/, 'suv'],
  [/\b(?:hatchback|hatch)\b/, 'hatchback'],
];

const DOORS: Record<Silhouette, number> = { hatchback: 5, saloon: 4, estate: 5, suv: 5, mpv: 5, van: 3, coupe: 2, pickup: 4 };

// ---------------------------------------------------------------- the proportions

type Dims0 = [number, number, number, number, number, number, number, number, number];
/** length, width, height, wheelbase, front overhang, clearance, tyre radius, rim radius, tyre width — real cars of each shape and size. */
const DIMS: Record<Silhouette, Partial<Record<Size, Dims0>>> = {
  hatchback: { S: [4.05, 1.73, 1.48, 2.5, 0.8, 0.14, 0.3, 0.19, 0.195], M: [4.36, 1.8, 1.47, 2.65, 0.89, 0.14, 0.315, 0.205, 0.205], L: [4.87, 1.86, 1.46, 2.83, 0.95, 0.14, 0.33, 0.229, 0.225] },
  saloon: { S: [4.45, 1.76, 1.45, 2.65, 0.85, 0.14, 0.31, 0.205, 0.205], M: [4.7, 1.82, 1.44, 2.85, 0.82, 0.13, 0.32, 0.216, 0.225], L: [5.0, 1.88, 1.47, 2.98, 0.86, 0.13, 0.335, 0.229, 0.245] },
  estate: { M: [4.68, 1.8, 1.48, 2.69, 0.89, 0.14, 0.315, 0.205, 0.205], L: [4.93, 1.86, 1.5, 2.84, 0.92, 0.14, 0.33, 0.216, 0.225] },
  suv: { S: [4.15, 1.78, 1.58, 2.55, 0.82, 0.18, 0.33, 0.205, 0.215], M: [4.45, 1.84, 1.63, 2.67, 0.88, 0.19, 0.34, 0.216, 0.225], L: [4.9, 1.98, 1.8, 2.92, 0.92, 0.21, 0.37, 0.254, 0.255] },
  mpv: { S: [4.15, 1.75, 1.6, 2.6, 0.82, 0.15, 0.31, 0.19, 0.195], M: [4.53, 1.83, 1.66, 2.79, 0.86, 0.15, 0.32, 0.205, 0.205], L: [4.85, 1.92, 1.75, 2.85, 0.92, 0.16, 0.33, 0.216, 0.225] },
  van: { S: [4.4, 1.85, 1.84, 2.79, 0.85, 0.17, 0.32, 0.19, 0.205], M: [4.97, 2.0, 1.98, 2.93, 0.95, 0.18, 0.34, 0.205, 0.215], L: [5.53, 2.06, 2.5, 3.3, 1.0, 0.19, 0.355, 0.205, 0.235] },
  coupe: { S: [3.92, 1.73, 1.23, 2.31, 0.78, 0.12, 0.3, 0.216, 0.205], M: [4.25, 1.83, 1.36, 2.51, 0.85, 0.12, 0.32, 0.229, 0.235] },
  pickup: { M: [5.33, 1.86, 1.8, 3.09, 0.92, 0.23, 0.38, 0.229, 0.255] },
};

const PROFILES: Record<Silhouette, Profile> = {
  hatchback: { top: [[0, 0.4], [0.015, 0.47], [0.04, 0.53], [0.1, 0.58], [0.2, 0.62], [0.29, 0.645], [0.36, 0.8], [0.43, 0.97], [0.5, 1], [0.72, 0.99], [0.8, 0.95], [0.86, 0.86], [0.93, 0.72], [0.97, 0.63], [1, 0.53]], ws0: 0.29, ws1: 0.43, r1: 0.8, tail: 0.93, belt: 0.635, a: 0.31, b: 0.55, c: 0.79 },
  saloon: { top: [[0, 0.4], [0.015, 0.47], [0.04, 0.52], [0.12, 0.58], [0.28, 0.625], [0.36, 0.8], [0.42, 0.96], [0.48, 1], [0.62, 1], [0.68, 0.96], [0.76, 0.8], [0.82, 0.69], [0.9, 0.665], [0.97, 0.64], [1, 0.54]], ws0: 0.28, ws1: 0.42, r1: 0.68, tail: 0.82, belt: 0.63, a: 0.3, b: 0.53, c: 0.74 },
  estate: { top: [[0, 0.4], [0.015, 0.47], [0.04, 0.53], [0.1, 0.58], [0.2, 0.62], [0.28, 0.64], [0.35, 0.8], [0.42, 0.97], [0.5, 1], [0.86, 0.99], [0.92, 0.94], [0.96, 0.8], [0.985, 0.66], [1, 0.55]], ws0: 0.28, ws1: 0.42, r1: 0.92, tail: 0.97, belt: 0.635, a: 0.3, b: 0.53, c: 0.91 },
  suv: { top: [[0, 0.5], [0.02, 0.58], [0.05, 0.63], [0.12, 0.66], [0.27, 0.69], [0.35, 0.84], [0.42, 0.98], [0.5, 1], [0.82, 0.99], [0.88, 0.95], [0.94, 0.8], [0.975, 0.68], [1, 0.58]], ws0: 0.27, ws1: 0.42, r1: 0.88, tail: 0.95, belt: 0.64, a: 0.29, b: 0.53, c: 0.87 },
  mpv: { top: [[0, 0.45], [0.03, 0.55], [0.1, 0.6], [0.22, 0.63], [0.31, 0.85], [0.39, 0.98], [0.5, 1], [0.85, 0.99], [0.92, 0.95], [0.97, 0.75], [1, 0.56]], ws0: 0.22, ws1: 0.39, r1: 0.92, tail: 0.97, belt: 0.6, a: 0.24, b: 0.47, c: 0.91 },
  van: { top: [[0, 0.35], [0.03, 0.43], [0.1, 0.47], [0.17, 0.5], [0.22, 0.72], [0.27, 0.93], [0.32, 1], [0.97, 1], [0.99, 0.97], [1, 0.9]], ws0: 0.17, ws1: 0.27, r1: 0.97, tail: 0.97, belt: 0.52, a: 0.19, b: 0, c: 0.38 },
  coupe: { top: [[0, 0.42], [0.02, 0.5], [0.06, 0.56], [0.2, 0.62], [0.33, 0.66], [0.42, 0.85], [0.5, 0.99], [0.58, 1], [0.66, 0.97], [0.78, 0.8], [0.88, 0.72], [0.97, 0.68], [1, 0.58]], ws0: 0.33, ws1: 0.5, r1: 0.66, tail: 0.88, belt: 0.66, a: 0.35, b: 0, c: 0.72 },
  pickup: { top: [[0, 0.52], [0.03, 0.6], [0.1, 0.64], [0.22, 0.66], [0.3, 0.84], [0.36, 0.98], [0.42, 1], [0.575, 0.99], [0.6, 0.92], [0.612, 0.67], [0.63, 0.645], [1, 0.645]], ws0: 0.22, ws1: 0.36, r1: 0.575, tail: 0.6, belt: 0.64, a: 0.24, b: 0.43, c: 0.57 },
};

/** The roof's height ÷ H at u (straight lines between the profile's points). */
export function topAt(p: Profile, u: number): number {
  const t = p.top;
  if (u <= t[0]![0]) return t[0]![1];
  for (let i = 1; i < t.length; i++) {
    const [u1, h1] = t[i]!;
    if (u <= u1) {
      const [u0, h0] = t[i - 1]!;
      const k = (u - u0) / (u1 - u0 || 1);
      // smoothstep inside each span: the bonnet's crown and the roof's curve, without corners
      const s = k * k * (3 - 2 * k);
      return h0 + (h1 - h0) * (0.35 * k + 0.65 * s);
    }
  }
  return t[t.length - 1]![1];
}

// ---------------------------------------------------------------- the words of a record

const SMALL = new Set(['bmw', 'mg', 'vw', 'ds', 'ldv', 'man', 'byd', 'gwm', 'tdi', 'tsi', 'gti', 'gt', 'se', 'sel', 'st', 'rs', 'cdi', 'hdi', 'dci', 'xr', 'gl', 'gls', 'glc', 'gle', 'gla', 'glb', 'amg', 'sri', 'id', 'ev', 'hev', 'phev', 'suv', 'x', 'z']);
/** "VOLKSWAGEN" → "Volkswagen", "MERCEDES-BENZ" → "Mercedes-Benz", "3 SERIES" → "3 Series", "CR-V" → "CR-V", "BMW" stays. */
export function niceName(s: string): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/[a-z0-9.]+/g, (w) => (SMALL.has(w) || (w.length <= 2 && /[a-z]/.test(w) && /\d|^[a-z]$/.test(w)) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .replace(/\bCr\b/g, 'CR')
    .replace(/\bHr\b/g, 'HR');
}

const lc = (s: string | undefined) => String(s ?? '').toLowerCase().replace(/[^a-z0-9.+' /-]/g, ' ').replace(/\s+/g, ' ').trim();

function familyOf(make: string, model: string): { s: Silhouette; size: Size; words: string } | null {
  const m = lc(model);
  if (!m) return null;
  // "range rover" is a model of Land Rover and, on some records, the make too
  const full = `${lc(make)} ${m}`;
  for (const f of FAMILY_LIST) {
    if (m === f.words || m.startsWith(`${f.words} `) || full.startsWith(`${f.words} `) || full === f.words) return f;
  }
  return null;
}

function fuelOf(f: string | undefined): CarSpec['fuel'] {
  const w = lc(f);
  if (/hybrid/.test(w)) return 'hybrid';
  if (/electric/.test(w)) return 'electric';
  if (/diesel/.test(w)) return 'diesel';
  if (/petrol|gas/.test(w)) return 'petrol';
  return '';
}

/** The facts the vehicle check gave (POST /api/vehicle), as the car needs them; null when it gave none. */
export function factsFrom(answer: VehicleAnswer | null | undefined, plate = ''): CarFacts | null {
  if (!answer || !answer.ok) return null;
  const r = answer.report;
  const firstYear = /^(\d{4})/.exec(r.firstUsed ?? '')?.[1];
  return {
    plate: r.plate || plate,
    make: r.make,
    model: r.model,
    colour: r.colour || r.dvla?.colour || '',
    year: r.dvla?.year ?? (firstYear ? Number(firstYear) : null),
    fuel: r.fuel,
  };
}

/**
 * The car from its facts. The silhouette: a body word on the record or in the model's name first ("FOCUS ESTATE"), then the
 * model's family ("QASHQAI" → SUV), then the make ("LAND ROVER" → SUV), else a family hatchback with `exact: false`.
 */
export function specFrom(facts: CarFacts | null, plateIfNone = ''): CarSpec {
  const f = facts ?? { plate: plateIfNone };
  const make = String(f.make ?? '').trim();
  const model = String(f.model ?? '').trim();
  const year = typeof f.year === 'number' && f.year > 1900 ? f.year : null;
  const fam = familyOf(make, model);
  const words = `${lc(f.body)} ${lc(model)}`;
  let silhouette: Silhouette = fam?.s ?? 'hatchback';
  let size: Size = fam?.size ?? 'M';
  let exact = !!fam;
  for (const [re, s] of BODY_WORDS) {
    if (!re.test(words)) continue;
    // a family whose own name holds the word keeps its shape (a Zafira Tourer is a people carrier, not an estate)
    if (fam && re.test(fam.words)) break;
    if (s !== silhouette) {
      silhouette = s;
      if (!DIMS[s][size]) size = 'M';
    }
    exact = true;
    break;
  }
  if (!fam && !exact) {
    const byMake = MAKES[lc(make)];
    if (byMake) [silhouette, size] = byMake;
  }
  // the old Ford Puma was a coupé; the one from 2019 is a small SUV
  if (/^puma\b/.test(lc(model)) && year && year < 2010) [silhouette, size] = ['coupe', 'M'];
  if (!DIMS[silhouette][size]) size = DIMS[silhouette].M ? 'M' : (Object.keys(DIMS[silhouette])[0] as Size);
  const d = DIMS[silhouette][size]!;
  const fuel = fuelOf(f.fuel);
  const paint = paintFor(f.colour);
  const known = !!(make || model);
  const plate = f.plate ? formatPlate(f.plate) : '';
  const name = [niceName(make), niceName(model.split(' ').slice(0, 2).join(' '))].filter(Boolean).join(' ');
  const colourWord = paint === NO_PAINT ? '' : (String(f.colour ?? '').trim().charAt(0).toUpperCase() + String(f.colour ?? '').trim().slice(1).toLowerCase());
  return {
    plate,
    make: niceName(make),
    model: niceName(model),
    title: [colourWord, name].filter(Boolean).join(' ') || (plate ? `The car ${plate}` : 'A car'),
    silhouette,
    size,
    exact: exact && known,
    known,
    paint,
    year,
    fuel,
    electric: fuel === 'electric',
    doors: DOORS[silhouette],
    roofRails: silhouette === 'estate' || (silhouette === 'suv' && size !== 'S'),
    bootLine: silhouette === 'saloon',
    bed: silhouette === 'pickup',
    dims: { length: d[0], width: d[1], height: d[2], wheelbase: d[3], front: d[4], rear: +(d[0] - d[3] - d[4]).toFixed(3), clearance: d[5], tyreR: d[6], rimR: d[7], tyreW: d[8] },
    profile: PROFILES[silhouette],
  };
}

/** The one honest line, said once where the car is shown. */
export function standInLine(s: Pick<CarSpec, 'exact' | 'known' | 'plate'>): string {
  if (!s.known) return s.plate ? 'A stand-in: the plate is the car’s; the shape and colour are guesses until its record is read. The parts are where they are on most cars.' : 'A stand-in car: the parts are where they are on most cars.';
  if (!s.exact) return 'A stand-in: the colour and plate are the car’s, the shape is a guess; the parts are where they are on most cars like it.';
  return 'A stand-in: the shape, colour and plate are the car’s; the parts are where they are on most cars like it.';
}

/** The shape in words: "a family hatchback", "a large SUV". */
export function shapeWords(s: Pick<CarSpec, 'silhouette' | 'size'>): string {
  const size = s.size === 'S' ? 'small ' : s.size === 'L' ? 'large ' : '';
  const name: Record<Silhouette, string> = { hatchback: 'hatchback', saloon: 'saloon', estate: 'estate', suv: 'SUV', mpv: 'people carrier', van: 'van', coupe: 'coupé', pickup: 'pickup' };
  return `${size === '' && s.silhouette === 'hatchback' ? 'family ' : size}${name[s.silhouette]}`;
}
