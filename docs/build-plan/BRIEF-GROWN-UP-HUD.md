# BRIEF: GROWN UP — the sixth whole HUD (today, with less on it)

BRIEF-GROWN-UP-HUD (OWNER-ISSUES 155, 157, 160, 165 the gallery where GROWN UP carries COMING; 176 "do all of it"; 178 "insane quality";
his first complaint that started the looks: "very overcrowded"; QUEUE-11-NOV item 5). The last of the seven looks. THE DESIGN IS ROUND
ONE'S D3 (docs/build-plan/mockups/directions/d3/: home-440.png, hub-440.png, nav-440.png, show-440.png, lens, reader, shelf, and its
README, which is the design document and wins where this brief is silent). GROWN UP is today's Ghosty (GLASS: the graphite canvas, the
glass, his colour, the system's type, Mind in the middle) with the overcrowding taken out: one glass capsule at the bottom of every screen
in place of the ask bar over the tab bar (the rooms key on the left, one field that is both the chat and the jump bar in the middle, a
small Mind on the right that talks when pressed); Home is the orb, a greeting, the hour's card and one row of the things he used or
starred; a hub is three layers by how often he uses them; the Stage takes the centre as a glass panel whose bezel is Mind's own equator
scale, the orb docked in its top edge. Read STANDARD.md, BRIEF-SHELL-2.md, BRIEF-ONE-INK.md and BRIEF-MAP-EYE-HUDS.md (the pattern: a
`world` in WORLD_KEYS, `[data-world]` tokens, a looks.ts entry `built: true`, the shell's pieces drawn by the world's tokens, Home as the
world's own page, a spec), the EYE and ORBIT HUDs' code once landed, then the code (shell/house.ts, layout.ts, areas.ts, tabs.ts,
launcher.ts, deckcopy.ts, jump.ts, switcher.ts; features/core/index.ts where the Homes mount and the ask bar lives; features/core/ink/
home.ts the model and the one source of tonight's thing; packages/shared/src/themes.ts and looks.ts; design/tokens.css; styles.css THE
SYSTEM). THE QUALITY RULE (QUEUE-11-NOV) holds on every screen.

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Protected files, not edited: apps/edge/src/agent.ts, apps/edge/src/index.ts, apps/edge/src/tools/{index,types,repo}.ts, .github/* (except the
one spec word at the END of check.yml's `all=` list; the guard job untouched), apps/*/package.json. packages/shared/src/themes.ts and looks.ts
are not protected: GROWN UP becomes a world there.

## What is fixed

1. **GROWN UP IS A WORLD HE CAN BE IN.** `grown` joins WORLD_KEYS and the direction presets (ground graphite, his colour, world grown, the
   glow as Glass has it); looks.ts: `built: true`; the card's COMING goes; a tap applies `recipe.world = 'grown'` at once, kept across a
   reload, the card says YOU'RE IN IT; "grown up" / "switch to grown up" by words switches to it (the colour stays his). With this the
   gallery has no COMING card left and says so nowhere (the word simply goes).
2. **HOME (d3/home-440.png).** The orb (Mind) as the hero with ONE ring on it (free answers left today: the one gauge kept, honest, from
   the source the four gauges read); the stamp line (the shell's one source); `Good evening, Boss.` and the Machine's one sentence from
   the same sources as the other worlds, a reply's words replacing the sentence as in ONE INK; THE HOUR'S CARD (tonight's thing from
   ink/home.ts's one source: `Carry on reading`, else the agenda's next, else the Brief) as one glass card with its reading and one key;
   ONE ROW of chips: his recents then his favourites as the deck knows them, each its name, a tap opens it, a long press pins or unpins.
   The four gauges and the second bar are not drawn in this world. Nothing invented.
3. **ONE CAPSULE ON EVERY SCREEN (the bar).** The ask bar (features/core/index.ts), the tab bar (shell/tabs.ts) and the jump field become
   one glass capsule at the bottom of every screen in GROWN UP: the ROOMS key on the left (opens THE ROOMS layer: recent and starred on
   top, then every room with its screens as chips, the deck folded in: d3/nav-440.png; the house's plan is this layer, with THE HOUSE · 7
   ROOMS / YOU ARE IN <ROOM> at its head), ONE FIELD in the middle (`Ask or jump anywhere`: a typed word that matches a screen or an
   ability shows the found lines above the keyboard as the jump bar does, Recent and Starred first; anything else is his turn to the brain;
   the mic in the field), and a SMALL MIND on the right (a 44 pt second view of the one canvas or its stand-in: a press talks, a long
   press 350 ms fans the quick switcher as a tab's long press did). Every screen ends above the capsule (`--dockh`, measured as ever);
   toasts stand above it; keys 44 pt; nothing sideways at 390 and 440. The finding rule holds: recents and favourites in two taps from
   anywhere (the field, the chip), any screen in two (ROOMS, the chip) and any ability in a word. The Every-screen deck as a page is not
   drawn in this world (THE ROOMS layer is it); the avatar stays top right as one control.
4. **A HUB IS THREE LAYERS (d3/hub-440.png).** The recent card in front and raised, the favourites one level back, the rest folded into one
   stack of single-line rows that open in place, each row its name, its state and its two readings; `CARDS` and `toolCard` stay the one
   source; the recent card carries its panels as chips.
5. **THE STAGE TAKES THE CENTRE (d3/show-440.png).** A glass panel whose edge is Mind's equator scale grown into a dashed bezel, the orb
   docked in the top edge like a jewel, the bezel lit from it (a mask), the picture inside (a map, a chart, a document, a room: a glass
   panel can hold any picture); giving the Stage back is the panel folding to the orb. The Stage's own budget and SHOW ME's protocol
   unchanged.
6. **EVERY SCREEN LOSES SOMETHING (the README's "what each screen drops from its top half").** In GROWN UP the seven dense screens (Home,
   Gym, School, Library, God's Eye, Settings, System) each drop one thing from their top half into a fold or a second tap, named in the
   report with a before-and-after still; the rest inherit through the tokens. Nothing is removed from the app: everything dropped is one
   tap away and the finding test proves it.
7. **THE BOOT** in GROWN UP is the one Glass plays today and lands on GROWN UP's Home; nothing new drawn (said). THE FILM stays The Scan's.
8. **THE LOOK.** Only tokens (design/tokens.css) and THE SYSTEM section of styles.css; GROWN UP's tokens are Glass's with the capsule's and
   the layers' values added where the mock needs them (each named). Nothing of GROWN UP in the other five worlds' screens; GLASS stays
   pixel-equal (it is a separate world and is not touched). THE RATCHET: hex 506, rgba 1016, radiusPx 470, total 1992, equal or lower.
   Motion on the tokens' curve; Reduce Motion lands; Home in GROWN UP opens under 300 ms on the preview.
9. **THE WORDS.** "grown up" switches; "show me the looks" lists the seven, all built; GROWN UP's own words are the mock's (`Ask or jump
   anywhere`, `Carry on reading`, `Rooms`).

## What must not change

The prompt guard; the CI guard job; `.github/*` beyond the one `all=` word; `apps/*/package.json`; the kernel and the edge's protected
files; no packages, nothing from the network, no new keys, nothing that costs money; the brain never gets live GPS; never a model name;
THE SCAN's, THE MAP's, THE EYE's, ORBIT's files, ONE INK's page, GLASS and the Lens untouched but for the one exported source they share;
the finding rule's test kept and extended to the sixth world; speed2's first-screen budget; specs' names stay and every re-cut is in
place, never loosened.

## Tests (each fails on the code before this brief; run them against it once and say so)

1. tests/grownup.spec.mjs (new; `grownup` last in check.yml's `all=` list, nothing else in .github touched): (a) the gallery: GROWN UP's
   card has no COMING and no card has; a tap sets recipe.world 'grown', says YOU'RE IN IT, survives a reload; THE SCAN back; "grown up"
   by words switches. (b) Home at 440 and 390: the stamp, the greeting and one sentence, the orb with one ring, the hour's card, one row
   of chips with recents then favourites, the capsule with ROOMS, the field and the small Mind; no second bar, no four gauges; nothing
   sideways; every control 44 pt. (c) On LEARN and Settings: the capsule, the page ends above it; ROOMS opens the layer with recent and
   starred on top and seven rooms with their chips, a chip opens its screen; the field finds "rad" → RADIO under 300 ms and a sentence
   goes to the brain as a turn; the small Mind's long press fans the switcher. (d) A hub's three layers, the folded rows open in place.
   (e) The Stage as the glass panel with the bezel lit from the orb for a seeded map and a seeded document. (f) The seven dense screens
   each have fewer elements in the top half than in GLASS (counted) and every dropped thing is reachable in one tap. (g) Home under 300 ms
   (median of five). (h) The finding test in six worlds (apps/edge/test/finding.test.mjs). (i) Scan, Map, Eye, Orbit, Ink and Glass drawn
   as before: their Home, LEARN and Settings' key facts unchanged, Glass pixel-equal.
2. Re-cuts only where a check counts looks or worlds or COMING cards: look.spec (LOOKS7, the COMING list now empty, the words table),
   ink.spec, routec, character, the gallery; each said in the report with old and new.
3. The ratchet: equal or lower.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`. Preview on port 8817:
`(nohup setsid node tests/preview-server.mjs 8817 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8817.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call. Specs from the worktree ROOT: `BASE=http://localhost:8817 NO_GL_SHOTS=1 timeout 600 node tests/<name>.spec.mjs tests/.shots`;
a nogl copy as `tests/.<name>.nogl.tmp.mjs` is never committed. In the foreground, alone, one after another: grownup, look, ink, thescan,
maphud, eyehud and orbithud (those landed), speed2, nav, tabs, layout, ui, library, settings, showme, lens, boot, deck, hubcards, routec,
character, talk, gym, school. The brain tests in the background once at the end. A timing budget missed under load is rerun alone before
it is called red. Known sandbox reds not touched: direct, aim, radio, scroll, safari, eye's own screenshot, tabs2, talk's cooling lines.
Screenshots of Home at 440 and 390, a hub, THE ROOMS layer, the Stage, Settings, and the seven dense screens before and after into the
scratchpad.

## The owner's phone check

1. Settings, Theme, tap GROWN UP: today's look with one capsule at the bottom and nothing crowding the top. Does it feel like yours with
   room to breathe, and not like something missing?
2. Tap ROOMS: your recents and starred on top, the seven rooms with their screens; tap one.
3. Type "rad" in the field: RADIO found; type "how are you": he answers.
4. Press the small Mind: he talks. Hold it: the switcher fans.
5. LEARN: the recent card in front, the favourites behind, the rest as rows; open a row.
6. "Where is Lisbon?": the glass Stage with the lit bezel and the orb in its edge.
7. Gym, School, Library, God's Eye, Settings, System: each with less at the top; find the thing that moved in one tap.
8. Back to GLASS: pixel for pixel as before. Say "grown up": it comes back. The Theme page: no COMING anywhere.

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/grownup-report.md: every commit's hash and one line; each
screen against its mock; the seven dense screens' drops with stills; the tokens added; the re-cuts; each spec's last line (before and
after for the new one); found-not-fixed; NEEDS HIS WORD; the phone check as above. One commit per step on builder/grownup; the
orchestrator squashes to one on landing. Never push. Named by tier, never by model.
