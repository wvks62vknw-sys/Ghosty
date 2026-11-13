# FINAL ROUND: THE MAKE LANE (13 November 2026)

The 3D studio, the Workshop, the Workbench, Reverse, Space (rooms and DESIGN MY HOME), Convert and the Game Studio, given the
specialist pass. Nobody was there to ask, so every choice below was made by the lane and is written down here.

## What was wrong

I swept all seven screens in a browser at 440 × 956 and 390 × 844, section by section (every Workbench section, every Workshop
section, every pill of a Game Studio game). I looked for keys under 44 pt, anything sideways, words cut off, raw strings and page
errors. There were no page errors, raw strings or small keys. These were wrong:

- **The Workbench, HOME:** the circuit panel has six kinds (LED, Ohm's law, Resistors, Divider, RC, Running cost). They were
  squeezed onto one row, so "Ohm's law", "Resistors", "Divider" and "Running cost" were cut to "Oh…" at both sizes.
- **The 3D studio at 390:** the pane keys "CUT · MEASURE" and "MAKE · PHOTO" were cut to "Cut · mea…". The samples' licence lines
  ("Khronos sample · CC BY 4.0") were cut too.
- **Space, FROM PHOTO:** the header chopped its own sentence in half ("PICK PHOTOS: a drawn plan, or …").
- **Convert, UNITS:** "300 K in C" read the K as a kilometre and answered "a length and a temperature". A capital K is now kelvin,
  and a small k is still a kilometre ("5k in miles").
- **Convert, UNITS (screen):** it was one text box and a CONVERT key. A unit-converter app starts from the kind and two unit lists.
- **What was missing from Space:** a room planner from a decorating company tells you how much paint and flooring to buy. Space
  could draw the room but couldn't tell you that.
- **What was missing from the Workbench:** a calculator app lets you copy an answer. The Workbench had no way to take an estimate
  out of the app.
- **What was missing from the 3D studio:** every 3-D app can show a model as solid, wireframe and X-ray. The studio couldn't.

## What I made

- **CONVERT: the unit pad** (`apps/web/src/convert/unitpad.ts`). Twelve kinds: length, weight, volume, temperature, area, speed,
  time, data, energy, power, pressure and fuel use. You pick a kind, type a number and pick the two units, and the answer shows
  as you type (no key to press).
  - **SWAP** turns the two units round.
  - **IN EVERY UNIT** lists the same number in every other unit of that kind.
  - **COPY** puts the answer on the clipboard.
  - **RECENT** keeps your last eight conversions on the phone (`ghosty.convert.units`). One tap brings one back, and they survive
    a reload.
  - Units keep their own capitals (°C, MB).
  - A word that isn't a number gets an answer in his words. An empty box says what to do.
  - "Say it" stays underneath for "5 ft 10 in cm".
  - The sums are the ones the chat already uses, looked up by each unit's exact name (`convertByName`, `everyUnit` in
    `convert/units.ts`).
- **SPACE: MATERIALS** (`apps/web/src/space/materials.ts`, a new panel under MAKE SPACE). For the plan on the phone it gives:
  - paint for two coats on the walls and ceilings, in the tins you can buy (5 L, 2.5 L, 1 L);
  - flooring with 10% extra for cuts;
  - skirting, with door widths taken off;
  - standard UK wallpaper rolls (10.05 m × 53 cm), counted in whole drops.

  Doors and windows are taken off the wall area. With more than one room, each room also gets its own line. It updates as soon
  as the room changes. The rules of thumb come from what UK paint tins and flooring boxes print (public), are shown on the
  panel, and the panel says **"a first estimate to shop with, never a quote."** It's listed in the abilities catalogue
  (`panel:space:MATERIALS`), and its empty state is in the states ratchet.
- **THE WORKBENCH: COPY under every estimate.** It copies the whole estimate as text. The first line is always the title with
  **FIRST ESTIMATE · NOT CERTIFIED**, and the confidence and the caveat come with it, so a number can never leave the app without
  its label. If the phone can't copy, it says so in his words.
- **THE 3D STUDIO: VIEW** (in the CUT · MEASURE pane): SOLID, WIREFRAME and X-RAY.
  - X-ray makes the model see-through, so the parts inside show.
  - SOLID puts the model's own look back exactly.
  - The view stays when you load the next model, a cut still cuts, and a highlighted part takes the same look.
- **Nothing cut:**
  - The Workbench's mode keys now wrap onto two rows.
  - The studio's pane keys wrap inside their 44 pt key.
  - Licence lines are read whole.
  - FROM PHOTO's header shows a short word, and its full sentence stays in the notes under it.
- **The spec: `tests/makelane.spec.mjs`** (its word is at the end of check.yml's `all=`). It runs 183 checks:
  - the sums, worked by hand: a 4 × 3 m room with a door and a window is 7.1 L of paint (a 5 L and a 2.5 L tin), 13.2 m² of
    flooring, 13.2 m of skirting and 7 rolls;
  - the pad, at both sizes: as you type, SWAP, every unit, kelvin, not-a-number, empty, RECENT, COPY, a reload, "say it";
  - MATERIALS matching the sums and following a change to the room;
  - the Workbench's COPY, read back from the clipboard;
  - the studio's three views, each changing the model's material;
  - 44 pt keys, nothing sideways and no word cut, at both sizes, at BODY 21 and in all seven looks (scan, map, eye, orbit,
    grown, ink, glass).
- **An adversarial review before merging.** A second reviewer read the whole diff looking for faults. It found these, all fixed
  and each now checked by the spec:
  - "5K in miles" had stopped converting, because K had become kelvin. Now a capital K is kelvin only beside a temperature.
  - "1,5" typed on a European keypad read as 15. Now a comma is a decimal point unless it splits thousands.
  - 0 mpg said "type a number" although one was typed.
  - A high window's part above the ceiling was taken off the wall.
  - The tins favoured four 1 L tins over one 5 L (small tins cost the most per litre).
  - Changing the kind alone filled RECENT.
  - A failed COPY repeated its line on every tap.
- **makepass, updated to the new truth:** its units check now finds the sentence box by its own class (`input.cvsayq`), because
  the pad sits above it. The check is just as strict.

Tokens only: the new styles add no hex, no rgba() and no px radii. Nothing costs money, nothing needs a key, nothing leaves the
phone.

## How to try it on his phone

- **Convert:** MAKE → CONVERT → UNITS. Type 10, change the kind to Temperature, tap SWAP, then COPY. Come back later and it's
  where you left it, with your RECENT ones.
- **Space:** MAKE → SPACE. Scroll to MATERIALS. Set the room to 500 × 400 and the paint and flooring change straight away.
- **The Workbench:** MAKE → WORKBENCH → Structure. Tap COPY under the beam, then paste it into a note.
- **The 3D studio:** MAKE → 3D STUDIO → CUT · MEASURE → VIEW. Tap X-RAY on the arc reactor.

## What is left

- MATERIALS has no prices. There's no free live price source, and a made-up price would be a promise not kept. It counts tins
  and rolls; the cost is up to the shop.
- There's no chat phrase that opens MATERIALS directly ("how much paint for my room"). The chat's wordings belong to the VOICE
  lane, and a new phrase needs the catalogue and the meaning tests changed with it. The catalogue says to open SPACE and read
  MATERIALS.
- A door between two rooms is taken off one room's walls only, so the other room's paint and skirting come out a little over
  (the safe side). Fixing it needs to know which neighbour shares the wall. That's left for later.
- The Game Studio, the Workshop and Reverse passed the sweep with nothing cut, sideways or broken, so I left them as they were.
  The Game Studio is still 2-D only, and its ABOUT says so plainly.
- Seen only in tests: when the full Chromium binary (not CI's) runs with service workers blocked, the notifications setup
  (`assistant/push.ts`, not this lane's) reads `pushManager` from a missing registration. It never shows in CI's browser or on a
  phone. It's handed to the SYSTEM AND SETTINGS lane rather than changed here.
