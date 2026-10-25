/** MARKETS tab: crypto, gold and silver, and currencies. */
import { send } from '../../assistant/session';
import { clear, h } from '../../core/dom';
import { clock, coins, CURRENCY_SYMBOL, fresh, FX, fxAmount, lastDay, money, ounce, pct, rate, rates, type Coin } from '../../data/markets';
import { go, type TabDef } from '../../shell/tabs';
import { settings } from '../../state/app';
import { button, panel, row, spark } from '../../ui/components';
import { page } from '../../ui/page';

export const marketsTab: TabDef = {
  id: 'markets',
  title: 'MARKETS',
  icon: '<path d="M3 20h18M6 16v-5M11 16V7M16 16v-8M21 16V4"/>',
  scene: 'backdrop',
  blurb: 'crypto · gold · currencies',
  now() {
    const btc = coins.data?.find((c) => c.sym === 'BTC');
    return btc ? `BTC ${btc.change >= 0 ? '+' : '−'}${Math.abs(btc.change).toFixed(2)}% today` : '';
  },
  mount(root) {
    const P = page(root, { tag: 'MARKET FIELD', sub: 'crypto · gold · currencies', rightLabel: 'GOLD / FX', leftLabel: 'CRYPTO', stack: true });
    const cp = panel('CRYPTO, LAST 24 HOURS', { footer: true, cls: 'coins' });
    const sym = () => CURRENCY_SYMBOL[settings.get().currency] ?? '';
    const coinRow = (c: Coin) => {
      // (in the currency the prices came in: a switch the source has not answered yet never relabels them)
      const r = row(c.sym, h('span', c.name, h('br'), h('small.mono', money(c.price, c.cur))), pct(c.change), {
        tone: c.change >= 0 ? 'up' : 'dn',
        onClick: () => {
          go('core');
          void send(`Give me a quick take on ${c.name}. It is ${sym()}${c.price} and moved ${c.change.toFixed(1)}% in 24 hours.`);
        },
      });
      // the trace is the same last 24 hours as the change beside it, in its colour (it was the week, coloured by the week)
      const tr = spark(lastDay(c));
      tr.dataset.tone = c.change >= 0 ? 'up' : 'dn';
      r.insertBefore(tr, r.lastChild);
      return r;
    };
    cp.foot!.prepend(button('£ / $ / €', () => {
      const order = ['gbp', 'usd', 'eur'] as const;
      settings.set({ currency: order[(order.indexOf(settings.get().currency) + 1) % 3]! });
      void coins.refresh(true);
    }));
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
    const coinsAt = () => Math.max(0, ...(coins.data ?? []).map((c) => c.at));
    const paint = () => {
      const list = coins.data ?? [];
      const cs = state(coins, coinsAt());
      const up = list.filter((c) => c.change > 0).length;
      P.big.textContent = list.length ? (up > list.length / 2 ? 'RISK ON' : 'RISK OFF') : cs.why || 'Loading';
      P.big.dataset.tone = !list.length ? '' : up > list.length / 2 ? 'up' : 'dn'; // route C colours it (amber when risk is off)
      P.sub.textContent = list[0] ? `${cs.live ? '' : `${cs.why || 'Not updated since'} · `}as of ${cs.asOf} · ${list[0].sym} ${money(list[0].price, list[0].cur)}` : '';
      if (list.length) clear(cp.body, ...list.map(coinRow));
      else clear(cp.body, nothing(coins));
      paintRates();
      stamp(cp, cs);
      const rs = state(rates, rates.at);
      stamp(mp, rs);
      stamp(fp, rs);
      const best = list.length ? Math.max(...list.map((c) => c.change)) : 0;
      const worst = list.length ? Math.min(...list.map((c) => c.change)) : 0;
      P.dials([
        ['UP', list.length ? up / list.length : 0, list.length ? `${Math.round((up / list.length) * 100)}%` : '--', '#52f2b5'],
        ['BEST', best / 15, pct(best, 1), '#52f2b5'],
        ['WORST', -worst / 15, pct(worst, 1), '#ff4d6a'],
      ]);
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
      describe: () => `Markets: ${P.big.textContent}. ${(coins.data ?? []).slice(0, 3).map((c) => `${c.sym} ${c.change.toFixed(1)}%`).join(', ')}`,
    };
  },
};
