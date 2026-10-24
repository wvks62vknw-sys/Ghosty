/** MARKETS tab: crypto, indices & commodities, and currencies. */
import { send } from '../../assistant/session';
import { fmt, h } from '../../core/dom';
import { coins, CURRENCY_SYMBOL, fx, indices, type Coin, type Quote } from '../../data/markets';
import { go, type TabDef } from '../../shell/tabs';
import { settings } from '../../state/app';
import { button, pager, panel, row, spark } from '../../ui/components';
import { page } from '../../ui/page';

export const marketsTab: TabDef = {
  id: 'markets',
  title: 'MARKETS',
  icon: '<path d="M3 20h18M6 16v-5M11 16V7M16 16v-8M21 16V4"/>',
  scene: 'backdrop',
  blurb: 'stocks · crypto · currencies',
  now() {
    const btc = coins.data?.find((c) => c.sym === 'BTC');
    return btc ? `BTC ${btc.change >= 0 ? '+' : '−'}${Math.abs(btc.change).toFixed(2)}% today` : '';
  },
  mount(root) {
    const P = page(root, { tag: 'MARKET FIELD', sub: 'crypto · indices · commodities · currencies', rightLabel: 'INDICES / FX', leftLabel: 'CRYPTO', stackInPro: true });
    const cp = panel('CRYPTO · 24H', { footer: true, status: 'COINGECKO', cls: 'coins' });
    const sym = () => CURRENCY_SYMBOL[settings.get().currency] ?? '';
    const cg = pager(cp, 52, (c: Coin) => {
      const r = row(c.sym, h('span', c.name, h('br'), h('small.mono', `${sym()}${fmt.n(c.price, c.price < 10 ? 3 : 0)}`)), `${c.change >= 0 ? '+' : ''}${c.change.toFixed(2)}%`, {
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
      void fx.refresh(true);
    }));
    P.left.append(cp.el);
    const ip = panel('INDICES & COMMODITIES', { footer: true, status: 'STOOQ' });
    const ig = pager(ip, 46, (q: Quote) => row(null, q.name, `${q.change >= 0 ? '+' : ''}${q.change.toFixed(2)}%`, { tone: q.change >= 0 ? 'up' : 'dn', sev: q.change >= 0 ? 0 : 3 }), () => indices.status);
    const fp = panel('CURRENCY', { footer: true, status: 'ECB' });
    const fg = pager(fp, 40, (q: Quote) => row(null, q.name, fmt.n(q.price, q.price > 20 ? 2 : 4)), () => fx.status);
    P.right.append(ip.el, fp.el);
    const paint = () => {
      const list = coins.data ?? [];
      const up = list.filter((c) => c.change > 0).length;
      P.big.textContent = list.length ? (up > list.length / 2 ? 'RISK ON' : 'RISK OFF') : '--';
      P.big.style.color = up > list.length / 2 ? '#52f2b5' : '#ff4d6a';
      P.big.dataset.tone = !list.length ? '' : up > list.length / 2 ? 'up' : 'dn'; // route C colours it (amber when risk is off)
      P.sub.textContent = list[0] ? `${coins.status} · ${list[0].sym} ${sym()}${fmt.n(list[0].price)}` : coins.status;
      cg.set(list);
      ig.set(indices.data ?? []);
      fg.set(fx.data ?? []);
      cp.setStatus(coins.status, coins.status === 'LIVE' ? 'ok' : 'off');
      ip.setStatus(indices.status, indices.status === 'LIVE' ? 'ok' : 'off');
      fp.setStatus(fx.status, fx.status === 'LIVE' ? 'ok' : 'off');
      const best = list.length ? Math.max(...list.map((c) => c.change)) : 0;
      const worst = list.length ? Math.min(...list.map((c) => c.change)) : 0;
      P.dials([
        ['UP', list.length ? up / list.length : 0, list.length ? `${Math.round((up / list.length) * 100)}%` : '--', '#52f2b5'],
        ['BEST', best / 15, best.toFixed(1), '#52f2b5'],
        ['WORST', -worst / 15, worst.toFixed(1), '#ff4d6a'],
      ]);
    };
    for (const f of [coins, indices, fx]) f.onChange(paint);
    paint();
    return {
      enter() {
        coins.start();
        indices.start();
        fx.start();
      },
      describe: () => `Markets: ${P.big.textContent}. ${(coins.data ?? []).slice(0, 3).map((c) => `${c.sym} ${c.change.toFixed(1)}%`).join(', ')}`,
    };
  },
};
