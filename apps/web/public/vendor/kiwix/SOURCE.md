# Kiwix's ZIM reader, vendored (WIKIPEDIA, OFFLINE)

Ghosty reads the Wikipedia files kept on the phone (the Library → WIKIPEDIA, OFFLINE; `apps/web/src/wiki/`) with
**Kiwix's own JavaScript reader**: the ZIM format's header, directory, title index and clusters, and the xz and zstd
decoders it ships as WebAssembly. Nothing else of the Kiwix app is taken (no UI, no service worker, no libzim).

- **From:** https://github.com/kiwix/kiwix-js, commit `bb2821c65cd7c4207e44dc4ad5b7a775be880096` (25 Oct 2026),
  `git clone --depth 1` on 1 Nov 2026.
- **Licence:** GPL-3.0 (kiwix-js; its text is `LICENCE` here, from the repository's `LICENSE-GPLv3.txt`). The decoders
  compiled into the two `.wasm` files: XZ Embedded by Lasse Collin (public domain) and Zstandard's decompressor by Yann
  Collet / Meta (BSD or GPLv2, at the user's choice), as kiwix-js builds them (`emscripten/xzdec`, `emscripten/zstandard`).
- **Loaded:** at runtime from `/vendor/kiwix/` (never bundled into app.js): `apps/web/src/wiki/zim.ts` imports
  `zimfile.js` at the first search and starts both decoders then. The service worker keeps `/vendor/*` once fetched, so
  the reader works with no signal afterwards.

## The files taken (all from `www/js/lib/`)

| file | bytes | as taken |
| --- | ---: | --- |
| `zimfile.js` | 24,217 | patched (below) |
| `zimDirEntry.js` | 4,277 | unchanged |
| `util.js` | 17,313 | unchanged |
| `utf8.js` | 3,195 | unchanged |
| `filecache.js` | 7,486 | unchanged |
| `xzdec_wrapper.js` | 7,163 | patched (below) |
| `zstddec_wrapper.js` | 13,913 | patched (below) |
| `xzdec-wasm.js` | 4,800 | unchanged (Emscripten glue, an ES module) |
| `xzdec-wasm.wasm` | 14,745 | unchanged |
| `zstddec-wasm.js` | 6,709 | unchanged |
| `zstddec-wasm.wasm` | 46,776 | unchanged |
| `params.js` | 373 | **ours**: stands in for the page-wide `params` object of kiwix-js `www/js/init.js` |

Not taken: `zimArchive.js` and `uiUtil.js` (the Kiwix app's archive layer and UI: Ghosty's own `wiki/zim.ts` does the
search, the paths, redirects and metadata over `zimfile.js`), the asm.js decoders (`xzdec-asm.js`, `zstddec-asm.js`:
every browser Ghosty runs in has WebAssembly), libzim.

## The security policy

It runs inside the app's own policy (`apps/web/public/_headers`) unchanged: scripts only from this site (`script-src
'self'`), the decoders compiled under `'wasm-unsafe-eval'`, which the policy already has, their `.wasm` fetched from this
site (`connect-src 'self'`). No `eval`, no `new Function` (checked: the Emscripten glue has neither). The articles are
shown in a frame that runs no script at all (`sandbox="allow-same-origin"`, the document given as `srcdoc`, so it inherits
the same policy); see `apps/web/src/wiki/html.ts`.

## Where the files come from: through the Worker

download.kiwix.org answers with CORS headers, but sends every file from mirrors (e.g. `wi.mirror.driftle.ss`,
`dumps.wikimedia.org`, `ftp.nluug.nl`) that send none (checked 1 Nov 2026), so the phone cannot fetch a file itself. The
Worker passes the owner's Range requests on and streams each answer back (`/api/zim/<file>`, `apps/edge/src/zim.ts`):
only for the owner, only Wikipedia files by their Kiwix names, a piece at a time (64 MB at most; the phone asks 8 MB),
never a file over 4 GB, nothing cached or kept on the Worker, and the brain never reads a byte. On the free plan this
costs nothing: a streamed answer is not a size the plan limits per request, and the bytes pass through without the
Worker's CPU touching them (1.1 GB is about 131 requests).

## Our patches, as diffs (`diff -u <kiwix-js www/js/lib/…> <here>`)

What they do: (1) `params` is imported from `./params.js` instead of being a page-wide global; (2) the decoder wrappers
take only the WebAssembly builds (no asm.js fallback, no `uiUtil.js` error panel) and start on first use or on `init()`,
not when imported, with Emscripten options (the tests give `wasmBinary` read from disk); a decoder that cannot start
rejects the read instead of leaving it waiting for ever.

### `zimfile.js`

```diff
--- kiwix-js/www/js/lib/zimfile.js
+++ apps/web/public/vendor/kiwix/zimfile.js
@@ -22,8 +22,8 @@
 
 'use strict';
 
-/* global params */
-
+// [Ghosty patch] No page-wide `params` (Kiwix's init.js): ./params.js stands in.
+import params from './params.js';
 import xz from './xzdec_wrapper.js';
 import zstd from './zstddec_wrapper.js';
 import util from './util.js';
```

### `xzdec_wrapper.js`

```diff
--- kiwix-js/www/js/lib/xzdec_wrapper.js
+++ apps/web/public/vendor/kiwix/xzdec_wrapper.js
@@ -21,23 +21,13 @@
  */
 'use strict';
 
-/* global self, params */
-
-import uiUtil from './uiUtil.js';
-import XZASM from './xzdec-asm.js';
+// [Ghosty patch] No page-wide `params` (Kiwix's init.js): ./params.js stands in. WASM only: the asm.js fallback and the
+// UI's error panel (uiUtil.js) are not taken.
+import params from './params.js';
 import XZWASM from './xzdec-wasm.js';
 
 // Variable specific to this decompressor (will be used to populate global variable)
-var XZMachineType = null;
-
-// Select asm or wasm conditionally
-if ('WebAssembly' in self && 'fetch' in self) {
-    console.debug('Instantiating WASM xz decoder');
-    XZMachineType = 'WASM';
-} else {
-    console.debug('Instantiating ASM xz decoder');
-    XZMachineType = 'ASM';
-}
+var XZMachineType = 'WASM';
 
 // DEV: xzdec.js has been compiled with `-s EXPORT_NAME="XZ" -s MODULARIZE=1` to avoid a clash with zstddec.js
 // For explanation of loading method below to avoid conflicts, see https://github.com/emscripten-core/emscripten/blob/master/src/settings.js
@@ -52,27 +42,22 @@
  */
 var xzdec;
 
-var loadASM = function () {
-    XZASM().then(function (instance) {
-        params.decompressorAPI.assemblerMachineType = XZMachineType;
-        xzdec = instance;
-    }).catch(function (err) {
-        uiUtil.reportAssemblerErrorToAPIStatusPanel('XZ', err, XZMachineType);
-    });
-};
-
-if (XZMachineType === 'WASM') {
-    XZWASM().then(function (instance) {
-        params.decompressorAPI.assemblerMachineType = XZMachineType;
-        xzdec = instance;
-    }).catch(function (err) {
-        console.warn('WASM xz decoder failed to load, falling back to ASM because:', err.message || err);
-        XZMachineType = 'ASM';
-        loadASM();
-    });
-} else {
-    loadASM();
-};
+// [Ghosty patch] Started on first use, not at import (the page pays nothing until a ZIM is read). `init(options)` hands
+// Emscripten its options (the tests give `wasmBinary` read from disk); a decoder that cannot start rejects the read
+// instead of leaving it waiting for ever.
+var starting = null;
+function init (options) {
+    if (!starting) {
+        starting = XZWASM(options || {}).then(function (instance) {
+            params.decompressorAPI.assemblerMachineType = XZMachineType;
+            xzdec = instance;
+        }).catch(function (err) {
+            starting = null;
+            throw err;
+        });
+    }
+    return starting;
+}
 
 /**
  * Number of milliseconds to wait for the decompressor to be available for another chunk
@@ -140,6 +125,12 @@
     // Tests whether the decompressor is ready (initiated) and not busy
     if (xzdec && !busy) {
         return this.readSlice(offset, length);
+    } else if (!xzdec) {
+        // [Ghosty patch] not started yet: start it, then read (a failed start rejects the read)
+        var me = this;
+        return init().then(function () {
+            return me.readSliceSingleThread(offset, length);
+        });
     } else {
         // The decompressor is already in progress.
         // To avoid using too much memory, we wait until it has finished
@@ -215,5 +206,6 @@
 };
 
 export default {
-    Decompressor: Decompressor
+    Decompressor: Decompressor,
+    init: init
 }
```

### `zstddec_wrapper.js`

```diff
--- kiwix-js/www/js/lib/zstddec_wrapper.js
+++ apps/web/public/vendor/kiwix/zstddec_wrapper.js
@@ -22,11 +22,11 @@
 
 'use strict';
 
-/* global params */
 /* eslint-disable no-multi-spaces */
 
-import uiUtil from './uiUtil.js';
-import ZDASM from './zstddec-asm.js';
+// [Ghosty patch] No page-wide `params` (Kiwix's init.js): ./params.js stands in. WASM only: the asm.js fallback and the
+// UI's error panel (uiUtil.js) are not taken.
+import params from './params.js';
 import ZDWASM from './zstddec-wasm.js';
 
 // Variable specific to this decompressor (will be used to populate global variable)
@@ -94,35 +94,22 @@
     zd._outBuffer.dst = mallocOrDie(zd._outBuffer.size);
 };
 
-// Select asm or wasm conditionally
-if ('WebAssembly' in self && 'fetch' in self) {
-    console.debug('Instantiating WASM zstandard decoder');
-    ZSTDMachineType = 'WASM';
-} else {
-    console.debug('Instantiating ASM zstandard decoder');
-    ZSTDMachineType = 'ASM';
-}
-
-var loadASM = function () {
-    ZDASM().then(function (inst) {
-        params.decompressorAPI.assemblerMachineType = ZSTDMachineType;
-        instantiateDecoder(inst);
-    }).catch(function (err) {
-        uiUtil.reportAssemblerErrorToAPIStatusPanel('ZSTD', err, ZSTDMachineType);
-    });
-};
-
-if (ZSTDMachineType === 'WASM') {
-    ZDWASM().then(function (inst) {
-        params.decompressorAPI.assemblerMachineType = ZSTDMachineType;
-        instantiateDecoder(inst);
-    }).catch(function (err) {
-        console.warn('WASM zstd decoder failed to load, falling back to ASM because:', err.message || err);
-        ZSTDMachineType = 'ASM';
-        loadASM();
-    });
-} else {
-    loadASM();
+// [Ghosty patch] WASM only, started on first use, not at import (the page pays nothing until a ZIM is read).
+// `init(options)` hands Emscripten its options (the tests give `wasmBinary` read from disk); a decoder that cannot
+// start rejects the read instead of leaving it waiting for ever.
+ZSTDMachineType = 'WASM';
+var starting = null;
+function init (options) {
+    if (!starting) {
+        starting = ZDWASM(options || {}).then(function (inst) {
+            params.decompressorAPI.assemblerMachineType = ZSTDMachineType;
+            instantiateDecoder(inst);
+        }).catch(function (err) {
+            starting = null;
+            throw err;
+        });
+    }
+    return starting;
 }
 
 /**
@@ -198,6 +185,12 @@
     // Tests whether the decompressor is ready (initiated) and not busy
     if (zd && !busy) {
         return this.readSlice(offset, length);
+    } else if (!zd) {
+        // [Ghosty patch] not started yet: start it, then read (a failed start rejects the read)
+        var me = this;
+        return init().then(function () {
+            return me.readSliceSingleThread(offset, length);
+        });
     } else {
         // The decompressor is already in progress.
         // To avoid using too much memory, we wait until it has finished
@@ -303,5 +296,6 @@
 }
 
 export default {
-    Decompressor: Decompressor
+    Decompressor: Decompressor,
+    init: init
 }
```
