/**
 * A small, fixed fact book for FACT-CHECK DUEL and DEBATE ARENA: 20 countries, 8 rivers, 12 elements and the
 * 8 planets, each fact numbered (F1, F2, …) so it can be looked up or cited. Claims are made from it — true,
 * false, or not decidable from it (a value it does not record, or something not in it) — and judged by a
 * three-valued evaluator that works on the whole book or on just the facts someone cited.
 *
 * Sources (well-known values, rounded):
 * - Populations: UN World Population Prospects 2022, estimates for 2023, millions. Areas: CIA World Factbook,
 *   total area, thousand km². Capitals and continents: CIA World Factbook.
 * - Rivers: lengths as commonly given by Encyclopaedia Britannica (the Amazon's is disputed, so it is not
 *   recorded); mouths; which of the listed countries each flows through.
 * - Elements: IUPAC periodic table (symbol, atomic number); state at 20 °C and melting points from the CRC
 *   Handbook of Chemistry and Physics (helium does not melt at normal pressure and carbon sublimes, so
 *   neither has a melting point recorded).
 * - Planets: NASA Planetary Fact Sheet (equatorial diameter, km; rings); known moons as counted in 2023.
 * Some values are left out on purpose ("not recorded"): a claim that needs one cannot be decided.
 */
import { pick, randInt, rng, shuffle } from './core';

export type Kind = 'country' | 'river' | 'element' | 'planet';
export type Value = string | number | boolean | string[];

export interface Entity {
  kind: Kind;
  name: string;
  f: Record<string, Value | null>;
}

const C = (name: string, capital: string, continent: string, population: number | null, area: number | null): Entity => ({ kind: 'country', name, f: { capital, continent, population, area } });
const R = (name: string, length: number | null, mouth: string, through: string[]): Entity => ({ kind: 'river', name, f: { length, mouth, through } });
const E = (name: string, symbol: string, number: number, state: string, melting: number | null): Entity => ({ kind: 'element', name, f: { symbol, number, state, melting } });
const P = (name: string, order: number, diameter: number, moons: number, rings: boolean): Entity => ({ kind: 'planet', name, f: { order, diameter, moons, rings } });

export const ENTITIES: Entity[] = [
  C('France', 'Paris', 'Europe', 65, 644),
  C('Germany', 'Berlin', 'Europe', 83, 357),
  C('Italy', 'Rome', 'Europe', 59, 301),
  C('Spain', 'Madrid', 'Europe', 47, 506),
  C('the United Kingdom', 'London', 'Europe', 68, 244),
  C('Poland', 'Warsaw', 'Europe', 41, 313),
  C('Egypt', 'Cairo', 'Africa', 113, 1002),
  C('Nigeria', 'Abuja', 'Africa', 224, 924),
  C('Ghana', 'Accra', 'Africa', 34, null),
  C('Japan', 'Tokyo', 'Asia', 123, 378),
  C('India', 'New Delhi', 'Asia', 1429, 3287),
  C('China', 'Beijing', 'Asia', 1426, 9597),
  C('Indonesia', 'Jakarta', 'Asia', 278, null),
  C('Brazil', 'Brasília', 'South America', 216, 8516),
  C('Argentina', 'Buenos Aires', 'South America', 46, 2780),
  C('Peru', 'Lima', 'South America', null, 1285),
  C('Canada', 'Ottawa', 'North America', 39, 9985),
  C('Mexico', 'Mexico City', 'North America', 128, 1964),
  C('the United States', 'Washington, D.C.', 'North America', 340, 9834),
  C('Australia', 'Canberra', 'Oceania', 26, 7741),
  R('the Nile', 6650, 'Mediterranean Sea', ['Egypt']),
  R('the Amazon', null, 'Atlantic Ocean', ['Peru', 'Brazil']),
  R('the Yangtze', 6300, 'East China Sea', ['China']),
  R('the Mississippi', 3730, 'Gulf of Mexico', ['the United States']),
  R('the Danube', 2850, 'Black Sea', ['Germany']),
  R('the Ganges', 2525, 'Bay of Bengal', ['India']),
  R('the Seine', 777, 'English Channel', ['France']),
  R('the Thames', 346, 'North Sea', ['the United Kingdom']),
  E('Hydrogen', 'H', 1, 'gas', -259),
  E('Helium', 'He', 2, 'gas', null),
  E('Carbon', 'C', 6, 'solid', null),
  E('Nitrogen', 'N', 7, 'gas', -210),
  E('Oxygen', 'O', 8, 'gas', -218),
  E('Sodium', 'Na', 11, 'solid', 98),
  E('Iron', 'Fe', 26, 'solid', 1538),
  E('Copper', 'Cu', 29, 'solid', 1085),
  E('Bromine', 'Br', 35, 'liquid', -7),
  E('Silver', 'Ag', 47, 'solid', 962),
  E('Gold', 'Au', 79, 'solid', 1064),
  E('Lead', 'Pb', 82, 'solid', 327),
  P('Mercury', 1, 4879, 0, false),
  P('Venus', 2, 12104, 0, false),
  P('Earth', 3, 12756, 1, false),
  P('Mars', 4, 6792, 2, false),
  P('Jupiter', 5, 142984, 95, true),
  P('Saturn', 6, 120536, 146, true),
  P('Uranus', 7, 51118, 28, true),
  P('Neptune', 8, 49528, 16, true),
];

/** Real things the book does NOT list (claims about them cannot be decided from it). */
export const UNLISTED: Entity[] = [
  C('Portugal', 'Lisbon', 'Europe', null, null),
  C('Chile', 'Santiago', 'South America', null, null),
  C('Thailand', 'Bangkok', 'Asia', null, null),
  C('Sweden', 'Stockholm', 'Europe', null, null),
  C('Morocco', 'Rabat', 'Africa', null, null),
  R('the Rhine', null, 'North Sea', []),
  R('the Volga', null, 'Caspian Sea', []),
  E('Zinc', 'Zn', 30, 'solid', null),
  E('Neon', 'Ne', 10, 'gas', null),
];

export const byName = new Map(ENTITIES.map((e) => [e.name, e]));
export const listed = (name: string) => byName.has(name);

/** Numeric fields (compared), word fields (matched), and the fields that name a thing ("the country whose capital is …"). */
export const NUMERIC: Record<Kind, string[]> = { country: ['population', 'area'], river: ['length'], element: ['number', 'melting'], planet: ['diameter', 'moons', 'order'] };
export const WORDY: Record<Kind, string[]> = { country: ['capital', 'continent'], river: ['mouth'], element: ['symbol', 'state'], planet: ['rings'] };
export const LINKS: Record<Kind, string[]> = { country: ['capital'], river: [], element: ['number', 'symbol'], planet: ['order'] };

const num = (x: number) => x.toLocaleString('en-GB');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** One recorded fact as a sentence. */
export function factSentence(ent: string, field: string, v: Value): string {
  switch (field) {
    case 'capital':
      return `The capital of ${ent} is ${v}.`;
    case 'continent':
      return `${cap(ent)} is in ${v}.`;
    case 'population':
      return `${cap(ent)} has about ${num(v as number)} million people (2023).`;
    case 'area':
      return `${cap(ent)} has an area of about ${num(v as number)} thousand km².`;
    case 'length':
      return `${cap(ent)} is about ${num(v as number)} km long.`;
    case 'mouth':
      return `${cap(ent)} flows into the ${v}.`;
    case 'through':
      return `Of the countries listed, ${ent} flows through ${(v as string[]).join(' and ')} (and no other listed country).`;
    case 'symbol':
      return `The chemical symbol of ${ent} is ${v}.`;
    case 'number':
      return `The atomic number of ${ent} is ${v}.`;
    case 'state':
      return `${cap(ent)} is a ${v} at room temperature (20 °C).`;
    case 'melting':
      return `${cap(ent)} melts at ${num(v as number)} °C.`;
    case 'order':
      return `${cap(ent)} is planet number ${v} from the Sun.`;
    case 'diameter':
      return `${cap(ent)} is about ${num(v as number)} km across.`;
    case 'moons':
      return `${cap(ent)} has ${v} known moon${v === 1 ? '' : 's'} (2023).`;
    case 'rings':
      return v ? `${cap(ent)} has rings.` : `${cap(ent)} has no rings.`;
  }
  return `${ent}: ${field} ${String(v)}.`;
}
const FIELD_WORDS: Record<string, string> = { population: 'population', area: 'area', length: 'length', melting: 'melting point', capital: 'capital', continent: 'continent', mouth: 'mouth', symbol: 'symbol', number: 'atomic number', state: 'state', order: 'order from the Sun', diameter: 'diameter', moons: 'number of moons', rings: 'rings', through: 'countries it flows through' };
export const notRecorded = (ent: string, field: string) => `${cap(ent)}: ${FIELD_WORDS[field] ?? field} not recorded.`;

export interface Fact {
  id: string;
  ent: string;
  field: string;
  v: Value;
  text: string;
}

/** Every recorded value, numbered in book order. */
export const FACTS: Fact[] = (() => {
  const out: Fact[] = [];
  for (const e of ENTITIES)
    for (const [field, v] of Object.entries(e.f)) {
      if (v == null) continue;
      out.push({ id: `F${out.length + 1}`, ent: e.name, field, v, text: factSentence(e.name, field, v) });
    }
  return out;
})();
export const factById = new Map(FACTS.map((f) => [f.id, f]));
export const factOf = (ent: string, field: string) => FACTS.find((f) => f.ent === ent && f.field === field);

// ---- claims -----------------------------------------------------------------------------------------------

/** A thing named outright, or found by one of its facts ("the country whose capital is Ottawa"). */
export type Ref = { name: string } | { kind: Kind; by: string; v: string | number };

export type Spec =
  | { k: 'eq'; a: Ref; field: string; v: Value }
  | { k: 'gt'; a: Ref; field: string; n: number }
  | { k: 'cmp'; a: Ref; b: Ref; field: string }
  | { k: 'super'; a: Ref; field: string; kind: Kind; group: string | null }
  | { k: 'flows'; a: Ref; b: Ref };

export type Truth = 'T' | 'F' | 'U';

/** What someone knows: the whole book, or only some facts. */
export interface Know {
  /** The value; null = known not to be recorded (or the thing is not listed); undefined = not known here. */
  get(ent: string, field: string): Value | null | undefined;
  /** The listed thing of `kind` whose `field` is v: its name; null = none listed; undefined = not known here. */
  find(kind: Kind, field: string, v: Value): string | null | undefined;
}

export const BOOK: Know = {
  get: (ent, field) => byName.get(ent)?.f[field] ?? null,
  find: (kind, field, v) => ENTITIES.find((e) => e.kind === kind && e.f[field] === v)?.name ?? null,
};

/** Knowing only these facts (the rosters — which things the book lists — are common ground). */
export function knowOnly(facts: Fact[]): Know {
  return {
    get: (ent, field) => (listed(ent) ? facts.find((f) => f.ent === ent && f.field === field)?.v : null),
    find: (kind, field, v) => facts.find((f) => f.field === field && f.v === v && byName.get(f.ent)?.kind === kind)?.ent,
  };
}

/** The listed things of a kind (in a continent, for countries) — known to everyone. */
export const roster = (kind: Kind, group: string | null) => ENTITIES.filter((e) => e.kind === kind && (!group || e.f.continent === group)).map((e) => e.name);

export const resolveRef = (r: Ref, k: Know): string | null | undefined => ('name' in r ? (listed(r.name) ? r.name : null) : k.find(r.kind, r.by, r.v));

/** Three-valued: settled true, settled false, or not settled by what is known. */
export function evaluate(s: Spec, k: Know): Truth {
  const valOf = (r: Ref, field: string): Value | null | undefined => {
    const n = resolveRef(r, k);
    return n == null ? n : k.get(n, field);
  };
  switch (s.k) {
    case 'eq': {
      const v = valOf(s.a, s.field);
      return v == null ? 'U' : v === s.v ? 'T' : 'F';
    }
    case 'gt': {
      const v = valOf(s.a, s.field);
      return v == null ? 'U' : (v as number) > s.n ? 'T' : 'F';
    }
    case 'cmp': {
      const a = valOf(s.a, s.field);
      const b = valOf(s.b, s.field);
      return a == null || b == null ? 'U' : (a as number) > (b as number) ? 'T' : 'F';
    }
    case 'flows': {
      const through = valOf(s.a, 'through');
      const c = resolveRef(s.b, k);
      return through == null || c == null ? 'U' : (through as string[]).includes(c) ? 'T' : 'F';
    }
    case 'super': {
      const a = resolveRef(s.a, k);
      const va = a == null ? a : (k.get(a, s.field) as number | null | undefined);
      if (va == null) return 'U';
      let open = false;
      for (const o of roster(s.kind, s.group)) {
        if (o === a) continue;
        const v = k.get(o, s.field) as number | null | undefined;
        if (v == null) open = true;
        else if (v > va) return 'F';
      }
      return open ? 'U' : 'T';
    }
  }
}

/**
 * The fewest facts that settle a claim the book decides (what a careful arguer cites): the facts on the way
 * to the answer; for "X has the most …", all of the group when true, X and the biggest other when false.
 */
export function support(s: Spec): Fact[] {
  const out: Fact[] = [];
  const use = (ent: string | null | undefined, field: string) => {
    const f = ent ? factOf(ent, field) : undefined;
    if (f && !out.includes(f)) out.push(f);
  };
  const name = (r: Ref) => {
    if ('name' in r) return listed(r.name) ? r.name : null;
    const n = BOOK.find(r.kind, r.by, r.v);
    use(n, r.by);
    return n;
  };
  switch (s.k) {
    case 'eq':
    case 'gt':
      use(name(s.a), s.field);
      break;
    case 'cmp':
      use(name(s.a), s.field);
      use(name(s.b), s.field);
      break;
    case 'flows':
      use(name(s.a), 'through');
      name(s.b);
      break;
    case 'super': {
      const a = name(s.a)!;
      use(a, s.field);
      const others = roster(s.kind, s.group).filter((o) => o !== a);
      const va = BOOK.get(a, s.field) as number;
      const bigger = others.filter((o) => ((BOOK.get(o, s.field) as number | null) ?? -Infinity) > va);
      if (bigger.length) use(bigger.sort((x, y) => (BOOK.get(y, s.field) as number) - (BOOK.get(x, s.field) as number))[0], s.field);
      else for (const o of others) use(o, s.field);
      break;
    }
  }
  return out;
}

// ---- claims in words ----------------------------------------------------------------------------------------

export function refText(r: Ref): string {
  if ('name' in r) return r.name;
  if (r.kind === 'country') return `the country whose capital is ${r.v}`;
  if (r.kind === 'planet') return `planet number ${r.v} from the Sun`;
  return r.by === 'number' ? `the element with atomic number ${r.v}` : `the element with chemical symbol ${r.v}`;
}

const GT: Record<string, (a: string, n: string) => string> = {
  population: (a, n) => `${a} has more than ${n} million people.`,
  area: (a, n) => `${a} has an area of more than ${n} thousand km².`,
  length: (a, n) => `${a} is longer than ${n} km.`,
  melting: (a, n) => `${a} melts at a temperature above ${n} °C.`,
  number: (a, n) => `The atomic number of ${a} is greater than ${n}.`,
  diameter: (a, n) => `${a} is more than ${n} km across.`,
  moons: (a, n) => `${a} has more than ${n} known moons.`,
  order: (a, n) => `${a} is further from the Sun than planet number ${n}.`,
};
const CMP: Record<string, (a: string, b: string) => string> = {
  population: (a, b) => `${a} has more people than ${b}.`,
  area: (a, b) => `${a} has a larger area than ${b}.`,
  length: (a, b) => `${a} is longer than ${b}.`,
  melting: (a, b) => `${a} has a higher melting point than ${b}.`,
  number: (a, b) => `${a} has a higher atomic number than ${b}.`,
  diameter: (a, b) => `${a} is larger across than ${b}.`,
  moons: (a, b) => `${a} has more known moons than ${b}.`,
  order: (a, b) => `${a} is further from the Sun than ${b}.`,
};
const SUPER: Record<string, string> = { population: 'has the most people', area: 'has the largest area', length: 'is the longest', melting: 'has the highest melting point', number: 'has the highest atomic number', diameter: 'is the largest across', moons: 'has the most known moons', order: 'is the furthest from the Sun' };
const KIND_WORDS: Record<Kind, string> = { country: 'countries', river: 'rivers', element: 'elements', planet: 'planets' };

export function claimSentence(s: Spec): string {
  const a = refText(s.a);
  switch (s.k) {
    case 'eq':
      switch (s.field) {
        case 'capital':
          return `The capital of ${a} is ${s.v}.`;
        case 'continent':
          return cap(`${a} is in ${s.v}.`);
        case 'mouth':
          return cap(`${a} flows into the ${s.v}.`);
        case 'symbol':
          return `The chemical symbol of ${a} is ${s.v}.`;
        case 'state':
          return cap(`${a} is a ${s.v} at room temperature (20 °C).`);
        case 'rings':
          return cap(s.v ? `${a} has rings.` : `${a} has no rings.`);
        case 'number':
          return `The atomic number of ${a} is ${s.v}.`;
        default:
          return cap(`${a}: ${s.field} is ${String(s.v)}.`);
      }
    case 'gt':
      return cap(GT[s.field]!(a, num(s.n)));
    case 'cmp':
      return cap(CMP[s.field]!(a, refText(s.b)));
    case 'flows':
      return cap(`${a} flows through ${refText(s.b)}.`);
    case 'super':
      return `Of the listed ${KIND_WORDS[s.kind]}${s.group ? ` in ${s.group}` : ''}, ${a} ${SUPER[s.field]}.`;
  }
}

// ---- making claims ----------------------------------------------------------------------------------------

export type ClaimKind = 'eq' | 'gt' | 'cmp' | 'super' | 'flows' | 'join' | 'cmpjoin';

export interface Plan {
  kinds: ClaimKind[];
  /** Can the claim be undecidable? */
  unsure: boolean;
}

export const planFor = (level: number): Plan =>
  (
    [
      { kinds: ['eq'], unsure: false },
      { kinds: ['eq', 'gt'], unsure: true },
      { kinds: ['gt', 'cmp'], unsure: false },
      { kinds: ['cmp', 'gt'], unsure: true },
      { kinds: ['join', 'flows'], unsure: true },
      { kinds: ['eq', 'gt', 'cmp', 'join', 'flows'], unsure: true },
      { kinds: ['super', 'cmp'], unsure: false },
      { kinds: ['super', 'join'], unsure: true },
      { kinds: ['cmpjoin', 'flows', 'super'], unsure: true },
      { kinds: ['eq', 'gt', 'cmp', 'super', 'flows', 'join', 'cmpjoin'], unsure: true },
    ] as Plan[]
  )[Math.max(1, Math.min(10, Math.round(level) || 1)) - 1]!;

const KINDS: Kind[] = ['country', 'river', 'element', 'planet'];
const ofKind = (k: Kind, unsure: boolean, r: () => number) => (unsure && r() < 0.25 ? [...ENTITIES, ...UNLISTED] : ENTITIES).filter((e) => e.kind === k);

/** A nice round number near x (for "more than N"). */
function near(r: () => number, x: number): number {
  const t = x * (0.6 + 0.8 * r());
  const mag = 10 ** Math.max(0, Math.floor(Math.log10(Math.max(1, Math.abs(t)))) - 1);
  return Math.round(t / mag) * mag;
}

/** A reference to e by one of its linking facts (or by name when it has none). */
function linkRef(r: () => number, e: Entity): Ref {
  const by = LINKS[e.kind].filter((f) => e.f[f] != null);
  if (!by.length) return { name: e.name };
  const f = pick(r, by);
  return { kind: e.kind, by: f, v: e.f[f] as string | number };
}

function draft(r: () => number, ck: ClaimKind, unsure: boolean): Spec | null {
  const kind = pick(r, ck === 'flows' ? (['river'] as Kind[]) : ck === 'join' || ck === 'cmpjoin' ? (['country', 'element', 'planet'] as Kind[]) : KINDS);
  const pool = ofKind(kind, unsure, r);
  const a = pick(r, pool);
  switch (ck) {
    case 'eq': {
      const field = pick(r, WORDY[kind]);
      const other = pick(r, [...ENTITIES, ...UNLISTED].filter((e) => e.kind === kind && e.f[field] != null));
      return { k: 'eq', a: { name: a.name }, field, v: (r() < 0.5 ? a.f[field] ?? other.f[field] : other.f[field]) as Value };
    }
    case 'gt': {
      const field = pick(r, NUMERIC[kind].filter((f) => f !== 'order'));
      const known = ENTITIES.filter((e) => e.kind === kind && e.f[field] != null);
      const base = (a.f[field] as number | null) ?? (pick(r, known).f[field] as number);
      const n = near(r, base);
      return n === base ? null : { k: 'gt', a: { name: a.name }, field, n };
    }
    case 'cmp':
    case 'cmpjoin': {
      const field = pick(r, NUMERIC[kind]);
      const b = pick(r, pool);
      if (b === a) return null;
      const ref = (e: Entity) => (ck === 'cmpjoin' ? linkRef(r, e) : { name: e.name });
      return { k: 'cmp', a: ref(a), b: ref(b), field };
    }
    case 'join': {
      const field = pick(r, [...NUMERIC[kind], ...WORDY[kind]].filter((f) => !LINKS[kind].includes(f)));
      const ref = linkRef(r, a);
      if ('name' in ref) return null;
      if (NUMERIC[kind].includes(field)) {
        const known = ENTITIES.filter((e) => e.kind === kind && e.f[field] != null);
        const base = (a.f[field] as number | null) ?? (pick(r, known).f[field] as number);
        const n = near(r, base);
        return n === base ? null : { k: 'gt', a: ref, field, n };
      }
      const other = pick(r, ENTITIES.filter((e) => e.kind === kind && e.f[field] != null));
      return { k: 'eq', a: ref, field, v: (r() < 0.5 ? a.f[field] ?? other.f[field] : other.f[field]) as Value };
    }
    case 'flows': {
      const countries = ofKind('country', unsure, r);
      const c = r() < 0.5 && (a.f.through as string[]).length ? byName.get(pick(r, a.f.through as string[]))! : pick(r, countries);
      return { k: 'flows', a: { name: a.name }, b: r() < 0.5 ? { name: c.name } : linkRef(r, c) };
    }
    case 'super': {
      const sk = pick(r, ['country', 'country', 'river', 'element', 'planet'] as Kind[]);
      const field = pick(r, NUMERIC[sk].filter((f) => f !== 'order' && f !== 'number'));
      const group = sk === 'country' ? pick(r, ['Europe', 'Asia', 'Africa', 'South America', 'North America']) : null;
      const members = roster(sk, group);
      // Often the true leader (so true claims come up), otherwise any member.
      const known = members.filter((m) => BOOK.get(m, field) != null);
      const leader = known.sort((x, y) => (BOOK.get(y, field) as number) - (BOOK.get(x, field) as number))[0];
      const who = r() < 0.5 && leader ? leader : pick(r, members);
      return { k: 'super', a: { name: who }, field, kind: sk, group };
    }
  }
}

/** A claim the book judges `want` (T, F, or U = cannot be decided from it), of a kind the level allows. */
export function makeSpec(level: number, seed: number, want: Truth): Spec {
  const plan = planFor(level);
  const r = rng(seed * 7919 + Math.round(level) * 104729 + want.charCodeAt(0));
  const kinds = shuffle(r, plan.kinds.slice());
  for (let tries = 0; tries < 4000; tries++) {
    const ck = kinds[tries % kinds.length]!;
    const s = draft(r, ck, plan.unsure && want === 'U');
    if (s && evaluate(s, BOOK) === want) return s;
  }
  throw new Error(`no ${want} claim at level ${level}`);
}

/** Which truths a level's claims take, in turn. */
export const truthsFor = (level: number): Truth[] => (planFor(level).unsure ? ['T', 'F', 'U'] : ['T', 'F']);

/** Facts worth showing with a claim: what settles it, what is near it, and a few others; shuffled. */
export function factsFor(s: Spec, seed: number, extra: number): Fact[] {
  const r = rng(seed * 31 + 5);
  const ents = new Set<string>();
  const addRef = (x: Ref) => {
    const n = 'name' in x ? x.name : BOOK.find(x.kind, x.by, x.v);
    if (n && listed(n)) ents.add(n);
  };
  addRef(s.a);
  if (s.k === 'cmp' || s.k === 'flows') addRef(s.b);
  if (s.k === 'super') for (const m of roster(s.kind, s.group)) ents.add(m);
  const out = new Set<Fact>(support(s));
  for (const f of FACTS) if (ents.has(f.ent)) out.add(f);
  // Facts that look relevant but are not: the same field for other things, links of others.
  const field = 'field' in s ? s.field : 'through';
  const near = shuffle(r, FACTS.filter((f) => !out.has(f) && (f.field === field || LINKS[byName.get(f.ent)!.kind].includes(f.field))));
  for (const f of near.slice(0, extra)) out.add(f);
  for (const f of shuffle(r, FACTS.filter((f) => !out.has(f))).slice(0, Math.ceil(extra / 2))) out.add(f);
  return shuffle(r, [...out]);
}

/** What the book does not record about the things a claim names (said in words with the facts). */
export function gapsFor(s: Spec): string[] {
  const out: string[] = [];
  const ents: string[] = [];
  const addRef = (x: Ref) => {
    const n = 'name' in x ? x.name : BOOK.find(x.kind, x.by, x.v);
    if (n && listed(n)) ents.push(n);
  };
  addRef(s.a);
  if (s.k === 'cmp' || s.k === 'flows') addRef(s.b);
  if (s.k === 'super') ents.push(...roster(s.kind, s.group));
  const field = s.k === 'flows' ? 'through' : s.field;
  for (const e of new Set(ents)) if (BOOK.get(e, field) == null && byName.get(e)!.f[field] !== undefined) out.push(notRecorded(e, field));
  return out;
}

/** The roster lines (so "not in the list" and "the most of the group" can be judged). */
export function rosterLine(s: Spec): string {
  const kinds = new Set<Kind>();
  const kindOf = (x: Ref): Kind => ('name' in x ? (byName.get(x.name) ?? UNLISTED.find((e) => e.name === x.name))!.kind : x.kind);
  kinds.add(s.k === 'super' ? s.kind : kindOf(s.a));
  if (s.k === 'cmp') kinds.add(kindOf(s.b));
  if (s.k === 'flows') kinds.add('country');
  return [...kinds].map((k) => `The ${KIND_WORDS[k]} in the book are exactly: ${roster(k, null).join(', ')}.`).join(' ');
}

export const randomSeed = (r: () => number) => randInt(r, 1, 1e9);
