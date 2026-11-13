/**
 * THE MARKETS FROM THE CHAT (planlane): what was asked, done on the phone, and said back in one line (assistant/local.ts calls this).
 * Prices come from CoinGecko's free calls the tab already makes, each with the time it was read; his watchlist and holdings are kept
 * on this phone. Never a call to buy or sell, never a forecast: what a price is and what his own coins are worth, nothing more.
 */
import type { PackReply } from '../../assistant/packs';
import { coinName, coins, fresh, FX, loadHoldings, loadWatch, ounce, priceOf, rate, rates, refreshCoins, saveWatch, searchCoins, setHolding, WATCH_MAX, type Coin, type Watched } from '../../data/markets';
import { settings } from '../../state/app';
import { marketsAsked, type CoinName } from './asks';
import { amountWords, asOfLine, cash, convertLine, heldLine, HOLD_NOTE, money, moved, totalLine, worth, WATCH_FULL, type Held } from './words';

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

/** A held coin with no price: its name and symbol (never its raw id), and whether it is on his list at all. */
interface Unpriced {
  id: string;
  name: string;
  sym: string;
  amount: number;
  listed: boolean;
}
/** His coins with today's prices (null: no prices at all). `at` is from the priced coins only (0 when none is priced). */
async function held(): Promise<{ list: Held[]; missing: Unpriced[]; at: number } | null> {
  await within(coins.refresh());
  const h = loadHoldings();
  const watch = loadWatch();
  if (!coins.data) return null;
  // (only the coins on his list as it is now: one just taken off is not priced from a read made before)
  const data = coins.data.filter((c) => watch.some((w) => w.id === c.id));
  const list: Held[] = [];
  const missing: Unpriced[] = [];
  for (const [id, amount] of Object.entries(h)) {
    const c = data.find((x) => x.id === id);
    if (c) list.push({ id, sym: c.sym, name: c.name, amount, price: c.price, change: c.change, cur: c.cur });
    else {
      const n = coinName(id);
      missing.push({ id, name: n?.name ?? 'a coin I can’t name', sym: n?.sym ?? '', amount, listed: watch.some((w) => w.id === id) });
    }
  }
  return { list, missing, at: list.length ? Math.max(...data.filter((c) => h[c.id]).map((c) => c.at)) : 0 };
}
/** Why a held coin has no price, and the next thing to do. */
const unpricedLine = (u: Unpriced): string =>
  u.listed
    ? `I haven’t read ${u.name}’s price yet; ask again in a minute.`
    : `${u.name} isn’t on your watchlist, so I don’t read its price. Say “add ${u.name.toLowerCase()} to my watchlist”.`;
const SEARCH_DOWN = 'CoinGecko’s search didn’t answer just now. Try again in a minute.';

/** A coin he named: his own list's first, then the ones the chat knows, then CoinGecko's search ('error': the search failed or took too long, which is not "no such coin"). */
async function resolve(q: string, coin: CoinName | null): Promise<Watched | null | 'error'> {
  const lq = q.toLowerCase();
  const mine = loadWatch().find((w) => w.id === coin?.id || w.name.toLowerCase() === lq || w.sym.toLowerCase() === lq);
  if (mine) return mine;
  if (coin) return coin;
  const found = await Promise.race([searchCoins(q).catch(() => 'error' as const), new Promise<'error'>((r) => setTimeout(() => r('error'), 8000))]);
  if (found === 'error') return 'error';
  return found.find((w) => w.name.toLowerCase() === lq || w.sym.toLowerCase() === lq) ?? found[0] ?? null;
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
    return { said, reply: `${convertLine(ask.amount, sign(ask.from), sign(ask.to), x)}. ${when(rates, rates.at)}`, go: GO };
  }

  if (ask.what === 'holdings') {
    const h = loadHoldings();
    if (!Object.keys(h).length) return { said, reply: 'You haven’t told me what you hold yet. Say “I have 0.2 bitcoin”, or open a coin in Markets and put it in. It stays on this phone.', go: GO };
    if (ask.coin && !h[ask.coin.id]) return { said, reply: `You haven’t told me you hold any ${ask.coin.name}. Say “I have 0.5 ${ask.coin.name.toLowerCase()}” and I’ll keep it on this phone.`, go: GO };
    const r = await held();
    if (!r) return { said, reply: NO_PRICES, go: GO, failed: true };
    const list = ask.coin ? r.list.filter((x) => x.id === ask.coin!.id) : r.list;
    const missing = ask.coin ? r.missing.filter((x) => x.id === ask.coin!.id) : r.missing;
    const miss = missing.map((u) => `You have ${amountWords(u.amount)}${u.sym ? ` ${u.sym}` : ''}${u.sym ? '' : ` of ${u.name}`}. ${unpricedLine(u)}`).join(' ');
    // (no coin priced: no total and no time, only what is missing and why)
    if (!list.length) return { said, reply: `${miss} ${HOLD_NOTE}`, go: GO };
    const lines = list.map(heldLine);
    const total = list.length > 1 ? `Together ${totalLine(list)} ` : '';
    return { said, reply: `${lines.join('; ')}. ${total}${when(coins, r.at)}${miss ? ` ${miss}` : ''} ${HOLD_NOTE}`, go: GO };
  }

  if (ask.what === 'hold') {
    const w = await resolve(ask.coin.name, ask.coin);
    if (!w || w === 'error') return { said, reply: NO_PRICES, go: GO, failed: true };
    const had = loadHoldings()[w.id];
    if (!ask.amount && !had) return { said, reply: `You hadn’t told me you hold any ${w.name}, so there was nothing to take off.`, go: GO };
    const done = setHolding(w, ask.amount);
    if (done === 'failed') return { said, reply: 'This phone wouldn’t keep that (its storage is full or blocked).', go: GO, failed: true };
    if (done === 'full') return { said, reply: WATCH_FULL(WATCH_MAX), go: GO };
    if (!ask.amount) return { said, reply: `Done: no ${w.name} on your list of holdings now.${loadWatch().some((x) => x.id === w.id) ? ' It stays on your watchlist.' : ''}`, go: GO };
    // (a coin that just joined his list is read by a fresh call, waited for, not dropped behind a read already running)
    await within(done === 'added' ? refreshCoins() : coins.refresh());
    const c = coins.data?.find((x) => x.id === w.id);
    const now = c ? ` That’s ${cash(worth(ask.amount, c.price, c.change).now, c.cur)} now. ${when(coins, c.at)}` : '';
    return { said, reply: `Noted: you have ${amountWords(ask.amount)} ${w.sym}.${now}${done === 'added' ? ` ${w.name} is on your watchlist now.` : ''} Your amounts are kept on this phone; this chat goes to the brain like any other.`, go: GO };
  }

  if (ask.what === 'list') {
    const l = loadWatch();
    if (!l.length) return { said, reply: 'Your watchlist is empty. Say “add bitcoin to my watchlist”, or tap EDIT LIST in Markets.', go: GO };
    return { said, reply: `On your watchlist (${l.length}): ${l.map((w) => w.name).join(', ')}.`, go: GO };
  }

  if (ask.what === 'watch') {
    const l = loadWatch();
    const w = await resolve(ask.q, ask.coin);
    if (navigator.onLine === false && !w) return { said, reply: 'You’re offline, so I can’t look that coin up. Try again with a signal.', go: GO };
    if (w === 'error') return { said, reply: navigator.onLine === false ? 'You’re offline, so I can’t look that coin up. Try again with a signal.' : SEARCH_DOWN, go: GO, failed: true };
    if (!w) return { said, reply: `I couldn’t find a coin called “${ask.q}” on CoinGecko. Check the spelling, or try its symbol.`, go: GO };
    if (l.some((x) => x.id === w.id)) return { said, reply: `${w.name} is already on your watchlist.`, go: GO };
    if (l.length >= WATCH_MAX) return { said, reply: WATCH_FULL(WATCH_MAX), go: GO };
    if (!saveWatch([...l, w])) return { said, reply: 'This phone wouldn’t keep that (its storage is full or blocked).', go: GO, failed: true };
    await within(refreshCoins());
    const c = coins.data?.find((x) => x.id === w.id);
    return { said, reply: `${w.name} is on your watchlist now (${l.length + 1} coins).${c ? ` It’s ${money(c.price, c.cur)}, ${moved(c.change)} over 24 hours. ${when(coins, c.at)}` : ''}`, go: GO };
  }

  if (ask.what === 'unwatch') {
    const l = loadWatch();
    const lq = ask.q.toLowerCase();
    const w = l.find((x) => x.id === ask.coin?.id || x.name.toLowerCase() === lq || x.sym.toLowerCase() === lq);
    if (!w) return { said, reply: `${ask.coin?.name ?? `“${ask.q}”`} isn’t on your watchlist.`, go: GO };
    if (!saveWatch(l.filter((x) => x !== w))) return { said, reply: 'This phone wouldn’t keep that (its storage is full or blocked).', go: GO, failed: true };
    void refreshCoins();
    const h = loadHoldings()[w.id];
    return { said, reply: `${w.name} is off your watchlist (${l.length - 1} left).${h ? ` You still hold ${amountWords(h)} ${w.sym}, so its price is no longer read: say “I don’t have any ${w.name.toLowerCase()}” to take that off too.` : ''}`, go: GO };
  }
  return null;
}
