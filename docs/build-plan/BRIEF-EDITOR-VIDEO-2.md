# BRIEF: VIDEO 2 — steadied, the best clips found, cuts on the beat, reverse and a speed ramp (his yes, 185)

BRIEF-EDITOR-VIDEO-2 (OWNER-ISSUES 185 "yes to all" to the two things VIDEO named as NEEDS HIS WORD: stabilisation and "the best clips";
BRIEF-EDITOR-VIDEO's "On the phone, honestly"; PROGRAMME-EDITORS' rule "Models and large assets are downloads: only on his tap, on Wi-Fi,
with the size said; kept on the phone; removable"). Starts FROM VIDEO'S HEAD ON THE FOLD (the builder/videofold branch, when the VIDEO-onto-
the-fold rebase hands back; the orchestrator lands only the diff above it, after VIDEO is on main), so the editor's project, store, player,
export, reader and screen are in the tree. One builder, one PR. Read STANDARD.md, BRIEF-EDITOR-VIDEO.md and the video report
(scratchpad/video-report.md), `apps/web/src/video/{model,math,reader,export,scenes,quiet,gpu,preview,screen}.ts`, `apps/web/src/offline/
eyes.ts` and `offline/pack.ts` (THE PACK RULE and the eyes already kept: the namer's model under public/vendor/clip is the one model this
pass may use, and only when he has already kept it), BRIEF-EDITOR-PHOTO-2.md (the same pass for PHOTO: the shape of the licence-first rule),
then this. THE QUALITY RULE holds.

## His words
"yes to all" (12 Nov) to: "stabilisation and 'best clips' (a Video 2 pass after Video lands)", "each on your tap on Wi-Fi with the size
said". And the rule's "nothing that can cost money and no new keys".

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Protected files, not edited: apps/edge/src/agent.ts, apps/edge/src/index.ts, apps/edge/src/tools/{index,types,repo}.ts, .github/* (except the
one spec word at the END of check.yml's `all=` list; the guard job untouched), apps/*/package.json. No package added; no new model vendored
unless the report shows (licence and measured size written BEFORE a byte is vendored, as PHOTO 2's rule) that the phone cannot do the job
with its own code and the namer's model already kept; the expectation, to prove and not to assume, is that NOTHING new is downloaded for this
pass: steadying and the beat are the app's own arithmetic, and "the best clips" is the app's own scoring plus the namer's model only where he
already kept it. A clip never leaves the phone for any of this. No face is found, named, tracked or scored: a frame's score is its sharpness,
its light, its motion and its variety, never who is in it (the report says so in one line and names the test that proves no face code is
imported by video/*).

## What is built

1. **STEADY (video/steady.ts, the app's own, in a Worker):** the clip's global motion between neighbouring frames (sampled at the project's
   rate, downscaled to about 160 px wide in grey through the reader that SCENES uses) by block matching with a coarse-to-fine search (a
   translation and a small rotation and scale, solved from the blocks' votes; the maths pure in video/steadymath.ts: the vote, the solve,
   the path's smoothing by a windowed average with the window said, the crop that keeps every smoothed frame inside the picture), the camera
   path smoothed, and a per-frame transform written into the clip's recipe as STEADY keyframes (the clip's transform track; the preview and
   the export apply it as they apply any keyframe, so nothing in gpu.ts changes but a crop); the strength a slider (the crop it costs said as
   a percentage: "Steadier: loses 8% at the edges"); "Steadying… about N s" as the wait with the frames done, run once per clip and kept with
   the project (re-run on his tap); UNDO takes it off. Time measured on the preview per second of clip and said in the report; a clip whose
   motion the match cannot follow (a pan faster than the search's reach, a dark clip) says so once and leaves it alone, never a shaky
   result passed off as steadied.
2. **THE BEST CLIPS (video/best.ts):** every clip (or every second of a long one) scored on the phone: sharpness (the Laplacian's variance on
   the grey sample), light (the histogram's spread, not clipped at either end), motion (the steady pass's own numbers: a little is good, a
   blur is not), variety (SCENES' histogram distance from the clips already chosen), and, only when the namer's model is already kept
   (offline/eyes.ts says so), a "what's in it" word from the namer for the one-line reason; the scores pure in video/bestmath.ts. BEST CLIPS
   in the SCENES pill: a target length (15 s, 30 s, 60 s, or typed), the pick as a list he can tick off, each with its reason in one line
   ("sharp, well lit, a new view" / "blurred: left out"), MAKE THE CUT builds the project from the ticks (the originals untouched, as always)
   with UNDO; a clip with no sound and no light says "nothing to choose from here". The namer's absence is said once in the list's line
   ("Without the namer kept, I choose by sharpness, light and variety alone.") and never blocks the pick.
3. **ON THE BEAT (video/beat.ts):** the music track's beats found on the phone (an onset-strength envelope from the mix's spectral flux, the
   tempo by autocorrelation within 60 to 180 beats a minute, the beat grid snapped to the strongest onsets; pure in video/beatmath.ts); SNAP
   TO THE BEAT in SOUND moves every cut to its nearest beat within 400 ms (said: "12 cuts moved to the beat, the biggest by 310 ms") with UNDO;
   BEST CLIPS with music chosen lays its picks a beat-count long each. The tempo said as a number with "about".
4. **REVERSE and a SPEED RAMP (model.ts, math.ts, preview.ts, export.ts):** REVERSE on a clip plays it backwards (the reader decodes the
   clip's frames in order and the export writes them reversed from a frame cache sized by room(); a clip too long for the cache says the
   length it can reverse and offers a split; the preview seeks backwards and says once that it will be rough until export); a SPEED RAMP as
   keyframed speed (the speed track joins the transform track's keyframes: the time mapping in math.ts integrates it; the clip's length that
   results is said), with the sound pitched or dropped by his choice.
5. **THE SCREEN'S WORDS.** STEADY, BEST CLIPS, ON THE BEAT, REVERSE and RAMP each a 44 pt key in the pill they belong to (STEADY and RAMP under
   SPEED, BEST CLIPS under SCENES, ON THE BEAT under SOUND, REVERSE under SPEED); every wait said with its time; every state in his voice
   (no music: ON THE BEAT says what it needs; the Worker dead: RETRY; a clip the reader cannot read: the same line SCENES says). The export
   sheet's "?" loses stabilisation and the best clips from its NEEDS HIS WORD list and keeps Director Mode and multicam with what each would
   take.

## What must not change

VIDEO's project shape (new fields only, an old project still reading), its store, its export's two paths and the muxer, its spec green;
SCENES, QUIET and SUBTITLES as they are; the pack rule (nothing fetched before his tap; nothing fetched at all unless the report proves the
need); the ratchet; every budget; GLASS pixel-equal; no face code called; nothing of his leaves the phone.

## Tests (each fails on the code before this brief; run against it once and say so)

- apps/edge/test/video2.test.mjs (new; imported from an existing test file by one import line): the block-match solve on a synthetic pair
  (a shifted and slightly turned frame gives its shift and turn back within a pixel and a degree); the path's smoothing and the crop (every
  smoothed frame inside the picture); the scores on synthetic frames (a sharp lit frame beats a blurred dark one; variety falls for a
  repeat); the tempo of a synthetic click track within 2 beats a minute and its grid; the speed ramp's time mapping (a ramp from 1× to 2×
  over 10 s lands at 7.5 s and the inverse mapping round-trips); an old project JSON still loads; `video/*` imports nothing from
  vision/faces, facestore, facemath or liveness.
- tests/video2.spec.mjs (new; `all=` word `video2` at the END of the list in check.yml, nothing else in .github touched), at 440 and 390, GL
  on, on the drawn clips video.spec makes: (a) STEADY on a clip the spec draws with a jitter: the keyframes written, the crop said, a
  sampled frame's shift smaller after than before by the spec's own measure, UNDO takes it off, the export carries it; (b) BEST CLIPS on
  four clips of which one is blurred and one dark: the pick's list leaves those two out with their reasons, MAKE THE CUT builds a project of
  the target length within a second, UNDO; the namer's line when it is not kept; (c) ON THE BEAT with a drawn click track at 120 beats a
  minute: the tempo said as about 120, the cuts moved with the count and the biggest move said, UNDO; (d) REVERSE: a sampled frame at the
  start matches the original's end; RAMP: the length said; (e) offline: everything in this brief works and says nothing about the signal;
  (f) every key 44 pt, nothing sideways, BODY 21 clips nothing.
- video, photoedit, photo, hubcards, deck, nav, speed2, look, ink, thescan unchanged unless a fix lives in a screen they own.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`. Preview on port 8839:
`(nohup setsid node tests/preview-server.mjs 8839 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8839.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call. Specs from the worktree ROOT: `BASE=http://localhost:8839 timeout 600 node tests/<name>.spec.mjs tests/.shots` (video2
and video WITHOUT NO_GL_SHOTS; the rest with NO_GL_SHOTS=1). In the foreground, alone, one after another: video2, video, photoedit, photo,
hubcards, deck, nav, speed2, look, ink, thescan. The brain tests once at the end. A timing budget missed under load is rerun alone before it
is called red; a spec killed at 590 s with no failure line is rerun once and then reported with its last printed line. Known sandbox reds not
touched: direct, aim, radio, scroll, safari, eye's own screenshot, tabs2, talk's cooling lines. A nogl copy as tests/.<name>.nogl.tmp.mjs is
never committed; tests/.shots removed after every run; nothing large committed.

## The owner's phone check

1. VIDEO, a hand-held clip you walked with: SPEED → STEADY: the wait with its time, the crop said; play it: steadier? UNDO: back.
2. Four clips, one shaky and one in the dark: SCENES → BEST CLIPS, 30 s: which are left out and why? MAKE THE CUT: a 30 s project.
3. Add music: SOUND → ON THE BEAT: the tempo said; the cuts move; does it feel cut to the music?
4. SPEED → REVERSE on a short clip; RAMP from slow to fast: the length said; export and play it in Photos.
5. Aeroplane mode: all four still work.

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/video2-report.md: whether anything was vendored and, if so,
its name, source, licence and measured size written BEFORE it was vendored (the expectation is nothing); the steadying's time per second of
clip, the scoring's time per clip and the beat's time per minute of music on the preview; each spec's last line (before and after for the new
ones); found-not-fixed; NEEDS HIS WORD (the test's name in the list); the phone check as above; the commit list. One commit per step on
builder/video2; the orchestrator squashes to one on landing.
