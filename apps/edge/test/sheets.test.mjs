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

test('[sheets] colour by rules: each kind marks the right cells, follows rows put in, and goes to .xlsx and back as Excel’s own', () => {
  let b = newBook('Rules');
  const put = (a, t) => (b = setEntry(b, 'Sheet1', a, t));
  [['A1', '5'], ['A2', '120'], ['A3', '60'], ['A4', '120'], ['A5', '30'], ['B1', 'paid'], ['B2', 'Unpaid'], ['B3', 'due'], ['C1', '1/1/2020'], ['C2', '31/12/2099'], ['C3', '=TODAY()']].forEach(([a, t]) => put(a, t));
  const today = K.londonToday(Date.UTC(2026, 10, 14, 0, 30));
  assert.equal(today, K.serialOf(2026, 11, 14), 'half past midnight in London is the 14th');
  assert.equal(K.londonToday(Date.UTC(2026, 6, 14, 23, 30)), K.serialOf(2026, 7, 15), 'in summer London is an hour on: 23:30 UTC is the next day');
  const rule = (o) => ({ id: K.ruleId(), ...o });
  const rules = [
    rule({ range: 'A1:A5', kind: 'over', a: 100, tone: 3 }),
    rule({ range: 'A1:A5', kind: 'under', a: 10, tone: 4 }),
    rule({ range: 'A1:A5', kind: 'between', a: 50, b: 70, tone: 2 }),
    rule({ range: 'B1:B3', kind: 'contains', a: 'paid', tone: 1 }),
    rule({ range: 'C1:C3', kind: 'overdue', tone: 4 }),
  ];
  for (const r of rules) assert.equal(K.ruleProblem(r), '', K.ruleWords(r));
  b = { ...b, sheets: b.sheets.map((s) => rules.reduce((x, r) => K.setRule(x, r), s)) };
  const marks = (bk, d = today) => {
    const en = new Engine(bk);
    return K.ruleMarks(bk.sheets[0], (a) => en.value('Sheet1', a), d);
  };
  // TODAY() in C3 is the machine's today; the rules are asked about the real today for that cell
  let m = marks(b, K.londonToday());
  assert.equal(m.get('C3'), undefined, 'today itself is not overdue');
  m = marks(b);
  assert.equal(m.get('A2').tone, 3, 'more than 100: green');
  assert.equal(m.get('A1').tone, 4, 'less than 10: red');
  assert.equal(m.get('A3').tone, 2, 'between 50 and 70: amber');
  assert.equal(m.get('A5'), undefined, '30 fits none');
  assert.equal(m.get('B1').tone, 1, 'contains paid');
  assert.equal(m.get('B2').tone, 1, 'Unpaid contains paid, in any capitals');
  assert.equal(m.get('B3'), undefined);
  assert.equal(m.get('C1').tone, 4, 'a date before today is overdue');
  assert.equal(m.get('C2'), undefined, 'a date to come is not');
  // the first rule that fits wins
  const first = K.setRule(b.sheets[0], rule({ range: 'A2', kind: 'equal', a: 120, tone: 5 }));
  assert.equal(marks({ ...b, sheets: [first] }).get('A2').tone, 3, 'an earlier rule keeps its colour');
  // top, bottom (ties at the edge come in), duplicates, bars, the scale
  const s2 = [rule({ range: 'A1:A5', kind: 'top', n: 1, tone: 3 }), rule({ range: 'A1:A5', kind: 'bottom', n: 2, tone: 4 }), rule({ range: 'A1:A5', kind: 'bars' }), rule({ range: 'A1:A5', kind: 'scale' })];
  const b2 = { ...b, sheets: [s2.reduce((x, r) => K.setRule(x, r), { ...b.sheets[0], rules: [] })] };
  m = marks(b2);
  assert.deepEqual(['A1', 'A2', 'A3', 'A4', 'A5'].map((a) => m.get(a).tone ?? null), [4, 3, null, 3, 4], 'top 1 (both 120s), bottom 2 (5 and 30)');
  assert.equal(m.get('A2').bar, 1);
  assert.ok(Math.abs(m.get('A3').bar - 0.5) < 1e-9, 'a bar from 0: 60 of 120 is half');
  assert.equal(m.get('A1').scale, 0, 'the lowest is red');
  assert.equal(m.get('A2').scale, 1, 'the highest is green');
  const dup = marks({ ...b, sheets: [K.setRule({ ...b.sheets[0], rules: [] }, rule({ range: 'A1:A5', kind: 'dupes', tone: 2 }))] });
  assert.deepEqual(['A1', 'A2', 'A4'].map((a) => dup.get(a)?.tone ?? null), [null, 2, 2], 'only the two 120s are duplicates');
  // a rule follows the numbers: change A5 to 200 and it is green
  assert.equal(marks(setEntry(b, 'Sheet1', 'A5', '200')).get('A5').tone, 3);
  // problems said in his words
  assert.match(K.ruleProblem({ id: 'x', range: 'A1:A5', kind: 'over' }), /number/);
  assert.match(K.ruleProblem({ id: 'x', range: 'A1:A5', kind: 'top', n: 0 }), /how many/i);
  assert.match(K.ruleProblem({ id: 'x', range: '', kind: 'dupes' }), /Choose the cells/);
  assert.equal(K.ruleWords(rules[0]), 'A1:A5: more than 100, green');
  // a row put in above moves the rule's cells; deleting every cell of a rule takes it away
  assert.equal(K.moveLines(b, 0, 'r', 0, 1).sheets[0].rules[0].range, 'A2:A6');
  assert.ok(!K.moveLines(b, 0, 'c', 1, -1).sheets[0].rules.some((r) => r.kind === 'contains'), 'the rule on column B goes with it');
  // .xlsx out and back: every kind, its colour and its numbers
  const all = [...rules, ...s2, rule({ range: 'A1:A5', kind: 'dupes', tone: 2 }), rule({ range: 'A1:A5', kind: 'equal', a: 60, tone: 1 })];
  const bytes = writeXlsx({ ...b, sheets: [{ ...b.sheets[0], rules: all }] });
  const back = readXlsx(bytes);
  const strip = (r) => JSON.stringify({ range: r.range, kind: r.kind, a: r.a, b: r.b, n: r.n, tone: r.tone });
  assert.deepEqual(back.book.sheets[0].rules.map(strip), all.map(strip), 'every rule comes back the same');
  assert.ok(!back.lost.some((x) => /colour rules|conditional/.test(x)), back.lost.join('; '));
  // Excel's kinds that have no rule here (a time period, a percent top 10) are said, once; the rest of the sheet's rules are kept
  buildSync({ entryPoints: [here('../../web/src/convert/zip.ts')], bundle: true, format: 'esm', platform: 'neutral', outfile: here('./.build/sheets/zip.mjs'), logLevel: 'warning' });
  return import(pathToFileURL(here('./.build/sheets/zip.mjs')).href).then((Z) => {
    const files = Z.unzipSync(bytes);
    const xml = new TextDecoder().decode(files.get('xl/worksheets/sheet1.xml'));
    const odd = '<conditionalFormatting sqref="B1:B3"><cfRule type="timePeriod" dxfId="0" priority="1" timePeriod="lastWeek"><formula>x</formula></cfRule></conditionalFormatting><conditionalFormatting sqref="A1:A5 C1:C3"><cfRule type="top10" dxfId="2" priority="2" rank="10" percent="1"/><cfRule type="duplicateValues" dxfId="1" priority="3"/></conditionalFormatting>';
    files.set('xl/worksheets/sheet1.xml', new TextEncoder().encode(xml.replace(/<conditionalFormatting.*<\/conditionalFormatting>/, odd)));
    const r = readXlsx(Z.zipStore([...files].map(([name, data]) => ({ name, data }))));
    assert.deepEqual(r.book.sheets[0].rules.map((x) => [x.range, x.kind, x.tone]), [['A1:A5', 'dupes', 2], ['C1:C3', 'dupes', 2]], 'two ranges in one sqref are two rules');
    assert.equal(r.lost.filter((x) => /some colour rules/.test(x)).length, 1, `said once: ${r.lost.join('; ')}`);
  });
});

test('[sheets] one-tap summaries: by month and by shop, sum, count and average as live formulas; a new shop or month makes the rows again', () => {
  let b = newBook('Spending');
  const rows = [['Date', 'Shop', 'Amount'], ['3/1/2026', 'Tesco', '£12.50'], ['20/1/2026', 'Aldi', '£8'], ['2/2/2026', 'Tesco', '£30'], ['14/2/2026', 'tesco', '£7.50'], ['1/3/2026', 'Boots', '£4']];
  rows.forEach((r, i) => r.forEach((t, c) => (b = setEntry(b, 'Sheet1', `${'ABC'[c]}${i + 1}`, t))));
  let e = new Engine(b);
  const value = (s, a) => e.value(s, a);
  const s = b.sheets[0];
  const t = K.tableOf(s, 'A1:C6');
  assert.deepEqual(t, { head: 0, c1: 0, c2: 2 });
  assert.deepEqual(K.tableOf(s, 'B3'), { head: 0, c1: 0, c2: 2 }, 'one cell: the sheet’s table');
  const heads = K.headersOf(s, t, value);
  assert.deepEqual(heads.map((x) => [x.name, x.dates, x.numbers]), [['Date', true, true], ['Shop', false, false], ['Amount', false, true]]);
  // by month, the total of Amount
  const r = K.addPivot(b, { src: 'Sheet1', ...t, by: 0, month: true, of: 2, how: 'sum' }, value);
  assert.equal(r.pivot.sheet, 'Summary');
  assert.equal(r.rows, 3);
  assert.equal(r.book.view.sheet, 1, 'the summary is chosen, after the table');
  e = new Engine(r.book);
  const at = (bk, a) => new Engine(bk).value('Summary', a);
  assert.deepEqual(['A2', 'A3', 'A4', 'A5'].map((a) => at(r.book, a)), ['Jan 2026', 'Feb 2026', 'Mar 2026', 'Total']);
  assert.deepEqual(['B2', 'B3', 'B4', 'B5'].map((a) => at(r.book, a)), [20.5, 37.5, 4, 62]);
  assert.match(r.book.sheets[1].cells.B2.f, /^SUMIFS\(Sheet1!\$C\$2:\$C\$6,Sheet1!\$A\$2:\$A\$6,">=\d+",Sheet1!\$A\$2:\$A\$6,"<\d+"\)$/, 'a real formula over the table');
  assert.equal(r.book.sheets[1].cells.B2.x?.n, 'currency', 'pounds stay pounds');
  assert.equal(K.pivotWords(r.book, r.pivot, value), 'Total of Amount by month');
  // the figures follow the table: Jan's Aldi changed to £18
  const b2 = setEntry(r.book, 'Sheet1', 'C3', '£18');
  assert.equal(at(b2, 'B2'), 30.5);
  assert.equal(K.refreshPivots(b2, (sh, a) => new Engine(b2).value(sh, a)), b2, 'nothing changed shape: the same book');
  // a new month added under the table: its row appears
  const b3 = setEntry(setEntry(setEntry(b2, 'Sheet1', 'A7', '9/4/2026'), 'Sheet1', 'B7', 'Aldi'), 'Sheet1', 'C7', '£10');
  const e3 = new Engine(b3);
  const f3 = K.refreshPivots(b3, (sh, a) => e3.value(sh, a));
  assert.notEqual(f3, b3);
  assert.deepEqual(['A5', 'B5', 'A6', 'B6'].map((a) => at(f3, a)), ['Apr 2026', 10, 'Total', 82]);
  // by shop (capitals told apart only by how they first appear), count and average
  const c = K.addPivot(b, { src: 'Sheet1', ...t, by: 1, month: false, of: null, how: 'count' }, value);
  assert.deepEqual(['A2', 'B2', 'A3', 'B3', 'A4', 'B4', 'A5', 'B5'].map((a) => at(c.book, a)), ['Tesco', 3, 'Aldi', 1, 'Boots', 1, 'Total', 5]);
  assert.equal(c.book.sheets[1].cells.B1.v, 'Count');
  const av = K.addPivot(c.book, { src: 'Sheet1', ...t, by: 1, month: false, of: 2, how: 'average' }, value);
  assert.equal(av.pivot.sheet, 'Summary 2', 'a second summary gets a name of its own');
  const ea = new Engine(av.book);
  assert.equal(ea.value('Summary 2', 'B2'), (12.5 + 30 + 7.5) / 3);
  assert.equal(ea.value('Summary 2', 'A5'), 'All');
  assert.equal(ea.value('Summary 2', 'B5'), 62 / 5);
  // the chart follows the summary's rows
  const ch = K.pivotChart(r.pivot, r.rows, 'Spending by month');
  assert.deepEqual([ch.sheet, ch.labels, ch.values], ['Summary', 'A2:A4', 'B2:B4']);
  const withChart = K.addChart(b3, ch);
  const e4 = new Engine(withChart);
  const f4 = K.refreshPivots(withChart, (sh, a) => e4.value(sh, a));
  assert.equal(f4.charts[0].values, 'B2:B5', 'a new month: the chart grows with it');
  // a deleted summary sheet lets its summary go; the file carries the summary as its formulas
  const gone = K.removeSheet(r.book, 'Summary');
  assert.deepEqual(K.refreshPivots(gone, value).pivots, []);
  const back = readXlsx(writeXlsx(r.book)).book;
  assert.equal(new Engine(back).value('Summary', 'B3'), 37.5, 'in Excel the summary is its formulas, and they work');
});

test('[sheets] your spending as a budget sheet: months by categories, totals as formulas, budgets and a chart; asked for in his words', async () => {
  const months = [
    { month: '2026-10', out: 300, in: 2000, categories: [{ c: 'groceries', spent: 200 }, { c: 'fuel', spent: 100 }] },
    { month: '2026-09', out: 150, in: 2000, categories: [{ c: 'groceries', spent: 120 }, { c: 'eating out', spent: 30 }] },
  ];
  const b = K.moneyBook(months, [{ category: 'groceries', monthly: 250, spent: 200 }], '2026-11-14');
  assert.deepEqual(b.sheets.map((s) => s.name), ['Spending', 'Budgets']);
  assert.equal(b.title, 'My spending, 2026-11-14');
  const e = new Engine(b);
  const row = (r) => ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((c) => e.value('Spending', `${c}${r}`));
  assert.deepEqual(row(1), ['Month', 'Groceries', 'Fuel', 'Eating out', 'Money out', 'Money in', 'Left over'], 'the biggest category first');
  assert.deepEqual(row(2), ['Sep 2026', 120, 0, 30, 150, 2000, 1850], 'oldest month first');
  assert.deepEqual(row(3), ['Oct 2026', 200, 100, 0, 300, 2000, 1700]);
  assert.deepEqual(row(4), ['Total', 320, 100, 30, 450, 4000, 3550]);
  assert.equal(e.value('Spending', 'E5'), 225, 'the average month');
  assert.equal(b.sheets[0].cells.E2.f, 'SUM(B2:D2)', 'a row’s total is a formula');
  assert.equal(e.text('Spending', 'B2'), '£120.00');
  assert.deepEqual(['A2', 'B2', 'C2', 'D2'].map((a) => e.value('Budgets', a)), ['Groceries', 250, 200, 50]);
  assert.deepEqual([b.charts[0].sheet, b.charts[0].labels, b.charts[0].values], ['Spending', 'A2:A3', 'E2:E3']);
  // change a figure in the copy: the totals follow (the copy is his to play with)
  const e2 = new Engine(setEntry(b, 'Spending', 'C2', '50'));
  assert.equal(e2.value('Spending', 'E2'), 200);
  assert.equal(e2.value('Spending', 'G4'), 3500);
  // nothing set: the budgets sheet says where to set them
  assert.match(String(K.moneyBook(months, [], '2026-11-14').sheets[1].cells.A2.v), /No budgets set yet/);
  // .xlsx out keeps it
  assert.equal(new Engine(readXlsx(writeXlsx(b)).book).value('Spending', 'G4'), 3550);
  // his words
  buildSync({ entryPoints: [here('../../web/src/sheets/asks.ts')], bundle: true, format: 'esm', platform: 'neutral', outfile: here('./.build/sheets/asks.mjs'), logLevel: 'warning' });
  const A = await import(pathToFileURL(here('./.build/sheets/asks.mjs')).href);
  for (const t of ['open my money as a spreadsheet', 'Make my spending a budget sheet', 'show my budgets as a spreadsheet', 'turn my money into a spreadsheet', 'my spending as a spreadsheet']) assert.deepEqual(A.sheetsAsked(t), { what: 'money' }, t);
  assert.deepEqual(A.sheetsAsked('my spreadsheets'), { what: 'list' });
  assert.equal(A.sheetsAsked('how much did I spend on fuel'), null);
});

test('[sheets] Σ over several columns: into an empty last row chosen, else the row under; never over what he typed', () => {
  let b = newBook('Sum');
  for (const [a, t] of [['B1', '10'], ['B2', '20'], ['C1', '1'], ['C2', '2'], ['B4', 'note'], ['C3', '=C1*0']]) b = setEntry(b, 'Sheet1', a, t);
  const e = new Engine(b);
  // B1:C3 chosen, row 3 not empty (C3 has a formula): the totals go under, in row 4, where B4 holds his note: refused, B4 named
  let r = K.autoSum(b, e, 0, { r1: 0, c1: 1, r2: 2, c2: 2 });
  assert.equal(r.blocked, 'B4');
  assert.equal(r.book, b, 'nothing written');
  // B1:B3 chosen with row 3 empty in B: Excel's way, the total goes in B3 and adds B1:B2
  r = K.autoSum(b, e, 0, { r1: 0, c1: 1, r2: 2, c2: 1 });
  assert.deepEqual(r.cells, ['B3']);
  assert.equal(r.book.sheets[0].cells.B3.f, 'SUM(B1:B2)');
  // a total already there is rewritten, not refused
  const again = K.autoSum(r.book, new Engine(r.book), 0, { r1: 0, c1: 1, r2: 1, c2: 1 });
  assert.equal(again.blocked, undefined);
  assert.deepEqual(again.cells, ['B3']);
});
