/**
 * THE WORKBOOK AS A PDF (BRIEF-EDITOR-SPREADSHEETS): every sheet on landscape A4 pages by the app's own PDF writer (standard fonts, real words, never
 * a screenshot): a ruled grid in the sheet's own column widths (a wide sheet carried over to more pages by columns), the header row bold, numbers
 * as the cells show them and to the right, fills in the house's colours (and the colour rules' fills, bars and scale), hidden rows left out; then each chart, drawn from its numbers; a foot with
 * the title, the sheet and "page 2 of 9". Pure.
 */
import { writePdf, type PdfPage, type PdfRun } from '../convert/pdfwrite';
import { textWidth, type PdfFont } from '../convert/fonts';
import { addr, usedCols, usedRows, type Book } from './model';
import { Engine } from './formula';
import { chartSeries, visibleRows } from './ops';
import { FILL_HEX } from './xlsx';
import { londonToday, ruleMarks } from './rules';
import { figure } from '../show/chart';

const PW = 841.89;
const PH = 595.28;
const M = 36;
const ROW = 18;
const FS = 9;
const tint = (h: string): [number, number, number] => [0, 2, 4].map((i) => 1 - (1 - parseInt(h.slice(i, i + 2), 16) / 255) * 0.55) as [number, number, number];
const fit = (t: string, font: PdfFont, size: number, w: number): string => {
  if (textWidth(t, font, size) <= w) return t;
  let s = t;
  while (s.length > 1 && textWidth(`${s}…`, font, size) > w) s = s.slice(0, -1);
  return `${s}…`;
};

export function pdfOfBook(b: Book, author = ''): Uint8Array {
  const eng = new Engine(b);
  const pages: { page: PdfPage; label: string }[] = [];
  const blank = (label: string): PdfPage => {
    const page: PdfPage = { w: PW, h: PH, runs: [], lines: [] };
    pages.push({ page, label });
    return page;
  };
  for (const s of b.sheets) {
    const rows = visibleRows(s, s.filter, eng).filter((r) => r <= Math.max(usedRows(s), 1));
    const cols = Math.max(usedCols(s), 1);
    if (!Object.keys(s.cells).length) continue;
    // the colour rules as the sheet shows them (rules.ts): a rule's fill, a data bar, a place on the red-to-green scale
    const marks = s.rules?.length ? ruleMarks(s, (a) => eng.value(s.name, a), londonToday()) : null;
    const widths = Array.from({ length: cols }, (_, c) => Math.min((s.widths[c] ?? 96) * 0.75, PW - 2 * M));
    // columns carried over to more pages when the sheet is wider than the page
    const groups: number[][] = [];
    let cur: number[] = [];
    let w = 0;
    for (let c = 0; c < cols; c++) {
      if (cur.length && w + widths[c]! > PW - 2 * M) {
        groups.push(cur);
        cur = [];
        w = 0;
      }
      cur.push(c);
      w += widths[c]!;
    }
    groups.push(cur);
    const perPage = Math.floor((PH - 2 * M - 40) / ROW);
    for (const g of groups) {
      for (let at = 0; at < rows.length; at += perPage) {
        const page = blank(s.name);
        page.runs!.push({ x: M, y: PH - M - 6, text: s.name, font: 'Helvetica-Bold', size: 13 });
        const slice = rows.slice(at, at + perPage);
        let y = PH - M - 28;
        slice.forEach((r1) => {
          const r = r1 - 1;
          let x = M;
          for (const c of g) {
            const cw = widths[c]!;
            const cell = s.cells[addr(r, c)];
            const m = marks?.get(addr(r, c));
            const fill = m?.tone ?? cell?.x?.fill;
            if (m?.scale !== undefined) {
              const lo = FILL_HEX[3]!;
              const hi = FILL_HEX[2]!;
              const mix = [0, 2, 4].map((i) => Math.round(parseInt(lo.slice(i, i + 2), 16) * (1 - m.scale!) + parseInt(hi.slice(i, i + 2), 16) * m.scale!).toString(16).padStart(2, '0')).join('');
              page.lines!.push({ x1: x, y1: y - ROW / 2 + 1, x2: x + cw, y2: y - ROW / 2 + 1, width: ROW, rgb: tint(mix) });
            } else if (fill) page.lines!.push({ x1: x, y1: y - ROW / 2 + 1, x2: x + cw, y2: y - ROW / 2 + 1, width: ROW, rgb: tint(FILL_HEX[fill - 1]!) });
            if (m?.bar) page.lines!.push({ x1: x + 1, y1: y - ROW / 2 + 1, x2: x + 1 + (cw - 2) * m.bar, y2: y - ROW / 2 + 1, width: ROW * 0.55, rgb: tint(FILL_HEX[0]!) });
            const shown = eng.text(s.name, addr(r, c));
            if (shown) {
              const font: PdfFont = cell?.x?.b ? 'Helvetica-Bold' : 'Helvetica';
              const t = fit(shown, font, FS, cw - 6);
              const v = eng.value(s.name, addr(r, c));
              const right = cell?.x?.a ? cell.x.a === 'r' : typeof v === 'number';
              const centre = cell?.x?.a === 'c';
              const tx = right ? x + cw - 3 - textWidth(t, font, FS) : centre ? x + (cw - textWidth(t, font, FS)) / 2 : x + 3;
              page.runs!.push({ x: tx, y: y - ROW + 5, text: t, font, size: FS } as PdfRun);
            }
            x += cw;
          }
          y -= ROW;
        });
        // the rules
        const total = g.reduce((n, c) => n + widths[c]!, 0);
        const top = PH - M - 28 + 0;
        for (let k = 0; k <= slice.length; k++) page.lines!.push({ x1: M, y1: top - k * ROW, x2: M + total, y2: top - k * ROW, width: 0.4, rgb: [0.75, 0.75, 0.75] });
        let x = M;
        for (let k = 0; k <= g.length; k++) {
          page.lines!.push({ x1: x, y1: top, x2: x, y2: top - slice.length * ROW, width: 0.4, rgb: [0.75, 0.75, 0.75] });
          x += widths[g[k] ?? 0]!;
        }
      }
    }
  }
  for (const ch of b.charts) {
    const series = chartSeries(b, eng, ch);
    if (!series) continue;
    const page = blank(ch.sheet);
    page.runs!.push({ x: M, y: PH - M - 6, text: ch.title, font: 'Helvetica-Bold', size: 13 });
    page.runs!.push({ x: M, y: PH - M - 22, text: `From ${ch.sheet}, ${ch.values}`, font: 'Helvetica', size: 8, rgb: [0.4, 0.4, 0.4] });
    const left = M + 90;
    const right = PW - M - 70;
    const top = PH - M - 50;
    const hi = Math.max(...series.points.map((p) => p.value), 0);
    const lo = Math.min(...series.points.map((p) => p.value), 0);
    const span = hi - lo || 1;
    if (series.kind === 'bars') {
      const row = Math.min(30, (top - M - 20) / series.points.length);
      series.points.forEach((p, i) => {
        const y = top - i * row - row / 2;
        const zero = left + ((0 - lo) / span) * (right - left);
        const end = left + ((p.value - lo) / span) * (right - left);
        page.runs!.push({ x: M, y: y - 3, text: fit(p.label, 'Helvetica', 9, 84), font: 'Helvetica', size: 9 });
        page.lines!.push({ x1: zero, y1: y, x2: Math.abs(end - zero) < 1 ? zero + 1 : end, y2: y, width: row * 0.55, rgb: [0.25, 0.55, 0.8] });
        page.runs!.push({ x: Math.max(end, zero) + 6, y: y - 3, text: figure(p.value, series), font: 'Helvetica', size: 9 });
      });
    } else {
      const h = top - M - 40;
      const px = (i: number) => left + (i * (right - left)) / Math.max(1, series.points.length - 1);
      const py = (v: number) => M + 30 + ((v - lo) / span) * h;
      for (let k = 0; k <= 3; k++) page.lines!.push({ x1: left, y1: M + 30 + (k * h) / 3, x2: right, y2: M + 30 + (k * h) / 3, width: 0.4, rgb: [0.8, 0.8, 0.8] });
      series.points.forEach((p, i) => {
        if (i) page.lines!.push({ x1: px(i - 1), y1: py(series.points[i - 1]!.value), x2: px(i), y2: py(p.value), width: 1.6, rgb: [0.25, 0.55, 0.8] });
        page.lines!.push({ x1: px(i) - 1.5, y1: py(p.value), x2: px(i) + 1.5, y2: py(p.value), width: 3, rgb: [0.15, 0.4, 0.65] });
        page.runs!.push({ x: px(i) - 10, y: M + 12, text: fit(p.label, 'Helvetica', 8, 40), font: 'Helvetica', size: 8 });
        if (series.points.length <= 14 || i % 2 === 0) page.runs!.push({ x: px(i) - 10, y: py(p.value) + 7, text: figure(p.value, series), font: 'Helvetica', size: 8 });
      });
    }
  }
  if (!pages.length) blank(b.title);
  pages.forEach(({ page, label }, i) => page.runs!.push({ x: M, y: 18, text: fit(`${b.title} · ${label}`, 'Helvetica', 8, PW - 2 * M - 80), font: 'Helvetica', size: 8, rgb: [0.4, 0.4, 0.4] }, { x: PW - M - 60, y: 18, text: `page ${i + 1} of ${pages.length}`, font: 'Helvetica', size: 8, rgb: [0.4, 0.4, 0.4] }));
  return writePdf(pages.map((p) => p.page), { title: b.title, author });
}
