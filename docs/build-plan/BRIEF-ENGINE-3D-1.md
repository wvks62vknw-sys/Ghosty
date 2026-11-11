# BRIEF: THE 3-D ENGINE, FIRST WORKING SLICE (engine 3-D pass 1) — a scene he builds with his fingers, a library, a file out

His words: OWNER-ISSUES 127 ("i want the full editors": video, RAW photo, Word, PowerPoint, Excel, Notion-style workspace, game studio,
"3-D engine with product library"); 164 ("all of this needs to be built with the 40% we have left", the engine before the other editors);
AUDIT-8-NOV item 16 (line 51: "Not built") and PROGRAMME-EDITORS.md section 1 (the engine, its library, its benchmark: "place,
measure, modify and export a furnished room in under five minutes on the phone"). This pass is the first working slice of that
engine and nothing larger: the editor, the library's first shelves, save, export, and the SHOW ME door into it. Physics, USDZ, the
cross-section, the exploded view and the model-intelligence turns are the next passes and are named at the end. The mid tier.
Start from builder/engine3d (base 32d717e, main's tree). Read STANDARD.md first, then this, then BRIEF-SHELL-2.md (the shape of a
brief), BRIEF-SHOW-ME-1.md (the Stage and its parametric parts), BRIEF-REST-D.md (the pane this one copies: DESIGN A BUILD).

## What the code already has (read it; this pass reuses it)

- The 3D STUDIO (apps/web/src/features/studio/index.ts, MAKE) with panes and a segmented bar; CAR · FIX IT and DESIGN A BUILD are
  panes that put a stage of their own over the studio's view (apps/web/src/build/pane.ts, scene.ts). The engine is one more pane,
  not a new screen: a new screen would change the pinned lists of tabs, deck, nav, hubcards and awareness specs for no gain.
- three.js vendored at public/vendor/three, typed by hand in apps/web/src/studio/three.ts (loaded only when the studio opens).
- Parametric parts: apps/web/src/show/parts.ts (`partBoxes`, `PARTS`: desk, table, shelf, bed, sofa, wardrobe, chair, stool,
  bench, cabinet, from width, depth and height in cm); `roomAsked` / `partAsked` read "a room 4 by 3 with a desk".
- The catalogue of free models: packages/shared/src/models3d.ts (Objaverse's CC0 and CC BY 4.0 subset with each model's size in kB,
  Poly Haven CC0), apps/web/src/features/studio/catalog.ts (`fetchModel`, `keep`, `keptFile`: the phone's own shelf in IndexedDB).
- The Stage's OPEN key (apps/web/src/show/stage.ts `open`) already hands a room or a part to the studio's ROOM pane.

## What is fixed

1. **A SCENE.** `apps/web/src/engine3d/scene.ts` (pure): a scene is `{ v:1, name, ground:{w,d}, objects[] }`, every length in cm.
   An object is `{ id, kind, name, x, y, z, rot, w, d, h, mat, model? }`: x, z the centre of its footprint on the ground (from the
   ground's middle), y its base height, rot degrees about the vertical, w, d, h its size, mat one of the palette. Kinds: `box`,
   `cylinder`, `sphere`, `plane`, the ten parametric parts of show/parts.ts, and `model` (a downloaded free model). Operations
   (add, move, turn, resize, material, rename, duplicate, remove) are pure functions returning the next scene; the pane keeps an
   undo and redo stack of whole scenes. A scene read from storage or a file is validated (`readScene`): sizes clamped to 1 cm to
   20 m, unknown kinds dropped, at most 300 objects.
2. **A CAMERA HE ORBITS, PANS AND ZOOMS BY TOUCH.** `camera.ts` (pure): yaw, pitch, distance, target; one finger on empty ground
   or an unselected thing turns it, two fingers pinch to zoom and drag to pan, the wheel zooms; pitch kept between 6 and 86 degrees,
   distance between 0.5 and 60 m; FRAME fits the scene. The same file projects a point to the screen and casts a ray from a touch.
3. **PLACED BY TAP, MOVED, TURNED AND SCALED BY HANDLES.** A library card arms it ("tap the ground to put the desk there"); the
   tap puts it there (snapped to 5 cm) and selects it. A selected thing shows its handles (`edit.ts`, pure): MOVE (drag the thing
   on the ground), TURN (a ring: drag round it, snapped to 5 degrees, so every quarter turn is held), SIZE (a knob at the width
   end, the depth end and the top: drag along the axis). Each handle is at least 44 pt to hit (the pick radius is in screen pixels).
   The same numbers are typed in cm in the inspector (W, D, H, X, Z, TURN, HEIGHT OFF GROUND); a typed number and a dragged handle
   are the same operation.
4. **A PRODUCT LIBRARY.** Shelf one, PARAMETRIC: box, cylinder, sphere, plane and the ten parts, each with its stated default size
   in cm. Shelf two, FREE MODELS: the free, licence-clear models of the catalogue (CC0 or CC BY 4.0, from the Objaverse index
   the app already ships, public/data/models3d.json, furniture and home groups: the index holds only three CC0 models, so a CC0-only
   shelf would be empty; CC BY asks for credit, which travels with the object, the saved scene and the exported file), each row naming
   the model, its size in MB or kB, its licence and its author; a model is fetched ONLY on his tap on GET, never on opening the shelf or the pane; on mobile data
   (`navigator.connection` says cellular or save-data) the tap says it waits for Wi-Fi and fetches nothing; kept on the phone
   (the studio's IndexedDB shelf) so a saved scene reopens without a second download; removable. The credit line travels with
   the object, the saved scene and the exported file.
5. **MATERIALS FROM A SMALL PALETTE.** Nine: oak, walnut, white paint, stone, charcoal, sage fabric, navy fabric, steel, glass;
   a swatch row in the inspector; the choice is saved and exported (glTF base colour, metallic, roughness, alpha).
6. **SAVE AND REOPEN ON THE PHONE.** The scene in front of him is kept as he works (a 200 ms save, localStorage
   `ghosty.engine3d`) and comes back where he left it; SAVE names it into a list, OPEN brings one back, DELETE removes one
   (with the undo bar). Nothing leaves the phone.
7. **EXPORT TO glTF.** `gltf.ts` (pure, no library): a glTF 2.0 file (.gltf, one buffer embedded), metres, y up, one node per
   object with its name, a material per palette entry, the ground as a node; the spec reads the file back (JSON, accessor
   counts, bounds) and loads it with the vendored loader. Imported free models export their shapes and base colours, not their
   pictures, and the screen says so. The file's asset says it is a first estimate and carries every credit.
8. **A SHOW ME PATH.** "Show me a room 4 by 3 with a desk" (and a part: "show me a desk 140 by 70") already puts a picture on the Stage; its
   OPEN key now opens the engine pane with that scene: a 4 × 3 m ground, four walls, the desk, standing where the plan puts it.
   The studio's `open_studio` takes `engine` (a scene) for it. The pane's tools and the stage stay in view while the panel scrolls under them (the stage is sticky), so a library tap and the tap on the ground that follows are never a scroll apart. The ROOM pane keeps working for a room from the Space planner.
9. **SAID ONCE ON SCREEN:** "Every size here is a first estimate, never certified." Nothing else on the pane claims engineering.
10. **THE LOOK.** tokens.css and THE SYSTEM in styles.css are the only look: the stage clears to `--g-canvas-rgb`, the ground, the
    selection and the handles read the accent and bone triplets at run time, so the pane follows The Scan (with its house), Glass
    and ONE INK (with its foot) with no colour of its own in CSS; every key 44 pt; nothing sideways at 440 × 956 and 390 × 844;
    Reduce Motion lands the camera. The ratchet (ceiling hex 506, rgba 1016, radiusPx 470, total 1992) holds: new rules go in
    THE SYSTEM, in tokens.

## What must not change

The prompt guard; the CI guard job; `.github/*` but the one word added at the end of the `all=` list; `apps/*/package.json` (so no
package: the exporter, the camera and the editing are written here and the renderer is the vendored three.js); the kernel and
brain files; no key, nothing paid; downloads only on his tap on Wi-Fi with the size said; every engineering number a first estimate,
never certified; never a vendor's model name anywhere. The other studio panes (MODELS, PARTS, CUT · MEASURE, MAKE · PHOTO, ROOM,
SPLINE, CAR · FIX IT, DESIGN A BUILD) behave exactly as today (studio, studiomake and restd specs prove it). knowledge.test flags
a comment starting `// ...` as a placeholder.

## Tests (each fails on the code before this brief)

`tests/engine3d.spec.mjs` (one word, `engine3d`, last in the `all=` list), at 440 × 956 with the pane's state read through
`window.__ghosty.engine3d` (WebGL screenshots hang in the sandbox: counts, sizes and the saved scene, not pixels):
1. The pane opens from the studio's bar; the one estimate line is on screen once; the scene has a ground and a camera.
2. A touch on the stage: one-finger drag changes yaw and pitch, a two-finger pinch changes distance, a two-finger drag pans.
3. Library tap arms, a touch on the ground places a desk (count 1, selected, snapped); the box, cylinder, sphere, plane and every
   part place; sizes typed in cm change the object's w, d, h exactly; a MOVE drag, a TURN drag and a SIZE drag (on the real handle
   at the screen point the engine reports) change x, z, rot and w by the amounts the camera maths says.
4. A material swatch changes the object's material; undo and redo walk back and forward.
5. FREE MODELS: opening the shelf lists the stubbed models with sizes and fetches nothing (the route counter stays 0); GET on
   mobile data fetches nothing and says so; GET on Wi-Fi fetches once, places the model with its stated size, keeps it; the
   credit line is on the object. Routes are stubbed; no real download.
6. SAVE names a scene; a reload brings the current scene back; OPEN brings the saved one back; DELETE removes it.
7. EXPORT: the file's JSON has a node per object and the ground, accessor counts and bounds that match the scene's cm sizes,
   a material per palette entry used, the credit in the asset; the vendored loader reads it and finds the same mesh count.
8. SHOW ME: with `__ghostyShow` on, "show me a room 4 by 3 with a desk" puts the Stage up, OPEN opens the engine pane with a
   400 × 300 ground and the desk; the part ask opens it with the part at its size.
9. The three worlds: The Scan (house along the bottom), Glass and ONE INK (with its foot): the pane is reachable, nothing
   sideways, every key at least 44 pt, no security-policy refusal, no page error.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each result to the scratchpad file)

1. `cd apps/web && npx tsc --noEmit -p . && node build.mjs`, after every commit.
2. Commit, then the brain tests (`cd apps/edge && PATH=$PWD/node_modules/.bin:$PATH npm test`, about ten minutes, in the
   background): the catalogue's words for the new pane and sample are the part of the brain tests this touches; the brain code is
   untouched (said in the report).
3. Commit, then the preview on port 8802 only, and the specs one at a time from the repository root with
   `BASE=http://localhost:8802 NO_GL_SHOTS=1 timeout 480 node tests/<name>.spec.mjs tests/.shots`: engine3d, showme, machine,
   studio, studiomake, deck, nav, tabs, ui, hubcards, look, routec, routec2, character, thescan, settings, layout, speed2, then
   the rest of the `all=` list as time allows (the sandbox's known reds are direct, aim, radio, scroll, safari, eye's screenshot
   and tabs2, which fails here on the base too). A timing budget missed under load is run again alone before it is called red.
4. `git status` clean before every commit (no screenshot, no tests/.*.tmp.mjs).

## The owner's phone check (about five minutes; say the step and what you saw if one does not match)

(1) MAKE, the 3D studio, the bar's last key: 3-D ENGINE. A ground, a tray of shapes, one line saying every size is a first
estimate. (2) One finger on the ground turns the view; two fingers pinch and slide it. (3) Tap DESK, tap the ground: it stands
there. Drag it; tap TURN and drag round it; tap SIZE and drag a knob; type 140 in W: it is 140 cm. (4) Tap a swatch: it changes
colour. (5) FREE MODELS: the list names each model, its size and its licence and downloads nothing; GET on Wi-Fi fetches one
and stands it in the room. (6) SAVE, leave, come back: it is there; OPEN brings a saved one back. (7) EXPORT: a .gltf file that
opens in any viewer or in AR Quick Look's own converter. (8) Ask Ghosty "show me a room 4 by 3 with a desk", tap OPEN on the
Stage: that room, in the engine. (9) The same in Glass and ONE INK: the pane wears each world.

## Not in this pass (the next passes of the engine, named so they are not forgotten)

Physics and collision (Rapier, Apache-2.0, WASM: a package, so it needs his word and the package files), groups and hierarchy,
exploded view and cross-sections (the studio already has them for models), measuring between two points, USDZ and PNG and PDF
plan export, shadows and textures, model intelligence as chat turns ("make it 20 cm wider"), Poly Haven on the FREE MODELS shelf
(its size is not known until it is packed, so it cannot say its size first), his own glTF imports on this pane (the MODELS pane
opens them today).

## Report

In the scratchpad file engine3d-report.md: every commit's hash and one line; what the engine does and the spec that proves each
piece; the free-models source and licence; each spec's last line verbatim with its verdict; NOT REACHED; NEEDS HIS WORD; the
phone check above. Never push. Never touch a protected file. Named by tier, never by model.
