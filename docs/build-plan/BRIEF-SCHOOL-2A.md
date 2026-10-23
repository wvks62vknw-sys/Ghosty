# SCHOOL part 2a: proper papers for every stage (banks checked twice, and the official papers)

Read BRIEF-W0.md (shared rules; the phone is the iPhone 18 Pro Max, 440 × 956), HANDOFF.md "RAISING GHOSTY" (the
owner's rules: official papers where they exist, kept private, never redistributed, never trained on; proper grade
boundaries; exact marking where possible), BRIEF-SCHOOL-1.md and what it built (`apps/edge/src/school/*`,
`packages/shared/src/school.ts`, `apps/web/src/features/school/index.ts`, `apps/web/src/school/sit.ts`,
`apps/edge/test/school.test.mjs`, `tests/school.spec.mjs`), then MAP.md's entries for the school, the library's
importers (`library/importers.ts`: how PDFs and web pages reach the library; PDF text is extracted on the phone in
`apps/web/src/library/extract.ts`), the model router's background lane (how `school/mark.ts` asks a stronger model)
and the proxy (`/api/proxy`).

Part 1 wrote papers for nursery to Key Stage 2 from generators in `papers.ts`. This part makes every stage sit
proper papers: Key Stage 3, GCSE, A-level and university from question BANKS written by a stronger model and checked
twice, and the OFFICIAL papers (SATs; GCSE and A-level past papers) imported privately. Work ONLY in:
`apps/edge/src/school/*` (new files `banks.ts`, `official.ts` welcome), `apps/edge/test/school.test.mjs`,
`apps/web/src/features/school/index.ts` (one new OFFICIAL PAPERS section and the stage list), `apps/web/src/school/*`
(a new `official.ts` for fetching and reading PDFs on the phone), `tests/school.spec.mjs`, `packages/shared/src/school.ts`
(pure additions only), MAP.md, `apps/web/styles.css` inside the existing `/* SCHOOL */` block. No protected files;
the route prefix `/school` is already wired. Other builders are restyling the whole app (stay out of everything
else), building Home's centrepiece, and the training pipeline is next (part 2b): do not touch `selftrain/*`.

## Build

1. **Question banks for Key Stage 3, GCSE, A-level and university** (`school/banks.ts`): for each stage and subject
   in `STAGES`, a bank of items is written ONCE by a stronger online model through the background lane, in slices
   (never more than a few model calls per tick; resumable; honest progress "Writing the GCSE maths bank · 48 of 120"),
   in the real exam style for that board and level (question types, marks, command words; the mark scheme for
   written answers), each item with its `topic`, `type`, `marks`, the `answer` and for written items a `rubric`.
   **Checked twice**: an exact item is kept only if a second model call, given the question alone, reaches the same
   answer (numbers recomputed; multiple-choice re-answered); a written item is kept only if a second call judges its
   mark scheme sound. Rejected items are counted and shown. Banks are stored under `school:bank:<stage>:<subject>`
   (chunked under the 128 KB record limit), private, never in the library, never exported, never trained on. A paper
   is sampled from the bank by seed with the stage's real structure (e.g. GCSE maths: 80 marks, a mix of 1–5-mark
   items across the topics; A-level: 100 marks); `bandsFor` gives the grades. With no bank yet the stage says so and
   offers WRITE THE PAPERS (one tap starts the slices).
2. **Official papers** (`school/official.ts` + `apps/web/src/school/official.ts` + the OFFICIAL PAPERS section):
   - A curated list, in the code, of official free papers with their source and licence: Key Stage 2 SATs from the
     Standards and Testing Agency on gov.uk (Open Government Licence v3: reading, grammar/punctuation/spelling,
     maths papers 1–3, with their mark schemes and the raw-to-scaled-score tables) for the three most recent years
     published; GCSE and A-level past papers from the boards' own sites (AQA, Pearson Edexcel, OCR; free for personal
     use; copyright stays with the board) for maths, the sciences, English, history, geography and computer science,
     with their mark schemes and grade boundaries. Verify every URL exists today (fetch its headers); drop any that
     does not and say so.
   - FETCH on the phone: the PDFs come through `/api/proxy` (add the hosts to the proxy's allowed list the way other
     feeds are added, and say which) and are read to text on the phone with the library's own PDF extractor; the
     text (questions and mark scheme) goes to the brain, which turns it into items with a stronger model (question
     text, marks, type, answer or rubric; diagrams noted as "needs the picture" and skipped from the paper with the
     marks left out of its total), checked the same way as a bank, and stores the paper under `school:official:<id>`
     with its source, licence, year and the real boundaries (scaled scores for SATs; the board's grade boundaries
     for that series). Progress shown; resumable; never exported; never trained on.
   - A sat official paper is marked and graded exactly like any other, with its real boundaries; the result says
     "official" and names the year and board.
3. **The SCHOOL tab**: the placement picker lists every stage as sittable once its bank exists; each subject row
   says whether a paper will be official or written by Ghosty; the OFFICIAL PAPERS section lists what is fetched and
   what is available (FETCH, with the licence line); the result sheet shows the real grade with its boundary line.
4. **Honesty everywhere**: every paper and result says who wrote it and how it was marked; a stage with no bank and
   no official paper cannot be sat; the owner can open any paper after sitting it to spot-check the marking.

## Tests (each must FAIL on the old code)

`school.test.mjs`: a bank slice writes and checks items (mocked model: agreeing and disagreeing second calls), keeps
only checked ones, resumes, counts rejections, stays within the per-tick model budget; a paper sampled from a bank has
the stage's structure and marks; official import turns mocked PDF text into items with real boundaries and skips
diagram items honestly; nothing official or banked ever appears in the library or in `ownerPassages`' reach; the
curated list's entries have a source and a licence. `tests/school.spec.mjs`: the OFFICIAL PAPERS section and a bank's
WRITE THE PAPERS flow through the mock brain.

## How to run things here

As BRIEF-SCHOOL-1.md says; YOUR preview port is **8807**; run only the tests you touch while working, the full edge
`npm test` once at the end (≈16 min on this shared 4-core machine), `npx tsc --noEmit -p tsconfig.json` in `apps/edge`,
`npm run check` in `apps/web`, and the school spec on your port.

## Finish

Commit on your worktree branch, often (do not push, do not merge). Final report: files changed; the curated list with
each URL's check result; tests and proof they fail on the old code; every check run with its exact result;
screenshots; anything not done and why.
