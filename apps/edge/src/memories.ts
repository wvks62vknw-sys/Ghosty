/**
 * Everything Ghosty remembers about the owner, as one TIMELINE (the Memory tab): the profile's
 * lines, the saved facts, the diary and the lessons it learned — each with WHERE IT CAME FROM
 * (typed by the owner, saved in a chat, or the nightly reflection, with the owner's own message
 * when it is still in the history), and each one editable, forgettable (with UNDO) and LOCKABLE:
 * a locked memory is never reworded, merged away or dropped by the nightly reflection or by
 * running out of room.
 *
 * And PATTERNS: plain things noticed over time — when the owner usually talks, topics that keep
 * coming back, moods they mention — worked out by counting what is stored (a small per-day tally
 * kept here, never sent anywhere), each with how much backs it up, and dismissable. Nothing is
 * guessed: no count, no pattern.
 *
 * Storage: `profile:meta` (a line's source, lock and edit time, keyed by the line in lower case),
 * `diary:locks`, `memory:forgotten` (the last forgotten things, for UNDO), `patterns:days`,
 * `patterns:filed` and `patterns:dismissed`. Facts and lessons carry their own source and lock.
 */
import type { ChatTurn, ForgottenItem, Lesson, MemoryFact, MemoryItem, MemoryKind, MemoryPattern, MemorySource, ProfileSection } from '../../../packages/shared/src/protocol';
import { PROFILE_SECTIONS } from '../../../packages/shared/src/protocol';
import { LESSONS_KEY, loadLessons } from './knowledge';
import type { Library } from './library/store';
import { DIARY_DOC, diaryEntries, loadProfile, looksSecret, saveProfile, type ProfileDeps } from './profile';
import { safeTz, zoned } from './time';
import { loadMemory, MEMORY_KEY } from './tools/memory';

export const META_KEY = 'profile:meta';
export const DIARY_LOCKS_KEY = 'diary:locks';
export const FORGOTTEN_KEY = 'memory:forgotten';
export const DAYS_KEY = 'patterns:days';
/** The times of the history's messages already in the day log (a message sent in late, after a pause, still counts once). */
export const FILED_KEY = 'patterns:filed';
export const DISMISSED_KEY = 'patterns:dismissed';
/** The chat history agent.ts keeps (its TURNS_KEY). */
const TURNS_KEY = 'turns';
/** Forgotten things kept for UNDO: for a day (then gone for good), at most this many. */
const UNDO_KEEP = 100;
export const UNDO_MS = 24 * 3600_000;
/** The stash stays well under the storage's 128 KB a value. */
const UNDO_BYTES = 100_000;
/** Days of tallies kept for patterns. */
const DAYS_KEEP = 120;

/** A profile line's source, lock and last edit (lines are plain strings in the profile itself). */
export interface LineMeta {
  at: number;
  src: MemorySource;
  locked?: boolean;
  edited?: number;
}
export type LineMetaMap = Record<string, LineMeta>;

/** The key a line's meta is kept under: the line in lower case, spaces squeezed (lines are unique that way). */
export const lineKey = (text: string): string => text.replace(/\s+/g, ' ').trim().toLowerCase();

export async function loadLineMeta(storage: DurableObjectStorage): Promise<LineMetaMap> {
  return (await storage.get<LineMetaMap>(META_KEY)) ?? {};
}

export async function saveLineMeta(storage: DurableObjectStorage, meta: LineMetaMap, liveLines?: Iterable<string>): Promise<void> {
  // Meta for lines that are gone is dropped, so the map never outgrows the profile.
  if (liveLines) {
    const live = new Set([...liveLines].map(lineKey));
    for (const k of Object.keys(meta)) if (!live.has(k)) delete meta[k];
  }
  await storage.put(META_KEY, meta);
}

/** The locked lines (their keys). */
export const lockedLines = (meta: LineMetaMap): Set<string> => new Set(Object.entries(meta).filter(([, m]) => m.locked).map(([k]) => k));

const STOP = new Set(
  ('that this with from have what when where which there their they them then than your yours about would could should into just like really very much more some will been being were want need know think going make made does doing done thing things also only even well good okay yeah sure please thanks thank today tonight tomorrow yesterday morning evening night time week weekend year years day days last next ever never always still again here back over under after before because while every other another each most many such these those mine ours ghosty hello right maybe actually something anything nothing everything someone anyone tell said says say asked ask help remember forget look looking find found show give gave take took come came went getting have having know knew lets shall might must cannot cant dont didnt doesnt isnt wasnt arent wont youre theyre thats whats ive youve weve were heres hows whos whens wheres little quite pretty kind sort lot lots bit stuff yes along coming goes gone keep kept keeps start started stop stopped tried trying used using went seen seem seems feel felt meant mean means told telling talk talking call called work works thought thinking getting gets give gives makes making takes taking looks looked anyway though although around through without within across later soon early first second third enough rather instead already almost often usually sometimes maybe perhaps okay alright cheers sorry hmm hey hiya morning afternoon evening'
  ).split(' '),
);

/** Short capitalised words that are not names. */
const STOP3 = new Set('the and but for you her his she can not was yes now our its how why who get got did had has all any one two off out see too way let day new old big are may per via'.split(' '));
/** Mood words are counted as moods, never as topics. */
const MOOD_WORDS = new Set('tired exhausted knackered shattered stressed anxious worried nervous overwhelmed happy great excited chuffed brilliant cheerful lonely miserable angry annoyed frustrated cross irritated bored feeling feel'.split(' '));

/** The words worth matching on: lower case, four letters or more (or a three-letter name: "Ann", "Tom"), no common words. */
export function contentWords(text: string): string[] {
  const out: string[] = [];
  for (const m of text.replace(/[’']/g, '').match(/[A-Za-z][A-Za-z-]{2,}/g) ?? []) {
    const w = m.toLowerCase();
    if (w.length === 3 ? /^[A-Z][a-z]{2}$/.test(m) && !STOP3.has(w) : !STOP.has(w) && !MOOD_WORDS.has(w)) out.push(w);
  }
  return out;
}

/** A word without its common ending, for matching "works" with "work" and "drinking" with "drink". */
const stem = (w: string): string => {
  const s = w.replace(/(ing|ed|s)$/, '');
  return s.length >= 3 ? s : w;
};

/**
 * The owner's message a remembered line most likely came from: the one sharing the most content
 * words with it (at least two, or the line's only one). Undefined when none really matches —
 * the source then says "the nightly reflection" without pointing at a message.
 */
export function bestTurn(text: string, turns: { text: string; at: number }[]): number | undefined {
  const want = new Set(contentWords(text).map(stem));
  if (!want.size) return undefined;
  let best: { at: number; n: number } | undefined;
  for (const t of turns) {
    const have = new Set(contentWords(t.text).map(stem));
    let n = 0;
    for (const w of want) if (have.has(w)) n++;
    if (n && (!best || n > best.n || (n === best.n && t.at > best.at))) best = { at: t.at, n };
  }
  return best && (best.n >= 2 || best.n >= want.size) ? best.at : undefined;
}

// ---------- the timeline ----------

const noon = (heading: string): number => Date.parse(`${heading.slice(0, 10)}T12:00:00Z`) || 0;

/** A source with the owner's own message filled in, while that message is still in the history. */
function withQuote(src: MemorySource, owner: ChatTurn[]): MemorySource {
  let turn: ChatTurn | undefined;
  if (src.turnAt) turn = owner.find((t) => t.at === src.turnAt);
  // Saved during a chat: the owner's latest message at that moment (the remember tool runs inside the turn).
  else if (src.kind === 'chat') turn = [...owner].reverse().find((t) => t.at <= src.at + 1000 && t.at > src.at - 30 * 60_000);
  if (!turn) return src;
  return { ...src, turnAt: turn.at, quote: turn.text.replace(/\s+/g, ' ').trim().slice(0, 200) };
}

/** Everything remembered about the owner, newest first. */
export async function timeline(deps: Pick<ProfileDeps, 'storage' | 'library'>): Promise<MemoryItem[]> {
  const { storage, library } = deps;
  const [profile, meta, facts, lessons, dlocks, turns] = await Promise.all([
    loadProfile(storage),
    loadLineMeta(storage),
    loadMemory(storage),
    loadLessons(storage),
    storage.get<string[]>(DIARY_LOCKS_KEY),
    storage.get<ChatTurn[]>(TURNS_KEY),
  ]);
  const owner = (turns ?? []).filter((t) => t.role === 'user');
  const items: MemoryItem[] = [];
  for (const section of PROFILE_SECTIONS) {
    for (const text of profile.sections[section]) {
      const m = meta[lineKey(text)];
      const at = m?.at ?? profile.updatedAt;
      items.push({ id: `p:${lineKey(text)}`, kind: 'profile', section, text, at, src: withQuote(m?.src ?? { kind: 'unknown', at }, owner), locked: !!m?.locked, ...(m?.edited ? { edited: m.edited } : {}) });
    }
  }
  for (const f of facts) items.push({ id: `f:${f.id}`, kind: 'fact', text: f.text, at: f.at, src: withQuote(f.src ?? { kind: 'unknown', at: f.at }, owner), locked: !!f.locked, ...(f.edited ? { edited: f.edited } : {}) });
  const locked = new Set(dlocks ?? []);
  for (const d of diaryEntries(library, 60)) {
    const at = noon(d.heading);
    items.push({ id: `d:${d.heading}`, kind: 'diary', text: d.text, at, src: { kind: 'reflection', at }, locked: locked.has(d.heading) });
  }
  for (const l of lessons) items.push({ id: `l:${l.id}`, kind: 'lesson', text: l.text, at: l.at, src: { kind: 'ghosty', at: l.at }, locked: !!l.locked });
  return items.sort((a, b) => b.at - a.at);
}

// ---------- edit, forget (with UNDO), lock ----------

/** What a forgotten memory was, exactly, so UNDO puts it back as it was (its source and lock too). */
interface Forgotten {
  id: string;
  gone: number;
  /** `i`: where it stood in its section, so UNDO puts it back in its place. */
  profile?: { section: ProfileSection; text: string; i?: number; meta?: LineMeta };
  fact?: MemoryFact;
  /** FORGET EVERYTHING, or a chat's "forget …" that matched several: the facts that went at once (the locked ones stay). */
  facts?: MemoryFact[];
  /** How RECENTLY FORGOTTEN names a group of facts (FORGET EVERYTHING's is the default). */
  label?: string;
  lesson?: Lesson;
  diary?: { heading: string; text: string; locked: boolean };
}

export class MemoryError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const cleanText = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim().slice(0, max) : '');

/** Find a profile line by its id (`p:<line in lower case>`). */
function findLine(profile: Awaited<ReturnType<typeof loadProfile>>, key: string): { section: ProfileSection; i: number } | null {
  for (const section of PROFILE_SECTIONS) {
    const i = profile.sections[section].findIndex((x) => lineKey(x) === key);
    if (i >= 0) return { section, i };
  }
  return null;
}

async function writeDiary(library: Library, heading: string, text: string): Promise<void> {
  if (!library.available) throw new MemoryError(503, 'the diary is not reachable right now');
  if (!library.doc(DIARY_DOC)) library.createDoc({ id: DIARY_DOC, title: 'Diary', source: 'written by Ghosty', kind: 'notes' });
  library.removeSection(DIARY_DOC, heading);
  await library.addPassages(DIARY_DOC, [{ heading, text }]);
  library.finish(DIARY_DOC);
}

/**
 * One change the owner asked for in the Memory tab. `edit` rewords (the owner's own words: a
 * locked memory can be edited too, and stays locked), `forget` removes it and keeps a copy for
 * UNDO, `restore` is that UNDO, `lock` / `unlock` set the lock. Returns the item as it now is
 * (null once forgotten).
 */
export async function changeMemory(deps: Pick<ProfileDeps, 'storage' | 'library'>, id: string, op: string, value?: unknown, now = Date.now()): Promise<MemoryItem | null> {
  const { storage, library } = deps;
  const kind = id.slice(0, 2);
  const key = id.slice(2);
  if (!key || !['p:', 'f:', 'd:', 'l:'].includes(kind)) throw new MemoryError(400, 'unknown memory');
  if (op === 'restore') return restore(deps, id, now);
  if (!['edit', 'forget', 'lock', 'unlock'].includes(op)) throw new MemoryError(400, 'unknown change');
  const lock = op === 'lock' ? true : op === 'unlock' ? false : undefined;
  let text = '';
  if (op === 'edit') {
    text = cleanText(value, kind === 'd:' ? 3900 : kind === 'p:' ? 160 : kind === 'l:' ? 300 : 400);
    if (kind === 'p:' || kind === 'f:') text = text.replace(/\n/g, ' ');
    if (!text) throw new MemoryError(400, 'nothing to keep: type the new words, or FORGET it instead');
    if (looksSecret(text)) throw new MemoryError(400, 'that looks like a password, key or card number: Ghosty keeps nothing like that in its memory of you');
  }
  const find = async () => (await timeline(deps)).find((x) => x.id === id) ?? null;

  if (kind === 'p:') {
    const profile = await loadProfile(storage);
    const meta = await loadLineMeta(storage);
    const at = findLine(profile, key);
    if (!at) throw new MemoryError(404, 'that line is not in your profile any more');
    const old = profile.sections[at.section][at.i]!;
    const m: LineMeta = meta[key] ?? { at: profile.updatedAt || now, src: { kind: 'unknown', at: profile.updatedAt || now } };
    if (op === 'forget') {
      await stash(storage, { id, gone: now, profile: { section: at.section, text: old, i: at.i, ...(meta[key] ? { meta: meta[key] } : {}) } });
      profile.sections[at.section].splice(at.i, 1);
      delete meta[key];
    } else if (op === 'edit') {
      const nk = lineKey(text);
      if (nk !== key && findLine(profile, nk)) throw new MemoryError(409, 'that line is already in your profile');
      profile.sections[at.section][at.i] = text;
      delete meta[key];
      meta[nk] = { ...m, edited: now };
    } else meta[key] = { ...m, locked: lock };
    profile.updatedAt = now;
    await saveProfile(storage, profile);
    await saveLineMeta(storage, meta, PROFILE_SECTIONS.flatMap((s) => profile.sections[s]));
    return op === 'forget' ? null : (await timeline(deps)).find((x) => x.id === `p:${op === 'edit' ? lineKey(text) : key}`) ?? null;
  }

  if (kind === 'f:') {
    const facts = await loadMemory(storage);
    const f = facts.find((x) => x.id === key);
    if (!f) throw new MemoryError(404, 'that memory is not there any more');
    if (op === 'forget') {
      await stash(storage, { id, gone: now, fact: { ...f } });
      facts.splice(facts.indexOf(f), 1);
    } else if (op === 'edit') {
      if (facts.some((x) => x !== f && x.text.toLowerCase() === text.toLowerCase())) throw new MemoryError(409, 'Ghosty already remembers that');
      f.text = text;
      f.edited = now;
    } else f.locked = lock;
    await storage.put(MEMORY_KEY, facts);
    return op === 'forget' ? null : find();
  }

  if (kind === 'l:') {
    const lessons = await loadLessons(storage);
    const l = lessons.find((x) => x.id === key);
    if (!l) throw new MemoryError(404, 'that lesson is not there any more');
    if (op === 'forget') {
      await stash(storage, { id, gone: now, lesson: { ...l } });
      lessons.splice(lessons.indexOf(l), 1);
    } else if (op === 'edit') l.text = text;
    else l.locked = lock;
    await storage.put(LESSONS_KEY, lessons);
    return op === 'forget' ? null : find();
  }

  // the diary: one entry a day, in the library
  const locks = new Set((await storage.get<string[]>(DIARY_LOCKS_KEY)) ?? []);
  const entry = diaryEntries(library, 400).find((d) => d.heading === key);
  if (!entry) throw new MemoryError(404, 'that diary entry is not there any more');
  if (op === 'forget') {
    await stash(storage, { id, gone: now, diary: { heading: key, text: entry.text, locked: locks.has(key) } });
    library.removeSection(DIARY_DOC, key);
    locks.delete(key);
  } else if (op === 'edit') await writeDiary(library, key, text);
  else if (lock) locks.add(key);
  else locks.delete(key);
  await storage.put(DIARY_LOCKS_KEY, [...locks]);
  return op === 'forget' ? null : find();
}

/** The forgotten memories still within their day; anything older is dropped for good (and the drop saved). */
async function loadForgotten(storage: DurableObjectStorage, now: number): Promise<Forgotten[]> {
  const all = (await storage.get<Forgotten[]>(FORGOTTEN_KEY)) ?? [];
  const live = all.filter((x) => now - x.gone < UNDO_MS && x.gone <= now + 60_000);
  if (live.length !== all.length) await storage.put(FORGOTTEN_KEY, live);
  return live;
}

/** Drop what was forgotten more than a day ago (the nightly reflection calls this too). */
export async function pruneForgotten(storage: DurableObjectStorage, now = Date.now()): Promise<number> {
  const before = ((await storage.get<Forgotten[]>(FORGOTTEN_KEY)) ?? []).length;
  return before - (await loadForgotten(storage, now)).length;
}

async function stash(storage: DurableObjectStorage, f: Forgotten): Promise<void> {
  const list = (await loadForgotten(storage, f.gone)).filter((x) => x.id !== f.id);
  list.push(f);
  let keep = list.slice(-UNDO_KEEP);
  // Never past the storage's size for one value: the oldest go first.
  while (keep.length > 1 && JSON.stringify(keep).length > UNDO_BYTES) keep = keep.slice(1);
  if (f.facts && JSON.stringify(keep).length > UNDO_BYTES) while (f.facts.length > 1 && JSON.stringify(keep).length > UNDO_BYTES) f.facts.shift();
  await storage.put(FORGOTTEN_KEY, keep);
}

/** FORGET EVERYTHING (tools/memory.ts): the facts that went, kept a day for UNDO as one. */
export async function stashFacts(storage: DurableObjectStorage, facts: MemoryFact[], now = Date.now()): Promise<string> {
  const id = `f:*everything*${now}`;
  if (facts.length) await stash(storage, { id, gone: now, facts: facts.map((f) => ({ ...f })) });
  return id;
}

/**
 * The chat's `forget` (tools/memory.ts): what it removed, kept a day for UNDO like every other way of forgetting —
 * one fact as itself, several as one group ("3 facts matching “bike”") that UNDO brings back together.
 */
export async function stashForgottenFacts(storage: DurableObjectStorage, facts: MemoryFact[], words: string, now = Date.now()): Promise<void> {
  if (!facts.length) return;
  if (facts.length === 1) return stash(storage, { id: `f:${facts[0]!.id}`, gone: now, fact: { ...facts[0]! } });
  await stash(storage, { id: `f:*some*${now}`, gone: now, facts: facts.map((f) => ({ ...f })), label: `${facts.length} facts matching “${words.slice(0, 40)}”` });
}

const kindOf = (f: Forgotten): MemoryKind => (f.profile ? 'profile' : f.fact || f.facts ? 'fact' : f.lesson ? 'lesson' : 'diary');

/** RECENTLY FORGOTTEN: what UNDO can still bring back, newest first. */
export async function recentlyForgotten(storage: DurableObjectStorage, now = Date.now()): Promise<ForgottenItem[]> {
  return (await loadForgotten(storage, now))
    .map((f): ForgottenItem => ({
      id: f.id,
      kind: kindOf(f),
      text: f.profile?.text ?? f.fact?.text ?? f.lesson?.text ?? f.diary?.text ?? f.label ?? (f.facts ? `Everything I remembered (${f.facts.length} facts)` : ''),
      gone: f.gone,
      ...(f.facts ? { count: f.facts.length } : {}),
    }))
    .reverse();
}

/** UNDO: the forgotten memory back exactly as it was — its words, its section, its source and its lock. Refused once its day is up. */
async function restore(deps: Pick<ProfileDeps, 'storage' | 'library'>, id: string, now = Date.now()): Promise<MemoryItem | null> {
  const { storage, library } = deps;
  const list = await loadForgotten(storage, now);
  const f = [...list].reverse().find((x) => x.id === id);
  if (!f) throw new MemoryError(404, 'nothing to undo: it was forgotten too long ago');
  if (f.profile) {
    const profile = await loadProfile(storage);
    const meta = await loadLineMeta(storage);
    // back in its place in its section (an older copy without one goes at the end)
    const list = profile.sections[f.profile.section];
    if (!findLine(profile, lineKey(f.profile.text))) list.splice(Math.min(f.profile.i ?? list.length, list.length), 0, f.profile.text);
    if (f.profile.meta) meta[lineKey(f.profile.text)] = f.profile.meta;
    await saveProfile(storage, profile);
    await saveLineMeta(storage, meta, PROFILE_SECTIONS.flatMap((s) => profile.sections[s]));
  } else if (f.fact) {
    const facts = await loadMemory(storage);
    if (!facts.some((x) => x.id === f.fact!.id)) facts.push(f.fact);
    facts.sort((a, b) => a.at - b.at);
    await storage.put(MEMORY_KEY, facts);
  } else if (f.facts) {
    const facts = await loadMemory(storage);
    for (const x of f.facts) if (!facts.some((y) => y.id === x.id)) facts.push(x);
    facts.sort((a, b) => a.at - b.at);
    await storage.put(MEMORY_KEY, facts);
  } else if (f.lesson) {
    const lessons = await loadLessons(storage);
    if (!lessons.some((x) => x.id === f.lesson!.id)) lessons.push(f.lesson);
    await storage.put(LESSONS_KEY, lessons);
  } else if (f.diary) {
    await writeDiary(library, f.diary.heading, f.diary.text);
    if (f.diary.locked) await storage.put(DIARY_LOCKS_KEY, [...new Set([...((await storage.get<string[]>(DIARY_LOCKS_KEY)) ?? []), f.diary.heading])]);
  }
  await storage.put(FORGOTTEN_KEY, list.filter((x) => x !== f));
  if (f.facts) return null;
  return (await timeline(deps)).find((x) => x.id === (f.profile ? `p:${lineKey(f.profile.text)}` : id)) ?? null;
}

// ---------- patterns ----------

/** One day's tally of what the owner said: never the words themselves beyond a few topic words. */
export interface DayTally {
  /** YYYY-MM-DD in the owner's zone. */
  d: string;
  /** 0 = Sunday … 6 = Saturday */
  w: number;
  /** Messages from the owner. */
  n: number;
  /** Messages by time of day: morning (05–12), afternoon (12–17), evening (17–22), night (22–05). */
  h: [number, number, number, number];
  /** Topic words that day (each counted once per message), at most 24. */
  t: Record<string, number>;
  /** Moods the owner said they felt, by kind. */
  m: Record<string, number>;
}

const PARTS = ['in the morning', 'in the afternoon', 'in the evening', 'late at night'] as const;
const partOf = (h: number): 0 | 1 | 2 | 3 => (h >= 5 && h < 12 ? 0 : h >= 12 && h < 17 ? 1 : h >= 17 && h < 22 ? 2 : 3);
const DAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

/**
 * Health and medicine: never a pattern, whatever the owner said (illnesses, treatments, medicines,
 * the people and places of care, the body). Matched on the word and its plural.
 */
const HEALTH = new Set(
  ('ill illness sick sickness poorly unwell disease cancer tumour tumor chemo chemotherapy radiotherapy oncologist oncology diabetes diabetic insulin asthma inhaler epilepsy seizure stroke heart attack angina blood pressure cholesterol ' +
    'depression depressed anxiety disorder adhd autism autistic bipolar schizophrenia ptsd therapy therapist counsellor counselling psychiatrist psychologist mental ' +
    'doctor doctors surgery surgeon operation hospital clinic nurse appointment prescription prescribed pharmacy pharmacist medication medicine medicines tablet tablets pills dose dosage antibiotics antidepressants painkillers paracetamol ibuprofen ' +
    'pain painful migraine headache fever infection virus covid flu cough injury injured fracture broken sprain arthritis back knee hip pregnant pregnancy miscarriage fertility ivf period periods menopause ' +
    'diagnosis diagnosed symptoms symptom treatment scan biopsy xray mri test results gp nhs a&e ward dementia alzheimers parkinsons hiv std sti vaccine vaccination jab allergy allergic eczema rash weight diet dieting ozempic')
    .split(' '),
);
export const isHealthWord = (w: string): boolean => HEALTH.has(w) || (w.endsWith('s') && HEALTH.has(w.slice(0, -1)));

/** Moods, only as the owner says them of themselves ("I'm knackered", "feeling a bit low"). Health is left out on purpose. */
const MOODS: [string, string, RegExp][] = [
  ['tired', 'tired', /^(tired|exhausted|knackered|shattered|worn out)$/],
  ['stressed', 'stressed or worried', /^(stressed|anxious|worried|nervous|overwhelmed)$/],
  ['good', 'happy', /^(happy|great|excited|chuffed|brilliant|cheerful)$/],
  ['low', 'low', /^(sad|down|low|fed up|lonely|miserable)$/],
  ['annoyed', 'annoyed', /^(angry|annoyed|frustrated|cross|irritated)$/],
  ['bored', 'bored', /^bored$/],
];
const MOOD_WORD = '(tired|exhausted|knackered|shattered|worn out|stressed|anxious|worried|nervous|overwhelmed|happy|great|excited|chuffed|brilliant|cheerful|sad|down|low|fed up|lonely|miserable|angry|annoyed|frustrated|cross|irritated|bored)';
const ADVERB = '(?:so |really |very |a bit |a little |quite |pretty |totally |absolutely |bloody |rather |super |properly |well )?';
/** What may follow a mood word for it to be a mood: the end of a sentence, or words like "today", "about", "and". */
const MOOD_END = "(?=\\s*(?:[.!?,;:)]|$)|\\s+(?:today|tonight|now|right now|at the moment|again|lately|recently|this (?:morning|afternoon|evening|week)|all day|and|but|so|because|about|after|from|since)\\b)";
/**
 * A mood the owner states of themselves. "I feel / I'm feeling / I felt …" is feeling language;
 * plain "I'm / I was …" counts only when the mood word ends the thought — so "I'm low on milk",
 * "I was down the pub", "I'm great at chess" and "I'm happy to help" are never moods.
 */
const MOOD_RES = [
  new RegExp(`\\b(?:i feel|i'?m feeling|i am feeling|i was feeling|i'?ve been feeling|feeling|i felt)\\s+${ADVERB}${MOOD_WORD}${MOOD_END}`, 'gi'),
  new RegExp(`\\b(?:i'?m|i am|i was|i'?ve been)\\s+${ADVERB}${MOOD_WORD}${MOOD_END}`, 'gi'),
];

export function moodsIn(text: string): string[] {
  const out = new Set<string>();
  const said = text.replace(/[’]/g, "'");
  for (const m of MOOD_RES.flatMap((re) => [...said.matchAll(re)])) {
    const word = m[1]!.toLowerCase();
    const kind = MOODS.find(([, , re]) => re.test(word));
    if (kind) out.add(kind[0]);
  }
  return [...out];
}

/** Tally the owner's messages by day in their zone (a message that looks like a secret is skipped whole). */
export function tallyDays(turns: { role: string; text: string; at: number }[], tz: string): DayTally[] {
  const days = new Map<string, DayTally>();
  for (const t of turns) {
    if (t.role !== 'user' || looksSecret(t.text)) continue;
    const z = zoned(t.at, tz);
    const d = `${z.y}-${String(z.m).padStart(2, '0')}-${String(z.d).padStart(2, '0')}`;
    let day = days.get(d);
    if (!day) days.set(d, (day = { d, w: z.wd, n: 0, h: [0, 0, 0, 0], t: {}, m: {} }));
    day.n++;
    day.h[partOf(z.h)]++;
    const moods = moodsIn(t.text);
    for (const m of moods) day.m[m] = (day.m[m] ?? 0) + 1;
    // Nothing about the owner's health is tallied as a topic (moods leave it out too).
    for (const w of new Set(contentWords(t.text))) if (!isHealthWord(w)) day.t[w] = (day.t[w] ?? 0) + 1;
  }
  for (const day of days.values()) day.t = Object.fromEntries(Object.entries(day.t).sort((a, b) => b[1] - a[1]).slice(0, 24));
  return [...days.values()];
}

function mergeDays(into: Map<string, DayTally>, add: DayTally[]): void {
  for (const a of add) {
    const b = into.get(a.d);
    if (!b) {
      into.set(a.d, structuredClone(a));
      continue;
    }
    b.n += a.n;
    for (let i = 0; i < 4; i++) b.h[i] = b.h[i]! + a.h[i]!;
    for (const [k, v] of Object.entries(a.t)) b.t[k] = (b.t[k] ?? 0) + v;
    for (const [k, v] of Object.entries(a.m)) b.m[k] = (b.m[k] ?? 0) + v;
    b.t = Object.fromEntries(Object.entries(b.t).sort((x, y) => y[1] - x[1]).slice(0, 24));
  }
}

/** The owner's messages in the history not yet in the day log, and the times of those that are (still in the history). */
async function unfiled(storage: DurableObjectStorage, now: number): Promise<{ turns: ChatTurn[]; filed: number[] }> {
  const all = ((await storage.get<ChatTurn[]>(TURNS_KEY)) ?? []).filter((t) => t.role === 'user' && t.at <= now);
  const done = new Set((await storage.get<number[]>(FILED_KEY)) ?? []);
  return { turns: all.filter((t) => !done.has(t.at)), filed: all.filter((t) => done.has(t.at)).map((t) => t.at) };
}

/**
 * File the owner's messages not yet tallied into the day log (the nightly reflection calls this
 * first, with or without a model). The chat history keeps only the latest messages; the log
 * keeps 120 days of counts, so patterns can span weeks. Messages sent in late (after a pause,
 * with their own earlier times) are filed when they arrive; none is counted twice.
 */
export async function noteDays(storage: DurableObjectStorage, now = Date.now()): Promise<number> {
  const { turns, filed } = await unfiled(storage, now);
  if (!turns.length) return 0;
  const tz = safeTz(((await storage.get<{ tz?: string }>('owner:ctx')) ?? {}).tz);
  const days = new Map(((await storage.get<DayTally[]>(DAYS_KEY)) ?? []).map((d) => [d.d, d]));
  const fresh = tallyDays(turns, tz);
  mergeDays(days, fresh);
  await storage.put(DAYS_KEY, [...days.values()].sort((a, b) => a.d.localeCompare(b.d)).slice(-DAYS_KEEP));
  await storage.put(FILED_KEY, [...filed, ...turns.map((t) => t.at)]);
  return fresh.reduce((k, d) => k + d.n, 0);
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * What the day log and the stored memories show, phrased plainly. Each pattern needs real
 * evidence: a time of day only after a dozen messages on three days and when it is at least half
 * of them; a weekday only over two weeks or more; a topic or a mood only on three different days;
 * a theme only when three memories share it.
 */
export function findPatterns(days: DayTally[], memories: string[]): MemoryPattern[] {
  const out: MemoryPattern[] = [];
  const total = days.reduce((k, d) => k + d.n, 0);
  if (total >= 12 && days.length >= 3) {
    const parts = [0, 1, 2, 3].map((i) => days.reduce((k, d) => k + d.h[i]!, 0));
    const top = parts.indexOf(Math.max(...parts));
    const share = parts[top] === total ? `all of your last ${total} messages` : `${parts[top]} of your last ${total} messages`;
    if (parts[top]! * 2 >= total) out.push({ id: `time:${top}`, kind: 'time', text: `You mostly talk to me ${PARTS[top]} — ${share}.`, evidence: parts[top]!, unit: 'messages' });
  }
  const span = days.length ? (Date.parse(`${days.at(-1)!.d}T12:00:00Z`) - Date.parse(`${days[0]!.d}T12:00:00Z`)) / 86_400_000 : 0;
  if (span >= 14 && total >= 14) {
    const byDay = [0, 1, 2, 3, 4, 5, 6].map((w) => days.filter((d) => d.w === w));
    const counts = byDay.map((list) => list.reduce((k, d) => k + d.n, 0));
    const top = counts.indexOf(Math.max(...counts));
    const others = (total - counts[top]!) / 6;
    if (byDay[top]!.length >= 2 && counts[top]! >= 2 * others && counts[top]! >= 5) out.push({ id: `day:${top}`, kind: 'day', text: `You talk to me most on ${DAYS[top]} — ${counts[top]} of ${total} messages, over ${plural(byDay[top]!.length, DAYS[top]!.slice(0, -1), DAYS[top])}.`, evidence: counts[top]!, unit: 'messages' });
  }
  const topicDays = new Map<string, number>();
  for (const d of days) for (const w of Object.keys(d.t)) topicDays.set(w, (topicDays.get(w) ?? 0) + 1);
  const topics = [...topicDays].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4);
  for (const [w, n] of topics) out.push({ id: `topic:${w}`, kind: 'topic', text: `You keep coming back to “${w}” — on ${n} different days.`, evidence: n, unit: 'days' });
  for (const [kind, words] of MOODS) {
    const on = days.filter((d) => d.m[kind]);
    if (on.length < 3) continue;
    const wd = [0, 1, 2, 3, 4, 5, 6].map((w) => on.filter((d) => d.w === w).length);
    const top = wd.indexOf(Math.max(...wd));
    const when = wd[top]! >= 2 && wd[top]! * 2 > on.length ? `, ${wd[top]} of them ${DAYS[top]}` : '';
    out.push({ id: `mood:${kind}`, kind: 'mood', text: `You've said you were feeling ${words} on ${on.length} different days${when}.`, evidence: on.length, unit: 'days' });
  }
  const themes = new Map<string, number>();
  for (const m of memories) for (const w of new Set(contentWords(m))) if (!isHealthWord(w)) themes.set(w, (themes.get(w) ?? 0) + 1);
  const shared = [...themes].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3);
  for (const [w, n] of shared) out.push({ id: `theme:${w}`, kind: 'theme', text: `${n} of the things I remember about you mention “${w}”.`, evidence: n, unit: 'memories' });
  return out;
}

/** A dismissed topic or mood also leaves the day log: the word (or mood) is no longer kept at all. */
async function forgetTallied(storage: DurableObjectStorage, id: string): Promise<void> {
  const [kind, what] = [id.slice(0, id.indexOf(':')), id.slice(id.indexOf(':') + 1)];
  if ((kind !== 'topic' && kind !== 'mood') || !what) return;
  const days = (await storage.get<DayTally[]>(DAYS_KEY)) ?? [];
  for (const d of days) delete (kind === 'topic' ? d.t : d.m)[what];
  await storage.put(DAYS_KEY, days);
}

/** The day log gone (CLEAR CONVERSATION, forget_everything): no pattern is left from what was said. Dismissals stay. */
export async function clearPatterns(storage: DurableObjectStorage): Promise<void> {
  await storage.delete([DAYS_KEY, FILED_KEY]);
}

/** The patterns to show: the day log plus messages not yet filed, the stored memories, minus the dismissed. */
export async function patterns(deps: Pick<ProfileDeps, 'storage'>, now = Date.now()): Promise<MemoryPattern[]> {
  const { storage } = deps;
  const tz = safeTz(((await storage.get<{ tz?: string }>('owner:ctx')) ?? {}).tz);
  const days = new Map(((await storage.get<DayTally[]>(DAYS_KEY)) ?? []).map((d) => [d.d, structuredClone(d)]));
  mergeDays(days, tallyDays((await unfiled(storage, now)).turns, tz));
  const profile = await loadProfile(storage);
  const memories = [...PROFILE_SECTIONS.flatMap((s) => profile.sections[s]), ...(await loadMemory(storage)).map((f) => f.text)];
  const dismissed = new Set((await storage.get<string[]>(DISMISSED_KEY)) ?? []);
  return findPatterns([...days.values()].sort((a, b) => a.d.localeCompare(b.d)), memories).filter((p) => !dismissed.has(p.id));
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

/**
 * The Memory tab's TIMELINE and PATTERNS: GET /profile/timeline → { items, patterns },
 * POST /profile/item { id, op: edit|forget|restore|lock|unlock, text? } → { item },
 * POST /profile/patterns/dismiss { id } (the topic or mood leaves the day log too), POST
 * /profile/patterns/clear (CLEAR CONVERSATION). Null when the path is not one of these.
 */
export async function memoryRoute(req: Request, path: string, method: string, deps: ProfileDeps): Promise<Response | null> {
  if (path === '/profile/timeline' && method === 'GET') return json({ items: await timeline(deps), patterns: await patterns(deps), forgotten: await recentlyForgotten(deps.storage) });
  if (path === '/profile/item' && method === 'POST') {
    const b = (await req.json().catch(() => ({}))) as { id?: unknown; op?: unknown; text?: unknown };
    try {
      return json({ item: await changeMemory(deps, String(b.id ?? ''), String(b.op ?? ''), b.text) });
    } catch (e) {
      return json({ error: String((e as Error)?.message ?? e) }, e instanceof MemoryError ? e.status : 500);
    }
  }
  if (path === '/profile/patterns/dismiss' && method === 'POST') {
    const b = (await req.json().catch(() => ({}))) as { id?: unknown };
    const id = typeof b.id === 'string' ? b.id.slice(0, 80) : '';
    if (!id) return json({ error: 'which pattern?' }, 400);
    const list = new Set((await deps.storage.get<string[]>(DISMISSED_KEY)) ?? []);
    list.add(id);
    await deps.storage.put(DISMISSED_KEY, [...list].slice(-200));
    await forgetTallied(deps.storage, id);
    return json({ ok: true, patterns: await patterns(deps) });
  }
  if (path === '/profile/patterns/clear' && method === 'POST') {
    await clearPatterns(deps.storage);
    return json({ ok: true });
  }
  return null;
}
