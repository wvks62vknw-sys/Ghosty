# THE APPS ROUND: BOOT, the flagship: FILES

Lane BOOT, branch `claude/new-session-4erjve-lane-boot`, 14 November 2026. Matched against Apple Files, Google Drive and Dropbox.

## What was wrong
Every app kept its things in its own corner:
- Documents, Spreadsheets and Presentations each had their own list.
- Photo, Video, Game Studio and Comic each had their own shelf.
- A file from your phone had nowhere to live except inside one of those apps.

There was no one place to find something, see what takes the space, or get something back after deleting it.

## What I made: Me → FILES
One place for everything Ghosty keeps. All of it stays on this phone.

- **Browse:**
  - every document, spreadsheet, presentation, photo, video project, game and comic, from the app that made it, plus the files you
    bring in;
  - sorted newest first, or by name or size;
  - a chip for each kind (Documents, Spreadsheets, Presentations, Photos, Videos, Games, Comics, Your files) and one for each of your
    folders, with NEW FOLDER and REMOVE FOLDER;
  - a star on every row.
- **Search everything:** by name, by tag, and by the words inside documents, every cell of a spreadsheet, every slide and every text
  file. The line around the match shows under the name. When nothing matches, it says so plainly.
- **A card for anything you tap:**
  - a preview: its words, its picture, or a zip's list of files with EXTRACT ALL;
  - OPEN IN its app (a document, sheet or deck opens straight to itself);
  - SHARE through the iPhone Share sheet, in the leaders' formats: a document as Word (.docx), a sheet as Excel (.xlsx), a deck as
    PowerPoint (.pptx), a photo as its untouched original, a video project as its zip;
  - RENAME and DUPLICATE (changed in the app's own list, so the app shows it too);
  - MOVE to a folder;
  - TAGS;
  - DELETE.
- **Import:** IMPORT brings files in from the phone's Files app, kept untouched. A zip opens to the files inside it.
- **Select several:** SELECT, then ZIP (one zip of them all, each in its own format) or DELETE.
- **Recents and Favourites:** what you changed or opened last, and everything you starred.
- **Recently deleted:**
  - every delete waits here for 30 days, kept whole, so RESTORE puts it back exactly, tags and folder too;
  - each delete also shows an UNDO bar straight away;
  - DELETE NOW and EMPTY RECENTLY DELETED ask first.
- **Storage:** the total, each kind's space as a bar, how much the phone lets Ghosty keep, and the biggest things first, so you can
  clear them.
- **Its front door:**
  - a Me hub card that says how many things and how much space;
  - a row on the Me sheet;
  - Every screen and the jump bar;
  - the catalogue's entry;
  - "open files", "my files", "file manager" or "files app" by voice or chat;
  - a WHAT'S NEW line.

## How to try it on your phone
1. Me → Files. Everything you have made in the editors is already there.
2. Type a word that is inside one of your documents into Search: it finds the document and shows the line.
3. Tap a document. Try SHARE (it offers Word format), TAGS, MOVE, then DELETE and UNDO.
4. Tap IMPORT, pick a few files or a zip from Files, and search inside a text file.
5. Deleted → RESTORE. Storage → the biggest first.

## The checks
- `tests/files.spec.mjs` (its word at the end of check.yml's `all=`) checks all of the above at 440 × 956 and 390 × 844:
  - browse;
  - search by name, by tag and inside, and the empty search's words;
  - the kind chips;
  - the star, Favourites and Recents;
  - the card's keys at 44 pt and its preview;
  - RENAME, TAGS, MOVE and DUPLICATE in the app's own store;
  - DELETE with UNDO, and RESTORE from Recently deleted;
  - IMPORT of a text file and a zip;
  - ZIP of two things, holding a .docx and a .xlsx;
  - STORAGE;
  - nothing sideways and every key 44 pt in every section.
- The brain tests that count the screens now say six screens under Me and 57 in all (finding.test), as strictly as before. tabs.spec
  and tabs2.spec say the same.

## What is left
- **Rename, Tags, Move and New folder use the phone's own small text box.** They will move onto the App Kit's sheet once CONSISTENCY's
  kit lands.
- **Photo, Video, Game Studio and Comic things are listed, sized, starred, tagged, filed and shared, but deleted in their own app.**
  Each of those apps already has its own way back, and Files does not duplicate it.
- **Every new app saves into Files** automatically only where its store is one of the eight above. An app that adds a new store needs
  one line in `features/files/sources.ts`.
- **Version history per file** stays in each editor (Documents and the Workspace keep versions); Files does not show it yet.
