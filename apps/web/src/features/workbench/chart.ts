/**
 * THE CURVE ON A WORKBENCH CARD (NEXT ROUND, make.u6): the shape behind an answer (packages/shared/src/workbench/curves.ts),
 * drawn as a line or as bars in the screen's own strokes. The picture is an SVG that scales with the card; every word on it
 * that could be long (the title, the axes, the note) is HTML around it, so it wraps at BODY 21 and is never cut. The numbers
 * on the ticks are round steps (1, 2 or 5). VoiceOver reads one sentence for the whole picture: what it shows, from where to
 * where, and where his own answer sits. The note always begins "First estimate, not certified".
 */
import { h, svgEl } from '../../core/dom';
import { niceTicks, tickText } from '../../../../../packages/shared/src/chart';
import { num } from '../../../../../packages/shared/src/workbench';
import type { Curve } from '../../../../../packages/shared/src/workbench/curves';

const W = 320;
const H = 168;
const PAD = { l: 40, r: 10, t: 12, b: 24 };

const fig = (v: number) => num(v, 3);
const unitOf = (u: string) => (u ? ` ${u}` : '');

/** The sentence VoiceOver reads for the picture. */
export function curveWords(c: Curve): string {
  const p = c.points;
  if (!p.length) return c.title;
  if (c.bars) {
    const top = p.reduce((a, b) => (b.y > a.y ? b : a));
    const low = p.reduce((a, b) => (b.y < a.y ? b : a));
    return `${c.title}: bars by ${c.x.label.toLowerCase()}, the most in ${top.label ?? fig(top.x)} at ${fig(top.y)}${unitOf(c.y.unit)}, the least in ${low.label ?? fig(low.x)} at ${fig(low.y)}${unitOf(c.y.unit)}.`;
  }
  const a = p[0]!;
  const z = p[p.length - 1]!;
  const mark = c.mark ? ` ${c.mark.label.charAt(0).toUpperCase()}${c.mark.label.slice(1)}: ${fig(c.mark.y)}${unitOf(c.y.unit)} at ${fig(c.mark.x)}${unitOf(c.x.unit)}.` : '';
  return `${c.title}: ${c.y.label.toLowerCase()} from ${fig(a.y)} to ${fig(z.y)}${unitOf(c.y.unit)} as ${c.x.label.toLowerCase()} runs from ${fig(a.x)} to ${fig(z.x)}${unitOf(c.x.unit)}.${mark}`;
}

function text(x: number, y: number, s: string, cls: string, anchor: 'start' | 'middle' | 'end'): SVGTextElement {
  const t = svgEl('text', { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, class: cls, 'text-anchor': anchor });
  t.textContent = s;
  return t;
}

/** The curve as a figure: its title, the picture, the axes in words and its note. */
export function curveFigure(c: Curve): HTMLElement {
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'wbcurvesvg', role: 'img', 'aria-label': curveWords(c), preserveAspectRatio: 'xMidYMid meet' });
  const pts = c.points;
  const top = Math.max(...pts.map((p) => Math.abs(p.y)), c.mark ? Math.abs(c.mark.y) : 0);
  // a limit far beyond the curve (a beam well inside span/250) would flatten it: said in words under the picture instead of drawn
  const limitDrawn = !!c.limit && (Math.abs(c.limit.y) <= top * 2.5 || top === 0);
  const ys = [...pts.map((p) => p.y), ...(c.mark ? [c.mark.y] : []), ...(c.limit && limitDrawn ? [c.limit.y] : [])];
  const yt = niceTicks(Math.min(0, ...ys), Math.max(0, ...ys), 4);
  const xs = pts.map((p) => p.x);
  const x0 = c.bars ? -0.5 : Math.min(...xs);
  const x1 = c.bars ? pts.length - 0.5 : Math.max(...xs);
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const X = (x: number) => PAD.l + ((x - x0) / (x1 - x0 || 1)) * iw;
  const f = (y: number) => (y - yt.lo) / (yt.hi - yt.lo || 1);
  const Y = (y: number) => PAD.t + (c.down ? f(y) : 1 - f(y)) * ih;
  // the grid: a faint line at each round step, its number at the left
  for (const t of yt.ticks) {
    svg.append(svgEl('line', { x1: PAD.l, x2: W - PAD.r, y1: Y(t), y2: Y(t), class: t === 0 ? 'wbc-zero' : 'wbc-grid' }));
    svg.append(text(PAD.l - 5, Y(t) + 4, tickText(t), 'wbc-tick', 'end'));
  }
  if (c.bars) {
    const bw = (iw / pts.length) * 0.66;
    pts.forEach((p, i) => {
      const top = Y(Math.max(0, p.y));
      svg.append(svgEl('rect', { x: X(i) - bw / 2, y: top, width: bw, height: Math.max(0.5, Y(0) - top), rx: 2, class: 'wbc-bar' }));
      // every other month named, so the names never touch
      if (i % 2 === 0) svg.append(text(X(i), H - 7, (p.label ?? '').slice(0, 3), 'wbc-tick', 'middle'));
    });
  } else {
    const xtk = niceTicks(x0, x1, 4).ticks.filter((t) => t >= x0 - 1e-9 && t <= x1 + 1e-9);
    for (const t of xtk) {
      const x = X(t);
      svg.append(text(Math.min(W - PAD.r, Math.max(PAD.l, x)), H - 7, tickText(t), 'wbc-tick', x < PAD.l + 8 ? 'start' : x > W - PAD.r - 8 ? 'end' : 'middle'));
    }
    if (c.limit && limitDrawn && c.limit.y >= yt.lo && c.limit.y <= yt.hi) svg.append(svgEl('line', { x1: PAD.l, x2: W - PAD.r, y1: Y(c.limit.y), y2: Y(c.limit.y), class: 'wbc-limit' }));
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' ');
    svg.append(svgEl('path', { d, class: 'wbc-line' }));
    if (c.mark) svg.append(svgEl('circle', { cx: X(c.mark.x), cy: Y(c.mark.y), r: 4.5, class: 'wbc-mark' }));
  }
  const axes = c.bars ? `${c.y.label}, ${c.y.unit}, by ${c.x.label.toLowerCase()}` : `Across: ${c.x.label.toLowerCase()}${c.x.unit ? ` (${c.x.unit})` : ''} · ${c.down ? 'Down' : 'Up'}: ${c.y.label.toLowerCase()}${c.y.unit ? ` (${c.y.unit})` : ''}`;
  const keys = [
    c.mark ? h('span.wbckey', h('i.dot', { 'aria-hidden': 'true' }), c.mark.label) : null,
    c.limit ? h('span.wbckey', limitDrawn ? h('i.dash', { 'aria-hidden': 'true' }) : null, limitDrawn ? c.limit.label : `${c.limit.label}, far beyond this`) : null,
  ].filter(Boolean) as HTMLElement[];
  return h('figure.wbcurve', { dataset: { points: String(pts.length) } },
    h('figcaption.wbctitle', c.title),
    svg,
    h('p.wbcaxes', axes),
    keys.length ? h('p.wbckeys', ...keys) : null,
    h('p.wbcnote', c.note),
  );
}
