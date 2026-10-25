/**
 * Markets: crypto prices (CoinGecko's coins) and gold, silver and currencies (CoinGecko's exchange rates), both free
 * and keyless, through the brain's proxy. Every price carries the time it was read; nothing here says buy or sell.
 *
 * Indices are gone: Stooq, their only free source, has wanted a key since March 2026 and now answers plain requests
 * with a browser check, and Frankfurter (the ECB's rates) moved to a host the proxy does not allow. `indices` stays,
 * empty and never fetched, because the Core's side panel still reads it.
 */
import { Feed, fetchJson } from '../api/feed';
import { fmt } from '../core/dom';
import { settings } from '../state/app';

export interface Coin {
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

export const CURRENCY_SYMBOL: Record<string, string> = { gbp: '£', usd: '$', eur: '€' };

/** A price in plain money: £60,411 · £141.70 · £0.1543 (pence kept under £1,000; four figures under £1). */
export function money(x: number, cur: string): string {
  const sym = CURRENCY_SYMBOL[cur] ?? `${cur.toUpperCase()} `;
  if (!Number.isFinite(x)) return '—';
  const o: Intl.NumberFormatOptions = x >= 1000 ? { maximumFractionDigits: 0 } : x >= 1 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumSignificantDigits: 4, minimumSignificantDigits: 2 };
  return `${sym}${x.toLocaleString('en-GB', o)}`;
}
/** A change with a true minus sign: +0.20% · −1.31%. */
export const pct = (x: number, d = 2): string => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(d)}%`;
/** The change in words: "up 0.20%", "down 1.31%". */
export const moved = (x: number, d = 2): string => `${x >= 0 ? 'up' : 'down'} ${Math.abs(x).toFixed(d)}%`;
/** "14:02" on this phone's clock. */
export const clock = (t: number): string => fmt.time(new Date(t));
/** The last 24 hours of a coin's hourly prices. */
export const lastDay = (c: Coin): number[] => c.spark.slice(-25);

/** Prices read in the last ten minutes, from a source that answered last time: the only ones called live. */
export const FRESH_MS = 10 * 60_000;
export const fresh = (f: Feed<unknown>): boolean => f.status === 'LIVE' && !!f.data && Date.now() - f.at < FRESH_MS;

export const coins = new Feed<Coin[]>(
  'coins',
  async () => {
    const cur = settings.get().currency;
    const j = await fetchJson<{ symbol: string; name: string; current_price: number; price_change_percentage_24h: number | null; high_24h?: number | null; low_24h?: number | null; last_updated?: string; sparkline_in_7d?: { price: number[] } }[]>(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${cur}&ids=bitcoin,ethereum,solana,ripple,dogecoin,cardano,chainlink,litecoin&price_change_percentage=24h&sparkline=true`,
      90,
    );
    const list = (Array.isArray(j) ? j : []).filter((c) => Number.isFinite(c?.current_price));
    if (!list.length) throw new Error('no prices in the answer');
    const now = Date.now();
    return list.map((c) => {
      const t = Date.parse(c.last_updated ?? '');
      return {
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
    });
  },
  120_000,
);

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
