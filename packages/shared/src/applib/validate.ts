/**
 * THE APP LIBRARY's checks (docs/build-plan/APPLIB.md, "The quality bar"): every AppDef is checked for its format and
 * lengths, unique ids, the fields it names, its calc tests (run through expr.ts), its glyph, British spelling, clean words
 * (no emoji, no "!", no TODO or lorem) and no brand names. apps/edge/test/applib.test.mjs runs it over LIBRARY and fails on
 * any problem, naming the app and the reason. App Maker runs the same checks on what he makes.
 */
import { APP_GLYPHS, ARCHETYPES, FAMILIES, GAME_KINDS, type AppDef, type CalcConfig, type Field, type LogConfig } from './types';
import { ExprError, names, parse, runCalc } from './expr';

export interface Problem {
  id: string;
  why: string;
}

const FIELD_TYPES = ['text', 'long', 'number', 'money', 'date', 'time', 'duration', 'choice', 'multi', 'rating', 'scale', 'check', 'photo', 'link'];
const NUMERIC = new Set(['number', 'money', 'duration', 'rating', 'scale']);
const FORMATS = ['apple-health', 'spotify-history', 'netflix-history', 'youtube-history', 'kindle-clippings', 'goodreads', 'letterboxd', 'gpx', 'tcx', 'fit', 'ics', 'vcf', 'ofx', 'qif', 'csv', 'chrome-bookmarks', 'opml', 'srt'];
const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'vs', 'with', '&']);

/** American spellings of the common pairs, each with its British form. */
export const US_SPELLINGS: Record<string, string> = {
  color: 'colour', colors: 'colours', colored: 'coloured', colorful: 'colourful', favorite: 'favourite', favorites: 'favourites',
  center: 'centre', centers: 'centres', centered: 'centred', organize: 'organise', organized: 'organised', organizer: 'organiser',
  organizing: 'organising', organization: 'organisation', analyze: 'analyse', analyzed: 'analysed', realize: 'realise',
  recognize: 'recognise', apologize: 'apologise', prioritize: 'prioritise', categorize: 'categorise', customize: 'customise',
  memorize: 'memorise', summarize: 'summarise', visualize: 'visualise', optimize: 'optimise', personalize: 'personalise',
  behavior: 'behaviour', behaviors: 'behaviours', honor: 'honour', labor: 'labour', neighbor: 'neighbour', neighbors: 'neighbours',
  flavor: 'flavour', flavors: 'flavours', humor: 'humour', rumor: 'rumour', harbor: 'harbour', vapor: 'vapour', odor: 'odour',
  theater: 'theatre', liter: 'litre', liters: 'litres', fiber: 'fibre', gray: 'grey', catalog: 'catalogue', jewelry: 'jewellery',
  mold: 'mould', plow: 'plough', defense: 'defence', offense: 'offence', traveled: 'travelled', traveling: 'travelling',
  traveler: 'traveller', canceled: 'cancelled', canceling: 'cancelling', modeling: 'modelling', labeled: 'labelled',
  fulfill: 'fulfil', enroll: 'enrol', aluminum: 'aluminium', pajamas: 'pyjamas', mustache: 'moustache', cozy: 'cosy',
  donut: 'doughnut', airplane: 'aeroplane', math: 'maths', zucchini: 'courgette', eggplant: 'aubergine', cilantro: 'coriander',
  diaper: 'nappy', diapers: 'nappies', faucet: 'tap', sidewalk: 'pavement', mom: 'mum',
  skeptic: 'sceptic', skeptical: 'sceptical', curb: 'kerb',
  kilometer: 'kilometre', kilometers: 'kilometres', centimeter: 'centimetre', centimeters: 'centimetres',
  millimeter: 'millimetre', millimeters: 'millimetres', judgment: 'judgement', practicing: 'practising',
  dialog: 'dialogue', analog: 'analogue', omelet: 'omelette', yogurt: 'yoghurt', ameba: 'amoeba', estrogen: 'oestrogen',
  pediatric: 'paediatric', anemia: 'anaemia', esophagus: 'oesophagus', fetus: 'foetus', maneuver: 'manoeuvre', sulfur: 'sulphur',
};
// (words where both spellings live, or the American one is a real British word too, are left out: fall, tire, check, meter, program)

/** Brand and product names never shown in an app's words (the brief's short deny list). */
export const BRANDS = [
  'spotify', 'netflix', 'youtube', 'kindle', 'garmin', 'iphone', 'ipad', 'instagram', 'facebook', 'tiktok', 'twitter', 'whatsapp',
  'snapchat', 'pinterest', 'reddit', 'google', 'microsoft', 'photoshop', 'strava', 'fitbit', 'duolingo', 'evernote',
  'trello', 'dropbox', 'paypal', 'venmo', 'revolut', 'monzo', 'airbnb', 'uber', 'tinder', 'shazam', 'wordle', 'tetris',
  'pokemon', 'pokémon', 'minecraft', 'monopoly', 'scrabble', 'lego', 'starbucks', 'peloton', 'myfitnesspal', 'headspace', 'nintendo',
  'playstation', 'xbox', 'letterboxd', 'goodreads', 'openai', 'tesla', 'disney', 'candy crush',
  'angry birds', 'pac-man', 'pacman', 'zelda', 'mario', 'catan', 'wikipedia', 'imdb', 'deliveroo', 'tesco', 'ikea', 'nike', 'adidas',
];

const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}]/u;
const JUNK = /\b(todo|tbd|fixme|lorem|ipsum|placeholder|xxx)\b/i;
const usRe = new RegExp(`\\b(${Object.keys(US_SPELLINGS).join('|')})\\b`, 'i');
const brandRe = new RegExp(`(^|[^a-z])(${BRANDS.map((b) => b.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')).join('|')})(?![a-z])`, 'i');

/** The problems with one piece of words he sees (where says which part of the app it is). */
export function wordProblems(text: string, where: string, o: { brands?: boolean } = {}): string[] {
  const out: string[] = [];
  if (EMOJI.test(text)) out.push(`${where} has an emoji`);
  if (text.includes('!')) out.push(`${where} has an exclamation mark`);
  if (JUNK.test(text)) out.push(`${where} has placeholder words (“${JUNK.exec(text)![0]}”)`);
  const us = usRe.exec(text);
  if (us) out.push(`${where} spells “${us[1]}” the American way (British: “${US_SPELLINGS[us[1]!.toLowerCase()]}”)`);
  if (o.brands !== false) {
    const b = brandRe.exec(text);
    if (b) out.push(`${where} names a brand (“${b[2]}”)`);
  }
  return out;
}

/** Title Case: every word starts with a capital (or a digit), except the small joining words after the first. */
export function isTitleCase(s: string): boolean {
  return s.split(/\s+/).every((w, i) => /^[A-Z0-9]/.test(w) || (i > 0 && SMALL.has(w)) || /^[^A-Za-z0-9]+$/.test(w));
}

const wordsIn = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const isStr = (v: unknown): v is string => typeof v === 'string';

/** The field ids a title, line or meta reads: a bare field id, or the {ids} in a template. */
export function templateFields(t: string): string[] {
  if (!t.includes('{')) return [t];
  return [...t.matchAll(/\{([a-z0-9_]+)\}/g)].map((m) => m[1]!);
}

function checkLog(log: LogConfig | undefined, where: string, add: (why: string) => void, sample: AppDef['sample'], needSample: boolean): void {
  if (!log || typeof log !== 'object') return add(`${where} config is missing`);
  if (!Array.isArray(log.fields) || !log.fields.length) return add(`${where} has no fields`);
  if (log.fields.length > 24) add(`${where} has more than 24 fields`);
  const byId = new Map<string, Field>();
  for (const f of log.fields) {
    if (!isStr(f.id) || !/^[a-z][a-z0-9_]*$/.test(f.id)) add(`field “${String(f.id)}” has a bad id (lower-case words, a-z, 0-9, _)`);
    if (byId.has(f.id)) add(`field “${f.id}” appears twice`);
    byId.set(f.id, f);
    if (!FIELD_TYPES.includes(f.type)) add(`field “${f.id}” has an unknown type “${String(f.type)}”`);
    if (!isStr(f.label) || !f.label.trim()) add(`field “${f.id}” has no label`);
    else if (wordsIn(f.label) > 3 || f.label.length > 24) add(`field “${f.id}”'s label “${f.label}” is too long (one to three words, 24 characters)`);
    if (f.type === 'choice' || f.type === 'multi') {
      if (!Array.isArray(f.options) || f.options.length < 2 || f.options.length > 12) add(`field “${f.id}” needs 2 to 12 options`);
      else {
        if (new Set(f.options).size !== f.options.length) add(`field “${f.id}” repeats an option`);
        for (const o of f.options) if (!isStr(o) || !o.trim() || o.length > 24) add(`field “${f.id}” has an option longer than 24 characters or empty (“${String(o)}”)`);
      }
    } else if (f.options) add(`field “${f.id}” has options but is not a choice`);
    if (f.unit && f.type === 'money') add(`field “${f.id}” is money and must not have a unit`);
    if (f.min != null && f.max != null && f.min > f.max) add(`field “${f.id}” has min above max`);
  }
  const need = (id: string | undefined, part: string, types?: Set<string> | string[]) => {
    if (id == null) return;
    const f = byId.get(id);
    if (!f) return add(`${part} names a field that does not exist (“${id}”)`);
    const ok = types ? (Array.isArray(types) ? types.includes(f.type) : types.has(f.type)) : true;
    if (!ok) add(`${part} needs a ${Array.isArray(types) ? types.join(' or ') : 'number'} field, and “${id}” is ${f.type}`);
  };
  if (!isStr(log.title) || !log.title) add(`${where} has no title`);
  else for (const id of templateFields(log.title)) need(id, 'title');
  if (log.sub != null) for (const id of templateFields(log.sub)) need(id, 'sub');
  if (log.meta != null) for (const id of templateFields(log.meta)) need(id, 'meta');
  need(log.date, 'date', ['date']);
  if (log.sort) { need(log.sort.field, 'sort'); if (!['asc', 'desc'].includes(log.sort.dir)) add('sort.dir must be asc or desc'); }
  need(log.group, 'group', ['choice']);
  for (const s of log.stats ?? []) {
    if (!isStr(s.label) || !s.label.trim() || s.label.length > 24 || wordsIn(s.label) > 4) add(`stat “${String(s.label)}” needs a short label (24 characters, four words at most)`);
    if (!['count', 'sum', 'avg', 'min', 'max', 'last', 'streak', 'distinct'].includes(s.kind)) add(`stat “${s.label}” has an unknown kind “${String(s.kind)}”`);
    if (s.kind !== 'count' && s.kind !== 'streak') {
      if (!s.field) add(`stat “${s.label}” (${s.kind}) needs a field`);
      else need(s.field, `stat “${s.label}”`, ['sum', 'avg', 'min', 'max'].includes(s.kind) ? NUMERIC : undefined);
    }
    if ((s.kind === 'streak' || (s.period && s.period !== 'all')) && !log.date) add(`stat “${s.label}” needs the app's date field`);
    if (s.dir && s.goal == null) add(`stat “${s.label}” has a direction but no goal`);
  }
  if (log.chart) {
    need(log.chart.field, 'chart', NUMERIC);
    if (!log.date) add('the chart needs the app\'s date field');
    if (!['bar', 'line'].includes(log.chart.kind)) add('chart.kind must be bar or line');
    if (!['week', 'month', 'year'].includes(log.chart.period)) add('chart.period must be week, month or year');
  }
  for (const v of log.views ?? []) if (!['list', 'board', 'calendar', 'gallery'].includes(v)) add(`unknown view “${String(v)}”`);
  if (log.views?.includes('board') && !log.group) add('the board view needs a group (a choice field)');
  if (log.views?.includes('calendar') && !log.date) add('the calendar view needs the app\'s date field');
  if (log.views?.includes('gallery') && !log.fields.some((f) => f.type === 'photo')) add('the gallery view needs a photo field');
  if (log.remind) { need(log.remind.field, 'remind', ['date']); if (!isStr(log.remind.words) || !log.remind.words.trim()) add('remind needs words'); }
  if (needSample) {
    if (!Array.isArray(sample) || sample.length < 2 || sample.length > 8) add('needs 2 to 8 sample records');
    for (const [i, r] of (sample ?? []).entries()) {
      for (const k of Object.keys(r)) if (!byId.has(k)) add(`sample ${i + 1} has a key that is not a field (“${k}”)`);
      for (const f of log.fields) {
        const v = r[f.id];
        if (v == null) { if (f.required) add(`sample ${i + 1} leaves out the required field “${f.id}”`); continue; }
        if (f.type === 'choice' && f.options && !f.options.includes(String(v))) add(`sample ${i + 1}'s “${f.id}” is not one of its options (“${String(v)}”)`);
        if (f.type === 'multi' && f.options && (!Array.isArray(v) || v.some((x) => !f.options!.includes(String(x))))) add(`sample ${i + 1}'s “${f.id}” must be a list of its options`);
        if (NUMERIC.has(f.type) && typeof v !== 'number') add(`sample ${i + 1}'s “${f.id}” must be a number`);
        if (f.type === 'date' && !(isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v))) add(`sample ${i + 1}'s “${f.id}” must be a date (YYYY-MM-DD)`);
        if (f.type === 'time' && !(isStr(v) && /^\d{2}:\d{2}$/.test(v))) add(`sample ${i + 1}'s “${f.id}” must be a time (HH:MM)`);
        if (f.type === 'check' && typeof v !== 'boolean') add(`sample ${i + 1}'s “${f.id}” must be true or false`);
      }
    }
  }
}

/** Every piece of words he sees in an app, each with where it is (for the word checks). */
export function visibleWords(d: AppDef): { text: string; where: string; brands?: boolean }[] {
  const out: { text: string; where: string; brands?: boolean }[] = [];
  const add = (text: unknown, where: string, brands = true) => { if (isStr(text) && text) out.push({ text, where, brands }); };
  add(d.name, 'name');
  add(d.pitch, 'pitch');
  (d.keywords ?? []).forEach((k) => add(k, 'a keyword'));
  (d.tour ?? []).forEach((t, i) => add(t, `tour line ${i + 1}`));
  const logWords = (l: LogConfig | undefined, pre: string) => {
    if (!l) return;
    for (const f of l.fields ?? []) { add(f.label, `${pre}field “${f.id}”`); add(f.hint, `${pre}field “${f.id}”'s hint`); add(f.unit, `${pre}field “${f.id}”'s unit`); (f.options ?? []).forEach((o) => add(o, `${pre}field “${f.id}”'s options`)); }
    for (const s of l.stats ?? []) add(s.label, `${pre}stat “${s.label}”`);
    if (l.remind) add(l.remind.words, `${pre}reminder`);
  };
  logWords(d.log, '');
  logWords(d.importer?.log, 'import ');
  (d.importer?.how ?? []).forEach((s, i) => add(s, `import step ${i + 1}`, false));
  for (const [i, r] of (d.sample ?? []).entries()) for (const [k, v] of Object.entries(r)) {
    if (Array.isArray(v)) v.forEach((x) => add(x, `sample ${i + 1} “${k}”`));
    else if (isStr(v) && !/^https?:\/\//.test(v)) add(v, `sample ${i + 1} “${k}”`);
  }
  for (const s of d.checklist?.sections ?? []) { add(s.name, 'a checklist section'); s.items.forEach((x) => add(x, `checklist “${s.name}”`)); }
  for (const x of d.calc?.inputs ?? []) { add(x.label, `input “${x.id}”`); add(x.unit, `input “${x.id}”'s unit`); (x.choices ?? []).forEach((c) => add(c.label, `input “${x.id}”'s choices`)); }
  for (const x of d.calc?.outputs ?? []) { add(x.label, `output “${x.id}”`); add(x.unit, `output “${x.id}”'s unit`); }
  add(d.calc?.source, 'the calc source');
  for (const s of d.timer?.steps ?? []) add(s.name, 'a timer step');
  for (const [i, c] of (d.deck?.cards ?? []).entries()) { add(c.q, `card ${i + 1}`); add(c.a, `card ${i + 1}'s answer`); }
  for (const n of d.counter?.names ?? []) add(n, 'a counter name');
  for (const s of d.guide?.sections ?? []) { add(s.title, 'a guide title'); add(s.body, `guide “${s.title}”`); (s.tags ?? []).forEach((t) => add(t, `guide “${s.title}”'s tags`)); }
  add(d.guide?.source.name, 'the guide source', false);
  return out;
}

const TONES = ['good', 'ok', 'warn', 'bad'];

/** THE PRO ROUND: a calc output's bands (ordered, short words that follow the word rules) and its one-sentence explain. */
function checkWords(o: CalcConfig['outputs'][number], add: (why: string) => void): void {
  if (o.bands != null) {
    if (!Array.isArray(o.bands) || !o.bands.length) add(`output “${o.id}”'s bands must be a list of one or more`);
    else {
      let last = -Infinity;
      for (const [i, b] of o.bands.entries()) {
        const end = i === o.bands.length - 1;
        if (!isStr(b.words) || !b.words.trim() || b.words.length > 32) add(`output “${o.id}”'s band ${i + 1} needs words (32 characters at most)`);
        else {
          if (/[.!?]$/.test(b.words)) add(`output “${o.id}”'s band “${b.words}” must not end with a stop`);
          if (!/^[A-Z0-9]/.test(b.words)) add(`output “${o.id}”'s band “${b.words}” must start with a capital`);
          for (const p of wordProblems(b.words, `output “${o.id}”'s band`)) add(p);
        }
        if (b.tone != null && !TONES.includes(b.tone)) add(`output “${o.id}”'s band ${i + 1} has an unknown tone “${String(b.tone)}”`);
        if (b.upTo == null) { if (!end) add(`output “${o.id}”'s band ${i + 1} leaves out upTo but is not the last`); continue; }
        if (typeof b.upTo !== 'number' || !Number.isFinite(b.upTo)) { add(`output “${o.id}”'s band ${i + 1} needs a number upTo`); continue; }
        if (!(b.upTo > last)) add(`output “${o.id}”'s bands must rise (band ${i + 1} is at ${b.upTo})`);
        last = b.upTo;
      }
    }
  }
  if (o.explain != null) {
    const x = o.explain;
    if (!isStr(x) || x.length < 12 || x.length > 140) add(`output “${o.id}”'s explain must be 12 to 140 characters`);
    else if (!/^[A-Z0-9]/.test(x) || !x.endsWith('.') || x.endsWith('..') || /[.?!] [A-Z]/.test(x.slice(0, -1))) add(`output “${o.id}”'s explain must be one sentence ending with a full stop`);
    else for (const p of wordProblems(x, `output “${o.id}”'s explain`)) add(p);
  }
}

/** The problems with one app (ids across the Library are checked by validateLibrary). */
export function validateApp(d: AppDef): string[] {
  const out: string[] = [];
  const add = (why: string) => out.push(why);
  if (!d || typeof d !== 'object') return ['is not an app'];
  if (!isStr(d.id) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(d.id) || d.id.length > 40) add('id must be lower-case words joined by hyphens (40 characters at most)');
  if (!isStr(d.name) || d.name.length < 2 || d.name.length > 18) add(`name must be 2 to 18 characters (“${String(d.name)}”)`);
  else if (!isTitleCase(d.name)) add(`name must be in Title Case (“${d.name}”)`);
  if (!(d.family in FAMILIES)) add(`unknown family “${String(d.family)}”`);
  if (!(APP_GLYPHS as readonly string[]).includes(d.glyph)) add(`unknown glyph “${String(d.glyph)}”`);
  if (!isStr(d.pitch) || d.pitch.length < 30 || d.pitch.length > 90) add(`pitch must be 30 to 90 characters (it is ${isStr(d.pitch) ? d.pitch.length : 0})`);
  else if (!d.pitch.endsWith('.') || d.pitch.endsWith('..')) add('pitch must be one sentence ending with a full stop');
  else if (/[.?] [A-Z]/.test(d.pitch.slice(0, -1))) add('pitch must be one sentence');
  if (!Array.isArray(d.keywords) || d.keywords.length < 2 || d.keywords.length > 8) add('needs 2 to 8 keywords');
  else for (const k of d.keywords) if (!isStr(k) || k !== k.toLowerCase() || !k.trim()) add(`keyword “${String(k)}” must be lower case`);
  if (!ARCHETYPES.includes(d.archetype)) add(`unknown archetype “${String(d.archetype)}”`);
  if (!Array.isArray(d.tour) || d.tour.length !== 3) add('the tour must be three lines');
  else for (const [i, t] of d.tour.entries()) if (!isStr(t) || !t.trim() || t.length > 70) add(`tour line ${i + 1} must be 1 to 70 characters`);

  // the archetype's own config, and only that one
  const CONF = ['log', 'checklist', 'calc', 'timer', 'deck', 'counter', 'guide', 'game', 'importer', 'screen'] as const;
  for (const c of CONF) if (c !== d.archetype && (d as unknown as Record<string, unknown>)[c] != null) add(`has a ${c} config but is a ${d.archetype}`);
  switch (d.archetype) {
    case 'log': checkLog(d.log, 'log', add, d.sample, true); break;
    case 'importer': {
      const im = d.importer;
      if (!im) { add('importer config is missing'); break; }
      if (!FORMATS.includes(im.format)) add(`unknown import format “${String(im.format)}”`);
      if (!Array.isArray(im.how) || !im.how.length) add('importer needs the steps to get the file');
      checkLog(im.log, 'importer.log', add, d.sample, true);
      break;
    }
    case 'checklist': {
      const c = d.checklist;
      if (!c || !Array.isArray(c.sections) || !c.sections.length) { add('checklist needs at least one section'); break; }
      for (const s of c.sections) if (!isStr(s.name) || !Array.isArray(s.items) || !s.items.length) add(`checklist section “${String(s.name)}” needs items`);
      if (!['never', 'daily', 'weekly'].includes(c.repeat)) add('checklist.repeat must be never, daily or weekly');
      break;
    }
    case 'calc': {
      const c = d.calc;
      if (!c || !Array.isArray(c.inputs) || !Array.isArray(c.outputs) || !c.inputs.length || !c.outputs.length) { add('calc needs inputs and outputs'); break; }
      const known = new Set<string>();
      for (const x of c.inputs) {
        if (!/^[a-z][a-z0-9_]*$/.test(x.id)) add(`input “${x.id}” has a bad id`);
        if (known.has(x.id)) add(`“${x.id}” is used twice`);
        if (['pi', 'e', 'and', 'or', 'not'].includes(x.id)) add(`input id “${x.id}” is a reserved word`);
        known.add(x.id);
        if (typeof x.default !== 'number' || !Number.isFinite(x.default)) add(`input “${x.id}” needs a number default`);
        if (x.choices && (x.choices.length < 2 || x.choices.some((ch) => typeof ch.value !== 'number'))) add(`input “${x.id}” needs 2 or more choices with numbers`);
      }
      for (const o of c.outputs) {
        if (!/^[a-z][a-z0-9_]*$/.test(o.id)) add(`output “${o.id}” has a bad id`);
        try {
          for (const n of names(parse(o.expr))) if (!known.has(n)) add(`output “${o.id}” reads “${n}”, which is not an input or an earlier output`);
        } catch (e) {
          add(`output “${o.id}”'s formula does not parse: ${e instanceof ExprError ? e.message : String(e)}`);
        }
        if (known.has(o.id)) add(`“${o.id}” is used twice`);
        known.add(o.id);
      }
      if (!Array.isArray(c.tests) || c.tests.length < 2) add('calc needs 2 or more tests');
      for (const [i, t] of (c.tests ?? []).entries()) {
        for (const k of Object.keys(t.in ?? {})) if (!c.inputs.some((x) => x.id === k)) add(`test ${i + 1} sets “${k}”, which is not an input`);
        if (!Object.keys(t.out ?? {}).length) add(`test ${i + 1} expects nothing`);
        const got = runCalc(c, t.in ?? {});
        for (const [k, want] of Object.entries(t.out ?? {})) {
          if (!(k in got)) { add(`test ${i + 1} expects “${k}”, which is not an output`); continue; }
          const tol = t.tol ?? Math.max(Math.abs(want) * 0.005, 0.01);
          if (!(Math.abs(got[k]! - want) <= tol)) add(`test ${i + 1}: “${k}” came out ${Number.isFinite(got[k]) ? +got[k]!.toFixed(6) : got[k]} but the source says ${want}`);
        }
      }
      for (const o of c.outputs) checkWords(o, add);
      if (!isStr(c.source) || !c.source.trim()) add('calc needs its public source');
      break;
    }
    case 'timer': {
      const t = d.timer;
      if (!t || !Array.isArray(t.steps) || !t.steps.length) { add('timer needs steps'); break; }
      for (const s of t.steps) if (!isStr(s.name) || !s.name.trim() || !(s.secs > 0) || s.secs > 86400) add(`timer step “${String(s.name)}” needs a name and 1 s to 24 h`);
      if (!Number.isInteger(t.rounds) || t.rounds < 1 || t.rounds > 99) add('timer.rounds must be 1 to 99');
      break;
    }
    case 'deck': {
      const k = d.deck;
      if (!k || !Array.isArray(k.cards) || k.cards.length < 4) { add('deck needs 4 or more cards'); break; }
      for (const [i, c] of k.cards.entries()) if (!isStr(c.q) || !c.q.trim() || !isStr(c.a) || !c.a.trim()) add(`card ${i + 1} needs a question and an answer`);
      if (new Set(k.cards.map((c) => c.q)).size !== k.cards.length) add('deck repeats a card');
      if (!['srs', 'quiz'].includes(k.mode)) add('deck.mode must be srs or quiz');
      break;
    }
    case 'counter': {
      const c = d.counter;
      if (!c || !Array.isArray(c.names) || !c.names.length || c.names.length > 12) { add('counter needs 1 to 12 names'); break; }
      if (!(c.step > 0)) add('counter.step must be above 0');
      if (!['never', 'daily', 'weekly'].includes(c.reset)) add('counter.reset must be never, daily or weekly');
      break;
    }
    case 'guide': {
      const g = d.guide;
      if (!g || !Array.isArray(g.sections) || !g.sections.length) { add('guide needs sections'); break; }
      for (const s of g.sections) if (!isStr(s.title) || !s.title.trim() || !isStr(s.body) || !s.body.trim()) add(`guide section “${String(s.title)}” needs a title and a body`);
      if (!g.source || !isStr(g.source.name) || !isStr(g.source.url) || !/^https:\/\/[^\s]+$/.test(g.source.url)) add('guide needs its public source with an https address');
      break;
    }
    case 'game': {
      if (!d.game || !GAME_KINDS.includes(d.game.kind)) add(`unknown game kind “${String(d.game?.kind)}”`);
      else if (!d.game.options || typeof d.game.options !== 'object') add('game needs options');
      break;
    }
    case 'screen': {
      if (!d.screen || !isStr(d.screen.hash) || !/^[a-z0-9-]+(\?[a-z0-9=&-]*)?$/.test(d.screen.hash)) add('screen needs its hash (e.g. "sheets")');
      break;
    }
  }
  // THE PRO ROUND's fields
  if (d.tier != null && d.tier !== 'essential' && d.tier !== 'more') add(`tier must be essential or more (“${String(d.tier)}”)`);
  if (d.hue != null && !(Number.isInteger(d.hue) && d.hue >= 0 && d.hue <= 359)) add(`hue must be a whole number from 0 to 359 (“${String(d.hue)}”)`);
  if (d.skin != null && !(d.skin in FAMILIES)) add(`unknown skin “${String(d.skin)}”`);
  if (d.sample != null && d.archetype !== 'log' && d.archetype !== 'importer') add('only log and importer apps have sample records');

  for (const w of visibleWords(d)) out.push(...wordProblems(w.text, w.where, { brands: w.brands }));
  return out;
}

/** Every problem in a set of apps: each app's own, and ids or names used twice. */
export function validateLibrary(apps: AppDef[]): Problem[] {
  const out: Problem[] = [];
  const ids = new Map<string, number>();
  const nm = new Map<string, string>();
  for (const d of apps) {
    const id = isStr(d?.id) ? d.id : '(no id)';
    ids.set(id, (ids.get(id) ?? 0) + 1);
    for (const why of validateApp(d)) out.push({ id, why });
    const key = isStr(d?.name) ? d.name.toLowerCase() : '';
    if (key && nm.has(key) && nm.get(key) !== id) out.push({ id, why: `has the same name as “${nm.get(key)}”` });
    else if (key) nm.set(key, id);
  }
  for (const [id, n] of ids) if (n > 1) out.push({ id, why: `the id is used ${n} times` });
  // THE PRO ROUND: the whole Library leads with at least 250 essentials (a small set, such as App Maker's, is not held to it)
  if (apps.length >= 300) {
    const ess = apps.filter((d) => d?.tier === 'essential').length;
    if (ess < 250) out.push({ id: '(library)', why: `only ${ess} apps are essential (at least 250)` });
    for (const d of apps) if (d?.archetype === 'screen' && d.tier !== 'essential') out.push({ id: d.id, why: 'Ghosty’s own screens are essential' });
  }
  return out;
}
