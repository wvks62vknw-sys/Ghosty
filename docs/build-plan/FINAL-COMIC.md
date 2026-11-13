# FINAL ROUND — COMIC (lane `lane-comic`)

Your words: "things like Comic should be able to import actual real comics or like have them separately and create actual
full fledged comics which can actually entertain someone".

## What was wrong
- "Comic" was one small page inside CREATIVE: a four-panel strip of stick figures with a caption under each panel. It had no
  speech balloons, no story and no pages, and you couldn't edit it beyond its four captions. It saved as one PNG.
- There was no way to read a real comic. You couldn't open your own CBZ or PDF, there was no reader, and there was no free
  library.

## What I made: COMIC, an app of its own
It sits in MAKE, under the EDITORS card as a pill called **COMIC**. It has three pages.

**SHELF: your comics, kept on this phone**
- **IMPORT A COMIC** takes a CBZ, a PDF, a picture or several pictures. **IMPORT A FOLDER** takes a folder of page pictures.
- A **CBR** file is packed with RAR, a closed format that no phone browser can open. Ghosty says so in plain words: save it as
  a CBZ (any comic app or 7-Zip does it in one step) and import that. Many .cbr files are really zips inside, and those are read
  as normal. CB7 and CBT files are explained the same way.
- Each comic shows its cover, where it came from (your file, public domain, or made by you), its pages and its size, with READ
  and REMOVE. Removing asks you to tap again to confirm.

**The reader** (full screen)
- Turn pages with the keys, a swipe, a tap on the left or right side, the arrow keys or the page slider.
- **GUIDED** shows one panel at a time, each filling the screen, in reading order. On your own comics the panels are found on
  each page automatically; on comics made here the app already knows them.
- Zoom with + and −, a pinch or a double tap, and drag to look around.
- On a wide screen (a tablet or a computer) you see two pages side by side, with the cover on its own.
- It remembers where you stopped, down to the panel, and opens there next time. ✕ or Escape closes it.

**LIBRARY: free public-domain comics**
- These come from the Internet Archive's comics whose licence is marked public domain (about 2,200 of them). The search is
  open, needs no key and costs nothing. Search by word, such as "western", "space" or "horror".
- The first tap only checks the file and tells you its size (for example "Get · 1.6 MB"). The second tap downloads it. On
  mobile data it waits and says so. It picks a CBZ if there is one, otherwise the PDF, and never a CBR. It then sits on your
  shelf with its credit: "Public domain, from the Internet Archive (archive.org/details/…), first published 1956."
- I did not use the Digital Comic Museum. It has no open listing a page can read, and its downloads need an account.

**MAKE: a whole comic from an idea**
- Type or say an idea, such as "a cat who wants to be an astronaut". You get a **cover** (title, issue number, the hero large,
  and the tagline) and **four pages** of 3, 4, 4 and 3 panels.
- The cast is a hero, a friend and a rival. Each has a name and a look (species, colours, hair, hat, glasses) that stays the
  same in every panel. The hero can be a person, cat, dog, robot, ghost, alien, bear or rabbit, read from your idea. You can
  name them yourself or let Ghosty pick.
- The story has a beginning (the want, said out loud, and a "plan" that isn't one), a turn (two tries that go wrong, the low
  point, the rival gloating, and the friend's odd idea) and an end (it works, the odd way). It ends on a callback: the rival
  falls into the same "…Who put that there?" joke from page 2. The jokes come from setups that pay off later.
- The drawing is proper comic work: real panel grids with gutters; speech balloons with tails pointing at whoever speaks;
  thought clouds; spiky shout balloons; dashed whisper balloons; yellow caption boxes; big lettered sound effects; and a scene
  for each place and time of day. The balloons are laid out first and the characters stand under them, so no balloon covers a
  face.
- **Change anything.** Tap a panel to change its caption, sound effect, place, time and shot, who is in it, and each
  character's expression, pose, position and direction. You can edit, add, reorder or remove any line, and change who says it
  and what kind of balloon it is. You can also add or remove panels, change a page's grid, add or remove pages, rename the cast
  or give a character a new look, and edit the cover's title and tagline. The full script is underneath to read.
- It is saved on the phone as you go. **READ IT** opens it in the reader. **SAVE CBZ** gives a real comic file (the page
  pictures plus ComicInfo.xml) that any comic app opens. **SAVE PDF** gives a PDF. **SHARE** sends the PDF through your phone's
  share sheet.
- The art is drawn on the phone by Ghosty's own code. **Decision:** I did not use the picture model the brain already has. It
  allows about 40 pictures a day, a comic needs 15 or more, and it can't keep a character looking the same from panel to panel.
  Drawing in code is free, works with no signal, and keeps every character consistent.

**By chat**, in many wordings and with no model needed: "make me a comic about…", "draw a comic where…", "write a comic book
about pirates", "a comic about my cat", "make a manga about a ninja", "read a comic", "my comics", "import this comic", "open my
CBZ", "public domain comics", "free comics", "find me some old western comics", "golden age comics". The Every-screen deck has
a COMIC card, the MAKE hub's EDITORS card has a COMIC pill, and CREATIVE's quick strip has a MAKE A WHOLE COMIC key.

## Checks
- Every state is said in your words: an empty shelf, reading, a file that can't be read, a CBR, saved with its size, nothing
  found, no signal, waiting for Wi-Fi.
- A new spec, **comic2**, is appended at the end of check.yml's `all=`. Its CBZ, PDF and fake CBR files are made inside the
  test, never downloaded, and the Internet Archive is answered by fixtures. It checks:
  - both phone widths (440 and 390);
  - a wide screen for the two-page view;
  - BODY 21 and all seven looks (scan, map, eye, orbit, grown, ink, glass);
  - that every key is 44 pt, nothing sticks out sideways, and no words are cut.
- A brain-suite test (`apps/edge/test/comic.test.mjs`, run from finding.test.mjs) covers:
  - the writer;
  - the panel grids (no overlaps);
  - the chat wordings;
  - the panel finder;
  - the file sniffing;
  - the library query (public domain only, no key).
- The STATES ratchet gained four rows: comic.shelf, comic.maker, comic.reader and comic.library.

## How to try it on your phone
1. MAKE → EDITORS → **COMIC**, or say "make me a comic about a dog who wants to win the talent show".
2. Tap a panel and change a line, then go to the last page to see the ending. Tap **SAVE PDF** or **SHARE**.
3. Go to **LIBRARY** and search "western". Tap the size key, then GET on Wi-Fi, then READ, then **GUIDED**.
4. Go to **SHELF** → **IMPORT A COMIC** and pick a CBZ or PDF of your own.

## What is left
- CBR (RAR) files can't be opened in a browser without bundling a RAR unpacker, which I didn't add. Ghosty says so and tells you
  how to convert them.
- The story writer works without a model and uses one well-tested shape (want, two failures, turn, payoff, callback), with
  variety in names, places, gags and the odd idea. A brain-written script for any genre would be the next step. Today the
  brain's own creative tool still makes the quick four-panel strip if a request reaches it, but on the phone your comic wording
  is caught first and makes the full comic.
- Manga right-to-left reading in the guided view is in the panel finder but not yet a switch in the reader.
