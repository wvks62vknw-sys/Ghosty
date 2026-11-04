# PROGRAMME: THE FULL EDITORS — the owner's decision of 4 Nov

The owner, 4 Nov, after IDEAS-ROUND-1 refused them: "no i don't agree with you, i want the full editors". Decided: eight
real workspaces, each built on a proper engine, each measured against the product it stands in for, each to STANDARD.md's bar
(findable in two taps, every state said, nothing cut short, nothing fake, every advertised control working). Not chat boxes
with a toolbar. This file is the programme; each workspace gets its own BRIEF-*.md before its builder starts.

Facts that decide the order: the weekly credits reset on Friday 7 Nov; the owner's plan ends on 14 Nov (HANDOFF DEADLINE;
AFTER-14-NOVEMBER.md says what runs without us). One week fits about two workspaces at a first serious version. Nothing of
this starts before the reset. The owner picks the order; the recommended one is below.

## Rules that hold for every workspace

- Real engines, open source, free, licence-compatible with a personal app that others may deploy for themselves
  (DEPLOY-YOUR-OWN): MIT, Apache-2.0, BSD, MPL; GPL only where the owner says so (it would bind the whole app).
- Models and large assets are downloads: only on his tap, on Wi-Fi, with the size said; kept on the phone; removable.
- Nothing paid, no new keys unless he adds them. Nothing of his leaves the phone except to his own brain.
- Projects save as they go (the store's 200 ms save), reopen where they were, undo everywhere, export in the industry
  format and in PDF or PNG. Originals are never changed: editing is non-destructive.
- Every workspace is a screen in its area with a hub card, sections as pills, every state said in a sentence, every control
  named, nothing sideways at 390 and 440, 44 pt targets; a catalogue entry per workspace and per section; a spec per workspace
  that opens, edits, saves, reopens and exports a project and compares the export with a reference (a DOCX opened by a parser,
  an XLSX read back, a PPTX read back, an MP4 decoded, a glTF loaded).
- The benchmark is the named product's core workflow, written in the brief as steps, timed on the preview; the PR says the
  numbers. A workspace is not done because its main button works.
- The prompt guard is untouched: the AI parts (rewrite a paragraph, explain a formula, suggest cuts) are chat turns with the
  selection as context (IDEAS-ROUND-1 item 3), not new prompt sections.

## The eight, in the recommended order

### 1. The 3-D engine with physics and a library of real products (4–5 days) — compounds with the house, the car, the shed
- Engine: three.js (in the app already) as the renderer; Rapier (Apache-2.0, WASM) for physics and collision; a scene graph
  with object hierarchy, grouping, precise measurement, orthographic and perspective cameras, exploded views, cross-sections,
  materials with texture mapping, shadows and reflections within the phone's budget (measured frame time on the preview; the
  lean cut as the boot has).
- The object inspector (shared with the house, the car and the shed): tap anything → name, dimensions, material, cost, what
  can change; change it and everything downstream updates; measure between two points.
- The product library: real models with dimensions, material and source, CC0 or similarly free (Poly Haven, Sketchfab CC0
  and the like), fetched on his tap with the size said, kept on the phone; a curated first set (sofas, beds, desks, TV units,
  kitchen units, appliances, doors, windows) and his own glTF imports. Never a photograph on a plane called 3-D.
- Model intelligence: "what is this", "what is it made of", "make a version 20 cm wider" as chat turns with the selection as
  context; parts and consequences as first estimates, never certified.
- Export: glTF and USDZ (AR Quick Look on his iPhone shows the object in his room at true size), PNG, a PDF plan.
- Benchmark: place, measure, modify and export a furnished room in under five minutes on the phone.

### 2. Documents (2–3 days) — the core of Word
- Engine: ProseMirror (MIT) with a Tiptap-style schema: styles, headings, lists, tables, images, shapes as SVG, columns,
  headers and footers, page numbering, sections, footnotes, references and citations, an automatic contents page, comments,
  track changes (a change set kept beside the document; accept and reject), document comparison (a diff view).
- Export: DOCX (the `docx` library, MIT), PDF (print layout through the page's own print CSS), Markdown; import DOCX (mammoth,
  BSD) and text.
- AI: rewrite the selection, clarity, summary, consistency, contradictions, references from the cited pipeline, notes → a
  formal document: all as chat turns with the selection as context.
- Benchmark: a two-page letter with a table and a footer written, styled and exported to DOCX that opens unchanged in Word.

### 3. Spreadsheets (2–3 days) — the core of Excel
- Engine: a formula engine with references, ranges, the common function set (maths, text, dates, lookups, IF/IFS, SUMIFS and
  friends), multiple sheets, cell formats, conditional formats, sorting and filtering, validation, tables, charts (the app's own
  instruments), pivot-style summaries. Licence check first: HyperFormula is GPL (the owner's say), otherwise the app's own
  engine over formula.js (MIT) with a dependency graph and recalculation.
- Import and export XLSX and CSV (SheetJS community edition, Apache-2.0), formula explanation and data cleaning as chat turns.
- Benchmark: a household budget with twelve monthly sheets, a summary sheet with lookups and a chart, exported to XLSX and read
  back with the same numbers.

### 4. Presentations (2 days) — the core of PowerPoint
- Engine: the app's own slide editor on the document engine's blocks: master slides, layouts, themes (the twelve), animations
  and transitions, charts and tables, shapes, diagrams, speaker notes, presenter view, media; export PPTX (pptxgenjs, MIT) and
  PDF; a research report (IDEAS-ROUND-1 item 6) becomes an editable deck.
- Benchmark: a ten-slide deck from a report, themed, with notes, exported to PPTX that opens in PowerPoint and Keynote.

### 5. The workspace (3–4 days) — the core of Notion
- Pages and nested pages on the document engine; databases with relations, rollups and formulas (the spreadsheet engine);
  table, board, calendar, timeline and gallery views; templates; backlinks; comments; version history; search; offline editing
  (the phone's store, synced to the brain); import and export (Markdown, CSV).
- The project page carries its documents, tasks, research, decisions and deadlines, and the brain reads the whole project as
  context (item 3), not the page alone.
- Benchmark: a project with a board, a calendar view and three linked documents built and worked for a week without a lost edit.

### 6. Photo (3–4 days) — a real, non-destructive photo editor
- Engine: a WebGL pipeline of adjustments (exposure, white balance, curves, HSL, sharpening, noise reduction, lens and
  perspective correction), masks and selective adjustments, layers and blending, retouching, batch editing, presets, before and
  after, high-resolution export; RAW through LibRaw in WASM where the phone's memory allows (measured; said honestly when not).
- AI on the phone: background removal and subject selection with a segmentation model the app already runs for the Lens (a
  download, size said); object removal and background extension only if an inpainting model fits the phone (measured first).
- Benchmark: a RAW or HEIC photo graded, masked, retouched and exported at full size with the original untouched.

### 7. Video (5–7 days) — the core of CapCut
- Engine: WebCodecs (Safari 16.4 and later) for decode and encode, mp4-muxer (MIT) for export, a multitrack timeline, trims,
  splits, transitions and speed ramps rendered through WebGL, keyframes, colour grading and LUTs, stabilisation where a frame
  budget allows, audio mixing through WebAudio, subtitles and captions (the phone's speech-to-text for a first pass), chroma
  key, masking, picture-in-picture, proxies for long clips, autosave, export presets and aspect ratios.
- AI: scene detection, pause removal and subtitles on the phone; "the best clips", music matching and a Director Mode only as
  far as models the phone can run allow, said honestly in the brief after a measured trial.
- Benchmark: a one-minute phone video cut from four clips with transitions, a grade, music and subtitles, exported in 1080p.

### 8. The game studio (5–7 days) — a game maker, honestly sized
- First version: a 2-D game maker on the app's own engine (the runner and the block world are the start): tile maps, sprites,
  characters and NPCs, inventory, shops and currency, quests and missions, UI, sound, progression, saves; games export as
  mini-apps for the Home Screen. 3-D worlds, multiplayer and monetisation are not in the first version and the brief says so.
- Benchmark: a playable ten-minute game with a quest, an inventory and a save, made in an afternoon on the phone.

## What each brief must contain before its builder starts
His words; the engine and its licence; the first version's exact feature list; the benchmark steps; the catalogue entries;
the spec; the sizes measured on the preview; the owner's phone check; the design picks he may change.
