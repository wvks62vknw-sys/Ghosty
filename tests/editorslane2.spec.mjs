// THE EDITORS LANE, the workspace, photo and video (FINAL ROUND; docs/build-plan/FINAL-EDITORS.md): measured against Notion, Lightroom and Snapseed,
// CapCut and iMovie; the new tools proved end to end with undo and a round trip, in all seven looks at 440 × 956, The Scan at 390 × 844 and BODY 21.
// Split from editorslane so neither runs long on CI. The kit is tests/editorsharness.mjs.
//   BASE=http://localhost:8788 node tests/editorslane2.spec.mjs [outDir]      PARTS=photo limits it to that part.
import { runParts } from './editorsharness.mjs';

await runParts('THE EDITORS LANE (the workspace, photo, video)', ['editorslane-workspace.mjs', 'editorslane-photo.mjs', 'editorslane-video.mjs'],
  'THE EDITORS LANE (2) ran clean: the workspace, photo and video, their new tools, in all seven looks at 440 and 390.');
