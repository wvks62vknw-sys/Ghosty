// THE EDITORS' PAPER TOOLS (NEXT ROUND: docs/build-plan/next/editors.md): documents, scanning and PDFs, each tool proved end to end on the
// phone with real waits, undo, a round trip where there is a file, and its states in his words; and the new screens in all seven looks at
// 440 × 956, The Scan at 390 × 844 and BODY 21 (every key 44 pt, nothing sideways, no words cut). The kit is tests/editorsharness.mjs.
//   BASE=http://localhost:8788 node tests/editorspaper.spec.mjs [outDir]      PARTS=scan limits it to those parts.
import { runParts } from './editorsharness.mjs';

await runParts('THE EDITORS’ PAPER TOOLS (scan to a document, PDF forms, mail merge, comments, sections)', ['editorspaper-scan.mjs', 'editorspaper-pdf.mjs', 'editorspaper-merge.mjs'],
  'THE EDITORS’ PAPER TOOLS ran clean: paper into documents and rows, in all seven looks at 440 and 390 and at BODY 21.');
