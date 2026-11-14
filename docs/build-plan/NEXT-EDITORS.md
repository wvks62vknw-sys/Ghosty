# NEXT ROUND: THE EDITORS (14 November 2026)

The editors are documents, spreadsheets, presentations, the workspace, photo and video. This lane also led **"Studio-grade tools in every
editor"**. Four builders worked on it in parallel:

- **paper:** documents, scanning and PDFs;
- **grid:** spreadsheets and presentations;
- **media:** photo and video;
- **pages:** the workspace, plus the links into other rooms.

Each builder has its own spec words, so no single spec runs long on CI:

| Spec word | What it proves |
| --- | --- |
| editorspaper | documents, scanning and PDFs |
| editorsgrid | builds, rules and summaries |
| editorsgrid2 | the TV, the money sheet and the looks |
| editorsmedia | photo and video |
| editorspages | voice notes, blocks, deadlines and flashcards |
| editorspages2 | forms, mind maps and compare |

Each of these proves its tools end to end, with undo, a round trip through the file where there is one, and every state in his words. Each
also runs every new screen in all seven worlds at 440 × 956, in The Scan at 390 × 844, and at BODY 21.

The final round's lane spec was split in two (`editorslane` and `editorslane2`), because it had grown close to CI's 480-second limit.
Every part runs on one shared kit, `tests/editorsharness.mjs`.

## What was built

### 1. This round's pick
**Scan paper into a document** (editors.s3)
- In the scanner's DOCUMENT part, after READ ALL:
  - **INTO A DOCUMENT** opens the page in DOCUMENTS, ready to edit. The big heading becomes the title, a letter's address stays on the
    right, and paragraphs and lists come through.
  - **RECEIPT TO SPREADSHEET** shows the date, shop and total for him to check. ADD ROW puts them in a "Receipts" spreadsheet, and UNDO
    takes the row out.
- **Try it:** DOCUMENTS → SCAN A PAGE, or say "scan this letter into a document" or "scan a receipt into my spreadsheet".
- **Limits:** it reads English only, and the receipt is a best guess that he checks.

### 3. What was half done is finished
**Slide animations carried through PowerPoint** (editors.u4)
- Each build is saved as PowerPoint's own animation, and comes back as a build when a PowerPoint file is opened:
  - APPEARS becomes Appear;
  - FADES IN becomes Fade;
  - RISES IN becomes Fly In.
- The new **MAGIC MOVE** transition glides anything that is on both slides. In the file it becomes PowerPoint's Morph.
- Effects PowerPoint has and Ghosty doesn't are named once, in the "what I couldn't keep" line.

**Video export length**
- The exported file ends where the timeline ends: the last picture and the last of the sound are trimmed or padded to fit.
- The real-time recorder, which CI and the phone use, now lands between about 35 ms short and 20 ms over. Before, it ran 10 to 200 ms
  long.

### 4. Soon
- **Fill in and sign PDFs** (editors.s12).
  - **What it does:** he types into a form's boxes, ticks its boxes and picks from its lists. He signs with his finger, and the signature is
    kept on the phone only if he says KEEP IT. Then SAVE PDF or SHARE, with UNDO throughout.
  - **What it can't fill:** round-button choices, digital-signature boxes and forms made with XFA. It names these.
  - **Try it:** DOCUMENTS → FILL AND SIGN A PDF.
- **Colour cells by rules** (editors.u2), on SPREADSHEETS → RULES.
  - **The rules:** more than, less than, between, equal to, contains, overdue (a date before today, London time), top or bottom N,
    duplicates, data bars and a colour scale.
  - **Behaviour:** rules are listed per sheet with EDIT and DELETE, move with rows and columns, go into Excel files and come back, and show
    in the PDF.
- **Approve Ghosty's photo changes one by one** (editors.u7).
  - **What he sees:** say "make this photo warmer and crop it to 4:5", or use the BRAIN tray (ASK GHOSTY, FIX IT, WARMER, BRIGHTER,
    CROP 4:5). Each change shows in the sliders' own words, such as "warmer +600 K" or "+0.3 exposure".
  - **What he does:** ACCEPT or REJECT each change, or ACCEPT ALL and NO THANKS. Each accepted change is one UNDO step, and nothing changes
    until he accepts.
- **Voice notes into tidy pages** (editors.s6).
  - **What it does:** Workspace → VOICE NOTE, or "take a voice note". He records, or picks a Voice Memo. It becomes a tidy page or document,
    with the actions as to-dos and his own words kept at the end.
  - **Offline:** the recording waits on the phone and is tidied when the signal comes back.

### 5. Later: these were built too
- **Comments on words in documents** (editors.u1).
  - **What it does:** COMMENT, then REPLY and RESOLVE. ASK GHOSTY answers about that one sentence, as a reply and never as an edit.
  - **In Word files:** comments go in as real Word comments and come back when the file is opened.
- **One-tap table summaries** (editors.u3).
  - **What it does:** SPREADSHEETS → SUMMARY gives totals by month or by any column, as live formulas on a new sheet that follows its table.
    A chart is one more tap away.
- **Present with a TV and the phone** (editors.u5).
  - **What it does:** PRESENT → ON A TV opens the slide in a window of its own for the TV. The phone shows this slide and the next, the notes,
    a timer, and NEXT and BACK.
- **Fold-away and synced blocks, and his own templates** (editors.u6).
  - **What it does:** TOGGLE folds lines away; SYNC shows one line on several pages; … → SAVE AS TEMPLATE keeps his own page as a template.
- **A fade-length slider and colour over time in video** (editors.u9).
  - **What it does:** a fade can be anything from 0.1 s up to its cap. KEY THE GRADE AT THE PLAYHEAD changes the colour over time, drawn the
    same in the preview and the exported file.
- **Compare two versions** (editors.u10), in the workspace.
  - **What it does:** HISTORY → COMPARE WITH NOW shows then and now side by side. BRING THIS BACK restores one part, and TAKE THIS OUT
    removes one.
- **Move whole sections by heading** (editors.u13).
  - **What it does:** ▲ and ▼ beside each heading in CONTENTS move the section with everything under it, as one undo step.
- **Clean-up and enlarging in photo** (editors.u14), without a model.
  - **What it does:** EXPORT → 2× BIGGER redraws the photo smoothly and sharpens it, up to 16.7 megapixels. DETAIL's noise reduction is the
    clean-up.
  - **Why no model:** no free enlarging model is bundled with the app, and the screen says so.
- **Forms that fill a database** (editors.s1).
  - **What it does:** FORM on any database page turns its columns into questions, and each answer becomes a new row.
- **Mail merge** (editors.s2).
  - **What it does:** {{Name}} fields in a letter are filled from a spreadsheet, giving one PDF, one Word file or a file per person. Nothing
    is sent anywhere.
- **Photo film with music** (editors.s5).
  - **What it does:** VIDEO → PROJECT → PHOTO FILM. Photos hold for whole beats with a slow zoom, and the song starts on its first beat.
  - **To make this work:** the video editor now takes still photos as clips.
- **Mind maps in the workspace** (editors.s8).
  - **What it does:** a map of 44 pt ideas. MAKE N TO-DOS turns a branch into to-dos.
- **His spending as a budget sheet** (editors.c1, with money.c4).
  - **Where:** MONEY → BUDGETS → "Open as a spreadsheet", or say "open my money as a spreadsheet".
  - **What it makes:** a fresh workbook each time, with months down and categories across, totals, budgets and a chart. MONEY itself never
    changes.
- **Flashcards from his own notes** (editors.c3).
  - **What it does:** "Term: meaning" lines, toggles and tables become cards in Learn's revision. They are shown to him before they are made.
- **Workspace deadlines on the agenda and in the brief** (editors.c4).
  - **What it does:** the Agenda has TO-DO · FROM MY WORKSPACE, late ones first, and the Brief has one WORKSPACE line. Both are read-only.
  - **Note:** PLAN has no shared list yet, so these read the workspace kept on the phone.
- **Post an edited photo with APPROVE** (editors.c6, with comic.c5).
  - **What it does:** PHOTO → EXPORT → DRAFT A POST fills in SOCIAL's post. It goes out only when he taps APPROVE.

## The specialist sweep (what was built)
- **Documents (against Pages and Word):**
  - text colour, kept in Word, the web page and the PDF;
  - a word-count goal;
  - a count of the words he has chosen;
  - MAKE A COPY;
  - a search in MY DOCUMENTS;
  - UNDO after strike, highlight or colour now takes one press, not two;
  - the bar's keys stay 44 pt.
- **Spreadsheets (against Numbers and Excel):**
  - AutoSum never writes over a full row;
  - quick sums (total, average, smallest, largest) for the chosen cells;
  - colour rules show in the PDF.
- **Presentations (against Keynote):**
  - REPLACE keeps the capitals of the word it replaces;
  - EXIT says how long the talk took, and how long each slide was up.
- **Video (against CapCut):**
  - FREEZE FRAME;
  - MOVE and GRADE follow the playhead;
  - the dead keys on an empty video's PROJECT tray now work;
  - photo clips come back when a video is reopened.

## How to try it on the phone
1. Make → EDITORS → DOCUMENTS → SCAN A PAGE, or FILL AND SIGN A PDF.
2. In a document, choose some words, then WRITE → COMMENT.
3. Make → SPREADSHEETS: try RULES, SUMMARY and Σ.
4. MONEY → BUDGETS → Open as a spreadsheet.
5. PRESENTATIONS: pick a build or MAGIC MOVE, then PRESENT → ON A TV.
6. PHOTO → BRAIN → WARMER, then ACCEPT. Or PHOTO → EXPORT → DRAFT A POST.
7. VIDEO → PROJECT → PHOTO FILM.
8. THE WORKSPACE: try VOICE NOTE, TOGGLE, SYNC, FORM, A MIND MAP, and HISTORY → COMPARE WITH NOW.

## What is left
- **Not built:** brush touch-ups on video (u8), a teleprompter (s7), the audio editor (s10), photo collages (s4), and comparing versions of
  documents.
- **Not done:**
  - The brain's three model jobs on a photo (background, sharper, erase) still replace the picture instead of arriving as marked changes.
  - Replies to a comment go into Word as lines inside the one comment, not as Word's separate threaded replies.
  - Magic Move matches parts by their role on the slide, not by their words.
  - The workspace sweep against Notion was not started.
- **The spreadsheet's 4-second open budget (sheets.spec a.)** still misses on a slow machine (4.7 s here, while other checks were
  running). The spreadsheet itself opens in under 30 ms. The time goes into the app's start-up work and the MAKE page, both outside the
  editors.
  - What I found: about 1.3–3 s of main-thread work right after boot blocks the first tap. Most of it is the 3D background's quality governor
    resizing its drawing surface under software graphics, and shaders compiling.
  - I tried caching the canvas size to avoid a page layout in every frame. It did not help enough, so I put it back.
  - The CI lane's "screens rest when still" change is aimed at the same freeze.
