/** MARKETS tab: crypto, gold and silver, and currencies. */
import { send } from '../../assistant/session';
import { clear, h, svgEl } from '../../core/dom';
import { biggestMove, clock, coins, CURRENCY_SYMBOL, fresh, FX, fxAmount, lastDay, money, moved, ounce, pct, rate, rates, type Coin } from '../../data/markets';
import { go, type TabDef } from '../../shell/tabs';
import { settings } from '../../state/app';
import { button, modal, panel, row, spark } from '../../ui/components';
import { sparkInst } from '../../ui/instruments';
import { page } from '../../ui/page';

const btc = () => coins.data?.find((c) => c.sym === 'BTC') ?? null;

/** A coin's week as a chart: the line between its own high and low (labelled beside it, so the scale is plain). */
function weekChart(c: Coin): HTMLElement {
  const v = c.spark;
  if (v.length < 2) return h('p.mknote', 'No week of prices yet.');
  const W = 320, H = 140;
  const lo = Math.min(...v), hi = Math.max(...v), span = Math.max(1e-9, hi - lo);
  const pts = v.map((x, i) => `${((i / (v.length - 1)) * W).toFixed(1)},${(6 + (1 - (x - lo) / span) * (H - 12)).toFixed(1)}`);
  const up = v[v.length - 1]! >= v[0]!;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: `mkchart ${up ? 'up' : 'dn'}`, preserveAspectRatio: 'none', role: 'img', 'aria-label': `${c.name} over 7 days, from ${money(lo, c.cur)} to ${money(hi, c.cur)}` });
  svg.append(
    svgEl('line', { x1: 0, x2: W, y1: 6, y2: 6, class: 'grid' }),
    svgEl('line', { x1: 0, x2: W, y1: H - 6, y2: H - 6, class: 'grid' }),
    svgEl('polyline', { points: pts.join(' '), fill: 'none', 'vector-effect': 'non-scaling-stroke' }),
  );
  return h('div.mkchartbox',
    h('div.mky', h('span', `High ${money(hi, c.cur)}`), h('span', `Low ${money(lo, c.cur)}`)),
    svg,
    h('div.mkx', h('span', '7 days ago'), h('span', 'Now')));
}

/**
 * A coin, opened in place: its price and when it was read, its week as a chart, its last day's range, and ASK WHY IT
 * MOVED, which asks the chat for what happened, never whether to buy or sell (it used to leave the tab at once
 * with "Give me a quick take on…").
 */
function openCoin(c: Coin, s: { live: boolean; asOf: string; why: string }): void {
  const v = c.spark;
  const week = v.length > 1 ? ((v[v.length - 1]! - v[0]!) / v[0]!) * 100 : null;
  const tone = c.change >= 0 ? 'up' : 'dn';
  const ask = button('ASK WHY IT MOVED', () => {
    m.close();
    go('core');
    void send(`Why has ${c.name} moved over the last 24 hours? It is ${money(c.price, c.cur)} now, ${moved(c.change)}. Just what happened, not whether to buy or sell.`);
  }, 'on mkask');
  const m = modal(c.name, h('div.mkcoin', { dataset: { case: 'keep' } },
    h('div.mkprice', h('b.tnum', money(c.price, c.cur)), h(`span.${tone}` as 'span', `${moved(c.change)} in 24 hours`)),
    h('p.mkasof', `${s.live ? '' : `${s.why || 'Not updated since'} · `}As of ${s.asOf} · from CoinGecko`),
    weekChart(c),
    h('p.mknote', [week != null ? `Over 7 days: ${moved(week)}.` : '', c.low != null && c.high != null ? `Last 24 hours: ${money(c.low, c.cur)} to ${money(c.high, c.cur)}.` : ''].filter(Boolean).join(' ')),
    ask));
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
    cp.foot!.append(h('span.mkcurl', 'Prices in'), h('div.mkcur', { role: 'group', 'aria-label': 'Currency' }, ...curBtns));
    P.left.append(cp.el);
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
        return row(null, m === 'xau' ? 'Gold' : 'Silver', x == null ? '—' : `${money(x, cur)} an ounce`);
      }));
      const mine = FX.find(([c]) => c === cur)!;
      clear(fp.body, ...FX.filter(([c]) => c !== cur).map(([c, name, sign]) => {
        const x = rate(r, cur, c);
        return row(null, name, x == null ? '—' : fxAmount(x, sign));
      }));
      fp.title.textContent = `WHAT ${mine[2].trim()}1 BUYS`;
    };
    P.right.append(mp.el, fp.el);
    // When the prices were read, and whether they can still be called current: every panel says "as of 14:02";
    // prices older than ten minutes, or from a source that stopped answering, say so instead of looking live.
    const state = (f: typeof coins | typeof rates, at: number) => {
      const off = navigator.onLine === false;
      const why = off ? 'You’re offline' : f.status === 'STALE' || f.status === 'NO FEED' ? 'CoinGecko can’t be reached' : '';
      return { has: !!f.data, live: fresh(f), asOf: f.data ? clock(at) : '', why };
    };
    const stamp = (p: typeof cp, s: ReturnType<typeof state>) =>
      s.has ? p.setStatus(`AS OF ${s.asOf}`, s.live ? 'ok' : 'mid') : p.setStatus(s.why ? 'CAN’T REACH' : 'LOADING', s.why ? 'off' : 'mid');
    // A panel with nothing to show says why, naming the source (never "--" or "NO FEED").
    const nothing = (f: typeof coins | typeof rates) => {
      const s = state(f, f.at);
      const head = s.why ? (s.why.startsWith('You') ? s.why : 'CoinGecko can’t be reached right now') : 'Loading the prices…';
      const line = s.why ? 'The prices show again as soon as it answers.' : 'From CoinGecko, free.';
      return h(`div.empty${s.why ? '.bad' : '.wait'}` as 'div', h('b', { dataset: { case: 'keep' } }, head), h('span', line));
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
      P.big.textContent = !list.length ? (cs.why ? 'No prices right now' : 'Loading the prices') : cs.live ? dayWord(list) : 'Not up to date';
      P.big.dataset.tone = cs.live && /up/.test(P.big.textContent) ? 'up' : cs.live && /down/.test(P.big.textContent) ? 'dn' : '';
      P.sub.textContent = !list.length ? (cs.why.startsWith('You') ? cs.why : cs.why ? `${cs.why}. It tries again every two minutes.` : '') : cs.live ? `Last 24 hours · as of ${cs.asOf}` : `${cs.why || 'Not updated since'} · as of ${cs.asOf}`;
      say.textContent = sentence(list);
      if (list.length) clear(cp.body, ...list.map(coinRow));
      else clear(cp.body, nothing(coins));
      paintRates();
      stamp(cp, cs);
      const rs = state(rates, rates.at);
      stamp(mp, rs);
      stamp(fp, rs);
    };
    for (const f of [coins, rates]) f.onChange(paint);
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
      describe: () => `Markets: ${P.big.textContent}. ${P.sub.textContent}. ${say.textContent}`,
    };
  },
};
