# BRIEF: THE FULL EDITORS, THE SIXTH: PHOTO — a real, non-destructive photo editor

BRIEF-EDITOR-PHOTO (PROGRAMME-EDITORS section 6; OWNER-ISSUES 127 "i want the full editors", 164, 176 "do all of it", 178 "insane quality";
QUEUE-11-NOV item 7). The PHOTO TOOLS that exist (features/lens/photo.ts: BACKGROUND, SHARPER, ERASE through the brain's free Hugging Face
Spaces, apps/edge/src/photo.ts) stay as they are and become three keys inside this editor; everything else here runs on the phone. One
builder, one PR. Start from the session branch. Read STANDARD.md, PROGRAMME-EDITORS.md (its rules for every workspace), BRIEF-EDITOR-DOCUMENTS.md
and BRIEF-EDITOR-SPREADSHEETS.md (the shape every editor matches: the MAKE entry, the store, the Stage OPEN hand-over, the export sheet with
the size said, the autosave rule), `apps/web/src/features/lens/photo.ts`, `apps/web/src/vision/camera.ts` (loadImageFile, drawScaled,
toJpegBlob), `apps/web/src/convert/run.ts` and `convert/exif.ts` (how a picture is decoded with its way up, and the HEIC line), `apps/web/src/
offline/eyes.ts` and `eyesfiles.ts` (the Lens's models kept on the phone: the object finder and MEASURE'S DISTANCE, the depth model), `tests/
photo.spec.mjs`. THE QUALITY RULE holds (every state designed, every word his, every wait said, every number honest, every control 44 pt,
nothing merely fine).

## His words
"no i don't agree with you, i want the full editors" (4 Nov). The product it stands in for is a real photo editor's core (Lightroom's
develop module and Snapseed's tools): a photo graded with exposure, white balance, curves and colour, a part of it changed through a mask,
a blemish healed, a crooked horizon straightened, a look saved and applied to twenty photos at once, before and after under the thumb,
and the original never touched.

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Protected files, not edited: apps/edge/src/agent.ts, apps/edge/src/index.ts, apps/edge/src/tools/{index,types,repo}.ts, .github/* (except the
one spec word at the END of check.yml's `all=` list; the guard job untouched), apps/*/package.json. No package, nothing fetched at build time:
the pipeline is the app's own WebGL2 code (below). No face recognition and no face editing: nothing here looks for or changes a face (the
PHOTO TOOLS' own rule, kept). A photo never leaves the phone except by the three brain keys he taps (BACKGROUND, SHARPER, ERASE, as today,
each saying so before the first tap).

## The engine (the app's own, no package)

- **The recipe (apps/web/src/photo/recipe.ts, pure):** an edit is a recipe over an untouched original: crop and straighten (angle, the
  crop rectangle, a flip), perspective (four corners), lens (barrel k1), the light (exposure in stops, contrast, highlights, shadows, whites,
  blacks), white balance (temperature and tint as a matrix), curves (a luminance curve and one per channel, up to six points, monotone
  cubic), colour (vibrance, saturation, eight HSL bands with hue, saturation and luminance each), detail (sharpening as an unsharp mask with
  amount, radius and threshold; noise reduction as an edge-keeping blur with its strength), effects (vignette, grain with a seed so an export
  equals the screen, a fade), masks (a linear gradient, a radial, a brush painted at the screen's size and kept as a small alpha picture, a
  SUBJECT mask made on the phone from MEASURE'S DISTANCE's depth and the object finder's box where those packs are kept, said as "a first cut:
  paint to fix it"), each mask carrying its own light and colour adjustments, a second photo as a LAYER with a blend (normal, multiply,
  screen, overlay, soft light), its opacity and its mask, heal strokes (a source offset and a radius each, feathered: the app's own clone
  heal, no model), and the recipe's history (sixty deep). The maths lives in photo/math.ts (pure: the matrices, the curves, the HSL bands,
  the tone functions) so the brain test proves it on numbers and the pipeline and the CPU path agree.
- **The pipeline (photo/gpu.ts):** WebGL2 fragment passes over the original as a texture: geometry first (crop, straighten, perspective,
  lens), then the global grade, then each mask's grade, then the layer, then detail, then effects; the screen draws at the screen's size
  (fast on the phone: measured frame time said), an export draws the full picture in tiles no wider than the phone's texture limit (read with
  MAX_TEXTURE_SIZE, said in the report) and stitches them, so a 12-megapixel photo exports at 12 megapixels. Where WebGL2 is missing or lost
  (the context lost mid-edit), a CPU path (photo/cpu.ts, the same maths over ImageData, slow and said so: "Drawing this the slow way…")
  gives the same picture within one unit per channel; the spec compares them.
- **The store (photo/store.ts):** the original bytes kept untouched in the phone's own database (IndexedDB, the documents' pictures'
  shape), the recipe beside it, a thumbnail for the shelf; ten originals at full size at most and about 150 megabytes, the oldest let go
  first and said by `room()`; a photo's recipe exports as a PRESET (ours: eight looks in his words, never a brand's name; his own saved
  with a name) and a preset applies to many photos at once (BATCH: pick several, one look, EXPORT ALL with the total size said).
- **What is honest, not here:** RAW files need a decoder the app does not have (a WASM build of an LGPL library would be a download with
  its size): NEEDS HIS WORD, named in the report; a RAW shared in is said as "I can't open RAW yet; a JPEG or HEIC of it works". HEIC opens
  where the phone's own browser decodes it (Safari does; the convert's line says the rest). A true matting model for SUBJECT and an
  inpainting model for ERASE on the phone are downloads (sizes measured and named in the report as NEEDS HIS WORD); until then SUBJECT is the
  depth-and-box first cut and ERASE is the brain's, as today.

## The screen

MAKE → PHOTO (the SIXTH editor: if MAKE already holds ten things on the base, this card folds the editors under one EDITORS card exactly as
BRIEF-EDITOR-WORKSPACE says; whichever of the two lands second resolves it the same way; hubcards.spec learns the fold as the proof). The
catalogue entry; "edit a photo" and "my photos" in the chat; the Lens's PHOTO TOOLS chip opens this editor on the photo with the three brain
keys among its tools; the Stage's OPEN on a picture answer offers EDIT IT. The shelf: his edited photos as thumbnails, newest first, OPEN A
PHOTO (his photos, the library's share path, the Shortcuts' `?add=`), BATCH. The editor: the photo filling the width, pinch to zoom, a
two-finger drag to pan; the tools as pills along the foot in groups (LIGHT · COLOUR · CURVES · DETAIL · CROP · MASKS · HEAL · LAYER ·
EFFECTS · BRAIN); a tool opens its sliders in a tray above the pills, each slider 44 pt tall with its value said ("+0.7 stops", "5,200 K",
"amount 40") and reset by a double tap; CURVES as a drawn curve with points dragged by a finger (44 pt handles) and a channel picker;
MASKS lists the masks with their own trays, a brush size dial, SHOW THE MASK in red, INVERT; HEAL as a tap on the blemish with a size dial
and a source handle to move; CROP with ratios (free, 1:1, 4:5, 3:2, 16:9, 9:16), a straighten dial with a level line, ROTATE and FLIP;
BEFORE under a press-and-hold anywhere on the photo (said once: "Hold the photo to see the original"); UNDO / REDO; HISTORY as a list of
steps, tap to go back; PRESETS as a strip of thumbnails of this photo under each look; EXPORT (JPEG at a quality dial with the size said
before, PNG, the original back out unchanged) and SHARE; SAVE A PRESET. Autosave said once ("Saved" fading in the truth style); reopen
where he was. Every state in his voice: the empty shelf (one line and OPEN A PHOTO), a photo that would not open (the convert's own line),
a RAW, WebGL lost ("Drawing this the slow way…"), the store full (the oldest named), the SUBJECT mask's first-cut line, a brain key with no
signal ("needs the brain; everything else here works without it"), a batch mid-way with its count. GLASS, THE SCAN, ONE INK and the HUDs
each wear it.

## The benchmark (PROGRAMME-EDITORS 6; timed on the preview and said in the PR)

A 12-megapixel JPEG (the spec draws one, 4000 × 3000, with a gradient sky, a tilted horizon and three dark blemishes) opened, straightened,
graded (exposure, white balance, a curve), the sky darkened through a gradient mask, the three blemishes healed, a look saved as a preset,
applied to four more photos in BATCH, and exported at full size with the original bytes read back byte-equal: the time for each step and the
export's size said; the GPU and CPU paths within one unit per channel on a 64 × 64 sample.

## Tests (each fails on the code before this brief; run against it once and say so)

- apps/edge/test/photoedit.test.mjs (new; imported from an existing test file as kernel-yes was, one import line, since the test list is
  protected; NEEDS HIS WORD names it): the maths against known values (a white-balance matrix's neutral grey; an exposure stop doubling;
  a curve through its points, monotone; the HSL band weights summing to one; the vignette's centre untouched); a recipe's history depth and
  undo; a preset applied to a second recipe keeping that recipe's crop; the store's `room()` words; the CPU path's picture for a tiny image
  against hand-computed pixels.
- tests/photoedit.spec.mjs (new; `all=` word `photoedit` at the END of the list in check.yml, nothing else in .github touched), at 440 and
  390: (a) MAKE → PHOTO in two taps (through EDITORS if folded); "edit a photo" opens it; (b) the empty shelf's words; a photo opened; (c)
  each slider moves a sampled pixel the right way (exposure up brightens; temperature warm reddens; a curve point lifts the midtones); a
  double tap resets; (d) CROP and straighten change the drawn size and angle; a ratio holds; (e) a gradient mask darkens the top sample and
  not the bottom; a brush stroke shows red under SHOW THE MASK; SUBJECT says its first-cut line; (f) HEAL removes a drawn blemish (the sample
  within a threshold of its neighbours); (g) a LAYER with multiply darkens; (h) hold shows the original and release returns; UNDO / REDO /
  HISTORY; (i) a preset saved and applied; BATCH on three with EXPORT ALL and the total size said; (j) EXPORT JPEG with the size said before,
  the file's dimensions equal to the original's, and the original back out byte-equal; (k) WebGL forced off: the slow line shown and the
  picture equal within one unit on a sample; (l) the Lens's PHOTO TOOLS chip lands here with the three brain keys and their offline line;
  (m) autosave said once and the recipe reopens; (n) BODY 21 clips nothing, every control 44 pt, nothing sideways.
- photo (the brain keys), lens, showme, speed2, look, ink, thescan, hubcards, deck, nav unchanged unless a fix lives in a screen they own.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`. Preview on port 8831:
`(nohup setsid node tests/preview-server.mjs 8831 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8831.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call. Specs from the worktree ROOT: `BASE=http://localhost:8831 NO_GL_SHOTS=1 timeout 600 node tests/<name>.spec.mjs tests/.shots`
(this spec needs GL for its samples: run it WITHOUT NO_GL_SHOTS and say the machine's software GL makes it slow); a nogl copy as `tests/.<name>.
nogl.tmp.mjs` is never committed. In the foreground, alone, one after another: photoedit, photo, lens, showme, speed2, look, ink, thescan,
hubcards, deck, nav, layout. The brain tests in the background once at the end. A timing budget missed under load is rerun alone before it
is called red. Known sandbox reds not touched: direct, aim, radio, scroll, safari, eye's own screenshot, tabs2, talk's cooling lines. The
benchmark's 12-megapixel picture is drawn by the spec and deleted after; nothing large is committed.

## The owner's phone check

1. MAKE, PHOTO: open a photo from your camera roll (a HEIC). Does it open at once, the right way up?
2. LIGHT: exposure and shadows; COLOUR: warm it; CURVES: lift the midtones with one finger. Hold the photo: the original.
3. CROP: straighten a crooked horizon with the dial; 4:5. MASKS: a gradient over the sky, darker; SUBJECT: how good is the first cut?
4. HEAL a spot. LAYER: a second photo, multiply, half. EFFECTS: a little grain.
5. SAVE A PRESET; BATCH it onto five photos; EXPORT ALL: the size said first; the photos in Photos at full size.
6. EXPORT one as JPEG at the quality you like; share it. The original back out: unchanged.
7. BRAIN: BACKGROUND on one; aeroplane mode: what does the BRAIN group say, and does everything else still work?
8. Does it feel like a photo editor or like filters on a picture? Say which, and the one slider that feels wrong.

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/photoedit-report.md: what was built, the pipeline's passes,
the texture limit and the tiling, the benchmark's times and the export's size, the GPU-against-CPU difference measured, each spec's last line
(before and after for the new ones), found-not-fixed, NEEDS HIS WORD (the test's name in the list; RAW through a downloaded decoder with its
licence and size; a matting model and an inpainting model with their sizes; a `photo` tool), the phone check as above, the commit list. One
commit per step on builder/photoedit; the orchestrator squashes to one on landing.
