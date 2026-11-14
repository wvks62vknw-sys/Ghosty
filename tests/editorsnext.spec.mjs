// THE EDITORS IN THE NEXT ROUND (docs/build-plan/next/editors.md, docs/build-plan/NEXT-EDITORS.md): studio-grade tools in every editor, each part
// (every tests/editorsnext-*.mjs) proving its tool end to end, with undo, a round trip where there is a file, every state in his words, and the
// seven looks at 440 × 956, The Scan at 390 × 844 and BODY 21. The kit is tests/editorsharness.mjs.
//   BASE=http://localhost:8788 node tests/editorsnext.spec.mjs [outDir]      PARTS=scan limits it to that part.
import { readdirSync } from 'node:fs';
import { runParts } from './editorsharness.mjs';

const files = readdirSync(new URL('.', import.meta.url)).filter((f) => /^editorsnext-[a-z0-9]+\.mjs$/.test(f)).sort();
await runParts('THE EDITORS IN THE NEXT ROUND', files, `THE EDITORS IN THE NEXT ROUND ran clean: ${files.map((f) => f.slice(12, -4)).join(', ')}, in all seven looks at 440 and 390.`);
