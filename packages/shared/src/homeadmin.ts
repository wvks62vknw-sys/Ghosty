/**
 * THE HOME PACK, the pure parts (BRIEF-PACKS-3; OWNER-ISSUES 92 ④): the admin of a house, from his own papers and words.
 *  - a bill read from the text of a photo or a paste (the supplier, the amount, the day it is due, the period it covers) and
 *    a meter read the same way; each says what it took from where, because text read off a photo can be wrong;
 *  - bin days: a weekday, every week or every other week from a day he gives, or the dates his council printed; a move he
 *    tells it; the bank holidays of England and Wales for the rule "collections slip a day after one";
 *  - rent or a mortgage, a boiler or smoke-alarm service, an insurance date, a number in the house's address book, a room's
 *    things for insurance (as CSV), the council tax band's public ratios, the planning data's questions and answers.
 * Pure: no storage, no network. The brain (apps/edge/src/tools/homeadmin.ts) and the phone (features/homeadmin) share it.
 */
import { addDays, addMonths, dayWords, daysBetween, mondayOf, pounds, prettyDay, weekdayOf } from './packs';
import { tidyPhone } from './people';

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
/** “CURRYS” → “Currys”; a name already in mixed case stays as printed. */
const nice = (s: string) => (s.length > 3 && s === s.toUpperCase() ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : s);
const pad2 = (n: number) => String(n).padStart(2, '0');
const MON = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec';
const monthNo = (s: string) => ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(s.slice(0, 3).toLowerCase()) + 1;
const ymdOf = (y: number, m: number, d: number): string => (m >= 1 && m <= 12 && d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate() ? `${y}-${pad2(m)}-${pad2(d)}` : '');
const fullYear = (y: number) => (y < 100 ? 2000 + y : y);

/** Every date in some text, where it starts, and whether it carried a year ("14 Nov", "Nov 14th 2026", "14/11/2026", "2026-11-14"). */
export function datesIn(text: string, today: string): { ymd: string; at: number; end: number; year: boolean }[] {
  const out: { ymd: string; at: number; end: number; year: boolean }[] = [];
  const thisYear = +today.slice(0, 4);
  const push = (m: RegExpExecArray, ymd: string, year: boolean) => ymd && out.push({ ymd, at: m.index, end: m.index + m[0].length, year });
  for (const m of text.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?(${MON})[a-z]*\\.?(?:,?\\s*'?(\\d{4}|\\d{2}(?!\\d|\\s*(?:${MON})))\\b)?`, 'gi'))) push(m, ymdOf(m[3] ? fullYear(+m[3]) : thisYear, monthNo(m[2]!), +m[1]!), !!m[3]);
  for (const m of text.matchAll(new RegExp(`\\b(${MON})[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{4}))?\\b`, 'gi'))) push(m, ymdOf(m[3] ? +m[3] : thisYear, monthNo(m[1]!), +m[2]!), !!m[3]);
  for (const m of text.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/g)) push(m, ymdOf(fullYear(+m[3]!), +m[2]!, +m[1]!), true);
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) push(m, ymdOf(+m[1]!, +m[2]!, +m[3]!), true);
  return out.sort((a, b) => a.at - b.at).filter((x, i, a) => i === 0 || x.at >= a[i - 1]!.end);
}

// ---------------------------------------------------------------- a bill, read from the text of a photo

export type BillKind = 'gas' | 'electricity' | 'gas and electricity' | 'water' | 'broadband' | 'phone' | 'tv licence' | 'council tax' | 'insurance' | 'rent' | 'mortgage' | 'other';
const SUPPLIERS: [RegExp, string, BillKind][] = [
  [/british gas/i, 'British Gas', 'gas and electricity'], [/octopus energy/i, 'Octopus Energy', 'gas and electricity'], [/\be\.?on next\b|\be\.?on\b energy/i, 'E.ON Next', 'gas and electricity'],
  [/\bedf\b/i, 'EDF', 'gas and electricity'], [/scottish ?power/i, 'ScottishPower', 'gas and electricity'], [/\bovo energy\b/i, 'OVO Energy', 'gas and electricity'],
  [/\bsse\b|so energy/i, 'SSE', 'gas and electricity'], [/utility warehouse/i, 'Utility Warehouse', 'gas and electricity'], [/shell energy/i, 'Shell Energy', 'gas and electricity'],
  [/severn trent/i, 'Severn Trent', 'water'], [/thames water/i, 'Thames Water', 'water'], [/united utilities/i, 'United Utilities', 'water'], [/yorkshire water/i, 'Yorkshire Water', 'water'],
  [/anglian water/i, 'Anglian Water', 'water'], [/southern water/i, 'Southern Water', 'water'], [/south staffs? water/i, 'South Staffs Water', 'water'], [/welsh water|d[ŵw]r cymru/i, 'Welsh Water', 'water'],
  [/virgin media/i, 'Virgin Media', 'broadband'], [/\bbt (?:group|broadband|plc|home|business)\b|british telecom/i, 'BT', 'broadband'], [/talk ?talk/i, 'TalkTalk', 'broadband'], [/plusnet/i, 'Plusnet', 'broadband'],
  [/\bsky (?:uk|broadband|tv|digital|talk|mobile|q)\b/i, 'Sky', 'broadband'], [/vodafone/i, 'Vodafone', 'phone'], [/\bee limited\b|\bee ltd\b/i, 'EE', 'phone'], [/\bo2\b/i, 'O2', 'phone'], [/giffgaff/i, 'giffgaff', 'phone'],
  [/tv licen[cs]ing|tv licen[cs]e/i, 'TV Licensing', 'tv licence'],
  [/aviva|direct line|admiral|churchill|hastings|axa\b|\blv=|co-?op insurance|saga\b|zurich|more than/i, '', 'insurance'],
];
export interface BillRead {
  supplier: string;
  kind: BillKind;
  amount: number | null;
  credit: boolean;
  /** YYYY-MM-DD or ''. */
  due: string;
  from: string;
  to: string;
  /** What it took from where, and what it could not find: said back to him, because OCR text can be wrong. */
  notes: string[];
}
const moneyTok = (s: string): number => Number(s.replace(/[£,\s]/g, ''));
const fixOcr = (t: string) => t.replace(/£\s?([0-9OolI,.]+)/g, (_, n: string) => `£${n.replace(/[Oo]/g, '0').replace(/[lI]/g, '1')}`);
/** The supplier, amount, due day and period in the text of a bill. Nothing is invented: what is not found is said. */
export function readBill(raw: string, today: string): BillRead {
  const text = fixOcr(raw.replace(/\r/g, ''));
  const flat = clean(text);
  const notes: string[] = [];
  let supplier = '';
  let kind: BillKind | '' = '';
  for (const [re, name, k] of SUPPLIERS) {
    const m = re.exec(flat);
    if (m) {
      supplier = name || cap(m[0].toLowerCase().trim());
      kind = k;
      break;
    }
  }
  if (!supplier) {
    const council = /\b([A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)*) (?:City|Borough|County|District|Metropolitan Borough) Council\b/.exec(flat);
    if (council || /council tax/i.test(flat)) {
      supplier = council ? `${council[1]} Council` : 'Your council';
      kind = 'council tax';
    }
  }
  if (!supplier) {
    const first = text.split('\n').map((l) => clean(l)).find((l) => /[A-Za-z]{3}/.test(l) && l.length <= 40);
    if (first) {
      supplier = cap(nice(first.replace(/[^\w &'.-]/g, '').trim()));
      notes.push('the supplier is the first line of the bill: check it');
    }
  }
  if (!kind) {
    const w = flat.toLowerCase();
    kind = /\bgas\b/.test(w) && /electric|kwh/.test(w) ? 'gas and electricity' : /electric|kwh/.test(w) ? 'electricity' : /\bgas\b/.test(w) ? 'gas' : /water|sewerage/.test(w) ? 'water' : /broadband|fibre|wi-?fi/.test(w) ? 'broadband' : /council tax/.test(w) ? 'council tax' : /insurance|policy/.test(w) ? 'insurance' : /mobile|sim\b|airtime/.test(w) ? 'phone' : 'other';
  }
  const label = /(?:amount (?:due|to pay|payable)|total (?:amount )?(?:due|to pay|payable)|balance (?:due|to pay)|please pay|(?:you(?:'ll| will)?|to) pay|new balance|total due|pay this amount|payment due|(?:your )?(?:bill|payment) (?:is|comes to))[^£\d\n-]{0,30}(-?£?\s?\d[\d,]*(?:\.\d{1,2})?)/i.exec(flat);
  let amount: number | null = null;
  let credit = false;
  if (label) {
    amount = moneyTok(label[1]!);
    notes.push('the amount is the one next to “' + clean(label[0]).replace(/[^A-Za-z ].*$/, '').trim().toLowerCase() + '”');
    credit = /credit|\bCR\b/.test(flat.slice(Math.max(0, label.index - 20), label.index + label[0].length + 12));
  } else {
    const all = [...flat.matchAll(/£\s?(\d[\d,]*(?:\.\d{2})?)/g)].map((m) => moneyTok(m[1]!)).filter((n) => n > 0);
    if (all.length) {
      amount = Math.max(...all);
      notes.push('no “amount due” found, so the largest amount on the page: check it');
    }
  }
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
    credit = true;
    amount = Math.abs(Number.isFinite(amount) ? amount : 0);
  }
  let due = '';
  const dueLabel = /(?:pay(?:ment)? (?:by|before|on)|payment due(?: date)?|(?:next )?instalment due|due date|date due|due (?:by|on|before)|direct debit (?:will be )?(?:taken|collected|paid|due)(?: on)?|collected on|payable by)\s*:?\s*/gi;
  const rows = text.split('\n').map((l) => clean(l));
  find: for (const [i, row] of rows.entries()) {
    for (const m of row.matchAll(dueLabel)) {
      const rest = row.slice(m.index! + m[0].length);
      const d = datesIn(rest.trim() ? rest : rows[i + 1] ?? '', today)[0];
      if (d) {
        due = d.ymd;
        break find;
      }
    }
  }
  if (!due) notes.push('no due date found');
  let from = '';
  let to = '';
  const per = /(?:billing period|bill period|statement period|period|charges? for|bill for|covering|your bill covers|from)\b/i.exec(flat);
  const span = per ? datesIn(flat.slice(per.index, per.index + 90), today) : [];
  if (span.length >= 2) {
    from = span[0]!.ymd;
    to = span[1]!.ymd;
    if (!span[0]!.year && span[1]!.year && from > to) from = `${+to.slice(0, 4) - 1}${from.slice(4)}`;
    if (!span[0]!.year && span[1]!.year && from.slice(0, 4) !== to.slice(0, 4) && from <= to) from = `${to.slice(0, 4)}${from.slice(4)}`;
  }
  return { supplier: supplier || 'Unknown supplier', kind: kind as BillKind, amount, credit, due, from, to, notes };
}

export interface Bill {
  id: string;
  supplier: string;
  kind: BillKind;
  amount: number;
  due: string;
  from: string;
  to: string;
  /** The day it was kept. */
  at: string;
  paid?: string;
  /** The statement said the account is in credit by this much: nothing to pay, and not counted as spend. */
  credit?: number;
}
const KIND_WORDS: [RegExp, BillKind[]][] = [
  [/\belectric\w*|\bkwh\b|\blights?\b/i, ['electricity', 'gas and electricity']], [/\bgas\b|\bheating\b/i, ['gas', 'gas and electricity']], [/\benergy\b|\butilit\w+/i, ['gas', 'electricity', 'gas and electricity']],
  [/\bwater\b|\bsewerage\b/i, ['water']], [/broadband|internet|wi-?fi/i, ['broadband']], [/\bphone\b|\bmobile\b/i, ['phone']], [/council tax/i, ['council tax']], [/insurance/i, ['insurance']], [/\btv\b|licen[cs]e/i, ['tv licence']],
];
/** "how much was the gas this year?" → the bills it means, the sum, the count. */
export function billTotal(bills: Bill[], question: string, year: string): { label: string; total: number; list: Bill[] } | null {
  const kinds = new Set<BillKind>();
  for (const [re, ks] of KIND_WORDS) if (re.test(question)) for (const k of ks) kinds.add(k);
  const named = bills.filter((b) => b.supplier && new RegExp(`\\b${b.supplier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(question));
  const mine = (named.length ? named : bills.filter((b) => kinds.has(b.kind))).filter((b) => !b.credit && (b.due || b.to || b.at).startsWith(year));
  if (!mine.length) return null;
  const label = named.length ? named[0]!.supplier : [...new Set(mine.map((b) => b.kind))].join(' and ');
  return { label, total: Math.round(mine.reduce((s, b) => s + b.amount, 0) * 100) / 100, list: mine.sort((a, b) => (a.due || a.at).localeCompare(b.due || b.at)) };
}
export const billLine = (b: Bill, today: string): string => {
  if (b.credit) return `${b.supplier} in credit by ${pounds(b.credit)} (nothing to pay)`;
  const n = b.due ? daysBetween(today, b.due) : null;
  return `${b.supplier} ${pounds(b.amount)}${b.due ? ` due ${prettyDay(b.due, today.slice(0, 4))}${n === 0 ? ' (today)' : n === 1 ? ' (tomorrow)' : n !== null && n < 0 ? ` (${-n} day${n === -1 ? '' : 's'} overdue)` : n !== null && n <= 14 ? ` (in ${n} days)` : ''}` : ' (no due date)'}`;
};

// ---------------------------------------------------------------- a receipt, for a warranty

export interface Receipt {
  store: string;
  /** YYYY-MM-DD or ''. */
  date: string;
  total: number | null;
  /** The first line that looks like a thing with a price: a guess, said so. */
  item: string;
}
/** The shop, the day, the total and a likely item in the text of a receipt photo. */
export function readReceipt(raw: string, today: string): Receipt {
  const lines = fixOcr(raw).split('\n').map((l) => clean(l)).filter(Boolean);
  const flat = lines.join(' ');
  const store = lines.find((l) => /[A-Za-z]{3}/.test(l) && l.length <= 36 && !/receipt|vat|tel|www\.|tax invoice/i.test(l)) ?? '';
  const tot = /(?:total|amount|balance due|to pay)[^£\d]{0,14}£?\s?(\d[\d,]*\.\d{2})/i.exec(flat);
  const skip = /total|vat|change|card|visa|mastercard|thank|receipt|tel\b|www|date|time|balance|cash|subtotal|items?\b|store|till|vat no|invoice|order/i;
  const item = lines.find((l) => /[A-Za-z]{4}/.test(l) && /£?\s?\d+\.\d{2}\s*$/.test(l) && !skip.test(l));
  return {
    store: cap(nice(store.replace(/[^\w &'.-]/g, ''))).slice(0, 36),
    date: datesIn(flat, today)[0]?.ymd ?? '',
    total: tot ? moneyTok(tot[1]!) : null,
    item: item ? cap(item.replace(/£?\s?\d+\.\d{2}\s*$/, '').replace(/^\d+\s*x?\s*/i, '').trim().toLowerCase()).slice(0, 50) : '',
  };
}

// ---------------------------------------------------------------- a meter

export interface MeterRead {
  value: number;
  unit: 'kWh' | 'm³' | '';
  kind: 'electricity' | 'gas' | 'water' | '';
  note: string;
}
/** The reading in some text: spaced digits joined (OCR splits a dial), the longest plausible run, the unit and so the kind when it says. */
export function readMeter(raw: string): MeterRead | null {
  const t = raw.replace(/[Oo](?=\d)|(?<=\d)[Oo]/g, '0').replace(/(?<=\d)[lI](?=\d)/g, '1');
  const joined = t.replace(/(\d)\s(?=\d)/g, '$1');
  const cands = [...joined.matchAll(/\b(\d{3,8})(?:[.,](\d{1,3}))?\b/g)].map((m) => ({ s: m[0], v: Number(`${m[1]}${m[2] ? `.${m[2]}` : ''}`), len: m[1]!.length }));
  if (!cands.length) return null;
  const best = cands.sort((a, b) => b.len - a.len)[0]!;
  const w = raw.toLowerCase();
  const unit = /kwh|kw\.h/.test(w) ? 'kWh' : /m3|m³|cubic/.test(w) ? 'm³' : '';
  const kind = /electric|kwh|economy ?7/.test(w) ? 'electricity' : /\bgas\b/.test(w) ? 'gas' : /water/.test(w) ? 'water' : unit === 'kWh' ? 'electricity' : '';
  return { value: best.v, unit, kind, note: cands.length > 1 ? `the longest run of digits of ${cands.length} I could see (${cands.map((c) => c.s).slice(0, 4).join(', ')}): check it against the meter` : 'the only run of digits I could see: check it against the meter' };
}
export interface Reading {
  on: string;
  value: number;
}
/** Usage since the reading before: units, days and a daily average; a lower reading is not used (a dial that went round, or a misread). */
export function meterUsage(reads: Reading[]): { units: number; days: number; perDay: number; since: string } | 'lower' | null {
  const r = [...reads].sort((a, b) => a.on.localeCompare(b.on));
  if (r.length < 2) return null;
  const a = r[r.length - 2]!;
  const b = r[r.length - 1]!;
  if (b.value < a.value) return 'lower';
  const days = Math.max(1, daysBetween(a.on, b.on));
  const units = Math.round((b.value - a.value) * 10) / 10;
  return { units, days, perDay: Math.round((units / days) * 10) / 10, since: a.on };
}

// ---------------------------------------------------------------- bin days

export interface Bin {
  id: string;
  name: string;
  /** 0 = Sunday. Unused when `dates` lists the days. */
  weekday: number;
  every: 1 | 2 | 4;
  /** A day he knows it is collected, so "every other week" falls on the right weeks. */
  anchor?: string;
  /** The days the council printed: used as they are. */
  dates?: string[];
}
export interface BinBook {
  bins: Bin[];
  /** A collection that moved: the usual day → the day it is. */
  moves: { from: string; to: string }[];
  /** "collections run a day late after a bank holiday" — his rule, told once. */
  slip: boolean;
}
export const emptyBins = (): BinBook => ({ bins: [], moves: [], slip: false });
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const dayIdx = (w: string) => WEEKDAYS.findIndex((d) => d.startsWith(w.toLowerCase().slice(0, 3)));
const BIN_NAMES: [RegExp, string][] = [
  [/\b(?:recycl\w*|blue bin|blue lid)\b/i, 'recycling'], [/\b(?:garden|green waste|brown bin)\b/i, 'garden waste'], [/\b(?:food|caddy)\b/i, 'food waste'],
  [/\b(?:general|rubbish|refuse|black bin|landfill|household|grey bin|bins?)\b/i, 'rubbish'],
];
const binName = (s: string): string => BIN_NAMES.find(([re]) => re.test(s))?.[1] ?? '';
/** Easter Sunday (the anonymous Gregorian algorithm). */
export function easter(y: number): string {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${y}-${pad2(month)}-${pad2(day)}`;
}
/** The bank holidays of England and Wales in a year, a weekend one moved on as the law does. */
export function bankHolidays(y: number): string[] {
  const out: string[] = [];
  const next = (d: string, taken: string[]) => {
    let x = d;
    while (weekdayOf(x) === 0 || weekdayOf(x) === 6 || taken.includes(x)) x = addDays(x, 1);
    return x;
  };
  const nthMon = (m: number, last: boolean, n = 1) => {
    if (!last) {
      let d = `${y}-${pad2(m)}-01`;
      while (weekdayOf(d) !== 1) d = addDays(d, 1);
      return addDays(d, (n - 1) * 7);
    }
    let d = `${y}-${pad2(m)}-${pad2(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
    while (weekdayOf(d) !== 1) d = addDays(d, -1);
    return d;
  };
  out.push(next(`${y}-01-01`, out));
  const e = easter(y);
  out.push(addDays(e, -2), addDays(e, 1), nthMon(5, false), nthMon(5, true), nthMon(8, true));
  out.push(next(`${y}-12-25`, out));
  out.push(next(`${y}-12-26`, out));
  return out.sort();
}
/** A collection day, moved on a day if his rule says a bank holiday earlier in that week slips it (Friday's goes to Saturday). */
export function slipped(ymd: string, slip: boolean): string {
  if (!slip) return ymd;
  const mon = addDays(ymd, -((weekdayOf(ymd) + 6) % 7));
  const hols = [...bankHolidays(+ymd.slice(0, 4)), ...bankHolidays(+ymd.slice(0, 4) + 1), ...bankHolidays(+ymd.slice(0, 4) - 1)];
  return hols.some((h) => h >= mon && h <= ymd) ? addDays(ymd, 1) : ymd;
}
/** The next days this bin goes out (the day it is collected), from `from` (today counts), moves and the slip rule applied. */
export function binDays(bin: Bin, book: Pick<BinBook, 'moves' | 'slip'>, from: string, count = 3): string[] {
  let usual: string[] = [];
  if (bin.dates?.length) usual = bin.dates.filter((d) => d >= addDays(from, -7)).sort();
  else if (bin.every === 1 || bin.anchor) {
    let d = addDays(from, -7);
    while (weekdayOf(d) !== bin.weekday) d = addDays(d, 1);
    for (let n = 0; n < 90 && usual.length < count + 4; n++, d = addDays(d, 7)) {
      const weeks = bin.anchor ? Math.round(daysBetween(bin.anchor, d) / 7) : 0;
      if (bin.every === 1 || ((weeks % bin.every) + bin.every) % bin.every === 0) usual.push(d);
    }
  }
  return usual
    .map((d) => book.moves.find((m) => m.from === d)?.to ?? slipped(d, book.slip))
    .filter((d) => d >= from)
    .sort()
    .slice(0, count);
}
/** Every bin that needs a start day he has not given ("every other week" from when?). */
export const needsAnchor = (b: Bin): boolean => b.every > 1 && !b.anchor && !b.dates?.length;
/** "bins are Tuesday, recycling every other Tuesday, next recycling 10 November" → the bins. */
export function parseBins(words: string, today: string): Bin[] {
  const out: Bin[] = [];
  const clauses = words.split(/[;.]|,(?!\d)|\band\b(?=\s+(?:the\s+)?(?:recycl|garden|food|green|blue|brown|black|grey|bins?|rubbish))/i).map((c) => clean(c)).filter(Boolean);
  for (const c of clauses) {
    const wd = /\b(sun|mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat)(?:day)?s?\b/i.exec(c);
    if (!wd) continue;
    const every = /\bevery (?:other|second|2nd|alternate|fortnight)|\bfortnightly|\balternate\b|\bevery two weeks\b/i.test(c) ? 2 : /\bevery (?:four|4)\b|\bfour.weekly\b/i.test(c) ? 4 : 1;
    const name = binName(c) || (out.length ? 'bin' : 'rubbish');
    const anchor = dayWords(c.replace(wd[0], ' '), today);
    out.push({ id: name.replace(/\W+/g, '-'), name, weekday: dayIdx(wd[1]!), every: every as 1 | 2 | 4, ...(anchor && every > 1 ? { anchor: weekdayOf(anchor) === dayIdx(wd[1]!) ? anchor : addDays(anchor, (dayIdx(wd[1]!) - weekdayOf(anchor) + 7) % 7) } : {}) });
  }
  // "next recycling is 10 November" / "the next garden collection is on the 17th": a start day for a bin that has none
  for (const m of words.matchAll(/\bnext\s+([a-z ]{3,24}?)\s+(?:collection\s+)?(?:is|will be|on)\s+(?:on\s+)?([^.;,]+)/gi)) {
    const nm = binName(m[1]!);
    const d = dayWords(m[2]!, today);
    const b = out.find((x) => x.name === nm) ?? (nm ? undefined : out.find((x) => x.every > 1 && !x.anchor));
    if (b && d) b.anchor = d;
  }
  return out;
}
/** A council's page pasted in: each bin's dates, from lines like “Recycling: 3 Nov, 17 Nov” or “Tuesday 10 November 2026 – Black bin”. */
export function parseBinDates(text: string, today: string): Bin[] {
  const by = new Map<string, Set<string>>();
  let cur = '';
  for (const line of text.split(/\n+/)) {
    const nm = binName(line);
    if (nm) cur = nm;
    const ds = datesIn(line, today).map((d) => (d.year ? d.ymd : d.ymd < addDays(today, -60) ? `${+d.ymd.slice(0, 4) + 1}${d.ymd.slice(4)}` : d.ymd));
    if (cur && ds.length) by.set(cur, new Set([...(by.get(cur) ?? []), ...ds]));
  }
  return [...by].map(([name, set]) => {
    const dates = [...set].sort();
    return { id: name.replace(/\W+/g, '-'), name, weekday: weekdayOf(dates[0]!), every: 1 as const, dates };
  });
}
/** “bins move to Wednesday this week”, “recycling is on Saturday 26th this time” → the move, for the week of the usual day. */
export function parseMove(words: string, bin: Bin, from: string): { from: string; to: string } | null {
  const m = /\b(?:moved?|moves|moving|shifted?|late|put back|brought forward|changed?)\b[^.]*?\b(?:to|until|on)\s+([^.;,]+)/i.exec(words);
  if (!m) return null;
  let to = dayWords(m[1]!, from);
  if (!to) {
    const w = /\b(sun|mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat)(?:day)?\b/i.exec(m[1]!);
    if (w) to = addDays(mondayOf(from), (dayIdx(w[1]!) + 6) % 7);
  }
  // the usual collection in the week of the day it moved to
  const usual = to ? binDays(bin, { moves: [], slip: false }, addDays(to, -6), 1)[0] ?? '' : '';
  return to && usual && mondayOf(usual) === mondayOf(to) ? { from: usual, to } : null;
}
export const BIN_WORDS = (b: Bin): string => `${cap(b.name)}: ${b.dates?.length ? 'on the days your council printed' : b.every === 1 ? `every ${cap(WEEKDAYS[b.weekday]!)}` : `every ${b.every === 2 ? 'other' : 'fourth'} ${cap(WEEKDAYS[b.weekday]!)}${b.anchor ? ` (next from ${prettyDay(b.anchor)})` : ' (I need one day it is collected)'}`}`;

// ---------------------------------------------------------------- rent, services, insurance, the house's book

export interface Rent {
  kind: 'rent' | 'mortgage';
  /** Day of the month, 1–31. */
  day: number;
  amount?: number;
}
/** “rent is due on the 1st, £750” / “mortgage £1,150 on the 28th”. */
export function parseRent(words: string): Rent | null {
  const kind = /\bmortgage\b/i.test(words) ? 'mortgage' : /\brent\b/i.test(words) ? 'rent' : null;
  const day = /\b(?:on |due |the )?(\d{1,2})(?:st|nd|rd|th)\b/i.exec(words) ?? /\b(?:on|due|day)\s+(\d{1,2})\b/i.exec(words);
  if (!kind || !day || +day[1]! < 1 || +day[1]! > 31) return null;
  const amt = /£\s?(\d[\d,]*(?:\.\d{1,2})?)/.exec(words);
  return { kind, day: +day[1]!, ...(amt ? { amount: Number(amt[1]!.replace(/,/g, '')) } : {}) };
}
/** The next day the rent or mortgage falls (today counts); a day past the month's end is its last day. */
export function rentNext(r: Rent, today: string): string {
  const y = +today.slice(0, 4);
  const m = +today.slice(5, 7);
  const dim = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  const here = `${y}-${pad2(m)}-${pad2(Math.min(r.day, dim(y, m)))}`;
  if (here >= today) return here;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${pad2(nm)}-${pad2(Math.min(r.day, dim(ny, nm)))}`;
}
export interface Service {
  id: string;
  what: string;
  /** The day it is next due. */
  next: string;
  /** Months between. */
  every: number;
  last?: string;
}
const SERVICES: [RegExp, string, number][] = [
  [/boiler/i, 'Boiler service', 12], [/gas safety|landlord gas/i, 'Gas safety check', 12], [/smoke (?:alarm|detector)s?|fire alarm/i, 'Smoke alarm test', 12], [/carbon monoxide|co alarm/i, 'Carbon monoxide alarm check', 12],
  [/chimney|flue/i, 'Chimney sweep', 12], [/eicr|electrical (?:safety|check|inspection)/i, 'Electrical safety check', 60], [/fire extinguisher/i, 'Fire extinguisher check', 12], [/septic/i, 'Septic tank emptying', 12], [/\bservice\b/i, 'Service', 12],
];
/** “boiler service is due 14 March” / “smoke alarms tested 1 October” (next one a year on) → a service. */
export function parseService(words: string, today: string): Omit<Service, 'id'> | null {
  const hit = SERVICES.find(([re]) => re.test(words));
  if (!hit) return null;
  const d = dayWords(words, today);
  if (!d) return null;
  const done = /\b(?:was|were|had|done|tested|serviced|checked|swept|last|did)\b/i.test(words) && !/\b(?:due|next|is on|renews?)\b/i.test(words);
  const ev = /\bevery (\d+) (year|month)s?\b/i.exec(words);
  const every = ev ? (/year/i.test(ev[2]!) ? 12 : 1) * +ev[1]! : hit[2];
  const what = hit[1] === 'Service' ? cap(clean(words.replace(/\b(?:is|was|due|next|on|the|my|service|serviced|done|last|had)\b/gi, ' ').replace(/\b\d.*$/, '')).slice(0, 30)) + ' service' : hit[1]!;
  return done ? { what, next: addMonths(d, every), every, last: d } : { what, next: d, every };
}
export interface Insurance {
  id: string;
  /** “Dad’s car”, “my car”, “the house”. */
  whose: string;
  plate?: string;
  on: string;
}
/** The next day an insurance date he gave comes round (it renews yearly). */
export function insuranceNext(i: Insurance, today: string): string {
  let d = i.on;
  while (d < today) d = addMonths(d, 12);
  return d;
}
export interface Entry {
  id: string;
  role: string;
  name: string;
  phone?: string;
  email?: string;
  note?: string;
}
const ROLES = ['plumber', 'electrician', 'landlord', 'letting agent', 'gas engineer', 'boiler engineer', 'handyman', 'builder', 'locksmith', 'cleaner', 'gardener', 'roofer', 'decorator', 'carpenter', 'pest control', 'council', 'neighbour', 'caretaker', 'managing agent', 'insurer', 'broadband', 'energy supplier', 'water company'];
/** “the plumber is Dave on 07700 900123”, “landlord: Mrs Patel 0121 496 0000”, “the council’s number is 0121 303 1111”. */
export function parseEntry(words: string): Omit<Entry, 'id'> | null {
  const w = clean(words);
  const role = ROLES.find((r) => new RegExp(`\\b${r}(?:'s|’s)?\\b`, 'i').test(w));
  const phone = /(\+?\d[\d\s()-]{7,15}\d)/.exec(w.replace(/£\s?[\d,.]+/g, ''));
  const email = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.exec(w);
  if (!role || (!phone && !email)) return null;
  let rest = w.replace(phone?.[0] ?? '', ' ').replace(email?.[0] ?? '', ' ');
  rest = rest.replace(new RegExp(`\\b(?:my|the|our)?\\s*${role}(?:'s|’s)?\\b`, 'i'), ' ').replace(/\b(?:is|are|number|phone|mobile|email|tel|on|at|call|contact|details|:|=|-)\b|[:=,]/gi, ' ');
  const name = clean(rest).replace(/^(?:called|named)\s+/i, '');
  return { role, name: cap(name).slice(0, 60) || cap(role), ...(phone ? { phone: tidyPhone(phone[1]!) } : {}), ...(email ? { email: email[0].toLowerCase() } : {}) };
}
export const entryLine = (e: Entry): string => `${cap(e.role)}: ${e.name === cap(e.role) ? '' : `${e.name}, `}${[e.phone, e.email].filter(Boolean).join(', ')}${e.note ? ` (${e.note})` : ''}`;

// ---------------------------------------------------------------- a room's things, for insurance

export interface Thing {
  id: string;
  room: string;
  name: string;
  qty: number;
  value?: number;
}
/** “a 55 inch TV worth £400, 2 armchairs, laptop £900” → things (a count in front, a value after “worth” or a £). */
export function parseThings(words: string): { name: string; qty: number; value?: number }[] {
  return words
    .split(/,|;|\n|\band\b(?=\s+(?:a |an |\d))/i)
    .map((s) => clean(s))
    .filter((s) => s.length > 1)
    .map((s) => {
      const v = /(?:worth|value[d]? at|for|~|about)?\s*£\s?(\d[\d,]*(?:\.\d{1,2})?)/i.exec(s);
      const name = clean((v ? s.replace(v[0], ' ') : s).replace(/^\s*(?:add |put |got |i have |there(?:'s| is| are) )/i, '').trim().replace(/^(?:a|an|the|some)\s+/i, ''));
      const q = /^(\d{1,2})\s+(?!inch|in\b|cm\b|mm\b)(.+)$/i.exec(name);
      return { name: cap((q ? q[2]! : name).replace(/[.]+$/, '')).slice(0, 60), qty: q ? +q[1]! : 1, ...(v ? { value: Number(v[1]!.replace(/,/g, '')) } : {}) };
    })
    .filter((t) => t.name.length > 1);
}
const csvCell = (s: string | number) => (/[",\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
/** The inventory as CSV for an insurer: room, item, quantity, value (blank when not given). */
export function inventoryCsv(things: Thing[]): string {
  return ['Room,Item,Quantity,Value (GBP)', ...things.map((t) => [t.room, t.name, t.qty, t.value ?? ''].map(csvCell).join(','))].join('\n');
}
/** On-phone detector labels → things he can confirm (“chair” ×4 → “Chair” qty 4); the ones that are not belongings left out. */
export function thingsFromLabels(labels: string[]): { name: string; qty: number }[] {
  const skip = /^(?:person|dog|cat|bird|horse|car|bus|truck|bicycle|motorcycle|train|airplane|boat)$/i;
  const n = new Map<string, number>();
  for (const l of labels) if (!skip.test(l)) n.set(l.toLowerCase(), (n.get(l.toLowerCase()) ?? 0) + 1);
  return [...n].map(([name, qty]) => ({ name: cap(name.replace(/_/g, ' ').replace(/^couch$/, 'sofa').replace(/^tv$/, 'TV').replace(/^dining table$/, 'dining table')), qty }));
}

// ---------------------------------------------------------------- council tax and the register: public facts only

/** The band's share of Band D in England (the 1991 values: A 6/9 … H 18/9). Wales has a band I and other ratios; Scotland its own. */
export const BAND_RATIOS: Record<string, number> = { A: 6 / 9, B: 7 / 9, C: 8 / 9, D: 1, E: 11 / 9, F: 13 / 9, G: 15 / 9, H: 2 };
export function bandWords(band: string): string {
  const b = band.toUpperCase();
  const r = BAND_RATIOS[b];
  return r ? `Band ${b} pays ${Math.round(r * 100)}% of the Band D rate (England; Wales and Scotland differ)` : `Band ${b}`;
}
export const parseBand = (words: string): string => (/\bband\s+([A-Ha-h])\b/i.exec(words)?.[1] ?? /\b(?:is|in)\s+([A-H])\b/.exec(words)?.[1] ?? '').toUpperCase();
export const COUNCIL_TAX_LOOKUP = 'https://www.tax.service.gov.uk/check-council-tax-band/search';
export const REGISTER_TO_VOTE = 'https://www.gov.uk/register-to-vote';
export const FIND_COUNCIL = 'https://www.gov.uk/find-local-council';

// ---------------------------------------------------------------- planning applications near home

/** A circle of `r` metres as a polygon in WKT (longitude then latitude), the way planning.data.gov.uk takes a shape. */
export function circleWkt(lat: number, lon: number, r: number, n = 12): string {
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const a = ((i % n) * 2 * Math.PI) / n;
    pts.push(`${(lon + (r * Math.sin(a)) / (111_320 * Math.cos((lat * Math.PI) / 180))).toFixed(6)} ${(lat + (r * Math.cos(a)) / 110_540).toFixed(6)}`);
  }
  return `POLYGON((${pts.join(',')}))`;
}
/** “within 300 m”, “half a mile”, “1 km” → metres (default 500, at most 2,000). */
export function radiusFrom(words: string): number {
  const m = /(\d+(?:\.\d+)?|half an?|a quarter|a)\s*(m\b|metres?|meters?|km|kilomet\w+|miles?|mi\b)/i.exec(words);
  if (!m) return 500;
  const n = /half/i.test(m[1]!) ? 0.5 : /quarter/i.test(m[1]!) ? 0.25 : /^a$/i.test(m[1]!) ? 1 : Number(m[1]);
  const unit = m[2]!.toLowerCase();
  const metres = /^(?:m|metre|meter)/.test(unit) && !/^mi/.test(unit) ? n : /^k/.test(unit) ? n * 1000 : n * 1609.34;
  return Math.max(100, Math.min(2000, Math.round(metres)));
}
export interface Application {
  id: string;
  ref: string;
  text: string;
  status: string;
  url: string;
  lat?: number;
  lon?: number;
}
/** planning.data.gov.uk's entities as applications (its field names; a reference, a description, a status, a link). */
export function parsePlanning(j: unknown): Application[] {
  const es = (j as { entities?: unknown })?.entities;
  if (!Array.isArray(es)) return [];
  return (es as Record<string, unknown>[]).map((e): Application => {
    const pt = /POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i.exec(String(e.point ?? e.geometry ?? ''));
    return {
      id: String(e.entity ?? e.reference ?? ''),
      ref: String(e.reference ?? e.name ?? '').slice(0, 40),
      text: clean(String(e.description ?? e.name ?? 'No description')).slice(0, 160),
      status: String(e['planning-application-status'] ?? e.status ?? e.decision ?? '').slice(0, 40),
      url: String(e['documentation-url'] ?? e.url ?? ''),
      ...(pt ? { lon: Number(pt[1]), lat: Number(pt[2]) } : {}),
    };
  }).filter((a) => a.id);
}
/** What the national data lists at a point (conservation area, listed building…), one line each. */
export function constraintsAt(j: unknown): string[] {
  const es = (j as { entities?: unknown })?.entities;
  if (!Array.isArray(es)) return [];
  const label: Record<string, string> = { 'conservation-area': 'a conservation area', 'article-4-direction-area': 'an Article 4 direction area', 'tree-preservation-zone': 'a tree preservation zone', 'listed-building-outline': 'a listed building’s outline' };
  return [...new Set((es as Record<string, unknown>[]).map((e) => `${clean(String(e.name ?? 'unnamed'))} (${label[String(e.dataset)] ?? String(e.dataset)})`))];
}
/** The council from a postcodes.io answer (forward or reverse). */
export function councilOf(j: unknown): { name: string; code: string } | null {
  const r = (j as { result?: unknown })?.result;
  const x = (Array.isArray(r) ? r[0] : r) as { admin_district?: unknown; codes?: { admin_district?: unknown } } | undefined;
  return typeof x?.admin_district === 'string' && x.admin_district ? { name: x.admin_district, code: String(x.codes?.admin_district ?? '') } : null;
}

// ---------------------------------------------------------------- what is repeating on his statements

export interface SubLine {
  name: string;
  /** Pounds a month. */
  monthly: number;
  every: string;
  src: 'statements' | 'your list';
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
/** The money pack’s list and the subscriptions found on his statements, once each by name, as pounds a month. */
export function subLines(listed: { name: string; amount: number; every: 'week' | 'month' | 'year' }[], found: { name: string; amount: number; cadence: 'monthly' | 'yearly' }[]): { lines: SubLine[]; monthly: number } {
  const lines: SubLine[] = [];
  for (const s of listed) lines.push({ name: s.name, monthly: s.every === 'month' ? s.amount : s.every === 'year' ? s.amount / 12 : (s.amount * 52) / 12, every: s.every === 'month' ? 'monthly' : s.every === 'year' ? 'yearly' : 'weekly', src: 'your list' });
  for (const f of found) if (!lines.some((l) => norm(l.name).includes(norm(f.name).slice(0, 6)) || norm(f.name).includes(norm(l.name).slice(0, 6)))) lines.push({ name: f.name, monthly: f.cadence === 'monthly' ? f.amount : f.amount / 12, every: f.cadence, src: 'statements' });
  const monthly = Math.round(lines.reduce((s, l) => s + l.monthly, 0) * 100) / 100;
  return { lines: lines.sort((a, b) => b.monthly - a.monthly), monthly };
}

// ---------------------------------------------------------------- the phone's own phrases

export type HomeView = 'due' | 'bins' | 'bills' | 'meter' | 'things';
/** What the phone answers by opening the sheet, with no model (assistant/phrases.ts). */
export function homeAsked(text: string): HomeView | null {
  const t = text.trim().replace(/[’‘]/g, "'").replace(/[?!.]+$/, '');
  if (/^(?:what(?:'s| is)? due (?:at )?home|what(?:'s| is) due (?:in|round|around) the house|home admin|the house admin|what do i need to do at home)$/i.test(t)) return 'due';
  if (/^(?:when(?:'s| is| are) (?:the |my )?(?:bin|bins|bin day|recycling|rubbish)(?: day| collection)?(?: next| this week)?|which bin(?: is it| goes out)?(?: tonight| this week)?|bin day|is it (?:bin|recycling) day|what bin(?:s)? (?:goes? )?out(?: tonight| this week)?)$/i.test(t)) return 'bins';
  if (/^(?:my bills|bills due|what bills are due|what(?:'s| is) my next bill|upcoming bills)$/i.test(t)) return 'bills';
  if (/^(?:meter reading|take a meter reading|read the meter|submit a meter reading)$/i.test(t)) return 'meter';
  if (/^(?:home inventory|my inventory|list (?:the )?(?:things|contents) in (?:my|the) (?:house|home|room))$/i.test(t)) return 'things';
  return null;
}
