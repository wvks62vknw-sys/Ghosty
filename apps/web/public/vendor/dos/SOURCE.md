# The DOS engine: DOSBox in WebAssembly

Upstream: the `emulators` package (the engine under js-dos 8), https://github.com/js-dos/emulators, by Alexander
Guryanov (caiiiycuk). Licence: GPL-2.0 (LICENCE in this folder is the package's own LICENSE, unchanged).

- npm: `emulators@8.5.2`
- integrity: `sha512-XW+1SsuYd/egY1EmuOpq6k9kUqrGyoaN8o1sqkVvDJRFWy4lrCqst3of6TBZj1m//4aU/ZSt5VbqQBcRl+Uk1Q==`
- shasum: `f6974960e14505919b007e58fc37a345a7cac673`; gitHead `6bbf0925d221a7304ea8e0dda1e89b8dc01569b2`

Files, as they are in the package (`npm pack emulators@8.5.2`, `package/dist/`), unchanged:

| file | bytes | sha256 |
| --- | ---: | --- |
| emulators.js | 90,630 | 066176a9e9e6babfb5388552a5154f3c1f81ed778af3bf4a1f9f904161e3c4bb |
| wdosbox.js | 114,763 | a0806cc99e0c66bc594e7efd78eb22d675af7ebb0a4de543697cbe5cd7440a2e |
| wdosbox.wasm | 1,459,535 | b33afba80de1a420c123086e5952d135de041f9e85d4444170e29d9249ec049c |
| audio-worklet.js | 7,580 | 8348e29be7f9c48bda38fe87f2f9c5d2064c1ccf8629842dd9a2a15a1197d580 |

`audio-worklet.js` is the package's own sound player: the text of the `audioWorkletCode` string in `emulators.js`,
written out as a file (the package loads it from a blob: URL, which Ghosty's pages do not allow).

How Ghosty runs it (apps/web/src/arcade/engines/dos.ts): the page's rules allow no `eval` and no blob: workers, so the
package's own loader is not used. `wdosbox.js` runs as a Worker from this folder (it fetches `wdosbox.wasm` beside it),
`emulators.js` gives only its protocol client (`emulators.backend`), and the worker's sound goes straight to
`audio-worklet.js` on the arcade's AudioContext.

## Which backend (measured, 1 Nov 2026)

The package has two: DOSBox (`wdosbox`, 1.46 MB) and DOSBox-X (`wdosbox-x`, 8.0 MB). Both were run in a Worker in the
preview (headless Chromium, a shared 4-core Xeon at 2.8 GHz under a load of ~12) on DOOM 1.9 shareware's demo loop for
25 seconds, `cycles=max`, Sound Blaster 16:

| backend | first frame | frames a second (median, of DOOM's 35) | DOSBox cycles reached |
| --- | ---: | ---: | ---: |
| DOSBox (`wdosbox`) | 0.41 s | 25 | 17,000–63,000 |
| DOSBox-X (`wdosbox-x`) | 0.92 s | 20 | 14,000–56,000 |

DOSBox is faster and a sixth of the size, so only it is vendored.
