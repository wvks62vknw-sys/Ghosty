// One HUD mock page: draws the scan (W1's gl.js + scan.js) behind the type, then the REAL hologram (the boot's orb.js, mind.ts
// ported, with the app's vendored three.js) into the orb's canvas where the page puts it, then says the frame is ready.
// The page's numbers are in <script type="application/json" id="cfg">: { scene: { camera, uniforms, orbAt, image, imageY },
// orb: { size, state, t } }. Nothing animates: one moment, photographed by render.mjs.
(async () => {
  const cfg = JSON.parse(document.getElementById('cfg').textContent);
  await document.fonts.ready;
  if (cfg.scene) {
    const s = cfg.scene;
    await GL.scene({ frag: SCAN_FRAG, camera: s.camera, uniforms: s.uniforms, colors: { uBoneC: '--bone-rgb' }, orbAt: s.orbAt, image: s.image, imageY: s.imageY, band: 32 });
  } else {
    GL.place();
  }
  if (cfg.orb) {
    const { Orb } = await import('../../boot/2026-11-07/orb.js');
    const c = document.querySelector('.orb canvas');
    const orb = new Orb(c, { level: 0.5 });
    orb.size(cfg.orb.size, cfg.orb.size, 2);
    orb.draw(cfg.orb.t ?? 12.5, cfg.orb.state ?? 'idle', null, 0);
  }
  window.__frameReady = true;
})().catch((e) => { console.error(String(e)); window.__frameReady = true; });
