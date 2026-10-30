# BRIEF — DEPENDABILITY (batch 1 after the 30 Oct reset)

You are building for Ghosty, the owner's personal AI (a Cloudflare Worker + Durable Object brain in `apps/edge`,
a PWA in `apps/web`, shared code in `packages/shared`). Read `docs/build-plan/HANDOFF.md` (how we work, the budget
rule) and `docs/build-plan/SMALL-GAPS.md` (the families) first. The owner's words for every item below are in
`docs/build-plan/OWNER-ISSUES.md` at the numbers given — read those entries; they are the spec.

**Why this batch is first.** The owner's one-line test of a guardian: *"does what he said, or tells you why."* Four
live failures break that today. Fix them at the cause, with a test that would have caught each, and nothing else.

## The four items (in this order; one commit per item)

### 1. The school test crashes on the offline brain — OWNER-ISSUES 57c (live bug)
`apps/web/src/school/sit.ts` sits a paper one question at a time on the phone's brain. On his iPhone 18 Pro Max
it "just crashes and closes" (the tab is killed). We have no device log; the owner has not yet said which brain, how
far it got, or whether it reopened on the paper. Build defensively against the likely cause — memory: a 2B/4B brain
+ a long generation + Mind's WebGL + the GYM worker over Safari's per-page limit, or a lost WebGPU device:
- **Heavy mode** (SMALL-GAPS family G): while a paper is being sat, the GYM worker pauses and Mind's draw loop eases
  to a still/low rate; both resume when the paper ends or is left. Reuse what exists (the GYM already has
  pause/KEEP AWAKE logic; Mind already has reduce-motion and hidden paths).
- **The brain for a sit**: sit on the smallest *downloaded* brain unless the owner explicitly chose a bigger one for
  school; a big brain gets a lower writing cap for extended answers (`TOKENS.writing` is the knob). Say which brain
  is sitting, in one plain line.
- **Survive it** (family D): the paper is saved after every answer (not every 5); a sit that closed Ghosty is
  remembered (copy the "closed-Ghosty mark" pattern from `apps/web/src/offline/brain.ts`'s big-brain load) so the
  next open resumes *on the paper, at the question it reached*, says so in one line, and offers the smaller brain.
  Handle WebGPU `device.lost`: save, say it plainly, offer to continue on the smaller brain. Never a blind retry
  into the same wall.
- **Tests**: a browser spec (extend `tests/school.spec.mjs` or add `tests/sit.spec.mjs` and put it in the loop in
  `.github/workflows/check.yml`): a sit starts on the mocked offline brain; the page is reloaded mid-paper; it
  reopens on the same paper at the same question with the one line; while sitting, the GYM worker is paused and
  Mind is in its low mode (expose minimal `window.__ghosty` test hooks if none exist); after the paper both resume.
  A unit test for the writing cap by brain size.

### 2. Never give up while a free model is seconds away — OWNER-ISSUES 64a
`apps/edge/src/llm/router.ts`: chat already waits up to ~45 s for a slot (`SHORT_WAIT_MS` per attempt, the outer
loop sleeps `r.waitMs` up to the deadline, throws a `RouterError` when `r.waitMs > left`). The owner sees: *"thinks
for ages, then says no free models right now, and one comes up in 0 seconds."* Find the real cause by reading the
wait loop and the cool/dead marks; the suspects are a slow-but-alive model treated as a failure, a stale cool/dead
mark ending the wait early, and the `waitMs > left` throw when the soonest slot is within a second or two of the
deadline. Requirements:
- When the soonest free slot is within the chat wait, **always sit through it**; never fail while a free model is
  within the wait. A model that is slow but answering is not dead.
- The "no free model" message is only ever said after the wait is truly exhausted, and names the real soonest time.
- Do not raise the prompt or the wait budget; this is correctness, not more spend.
- **Tests** in `apps/edge/test/router.test.mjs` (with the existing fakes): (a) a provider that frees up 1 s before
  the deadline → the chat waits and answers; (b) soonest = 0 s → no throw, it goes; (c) a response slower than
  `SHORT_WAIT_MS` but inside the deadline → counted as an answer, the provider is not marked dead.

### 3. The on-device choice fails CLOSED, never open — OWNER-ISSUES 72 (the trust model)
Settings → OFFLINE BRAIN has a mode: *Only when needed (no signal) / Always (never online) / Never*. "Always" is
the owner's "keep this on my phone" choice. Make it provably airtight, then bind it per task:
- With "Always": nothing of a turn ever leaves the phone — not the first try, not a retry, not the router's
  fallback, not the `held` no-model path in `apps/web/src/assistant/session.ts`. When the local model cannot
  answer, the task **stops with a plain explanation** ("I can't do this on the phone right now") and may *offer*
  the cloud — switching needs an explicit tap on that offer, never automatic.
- A per-message "on this phone only" switch in the composer (small, near the mic) that binds to *that task*
  including its retries and fallback, so a private question stays private even in "Only when needed" mode. If
  the plumbing for a per-task flag is not cheap, ship the airtight mode and say so in your report; do not fake it.
- **The marker test** (the commenter's method, add it to the loop): type a fictional statement with a distinctive
  marker word, force the on-device route, make the local model unavailable (the spec can stub it away), and assert
  (1) the task stops with the explanation on screen, (2) the marker never appears in ANY request leaving the page
  (`page.on('request')` over every `/api/*` call and the cloud chat path), (3) the cloud is reachable only by a
  tap. Put it in `tests/offlinebrain.spec.mjs` or its own spec in the loop.

### 4. A video on Telegram, and the confabulation it caused — OWNER-ISSUES 79
`apps/edge/src/telegram.ts`'s message type has `text`, `caption`, `photo`, `document`, `voice` and **no `video`**.
A video falls through to the text path, is silently dropped, and with only "what do you think of this kiddo" left
he resolved "kiddo" to a stored person (the owner's cousin) and invented a confident character reference.
- **Handle `video`, `video_note`, `animation` (and `audio`)**: never dropped silently. Telegram gives a video a
  `thumbnail`: send that one frame to the vision path (the same way a photo goes) with the caption as the question,
  and say honestly, in his voice, that he sees one frame and cannot yet hear the sound. For a TikTok/YouTube link in
  the text, the existing YouTube captions path (`integrations/youtube.ts`) covers YouTube; for TikTok resolve the
  public oEmbed (title, author, thumbnail) and say what he can and cannot tell from it. No ffmpeg exists in a
  Worker: do not pretend to transcribe a video's audio; say it can't yet. Sizes: respect the Bot API's 20 MB
  getFile limit and say so plainly when over it.
- **The confabulation guard** (the deeper fix, in `apps/edge/src/prompt.ts` / `agent.ts`): when an attachment could
  not be read, the model is *told* so in the turn ("the owner sent a video you cannot watch; you have one frame; do
  not guess what it shows") and the standing rules gain: never state facts about a person from memory unless the
  owner clearly asked about that person; when a referent is unclear ("this kiddo"), ask; the owner may address him
  as kiddo/son/mate — that is address, not a reference to someone else. SMALL-GAPS family A.
- **Tests**: `apps/edge/test/telegram.test.mjs` — a video update: the thumbnail goes to the vision path, the caption
  is the question, the honest line is in the reply, nothing throws; a video over the size limit is said plainly.
  `apps/edge/test/prompt.test.mjs` — the unreadable-attachment note and the new rules are present (the mock model is
  scripted, so we test the prompt and the handling, not an LLM's judgment).

## How to work (this is the budget — read it as law)
- Branch/worktree as given. One commit per item, message in the repo's style (what changed and why, in plain words).
  End every commit message with these two lines exactly:
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01PxJsFpBagxwsDNyyZqF76o`.
  Never put a model name anywhere else (not in code, comments, the PR title or body).
- **Validate locally before any push, all of it green:** `cd apps/edge && npm run typecheck && npm test` (the full
  brain suite, ~1,200 tests); `cd apps/web && npm run typecheck && npm run build`; then
  `node tests/preview-server.mjs &` and run every spec you touched or whose area you changed
  (`school`, `offlinebrain`, `telegram`, `direct`, `routec`, `thinkharder`, `bigbrain`, plus any you add) — the
  loop and its timeouts are in `.github/workflows/check.yml`. A spec you add goes into that loop.
- **Push once, open one pull request** against `main` when everything is green locally; do not push to kick CI,
  do not push partial work. The PR body: what each item fixes, how you proved it (commands and results), what you
  could not verify without the owner's phone, and anything you deliberately left out. Do **not** merge: the
  orchestrator reviews and merges.
- Conventions: the interface is built with `h()`/`svgEl` only, never `innerHTML`; every word on screen is in the
  first person, plain, his voice — never a raw error string ("Failed to fetch", "aborted", "undefined") reaches the
  owner; targets ≥ 44 pt; nothing new that can bill the owner; no new dependencies; keep the mock model
  (`apps/edge/src/llm/mock.ts`) scripted and extend it for new cases rather than loosening tests.
- Minimal diffs: what each failure needs and its test, no refactors, no drive-by polish — *except* SMALL-GAPS
  family A (no raw error strings) and K (empty/error states in his voice) on the surfaces you touch.
- If you find the real cause differs from the suspect named here, fix the real cause and say so. If something in
  this brief cannot be done as written, do the honest smaller thing and report it — never a stub that pretends.
- Report back with: what was built per item, exactly what was verified and how, the PR link, open questions for the
  owner (e.g. the real-phone steps for item 1), and your own read on anything shallow.
