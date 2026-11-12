# BRIEF: THE EYE — the fourth whole HUD

After THE SCAN (default), ONE INK, THE MAP and GLASS as today's look (OWNER-ISSUES 155 "every theme as like a whole different hud as
a whole like even the tabs are different", 157 "ENTIRELY different looks … each one to be an option … prebuilt apart from the
colours", 160, 165 the gallery where THE EYE carries COMING). THE DESIGN IS ROUND ONE'S W3 AND THE WALL OF ROUND THREE
(docs/build-plan/mockups/directions-2/w3/home-440.png, hub-440.png, README.md; docs/build-plan/mockups/hud/2026-11-08-3/wall.png and
its README). THE EYE is attention as the material: Home is a wall of feeds in grain, one thing sharp in an accent box (tonight's), the
orb below with the line of sight drawn up to it, his recents at the edge of attention (clocked), his favourites in bracket corners
(starred), the rooms as grain feeds with `N screens`, and under the wall `IN FOCUS: TONIGHT · AT THE EDGE: STARRED`. The owner's
line for this pass names God's Eye's globe as the ground of the screen with the rooms as instruments round it; the mock and its README
win where they differ (the globe is a feed on the wall), so the globe is both: the engine's own globe turns slowly under the wall as
its living ground, in grain, and is the God's Eye feed's picture. Read STANDARD.md, BRIEF-SHELL-2.md (the shape), BRIEF-MAP-EYE-HUDS.md
(the pattern THE MAP followed: a `world` in WORLD_KEYS, `[data-world]` tokens, a looks.ts entry `built: true`, the shell's pieces drawn
by the world's tokens, Home as the world's own page, a spec) and the code (shell/house.ts, features/core/index.ts, features/core/map/
home.ts as the model, engine/globe.ts, engine/scheduler.ts, tokens.css, styles.css THE SYSTEM and THE MAP). The mid tier.
BASE: this branch carries THE MAP's seven commits first (cherry-picked from builder/huds, unchanged) so every line the two share is
written once; the commits after them are THE EYE's alone and apply on top of THE MAP wherever it has landed.

## What is fixed

1. **THE EYE IS A WORLD HE CAN BE IN.** looks.ts: `world: 'eye', built: true`; a tap on its card applies `recipe.world = 'eye'` at once,
   kept across a reload, the card says YOU'RE IN IT; "the eye" / "switch to the eye" / "the eye look" by words switches to it (the colour
   stays his; "the eye of the storm" and "show me the eye" are never taken). "orbit" and "grown up" still say their line and change
   nothing. The colour is his: the accent is the one sharp box, the line of sight, the lit key and the SPEAK key.
2. **HOME IS THE WALL (w3/home-440.png).** On a phone, world eye: the stamp line (the shell's one source); `Good evening, Boss.` and the
   Machine's one sentence (a reply's words replace it, as in the other worlds); the engine's globe in grain as the ground under the
   wall (one canvas the page already owns, started after the first paint, drawn at a few frames a second that drop to a still when the
   phone is busy and stop under Reduce Motion or MOTION calm); THE WALL: the rooms as grain feeds (SEE, MAKE, PLAN, LIFE across the top;
   LEARN, ME, SCREENS, ABILITIES across the foot, each with its `N screens` / `All 44` / `All I do`), the recents and favourites down both
   sides (two recents clocked, up to four favourites starred in bracket corners, a free square saying nothing yet), tonight's thing the
   one sharp feed in the middle in the accent box named with its tag and its one true reading, the orb under it with the line of sight
   (dashed) up to the box; `IN FOCUS: TONIGHT · AT THE EDGE: STARRED`; the ask line `Ask, or say what to look at` with the mic. A tap on
   a feed opens it (a room's feed goes into the room, a favourite or recent opens the thing, tonight's does what tonight says), a long
   press on a recent or favourite pins or unpins it. Nothing is invented: tonight's thing is the book, else the agenda's next, else the
   Brief (ink/home.ts's one source, `tonightEntry`, computed from the real agenda each time). Not a `<nav>` anywhere in it (layout and
   library specs read the first nav as the dock). Glass's, The Scan's, ONE INK's and THE MAP's Homes untouched.
3. **THE INSTRUMENTS ARE THE TAB BAR ON EVERY SCREEN IN THE EYE.** The house of seven rooms (shell/house.ts, one list with the other
   worlds) drawn as a row of seven instruments: each key a small feed (a grain picture of its own) with the room's word under it, the one
   he is in the one sharp feed (an accent box, no grain, its word lit), the kick row reading `THE WALL · 7 FEEDS` and `LOOKING AT <ROOM>`;
   the field under it is the jump bar (`Ask, or say what to look at` on Home, the screens' own words elsewhere); a tap on the kick
   unfolds THE PLAN, drawn as the wall (a feed for each room with its things, the room he is in boxed). Every screen ends above the bar
   (`--dockh`, measured as ever); toasts stand above it; keys 44 pt; nothing sideways at 390 and 440. The finding rule holds in this world as
   in the others (two taps recents and favourites, three or one typed word the rest); the jump bar's plates are dotted with the accent box
   locking on the find.
4. **THE BOOT** in THE EYE is the one Glass plays today (shell/boot.ts already knows the world 'eye') and lands on the wall; nothing new is
   drawn for it in this pass (said). THE FILM stays The Scan's.
5. **THE LOOK.** Only tokens (design/tokens.css) and THE SYSTEM section of styles.css; the eye's tokens are extended where the mock needs a
   value the tokens lack (each named in the report). Nothing of The Scan's room, ONE INK's page or THE MAP's plane in an eye screen;
   nothing of the eye in theirs. THE RATCHET: ratchet.test's ceiling hex 506, rgba 1016, radiusPx 470, total 1992 holds, equal or lower.
   Motion on the tokens' curve; Reduce Motion lands; Home opens under 300 ms on the preview (the look page's 300 ms hold and speed2's
   first-screen budget under 1,000 ms unchanged: the globe starts after the first paint and never before Home is shown).
6. **THE WORDS.** "the eye" switches; "show me the looks" lists the seven with the eye built; the eye's own words are the mock's
   (`Ask, or say what to look at`, `In focus: tonight`, `At the edge: starred`, `N screens`, `Looking at`).

## What must not change

The prompt guard; the CI guard job; `.github/*` (beyond the one `all=` word); `apps/*/package.json`; the kernel and the edge's protected
files; no packages, nothing from the network the page does not already use (the globe's own data is the site's own world pack), no new
keys, nothing that costs money; the brain never gets live GPS; never a model name; THE SCAN's files (scan/*.ts) and the Lens untouched;
ONE INK's page and THE MAP's page untouched; God's Eye's own screen unchanged (the globe's camera is put back when Home lets go of it);
the finding rule's test kept and extended to the fifth world; specs' names stay and every re-cut is in place, never loosened.

## Tests (each fails on the code before this brief; run against it once and say so)

1. tests/eyehud.spec.mjs (new; `eyehud` last in check.yml's `all=` list): (a) the gallery: the eye's card has no COMING; a tap sets
   recipe.world 'eye', says YOU'RE IN IT, survives a reload; THE SCAN back; "the eye" by words switches. (b) Home at 440 and 390: the
   stamp, the greeting and one sentence, the wall with its rooms as feeds and their counts, exactly one sharp feed (tonight: the book, the
   agenda or the Brief from the agenda's real content) in the accent box, the orb and the line of sight, recents and favourites as feeds
   (a tap opens, a long press pins), the ask line and mic, the instruments with seven keys and Home sharp; no scan marks, no ink frame, no
   map plane; no `<nav>` before the dock; nothing sideways; every control 44 pt. (c) The instruments on LEARN and Settings with the sharp
   key on LEARN / ME; the page ending above; the plan from the kick with seven rooms; the jump bar finds "rad" → RADIO · 04 under 300 ms.
   (d) Home under 300 ms (median of five) and the ground's cost: the globe starts after the page is shown, its frame rate drops when the
   phone is busy and it draws nothing under Reduce Motion or MOTION calm; God's Eye's camera is as it was on leaving Home. (e) The finding
   test in five worlds. (f) Scan, Ink, Map and Glass drawn as before.
2. Re-cuts only where a check counts looks or worlds: look.spec, routec, ink.spec (COMING looks three to two, "the eye" now switches),
   finding.test (five worlds), the map's own spec (its words check said "the eye" changes nothing), each said in the report.
3. The ratchet: equal or lower.

## Validation before the report (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; results to the scratchpad file)

`cd apps/web && npx tsc --noEmit -p . && node build.mjs`; the brain's tests (about ten minutes, background); the preview on PORT 8808
only; then EVERY spec in the `all=` list one at a time in the foreground against it (`BASE=http://localhost:8808 NO_GL_SHOTS=1 timeout
600 node tests/<name>.spec.mjs tests/.shots`; God's Eye specs through a temporary no-screenshot copy, deleted after), each one's last
line written to the report; sandbox reds that are not mine (direct, aim, radio, scroll, safari, eye's own screenshot, tabs2, talk's
cooling lines, look's "Theme page cuts words at BODY 21") said as such; a timing miss under load rerun alone; routec then eyehud on one
server.

## The owner's phone check (written into the report in these terms)

(1) Settings → Theme: tap THE EYE: Home is a wall of grain feeds, one sharp (tonight), the orb under it with a line to it, the globe
turning faintly behind. Does it read as an eye watching, not a dark theme of the same app? (2) Tap a feed (a room): it opens, the
instruments are along the bottom with that room sharp; the page ends above them. (3) Tap the kick over the instruments: the plan unfolds
as the wall; tap a feed. (4) Tap the field, type three letters: found; OPEN opens it. (5) LEARN as a room in the eye. (6) Settings in the
eye. (7) Back to THE SCAN, ONE INK, THE MAP and GLASS: each exactly as before. (8) Say "the eye" in the chat: it comes back. (9) Does it
feel like a different HUD, tabs included? (10) With Reduce Motion on the globe stands still.

## Report

In the scratchpad file (eyehud-report.md): every commit's hash and one line; the world screen by screen against its mock; the re-cuts;
the shared-file lines written to merge with THE MAP; each spec's last line verbatim and its verdict; NOT REACHED; NEEDS HIS WORD; the
owner's phone check. Never push. Named by tier, never by model.
