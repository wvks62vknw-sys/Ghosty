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
| Words | READ ALOUD (in the words' own language's voice until they have their English) and COPY. Words in another language are translated by themselves (only the words are sent, as before), or TRANSLATE. |
| A date in the words | ADD TO AGENDA: an all-day entry on that day. Once it is in, the card says IN YOUR AGENDA and does not offer it twice. |
| A phone number | CALL (the phone's dialler) and COPY. UK numbers only, with or without a bracketed area code. An order, invoice, account or reference number is never offered as a phone number. |
| An address (a UK postcode line) | ON THE MAP, with its street line when the line before is one. A product spec ("S24 8GB"), a unit or a floor sign is never taken for a postcode. |
| A link or an email address | OPEN, or WRITE. A link gets SCAN's checks: a look-alike address, an unencrypted page or a bare number address makes the key OPEN ANYWAY, with the warning said and a confirm first. |
| A sum or an equation | Solved and shown worked, line by line, the way it is taught ("7 × 3 = 21", "12 + 21 = 33"; "2x = 11 − 3 = 8", "x = 8 ÷ 2 = 4"; "15% of 80"; −3² is −9; 2^3^2 is 2^9). A homework question's number ("1)", "Q2.", "(a)") is left off. It never makes up an answer: dividing by nought, a span of years ("1914 - 1918"), opening hours ("9-5") or a season ("2024/25") gives none. |
| A bill or a letter | The letter card, with READ ALOUD and COPY, and the plate's REMIND ME and FILE, which are kept exactly as they were. |
| A whole page | SCAN IT FLAT, which opens SCAN's document part on the frame, and READ ALOUD. A page stays a page while he holds it, with no flicker between the page card and the text card. |
| A shop barcode or a book's ISBN | Looked up on Open Food Facts and its sister open databases (Open Library for a book) through the brain. It shows the name, brand and size; the Nutri-Score and Green-Score; energy, sugars, fat, saturates, salt and protein per 100 g; the allergens; and whose data it is. A book shows its authors, year, publisher and pages. Only the number is sent. Free, no key. If the databases are out, it asks again later and never says "nobody knows it". |
| A QR code | What it holds, acted on in the card. A link opens (OPEN ANYWAY with its warnings when it looks wrong). A Wi-Fi code gives the network and COPY PASSWORD. A contact gives CALL and WRITE. A number gives CALL, a text-message code TEXT, an email code WRITE, and a place ON THE MAP. SCAN's full card is behind MORE. |
| A thing | Named on the phone, with how sure ("82% sure"); MEASURE IT (the existing measure); ASK ABOUT IT (that thing, with its picture, sent by him). A teddy bear or a hot dog is a thing, not an animal. |
| A plant or an animal | Named on the phone with how sure. One tap on WHICH SPECIES runs NAME's living-thing check at once, as the kind the phone's name says: a bird, an insect, a plant (Pl@ntNet, with his free key) or other. The answer is NAME's full card: the species and its Latin name, how sure, the tell-tale, WIKIPEDIA, SAVE and KEEP. |
| A landmark or a work of art | WHAT PLACE IS THIS: the free model that sees names it, and the brain's encyclopedia route gives its summary and a WIKIPEDIA key, with ASK AGAIN if it is wrong. The answer belongs to the thing it was asked about: another clock tower is never shown as the first. A failed request is said as failed, not as "not sure". |
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

## The independent review

Before merging, four reviewers read the change, each from one angle:

- what the Lens reads off print;
- the cards and their wiring;
- his rules and privacy;
- the spec.

Then a separate skeptic tried to disprove each finding. Every finding that survived is fixed, and each has its own check in
`lens-one.test.mjs` or `lens2`. The changes are listed in the table above:

- sums that were not sums;
- powers worked in the wrong order;
- postcodes, phone numbers and links taken wrongly;
- a place answer shown for the wrong thing;
- cards blinking out while the same words were re-read;
- a risky link opening in one tap;
- a fixed wait in the spec.

## How to try it on his phone

1. Open the Lens and tap START. The picture should be in full colour.
2. Point it at:
   - a letter with a date and a phone number, then tap ADD TO AGENDA or CALL;
   - a sum written on paper, to see it worked;
   - a packet's barcode, to see what it is;
   - a mug, to see "A MUG · 82% sure";
   - a plant or a bird, then tap WHICH SPECIES once;
   - a Wi-Fi QR code, then tap COPY PASSWORD;
   - a famous building on a screen or a postcard, then tap WHAT PLACE IS THIS.
3. Change the look in THE LOOK, and the picture stays in colour.

## What was checked

- **Typecheck:** `apps/web` and `apps/edge` are clean.
- **Brain tests:** `apps/edge/test/lens-one.test.mjs` has seven new tests. They cover:
  - the job for each kind of frame;
  - the things in a read text, in order;
  - sums and equations worked, with no answer made up;
  - the review's cases, one by one;
  - powers and signs as taught;
  - which kind a species question is asked as;
  - the new voice wordings, and that nothing else is taken for them.

  The test list is protected, so they run in the existing file. The ratchet, knowledge, look, finding, abilities and catalogue
  tests pass. The full brain suite passed before the merge (its count is in the merge commit).
- **New spec `tests/lens2.spec.mjs`, at 440 × 956 and 390 × 844.** On fixture frames it proves:
  - the true colour in all seven looks, at 440;
  - every job above, including:
    - the species named in one tap;
    - the product's figures and allergens;
    - a Wi-Fi password copied;
    - a risky link's OPEN ANYWAY;
    - a second clock tower not taken for the first;
  - "call that number" and "solve that" by voice;
  - every key at 44 pt, nothing sideways and no words cut.

  Its word is at the end of check.yml's `all=`.
- **Specs re-run, all clean:** lens, lifeeasier, offlineeyes, seepass and phonehw.

## What is left

- An address outside the UK, written without a postcode, is not found yet.
- A date written as "next Tuesday" is not found. Only days written out are found ("4 December", "04/12/2026").
- Measuring a thing still opens the measure on a held frame. It does not draw the sizes over the live picture.
- A sum is solved only when it is printed on one line, in numbers. A word problem ("Tom has 3 apples…") goes to ASK.
- The place answer is kept only while that thing stays in view. Pointing away and back asks again on his tap, rather than
  remembering.
