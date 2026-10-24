# Ghosty build plan — handoff

This file is how one build session hands over to the next. Read it all before doing anything. The BRIEF-*.md files
next to it are the briefs earlier builders worked from (paths inside them that start with /tmp/… pointed at a scratch
folder that no longer exists; ignore those paths).

## 23 Oct (Friday): this session, so far
- Branch state: `main` is PR #31's merge (ccd4fd0); this branch starts there and held only the 19–21 Oct notes. Local
  checkout fast-forwarded to 6d90d98. No PR is open yet: it is opened with the first code chunk after the owner's yes.
- Set up and checked: `apps/edge` installed (its postinstall builds the interface), both typechecks clean, Playwright
  installed at the repo root the way CI does (`npm install --no-save playwright@1.56.1`; Chromium only, no WebKit here).
- Facts looked up, not guessed: iPhone 18 Pro Max = 6.9-inch, 2868 × 1320 at 460 ppi → **440 × 956 CSS points**, ProMotion
  120 Hz, Dynamic Island, A20 Pro, 12 GB (GSMArena), iOS 27. WebLLM's prebuilt list (modelVersion v0_2_86) has
  Qwen3.5-0.8B/2B/4B, Qwen3-1.7B/4B, gemma-4-E2B, Phi-4-mini (memory 1.6 / 2.2 / 3.9 / 2.0 / 3.4 / 3.4 / 3.4 GB). Kaggle:
  ~30 GPU-h/week, 12 h/run (user-reported; phone-verified account needed).
- The ordered plan the owner asked for is `docs/build-plan/PLAN.md` (weeks 1–3, chunk sizes, what only he can do, my
  own ideas). The planning chat with him started on 23 Oct; nothing is built until he says yes to the Week 1 list.
- The browser specs hardcode 390 × 844 (29 of them); making 440 × 956 the main viewport is chunk A3 of the plan.
- Usage check-in, 23 Oct ~21:30 UK (the owner's numbers): session 31 %, all models weekly 9 %, Fable weekly 6 %. Plenty
  of room: the pipeline was widened to four builders. Every builder, designer and reviewer runs on Opus (high); Fable
  only plans, briefs, reviews and merges; Haiku is for the mechanical jobs (the first: the specs' viewport switch, A3).
- Merged 23 Oct late: route C built into the app (design-1), SCHOOL part 2a (banks + official papers), Mind as Home's
  centrepiece, fixes A2, the training pre-flight fixes. Running: SCHOOL 2b (training side), SCHOOL 3 (reading), the
  website builder's fixes (BRIEF-WEBSITES-FIX.md, from its adversarial review: must land before the next merge to main).
  Next: the specs' viewport switch to 440 × 956 (A3, a cheap model), the design polish pass (GYM's empty LEVELS card,
  WHAT'S NEW), the stopwatch (B3), the human voice (D6), the first real training run (E1) after the merge to main.
- Owner, 24 Oct ~00:30 UK: usage all models 14 %, Fable 9 %; route C becomes the ONLY look with colour themes
  (BRIEF-ONE-LOOK.md, after route C part 2 lands); a GitHub token is set (the self-edit trial can run after the merge
  to main); the new look reaches his phone only when PR #32 merges. Later that night (OWNER-ISSUES 31) he said: "don't ask me to merge when it's ready, just do it": a batch is merged into main by this session once CI is green and every piece in it is complete and reviewed.
- Merged 24 Oct early: SCHOOL 2b (exams on the free GPU, practice into training, the gap), SCHOOL 3 (reading), the
  website builder's 17 fixes (sites wait as a DRAFT until the owner confirms), the human voice. Small follow-ups still
  open: the training panel's KIND label for "voice" and the report card's `voiceLine(run)` (features/system, after the
  route C part 2 restyle lands); the Commons/Openverse user-agent contact address; cancel-after-publish and the 10-year
  /i/ pictures; the 60-reply voice fixture wants the owner's own blind check. Running: route C part 2 (every other
  screen), the school wiring (free-GPU button, the gap on the tab, OpenStax out of self-study).
- 24 Oct ~01:00 UK: merged into the branch after review: the stopwatch (SPEED part 1: `apps/edge/src/speed.ts`,
  `apps/web/src/core/stopwatch.ts`; `/status` now carries `speed`, a marked three-line kernel edit, shapes in
  `packages/shared/src/speed.ts`) and route C part 2 (every other screen, the Every screen deck, motion). CI on PR #32 at
  660d2c6: brain 1 of 1,015 tests failed (the browser run is killed by the same `npm test` before any spec runs); being
  found and fixed before the next push. Running: APPS (the app kit), the home designer's brain side
  (BRIEF-HOME-DESIGN.md), ONE LOOK (route C as the only design, Reactor and Graphite as colour themes; the extras wait
  for the owner's picks). Next after those: A3 (specs at 440 × 956, en-GB), the SPEED card in SYSTEM once a day of
  numbers exists, the home designer's SPACE button (part 2), courses (item 6), the small follow-ups above.
- The week's pull request is **#32** (claude/ghosty-ai-training-idwhp9 → main), opened 23 Oct; CI runs on every push to it.
  Merged into the branch on 23 Oct after review: STUDY at scale, GYM part 3, the training pre-flight fixes, the design
  mock-ups (routes A/B/C, then C2 which the owner is approving). Running: fixes A2, SCHOOL part 1. Next: the C2 build
  (BRIEF-DESIGN-BUILD-1.md) once the owner says yes to C2.
- Baseline audit, 23 Oct 18:30–19:20 UTC, on this branch at 6d90d98 (same code as main): brain suite 925/925 passed in
  821 s; browser specs 49 of 51 PASSED against `node tests/preview-server.mjs` (Chromium 1194); `scroll` and `safari`
  could not run here because WebKit is not installed (they always launch WebKit; CI installs it). Nothing the automated
  checks cover is broken. The owner's "really bad" points are therefore design and behaviour, not crashes: they are the
  Week 1 list. Per-spec timings and 218 screenshots are in the scratchpad (not kept).

## QUALITY SETTING AND CREDITS — read OWNER-ISSUES.md item 11 too: running out is NOT acceptable to him
EVERYTHING on Friday, without exception, is to be optimised for the best possible result for the fewest credits:
planning, research, design, building, testing, reviews and reporting. Before each step, ask: "is there a cheaper way
to get the same result?", and take it. (the owner's request, updated 19 Oct)
He wants the best possible quality WITHOUT burning through his weekly usage limit (last week ran out at 89%). So:
- Think at maximum effort where judgement matters: the planning chat with him, architecture, design and design
  critique, hard bugs, adversarial review, and the final check of every merge.
- Use Fable only where it is truly needed; pick the cheapest model that gives the SAME result for everything else:
  - Fable, max: the planning chat with the owner, architecture, ideas, design and design critique, hard bugs,
    adversarial reviews, the final check before any merge.
  - Opus, medium (or high for trickier code): building from a tight, already-decided brief; applying a fix whose
    cause is known; writing tests and specs to a clear description; merging branches; restyling to an agreed design.
  - Haiku: purely mechanical jobs, like finding files, summarising long CI logs, running a list of checks and
    reporting results.
  - Every cheaper-model build is reviewed by a Fable reviewer before it is merged. If a cheaper model's work needs
    redoing twice, give that kind of task to Fable instead: rework costs more than it saves.
- Spend credits on thinking, not on repetition. Last week's waste came from: several builders in parallel on separate
  branches that then conflicted (each re-merge cost a whole agent run); full test suites re-run many times (one bug made
  the suite hang for hours); browser checks re-run after every small push; design rounds before the owner had seen a
  screenshot. So:
  - Build in fewer, well-planned slices: at most 2–3 builders at once, on areas that don't share files, and merge each
    into the branch as soon as it is reviewed. A builder starts from the latest branch.
  - Run only the tests a change touches while working; run the full suite and the browser checks once before each push.
    Push in batches, not after every small fix.
  - Show the owner screenshots early (after the first pass of a screen), not after five rounds.
  - Give every agent a tight brief plus MAP.md, so it doesn't read the whole codebase.
  - If a run will clearly take hours, say so and ask the owner first.
- Before the week's limit gets close, stop, push, update this file, and tell the owner what's done and what's next.

## EVERY CREDIT-SAVING TECHNIQUE (the owner, 19 Oct: "every single thing out there"), without lowering quality
Context (every turn re-reads the whole conversation, so a big context makes every step cost more):
- Keep the main session's context small. Do exploration, log-reading and big searches inside subagents and keep only
  their conclusions. Compact or start a fresh session between big phases, with notes saved to files first.
- Never dump big outputs: grep and tail logs, read only the needed lines of a file, and never read generated files
  (assets.ts, bundles, models3d.json). Use MAP.md to go straight to the right file.
- Write the plan, decisions and briefs to files once, and point agents at them instead of repeating them.
Notifications (each one wakes the session and costs a turn; on 18–19 Oct dozens of Cloudflare and Gitar comment
edits each cost one):
- Don't subscribe to PR activity while building. Check CI and review comments once at the end of each chunk, in one
  look.
- Treat bot comment edits and preview-deploy updates as noise.
Work:
- Decide once and build once: settle the design from mock-ups before building screens; agree each feature's behaviour
  before coding it.
- Reuse what exists (the components, kits and tests already in the repo) instead of rewriting.
- Make independent tool calls in parallel, in one step.
- Give agents tight, complete briefs, so they don't explore or ask.
- Make the slow tests fast: gate the long GYM climbs behind GYM_FULL (the default run checks a short climb), so a
  full edge run takes minutes. Run only the affected tests while working.
- Push in batches; one CI run per chunk, not per fix.
- Take few, small screenshots; never re-shoot screens that haven't changed.
- Free disk space before it runs out (a full disk wasted several runs on 18 Oct).
- No polling loops or sleeps; wait for completion notices.
- Workflows with many agents only where they truly pay off. Prefer 1–3 well-briefed agents.

## DEADLINE (owner, 19 Oct): his Claude Max 20x plan ends on 14 November
That leaves about three weekly usage windows (the limit resets on Fridays at 19:00 UK): roughly 23–30 Oct,
30 Oct–6 Nov and 6–13 Nov. Plan the whole build to fit inside them, with the most important things first:
- Week 1: the planning chat; fix what's broken; quick wins (GYM auto-advance, STUDY at scale by topic, speed); pick the
  design and build the first screens; the school system and the learning loops, with nursery started.
- Week 2: the design across every screen; apps, courses, the home designer and the library pipeline into the offline
  brain; the upgrades of the biggest features.
- Week 3: iPhone 18 Pro Max tuning; upgrades everywhere else; polish, final reviews, docs. Keep a safety margin.
Merge into main at the end of EACH week (green CI, his OK), so nothing is left stranded on a branch when the plan ends.
Everything must keep working after 14 Nov with NO Claude subscription: Ghosty runs on free providers, and the school
training runs on free Kaggle GPUs. Write a plain-words guide for him on what runs on its own and what (if anything) he
needs to do.

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

## THE OWNER'S BAR FOR THIS BUILD (19 Oct, his words)
"Every small thing that I'm not mentioning should be literally hundreds of times better than it is right now. I
genuinely expect massive heaps of improvements everywhere." Go through EVERY feature, screen, flow, message and
default, not only the ones he names, and make each clearly, visibly better: quality, accuracy, speed, looks, ease and
depth. Keep a running list (docs/build-plan/UPGRADES.md) of what was improved and how much, with before/after evidence
(screenshots, measured numbers), so he can see the scale of it.

IDEAS ARE YOURS TOO: the plan you make with him should include your own best, most advanced ideas for EVERY feature,
and for the GYM and self-improvement especially — he wants ideas "miles better than me and you could even fathom".
Research the current state of the art first, and propose freely. The list below is only a starting point.

He also wants self-improvement and self-play reinforcement loops at a far more advanced level. Starting directions (all free, all measured, all with his rules):
- GYM: AlphaZero-style self-play (search + a learned policy/value guiding it) wherever it fits, curriculum that
  generates its own harder problems, league play against frozen past versions, and honest ground-truth measurement.
- The language brain: verifier-based RL on free Kaggle GPUs (rejection sampling / STaR / GRPO-style training on tasks
  with exact checkers: GYM puzzles, drills, code tests, tool-use replays), self-generated curricula, and more weeks per
  month if the free quota allows.
- Night School: study, self-quiz, find weak spots from the report card, then generate targeted practice for them.
- Tools and skills: learn from his 👍/👎 and from failed tool calls; propose better prompts, playbooks and checks, and
  keep only what beats the old version on a held-out test set.
- One dashboard (in the REPORT CARD) showing every loop: what it practised, what improved, and what was rejected.
SAFETY RAILS (non-negotiable): every self-made change must beat the current version on held-out tests it never trained
on before it is kept, can be rolled back with one tap, never touches the kernel (protected files, keys, billing,
permissions), never spends money, never sends his private data anywhere he hasn't approved, and any change to Ghosty's
own code still goes through the normal approval + review + CI. Improvement must be measured, never just claimed.

## RAISING GHOSTY (the owner's idea, 19 Oct): baby → nursery → school → SATs → GCSEs → college → university
What is and isn't possible, so you can plan it honestly with him:
- A brain that knows GCSE/university material cannot be grown from a literal baby on free GPUs: training a capable
  language model from zero takes huge amounts of computing and text. The offline brain therefore has to start from the
  best open model that fits the phone (it arrives already "grown up").
- But the school journey is a very good idea for how we TEACH, TEST and SHOW his growth (curriculum learning):
  - the real offline brain goes through Key Stages → SATs → GCSE → A-level/college → university → the whole library,
    in the best order (foundations first, each stage building on the last, revision of old stages so nothing is
    forgotten);
  - each stage ends in real exam-style papers he has never seen (with exact marking where possible, otherwise marked
    by a stronger model and spot-checked), and he must pass with top grades before the next stage;
  - after each stage, verified practice from that stage feeds the weekly training;
  - a "school report" screen shows his grades growing, subject by subject.
- "Little Ghosty", the literal baby, CAN be done as a separate, real thing: a tiny model trained from nothing on free
  Kaggle GPUs. Research such as TinyStories shows very small models can learn to babble, then form simple sentences,
  then tell short stories. The owner could watch him learn to talk for real and chat with him at each stage. Be honest
  that this little one won't reach GCSE level; the big brain is the one that sits the exams.
- Recommend the combined version to him: Little Ghosty for the real "from a baby" experience, and the big brain's
  school journey for the real smarts. Then let him decide.
- The owner then asked: "could we replicate it in the big brain?" Answer given (19 Oct): not literally. Wiping the
  big brain to a real baby would lose everything it knows, and free GPUs can't re-grow it. Options put to him:
  (1) the school journey on the big brain as real exams plus real training per stage (the real growth);
  (2) a "baby mode" where the big brain only acts like a baby (pretend; not recommended on its own);
  (3) Little Ghosty, the separate tiny model that really learns to talk from nothing.
  He decides in the planning chat.
- DECIDED by the owner (19 Oct): OPTION 1, the school journey on the big brain, with these rules:
  - STRICT LOCKING: only nursery is open at the start. Every later stage, and every library topic above his current
    stage, is locked until he passes the stage below. The library's "absorb everything" (OWNER-ISSUES 3) therefore
    absorbs only what his stage has unlocked. Tag every library item with its level.
  - PROPER EXAM RESULTS: real exam-style papers for each stage (the real structure, timing, question types and mark
    schemes of UK SATs, GCSE and A-level papers per subject, then university modules), held out and never trained on,
    marked against real grade boundaries (GCSE 9–1, A-level A*–E, degree classes). Marking must be exact where
    possible; written answers are marked by a stronger model against the mark scheme and spot-checked. He needs top
    grades to move up. Show the grades as a proper report card, not a single score. The owner wants OFFICIAL
    past papers where possible (19 Oct): it's personal and non-commercial, never sold, and must cost nothing. Use only
    papers the exam boards and the Standards and Testing Agency publish free on their own sites. Keep them private:
    never put them in a public repo or public dataset, and never redistribute them. Keep the source and licence noted
    for each. Fill gaps with self-written papers in the same format.
  - WHERE THE TECHNIQUES GO (the owner asked "before or after?"): neither. Recursive self-improvement, RLAIF,
    self-play loops and self-guided self-play are HOW he studies inside every stage. At each stage he:
    1. self-plays and invents his own practice at that level;
    2. gets AI feedback on his open answers (RLAIF);
    3. trains on what checked out;
    4. sits mock exams;
    5. finds his weak spots, and his training improves itself (recursive self-improvement);
    6. repeats until he passes the real stage exam.
    The GYM runs alongside at matching difficulty.
- EVERYTHING FEEDS SCHOOL (owner, 19 Oct): the GYM games, drills, Night School and every other loop count towards his
  schooling. Match the GYM's difficulty to his stage, and let reasoning, maths and logic practice there raise his marks.
- READING: give him a proper reading library for each stage:
  - age-appropriate books (public-domain children's and young adult classics from Project Gutenberg, and other free
    books);
  - free official textbooks and lessons (open textbooks such as OpenStax, Oak National Academy and other free UK
    curriculum resources), tagged by year group and subject.
  He can pick books to read at his stage, like a real pupil.
- READING AHEAD (the owner's own experience: in Year 2 he borrowed books from the Year 6 class): Ghosty may borrow
  BOOKS from a higher year if he proves he can handle them, by passing a short reading check at that level. This
  only unlocks reading; exams and stage progress still go strictly in order.
  The owner pointed out that he will probably pass any reading check, since the base model can already read. So make
  borrowing earned and limited, not a formality:
  - he can borrow only once he has top marks in his CURRENT year's reading and comprehension;
  - the check at the higher level is a real comprehension test with a high pass mark (questions about that book's
    level, never seen before);
  - he can borrow at most two years ahead;
  - borrowed reading never counts towards passing a stage.
- SPEED (the owner asked to speed everything up massively without losing quality):
  - placement tests: he may sit any stage's exam straight away; a top-grade pass completes that stage at once. The
    early stages he already knows should take minutes, not weeks. Training time goes only where he actually fails.
  - distillation: strong free online models write worked answers and explanations for his weak spots, and he trains
    on those that check out (this is also the RLAIF part).
  - efficient training (LoRA/QLoRA adapters, short focused runs) so each free GPU hour does more.
  - more free GPU time: Kaggle (~30 h/week) plus any other free sources, ONLY after checking each one can never bill
    him (no card on file, no paid tier).
  - where his phone can do useful work overnight (evaluation, retrieval indexing, small adapter updates), use it.
- Keep the human, non-AI way of talking (OWNER-ISSUES 12) part of every stage.

## NEW TARGET PHONE (the owner, 18 Oct): iPhone 18 Pro Max, 512 GB
By Friday the owner will be on an iPhone 18 Pro Max with 512 GB. Optimise everything for it as the main device:
- Check its real specs first (screen size in points, safe areas and Dynamic Island, RAM, Neural Engine/GPU, Safari
  version and which WebGPU / WASM features it has). Don't guess.
- Re-tune every layout and screenshot spec for its screen. The iPhone 13 does not matter any more (owner, 21 Oct):
  build and test for the 18 Pro Max only and spend nothing on the 13. Make its viewport the browser specs' main one.
- Use the headroom: a much bigger offline brain and specialists (Wave F), larger on-device vision and depth models
  (measure, Lens, NAME), faster GYM training, higher-quality 3D and visuals. 512 GB means storage is no longer the limit
  for offline models, maps and Wikipedia, but downloads must still be asked for and stay on Wi-Fi.
- ProMotion (120 Hz): animations, the reactor and scrolling should feel smooth at 120 Hz, still honouring "reduce motion".

The owner's words: make everything "miles better, literally miles better, every single little thing ... every feature,
everything". So the upgrade pass on what is already built is not optional polish. Go through every feature, screen and
flow, and make each one clearly better: quality, speed, looks, accuracy, ease. Keep the same review discipline, keep
everything free, and keep every one of his rules above.

## The owner and how he works
- One non-technical owner, in the UK (Europe/London), using Ghosty as a Safari Home Screen app: an iPhone 18 Pro Max (512 GB),
  in his hands since 21 Oct (see above).
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
  owner on 19 Oct. Work on branch `claude/ghosty-ai-training-idwhp9` (restarted from main); open a PR for the remaining
  work, drive it to green, and merge at the end of each week (see DEADLINE).

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
