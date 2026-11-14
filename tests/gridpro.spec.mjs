// GRID PRO (APPS ROUND, docs/build-plan/apps/editors.md): SPREADSHEETS, PRO EDITION, proved end to end on the phone with real waits, undo and
// a round trip through .xlsx: the chart editor (nine kinds, title, key, axis words, colours, EDIT) and in-cell sparklines; input checks (a
// drop-down list, tick boxes, dates); cell formatting (borders, merge, wrap, more number formats, table styles); and the new screens in all
// seven looks at 440 × 956, The Scan at 390 × 844 and BODY 21. The kit is tests/editorsharness.mjs.
//   BASE=http://localhost:8788 node tests/gridpro.spec.mjs [outDir]      PARTS=gridpro-charts,gridpro-looks limits it to those parts.
import { runParts } from './editorsharness.mjs';

await runParts('GRID PRO (spreadsheets, pro edition)', ['gridpro-charts.mjs', 'gridpro-cells.mjs'],
  'GRID PRO ran clean: charts of every kind and sparklines through Excel, input checks, borders, merges and table styles.');
