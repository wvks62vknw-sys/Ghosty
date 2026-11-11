# BRIEF: THE MAP and THE EYE — the third and fourth whole HUDs

After THE SCAN (default) and ONE INK (PR #77), with GLASS as today's look (OWNER-ISSUES 155 "every theme as like a whole different
hud as a whole like even the tabs are different", 157 "ENTIRELY different looks … each one to be an option … prebuilt apart from the
colours", 160, 165 the gallery where THE MAP and THE EYE carry COMING, 166 the shell in The Scan, 168 ONE INK). THE DESIGN IS ROUND
ONE's W2 and W3 (docs/build-plan/mockups/directions-2/w2/ and w3/: home-440.png, hub-440.png, the READMEs), as round two's README
lists them for the gallery. THE MAP (W2): the Machine's own map of what it watches: a plotting grid in perspective as the ground,
the rooms as districts with dashed borders, tonight's thing, his recents and favourites as the square of nine round the orb, the
scale along the bottom (altitude) as the way round, "Type a word, and I'll fly there" as the ask line. THE EYE (W3): attention as
the material: a wall of feeds in grain, one thing sharp in a box with the line of sight from the orb, favourites at the edge of
attention; the owner's line for this pass names God's Eye's globe as the ground of every screen with the rooms as instruments round
it, and where that and the mock differ the mock and its README win (the globe is a feed on the wall). Read STANDARD.md, BRIEF-
SHELL-2.md (the shape), BRIEF-ONE-INK.md (the pattern: a `world` in WORLD_KEYS, `[data-world]` tokens, a looks.ts entry `built:
true`, the shell's pieces drawn by the world's tokens, Home as the world's own page, a spec), then the code (shell/house.ts, layout.ts,
areas.ts; features/core/index.ts where the Homes mount; features/core/ink/home.ts, the model; tokens.css; styles.css THE SYSTEM and
the ONE INK section). The mid tier. ORDER: THE MAP completely first; THE EYE only if the time is left after the whole map is
validated, otherwise its card stays `built: false` and the report says what was learned. One HUD done well beats two done badly.

## What is fixed

1. **THE MAP IS A WORLD HE CAN BE IN.** looks.ts: `world: 'map', built: true`; a tap on its card applies `recipe.world = 'map'` at
   once, kept across a reload, the card says YOU'RE IN IT; "the map" / "switch to the map" by words switches to it (the colour stays
   his). "the eye", "orbit", "grown up" still say their line and change nothing while THE EYE is not built. The colour is his
   (the twelve): the map's accent is the lit square, the locked box, the scale's marker and the SPEAK key.
2. **HOME IS THE MAP (w2/home-440.png).** On a phone, world map: the plotting grid in perspective as the ground (a plane tilted
   away, the world's own floor tokens: grid lines and a crosshair every five squares, drawn in CSS from tokens, no per-frame JS; its
   slow drift steps at a low rate and stops under Reduce Motion or MOTION calm); the stamp line at the top (one source, the
   shell's); `Good evening, Boss.` and the Machine's one sentence from the same sources as the other worlds, a reply's words
   replacing the sentence as in ONE INK; THE ROOMS AS DISTRICTS on the plane (SEE, MAKE, LEARN, PLAN, LIFE · ME, each a dashed-
   bordered district with its name and `N SCREENS`, a tap goes into that room's hub); THE SQUARE OF NINE round the orb (the real
   orb, Mind; tonight's thing in the accent box named with its tag, then his recents, then his favourites, each cell its name and
   its one true reading from the inventory, a free square saying nothing yet, a tap opens the thing; a long press on a cell pins or
   unpins it as the deck does); `AT HAND` over the square; the ask line in a plate `Type a word, and I'll fly there` with the mic;
   the scale (the way round) under it. Nothing is invented: tonight's thing is the book, else the agenda's next, else the Brief
   (ink/home.ts's one source, exported for both). Glass's, The Scan's and ONE INK's Homes untouched.
3. **THE SCALE IS THE TAB BAR ON EVERY SCREEN IN THE MAP.** The house of seven rooms (shell/house.ts, one source and one list with
   the other worlds) drawn as a ruler: a rule with seven ticks, the rooms HOME SEE MAKE LEARN PLAN LIFE ME as the ticks' words, a
   marker (a filled triangle) on the one he is in and its word lit in his colour, the kick row reading `THE MAP · 7 DISTRICTS`
   and `YOU ARE IN <ROOM>`; the field under it (`Type a word, and I'll fly there` on Home, the screens' own words elsewhere) is
   the jump bar as in The Scan; a tap on the kick unfolds THE PLAN, drawn as districts (dashed borders, the room he is in lit).
   Every screen ends above the ruler (`--dockh`, measured as ever); toasts stand above it; keys 44 pt; nothing sideways at 390
   and 440. The finding rule holds in this world as in the other three (two taps recents and favourites, three or one typed word
   the rest); the plan, the jump bar, a room, Every screen and Settings are the same pieces as The Scan's drawn by the map's tokens
   (dashed plates, radius 0, the reticle's square pins).
4. **THE BOOT** in THE MAP is the one Glass plays today (shell/boot.ts already forms the map's floor from the world's tokens on the
   way) and lands on the map's Home; nothing new is drawn for it in this pass (said). THE FILM stays The Scan's.
5. **THE LOOK.** Only tokens (design/tokens.css) and THE SYSTEM section of styles.css; the map's tokens are extended where the
   mock needs a value the tokens lack (each named in the report). Nothing of The Scan's room, ONE INK's page or Glass's blur in a
   map screen; nothing of the map in theirs (Home, LEARN and Settings in the other worlds drawn as before). THE RATCHET:
   ratchet.test's ceiling hex 506, rgba 1016, radiusPx 470, total 1992 holds, equal or lower. Motion on the tokens' curve; Reduce
   Motion lands; the ground costs nothing per frame; Home in the map opens under 300 ms on the preview (the look page's 300 ms
   hold and speed2's first-screen budget under 1,000 ms unchanged).
6. **THE WORDS.** "the map" switches; "show me the looks" lists the seven with the map built; the map's own words are the mock's
   (`Type a word, and I'll fly there`, `At hand`, `Free`, `nothing yet`, `N screens`).
7. **THE EYE, if it is reached:** the same list with w3's drawing (grain wall, the sharp box, the line of sight), spec
   tests/eyehud.spec.mjs and its word `eyehud` last in `all=`. If it is not reached its card stays `built: false` and COMING.

## What must not change

The prompt guard; the CI guard job; `.github/*` (beyond the one or two `all=` words, nothing); `apps/*/package.json`; the kernel and
the edge's protected files; no packages, nothing from the network, no new keys, nothing that costs money; the brain never gets live
GPS; never a model name; THE SCAN's files (scan/*.ts) and the Lens untouched; ONE INK's page untouched but for one exported source
(the thing of the hour) it shares; the finding rule's test kept and extended to the fourth world; specs' names stay and every re-cut
is in place, never loosened.

## Tests (each fails on the code before this brief; run them against it once and say so)

1. tests/maphud.spec.mjs (new; `maphud` last in check.yml's `all=` list): (a) the gallery: the map's card has no COMING; a tap sets
   recipe.world 'map', says YOU'RE IN IT, survives a reload; THE SCAN back; "the map" by words switches. (b) Home at 440 and 390:
   the stamp, the greeting and one sentence, the plane present, five districts with their `N SCREENS` and a tap into a room, the
   square of nine with exactly one lit cell (tonight), the ask line and mic, the ruler with seven ticks and Home marked; no scan
   marks, no ink frame, no glow on the plane; nothing sideways; every control 44 pt; the book, the agenda and the Brief each as
   tonight. (c) The ruler on LEARN and Settings with the marker on LEARN / ME; the page ends above it; the plan from THE MAP kick
   with seven rooms; the jump bar finds "rad" → RADIO · 04 under 300 ms. (d) Home under 300 ms (median of five) and the ground's
   cost: no animation running under Reduce Motion. (e) The finding test in four worlds (apps/edge/test/finding.test.mjs).
   (f) Scan, Ink and Glass drawn as before: their Home, LEARN and Settings' key facts unchanged.
2. Re-cuts only where a check counts looks or worlds: look.spec, routec, character, ink, gallery (the number of COMING cards four to
   three, "the map" now switches), each said in the report with old and new.
3. The ratchet: equal or lower.

## Validation before the report (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; results to the scratchpad file)

`cd apps/web && npx tsc --noEmit -p . && node build.mjs`; the brain's tests (about ten minutes, background, read the log); the
preview on PORT 8803 only; then EVERY spec in the `all=` list one at a time in the foreground against it (`BASE=http://localhost:8803
NO_GL_SHOTS=1 timeout 480 node tests/<name>.spec.mjs tests/.shots`; God's Eye specs through a temporary no-screenshot copy, deleted
after), each one's last line written to the report; sandbox reds that are not mine (direct, aim, radio, scroll, safari, eye's own
screenshot, tabs2 on the base) said as such; a timing miss under load rerun alone. Screenshots of Home at 440 and 390, LEARN, the
plan, the jump bar typed and Settings into the scratchpad.

## The owner's phone check (write it into the report in these terms)

(1) Settings → Theme: tap THE MAP: Home is the plane in perspective, the rooms as districts, tonight's thing lit in the square of
nine round the orb, the ask line, the ruler along the bottom. Does it read as a map and not as a dark theme of the same app? (2) Tap
a district: the room opens, the ruler is on that screen with the marker on the room; the page ends above it. (3) Tap the kick over
the ruler: the plan unfolds as districts; tap a number. (4) Tap the field, type three letters: found; OPEN opens it. (5) LEARN as a
room on the map. (6) Settings on the map. (7) Back to THE SCAN, ONE INK and GLASS: each exactly as before. (8) Say "the map" in the
chat: it comes back. (9) Does it feel like a different HUD, tabs included?

## Report

In the scratchpad file (huds-report.md): every commit's hash and one line; each world screen by screen against its mock; the
re-cuts; each spec's last line verbatim and its verdict; NOT REACHED; NEEDS HIS WORD; the owner's phone check per world. Never
push. Named by tier, never by model.
