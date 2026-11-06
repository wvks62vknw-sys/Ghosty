# BRIEF: THE LIBRARY AS A LIBRARY — a reader for him, and Ghosty reading a book aloud

The owner, 2 Nov 13:35 UK: "our library should act as just that, a library, i insert books but he can't even read them to
me and i can't pull up the library and read them myself which is semi disappointing". Decided: a real reader screen and a
real LISTEN, under the talking rules of BRIEF-TALK-1A. Order after Friday 7 Nov's reset: STATUS section 4
item 2 — right after the design system of item 1, and built as the first screen in the new system, its tokens the only styles
used (OWNER-ISSUES 131; the ability pages that were to follow it were withdrawn by the owner on 4 Nov, 130). Nothing of this starts before the reset (the week ran out at 94% on 2 Nov).

Read first: STANDARD.md, STARS.md (125's gaps and 169), PLAN-STARS.md, BRIEF-TALK-1A.md (interruption, "go on", the two voices),
the design system landed by STATUS item 1, OWNER-ISSUES 122, 123, 125 and 131, HANDOFF, MAP.md. Start from the tip of `claude/ghosty-ai-training-idwhp9` (`git log -1` first).

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
   of the voice. THE VOICE FOR A BOOK (5 Nov, OWNER-ISSUES 131): the phone's own voice by default — a book is hours of speech and
   the brain's free voice has a daily share that would run out mid-chapter; the brain's voice is an option (SETTINGS → READING →
   HIS VOICE FOR BOOKS) for about an hour a day within that share, and when the share runs out mid-read he says "my own voice from
   here" and carries on: never silent, never a switch unannounced.
4. **By words.** `packages/shared/src/intent.ts` gains the reading intents: "read me <book>" (the Shelf's titles matched
   loosely, as the jump bar matches), "carry on reading" / "where were we", "read chapter <n>" / "read from page <n>",
   "stop reading". Answered with no model (the phone knows the shelf and the place); a book he has not got gets
   "I don't have that one. ADD it to the library and I'll read it." with the ADD button.
5. **The card and the catalogue.** CARDS.library's readouts: "Reading · The Hobbit" and "Page · 42 of 300" when a book is
   open, else the shelf count and the last book; the reader is `screen:reader` with its sections and phrases in the
   catalogue; the deck's Learn group card for the library says what it is now.
7. **The Shelf as a shelf (STARS 169).** The Shelf becomes the library he browses: a cover per book (the first page's picture where
   the file has one, else a drawn cover from the title in the theme's accent), the author where the file says it, sort by recent, by
   progress and by title, progress on every row ("page 42 of 300 · yesterday"), a finished book marked, the grid whole at 390 and 440.
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
  offline, a book kept on the phone still reads and LISTEN uses the phone's voice; LISTEN on a book uses the phone's voice by
  default and, with HIS VOICE FOR BOOKS on and the stand-in share exhausted, says "my own voice from here" and carries on without a
  gap; the Shelf shows covers, progress and the sort; the spec's first word and page-open times are held to the speed budget
  (STANDARD, the two habits).
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

One strong builder, about five to seven hours (the reader, the Shelf, the place, LISTEN under the talk rules with the voice rule,
the intents, the spec), then review and one checks run. Not before Friday's reset, and not before the design system of item 1.

## Addendum, 7 Nov: the first screen in the design system (read before "The shape")

- Start from the tip of `claude/new-session-4erjve` (PR #60: the design system, OWNER-ISSUES 139 and 140), on a branch
  `builder/library-reader`. Read `apps/web/src/design/tokens.css`, `apps/web/src/ui/machine.ts`, `apps/web/src/features/look/index.ts`
  (how a screen is drawn from the tokens and the marks) and MAP.md's rows for them first.
- HIS THREE RULES (OWNER-ISSUES 139), held on every surface of the reader and the Shelf: (1) NOT SO DARK: the canvas and the plates
  are the tokens' (`--g-canvas`, `--g-plate`), never a raw colour, never true black; the reader's page is a plate. (2) THE MACHINE
  FELT, NOT NAMED: the reader's top line is the stamp line (`stampLine`: the day, the time, his place, what is watched, LOOKING AT
  <the book>); the place is a truth line ("PAGE 42 OF 300 · YESTERDAY · CARRY ON"); the passage being read aloud is held in the
  reticle (ATTENDING) and the line of sight is not used here; a Shelf cover drawn from the title uses the tag and the plate; the
  recognition tone plays once when a book opens at his place, following his sound setting. Never the word "Machine" on screen.
  (3) EASY TO NAVIGATE: the reader is two taps from Learn (Learn → Library → the book) and one typed word ("read", a title) from
  the search; every pill, button and row has a name; nothing under 44 pt; body text 17 pt by default (SETTINGS → READING changes it,
  never under 12); contrast held by the tokens in every theme (the look test's floor applies to the reader's own CSS: no raw colour).
- Mind as the eye stays on THE LOOK (OWNER-ISSUES 140a); the reader's LISTEN bar does not draw the eye.
- Styles: a `/* THE READER */` section in styles.css written from the tokens alone (the look test's no-raw-colour rule), kept short;
  the shell's rules are not changed.
- Validation, learned the hard way on 6 Nov (two container restarts killed a builder mid-run): COMMIT BEFORE EVERY HEAVY STEP and run
  the steps one at a time: both typechecks; the brain bundle, then `node --import ./test/no-network.mjs --test test/library-place.test.mjs
  test/catalogue.test.mjs test/look.test.mjs`; the web build; the preview; then the specs ONE AT A TIME, the reader spec FIRST AND ALONE
  (it times the voice: never beside another spec), then library, talk, voice, tabs, hubcards, deck, look; the full brain suite last;
  the model-name scan. If a step is killed, continue from the last commit.
