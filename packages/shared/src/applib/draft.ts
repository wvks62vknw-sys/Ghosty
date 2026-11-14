/**
 * APP MAKER's drafts (PLAY & MAKE lane): "make your own app". Everything here is pure (no DOM), so the brain tests can
 * drive it (apps/edge/test/applibgames.test.mjs) and the Maker screen (apps/web/src/features/applib/maker.ts) only draws it.
 *   - blank(archetype, name): a fresh, valid app of any archetype he can make (log, checklist, counter, timer, deck, game);
 *   - addField / removeField / moveField (every FieldType), addStat / removeStat, setViews, setGlyph, rename;
 *   - duplicate(def): "duplicate and change" any Library app, under a new id of his own;
 *   - fromWords("make me an app for my vinyl"): a first draft from his words, reading them with the mini-app reader
 *     (appkit/brief.ts readApp) and, on top of it, the things people collect and keep, which it does not know;
 *   - finish(def) fills what the engine needs (sample records, a tour, keywords, a pitch) and check(def, taken) runs the
 *     engine's own validator (validate.ts) plus the id being free, so nothing he makes breaks the Library.
 * Made apps are kept on the phone (the Maker keeps them under ghosty.applib.mine) and drawn by the same engine.
 */
import { readApp } from '../appkit/brief';
import { APP_GLYPHS, GAME_KINDS, type AppDef, type AppGlyph, type Archetype, type Family, type Field, type FieldType, type GameKind, type LogConfig, type Stat } from './types';
import { isTitleCase, validateApp } from './validate';

/** The archetypes App Maker builds (a calc needs a formula with a public source and tests: those come from the Library). */
export const MAKER_ARCHETYPES: Archetype[] = ['log', 'checklist', 'counter', 'timer', 'deck', 'game'];
export const ARCHETYPE_WORDS: Record<string, { name: string; line: string }> = {
  log: { name: 'Records', line: 'Entries with fields: a collection, a journal or a tracker.' },
  checklist: { name: 'Checklist', line: 'Things to tick off, once or fresh every day or week.' },
  counter: { name: 'Counter', line: 'Tallies with a tap: scores, reps, laps or stock.' },
  timer: { name: 'Timer', line: 'Timed steps in rounds: intervals, routines or brewing.' },
  deck: { name: 'Cards', line: 'Questions and answers to learn, with spaced repetition.' },
  game: { name: 'Game', line: 'One of the twenty game kinds, set up your way.' },
};
export const FIELD_TYPES: { type: FieldType; name: string }[] = [
  { type: 'text', name: 'Text' }, { type: 'long', name: 'Long text' }, { type: 'number', name: 'Number' }, { type: 'money', name: 'Money' },
  { type: 'date', name: 'Date' }, { type: 'time', name: 'Time' }, { type: 'duration', name: 'Duration' }, { type: 'choice', name: 'Choice' },
  { type: 'multi', name: 'Several choices' }, { type: 'rating', name: 'Rating' }, { type: 'scale', name: 'Scale' }, { type: 'check', name: 'Yes or no' },
  { type: 'photo', name: 'Photo' }, { type: 'link', name: 'Link' },
];

const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);
/** Title Case, 18 characters at most, letters, digits and spaces only. */
export function titleCase(s: string): string {
  const words = s.replace(/[^A-Za-z0-9&' -]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  let out = words.map((w, i) => (i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w[0]!.toUpperCase() + w.slice(1))).join(' ');
  if (out.length > 18) out = out.slice(0, 18).replace(/\s+\S*$/, '') || out.slice(0, 18);
  return out.trim();
}
const cap1 = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const slug = (s: string, sep = '-') => s.toLowerCase().replace(/[^a-z0-9]+/g, sep).replace(new RegExp(`^\\${sep}+|\\${sep}+$`, 'g'), '');

/** A free id for a made app: "mine-<name>", with a number when taken. */
export function freeId(name: string, taken: Iterable<string>): string {
  const t = new Set(taken);
  const base = `mine-${slug(name) || 'app'}`.slice(0, 34).replace(/-+$/, '');
  if (!t.has(base)) return base;
  for (let n = 2; n < 1000; n++) if (!t.has(`${base}-${n}`)) return `${base}-${n}`;
  return `${base}-${Date.now() % 100000}`;
}

/** A field id from its label, unique among the fields. */
export function fieldId(label: string, fields: readonly Field[]): string {
  let id = slug(label, '_') || 'field';
  if (!/^[a-z]/.test(id)) id = `f_${id}`;
  id = id.slice(0, 24);
  const ids = new Set(fields.map((f) => f.id));
  if (!ids.has(id)) return id;
  for (let n = 2; ; n++) if (!ids.has(`${id}_${n}`)) return `${id}_${n}`;
}

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

// ---------------------------------------------------------------- a blank app of each archetype

const GLYPH_FOR: Record<string, AppGlyph> = { log: 'list', checklist: 'check', counter: 'plus', timer: 'timer', deck: 'cards', game: 'game' };

export function blank(archetype: Archetype, nameIn: string, taken: Iterable<string> = []): AppDef {
  const name = titleCase(nameIn) || ARCHETYPE_WORDS[archetype]?.name || 'My App';
  const base: AppDef = { id: freeId(name, taken), name, family: familyFor(archetype), glyph: GLYPH_FOR[archetype] ?? 'star', pitch: '', keywords: [], archetype, tour: ['', '', ''] };
  switch (archetype) {
    case 'log':
      base.log = { fields: [{ id: 'name', label: 'Name', type: 'text', required: true }, { id: 'date', label: 'Date', type: 'date', default: 'today' }, { id: 'notes', label: 'Notes', type: 'long' }], title: 'name', sub: 'notes', date: 'date', sort: { field: 'date', dir: 'desc' }, stats: [{ label: 'Entries', kind: 'count' }], views: ['list', 'calendar'] };
      break;
    case 'checklist':
      base.checklist = { sections: [{ name: name, items: ['First thing', 'Second thing'] }], repeat: 'never' };
      break;
    case 'counter':
      base.counter = { names: ['Count'], step: 1, reset: 'never' };
      break;
    case 'timer':
      base.timer = { steps: [{ name: 'Work', secs: 30 }, { name: 'Rest', secs: 10 }], rounds: 8 };
      break;
    case 'deck':
      base.deck = { cards: [
        { q: 'How do I add a card?', a: 'Open Edit and add a question and its answer.' },
        { q: 'What does spaced repetition do?', a: 'It shows a card again just before you would forget it.' },
        { q: 'What happens when I get one right?', a: 'It comes back later each time.' },
        { q: 'What happens when I miss one?', a: 'It comes back soon, until it sticks.' },
      ], mode: 'srs' };
      break;
    case 'game':
      base.game = { kind: 'sudoku', options: {} };
      base.glyph = 'puzzle';
      break;
    default:
      break;
  }
  return finish(base);
}

function familyFor(a: Archetype): Family {
  return a === 'game' ? 'games' : a === 'deck' ? 'learn' : a === 'timer' || a === 'counter' ? 'tools' : 'life';
}

// ---------------------------------------------------------------- changes (each returns a new AppDef)

export function rename(d: AppDef, nameIn: string): AppDef {
  const x = clone(d);
  x.name = titleCase(nameIn) || x.name;
  return finish(x, { pitch: true });
}

export function setGlyph(d: AppDef, g: AppGlyph): AppDef {
  return (APP_GLYPHS as readonly string[]).includes(g) ? { ...clone(d), glyph: g } : d;
}

const DEFAULT_OPTIONS = ['First', 'Second', 'Third'];
/** Add a field of any type; choice and multi get starting options he can change. */
export function addField(d: AppDef, labelIn: string, type: FieldType, more: Partial<Field> = {}): AppDef {
  const x = clone(d);
  const log = logOf(x);
  if (!log) return d;
  const label = cap1(labelIn.trim().replace(/\s+/g, ' ').slice(0, 24)) || FIELD_TYPES.find((t) => t.type === type)!.name;
  const f: Field = { id: fieldId(label, log.fields), label, type, ...more };
  if ((type === 'choice' || type === 'multi') && !(f.options && f.options.length >= 2)) f.options = DEFAULT_OPTIONS.slice();
  if (type !== 'choice' && type !== 'multi') delete f.options;
  if (type === 'scale') Object.assign(f, { min: f.min ?? 1, max: f.max ?? 10 });
  if (type === 'date' && f.default === undefined) f.default = 'today';
  if (type === 'money') delete f.unit;
  log.fields.push(f);
  if (log.fields.length > 24) return d;
  return finish(x, { sample: true });
}

export function removeField(d: AppDef, id: string): AppDef {
  const x = clone(d);
  const log = logOf(x);
  if (!log || log.fields.length <= 1) return d;
  log.fields = log.fields.filter((f) => f.id !== id);
  const first = log.fields[0]!.id;
  const used = (t?: string) => !!t && (t === id || t.includes(`{${id}}`));
  if (used(log.title)) log.title = first;
  if (used(log.sub)) delete log.sub;
  if (used(log.meta)) delete log.meta;
  if (log.date === id) {
    const other = log.fields.find((f) => f.type === 'date');
    if (other) log.date = other.id;
    else delete log.date;
  }
  if (log.sort?.field === id) delete log.sort;
  if (log.group === id) delete log.group;
  if (log.chart?.field === id) delete log.chart;
  if (log.remind?.field === id) delete log.remind;
  log.stats = (log.stats ?? []).filter((s) => s.field !== id && ((s.kind !== 'streak' && (!s.period || s.period === 'all')) || log.date));
  if (log.views) {
    const can = possibleViews(log);
    log.views = log.views.filter((v) => can.includes(v) && (v !== 'board' || log.group));
    if (!log.views.length) log.views = ['list'];
  }
  return finish(x, { sample: true });
}

export function moveField(d: AppDef, id: string, by: number): AppDef {
  const x = clone(d);
  const log = logOf(x);
  if (!log) return d;
  const i = log.fields.findIndex((f) => f.id === id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= log.fields.length) return d;
  [log.fields[i], log.fields[j]] = [log.fields[j]!, log.fields[i]!];
  return x;
}

/** Change one field (label, options, unit, required). */
export function changeField(d: AppDef, id: string, patch: Partial<Field>): AppDef {
  const x = clone(d);
  const f = logOf(x)?.fields.find((y) => y.id === id);
  if (!f) return d;
  Object.assign(f, { ...patch, id: f.id });
  if (patch.label) f.label = cap1(patch.label.trim().slice(0, 24));
  if (patch.type) {
    if (f.type === 'choice' || f.type === 'multi') f.options = f.options && f.options.length >= 2 ? f.options : DEFAULT_OPTIONS.slice();
    else delete f.options;
    if (f.type === 'money') delete f.unit;
    if (f.type === 'scale') Object.assign(f, { min: f.min ?? 1, max: f.max ?? 10 });
    if (f.type !== 'date' && f.default === 'today') delete f.default;
    // what read the field as its old type and cannot read it now goes
    const log = logOf(x)!;
    const numeric = ['number', 'money', 'duration', 'rating', 'scale'].includes(f.type);
    log.stats = (log.stats ?? []).filter((s) => s.field !== f.id || numeric || s.kind === 'count' || s.kind === 'distinct' || s.kind === 'last');
    if (log.chart?.field === f.id && !numeric) delete log.chart;
    if (log.group === f.id && f.type !== 'choice') delete log.group;
    if (log.date === f.id && f.type !== 'date') delete log.date;
    if (log.remind?.field === f.id && f.type !== 'date') delete log.remind;
    if (log.views) {
      const can = possibleViews(log);
      log.views = log.views.filter((v) => can.includes(v) && (v !== 'board' || log.group) && (v !== 'calendar' || log.date));
      if (!log.views.length) log.views = ['list'];
    }
    if (!log.date) log.stats = log.stats.filter((s) => s.kind !== 'streak' && (!s.period || s.period === 'all'));
  }
  return finish(x, { sample: true });
}

export function addStat(d: AppDef, s: Stat): AppDef {
  const x = clone(d);
  const log = logOf(x);
  if (!log) return d;
  log.stats = [...(log.stats ?? []), s].slice(0, 6);
  return x;
}
export function removeStat(d: AppDef, i: number): AppDef {
  const x = clone(d);
  const log = logOf(x);
  if (!log?.stats) return d;
  log.stats.splice(i, 1);
  return x;
}

/** Which views to offer (the first is the default); only those its fields allow are kept. */
export function setViews(d: AppDef, views: NonNullable<LogConfig['views']>): AppDef {
  const x = clone(d);
  const log = logOf(x);
  if (!log) return d;
  const can = possibleViews(log);
  const v = views.filter((y) => can.includes(y));
  log.views = v.length ? v : ['list'];
  if (log.views.includes('board') && !log.group) log.group = log.fields.find((f) => f.type === 'choice')!.id;
  if (log.views.includes('calendar') && !log.date) log.date = log.fields.find((f) => f.type === 'date')!.id;
  return x;
}
/** The views a log's fields allow: board needs a choice, calendar a date, gallery a photo. */
export function possibleViews(log: LogConfig): NonNullable<LogConfig['views']> {
  const out: NonNullable<LogConfig['views']> = ['list'];
  if (log.fields.some((f) => f.type === 'choice')) out.push('board');
  if (log.fields.some((f) => f.type === 'date')) out.push('calendar');
  if (log.fields.some((f) => f.type === 'photo')) out.push('gallery');
  return out;
}

export function setGame(d: AppDef, kind: GameKind, options: Record<string, number | string | boolean | string[]> = {}): AppDef {
  if (d.archetype !== 'game' || !GAME_KINDS.includes(kind)) return d;
  return { ...clone(d), game: { kind, options } };
}

const logOf = (d: AppDef): LogConfig | undefined => (d.archetype === 'log' ? d.log : undefined);

// ---------------------------------------------------------------- duplicate and change

/** A copy of any Library app as his own: a new id, "My …" as its name (he can rename it), the same insides. */
export function duplicate(d: AppDef, taken: Iterable<string> = []): AppDef {
  const x = clone(d);
  delete x.from;
  const name = titleCase(`My ${d.name}`).length <= 18 ? titleCase(`My ${d.name}`) : d.name;
  x.name = name;
  x.id = freeId(d.name, [...taken, d.id]);
  return x;
}

// ---------------------------------------------------------------- finishing: what the engine needs

/** Fill what the engine needs and he has not said: a pitch, keywords, a tour and (for a log) sample records. */
export function finish(dIn: AppDef, o: { pitch?: boolean; sample?: boolean } = {}): AppDef {
  const d = dIn;
  const noun = d.name.toLowerCase();
  if (!d.pitch || o.pitch) d.pitch = pitchFor(d);
  if (!d.keywords?.length || o.pitch) d.keywords = keywordsFor(d);
  if (!d.tour || d.tour.some((t) => !t) || o.pitch) d.tour = tourFor(d, noun);
  if (d.archetype === 'log' && d.log && (o.sample || !d.sample || d.sample.length < 2)) d.sample = sampleFor(d.log);
  if (d.archetype !== 'log' && d.archetype !== 'importer') delete d.sample;
  return d;
}

function pitchFor(d: AppDef): string {
  const n = d.name.toLowerCase().replace(/^my /, '');
  const by: Record<string, string> = {
    log: `Keeps your ${n} in one place, with the details you care about.`,
    checklist: `Your ${n} list to tick off, kept on this phone.`,
    counter: `Counts your ${n} with a tap, and keeps the totals.`,
    timer: `Times your ${n} step by step, round after round.`,
    deck: `Learn your ${n} cards, each one shown just before you forget.`,
    game: /\bgame\b/.test(n) ? `Your own ${n}, set up just the way you like it.` : `Your own ${n} game, set up just the way you like it.`,
  };
  let p = by[d.archetype] ?? `Your own ${n} app, made by you and kept on this phone.`;
  if (p.length > 90) p = by[d.archetype]!.replace(` ${n}`, '') ?? p;
  if (p.length > 90) p = 'Your own app, made by you and kept on this phone.';
  if (p.length < 30) p = `${p.slice(0, -1)}, kept on this phone.`;
  return p;
}

function keywordsFor(d: AppDef): string[] {
  const words = d.name.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !SMALL.has(w) && w !== 'my');
  const extra = { log: 'records', checklist: 'checklist', counter: 'counter', timer: 'timer', deck: 'cards', game: 'game' }[d.archetype as string] ?? 'app';
  const out = [...new Set([...words, extra, 'mine'])].slice(0, 8);
  return out.length >= 2 ? out : [...out, 'own'];
}

function tourFor(d: AppDef, noun: string): [string, string, string] {
  const short = (s: string) => (s.length > 70 ? s.slice(0, 69).replace(/\s+\S*$/, '') + '.' : s);
  const by: Record<string, [string, string, string]> = {
    log: ['These two records show how it looks with your fields.', 'Add one with the key below; tap a record to change it.', 'Search, stats and export are all built in.'],
    checklist: ['Tap a line to tick it off.', 'Edit the list from Settings whenever you like.', 'Undo puts back anything ticked by mistake.'],
    counter: ['Tap a name to count one more.', 'Undo takes back a tap made by mistake.', 'The totals are kept on this phone.'],
    timer: ['Start runs each step in turn, round after round.', 'It keeps going if the phone locks or reloads.', 'Change the steps from Settings.'],
    deck: ['Read the question, then turn the card.', 'Say whether you knew it: misses come back sooner.', 'Add your own cards from Edit.'],
    game: ['Your game, set up the way you chose.', 'Pause keeps the game, even across a reload.', 'Your best score and streak stay on this phone.'],
  };
  void noun;
  return (by[d.archetype] ?? ['Your own app.', 'It is kept on this phone.', 'Settings has export.']).map(short) as [string, string, string];
}

/** Two sample records from the fields, so the first run is never an empty screen. */
export function sampleFor(log: LogConfig): AppDef['sample'] {
  const day = (n: number) => {
    const t = new Date(Date.UTC(2026, 9, 1 + n));
    return t.toISOString().slice(0, 10);
  };
  return [0, 1].map((k) => {
    const r: Record<string, string | number | boolean | string[]> = {};
    const titleField = log.fields.find((f) => f.id === log.title || log.title.includes(`{${f.id}}`)) ?? log.fields[0];
    for (const f of log.fields) {
      switch (f.type) {
        case 'text':
          if (f === titleField || f.required) r[f.id] = k ? `Another ${f.label.toLowerCase()}` : `First ${f.label.toLowerCase()}`;
          break;
        case 'long':
          if (f.required) r[f.id] = k ? 'A second entry, to show the list.' : 'An example entry, to show the layout.';
          break;
        case 'number': r[f.id] = clampN(f, k ? 12 : 5); break;
        case 'money': r[f.id] = k ? 18.5 : 9.99; break;
        case 'duration': r[f.id] = k ? 45 : 20; break;
        case 'rating': r[f.id] = k ? 4 : 5; break;
        case 'scale': r[f.id] = clampN(f, k ? 6 : 8); break;
        case 'date': r[f.id] = day(k ? 3 : 0); break;
        case 'time': r[f.id] = k ? '18:30' : '08:15'; break;
        case 'choice': r[f.id] = f.options![k % f.options!.length]!; break;
        case 'multi': r[f.id] = [f.options![k % f.options!.length]!]; break;
        case 'check': r[f.id] = k === 0; break;
        default: break; // photo and link stay empty in a sample
      }
    }
    return r;
  });
}
const clampN = (f: Field, v: number) => Math.min(f.max ?? Infinity, Math.max(f.min ?? -Infinity, v));

// ---------------------------------------------------------------- checks

/** The engine's own checks, plus the id being free of every other app (the Library's and his). */
export function check(d: AppDef, taken: Iterable<string> = []): string[] {
  const out = validateApp(d);
  if (new Set(taken).has(d.id)) out.push(`the id “${d.id}” is already used`);
  if (d.name && !isTitleCase(d.name)) out.push('the name must be in Title Case');
  return out;
}

// ---------------------------------------------------------------- a first draft from his words

interface Collection {
  re: RegExp;
  name: string;
  glyph: AppGlyph;
  family: Family;
  fields: Field[];
  title: string;
  sub?: string;
  meta?: string;
  date?: string;
  group?: string;
  stats: Stat[];
  views: NonNullable<LogConfig['views']>;
  sample: Record<string, string | number | boolean | string[]>[];
  keywords: string[];
  pitch: string;
}

const PHOTO: Field = { id: 'photo', label: 'Photo', type: 'photo' };
const NOTES: Field = { id: 'notes', label: 'Notes', type: 'long' };
/** The things people collect and keep, each with the fields a category leader has (the reader in brief.ts tracks numbers). */
export const COLLECTIONS: Collection[] = [
  {
    re: /\bvinyl\b|\brecords?\b|\blps?\b|\balbums?\b|\brecord collection\b/, name: 'Vinyl', glyph: 'music', family: 'create',
    fields: [{ id: 'album', label: 'Album', type: 'text', required: true }, { id: 'artist', label: 'Artist', type: 'text', required: true }, { id: 'year', label: 'Year', type: 'number', min: 1900, max: 2100 }, { id: 'genre', label: 'Genre', type: 'choice', options: ['Rock', 'Jazz', 'Soul', 'Electronic', 'Hip hop', 'Classical', 'Folk', 'Pop', 'Other'] }, { id: 'format', label: 'Format', type: 'choice', options: ['LP', '7 inch', '12 inch', 'Box set'] }, { id: 'condition', label: 'Condition', type: 'choice', options: ['Mint', 'Near mint', 'Very good', 'Good', 'Fair'] }, { id: 'paid', label: 'Paid', type: 'money' }, { id: 'rating', label: 'Rating', type: 'rating' }, { id: 'added', label: 'Added', type: 'date', default: 'today' }, PHOTO, NOTES],
    title: 'album', sub: '{artist} ({year})', meta: 'condition', date: 'added', group: 'genre', stats: [{ label: 'Records', kind: 'count' }, { label: 'Spent', kind: 'sum', field: 'paid' }, { label: 'Artists', kind: 'distinct', field: 'artist' }], views: ['gallery', 'list', 'board'],
    sample: [{ album: 'Night Harbour', artist: 'The Low Tides', year: 1978, genre: 'Soul', format: 'LP', condition: 'Very good', paid: 18, rating: 5, added: '2026-09-12' }, { album: 'Blue Hours', artist: 'Mara Quill Trio', year: 1962, genre: 'Jazz', format: 'LP', condition: 'Good', paid: 24, rating: 4, added: '2026-10-03' }, { album: 'Signal Fires', artist: 'Northlight', year: 2019, genre: 'Electronic', format: '12 inch', condition: 'Mint', paid: 22, rating: 4, added: '2026-10-20' }],
    keywords: ['vinyl', 'records', 'albums', 'collection', 'music'], pitch: 'Every record you own, with its pressing, condition and what you paid.',
  },
  {
    re: /\bbooks?\b|\breading list\b|\bnovels?\b|\blibrary\b/, name: 'Bookshelf', glyph: 'book', family: 'learn',
    fields: [{ id: 'title', label: 'Title', type: 'text', required: true }, { id: 'author', label: 'Author', type: 'text' }, { id: 'status', label: 'Status', type: 'choice', options: ['Want to read', 'Reading', 'Finished', 'Stopped'] }, { id: 'pages', label: 'Pages', type: 'number', unit: 'pages', min: 1 }, { id: 'rating', label: 'Rating', type: 'rating' }, { id: 'finished', label: 'Finished', type: 'date' }, PHOTO, NOTES],
    title: 'title', sub: 'author', meta: 'status', date: 'finished', group: 'status', stats: [{ label: 'Books', kind: 'count' }, { label: 'Read this year', kind: 'count', period: 'year' }, { label: 'Pages', kind: 'sum', field: 'pages' }], views: ['board', 'list', 'gallery'],
    sample: [{ title: 'The Salt Road', author: 'Ines Carrow', status: 'Finished', pages: 342, rating: 4, finished: '2026-09-28' }, { title: 'A Small Field Guide to Clouds', author: 'Tom Ashby', status: 'Reading', pages: 210 }, { title: 'Winter Orchard', author: 'Hana Ode', status: 'Want to read', pages: 288 }],
    keywords: ['books', 'reading', 'shelf', 'novels'], pitch: 'The books you have read, are reading and want to read next.',
  },
  {
    re: /\bfilms?\b|\bmovies?\b|\bcinema\b|\bwatchlist\b/, name: 'Films', glyph: 'film', family: 'create',
    fields: [{ id: 'title', label: 'Title', type: 'text', required: true }, { id: 'year', label: 'Year', type: 'number', min: 1880, max: 2100 }, { id: 'status', label: 'Status', type: 'choice', options: ['To watch', 'Watched'] }, { id: 'where', label: 'Where', type: 'choice', options: ['Cinema', 'At home', 'Elsewhere'] }, { id: 'rating', label: 'Rating', type: 'rating' }, { id: 'watched', label: 'Watched', type: 'date' }, NOTES],
    title: 'title', sub: '{year}', meta: 'status', date: 'watched', group: 'status', stats: [{ label: 'Watched', kind: 'count' }, { label: 'This year', kind: 'count', period: 'year' }, { label: 'Average rating', kind: 'avg', field: 'rating' }], views: ['list', 'board', 'calendar'],
    sample: [{ title: 'The Lighthouse Keeper', year: 1994, status: 'Watched', where: 'At home', rating: 4, watched: '2026-10-11' }, { title: 'Paper Moons', year: 2025, status: 'Watched', where: 'Cinema', rating: 5, watched: '2026-10-25' }, { title: 'North by the Sea', year: 1958, status: 'To watch' }],
    keywords: ['films', 'movies', 'watchlist', 'cinema'], pitch: 'Films you have seen and want to see, with your own ratings.',
  },
  {
    re: /\bwines?\b|\bcellar\b|\bbottles?\b/, name: 'Wine Cellar', glyph: 'bottle', family: 'body',
    fields: [{ id: 'wine', label: 'Wine', type: 'text', required: true }, { id: 'producer', label: 'Producer', type: 'text' }, { id: 'vintage', label: 'Vintage', type: 'number', min: 1900, max: 2100 }, { id: 'colour', label: 'Colour', type: 'choice', options: ['Red', 'White', 'Rosé', 'Sparkling', 'Sweet'] }, { id: 'region', label: 'Region', type: 'text' }, { id: 'grape', label: 'Grape', type: 'text' }, { id: 'bottles', label: 'Bottles', type: 'number', min: 0 }, { id: 'price', label: 'Price', type: 'money' }, { id: 'rating', label: 'Rating', type: 'rating' }, { id: 'drinkby', label: 'Drink by', type: 'date' }, PHOTO, NOTES],
    title: 'wine', sub: '{producer} {vintage}', meta: 'bottles', date: 'drinkby', group: 'colour', stats: [{ label: 'Bottles', kind: 'sum', field: 'bottles' }, { label: 'Wines', kind: 'count' }, { label: 'Ready this year', kind: 'count', period: 'year' }], views: ['list', 'board', 'gallery'],
    sample: [{ wine: 'Hillside Reserve', producer: 'Domaine Lune', vintage: 2018, colour: 'Red', region: 'Rhône', grape: 'Syrah', bottles: 3, price: 21, rating: 4, drinkby: '2027-06-01' }, { wine: 'Coast Blanc', producer: 'Casa Brisa', vintage: 2023, colour: 'White', region: 'Galicia', grape: 'Albariño', bottles: 2, price: 14, drinkby: '2026-12-31' }],
    keywords: ['wine', 'cellar', 'bottles', 'vintage'], pitch: 'Every bottle in your cellar, with its vintage, region and drink-by date.',
  },
  {
    re: /\bplants?\b|\bhouseplants?\b|\bgarden\b|\bwatering\b/, name: 'Plants', glyph: 'leaf', family: 'life',
    fields: [{ id: 'plant', label: 'Plant', type: 'text', required: true }, { id: 'room', label: 'Room', type: 'choice', options: ['Living room', 'Kitchen', 'Bedroom', 'Bathroom', 'Garden'] }, { id: 'light', label: 'Light', type: 'choice', options: ['Bright', 'Indirect', 'Shade'] }, { id: 'every', label: 'Water every', type: 'number', unit: 'days', min: 1, max: 60 }, { id: 'watered', label: 'Last watered', type: 'date', default: 'today' }, PHOTO, NOTES],
    title: 'plant', sub: 'room', meta: '{every} days', date: 'watered', group: 'room', stats: [{ label: 'Plants', kind: 'count' }, { label: 'Watered this week', kind: 'count', period: 'week' }], views: ['gallery', 'list', 'board'],
    sample: [{ plant: 'Fiddle-leaf fig', room: 'Living room', light: 'Bright', every: 7, watered: '2026-11-10' }, { plant: 'Snake plant', room: 'Bedroom', light: 'Shade', every: 14, watered: '2026-11-02' }, { plant: 'Basil', room: 'Kitchen', light: 'Bright', every: 2, watered: '2026-11-13' }],
    keywords: ['plants', 'houseplants', 'watering', 'garden'], pitch: 'Your plants, where they live and when each one was last watered.',
  },
  {
    re: /\bboard ?games?\b|\btabletop\b/, name: 'Board Games', glyph: 'die', family: 'games',
    fields: [{ id: 'game', label: 'Game', type: 'text', required: true }, { id: 'players', label: 'Players', type: 'text', hint: 'e.g. 2 to 4' }, { id: 'length', label: 'Length', type: 'duration' }, { id: 'kind', label: 'Kind', type: 'choice', options: ['Strategy', 'Party', 'Family', 'Co-op', 'Cards', 'Word'] }, { id: 'rating', label: 'Rating', type: 'rating' }, { id: 'played', label: 'Last played', type: 'date' }, PHOTO, NOTES],
    title: 'game', sub: '{players} players', meta: 'kind', date: 'played', group: 'kind', stats: [{ label: 'Games', kind: 'count' }, { label: 'Played this month', kind: 'count', period: 'month' }], views: ['gallery', 'list', 'board'],
    sample: [{ game: 'Harbour Lights', players: '2 to 4', length: 60, kind: 'Strategy', rating: 5, played: '2026-11-01' }, { game: 'Word Relay', players: '3 to 8', length: 20, kind: 'Party', rating: 4, played: '2026-10-18' }],
    keywords: ['board games', 'tabletop', 'games night'], pitch: 'Your shelf of board games, who they suit and when you last played.',
  },
  {
    re: /\brecipes?\b|\bcook(?:ing|book)?\b|\bmeals?\b|\bdishes\b/, name: 'Recipes', glyph: 'bowl', family: 'body',
    fields: [{ id: 'dish', label: 'Dish', type: 'text', required: true }, { id: 'course', label: 'Course', type: 'choice', options: ['Breakfast', 'Lunch', 'Dinner', 'Pudding', 'Baking', 'Snack'] }, { id: 'serves', label: 'Serves', type: 'number', min: 1, max: 20 }, { id: 'time', label: 'Time', type: 'duration' }, { id: 'ingredients', label: 'Ingredients', type: 'long' }, { id: 'method', label: 'Method', type: 'long' }, { id: 'rating', label: 'Rating', type: 'rating' }, { id: 'link', label: 'Link', type: 'link' }, PHOTO],
    title: 'dish', sub: 'course', meta: '{time} min', group: 'course', stats: [{ label: 'Recipes', kind: 'count' }, { label: 'Average time', kind: 'avg', field: 'time' }], views: ['gallery', 'list', 'board'],
    sample: [{ dish: 'Lemon and herb roast chicken', course: 'Dinner', serves: 4, time: 90, ingredients: 'Chicken, lemon, thyme, garlic, butter', method: 'Rub with butter and herbs, roast at 190 °C for 80 minutes.', rating: 5 }, { dish: 'Overnight oats', course: 'Breakfast', serves: 1, time: 5, ingredients: 'Oats, milk, yoghurt, berries', method: 'Stir together and leave in the fridge overnight.', rating: 4 }],
    keywords: ['recipes', 'cooking', 'meals', 'dishes'], pitch: 'Your own recipes with ingredients, method and how long each takes.',
  },
  {
    re: /\bgigs?\b|\bconcerts?\b|\blive music\b|\bfestivals?\b/, name: 'Gigs', glyph: 'mic', family: 'create',
    fields: [{ id: 'act', label: 'Act', type: 'text', required: true }, { id: 'venue', label: 'Venue', type: 'text' }, { id: 'city', label: 'City', type: 'text' }, { id: 'date', label: 'Date', type: 'date', default: 'today' }, { id: 'with', label: 'Went with', type: 'text' }, { id: 'ticket', label: 'Ticket', type: 'money' }, { id: 'rating', label: 'Rating', type: 'rating' }, PHOTO, NOTES],
    title: 'act', sub: '{venue}, {city}', date: 'date', stats: [{ label: 'Gigs', kind: 'count' }, { label: 'This year', kind: 'count', period: 'year' }, { label: 'Spent', kind: 'sum', field: 'ticket' }], views: ['list', 'calendar', 'gallery'],
    sample: [{ act: 'The Low Tides', venue: 'The Corn Exchange', city: 'Leeds', date: '2026-09-20', ticket: 28, rating: 5 }, { act: 'Mara Quill Trio', venue: 'Town Hall', city: 'Birmingham', date: '2026-10-31', ticket: 22, rating: 4 }],
    keywords: ['gigs', 'concerts', 'live music', 'festivals'], pitch: 'Every gig you have been to, where, with whom and how good it was.',
  },
  {
    re: /\bwhisk(?:e)?y\b|\bspirits?\b|\bgin\b|\brum\b/, name: 'Spirits', glyph: 'bottle', family: 'body',
    fields: [{ id: 'name', label: 'Name', type: 'text', required: true }, { id: 'kind', label: 'Kind', type: 'choice', options: ['Whisky', 'Gin', 'Rum', 'Brandy', 'Other'] }, { id: 'distillery', label: 'Distillery', type: 'text' }, { id: 'age', label: 'Age', type: 'number', unit: 'years', min: 0 }, { id: 'abv', label: 'Strength', type: 'number', unit: '%', min: 0, max: 100 }, { id: 'nose', label: 'Nose', type: 'text' }, { id: 'rating', label: 'Rating', type: 'rating' }, { id: 'tasted', label: 'Tasted', type: 'date' }, PHOTO, NOTES],
    title: 'name', sub: '{distillery}, {age} years', meta: 'kind', date: 'tasted', group: 'kind', stats: [{ label: 'Bottles', kind: 'count' }, { label: 'Average rating', kind: 'avg', field: 'rating' }], views: ['list', 'board', 'gallery'],
    sample: [{ name: 'Glen Hollow 12', kind: 'Whisky', distillery: 'Glen Hollow', age: 12, abv: 43, nose: 'Honey and pear', rating: 4, tasted: '2026-10-02' }, { name: 'Coastline Dry', kind: 'Gin', distillery: 'Saltmarsh', age: 0, abv: 41.5, nose: 'Juniper and citrus', rating: 4, tasted: '2026-10-16' }],
    keywords: ['whisky', 'spirits', 'tasting', 'gin'], pitch: 'Spirits you have tried, with tasting notes, strength and ratings.',
  },
  {
    re: /\btrainers\b|\bsneakers?\b|\bshoes\b/, name: 'Trainers', glyph: 'shirt', family: 'life',
    fields: [{ id: 'model', label: 'Model', type: 'text', required: true }, { id: 'maker', label: 'Maker', type: 'text' }, { id: 'size', label: 'Size', type: 'number', min: 1, max: 16, step: 0.5 }, { id: 'colour', label: 'Colour', type: 'text' }, { id: 'paid', label: 'Paid', type: 'money' }, { id: 'condition', label: 'Condition', type: 'choice', options: ['New', 'Worn', 'Well worn'] }, { id: 'bought', label: 'Bought', type: 'date' }, PHOTO],
    title: 'model', sub: '{maker}, size {size}', meta: 'condition', date: 'bought', group: 'condition', stats: [{ label: 'Pairs', kind: 'count' }, { label: 'Spent', kind: 'sum', field: 'paid' }], views: ['gallery', 'list', 'board'],
    sample: [{ model: 'Court Low', maker: 'Field Works', size: 9, colour: 'White', paid: 85, condition: 'Worn', bought: '2026-04-12' }, { model: 'Trail Runner 2', maker: 'Ridge', size: 9, colour: 'Grey', paid: 110, condition: 'New', bought: '2026-10-05' }],
    keywords: ['trainers', 'shoes', 'collection'], pitch: 'Your trainers, with size, what you paid and how worn each pair is.',
  },
  {
    re: /\bcomics?\b|\bgraphic novels?\b|\bmanga\b/, name: 'Comics', glyph: 'book', family: 'create',
    fields: [{ id: 'series', label: 'Series', type: 'text', required: true }, { id: 'issue', label: 'Issue', type: 'number', min: 0 }, { id: 'publisher', label: 'Publisher', type: 'text' }, { id: 'condition', label: 'Condition', type: 'choice', options: ['Mint', 'Near mint', 'Fine', 'Good', 'Poor'] }, { id: 'paid', label: 'Paid', type: 'money' }, { id: 'read', label: 'Read', type: 'check' }, PHOTO, NOTES],
    title: '{series} #{issue}', sub: 'publisher', meta: 'condition', group: 'condition', stats: [{ label: 'Issues', kind: 'count' }, { label: 'Series', kind: 'distinct', field: 'series' }, { label: 'Spent', kind: 'sum', field: 'paid' }], views: ['gallery', 'list', 'board'],
    sample: [{ series: 'Starfall', issue: 1, publisher: 'Beacon Press', condition: 'Near mint', paid: 6, read: true }, { series: 'Starfall', issue: 2, publisher: 'Beacon Press', condition: 'Fine', paid: 5, read: false }],
    keywords: ['comics', 'graphic novels', 'issues', 'collection'], pitch: 'Every comic you own, series by series, with its condition.',
  },
  {
    re: /\bcoins?\b|\bstamps?\b|\bcollectables?\b|\bcollectibles?\b/, name: 'Collection', glyph: 'coins', family: 'life',
    fields: [{ id: 'item', label: 'Item', type: 'text', required: true }, { id: 'country', label: 'Country', type: 'text' }, { id: 'year', label: 'Year', type: 'number' }, { id: 'condition', label: 'Condition', type: 'choice', options: ['Mint', 'Fine', 'Good', 'Worn'] }, { id: 'value', label: 'Value', type: 'money' }, { id: 'added', label: 'Added', type: 'date', default: 'today' }, PHOTO, NOTES],
    title: 'item', sub: '{country} {year}', meta: 'condition', date: 'added', group: 'condition', stats: [{ label: 'Items', kind: 'count' }, { label: 'Value', kind: 'sum', field: 'value' }, { label: 'Countries', kind: 'distinct', field: 'country' }], views: ['gallery', 'list', 'board'],
    sample: [{ item: 'Twopence piece', country: 'United Kingdom', year: 1971, condition: 'Fine', value: 1.5, added: '2026-08-14' }, { item: 'Ten franc coin', country: 'France', year: 1986, condition: 'Good', value: 2, added: '2026-09-30' }],
    keywords: ['collection', 'coins', 'stamps', 'collectables'], pitch: 'Every piece in your collection, with its year, condition and value.',
  },
];

export interface MadeDraft {
  def: AppDef;
  /** What was assumed, in plain words, shown with the draft for his OK. */
  assumed: string[];
  /** Set when his words ask for something App Maker cannot honestly make. */
  cannot?: string;
}

const GAME_WORDS: [GameKind, RegExp][] = [
  ['sudoku', /\bsudoku\b|\bnumber place\b/], ['mines', /\bmines?\b|\bminesweep\w*/], ['merge', /\bmerge\b|\b2048\b/], ['solitaire', /\bsolitaire\b|\bpatience\b|\bcard game\b/],
  ['wordguess', /\bguess (?:the|a) word\b|\bword guess\w*|\bfive.letter\b/], ['nonogram', /\bnonograms?\b|\bpicross\b|\bpicture puzzles?\b/], ['pairs', /\bpairs\b|\bmemory\b|\bmatching\b/],
  ['blocks', /\bblocks?\b|\bfalling\b/], ['snake', /\bsnake\b/], ['slide', /\bslid(?:e|ing)\b|\b15 puzzle\b/], ['lights', /\blights? (?:out|off)\b/], ['simon', /\bsequence\b|\brepeat after\b/],
  ['reaction', /\breaction\b|\breflex\w*/], ['hangman', /\bhangman\b|\bguess the letters\b/], ['anagram', /\banagrams?\b|\bunscramble\b/], ['typing', /\btyping\b|\btype faster\b/],
  ['sprint', /\bmental (?:maths|arithmetic)\b|\bsums\b|\btimes tables race\b/], ['dots', /\bdots\b|\bboxes\b/], ['quiz', /\bquiz\b|\btrivia\b/], ['wordgrid', /\bword ?search\b|\bword grid\b|\bhidden words\b/],
];

/** A first draft from his words ("make me an app for my vinyl"), with what was assumed, for his OK. */
export function fromWords(text: string, taken: Iterable<string> = []): MadeDraft {
  const t = text.toLowerCase().replace(/[’']/g, "'");
  const takenList = [...taken];
  const assumed: string[] = [];
  // a game, named by its genre
  const g = GAME_WORDS.find(([, re]) => re.test(t));
  if (g && /\bgames?\b|\bpuzzles?\b|\bplay\b/.test(t)) {
    const name = titleCase(cap1(g[0] === 'wordguess' ? 'Word Guess' : g[0] === 'wordgrid' ? 'Word Search' : g[0]));
    const d = setGame(blank('game', name, takenList), g[0]);
    d.glyph = 'puzzle';
    assumed.push(`a ${name.toLowerCase()} game with its usual settings`);
    return { def: finish(d, { pitch: true }), assumed };
  }
  // something people collect and keep
  const c = COLLECTIONS.find((x) => x.re.test(t));
  if (c && !/\bchecklist\b|\btimer\b|\bcounter\b|\bflash ?cards?\b/.test(t)) {
    const log: LogConfig = { fields: clone(c.fields), title: c.title, sub: c.sub, meta: c.meta, date: c.date, group: c.group, stats: clone(c.stats), views: c.views.slice() };
    if (c.date) log.sort = { field: c.date, dir: 'desc' };
    for (const k of Object.keys(log) as (keyof LogConfig)[]) if (log[k] === undefined) delete log[k];
    const name = titleCase(`My ${c.name}`).length <= 18 ? titleCase(`My ${c.name}`) : c.name;
    const d: AppDef = { id: freeId(c.name, takenList), name, family: c.family, glyph: c.glyph, pitch: c.pitch, keywords: c.keywords.slice(), archetype: 'log', tour: ['', '', ''], log, sample: clone(c.sample) };
    assumed.push(`${c.fields.length} fields a collector keeps (${c.fields.slice(0, 4).map((f) => f.label.toLowerCase()).join(', ')} and more)`);
    assumed.push(`${log.views!.join(', ')} views`);
    return { def: finish(d), assumed };
  }
  // the mini-app reader knows trackers, lists, timers, counters, habits, notes and cards
  const b = readApp(text);
  if (b.refuse) return { def: blank('log', 'My Records', takenList), assumed, cannot: b.refuse };
  const named = b.title ? titleCase(b.title) : '';
  switch (b.shape) {
    case 'tracker': {
      const unit = b.money ? undefined : b.unit;
      const name = named || 'My Tracker';
      const d = blank('log', name, takenList);
      const amount: Field = b.money ? { id: 'amount', label: 'Amount', type: 'money', required: true } : { id: 'amount', label: 'Amount', type: 'number', unit, min: 0, required: true };
      d.log = {
        fields: [{ id: 'date', label: 'Date', type: 'date', default: 'today', required: true }, amount, { id: 'note', label: 'Note', type: 'text' }],
        title: '{amount}' + (unit ? ` ${unit}` : ''), sub: 'note', date: 'date', sort: { field: 'date', dir: 'desc' },
        stats: [{ label: b.period === 'week' ? 'This week' : 'Today', kind: b.mode === 'last' ? 'last' : 'sum', field: 'amount', period: b.period ?? 'day', ...(b.goal != null ? { goal: b.goal, dir: b.dir ?? 'reach' } : {}) }, { label: 'Streak', kind: 'streak' }],
        chart: { field: 'amount', kind: 'bar', period: 'week' }, views: ['list', 'calendar'],
      };
      if (b.title === 'Mood') {
        d.log.fields[1] = { id: 'amount', label: 'Mood', type: 'scale', min: 1, max: 5, required: true };
        d.log.title = 'Mood {amount} of 5';
      }
      if (b.goal != null) assumed.push(`a ${b.period === 'week' ? 'weekly' : 'daily'} ${b.dir === 'limit' ? 'limit' : 'goal'} of ${b.money ? '£' : ''}${b.goal}${unit ? ` ${unit}` : ''}`);
      assumed.push('a date, the amount and a note for each entry');
      return { def: finish(d, { sample: true, pitch: true }), assumed };
    }
    case 'list':
    case 'habits': {
      const d = blank('checklist', named || (b.shape === 'habits' ? 'Habits' : 'My List'), takenList);
      const items = b.items.length ? b.items.map((x) => cap1(x).slice(0, 60)) : b.shape === 'habits' ? ['Walk', 'Read', 'Drink water'] : ['First thing', 'Second thing'];
      d.checklist = { sections: [{ name: d.name, items }], repeat: b.shape === 'habits' ? 'daily' : 'never' };
      if (!b.items.length) assumed.push('a few starting lines to change');
      if (b.shape === 'habits') assumed.push('a fresh start every day');
      return { def: finish(d, { pitch: true }), assumed };
    }
    case 'timer': {
      const d = blank('timer', named || 'My Timer', takenList);
      d.timer = { steps: (b.steps ?? []).map((s) => ({ name: cap1(s.name).slice(0, 30), secs: Math.max(1, Math.round(s.secs)) })), rounds: Math.max(1, Math.min(99, b.rounds ?? 1)) };
      if (!d.timer.steps.length) d.timer.steps = [{ name: 'Timer', secs: 600 }];
      assumed.push(`${d.timer.steps.length} step${d.timer.steps.length === 1 ? '' : 's'}, ${d.timer.rounds} round${d.timer.rounds === 1 ? '' : 's'}`);
      return { def: finish(d, { pitch: true }), assumed };
    }
    case 'counter': {
      const d = blank('counter', named || 'My Counter', takenList);
      d.counter = { names: (b.items.length ? b.items : ['Count']).slice(0, 12).map((x) => cap1(x).slice(0, 24)), step: 1, reset: 'never' };
      return { def: finish(d, { pitch: true }), assumed };
    }
    case 'notes': {
      const d = blank('log', named || 'My Notes', takenList);
      d.log = { fields: [{ id: 'title', label: 'Title', type: 'text', required: true }, { id: 'date', label: 'Date', type: 'date', default: 'today' }, { id: 'body', label: 'Note', type: 'long' }, { id: 'tags', label: 'Tags', type: 'multi', options: ['Idea', 'Work', 'Home', 'Later'] }], title: 'title', sub: 'body', date: 'date', sort: { field: 'date', dir: 'desc' }, stats: [{ label: 'Notes', kind: 'count' }, { label: 'This week', kind: 'count', period: 'week' }], views: ['list', 'calendar'] };
      return { def: finish(d, { sample: true, pitch: true }), assumed };
    }
    case 'cards': {
      const d = blank('deck', named || 'My Cards', takenList);
      assumed.push('four cards that show how it works, to swap for your own');
      return { def: finish(d, { pitch: true }), assumed };
    }
    case 'game': {
      const d = blank('game', 'My Game', takenList);
      assumed.push('a sudoku to start; pick any of the twenty kinds');
      return { def: d, assumed };
    }
    case 'calc':
      return { def: blank('log', 'My Records', takenList), assumed, cannot: 'A calculator needs its formula from a public source and checked answers, so those come ready-made in the Library. Search it for the one you want.' };
    default: {
      // "an app for my <thing>": a collection of that thing, with the fields any collection needs
      const thing = t.match(/\b(?:for|of|track|keep|log|about)\s+(?:all\s+)?(?:my|our|the)?\s*([a-z][a-z ]{1,20}?)(?=\s+(?:with|and|in|on|that|so)\b|[,.?]|$)/)?.[1]?.trim();
      const name = thing && !/^(?:it|this|that|things?|stuff|me|app)$/.test(thing) ? titleCase(`My ${thing}`) : 'My Collection';
      const d = blank('log', name, takenList);
      d.log = { fields: [{ id: 'name', label: 'Name', type: 'text', required: true }, { id: 'kind', label: 'Kind', type: 'choice', options: ['One kind', 'Another kind', 'Other'] }, { id: 'rating', label: 'Rating', type: 'rating' }, { id: 'added', label: 'Added', type: 'date', default: 'today' }, PHOTO, NOTES], title: 'name', sub: 'kind', date: 'added', group: 'kind', sort: { field: 'added', dir: 'desc' }, stats: [{ label: 'Items', kind: 'count' }, { label: 'Added this month', kind: 'count', period: 'month' }], views: ['gallery', 'list', 'board'] };
      assumed.push('a name, a kind, a rating, the date added, a photo and notes');
      assumed.push('change the kinds to your own');
      return { def: finish(d, { sample: true, pitch: true }), assumed };
    }
  }
}
