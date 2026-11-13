/**
 * Markets: crypto prices (CoinGecko's coins) and gold, silver and currencies (CoinGecko's exchange rates), both free
 * and keyless, through the brain's proxy. Every price carries the time it was read; nothing here says buy or sell.
 * His watchlist (which coins, in his order) and his holdings ("0.5 BTC") are his own data, kept on this phone only.
 *
 * Indices are gone: Stooq, their only free source, has wanted a key since March 2026 and now answers plain requests
 * with a browser check, and Frankfurter (the ECB's rates) moved to a host the proxy does not allow. `indices` stays,
 * empty and never fetched, because the Core's side panel still reads it.
 */
import { Feed, fetchJson } from '../api/feed';
import { fmt } from '../core/dom';
import { settings } from '../state/app';

export interface Coin {
  /** CoinGecko's id ('bitcoin'). */
  id: string;
  sym: string;
  name: string;
  price: number;
  /** The change over the last 24 hours, in %. */
  change: number;
  /** Hourly prices over the last seven days, oldest first (the last 25 are the last day). */
  spark: number[];
  high: number | null;
  low: number | null;
  /** The currency the prices are in ('gbp'), whatever Settings says now. */
  cur: string;
  /** When CoinGecko last updated the price (ms). */
  at: number;
}
export interface Quote {
  name: string;
  price: number;
  change: number;
}

// (the money words are pure, in the screen's words.ts, so the spec reads the very same ones)
export { CURRENCY_SYMBOL, money, moved, pct } from '../features/markets/words';

/** "14:02" on this phone's clock. */
export const clock = (t: number): string => fmt.time(new Date(t));
/** The last 24 hours of a coin's hourly prices. */
export const lastDay = (c: Coin): number[] => c.spark.slice(-25);

/** Prices read in the last ten minutes, from a source that answered last time: the only ones called live. */
export const FRESH_MS = 10 * 60_000;
export const fresh = (f: { status: string; data: unknown; at: number }): boolean => f.status === 'LIVE' && !!f.data && Date.now() - f.at < FRESH_MS;

/** A coin on his watchlist: CoinGecko's id, its symbol and name (kept on the phone, in his order). */
export interface Watched {
  id: string;
  sym: string;
  name: string;
}
/** The eight the tab has always shown, in the same order: his list until he changes it. */
export const DEFAULT_WATCH: Watched[] = [
  ['bitcoin', 'BTC', 'Bitcoin'], ['ethereum', 'ETH', 'Ethereum'], ['solana', 'SOL', 'Solana'], ['ripple', 'XRP', 'XRP'],
  ['dogecoin', 'DOGE', 'Dogecoin'], ['cardano', 'ADA', 'Cardano'], ['chainlink', 'LINK', 'Chainlink'], ['litecoin', 'LTC', 'Litecoin'],
].map(([id, sym, name]) => ({ id: id!, sym: sym!, name: name! }));
const WATCH_KEY = 'ghosty.markets.watch';
const HOLD_KEY = 'ghosty.markets.holdings';
/** The most coins the list reads (CoinGecko's free call takes them all at once). */
export const WATCH_MAX = 30;
/** Said on the window whenever his watchlist or holdings change (the tab repaints on it). */
export const MARKETS_CHANGED = 'ghosty:markets';
const tell = () => {
  try {
    dispatchEvent(new Event(MARKETS_CHANGED));
  } catch {
    /* (no window) */
  }
};

/** His watchlist, in his order (the eight until he changes it). */
export function loadWatch(): Watched[] {
  try {
    const raw = localStorage.getItem(WATCH_KEY);
    if (raw == null) return DEFAULT_WATCH.slice();
    const l = JSON.parse(raw) as Watched[];
    return Array.isArray(l) ? l.filter((w) => w && typeof w.id === 'string' && typeof w.name === 'string' && typeof w.sym === 'string').slice(0, WATCH_MAX) : DEFAULT_WATCH.slice();
  } catch {
    return DEFAULT_WATCH.slice();
  }
}
/** Keep the list (false: the phone would not keep it). */
export function saveWatch(l: Watched[]): boolean {
  try {
    localStorage.setItem(WATCH_KEY, JSON.stringify(l.slice(0, WATCH_MAX)));
  } catch {
    return false;
  }
  tell();
  return true;
}
/** His holdings: how much of each coin he says he has, by CoinGecko id ({ bitcoin: 0.5 }). His own numbers, kept on the phone. */
export function loadHoldings(): Record<string, number> {
  try {
    const o = JSON.parse(localStorage.getItem(HOLD_KEY) ?? '{}') as Record<string, unknown>;
    const out: Record<string, number> = {};
    if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = v;
    return out;
  } catch {
    return {};
  }
}
/**
 * Set (or with 0, take off) what he holds of one coin. A coin he holds joins his watchlist, so its price is read.
 * Returns 'added' when it joined the list, 'kept' when it was kept, 'full' when the list is full, 'failed' when the phone would not keep it.
 */
export function setHolding(w: Watched, amount: number): 'added' | 'kept' | 'full' | 'failed' {
  const h = loadHoldings();
  const l = loadWatch();
  const joins = amount > 0 && !l.some((x) => x.id === w.id);
  if (joins && l.length >= WATCH_MAX) return 'full';
  if (amount > 0 && Number.isFinite(amount)) h[w.id] = amount;
  else delete h[w.id];
  try {
    localStorage.setItem(HOLD_KEY, JSON.stringify(h));
  } catch {
    return 'failed';
  }
  if (joins) {
    if (!saveWatch([...l, w])) return 'failed';
    void coins.refresh(true);
    return 'added';
  }
  tell();
  return 'kept';
}

export const coins = new Feed<Coin[]>(
  'coins',
  async () => {
    const cur = settings.get().currency;
    const watch = loadWatch();
    if (!watch.length) return [];
    const j = await fetchJson<{ id?: string; symbol: string; name: string; current_price: number; price_change_percentage_24h: number | null; high_24h?: number | null; low_24h?: number | null; last_updated?: string; sparkline_in_7d?: { price: number[] } }[]>(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${cur}&ids=${watch.map((w) => encodeURIComponent(w.id)).join(',')}&price_change_percentage=24h&sparkline=true`,
      90,
    );
    const list = (Array.isArray(j) ? j : []).filter((c) => Number.isFinite(c?.current_price));
    if (!list.length) throw new Error('no prices in the answer');
    const now = Date.now();
    // (in his order; a coin the answer gives no id for is matched to his list by its symbol)
    const idOf = (c: { id?: string; symbol: string }) => c.id ?? watch.find((w) => w.sym === c.symbol.toUpperCase())?.id ?? c.symbol.toLowerCase();
    const order = (id: string) => {
      const i = watch.findIndex((w) => w.id === id);
      return i < 0 ? 999 : i;
    };
    return list
      .map((c) => {
        const t = Date.parse(c.last_updated ?? '');
        return {
          id: idOf(c),
          sym: c.symbol.toUpperCase(),
          name: c.name,
          price: c.current_price,
          change: c.price_change_percentage_24h ?? 0,
          spark: (c.sparkline_in_7d?.price ?? []).filter((x) => Number.isFinite(x)),
          high: c.high_24h ?? null,
          low: c.low_24h ?? null,
          cur,
          at: Number.isFinite(t) && t <= now ? t : now,
        };
      })
      .sort((a, b) => order(a.id) - order(b.id));
  },
  120_000,
);

/** One coin's price now, for a coin not on his list (the chat's "what's polkadot at"): null when CoinGecko has none. */
export async function priceOf(w: Watched): Promise<Coin | null> {
  const cur = settings.get().currency;
  const j = await fetchJson<{ id?: string; symbol: string; name: string; current_price: number; price_change_percentage_24h: number | null; last_updated?: string }[]>(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${cur}&ids=${encodeURIComponent(w.id)}&price_change_percentage=24h`,
    90,
  );
  const c = (Array.isArray(j) ? j : []).find((x) => Number.isFinite(x?.current_price));
  if (!c) return null;
  const t = Date.parse(c.last_updated ?? '');
  return { id: w.id, sym: c.symbol.toUpperCase(), name: c.name, price: c.current_price, change: c.price_change_percentage_24h ?? 0, spark: [], high: null, low: null, cur, at: Number.isFinite(t) && t <= Date.now() ? t : Date.now() };
}

/** CoinGecko's free search: coins whose name or symbol fit his words, biggest first (at most eight). */
export async function searchCoins(q: string): Promise<Watched[]> {
  const j = await fetchJson<{ coins?: { id?: string; name?: string; symbol?: string }[] }>(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q.trim())}`, 3600);
  return (j.coins ?? []).filter((c) => c.id && c.name && c.symbol).slice(0, 8).map((c) => ({ id: c.id!, sym: c.symbol!.toUpperCase(), name: c.name! }));
}

/** The ranges a coin's chart can show, as CoinGecko's free market_chart takes them (days). */
export const RANGES = [
  { key: '24H', days: 1, from: '24 hours ago', label: '24 hours' },
  { key: '7D', days: 7, from: '7 days ago', label: '7 days' },
  { key: '30D', days: 30, from: '30 days ago', label: '30 days' },
  { key: '1Y', days: 365, from: 'A year ago', label: 'a year' },
] as const;
export type Range = (typeof RANGES)[number];
/** A coin's prices over `days`, oldest first, in `cur` (CoinGecko's free market_chart; the proxy keeps it a while). */
export async function coinChart(id: string, cur: string, days: number): Promise<number[]> {
  const j = await fetchJson<{ prices?: [number, number][] }>(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=${cur}&days=${days}`, days <= 1 ? 300 : 3600);
  return (j.prices ?? []).map((p) => p?.[1]).filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
}

/** Kept for the Core's side panel: no free, keyless source gives the indices any more (see the top). */
export const indices = new Feed<Quote[]>('indices', async () => [], 3_600_000);

/** CoinGecko's exchange rates: how many of each currency (and ounces of gold and silver) one bitcoin buys. */
export interface Rates {
  per: Record<string, number>;
}
export const rates = new Feed<Rates>(
  'rates',
  async () => {
    const j = await fetchJson<{ rates?: Record<string, { value?: number }> }>('https://api.coingecko.com/api/v3/exchange_rates', 600);
    const per: Record<string, number> = {};
    for (const [k, v] of Object.entries(j.rates ?? {})) if (typeof v?.value === 'number' && v.value > 0) per[k] = v.value;
    if (!per.gbp || !per.usd) throw new Error('no rates in the answer');
    return { per };
  },
  600_000,
);

/** The currencies shown, with their names in words and their signs. */
export const FX: [code: string, name: string, sign: string][] = [
  ['gbp', 'Pound', '£'], ['usd', 'US dollar', '$'], ['eur', 'Euro', '€'], ['jpy', 'Japanese yen', '¥'],
  ['aed', 'UAE dirham', 'AED '], ['inr', 'Indian rupee', '₹'], ['pkr', 'Pakistani rupee', 'Rs '], ['chf', 'Swiss franc', 'CHF '],
];
/** What one unit of `from` buys in `to` (null: not in the answer). */
export function rate(r: Rates, from: string, to: string): number | null {
  const a = r.per[from], b = r.per[to];
  return a && b ? b / a : null;
}
/** An ounce of gold ('xau') or silver ('xag') in `cur`. */
export function ounce(r: Rates, metal: 'xau' | 'xag', cur: string): number | null {
  const a = r.per[metal], b = r.per[cur];
  return a && b ? b / a : null;
}
/** A rate in plain figures: $1.3374 · ¥209.80 · Rs 372.15. */
export function fxAmount(x: number, sign: string): string {
  const d = x >= 100 ? 2 : 4;
  return `${sign}${x.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}

/** The coin that moved most over the last day, either way. */
export function biggestMove(list: Coin[]): Coin | null {
  return list.reduce<Coin | null>((a, c) => (!a || Math.abs(c.change) > Math.abs(a.change) ? c : a), null);
}
