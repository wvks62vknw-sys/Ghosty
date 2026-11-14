/**
 * The SOLITAIRE board. Options (GameConfig.options): draw (1 or 3, default 1), draws (a picker), daily.
 * Tap a card and it goes where it can (home first, then a column); if it can go nowhere it is picked up, and the next
 * tap on a column or a home puts it there. Tap the stock to turn cards. Every deal has been won by the solver first.
 */
import { h, clear } from '../../../core/dom';
import * as S from '../../../../../../packages/shared/src/applib/games/solitaire';
import { bool, num } from '../../../../../../packages/shared/src/applib/games/rng';
import { type Board, fmtTime } from './frame';

type Pick = { from: S.Loc; count: number } | null;

export const solitaire: Board = (p) => {
  const draw = (num(p.opts, 'draw', 1, 1, 3) === 3 ? 3 : 1) as 1 | 3;
  let s: S.Sol = (p.resume as S.Sol | null) ?? S.deal(p.seed(bool(p.opts, 'daily', false)), draw);
  let pick: Pick = null;
  let finishing = 0;
  const top = h('div.al-gsoltop');
  const cols = h('div.al-gsolcols');
  p.stage.append(top, cols);
  p.keys([
    { word: 'Home all', run: () => act(() => S.sweepHome(s) > 0), label: 'Send every card that can go home' },
  ]);

  const cardEl = (c: number, up: boolean, sel = false): HTMLElement =>
    up
      ? h(`div.al-gcard${S.red(c) ? '.al-gred' : ''}${sel ? '.al-gpicked' : ''}` as 'div', { 'aria-label': S.name(c) }, h('b', S.RANKS[S.rank(c) - 1]!), h('i', S.SUITS[S.suit(c)]!))
      : h('div.al-gcard.al-gback', { 'aria-label': 'Face down' });

  function act(fn: () => boolean): void {
    if (p.paused()) return;
    if (fn()) {
      pick = null;
      after();
    } else render();
  }
  function after(): void {
    render();
    if (S.won(s)) {
      const secs = p.secs();
      return p.end({ won: true, score: S.score(s, secs), words: `Solved in ${s.moves} moves, ${fmtTime(secs)}.` });
    }
    p.keep(s);
    if (S.canFinish(s) && !finishing) {
      finishing = window.setInterval(() => {
        if (p.paused()) return;
        const froms: S.Loc[] = [...Array(7).keys()].map((i) => ({ t: 'tab', i }) as S.Loc);
        const f = froms.find((l) => S.bestTarget(s, l, 1)?.t === 'found');
        if (!f) {
          clearInterval(finishing);
          finishing = 0;
          return;
        }
        S.move(s, f, 1, S.bestTarget(s, f, 1)!);
        if (S.won(s)) {
          clearInterval(finishing);
          finishing = 0;
        }
        after();
      }, 90);
    }
  }
  function tapCard(from: S.Loc, count: number): void {
    if (pick) {
      const to = from.t === 'waste' ? null : from;
      if (to && S.canMove(s, pick.from, pick.count, to)) {
        const pk = pick;
        return act(() => S.move(s, pk.from, pk.count, to));
      }
    }
    const to = S.bestTarget(s, from, count);
    if (to) return act(() => S.move(s, from, count, to));
    pick = pick && JSON.stringify(pick) === JSON.stringify({ from, count }) ? null : { from, count };
    render();
  }
  function tapPlace(to: S.Loc): void {
    if (!pick) return;
    const pk = pick;
    if (S.canMove(s, pk.from, pk.count, to)) act(() => S.move(s, pk.from, pk.count, to));
    else {
      pick = null;
      render();
    }
  }
  function render(): void {
    const stock = h('button.al-gpile', { type: 'button', 'aria-label': s.stock.length ? 'Turn the stock' : 'Turn the waste over' }, s.stock.length ? cardEl(0, false) : h('span.al-gpileempty', '↺'));
    stock.addEventListener('click', () => act(() => S.turnStock(s)));
    const wasteTop = s.waste.slice(-Math.min(draw, s.waste.length));
    const waste = h('div.al-gpile.al-gwaste');
    wasteTop.forEach((c, k) => {
      const el = cardEl(c, true, k === wasteTop.length - 1 && pick?.from.t === 'waste');
      if (k === wasteTop.length - 1) {
        el.setAttribute('role', 'button');
        el.addEventListener('click', () => tapCard({ t: 'waste' }, 1));
      }
      waste.append(el);
    });
    const homes = s.found.map((f, i) => {
      const el = h('button.al-gpile.al-ghome', { type: 'button', 'aria-label': `Home for ${S.SUITS[i]}` }, f.length ? cardEl(f[f.length - 1]!, true) : h('span.al-gpileempty', S.SUITS[i]!));
      el.addEventListener('click', () => (pick ? tapPlace({ t: 'found', i }) : f.length && tapCard({ t: 'found', i }, 1)));
      return el;
    });
    clear(top, stock, waste, h('span.al-gsolgap'), ...homes);
    clear(
      cols,
      ...s.tab.map((col, i) => {
        const el = h('div.al-gcol', { role: 'button', 'aria-label': `Column ${i + 1}` });
        col.down.forEach((c) => el.append(cardEl(c, false)));
        col.up.forEach((c, k) => {
          const count = col.up.length - k;
          const picked = pick?.from.t === 'tab' && pick.from.i === i && count <= pick.count;
          const ce = cardEl(c, true, picked);
          ce.addEventListener('click', (e) => {
            e.stopPropagation();
            tapCard({ t: 'tab', i }, count);
          });
          el.append(ce);
        });
        el.addEventListener('click', () => tapPlace({ t: 'tab', i }));
        return el;
      }),
    );
    const home = s.found.reduce((a, f) => a + f.length, 0);
    p.score(home * 10, `${home} of 52 home · ${s.moves} moves`);
  }
  render();
  p.keep(s);
  return () => clearInterval(finishing);
};
