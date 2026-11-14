# THE APPS ROUND — LENS: Photos

The Lens lane's report for the apps round (brief: `APPS-ROUND.md`; task: `apps/lens.md`). The flagship is **Photos**: your photos and videos in one private library on this phone, behind the photo editor.

## How to try it

- **Open it:** PHOTO → **MY LIBRARY** (on the editor's shelf). You can also find "Photos" in the jump bar, or say "open my photo library" or "show my albums". From chat or a card, `open_photos` opens it on a view or with a search already typed.
- **The first time:** it opens with sample photos drawn on the phone and labelled as samples, so the screen is never empty. **REMOVE SAMPLES** takes them all away, and they don't come back.
- **Add your own:** **ADD PHOTOS** opens your phone's photo picker. Photos and videos are kept exactly as they came, and the line at the top shows how many there are and how much space they use.

## What it does

| Part | What you get |
|---|---|
| **Library** | Every photo and video by month, newest first. Videos show their length and favourites a heart. Tap a photo to open it full screen. **SELECT** lets you favourite, add to an album, share, hide or delete several at once. |
| **Full screen** | Swipe, use ‹ ›, or use a keyboard's arrows to move through photos; Escape closes. The keys are **FAVOURITE**, **EDIT** (opens the photo in PHOTO), **ALBUM**, **WHO'S IN IT**, **SHARE** (the phone's Share sheet), **HIDE**, **DELETE** (with UNDO) and **INFO**. INFO shows when it was taken, its size, what the namer saw in it, and where it was taken if the camera recorded that. The place is shown to you only and is never sent. |
| **Albums** | Favourites; your own albums (new, rename, delete; the photos stay in your library). Videos. **Duplicates**: the same moment kept twice, or shot again within two hours, with the best shot first (the sharpest, then the biggest); **KEEP THE BEST** moves the copies to Recently deleted, with UNDO. **People**. **Places**. **Hidden**. **Recently deleted**: each photo waits 30 days and shows the days left; **RECOVER**, **DELETE FOR GOOD** or **EMPTY**. |
| **People** | Only you and the people you introduced in the Lens (FACES), by the names you gave them. **WHO'S IN IT** on a photo lets you tick who is in it, and search then finds them by name. Anyone else is only ever "a person", and nobody is looked up. |
| **Places** | Where your photos were taken, read from the photos' own data. Photos within about 10 km of each other are grouped, and each group is named by its numbers ("51.5° N, 0.1° W"). Nothing is looked up or sent. |
| **Search** | All on the phone. By what's in a photo ("dog on a beach"): each photo is named by the Lens's on-phone namer. **NAME MY PHOTOS** uses it if it's already here; otherwise **GET THE NAMER · 42 MB** downloads it on your tap, only on Wi-Fi, with the size shown. By the words in a photo: **READ THE WORDS IN MY PHOTOS** reads each one with the Lens's own text reader, on the phone. By date ("last summer", "March 2025", "yesterday"), by kind ("videos", "favourites"), and by file, album or person name. The chips offer the names that come up most. |
| **For You** | **On this day**: photos from this date in earlier years. **Memories**: a day, or a trip of several days, with four photos or more. **PLAY** shows it as a short film, each photo slowly drifting, with a soft score made on the phone. It plays only when you tap. |
| **MORE** | **Settings**, with good defaults kept on the phone. "Name new photos on this phone" is on, but only when the namer is already here; it never downloads anything by itself. "Read words in new photos" is off, because it takes a few seconds a photo. **Storage**: how much the library keeps, and how much the phone allows. A short **Help**. **ASK GHOSTY** puts a line about your library in the ask box for you to finish. |

Every change has UNDO, every state is said in plain words (loading shows a skeleton grid), every key is at least 44 pt, and nothing scrolls sideways. The page has one scroll area, and the ADD / SELECT / MORE bar stays above the house, in thumb reach. Nothing in the library leaves the phone.

## His rules, kept

- **Faces:** faces in your photos are never scanned. The Lens's face finder only looks through the live camera, never at a picture; that is a deliberate guard, and I kept it. So People is built from what you say (WHO'S IN IT), only for people you introduced.
- **Location stays on the phone:** where a photo was taken is never sent to the brain or to a map server. Places is drawn from the numbers alone, because a tiled map would send each place to a tile server.
- **Downloads:** the namer comes only on your tap, on Wi-Fi, with its size shown. The text reader is the Lens's own, served from this site.

## How it is checked

- **`tests/photos.spec.mjs`** (at 440 × 956 and 390 × 844; its word is at the end of check.yml's `all=`) covers:
  - the first run with its samples, the storage line, and MORE's defaults with a setting kept;
  - a photo added through the picker;
  - in the viewer: the arrow keys, FAVOURITE (it then shows in Albums), and DELETE with UNDO;
  - Recently deleted showing 30 days, then RECOVER;
  - WHO'S IN IT with nobody introduced;
  - search: "dog on a beach" found, "videos" said not found, and the picked photo's words read;
  - two photos into a new album, and Duplicates' KEEP THE BEST undone;
  - On this day, and a memory that plays;
  - Places with none yet;
  - PHOTO's MY LIBRARY, and `open_photos` with a search;
  - 44 pt keys, nothing sideways, and no page errors.
- **`apps/edge/test/lens-one.test.mjs`** covers the pure part:
  - the date, camera and GPS read from a hand-built JPEG (north, south, east and west), and a broken file read as nothing;
  - fingerprints, near-duplicates and the best shot; alike photos hours apart are two moments, not a duplicate;
  - search words, plurals, months, seasons, years, "yesterday", kinds and favourites;
  - the months, the 30-day bin, On this day, memories, Places, and the storage words.
- **The screen's registration:**
  - `finding.test`: Photos is one of 60 screens, inside PHOTO.
  - The STATES ratchet: library 4 states, For You 1, Search 1.
  - The catalogue: its screen words.
  - `meanings.ts`: its everyday names. The editor keeps "my photos".
  - The consistency spec: names and dead keys pass on every screen.
- **The full brain suite** passed once at 2,385 of 2,385, before the last merges.

## Integration fixes made on the way

- **A stray `=======` in styles.css:** another lane's merge left this marker on the apps branch, which failed the ratchet's conflict-marker test. I removed the line.
- **A broken comment in styles.css:** a merge on the apps branch dropped the `/* ====` line before the app library importer's styles (DATA lane), so its words were read as a selector. That failed knowledge.test and lost the first `.al-imp` rule. I put the line back as the DATA lane wrote it.
- **Still red, not this lane's:** the web and edge typechecks fail in `packages/shared/src/applib/catalogue/learn.ts` (5 errors) and `world.ts` (1), as they arrive on the apps branch. I left them for that lane and told the orchestrator.

## Decisions

- **Inside PHOTO, not a new room:** Photos is a screen inside PHOTO (as Security sits inside Settings and Journal inside Memory). It's the library behind the editor, as the brief says, and that kept the hubs and room numbering untouched while fifteen lanes added apps at once.
- **The App Kit, in part:** the kit (CONSISTENCY) is built around list items kept in localStorage. A photo library keeps originals as files in IndexedDB and shows a grid, so Photos uses its own frame, but follows the kit's rules:
  - one scroll area;
  - keys at the bottom in thumb reach;
  - notices small, in one place;
  - every state said;
  - undo for every change;
  - deletes into Recently deleted;
  - search, settings, help and the Share sheet.

  Every class is prefixed `phx-` and every colour is a design token. Moving it fully onto the kit's builders is listed below.
- **Editor wordings kept:** "open my photos" still opens the photo editor, as the voice lane's meanings test pins it. Photos answers to "my photo library", "my albums" and "photo albums".

## What's left

- **From the flagship's own description:**
  - the editor's AI masks (sky, background, people);
  - a live histogram;
  - on-phone denoise and super resolution fetched on his tap.
- **Must-haves not done:**
  - **The Share sheet:** photos shared to Ghosty from another app still go to the Library's reader (the learn lane's path). Offering "keep in Photos" there needs that lane's agreement.
  - **One tap into Design or Photo Book:** neither exists yet.
  - **A map:** the on-phone Places groups stand in for it. A drawn map with no tiles from the network would complete it.
- **The standard's items not done:**
  - Photos' contents in Ghosty's global search: the jump bar finds screens and commands only, and has no way for an app to offer its contents;
  - a Home card, and a line in the morning Brief;
  - full use of the App Kit's builders, once it can hold a grid of files;
  - version history: the originals are never changed, and edits live in PHOTO.
- **Section 2, the other apps against their leaders, not started:**
  - Document scanner: searchable PDFs, page shapes, filters, a page grid, better edges;
  - Maths: handwriting, notation, more kinds of problem, methods, a graph;
  - Code reader: a history, batches, short links checked, styled codes, print files;
  - Measure and Sound: live measuring, outlines, a dB meter, a spectrogram.
