# The RAW reader (PHOTO · OPEN RAW)

Opens a camera RAW file (CR2, CR3, NEF, ARW, DNG, RAF, ORF and the other formats LibRaw reads) on the phone and demosaics it to a
16-bit picture. Served from this site, fetched on the owner's tap (offline packs). The file is read in memory in a worker; nothing is
fetched and nothing leaves the phone.

| File | What | Size |
| --- | --- | --- |
| `libraw.wasm` | **LibRaw 0.22.1-Release** as WebAssembly, built by the `@colorhythm/libraw-wasm` project (1.1.1, npm, MIT binding) from the LibRaw source with LibRaw's own Makefile (`-Os`, exceptions on, no threads, no libjpeg, no zlib, no Little-CMS, none of the GPL demosaic packs). SHA-256 `c4cb97a7e4372da41a1ff6ec6e1146f38deb125b733b8bbb2e9c52727953aba8`. **Unchanged.** | 0.85 MB (853,083 bytes) |
| `libraw.mjs` | the Emscripten glue for it, from the same package (`dist/libraw.mjs`). SHA-256 `ac5e654e0208d8337dd31ef5b15118f21a9e4c4b0ce96d058ed63241e889934a`. **Unchanged.** | 76 KB (76,138 bytes) |
| `worker.mjs` | ours: the worker the reader runs in (`src/photo/raw.ts` talks to it with one plain message, `read`); it calls the C functions the build exports (open, unpack, process, make a picture in memory) and answers a 16-bit picture; putting it away ends the worker, which gives the WebAssembly memory back | 3 KB |

The binding's own `index.js` (it needs the `typed-cstruct` package) is not used: no package is added to this app.

How it reads: the camera's own white balance (the numbers written in the file), LibRaw's demosaic, the camera's colours to sRGB, no automatic
brightening (nothing is clipped that the sensor held), a 16-bit picture the right way up. A sensor over 40 megapixels is read at half size
(a quarter of the pixels) because a phone's memory cannot hold more.

Not in this build: lossy-JPEG DNG, Kodak JPEG and deflate-compressed (floating-point) DNG, which need libjpeg or zlib; the app says
"I can't read that kind of RAW yet" for them. The ordinary lossless-JPEG DNG (phones' ProRAW included, when it is the lossless kind), CR2, NEF, ARW,
RAF, ORF and uncompressed files are LibRaw's own decoders. A CR3 is read as far as this LibRaw version reads it.

Licences, plainly: **LibRaw is free software under your choice of the GNU LGPL version 2.1 or the CDDL version 1.0**
(`COPYRIGHT-libraw.txt`, `LICENSE-libraw-lgpl-2.1.txt`, `LICENSE-libraw-cddl-1.0.txt`). Ghosty uses it under the LGPL as a separately
fetched file: `libraw.wasm` and `libraw.mjs` are loaded by the worker at run time on his tap and are not linked into the app's own code
(as the LAME encoder is); anyone may replace them with another build of LibRaw. The binding and the build script of
`@colorhythm/libraw-wasm` are MIT (`LICENSE-libraw-wasm-binding-mit.txt`). LibRaw: Copyright (C) 2008-2025 LibRaw LLC; it uses code from
dcraw.c by Dave Coffin (the restricted parts are not used), DCB and FBDD by Jacek Gozdz (BSD-like), the X3F library by Roland Karlsson
(BSD-like) and pieces of the Adobe DNG SDK (MIT), as `COPYRIGHT-libraw.txt` says.

Source of this build: the npm package `@colorhythm/libraw-wasm@1.1.1` (published 2026-08-03; repository github.com/colorhythm/libraw-wasm,
`packages/libraw.wasm/scripts/build.mjs` builds it); LibRaw's source is github.com/LibRaw/LibRaw tag 0.22.1.
