# A bigger brain on the 18 Pro Max, ready for the real phone (PLAN Week 2, Wave F part 1; OWNER-ISSUES 23)

The offline brain is Qwen3-0.6B through WebLLM (`apps/web/src/offline/models.ts`: pinned repos and revisions, the
worker, download asked for; `offline/brain.ts`; `offline/bench.ts` the report card; Settings → Offline brain). WebLLM's
prebuilt list (checked 23 Oct) has Qwen3.5-0.8B (about 1.6 GB of memory when running), Qwen3.5-2B (2.2 GB),
Qwen3.5-4B (3.9 GB), Qwen3-1.7B (2.0 GB), gemma-4-E2B (3.4 GB). The owner's phone has 12 GB; the 2B class is the safe
step, the 4B worth one measured try. The weekly training (`apps/edge/src/selftrain/*`, `training/kaggle/ghosty_weekly.py`)
targets the 0.6B base. Read BRIEF-W0.md, MAP.md, those files, `tests/offlinebrain.spec.mjs`, `tests/thinkharder.spec.mjs`.
The real phone is not here: build and test everything that does not need it, and leave the owner one clear tap.

## Build
1. **The model picker**: Settings → Offline brain lists the brains he can try: the current 0.6B, Qwen3.5-2B and
   Qwen3.5-4B (each with its download size, memory when running, "fits an 18 Pro Max: yes / tight / no" worked out
   from `navigator.deviceMemory` when the browser gives it and the phone's known 12 GB otherwise), pinned to exact
   revisions from WebLLM's list (verify the ids and the wasm libraries exist at the pinned WebLLM build; do not guess);
   download on Wi-Fi only (asked, with the size), kept in the cache, switchable, the current one marked; a TEST button
   runs the existing report card's quick check and the speed line on the chosen brain; the 0.6B stays as the fallback
   when a bigger one fails to load (memory) and the words say so.
2. **The training follows the chosen base**: the weekly run's config carries the base model (repo, revision, the MLC
   quantisation) chosen in Settings; the notebook trains the LoRA on that base and quantises for it; the gate compares
   like with like (the current brain of the same base); the exam's prompt budgets scale by the base's context. A
   base switch starts a fresh chain (said in the panel), and the old chain is kept for rollback.
3. **Honest memory words**: the picker explains in one line what a bigger brain costs (download, memory, slower first
   word) and gains (better answers), and that the real test is on his phone: "tap TEST after it loads".

## Tests (each must fail on the old code)
Edge: the config carries the base and the notebook reads it (a test in `training/kaggle/test_ghosty_weekly.py`), the
chain reset and rollback, the exam budgets by base. Web: the fit line maths (pure), the picker's download flow mocked,
the fallback to 0.6B on a load failure, TEST on the chosen brain (the spec's fake engine). Keep offlinebrain,
thinkharder and selftrain specs passing. `npm run check`, the edge tsc, the full edge `npm test` once, the notebook
tests and `node training/kaggle/build.mjs --check`. Say any protected-file line.

## Finish
Commit per part (do not push, do not merge). Report: the exact model ids and revisions verified; files; screenshots of
the picker; every check's exact result; what the owner must do on the real phone; anything not done and why.
