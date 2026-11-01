// BRIEF-REST-A (batch ⑧ part A): WIKIPEDIA, OFFLINE (Kiwix's vendored reader on a fixture ZIM read in pieces, the article
// made safe with its links rewritten, the first paragraph, the chat's words), the Worker's passthrough for the files, Siri
// Shortcuts' links (say, do, a stranger, the links made) and MORSE (both ways, its timing, the tap timer, a letter a day).
// The phone's modules are bundled here with esbuild; the fixture is made from our own words (tests/fixtures/zim).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { ARTICLES, XZ_ARTICLES, buildZim } from '../../../tests/fixtures/zim/fixture.mjs';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: {
    zim: at('../../web/src/wiki/zim.ts'),
    html: at('../../web/src/wiki/html.ts'),
    words: at('../../web/src/wiki/words.ts'),
    files: at('../../web/src/wiki/files.ts'),
    pass: at('../src/zim.ts'),
    catalogue: at('../../../packages/shared/src/catalogue.ts'),
    resta: at('../../../packages/shared/src/catalogue/resta.ts'),
  },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outdir: at('./.build/resta'),
  outExtension: { '.js': '.mjs' },
  logLevel: 'error',
});
const Z = await import('./.build/resta/zim.mjs');
const H = await import('./.build/resta/html.mjs');
const W = await import('./.build/resta/words.mjs');
const F = await import('./.build/resta/files.mjs');
const P = await import('./.build/resta/pass.mjs');
const C = await import('./.build/resta/catalogue.mjs');
const R = await import('./.build/resta/resta.mjs');

const VENDOR = at('../../web/public/vendor/kiwix/');
Z.setReaderBase(pathToFileURL(VENDOR).href, { xz: readFileSync(`${VENDOR}xzdec-wasm.wasm`), zstd: readFileSync(`${VENDOR}zstddec-wasm.wasm`) });

/** The fixture as wiki/store.ts hands it to the reader: pieces (small ones here, so reads cross from one to the next). */
function pieces(bytes, size) {
  const out = [];
  for (let a = 0, i = 0; a < bytes.length; a += size, i++) {
    const part = bytes.slice(a, Math.min(bytes.length, a + size));
    out.push({ name: `test.zim.p${String(i).padStart(5, '0')}`, size: part.length, slice: (s, e) => ({ arrayBuffer: async () => part.slice(s, e).buffer }) });
  }
  return out.reverse(); // the reader puts them in order by name
}
const zim = buildZim();

// ---------------------------------------------------------------- the reader

test('Kiwix’s reader reads the fixture ZIM in pieces: its metadata, the title index, each kind of cluster, redirects, a picture', async () => {
  assert.deepEqual([...zim.slice(0, 4)], [0x5a, 0x49, 0x4d, 0x04], 'a ZIM file');
  const a = await Z.openArchive(pieces(zim, 700));
  assert.equal(a.meta.title, 'Ghosty test Wikipedia');
  assert.equal(a.meta.date, '2026-10-15');
  assert.equal(a.meta.language, 'eng');
  assert.equal(a.meta.articles, 7, 'five articles and two redirects in the title index');
  // the title search: a prefix as typed, and in the usual capitalisations; redirects are titles too
  assert.deepEqual((await a.search('Black h')).map((x) => x.title), ['Black hole', 'Black holes']);
  assert.deepEqual((await a.search('black')).map((x) => x.title), ['Black hole', 'Black holes'], 'lower case finds the capitalised title');
  assert.deepEqual((await a.search('s')).map((x) => x.path), ['C/Star', 'C/Sun']);
  assert.deepEqual(await a.search('zebra'), []);
  assert.deepEqual(await a.search('   '), []);
  assert.equal((await a.search('', 5)).length, 0);
  // an exact title, redirects followed
  assert.deepEqual(await a.find(['Black holes']), { title: 'Black hole', path: 'C/Black_hole' });
  assert.deepEqual(await a.find(['cats', 'Cats']), { title: 'Cat', path: 'C/Cat' });
  assert.equal(await a.find(['Unicorn']), null);
  // articles from the zstd cluster and the xz cluster, byte for byte
  assert.equal((await a.article('C/Black_hole')).html, ARTICLES.Black_hole, 'zstd');
  assert.equal((await a.article('C/Volcano')).html, ARTICLES.Volcano, 'zstd, the last blob');
  assert.equal((await a.article('C/Cat')).html, XZ_ARTICLES.Cat, 'xz');
  assert.equal((await a.article('C/Sun')).html, XZ_ARTICLES.Sun, 'xz, the second blob');
  const r = await a.article('C/Black_holes');
  assert.equal(r.path, 'C/Black_hole', 'a redirect opens its article');
  assert.equal(await a.article('C/General_relativity'), null, 'not in this file');
  assert.equal(await a.article('C/_assets_/x/Dot.png'), null, 'a picture is not an article');
  // the picture, from the uncompressed cluster
  const png = await a.bytes('C/_assets_/x/Dot.png');
  assert.equal(png.mime, 'image/png');
  assert.deepEqual([...png.data.slice(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  // a random article is an article
  for (let i = 0; i < 5; i++) assert.match((await a.random()).path, /^C\/(Black_hole|Star|Volcano|Cat|Sun)$/);
  // one piece or many: the same file
  const one = await Z.openArchive(pieces(zim, zim.length));
  assert.equal((await one.article('C/Star')).html, ARTICLES.Star);
});

// ---------------------------------------------------------------- the article, made safe

test('an entry path from a link or a picture, relative to the article (Kiwix’s own addresses)', () => {
  assert.equal(H.resolvePath('C/Ray_Charles', 'A_Fool_for_You'), 'C/A_Fool_for_You');
  assert.equal(H.resolvePath('C/Ray_Charles', './Georgia_on_My_Mind#Covers'), 'C/Georgia_on_My_Mind');
  assert.equal(H.resolvePath('C/Ray_Charles', 'Would_You_Believe%3F_(Ray_Charles_album)'), 'C/Would_You_Believe?_(Ray_Charles_album)');
  assert.equal(H.resolvePath('C/Ray_Charles', './_assets_/0c70/Home%252C_Greenville.JPG'), 'C/_assets_/0c70/Home%2C_Greenville.JPG', 'decoded once, as the entry is named');
  assert.equal(H.resolvePath('C/AC/DC', '../Foo'), 'C/Foo');
  assert.equal(H.resolvePath('A/Cat', '../I/m/cat.png'), 'I/m/cat.png', 'the old layout');
  for (const off of ['https://en.wikipedia.org/wiki/Cat', '//example.org/x', '#cite_note-1', 'mailto:a@b.c', 'javascript:alert(1)', '']) assert.equal(H.resolvePath('C/Cat', off), null, off);
});

test('the link rewriter: other articles open in place, the web is marked, nothing runs or loads from anywhere, pictures by entry', () => {
  const r = H.rewriteArticle(ARTICLES.Black_hole, 'C/Black_hole');
  assert.equal(r.title, 'Black hole');
  assert.deepEqual(r.links, ['C/Star', 'C/General_relativity']);
  assert.match(r.doc, /<a href="about:blank#zim=C%2FStar" data-zim="C\/Star" title="Star">star<\/a>/);
  assert.match(r.doc, /href="about:blank#ext=https%3A%2F%2Fexample\.org%2Ffar"[^>]*class="ext"/);
  assert.deepEqual(r.images, [{ i: 0, path: 'C/_assets_/x/Dot.png' }]);
  assert.match(r.doc, /<img data-zim-src="C\/_assets_\/x\/Dot\.png" data-i="0" alt="A dark dot" width="2" height="2">/);
  for (const bad of [/<script/i, /<iframe/i, /<link/i, /\bon(?:click|mouseover)=/i, /javascript:/i, /src="\.\/_assets_/, /href="#cite/]) assert.doesNotMatch(r.doc, bad, String(bad));
  assert.match(r.doc, /<a>\[1\]<\/a>/, 'a footnote mark stays, inert');
  assert.match(r.doc, /^<!doctype html>.*<meta charset="utf-8">.*<article class="wiki">/s);
  // a style that would load from elsewhere loses the address; a quoted ">" does not break a tag
  const s = H.rewriteArticle('<body><p style="background:url(https://x.example/a.png);color:red" data-mw=\'{"a":"<b>"}\' title="a > b">x</p><style>@import url(https://x.example/s.css); p{background:url(//x.example/b.png)}</style></body>', 'C/X');
  assert.doesNotMatch(s.doc, /x\.example/);
  assert.match(s.doc, /<p style="background:none;color:red" title="a &gt; b">x<\/p>/);
});

test('the first paragraph: not the infobox’s, not an empty one, no footnote marks; READ IT TO ME stops at the sources', () => {
  assert.equal(H.firstParagraph(ARTICLES.Black_hole), 'A black hole is a place in space where gravity pulls so hard that not even light can get out. It forms when a very big star falls in on itself, as general relativity says.');
  assert.equal(H.firstParagraph(XZ_ARTICLES.Cat), 'The cat is a small furry animal that people keep as a pet. Cats like to sleep, play and hunt mice.');
  assert.equal(H.firstParagraph('<p>Too short.</p><p>Coordinates: 51°N 0°W and some more words here</p><p>&ldquo;Quoted&rdquo; words &amp; more words, long enough to count.</p>'), '“Quoted” words & more words, long enough to count.');
  assert.ok(H.firstParagraph(`<p>${'word '.repeat(400)}</p>`, 200).length <= 201);
  const t = H.articleText(ARTICLES.Black_hole);
  assert.match(t, /^Black hole\.\nA black hole is a place in space/);
  assert.match(t, /\nFormation\.\nMost black holes form/);
  assert.doesNotMatch(t, /book about space|Infobox|alert/);
  assert.equal(H.decodeEntities('&amp;&lt;&#39;&#x2014;&nbsp;&unknown;'), '&<\'— &unknown;');
});

test('his words for it: offline Wikipedia, "look it up offline", and the "what is X?" the chat offers it for', () => {
  assert.deepEqual(W.wikiAsked('offline wikipedia black holes'), { thing: 'black holes', offline: true });
  assert.deepEqual(W.wikiAsked('Wikipedia offline: volcanoes'), { thing: 'volcanoes', offline: true });
  assert.deepEqual(W.wikiAsked('Look it up offline.'), { thing: '', offline: true });
  assert.deepEqual(W.wikiAsked('look up the moon offline'), { thing: 'the moon', offline: true });
  assert.deepEqual(W.wikiAsked('look stars up offline'), { thing: 'stars', offline: true });
  assert.deepEqual(W.wikiAsked('What does Wikipedia say about volcanoes (offline)?'), { thing: 'volcanoes', offline: true });
  assert.deepEqual(W.wikiAsked('what does wikipedia say about volcanoes?'), { thing: 'volcanoes', offline: false });
  for (const t of ['what is wikipedia', 'look it up', 'open wikipedia', 'offline brain', 'is wikipedia offline?']) assert.equal(W.wikiAsked(t), null, t);
  assert.equal(W.whatIsAsked('what is a cat?'), 'cat');
  assert.equal(W.whatIsAsked('Who was Ray Charles'), 'Ray Charles');
  assert.equal(W.whatIsAsked('what’s a black hole'), 'black hole');
  assert.equal(W.whatIsAsked('tell me about volcanoes'), 'volcanoes');
  for (const t of ['what is the time?', 'what is my name', 'what is it', 'what are you doing', 'how are you']) assert.equal(W.whatIsAsked(t), null, t);
  assert.deepEqual(W.titleVariants('black holes'), ['black holes', 'Black holes', 'Black Holes', 'BLACK HOLES']);
  assert.deepEqual(W.titleVariants('the Sun'), ['Sun', 'sun', 'SUN']);
});

test('the two files offered: their sizes said first, never the whole English Wikipedia, the licence said', () => {
  assert.equal(F.WIKI_FILES.length, 2);
  for (const f of F.WIKI_FILES) assert.match(f.file, /^wikipedia_en[-_a-z0-9]+_\d{4}-\d{2}\.zim$/);
  assert.match(P.ZIM_NAME.source, /wikipedia/);
  for (const f of F.WIKI_FILES) assert.ok(P.ZIM_NAME.test(f.file), `the Worker lets ${f.file} through`);
  assert.deepEqual(F.WIKI_FILES.map((f) => F.sizeWords(f.bytes)), ['53 MB', '1.1 GB']);
  assert.ok(F.WIKI_FILES.every((f) => f.bytes < P.ZIM_MAX_FILE));
  assert.match(F.WHY_NOT_ALL, /119 GB/);
  assert.match(F.LICENCE, /CC BY-SA/);
  assert.equal(F.monthWords('2026-09-28'), 'September 2026');
  assert.equal(F.keptLine(F.WIKI_FILES[1], 1_094_936_257, '2026-09-28'), 'Simple English Wikipedia, September 2026, 1.1 GB on your phone');
});

// ---------------------------------------------------------------- the Worker's passthrough

test('the Worker passes a piece of a Kiwix file through, streamed and kept nowhere; anything else is refused', async () => {
  const asked = [];
  const kiwix = (status, headers = {}) => async (url, init) => {
    asked.push({ url, init });
    return new Response(status === 206 ? new Uint8Array(8) : null, { status, headers });
  };
  const get = (file, range, fetcher, method = 'GET') => P.zimPassthrough(new Request(`https://g.example/api/zim/${file}`, { method, headers: range ? { range } : {} }), file, fetcher);
  const file = 'wikipedia_en-simple_all_nopic_2026-09.zim';
  const ok = await get(file, 'bytes=0-7', kiwix(206, { 'content-range': 'bytes 0-7/1094936257', 'content-length': '8', 'last-modified': 'Mon, 28 Sep 2026 01:12:38 GMT' }));
  assert.equal(ok.status, 206);
  assert.equal(ok.headers.get('content-range'), 'bytes 0-7/1094936257');
  assert.equal(ok.headers.get('cache-control'), 'no-store');
  assert.equal(ok.headers.get('content-type'), 'application/octet-stream');
  assert.equal((await ok.arrayBuffer()).byteLength, 8);
  assert.equal(asked[0].url, `https://download.kiwix.org/zim/wikipedia/${file}`);
  assert.equal(asked[0].init.headers.range, 'bytes=0-7');
  assert.equal(asked[0].init.cache, 'no-store');
  // only Wikipedia files by their Kiwix names; a piece at a time, 64 MB at most; never a file over 4 GB
  assert.equal((await get('../etc/passwd', 'bytes=0-7', kiwix(206))).status, 404);
  assert.equal((await get('gutenberg_en_all_2026-01.zim', 'bytes=0-7', kiwix(206))).status, 404);
  assert.equal((await get(file, '', kiwix(206))).status, 416, 'no range: no whole file');
  assert.equal((await get(file, `bytes=0-${64 * 1024 * 1024}`, kiwix(206))).status, 416);
  assert.equal((await get('wikipedia_en_all_maxi_2026-08.zim', 'bytes=0-7', kiwix(206, { 'content-range': 'bytes 0-7/119000000000' }))).status, 413);
  assert.equal((await get(file, 'bytes=0-7', kiwix(200, { 'content-length': '1094936257' }))).status, 502, 'a mirror that sends the whole file');
  assert.equal((await get(file, 'bytes=0-7', kiwix(404))).status, 404);
  assert.equal((await get(file, 'bytes=0-7', async () => { throw new TypeError('fetch failed'); })).status, 502);
  assert.equal((await get(file, '', kiwix(200, { 'content-length': '1094936257' }), 'POST')).status, 405);
  const head = await get(file, '', kiwix(200, { 'content-length': '1094936257' }), 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('content-length'), '1094936257');
  // the route sits behind the owner's sign-in in the Worker, and never reaches the brain
  const index = readFileSync(at('../src/index.ts'), 'utf8');
  assert.ok(index.indexOf("startsWith('/api/zim/')") > index.indexOf('const auth = await authenticate(req, env)'), 'after the sign-in check');
  assert.ok(index.indexOf("startsWith('/api/zim/')") < index.indexOf("env.AGENT.get(env.AGENT.idFromName('owner'));\n    const fwd"), 'before the brain');
});

// ---------------------------------------------------------------- the catalogue

test('every new thing has its words: the Wikipedia panel, the chat’s two phrases, SHORTCUTS, and the Morse sheet (its phrase)', () => {
  assert.deepEqual(Object.keys(R.RESTA_WORDS).sort(), ['panel:library:WIKIPEDIA, OFFLINE', 'phrase:wiki']);
  for (const [k, v] of Object.entries(R.RESTA_WORDS)) {
    assert.deepEqual(C.wordProblems(k, v), [], k);
    assert.ok(C.CATALOGUE[k], `${k} joined into the catalogue`);
  }
  assert.match(R.RESTA_WORDS['panel:library:WIKIPEDIA, OFFLINE'].more, /my brain never reads it/);
  assert.match(R.RESTA_WORDS['phrase:wiki'].more, /never reads the file/);
});
