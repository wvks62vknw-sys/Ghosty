# Night School and the monthly retraining (PLAN Wave F; OWNER-ISSUES 9)

Read BRIEF-W0.md, MAP.md, `features/gym` (TRAIN ALL with KEEP AWAKE: the wake lock, honest about iOS needing the
screen on and the phone plugged in), the Library's STUDY ALL (`features/library`, `apps/edge/src/library/study*.ts`),
the school practice (`apps/edge/src/school/practice.ts`), the weekly training (`apps/edge/src/selftrain/cycle.ts`,
the alarm, TRAIN NOW), `schedule.ts` `ensureJob`, and `tests/gym.spec.mjs`, `tests/selftrain.spec.mjs`.

## A. NIGHT SCHOOL (one switch, one plan, honest)
A NIGHT SCHOOL card in SYSTEM (or Learn: say where and why): a switch and a time window ("from 23:00 to 06:00",
Europe/London). While it is on and the phone is open on Ghosty, plugged in and in the window: KEEP AWAKE holds the
screen (dimmed), and he works through a plan in order: the school's weak spots first (practice at his stage, checked
twice, feeding training), then GYM TRAIN ALL (least mastered first), then STUDY ALL (the library's queue), each with
its own stopping point, a progress line ("Night School · 02:14 · school practice 18 of 40 · gym next"), and a morning
report in the inbox ("Last night: 40 practice questions (31 right), maze to level 4, 312 passages read") that the
nightly school report can fold in. On the brain, the parts that need no phone (school practice generation with the
free online models, the library's own study) run on the brain's alarms in the same window regardless. Honest about
iOS: the phone must stay open on Ghosty and plugged in; closing it pauses the plan; nothing runs with the screen off.

## B. MONTHLY RETRAINING
The weekly run trains a LoRA on the week; once a month (the first Friday's run, or TRAIN FROM SCRATCH in the training
panel) the run retrains from the base on EVERYTHING kept (every week's records and replay, within Kaggle's 12-hour
limit: the notebook already budgets steps; say how), so drift from stacked weekly adapters is reset; the gate is the
same exam, the rollback the same. The training panel says which kind the next run is and why.

## Tests (each must fail on the old code)
Edge: the night plan's order and stopping points (pure), the window in Europe/London across the clock change, the
morning report's words, the monthly choice (the first Friday, or forced) and the notebook config it sends (a test in
`training/kaggle/test_ghosty_weekly.py` for the from-scratch branch too). Spec `tests/night.spec.mjs` at 440 × 956
with a faked clock and the wake lock mocked: the switch, the window, the progress line through the three parts, the
morning report. Keep gym, selftrain and school specs passing. `npm run check`, the edge tsc, the full edge `npm test`
once, `python3 training/kaggle/test_ghosty_weekly.py`, `node training/kaggle/build.mjs --check` (regenerate the asset
if the notebook changes). Say any protected-file line.

## Finish
Commit per part (do not push, do not merge). Report: files; screenshots; every check's exact result; anything not
done and why.
