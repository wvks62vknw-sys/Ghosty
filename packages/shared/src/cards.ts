/**
 * LIVE CARDS (BRIEF-SIDEWAYS item 1; OWNER-ISSUES 91b, 92 ②): "i feel like that's all just there and i have to ask for it
 * to be activated but i want it to be there". Anything a reply or a feature finds lands in the conversation as a card —
 * a place on the map, a car, a person he introduced, a number, a piece of the day — with a title of four words at most,
 * one plain line, a picture, and at most two buttons (OPEN the screen and its panel; ASK, which puts a question in the box).
 *
 * The brain builds a reply's cards BY CODE from its tools' results (`cardsFromTool`): a place → MAP, a vehicle check →
 * CAR, an estimate → ESTIMATE, a prediction → its BRIEF card, a model → THREE-D. Never a field the model wrote: the plain
 * prompt gains nothing. The phone draws them (apps/web/src/features/core/cards.ts); Telegram and push carry them as text
 * (`cardText`).
 */
import { formatPlate, isPlate, normalisePlate, plateFormat, type VehicleAnswer } from './plates';

export type CardKind = 'map' | 'three' | 'person' | 'car' | 'estimate' | 'lens' | 'brief' | 'progress' | 'place';
export type BriefIcon = 'morning' | 'rain' | 'diary' | 'reminder' | 'car' | 'warning' | 'foresight';

/** A card's button: OPEN (a screen and its panel, or a screen command) or ASK (words put in the chat box, not sent). */
export interface CardAct {
  label: string;
  open?: { tab: string; panel?: string };
  run?: { name: string; args: Record<string, unknown> };
  ask?: string;
  /** The CAR offer's one tap: that plate's public record. */
  car?: string;
}

export interface Card {
  /** Steady for the same thing ("car:AB12CDE", "map:Home"): the wall and the chat show it once. */
  id: string;
  kind: CardKind;
  /** Four words at most. */
  title: string;
  /** One plain line. */
  line: string;
  at: number;
  /** At most two. */
  acts?: CardAct[];
  /** A warning about one of his places: first on the wall, never held. */
  danger?: boolean;
  /** When it is due (ms): the wall puts what is due within two hours first. */
  due?: number;
  /** Why it was said, when he did not ask (the speak-first cadence records it): WHY reads it. */
  why?: string;
  /** A vehicle's public record: shown once, never kept on the phone (as the vehicle check's reply). */
  once?: boolean;
  map?: { lat: number; lon: number; label?: string; path?: [number, number][] };
  three?: { title: string };
  person?: { name: string };
  car?: { plate: string; colour?: string; key?: boolean; whose?: string };
  estimate?: { value: string; label: string };
  lens?: { text: string };
  brief?: { icon: BriefIcon };
  progress?: { frac: number };
  place?: { label: string; saved: boolean };
}

export const MAX_ACTS = 2;
export const TITLE_WORDS = 4;

/** At most four words, no trailing punctuation: "Red Ford Fiesta Zetec", "Dad's car". */
export function shortTitle(s: string, n = TITLE_WORDS): string {
  const words = String(s ?? '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  return words.slice(0, n).join(' ').replace(/[.,;:·—–-]+$/, '') || '…';
}

/** One line, cut at a word near `n` characters. */
export function oneLine(s: string, n = 110): string {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n - 1);
  const at = cut.lastIndexOf(' ');
  return `${(at > n * 0.6 ? cut.slice(0, at) : cut).replace(/[,;:·—–-]+$/, '')}…`;
}

/** A card as he would write it: the four-word title, the line, at most two buttons. */
export function card(c: Omit<Card, 'title' | 'line' | 'at'> & { title: string; line: string; at?: number }): Card {
  const out: Card = { ...c, title: shortTitle(c.title), line: oneLine(c.line), at: c.at ?? Date.now() };
  if (out.acts) out.acts = out.acts.slice(0, MAX_ACTS);
  return out;
}

/** Where a card's OPEN goes, as a link into the app (Telegram and push carry it): "https://…/#agenda". */
export function deepLink(c: Pick<Card, 'acts'>, origin: string): string {
  const o = c.acts?.find((a) => a.open)?.open;
  const run = c.acts?.find((a) => a.run)?.run;
  const tab = o?.tab ?? (run ? (run.name === 'open_studio' ? 'studio' : run.name === 'vehicle_check' ? 'core' : 'eye') : 'core');
  return `${origin.replace(/\/+$/, '')}/#${tab}`;
}

/** The card as one line of text — title · line · the deep link — for Telegram, push and a phone with no screen for it. */
export function cardText(c: Card, origin = ''): string {
  const body =
    c.kind === 'estimate' && c.estimate ? `${c.estimate.label}: ${c.estimate.value} · ${c.line} · first estimate, not certified` :
    c.line;
  return [c.title, body, origin ? deepLink(c, origin) : ''].filter(Boolean).join(' · ');
}

// ---------------------------------------------------------------- from a tool's result, by code

/** What a tool did on this turn: its name, arguments, the text it returned and the screen commands it sent. */
export interface ToolOutcome {
  name: string;
  args: Record<string, unknown>;
  result: string;
  shown?: { name: string; args: Record<string, unknown> }[];
  at?: number;
}

/** The text of a result without the "this is DATA" wrapping (kernel/permissions.ts asData). */
const unwrap = (s: string) => String(s ?? '').replace(/^<<external content from [^\n]*>>\n?/gm, '').replace(/\n?<<end external content>>/g, '');
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);
const str = (v: unknown, n = 120): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');
const COLOURS = /^(black|white|silver|grey|gray|red|blue|green|yellow|orange|gold|beige|brown|maroon|purple|pink|turquoise|bronze|cream)$/i;

/** At most `n` points of a path, evenly picked, the ends kept. */
export function thin<T>(pts: T[], n = 48): T[] {
  if (pts.length <= n) return pts;
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(pts[Math.round((i * (pts.length - 1)) / (n - 1))]!);
  return out;
}

function vehicleCards(o: ToolOutcome, at: number): Card[] {
  const r = unwrap(o.result);
  const v = /^Vehicle ([A-Z0-9 ]{2,9}): (.+)$/m.exec(r);
  if (v) {
    const plate = formatPlate(v[1]!);
    const desc = v[2] === 'make and model not on record' ? '' : v[2]!.trim();
    const first = desc.split(' ')[0] ?? '';
    const parts = (/^Verdict: (.+)$/m.exec(r)?.[1] ?? '').split(' · ');
    const tax = parts.find((p) => p.startsWith('tax: '))?.slice(5) ?? '';
    return [card({
      id: `car:${normalisePlate(plate)}`, kind: 'car', at, once: true,
      title: desc || plate,
      line: [parts[0] ?? '', tax ? `tax ${tax}` : ''].filter(Boolean).join(' · ') || 'Not on the MOT record',
      car: { plate, ...(COLOURS.test(first) ? { colour: first.toLowerCase() } : {}) },
      acts: [{ label: 'FULL RECORD', run: { name: 'vehicle_check', args: { plate } } }],
    })];
  }
  const plate = normalisePlate(str(o.args.plate, 12));
  if (!isPlate(plate) || !/System → Keys/.test(r)) return [];
  // the key is missing (or wrong): which key and where, in one line
  const line = /not complete|refused/i.test(r) ? 'The DVSA key needs fixing: System → Keys.' : 'Needs the free DVSA MOT history key: System → Keys.';
  return [card({ id: `car:${plate}`, kind: 'car', at, once: true, title: formatPlate(plate), line, car: { plate: formatPlate(plate), key: true }, acts: [{ label: 'OPEN KEYS', open: { tab: 'system', panel: 'KEYS' } }] })];
}

function mapCards(o: ToolOutcome, at: number): Card[] {
  const r = unwrap(o.result);
  const route = o.shown?.find((s) => s.name === 'show_route');
  if (o.name === 'get_directions' && route) {
    // (tools/travel.ts sends the path as [lat, lon], as the card keeps it)
    const path = (Array.isArray(route.args.path) ? route.args.path : []).map((p) => (Array.isArray(p) ? [num(p[0]), num(p[1])] : [null, null])).filter((p): p is [number, number] => p[0] !== null && p[1] !== null);
    if (path.length < 2) return [];
    const km = num(route.args.distance_m);
    const min = num(route.args.duration_s);
    const from = str(route.args.from, 40) || 'here';
    const to = str(route.args.to, 40) || 'there';
    const mode = str(route.args.mode, 12);
    const mid = path[Math.floor(path.length / 2)]!;
    return [card({
      id: `route:${from}>${to}`, kind: 'map', at, title: `${from} to ${to}`,
      line: [km != null ? `${(km / 1000).toFixed(km < 10_000 ? 1 : 0)} km` : '', min != null ? `about ${Math.max(1, Math.round(min / 60))} min${mode ? ` ${mode === 'foot' ? 'walking' : mode === 'bike' ? 'by bike' : 'by car'}` : ''}` : ''].filter(Boolean).join(' · ') || 'The route, on the map',
      map: { lat: mid[0], lon: mid[1], path: thin(path) },
      acts: [{ label: 'OPEN MAP', open: { tab: 'eye' } }],
    })];
  }
  const m = o.shown?.find((s) => s.name === 'show_map');
  if (!m) return [];
  const lat = num(m.args.lat);
  const lon = num(m.args.lon);
  if (lat === null || lon === null) return [];
  const place = str(m.args.place, 60) || 'That place';
  const points = (Array.isArray(m.args.points) ? m.args.points : []) as { lat?: unknown; lon?: unknown }[];
  const pts = points.map((p) => [num(p?.lat), num(p?.lon)]).filter((p): p is [number, number] => p[0] !== null && p[1] !== null);
  const line =
    o.name === 'uk_postcode' ? (/ — (.+?) \(-?\d/.exec(r)?.[1] ?? 'The postcode, on the map') :
    o.name === 'measure_distance' ? `${/: (.+?) in a straight line/.exec(r)?.[1] ?? 'The distance'} in a straight line` :
    o.name === 'what_is_here' ? 'What is here, on the map' :
    pts.length > 1 ? `On the map, with ${pts.length} pins` : 'On the map';
  return [card({
    id: `map:${place}`, kind: 'map', at, title: place, line,
    map: { lat, lon, label: place, ...(o.name === 'measure_distance' && pts.length === 2 ? { path: pts } : {}) },
    acts: [{ label: 'OPEN MAP', run: { name: 'show_map', args: { place, lat, lon, zoom: num(m.args.zoom) ?? 15 } } }],
  })];
}

function placeCards(o: ToolOutcome, at: number): Card[] {
  const r = unwrap(o.result);
  const kept = /^Kept (.+?): (.+?)\. Journeys, directions and the Brief use it now/m.exec(r);
  if (kept) return [card({ id: `place:${kept[1]!.toLowerCase()}`, kind: 'place', at, title: `${kept[1]} saved`, line: kept[2]!, place: { label: kept[1]!, saved: true }, acts: [{ label: 'OPEN PLACES', open: { tab: 'memory', panel: 'ME' } }] })];
  const found = /^Found for (.+?): (.+) \((-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?)\), shown on the map\. NOT kept yet/m.exec(r);
  if (!found) return [];
  const label = found[1]!;
  return [card({
    id: `place:${label.toLowerCase()}`, kind: 'place', at, title: `Keep ${label}?`, line: found[2]!,
    place: { label, saved: false }, map: { lat: Number(found[3]), lon: Number(found[4]), label },
    acts: [{ label: 'YES, KEEP IT', ask: `Yes, keep it as ${label}` }],
  })];
}

function estimateCards(o: ToolOutcome, at: number): Card[] {
  const r = unwrap(o.result);
  const head = /^(.+?) — FIRST ESTIMATE · NOT CERTIFIED$/m.exec(r);
  const first = /^• ([^:\n]+): ([^\n]+?)(?: \(([^)\n]*)\))?$/m.exec(r);
  if (!head || !first) return [];
  const assumed = /^Assumed: ([^;\n]+?)(?:;|\.$)/m.exec(r)?.[1]?.trim();
  return [card({
    id: `est:${head[1]}`, kind: 'estimate', at, title: head[1]!,
    line: assumed ? `Assumes ${assumed}` : 'Nothing assumed beyond your numbers',
    estimate: { value: first[2]!.trim(), label: first[1]!.trim() },
    acts: [{ label: 'ASK', ask: 'What would change that estimate?' }],
  })];
}

function foreseeCards(o: ToolOutcome, at: number): Card[] {
  const m = /^On record: I expect (.+?) \((\d+)%\), to be checked (.+?)\. /m.exec(unwrap(o.result));
  if (!m) return [];
  return [card({ id: `fore:${m[1]}`, kind: 'brief', at, title: 'On record', line: `I expect ${m[1]} · ${m[2]}% · checked ${m[3]}`, brief: { icon: 'foresight' }, acts: [{ label: 'OPEN', open: { tab: 'brief', panel: 'FORESIGHT' } }] })];
}

function threeCards(o: ToolOutcome, at: number): Card[] {
  const s = o.shown?.find((x) => x.name === 'open_studio');
  if (!s) return [];
  const a = s.args;
  // a made model, the catalogue's or a sample: never a room or a Spline scene (their own screens say them)
  const args: Record<string, unknown> = typeof a.model === 'string' ? { model: a.model, ...(typeof a.title === 'string' ? { title: a.title } : {}) } : typeof a.make === 'string' ? { make: a.make } : typeof a.sample === 'string' ? { sample: a.sample } : {};
  if (!Object.keys(args).length) return [];
  const title = str(a.title, 60) || str(a.make, 60) || str(a.sample, 30) || 'Your model';
  return [card({ id: `3d:${title.toLowerCase()}`, kind: 'three', at, title, line: typeof a.model === 'string' ? 'Made in 3-D: turn it, take it apart, measure it' : 'In 3-D in the Studio: turn it round', three: { title }, acts: [{ label: 'OPEN STUDIO', run: { name: 'open_studio', args } }] })];
}

/** [packs] A pack's cards (BRIEF-PACKS-1): made by its own code and sent as `pack_card` screen commands (apps/edge/src/packs/base.ts). */
function packCards(o: ToolOutcome): Card[] {
  return (o.shown ?? [])
    .filter((s) => s.name === 'pack_card')
    .map((s) => s.args.card as Card)
    .filter((c): c is Card => !!c && typeof c.id === 'string' && typeof c.title === 'string' && typeof c.line === 'string' && typeof c.kind === 'string');
}

/**
 * The cards for one tool call, from what it returned and the screen commands it sent — by code, never from the model's
 * words. Tools with nothing to show give none.
 */
export function cardsFromTool(o: ToolOutcome): Card[] {
  const at = o.at ?? Date.now();
  if (/^Error: /.test(o.result)) return [];
  switch (o.name) {
    case 'vehicle_check':
      return vehicleCards(o, at);
    case 'show_map':
    case 'what_is_here':
    case 'uk_postcode':
    case 'measure_distance':
    case 'get_directions':
      return mapCards(o, at);
    case 'remember_place':
      return placeCards(o, at);
    case 'estimate':
      return estimateCards(o, at);
    case 'foresee':
      return o.args.what === 'expect' ? foreseeCards(o, at) : [];
    case 'make_3d':
      return threeCards(o, at);
    case 'money':
    case 'body':
    case 'kitchen':
      return packCards(o);
    default:
      return [];
  }
}

// ---------------------------------------------------------------- a piece of his day from the brain's inbox (item 2c)

/** The card a notification carries, by code: a reminder he set → BRIEF; a warning about one of his places → BRIEF, danger. */
export function inboxCard(item: { id?: string; kind: 'reminder' | 'task' | 'error'; title: string; text: string; danger?: boolean }, at = Date.now()): Card | null {
  if (item.kind === 'reminder') return card({ id: `brief:reminder:${item.id ?? at}`, kind: 'brief', at, due: at, title: 'Reminder', line: item.text, brief: { icon: 'reminder' }, acts: [{ label: 'OPEN AGENDA', open: { tab: 'agenda' } }] });
  if (item.danger) return card({ id: `brief:warn:${at}`, kind: 'brief', at, danger: true, title: item.title, line: item.text.split('\n')[0] ?? item.text, brief: { icon: 'warning' }, acts: [{ label: 'NEAR HOME', open: { tab: 'threats', panel: 'NEAR HOME' } }] });
  return null;
}

// ---------------------------------------------------------------- plates in any spacing, and the cars he names (item 2a, 2d)

/**
 * UK plates as he types them, in any spacing ("AB12CDE", "ab12 cde", "AB 12 CDE", "A123 BCD", "ABC 123D"): the dated and
 * Northern Ireland formats only, five to eight letters and digits — a dateless "A1" or "M6", a postcode, a time or a
 * model number is everyday text and never one.
 */
export function platesIn(text: string): string[] {
  const toks = String(text ?? '').toUpperCase().match(/[A-Z0-9]+/g) ?? [];
  const out: string[] = [];
  for (let i = 0; i < toks.length; i++) {
    for (let k = Math.min(3, toks.length - i); k >= 1; k--) {
      const parts = toks.slice(i, i + k);
      if (k > 1 && parts.some((t) => t.length > 4)) continue;
      const p = parts.join('');
      if (p.length < 5 || p.length > 8 || !/\d/.test(p) || !/[A-Z]/.test(p)) continue;
      const f = plateFormat(p);
      if (!f || f === 'dateless') continue;
      if (!out.includes(p)) out.push(p);
      i += k - 1;
      break;
    }
  }
  return out;
}

/** The people in his life by what he calls them: "my dad's car" introduces Dad. */
export const RELATIONS = ['dad', 'mum', 'mom', 'mother', 'father', 'brother', 'sister', 'nan', 'nana', 'gran', 'granny', 'grandma', 'grandad', 'grandpa', 'uncle', 'aunt', 'auntie', 'cousin', 'wife', 'husband', 'partner', 'girlfriend', 'boyfriend', 'son', 'daughter', 'mate', 'friend', 'stepdad', 'stepmum', 'boss'];

/** A car he named: his own (`whose` "me") or one of the people he introduced; the plate, a nickname, and — once he has seen its card — the months its MOT and tax fall due. */
export interface NamedCar {
  whose: string;
  plate: string;
  nickname?: string;
  /** "2027-03" */
  mot?: string;
  tax?: string;
}

const capital = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
const WHOSE = /\b(?:my\s+(?:([a-z]+)\s+)?([a-z][a-z-]*)'s|(my)|([a-z][a-z-]*)'s)\s+(?:car|van|motor|motorbike|bike|truck|jeep)(?:'s\s+(?:reg(?:istration)?|plate|number(?:\s*plate)?))?\s*(?:is|=|:)\s*/i;
const NICK = /^\s*(?:[,(-]|\s(?=(?:called|nicknamed|we call it|aka)\b))\s*(?:(?:it'?s\s+)?(?:called|nicknamed|we call it|aka)\s+)?((?:the|a|an|my|our)?\s*[a-z][\w-]*(?:\s+[a-z][\w-]*){0,2})\s*\)?\s*[.!]?\s*$/i;

/**
 * "my car is AB12 CDE", "my dad's car is RX15 KNG", "my mate Haris's van is …, the Transit", "Mum's car: …" → the car he
 * named; a name with no "my" counts only when he introduced that person (`known`, lower case). Anyone else's car is never
 * kept: null.
 */
export function carSaid(text: string, known: string[] = []): NamedCar | null {
  const t = String(text ?? '').replace(/[‘’]/g, "'").trim();
  if (/\?\s*$/.test(t)) return null;
  const m = WHOSE.exec(t);
  if (!m) return null;
  const rest = t.slice(m.index + m[0].length);
  const plate = platesIn(rest.slice(0, 12))[0];
  if (!plate) return null;
  let whose = '';
  if (m[3]) whose = 'me';
  else if (m[2]) whose = capital(m[2]);
  else if (m[4]) {
    const w = m[4].toLowerCase();
    if (RELATIONS.includes(w) || known.includes(w)) whose = capital(m[4]);
  }
  if (!whose || /^(his|her|their|someone|somebody|this|that|the)$/i.test(whose)) return null;
  // what follows the plate: a nickname after a comma or "called …", nothing else
  const shape = [...formatPlate(plate)].map((c) => (c === ' ' ? '\\s*' : c)).join('');
  const after = rest.replace(new RegExp(`^\\s*${shape}`, 'i'), '');
  const nick = NICK.exec(after)?.[1]?.trim();
  return { whose, plate: formatPlate(plate), ...(nick ? { nickname: nick } : {}) };
}

/** How a named car is kept in his memory, one line he can read in the Memory tab: "Dad's car: RX15 KNG (the Golf) · MOT due 2027-03". */
export function carFactText(c: NamedCar): string {
  return `${c.whose === 'me' ? 'My' : `${c.whose}'s`} car: ${formatPlate(c.plate)}${c.nickname ? ` (${c.nickname})` : ''}${c.mot ? ` · MOT due ${c.mot}` : ''}${c.tax ? ` · tax due ${c.tax}` : ''}`;
}

const FACT = /^(?:(My)|(.{1,40}?)'s) car: ([A-Z0-9]{1,4} ?[A-Z0-9]{1,4})(?: \(([^)]{1,40})\))?(?: · MOT due (\d{4}-\d{2}))?(?: · tax due (\d{4}-\d{2}))?$/;

/** A memory line back into the car (null for any other memory). */
export function parseCarFact(text: string): NamedCar | null {
  const m = FACT.exec(String(text ?? '').trim());
  if (!m || !isPlate(m[3]!)) return null;
  return { whose: m[1] ? 'me' : m[2]!, plate: formatPlate(m[3]!), ...(m[4] ? { nickname: m[4] } : {}), ...(m[5] ? { mot: m[5] } : {}), ...(m[6] ? { tax: m[6] } : {}) };
}

/** "Dad's car", "Your car", or its nickname with whose it is ("Dad's Golf"). */
export function carName(c: NamedCar): string {
  const whose = c.whose === 'me' ? 'Your' : `${c.whose}'s`;
  return c.nickname ? `${whose} ${c.nickname.replace(/^(the|a|an|my|our)\s+/i, '')}` : `${whose} car`;
}

// ---------------------------------------------------------------- PERSON and CAR, from what is already known (item 2)

/**
 * A person he introduced — the guardian's named person, or someone whose car he named — showing only what GUARDIAN
 * already shows: how a message would reach them, their cars, a walk home of his under way. Nothing predicted, nothing
 * looked up about them.
 */
export function personCard(p: { name: string; named?: { via: 'telegram' | 'email' | '' }; cars: NamedCar[]; walk?: boolean }, at = Date.now()): Card {
  const reach = p.named ? `Your named person · ${p.named.via === 'telegram' ? 'on Telegram' : p.named.via === 'email' ? 'by email' : 'not reachable yet'}` : 'Someone you told me about';
  const cars = p.cars.map((c) => `${c.nickname ? `${c.nickname.replace(/^(the|a|an|my|our)\s+/i, '')} ` : 'car '}${formatPlate(c.plate)}`);
  const own = /s$/i.test(p.name) ? `${p.name}'` : `${p.name}'s`;
  return card({
    id: `person:${p.name.toLowerCase()}`, kind: 'person', at, title: p.name,
    line: [reach, ...cars, p.named && p.walk ? 'watching your walk home' : ''].filter(Boolean).join(' · '),
    person: { name: p.name },
    acts: [{ label: 'OPEN', open: { tab: 'settings', panel: 'GUARDIAN' } }, ...(p.cars.length ? [{ label: 'ASK', ask: `Is ${own} car due its MOT?` }] : [])],
  });
}

/** A plate he typed: the offer of its car ("That's a plate. Want the car?"), or a car he named, ready to show. */
export function plateOffer(plate: string, named?: NamedCar, at = Date.now()): Card {
  const p = formatPlate(plate);
  return card({
    id: `car:${normalisePlate(plate)}`, kind: 'car', at, once: true,
    title: named ? carName(named) : "That's a plate",
    line: named ? `${p} · its MOT and tax, from the public record` : 'Want the car? Make, colour, MOT and tax from the public record.',
    car: { plate: p, ...(named ? { whose: named.whose } : {}) },
    acts: [{ label: 'SHOW THE CAR', car: p }],
  });
}

/** The public record's answer (POST /api/vehicle) as the CAR card: make, colour, MOT and tax — or which key is missing and where. */
export function carCard(answer: VehicleAnswer, plate: string, named?: NamedCar, at = Date.now()): Card {
  const p = formatPlate(plate);
  const base = { id: `car:${normalisePlate(plate)}`, kind: 'car' as const, at, once: true };
  if (answer.ok) {
    const r = answer.report;
    const colour = r.colour.toLowerCase();
    const tax = r.dvla?.taxDue ? `tax due ${ukDay(r.dvla.taxDue)}` : r.dvla?.taxStatus ? `tax: ${r.dvla.taxStatus}` : '';
    return card({ ...base, title: named ? carName(named) : [r.colour, r.make, r.model].filter(Boolean).join(' ') || p, line: [r.mot.text, tax].filter(Boolean).join(' · '), car: { plate: p, ...(COLOURS.test(colour) ? { colour } : {}), ...(named ? { whose: named.whose } : {}) }, acts: [{ label: 'FULL RECORD', run: { name: 'vehicle_check', args: { plate: p } } }] });
  }
  if (answer.reason === 'no_key') return card({ ...base, title: named ? carName(named) : p, line: /not complete|refused/i.test(answer.message) ? 'The DVSA key needs fixing: System → Keys.' : 'Needs the free DVSA MOT history key: System → Keys.', car: { plate: p, key: true }, acts: [{ label: 'OPEN KEYS', open: { tab: 'system', panel: 'KEYS' } }] });
  return card({ ...base, title: named ? carName(named) : p, line: answer.message, car: { plate: p } });
}

/** "2027-03-19" → "19 Mar 2027". */
function ukDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${Number(m[3])} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m[2]) - 1]} ${m[1]}` : iso;
}

/** The months a named car's MOT and tax fall due, from its record (kept on its car fact for the day's pieces). */
export function dueMonths(answer: VehicleAnswer): { mot?: string; tax?: string } {
  if (!answer.ok) return {};
  const r = answer.report;
  const mot = (r.mot.state === 'valid' || r.mot.state === 'first_due') && r.mot.date ? r.mot.date.slice(0, 7) : undefined;
  const tax = r.dvla?.taxDue ? r.dvla.taxDue.slice(0, 7) : undefined;
  return { ...(mot ? { mot } : {}), ...(tax ? { tax } : {}) };
}

// ---------------------------------------------------------------- Home as his wall (item 4)

/** How many cards the wall shows before MORE. */
export const WALL_CAP = 6;
const HOUR = 3_600_000;

/**
 * Which kind of news a card is on the wall, most pressing first: 0 danger · 1 due within two hours · 2 today's pieces of
 * his day · 3 the people's and the cars' news · 4 anything else from today (a place, a number, what the camera read, a
 * model) · 5 progress (School, the GYM).
 */
export function wallRank(c: Card, now: number): number {
  if (c.danger) return 0;
  if (c.due !== undefined && c.due >= now - 15 * 60_000 && c.due <= now + 2 * HOUR) return 1;
  if (c.kind === 'brief') return 2;
  if (c.kind === 'person' || c.kind === 'car') return 3;
  if (c.kind === 'progress') return 5;
  return 4;
}

/**
 * The wall's order, by code and nothing else (no model draws it): danger first, then what is due within two hours
 * (soonest first), then today's pieces, then the people's and cars' news, then the rest of today, then progress; newest
 * first within each. One card per id (the newest); what is over (due more than a quarter of an hour ago, or from before
 * yesterday) is gone.
 */
export function wallOrder(cards: Card[], now: number): Card[] {
  const byId = new Map<string, Card>();
  for (const c of cards) {
    if (c.at < now - 24 * HOUR) continue;
    if (c.due !== undefined && c.due < now - 15 * 60_000 && !c.danger) continue;
    const had = byId.get(c.id);
    if (!had || had.at <= c.at) byId.set(c.id, c);
  }
  return [...byId.values()].sort((a, b) => {
    const ra = wallRank(a, now);
    const rb = wallRank(b, now);
    if (ra !== rb) return ra - rb;
    if (ra === 1) return (a.due ?? 0) - (b.due ?? 0);
    return b.at - a.at;
  });
}
