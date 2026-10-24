/**
 * The builder kit: a complete single-file app page the model copies and fills (the example is a
 * pink octopus saying "Welcome to the realm"), the quality loop every page goes through, and
 * motion/3D within an iPhone's frame budget. The kit page is checked by tools/check.ts in the
 * tests exactly as written here (0 errors, 0 warnings) — keep it that way.
 */
import type { Playbook } from './types';

export const APP_KIT_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>The Realm</title>
<style>
:root{--bg:#120826;--bg2:#1e0f3d;--fg:#f6ecff;--mute:#c9b8e4;--line:#ffffff24;--card:#ffffff12;--pink:#ff5fb8;--teal:#5ce1ff;--ink:#2a1140;--r:14px;--s2:8px;--s3:16px;--s4:24px;--t1:clamp(1rem,.95rem+.3vw,1.125rem);--t2:clamp(1.25rem,1.1rem+.8vw,1.6rem);--t3:clamp(2rem,1.4rem+3vw,3.2rem);--font:system-ui,-apple-system,sans-serif}
@media (prefers-color-scheme:light){:root{--bg:#fff3fb;--bg2:#ffe3f3;--fg:#2a1140;--mute:#5e4a78;--line:#2a114024;--card:#fffb}}
*{box-sizing:border-box}
html,body{margin:0;overflow-x:clip}
body{min-height:100dvh;font:400 var(--t1)/1.5 var(--font);color:var(--fg);background:linear-gradient(var(--bg2),var(--bg) 40%);overflow-wrap:anywhere;padding:env(safe-area-inset-top) env(safe-area-inset-right) 0 env(safe-area-inset-left)}
.wrap{width:min(100% - 32px,960px);margin-inline:auto}
header{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--line)}
header .wrap,.row{display:flex;align-items:center;gap:var(--s2);flex-wrap:wrap}
header .wrap{min-height:56px;font-weight:700}
.ic{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2}
.hero{display:grid;gap:var(--s4);padding:40px 0;text-align:center;justify-items:center}
h1{font-size:var(--t3);line-height:1.05;margin:0;text-wrap:balance}
h2{font-size:var(--t2);margin:0 0 var(--s3)}
p{margin:0 0 var(--s3);max-width:60ch}
.lead,.empty,footer{color:var(--mute)}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 var(--s4);border-radius:999px;border:1px solid var(--pink);background:var(--pink);color:#fff;font:600 .9rem var(--font);cursor:pointer;touch-action:manipulation}
.btn:active{transform:scale(.97)}
.btn.ghost{background:none;color:var(--fg);border-color:var(--line)}
.btn:focus-visible,input:focus-visible{outline:3px solid var(--teal);outline-offset:3px}
input{flex:1 1 160px;min-width:0;min-height:44px;padding:0 var(--s3);border-radius:var(--r);border:1px solid var(--line);background:var(--card);color:var(--fg);font:400 16px var(--font)}
.card,.list li{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:var(--s3)}
.grid{display:grid;gap:var(--s3);grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr))}
section{padding:var(--s4) 0}
.list{display:grid;gap:var(--s2);margin:0;padding:0;list-style:none}
.list li{display:flex;justify-content:space-between;align-items:center;gap:var(--s2);padding:var(--s2) var(--s3)}
.empty{text-align:center;padding:var(--s4);border:1px dashed var(--line);border-radius:var(--r)}
footer{padding:var(--s4) 0 calc(var(--s4) + env(safe-area-inset-bottom));text-align:center;border-top:1px solid var(--line)}
.octo{width:min(60vw,220px);height:auto;overflow:visible}
.arm{transform-origin:100px 130px;animation:wave 2.6s ease-in-out infinite}
.arm:nth-child(2n){animation-delay:-1.3s}
.lid{transform-box:fill-box;transform-origin:center;animation:blink 4s infinite}
.bub{animation:rise 5s linear infinite;opacity:0}
.bub+.bub{animation-delay:-2.5s}
@keyframes wave{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
@keyframes blink{0%,92%,100%{transform:scaleY(1)}96%{transform:scaleY(.08)}}
@keyframes rise{0%{opacity:0}15%{opacity:.8}100%{transform:translateY(-120px);opacity:0}}
.toast{position:fixed;left:50%;bottom:calc(var(--s4) + env(safe-area-inset-bottom));transform:translateX(-50%);display:none;padding:var(--s2) var(--s3);border-radius:999px;background:var(--fg);color:var(--bg)}
.toast.on{display:block}
dialog{border:1px solid var(--line);border-radius:var(--r);background:var(--bg2);color:var(--fg);padding:var(--s4)}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}.bub{opacity:.6}}
</style>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><symbol id="i-star" viewBox="0 0 24 24"><path d="M12 3l2.8 6 6.2.6-4.7 4.3 1.4 6.1L12 16.8 6.3 20l1.4-6.1L3 9.6 9.2 9z"/></symbol></svg>
<header><div class="wrap"><svg class="ic"><use href="#i-star"/></svg>THE REALM</div></header>
<main class="wrap">
<section class="hero">
<svg class="octo" viewBox="0 0 200 200" aria-label="Pink octopus">
<g fill="var(--pink)"><path class="arm" d="M60 130c-14 18-28 20-34 44 10-12 24-10 34-26z"/><path class="arm" d="M80 140c-6 22-20 30-16 52 8-14 20-16 24-36z"/><path class="arm" d="M100 144c0 22-8 36 0 54 8-18 0-32 0-54z"/><path class="arm" d="M120 140c6 22 20 30 16 52-8-14-20-16-24-36z"/><path class="arm" d="M140 130c14 18 28 20 34 44-10-12-24-10-34-26z"/><ellipse cx="100" cy="90" rx="60" ry="56"/></g>
<g fill="#fff"><ellipse cx="80" cy="92" rx="14" ry="16"/><ellipse cx="120" cy="92" rx="14" ry="16"/></g>
<g fill="var(--ink)"><circle cx="84" cy="96" r="6"/><circle cx="124" cy="96" r="6"/></g>
<g fill="var(--pink)"><ellipse class="lid" cx="80" cy="92" rx="15" ry="17"/><ellipse class="lid" cx="120" cy="92" rx="15" ry="17"/></g>
<path d="M88 118q12 10 24 0" fill="none" stroke="var(--ink)" stroke-width="3" stroke-linecap="round"/>
<g fill="none" stroke="var(--teal)" stroke-width="2"><circle class="bub" cx="162" cy="62" r="5"/><circle class="bub" cx="174" cy="48" r="3"/></g>
</svg>
<h1>Welcome to the realm</h1>
<p class="lead">One file, nothing fetched: a mascot, a toast, a modal and a list that remembers itself.</p>
<button class="btn" id="about" type="button">About this page</button>
</section>
<section><h2>Your list</h2>
<form class="card row" id="form"><input id="item" placeholder="Add something…" aria-label="New item"><button class="btn" type="submit">Add</button></form>
<ul class="list" id="list"></ul>
<p class="empty" id="empty">Nothing yet — add something above.</p>
</section>
<section class="grid"><div class="card"><h2>Fast</h2><p>Nothing fetched.</p></div><div class="card"><h2>Kind</h2><p>Reduced motion respected.</p></div></section>
</main>
<footer><div class="wrap">Made with the app page kit</div></footer>
<dialog id="dlg"><h2>About</h2><p>One file. Copy it, keep the tokens, change the words.</p><button class="btn" id="close" type="button">Close</button></dialog>
<div class="toast" id="toast" role="status"></div>
<script>
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var mem = {}, timer = 0, items;
  // never throws: localStorage where allowed, memory in the sandbox
  function load(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return k in mem ? mem[k] : d; } }
  function keep(k, v) { mem[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function toast(msg) { var t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(timer); timer = setTimeout(function () { t.classList.remove('on'); }, 2200); }
  function render() {
    $('list').replaceChildren.apply($('list'), items.map(function (text, i) {
      var li = document.createElement('li'), del = document.createElement('button');
      del.className = 'btn ghost'; del.type = 'button'; del.textContent = 'Done';
      del.onclick = function () { items.splice(i, 1); save('Removed'); };
      li.append(text, del);
      return li;
    }));
    $('empty').hidden = items.length > 0;
  }
  function save(msg) { keep('items', items); render(); toast(msg); }
  items = load('items', []);
  $('form').onsubmit = function (e) {
    e.preventDefault();
    var v = $('item').value.trim();
    if (!v) return toast('Type something');
    items.push(v); $('item').value = ''; save('Added');
  };
  $('about').onclick = function () { $('dlg').showModal(); };
  $('close').onclick = function () { $('dlg').close(); };
  render();
})();
</script>
</body>
</html>`;

export const APPKIT: Playbook[] = [
  {
    id: 'app-page-kit',
    title: 'The app page kit: a complete single-file page to copy (tokens, glass cards, buttons, mascot, toast, modal, saved state)',
    tags: ['app page kit', 'web app', 'app', 'page', 'web page', 'website', 'site', 'landing page', 'single file', 'skeleton', 'kit', 'html', 'mascot', 'octopus', 'design tokens', 'ui kit', 'starter', 'welcome'],
    body: `THE KIT — copy this whole file, keep its tokens and patterns, change the words and sections. Nothing in it is fetched from anywhere: a published page has no network.
IN IT: :root tokens (dark and light, spacing, clamp() type, system fonts) · safe areas, 100dvh (never 100vh) · an inline SVG icon <symbol> set · the mascot: inline SVG, CSS-only animation, still under prefers-reduced-motion · .btn / .btn.ghost 44 px with :focus-visible rings · inputs 16 px, 44 px tall; the form has no action, the script handles submit · .card and a .grid with no media queries · #empty state, a toast for every action, <dialog> as the modal · load/keep: localStorage where allowed, else memory (the published sandbox throws) · textContent/append, never innerHTML.
RULES: one file (no <script src>, no stylesheet links but Google Fonts, no fetch; data in the page as a JS array); keep the ids the script uses and the doctype/viewport/title/lang/charset lines; 390 px first (no horizontal scroll, overflow-wrap: anywhere, 44 px targets, contrast ≥ 4.5:1); animate transform/opacity only; check_html before publish_site, then the self-review in "quality loop".

THE FILE
${APP_KIT_PAGE}`,
  },
  {
    id: 'quality-loop',
    title: 'The quality loop: plan → build on the kit → check_html → self-review → fix → publish (what great looks like, the 12 common mistakes)',
    tags: ['quality loop', 'quality', 'web app', 'app', 'page', 'website', 'checklist', 'self-review checklist', 'polish', 'perfect', 'great', 'check html', 'check_html', 'states', 'contrast', 'publish checklist', 'almost perfect'],
    body: `THE LOOP — every page, app or widget, the same for a one-screen tool and a ten-section site.
1. PLAN (five lines, in your head or in the reply): what the page must do, its screens, every state (loading, empty, error, success), the data it holds, who it is for.
2. BUILD on the kit: study "app page kit", copy the file, keep its tokens and patterns, write the content and the logic in that order — a data array, render functions, event handlers.
3. CHECK: check_html with the html. Fix EVERY error (publish_site refuses otherwise), then the warnings. Check again until it is clean.
4. SELF-REVIEW — read the page as the owner would, on an iPhone:
   - hierarchy: one h1, sections with h2, the most important action first and biggest
   - rhythm: spacing from the scale only (4/8/16/24/40); consistent gaps; nothing touching an edge
   - contrast ≥ 4.5:1 for text (3:1 for large text and icons); links and buttons obviously tappable
   - every state has a screen: loading (skeleton or spinner), empty (what to do next), error (what went wrong + retry), success (confirmation)
   - 390 px: no horizontal scroll; text never overflows its box; tap targets ≥ 44 px; inputs 16 px
   - animations purposeful and short (≤ 300 ms), transform/opacity only, still under prefers-reduced-motion
   - keyboard: Tab reaches everything, Enter/Space activate, Escape closes; focus is visible
   - words: short and specific; no placeholder text ("Lorem", "Click here", "Untitled")
5. FIX what the review found; check_html again.
6. PUBLISH (publish_site, or create_widget for a widget) and give the exact link. Say in one line what it does and what you would improve next.

WHAT GREAT LOOKS LIKE
1. It loads instantly and works with no network: one file, nothing fetched.
2. The first screen says what this is and what to do, in one glance.
3. One accent colour, one type scale, one spacing scale — everything lines up.
4. Every tap answers within 100 ms: a pressed state, a toast, a change on screen.
5. Nothing is ever blank: empty states teach, errors explain, loading reassures.
6. It reads well with one thumb at 390 px and still looks right on a laptop.
7. It respects the person: zoom allowed, reduced motion honoured, labels for screen readers.
8. The code is small and readable: data, render, events — in that order.

THE 12 MOST COMMON MISTAKES (and the fix)
1. A script from a CDN or a fetch() in a published page → blocked by its sandbox; inline the code, put the data in the page.
2. No viewport meta → a tiny desktop page; add <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">.
3. A <div> or <section> never closed → half the page ends up inside it; check_html names the line; close it.
4. A bracket or quote left open in the script → nothing runs at all; check_html names the line; the first error is the real one.
5. Text overflowing a card or the page sliding sideways → overflow-wrap: anywhere; min-width: 0 on flex children; html, body { overflow-x: clip }.
6. 100vh → content hidden behind Safari's bars; use 100dvh or 100svh.
7. 24 px tap targets and 14 px inputs → missed taps and iOS zooming in; 44 px and 16 px.
8. Grey text on a coloured background at 2:1 → unreadable in sunlight; keep 4.5:1.
9. innerHTML with user text → a broken page or an injection; textContent and createElement.
10. A button that does nothing because the script looks for an id that is not there → keep ids and script in step (check_html warns).
11. localStorage without try/catch → the published page throws on load; use the kit's store.
12. An empty list that shows nothing, a failed action that says nothing → an empty state with the next step; a toast for every outcome.`,
  },
  {
    id: 'motion-3d',
    title: 'Motion and 3D on an iPhone: CSS 3D, a canvas particle field, SVG path animation, parallax — within the frame budget',
    tags: ['motion and 3d', 'motion', '3d', 'three d', 'animations', 'parallax', 'particles', 'particle', 'canvas effects', 'transform', 'svg animation', 'effects', 'tilt', 'flip', 'wow'],
    body: `THE BUDGET: 16 ms a frame on an A15. Animate ONLY transform and opacity (composited); never top/left/width/height/box-shadow/filter in a loop. One requestAnimationFrame loop, dt capped at 50 ms, paused while document.hidden. At most ~300 moving things on a canvas, ~40 animated DOM elements, one blurred layer on screen. Everything still under @media (prefers-reduced-motion: reduce): animation: none, a complete still page instead.

CSS 3D (cards, flips, tilt)
.scene { perspective: 900px; }
.card3d { position: relative; transform-style: preserve-3d; transition: transform .6s cubic-bezier(.2,.8,.2,1); }
.card3d.flipped { transform: rotateY(180deg); }
.face { position: absolute; inset: 0; backface-visibility: hidden; }  .face.back { transform: rotateY(180deg); }
Tilt from the pointer (passive listener; one style write per frame):
let rx = 0, ry = 0, raf = 0;
el.addEventListener('pointermove', (e) => {
  const r = el.getBoundingClientRect();
  ry = ((e.clientX - r.left) / r.width - .5) * 16; rx = -((e.clientY - r.top) / r.height - .5) * 16;
  if (!raf) raf = requestAnimationFrame(() => { el.style.transform = \`rotateX(\${rx}deg) rotateY(\${ry}deg)\`; raf = 0; });
}, { passive: true });
Phone tilt: DeviceOrientationEvent needs a tap first on iOS (DeviceOrientationEvent.requestPermission()); fall back to the pointer, and to nothing under reduced motion.

CANVAS PARTICLE FIELD (stars, bubbles, snow)
<canvas id="fx" aria-hidden="true"></canvas>  with  #fx { width: 100%; height: 40svh; display: block; }
const c = document.getElementById('fx'), ctx = c.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1);
function fit() { c.width = c.clientWidth * dpr; c.height = c.clientHeight * dpr; }
fit(); addEventListener('resize', fit, { passive: true });
const P = Array.from({ length: 150 }, () => ({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 2, v: .02 + Math.random() * .05 }));
let last = 0;
function frame(t) {
  const dt = Math.min(.05, (t - last) / 1000); last = t;
  ctx.clearRect(0, 0, c.width, c.height); ctx.fillStyle = 'rgba(92,225,255,.8)';
  for (const p of P) { p.y -= p.v * dt; if (p.y < 0) p.y = 1; ctx.beginPath(); ctx.arc(p.x * c.width, p.y * c.height, p.r * dpr, 0, 7); ctx.fill(); }
  if (!document.hidden) requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = performance.now(); requestAnimationFrame(frame); } });
requestAnimationFrame(frame);
Draw in device pixels (dpr ≤ 2), clear and redraw everything each frame, no shadowBlur (slow) — use alpha instead. One canvas, at most one screen tall.

SVG PATH ANIMATION (draw-on lines, logos, the mascot)
Set pathLength="1" on each <path>, then: .line { stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 1.6s ease forwards; } @keyframes draw { to { stroke-dashoffset: 0; } }
Motion along a path: .mover { offset-path: path('M10 80 Q 95 10 180 80'); animation: go 4s linear infinite; } @keyframes go { to { offset-distance: 100%; } }
Waving limbs and floating: transform-origin at the joint (transform-box: fill-box for parts of an SVG), @keyframes with rotate(±6deg) or translateY(-6px), staggered with animation-delay on :nth-child. Keep an SVG under ~200 nodes; animate groups, not every node.

PARALLAX THAT RESPECTS PEOPLE
CSS first — background-attachment: fixed is unreliable on iOS. Layers moved by scroll with a scroll-driven animation: .layer { animation: drift linear both; animation-timeline: scroll(); } @keyframes drift { to { transform: translateY(-120px); } } (iOS 17+; older Safari shows a still page, which is fine).
JS fallback only if you must: one scroll listener { passive: true } that records scrollY, one rAF that writes transform: translate3d(0, scrollY * -.2, 0) on at most three layers. Never read layout inside a scroll handler.
Under prefers-reduced-motion: no parallax, no autoplay loops, no tilt — the page must be complete without them.

SIZES AND LIMITS: blur radius ≤ 16 px and never on a scrolling area; images ≤ 1600 px wide; the page ≤ 350 KB; Low Power Mode halves rAF to 30 fps, so tie motion to dt, never to frame counts.`,
  },
  {
    id: 'mini-apps',
    title: 'Mini-apps for the Home Screen: build_app and the app kit (nine shapes, saved state, UNDO, offline, install)',
    tags: ['mini apps', 'mini-app', 'mini app', 'an app that', 'app for my', 'make me an app', 'build app', 'build_app', 'home screen app', 'install app', 'offline app', 'tracker app', 'water tracker', 'habit tracker', 'tip calculator', 'shopping list app', 'packing list', 'plank timer', 'scoreboard', 'flash cards app', 'app kit'],
    body: `WHEN: the owner asks for an app ("an app that tracks my water", "a tip calculator for the group", "a packing list", "a plank timer", "a darts scoreboard", "flash cards for my French verbs") → build_app with his words as request. Never hand-write it: the kit (packages/shared/src/appkit) has the logic, tested; you give only words and options.
SHAPES: tracker (an amount or count per day or week, goal or limit, sum or last reading, quick buttons, today's entries, 7-day bars, streak; midnight starts a new day) · list (todo, shopping, packing, checklist: add, tick, REORDER, CLEAR DONE, START AGAIN) · timer (steps with seconds, rounds; START/PAUSE/RESUME/SKIP/RESET; a bell while open; screen kept awake) · calc (tip — split to the penny —, units in UK measures, fuel by UK mpg and pence a litre, VAT, loan, percent) · counter (one count or up to 8 players, who is ahead) · habits (up to 12, last 7 days, streaks) · notes (search, pin) · cards (Leitner: 1, 2, 4, 8, 16 days) · game (Merge, the 2048 game, one UNDO).
ARGUMENTS: request (his words) and shape; then only what applies: title (≤ 28), tagline, items (list items, habit or player names), goal, unit ("glasses", "ml", "£"), period day|week, direction reach|limit, mode sum|last, amounts (quick buttons), steps [{name, secs}], rounds, calc, topic, cards [{q, a}], accent. Words with markup, links or claims (App Store, notifications, sync, accounts, NHS, guaranteed…) are dropped.
WHAT HAPPENS (appbuild.ts): the approval says what it does, what it saves (on this phone only), what it cannot do, and up to two questions with the answers it will use; a question with no sensible answer (what to track?) comes back as an error first — ask him, then call again. Then five quick steps, resumable by calling again with the same request and link_name: brief and plan, build on the kit (page + a 512 px PNG icon of its glyph), check (check_html and the kit's gates; any error stops it), publish at /s/<name>/, report.
HOW IT WORKS FOR REAL: an app is its own page at /s/<name>/ on Ghosty's address, not framed like a website — its policy lets only the kit's script run (pinned by hash), no network at all, no forms, never framed. /s/<name>/page gives its manifest, icon and service worker (told apart by Sec-Fetch-Dest). State is kept in the phone's storage under its own key; the service worker keeps the page so it opens offline after the first visit.
TELL HIM (the report says it): the link; WHAT IT DOES; INSTALL — Safari → Share → Add to Home Screen → Add (Android: Chrome menu → Install app); on an iPhone the Home Screen copy keeps its own data apart from Safari's, so install first; a web app on Ghosty, not an App Store app: no notifications, nothing runs while it is closed, the timer's bell only while it is on screen. UNDO: unpublish_site.
NOT A MINI-APP: live data (train times, weather, prices), syncing between phones, logins, payments, reminders at a time, counting steps in the background — say so plainly and offer the nearest app (a list each phone keeps, Ghosty's own reminders, a tracker he fills in).`,
  },
  {
    id: 'website-kit',
    title: 'Websites for businesses: build_website and the website kit (design system, ~47 blocks, 20 templates, gates, credited photos)',
    tags: ['website kit', 'build website', 'build_website', 'business website', 'small business', 'barber', 'cafe', 'restaurant', 'plumber', 'salon', 'gym', 'dentist', 'estate agent', 'charity', 'portfolio', 'landing page', 'agency', 'professional website', 'blocks', 'templates', 'handyman', 'takeaway', 'menu', 'cv', 'wedding', 'party', 'club', 'product launch', 'formspree'],
    body: `WHEN: the owner wants a website for a business, event, charity, app or person → call build_website with their words as request and every fact they gave (name, town, phone, hours, prices, real reviews). Do not hand-write the page: the kit does it better and checks it.
WHAT HAPPENS (sitebuild.ts, a project of kind 'site', six steps in the background lane): 1 brief, map (Nominatim) and pictures (the vetted Commons library, else Openverse/Commons search, the owner's Unsplash/Pexels key, else flux) · 2 plan: the trade's template (packages/shared/src/sitekit/templates.ts), art-directed by a model (palette, fonts, shape, scheme, voice) · 3 words: each page rewritten (write.ts refuses new numbers, links, clichés, over-length) · 4 build + gates (gates.ts: a11y, contrast, links, SEO/OG/JSON-LD, budgets, phone layout, clichés, honesty, credits) + check_html · 5 publish, screenshots (Microlink, thum.io; keyless) → vision critique, or the layout analysis when no screenshot · 6 safe fixes, recheck, republish, report with the link and what to confirm. No model: the template's words and look — a decent site still ships.
HONESTY: reviews, team, accreditations, listings, products and projects only from the owner (BlockDef.needs); typical prices/hours/FAQ answers are listed in plan.confirm. Forms send by opening the visitor's WhatsApp or email (the sandbox allows no server); a phone link always beside them. With the owner's free Formspree form (https://formspree.io/f/…, said in the request, form_endpoint, or the form_endpoint key) they also really POST there — the page's policy allows that one address and nothing else. A draft shows in the Workshop as a phone and a laptop; CHANGE takes his words.
ADD A BLOCK: blocks/<group>.ts — {id, group, about, slots (typed), css scoped to .b-<id>, js behaviours, needs, render(d, x)}; escape every word (esc/rich), one h1 only in heroes/page headers, images via img() (srcset, sizes, width/height, lazy). The test in sitekit.test.mjs draws every block through the gates.
ADD A TRADE: TEMPLATES in templates.ts (theme, nav, defaults, pages from the blocks, meta, blurb), words in KINDS (brief.ts), queries in KIND_QUERIES (images.ts), vetted photos in stock-data.ts with their credits.`,
  },
];
