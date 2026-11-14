// THE EDITORS LANE, PAGES (2) (NEXT ROUND; docs/build-plan/next/editors.md): the rest of the pages builder's tools, split from editorspages so
// neither runs long on CI: forms that fill a database (editors.s1), mind maps (editors.s8) and comparing two versions (editors.u10). Each part
// is proved end to end on the phone with real waits, undo and a round trip where there is a file, its states in his words, and its screen
// measured in all seven looks at 440 × 956, The Scan at 390 × 844 and BODY 21. The kit is tests/editorsharness.mjs.
//   BASE=http://localhost:8788 node tests/editorspages2.spec.mjs [outDir]      PARTS=forms limits it to that part.
import { runParts } from './editorsharness.mjs';

await runParts('THE EDITORS LANE (pages 2)', ['editorspages-forms.mjs', 'editorspages-mind.mjs', 'editorspages-compare.mjs'],
  'THE EDITORS LANE (pages 2) ran clean: forms that fill a database, mind maps and comparing two versions, in all seven looks at 440 and 390.');
