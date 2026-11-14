# THE NEXT ROUND: THE MAKE LANE (14 November 2026)

The 3D studio, the Workbench, Space, Convert and the rest of MAKE. Every engineering and build number below is a first
estimate, never certified. Nothing costs money, nothing needs a new key, and your data stays on your phone (the makeover
budget reads your own statements from your own brain).

## What I built

- **The curve behind a Workbench answer** (make.u6, this round's pick). Under the numbers, each answer now shows its shape:
  - how a beam sags along its span, drawn downwards like the real beam, with the most sag marked and the span/250 limit;
  - what a column carries as it gets longer;
  - the power a car needs as it speeds up;
  - a wing's lift up to the stall, where the line stops;
  - a fall's speed over time, a projectile's range at each angle, an orbit's period by height, a bicycle's speed by cadence;
  - a room's heat month by month through a typical UK year, from the Met Office's monthly averages (1991–2020), with the year's kWh and cost;
  - the sun's height through the day, and a capacitor charging.

  Every point comes from the same formula run again, so the curve can't say anything the numbers don't. Each one has a note that starts "First estimate, not certified".
- **3D from words, finished.** When the free makers are busy, or today's ten tries are used, your model goes on a waiting list on your phone:
  - It's tried again on its own while Ghosty is open: after 3, then 10, then 30 minutes, or just after midnight when the day's tries are used.
  - It gives up after three tries on its own, because each try counts against the day's ten. After that it waits for you to tap TRY NOW. REMOVE takes it off the list.
  - Meanwhile it offers real models from the catalogue that are the same kind of thing, and shows a stand-in made of shapes.
  - It tells you when your model is ready.
- **Space FROM PHOTO, finished.**
  - After photos of a room, the room is drawn as an outline. Tap where each door and window is, then USE THIS PLAN puts them in those walls.
  - The sizes are marked ROUGH above MATERIALS until you type one wall's real length or save a MEASURE.
- **Prices on MATERIALS** (make.u1 and make.c5).
  - A typical UK price beside the paint (in the tins it picks), the flooring (LAMINATE or CARPET) and the skirting, with the total and what wallpaper would cost instead.
  - The prices come from Design a build's own price table, and each line says "typical prices from October 2026, not quotes".
  - SET AGAINST MY SPENDING compares the makeover with the average of your last three whole months of statements. It says what happened, never a forecast.
- **Named Workbench projects** (make.u5). On the new PROJECTS section, give your numbers a name like "the shed beam" and tap SAVE. OPEN brings every panel back exactly as you left it.
- **The DIY job planner** (make.s3). Covers a shelf, a TV on the wall, a curtain pole and a picture or mirror. Say "put up a shelf" (or tap a job) and you get:
  - the board or pole checked as a beam, with its card and curve;
  - each fixing's share of the weight, with a margin of two, to compare with what the fixing's packet says it holds;
  - the tools;
  - the materials, with typical prices;
  - the steps.
- **The flake on main.** The unit pad read 43 pt in INK on CI. The keys really are 44: the screen fades in from 98.5 % of its size over half a second, and CI's slow machine measured it mid-way. The checks now wait for the screen to finish opening. The keys and the 44 pt rule are unchanged.

## How to try it on your phone

- **Workbench:** MAKE → WORKBENCH → Structure. The curve sits under the beam's numbers; change the span and it follows. Home → HEAT shows the bars by month.
- **Projects and DIY:** WORKBENCH → Projects. Type "the shed beam", tap SAVE, change the beam, then OPEN it again. Or say "put up a shelf" in the chat.
- **3D studio:** MAKE → 3D STUDIO → MAKE · PHOTO. Type something; if the makers are busy, it shows under WAITING TO BE MADE.
- **Space:** MAKE → SPACE → MATERIALS for the prices and SET AGAINST MY SPENDING. FROM PHOTO for doors and windows after room photos.

## How it's checked

- A new spec, `tests/makenext.spec.mjs` (its word is at the end of check.yml's `all=`). It runs about 268 checks at 440 and 390, at BODY 21 and in all seven looks, with the sums worked by hand:
  - the beam's middle sag is PL³/48EI;
  - January's heat is 505.92 kWh for 50 W/K;
  - the room's prices total £377.64;
  - the shelf's fixing must be rated for 12 kg.
- New brain tests for the curves are in `workbench.test.mjs`.
- `studiomake` and `workbench` were updated to the new behaviour, just as strict as before.
- The full brain suite passed on the merged code.

## What is left

- **Space photos:** doors and windows are tapped on the drawn outline of the room, not found in the photo itself.
- **PRICE IT LIVE:** MATERIALS doesn't have it yet. Design a build does, from a shop page you give it.
- **Later items not built this round:** a colour per wall (u2), snap-to-corner measuring (u3), a turntable clip (u4), more calculators (u7), favourites and size charts in units (u8), game-level auto-tiles (u10), Reverse summaries (u12), the garden planner (s1), the kitchen fitter (s2), print prep (s4), car calculators (s6), choose-your-path stories (s9), the escape-room maker (s10), the Lens wall into MATERIALS (c1), heat loss against Home Assistant (c2) and lessons with a live Workbench (c4).
- **Why:** the usage pause (about 03:40 to 04:47) took an hour of the round.

## The specialist sweep

| App it's compared with | What Ghosty lacked | Now |
|---|---|---|
| Engineering calculators (Shapr3D, Onshape) | A plot of the result along the part | Built: the curves |
| Polycam and IKEA Kreativ | Doors and windows on a scanned room | Built, as taps; found by itself: left |
| Decorating planners | A shopping total | Built: prices and total |
| CAD apps | Named, saved projects | Built: Workbench projects |
| DIY apps | Step-by-step jobs with a parts list | Built: four jobs |
| 3D makers | A queue when the maker is busy | Built |
| SketchUp | Snapping, saved views, turntable export | Left (u3, u4) |
| Good unit converters | Favourites, size charts | Left (u8) |
