// EDITORS GRID (NEXT ROUND, docs/build-plan/next/editors.md): spreadsheets and presentations, the round's new tools proved end to end on the
// phone with real waits, undo and a round trip through the file, and every new screen in all seven looks at 440 × 956, The Scan at 390 × 844
// and BODY 21 (every key 44 pt, nothing sideways, no words cut). The kit is tests/editorsharness.mjs.
//   BASE=http://localhost:8788 node tests/editorsgrid.spec.mjs [outDir]      PARTS=builds,looks limits it to those parts.
import { runParts } from './editorsharness.mjs';

await runParts('EDITORS GRID (spreadsheets and presentations)', ['editorsgrid-builds.mjs', 'editorsgrid-rules.mjs', 'editorsgrid-summary.mjs', 'editorsgrid-tv.mjs', 'editorsgrid-money.mjs', 'editorsgrid-looks.mjs'],
  'EDITORS GRID ran clean: builds and Magic Move through PowerPoint, colour by rules through Excel, one-tap summaries that follow their table, the talk on a TV with the phone as the presenter’s view, in all seven looks at 440 and 390.');
