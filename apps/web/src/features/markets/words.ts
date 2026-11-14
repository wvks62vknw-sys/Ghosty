/**
 * THE MARKETS' words, pure (the spec imports this file): a price is never bare, it has the time it was read and, when it is old,
 * how old; a panel with nothing says what it is waiting for and offers RETRY; a gold or currency row not read yet says so.
 * His holdings are his own numbers: what they are worth now and how much that moved over the last 24 hours, never advice,
 * never a forecast.
 */
export const clockOf = (t: number): string => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export const CURRENCY_SYMBOL: Record<string, string> = { gbp: '£', usd: '$', eur: '€' };

/** A price in plain money: £60,411 · £141.70 · £0.1543 (pence kept under £1,000; four figures under £1). */
export function money(x: number, cur: string): string {
  const sym = CURRENCY_SYMBOL[cur] ?? `${cur.toUpperCase()} `;
  if (!Number.isFinite(x)) return '—';
  const o: Intl.NumberFormatOptions = x >= 1000 ? { maximumFractionDigits: 0 } : x >= 1 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumSignificantDigits: 4, minimumSignificantDigits: 2 };
  return `${sym}${x.toLocaleString('en-GB', o)}`;
}
/** A sum of his own money, to the penny, without its sign (the words say up or down): £30,205.50 · £12.30 · £0.42. */
export function cash(x: number, cur: string): string {
  const sym = CURRENCY_SYMBOL[cur] ?? `${cur.toUpperCase()} `;
  if (!Number.isFinite(x)) return '—';
  return `${sym}${Math.abs(x).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
/** A change with a true minus sign: +0.20% · −1.31%. */
export const pct = (x: number, d = 2): string => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(d)}%`;
/** The change in words: "up 0.20%", "down 1.31%". */
export const moved = (x: number, d = 2): string => `${x >= 0 ? 'up' : 'down'} ${Math.abs(x).toFixed(d)}%`;
/** An amount of a coin as he would write it: 0.5 · 1,250 · 0.00012 (never a rounded-away holding). */
export const amountWords = (x: number): string => x.toLocaleString('en-GB', { maximumFractionDigits: x >= 1 ? 4 : 8 });

/** What a holding is worth now, and how much that moved over the last 24 hours (from the coin's own 24 h change). */
export function worth(amount: number, price: number, change: number): { now: number; day: number } {
  const now = amount * price;
  const before = now / (1 + change / 100);
  return { now, day: Number.isFinite(before) ? now - before : 0 };
}
/** A move in money: "up £12.30", "down £3.10", "no change". */
export const movedMoney = (x: number, cur: string): string => (Math.abs(x) < 0.005 ? 'no change' : `${x >= 0 ? 'up' : 'down'} ${cash(x, cur)}`);

export interface Held {
  id: string;
  sym: string;
  name: string;
  amount: number;
  price: number;
  change: number;
  cur: string;
}
/** All he holds together: worth now, its move over 24 hours in money and in %. */
export function totals(list: Held[]): { now: number; day: number; pct: number } {
  let now = 0, day = 0;
  for (const h of list) {
    const w = worth(h.amount, h.price, h.change);
    now += w.now;
    day += w.day;
  }
  const before = now - day;
  return { now, day, pct: before > 0 ? (day / before) * 100 : 0 };
}
/** The top line of YOUR COINS: "£31,042.10, up £70.20 (0.23%) over 24 hours." */
export function totalLine(list: Held[]): string {
  if (!list.length) return '';
  const cur = list[0]!.cur;
  const t = totals(list);
  return `${cash(t.now, cur)}, ${movedMoney(t.day, cur)}${Math.abs(t.day) < 0.005 ? '' : ` (${Math.abs(t.pct).toFixed(2)}%)`} over 24 hours.`;
}
/** One holding said: "0.5 BTC, £30,205.50, up £60.30 over 24 hours". */
export function heldLine(h: Held): string {
  const w = worth(h.amount, h.price, h.change);
  return `${amountWords(h.amount)} ${h.sym}, ${cash(w.now, h.cur)}, ${movedMoney(w.day, h.cur)} over 24 hours`;
}
/** Every holding's figures are his: said under the panel and in the chat. */
export const HOLD_NOTE = 'Your own numbers, kept on this phone. What they are worth now, never advice.';
/** YOUR COINS with nothing in it. */
export const HOLD_EMPTY = 'No holdings yet.';
export const HOLD_EMPTY_NEXT = 'Open a coin and put in how much you have, or say “I have 0.2 bitcoin”.';
/** An amount he types: "0.5", "1,250", "0,5" (a comma as the point when it is the only one). Null when it is not a number. */
export function amountIn(s: string): number | null {
  let t = s.trim().replace(/\s+/g, '');
  if (!t) return null;
  // (a leading "0," is always the point: 0,125 is an eighth, never a hundred and twenty-five)
  if (/^0,\d+$/.test(t) || (/^\d+,\d{1,8}$/.test(t) && !/^[1-9]\d{0,2},\d{3}$/.test(t))) t = t.replace(',', '.');
  t = t.replace(/,/g, '');
  if (!/^\d*\.?\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** How old a reading is, as he says it: "just now", "12 minutes ago", "3 hours ago", "2 days ago". */
export function ageWords(at: number, now: number): string {
  const m = Math.max(0, Math.floor((now - at) / 60_000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(m / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const d = Math.floor(hrs / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

/** The time a price was read: "As of 14:02." while it is current, "As of 14:02, 12 minutes ago." when it is not. */
export const asOfLine = (at: number, now: number, live: boolean): string => `As of ${clockOf(at)}${live ? '' : `, ${ageWords(at, now)}`}.`;

/** The coin sheet's line: why the price is old (if it is), when it was read, and where from. */
export function sheetAsOf(live: boolean, why: string, at: number, now: number): string {
  return `${live ? '' : `${why || 'Not updated since'} · `}${asOfLine(at, now, live).replace(/\.$/, '')} · from CoinGecko`;
}

/** A coin whose week is not there yet. */
export const WEEK_EMPTY = 'I have not read a week of prices for this one yet. It fills in as I read more.';
/** A range of the chart being read, and one that could not be. */
export const RANGE_LOADING = 'Reading the prices for this range from CoinGecko…';
export const RANGE_ERROR = 'CoinGecko didn’t send this range just now. Tap the range again to retry, or pick 7D.';
export const RANGE_OFFLINE = 'You’re offline, so only the last 7 days are here. The other ranges come back with a signal.';
/** A gold, silver or currency row not read yet. */
export const NOT_READ = 'not read yet';
export const RETRY = 'RETRY';
export const RETRYING = 'Asking again…';
/** The watchlist with nothing on it. */
export const WATCH_EMPTY = 'Your watchlist is empty.';
export const WATCH_EMPTY_NEXT = 'Tap EDIT LIST and search for a coin to add it.';
/** The search under EDIT LIST, in each of its states. */
export const SEARCH_HINT = 'Type a coin’s name or symbol, e.g. Polkadot or DOT.';
export const SEARCH_LOADING = 'Searching CoinGecko…';
export const SEARCH_NONE = (q: string): string => `No coin called “${q}” on CoinGecko. Check the spelling, or try its symbol.`;
export const SEARCH_ERROR = 'CoinGecko’s search didn’t answer. Tap SEARCH to try again.';
export const SEARCH_OFFLINE = 'You’re offline. Search works again with a signal.';
export const WATCH_FULL = (n: number): string => `Your watchlist holds ${n} coins at most. Take one off to add another.`;

/** An amount of money with its sign, to the penny: £50.00 · €59.69 · CHF 55.17. */
export const fxCash = (x: number, sign: string): string => `${sign}${x.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** The converter's answer: "£50.00 is €59.69 (£1 buys €1.1937)". */
export const convertLine = (amount: number, fromSign: string, toSign: string, x: number): string =>
  `${fxCash(amount, fromSign)} is ${fxCash(amount * x, toSign)} (${fromSign.trim()}1 buys ${toSign}${x.toLocaleString('en-GB', { minimumFractionDigits: 4, maximumFractionDigits: 4 })})`;
/** The converter before the rates are read, and with no amount. */
export const CONVERT_WAIT = 'The converter works as soon as CoinGecko’s rates are read.';
export const CONVERT_NEED = 'Put in an amount, like 100.';
