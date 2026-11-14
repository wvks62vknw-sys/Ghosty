# libarchive.js 2.0.2, for opening real CBR comics

**What it is:** libarchive (the BSD-licensed archive library used across Unix systems) compiled to WebAssembly, with a
small JavaScript wrapper that runs it in a worker. Ghosty uses it only to open a CBR comic (a RAR file of page pictures)
that he imports himself (`apps/web/src/features/comic/rar.ts`). It reads RAR 4 and RAR 5. Nothing is sent anywhere: the
file is unpacked in the page's worker, from this site.

**When it loads:** only on his tap (COMIC → Shelf, after a CBR is picked, GET THE RAR READER with its size said, 1.1 MB),
never on mobile data. After that the browser keeps it.

**Package:** `libarchive.js@2.0.2` from the npm registry, fetched on 14 November 2026. Files copied unchanged from `dist/`:
`libarchive.js` (the wrapper, ES module), `worker-bundle.js` (the worker, a module worker), `libarchive.wasm`.
It needs no `unsafe-eval` (it builds no code at run time), so the app's security policy is unchanged.

**Licences:** libarchive.js is MIT (LICENSE here); libarchive is BSD-2-Clause; Comlink inside the wrapper is Apache-2.0.
