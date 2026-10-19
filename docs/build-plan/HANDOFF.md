# Ghosty build plan — handoff

This file is how one build session hands over to the next. Read it all before doing anything. The BRIEF-*.md files
next to it are the briefs earlier builders worked from (paths inside them that start with /tmp/… pointed at a scratch
folder that no longer exists; ignore those paths).

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
- Keep the human, non-AI way of talking (OWNER-ISSUES 12) part of every stage.

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
