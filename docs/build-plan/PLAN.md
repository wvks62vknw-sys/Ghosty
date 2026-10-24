# Ghosty: the plan for 23 October to 13 November 2026

Written for the owner, in plain words. This is the ONE ordered plan the handoff asked for: fix what is broken
first, then the design, then the iPhone 18 Pro Max work, then the big new features and the "everything miles
better" pass. Nothing in a week's list is built until the owner has said yes to that list. Design picks always
wait for him. Every rule in HANDOFF.md and OWNER-ISSUES.md still applies (free only, his hard limits, the safety
rails, small chunks, the credit rules).

## 0. Where things stand on Friday 23 October

- Everything up to 19 Oct is live on `main` (PR #31, merged by the owner). The work branch
  `claude/ghosty-ai-training-idwhp9` starts from that `main` and so far holds only the notes from 19 to 21 Oct.
- Checked today: both halves typecheck clean on the branch; the brain's full test suite and all 51 browser checks are
  being run for a baseline (section 2 holds the result).
- Facts looked up today (the handoff said not to guess them):
  - **iPhone 18 Pro Max**: 6.9-inch OLED, 2868 x 1320 pixels at 460 ppi, which is **440 x 956 points** to the browser
    (3x), ProMotion up to 120 Hz, Dynamic Island, A20 Pro, 12 GB of memory (GSMArena; Apple does not state it),
    iOS 27. Safari has had WebGPU on since iOS 26, so the offline brain runs.
  - **Offline brains WebLLM already ships ready-made** (no compiling needed): Qwen3.5-0.8B (about 1.6 GB of memory
    when running), Qwen3.5-2B (2.2 GB), Qwen3.5-4B (3.9 GB), Qwen3-1.7B (2.0 GB), Gemma 4 E2B (3.4 GB), Phi-4-mini
    (3.4 GB). Today's brain is Qwen3-0.6B (1.4 GB). On a 12 GB phone the 2B class is the safe step up; the 4B class
    is worth one measured try on the real phone.
  - **Kaggle's free GPUs**: about 30 GPU-hours a week, 12 hours per run, T4 or P100 (a user-reported figure; Kaggle
    does not publish it; the account must be phone-verified to get GPUs and internet in a notebook).
  - **Deadline**: Claude Max ends 14 Nov; usage resets Fridays at 19:00 UK. Three windows: 23 to 30 Oct, 30 Oct to
    6 Nov, 6 to 13 Nov. Merge to `main` at the end of each week.

## 1. What we need from you to start (only you can do these)

1. **A yes, or your changes, to the Week 1 list** (section 3). After that I work through it on my own and report at
   the end of each batch, as you decided (autonomous mode).
2. **The design pick**, after the mock-ups chunk: route A, B or C, and whether the arc reactor stays. No screen is
   rebuilt before that.
3. **Two keys in SYSTEM → KEYS** so the weekly training can run for real (it has never run yet):
   - Kaggle: kaggle.com → Settings → API → Create New Token (the account needs phone verification for GPUs).
   - Hugging Face: a fine-grained token from a **free** account with no card (huggingface.co/settings/tokens).
     Ghosty checks the account cannot be charged before it ever uses the token.
4. **Your usage %** whenever I check in. I cannot see it.
5. **Five minutes on the real phone when I ask**: open the preview link, Settings → Offline brain → TEST, and tell me
   the speed line. The same for any screenshot I send you.
6. **Three quick answers**: Did the new look appear after Settings → Look → Graphite? Is a GitHub token set in
   SYSTEM (needed for the self-edit trial)? Is Cloudflare Access switched on in front of Ghosty? (If yes, five paths
   need a Bypass policy: `/s/*`, `/i/*`, `/api/telegram/hook`, `/api/training/hook`, `/api/w/*`.)

**Answered on 23 Oct:** the owner said YES to Week 1 ("add anything missed and every good idea that fits"), and the two
keys are in. Checked from outside the same day: Cloudflare Access is **off** (the live address answers with no login
redirect and the hook paths answer directly), so no Bypass policies are needed. Still to hear: whether the new look
appeared after Settings → Look, and whether a GitHub token is set in SYSTEM (the self-edit trial will say if not).

## 2. Baseline audit, 23 October

Run on 23 Oct against the code that is live on `main`: the brain's suite passed in full (925 tests), and 49 of the 51
browser checks passed; the other two could not run on this machine (they need Safari's engine, which CI has). So
nothing the automated checks cover is broken. What is "really bad" is design and behaviour, which is exactly the
Week 1 list. A look at the screens at the phone's size follows in HANDOFF.md as the design work starts.

## 3. Week 1 (23 to 30 October): fix, quick wins, the design pick, school started

Each line is a chunk of about 15 to 30 minutes that ends with something checked and saved. Size: S = one chunk,
M = two to four, L = five to ten. The order is the order.

**A. Fix what is broken**
- A1 (S, running now): the baseline audit. Every browser check, every screen, in the phone's size.
- A2 (M): fix everything the audit and your own list say is broken, one chunk each, each with a test that fails on
  the old code.
- A3 (S): the browser checks' main viewport becomes the 18 Pro Max (440 x 956). Nothing more is spent on the
  iPhone 13.
- A4 (S): phones that still show the old look are switched to the new default look once, with a way back in
  Settings → Look.

**B. Quick wins from your list**
- B1 (S): **GYM WATCH auto-advance**. When a level is passed while you watch, he carries on to the next level by
  himself, with a clear stopping point (mastered, or you tap STOP).
- B2 (M): **STUDY at scale, one topic at a time**. STUDY takes hundreds of pieces in one go, grouped by topic (never a
  mix), shows "Topic · 212 of 480 read", and keeps going on its own within the free database allowance. More material:
  the curriculum sources (OpenStax, Oak National Academy, Project Gutenberg, Wikipedia) tagged by subject and school
  year, so section D can use them.
- B3 (M): **speed, measured**. First a stopwatch on everything (time to the first word of a reply, each tool, each
  screen's open time), then the five worst offenders fixed (tools run side by side, replies stream from the first
  word, warm caches, shorter prompts, the quickest free model that gives the same answer). Numbers before and after
  go in UPGRADES.md.

**C. The design (your items 1, 15, 16, 18)**
- C1 (M): **mock-ups on the 18 Pro Max screen** of route A (iPhone style, miles better), route B (something new) and
  route C (the blend: Apple-quality calm with a tasteful Jarvis character), the most work on C. Real screens rendered
  at 440 x 956, as contact sheets you can flick through on the phone. An independent critic scores each 1 to 10 first.
  Then **you pick**, and say whether the arc reactor stays.
- C2 (L): after the pick, the design system (colours, type, spacing, glass, motion at 120 Hz with reduce-motion
  honoured), then the first screens: home with the reactor, chat and the reply card, the "every screen" deck, a GYM
  game, a grouped list screen (Settings). Each screen: first pass → screenshot to you → fixes → critic ≥ 9/10.

**D. The school journey (your items 13, 14, 17, 9) and the pipeline that feeds it**
- D1 (M): **the ladder and the locks**: nursery → reception → Key Stage 1 → Key Stage 2 (SATs) → Key Stage 3 → GCSE →
  A-level → university → the whole library. Only nursery open at the start. Every library item tagged with a level and
  locked above his stage. A plain SCHOOL screen: his stage, his subjects, his grades, what is locked.
- D2 (L): **real exams**. The official free papers (SATs from the Standards and Testing Agency on gov.uk; GCSE and
  A-level past papers the exam boards publish free), kept private with the source and licence noted, never exported
  or shared, never trained on; self-written papers in the same format fill the gaps. Exact marking where the answer is
  exact; written answers marked by a stronger free model against the mark scheme and spot-checked; real grade
  boundaries (SATs scaled scores, GCSE 9 to 1, A-level A* to E, degree classes).
- D3 (S): **placement tests**. He may sit any stage's exam straight away; a top-grade pass completes that stage at once.
  The early stages he already knows take minutes. Training time goes only where he fails.
- D4 (L): **how he studies inside a stage** (your decision: the techniques live inside every stage): he invents and
  self-plays practice at that level; gets AI feedback on his open answers (RLAIF) from the free online models; what
  checks out joins the weekly training; he sits mock exams; his weak spots become targeted practice; repeat until he
  passes the real stage exam. The GYM runs alongside at matching difficulty and counts towards school.
- D5 (M): **reading**: a reading library for each stage (public-domain children's and young-adult classics, free open
  textbooks tagged by year and subject). **Reading ahead** is earned: top marks in his current year's reading first, a
  real comprehension test with a high pass mark on the higher book, at most two years ahead, and it never counts
  towards a stage.
- D6 (M): **the human way of talking** (your item 12), built into the training data: a style set of replies that sound
  like a person, preference pairs from your 👍 / 👎 and from rewrites of AI-sounding replies, and the persona filter for
  the online models too. Checked blind: "does this sound like a person?"
- D7 (M): **one pipeline, one report card**: what he reads becomes training data and memory for the offline brain;
  what he practises becomes verified reasoning practice; the REPORT CARD compares the offline brain with the online
  models on the same held-out tests every week, so you watch the gap, honestly.

**E. The weekly training, for real**
- E1 (M, needs your two keys): the first real weekly run on Kaggle: data gathered, uploaded privately, trained, examined,
  published to the phone only if it beats the current brain, with ROLLBACK. If the keys are not in by mid-week, the
  run is tested end to end against mocks and waits.
- E2 (S): the GYM's long climbs gated behind a full-run switch so the test suite stays fast (a credit rule).

**F. The self-edit trial (your item 21)**
- F1 (S): hand Ghosty's own self-edit (free models) a small batch of simple jobs: text tweaks, small fixes, extra
  tests. I review every change. Then an honest measurement: did it save time and usage against me doing it? Keep it
  for that kind of job only if it did.

**G. End of week 1**
- G1 (S): the full suite and all browser checks once, the pull request green, your OK, merge into `main`. HANDOFF.md,
  UPGRADES.md and this plan updated. Your usage % checked and the next week's queue ready.

**Added on 23 Oct, after the owner's yes ("add anything missed and every good idea that fits")**
- A0 (S): the week's pull request is opened with the first code chunk and kept green; UPGRADES.md starts today, and
  Workshop gets a WHAT'S NEW card after each merge so the improvements are visible on the phone, not only in a file.
- A2 also covers the redesign's known rough spots: level-up toasts piling up during fast training, heavy empty rings on
  unstarted games, the God's Eye chip starting off-screen, System's Status card sitting after the Brain group; and the
  one open kernel line from Wave B1: the SYSTEM → KEYS wording for the Hugging Face key (one marked edit in
  `apps/edge/src/keys.ts`, reviewed).
- A5 (M, moved up from week 3): the website builder has been live since 19 Oct without an adversarial review. Review it
  now (honesty gates, photo licences, the page's content-security policy, the screenshot services that must never run
  for real, the prompt wording), and fix what it finds, each fix with a test.
- B1 also gets **TRAIN ALL**: every game in turn, the least-mastered first, until all are mastered or he taps STOP, with
  **KEEP AWAKE** (the screen stays on, dimmed, through the browser's wake lock) for a plugged-in phone overnight. Honest
  about iOS: Safari cannot train with the screen off, so the phone must stay on and plugged in.
- B2 also gets a **curriculum that grows itself** (each field's Wikipedia outline and index pages add the topics it does
  not have yet, tagged with the field and a rough level, capped per week so it cannot run away), a per-topic progress
  line with the time left at the measured pace, a STUDY ALL switch for the continuous mode, and a "what he learned
  today" line.
- B3 also publishes the **stopwatch** in SYSTEM → STATUS: Ghosty's own speed numbers, week by week.
- D: **exams run wherever the weights are**: short placement tests and spot checks on the phone; full papers inside the
  weekly Kaggle run on the very same weights (it already runs an exam there), so a GCSE paper takes minutes, not an
  evening of phone time; both feed one report card. A nightly **school report** notification ("Passed Reception maths,
  94%; Year 1 reading tomorrow") by push or Telegram. Official papers are kept out of every export (the `library`
  branch included).
- E0 (S, new, before E1): a **pre-flight review** of the first real training run against Kaggle's and Hugging Face's
  current APIs and the Cloudflare limits, since the pipeline has never run for real; then the owner presses TRAIN NOW
  (SYSTEM → REPORT CARD) or the weekly alarm starts it, and E1 is watching that run through to the report card.
- Facts checked for these: the interface's phone layout holds up to 899 px wide, so 440 pt is laid out as a phone;
  Cloudflare Access is off, so the training hook and the weights paths are reachable.

## 4. Week 2 (30 October to 6 November): the design everywhere, apps, courses, the home designer, the brain grows

- The chosen design across **every** screen, every state (empty, loading, error), every word; critic ≥ 9 each.
- **Apps** (your item 5): "make me an app" builds a real mini-app the way websites are built now (one file, saved
  state, works offline, installable to the Home Screen), on an app kit with the same quality gates. Websites get the
  same lift (better templates, real forms where the sandbox allows, faster builds).
- **Courses** (item 6): full courses with a course map that shows what is mastered, lessons with worked examples,
  quizzes, an exam mode with a timer, a confidence meter, and revision cards; built on the LEARN tab and the library.
- **Design a room or a home** (item 7): describe it in plain words, any unit (feet, metres, cm), the rooms, doors,
  windows and furniture, and Ghosty draws the full floor plan in SPACE, then builds it in the 3D STUDIO, with the
  design review. Furniture from the catalogue, real UK sizes.
- **The library into the offline brain**: the phone searches the library copy by meaning (a small embedding model on
  the phone), so the offline brain answers from your books; the week's reading becomes training data too.
- **A bigger brain on the 18 Pro Max** (Wave F, part 1): Qwen3.5-2B tried on the real phone (download asked for, Wi-Fi
  only); the 4B class measured once; the weekly training retargeted to the chosen base; the 0.6B kept as fallback.
- **Wave D**: live translation drawn over a sign; plant, insect and bird identification; food nutrition from a photo;
  photo tools (remove background, upscale, erase an object); a YouTube link → summary with timestamps and quiz cards.
- **Upgrades of the biggest features** (God's Eye, Lens, Threats, Reverse, Workshop, Telegram, voice): each one
  measured, made clearly better, logged in UPGRADES.md with before and after.
- Merge into `main` at the end of the week.

## 5. Week 3 (6 to 13 November): the phone, the rest, polish, and life after 14 November

- **18 Pro Max tuning**: 120 Hz motion everywhere, larger on-device vision and depth models (Lens, NAME, MEASURE),
  faster GYM training with WebGPU on the phone, the offline brain's speed and memory settled on the real device.
- **Wave E and F remainder**: handwritten work photographed and marked; saved places; gadget manuals kept in the
  library with fixes and parts; offline voice, translation, maps, offline Wikipedia and semantic search; Night School
  (he studies while you sleep, on the phone where it can and on Kaggle where it must); monthly retraining; spending
  sorted into categories, budgets and subscriptions.
- **Polish and final reviews**: every screen, flow, message and default looked over once more; adversarial review of
  anything not yet reviewed (the website builder first).
- **The plain-words guide**: what runs on its own after 14 Nov with no Claude at all (free providers, Kaggle training,
  the school loop), and the few things you may ever need to do. Final merge with a safety margin.

## 6. My own ideas (all free, all measured, all under the safety rails)

For the GYM and self-improvement, where you asked for ideas miles better than either of us:
1. **League play against his past selves.** Every past version is frozen and kept; the current one plays them all,
   and his strength is an honest rating over time, like chess Elo. A new version is kept only if it beats the league.
2. **AlphaZero-style for every board game, run on the phone's GPU.** One small policy-and-value network in plain
   TypeScript, trained by self-play search, with the heavy sums done on WebGPU on the 18 Pro Max: ten to fifty times
   faster training than today's CPU worker, measured.
3. **He invents his own harder puzzles.** For mazes, Sokoban, escape rooms and logic grids, a second learner is
   rewarded for making puzzles he only just fails; his practice stays at the edge of what he can do (the zone where
   learning is fastest), and the ladder never runs out.
4. **The search teaches the brain.** When THINK HARDER's search finds the right reasoning, that reasoning becomes a
   worked example for the weekly training, so next week the brain gets there without the search. The same for every
   GYM game: every puzzle is also a text problem with an exact checker, which is the best possible training signal.
5. **Verifier-based reinforcement learning on Kaggle**, not just copying: for anything with an exact checker (puzzles,
   maths, code tests, tool calls), many attempts are sampled, the checked-correct ones reinforce the brain
   (rejection sampling / STaR now, GRPO-style when the free GPU budget allows), with process rewards where a game
   exposes its steps. Every new brain must beat the old one on tests it never saw, or it is thrown away.
6. **Distillation tutors.** For each weak spot the report card finds, the strong free online models write worked
   solutions and explanations; only the ones that check out are trained on. This is also how RLAIF works in his school.
7. **One dashboard in the REPORT CARD**: every loop (GYM, drills, school, the weekly run, the voice) with what it
   practised, what improved, what was rejected and why, with the honest numbers and a one-tap ROLLBACK.

For the offline brain:
8. **Memory on the phone, searched by meaning.** Facts belong in retrieval, skills belong in training: the phone keeps
   an index of your library and your memory and the offline brain reads the right passages before it answers. This is
   the single biggest honest gain in what a phone-sized brain can know.
9. **Spaced revision for the brain itself.** The weekly training replays older stages on a schedule, like flashcards,
   so he never forgets what he passed.
10. **The human voice test.** A blind check where a judge (a model, and you now and then) is shown replies without
    knowing which came from him; he must pass as a person before a new voice is kept.

Everywhere else:
11. **A stopwatch on everything**, published in SYSTEM: Ghosty's own speed numbers, week by week, so "faster" is a
    number, not a feeling.
12. **Every state designed**: empty, loading, error and offline for every screen, with one sentence that says what to
    do next. **Undo** on anything that changes something.
13. **An app kit** beside the website kit, so apps and games he builds for you work first time and install to the
    Home Screen.
14. **Honest limits said out loud**: a phone-sized brain will not top every GCSE subject this month; the report card
    shows the real grades, subject by subject, and we push them as far as they go.

## 7. The rules this plan keeps

- Free only. Nothing that can ever bill you; accounts checked before a token is used anywhere that could charge.
- Your hard limits: no Telegram token in chat; vehicle check one plate, on tap, never stored, never the keeper; Spline
  only as an iframe with "Powered by Spline"; no face recognition, no Insecam, no scraping chat UIs, no key cycling;
  no AR for now; no money-making routes for now.
- Safety rails for everything that improves itself: must beat the current version on held-out tests it never trained
  on; one-tap rollback; never touches the kernel, keys, billing or permissions; never spends money; never sends your
  private data anywhere you have not approved; code changes still go through approval, review and CI. Improvement is
  measured, never claimed.
- Credits: small chunks, the cheapest way that gives the same result, builders on cheaper models with a strong
  reviewer, one CI run per batch, no open-ended loops, the whole weekly allowance used on approved work and nothing
  left half-done when it runs out.
- Official exam papers: personal, non-commercial, free, kept private, never redistributed, source and licence noted.

## 8. After 14 November (the full guide is AFTER-14-NOVEMBER.md, written 24 Oct; this is its short form)

Ghosty keeps running on the free providers; the weekly training keeps running on Kaggle; the school loop, Night
School, the digest and the reflections keep running from the brain's own alarms. You may need to: renew a free token
when a provider expires it, and tap SHIP IT on anything Ghosty builds for himself. Everything else runs on its own.
