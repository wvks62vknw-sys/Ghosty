/**
 * NAME IT and WHAT'S IN IT, shared by the brain (integrations/plantnet.ts, tools/lens.ts,
 * integrations/foods.ts) and the phone (features/lens/living.ts).
 *
 * NAME IT names a plant, a bird, an insect or another living thing from one photo: plants go to
 * Pl@ntNet (its free key, 500 a day), everything else to Ghosty's model that can see, asked for
 * JSON that is checked here before anything shows. WHAT'S IN IT lists the foods on a plate with
 * guessed portions for a rough total. Honesty is in the words: one of three levels (sure /
 * probably / a guess) or "I can't tell from this photo", "about 70 % sure" (never a false
 * precision), and every food total is "about" with the line that says why it is rough.
 * Never a person: a photo of someone is said to be a person and nothing more.
 */

/** How sure, in three plain levels, or not able to tell at all. */
export type Sureness = 'sure' | 'probably' | 'a guess' | 'cant';

export type LivingKind = 'plant' | 'bird' | 'insect' | 'animal' | 'fungus' | 'person' | 'none';
/** What the owner asked about: PLANT goes to Pl@ntNet, the rest to the model that can see. */
export type AskedKind = 'plant' | 'bird' | 'insect' | 'other';
export const ASKED_KINDS: readonly AskedKind[] = ['plant', 'bird', 'insect', 'other'];

/** A living thing named from a photo, checked. */
export interface Living {
  kind: LivingKind;
  /** The Latin name ("Erithacus rubecula"), '' when not known. */
  species: string;
  /** The common UK name ("European robin"), '' when not known. */
  common: string;
  level: Sureness;
  /** Pl@ntNet's score, 0–1 (plants only): shown as "about 70 % sure". */
  score?: number;
  /** The sureness in the model's own words (the model's answers only). */
  said?: string;
  /** One tell-tale feature in the photo (a plant: its family). */
  tell: string;
  /** Who named it: "Pl@ntNet" or the model's name. */
  by: string;
  /** Pl@ntNet's next best names, best first. */
  alt?: { species: string; common: string; score: number }[];
}

/** Pl@ntNet's score → a level: 0.8 and over sure, 0.4 probably, 0.1 a guess, under that it cannot tell. */
export function levelFromScore(score: number): Sureness {
  if (!Number.isFinite(score) || score < 0.1) return 'cant';
  if (score >= 0.8) return 'sure';
  if (score >= 0.4) return 'probably';
  return 'a guess';
}

/** "about 70 % sure": to the nearest 10 (never 73 %), "over 90 %" at the top, "under 10 %" at the bottom. */
export function aboutPercent(score: number): string {
  if (!Number.isFinite(score) || score < 0.1) return 'under 10 % sure';
  if (score >= 0.95) return 'over 90 % sure';
  return `about ${Math.min(90, Math.max(10, Math.round(score * 10) * 10))} % sure`;
}

/**
 * The model's sureness in its own words → a level. "Can't tell" first; then the doubting words
 * ("not sure" holds "sure"), then the middling ones ("fairly confident"), then the sure ones. A
 * number ("80% confident") is read too but never shown. Anything unclear counts as a guess.
 */
export function levelFromWords(words: string): Sureness {
  const w = String(words ?? '').toLowerCase().replace(/[’`]/g, "'");
  if (!w.trim()) return 'a guess';
  if (/\b(can'?t tell|cannot tell|can not tell|no idea|unknown|impossible to (?:tell|say)|not possible|unidentifiable|can'?t say|cannot say)\b/.test(w)) return 'cant';
  const pct = w.match(/(\d{1,3})\s*(?:%|per ?cent)/);
  if (pct) {
    const n = Number(pct[1]);
    return n >= 85 ? 'sure' : n >= 50 ? 'probably' : n >= 10 ? 'a guess' : 'cant';
  }
  if (/\b(guess(?:ing)?|not (?:very |entirely |too |that )?(?:sure|certain|confident)|unsure|uncertain|low|might|maybe|perhaps|possibly|could be|hard to (?:tell|say)|doubt\w*|unclear|blurry|tentative)\b/.test(w)) return 'a guess';
  if (/\b(probabl\w*|likely|fairly|reasonably|moderate\w*|medium|think|seems?|looks? like|quite|pretty)\b/.test(w)) return 'probably';
  if (/\b(certain\w*|sure|confident|definite\w*|clearly|unmistakabl\w*|high|very|positive|no doubt)\b/.test(w)) return 'sure';
  return 'a guess';
}

const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** The first JSON object in a reply (a model may wrap it in ```json fences or a sentence). */
export function firstJson(text: string): Record<string, unknown> | null {
  const s = String(text ?? '');
  const start = s.indexOf('{');
  if (start < 0) return null;
  // the outermost balanced braces from the first "{", strings respected
  let depth = 0;
  let inStr = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try {
        const o = JSON.parse(s.slice(start, i + 1)) as unknown;
        return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

const KINDS: readonly LivingKind[] = ['plant', 'bird', 'insect', 'animal', 'fungus', 'person', 'none'];
/** Words that mean a human, whatever kind the model claimed: never named. */
const HUMAN = /^(?:homo sapiens|(?:an? )?(?:human(?: being)?|person|people|man|woman|boy|girl|child|baby|face|selfie))$/i;

/**
 * The model's NAME IT reply, checked: JSON with a known kind, names that are short plain text, a
 * sureness mapped to a level, a tell-tale of one line. A person is only ever "person". A reply
 * that is not that JSON is null (the card says the answer could not be read, not a made-up name).
 */
export function checkLiving(text: string, by = 'the model'): Living | null {
  const o = firstJson(text);
  if (!o) return null;
  const rawKind = clean(o.kind, 20).toLowerCase();
  let kind: LivingKind = (KINDS as readonly string[]).includes(rawKind) ? (rawKind as LivingKind) : rawKind ? 'animal' : 'none';
  let species = clean(o.species, 80);
  let common = clean(o.common, 80);
  const said = clean(o.sure, 80);
  let tell = clean(o.tell, 160);
  if (kind === 'person' || HUMAN.test(species) || HUMAN.test(common)) return { kind: 'person', species: '', common: '', level: 'cant', tell: '', by, said };
  // a Latin name is two words or more of letters; anything else (a sentence, a URL) is dropped
  if (species && !/^[A-Za-z][A-Za-z.\- ×]{2,79}$/.test(species)) species = '';
  if (common && /https?:|www\./i.test(common)) common = '';
  if (/https?:|www\./i.test(tell)) tell = '';
  let level = levelFromWords(said);
  if (!species && !common) {
    level = 'cant';
    kind = kind === 'none' ? 'none' : kind;
  }
  if (level === 'cant') return { kind, species: '', common: '', level, tell: '', by, said };
  return { kind, species, common, level, tell, by, said };
}

/** What Pl@ntNet's /v2/identify answers (only what is read). */
interface PlantNetReply {
  bestMatch?: unknown;
  results?: {
    score?: unknown;
    species?: {
      scientificNameWithoutAuthor?: unknown;
      commonNames?: unknown;
      genus?: { scientificNameWithoutAuthor?: unknown };
      family?: { scientificNameWithoutAuthor?: unknown };
    };
  }[];
  remainingIdentificationRequests?: unknown;
}

/**
 * Pl@ntNet's reply → the best match as a Living (its score as "about N % sure", its family as the
 * tell-tale) with the next two names, or a "can't tell" when nothing scores 10 % or more.
 */
export function parsePlantNet(reply: unknown): Living & { remaining?: number } {
  const r = (reply ?? {}) as PlantNetReply;
  const rows = (Array.isArray(r.results) ? r.results : [])
    .map((x) => ({
      species: clean(x?.species?.scientificNameWithoutAuthor, 80),
      common: Array.isArray(x?.species?.commonNames) ? clean(x.species!.commonNames[0], 80) : '',
      score: typeof x?.score === 'number' && Number.isFinite(x.score) ? Math.max(0, Math.min(1, x.score)) : 0,
      family: clean(x?.species?.family?.scientificNameWithoutAuthor, 60),
    }))
    .filter((x) => x.species)
    .sort((a, b) => b.score - a.score);
  const left = typeof r.remainingIdentificationRequests === 'number' ? r.remainingIdentificationRequests : undefined;
  const best = rows[0];
  const base = { kind: 'plant' as const, by: 'Pl@ntNet', ...(left != null ? { remaining: left } : {}) };
  if (!best || levelFromScore(best.score) === 'cant') return { ...base, species: '', common: '', level: 'cant', tell: '', ...(best ? { score: best.score } : {}) };
  return {
    ...base,
    species: best.species,
    common: best.common,
    level: levelFromScore(best.score),
    score: best.score,
    tell: best.family ? `family ${best.family}` : '',
    alt: rows.slice(1, 3).filter((x) => x.score >= 0.05).map((x) => ({ species: x.species, common: x.common, score: x.score })),
  };
}

/**
 * The plant tool's first line, read by the phone from the tool's result (which the chat shows
 * cut to 280 characters): `PLANTNET {json}`. A missing key, an error, or a result.
 */
export type PlantLine = { missing: 'key' } | { error: string } | Living;
export const PLANT_TAG = 'PLANTNET ';

export function plantLine(p: PlantLine): string {
  if ('missing' in p) return `${PLANT_TAG}{"m":"key"}`;
  if ('error' in p) return PLANT_TAG + JSON.stringify({ e: p.error.slice(0, 200) });
  // short keys: the phone reads at most 280 characters, and the names come first
  const o: Record<string, unknown> = { s: p.species, c: p.common, l: p.level, ...(p.score != null ? { p: Math.round(p.score * 1000) / 1000 } : {}), t: p.tell };
  if (p.alt?.length) o.a = p.alt.map((x) => [x.species, x.common, Math.round(x.score * 1000) / 1000]);
  let s = PLANT_TAG + JSON.stringify(o);
  if (s.length > 270) {
    delete o.a;
    s = PLANT_TAG + JSON.stringify(o);
  }
  if (s.length > 270) {
    o.t = '';
    s = PLANT_TAG + JSON.stringify(o);
  }
  return s;
}

/** The phone's side: the plant tool's result summary → what it says, or null when it is not one. */
export function readPlantLine(summary: string): PlantLine | null {
  const s = String(summary ?? '');
  const i = s.indexOf(PLANT_TAG);
  if (i < 0) return null;
  const o = firstJson(s.slice(i + PLANT_TAG.length));
  if (!o) return null;
  if (o.m === 'key') return { missing: 'key' };
  if (typeof o.e === 'string') return { error: clean(o.e, 200) };
  const level = (['sure', 'probably', 'a guess', 'cant'] as const).find((l) => l === o.l) ?? 'cant';
  const score = typeof o.p === 'number' ? o.p : undefined;
  const alt = Array.isArray(o.a)
    ? (o.a as unknown[])
        .filter((x): x is unknown[] => Array.isArray(x))
        .slice(0, 2)
        .map((x) => ({ species: clean(x[0], 80), common: clean(x[1], 80), score: typeof x[2] === 'number' ? x[2] : 0 }))
    : undefined;
  return { kind: 'plant', species: clean(o.s, 80), common: clean(o.c, 80), level, ...(score != null ? { score } : {}), tell: clean(o.t, 160), by: 'Pl@ntNet', ...(alt?.length ? { alt } : {}) };
}

/** A Wikipedia page for the name (the Latin name first: it is the one Wikipedia redirects reliably). */
export function wikiLink(l: Pick<Living, 'species' | 'common'>): string {
  const name = l.species || l.common;
  return name ? `https://en.wikipedia.org/wiki/${encodeURIComponent(name.trim().replace(/\s+/g, '_'))}` : '';
}

/**
 * "Common daisy" → "common daisy", "Robin" → "robin" for a sentence; a first word that is a place or a
 * person ("European robin", "Scots pine", "Daubenton's bat", "Atlantic salmon") keeps its capital.
 */
const PROPER_FIRST = /^(?:[A-Z][a-z]+(?:an|ese|ish|ic|'s|s')|Scots|Welsh|Canada|Brent|Sandwich|Dartford|Kentish|Cetti's|Montagu's|Leach's|Wilson's|Sabine's|Bewick's|Lapland|Mediterranean|Iceland|Siberian|Norway|Sitka|Douglas|Lombardy|Persian|Swiss|Turkey|Himalayan|Japanese|Chinese)\b/;
const lowerFirst = (s: string): string => (/^[A-Z][a-z]/.test(s) && !PROPER_FIRST.test(s) ? s[0]!.toLowerCase() + s.slice(1) : s);
const article = (s: string): string => (/^[aeiou]/i.test(s) && !/^(?:eu|uni|one)/i.test(s) ? 'an' : 'a');
/** "a robin", "an oak", the plain name for saying. */
export function aName(l: Pick<Living, 'species' | 'common'>): string {
  const n = l.common ? lowerFirst(l.common) : l.species;
  return n ? `${article(n)} ${n}` : '';
}

/** What the card says, in the owner's words. */
export interface LivingCard {
  /** The name to show big ("European robin"), '' when it could not tell. */
  title: string;
  /** The Latin name under it. */
  latin: string;
  /** One sentence that carries the level: "Probably a European robin." / "I can't tell from this photo." */
  lead: string;
  /** "about 70 % sure" (a plant) or "probably — the model said “fairly confident”". */
  sure: string;
  /** "Tell-tale: an orange-red breast" / "Family: Asteraceae". */
  tell: string;
  link: string;
  /** Who named it. */
  by: string;
  /** Other names it could be (plants). */
  others: string;
  /** SAVE is offered (a name to keep); never for a person or a "can't tell". */
  canSave: boolean;
}

export function livingCard(l: Living): LivingCard {
  const title = l.common || l.species;
  const blank = { title: '', latin: '', tell: '', link: '', others: '', canSave: false, by: l.by };
  if (l.kind === 'person') return { ...blank, lead: "That's a person. Ghosty doesn't identify people.", sure: '' };
  if (l.level === 'cant' || !title) return { ...blank, lead: "I can't tell from this photo. Try closer, in good light, with one thing filling the frame.", sure: l.score != null ? `${aboutPercent(l.score)} of anything` : l.said ? `the model said “${l.said}”` : '' };
  const a = aName(l);
  const lead = l.level === 'sure' ? `It's ${a}.` : l.level === 'probably' ? `Probably ${a}.` : `A guess: ${a}.`;
  const sure = l.score != null ? aboutPercent(l.score) : `${l.level}${l.said ? ` — the model said “${l.said}”` : ''}`;
  const tell = l.tell ? (/^family /.test(l.tell) ? `Family: ${l.tell.slice(7)}` : `Tell-tale: ${l.tell}`) : '';
  const others = (l.alt ?? []).map((x) => `${x.common || x.species} (${aboutPercent(x.score).replace(/ sure$/, '')})`).join(', ');
  return { title, latin: l.species && l.species !== title ? l.species : '', lead, sure, tell, link: wikiLink(l), by: l.by, others: others ? `Could also be: ${others}` : '', canSave: true };
}

/** What SAVE keeps in Memory: "seen: a robin, 24 Oct, near home" (the place only when the phone knew it was near home). */
export function seenMemory(l: Pick<Living, 'species' | 'common'>, when: Date, nearHome = false): string {
  const day = `${when.getDate()} ${when.toLocaleString('en-GB', { month: 'short' }).replace(/\.$/, '')}`;
  return `seen: ${aName(l)}, ${day}${nearHome ? ', near home' : ''}`;
}

/** The question for a living thing that is not a plant (or a plant without Pl@ntNet), sent with the photo. */
export function livingQuestion(kind: AskedKind): string {
  const what = kind === 'other' ? 'living thing' : kind;
  return [
    `LENS NAME IT (${what}): name the ${what} in this photo.`,
    'Reply with ONLY this JSON, no other words:',
    '{"kind":"plant|bird|insect|animal|fungus|person|none","species":"Latin name","common":"common UK name","sure":"how sure you are, in your own words","tell":"one feature in the photo that gives it away"}',
    'If it is a person, use kind "person" and leave the rest empty: never say who anyone is.',
    `If you cannot tell from this photo, leave species and common empty and put "can't tell" in sure.`,
  ].join('\n');
}

/** The question that runs the plant tool on a picture the Lens holds by id for a few seconds. */
export function plantQuestion(pictureId: string): string {
  return `LENS NAME IT (plant): run identify_plant with picture "${pictureId}" (the Lens's picture link, held for a moment) and say the name in one line.`;
}

// ---- WHAT'S IN IT: a meal -------------------------------------------------------------

/** One food the model saw, checked. */
export interface SeenFood {
  name: string;
  /** Its guessed portion in grams. */
  grams: number;
  /** A packaged product (a named brand or packet), looked up in Open Food Facts by name. */
  packaged?: boolean;
}

export interface SeenMeal {
  foods: SeenFood[];
  level: Sureness;
  said: string;
}

export function mealQuestion(): string {
  return [
    "LENS WHAT'S IN IT: list the foods and drinks in this photo with a rough portion each.",
    'Reply with ONLY this JSON, no other words:',
    '{"foods":[{"name":"plain food name, e.g. chips","grams":150,"packaged":false}],"sure":"how sure you are, in your own words"}',
    'Use packaged:true only for a branded packet or bottle (put the brand in the name). No health advice.',
    `If there is no food, or you cannot tell, reply {"foods":[],"sure":"can't tell"}.`,
  ].join('\n');
}

/** The model's WHAT'S IN IT reply, checked: at most 12 foods, plain names, 1–2,000 g each. Null when it is not that JSON. */
export function checkMeal(text: string): SeenMeal | null {
  const o = firstJson(text);
  if (!o || !Array.isArray(o.foods)) return null;
  const foods: SeenFood[] = [];
  for (const f of o.foods.slice(0, 12) as Record<string, unknown>[]) {
    const name = clean(f?.name, 60).toLowerCase();
    const g = typeof f?.grams === 'number' ? f.grams : parseFloat(String(f?.grams ?? ''));
    if (!name || /https?:|www\./.test(name) || !Number.isFinite(g) || g <= 0) continue;
    foods.push({ name, grams: Math.round(Math.min(2000, Math.max(1, g))), ...(f?.packaged === true ? { packaged: true } : {}) });
  }
  const said = clean(o.sure, 80);
  return { foods, said, level: foods.length ? levelFromWords(said) : 'cant' };
}

/** Energy and the three big nutrients, per 100 g (a table row) or for a portion. */
export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** One food of the meal, matched. */
export interface MealItem extends SeenFood {
  /** The table's food or the product it was matched to ('' when nothing matched). */
  match: string;
  from: 'table' | 'Open Food Facts' | 'none';
  /** For this portion; absent when nothing matched. */
  macros?: Macros;
}

export interface MealTotal {
  items: MealItem[];
  total: Macros;
  /** Foods counted / foods seen. */
  counted: number;
  /** "about 650 kcal" */
  line: string;
  honesty: string;
}

export const MEAL_HONESTY = 'rough: portions are guessed from a photo';

/** A total said plainly: kcal to the nearest 10 (nearest 50 from 1,000), grams whole. */
export function roughKcal(kcal: number): number {
  if (!Number.isFinite(kcal) || kcal <= 0) return 0;
  return kcal >= 1000 ? Math.round(kcal / 50) * 50 : Math.max(10, Math.round(kcal / 10) * 10);
}

/** A portion's figures from per-100 g ones. */
export function forPortion(per100: Macros, grams: number): Macros {
  const k = grams / 100;
  return { kcal: per100.kcal * k, protein: per100.protein * k, carbs: per100.carbs * k, fat: per100.fat * k };
}

/** Add up the matched foods: "about 650 kcal" with the honesty line; unmatched foods are said, not guessed. */
export function mealTotals(items: MealItem[]): MealTotal {
  const sum: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  let counted = 0;
  for (const it of items) {
    if (!it.macros) continue;
    counted++;
    sum.kcal += it.macros.kcal;
    sum.protein += it.macros.protein;
    sum.carbs += it.macros.carbs;
    sum.fat += it.macros.fat;
  }
  const total = { kcal: roughKcal(sum.kcal), protein: Math.round(sum.protein), carbs: Math.round(sum.carbs), fat: Math.round(sum.fat) };
  const missed = items.length - counted;
  const line = counted ? `about ${total.kcal.toLocaleString('en-GB')} kcal` : 'no total: none of the foods matched';
  const honesty = `${MEAL_HONESTY}${missed ? `; ${missed} of ${items.length} not counted (no match)` : ''}`;
  return { items, total, counted, line, honesty };
}

/** The meal card's lines: one per food, then the total; never a health claim. */
export function mealCardLines(m: MealTotal): string[] {
  const rows = m.items.map((it) => (it.macros ? `${it.name}, about ${Math.round(it.grams)} g: about ${roughKcal(it.macros.kcal)} kcal${it.from === 'Open Food Facts' ? ' (Open Food Facts)' : ''}` : `${it.name}, about ${Math.round(it.grams)} g: not matched, not counted`));
  return [...rows, `${m.line[0]!.toUpperCase()}${m.line.slice(1)}; ${m.total.protein} g protein, ${m.total.carbs} g carbs, ${m.total.fat} g fat (${m.honesty}).`];
}

// ---- nothing kept: the Lens's NAME IT and WHAT'S IN IT exchanges leave no trace in the conversation --------

/** A Lens NAME IT or WHAT'S IN IT question (the words the phone sends; " [photo]" may follow). */
export const isLensAsk = (text: string): boolean => /^LENS (?:NAME IT \(|WHAT'S IN IT)/.test(String(text ?? '').trimStart());

/** A reply to one (the model's JSON, or a reply that carries the plant tool's line): known by its shape. */
export function isLensReply(text: string): boolean {
  const t = String(text ?? '');
  if (t.length > 3000) return false;
  if (t.includes(PLANT_TAG + '{')) return true;
  const o = firstJson(t);
  return !!o && (('kind' in o && 'species' in o && 'sure' in o) || (Array.isArray(o.foods) && 'sure' in o));
}

/**
 * The conversation without the Lens's NAME IT and WHAT'S IN IT exchanges (the question, the tool
 * calls and the reply, up to the next message of the owner's): the card on the phone is the answer,
 * and only SAVE keeps anything. Works on the saved history (turns, where the question is saved
 * before its reply, so a reply is known by its shape too) and the model's context (messages).
 * Returns the same list when there is nothing to drop.
 */
export function dropLensExchanges<T>(items: T[], isUser: (t: T) => boolean, text: (t: T) => string): T[] {
  let dropping = false;
  let changed = false;
  const out = items.filter((t) => {
    if (isUser(t)) dropping = isLensAsk(text(t));
    const drop = dropping || (!isUser(t) && isLensReply(text(t)));
    if (drop) changed = true;
    return !drop;
  });
  return changed ? out : items;
}
