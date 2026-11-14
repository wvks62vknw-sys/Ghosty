# THE APPS ROUND: EDITORS — Documents, Sheets and Slides, pro edition (14 November 2026)

The flagship was the three office editors taken to the level of Word, Excel and Keynote. Two builders worked in parallel, one on
Documents and one on Sheets and Slides. The usage budget moved the stop to 16:15, so this round covers the flagship's core. Sections 2
and 3 of the brief (the other editors' gaps, and the new apps) were skipped, as the coordinator asked.

New spec words, at the end of check.yml's `all=`:

| Spec word | What it covers | Time here |
| --- | --- | --- |
| `docspro` | named styles, tracked changes, templates, folding, spelling | about 140–270 s |
| `gridpro` | charts, sparklines, input checks, cell formatting | about 50–110 s |
| `gridpro2` | free-form slides and their looks | about 245 s |

Each spec proves its tools end to end, with undo, a round trip through the Word, Excel or PowerPoint file, and every new screen in all
seven worlds, at 390 and at BODY 21.

All the new tools are panels inside the existing Documents, Spreadsheets and Presentations screens. No new screen was made, so the App
Kit, whose guide says not to rebuild existing screens, was not used.

## What was built

### Documents (against Word and Pages)
- **Named styles he can redefine.**
  - **Where:** the new STYLES tab.
  - **What it does:** Title, Heading 1 to 3, Body, Quote and Caption.
    - CHANGE A STYLE sets the font (serif, sans, rounded or mono), size, colour by name, bold or italic, line spacing, and the space
      before and after. Every paragraph in that style changes at once.
    - THIS PARAGRAPH gives one paragraph a look of its own. REDEFINE FROM THIS PARAGRAPH makes the style match it.
  - **Files:** styles go into Word as real Word styles and come back. The PDF and the web page use them too.
- **His own tracked changes.**
  - **Where:** REVIEW → TRACK CHANGES.
  - **What it does:** his insertions are underlined, and deleted words stay in the page struck through, each with its time. REVIEW lists
    them with ACCEPT and REJECT, plus ACCEPT ALL and REJECT ALL.
  - **Files:** they are kept in Word as Word's own tracked changes and come back.
  - Ghosty's own suggestions still work as before, separately.
- **A template gallery.**
  - **Where:** DOCUMENTS → TEMPLATES.
  - **What it does:** a letter, a CV, a report, a newsletter and an invoice, each laid out in its own styles. His name, his town and the
    date are filled in for him.
- **Folding sections.**
  - **Where:** CONTENTS.
  - **What it does:** ▾ beside a heading folds its section away in the page; FOLD ALL and UNFOLD ALL do every section. The ▲ ▼ moves still
    work on a folded section.
- **Spelling and grammar, checked on the phone.**
  - **Where:** REVIEW → CHECK SPELLING AND GRAMMAR. Nothing is sent or downloaded.
  - **What it catches:** common misspellings (British spelling counts as right), a word typed twice, a/an, a lone "i", "could of", and
    extra spaces.
  - **What he does:** ACCEPT or IGNORE each finding, or FIX ALL.

### Spreadsheets (against Excel and Numbers)
- **A chart editor with nine kinds.**
  - **The kinds:** bars, line, columns, area, pie, scatter, stacked columns, stacked bars, and line plus columns.
  - **Settings:** a title, the words along the bottom and up the side, the key on or off, and a colour.
  - **Editing:** EDIT and REMOVE on each chart, with UNDO.
  - **Files:** charts go into Excel as real Excel charts and come back.
- **Sparklines.** A little chart in a cell after a row of numbers. They are kept in Excel's own sparkline form.
- **Input checks.**
  - **What it does:** a drop-down list, tick boxes or a date picker on cells. Anything else typed in is refused, and the cell says why.
  - **Files:** the checks are kept in Excel both ways.
- **Cell formatting.**
  - **What it does:**
    - borders;
    - merge and unmerge;
    - wrap;
    - time, date and time, long date, $, € and accounting formats;
    - MAKE IT A TABLE, with a header row and banded rows, in five colours.
  - **Files:** all of it is kept in Excel, and tables are saved as real Excel tables.

### Presentations (against Keynote and PowerPoint)
- **Free-form slides.**
  - **Where:** the FREE tab.
  - **What it does:**
    - any number of text boxes, pictures and shapes;
    - dragging snaps to the slide's middle and edges, then to other items, with a guide line drawn;
    - SELECT MORE, then ALIGN, SPREAD ACROSS or SPREAD DOWN, GROUP and UNGROUP, and FORWARD, BACK, TO FRONT and TO BACK.
  - **Files:** everything goes into PowerPoint as its own shapes and groups, and comes back.

## How to try it on the phone
1. Make → EDITORS → DOCUMENTS. Try TEMPLATES, then a document's STYLES and REVIEW tabs, and CONTENTS ▾.
2. SPREADSHEETS: choose a table, then try CHART, then CELLS (lists, ticks, dates, borders, MAKE IT A TABLE). Export it to Excel and open
   it again.
3. PRESENTATIONS: open a slide, then FREE. Add a text box and a shape, drag them to see the guides, then SELECT MORE → ALIGN or GROUP.

## What was checked
- Both typechecks pass.
- The brain suite has 2,397 passing tests.
  - Three timing tests failed only while specs were loading the machine, and pass alone: two gym worker tests and one kernel 2 streaming
    test.
  - The App Library's own app-data check fails. That comes from the apps branch itself, not from the editors.
- These specs pass: docspro, gridpro, docs and editorspaper. The final run's results for slides, sheets, gridpro2, editorsgrid and
  editorsgrid2 are in the coordinator message.
  - sheets.spec's "three quick edits saved once" missed once, while it ran alongside the brain suite.

## What is left
- **Documents:** footnotes, and dragging sections by hand (▲ ▼ moves work). The PDF draws rounded and mono text in its sans font.
- **Sheets:** the PDF draws the new chart kinds as bars or a line. A list that takes its choices from other cells is not kept in Excel.
- **Slides:**
  - The theme gallery and layout ideas were not started.
  - Free items can't have builds yet.
- **Skipped by the budget:**
  - the photo, video, PDF and workspace gaps (section 2);
  - the new apps of section 3, which are now THE APP LIBRARY's job.
