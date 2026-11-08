/* ONE INK's Home: no scan behind the page (a printed page has no room); the orb is the real hologram drawn in ink: the accent it reads
   from its own wrapper is bone, the glow is off (--g-glow 0), so what is left is the crisp parts: the points, the meridians, the
   equator and its scale, the core. Everything else on the page is the system's type on the warm ground in the ink world's tokens. */
import { Orb } from '../../boot/2026-11-07/orb.js';

(async () => {
  await document.fonts.ready;
  const cfg = JSON.parse(document.getElementById('cfg').textContent);
  const el = document.querySelector('.orb');
  const orb = new Orb(el.querySelector('canvas'), { level: 0.5, tokensFrom: el });
  orb.size(cfg.orb.size, cfg.orb.size, 2);
  let t0 = performance.now();
  const render = (t) => orb.draw(12.5 + t / 1000, 'idle', null, 0);
  render(0);
  window.__render = (t) => { render(t); return true; };
  if (new URLSearchParams(location.search).get('still') === null) {
    const step = () => { render(performance.now() - t0); requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  window.__frameReady = true;
})().catch((e) => { console.error(String(e && e.stack || e)); window.__frameReady = true; });
