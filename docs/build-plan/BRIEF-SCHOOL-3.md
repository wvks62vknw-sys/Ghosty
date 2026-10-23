# SCHOOL part 3: the reading library for each stage, reading ahead that is earned, and the library's locks

Read BRIEF-W0.md, HANDOFF.md "RAISING GHOSTY" (READING and READING AHEAD: the owner's rules), BRIEF-SCHOOL-1.md and
2a (what exists: `apps/edge/src/school/*`, `packages/shared/src/school.ts` with `canBorrowFrom` and `topicUnlocked`,
the SCHOOL tab), the library's importers (`apps/edge/src/library/importers.ts`: Project Gutenberg books by number,
web pages), `library/study.ts` (the self-study queue: one field at a time) and MAP.md's entries for them.

Other builders are working in `selftrain/*` and the notebook (part 2b, which also appends two routes to
`school/routes.ts`), and restyling the whole interface. Work ONLY in: new `apps/edge/src/school/reading.ts`,
`apps/edge/src/school/routes.ts` (append your routes at the END of its handler, nothing else), `apps/edge/src/library/study.ts`
(one guarded condition, below), `apps/web/src/features/school/index.ts` (one new READING section at the end),
`apps/edge/test/school.test.mjs`, `tests/school.spec.mjs`, `packages/shared/src/school.ts` (pure additions only),
MAP.md, `apps/web/styles.css` inside the `/* SCHOOL */` block. No protected files.

## Build

1. **A reading shelf for every stage** (`school/reading.ts`): a curated list, in the code, of books and textbooks for
   each stage with their source and licence: public-domain classics from Project Gutenberg by number (for the owner
   in the UK a work is public domain when its author died before 1955: Beatrix Potter, Lewis Carroll, Kenneth Grahame,
   Frances Hodgson Burnett, Edith Nesbit, Kipling, Stevenson, Baum, Twain, Dickens, Austen, the Brontës, Mary Shelley,
   Verne, H. G. Wells, Conan Doyle, L. M. Montgomery, Alcott, Anna Sewell, Lear, Aesop, Andersen, Mother Goose, and so
   on; NOT Milne, Tolkien, Lewis or anyone who died in 1955 or later), from nursery rhymes and picture-book fables up
   to university reading; plus open-licensed textbooks and lessons tagged by year and subject (OpenStax for A-level and
   university, CC BY; Siyavula maths and science for Years 5–13, CC BY; any other source only with an open licence:
   OGL, CC BY, CC BY-SA, CC BY-NC or public domain; anything merely © is linked, never ingested). Verify each
   Gutenberg number and each URL exists today (headers); drop what does not and say so.
2. **READ** puts a book on his reading list and imports it into the library through the existing importers (the
   whole Gutenberg text, chapter by chapter, as the Library tab does), tagged as school reading under
   `school:reading:<docId>` with its stage; progress and "read" status per book; a book he has read is listed as
   read with the date. Self-study treats a stage's reading as part of that stage.
3. **The reading check** (comprehension): for any book on his shelf, a short test written by a stronger model from the
   book's own text (background lane, cached per book: 10 questions, multiple choice and short exact answers, never
   seen before), sat on the phone like a paper (reuse `sit.ts`'s flow through a paper-shaped object) and marked
   exactly; pass mark 80 %. The result is kept with the book.
4. **Reading ahead is earned** (the owner's rule, from his own Year 2 story): he may BORROW a book from a higher stage
   only when (a) his current stage's reading subject stands at top grades, (b) the higher stage is within
   `BORROW_AHEAD` (two stages) and not the library itself (`canBorrowFrom`), and (c) he passes that book's reading
   check at 80 % or better. A borrowed book is marked borrowed; borrowed reading never counts towards passing a
   stage; a failed check says so plainly and the book stays locked until the next stage. Honest copy everywhere.
5. **The library's locks**: in `library/study.ts`, the queue skips a curriculum topic whose level is not unlocked at
   the current school stage (`topicUnlocked(stage, topic.l)`; the stage read from the school state through one small
   function you add in `school/reading.ts` or `state.ts`, cached per session), with a status line that says what is
   locked and why ("Level 2 topics unlock at A-level"). The owner's own uploads and the chat are never locked. A
   FOCUS the owner typed is still read (he asked).
6. **The SCHOOL tab's READING section**: this stage's shelf (title, author, source and licence line, READ / READING /
   READ ✓), the reading check (SIT THE READING CHECK, the score), BORROW with the rule explained in one line and the
   higher stages' shelves, and what is locked.

## Tests (each must FAIL on the old code)

`school.test.mjs`: the curated shelves (every entry has a source, a licence and a stage; no author who died in 1955 or
later; Gutenberg entries by number); READ imports through the importers (mocked fetch) and tags the book; the reading
check is cached per book, never includes an exam item, is marked exactly and passes at 80 %; BORROW is refused without
top grades in reading, beyond two stages, for the library, or after a failed check, and allowed when earned; borrowed
reading never passes a stage; the study queue skips locked topics and keeps a typed FOCUS. `tests/school.spec.mjs`:
the READING section lists the shelf, READ runs through the mock brain, BORROW shows the rule.

## How to run things here

As BRIEF-SCHOOL-1.md says; YOUR preview port is **8808**; targeted tests while working; the full edge `npm test` once
at the end (≈ 16 min on this shared 4-core machine); tsc; `npm run check`; the school spec on your port.

## Finish

Commit on your worktree branch, often (do not push, do not merge). Final report: files changed; the shelves with each
entry's check result; tests and proof they fail on the old code; every check with its exact result; screenshots;
anything not done and why.
