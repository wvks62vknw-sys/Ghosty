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

## FIRST THING ON FRIDAY: STOP AND PLAN WITH THE OWNER (his request, 19 Oct)
The owner says loads of things are really bad right now. Before building anything:
1. Talk to him first. Ask him to walk through what is broken or bad, screen by screen. Write every point down in
   `docs/build-plan/OWNER-ISSUES.md`, which may already hold points he gave before Friday. Ask for screenshots or
   screen recordings where words aren't enough.
2. Check each point yourself on the live app and the preview, in his phone's size. Add anything else you find broken:
   run every browser spec and open every screen.
3. Build ONE plan together, in plain words, ordered: fix what is broken first, then the redesign to 9/10, then the
   iPhone 18 Pro Max work, then Waves D–F and the upgrades. Show it to him and get his yes before you start.
4. Then build in that order. Report progress against his list.

## NEW TARGET PHONE (the owner, 18 Oct): iPhone 18 Pro Max, 512 GB
By Friday the owner will be on an iPhone 18 Pro Max with 512 GB. Optimise everything for it as the main device:
- Check its real specs first (screen size in points, safe areas and Dynamic Island, RAM, Neural Engine/GPU, Safari
  version and which WebGPU / WASM features it has). Don't guess.
- Re-tune every layout and screenshot spec for its screen. The iPhone 13 (390 × 844) becomes a smaller-screen check that
  must still work, not the main target. Add the new viewport to the browser specs.
- Use the headroom: a much bigger offline brain and specialists (Wave F), larger on-device vision and depth models
  (measure, Lens, NAME), faster GYM training, higher-quality 3D and visuals. 512 GB means storage is no longer the limit
  for offline models, maps and Wikipedia, but downloads must still be asked for and stay on Wi-Fi.
- ProMotion (120 Hz): animations, the reactor and scrolling should feel smooth at 120 Hz, still honouring "reduce motion".

The owner's words: make everything "miles better, literally miles better, every single little thing ... every feature,
everything". So the upgrade pass on what is already built is not optional polish. Go through every feature, screen and
flow, and make each one clearly better: quality, speed, looks, accuracy, ease. Keep the same review discipline, keep
everything free, and keep every one of his rules above.

## The owner and how he works
- One non-technical owner, in the UK (Europe/London), using Ghosty as a Safari Home Screen app: an iPhone 13 until now,
  an iPhone 18 Pro Max (512 GB) from Friday (see above).
- Everything must be FREE: free tiers and keyless free APIs only, never anything that can bill him (check account
  types before sending tokens anywhere that can charge, e.g. Hugging Face ZeroGPU with a PRO account).
- He wants every feature to be a user-friendly mini-app: one main button, plain words, no setup, UNDO.
- Hard limits he set: never paste a Telegram token into chat; vehicle check is one plate, looked up only on tap,
  never stored, never the keeper; Spline only as an iframe with "Powered by Spline"; no face recognition, no Insecam,
  no scraping chat UIs, no key cycling; no AR for now; no money-making routes for now.
- Owner's taste: he wants to feel like Iron Man (Jarvis), but sleek, iPhone/MacBook-like, calm, premium — not
  "hacker". He loves his arc reactor (keep it detailed and make it better, never flatten it). Keep "Boss", every
  theme and the feature names he knows (God's eye, Threats, Reverse, Workshop…).
- PR #31 (everything up to 19 Oct: GYM 1+2, Stage 2, Stage 3, Waves A/B/C, redesign rounds 1–5) was MERGED by the
  owner on 19 Oct. Work on branch `claude/ghosty-ai-training-idwhp9` (restarted from main); open ONE new PR for all the
  remaining work below and drive it to green. He is happy to merge when it is done and green.

## Process that works (keep doing it)
1. Builders in isolated worktrees, one feature area each, with a brief like the BRIEF files here.
2. An independent adversarial reviewer per feature (fresh agent, read-only, writes probe scripts). It has found real
   problems every single time (billing risks, privacy leaks, wrong answers marked "checked", races).
3. Fixes back to the original builder, each with a test that fails on the old code.
4. Merge into the branch, run edge `npm test`, `npx tsc --noEmit -p tsconfig.json`, web `npm run check`, and the
   browser specs listed in `.github/workflows/check.yml` (loop them against `node tests/preview-server.mjs <port>`;
   WebKit at PLAYWRIGHT_BROWSERS_PATH where installed). Push. Watch CI and Gitar on the PR and fix what they find.
5. For design, an independent critic agent scores screenshots 1–10 ("would Apple ship this?"); iterate to ≥ 9.
Protected kernel files (agent.ts, keys.ts, index.ts, env.ts, tools/index.ts, .github, _headers, build scripts,
package.json) are edited only minimally, clearly marked, and reviewed. Prompt budgets in apps/edge/test/prompt.test.mjs
are never raised.

## CI notes (learned 19 Oct)
- The browser run (smoke) takes ~50 min; the brain suite ~10 min. If the brain suite suddenly runs for hours, something
  hangs: on 19 Oct it was a Sokoban problem generator looping for ever (fixed, with a test that every game makes every
  level's problem quickly). Speed the gym climbs up if CI keeps growing.
- Specs run late in the smoke loop see a slow, loaded runner: give replies generous waits (cited.spec waits 60 s).

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

Also merged and pushed on the branch (18 Oct, late):
- Wave A voice + memory: barge-in (talk over Ghosty), better voices (Workers AI Aura within a shared neuron ledger,
  apps/edge/src/neurons.ts), memory timeline with sources, edit, forget+UNDO 24 h, lock, patterns (health excluded).
- Wave B1 3D studio (reviewed, fixes merged): catalogue of ~4,700 CC0/CC-BY models (public/data/models3d.json, Poly
  Haven), text-to-3D and photo-to-3D via free Hugging Face Spaces, licence links on every credit. A Hugging Face token
  is only ever sent after whoami-v2 confirms a FREE account that cannot pay (fails closed). Hunyuan3D removed (licence
  excludes UK/EU). Workers AI drawing goes through the shared neuron ledger (gen3d.ts drawObject).
  OPEN: SYSTEM → KEYS text for the `huggingface` key lives in protected apps/edge/src/keys.ts and still needs this
  wording: "Use a token from a FREE Hugging Face account with no payment card. Ghosty sends it to the free GPUs only
  after Hugging Face confirms the account cannot be charged — PRO, Team and Enterprise accounts are billed for GPU time
  once their daily allowance runs out — so a token from a paying account is simply not used."
- Wave B2 measuring (reviewed, 13 fixes merged): zero-setup measure from one photo (Depth Anything V2 metric indoor
  small, on the phone, one-tap 50 MB download), A4-sheet scale, floor plan from a photo. Honest accuracy: ~12–14%
  median, about 1 in 10 off by ~40%; indoors 0.5–10 m only. Open: object outline can bleed into a same-colour floor.
- Wave C website builder: design system (12 palettes, 9 font pairs), 47 blocks, 14 business templates, free photos
  with credits, quality gates, six-step resumable `build_website` project, offline build on the phone. NOT YET
  ADVERSARIALLY REVIEWED — review it first (focus: honesty gates, photo licences, PAGE_CSP openstreetmap frame,
  screenshot services Microlink/thum.io never run for real, the prompt.ts wording trim). Forms open WhatsApp/email
  (published pages are sandboxed; a real form route would need a kernel change).

Being merged when this session ended (GYM part 2a only) (check `git log`; if it is not on the branch, recover it from branch
`worktree-agent-ae70cc05370cd9297` or redo it):
- GYM part 2a (checkers, chess, Go 9×9, poker, Sokoban, balance/lander). New learners: Go pattern instinct trained by
  self-play search (gofast.ts board), checkers n-tuple network. Known gaps: Go's "frozen passer of level L−1 must fail
  level L" only holds to level 3; checkers levels 9–10 gaps are within match noise (25–90k games to climb).
Also merged (late 18 Oct): the redesign rounds 1–5 (3b520df). Themes Graphite (default for new devices) and Reactor,
five floating tabs with progressive blur, large titles ("Good evening, Boss"), a Me sheet (Memory, Settings, System,
Links, Every screen), one back style, one chat entry, reply card, tinted-glass icon tiles, breathing reactor. Specs
use tests/nav.mjs (openDeck, openPanel). Critic score was ~5.5/10 after round 4; round 5 NOT yet scored — score it
first with an independent critic and continue until every screen is ≥ 9. Known rough spots: level-up toasts pile up
during fast training, empty rings on unstarted games look heavy, the God's eye chip starts off-screen, System's Status
card comes after the Brain group. The owner was sent the round-5 contact sheets on 18 Oct.

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
