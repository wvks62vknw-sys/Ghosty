# BRIEF: OFFLINE MAPS AND OFFLINE EYES (offline pass 1) — the map for his area and the Lens's eyes, kept on the phone on his tap

AUDIT-8-NOV item 6 (line 41): "PLAN 5: offline voice, translation, maps, offline Wikipedia and semantic search. Exists: translation,
Wikipedia, semantic search. Missing: offline maps for his area and offline eyes." STATUS.md names it among the older items ("offline maps for
his area and offline eyes, Pass 4; offline Wikipedia is live"); STARS 31 ("The Library offline ... usable with no signal, fast") and 85
("Offline-first for his own data") are the rule it serves. PLAN.md section 5 lists it under Wave E and F. The shape of a pack is the one
WIKIPEDIA, OFFLINE set (wiki/files.ts, wiki/store.ts, wiki/view.ts) and the offline brain's pieces (offline/fill.ts): offered with its size said,
fetched only on his tap, on Wi-Fi, after the space is checked, in pieces that survive a close, kept in the Cache API where the service
worker never clears them, deleted in one tap with UNDO. Read first: those three, offline/pack.ts once it is written (the one rule), ui/map3d.ts and
ui/mapsheet.ts (the map and the journey's sheet), vision/models.ts (how the Lens's models are fetched), public/vendor/VISION.md (what each model is
and its licence), public/sw.js, features/settings/offline.ts (where an offline thing is mounted). The mid tier. Start from the session branch.

## What is fixed

1. **ONE PACK RULE, in one file (offline/pack.ts), for both packs and for any later one.** A pack is a list of files (an address, a key, a
   byte count), a name, one line of what is in it and its licence. It is offered with its size said (`Get · about 78 MB`, never a bare button);
   it is fetched ONLY on his tap; on mobile data it says so and waits for Wi-Fi (`You are on mobile data, and <pack> is <size>: it waits for
   Wi-Fi. Join Wi-Fi and it starts by itself.`; Safari never says, so the words ask for Wi-Fi); the phone's space is checked first (`This phone
   gives Ghosty ... Nothing was downloaded`); each file is checked (a reply that is not ok, or empty where bytes are known, stops it with the
   packs' own words, `Tap GET again on Wi-Fi: it carries on from there.`) and kept as its own entry in the Cache API under
   `ghosty-maps-v1` / `ghosty-eyes-v1` (names the service worker never clears: it clears only `ghosty-shell-` and `ghosty-vendor-` ones); a log in
   localStorage before each file means a close loses at most the files in flight, and GET again carries on from the files missing; STOP; DELETE
   with UNDO; "<name>, <month>, <size> on your phone" once it is here; a pack that lost files (iPhone clears space when it runs low) says so
   by name. The words are the Wikipedia pack's, not new ones.
2. **THE MAP FOR HIS AREA (offline/maps.ts).** OpenFreeMap's vector tiles (the very source the 3D map already draws from, no key, no cost; the
   data is OpenStreetMap's, ODbL, the schema and the style are OpenFreeMap's and OpenMapTiles', credited on the map as it is online) for the
   West Midlands (Wolverhampton to Coventry, Sutton Coldfield to Solihull: west -2.25, south 52.33, east -1.40, north 52.70), every tile from zoom
   0 to 14 (14 is the most the source has; the map draws further in from it), the DARK style's own sheet, sprites and the letters its labels use
   (the Latin ranges of its one typeface), and the shaded relief it lays under zooms 0 to 6. About 78 MB (1,625 tiles of zooms 0 to 14 at their measured weight), said as "about" on the button
   because a tile's size is the server's. The 3D map, the flat map's replacement and the journey draw from it when the phone is offline.
3. **THE MAP, WHEN THE PHONE IS OFFLINE.** With the pack here and no signal, the sheet's MAP and 3D views both draw from the pack (the flat
   map's tiles come from servers that would be asked; MAP shows the pack's own map, flat, with the pins and the line of the journey), and a quiet
   line says `Offline: drawn from the West Midlands map on this phone.`; outside the area it says `Outside the map on this phone: the West
   Midlands only.`; with no pack and no signal it says so and where to get it (`No signal, and the map is not on this phone: Settings, OFFLINE
   MAPS, on Wi-Fi.`). With a signal nothing changes: the live map, as today. A pin's address needs a signal and says so.
4. **THE EYES, AS PACKS (offline/eyes.ts, the pinned files in offline/eyesfiles.ts).** The files the Lens loads from this site (public/vendor),
   kept on his tap in four packs with their sizes said: THE LENS'S EYES (the vision runtime, the object finder, the scene classifier, the hand
   recogniser, the reader of printed words and the barcode reader, 47 MB), THE NAMER (its runtime, encoder and names, 42 MB), PEOPLE HE KNOWS (the
   two face models and the runtimes they run on, 38 MB: faces still only him and the people he introduces, numbers on the phone, never a stranger),
   MEASURE'S DISTANCE (the distance model, 50 MB). A runtime two packs share is fetched once and kept while either is here. Each file's size is
   pinned and tests/offlineeyes.spec.mjs holds the pins to the files. A pack here marks the steps the Lens takes by itself on a phone that
   has fetched them (GET THE EYES, the namer), and the Lens's GET keys work with no signal when their files are here. What cannot run on the
   phone is said, never pretended: ASK about a picture, the plant, bird and insect names and a meal's contents need a signal and the panel lists them.
5. **WHERE.** SETTINGS, under the offline brain: two panels, OFFLINE MAPS and OFFLINE EYES (one section pill, `Voice & home`, already matches
   `OFFLINE`), each pack a row: name, one line, size, licence, GET or DELETE, the progress and the failure said in the row.
6. **SIDE ITEM: look.spec's "second open" (300 ms) went over on the two-core runner (675 and 783 ms).** The cost in the second open of the look
   page is found and taken out; the budget stays 300.

## What must not change

The prompt guard; the CI guard job; `.github/*` but the one word after `all=`; `apps/*/package.json`; the kernel files (agent.ts, index.ts, tools
index/types/repo); no packages, no new keys, nothing that can cost money; the brain never gets live GPS (the map draws his position on the
phone only; no tile, pack or line here carries it, and nothing of the pack goes to the brain); downloads only on his tap on Wi-Fi with the size
said; never a vendor's model name in anything new (the on-device models are named by what they do); the ratchet (hex 506, rgba 1016, radiusPx 470,
total 1992: equal or lower; new drawing uses THE SYSTEM's tokens and classes); the three worlds (The Scan, Glass, ONE INK) at 440 x 956 and
390 x 844 with nothing sideways and every key 44 pt; with a signal the map, the journey, places and the Lens behave exactly as today.

## Tests (each fails on the code before this brief)

tests/offlinemaps.spec.mjs: the pack is offered with its size (about, in MB) and its licence; a tap on mobile data fetches nothing and says it
waits; a tap on Wi-Fi fetches (every address stubbed by route: tiles, sheet, sprites, letters, relief) the pieces in order, stops and carries on from where it
stopped, then says `<name>, <month>, <size> on your phone`; offline the 3D and MAP views draw from it (the map's own canvas, the quiet line, the
pack's tiles asked for and no live address); outside the area the line says so; DELETE with UNDO; no pack, no signal: the line says where to get it;
three worlds at 440 and 390: nothing sideways, 44 pt. tests/offlineeyes.spec.mjs: three packs offered with sizes; the rule (mobile data waits, a
failed file says where it stopped and carries on, space checked); kept in `ghosty-eyes-v1` and found by the model loader with no signal; the Lens's
GET key is live offline once its files are here and says what cannot run (the app is reloaded with the browser's own offline mode, so only what the
service worker and the packs hold can load); DELETE with UNDO; the shared runtime kept; three worlds. The tile arithmetic (offline/mapmath.ts) and the
pinned file sizes (offline/eyesfiles.ts) are bundled and checked inside the two specs (apps/*/package.json is protected, so no new brain test file is
listed there).

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; results to the scratchpad file)

`cd apps/web && npx tsc --noEmit -p . && node build.mjs`; the brain tests (nothing in the brain changes: say so); the preview on PORT 8800; the new
specs; then every spec in `all=` one at a time. look.spec before and after the side item (the second open's median of five).

## The owner's phone check

(1) On Wi-Fi: Settings, OFFLINE MAPS: the size is on the button; tap GET; it counts pieces; it says the map is on your phone. (2) Settings, OFFLINE EYES:
GET the Lens's eyes (and the namer, the people and the distance model if you want them). (3) Flight mode on. (4) Open God's Eye, then MAP or 3D: Birmingham draws, labels and all, with a
quiet line saying it is the map on this phone; pan to Coventry and Wolverhampton; the journey's map draws its pins and line. (5) Open the Lens, START: the
finder, the words and the codes work with no signal; ASK says it needs one. (6) DELETE either pack: it goes, with UNDO.

## Report

scratchpad offline-report.md: every commit's hash and one line; the two packs (source, licence, size, where kept, what works offline and what says it
cannot); the look.spec cost with before and after; each spec's last line and verdict; NEEDS HIS WORD; the phone check. Never push; never a protected file.
