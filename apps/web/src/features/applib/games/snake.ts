/**
 * The SNAKE board. Options (GameConfig.options): size (10 to 30, default 16), speed (4 to 15, default 7), wrap (default false; walls: false also wraps), daily.
 * Swipe anywhere on the board (or the arrow keys, or the four keys under it) to turn. It quickens every five foods.
 */
import * as S from '../../../../../../packages/shared/src/applib/games/snake';
import { bool, num, rng } from '../../../../../../packages/shared/src/applib/games/rng';
import { type Board, swipe } from './frame';
import { canvas, rr } from './canvas';

export const snake: Board = (p) => {
  const size = num(p.opts, 'size', 16, 10, 30);
  const speed = num(p.opts, 'speed', 7, 4, 15);
  const saved = p.resume as { s: S.Snake; seed: number; n: number } | null;
  const seed = saved?.seed ?? p.seed(bool(p.opts, 'daily', false));
  let n = saved?.n ?? 0;
  const r = rng(seed + n * 7919);
  const s = saved?.s ?? S.start(size, bool(p.opts, 'wrap', p.opts.walls === false), r);
  s.queued = [];
  const cv = canvas(p.stage, 1);
  cv.el.setAttribute('aria-label', 'The snake board');
  const unswipe = swipe(cv.el, (d) => S.turn(s, d));
  p.keys((['left', 'up', 'down', 'right'] as S.Dir[]).map((d) => ({ word: { left: '←', up: '↑', down: '↓', right: '→' }[d], label: `Turn ${d}`, run: () => S.turn(s, d) })));
  let acc = 0;
  let started = !!saved;
  if (!started) p.notice('Swipe to start.');
  const startOnTurn = () => (started = true);
  cv.el.addEventListener('pointerdown', startOnTurn);
  window.addEventListener('keydown', startOnTurn);
  const colours = () => ({ bg: p.token('--g-plate-fill'), line: p.token('--g-line-faint'), body: p.token('--g-accent'), head: p.token('--g-accent-text'), food: p.token('--g-amber') });
  let col = colours();
  p.onPause(() => (col = colours()));
  const stop = cv.loop((_, dt) => {
    if (!p.paused() && started && s.alive) {
      acc += dt;
      const ms = S.stepMs(s, speed);
      while (acc >= ms && s.alive) {
        acc -= ms;
        n++;
        const res = S.step(s, r);
        if (res === 'ate') {
          navigator.vibrate?.(10);
          p.keep({ s, seed, n });
        }
        if (res === 'died' || !s.alive) {
          p.end({ won: s.score > 0, score: s.score, words: `${s.eaten} eaten, length ${s.body.length}.` });
          break;
        }
      }
      if (n % 20 === 0) p.keep({ s, seed, n });
    }
    const { ctx, w } = cv;
    const cell = w / s.size;
    ctx.clearRect(0, 0, w, w);
    ctx.fillStyle = col.bg;
    rr(ctx, 0, 0, w, w, 8);
    ctx.strokeStyle = col.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, w - 1);
    if (s.food >= 0) {
      ctx.fillStyle = col.food;
      ctx.beginPath();
      ctx.arc((s.food % s.size + 0.5) * cell, (Math.floor(s.food / s.size) + 0.5) * cell, cell * 0.36, 0, Math.PI * 2);
      ctx.fill();
    }
    s.body.forEach((b, k) => {
      ctx.fillStyle = k === 0 ? col.head : col.body;
      rr(ctx, (b % s.size) * cell + 1, Math.floor(b / s.size) * cell + 1, cell - 2, cell - 2, cell * 0.28);
    });
    p.score(s.score, `Length ${s.body.length} · level ${S.level(s)}`);
  });
  return () => {
    stop();
    unswipe();
    window.removeEventListener('keydown', startOnTurn);
  };
};
