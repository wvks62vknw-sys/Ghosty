# BRIEF: THE SCAN'S HOME — the whole of it with the room inside, the boot as the film with the descent, Home that knows where he is

The first build PR of the HUD after three mock rounds. His words and decisions, in order: OWNER-ISSUES 160 (8 Nov: "do ur thing
with the round three pick i'll let you pick tbh im a fan of them all": the pick is the orchestrator's, the three recommendations
of 159 taken as they stand), 159 (round three: the diagnosis of the room and the three worlds), 158 (round two's picks: 7 s "could
even be a bit longer … a little bit of pizzazz", the film "very good", where-he-is ON, the map provisionally, the score yes, the
camera move ok), 157 ("entirely different looks … prebuilt apart from the colours"; Home "should know when im home, when im out
etc and it changes its design based off that"; the boot "straight out of a high production hollywood movie"; "genuine billions
poured into it"), 156 ("longer, richer, the world assembling the scan building up and the feeds answering but in a better way …
polished like a high grade app that like a billionaire organisation would use"), 155 (a theme is a whole different HUD, tabs
included; his input before code every time: the mocks were that input), 153 (only what was asked; his phone before anything that
loads a model, the camera or the mic merges; smaller PRs). Read STANDARD.md first (the eleven tests, the floor not the ceiling),
then the two READMEs that ARE the design: docs/build-plan/mockups/hud/2026-11-08-2/README.md (the film's shot list and cue sheet,
Home by place, THE PRODUCTION RUBRIC) and docs/build-plan/mockups/hud/2026-11-08-3/README.md (the room's diagnosis, THE WHOLE OF
IT, ROOM+, how the finding rule holds). The top tier. ONE PR, committed in stages (below) so a stage can ship alone.

## What this PR is (and is not)

IT IS: (1) THE SCAN's Home as THE WHOLE OF IT with ROOM+ inside it; (2) the boot as round two's film, its dolly become the descent
from the sky to the desk; (3) Home that knows where he is, decided on the phone, said on the screen, one switch; (4) the house of
seven rooms along the bottom and the ask line, as the mocks draw them, with the finding rule held by the test shell pass 1 added.
IT IS NOT: the Lens that just knows (its own PR after this), the Theme page as the gallery (its own PR), ONE INK (its own PR), any
other screen, any new model, anything that costs money, any key. Nothing in the three mock folders ships as code; their math is
yours to lift (`scene3.js`, `world3.js`, `home3.js`, round two's `film.js`, `scene.js`, `world.js`), their pipelines are not.

## The design, fixed (do not re-decide; ask only where this page is silent)

1. **THE WHOLE OF IT is Home.** One frame from the sky to his desk, exactly `2026-11-08-3/world.png`: three aircraft with trails,
   the city as hairline blocks lit with windows on a street grid at 1:6, the far towers round the station, his street at 1:1 with
   its lamps and the houses across the way with a few lit windows, his house with the roof lifted and the front wall gone, the
   room lit inside it, the lamp and the book lit on the desk; the orb over the city with its line of sight dropping to the one
   thing the Machine is looking at (tonight's book at home). The Machine's miniature, not a map: no tiles, no names on the city.
2. **ROOM+ is the room inside it**, exactly `room-plus.png`: the camera low and three-quarter from his side of the desk, the desk
   running away at an angle, the shelf left, the calendar right, the city at a slant through the window; the lamp a thing in the
   room (base, stem, cone of points, one bright bulb) that lights the desk's right end and the calendar; the light ON THE POINTS
   (each point carries how warm and how cool it is lit: `aWarm`, `aCool`; the lamp a point light with a downward cone; the city's
   cool light from the window), never a wash over the type; the orb over the desk lighting it from above; his chair pulled out
   where he left it; his mug by the book. The eight things of round one keep their marks (the reticle by data-box, the tag, the
   one true line, the callout and its leader).
3. **Where Home lands.** The world frame at the boot (the film lands there) and whenever he opens Ghosty after an absence of twenty
   minutes or more; the room when he has just been in it (left it under twenty minutes ago) or when he came from a thing in the
   room. The camera moves between them (quintic in-out, `--g-dur-bring` 900 ms): a pinch out goes up (room → street → city → the
   whole), a pinch in goes down, a tap on a place goes there (the house, the station, the aircraft), and the house along the bottom
   and the orb are always a way back. Under Reduce Motion the altitudes are stills that cross-fade.
4. **The finding rule holds (139, 156, shell pass 1's test):** from the world frame tonight's thing is one tap (the lit book or
   its callout); the shelf and the aircraft one tap; the Brief, the Lens, the Gym and Courses two (into the room, then the thing)
   or one typed word in the jump bar; the seven rooms one tap along the bottom; everything else two or three. In the world frame
   the room's small things are NOT marked (they would stack; the book's box is held to 44 pt); in the room all eight are.
5. **Home knows where he is**, exactly round two's section 2: three places, each a visibly different Home, each said in one mono
   line under the stamp. AT HOME (the world landed on the room or the house; Now is tonight's book or this morning's Brief by the
   hour): `AT HOME · FROM YOUR SAVED PLACE · NEVER SENT`. OUT (the same world landed on the street and the city by day, him ringed
   on the walk, the nearest saved place locked; Now is the way home): `OUT · FROM THE PHONE'S OWN SENSE · NEVER SENT`. ON THE WAY
   (the city turned to the line, the train a lit point with its trail, the next stop locked; Now is the train and what is after
   it): `ON THE WAY · <speed> MPH · THIS PHONE · NEVER SENT`. HOW THE PHONE KNOWS, and the rule that cannot bend: decided in the
   shell on the phone from his saved places (Settings → Voice & home), the hour, whether the phone is still or moving and how
   fast, and the phone's own sense of place ONLY where the browser gives it and he has allowed it; nothing of it is sent anywhere;
   the brain never gets live GPS (131: the one rule); what reaches the brain is at most a word (home, out, on the way) and a saved
   place's name, and only with his question (through the awareness protocol's `ClientContext`, as the voice line does). One switch
   in Settings → Voice & home, ON by default (158: "on"); off, the line says `SAVED PLACE ONLY` and Home is the home world at every
   hour. The stamp's place is a saved place's NAME, never a coordinate. If the browser gives no sense of place, say so in the line
   (`FROM THE HOUR AND YOUR SAVED PLACE`) and never guess.
6. **The boot is the film**, round two's cut (`2026-11-08-2/cut.json`, the shot list and the cue sheet in its README, Home usable
   at 7.0 s, the whole 8.2 s), with ONE change decided in 159/160: the dolly of shots 1–4 becomes THE DESCENT, the camera starting
   in the sky over the city (the world frame's far end: the aircraft, the city lighting up block by block as the scan reaches it)
   and coming down the street and into the room, so the film lands on the world frame with the room lit inside it (the landing of
   shot 9 then is the world frame, and the room is where the search locks on tonight's thing). The "pizzazz" he asked for (158)
   is the descent and the recognition wave (round two's question 5: his colour through every point from the eye outward, 700 ms),
   not more seconds: 7.0 to usable stays; up to 8.6 whole is fine. The rest of the cut is kept shot for shot: the eye first, the
   scan a sphere of light growing out of the eye, the edges 400 ms behind the front, each thing locking into its reticle with
   its tag, the orb forming from his library's points, the feeds answering, the greeting in his voice, the search, the landing.
   TAP TO SKIP from the first frame plays the landing (never a hard cut). A warm start plays the short cut (about 5 s). The lean
   cut (the trails and the refraction dropped) when the phone cannot keep up, by the budget that `shell/boot.ts` already keeps
   (its six kinds and `bootState.budget` stay; the boot spec's timings are re-cut in place, nothing loosened). Reduce Motion: the
   designed two-still version with the world frame as still A.
7. **The sound is B, the short score** (158: "yeah cool"), synthesised tones on the audio clock, no files, nothing from the network:
   a low pad under the point of light, one soft tick per thing found each a semitone lower, the pad opening to a chord as the
   sphere resolves, a tick per feed, the tone on the lock, silence under the voice; A (the one tone, as today) as the Sounds
   setting's quieter choice; silent until a tap on a cold iOS open, as the platform insists, and said nowhere (no banner).
8. **THE PRODUCTION RUBRIC** in round two's README is the bar for every pixel and every move of this PR: nothing moves without a
   reason that can be said in a sentence; every move on a named curve from the tokens; nothing arrives without settling; ambient
   life slower than a breath on two periods that never repeat together and never moving the type; the type floor (17/15/13, nothing
   under 12, 44 pt targets); the Machine's lines mono, uppercase, whole segments with the dot at each end, two lines at the top at
   most; the voice says "I"; nothing truncated with an ellipsis; the marks never crowd (tags scale with the camera); one tone.
9. **THE SCAN is a whole look.** This Home and this boot play when THE LOOK's chosen look is THE SCAN (today's look stays as it is
   for the other looks until the gallery PR; make THE SCAN what the preview opens in so his phone check sees it, by the look
   setting, not by changing the default for every phone). The twelve colours stay the one thing he changes; nothing else of the
   themes-2 controls is touched in this PR (the gallery PR withdraws them).

## The code it stands on (read before you draw)

- `apps/web/src/shell/boot.ts` (1,039 lines): the boot today, its six kinds, the lean cut, Reduce Motion as two frames, the frame
  budget, `reboot()`, the greeting, the feeds; `tests/boot.spec.mjs` pins its timings. Your film replaces its picture and keeps its
  contract (kinds, budget, skip, reboot, the greeting's voice rules, `__bootSeek` for the spec).
- `apps/web/src/features/core/mind.ts` (1,150 lines): the orb; three.js loaded from the vendored module when Home is first shown;
  ONE WebGL context in the app (THE LOOK borrows it a frame after the paint: PR #63). The world and the room draw in that one
  context with the orb, never a second; the orb is one object, never copied (the rubric).
- `apps/web/src/features/core/` (index.ts 987 lines, home.ts, homecard.ts, hud.ts, wall.ts): Home today; shell pass 1 (the base
  branch) added Home's stamp line from one shared source and the boot's hand-over at the landing: keep both.
- `apps/web/src/features/look/index.ts`: THE LOOK (the look, the colour, the themes-2 rows).
- `apps/web/styles.css` THE SYSTEM section: the tokens (`--g-*`), the marks (`.g-*`), the durations and curves. No new hard-coded
  colour anywhere; the ratchet count of old-look CSS goes down or stays.
- `packages/shared/src/awareness.ts` and `apps/web/src/shell/awareness.ts`: the context the brain gets; the place word goes there
  as `ClientContext.place` only with his question, exactly as the voice line.
- Settings → Voice & home (`apps/web/src/features/settings/`): the saved places, the voice; the place switch lives here.
- The specs that pin the shell: ui, boot, speed, look, deck, tabs, hubcards, awareness, nav, and shell pass 1's finding test
  (`apps/edge/test/finding.test.mjs`). Re-cut in place, nothing loosened, each run clean before the report.
- The mocks' math to lift: `2026-11-08-3/scene3.js` (the per-point warm/cool light, the lamp, the 4 mm depth bias, the multi-camera
  tiles you do not need here), `world3.js` (the city, the street, the house, the aircraft, the 1:6 miniature), `home3.js`, round
  two's `film.js` (the pure `render(t)` the boot is), `scene.js`, `world.js`, `cut.json`.

## Performance, the honest numbers

The world is the heaviest scene of the three (72,000 points and 4,200 hairlines in the mock). On his phone (iPhone, Safari,
one WebGL context shared with the orb) it plays at 30 fps or more at every altitude, measured by the app and written in the
report; where it cannot, the LEAN world is designed (fewer city blocks lit, the far towers as a skyline, the aircraft three
points) and picked by the same budget the boot keeps, never a stutter. Memory: the scene is built once, the room's points and
the city's are the same buffers at every altitude; nothing is rebuilt on a pinch. The CI runner draws through software graphics
at a few frames a second (the Lens spec's "baseline on this machine"): a spec asserts the structure, the landing rules, the
place line and the floor, never a frame rate; the frame rate is his phone's number, read from the preview.

## Stages (commit each before the next; each must leave every spec green)

1. The world scene in the one context with the room inside it, drawn at Home when the look is THE SCAN; the altitudes, the pinch,
   the tap on a place, the landing rules; the house and the ask line; the finding test green.
2. The film: the descent, the cut kept, the skip, the warm start, the lean cut, Reduce Motion; the boot spec re-cut in place.
3. Home by place: the three places, the lines, the switch, the context word; nothing sent (a test proves no request carries it).
4. The score, A and B, the Sounds setting.
5. A spec of its own, `tests/scan.spec.mjs`, in the smoke loop's list after `boot` (the one word in check.yml; nothing else in the
   workflow touched; the guard untouched): the world frame at the boot's landing, the room after a tap on the book, the pinch up,
   the landing rules by a fake clock, the three place lines, the switch off → `SAVED PLACE ONLY`, the floor (44 pt, 12 px) at 440
   and 390, no request leaving the phone with a place in it; under 300 s on the runner alone.

## What you deliver

Commits before every heavy step; progress to /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/
hud-scan-1.md; stills of the world frame, the room, OUT and ON THE WAY at 440 and 390 from your preview (looked at before the
report) under docs/build-plan/mockups/hud/2026-11-08-scan1/ with a one-page README of what shipped against this brief and the
rubric, line by line; no model name anywhere; nothing from the network; no packages. REPORT (under 350 words): the commits; the
frame rate you could measure here and what you could not; each spec's result with its seconds; HIS PHONE CHECK as numbered steps
(open the preview with THE SCAN as the look: the film, the landing, the pinch, the book, the three places as he moves, the switch,
the sound on the first tap) with what to tell the orchestrator at each if it is wrong; the questions only he can answer, with
context and your recommendation first; the gaps for STARS.
