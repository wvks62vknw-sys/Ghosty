/** MARKETS tab: crypto, gold and silver, and currencies. */
import { send } from '../../assistant/session';
import { clear, h } from '../../core/dom';
import { biggestMove, clock, coins, CURRENCY_SYMBOL, fresh, FX, fxAmount, lastDay, money, moved, ounce, pct, rate, rates, type Coin } from '../../data/markets';
import { go, type TabDef } from '../../shell/tabs';
import { settings } from '../../state/app';
import { button, panel, row, spark } from '../../ui/components';
import { page } from '../../ui/page';

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
  now() {
    const btc = coins.data?.find((c) => c.sym === 'BTC');
    return btc ? `BTC ${btc.change >= 0 ? '+' : '−'}${Math.abs(btc.change).toFixed(2)}% today` : '';
  },
  mount(root) {
    const P = page(root, { tag: 'MARKETS', rightLabel: 'GOLD / FX', leftLabel: 'CRYPTO', stack: true });
    // The top says what moved, in plain words, from the prices it holds: never a call to buy or sell.
    const say = h('p.mksay', { dataset: { case: 'keep' } });
    P.sub.after(say);
    const cp = panel('CRYPTO, LAST 24 HOURS', { footer: true, cls: 'coins' });
    const coinRow = (c: Coin) => {
      // (in the currency the prices came in: a switch the source has not answered yet never relabels them)
      const r = row(c.sym, h('span', c.name, h('br'), h('small.mono', money(c.price, c.cur))), pct(c.change), {
        tone: c.change >= 0 ? 'up' : 'dn',
        onClick: () => {
          go('core');
          void send(`Give me a quick take on ${c.name}. It is ${CURRENCY_SYMBOL[c.cur] ?? ''}${c.price} and moved ${c.change.toFixed(1)}% in 24 hours.`);
        },
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
      P.big.textContent = !list.length ? cs.why || 'Loading' : cs.live ? dayWord(list) : 'Not up to date';
      P.big.dataset.tone = cs.live && /up/.test(P.big.textContent) ? 'up' : cs.live && /down/.test(P.big.textContent) ? 'dn' : '';
      P.sub.textContent = !list.length ? '' : cs.live ? `Last 24 hours · as of ${cs.asOf}` : `${cs.why || 'Not updated since'} · as of ${cs.asOf}`;
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
