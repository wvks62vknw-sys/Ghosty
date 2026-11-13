// THE FULL EDITORS, THE THIRD: SPREADSHEETS (BRIEF-EDITOR-SPREADSHEETS; OWNER-ISSUES 127, 164, 176, 178). The app's own formula engine and its
// own .xlsx reader and writer, the phone's modules apps/web/src/sheets/*, run here in node. Run from router.test.mjs (package.json is protected,
// so no new file in the test list): the modules are bundled by esbuild below, as the list's own build step does for the others.
//  - the formula engine against 120 and more written Excel results (each function the brief names, the operators, their precedence, references,
//    ranges, whole columns, named ranges, errors, a circular reference, a cross-sheet reference, dates as serials, percent and currency as text);
//    the spilled arrays (UNIQUE, SORT, FILTER); the recalculation of only what changed;
//  - the .xlsx writer and reader: the budget workbook round trip (values, formulas, formats, widths, the frozen row, hidden rows, names) and
//    a file Excel would write, made by hand (tests/xlsxfixture.mjs), read with what it could not keep said once;
//  - CSV in and out; the model's undo and redo; sorting, filtering and the fill of a series.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { foreignXlsx } from '../../../tests/xlsxfixture.mjs';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
mkdirSync(here('./.build/sheets'), { recursive: true });
buildSync({ entryPoints: [here('../../web/src/sheets/kernel.ts')], bundle: true, format: 'esm', platform: 'neutral', outfile: here('./.build/sheets/kernel.mjs'), logLevel: 'warning' });
const K = await import(pathToFileURL(here('./.build/sheets/kernel.mjs')).href);
const { newBook, setEntry, Engine, History, readXlsx, writeXlsx, toCsv, fromCsv, budget } = K;

/** A workbook whose Sheet1 holds these entries (what he would type) and the formula in Z1; the value Excel gives is the second argument. */
function calc(formula, cells = {}, extra = {}) {
  let b = newBook('t');
  for (const [a, t] of Object.entries(cells)) b = setEntry(b, 'Sheet1', a, t);
  for (const [name, sheet] of Object.entries(extra)) {
    b = K.addSheet(b, name);
    for (const [a, t] of Object.entries(sheet)) b = setEntry(b, name, a, t);
  }
  b = setEntry(b, 'Sheet1', 'Z1', formula);
  const e = new Engine(b);
  return { e, v: e.value('Sheet1', 'Z1') };
}
function same(v, want, what) {
  if (typeof want === 'number') assert.ok(typeof v === 'number' && Math.abs(v - want) <= 1e-9 * Math.max(1, Math.abs(want)), `${what}: ${JSON.stringify(v)} is not ${want}`);
  else assert.deepEqual(v, want, `${what}: ${JSON.stringify(v)} is not ${JSON.stringify(want)}`);
}
const E = (e) => ({ e });
// the fixture the aggregates read: A1:A5 10..50, B1:B5 words, C1:C5 1..5, a lookup table at D1:F4, a row table at H1:K2
const FIX = { A1: '10', A2: '20', A3: '30', A4: '40', A5: '50', B1: 'apple', B2: 'banana', B3: 'apple', B4: 'cherry', B5: 'Apple', C1: '1', C2: '2', C3: '3', C4: '4', C5: '5',
  D1: 'a', E1: '1', F1: 'x', D2: 'b', E2: '2', F2: 'y', D3: 'c', E3: '3', F3: 'z', D4: 'd', E4: '4', F4: 'w', H1: 'p', I1: 'q', J1: 'r', K1: 's', H2: '5', I2: '6', J2: '7', K2: '8' };

// [formula, Excel's result]. Every result below is what Excel itself gives (its documentation's examples where it has one).
const CASES = [
  // operators and their order
  ['=1+2*3', 7], ['=(1+2)*3', 9], ['=2^3^2', 64], ['=-2^2', 4], ['=10/4', 2.5], ['=7-10', -3], ['=50%', 0.5], ['=200*10%', 20],
  ['="a"&"b"', 'ab'], ['="n"&1+2', 'n3'], ['=1&2', '12'], ['=1=1', true], ['="a"="A"', true], ['=2<>3', true], ['=1<"a"', true], ['=TRUE+1', 2],
  ['="3"+4', 7], ['=1/0', E('#DIV/0!')], ['="a"+1', E('#VALUE!')], ['=5>=5', true], ['=--"4"', 4], ['=2^-1', 0.5], ['=1E3+1', 1001], ['=0.1+0.2=0.3', true],
  // references, ranges, whole columns
  ['=SUM(A1:A5)', 150], ['=A1+A5', 60], ['=SUM(A1,A2,5)', 35], ['=SUM($A$1:$A$3)', 60], ['=AVERAGE(A1:A5)', 30], ['=MIN(A1:A5)', 10], ['=MAX(A1:A5)', 50],
  ['=COUNT(A1:A5)', 5], ['=COUNT(B1:B5)', 0], ['=COUNTA(B1:B5)', 5], ['=SUM(A1:A5,B1:B5)', 150], ['=SUM(A:A)', 150], ['=A7', 0], ['=A7&"x"', 'x'], ['=ISBLANK(A7)', true],
  ['=MAX(A1:A5,100)', 100], ['=COUNT(1,"2",TRUE,"x")', 3], ['=AVERAGE(B1:B5)', E('#DIV/0!')],
  // logic
  ['=IF(A1>5,"big","small")', 'big'], ['=IF(A1>50,"big")', false], ['=IFS(A1>100,"a",A1>5,"b")', 'b'], ['=IFS(A1>100,"a")', E('#N/A')], ['=IFERROR(1/0,"oops")', 'oops'],
  ['=IFERROR(A1,"x")', 10], ['=AND(A1>5,A2>5)', true], ['=OR(A1>100,A2>100)', false], ['=NOT(A1>5)', false], ['=AND(TRUE,0)', false], ['=IF(1,"y","n")', 'y'], ['=OR(1,0)', true],
  // conditional aggregates
  ['=COUNTIF(B1:B5,"apple")', 3], ['=COUNTIF(A1:A5,">25")', 3], ['=COUNTIF(A1:A5,"<=20")', 2], ['=COUNTIF(B1:B5,"<>apple")', 2], ['=COUNTIF(B1:B5,"a*")', 3], ['=COUNTIF(A1:A5,30)', 1],
  ['=COUNTIF(B1:B5,"?anana")', 1], ['=SUMIF(A1:A5,">=30")', 120], ['=SUMIF(B1:B5,"apple",A1:A5)', 90], ['=SUMIFS(A1:A5,B1:B5,"apple",C1:C5,">1")', 80],
  ['=COUNTIFS(B1:B5,"apple",A1:A5,">=30")', 2], ['=AVERAGEIF(B1:B5,"apple",A1:A5)', 30],
  // rounding and maths
  ['=ROUND(2.5,0)', 3], ['=ROUND(-2.5,0)', -3], ['=ROUND(1234.5678,2)', 1234.57], ['=ROUND(1234.5678,-2)', 1200], ['=ROUNDUP(3.14159,2)', 3.15], ['=ROUNDDOWN(-3.19,1)', -3.1],
  ['=INT(-1.5)', -2], ['=INT(8.9)', 8], ['=MOD(10,3)', 1], ['=MOD(-3,2)', 1], ['=ABS(-7.5)', 7.5], ['=SQRT(16)', 4], ['=SQRT(-1)', E('#NUM!')], ['=POWER(2,10)', 1024],
  ['=MOD(5,0)', E('#DIV/0!')], ['=ROUND(0.285,2)', 0.29], ['=ROUND(1.005,2)', 1.01], ['=ROUND(2.675,2)', 2.68],
  // lookups
  ['=VLOOKUP("c",D1:F4,2,FALSE)', 3], ['=VLOOKUP("c",D1:F4,3,FALSE)', 'z'], ['=VLOOKUP("e",D1:F4,2,FALSE)', E('#N/A')], ['=VLOOKUP("bb",D1:F4,2,TRUE)', 2], ['=VLOOKUP("B",D1:F4,2,FALSE)', 2],
  ['=VLOOKUP("c",D1:F4,9,FALSE)', E('#REF!')], ['=HLOOKUP("r",H1:K2,2,FALSE)', 7], ['=XLOOKUP("d",D1:D4,F1:F4)', 'w'], ['=XLOOKUP("q",D1:D4,F1:F4,"none")', 'none'],
  ['=XLOOKUP(2.5,E1:E4,D1:D4,"none",-1)', 'b'], ['=XLOOKUP(2.5,E1:E4,D1:D4,"none",1)', 'c'], ['=INDEX(D1:F4,3,2)', 3], ['=INDEX(E1:E4,4)', 4], ['=MATCH("c",D1:D4,0)', 3],
  ['=MATCH(2.5,E1:E4,1)', 2], ['=MATCH("z",D1:D4,0)', E('#N/A')],
  // dates are serials
  ['=DATE(2024,2,29)', 45351], ['=DATE(2000,1,1)', 36526], ['=YEAR(DATE(2024,3,5))', 2024], ['=MONTH(DATE(2024,3,5))', 3], ['=DAY(DATE(2024,3,5))', 5], ['=DATE(2024,14,1)', 45689],
  ['=DATE(2024,3,0)', 45351], ['=EOMONTH(DATE(2024,1,31),1)', 45351], ['=EOMONTH(DATE(2024,1,15),0)', 45322], ['=DATEDIF(DATE(2020,1,15),DATE(2024,3,10),"Y")', 4],
  ['=DATEDIF(DATE(2020,1,15),DATE(2024,3,10),"M")', 49], ['=DATEDIF(DATE(2020,1,15),DATE(2024,3,10),"D")', 1516], ['=DATEDIF(DATE(2020,1,15),DATE(2024,3,10),"YM")', 1],
  ['=NETWORKDAYS(DATE(2024,1,1),DATE(2024,1,31))', 23], ['=NETWORKDAYS(DATE(2024,1,1),DATE(2024,1,31),DATE(2024,1,15))', 22], ['=DATE(1900,3,1)', 61], ['=TODAY()-TODAY()', 0], ['=INT(NOW())=TODAY()', true],
  // text
  ['=LEN("hello")', 5], ['=LEFT("spreadsheet",6)', 'spread'], ['=LEFT("abc")', 'a'], ['=RIGHT("spreadsheet",5)', 'sheet'], ['=MID("spreadsheet",7,5)', 'sheet'], ['=TRIM("  a   b  ")', 'a b'],
  ['=UPPER("abc")', 'ABC'], ['=LOWER("ABC")', 'abc'], ['=PROPER("hello wORLD")', 'Hello World'], ['=CONCAT("a","b","c")', 'abc'], ['=CONCAT(B1:B2)', 'applebanana'],
  ['=TEXTJOIN(", ",TRUE,B1:B3)', 'apple, banana, apple'], ['=TEXTJOIN("-",TRUE,"a","","b")', 'a-b'], ['=SUBSTITUTE("a-b-c","-","+")', 'a+b+c'], ['=SUBSTITUTE("a-b-c","-","+",2)', 'a-b+c'],
  ['=FIND("e","Excel")', 4], ['=FIND("z","Excel")', E('#VALUE!')], ['=VALUE("1,234.5")', 1234.5], ['=VALUE("12%")', 0.12], ['=VALUE("abc")', E('#VALUE!')], ['=LEN(12345)', 5],
  ['=TEXT(1234.567,"#,##0.00")', '1,234.57'], ['=TEXT(0.256,"0.0%")', '25.6%'], ['=TEXT(1234.5,"£#,##0.00")', '£1,234.50'], ['=TEXT(DATE(2024,3,5),"dd/mm/yyyy")', '05/03/2024'],
  ['=TEXT(DATE(2024,3,5),"d mmm yyyy")', '5 Mar 2024'], ['=TEXT(DATE(2024,3,5),"dddd")', 'Tuesday'], ['=TEXT(5,"000")', '005'], ['=TEXT(-1.5,"0.0")', '-1.5'],
  // money
  ['=ROUND(PMT(0.08/12,10,10000),2)', -1037.03], ['=ROUND(FV(0.06/12,10,-200,-500,1),2)', 2581.4], ['=ROUND(PV(0.08/12,240,500,0,0),2)', -59777.15], ['=ROUND(NPV(0.1,-10000,3000,4200,6800),2)', 1188.44],
  ['=PMT(0,10,1000)', -100], ['=ROUND(PMT(0.05/12,360,200000),2)', -1073.64],
  // statistics and arrays
  ['=MEDIAN(A1:A5)', 30], ['=MEDIAN(1,2,3,4)', 2.5], ['=LARGE(A1:A5,2)', 40], ['=SMALL(A1:A5,2)', 20], ['=RANK(40,A1:A5)', 2], ['=RANK(40,A1:A5,1)', 4], ['=ROUND(STDEV(2,4,4,4,5,5,7,9),4)', 2.1381],
  ['=SUMPRODUCT(A1:A3,C1:C3)', 140], ['=SUMPRODUCT((A1:A5>25)*(C1:C5))', 12],
  // the errors, as Excel spells them
  ['=NOSUCH(1)', E('#NAME?')], ['=nothinghere', E('#NAME?')], ['=Sheet9!A1', E('#REF!')], ['=#N/A', E('#N/A')], ['=IFERROR(NOSUCH(1),7)', 7], ['=ISNUMBER(A1)', true], ['=ISTEXT(B1)', true],
];

test('[sheets] the formula engine gives Excel’s own result for every one of at least 120 written cases', () => {
  assert.ok(CASES.length >= 120, `only ${CASES.length} cases`);
  const wrong = [];
  for (const [f, want] of CASES) {
    try {
      same(calc(f, FIX).v, want, f);
    } catch (e) {
      wrong.push(e.message);
    }
  }
  console.log(`sheets: ${CASES.length} formula results written against Excel's own; ${CASES.length - wrong.length} equal`);
  assert.deepEqual(wrong, []);
});

test('[sheets] names, other sheets, spilled arrays and the one-cell results', () => {
  const sheets = { Two: { A1: '5', B1: '7' }, 'My Sheet': { A1: '9' } };
  for (const [f, want] of [['=Two!A1*2', 10], ["='Two'!A1+Two!B1", 12], ["='My Sheet'!A1", 9], ['=SUM(Two!A1:B1)', 12], ['=Rent*2', 20]]) {
    let b = newBook('t');
    b = setEntry(b, 'Sheet1', 'A1', '10');
    for (const [name, sh] of Object.entries(sheets)) {
      b = K.addSheet(b, name);
      for (const [a, t] of Object.entries(sh)) b = setEntry(b, name, a, t);
    }
    b = K.setName(b, 'Rent', 'Sheet1!A1');
    b = setEntry(b, 'Sheet1', 'Z1', f);
    same(new Engine(b).value('Sheet1', 'Z1'), want, f);
  }
  const col = (e, from, n) => Array.from({ length: n }, (_, i) => e.value('Sheet1', `${from}${i + 1}`));
  let r = calc('=UNIQUE(B1:B5)', FIX);
  r.e.value('Sheet1', 'Z1');
  assert.deepEqual(col(r.e, 'Z', 4), ['apple', 'banana', 'cherry', null], 'UNIQUE spills down, case ignored, and stops');
  r = calc('=SORT(A1:A5,1,-1)', FIX);
  assert.deepEqual(col(r.e, 'Z', 5), [50, 40, 30, 20, 10], 'SORT spills');
  r = calc('=FILTER(A1:A5,A1:A5>25)', FIX);
  assert.deepEqual(col(r.e, 'Z', 3), [30, 40, 50], 'FILTER spills');
  same(calc('=FILTER(A1:A5,A1:A5>99,"none")', FIX).v, 'none', 'FILTER with nothing');
  same(calc('=FILTER(A1:A5,A1:A5>99)', FIX).v, E('#CALC!'), 'FILTER with nothing and no words');
  let d = newBook('t');
  for (const [a, t] of Object.entries({ A1: '3', A2: '1', A3: '2', Y1: '=SORT(A1:A3)', Y5: '=SUM(Y1:Y3)' })) d = setEntry(d, 'Sheet1', a, t);
  same(new Engine(d).value('Sheet1', 'Y5'), 6, 'a sum over cells a spill fills');
});

test('[sheets] a circular reference is said in his words, and breaking it settles the numbers', () => {
  let b = newBook('t');
  b = setEntry(b, 'Sheet1', 'A1', '=A2');
  b = setEntry(b, 'Sheet1', 'A2', '=A1');
  b = setEntry(b, 'Sheet1', 'B1', '=A1+1');
  b = setEntry(b, 'Sheet1', 'C1', '=C1+1');
  const e = new Engine(b);
  for (const a of ['A1', 'A2', 'C1']) assert.deepEqual(e.value('Sheet1', a), E('#CIRCULAR!'), a);
  assert.deepEqual(e.value('Sheet1', 'B1'), E('#CIRCULAR!'), 'what leans on a loop is a loop');
  assert.match(Engine.explain('#CIRCULAR!'), /point/i);
  b = setEntry(b, 'Sheet1', 'A2', '5');
  e.update(b, ['Sheet1!A2']);
  assert.equal(e.value('Sheet1', 'A1'), 5);
  assert.equal(e.value('Sheet1', 'B1'), 6);
  for (const code of ['#DIV/0!', '#REF!', '#NAME?', '#VALUE!', '#N/A', '#NUM!', '#CALC!', '#CIRCULAR!']) assert.ok(Engine.explain(code).length > 20 && !/\n/.test(Engine.explain(code)), `${code} has his one line`);
});

test('[sheets] only what changed is recalculated, and what leans on it', () => {
  let b = newBook('t');
  b = setEntry(b, 'Sheet1', 'A1', '1');
  b = setEntry(b, 'Sheet1', 'A2', '2');
  b = setEntry(b, 'Sheet1', 'B1', '=A1*2');
  b = setEntry(b, 'Sheet1', 'C1', '=B1+1');
  b = setEntry(b, 'Sheet1', 'D1', '=SUM(A1:A2)');
  b = setEntry(b, 'Sheet1', 'E1', '=A2*10');
  const e = new Engine(b);
  e.value('Sheet1', 'C1');
  b = setEntry(b, 'Sheet1', 'A1', '5');
  const n = e.update(b, ['Sheet1!A1']);
  assert.equal(e.value('Sheet1', 'C1'), 11);
  assert.equal(e.value('Sheet1', 'D1'), 7);
  assert.equal(e.value('Sheet1', 'E1'), 20);
  assert.equal(n, 3, 'B1, C1 and D1 were worked out again, E1 was not');
});

test('[sheets] typing: a number, a percent, a pound, a date, a word, a formula, a true', () => {
  const kinds = (t) => { const c = K.entry(t); return c && { v: c.v, f: c.f, n: c.x?.n }; };
  assert.deepEqual(kinds('12'), { v: 12, f: undefined, n: undefined });
  assert.deepEqual(kinds('12%'), { v: 0.12, f: undefined, n: 'percent' });
  assert.deepEqual(kinds('£1,250.50'), { v: 1250.5, f: undefined, n: 'currency' });
  assert.deepEqual(kinds('5/3/2024'), { v: 45356, f: undefined, n: 'date' });
  assert.deepEqual(kinds('hello'), { v: 'hello', f: undefined, n: undefined });
  assert.deepEqual(kinds('=1+1'), { v: undefined, f: '1+1', n: undefined });
  assert.deepEqual(kinds('true'), { v: true, f: undefined, n: undefined });
  assert.deepEqual(kinds("'123"), { v: '123', f: undefined, n: 'text' });
  assert.equal(K.entry(''), null);
  assert.equal(K.cellInput(K.entry('=A1+1')), '=A1+1');
  assert.equal(K.cellInput(K.entry('£5')), '£5.00');
});

test('[sheets] the shown number: £, %, dates, decimals, text, and the errors', () => {
  const b0 = setEntry(newBook('t'), 'Sheet1', 'A1', '1234.5');
  const show = (patch) => new Engine(K.setFormat(b0, 'Sheet1', 'A1:A1', patch)).text('Sheet1', 'A1');
  assert.equal(show({}), '1234.5');
  assert.equal(show({ n: 'currency' }), '£1,234.50');
  assert.equal(show({ n: 'percent' }), '123450.00%');
  assert.equal(show({ n: 'number', d: 0 }), '1,235');
  assert.equal(show({ n: 'number', d: 3 }), '1,234.500');
  assert.equal(show({ n: 'date' }), '18 May 1903');
  assert.equal(show({ n: 'text' }), '1234.5');
  const e = new Engine(setEntry(newBook('t'), 'Sheet1', 'A1', '=1/0'));
  assert.equal(e.text('Sheet1', 'A1'), '#DIV/0!');
  assert.equal(new Engine(setEntry(newBook('t'), 'Sheet1', 'A1', '=1/3')).text('Sheet1', 'A1'), '0.333333333');
  assert.equal(new Engine(setEntry(newBook('t'), 'Sheet1', 'A1', '=2^70')).text('Sheet1', 'A1'), '1.18059E+21');
});

test('[sheets] the model: undo and redo across every kind of change, sorting, filtering, filling', () => {
  let b = newBook('t');
  const h = new History(b);
  b = setEntry(b, 'Sheet1', 'A1', '3'); h.push(b);
  b = setEntry(b, 'Sheet1', 'A2', '1'); h.push(b);
  b = setEntry(b, 'Sheet1', 'A3', '2'); h.push(b);
  b = K.setFormat(b, 'Sheet1', 'A1:A3', { b: 1 }); h.push(b);
  b = K.addSheet(b, 'Two'); h.push(b);
  assert.equal(h.book.sheets.length, 2);
  assert.ok(h.undo() && h.book.sheets.length === 1, 'adding a sheet undone');
  assert.ok(h.undo() && !h.book.sheets[0].cells.A1.x?.b, 'a format undone');
  assert.ok(h.undo() && !h.book.sheets[0].cells.A3, 'a cell undone');
  assert.ok(h.redo() && h.book.sheets[0].cells.A3.v === 2, 'and redone');
  for (let i = 0; i < 80; i++) h.push(setEntry(h.book, 'Sheet1', 'B1', String(i)));
  let n = 0;
  while (h.canUndo) { h.undo(); n++; }
  assert.equal(n, 60, 'sixty deep');
  // sorting: the first row stays the header, a formula in a moved row keeps leaning on its own row
  let s = newBook('t');
  for (const [a, t] of Object.entries({ A1: 'n', B1: 'x2', A2: '30', B2: '=A2*2', A3: '10', B3: '=A3*2', A4: '20', B4: '=A4*2' })) s = setEntry(s, 'Sheet1', a, t);
  const up = K.sortRows(s, 'Sheet1', 'A', 'asc');
  const e = new Engine(up);
  assert.deepEqual(['A1', 'A2', 'A3', 'A4'].map((a) => e.value('Sheet1', a)), ['n', 10, 20, 30]);
  assert.deepEqual(['B2', 'B3', 'B4'].map((a) => e.value('Sheet1', a)), [20, 40, 60]);
  assert.equal(up.sheets[0].cells.B2.f, 'A2*2', 'the formula moved with its row and now leans on its new row');
  assert.deepEqual(['A2', 'A3', 'A4'].map((a) => new Engine(K.sortRows(s, 'Sheet1', 'A', 'desc')).value('Sheet1', a)), [30, 20, 10]);
  assert.deepEqual(K.visibleRows(s.sheets[0], { c: 0, op: 'over', v: '15' }), [1, 2, 4]);
  assert.deepEqual(K.visibleRows(s.sheets[0], { c: 0, op: 'under', v: '15' }), [1, 3]);
  assert.deepEqual(K.visibleRows(s.sheets[0], null), [1, 2, 3, 4]);
  // filling a series: 1, 2 → 3, 4, 5; a month; a formula slides its references; a word repeats
  let f = newBook('t');
  for (const [a, t] of Object.entries({ A1: '1', A2: '2', B1: 'Jan', C1: '=A1*2', D1: 'x' })) f = setEntry(f, 'Sheet1', a, t);
  f = K.fillRange(f, 'Sheet1', 'A1:A2', 'A5');
  f = K.fillRange(f, 'Sheet1', 'B1:B1', 'B4');
  f = K.fillRange(f, 'Sheet1', 'C1:C1', 'C3');
  f = K.fillRange(f, 'Sheet1', 'D1:D1', 'D3');
  const g = new Engine(f);
  assert.deepEqual(['A3', 'A4', 'A5'].map((a) => g.value('Sheet1', a)), [3, 4, 5]);
  assert.deepEqual(['B2', 'B3', 'B4'].map((a) => g.value('Sheet1', a)), ['Feb', 'Mar', 'Apr']);
  assert.equal(f.sheets[0].cells.C3.f, 'A3*2');
  assert.deepEqual(['D2', 'D3'].map((a) => g.value('Sheet1', a)), ['x', 'x']);
  assert.equal(K.shiftFormula('SUM($A1:B$2,Sheet2!C3)+D4', 2, 1), 'SUM($A3:C$2,Sheet2!D5)+E6');
  assert.equal(K.colName(0) + K.colName(25) + K.colName(26) + K.colName(51), 'AZAAAZ');
});

test('[sheets] the household budget: twelve months and a summary, and its .xlsx comes back with every number equal', () => {
  const t0 = Date.now();
  const b0 = budget(2026);
  assert.equal(b0.sheets.length, 13, 'a summary and twelve months');
  assert.deepEqual(b0.sheets.map((s) => s.name).slice(0, 3), ['Summary', 'January', 'February']);
  const e0 = new Engine(b0);
  const out = e0.value('March', 'H6');
  assert.ok(typeof out === 'number' && out > 1000, `March spends ${out}`);
  assert.equal(e0.value('March', 'B7'), e0.value('March', 'B6') - e0.value('March', 'H6'), 'a difference line');
  assert.equal(e0.value('Summary', 'C4'), out, 'the summary reaches into March');
  assert.equal(e0.value('Summary', 'G2'), e0.value('March', 'B7'), 'a VLOOKUP of the month’s name');
  let year = 0;
  for (const s of b0.sheets.slice(1)) year += e0.value(s.name, 'B6') - e0.value(s.name, 'H6');
  assert.ok(Math.abs(e0.value('Summary', 'D14') - year) < 1e-6, 'the year is the twelve differences');
  assert.equal(b0.charts.length, 1, 'a chart of the twelve months');
  // change March's rent: March, the summary and the year move together
  const was = e0.value('Summary', 'D14');
  const b1 = setEntry(b0, 'March', 'C2', '1950');
  e0.update(b1, ['March!C2']);
  assert.equal(e0.value('March', 'H6'), out + 1000);
  assert.equal(e0.value('Summary', 'C4'), out + 1000);
  assert.equal(e0.value('Summary', 'D14'), was - 1000);
  // the file
  const bytes = writeXlsx(b1);
  const { book: b2, lost } = readXlsx(bytes);
  const e2 = new Engine(b2);
  let cells = 0;
  for (const s of b1.sheets) {
    assert.ok(b2.sheets.some((x) => x.name === s.name), `${s.name} came back`);
    for (const a of Object.keys(s.cells)) {
      const was = e0.value(s.name, a);
      const now = e2.value(s.name, a);
      assert.deepEqual(typeof was === 'number' ? Math.round(was * 1e9) : was, typeof now === 'number' ? Math.round(now * 1e9) : now, `${s.name}!${a}`);
      assert.equal(b2.sheets.find((x) => x.name === s.name).cells[a].f, s.cells[a].f, `${s.name}!${a} stays a formula`);
      cells++;
    }
  }
  const s1 = b1.sheets.find((x) => x.name === 'March');
  const s2 = b2.sheets.find((x) => x.name === 'March');
  assert.equal(s2.frozen, true, 'the frozen row');
  assert.deepEqual(s2.widths, s1.widths, 'the column widths');
  assert.deepEqual(b2.sheets[0].cells.B2.x, b1.sheets[0].cells.B2.x, 'the format');
  assert.equal(s2.cells.A1.x?.b, 1, 'the bold header');
  assert.ok(lost.every((x) => !/format|formula/.test(x)), `kept: ${lost.join('; ')}`);
  assert.ok(Buffer.from(bytes).subarray(0, 2).toString() === 'PK');
  console.log(`sheets: the budget (13 sheets, ${cells} cells) built, worked out, written (${bytes.length} bytes) and read back equal in ${Date.now() - t0} ms`);
});

test('[sheets] the file as Excel writes it: .xlsx read with shared strings, a shared formula, names, formats; what is not kept is said once', () => {
  const { book, lost } = readXlsx(new Uint8Array(foreignXlsx()));
  assert.deepEqual(book.sheets.map((s) => s.name), ['Quarter', 'Notes']);
  const q = book.sheets[0];
  assert.equal(q.cells.A1.v, 'Item');
  assert.equal(q.cells.A1.x?.b, 1, 'bold');
  assert.equal(q.cells.A2.v, 'Rent and rates', 'a rich-text run joined');
  assert.equal(q.cells.B2.x?.n, 'currency');
  assert.equal(q.cells.C2.f, 'B2*(1+Rate)');
  assert.equal(q.cells.C3.f, 'B3*(1+Rate)', 'a shared formula slid down');
  assert.equal(q.cells.C4.f, 'B4*(1+Rate)');
  assert.equal(q.cells.E1.x?.n, 'percent');
  assert.equal(q.cells.F1.x?.n, 'date');
  assert.ok(q.cells.A4.x?.fill, 'a fill, nearest the house’s own');
  assert.equal(q.cells.A4.v, 'Fuel', 'an inline string');
  assert.equal(q.frozen, true);
  assert.ok(q.widths[0] >= 150, `column A is ${q.widths[0]} px`);
  assert.equal(book.names.Rate, 'Quarter!$E$1');
  const e = new Engine(book);
  assert.equal(e.value('Quarter', 'C2'), 960);
  assert.ok(Math.abs(e.value('Quarter', 'C3') - 300.6) < 1e-9);
  assert.equal(e.value('Quarter', 'A5'), 'over');
  assert.equal(e.value('Quarter', 'D5'), 250.5, '_xlfn.XLOOKUP is XLOOKUP, worked out here, not the file’s stale figure');
  assert.equal(e.value('Quarter', 'G5'), true);
  assert.deepEqual(e.value('Quarter', 'H5'), E('#DIV/0!'));
  assert.equal(e.value('Quarter', 'F1'), 45351);
  assert.equal(e.text('Quarter', 'F1'), '29 Feb 2024');
  assert.equal(e.text('Quarter', 'E1'), '20%');
  assert.equal(e.text('Quarter', 'B3'), '£250.50');
  const said = lost.join(' | ');
  assert.ok(/merged/i.test(said), `merged cells said: ${said}`);
  assert.ok(/chart|picture|drawing/i.test(said), `the chart said: ${said}`);
  assert.ok(/border/i.test(said), `borders said: ${said}`);
  assert.equal(new Set(lost).size, lost.length, 'each said once');
  // and written again, it carries no `_xlfn.` it should not and keeps the formula
  const again = readXlsx(writeXlsx(book)).book;
  assert.equal(again.sheets[0].cells.D5.f, 'XLOOKUP("Food",A2:A4,B2:B4)');
  assert.throws(() => readXlsx(new Uint8Array([1, 2, 3, 4])), /xlsx|zip|spreadsheet/i, 'a file that is not a spreadsheet is refused, in words');
});

test('[sheets] CSV out and in: numbers stay numbers, quotes and commas and lines survive, dates are dates', () => {
  let b = newBook('t');
  for (const [a, t] of Object.entries({ A1: 'name', B1: 'amount', C1: 'when', A2: 'Smith, J "Jo"', B2: '12.5', C2: '5/3/2024', A3: 'two\nlines', B3: '=B2*2', C3: 'true', A4: '£4' })) b = setEntry(b, 'Sheet1', a, t);
  const csv = toCsv(b, 'Sheet1');
  assert.equal(csv.split('\r\n')[0], 'name,amount,when');
  assert.match(csv, /"Smith, J ""Jo"""/);
  assert.match(csv, /2024-03-05/);
  const back = fromCsv(csv, 'back');
  const e = new Engine(back);
  assert.equal(e.value('Sheet1', 'A2'), 'Smith, J "Jo"');
  assert.equal(e.value('Sheet1', 'B2'), 12.5);
  assert.equal(e.value('Sheet1', 'B3'), 25);
  assert.equal(e.value('Sheet1', 'A3'), 'two\nlines');
  assert.equal(e.value('Sheet1', 'C2'), 45356);
  assert.equal(e.value('Sheet1', 'C3'), true);
  assert.equal(e.value('Sheet1', 'A4'), 4);
  const semi = fromCsv('a;b\n1,5;2\n3;4\n', 'semi');
  assert.equal(new Engine(semi).value('Sheet1', 'B3'), 4, 'a semicolon file is read as one');
  assert.equal(new Engine(fromCsv('', 'empty')).value('Sheet1', 'A1'), null);
});

// EDITORS lane review: a deleted line on another sheet leaves a bare #REF! that still reads (so the rest of the formula keeps moving),
// and an inserted line keeps a whole-column range whole instead of breaking it, as Excel does; a single cell pushed off the sheet is gone.
test('rows in and out: cross-sheet #REF! reads back, full-height ranges survive an insert', () => {
  const gone = K.moveLinesIn("='Sheet 2'!B3+A5", 'Sheet1', 'Sheet 2', 'r', 2, -1);
  assert.equal(gone, '=#REF!+A5');
  assert.ok(K.tokenize(gone).length > 0, 'the formula with its #REF! is read');
  assert.equal(K.moveLinesIn(gone, 'Sheet1', 'Sheet1', 'r', 0, 1), '=#REF!+A6', 'and A5 still follows a row put in above it');
  assert.equal(K.moveLinesIn('=SUM(A1:A10000)', 'Sheet1', 'Sheet1', 'r', 4, 1), '=SUM(A1:A10000)');
  assert.equal(K.moveLinesIn('=SUM(A3:A9)', 'Sheet1', 'Sheet1', 'r', 4, 1), '=SUM(A3:A10)');
  assert.equal(K.moveLinesIn('=A10000', 'Sheet1', 'Sheet1', 'r', 4, 1), '=#REF!');
});
