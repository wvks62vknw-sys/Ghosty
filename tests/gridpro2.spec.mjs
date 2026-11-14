// GRID PRO 2 (APPS ROUND, docs/build-plan/apps/editors.md): PRESENTATIONS, PRO EDITION, proved end to end on the phone with real waits, undo
// and a round trip through .pptx: free-form slides (text boxes, pictures and shapes, dragged with snapping guides, ALIGN, DISTRIBUTE, GROUP,
// layers), the designer theme gallery and layout ideas; and the new screens in all seven looks at 440 × 956, The Scan at 390 × 844 and
// BODY 21. The kit is tests/editorsharness.mjs.
//   BASE=http://localhost:8788 node tests/gridpro2.spec.mjs [outDir]      PARTS=gridpro-free limits it to those parts.
import { runParts } from './editorsharness.mjs';

await runParts('GRID PRO 2 (presentations, pro edition)', ['gridpro-free.mjs', 'gridpro-looks.mjs'],
  'GRID PRO 2 ran clean: free-form slides with snapping, align, group and layers through PowerPoint.');
