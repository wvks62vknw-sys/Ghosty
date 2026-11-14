/**
 * The PAIRS board. Options (GameConfig.options): pairs (4 to 15, default 8), cols (2 to 6, default 4), levels (a
 * picker of pair counts), set (faces: 'France|Paris' pairs two halves that match, shown as words).
 * Tap two cards; a match stays face up, a miss turns back after a moment. Fewer turns is a better score.
 */
import { h, icon } from '../../../core/dom';
import * as P from '../../../../../../packages/shared/src/applib/games/pairs';
import { bool, list, num, rng, shuffle } from '../../../../../../packages/shared/src/applib/games/rng';
import { type Board, fmtTime, grid } from './frame';

/** The card faces: simple shapes, drawn in the world's stroke. */
export const FACES = [
  '<circle cx="12" cy="12" r="7"/>',
  '<path d="M12 4l8 15H4z"/>',
  '<rect x="5" y="5" width="14" height="14" rx="1"/>',
  '<path d="M12 3l9 9-9 9-9-9z"/>',
  '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z"/>',
  '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  '<path d="M12 4v16M4 12h16"/>',
  '<path d="M6 6l12 12M18 6L6 18"/>',
  '<path d="M4 16c3-6 5-6 8 0s5 6 8 0"/>',
  '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/>',
  '<path d="M12 4l8 6-3 10H7L4 10z"/>',
  '<path d="M17 14A7 7 0 1 1 10 4a6 6 0 0 0 7 10z"/>',
  '<path d="M5 19V9l7-5 7 5v10z"/>',
  '<path d="M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5"/>',
  '<path d="M4 12h4l2-6 4 12 2-6h4"/>',
];

export const pairs: Board = (p) => {
  const count = num(p.opts, 'pairs', 8, 4, 15);
  const cols = num(p.opts, 'cols', 4, 2, 6);
  const set = list(p.opts, 'set');
  const textSet = set.some((x) => x.includes('|')) || bool(p.opts, 'text', false);
  const seed = p.seed();
  const g: P.Pairs = (p.resume as P.Pairs | null) ?? P.deal(count, seed);
  const faceSet = textSet ? shuffle(rng((g.cards[0] ?? 0) * 7919 + g.cards.length), set).slice(0, count) : [];
  const words = textSet ? P.faces(g, faceSet) : [];
  g.up = [];
  let wait = 0;
  const els: HTMLElement[] = [];
  const board = grid(cols, 'al-gpairs', g.cards.length, (i) => {
    const el = h('div.al-gpaircard', { role: 'gridcell', tabIndex: 0, 'aria-label': `Card ${i + 1}` }, h('span.al-gpairface', textSet ? h('b.al-gpairword', words[i] ?? '') : icon(FACES[g.cards[i]! % FACES.length]!)));
    el.addEventListener('click', () => tap(i));
    els.push(el);
    return el;
  });
  p.stage.append(board);
  function tap(i: number): void {
    if (p.paused()) return;
    if (g.up.length === 2) {
      clearTimeout(wait);
      P.hide(g);
    }
    const r = P.flip(g, i);
    if (!r) return;
    draw();
    if (r === 'miss') wait = window.setTimeout(() => (P.hide(g), draw()), 900);
    if (r === 'match' && P.done(g)) {
      const secs = p.secs();
      return p.end({ won: true, score: P.score(g, secs), words: `All ${count} pairs in ${g.turns} turns, ${fmtTime(secs)}.` });
    }
    if (r !== 'one') p.keep({ ...g, up: [] });
  }
  function draw(): void {
    els.forEach((el, i) => {
      el.classList.toggle('al-gup', g.up.includes(i) || g.gone[i]!);
      el.classList.toggle('al-ggone', g.gone[i]!);
    });
    p.score(0, `${g.turns} turns · ${g.gone.filter(Boolean).length / 2} of ${count} pairs`);
  }
  draw();
  p.keep({ ...g, up: [] });
  return () => clearTimeout(wait);
};
