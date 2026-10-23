# DESIGN, the hero: three real-3D centrepieces for route C's Home, for the owner to pick

The owner chose the ORIGINAL route C (`docs/build-plan/mockups/c/`), and about its centrepiece said: "make the arc
reactor a lot better, like it doesn't even have to be an arc reactor, just something that could fit there and play
that kind of role, and is like 3D and just cool, and fits the aesthetic." One round: three options as pictures, he
picks, then it is built. Keep everything else about C's Home exactly as mocked (the greeting, the four gauges
around the hero, the ONLINE chip, the cards below): only the object in the middle changes.

## The three options (build all three as REAL three.js scenes, not CSS or paintings)

1. **CORE**: the arc reactor rebuilt in true 3D: layered glass rings with real refraction and depth, fine coils, a
   plasma core with a volumetric glow, slow precession, the housing brushed metal. The one he loves, made far better.
2. **MIND**: a hologram of Ghosty's mind: a translucent sphere holding a slowly turning constellation of nodes and
   links (clusters = the library's fields; a node lights when its field is studied), light pulses running along links
   while he thinks, the whole thing growing as he learns (honest: node count from real counts). Jarvis-style projection.
3. **GYRO**: an instrument: nested thin rings turning on three axes around a small bright core, like a gyroscope or an
   astrolabe, machined and calm; speed and glow show his state. Abstract, precise, premium.
4. If you have a better idea that fits the owner's words, add it as option 4 and say why.

For every option: the same states (idle: slow breathing; listening: opens and brightens; thinking: ripples or pulses;
studying or training: a steady pulse), one accent (reactor cyan), true black behind, real lighting and depth so it
reads as 3D at a glance, a static frame for reduce-motion, and battery sense (30 fps when idle, paused when the app is
hidden, no more than one WebGL context). It must sit exactly where the reactor sits on C's Home (same size and the
four gauges still around it).

## How

- Use the app's own vendored three.js (`apps/web/public/vendor/three/three.module.min.js` and its addons) by relative
  path or a copy under `docs/build-plan/mockups/hero/`; no network scripts; no new packages.
- Render in headless Chromium with software WebGL (the app's studio specs do this: see `tests/studio.spec.mjs` for the
  launch flags), at 440 × 956 and device scale 2: for each option, C's Home with the hero in place (`home.png`), a
  close-up of the hero alone at 3× (`closeup.png`), and the idle / listening / thinking frames side by side
  (`states.png`). Plus `hero/contact.png`: the three (or four) Homes side by side, labelled, with one line each on what
  it is, and `hero/notes.md`: motion, states, battery, and how each would be built in `apps/web/src/features/core/reactor.ts`.
- Keep the scene code under `docs/build-plan/mockups/hero/<option>/` so the winner can be ported as is.
- Review your own work ("would Apple ship this?", "is it cool?", 1–10 each); fix anything under 9; report the scores.

## Finish

Commit on your worktree branch (do not push, do not merge). Final report: every PNG's absolute path, the scores, which
option you would pick and why in two lines, and anything you could not do.
