/* ONE PAGE'S WORLD, ROUND THREE: round two's world.js (../2026-11-08-2/world.js) on scene3.js. The scan as points behind the
   type, the REAL hologram (the boot's orb.js) where the camera puts the orb, the marks placed again every frame; plus the wall's
   tiles (several cameras into one canvas, each with an HTML frame placed by data-tile) and the lamp's wash placed where the
   lamp projects. The page's numbers are in <script type="application/json" id="cfg">. */
import { Scan, E } from './scene3.js';
import { Orb } from '../../boot/2026-11-07/orb.js';

export const $ = (s) => document.querySelector(s);
export const $$ = (s) => [...document.querySelectorAll(s)];

export async function setupWorld(cfg, { dpr = Math.min(2, devicePixelRatio || 1) } = {}) {
  await document.fonts.ready;
  const scr = $('.screen');
  const W = scr.clientWidth, H = scr.clientHeight;
  const scan = new Scan($('canvas.gl'), { dpr });
  scan.size(W, H);
  const w = cfg.world;
  scan.setCamera(w.camera.pos, w.camera.tgt, w.camera.fov);
  const orbW = w.orbWorld ? { c: w.orbWorld, r: w.orbWorldR || 0 } : scan.orbWorld(w.orbAt);
  scan.build({ bounds: w.bounds, light: w.light, parts: w.parts, orb: orbW, buildAt: w.buildFrom === 'orb' ? (p) => Math.hypot(p[0] - orbW.c[0], p[1] - orbW.c[1], p[2] - orbW.c[2]) / w.buildR : undefined });
  window.__scanCount = scan.count; window.__scan = scan;
  let orb = null;
  const orbEl = $('.orb');
  if (cfg.orb && orbEl) {
    orb = new Orb(orbEl.querySelector('canvas'), { level: 0.5 });
    orb.size(cfg.orb.size, cfg.orb.size, 2);
  }
  const rest = { pos: [...w.camera.pos], tgt: [...w.camera.tgt], fov: w.camera.fov };

  function camera(pos, tgt, fov) { scan.setCamera(pos, tgt, fov); }

  /** The orb where the camera puts it (or, on the wall, where the page says: data-px). */
  function placeOrb() {
    if (!orbEl) return null;
    if (orbEl.dataset.fixed) {
      const [x, y] = orbEl.dataset.px.split(/[ ,]+/).map(Number);
      orbEl.style.left = `${(x - cfg.orb.size / 2).toFixed(1)}px`;
      orbEl.style.top = `${(y - cfg.orb.size / 2).toFixed(1)}px`;
      const rl = $('.roomlight');
      if (rl) { rl.style.setProperty('--lx', `${((x / W) * 100).toFixed(1)}%`); rl.style.setProperty('--ly', `${((y / H) * 100).toFixed(1)}%`); }
      return { x, y, r: cfg.orb.size * 0.9 * 0.74 / 2 };
    }
    const p = scan.project(orbW.c);
    const f = 0.5 / Math.tan((scan.cam.fov * Math.PI) / 360);
    const rpx = (orbW.r * scan.H * f) / p[2];
    const base = (0.9 * 0.74 * cfg.orb.size) / 2;
    const k = rpx / base;
    orbEl.style.left = `${(p[0] - cfg.orb.size / 2).toFixed(1)}px`;
    orbEl.style.top = `${(p[1] - cfg.orb.size / 2).toFixed(1)}px`;
    orbEl.style.transform = `scale(${k.toFixed(4)})`;
    const rl = $('.roomlight');
    if (rl) { rl.style.setProperty('--lx', `${((p[0] / scan.W) * 100).toFixed(1)}%`); rl.style.setProperty('--ly', `${((p[1] / scan.H) * 100).toFixed(1)}%`); }
    return { x: p[0], y: p[1], r: rpx };
  }

  /** The lamp's wash on the page, where the lamp projects (the warm pool is on the points; this is the glow in the air round the bulb). */
  function placeLamp() {
    const lamp = w.light.lamps && w.light.lamps[0];
    const el = $('.lamplight');
    if (!lamp || !el) return;
    const p = scan.project(lamp.at);
    if (!p) return;
    el.style.setProperty('--lx', `${((p[0] / W) * 100).toFixed(1)}%`);
    el.style.setProperty('--ly', `${((p[1] / H) * 100).toFixed(1)}%`);
  }

  function placeMarks() {
    for (const el of scr.querySelectorAll('[data-box]')) {
      const v = el.dataset.box.split(/[ ,]+/).map(Number);
      const b = scan.box(v, parseFloat(el.dataset.pad) || 0, parseFloat(el.dataset.min) || 0);
      Object.assign(el.style, { left: `${Math.round(b.left)}px`, top: `${Math.round(b.top)}px`, width: `${Math.round(b.right - b.left)}px`, height: `${Math.round(b.bottom - b.top)}px` });
    }
    for (const el of scr.querySelectorAll('[data-px]')) {
      if (el.classList.contains('orb')) continue;
      const v = el.dataset.px.split(/[ ,]+/).map(Number);
      const a = el.dataset.align || 'c';
      const r = el.getBoundingClientRect();
      let left = v[0] - r.width / 2, top = v[1] - r.height / 2;
      if (a.includes('l')) left = v[0]; if (a.includes('r')) left = v[0] - r.width;
      if (a.includes('t')) top = v[1]; if (a.includes('b')) top = v[1] - r.height;
      Object.assign(el.style, { left: `${Math.round(left)}px`, top: `${Math.round(top)}px` });
    }
    for (const el of scr.querySelectorAll('[data-tile]')) {
      const [x, y, tw, th] = el.dataset.tile.split(/[ ,]+/).map(Number);
      Object.assign(el.style, { left: `${x}px`, top: `${y}px`, width: `${tw}px`, height: `${th}px` });
    }
    for (const ln of scr.querySelectorAll('svg[data-lead]')) {
      const [sa, sb] = ln.dataset.lead.split('|');
      const A = scr.querySelector(sa), B = scr.querySelector(sb);
      if (!A || !B) continue;
      const sr = scr.getBoundingClientRect();
      const R = (r) => [r.left - sr.left, r.top - sr.top, r.right - sr.left, r.bottom - sr.top];
      let ra = R(A.getBoundingClientRect()), rb = R(B.getBoundingClientRect());
      // from the orb, the line starts at its rim, not its canvas's corner
      if (A.classList.contains('orb')) { const cx = (ra[0] + ra[2]) / 2, cy = (ra[1] + ra[3]) / 2, rr = parseFloat(A.dataset.r || 0) || (ra[2] - ra[0]) * 0.33; ra = [cx - rr, cy - rr, cx + rr, cy + rr]; }
      const cl = (r, x, y) => [Math.max(r[0], Math.min(r[2], x)), Math.max(r[1], Math.min(r[3], y))];
      let pb = cl(rb, (ra[0] + ra[2]) / 2, (ra[1] + ra[3]) / 2);
      let pa = cl(ra, pb[0], pb[1]);
      if (A.classList.contains('orb')) { const cx = (ra[0] + ra[2]) / 2, cy = (ra[1] + ra[3]) / 2, rr = (ra[2] - ra[0]) / 2; const ang = Math.atan2(pb[1] - cy, pb[0] - cx); pa = [cx + rr * Math.cos(ang), cy + rr * Math.sin(ang)]; }
      pb = cl(rb, pa[0], pa[1]);
      const len = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
      const k = ln.dataset.drawn === undefined ? 1 : parseFloat(ln.dataset.drawn);
      ln.setAttribute('width', W); ln.setAttribute('height', H); ln.setAttribute('viewBox', `0 0 ${W} ${H}`);
      ln.innerHTML = `<path d="M${pa[0].toFixed(1)} ${pa[1].toFixed(1)}L${pb[0].toFixed(1)} ${pb[1].toFixed(1)}" stroke-dasharray="${len.toFixed(1)}" stroke-dashoffset="${(len * (1 - k)).toFixed(1)}"/>${k >= 0.999 ? `<circle cx="${pb[0].toFixed(1)}" cy="${pb[1].toFixed(1)}" r="2"/>` : ''}`;
    }
  }

  return { scan, orb, orbEl, orbW, rest, W, H, camera, placeOrb, placeLamp, placeMarks, E };
}

export function play(render, { end, loop = true } = {}) {
  let t0 = performance.now(), frames = 0, raf = 0;
  const step = () => {
    const t = performance.now() - t0;
    render(t); frames++;
    if (loop || t < end) raf = requestAnimationFrame(step);
  };
  window.__render = (t) => { render(t); return true; };
  window.__frames = () => frames;
  if (new URLSearchParams(location.search).get('still') === null) raf = requestAnimationFrame(step);
  return { stop: () => cancelAnimationFrame(raf) };
}
