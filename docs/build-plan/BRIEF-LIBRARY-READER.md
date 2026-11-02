# BRIEF: THE LIBRARY AS A LIBRARY — a reader for him, and Ghosty reading a book aloud

The owner, 2 Nov 13:35 UK: "our library should act as just that, a library, i insert books but he can't even read them to
me and i can't pull up the library and read them myself which is semi disappointing". Decided: a real reader screen and a
real LISTEN, under the talking rules of BRIEF-TALK-1A. Order after Friday 7 Nov's reset: this first, then
BRIEF-ABILITY-PAGES (the owner may swap them). Nothing of this starts before the reset (the week ran out at 94% on 2 Nov).

Read first: STANDARD.md, STARS.md, PLAN-STARS.md, BRIEF-TALK-1A.md (interruption, "go on", the two voices), OWNER-ISSUES
122, 123 and 125, HANDOFF, MAP.md. Start from the tip of `claude/ghosty-ai-training-idwhp9` (`git log -1` first).

## What exists (reuse it; do not rebuild it)

- The library screen (`apps/web/src/features/library/index.ts`, screen:library): Shelf, Ask (search by meaning, on the
  phone when its index is whole), Self-study (Ghosty's own reading, one field at a time: NOT the owner's reading), Gadgets,
  Fresh today. A document on the Shelf opens in `openDoc`: a modal, passage by passage from `brain.libraryPassages(id,
  after)` with page marks and headings and a MORE button, REMOVE FROM LIBRARY. That modal is what this brief replaces.
- Documents: PDF, Word, EPUB, web pages, text, CSV, code, photos of pages (`library/extract.ts` ACCEPT); the brain keeps
  passages with `page` and `heading` (`/library/docs`, `/library/search`, the passages route); the phone keeps a local
  copy (`library/local.ts` LocalDoc, passagesHere, keepForever) so a book reads offline.
- The offline Wikipedia reader (`apps/web/src/wiki/view.ts`) already reads an article aloud whole with `speak(text, {
  here: true })` — the pattern for LISTEN, but a book is far longer than an article.
- The voice (`assistant/voice.ts`): `speak(text, { owner, brief, here })`, `quickFirst`, `interrupt`, `onCutOff`, the
  carry-on ("…as I was saying,") in session.ts, the conversation loop in features/core; the talk spec's stand-in voice.
- The hub card (`shell/hubcards.ts` CARDS.library) with its instrument and two readouts; the catalogue (screens,
  sections, phrases) and its test.

## The shape

1. **A reader screen, not a pop-up.** `apps/web/src/features/library/reader.ts`, drawn as the TABS screens are (a top
   line in his voice: "The Hobbit · page 42 of 300 · you were here yesterday"), with section pills READ · CHAPTERS ·
   SEARCH · ABOUT. READ shows the book's text flowing, page marks where the source has pages, headings as chapter heads;
   swipe or scroll (SETTINGS → READING: pages or scroll; font size; night text follows the theme). CHAPTERS lists the
   headings (or page ranges when a book has none) and jumps. SEARCH finds inside this book and jumps to the passage, marked.
   ABOUT is today's chips (kind, where from, pages) with REMOVE FROM LIBRARY and KEEP ON THIS PHONE.
2. **Your place, kept.** Per book: the passage and offset, on the phone at once (the store saves 200 ms after a change) and
   on the brain (`/library/place`, so another device opens where he left). Opening a book goes to the place; the Shelf row
   says "page 42 of 300" and "yesterday"; a finished book says so.
3. **LISTEN: Ghosty reads it to him.** A LISTEN button on READ (and "read me <book>" by words) reads from the place,
   passage by passage, the next piece handed to the voice before the one before it ends (no gap: TALK-1A 1), in the voice he
   chose; the place moves as each passage is said and the text on screen follows the voice (the passage being read is
   lit; the page turns). Talking over him stops him within the budget and keeps the place; "go on" / "carry on" reads on
   from the passage he was in; "stop" / "that's all" / the mic let go ends it and says the place ("Page 48. I'll carry on
   from here."); a chapter's end says the next chapter's name and goes on unless he said "just this chapter". A reply he
   asks for mid-read ("what does that word mean?") is answered and then, on "go on", the reading resumes from the same
   passage: the carry-on of TALK-1A 2, with the book as the thing cut. Never `brief`: a book is read whole, at the pace
   of the voice.
4. **By words.** `packages/shared/src/intent.ts` gains the reading intents: "read me <book>" (the Shelf's titles matched
   loosely, as the jump bar matches), "carry on reading" / "where were we", "read chapter <n>" / "read from page <n>",
   "stop reading". Answered with no model (the phone knows the shelf and the place); a book he has not got gets
   "I don't have that one. ADD it to the library and I'll read it." with the ADD button.
5. **The card and the catalogue.** CARDS.library's readouts: "Reading · The Hobbit" and "Page · 42 of 300" when a book is
   open, else the shelf count and the last book; the reader is `screen:reader` with its sections and phrases in the
   catalogue; the deck's Learn group card for the library says what it is now.
6. **Honest on the phone.** Whether iOS keeps him reading with the screen locked is checked on the owner's phone, not
   claimed: the brain's clips play through the audio element (may continue), the phone's own voice stops (iOS pauses
   speech synthesis); the ABOUT pill says which voice keeps reading when the screen locks, once he has told us.

## What must not change

- The security boundary (HANDOFF): documents stay his; nothing paid; downloads only on his tap on Wi-Fi with the size
  said (a whole book kept on the phone is a download: KEEP ON THIS PHONE says its size). The prompt guard is untouched
  (reading calls no model; the brain's voice is `/api/tts` as now, within its daily share, the phone's voice after it).
  Never a model name in code, comments, tests, docs or PR text. The CI guard job is untouched.
- Ghosty's own reading (self-study, the fields, BORROW in the school's reading ladder) is a different thing and stays as
  it is; the words in the reader never call it "his reading".

## Tests (each fails on the old code)

- `tests/reader.spec.mjs`, joining the smoke list after `talk`, on the preview with the scripted brain and the talk spec's
  stand-in voice: a three-chapter text imported as a book opens in the reader at its start with page marks and chapter
  heads; the place is kept across a reload and shown on the Shelf row; CHAPTERS jumps; SEARCH jumps to the marked passage;
  LISTEN reads passage after passage with no gap (the stand-in's record: each handed over before the one before ended),
  the lit passage follows, the place moves; talking over him silences him within the budget and keeps the place; "go on"
  resumes from that passage with the bridge, never from the top; "stop reading" ends it and says the page; a question
  mid-read is answered and "go on" resumes the book; "read me <book>" and "where were we" by words with no model (the
  mock's call count stays); the card's readouts; nothing sticks out sideways at 390 and 440; every control has a name;
  offline, a book kept on the phone still reads and LISTEN uses the phone's voice.
- `apps/edge/test/library-place.test.mjs`: the place route keeps and returns a place per book, owner-only, and refuses a
  place past the book's end.
- The library, talk, voice, tabs, hubcards and deck specs still pass.

## Validation before the PR

Both typechecks; the brain suite; the catalogue test; the new spec and the six above on one preview in CI's order; the
web build; a model-name scan of the diff. The PR body says what was measured (first word of a LISTEN, the gap between
passages, cut-to-silence, resume).

## The owner's phone check (write it into OWNER-ISSUES with the build record)

(1) Learn → Library → tap a book: it opens at page one in the reader, with chapters; (2) read a few pages, close Ghosty
fully, open it: the Shelf row says the page, tapping it opens there; (3) LISTEN: he reads on, the text follows; talk over
him: silent at once; "go on": from the sentence he was in; (4) ask him something mid-read, then "go on": back to the book;
(5) "read me <your book>" from Home: it starts without a tap; (6) lock the screen while he reads: tell us whether he kept
going (brain's voice) and whether he did with the phone's voice.

## Size

One Opus builder, about four to six hours (the reader, the place, LISTEN under the talk rules, the intents, the spec), then
review and one checks run. Not before Friday's reset.
