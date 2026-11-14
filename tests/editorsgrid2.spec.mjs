// EDITORS GRID 2 (NEXT ROUND, docs/build-plan/next/editors.md): the talk on a TV with the phone as the presenter's view, his spending as a budget
// sheet, and every new spreadsheet and presentation screen of the round in all seven looks at 440 × 956, The Scan at 390 × 844 and BODY 21.
// Split from editorsgrid so neither runs long on CI. The kit is tests/editorsharness.mjs.
//   BASE=http://localhost:8788 node tests/editorsgrid2.spec.mjs [outDir]      PARTS=tv,money limits it to those parts.
import { runParts } from './editorsharness.mjs';

await runParts('EDITORS GRID 2 (the TV, the money sheet, the looks)', ['editorsgrid-tv.mjs', 'editorsgrid-money.mjs', 'editorsgrid-looks.mjs'],
  'EDITORS GRID 2 ran clean: the talk on a TV with the phone as the presenter’s view, the spending as a budget sheet, and the round’s new screens in all seven looks at 440 and 390.');
