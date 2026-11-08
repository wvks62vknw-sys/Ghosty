/* HOME, THREE WORLDS, AT REST (BRIEF-HUD-MOCKS-3): the same ambient life as round two's home.js (the camera's breath, the points
   breathing, a point re-read now and then, the orb idle, the city flickering), on world3.js. On the wall the breath is in every
   camera. t = 0 is the still photographed at 2×. */
import { setupWorld, play, $ } from './world3.js';

(async () => {
  const cfg = JSON.parse($('#cfg').textContent);
  const world = await setupWorld(cfg);
  const { scan, orb, orbEl, rest } = world;
  const roomlight = $('.roomlight');
  const tiles = cfg.world.tiles || null;
  const breath = cfg.world.breath ?? 1;

  function render(t) {
    const u = t / 1000;
    const bx = 0.006 * breath * Math.sin(u * 0.5), by = 0.004 * breath * Math.sin(u * 0.37 + 1), tx = 0.004 * breath * Math.sin(u * 0.45 + 2);
    const uni = { uBuild: 1, uEdge: 1, uTime: u, uDrift: 1, uPing: -9, uPingA: 0, uOrbLit: cfg.world.orbLit ?? 1, uSparkle: 0.6, uScroll: 0 };
    if (tiles) {
      scan.renderTiles(tiles.map((tl) => ({ ...tl, cam: { pos: [tl.cam.pos[0] + bx, tl.cam.pos[1] + by, tl.cam.pos[2]], tgt: [tl.cam.tgt[0] + tx, tl.cam.tgt[1], tl.cam.tgt[2]], fov: tl.cam.fov } })), uni);
      world.camera(rest.pos, rest.tgt, rest.fov);
    } else {
      world.camera([rest.pos[0] + bx, rest.pos[1] + by, rest.pos[2]], [rest.tgt[0] + tx, rest.tgt[1], rest.tgt[2]], rest.fov);
      scan.render(uni);
    }
    if (roomlight) roomlight.style.opacity = '1';
    if (orb) { orbEl.style.opacity = '1'; orb.draw(12.5 + u, cfg.orb.state || 'idle', null, 0); world.placeOrb(); }
    world.placeLamp();
    world.placeMarks();
  }

  const still = new URLSearchParams(location.search).get('still');
  if (still !== null) render(+still || 0);
  play(render, { end: 4000, loop: true });
  window.__frameReady = true;
})().catch((e) => { console.error(String(e && e.stack || e)); window.__frameReady = true; });
