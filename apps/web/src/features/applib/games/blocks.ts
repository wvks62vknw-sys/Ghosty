/**
 * The BLOCKS board. Options (GameConfig.options): cols (8 to 12, default 10), rows (16 to 24, default 20), level or startLevel (1 to 10, default 1).
 * Tap the board to turn the piece, swipe left or right to move it, swipe down to drop it; the keys under the board do
 * the same. The next piece shows at the side, and a shadow shows where it will land.
 */
import * as B from '../../../../../../packages/shared/src/applib/games/blocks';
import { num, rng } from '../../../../../../packages/shared/src/applib/games/rng';
import type { Board } from './frame';
import { canvas, rr } from './canvas';

export const blocks: Board = (p) => {
  const cols = num(p.opts, 'cols', 10, 8, 12);
  const rows = num(p.opts, 'rows', 20, 16, 24);
  const saved = p.resume as { b: B.Blocks; seed: number; n: number } | null;
  const seed = saved?.seed ?? p.seed();
  let n = saved?.n ?? 0;
  const r = rng(seed + n * 104729);
  const b = saved?.b ?? B.start(cols, rows, num(p.opts, p.opts.startLevel !== undefined ? 'startLevel' : 'level', 1, 1, 10), r);
  const side = 4.6;
  const cv = canvas(p.stage, rows / (cols + side), 0.6);
  cv.el.setAttribute('aria-label', 'The blocks board');
  const act = (fn: () => unknown) => {
    if (p.paused() || b.over) return;
    fn();
    after();
  };
  const after = () => {
    if (b.over) return p.end({ won: b.score > 0, score: b.score, words: `${b.lines} rows cleared, level ${b.level}.` });
    p.keep({ b, seed, n });
  };
  p.keys([
    { word: '←', label: 'Move left', run: () => act(() => B.shift(b, -1)) },
    { word: 'Turn', label: 'Turn the piece', run: () => act(() => B.rotate(b, 1)) },
    { word: '→', label: 'Move right', run: () => act(() => B.shift(b, 1)) },
    { word: 'Drop', label: 'Drop the piece', run: () => act(() => (n++, B.hardDrop(b, r))) },
  ]);
  // touch: drag sideways moves a column at a time, a quick tap turns, a fast swipe down drops
  let x0 = 0;
  let y0 = 0;
  let t0 = 0;
  let moved = 0;
  cv.el.style.touchAction = 'none';
  cv.el.addEventListener('pointerdown', (e) => {
    x0 = e.clientX;
    y0 = e.clientY;
    t0 = performance.now();
    moved = 0;
  });
  cv.el.addEventListener('pointermove', (e) => {
    if (!e.buttons && e.pointerType === 'mouse') return;
    const cell = cv.w / (cols + side);
    const steps = Math.trunc((e.clientX - x0) / cell);
    while (steps > moved) act(() => B.shift(b, 1)), moved++;
    while (steps < moved) act(() => B.shift(b, -1)), moved--;
  });
  cv.el.addEventListener('pointerup', (e) => {
    const dy = e.clientY - y0;
    const dt = performance.now() - t0;
    if (dy > 60 && dt < 400) act(() => (n++, B.hardDrop(b, r)));
    else if (!moved && Math.abs(dy) < 12 && Math.abs(e.clientX - x0) < 12) act(() => B.rotate(b, 1));
  });
  const keyd = (e: KeyboardEvent) => {
    if (!cv.el.isConnected) return;
    const m: Record<string, () => unknown> = { ArrowLeft: () => B.shift(b, -1), ArrowRight: () => B.shift(b, 1), ArrowUp: () => B.rotate(b, 1), ArrowDown: () => (n++, B.tick(b, r)), ' ': () => (n++, B.hardDrop(b, r)) };
    if (m[e.key]) {
      e.preventDefault();
      act(m[e.key]!);
    }
  };
  window.addEventListener('keydown', keyd);
  const colours = () => [p.token('--g-accent'), p.token('--g-accent-text'), p.token('--g-ink-2'), p.token('--g-amber'), p.token('--g-ok'), p.token('--g-ink-1'), p.token('--g-ink-3')];
  let pal = colours();
  const bg = () => p.token('--g-plate-fill');
  let bgc = bg();
  const faint = () => p.token('--g-line-faint');
  let fc = faint();
  p.onPause(() => ((pal = colours()), (bgc = bg()), (fc = faint())));
  let acc = 0;
  const stop = cv.loop((_, dt) => {
    if (!p.paused() && !b.over) {
      acc += dt;
      const ms = B.fallMs(b.level);
      if (acc >= ms) {
        acc = 0;
        n++;
        const res = B.tick(b, r);
        if (res > 0) navigator.vibrate?.(15);
        if (res !== -1) after();
      }
    }
    const { ctx, w, h: hh } = cv;
    const cell = Math.min(w / (cols + side), hh / rows);
    ctx.clearRect(0, 0, w, hh);
    ctx.fillStyle = bgc;
    rr(ctx, 0, 0, cell * cols, cell * rows, 6);
    ctx.strokeStyle = fc;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, cell * cols - 1, cell * rows - 1);
    for (let x = 1; x < cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cell, 0);
      ctx.lineTo(x * cell, cell * rows);
      ctx.stroke();
    }
    const sq = (x: number, y: number, c: string, a = 1) => {
      ctx.globalAlpha = a;
      ctx.fillStyle = c;
      rr(ctx, x * cell + 1, y * cell + 1, cell - 2, cell - 2, cell * 0.18);
      ctx.globalAlpha = 1;
    };
    b.grid.forEach((v, i) => v && sq(i % cols, Math.floor(i / cols), pal[(v - 1) % pal.length]!));
    if (!b.over) {
      const id = B.SHAPES.indexOf(b.piece.shape);
      const gy = B.ghostY(b);
      for (const [x, y] of B.cells({ ...b.piece, y: gy })) if (y >= 0) sq(x, y, pal[id % pal.length]!, 0.25);
      for (const [x, y] of B.cells(b.piece)) if (y >= 0) sq(x, y, pal[id % pal.length]!);
      const nx = cols + 0.6;
      for (const [x, y] of B.cells({ shape: b.next, rot: 0, x: 0, y: 0 })) {
        ctx.fillStyle = pal[B.SHAPES.indexOf(b.next) % pal.length]!;
        rr(ctx, (nx + x * 0.8) * cell, (1 + y * 0.8) * cell, cell * 0.8 - 2, cell * 0.8 - 2, cell * 0.14);
      }
    }
    p.score(b.score, `Rows ${b.lines} · level ${b.level}`);
  });
  return () => {
    stop();
    window.removeEventListener('keydown', keyd);
  };
};
