/** MARKETS tab: crypto, gold and silver, and currencies. */
import { send } from '../../assistant/session';
import { clear, fmt, h } from '../../core/dom';
import { coins, CURRENCY_SYMBOL, FX, fxAmount, money, ounce, pct, rate, rates, type Coin } from '../../data/markets';
import { go, type TabDef } from '../../shell/tabs';
import { settings } from '../../state/app';
import { button, empty, pager, panel, row, spark } from '../../ui/components';
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
    const cp = panel('CRYPTO · 24H', { footer: true, status: 'COINGECKO', cls: 'coins' });
    const sym = () => CURRENCY_SYMBOL[settings.get().currency] ?? '';
    const cg = pager(cp, 52, (c: Coin) => {
      // (in the currency the prices came in: a switch the source has not answered yet never relabels them)
      const r = row(c.sym, h('span', c.name, h('br'), h('small.mono', money(c.price, c.cur))), pct(c.change), {
        tone: c.change >= 0 ? 'up' : 'dn',
        onClick: () => {
          go('core');
          void send(`Give me a quick take on ${c.name}. It is ${sym()}${c.price} and moved ${c.change.toFixed(1)}% in 24 hours.`);
        },
      });
      r.insertBefore(spark(c.spark), r.lastChild);
      return r;
    }, () => coins.status);
    cp.foot!.prepend(button('£ / $ / €', () => {
      const order = ['gbp', 'usd', 'eur'] as const;
      settings.set({ currency: order[(order.indexOf(settings.get().currency) + 1) % 3]! });
      void coins.refresh(true);
    }));
    P.left.append(cp.el);
    // GOLD & SILVER and CURRENCY: one free call (CoinGecko's exchange rates), worked out in his currency.
    const mp = panel('GOLD & SILVER', { cls: 'metals', grow: false });
    const fp = panel('WHAT £1 BUYS', { cls: 'fx', grow: false });
    const paintRates = () => {
      const r = rates.data;
      const cur = settings.get().currency;
      const none = (p: typeof mp) => clear(p.body, empty(rates.status));
      if (!r) return void [mp, fp].forEach(none);
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
    const paint = () => {
      const list = coins.data ?? [];
      const up = list.filter((c) => c.change > 0).length;
      P.big.textContent = list.length ? (up > list.length / 2 ? 'RISK ON' : 'RISK OFF') : '--';
      P.big.style.color = up > list.length / 2 ? '#52f2b5' : '#ff4d6a';
      P.big.dataset.tone = !list.length ? '' : up > list.length / 2 ? 'up' : 'dn'; // route C colours it (amber when risk is off)
      P.sub.textContent = list[0] ? `${coins.status} · ${list[0].sym} ${money(list[0].price, list[0].cur)}` : coins.status;
      cg.set(list);
      paintRates();
      cp.setStatus(coins.status, coins.status === 'LIVE' ? 'ok' : 'off');
      mp.setStatus(rates.status, rates.status === 'LIVE' ? 'ok' : 'off');
      fp.setStatus(rates.status, rates.status === 'LIVE' ? 'ok' : 'off');
      const best = list.length ? Math.max(...list.map((c) => c.change)) : 0;
      const worst = list.length ? Math.min(...list.map((c) => c.change)) : 0;
      P.dials([
        ['UP', list.length ? up / list.length : 0, list.length ? `${Math.round((up / list.length) * 100)}%` : '--', '#52f2b5'],
        ['BEST', best / 15, pct(best, 1), '#52f2b5'],
        ['WORST', -worst / 15, pct(worst, 1), '#ff4d6a'],
      ]);
    };
    for (const f of [coins, rates]) f.onChange(paint);
    paint();
    return {
      enter() {
        coins.start();
        rates.start();
      },
      describe: () => `Markets: ${P.big.textContent}. ${(coins.data ?? []).slice(0, 3).map((c) => `${c.sym} ${c.change.toFixed(1)}%`).join(', ')}`,
    };
  },
};
