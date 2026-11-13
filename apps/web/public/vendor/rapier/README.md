# Rapier for the 3-D ENGINE's physics

Rapier, 3-D physics in Rust, npm `@dimforge/rapier3d-compat@0.21.0`, Apache-2.0 (`LICENSE`, the package's own file). The "compat" build
carries its WebAssembly inline as base64, so one file is all there is.

| File | From the package | Size |
| --- | --- | --- |
| `rapier.mjs` | `dist/rapier.mjs`, unchanged | 4,340,292 bytes (its WebAssembly is 3,082,103 bytes of that, as base64) |

Loaded at runtime by `apps/web/src/engine3d/physics.ts` the first time PHYSICS is turned ON in the 3-D engine's pane; never bundled, never
fetched when the pane opens, never on the first screen's path. The page's security policy allows it (`script-src 'self' 'wasm-unsafe-eval'`).
It is also the one dependency of `apps/web/package.json` (the version and its integrity hash are in `package-lock.json`); the file here is
that package's file, copied, so the app serves it itself, as it serves three.js.
