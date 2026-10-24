/**
 * SPENDING, the pure parts (no storage, no network; the brain's `apps/edge/src/spending.ts` keeps the rows):
 * a bank statement the owner downloaded himself (CSV from any UK bank) → rows (`readStatement`: the common
 * column shapes — date, description, one amount column or paid out / paid in, balance; a preamble before the
 * header, or no header at all), each filed in a category by rules (`categorise`: his own rules first, then a
 * built-in list of UK shops and words), the subscriptions in them (`findSubscriptions`: the same amount to the
 * same name every month or every year, with the yearly total and a price change), budgets in plain words
 * (`parseBudget`, `budgetStatus`), the month's view, the year's view, what changed since last month, and the
 * rows back out as CSV. No bank access, ever: Ghosty only reads what he is given.
 */

/** Said before the first import, and under ADD STATEMENT after it. */
export const PRIVACY =
  "No bank access, ever: download a statement (CSV) from your bank's app or website and add it here. It is kept in Ghosty's own storage and nowhere else. The rules sort almost every row on their own; only the shop names they can't place — never dates, amounts or your balance — go to a free online AI once per statement to be sorted.";

export const CATEGORIES = ['groceries', 'eating out', 'transport', 'bills', 'subscriptions', 'shopping', 'cash', 'income', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];
export const isCategory = (c: unknown): c is Category => typeof c === 'string' && (CATEGORIES as readonly string[]).includes(c);

/** One line of a statement. `a` is in pounds: negative is money out, positive money in. */
export interface Txn {
  /** YYYY-MM-DD */
  d: string;
  /** The description as the bank wrote it. */
  t: string;
  a: number;
  /** The balance after it, when the statement has one. */
  b?: number;
}

/** A kept row: its merchant key (`merchantKey`), its category and who filed it. */
export interface SpendRow extends Txn {
  k: string;
  c: Category;
  by: 'you' | 'rule' | 'model' | 'none';
}

// ---- CSV.

/** CSV text → cells (quotes, doubled quotes, CRLF, a byte-order mark; comma, semicolon or tab, whichever the first lines use). */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^﻿/, '');
  const head = s.split(/\r?\n/, 8).join('\n');
  const count = (ch: string) => head.split(ch).length - 1;
  const sep = count('\t') > count(',') && count('\t') > count(';') ? '\t' : count(';') > count(',') ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell.trim());
      if (row.some((c) => c)) rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c)) rows.push(row);
  return rows;
}

// ---- Dates and money.

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad2 = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => (y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad2(m)}-${pad2(d)}` : '');
const year4 = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y));

/** A UK statement's date → YYYY-MM-DD ('' when it is not one): 03/10/2026, 03/10/26, 03-10-2026, 2026-10-03(T…), 3 Oct 2026, 03-Oct-26. Day first, as UK banks write it. */
export function parseDate(s: string): string {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/);
  if (m) return ymd(+m[1]!, +m[2]!, +m[3]!);
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:\s.*)?$/);
  if (m) return ymd(year4(m[3]!), +m[2]!, +m[1]!);
  m = t.match(/^(\d{1,2})[\s-]([A-Za-z]{3,9})[\s-,]*(\d{2}|\d{4})$/);
  if (m) {
    const mon = MONTHS.indexOf(m[2]!.slice(0, 3).toLowerCase());
    return mon < 0 ? '' : ymd(year4(m[3]!), mon + 1, +m[1]!);
  }
  return '';
}

/** "£1,234.56", "-12.30", "(12.30)", "12.30 DR", "GBP 5" → pounds (NaN when there is no number). */
export function parseMoney(s: string): number {
  let t = s.trim().toUpperCase();
  if (!t) return NaN;
  let sign = 1;
  if (/^\(.*\)$/.test(t)) {
    sign = -1;
    t = t.slice(1, -1);
  }
  if (/\bDR$/.test(t)) sign = -1;
  t = t.replace(/\b(CR|DR|GBP)\b/g, '').replace(/[£,\s]/g, '');
  if (t.startsWith('+')) t = t.slice(1);
  if (t.startsWith('-')) {
    sign = -sign;
    t = t.slice(1);
  }
  if (!/^\d+(\.\d+)?$/.test(t)) return NaN;
  return Math.round(sign * Number(t) * 100) / 100;
}

// ---- Reading a statement.

export interface Statement {
  rows: Txn[];
  /** Which column shape it was: 'amount', 'paid out / paid in' or 'no header'. */
  shape: string;
  /** The bank, when the columns say so ('' otherwise). */
  bank: string;
  /** Lines that were not transactions (a total, a blank date). */
  skipped: number;
}

const COL = {
  date: /^(transaction |posting |posted |value )?date$|^date\b/,
  desc: [/^name$/, /counter ?party/, /^(transaction )?description$/, /^details?$/, /narrative/, /^payee$/, /^merchant/, /^memo$/, /^reference$/, /description|details/],
  amount: /^(amount|value|transaction amount)\b|^amount \(gbp\)$/,
  out: /^(debit|paid out|money out|out|withdrawals?|debit amount|payments?)\b/,
  in: /^(credit|paid in|money in|in|deposits?|credit amount|receipts?)\b/,
  balance: /balance/,
};

function bankOf(head: string[]): string {
  const has = (re: RegExp) => head.some((h) => re.test(h));
  if (has(/^emoji$/) || has(/^transaction id$/)) return 'Monzo';
  if (has(/counter ?party/) && has(/spending category/)) return 'Starling';
  if (has(/^subcategory$/) && has(/^memo$/)) return 'Barclays';
  if (has(/sort code/)) return 'Lloyds, Halifax or Bank of Scotland';
  if (has(/^paid out$/) && has(/^paid in$/)) return 'Nationwide';
  return '';
}

/**
 * A statement's CSV → transactions. Finds the header among the first lines (Nationwide puts the account's
 * name and balance above it), names the columns by their headers, and reads three shapes: one signed amount
 * (Monzo, Starling, Barclays…), paid out and paid in (Lloyds, Nationwide…), or no header at all (date,
 * description, amount[, balance] — HSBC's download). Throws, in plain words, when it is not a statement.
 */
export function readStatement(text: string): Statement {
  const cells = parseCsv(text);
  if (!cells.length) throw new Error('that file is empty');
  const low = cells.map((r) => r.map((c) => c.toLowerCase().replace(/\s+/g, ' ').trim()));
  const hi = low.slice(0, 15).findIndex((r) => r.some((c) => COL.date.test(c)) && r.some((c) => COL.amount.test(c) || COL.out.test(c) || COL.in.test(c)));
  let rows: Txn[] = [];
  let skipped = 0;
  let shape: string;
  let bank = '';
  if (hi >= 0) {
    const head = low[hi]!;
    bank = bankOf(head);
    const find = (re: RegExp) => head.findIndex((c) => re.test(c));
    const di = find(COL.date);
    let ti = -1;
    for (const re of COL.desc) if ((ti = head.findIndex((c, i) => i !== di && re.test(c))) >= 0) break;
    const ai = find(COL.amount);
    const oi = ai >= 0 ? -1 : find(COL.out);
    const ii = ai >= 0 ? -1 : find(COL.in);
    const bi = find(COL.balance);
    shape = ai >= 0 ? 'amount' : 'paid out / paid in';
    for (const r of cells.slice(hi + 1)) {
      const d = parseDate(r[di] ?? '');
      let a: number;
      if (ai >= 0) a = parseMoney(r[ai] ?? '');
      else {
        const o = parseMoney(r[oi] ?? '');
        const n = parseMoney(r[ii] ?? '');
        a = (Number.isFinite(n) ? Math.abs(n) : 0) - (Number.isFinite(o) ? Math.abs(o) : 0);
        if (!Number.isFinite(o) && !Number.isFinite(n)) a = NaN;
      }
      if (!d || !Number.isFinite(a)) {
        skipped++;
        continue;
      }
      const b = bi >= 0 ? parseMoney(r[bi] ?? '') : NaN;
      rows.push({ d, t: (ti >= 0 ? r[ti] : '')?.trim() || '(no description)', a: Math.round(a * 100) / 100, ...(Number.isFinite(b) ? { b } : {}) });
    }
  } else {
    // No header: date, description, amount and perhaps a balance (HSBC's CSV download).
    shape = 'no header';
    for (const r of cells) {
      const d = parseDate(r[0] ?? '');
      const a = parseMoney(r[2] ?? '');
      if (!d || !Number.isFinite(a)) {
        skipped++;
        continue;
      }
      const b = parseMoney(r[3] ?? '');
      rows.push({ d, t: r[1]?.trim() || '(no description)', a, ...(Number.isFinite(b) ? { b } : {}) });
    }
  }
  if (!rows.length) throw new Error("that doesn't look like a bank statement: I need a date, a description and an amount (or paid out / paid in) on each line");
  rows = rows.sort((x, y) => (x.d < y.d ? -1 : x.d > y.d ? 1 : 0));
  return { rows, shape, bank, skipped };
}

// ---- Merchants and rules.

const NOISE = /^(CARD|PAYMENT|PAYMENTS|PURCHASE|TO|FROM|DIRECT|DEBIT|DD|SO|BGC|FPI|FPO|VIS|VISA|POS|CPT|ATM|CONTACTLESS|PAY|ON|AT|REF|REFERENCE|FASTER|TRANSFER|STANDING|ORDER|BILL|DEB|CHG|TFR|CR|DR|GB|GBR|UK|LTD|LIMITED|PLC|THE|AND|INT|INTL|WWW)$/;

/** The shop or payee in a description, as a key that stays the same from one month to the next: "CARD PAYMENT TO TESCO STORES 2041 ON 03 OCT" → "TESCO STORES". */
export function merchantKey(desc: string): string {
  const s = desc
    .toUpperCase()
    .replace(/\*.*$/, ' ')
    .replace(/\.(COM|CO\.UK|UK|NET|ORG|IO)\b/g, ' ')
    .replace(/[^A-Z0-9&' ]+/g, ' ');
  const words = s.split(/\s+/).filter((w) => w && !/\d/.test(w) && !NOISE.test(w) && !MONTHS.includes(w.toLowerCase()));
  // Cash machines all look alike: one key for them.
  if (/\b(ATM|CASH ?POINT|CASH WITHDRAWAL|NOTEMACHINE)\b/.test(desc.toUpperCase())) return 'CASH';
  return words.slice(0, 2).join(' ') || desc.toUpperCase().replace(/\s+/g, ' ').trim().slice(0, 24);
}

/**
 * The built-in rules: UK shops and words → a category, first match wins (so "TESCO MOBILE" is a bill before
 * "TESCO" is groceries, "UBER EATS" is eating out before "UBER" is transport). No shop is favoured: a rule only
 * says what kind of spending a name is.
 */
export const RULES: [RegExp, Category][] = [
  [/\b(TESCO MOBILE|SKY MOBILE|VIRGIN MEDIA|BRITISH GAS|OCTOPUS ENERGY|SCOTTISH POWER|E\.?ON|EDF|OVO|SSE|BULB|SEVERN TRENT|THAMES WATER|UNITED UTILITIES|YORKSHIRE WATER|ANGLIAN WATER|SOUTH STAFFS WATER|WATER PLC|COUNCIL TAX|COUNCIL|TV LICEN[CS]E|TALKTALK|PLUSNET|BT GROUP|BT|EE|VODAFONE|O2|THREE|GIFFGAFF|SKY DIGITAL|SKY UK|SKY|RENT|MORTGAGE|INSURANCE|AVIVA|ADMIRAL|DIRECT LINE|LV|HASTINGS)\b/, 'bills'],
  [/\b(UBER ?EATS|DELIVEROO|JUST ?EAT|MCDONALD'?S|KFC|BURGER KING|GREGGS|NANDO'?S|COSTA|STARBUCKS|PRET|CAFFE NERO|PIZZA HUT|PIZZA EXPRESS|DOMINO'?S|PAPA JOHNS|WAGAMAMA|SUBWAY|WETHERSPOON|J D WETHERSPOON|TOBY CARVERY|FIVE GUYS|LEON|TIM HORTONS|HARVESTER|BEEFEATER|FRANKIE|ZIZZI|PREZZO|RESTAURANT|CAFE|COFFEE|TAKEAWAY|KEBAB|CHIPPY|FISH BAR|BAKERY)\b/, 'eating out'],
  [/\b(NETFLIX|SPOTIFY|DISNEY|AMAZON PRIME|PRIME VIDEO|AMZN PRIME|APPLE\.? ?COM|ITUNES|ICLOUD|GOOGLE STORAGE|GOOGLE ONE|GOOGLE PLAY|YOUTUBE|NOW ?TV|AUDIBLE|PLAYSTATION|XBOX|MICROSOFT|ADOBE|DROPBOX|PURE ?GYM|THE GYM|GYM GROUP|DAVID LLOYD|DAZN|PATREON|OPENAI|CHATGPT|PARAMOUNT|BRITBOX|APPLE MUSIC|DEEZER|TIDAL)\b/, 'subscriptions'],
  [/\b(TESCO|SAINSBURY'?S?|ASDA|MORRISONS|ALDI|LIDL|WAITROSE|CO-?OP|ICELAND|M ?& ?S FOOD|M ?& ?S SIMPLY FOOD|OCADO|FARMFOODS|SPAR|BUDGENS|COSTCO|NISA|ONE STOP|LONDIS|BOOKER|SUPERMARKET)\b/, 'groceries'],
  [/\b(TFL|TRANSPORT FOR LONDON|TRAINLINE|NATIONAL RAIL|NATIONAL EXPRESS|WEST MIDLANDS RAIL|WMR|AVANTI|LNER|GWR|CROSSCOUNTRY|NORTHERN|STAGECOACH|ARRIVA|FIRST BUS|SWIFT|UBER|BOLT|ADDISON LEE|SHELL|ESSO|TEXACO|GULF|JET|PETROL|FUEL|PARKING|NCP|RINGGO|PAYBYPHONE|DVLA|EURO ?STAR|RYANAIR|EASYJET|BRITISH AIRWAYS|JET2)\b/, 'transport'],
  [/\b(AMAZON|AMZN|ARGOS|EBAY|JOHN LEWIS|NEXT|PRIMARK|H ?& ?M|ZARA|BOOTS|SUPERDRUG|IKEA|B ?& ?Q|WICKES|CURRYS|TK ?MAXX|ASOS|SHEIN|M ?& ?S|MARKS & SPENCER|MARKS AND SPENCER|WILKO|POUNDLAND|B ?& ?M|HOME BARGAINS|SCREWFIX|TOOLSTATION|HALFORDS|SPORTS DIRECT|JD SPORTS|ETSY|DUNELM|THE RANGE|WHSMITH|WATERSTONES|APPLE STORE|SELFRIDGES|DEBENHAMS|VERY|TEMU)\b/, 'shopping'],
  [/\b(ATM|CASH ?POINT|CASH WITHDRAWAL|NOTEMACHINE|CASH)\b/, 'cash'],
  [/\b(SALARY|WAGES?|PAYROLL|PAYE|PENSION|DWP|HMRC|CHILD BENEFIT|UNIVERSAL CREDIT|TAX CREDIT|INTEREST|DIVIDEND|BENEFIT)\b/, 'income'],
];

/** A category for one row: the owner's own rule for that name first, then the built-in rules; money in that nothing names is income. null: for the model (or the owner) to place. */
export function ruleFor(t: Txn, own: Record<string, Category> = {}): { c: Category; by: 'you' | 'rule' } | null {
  const k = merchantKey(t.t);
  if (own[k]) return { c: own[k]!, by: 'you' };
  const up = ` ${t.t.toUpperCase().replace(/\s+/g, ' ')} `;
  for (const [re, c] of RULES) if (re.test(up)) return { c: c === 'income' && t.a < 0 ? 'other' : c, by: 'rule' };
  if (t.a > 0) return { c: 'income', by: 'rule' };
  return null;
}

/** Every row filed by the rules; the ones they could not place come back as `unplaced` (their merchant keys, once each). */
export function categorise(rows: Txn[], own: Record<string, Category> = {}): { rows: SpendRow[]; unplaced: string[] } {
  const unplaced = new Set<string>();
  const out = rows.map((t): SpendRow => {
    const k = merchantKey(t.t);
    const r = ruleFor(t, own);
    if (!r) unplaced.add(k);
    return { ...t, k, c: r?.c ?? 'other', by: r?.by ?? 'none' };
  });
  return { rows: out, unplaced: [...unplaced] };
}

/**
 * The one cheap model call an import may make: ONLY the names the rules could not place (no dates, no
 * amounts, no balances, nothing else from the statement), at most `max` of them.
 */
export function modelAsk(names: string[], max = 40): { system: string; user: string; names: string[] } {
  const list = names.slice(0, max);
  return {
    names: list,
    system: `You sort UK shop and payee names into spending categories. Answer with JSON only: {"NAME": "category", …}. Categories: ${CATEGORIES.filter((c) => c !== 'income').join(', ')}. Use "other" when unsure.`,
    user: list.join('\n'),
  };
}

/** The model's answer → name → category (anything else, or a name it was not asked about, is ignored). */
export function readModelAnswer(text: string, names: string[]): Record<string, Category> {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return {};
  let j: unknown;
  try {
    j = JSON.parse(m[0]);
  } catch {
    return {};
  }
  const out: Record<string, Category> = {};
  const asked = new Map(names.map((n) => [n.toUpperCase(), n]));
  for (const [k, v] of Object.entries((j ?? {}) as Record<string, unknown>)) {
    const name = asked.get(k.trim().toUpperCase());
    const c = String(v ?? '').trim().toLowerCase();
    if (name && isCategory(c) && c !== 'income') out[name] = c;
  }
  return out;
}

// ---- Subscriptions.

export interface Subscription {
  name: string;
  k: string;
  cadence: 'monthly' | 'yearly';
  /** The latest amount, in pounds. */
  amount: number;
  /** What it costs a year at the latest price. */
  yearly: number;
  last: string;
  /** When the next one is due (estimated). */
  next: string;
  count: number;
  /** The amount before the latest price change, and the day it changed. */
  was?: number;
  changed?: string;
}

const dayNo = (d: string) => Math.round(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400_000);
const addMonths = (d: string, n: number) => {
  const m = +d.slice(0, 4) * 12 + (+d.slice(5, 7) - 1) + n;
  return `${Math.floor(m / 12)}-${pad2((m % 12) + 1)}-${pad2(Math.min(28, +d.slice(8, 10)))}`;
};
const title = (k: string) => k.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

function cadenceOf(dates: string[]): 'monthly' | 'yearly' | null {
  if (dates.length < 2) return null;
  const gaps = dates.slice(1).map((d, i) => dayNo(d) - dayNo(dates[i]!));
  if (gaps.every((g) => g >= 25 && g <= 36)) return 'monthly';
  if (gaps.every((g) => g >= 350 && g <= 380)) return 'yearly';
  return null;
}

function subOf(k: string, list: SpendRow[]): Subscription | null {
  const cadence = cadenceOf(list.map((r) => r.d));
  if (!cadence) return null;
  // Repeating amounts: the latest price was paid at least twice, or (after a price change) the old one was.
  const amounts = list.map((r) => Math.round(-r.a * 100));
  const repeats = amounts.some((a, i) => amounts.indexOf(a) !== i);
  if (!repeats) return null;
  const last = list[list.length - 1]!;
  const amount = -last.a;
  let was: number | undefined;
  let changed: string | undefined;
  for (let i = list.length - 2; i >= 0; i--) {
    if (Math.round(-list[i]!.a * 100) !== Math.round(amount * 100)) {
      was = -list[i]!.a;
      changed = list[i + 1]!.d;
      break;
    }
  }
  return {
    name: title(k),
    k,
    cadence,
    amount,
    yearly: Math.round((cadence === 'monthly' ? amount * 12 : amount) * 100) / 100,
    last: last.d,
    next: addMonths(last.d, cadence === 'monthly' ? 1 : 12),
    count: list.length,
    ...(was !== undefined ? { was, changed } : {}),
  };
}

/**
 * Subscriptions: money out to the same name, monthly (every 25–36 days) or yearly (every 350–380 days),
 * with an amount that repeats. A price change keeps it one subscription and says so. Two different amounts
 * to one name on their own schedules (two Apple subscriptions) are two.
 */
export function findSubscriptions(rows: SpendRow[]): Subscription[] {
  const by = new Map<string, SpendRow[]>();
  for (const r of rows) if (r.a < 0 && r.c !== 'cash') by.set(r.k, [...(by.get(r.k) ?? []), r]);
  const out: Subscription[] = [];
  for (const [k, list0] of by) {
    const list = [...list0].sort((a, b) => (a.d < b.d ? -1 : 1));
    const whole = subOf(k, list);
    if (whole) {
      out.push(whole);
      continue;
    }
    const byAmount = new Map<number, SpendRow[]>();
    for (const r of list) byAmount.set(Math.round(r.a * 100), [...(byAmount.get(Math.round(r.a * 100)) ?? []), r]);
    for (const part of byAmount.values()) {
      const s = subOf(k, part);
      if (s) out.push(s);
    }
  }
  return out.sort((a, b) => b.yearly - a.yearly);
}

// ---- Budgets.

const SYNONYMS: [RegExp, Category][] = [
  [/\b(eating out|eat out|restaurants?|takeaways?|take-aways?|dining|food out|coffees?|cafes?)\b/, 'eating out'],
  [/\b(groceries|grocery|food shop(?:ping)?|supermarkets?|food)\b/, 'groceries'],
  [/\b(transport|travel|petrol|fuel|diesel|trains?|buses|taxis?|the car|my car)\b/, 'transport'],
  [/\b(bills?|utilities|energy|gas|electric(?:ity)?|water|phone|broadband)\b/, 'bills'],
  [/\b(subscriptions?|streaming)\b/, 'subscriptions'],
  [/\b(shopping|clothes|clothing)\b/, 'shopping'],
  [/\bcash\b/, 'cash'],
  [/\b(other|everything else)\b/, 'other'],
];

/** "£200 a month on eating out", "50 pounds a week for petrol", "groceries £300" → { category, monthly } (null when the words give no amount or no category). A week is 52/12 of a month; a year is 1/12. */
export function parseBudget(words: string): { category: Category; monthly: number } | null {
  const s = words.toLowerCase().replace(/,(?=\d{3})/g, '');
  const m = s.match(/£\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:pounds|quid|gbp)\b|\b(\d+(?:\.\d+)?)\b/);
  if (!m) return null;
  const n = Number(m[1] ?? m[2] ?? m[3]);
  let category: Category | null = null;
  for (const [re, c] of SYNONYMS) if (re.test(s)) {
    category = c;
    break;
  }
  if (!category || !Number.isFinite(n)) return null;
  const per = /\b(a|per|each|every) ?week|weekly/.test(s) ? 52 / 12 : /\b(a|per|each|every) ?year|yearly|annual/.test(s) ? 1 / 12 : 1;
  return { category, monthly: Math.round(n * per * 100) / 100 };
}

/** Pounds for a line: "£38", "£1,204", or with pence ("£12.99") when `pence`. */
export function gbp(n: number, pence = false): string {
  const v = Math.abs(n);
  const s = pence ? v.toFixed(2) : String(Math.round(v));
  const [i, f] = s.split('.');
  return `${n < 0 ? '−' : ''}£${i!.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${f ? `.${f}` : ''}`;
}

/** Spent in a category in a month: money out less refunds (never below nothing). */
export function spentIn(rows: SpendRow[], category: Category, month: string): number {
  const s = rows.filter((r) => r.c === category && r.d.startsWith(month)).reduce((k, r) => k - r.a, 0);
  return Math.max(0, Math.round(s * 100) / 100);
}

export interface BudgetStatus {
  category: Category;
  monthly: number;
  spent: number;
  left: number;
  /** spent / monthly, for the bar (may pass 1). */
  frac: number;
  /** "£38 left this month" / "£12 over this month". */
  line: string;
}

export function budgetStatus(category: Category, monthly: number, rows: SpendRow[], month: string): BudgetStatus {
  const spent = spentIn(rows, category, month);
  const left = Math.round((monthly - spent) * 100) / 100;
  return { category, monthly, spent, left, frac: monthly > 0 ? spent / monthly : 0, line: left >= 0 ? `${gbp(left)} left this month` : `${gbp(-left)} over this month` };
}

// ---- The views.

export interface MonthView {
  month: string;
  /** Money out this month (not counting income), and money in. */
  out: number;
  in: number;
  categories: { c: Category; spent: number }[];
}

export function monthView(rows: SpendRow[], month: string): MonthView {
  const mine = rows.filter((r) => r.d.startsWith(month));
  const categories = CATEGORIES.filter((c) => c !== 'income')
    .map((c) => ({ c, spent: spentIn(mine, c, month) }))
    .filter((x) => x.spent > 0)
    .sort((a, b) => b.spent - a.spent);
  const inn = mine.filter((r) => r.c === 'income' && r.a > 0).reduce((k, r) => k + r.a, 0);
  return { month, out: Math.round(categories.reduce((k, x) => k + x.spent, 0) * 100) / 100, in: Math.round(inn * 100) / 100, categories };
}

export interface YearView {
  year: string;
  months: { month: string; out: number; in: number }[];
  categories: { c: Category; spent: number }[];
  out: number;
  in: number;
}

/** The year's view: each month's money out and in, and each category's total. */
export function yearView(rows: SpendRow[], year: string): YearView {
  const months = [...new Set(rows.filter((r) => r.d.startsWith(year)).map((r) => r.d.slice(0, 7)))].sort().map((m) => monthView(rows, m));
  const totals = new Map<Category, number>();
  for (const m of months) for (const x of m.categories) totals.set(x.c, (totals.get(x.c) ?? 0) + x.spent);
  const sum = (k: 'out' | 'in') => Math.round(months.reduce((t, m) => t + m[k], 0) * 100) / 100;
  return { year, months: months.map((m) => ({ month: m.month, out: m.out, in: m.in })), categories: [...totals].map(([c, spent]) => ({ c, spent: Math.round(spent * 100) / 100 })).sort((a, b) => b.spent - a.spent), out: sum('out'), in: sum('in') };
}

export const prevMonth = (month: string) => {
  const y = +month.slice(0, 4);
  const m = +month.slice(5, 7);
  return m === 1 ? `${y - 1}-12` : `${y}-${pad2(m - 1)}`;
};
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthName = (month: string) => MONTH_NAMES[+month.slice(5, 7) - 1] ?? month;

/** What changed since last month: the total, then each category that moved, biggest move first, as plain lines. */
export function changes(rows: SpendRow[], month: string): { lines: string[]; moves: { c: Category; now: number; before: number; diff: number }[] } {
  const prev = prevMonth(month);
  const a = monthView(rows, month);
  const b = monthView(rows, prev);
  const cats = new Set([...a.categories.map((x) => x.c), ...b.categories.map((x) => x.c)]);
  const moves = [...cats]
    .map((c) => {
      const now = a.categories.find((x) => x.c === c)?.spent ?? 0;
      const before = b.categories.find((x) => x.c === c)?.spent ?? 0;
      return { c, now, before, diff: Math.round((now - before) * 100) / 100 };
    })
    .filter((m) => Math.abs(m.diff) >= 1)
    .sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
  if (!b.categories.length) return { lines: [`Nothing from ${monthName(prev)} to compare with yet.`], moves };
  const word = (d: number) => (d > 0 ? 'more' : 'less');
  const lines = [
    Math.abs(a.out - b.out) < 1 ? `About the same as ${monthName(prev)} in all (${gbp(a.out)}).` : `${gbp(Math.abs(a.out - b.out))} ${word(a.out - b.out)} than ${monthName(prev)} in all (${gbp(a.out)} against ${gbp(b.out)}).`,
    ...moves.slice(0, 6).map((m) => `${m.c.charAt(0).toUpperCase()}${m.c.slice(1)}: ${gbp(Math.abs(m.diff))} ${word(m.diff)} (${gbp(m.now)} against ${gbp(m.before)}).`),
  ];
  return { lines, moves };
}

// ---- Out again.

/** The rows as CSV (Date, Description, Amount, Category), safe to open in a spreadsheet (no cell starts a formula). */
export function toCsv(rows: SpendRow[]): string {
  const cell = (v: string) => {
    const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return ['Date,Description,Amount,Category', ...rows.map((r) => [r.d, cell(r.t), r.a.toFixed(2), r.c].join(','))].join('\r\n') + '\r\n';
}

/** What one import did (the brain's spending.ts). */
export interface ImportResult {
  at: number;
  added: number;
  duplicates: number;
  skipped: number;
  shape: string;
  bank: string;
  /** Names sent to the model (only names), and how many rows its answer placed. */
  asked: number;
  placed: number;
  /** Rows still not placed (filed as "other" until he taps them). */
  unplaced: number;
  kept: number;
  dropped: number;
  months: string[];
}

/** Everything the SPENDING card shows for a month (GET /api/profile/spending). */
export interface SpendingSummary {
  privacy: string;
  month: string;
  months: string[];
  kept: number;
  cap: number;
  rules: number;
  last: ImportResult | null;
  view: MonthView | null;
  year: YearView | null;
  changes: string[];
  subscriptions: Subscription[];
  budgets: BudgetStatus[];
  rows: SpendRow[];
}
