/**
 * THE PRO CHARTS DRAWN (APPS ROUND, editors): column, bar, line, area, pie, scatter, stacked column, stacked bar and line-with-columns, each
 * with its title outside (the figure's caption), a key naming each series or slice, and the words along the bottom and up the side. The
 * colours are the house's five, by class (shk1 … shk5), so every look draws them in its own tokens. Its words for a screen reader are the
 * numbers. And the little charts inside a cell (sparklines).
 */
import { svgEl } from '../core/dom';
import { figure } from '../show/chart';
import type { Chart } from './model';
import type { ChartData } from './charts';

const W = 400;
const tone = (c: Pick<Chart, 'tone'>, k: number): string => `shk${(((c.tone ?? 1) - 1 + k) % 5) + 1}`;
const text = (x: number, y: number, s: string, cls: string, anchor = 'start', extra: Record<string, string | number> = {}): SVGTextElement => {
  const t = svgEl('text', { x, y, class: cls, 'text-anchor': anchor, ...extra });
  t.textContent = s;
  return t;
};
const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function chartProSvg(c: Chart, d: ChartData, words: string): SVGSVGElement {
  const fig = (v: number) => figure(v, d);
  const said = `${words} chart: ${c.title}: ${d.series.map((s) => `${d.series.length > 1 ? `${s.name}: ` : ''}${d.labels.map((l, i) => `${l} ${s.values[i] === null ? 'empty' : fig(s.values[i]!)}`).join(', ')}`).join('; ')}`;
  const legend = c.legend !== false && (d.series.length > 1 || c.kind === 'pie');
  const keys = c.kind === 'pie' ? d.labels : d.series.map((s) => s.name);
  const keyRows = legend ? Math.ceil(keys.length / 2) : 0;
  const yT = c.yTitle ? 18 : 0;
  const xT = c.xTitle ? 20 : 0;
  const plotH = c.kind === 'pie' ? 200 : c.kind === 'bars' || c.kind === 'stackedbar' ? Math.max(120, d.labels.length * 26) : 190;
  const H = plotH + 26 + xT + keyRows * 22 + 6;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'shsvg shpro', role: 'img', 'aria-label': said, 'data-kind': c.kind });
  const x0 = 8 + yT;
  const top = 8;
  const bottom = top + plotH;
  if (c.yTitle) svg.append(text(12, top + plotH / 2, short(c.yTitle, 28), 'shcap shytitle', 'middle', { transform: `rotate(-90 12 ${top + plotH / 2})` }));
  if (c.xTitle) svg.append(text(W / 2, bottom + 40, short(c.xTitle, 40), 'shcap shxtitle', 'middle'));

  if (c.kind === 'pie') {
    const vals = d.series[0]!.values.map((v) => Math.max(0, v ?? 0));
    const sum = vals.reduce((a, b) => a + b, 0) || 1;
    const cx = W / 2;
    const cy = top + plotH / 2;
    const R = plotH / 2 - 6;
    let a0 = -Math.PI / 2;
    vals.forEach((v, i) => {
      const a1 = a0 + (v / sum) * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (a: number) => `${(cx + R * Math.cos(a)).toFixed(1)},${(cy + R * Math.sin(a)).toFixed(1)}`;
      const path = v >= sum ? `M${cx - R},${cy}a${R},${R} 0 1,0 ${2 * R},0a${R},${R} 0 1,0 ${-2 * R},0` : `M${cx},${cy}L${p(a0)}A${R},${R} 0 ${large},1 ${p(a1)}Z`;
      svg.append(svgEl('path', { d: path, class: `shslice ${tone(c, i)}`, 'data-slice': '1' }));
      if (v / sum >= 0.07) {
        const m = (a0 + a1) / 2;
        svg.append(text(cx + R * 0.62 * Math.cos(m), cy + R * 0.62 * Math.sin(m) + 4, `${Math.round((v / sum) * 100)}%`, 'shfig shon', 'middle'));
      }
      a0 = a1;
    });
  } else {
    const stacked = c.kind === 'stackedbar' || c.kind === 'stackedcol';
    const horiz = c.kind === 'bars' || c.kind === 'stackedbar';
    const n = d.labels.length;
    const all: number[] = [0];
    if (stacked) for (let i = 0; i < n; i++) {
      let pos = 0;
      let neg = 0;
      for (const s of d.series) {
        const v = s.values[i] ?? 0;
        if (v >= 0) pos += v;
        else neg += v;
      }
      all.push(pos, neg);
    }
    else for (const s of d.series) for (const v of s.values) if (v !== null) all.push(v);
    const hi = Math.max(...all);
    const lo = Math.min(...all);
    const span = hi - lo || 1;
    const left = x0 + (horiz ? 84 : 44);
    const right = W - 10;
    for (let k = 0; k <= 3; k++) {
      const v = lo + (span * k) / 3;
      if (horiz) {
        const x = left + ((v - lo) / span) * (right - left);
        svg.append(svgEl('line', { x1: x, y1: top, x2: x, y2: bottom, class: 'shaxis' }));
        svg.append(text(x, bottom + 16, fig(Math.round(v * 100) / 100), 'shcap', 'middle'));
      } else {
        const y = bottom - ((v - lo) / span) * plotH;
        svg.append(svgEl('line', { x1: left, y1: y, x2: right, y2: y, class: 'shaxis' }));
        svg.append(text(left - 4, y + 4, fig(Math.round(v * 100) / 100), 'shcap', 'end'));
      }
    }
    if (c.kind === 'scatter') {
      const xs = d.xs ?? d.labels.map((_, i) => i);
      const xl = Math.min(...xs);
      const xh = Math.max(...xs);
      const xspan = xh - xl || 1;
      d.series[0]!.values.forEach((v, i) => {
        if (v === null) return;
        svg.append(svgEl('circle', { cx: left + ((xs[i]! - xl) / xspan) * (right - left), cy: bottom - ((v - lo) / span) * plotH, r: 4, class: `shpt ${tone(c, 0)}`, 'data-dot': '1' }));
      });
      svg.append(text(left, bottom + 16, fig(xl), 'shcap', 'start'), text(right, bottom + 16, fig(xh), 'shcap', 'end'));
    } else {
      const band = ((horiz ? plotH : right - left) / n);
      const zero = (v: number) => (horiz ? left + ((v - lo) / span) * (right - left) : bottom - ((v - lo) / span) * plotH);
      const barSeries = c.kind === 'combo' ? [0] : c.kind === 'line' || c.kind === 'area' ? [] : d.series.map((_, k) => k);
      const lineSeries = c.kind === 'combo' ? d.series.map((_, k) => k).slice(1) : c.kind === 'line' || c.kind === 'area' ? d.series.map((_, k) => k) : [];
      for (let i = 0; i < n; i++) {
        let pos = 0;
        let neg = 0;
        barSeries.forEach((k, j) => {
          const v = d.series[k]!.values[i];
          if (v === null || v === undefined) return;
          let a: number;
          let b: number;
          let off: number;
          let w: number;
          if (stacked) {
            a = v >= 0 ? pos : neg;
            b = a + v;
            if (v >= 0) pos = b;
            else neg = b;
            off = band * 0.18;
            w = band * 0.64;
          } else {
            a = 0;
            b = v;
            w = (band * 0.72) / barSeries.length;
            off = band * 0.14 + j * w;
          }
          const p1 = zero(a);
          const p2 = zero(b);
          const rect = horiz
            ? { x: Math.min(p1, p2), y: top + i * band + off, width: Math.max(1.5, Math.abs(p2 - p1)), height: Math.max(2, w - 1) }
            : { x: left + i * band + off, y: Math.min(p1, p2), width: Math.max(2, w - 1), height: Math.max(1.5, Math.abs(p2 - p1)) };
          svg.append(svgEl('rect', { ...rect, class: `shbarp ${tone(c, k)}`, 'data-bar': '1' }));
        });
        const lab = short(d.labels[i]!, horiz ? 12 : Math.max(3, Math.floor(band / 7)));
        if (horiz) svg.append(text(left - 6, top + i * band + band / 2 + 4, lab.toUpperCase(), 'shcap', 'end'));
        else if (n <= 8 || i === 0 || i === n - 1 || i === Math.floor(n / 2)) svg.append(text(left + i * band + band / 2, bottom + 16, lab.toUpperCase(), 'shcap', 'middle'));
      }
      for (const k of lineSeries) {
        const pts = d.series[k]!.values.map((v, i) => (v === null ? null : [left + i * band + band / 2, zero(v)] as const)).filter((p): p is readonly [number, number] => !!p);
        if (pts.length < 2) continue;
        const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
        if (c.kind === 'area') svg.append(svgEl('polygon', { points: `${pts[0]![0].toFixed(1)},${zero(Math.max(lo, Math.min(0, hi))).toFixed(1)} ${line} ${pts[pts.length - 1]![0].toFixed(1)},${zero(Math.max(lo, Math.min(0, hi))).toFixed(1)}`, class: `sharea ${tone(c, k)}`, 'data-area': '1' }));
        svg.append(svgEl('polyline', { points: line, class: `shlinep ${tone(c, k)}`, 'data-line': '1' }));
        for (const [x, y] of pts) svg.append(svgEl('circle', { cx: x, cy: y, r: 3, class: `shpt ${tone(c, k)}` }));
      }
    }
  }
  if (legend) {
    const y0 = bottom + 26 + xT;
    keys.forEach((k, i) => {
      const x = 12 + (i % 2) * (W / 2);
      const y = y0 + Math.floor(i / 2) * 22;
      svg.append(svgEl('rect', { x, y: y - 10, width: 12, height: 12, rx: 2, class: `shkey ${tone(c, i)}` }));
      svg.append(text(x + 18, y, short(k, 22), 'shfig shlegend'));
    });
  }
  return svg;
}

/** A little chart for one cell: a line through the numbers or a column for each, the highest lit. */
export function sparkSvg(values: number[], kind: 'line' | 'column', t: number): SVGSVGElement {
  const w = 100;
  const hgt = 28;
  const svg = svgEl('svg', { viewBox: `0 0 ${w} ${hgt}`, class: 'shspark', preserveAspectRatio: 'none', 'aria-hidden': 'true', 'data-spark': kind });
  if (values.length < 2) return svg;
  const hi = Math.max(...values, kind === 'column' ? 0 : -Infinity);
  const lo = Math.min(...values, kind === 'column' ? 0 : Infinity);
  const span = hi - lo || 1;
  const y = (v: number) => 2 + (1 - (v - lo) / span) * (hgt - 4);
  if (kind === 'column') {
    const bw = w / values.length;
    values.forEach((v, i) => svg.append(svgEl('rect', { x: i * bw + bw * 0.15, y: Math.min(y(v), y(0)), width: bw * 0.7, height: Math.max(1, Math.abs(y(v) - y(0))), class: `shk${t}` })));
  } else {
    svg.append(svgEl('polyline', { points: values.map((v, i) => `${((i * w) / (values.length - 1)).toFixed(1)},${y(v).toFixed(1)}`).join(' '), class: `shlinep shk${t}`, 'vector-effect': 'non-scaling-stroke' }));
  }
  return svg;
}
