# BRIEF: THE THEME GALLERY — seven looks, each a whole HUD, colour the only choice

OWNER-ISSUES 155 (his words: "i want every theme as like a whole different hud as a whole like even the tabs are different"; the
Theme page cut to the HUD, the colour and nothing of the dials), 157 (his words: "i want ENTIRELY different looks for the theme
... i want each one to be an option ... it should just be prebuilt apart from the colours which you can change"; decided: every
direction from both rounds is a theme, each an entirely different whole HUD, only the colour changeable; the Theme page is a
gallery of the looks with the colour under it; THE SCAN built first and the others one per PR, each mocked first), 162 and 163
(THE SCAN and the Lens that just knows are on main). THE DESIGN IS THE ROUND-TWO MOCK: docs/build-plan/mockups/hud/2026-11-08-2/
theme.png and theme.html (view the PNG; the HTML carries the exact type, plates and spacing; its stills come from the direction
sheets in docs/build-plan/mockups/directions/, directions-2/, c2/ and hud/). Read STANDARD.md first, then this, then
apps/web/src/features/settings/index.ts (where the Theme page is pushed: `g-themepage`), apps/web/src/state/theme.ts (the
recipe: ground, colour, world, switches; PRESETS; applyRecipe), packages/shared/src/themes.ts (GROUNDS, COLOUR_KEYS, WORLDS and
their lines), apps/web/src/ui/dials.ts (the dials the page shows today, to be withdrawn from it), apps/web/src/features/look/
index.ts (THE LOOK, the design system's own screen: untouched but for its THEMES words), and tests/look.spec.mjs section 7
(BRIEF-THEMES-2), tests/routec.spec.mjs [themes] and [themes2], tests/settings.spec.mjs where it reads the Theme page. The mid
tier. Start from the session branch (main's tree).

## What is fixed

1. **THE THEME PAGE IS A GALLERY OF SEVEN LOOKS AND A ROW OF COLOUR. NOTHING ELSE.** Two taps from Settings as today. One
   plate: `THE LOOK · <the look he is in>` with `7 · each a whole HUD` at its right; then seven cards in two rows of three and
   one, in this order and with these words (the mock's): THE SCAN (`YOU'RE IN IT` when he is; else its line), THE MAP, THE EYE;
   ORBIT, ONE INK, GROWN UP; GLASS (`Today's look`). Each card is a still of that look's Home (2) with its name in the
   system's tag type and its one line under (THE MAP "The field, from above", THE EYE "Attention is the design", ORBIT "Mind is
   the way round", ONE INK "A printed page", GROWN UP "Today, with less": take the exact lines from theme.html). The chosen
   look's card carries the reticle's corners in his accent (as the mock's THE SCAN card does). Under the cards: `THE COLOUR ·
   <name> · YOURS TO CHANGE` and the twelve colours as the mock draws them (a ring on the chosen one), applying at once, kept
   across a reload, the boot in the picked colour (as today). The ask line under the page reads `Say a look, or a colour`.
   The dials, the switches, the five-ground row, the seventeen-preset row and "Custom" GO FROM THE PAGE (155, 157); their
   state stays in the recipe and the settings exactly as it is (nothing is deleted from state/theme.ts or shared/themes.ts),
   and every one of them still answers to the words it answers to today ("paper", "black background", "glow off", "calm"):
   the chat's tables are untouched. THE LOOK (the design system's screen) keeps its THEMES section as it is.

2. **WHICH LOOKS CAN BE PICKED.** THE SCAN and GLASS are built: a tap applies that world (recipe.world 'scan' or 'glass') at
   once, the card says `YOU'RE IN IT`, Home changes on the way back (The Scan's frame or today's Home), kept across a reload.
   THE MAP, THE EYE, ORBIT, ONE INK and GROWN UP are not built yet: their card carries a small `COMING` mark in the corner (the
   system's tag, ink-3), a tap says one toast ("<NAME> is coming: <its line>") and changes nothing. Nothing else is promised.
   (ORBIT was a way round in round one, not a drawing: here it is one of the seven as 157 decided; its line says what it is.)

3. **THE STILLS.** Seven pictures of each look's Home at 440, cropped to the card's shape (the mock's 3:2 above the name), taken
   from the mock sheets the mock itself used (theme.html names them): rendered once to apps/web/public/looks/<key>.webp (or
   .jpg where webp is not available to you) at 2× the card's size, each UNDER 60 KB, the seven under 350 KB together; say the
   sizes in your report. The Scan's still is from docs/build-plan/mockups/hud/2026-11-08-scan1/ (the world frame at 440) and
   GLASS's from a screenshot of today's Home on the preview with the Scan off. `loading="lazy"`, width and height set, alt text
   the look's name.

4. **THE LOOK.** The mock's page in the system's tokens (design/tokens.css, the g-* tokens; THE SCAN's plates as the Scan's Home
   draws them when body.scanhome is on; in Glass the same structure in Glass's marks), the stamp line at the top saying LOOKING
   AT THE THEME (the shell's one source), the house along the bottom as the HUD he is in draws it. Every card and swatch a 44 pt
   target; nothing sideways at 390 or 440; the page opens in under 300 ms on the preview (the speed habit; look.spec holds it
   for THE LOOK, hold it here the same way).

5. **WORDS.** "the scan", "glass", "show me the looks", "ember" and the twelve colour names keep working through the no-model
   tables as today (find how routec and look.spec send them); "the map" / "the eye" / "one ink" / "orbit" / "grown up" by words
   answer with the same one line as the card's toast and change nothing.

## What must not change

The prompt guard; the CI guard job; `.github/*`, `apps/*/package.json`, the kernel files untouched; no packages, nothing from the
network, no new keys; never a model name; THE SCAN's Home and the Lens untouched; the recipe's state and every word's table
untouched (the page loses its controls, the app loses no setting); the specs' names stay (look, routec, settings, themes if
there is one) and check.yml is not touched; re-cut, never loosen: every check on a control that leaves the page becomes its
opposite (no dial, no switch, no ground row, no seventeenth swatch on the page), and every check on what stays (the twelve
colours apply and are kept, the boot in the picked colour, PAPER readable where it is still reached by words, 44 pt, nothing
sideways, the speed budget) is kept as it is.

## Tests (each fails on the code before this brief; run them against it once and say so in your report)

In tests/look.spec.mjs section 7 (re-cut) and tests/routec.spec.mjs [themes]/[themes2] (re-cut):
1. Two taps from Settings: the Theme page shows exactly seven cards in the order above with those names and lines, the chosen one
   marked (THE SCAN `YOU'RE IN IT` on a fresh open); five carry COMING, two do not; no `.swatch[data-theme]` for a direction,
   no dial, no switch, no ground row anywhere on the page (assert the selectors look.spec uses for them today are absent).
2. A tap on GLASS: recipe.world is 'glass' at once, the card says `YOU'RE IN IT`, Home on the way back is today's Home (no
   body.scanhome), kept across a reload; a tap on THE SCAN brings The Scan back (body.scanhome, the frame).
3. A tap on THE MAP: one toast with its line, recipe.world unchanged, no navigation.
4. The twelve colours: each applies at once (the accent token and the lit tab, as today's check), the pick survives a reload,
   the next boot plays in it (today's checks, kept).
5. Every card's still is an <img> under apps/web/public/looks/ with width, height and alt, and loads (naturalWidth > 0) on the
   preview; each file under 60 KB (a pure test or a check in the spec).
6. 44 pt and nothing sideways at 390 and 440; the page's first open under 300 ms (the stopwatch, as THE LOOK's).
7. "paper" and "black background" by words still change the ground (today's check, kept; the ground is reached by words now,
   not from the page).

## Validation before the PR (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; results to the scratchpad file)

`cd apps/web && npx tsc --noEmit -p . && node build.mjs`; the brain untouched (say so); the preview on PORT 8798
(`setsid node tests/preview-server.mjs 8798`; never 8797); ONE AT A TIME with `BASE=http://localhost:8798 timeout 480 node
tests/<name>.spec.mjs tests/.shots`: look, routec, settings, thescan (The Scan's Home still the default), character (the words),
boot (the boot in the picked colour). Two cores: never two specs at once. Screenshots of the page at 440 and 390 (THE SCAN
chosen, then GLASS chosen) into the scratchpad.

## The owner's phone check (write it into your report in these terms)

(1) Settings → Theme: seven looks as pictures, THE SCAN marked YOU'RE IN IT, the colours under; does it read as "pick a look,
pick a colour, done"? (2) Tap GLASS: today's Home comes back; tap THE SCAN: the world comes back. (3) Tap THE MAP: it says it is
coming, nothing else. (4) Pick a colour: the page, Home and the next boot wear it. (5) Anything on the page that should not be
there? (6) Does the ground (black, paper) belong on the page too, or is it right that a look comes with its ground and paper is
asked for by a word?

## Report

In the scratchpad file: every commit's hash and one line; each spec's result verbatim; the stills' sizes; the screenshots; the
calls you made that the brief left open; the owner's phone check; what you did not do and why. Never push. Never touch a
protected file. Named by tier, never by model.
