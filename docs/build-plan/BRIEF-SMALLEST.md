# BRIEF-SMALLEST — a brain that fits his phone, one tap from SIT (batch ⑥ part 1, 1 Nov 2026)

Worktree from the branch tip (claude/ghosty-ai-training-idwhp9 at or after 5e0d628). Your preview port: 8833. Read first:
OWNER-ISSUES 89, 90 (the sitting-crash fix as shipped), 95, 96; HANDOFF.md from "- 31 Oct 22:15 UK" to the next "## ".
Three other builders run in parallel (batch ① the Abilities tab and catalogue, ② the chat's cards, shell, brief, lens and
agent.ts, ③ the arcade). Your files: `apps/web/src/offline/models.ts`, `apps/web/src/offline/brain.ts`,
`apps/web/src/school/sit.ts`, `apps/web/src/features/school/index.ts`, `apps/web/src/features/settings/offline.ts`,
`tests/bigbrain.spec.mjs`, `tests/sit.spec.mjs`, `apps/edge/test/offline-brain.test.mjs`, `apps/edge/test/school.test.mjs`,
and the vendored WebLLM config if a model entry must be added there. Touch nothing else.

## The owner's words (1 Nov 03:50 UK)

"the brain school thing is still crashing to my knowledge". He has not had the patience for GET → USE → SIT in Settings.
What he wants: press SIT and it works, on his own brain, with the words honest when it cannot.

## What is known

iPhone 18 Pro Max, Safari, WebGPU through WebLLM 0.2.85 (vendored under apps/web/public/vendor/webllm). Qwen3 0.6B
(352 MB, ~1.4 GB when running) LOADS and then closes the tab within seconds of the first question: memory, at the first
prefill. The 2B closes on load. The crash records (`ghosty.offlinebrain.loading`, `.answering`, the held map) and the
refusal-until-USE are in place (OWNER-ISSUES 89). Qwen2.5 0.5B (290 MB, ~0.94 GB) is the stand-in and has not been tried.
The KV cache at 2,048 tokens is tens of MB for these models: the weights and the prefill's working buffers are what
matter, and `prefill_chunk_size` is baked into each model's wasm, so the levers are a smaller model and a shorter prompt.

## What to build (a commit each)

1. THE FLOOR BRAIN. Add the smallest instruct model WebLLM 0.2.85 ships prebuilt that is materially smaller than the 0.5B
   (SmolLM2 360M Instruct q4f16_1 is the expected one: verify the exact record name, its wasm and sizes against the
   vendored config or the upstream prebuilt list for this version; take the vram figure from there). It is a stand-in like
   the 0.5B: `heldKey` by id, its own row in WHICH BRAIN ("the tiniest"), ctx 2,048, the same download rules (his tap, on
   Wi-Fi, size said first). `holdLine`, `pickerRows`, `leastShown` and the facts tail learn the third rung.
2. THE CHAIN. The order is 0.6B → 0.5B → the floor. `pickBrain` picks the largest brain that is here and not closed; when
   none is here but a smaller rung is usable, SIT and CARRY ON show ONE button — "GET <label> (<size>) and sit" — which on
   Wi-Fi downloads, loads and sits in one go, and on mobile data says so and waits (the button stays). When the floor has
   closed too, the words say the truth: "No brain runs in this phone's browser yet. I keep my schooling for when one
   does." — no cloud sitting: School is his own brain or nothing. The Settings path (GET, USE) keeps working as it is.
3. A SHORTER SITTING PROMPT on every small brain: the question and the instruction only, at most 600 tokens (the exam's
   framing lines trimmed, nothing the marking needs removed); measured by the same token estimate the budget uses; the
   same answers graded the same way (the marking code untouched). The chat's PROMPT_BUDGET stays 1,500.
4. AFTER A CLOSE, ONE LINE IN THE CHAT when Ghosty reopens: "<label> closed Ghosty while <loading|answering>. Next time
   SIT uses <next rung>." — once per record, through the existing toast or a plain line in the conversation (read
   `assistant/session.ts` only to find how a plain line is posted; do not change it).

## The lines that hold

Downloads only on his tap, on Wi-Fi, the size said first; no brain is loaded again after a close until he says so (USE,
or the one-tap button for a DIFFERENT rung); nothing that bills; the plain prompt untouched; no test skipped or weakened;
the guard job untouched; no model names of any assistant vendor in code or comments (the on-device model files' own names
are data, as today).

## Tests

`offline-brain.test.mjs`: the third rung's record, `heldKey`, `holdLine` three ways, the chain's pick in every state (none
here; 0.6B closed and 0.5B here; both closed and the floor here; all closed), the one-tap offer's states (Wi-Fi, mobile
data, floor closed), the sitting prompt's budget. `school.test.mjs`: the stub gains any new import. `bigbrain.spec.mjs`:
a new section — the 0.5B's answering record planted, kill and reopen, the floor is offered, GET-and-sit on stubbed Wi-Fi
downloads (stubbed as the existing sections stub downloads) and the paper starts on the floor; on stubbed mobile data the
button waits with its line. `sit.spec.mjs`: SIT with no brain here and the 0.6B closed shows the one-tap button; after it,
the paper is sat on the 0.5B. Keep every existing check.

## Working lean (credits are the constraint this week)

Read only the files named (`sed -n` ranges, `grep -n`); test output through `tail -30`; the full brain suite once at the
end under `nice -n 10`; no narration. Validation: brain typecheck + suite; web typecheck + build; on one fresh preview:
websites, apps, bigbrain, sit, school (if a `school` spec exists), deck, nav.

## The report (one message)

Base SHA, HEAD SHA, the worktree branch; commits; files; validation numbers; the floor brain's exact record and sizes;
LIMITS; NEEDS HIS PHONE (what he presses and what he should see at each rung); WHAT THE MERGE MUST KNOW.
