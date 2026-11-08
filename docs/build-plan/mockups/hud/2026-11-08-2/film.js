/* THE BOOT AS A FILM (BRIEF-HUD-MOCKS-2 1; his words in 157: "an actual cool cinematic designed for a genius playboy billionaire
   philanthropist, straight out of a high-production Hollywood movie"). One pure function render(t): the whole film is a function
   of the millisecond, so the same code plays live on a phone (requestAnimationFrame, a tap skips) and is photographed frame by
   frame at 30 fps by render.mjs. The cut (build.py's CUT, one source for the film, the shot list and the contact sheet's strip)
   is read from the page.

   The shots, as a title designer would cut them:
     1 THE EYE OPENS      one point of light in the lit graphite, breathing; the room's light breathes in with it
     2 THE SCAN           a sphere of light grows out of the eye and samples the room as it passes: the desk first, the shelf, the
                          back wall, the ceiling last; the camera, far and high, begins a slow dolly in; the sampling front is a
                          step brighter than what it leaves settled behind it
     3 THE EDGES, THE THINGS   the hairline edges draw themselves a step behind the front; each thing locks into its reticle the moment
                          the front reaches it, with its tag; the city outside the window is still dark
     4 THE ORB FORMS      his library's points drift out of the eye and gather into the constellation; the sweep passes; the sphere
                          resolves from the inside out; the meridians catch the light one after another; the camera lands on Home
     5 THE STAMP          the Machine's point of view types itself: the day, the time, his place, CHECKING FEEDS, with the block cursor
     6 THE FEEDS ANSWER   three truth lines, one lock apart; the city lights up outside the window as they answer; WATCHING 3 FEEDS
     7 THE RECOGNITION    the box snaps onto the orb in his colour with one tone; a wave of his colour passes once through every point
                          of the room from the eye outward; G H O S T Y arrives letter by letter
     8 THE GREETING, NOW  his line; the box checks the shelf, the desk, and locks on this morning's Brief; the leader draws itself
     9 THE LANDING        the box and the name go; LOOKING AT HOME; the house and the ask line slide up; Home is usable; it breathes */
import { setupWorld, typeStamp, segs, play, $, $$ } from './world.js';
import { E } from './scene.js';

(async () => {
  const cfg = JSON.parse($('#cfg').textContent);
  const C = cfg.cut, LOCK = 160, TYPE_MS = 10;
  const world = await setupWorld(cfg);
  const { scan, orb, orbEl, orbW, rest } = world;
  const seg = E.seg;

  // the camera's path: far and a little high and to the right, then a slow dolly to Home's own camera, with a slight swing
  const A = cfg.camFrom;
  const camAt = (t) => {
    const k = E.inOutQuint(seg(t, C.scan, C.camLand));
    const swing = Math.sin(k * Math.PI) * 0.1;
    const pos = E.v3(A.pos, rest.pos, k); pos[0] += swing;
    const tgt = E.v3(A.tgt, rest.tgt, k);
    const fov = E.lerp(A.fov, rest.fov, k);
    // the breath after landing: Home's own slow drift (home.js has the same)
    if (t > C.camLand) { const u = (t - C.camLand) / 1000; const d = E.out(seg(t, C.camLand, C.camLand + 1500)); pos[0] += 0.006 * Math.sin(u * 0.5) * d; pos[1] += 0.004 * Math.sin(u * 0.37 + 1) * d; }
    return { pos, tgt, fov };
  };

  // each thing is found when the sampling sphere reaches it
  const things = $$('.ret[data-box]');
  const buildDur = C.scanEnd - C.scan;
  for (const el of things) {
    const v = el.dataset.box.split(/[ ,]+/).map(Number);
    const c = [(v[0] + v[3]) / 2, (v[1] + v[4]) / 2, (v[2] + v[5]) / 2];
    const at = Math.hypot(c[0] - orbW.c[0], c[1] - orbW.c[1], c[2] - orbW.c[2]) / cfg.world.buildR;
    // the front is at build*1.2 where build grows almost evenly (k^.9, a soft landing): solve for t
    const k = Math.min(1, at / 1.2);
    const u = Math.pow(k, 1 / 0.9);
    el.dataset.ms = Math.round(C.scan + u * buildDur + 60);
  }
  window.__thingsAt = Object.fromEntries(things.map((el) => [el.dataset.name, +el.dataset.ms]));

  const feedsEl = $('.feeds'), stampEl = $('.g-stamp'), lock = $('#orblock'), search = $('#search'), searchLine = $('#searchline');
  const name = $('.name'), skip = $('.skip'), say = $('.say'), say2 = $('.say2'), hud = $('.hud'), co = $('.co'), lead = $('.lead'), nowRet = $('#r-now');
  const flash = $('.flash'), roomlight = $('.roomlight'), windowLight = $('.winlight');
  const G = C.orb, S = G + 640, N = C.recognise;
  name.replaceChildren(...[...'GHOSTY'].map((ch) => { const s = document.createElement('span'); s.textContent = ch; return s; }));
  const letters = $$('.name span');

  function render(t) {
    // (1) the camera and the world
    const cam = camAt(t);
    world.camera(cam.pos, cam.tgt, cam.fov);
    const build = Math.pow(seg(t, C.scan, C.scanEnd), 0.9);
    const edge = Math.pow(seg(t, C.edges, C.edges + buildDur), 0.9);
    const ping = t >= C.recognise ? seg(t, C.recognise, C.recognise + 700) : 0;
    const pingA = t >= C.recognise ? 2.6 * (1 - E.out(seg(t, C.recognise, C.recognise + 700))) : 0;
    // the light draws into the eye as the orb forms, then comes back with the sphere
    const dip = 1 - 0.45 * Math.sin(Math.PI * seg(t, G, G + 1300));
    const orbLit = 0.1 + 1.1 * E.out(seg(t, G, G + 900));
    const windowLit = E.out(seg(t, C.feeds, C.feeds + 900));
    const far = cfg.world.light.tintFar;
    scan.u.uTintFar.value.setRGB(far[0] * windowLit, far[1] * windowLit, far[2] * windowLit);
    scan.render({ uBuild: build, uEdge: edge, uPing: ping * 4.8, uPingA: pingA, uOrbLit: orbLit, uAmbient: cfg.world.light.ambient * dip, uTime: t / 1000, uDrift: E.out(seg(t, C.home, C.home + 800)), uFreshA: 1, uSparkle: 0.6 * E.out(seg(t, C.home, C.home + 800)) });
    roomlight.style.opacity = E.out(seg(t, C.ground, C.ground + 700)).toFixed(3);
    if (windowLight) windowLight.style.opacity = (windowLit * 0.9).toFixed(3);

    // the things found: each reticle and tag snaps on when the front reaches it (the recognition of the room)
    const near = E.inOutQuint(seg(t, C.scan, C.camLand));
    for (const el of things) {
      const at = +el.dataset.ms;
      const k = E.lock(seg(t, at, at + LOCK));
      el.style.opacity = k.toFixed(3);
      el.style.transform = `scale(${(1.08 - 0.08 * k).toFixed(3)})`;
      for (const m of el.querySelectorAll('.g-tag, .g-truth')) { m.style.transformOrigin = m.classList.contains('g-tag') ? '0 100%' : '0 0'; m.style.transform = `scale(${(0.72 + 0.28 * near).toFixed(3)})`; }
    }
    world.placeMarks();

    // (2) the eye, then the orb: a point of light from the first frame; at G his library's points gather into the constellation
    let look;
    if (t < G) {
      look = { gather: 0, links: 0, sphere: 0, haze: 0, mer: 0, rim: 0, scale: 0, core: 1, turn: 0, push: 1, sweep: NaN, trails: 0, refract: 0 };
    } else if (t < C.land) {
      look = {
        gather: seg(t, G, S), links: seg(t, G + 320, S + 50), haze: E.out(seg(t, S - 150, S + 250)), mer: seg(t, S + 80, S + 640),
        sphere: E.inOut(seg(t, S + 250, S + 650)), rim: E.inOut(seg(t, S + 420, S + 820)), scale: seg(t, S + 300, N), core: 1,
        turn: -0.35 * (1 - E.inOut(seg(t, S, N))), push: 1, sweep: t >= G + 240 && t <= G + 540 ? 1.1 - 2.2 * seg(t, G + 240, G + 540) : NaN, trails: 1, refract: 1,
      };
    } else look = null;
    const state = t >= C.greeting && t < C.now ? 'saying' : t >= C.recognise && t < C.home ? 'attending' : 'idle';
    const breathe = t < G ? 1 + 0.3 * Math.sin(t / 260) : 1;
    orbEl.style.opacity = (E.out(seg(t, C.ground, C.ground + 500)) * (t < G ? 0.75 + 0.25 * breathe : 1)).toFixed(3);
    orb.draw(12.5 + t / 1000, state, look, 0);
    const o = world.placeOrb();
    const R = o.r + 5;
    const box = { left: o.x - R, top: o.y - R, width: 2 * R, height: 2 * R };

    // (3) the stamp types itself; the feeds answer, one truth line each; the window lights as they do
    const answered = cfg.feeds.filter((_, i) => t >= C.feeds + i * cfg.feedGap).length;
    const watch = answered === cfg.feeds.length ? `Watching ${cfg.feeds.length} feeds` : 'Checking feeds';
    const words = [cfg.now.day, cfg.now.time, cfg.now.place, watch].concat(t >= C.land ? ['Looking at Home'] : []);
    typeStamp(stampEl, words, t, C.stamp, TYPE_MS, { 'Looking at Home': 'on' });
    if (t >= C.land) { const k = seg(t, C.land, C.land + 250); stampEl.classList.toggle('writing', k < 1); }
    feedsEl.replaceChildren();
    const gone = t >= C.recognise ? 1 - seg(t, C.recognise, C.recognise + LOCK) : 1;
    cfg.feeds.slice(0, answered).forEach((f, i) => {
      const p = document.createElement('p');
      p.className = 'g-truth';
      segs(p, [{ text: f[0], tone: 'strong' }, { text: f[1] }, { text: f[2] }]);
      const k = E.out(seg(t, C.feeds + i * cfg.feedGap, C.feeds + i * cfg.feedGap + LOCK));
      p.style.opacity = (k * gone).toFixed(3);
      p.style.transform = `translateY(${(4 * (1 - k)).toFixed(1)}px)`;
      feedsEl.append(p);
    });

    // (4) the recognition: the box snaps onto the orb from 14 px wider with one tone; a pale pulse; the name letter by letter
    {
      const k = E.lock(seg(t, C.recognise, C.recognise + LOCK));
      const out = 1 - seg(t, C.land, C.land + 150);
      lock.hidden = !(k > 0 && out > 0);
      if (!lock.hidden) {
        const pad = 14 * (1 - k);
        Object.assign(lock.style, { left: `${box.left - pad}px`, top: `${box.top - pad}px`, width: `${box.width + 2 * pad}px`, height: `${box.height + 2 * pad}px`, opacity: ((0.35 + 0.65 * k) * out).toFixed(3) });
      }
      flash.style.opacity = (0.07 * Math.sin(Math.PI * seg(t, C.recognise + 40, C.recognise + 260))).toFixed(3);
      name.style.top = `${box.top + box.height + 34}px`;
      name.style.opacity = out.toFixed(3);
      letters.forEach((el, i) => { const k2 = E.out(seg(t, C.recognise + LOCK + i * 55, C.recognise + LOCK + i * 55 + 180)); el.style.opacity = k2.toFixed(3); el.style.transform = `translateY(${(5 * (1 - k2)).toFixed(1)}px)`; });
    }
    // (5) the greeting, where Home's first line lives; the second line at the landing
    {
      say.hidden = t < C.greeting; say2.hidden = t < C.land + 200;
      const k = E.out(seg(t, C.greeting, C.greeting + 260)); say.style.opacity = k.toFixed(3); say.style.transform = `translateY(${(6 * (1 - k)).toFixed(1)}px)`;
      const k2 = E.out(seg(t, C.land + 200, C.land + 500)); say2.style.opacity = k2.toFixed(3); say2.style.transform = `translateY(${(6 * (1 - k2)).toFixed(1)}px)`;
    }
    // (6) NOW: the search for the thing of the hour: the box checks the shelf, then the desk, then locks on the Brief; the leader draws; its callout follows
    {
      const stops = cfg.search;
      let at = null, ai = -1;
      stops.forEach((s, i) => { if (t >= s[1]) { at = s; ai = i; } });
      const last = stops[stops.length - 1];
      const out = 1 - seg(t, C.land, C.land + 150);
      search.hidden = !(at && out > 0);
      if (!search.hidden) {
        const el = $(at[0]);
        const rr = el.getBoundingClientRect();
        const pad = 6;
        search.dataset.state = at[2];
        Object.assign(search.style, { left: `${rr.left - pad}px`, top: `${rr.top - pad}px`, width: `${rr.width + 2 * pad}px`, height: `${rr.height + 2 * pad}px`, opacity: out.toFixed(3) });
        searchLine.textContent = ai === stops.length - 1 ? 'Found · the Brief' : `Checking · ${el.dataset.name}`;
        searchLine.style.opacity = out.toFixed(3);
      } else searchLine.style.opacity = '0';
      nowRet.style.opacity = E.lock(seg(t, last[1], last[1] + LOCK)).toFixed(3);
      lead.dataset.drawn = E.out(seg(t, last[1] + 120, last[1] + 420)).toFixed(3);
      lead.style.opacity = t >= last[1] + 120 ? '1' : '0';
      const k = E.out(seg(t, last[1] + 300, last[1] + 520));
      co.style.opacity = k.toFixed(3); co.style.transform = `translateY(${(6 * (1 - k)).toFixed(1)}px)`;
      world.placeMarks();
    }
    // a tap skips it: said small once the orb is forming, gone at the recognition
    skip.style.opacity = (E.out(seg(t, G + 400, G + 700)) * (1 - seg(t, C.recognise - 200, C.recognise))).toFixed(3);
    // (7) the landing: the house and the ask line slide up a beat after the stamp says LOOKING AT HOME
    {
      const k = E.out(seg(t, C.land + 110, C.land + 110 + 320));
      hud.style.opacity = k.toFixed(3);
      hud.style.transform = `translateY(${(24 * (1 - k)).toFixed(1)}px)`;
    }
  }

  const still = new URLSearchParams(location.search).get('still');
  if (still !== null) render(+still || 0);
  play(render, { end: C.end, skipTo: C.land, loop: true });
  window.__frameReady = true;
})().catch((e) => { console.error(String(e && e.stack || e)); window.__frameReady = true; });
