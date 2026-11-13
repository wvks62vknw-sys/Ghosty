/**
 * THE CURVES WIDGET (BRIEF-EDITOR-PHOTO): a drawn tone curve (up to six points, monotone cubic: photo/math.ts) with a channel picker. A
 * point is dragged by a finger (its handle's reach is 44 pt); a tap on empty ground adds one (while there are fewer than six); a double
 * tap on a point takes it away; the ends hold their place across and move up and down. The value said under it ("midtones +12").
 */
import { h } from '../../core/dom';
import { button } from '../../ui/components';
import { curveAt, curveReady, tidyCurve } from '../../photo/math';
import { identityCurve, MAX_CURVE_POINTS, type CurvePts, type Curves } from '../../photo/recipe';

export type Channel = 'l' | 'r' | 'g' | 'b';
const NAMES: Record<Channel, string> = { l: 'ALL', r: 'RED', g: 'GREEN', b: 'BLUE' };
const INK: Record<Channel, string> = { l: 'var(--g-ink-1)', r: 'var(--g-red)', g: 'var(--g-ok)', b: 'var(--g-accent)' };

export interface CurvesUi {
  el: HTMLElement;
  /** Draw again from the recipe's curves (after an undo). */
  sync(c: Curves): void;
}

export function curvesUi(get: () => Curves, live: (c: Curves) => void, keep: (c: Curves, label: string) => void): CurvesUi {
  let ch: Channel = 'l';
  let drag = -1;
  const W = 280;
  const H = 220;
  const cv = h('canvas.pecurve', { width: W * 2, height: H * 2, 'aria-label': 'Tone curve: drag a point', role: 'img' });
  const say = h('p.g-truth.pecurvesay', { 'aria-live': 'polite' });
  const picker = h('div.perow.pechans', { role: 'group', 'aria-label': 'Which colour' });
  const chBtns = new Map<Channel, HTMLButtonElement>();
  (['l', 'r', 'g', 'b'] as Channel[]).forEach((c) => {
    const b = button(NAMES[c], () => {
      ch = c;
      paint();
    });
    b.setAttribute('aria-pressed', 'false');
    chBtns.set(c, b);
    picker.append(b);
  });
  const reset = button('RESET THIS CURVE', () => {
    const c = get();
    c[ch] = identityCurve();
    live(c);
    keep(c, `${NAMES[ch].charAt(0)}${NAMES[ch].slice(1).toLowerCase()} curve reset`);
    paint();
  });
  const toXY = (p: [number, number]) => ({ x: p[0] * W, y: (1 - p[1]) * H });
  const ctx = cv.getContext('2d')!;
  const css = (v: string) => {
    const d = document.createElement('i');
    d.style.color = v;
    document.body.append(d);
    const c = getComputedStyle(d).color;
    d.remove();
    return c;
  };
  function paint(): void {
    const c = get()[ch];
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = css('var(--g-line-faint)');
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo((W * i) / 4, 0);
      ctx.lineTo((W * i) / 4, H);
      ctx.moveTo(0, (H * i) / 4);
      ctx.lineTo(W, (H * i) / 4);
      ctx.stroke();
    }
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(W, 0);
    ctx.stroke();
    ctx.setLineDash([]);
    const ready = curveReady(c);
    ctx.strokeStyle = css(INK[ch]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const x = i / 120;
      const y = curveAt(ready, x);
      if (i) ctx.lineTo(x * W, (1 - y) * H);
      else ctx.moveTo(x * W, (1 - y) * H);
    }
    ctx.stroke();
    c.forEach((p, i) => {
      const { x, y } = toXY(p);
      ctx.fillStyle = css(i === drag ? 'var(--g-accent)' : 'var(--g-ink-1)');
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
    });
    for (const [k, b] of chBtns) {
      b.classList.toggle('on', k === ch);
      b.setAttribute('aria-pressed', String(k === ch));
    }
    const mid = curveAt(ready, 0.5);
    const d = Math.round((mid - 0.5) * 100);
    say.textContent = `${NAMES[ch].toLowerCase()} · ${c.length} point${c.length === 1 ? '' : 's'} · midtones ${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d)}`;
  }
  const at = (e: PointerEvent): [number, number] => {
    const r = cv.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height))];
  };
  const nearest = (e: PointerEvent): number => {
    const r = cv.getBoundingClientRect();
    const c = get()[ch];
    let best = -1;
    let bd = 26;
    c.forEach((p, i) => {
      const d = Math.hypot(e.clientX - (r.left + p[0] * r.width), e.clientY - (r.top + (1 - p[1]) * r.height));
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  };
  let lastTap = { t: 0, i: -2 };
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try {
      cv.setPointerCapture(e.pointerId);
    } catch {
      /* a pointer the phone no longer has */
    }
    const curves = get();
    let c: CurvePts = curves[ch].map((p) => [p[0], p[1]] as [number, number]);
    let i = nearest(e);
    if (i >= 0 && lastTap.i === i && e.timeStamp - lastTap.t < 380 && i > 0 && i < c.length - 1) {
      c.splice(i, 1);
      curves[ch] = c;
      live(curves);
      keep(curves, 'A curve point taken away');
      drag = -1;
      lastTap = { t: 0, i: -2 };
      paint();
      return;
    }
    if (i < 0) {
      if (c.length >= MAX_CURVE_POINTS) {
        say.textContent = 'Six points is the most a curve holds: drag one, or double tap one to take it away.';
        return;
      }
      const p = at(e);
      c = tidyCurve([...c, p]);
      i = c.findIndex((q) => Math.abs(q[0] - p[0]) < 1e-9);
    }
    lastTap = { t: e.timeStamp, i };
    drag = i;
    curves[ch] = c;
    live(curves);
    paint();
  });
  cv.addEventListener('pointermove', (e) => {
    if (drag < 0) return;
    const curves = get();
    const c = curves[ch].map((p) => [p[0], p[1]] as [number, number]);
    const p = at(e);
    const first = drag === 0;
    const last = drag === c.length - 1;
    const lo = first ? 0 : c[drag - 1]![0] + 0.02;
    const hi = last ? 1 : c[drag + 1]![0] - 0.02;
    c[drag] = [first ? 0 : last ? 1 : Math.min(hi, Math.max(lo, p[0])), p[1]];
    curves[ch] = c;
    live(curves);
    paint();
  });
  const up = () => {
    if (drag < 0) return;
    drag = -1;
    keep(get(), 'Curve moved');
    paint();
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  const el = h('div.pecurves', picker, h('div.pecurvebox', cv), say, h('div.perow', reset));
  paint();
  return { el, sync: paint };
}
