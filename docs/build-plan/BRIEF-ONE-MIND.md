# BRIEF — ONE MIND, AND HIS OWN BRAIN (batch 3 after the 30 Oct reset; runs alongside batch 2)

You are building for Ghosty, the owner's personal AI (a Cloudflare Worker + Durable Object brain in `apps/edge`, a PWA in
`apps/web`, shared code in `packages/shared`). Read `docs/build-plan/HANDOFF.md` (the TOKEN BUDGET entry and the 30/31 Oct
entries with their lessons) and `docs/build-plan/SMALL-GAPS.md` first. The owner's words are the spec:
`docs/build-plan/OWNER-ISSUES.md` items **74, 75, 78, 65** (and 73 for what anticipation will need from this), plus his
line on 30 Oct: *"I just want the offline brain to be like one big awesome thing."*

**What this batch is.** Today Ghosty is forty features that each know a slice of him. The keystone is ONE shared mind
every feature reads and writes, so the Brief, the chat, Telegram, the GYM and SCHOOL all speak from the same knowledge of
him and his day — and under it, his own brain actually getting better every week: the weekly training that has never
completed (its install step fails on Kaggle), a meter that shows how much of his life his own brains already answer, and
memory that consolidates and forgets like a mind rather than filling like a log.

**Batch 2 is being built at the same time** (BRIEF-CONVERSATION: persona dials, the stop intent, conduct lessons, mood,
themes). Do NOT edit `packages/shared/src/persona.ts`, the CHARACTER block, the stop words in session.ts, `state/theme.ts`,
or `speak()`'s voice parameters. Where the mind should carry the mood or conduct rules, read them if present
(feature-detect the keys) and leave their authorship to batch 2. The prompt budget is shared: `prompt.test.mjs`'s size
guard is never raised, and item 1 must be budget-neutral or better.

## The seams (extend them, do not add parallel systems)
- `apps/edge/src/prompt.ts` `ClientContext` (now, tz, tab, name, location, screen, voice) and `systemPrompt()`'s CONTEXT,
  WHO <NAME> IS and WHAT YOU KNOW blocks; `agent.ts` runs the turn and calls it; `telegram.ts` builds its own turn.
- `apps/edge/src/profile.ts`: the profile (sections, summary), `reflect()` — the nightly reflection reads the day's OWNER
  turns and produces summary / facts / sections / diary / replace / drop; `memories.ts`: facts, diary, lessons, patterns
  (`noteDays`, `tallyDays`, `timeline`), forgotten items with their day, locks. `places.ts`, `spending.ts`, the agenda,
  `projects.ts`, the school state (`/api/school`), the GYM levels (`training.gym`), the library counts.
- `apps/edge/src/selftrain/cycle.ts`: `trainTick` (the weekly alarm), `runPlan`/quota, `hookRoute` (the notebook's door),
  `acceptReport`, `trainStatus`; the notebook `training/kaggle/ghosty_weekly.py` (`PIP_PINS` per base family,
  `retry(... pip install ...)` at ~line 1414) and `training/kaggle/build.mjs` (regenerates `selftrain/assets.ts` — always
  run it after touching the notebook; CI checks it with `--check`).
- `apps/web/src/assistant/session.ts`: every answer is an entry with `model` and `offline`/`private` marks ("On this phone ·
  offline", "Library on this device · offline", THINK HARDER, the website kit) — the raw material of the meter;
  `apps/web/src/core/stopwatch.ts` is the pattern for a kept tally (samples, KEEP, summarise); the REPORT CARD and the
  OFFLINE BRAIN panel (`features/system/reportcard.ts`, Settings → Offline brain) are where it shows.

## The items, in this order (one commit each; 1, 5, 6 and 2 for certain; 3, 7, 4 if the batch stays within reason)

### 1. The one shared mind — OWNER-ISSUES 74 (the keystone)
- `apps/edge/src/mind.ts`: **`mindSnapshot(storage, ctx)`** — one object, built once per turn/alarm, that every feature
  reads: `owner` (name, the profile's summary and top lines, the top facts by weight, principles/conduct rules if batch 2
  has stored them, mood if present), `now` (time, tz, where he is, which saved place that is), `today` (the next agenda
  items, the school stage and any paper in progress, the GYM's current game and last lesson, what the library learned
  today, a spending flag if one is due), `recent` (the last few episodes from the day log: what he did and asked, in one
  line each), `ahead` (what is coming in the next hours), `can` (the tool groups on). And **`observe(storage, ev)`** — one
  write path every feature uses to put an episode in the day log (a turn's gist, a tool's outcome, a game, a paper, a
  place reached, a thing built), which the nightly reflection (item 2) consolidates.
- **Wire it**: the chat's CONTEXT block is rendered FROM the snapshot (tight; replaces today's ad-hoc lines, budget-neutral
  or smaller); Telegram's turn uses the same snapshot; the Brief's morning line reads it; notifications and the GYM's and
  SCHOOL's first-person lines take the owner's name, his day and his last lesson from it. The one test of success: the
  chat and the Brief agree about "today" because they read one thing.
- Tests: `mind.test.mjs` builds a snapshot from fakes and renders the CONTEXT block; `prompt.test.mjs` shows the block
  comes from the snapshot and the size guard holds; `observe` lands in the day log; a browser spec (`brief` or `routec`
  extended) shows the same agenda item in the chat's context and on the Brief.

### 2. Memory that forgets well — OWNER-ISSUES 75(a)
- The nightly reflection becomes CONSOLIDATION: the day log (episodic, from `observe`) is kept ~14 days then compressed
  into the diary (one paragraph a day: what mattered); facts gain a `weight` (how often confirmed or used) and the
  reflection raises it when the owner repeats or relies on one; unconfirmed trivia DECAYS and is pruned after a few weeks
  — never a locked line, never one the owner wrote himself; the reflection writes one line of "what changed about him"
  (via `replace`). MEMORY shows the weight in words ("heard four times") and a small FADING list the owner can KEEP or let
  go, with UNDO. Tests: consolidation and decay with fakes and a faked clock; locks and owner-written lines untouched;
  `memory.spec.mjs` extended for FADING.

### 3. A self-model he reasons with — OWNER-ISSUES 75(b)
- `apps/edge/src/self.ts`: his own state in one shape — reliability per area (from 👍/👎 per tool group and the GYM's and
  school's results), the router's recent provider health, which brain is loaded on the phone and how big, the last
  mistake he owned (a conduct lesson if batch 2 stored one), his mood if present. ONE line in the prompt only when it
  matters ("I've been wrong on maths this week: check me"), and the Me sheet / STATUS says it in words. Tests: the line
  from fakes; the size guard; nothing said when nothing matters.

### 4. Timing — OWNER-ISSUES 75(c)
- Unprompted words are rare and well placed: a `speakFirst(snapshot, kind)` policy — he speaks first only for what the
  snapshot says matters (a threat near a saved place, a paper or reminder due, something he promised to watch), never in
  the owner's quiet hours (from his patterns), and a 👎 on a notification teaches a per-kind back-off. Tests: the policy
  table with fakes; quiet hours respected.

### 5. The weekly training runs for real — OWNER-ISSUES 78, 65 (the owner's "one big awesome thing" starts here)
- On 25 Oct at 23:08 the notebook stopped on Kaggle with: `CalledProcessError: Command '[... pip install -q
  transformers==5.5.4 peft==0.19.1 accelerate==1.13.0 huggingface_hub==1.10.1 safetensors==0.5.3]' returned non-zero exit
  status 1` on a Python 3.13 image (the `PIP_PINS_QWEN3_5` family). So the weekly run has never completed. Find the real
  cause: which pin does not exist or does not resolve for that image's Python and torch (check PyPI's requires-python and
  the wheels for each pin; prefer the image's own torch; a pin set per family that provably resolves on Python 3.12 and
  3.13). Make the install step fail in plain words naming the pin, not a stack trace, and make `trainTick`'s pre-flight
  and the REPORT CARD say that in his voice. Keep the qwen3 family's working pins. Run `node training/kaggle/build.mjs`
  after any change to the notebook (assets.ts) and `python3 training/kaggle/test_ghosty_weekly.py` (84 tests). You cannot
  run Kaggle from here: say exactly what the owner should see on the next weekly run and how to force one.
- Tests: the pins resolution logic (a table of family → pins, each checked against a recorded PyPI answer with fakes); the
  plain-words failure; the pre-flight line.

### 6. The independence meter and Sovereign Mode — OWNER-ISSUES 78
- Count every answered turn by WHERE it was answered — the phone's brain, the library on the device, THINK HARDER on the
  phone, the website kit, or the cloud (and which cloud provider class) — from the entries session.ts already writes, into
  a kept daily tally on the phone (the `stopwatch.ts` pattern) and a weekly total in the brain. Show it on Settings →
  OFFLINE BRAIN and the REPORT CARD in his voice: "This week 71% of what you asked was answered on your own brains (phone
  54%, library 17%). The cloud did 29%: mostly live facts and long writing." with the trend over weeks. **Sovereign
  Mode** = the existing "Always" made visible with the meter: while it is on, a list of what stopped for want of the cloud
  (the kept tasks that said "Nothing of it left the phone") so he sees exactly what still needs the cloud. Tests: the
  tally from fake entries; a browser spec for the panel and the card; the numbers add up.

### 7. The capability ledger — OWNER-ISSUES 65
- "What I learned to do this week": the GYM levels, the school stage, tools or solvers that joined, the training run's
  exam result, the meter's movement — one card on the REPORT CARD and the Sunday note (the LOOPS card has the numbers).
  Only ever more demanding: a level reached is kept. Tests: the card from fakes.

## How to work (the budget is law)
- Branch/worktree as given. FIRST verify your base commit as the prompt says. One commit per item in the repo's style.
  End every commit message with exactly: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01PxJsFpBagxwsDNyyZqF76o`. No model name anywhere else.
- **Do not push and do not open a pull request.** Commit on your worktree's branch and stop when everything is green
  locally; the orchestrator reviews, merges into the session branch and opens the one pull request.
- Validate before you finish: `cd apps/edge && npm run typecheck && npm test` (the full suite — report the pass count and
  the prompt size before and after); `python3 training/kaggle/test_ghosty_weekly.py`; `node training/kaggle/build.mjs
  --check`; `cd apps/web && npm run typecheck && npm run build`; the browser specs you touched or whose areas changed (at
  least `brief`, `routec`, `memory`, `telegram`, `offlinebrain`, `thinkharder`, `bigbrain`, `settings`, the report-card
  spec) on your OWN preview port (`node tests/preview-server.mjs 8877 &`, `BASE=http://localhost:8877 …`; 8788 and 8899
  belong to others — never kill them, never `pkill -f` a pattern your own command contains), after `npm run build` in
  apps/web. Playwright: once Ghosty's service worker controls the page, Chromium stops reporting requests and request
  events stall after a streamed reply — block the worker in specs that watch requests.
- Conventions: `h()`/`svgEl` only, never `innerHTML`; every word on screen in his first-person voice; never a raw error
  string reaches the owner; ≥44 pt targets; nothing that can bill the owner; no new dependencies; the mock model stays
  scripted (extend `apps/edge/src/llm/mock.ts`, never loosen a test). Minimal diffs; no refactors beyond the one
  consolidation item 1 asks for.
- If the real cause differs from the brief's suspect, fix the real cause and say so; if a thing cannot be done as written,
  do the honest smaller thing and report it — never a stub that pretends.
- Report back: the branch and commits; per item what was built, what was verified and HOW (commands and results, spec
  "run clean" lines, the suite's pass count, the prompt size before and after); what needs the owner (the next weekly run
  and what he should see; his keys if the pre-flight says one is missing); anything shallow, and why.
