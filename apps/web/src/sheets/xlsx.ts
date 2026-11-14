/**
 * THE .XLSX WRITER (BRIEF-EDITOR-SPREADSHEETS): a workbook as the zip of XML Excel, Numbers and Sheets open, written by the app's own code over
 * convert/zip.ts (the same pattern as the Documents' .docx): the workbook, a part for each sheet, the shared strings, the styles. Values, formulas
 * (as formulas, with Excel's `_xlfn.` names, so Excel works them out again too, and its own cached figures beside), number formats, bold and
 * italic, alignment, fills, column widths, row heights, the frozen first row, hidden rows (a filter), named ranges and the colour rules (as
 * Excel's own conditionalFormatting, each fill a dxf: one for each of the house's five, in order). The pro edition adds: charts as real
 * Excel charts (a drawing and a chart part each: column, bar, line, area, pie, scatter, stacked, combo, with title, key, axis words and
 * colours), sparklines (Excel's own, in the sheet's extLst), input checks (dataValidation: a list, a tick box as a TRUE/FALSE list, a date),
 * merged cells, borders, wrapped words, more number formats and table styles (a real table part with its style). Pure.
 */
import { zipStore } from '../convert/zip';
import { addr, fmtCode, isErr, sheetIndex, usedCols, usedRows, type Book, type Cell, type Chart, type Fmt, type Sheet, type Val } from './model';
import { Engine } from './formula';
import { visibleRows } from './ops';
import { colName, parseAddr, parseRange, tokenize } from './tokens';
import { RULE_TONE, type Rule } from './rules';

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
  /** Border sides (1 top, 2 right, 4 bottom, 8 left) to their place in the borders list. */
  borders: number[];
}
const borderXml = (m: number): string => {
  const side = (tag: string, on: boolean) => (on ? `<${tag} style="thin"><color auto="1"/></${tag}>` : `<${tag}/>`);
  return `<border>${side('left', !!(m & 8))}${side('right', !!(m & 2))}${side('top', !!(m & 1))}${side('bottom', !!(m & 4))}<diagonal/></border>`;
};
function styleOf(st: Styles, x: Fmt | undefined): number {
  if (!x || (!x.n && !x.nx && !x.b && !x.i && !x.a && !x.fill && !x.bd && !x.w)) return 0;
  const key = JSON.stringify(x);
  const known = st.index.get(key);
  if (known !== undefined) return known;
  const code = fmtCode(x);
  let numFmt = BUILTIN[code] ?? -1;
  if (numFmt < 0) {
    const xl = x.nx ? code : xlCode(code);
    let at = st.codes.indexOf(xl);
    if (at < 0) at = st.codes.push(xl) - 1;
    numFmt = 164 + at;
  }
  const font = x.b && x.i ? 3 : x.b ? 1 : x.i ? 2 : 0;
  const fill = x.fill ? 1 + x.fill : 0;
  const align = x.a || x.w ? `<alignment${x.a ? ` horizontal="${x.a === 'l' ? 'left' : x.a === 'c' ? 'center' : 'right'}"` : ''}${x.w ? ' wrapText="1"' : ''}/>` : '';
  let border = 0;
  if (x.bd) {
    border = st.borders.indexOf(x.bd);
    if (border < 0) border = st.borders.push(x.bd) - 1;
  }
  st.xfs.push(`<xf numFmtId="${numFmt}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0"${numFmt ? ' applyNumberFormat="1"' : ''}${font ? ' applyFont="1"' : ''}${fill ? ' applyFill="1"' : ''}${border ? ' applyBorder="1"' : ''}${align ? ' applyAlignment="1"' : ''}${align ? `>${align}</xf>` : '/>'}`);
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

/** A sheet's colour rules as Excel's conditionalFormatting elements (dxfId n-1 is the house's fill n). */
export function rulesXml(rules: Rule[] | undefined): string {
  let pri = 0;
  return (rules ?? [])
    .map((r) => {
      const g = parseRange(r.range);
      if (!g) return '';
      const tl = addr(g.r1, g.c1);
      const dxf = `dxfId="${(r.tone ?? RULE_TONE[r.kind]) - 1}" priority="${++pri}"`;
      const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? String(v) : '0');
      const words = String(r.a ?? '');
      const q = words.replace(/"/g, '""');
      const rule =
        r.kind === 'over' ? `<cfRule type="cellIs" ${dxf} operator="greaterThan"><formula>${num(r.a)}</formula></cfRule>`
        : r.kind === 'under' ? `<cfRule type="cellIs" ${dxf} operator="lessThan"><formula>${num(r.a)}</formula></cfRule>`
        : r.kind === 'equal' ? `<cfRule type="cellIs" ${dxf} operator="equal"><formula>${num(r.a)}</formula></cfRule>`
        : r.kind === 'between' ? `<cfRule type="cellIs" ${dxf} operator="between"><formula>${num(r.a)}</formula><formula>${num(r.b)}</formula></cfRule>`
        : r.kind === 'contains' ? `<cfRule type="containsText" ${dxf} operator="containsText" text="${esc(words)}"><formula>${esc(`NOT(ISERROR(SEARCH("${q}",${tl})))`)}</formula></cfRule>`
        : r.kind === 'overdue' ? `<cfRule type="expression" ${dxf}><formula>${esc(`AND(ISNUMBER(${tl}),${tl}>=1,INT(${tl})<TODAY())`)}</formula></cfRule>`
        : r.kind === 'top' || r.kind === 'bottom' ? `<cfRule type="top10" ${dxf} rank="${Math.max(1, r.n ?? 10)}"${r.kind === 'bottom' ? ' bottom="1"' : ''}/>`
        : r.kind === 'dupes' ? `<cfRule type="duplicateValues" ${dxf}/>`
        : r.kind === 'bars' ? `<cfRule type="dataBar" priority="${pri}"><dataBar><cfvo type="min"/><cfvo type="max"/><color rgb="FF${FILL_HEX[0]}"/></dataBar></cfRule>`
        : `<cfRule type="colorScale" priority="${pri}"><colorScale><cfvo type="min"/><cfvo type="max"/><color rgb="FF${FILL_HEX[3]}"/><color rgb="FF${FILL_HEX[2]}"/></colorScale></cfRule>`;
      return `<conditionalFormatting sqref="${esc(r.range)}">${rule}</conditionalFormatting>`;
    })
    .join('');
}

/** A range on a sheet as a chart or a sparkline points at it ('Sheet 1'!$A$2:$A$13). */
export const absRef = (sheet: string, range: string): string => `${/^[A-Za-z_][A-Za-z0-9_.]*$/.test(sheet) ? sheet : `'${sheet.replace(/'/g, "''")}'`}!${range.split(':').map((a) => a.replace(/^([A-Z]+)(\d+)$/, '$$$1$$$2')).join(':')}`;
/** The tables' styles Excel has, one for each of the house's five colours. */
export const TABLE_STYLE = ['TableStyleMedium2', 'TableStyleMedium5', 'TableStyleMedium7', 'TableStyleMedium3', 'TableStyleMedium4'] as const;

/** A sheet's input checks as Excel's dataValidations. */
export function checksXml(s: Sheet): string {
  const list = (s.checks ?? []).map((k) => {
    const sq = esc(k.range);
    if (k.kind === 'date') return `<dataValidation type="date" operator="greaterThanOrEqual" allowBlank="1" showErrorMessage="1" errorTitle="A date" error="This cell takes a date." sqref="${sq}"><formula1>1</formula1></dataValidation>`;
    const items = k.kind === 'tick' ? ['TRUE', 'FALSE'] : (k.items ?? []).map((t) => t.replace(/[,"]/g, ' ').trim()).filter(Boolean);
    return `<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="One of the list" error="${esc(k.kind === 'tick' ? 'This cell is a tick box: TRUE or FALSE.' : `Choose one of: ${items.join(', ')}.`.slice(0, 225))}" sqref="${sq}"><formula1>${esc(`"${items.join(',')}"`.slice(0, 255))}</formula1></dataValidation>`;
  });
  return list.length ? `<dataValidations count="${list.length}">${list.join('')}</dataValidations>` : '';
}
/** A sheet's sparklines as Excel's own (x14), in the sheet's extLst. */
export function sparksXml(s: Sheet): string {
  if (!s.sparks?.length) return '';
  const groups = s.sparks.map((k) => `<x14:sparklineGroup${k.kind === 'column' ? ' type="column"' : ''} displayEmptyCellsAs="gap"><x14:colorSeries rgb="FF${FILL_HEX[(k.tone ?? 1) - 1]}"/><x14:colorHigh rgb="FF${FILL_HEX[(k.tone ?? 1) - 1]}"/><x14:sparklines><x14:sparkline><xm:f>${esc(absRef(s.name, k.range))}</xm:f><xm:sqref>${esc(k.at)}</xm:sqref></x14:sparkline></x14:sparklines></x14:sparklineGroup>`).join('');
  return `<extLst><ext uri="{05C60535-1F16-4fd2-B633-F4F36F0B64E0}" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main"><x14:sparklineGroups xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main">${groups}</x14:sparklineGroups></ext></extLst>`;
}

const rich = (t: string) => `<c:tx><c:rich><a:bodyPr/><a:p><a:r><a:t>${esc(t)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/>`;
/** One chart as Excel's chart part. */
export function chartXml(c: Chart): string {
  const ref = (r: string) => esc(absRef(c.sheet, r));
  const vals = [c.values, ...(c.more ?? [])];
  const hex = (k: number) => FILL_HEX[((c.tone ?? 1) - 1 + k) % 5]!;
  const fill = (k: number) => `<a:solidFill><a:srgbClr val="${hex(k)}"/></a:solidFill>`;
  const name = (k: number) => `<c:tx><c:v>${esc(c.names?.[k] ?? `Series ${k + 1}`)}</c:v></c:tx>`;
  const cat = c.labels ? `<c:cat><c:strRef><c:f>${ref(c.labels)}</c:f></c:strRef></c:cat>` : '';
  const val = (k: number) => `<c:val><c:numRef><c:f>${ref(vals[k]!)}</c:f></c:numRef></c:val>`;
  const barSer = (k: number) => `<c:ser><c:idx val="${k}"/><c:order val="${k}"/>${name(k)}<c:spPr>${fill(k)}</c:spPr><c:invertIfNegative val="0"/>${cat}${val(k)}</c:ser>`;
  const lineSer = (k: number) => `<c:ser><c:idx val="${k}"/><c:order val="${k}"/>${name(k)}<c:spPr><a:ln w="28575" cap="rnd"><a:solidFill><a:srgbClr val="${hex(k)}"/></a:solidFill></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr>${fill(k)}</c:spPr></c:marker>${cat}${val(k)}<c:smooth val="0"/></c:ser>`;
  const areaSer = (k: number) => `<c:ser><c:idx val="${k}"/><c:order val="${k}"/>${name(k)}<c:spPr>${fill(k)}</c:spPr>${cat}${val(k)}</c:ser>`;
  const ax = '<c:axId val="500000001"/><c:axId val="500000002"/>';
  const horiz = c.kind === 'bars' || c.kind === 'stackedbar';
  const stacked = c.kind === 'stackedbar' || c.kind === 'stackedcol';
  const ks = vals.map((_, k) => k);
  let plot = '';
  if (c.kind === 'pie') {
    const g = parseRange(c.values);
    const n = g ? g.r2 - g.r1 + 1 : 0;
    const dpts = Array.from({ length: Math.min(n, 60) }, (_, i) => `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr>${fill(i)}</c:spPr></c:dPt>`).join('');
    plot = `<c:pieChart><c:varyColors val="1"/><c:ser><c:idx val="0"/><c:order val="0"/>${name(0)}${dpts}${cat}${val(0)}</c:ser><c:firstSliceAng val="0"/></c:pieChart>`;
  } else if (c.kind === 'scatter') {
    const x = c.labels ? `<c:xVal><c:numRef><c:f>${ref(c.labels)}</c:f></c:numRef></c:xVal>` : '';
    plot = `<c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/><c:ser><c:idx val="0"/><c:order val="0"/>${name(0)}<c:spPr><a:ln w="19050"><a:noFill/></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="6"/><c:spPr>${fill(0)}</c:spPr></c:marker>${x}<c:yVal><c:numRef><c:f>${ref(c.values)}</c:f></c:numRef></c:yVal><c:smooth val="0"/></c:ser>${ax}</c:scatterChart>`;
  } else if (c.kind === 'line') plot = `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${ks.map(lineSer).join('')}<c:marker val="1"/>${ax}</c:lineChart>`;
  else if (c.kind === 'area') plot = `<c:areaChart><c:grouping val="standard"/><c:varyColors val="0"/>${ks.map(areaSer).join('')}${ax}</c:areaChart>`;
  else if (c.kind === 'combo') plot = `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${barSer(0)}<c:gapWidth val="80"/>${ax}</c:barChart><c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${ks.slice(1).map(lineSer).join('')}<c:marker val="1"/>${ax}</c:lineChart>`;
  else plot = `<c:barChart><c:barDir val="${horiz ? 'bar' : 'col'}"/><c:grouping val="${stacked ? 'stacked' : 'clustered'}"/><c:varyColors val="0"/>${ks.map(barSer).join('')}<c:gapWidth val="80"/>${stacked ? '<c:overlap val="100"/>' : ''}${ax}</c:barChart>`;
  const title = (t: string | undefined) => (t ? `<c:title>${rich(t)}</c:title>` : '');
  const axes =
    c.kind === 'pie' ? ''
    : c.kind === 'scatter'
      ? `<c:valAx><c:axId val="500000001"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/>${title(c.xTitle)}<c:numFmt formatCode="General" sourceLinked="1"/><c:tickLblPos val="nextTo"/><c:crossAx val="500000002"/><c:crosses val="autoZero"/><c:crossBetween val="midCat"/></c:valAx><c:valAx><c:axId val="500000002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/>${title(c.yTitle)}<c:numFmt formatCode="General" sourceLinked="1"/><c:tickLblPos val="nextTo"/><c:crossAx val="500000001"/><c:crosses val="autoZero"/><c:crossBetween val="midCat"/></c:valAx>`
      : `<c:catAx><c:axId val="500000001"/><c:scaling><c:orientation val="${horiz ? 'maxMin' : 'minMax'}"/></c:scaling><c:delete val="0"/><c:axPos val="${horiz ? 'l' : 'b'}"/>${title(c.xTitle)}<c:numFmt formatCode="General" sourceLinked="1"/><c:tickLblPos val="nextTo"/><c:crossAx val="500000002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx><c:valAx><c:axId val="500000002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${horiz ? 'b' : 'l'}"/><c:majorGridlines/>${title(c.yTitle)}<c:numFmt formatCode="General" sourceLinked="1"/><c:tickLblPos val="nextTo"/><c:crossAx val="500000001"/><c:crosses val="${horiz ? 'max' : 'autoZero'}"/><c:crossBetween val="between"/></c:valAx>`;
  const legend = c.legend === false ? '' : '<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>';
  return `${HEAD}<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:roundedCorners val="0"/><c:chart>${c.title ? `<c:title>${rich(c.title)}</c:title><c:autoTitleDeleted val="0"/>` : '<c:autoTitleDeleted val="1"/>'}<c:plotArea><c:layout/>${plot}${axes}</c:plotArea>${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`;
}
/** A sheet's charts as one drawing, each anchored to the right of its cells, one under another. */
function drawingXml(charts: Chart[], fromCol: number): string {
  const anchors = charts.map((_, k) => `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${fromCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${k * 18}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${fromCol + 8}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${k * 18 + 16}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${k + 2}" name="Chart ${k + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId${k + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`).join('');
  return `${HEAD}<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${anchors}</xdr:wsDr>`;
}
/** A table part: its range, a header row or not, and its style (banded rows or not). */
function tableXml(s: Sheet, eng: Engine, t: NonNullable<Sheet['tables']>[number], id: number): string {
  const g = parseRange(t.range)!;
  const used = new Set<string>();
  const cols = [];
  for (let c = g.c1; c <= g.c2; c++) {
    let n = t.header ? eng.text(s.name, addr(g.r1, c)).trim() : '';
    if (!n) n = `Column${c - g.c1 + 1}`;
    let u = n;
    for (let k = 2; used.has(u.toLowerCase()); k++) u = `${n}${k}`;
    used.add(u.toLowerCase());
    cols.push(`<tableColumn id="${c - g.c1 + 1}" name="${esc(u)}"/>`);
  }
  return `${HEAD}<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="${id}" name="Table${id}" displayName="Table${id}" ref="${esc(t.range)}"${t.header ? '' : ' headerRowCount="0"'} totalsRowShown="0">${t.header ? `<autoFilter ref="${esc(t.range)}"/>` : ''}<tableColumns count="${cols.length}">${cols.join('')}</tableColumns><tableStyleInfo name="${TABLE_STYLE[t.tone - 1]}" showFirstColumn="0" showLastColumn="0" showRowStripes="${t.banded ? 1 : 0}" showColumnStripes="0"/></table>`;
}

function sheetXml(b: Book, s: Sheet, si: number, eng: Engine, st: Styles, strings: Map<string, number>, tail = ''): string {
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
  return `${HEAD}<worksheet ${NS}><dimension ref="${dim}"/>${view}<sheetFormatPr defaultRowHeight="15"/>${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${sheetData}</sheetData>${s.merges?.length ? `<mergeCells count="${s.merges.length}">${s.merges.map((m) => `<mergeCell ref="${esc(m)}"/>`).join('')}</mergeCells>` : ''}${rulesXml(s.rules)}${checksXml(s)}<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>${tail}${sparksXml(s)}</worksheet>`;
}

/** The workbook as .xlsx bytes. */
export function writeXlsx(b: Book): Uint8Array {
  const eng = new Engine(b);
  const st: Styles = { xfs: ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'], codes: [], index: new Map(), borders: [0] };
  const strings = new Map<string, number>();
  // the parts beside each sheet: its drawing of charts, its tables
  const extra: { name: string; data: string }[] = [];
  const ctypes: string[] = [];
  let chartN = 0;
  let drawN = 0;
  let tableN = 0;
  const sheetRels: (string | null)[] = [];
  const sheets = b.sheets.map((s, i) => {
    const rels: string[] = [];
    let tail = '';
    const charts = b.charts.filter((c) => c.sheet.toLowerCase() === s.name.toLowerCase() && parseRange(c.values));
    if (charts.length) {
      const d = ++drawN;
      const crels = charts.map((c, k) => {
        const n = ++chartN;
        extra.push({ name: `xl/charts/chart${n}.xml`, data: chartXml(c) });
        ctypes.push(`<Override PartName="/xl/charts/chart${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`);
        return `<Relationship Id="rId${k + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${n}.xml"/>`;
      });
      extra.push({ name: `xl/drawings/drawing${d}.xml`, data: drawingXml(charts, usedCols(s) + 1) });
      extra.push({ name: `xl/drawings/_rels/drawing${d}.xml.rels`, data: `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${crels.join('')}</Relationships>` });
      ctypes.push(`<Override PartName="/xl/drawings/drawing${d}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
      rels.push(`<Relationship Id="rId${rels.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${d}.xml"/>`);
      tail += `<drawing r:id="rId${rels.length}"/>`;
    }
    const tables = (s.tables ?? []).filter((t) => parseRange(t.range));
    if (tables.length) {
      const parts = tables.map((t) => {
        const n = ++tableN;
        extra.push({ name: `xl/tables/table${n}.xml`, data: tableXml(s, eng, t, n) });
        ctypes.push(`<Override PartName="/xl/tables/table${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>`);
        rels.push(`<Relationship Id="rId${rels.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table${n}.xml"/>`);
        return `<tablePart r:id="rId${rels.length}"/>`;
      });
      tail += `<tableParts count="${parts.length}">${parts.join('')}</tableParts>`;
    }
    sheetRels.push(rels.length ? `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>` : null);
    return sheetXml(b, s, i, eng, st, strings, tail);
  });
  sheetRels.forEach((r, i) => r && extra.push({ name: `xl/worksheets/_rels/sheet${i + 1}.xml.rels`, data: r }));
  const sst = `${HEAD}<sst ${NS} count="${strings.size}" uniqueCount="${strings.size}">${[...strings.keys()].map((t) => `<si><t xml:space="preserve">${esc(t)}</t></si>`).join('')}</sst>`;
  const fills = `<fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${FILL_HEX.map((h) => `<fill><patternFill patternType="solid"><fgColor rgb="FF${h}"/><bgColor indexed="64"/></patternFill></fill>`).join('')}</fills>`;
  const fonts = '<fonts count="4"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><i/><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><i/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>';
  const styles = `${HEAD}<styleSheet ${NS}>${st.codes.length ? `<numFmts count="${st.codes.length}">${st.codes.map((c, i) => `<numFmt numFmtId="${164 + i}" formatCode="${esc(c)}"/>`).join('')}</numFmts>` : ''}${fonts}${fills}<borders count="${st.borders.length}">${st.borders.map(borderXml).join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${st.xfs.length}">${st.xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="5">${FILL_HEX.map((h) => `<dxf><fill><patternFill patternType="solid"><bgColor rgb="FF${h}"/></patternFill></fill></dxf>`).join('')}</dxfs></styleSheet>`;
  const names = Object.entries(b.names).map(([n, ref]) => `<definedName name="${esc(n)}">${esc(ref)}</definedName>`).join('');
  const workbook = `${HEAD}<workbook ${NS}><workbookPr defaultThemeVersion="124226"/><bookViews><workbookView activeTab="${Math.max(0, Math.min(b.view.sheet, b.sheets.length - 1))}"/></bookViews><sheets>${b.sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${names ? `<definedNames>${names}</definedNames>` : ''}<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`;
  const n = b.sheets.length;
  const rels = `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${b.sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId${n + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`;
  const types = `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${b.sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>${ctypes.join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
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
    ...extra,
  ]);
}
export { sheetIndex };
