# BRIEF: THREE DIRECTIONS FOR THE REDESIGN — static mock screens on real tokens, for the owner's pick (STATUS item 1a)

Read first, in this order, nothing else unless a line here sends you there: docs/build-plan/STANDARD.md (the bar, eleven
tests), STARS.md items 160, 164, 161, 151 and 169 (the look, the Stage, Home by the hour, one Lens, the Shelf), OWNER-ISSUES 129,
130, 131 and 133, docs/build-plan/mockups/tools/common.py and render.mjs (how earlier mock-ups were built and rendered),
docs/build-plan/mockups/c2/ (the CURRENT look: route C, the one every screen has today), apps/web/styles.css lines 1–20 and
1140–1160 and 2295–2320 (today's tokens), apps/web/src/state/theme.ts (what a theme is), apps/web/src/shell/hubcards.ts (the real
names, kickers and readouts of the hub cards: use THESE words on the mock hub, never invented ones), MAP.md's "Interface map" table
only. Start from the tip of `claude/new-session-4erjve` (`git log -1` first; reset your worktree to it).

## His words (the floor)

- 4 Nov: "we need to redesign the UI A LOT since the one we currently have was designed for a very small app but we have so many
  things now it's very overcrowded … one thing we will definitely keep is the mind like the middle thing".
- 5 Nov: "with the mind i just meant the orb kinda thing in the middle … we might get rid of the iphone theme because the theme
  we currently have was designed for when we had a lot less things but we can redesign it to be a lot better since i feel like
  even you know a lot more now, and we could redesign it entirely to just look a lot better".
- 4 Nov, on the Machine: "if we're talking about something he should just make it and pull it up … in 3D, a song, whatever it is
  … he pulls it up immediately and i see it". So the Stage: the surface at the centre that takes over while something is shown,
  with Mind (the orb) becoming its frame (STARS 164).
- 4 Nov, on finding: the separate ability pages are gone because "the way i wanna redesign it you'll be able to navigate and find
  everything". The finding rule (STARS 160): two taps for recents and favourites; three taps or one typed word for everything
  else — 44 screens, 135 panels, about 150 abilities. Less on each screen, more layers.
- The bar: STANDARD's five-second test and the detail test apply to a mock as much as to a screen.

## What you deliver

Three directions, each a folder `docs/build-plan/mockups/directions/d1/`, `d2/`, `d3/`, each holding:

1. `tokens.css` — REAL TOKENS, the thing the design system will be built from: colour (canvas, three surface levels, ink at four
   strengths, hairlines, the accent and its tint, amber and red kept as today), type scale (display, title, body, caption, mono for
   readings: family, size, line height, weight, letter spacing — numerals tabular where they line up), the grid (8-point; the side
   gutter; the safe areas at the top for the Dynamic Island and at the bottom for the home indicator), radii, elevation (how a
   layer sits over another: glass, shadow, or neither), motion (three durations, two curves, named), icon size and stroke, the
   44 pt target. Every token has a one-line comment saying what it is for. The ten themes of BRIEF-THEMES must be expressible as
   a swap of the accent tokens alone: show it by including Ember's values as a second `:root[data-theme="ember"]` block.
2. `build.py` on the tools/common.py pattern (Python, no packages beyond the standard library; run as
   `python3 -I -B docs/build-plan/mockups/directions/dN/build.py` from the repo root), writing static HTML next to itself, and
   the PNGs rendered with `node docs/build-plan/mockups/tools/render.mjs` (read it; Playwright is installed) at BOTH 390 × 844
   and 440 × 956. Five screens per direction, each at both widths (ten PNGs per direction) plus one contact sheet per direction
   at 390 and ONE sheet across all three directions (`directions/contact.png`, the five screens of each direction in a row, labelled
   D1 / D2 / D3 and one line each) for his pick:
   - HOME, idle: Mind the orb at the centre; the hour's card (STARS 161: a morning Brief, a commute journey, an evening read —
     pick the evening); how recents and favourites are reached in two taps and where the typed word goes (the jump bar's place).
   - HOME, SHOWING: the Stage has taken the centre with something real on it (a route drawn, or a room in 3-D with two pieces of
     furniture: draw it as a mock, flat SVG is fine) and Mind has become its frame; one sentence under it in his voice ("That's the
     7:42 from New Street. Platform 3 — I'll say when to leave."), the chat bar where it lives, how he gets back.
   - ONE HUB (Learn, with its real cards from hubcards.ts: name, kicker, two readouts each): how a hub of ten-plus things reads
     as layers, not a wall; which card is "recent", which is "favourite", and how the rest fold.
   - THE LENS (one Lens, STARS 151–152): the camera full-bleed with three tags drawn as the Machine draws them (thin boxes, one
     true line each: "a Dracaena · tap to name it", "Text · tap to read it", "A barcode · tap for the product"), the act on a tap.
   - THE READER (BRIEF-LIBRARY-READER, STARS 169): the top line ("The Hobbit · page 42 of 300 · you were here yesterday"), the
     pills READ · CHAPTERS · SEARCH · ABOUT, the text flowing with a page mark, LISTEN, and — in a thumbnail inset or a sixth small
     frame if that is clearer — the Shelf row with a cover, the author and progress.
3. `README.md` per direction: the design statement in a paragraph a designer would sign (what it is, why it fits 44 screens and
   a Stage, what it drops), then the finding rule shown as a table (recent → 2 taps: which; favourite → 2 taps: which; everything
   else → 3 taps or a word: the path), then honest costs: what the shell (bar, hubs, deck, Home, Mind with the Stage, switcher,
   jump bar) takes to build in this direction and what every other screen's migration costs.

The three, as decided (STARS 160, OWNER-ISSUES 131 finding 6 and the clarification):
- D1 — MIND IS THE NAVIGATION. No bar. The orb at the centre is the way in: the areas live around it (a ring, a tide, a
  constellation — your call, drawn beautifully), a press on the orb opens the typed word, a drag or a tap on an area opens its
  layer, the Stage grows out of the orb. Recents and favourites nearest the orb. The hardest to make readable in five seconds:
  prove it or say where it fails.
- D2 — DROPS THE CURRENT LOOK ENTIRELY. No glass, no iOS grammar, no borrowed rounded-cell lists: a new visual language of your
  own that would look like years of work (an instrument panel in one ink; an editorial, typographic layer system; a dark
  observatory — your call, but ONE language, consistent to the pixel). Mind the orb still at the centre of Home.
- D3 — THE CURRENT LOOK, GROWN UP: route C's glass and Mind kept but with less on each screen and more layers: the bar rethought
  (fewer, bigger, or gone into the orb's ring), hubs as stacked layers, the deck folded in, the Stage given the centre.

## Rules

- Mock screens, not app code: nothing under apps/ or packages/ changes. No npm packages. Real words only (the hub cards' own
  names and readouts, real places, real book): never lorem ipsum, never a grey block where a thing should be. Numbers as a
  person writes them. Ghosty says "I". No model names anywhere (not in comments, not in file names). The CI guard job and the
  prompt guard are untouched (you touch neither).
- Both widths rendered; nothing sideways at 390; every target 44 pt; the type a designer would sign; the detail test on any three
  pixels. Mind is the one thing that must stay: the orb, at the centre of Home, in all three.
- The brief is the floor (OWNER-ISSUES 133): if you see a better fourth idea that fits inside a direction, do it there and say so in
  your report; a thing that would change what he said (the orb, ten themes, the Stage at the centre) is a question in your report,
  not a change.
- Commit on your own branch in your worktree (`builder/directions`), small commits with plain messages, the brief's checklist
  ticked in your final report: every line above, done or not done with the reason.

## Size

The mid tier, 2–3 hours, effort max (this is design work: the pick shapes every screen after it). Report back: the branch, the
PNG paths, the README paths, what you did beyond the brief, what you could not do and why, and your own one-line recommendation
between the three with the reason.
