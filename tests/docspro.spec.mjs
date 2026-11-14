// DOCUMENTS, PRO EDITION (APPS ROUND: docs/build-plan/apps/editors.md): named styles he can redefine, his own tracked changes, the
// designed template gallery and folding a heading's section away, each proved end to end on the phone with real waits, UNDO, a Word
// round trip where there is a file, and its states in his words; and the new screens in all seven looks at 440 × 956, The Scan at
// 390 × 844 and BODY 21 (every key 44 pt, nothing sideways, no words cut). The kit is tests/editorsharness.mjs.
//   BASE=http://localhost:8788 node tests/docspro.spec.mjs [outDir]      PARTS=styles limits it to those parts.
import { runParts } from './editorsharness.mjs';

await runParts('DOCUMENTS, PRO EDITION (named styles, tracked changes, templates, folding, spelling and grammar)', ['docspro-styles.mjs', 'docspro-track.mjs', 'docspro-templates.mjs', 'docspro-fold.mjs', 'docspro-proof.mjs', 'docspro-looks.mjs'],
  'DOCUMENTS, PRO EDITION ran clean: styles, tracked changes, templates, folding and spelling, in all seven looks at 440 and 390 and at BODY 21.');
