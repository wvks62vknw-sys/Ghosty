/**
 * THE MONEY PACK, the pure parts (BRIEF-PACKS-1 item 1): a statement's text (copied out of a PDF) read in code, the month's
 * picture as a card (the top five categories, what changed), what he says he spent this week, fuel prices from the
 * retailers' own open data near ONE of his saved places, a price on a page, the subscriptions he lists, a bill split,
 * round-ups, his payday, a plain "what if", a warranty's end and a trip's fuel. No bank, no account, nothing that bills;
 * nothing here touches the network (the brain's tools/money.ts fetches and keeps). Every number says what it assumed.
 */
import { card, type Card } from './cards';
import { addDays, addMonths, daysBetween, daysInMonth, dayWords, kmBetween, milesText, moneyIn, nextDayOfMonth, pounds, prettyDay, weekdayOf, mondayOf } from './packs';
import { categorise, CATEGORIES, gbp, monthName, parseDate, readStatement, RULES, type Category, type MonthView, type SpendRow, type Statement, type Txn } from './spending';

// ---------------------------------------------------------------- a statement's text (a PDF, copied)

const AMOUNT = /(?:£\s?)?\d{1,3}(?:,\d{3})*\.\d{2}(?:\s?(?:CR|DR))?/g;
const LEAD_DATE = /^(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\s+[A-Za-z]{3,9}(?:\s+\d{2,4})?)\b/;
const IN_WORDS = /\b(paid in|credit|refund|salary|wages|interest|transfer from|deposit|bgc|faster payment received)\b/i;

/**
 * Lines of a statement as a PDF's text comes when copied: each transaction a line that starts with its date, then the
 * words, then the amount and usually the balance. Money in or out: by the balance's move when there is one (the line
 * before ± the amount), else "CR"/"DR", else the words ("paid in", "salary"…), else out. "3 Oct" with no year takes the
 * statement's own year (the last four-digit year it shows), else `year`.
 */
export function readStatementText(text: string, year = String(new Date().getUTCFullYear())): Statement {
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const years = text.match(/\b20\d\d\b/g);
  const theYear = years?.length ? years[years.length - 1]! : year;
  const rows: Txn[] = [];
  let skipped = 0;
  let last: number | null = null;
  let lastDate = '';
  for (const line of lines) {
    const opening = /\b(balance brought forward|opening balance|previous balance|brought forward)\b/i.test(line);
    const nums = [...line.matchAll(AMOUNT)].map((m) => ({ s: m[0], at: m.index ?? 0 }));
    if (opening && nums.length) {
      last = money(nums[nums.length - 1]!.s);
      continue;
    }
    const d = LEAD_DATE.exec(line);
    let date = d ? parseDate(/^\d{1,2}\s+[A-Za-z]{3,9}$/.test(d[1]!) ? `${d[1]} ${theYear}` : d[1]!) : '';
    // a line with no date of its own under a dated one is another payment that day (many banks print the date once)
    if (!date && lastDate && nums.length >= 2 && /[a-z]{3}/i.test(line.slice(0, nums[0]!.at))) date = lastDate;
    if (!date || !nums.length) {
      if (nums.length || d) skipped++;
      continue;
    }
    lastDate = date;
    const words = line.slice(d ? d[0].length : 0, nums[0]!.at).trim();
    if (!words || /^(total|balance carried|closing balance|page \d)/i.test(words)) {
      skipped++;
      continue;
    }
    const amtTok = nums.length >= 2 ? nums[nums.length - 2]! : nums[0]!;
    const balTok = nums.length >= 2 ? nums[nums.length - 1]! : null;
    let a = Math.abs(money(amtTok.s));
    const b = balTok ? money(balTok.s) : null;
    let sign = /CR$/i.test(amtTok.s) ? 1 : /DR$/i.test(amtTok.s) ? -1 : 0;
    if (!sign && b !== null && last !== null) {
      if (Math.abs(last - a - b) < 0.011) sign = -1;
      else if (Math.abs(last + a - b) < 0.011) sign = 1;
    }
    if (!sign) sign = IN_WORDS.test(words) || RULES.some(([re, c]) => c === 'income' && re.test(words.toUpperCase())) ? 1 : -1;
    a = Math.round(sign * a * 100) / 100;
    rows.push({ d: date, t: words.slice(0, 140), a, ...(b !== null ? { b } : {}) });
    if (b !== null) last = b;
  }
  return { rows, shape: 'statement text', bank: '', skipped };
}
const money = (s: string): number => {
  const neg = /DR$/i.test(s);
  const n = Number(s.replace(/[£,\s]|CR|DR/gi, ''));
  return neg ? -n : n;
};

/** A CSV statement (spending.ts readStatement) or a statement's text: whichever reads; throws in plain words when neither does. */
export function readAnyStatement(text: string, year?: string): Statement {
  try {
    const st = readStatement(text);
    if (st.rows.length) return st;
  } catch {
    /* not a CSV: try it as text */
  }
  const st = readStatementText(text, year);
  if (st.rows.length < 2) throw new Error('That doesn’t look like a statement: I need lines with a date, the words and an amount (a CSV, or the text copied out of the PDF).');
  return st;
}

/** A line that starts with a real date ("03 Oct 2026", "3 Oct", "03/10/2026"): not "3 apples". */
const datedLine = (l: string): boolean => {
  const d = LEAD_DATE.exec(l.trim());
  return !!d && !!parseDate(/^\d{1,2}\s+[A-Za-z]{3,9}$/.test(d[1]!) ? `${d[1]} 2000` : d[1]!);
};
/** A CSV row of a statement: separated cells, a date among them and an amount with pence. */
const csvRow = (l: string): boolean => (l.match(/[,;\t]/g) ?? []).length >= 2 && /(?:^|[,;\t"])\s*(?:\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d\d-\d\d)/.test(l) && /-?\d+\.\d{2}\b/.test(l);

/** Pasted words that are a statement (three or more dated lines with an amount, or CSV rows): the phone reads them, never a model. */
export function looksLikeStatement(text: string): boolean {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 3) return false;
  return lines.filter((l) => (datedLine(l) && /\d\.\d{2}\b/.test(l)) || csvRow(l)).length >= 3;
}

// ---------------------------------------------------------------- the month's picture

const cap = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);

/** The month in words: the total, the top five categories, what moved since the month before (spending.ts changes). */
export function monthWords(v: MonthView, moves: { c: Category; diff: number }[], hadBefore: boolean): string {
  const top = v.categories.slice(0, 5).map((x) => `${x.c} ${gbp(x.spent)}`).join(', ');
  const prev = monthName(prevOf(v.month));
  const total = moves.reduce((k, m) => k + m.diff, 0);
  const moved = hadBefore
    ? [`${Math.abs(total) < 1 ? `About the same as ${prev}` : `${gbp(Math.abs(total))} ${total > 0 ? 'more' : 'less'} than ${prev}`}`, ...moves.slice(0, 2).map((m) => `${m.c} ${m.diff > 0 ? 'up' : 'down'} ${gbp(Math.abs(m.diff))}`)].join('; ')
    : `nothing from ${prev} to compare with yet`;
  return `${monthName(v.month)}: ${gbp(v.out)} out${v.in ? `, ${gbp(v.in)} in` : ''}. Top five: ${top || 'nothing yet'}. Since ${prev}: ${moved}.`;
}
const prevOf = (month: string) => {
  const y = +month.slice(0, 4);
  const m = +month.slice(5, 7);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};

/** The month as a chat card: the total in the title, the top five in the line (with the biggest move when it fits). */
export function monthCard(v: MonthView, moves: { c: Category; diff: number }[], at = Date.now()): Card {
  const top = v.categories.slice(0, 5).map((x) => `${cap(x.c)} ${gbp(x.spent)}`).join(' · ');
  const big = moves[0];
  const tail = big ? ` · ${big.c} ${big.diff > 0 ? 'up' : 'down'} ${gbp(Math.abs(big.diff))}` : '';
  return card({
    id: `money:month:${v.month}`, kind: 'brief', at, title: `${monthName(v.month)} ${gbp(v.out)} out`,
    line: `${top}${(top + tail).length <= 110 ? tail : ''}` || 'Nothing spent yet this month',
    brief: { icon: 'diary' },
    acts: [{ label: 'OPEN SPENDING', open: { tab: 'agenda', panel: 'SPENDING' } }, { label: 'ASK', ask: 'What changed since last month?' }],
  });
}

// ---------------------------------------------------------------- what he says he spent ("spent 12 on lunch")

export interface Spent {
  at: number;
  /** His local day. */
  d: string;
  a: number;
  what: string;
  c: Category;
}

const SPENT_WORDS: [RegExp, Category][] = [
  [/\b(lunch|dinner|breakfast|brunch|coffee|tea|takeaway|take-away|chippy|kebab|pizza|pub|pint|pints|drinks?|restaurant|cafe|café|meal deal|snack)\b/, 'eating out'],
  [/\b(petrol|diesel|fuel|bus|train|tram|taxi|cab|uber|parking|car wash|toll|ticket to)\b/, 'transport'],
  [/\b(food shop|groceries|grocery|weekly shop|big shop|milk|bread|supermarket)\b/, 'groceries'],
  [/\b(rent|bill|bills|council tax|electric|electricity|gas|water|phone bill|broadband|insurance)\b/, 'bills'],
  [/\b(subscription|netflix|spotify|prime|disney)\b/, 'subscriptions'],
  [/\b(clothes|shoes|trainers|jacket|present|gift|book|game|games|headphones|phone case|amazon|shopping)\b/, 'shopping'],
];

/** "spent 12 on lunch", "£4.50 coffee", "30 quid on petrol yesterday" → what it was, how much, its category, the day. */
export function parseSpent(words: string, today: string): { a: number; what: string; c: Category; d: string } | null {
  const a = moneyIn(words);
  if (a === null) return null;
  const what =
    /\b(?:on|for)\s+(?:a |an |the |some )?([a-z][a-z' -]{1,40}?)(?:\s+(?:today|yesterday|this morning|tonight|last night|at|in|from)\b|[.!?]|$)/i.exec(words)?.[1]?.trim() ??
    words.replace(/£?\d+(?:\.\d{1,2})?\s?(?:quid|pounds?)?/gi, '').replace(/\b(i|just|spent|paid|on|for|today|yesterday)\b/gi, '').replace(/\s+/g, ' ').trim();
  const w = ` ${words.toLowerCase()} `;
  const c = SPENT_WORDS.find(([re]) => re.test(w))?.[1] ?? RULES.find(([re]) => re.test(words.toUpperCase()))?.[1] ?? 'other';
  const d = /\byesterday|last night\b/i.test(words) ? addDays(today, -1) : today;
  return { a, what: what.slice(0, 40) || 'something', c: c === 'income' ? 'other' : c, d };
}

/** This week (Monday on) from what he told me, by category, against last week's to the same weekday. */
export function weekOf(list: Spent[], today: string): { from: string; total: number; cats: { c: Category; a: number }[]; last: number; n: number } {
  const from = mondayOf(today);
  const mine = list.filter((s) => s.d >= from && s.d <= today);
  const lastFrom = addDays(from, -7);
  const lastTo = addDays(today, -7);
  const last = list.filter((s) => s.d >= lastFrom && s.d <= lastTo).reduce((k, s) => k + s.a, 0);
  const by = new Map<Category, number>();
  for (const s of mine) by.set(s.c, (by.get(s.c) ?? 0) + s.a);
  const cats = [...by].map(([c, a]) => ({ c, a: Math.round(a * 100) / 100 })).sort((x, y) => y.a - x.a);
  return { from, total: Math.round(mine.reduce((k, s) => k + s.a, 0) * 100) / 100, cats, last: Math.round(last * 100) / 100, n: mine.length };
}

export function weekWords(w: ReturnType<typeof weekOf>): string {
  if (!w.n) return 'Nothing told me this week yet. Say "spent 12 on lunch" and I keep it.';
  const vs = w.last ? ` Last week to the same day: ${pounds(w.last)}.` : '';
  return `This week (since Monday ${prettyDay(w.from)}): ${pounds(w.total)} on ${w.n} thing${w.n === 1 ? '' : 's'} you told me — ${w.cats.map((x) => `${x.c} ${pounds(x.a)}`).join(', ')}.${vs} Only what you told me, not your bank.`;
}

// ---------------------------------------------------------------- fuel: the retailers' own open data (the CMA scheme)

/** The fuel retailers' public price feeds (the Competition and Markets Authority's scheme): fixed, keyless, no account. */
export const FUEL_FEEDS: { brand: string; url: string }[] = [
  { brand: 'Applegreen', url: 'https://applegreenstores.com/fuel-prices/data.json' },
  { brand: 'Ascona', url: 'https://fuelprices.asconagroup.co.uk/newfuel.json' },
  { brand: 'Asda', url: 'https://storelocator.asda.com/fuel_prices_data.json' },
  { brand: 'BP', url: 'https://www.bp.com/en_gb/united-kingdom/home/fuelprices/fuel_prices_data.json' },
  { brand: 'Esso', url: 'https://fuelprices.esso.co.uk/latestdata.json' },
  { brand: 'JET', url: 'https://jetlocal.co.uk/fuel_prices_data.json' },
  { brand: 'Karan', url: 'https://api.krl.live/integration/live_price/krl' },
  { brand: 'Morrisons', url: 'https://www.morrisons.com/fuel-prices/fuel.json' },
  { brand: 'Moto', url: 'https://moto-way.com/fuel-price/fuel_prices.json' },
  { brand: 'Motor Fuel Group', url: 'https://fuel.motorfuelgroup.com/fuel_prices_data.json' },
  { brand: 'Rontec', url: 'https://www.rontec-servicestations.co.uk/fuel-prices/data/fuel_prices_data.json' },
  { brand: 'Sainsbury’s', url: 'https://api.sainsburys.co.uk/v1/exports/latest/fuel_prices_data.json' },
  { brand: 'SGN', url: 'https://www.sgnretail.uk/files/data/SGN_daily_fuel_prices.json' },
  { brand: 'Shell', url: 'https://www.shell.co.uk/fuel-prices-data.html' },
  { brand: 'Tesco', url: 'https://www.tesco.com/fuel_prices/fuel_prices_data.json' },
];

export type Fuel = 'E10' | 'E5' | 'B7' | 'SDV';
export const FUEL_NAMES: Record<Fuel, string> = { E10: 'unleaded (E10)', E5: 'super unleaded (E5)', B7: 'diesel (B7)', SDV: 'super diesel' };
/** Which fuel his words mean: diesel, super, or unleaded by default. */
export const fuelOf = (words: string): Fuel => (/super ?diesel|premium diesel/i.test(words) ? 'SDV' : /diesel|\bb7\b/i.test(words) ? 'B7' : /super|premium|\be5\b|v-?power|momentum/i.test(words) ? 'E5' : 'E10');

export interface Station {
  brand: string;
  address: string;
  postcode: string;
  lat: number;
  lon: number;
  /** Pence a litre. */
  prices: Partial<Record<Fuel, number>>;
  /** The feed's own "last updated" (YYYY-MM-DD), when it says. */
  updated: string;
}

/** One feed's JSON → its stations (prices in pence: a feed that writes pounds, 1.459, is read as 145.9; nonsense is dropped). */
export function readFuelFeed(json: unknown, brand: string): Station[] {
  const j = json as { last_updated?: unknown; stations?: unknown };
  const updated = typeof j?.last_updated === 'string' ? parseDate(j.last_updated.split(' ')[0] ?? '') : '';
  if (!Array.isArray(j?.stations)) return [];
  const out: Station[] = [];
  for (const s of j.stations as Record<string, unknown>[]) {
    const loc = (s?.location ?? {}) as Record<string, unknown>;
    const lat = Number(loc.latitude);
    const lon = Number(loc.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    const prices: Partial<Record<Fuel, number>> = {};
    for (const f of ['E10', 'E5', 'B7', 'SDV'] as Fuel[]) {
      let p = Number((s?.prices as Record<string, unknown> | undefined)?.[f]);
      if (!Number.isFinite(p) || p <= 0) continue;
      if (p < 10) p *= 100;
      if (p >= 80 && p <= 400) prices[f] = Math.round(p * 10) / 10;
    }
    if (!Object.keys(prices).length) continue;
    out.push({ brand: String(s.brand ?? brand).trim() || brand, address: String(s.address ?? '').trim(), postcode: String(s.postcode ?? '').trim(), lat, lon, prices, updated });
  }
  return out;
}

/**
 * The cheapest `n` stations selling `fuel` near a point: within 5 miles, widened to 10 then 20 when fewer than `n` are found;
 * a feed older than `staleDays` before `today` is left out (and named). Each with its distance in a straight line.
 */
export function cheapestNear(stations: Station[], at: { lat: number; lon: number }, fuel: Fuel, today: string, n = 3, staleDays = 7): { picks: (Station & { km: number; p: number })[]; miles: number; stale: string[] } {
  const stale = [...new Set(stations.filter((s) => s.updated && daysBetween(s.updated, today) > staleDays).map((s) => s.brand))];
  const fresh = stations.filter((s) => !(s.updated && daysBetween(s.updated, today) > staleDays) && s.prices[fuel] !== undefined).map((s) => ({ ...s, km: kmBetween(at, s), p: s.prices[fuel]! }));
  for (const miles of [5, 10, 20]) {
    const near = fresh.filter((s) => s.km <= miles * 1.609344);
    if (near.length >= n || miles === 20) return { picks: near.sort((a, b) => a.p - b.p || a.km - b.km).slice(0, n), miles, stale };
  }
  return { picks: [], miles: 20, stale };
}

export function fuelWords(place: string, fuel: Fuel, r: ReturnType<typeof cheapestNear>, answered: number, asked: number): string {
  const head = r.picks.length
    ? `Cheapest ${FUEL_NAMES[fuel]} within ${r.miles} miles of ${place}: ${r.picks.map((s, i) => `${i + 1}. ${s.brand}, ${s.address}${s.postcode ? ` ${s.postcode}` : ''} — ${s.p.toFixed(1)}p a litre, ${milesText(s.km)} away`).join('; ')}.`
    : `No station within 20 miles of ${place} has ${FUEL_NAMES[fuel]} in the retailers’ feeds right now.`;
  return `${head} Prices as each retailer last published them (${answered} of ${asked} feeds answered${r.stale.length ? `; left out as more than a week old: ${r.stale.join(', ')}` : ''}); distances in a straight line from your saved place, never from where you are.`;
}

export function fuelCard(place: string, fuel: Fuel, r: ReturnType<typeof cheapestNear>, at = Date.now()): Card | null {
  const best = r.picks[0];
  if (!best) return null;
  return card({
    id: `money:fuel:${place.toLowerCase()}:${fuel}`, kind: 'map', at, title: `Fuel near ${place}`,
    line: `${best.brand} ${best.p.toFixed(1)}p, ${milesText(best.km)}${r.picks[1] ? ` · ${r.picks[1].brand} ${r.picks[1].p.toFixed(1)}p` : ''}${r.picks[2] ? ` · ${r.picks[2].brand} ${r.picks[2].p.toFixed(1)}p` : ''}`,
    map: { lat: best.lat, lon: best.lon, label: `${best.brand} ${best.postcode}` },
    acts: [{ label: 'OPEN MAP', run: { name: 'show_map', args: { place: `${best.brand} ${best.address}`, lat: best.lat, lon: best.lon, zoom: 15 } } }],
  });
}

/** A trip's fuel: litres from miles and miles per gallon (UK gallon, 4.546 litres), at a price in pence a litre. */
export function tripCost(miles: number, mpg: number, pence: number): { litres: number; cost: number } {
  const litres = (miles / mpg) * 4.54609;
  return { litres: Math.round(litres * 10) / 10, cost: Math.round(litres * pence) / 100 };
}

// ---------------------------------------------------------------- a price on a page (the price watch)

/**
 * The price a product page shows, read the way shops publish it: its product data (JSON-LD offers), its price meta tags,
 * else the first £ amount in the page's text. Null when the page shows none. `how` says which.
 */
export function priceOf(html: string): { price: number; how: string } | null {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const p = ldPrice(JSON.parse(m[1]!.trim()));
      if (p) return { price: p, how: 'the page’s own product data' };
    } catch {
      /* a broken block: the next */
    }
  }
  const meta = /<meta[^>]+(?:property|itemprop|name)=["'](?:product:price:amount|og:price:amount|price)["'][^>]*content=["']([\d.,]+)["']/i.exec(html) ?? /<meta[^>]+content=["']([\d.,]+)["'][^>]*(?:property|itemprop|name)=["'](?:product:price:amount|og:price:amount|price)["']/i.exec(html);
  if (meta) {
    const p = Number(meta[1]!.replace(/,/g, ''));
    if (p > 0) return { price: p, how: 'the page’s price tag' };
  }
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&pound;|&#163;/g, '£');
  const m = /£\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/.exec(text);
  if (m) return { price: Number(m[1]!.replace(/,/g, '')), how: 'the first £ price in the page’s text' };
  return null;
}
function ldPrice(j: unknown, depth = 0): number | null {
  if (!j || typeof j !== 'object' || depth > 6) return null;
  if (Array.isArray(j)) {
    for (const x of j) {
      const p = ldPrice(x, depth + 1);
      if (p) return p;
    }
    return null;
  }
  const o = j as Record<string, unknown>;
  for (const k of ['price', 'lowPrice']) {
    const p = Number(String(o[k] ?? '').replace(/,/g, ''));
    if ((o['@type'] === 'Offer' || o['@type'] === 'AggregateOffer' || 'priceCurrency' in o) && p > 0) return p;
  }
  for (const k of ['offers', '@graph', 'mainEntity', 'itemListElement']) {
    const p = ldPrice(o[k], depth + 1);
    if (p) return p;
  }
  return null;
}

export interface Watch {
  id: string;
  url: string;
  label: string;
  /** The price when he set it, the last seen and the lowest told. */
  first: number;
  last: number;
  told: number;
  how: string;
  at: number;
  checked: number;
}

/** A watched page's new price: told only when it is lower than the last price he was told by at least 1p. */
export const dropped = (w: Watch, now: number): boolean => now < w.told - 0.005;

/** The page's name for him: its title, else its site. */
export function pageLabel(html: string, url: string): string {
  const t = /<title[^>]*>([^<]{2,120})<\/title>/i.exec(html)?.[1]?.replace(/\s+/g, ' ').trim();
  if (t) return t.split(/ [|–—-] /)[0]!.slice(0, 60);
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.slice(0, 40);
  }
}

export function watchCard(w: Watch, kind: 'set' | 'drop', at = Date.now()): Card {
  return card({
    id: `money:watch:${w.id}:${kind === 'drop' ? w.last : 'set'}`, kind: 'brief', at, title: kind === 'drop' ? 'Price dropped' : 'Watching the price',
    line: kind === 'drop' ? `${w.label}: ${pounds(w.last)}, was ${pounds(w.told)}` : `${w.label}: ${pounds(w.last)} now; I look twice a day`,
    brief: { icon: 'reminder' },
    acts: [{ label: kind === 'drop' ? 'STOP WATCHING' : 'UNDO', run: { name: 'packs_do', args: { pack: 'money', action: 'unwatch', args: { id: w.id } } } }, { label: 'OPEN PAGE', run: { name: 'show_link', args: { url: w.url, title: w.label } } }],
  });
}

// ---------------------------------------------------------------- subscriptions he lists

export interface Sub {
  id: string;
  name: string;
  amount: number;
  every: 'week' | 'month' | 'year';
  /** The next renewal (YYYY-MM-DD). */
  next: string;
}

/** "Netflix 10.99 a month on the 14th", "Prime £95 a year renews 12 March", "gym 25 weekly" → a subscription (its next renewal). */
export function parseSub(words: string, today: string): Omit<Sub, 'id'> | null {
  const amount = moneyIn(words);
  if (amount === null) return null;
  const every: Sub['every'] = /\b(year|yearly|annual|annually|a yr)\b/i.test(words) ? 'year' : /\b(week|weekly)\b/i.test(words) ? 'week' : 'month';
  const name = words.replace(/\b\d{1,2}(?:st|nd|rd|th)\b/gi, ' ').replace(/£?\s?\d[\d,]*(?:\.\d{1,2})?\s?(?:quid|pounds?)?/g, ' ').replace(/\b(a|an|per|every|each|month|monthly|year|yearly|annual|annually|week|weekly|renews?|renewal|on|the|is|costs?|for|subscription|sub|on the \d+\w*|\d+(?:st|nd|rd|th))\b/gi, ' ').replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/gi, ' ').replace(/\s+/g, ' ').trim();
  let next = dayWords(words, today);
  if (!next) next = every === 'week' ? addDays(today, 7) : every === 'year' ? addMonths(today, 12) : addMonths(today, 1);
  while (next < today) next = advance({ every, next } as Sub);
  return { name: name.slice(0, 40) || 'Subscription', amount, every, next };
}
export const advance = (s: Pick<Sub, 'every' | 'next'>): string => (s.every === 'week' ? addDays(s.next, 7) : addMonths(s.next, s.every === 'year' ? 12 : 1));
/** What one costs a month (a week is 52/12 of a month; a year a twelfth). */
export const monthlyOf = (s: Pick<Sub, 'amount' | 'every'>): number => Math.round((s.every === 'week' ? (s.amount * 52) / 12 : s.every === 'year' ? s.amount / 12 : s.amount) * 100) / 100;

/** The list, next renewal first, with the monthly total (and a year's). Renewals already passed roll on. */
export function subsWords(list: Sub[], today: string): string {
  if (!list.length) return 'No subscriptions listed yet. Say "Netflix £10.99 a month on the 14th" and I keep it.';
  const rolled = list.map((s) => {
    let next = s.next;
    while (next < today) next = advance({ every: s.every, next });
    return { ...s, next };
  });
  const total = rolled.reduce((k, s) => k + monthlyOf(s), 0);
  return `${rolled.length} subscription${rolled.length === 1 ? '' : 's'}, ${pounds(Math.round(total * 100) / 100)} a month (${pounds(Math.round(total * 1200) / 100)} a year; weekly ones as 52/12 a month, yearly as a twelfth): ${rolled
    .sort((a, b) => (a.next < b.next ? -1 : 1))
    .map((s) => `${s.name} ${pounds(s.amount)} a ${s.every}, renews ${prettyDay(s.next, today.slice(0, 4))}`)
    .join('; ')}.`;
}

// ---------------------------------------------------------------- a bill split

/**
 * A bill between names, to the penny: equal, or by the shares he gives ("Ali x2"), a tip added first when he says one.
 * Leftover pennies go to the first names, so the parts always add up to the total.
 */
export function splitBill(total: number, people: string[], tipPct = 0): { name: string; owes: number }[] {
  const named = people.map((p) => {
    const m = /^(.*?)\s*(?:x|×)\s*(\d+)$/i.exec(p.trim());
    return { name: (m ? m[1]! : p).trim() || 'someone', w: m ? Math.max(1, Number(m[2])) : 1 };
  });
  if (!named.length || !(total > 0)) return [];
  const pence = Math.round(total * (1 + tipPct / 100) * 100);
  const weight = named.reduce((k, p) => k + p.w, 0);
  const parts = named.map((p) => ({ name: p.name, p: Math.floor((pence * p.w) / weight) }));
  let left = pence - parts.reduce((k, p) => k + p.p, 0);
  for (let i = 0; left > 0; i = (i + 1) % parts.length, left--) parts[i]!.p++;
  return parts.map((p) => ({ name: p.name, owes: p.p / 100 }));
}

// ---------------------------------------------------------------- round-ups

/** Every payment out in a month that wasn't a whole pound, rounded up to the next pound: what that would have put aside. */
export function roundUps(rows: SpendRow[], month: string): { total: number; n: number } {
  let pence = 0;
  let n = 0;
  for (const r of rows) {
    if (!r.d.startsWith(month) || r.a >= 0 || r.c === 'income') continue;
    const p = Math.round(-r.a * 100);
    if (p % 100) {
      pence += 100 - (p % 100);
      n++;
    }
  }
  return { total: pence / 100, n };
}

// ---------------------------------------------------------------- payday

export type Payday = { day: number } | { last: 'day' | 'friday' | 'weekday' };

/** "the 28th", "28", "last friday of the month", "last working day", "last day of the month" → his payday rule. */
export function parsePayday(words: string): Payday | null {
  const w = words.toLowerCase();
  if (/last (?:working|week) ?day|last weekday/.test(w)) return { last: 'weekday' };
  if (/last friday/.test(w)) return { last: 'friday' };
  if (/last day/.test(w) || /end of (?:the )?month/.test(w)) return { last: 'day' };
  const m = /\b(\d{1,2})(?:st|nd|rd|th)?\b/.exec(w);
  if (m && +m[1]! >= 1 && +m[1]! <= 31) return { day: +m[1]! };
  return null;
}
/** Payday in a month: a fixed day kept inside the month and moved to the Friday before when it falls at a weekend. */
export function paydayIn(rule: Payday, y: number, m: number): string {
  const ymd = (d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const last = daysInMonth(y, m);
  if ('day' in rule) {
    let d = ymd(Math.min(rule.day, last));
    while (weekdayOf(d) === 0 || weekdayOf(d) === 6) d = addDays(d, -1);
    return d;
  }
  let d = ymd(last);
  if (rule.last === 'day') return d;
  while (rule.last === 'friday' ? weekdayOf(d) !== 5 : weekdayOf(d) === 0 || weekdayOf(d) === 6) d = addDays(d, -1);
  return d;
}
export function nextPayday(rule: Payday, today: string): string {
  const y = +today.slice(0, 4);
  const m = +today.slice(5, 7);
  const here = paydayIn(rule, y, m);
  return here >= today ? here : paydayIn(rule, m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1);
}
export const paydayRuleWords = (r: Payday): string => ('day' in r ? `the ${ordinal(r.day)} (the Friday before when that is a weekend)` : r.last === 'day' ? 'the last day of the month' : r.last === 'friday' ? 'the last Friday of the month' : 'the last working day of the month');
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;
/** The Brief's line: "Payday today", "Payday tomorrow", "Payday in 5 days (Fri 28 Nov)". */
export function paydayLine(rule: Payday, today: string): string {
  const next = nextPayday(rule, today);
  const n = daysBetween(today, next);
  return n === 0 ? 'Payday today' : n === 1 ? 'Payday tomorrow' : `Payday in ${n} days (${prettyDay(next)})`;
}

// ---------------------------------------------------------------- what if

/**
 * "if I save 50 a week", "put away £200 a month for 2 years at 4%" → what it comes to: monthly sums (a week is 52/12 of a
 * month), interest compounded monthly only when he names a rate, before tax. Three months, six, a year, and his own span.
 */
export function whatIf(words: string): { each: number; every: 'week' | 'month' | 'day'; monthly: number; rate: number; spans: { months: number; total: number }[] } | null {
  const each = moneyIn(words.replace(/\b\d+(?:\.\d+)?\s?%/g, ' ').replace(/\bfor \d+\s*(?:years?|months?|weeks?)\b/gi, ' '));
  if (each === null) return null;
  const every = /\b(?:a|per|every|each) day\b|\bdaily\b/i.test(words) ? 'day' : /\b(?:a|per|every|each) week\b|\bweekly\b/i.test(words) ? 'week' : 'month';
  const monthly = every === 'day' ? (each * 365) / 12 : every === 'week' ? (each * 52) / 12 : each;
  const rate = Number(/(\d+(?:\.\d+)?)\s?%/.exec(words)?.[1] ?? 0);
  const span = /\bfor (\d+)\s*(years?|months?|weeks?)\b/i.exec(words);
  const own = span ? Math.max(1, Math.round(/year/i.test(span[2]!) ? +span[1]! * 12 : /week/i.test(span[2]!) ? (+span[1]! * 12) / 52 : +span[1]!)) : 0;
  const months = [...new Set([3, 6, 12, ...(own ? [own] : [])])].sort((a, b) => a - b);
  const r = rate / 100 / 12;
  const total = (n: number) => Math.round((r ? monthly * ((Math.pow(1 + r, n) - 1) / r) : monthly * n) * 100) / 100;
  return { each, every, monthly: Math.round(monthly * 100) / 100, rate, spans: months.map((n) => ({ months: n, total: total(n) })) };
}
export function whatIfWords(w: NonNullable<ReturnType<typeof whatIf>>): string {
  const span = (n: number) => (n % 12 === 0 ? `${n / 12} year${n === 12 ? '' : 's'}` : `${n} months`);
  return `${pounds(w.each)} a ${w.every} is ${pounds(w.monthly)} a month: ${w.spans.map((s) => `${span(s.months)} → ${pounds(s.total)}`).join(', ')}. Assumed: ${w.every === 'week' ? 'a week as 52/12 of a month, ' : w.every === 'day' ? 'a day as 365/12 of a month, ' : ''}${w.rate ? `${w.rate}% a year compounded monthly, ` : 'no interest, '}before tax, every payment made.`;
}

// ---------------------------------------------------------------- warranty

/** "washing machine bought 3 March 2025, 2 year warranty" → the thing, the day bought, the months. */
export function parseWarranty(words: string, today: string): { thing: string; bought: string; months: number } | null {
  const span = /(\d+)\s*-?\s*(years?|yrs?|months?)\b/i.exec(words);
  if (!span) return null;
  const months = /y/i.test(span[2]!) ? +span[1]! * 12 : +span[1]!;
  const bought = dayWords(words.replace(span[0], ' '), today) || today;
  const thing = words.replace(span[0], ' ').replace(/\b(my|the|a|an|bought|on|warranty|guarantee|with|it has|has|got|of|in|last|from)\b/gi, ' ').replace(/\b\d{1,2}(?:st|nd|rd|th)?\b|\b\d{4}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b(?:today|yesterday)\b|[,.]/gi, ' ').replace(/\s+/g, ' ').trim();
  return months > 0 && months <= 240 ? { thing: thing.slice(0, 40) || 'it', bought, months } : null;
}
export const warrantyEnd = (bought: string, months: number): string => addDays(addMonths(bought, months), -1);

// ---------------------------------------------------------------- categories for the words

export const SPEND_CATEGORIES = CATEGORIES;
export { categorise, nextDayOfMonth };
