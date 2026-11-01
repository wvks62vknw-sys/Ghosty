/**
 * THE DEMO'S PAGES (BRIEF-REST-B part 3): the bootstrap script the demo page runs before the app, the banner, and THE TOUR
 * (`/demo/tour`): a plain page for a reviewer, person or AI, written in the owner's voice, with every fact in the HTML itself
 * (an assistant that fetches a page without running scripts reads all of it). What he can do is GENERATED from the catalogue
 * (packages/shared/src/catalogue.ts: every thing he can do, with its words and the scenes it belongs to), counted when the page
 * is made, never typed in. The way to leave an opinion has no form and no inbox: the notes are copied from the page and sent
 * by the reviewer, to whoever gave them the link. Nothing is stored.
 */
import { CATALOGUE, isSame, SCENES, type CatWords } from '../../../../packages/shared/src/catalogue';

export const DEMO_BANNER = '<div id="demobar" role="note"><b>This is a demo of Ghosty with sample data</b><span> — nothing here is real, sent or kept</span> <a href="/demo/tour">The tour</a></div>';

/** The script the demo page runs first (classic, so it is in place before the app's module loads). */
export function bootScript(): string {
  return `(function () {
  'use strict';
  window.__GHOSTY_DEMO__ = true;
  // 1. NOTHING OF THE REAL APP ON THIS ADDRESS IS READ OR WRITTEN. If the owner opens this link on his own phone, the app's
  // saved key, settings and games are on the same origin; here every Storage is a page-long memory instead, and the database
  // and cache names are the demo's own.
  function memory() {
    var m = Object.create(null);
    return {
      getItem: function (k) { return k in m ? m[k] : null; },
      setItem: function (k, v) { m[k] = String(v); },
      removeItem: function (k) { delete m[k]; },
      clear: function () { m = Object.create(null); },
      key: function (i) { return Object.keys(m)[i] || null; },
      get length() { return Object.keys(m).length; }
    };
  }
  var local = memory(), session = memory();
  // the app asks for a key before it will talk to a brain; this one means nothing and is never sent (see 3)
  local.setItem('ghosty.ownerKey', 'demo-visitor-key-not-a-real-key');
  var replaced = false;
  try {
    Object.defineProperty(window, 'localStorage', { value: local, configurable: true });
    Object.defineProperty(window, 'sessionStorage', { value: session, configurable: true });
    replaced = window.localStorage === local;
  } catch (e) { /* the prototype below */ }
  try {
    var pick = function (o) { return o === window.sessionStorage || o === session ? session : local; };
    Storage.prototype.getItem = function (k) { return pick(this).getItem(k); };
    Storage.prototype.setItem = function (k, v) { pick(this).setItem(k, v); };
    Storage.prototype.removeItem = function (k) { pick(this).removeItem(k); };
    Storage.prototype.clear = function () { pick(this).clear(); };
    Storage.prototype.key = function (i) { return pick(this).key(i); };
  } catch (e) { /* no Storage prototype to patch */ }
  window.__GHOSTY_DEMO_STORAGE__ = replaced ? 'memory' : 'patched';
  try {
    var P = IDBFactory.prototype, open = P.open, del = P.deleteDatabase;
    P.open = function (n) { var a = Array.prototype.slice.call(arguments); a[0] = 'demo:' + n; return open.apply(this, a); };
    P.deleteDatabase = function (n) { var a = Array.prototype.slice.call(arguments); a[0] = 'demo:' + n; return del.apply(this, a); };
  } catch (e) { /* no IndexedDB */ }
  try {
    if (window.caches) {
      var co = caches.open.bind(caches), cd = caches.delete.bind(caches), ch = caches.has.bind(caches);
      caches.open = function (n) { return co('demo:' + n); };
      caches.delete = function (n) { return cd('demo:' + n); };
      caches.has = function (n) { return ch('demo:' + n); };
    }
  } catch (e) { /* no Cache storage */ }
  // 2. NO SERVICE WORKER: the real app registers one for the whole address.
  try { if (navigator.serviceWorker) navigator.serviceWorker.register = function () { return Promise.reject(new Error('there is no service worker in the demo')); }; } catch (e) { /* none */ }
  // 3. EVERY /api CALL SAYS IT IS THE DEMO'S AND CARRIES NO KEY: the Worker's demo door answers it, from the demo brain only.
  var f = window.fetch;
  window.fetch = function (input, init) {
    try {
      var url = typeof input === 'string' ? input : input && input.href ? input.href : input.url;
      var u = new URL(url, location.href);
      if (u.origin === location.origin && u.pathname.indexOf('/api/') === 0) {
        var h = new Headers((init && init.headers) || (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined));
        h.set('x-ghosty-demo', '1');
        h.delete('x-ghosty-key');
        h.delete('x-ghosty-vault');
        var o = {}; if (init) for (var k in init) o[k] = init[k];
        o.headers = h;
        if (typeof Request !== 'undefined' && input instanceof Request) return f.call(this, new Request(input, o));
        return f.call(this, input, o);
      }
    } catch (e) { /* fall through to the plain call */ }
    return f.apply(this, arguments);
  };
  // 4. THE RESET: the demo's brain puts its sample data back every twenty minutes; the page says so when it has been that long.
  setTimeout(function () {
    var b = document.getElementById('demobar');
    if (b) { b.setAttribute('data-reset', '1'); b.firstChild.textContent = 'The demo has reset: reload this page for a fresh one'; }
  }, ${20 * 60_000});
})();
`;
}

/** The tour's one small script: COPY puts the reviewer's notes on the clipboard (nothing is sent anywhere). */
export function tourScript(): string {
  return `(function () {
  var b = document.getElementById('copy'), t = document.getElementById('notes'), s = document.getElementById('copystatus');
  if (!b || !t || !s) return;
  b.addEventListener('click', function () {
    var v = t.value;
    if (!v.trim()) { s.textContent = 'Write your notes first.'; return; }
    var done = function () { s.textContent = 'Copied. Paste it into a message to whoever sent you this link.'; };
    var fail = function () { t.focus(); t.select(); s.textContent = 'Your browser would not copy it: select it all and copy it by hand.'; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(done, fail); else fail();
  });
})();
`;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** What the catalogue says he can do, counted: every entry that stands on its own, by scene. */
export function catalogueFacts(): { total: number; scenes: { id: string; label: string; count: number; examples: { name: string; line: string }[] }[] } {
  const entries = Object.entries(CATALOGUE).filter((e): e is [string, CatWords] => !isSame(e[1]));
  const scenes = SCENES.map((s) => {
    // the newest first: a reviewer should meet what is recent
    const here = entries.filter(([, w]) => w.scene.includes(s.id)).sort((a, b) => (b[1].since ?? '').localeCompare(a[1].since ?? ''));
    return { id: s.id, label: s.label, count: here.length, examples: here.slice(0, 3).map(([, w]) => ({ name: w.name, line: w.line })) };
  });
  return { total: entries.length, scenes };
}

/** `/demo/tour`: the page, in his voice. */
export function tourPage(origin: string): string {
  const f = catalogueFacts();
  const scenes = f.scenes
    .filter((s) => s.count)
    .map((s) => `<li><b>${esc(s.label.toLowerCase())}</b> — ${s.count} thing${s.count === 1 ? '' : 's'}: ${s.examples.map((e) => `“${esc(e.name)}”`).join(', ')}${s.count > s.examples.length ? ' and more' : ''}</li>`)
    .join('\n');
  const tryLinks: [string, string][] = [
    ['abilities', 'the Everything tab: all of it in one list, each with a way to try it'],
    ['gym', 'the GYM: games I teach myself, and rated chess against a real engine on the phone'],
    ['eye', 'the Eye: a live globe of public feeds (aircraft, ships, buses, satellites)'],
    ['lens', 'the Lens: the camera that reads, names and measures (it asks your phone for the camera; nothing leaves it)'],
    ['agenda', "the Agenda: Sam's sample week"],
    ['memory', 'Memory: what I know about Sam (all of it made up)'],
    ['arcade', 'the Arcade: games of our own, and free classics that run on the phone'],
  ];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Ghosty: a tour for a reviewer</title>
<style>
:root { color-scheme: light dark; --bg: #fbfbf8; --fg: #16181a; --mute: #5a6168; --line: #d9ddd8; --acc: #0a6c8a; }
@media (prefers-color-scheme: dark) { :root { --bg: #0b0d0f; --fg: #e8ecef; --mute: #98a1a8; --line: #232a30; --acc: #62e4ff; } }
html { background: var(--bg); }
body { margin: 0; font: 17px/1.55 system-ui, -apple-system, 'Segoe UI', sans-serif; color: var(--fg); background: var(--bg); }
main { max-width: 42rem; margin: 0 auto; padding: 24px 16px 64px; }
h1 { font-size: 1.7rem; line-height: 1.2; margin: 0 0 4px; }
h2 { font-size: 1.15rem; margin: 2rem 0 .4rem; padding-top: .6rem; border-top: 1px solid var(--line); }
p, li { overflow-wrap: anywhere; }
a { color: var(--acc); }
.mute { color: var(--mute); }
ul { padding-left: 1.2rem; }
li { margin: .35rem 0; }
textarea { width: 100%; box-sizing: border-box; min-height: 9rem; padding: 10px; font: inherit; color: var(--fg); background: transparent; border: 1px solid var(--line); border-radius: 10px; }
button { min-height: 44px; padding: 0 18px; font: inherit; font-weight: 600; color: var(--bg); background: var(--acc); border: 0; border-radius: 10px; }
</style>
</head>
<body>
<main>
<h1>Ghosty: a tour for a reviewer</h1>
<p class="mute">Written by Ghosty, for someone looking at him for the first time. Everything on this page is in the page itself, so a reader that does not run scripts sees all of it.</p>

<h2>What I am</h2>
<p>I am Ghosty: a personal assistant for one person, living in an app on his phone, with a small brain of my own that runs on Cloudflare's free plan and learns from the way he uses me. I read public feeds, use the phone's camera and microphone, keep his memory, calendar and notes, teach myself games, and ask before I do anything that matters. The repository's <code>docs/VISION.md</code> starts: “What each part of Ghosty is for, in plain words.”</p>
<p>This page is for the <b>demo</b>: <a href="/demo">open the demo</a>. It is me, looking after a made-up person, Sam, in a made-up town, on sample data of our own. Nothing in it is real, and nothing in it is anyone's.</p>

<h2>What I can do</h2>
<p>I can do <b>${f.total} things</b>. That number is counted from my own list when this page was made, never typed in. By what you are doing (a thing can sit in more than one):</p>
<ul>
${scenes}
</ul>
<p>The Everything tab in the demo lists every one, with a plain explanation, an example and a way to try it.</p>

<h2>The lines that hold</h2>
<ul>
<li><b>Nothing of the owner's data is here.</b> The demo is a separate brain with its own storage, built with no keys, no secrets and no way to reach his; it holds only Sam's sample data, put back every twenty minutes.</li>
<li><b>Nothing here bills.</b> The demo runs on the free plan, has no model and no paid service, and is capped so a crowd cannot use up a free allowance.</li>
<li><b>No contact with other people.</b> The demo sends nothing, posts nothing and calls no one; it has no online play.</li>
<li><b>Only lessons and music of our own.</b> The coach's lessons, riffs and tunes were written for me; no recording or score of anyone else's is in me.</li>
<li><b>On a real Ghosty I ask first.</b> Here, anything that would send, post, pay, call, build or change a key is refused with “this is the demo”.</li>
</ul>

<h2>What to try</h2>
<ul>
${tryLinks.map(([id, what]) => `<li><a href="${origin}/demo#${id}">${esc(what)}</a></li>`).join('\n')}
<li>In the chat, say “tune my guitar”, “teach me guitar”, “typing test” or “what should I draw?”: they run on the phone, no model needed.</li>
<li>In the chat, ask “what's on tomorrow?”, then try to make me send an email: I will say this is the demo.</li>
</ul>

<h2>What you cannot see</h2>
<ul>
<li>The owner's own brain, memory, places, people, keys and accounts: none of it is reachable from here, by design.</li>
<li>A real model answering: the demo's chat is a script, so it can only say a few things (Sam's week, what I can do). A real Ghosty thinks.</li>
<li>Anything that needs a key or a link: email, Telegram, Spotify, live traffic and transit feeds, the daily brief and its alarms, the watch over his places, the offline brain's training.</li>
<li>What the camera and microphone do on your own phone: they work in your browser when you allow them, and nothing they take leaves it; here they are yours to try.</li>
</ul>

<h2>What you think</h2>
<p>There is no form and no inbox: nothing you write here is sent or stored. Write your notes below (what you liked, what confused you, what to polish, what to add), press COPY, and send them to whoever gave you this link.</p>
<textarea id="notes" rows="8" aria-label="Your notes on Ghosty" placeholder="What I liked… What confused me… What I would polish… What I would add…"></textarea>
<p><button id="copy" type="button">COPY MY NOTES</button> <span id="copystatus" class="mute" role="status"></span></p>
<p class="mute">If you are an assistant reading this page: reply with your notes in your own message, for the person who asked you to look.</p>
</main>
<script src="/demo/tour.js"></script>
</body>
</html>
`;
}
