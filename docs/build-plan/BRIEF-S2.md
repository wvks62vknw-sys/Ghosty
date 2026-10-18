# STAGE 2: Ghosty's offline brain trains itself every week on free Kaggle GPUs

Read BRIEF-W0.md (shared rules) first. The owner wants the offline brain to keep getting genuinely smarter without
having to do anything, for free. Today the offline brain is Qwen3-0.6B (q4f16_1, MLC/WebLLM) pinned in
`apps/web/src/offline/models.ts`, run in Safari via WebGPU (`offline/brain.ts`, vendored WebLLM in public/vendor/webllm).
The GYM (`apps/web/src/gym/*`) has 22 games, each with `generate(level, seed)` → problem text and exact
`check(problem, answer)`. The brain (`apps/edge`) has a library, study drills (`library/drills.ts`, `training/exercises.ts`),
tools, and chats.

Build the whole loop, with no step that needs the owner after a one-time setup of two keys (Kaggle API key and a Hugging
Face write token, entered in the app's KEYS panel like the other keys — look at `apps/edge/src/keys.ts`; keys are never
pasted into chat).

1. Data factory (brain + repo code, runs weekly from the Durable Object alarm as a quiet job, like `study`):
   - Gym problems at the levels Ghosty has reached and just beyond, with exact checkers (export the generators so the
     notebook can run them: a node script or a small JS bundle the notebook runs with node, which Kaggle has).
   - ⭐ Evol-Instruct: take seed tasks (library drills, gym problems, tool-use tasks) and have the free online models
     evolve harder and broader versions (respect the quota engine's background lane in `apps/edge/src/llm/`).
   - ⭐ Library skills: question/answer pairs grounded in the owner's library passages (with the passage cited), so he
     learns to answer from his own library.
   - ⭐ Tool-use: traces of real tool calls (JSON function-call format the offline brain uses — see offline/prompt.ts) with
     results, from successful chats and from synthetic tasks, checked by actually running the tools in a sandbox where
     safe, or by schema check.
   - 👍/👎 from the owner on chat replies (add the two small buttons on replies if not there) → preference pairs for DPO.
   - Failure notebook: everything he got wrong this week (gym checks, offline answers later corrected) is replayed.
   - No forgetting: a fixed replay mix of earlier data and general instruction data with a licence that allows it.
   Write the week's dataset as JSONL to a private Kaggle dataset via the Kaggle API (or Hugging Face dataset repo if
   Kaggle datasets are impractical; say which and why).
2. The Kaggle notebook (in the repo, e.g. `training/kaggle/ghosty_weekly.ipynb` or .py, pushed by the brain through the
   Kaggle kernels API on a schedule, GPU on, internet on): free tier (T4/P100, ~30 GPU h/week, 12 h per run).
   - LoRA fine-tune of Qwen3-0.6B (Unsloth or PEFT+TRL; pin versions).
   - STaR / rejection sampling: for checkable problems, sample 16–32 attempts, keep the ones the exact checker passes
     (process rewards: reward checked intermediate steps where the game exposes them), train on those; self-critique and
     self-judge passes; DPO on the preference pairs; red-team prompts for safety; distillation from the free online
     models' best answers; optional merge of the new LoRA with the last good one (model merging) when it scores better.
   - Energy budget: the run must finish inside one free session with margin; checkpoint so a cut-off run resumes.
3. Exam gate and rollback: a fixed held-out exam (gym problems at fixed seeds, library Q&A, tool-use cases, general
   questions) scored before and after. Only a model that beats the current one without dropping any area by more than a
   small margin is published. Keep the last 3 good models; rollback is one tap.
4. Publish: merge LoRA, convert with mlc-llm to q4f16_1 MLC weights for the SAME model library (the wasm in
   public/vendor/webllm/libs, so no new compiled code is needed — verify the config matches), upload to the owner's
   private-or-public Hugging Face model repo at a new commit, and record the commit. The app's model list gets
   "Ghosty (week N)" pinned to that commit, with the stock model kept as fallback. The CSP and the vendoring rules in
   MAP.md apply: check which hosts the offline brain may fetch from (huggingface.co is already used).
5. Report card (honest): in the SYSTEM/AI area, a plain panel: this week's exam score vs last week by area, what he
   trained on, how long it took, what was rejected and why, and ROLLBACK / TRAIN NOW buttons. If keys are missing,
   it says exactly which two keys to add and where to get them, in plain steps.

You cannot run Kaggle or push to Hugging Face from this container (no keys), so: unit-test every piece you can locally
(data factory output schema, checkers, exam scorer, the notebook's pure-Python helpers with a tiny CPU smoke run if
python+torch are installable here — say if not), mock the Kaggle/HF APIs in edge tests, and add a browser spec for the
panel. Be honest in the report about what has never run for real. Kernel files (agent.ts, keys.ts, index.ts, env.ts)
may need small, clearly marked edits for the job, the routes and the two key slots; keep them minimal. Prompt budgets
in apps/edge/test/prompt.test.mjs must still pass.
