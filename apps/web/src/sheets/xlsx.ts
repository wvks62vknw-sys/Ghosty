/**
 * THE .XLSX WRITER (BRIEF-EDITOR-SPREADSHEETS): a workbook as the zip of XML Excel, Numbers and Sheets open, written by the app's own code over
 * convert/zip.ts (the same pattern as the Documents' .docx): the workbook, a part for each sheet, the shared strings, the styles. Values, formulas
 * (as formulas, with Excel's `_xlfn.` names, so Excel works them out again too, and its own cached figures beside), number formats, bold and
 * italic, alignment, fills, column widths, row heights, the frozen first row, hidden rows (a filter) and named ranges. A chart is NOT written:
 * its numbers are in the file and the chart is in the PDF (the export sheet says so). Pure.
 */
import { zipStore } from '../convert/zip';
import { addr, fmtCode, isErr, sheetIndex, usedCols, usedRows, type Book, type Cell, type Fmt, type Sheet, type Val } from './model';
import { Engine } from './formula';
import { visibleRows } from './ops';
import { colName, parseAddr, tokenize } from './tokens';

/** The five fills the house has, as the colours Excel is told (the design tokens' own values). */
export const FILL_HEX = ['64D2FF', 'FFB340', '30D158', 'FF6961', 'A8A59E'] as const;
const NEEDS_XLFN = new Set(['IFS', 'XLOOKUP', 'CONCAT', 'TEXTJOIN', 'MAXIFS', 'MINIFS', 'SWITCH', 'IFNA', 'UNIQUE', 'SEQUENCE', 'XOR']);
const NEEDS_XLWS = new Set(['FILTER', 'SORT']);
const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
export const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;')).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

/** A formula as the file spells it: newer functions carry Excel's prefixes. */
export function xlFormula(f: string): string {
  let toks;
  try {
    toks = tokenize(f);
  } catch {
    return f;
  }
  return toks
    .map((t, i) => {
      if (t.t !== 'name') return t.src;
      const next = toks.slice(i + 1).find((x) => x.t !== 'ws');
      if (next?.t !== '(') return t.src;
      const u = t.src.toUpperCase();
      return NEEDS_XLFN.has(u) ? `_xlfn.${u}` : NEEDS_XLWS.has(u) ? `_xlfn._xlws.${u}` : t.src;
    })
    .join('');
}

const BUILTIN: Record<string, number> = { General: 0, '0': 1, '0.00': 2, '#,##0': 3, '#,##0.00': 4, '0%': 9, '0.00%': 10, '@': 49 };
const xlCode = (code: string): string => code.replace(/^£/, '"£"').replace(/ /g, '\\ ');

interface Styles {
  xfs: string[];
  codes: string[];
  index: Map<string, number>;
}
function styleOf(st: Styles, x: Fmt | undefined): number {
  if (!x || (!x.n && !x.b && !x.i && !x.a && !x.fill)) return 0;
  const key = JSON.stringify(x);
  const known = st.index.get(key);
  if (known !== undefined) return known;
  const code = fmtCode(x);
  let numFmt = BUILTIN[code] ?? -1;
  if (numFmt < 0) {
    const xl = xlCode(code);
    let at = st.codes.indexOf(xl);
    if (at < 0) at = st.codes.push(xl) - 1;
    numFmt = 164 + at;
  }
  const font = x.b && x.i ? 3 : x.b ? 1 : x.i ? 2 : 0;
  const fill = x.fill ? 1 + x.fill : 0;
  const align = x.a ? `<alignment horizontal="${x.a === 'l' ? 'left' : x.a === 'c' ? 'center' : 'right'}"/>` : '';
  st.xfs.push(`<xf numFmtId="${numFmt}" fontId="${font}" fillId="${fill}" borderId="0" xfId="0"${numFmt ? ' applyNumberFormat="1"' : ''}${font ? ' applyFont="1"' : ''}${fill ? ' applyFill="1"' : ''}${x.a ? ' applyAlignment="1"' : ''}${align ? `>${align}</xf>` : '/>'}`);
  st.index.set(key, st.xfs.length - 1);
  return st.xfs.length - 1;
}

function cellXml(a: string, cell: Cell | undefined, v: Val, s: number, strings: Map<string, number>, array?: string): string {
  const style = s ? ` s="${s}"` : '';
  const sst = (t: string) => {
    let k = strings.get(t);
    if (k === undefined) strings.set(t, (k = strings.size));
    return k;
  };
  if (cell?.f !== undefined) {
    const f = `<f${array ? ` t="array" ref="${array}"` : ''}>${esc(xlFormula(cell.f))}</f>`;
    if (isErr(v)) return v.e === '#CIRCULAR!' ? `<c r="${a}"${style}>${f}<v>0</v></c>` : `<c r="${a}"${style} t="e">${f}<v>${v.e === '#SPILL!' ? '#VALUE!' : v.e}</v></c>`;
    if (typeof v === 'string') return `<c r="${a}"${style} t="str">${f}<v>${esc(v)}</v></c>`;
    if (typeof v === 'boolean') return `<c r="${a}"${style} t="b">${f}<v>${v ? 1 : 0}</v></c>`;
    return `<c r="${a}"${style}>${f}<v>${typeof v === 'number' ? v : 0}</v></c>`;
  }
  if (v === null || v === undefined) return `<c r="${a}"${style}/>`;
  if (isErr(v)) return `<c r="${a}"${style} t="e"><v>${v.e === '#CIRCULAR!' || v.e === '#SPILL!' ? '#VALUE!' : v.e}</v></c>`;
  if (typeof v === 'string') return `<c r="${a}"${style} t="s"><v>${sst(v)}</v></c>`;
  if (typeof v === 'boolean') return `<c r="${a}"${style} t="b"><v>${v ? 1 : 0}</v></c>`;
  return `<c r="${a}"${style}><v>${v}</v></c>`;
}

function sheetXml(b: Book, s: Sheet, si: number, eng: Engine, st: Styles, strings: Map<string, number>): string {
  const rows = new Map<number, [number, string][]>();
  const put = (r: number, c: number, xml: string) => (rows.get(r) ?? rows.set(r, []).get(r)!).push([c, xml]);
  const spills = eng.spills().filter((g) => g.sheet === s.name);
  const owner = new Map(spills.map((g) => [addr(g.r, g.c), `${addr(g.r, g.c)}:${addr(g.r + g.h - 1, g.c + g.w - 1)}`]));
  for (const [a, cell] of Object.entries(s.cells)) {
    const p = parseAddr(a)!;
    put(p.r, p.c, cellXml(a, cell, eng.value(s.name, a), styleOf(st, cell.x), strings, owner.get(a)));
  }
  for (const g of spills)
    for (let i = 0; i < g.h; i++)
      for (let j = 0; j < g.w; j++) if (i || j) put(g.r + i, g.c + j, cellXml(addr(g.r + i, g.c + j), undefined, eng.value(s.name, addr(g.r + i, g.c + j)), 0, strings));
  const shown = s.filter ? new Set(visibleRows(s, s.filter, eng)) : null;
  const last = Math.max(usedRows(s), 1);
  const heights = Object.keys(s.heights).map(Number);
  const allRows = new Set<number>([...rows.keys(), ...heights.map((h) => h)]);
  if (shown) for (let r = 0; r < last; r++) if (!shown.has(r + 1)) allRows.add(r);
  const sheetData = [...allRows]
    .sort((p, q) => p - q)
    .map((r) => {
      const attrs = `${s.heights[r] ? ` ht="${(s.heights[r]! * 0.75).toFixed(2)}" customHeight="1"` : ''}${shown && !shown.has(r + 1) ? ' hidden="1"' : ''}`;
      return `<row r="${r + 1}"${attrs}>${(rows.get(r) ?? []).sort((p, q) => p[0] - q[0]).map((x) => x[1]).join('')}</row>`;
    })
    .join('');
  const cols = Object.entries(s.widths)
    .map(([c, px]) => [Number(c), px] as const)
    .sort((p, q) => p[0] - q[0])
    .map(([c, px]) => `<col min="${c + 1}" max="${c + 1}" width="${(px / 7).toFixed(4)}" customWidth="1"/>`)
    .join('');
  const used = usedCols(s);
  const dim = used && last ? `A1:${colName(used - 1)}${last}` : 'A1';
  const view = `<sheetViews><sheetView workbookViewId="0"${si === b.view.sheet ? ' tabSelected="1"' : ''}>${s.frozen ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/>' : ''}</sheetView></sheetViews>`;
  return `${HEAD}<worksheet ${NS}><dimension ref="${dim}"/>${view}<sheetFormatPr defaultRowHeight="15"/>${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${sheetData}</sheetData><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`;
}

/** The workbook as .xlsx bytes. */
export function writeXlsx(b: Book): Uint8Array {
  const eng = new Engine(b);
  const st: Styles = { xfs: ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'], codes: [], index: new Map() };
  const strings = new Map<string, number>();
  const sheets = b.sheets.map((s, i) => sheetXml(b, s, i, eng, st, strings));
  const sst = `${HEAD}<sst ${NS} count="${strings.size}" uniqueCount="${strings.size}">${[...strings.keys()].map((t) => `<si><t xml:space="preserve">${esc(t)}</t></si>`).join('')}</sst>`;
  const fills = `<fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${FILL_HEX.map((h) => `<fill><patternFill patternType="solid"><fgColor rgb="FF${h}"/><bgColor indexed="64"/></patternFill></fill>`).join('')}</fills>`;
  const fonts = '<fonts count="4"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><i/><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><i/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>';
  const styles = `${HEAD}<styleSheet ${NS}>${st.codes.length ? `<numFmts count="${st.codes.length}">${st.codes.map((c, i) => `<numFmt numFmtId="${164 + i}" formatCode="${esc(c)}"/>`).join('')}</numFmts>` : ''}${fonts}${fills}<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${st.xfs.length}">${st.xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const names = Object.entries(b.names).map(([n, ref]) => `<definedName name="${esc(n)}">${esc(ref)}</definedName>`).join('');
  const workbook = `${HEAD}<workbook ${NS}><workbookPr defaultThemeVersion="124226"/><bookViews><workbookView activeTab="${Math.max(0, Math.min(b.view.sheet, b.sheets.length - 1))}"/></bookViews><sheets>${b.sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${names ? `<definedNames>${names}</definedNames>` : ''}<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`;
  const n = b.sheets.length;
  const rels = `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${b.sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId${n + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`;
  const types = `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${b.sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
  const root = `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
  const when = new Date(b.at || Date.now()).toISOString().replace(/\.\d+Z$/, 'Z');
  const core = `${HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(b.title)}</dc:title><dc:creator>Ghosty</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${when}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${when}</dcterms:modified></cp:coreProperties>`;
  const app = `${HEAD}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Ghosty</Application></Properties>`;
  return zipStore([
    { name: '[Content_Types].xml', data: types },
    { name: '_rels/.rels', data: root },
    { name: 'docProps/core.xml', data: core },
    { name: 'docProps/app.xml', data: app },
    { name: 'xl/workbook.xml', data: workbook },
    { name: 'xl/_rels/workbook.xml.rels', data: rels },
    { name: 'xl/styles.xml', data: styles },
    { name: 'xl/sharedStrings.xml', data: sst },
    ...sheets.map((x, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: x })),
  ]);
}
export { sheetIndex };
