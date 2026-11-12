# BRIEF: THE FULL EDITORS, THE FOURTH: PRESENTATIONS — the core of PowerPoint

BRIEF-EDITOR-PRESENTATIONS (PROGRAMME-EDITORS section 4; OWNER-ISSUES 127 "i want the full editors", 164, 176 "do all of it", 178 "insane
quality"; IDEAS-ROUND-1 item 6, a research report becomes an editable deck; QUEUE-11-NOV item 7). The second editor, DOCUMENTS (BRIEF-EDITOR-
DOCUMENTS, branch builder/editors), is the shape this one matches: its block model (docs/model.ts: Block, Run, Doc), its store (docs/store.ts),
its MAKE room entry, its Stage OPEN hand-over, its export sheet with the size said, its autosave rule. If DOCUMENTS is not yet on main when
this starts, the builder cherry-picks its commits first (as SPREADSHEETS did) and the orchestrator lands only the diff above that tip. One
builder, one PR. Read STANDARD.md, PROGRAMME-EDITORS.md (its rules for every workspace), BRIEF-EDITOR-DOCUMENTS.md and BRIEF-EDITOR-
SPREADSHEETS.md (the two shapes to match), then this. THE QUALITY RULE holds (every state designed, every word his, every wait said, every
number honest, every control 44 pt, nothing merely fine).

## His words
"no i don't agree with you, i want the full editors" (4 Nov). The product it stands in for is PowerPoint's core: a deck of slides with a
theme, titles, bullets, a picture, a chart, a table, a shape or two, speaker notes, a slide show with the notes in his hand, a .pptx that
opens unchanged in PowerPoint and Keynote, and someone else's .pptx opened and changed here.

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Protected files, not edited: apps/edge/src/agent.ts, apps/edge/src/index.ts, apps/edge/src/tools/{index,types,repo}.ts, .github/* (except the
one spec word at the END of check.yml's `all=` list; the guard job untouched), apps/*/package.json. No package may be added (the programme
names pptxgenjs; it is not added): the engine is the app's own (below); a `slides` brain tool, if wanted, is NEEDS HIS WORD for a kernel pass,
and the AI parts are chat turns with the slide's words as the turn's data (the prompt guard untouched).

## The engine (the app's own, no package)

- **The model (apps/web/src/slides/model.ts):** a deck of slides; a slide has a layout (title, title and bullets, two columns, picture with a
  caption, chart, table, quote, section, blank), its blocks reusing docs/model.ts's Block and Run for text (so bold, italic, links and lists
  are the same code), a picture (the documents' image store, shrunk to 1,280 px, never sent), a chart (the app's own show/chart data: the
  rows and the kind), a table (the documents' table block), one or two shapes (rectangle, rounded, ellipse, arrow, line) with their size
  and fill from the theme's own sequence, speaker notes (one text block), and a build order for its elements; a deck has a theme and a
  master (title position, body position, footer with the slide number and the deck's name, on or off). Themes: the design system's own
  palette as the first and the app's existing themes (state/theme.ts THEMES) as the rest, each a named set of ground, type colour, accent
  and the sequence; no new hex (the ratchet holds). Transitions per slide (none, fade, push) and builds per element (appear, fade, rise);
  reduced motion stills every one. A History for undo across every change (sixty deep).
- **The file (slides/pptx.ts, slides/pptxread.ts):** .pptx written and read by the app's own code over convert/zip.ts (a .pptx is a zip of
  XML: [Content_Types].xml, _rels, ppt/presentation.xml, slides/slideN.xml and their rels, one slideLayout per layout used, one slideMaster,
  a theme1.xml carrying the deck's theme colours and fonts, notesSlides for the notes, media for the pictures as JPEG, the chart as a table
  of its numbers on the slide (a chart part is NOT written: said once in the export sheet as "the chart is a picture in the file and lives in
  the PDF; the numbers are on the slide")); a reader that opens someone else's .pptx with text, pictures, tables, notes and the slide order
  kept and anything it cannot keep (a video, an animation, a SmartArt) said once, never silently dropped; PDF out through the documents' A4
  path turned landscape, one slide a page, notes pages after if he asks; a PNG of one slide for a share. Animations and transitions are not
  carried into the .pptx (said once in the export sheet).
- **A report becomes a deck (slides/fromreport.ts):** a research report from the cited pipeline (its sections, its sources, its chart), a
  document from MY DOCUMENTS, or any chat reply with headings becomes an editable deck: one slide per heading with its first lines as bullets,
  a chart slide where the report has a chart, a sources slide at the end with the citations, the title slide from the title and the date; every
  slide editable after.

## The screen

MAKE → PRESENTATIONS (a hub card beside DOCUMENTS and SPREADSHEETS; the catalogue entry; "my slides" in the chat; the Stage's OPEN on a
document or chart answer offers MAKE SLIDES OF IT). The deck as a vertical film of slides at the phone's width; a tap opens a slide to edit
(the slide fills the width, 16:9, text at reading size; a pinch zooms); the layout picked from a sheet of the nine; the title and bullets typed
in a line above the slide (as the spreadsheet's formula line: never a tiny caret on the slide), each bullet a block, Enter adds one, the
documents' marks (bold, italic, link) on a selection; INSERT a picture (his photos), a chart (from a typed table, from a spreadsheet's range
where SPREADSHEETS has landed, or from the Stage's last chart), a table, a shape; the theme from one sheet with every slide repainted at
once; NOTES under each slide (a 44 pt key opens them); REORDER by long press and drag (and MOVE UP / MOVE DOWN keys for one hand); DUPLICATE;
DELETE with UNDO; PRESENT: the phone shows the current slide, the notes, the next slide's title, the time elapsed, NEXT and BACK at 44 pt, a
tap on the slide advances a build, a two-finger tap goes back; with THE WALL paired (where landed), PRESENT ON THE WALL sends each slide to
the wall as a `slide` kind (added to the wall's gate list and renderers, the phone keeping the notes) and the wall shows the slide alone; a
controller's or keyboard's arrows work. EXPORT (.pptx, PDF, one slide as PNG) with the size said; IMPORT (.pptx) through the library's share
path and the Shortcuts' `?add=`. Autosave said once ("Saved" fading in the truth style, the documents' rule); reopen where he was. Every state
in his voice: the empty deck (one line and START FROM A REPORT / START BLANK), an import that kept less than it read, offline (everything
works; export needs nothing), a chart with no numbers, a picture that failed to read. GLASS, THE SCAN, ONE INK and the HUDs each wear it.

## The benchmark (PROGRAMME-EDITORS 4; timed on the preview and said in the PR)

A ten-slide deck from a research report: START FROM A REPORT on a seeded report with six sections and a chart; the theme changed; two slides
reordered; a picture inserted; notes typed on three slides; PRESENT walked through with the notes shown; exported to .pptx and read back by
the app's own reader with every slide's words, the notes and the order equal; opened in PowerPoint and Keynote unchanged (NEEDS HIS PHONE; the
reader's round trip and an XML well-formedness check stand for it here).

## Tests (each fails on the code before this brief; run against it once and say so)

- apps/edge/test/slides.test.mjs (new; imported from an existing test file as kernel-yes was, one import line, since the test list is
  protected; NEEDS HIS WORD names it): the model's layouts and undo; the .pptx writer's parts present and well formed ([Content_Types].xml
  names every part; every rels target exists; the slide count equals presentation.xml's list; the theme carries the deck's colours); the writer
  and reader round trip of the benchmark deck (words, notes, order, the table, the picture's presence, the layout per slide); a hand-built
  .pptx fixture written independently of our writer (two slides, a picture, a table, notes, a video reference) read with what it could not
  keep named; a report's sections becoming slides with the sources last.
- tests/slides.spec.mjs (new; `all=` word `slides` at the END of the list in check.yml, nothing else in .github touched), at 440 and 390: (a)
  MAKE → PRESENTATIONS in two taps; "my slides" opens it; (b) the empty state's words; START FROM A REPORT on a seeded report makes the slides
  and the sources slide; (c) a slide edited in the line above it, a bullet added, bold on a selection; the layout changed from the sheet; (d)
  INSERT a picture, a chart from a typed table, a table, a shape; (e) the theme changed repaints every slide (a colour sampled on two slides
  equal to the theme's); (f) REORDER by MOVE DOWN and by drag; DUPLICATE; DELETE and UNDO; (g) NOTES typed; PRESENT shows the slide, the notes,
  the next title, NEXT and BACK; a build advances on tap; reduced motion stills the transition (no transition class); (h) EXPORT .pptx: the
  size said before; the file read back by the app's reader equal; the XML well formed (the spec parses every part with DOMParser); EXPORT PDF
  one slide a page; a PNG of one slide; (i) IMPORT of the fixture .pptx keeps its text and says what it could not keep; (j) autosave said once
  and the deck reopens where it was; (k) the Stage's OPEN on a document answer offers MAKE SLIDES OF IT and lands in a new deck; (l) BODY 21
  clips nothing, every control 44 pt, nothing sideways, the slide upright at 16:9 in the width.
- docs.spec (DOCUMENTS), sheets.spec where landed, showme, speed2, look, ink, thescan, hubcards, deck, nav unchanged unless a fix lives in a
  screen they own.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`. Preview on port 8825:
`(nohup setsid node tests/preview-server.mjs 8825 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8825.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call. Specs from the worktree ROOT: `BASE=http://localhost:8825 NO_GL_SHOTS=1 timeout 600 node tests/<name>.spec.mjs tests/.shots`;
a nogl copy as `tests/.<name>.nogl.tmp.mjs` is never committed. In the foreground, alone, one after another: slides, docs, showme, speed2,
look, ink, thescan, hubcards, deck, nav, layout, talk. The brain tests in the background once at the end. A timing budget missed under load
is rerun alone before it is called red. Known sandbox reds not touched: direct, aim, radio, scroll, safari, eye's own screenshot, tabs2,
talk's cooling lines.

## The owner's phone check

1. MAKE, PRESENTATIONS: the empty page; START FROM A REPORT on a report you have: the slides and a sources slide at the end.
2. Tap a slide, change its words in the line above; add a bullet; make one bold. Change the theme: every slide repaints.
3. INSERT a photo on one slide and a chart from a few typed numbers on another. Move a slide down; duplicate one; delete one and UNDO.
4. NOTES on a slide; PRESENT: the slide, your notes and the next title in your hand; NEXT and BACK; a tap advances a build.
5. With the TV paired (when THE WALL has landed): PRESENT ON THE WALL: the slide alone on the TV, the notes on the phone.
6. EXPORT .pptx (the size said); open it in Keynote or PowerPoint: the same slides, the notes there. Share someone's .pptx to Ghosty: it
   opens, and what it could not keep is said once.
7. Does it feel like a slide app, or like a document with borders? Say which.

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/slides-report.md: what was built, the parts the .pptx writer
writes, what the reader keeps and says it cannot, the benchmark's time, each spec's last line (before and after for the new ones), found-
not-fixed, NEEDS HIS WORD (the test's name in the list; a `slides` tool; the wall's `slide` kind if THE WALL is not yet landed), the phone
check as above, the commit list. One commit per step on builder/slides; the orchestrator squashes to one on landing.
