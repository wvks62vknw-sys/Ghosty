# BRIEF: THEMES THAT MEAN SOMETHING — the ground, the colour, the world, and the switches

The owner, 7 Nov 00:10 UK (OWNER-ISSUES 141): "make it so in the themes you can have the black background and then like the lighter
one and even different colours and other small cool changes we can do in the theme that actually mean something and again aren't
just AI slop, or even like all these design choices we've seen along the way as theme options and even others you know".
STATUS item 1(d); STARS 170. Built on the top tier right after PR #60 (the design system) is on main; beside the reader builder
(BRIEF-LIBRARY-READER), whose files are the library's: do not touch apps/web/src/features/library, reader, voice, intent or hubcards.

Read first: STANDARD.md; OWNER-ISSUES 139, 140, 141; BRIEF-DESIGN-SYSTEM.md; apps/web/src/design/tokens.css (every token and its
job), apps/web/src/state/theme.ts, apps/web/src/ui/machine.ts, apps/web/src/ui/eye.ts, apps/web/src/ui/swatches.ts,
apps/web/src/features/look/index.ts, apps/web/src/features/settings/index.ts, apps/edge/test/look.test.mjs, tests/look.spec.mjs;
the six directions' READMEs and tokens (docs/build-plan/mockups/directions/d1–d3, directions-2/w1–w3) for what each world IS;
MAP.md. Start from the tip of `claude/new-session-4erjve` after PR #60 is merged (`git log -1` first), on `builder/themes-2`.

## His three rules, still (OWNER-ISSUES 139)

NOT SO DARK is now HIS CHOICE: Black is one ground among five, Graphite stays the default. THE MACHINE FELT, NOT NAMED: the
marks and the eye follow the world; the word "Machine" never on screen. EASY TO NAVIGATE: Settings → Appearance → Theme stays
two taps and shows the presets first; the dials are under them; nothing under 44 pt; every control named; the readability floor
(body 17, nothing under 12, text 4.5:1, lines 3:1) held by the test on EVERY ground × EVERY colour (60 pairs) and every world.

## The shape

A theme is now a RECIPE of three choices and the switches. The twelve themes of today and the six directions are PRESETS
(a recipe with a name). Changing one dial under a preset makes "Custom", kept exactly as set.

1. **THE GROUND** (`data-ground`, a block of the surface tokens: canvas, canvas-rgb, plate, plate-strong, scrim, the four inks,
   the two lines, the bone/points triplet, the glow floor):
   - **Black** — true black, the screen off between the points (W1 as first drawn, mockups/directions-2/w1/tokens.css); the
     inks and lines lifted so the floor still holds.
   - **Graphite** — the lit graphite of PR #60, today's values, THE DEFAULT.
   - **Slate** — a cold blue-black (about #0c1118 / plates #141b24), the night room.
   - **Warm** — D2's warm black (#0b0a09 lifted to the floor, bone ink), for reading at night.
   - **Paper** — a light ground: bone canvas (#f3efe6), plates a step DOWN, dark ink (#1a1a18 at four strengths), the accent's
     TEXT variant darkened until it clears 4.5:1 on bone; the eye's points dark on bone; for reading in daylight.
   Each ground is a sentence in Ghosty's voice ("Black: nothing lit but what I'm looking at."). The boot plays on the ground.
2. **THE COLOUR** (`data-theme` as now): the twelve accent blocks, untouched, plus their Paper text variants.
3. **THE WORLD** (`data-world`, a block of the drawing tokens): what the directions seen along the way each DID, as tokens:
   - **The Scan** (W1, the default): the floor behind every screen a field of sampled points (`--g-floor: points`), hairline
     edges, corner-mark reticles, mono readings, radius 2, the eye a sphere of points.
   - **The Map** (W2): the floor a plotting grid with a crosshair every five squares, square pins as the reticle, dashed
     borders on plates, radius 0, the eye a ring over the grid (eye.ts gains the ring draw).
   - **The Eye** (W3): the floor a fine grain, the one sharp accent box as the reticle with the line of sight drawn on, the rest
     as grain (plates at reduced ink), radius 2, the eye with its grain halo.
   - **One Ink** (D2): no floor pattern, rules instead of boxes (plates become a rule above and below), a serif for what Ghosty
     says (`--g-face-say: ui-serif`), radius 0, no glow, the eye a plain disc with one ring.
   - **Glass** (today's route C): no floor pattern, blur and the thick/regular glass, radius 16 on cells and 26 on capsules, the
     glow, the eye as today's hologram (the orb on THE LOOK draws the current Mind in this world).
   - Orbit (D1) is a navigation, not a drawing: it is NOT a world (say so on THE LOOK: "Orbit is a way round, not a look; it
     comes with the shell").
   WHAT A WORLD REACHES IN THIS PR, honestly: the floor behind every screen (body/#stage background), the corners of every
   control (the radius aliases --rc, --rc2, --card… are redefined from `--g-radius-*` under `[data-world]`, so every screen's
   corners follow; the shell pass finishes the rest), the glow everywhere it is drawn from `--g-glow`, every mark in machine.ts,
   the eye on THE LOOK, the boot, Settings and THE LOOK themselves. Rooms the design system does not draw yet keep their
   layout; THE LOOK says: "Every room follows the world fully with the shell." No screen may look broken in any world
   (run routec, hero, boot, deck, tabs and settings in every world at 390 and 440 and look at the screenshots).
4. **THE SWITCHES** (each one visible thing, each a sentence, each kept): GLOW (on / off); THE FLOOR (the world's pattern on /
   off); CORNERS (the world's / sharp / round); READINGS (mono / the system type); BODY (17 / 19 / 21, never under; the reading
   and tag sizes scale with it, the floor still holds); MOTION (alive / calm: the eye breathes or holds, the typed-out line types
   or appears; Reduce Motion always wins and is said); THE SOUND (tone / click / off, on top of his sound setting); GROUND FOLLOWS
   THE DAY (off / on: Paper from sunrise to sunset, the chosen night ground after, from the phone's clock and his home's
   longitude already in settings, NEVER live GPS; said on the Theme row: "Paper till 16:32").
5. **PRESETS**: Reactor … Mono (the twelve: Graphite + the colour + The Scan + default switches), then THE SCAN (Black + Reactor
   + The Scan, glow off: W1 as rendered), THE MAP (Slate + Reactor + The Map), THE EYE (Black + Reactor + The Eye), ONE INK (Warm +
   a bone accent (#ece6d8 text, Gold's block for the one light) + One Ink + mono off), GLASS (Graphite + Reactor + Glass: today).
   Each preset's swatch shows its ground, colour and floor at once (swatches.ts). The Theme row says the recipe ("Ember · Black
   · The Scan").
6. **BY WORDS** (`set_theme` and the theme words in packages/shared and apps/edge/src/tools/ui.ts): "black background",
   "lighter", "paper", "the scan" / "the map" / "the eye" / "one ink" / "glass", "calm", "bigger text", "follow the day"; no model.
7. **THE LOOK** gains the rows under THEMES: GROUND, WORLD, SWITCHES, each live; TOKENS lists the ground and world blocks with
   their jobs; the catalogue (`packages/shared/src/catalogue/look.ts`) gains `theme:ground:<key>`, `theme:world:<key>`, the
   switches, and the six presets, with phrases; the deck's Settings card count follows.
8. **KEPT**: localStorage keys compatible with today's `theme` (a bare colour key reads as Graphite + colour + The Scan); the brain
   records the recipe as it records the accent at boot (boot.ts); another device opens in the same recipe.

## What must not change

The security boundary; nothing paid; no packages; no new keys; the prompt guard; the CI guard job; the readability floor is never
loosened for any ground, colour or world; never a model name anywhere; no live GPS (follows-the-day uses the clock and the home
longitude he set, else 08:00–18:00). No new spec in the smoke list: look.spec.mjs and look.test.mjs GROW (so .github/workflows is
untouched by this PR).

## Tests (each fails on the old code; run them against the old code once and say so)

- `apps/edge/test/look.test.mjs`: every ground × every colour clears the floor on every surface (text 4.5:1, lines 3:1, accent text
  4.5:1); every world defines every drawing token; every preset resolves to a full recipe; a bare colour key reads as the compatible
  recipe; the radius aliases follow the world; the sun times for his home give Paper by day.
- `tests/look.spec.mjs`: each ground applies at once and is kept across a reload, the boot plays on it; each world changes the
  floor, the corners and the marks (measured, not assumed: computed styles of the stage, a cell's radius, a reticle's class);
  each switch changes its one thing; Paper is readable (contrast measured on screen); follows-the-day flips at the stand-in clock;
  "black background" by words with no model; every control named and 44 pt at 390 and 440; THE LOOK still opens under 300 ms.
- routec, hero, boot, deck, tabs, settings, look pass; routec's swatch check extended to the presets' order.

## Validation before the PR (one step at a time; COMMIT BEFORE EVERY HEAVY STEP)

Both typechecks; the brain bundle, then look.test and catalogue.test; the web build; the preview; the specs one at a time: look
first, then settings, routec, hero, boot, deck, tabs; the full brain suite; a model-name scan of the diff; screenshots of Home,
Settings and THE LOOK in every world and every ground at 440 in tests/.shots (look at them yourself before reporting).

## The owner's phone check (write it into OWNER-ISSUES with the build record, with context in every line)

(1) Settings → Appearance → Theme: the presets first, your recipe said on the row; tap THE SCAN: black, the points, the corners sharp;
tap GLASS: today's look back; (2) GROUND → Paper in daylight: everything readable; Black at night; (3) WORLD → The Map: the grid
behind every screen and the square pins on THE LOOK; (4) GLOW off and CORNERS round: say if either looks wrong anywhere; (5)
"black background" by voice: it changes without a tap; (6) FOLLOW THE DAY on: the row says when it flips; (7) close Ghosty fully:
the boot plays on your ground, in your colour, and the recipe is kept.

## Size

One top-tier builder at max effort, five to seven hours, then review and one checks run. Not before PR #60 is on main.
