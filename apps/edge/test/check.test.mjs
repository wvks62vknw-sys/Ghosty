// The quality gate for pages, apps and widgets (tools/check.ts): every rule with a fixture, line
// numbers the model can act on, the kit page clean, and the gates in publish_site and create_widget.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const C = await import('./.build/tools/check.mjs');
const T = await import('./.build/tools/index.mjs');
const K = await import('./.build/knowledge/index.mjs');

/** A complete page with `body` on line 10 (and anything extra in <head> on line 7). */
const page = (body, head = '') => `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>T</title>\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>`;
const errors = (html, opts) => C.checkHtml(html, opts).errors;
const warnings = (html, opts) => C.checkHtml(html, opts).warnings;
const widget = { kind: 'widget' };

test('the kit page and the example game pass; the basics are errors for a page, not for a widget', () => {
  const kit = C.checkHtml(K.APP_KIT_PAGE);
  assert.deepEqual(kit.errors, []);
  assert.deepEqual(kit.warnings, []);
  assert.ok(kit.stats.scripts === 1 && kit.stats.tags > 40 && kit.stats.lines > 50, JSON.stringify(kit.stats));
  // the handbook's game is a widget: its kit script is fine there, not on a published page
  const game = C.checkHtml(K.NEON_DODGE, widget);
  assert.deepEqual(game.findings.filter((f) => f.level === 'error'), []);
  assert.match(errors(K.NEON_DODGE).join('\n'), /<script src="\/widget-kit\.js"> won't load — a published page may only run its own inline <script>/);
  const bare = errors('<html><body>hi</body></html>');
  assert.equal(bare.length, 3, bare.join('\n'));
  assert.match(bare[0], /^line 1: no <!doctype html>/);
  assert.match(bare[1], /^line 1: no <meta name="viewport"/);
  assert.match(bare[2], /^line 1: no <title>/);
  assert.match(errors('<!doctype html><html><head><title> </title></head><body></body></html>').join('\n'), /the <title> is empty/);
  const w = C.checkHtml('<h1>hi</h1>', widget);
  assert.deepEqual(w.errors, []);
  assert.deepEqual(w.warnings, ['line 1: no <!doctype html> at the top — without it the browser uses quirks mode and layouts break; make it the first line']);
});

test('tags: the structural set must balance, with the end tags the parser supplies itself, void elements, comments, script and style text ignored', () => {
  assert.deepEqual(errors(page('<div><span>x</div>')), ['line 10: </div> closes <div> from line 10, but <span> (line 10) is still open — add </span> before it']);
  const stray = errors(page('<section>a</div>'));
  assert.match(stray[0], /^line 10: <\/div> has no matching <div> — remove it, or add the opening tag$/);
  assert.match(stray[1], /^line 11: <\/body> closes <body> from line 9, but <section> \(line 10\) is still open/);
  assert.deepEqual(errors(page('<main><p>a</main>')), [], 'p closes itself');
  assert.deepEqual(errors(page('<ul><li>a<li>b</ul><p>x<div>y</div><table><tr><td>1<td>2<tr><td>3</table><select><option>a<option>b</select><dl><dt>t<dd>d</dl>')), [], 'implied end tags');
  assert.deepEqual(errors(page('</p><p>a</p></li>')), [], 'a stray end tag of an optional-end element is harmless');
  assert.match(errors(page('<div class="x"/>'))[0], /^line 10: <div\/> is not self-closing in HTML — the browser reads it as an opening <div>/);
  assert.deepEqual(errors(page('<img src="data:,x" alt=""><br><input aria-label="x"><!-- <div> --><hr><meta name="x" content="y">')), [], 'void elements and comments');
  assert.deepEqual(errors(page('<script>const s = "<div>"; const t = `</section>`;</script><style>/* <p> */ .a{content:"<b>"}</style>')), [], 'what is inside script and style is not markup');
  assert.deepEqual(errors(page('<svg viewBox="0 0 9 9"><path d="M0 0h9"/><g><circle r="1"/></g></svg><DIV>x</Div>')), [], 'SVG children and tag case');
  assert.deepEqual(errors(page('<div class="a>\n<p>x</p>\n<p>y</p>\n<p>z</p>\n</div>')), ['line 10: an attribute quote in <div> is never closed — everything up to the next quote becomes part of it']);
  assert.deepEqual(errors(page('<!-- open')), ['line 10: a comment opened with <!-- never closes (everything after it is hidden)']);
  assert.match(errors(page('<main>\n<section>a</section>'))[0], /^line 12: <\/body> closes <body> from line 9, but <main> \(line 10\) is still open/);
  assert.deepEqual(errors('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="x"><title>T</title></head><body><p>a<p>b<ul><li>x</ul>'), [], 'html, head and body need no end tags');
  assert.match(errors(page('<script>var a = 1;'))[0], /^line 10: <script> never closes — add <\/script>/);
});

test('inline scripts: a bracket, quote or template string left open is reported on its own line', () => {
  assert.deepEqual(errors(page('<script>\nfunction f() {\n  if (x) {\n}\n</script>')), ['line 11: in this <script>: "{" opened on line 11 is never closed — the browser runs none of the script']);
  assert.match(errors(page('<script>\nconst s = "abc;\n</script>'))[0], /^line 11: in this <script>: unterminated string on line 11/);
  assert.match(errors(page('<script>\n\nconst t = `abc;\n</script>'))[0], /^line 12: in this <script>: unterminated template string starting on line 12/);
  assert.deepEqual(errors(page('<script>\nconst ok = (a) => { return a / 2 + [1, 2].map((x) => `${x}`).length; };\n</script>')), []);
  assert.deepEqual(errors(page('<script type="application/json">{"a": [1, 2}</script>')), [], 'data scripts are not code');
});

test('what the published page\'s sandbox blocks: scripts and stylesheets from elsewhere, any network call, frames, insecure or relative addresses, form targets', () => {
  const only = (html, re, opts) => {
    const e = errors(html, opts);
    assert.equal(e.length, 1, e.join('\n'));
    assert.match(e[0], re);
  };
  only(page('<script src="https://cdn.example/x.js"></script>'), /^line 10: <script src="https:\/\/cdn\.example\/x\.js"> won't load/);
  assert.deepEqual(errors(page('<script src="https://cdn.example/x.js"></script>'), widget), [], 'a widget may load scripts');
  assert.deepEqual(errors(page('<script src="/widget-kit.js"></script>'), widget), []);
  only(page('', '<link rel="stylesheet" href="https://cdn.example/a.css">'), /^line 7: <link rel="stylesheet" href> https:\/\/cdn\.example\/a\.css won't load — a published page may only use its own <style> and Google Fonts stylesheets/);
  assert.deepEqual(errors(page('', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lora&display=swap"><link rel="icon" href="data:,">')), []);
  only(page('<img src="http://x.example/a.png" alt="">'), /^line 10: <img src> http:\/\/x\.example\/a\.png is insecure \(http:\)/);
  only(page('<img src="http://x.example/a.png" alt="">'), /is insecure/, widget);
  only(page('<img src="img/a.png" alt="">'), /^line 10: <img src> img\/a\.png is a relative address — a published page has no files of its own/);
  assert.deepEqual(errors(page('<img src="img/a.png" alt="">'), widget), []);
  assert.match(warnings(page('<img src="img/a.png" alt="">'), widget)[0], /relative address — a widget has no files of its own/);
  assert.deepEqual(errors(page('<img src="/icon-192.png" alt="">'), widget), [], 'a widget may use the app\'s own files');
  assert.deepEqual(errors(page('<img src="https://x.example/a.png" alt=""><img src="//x.example/b.png" alt=""><img src="data:image/png;base64,AA" alt="">')), []);
  only(page('<img src="https://x.example/a.png" srcset="a-2x.png 2x" alt="">'), /<img srcset> a-2x\.png is a relative address/);
  assert.deepEqual(errors(page('<iframe src="https://www.youtube-nocookie.com/embed/x" title="v"></iframe><iframe src="https://player.vimeo.com/video/1" title="v"></iframe>')), []);
  only(page('<iframe src="https://maps.example/embed" title="m"></iframe>'), /^line 10: <iframe src> https:\/\/maps\.example\/embed won't show — a published page may only frame YouTube/);
  assert.deepEqual(errors(page('<iframe src="https://maps.example/embed" title="m"></iframe>'), widget), []);
  only(page('<form action="https://x.example/send"><input aria-label="e"></form>'), /^line 10: <form action="https:\/\/x\.example\/send"> — the sandbox blocks form submission/);
  only(page('<form><button formaction="/go" type="submit">Go</button></form>'), /<button formaction="\/go">/, widget);
  assert.deepEqual(errors(page('<form><input aria-label="e"><button type="submit">Go</button></form>')), [], 'a form the script handles is fine');
  only(page('<video src="http://x.example/a.mp4"></video>'), /<video src> http:\/\/x\.example\/a\.mp4 is insecure/);
  only(page('<audio><source src="clip.mp3" type="audio/mpeg"></audio>'), /<source src> clip\.mp3 is a relative address/);
  only(page('', '<base href="https://x.example/">'), /^line 7: <base> is ignored on a published page/);
  for (const [code, what] of [['fetch("https://api.example/x")', 'fetch()'], ['const r = new XMLHttpRequest()', 'XMLHttpRequest'], ['new WebSocket("wss://x.example")', 'WebSocket'], ['new EventSource("https://x.example/e")', 'EventSource'], ['navigator.sendBeacon("https://x.example", "")', 'sendBeacon()']]) {
    only(page(`<script>${code}</script>`), new RegExp(`^line 10: ${what.replace(/[()]/g, '\\$&')} — a published page can't make network requests`));
    const w = warnings(page(`<script>${code}</script>`), widget);
    assert.ok(w.some((x) => x.includes(`${what} in a widget works only with APIs that allow any origin`)), w.join('\n'));
    assert.deepEqual(errors(page(`<script>${code}</script>`), widget), []);
  }
  only(page('<script>import("https://cdn.example/m.js").then(go)</script>'), /^line 10: import\(\) — a published page runs only its own inline scripts/);
  only(page('<script>const w = new Worker("w.js")</script>'), /^line 10: new Worker\(\) — the sandbox blocks workers/);
  assert.deepEqual(errors(page('<script>const note = "call fetch( later"; // fetch(\n/* new WebSocket( */</script>')), [], 'words inside strings and comments do not count');
  only(page('<style>.a{background:url(http://x.example/a.png)}</style>'), /^line 10: url\(http:\/\/x\.example\/a\.png\) is insecure/);
  only(page('<style>\n.a{background:url("img/a.png")}</style>'), /^line 11: url\(img\/a\.png\) is a relative address/);
  assert.deepEqual(errors(page('<style>.a{background:url(data:image/png;base64,AA)} .b{background:url(https://x.example/b.png)}</style>')), []);
  only(page('<style>@font-face{font-family:X;src:url(https://cdn.example/f.woff2)}</style>'), /@font-face url\(https:\/\/cdn\.example\/f\.woff2\) won't load — a published page may use Google Fonts/);
  assert.deepEqual(errors(page('<style>@font-face{font-family:X;src:url(https://fonts.gstatic.com/s/x.woff2) format("woff2")}</style>')), []);
  only(page('<style>@import url("https://cdn.example/a.css");</style>'), /@import https:\/\/cdn\.example\/a\.css won't load/);
  assert.deepEqual(errors(page('<style>@import url(https://fonts.googleapis.com/css2?family=Lora);</style>')), []);
  only(page('<div style="background:url(http://x.example/a.png)">x</div>'), /url\(http:\/\/x\.example\/a\.png\) is insecure/);
});

test('password fields are reported (publishing refuses them), as the browser would see them', () => {
  assert.deepEqual(errors(page('<input type="password" aria-label="p">')), ['line 10: <input type="password"> — publishing refuses it because the page could pass for a real login page; leave sign-in out or show it as a plain button']);
  assert.match(errors(page('<input type="pass&#119;ord" aria-label="p">'))[0], /<input type="password">/);
  assert.match(errors(page("<script>i.type='password'</script>"))[0], /^line 10: a password field made by a script/);
  assert.deepEqual(errors(page('<input type="password" aria-label="p">'), widget), []);
  assert.match(warnings(page('<input type="password" aria-label="p">'), widget).join('\n'), /in a widget: nothing it collects can be sent anywhere/);
});

test('warnings: alt text, console.log, duplicate ids, ids the script looks for, 100vh, zoom forbidden, lang, charset, size', () => {
  const w = (html, opts) => warnings(html, opts).join('\n');
  assert.match(w(page('<img src="https://x.example/a.png">')), /^line 10: <img> without alt/);
  assert.match(w(page('<script>console.log("x")</script>')), /^line 10: console\.log left in/);
  assert.match(w(page('<p id="a">x</p>\n<p id="a">y</p>')), /^line 11: id "a" is used twice \(the first use is on line 10/);
  assert.match(w(page('<button id="go" type="button">Go</button><script>\ndocument.getElementById("gp").onclick = f;\ndocument.querySelector("#go").hidden = true;</script>')), /^line 11: the script looks for id "gp" but no element has it/);
  assert.doesNotMatch(w(page('<button id="go" type="button">Go</button><script>document.getElementById("go").onclick = f;</script>')), /looks for id/);
  assert.match(w(page('<style>.hero{height:100vh}</style>')), /^line 10: 100vh hides content behind Safari's bars/);
  assert.doesNotMatch(w(page('<style>.hero{height:100dvh;min-height:100svh}</style>')), /100vh/);
  assert.match(w('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,user-scalable=no"><title>T</title></head><body></body></html>'), /viewport forbids zooming/);
  assert.match(w('<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>T</title></head><body></body></html>'), /<html> has no lang attribute[\s\S]*no <meta charset="utf-8">/);
  assert.match(w(page('<script>localStorage.setItem("a", 1)</script>')), /localStorage throws on a published page \(sandboxed origin\) — wrap it in try\/catch/);
  assert.doesNotMatch(w(page('<script>try { localStorage.setItem("a", 1) } catch (e) {}</script>')), /localStorage/);
  assert.doesNotMatch(w(page('<script>localStorage.setItem("a", 1)</script>'), widget), /localStorage/, 'the widget host provides storage');
  assert.match(w(page(`<p>${'x'.repeat(360_000)}</p>`)), /the page is 3\d\d KB — over 350 KB it loads slowly/);
  assert.equal(C.checkHtml(page('<p>fine</p>')).warnings.length, 0);
});

test('the report is numbered lines the model can act on', () => {
  const r = C.checkHtml(page('<div><span>x</div><img src="https://x.example/a.png">'));
  const out = C.formatCheck(r, 'draft "x"');
  assert.match(out, /^CHECK draft "x": 1 error, 1 warning — 1 KB, 12 lines, \d+ tags, 0 inline scripts, 0 style blocks, 1 image\nERRORS — fix every one, then check again \(publish_site refuses a page with errors\):\n1\. line 10: <\/div> closes <div>[^\n]*\nWARNINGS — worth fixing before you hand over the link:\n1\. line 10: <img> without alt/);
  assert.match(C.formatCheck(C.checkHtml(page('<p>ok</p>'))), /^CHECK: no errors, no warnings[\s\S]*Clean\. Run the self-review checklist/);
  assert.match(C.formatCheck(C.checkHtml(page('<img src="https://x.example/a.png">'))), /No errors: it may be published\. Fix the warnings/);
  assert.match(C.refusal('not published', ['line 1: a', 'line 2: b']), /^not published — fix these first:\n1\. line 1: a\n2\. line 2: b$/);
  // many of the same mistake: capped, with a count
  const many = C.checkHtml(page(Array.from({ length: 40 }, (_, i) => `<img src="https://x.example/${i}.png">`).join('\n')));
  assert.equal(many.warnings.length, 31);
  assert.equal(many.warnings[30], '…and 10 more warnings');
});

test('the check_html tool: the html given, a published page, or the draft in parts; offered for checking words and in every coding turn', async () => {
  const tool = T.toolByName.get('check_html');
  assert.ok(tool.pure, 'read-only');
  const out = await tool.run({ html: page('<div><span>x</div>') }, {});
  assert.match(out, /^CHECK: 1 error, no warnings/);
  assert.match(await tool.run({ html: '<h1>hi</h1>', widget: true }, {}), /^CHECK: no errors, 1 warning/);
  const whole = page('<section><h2>In parts</h2></section>');
  const db = new Map([['site:acme', { name: 'acme', title: 'A', html: page('<p>ok</p>'), source: '', at: 1 }], ['site:draft:big', { parts: [whole.slice(0, 60), whole.slice(60)], at: 2 }], ['site:draft:old', { parts: ['<p>'], at: 1 }]]);
  const storage = { async get(k) { return db.get(k); }, async put(k, v) { db.set(k, v); }, async list({ prefix }) { return new Map([...db].filter(([k]) => k.startsWith(prefix))); } };
  assert.match(await tool.run({ site: 'acme' }, { storage, env: {} }), /^CHECK published page "acme": no errors, no warnings/);
  assert.match(await tool.run({ site: 'big', draft: true }, { storage, env: {} }), /^CHECK draft "big" \(2 parts\): no errors/);
  assert.match(await tool.run({ draft: true }, { storage, env: {} }), /^CHECK draft "big"/, 'the newest draft when no name is given');
  await assert.rejects(tool.run({ site: 'nope' }, { storage, env: {} }), /nothing is published at \/s\/nope/);
  await assert.rejects(tool.run({ site: 'nope', draft: true }, { storage, env: {} }), /no draft called "nope"/);
  await assert.rejects(tool.run({}, {}), /give the html/);
  const paused = { async get() { throw new Error('Exceeded allowed rows read in Durable Objects free tier.'); } };
  await assert.rejects(tool.run({ site: 'acme' }, { storage: paused, env: {} }), /free daily allowance/);
  const names = (text, code = false) => T.selectTools(text, new Set(), code).map((t) => t.name);
  assert.ok(names('check this page for bugs').includes('check_html'));
  assert.ok(names('make me a landing page for my bakery', true).includes('check_html'), 'every coding turn');
  assert.ok(!names('hello, how are you?').includes('check_html'));
  const build = T.TOOL_GROUPS.find((g) => g.name === 'build');
  assert.ok(/^you can /i.test(build.about) && build.about.length <= 220, build.about);
});

test('create_widget refuses broken tags and scripts only; a widget without a doctype installs with a note', async () => {
  const tool = T.toolByName.get('create_widget');
  const storage = { m: new Map(), async put(k, v) { this.m.set(k, v); } };
  const events = [];
  const ctx = { storage, emit: (e) => events.push(e) };
  await assert.rejects(tool.run({ name: 'a', title: 'A', html: '<div><span>x</div>' }, ctx), /^Error: not installed — fix these first:\n1\. line 1: <\/div> closes <div> from line 1, but <span> \(line 1\) is still open/);
  await assert.rejects(tool.run({ name: 'b', title: 'B', html: '<h1>x</h1><script>function go( {</script>' }, ctx), /not installed — fix these first:\n1\. line 1: in this <script>/);
  assert.equal(storage.m.size, 0);
  const out = await tool.run({ name: 'c', title: 'C', html: '<h1 id="t">x</h1><script>fetch("https://api.open-meteo.com/x")</script>' }, ctx);
  assert.match(out, /^Installed widget "c" and opened it on screen\. It stays in Workshop → Widgets\. Worth fixing \(check_html\): line 1: no <!doctype html>[^|]*\| line 1: fetch\(\) in a widget works only with APIs that allow any origin/);
  assert.ok(storage.m.has('widget:c'));
  assert.equal(events.find((e) => e.t === 'client')?.name, 'open_widget');
});
