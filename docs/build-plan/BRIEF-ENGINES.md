# BRIEF-ENGINES — DOOM and Quake as they are, natively in the browser (batch ③ part 1b, 1 Nov 2026)

Worktree from the branch tip (claude/ghosty-ai-training-idwhp9 at or after e8b4bdf). Your preview port: 8811. Read first:
BRIEF-ARCADE.md (the bar and the lines: binding), the arcade's first half in `apps/web/src/arcade/` (shelf.ts has the
DOOM, FREEDOOM and QUAKE entries and the data's checksums; store.ts fetches and unpacks; input.ts is the Intent your engines
read; levels.ts the free level packs), OWNER-ISSUES 93 (a), 94 (b), 95, 96, 97. Another builder is building the arcade
SCREEN and the DOS engine right now in `features/arcade/*`, `arcade/dos*`, `vendor/dos/*`, `tests/arcade.spec.mjs`: touch
none of those. Yours: `apps/web/src/arcade/engines/doom.ts`, `engines/quake.ts`, `engines/types.ts` (the adapter
interface below), `apps/web/public/vendor/doom/*`, `apps/web/public/vendor/quake/*`, `apps/edge/test/engines.test.mjs`,
`tests/engines.spec.mjs` with a harness page under `tests/fixtures/engines/` (NOT the app's player: integration into the
player happens after the screen lands, in a second step you will be asked for).

## The sources (already on this machine; read-only clones)

- `/home/user/ozkl/doomgeneric` — doomgeneric (GPL-2): the DOOM core with a platform layer of five functions. Do not edit
  the clone; copy what you build from into `apps/web/public/vendor/doom/src/` is NOT wanted either — vendor only the build
  output (`doom.js`, `doom.wasm`), the LICENCE, a SOURCE.md with the upstream commit SHA, and your platform file(s) and
  `build.sh` so the build reproduces from the clone's commit.
- `/home/user/triang3l/webquake` — WebQuake (GPL-2): Quake in JavaScript on WebGL. Vendor its client with a SOURCE.md and
  your patches as diff files (pak0 read from memory rather than XHR; input from our Intent; no network play).
- Toolchain: Debian's own Emscripten installs with `apt-get install -y emscripten` (3.1.6; `apt-get update` first). Use its
  built-in SDL 1.2 emulation or raw canvas calls; no Emscripten "ports" (they download at build time and will fail).
  If apt refuses, `clang-18` and `wasm-ld` are installed and `wasi-libc` is an apt package too.

## The adapter interface (`engines/types.ts`), which the DOS engine will also implement after the merge

```ts
export interface EngineFiles { [path: string]: Uint8Array }  // what the store unpacked for this game
export interface EngineHandle { pause(): void; resume(): void; quit(): Promise<void>; setSound(on: boolean): void }
export interface EngineEvents { onLevelDone?(score: number, words: string): void; onHit?(): void; onError?(e: Error): void }
export interface Engine {
  id: 'doom' | 'quake' | 'dos';
  start(canvas: HTMLCanvasElement, files: EngineFiles, intent: Intent, ev: EngineEvents, opts: { saves: SaveStore; sound: boolean }): Promise<EngineHandle>;
}
```
(`Intent` is input.ts's shared input state; `SaveStore` is a small get/put/list over IndexedDB you add in `engines/saves.ts`.)

## What to build (a commit each)

1. DOOM: doomgeneric built with Emscripten, one Ghosty platform file: frames to the canvas pixel-sharp at the engine's
   320×200 scaled to fit; input from the Intent straight into the engine's event queue (analog movement through a small
   patch as a diff file; turning as mouse motion; fire/use/weapon/map/run as keys); sound effects through WebAudio from the
   WAD's own sounds; music through an OPL emulator in wasm if you can do it within the time, else effects only, said in
   SOURCE.md; saves to the SaveStore; `onLevelDone` on an intermission and `onHit` on damage. The free episode's E1M1
   loads in under ten seconds from unpacked files and runs at DOOM's 35 fps in the harness; Freedoom Phase 1's E1M1–E1M3
   run too (doomgeneric is vanilla-limits: if a level breaks, say which and keep Freedoom's entry honest in the report).
2. QUAKE: WebQuake vendored and patched as above; the free episode from memory; touch and gamepad through the Intent (jump
   added); saves; sound. Steady frame rate at a phone-sized viewport in the harness (measure at 390×844 device pixels ×3);
   if it cannot hold it, say the numbers and leave it for the player to list only if the orchestrator decides.
3. The harness page and `tests/engines.spec.mjs`: for each engine, with the real free data fetched once at build time into
   `tests/fixtures/engines/` (NOT committed: a `fetch.sh` with the checksums from shelf.ts fetches them; the spec skips
   with a clear line when the files are absent, and CI will carry the fetch later), start → frames differ → a key moves the
   player → pause/resume → quit; fps and load time printed. `engines.test.mjs`: the SaveStore, the Intent mapping, the
   interface contract.

## The lines that hold

As BRIEF-ARCADE. Nothing commercial. Everything runs on the phone. GPL kept whole: LICENCE, SOURCE.md, patches as diffs,
a reproducible build.sh. No model names anywhere. The plain prompt untouched. No test skipped or weakened.

## Working lean

Ranged reads; `tail -30`; the brain suite once at the end under `nice -n 10`; no narration. Validation: brain typecheck +
suite; web typecheck + build; the engines spec on your preview; `deck` and `nav` green.

## The report (one message)

Base SHA, HEAD SHA, the worktree branch; commits; files (vendor sizes); the build's exact inputs (commit SHAs, Emscripten
version); fps and load times per engine; LIMITS; WHAT THE MERGE MUST KNOW (nothing shared touched, ideally).
