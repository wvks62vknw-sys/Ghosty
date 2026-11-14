/**
 * THE PRO ROUND, lane LOG: quick-add. A log app's one line of plain words ("Rioja 2018 £14.50 4 stars", "ran 5k in 26 min")
 * read into its own fields, on the phone, with no model and no network: money, stars, durations, days, times, numbers with
 * their units, a year, the app's own choices, and what is left over as the title. The brain tests are
 * apps/edge/test/applibquick.test.mjs.
 */
import type { Field, LogConfig } from './types';

export type QVal = string | number | boolean | string[];
export interface QuickRead {
  /** The fields it filled, by field id. */
  fields: Record<string, QVal>;
  /** The field ids in the order they were read. */
  used: string[];
  /** The words nothing took (after the title field had its share). */
  rest: string;
}

const NUMBER_RE = '(\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)';
const toNum = (s: string) => Number(s.replace(/,/g, ''));
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DAY_RE = '(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)';

/** What he might type after a number for each unit a field carries ("5k" is 5 km, "12 kilos" 12 kg). */
const UNIT_WORDS: Record<string, string[]> = {
  km: ['km', 'kms', 'k', 'kilometres', 'kilometre', 'kilometers'],
  mi: ['mi', 'mile', 'miles'],
  miles: ['mi', 'mile', 'miles'],
  m: ['m', 'metres', 'metre', 'meters'],
  cm: ['cm', 'centimetres'],
  mm: ['mm'],
  kg: ['kg', 'kgs', 'kilo', 'kilos', 'kilograms'],
  g: ['g', 'grams', 'gram'],
  lb: ['lb', 'lbs', 'pounds'],
  lbs: ['lb', 'lbs'],
  st: ['st', 'stone'],
  l: ['l', 'litre', 'litres', 'liters'],
  ml: ['ml'],
  kcal: ['kcal', 'cal', 'cals', 'calories'],
  bpm: ['bpm'],
  min: ['min', 'mins', 'minutes', 'minute'],
  h: ['h', 'hr', 'hrs', 'hour', 'hours'],
  s: ['s', 'sec', 'secs', 'seconds'],
  days: ['day', 'days'],
  pages: ['pages', 'page', 'pp'],
  words: ['words', 'word'],
  steps: ['steps', 'step'],
  reps: ['reps', 'rep', 'x'],
  sets: ['sets', 'set'],
  glasses: ['glasses', 'glass'],
  cups: ['cups', 'cup'],
  '%': ['%', 'percent', 'per cent'],
  '°c': ['°c', 'c', 'degrees', '°'],
  kwh: ['kwh'],
  gb: ['gb'],
  mpg: ['mpg'],
};

/** The words a field's unit is typed as: its own spelling, and the usual others. */
function unitWords(f: Field): string[] {
  const u = fold(f.unit ?? '').trim();
  if (!u) return [];
  const own = UNIT_WORDS[u] ?? [];
  return [...new Set([u, ...own, ...(u.endsWith('s') ? [u.slice(0, -1)] : [`${u}s`])])].sort((a, b) => b.length - a.length);
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A word brought to its root, so "ran", "running" and "runs" all meet "Run". */
const IRREGULAR: Record<string, string> = { ran: 'run', swam: 'swim', rode: 'ride', drank: 'drink', ate: 'eat', went: 'go', bought: 'buy', saw: 'see', flew: 'fly', drove: 'drive', wrote: 'write', made: 'make', took: 'take', slept: 'sleep', spent: 'spend' };
export function stem(w: string): string {
  let s = fold(w).replace(/[^a-z0-9]/g, '');
  s = IRREGULAR[s] ?? s;
  for (const end of ['ing', 'ed', 'es', 's']) {
    if (s.endsWith(end) && s.length - end.length >= 3) { s = s.slice(0, -end.length); break; }
  }
  if (/([b-df-hj-np-tv-z])\1$/.test(s)) s = s.slice(0, -1);
  if (s.endsWith('e') && s.length > 3) s = s.slice(0, -1);
  return s;
}

/** Is this the year a thing was made (a vintage, a model year)? */
const YEARISH = /year|vintage|born|built|made|released|published|model/i;
const isYearField = (f: Field) => f.type === 'number' && !f.unit && (YEARISH.test(f.id) || YEARISH.test(f.label) || (f.min ?? 0) >= 1800);

/** The fields a template or field id names, in order ("{name} ({year})" → name, year). */
const named = (t: string | undefined) => (!t ? [] : t.includes('{') ? [...t.matchAll(/\{([a-z0-9_]+)\}/g)].map((m) => m[1]!) : [t]);

/** The words that only join (left at either end once the rest is read away). */
const JOINERS = new Set(['in', 'for', 'at', 'on', 'and', 'with', 'of', 'from', 'to', 'a', 'an', 'the', 'by', 'about', 'was', 'is', 'it', 'my', 'did', 'just', 'took', '-', '–', '—', ',', '·']);

/** Read one line of plain words into a log app's fields. */
export function quickAdd(log: LogConfig, text: string, now = new Date()): QuickRead {
  const fields: Record<string, QVal> = {};
  const used: string[] = [];
  let s = ` ${text.replace(/\s+/g, ' ').trim()} `;
  const free = (f: Field | undefined): f is Field => !!f && !(f.id in fields);
  const put = (f: Field, v: QVal) => { fields[f.id] = v; used.push(f.id); };
  const byType = (...types: Field['type'][]) => log.fields.filter((f) => types.includes(f.type) && !(f.id in fields));
  /** Take the first match of `re` out of the line, handing its groups to `take` (which says whether it used it). */
  const take = (re: RegExp, use: (m: RegExpExecArray) => boolean) => {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = g.exec(s))) {
      if (use(m)) { s = `${s.slice(0, m.index)} ${s.slice(m.index + m[0].length)}`; return true; }
    }
    return false;
  };

  // money: £14.50, 14.50 quid, 80p
  for (const f of byType('money')) {
    take(new RegExp(`(?<![\\w.])(?:£\\s?${NUMBER_RE}|${NUMBER_RE}\\s?(?:quid|pounds?|gbp)\\b|(\\d+)p\\b)`, 'i'), (m) => {
      const v = (m[1] ?? m[2]) != null ? toNum((m[1] ?? m[2])!) : Number(m[3]) / 100;
      if (!Number.isFinite(v)) return false;
      put(f, Math.round(v * 100) / 100);
      return true;
    });
  }
  // stars: 4 stars, 4/5, ★★★★
  for (const f of byType('rating')) {
    take(/(?<![\w.])(\d(?:\.\d)?)\s?(?:\/\s?5\b|stars?\b|★)|(★{1,5})/i, (m) => {
      const v = m[2] ? m[2].length : Math.round(Number(m[1]));
      if (v < 1 || v > 5) return false;
      put(f, v);
      return true;
    });
  }
  // a scale: 7/10, "mood 7"
  for (const f of byType('scale')) {
    const hi = f.max ?? 10;
    take(new RegExp(`(?:\\b${esc(fold(f.label))}\\s?(?:of|at|:)?\\s?)?(?<![\\w.])(\\d+(?:\\.\\d+)?)\\s?(?:\\/\\s?${hi}\\b|out of ${hi}\\b)`, 'i'), (m) => { put(f, Number(m[1])); return true; })
      || take(new RegExp(`\\b${esc(fold(f.label))}\\s?(?:of|at|:)?\\s?(\\d+(?:\\.\\d+)?)\\b`, 'i'), (m) => { const v = Number(m[1]); if (v < (f.min ?? 1) || v > hi) return false; put(f, v); return true; });
  }
  // a duration: 26 min, 1 h 20 min, 1:20:05, 45 minutes
  for (const f of byType('duration')) {
    take(/(?<![\w.:])(\d{1,2}):([0-5]\d):([0-5]\d)(?![\w:])/, (m) => { put(f, Math.round(Number(m[1]) * 60 + Number(m[2]) + Number(m[3]) / 60)); return true; })
      || take(/(?<![\w.])(?:(\d+(?:\.\d+)?)\s?(?:h|hrs?|hours?)\b\s*(?:and\s)?)?(?:(\d+)\s?(?:m|mins?|minutes?)\b)/i, (m) => { put(f, Math.round(Number(m[1] ?? 0) * 60 + Number(m[2]))); return true; })
      || take(/(?<![\w.])(\d+(?:\.\d+)?)\s?(?:h|hrs?|hours?)\b/i, (m) => { put(f, Math.round(Number(m[1]) * 60)); return true; });
  }
  // a day: today, yesterday, last Tuesday, 12 March, 2026-03-12, 12/3
  const dates = log.fields.filter((f) => f.type === 'date');
  const day = (log.date ? dates.find((f) => f.id === log.date) : undefined) ?? dates[0];
  if (free(day)) {
    const at = (d: Date) => { put(day, iso(d)); return true; };
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    take(/\b(\d{4})-(\d{2})-(\d{2})\b/, (m) => at(new Date(+m[1]!, +m[2]! - 1, +m[3]!)))
      || take(/\b(today|tonight|this morning|this evening)\b/i, () => at(base))
      || take(/\b(yesterday|last night)\b/i, () => at(new Date(base.getFullYear(), base.getMonth(), base.getDate() - 1)))
      || take(/\btomorrow\b/i, () => at(new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1)))
      || take(new RegExp(`\\b(?:(last|next|this|on)\\s)?${DAY_RE}\\b`, 'i'), (m) => {
        const want = DAYS.indexOf(m[2]!.slice(0, 3).toLowerCase());
        let diff = want - base.getDay();
        if (m[1]?.toLowerCase() === 'next') diff = diff <= 0 ? diff + 7 : diff;
        else if (diff > 0 || (diff === 0 && m[1]?.toLowerCase() === 'last')) diff -= 7;
        return at(new Date(base.getFullYear(), base.getMonth(), base.getDate() + diff));
      })
      || take(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s(?:of\\s)?${MONTH_RE}(?:\\s(\\d{4}))?\\b`, 'i'), (m) => at(new Date(m[3] ? +m[3] : base.getFullYear(), MONTHS.indexOf(m[2]!.slice(0, 3).toLowerCase()), +m[1]!)))
      || take(new RegExp(`\\b${MONTH_RE}\\s(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s(\\d{4}))?\\b`, 'i'), (m) => at(new Date(m[3] ? +m[3] : base.getFullYear(), MONTHS.indexOf(m[1]!.slice(0, 3).toLowerCase()), +m[2]!)))
      || take(/(?<![\w.£])(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?![\w/])/, (m) => {
        const dd = +m[1]!, mm = +m[2]!;
        if (dd < 1 || dd > 31 || mm < 1 || mm > 12) return false;
        const yy = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : base.getFullYear();
        return at(new Date(yy, mm - 1, dd));
      });
  }
  // a time: 7pm, 7.30am, 19:30
  for (const f of byType('time')) {
    take(/\b(\d{1,2})(?:[:.](\d{2}))?\s?(am|pm)\b/i, (m) => {
      let hh = +m[1]! % 12;
      if (m[3]!.toLowerCase() === 'pm') hh += 12;
      put(f, `${pad(hh)}:${m[2] ?? '00'}`);
      return true;
    }) || take(/(?<![\w.:])([01]?\d|2[0-3]):([0-5]\d)(?![\w:])/, (m) => { put(f, `${pad(+m[1]!)}:${m[2]}`); return true; });
  }
  // numbers with their units: 5k, 12 kg, 300 pages, 7 glasses
  for (const f of log.fields.filter((x) => (x.type === 'number' || x.type === 'scale') && x.unit)) {
    if (!free(f)) continue;
    const words = unitWords(f);
    if (!words.length) continue;
    take(new RegExp(`(?<![\\w.£])${NUMBER_RE}\\s?(?:${words.map(esc).join('|')})(?![\\w])`, 'i'), (m) => {
      const v = toNum(m[1]!);
      if ((f.min != null && v < f.min) || (f.max != null && v > f.max)) return false;
      put(f, v);
      return true;
    });
  }
  // a year: 2018 (a vintage, the year it was made)
  for (const f of log.fields.filter(isYearField)) {
    if (!free(f)) continue;
    take(/(?<![\w.£])(1[89]\d\d|20\d\d)(?![\w.])/, (m) => { put(f, +m[1]!); return true; });
  }
  // the app's own choices: "red", "ran" for Run, "Netflix"
  for (const f of log.fields.filter((x) => (x.type === 'choice' || x.type === 'multi') && x.options?.length)) {
    if (!free(f)) continue;
    const got: string[] = [];
    // the longest options first, so "Sparkling rosé" is read before "Rosé"
    for (const o of f.options!.slice().sort((a, b) => b.length - a.length)) {
      if (f.type === 'choice' && got.length) break;
      const words = o.split(/\s+/);
      const hit = words.length > 1
        ? take(new RegExp(`(?<![\\w])${esc(fold(o))}(?![\\w])`, 'i'), () => true) || take(new RegExp(`(?<![\\w])${esc(o)}(?![\\w])`, 'i'), () => true)
        : take(/[\p{L}\p{N}]+/u, (m) => stem(m[0]) === stem(o) && stem(o).length >= 2);
      if (hit) got.push(o);
    }
    if (got.length) put(f, f.type === 'multi' ? f.options!.filter((o) => got.includes(o)) : got[0]!);
  }
  // a yes-or-no named outright: "with friends" ticks Friends
  for (const f of byType('check')) {
    const w = stem(f.label.split(/\s+/).pop() ?? '');
    if (w.length >= 3) take(/[\p{L}]+/u, (m) => (stem(m[0]) === w ? (put(f, true), true) : false));
  }
  // a number named by its field: "6 reps", "3 sets", "sets 3"
  for (const f of log.fields.filter((x) => x.type === 'number' && !x.unit && !(x.id in fields) && !isYearField(x))) {
    const w = fold(f.label).split(/\s+/).pop() ?? '';
    if (w.length < 3) continue;
    const names = [w, w.endsWith('s') ? w.slice(0, -1) : `${w}s`].map(esc).join('|');
    take(new RegExp(`(?<![\\w.£])${NUMBER_RE}\\s?(?:${names})\\b|\\b(?:${names})\\s?(?:of\\s|:\\s?)?${NUMBER_RE}(?![\\w.])`, 'i'), (m) => {
      const v = toNum((m[1] ?? m[2])!);
      if ((f.min != null && v < f.min) || (f.max != null && v > f.max)) return false;
      put(f, v);
      return true;
    });
  }
  // what numbers are left fill the plain number fields still empty, in order
  for (const f of log.fields.filter((x) => (x.type === 'number' || x.type === 'scale') && !(x.id in fields) && !isYearField(x))) {
    take(new RegExp(`(?<![\\w.£:/-])${NUMBER_RE}(?![\\w.:/%])`), (m) => {
      const v = toNum(m[1]!);
      if ((f.min != null && v < f.min) || (f.max != null && v > f.max)) return false;
      put(f, v);
      return true;
    });
  }
  // the rest is the title: its text field, else the first text field still empty
  const textIds = named(log.title).map((id) => log.fields.find((f) => f.id === id)).filter((f): f is Field => !!f && (f.type === 'text' || f.type === 'long'));
  const titleField = textIds.find(free) ?? log.fields.find((f) => f.type === 'text' && free(f));
  const words = s.trim().split(/\s+/).filter(Boolean);
  while (words.length && JOINERS.has(words[0]!.toLowerCase())) words.shift();
  while (words.length && JOINERS.has(words[words.length - 1]!.toLowerCase())) words.pop();
  let rest = words.join(' ').replace(/\s+([,.])/g, '$1').replace(/^[,.\s]+|[,\s]+$/g, '');
  if (rest && titleField) {
    put(titleField, rest.charAt(0).toUpperCase() + rest.slice(1));
    rest = '';
  }
  return { fields, used, rest };
}

/** An example line for an app's quick-add bar, from its first sample ("Rioja Reserva 2018 £14.50 4 stars"). */
export function quickExample(log: LogConfig, sample?: Record<string, unknown>): string {
  if (!sample) return '';
  const bits: string[] = [];
  const tf = named(log.title).map((id) => log.fields.find((f) => f.id === id)).find((f) => f && f.type === 'text');
  if (tf && typeof sample[tf.id] === 'string') bits.push(String(sample[tf.id]));
  const RANK: Partial<Record<Field['type'], number>> = { money: 0, rating: 1, duration: 2, number: 3, choice: 4 };
  for (const f of log.fields.filter((x) => RANK[x.type] != null).sort((a, b) => RANK[a.type]! - RANK[b.type]!)) {
    const v = sample[f.id];
    if (v == null || v === '' || f === tf) continue;
    if (f.type === 'money') bits.push(`£${Number(v).toFixed(Number(v) % 1 ? 2 : 0)}`);
    else if (f.type === 'rating') bits.push(`${v} stars`);
    else if (f.type === 'duration') bits.push(Number(v) >= 60 ? `${Math.floor(Number(v) / 60)} h ${Number(v) % 60} min`.replace(/ 0 min$/, '') : `${v} min`);
    else if (f.type === 'number' && isYearField(f)) bits.push(String(v));
    else if (f.type === 'number' && f.unit && unitWords(f).length) bits.push(`${v} ${f.unit}`);
    else if (f.type === 'choice' && typeof v === 'string') bits.push(v.toLowerCase());
    if (bits.length >= 4) break;
  }
  return bits.join(' ');
}
