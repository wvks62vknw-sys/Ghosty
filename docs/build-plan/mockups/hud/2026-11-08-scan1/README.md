# THE SCAN's Home, built: the whole of it with the room inside, the boot as the film with the descent, Home that knows where he is (8 Nov; BRIEF-HUD-SCAN-1)

Stills from the preview of this PR's build (the real app, `tests/preview-server.mjs`, Chromium with software WebGL, 2×), looked at
before the report. The scene is the one the phone draws; the fonts are the sandbox's stand-ins (the mono is wider than SF Mono, so
the stamp and the where-line wrap to a second line here as they do on the phone, sometimes a third).

| File | What |
| --- | --- |
| `world-440.png` `world-390.png` | THE WHOLE OF IT: Home as it lands at the boot and after an absence (AT HOME, the thing of the hour lit, the orb's line of sight on it) |
| `room-440.png` `room-390.png` | ROOM+: the room inside it, all eight things marked, where Home lands when he has just been in it |
| `out-440.png` `out-390.png` | OUT: the same world landed on the street and the city by day, him ringed on the walk, the station locked; `OUT · FROM THE PHONE’S OWN SENSE · NEVER SENT` |
| `way-440.png` `way-390.png` | ON THE WAY: the city turned to the line, the train a lit point with its trail, the station locked; `ON THE WAY · 64 MPH · THIS PHONE · NEVER SENT` |
| `film-*.png` | the film stepped by hand (`__bootSeek`): the eye and the scan from the sky (700 ms), the descent half way with the things locking in (2,200), the stamp typing (3,300), the recognition (5,100), the greeting and the search's lock (6,300), the landing (7,000: Home's first frame) |

## What shipped against the brief, line by line

1. **THE WHOLE OF IT is Home.** `features/core/scan/world.ts` builds world.png's frame from the mocks' numbers: the room with its eight
   things, the lamp (a light with a downward cone, and a thing: base, stem, cone of points, one bright bulb), his chair pulled out, his
   mug; his house as hairlines with the roof lifted and the front wall gone; the street with its lamps and the houses across the way
   (a few lit windows); the city as hairline blocks on a street grid at 1:6, the towers round the station; the far skyline; three aircraft
   with trails. 72,599 points, 4,188 hairlines, 14 occluders, built once in 115 ms on the runner. The orb hangs where the camera puts
   it; its line of sight drops to the one thing it is looking at. No tiles, no names on the city.
2. **ROOM+ is the room inside it.** The room's camera is room-plus.png's (low, three-quarter, from his side of the desk); the light is
   on the points (`aWarm`, `aCool` baked at build: the lamp's cone, the city's cool through the window), never a wash over the type.
   All eight marks in the room (the reticle, the tag, the lit box on tonight's thing, the callout and its leader, the line of sight).
3. **Where Home lands.** The world frame at the boot and after twenty minutes away; the room when he left it under twenty minutes ago
   or came from a thing in it; OUT and ON THE WAY land on their own frames. The camera moves on `--g-dur-bring` (900 ms, quintic
   in-out); a pinch out goes up through the street and the city to the whole, a pinch in down; a tap on the house goes into the room,
   on the station to the city; the house along the bottom and the orb are always a way back. Under Reduce Motion the altitudes are
   stills: the frame dips to the ground and comes back on the new one (260 ms, an opacity, not a travel).
4. **The finding rule.** From the world frame tonight's thing (the lit book, or this morning's Brief by the hour) is one tap, as is its
   callout; the shelf and the aircraft one tap; the Brief, the Lens, the Gym and Courses two (into the room, then the thing) or one typed
   word in the ask line; the seven rooms one tap along the bottom (ME is the seventh, in the house while this Home is on). In the world
   frame the room's small things are not marked; every mark is held to 44 pt. `apps/edge/test/finding.test.mjs` passes unchanged.
5. **Home knows where he is.** `scan/place.ts` decides on the phone: his saved place (Settings → Voice & home), the hour, the phone's
   own speed and sense of place only where the browser gives it and he has allowed it already (a `granted` permission is read; Home
   never asks). The three lines are the brief's words; with no sense of place the line says `FROM THE HOUR AND YOUR SAVED PLACE` and
   never guesses. One switch, ON by default; off, `SAVED PLACE ONLY` and the home world at every hour. The stamp's place is a saved
   place's name. What leaves the phone with his question is a word and a saved place's name (`ClientContext.place`, and Home's own
   screen line "the home screen, out, near Birmingham"); the spec reads every request and finds no fix, no speed, no coordinate but his
   saved place's. The brain's prompt is untouched (the guard stays at 5,500).
6. **The boot is the film.** `scan/film.ts` with `shell/boot.ts` as the conductor: round two's cut shot for shot (the eye first; the scan a
   sphere of light growing out of the eye over his desk; the edges 400 ms behind the front; each thing locking in with its tag as the
   front reaches it, tags at 72 % while the camera is far; the orb from his library's points; the feeds answering as the city's windows
   come up; the recognition's wave of his colour from the eye outward, 700 ms, the screen lifting 7 % for one frame; the greeting; the
   search's line of sight; the landing), with the dolly become THE DESCENT from the sky over the city down over the street to rest on
   the world frame. Home usable at 7,000, the short cut 4,800, TAP TO SKIP from the first frame plays the landing, the lean cut by the
   budget boot.ts keeps (its six kinds and `bootState.budget` stay), Reduce Motion the two stills with the world frame as still A. The
   film's last frame is Home's first: the orb's viewport and Home's hero box agree to 0.1 px (`bootState.landed`).
7. **The sound is B.** `scan/score.ts`: synthesised on the audio clock, no files: a low pad under the point of light, rising a fifth as
   the scan begins with granular ticks thinning; one soft tick per thing found, each a semitone lower; the pad opening to a chord as the
   sphere resolves; a dry tick under the stamp's cursor; a tick per feed, the third warming the chord; the chord stopping dead with the
   lock's tone, a soft noise sweep following it out; nothing under the voice. A (the one tone, as today) is the Sounds setting's quieter
   choice (Settings → Voice & home, "The boot's score"). A cold iOS open stays silent until a tap, said nowhere.
8. **The rubric.** Every move has a reason and a named curve (the lock 160 ms for a thing found, ease-out for a thing arriving, quintic
   in-out for the camera); nothing arrives without settling (108 %, +4 px); the camera's breath is six and four millimetres on 12.6 s and
   17 s (scaled by how far it stands, invisible from the sky otherwise), the points' drift 6 mm, a point re-read now and then, never the
   type; the type floor and 44 pt targets held by the spec at 440 and 390; the Machine's lines mono, uppercase, whole segments with the
   dot at each end; no ellipsis; one tone.
9. **THE SCAN is a whole look.** This Home and this boot play when THE LOOK's world is The Scan (the default recipe's, so the preview and
   his phone open in it; the other worlds keep today's Home and boot); the frame is the phone's (under 900 px), a desk keeps today's
   three-column Home. The twelve colours stay the one thing he changes; nothing else of the themes-2 controls is touched.

## The honest gaps (for STARS)

- OUT's Now says `THE WAY HOME · <saved place> · TAP TO PLAN THE WAY` and ON THE WAY's `<speed> MPH · THIS PHONE`: the 13:42 and its
  platform, the next stop's name and the dentist after need the journey and the agenda on Home, which this PR does not read.
- The station is marked THE STATION (a place of the Machine's miniature), not New Street: Home has no named stations yet.
- LIBRARY's count (`· 4`) and the aircraft's `41 AIRCRAFT` truth line wait for their feeds on Home.
- The lean world is picked at the boot (the short cut); a pinch never rebuilds the scene, so a phone that slows mid-flight keeps the world it has.
- The film's frame rate on his phone is his to read (the SPEED card and `__ghosty.scan.fps`); here it is a few frames a second.
