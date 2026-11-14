// THE EDITORS LANE, documents, spreadsheets and presentations (FINAL ROUND; docs/build-plan/FINAL-EDITORS.md): each measured against the best app
// of its kind (Pages and Word, Numbers and Excel, Keynote) and its new everyday tools proved end to end, with undo and a round trip, in all seven
// looks at 440 × 956, The Scan at 390 × 844 and BODY 21 (every key 44 pt, nothing sideways, no words cut). The kit is tests/editorsharness.mjs;
// the workspace, photo and video run in editorslane2, the next round's tools in editorsnext.
//   BASE=http://localhost:8788 node tests/editorslane.spec.mjs [outDir]      PARTS=docs,sheets limits it to those parts.
import { runParts } from './editorsharness.mjs';

await runParts('THE EDITORS LANE (documents, spreadsheets, presentations)', ['editorslane-docs.mjs', 'editorslane-sheets.mjs', 'editorslane-slides.mjs'],
  'THE EDITORS LANE ran clean: documents, spreadsheets and presentations, their new tools, in all seven looks at 440 and 390.');
