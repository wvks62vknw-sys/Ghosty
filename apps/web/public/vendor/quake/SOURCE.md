# Quake engine: WebQuake, built for the arcade

**Upstream:** WebQuake by Triang3l — https://github.com/Triang3l/webquake — commit
`917617ffdfe42fa9dca41bf1762f16a2e71f2d7b` ("README.md: Change - to — where needed, add browser support testing year").
WebQuake is id Software's Quake (the 1999 GPL source) ported by hand to JavaScript and WebGL. Only its `Client` folder
is used (the game); its `Server` folder (a Node.js dedicated server) is not.

**Licence:** GNU General Public License, version 2 — `LICENCE` here is upstream's own `GNU.md`, unchanged. Everything
in this folder is under it: the built `quake.js`, Ghosty's platform file, the patches and the build scripts. The game
data is not here: the arcade fetches the free Quake 1.06 shareware package on his tap and takes `ID1/PAK0.PAK` out of it
on the phone (`apps/web/src/arcade/shelf.ts`, `store.ts`).

## What is here

| File | What |
| --- | --- |
| `quake.js` | the build output (500,298 bytes): WebQuake's 35 client scripts, patched, its 28 GLSL shaders and `ghosty.js`, all inside one function, `GhostyQuake(host)`, so each start is a fresh Quake and no other name is left on the page |
| `ghosty.js` | Ghosty's platform layer, in place of WebQuake's `Sys.js`: the arcade's canvas (WebGL asked for without antialiasing, the engine kept from restyling it), the shaders, saved games through a stand-in for `localStorage` that the page keeps in the arcade's SaveStore, a clock that stops while paused, no network, and a small API the page drives a frame at a time |
| `patches/memory-files.diff` | `COM.js`: `pak0.pak` and every other file read from memory instead of ranged synchronous XMLHttpRequests; no web address needed |
| `patches/intent-input.diff` | `IN.js`: no mouse and no pointer lock; the view and the move come from the arcade's Intent through `Sys.Move` |
| `patches/no-network.diff` | `NET.js`: the WebSocket driver is left out (no network play; the multiplayer menu says there is none) |
| `patches/web-audio.diff` | `S.js`: today's Web Audio (WebQuake's own Web Audio path used the long-gone `createGainNode`, `noteOn`, `noteOff` and `createBuffer(data)`; it was switched off upstream and sounds went through `<audio>` elements, which a phone plays late and cannot turn down); looping sounds go silent instead of stopping; moving sounds follow the listener (`gain.value`, not `gain.volume`) |
| `bundle.mjs` | writes `quake.js` (plain Node, no packages) |
| `build.sh` | checks the clone's commit, copies its `Client` folder, applies `patches/*.diff`, runs `bundle.mjs` |

The page's side is `apps/web/src/arcade/engines/quake.ts` (in the app's bundle): it loads `quake.js` as a classic
script (WebQuake is 2014 JavaScript that needs one), hands it the canvas, the files and a WebAudio context, runs a frame
at most 72 times a second (Quake's own cap) at a pixel ratio of at most 2 and at most 1920 pixels across, turns the
Intent into Quake's own commands (`+attack`, `+jump`, `+speed`, `impulse 10` and `12`) and menu keys, decodes the
sounds, and keeps the saves (`id1/s0.sav` …) and `id1/config.cfg`.

## Rebuilding

```sh
git clone https://github.com/Triang3l/webquake && git -C webquake checkout 917617ffdfe42fa9dca41bf1762f16a2e71f2d7b
sh apps/web/public/vendor/quake/build.sh /path/to/webquake      # needs sh, patch and Node 18 or later
```

## Sound and music

Sound effects are the pak's own WAVs, decoded once each into Web Audio buffers, with Quake's stereo spatialisation,
ambient and looping sounds. Music: the shareware has none to play — Quake's music was audio tracks on its CD, not in
the package — so nothing is missing that the shareware ever had.

## What it was tried on (the evidence the arcade brief asks for)

`tests/engines.spec.mjs` on the harness page, headless Chromium, a phone's viewport held sideways (844 × 390 points,
3 device pixels a point; Quake draws at 1688 × 780 there, the ratio-2 cap), under the app's own security policy,
1 Nov 2026: `e1m1` from memory on screen about 1.3–1.6 s after `start()`; walking, turning, looking up, jumping,
FIRE's sound, pause and resume; a game saved through Quake's own menu with the arcade's buttons alone came back after a
quit and a fresh start; from the demos, pause → FIRE → FIRE started a new game on the start map. The engine's own work
(its JavaScript, the GPU aside) is 1.4–2 ms a frame on the test machine. **The frame rate there is 4–6 a second**, but
that machine has no GPU: Chromium draws WebGL in software (SwiftShader), and the main thread sits idle more than 90 %
of the time waiting for it, so the number says nothing about a phone, whose GPU draws GLQuake-era scenes many times
over. Safari on an iPhone has not run it yet (the owner's phone is the real test).

## Limits

- Not tried on a real GPU here (above). If a phone cannot hold its frame rate, the first knob is the pixel-ratio cap in
  `quake.ts` (`MAX_RATIO`).
- WebQuake's rendering is GLQuake's (filtered textures, no software-renderer look); its own options menu changes it.
- No network play; no CD music (the shareware has none); no mods (the page loads `id1` only).
