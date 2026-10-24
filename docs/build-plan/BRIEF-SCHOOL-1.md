# SCHOOL part 1: the ladder, the locks, the first papers, and the SCHOOL screen

Read BRIEF-W0.md first (shared rules; the target phone is the **iPhone 18 Pro Max, 440 × 956 points**), then
HANDOFF.md's section "RAISING GHOSTY" (the owner's decisions: these are the rules), then
`packages/shared/src/school.ts` (the contract both halves share: stages, subjects, papers, bands, exact marking,
`scorePaper`, `weakSpots`; extend it with pure helpers if you must, never change what is there), then MAP.md's entries
for the offline brain, THINK HARDER / REPORT CARD (`offline/bench.ts`, `offline/harder.ts`, `offline/lock.ts`), the
weekly training (`selftrain/*`), notifications (`push.ts`, `notifyprefs.ts`) and "new tab".

The idea in one line: the offline brain (the model on the owner's phone) goes to school. Only nursery is open; he
sits that stage's papers; top grades in every subject unlock the next stage; a placement test lets him skip ahead
if he already knows it; the SCHOOL screen is his report card. Papers are held out from training for good.

## Work ONLY in

- New: `apps/edge/src/school/` (`state.ts`, `papers.ts`, `mark.ts`, `routes.ts`, `index.ts`), `apps/edge/test/school.test.mjs`,
  `apps/web/src/features/school/index.ts` (the tab), `apps/web/src/school/sit.ts` (sitting a paper on the phone),
  `tests/school.spec.mjs`.
- Existing: `apps/web/src/features/index.ts` (add the tab to `TABS`), `apps/edge/src/tools/extra.ts` (two tools),
  MAP.md (entries), `apps/web/styles.css` only inside one marked `/* SCHOOL */` block.
- Protected files (MAP.md "Protected kernel") get at most these minimal, clearly marked `// [school]` edits, each
  listed in your report: `apps/edge/src/agent.ts`: one line routing `/school` and `/school/*` to your `schoolRoute`
  (mirror the `[selftrain]` line for `/training`, line ~356), and one line in the daily job path that calls your
  `schoolDaily` (the nightly school report, below). Do NOT edit `apps/edge/package.json` or `.github/*`: instead end
  your report with the exact `esbuild` line and test-file name to add to the `test` script, and the spec name to add
  to the CI loop; the orchestrator applies them.
- Other builders are working on the GYM, the Library tab and `library/study.ts`: stay out of those.

## Build

1. **State** (`school/state.ts`): `SchoolState { stage: StageId; passed: Partial<Record<StageId, { at: number; grades: Record<string, string> }>>; results: PaperResult[] (newest first, keep ≤ 60); nightly: boolean }`,
   kept in Durable Object storage under `school:state` and mirrored with `durablePut` (apps/edge/src/kv.ts) so it
   survives the database pause, like projects. Starts at `nursery`. Papers he has sat are kept under
   `school:paper:<id>` with their answers (never in the library, so study and training never see them).
2. **Papers** (`school/papers.ts`): `makePaper(stage, subject, seed): Paper` for **nursery, reception, ks1 and ks2**,
   every subject in `STAGES`, deterministic per seed, 10–20 items each (nursery 8–12), in the style of the real thing:
   - exact / number / mcq items wherever the answer is exact (counting, letters and sounds, number bonds, times
     tables, fractions, arithmetic in the SATs arithmetic style, word classes, punctuation, spelling as "which spelling
     is right" multiple choice from the national-curriculum word lists for Years 1–6, which are Crown copyright under
     the Open Government Licence; science facts as multiple choice);
   - reading: a short passage (public-domain texts bundled in the file: Aesop, nursery rhymes, a few paragraphs of
     Victorian children's classics; three or four per stage) followed by exact and short questions;
   - writing: one `extended` item with a plain mark scheme (`rubric`: capital letters and full stops, makes sense,
     answers the task, the stage's expectations), model-marked.
   Each item carries a `topic` (e.g. "number bonds to 10", "apostrophes", "inference") for weak spots. Seeds at or
   above `1_000_000` are papers; `bands` from `bandsFor(stage, maxMarks)`. Put an honest `title`
   ("Reception maths · written by Ghosty in the early-years style"); `official: false`. Part 2 adds the official
   SATs, GCSE and A-level papers and the Kaggle route; design `Paper` storage so a paper may come from either.
3. **Marking** (`school/mark.ts`): exact/number/mcq by `markExact`; short/extended by a stronger model through the
   router's background lane (the cheap models, never waiting; see how `library/study.ts` or `selftrain/cycle.ts`
   asks for a model) with the rubric, the model answer and the pupil's answer → marks (0..max, integer) and a one-line
   reason. No model free → `how: 'pending'`, and a retry later (`schoolDaily` and every `/school` read retry
   pending items, bounded). A paper with pending items has no final grade yet and cannot pass a stage. Every result
   goes through `scorePaper` from the contract.
4. **Routes** (`school/routes.ts`, owner-only like `/training`): `GET /school` → `{ state, stages (with open/locked/passed),
   latest per subject of the current stage, weak: weakSpots(results), pending }`; `POST /school/sit { stage, subject }`
   → a fresh paper's items to sit (question text, type, options, marks: NEVER the answers or rubrics) — any stage may
   be sat (a placement test); `POST /school/answers { paperId, answers: [{ id, given }] }` → marks → stores the result →
   if the stage's subjects are all top grades now, the stage (and every stage below it, for a placement) is marked
   passed and `state.stage` moves to the next → returns the result and what changed; `GET /school/paper/<id>` → the
   paper with answers, his answers, marks and notes (for the owner's spot check, only after it was sat);
   `POST /school/settings { nightly }`.
5. **Sitting on the phone** (`apps/web/src/school/sit.ts`): runs a paper on the offline brain exactly as the report
   card runs its questions (reuse `offline/lock.ts` `withModel` and the bench loop in `offline/harder.ts`): one item at a
   time, a short exam system prompt ("You are sitting an exam. Answer the question. Finish with 'Answer: <your answer>'";
   options listed A–D for multiple choice), a token budget per item (≈200; writing ≈ 350), progress "Question 7 of 20",
   STOP keeps the answers so far, answers posted when done (and every 5 items, so a stop loses little). Offline brain not
   downloaded → say so and offer DOWNLOAD IT IN SETTINGS, like the report card.
6. **The SCHOOL tab** (`features/school/index.ts`, id `school`, in `TABS` after `gym`): large title "School"; the
   ladder (every stage: label, years, a lock for locked ones, a tick with the date for passed ones, "now" on the
   current); the current stage's card: each subject with its latest grade and whether it is top grades, SIT THE EXAM
   (every subject in turn) and a per-subject SIT; SIT A PLACEMENT TEST (pick any stage; plain words: "If he gets top
   grades, that stage and everything below it is done at once"); WEAK SPOTS (from `weak`); RESULTS (tap one to see
   every question, his answer, the marks and the marker's note, and whether the paper is official or written by
   Ghosty); a NIGHTLY REPORT switch; and one honest note on how marking works (exact answers marked by the code; written
   answers marked by a stronger model against the mark scheme, which you can spot-check here). UPPERCASE buttons,
   44 px targets, nothing sideways at 440 px, every state designed (nothing sat yet; sitting; pending marks; passed).
7. **Nightly school report** (`schoolDaily`): once a day, if `nightly` is on and something happened since the last
   report (a paper sat, a stage passed, marks completed), one push through `pushIfWanted` in plain words:
   "School: passed Reception maths (Top band, 17/18). Reading next." Nothing when nothing happened.
8. **Tools** in `tools/extra.ts`: `school_status` ("how's school going?") and `sit_exam { stage?, subject? }` (which
   tells the owner to open SCHOOL on the phone, since the brain itself cannot run the offline model). Keep the prompt
   budgets passing.

## Tests (each must FAIL on the old code)

`apps/edge/test/school.test.mjs` (build `packages/shared/src/school.ts` and your `school/*` the way other tests build
their bundles; name the esbuild line in your report): papers are deterministic per seed and valid (ids unique, every
exact item's answer parses, every mcq has its answer among A–D, item counts in range, every subject of the four
stages makes a paper); a full-marks answer set is top grades and an all-wrong one is not; pending model marks block
the grade; a stage passes only with top grades in every subject; a placement pass of ks2 marks nursery, reception and
ks1 passed too and moves to ks3; locked stages are reported locked; `/school/sit` never returns answers or rubrics;
model marking stores the note and an integer within range; the nightly line is sent once and only when something
happened. `tests/school.spec.mjs` (440 × 956): the tab opens from the deck, shows Nursery as "now" and the rest
locked, SIT runs with a mocked offline brain (copy the WebLLM mock from `tests/offlinebrain.spec.mjs` or
`tests/thinkharder.spec.mjs`), shows "Question x of y", and the result card appears with a grade; the placement
picker lists every stage.

## How to run things here

As BRIEF-GYM3.md says (install in `apps/edge`, `playwright@1.56.1` at the worktree root, the brain bundle with
`esbuild`), YOUR preview port is **8803**. Run only the tests you touch while working; the full `apps/edge` `npm test`
once at the end (≈14 min on this shared 4-core machine), with `npx tsc --noEmit -p tsconfig.json` in `apps/edge`,
`npm run check` in `apps/web`, and your spec plus `tests/ui.spec.mjs` on your port. Never the whole browser suite.

## Finish

Commit on your worktree branch (do not push, do not merge). Update MAP.md. Final report: files changed; the marked
kernel lines; the exact `esbuild` line, test file and spec name for the orchestrator to add; tests added and proof
they fail on the old code; every check run with its exact result; screenshots (paths); what is not done and why.
