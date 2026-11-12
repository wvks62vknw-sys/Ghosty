# BRIEF: PHOTO 2 — RAW opened, a real cut-out and a real erase on the phone (his yes, 185)

BRIEF-EDITOR-PHOTO-2 (OWNER-ISSUES 185 "yes to all" to the downloads PHOTO named as NEEDS HIS WORD: RAW, a matting model for SUBJECT, an
inpainting model for ERASE; BRIEF-EDITOR-PHOTO's "What is honest, not here"; PROGRAMME-EDITORS' rule "Models and large assets are downloads:
only on his tap, on Wi-Fi, with the size said; kept on the phone; removable"). Starts FROM PHOTO'S HEAD (builder/photoedit, 37bdc01a, not yet
on main; the orchestrator lands only the diff above it, after PHOTO is on main), so the editor's recipe, pipeline, store and screen are in the
tree. One builder, one PR. Read STANDARD.md, BRIEF-EDITOR-PHOTO.md and the photo report (scratchpad/photoedit-report.md), `apps/web/src/
offline/eyes.ts` and `offline/pack.ts` (THE PACK RULE: how a model pack is offered, fetched on his tap with its bytes pinned, kept and
removed), `apps/web/public/vendor/clip/README.md` and `vendor/depth/README.md` (how a model and the ONNX runtime, MIT, are vendored with their
licence files beside them and split into parts under 25 MB), `apps/web/src/photo/subject.ts` (today's depth-and-box first cut) and
`features/lens/photo.ts` (today's brain ERASE), then this. THE QUALITY RULE holds.

## His words
"yes to all" (12 Nov) to: "RAW photos, cut-outs and object removal on the phone, each on your tap on Wi-Fi with the size said".

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

The model-name rule is about the AI models that answer him; a vision model's own name and licence stand in its README and LICENSE files under
public/vendor, where the depth and clip models' do (182's decision), and nowhere else: in code, the pack is "the cut-out model", "the erase
model", "the RAW reader". Protected files, not edited: apps/edge/src/agent.ts, apps/edge/src/index.ts, apps/edge/src/tools/{index,types,repo}.ts,
.github/* (except the one spec word at the END of check.yml's `all=` list; the guard job untouched), apps/*/package.json. No package added:
the ONNX runtime already vendored under public/vendor/clip is the runtime. Nothing fetched from anywhere but this site's own files. A photo
never leaves the phone for any of the three. No face is found, named or tracked: a cut-out is a shape.

## What is built

1. **THE LICENCES AND SIZES FIRST, WRITTEN DOWN BEFORE A BYTE IS VENDORED.** For each of the three, the builder finds a free model or library
   whose licence is MIT, Apache-2.0, BSD or MPL (LGPL only as a separate downloadable file, as LAME is; GPL never), records in the report its
   name, source, licence text, and measured size as the files the phone would fetch, and only then vendors it. The expected candidates, to
   check and not to assume: for the CUT-OUT a small salient-object model (the U²-Net family's small build, Apache-2.0, about 4 to 5 MB as ONNX,
   input 320 × 320, output a soft mask); for the ERASE a small inpainting model (the LaMa family, Apache-2.0; the int8 ONNX build measured,
   split into parts under 25 MB as the depth model is; if the smallest honest build is over 120 MB, the pack is still offered with that size
   said and a one-line warning, never silently); for RAW a WASM build of a free RAW decoder (LibRaw, LGPL-2.1, as a separately fetched file
   with its licence beside it, about 1 to 3 MB; if no WASM build with a verifiable licence can be found or built from source here, RAW is NOT
   shipped, the editor keeps its "I can't open RAW yet" line, and the report says exactly what was tried). Every vendored file has its
   LICENSE and a README beside it naming the model, the source and the build; `tests/offlineeyes.spec.mjs`'s pin check covers the new files.
2. **THE PACK (offline/eyes.ts gains PHOTO'S EYES, or one pack per model if their sizes differ by more than ten times).** Offered in PHOTO's
   SUBJECT, ERASE and OPEN RAW flows and in the offline packs screen as the four existing packs are: the size said first, GET on his tap on
   Wi-Fi only (the pack rule), progress with the bytes, kept in the phone's cache, REMOVE with the size freed said. Before the pack is kept,
   SUBJECT keeps today's first cut and says once "A better cut-out needs the cut-out model (N MB): GET"; ERASE keeps the brain's and says once
   "Erase on this phone needs the erase model (N MB): GET"; a RAW shared in says the reader's size and GET.
3. **THE CUT-OUT (photo/matting.ts):** the model run in a Worker through the vendored runtime over a 320 × 320 letterboxed copy, its soft mask
   upsampled with the picture's edges (a guided upsample: the app's own, photo/alpha.ts extended) to the picture's size, then the result
   written into the recipe's SUBJECT mask exactly as the first cut is, so every tool that takes a mask takes it; the depth-and-box cut stays
   as the fallback and as a REFINE WITH DEPTH option; a brush fixes either. Time measured on the preview and said in the report.
4. **THE ERASE (photo/inpaint.ts):** ERASE in the editor (a brush or the SUBJECT mask as the hole) runs the erase model over a crop around the
   hole at the model's size (512 × 512, tiled where the hole is bigger, feathered back), the result kept as a heal layer in the recipe (so it
   is undoable, non-destructive, and exports at full size through the tiled path); the brain's ERASE stays as BRAIN ERASE in the same tray and
   is the fallback with no pack. Time measured and said; "Erasing… about N s" as the wait.
5. **RAW (photo/raw.ts), if shipped:** a RAW file (CR2, CR3, NEF, ARW, DNG, RAF, ORF) opened through the reader in a Worker to a 16-bit linear
   picture, demosaiced by the reader, white-balanced by the camera's own numbers from the file, written to the recipe's original as a
   lossless PNG kept beside the RAW bytes (both untouched in the store, the RAW as the original of record so EXPORT ORIGINAL gives the RAW
   back byte-equal), the EXIF read as today; the editor's light sliders work in the extra range (highlights recoverable); "Reading the RAW…"
   with the file's size as the wait; the time said.
6. **THE SCREEN'S WORDS.** The SUBJECT tray says which cut it made ("from the cut-out model" or "a first cut from depth"); the ERASE tray says
   which erase ran ("on this phone" or "by your brain"); a RAW opened says so once. Every state in his voice (no Wi-Fi: GET waits and says so;
   the pack half-fetched: RESUME; a model that fails to load: its line and the fallback used, never a silent fallback).

## What must not change

PHOTO's recipe shape (new fields only), its pipeline, its export's byte-equal original, its spec green; today's first cut and the brain's three
keys as fallbacks; the pack rule (nothing fetched before his tap; Wi-Fi only; the size first); the ratchet; every budget; GLASS pixel-equal;
no face code called; nothing of his leaves the phone.

## Tests (each fails on the code before this brief; run against it once and say so)

- apps/edge/test/photo2.test.mjs (new; imported from an existing test file by one import line; NEEDS HIS WORD names it): the pack's pins
  (bytes equal to the vendored files); the guided upsample on a synthetic mask (edges follow the picture, the interior is flat); the tiling
  of a hole over 512 px (the tiles cover the hole with the feather); the RAW reader's refusal words for an unreadable file; the recipe's new
  fields round-tripping with an old recipe still reading.
- tests/photo2.spec.mjs (new; `all=` word `photo2` at the END of the list in check.yml, nothing else in .github touched), at 440 and 390, GL
  on: (a) SUBJECT with no pack: the first cut and the GET line with the size; (b) the pack fetched on the preview (the files are the site's
  own): SUBJECT on a drawn picture of a dark shape on a light ground gives a mask covering the shape within a tolerance and not the ground;
  REFINE WITH DEPTH still offered; the brush fixes it; (c) ERASE with the pack: a drawn blemish on a flat ground is gone within a threshold of
  its neighbours; UNDO brings it back; the export at full size carries the erase; BRAIN ERASE still offered; (d) RAW (if shipped): a small
  DNG fixture the spec writes (a tiny linear DNG the reader can open) opens, the sliders move a sampled pixel, EXPORT ORIGINAL gives the bytes
  back equal; if not shipped, the "I can't open RAW yet" line and nothing else; (e) REMOVE frees the pack with the size said, and SUBJECT
  falls back with its line; (f) offline: GET waits and says so; (g) every control 44 pt, nothing sideways, BODY 21 clips nothing.
- photoedit, photo, offlineeyes, offline2, lens, hubcards, deck, nav, speed2, look, ink, thescan unchanged unless a fix lives in a screen
  they own (offlineeyes gains the new pins).

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`. Preview on port 8836:
`(nohup setsid node tests/preview-server.mjs 8836 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8836.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call. Specs from the worktree ROOT: `BASE=http://localhost:8836 timeout 600 node tests/<name>.spec.mjs tests/.shots` (photo2 and
photoedit WITHOUT NO_GL_SHOTS; the rest with NO_GL_SHOTS=1). In the foreground, alone, one after another: photo2, photoedit, photo, offlineeyes,
offline2, lens, hubcards, deck, nav, speed2, look, ink, thescan. The brain tests once at the end. A timing budget missed under load is rerun
alone before it is called red. Known sandbox reds not touched: direct, aim, radio, scroll, safari, eye's own screenshot, tabs2, talk's cooling
lines. Vendored model files are committed in parts under 25 MB each with their licences; nothing else large is committed; tests/.shots removed
after every run.

## The owner's phone check

1. PHOTO, a photo of a mug on a table, SUBJECT: the first cut, then GET the cut-out model (the size said, Wi-Fi): the cut again. Better?
2. Paint over a mistake with the brush. Darken only the background through the mask.
3. ERASE: GET the erase model (the size said); brush over a mark on the table: gone? Compare BRAIN ERASE on the same mark.
4. Share a RAW from a camera (or a DNG from a phone that shoots them): does it open, and does EXPORT ORIGINAL give the RAW back?
5. Settings, offline packs: REMOVE the cut-out model: SUBJECT says it is back to the first cut.
6. Aeroplane mode: GET waits and says so; everything already kept still works.

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/photo2-report.md: each model's name, source, licence and
measured size (written BEFORE it was vendored), what was tried for RAW and whether it shipped, the cut-out's and the erase's times on the
preview, each spec's last line (before and after for the new ones), found-not-fixed, NEEDS HIS WORD (the test's name in the list), the phone
check as above, the commit list. One commit per step on builder/photo2; the orchestrator squashes to one on landing.
