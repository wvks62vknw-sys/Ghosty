/** Markets: crypto (CoinGecko), indices and commodities (Stooq), currencies (Frankfurter/ECB). */
import { Feed, fetchJson, fetchText } from '../api/feed';
import { settings } from '../state/app';

export interface Coin {
  sym: string;
  name: string;
  price: number;
  change: number;
  spark: number[];
}
export interface Quote {
  name: string;
  price: number;
  change: number;
}

export const CURRENCY_SYMBOL: Record<string, string> = { gbp: '£', usd: '$', eur: '€' };

export const coins = new Feed<Coin[]>(
  'coins',
  async () => {
    const cur = settings.get().currency;
    const j = await fetchJson<{ symbol: string; name: string; current_price: number; price_change_percentage_24h: number; sparkline_in_7d?: { price: number[] } }[]>(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${cur}&ids=bitcoin,ethereum,solana,ripple,dogecoin,cardano,chainlink,litecoin&price_change_percentage=24h&sparkline=true`,
      90,
    );
    return j.map((c) => ({ sym: c.symbol.toUpperCase(), name: c.name, price: c.current_price, change: c.price_change_percentage_24h ?? 0, spark: (c.sparkline_in_7d?.price ?? []).filter((_, i) => i % 4 === 0) }));
  },
  120_000,
);

const INDEX_NAMES: Record<string, string> = { '^SPX': 'S&P 500', '^NDX': 'NASDAQ 100', '^UKX': 'FTSE 100', '^DAX': 'DAX', '^NKX': 'NIKKEI 225', XAUUSD: 'GOLD $/oz', 'CL.F': 'CRUDE OIL' };

export const indices = new Feed<Quote[]>(
  'indices',
  async () => {
    const t = await fetchText('https://stooq.com/q/l/?s=^spx,^ndx,^ukx,^dax,^nkx,xauusd,cl.f&f=sd2t2ohlc&h&e=csv', 120);
    return t
      .trim()
      .split(/\r?\n/)
      .slice(1)
      .map((l) => {
        const c = l.split(',');
        const open = Number(c[3]);
        const close = Number(c[6]);
        if (!Number.isFinite(open) || !Number.isFinite(close) || !open) return null;
        return { name: INDEX_NAMES[c[0]!.toUpperCase()] ?? c[0]!, price: close, change: ((close - open) / open) * 100 };
      })
      .filter((x): x is Quote => !!x);
  },
  120_000,
);

export const fx = new Feed<Quote[]>(
  'fx',
  async () => {
    const cur = settings.get().currency.toUpperCase();
    const j = await fetchJson<{ rates: Record<string, number> }>(`https://api.frankfurter.app/latest?from=${cur}&to=USD,EUR,GBP,JPY,AED,INR,PKR,CHF`, 600);
    return Object.entries(j.rates).map(([k, v]) => ({ name: `${cur}/${k}`, price: v, change: 0 }));
  },
  600_000,
);
