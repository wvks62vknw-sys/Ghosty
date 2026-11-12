# BRIEF: THE FULL EDITORS, THE SEVENTH: VIDEO — the core of CapCut

BRIEF-EDITOR-VIDEO (PROGRAMME-EDITORS section 7; OWNER-ISSUES 127 "i want the full editors", 164, 176 "do all of it", 178 "insane
quality"; QUEUE-11-NOV item 7). The sixth editor, PHOTO (BRIEF-EDITOR-PHOTO, branch builder/photoedit), is the shape this one matches: an
untouched original in the phone's own database with a recipe beside it, the app's own WebGL2 pipeline with the screen drawn small and the
export drawn full, every state in his voice, the export sheet with the size said, the autosave rule. This one starts from the session branch
(not from the other editors' branches): its MAKE card counts as the ninth thing on its own tree, and because THE WORKSPACE builds the
EDITORS fold at eleven and PHOTO lands after it, VIDEO lands after PHOTO, its builder rebasing onto the fold first (its card becomes the
fold's sixth pill, one line in the pills' list) and the orchestrator landing only the diff above the rebased tip. One builder, one PR. Read
STANDARD.md, PROGRAMME-EDITORS.md (its rules for every workspace), BRIEF-EDITOR-PHOTO.md (the shape to match), BRIEF-REST-E (convert/audio.ts:
the WAV writer, the phone's own decoders, the vendored LAME as the one precedent for a vendored encoder), `apps/web/src/convert/run.ts` (the
phone's own picture and sound decoders, MediaRecorder's `isTypeSupported` check), then this. THE QUALITY RULE holds (every state designed,
every word his, every wait said, every number honest, every control 44 pt, nothing merely fine).

## His words
"no i don't agree with you, i want the full editors" (4 Nov). The product it stands in for is CapCut's core: clips on a timeline, trimmed,
split and ordered, with transitions, a title, a grade, music under it, his voice over it, subtitles, and an .mp4 out that plays anywhere and
posts anywhere (posting itself only with his APPROVE, as always).

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Protected files, not edited: apps/edge/src/agent.ts, apps/edge/src/index.ts, apps/edge/src/tools/{index,types,repo}.ts, .github/* (except the
one spec word at the END of check.yml's `all=` list; the guard job untouched), apps/*/package.json. No package may be added (the programme
names mp4-muxer; it is not added to package.json): the muxer is the app's own (below), and only if that file will not play in the preview's
browser by the benchmark is mp4-muxer (MIT, about 30 KB) vendored under apps/web/public/vendor/mp4muxer with its LICENSE beside it, exactly
as LAME was for MP3, and the report says which path shipped and why. Faces in a clip are never found, named or tracked by this editor (no
face code is called from video/*): a clip is pixels. Nothing of a clip leaves the phone except the audio of a clip he asks to subtitle, which
goes to his own brain's existing hearing route (apps/edge/src/speech.ts, the key it already has or Workers AI, no new key) in pieces of at
most 25 seconds, said once before the first piece goes ("Your clip's sound goes to your brain to be written down; nothing else leaves").

## The engine (the app's own, no package)

- **The project (apps/web/src/video/model.ts, pure):** a project is a list of tracks over a timeline in milliseconds: one main video track
  (clips laid end to end, no gaps: a clip is a source id, an in and out point, a speed from 0.25 to 4 held constant per clip, a volume, a
  transform with keyframes (position, scale, rotation, opacity: linear or eased between keyframes), a grade (the PHOTO recipe's light,
  white balance, curves and colour parts reused by import from photo/recipe.ts and photo/math.ts where PHOTO is in the tree, else the same
  six functions copied into video/grade.ts with a comment that names the source so the PHOTO landing dedupes them), an optional .cube LUT
  (parsed by the app's own video/lut.ts: 17 or 33 points, applied as a 3-D texture), a crop and an aspect (9:16, 1:1, 4:5, 16:9, the
  project's), and a transition into the next clip (cut, crossfade, dip to black, wipe, slide, each with a length)), up to two overlay tracks
  (a picture-in-picture clip with its own transform, or a TITLE: a text block with the design system's type, a position, in and out times,
  an appear and a leave (none, fade, rise)), audio tracks (the clips' own sound; MUSIC from his library's files; a VOICE-OVER recorded in
  place through the existing recorder as WAV; each with a gain, a fade in and out, and MUSIC ducking under the voice by a set amount), a
  subtitle track (cues: start, end, text, a position top or bottom, burned in at export and also written as .srt and .vtt), a chroma key per
  overlay clip (a colour, a tolerance, a softness), a mask per clip (rectangle, ellipse, feathered), and a history sixty deep. The maths
  (video/math.ts, pure: time mapping through speed, keyframe interpolation, the transition's weights, the ducking curve, the chroma distance)
  is what the brain test proves on numbers.
- **The store (video/store.ts):** the original clips' bytes kept untouched in the phone's own database (IndexedDB, the shape of
  library/local.ts), the project JSON beside them (saved 200 ms after a change, "Saved" fading once in the truth style), a poster frame per
  clip for the strip; about 600 MB of clips at most and the oldest project's clips let go first and said by `room()`; a project exports and
  imports as a .zip of its JSON and clips through convert/zip.ts with the size said.
- **The screen's player (video/preview.ts):** the preview draws through the phone's own `<video>` elements, one per source, seeking as the
  playhead moves and drawn into one WebGL2 canvas (video/gpu.ts: transform, grade, LUT, chroma key, mask, the transition's blend, the
  overlays, the title, the subtitle), at the screen's size for speed; a long clip (over two minutes) gets a PROXY the first time it is
  opened: a half-size copy made on the phone through the same export path at low bit rate, said once with its size and time, used for the
  strip and the scrub and never for the export. Scrubbing lands on the nearest decodable frame (the phone's seek); play uses the elements'
  own clocks kept within 40 ms of the playhead; audio in play is WebAudio mixing the elements' sound with the music and the voice (gains,
  fades, ducking).
- **The export (video/export.ts, video/mp4.ts):** two paths, the first chosen when the phone has it (checked once with
  `VideoEncoder.isConfigSupported` and `AudioEncoder.isConfigSupported`, said once in the export sheet which path this phone takes):
  (1) WebCodecs: frames drawn by the GPU pipeline at the export's size (1080p, 720p, or the source's; 30 or the source's frame rate) are
  encoded as H.264 (avc1 high at 1080p, baseline where high is refused, the bit rate from a table by size and a quality pick) and the mix
  rendered by an OfflineAudioContext is encoded as AAC (mp4a.40.2, 48 kHz, 128 kb/s), and the app's own muxer (video/mp4.ts) writes a flat
  .mp4 (ftyp, mdat, moov with one avc1 trak carrying avcC from the encoder's description and one mp4a trak carrying esds, stts, stsc, stsz,
  stco, the sync samples in stss, the durations right); (2) MediaRecorder on the canvas's captureStream with the mix as its audio track,
  in real time (said once as "made in real time: about N seconds"), in the type the phone's recorder supports (`isTypeSupported` picks
  video/mp4 first, else webm, and the sheet says the type). Both paths say the size before the tap (estimated from bit rate and length, the
  word "about") and after (measured). The export never touches the originals, and PRESETS name the places (a 9:16 1080 × 1920 story, a 1:1
  post, a 16:9 1080p, the source's own) by shape, never by a company's name.
- **On the phone, honestly:** SCENES (video/scenes.ts) finds cuts by the frame histogram's distance between sampled frames (four a second)
  and offers SPLIT AT THE CUTS; QUIET (video/quiet.ts) finds silences in the mix by RMS under a threshold for over 600 ms and offers CUT THE
  PAUSES with the count and the time saved said; SUBTITLES send the audio to his brain's hearing route as above and land as cues he can edit,
  with "a first pass from your brain: read them once" said once. Not in this version and said so in the report and the export sheet's "?"
  (NEEDS HIS WORD, each with what it would take): stabilisation (optical flow the phone cannot run within the frame budget without a
  download), "the best clips" and music matching (a model), a Director Mode, reverse play, a speed ramp (keyframed speed), multicam.
  Clips come in through the screen's ADD (the phone's picker), the library (a video file there offers OPEN IN VIDEO) and the chat ("cut this
  video" with a file). A clip the phone cannot decode (a codec Safari lacks) is said once: "Your phone can't read this clip's codec; a copy
  from Photos usually works."

## The screen

MAKE → VIDEO (a hub card beside the other editors; the catalogue entry; "my videos", "edit a video", "cut this video" in the chat). The strip
of clips across the top at the phone's width (posters, the playhead a line, a pinch zooms time), the picture under it at the project's aspect
with PLAY/PAUSE, the time, and a scrub bar; tools as pills: TRIM (handles at 44 pt on the selected clip's ends, the in and out times said),
SPLIT (at the playhead), SPEED (0.25 to 4 with the length that results said), ORDER (MOVE LEFT / MOVE RIGHT and a press-and-drag that scrolls
near the edge, as PRESENTATIONS), TRANSITION (the five, a length), TITLE (typed in a line above the picture, as the editors do, never a tiny
caret on the picture; a position; appear and leave), GRADE (the PHOTO sliders that apply to a clip, a hold shows the ungraded frame; a LUT
from a .cube file; COPY THE GRADE to every clip), SOUND (the clip's volume; MUSIC from the library with a gain and fades; RECORD a voice-over
with a 44 pt key, the level drawn while it records, UNDO after; DUCK the music under the voice), SUBTITLES (the brain's first pass or typed;
each cue editable in place; the position; SAVE .srt), OVERLAY (a picture-in-picture clip with its corner and size; CHROMA KEY with the colour
picked by a tap on the picture), CROP and ASPECT, SCENES and QUIET as above, EXPORT (the preset, the size said before, the progress with
frames done and the time left, the file saved with the size said after, and SHARE), PROJECT (NEW, OPEN, DUPLICATE, DELETE with UNDO, EXPORT
THE PROJECT as a .zip with the size). Undo everywhere (sixty deep) with UNDO in the line. Every state in his voice: no project yet (one line and
ADD A CLIP), a clip the phone cannot decode, a proxy being made ("Making a smaller copy to scrub with… about 20 s"), an export on the slow
path, the brain away when he asks for subtitles ("Your brain is away; type them, or try when it is back"), offline (everything but subtitles
works and says so once), room running out, a music file the phone cannot read. GLASS, THE SCAN, ONE INK and the HUDs each wear it; reduced
motion stills the strip's scroll and the transitions in the preview (the export is unchanged by it).

## The benchmark (PROGRAMME-EDITORS 7; timed on the preview and said in the PR)

A one-minute video from four clips: the spec draws four clips of fifteen seconds (synthetic, 1280 × 720 at 30 frames a second with a moving
shape, a distinct colour and a 1 kHz tone each, made on the preview through the MediaRecorder path and kept in tests/.shots, never
committed), adds them, trims one, splits one at a SCENES cut, orders them, puts a crossfade and a wipe between them, grades two (one with a
.cube LUT the spec writes), adds a TITLE and a MUSIC track with ducking under a short recorded voice-over (the spec feeds a WAV), lets QUIET
cut the pauses, types two subtitles, and exports 1080p 16:9: the time of each step and the export's length, size and frame count said; the
exported file decoded by the preview's `<video>` (duration within 100 ms of the timeline's, a frame sampled at 30 s matching the expected
clip's colour within a threshold), and, on the WebCodecs path, its moov read by the spec's own box walk (one avc1 and one mp4a trak, the
sample counts equal to the frames and the AAC packets). The export playing in Photos with its sound and sharing to Messages NEEDS HIS PHONE:
the phone check has it.

## Tests (each fails on the code before this brief; run against it once and say so)

- apps/edge/test/video.test.mjs (new; imported from an existing test file as kernel-yes was, one import line, since the test list is
  protected; NEEDS HIS WORD names it): time mapping through speed and trims (a clip at 2× over 10 s is 5 s on the timeline; the frame at
  timeline t is source time in + (t − start) × speed); keyframe interpolation at and between keys, eased; a transition's weights summing to
  one; the ducking curve; the chroma distance; the .cube parser on a hand-written 2-point LUT and a refusal of a malformed one with his words;
  SCENES on synthetic histograms; QUIET on a synthetic RMS series (the pauses and the time saved); the .srt and .vtt writers and readers round
  trip; the mp4 muxer's boxes on two fake samples (the box sizes add up, stts and stsz right, the avcC passed through byte-equal, the
  durations scaled); the store's `room()` words; the history's depth.
- tests/video.spec.mjs (new; `all=` word `video` at the END of the list in check.yml, nothing else in .github touched), at 440 and 390 (this
  spec needs GL and the recorder: run it WITHOUT NO_GL_SHOTS and say the software GL makes it slow): (a) MAKE → VIDEO in two taps; "edit a
  video" opens it; (b) the empty state's words; four clips added, the strip shows four posters and the length; (c) TRIM moves an end and the
  time said changes; SPLIT at the playhead makes two; SPEED 2× halves the length said; (d) ORDER by key and by drag; (e) a TRANSITION set and
  the preview at its midpoint blending the two colours (a sampled pixel between them); (f) GRADE: exposure up brightens a sampled pixel; a
  LUT applied changes it as the LUT says; COPY THE GRADE; hold shows the original; (g) TITLE typed in the line and drawn at its time, not
  before; (h) MUSIC added with a gain; the voice-over WAV fed and DUCK lowering the music's gain under it (the mixer's node values read);
  (i) SUBTITLES typed, drawn at their times, saved as .srt with the cues read back; (j) OVERLAY with a chroma key: the keyed colour sampled
  transparent; (k) SCENES finds the cut between two drawn clips; QUIET finds the drawn silence; (l) EXPORT: the path said, the size said
  before, the progress shown, the file decodable with the duration within 100 ms, the sample at 30 s right, and on the WebCodecs path the box
  walk; a 9:16 preset's size; (m) autosave said once and the project reopens at its playhead; UNDO after a delete; (n) offline: everything
  but subtitles works and the one line says so; the brain away: the subtitles line; (o) the library's OPEN IN VIDEO on a video file lands
  here; (p) BODY 21 clips nothing, every control 44 pt, nothing sideways, the picture upright at its aspect.
- library, showme, speed2, look, ink, thescan, hubcards, deck, nav unchanged unless a fix lives in a screen they own.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`. Preview on port 8834:
`(nohup setsid node tests/preview-server.mjs 8834 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8834.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call. Specs from the worktree ROOT: `BASE=http://localhost:8834 NO_GL_SHOTS=1 timeout 600 node tests/<name>.spec.mjs tests/.shots`
(video.spec WITHOUT NO_GL_SHOTS; the preview browser's WebCodecs may be missing under software GL: then the spec proves the MediaRecorder
path there and the muxer by the brain test, and the report says so plainly); a nogl copy as `tests/.<name>.nogl.tmp.mjs` is never committed.
In the foreground, alone, one after another: video, library, showme, speed2, look, ink, thescan, hubcards, deck, nav, layout. The brain tests
in the background once at the end. A timing budget missed under load is rerun alone before it is called red. Known sandbox reds not touched:
direct, aim, radio, scroll, safari, eye's own screenshot, tabs2, talk's cooling lines. The benchmark's clips are drawn by the spec and
deleted after; nothing large is committed; disk is tight, so tests/.shots is removed after every run.

## The owner's phone check

1. MAKE, VIDEO: ADD four clips from your camera roll. Do they open at once, the right way up, with their sound?
2. TRIM one with the handles; SPLIT one; SPEED one to 2×. Scrub: does the picture follow your finger?
3. A crossfade between two; a TITLE typed in the line; GRADE one warmer and COPY THE GRADE to all.
4. MUSIC from your library; RECORD a few words over it: does the music drop under your voice? QUIET: what did it cut?
5. SUBTITLES: the brain's first pass on a clip of you talking: how many words did it get wrong? Fix one in place.
6. EXPORT 1080p: the size said first; which path your phone took; the file in Photos playing with sound; share it to Messages.
7. Aeroplane mode: everything but subtitles works and says so once. Biggest text: nothing cut.
8. Does it feel like a video editor or like a trimmer with filters? Say which, and the one tool that feels slow.

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/video-report.md: what was built, which export path the
preview's browser took and why, the muxer's boxes (or the vendored fallback and why), the benchmark's times, length, size and frame count,
the proxy's size and time on a long clip, each spec's last line (before and after for the new ones), found-not-fixed, NEEDS HIS WORD (the
test's name in the list; the not-in-this-version list with what each would take; a `video` brain tool if wanted), the phone check as above,
the commit list. One commit per step on builder/video; the orchestrator squashes to one on landing.
