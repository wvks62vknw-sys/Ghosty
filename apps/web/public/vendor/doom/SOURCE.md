# DOOM engine: doomgeneric, built for the arcade

**Upstream:** doomgeneric by ozkl and contributors — https://github.com/ozkl/doomgeneric — commit
`e257a09527062bfb986b6e5e0780839b6cbd5b71` ("Merge pull request #39 from yughias/compile-mingw"). doomgeneric is the
DOOM source (id Software's 1997 release, by way of Chocolate Doom) with a platform layer of a few functions.

**Licence:** GNU General Public License, version 2 — `LICENCE` here is upstream's own `LICENSE`, unchanged. Everything in
this folder is under it: the build output, Ghosty's platform file and the patches. The game data is not here: the arcade
fetches the free packages (Freedoom; the DOOM 1.9 shareware) on his tap and unpacks them on the phone
(`apps/web/src/arcade/shelf.ts`, `store.ts`).

## What is here

| File | What |
| --- | --- |
| `doom.js`, `doom.wasm` | the build output: an ES module (`GhostyDoom`, a factory) and its WebAssembly |
| `doomgeneric_ghosty.c` | Ghosty's platform layer (the only new C): frames to the page, keys and analog input from the page, sound effects to WebAudio, the page's clock, the save and settings files |
| `patches/analog-movement.diff` | `g_game.c`: the stick's own amount goes into the move (`dg_analog_forward`, `dg_analog_side`), as an analog joystick would give it |
| `patches/screen-melt.diff` | `d_main.c`: the screen melt runs one step a frame instead of in a loop (a page shows nothing until a frame returns) |
| `patches/save-names.diff` | `m_menu.c`: an empty save slot is named for the level ("E1M1"), so a phone with no keyboard saves with one tap |
| `build.sh` | rebuilds `doom.js` and `doom.wasm` from a clone of the commit above with these files |
| `LICENCE` | GPL-2, upstream's |

The page's side is `apps/web/src/arcade/engines/doom.ts` (in the app's bundle): it loads `doom.js` from here, writes the
game's files and saved games into the engine's memory, runs the engine at DOOM's 35 tics a second on a clock that stops
while paused, turns the arcade's Intent into DOOM's keys, turning and analog movement, draws each 320 × 200 frame
pixel-sharp in the 4:3 shape DOOM was made for, plays the sound effects and keeps the saves in the arcade's SaveStore.

## Rebuilding

```sh
apt-get install -y emscripten                       # Debian/Ubuntu: Emscripten 3.1.6 (3.1.6~dfsg-7, its clang 15.0.7)
git clone https://github.com/ozkl/doomgeneric && git -C doomgeneric checkout e257a09527062bfb986b6e5e0780839b6cbd5b71
sh apps/web/public/vendor/doom/build.sh /path/to/doomgeneric
```

`build.sh` checks the clone's commit, copies its sources to a scratch folder, applies `patches/*.diff`, adds
`doomgeneric_ghosty.c` and compiles: `-O2`, `-DFEATURE_SOUND -DDOOMGENERIC_RESX=320 -DDOOMGENERIC_RESY=200`, linked
`MODULARIZE=1 EXPORT_ES6=1 ENVIRONMENT=web DYNAMIC_EXECUTION=0` (no `eval`: it runs under the app's security policy),
64 MB initial memory, growable. No Emscripten "ports" (nothing is downloaded at build time); no SDL.
This build: `doom.js` 72,297 bytes, `doom.wasm` 383,730 bytes.

## Sound and music

Sound effects are the WAD's own (DMX format, 8-bit), resampled once each into WebAudio buffers and played on DOOM's eight
channels with its volume and stereo separation. **Music is not played in this build.** DOOM's music is MUS, written for
the OPL2 FM chip of a Sound Blaster (or a General MIDI synth); playing it needs an OPL emulator, which doomgeneric does
not carry, and this build fetched no source beyond the two the owner allowed. The engine starts with `-nomusic`. A later
build can add one (Chocolate Doom's OPL library, GPL-2, is the natural pick) without touching the page's side much.

## What it was tried on (the evidence the arcade brief asks for)

`tests/engines.spec.mjs` on the harness page, headless Chromium with a software GPU, a phone's viewport held sideways
(844 × 390 points, 3 device pixels a point), under the app's own security policy, 1 Nov 2026:

- the DOOM 1.9 shareware's E1M1 (from `doom19s.zip`, DOOM1.WAD taken out on the page): unpacked in about 0.1 s, on
  screen 0.1–0.3 s after `start()`; 34–35 frames a second (DOOM's 35); walking, turning, pause and resume, FIRE's sound;
  a game saved through DOOM's own menu with the arcade's buttons alone came back exactly after a quit and a fresh start;
  from the title, FIRE alone reached E1M1 through NEW GAME, the episode and the skill;
- Freedoom Phase 1 (0.13.0, `freedoom1.wad`) E1M1, E1M2 and E1M3 at 34–35 frames a second, each loaded, drawn and
  walked.

Safari on an iPhone has not run it yet (the owner's phone is the real test).

## Limits

- Vanilla limits: doomgeneric is the original engine (by way of Chocolate Doom), so a level made for a
  "limit-removing" port can overflow it (too many visplanes, segs or sprites) and stop with an error.
- No DeHackEd: doomgeneric has no `.deh` support. A level pack that ships a `.deh` plays its maps but not its patch
  (renamed levels, changed monsters or text).
- No music (above). No network play (the page never starts it).
