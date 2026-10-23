# SCHOOL wiring: the free-GPU exam button, the gap on the tab, practice counts, OpenStax out of self-study

Small, well-defined step after SCHOOL parts 1, 2a, 2b and 3 (all merged). Read BRIEF-SCHOOL-2B.md's "What the SCHOOL
tab's button must call" (from its report: `POST /api/school/sit-remote { stage, subject }` → `{ remote }` or 409;
poll `GET /api/school/remote` until `remote.phase === 'idle'`, which also files finished results and returns
`gap` per subject), `apps/edge/src/school/{routes,remote,practice}.ts`, `apps/web/src/features/school/index.ts`,
`apps/edge/src/tools/extra.ts` (the two school tools), `apps/edge/src/library/study.ts` (`findSource`, the lock) and
MAP.md's entries. Work ONLY in those files, the tests `apps/edge/test/school.test.mjs`, `study.test.mjs`,
`tests/school.spec.mjs`, `apps/web/styles.css` inside the SCHOOL block, MAP.md. No protected files.

1. **GET /school carries the exam run and the gap**: in `routes.ts`'s `view()`, file any finished remote result
   (`fileRemote(d, (fn) => serial(d, fn))` as part 2b's report says) and add `remote: remoteView(...)` and the per-
   subject `gap` lines, so the tab needs no second call on open.
2. **SIT IT ON THE FREE GPU** on the SCHOOL tab: beside each subject's SIT, and on the stage's SIT THE EXAM row, a
   second button in plain words ("Sit on the free GPU · about 10 minutes, no phone time"), which posts
   `/school/sit-remote`; while a run is on, the row shows its honest note and polls `/school/remote` every 20 s; a 409
   shows the note of the run already going; the result appears like any other with "sat on the free GPU". Hidden
   when the Kaggle key is not saved (the training status says: `keys.kaggle`), with one line saying why.
3. **The gap and the practice**: each subject with a sat paper shows the gap line ("offline 14/40 · online 36/40")
   when there is one, and the WEAK SPOTS section shows what is being practised ("practising: 3 weak spots · 24 items
   checked this week", from the practice state the brain reports).
4. **The chat tools** (`tools/extra.ts`): `school_status` reports banks and official papers as sittable (no more
   "not written yet" for Key Stage 3 up when a bank exists) and the gap; `sit_exam` mentions the free-GPU way.
5. **OpenStax out of self-study** (`study.ts`): OpenStax's licence now forbids ingestion into AI models, so
   `findSource` returns null for the `openstax` kind with a plain reason recorded once ("OpenStax: licence allows
   reading, not ingestion; linked in LEARN"), those topics count as link-only (they never block a field from
   finishing and are not counted as failures), and the status line says how many were skipped for licence.

Tests (each must fail on the old code): `school.test.mjs`: GET /school shows `remote` and the gap after a finished run
is filed; `study.test.mjs`: openstax topics are skipped with the reason and a field with only openstax left finishes;
`tests/school.spec.mjs`: the free-GPU button posts and shows the note, the gap line shows, the button is hidden
without the Kaggle key. Checks: targeted tests, `npx tsc --noEmit -p tsconfig.json`, `npm run check`, the school
spec on port **8811**; the full edge `npm test` once at the end.

Commit on your worktree branch (do not push, do not merge). Final report: what changed per item, tests and proof,
every check's exact result, screenshots.
