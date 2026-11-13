/**
 * A CHART IN A SHEET (BRIEF-EDITOR-SPREADSHEETS): the app's own chart (show/chart.ts's Series and its way of writing a figure, as the Stage draws
 * it), drawn from a range's numbers: bars with their labels and figures, or a line with its first, last and highest figure lit. Every bar and dot
 * is a number of the sheet; nothing is added. Its words for a screen reader are the numbers.
 */
import { svgEl } from '../core/dom';
import { figure, type Series } from '../show/chart';

const W = 400;
const text = (x: number, y: number, s: string, cls: string, anchor = 'start'): SVGTextElement => {
  const t = svgEl('text', { x, y, class: cls, 'text-anchor': anchor });
  t.textContent = s;
  return t;
};
export function chartSvg(s: Series, title: string): SVGSVGElement {
  const pts = s.points;
  const hi = Math.max(...pts.map((p) => p.value));
  const lo = Math.min(0, ...pts.map((p) => p.value));
  const span = hi - lo || 1;
  const name = `${s.kind === 'bars' ? 'Bars' : 'Line'}: ${title}: ${pts.map((p) => `${p.label} ${figure(p.value, s)}`).join(', ')}`;
  if (s.kind === 'bars') {
    const row = 28;
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${pts.length * row + 4}`, class: 'shsvg', role: 'img', 'aria-label': name });
    const x0 = 92;
    const room = W - x0 - 72;
    pts.forEach((p, i) => {
      const y = i * row + 2;
      svg.append(text(0, y + 18, (p.label.length > 12 ? `${p.label.slice(0, 11)}…` : p.label).toUpperCase(), 'shcap'));
      const bx = x0 + (Math.min(0, p.value) - lo) * (room / span);
      svg.append(svgEl('rect', { x: bx, y: y + 4, width: Math.max(2, Math.abs(p.value) * (room / span)), height: 16, class: 'shbarfill', 'data-bar': '1' }));
      svg.append(text(x0 + (Math.max(0, p.value) - lo) * (room / span) + 6, y + 18, figure(p.value, s), 'shfig'));
    });
    svg.append(svgEl('line', { x1: x0 + (0 - lo) * (room / span), y1: 0, x2: x0 + (0 - lo) * (room / span), y2: pts.length * row + 4, class: 'shaxis' }));
    return svg;
  }
  const H = 190;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'shsvg', role: 'img', 'aria-label': name });
  const px = (i: number) => 24 + (i * (W - 48)) / Math.max(1, pts.length - 1);
  const py = (v: number) => 30 + (1 - (v - lo) / span) * (H - 76);
  for (let k = 0; k <= 3; k++) svg.append(svgEl('line', { x1: 14, y1: 30 + (k * (H - 76)) / 3, x2: W - 14, y2: 30 + (k * (H - 76)) / 3, class: 'shaxis' }));
  svg.append(svgEl('polyline', { points: pts.map((p, i) => `${px(i).toFixed(1)},${py(p.value).toFixed(1)}`).join(' '), class: 'shlinefill', 'data-line': '1' }));
  const top = pts.reduce((a, p, i) => (p.value > pts[a]!.value ? i : a), 0);
  pts.forEach((p, i) => {
    svg.append(svgEl('circle', { cx: px(i), cy: py(p.value), r: i === top ? 4 : 3, class: `shdot${i === top ? ' on' : ''}`, 'data-dot': '1' }));
    if (i === 0 || i === pts.length - 1 || i === top) svg.append(text(px(i), py(p.value) - 9, figure(p.value, s), 'shfig', i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'));
    if (pts.length <= 7 || i === 0 || i === pts.length - 1 || i === Math.floor(pts.length / 2)) svg.append(text(px(i), H - 8, p.label.slice(0, 7).toUpperCase(), 'shcap', i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'));
  });
  return svg;
}
