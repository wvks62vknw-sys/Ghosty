# The hero: three real-3D centrepieces for route C's Home

The owner chose the original route C and asked for a much better centrepiece: "it doesn't even have to be an arc
reactor … like 3D and just cool, and fits the aesthetic". These are three options drawn by real three.js scenes, using
the app's own vendored three.js (`apps/web/public/vendor/three/`, r186). They were rendered in headless Chromium with
software WebGL, launched with the same flags as `tests/studio.spec.mjs`. Everything else on route C's Home is unchanged:
the greeting, the four gauges round the hero, the ONLINE chip and the cards.

| Option | What it is | Pictures |
| --- | --- | --- |
| **Core** | The arc reactor rebuilt in true 3D. It has a brushed lathe-turned housing with engraved ticks and ten glowing cells under copper windings. A polished steel collar surrounds a plasma heart and ring under a real glass dome, which refracts them. Two engraved glass rings float in front at different depths, and the whole thing precesses slowly. | `core/home.png`, `core/closeup.png`, `core/states.png` |
| **Mind** | A hologram of Ghosty's mind: a sphere of light with a rim glow, faint meridians and an equator scale. Inside, a slowly turning constellation has one cluster per library field and one node per 20 passages. A node is lit when that part of the field has been studied, and light pulses run along the links while he thinks. | `mind/…` |
| **Gyro** | A machined instrument: four nested gimbal rings in titanium and gunmetal, each turning on its own axis on real pivots. The rings carry engraved scales and cyan inlays, round a small bright core in a glass shell. | `gyro/…` |

`contact.png` shows the three Homes side by side.

## States (the same four for every option)

| State | Core | Mind | Gyro |
| --- | --- | --- | --- |
| idle | breathes (glow ±6 % over 4 s), slow precession | turns once every ~70 s, breathes | rings turn slowly |
| listening | the heart grows and brightens, glass rings drift forward and apart | the constellation opens 12 %, nodes and rim brighten, a few pulses | core grows, rings fan open, inlays brighten |
| thinking | a wave of light runs round the ten cells | pulses run along the lit links | rings turn ×2.2, inlays flicker with work |
| studying / training | a steady pulse in every cell | lit nodes pulse in time | inlays pulse in time |

The states are numbers (`open`, `bright`, `speed`, `pulse`, `ripple`) from `stateParams()` in `kit.js`. Each scene's
`update(t, state, params)` reads them, so the app only ever says which state it is in.

## Honest numbers
- **Mind:** the node count is `round(passages / 20)` and the lit count is `round(studied / 20)`, both from
  `brain.library().stats`. With today's sample that is 4,186 → 209 nodes and 1,312 → 66 lit. The split across fields
  (`FIELDS` in `mind/scene.js`) is a sample until the library reports per-field counts. The gauges round it still
  show the exact figures.
- **Core** and **Gyro** show state only. Their brightness and speed follow what Ghosty is doing, not decoration.

## Battery and motion
- **One WebGL context:** the hero shares the page's single renderer with nothing else on Home. The 3D Studio's viewer
  is a different tab and is disposed when that tab is left.
- **Frame rate:** 30 fps when idle and 60 when listening, thinking or studying; no frames at all while
  `document.hidden`. See the loop in `kit.js` `mount()`.
- **Renderer settings:**
  - pixel ratio is capped at 3;
  - antialiasing is on;
  - `powerPreference: 'low-power'`;
  - geometry is built once and every frame only changes uniforms and transforms (no allocations per frame).
- **Reduce motion:** one still frame (`mount(…, { live: false })`) with no breathing, turning or pulses; a state
  change simply redraws once.
- **Cost on the iPhone 18 Pro Max:**
  - Core and Gyro are about 300 draw calls with InstancedMesh; Mind is about 30.
  - Core's glass dome and rings use `MeshPhysicalMaterial.transmission`, which adds one render pass. If that ever costs
    too much it can drop to a clearcoat-only glass that looks almost the same.
- **Lighting:** the studio reflections come from `RoomEnvironment` through `PMREMGenerator`, made once at start and
  cached.

## How the winner is built into the app
`apps/web/src/features/core/reactor.ts` keeps its public shape (`el`, `state`, `level`, `spectrum`, `frame(dt)`):
1. `el` becomes a `<canvas>` the same size and place as today's reactor canvas, with the gauges and call-outs untouched
   around it.
2. On mount it loads three.js the way the 3D Studio does (`apps/web/src/studio/three.ts`, the vendored module, never
   bundled). It then runs the option's `build()` from `docs/build-plan/mockups/hero/<option>/scene.js` unchanged, plus
   the renderer setup from `kit.js` `mount()`.
3. `frame(dt)` calls `update(time, state, stateParams(state))` and renders, honouring the 30/60 fps budget and
   `document.hidden`. `state` maps from the app's voice state:
   - `listening` → listen;
   - `thinking` and `busy` → think;
   - GYM or STUDY running → study;
   - otherwise idle.
4. `level` (the microphone level) feeds `open` while listening, so the hero opens with his voice.
5. `proLook()` themes keep the cyan accent; the gold Reactor theme would pass its own accent colour to `build()`.
6. Until three.js has loaded, the existing 2D reactor draws one frame, so Home never shows an empty hole.

## Files
- `kit.js`: renderer, environment, glow sprite, Fresnel material, state numbers, the live loop and the mock-up mount.
- `core/scene.js`, `mind/scene.js`, `gyro/scene.js`: each scene, `build(kit) → { object, update(t, state, params) }`.
- `build.py`: writes each option's `home.html`, `closeup.html`, `states.html` and the contact sheet from route C's own
  build.
- `render.mjs`: a tiny static server plus Chromium with software WebGL; it renders every PNG.
