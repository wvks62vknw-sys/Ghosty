/* HOME, RAISED, AND ALIVE (BRIEF-HUD-MOCKS-2 2): the same world.js page as the film, at rest. render(t) is Home's ambient life:
   the camera's slow breath (6 mm over four seconds, never a lurch), the scan's points breathing in their normals, a point re-read
   now and then (the sparkle), the orb turning idle, the city's lights outside the window flickering, the land sliding past a train
   window on the way. t = 0 is the still (the frame photographed at 2×); the 4-second clip is t 0..4000 at 30 fps. */
import { setupWorld, play, $ } from './world.js';
import { E } from './scene.js';

(async () => {
  const cfg = JSON.parse($('#cfg').textContent);
  const world = await setupWorld(cfg);
  const { scan, orb, orbEl, rest } = world;
  const roomlight = $('.roomlight');
  const scroll = cfg.world.scroll || 0; // metres per second the land slides (the train)

  function render(t) {
    const u = t / 1000;
    const pos = [rest.pos[0] + 0.006 * Math.sin(u * 0.5), rest.pos[1] + 0.004 * Math.sin(u * 0.37 + 1), rest.pos[2]];
    const tgt = [rest.tgt[0] + 0.004 * Math.sin(u * 0.45 + 2), rest.tgt[1], rest.tgt[2]];
    world.camera(pos, tgt, rest.fov);
    scan.render({ uBuild: 1, uEdge: 1, uTime: u, uDrift: 1, uPing: -9, uPingA: 0, uOrbLit: cfg.world.orbLit ?? 1, uSparkle: 0.6, uScroll: scroll * u });
    if (roomlight) roomlight.style.opacity = '1';
    if (orb) { orbEl.style.opacity = '1'; orb.draw(12.5 + u, cfg.orb.state || 'idle', null, 0); world.placeOrb(); }
    world.placeMarks();
  }

  const still = new URLSearchParams(location.search).get('still');
  if (still !== null) render(+still || 0);
  play(render, { end: 4000, loop: true });
  window.__frameReady = true;
})().catch((e) => { console.error(String(e && e.stack || e)); window.__frameReady = true; });
