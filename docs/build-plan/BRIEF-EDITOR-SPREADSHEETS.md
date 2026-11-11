# BRIEF: THE FULL EDITORS, THE THIRD: SPREADSHEETS — the core of Excel

BRIEF-EDITOR-SPREADSHEETS (PROGRAMME-EDITORS section 3; OWNER-ISSUES 127 "i want the full editors", 164, 176 "do all of it", 178 "insane
quality"; QUEUE-11-NOV item 7). The second editor, DOCUMENTS (BRIEF-EDITOR-DOCUMENTS, worktree editors), lands before this starts: this one
reuses its store shape, its MAKE room entry, its Stage OPEN hand-over and its export path, so the two editors feel like one house. One
builder, one PR. Read STANDARD.md, PROGRAMME-EDITORS.md (its rules for every workspace), BRIEF-EDITOR-DOCUMENTS.md (the shape to match), then
this. THE QUALITY RULE holds (every state designed, every word his, every wait said, every number honest, every control 44 pt, nothing merely
fine).

## His words
"no i don't agree with you, i want the full editors" (4 Nov). The product it stands in for is Excel's core: a budget, a list, a plan of
numbers with formulas that recalculate, formats, a sort and a filter, a chart from a range, several sheets, a file that opens unchanged in
Excel and Numbers, and someone else's .xlsx opened and changed here.

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Protected files, not edited: apps/edge/src/agent.ts, apps/edge/src/index.ts, apps/edge/src/tools/{index,types,repo}.ts, .github/* (except the
one spec word at the END of check.yml's `all=` list; the guard job untouched), apps/*/package.json. No package may be added, so the engine is
the app's own (below); a `spreadsheet` brain tool, if wanted, is NEEDS HIS WORD for a kernel pass and the AI parts are chat turns with the
selection as context (the prompt guard untouched).

## The engine (the app's own, no package)

- **The model (apps/web/src/sheets/model.ts):** a workbook of named sheets; a sheet of cells by address (A1 style, up to 26 × 2 columns and
  10,000 rows, sparse); a cell holds a value (number, text, boolean, date as a serial number the way Excel keeps it, an error) or a formula
  with its cached value; formats per cell (number, currency £ by default, percent, date, text; decimals; bold, italic, alignment, fill from the
  design system's own sequence, no new hex); column widths and row heights; frozen first row; a History for undo across every change.
- **The formula engine (sheets/formula.ts):** a tokeniser and parser for Excel's grammar (numbers, strings, booleans, references A1, $A$1,
  ranges A1:B9, sheet references Sheet2!A1, named ranges, operators + − * / ^ & = <> < > <= >=, unary minus, percent, parentheses, function
  calls with nested ranges); a dependency graph with recalculation of only what changed, cycle detection said as #CIRCULAR in his words; the
  functions a budget needs, each tested against Excel's own results written in the test: SUM AVERAGE MIN MAX COUNT COUNTA COUNTIF COUNTIFS SUMIF
  SUMIFS AVERAGEIF IF IFS IFERROR AND OR NOT ROUND ROUNDUP ROUNDDOWN INT MOD ABS SQRT POWER VLOOKUP HLOOKUP XLOOKUP INDEX MATCH TODAY NOW DATE
  YEAR MONTH DAY EOMONTH DATEDIF NETWORKDAYS TEXT LEN LEFT RIGHT MID TRIM UPPER LOWER PROPER CONCAT TEXTJOIN SUBSTITUTE FIND VALUE PMT FV PV
  NPV RANK LARGE SMALL MEDIAN STDEV SUMPRODUCT UNIQUE SORT FILTER; errors as Excel spells them (#DIV/0!, #REF!, #NAME?, #VALUE!, #N/A) with his
  own one-line explanation on tap.
- **The file (sheets/xlsx.ts, sheets/xlsxread.ts):** .xlsx written and read by the app's own code over convert/zip.ts (a .xlsx is a zip of
  XML: workbook, sheets, shared strings, styles), keeping values, formulas (as formulas, so Excel recalculates them too), number formats, bold,
  fill, column widths and the frozen row; a reader that opens someone else's .xlsx with the same kept (a feature it cannot keep is said once,
  never silently dropped); CSV in and out; PDF out through the page's print layout (the Documents editor's A4 path).
- **The chart:** from a selected range, through the app's own chart (show/chart.ts, as POLISH 2 left it), kept in the workbook and exported in
  the PDF; the .xlsx carries the data (a chart part is NOT written: said once in the export sheet as "the chart is in the PDF, the numbers are
  in the file").

## The screen

MAKE → SPREADSHEETS (a hub card beside DOCUMENTS; the catalogue entry; "my spreadsheets" in the chat; the Stage's OPEN on a table answer
(SHOW ME's table kind) opens it here as a new sheet). The grid: cells 44 pt tall at the phone's size, pinch to zoom, a column letter and a
row number always in view, the frozen row; tap selects, tap again edits in the formula line above the grid (never a tiny in-cell caret on the
phone); a formula line with the function names offered as he types (the first three, 44 pt keys), range selection by drag with a handle at
each end; drag the fill handle to extend a series; a cell's format from one sheet (FORMAT: number, £, %, date, text, decimals, bold, fill,
align); SORT and FILTER on a column's header; sheets as pills along the foot (ADD, rename by long press); UNDO / REDO; FIND; CHART from a
range; EXPORT (.xlsx, CSV, PDF) with the size said; IMPORT (.xlsx, CSV) through the library's share path and the Shortcuts' `?add=`. Autosave
said once ("Saved" fading in the truth style, 200 ms after the last change, the Documents store's rule); reopen where he was. Every state in
his voice: the empty workbook (one line and START WITH A BUDGET, which seeds the household budget below), a formula error, an import that kept
less than it read, offline (everything works; the export's share needs nothing). GLASS, THE SCAN, ONE INK and the HUDs each wear it.

## The benchmark (PROGRAMME-EDITORS 3; timed on the preview and said in the PR)

A household budget: twelve monthly sheets from one START WITH A BUDGET seed (income, rent, bills, food, travel, the rest; a totals row with
SUM; a difference line), a SUMMARY sheet with one line a month by cross-sheet references and a VLOOKUP of the month's name, a YEAR total, a
chart of the twelve months; exported to .xlsx and read back by the app's own reader with every number equal; opened in Excel and Numbers
unchanged (NEEDS HIS PHONE; the reader's round trip stands for it here).

## Tests (each fails on the code before this brief; run against it once and say so)

- apps/edge/test/sheets.test.mjs (new; imported from an existing test file as kernel-yes was, one import line, since the test list is
  protected; NEEDS HIS WORD names it): the formula engine against 120 written Excel results (each function above, the operators, precedence,
  references and ranges, errors, a circular reference, a cross-sheet reference, dates as serials, percent and currency formats as text); the
  .xlsx writer and reader round trip of the budget workbook (values, formulas, formats, widths, the frozen row); CSV in and out; the model's
  undo.
- tests/sheets.spec.mjs (new; `all=` word `sheets` at the END of the list in check.yml, nothing else in .github touched), at 440 and 390: (a)
  MAKE → SPREADSHEETS in two taps; "my spreadsheets" opens it; (b) the empty state's words and START WITH A BUDGET seeding twelve sheets and the
  summary; (c) a typed formula recalculates its dependants (change a bill, the month's total and the year move); (d) FORMAT £ and % and the cell
  shows it; (e) SORT and FILTER on a column; (f) CHART from a range draws the app's chart; (g) EXPORT .xlsx gives a file the app's reader reads
  back equal, and the size is said before; IMPORT of a fixture .xlsx keeps its formulas and says what it could not keep; (h) autosave said once
  and the workbook reopens where it was; (i) the Stage's OPEN on a table answer lands in a new sheet; (j) BODY 21 clips nothing, every control
  44 pt, nothing sideways.
- docs.spec (DOCUMENTS), showme.spec, speed2, look, ink, thescan unchanged unless a fix lives in a screen they own.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`. Preview on port 8821:
`(nohup setsid node tests/preview-server.mjs 8821 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8821.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call. Specs from the worktree ROOT: `BASE=http://localhost:8821 NO_GL_SHOTS=1 timeout 600 node tests/<name>.spec.mjs tests/.shots`;
a nogl copy as `tests/.<name>.nogl.tmp.mjs` is never committed. In the foreground, alone, one after another: sheets, docs, showme, speed2,
look, ink, thescan, hubcards, deck, nav, layout, talk. The brain tests in the background once at the end. A timing budget missed under load
is rerun alone before it is called red. Known sandbox reds not touched: direct, aim, radio, scroll, safari, eye's own screenshot, tabs2,
talk's cooling lines.

## The owner's phone check

1. MAKE, SPREADSHEETS: the empty page and START WITH A BUDGET: twelve months and a summary appear.
2. Change your rent in March: March's total and the year's total move at once.
3. Tap the bills column's header: SORT; FILTER to the ones over £50.
4. Select the summary's twelve totals: CHART: the year as a chart.
5. EXPORT .xlsx (the size said), open it in Numbers or Excel: the same numbers, the formulas still formulas.
6. Share someone's .xlsx to Ghosty: it opens here; what it could not keep is said once.
7. Ask "show me my spending as a table", OPEN on the Stage: it lands in a new sheet.

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/sheets-report.md: what was built, the 120 formula results
and any that differ from Excel's (said, not hidden), the benchmark's time, each spec's last line (before and after for the new ones),
found-not-fixed, NEEDS HIS WORD, the phone check as above, the commit list. One commit per step on builder/sheets; the orchestrator squashes
to one on landing.
