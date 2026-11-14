# NEXT ROUND: COMIC

## What I built

**1. Ghosty writes, the app draws (comic.u2)**
- MAKE asks my brain to write the script for your exact idea, then draws it here with the same cast, so every character looks
  the same in every panel.
- Pick **Who writes it**: Ghosty, or the phone. With no signal, or if my brain doesn't answer, the phone writes it and says so.
- **Kind of story** asks for a mystery, a space adventure, a heist, something spooky, a sports final, a romance or a superhero
  story.

**3. Real CBR comics open (the half-done item, and comic.u14)**
- A CBR (RAR), and also CB7 and CBT, opens with a free archive reader: libarchive, a widely used free library, built to run in
  the browser and served from your own site. It needed no change to the app's security rules.
- It comes only when you tap **GET THE RAR READER**, with its size said (1.1 MB). On mobile data it waits for Wi-Fi.
- After that, your browser keeps it.

**4. Soon**
- **Undo and redo** (comic.u4). A burst of typing in one box counts as one step. Turning pages is never a change.
- **Drag with a finger** (comic.u5). Tap a panel, then drag its balloons, its people and its sound effect. **PUT THINGS BACK**
  undoes the moves.
- **Your photo behind a panel** (comic.u7). The photo is shrunk and kept inside the comic, on this phone.
- **Your week as a comic** (comic.s3, with PLAN's plan.c5). Tap **MY WEEK AS A COMIC**, or say "make my week into a comic".
  - It reads this week, Monday to Sunday, from your agenda and the to-dos you ticked. Only titles and days are used, never
    places.
  - Ghosty writes it with you as the hero. With no signal, the phone gives each day a panel, with a line that fits it and a
    last word.

**5. Later (the best of them)**
- **Reader** (comic.u9):
  - **PAGES**: a strip of every page.
  - **BOOKMARK**: kept, and shown in the strip.
  - **NIGHT**: a warmer, dimmer page, remembered.
  - **AUTO**: turns the page every 8 or 15 seconds and stops at the end.
  - A page-turn motion, switched off when you ask for calm.
- **Shelf** (comic.u11, comic.s7):
  - **FIND**, **SORT** (newest first, by title, or last read) and **SHOW** (unread, reading, read, made by me, my files,
    public domain).
  - Read and unread marks on every comic.
  - A reading log: pages read and time this month, and comics finished.
- **Saving** (comic.u13, comic.s11):
  - **PHONE SCROLL**: the whole comic as one long picture.
  - **PANELS**: every panel as its own picture.
  - **BOOKLET**: a PDF whose pages print on both sides, fold and staple.
- **Other things to make** (comic.s5, s6, s2):
  - a one-panel joke;
  - a greeting card of three panels (birthday or thank you);
  - a children's picture book, one picture per page.
  - Ghosty writes these too. If the script comes back the wrong shape, it is trimmed to fit.
- **Translate its words** (comic.s12). Every balloon and caption goes into the language you pick, for family abroad. UNDO
  puts the old words back.
- **A cartoon of you** (comic.u8):
  - Pick skin, hair, hairstyle, top, hat, glasses and height by hand. No photo or face is ever read.
  - **KEEP THIS LOOK**, then **CAST SOMEONE I SAVED** in any comic. It is for you and the people you introduce, kept on this
    phone.
- **Issue 2** (comic.u3). The next issue has the same cast and a new adventure, numbered on its cover.
- **Read aloud** (comic.u12, with CI's ci.c4):
  - A comic you made is read panel by panel in the guided view.
  - Captions use a narrator's voice. Each character speaks in their own phone voice: pick it in THE CAST, or one is chosen for
    them.
- **"Make it a comic"** (comic.c6). What you're looking at, or what I just said, becomes the comic.

I also fixed four things the review team found:
- the week comic could land on a page that had been put away;
- the week was read from today rather than from Monday;
- turning a page lit up UNDO;
- the drag mode stayed on after the chosen panel was cleared.

## How to try it on your phone
1. MAKE → EDITORS → **COMIC** → **Make**, and type an idea. Leave **Who writes it** on Ghosty and tap **MAKE MY COMIC**.
2. Tap a panel, then drag a balloon. Try **UNDO**, **MY PHOTO BEHIND IT**, then **ISSUE 2**.
3. Tap **MY WEEK AS A COMIC**, or say "make my week into a comic".
4. **Shelf** → **IMPORT A COMIC** → pick a .cbr. Tap **GET THE RAR READER** (on Wi-Fi). Then **READ**, and try **PAGES**,
   **BOOKMARK**, **NIGHT**, **AUTO** and **READ ALOUD** (on one you made).
5. In MAKE, try **What to make: A greeting card**, then save it as a **BOOKLET**.

## Checks
- **comic2** (the reading, the library and the making, at both phone widths, BODY 21 and all seven looks) now also covers:
  - a real RAR 5 file written in the test;
  - undo and redo, dragging, a photo behind a panel;
  - Ghosty's script, the phone's script and the no-signal fallback.
- **comic3** (new) covers the week comic, the reader's strip, bookmark, night tint, auto turns and read-aloud, the shelf's
  search, sort, marks and log, the three new exports, translation, keeping a look, the joke, card and picture book, Issue 2 and
  "make it a comic".
- comic3 keeps its own agenda and to-do list, because the one to-do list now lives in the brain.
- Both specs passed in my container at both widths. On the last run before the 06:00 stop, comic2 took about 200 s.
- The brain's comic test reads the script, the week, the shapes and the archive reader's words. The whole brain suite passes.

## Left for next time (from my file, in its order)
- **More kinds of story written by the phone itself** (comic.u1). Ghosty already writes any genre; the phone's own writer still
  has one story shape.
- **More poses, props, vehicles, weather and speed lines** (comic.u6).
- **Better panel finding**: dark pages, art with no borders, fixing a panel by hand (comic.u10).
- **More free old newspaper strips** in the library (comic.s8).
- **Classic stories as comics** (comic.s9).
- **Comic lessons with a quiz in LEARN** (comic.c2).
- **A storyboard sent to VIDEO** (comic.c3).
- **Game Studio scenes as comics** (comic.c4).
- **Reading aloud for imported comics.** Their words are pictures, so I would need to read the text on the page first.

## Specialist sweep: compared with Comic Life, Clip Studio Paint, Webtoon, ComiXology and Panels
**Reader** (against ComiXology's guided view and Panels):
- Has now: guided panel view, two-page spreads, manga right to left, a page strip, bookmarks, a night tint, auto-advance, a
  reading log, read marks, search and sort.
- Still missing: collections you name yourself, and syncing your place to other devices. Everything stays on this phone, by
  your rules.

**Maker** (against Comic Life):
- Has now: templates for a comic, a joke, a card and a picture book; real panel grids; balloons of four kinds, with tails;
  captions; sound effects; dragging; photo backgrounds; undo and redo; CBZ, PDF, phone-scroll, panel-picture and booklet
  exports.
- Still missing: drawing freehand on a panel (Clip Studio's speciality), and balloon styles beyond the four kinds.

**Library** (against Webtoon and ComiXology's free shelves):
- Public-domain and openly licensed comics only, by your rules, so there is no paid catalogue.

**Rough edges fixed:**
- Open sections in the editor now stay open when it redraws.
- Every key is 44 pt, and every state is said in plain words.
