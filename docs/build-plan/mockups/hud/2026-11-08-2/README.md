# The HUD mocks, round two: the boot as a film, Home that knows where he is, the looks as a gallery (8 Nov; BRIEF-HUD-MOCKS-2)

His words this round is cut to (OWNER-ISSUES 157): "an actual cool cinematic like designed for a genius playboy billionaire
philanthropist, it should feel like it's straight out of a high production hollywood movie"; "it should know when im home, when im
out etc and it changes its design based off that"; "i want ENTIRELY different looks for the theme ... prebuilt apart from the
colours"; "like there's been genuine billions poured into it and high level of production". Round one (`../2026-11-08/`) was "a
little better but could still be better": it is the base here, raised, not started over. Nothing in this folder ships.

| File | What |
| --- | --- |
| `boot.mp4` | THE BOOT AS A FILM: 8.2 s, 440 × 956 at 30 fps, H.264; Home usable at 7.0 s. Silent: the cue sheet below is the sound. |
| `film/shot-01.png` … `shot-09.png` | the nine shots, each a still from the film a beat (180 ms) into the shot, at 2× |
| `home.mp4` | HOME ALIVE: the evening Home for 4 s (the camera's breath, the points breathing, a point re-read, the orb turning, the city flickering) |
| `home-evening.png` `home-town.png` `home-way.png` | Home at three places: AT HOME (21:08), OUT (12:40 in town), ON THE WAY (07:52, the 7:42) |
| `theme.png` | the Theme page as a gallery of the seven looks, the colour row under the chosen one, nothing else |
| `ink-home.png` | ONE INK's Home at the same quality, so two entirely different HUDs sit side by side |
| `contact.png` | the sheet: the film as a strip with its cut, the three Homes beside round one, the gallery and the two HUDs |
| `scene.js` `world.js` `film.js` `home.js` `ink.js` `hud2.css` `build.py` `render.mjs` `cut.json` | how they were made (below) |

## What changed from round one, and why

1. **The room is real 3-D now.** Round one drew W1's room with a raymarcher that photographs one moment in six seconds; a film
   needs thirty frames a second and a camera that moves. So the same room is now what the Machine actually keeps of it: a point
   cloud (`scene.js`), 64,000 points on the same jittered lattice as the raymarcher (a wall every 6 cm, a thing every 1.6 cm, a
   page every 9 mm), every edge one hairline, drawn by the app's own vendored three.js like the orb. A dolly-in gives real parallax
   between the desk, the shelf, the back wall and the city outside the window; the Home frame at rest is round one's picture to
   the token. Every point remembers the order the scan reached it in, so the sampling front, the brighter leading edge and the
   edges drawing a step behind cost nothing per frame.
2. **The boot is a film, not twelve stills.** One pure function `render(t)` plays the whole thing live (requestAnimationFrame, a tap
   skips) and is photographed frame by frame for the video, so what he watches is what the phone would play. It is 7.0 s to a
   usable Home (round one: 4.3; 156: "longer, richer"), crafted shot by shot below, with a camera that starts far and high and
   lands on Home's own view, the scan a sphere of light growing out of the eye (the eye is first, the room is what it sees), the
   recognition a wave of his colour through every point of the room, the name arriving letter by letter, the leader drawing itself.
3. **Home has an hour's light.** Round one's room was lit by the orb and a flat ambient. Now the window lights the points (warm
   and low from the lamp in the evening, cool from the city, daylight from above at midday, dawn on the way), each hour a different
   colour cast on the same marks; the points breathe in their normals and one is re-read now and then (the Machine checking its
   record); the city outside the window is lit; the camera breathes six millimetres over four seconds, never a lurch.
4. **Home knows where he is.** Three places, each visibly a different Home: the same room AT HOME; OUT and ON THE WAY are not a
   room at all but the Machine's own city (W1's Birmingham, the Stage he saw through the window in round two, now as points), from
   above by day with him ringed on the walk, or higher and turned to the line at dawn with the train a lit point and Coventry
   locked. What is Now changes (the book; the 13:42 home; the 7:42 and the dentist after), the light changes, the marks change
   (God's eye and the Lens stay a tap away in every place; the things of the room are the room's). One mono line under the stamp
   says how the phone knows (below) in every place.
5. **The Theme page is a gallery.** Seven looks, each a live-looking thumbnail of its own Home (from the existing sheets), the
   chosen one locked in his colour and captioned YOU'RE IN IT, the colour row under it: the one thing he changes (157). Nothing
   else: no ground row, no dials, no switches. ONE INK's Home is redrawn at round-one quality beside THE SCAN's so he can see that
   a theme is a whole HUD, tabs included (155).
6. **The marks never crowd.** In the film the tags scale with the dolly (72 % while the camera is far, 100 % at Home) so eight
   things can lock in while the room is still small on screen; every reticle, callout and leader is placed again every frame.

## 1 · The boot as a film: the shot list (ms from the first frame) and the cue sheet

`boot.mp4`. The cut is `build.py`'s `CUT` (one source for the film, this table and the strip on the sheet). Home is usable at
7,000 ms; the film ends at 8,200 with Home breathing. A and B are the two sounds asked about in question 4.

| Shot | Starts | Ends | What happens, and how it moves | Sound |
| ---: | ---: | ---: | --- | --- |
| 1 The eye opens | 0 | 500 | The lit graphite, nothing else. One point of light in the middle of the dark, breathing (±30 % over 1.6 s); the room's light breathes in round it over 700 ms (ease-out). The camera is far and a little high and to the right, looking down into a room it cannot see yet. | A silence. B a low pad fades in under the point of light, one note, felt more than heard. |
| 2 The scan | 500 | 2,500 | A sphere of light grows out of the eye and samples the room as it passes (its radius grows as t^0.9 over 2 s: nearly even, a soft landing): the desk first, the shelf and the calendar, the back wall, the ceiling last. The front is a step brighter (×5) than what it leaves settled behind it. The camera begins a slow dolly in (quintic in-out over 3.4 s, a 10 cm swing to the side on the way). | A silence. B the pad rises a fifth as the front crosses the desk; a fine granular tick under it, the sound of points landing, thinning as the room fills. |
| 3 The edges, the things | 1,100 | 2,500 | The hairline edges draw themselves 400 ms behind the front. Each thing locks into its reticle the moment the front reaches it (the lock curve, 160 ms, from 108 % to 100 %), with its tag: the Brief and the book first, the Gym, Courses, the Library, the Lens, the Agenda, God's eye last. The city outside the window is still dark. | A silence. B one soft tick per thing found, each a semitone lower than the last. |
| 4 The orb forms | 2,000 | 3,900 | His library's points drift out of the eye and gather into the constellation (640 ms), each leaving a short trail; the sweep passes down through them (240–540 ms in) and refracts at the equator; the sphere resolves from the inside out (haze, then meridians catching the light one after another, the rim last); the room's own light dips 45 % while the orb forms and comes back with the sphere. The camera lands on Home's own view at 3,900. | A silence. B the pad opens to a chord as the sphere resolves; the chord holds. |
| 5 The stamp | 3,100 | 4,000 | The Machine's point of view types itself at the top with the block cursor, 10 ms a character: SUN 8 NOV · 07:12 · BIRMINGHAM · CHECKING FEEDS. | A silence. B a faint typing tick under the cursor, dry, no echo. |
| 6 The feeds answer | 4,000 | 4,900 | One truth line each, 220 ms apart, each rising 4 px as it lands: FLOOD · ENVIRONMENT AGENCY · NOTHING ACTIVE; WEATHER · MET OFFICE · NO WARNINGS; CRIME · POLICE.UK · SEP · 14 WITHIN A MILE. Birmingham lights up outside the window over 900 ms as they answer; the stamp becomes WATCHING 3 FEEDS. | A silence. B three soft ticks, rising, one per feed; under the third the chord warms a shade. |
| 7 The recognition | 4,900 | 5,400 | The box snaps onto the orb from 14 px wider, closing over the lock's 160 ms in his colour. A wave of his colour passes once through every point of the room from the eye outward and is gone in 700 ms; the screen lifts 7 % for one frame. G H O S T Y arrives under the box letter by letter (55 ms apart, each rising 5 px). The feeds' lines leave; the stamp holds their truth. | A one short tone, the app's own, on the lock. B the tone; the chord stops dead with it; the wave is a soft noise sweep that follows it out, 700 ms. |
| 8 The greeting, then Now | 5,400 | 6,500 | Good morning, Boss. rises under the stamp where Home's first line lives (260 ms); the orb opens half way and keeps time with the words. At 5,800 the search: the box checks the shelf, the desk (160 ms each, CHECKING · LIBRARY, CHECKING · GYM), and locks on this morning's Brief (FOUND · THE BRIEF); the leader draws itself from the Brief to the callout over 300 ms; the callout rises. | A the greeting spoken in his voice, now if the phone allows sound, else on the first tap. B the same; nothing under the voice; a tick on each check, the tone on the lock. |
| 9 The landing | 6,500 | 7,000 | The box and the name go (150 ms); the stamp gains LOOKING AT HOME; the house and the ask line slide up 24 px a beat (110 ms) later over 320 ms; the second line arrives. Home is usable at 7,000 and breathes: the camera drifts six millimetres, the points breathe, one is re-read now and then, the city flickers. | A silence. B silence: the room is quiet; the voice has the floor. |

**Skipping it in the real thing.** A tap anywhere, from the first frame, jumps the clock to 6,500 and plays the landing (the HUD
still slides up, 500 ms to a usable Home), so a skip is never a hard cut to a different picture; TAP TO SKIP is said small by the
thumb from 2,400 (the orb forming) to 4,700 (just before the recognition). Under Reduce Motion or MOTION calm: two stills (the
room whole with the orb, then Home), 1.2 s, as the storyboard's STILL kind. A warm start (resume, deep link, notification): no
film, the orb's light breathes out once. A slow phone (the Mind not drawing by 1,700 ms): the lean cut drops the dolly (the camera
starts at Home's view), the trails and the wave, and the scan runs at 1.2 s: about 5 s.

**What the phone would play.** `film.js` is a pure `render(t)`, so the real boot is the same function on `requestAnimationFrame`
with the point cloud in one draw call (64,000 points, 300 lines, 14 occluders). On this machine's software GPU the live page runs
at 10 fps; on an iPhone the same scene is a fraction of what the Lens already draws, but the number is his phone's to give (the
frame budget in `shell/boot.ts` keeps its six kinds and picks the lean cut when the recent frames run long).

## 2 · Home, raised: where

- **The room's depth.** Points instead of a raymarch: the desk is deeper (its underside and legs read), the shelf's spines stand
  out, the window is a hole in a wall the city shows through, and the camera can move.
- **The hour's light.** Evening: the lamp's warm light low on the left (`--g-amber` at 13 %), the city's cool light through the
  window, the book lit in his colour. Midday: daylight from above, a pale sky over the city. Dawn: a pale sky and the first warmth
  low in the east. The light is a wash the points sit in (`.winlight`) plus a per-point term from the window's direction, never a
  fog over the type.
- **Life.** `home.mp4`: the camera's breath (6 mm × 4 mm, periods 12.6 s and 17 s, so it never repeats on screen), the points
  breathing 6 mm in their normals, a point re-read now and then (a sparkle at 0.7 % of points per third of a second), the orb
  idle (one turn in 70 s, breathing 6 %), the city's windows flickering.
- **The type.** The where-line under the stamp (below) in `--g-t-truth`; the callout keeps round one's tag, name and one true line.

**Three places, and how the phone knows (each said on its screen in one mono line; one switch in Settings → Voice & home turns it
off, and the line then says SAVED PLACE ONLY):**

| Place | The screen | How the phone knows | The line on the screen |
| --- | --- | --- | --- |
| AT HOME, 21:08 | the room; Now is tonight's book; the lamp and the city | his saved place (Settings → Voice & home) matches where the phone's own sense says it is (the home Wi-Fi, the still phone, the hour); decided on the phone | AT HOME · FROM YOUR SAVED PLACE · NEVER SENT |
| OUT, 12:40 in town | the city from above by day, him ringed on the walk, the station locked; Now is the way home (the 13:42, platform 9, 11 min walk, rain at two) | the phone's own sense of place (not at a saved place, on foot, in the city it knows); the stamp's place is the nearest saved place's name (NEW STREET), never a coordinate; decided on the phone, the brain gets the words "out" and "New Street" only if he asks it something | OUT · FROM THE PHONE'S OWN SENSE · NEVER SENT |
| ON THE WAY, 07:52 | the city at dawn turned to the line, the train a lit point with its trail, Coventry locked; Now is the 7:42 and the dentist after | the phone's own sense (moving at 64 mph along a line it knows, the journey in the Agenda); the speed is the phone's reading, shown, never sent | ON THE WAY · 64 MPH · THIS PHONE · NEVER SENT |

Never live GPS to the brain: the place is decided by the phone, in the shell, from his saved places and what the phone can tell
on its own; what reaches the brain is at most a word (home, out, on the way) and a saved place's name, and only with his question.

## 3 · The looks as a gallery

Seven tiles in a 3-column grid, each a thumbnail of that look's Home cropped from the existing sheets (THE SCAN this folder's
evening; THE MAP and THE EYE from `directions-2/`; ORBIT and GROWN UP from `directions/`; ONE INK this folder's `ink-home.png`;
GLASS from the route-C Home with the Mind orb, today's look); the chosen one in his colour with YOU'RE IN IT; the colour row (the
twelve, each swatch its own accent) directly under the chosen tile; the one line "THE ONE THING YOU CHANGE". No ground row (a look
decides its own ground: ONE INK is warm black, Paper is the reader's), no dials.

ONE INK's Home (`ink-home.png`): bone ink on the warm ground, a serif for my voice (the greeting at 36 px, the second line
italic), the orb drawn in ink with no glow on an equator rule, one entry (01 TONIGHT, the book, CARRY ON READING), RECENT and
FAVOURITES as underlined words on rules, the ask line a rule, the rooms as a running foot with the eye for Home. The same facts as
THE SCAN's evening, an entirely different HUD, tabs included.

## Questions for him (the recommendation first in each; only the ones that change the build)

1. **The film's length: 7.0 s to a usable Home, 8.2 s whole.** He asked for longer and richer (156) and Hollywood (157); round one
   was 4.3. I recommend 7.0 with the lean cut (about 5 s) picked by the phone when it runs slow, and the tap-to-skip from the first
   frame. The other way is a 5 s cut that drops the dolly and the search, which loses the two beats that make it a film.
2. **Where he is: on by default, said on every Home.** The phone decides at home / out / on the way from his saved places and its own
   sense, shows the line under the stamp, and sends nothing. I recommend on by default with the line always there (the honesty is
   the feature); one switch off in Settings → Voice & home. The other way is off until he turns it on, which means the first week's
   Home never changes.
3. **OUT and ON THE WAY as the Machine's city, not a room.** When he is not at home the room has no truth to show, so Home becomes the
   city it keeps (W1's Birmingham), him on it, Now the way. I recommend it: it is what the phone actually knows, and it is the Stage
   he liked through the window. The other way keeps the room in every place and changes only the light and Now; cheaper by a week,
   and the three Homes stop being "visibly different".
4. **The sound: B, the short score, as the design.** The cue sheet above is written for B (a pad, ticks per thing and per feed, the
   tone on the lock, silence under the voice), built as synthesised tones on the audio clock (no files, nothing from the network),
   with A (the tone only) as the Sounds setting's quieter choice. I recommend B; iOS keeps a cold open silent until a tap either way,
   so most mornings he hears A's silence and B on the first tap. The other way is A only, one tone, as today.
5. **The recognition's wave.** New this round: his colour passes once through every point of the room from the eye outward (700 ms)
   with a 7 % lift for one frame. I recommend keeping it: it is the one moment the whole room answers to him. The other way is the
   box and the tone alone, as round one.
6. **The gallery's thumbnails: a still of each look's Home, taken by the app.** Seven live WebGL Homes on one page would cost seven
   contexts; I recommend each look's Home photographed once by the app when the look is built and once a day after (so the thumbnail
   shows his real Home in that look, at his hour), with THE SCAN's tile alone live. The other way is a drawn preview per look, as
   round one's tiles, which is what he said was not a whole HUD.
7. **ONE INK as the second HUD built, after THE SCAN.** It is the most different (a printed page: no scan, no glow, a serif), the
   cheapest (no shader, no room), and it answers "entirely different looks" the moment it lands. I recommend ONE INK second, THE EYE
   third; the other order is THE EYE second (the attention material is a bigger build: the grain, the sharp box, the line of sight).
8. **The boot's camera: the dolly from far and high.** The film starts outside the room and lands on Home's own view at 3.9 s, which
   is where the depth and the parallax are. I recommend it; under Reduce Motion it is two stills anyway. The other way is round one's
   fixed camera (the room assembles in place), which the lean cut uses on a slow phone.

## THE PRODUCTION RUBRIC (what "billions poured in" means for every PR from here; the phone check asks each line)

**Motion.** Nothing moves without a reason that can be said in a sentence (the scan reaches it; the feed answered; the camera
lands). Every move has a named curve from the tokens or this page: the lock (`--g-ease-lock`, 160 ms) for a thing found or a box
landing; ease-out cubic for a thing arriving; quintic in-out for a camera; nothing linear but a typed line. Nothing arrives
without settling (from 108 % or +4 px, never from 0 %). Ambient life is slower than a breath (periods of 4 s and up, amplitudes of
millimetres or 6 %), two periods that never repeat together, and it never moves the type. A screen plays at 30 fps or more on
his phone, measured; when it cannot, the lean cut is designed, not a stutter. Reduce Motion is a designed version (stills that
cross-fade), never a switch that leaves things broken.

**Transitions.** A page comes from where it lives (a room's page from the room, dimmed behind it; the house unfolds from the plan;
a sheet rises from the ask line) with the tokens' durations (`--g-dur-lock` 160, `--g-dur-turn` 420, `--g-dur-bring` 900) and
nothing else; the HUD arrives a beat (110 ms) after the thing it belongs to; nothing fades to black, nothing cuts; a skip plays
the landing, never a jump to a different picture; the orb is one object that is never copied and never travels into a box.

**Type.** The floor holds (body 17, reading 15, tag and caption 13, nothing under 12; 44 pt targets); the Machine's lines are mono,
uppercase, tabular, whole segments with the dot at each end, two lines at the top at most; the voice is the display face and says
"I"; a serif only where a look chooses it (One Ink, the reader); nothing is truncated with an ellipsis on a screen he reads from
one metre; every number is written as a person writes it. The marks never crowd: tags scale with the camera and a thing's tag is
never on top of another's.

**Sound.** One tone, the app's own, on every recognition, and no other sound on an ordinary screen; the voice always has the
floor (nothing plays under it); a score only under the boot, as a cue sheet first, then as synthesised tones on the audio clock;
silence is designed (shot 9 is quiet on purpose); his Sounds setting and iOS's cold-open rule are honoured and the screen never
pretends a sound played.

**Finish.** Every screen has the hour's light and the place's light, not one flat canvas; nothing is true black and nothing is a
fog over the type (not so dark, 139: a number per screen on his phone); hairlines are 1 px at 2× and 3×, points are round, grain
is 1 %; the boundary is on every frame (a stranger is SOMEONE I DON'T KNOW, a place is a saved name, never a coordinate, the where
line says NEVER SENT); the Machine is felt in its marks and never named on a screen; no model's name anywhere; the stand-in
fonts are said; and the five-second test, the detail test and show-your-dad (STANDARD 1, 4, 6) are asked of the film and of every
Home before a PR says done.

## What could not be done, and why

- **Sound in the video.** `boot.mp4` is silent: the cue sheet is the sound, as the brief allows. The tones would be synthesised in
  the real build; no audio file exists here and nothing comes from the network.
- **The live frame rate.** Played live under Playwright's recordVideo this machine's software GPU gives 10 fps (90 frames in 9 s),
  so the video is the same `render(t)` photographed at 30 fps and stitched with ffmpeg (`/usr/bin/ffmpeg`, already installed:
  H.264, crf 18, supersampled from 2×). The phone's own number waits for the phone.
- **OUT and ON THE WAY are the map, not a scanned street or carriage.** A point-cloud street and a carriage were built and looked
  like a film prop (a tunnel of boxes, a train with no train in it); they were cut. The city is W1's own, which is what the phone
  can honestly draw of a place that is not a room.
- **The gallery's GLASS tile** is the route-C Home with the Mind orb (`hero/mind/home.png`), the nearest picture of today's look
  on disk; a screenshot of the app as it runs on his phone would replace it.
- **The stand-in fonts** (Inter for SF Pro, DejaVu Sans Mono for SF Mono, Source Serif for New York): the mono is a little wider
  than the phone's, so the stamp wraps to two lines here as it does on the phone, and the where-line fits at 440 with no room spare.
- **A test with a stranger** (STANDARD 1): the five-second claims are design arguments until he has it in his hand.

## How they were made

`python3 -I -B docs/build-plan/mockups/hud/2026-11-08-2/build.py` writes the pages (round one's `build.py` is imported for the
facts, the marks and the room, nothing redrawn); `node docs/build-plan/mockups/hud/2026-11-08-2/render.mjs stills` photographs the
five stills at 2× (a tiny static server serves the worktree; Playwright's bundled Chromium with software WebGL); `render.mjs film`
photographs `boot.html` through `window.__render(t)` at every 1/30 s, keeps the nine shot stills, and stitches `boot.mp4`;
`render.mjs home` does the same for `home-evening.html` → `home.mp4`; `render.mjs live` plays the boot live under recordVideo and
prints the frame rate; `render.mjs contact` writes the sheet. Each page can be opened in a browser and plays itself (`?still=ms`
freezes one moment). The renderer prints anything he could press under 44 × 44, any type under 12 px and anything wider than the
screen; every still here passes. A still takes two seconds; the film seventy.
