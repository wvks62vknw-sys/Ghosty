/* ONE PAGE'S WORLD (BRIEF-HUD-MOCKS-2): the scan as points (scene.js) behind the type, the REAL hologram (the boot's orb.js, mind.ts
   ported, the app's vendored three.js) laid over it where the camera puts the orb, and the marks (reticles by data-box, callouts
   by data-px, the leader) placed again every frame so they follow a moving camera. The page's numbers are in
   <script type="application/json" id="cfg">: { world: { bounds, light, parts, camera, orbAt }, orb: { size } }.
   film.js and home.js drive it: both are a pure render(t), so a frame can be played live or photographed at any ms. */
import { Scan, E } from './scene.js';
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
  const orbW = scan.orbWorld(w.orbAt);
  scan.build({ bounds: w.bounds, light: w.light, parts: w.parts, orb: orbW, buildAt: w.buildFrom === 'orb' ? (p) => Math.hypot(p[0] - orbW.c[0], p[1] - orbW.c[1], p[2] - orbW.c[2]) / w.buildR : undefined });
  window.__scanCount = scan.count; window.__scan = scan;
  let orb = null;
  const orbEl = $('.orb');
  if (cfg.orb && orbEl) {
    orb = new Orb(orbEl.querySelector('canvas'), { level: 0.5 });
    orb.size(cfg.orb.size, cfg.orb.size, 2);
  }
  const rest = { pos: [...w.camera.pos], tgt: [...w.camera.tgt], fov: w.camera.fov };

  /** The camera for this frame, then every mark placed where its thing now is. */
  function camera(pos, tgt, fov) { scan.setCamera(pos, tgt, fov); }

  function placeOrb() {
    if (!orbEl) return null;
    const p = scan.project(orbW.c);
    const f = 0.5 / Math.tan((scan.cam.fov * Math.PI) / 360);
    const rpx = (orbW.r * scan.H * f) / p[2];
    const base = (0.9 * 0.74 * cfg.orb.size) / 2; // the sphere's radius inside its canvas
    const k = rpx / base;
    orbEl.style.left = `${(p[0] - cfg.orb.size / 2).toFixed(1)}px`;
    orbEl.style.top = `${(p[1] - cfg.orb.size / 2).toFixed(1)}px`;
    orbEl.style.transform = `scale(${k.toFixed(4)})`;
    const rl = $('.roomlight');
    if (rl) { rl.style.setProperty('--lx', `${((p[0] / scan.W) * 100).toFixed(1)}%`); rl.style.setProperty('--ly', `${((p[1] / scan.H) * 100).toFixed(1)}%`); }
    return { x: p[0], y: p[1], r: rpx };
  }

  function placeMarks() {
    for (const el of scr.querySelectorAll('[data-box]')) {
      const v = el.dataset.box.split(/[ ,]+/).map(Number);
      const b = scan.box(v, parseFloat(el.dataset.pad) || 0, parseFloat(el.dataset.min) || 0);
      Object.assign(el.style, { left: `${Math.round(b.left)}px`, top: `${Math.round(b.top)}px`, width: `${Math.round(b.right - b.left)}px`, height: `${Math.round(b.bottom - b.top)}px` });
    }
    for (const el of scr.querySelectorAll('[data-px]')) {
      const v = el.dataset.px.split(/[ ,]+/).map(Number);
      const a = el.dataset.align || 'c';
      const r = el.getBoundingClientRect();
      let left = v[0] - r.width / 2, top = v[1] - r.height / 2;
      if (a.includes('l')) left = v[0]; if (a.includes('r')) left = v[0] - r.width;
      if (a.includes('t')) top = v[1]; if (a.includes('b')) top = v[1] - r.height;
      Object.assign(el.style, { left: `${Math.round(left)}px`, top: `${Math.round(top)}px` });
    }
    // a callout's leader: from the callout's edge to the reticle's nearest edge, one straight hairline, a dot where it lands
    for (const ln of scr.querySelectorAll('svg[data-lead]')) {
      const [sa, sb] = ln.dataset.lead.split('|');
      const A = scr.querySelector(sa), B = scr.querySelector(sb);
      if (!A || !B) continue;
      const sr = scr.getBoundingClientRect();
      const R = (r) => [r.left - sr.left, r.top - sr.top, r.right - sr.left, r.bottom - sr.top];
      const ra = R(A.getBoundingClientRect()), rb = R(B.getBoundingClientRect());
      const cl = (r, x, y) => [Math.max(r[0], Math.min(r[2], x)), Math.max(r[1], Math.min(r[3], y))];
      let pb = cl(rb, (ra[0] + ra[2]) / 2, (ra[1] + ra[3]) / 2);
      let pa = cl(ra, pb[0], pb[1]);
      pb = cl(rb, pa[0], pa[1]);
      const len = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
      const k = ln.dataset.drawn === undefined ? 1 : parseFloat(ln.dataset.drawn);
      ln.setAttribute('width', W); ln.setAttribute('height', H); ln.setAttribute('viewBox', `0 0 ${W} ${H}`);
      ln.innerHTML = `<path d="M${pa[0].toFixed(1)} ${pa[1].toFixed(1)}L${pb[0].toFixed(1)} ${pb[1].toFixed(1)}" stroke-dasharray="${len.toFixed(1)}" stroke-dashoffset="${(len * (1 - k)).toFixed(1)}"/>${k >= 0.999 ? `<circle cx="${pb[0].toFixed(1)}" cy="${pb[1].toFixed(1)}" r="2"/>` : ''}`;
    }
  }

  return { scan, orb, orbEl, orbW, rest, W, H, camera, placeOrb, placeMarks, E };
}

/** The stamp line and a truth line as the real component writes them: whole segments, the dot at each segment's end. */
export function segs(el, list) {
  el.replaceChildren();
  list.forEach((p, i) => {
    const sp = document.createElement('span');
    sp.className = `g-seg${p.tone ? ' ' + p.tone : ''}`;
    sp.textContent = p.text;
    if (i < list.length - 1) { const sep = document.createElement('span'); sep.className = 'g-sep'; sep.textContent = ' ·'; sp.append(sep); }
    el.append(sp, i < list.length - 1 ? ' ' : '');
  });
}

/** The typed-out line: `words` typed at `ms` a character from `t0`, with the block cursor while it writes. */
export function typeStamp(el, words, t, t0, ms = 10, tones = {}) {
  const full = words.join(' · ');
  const typed = Math.min(full.length, Math.floor((t - t0) / ms));
  if (typed <= 0) { el.replaceChildren(); el.classList.remove('writing'); return 0; }
  let n = 0; const list = [];
  for (const w of words) {
    if (n >= typed) break;
    list.push({ text: w.slice(0, typed - n), tone: tones[w] });
    n += w.length + 3;
  }
  segs(el, list);
  const cur = document.createElement('i'); cur.className = 'g-cursor'; el.append(cur);
  el.classList.toggle('writing', typed < full.length);
  return typed / full.length;
}

/** A live loop over render(t), skippable; or, for the renderer, window.__render(t) one frame at a time. */
export function play(render, { end, skipTo = null, loop = true } = {}) {
  let t0 = performance.now(), frames = 0, raf = 0;
  const step = () => {
    const t = performance.now() - t0;
    render(t); frames++;
    if (loop || t < end) raf = requestAnimationFrame(step);
  };
  window.__render = (t) => { render(t); return true; };
  window.__frames = () => frames;
  if (new URLSearchParams(location.search).get('still') === null) {
    raf = requestAnimationFrame(step);
    if (skipTo !== null) addEventListener('pointerdown', () => { const t = performance.now() - t0; if (t < skipTo) t0 = performance.now() - skipTo; }, { passive: true });
  }
  return { stop: () => cancelAnimationFrame(raf) };
}
