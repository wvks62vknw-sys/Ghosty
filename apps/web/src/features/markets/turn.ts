/**
 * THE MARKETS FROM THE CHAT (planlane): what was asked, done on the phone, and said back in one line (assistant/local.ts calls this).
 * Prices come from CoinGecko's free calls the tab already makes, each with the time it was read; his watchlist and holdings are kept
 * on this phone. Never a call to buy or sell, never a forecast: what a price is and what his own coins are worth, nothing more.
 */
import type { PackReply } from '../../assistant/packs';
import { clock, coins, fresh, FX, loadHoldings, loadWatch, ounce, priceOf, rate, rates, saveWatch, searchCoins, setHolding, WATCH_MAX, type Coin, type Watched } from '../../data/markets';
import { settings } from '../../state/app';
import { marketsAsked, type CoinName } from './asks';
import { amountWords, asOfLine, cash, heldLine, HOLD_NOTE, money, moved, totalLine, worth, WATCH_FULL, type Held } from './words';

const GO = [{ id: 'screen:markets', ask: -1, label: 'Open Markets', open: 'markets' }];
const within = <T>(p: Promise<T>, ms = 8000): Promise<T | null> => Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]).catch(() => null);
const NO_PRICES = 'I can’t reach CoinGecko right now, so I have no prices to give you. Try again in a minute.';

/** When a price was read, and whether it is current: "As of 14:02, from CoinGecko." */
function when(f: { status: string; data: unknown; at: number }, at: number): string {
  const live = fresh(f);
  const why = live ? '' : navigator.onLine === false ? ' (you’re offline)' : f.status === 'STALE' || f.status === 'NO FEED' ? ' (CoinGecko can’t be reached)' : '';
  return `${asOfLine(at, Date.now(), live).replace(/\.$/, '')}${why}, from CoinGecko.`;
}
const sign = (code: string): string => FX.find(([c]) => c === code)?.[2] ?? `${code.toUpperCase()} `;
const fxName = (code: string): string => FX.find(([c]) => c === code)?.[1] ?? code.toUpperCase();
const amountOf = (x: number, code: string): string => `${sign(code)}${x.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** His coins with today's prices (null: no prices at all). */
async function held(): Promise<{ list: Held[]; missing: string[]; at: number } | null> {
  await within(coins.refresh());
  const data = coins.data;
  const h = loadHoldings();
  const watch = loadWatch();
  if (!data) return null;
  const list: Held[] = [];
  const missing: string[] = [];
  for (const [id, amount] of Object.entries(h)) {
    const c = data.find((x) => x.id === id);
    if (c) list.push({ id, sym: c.sym, name: c.name, amount, price: c.price, change: c.change, cur: c.cur });
    else missing.push(watch.find((w) => w.id === id)?.name ?? id);
  }
  return { list, missing, at: Math.max(0, ...data.map((c) => c.at)) };
}

/** A coin he named: his own list's first, then the ones the chat knows, then CoinGecko's search. */
async function resolve(q: string, coin: CoinName | null): Promise<Watched | null> {
  const lq = q.toLowerCase();
  const mine = loadWatch().find((w) => w.id === coin?.id || w.name.toLowerCase() === lq || w.sym.toLowerCase() === lq);
  if (mine) return mine;
  if (coin) return coin;
  const found = await within(searchCoins(q));
  return found?.find((w) => w.name.toLowerCase() === lq || w.sym.toLowerCase() === lq) ?? found?.[0] ?? null;
}

/** The answer, or null to let the next table (and then the brain) answer. */
export async function marketsTurn(text: string): Promise<PackReply | null> {
  const ask = marketsAsked(text);
  if (!ask) return null;
  const said = text;
  const cur = settings.get().currency;

  if (ask.what === 'price') {
    await within(coins.refresh());
    let c: Coin | null = coins.data?.find((x) => x.id === ask.coin.id) ?? null;
    let f: { status: string; data: unknown; at: number } = coins;
    if (!c) {
      c = await within(priceOf(ask.coin));
      f = { status: c ? 'LIVE' : 'NO FEED', data: c, at: Date.now() };
    }
    if (!c) return { said, reply: NO_PRICES, go: GO, failed: true };
    const mine = loadHoldings()[c.id];
    const yours = mine ? ` Your ${amountWords(mine)} ${c.sym} is ${cash(worth(mine, c.price, c.change).now, c.cur)}.` : '';
    return { said, reply: `${c.name} is ${money(c.price, c.cur)}, ${moved(c.change)} over 24 hours.${yours} ${when(f, c.at)}`, go: GO };
  }

  if (ask.what === 'metal') {
    await within(rates.refresh());
    const r = rates.data;
    const g = r ? ounce(r, 'xau', cur) : null, s = r ? ounce(r, 'xag', cur) : null;
    if (g == null && s == null) return { said, reply: NO_PRICES, go: GO, failed: true };
    const bits = ask.metal === 'xau' ? [`Gold is ${money(g!, cur)} an ounce`] : ask.metal === 'xag' ? [`Silver is ${money(s!, cur)} an ounce`] : [`Gold is ${money(g!, cur)} an ounce`, `silver ${money(s!, cur)}`];
    return { said, reply: `${bits.join(', ')}. ${when(rates, rates.at)}`, go: GO };
  }

  if (ask.what === 'convert') {
    await within(rates.refresh());
    const r = rates.data;
    const x = r ? rate(r, ask.from, ask.to) : null;
    if (x == null) return { said, reply: r ? `CoinGecko’s rates don’t have ${fxName(ask.from === 'gbp' ? ask.to : ask.from)} in them, so I can’t work that one out.` : NO_PRICES, go: GO, failed: !r };
    return { said, reply: `${amountOf(ask.amount, ask.from)} is ${amountOf(ask.amount * x, ask.to)} (${sign(ask.from)}1 buys ${sign(ask.to)}${x.toLocaleString('en-GB', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}). ${when(rates, rates.at)}`, go: GO };
  }

  if (ask.what === 'holdings') {
    const h = loadHoldings();
    if (!Object.keys(h).length) return { said, reply: 'You haven’t told me what you hold yet. Say “I have 0.2 bitcoin”, or open a coin in Markets and put it in. It stays on this phone.', go: GO };
    const r = await held();
    if (!r) return { said, reply: NO_PRICES, go: GO, failed: true };
    const list = ask.coin ? r.list.filter((x) => x.id === ask.coin!.id) : r.list;
    if (ask.coin && !list.length) return { said, reply: `You haven’t told me you hold any ${ask.coin.name}. Say “I have 0.5 ${ask.coin.name.toLowerCase()}” and I’ll keep it on this phone.`, go: GO };
    const lines = list.map(heldLine);
    const total = list.length > 1 ? `Together ${totalLine(list)} ` : '';
    const miss = r.missing.length && !ask.coin ? ` I have no price yet for ${r.missing.join(', ')}.` : '';
    return { said, reply: `${lines.join('; ')}. ${total}${when(coins, r.at)}${miss} ${HOLD_NOTE}`, go: GO };
  }

  if (ask.what === 'hold') {
    const w = await resolve(ask.coin.name, ask.coin);
    if (!w) return { said, reply: NO_PRICES, go: GO, failed: true };
    const done = setHolding(w, ask.amount);
    if (done === 'failed') return { said, reply: 'This phone wouldn’t keep that (its storage is full or blocked).', go: GO, failed: true };
    if (done === 'full') return { said, reply: WATCH_FULL(WATCH_MAX), go: GO };
    if (!ask.amount) return { said, reply: `Done: no ${w.name} on your list of holdings now. It stays on your watchlist.`, go: GO };
    await within(coins.refresh(done === 'added'));
    const c = coins.data?.find((x) => x.id === w.id);
    const now = c ? ` That’s ${cash(worth(ask.amount, c.price, c.change).now, c.cur)} now. ${when(coins, c.at)}` : '';
    return { said, reply: `Noted: you have ${amountWords(ask.amount)} ${w.sym}.${now}${done === 'added' ? ` ${w.name} is on your watchlist now.` : ''} Kept on this phone only.`, go: GO };
  }

  if (ask.what === 'list') {
    const l = loadWatch();
    if (!l.length) return { said, reply: 'Your watchlist is empty. Say “add bitcoin to my watchlist”, or tap EDIT LIST in Markets.', go: GO };
    return { said, reply: `On your watchlist (${l.length}): ${l.map((w) => w.name).join(', ')}.`, go: GO };
  }

  if (ask.what === 'watch') {
    const l = loadWatch();
    const w = await resolve(ask.q, ask.coin);
    if (!w) return { said, reply: navigator.onLine === false ? 'You’re offline, so I can’t look that coin up. Try again with a signal.' : `I couldn’t find a coin called “${ask.q}” on CoinGecko. Check the spelling, or try its symbol.`, go: GO };
    if (l.some((x) => x.id === w.id)) return { said, reply: `${w.name} is already on your watchlist.`, go: GO };
    if (l.length >= WATCH_MAX) return { said, reply: WATCH_FULL(WATCH_MAX), go: GO };
    if (!saveWatch([...l, w])) return { said, reply: 'This phone wouldn’t keep that (its storage is full or blocked).', go: GO, failed: true };
    await within(coins.refresh(true));
    const c = coins.data?.find((x) => x.id === w.id);
    return { said, reply: `${w.name} is on your watchlist now (${l.length + 1} coins).${c ? ` It’s ${money(c.price, c.cur)}, ${moved(c.change)} over 24 hours. ${when(coins, c.at)}` : ''}`, go: GO };
  }

  if (ask.what === 'unwatch') {
    const l = loadWatch();
    const lq = ask.q.toLowerCase();
    const w = l.find((x) => x.id === ask.coin?.id || x.name.toLowerCase() === lq || x.sym.toLowerCase() === lq);
    if (!w) return { said, reply: `${ask.coin?.name ?? `“${ask.q}”`} isn’t on your watchlist.`, go: GO };
    if (!saveWatch(l.filter((x) => x !== w))) return { said, reply: 'This phone wouldn’t keep that (its storage is full or blocked).', go: GO, failed: true };
    void coins.refresh(true);
    const h = loadHoldings()[w.id];
    return { said, reply: `${w.name} is off your watchlist (${l.length - 1} left).${h ? ` You still hold ${amountWords(h)} ${w.sym}, so its price is no longer read: say “I don’t have any ${w.name.toLowerCase()}” to take that off too.` : ''}`, go: GO };
  }
  return null;
}
