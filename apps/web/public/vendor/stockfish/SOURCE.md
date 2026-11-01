# Stockfish 19 (lite, single-threaded WebAssembly), for the GYM's rated chess

**What it is:** the Stockfish chess engine compiled to WebAssembly by Nathan Rugg (Stockfish.js, made for Chess.com),
published on npm as `stockfish`. Ghosty runs it in a Web Worker on the phone to play rated games against him and against
Ghosty's own chess, and to check a game afterwards (`apps/web/src/gym/chessengine.ts`). Nothing is sent anywhere.

**Package:** `stockfish@19.0.1` (the highest version `stockfish@19` resolves to), fetched with `npm pack stockfish@19`.

| | |
| --- | --- |
| npm tarball | `stockfish-19.0.1.tgz` |
| integrity (npm, SHA-512) | `sha512-bTwsO4e9HAwPBKls1+szcfibmaWRNzTF20rQE/XPdB3LOSoT6XTZDr1zYwriwSRRFT5MkvqrglPmJrKEVXGnyQ==` |
| tarball SHA-256 | `c3695e2a3afbc61c6439c689cb8b95cec4627bcda407193f6b7c3a5702fac839` |
| upstream | https://github.com/nmrugg/stockfish.js (release v19.0.1), built from https://github.com/official-stockfish/Stockfish |
| engine's net | `nn-61e7af4bb97d` (the lite net by sscg13, named in the file's own header) |

**Licence:** GNU General Public License, version 3 — `LICENCE` here is the package's own `Copying.txt`, unchanged. The two
engine files are GPL-3.0 and are taken as the package ships them, byte for byte (no patch). The complete corresponding source
is upstream's (the two repositories above, at the version above); a copy of it is available from the owner of this repository
on request. The code in this repository that talks to the engine (`chessengine.ts`, `chessuci.ts`) is only a client of its
UCI text protocol over `postMessage`.

## What is here

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `stockfish-19-lite-single.js` | 28,230 | `ccb130d7ff29408531c47d859a49f91d59d4f482d05a53eb1a3231a4f624c91a` |
| `stockfish-19-lite-single.wasm` | 1,845,971 | `ee4f115bdb2d32cadf96cada104a05b5ec257d7ad6f57582190b49bc71f096de` |
| `LICENCE` | 35,821 | `0b383d5a63da644f628d99c33976ea6487ed89aaa59f0b3257992deac1171e6b` |

The script expects the `.wasm` beside it (same name) and both must be served as `text/javascript` and `application/wasm`; the
app's policy allows the engine (`script-src 'self' 'wasm-unsafe-eval'`, `worker-src 'self'`). The single-threaded build needs
no cross-origin isolation. The "lite" net is smaller and weaker than the full one (about 1.8 MB against 94 MB), still far
stronger than any person; the app limits its strength with UCI_LimitStrength and UCI_Elo.

## About its Elo labels

UCI_Elo is Stockfish's own setting: the engine reports its range when asked (`option name UCI_Elo ... min .. max ..`) and the
app clamps to what it reports (Stockfish's published range is 1320 to 3190). The label is APPROXIMATE: Stockfish calibrated it
at a long time control and anchored it to the CCRL 40/4 list, so on a phone that thinks for a fraction of a second a move it
plays near its label, not on it. The app's first level (the "starter", about 900) is not a published number: it is Stockfish's
`Skill Level 0` with a one-move search, and its label is Ghosty's own estimate, said so wherever it appears
(`apps/web/src/gym/chessrate.ts`).

## Updating

```sh
npm pack stockfish@19                 # into an empty scratch folder
mkdir x && tar -xzf stockfish-*.tgz -C x
cp x/package/bin/stockfish-19-lite-single.{js,wasm} apps/web/public/vendor/stockfish/
cp x/package/Copying.txt apps/web/public/vendor/stockfish/LICENCE
sha256sum apps/web/public/vendor/stockfish/*       # then update the table above and ENGINE_URL in chessengine.ts if the name changed
```
