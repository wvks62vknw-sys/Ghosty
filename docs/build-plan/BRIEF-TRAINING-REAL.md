# BRIEF: THE WEEKLY TRAINING, FOR REAL — the whole path proved with fakes, the state he asked for, RUN NOW on his tap

AUDIT-8-NOV item 7 (line 42): PLAN 3 E1 "the first real weekly run on Kaggle ... published to the phone only if it beats the
current brain", HANDOFF 18 Oct "Never run for real yet", the keys are in (OWNER-ISSUES 24), and "whether a real run completed and
what the report card says: state not recorded". Read first: AUDIT-8-NOV lines 14 to 20 and 42; PLAN section 3 E0 to E2;
BRIEF-TRAINING-RESILIENCE (the hours, checkpoints, sessions), BRIEF-GYM1 and BRIEF-GYM2 (what feeds the week), BRIEF-BIGGER-BRAIN
(the bases, ROLLBACK across a switch); HANDOFF's section "TRAINING BEYOND KAGGLE'S HOURS"; then `apps/edge/src/selftrain/cycle.ts`
(trainTick, push, watch, hookRoute, acceptReport, endWeek, trainStatus, trainingRoute), `remote.ts` (Kaggle and Hugging Face calls),
`packages/shared/src/selftrain.ts` (gateVerdict, TrainReport, TrainStatus), `apps/web/src/features/system/training.ts` (the panel),
and the tests: `apps/edge/test/selftrain.test.mjs`, `tests/selftrain.spec.mjs`, `tests/night.spec.mjs`. The mid tier. Start from
the session branch.

## What is fixed

1. **E0, THE PRE-FLIGHT, AS CODE (not a review that was once read).** `preflight(d)` in cycle.ts asks, in order and with no side
   effect but reading, every thing a real run needs, and stops at the first that is wrong, naming the step and what he does about it
   in plain words: (0) no run is already under way; (1) both keys saved; (2) Kaggle accepts the key (the account's name); (3) Kaggle's free GPU hours: some, no
   pay-to-scale, a full or smaller run possible (`runPlan`); (4) the Hugging Face token is valid and may write (not read-only);
   (5) the two repos are private or can be made private by this token, and the account is not asked to pay; (6) the chosen base fits
   the free GPU (`baseProblem`); (7) the last notebook did not stop where it would again (`installHold`); (8) the brain knows its own
   address (the notebook reports back to it). The result (when it was asked, every step ok or
   stopped, what it will do) is kept and shown. `POST /api/training/preflight` runs it; nothing is gathered, uploaded or pushed.

2. **RUN NOW IS HIS TAP, AND ONLY HIS.** `POST /api/training/run` with `{ confirm: true }` runs the pre-flight again and, only when
   every step passes, starts the week exactly as TRAIN NOW does (and past the install hold, as his press always has). Without
   `confirm: true` it is refused and starts nothing; a failed pre-flight starts nothing and says which step stopped. The weekly job's
   own alarm is unchanged (the week still starts itself when it is due). The panel's RUN NOW first shows what it will do, in his
   words: gather this week's lessons from his own data and public sources, upload them to his private Hugging Face space, train on
   Kaggle's free GPU (hours, no paid tier, nothing can cost money), test the new brain against the current one on the same questions,
   and offer it to the phone only if it does better; otherwise nothing changes.

3. **THE WEEK, STEP BY STEP, EACH STEP A TEST WITH FAKES** (Kaggle, Hugging Face and the model are stand-ins; the real services are
   never reached from a test): pre-flight, the kick-off (data gathered, uploaded private, notebook pushed with a one-time ticket),
   the run read (running, queued, paused and carried on, stopped), the report card read through the hook, THE GATE (a brain that
   beats the current one on the card's measures is published; one that is worse, equal, unfinished, broken (an error after its
   exam), from another repo or another base is not, and nothing changes on the phone), PUBLISH TO THE PHONE (kept, recommended,
   tagged, served at the weight address), ROLLBACK (the published brain dropped for good and the one before it, or the stock build,
   in its place; the phone told, the log written).

4. **A LOG THAT REMEMBERS** (`train:log`, the last twenty events): each finished run (when, which week, whether it was a REAL run, one
   that reached its test, the card's average before and after, published or not and why) and each rollback (when, which brain, why:
   worse, broken or his choice). From it the status says in plain words: WHEN THE LAST REAL RUN WAS, WHAT ITS REPORT CARD SAID,
   WHETHER IT WAS PUBLISHED, KEPT, NOT KEPT, STOPPED OR ROLLED BACK, and WHEN THE NEXT IS DUE. With nothing yet it says so honestly:
   "No real run has finished yet."

5. **THE WEEKLY TRAINING CARD** at the top of SYSTEM → OFFLINE BRAIN TRAINING, drawn with the design system's own rows and keys
   (no new look): LAST REAL RUN, REPORT CARD (the average old to new, and the best and worst area), WHAT HAPPENED (published, not
   kept and why, stopped and where, rolled back and why), NEXT DUE, PRE-FLIGHT (when last checked, or the step that stopped); keys
   CHECK FIRST (the pre-flight alone) and RUN NOW (the confirm that says what it will do, then the real kick-off). Works in all
   three worlds at 440 by 956.

6. **THE REAL PRE-FLIGHT, ATTEMPTED FROM THE SANDBOX.** The Kaggle and Hugging Face keys live in the brain's vault (SYSTEM → KEYS)
   and are never in a builder's hands. If a local brain can reach them, E0 is run for real and recorded; if not, the report says
   which step stopped and why and what he taps on his phone. Nothing is faked and nothing that can cost money is touched.

## What must not change

The prompt guard; the CI guard job; `.github/*` (one `all=` word at the END of the list for the new spec), `apps/*/package.json`,
`agent.ts`, `index.ts` and `tools/{index,types,repo}.ts` untouched; no new keys, no packages, nothing that can cost money (Kaggle's
free hours only, pay-to-scale refused as today); the brain trains only on his own data and public sources; never a vendor's model
name (the bases are named by size as `BRAIN_BASES` names them); every existing selftrain test and spec kept as it is.

## Tests (each fails on the code before this brief; run once against it and say so)

1. Pre-flight: each of the nine steps (the run under way first) stopped in turn by a fake (no key, bad Kaggle key, no GPU hours or pay-to-scale, read-only
   token, a public repo it may not make private, a base too big, a stuck install, no address, a run under way) with the step named
   and nothing gathered, uploaded or pushed; all clear: ok, and still nothing pushed.
2. RUN NOW: refused without `confirm`; refused with a failed pre-flight (nothing started); with `confirm` and a clear pre-flight
   the week starts and the status says so.
3. The whole week from RUN NOW to the phone: a better report is published, tagged, recommended and served; the log has the run.
4. The gate: worse, equal, unfinished, broken, wrong repo and wrong base reports are never published and the phone's brain is
   untouched; each leaves a log line saying why.
5. ROLLBACK after a published week: the brain dropped, the log says rolled back and why (worse, broken, his choice), the status
   says ROLLED BACK for that run; rolling back the older one too reaches the stock build.
6. The status's plain words: no real run yet; a published run; a not-kept run; a stopped run; a rolled-back run; the next due.
7. The card in a browser (training-real.spec.mjs against the preview brain, its answers stood in for): the five rows with the words
   above, CHECK FIRST and RUN NOW (the confirm says what it will do and nothing starts on cancel), nothing sideways at 440, the
   three worlds.

## Validation

`cd apps/web && npx tsc --noEmit -p . && node build.mjs`; the brain tests in full; training, selftrain, night, gym, settings,
thescan, ui, deck, nav and the new spec on PORT 8806 one at a time. The ratchet in styles.css holds (no styles added).

## The owner's phone check (in these terms)

(1) SYSTEM → OFFLINE BRAIN TRAINING: the first card says when the last real run was and what its report card said, or "No real run
has finished yet". (2) Tap CHECK FIRST: it asks Kaggle and Hugging Face and says OK or the one step that stopped. (3) Tap RUN NOW:
it says what it will do; confirm; the week starts. (4) Some hours later the card shows the report card and whether the new brain was
published. (5) If it is worse nothing changes; if you do not like a published one, ROLLBACK.

## Report

training-report.md in the scratchpad: every commit's hash and one line; the weekly path step by step with the test that proves each;
what the card says; the real pre-flight's result or exactly where it stopped; NEEDS HIS WORD; the phone check. Never push.
