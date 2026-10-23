# The human voice: "the offline brain must not talk like an AI. Ever." (OWNER-ISSUES 12), built into the training

Read BRIEF-W0.md, OWNER-ISSUES.md item 12 (the owner's words: no "Great question!", no "As an AI…", no lists and
headings in casual chat, no over-apologising or padding; it must sound truly human, like a real person, not cringe;
tested with a blind "does this sound like a person?" check), HANDOFF.md "The owner and how he works" (he is "Boss"),
`packages/shared/src/persona.ts` (one character on every channel; the conservative polish filter), BRIEF-S2.md and
BRIEF-TRAIN-FIX.md (the weekly training: `selftrain/factory.ts` gathers the week's records, `exam.ts` the held-out
exam with its areas, `cycle.ts` the loop; the notebook `training/kaggle/ghosty_weekly.py` scores the areas), and
MAP.md's entries for them. Other builders are in `features/school`, `features/*` (restyling), the website builder and
`school/*`: work ONLY in a new `packages/shared/src/voice.ts`, `packages/shared/src/persona.ts`,
`packages/shared/src/selftrain.ts` (additions), `apps/edge/src/selftrain/{factory,exam,cycle}.ts`,
`apps/edge/src/prompt.ts` ONLY if the persona lines live there and only within the prompt budgets
(`apps/edge/test/prompt.test.mjs`, never raised), `training/kaggle/ghosty_weekly.py` (+ tests, `build.mjs`, assets via
build.mjs), `apps/web/src/offline/bench.ts` (pure additions), the edge tests, MAP.md. No protected files; no interface
panels (say what the report card should show).

## Build

1. **The AI-sounding detector** (`packages/shared/src/voice.ts`, pure, exact, the same in TypeScript and in Python in
   the notebook): a score 0–1 for how much a reply sounds like an AI, from patterns with weights: assistant phrases
   ("Great question", "As an AI", "I hope this helps", "Certainly!", "Absolutely!", "I'd be happy to", "Let me know if",
   "It's important to note", "In conclusion", "Here's a breakdown"), stacked apologies and hedges, headings or bullet
   lists in a casual exchange, exclamation density, needless restating of the question, sign-offs, over-long replies to
   short asks, American spellings and phrasings for a British owner. `human(reply, ask)` → true below a threshold.
   Tested on a fixture of 60 replies labelled by hand (30 human-sounding, 30 AI-sounding): precision and recall ≥ 0.9.
2. **The style set**: each week the factory asks a stronger online model (background lane, bounded, resumable) for
   short everyday exchanges in Ghosty's character, British, warm, direct, no padding (the rubric in the prompt, with
   five good and five bad examples), covering the owner's real kinds of asks (from this week's chat questions, with
   nothing private copied: only the shapes of asks); keeps only replies the detector calls human AND a second,
   blind judge call ("Is this a person or an AI? Answer PERSON or AI.") calls PERSON; stores them as `distill` records
   with `from: 'voice'`; at most 120 a week, counted in the training status ("voice: 84").
3. **Preference pairs**: every reply the owner 👎'd, and every reply of his this week the detector calls AI-sounding, is
   rewritten by the stronger model as a person would say it (same facts, half the words); when the rewrite passes the
   detector and the judge, a `pref` record `{ chosen: rewrite, rejected: original }` joins the week (at most 80).
4. **The exam gets a VOICE area**: a new `ExamArea` 'voice' (shared `EXAM_AREAS`, `AREA_LABEL` "SOUNDS LIKE A PERSON",
   the notebook's `EXAM_AREAS` and `score_voice`): the share of the GENERAL and LIBRARY exam replies the detector calls
   human (exact, no model). It goes into the gate like every area (a new brain may not drop it beyond the allowed
   margin). `GATE_AREA_CAP` and the report card's rows follow automatically where they read `EXAM_AREAS`; say in your
   report what the SYSTEM panel will show.
5. **The persona filter for the online models** (`persona.ts`): the conservative polish filter also strips or rewrites
   the detector's phrases (never the facts), and the persona lines in the system prompt say the rule in one line, within
   the budgets (trim elsewhere in the persona text if needed, never the tool lines).
6. **On the phone** (`offline/bench.ts`, pure additions): the report card's run also records the detector's score on
   its own answers ("sounds like a person: 17 of 20"), for the panel to show later.

## Tests (each must FAIL on the old code)

Edge: the detector on the 60-reply fixture (precision/recall), the style set kept only when both checks pass and
within the cap, the preference rewrites, the exam area in the gate verdict, the persona filter's rewrites keeping the
facts and the prompt budgets passing. Notebook: `score_voice` identical to the TypeScript detector on the same fixture
(share the fixture file), the area in the gate. Then the full edge `npm test` once (≈ 16 min on this shared machine),
`python3 training/kaggle/test_ghosty_weekly.py`, `node training/kaggle/build.mjs --check`, tsc.

## Finish

Commit on your worktree branch, often (do not push, do not merge). Final report: the detector's numbers on the
fixture; what the training will gather each week; the gate change; what the panels should show; tests and proof they
fail on the old code; every check with its exact result; anything not done and why.
