// THE EDITORS LANE, PAGES (NEXT ROUND, editors.s6 and on; docs/build-plan/next/editors.md): the workspace's new tools and the editors' links to other
// rooms, each proved end to end on the phone with real waits, undo and a round trip where there is a file, its states in his words, and its screen
// measured in all seven looks at 440 × 956, The Scan at 390 × 844 and BODY 21. The kit is tests/editorsharness.mjs.
//   BASE=http://localhost:8788 node tests/editorspages.spec.mjs [outDir]      PARTS=voice limits it to that part.
import { runParts } from './editorsharness.mjs';

await runParts('THE EDITORS LANE (pages)', ['editorspages-voice.mjs'],
  'THE EDITORS LANE (pages) ran clean: voice notes into tidy pages, in all seven looks at 440 and 390.');
