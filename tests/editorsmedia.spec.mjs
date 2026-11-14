// THE EDITORS LANE, MEDIA (NEXT ROUND: photo and video, against Lightroom and Snapseed, CapCut and LumaFusion): each new tool proved end to
// end with real waits, undo and a round trip, its states in his words, then in all seven looks at 440 × 956, The Scan at 390 × 844 and at
// BODY 21 (every key 44 pt, nothing sideways, no words cut). The kit is tests/editorsharness.mjs; the shared photo and video helpers are
// tests/mediakit.mjs.
//   BASE=http://localhost:8788 node tests/editorsmedia.spec.mjs [outDir]      PARTS=approve limits it to those parts.
import { runParts } from './editorsharness.mjs';

await runParts('THE EDITORS LANE, MEDIA (photo and video)', ['editorsmedia-approve.mjs', 'editorsmedia-fades.mjs', 'editorsmedia-post.mjs', 'editorsmedia-film.mjs', 'editorsmedia-looks.mjs'],
  'THE EDITORS LANE, MEDIA ran clean: the new photo and video tools, in all seven looks at 440 and 390.');
