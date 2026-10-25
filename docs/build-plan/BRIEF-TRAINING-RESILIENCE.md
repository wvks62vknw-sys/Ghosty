# Training that survives Kaggle's hours running out (the owner, 24 Oct: "what about when it runs out of hours")

Read first: RESEARCH-FREE-GPU.md (the facts), BRIEF-W0.md, the headers of `training/kaggle/ghosty_weekly.py`,
`apps/edge/src/selftrain/cycle.ts`, `remote.ts`, `loops.ts`, and BRIEF-NIGHT-SCHOOL.md part B (the monthly retrain),
BRIEF-BIGGER-BRAIN.md (bases). Everything free; nothing that can ever bill the owner; his data stays in his private HF repos.

## Part A — every Kaggle hour counts more (notebook + brain)
1. **The second T4.** Sampling (STaR candidates, the exam, the gate's scoring) runs on `cuda:1` while training runs on
   `cuda:0`; measured in the notebook's own timings; the report says what ran where. Fall back to one card when only
   one is there.
2. **Checkpoints inside phases** every 10–20 minutes to `wip/` in the private repo (adapter, AdamW and scheduler state,
   RNG, the data position, partial samples and exam answers); `resume()` continues mid-phase. A run cut off at any point
   loses at most 20 minutes. Tested with a fake interruption in `test_ghosty_weekly.py`.
3. **A time budget set by the host** (`budget_hours` per host; Kaggle 9 h as now), and a week allowed to span several
   sessions: the brain re-pushes with `resume: true` until the run reports; the gate judges the finished run only.
4. **Economy mode** in `cycle.ts`: when Kaggle's hours left are under what a full run needs, the week runs smaller
   (fewer replay weeks, fewer STaR samples, the exam on the phone) instead of waiting; the LOOPS card and the training
   panel say so in plain words ("Only 6 h left this week: a smaller run, the exam on the phone").
5. **A quota forecast line** in SYSTEM → OFFLINE BRAIN TRAINING: hours left, when they come back, what the next run
   needs, and which mode it will be.
6. Stale P100 texts corrected (notebook header, PLAN.md, BRIEF-S2.md).

## Part B — a daily second pool on the owner's own Hugging Face account (ZeroGPU)
7. A small Gradio Space the brain creates in the owner's account with his `hf_write` token (asks first, once; private if
   a free account can, else it holds no data of his: it reads the private repo through a Space secret), with
   `@spaces.GPU` step functions: `sample(n)` (STaR candidates for the week from the current brain), `score(k)` (exact
   checkers), `exam(chunk)`. The brain calls it once a day for up to the 5 free minutes, keeps the results in the week's
   data, and never counts on it (Kaggle stays primary; a day with no quota is skipped and said).
8. The report card shows what the daily pool contributed ("312 checked samples this week from the daily GPU").

## Part C — design only (built later, when the owner is at a computer to sign in once)
9. **Colab free T4 through the official Colab CLI** as a second full-run pool: a design note in HANDOFF (the private
   GitHub Actions driver, the token as a secret, the supervised first run, the free-tier rules risk).
10. **Kaggle TPU v5e-8**: what a torch_xla port of the LoRA training would take; no code.

## Rules
No kernel file (MAP.md); no new npm packages; the notebook's tests (`python3 training/kaggle/test_ghosty_weekly.py`) and
`node training/kaggle/build.mjs` (never edit assets.ts by hand) after every change; the edge suite once; everything in
plain words for a non-technical owner; the prompt budgets untouched (no new tool names).

## Finish
Commit per step (do not push, do not merge). Report: what each part does, the tests that fail on the old code, every
check's exact result, what is unmeasured (no GPU here), the Colab and TPU design notes.
