# three.js for the 3D STUDIO

three.js r186 — npm `three@0.186.1` (published 2026-09-24), MIT licence (`LICENSE`, © 2010-2026 three.js authors).
Loaded at runtime by `apps/web/src/studio/three.ts` the first time the 3D STUDIO tab opens; never bundled.

| File | From the package | Size |
| --- | --- | --- |
| `three.module.min.js` | `build/three.module.js` with `build/three.core.js` bundled in and minified by esbuild (the package no longer ships a minified build) | 742 KB |
| `addons/loaders/GLTFLoader.js` | `examples/jsm/loaders/GLTFLoader.js`, minified | 45 KB |
| `addons/controls/OrbitControls.js` | `examples/jsm/controls/OrbitControls.js`, minified | 20 KB |
| `addons/environments/RoomEnvironment.js` | `examples/jsm/environments/RoomEnvironment.js`, minified (soft studio reflections) | 2 KB |
| `addons/utils/BufferGeometryUtils.js`, `addons/utils/SkeletonUtils.js` | `examples/jsm/utils/…`, minified (the loader imports them) | 14 KB + 4 KB |

One change to the addons: their `import … from 'three'` is rewritten to the relative
`'../../three.module.min.js'`. A bare `'three'` needs an import map, which is an inline script — and
the app's security policy (`script-src 'self'`) allows no inline scripts. Nothing else is changed.
No DRACO decoder is included: none of the shipped samples needs it (a Draco-compressed .glb from
Files will say it cannot be read).

The studio reads pictures inside a GLB through `<img>` (TextureLoader, `img-src blob:` is allowed)
instead of the loader's default `fetch()` of a `blob:` address, which `connect-src` does not allow
— done with a loader plugin in `studio/viewer.ts`, not by editing the file.
