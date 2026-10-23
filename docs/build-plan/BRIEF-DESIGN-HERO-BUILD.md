# DESIGN, the hero build: MIND into the app, a little better

The owner picked **Mind** ("Mind but a little bit better too"). Port `docs/build-plan/mockups/hero/mind/scene.js`
and `hero/kit.js` into the real app as Home's centrepiece, improved as below, honest and light on the battery.
Read BRIEF-W0.md (shared rules), `hero/notes.md` (your own porting notes), MAP.md's entries for `features/core/*`
(`reactor.ts` draws today's reactor; `features/core/index.ts` lays out Home and sets `--glow`), the 3D STUDIO's way
of loading the vendored three.js (`apps/web/src/studio/three.ts`: the only allowed way, no network scripts, the CSP
stays), `assistant/voice.ts` (listening state), `assistant/session.ts` (a reply in flight), `features/gym/store.ts`
and `features/library/index.ts` (what is studying or training and the per-field counts).

Another builder (route C, BRIEF-DESIGN-BUILD-1.md) is restyling Home and the whole app at the same time, including
the size and position of the hero and the four gauges around it. Work ONLY in: a new `apps/web/src/features/core/mind.ts`
(the scene), `apps/web/src/features/core/reactor.ts` (mount Mind there; keep today's 2-D reactor as the fallback),
a new `tests/hero.spec.mjs`, `apps/web/styles.css` only inside one marked `/* hero: mind */` block, MAP.md's entry.
Do not touch `features/core/index.ts` or anything else: if the mount needs a hook there, state the exact line in
your report.

## A little better (do all)

1. **Structure you can read.** Clusters, one per field of the library, from REAL counts (the Library tab's summary gives
   per-field totals and what is studied; a node per 20 passages as in the mock-up, lit when studied), each cluster
   with a soft glow so the constellation reads as organised, not random; lit nodes brighter with a tiny halo; links
   thin, brighter near lit nodes; a few slow pulses always travelling, many fast ones while he thinks.
2. **The sphere.** A crisper Fresnel rim, a faint inner haze, the latitude grid fainter, the equator ring with its ticks
   plus one thin tilted ring; the core brighter with a soft halo and a slow breath.
3. **States from real state**: idle (slow turn, breathing), listening (the sphere opens a little, the rim brightens, a
   soft ring expands with the mic level), thinking (pulses race along the links while a reply is in flight), busy
   (studying or training: a steady slow pulse of the lit nodes), offline (rim and core dim to grey). `--glow` from
   features/core keeps working as today.
4. **Light on the battery.** three.js is loaded lazily the way the studio loads it, only when Home is shown; one WebGL
   context; 30 fps when idle, 60 for a second after a state change, paused when the tab is hidden or the hero is
   scrolled out of view; device pixel ratio capped at 2; the canvas sized to the hero's box (the route C size).
   `prefers-reduced-motion`: one static frame, no loop. No WebGL, or three.js fails to load: today's 2-D reactor stays.
5. **Honest numbers.** Nothing invented: the node counts, lit counts and clusters come from the app; with an empty
   library the sphere still looks whole (a sparse constellation and the core), and says nothing false.

## Tests and checks

`tests/hero.spec.mjs` at 440 × 956 (Chromium with `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`
like `tests/studio.spec.mjs`): Home shows the Mind canvas once three.js has loaded; the node count follows the mock
brain's library counts; the listening and thinking states change what is drawn (check the exported state, and a pixel
difference between two frames); reduce-motion renders one frame and no loop; with WebGL unavailable the 2-D reactor
shows. `npm run check` in `apps/web`. Measure and report frame time at idle in Chromium (software) as a number.

## How to run things here

Your own worktree, fast-forwarded to the branch (`git merge --ff-only claude/ghosty-ai-training-idwhp9`); `cd apps/edge && npm install --no-audit --no-fund`
once (builds the interface); the brain bundle with the esbuild line from BRIEF-GYM3.md; preview port **8806**;
`BASE=http://localhost:8806 node tests/hero.spec.mjs /tmp/hero-shots`. Screenshots of Home with Mind in each state to
`/tmp/claude-0/-home-user-Ghosty/6a05925c-6839-5546-8e68-c6df376dadfa/scratchpad/hero-build/` (the owner sees them).

## Finish

Commit on your worktree branch (do not push, do not merge). Final report: the commit hashes; where the counts come
from; the states and what drives them; the frame-time number; the spec's result; the screenshot paths; the exact
line (if any) needed in `features/core/index.ts`; anything not done and why.
