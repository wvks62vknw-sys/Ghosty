# FINAL ROUND · THE LENS (lane-lens), 13 November 2026

## What was wrong

**The grey picture.** One style rule in `apps/web/styles.css` put `filter: grayscale(.8) brightness(.86)` on the camera's video
whenever the Lens was in its one view (the view it always opens on), and laid a grid of white dots over the picture at half
strength. That is why the feed looked almost black and white in every look. It was not the camera, the canvas colour space or a
grey processing frame: the Lens's text check does work on a small grey copy, but that copy is never shown. The grey filter and the
dot grid are gone. In their place is a rule that keeps the video and a held frame unfiltered, unblended and at full strength. The
new spec measures it in all seven looks: the colour on screen must match the camera's own colour.

**It only read and translated.** The one view tagged text, codes, faces and (with the eyes downloaded) things. Then it asked him to
tap a tag, or to open MORE and pick one of twelve tools. Nothing acted on what the words said, a shop barcode was only "a code",
and a plant, an animal or a landmark had no way in except digging into NAME.

## What I made

**One lens that knows its job.** Under the viewfinder there is now a stack of cards, one for each thing the frame holds, best first.
Each card has only the one or two keys that do its job. The decision is pure and tested (`apps/web/src/vision/jobs.ts`). The cards
are drawn in `apps/web/src/features/lens/cards.ts`, inside the one view (`one.ts`).

| Points it at | The Lens does |
| --- | --- |
| Words | READ ALOUD and COPY. Words in another language are translated by themselves (only the words are sent, as before), or TRANSLATE. |
| A date in the words | ADD TO AGENDA: an all-day entry on that day. |
| A phone number | CALL (the phone's dialler) and COPY. |
| An address (a UK postcode line) | ON THE MAP. |
| A link or an email address | OPEN, or WRITE. |
| A sum or an equation | Solved and shown worked, line by line ("7 × 3 = 21", "12 + 21 = 33"; "2x = 11 − 3 = 8", "x = 8 ÷ 2 = 4"; "15% of 80"). It never makes up an answer: dividing by nought, or anything that is not a sum, gives none. |
| A bill or a letter | The letter card, with the plate's REMIND ME and FILE, which are kept exactly as they were. |
| A whole page | SCAN IT FLAT, which opens SCAN's document part on the frame, and READ ALOUD. |
| A shop barcode | Looked up on Open Food Facts and its sister open databases through the brain: name, brand, size, Nutri-Score, and the credit. Only the number is sent. Free, no key. |
| A QR code | What it holds, acted on: OPEN for a link, CALL for a number, and SCAN's full card behind MORE. |
| A thing | Named on the phone, with how sure ("82% sure"); MEASURE IT (the existing measure); ASK ABOUT IT. |
| A plant or an animal | Named on the phone with how sure; WHICH SPECIES sends the picture to the free model that sees (NAME's LIVING THING card, Pl@ntNet for plants when his free key is in). |
| A landmark or a work of art | WHAT PLACE IS THIS: the free model that sees names it, and the brain's encyclopedia route gives its summary and a WIKIPEDIA key. |
| A face | Only him or someone he introduced, by the name he gave. A stranger gets "Someone I don’t know. I never identify a stranger." Faces never leave the phone. |

**Every state is said in his words.** With no eyes on the phone, the one line is the offer itself: "GET THE EYES (18 MB, ON
WI-FI)". It downloads on his tap only. Then the line says "Waking the eyes…", then "Looking…" while it looks. Other cards say:

- "Reading the words…" while it reads.
- "Nothing I know yet. Point me at words, a code, a thing, a plant, a place or a page." when the frame holds nothing it knows.
- "No signal. I still read words, codes and things on this phone; translations, products, species and places wait for a signal." with no signal.

**Keys kept to a minimum.** The bar is still four keys: START, FLIP, FREEZE (the one shutter that holds a moment) and MORE. MORE
opens the tools and acts, which is how he tells it to do something else instead.

The words work too, while the Lens is on screen. These were there before: "read that", "translate it", "measure it".

These are new, each in more than one wording:

- "solve that", "work it out" and "what's the answer" (it says the working);
- "call that number" and "ring it";
- "add that to my agenda" and "put this date in my diary";
- "show that on the map";
- "what species is that" and "what bird is this";
- "what building is that";
- "read it aloud";
- "copy that".

**Free sources only.** The phone's own eyes come first: the text check, the barcode reader, the object finder and the namer, all from
the OFFLINE EYES packs. After that the Lens uses only the brain's free, keyless routes:

- the barcode lookup (Open Food Facts, Open Beauty Facts, Open Products Facts, Open Library);
- the encyclopedia summary;
- the free model that sees.

No new keys. Nothing that costs money. The security headers are unchanged.

## Decisions I made (nobody was there to ask)

- **The bar keeps START, FLIP, FREEZE and MORE.** Four other lanes' specs press these keys (awareness, faces, photo, sound). Renaming
  them would break their checks and change their intent. The fewer keys he asked for come from the cards: each card shows only its
  own job's keys, and the twelve tiles stay folded under MORE.
- **The species and the place go to the model only on his tap.** The Lens names a plant, an animal or a building on the phone by
  itself. Sending the picture to the free model that sees waits for WHICH SPECIES or WHAT PLACE IS THIS, because his rule is that
  nothing leaves the phone until he presses. A barcode's number, which is not his data, is looked up by itself when there is a
  signal.
- **A date goes in as an all-day entry on its day.** The bill's REMIND ME, which sets a nine o'clock reminder and asks him to
  confirm the day first, is kept for bills and letters.
- **Addresses mean UK postcodes.** An address is found from a UK postcode line, plus the street line before it when there is one.
  Ghosty is UK-first, and a postcode is never confused with anything else.
- **The place question is labelled for the test model.** It starts "LENS NAME A PLACE", like NAME IT's question, so the test model
  (`apps/edge/src/llm/mock.ts`) answers it ("Big Ben"). The question gives no JSON example, so an echo can never be mistaken for a
  name.
- **A test-only way to stage a frame.** `oneFeed.text` and `oneFeed.online` exist only under a test runner, like the feed that was
  already there. They let the spec show the Lens a frame's words without a real reader. Words staged this way are never read over
  by the real reader.

## How to try it on his phone

1. Open the Lens and tap START. The picture should be in full colour.
2. Point it at:
   - a letter with a date and a phone number, then tap ADD TO AGENDA or CALL;
   - a sum written on paper, to see it worked;
   - a packet's barcode, to see what it is;
   - a mug, to see "A MUG · 82% sure";
   - a plant, then tap WHICH SPECIES;
   - a famous building on a screen or a postcard, then tap WHAT PLACE IS THIS.
3. Change the look in THE LOOK, and the picture stays in colour.

## What was checked

- **Typecheck:** `apps/web` is clean.
- **Brain tests:** `apps/edge/test/lens-one.test.mjs` has three new tests. They cover:
  - the job for each kind of frame;
  - the things in a read text, in order;
  - a sum and an equation worked, with no answer made up.

  The test list is protected, so they run in the existing file.
- **New spec `tests/lens2.spec.mjs`, at 440 × 956 and 390 × 844.** On fixture frames it proves:
  - the true colour in all seven looks, at 440;
  - every job above;
  - every key at 44 pt, nothing sideways and no words cut.

  Its word is at the end of check.yml's `all=`.
- **Specs re-run:** lens, lifeeasier, offlineeyes, seepass and phonehw (results below).

## What is left

- An address outside the UK, written without a postcode, is not found yet.
- A date written as "next Tuesday" is not found. Only days written out are found ("4 December", "04/12/2026").
- Measuring a thing still opens the measure on a held frame. It does not draw the sizes over the live picture.
