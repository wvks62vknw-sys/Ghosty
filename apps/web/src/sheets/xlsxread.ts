/**
 * THE .XLSX READER (BRIEF-EDITOR-SPREADSHEETS): someone else's workbook opened here by the app's own code (a small XML reader of its own, so it also
 * runs where there is no browser): the sheets in order, shared and inline strings (rich text joined), numbers, true and false, errors, formulas as
 * formulas (shared formulas slid down their cells, `_xlfn.` names made plain, array formulas kept at their first cell), number formats (£, %, dates,
 * decimals), bold, italic, alignment, fills (to the nearest of the house's five), column widths, row heights, the frozen first row, named ranges,
 * the 1904 date system, the colour rules it has a rule for (conditional formats: more or less than, between, equal, contains, before today, top
 * or bottom N, duplicates, data bars, a colour scale). What it cannot keep (merged cells, charts and pictures, borders, other conditional formats, drop-down checks, pivot tables,
 * comments, links, frozen columns, hidden rows, formulas it has no function for) it says once, in his words, in `lost`. Pure.
 */
import { unzipSync } from '../convert/zip';
import { addr, entry, newBook, type Book, type Cell, type Fmt, type Sheet, type Val, type ErrCode } from './model';
import { hasFunction } from './formula';
import { FILL_HEX } from './xlsx';
import { MAXC, MAXR, colIndex, parseAddr, parseRange, shiftFormula, tokenize } from './tokens';
import { ruleId, type Rule } from './rules';

interface X {
  tag: string;
  a: Record<string, string>;
  kids: X[];
  text: string;
}
const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unent = (s: string): string => s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g, (m, e: string) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENT[e] ?? m)));

/** The tree of a small XML document: tags without their prefixes, attributes, text. No DTDs, no schemas, nothing fetched. */
export function xmlTree(src: string): X {
  const root: X = { tag: '#root', a: {}, kids: [], text: '' };
  const stack: X[] = [root];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/([^\s>]+)\s*>|<([^\s/>!?]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const top = stack[stack.length - 1]!;
    if (m[1] !== undefined) top.text += m[1];
    else if (m[2] !== undefined) {
      if (stack.length > 1) stack.pop();
    } else if (m[3] !== undefined) {
      const a: Record<string, string> = {};
      for (const at of m[4]!.matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) a[at[1]!.replace(/^.*:/, '')] = unent(at[2] ?? at[3] ?? '');
      const node: X = { tag: m[3].replace(/^.*:/, ''), a, kids: [], text: '' };
      top.kids.push(node);
      if (!m[5]) stack.push(node);
    } else if (m[6] !== undefined) top.text += unent(m[6]);
  }
  return root;
}
const kid = (x: X | undefined, tag: string): X | undefined => x?.kids.find((k) => k.tag === tag);
const kids = (x: X | undefined, tag: string): X[] => x?.kids.filter((k) => k.tag === tag) ?? [];
const all = (x: X, tag: string, out: X[] = []): X[] => {
  for (const k of x.kids) {
    if (k.tag === tag) out.push(k);
    all(k, tag, out);
  }
  return out;
};
const textOf = (x: X): string => (x.tag === 'rPh' || x.tag === 'phoneticPr' ? '' : x.text + x.kids.map(textOf).join(''));

const BUILTIN_FMT: Record<number, string> = { 0: 'General', 1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 9: '0%', 10: '0.00%', 49: '@' };
const isDateId = (id: number): boolean => (id >= 14 && id <= 22) || (id >= 45 && id <= 47);

/** One of Excel's conditional-format rules as one of ours, or null when ours has no such rule. */
function ruleFrom(cr: X, range: string, tones: (1 | 2 | 3 | 4 | 5 | undefined)[]): Rule | null {
  const type = cr.a.type ?? '';
  const op = cr.a.operator ?? '';
  const fs = kids(cr, 'formula').map((f) => f.text.trim());
  const num = (s: string | undefined) => (s !== undefined && /^-?\d+(?:\.\d+)?(?:E[+-]?\d+)?$/i.test(s) ? Number(s) : null);
  const tone = tones[Number(cr.a.dxfId ?? -1)];
  const base = { id: ruleId(), range, ...(tone ? { tone } : {}) };
  if (type === 'cellIs') {
    const a = num(fs[0]);
    if (a === null) return null;
    if (op === 'greaterThan' || op === 'greaterThanOrEqual') return { ...base, kind: 'over', a };
    if (op === 'lessThan' || op === 'lessThanOrEqual') return { ...base, kind: 'under', a };
    if (op === 'equal') return { ...base, kind: 'equal', a };
    const b = num(fs[1]);
    if (op === 'between' && b !== null) return { ...base, kind: 'between', a, b };
    return null;
  }
  if (type === 'containsText' && cr.a.text) return { ...base, kind: 'contains', a: cr.a.text };
  if (type === 'top10' && cr.a.percent !== '1') return { ...base, kind: cr.a.bottom === '1' ? 'bottom' : 'top', n: Math.max(1, Number(cr.a.rank) || 10) };
  if (type === 'duplicateValues') return { ...base, kind: 'dupes' };
  if (type === 'dataBar') return { id: base.id, range, kind: 'bars' };
  if (type === 'colorScale') return { id: base.id, range, kind: 'scale' };
  if (type === 'expression' && /<\s*TODAY\(\)/i.test(fs[0] ?? '')) return { ...base, kind: 'overdue' };
  return null;
}

/** An Excel format code as one of the house's formats. */
function fmtOf(code: string): Partial<Fmt> {
  const clean = code.replace(/"[^"]*"/g, '').replace(/\\./g, '').replace(/\[[^\]]*\]/g, '').split(';')[0]!;
  const quoted = code.split(';')[0]!;
  if (/^general$/i.test(code)) return {};
  if (/@/.test(clean)) return { n: 'text' };
  if (/[ymdhs]/i.test(clean.replace(/E[+-]/gi, ''))) return { n: 'date' };
  const dec = (/\.(0+|#+)/.exec(clean)?.[1] ?? '').length;
  if (/%/.test(clean)) return { n: 'percent', ...(dec !== 2 ? { d: dec } : {}) };
  if (/[£€$]/.test(quoted) || /\[\$[£€$]/.test(code)) return { n: 'currency', ...(dec !== 2 ? { d: dec } : {}) };
  if (/[0#]/.test(clean)) return { n: 'number', ...(dec !== 2 ? { d: dec } : {}), ...(/,/.test(clean) ? {} : { k: 1 as const }) };
  return {};
}
const nearest = (rgb: string): { fill: 1 | 2 | 3 | 4 | 5; exact: boolean } => {
  const c = (h: string) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = c(rgb.slice(-6));
  let best = 0;
  let d = Infinity;
  FILL_HEX.forEach((h, i) => {
    const [x, y, z] = c(h);
    const dist = (r! - x!) ** 2 + (g! - y!) ** 2 + (b! - z!) ** 2;
    if (dist < d) [best, d] = [i, dist];
  });
  return { fill: (best + 1) as 1 | 2 | 3 | 4 | 5, exact: d === 0 };
};

const NOT_A_BOOK = 'That isn’t a spreadsheet I can read: it isn’t an .xlsx file (an .xls from an old Excel needs saving as .xlsx first).';
const ERR_CODES = new Set(['#DIV/0!', '#REF!', '#NAME?', '#VALUE!', '#N/A', '#NUM!', '#CALC!', '#SPILL!']);

/** The workbook in these bytes, and what it could not keep (each said once). */
export function readXlsx(bytes: Uint8Array, title = 'Imported spreadsheet'): { book: Book; lost: string[] } {
  let files: Map<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error(NOT_A_BOOK);
  }
  const dec = new TextDecoder();
  const part = (name: string): X | null => {
    const f = files.get(name);
    return f ? xmlTree(dec.decode(f)) : null;
  };
  const wbRoot = part('xl/workbook.xml');
  const wb = wbRoot && kid(wbRoot, 'workbook');
  if (!wb) throw new Error(NOT_A_BOOK);
  const lost = new Set<string>();
  const say = (s: string) => lost.add(s);
  const relsRoot = part('xl/_rels/workbook.xml.rels');
  const rels = new Map<string, string>();
  for (const r of all(relsRoot ?? { tag: '', a: {}, kids: [], text: '' }, 'Relationship')) rels.set(r.a.Id!, r.a.Target!.replace(/^\/?(xl\/)?/, 'xl/'));
  // shared strings
  const sst = part('xl/sharedStrings.xml');
  const shared = sst ? kids(kid(sst, 'sst'), 'si').map((si) => textOf(si)) : [];
  // styles
  const styleRoot = kid(part('xl/styles.xml') ?? { tag: '', a: {}, kids: [], text: '' }, 'styleSheet');
  const fmtCodes = new Map<number, string>();
  for (const n of kids(kid(styleRoot, 'numFmts'), 'numFmt')) fmtCodes.set(Number(n.a.numFmtId), n.a.formatCode ?? '');
  const fonts = kids(kid(styleRoot, 'fonts'), 'font').map((f) => ({ b: !!kid(f, 'b') && kid(f, 'b')!.a.val !== '0', i: !!kid(f, 'i') && kid(f, 'i')!.a.val !== '0' }));
  const fills = kids(kid(styleRoot, 'fills'), 'fill').map((f) => {
    const p = kid(f, 'patternFill');
    const fg = kid(p, 'fgColor');
    return p?.a.patternType === 'solid' && fg?.a.rgb ? fg.a.rgb : p?.a.patternType === 'solid' && fg?.a.theme !== undefined ? 'theme' : '';
  });
  const borders = kids(kid(styleRoot, 'borders'), 'border').map((b) => b.kids.some((s) => !!s.a.style && s.a.style !== 'none'));
  const xfs = kids(kid(styleRoot, 'cellXfs'), 'xf').map((xf) => {
    const id = Number(xf.a.numFmtId ?? 0);
    const code = fmtCodes.get(id) ?? BUILTIN_FMT[id];
    const al = kid(xf, 'alignment')?.a.horizontal;
    const f = fonts[Number(xf.a.fontId ?? 0)];
    const rgb = fills[Number(xf.a.fillId ?? 0)] ?? '';
    const x: Fmt = { ...(code !== undefined ? fmtOf(code) : isDateId(id) ? { n: 'date' as const } : {}) };
    if (isDateId(id) && !x.n) x.n = 'date';
    if (f?.b) x.b = 1;
    if (f?.i) x.i = 1;
    if (al === 'left' || al === 'center' || al === 'right') x.a = al === 'left' ? 'l' : al === 'center' ? 'c' : 'r';
    let approx = false;
    if (rgb && rgb !== 'theme') {
      const n = nearest(rgb);
      x.fill = n.fill;
      approx = !n.exact;
    } else if (rgb === 'theme') {
      x.fill = 5;
      approx = true;
    }
    return { x, border: borders[Number(xf.a.borderId ?? 0)] === true, approx };
  });
  // the fills of the colour rules (dxfs), each to the nearest of the house's five
  const dxfTones = kids(kid(styleRoot, 'dxfs'), 'dxf').map((d) => {
    const p = kid(kid(d, 'fill'), 'patternFill');
    const rgb = kid(p, 'bgColor')?.a.rgb ?? kid(p, 'fgColor')?.a.rgb ?? '';
    return rgb ? nearest(rgb).fill : undefined;
  });
  const d1904 = kid(wb, 'workbookPr')?.a.date1904 === '1' || kid(wb, 'workbookPr')?.a.date1904 === 'true';
  if (d1904) say('dates counted from 1904 (older Mac files): I moved them to the usual count, so they read the same');
  const book = newBook(title);
  const sheets: Sheet[] = [];
  const sheetNodes = kids(kid(wb, 'sheets'), 'sheet');
  let active = Number(kid(kid(wb, 'bookViews'), 'workbookView')?.a.activeTab ?? 0);
  for (const sn of sheetNodes) {
    const target = rels.get(sn.a.id!) ?? `xl/worksheets/sheet${sheets.length + 1}.xml`;
    const root = part(target);
    const ws = root && kid(root, 'worksheet');
    const sheet: Sheet = { name: (sn.a.name ?? `Sheet${sheets.length + 1}`).slice(0, 31), cells: {}, widths: {}, heights: {}, frozen: false };
    sheets.push(sheet);
    if (!ws) continue;
    if (sn.a.state === 'hidden' || sn.a.state === 'veryHidden') say('hidden sheets (they are shown)');
    const pane = kid(kid(kid(ws, 'sheetViews'), 'sheetView'), 'pane');
    if (pane && pane.a.state?.startsWith('frozen')) {
      sheet.frozen = Number(pane.a.ySplit ?? 0) >= 1;
      if (Number(pane.a.xSplit ?? 0) > 0) say('frozen columns (the first row can stay frozen)');
      if (Number(pane.a.ySplit ?? 0) > 1) say('more than one frozen row (the first row stays frozen)');
    }
    for (const c of kids(kid(ws, 'cols'), 'col')) {
      const px = Math.round(Number(c.a.width) * 7);
      if (!px) continue;
      for (let k = Number(c.a.min) - 1; k <= Math.min(Number(c.a.max) - 1, MAXC - 1); k++) sheet.widths[k] = Math.max(40, Math.min(480, px));
      if (c.a.hidden === '1') say('hidden columns (they are shown)');
    }
    const shares = new Map<string, { f: string; r: number; c: number }>();
    const arrays: { r: number; c: number; h: number; w: number }[] = [];
    let past = false;
    for (const row of kids(kid(ws, 'sheetData'), 'row')) {
      const r0 = Number(row.a.r) - 1;
      if (row.a.ht && row.a.customHeight === '1') sheet.heights[r0] = Math.round(Number(row.a.ht) / 0.75);
      if (row.a.hidden === '1') say('hidden rows (they are shown)');
      for (const c of kids(row, 'c')) {
        const p = parseAddr(c.a.r ?? '');
        if (!p) continue;
        if (p.r >= MAXR || p.c >= MAXC) {
          past = true;
          continue;
        }
        const xf = xfs[Number(c.a.s ?? 0)];
        if (xf?.border) say('cell borders');
        if (xf?.approx) say('fill colours (each moved to the nearest of mine)');
        const v = kid(c, 'v')?.text;
        const t = c.a.t ?? 'n';
        let val: Val | undefined;
        if (t === 's') val = shared[Number(v)] ?? '';
        else if (t === 'inlineStr') val = textOf(kid(c, 'is') ?? { tag: '', a: {}, kids: [], text: '' });
        else if (t === 'str') val = v ?? '';
        else if (t === 'b') val = v === '1';
        else if (t === 'e') val = ERR_CODES.has(v ?? '') ? { e: v as ErrCode } : { e: '#VALUE!' };
        else if (t === 'd' && v) val = Date.parse(v) ? Math.round(Date.parse(v) / 86_400_000 + 25569) : undefined;
        else if (v !== undefined && v !== '') {
          const n = Number(v);
          val = Number.isFinite(n) ? n : undefined;
        }
        if (typeof val === 'number' && d1904 && xf?.x.n === 'date') val += 1462;
        const fx = kid(c, 'f');
        let f: string | undefined;
        if (fx) {
          const ft = fx.a.t;
          if (ft === 'dataTable') say('data tables (the numbers are kept)');
          else if (ft === 'shared') {
            if (fx.text.trim()) {
              shares.set(fx.a.si!, { f: fx.text, r: p.r, c: p.c });
              f = fx.text;
            } else {
              const m = shares.get(fx.a.si!);
              if (m) f = shiftFormula(m.f, p.r - m.r, p.c - m.c);
            }
          } else if (fx.text.trim()) f = fx.text;
          if (ft === 'array' && fx.a.ref) {
            const g = fx.a.ref.split(':').map((a) => parseAddr(a));
            if (g[0] && g[1]) arrays.push({ r: g[0].r, c: g[0].c, h: g[1].r - g[0].r + 1, w: g[1].c - g[0].c + 1 });
          }
        }
        let cell: Cell = {};
        if (f !== undefined) {
          const clean = f.replace(/_xlfn\.(?:_xlws\.)?|_xlws\./g, '');
          cell.f = clean;
          try {
            const toks = tokenize(clean);
            toks.forEach((tk, i) => {
              if (tk.t === 'name' && toks.slice(i + 1).find((x) => x.t !== 'ws')?.t === '(' && !hasFunction(tk.src)) say(`formulas that use ${tk.src.toUpperCase()} (I have no ${tk.src.toUpperCase()}: the formula is kept as written and shows #NAME? here)`);
            });
          } catch {
            say('a formula I couldn’t read (it is kept as written)');
          }
        } else if (val !== undefined) cell.v = val;
        if (xf && Object.keys(xf.x).length) cell.x = xf.x;
        if (cell.f !== undefined || cell.v !== undefined || cell.x) sheet.cells[addr(p.r, p.c)] = cell;
      }
    }
    // the rest of an array formula's cells are its spill, not cells of their own
    for (const g of arrays) for (let i = 0; i < g.h; i++) for (let j = 0; j < g.w; j++) if ((i || j) && sheet.cells[addr(g.r + i, g.c + j)]?.f === undefined) delete sheet.cells[addr(g.r + i, g.c + j)];
    if (past) say('cells past row 10,000 or column AZ');
    if (kid(ws, 'mergeCells')) say('merged cells (each shows in its top-left cell)');
    for (const cf of kids(ws, 'conditionalFormatting')) {
      for (const ref of (cf.a.sqref ?? '').split(/\s+/).filter(Boolean)) {
        if (!parseRange(ref)) {
          say('colour rules over cells past row 10,000 or column AZ');
          continue;
        }
        for (const cr of kids(cf, 'cfRule')) {
          const r = ruleFrom(cr, ref.replace(/\$/g, ''), dxfTones);
          if (r) (sheet.rules ??= []).push(r);
          else say('some colour rules (the kinds I have are more or less than, between, equal, contains, before today, top or bottom, duplicates, bars and a scale)');
        }
      }
    }
    if (kid(ws, 'dataValidations')) say('drop-down lists and input checks');
    if (kid(ws, 'hyperlinks')) say('links (their words are kept)');
    if (kid(ws, 'drawing') || kid(ws, 'legacyDrawing') || kid(ws, 'picture')) say('charts, pictures and comments (the numbers behind them are here)');
    if (kid(ws, 'tableParts')) say('tables’ own styling (the cells are kept)');
    if (kid(ws, 'autoFilter')) say('filter buttons (use FILTER on a column’s header)');
    if (kid(ws, 'sheetProtection')) say('sheet protection');
  }
  for (const n of files.keys()) {
    if (/^xl\/(charts|media|drawings|pivotTables|pivotCache)\//.test(n)) say(/pivot/.test(n) ? 'pivot tables (the numbers they made are kept)' : 'charts, pictures and comments (the numbers behind them are here)');
    if (/^xl\/(comments|threadedComments)/.test(n)) say('charts, pictures and comments (the numbers behind them are here)');
    if (/vbaProject/.test(n)) say('macros');
  }
  const names: Record<string, string> = {};
  for (const dn of kids(kid(wb, 'definedNames'), 'definedName')) {
    const n = dn.a.name ?? '';
    const ref = dn.text.trim();
    if (n.startsWith('_xlnm.')) continue;
    if (/^(?:'[^']+'|[A-Za-z0-9_.]+)!\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?$/.test(ref)) names[n] = ref;
    else say(`named formulas (like ${n}); named ranges are kept`);
  }
  if (!sheets.length) throw new Error(NOT_A_BOOK);
  active = Math.max(0, Math.min(active, sheets.length - 1));
  void colIndex;
  void entry;
  return { book: { ...book, title, from: 'read from a file', sheets, names, view: { sheet: active, sel: 'A1' } }, lost: [...lost] };
}
