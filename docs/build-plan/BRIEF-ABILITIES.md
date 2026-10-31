# BRIEF — ABILITIES, AND WHY HE DID THAT (batch 4 after the 30 Oct reset; starts when batch 2 or 3 lands)

You are building for Ghosty, the owner's personal AI (a Cloudflare Worker + Durable Object brain in `apps/edge`, a PWA in
`apps/web`, shared code in `packages/shared`). Read `docs/build-plan/HANDOFF.md` (the TOKEN BUDGET entry and the 30/31 Oct
entries) and `docs/build-plan/SMALL-GAPS.md` first. The owner's words are the spec: `docs/build-plan/OWNER-ISSUES.md`
items **68, 67b, 67d, 68c** (and 53's "one relevant unprompted line a day"), plus his words on 31 Oct: *"you're gonna have
to remind me of all the things he can do for me since I'll basically forget."*

**What this batch is.** Ghosty can do a great deal and the owner cannot hold it in his head. He wants a place in the app
that lists EVERY single thing Ghosty can do — always true, because it is generated from what is really there — with a box
where he types "can you …?" and gets either the ability (and a way straight to it) or an honest "not yet — want me to learn
it?", which becomes a learning goal. And a way to see WHY Ghosty did what he did, and WHAT he did today, so nothing is
invisible. Batches 2 and 3 are in flight (persona/mood; the shared mind/meter): do not edit `prompt.ts` (no new prompt
lines: derive the WHY trail from what already exists), keep `session.ts` changes to a small hook in new files, and do
not touch `persona.ts`, `theme.ts`, `mind.ts` or the report card beyond what is named here.

## The seams (extend them, do not add parallel systems)
- `apps/edge/src/tools/index.ts`: 24 tool groups, 41 tools, each group with `name`, `when` (always / a regex), `tools`,
  and an `about` line written for the model ("You can …"). This is the truth of what the brain can do; groups that need a
  key are off until SYSTEM → KEYS has it.
- `apps/web/src/shell/tabs.ts` (`tabs()` → `defs`), the hubs' instrument cards (`shell/hubcards.ts`) and the deck: the
  truth of what the app itself can do (the Lens modes, MEASURE, SPACE, the 3-D studio, the GYM's 22 games, SCHOOL, the
  offline brain, Night School, the library, Radio, Reverse, Threats, God's Eye …). `ui/sections.ts` `goToPanel(tab, title)`
  and `revealSection` are how to land on a thing.
- `apps/edge/src/tools/evolve.ts` (`self_audit`, `plan_upgrade`, `roadmap`) and `apps/edge/src/upgrades.ts`
  (`upgrades:ideas`, `loadIdeas`/`mergeIdeas`, the nightly `thinkUpgrades`): where a learning goal lives and is worked on.
- `apps/web/src/assistant/session.ts`: every reply's `activity` entries (a tool at work: label, state, detail) are the raw
  trail of WHY; `apps/edge/src/projects.ts` (Workshop projects, steps and history), `schedule.ts` (tasks run), the library's
  study progress and the day log (batch 3's `observe`, if it has landed — feature-detect; otherwise the logs that exist).
- `apps/web/src/library/meaning.ts`: the on-device index by meaning (optional for the "Can you…?" box; keywords otherwise).

## The items, in this order (one commit each)

### 1. The ABILITIES tab — OWNER-ISSUES 68
- A new screen (its own tab or a first-class panel reachable from the deck and the Me sheet), in his voice: **everything
  he can do, GENERATED**: an edge endpoint `/api/abilities` renders the tool groups (the `about` lines turned to "I can …",
  tool names shown as example asks, not identifiers; an off group says honestly "needs a key: SYSTEM → KEYS"), joined with
  the app's own abilities from the web registry (tabs, hub cards, Lens modes, GYM games, SCHOOL stages, the offline brain).
  Grouped the way he thinks: SEE · KNOW · BUILD · WATCH OVER YOU · PLAY · LEARN · DO FOR YOU · TALK. Each ability: one plain
  line, an example ask, and GO (lands on the screen via `goToPanel`, or puts the example into the chat). Listed among them,
  in plain words: "I can learn anything you teach me." Never a hand-written claim: if it is not in a registry it is not
  listed; if a tool is added later it appears by itself.
- A LEARNING section at the end: the goals from item 2 and the roadmap's open steps.
- Tests: an edge test that every tool group appears and off groups are marked; a browser spec `abilities.spec.mjs` (in the
  loop): the tab renders in his voice with the groups, every GO lands where it says, nothing sideways at 440/390, 44 pt.

### 2. "Can you …?" and "Want me to learn it?" — OWNER-ISSUES 68
- A box at the top of ABILITIES: he types "can you check my car's MOT" / "translate signs" / "beat me at chess" → a local
  search over the abilities (names, lines, example asks, tool descriptions) by keywords, and by meaning when the on-device
  index exists → the ability card and GO. No match → "Not yet. Want me to learn it?" → YES records a learning goal
  (`upgrades:ideas` with `from: 'owner'` and his words), shown in LEARNING and in SYSTEM → UPGRADES; the nightly upgrade
  pass reads owner-asked goals first; "no" just closes. The chat answers the same question the same way ("can you …?"
  typed in chat gets the ability or the offer: route it through the same search, no model call).
- Tests: the search with fakes (hits, near-misses, no match); the goal recorded and shown; the chat path.

### 3. WHY did you do that — OWNER-ISSUES 67d
- Every reply keeps its trail: the tools that ran (the `activity` entries), their arguments in plain words, their outcome,
  and the reason derived without asking the model (a template from the tool's group: "you asked about today's trains, so I
  looked them up live"; the model's own stated reason when its words contain one). A long-press or a small WHY on any reply
  opens a sheet; on Telegram, "why?" as a message answers with the last turn's trail in plain words. No new prompt lines.
- Tests: the trail built from fake activity entries; the sheet in a spec; the Telegram "why?" in telegram.test.mjs.

### 4. What did you do today, and the first run — OWNER-ISSUES 68c
- "what did you do today" (chat or Telegram) → the day's doings in plain words from what exists: tools run, tasks run on
  schedule, notifications sent, pages studied, the GYM's games, papers sat, things built — one short list, newest first,
  nothing invisible. No model call needed; the brain composes it.
- The first run (a fresh phone): three things he can do, said once, then never again — chosen from the registry.
- Tests: the day's list from fakes; the first-run line once in a spec.

### 5. Abilities revealed in context — OWNER-ISSUES 67b, 53
- When a turn's context plainly matches an ability the owner has never used — a number plate in the Lens, a worry typed, a
  YouTube link, a receipt photographed — ONE line offers it ("I can check that plate"), offered once per ability and then
  remembered (`abilities:offered`); at most one unprompted "did you know I can …" a day, never while he is mid-task, never
  twice for the same thing. A tap on it goes there.
- Tests: the offer once and remembered; the daily cap; nothing offered mid-task.

## How to work (the budget is law)
- Branch/worktree as given; FIRST verify your base commit as the prompt says. One commit per item in the repo's style.
  End every commit message with exactly: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01PxJsFpBagxwsDNyyZqF76o`. No model name anywhere else.
- **Do not push and do not open a pull request.** Commit on your worktree's branch and stop when everything is green
  locally; the orchestrator reviews, merges into the session branch and opens the one pull request.
- Validate before you finish: `cd apps/edge && npm run typecheck && npm test` (the full suite — report the pass count);
  `cd apps/web && npm run typecheck && npm run build`; the browser specs you touched or whose areas changed (at least
  `deck`, `nav`, `routec`, `telegram`, `upgrades`, `lens` and your new `abilities` spec, added to the loop in
  `.github/workflows/check.yml`) on your OWN preview port (`node tests/preview-server.mjs 8866 &`,
  `BASE=http://localhost:8866 …`; 8788, 8899 and 8877 belong to others — never kill them, never `pkill -f` a pattern your
  own command contains), after `npm run build` in apps/web. Playwright: block the service worker in specs that watch
  requests. Conventions: `h()`/`svgEl` only, never `innerHTML`; every word in his first-person voice; never a raw error
  string reaches the owner; ≥44 pt targets; nothing that can bill the owner; no new dependencies; the mock model stays
  scripted. Minimal diffs; no refactors.
- Report back: the branch and commits; per item what was built, what was verified and HOW (commands and results, spec
  "run clean" lines, the suite's pass count); design picks the owner may change (the grouping, the tab's name and place);
  anything shallow, and why.
