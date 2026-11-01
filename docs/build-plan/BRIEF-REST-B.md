# BRIEF-REST-B — chess with a real rating, the instrument and skills coach, the review link, deploy your own Ghosty (batch ⑧ part B, 1 Nov 2026)

Worktree from the LOCAL tip of claude/ghosty-ai-training-idwhp9 (at or after the commit that adds this brief; never reset to
FETCH_HEAD or origin, only to the local branch). Your preview port: 8733. Read first: ROADMAP.md row ⑧; OWNER-ISSUES 91 (c),
92 ⑧, 95–97, 99 (the catalogue rules), 105 (the pack pattern: if you add anything to the brain, it is one tool with an
`action` enum and a two-word `short`; the plain prompt is at EXACTLY 5,500 on the worst dial — trim exactly what you add and
list every trim; prefer phone-side code and add nothing to the brain where you can); `apps/web/src/gym/chess.ts`,
`chessboard.ts`, `chesssets.ts`, `league.ts`, `meta.ts` (the GYM's chess and its league rating); `apps/web/src/features/body/
reps.ts` (how a camera coach is built, for the shape of a mic coach); `apps/edge/src/index.ts` around the owner key and
pairing (how a phone signs in); `docs/VISION.md` and `docs/build-plan/STATUS.md` (for the tour's facts). Other builders run
in parallel (the people/work/creative packs, the social self, offline Wikipedia + Shortcuts + Morse): touch nothing under
`features/people|work|creative/`, `social/`, `features/links/`, `wiki/`, `morse/`, `features/settings/shortcuts.ts`. Yours:
`apps/web/src/gym/chess*.ts` and `league.ts` (the rating), `apps/web/public/vendor/stockfish/*`, `apps/web/src/coach/*`
(new) + a sheet, `apps/edge/src/demo/*` + `apps/web/src/demo/*` (new), `docs/DEPLOY-YOUR-OWN.md` + `apps/web/src/features/
system/firstrun.ts` (or where the first-run flow lives), your phrases, `packages/shared/src/catalogue/restb.ts` (joined where
the catalogue files are), `apps/edge/test/restb.test.mjs`, `tests/restb.spec.mjs`, the CI smoke loop's list (`restb` after
`resta` if present, else after `games3`), `apps/edge/package.json`'s test list, a CSS block at the END of styles.css.

## 1. CHESS WITH A REAL RATING (the GYM's chess)

- An engine of known strength: the `stockfish` npm package (GPL; the WebAssembly build; `npm pack stockfish@19` into a scratch
  directory, vendor the wasm and its worker script under `public/vendor/stockfish/` with LICENCE and SOURCE.md: name,
  version, integrity, each file's SHA-256), run in a Worker; its UCI `Skill Level` and `UCI_Elo` options set the strength.
- RATED GAMES: he plays the engine at a chosen or suggested level; a Glicko-2 rating (code, tested) for him from results
  against the engine's calibrated Elo (the published approximate Elo per UCI_Elo value, said as approximate); the same for
  Ghosty's own chess (his GYM engine plays the Stockfish levels in the worker when the GYM trains, so Ghosty gets a rating
  too); both ratings on the chess card and the GYM page ("You: about 1180 · Me: about 1420 · ±80"), the trend, the next
  suggested level; a hint and a blunder check after a game (the engine's evaluation in plain words: "move 23 lost a rook").
- Nothing about other people; no online play; the engine runs on the phone.

## 2. THE INSTRUMENT AND SKILLS COACH (a sheet from the chat: "teach me guitar", "tune my guitar", "am I in tune?", "coach me")

- A TUNER from the mic (pitch by autocorrelation or YIN in code, no model): the note, cents off, the needle, for guitar,
  bass, ukulele, violin and a free pitch; works offline.
- LESSONS of our own for guitar, piano/keyboard and voice: a first ten (chords, scales, a riff; the mic hears whether the
  right notes came in order and in time against a metronome you build; a strum pattern by onset detection), a streak, what
  to practise next; plain words, never a music file we did not make.
- SKILLS BEYOND MUSIC through the same shape: typing speed and accuracy (a text to type, WPM, the weak keys), a drawing
  prompt a day with a side-by-side (the Lens's picture of his drawing beside the prompt; no judging by a model), juggling
  or a trick by camera is NOT in (say so); languages: ten-word daily lists he can hear spoken by the voice and say back (the
  speech recogniser the app already has scores the match). Honest about what the mic and camera can and cannot judge.

## 3. THE REVIEW LINK (a demo another person or AI can read, with none of his data)

- A DEMO MODE: `/demo` on the Worker serves the app against a demo brain (a separate Durable Object id `demo`) seeded with
  sample data of our own (a made-up owner "Sam", made-up places, a sample week), every tool that acts disabled (the demo brain
  refuses to send, post, pay, call, build or change keys: it says "this is the demo"), reads of public feeds allowed, the
  offline brain off, no keys in it; a banner "This is a demo of Ghosty with sample data"; a 20-minute reset. The owner's own
  brain and data are never reachable from it (prove it in the test: the demo DO id is fixed, the owner key is not accepted
  there, and the owner's DO rejects demo requests).
- THE TOUR (`/demo/tour`): a plain page in his voice for a reviewer: what Ghosty is (VISION.md's first lines), what he can do
  (the catalogue's scenes and counts, generated), the lines that hold, what to try in the demo, and a form-free way to leave
  an opinion: "copy your notes and send them to the owner" (no inbox we run, nothing stored). Say what a reviewer cannot see.

## 4. DEPLOY YOUR OWN GHOSTY (for other people, nothing shared)

- `docs/DEPLOY-YOUR-OWN.md`: plain steps from a fork to a running Ghosty on someone's own Cloudflare account (Workers free
  plan): fork, the deploy button or `wrangler deploy`, the first run, the keys they may add and what each unlocks, what is
  free and what is not, what never leaves their phone; the licence lines of the vendored engines and models.
- THE FIRST RUN on a fresh deployment: a wizard in the app (System or the sign-in) that makes the owner key, pairs the phone,
  names the owner, saves Home, and says the three things to try — code that exists for pairing reused; nothing of the
  original owner carried over (the test proves a fresh brain has no data and no keys).

## The lines that hold

Nothing of the owner's data in the demo or the deploy; nothing that bills; no online chess or any contact with other people;
only music and lessons of our own; the plain prompt ≤ 5,500 (ideally untouched); no test skipped or weakened; the guard job
untouched; no model names anywhere; every new thing has its catalogue entry.

## Tests

`restb.test.mjs`: Glicko-2 on known cases; the Elo table; the pitch detector on synthesised tones (A4 440, E2 82.4, a
detuned G); onset detection on a synthetic strum; typing scoring; the demo brain's refusals and its separation from the owner
(ids, keys); the first-run wizard's state machine. `tests/restb.spec.mjs` on your preview: a rated game's first moves against
the engine (the worker stubbed where the real wasm is too slow for the spec, else real), the rating card; the tuner with a
synthesised tone through the fake mic (the lens spec's fake-camera pattern shows how devices are faked), the needle reads
A4; a lesson's first step; the typing test scores; `/demo` shows the banner and refuses to send; `/demo/tour` renders with
the counts; the first-run wizard on a fresh brain; nothing sideways at 390 × 844; VoiceOver labels.

## Working lean

Ranged reads; `tail -30`; the brain suite once at the end under `nice -n 10`; no narration. Validation: brain typecheck +
suite; web typecheck + build; on one fresh preview: websites, apps, gym, restb, deck, nav.

## The report (one message)

Base SHA, HEAD SHA, the worktree branch; commits; files (vendor sizes); validation numbers; the engine's levels and the Elo
table used; LIMITS; DESIGN PICKS THE OWNER MAY CHANGE; NEEDS HIS PHONE (the mic, a real guitar); WHAT THE MERGE MUST KNOW.
