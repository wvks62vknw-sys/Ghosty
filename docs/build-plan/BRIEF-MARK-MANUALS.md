# Handwritten work marked from a photo, and gadget manuals kept with their fixes (PLAN Wave E)

Two features, one builder. Read BRIEF-W0.md, MAP.md, `features/lens` (READ: the on-phone OCR, Tesseract), the school
marking (`apps/edge/src/school/mark.ts`: exact and model marking with spot checks, `packages/shared/src/school.ts`
`markExact`, bands), `tools/learn.ts` (quizzes marked), the library (`tools/library.ts`, documents kept with source
and licence), web search and fetch (`tools/web.ts`), and `tests/lens.spec.mjs`, `tests/school.spec.mjs`.

## A. MARK MY WORK
In Lens, a MARK chip: photograph a page of handwritten (or printed) answers; the on-phone OCR reads it (the owner
corrects the text in a box before marking, since handwriting OCR is rough: said honestly); the owner names the
subject and, when he has them, the questions or the mark scheme (typed, pasted, or a second photo); the school
marker marks exactly where it can (numbers, short answers) and by the cheap model with a rubric where it cannot,
returning marks per question, a total, a band from the existing bands, and one line per wrong answer on what was
missed; the result is kept as a LEARN revision card set on tap (not a school record: the school is HIS exams). No
claim about a real exam's grade: "as this marking scheme sees it".

## B. GADGET MANUALS
"Find the manual for my Bosch dishwasher SMS24AW01G" (or a photo of the rating plate through Lens READ): web search
finds the manufacturer's own PDF (manufacturers' sites first, then the open manual archives that allow it; never a
site that forbids it; the source and licence noted as with other documents), the brain keeps it in the Library under
a GADGETS shelf with the model number, and from then on "my dishwasher shows E24" answers from the manual's own
pages with the steps, plus a web search for the fault code when the manual is silent, and REPLACEMENT PARTS as a
search for the exact part name with links (no shop favoured, no affiliate links, never a purchase). Honest: "from
the manual, page 12" or "from the web, not the manual".

## Tests (each must fail on the old code)
Edge: the marking of a photographed answer set (fixtures: a maths page, a short-answer page) with the per-question
marks and the honesty line; the manual finder's source choice (fixtures: a manufacturer PDF link, a forbidden site
skipped), the GADGETS shelf record, a fault-code answer citing the page. Specs: `tests/mark.spec.mjs` and
`tests/manuals.spec.mjs` at 440 × 956 with the brain mocked. `npm run check`, the edge tsc, the full edge `npm test`
once, the lens, school and library specs. Say any protected-file lines (tool-group words, hosts).

## Finish
Commit per feature (do not push, do not merge). Report: files; screenshots; every check's exact result; anything not
done and why.
