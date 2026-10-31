# BRIEF — batch 6: the Machine view and foresight (OWNER-ISSUES 61a, 61c, 67c, 74(3), 75(b))

Written 31 Oct 2026, 14:50 UK, for one builder in a worktree from the tip of `claude/ghosty-ai-training-idwhp9`
(the commit that adds this file; verify `docs/build-plan/BRIEF-MACHINE-VIEW.md` exists in your tree before any work;
if your worktree started at `main`, `git fetch origin claude/ghosty-ai-training-idwhp9 && git reset --hard FETCH_HEAD`
on a clean tree first). Preview port **8844**. Read `docs/build-plan/HANDOFF.md` from the 30 Oct entries on, and
OWNER-ISSUES 61, 67c, 74, 75, 86 before starting. `MAP.md` is the code map (long lines: `cut -c1-300`).

## The lines that hold (not negotiable)

- Ghosty uses only the OWNER's own data (his saved places, his words, his settings) and PUBLIC feeds. Nothing about any
  other person is read, kept, inferred or predicted. **No prediction about any person, ever** — not his cousin, not
  "people in his circle", not a stranger: the `foresee` tool refuses a subject about a person (code, not only words).
  Foresight is about weather, roads, timetables, prices he asks about, his own plans when he asks, and Ghosty's own
  answers. (The owner's 61a words included "what the people in his circle will do or say": that part is OUT, by 67c and
  the brief for batch 5. Say so in your report; do not build it.)
- Nothing that can bill him: no new keys, no paid APIs, no SMS. TomTom is used only where a key is already set
  (`integrations/traffic.ts commute`); Open-Meteo, Transitous, adsb.lol, CelesTrak and the rest are keyless. Mind the
  brain's budgets (`apps/edge/src/meter.ts`: steps aside above 70 %): the foresight job makes at most 8 fetches a tick.
- The brain never gets live GPS: it knows his SAVED places only (`places.ts`). The Machine view runs on the phone from
  the feeds the phone already reads; "his city" is his saved home, else the phone's `home()` setting.
- No model name (any vendor's assistant model) in code, comments, tests, docs, commit messages or the PR; the
  Co-Authored-By footer your session supplies is the one exception.
- The plain-turn system prompt is at **5,496 of 5,500 characters** (`apps/edge/test/prompt.test.mjs`, two tests; never
  raise the guard). Every tool group that is OFF is named in the prompt's ALSO list with its tool names
  (`prompt.ts:129`). You add ONE group `foresight` with ONE tool `foresee` ("foresight: foresee" = 19 characters). Pay
  for it by shortening the ALSO header from `ALSO (call by name; described next turn):` to `ALSO (call by name):`
  (−21), and update the one test that matches the header (`prompt.test.mjs:46`). Report the new worst case; it must be
  ≤ 5,500 with room to spare. Nothing else is added to the plain prompt (no CONTEXT line, no mind field rendered).
- Everything here is real: a count on the Machine view is the true number of things the phone is tracking right now;
  a prediction is only ever scored against a public feed's later value or the owner's own word, never adjusted after the
  fact; calibration numbers are computed, never made up. Where a feed is missing (no TomTom key, no rail leg in his
  commute, no home saved) the feature says so plainly and does less, never pretends.

## What already exists (do not rebuild; read first)

- God's Eye: custom WebGL2 globe, `apps/web/src/features/eye/index.ts` (eyeTab; LAYERS at :195, GROUPS at :242,
  `installLayers()` at :59, pickables → `describe()` :71 and `paintInfo()` :311; layer choices kept in localStorage
  `ghosty.eye.layers`; `globe.cam.flyTo({lat, lon, range, tilt, hd})`; test handle `window.__ghosty.globe`). Layers in
  `apps/web/src/engine/layers/*.ts` implement `GlobeLayer {id, update?, draw(cs, rel, oc, sizeMul, now), pickables?}`
  (`engine/globe.ts:121`); PointSet kinds 0 dot, 1 ring, 2 diamond, 3 aircraft, 4 satellite, 5 ship (`gfx.ts:478`);
  LineSet for trails. Moving things already dead-reckon per frame: aircraft (`layers/air.ts`, adsb.lol every 8 s while
  Eye is entered), buses/trams (`data/transit.ts` → `layers/transit.ts`, brain `/api/transit?bbox`, 8 s tick, layer
  default OFF), ships (`data/intel.ts ships` → `layers/intel.ts ShipLayer`; brain `/api/ships` with the free AISstream
  key, Digitraffic keyless in the Baltic), satellites (`layers/sats.ts`, CelesTrak + a baked snapshot, analytic
  positions at 5 Hz), incidents (`data/incidents.ts` → `layers/incidents.ts`, West Midlands only), cameras, radar,
  hazards, crime, enforce, `me`/`spot`. The Eye hub card readouts: `apps/web/src/shell/hubcards.ts:193`.
- Places: `SavedPlace {id, label, query, address, lat, lon, at}` (`packages/shared/src/places.ts`); brain
  `places.ts` (`loadPlaces`, `savedPlace(storage, 'home')`); GET `/api/profile/places`; Eye chips
  `features/eye/places.ts`.
- The guardian (batch 5): GET `/api/guardian` → `GuardianInfo {places[{id,label,lat,lon,active:GuardWarning[],crime?}],
  checked, failed, person, panic, walk, tz}` (`packages/shared/src/guardian.ts`); phone store `state/guardian.ts`
  (`guardian`, `loadGuardian`).
- Weather: Open-Meteo forecast via the phone's proxy (`data/weather.ts`, home only, 10 min); the brain has no weather
  reader yet (the `weather` tool is in `tools/`; read it). Open-Meteo's forecast API with `past_days=1&hourly=precipitation,
  precipitation_probability` gives yesterday's hourly precipitation (analysed, not a gauge) — good enough to score "rain
  between 12:00 and 18:00: yes/no" at his home.
- Commute: `integrations/traffic.ts commute(key, from, to) → Commute {minutes, km, delayMin, live, line}` (TomTom with
  the key, else an OSM route that is static — so a commute PREDICTION is only honest with a TomTom key: without it the
  kind is skipped and the panel says so).
- Timetables: `integrations/transitous.ts` (keyless MOTIS): `plan()`, `departures({stopId|lat,lon}, n, {time, radiusM})
  → Departure {line, mode, kind, headsign, agency, stop, track, time, scheduled, realTime, cancelled}`,
  `delaySeconds(leg)`, `whenToTime`; a real recorded answer with a REGIONAL_RAIL leg in
  `apps/edge/test/transitous.fixture.json`. Nothing stores or re-checks a departure today.
- Ledgers to copy the shape of: `selftrain/ledger.ts` (`'train:ledger'`, pure `ledgerLines`, GET `/training/ledger`,
  `sundayNote` from the digest job), the independence meter (`packages/shared/src/independence.ts`, `'train:meter'`),
  LEARN's `calibrationLine(conf)` in `packages/shared/src/learn.ts` ("Sure and right 8 of 10").
- The one shared mind: `apps/edge/src/mind.ts` (`observe`, `mindSnapshot`; `guardstate.ts guardianMind` is the pattern
  for a light half another module adds). Do NOT add a rendered line to the prompt's CONTEXT (budget); a field the Brief
  reads is fine.
- Jobs: `schedule.ts Job.kind` (add `'foresee'`), `agent.ts` alarm handling (copy the `walk` branch: a tick that returns
  the next wake, or the `guard` branch for a standing hourly job — see the 31 Oct 14:35 HANDOFF entry), standing jobs
  made once in `reconcileDailyJobs` (`ensureGuardJob` is the pattern). `apps/edge/test/agenda.test.mjs OWN` and
  `profile.test.mjs`'s job list count Ghosty's own jobs: add yours.
- The Brief: `apps/web/src/features/brief/index.ts` (+ pure `day.ts`); on enter it calls `/api/mind`, `/api/inbox`,
  `/api/profile/places`, `/api/traffic/commute`. `tests/brief.spec.mjs` (10 checks).
- No-model answers in the chat: `apps/web/src/assistant/local.ts localTurn` (batch 4: "what did you do today?"), and in
  Telegram `telegram.ts` (`todayAsked`/`dayLines` pattern); the shared words live in `packages/shared/src/*.ts` so the
  phone, the brain and the tests read one implementation.
- Notifications: `GhostyAgent.notify({kind: 'reminder'|'task'|'error', title, text})` → inbox, push if wanted, one
  Telegram line.
- CI: `.github/workflows/check.yml` runs a fixed list of specs on ONE shared preview brain in order; a new spec is added to
  the loop line (with a note in the comment above it), placed BEFORE `websites` unless it needs that state; test it
  locally after `websites` and `apps` on the same preview too (HANDOFF 31 Oct 07:40). Specs: Playwright at 440 × 956,
  `tests/browser.mjs launch`, fixtures by `ctx.route('**/api/proxy?**', …)` tables plus routes for `/api/transit`,
  `/api/ships`, `/api/highways/events`; the preview server `tests/preview-server.mjs` runs the real brain bundle with a
  `globalThis.fetch` wrapper (`tests/fixtures/guardian-feeds.mjs` is the pattern for standing in for a brain-side source
  for EVERY spec, so CI's hourly jobs never read the live web) and `/__test/*` routes.

## 1. THE MACHINE VIEW — his city with everything moving, his things lit (61c)

A MODE of God's Eye, not a new tab (the deck and hub-card specs count tabs). Enter it from (a) a MACHINE button in the
Eye's bar (first in the bar, Machine style), (b) the Eye hub card's status line tap, (c) the chat, no model: "machine
view", "show me my city", "what are you watching?", "what can you see?" (`localTurn` opens the Eye in the mode and the
reply is the count line below), (d) `#eye?machine` so a notification can land there. LEAVE (or picking any other mode
or tab) restores exactly the layers and camera he had.

What it does, in this order, within 2 s on the phone:
1. **Frames his city.** His saved home (`/api/profile/places`, cached in the Eye's places chips), else the phone's
   `home()` setting; `flyTo` to range ≈ 14 km, tilt 50°, then a slow drift (heading +2° a second, a gentle breathing of
   the range ±4 % over 20 s) — the Machine is never still; the drift pauses while he touches the globe and resumes 6 s
   after.
2. **Turns the moving layers on** for the mode and remembers nothing of it in `ghosty.eye.layers` (the mode has its own
   set): `air`, `transit` (with the TfWM/BODS key or the keyless bustimes feed — whatever `/api/transit` gives),
   `ships` (only where the brain can answer: the AISstream key or the Baltic; otherwise the count says "no ships feed"),
   `sats` dimmed to 40 % with `orbits` off, `incidents`, `me`, `spot`, `cities`, `coast`, `borders`; `cams`, `crime`,
   `enforce`, `radar`, `imagery` off (they clutter and cost).
3. **Lights his things.** Each saved place gets a Machine box: a thin white rectangle (1.5 px, square corners) with a
   mono 11 px label in white on black — HOME, WORK, GYM… (the Lens's ADMIN box in `features/lens/people.ts paint()` is
   the style: copy it, do not restyle it). A place with an active warning (from `/api/guardian`) gets an amber ring
   pulsing once a second and the label "HOME · FLOOD ALERT" (the warning's `levelWord`, upper case); a walk under way
   (`guardian.walk.stage !== 'done'`) puts "WALKING HOME · DUE 23:20" under the home box. The three aircraft nearest
   his home get a Machine tag (callsign · altitude in ft · a one-word type if the feed gives it, e.g. "BAW123 · 7,400 FT")
   in the same thin box, white; the nearest bus or tram gets "LINE 50 · TOWARDS …" in cyan. No one else's anything:
   aircraft and buses are public vehicles, not people.
4. **The count, true.** A line at the bottom in his voice, from the live arrays within 25 km of the frame's centre (and
   satellites above 10° elevation): "Watching Birmingham. 41 aircraft, 188 buses and trams, 2 ships, 9 satellites
   overhead; 3 road incidents. Nothing active near Home." — or "A flood alert is active near Home (Environment Agency,
   since 14:05)." when there is one; "No ships feed here." when ships cannot be read; "I expect rain by 15:00." appended
   when today's foresight has an open prediction (item 2, GET `/api/foresight`). Numbers refresh every 2 s from the feeds
   that are already polling; the line is `aria-live="polite"` and is what the chat's "what are you watching?" says back
   (`window.__ghosty.machine.line` for the specs). The Eye hub card's status readout shows "WATCHING · 41 AIR · 188 TRANSIT"
   while the mode is on.
5. **Tap anything** → the existing target card (`paintInfo`); ZOOM there and the drift stops until LEAVE.
6. **Honest edges, said on the view, once each:** no home saved → "Save home in Memory → ME → PLACES and I'll watch
   your city; for now this is the phone's home." Outside the West Midlands → the incidents count is left out (the feed
   is regional) and the transit count says "no live buses here" where `/api/transit` has nothing.

Tests: `tests/machine.spec.mjs` — the mode from the bar button and from the chat (`window.__ghosty.send('machine
view')` as the abilities and faces specs use it), the camera at home (`__ghosty.globe` target within 2 km of the fixture
home), the layers set and restored on LEAVE (and `ghosty.eye.layers` untouched), the boxes and labels (read from
`window.__ghosty.machine`: places, warnings, tagged aircraft, the line), the count line's numbers equal to the fixture's
counts within the radius, the warning ring with a guardian fixture (`/__test/guardian?flood=1` then `/api/guardian/check`),
"what are you watching?" answered with the line and no request to `/api/chat`, and the hub readout. Fixtures: adsb.lol
and transit via `ctx.route` as `eye.spec.mjs` and `westmidlands.spec.mjs` do. In CI it joins the loop line after `eye`.
Unit tests for the pure parts (the count line's words, the radius filter, the tag text) in `apps/edge/test/machine.test.mjs`
on a module built from `apps/web/src/features/eye/machine.ts` (the `esbuild` entry list in `apps/edge/package.json`
"test" is where the web modules are bundled: add yours).

## 2. FORESIGHT — a prediction ledger, scored only by what happens or what he confirms (61a, 74(3), 75(b))

### 2a. The ledger (brain: `apps/edge/src/foresight.ts`; shared words and types: `packages/shared/src/foresight.ts`)
- Key `foresight:ledger`: `{ items: Prediction[] (≤ 400, oldest resolved pruned first), samples: Samples, firstTrue?: number,
  made: {day: string} }`. `Prediction { id, at, kind: 'rain' | 'commute' | 'departure' | 'answer', subject (≤ 80 chars:
  "rain at Home 12:00–18:00", "the 08:12 from Birmingham New Street (West Midlands Trains)", "the commute Home → Work at
  08:00", his question for 'answer'), expect (≤ 120: "rain", "no rain", "late by 3 min or more", "on time", "about 34
  minutes", the model's words), confidence 0.5–0.95, by (ms: when it can be scored), said (the line he was told, if
  any), outcome?: { at, actual (≤ 120), right: boolean | null, how: 'feed' | 'owner' }, told?: boolean }`.
- `Samples` is the ledger's own memory of the public feeds, nothing more: per departure watched `{line, stop, hhmm,
  weekday-type: 'wd'|'we'}` → the last 30 delays in seconds; per commute `{from, to, hhmm}` → the last 30 live minutes.
  These are counts from public feeds about public services, kept to make better guesses; nothing about anyone.
- Pure, tested functions: `predictRain(hourly, window)`, `predictDeparture(samples)` (first week: "on time" at 0.6;
  then "late by 3 min or more" when more than half the samples were ≥ 180 s, confidence = that share clipped 0.55–0.9),
  `predictCommute(samples)` (median of the last 10 same-type samples, confidence by their spread), `scoreRain`,
  `scoreDeparture` (right when the sign matches: predicted late and delay ≥ 180 s, or predicted on time and delay < 180 s;
  cancelled = late), `scoreCommute` (right within 20 % or 5 min), `calibration(items, kind, days=30) → {n, right, share}`,
  `calibrationLine(kind, c)` → "right 78% of the time about trains (14 of 18)" / "I've only scored 2 so far about rain",
  `expectLines(items, now, tz)` → today's open predictions in his voice ("I expect rain by 15:00 (70%)", "I expect the
  08:12 on time", "the commute: about 34 minutes"), `yesterdayLine(items, now, tz)` → "Yesterday: right 2 of 3 — I expected
  the 08:12 late; it was, by 6 minutes." (the proof line names one scored prediction, the most confident right one, else
  the wrong one honestly: "I expected rain by 15:00; it stayed dry."), `foresightAsked(text)` → 'today' | 'right' |
  'score' | null for "what do you expect today?", "what are your predictions?", "how often are you right?", "how good are
  your predictions?", "were you right?" (words only, no model), `rightSaid(text)` → {right: boolean, about?: string} | null
  for "you were right", "you were wrong (about the train)", "that was right", "nope, wrong" — read only while an
  unresolved 'answer' prediction is less than 7 days old, and only in a short message.
- `personProblem(subject)` → why a subject is refused: a pronoun or relation standing for a person ("he", "she", "they",
  "my cousin", "my mum", "my mate", a capitalised first name followed by "will/is going to/'ll"), or the words "someone",
  "anyone", "people", "a person". `foresee` refuses with "I don't make predictions about people." and records nothing.

### 2b. The job (`foresee`): making and scoring, on the brain's clock
- One standing `foresee` job per brain (`ensureForeseeJob`, like `ensureGuardJob`; first tick 5 minutes after it is
  made), hourly, whose tick (`foreseeTick(deps) → next wake ms`) may ask to come back sooner for a departure due to be
  scored (return `min(nextHour, by + 3 min)`), as `walkTick` does.
- At the first tick after 06:00 in his zone (once a day, `made.day`): make the day's predictions, each only when its
  inputs exist — RAIN at his saved home from Open-Meteo hourly `precipitation_probability` for 12:00–18:00 today (≥ 60 %
  → "rain", ≤ 25 % → "no rain", else nothing); the COMMUTE Home → Work at 08:00 (weekdays, both places saved AND a
  TomTom key: without the key, nothing, and the panel says "the commute needs the free TomTom key, SYSTEM → KEYS"); the
  DEPARTURE: plan Home → Work for 08:00 with Transitous once a day, take the first rail/tram/bus leg, and predict its
  scheduled departure (the first leg's `scheduledStart` at its first stop); nothing if the commute is a walk or a drive.
  Each made prediction is `observe`d in the day log as kind 'learned'? No — a new Episode kind would touch the shared
  mind's types; use kind 'tool' with text "foresaw: …". Keep it to one line a day: "foresaw 3 things for today".
- Scoring, at or after `by`: RAIN at 18:30 from Open-Meteo `past_days=1` hourly `precipitation` (≥ 0.2 mm in the window
  = rain); DEPARTURE at scheduled + 3 min from `departures` at that stop (match by line and scheduled time; `time −
  scheduled` is the delay; cancelled counts late; not found → `right: null`, "the feed had no answer"); COMMUTE at 08:00
  from `commute(key, home, work)` live minutes (sample it also at 17:30 for the samples). Every scored prediction adds to
  `samples`; a prediction with `right: null` is kept but never counted.
- THE FIRST TIME ONE COMES TRUE (`firstTrue` unset and a scored prediction is right, 'feed' or 'owner'): one notification
  (kind 'task', title "A prediction came true", text "My first prediction came true: I expected the 08:12 late; it was,
  by 6 minutes. I keep score now: SYSTEM → Report card → FORESIGHT.") and `firstTrue` set — once, ever.
- Budget: ≤ 8 fetches a tick; every fetch has a timeout (`AbortSignal.timeout(10_000)`); a feed that fails leaves the
  prediction open until its `by` + 24 h, then `right: null` with "the feed could not be read".
- Routes (owner only): GET `/foresight` → `{ items (last 60), expect: expectLines, yesterday: yesterdayLine, calibration:
  {rain, commute, departure, answer, all}, tz }`; POST `/foresight/resolve {id, right: boolean | null}` (the owner's own
  word from the panel's RIGHT / WRONG / UNKNOWN); the tool below.

### 2c. The tool, the words, the screens
- Tool group `foresight` (`tools/foresight.ts`), ONE tool `foresee` with `what: 'expect' | 'today' | 'record'`:
  'expect' records the model's expectation when the owner asked what Ghosty reckons ("what do you think will happen
  with…", "will I finish by…", "will it rain Saturday?", "will the price drop?") — `subject`, `expect`, `by` (a time in
  his words, `whenToTime` style; default tomorrow 09:00), `confidence`; it refuses a person subject (2a); its answer tells
  the model to say the expectation and that it is on record ("I'll check myself on Monday"). 'today' → `expectLines`;
  'record' → the calibration lines. `when:` only (never always): /\b(?:what do you (?:think|reckon|expect)|will (?:it|the|i|my)\b|predict\w*|prediction|forecast(?!\s*(?:for|says))|how often are you right|were you right|your record|foresight|foresee)\b/i.
  `about`: "You can put an expectation on record (foresee what: expect) when the owner asks what you think will happen —
  weather, roads, timetables, prices he names, his own plans — never about a person; say the expectation and that you'll
  check yourself. Your record: foresee today / record." ABILITIES: GROUP_CAT `foresight: 'watch'`; no GROUP_NEEDS.
- `llm/mock.ts`: "what do you reckon, will it rain tomorrow?" → `foresee {what:'expect', subject:'rain at Home
  tomorrow', expect:'rain', by:'tomorrow 18:00', confidence:0.6}`; "how often are you right?" → `foresee {what:'record'}`.
- Chat with no model (`assistant/local.ts`): `foresightAsked` → the lines from GET `/api/foresight` (cached 60 s on the
  phone; "I haven't made any predictions yet: I start each morning at six with the day's weather at Home, and your
  commute when Home and Work are saved."); `rightSaid` → POST resolve on the latest open 'answer' prediction, reply
  "Noted: right." / "Noted: wrong — I'll remember that." Telegram the same (`telegram.ts`, before the model, no turn slot,
  like the guardian's `walkTelegram`).
- The Brief: a FORESIGHT panel after YOUR DAY — today's expectations (one line each, with the confidence as a word:
  "likely" ≥ 0.7, "I think" otherwise), the yesterday line, and the standing line "I keep score: right 78% of the time
  about trains." A tap on a prediction that is open and 'answer' kind offers RIGHT / WRONG. `brief.spec.mjs` gains a
  check; `day.ts` stays pure.
- SYSTEM → Report card → FORESIGHT (`features/system/foresight.ts`, next to WHAT I LEARNED TO DO): one bar per kind
  (right share, n), the last 10 scored with ✓ / ✗ and the words, the open ones with RIGHT / WRONG / UNKNOWN for 'answer'
  kind, the honest footer ("Scored only against the feeds and your own word. The commute needs the free TomTom key.").
  `nav.spec.mjs`'s System pills: the panel is matched under "Report card".
- The Machine view's line (item 1) appends today's first expectation.
- The mind: `mindSnapshot` gains `expect?: string[]` (≤ 2 lines, from the ledger, in the shared `MindSnapshot` type) for
  the phone; **not rendered by `prompt.ts contextLines`** (budget). `memories.ts consolidate` is untouched.

### 2d. Stand-ins and tests
- `tests/fixtures/foresight-feeds.mjs` for the preview server's brain fetch: Open-Meteo (forecast + past day), Transitous
  plan/departures (reuse `apps/edge/test/transitous.fixture.json`'s shape), TomTom commute → fixed answers with times
  around "now" (as `guardian-feeds.mjs` does); switches via `/__test/foresight?rain=1&late=1&made=1` (and `?reset=1`),
  and `/__test/foresee-due` (move `by` to now and run the alarm), as `/__test/walk-due` does.
- `apps/edge/test/foresight.test.mjs` (+ a kit if useful, like `guardian-kit.mjs`): the pure functions; the job on a fake
  clock (made at 06:xx once, scored at the right times, samples kept, `firstTrue` once, the notification once, a failed
  feed leaves it open then null); `personProblem`; `foresightAsked` / `rightSaid` words (positives and negatives: "will you
  marry me" is not a prediction; "right, next" is not a confirmation); through the real brain (the routes, the tool, the
  mock, Telegram's "how often are you right?"). Chain it from a listed test file or add it to package.json's list (the
  builder of batch 5 added test files to the list: do the same).
- `tests/foresight.spec.mjs`: the Brief's panel with the stand-ins (made, one scored right, one open 'answer' → RIGHT
  resolves and the yesterday line updates), the Report card's FORESIGHT, "what do you expect today?" and "how often are
  you right?" in the chat with no `/api/chat` request, "you were right" after an open 'answer' prediction. Before
  `websites` in the CI loop; also run after `websites` and `apps` on one preview locally.

## Order, size, commits

Work in this order, one commit per item, each tree green (both typechecks, the brain tests it touches, the web build,
its spec on a fresh preview): (1) shared `foresight.ts` + brain `foresight.ts` + the job + routes + tests; (2) the tool,
the ALSO header trim, the mock, the chat/Telegram words, ABILITIES; (3) the Brief panel, the Report card panel, the spec;
(4) the Machine view (`features/eye/machine.ts` + the bar button + the hub readout + `localTurn` + the spec); (5) docs:
`docs/VISION.md`'s Eye section (one paragraph), the CI loop line, HANDOFF untouched (the orchestrator writes it).

Validate at the end, on the final tree: both typechecks; the full brain suite (`cd apps/edge && npm run typecheck && npm test`,
~20 min, `nice -n 10`); the web build; on ONE preview (port 8844) in this order: `websites`, `apps`, `machine`,
`foresight`, `eye`, `brief`, `hubcards`, `nav`, `abilities`, `onphone`, `guardian`; and the two prompt-budget tests with
the worst case reported. Never skip or weaken a test to get green; fix the cause.

## Your report (the hand-back), in this shape

BRANCH AND BASE (the base SHA; nothing pushed, no PR) · COMMITS (one line each) · FILES CHANGED (+/−, the new files
with sizes) · VALIDATION ON THE FINAL TREE (every number; the worst prompt case) · ITEM BY ITEM: built / verified by
(test names) · LIMITS · DESIGN PICKS THE OWNER MAY CHANGE · NEEDS HIS PHONE OR HIS WORDS · NOT DONE, AND NOTES FOR A
CHEAPER MODEL · WHAT THE MERGE MUST KNOW (new keys, jobs, routes, stand-ins, the prompt headroom, files of other
batches touched). Plain words, no model names, no code blocks longer than a line.
