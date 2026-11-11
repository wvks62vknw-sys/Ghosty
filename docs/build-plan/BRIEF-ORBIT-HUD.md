# BRIEF: ORBIT — the fifth whole HUD (Mind is the way in)

BRIEF-ORBIT-HUD (OWNER-ISSUES 155 "every theme as like a whole different hud as a whole like even the tabs are different", 157, 160, 165
the gallery where ORBIT carries COMING; 176 "do all of it"; 178 "insane quality"; QUEUE-11-NOV item 5). After THE SCAN, ONE INK, THE MAP
and THE EYE, with GLASS as today's look. THE DESIGN IS ROUND ONE'S D1 (docs/build-plan/mockups/directions/d1/: home-440.png, hub-440.png,
nav-440.png, show-440.png, lens, reader, shelf, and its README, which is the design document and wins where this brief is silent). ORBIT:
no bar; the orb is the only chrome and the way in. On Home the orb sits at the centre of its own sky; the six rooms (SEE, MAKE, LEARN,
PLAN, LIFE, ME) stand on an orbit round it as named stations, the one that matters tonight lit; recents and favourites hang under it in
one capsule; a line says what the orb does. On every other screen the orb sits bottom-left as the open end of a line: press it to type,
hold it and the rooms fan round it (the quick switcher's arc, shell/switcher.ts, is the precedent). The Stage grows out of the orb. Read
STANDARD.md, BRIEF-SHELL-2.md (the shape), BRIEF-ONE-INK.md and BRIEF-MAP-EYE-HUDS.md (the pattern: a `world` in WORLD_KEYS, `[data-world]`
tokens, a looks.ts entry `built: true`, the shell's pieces drawn by the world's tokens, Home as the world's own page, a spec), the EYE
HUD's code once landed (the newest example of the pattern), then the code (shell/house.ts, layout.ts, areas.ts, switcher.ts; features/
core/index.ts where the Homes mount; features/core/ink/home.ts the model and the one source of tonight's thing; features/core/mind.ts;
packages/shared/src/themes.ts and looks.ts; design/tokens.css; styles.css THE SYSTEM). THE QUALITY RULE (QUEUE-11-NOV) holds on every
screen: every state designed, every word his, every wait said, every number honest, every control 44 pt, nothing merely fine.

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Protected files, not edited: apps/edge/src/agent.ts, apps/edge/src/index.ts, apps/edge/src/tools/{index,types,repo}.ts, .github/* (except the
one spec word at the END of check.yml's `all=` list; the guard job untouched), apps/*/package.json. packages/shared/src/themes.ts and looks.ts
are not protected: ORBIT becomes a world there.

## What is fixed

1. **ORBIT IS A WORLD HE CAN BE IN.** `orbit` joins WORLD_KEYS and the direction presets (ground black, his colour, world orbit); looks.ts:
   `built: true`; the card's COMING goes; a tap applies `recipe.world = 'orbit'` at once, kept across a reload, the card says YOU'RE IN IT;
   "orbit" / "switch to orbit" by words switches to it (the colour stays his). ORBIT_LINE ("a way round, not a look") is retired wherever
   it is shown (THE LOOK's Orbit plate says what Orbit now is). "grown up" still says its line and changes nothing until that HUD lands.
2. **HOME IS THE ORBIT (d1/home-440.png).** The orb (the real one, Mind) at the centre; the stamp line at the top (the shell's one source);
   `Good evening, Boss.` and the Machine's one sentence from the same sources as the other worlds, a reply's words replacing the sentence
   as in ONE INK; THE SIX STATIONS on an SVG ring round the orb (SEE MAKE LEARN PLAN LIFE ME, positioned from two variables, each 44 pt
   with its word, the one that matters tonight lit in his colour: the room of tonight's thing from ink/home.ts's one source); THE CAPSULE
   under the orb: recents then favourites as the deck already knows them, each its name and one true reading from the inventory, a tap
   opens the thing, a long press pins or unpins as the deck does; THE HINT LINE under the orb (`Press me to ask, or to find anything.`)
   shown until the orb has been pressed ten times (counted on the phone), then gone; a faint ring on the orb that says it is a button.
   A press on the orb opens the typed word (the jump bar: Recent and Starred nearest the orb, then the found lines); a tap on a station
   opens that room's hub. The four gauges, the tab bar and the separate ask bar are not drawn in this world. Nothing is invented.
3. **THE ORB IS THE WAY ROUND ON EVERY SCREEN.** In ORBIT no screen has a tab bar: the orb (a 56 pt second view of the one Mind canvas, or
   its 2-D stand-in where WebGL is off) sits bottom-left as the open end of a thin line that runs to the right edge and carries the
   screen's words (`Type a word` on Home, the screens' own words elsewhere: the field). Press the orb: the typed word. Hold it 350 ms
   (HOLD_MS; `-webkit-touch-callout: none`; the switcher's pointer handling) and the six rooms fan round it on an arc (d1/nav-440.png);
   slide to one and let go: its hub; let go on none: nothing. The house's plan (THE HOUSE · 7 ROOMS / YOU ARE IN <ROOM>) is a tap on the
   line's left end next to the orb and unfolds as stations on a ring. Every screen ends above the line (`--dockh`, measured as ever);
   toasts stand above it; keys 44 pt; nothing sideways at 390 and 440. The finding rule holds: recents and favourites in two taps from
   anywhere (press the orb, tap), any screen in three or one typed word, and from inside a screen another room is one gesture (hold,
   slide, let go) or two taps (orb, station). The plan, the jump bar, a room, Every screen and Settings are the same pieces as The Scan's
   drawn by ORBIT's tokens: outlines and a little glow, no blur, no shadow, depth is nearness to the orb.
4. **A HUB IS LAYERS BY DISTANCE FROM THE ORB (d1/hub-440.png).** The recent card at the bottom on a thread from the orb, the favourites
   above it, the rest above them as stations along an orbit line; `CARDS` stays the one source; the recent card carries its panels as
   chips as the mock shows (Reader, Shelf, Ask the library).
5. **THE STAGE GROWS OUT OF THE ORB (d1/show-440.png).** For a map, a globe, a chart, a route or a plan the orb becomes a sphere with the
   picture inside it (a circular clip, the graticule over it, the equator scale riding across in front, the rim lit in his colour), and
   giving the Stage back is the orb shrinking again; for a document, a tune's waveform or a 3-D room the Stage is a rounded rectangle
   with the same lit ring as its bezel (the README's point 2), the orb docked at its top edge. The Stage's own budget (the picture within
   2 s of the data) and SHOW ME's protocol unchanged.
6. **THE BOOT** in ORBIT is the one Glass plays today and lands on ORBIT's Home with the orb already where the film leaves it (the hero's
   hand-over is the same Mind); nothing new is drawn for it (said). THE FILM stays The Scan's.
7. **THE LOOK.** Only tokens (design/tokens.css) and THE SYSTEM section of styles.css; ORBIT's tokens extended where the mock needs a value
   the tokens lack (each named in the report). Nothing of The Scan's room, ONE INK's page, THE MAP's grid, THE EYE's grain or Glass's blur
   in an ORBIT screen; nothing of ORBIT in theirs. THE RATCHET: hex 506, rgba 1016, radiusPx 470, total 1992, equal or lower. Motion on
   the tokens' curve; Reduce Motion stills the ring's drift and the fan opens without easing; Home in ORBIT opens under 300 ms on the
   preview; the second orb view costs no second renderer (one canvas, two views, or the stand-in).
8. **THE WORDS.** "orbit" switches; "show me the looks" lists the seven with ORBIT built; ORBIT's own words are the mock's (`Press me to
   ask, or to find anything.`, `At hand`, the stations' room names, `Carry on reading`).

## What must not change

The prompt guard; the CI guard job; `.github/*` beyond the one `all=` word; `apps/*/package.json`; the kernel and the edge's protected
files; no packages, nothing from the network, no new keys, nothing that costs money; the brain never gets live GPS; never a model name;
THE SCAN's files (scan/*.ts), THE MAP's, THE EYE's, ONE INK's page and the Lens untouched but for the one exported source they share;
the finding rule's test kept and extended to the fifth world; speed2's first-screen budget; GLASS pixel-equal; specs' names stay and
every re-cut is in place, never loosened.

## Tests (each fails on the code before this brief; run them against it once and say so)

1. tests/orbithud.spec.mjs (new; `orbithud` last in check.yml's `all=` list, nothing else in .github touched): (a) the gallery: ORBIT's
   card has no COMING; a tap sets recipe.world 'orbit', says YOU'RE IN IT, survives a reload; THE SCAN back; "orbit" by words switches.
   (b) Home at 440 and 390: the stamp, the greeting and one sentence, the orb centred, six stations with their words and exactly one lit,
   the capsule with recents then favourites, the hint line present then gone after ten presses, no tab bar, no ask bar, no gauges;
   nothing sideways; every control 44 pt; a station tap opens its hub; an orb press opens the typed word with Recent and Starred first.
   (c) On LEARN and Settings: no tab bar, the orb bottom-left with the line, the page ends above it; hold 350 ms fans six rooms, slide
   to PLAN and release opens PLAN's hub, release on none closes it; the plan from the line's end shows seven rooms; the jump bar finds
   "rad" → RADIO under 300 ms. (d) A hub's three layers with the recent card nearest the orb on its thread. (e) The Stage: a seeded
   map grows as a sphere from the orb and shrinks back; a seeded document is the rounded rectangle with the bezel. (f) Home under 300 ms
   (median of five); under Reduce Motion no animation runs on the ring. (g) The finding test in five worlds (apps/edge/test/
   finding.test.mjs). (h) Scan, Map, Eye, Ink and Glass drawn as before: their Home, LEARN and Settings' key facts unchanged.
2. Re-cuts only where a check counts looks or worlds or reads ORBIT_LINE: look.spec (LOOKS7, the COMING list, the words table at its
   lines 551 and 692), ink.spec, routec, character, the gallery; each said in the report with old and new.
3. The ratchet: equal or lower.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`. Preview on port 8816:
`(nohup setsid node tests/preview-server.mjs 8816 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8816.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call. Specs from the worktree ROOT: `BASE=http://localhost:8816 NO_GL_SHOTS=1 timeout 600 node tests/<name>.spec.mjs tests/.shots`;
a nogl copy as `tests/.<name>.nogl.tmp.mjs` is never committed. In the foreground, alone, one after another: orbithud, look, ink, thescan,
maphud, eyehud (if landed), speed2, nav, tabs, layout, ui, library, settings, showme, lens, boot, deck, hubcards, routec, character, talk.
The brain tests in the background once at the end. A timing budget missed under load is rerun alone before it is called red. Known
sandbox reds not touched: direct, aim, radio, scroll, safari, eye's own screenshot, tabs2, talk's cooling lines. Screenshots of Home at
440 and 390, a hub, the fan open, the Stage as a sphere, Settings into the scratchpad.

## The owner's phone check

1. Settings, Theme, tap ORBIT: the orb in the middle of its sky, six rooms on a ring, tonight's lit, your recents under it, no bar
   anywhere. Does it read as a different HUD and not a dark theme of the same app?
2. Tap LEARN on the ring: the room, its recent card nearest the orb on a thread; the orb bottom-left with its line.
3. Hold the orb, slide to PLAN, let go: PLAN. Hold and let go on nothing: nothing.
4. Press the orb, type three letters: found; open it.
5. "Where is Lisbon?": the orb grows into a sphere with the map inside; "write me a letter": the rounded Stage with the bezel.
6. Press the orb ten times across the day: the hint line goes.
7. Back to THE SCAN, THE MAP, THE EYE, ONE INK, GLASS: each exactly as before. Say "orbit": it comes back.

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/orbithud-report.md: every commit's hash and one line;
each screen against its mock; the tokens added; the re-cuts; each spec's last line (before and after for the new one); found-not-fixed;
NEEDS HIS WORD; the phone check as above. One commit per step on builder/orbithud; the orchestrator squashes to one on landing. Never
push. Named by tier, never by model.
