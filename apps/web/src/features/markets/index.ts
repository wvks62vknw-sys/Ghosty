/**
 * MARKETS tab: his watchlist of coins, his holdings worth now, gold and silver, and currencies. Every price says when it was read
 * and where from; old prices are never called live. His watchlist and holdings stay on this phone. Never a buy or sell call,
 * never a forecast.
 */
import { send } from '../../assistant/session';
import { clear, h, svgEl } from '../../core/dom';
import { biggestMove, clock, coinChart, coins, CURRENCY_SYMBOL, fresh, FX, fxAmount, lastDay, loadHoldings, loadWatch, MARKETS_CHANGED, money, moved, ounce, pct, RANGES, rate, rates, saveWatch, searchCoins, setHolding, WATCH_MAX, type Coin, type Range } from '../../data/markets';
import { go, type TabDef } from '../../shell/tabs';
import { screenSays } from '../../shell/awareness';
import { settings } from '../../state/app';
import { button, modal, panel, row, spark, toast, undo } from '../../ui/components';
import { sparkInst } from '../../ui/instruments';
import { page } from '../../ui/page';
import { sayError } from '../../ui/hisWords';
import {
  amountIn, amountWords, asOfLine, cash, HOLD_EMPTY, HOLD_EMPTY_NEXT, HOLD_NOTE, movedMoney, NOT_READ, RANGE_ERROR, RANGE_LOADING, RANGE_OFFLINE, RETRY, RETRYING,
  SEARCH_ERROR, SEARCH_HINT, SEARCH_LOADING, SEARCH_NONE, SEARCH_OFFLINE, sheetAsOf, totalLine, WATCH_EMPTY, WATCH_EMPTY_NEXT, WATCH_FULL, WEEK_EMPTY, worth, type Held,
} from './words';
import { waiting } from '../../ui/wait';

const btc = () => coins.data?.find((c) => c.sym === 'BTC') ?? null;
const KEPT_FAIL = 'This phone wouldn’t keep that (its storage is full or blocked).';

/** A coin's prices over a range as a chart: the line between its own high and low (labelled beside it, so the scale is plain). */
function rangeChart(c: Coin, v: number[], r: Range): HTMLElement {
  /* state: markets.prices empty */
  if (v.length < 2) return h('p.mknote.mkweekempty', WEEK_EMPTY);
  const W = 320, H = 140;
  const lo = Math.min(...v), hi = Math.max(...v), span = Math.max(1e-9, hi - lo);
  const pts = v.map((x, i) => `${((i / (v.length - 1)) * W).toFixed(1)},${(6 + (1 - (x - lo) / span) * (H - 12)).toFixed(1)}`);
  const up = v[v.length - 1]! >= v[0]!;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: `mkchart ${up ? 'up' : 'dn'}`, preserveAspectRatio: 'none', role: 'img', 'aria-label': `${c.name} over ${r.label}, from ${money(lo, c.cur)} to ${money(hi, c.cur)}` });
  svg.append(
    svgEl('line', { x1: 0, x2: W, y1: 6, y2: 6, class: 'grid' }),
    svgEl('line', { x1: 0, x2: W, y1: H - 6, y2: H - 6, class: 'grid' }),
    svgEl('polyline', { points: pts.join(' '), fill: 'none', 'vector-effect': 'non-scaling-stroke' }),
  );
  return h('div.mkchartbox',
    h('div.mky', h('span', `High ${money(hi, c.cur)}`), h('span', `Low ${money(lo, c.cur)}`)),
    svg,
    h('div.mkx', h('span', r.from), h('span', 'Now')));
}
/** The change over a range, in words: "Over 30 days: up 4.10%." */
const overLine = (v: number[], r: Range): string => (v.length > 1 && v[0]! > 0 ? `Over ${r.label}: ${moved(((v[v.length - 1]! - v[0]!) / v[0]!) * 100)}.` : '');

/**
 * A coin, opened in place: its price and when it was read, its chart over 24 H, 7 D, 30 D or 1 Y, its last day's range, what he
 * holds of it (his own number, kept on the phone), and ASK WHY IT MOVED, which asks the chat for what happened, never whether to
 * buy or sell.
 */
/** The coin open in its sheet now (for this screen's own sentence). */
let coinOpen: Coin | null = null;
function openCoin(c: Coin, s: { live: boolean; asOf: string; why: string; at: number }): void {
  coinOpen = c;
  const tone = c.change >= 0 ? 'up' : 'dn';
  const ask = button('ASK WHY IT MOVED', () => {
    m.close();
    go('core');
    void send(`Why has ${c.name} moved over the last 24 hours? It is ${money(c.price, c.cur)} now, ${moved(c.change)}. Just what happened, not whether to buy or sell.`);
  }, 'on mkask');
  // THE RANGES: 7 D is the week the list already holds; the others are read from CoinGecko's free market_chart when tapped
  const box = h('div.mkrangebox');
  const over = h('p.mknote.mkover');
  const cache = new Map<number, number[]>();
  let want = 7;
  const show = (r: Range) => {
    want = r.days;
    keys.forEach((k) => k.setAttribute('aria-pressed', String(k.dataset.days === String(r.days))));
    const have = r.days === 7 ? c.spark : cache.get(r.days);
    if (have) {
      clear(box, rangeChart(c, have, r));
      over.textContent = overLine(have, r);
      return;
    }
    over.textContent = '';
    if (navigator.onLine === false) {
      /* state: markets.chart offline */
      clear(box, h('p.mknote.mkrangewait', RANGE_OFFLINE));
      return;
    }
    /* state: markets.chart loading */
    clear(box, h('p.mknote.mkrangewait', { role: 'status' }, RANGE_LOADING));
    coinChart(c.id, c.cur, r.days).then((v) => {
      if (v.length > 1) cache.set(r.days, v);
      if (want !== r.days || !box.isConnected) return;
      clear(box, v.length > 1 ? rangeChart(c, v, r) : h('p.mknote.mkweekempty', WEEK_EMPTY));
      over.textContent = overLine(v, r);
    }, (e) => {
      if (want !== r.days || !box.isConnected) return;
      /* state: markets.chart error */
      clear(box, h('p.mknote.mkrangewait.bad', { role: 'alert', title: sayError(e, 'read that range') }, RANGE_ERROR));
    });
  };
  const keys = RANGES.map((r) => {
    const k = button(r.key, () => show(r));
    k.dataset.days = String(r.days);
    k.setAttribute('aria-label', `Show ${r.label}`);
    return k;
  });
  // WHAT HE HOLDS: his own number, kept on this phone; what it is worth now and how that moved over 24 hours
  const amt = h('input.mkamt', { inputmode: 'decimal', placeholder: 'e.g. 0.5', 'aria-label': `How much ${c.name} you have`, maxlength: '24', value: loadHoldings()[c.id] ? String(loadHoldings()[c.id]) : '' });
  const heldSay = h('p.mknote.mkheldsay');
  const paintHeld = () => {
    const a = loadHoldings()[c.id];
    if (!a) heldSay.textContent = `Put in how much ${c.sym} you have and I’ll show what it’s worth. ${HOLD_NOTE}`;
    else {
      const w = worth(a, c.price, c.change);
      heldSay.textContent = `${amountWords(a)} ${c.sym} is ${cash(w.now, c.cur)} now, ${movedMoney(w.day, c.cur)} over 24 hours. ${HOLD_NOTE}`;
    }
    off.hidden = !a;
  };
  const save = button('SAVE', () => {
    const v = amountIn(amt.value);
    if (v == null) return toast('Put in a number, like 0.5', 'warn');
    const r = setHolding({ id: c.id, sym: c.sym, name: c.name }, v);
    if (r === 'failed') return toast(KEPT_FAIL, 'bad');
    paintHeld();
    toast(v ? `Kept: ${amountWords(v)} ${c.sym}, on this phone only` : `${c.name} taken off your holdings`, 'ok');
  }, 'on mksave');
  const off = button('TAKE OFF', () => {
    const was = loadHoldings()[c.id];
    if (!was) return;
    if (setHolding({ id: c.id, sym: c.sym, name: c.name }, 0) === 'failed') return toast(KEPT_FAIL, 'bad');
    amt.value = '';
    paintHeld();
    undo(`${c.name} taken off your holdings`, () => {
      setHolding({ id: c.id, sym: c.sym, name: c.name }, was);
      if (amt.isConnected) {
        amt.value = String(was);
        paintHeld();
      }
    });
  }, 'mkoff');
  amt.addEventListener('keydown', (e) => e.key === 'Enter' && save.click());
  paintHeld();
  const m = modal(c.name, h('div.mkcoin', { dataset: { case: 'keep' } },
    h('div.mkprice', h('b.tnum', money(c.price, c.cur)), h(`span.${tone}` as 'span', `${moved(c.change)} in 24 hours`)),
    h('p.mkasof', sheetAsOf(s.live, s.why, s.at, Date.now())),
    h('div.mkranges', { role: 'group', 'aria-label': 'Chart range' }, ...keys),
    box,
    over,
    h('p.mknote', c.low != null && c.high != null ? `Last 24 hours: ${money(c.low, c.cur)} to ${money(c.high, c.cur)}.` : ''),
    h('div.mkhold', h('b', 'You have'), h('div.mkholdrow', amt, h('span.mksym', c.sym), save, off), heldSay),
    ask), () => (coinOpen = null));
  show(RANGES[1]);
}

/** EDIT LIST: his watchlist in his order (↑ ↓ to move, ✕ to take off, with UNDO) and CoinGecko's free search to add any coin. */
function editList(): void {
  const list = h('div.mkwl');
  const paintList = () => {
    const l = loadWatch();
    /* state: markets.watchlist empty */
    if (!l.length) return void clear(list, h('div.empty', h('b', WATCH_EMPTY), h('span', 'Search below to add one.')));
    clear(list, ...l.map((w, i) => {
      const move = (d: number) => {
        const n = loadWatch();
        const j = i + d;
        if (j < 0 || j >= n.length) return;
        [n[i], n[j]] = [n[j]!, n[i]!];
        if (!saveWatch(n)) return toast(KEPT_FAIL, 'bad');
        paintList();
        void coins.refresh(true);
      };
      const up = button('↑', () => move(-1), 'mkmv');
      up.setAttribute('aria-label', `Move ${w.name} up`);
      up.disabled = i === 0;
      const dn = button('↓', () => move(1), 'mkmv');
      dn.setAttribute('aria-label', `Move ${w.name} down`);
      dn.disabled = i === l.length - 1;
      const x = button('✕', () => {
        const before = loadWatch();
        if (!saveWatch(before.filter((y) => y.id !== w.id))) return toast(KEPT_FAIL, 'bad');
        paintList();
        void coins.refresh(true);
        undo(`${w.name} taken off your watchlist`, () => {
          saveWatch(before);
          if (list.isConnected) paintList();
          void coins.refresh(true);
        });
      }, 'mkmv mkx');
      x.setAttribute('aria-label', `Take ${w.name} off the list`);
      return h('div.mkwlrow', h('span.mkwln', h('b', w.name), h('small', w.sym)), up, dn, x);
    }));
  };
  const q = h('input.mkq', { type: 'search', placeholder: 'Add a coin: name or symbol', 'aria-label': 'Search CoinGecko for a coin', maxlength: '40', enterkeyhint: 'search' });
  const found = h('div.mkfound', { role: 'status' }, h('p.mknote', SEARCH_HINT));
  const find = button('SEARCH', () => {
    const words = q.value.trim();
    if (!words) return void clear(found, h('p.mknote', SEARCH_HINT));
    if (navigator.onLine === false) {
      /* state: markets.watchlist offline */
      return void clear(found, h('p.mknote', SEARCH_OFFLINE));
    }
    /* state: markets.watchlist loading */
    clear(found, h('p.mknote', SEARCH_LOADING));
    find.disabled = true;
    searchCoins(words).then((res) => {
      find.disabled = false;
      if (!res.length) return void clear(found, h('p.mknote', SEARCH_NONE(words)));
      clear(found, ...res.map((w) => {
        const on = loadWatch().some((y) => y.id === w.id);
        const add = button(on ? 'ON THE LIST' : 'ADD', () => {
          const l = loadWatch();
          if (l.some((y) => y.id === w.id)) return;
          if (l.length >= WATCH_MAX) return toast(WATCH_FULL(WATCH_MAX), 'warn');
          if (!saveWatch([...l, w])) return toast(KEPT_FAIL, 'bad');
          add.textContent = 'ON THE LIST';
          add.disabled = true;
          paintList();
          void coins.refresh(true);
        }, on ? 'mkadd' : 'on mkadd');
        add.disabled = on;
        add.setAttribute('aria-label', on ? `${w.name} is on your list` : `Add ${w.name}`);
        return h('div.mkwlrow', h('span.mkwln', h('b', w.name), h('small', w.sym)), add);
      }));
    }, (e) => {
      find.disabled = false;
      /* state: markets.watchlist error */
      clear(found, h('p.mknote.bad', { role: 'alert', title: sayError(e, 'search CoinGecko') }, SEARCH_ERROR));
    });
  }, 'on mkfind');
  q.addEventListener('keydown', (e) => e.key === 'Enter' && find.click());
  paintList();
  modal('YOUR WATCHLIST', h('div.mkedit', { dataset: { case: 'keep' } },
    h('p.mknote', `Your coins, in your order (${WATCH_MAX} at most). Kept on this phone.`),
    list,
    h('div.mksearch', q, find),
    found));
}

/** The day in a word, from the last 24 hours of the coins: a description, never advice. */
export function dayWord(list: Coin[]): string {
  const n = list.length;
  if (!n) return '';
  if (list.every((c) => Math.abs(c.change) < 1)) return 'Quiet day';
  const up = list.filter((c) => c.change > 0).length;
  return up >= (2 * n) / 3 ? 'Mostly up' : n - up >= (2 * n) / 3 ? 'Mostly down' : 'Mixed';
}

export const marketsTab: TabDef = {
  id: 'markets',
  title: 'MARKETS',
  icon: '<path d="M3 20h18M6 16v-5M11 16V7M16 16v-8M21 16V4"/>',
  scene: 'backdrop',
  blurb: 'crypto · gold · currencies',
  // The deck's line and the Plan hub's card read the same prices as the tab: Bitcoin over the last 24 hours, and
  // never called live (or given a change as now) once they are old or the source has stopped answering.
  now() {
    const b = btc();
    return b && fresh(coins) ? `Bitcoin ${pct(b.change)} · 24 h` : '';
  },
  status: () => (fresh(coins) ? 'LIVE' : coins.status === 'NO FEED' || coins.status === 'STALE' ? 'OFF' : 'READY'),
  instrument: () => {
    const b = btc();
    return sparkInst(b ? lastDay(b) : [], (b?.change ?? 0) >= 0);
  },
  readouts: () => {
    const b = btc();
    const live = fresh(coins);
    return [
      { label: 'Bitcoin', value: b ? money(b.price, b.cur) : null, live },
      live || !b ? { label: '24 h', value: b ? pct(b.change) : null } : { label: 'As of', value: clock(b.at) },
    ];
  },
  mount(root) {
    const P = page(root, { tag: 'MARKETS', rightLabel: 'GOLD / FX', leftLabel: 'CRYPTO', stack: true });
    // The top says what moved, in plain words, from the prices it holds: never a call to buy or sell.
    const say = h('p.mksay', { dataset: { case: 'keep' } });
    P.sub.after(say);
    P.big.dataset.case = 'keep'; // (its words are written in sentence case already: "CoinGecko", not "Coingecko")
    const cp = panel('CRYPTO, LAST 24 HOURS', { footer: true, cls: 'coins' });
    const coinRow = (c: Coin) => {
      // (in the currency the prices came in: a switch the source has not answered yet never relabels them)
      const r = row(c.sym, h('span', c.name, h('br'), h('small.mono', money(c.price, c.cur))), pct(c.change), {
        tone: c.change >= 0 ? 'up' : 'dn',
        onClick: () => openCoin(c, state(coins, c.at)),
      });
      // the trace is the same last 24 hours as the change beside it, in its colour (it was the week, coloured by the week)
      const tr = spark(lastDay(c));
      tr.dataset.tone = c.change >= 0 ? 'up' : 'dn';
      r.insertBefore(tr, r.lastChild);
      return r;
    };
    // Prices in £, $ or €: three 44 pt buttons, the one in use marked (it was one "£ / $ / €" button that cycled).
    const curBtns = (['gbp', 'usd', 'eur'] as const).map((c) => {
      const b = button(CURRENCY_SYMBOL[c]!, () => {
        if (settings.get().currency === c) return;
        settings.set({ currency: c });
        markCur();
        paint();
        void coins.refresh(true);
      });
      b.dataset.cur = c;
      b.setAttribute('aria-label', `Prices in ${c === 'gbp' ? 'pounds' : c === 'usd' ? 'dollars' : 'euros'}`);
      return b;
    });
    const markCur = () => curBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cur === settings.get().currency)));
    markCur();
    const edit = button('EDIT LIST', () => editList(), 'mkeditl');
    edit.setAttribute('aria-label', 'Edit your watchlist: add, take off or move coins');
    cp.foot!.append(h('span.mkcurl', 'Prices in'), h('div.mkcur', { role: 'group', 'aria-label': 'Currency' }, ...curBtns), edit);
    // YOUR COINS: what he holds (his own numbers, kept on this phone), worth now in his currency and today's move. Never advice.
    const hp = panel('YOUR COINS', { cls: 'held', grow: false });
    const paintHeld = () => {
      const h0 = loadHoldings();
      const ids = Object.keys(h0);
      /* state: markets.holdings empty */
      if (!ids.length) return void clear(hp.body, h('div.empty', h('b', HOLD_EMPTY), h('span', HOLD_EMPTY_NEXT)));
      const data = coins.data ?? [];
      const list: Held[] = [];
      const rows: HTMLElement[] = [];
      for (const id of ids) {
        const c = data.find((x) => x.id === id);
        const name = c?.name ?? loadWatch().find((w) => w.id === id)?.name ?? id;
        if (!c) {
          /* state: markets.holdings loading */
          rows.push(row(null, h('span', name, h('br'), h('small', `${amountWords(h0[id]!)} · ${coins.data ? 'not on your watchlist, so no price is read' : 'price not read yet'}`)), NOT_READ));
          continue;
        }
        const held: Held = { id, sym: c.sym, name: c.name, amount: h0[id]!, price: c.price, change: c.change, cur: c.cur };
        list.push(held);
        const w = worth(held.amount, c.price, c.change);
        rows.push(row(null, h('span', c.name, h('br'), h('small.mono', `${amountWords(held.amount)} ${c.sym} · ${movedMoney(w.day, c.cur)}`)), cash(w.now, c.cur), { tone: w.day >= 0 ? 'up' : 'dn', onClick: () => openCoin(c, state(coins, c.at)) }));
      }
      const live = fresh(coins);
      const top = list.length ? h('p.mkheldtot', { dataset: { case: 'keep' } }, h('b.tnum', totalLine(list)), h('span', ` ${asOfLine(coinsAt(), Date.now(), live)}${live ? '' : ' Not up to date.'}`)) : null;
      clear(hp.body, ...(top ? [top] : []), ...rows, h('p.mknote.mkheldnote', HOLD_NOTE));
    };
    P.left.append(cp.el, hp.el);
    // GOLD & SILVER and CURRENCY: one free call (CoinGecko's exchange rates), worked out in his currency.
    const mp = panel('GOLD & SILVER', { cls: 'metals', grow: false });
    // (both from CoinGecko, read every ten minutes)
    const fp = panel('WHAT £1 BUYS', { cls: 'fx', grow: false });
    const paintRates = () => {
      const r = rates.data;
      const cur = settings.get().currency;
      if (!r) return void [mp, fp].forEach((p) => clear(p.body, nothing(rates)));
      clear(mp.body, ...(['xau', 'xag'] as const).map((m) => {
        const x = ounce(r, m, cur);
        return row(null, m === 'xau' ? 'Gold' : 'Silver', x == null ? NOT_READ : `${money(x, cur)} an ounce`);
      }));
      const mine = FX.find(([c]) => c === cur)!;
      clear(fp.body, ...FX.filter(([c]) => c !== cur).map(([c, name, sign]) => {
        const x = rate(r, cur, c);
        return row(null, name, x == null ? NOT_READ : fxAmount(x, sign));
      }));
      fp.title.textContent = `WHAT ${mine[2].trim()}1 BUYS`;
    };
    P.right.append(mp.el, fp.el);
    // When the prices were read, and whether they can still be called current: every panel says "as of 14:02";
    // prices older than ten minutes, or from a source that stopped answering, say so instead of looking live.
    const state = (f: typeof coins | typeof rates, at: number) => {
      const off = navigator.onLine === false;
      const why = off ? 'You’re offline' : f.status === 'STALE' || f.status === 'NO FEED' ? 'CoinGecko can’t be reached' : '';
      return { has: !!f.data, live: fresh(f), asOf: f.data ? clock(at) : '', why, at };
    };
    const stamp = (p: typeof cp, s: ReturnType<typeof state>) =>
      s.has ? p.setStatus(`AS OF ${s.asOf}`, s.live ? 'ok' : 'mid') : p.setStatus(s.why ? 'CAN’T REACH' : 'LOADING', s.why ? 'off' : 'mid');
    // A panel with nothing to show says why, naming the source (never "--" or "NO FEED").
    const nothing = (f: typeof coins | typeof rates) => {
      const s = state(f, f.at);
      const head = s.why ? (s.why.startsWith('You') ? s.why : 'CoinGecko can’t be reached right now') : 'Loading the prices…';
      const line = s.why ? 'The prices show again as soon as it answers.' : 'From CoinGecko, free.';
      // (error and offline: RETRY asks again at once; loading: the wait said)
      /* state: markets.prices loading */
      /* state: markets.prices error */
      /* state: markets.prices offline */
      const el = h(`div.empty${s.why ? '.bad' : '.wait'}` as 'div', h('b', { dataset: { case: 'keep' } }, head), h('span', line));
      if (s.why && f === coins) {
        const again = button(RETRY, () => {
          again.disabled = true;
          const done = waiting(el, RETRYING);
          void Promise.allSettled([coins.refresh(true), rates.refresh(true)]).then(() => {
            done();
            again.disabled = false;
          });
        }, 'on mkretry');
        el.append(again);
      }
      return el;
    };
    // "Dogecoin moved most, up 5.20% to £0.1543. Bitcoin £60,411, up 0.20%. Gold £2,988 an ounce; £1 buys $1.34."
    const sentence = (list: Coin[]) => {
      const top = biggestMove(list);
      const btc = list.find((c) => c.sym === 'BTC');
      const out: string[] = [];
      if (top) out.push(`${top.name} moved most, ${moved(top.change)} to ${money(top.price, top.cur)}.`);
      if (btc && btc !== top) out.push(`Bitcoin ${money(btc.price, btc.cur)}, ${moved(btc.change)}.`);
      const r = rates.data;
      const cur = settings.get().currency;
      if (r) {
        const g = ounce(r, 'xau', cur);
        const other = cur === 'gbp' ? 'usd' : 'gbp';
        const x = rate(r, cur, other);
        const bits = [g != null ? `Gold ${money(g, cur)} an ounce` : '', x != null ? `${CURRENCY_SYMBOL[cur]}1 buys ${CURRENCY_SYMBOL[other]}${x.toFixed(2)}` : ''].filter(Boolean);
        if (bits.length) out.push(`${bits.join('; ')}.`);
      }
      return out.join(' ');
    };
    const coinsAt = () => Math.max(0, ...(coins.data ?? []).map((c) => c.at));
    const paint = () => {
      const list = coins.data ?? [];
      const cs = state(coins, coinsAt());
      // (his watchlist emptied: said, with the way to fill it, never "Loading" for ever)
      const none = !loadWatch().length;
      P.big.textContent = none ? WATCH_EMPTY : !list.length ? (cs.why ? 'No prices right now' : 'Loading the prices') : cs.live ? dayWord(list) : 'Not up to date';
      P.big.dataset.tone = cs.live && /up/.test(P.big.textContent) ? 'up' : cs.live && /down/.test(P.big.textContent) ? 'dn' : '';
      P.sub.textContent = none ? WATCH_EMPTY_NEXT : !list.length ? (cs.why.startsWith('You') ? cs.why : cs.why ? `${cs.why}. It tries again every two minutes.` : '') : cs.live ? `Last 24 hours · as of ${cs.asOf}` : `${cs.why || 'Not updated since'} · as of ${cs.asOf}`;
      say.textContent = list.length && !none ? `${sentence(list)} ${asOfLine(coinsAt(), Date.now(), cs.live)}` : '';
      if (none) clear(cp.body, h('div.empty', h('b', WATCH_EMPTY), h('span', WATCH_EMPTY_NEXT)));
      else if (list.length) clear(cp.body, ...list.map(coinRow));
      else clear(cp.body, nothing(coins));
      paintHeld();
      paintRates();
      if (none) cp.setStatus('YOUR LIST IS EMPTY', 'mid');
      else stamp(cp, cs);
      const rs = state(rates, rates.at);
      stamp(mp, rs);
      stamp(fp, rs);
    };
    for (const f of [coins, rates]) f.onChange(paint);
    // his list or holdings changed (here, in a sheet, or from the chat): drawn again at once
    addEventListener(MARKETS_CHANGED, () => root.isConnected && paint());
    // back on the screen after a while: the "as of" and the colour of the light are worked out again
    document.addEventListener('visibilitychange', () => !document.hidden && root.isConnected && paint());
    addEventListener('online', paint);
    addEventListener('offline', paint);
    paint();
    return {
      enter() {
        // (start() polls; a phone back from sleep reads again at once if what it holds is old)
        coins.start();
        rates.start();
        void coins.refresh();
        void rates.refresh();
        paint();
      },
      // (BRIEF-SHELL pass 1) the coin open, else the one that moved most
      context: () => {
        const c = coinOpen ?? biggestMove(coins.data ?? []);
        return screenSays('markets', 'Markets', `the markets, ${(P.big.textContent || 'loading').toLowerCase()}${c ? `, on ${c.name}` : ''}`, {
          looking: 'the markets',
          ...(c ? { selected: { kind: 'item', id: `coin:${c.sym}`, label: c.name, detail: `${money(c.price, c.cur)}, ${moved(c.change)}${coinOpen ? '' : ', moved most'}` } } : {}),
        });
      },
      describe: () => {
        const n = Object.keys(loadHoldings()).length;
        return `Markets: ${P.big.textContent}. ${P.sub.textContent}. ${say.textContent}${n ? ` He has told me his holdings of ${n} coin${n === 1 ? '' : 's'} (on the screen under YOUR COINS).` : ''}`;
      },
    };
  },
};

