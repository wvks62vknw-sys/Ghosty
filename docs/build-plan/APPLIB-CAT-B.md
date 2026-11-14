# APPLIB CAT-B: Creative and Games

Lane CAT-B of THE APP LIBRARY round (brief: `docs/build-plan/APPLIB.md`). Files:
`packages/shared/src/applib/catalogue/create.ts` (CREATE) and `packages/shared/src/applib/catalogue/games.ts` (GAMES).

## What landed

### Creative (from the owner's list)
| List | App(s) | Archetype | The true core |
|---|---|---|---|
| create.12 Storyboard | `shot-list` | log | Shots with framing, move, lens, length, frame photo; board by status, running time |
| create.13 Screenplay | `scene-cards`, `screenplay-format` | log, guide | Index cards by act with page counts; the layout rules of a script page |
| create.22 Songwriter | `song-ideas` | log | Lyric notebook with key, tempo, chords, sections, board by stage |
| create.20 Practice Room | `practice-log` | log | Minutes and top tempo per session, weekly goal ring, streak, chart |
| create.52 Moodboard | `moodboard` | log | Pictures, colours, notes and links on boards, gallery view |
| create.54 Tabletop Maker | `card-designer` | log | Card designs with cost, power, copies and rules text; deck size; CSV out for print templates |
| create.58 Colour Studio | `contrast-check`, `palettes` | calc, log | WCAG 2.1 contrast ratio with AA and AAA passes; saved palettes |
| create.59 Colour Vision | `colour-blindness` | guide | The kinds of colour vision deficiency and how to design for them (NHS) |
| create.57 Fonts | `type-guide` | guide | Type families, spacing terms, pairing |
| create.8 Photo Book | `print-size` | calc | Largest sharp print from pixels at 300, 240 or 150 ppi |
| create.9 Print Shop | `poster-tiles`, `photo-sizes` | calc, guide | Poster tiled across A4 with margin and overlap; official passport and paper sizes (GOV.UK, ISO 216) |
| create.46 Stop Motion | `timelapse-calc` | calc | Interval, frames, speed-up and card space for a time-lapse |

### Creative (new, 38)
Photography: `exposure-value`, `depth-of-field`, `composition`, `film-rolls`, `camera-kit`, `shoot-kit`, `darkroom-timer`,
`shoot-spots`, `photo-challenge`. Writing: `writing-log`, `story-bible`, `submissions`, `writing-sprints`, `poetry-forms`.
Art and craft: `sketchbook`, `art-portfolio`, `commissions`, `gesture-drawing`, `drawing-prompts`, `colour-theory`,
`knitting-gauge`, `craft-projects`, `row-counter`, `pottery-log`, `art-supplies`. Music and sound: `note-frequency`,
`tempo-delay`, `audio-size`, `repertoire`, `gig-diary`, `practice-routine`, `voice-warm-up`. Film, video and podcasts:
`episode-planner`, `clapperboard`, `upload-checklist`, `aspect-ratio`, `type-scale`, `film-diary`.

Every calc names its public source and carries 2 or 3 tests worked out from it (WCAG 2.1 luminance, APEX exposure value,
thin-lens depth of field, equal temperament at A4 = 440 Hz, PCM data rate, ISO 216, Craft Yarn Council gauge, modular
type scale, Elo).

### Games (from the owner's list, 24)
| List | App(s) | Kind |
|---|---|---|
| games.32 Puzzle Box | `sudoku`, `minesweeper`, `big-minefield`, `nonograms`, `sliding-puzzle`, `lights-out` | sudoku, mines, nonogram, slide, lights |
| games.33 Daily Puzzles | `daily-word`, `six-letters`, `daily-sudoku` | wordguess, sudoku |
| games.26 Solitaire | `patience` | solitaire (draw one) |
| games.40 Quiz Night | `quiz-night` | quiz (twenty questions on the clock) |
| games.38 Word Arcade | `hangman` | hangman |
| games.55 Letters & Numbers | `spell-it`, `shapes-numbers` | hangman, quiz (no clock) |
| games.14 Arcade Classics | `snake`, `block-drop` | snake, blocks |
| games.29 Clubhouse Classics | `dots-boxes` | dots |
| games.53 Kids Corner | `little-pairs` | pairs |
| games.57 Rhythm Run | `colour-echo` | simon |
| games.30 Game Night | `score-keeper`, `play-log`, `turn-timer` | counter, log, timer |
| games.31 Dungeon Master | `campaign-journal` | log |
| games.37 Cube | `cube-times` | log |

### Games (new, 35)
Difficulty ladders and variants: `easy-sudoku` and `hard-sudoku` (with `sudoku` and `daily-sudoku`), `daily-picture` and
`big-nonograms`, `eight-puzzle` and `slide-five`, `big-lights-out`, `merge-mini`, `merge-tiles` and `merge-big`,
`patience-three`, `snake-wrap`, `echo-rush`, `memory-match`. Words and numbers: `word-scramble`, `word-hunt-big`,
`kids-word-search`, `typing-test`, `maths-sprint`, `times-tables`, `reaction-time`. Quizzes (every fact checked, plain
and well known): `capital-cities`, `space-quiz`, `body-quiz`, `world-quiz`, `uk-quiz`, `animal-quiz`, `science-quiz`,
`elements-quiz`, `sport-quiz`. For players: `board-game-shelf`, `game-backlog`, `dice-odds`, `elo-calc`,
`chess-openings`.

## Game options
Every game uses only the options its kind documents at the top of `packages/shared/src/applib/games/<kind>.ts`, and every
tour describes only what that kind does. Ladders come from the documented options (sudoku difficulty, board sizes,
draw one or three, speeds). Quiz questions are written `question | right | wrong | wrong | wrong`.

Not landed because no kind can do it yet (each is a small addition to its kind, then a one-line app): spider, free
cell, pyramid and peaks patience (solitaire variants); the letter hive and anagram wheel (anagram modes); the timed
letter-grid hunt (a wordgrid mode); the falling-word typing game (a typing mode); themed memory pairs such as countries
and capitals (pairs with text faces); the two-player reaction duel (reaction with two players).

## Needs its own build
Each is a real engine or a live device feature that no archetype can give truthfully, so none is faked.

**Creative**
- create.10 Script Cut: word-timed transcript editing of video needs a media timeline and speech alignment.
- create.15 Music Studio: multitrack recording, sampled instruments and a mixer need a real audio engine.
- create.27 Podcasts: feed search, downloads and smart-speed playback need network fetch and an audio player.
- create.18 Voice Memos: recording, enhancement and transcripts need the microphone and audio processing.
- create.5 PhotoScan & Restore: glare-free multi-shot scanning and restoration need camera capture and image models.
- create.2 Camera: frame stacking, depth blur and a teleprompter need the live camera pipeline.
- create.3 Retouch: face-part masks and skin smoothing need on-phone segmentation and an image editor.
- create.4 Merge: HDR, panorama and focus stacking need image registration and blending.
- create.6 GIF Maker: trimming and encoding clips needs a video decoder and GIF or WebP encoder.
- create.7 Stickers & Memes: cut-outs need segmentation and a text-on-image editor.
- create.8 Photo Book (layout): page layout and print-ready PDF need a layout editor; `print-size` gives the print check.
- create.9 Print Shop (layouts): passport crops, tiled posters and zines need an image and PDF composer; the maths and sizes landed.
- create.11 Player: video decoding, subtitles and picture-in-picture need a media player.
- create.12 Storyboard (animatic): drawing frames and timing them to a voice track need a canvas and timeline; the shot list landed.
- create.13 Screenplay (editor): live screenplay formatting and FDX or Fountain files need a dedicated editor; cards and rules landed.
- create.14 LUT Maker: colour matching and .cube export need image processing.
- create.16 Beat Maker: sampling and a step sequencer need a real-time audio engine.
- create.17 Synth: oscillators, filters and an arpeggiator need a real-time audio engine.
- create.19 Audio Editor: waveform editing, noise reduction and loudness need audio processing.
- create.20 Practice Room (audio): time-stretch, stem separation and chord detection need audio models; the practice log landed.
- create.21 Score: notation entry, engraving and playback need a music notation engine.
- create.22 Songwriter (audio): rhymes as you type and pinned voice memos need a rhyme service and the microphone; the notebook landed.
- create.23 DJ: two-deck mixing with sync needs a real-time audio engine.
- create.24 Music Player: library import, gapless playback and lyrics need an audio player.
- create.26 Voiceover: narration timed to clips needs speech synthesis and a timeline.
- create.28 Podcast Studio: recording, transcript editing and loudness need audio processing; `episode-planner` covers the plan.
- create.31 Vector: a pen tool with Béziers and booleans needs a vector editor.
- create.35 Sculpt: 3-D sculpting needs a mesh engine.
- create.37 Voxel: block modelling and rendering need a 3-D engine.
- create.39 3D Scan: photogrammetry needs capture guidance and reconstruction.
- create.40 AR View: USDZ export and placement need a 3-D exporter and Quick Look hand-off.
- create.42 Animate: frame-by-frame drawing with onion skin needs a drawing and timeline engine.
- create.43 Motion: keyframes and easing on layers need a motion graphics engine.
- create.44 Puppet: face tracking that drives a puppet needs the camera and a face mesh model.
- create.45 Mocap: body pose to 3-D animation needs pose models and retargeting.
- create.46 Stop Motion (capture): an onion-skin camera needs the live camera; `timelapse-calc` covers the planning.
- create.47 Picture Book: illustrated pages read aloud need a page editor and speech.
- create.53 World Map Maker: map brushes and stamps need a canvas engine.
- create.54 Tabletop Maker (print and play): boards and print-and-play PDFs need a layout engine; card data landed.
- create.55 Code Art: sealed live sketches need a sandboxed code runner.
- create.56 Font Maker: tracing handwriting into outlines and TTF export need a font engine.
- create.57 Fonts (library): browsing and downloading open fonts needs network fetch; `type-guide` landed.
- create.58 Colour Studio (camera and export): live camera picking and swatch files need the camera and exporters; contrast and palettes landed.
- create.59 Colour Vision (camera): live colour-blind views need the camera and a shader; the guide landed.

**Games**
- games.32 Puzzle Box (collection): the forty-puzzle WebAssembly collection and its teaching hints need their own port; six puzzles landed as kinds.
- games.33 Daily Puzzles (groups, mini crossword, letter hive): a groups-of-four puzzle, a crossword generator and a hive mode are not kinds yet.
- games.26 Solitaire (variants): spider, free cell, pyramid and peaks need solitaire variants beyond the seven-column game.
- games.58 Play Along: pitch detection against a note highway needs the microphone and audio analysis.
- games.3 Pixel Studio: a pixel editor with layers and frames needs its own canvas.
- games.4 Chip Sound: sound generators and a tracker need an audio engine.
- games.5 Story Maker: a branching story editor and player needs its own build.
- games.6 Bridge Builder: structural physics needs a physics engine.
- games.8 Character Maker: parts-based 2-D and 3-D characters need a character engine.
- games.9 Course Maker: a platformer level editor needs the platformer engine.
- games.10 Track Builder: a kart racer needs a 3-D racing engine.
- games.11 Block World Creative: world editing needs the block world engine.
- games.12 Shooter Map Maker: sector drawing and builds need the shooter engine.
- games.13 Retro Consoles: emulator cores need WebAssembly builds.
- games.15 Pinball: table physics needs a physics engine.
- games.16 Tower Defense: waves, towers and pathing need a real-time game engine.
- games.17 Mini Golf: 3-D ball physics needs a physics engine.
- games.18 Pool: cue physics and a shot search need a physics engine.
- games.19 Drive My Streets: map-built 3-D towns need a driving engine.
- games.20 Flight Sim: a flight model over terrain needs a 3-D engine.
- games.21 Tiny Empires: turn-based strategy with an opponent needs its own game engine.
- games.22 Deckbuilder: cards, relics and fight simulation need their own game engine.
- games.23 Ghosty Pet: a creature reading BODY numbers needs its own build.
- games.25 Go: a board with an on-phone engine and review needs a Go engine.
- games.27 Card Table: trick-taking games with explaining players need card AI.
- games.28 Mahjong: tile layouts and Riichi players need their own engine.
- games.29 Clubhouse Classics (the rest): fifty board games need a shared board-game engine; dots and boxes landed.
- games.31 Dungeon Master (the game): a narrated adventure needs the brain and dice; the campaign journal landed.
- games.34 Crosswords: a crossword generator and .puz reader need their own build.
- games.35 Jigsaw: real tab-and-blank pieces need a jigsaw engine.
- games.36 Escape Rooms: 3-D rooms need a 3-D engine.
- games.37 Cube (scan and solver): camera scanning and a two-phase solver need their own build; solve times landed.
- games.38 Word Arcade (the rest): word ladders, the anagram wheel, the timed letter-grid hunt and the falling-word typing game are not kinds yet.
- games.39 Text Adventures: Z-machine and Glulx interpreters need their own build.
- games.42 Draw & Guess: a doodle model and a drawing canvas need their own build.
- games.44 Codeword: a two-screen team word game needs its own build.
- games.45 Two on One Phone: split-screen duels for two at once need a two-player mode and a real-time engine.
- games.46 Play Together: phone-to-phone play needs WebRTC.
- games.48 Hand Games: hand tracking needs the camera and a hand model.
- games.49 Move!: body pose games need the camera and a pose model.
- games.50 Sky Spotter: live sky overlays need sensors and live public feeds.
- games.51 Quest Walk: GPS arrival checks need location, which no Library app reads.
- games.52 Geo Guess: street photo rounds need network images and a map.
- games.53 Kids Corner (locked mode): a locked full-screen shell with a code needs its own build; the children's games landed.
- games.56 Colouring: fill and brushes on line art need a canvas engine.
- games.57 Rhythm Run: beat detection on his own songs needs audio analysis.

## Sources
Every guide holds only facts its named source states, re-checked against the source page: the screenplay, composition,
typeface and colour theory guides against their Wikipedia articles, the poetry forms against the Poetry Foundation
glossary entries, colour vision against Colour Blind Awareness, and passport photos against GOV.UK (UK rules only).
A card game rules guide was dropped because one source page did not hold every rule.
