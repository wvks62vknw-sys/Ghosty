# BRIEF: THE SHELL IN THE SCAN (shell pass 2) — the house everywhere, the rooms as rooms, Every screen, Settings, the jump bar

BRIEF-SHELL pass 2 (OWNER-ISSUES 139 the finding rule, 143 everything findable, 155 "every theme as a whole different hud … even
the tabs", 156 "a mix of the last two", 157 "genuine billions poured into it", 161 shell pass 1 on main, 162 THE SCAN's Home on
main, 164 "all of this needs to be built"). The design is the first HUD mock round's shell frames, in THE SCAN's language as it
now stands on main (the Scan's Home and its tokens are the reference for plates, type and the house): docs/build-plan/mockups/
hud/2026-11-08/nav-house.png (THE HOUSE unfolded: the plan of every room with its things numbered), nav-jump.png (the ask line
as the jump bar: FAVOURITES and RECENT above the keyboard), nav-typed.png (a typed word as the search: CHECKED HOME · SEE …
FOUND IN PLAN, the box locking on the find with OPEN), learn.png (a room: the band with every thing reticled and numbered, AT
HAND open with two readings each, THE REST folded in a grid with one line each, IN THE WORKS in amber), deck.png (Every
screen: FAVOURITES, RECENT, then each room's things with their numbers and one true line), settings.png (Settings as a plate
brought to the front: rows numbered and grouped, the value at the right); their .html files carry the exact type, plates and
spacing. The README's sections 2, 3 and 4 say what each is. Read STANDARD.md first, then this, then BRIEF-SHELL.md (pass 1 is
on main: the finding test, favourites by a long press, the stamp line from one source, every screen's sentence), FACTS-SHELL.md,
apps/web/src/shell/{layout,areas,tabs,boot}.ts, apps/web/src/commands/registry.ts (the jump bar), the hubs (apps/web/src/
features/*/index.ts for SEE, MAKE, LEARN, PLAN, LIFE, ME: find them from areas.ts), apps/web/src/features/core/scan/home.ts
(how THE SCAN draws the house: `body.scanhome #dock`, the plates, the stamp) and styles.css's THE SYSTEM and THE SCAN sections,
and the eight specs BRIEF-SHELL names as pinned. The mid tier. Start from the session branch (main's tree).

## What is fixed

1. **THE HOUSE IS THE TAB BAR ON EVERY SCREEN IN THE SCAN.** When the world is The Scan (recipe.world 'scan'), every screen,
   not only Home, draws the house along the bottom exactly as the Scan's Home draws it now (`THE HOUSE · 7 ROOMS` at the left,
   `YOU ARE IN <ROOM>` at the right, the seven rooms HOME SEE MAKE LEARN PLAN LIFE ME as one plate of keys with the one he is
   in lit by his accent and its dot), with the ask line under it as on Home (the field's words per screen as the mocks have
   them: "Find anything in Learn", "Find a setting", "A number, a word, or a question"). The Glass world keeps today's bar.
   One tap on `THE HOUSE · 7 ROOMS` unfolds THE PLAN (nav-house.png): every room with its things numbered 01, 02, 03 in the
   Machine's index, the room he is in lit, favourites starred, recents clocked, IN THE WORKS dotted amber, all 45 screens on
   one surface, a tap on a thing goes there, a tap outside or on the house folds it. The plan is the deck's list and the
   finding test's list: ONE source (shell pass 1 made it), never a second hand-kept list.

2. **THE ASK LINE IS THE JUMP BAR.** A tap into the field on any screen raises FAVOURITES and RECENT as plates above the keyboard
   (nav-jump.png), one tap each; a typed word is the search (nav-typed.png): `CHECKED HOME · SEE · MAKE · LEARN · FOUND IN
   PLAN`, the box locking on the find (`RADIO · 04`) with OPEN, the recognition tone once; words that match no screen go to
   Ghosty as the question they are (today's path). The command palette (`#palette`, `#top .cmd`) is what the field becomes in
   The Scan: the same ranking (commands/rank.ts), the same rows, the same finding test, drawn as the mock draws it; in Glass the
   palette stays as it is. The 300 ms open budget tabs.spec holds for the palette holds for this.

3. **A HUB IS A ROOM (learn.png), THE SAME WAY FOR ALL SIX.** The room's band across the top: every thing in it reticled and
   numbered (the Machine's reticle and index), drawn from the room's things (the same list as the plan); under it AT HAND
   (recent and starred, open rows with their name, their one line and two live readings, as the mock's Library, Gym and Courses),
   then THE REST folded in a two-column grid with one true line each, IN THE WORKS in amber for what is not ready; `SAY A NUMBER:
   "OPEN TWO"` at the grid's head and the number works by voice and by the field. The hub's one sentence (shell pass 1) stands
   under its name. The band is drawn in the DOM with the system's marks (no WebGL: the world is Home's), its things laid out
   left to right in index order with their numbers; on a phone it is one row of at most eight. Each hub keeps every screen it
   reaches today (the finding test proves it).

4. **EVERY SCREEN IS THE MACHINE'S INVENTORY (deck.png).** The deck (`#deck`, the logo's toggle) becomes the list: FAVOURITES
   (`Hold a thing to pin it`), RECENT (`Newest first`), then each room's things with their numbers and one true line each, the
   value at the right where the screen has one; it scrolls; the field under it takes a number, a word or a question. The
   deck's five groups go: the rooms are the groups. Shell pass 1's favourites (the long press) and the finding test are kept.

5. **SETTINGS IS A PLATE BROUGHT TO THE FRONT (settings.png).** Rows numbered and grouped under THE LOOK, YOU, THE BRAIN,
   GHOSTY, ABOUT, each row's name, its one line and its value at the right, `‹ ME` as the way back; every setting that exists
   today keeps its row (nothing dropped; settings.spec proves it).

6. **THE STAMP LINE AND THE PAGE TITLE** on every screen as the mocks: the stamp from the one source (`SUN 8 NOV · 21:11 ·
   BIRMINGHAM · WATCHING 3 FEEDS · LOOKING AT LEARN`), the title in the system's display type under it.

7. **THE LOOK.** The system's tokens and the Scan's plates (as home.ts and styles.css's THE SCAN section use them); nothing of
   the Glass look leaks into a Scan screen (no blur, no rounded glass, no glow) and nothing of the Scan leaks into Glass; THE
   RATCHET: the count of hex colours, rgba() calls and px radii outside THE SYSTEM and THE SCAN sections of styles.css only goes
   down (write the number before and after in your report; a pure test holds it from here). Motion: the plan unfolds and the
   jump bar rises on the tokens' curve (--g-dur-bring); Reduce Motion lands them. Every key 44 pt; nothing sideways at 390 or
   440; every screen opens in under 300 ms on the preview (the speed habit).

8. **GLASS UNTOUCHED.** With the world Glass, every screen is exactly as today (a screenshot diff of three screens in the spec).

## What must not change

The prompt guard; the CI guard job; `.github/*`, `apps/*/package.json`, the kernel files untouched; no packages, nothing from the
network, no new keys; never a model name; THE SCAN's Home (home.ts, world.ts, film.ts, place.ts, score.ts, scene.ts) and the
Lens untouched but for the hooks this pass needs (the house drawn by a shared piece both use); the finding rule's test from pass
1 kept and extended (every screen still reachable in two taps for recents and favourites, three or one typed word for the rest,
in both worlds); the eight pinned specs (BRIEF-SHELL names them: tabs, ui, layout, nav, deck, settings, hubcards, scroll and
scrollfeel among them) RE-CUT IN PLACE to the new drawing, never loosened; the specs' names stay and check.yml is not touched.

## Tests (each fails on the code before this brief; run them against it once and say so)

1. tabs/nav: in The Scan, every screen has the house with `YOU ARE IN <ROOM>` right and the room lit; a tap on `THE HOUSE`
   unfolds the plan with 45 things numbered in 7 rooms, the current room lit; a tap on `04 Radio` opens Radio; the finding test
   passes in both worlds.
2. The jump bar: a tap in the field shows FAVOURITES and RECENT (the pinned first); typing "rad" shows CHECKED … FOUND IN PLAN
   and the box on RADIO · 04 with OPEN; Enter opens it; the open under 300 ms (median of five, as today).
3. A hub (LEARN): the band has one reticle per thing with its number; AT HAND lists recent and starred with two readings; THE
   REST has the others with one line; "open two" by words opens the second; every screen the hub reaches today is reached.
4. Every screen: FAVOURITES, RECENT, then the rooms in order with numbers and one line; a number typed opens that screen.
5. Settings: every row of today present, grouped and numbered, the value at the right.
6. Glass unchanged: three screenshots (Home, LEARN, Settings) within the spec's pixel tolerance of before.
7. The ratchet: the count outside THE SYSTEM/THE SCAN sections is lower than before (the number in the test).
8. 44 pt and nothing sideways at 390 and 440 on the plan, the jump bar, a hub, Every screen and Settings; Reduce Motion lands.

## Validation before the PR (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; results to the scratchpad file)

`cd apps/web && npx tsc --noEmit -p . && node build.mjs`; the brain untouched (say so); the preview on PORT 8799 (never 8797
or 8798; another builder uses 8798); ONE AT A TIME with `BASE=http://localhost:8799 timeout 480 node tests/<name>.spec.mjs
tests/.shots`: tabs, nav, layout, deck, settings, hubcards, scroll, scrollfeel, thescan, routec, character; another builder
shares these two cores: if a timing check fails only under load, say so and run it once more alone. Screenshots of the plan,
the jump bar typed, LEARN, Every screen and Settings at 440 and 390 into the scratchpad.

## The owner's phone check (write it into your report in these terms)

(1) Any room: the house along the bottom, YOU ARE IN it; tap THE HOUSE: the plan of every room unfolds; tap a number: it opens.
(2) Tap the field: your favourites and recents rise; type three letters of a screen: it is found and OPEN opens it. (3) LEARN:
the band with the things numbered, AT HAND with their readings, THE REST folded; say "open two". (4) Every screen from the logo:
the whole inventory, scrolling. (5) Settings as the plate. (6) Switch to Glass in the Theme page: today's shell exactly. (7)
Does it feel like one HUD now, tabs included?

## Report

In the scratchpad file (shell2-report.md): every commit's hash and one line; each spec's result verbatim; the ratchet's numbers;
the screenshots; the calls you made that the brief left open; the owner's phone check; what you did not do and why. Never push.
Never touch a protected file. Named by tier, never by model.
