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
- The browser specs run at the owner's 440 × 956 in en-GB / Europe/London (`PHONE`, `UK` in tests/nav.mjs; A3, merged 24 Oct); specs that check a second size on purpose keep it.
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
- 24 Oct 02:00–03:00 UK, the owner awake: the Every screen deck is his one design complaint ("like app icons"; then
  "no reason to tap and find out all the crazy things"): three rounds of mock-ups (docs/build-plan/mockups/deck/,
  OWNER-ISSUES 32–34), his pick "H with F's pictures and G's information and prompts", now being built
  (BRIEF-DECK-BUILD.md: tap-to-find-out cards, miniatures of the real screens, capability rows and example prompts,
  TRY THIS NOW, the "Go to, or ask…" pill; the icon language without app icons everywhere). He reaffirmed: merge the
  pull request myself when it is ready, never wait for him, and keep going. Merged into the branch after review:
  the home designer's brain side (`design_home`, the `homeplan` group) and APPS (the app kit, `build_app`, the apps
  spec in CI). CI failures on PR #32 fixed at the cause (self-check, notebook checks, cited spec, reminder toast).
  Running: ONE LOOK (route C only, themes), the deck build. Next: the home designer's part 2 (a SPACE → DESIGN MY HOME
  button and a client event carrying the plan: only ~280 characters of a tool result reach the interface), A3 (specs
  at 440 × 956, BRIEF-A3.md, after the deck and one-look builds land), the SPEED card, courses (item 6), `build_app`
  as a Workshop project (projects.ts/protocol.ts), a `mock.ts` phrase so a chat-flow spec can call build_app.
- 24 Oct 03:00–07:00 UK: the night's CI loop on PR #32: every failure found on the quiet runner fixed at the cause
  (the self-check's false alarms, the notebook checks without numpy/pandas, cited on route C, the reminder toast, the
  selftrain and route C checks, the clock-change day in the daily-job test, 40 px buttons, Home's chips on a shorter
  phone, the chat bar in the conversation view). Finished and reviewed, waiting to go up as the NEXT pull request
  once #32 merges: the deck (worktree-deckbuild) and ONE LOOK (worktree-onelook), being merged together with their
  conflicts resolved in worktree-merge33 (a merge builder; every spec re-run there). Lessons: a builder's preview
  server port must be unique (a spec run hit the one-look server on 8830 and reported that build's state); each
  push restarts CI (about 65 minutes for the browser run now), so pushes are batched after a local run of the specs
  a change touches. Next: PR #33 (deck + one look), A3 (BRIEF-A3.md), the SPEED card, courses (item 6), the extras
  for one look once the owner picks (OWNER-ISSUES 28), `build_app` as a Workshop project, Library's "on this phone"
  live line on the deck, a real-device iOS check of the mini-apps' install and offline.
- **24 Oct 09:12 UK: PR #32 MERGED into main** (merge commit 63a7842) once every check was green on 547c257, as the
  owner authorised. It carried the whole Week 1 batch INCLUDING the deck and ONE LOOK (not a separate #33: they went
  in together once their combined worktree passed every spec). Cloudflare deploys main by itself; the owner's phone
  gets it on its next open. The branch continues from main; the next pull request opens with the next code chunk.
  Told the owner: what is live, TRAIN NOW (SYSTEM → OFFLINE BRAIN TRAINING → TRAIN NOW) for the first real weekly
  run, and the theme extras to pick from (OWNER-ISSUES 28). Next: A3 (specs at 440 × 956, en-GB), the SPEED card
  once a day of numbers exists, courses (item 6), the self-edit trial jobs (F1), `build_app` as a Workshop project.
- 24 Oct 11:00–12:30 UK: **PR #33** opened at 11:04 (A3: the specs at 440 × 956, en-GB). Its first run's only failure
  was WebKit's scroll spec on the Lens page: at the 18 Pro Max height the "No camera on this device" toast sits on the
  lower-middle probe point, and a wheel that starts over a toast moves nothing in WebKit's layer hit test (though
  elementFromPoint looks straight through it: toasts are pointer-events: none). Fixed in the spec: toasts are cleared
  before a page is measured and before every swipe (359a7df). Merged into the branch after review and pushed with it:
  `build_app` as a Workshop project (projects.ts kind `app`, five steps, pause with the reason, RESUME, UNDO; the
  preview server's `/__test/blip` hook) and the SPEED card (SYSTEM → STATUS, `features/system/speed.ts`,
  `Router.mockTimed` under MOCK_LLM=1, tests/speed.spec.mjs in the CI loop). Owner at ~12:30 UK: usage all models
  30 %, Fable 19 %; "do every single thing we talked about… now" (OWNER-ISSUES 36): nine builders run in parallel on
  the Week 2–3 list (courses, Library by meaning, Lens names living things and meals, the photo tools, the website
  builder's lift, saved places and spending, marking handwritten work and gadget manuals, Night School and monthly
  retraining, the GYM's next level), each in its own worktree on its own preview port; queued behind the machine
  (4 cores, load 8: the limit is the machine, not credits): a bigger brain (BRIEF-BIGGER-BRAIN.md), undo everywhere and
  offline translation (BRIEF-UNDO-OFFLINE.md), then the per-feature upgrade pass (BRIEF-UPGRADE-PASS.md). Each merge
  is reviewed here first; kernel lines the builders need (keys, tool-group words, FEED_HOSTS, the CI loop's spec
  names) are added here, marked. Lesson: a check-in on a long CI run is armed for after the run's usual length.
- 24 Oct ~13:00 UK: merged into the branch after review: FULL COURSES (item 6; BRIEF-COURSES.md; tutor.ts, the LEARN
  tab, `packages/shared/src/learn.ts` pure helpers shared by both halves; 24 tutor tests, the learn spec). No kernel
  line was needed. Goes up with the next pull request once PR #33 has merged.
- 24 Oct ~13:00 UK: merged after review: SEARCH BY MEANING on the phone (OWNER-ISSUES 9; BRIEF-MEANING.md): the
  vendored WebLLM 0.2.85 can embed (no new package), snowflake-arctic-embed-s pinned to one commit, its 3.7 MB
  compiled code vendored under public/vendor/webllm/libs; one departure from the brief, on purpose: searches go by
  meaning from 98 % indexed (the newest few by their words, said in the small print) because a strict fallback flipped
  nearly every search to keywords while study notes kept arriving. Kernel line: `meaning` in the CI loop. Unmeasured:
  indexing speed and memory on the real iPhone (about 240 MB of graphics memory beside the brain, freed before it loads).
- 24 Oct ~13:15 UK: merged after review: Lens NAME IT and WHAT'S IN IT (BRIEF-LENS-NAME.md). Kernel lines added, marked
  `[lens]`: the `plantnet` key (optional; tested against Pl@ntNet's daily quota endpoint) and `identify_plant` in the
  lens group's words. The prompt budget was met by trimming the "Fresh knowledge" line in prompt.ts (worst case 5,496 of
  5,500: four characters left, so the next always-on words must come out of something else). Known edges: a PLANT ask
  spends one of the day's 30 picture shares and holds the photo for seconds; the tool reads any held picture id, so a
  mis-call by the model would forget that picture (low risk: the question names the id). The owner must add the
  Pl@ntNet key (SYSTEM → KEYS, free) before PLANT works; BIRD / INSECT / OTHER and meals work with the Gemini key.
- 24 Oct ~13:35 UK: merged after review: MARK MY WORK and GADGET MANUALS (BRIEF-MARK-MANUALS.md). Kernel line, marked
  `[manuals]`: the gadgets group's words (manuals, rating plates, fault codes, the appliances). The library's PDF reader
  moved to `packages/shared/src/pdf.ts` so the brain can read a manual itself (capped at 20 MB and 240 pages, tested
  only with a 12-page stand-in): the free plan's CPU on a big real manual is unmeasured; if it fails, the phone should
  read the PDF the way SCHOOL's official papers are read (an upgrade-pass item). Both builders this hour paid for a new
  tool name by trimming prompt.ts (TODAY's line; a chain example): the combined budget is checked by prompt.test.mjs.
- 24 Oct ~14:10 UK: merged after review: NIGHT SCHOOL and the monthly retrain (BRIEF-NIGHT-SCHOOL.md). No kernel line.
  The first real monthly retrain can only be judged on Kaggle (the first Friday of November, or TRAIN FROM SCRATCH);
  Night School's wake lock and charging state need the real iPhone (iOS has no battery API: the card says so).
  Also merged this afternoon: the laptop layout fix (Home from 900 px) that run 220's layout check caught.
- 24 Oct ~14:30 UK: merged after review: PHOTO TOOLS (BRIEF-PHOTO-TOOLS.md; wave D's last Lens item). Kernel lines,
  marked `[photo]`, in tools/index.ts: the import, `...photoTools` in CORE and the `photo` group. The new always-on
  name `photo_tool` cost 15 characters over the 5,500 plain-turn budget (worst case: a Telegram voice note); paid for by
  trimming the PICTURES line by 37 characters (prompt.ts says so in a comment), never by raising the limit. Free Spaces
  only (BRIA RMBG-1.4, Real-ESRGAN, LaMa), a token only to ZeroGPU Spaces; no face recognition and no face editing; the
  Gradio fix for sleeping Spaces also mends the 3D studio. Merge conflicts with the Lens (living cards, MARK) and the
  manuals stand-ins were resolved by keeping both sides. Unmeasured: real Space queue times at a busy hour (the sheet
  shows the queue place and says "try again in a minute" when one is asleep or over its limit).
- 24 Oct: a lesson for anyone running specs here: build a side brain bundle OUTSIDE the repo (the scratchpad), never
  under `apps/edge/test/`: the brain suite's self-check test walks apps/, packages/ and tests/ (skipping only
  node_modules, .git, dist, .build, .wrangler-dry) and flags a 48,000-line bundle as a file of Ghosty's that fails the
  checker. The same test also fails while a merge is half done (conflict markers unbalance the brackets): finish the
  merge before judging the suite.
- 24 Oct ~14:25 UK: the plain-words guide for life after 14 November exists (AFTER-14-NOVEMBER.md; PLAN section 8 points
  at it). Written from the code as it stands; a line to add whenever a merge changes what runs on its own.
- 24 Oct ~14:50 UK: merged after review: GYM IDEAS (BRIEF-GYM-IDEAS: league, edge puzzles, `star` records, LOOPS). No
  kernel line. The training assets (`selftrain/assets.ts`) were regenerated from the merged notebook with
  `node training/kaggle/build.mjs` (never edited by hand); the notebook's tests pass (54, 9 skipped without torch). Not
  built, by the builder's own account: league play for poker and trust; edge puzzles for logic, tiles and countdown;
  no measurement yet that edge practice speeds learning. Also found while the suite ran: run 223 failed three specs
  beyond the laptop check (NAME's `.lenssel` locator met the Lens's hidden living card; the backup spec named an old
  database version; the direct spec wanted Rex on the first memory line while the Lens's SAVE had remembered a robin
  first): all three mended in the specs, each passing against the merged preview. Lesson: a shared preview carries
  state from spec to spec; a spec must not assume it is first.
- 24 Oct ~15:10 UK: merged after review: THE WEBSITES LIFT (BRIEF-WEBSITES-LIFT). Kernel line, marked `[sites]`: the optional
  `form_endpoint` key in keys.ts. Forms send for real only to `https://formspree.io/f/<id>` (checked by `formTarget`, again
  on every serve; the page policy's `form-action` opens to that one origin only when the address is set; Web3Forms left out
  because its post-send redirect would be blocked by a one-address policy). Not done, by the builder's account: an
  og:image for kinds without photos (cv, invite, club, launch); a request with no business name gets a title like
  "Website: stourbridge-club"; the What's New line. The builder could not reach Wikimedia (HTTP 429 here), so its
  template screenshots show tinted placeholders where photos go.
- 24 Oct ~15:20 UK: merged after review: SAVED PLACES and SPENDING (BRIEF-PLACES-SPENDING). Kernel lines, marked `[places]`,
  in tools/index.ts (import, CORE, two groups). The prompt budget needed 81 characters: the chain example, TIMES' example,
  BUILDING THINGS' list and "in your own voice" came out of prompt.ts (its comment lists them); worst case now about 5,470
  of 5,500, so the next always-on tool name needs another trim. Not done, by the builder's account: statements through
  the Library's ADD (the Agenda card is the one route); no WebKit run of the two new specs. The builder's full suite had
  two timing misses under load in untouched tests (design 1,019 ms of 1 s; the 15-puzzle 204.7 ms of 200), both passing
  on a re-run.
- 24 Oct ~16:20 UK: pushed to PR #33 as one batch after the final checks on this exact tree: the brain suite 1,152 of 1,152;
  the websites, sites, studiomake, places, spending, journey, agenda, memory, photo, name, backup, direct, THINK HARDER and
  meaning specs clean against a fresh preview; the GYM and night specs earlier on the same code. Run 224 (the previous
  head) failed name, direct, backup and meaning: all mended in the specs (above). CI's smoke loop now has 60 specs.
- 24 Oct ~16:30 UK: the UPGRADE PASS (BRIEF-UPGRADE-PASS.md) started with God's Eye (worktree `godseye`, port 8886). Order
  for the rest, one or two at a time as the machine allows (4 cores): Threats, Lens, Telegram, voice, Brief, Markets,
  Radio, Reverse; then Memory, Agenda, Workshop, System, Settings and Library once the undo and bigger-brain builders
  are merged (they are in those files now). Each builder gets its own scratch folder (`scratchpad/<name>/`): two
  builders overwrote each other's files in the shared one today.
- 24 Oct ~16:40 UK: the BIGGER BRAIN (BRIEF-BIGGER-BRAIN: Qwen3 0.6B / Qwen3.5 2B / Qwen3.5 4B to choose in SETTINGS →
  OFFLINE BRAIN, the weekly training following the chosen base) reported done on `worktree-bigbrain`, but it conflicts
  with Night School's monthly retrain in cycle.ts, the notebook and their tests (three builders changed the same
  functions). A merge builder is reconciling it inside that worktree (the merged rule: a weekly run trains on the brain in
  use of the chosen base; the monthly retrain on the chosen base's stock model over its kept weeks; a base switch starts
  a fresh chain; the 4B waits for both kinds). It is merged into the branch only when every test of both sides passes.
  Kernel line it will need: `bigbrain` in the CI loop after `meaning`.
- 24 Oct ~17:05 UK: merged after review: UNDO EVERYWHERE and OFFLINE TRANSLATION (BRIEF-UNDO-OFFLINE). No kernel line; no
  brain code changed. Left as they are, on purpose: the Lens crop's FORGET NOW (a privacy take-down, at once), the Lens's
  and God's Eye's CLEAR (nothing kept), SHIP IT, the kernel unlock and backup restore (native confirms; not removals).
  Saved places and spending rules landed in the same hour and have no UNDO yet (an upgrade-pass item for Memory and
  Agenda). READ ALOUD with a real iPhone voice is untried (headless Chromium has none). The bigger-brain merge builder
  was told to merge the branch again so its picker goes through the same `confirmSheet` / `undoBar`.
- 24 Oct ~17:50 UK: run 225 (head 20e7eeb) came back with one red spec of 60: `meaning`. Not the product: the spec's
  stand-in embedder (CI has no WebGPU) scores a text by a few word "concepts", and on the shared preview the library by
  then holds the LEARN spec's "Course notes: photosynthesis" and long study notes full of "food" and "plant" (the
  factory kind), which it ranked above the spec's own passage for "how do plants make food". Reproduced here against
  the same crowded preview. Fixed in the spec: a plant question damps the cooking concept in the stand-in (as the real
  model would), and the checks accept any photosynthesis passage in the first three hits and in the offline prompt,
  with the added passage required somewhere in the list. The other 59 specs, the four new ones included, passed.
- 24 Oct ~17:55 UK: pushed to PR #33 (head 23f9356): UNDO everywhere and offline translation, the meaning spec mended, the
  docs. Its CI run is the gate for the merge; a check-in at 19:16 UK merges if green. Builders still out: the bigger-brain
  reconciliation, and the upgrade passes on God's Eye, Threats and the Lens.
- 24 Oct ~18:20 UK: merged after review: THE BIGGER BRAIN (BRIEF-BIGGER-BRAIN), reconciled by a merge builder with Night
  School's monthly retrain and UNDO everywhere (both sides' tests kept whole and extended; a follow-up fix moves the
  model being trained to the CPU while the brain in use is scored, or two 7.5 GB copies of the 2B would not fit a T4).
  Kernel line, marked `[bigbrain]`: the spec in the CI loop after `meaning`. Untested anywhere real: whether Qwen3.5 2B
  and 4B load in iOS Safari on WebLLM 0.2.85 (only TEST on the phone proves it), Qwen3.5 training on a GPU (the
  transformers 5.5.4 / peft 0.19.1 set; the first 2B week may fail and will say why). Known: the trained 2B's 4-bit
  weights differ from mlc-ai's own rounding in about 0.09 % of values, always by one step (the bit-for-bit claim stays
  for the 0.6B); the retrain right after a base switch replays only that base's kept weeks, so it may lose at the gate
  (a one-line change in `push` makes both kinds replay every week). An earlier merge had interleaved two MAP.md rows
  letter by letter (MARK MY WORK and NIGHT SCHOOL on the brain): restored from their parents.
- 24 Oct ~18:40 UK: merged after review: the THREATS upgrade pass (10 fixes, two of them dead feeds nobody had noticed:
  NOAA's Kp file and the launch list). Kernel line, marked `[threats]`: the spec in the CI loop after `notifications`.
  One line in Home (core) by me: the THREAT note is amber when the level is not a reading. Leftovers the builder ranked:
  no UK threats yet (Environment Agency flood warnings and Met Office warnings near home, a street-crime tile from
  `crime_near`: a new feature, the biggest gap for a UK owner); the hero level is worldwide (should say "nothing near
  you within 500 km" or the reverse); no filter on the signals list; desktop hero dials far from the text (shared
  `ui/page.ts`); launch dates without a time. The safari and scroll specs could not run here (no WebKit): CI runs them.
- 24 Oct 19:12 UK: **PR #33 MERGED into main** (merge commit 910a831; CI run 226 green on 23f9356: brain, interface,
  deploy-build, Workers Builds, the 61-spec browser run). Live for the owner: A3, the Workshop app project, the SPEED
  card, full courses, search by meaning, the Lens's NAME IT / WHAT'S IN IT, MARK MY WORK and GADGET MANUALS, Night School
  and the monthly retrain, PHOTO TOOLS, GYM ideas, the websites lift, saved places and spending, UNDO everywhere,
  offline translation, the laptop fix, the after-14-November guide. Next pull request (#34, same branch): the bigger
  brain, the Threats pass, and the God's Eye and Lens passes when they land.
- 24 Oct ~19:25 UK: merged after review: the GOD'S EYE upgrade pass (10 fixes; no brain code changed). Kernel line, marked
  `[eye]`: the spec in the CI loop after `westmidlands`. Leftovers the builder ranked: the rain radar at 80 % opacity washes
  out the map in heavy rain (a taste call); Seattle 911 and US weather alerts on by default for a UK owner (now a
  one-time switch-off, since layers are kept); no feedback while a place is looked up (1–3 s); the readout's third line
  can be cut at 440 px; the spot card has CLEAR and ✕ and its 8 buttons wrap to 3 rows; on desktop LAYERS opens by
  default and is long. The Street View spec times out on this loaded machine on the base build as well (Google's
  panorama frame screenshot); CI runs it on a quieter runner. Measured: a tab open here is about 1 s under software
  graphics (not a phone number); first aircraft 12–14 s (adsb.lol often answers "too many requests").
- 24 Oct ~19:35 UK: merged after review: the LENS upgrade pass (10 fixes; no brain code changed; no kernel line). Leftovers
  the builder ranked: ASK has no PICK PHOTO (the biggest gap: with no camera it cannot ask about a picture; a new control
  and flow); red primary buttons (ASK GHOSTY, What's that?, RECORD, SAVE come from the shared `warn` style: a design-language
  call for the owner); READ shows a picked photo cropped (the viewfinder's frame-to-screen mapping, used by every mode);
  ASK's jargon note; the PHOTO TOOLS chip pushes the layout down 58 px; SOUND's empty black viewfinder before a
  recording. A refused camera cannot be reproduced in headless Chromium (NotSupportedError, not iOS's "not allowed").
- 24 Oct ~19:40 UK: upgrade passes out now: voice (worktree `voice`, port 8882). Done and merged: God's Eye, Threats,
  the Lens. The owner (19:40 UK): "Telegram don't really need an upgrade": its pass was stopped while still measuring
  and its worktree removed; Telegram is off the list. Still to run, one or two at a time: Reverse, Workshop, Brief,
  Markets, Radio, Memory, Agenda, Library, Settings, System.
- 24 Oct 19:42 UK: pushed and opened **PR #34** (head 92f14ea): the bigger brain, the Threats, God's Eye and Lens passes,
  the mended checks, STATUS.md. Gate: its CI run (63 specs); a check-in at 21:09 UK merges if green. Out now: the voice
  and Workshop passes.
- 24 Oct ~20:05 UK: THE 18 PRO MAX IS HERE (OWNER-ISSUES 40). The phone-only items of week 3 are unlocked: 120 Hz motion,
  the GYM on WebGPU, larger vision and depth models, the offline brain's speed and memory on the device — each starts
  from his real numbers (asked for). Next phase he wants: training that survives Kaggle's hours running out (resumable
  runs, an economy mode, a second free pool, an emergency CPU run, the phone's GPU measured) and a much bigger GYM
  (his picks from the menu pending).
- 24 Oct ~20:40 UK: the IRON MAN mock-ups (BRIEF-IRONMAN.md) are in `mockups/iron/{a,b,c}/contact.png` (+ laptop) and
  were sent to the owner for his pick. The critic (feels Iron Man / calm / readable / no icons / honest): A Reactor HUD
  8/6/7/9/7 (JARVIS at once, but busy: brackets on every card, scan texture, 9 px labels); B Stark workshop 7/7/7/7/7
  (warm metal, a luxury watch more than a hologram; amber everywhere breaks the warn-colour rule; two invented dials);
  C Hologram minimal 5/9/9/10/9 (calm and honest, but close to what he called "nothing like Iron Man"). My view: A's
  instruments with C's restraint (keep the rings, readouts and scan line; drop the corner brackets and the grid; labels
  11 px or more). Build cost: shared work about 13 h (`ui/instruments.ts`, hub cards wired to real state in
  `shell/areas.ts` + `TabDef`, `features/gym/art.ts` for all 22 games (6 drawn), the reply's meta line, live-dot wiring,
  `tests/hubcards.spec.mjs`), then A about 2.5 h more, B about 5 h (and a new warm theme), C about 1.5 h. Waiting on him.
- 24 Oct 21:10 UK: **PR #34 MERGED into main** (merge commit d705514; CI green on 92f14ea, 63 specs). Live: the bigger
  brain (Qwen3.5 2B / 4B to choose), the Threats, God's Eye and Lens passes. Next batch, same branch: the voice, Workshop
  and Brief passes, the scroll fixes, training resilience, the Iron Man build, as they land and pass.
- 24 Oct ~21:25 UK: merged after review: TRAINING RESILIENCE (BRIEF-TRAINING-RESILIENCE parts A and B; part C as notes at
  the end of this file). No kernel line. The builder's choices, accepted: his yes to the daily GPU is a tap on an
  owner-only route after a confirm sheet (a tool would have cost a prompt name); `score` runs on the CPU; a paper sat on
  the daily GPU is shown as "sat on the free GPU". Open: the Space holds his HF write token as a secret (the only token
  Ghosty has); a read-only token would be safer and is his to make (OWNER-ISSUES 37 (m)). Unmeasured without a GPU: real
  two-card speed and memory, a real mid-SFT resume, the HF branch calls, the Space's stack. The quota test now expects a
  smaller run at 9 h left, not a wait (the brief's change).
- 24 Oct ~21:45 UK: the NAVIGATION and BOOT mock-ups (BRIEF-NAV-BOOT.md) are in `mockups/nav/contact.png` and
  `mockups/boot/contact.png`, sent to the owner for his yes. The builder's notes: Learn today has four tools (Revise,
  Exams and Quizzes are views inside Courses; Videos is the chat's YouTube summary), so the eight-tool hub is a proposal;
  iOS blocks speech on a cold open until a tap, so the boot's spoken greeting must fall back to silent or speak on the
  first tap; his name starts with G (the avatar) and is read from Settings; 24 Oct 2026 is a Saturday. Build cost:
  navigation 1–1.5 builder days after BRIEF-IRON-BUILD step 1; the boot half to one day (`shell/boot.ts`, first open of
  the day + reboot, Reduce Motion). Waiting on him.
- 24 Oct ~21:55 UK: merged after review: the BRIEF upgrade pass (10 fixes, no brain code by the builder). Kernel lines,
  marked: `brief` and `places` in the CI loop (`[brief] [places]`); the digest job re-timed to 05:40 Europe/London in
  agent.ts (`[brief]`; `ensureJob` re-times the standing job). Leftovers the builder ranked: the deck's Brief picture is
  out of date (`deckshots` rewrites all 20); the offline diary is not marked last-known; the TomTom nag every morning
  and "to work" on weekends (`integrations/traffic.ts`); no markets line or reflection on the Brief; headlines open the
  chat's explain, not the article; rain timing assumes UK time; safari and scroll untested here (no WebKit).
- 24 Oct 22:05 UK: pushed as PR #36: training resilience, the Brief pass, the digest at 05:40 UK, the mock-ups, the
  research and briefs (brain suite 1,173 of 1,174 with the one red being the digest test's old time, fixed and green
  alone). The crash fix (OWNER-ISSUES 44) rode PR #36 in the end (23:48 UK below).
- 24 Oct ~22:15 UK: merged after review: the VOICE upgrade pass (10 fixes; no kernel line; LEARN's READ ALOUD already
  stopped). Leftovers the builder ranked: end of speech to the first sound is about 1.3 s, 1.0 s of it the "has he
  finished" wait (700–800 ms would do, but only real voice timings should decide); a voice lap in the stopwatch (System's
  files); playback volume and routing with the mic open and Safari's recogniser offline need the real iPhone; barge-in
  false stops with a loud TV (2 of 40 in a simulation; real recordings before retuning); a SPOKEN line about misheard
  words would cost 47 prompt characters (about 25 spare); the stale `SPEECH_ABOUT`; "until midnight UTC" is 1 am in BST.
- 24 Oct ~22:30 UK: merged after review: the WORKSHOP upgrade pass (10 fixes; no brain code; no kernel line). Leftovers the
  builder ranked: the change list itself is slow (GitHub requests one after another in `github.ts`, protected: parallel or
  cached would need a kernel edit); the app report's jargon comes from the brain's text in `appbuild.ts` (a prompt check
  before changing a tool result); the deck line for the Workshop could say "1 project running · 2 changes to ship";
  widget rows do not show that the title opens the widget; the training ground's wording; the desktop hero mostly empty;
  real GitHub timings and the Safari install flow need the real thing. The ui spec opens whichever widget is listed
  first, so after the undo spec on the same preview it can fail (a spec assumption, not a bug).
- 24 Oct ~23:00 UK: merged after review: THE BOOT CINEMATIC (BRIEF-BOOT). No kernel line (`index.html` and `main.ts` are
  not kernel). Only the real phone can prove: 120 Hz smoothness, whether the app's own boot work stalls frames (here up
  to 2.7 s under software WebGL, which made it skip ahead), the 16 ms draw test's threshold, speech on a cold open
  (iOS stays silent until the first tap, then the greeting is spoken), the hum on silent mode, the landing at hardware
  speed. Under automation the cinematic plays only when a spec asks (`__ghostyBoot`), like MIND. The frame strip:
  scratchpad `boot/boot-frames-strip.png` (sent to the owner).
- 24 Oct 23:35 UK: PR #36's browser run (21:04–22:21 UTC) failed three specs. Two (photo, places) were blocked by Night
  School's dark layer: the night spec leaves the switch ON with its 23:00–06:00 window, and this run crossed 23:00 UK, so
  every page after it was dimmed (earlier runs happened in the afternoon). Fixed: the night spec switches it off at the
  end and checks the layer is gone (a shared preview is left as found). The third (library, phone part): STUDY on a
  picked field did not come first ("Reading Accounting and business basics · 5 of 256 · working out the pace"): it
  passes here twice on a fresh preview; the likely cause is the STUDY request not reaching the brain on the loaded
  runner (the button only toasts). The spec now checks the brain's focus, allows one more tap, and names the brain's
  focus and queue when it fails, so the next failure says why.
- 24 Oct 23:40 UK: pushed to PR #36 (its CI run is the gate): the voice, Workshop and boot work, the night spec's
  cleanup, the hardened library spec, the docs. A check-in at 01:05 UK merges if green.
- 24 Oct ~23:55 UK: merged after review: THE BIG-BRAIN CRASH FIX (OWNER-ISSUES 44). The fix relies on WebLLM 0.2.85's
  cache layout (store names `webllm/config|model|wasm`, full-address keys), pinned by the vendored file; an edge test
  checks the limits it asks for against the runtime's own code; recheck both if WebLLM is ever upgraded. Only the real
  phone can prove whether Safari gives the 0.8B (1.6 GB) or the 2B (2.2 GB) enough graphics memory, what buffer limits it
  reports (under 1 GB bindings → WebLLM asks for 128 MB and the 2B is refused before any load), whether WebKit holds a
  whole piece in memory while storing it, and that the crash record survives a kill. The weekly training does not
  train the 0.8B. The full edge suite did not finish in the builder's window (load); run here before the push.
- 24 Oct 23:48 UK: pushed to PR #36 (head 61ce7db): the big-brain crash fix and its docs. The verification chain on the
  merged tree showed the offline-brain file 40 of 42: both reds were a stale `test/.build/offline-models.mjs` from before
  the merge (the file is only rebuilt by `npm test`), 42 of 42 once rebuilt; the bigbrain and offlinebrain specs passed
  on a fresh preview. The pull request's title and body now carry the fix. The 01:05 UK check-in was cancelled and a new
  one armed for 01:14 UK: it merges if green. Lesson: a targeted `node --test` run reads whatever is in `.build`; rebuild
  the bundles a test imports after a merge, or run the file through `npm test`.
- 24 Oct 23:58 UK: started two more upgrade passes on the branch head e938052, each in its own worktree: SETTINGS
  (`.claude/worktrees/settings`, branch `worktree-settings`, preview 8879, scratch `scratchpad/settings/`) and the LIBRARY
  (`.claude/worktrees/library`, `worktree-library`, preview 8880, scratch `scratchpad/library/`). Both were told the
  Iron Man builder owns `shell/*`, `ui/instruments.ts`, `shell/hubcards.ts` and styles.css's route C layer, and that the
  orchestrator merges. Still finishing: the scroll audit (8878, 12 commits), the Iron Man look (8877, 9 commits), Memory
  (8874, 11 commits); none touches a protected file; their only shared files are `styles.css` (all three) and
  `features/core/index.ts` (scroll audit and Iron Man). Merge order when they report: scroll audit, Iron Man, Memory.
  Their push waits until PR #36 has merged (the owner is waiting on the crash fix in it; a push would restart its CI),
  then goes up as the next pull request. Passes left after these: Reverse, Markets, Radio, Agenda, System.
- 25 Oct 00:20 UK: merged after review: the MEMORY upgrade pass (14 commits, 10 fixes; merge 2875b8f, clean; no kernel
  line; the builder's edge suite 1,181 of 1,181). Design note: the chat's `forget` now keeps what it removed for a day
  under RECENTLY FORGOTTEN like every other forget (UNDO everywhere, the owner's pick 12); the Lens crop's FORGET NOW
  still deletes at once on purpose (a privacy take-down; `DELETE /memory/:id` in agent.ts keeps no copy; if he ever
  wants UNDO there, agent.ts line 343 becomes `await changeMemory(this.dailyDeps(), \`f:${id}\`, 'forget').catch(() => null)`
  with `changeMemory` imported from `./memories`). Leftovers the builder ranked: a brain unreachable while the phone is
  online still shows the cached copy silently (`api/brain.ts` `req()` would need to report its fallback: a shell-level
  change for every tab, not Memory's); timeline rows are 173 pt (folding EDIT / LOCK / FORGET behind a tap would halve
  them); the desktop shows an empty middle column and the phone's switch (`ui/page.ts`); theme patterns pick up filler
  words ("long", "note"); two add forms and the section picker still says About / Likes; the diary prompt still says
  "the owner". Verification on the merged tree: web check, tsc and the memory, places, undo and backup specs on a fresh
  preview (chain bvwbxx25c); the full edge suite runs once after the scroll audit and the Iron Man look merge, before
  the push.
- 25 Oct 01:05 UK: CI's smoke job on PR #36's earlier head 9212e3c went red on ONE spec, the library's STUDY check
  (every other spec after it passed). Root cause, in the interface, not the spec: `paintStudy` repainted the whole
  SELF-STUDY panel and set the field picker back to the field being read (`pick.value = cur?.id`), so on CI's slow
  runner a repaint between the spec's pick and its STUDY tap (the FOCUS reply, or a status answer landing late) made
  STUDY send "Accounting and business basics" instead of "Algebra & number theory"; the spec's "one more tap"
  hardening could never help, because STUDY's own repaint reset the picker again. The owner would have hit it too: pick
  a field, wait a moment, tap STUDY, and the wrong field is read. Fix: the picker keeps the owner's pick through every
  repaint (`ownPick`, set by the select's change and the field bars' tap). The spec now repaints with ALL FIELDS /
  FEWER right after the pick and checks the picker kept it (red on the old code by construction), then polls the brain's
  focus for up to two minutes after one tap and reports the picker's value and the toasts if it did not take. Not run
  against the old interface here (the machine was at load 10–15 with four builders); the mechanism is in the code.
  The Library pass builder was told the exact change so its worktree merges cleanly.
- 25 Oct 01:25 UK: merged after review: THE SCROLL AUDIT (13 commits, 10 fixes; merge 5a13d68, clean). Kernel line:
  `scrollfeel` added to the CI spec loop in check.yml (`[scroll]`; 66 specs). Leftovers the builder ranked: long toasts
  (`.toast.more`, 7 s in the thumb zone) take swipes; the 133 px fixed header on Agenda, Workshop and Memory does not
  scroll; the Brief's headline chips run 33 px past the card ("Business" cut); the parallax (`--dx/--dy`) shifts where a
  page ends by up to 27 px; coming back to the Library lands 20 px off; `-webkit-mask-image` on the page scrollers may
  affect Safari's momentum. Only the phone can prove: momentum, rubber-banding, the real keyboard (the check uses a
  stand-in visualViewport), the real Home Screen insets, whether toasts swallow swipes on iOS, that the keyboard fit does
  not double-shift with Safari's own scroll-into-view; the WebKit runs of scroll.spec and safari.spec are CI's.
- 25 Oct 01:20 UK: CI's smoke on PR #36's current head 61ce7db went red on a different single spec: Route C's Today
  card (the run crossed midnight UK: the agenda spec's two "Dentist" events, made for an hour ahead at 00:05 UK, were
  still ahead when Route C ran at 01:00 UK, so its own "Call Mum", seven minutes out, was third and off the two-row
  card; on a run that ends before midnight the Dentists have passed by then, which is why 232 passed). Fixes: the Route
  C check now reads the brain's agenda and requires the card's two rows, their order and its count to match the soonest
  of what is left today, with Call Mum in that list; the agenda spec deletes its Dentist event at the end of each run
  (leave the preview as found). The library spec passed on this run by timing luck; its picker fix (above) stands.
- 25 Oct 01:50 UK: pushed to PR #36 (one CI run for the batch): the Memory pass, the scroll audit, the library picker fix,
  the Route C and agenda spec fixes, `scrollfeel` in the CI loop. Proofs on the merged tree before the push: edge suite
  1,182 of 1,182; web check; specs memory, places, undo, backup, library, agenda, routec (twice, the second with a
  leftover event two hours ahead seeded through the API), scrollfeel, layout, ui, scroll (Chromium). Two spec lessons
  from the Route C rerun: the Today card's text runs together ("Today2 left01:26Call Mum…"), so a count check cannot
  use `\b` on either side of the number (`(^|\D)2 left`); the themes check compared Home's boxes to the pixel between
  two paints, and a suggestion chip whose words follow the clock moved a centred row by one pixel, so boxes now match
  within a pixel while type and spacing still match to the letter. The 00:14 UTC check-in is superseded; a new one is
  armed about 85 minutes after this push.
- 25 Oct 02:05 UK: merged after review: THE IRON MAN LOOK (10 commits; merge 6cd1dcd; MAP.md's one conflict was two rows
  appended at the same place, both kept; `features/core/index.ts` and styles.css auto-merged over the scroll audit and
  Memory). Reviewed from the after shots (hub-see, hub-learn, gym, reply): instruments and readouts, restrained, nothing
  drawn or named as a reactor on screen (the "reactor" words left in areas.ts are old comments naming the Ask screen).
  One nit fixed in the merge: the hub subtitle sat under the big title's descender (`.hubsub` margin −2 → 6 px). Builder's
  honest limits: no card shows a sample (God's eye's aircraft stay "Not yet" until its feed has loaded; School's "Papers
  sat" is "—" until the School tab has been built that session; the Lens's 4,624 is its name list's size, not live);
  the More row could not be tested in a browser (no hub has more than six tools yet); the tool screens, the GYM's pages
  of six and the long-press switcher from the navigation sheet are NOT built (the next build, BRIEF-NAV-BOOT's
  navigation part). Verification on the merged tree: web check, then hubcards, routec, layout, ui, gym, deck, cited,
  memory, boot, scrollfeel and scroll on a fresh preview, plus a screenshot of the See hub for the subtitle fix.
- 25 Oct 02:20 UK: started THE NAVIGATION BUILD on the branch head ae5666f (`.claude/worktrees/nav`, branch `worktree-nav`,
  preview 8881, scratch `scratchpad/nav/`): the GYM in pages of six, the long-press switcher on the tab bar, a reusable
  `ui/sections.ts` (pills under a long screen's title, one section shown at a time, remembered) applied to SYSTEM and
  AGENDA only (Settings and the Library have builders in them), personal hub subtitles from real state. Told: a new
  `tests/nav.spec.mjs` needs the CI-loop line from the orchestrator; no edge files; the orchestrator merges.
- 25 Oct 02:30 UK: started the MARKETS upgrade pass on the branch head 5df68ba (`.claude/worktrees/markets`, branch
  `worktree-markets`, preview 8882, scratch `scratchpad/markets/`). There was no markets spec: the builder writes
  `tests/markets.spec.mjs`, and the CI-loop line is the orchestrator's. Told: Agenda and System are the navigation
  builder's, Settings and the Library their passes'; prices only from free keyless sources, marked with their time;
  never buy/sell advice. Builders now: Settings (8879), Library (8880), navigation (8881), Markets (8882).
- 25 Oct 02:55 UK: merged after review: the LIBRARY upgrade pass (11 commits, 10 fixes; merge 74d6e2f; one conflict in
  features/library/index.ts where the builder had copied the picker fix line for line: both sides' additions kept).
  The builder's leftover 1 was a real breach of OWNER-ISSUES 17 waiting to happen: a past paper added by hand through
  ADD (or as photos) is an ordinary document, and `selftrain/factory.ts ownerPassages` would have read it into the
  weekly training. Closed in the same hour: `packages/shared/src/papers.ts looksLikeExamPaper(title, openingText)`
  (a board's name with a paper's markings, or two markings alone; conservative: a revision guide that names GCSE once
  is not a paper) and `ownerPassages` skips such documents (`[papers]`; school.test.mjs covers it). Still to do, in the
  next Library pass: the shelf says "kept private · never trained on" on such a document, and the GitHub export leaves
  it out (check `library/export.ts`). Other leftovers the builder ranked: the study plan is a developer's curriculum
  (`library/study.ts`), not his school subjects (big brain work); scanned PDFs still need the converter (the phone cannot
  draw PDF pages); FRESH TODAY offline still says "Tap Digest now"; the three suggested searches are 40 px tall; the
  shelf shows unlabelled numbers. Note: `rareTerms` also changes which passages the chat's automatic lookup counts as
  relevant (stricter; the prompt and knowledge tests stayed green).
- 25 Oct 02:40 UK: the Iron Man merge's scroll spec red was timing: the System wheel check read scrollTop 400 ms after
  the wheel (0 px twice at load 10–13; 240 px at load 5 and in three direct traces of the same sequence); the check
  now waits up to 3 s for the page to move. The ironbuild worktree is removed.
- 25 Oct 02:55 UK: the learn spec's GOOD check assumed its card was the only one due; after the mark spec on the same
  preview (MARK MY WORK keeps its misses in LEARN) it read "GOOD did not finish the card". It now counts only its own
  card (the plant question) from the phone's mirror; proved by running mark then learn on one fresh preview. CI's loop
  runs learn before mark, so CI never saw it; the Library builder and the Library merge's chain did.
- 25 Oct 03:08 UK: PR #36 MERGED into main (merge 491e3fa; every job green on e9cd5b8, mergeable clean): the big-brain
  crash fix is live on the owner's phone with the next open, with training resilience, the Brief, voice, Workshop and
  Memory passes, the scroll audit, the boot cinematic and the library picker fix. He is asked for: GET and USE the 0.8B,
  USE the 2B, the "What this phone can hold" line. Then main was merged back into the branch and the next batch pushed as
  the NEXT pull request (#37): the Iron Man look, the Library pass, the exam-paper guard (`[papers]`), the scroll and
  learn spec fixes, the docs. PR #37 opened 03:09 UK on head 8561f0d; a check-in at 04:35 UK merges if green. Still
  running when it went up: Settings (8879), the navigation build (8881), Markets (8882).
- 25 Oct 03:25 UK: merged after review: the MARKETS pass (9 commits, 10 fixes; merge 5514ff0, clean) and the SETTINGS pass
  (15 commits, 11 fixes; merge 2c1554a, clean). Kernel lines: `markets` and `settings` in the CI spec loop (68 specs;
  `[markets] [settings]`); four entries in keys.ts reworded for honesty (`[settings]`: GitHub "recommended", "Free …
  Not needed to talk to him"; Groq "Free, no card"; Cerebras "Free tier"; OpenRouter "Free models only (':free')").
  Design calls made: the FTSE and S&P are gone from Markets rather than spinning for ever (no free keyless source
  is left; tell the owner, offer a key only if he asks); everything on Markets now rides CoinGecko's public limit
  (one brief refusal seen in testing, named on screen and recovered); the optional second currency source needs
  `'api.frankfurter.dev'` in FEED_HOSTS (index.ts) and a fetch of `/v1/latest?from=GBP` — not done. Markets leftovers
  the builder ranked: no markets line on the Brief (exact change written in its report: features/brief/index.ts
  paintSay with coins/rates from data/markets), no watchlist, gold and silver have no daily change, the default
  Markets hub card in shell/hubcards.ts (lines ~342–358) is dead code now that the tab's own TabDef wins, deckcopy.ts's
  Markets promise lines. Settings leftovers: CHARACTER has no group (shell/layout.ts: a 'Voice and home' group matching
  /^(CHARACTER|VOICE|OFFLINE)/ and `cp` moved into P.right before `vp`); on a laptop a pushed panel stays in its 350 px
  column and the big title sits over scrolled content (ui/listmode.ts, the shell's); the keys sheet in
  features/system/index.ts still says "the two keys under NEEDED" (the System pass: "Only Gemini is needed to talk to
  Ghosty; GitHub lets him change his own code. Every key here is free."); "Not tried yet: Qwen3 0.6B" because `held`
  is only recorded on USE/TEST loads (offline/brain.ts); the picker still shows four greyed GET buttons without WebGPU;
  Name saves only on blur with no "saved"; toasts lower-case capitals (ui/components.ts, every feature). Verification
  on the merged tree, all green (03:53 UK): web check, tsc, the router and offline-brain tests (75 of 75), then markets,
  settings, offlinebrain, bigbrain, character, meaning, hubcards, routec, layout, ui, undo, voice and deck on a fresh
  preview. The markets and settings worktrees are removed.
- 25 Oct 03:30 UK: started the REVERSE pass (`.claude/worktrees/reverse`, `worktree-reverse`, preview 8883, scratch
  `scratchpad/reverse/`) and the RADIO pass (`.claude/worktrees/radio`, `worktree-radio`, preview 8884, scratch
  `scratchpad/radio/`) on the branch head 8b5f9fa (Markets and Settings merged). Neither had a spec: each writes its own
  (`tests/reverse.spec.mjs`, `tests/radio.spec.mjs`), the CI-loop lines are the orchestrator's. Builders now: navigation
  (8881), Reverse (8883), Radio (8884). After these only Agenda and System remain, after the navigation build's
  sections land in them.
- 25 Oct 04:32 UK: PR #37 MERGED into main (merge 5ac986c; every job green on 8561f0d, mergeable clean): the Iron Man
  look on every hub, the Library pass, the exam-paper guard and the spec fixes are live with the owner's next open.
  Main merged back into the branch; the Markets and Settings passes with their docs pushed as PR #38. Still running:
  navigation (8881), Reverse (8883), Radio (8884).
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
- The preview server (`tests/preview-server.mjs`) serves the BRAIN from `apps/edge/test/.build/brain.mjs`, which only the
  brain suite's esbuild step (the start of `npm test`) rebuilds. After merging brain-side code, rebuild that bundle
  BEFORE restarting the preview (`cd apps/edge && npx esbuild src/index.ts --bundle --format=esm --platform=neutral
  --external:cloudflare:sockets --outfile=test/.build/brain.mjs`), or every new route answers 404 and a spec "fails"
  on code that is fine (24 Oct: the mark spec against a stale brain). A side bundle for a preview (`BRAIN_BUNDLE=… node
  tests/preview-server.mjs 8899`) belongs outside the repo: the self-check test scans everything under apps/, packages/
  and tests/ except .build and dist.
- WebKit (the scroll and safari specs, CI only): a toast over a probe point swallows the swipe even though it is
  pointer-events: none; both specs now clear or ignore `#toasts`. Anything that pops up over the page (toasts, a
  leftover modal) is cleared before measuring. The owner's height (956 − 193 bars = 763) moves where things land.

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

## TRAINING BEYOND KAGGLE'S HOURS — design notes (BRIEF-TRAINING-RESILIENCE part C, 24 Oct; no code yet)
Built already (parts A and B, branch `worktree-trainres`): checkpoints inside phases with a mid-phase resume, a session
budget per host (`HOSTS` in the notebook: Kaggle 9 h, Colab 1.75 h, Lightning 3.5 h, GitHub 5.5 h, ZeroGPU 4.5 min) and
a week spread over several sessions ({paused} at the hook → pushed again with `resume`), the second T4, economy mode, the
quota line, and the daily GPU on Hugging Face. What follows needs the owner at a computer to sign in once.

### C1. Colab's free T4 through the official Colab CLI: a second full-run pool
- **What it adds**: a full week's run when Kaggle's hours are gone, in short sessions (`host: 'colab'`, 1.75 h each; a
  9-hour week is about 5–6 sessions, each carrying on from the last checkpoint — the mechanism is built and tested).
- **The driver (outside Cloudflare)**: a Worker cannot run a CLI or hold a Google login. A PRIVATE GitHub repo of his
  (`ghosty-colab-driver`; never Ghosty's own `.github/*`, which is kernel) with one `workflow_dispatch` workflow: install
  the Colab CLI (pinned), write the notebook with the run's settings, `colab run --gpu T4` with a 1 h 45 min limit, end.
  The brain starts it through GitHub's REST API (`POST /repos/{owner}/{repo}/actions/workflows/colab.yml/dispatches`)
  with the GitHub token he already set, sending only the hook address and a one-time ticket (never the Hugging Face
  token: the notebook trades the ticket for it at the hook, as on Kaggle). How the run goes comes back the same way as
  Kaggle's ({paused} / the report at the hook); the workflow run's own status from `GET …/actions/runs` for a run that
  never reached the hook.
- **The token as a secret**: `colab auth login` (Google's own OAuth) once on his computer; the token goes into the
  driver repo's Actions secrets by his hand (Settings → Secrets → Actions), never through Ghosty or a chat.
- **Actions minutes** [unverified]: if the CLI waits for the notebook, each session holds a runner ~1 h 50 min, so 5–6
  sessions a week are ~2,200–2,600 min a month, over a private repo's free 2,000. Either the CLI can start a run and
  return (then the job is ~2 min and the brain polls), or the sessions are capped at 4 a week. Checked in the first run.
  Nothing can bill: on a free GitHub account with no card the minutes simply stop at the limit (spending limit $0).
- **The supervised first run**: Fable watching, the owner at a computer: sign in, set the secret, press RUN once. Check
  (1) the CLI gets a T4 on the free tier; (2) the notebook trades its ticket and posts {paused} after its 1.75 h; (3) the
  second session carries on mid-phase; (4) the Actions minutes one session used; (5) no warning on his Colab account.
- **The free-tier rules risk**: Colab's free-tier FAQ says it is for interactive use and forbids "bypassing the notebook
  UI" and long unattended runs; the CLI is Google's own, but a scheduled bot using it may still be read as unattended
  use, and the cost could be his Colab access. So: his explicit choice, after reading that sentence; Kaggle stays
  primary (Colab only when Kaggle waits); at most a few sessions a week; stop at the first warning or odd disconnects;
  never Colab Pro or pay-as-you-go (he confirms no payment method on his Google account's Colab billing: there is no API
  to check it).
- **What changes in Ghosty**: `cycle.ts` push picks a host (Kaggle first; Colab when Kaggle waits and the driver is set
  up), `remote.ts` a `githubDispatch` and a run-status read, the panel's GPU HOURS line names where the next run goes; the
  notebook needs nothing more than its `HOSTS['colab']` budget and per-host pins (Colab's image has its own torch: the
  pins install over it, to be checked in the first run). Tests: the dispatch with a fake GitHub, the host choice.

### C2. Kaggle's TPU v5e-8: what a torch_xla port of the LoRA training would take
- **Why**: a separate 20 hours a week on the same account (9-hour sessions), bf16 native, 8 cores × 16 GB.
- **The device**: `device_plan` gains `xla` (`torch_xla.core.xla_model.xla_device()`), `HOSTS['kaggle-tpu']` ~8 h; the
  push asks Kaggle for a TPU (`enableTpu`, its machine shape) under its own slug.
- **Packages**: Kaggle's TPU image's own torch and torch_xla (they must match: never pip a torch over them), and
  transformers/peft pins that suit that torch; checked in the image before anything else.
- **Precision**: the base in bf16, the LoRA weights and AdamW's state in fp32 (`amp_for` gives bf16 on xla).
- **The training loops**: XLA compiles a graph per tensor shape, so every new sequence length recompiles. Batches are
  padded to a few fixed lengths (256 / 512 / 1024 / 2048) and a fixed batch size; `xm.mark_step()` after each step,
  `xm.optimizer_step(opt)`; data over the 8 cores (SPMD sharding or `xmp.spawn`), the LoRA replicated. SFT and DPO move
  over almost unchanged otherwise.
- **Generation (STaR, the exams)**: the hard part. HF `generate` on XLA recompiles as the cache grows; it needs the
  static cache (`cache_implementation="static"`), prompts in fixed buckets and fixed new-token lengths, or it is slower
  than a T4. The honest first step is a split week: TRAINING on the TPU (the bulk of the hours), SAMPLING and the EXAMS
  on Kaggle's T4s, which then need far fewer hours; the checkpoint branch carries the adapter between the two runs.
- **What stays**: the q4f16_1 export (numpy, on the CPU), the gate (before and after both scored on the same hardware in
  a given week: like with like), the checkpoints (tensors moved to the CPU before saving; XLA's own RNG state).
- **Tests**: the bucket padding and the step functions on a CPU with `PJRT_DEVICE=CPU`; the split week's hand-over with
  fakes, as `Resilience` does now.
- **Size**: about a week's work for SFT/DPO on the TPU plus two or three supervised real runs to tune; generation on the
  TPU after that, only if the split week leaves the T4 hours short.
