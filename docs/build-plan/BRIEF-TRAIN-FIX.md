# Weekly training: the fixes the pre-flight review asked for, before the first real run

Read BRIEF-W0.md (shared rules), BRIEF-S2.md (what Stage 2 is) and MAP.md's entries for `selftrain/*` and the Kaggle
notebook first. The weekly self-training of the offline brain (`apps/edge/src/selftrain/*`, `training/kaggle/
ghosty_weekly.py`) has never run for real. The owner has saved his Kaggle and Hugging Face keys and is waiting to
press TRAIN NOW. An independent review (23 Oct) found no certain blocker but the problems below. Fix them all, each
with a test that fails on the old code where a test is possible. Work ONLY in: `apps/edge/src/selftrain/*`,
`training/kaggle/*` (the notebook, `build.mjs`, its tests, and `apps/edge/src/selftrain/assets.ts` only by running
`node training/kaggle/build.mjs`, never by hand), `apps/edge/test/selftrain.test.mjs`, `packages/shared/src/selftrain.ts`
if a type must change, MAP.md's entries. No protected files. Other builders are working on the GYM, the Library and
the SCHOOL: stay out of those. Do not change the prompt budgets.

## The fixes (most important first)

1. **HIGH. The notebook runs emulated bf16 on Kaggle's T4, about 4× slower than designed.** `ghosty_weekly.py` ~line
   713 uses `torch.cuda.is_bf16_supported()`, which returns True on a T4 because it includes emulation (the comment
   near line 22 says the opposite). Use `torch.bfloat16` only when `torch.cuda.get_device_capability()[0] >= 8`,
   otherwise fp16 autocast if it is safe for this training (check the loss scaling path) or plain fp32. In fp32 the
   generation cache doubles: at batch 32 × (1536 + 384) tokens it is about 14 GB, which does not fit a 15 GB T4, so
   do this together with fix 4 (length-grouped batches, about 8 rows for the long prompts). Fix the comment.
2. **HIGH. A Kaggle run that finishes without reporting is only noticed after 7 hours, with no reason.** `main()` in the
   notebook catches every error (~line 1265) so Kaggle shows COMPLETE even when the run failed; if the notebook cannot
   reach the brain's hook (no internet granted, e.g. an unverified phone), `cycle.ts` ~line 553 waits until 7 h after
   the push and then says only "finished but sent no report". Do three things: (a) when Kaggle's status is COMPLETE and
   no report has arrived within about 45 minutes, end the week with a plain reason; (b) fetch the kernel's output (its
   log and `ghosty_report.json`) through Kaggle's output API (the CLI's `kaggle kernels output`; read the real
   `kagglesdk` package for the service and method names, e.g. in a venv under
   /tmp/claude-0/-home-user-Ghosty/6a05925c-6839-5546-8e68-c6df376dadfa/scratchpad/) and show the tail of the log in
   the status note; (c) a pre-flight call to `kernels.KernelsApiService/GetAcceleratorQuotaStatistics` before pushing:
   refuse to push, with a plain note, when the GPU quota's `totalTimeAllowed` is 0 (phone not verified) or fewer than
   10 hours are left, or when `isPayToScaleEnabled` is true (never risk a charge). Mock these in the tests.
3. **MEDIUM-HIGH. Any error inside the notebook ends the whole week, with no retry.** A 5xx from Hugging Face, a pip
   hiccup or a node problem during setup becomes a report with `error`; `acceptReport` (`cycle.ts` ~614–652) then ends
   the week; only Kaggle's own ERROR/CANCEL re-pushes (at most twice). Treat a report with `error` and no `after`
   scores as "re-push" while `pushes < 3`, and retry the downloads in the notebook's `setup()` a few times with a pause.
4. **MEDIUM. The tools exam prompts are cut off.** The exam offers all 10 tools (~4.8k characters ≈ 1.4k tokens, plus
   persona and header ≈ 1.6k), and generation truncates from the left at `max_length=1536` (~lines 820, 861), so every
   TOOLS exam item loses its persona and tool header. Raise `max_length` to 2048 and group batches by length (about
   8 rows for the long prompts), which is also what keeps fp32 within memory (fix 1).
5. **MEDIUM. CPU time per invocation in the brain.** The free part of gathering (`cycle.ts` ~305–341) measured 110–170 ms
   of CPU and the upload step (`cycle.ts` ~461–487, the base64 of the 535 KB `tasks.mjs` in `remote.ts` ~216–263) about
   60 ms. Pre-compute the base64 of `TASKS_JS` in `build.mjs` (into `assets.ts`), upload `tasks.mjs` only when its hash
   changed since the last upload, and spread the free part of gathering over several ticks so no single tick does more
   than a few milliseconds of pure CPU. Keep every tick inside its existing try/catch.
6. **MEDIUM. Gathering can get stuck on the library exam questions.** `cycle.ts` ~378: while `!examLibrary && examTarget
   >= 2` the step returns before the one-day `COLLECT_FOR` check (~448); failed model calls still count toward
   `st.calls`, so after enough failures `room()` is false for ever and the step repeats every 2 minutes. Check the
   deadline and the call budget before that early return, and mark the library exam done when either runs out.
7. **MEDIUM. A model can be promoted when its adapter never reached Hugging Face.** `keep_for_later()` (~1246, 1264)
   uploads the adapter after `publish`; if that upload fails the report has both `published` and `error`, and
   `acceptReport` (~628) still promotes the model and records `adapters/week-NNNN` in its chain, so every later week
   fails in `load_model` (~791) until ROLLBACK. Upload the adapter inside `publish()` before the candidate weights, and
   never promote when `r.error` is set.
8. **LOW–MEDIUM. Package skew on Kaggle.** The pins exist and install on Python 3.12 (`transformers==4.51.3`,
   `peft==0.15.2`, `accelerate==1.6.0`, `huggingface_hub==0.30.2`, `safetensors==0.5.3`, `nodejs-bin==18.4.0a4`), but
   `huggingface_hub` 0.30.2 sits next to the image's newer `hf_xet`. Downloads were shown to work; uploads could not
   be tested. Add `pip uninstall -y hf_xet` after the pins (the conservative choice), and say so in a comment.
9. **LOW. Anonymous downloads** of the base Qwen3 model, the stock MLC files and oasst1 (~744–747, 1022) share Kaggle's
   addresses with many users and may be rate-limited: pass `token=self.token`.
10. **LOW. Docs:** MAP.md ~155 says the notebook uploads to the "public model repo" (it is PRIVATE, `candidates` branch);
    `ghosty_weekly.py` ~24 says `/kaggle/temp` (the code uses `/tmp/ghosty_work`). Fix both.
11. **LOW. Quota.** Up to 3 pushes × 10 h can use the whole 30 h weekly quota; a second TRAIN NOW in the same Kaggle
    week may find none left. With fix 2(c) in place, make the status note say how many GPU hours are left.

Verified safe by the review (do not change): the Kaggle endpoint and sign-in, every SaveKernel field, `isPrivate`
on the kernel and both Hugging Face repos, the gate (no path publishes weights that failed it), the hook ticket, the
pinned revisions and the MLC layout, and that nothing can be charged.

## Tests and checks

- `python3 training/kaggle/test_ghosty_weekly.py` (no torch here: GPU parts are skipped; add tests for the pure parts
  you change: the dtype choice as a function of the capability tuple, the batch grouping, the retry wrapper, the
  publish order) and `node training/kaggle/build.mjs --check` after regenerating assets with `node training/kaggle/build.mjs`.
- `apps/edge/test/selftrain.test.mjs`: the COMPLETE-without-report timeout, the output fetch shown in the note, the
  quota pre-flight (refuses at 0 h, < 10 h, pay-to-scale), the error-report re-push and its cap, the gathering budget
  guard, no promotion with `r.error`, tasks.mjs uploaded only on a changed hash. Build the bundles the test needs with
  the matching esbuild lines from `apps/edge/package.json` and run `node --import ./test/no-network.mjs --test test/selftrain.test.mjs`.
- `npx tsc --noEmit -p tsconfig.json` in `apps/edge`; the full `apps/edge` `npm test` once at the end (≈14 min on this
  shared 4-core machine).

## Finish

Commit on your worktree branch (do not push, do not merge). Final report: each finding with what you changed
(file:line) or why not; tests added and proof they fail on the old code; every check run with its exact result;
anything you could not do.
