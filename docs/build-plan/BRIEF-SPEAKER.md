# BRIEF: THE REAL SPEAKER MODEL FOR HIS VOICE (STARS 171; AUDIT-8-NOV item 18)

AUDIT-8-NOV item 18 (line 53): "HIS VOICE KNOWN: built as a courtesy signal with no model; the real speaker model is STARS 171".
STARS 171 says what it is: a small speaker-embedding model run on the phone, a download on his tap with its size said (the pattern
of the face models and the Lens's packs), a licence checked before it is picked, replacing the phone's own audio features behind
the same `judge`, the same store, the same labels. OWNER-ISSUES 152 built the courtesy signal with no model and asked for his phone
check first. The owner's rule, in his words, which nothing here bends: "faces and voices only me and people I introduce, kept on
the phone, never a stranger identified, and my voice is never a lock on its own". Read first: STANDARD.md, BRIEF-VOICE-KNOWN.md,
BRIEF-OFFLINE-1.md (the pack rule), apps/web/src/assistant/{voiceprint,voiceknown,voicestore}.ts, features/settings/{voiceknown,packs}.ts,
offline/{pack,eyes}.ts, vision/faces.ts (the pattern: a model on the phone, a stand-in for the specs, numbers kept in IndexedDB).
The mid tier. Start from the session branch.

## What is fixed

1. **A SPEAKER MODEL ON THE PHONE.** A small free speaker-verification model (a 26 MB network that turns a few seconds of speech into
   256 numbers), vendored in `public/vendor/speaker/` with its own worker (the ONNX runtime the namer and the faces already run
   on, one thread), its licence file and its source named in that folder's README as the licence requires. It is named in code and
   words by what it does ("the voice model", "tells voices apart"), never by a vendor's or product's name. It is kept on the phone as
   a PACK by the pack rule (offline/pack.ts): offered in Settings with its size said (`Get · 27 MB`), fetched only on his tap, on
   Wi-Fi, STOP, DELETE in one tap with UNDO. No key, no cost, no signal needed once it is here.

2. **ENROL.** SETTINGS → VOICE & HOME → MY VOICE: he speaks the three short lines. With the model on the phone each line's sound
   becomes an embedding (the pure filterbank in `assistant/speakerfbank.ts`, then the model); the three embeddings and their
   centroid are kept in the same IndexedDB record as before (`ghosty-voices`), beside the old features, never a recording, never
   sent, in no backup. Without the model the enrolment is the old one, unchanged.

3. **RECOGNISE.** When he speaks, the sound is embedded and scored (cosine) against his centroid and against each person he has
   introduced (each with them present and saying yes aloud, as faces do). The result is the quiet signal that exists: "YOU" /
   "<NAME>" / "A VOICE I DON'T KNOW" on the talk bar and the same label in the brain's context. The brain may use it as a courtesy
   (greeting, who is speaking). It fails closed: too little voice, a score between the accept line and the reject line, and two
   voices that both claim it are all "a voice I don't know". A stranger is never identified, never searched, never given a name.
   When the model is not loaded (not fetched, no Wi-Fi, a phone that cannot run it) the signal that exists today runs, unchanged.

4. **NEVER A LOCK.** Nothing unlocks, confirms, pays or approves on the voice alone. The confirm paths (the approval card's
   APPROVE, the house's guarded set, spending, drafts) never read the speaker score; a test proves it twice: the source of every
   such path does not import the voice modules, and with his voice scored as him at the highest score the page can give, an approval
   still waits for the tap and the brain's `/approve` is never called until it. The screen says so (it already does).

5. **DELETE.** MY VOICE → DELETE removes the embeddings with the rest of the record at once, with UNDO that puts it back as it
   was; a person's voice is forgotten by name the same way; deleting the voice model pack is its own DELETE with UNDO and leaves the
   voices as they were (the courtesy signal falls back to the features).

6. **THE LOOK.** tokens.css and THE SYSTEM in styles.css only; the ratchet's ceiling holds (hex 506, rgba 1016, radiusPx 470, total
   1992: equal or lower); the new panel is the pack rows the other packs use; works in The Scan, Glass and ONE INK at 440 × 956
   (and 390), every key 44 pt.

## What must not change

The prompt guard (never raised); the CI guard job and `.github/*` but the one `all=` word (`speaker`, last); the protected files
(apps/edge/src/agent.ts, index.ts, tools/{index,types,repo}.ts, apps/*/package.json: no new package); the confirm taps; the face
module and the Lens; the eyes packs (the four stay four: the offline eyes spec counts them); no key, no cost, nothing downloaded
but on his tap on Wi-Fi with the size said; no stranger named; no vendor's model name in code, comments, tests, docs or commits;
voice.spec, talk.spec, faces.spec, guardian.spec, settings.spec and the offline specs keep their checks.

## Tests (each fails on the code before this brief)

1. `apps/edge/test/speaker.test.mjs` (pure, in the brain's run through speech.test.mjs): the filterbank has the shape the model
   takes (frames × 80, centred), the same input gives the same numbers; the embedding judge: his own voice is him, another
   introduced person is her, a third is "a voice I don't know", two claimants, a middle score and too little voice are all unknown;
   a hurt record is no voice; the enrolment keeps embeddings in the old record's shape; the source of every confirm path does not
   mention the voice modules; no vendor name anywhere.
2. `tests/speaker.spec.mjs` (Chromium, the model's fetches stubbed by route, the embedding stood in by a fake path, the audio from
   fixture buffers): the pack is offered with its size said and nothing is fetched by looking; GET fetches only on the tap, STOP,
   DELETE with UNDO; enrol with three lines is kept in IndexedDB as 256 numbers each and nothing of it on the network or in
   localStorage; his voice is YOU, a voice introduced with her yes is her name, another is "A VOICE I DON'T KNOW" and held for GO ON;
   with the model removed the old signal runs; the approval waits for the tap with his voice scored as him; DELETE and UNDO; the
   screens in all three worlds at 440 × 956, 44 pt, nothing sideways, no page errors.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; results to the scratchpad file)

The build (`cd apps/web && npx tsc --noEmit -p . && node build.mjs`); the brain tests (about ten minutes, in the background); then
speaker, voice, talk, faces, guardian, settings, lens, offlineeyes, onphone, independence, undo, thescan, ui, deck, nav and the rest
of the `all=` list as time allows, each in the foreground against the preview on PORT 8805 only, each one's last line kept.

## The owner's phone check (in plain terms)

Settings, VOICE MODEL: tap Get on Wi-Fi (27 MB). MY VOICE: introduce your voice with the three lines. Say hello: the bar says YOU.
Hand the phone to someone and let them speak: it says "A voice I don't know" and asks before it goes on. Ask it to do something
that needs your tap (send, pay, unlock) by voice alone: it asks for the tap and does nothing until you give it. Delete your voice:
it is gone, and UNDO brings it back. Add someone only with them there, saying yes.

## Report

speaker-report.md in the scratchpad: every commit's hash and one line; the model (what it does, source, licence, size said); how
enrol, recognise, the never-a-lock proof and delete work, each with its test; each spec's last line and verdict; NEEDS HIS WORD;
the phone check; what was not run.
