/**
 * THE CHART (POLISH 2): bars or a line from the numbers a reply holds, drawn in the system's own type and strokes, and made to be
 * read: axis labels that never clip (the widths are measured from the type's own advance and the chart is drawn at the width it
 * really has), round ticks (steps of 1, 2 or 5), the unit said once on the axis and never on every tick, a drawn zero with
 * negatives below it, the last point written, dates in words, labels thinned before they touch, one to four series in the system's
 * own sequence (accent, ink, amber, ok: classes s1 to s4, never a new colour), one number said large, and no data said in his words.
 * Pure drawing: it returns the element and a `relayout` for when the Stage's width changes.
 */
import { h, svgEl } from '../core/dom';
import { figure, humanLabel, niceTicks, tickText, type Series } from './chart';

/** One mono character's advance at `size` px with the system's capitals tracking (.06em), a hair over for safety. */
const adv = (size: number): number => size * 0.67;
const widthOf = (s: string, size = 12): number => Math.ceil(s.length * adv(size)) + 2;

/** The unit as the axis says it, once: "£", "%", "KM". */
export const unitWord = (s: Pick<Series, 'unit' | 'before'>): string => (s.unit ? (s.before || /^[%°]/.test(s.unit) ? s.unit : s.unit.toUpperCase()) : '');

function text(x: number, y: number, s: string, cls: string, anchor: 'start' | 'middle' | 'end' = 'start'): SVGTextElement {
  const t = svgEl('text', { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, class: `stg-t ${cls}`, 'text-anchor': anchor });
  t.textContent = s;
  return t;
}

/** A text centred on x that stays inside [0, W]: it turns to start or end where it would run out. */
function inside(x: number, y: number, s: string, cls: string, W: number, size = 12): SVGTextElement {
  const w = widthOf(s, size);
  if (x - w / 2 < 2) return text(2, y, s, cls, 'start');
  if (x + w / 2 > W - 2) return text(W - 2, y, s, cls, 'end');
  return text(x, y, s, cls, 'middle');
}

const klass = (j: number): string => `s${Math.min(4, j + 1)}`;

interface Lane {
  name: string;
  values: number[];
}

/** The picture, its host and what to call when the width changes. */
export function chartPic(s: Series, record: (n: Record<string, number>) => void, avail: () => number = () => 400): { el: HTMLElement; relayout: () => void } {
  const host = h('div.stgchart');
  const pts = s.points;
  const lanes: Lane[] = [{ name: s.name ?? '', values: pts.map((p) => p.value) }, ...(s.more ?? [])].slice(0, 4);
  const labels = pts.map((p) => humanLabel(p.label));
  const aria = (kind: string) => `${kind}: ${pts.map((p, i) => `${labels[i]} ${lanes.map((l) => figure(l.values[i]!, s)).join(' and ')}`).join(', ')}`;

  const empty = (): HTMLElement => h('p.stgempty', { role: 'img', 'aria-label': 'No numbers to draw' }, 'I haven’t got any numbers for that yet. Ask me again once there are some.');
  const big = (): HTMLElement => h('div.stgbig', { role: 'img', 'aria-label': `${labels[0]}: ${figure(pts[0]!.value, s)}` }, h('b.stgnum', figure(pts[0]!.value, s)), h('span.stgcap', labels[0]!.toUpperCase()));

  const legend = (svg: SVGSVGElement, W: number, y0: number): number => {
    if (lanes.length < 2) return 0;
    let x = 2;
    let y = y0;
    lanes.forEach((l, j) => {
      const nm = (l.name || `Series ${j + 1}`).toUpperCase().slice(0, 18);
      const w = 16 + widthOf(nm);
      if (x + w > W) {
        x = 2;
        y += 16;
      }
      svg.append(svgEl('rect', { x, y: y - 9, width: 10, height: 10, class: `stg-key ${klass(j)}` }), text(x + 14, y, nm, 'cap legend'));
      x += w + 10;
    });
    return y - y0 + 16;
  };

  const bars = (W: number): SVGSVGElement => {
    const k = lanes.length;
    const all = lanes.flatMap((l) => l.values);
    const t = niceTicks(Math.min(0, ...all), Math.max(0, ...all), 4);
    const capChars = Math.min(12, Math.max(...labels.map((l) => l.length)));
    const x0 = Math.ceil(capChars * adv(12)) + 10;
    const figs = lanes.map((l) => l.values.map((v) => figure(v, s)));
    const figW = Math.max(...figs.flat().map((f) => widthOf(f, 13))) + 8;
    const room = Math.max(60, W - x0 - figW);
    const xz = (v: number) => x0 + ((v - t.lo) / (t.hi - t.lo || 1)) * room;
    const barH = k === 1 ? 16 : Math.max(5, Math.floor(20 / k));
    const top = unitWord(s) ? 18 : 6;
    // the rows take what the Stage has: twelve of them are tighter than four, and none is cut off
    const want = k === 1 ? 28 : k * (barH + 2) + 10;
    const row = Math.max(k === 1 ? 20 : k * (barH + 2) + 4, Math.min(want, Math.floor((avail() - top - 28 - (k > 1 ? 34 : 0)) / pts.length)));
    const body = top + pts.length * row;
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${body + 24}`, class: 'stg-svg bars', role: 'img', 'aria-label': aria('Bars') });
    const u = unitWord(s);
    if (u) svg.append(text(2, 12, u, 'cap unit stg-unit'));
    for (const tk of t.ticks) svg.append(svgEl('line', { x1: xz(tk), y1: top - 2, x2: xz(tk), y2: body, class: `stg-axis${tk === 0 ? ' stg-zero' : ''}` }));
    pts.forEach((_, i) => {
      const y = top + i * row;
      const name = labels[i]!;
      const cap = (name.length > capChars ? `${name.slice(0, Math.max(1, capChars - 1))}…` : name).toUpperCase();
      svg.append(text(2, y + (k === 1 ? 18 : (k * (barH + 2)) / 2 + 4), cap, 'cap'));
      lanes.forEach((l, j) => {
        const v = l.values[i]!;
        const by = y + 4 + j * (barH + 2);
        svg.append(svgEl('rect', { x: Math.min(xz(0), xz(v)), y: by, width: Math.max(2, Math.abs(xz(v) - xz(0))), height: barH, class: `stg-bar ${klass(j)}`, 'data-bar': '1' }));
        svg.append(text((v >= 0 ? xz(v) : xz(0)) + 6, by + barH - (k === 1 ? 2 : 0), figs[j]![i]!, `fig${k > 1 ? ' small' : ''}`));
      });
    });
    // ticks along the foot, plain numbers, thinned until they do not touch
    const tw = Math.max(...t.ticks.map((v) => widthOf(tickText(v)))) + 10;
    const per = room / Math.max(1, t.ticks.length - 1);
    const stride = Math.max(1, Math.ceil(tw / per));
    t.ticks.forEach((tk, i) => {
      if ((t.ticks.length - 1 - i) % stride === 0) svg.append(inside(xz(tk), body + 14, tickText(tk), 'cap tick', W));
    });
    const extra = legend(svg, W, body + 34);
    if (extra) svg.setAttribute('viewBox', `0 0 ${W} ${body + 24 + extra + 4}`);
    record({ bars: pts.length, series: k });
    return svg;
  };

  const line = (W: number): SVGSVGElement => {
    const H = 210;
    const k = lanes.length;
    const all = lanes.flatMap((l) => l.values);
    const mn = Math.min(...all);
    const mx = Math.max(...all);
    // a zero is drawn when the numbers cross it or live near it; far above it the axis does not start at nothing
    const t = niceTicks(mn < 0 || mn <= mx * 0.6 ? Math.min(0, mn) : mn, Math.max(0, mx), 4);
    const left = Math.max(...t.ticks.map((v) => widthOf(tickText(v)))) + 10;
    const lastFig = figure(lanes[0]!.values[pts.length - 1]!, s);
    const right = W - 12;
    const top = 26;
    const bottom = H - 28;
    const px = (i: number) => left + (i * (right - left)) / Math.max(1, pts.length - 1);
    const py = (v: number) => top + (1 - (v - t.lo) / (t.hi - t.lo || 1)) * (bottom - top);
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'stg-svg line', role: 'img', 'aria-label': aria('Line') });
    const u = unitWord(s);
    if (u) svg.append(text(2, 12, u, 'cap unit stg-unit'));
    for (const tk of t.ticks) {
      svg.append(svgEl('line', { x1: left, y1: py(tk), x2: right, y2: py(tk), class: `stg-axis${tk === 0 ? ' stg-zero' : ''}` }));
      svg.append(text(left - 6, py(tk) + 4, tickText(tk), 'cap tick', 'end'));
    }
    lanes.forEach((l, j) => {
      const d = l.values.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
      svg.append(svgEl('polyline', { points: d, class: `stg-line ${klass(j)}`, ...(j === 0 ? { 'data-line': '1' } : {}) }));
    });
    const topI = lanes[0]!.values.reduce((a, v, i) => (v > lanes[0]!.values[a]! ? i : a), 0);
    pts.forEach((p, i) => {
      svg.append(svgEl('circle', { cx: px(i), cy: py(p.value), r: i === topI ? 4 : 3, class: `stg-dot${i === topI ? ' on' : ''}`, 'data-dot': '1' }));
    });
    lanes.slice(1).forEach((l, j) => l.values.forEach((v, i) => svg.append(svgEl('circle', { cx: px(i), cy: py(v), r: 2.5, class: `stg-pt ${klass(j + 1)}` }))));
    // the values written: the last always, the first and the highest where they do not crowd it
    const label = (i: number, last: boolean) => {
      const v = lanes[0]!.values[i]!;
      const f = figure(v, s);
      const y = py(v) - 9 < top - 6 ? py(v) + 18 : py(v) - 9;
      const w = widthOf(f, 13);
      const anchor = last || px(i) + w / 2 > W - 2 ? 'end' : i === 0 ? 'start' : 'middle';
      // (the first stands to the right of its point, clear of the axis's own figures)
      const x = anchor === 'end' ? Math.min(W - 2, px(i) + 2) : anchor === 'start' ? px(i) + 6 : px(i);
      svg.append(text(x, y, f, `fig${last ? ' last' : ''}`, anchor));
    };
    const shown = [pts.length - 1];
    for (const i of [topI, 0]) if (shown.every((j) => Math.abs(px(i) - px(j)) > widthOf(lastFig, 13) + 14) && !shown.includes(i)) shown.push(i);
    shown.forEach((i) => label(i, i === pts.length - 1));
    // the labels along the foot, in his words for a date, thinned from the last backward until they stand clear
    const lw = Math.max(...labels.map((l) => widthOf(l.toUpperCase()))) + 10;
    const gap = (right - left) / Math.max(1, pts.length - 1);
    const stride = Math.max(1, Math.ceil(lw / gap));
    pts.forEach((_, i) => {
      if ((pts.length - 1 - i) % stride === 0) svg.append(inside(px(i), H - 10, labels[i]!.toUpperCase(), 'cap', W));
    });
    const extra = legend(svg, W, H + 8);
    if (extra) svg.setAttribute('viewBox', `0 0 ${W} ${H + 8 + extra}`);
    record({ points: pts.length, series: k });
    return svg;
  };

  const draw = () => {
    if (!pts.length) {
      host.replaceChildren(empty());
      record({ points: 0 });
      return;
    }
    if (pts.length === 1) {
      host.replaceChildren(big());
      record({ points: 1, big: 1 });
      return;
    }
    // drawn at the width it really has: one unit is one pixel, so the type is the system's size and the labels fit
    const W = Math.max(240, Math.round(host.clientWidth || 340));
    host.replaceChildren(s.kind === 'line' ? line(W) : bars(W));
  };
  draw();
  return { el: host, relayout: draw };
}
