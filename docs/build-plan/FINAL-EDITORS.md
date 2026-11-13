# FINAL ROUND: THE EDITORS LANE (13 November 2026)

The six editors are documents, spreadsheets, presentations, the workspace, photo and video. Each was checked against the best
app of its kind on a phone:

| Editor | Measured against |
| --- | --- |
| Documents | Pages and Word |
| Spreadsheets | Numbers and Excel |
| Presentations | Keynote |
| Workspace | Notion |
| Photo | Lightroom and Snapseed |
| Video | CapCut and iMovie |

For each editor we looked for:
- anything broken, contradictory or promised but missing;
- the everyday tools that matter most on a phone, and whether each one works end to end, makes the round trip through its file
  format, undoes, and stays fast on big files.

Whatever was found was then built for real. Video's export length and steadying belong to the CI TIMING lane and were left alone.

How the work was done: three builders worked in parallel, documents with the workspace, spreadsheets with presentations, and
photo with video. A separate reviewer then read all of the changes looking for faults before the merge.

## Decisions made with nobody to ask
- **Protected files.** The only one touched is `.github/workflows/check.yml`, and only to add the word `editorslane` at the end of
  `all=`.
- **The test slide's transition.** The hand-made PowerPoint file the slides spec uses had a fade transition, and fades are now kept.
  The fixture was changed to a wipe, which the editor really cannot keep, so the test still proves we say when something is lost.
  A brain test now checks that a wipe is never passed off as another transition.
- **Sheet size.** A sheet holds at most 10,000 rows, so the big-file test uses 9,998, which leaves room to insert rows. On a full
  sheet, inserting a row is refused, and the sheet says why.
- **Find and replace in slides** ignores capitals. A word split across bold and plain text is not found.
- **Checklist ticks** in documents are stored as `ticked`, because the workspace already uses `done` for a date on the same block
  type.
- **The highlight colour** is mixed from the existing amber token, so no new colours were added.
- **Photo.** Most of the usual photo tools were already there: crop ratios and straighten, hold to see the original, looks and saved
  looks, vignette, heal and batch. The real gap was copying one photo's edits to another, so that was built.

## What was wrong, and what was made

### Every editor
- **A red check in CI: photo2 (d).** EXPORT ORIGINAL on a RAW photo sometimes saved a small JPEG under the RAW's name. A JPEG that was
  still being made before he tapped THE ORIGINAL could finish late and replace the original file.
  - **Fix:** THE ORIGINAL now always sends the file's own bytes, and a JPEG still in progress is thrown away.
  - **Test:** the spec now waits until the screen shows THE ORIGINAL's real size, instead of waiting a fixed 300 ms.
- **Notifications set-up crashed** on a browser that gives no push manager, for example a private window. The final branch's fuller
  guard is kept.
- **A new spec, `editorslane`.** It proves every new tool below end to end, with undo and a round trip. It runs every editor:
  - in all seven looks (scan, map, eye, orbit, grown, ink and glass) at 440 × 956;
  - in The Scan at 390 × 844;
  - at BODY 21.

  Everywhere it checks that every key is 44 pt, nothing goes sideways and no words are cut.

### Spreadsheets
**What was wrong:**
- There was no way to insert or delete rows or columns.
- There was no AutoSum.
- CLEAN THIS COLUMN showed only the first 12 suggested changes, but ACCEPT ALL applied up to 40, so it changed cells he never saw.
- Big files were slow. Every edit rebuilt the whole Excel file and the CSV, just to show their sizes.

**What was made:**
- **On the DATA tab:** ROW ABOVE, ROW BELOW, DELETE ROWS, COLUMN BEFORE, COLUMN AFTER and DELETE COLUMNS. A column's header also offers
  INSERT A COLUMN BEFORE and DELETE THIS COLUMN.
- **Everything follows its cells:** every formula on every sheet, named ranges, charts, column widths, row heights and the filter. A
  formula that pointed only at a deleted cell shows #REF!, as in Excel.
- **Σ (AutoSum) on the top bar.** On one cell, it adds the numbers above, or the ones beside it if there are none above. On several
  cells, it puts a total under each column.
- **Ghosty's tidy suggestions** are listed one by one, each with its own ACCEPT and REJECT. ACCEPT ALL and NO THANKS are still there.
- **Speed:** on a big workbook, the file sizes wait until he stops typing.
  - A 9,998-row CSV opens in about 0.6 s; it took 1.8 s before.
  - Inserting a row at its top takes about 0.7 s.
- Each of these is one step of UNDO and REDO.

**Try it:**
1. MAKE → Spreadsheets → NEW.
2. Type 10, 20 and 30 down a column, tap the cell below, and tap Σ.
3. Tap a cell in the middle, then DATA → ROW ABOVE. The total's range grows to take in the new row.

### Presentations
**What was wrong:**
- There was no way to skip a slide in the talk.
- There was no find and replace.
- The PowerPoint file dropped every transition.

**What was made:**
- **SKIP IN THE TALK** on the SLIDE tab. The slide is marked SKIPPED, and the talk steps over it in both directions.
- **FIND** on the deck's toolbar. It searches titles, text, tables and notes on every slide, and says how many it found and where, with
  a key to jump to each. REPLACE ALL changes every match.
- **The PowerPoint round trip:** fade and push transitions and skipped slides are saved the way PowerPoint saves them, and they come
  back the same. Builds (animations) are still not carried, and the screen says so.
- UNDO and REDO cover all of it.
- A deck of 100 slides opens in under a second.

**Try it:**
- Tap a slide → SLIDE → SKIP IN THE TALK, then PRESENT.
- Or FIND, type a word, then REPLACE ALL.

### Photo
**What was wrong:**
- There was no way to copy one photo's edits onto another.
- The BRAIN tray said the photo had gone to the brain before he had pressed anything.
- An edit made just before leaving could be lost. The save drew the shelf picture first and wrote the edit after, and nothing was
  saved when the app was swiped away.

**What was made:**
- **COPY EDITS and PASTE EDITS** in the LOOKS tray. They carry light, colour, curves, detail and effects. Crop, masks, heals and the
  layer are never carried. PASTE is greyed until something has been copied, the paste is one step of UNDO, and the copy stays on the
  phone.
- **Safer saving:** the edit is written first, and again when the app is swiped away or the phone locks.
- **Speed, measured:** a 24-megapixel photo opens in about 5 s, and an edit on it redraws in about 0.3 s, both on the test machine's
  software graphics.

**Try it:**
1. MAKE → EDITORS → PHOTO.
2. Open a photo, change the light, then LOOKS → COPY EDITS.
3. Open another photo, then LOOKS → PASTE EDITS. UNDO takes it back.

### Video
**What was wrong:**
- MOVE LEFT on the first clip and MOVE RIGHT on the last did nothing, with no sign why.
- There was no way to copy a clip.
- There was no fade from or to black.
- A change made in the last moment before the app was swiped away was lost.

**What was made:**
- **DUPLICATE CLIP** in ORDER. The copy goes just after the clip and takes no extra space. It undoes, redoes and survives a reopen.
- **MOVE LEFT and MOVE RIGHT** are greyed at the ends, and their spoken names say why.
- **FADE IN and FADE OUT** in TRANSITION, on every clip, the last one included. The clip's own sound fades with the picture. The fade
  lasts one second, or a third of a short clip, and stays right through trims and speed changes. The preview and the export draw it
  the same way.
- **Saving:** the project saves at once when the app is hidden.

**Try it:**
1. MAKE → EDITORS → VIDEO, then add two clips.
2. ORDER → DUPLICATE CLIP, then UNDO.
3. TRANSITION → FADE IN, then scrub to the start. The picture is black.

### Documents
**What was wrong:**
- There was no strikethrough, no highlighter and no checklist.
- A link written out to Markdown or a web page came back in as plain words.
- **A real bug:** if he styled some words and the page then redrew itself, the paragraph he was in could write its old words back
  over the change.
- The style keys could act on words he had chosen earlier and then let go of.
- In a long document, every tick redrew the whole page and counted every page again.

**What was made:**
- **On WRITE:** S (strike), MARK (highlight) and ☐ CHECKLIST.
  - Pressing MARK or S a second time takes the mark off.
  - Each checklist item has its own 44 pt box to tick.
  - Enter on an empty item ends the list, the way Pages and Word do.
  - Each change is one step of UNDO and REDO.
- **The round trip:** strike, highlight and checklists all survive Markdown, HTML and Word, out and back in, and the PDF shows the
  boxes too. Links now come back in from Markdown and HTML.
- **With nothing chosen,** S and MARK say so instead of acting on old words.
- **Speed:** a 1,500-paragraph document opens in about 0.5 s, and a tick takes 9 ms.
- **Ghosty's changes:** his edits were already marked as suggestions that he accepts or rejects one by one.

**Try it:**
1. MAKE → Documents → NEW, and type a few lines.
2. Hold to choose a word, then tap S or MARK.
3. Tap a line, tap CHECKLIST, then tick its box.
4. UNDO. Then export MARKDOWN or WORD and open the file again.

### Workspace
**What was wrong:**
- Most of Notion's everyday tools were already there: to-dos, "/", backlinks, duplicate, undo and redo, and database sort and filter.
- Callouts and strikethrough were missing.
- Struck or highlighted words were lost when a page was read in.
- A style clash put a callout's words on top of its mark.

**What was made:**
- **CALLOUT,** in ADD A BLOCK and after "/". It is a tinted box with a 44 pt mark. Tapping the mark changes it from a note to a tip to a
  warning, and each change undoes.
- **The round trip:** a callout is saved as `> [!WARNING] …` in the exported zip and comes back in on IMPORT.
- **An S key** on the line's toolbar. Struck and highlighted words are kept when a page is read in and through Markdown.

**Try it:**
1. MAKE → The workspace, then open a page.
2. ADD A BLOCK → CALLOUT, and type in it.
3. Tap the "i" to make it a tip or a warning, then UNDO.
4. EXPORT, then IMPORT the zip.

## What is left
- **Documents:** comments on words and text colours are not built yet. Strike and highlight do not work inside table cells, which keep
  bold, italic and underline.
- **Workspace:** toggles (blocks that fold away) and a highlighter key are not built yet, and Ghosty does not yet use callouts through
  his workspace tool.
- **Spreadsheets:** cells coloured by a rule (conditional colour) are not built yet.
- **Presentations:** REPLACE does not keep the capitals of the word it replaces.
- **Photo:** what the brain does to a photo still comes back through the Lens's PHOTO TOOLS, not as marked changes inside the editor
  that he accepts or rejects.
- **Video:** the fade's length is fixed, with no slider yet. The brain's video tool cannot yet suggest a duplicate or a fade; that
  tool lives in the brain's own files, outside this lane.
