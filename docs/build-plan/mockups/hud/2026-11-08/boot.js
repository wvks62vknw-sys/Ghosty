// ONE FRAME OF THE RICHER BOOT (BRIEF-HUD-MOCKS 6; his words in 156: "longer, richer, the world assembling the scan building up
// and the feeds answering ... polished"). The page's #cfg holds the cut (build.py's BOOT_CUT, one source for the frames and the
// captions) and this frame's moment T in ms. Nothing animates: the page draws the one moment and sets window.__frameReady.
// The room is W1's scan (scan.js: uBuild sweeps the sampling in), the orb is the real hologram (orb.js) forming from his
// library's points where Home keeps it (131: the orb in the middle), the marks are the design system's.
(async () => {
  const cfg = JSON.parse(document.getElementById('cfg').textContent);
  const T = cfg.t, C = cfg.cut, LOCK = 160, TYPE_MS = 10;
  await document.fonts.ready;
  const clamp = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k);
  const easeOut = (k) => 1 - Math.pow(1 - clamp(k), 3);
  const easeInOut = (k) => { const x = clamp(k); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const seg = (a, b) => clamp((T - a) / (b - a));
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  // (1) the ground, one breath: the room's light breathing in where the orb will be
  $('.roomlight').style.opacity = easeOut(seg(C.ground, C.ground + 500)).toFixed(3);

  // (2) the scan building up: the points sampled in from the back-left corner; (3) the edges drawn a step behind; the window's city
  // outside lights as the feeds answer
  const build = T >= C.scan + 1300 ? 1 : 1 - Math.pow(1 - seg(C.scan, C.scan + 1300), 2);
  const edge = easeOut(seg(C.edges, C.edges + 700));
  const windowLit = easeOut(seg(C.feeds, C.feeds + 600));
  const s = cfg.scene;
  s.uniforms.uBuild = build;
  s.uniforms.uEdge = edge;
  s.uniforms.uWindow = windowLit;
  // the orb's light grows with the orb
  s.uniforms.uOrbLit = 0.15 + 1.1 * easeOut(seg(C.orb, C.orb + 900));

  // the things found: each reticle and tag snaps on when the scan reaches it, one after another (the recognition of the room)
  $$('.ret[data-ms]').forEach((el) => {
    const at = +el.dataset.ms;
    const k = easeOut(seg(at, at + LOCK));
    el.style.opacity = k.toFixed(3);
    el.style.transform = `scale(${(1.1 - 0.1 * k).toFixed(3)})`;
  });
  await GL.scene({ frag: SCAN_FRAG, camera: s.camera, uniforms: s.uniforms, colors: { uBoneC: '--bone-rgb' }, orbAt: s.orbAt, band: 32 });

  // (4) the orb forms from his library's points where Home keeps it; the sweep passes; the sphere resolves from the inside out
  const { Orb } = await import('../../boot/2026-11-07/orb.js');
  const G = C.orb, S = G + 640, N = C.recognise;
  const push = 1 + 0.45 * (1 - easeInOut(seg(G, N)));
  let look = null;
  if (T < C.land) {
    look = {
      gather: seg(G, S), links: seg(G + 320, S + 50), haze: easeOut(seg(S - 150, S + 250)), mer: seg(S + 80, S + 640),
      sphere: easeInOut(seg(S + 250, S + 650)), rim: easeInOut(seg(S + 420, S + 820)), scale: seg(S + 300, N), core: 1,
      turn: -0.35 * (1 - easeInOut(seg(S, N))), push, sweep: T >= G + 240 && T <= G + 540 ? 1.1 - 2.2 * seg(G + 240, G + 540) : NaN, trails: 1, refract: 1,
    };
  }
  const orbEl = $('.orb');
  const fade = seg(G, G + 140);
  orbEl.style.opacity = fade.toFixed(3);
  const state = T >= C.greeting && T < C.now ? 'saying' : T >= C.recognise ? 'attending' : 'idle';
  if (fade > 0) {
    const orb = new Orb($('.orb canvas'), { level: 0.5 });
    orb.size(cfg.orb.size, cfg.orb.size, 2);
    orb.draw(12.5 + T / 1000, state, look, 0);
  }
  // the orb's box: the sphere's radius is 0.9 × 0.74 of the half side; the reticle sits 5 px outside it
  const r = orbEl.getBoundingClientRect();
  const R = 0.9 * 0.74 * (cfg.orb.size / 2) / push + 5;
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const box = { left: cx - R, top: cy - R, width: 2 * R, height: 2 * R };

  // (5) the stamp line typing itself; (6) the feeds answering, one truth line each
  const segs = (el, list) => {
    el.replaceChildren();
    list.forEach((p, i) => {
      const sp = document.createElement('span');
      sp.className = `g-seg${p.tone ? ' ' + p.tone : ''}`;
      sp.textContent = p.text;
      if (i < list.length - 1) { const sep = document.createElement('span'); sep.className = 'g-sep'; sep.textContent = ' ·'; sp.append(sep); }
      el.append(sp, i < list.length - 1 ? ' ' : '');
    });
  };
  const answered = cfg.feeds.filter((_, i) => T >= C.feeds + i * LOCK).length;
  const watch = answered === cfg.feeds.length ? `Watching ${cfg.feeds.length} feeds` : 'Checking feeds';
  const words = [cfg.now.day, cfg.now.time, cfg.now.place, watch].concat(T >= C.land ? ['Looking at Home'] : []);
  {
    const el = $('.g-stamp');
    const full = words.join(' · ');
    const typed = Math.min(full.length, Math.floor((T - C.stamp) / TYPE_MS));
    if (typed > 0) {
      let n = 0;
      const list = [];
      for (const w of words) {
        if (n >= typed) break;
        list.push({ text: w.slice(0, typed - n), tone: w === 'Looking at Home' ? 'on' : undefined });
        n += w.length + 3;
      }
      segs(el, list);
      const cur = document.createElement('i'); cur.className = 'g-cursor'; el.append(cur);
      el.classList.toggle('writing', typed < full.length);
    }
  }
  {
    const host = $('.feeds');
    const gone = T >= C.recognise ? 1 - seg(C.recognise, C.recognise + LOCK) : 1;
    cfg.feeds.slice(0, answered).forEach((f, i) => {
      const p = document.createElement('p');
      p.className = 'g-truth';
      segs(p, [{ text: f[0], tone: 'strong' }, { text: f[1] }, { text: f[2] }]);
      p.style.opacity = (seg(C.feeds + i * LOCK, C.feeds + i * LOCK + LOCK) * gone).toFixed(3);
      host.append(p);
    });
  }

  // (7) the recognition: the box snaps onto the orb from 14 px wider, with one tone; G H O S T Y under it; both go at the landing
  {
    const lock = $('#orblock');
    const k = easeInOut(seg(C.recognise, C.recognise + LOCK));
    const out = 1 - seg(C.land, C.land + 150);
    if (k > 0 && out > 0) {
      const pad = 14 * (1 - k);
      lock.hidden = false;
      Object.assign(lock.style, { left: `${box.left - pad}px`, top: `${box.top - pad}px`, width: `${box.width + 2 * pad}px`, height: `${box.height + 2 * pad}px`, opacity: ((0.35 + 0.65 * k) * out).toFixed(3) });
    }
    const name = $('.name');
    name.style.top = `${box.top + box.height + 40}px`;
    name.style.opacity = (seg(C.recognise + LOCK, C.recognise + LOCK + 120) * out).toFixed(3);
  }
  // (8) the greeting, his line, where Home's first line lives
  {
    const say = $('.say'); say.hidden = T < C.greeting; say.style.opacity = seg(C.greeting, C.greeting + 160).toFixed(3);
    const say2 = $('.say2'); say2.hidden = T < C.land; say2.style.opacity = seg(C.land, C.land + 200).toFixed(3);
  }
  // (9) NOW: the search for the thing of the hour: the box checks the shelf, then the desk, then locks on the Brief; its callout follows
  {
    const search = $('#search');
    const stops = cfg.search; // [[selector, ms], ...] the last is the lock
    let at = null, ai = -1;
    stops.forEach((s, i) => { if (T >= s[1]) { at = s; ai = i; } });
    const last = stops[stops.length - 1];
    if (at && T < C.land + 150) {
      const el = $(at[0]);
      const rr = el.getBoundingClientRect();
      const pad = 6;
      search.hidden = false;
      search.dataset.state = at[2];
      Object.assign(search.style, { left: `${rr.left - pad}px`, top: `${rr.top - pad}px`, width: `${rr.width + 2 * pad}px`, height: `${rr.height + 2 * pad}px`, opacity: (1 - seg(C.land, C.land + 150)).toFixed(3) });
      const line = $('#searchline');
      line.textContent = ai === stops.length - 1 ? 'Found · the Brief' : `Checking · ${el.dataset.name}`;
      line.style.opacity = (1 - seg(C.land, C.land + 150)).toFixed(3);
    }
    const co = $('.co');
    co.style.opacity = seg(last[1] + 60, last[1] + 200).toFixed(3);
    $('.lead').style.opacity = co.style.opacity;
    $('#r-now').style.opacity = seg(last[1], last[1] + LOCK).toFixed(3);
  }
  // a tap skips it: said small once the orb is there, gone at the recognition
  $('.skip').hidden = !(T >= C.orb + 300 && T < C.recognise);
  // (10) the landing: the plan of the house and the ask line slide up a beat after the stamp says LOOKING AT HOME
  {
    const hud = $('.hud');
    const k = easeOut(seg(C.land + 110, C.land + 110 + 300));
    hud.style.opacity = k.toFixed(3);
    hud.style.transform = `translateY(${(24 * (1 - k)).toFixed(1)}px)`;
  }
  GL.place();
  window.__frameReady = true;
})().catch((e) => { console.error(String(e)); window.__frameReady = true; });
