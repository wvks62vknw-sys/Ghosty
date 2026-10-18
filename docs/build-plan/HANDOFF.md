# Ghosty build plan — handoff

This file is how one build session hands over to the next. Read it all before doing anything. The BRIEF-*.md files
next to it are the briefs earlier builders worked from (paths inside them that start with /tmp/… pointed at a scratch
folder that no longer exists; ignore those paths).

## QUALITY SETTING (the owner's explicit request)
The owner asked for "Fable max — best possible quality" from the session that continues this build. So: work at
maximum reasoning effort yourself, and launch EVERY subagent and workflow agent with model "fable" and effort "max"
(the Agent tool's `model` and `effort` parameters; `opts.model` / `opts.effort` in workflow scripts). Prefer
thoroughness over speed: independent adversarial review on every feature, design critic loops until every screen
scores 9+.

## The owner and how he works
- One non-technical owner, in the UK (Europe/London), using Ghosty on an iPhone 13 as a Safari Home Screen app.
- Everything must be FREE: free tiers and keyless free APIs only, never anything that can bill him (check account
  types before sending tokens anywhere that can charge, e.g. Hugging Face ZeroGPU with a PRO account).
- He wants every feature to be a user-friendly mini-app: one main button, plain words, no setup, UNDO.
- Hard limits he set: never paste a Telegram token into chat; vehicle check is one plate, looked up only on tap,
  never stored, never the keeper; Spline only as an iframe with "Powered by Spline"; no face recognition, no Insecam,
  no scraping chat UIs, no key cycling; no AR for now; no money-making routes for now.
- Owner's taste: he wants to feel like Iron Man (Jarvis), but sleek, iPhone/MacBook-like, calm, premium — not
  "hacker". He loves his arc reactor (keep it detailed and make it better, never flatten it). Keep "Boss", every
  theme and the feature names he knows (God's eye, Threats, Reverse, Workshop…).
- He does NOT want anything merged until the whole plan is built. All work goes on branch
  `claude/ghosty-ai-training-idwhp9`, PR #31 grows into the one PR he merges at the end. Keep it green.

## Process that works (keep doing it)
1. Builders in isolated worktrees, one feature area each, with a brief like the BRIEF files here.
2. An independent adversarial reviewer per feature (fresh agent, read-only, writes probe scripts). It has found real
   problems every single time (billing risks, privacy leaks, wrong answers marked "checked", races).
3. Fixes back to the original builder, each with a test that fails on the old code.
4. Merge into the branch, run edge `npm test`, `npx tsc --noEmit -p tsconfig.json`, web `npm run check`, and the
   browser specs listed in `.github/workflows/check.yml` (loop them against `node tests/preview-server.mjs <port>`;
   WebKit at PLAYWRIGHT_BROWSERS_PATH where installed). Push. Watch CI and Gitar on PR #31 and fix what they find.
5. For design, an independent critic agent scores screenshots 1–10 ("would Apple ship this?"); iterate to ≥ 9.
Protected kernel files (agent.ts, keys.ts, index.ts, env.ts, tools/index.ts, .github, _headers, build scripts,
package.json) are edited only minimally, clearly marked, and reviewed. Prompt budgets in apps/edge/test/prompt.test.mjs
are never raised.

## The plan and where it stands (as of 18 Oct 2026, end of day)

Merged and pushed on the branch (reviewed, tests green):
- Wave 0 + 0.5 (iPhone fixes, encrypted backup/restore, notification switches, AI quota engine) — merged to main as PR #30.
- GYM part 1 (10 self-play games) + part 2b (6 reasoning games: logic, mini-brain lab, bug hunt, escape rooms,
  fact-check, debate). Every level must be earned; mastery measured against ground truth.
- Wave A: one character on every channel (packages/shared/src/persona.ts, conservative polish filter, SETTINGS dials);
  Telegram voice notes in/out, photos, signed APPROVE/NOT NOW buttons.
- Stage 2: weekly self-training of the offline brain (Qwen3-0.6B) on free Kaggle GPUs, PRIVATE end to end (private HF
  repos, weights served to the phone through the brain at /api/w/<cap>/…), exam gate on the quantised model,
  rollback. Never run for real yet: needs the owner's Kaggle API token and a fine-grained Hugging Face token from a
  FREE account (SYSTEM → KEYS).
- Stage 3: THINK HARDER (test-time search on the offline brain, honest confidence, exact checks only when they truly
  check) + the honest REPORT CARD, wired to Stage 2 (report-card questions never trained on).

Finished by builders and being merged when this session ended (check `git log` on the branch; whatever is not on
the branch must be redone or recovered):
- GYM part 2a (checkers, chess, Go 9×9, poker, Sokoban, balance/lander). Known gap: Go's learner plateaus, so the
  "frozen passer of level L−1 must fail level L" rule did not hold above Go level 2; checkers top levels marginal.
- Wave A voice + memory: barge-in (talk over Ghosty), better voices (Workers AI Aura within a shared neuron ledger,
  apps/edge/src/neurons.ts), memory timeline with sources, edit, forget+UNDO 24 h, lock, patterns (health excluded).
- Wave B1 3D studio: catalogue of ~5,000 CC0/CC-BY models (public/data/models3d.json, Poly Haven), text-to-3D and
  photo-to-3D via free Hugging Face Spaces (Gradio client), credits with licence links. Review fixes: never send the
  HF token to ZeroGPU if the account can pay; Hunyuan3D-2 removed (its licence excludes the UK/EU); search ranking.
- Wave B2 measuring: zero-setup measure from one photo (Depth Anything V2 metric indoor small, on the phone),
  floor plan from a photo of a drawn plan or of the room. Accuracy is honest (~12% median, ~1 in 10 off by ~40%).
- Wave C website builder: design system, ~40 blocks, templates, free images, quality gates, autonomous process.
  Not yet adversarially reviewed when this session ended — review it first.
- Redesign (rounds 1–5): new themes Graphite (default for new devices) and Reactor, five-tab floating bar
  (Ask/See/Make/Learn/Plan) + "Me", hubs, command bar, iOS lists. Independent critic scores were ~5.5/10 after round
  4; round 5 addressed its list. Continue until every screen scores ≥ 9 with the critic. The owner has not yet seen
  rounds 4–5. Screenshot the real app and send them to him.

Still to build (in this order unless the owner says otherwise):
- Wave A remainder: finish the redesign; make sure navigation is easy (six areas, command bar, recents, back).
- Wave D: Lens live translation drawn over the sign; plant/insect/bird identification; food nutrition from a photo;
  photo tools (background remove, upscale, erase objects); YouTube link → summary with timestamps + quiz cards.
- Wave E: online-course style courses with a course map of what is mastered; exam mode with a timer; photograph
  handwritten work and get it marked; a confidence meter; saved places (home, work); gadget manuals found and kept in
  the library with step-by-step fixes and replacement parts.
- Wave F: the biggest offline model the phone can hold plus small specialists; offline voice, translation, maps,
  semantic search, offline Wikipedia, offline "eyes"; voice and eye fine-tunes; Night School (study while he sleeps);
  monthly retraining; spending sorted into categories, budgets and subscriptions.

## Also requested for the next session
The owner asked that the next session (a more capable model) also goes back over everything already built and
upgrades it where it can be made genuinely better — with the same review discipline, and without changing his
choices above.
