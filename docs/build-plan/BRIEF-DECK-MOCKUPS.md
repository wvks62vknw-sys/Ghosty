# Mock-ups: the Every screen deck and the icon language without "app icons" (OWNER-ISSUES 32)

The owner, 24 Oct: "The only thing I don't like about the whole design is the way the things are designed, like
they're like app icons, but I don't want it to be like that." He means the tinted-glass squircles with a coloured
glyph (the "one icon language" block in `apps/web/styles.css`, used by the Every screen deck `.dtile`, the Me sheet's
`.merow .sq`, hub tiles `.hubtile .sq`, recents `.recent .sq`, row icons `.rowic`, Search `#palette .gic`). Ghosty
should feel like one assistant with a cockpit, not a phone full of apps. He picks design from real screenshots, so
this job makes THREE mock-ups of the Every screen deck in a new icon language, plus the Me sheet in that language,
as PNGs at 440 × 956 (iPhone 18 Pro Max), and a contact sheet. Nothing in the app changes in this job.

Read BRIEF-W0.md, BRIEF-DESIGN-C1.md (what route C is), `docs/build-plan/mockups/c/` (the route C mock-ups: copy its
`style.css` and `build.py` approach so the three look exactly like the app), `apps/web/src/shell/launcher.ts`
(SECTIONS: the four groups and their screens, the greeting "At your service, <name>"), `apps/web/src/shell/areas.ts`
(areas and tints), `apps/web/src/core/dom.ts` `icon()` (the real SVG glyphs: use them), `apps/web/src/shell/tabs.ts`
(each screen's title and blurb). Screenshots of the current deck and Me sheet are in
/tmp/claude-0/-home-user-Ghosty/6a05925c-6839-5546-8e68-c6df376dadfa/scratchpad/design-build-2/18-every-screen-deck.png
and 01-polish-settings.png (read them first).

## The new icon language (all three options)
No filled, tinted squares behind glyphs anywhere. Glyphs are thin monochrome lines (stroke 1.6–1.8), in the text
colour at rest and the accent (cyan) for the live or selected one; where a touch target needs a shape, a thin ring
(0.5–1 px, `--line`) or nothing. Names in sentence case. Live readouts in grey. Kickers (small, spaced capitals, grey)
name the groups. Everything else stays route C: the glass, the type, the spacing, the large title.

## The three options
A. **The index**: one scrolling page; each group a glass card (kicker above it); rows of 56 pt: the line glyph (22 pt,
   left), the name (17 pt, semibold), under it one grey line of what is there right now ("Next: Dentist, 01:00 · 4
   reminders", "8,556 passages · 801 on this phone", "Nursery · 2 papers sat", "Risk off · BTC −2.1%"), a chevron.
   Settings and Search as the top card. Calm, like iOS Settings, unmistakably one app.
B. **The command deck**: at the top a large glass field "Go to, or ask…" with the keyboard shown (the mock-up fakes
   it) and the matching screens filtering as you type ("ag" → Agenda); under it a RECENT row (the last four screens as
   text pills with a tiny glyph), then the four groups as text pills that wrap (name only, a count where one exists:
   "Agenda 4", "Library 8,556"); no glyph grid at all. Fast, text-first, JARVIS.
C. **Instruments**: two cards per row, each 16:10 glass, with the group kicker inside, the screen's name, ONE live
   value large and light (the number or the headline: "01:00" / "Dentist", "8,556" / "passages", "Nursery", "8°C"),
   and the line glyph small in the top-right corner in the accent; the Mind's four Home gauges are the model. Below
   each group's cards, nothing else. A cockpit of instruments; tapping one opens it.
Plus, in the same style as the pick will be: the Me sheet (Memory, Settings, System, Links, Every screen) with
monochrome glyphs and no tiles, once (`me.png`), and a 2 × 2 contact sheet `contact.png` (A, B, C, Me) with labels.

## Rules
Real content (the owner's name is "Boss"; use the same numbers the app shows in the screenshots above); every mock-up
exactly 440 × 956; British English; nothing animated. Keep each HTML self-contained except the shared `style.css`.
No changes outside `docs/build-plan/mockups/deck/`. Playwright is installed at the repo root (Chromium only;
`node -e` with `playwright` or the python `build.py` pattern from mockups/c, whichever that folder uses).

## Finish
Commit on your worktree branch (do not push, do not merge). Final report: the PNG paths, one paragraph per option on
what it does well and badly on a 6.9-inch phone, your own pick and why, and what the app change would involve for
each (files, rough size).
