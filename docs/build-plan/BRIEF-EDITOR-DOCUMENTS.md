# BRIEF: THE FULL EDITORS, THE SECOND: DOCUMENTS — the core of Word

PROGRAMME-EDITORS.md section 2 (OWNER-ISSUES 127 "i want the full editors", 164 "all of this needs to be built"; STATUS section 4 holds
the queue). The first of the eight, the 3-D engine, has its pass 1 on builder/engine3d. This is the second, the mid tier, first
serious version. Read STANDARD.md, PROGRAMME-EDITORS.md (its rules for every workspace), then this, then BRIEF-SHELL-2.md for the shape.

## His words
"no i don't agree with you, i want the full editors" (4 Nov, OWNER-ISSUES 127: documents are one of the eight). "all of this needs to
be built with the 40% we have left, it has to happen" (8 Nov, 164). The product it stands in for is Word's core: write a letter, a CV,
an essay or a report with headings, lists, bold, a photo and a table; lay the page out; hand it on as a PDF or a .docx that opens
unchanged elsewhere; open someone's .docx and change it.

## What is on main today (the starting point, found in the code)
- `apps/web/src/docs/` (BRIEF-REST-E part 2): the model (`model.ts`: a title and blocks of runs: headings, paragraphs, lists, a quote,
  a right-hand line; bold and italic; History for undo; find and replace; the brain's edits as suggestions; translation), the store
  (`store.ts`: forty documents in `localStorage`, 2 MB), the editor (`sheet.ts`: a contenteditable per block, HEADING, B, I, lists,
  UNDO, REDO, FIND, CONTENTS, READ IT TO ME), the PDF layout (`layout.ts`, `convert/pdfwrite.ts`: standard fonts, A4, "1 of 3"), our
  own Word writer (`docx.ts`), a Word READER that is mammoth's HTML, and `ask.ts` (the brain through the ordinary chat).
- Reached from MAKE → DOCUMENTS (`features/docs`, one panel, `docsParts()`), from "my documents" in the chat, from the reply card
  "Your letter, laid out" (`offerDocument`), and from the Stage: SHOW ME's `document` kind (`show/decide.ts docShow`, "YOUR WORDS, LAID
  OUT" / "EDIT AND SAVE AS PDF OR WORD") whose OPEN key runs `open_docs` with the reply as a `doc` (`show/stage.ts open`). All of them
  mount the one `docsParts()`, so one editor serves the room and the Stage's OPEN.
- What is missing for "the core of Word": underline, links, images, tables, page layout (size, margins, orientation, header, footer,
  page numbers), alignment, a word count, autosave said, a .docx reader that keeps its tables, links and pictures, a Word file with
  pictures and tables, Ghosty writing into the page at the cursor, and a store that holds pictures.

## The engine and its licence
The programme names ProseMirror (MIT) for the model, `docx` (MIT) to write and mammoth (BSD) to read. `apps/*/package.json` is
protected and no package may be added, and a first serious version is smaller than a schema engine, so: the app's own block model,
extended (below), and the app's own Word files: a .docx is a zip of XML, and `convert/zip.ts` (`zipStore`, `unzipSync` with the
app's own inflate) is already in the bundle. The writer (`docs/docx.ts`) and a NEW reader (`docs/docxread.ts`, the browser's own
`DOMParser`) are ours: no new licence enters the bundle. Mammoth (already vendored for the Convert and Library readers) stays as the
fall-back when our reader finds no words. The PDF is the app's own writer with the standard fonts (`convert/pdfwrite.ts`), a real PDF
of words, never a screenshot; a document in a script the standard fonts lack is drawn page by page by the phone (`docs/read.ts`).
Not in this version, said in the app: ProseMirror-grade collaborative schema, footnotes, columns, track changes beyond the brain's
suggestions, comments, a contents page, fonts beyond the document's serif and sans, a .docx written with its pictures inline in the
text line (a picture is its own paragraph).

## The first version's exact feature list (each a 44 pt key on a 440 × 956 phone, in all three worlds)
1. WRITE: paragraph, TITLE of the document, three heading levels, a quotation, bullet and numbered lists, alignment (left, centre,
   right, justified), bold, italic, UNDERLINE, LINK (an address typed in a field; REMOVE LINK), line breaks; the keyboard's Enter splits
   a block, Backspace at the start joins it.
2. INSERT: a PHOTO from his own photos (the phone's picker; shrunk to 1,280 px as a JPEG, kept in the phone's database, never sent),
   its size (SMALLER, LARGER) and its description (alt text); a TABLE (rows and columns picked, 1–12 by 1–8) with a header row, ADD
   and DELETE ROW and COLUMN, DELETE TABLE; a PAGE BREAK.
3. PAGE: size (A4, Letter), margins (normal 2.5 cm, narrow 1.3 cm, wide 3.8 cm), portrait or landscape, page numbers on or off, a
   header line and a footer line. The PDF and the Word file take it; the count of pages is said.
4. FIND AND REPLACE (case, whole word, in paragraphs and in table cells, undoable), CONTENTS, READ IT TO ME, WORD COUNT (words,
   characters, pages, minutes to read) live under the title, UNDO and REDO (sixty deep).
5. AUTOSAVE: every change kept on the phone as it is made (text in the documents' list, pictures in the phone's database), at the
   latest 450 ms after a key; leaving the screen or the app flushes the last words; "KEPT ON THIS PHONE 14:32" said under the title.
6. MY DOCUMENTS: listed newest first with kind, date and length; a tap reopens where it was; REMOVE; a new one from NEW (a blank
   page), from a Word or other file, from the chat's reply, from the Stage's OPEN.
7. EXPORT: PDF (words, tables drawn with rules, pictures, header, footer, page numbers, the page set), WORD (.docx, with real
   styles, lists, links, pictures, tables, the page and its footer), MARKDOWN, HTML. SAVE or SHARE.
8. IMPORT: .docx read by our own reader (headings by style, lists by numbering, bold, italic, underline, links, pictures, tables,
   alignment, page size and margins, footer text and page numbers), PDF, EPUB, HTML, Markdown, text (existing).
9. GHOSTY IN IT: "ASK GHOSTY" with a box: WRITE INTO IT (the words are laid out after the paragraph he is in, undoable), REWRITE
   THIS PARAGRAPH and the existing edits (shorter, plainer, fix) as suggestions he accepts or rejects one by one, translation, letters.
   All through the ordinary chat with the document's words as the turn's data (`docs/ask.ts askBrain`); nothing new in the prompt, no
   new tool. With the cloud off-limits the phone's own brain answers, said. If a tool of its own is wanted so Ghosty can edit while
   he talks (a `document` tool), it is a protected-file change and is written in the report under NEEDS HIS WORD.

## The benchmark (Word's core workflow, timed on the preview and said in the PR)
A two-page letter with a table and a footer: (1) NEW; (2) type the title, an address block and four paragraphs; (3) make the heading,
bold one phrase, underline one, add a link; (4) INSERT a 3 × 3 table and fill it; (5) INSERT a photo; (6) PAGE: Letter, footer
"Page n", numbers on; (7) FIND and replace a name; (8) export WORD and PDF; (9) open the .docx in an independent parser (mammoth in the
spec; Word or Pages on his phone) and see the same words, the table, the link, the picture; (10) import that .docx back and see the
same page. Target: under five minutes by hand on a phone; the spec runs the same steps in seconds and `docs.spec.mjs` prints each.

## The catalogue entries
The catalogue is generated from the screens' source (BRIEF-EVERYTHING): DOCUMENTS stays one screen with one panel and one section, so
nothing in `catalogue.ts` is missing. The editor's own pills (WRITE, INSERT, PAGE) are controls inside the panel, not screens. No new
chat phrase is added (the phrases are the catalogue's), so no entry is new; the existing "Documents" card and its three try-its stand.

## The spec: tests/docs.spec.mjs (its one word `docs` at the END of the `all=` list in check.yml, nothing else in that file)
Opens MAKE → Documents; NEW; writes; formats every mark; headings, lists, alignment; link; photo (a generated JPEG); table with
cells; page setup; find and replace; word count; undo and redo; autosave (reload, reopen from the list, same words and picture);
export WORD and read it with mammoth (an independent parser: headings, bold, the table, the link) and check its XML is well formed;
export PDF and check its text with pdf.js's reader path; import a .docx made independently of our writer (a hand-built file with a
table, a link, a picture, a footer) and check what the reader found; Ghosty writes into it (the chat stubbed) and the words land
after the paragraph and undo removes them; OPEN from the Stage (a "write a letter" reply) opens the same editor; every key 44 pt and
nothing sideways at 440 and 390 in Glass, the Scan and a third world; a screenshot of each. Existing: reste.spec's DOCUMENTS
section runs unchanged.

## The sizes (measured on the preview; the numbers are in the report)
Bundle growth of `app.js` and the chunk of docs; a .docx of the benchmark letter; a PDF of it; a photo shrunk to 1,280 px; the open time of
the editor (under 300 ms the shell's habit); the keystroke-to-saved time.

## What must not change
The prompt guard; the kernel and protected files; no package, no key, no network beyond the brain; nothing of his leaves the phone but
to his own brain; never a model name; reste.spec's DOCUMENTS section, hubcards, deck, nav; THE RATCHET (hex 506, rgba 1,016, radius 470,
total 1,992): the editor's drawing is written in THE SYSTEM's section in tokens, and the old document rules outside it move in, so the
count goes down.

## The owner's phone check
MAKE → Documents → NEW. Write a letter with a heading; bold, underline, a link; ADD a photo from your photos; INSERT a table, fill it;
PAGE: Letter, a footer; export WORD and open it in Pages or Word: same page; export PDF and open it. OPEN a Word file from Files and
change it. Say "write a letter to my landlord about the damp": the card, OPEN, the same editor from the Stage. Close the app, reopen
Documents: the letter is in the list.

## The design picks he may change
The page is drawn in the world's own plate and ink (not a white paper); the pills are WRITE / INSERT / PAGE / LINK; Letter and A4 only;
the photo is flattened to JPEG; a picture is a paragraph of its own.
