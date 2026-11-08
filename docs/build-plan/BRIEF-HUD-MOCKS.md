# BRIEF: THE HUD MOCKS — W1 THE SCAN as a whole HUD, the Lens that just knows, the richer boot; pictures before code

The owner's words and decisions: OWNER-ISSUES 139 (his pick W1, not so dark, the Machine felt and never named, easy to find),
153 (the verdict), 155 (a theme is a whole different HUD, tabs included; his input before code every time), 156 (the answers:
The Scan first; a way round that belongs to the world with the finding rule held; the cinematic longer, richer, polished;
the Lens with no key rows that just knows; list the gaps). Read STANDARD.md, then FACTS-SHELL.md (the shell today: 46 screens,
the bar, the hubs, the deck, the specs that pin them), FACTS-AWARENESS.md section 5 (the Lens's detectors), BRIEF-SHELL.md
(pass 1 is built on builder/shell1 and waiting: the finding rule as a test, favourites, Home's stamp line), the W1 mock round
(docs/build-plan/mockups/directions-2/w1/README.md and its PNGs: the world as it was drawn and picked), the boot storyboard
(docs/build-plan/mockups/boot/2026-11-07/README.md, cut.js: what the boot is today), and the design system (apps/web/src/design/
tokens.css, apps/web/src/ui/machine.ts: the tokens and the Machine's marks every mock is drawn with). The top tier.

## What to make: static mock screens on the real tokens (as directions-2 did: HTML pages built from tokens.css, rendered with
Playwright to PNG at 440 × 956 and 2×), under docs/build-plan/mockups/hud/2026-11-08/, with ONE contact sheet `contact.png`
that reads top to bottom, plus `README.md`. No app code. Every screen is W1 THE SCAN as a WHOLE HUD: the same world on
every pixel, the navigation included.

1. HOME BY THE HOUR, three moments (morning: the Brief; commute: the journey; evening: the reading), the orb at the centre as
   he decided (131), the stamp line (day · time · place · WATCHING n FEEDS · LOOKING AT HOME), what is Now, the ask.
2. THE WAY ROUND: how he gets anywhere in this world: a navigation that belongs to The Scan (the room with everything in its
   place, as W1 drew it) that still holds the finding rule (recents and favourites in two taps, everything else in three taps
   or one typed word, every screen on a visible list): draw the resting state, one tap in, and the typed word; say in the
   README how each of the 45 screens is reached and count the taps for ten of them.
3. ONE HUB (Learn) and THE DECK (Every screen) in the world; the jump bar with FAVOURITES and RECENT.
4. SETTINGS with the THEME PAGE CUT to three choices: the HUD (The Scan, with the others as "coming" and Glass as today's look),
   the colour (the twelve), the ground (black, the lit grey, paper); nothing else on that page.
5. THE LENS THAT JUST KNOWS, four frames, NO KEY ROWS: a page of print in English (the words shown, read aloud on a tap);
   a sign in another language (the translation there and then, in place); a known person and a stranger ("someone I don't
   know", nothing else) with a code in the corner opened as what it is; a mug named. One line under the viewfinder at most,
   in the Machine's marks; a tap on a thing does the one obvious act; the words for the rest.
6. THE BOOT, LONGER AND RICHER, a storyboard of ten to fourteen frames: the world assembling (the scan building up, the orb
   forming from his library, the stamp typing itself, the feeds answering, the recognition), polished as a high-grade app
   would be: say the pace of each beat, the sound (a short score or the tone only: draw both options in the README as words),
   the finish; under five seconds in all, skippable.
7. QUESTIONS FOR HIM, with context in each, recommendation first, numbered: every choice you made that he could want
   otherwise (the bar's shape, the room's layout, the type, the density, the colour of the lit things, the orb's size, the
   Lens's one line, the boot's beats and sound). Ten to twenty of them. And THE GAPS: everything you found that the plan
   misses or that the app does wrong against his words (139, 143, 153, 155, 156), as a numbered list in his terms.

## Rules

Nothing from the network; no packages; stand-in fonts from docs/build-plan/mockups/fonts; no model name anywhere; the boundary
in every frame (no stranger named, no plate, no key); not so dark (the lit graphite canvas and the plates a step up: 139);
the Machine felt and never named on screen; nothing that would fail the finding rule. Commit before every heavy render step;
write progress to /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/hud-mocks.md; look at every
PNG you make and fix what looks wrong before reporting. Report: the folder, what each sheet shows, the questions and the gaps.
