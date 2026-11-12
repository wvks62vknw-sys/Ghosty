# BRIEF: THE FULL EDITORS, THE FIFTH: THE WORKSPACE — the core of Notion

BRIEF-EDITOR-WORKSPACE (PROGRAMME-EDITORS section 5; OWNER-ISSUES 127 "i want the full editors", 164, 176 "do all of it", 178 "insane
quality"; IDEAS-ROUND-1 item 3, the brain reads the whole project as context; QUEUE-11-NOV item 7). The second and third editors are its
engines: DOCUMENTS (BRIEF-EDITOR-DOCUMENTS, branch builder/editors: docs/model.ts Block, Run, Doc; docs/store.ts; docs/images.ts) gives it
pages, and SPREADSHEETS (BRIEF-EDITOR-SPREADSHEETS, branch builder/sheets: sheets/model.ts Book, Cell, Val; sheets/formula.ts Engine)
gives its databases their formulas. If either is not yet on main when this starts, the builder cherry-picks its commits first (as
PRESENTATIONS did with DOCUMENTS) and the orchestrator lands only the diff above that tip, after both are on main. One builder, one PR.
Read STANDARD.md, PROGRAMME-EDITORS.md (its rules for every workspace), BRIEF-EDITOR-DOCUMENTS.md, BRIEF-EDITOR-SPREADSHEETS.md and
BRIEF-EDITOR-PRESENTATIONS.md (the three shapes to match), then this. THE QUALITY RULE holds (every state designed, every word his, every
wait said, every number honest, every control 44 pt, nothing merely fine).

## His words
"no i don't agree with you, i want the full editors" (4 Nov). The product it stands in for is Notion's core: pages inside pages, a
database that is a table one moment and a board or a calendar the next, a project page that holds its documents, its tasks, its research,
its decisions and its deadlines in one place, and a brain that has read all of it before it answers.

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Protected files, not edited: apps/edge/src/agent.ts, apps/edge/src/index.ts, apps/edge/src/tools/{index,types,repo}.ts, .github/* (except the
one spec word at the END of check.yml's `all=` list; the guard job untouched), apps/*/package.json. No package may be added: the engines are
the app's own (the two editors above). A `workspace` brain tool, if wanted, is NEEDS HIS WORD for a kernel pass; the AI parts are chat turns
with the project's text as the turn's data (the prompt guard untouched).

## The engine (the app's own, no package)

- **The model (apps/web/src/workspace/model.ts):** a workspace of pages; a page has a title, an icon (one of the Machine's marks, never an
  emoji set), a parent (so pages nest without limit; the tree drawn as the LIBRARY's folders are), blocks reusing docs/model.ts's Block and
  Run (so headings, lists, tables, pictures, bold, links are the same code), plus three block kinds of its own: a page link (`link`, to
  another page by id, drawn as a card with the page's icon and title), a database view (`view`, below), and a to-do (`todo`, a checkbox at
  44 pt with a line of runs; done kept with its date). A database is a page whose rows are pages: it has properties (text, number, select,
  multi-select, date, checkbox, person from PEOPLE's names only, relation to another database, rollup over a relation (count, sum, average,
  latest), formula), and each row is a page with values for them. Formulas are worked by sheets/formula.ts's Engine: a database is laid as a
  Book with one sheet, a row a row, a property a column, so `=prop("Cost") * 1.2`, `=if(prop("Done"), "✓", "")` and the engine's whole
  function table work the same as the spreadsheet's; a relation's rollup is a range the engine sums. Views over a database: TABLE (the
  spreadsheet's grid, read-only cells editing through the row's page), BOARD (columns by a select property; a card dragged between columns
  changes it), CALENDAR (a month by a date property; a day's cards; swipe for the next month), TIMELINE (rows as bars between two dates,
  pinch to zoom from a week to a year), GALLERY (a card per row with its first picture); each view keeps its own sort, filter and hidden
  properties. Templates: NEW PAGE offers five of ours (PROJECT: a page with a TASKS board, a NOTES section, a DECISIONS table and a
  DEADLINES calendar over the one database; MEETING NOTES; A READING LIST; A TRIP; WEEKLY PLAN), each a seeded tree, every word his.
  Backlinks: a page shows, under its blocks, every page that links to it (computed from the store, never kept twice). Comments: a comment
  per block (his own words to himself, dated; the brain's suggestions through the DOCUMENTS' SUGGESTIONS path, accepted one by one, never
  applied silently). Version history: a snapshot of a page per save burst (the 200 ms rule), sixty deep per page, opened read-only and
  restored by one key (RESTORE THIS VERSION, undoable). Search: every page's title and words, the phone's own index, results grouped by
  page with the matching line; nothing sent. A History for undo across every change on the open page (sixty deep).
- **The store (workspace/store.ts, the documents' shape):** the whole workspace on the phone (one key, the newest first, about eight
  megabytes of words, pictures in docs/images.ts, the oldest version snapshots let go first and said by `room()`); it rides the phone's
  daily encrypted backup (apps/web's bundle of what lives only on the device; apps/edge/src/backup.ts keeps the ciphertext, never opens it),
  so a new phone restores it with the rest. Offline: everything edits; "synced to the brain" means this backup, said so in SETTINGS →
  WORKSPACE in one line; a plain copy on the brain for another device is NEEDS HIS WORD and named in the report, not built.
- **The brain reads the whole project (workspace/context.ts):** ASK ABOUT THIS PROJECT on a project page sends one chat turn with the
  project's pages flattened to text (titles, blocks, the databases as tables, deadlines with their dates) as the turn's data, capped at a
  size said before sending ("Sending 6 pages, about 4,000 words"), the prompt guard untouched; the reply lands under the page as a block he
  can keep or discard. "what is due this week in my project" answers from the phone's own index when the brain is unreachable (the dates
  are his data, no brain needed) and says so.
- **Import and export (workspace/md.ts, workspace/csv.ts):** a page tree to a folder of Markdown files (one per page, links rewritten
  as relative paths, a database as a CSV beside its page) zipped through convert/zip.ts with the size said; a Markdown file or a folder of
  them imported through the library's share path and the Shortcuts' `?add=` with the tree kept; a CSV imported as a database with its
  header as properties and the kinds guessed and said ("12 rows, 4 properties: 2 text, 1 number, 1 date. Change any."); anything it cannot
  keep said once.

## The screen

MAKE → THE WORKSPACE. This is the FIFTH editor: past ten things in MAKE the editors fold under one EDITORS card (the SPREADSHEETS landing's
decision, 179): the builder counts MAKE's cards on the base; if adding this card makes eleven, the four editors so far and this one move
under one EDITORS card (DOCUMENTS · SPREADSHEETS · PRESENTATIONS · THE WORKSPACE as its pills, each one tap), the hub card's line saying how
many things live on this phone across them; hubcards.spec and deck.spec learn the fold as the proof (the band rule from the SHEETS
landing: a two-row band up to ten). The catalogue entry; "my workspace" and "my projects" in the chat; the Stage's OPEN on a document
answer offers ADD TO A PROJECT. The home of the workspace: his pages as a tree (a page's children indented one step, a chevron folds
them), NEW PAGE (the five templates and BLANK), SEARCH, RECENT (the five last touched). A page: its icon and title in a line above (as the
spreadsheet's formula line: never a tiny caret), its blocks as the DOCUMENTS editor draws them with the three new kinds, "/" in a block
offering the kinds in a sheet (heading, list, to-do, table, picture, page, database, link to a page); a database view with VIEW pills along
its head (TABLE · BOARD · CALENDAR · TIMELINE · GALLERY, ADD VIEW), its sort and filter from one sheet, PROPERTIES to add, hide and reorder;
a row opens as a page (its properties at the head, its blocks below); BACKLINKS under the blocks; COMMENTS on a long press of a block;
HISTORY from the page's "…" (versions listed with their time, "3 hours ago", opened read-only, RESTORE THIS VERSION); MOVE TO another
parent; DUPLICATE; DELETE with UNDO (a deleted page sits in BIN for 30 days, said). Everything one hand: MOVE UP / MOVE DOWN keys beside
drag. Autosave said once ("Saved" fading in the truth style, the documents' rule); reopen where he was. Every state in his voice: the empty
workspace (one line and START A PROJECT / START BLANK), a database with no rows ("Nothing here yet. ADD A ROW." and the key), a view with a
filter that hides everything ("Your filter hides all 12. CLEAR IT."), a formula that cannot work (the engine's error in his one line),
an import that kept less than it read, a search with nothing found, offline (everything works), the backup not yet taken (SETTINGS says
when it last was). GLASS, THE SCAN, ONE INK and the HUDs each wear it.

## The benchmark (PROGRAMME-EDITORS 5; run on the preview and said in the PR)

A project with a board, a calendar view and three linked documents built and worked for a week without a lost edit: the spec seeds the
PROJECT template, adds twelve tasks with dates, moves four across the board, links three documents from MY DOCUMENTS, then runs a week in
one minute (the page's clock advanced a day at a time with 30 edits a day, a reload after each day, the phone's storage made to fail on day
four and said as the store says it); at the end every one of the 210 edits is there and the version history has the days. The time per
edit to "Saved" and the size of the store are said.

## Tests (each fails on the code before this brief; run against it once and say so)

- apps/edge/test/workspace.test.mjs (new; imported from an existing test file as kernel-yes was, one import line, since the test list is
  protected; NEEDS HIS WORD names it): the model (nesting, move, a cycle refused when a page is moved under its own child; backlinks
  computed; the BIN); a database's properties, relations and rollups; formulas over rows through the sheets Engine against known answers;
  every view's grouping (board columns, a month's days, timeline bars, gallery cards); the version history's depth and restore; search; the
  Markdown export and import round trip of a seeded tree (titles, nesting, links, a database as CSV, equal); a CSV import's kinds guessed.
- tests/workspace.spec.mjs (new; `all=` word `workspace` at the END of the list in check.yml, nothing else in .github touched), at 440 and
  390: (a) MAKE → THE WORKSPACE in two taps (through the EDITORS card if folded); "my workspace" opens it; (b) the empty state's words; START A
  PROJECT seeds the tree; (c) a page typed in the line above, a to-do ticked, "/" adds a table and a page link, the link opens the page and
  BACKLINKS lists the source; (d) the TASKS database: a row added, a select set, BOARD shows it in its column, a drag moves it and the row's
  property changed; CALENDAR shows it on its day; TIMELINE draws its bar; GALLERY shows its card; a filter hiding all says so and CLEAR IT;
  (e) a formula property computed and an error said in his words; a relation and a rollup summed; (f) HISTORY lists versions and RESTORE
  brings one back, UNDO reverses; (g) SEARCH finds a word in a nested page; (h) ASK ABOUT THIS PROJECT says the size before sending and the
  mocked reply lands as a block; offline, "what is due this week" answers from the phone; (i) EXPORT the zip with the size said and the
  Markdown read back by the app's importer equal; IMPORT a CSV says its kinds; (j) autosave said once; reopen where he was; the benchmark
  week with zero lost edits; (k) the Stage's OPEN on a document answer offers ADD TO A PROJECT; (l) BODY 21 clips nothing, every control
  44 pt, nothing sideways, the five templates' every word his.
- docs.spec, sheets.spec, slides.spec where landed, hubcards (the fold), deck, nav, showme, speed2, look, ink, thescan unchanged unless a
  fix lives in a screen they own.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`. Preview on port 8827:
`(nohup setsid node tests/preview-server.mjs 8827 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8827.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call. Specs from the worktree ROOT: `BASE=http://localhost:8827 NO_GL_SHOTS=1 timeout 600 node tests/<name>.spec.mjs tests/.shots`;
a nogl copy as `tests/.<name>.nogl.tmp.mjs` is never committed. In the foreground, alone, one after another: workspace, docs, sheets,
hubcards, deck, nav, showme, speed2, look, ink, thescan, layout. The brain tests in the background once at the end. A timing budget missed
under load is rerun alone before it is called red. Known sandbox reds not touched: direct, aim, radio, scroll, safari, eye's own screenshot,
tabs2, talk's cooling lines.

## The owner's phone check

1. MAKE: THE WORKSPACE (or EDITORS, then THE WORKSPACE): the empty page; START A PROJECT: the tree, the board, the calendar, the table.
2. Add three tasks with dates; drag one across the board; switch to CALENDAR: they sit on their days. TIMELINE: the bars. Pinch it.
3. Type a page; "/" for a to-do, a table and a link to another page; open the link; the other page lists yours under BACKLINKS.
4. A formula property: cost times 1.2; break it on purpose: the error in Ghosty's words.
5. HISTORY on a page: restore yesterday's; UNDO. SEARCH a word you typed deep in the tree.
6. ASK ABOUT THIS PROJECT: it says how much it sends first; the answer lands under the page. Aeroplane mode: "what is due this week".
7. EXPORT: the size said; open the zip on the phone: one Markdown per page, the CSV beside the board. Share a CSV to Ghosty: a database.
8. Does it feel like a workspace or like a folder of documents? Say which.

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/workspace-report.md: what was built, the fold of MAKE's
cards if it happened (before and after counts), the benchmark week's numbers, each spec's last line (before and after for the new ones),
found-not-fixed, NEEDS HIS WORD (the test's name in the list; a `workspace` tool; a plain copy on the brain for a second device), the
phone check as above, the commit list. One commit per step on builder/workspace; the orchestrator squashes to one on landing.
