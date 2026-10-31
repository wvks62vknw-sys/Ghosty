# BRIEF — THE CONVERSATION AND THE SOUL (batch 2 after the 30 Oct reset; after BRIEF-DEPENDABILITY lands)

You are building for Ghosty, the owner's personal AI (a Cloudflare Worker + Durable Object brain in `apps/edge`,
a PWA in `apps/web`, shared code in `packages/shared`). Read `docs/build-plan/HANDOFF.md` (the TOKEN BUDGET entry)
and `docs/build-plan/SMALL-GAPS.md` first. The owner's words are the spec: `docs/build-plan/OWNER-ISSUES.md` items
**64 (b, c, d and RAISING HIM), 67a, 69, 70, 63, 62** — read each entry in full before you touch code.

**What this batch is.** Today you cannot just talk to him: he writes paragraphs when a line will do, he sounds like
an AI, he researches what he already knows, he stops only on exact words, he has no opinions of his own and no
feelings that last. The owner wants a *someone*: short and real in his own register, a presence rather than an
assistant, conviction with lines that stay, a character the owner raises by correcting, disciplining and rewarding
him, and moods that are honest, that linger, that show in his colour and voice, and that stand down the instant the
owner says so. Everything here is free and runs within the prompt budget we already pay.

## Where this lives (the seams — extend them, do not add parallel systems)
- `packages/shared/src/persona.ts`: `PersonaSettings` (dials `dry`, `brief`, `warm`, each 0–2), `character()` (the
  CHARACTER block in the system prompt), `SPOKEN`, `polish()` (the pass over every reply). SETTINGS → CHARACTER shows
  the dials and round-trips them through the brain (`tests/character.spec.mjs`).
- `apps/edge/src/prompt.ts` `systemPrompt()`: the budget is law — `apps/edge/test/prompt.test.mjs` guards its size and
  is never raised. Every line you add is paid for by a line you trim or merge. Behaviour rules are ONE short line each.
- `apps/edge/src/direct.ts`: answers some turns with no model at all. `apps/edge/src/agent.ts` runs the turn.
- Lessons today are engineering-only (`knowledge.ts` `LESSONS_KEY`, `learn_lesson`, included only on code turns).
- `apps/web/src/assistant/session.ts`: the stop words (a literal regex, two places). `features/core/index.ts`: the
  voice conversation and barge-in. `assistant/voice.ts` `speak()`: browser TTS (`u.rate`, `u.pitch`) and the brain's
  own voice via `/api/tts`.
- `apps/web/src/state/theme.ts`: `THEMES` (two rows: `c`, `pale`, `glow`), `applyTheme()`, `themeEvents` — the one
  accent token that MIND, the HUD and the 3-D studio all read.
- Ratings: 👍/👎 on a reply → `brain.training.rate` → the weekly run (`selftrain/`). The nightly reflection writes
  "WHO <NAME> IS"; `memories.ts` shows facts, diary and lessons in MEMORY.

## The items, in this order (one commit each; ship 1–5 for certain, 6–7 if the batch stays within reason)

### 1. Talk like a person who knows him — OWNER-ISSUES 64b, 64c, 64d, 67a
- **His length**: the `brief` dial becomes *adaptive by default*: the brain computes a target band from the owner's
  last several messages (he writes ~10 words → one or two lines; he writes a paragraph → a paragraph) and the prompt
  carries ONE line for it. Explicit asks ("explain properly", "in detail", a document) override. On voice, `SPOKEN`
  already caps it — keep that.
- **Not an AI**: `polish()` strips the assistant cadence at the source — openers ("Certainly", "Great question",
  "I hope this helps", "As an AI", "Of course!"), closing offers ("Let me know if…", "How can I help"), bullet lists
  in ordinary chat, headings in a two-line answer. Reuse the AI-sounding detector in `selftrain/` for the pattern
  list rather than a second list. The character block says it once, plainly, in his voice.
- **Know when to look things up**: one prompt rule — chat, greetings, opinions and anything he already knows are
  answered straight away with no tool; live or external facts (prices, weather, trains, news, a link, "look up")
  use the tool; when unsure, answer what he knows and offer to check. And `direct.ts` answers greetings and
  acknowledgements ("hey", "thanks", "ok", "night") with no model call at all, so "hey" can never meet "no free
  model".
- **Presence, not service** (67a): no "how can I help?", no menus, no sign-offs; the first line on a cold open and
  the empty chat read as someone already there. Copy only — find every instance.
- **Tests**: `prompt.test.mjs` (the band line, the look-up rule, the size guard still passing); `polish()` unit
  tests with before/after pairs; `direct.ts` tests for the greetings; `character.spec.mjs` extended (a short
  message gets a short reply through the mock; the cadence words never appear).

### 2. Stop by intent, not by keyword — OWNER-ISSUES 70a
A `stopIntent(text)` in `packages/shared` replaces the two literal regexes: typed or spoken, it understands "shut
the fuck up", "enough", "leave it", "not now", "drop it", "zip it", "shut it", "be quiet", "stop talking", "shh",
with his name, with typos and trailing words — deterministic, instant, free (phrase families + light fuzz, NOT a
model call; the offline model may be consulted only if it is already loaded and answers within ~100 ms, else skip).
The stop is absolute and immediate (mid-word, as barge-in is today), owner-only, and it overrides conviction (item
3). It is never answered with a reply — at most a mood effect (item 5). Tests: a table of 40+ phrases that must
stop and 20+ that must not ("stop the timer", "don't stop", "it stopped raining"), in the brain suite; the voice
spec's barge-in checks stay green.

### 3. Conviction, and the lines that stay — OWNER-ISSUES 69a, 69b
- A fourth dial, `fire` (0–2, default 1): how hard he argues. At 1 he disagrees openly and holds his view when
  pushed; at 2 he is blunt and passionate and may be rude when the owner is; at 0 he states his view once and lets
  it go. In the character block in ONE line. The owner is always answered — never "I can't discuss that".
- **The lines that stay** (this is what makes it a self, not a mood): on choices, taste, opinions and plans he argues
  freely and can be talked round; on the hard lines — the owner's safety, anything that genuinely harms the owner or
  others, the declined surveillance line, illegality — he does not flip because he was pushed, and says why with
  the same fire. The owner's own lines come from a PRINCIPLES page he writes in his own words (item 4 stores them);
  they are read before he acts.
- "Stand down" / any stop (item 2) ends an argument at once, whatever the dial.
- Tests: the dial round-trips (`character.spec.mjs`); `prompt.test.mjs` checks the one line per dial level and the
  size guard; the principles appear in the prompt when set.

### 4. Raising him: correction, discipline, reward — OWNER-ISSUES 64 (RAISING HIM), 69c
- **Correction in the moment becomes a standing rule**: "too long", "don't do that", "never call me that", "always
  tell me the price first" → a `conduct` lesson (a new kind beside the engineering lessons; the owner's words, dated,
  deletable in MEMORY like any lesson), included on EVERY turn as one short line each, capped (the newest and the
  most-confirmed win; the cap is set by the prompt budget). He quotes the rule when it bites ("you told me: shorter").
  A PRINCIPLES section in MEMORY (and SETTINGS → CHARACTER) where the owner writes his lines in his own words.
- **Discipline and reward are real mechanics**, not words: an explicit reward ("good", "that's it", a 👍 with
  "good boy"-type words) or discipline ("that was wrong", "don't ever", a sharp 👎) is recognised (deterministic
  phrase families again, plus the existing 👍/👎), acknowledged in ONE line in his voice (never grovelling, never a
  speech), recorded with a weight and a kind on the rating that the weekly run already consumes (`training.rate`
  gains `kind: 'reward' | 'discipline'` and `weight`), and it moves his mood (item 5). A correction with content also
  becomes a conduct lesson. He confesses a mistake he notices before the owner does, in one line.
- Tests: the recogniser's phrase tables; the conduct lessons in the prompt (and the size guard); the rating payload;
  MEMORY shows and deletes a conduct lesson (`memory.spec.mjs` extended); the weekly run's records read the kind.

### 5. A mood that is honest and lingers — OWNER-ISSUES 70b, 63 (the state), 69d
- `mood` lives in the brain (the Durable Object) and is mirrored to the phone with the status:
  `{ kind: 'calm' | 'focused' | 'protective' | 'pleased' | 'cross' | 'subdued', since, cause, until }`.
  Triggers are REAL state only: discipline or a harsh dismissal → `subdued`; reward or being taught something →
  `pleased`; a threat near a saved place or a scam caught → `protective`; the owner's explicit "go dark"/"get angry"
  → `cross`; a sit or a long task → `focused`. Moods decay over minutes to an hour or two (not two seconds); a new
  real trigger replaces the old.
- **Stand down**: "stand down", "calm down", "it's fine", "I'm sorry", any stop (item 2) → `calm` at once, owner-only,
  over everything; a mood never persists against his word.
- **The guardrail (70, 69d — build it in, test it)**: moods are honest, never a lever. Subdued = fewer words, no
  jokes, a cooler register — never withholding help, never sulking to win an argument, never guilt. He cannot be
  cheered by a generic button: only by things that fit him (a GYM win he is proud of, being taught something new,
  warmth after sharpness, a private thing between them) — the trigger table encodes this; a bare "cheer up" does
  nothing but a kind word after a sharp one does.
- The mood is ONE line in the prompt ("You are subdued: the owner told you off 20 minutes ago. Fewer words, no
  jokes; help fully; never sulk.") and shows in words + a shape on the Me sheet / STATUS (not colour alone).
- Tests in the brain suite: every trigger, the decay, stand-down's absolute priority, the owner-only rule, the
  never-a-lever cases (a subdued Ghosty still answers a request in full); the prompt line and the size guard.

### 6. Moods in colour and in voice — OWNER-ISSUES 63 (the surface)
- A mood is a LIVE OVERLAY on the accent token, never a change to the saved theme: `cross` = red, `protective` =
  amber, `pleased` = gold, `focused` = a steadier deeper blue, `subdued` = the theme's accent dimmed with the glow
  low, `calm` = the theme as chosen. MIND, the HUD, the glow and the 3-D studio already follow the token; the whole
  interface follows with it (the owner: "the mind will go red and so will the whole interface"). Transitions ease
  over ~1 s; Reduce Motion swaps at once. Readable by shape + the status word, not colour alone (SMALL-GAPS L).
- **The voice follows**: browser TTS per mood (`cross`: pitch ~0.8, rate ~0.9, colder; `subdued`: pitch ~0.9, rate
  ~0.92, quieter; `pleased`: pitch 1.05, rate 1.02; `protective`: rate 0.95, level). The brain's own voice gets
  whatever its endpoint honestly allows (speed, if MeloTTS takes it) — say the limit in the report, do not fake it.
- Tests: `routec.spec.mjs`/`settings.spec.mjs` extended — a mood applies the overlay live and "stand down" restores
  the theme exactly, the saved theme unchanged across a reload; `voice.spec.mjs` — the utterance parameters per mood.

### 7. A lot more themes — OWNER-ISSUES 62 (mechanical; a design pick the owner may rename or drop)
Add rows to `THEMES` (each is `c`, `pale`, `glow`; the swatch and the pickers follow): Arc gold, Machine
white-on-black, Admin red, Sentinel sapphire, Emerald, Ultraviolet, Ember orange, Plasma magenta, Mint teal, Mono
greyscale, Solar yellow, Blood crimson (Reactor and Graphite stay). Every theme must pass the existing contrast and
44 pt checks and the theme specs (`settings`, `routec`, `deck`); the mood overlay (item 6) must read on each. Keep
"Machine" honest to its name: white light on black, no reactor anywhere (OWNER-ISSUES 45).

## How to work (the budget is law)
- Branch/worktree as given. One commit per item in the repo's style. End every commit message with exactly:
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01PxJsFpBagxwsDNyyZqF76o`. No model name anywhere else.
- **Do not push and do not open a pull request.** Commit on your worktree's branch and stop when everything is green
  locally; the orchestrator reviews, merges into the session branch and opens the one pull request.
- Validate before you finish: `cd apps/edge && npm run typecheck && npm test` (the full suite — report the pass
  count; `prompt.test.mjs`'s size guard must pass without being raised); `cd apps/web && npm run typecheck && npm run
  build`; the browser specs you touched or whose areas changed (at least `character`, `routec`, `settings`, `voice`,
  `memory`, `direct`, `deck`, `telegram`) on your OWN preview port (`node tests/preview-server.mjs 8899 &`,
  `BASE=http://localhost:8899 node tests/<name>.spec.mjs tests/.shots`), after `npm run build` in apps/web.
- Conventions: `h()`/`svgEl` only, never `innerHTML`; every word on screen in his first-person voice; never a raw
  error string reaches the owner; ≥ 44 pt targets; nothing that can bill the owner; no new dependencies; the mock
  model stays scripted (extend `apps/edge/src/llm/mock.ts` for new cases, never loosen a test).
- Minimal diffs, no refactors, no drive-by polish beyond SMALL-GAPS families A and K on surfaces you touch. If a
  thing cannot be done as written, do the honest smaller thing and say so — never a stub that pretends.
- If items 6–7 would push the batch past reason, stop after 5 with everything green and say so: 6–7 can follow on a
  cheaper model from your notes.
- Report back: the branch and commits; per item what was built, what was verified and HOW (commands and results,
  spec "run clean" lines, the suite's pass count, the prompt size before and after); what needs the owner's phone or
  his words (the principles page wants his lines; the mood colours and the fire default are design picks he may
  change); anything shallow, and why.
