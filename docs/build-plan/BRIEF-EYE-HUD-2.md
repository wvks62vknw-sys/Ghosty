# BRIEF: THE EYE 2 — the rooms as the wall, the film, abilities as a feed, and what the first pass left (nothing new added to the app)

BRIEF-EYE-HUD-2 (OWNER-ISSUES 178 "insane quality … even things in the past"; 184's WHATS-LEFT list 4 "a second pass on THE EYE look";
eyehud-report's NOT REACHED and found-not-fixed; 155 "every theme as like a whole different hud as a whole like even the tabs are different";
157 "ENTIRELY different looks"). The mid tier. One builder, one PR. THE DESIGN IS STILL ROUND ONE'S W3 AND THE WALL OF ROUND THREE
(docs/build-plan/mockups/directions-2/w3/home-440.png, hub-440.png and its README; docs/build-plan/mockups/hud/2026-11-08-3/wall.png and its
README): the first pass built Home as the wall and the instruments on every screen; a ROOM in the eye is still The Scan's room in dotted plates,
which is not a whole HUD. This pass finishes the world. Starts from the session branch's head AFTER THE GAME STUDIO is on main (the hubs' file
shell/hubcards.ts settles only then: the EDITORS card and its seven pills), so nothing here fights the folds. Read STANDARD.md, BRIEF-EYE-HUD.md
and its report (scratchpad/eyehud-report.md: the world screen by screen, the shared-file lines, the five found-not-fixed), BRIEF-MAP-EYE-HUDS.md
(the world pattern), the code (features/core/eye/{home,ground,grain}.ts, shell/house.ts eyeOn, shell/hubcards.ts, shell/boot.ts and its film,
features/core/scan/film.ts, abilities/*, styles.css THE EYE, design/tokens.css) and tests/eyehud.spec.mjs. THE QUALITY RULE holds.

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Protected files, not edited: apps/edge/src/agent.ts, apps/edge/src/index.ts, apps/edge/src/tools/{index,types,repo}.ts, .github/* (except the
one spec word at the END of check.yml's `all=` list; the guard job untouched), apps/*/package.json. No package, nothing from the network the
page does not already use, no new key.

## What is built

1. **A ROOM IS THE WALL (hub-440.png and its README; found-not-fixed 1).** In the eye, each of the seven rooms' hub screens (SEE, MAKE,
   LEARN, PLAN, LIFE, ME and Home's own SCREENS/ABILITIES feeds when opened) is drawn as the wall: the room's things as grain feeds (each
   card of shell/hubcards.ts becomes a feed with its tag and its one true reading, the EDITORS card a feed whose seven pills are seven small
   feeds inside it), the thing he used last in that room the ONE sharp feed in the accent box, the line of sight from the instruments' sharp
   key up to it, `LOOKING AT <ROOM> · N FEEDS` as the kick row, his favourites in that room in bracket corners; a tap on a feed opens the
   thing, a long press pins; nothing invented: the readings are the cards' own (hubcards.ts's facts), the grain is grain.ts's. The Scan's,
   ONE INK's, THE MAP's and Glass's hubs untouched (the eye's drawing is a branch the world picks, as Home's is). Every control 44 pt; nothing
   sideways at 440 and 390; BODY 21 clips nothing; the room opens under 300 ms (median of five) as the rule says.
2. **THE FILM FOR THE EYE (NOT REACHED 1; BRIEF-EYE-HUD item 4 said the Scan's boot plays).** The boot in the eye ends as the eye: the last
   second of the film (shell/boot.ts's storyboard, the eye's branch only) is the wall resolving from grain, one feed sharpening into the
   accent box, the line of sight drawn, and Home lands with no cut; the boot's budget and its shots for the other worlds unchanged (the boot
   spec's own checks stand; the eye's shot is added, not swapped); Reduce Motion lands on the still wall.
3. **ABILITIES AS A FEED (NOT REACHED 3).** Home's ABILITIES feed and the room's abilities open as the wall of what Ghosty can do in that room
   (abilities/*'s list, one feed each with its one-line "I can …"), the one he asked about last sharp; a tap asks it in the ask line (the
   existing ASK path); nothing new learned here.
4. **WHAT THE FIRST PASS FOUND AND LEFT (found-not-fixed 2 to 5).** (2) at BODY 21 the ask line sits under the instruments until the wall is
   scrolled: the wall's bottom row reflows above the ask line at the biggest text (measured at 390 and 440, nothing hidden); (3) the globe's
   first start on software GL is a silent ~2 s that can land under a tap on the first Home after a boot: the ground says once, in the stamp's
   own small line, "Lighting the ground…" while it starts and nothing is under it until it is lit (on a phone GPU it is tens of ms and the line
   never shows), measured before and after on the preview; (4) offline is designed: the stamp's "OFFLINE, FEEDS PAUSED" stands and each feed
   whose reading needs the signal shows its last reading with its age in grain (POLISH 1's offline voice, one line), never a blank feed; (5)
   is item 2 above.
5. **THE WORDS.** "show me the eye" still belongs to God's Eye (eyehud-report's NEEDS HIS WORD, decided under 179: God's Eye's words win, as
   the first pass left it); the eye's new lines (`Looking at <room> · N feeds`, `Lighting the ground…`, `I can …`) in the eye's own words file
   (features/core/eye/words.ts) the spec imports; one sentence each.
6. **THE LOOK.** Only tokens (design/tokens.css) and THE EYE section of styles.css; THE RATCHET's ceiling holds (hex 506, rgba 1016, radiusPx
   470, total 1992: equal or lower; grain is drawn, not styled); motion on the tokens' curve; Reduce Motion lands.

## What must not change

The other four worlds' every screen (The Scan, ONE INK, THE MAP, Glass pixel-equal); God's Eye's own screen and camera; the boot's budget and
the other worlds' boot shots; the finding rule in five worlds; the first-screen budget (speed2) and the look page's 300 ms hold; hubcards.ts's
facts and the EDITORS fold (the eye draws them, it does not change them); the prompt guard; no new key; nothing that costs money; the brain
never gets live GPS; no model name; `.github/*` beyond the one word.

## Tests (each fails on the code before this brief; run against it once and say so)

- tests/eyehud2.spec.mjs (new; `all=` word `eyehud2` at the END of the list in check.yml, nothing else in .github touched), at 440 and 390,
  world eye: (a) each of the seven rooms is the wall: feeds with the cards' own readings, exactly one sharp feed (the last used), the line of
  sight, the kick row's words, the EDITORS feed with seven small feeds, a tap opens the thing, a long press pins, under 300 ms (median of five,
  rerun alone before red); (b) the boot's last shot in the eye is the wall (the boot spec's harness), Reduce Motion lands on the still wall,
  the other worlds' shots byte-equal to before; (c) ABILITIES as the wall, a tap asks; (d) BODY 21: the ask line above the instruments on both
  phones with the wall's last row reflowed; (e) the ground's "Lighting the ground…" line shows while software GL starts and is gone within 3 s,
  and never shows when the ground is lit under 300 ms (mocked); (f) offline: every feed that needs the signal shows its last reading and its
  age, none blank, the stamp says paused; (g) The Scan, ONE INK, THE MAP and Glass drawn as before (eyehud's part e, extended to the rooms).
- eyehud, hubcards, deck, nav, boot, look, ink, maphud, routec, speed2, thescan, finding.test unchanged unless a fix lives in a screen they
  own; then that spec's check is the proof, red before, green after, nothing loosened. The ratchet equal or lower.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`. The preview's brain bundle as the passes do (`npx esbuild src/index.ts
--bundle --format=esm --platform=neutral --external:cloudflare:sockets --outfile=test/.build/brain.mjs` in apps/edge). Preview on port 8845:
`(nohup setsid node tests/preview-server.mjs 8845 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8845.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call. Specs from the worktree ROOT: `BASE=http://localhost:8845 NO_GL_SHOTS=1 timeout 590 node tests/<name>.spec.mjs tests/.shots`
(eyehud2 and eyehud with GL on for the ground); a nogl copy as `tests/.<name>.nogl.tmp.mjs` and tests/.shots are NEVER committed (`git status`
before every commit; tests/.shots removed after every run). In the foreground, alone, one after another: eyehud2, eyehud, boot, hubcards, deck,
nav, look, ink, maphud, routec, speed2, thescan; the brain tests once at the end in the background with a 1700 s cap, polled. A timing budget
missed under load is rerun alone before it is called red and the budget is never changed; a spec killed at 590 s with no failure line is rerun
once alone and, if killed again, reported as that with the last line it printed. Known sandbox reds not touched: direct, aim, radio's audio,
scroll, safari, eye's own screenshot, tabs2's jump bar at 390, tabs' taps under load, nav's CDP close, speed2's first screen under load, look's
BODY 21 cut on the Theme page, talk's cooling lines. One spec at a time; the machine is shared.

## The owner's phone check

1. Settings → Theme → THE EYE. Tap SEE: the room is a wall of grain feeds, the one you used last sharp with the line up to it; tap a feed.
2. MAKE: the EDITORS feed holds seven small feeds; tap VIDEO's. Hold a feed: it pins; hold again: it unpins.
3. Close the app and open it: the boot ends with the wall resolving from grain into Home, no cut. Reduce Motion on: it lands still.
4. Home → ABILITIES: the wall of what Ghosty can do here; tap one: it is asked.
5. Biggest text: the ask line sits above the instruments on every room without scrolling.
6. Aeroplane mode: feeds that need the signal show their last reading and how old it is; none is blank; the stamp says the feeds are paused.
7. Back to THE SCAN, ONE INK, THE MAP and GLASS: each exactly as before. Does THE EYE now feel like a whole different app, rooms included?

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/eyehud2-report.md: every commit's hash and one line; each
room against hub-440.png; the boot's eye shot; the ground's start time before and after; the ratchet line; each spec's last line (before and
after for the new one); the other worlds' shots proven unchanged; NOT REACHED; found-not-fixed; NEEDS HIS WORD; the phone check as above. One
commit per step on builder/eyehud2; the orchestrator squashes to one on landing. Never push. Named by tier, never by model.
