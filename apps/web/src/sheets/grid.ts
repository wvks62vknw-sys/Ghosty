/**
 * THE GRID (BRIEF-EDITOR-SPREADSHEETS): the sheet as he touches it. Cells 44 pt tall, a column letter and a row number always in view, the first row
 * frozen when it is, only the rows on screen built (a sheet may be ten thousand rows long), pinch to zoom, a tap to choose a cell and a second tap to
 * edit it (in the formula line above, never a tiny caret in the cell), a mouse drag or a handle at each end of the choice to range over cells, and the
 * fill handle to carry a series on. It draws what the host says and tells the host what he did; it knows no formulas.
 */
import { h } from '../core/dom';
import { addr, formatValue, isErr, usedCols, usedRows, type Book } from './model';
import type { Engine } from './formula';
import { visibleRows } from './ops';
import { colName, MAXC, MAXR, type Pos, type Rect } from './tokens';

const HEAD = 44;
const ROWW = 52;
const EXTRA_ROWS = 30;

export interface GridHost {
  book(): Book;
  sheet(): number;
  eng(): Engine;
  /** The chosen cells: the first corner he touched (active) and the other. */
  sel(): { a: Pos; b: Pos };
  select(a: Pos, b: Pos): void;
  /** A second tap on the chosen cell: edit it. */
  edit(): void;
  /** A tap while a formula waits for a cell: true when the host took it as a reference. */
  point(p: Pos): boolean;
  column(c: number): void;
  row(r: number): void;
  fill(src: Rect, target: Pos): void;
  zoom(): number;
  setZoom(z: number): void;
  /** A key pressed on the grid (the host decides). */
  key(e: KeyboardEvent): void;
}
export interface Grid {
  el: HTMLElement;
  /** Everything again (the sheet, the zoom, the filter changed). */
  paint(): void;
  /** The cells on screen again (their values changed). */
  paintCells(): void;
  /** The choice again (a new cell, a new range). */
  paintSel(): void;
  reveal(p: Pos): void;
  rows(): number[];
}

export const rectOf = (a: Pos, b: Pos): Rect => ({ r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c), r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c) });

export function makeGrid(host: GridHost): Grid {
  const el = h('div.shgrid', { role: 'grid', tabindex: 0, 'aria-label': 'The sheet: tap a cell to choose it, tap it again to edit', 'aria-colcount': MAXC, 'aria-rowcount': MAXR });
  const inner = h('div.shgin');
  const head = h('div.shhead', { role: 'row' });
  const strip = h('div.shstrip', { role: 'row' });
  const body = h('div.shbody');
  const handleStart = h('button.shh.start', { type: 'button', 'aria-label': 'Drag to change where the choice starts', tabindex: -1 });
  const handleEnd = h('button.shh.end', { type: 'button', 'aria-label': 'Drag to change where the choice ends', tabindex: -1 });
  const handleFill = h('button.shh.fill', { type: 'button', 'aria-label': 'Drag the fill handle to carry the cell or series on', tabindex: -1 });
  const fillBox = h('div.shfillbox');
  fillBox.hidden = true;
  inner.append(head, strip, body);
  el.append(inner);

  // geometry
  let list: number[] = [];
  let tops: number[] = [];
  let heights: number[] = [];
  let lefts: number[] = [];
  let widths: number[] = [];
  let frozen = false;
  let bodyRows: number[] = [];
  const rowEls = new Map<number, HTMLElement>();
  let z = 1;
  let base = 44;

  const geometry = () => {
    const b = host.book();
    const s = b.sheets[host.sheet()]!;
    z = host.zoom();
    base = Math.max(44, Math.round(44 * z));
    const used = usedRows(s);
    list = visibleRows(s, s.filter, host.eng());
    if (!s.filter) for (let r = used + 1; r <= Math.min(MAXR, Math.max(used + EXTRA_ROWS, 30)); r++) list.push(r);
    frozen = s.frozen;
    bodyRows = frozen ? list.filter((r) => r !== 1) : list;
    tops = [];
    heights = [];
    let y = 0;
    for (const r of bodyRows) {
      const hh = s.heights[r - 1] ? Math.max(base, Math.round(s.heights[r - 1]! * z)) : base;
      tops.push(y);
      heights.push(hh);
      y += hh;
    }
    const cols = Math.min(MAXC, Math.max(usedCols(s) + 4, 12));
    widths = Array.from({ length: cols }, (_, c) => Math.max(44, Math.round((s.widths[c] ?? 96) * z)));
    lefts = [];
    let x = ROWW;
    for (const w of widths) {
      lefts.push(x);
      x += w;
    }
    body.style.height = `${y}px`;
    inner.style.width = `${x}px`;
    head.style.width = `${x}px`;
    strip.style.width = `${x}px`;
    head.style.height = `${HEAD}px`;
    el.style.setProperty('--shz', String(z));
    el.style.setProperty('--shhead', `${HEAD}px`);
  };
  const rowIndex = (r1: number): number => bodyRows.indexOf(r1);
  const topOf = (r1: number): number | null => {
    const i = rowIndex(r1);
    return i < 0 ? null : tops[i]!;
  };
  const search = (arr: number[], v: number): number => {
    let lo = 0;
    let hi = arr.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (arr[mid]! <= v) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  const cellEl = (r: number, c: number): HTMLElement => {
    const b = host.book();
    const s = b.sheets[host.sheet()]!;
    const a = addr(r, c);
    const cell = s.cells[a];
    const eng = host.eng();
    const v = eng.value(s.name, a);
    const x = cell?.x;
    const el1 = h('div.shc', { role: 'gridcell', tabindex: -1, dataset: { a } });
    el1.style.width = `${widths[c]}px`;
    el1.textContent = formatValue(v, x);
    if (isErr(v)) el1.classList.add('err');
    else if (typeof v === 'number' && x?.n !== 'text') el1.classList.add('num');
    if (x?.a) el1.dataset.al = x.a;
    if (x?.b) el1.dataset.b = '1';
    if (x?.i) el1.dataset.i = '1';
    if (x?.fill) el1.dataset.fill = String(x.fill);
    el1.setAttribute('aria-label', `${a}${el1.textContent ? `: ${el1.textContent}` : ', empty'}`);
    return el1;
  };
  const rowEl = (r1: number, inStrip: boolean): HTMLElement => {
    const idx = rowIndex(r1);
    const row = h('div.shr', { role: 'row', dataset: { r: String(r1) } });
    const hh = inStrip ? base : heights[idx]!;
    row.style.height = `${hh}px`;
    if (!inStrip) row.style.top = `${tops[idx]}px`;
    const rh = h('button.shrh', { type: 'button', dataset: { r: String(r1) }, 'aria-label': `Row ${r1}` }, String(r1));
    row.append(rh);
    for (let c = 0; c < widths.length; c++) row.append(cellEl(r1 - 1, c));
    return row;
  };
  const headEls = () => {
    const corner = h('div.shrh.corner', { 'aria-hidden': 'true' });
    head.replaceChildren(corner);
    for (let c = 0; c < widths.length; c++) {
      const hc = h('button.shch', { type: 'button', dataset: { c: colName(c) }, 'aria-label': `Column ${colName(c)}: sort and filter` }, colName(c));
      hc.style.width = `${widths[c]}px`;
      head.append(hc);
    }
  };

  /** Build only the rows on screen. */
  const window_ = () => {
    const st = el.scrollTop - HEAD - (frozen ? base : 0);
    const vh = el.clientHeight || 600;
    const first = Math.max(0, search(tops, Math.max(0, st)) - 6);
    let last = first;
    while (last < bodyRows.length - 1 && tops[last]! < st + vh + base * 6) last++;
    for (const [r, e] of rowEls) {
      const i = rowIndex(r);
      if (i < first || i > last) {
        e.remove();
        rowEls.delete(r);
      }
    }
    for (let i = first; i <= last && i < bodyRows.length; i++) {
      const r = bodyRows[i]!;
      if (!rowEls.has(r)) {
        const e = rowEl(r, false);
        rowEls.set(r, e);
        body.append(e);
      }
    }
    paintSel();
  };

  const paintSel = () => {
    const { a, b } = host.sel();
    const g = rectOf(a, b);
    for (const e of el.querySelectorAll<HTMLElement>('.shc.sel, .shc.rng, .shch.on, .shrh.on')) e.classList.remove('sel', 'rng', 'on');
    for (let r = g.r1; r <= Math.min(g.r2, g.r1 + 400); r++) {
      const row = r === 0 && frozen ? strip : rowEls.get(r + 1);
      if (!row) continue;
      row.querySelector(`.shrh`)?.classList.add('on');
      for (let c = g.c1; c <= g.c2; c++) row.querySelector(`.shc[data-a="${addr(r, c)}"]`)?.classList.add(r === a.r && c === a.c ? 'sel' : 'rng');
    }
    for (let c = g.c1; c <= g.c2; c++) head.querySelector(`.shch[data-c="${colName(c)}"]`)?.classList.add('on');
    // the handles ride the corners of the choice
    const t1 = topOf(g.r1 + 1);
    const t2 = topOf(g.r2 + 1);
    const show = t1 !== null && t2 !== null && g.c1 < lefts.length && g.c2 < lefts.length;
    for (const hd of [handleStart, handleEnd, handleFill]) hd.hidden = !show;
    if (show) {
      const left = lefts[g.c1]!;
      const right = lefts[g.c2]! + widths[g.c2]!;
      const bottom = t2! + heights[rowIndex(g.r2 + 1)]!;
      handleStart.style.transform = `translate(${left}px, ${t1}px)`;
      handleEnd.style.transform = `translate(${right}px, ${bottom}px)`;
      handleFill.style.transform = `translate(${left}px, ${bottom}px)`;
      if (!handleStart.isConnected) body.append(handleStart, handleEnd, handleFill, fillBox);
    }
  };

  const paint = () => {
    geometry();
    headEls();
    rowEls.clear();
    body.replaceChildren();
    strip.replaceChildren();
    strip.hidden = !frozen;
    if (frozen) strip.append(...rowEl(1, true).children);
    strip.style.height = frozen ? `${base}px` : '0';
    strip.dataset.r = '1';
    window_();
  };
  const paintCells = () => {
    for (const [r, e] of rowEls) {
      const fresh = rowEl(r, false);
      e.replaceChildren(...fresh.children);
    }
    if (frozen) strip.replaceChildren(...rowEl(1, true).children);
    paintSel();
  };

  const posAt = (clientX: number, clientY: number): Pos | null => {
    const bb = body.getBoundingClientRect();
    const y = clientY - bb.top;
    const x = clientX - bb.left;
    if (frozen) {
      const sb = strip.getBoundingClientRect();
      if (clientY >= sb.top && clientY <= sb.bottom) return { r: 0, c: colAt(x) };
    }
    if (!bodyRows.length) return null;
    const i = search(tops, Math.max(0, y));
    return { r: bodyRows[i]! - 1, c: colAt(x) };
  };
  const colAt = (xBody: number): number => {
    let c = 0;
    for (let k = 0; k < lefts.length; k++) if (lefts[k]! <= xBody) c = k;
    return c;
  };
  const posOfCell = (t: EventTarget | null): Pos | null => {
    const c = (t as HTMLElement | null)?.closest?.<HTMLElement>('.shc');
    const a = c?.dataset.a;
    if (!a) return null;
    const m = /^([A-Z]+)(\d+)$/.exec(a)!;
    let col = 0;
    for (const ch of m[1]!) col = col * 26 + ch.charCodeAt(0) - 64;
    return { r: Number(m[2]) - 1, c: col - 1 };
  };

  // taps, a mouse's drag, the keys
  let drag: { from: Pos; moved: boolean } | null = null;
  let suppress = false;
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const p = posOfCell(e.target);
    if (p) drag = { from: p, moved: false };
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerType !== 'mouse' || !(e.buttons & 1)) return;
    const p = posAt(e.clientX, e.clientY);
    if (!p || (p.r === drag.from.r && p.c === drag.from.c && !drag.moved)) return;
    drag.moved = true;
    host.select(drag.from, p);
  });
  addEventListener('pointerup', () => {
    if (drag?.moved) suppress = true;
    drag = null;
  });
  el.addEventListener('click', (e) => {
    if (suppress) {
      suppress = false;
      return;
    }
    const t = e.target as HTMLElement;
    const col = t.closest<HTMLElement>('.shch');
    if (col) {
      let c = 0;
      for (const ch of col.dataset.c!) c = c * 26 + ch.charCodeAt(0) - 64;
      return host.column(c - 1);
    }
    const rh = t.closest<HTMLElement>('.shrh[data-r]');
    if (rh) return host.row(Number(rh.dataset.r) - 1);
    const p = posOfCell(t);
    if (!p) return;
    if (host.point(p)) return;
    const { a, b } = host.sel();
    if (a.r === p.r && a.c === p.c && b.r === p.r && b.c === p.c) host.edit();
    else host.select(p, p);
  });
  el.addEventListener('keydown', (e) => host.key(e));
  el.addEventListener('scroll', () => requestAnimationFrame(window_), { passive: true });

  // pinch to zoom
  const touches = new Map<number, { x: number; y: number }>();
  let pinch: { d: number; z: number } | null = null;
  const dist = () => {
    const [p, q] = [...touches.values()];
    return Math.hypot(p!.x - q!.x, p!.y - q!.y);
  };
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) pinch = { d: dist(), z: host.zoom() };
  });
  el.addEventListener('pointermove', (e) => {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && touches.size === 2) host.setZoom(Math.max(0.7, Math.min(1.6, (pinch.z * dist()) / pinch.d)));
  });
  for (const t of ['pointerup', 'pointercancel']) {
    el.addEventListener(t, (e) => {
      touches.delete((e as PointerEvent).pointerId);
      if (touches.size < 2) pinch = null;
    });
  }

  // the handles
  const drive = (which: 'start' | 'end' | 'fill', e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const hd = e.currentTarget as HTMLElement;
    hd.setPointerCapture(e.pointerId);
    const { a, b } = host.sel();
    const g = rectOf(a, b);
    const move = (ev: PointerEvent) => {
      const bb = el.getBoundingClientRect();
      if (ev.clientY > bb.bottom - 40) el.scrollTop += 14;
      else if (ev.clientY < bb.top + HEAD + 40) el.scrollTop -= 14;
      if (ev.clientX > bb.right - 40) el.scrollLeft += 14;
      else if (ev.clientX < bb.left + ROWW + 40) el.scrollLeft -= 14;
      const p = posAt(ev.clientX, ev.clientY);
      if (!p) return;
      if (which === 'start') host.select({ r: Math.min(p.r, g.r2), c: Math.min(p.c, g.c2) }, { r: g.r2, c: g.c2 });
      else if (which === 'end') host.select({ r: g.r1, c: g.c1 }, { r: Math.max(p.r, g.r1), c: Math.max(p.c, g.c1) });
      else {
        const down = p.r - g.r2;
        const right = p.c - g.c2;
        const t1 = topOf(g.r1 + 1);
        if (t1 === null) return;
        const vertical = down >= right;
        const endR = vertical ? Math.max(g.r2, p.r) : g.r2;
        const endC = vertical ? g.c2 : Math.max(g.c2, p.c);
        const t2 = topOf(endR + 1);
        if (t2 === null) return;
        fillBox.hidden = endR === g.r2 && endC === g.c2;
        fillBox.style.transform = `translate(${lefts[g.c1]!}px, ${t1}px)`;
        fillBox.style.width = `${lefts[endC]! - lefts[g.c1]! + widths[endC]!}px`;
        fillBox.style.height = `${t2 + heights[rowIndex(endR + 1)]! - t1}px`;
        fillBox.dataset.to = addr(endR, endC);
      }
    };
    const up = () => {
      hd.removeEventListener('pointermove', move);
      hd.removeEventListener('pointerup', up);
      hd.removeEventListener('pointercancel', up);
      if (which === 'fill') {
        const to = fillBox.dataset.to;
        fillBox.hidden = true;
        delete fillBox.dataset.to;
        if (to) {
          const m = /^([A-Z]+)(\d+)$/.exec(to)!;
          let col = 0;
          for (const ch of m[1]!) col = col * 26 + ch.charCodeAt(0) - 64;
          host.fill(g, { r: Number(m[2]) - 1, c: col - 1 });
        }
      }
    };
    hd.addEventListener('pointermove', move);
    hd.addEventListener('pointerup', up);
    hd.addEventListener('pointercancel', up);
  };
  handleStart.addEventListener('pointerdown', (e) => drive('start', e));
  handleEnd.addEventListener('pointerdown', (e) => drive('end', e));
  handleFill.addEventListener('pointerdown', (e) => drive('fill', e));

  const reveal = (p: Pos) => {
    const t = topOf(p.r + 1);
    const hh = HEAD + (frozen ? base : 0);
    if (t !== null) {
      if (t + hh < el.scrollTop + hh) el.scrollTop = t;
      else if (t + hh + base > el.scrollTop + el.clientHeight) el.scrollTop = t + hh + base - el.clientHeight;
    }
    const l = lefts[p.c];
    if (l !== undefined) {
      if (l - ROWW < el.scrollLeft) el.scrollLeft = l - ROWW;
      else if (l + widths[p.c]! > el.scrollLeft + el.clientWidth) el.scrollLeft = l + widths[p.c]! - el.clientWidth;
    }
    window_();
  };
  return { el, paint, paintCells, paintSel, reveal, rows: () => list };
}
