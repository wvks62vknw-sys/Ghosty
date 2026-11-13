// A .xlsx made BY HAND, the way Excel writes one and not the way our writer does (BRIEF-EDITOR-SPREADSHEETS): shared strings with a rich-text run,
// a shared formula (one formula and its followers), a date1904-free date, a percentage and a pound format, a bold header, a frozen row, a column
// width, a merged cell, a chart part, a drawing and an `_xlfn.` function. The reader must keep the first set and say the second once.
// Shared by apps/edge/test/sheets.test.mjs and tests/sheets.spec.mjs; a tiny stored-zip writer of its own, so it does not lean on the app's.
const T = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = T[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
export function zip(files) {
  const locals = [];
  const dir = [];
  let off = 0;
  for (const [name, data] of Object.entries(files)) {
    const nb = Buffer.from(name);
    const db = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt32LE(crc(db), 14); h.writeUInt32LE(db.length, 18); h.writeUInt32LE(db.length, 22); h.writeUInt16LE(nb.length, 26);
    const d = Buffer.alloc(46);
    d.writeUInt32LE(0x02014b50, 0); d.writeUInt16LE(20, 4); d.writeUInt16LE(20, 6); d.writeUInt32LE(crc(db), 16); d.writeUInt32LE(db.length, 20); d.writeUInt32LE(db.length, 24); d.writeUInt16LE(nb.length, 28); d.writeUInt32LE(off, 42);
    locals.push(h, nb, db);
    dir.push(d, nb);
    off += 30 + nb.length + db.length;
  }
  const cd = Buffer.concat(dir);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...locals, cd, end]);
}
const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
/** The workbook: "Quarter" (a table with a shared formula and Excel's XLOOKUP) and "Notes" (a merged title). */
export function foreignXlsx() {
  return zip({
    '[Content_Types].xml': X + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>',
    '_rels/.rels': X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': X + `<workbook ${NS}><sheets><sheet name="Quarter" sheetId="1" r:id="rId1"/><sheet name="Notes" sheetId="2" r:id="rId2"/></sheets><definedNames><definedName name="Rate">Quarter!$E$1</definedName></definedNames></workbook>`,
    'xl/_rels/workbook.xml.rels': X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/sharedStrings.xml': X + `<sst ${NS} count="7" uniqueCount="6"><si><t>Item</t></si><si><t>Net</t></si><si><t>Gross</t></si><si><r><rPr><b/></rPr><t>Rent </t></r><r><t>and rates</t></r></si><si><t>Food</t></si><si><t>Quarter notes</t></si></sst>`,
    'xl/styles.xml': X + `<styleSheet ${NS}><numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;£&quot;#,##0.00"/><numFmt numFmtId="165" formatCode="d\\ mmm\\ yyyy"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFFF00"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/></border></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="1" applyNumberFormat="1"/><xf numFmtId="9" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="0" fillId="2" borderId="0" applyFill="1"/></cellXfs></styleSheet>`,
    'xl/worksheets/sheet1.xml': X + `<worksheet ${NS}><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="24" customWidth="1"/></cols><sheetData>` +
      '<row r="1"><c r="A1" s="1" t="s"><v>0</v></c><c r="B1" s="1" t="s"><v>1</v></c><c r="C1" s="1" t="s"><v>2</v></c><c r="E1" s="3"><v>0.2</v></c><c r="F1" s="4"><v>45351</v></c></row>' +
      '<row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" s="2"><v>800</v></c><c r="C2" s="2"><f t="shared" ref="C2:C4" si="0">B2*(1+Rate)</f><v>960</v></c></row>' +
      '<row r="3"><c r="A3" t="s"><v>4</v></c><c r="B3" s="2"><v>250.5</v></c><c r="C3" s="2"><f t="shared" si="0"/><v>300.6</v></c></row>' +
      '<row r="4"><c r="A4" s="5" t="inlineStr"><is><t>Fuel</t></is></c><c r="B4" s="2"><v>90</v></c><c r="C4" s="2"><f t="shared" si="0"/><v>108</v></c></row>' +
      '<row r="5"><c r="A5" t="str"><f>IF(SUM(B2:B4)&gt;1000,"over","under")</f><v>over</v></c><c r="B5" s="2"><f>SUM(B2:B4)</f><v>1140.5</v></c><c r="C5" s="2"><f>SUM(C2:C4)</f><v>1368.6</v></c><c r="D5" t="str"><f>_xlfn.XLOOKUP("Food",A2:A4,B2:B4)</f><v>#N/A</v></c><c r="G5" t="b"><v>1</v></c><c r="H5" t="e"><v>#DIV/0!</v></c></row>' +
      '</sheetData><mergeCells count="1"><mergeCell ref="G1:H1"/></mergeCells><drawing r:id="rId1"/></worksheet>',
    'xl/worksheets/sheet2.xml': X + `<worksheet ${NS}><sheetData><row r="1"><c r="A1" t="s"><v>5</v></c></row></sheetData></worksheet>`,
    'xl/worksheets/_rels/sheet1.xml.rels': X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>',
    'xl/drawings/drawing1.xml': X + '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"/>',
    'xl/charts/chart1.xml': X + '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"/>',
  });
}
