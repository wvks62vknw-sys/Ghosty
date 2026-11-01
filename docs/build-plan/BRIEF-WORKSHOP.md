# BRIEF — batch 7: the workbench and knowledge with sources (OWNER-ISSUES 61b, 77, 60, 74(3))

Written 31 Oct 2026, 19:30 UK, for one builder in a worktree from the tip of `claude/ghosty-ai-training-idwhp9`
(the commit that adds this file; verify `docs/build-plan/BRIEF-WORKSHOP.md` exists in your tree before any work; if
your worktree started at `main`, `git fetch origin claude/ghosty-ai-training-idwhp9 && git reset --hard FETCH_HEAD` on a
clean tree first). Preview port **8866**. Read `docs/build-plan/HANDOFF.md` from the 31 Oct 17:05 entry on, and
OWNER-ISSUES 61 (b), 77, 60, 74(3), 86, 88 before starting. `MAP.md` is the code map (long lines: `cut -c1-300`).

The owner's words, 61b: "the universal workshop — in-house solvers (no packages): beams, trusses and frames, gear trains
and ratios, the engine cycle, aerofoil lift and drag with a 2-D flow (the wind tunnel), projectile and orbital paths,
circuits, heat, sun and shadow on a building … every answer labelled a first estimate, never certified"; and "the wind
tunnel on his phone" as one of the things that should feel like the Machine. His words, 77: Ghosty is knowledgeable and
"woke" in the sense of awake to injustice and WELL-SOURCED, never a conspiracy theorist: every claim traces to a primary or
credible source and is labelled (established fact / documented allegation / legal finding in progress / contested /
rumour / debunked); TikTok, X and YouTube are LEADS, never sources; he refuses false balance as hard as credulity; he
says so when a model refuses to engage.

## The lines that hold (not negotiable)

- Only the OWNER's own data and PUBLIC sources. The knowledge spine is about PUBLIC matters — court filings, UN
  commissions, official releases, human-rights reports, investigative journalism, academic work — and about public
  figures only as those documents say. Ghosty never speculates about, searches for or profiles any PRIVATE person (his
  circle, a stranger, a name he is given), and never predicts anything about anyone (batch 6's line stands).
- Nothing that can bill him: no new keys, no paid APIs. RSS feeds, Open-Meteo and the existing keyless search are free;
  the wind tunnel and every solver run on the phone or in the brain's own code with no model and no fetch.
- Every number the workbench gives is a FIRST ESTIMATE, NEVER CERTIFIED, and says so on the card, in the chat and on
  Telegram: the method named, the assumptions listed, what would change the answer, a confidence word (`rough` / `fair` /
  `good`, the vocabulary of `apps/web/src/measure/geom.ts confidence`). Nothing here is design approval, structural
  sign-off or safety advice; a load-bearing or life-safety question ends with "a chartered engineer signs this, not me".
  Numbers are computed from the stated formulae, never made up; a case outside a formula's range says so and stops.
- The sourcing rule is CODE, not only words: a claim backed only by a LEAD-tier source can never be labelled better than
  `rumour`; `established fact` needs at least one PRIMARY source or two CREDIBLE/PRESS sources that this turn actually
  read (`turnSources`); the label a model proposes is capped by what the tiers allow. Wikipedia is REFERENCE (tertiary):
  its references are leads to primaries, it is never itself the proof of a contested claim.
- No model name (any vendor's assistant model) in code, comments, tests, docs, commit messages or the PR; the
  Co-Authored-By footer your session supplies is the one exception.
- The plain-turn system prompt is at **5,494 of 5,500 characters** (`apps/edge/test/prompt.test.mjs`, two tests; never
  raise the guard). You add ONE keyword-gated group `workbench` with ONE tool `estimate` ("workbench: estimate" + newline =
  20 characters in the ALSO list). Pay for it by trimming at least 24 characters from the fixed lines in
  `apps/edge/src/prompt.ts` (TODAY or HEARING have spare words; keep their meaning), update whatever test matches the
  old wording, and report the new worst case over every dial setting on every channel (it must be ≤ 5,500 with room to
  spare). The sourcing discipline goes into `CITED_PROMPT` (appended only on cited turns: not under the guard) and into
  code; the plain prompt gains nothing else.
- Each `about` line starts "You can", ≤ 220 characters, names its tool; each tool description ≤ 1,000 characters
  (`prompt.test.mjs` pins both). The `estimate` tool is OFF on a plain turn, so its description is not in the plain
  turn's tool-spec total; keep it under 1,000 all the same.
- The phone's "Workshop" tab is Ghosty editing himself (17 specs name it): do NOT rename or repurpose it. The new screen
  is **WORKBENCH** (`apps/web/src/features/workbench/`), a tab of its own in the MAKE area (4 of 6 cards used).

## What already exists (do not rebuild; read first)

- Geometry and architecture: `packages/shared/src/design.ts` (Room JSON v2: polyArea, triangulate, designProblems…),
  `apps/edge/src/tools/design.ts` (`design_review`: facts, findings with numbered named sources, "guidance, never
  approval" — the honesty pattern to copy, with its `design_changes` event), `apps/edge/src/tools/homeplan.ts`
  (`design_home`: words → a plan; its unit parsing `normalise`/`parseSize`/`lengthText` :52–281, `assumed[]`/`cannot[]`),
  `apps/web/src/space/*` (WILL IT FIT?, MAKE SPACE), `apps/web/src/measure/geom.ts` (`confidence()` good/fair/rough,
  `rangeText`, `parseLength`), the 3D STUDIO (`apps/web/src/studio/*`, `tools/studio.ts make_3d`).
- No solver, no physics, no units beyond lengths exists (grep newton|drag|lift|stress|torque finds nothing real).
  `apps/web/src/offline/exact.ts` is a safe calculator (`sumCheck`). Weather units: `apps/web/src/data/weather.ts:15`.
- Compute plumbing: the shared worker's message dispatch (`apps/web/src/workers/textures.worker.ts` takes `gym` and `site`
  messages; `offline/sitework.ts` is the precedent), `core/heavy.ts`. WebGPU is used only by the offline brain
  (`offline/brain.ts:148`); CI has none. `build.mjs` (protected) builds `main.ts` and `textures.worker.ts` only.
- The cited pipeline: `apps/edge/src/cited.ts` (CITED_ASK :15 words, CITED_PROMPT :19, turnSources :65, splitAnswer :92,
  matchCitations :160, splitClaims :181, wordCheck :227, checkMessages :278, renderCited :334, citeAnswer :343; agent.ts
  :674 trigger, :1124 prompt, :1167 event), types `packages/shared/src/protocol.ts:26–47` (Citation, ClaimCheck
  'supported'|'not_found', CitedInfo), phone `apps/web/src/cited/text.ts` (pure) and `features/core/cited.ts` (chips,
  SOURCES rows, "✓ k of n claims found"), CITED button `features/core/index.ts:396`, `settings.cited`. Tests
  `apps/edge/test/cited.test.mjs` (13), `tests/cited.spec.mjs` (pins "✓ 2 of 4 claims" and chips "1,1,2,3"), fixture
  `tests/fixtures/cited.json` (preview-server.mjs :42–44, :84–88), mock `llm/mock.ts:128–146`.
- Sources are records: `ctx.found({kind:'web'|'library', title, url|doc, text})` (`tools/types.ts:45`; web.ts :239,
  :272, :277; library.ts :35). `recall()` (agent.ts:1192) injects the top 4 library hits each turn "use it, cite the
  source" — YouTube transcripts (`yt_<id>`), Ghosty's own notes (`notes_research`) and digest items are among them.
- Web search: `tools/web.ts searchFresh` :116 (Brave/Tavily keys if set, else DuckDuckGo HTML, else `keylessSearch` :197:
  DDG instant answers + Wikipedia opensearch + Stack Overflow + HN + GitHub), results capped at 8, cached 10 min;
  `web_fetch` :244 (≤ 9,000 chars, wrapped by `asData`). No domain ranking anywhere.
- Source-policy vocabulary to copy: `integrations/manuals.ts` (host tables, a reason per pick/skip, robots),
  `integrations/linkcheck.ts` (tiered verdict with reasons and `couldNot`), `tools/design.ts:21` SOURCES,
  `packages/shared/src/foresight.ts confidenceWord/calibrationLine`.
- The Digest: `apps/edge/src/library/digest.ts` (job 05:40 Europe/London; sources BBC ×5, arXiv ×2, HN top 12, Wikipedia
  current events; ≤ 24 requests; one passage per source under "YYYY-MM-DD · source" in doc `notes_daily`; 31-day prune;
  POST /api/library/digest; key `digest:last`). `digest.test.mjs` pins the nine sources. The phone: LIBRARY → FRESH TODAY
  (`features/library/index.ts:639–679`, DIGEST NOW), the Brief's "From this morning's digest" (`brief/day.ts digestDay`
  :112 hard-codes the headings "BBC News" and "in three levels" — keep those headings). The owner cannot add feeds; the
  owner-managed feed pattern is the calendar ICS list (`schedule.ts:304–343` key `feeds`, ≤ 12, URL in the vault;
  POST /feeds, DELETE /feeds/:id; `features/agenda/index.ts:255–300`).
- The persona already says "Unsure? Say so." (`packages/shared/src/persona.ts:71`), LOOKUPS (`prompt.ts:47`), LINES
  (:53 "Discuss anything; never flip under pressure…"), owner principles (profile.ts:35, prompt.ts:160). Nothing about
  sourcing, tiers, labels or false balance. The router (`llm/router.ts`) has no refusal detection.
- Conventions: a brain module = pure code in `packages/shared/src/` or `apps/edge/src/`, the tool in `tools/<x>.ts`
  exporting `xTools`, `X_ABOUT`, `X_WHEN`, registered in `tools/index.ts` (CORE :49, TOOL_GROUPS :82–303), a result
  budget in `context.ts:15`, a mock phrase in `llm/mock.ts:346–355`; tests added to BOTH lists in
  `apps/edge/package.json`'s `test` script (an esbuild entry and the `--test` file). A phone tab = `features/<x>/index.ts`
  TabDef, `features/index.ts` TABS :29, `shell/areas.ts` :38–47, `shell/hubcards.ts` CARDS :221–345, `shell/deckcopy.ts`,
  `abilities/registry.ts SCREEN_CAT`, `tools/ui.ts:21`, `state/whatsnew.ts`, a MAP.md row; `sections(root, id, ≤6)`.
  Specs use `tests/nav.mjs` (PHONE 440×956) and `tests/browser.mjs`; CI loop at `.github/workflows/check.yml:77` (one
  shared preview for 81 specs: each must put back what it changes). Stand-ins: `tests/preview-server.mjs` fetch wrapper
  :77–101 and `tests/fixtures/*` (`xFeeds(url)`, `setXMode(params)`, a seed), `/__test/*` routes :158–230,
  `tests/fixtures/README.md`.

## 1. THE SOLVERS — pure, shared, tested against the textbook (61b)

`packages/shared/src/workbench/` — no packages, no fetch, no model; every function pure and total (bad input → a plain
`problem` string, never a throw to the caller). Shared by the phone (the WORKBENCH screen, the wind tunnel) and the
brain (the `estimate` tool).

- `units.ts`: parse a quantity in his words to SI and back — length (mm cm m km in ft yd mi), mass (g kg t lb), force
  (N kN lbf), pressure/stress (Pa kPa MPa GPa bar psi), speed (m/s km/h mph kn), angle (deg rad), rpm, torque (Nm lbft),
  power (W kW hp bhp), energy (J kJ kWh), temperature (°C °F K), volume (L cc gal), area; `fmt(value, unit, places)` in
  the owner's system (`settings.units`); `parseQuantity("5 kN", 'force')`. Round-trip tests.
- `estimate.ts`: the one answer shape, `Estimate { title; lines: {label; value; note?}[]; assumptions: string[];
  method: string; confidence: 'rough'|'fair'|'good'; changes: string[] /* what would move it */; caveat: string }`,
  `caveatFor(kind)` ("First estimate, not certified — …"), `estimateText(e)` (the chat/Telegram rendering, ≤ 900 chars),
  `estimateSpoken(e)` (one sentence).
- `beams.ts`: simply supported, cantilever, fixed–fixed; a point load at any position, a uniform load, both; sections
  rectangle / solid round / round tube / I-beam (b, h, tw, tf) → I, Z, A; materials steel S275 / S355, aluminium 6061,
  timber C24, concrete C30 (E, yield or characteristic strength, density — a small table with the figures' origin
  named); outputs: reactions, max shear, max moment, max bending stress, max deflection, utilisation against yield with a
  stated partial factor, serviceability against span/250, the self-weight added when asked; `column.ts` folded in: Euler
  buckling load with end-condition factors. Tests: PL³/48EI, 5wL⁴/384EI, PL³/3EI, Euler π²EI/(KL)², the section
  properties of a known UB.
- `gears.ts`: a train from tooth counts or ratios (spur pairs, a belt/pulley by diameters, a compound train), overall
  ratio, output rpm and torque from input, 0.98 per mesh (said), direction; a bicycle's gear-inches/development as the
  familiar case. Tests: a 3-stage train, a 50/11 bicycle gear.
- `engine.ts`: the ideal Otto and Diesel cycles (compression ratio, γ = 1.4 → thermal efficiency), displacement + rpm +
  a BMEP first guess by engine kind (NA petrol ≈ 10 bar, turbo petrol ≈ 18, diesel ≈ 15, said as the guess it is) →
  power and torque, with a torque-curve shape peaking near 60 % of max rpm; the reverse (a stated power → implied BMEP,
  "about right / optimistic for this size"); air mass flow; fuel energy and the real-world efficiency range (25–40 %)
  stated. Tests: η = 1 − 1/r^(γ−1) at r = 10; a 2.0 L NA at 6,000 rpm lands near 110–130 kW.
- `aero.ts`: thin-aerofoil lift (Cl = 2π·α with a stall cap at a stated Cl,max), a wing's induced drag
  (Cd = Cd0 + Cl²/(π·e·AR)), lift and drag forces at speed and altitude (ISA density), a car's drag force and the power
  it takes (Cd·A), downforce from a wing, Reynolds number, terminal velocity; `flow.ts` is item 3. Tests: ISA density at
  sea level and 10 km, a Cessna-like wing at 50 m/s, a hatchback at 70 mph (≈ 10–15 kW).
- `motion.ts`: a projectile with and without drag (RK4, said), range / apex / time / impact speed; orbits: circular speed
  and period at altitude, escape velocity, a Hohmann transfer's two burns (Earth, Moon, Mars constants named). Tests:
  the no-drag range v²sin2θ/g, the ISS period ≈ 92–93 min at 420 km, escape 11.2 km/s.
- `heat.ts`: layers of thickness and conductivity → U-value (with surface resistances said), heat loss W per K and per
  room at a stated temperature difference, a lumped heating/cooling time, radiator sizing from the loss (a rule of thumb
  said as one), kWh and cost at a stated tariff. Tests: a brick wall's U-value, a 20 m² room at 20 K.
- `sun.ts`: solar altitude and azimuth for a place, date and time (the standard astronomical algorithm, ±0.5°), sunrise
  and sunset, a building's shadow length and direction, the shadow a height throws at a time of year. Tests: solar noon
  at Greenwich on an equinox ≈ 38.5° altitude, midsummer midday at Birmingham ≈ 61°.
- `circuits.ts`: Ohm's law, series/parallel resistance, a voltage divider, the resistor for an LED, RC time constant,
  power and energy and cost at a tariff. Tests: 100 Ω ∥ 100 Ω = 50 Ω, LED 20 mA from 5 V with Vf 2 V → 150 Ω.

Every solver returns an `Estimate` with `assumptions` (every default it took), `method` (the formula in words), a
`confidence` from the inputs' completeness (all given → `good`; a default used → `fair`; a guess like BMEP → `rough`),
`changes` ("a longer span adds deflection with the cube of the length", "a wet surface …"), and the `caveat`. Tests in
`apps/edge/test/workbench.test.mjs` (bundle the folder with esbuild like `measure/geom.ts` is; one test per solver's
textbook cases; `units` round-trips; `estimateText` ≤ 900 chars; every caveat says "not certified").

## 2. THE WORKBENCH screen and the `estimate` tool (61b)

- `apps/web/src/features/workbench/index.ts`: TabDef `workbench`, title "Workbench", in the MAKE area, hub card
  "Engineering first estimates: beams, gears, engines, flight, heat, sun, circuits, the wind tunnel" (`shell/hubcards.ts`,
  `shell/areas.ts`, `shell/deckcopy.ts`, `abilities/registry.ts`, `tools/ui.ts open_tab`, `state/whatsnew.ts`,
  MAP.md row). Sections (≤ 6 pills): WIND TUNNEL (item 3) · STRUCTURE (BEAM, COLUMN) · DRIVE (GEARS, ENGINE) · FLIGHT
  (WING & CAR, PROJECTILE, ORBIT) · HOME (HEAT, SUN & SHADOW, CIRCUIT). Each panel: a compact form with sensible
  defaults in his units (the owner changes a field, the answer updates at once, no button), the answer card
  (`lines`, then the assumptions folded under ASSUMED, the method under HOW, `changes` under WHAT WOULD CHANGE IT), and the
  standing label row **FIRST ESTIMATE · NOT CERTIFIED** on every card (44 px rows, shape + text not colour alone;
  readable with VoiceOver: the label is text, the values are text). Nothing is saved to the brain; the last inputs per
  panel are kept in `localStorage ghosty.workbench` so a reload keeps his problem.
- The chat with no model (`assistant/local.ts localTurn`, as the Machine view does): "wind tunnel", "open the workbench",
  "beam calculator", "gear ratio", "engine power", "orbit", "sun and shadow", "led resistor" → open the Workbench on the
  right panel; when the words carry the numbers ("3 m steel beam 5 kN in the middle"), fill the form from them (reuse
  `homeplan.ts`'s parsing style in `packages/shared/src/workbench/words.ts`: `parseProblem(text) → {kind, inputs}` with
  tests) and answer in the chat with `estimateText`. Everything else goes to the brain as ever.
- The brain tool `estimate` (`apps/edge/src/tools/workbench.ts`; group `workbench`, `when:` his words — beam, joist,
  deflection, cantilever, span, load-bearing?, gear ratio, rpm, torque, bhp, horsepower, engine, compression ratio,
  aerofoil/airfoil, wing, lift, drag, downforce, wind tunnel, terminal velocity, projectile, trajectory, orbit, escape
  velocity, u-value, heat loss, insulation, radiator, shadow, sun angle, resistor, ohm, voltage divider, kwh —
  WORKBENCH_WHEN; `about` ≤ 220 chars: "You can give first engineering estimates (estimate): …never certified"):
  `estimate({kind, ...params})` with the kinds and params documented compactly in the description (≤ 1,000 chars),
  `pure: true`, `risk: 'auto'`; it runs the shared solver and returns `estimateText` (the caveat always in it). The
  ALSO-list payment in `prompt.ts` and its test (the lines that hold). `llm/mock.ts`: "how strong is a 3 m steel beam
  with 5 kn in the middle" → `estimate({kind:'beam', …})`; "what's the gear ratio of 50 and 11 teeth" → gears. Telegram
  needs nothing new (the tool answers there through the model as every tool does). ABILITIES derives the group
  (`GROUP_CAT workbench: 'build'` or 'know' — pick and say).
- `tests/workbench.spec.mjs`: the tab opens from the hub and from `#workbench`; each panel's default answer card is
  present with the FIRST ESTIMATE label; the beam form at 3 m / 5 kN / steel 100×200 shows a deflection within 5 % of the
  textbook value and "not certified"; the units switch (settings) changes the display; the chat words "beam calculator"
  open the panel with no `/api/chat` request; "how strong is a 3 m steel beam with 5 kn in the middle" through the
  mock gives an answer containing "First estimate"; nothing scrolls sideways; every row ≥ 44 px; a reload keeps the
  inputs. Run after `studio` in the CI loop.

## 3. THE WIND TUNNEL — a 2-D flow on his phone (61b, "the wind tunnel on his phone")

- `packages/shared/src/workbench/flow.ts`: a D2Q9 lattice-Boltzmann solver in plain typed arrays, pure and
  deterministic: `createFlow({nx, ny, inlet, tau})`, `setObstacle(mask)`, `step(n)`, `velocity()`/`vorticity()` views,
  `force()` by momentum exchange on the obstacle's boundary links → lift and drag coefficients normalised by the
  obstacle's chord and the inlet speed, with the Reynolds number the lattice stands for; inlet at the left with a
  Zou–He or equilibrium velocity boundary, outlet at the right (zero-gradient), free-slip top and bottom, bounce-back on
  the obstacle; a stability guard (tau ≥ 0.52, inlet ≤ 0.1 lattice units) that says what it clamped. Shapes
  (`shapes.ts`): NACA 4-digit by code and angle of attack, a circle, a square, a flat plate at an angle, a simple car
  profile, and a free shape from a list of points (his finger) rasterised to the mask. Tests in `workbench.test.mjs`: a
  cylinder at 64×32 for 400 steps has Cd between 1 and 3 and bounded velocities (no NaN); a flat plate at 0° has |Cl| <
  0.1 and the same plate at 10° has Cl > 0; the NACA 2412 outline is closed and the right chord; the mask of a circle
  has the expected cell count ± 5 %.
- The screen (`features/workbench/tunnel.ts`, the WIND TUNNEL section): the flow drawn to a canvas (velocity magnitude
  or vorticity, a palette that works in both themes, dye streaks from the inlet), the shape picker (the NACA code and
  the angle of attack as sliders, or DRAW to trace a shape with a finger), the speed slider, PAUSE/RESUME, RESET; the
  live card: Cl, Cd, the Reynolds number the lattice stands for, lift and drag in newtons for a stated chord, span,
  speed and air density (the solver's lattice numbers scaled, said as scaled), and the standing label **FIRST ESTIMATE ·
  NOT CERTIFIED — a 2-D, low-Reynolds lattice flow; a real wing is 3-D and turbulent**. The compute runs in the shared
  worker (the `gym`/`site` message pattern; `core/heavy.ts` marks it heavy so the GYM and the Mind step aside) at
  about 192×96, as many steps per frame as keep 30 fps (measured, adaptive), the field posted back as a transferable
  buffer; the main thread only draws. Leaving the section or the tab stops the worker's loop. No WebGPU in this batch:
  the CPU path is the product; note in the report what a WebGPU kernel would need.
- `tests/tunnel.spec.mjs` (after `workbench` in the loop): the tunnel starts and the card shows numbers within 10 s of
  opening (print the time), no NaN, PAUSE stops the step counter and RESUME continues it, switching to the circle changes
  Cd, DRAW with three synthetic touches makes a mask and the card updates, leaving the tab stops the loop (no worker
  messages after 2 s), the label is present. Software rendering is slow: assert presence and bounds, never a frame rate;
  wait on signals (`window.__ghosty.tunnel.steps`, `.ready`), never on frames.

## 4. KNOWLEDGE WITH SOURCES (77; 60's knowledge list; 74(3) calibration)

### 4a. Tiers and labels (`packages/shared/src/sources.ts`, pure, tested)
- `tierOf(urlOrHost) → 'primary' | 'credible' | 'press' | 'reference' | 'lead' | 'unknown'` from a curated table with
  the reason for each row in a comment: PRIMARY = courts and tribunals (icj-cij.org, icc-cpi.int, supremecourt.uk,
  judiciary.uk, bailii.org, courtlistener.com, documentcloud.org), the UN (un.org, ohchr.org, news.un.org,
  digitallibrary.un.org), official releases and law (gov.uk, legislation.gov.uk, parliament.uk, hansard.parliament.uk,
  congress.gov, govinfo.gov, justice.gov, fbi.gov/vault, nationalarchives.gov.uk), official data (ons.gov.uk,
  data.gov.uk, who.int, nhs.uk, ec.europa.eu, europa.eu), academic (doi.org, arxiv.org, nature.com, science.org,
  thelancet.com, *.ac.uk, *.edu, scholar.google); CREDIBLE = human-rights and humanitarian bodies (amnesty.org, hrw.org,
  btselem.org, msf.org, icrc.org, pchrgaza.org, aljazeera? no — press), investigative and fact-checking (icij.org,
  bellingcat.com, occrp.org, propublica.org, fullfact.org, factcheck.org, theintercept.com, declassifieduk.org);
  PRESS = bbc.co.uk, reuters.com, apnews.com, theguardian.com, ft.com, economist.com, nytimes.com, washingtonpost.com,
  aljazeera.com, haaretz.com, timesofisrael.com, telegraph.co.uk, independent.co.uk, sky.com, channel4.com, itv.com;
  REFERENCE = wikipedia.org, wikidata.org, britannica.com; LEAD = tiktok.com, x.com, twitter.com, youtube.com, youtu.be,
  instagram.com, facebook.com, reddit.com, t.me, threads.net, snapchat; UNKNOWN = everything else. Subdomains match;
  a host list, not a regex per site.
- `LABELS = ['established fact', 'documented allegation', 'legal finding in progress', 'contested', 'rumour',
  'debunked']`, `capLabel(proposed, tiers[]) → label` (the lines that hold: lead-only → at most `rumour`; `established
  fact` needs ≥ 1 primary or ≥ 2 credible/press; no supporting source read → `contested` at best, said so),
  `tierWord(tier)` for the chips (PRIMARY / CREDIBLE / PRESS / REFERENCE / LEAD), `leadNote(url)` ("TikTok is a lead,
  not a source: here is what the primaries say"). Tests: 40 hosts, the cap rules, subdomains.

### 4b. The cited pipeline carries them (`apps/edge/src/cited.ts`, the protocol, the phone)
- `Citation.tier`, `ClaimCheck.label` (and `ClaimCheck.status` unchanged); `turnSources` records the tier of each read
  (`ctx.found` → `tierOf(url)`; library sources: a doc whose `source` line is a URL takes that tier; `yt_*` docs are
  LEAD; `notes_research` is REFERENCE; owner uploads UNKNOWN); the small-tier check call (`checkMessages`/`parseChecks`)
  is also asked for a label per claim and the code caps it with `capLabel`; `wordCheck`'s fallback gives
  `documented allegation` when supported by a non-lead source, `rumour` when only a lead, `contested` when not found.
- `CITED_PROMPT` gains the discipline (not under the guard): trace to primaries; TikTok/X/YouTube/Reddit are leads —
  extract the claim and search for the root; label every claim with one of the six; never flatten; no false balance on
  the documented; no manufactured certainty on the unproven; incompetence before a hidden hand; absence of evidence is
  not evidence; if a source was not read this turn do not cite it; if you cannot engage with the topic say so plainly in
  one line, never a non-answer. ≤ 900 characters added; a test pins its presence.
- Cited by default on contested public matters (code): `CITED_ASK` (:15) gains words — genocide, war crime(s), icj, icc,
  human rights, epstein, cover-up, corruption, scandal, conspiracy, "is it true", "did … really", "fact check", "what's
  the evidence", "source?" — so those turns run the cited pipeline without the toggle; a unit test for the words, and
  the CITED button still works as before.
- Search results carry the tier so the model can prefer primaries: `tools/web.ts searchFresh` sorts its ≤ 8 results by
  tier (primary first, leads last, ties by the engine's order) and appends ` [PRIMARY]`/`[LEAD]`… to each result line;
  `web_fetch` of a LEAD host returns its text wrapped with `leadNote`. Tests in `web.test.mjs`.
- The phone (`features/core/cited.ts`, `cited/text.ts`): each SOURCES row shows its tier word as a small chip; each claim
  line shows its label in words (never colour alone); the check line becomes "✓ k of n claims found in the sources ·
  m established, j documented, …" (keep "✓ 2 of 4 claims" exactly for `cited.spec.mjs` and extend the fixture
  `tests/fixtures/cited.json` with tiers; `cited.spec.mjs` gains the tier chips and a label). `renderCited` (Telegram)
  prints "[PRIMARY]" after a source and the label after a claim.
- Honesty about a model that refuses (77e): `packages/shared/src/refusal.ts refusedWords(text)` (patterns of a
  declined political answer, tested on ten real shapes and ten normal replies that must not match); on a cited turn
  whose answer matches, Ghosty prefixes "That model wouldn't engage with this; here is what the sources say:" and, if the
  router exposes another free model, tries once more on it (read `llm/router.ts` first; if a one-retry hook does not
  fit in an hour, do only the honest line and say so).

### 4c. The Digest follows credible sources (77d)
- `library/digest.ts`: the hard-coded list becomes a FEEDS registry with a tier per feed and the same ≤ 24 requests a run:
  keep BBC ×5, arXiv ×2, HN, Wikipedia current events (their headings unchanged: `brief/day.ts digestDay` and
  `digest.test.mjs` depend on "BBC News" and "in three levels"); add PRIMARY/CREDIBLE RSS: UN News (news.un.org), OHCHR
  press releases, the ICJ's press releases, the ICC's news, Amnesty, HRW, B'Tselem, ICIJ, Bellingcat, OCCRP, ProPublica,
  Full Fact, GOV.UK announcements, legislation.gov.uk's new legislation feed — verify each URL answers with RSS/Atom before
  it goes in (one real fetch each, by hand, and record which did not answer in the report; leave those out). Each passage
  heading becomes "YYYY-MM-DD · source · TIER"; the FRESH TODAY panel shows the tier word; nothing else about the Brief's
  parsing changes. `digest.test.mjs` updated for the registry (and still pinning the nine original sources).
- Optional, only if everything above is done and green: owner-managed RSS feeds for the digest on the pattern of the
  calendar ICS list (≤ 6, URL checked, tier UNKNOWN unless the host is in the table), a small form on LIBRARY → FRESH
  TODAY. Say in the report whether you did it.

### 4d. What is NOT in this batch (say so in the report)
- Offline Wikipedia (a ZIM reader) — later; the phone's CSP, the brain's write budget and the download size make it its
  own batch. The curriculum's rights-and-law topics — later. New always-on persona words — none (the budget).

## Order, size, commits

Work in this order, one commit per item, each tree green (both typechecks, the brain tests it touches, the web build,
its spec on a fresh preview): (1) `packages/shared/src/workbench/*` + `workbench.test.mjs`; (2) the WORKBENCH tab, the
`estimate` tool with the ALSO payment and its test, the mock lines, `localTurn` words, ABILITIES, `workbench.spec`; (3)
`flow.ts` + `shapes.ts` + the tunnel section + the worker path + `tunnel.spec`; (4) `sources.ts` + the cited pipeline's
tiers and labels + `CITED_PROMPT` + cited-by-default words + search tiers + the phone rows + `refusal.ts` + the Digest
registry + tests and the two spec updates; (5) docs: `docs/VISION.md` gains a Workbench paragraph and a Knowledge
paragraph, the CI loop line (`workbench` and `tunnel` after `studio`), `tests/fixtures/README.md`, a MAP.md row per new
file; HANDOFF untouched (the orchestrator writes it).

If time runs short, deliver in this order and stop cleanly: 1, 2, 4a–4b, 3, 4c. Never leave a half-wired tool or tab.

Validate at the end, on the final tree: both typechecks; the full brain suite (`cd apps/edge && npm run typecheck && npm
test`, ~17 min, `nice -n 10`); the web build; on ONE preview (port 8866) in this order: `websites`, `apps`, `hubcards`
(early: the brain's self-study job writes the library 10 min after a fresh brain and would break hubcards' two reads),
`workbench`, `tunnel`, `cited`, `library`, `brief`, `nav`, `abilities`, `eye`, `guardian` (last: it leaves the mood
'protective'); and the two prompt-budget tests with the worst case reported. Never skip or weaken a test to get green;
fix the cause.

## Your report (the hand-back), in this shape

BRANCH AND BASE (the base SHA; nothing pushed, no PR) · COMMITS (one line each) · FILES CHANGED (+/−, the new files
with sizes) · VALIDATION ON THE FINAL TREE (every number; the worst prompt case; the textbook checks' errors in %) ·
ITEM BY ITEM: built / verified by (test names) · LIMITS · DESIGN PICKS THE OWNER MAY CHANGE · NEEDS HIS PHONE OR HIS
WORDS · NOT DONE, AND NOTES FOR A CHEAPER MODEL · WHAT THE MERGE MUST KNOW (new keys, jobs, routes, stand-ins, the
prompt headroom, files of other batches touched, which digest feeds answered). Plain words, no model names, no code
blocks longer than a line.
