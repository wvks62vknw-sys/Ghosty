# BRIEF-REST-E — the converter and documents, and the rights-and-law topics from primary sources (batch ⑧ part E, 1 Nov 2026)

Worktree from the LOCAL tip of claude/ghosty-ai-training-idwhp9 (at or after the commit that adds this brief; never reset to
FETCH_HEAD or origin, only to the local branch). Your preview port: 8677. Read first: ROADMAP row ⑧ ("the common thirty
format conversions and documents read/written/edited/translated"; "the rights-and-law topics"); OWNER-ISSUES 91 (his words:
"all format converter.. any format editor.." and "auto document reader writer editor translator and transliteration with all
forms of editing with on all formats in any language"), 69 and 78 (the character grounded in human rights and the EPISTEMICS:
every claim traces to a PRIMARY or credible source), 90 (knowledge with sources as built: six tiers by a curated host table,
six claim labels, the caps as code), 99 (the catalogue rules). The code: `apps/edge/src/cited.ts` and the tier table it
imports, `apps/edge/src/library/digest.ts` (the primary and credible feeds already followed: UN News, the ICC, GOV.UK, new UK
legislation, Amnesty, Human Rights Watch, ICIJ, Bellingcat), `apps/edge/src/knowledge/*` (the handbook's shape; your topics
join as `knowledge/rights/*.ts`), `apps/web/src/library/extract.ts` + `upload.ts` (how a PDF or a file becomes text today),
`apps/web/src/school/pdfprep.ts`, `tests/preview-server.mjs` (it writes a small PDF for fixtures), `public/vendor/tesseract`
(OCR, vendored) and `public/vendor/zxing` (barcodes, vendored), `apps/web/src/features/money/sheet.ts` (a sheet with a file
in). Other builders run in parallel: touch nothing under `features/people|work|creative|outside|homeadmin|learning/`, `wiki/`,
`morse/`, `coach/`, `demo/`, `build/`, `house/`, `lens/`, `hands/`, `tv/`, `arcade/`, `social/`, `offline/`. Yours: `apps/
web/src/convert/*` (new), `apps/web/src/docs/*` (new: the document reader, writer, editor), `apps/edge/src/knowledge/rights/*`
(new) + their join, your phrases and local asks, `packages/shared/src/catalogue/reste.ts` (joined where the catalogue files
are), `apps/edge/test/reste.test.mjs`, `tests/reste.spec.mjs`, the smoke loop's list (`reste` after `restd` if present, else
after `resta`), `apps/edge/package.json`'s test list, a CSS block at the END of styles.css, vendored libraries under `apps/web/
public/vendor/<name>/` with LICENCE and SOURCE.md (permissive or LGPL/GPL as the engines already are; sizes in the report).
The plain prompt is at exactly 5,500 on its worst dial: add nothing to it (no new brain tool; the brain writes, edits and
translates through the ordinary chat with the document's text as the turn's data, the phone does the rest).

## 1. THE CONVERTER (MAKE → CONVERT; "convert this to PDF", a file dropped on the chat)

Thirty common conversions, all on the phone, nothing uploaded anywhere: IMAGES — HEIC to JPG where the browser decodes it
(Safari does; where it cannot, the plain line), JPG ↔ PNG ↔ WebP, resize to a size or a width, compress to a target size,
crop to a ratio, strip location data (said as what it removes), several images → one PDF (our own PDF writer in code: JPEG
embedded as it is, PNG as a Flate stream, A4 or the image's size), PDF pages → PNG (pdf.js vendored, Apache-2.0), a PDF's
pages split or joined, a PDF's text out; TEXT AND DATA — TXT ↔ Markdown ↔ HTML, CSV ↔ JSON ↔ XLSX (SheetJS community
edition vendored, Apache-2.0) with the header row kept, JSON pretty or minified, a table pasted from a page → CSV; DOCUMENTS
— DOCX → text and HTML (mammoth vendored, BSD-2), text or Markdown → DOCX (our own writer in code: a zip with document.xml and
styles, headings and lists kept), anything readable → PDF through the document layout of part 2; AUDIO — a recording → WAV,
WAV ↔ the formats the phone's decoder reads (said per device), trim to a range; MP3 writing only if a vendorable encoder
fits under 300 KB, else said as not done; CODES — a QR or barcode read (zxing, already here) and a QR made (a small
generator in code) for text, a link, Wi-Fi details; UNITS AND NUMBERS — the sheet also takes "3.5 miles in km", "£40 in
euros at today's rate" (the rate the brain gives with a citation when he asks; else "no live rate here"), base64 ↔ text,
Unix time ↔ a date. VIDEO is NOT done (a transcoder would be 30 MB and slow on a phone): the sheet says so and offers the
phone's own share sheet. The sheet: choose or drop a file (or several) → what it is, its size → the conversions that apply →
done on the phone with a progress line → SAVE and SHARE (the iPhone's share sheet; a plain download elsewhere), the output's
size said. Every conversion is a pure function in `convert/` with a test.

## 2. DOCUMENTS (MAKE → DOCUMENTS; "write a letter to my landlord about the damp"; "read this"; "translate this into Urdu")

READ: PDF, DOCX, TXT, Markdown, HTML and EPUB (a zip of HTML) → the text with its headings and lists kept, shown as a document
sheet with a contents list, READ IT TO ME with the phone's voice, FIND. WRITE: from the chat, the brain writes the words as it
does today (the ordinary chat; no prompt change); the phone lays them out as a DOCUMENT — title, headings, paragraphs, lists,
his name and the date where a letter wants them — in a clean document style (one serif and one sans the app already has, A4
margins), exported as PDF (the writer of part 1), DOCX, Markdown or HTML, and SAVED on the phone under MY DOCUMENTS with its
date. EDIT: the document sheet is an editor — paragraphs, headings, bold, italic, lists, find and replace, undo — and the
brain's edits come as SUGGESTIONS he accepts or rejects one by one ("make it shorter", "more formal", "fix the grammar", "in
plain English"), shown as the old words struck and the new beside them, never applied silently. TRANSLATE: a whole document
translated paragraph by paragraph by the brain (the phone's own brain when the cloud is off-limits), the structure kept, the
original and the translation side by side on a wide screen and stacked on the phone, the language picked by name; "in any
language" means the brain's languages, said. TRANSLITERATE: letters, not meaning, by tables in code — Arabic and Urdu/Persian,
Cyrillic, Greek, Devanagari, Hebrew, Armenian, Georgian → Latin and back where the table is one-to-one; the honest line
("the sounds in Latin letters, not a translation"). All of it on the phone except the brain's words.

## 3. THE RIGHTS-AND-LAW TOPICS (the knowledge base, from primaries)

`apps/edge/src/knowledge/rights/`: documented human-rights and international-law topics, each an entry with WHAT THE PRIMARY
DOCUMENTS FOUND in their own words or a faithful summary (a court's order, a UN commission's conclusions, an Amnesty or Human
Rights Watch report's findings, a statute's section), the DATE, the exact URL of the document, the TIER as the sourcing code
labels it, and `checked: '2026-11-01'`. THE RULE OF THE BASE: every URL is FETCHED AND READ BY YOU THIS SESSION — its title
and date taken from the page, the finding checked against the page — nothing from memory alone; an entry whose document you
cannot reach is DROPPED, not guessed; a finding is stated only as strongly as the document states it (a provisional measure is
not a judgment; a commission's finding is the commission's; a report's conclusion is the organisation's). Cover: the
international topics the character already knows from primaries (OWNER-ISSUES 69's list: the ICJ's orders and the genocide
case, the ICC's warrants, the UN commissions of inquiry, Amnesty's and HRW's reports, and the other documented cases named
there), and the PRACTICAL UK side for him — his rights when stopped and searched, at a police station, as a tenant, as a
consumer, at work, at school (exclusions and appeals), with a disability, as a renter facing eviction, when a company holds his
data — each from GOV.UK, legislation.gov.uk, Citizens Advice, Liberty or the relevant regulator, with the plain line "not
legal advice; here's who to call" and the number (Citizens Advice, Shelter, ACAS, the ICO, the IPCC's successor as it is
today). HOW IT IS USED: when he asks about a topic, the brain gets the matching entries as the turn's data with their tiers
(retrieval, the way the handbook's playbooks are read), and the answer carries the sources listed as the cited pipeline does;
the Digest's feeds already follow the organisations; the Library can OPEN a topic as a page of its documents. Plain words; the
documents' own findings, not ours; nothing about any private person.

## The lines that hold

Nothing leaves the phone in parts 1 and 2 except the words the brain is asked for; nothing bills; the knowledge base holds only
what you read this session, dated and linked, stated as strongly as its document and no more; the plain prompt untouched; no
test skipped or weakened; the guard job untouched; no model names anywhere; every new thing has its catalogue entry.

## Tests

`reste.test.mjs`: each conversion's pure function (the PDF writer's output parses in pdf.js; CSV ↔ JSON ↔ XLSX round-trips; the
DOCX writer's zip has its parts; the transliteration tables round-trip where one-to-one; the QR generator's output decodes with
zxing), the document model's edits and suggestions, the knowledge base's shape (every entry has a finding, a date, a URL on
an allowed primary or credible host, a tier and a checked date; no two entries share a URL and finding) and the retrieval
match. `tests/reste.spec.mjs` on your preview: a JPG → PDF, a CSV → XLSX, a PDF read and READ IT TO ME, a letter written from
the chat and exported, a suggestion accepted, a translation side by side, a rights question answered with its sources listed,
nothing sideways at 390 × 844, VoiceOver labels.

## Working lean

Ranged reads; `tail -30`; the brain suite once at the end under `nice -n 10`; no narration; one fetch per source document (a
HEAD or a GET of the page, read once). Validation: brain typecheck + suite; web typecheck + build; on one fresh preview:
websites, apps, library, reste, deck, nav.

## The report (one message)

Base SHA, HEAD SHA, the worktree branch; commits; files (vendor sizes); validation numbers; the thirty conversions as built and
the ones not done; the topics and how many documents were read and how many dropped; LIMITS; DESIGN PICKS THE OWNER MAY
CHANGE; NEEDS HIS PHONE; WHAT THE MERGE MUST KNOW.
