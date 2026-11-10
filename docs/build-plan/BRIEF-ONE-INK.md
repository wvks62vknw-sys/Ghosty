# BRIEF: ONE INK — the second whole HUD: a printed page, tabs included

The second look built as a whole HUD, after THE SCAN (OWNER-ISSUES 158 "the second HUD: the orchestrator's call: ONE INK"; 157
"ENTIRELY different looks … prebuilt apart from the colours"; 155 "every theme as like a whole different hud as a whole like even
the tabs are different"; 164 "all of this needs to be built"; 165 the gallery, where ONE INK carries COMING today; 166 the shell in
The Scan on main). THE DESIGN IS THE ROUND-TWO MOCK: docs/build-plan/mockups/hud/2026-11-08-2/ink-home.png (view it) and
ink-home.html + hud2.css lines 52–83 (the exact type, rules and spacing: `.ink`, `.mast`, `.say`, `.say2`, `.orbwrap`, `.entry`,
`.lists`, `.inkask`, `.foot`), ink.js (the orb drawn in ink: the real orb with its accent bone and its glow 0), and the README's
"ONE INK's Home" paragraph (line 113) and question 7 (line 142). Round one's direction D2 is the look's source (packages/shared/
src/themes.ts WORLDS 'ink': "One ink, rules instead of boxes, and a serif when I talk."; the preset 'oneink': warm ground, gold).
Read STANDARD.md first, then this, then BRIEF-HUD-SCAN-1.md (how THE SCAN's Home was built as a world: the seams in
apps/web/src/features/core/index.ts lines 735–748 and 996–1020, `scanHome` in features/core/scan/home.ts: enter/leave, the body
class, what it takes from Core: the stamp, the caption, the orb's wrap, the ask line), BRIEF-SHELL-2.md and the shell as it is on
main (apps/web/src/shell/{house,rooms,inventory,jump,layout,areas,launcher}.ts: `houseOn` is The Scan's on a phone; the plan, the
jump bar, the rooms, Every screen and Settings read ONE list), BRIEF-THEME-GALLERY.md and apps/web/src/ui/gallery.ts +
packages/shared/src/looks.ts (how a built look applies its world), apps/web/src/design/tokens.css `[data-world="ink"]` (the ink
world's tokens already exist: no floor, no glow, radii 0, plates transparent, the serif as my voice: `--g-face-say`), styles.css's
THE SYSTEM section (THE SCAN's and the shell's drawing live there; so does ONE INK's), and apps/edge/test/ratchet.test.mjs (the
count outside THE SYSTEM only falls). The mid tier. Start from the session branch (main's tree).

## What is fixed

1. **ONE INK IS A WORLD HE CAN BE IN.** In the gallery its card is built (looks.ts: `world: 'ink', built: true`), a tap applies
   `recipe.world = 'ink'` at once (kept across a reload, as The Scan's), the card says YOU'RE IN IT, and "one ink" by words
   switches to it again (the gallery brief's call (f) reversed for ink alone; "the map", "the eye", "orbit", "grown up" still say
   their line and change nothing). The colour stays his (the twelve): ONE INK's accent is the one place his colour shows (the
   stamp's LOOKING AT, the index `01`, the tag, the SPEAK key), as the mock draws it.

2. **HOME IS THE PRINTED PAGE (ink-home.png), exactly.** When the world is ink and the tab is Home, on a phone: the warm ground
   (`--g-canvas` of the ink world; no scan, no room, no floor, no glow, no plate), the stamp line as the masthead with a rule
   under it (the shell's one source: `SUN 8 NOV · 21:08 · BIRMINGHAM · WATCHING 3 FEEDS · LOOKING AT HOME`), MY VOICE IN THE SERIF
   (the greeting at 36 px, `Good evening, Boss.`, from the same greeting source Home has today; the second line italic 20 px: the
   latest reply's line / the Machine's one sentence, from the caption Core already keeps, never a second text), THE ORB DRAWN IN
   INK on an equator rule (the real orb, Mind, with its wrap given bone as its accent and glow 0: the points, the meridians, the
   equator and its scale, the core; 246 px at 440; it still answers a tap as the reactor does), ONE ENTRY (`01 TONIGHT · Reading`,
   the thing's name in the serif at 26 px, its one true line in mono, two keys: the thing's own action as a fill key and its second
   as a ghost key; the thing is the one the Machine is looking at tonight: the same source as THE SCAN's room (the book being
   read, else the next thing in the agenda, else the brief): find it in scan/place.ts and core/index.ts's callouts; never
   invented), RECENT and FAVOURITES as underlined words on rules (shell pass 1's recents and favourites; a tap opens; a long press
   on a word pins or unpins, as the deck does), THE ASK LINE AS A RULE (`Ask or find anything` in the italic serif, SPEAK at the
   right in the accent; a tap opens the jump bar as on every screen; SPEAK is the mic as the talk bar's is), and THE ROOMS AS A
   RUNNING FOOT (the eye for Home, then SEE MAKE LEARN PLAN LIFE ME in the mono key type, the room he is in in ink-1, the rest
   ink-2; every key 44 pt). Nothing else on Home: no feeds row, no callouts, no plates. Glass's and The Scan's Homes untouched.

3. **THE FOOT IS THE TAB BAR ON EVERY SCREEN IN ONE INK, and the shell's pieces are drawn in ink.** Every screen (not only Home)
   ends above the foot, as the Scan's pages end above the house (`--dockh`, measured; shell/house.ts); the foot is the mock's:
   the eye for Home, the six rooms as words, the one he is in lit; under it nothing (ONE INK has no second ask line on a room's
   screen: the field is the jump bar, reached from the ask line on Home and from the ⌘K/CMD key, and from `/` as today). THE PLAN,
   THE JUMP BAR, A ROOM (the band, AT HAND, THE REST), EVERY SCREEN and SETTINGS are the same pieces as The Scan's (one source, one
   list), drawn by the ink world's tokens: rules instead of boxes, radius 0, no plates, no reticle arms (`--g-ret-arm: 0`), the
   serif for the page title, mono for tags and numbers; the plan opens from a long press on the foot's eye and from the jump bar
   (a typed word finds; `the plan` opens it). Where a Scan piece reads `body.scanhome` or `data-world="scan"` it is generalised
   (`body.housed` for both worlds, a world attribute for the drawing), never duplicated: ONE source for the house and the foot
   (the foot is the house in another drawing: the same seven keys, the same `YOU ARE IN` state, no label row). The stamp line and
   the page title on every screen (the title in the serif in ONE INK).

4. **THE BOOT IN ONE INK.** The film is THE SCAN's (it lands in the Scan's world). In ONE INK the boot is the one Glass plays today
   (shell/boot.ts) and lands on the printed page; the score as his setting says. Nothing new is drawn for it in this pass; say so.

5. **THE LOOK.** Only tokens (design/tokens.css) and THE SYSTEM section of styles.css; the ink world's tokens are extended where
   the mock needs a value the tokens lack (name each). Nothing of The Scan (points, reticle arms, plates, the room) and nothing of
   Glass (blur, rounded glass, glow) in an ink screen; nothing of ink in theirs (a pixel diff of Home, LEARN and Settings in The
   Scan and in Glass against the build before shows only live readings differing). THE RATCHET: the count outside THE SYSTEM only
   falls or stands (the number before and after in the report; the test's ceiling moves down if it fell). Motion: pages arrive as
   today; the plan and the jump bar on the tokens' curve; Reduce Motion lands them. Every key 44 pt; nothing sideways at 390 or
   440; Home in ONE INK opens in under 300 ms on the preview; a room's screen likewise (the speed habit).

6. **THE WORDS.** "one ink" → the world; "show me the looks" lists the seven as today; the stamp and the greeting from their one
   sources; ONE INK's own words are the mock's, exactly (`Ask or find anything`, `Speak`, `Tonight`, `Recent`, `Favourites`,
   `Carry on reading`, `Listen`).

## What must not change

The prompt guard; the CI guard job; `.github/*`, `apps/*/package.json`, the kernel files untouched (adding ONE spec word to
check.yml's `all=` list, `ink`, is the established practice and the only touch); no packages, nothing from the network, no new
keys; never a model name; THE SCAN's Home (scan/*.ts) and the Lens untouched but for the hooks this pass needs (a shared piece both
worlds use); the finding rule's test kept and extended to the third world (every screen still reachable in two taps for recents and
favourites, three or one typed word for the rest, in ALL THREE worlds); the specs' names stay; every re-cut in place, never loosened.

## Tests (each fails on the code before this brief; run them against it once and say so)

1. tests/ink.spec.mjs (new; the word `ink` added to check.yml's `all=` list after `routec2`): (a) the gallery: ONE INK's card has
   no COMING; a tap sets recipe.world 'ink' at once, says YOU'RE IN IT, survives a reload; a tap on THE SCAN brings The Scan back;
   "one ink" by words switches. (b) Home in ink at 440 and 390: the masthead stamp, the serif greeting and the italic second line
   (the caption's words, one text), the orb present with glow 0 on the equator rule, exactly one entry with `01`, `TONIGHT`, a name
   in the serif, one true line, a fill key and a ghost key; RECENT and FAVOURITES rows with underlined words; the ask line and
   SPEAK; the foot with seven keys, Home lit; no `.scanmarks`, no `.scanleads`, no feeds row, no plate, no glow (the computed
   `--g-glow` 0, `backdrop-filter` none on every element); nothing sideways; every control 44 pt. (c) The foot on LEARN and
   Settings with LEARN / ME lit; the page ends above the foot; the plan from a long press on the eye with 7 rooms; the jump bar from
   the ask line finds "rad" → RADIO · 04 and opens it under 300 ms. (d) Home in ink under 300 ms (median of five). (e) The finding
   test in three worlds (extend apps/edge/test/finding.test.mjs or the spec that holds it). (f) A pixel diff of Home, LEARN and
   Settings in The Scan and in Glass against the build before: live readings only.
2. Re-cuts: look.spec section 7 and routec [themes]/[themes2] (ONE INK is built: five COMING become four; "one ink" switches);
   character/routec where "one ink" was a no-op; any spec that counts `[data-built]` cards; settings.spec if the plate's drawing
   is read by world. Every check kept or replaced by its opposite; list each in the report with old and new selectors.
3. The ratchet test's number: equal or lower.

## Validation before the PR (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; results to the scratchpad file)

`cd apps/web && npx tsc --noEmit -p . && node build.mjs`; the brain's tests (`cd apps/edge && PATH=$PWD/node_modules/.bin:$PATH
npm test`: the finding and ratchet tests read the web's source; say the numbers); the preview on PORT 8798 (`nohup setsid node
tests/preview-server.mjs 8798 > ../preview.log 2>&1 < /dev/null &` from the worktree; never 8797); then EVERY SPEC IN check.yml's
`all=` LIST plus `ink`, ONE AT A TIME IN THE FOREGROUND with `BASE=http://localhost:8798 NO_GL_SHOTS=1 timeout 480 node
tests/<name>.spec.mjs tests/.shots` (nav and routec 720; scroll and safari need WebKit, which this sandbox lacks: run them with
CHROMIUM_ONLY=1 and say so; God's Eye's screenshots hang here: for eye, machine, media, streetview, map, places make a copy
tests/.<name>.nogl.tmp.mjs with each `page.screenshot` given `timeout: 15000` and `.catch(() => undefined)` and the 'detached' wait
90000, run the copy, DELETE THE COPY; a red is rerun once alone; a red that is also red on the base commit is said so with its
words, never fixed in the spec). The lesson of the shell: a world's change runs every spec before it is reported; the orchestrator
lands nothing that has not. Screenshots of Home in ink at 440 and 390, LEARN, the plan, the jump bar typed and Settings into the
scratchpad.

## The owner's phone check (write it into your report in these terms)

(1) Settings → Theme: tap ONE INK: Home is the printed page: the masthead, my greeting in the serif, the orb in ink on its rule,
tonight's one thing with its two keys, RECENT and FAVOURITES as words, the ask line, the rooms as the foot. Does it read as a page
and not as a dark theme of the same app? (2) Tap a RECENT word: it opens; the foot is on that screen too, the room lit; the page
ends above the foot. (3) Hold the eye in the foot: the plan unfolds, drawn in rules; tap a number. (4) Tap the ask line, type three
letters: found; OPEN opens it. (5) LEARN as a room in ink. (6) Settings in ink. (7) Back to THE SCAN and to GLASS in the gallery:
each exactly as before. (8) Say "one ink" in the chat: the page comes back. (9) Does it feel like a different HUD, tabs included?

## Report

In the scratchpad file (ink-report.md): every commit's hash and one line; each spec's last line verbatim and its verdict; the
ratchet's numbers; the screenshots; the calls you made that the brief left open; the owner's phone check; what you did not do and
why. Never push. Never touch a protected file beyond the one `all=` word. Named by tier, never by model.
