# Mock-ups, round 2: instruments, but better (OWNER-ISSUES 32, continued)

The owner, 24 Oct: "I like the instruments one but I feel like it's still missing something and could be better
entirely, or if you have any other better ideas for it I'm open to that too." What C is missing, honestly: its cards
are big numbers on identical tiles. Real instruments have dials, needles and traces; a bridge has a hierarchy (what
matters now, then everything else); screens with no live number should not be instruments at all; twenty cyan glyphs
dilute the one cyan light; the kicker repeats on every card; nothing moves. Round 2 fixes those and offers one bold
alternative. Same rules as BRIEF-DECK-MOCKUPS.md (route C style.css, real glyphs, real numbers, 440 × 956, British
English, no app-icon squares), in `docs/build-plan/mockups/deck/` as `c2.html/png`, `d.html/png`, `e.html/png` and a
new `contact2.png` (C2, D, E and, for comparison, the old C).

## Shared, in all three
- **Vitals strip** under the title: one quiet line in small tabular figures: "Online · 93 ms · free AI open · database
  7% · brain on this phone: no". Grey, a cyan pulse dot before Online.
- **Real instrument graphics**, drawn as thin lines in the route C tokens: arcs with hairline ticks (database 7%, GYM
  0/22, the school ladder as 9 stops with the current one lit, library "801 of 8,556 on this phone"), a countdown ring
  (Agenda: Dentist 01:00, in 54 min), sparklines (Brief's next 24 h temperature; Markets' BTC with the change in green
  or red; God's eye's aircraft count over the last hour), level bars (Threats' 170 signals by severity; Radio's playing
  bars or a flat line when quiet).
- **Numbers in tabular figures**, large and light; units and labels small and grey. Glyphs grey (`--l2`); cyan only
  for the pulse dot, the lit "you are here" and anything due within the hour.
- **Two kinds of screen**: INSTRUMENTS (a live reading: Core, Brief, God's eye, Agenda, Markets, Threats, Library,
  School, Gym, Memory, System, Radio, Workshop) and TOOLS (Lens, 3D studio, Reverse, Space, Learn, Links, Settings):
  tools never show a filler value like "Ready"; they are compact rows with the glyph, the name and what they do.
- **A command pill** floating above the home indicator: "Go to, or ask…" (B's field, keyboard only on tap).
- Group names once, as kickers, never on every card.

## The three
- **C2, the bridge**: the NOW card full width at the top (the next event with its countdown ring, the weather small on
  its right, the training run's progress when one runs), then INSTRUMENTS as half-width cards with their graphics,
  grouped under kickers, then TOOLS as one glass card of rows. About 1.8 screens long: show the top of the page, and
  make a second PNG `c2-scrolled.png` of the lower half.
- **D, the console**: everything as instrument ROWS inside glass cards per group (56–64 pt): glyph, name and a grey
  sub-line on the left; on the right the live reading in large light tabular figures with a mini graphic beside it
  (a 44 × 18 sparkline, a 28 pt arc, the ladder dots). Tools are the same rows without a reading. Fits about 1.3 screens.
- **E, the system map** (the bold one): the Mind's constellation flattened into a HUD map that fits ONE screen: each
  screen a node (a thin ring with its glyph, 44 pt touch target), its live reading in small figures under it, hairlines
  joining related screens (Library–School–Learn–Gym; Brief–God's eye–Threats; Agenda–Memory–Core), the four groups as
  faint regions with their kickers, the current screen's node lit cyan with a soft glow, the rest grey; a small "List"
  toggle top-right for the plain index. Honest about tap targets and legibility in the report.

## Finish
Commit on the worktree branch (do not push, do not merge). Report: PNG paths; for each of C2, D, E one paragraph on
what it does well and badly on a 6.9-inch phone held in one hand; your pick; the app change for each (files, size).
