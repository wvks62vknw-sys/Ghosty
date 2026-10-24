# SCHOOL part 2b: exams on the free GPU, school practice into the weekly training, weak spots, and the honest gap

Read BRIEF-W0.md (shared rules), HANDOFF.md "RAISING GHOSTY" (the owner's rules: exam papers are never trained on;
everything he practises feeds the weekly training; the report card compares the offline brain with the online
models on the same held-out tests; the GYM runs at his stage's difficulty), BRIEF-S2.md and BRIEF-TRAIN-FIX.md (what
the weekly training is and how it runs), BRIEF-SCHOOL-1.md (the school's state, papers, marking, routes), then the
code: `apps/edge/src/selftrain/{cycle,factory,remote,exam}.ts`, `training/kaggle/ghosty_weekly.py` (+ `build.mjs`,
its tests), `packages/shared/src/{selftrain,school}.ts`, `apps/edge/src/school/*`, and MAP.md's entries for them.

Another builder (part 2a) is adding question banks and the official papers in `school/banks.ts`, `school/official.ts`,
the SCHOOL tab and `school/routes.ts`; a third is restyling the whole interface. So work ONLY in:
`apps/edge/src/selftrain/*`, `training/kaggle/*` (assets.ts only via `node training/kaggle/build.mjs`),
`packages/shared/src/selftrain.ts`, `packages/shared/src/school.ts` (pure additions only), new files
`apps/edge/src/school/practice.ts` and `apps/edge/src/school/remote.ts`, `apps/edge/src/school/routes.ts` ONLY to add
the two routes below at the end of its handler (nothing else in that file), `apps/edge/test/{selftrain,school}.test.mjs`,
`training/kaggle/test_ghosty_weekly.py`, MAP.md. No interface files: the SCHOOL tab's button for this comes in a
later step; say in your report exactly what it must call. No protected files.

## Build

1. **Exams on the free GPU** (`school/remote.ts`, the notebook, `selftrain/cycle.ts`): a paper can be sat by the SAME
   weights on Kaggle instead of the phone, so a full paper takes minutes. The notebook gets a MODE (`exam`, no
   training): it loads the active model (stock, or the published commit the brain names), answers every item of the
   paper (`school_paper.jsonl` in the dataset: id, q, type, options, marks, passage; NEVER the answers), with the
   exam prompt SCHOOL part 1 uses on the phone, and posts the answers to the hook as a report `{ kind: 'school',
   paperId, model, answers: [{ id, given }] }` with the run's ticket. The brain marks them with `school/mark.ts` and
   stores the result with `where: 'kaggle'`, exactly like a phone-sat paper. Use a separate kernel slug (`ghosty-exam`)
   so it never collides with the weekly training; reuse the quota pre-flight (refuse below 2 hours left, pay-to-scale
   on) and the ticket; one exam run at a time; status in `GET /school` (`remote: { phase, note, paperId }`); routes
   `POST /school/sit-remote { stage, subject }` → starts it (a paper from part 1's generators or part 2a's banks when
   present, through the same function the phone route uses), and `GET /school/remote` → status. Honest notes
   ("Sitting GCSE maths on the free GPU · started 2 min ago · about 10 minutes").
2. **School practice feeds the weekly training** (`school/practice.ts`, `selftrain/factory.ts`, `packages/shared/src/selftrain.ts`,
   the notebook): a new record kind `school`: exact items carry `messages` (the question) and `answer` (the exact
   answer; the notebook samples attempts and keeps the ones the checker passes, as for `failure` records); written
   items carry `messages` ending with the stronger model's worked answer (as `distill`). The notebook accepts the kind
   in `record_problem`, the SFT/STaR loops and the replay mix. **Never a paper item**: practice is generated separately
   (below); every record is checked against the sat papers' questions with `tooClose`.
3. **Weak spots → practice** (`school/practice.ts`): from `weakSpots(results)` (the contract), for each weak topic
   of the current stage: ask a stronger model (background lane, bounded per tick, resumable) for practice items with
   worked solutions at that stage's level; exact answers kept only when a second call agrees (recompute numbers,
   re-answer multiple choice); written ones kept as distillation; stored under `school:practice:<stage>:<topic>`;
   handed to the week's data by the factory (bounded, e.g. ≤ 150 records a week), counted in the training status
   ("school practice: 96"). Also self-play: GYM problems at the stage's levels (`STAGES[].gym`) are what the factory
   picks for `gym` records while a stage is open, so the GYM's difficulty follows his schooling.
4. **The honest gap** (`school/remote.ts` or `practice.ts`): when a paper has been sat, the brain asks the strongest
   free online model the same items once (background lane, bounded, cached per paper; never the exam gate), marks
   them the same way, and stores `online: { raw, grade, model }` on the `PaperResult` (a pure, optional addition to
   the contract). `GET /school` returns the gap per subject ("offline 14/40 · online 36/40"), so the owner watches it
   close week by week. Nothing from the online answers is ever trained on.
5. **The weekly report card** (`selftrain/cycle.ts` status): the week's `TrainStatus.gathered` counts the school
   practice; the report's `trained` names it. No new exam area in the gate: school papers are the school's own
   measure, shown in SCHOOL, not in the gate (the owner's held-out rule stays absolute).

## Tests (each must FAIL on the old code)

`selftrain.test.mjs`: a `school` record validates (exact with answer; written with a worked answer) and a paper item's
text is refused by `tooClose`; the factory adds school practice within its weekly cap and picks GYM levels from the
stage; the exam-run state machine (push with the separate slug, quota refusal, the school report accepted by the hook
and marked, the result stored with `where: 'kaggle'`, one at a time). `school.test.mjs`: practice generation keeps
only checked items, resumes, never includes a sat paper's item; the online comparison is cached and bounded; the two
routes. `test_ghosty_weekly.py`: `record_problem` accepts the kind; exam mode answers a paper and posts the report
shape; nothing in exam mode trains or publishes. Then the full edge `npm test` once, `node training/kaggle/build.mjs --check`,
`python3 training/kaggle/test_ghosty_weekly.py`, `npx tsc --noEmit -p tsconfig.json`.

## How to run things here

Your own worktree (the orchestrator created it); `cd apps/edge && npm install --no-audit --no-fund` once; the Kaggle
SDK names from a venv under the scratchpad as BRIEF-TRAIN-FIX.md says; no credentials anywhere; never call Kaggle or
Hugging Face for real. The full edge suite takes ≈ 16 minutes on this shared 4-core machine: once, at the end.

## Finish

Commit on your worktree branch, often (do not push, do not merge). Final report: files changed; the exact call the
SCHOOL tab's button must make; tests and proof they fail on the old code; every check with its exact result;
anything not done and why.
