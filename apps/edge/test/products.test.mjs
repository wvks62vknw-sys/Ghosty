// FIT FINDER: prices and sizes read off real shop pages (IKEA UK's Product data and measurement
// list, Habitat's "H82, W193, D91cm" with a package size and seat sizes that must not count,
// Dunelm's AggregateOffer "from" price with no size) fetched on 2026-10-17 into
// test/products.fixture.json; the text patterns shops use; the fit check and the ranking (fit
// margin, then price); a price is never invented; and find_furniture end to end with the
// search and the shop pages faked (≤ 8 page reads, a shop that turns the reader away).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const B = './.build';
const P = await import(`${B}/integrations/products.mjs`);
const T = await import(`${B}/tools/index.mjs`);
const FX = JSON.parse(readFileSync(new URL('./products.fixture.json', import.meta.url), 'utf8')).pages;

test('IKEA: the Product data gives width, depth and the price in pounds; the measurement list gives the height', () => {
  const p = P.parseProduct(FX.ikea.url, FX.ikea.html);
  assert.equal(p.shop, 'IKEA');
  assert.match(p.title, /EKHOLMA 3-seat sofa/);
  assert.equal(p.price, 549);
  assert.equal(p.priceFrom, false);
  assert.deepEqual(p.dims, { w: 207, d: 85, h: 94 });
  assert.equal(p.dimsFrom, 'product data');
});

test('IKEA desk: its Product data puts the 120 cm length in "depth"; the measurement list (Length 120, Width 60) says which side runs along the wall', () => {
  const p = P.parseProduct(FX.ikeaDesk.url, FX.ikeaDesk.html);
  assert.match(p.title, /LAGKAPTEN \/ ADILS/);
  assert.equal(p.price, 40);
  assert.deepEqual(p.dims, { w: 120, d: 60, h: 73 });
});

test('Habitat: "Size H82, W193, D91cm" — not the package size, the seat depth or the width between the arms', () => {
  const p = P.parseProduct(FX.habitat.url, FX.habitat.html);
  assert.equal(p.shop, 'Habitat');
  assert.match(p.title, /Jacob velvet/);
  assert.equal(p.price, 700);
  assert.deepEqual(p.dims, { h: 82, w: 193, d: 91 });
  assert.equal(p.dimsFrom, 'page text');
  assert.equal(p.orderAssumed, false);
});

test('Dunelm: an AggregateOffer is a "from" price; no size on the page stays no size', () => {
  const p = P.parseProduct(FX.dunelm.url, FX.dunelm.html);
  assert.equal(p.shop, 'Dunelm');
  assert.equal(p.price, 99);
  assert.equal(p.priceFrom, true);
  assert.deepEqual(p.dims, {});
  assert.equal(p.dimsFrom, 'none');
});

test('the size patterns shops write', () => {
  const t = (s) => P.textDims(s);
  assert.deepEqual(t('Dimensions: W200 x D90 x H85cm').dims, { w: 200, d: 90, h: 85 });
  assert.deepEqual(t('Size: H 85cm x W 200cm x D 90cm').dims, { h: 85, w: 200, d: 90 });
  assert.deepEqual(t('Overall: 200cm W x 90cm D x 85cm H').dims, { w: 200, d: 90, h: 85 });
  assert.deepEqual(t('This sofa is 200cm W and 95 cm D').dims, { w: 200, d: 95 });
  assert.deepEqual(t('Width: 200cm. Depth: 90cm. Height: 85cm. Seat depth: 55cm.').dims, { w: 200, d: 90, h: 85 });
  assert.deepEqual(t('Width 2000mm, Depth 900mm').dims, { w: 200, d: 90 });
  assert.deepEqual(t('Seat depth: 55cm. Width: 180 cm').dims, { w: 180 });
  assert.deepEqual(t('Bed frame. Length: 209 cm. Width: 146 cm.').dims, { w: 146, d: 209 });
  assert.deepEqual(t('Dining table. Length: 180 cm. Width: 90 cm.').dims, { w: 180, d: 90 });
  const bare = t('Dimensions 200 x 90 x 85 cm');
  assert.deepEqual(bare.dims, { w: 200, d: 90, h: 85 });
  assert.equal(bare.orderAssumed, true, 'three bare numbers: the order is assumed, and said so');
  assert.deepEqual(t('85 x 200 x 90 cm (H x W x D)').dims, { h: 85, w: 200, d: 90 });
  assert.deepEqual(t('Package size H67, W195, D93cm.').dims, {}, 'a box is not the thing');
  assert.deepEqual(t('2 doors, 3 drawers, oak').dims, {});
  assert.deepEqual(t('W 72 x D 30 x H 180 in').dims, { w: 182.9, d: 76.2, h: 457.2 });
});

test('a price is only ever what the page states in pounds: none stays none, other currencies are not taken', () => {
  const ld = (o) => `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', name: 'Desk', width: '120 cm', ...o })}</script>`;
  assert.equal(P.parseProduct('https://shop.example/p/1', ld({})).price, null);
  assert.equal(P.parseProduct('https://shop.example/p/1', ld({ offers: { '@type': 'Offer', price: '199.99', priceCurrency: 'EUR' } })).price, null);
  assert.equal(P.parseProduct('https://shop.example/p/1', ld({ offers: [{ price: 120, priceCurrency: 'GBP' }, { price: 99, priceCurrency: 'GBP' }] })).price, 99);
  assert.equal(P.parseProduct('https://shop.example/p/1', ld({ offers: [{ price: 120, priceCurrency: 'GBP' }, { price: 99, priceCurrency: 'GBP' }] })).priceFrom, true);
  // a page full of "£" amounts (delivery, discounts) but no stated product price: no price
  const noisy = '<html><title>Desk</title><body>Save £50! Delivery £9.95. Was £300. W120 x D60 x H75cm</body></html>';
  const p = P.parseProduct('https://shop.example/p/2', noisy);
  assert.equal(p.price, null);
  assert.deepEqual(p.dims, { w: 120, d: 60, h: 75 });
  // the page's own price meta in pounds counts
  assert.equal(P.parseProduct('https://shop.example/p/3', '<meta property="product:price:amount" content="249.00"><meta property="product:price:currency" content="GBP">').price, 249);
  // a search listing's line gives a size, never a price
  const l = P.parseListing('https://www.argos.co.uk/product/7715446', 'Argos Home Harry 3 Seater Sofa £299', 'W200 x D88 x H82cm. Only £299 today');
  assert.equal(l.price, null);
  assert.deepEqual(l.dims, { w: 200, d: 88, h: 82 });
  assert.match(P.formatResults(P.rankProducts([l], { w: 210 }), { w: 210 }), /price not on the page/);
});

test('fit: spare room on the tightest side, tight under 5 cm, too big, unknown when the page gives no size, over budget', () => {
  const p = (dims, price = 100) => ({ url: `https://x.example/p/${JSON.stringify(dims)}${price}`, shop: 'X', title: 'T', price, priceFrom: false, dims, dimsFrom: 'product data', orderAssumed: false });
  assert.deepEqual(P.fitOf(p({ w: 207, d: 85 }), { w: 220, d: 100 }), { fit: 'fits', margin: 13, why: '13 cm spare in width' });
  assert.equal(P.fitOf(p({ w: 218, d: 85 }), { w: 220 }).fit, 'tight');
  assert.deepEqual(P.fitOf(p({ w: 228 }), { w: 220 }), { fit: 'too big', margin: -8, why: '8 cm too wide' });
  assert.equal(P.fitOf(p({ w: 200 }), { w: 220, h: 90 }).fit, 'unknown');
  assert.equal(P.fitOf(p({ w: 200 }, 900), { w: 220, budget: 600 }).fit, 'over budget');
});

test('ranking: fits with room first, then tight, unknown, too big; the cheapest first within each', () => {
  const mk = (id, w, price) => ({ url: `https://x.example/p/${id}`, shop: 'X', title: id, price, priceFrom: false, dims: w == null ? {} : { w }, dimsFrom: 'product data', orderAssumed: false });
  const list = [mk('big', 240, 100), mk('tight', 218, 50), mk('roomyDear', 190, 800), mk('roomyCheap', 200, 300), mk('nosize', null, 10), mk('noprice', 180, null)];
  const r = P.rankProducts([...list, list[0]], { w: 220 });
  assert.deepEqual(r.map((x) => x.title), ['roomyCheap', 'roomyDear', 'noprice', 'tight', 'nosize', 'big']);
  const text = P.formatResults(r, { w: 220 });
  assert.match(text, /^Wanted: W ≤ 220 cm\./);
  assert.match(text, /1\. roomyCheap — X — £300 — W200 × D\? × H\? cm — FITS: 20 cm spare in width\n {3}https:\/\/x\.example\/p\/roomyCheap/);
  assert.match(text, /noprice — X — price not on the page/);
  assert.match(text, /TOO BIG: 20 cm too wide/);
});

test('search hits: ads and lists are not product pages; known shops first', () => {
  const text = [
    '1. 3 seater sofas | IKEA\nhttps://www.ikea.com/gb/en/cat/3-seater-sofas-10670/\nlist',
    '2. Advert\nhttps://duckduckgo.com/y.js?ad_domain=anabei.com&u3=x\nad',
    '3. Some blog sofa\nhttps://blog.example/product/123456\nblog',
    '4. EKHOLMA\nhttps://www.ikea.com/gb/en/p/ekholma-3-seat-sofa-hakebo-beige-s09537412/\nsofa',
    '5. Jacob\nhttps://www.habitat.co.uk/product/2910246\nsofa',
  ].join('\n\n');
  const hits = P.hitsFrom(text);
  assert.equal(hits.length, 5);
  assert.deepEqual(P.pickPages(hits).map((h) => h.url), ['https://www.ikea.com/gb/en/p/ekholma-3-seat-sofa-hakebo-beige-s09537412/', 'https://www.habitat.co.uk/product/2910246', 'https://blog.example/product/123456']);
  assert.equal(P.shopName('https://www.diy.com/departments/x/123456_BQ.prd'), 'B&Q');
  assert.equal(P.looksLikeProduct('https://www.ebay.co.uk/itm/1234567890'), true);
  assert.equal(P.looksLikeProduct('https://www.argos.co.uk/browse/home/sofas/c:29643/'), false);
});

/** A DuckDuckGo results page linking to these addresses. */
const ddg = (urls) =>
  `<html><body>${urls.map((u, i) => `<div><a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=${encodeURIComponent(u)}&amp;rut=x">Result ${i + 1} sofa</a><a class="result__snippet" href="x">A sofa W200 x D90 x H85cm</a></div>`).join('')}</body></html>`;

test('find_furniture: two searches, the shop pages read (≤ 8), what fits ranked with links, as data; a shop that refuses is honest', async () => {
  const tool = T.toolByName.get('find_furniture');
  assert.ok(tool && tool.pure, 'find_furniture is a read-only tool');
  const calls = [];
  const saved = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    calls.push(url);
    assert.ok(init.signal, `no timeout on ${url}`);
    if (url.startsWith('https://html.duckduckgo.com/')) {
      return new Response(ddg([FX.ikea.url, FX.habitat.url, FX.dunelm.url, 'https://www.argos.co.uk/product/7715446', 'https://www.ikea.com/gb/en/cat/3-seater-sofas-10670/']), { headers: { 'content-type': 'text/html' } });
    }
    for (const k of ['ikea', 'habitat', 'dunelm']) if (url === FX[k].url) return new Response(FX[k].html, { headers: { 'content-type': 'text/html' } });
    if (url.includes('argos.co.uk')) return new Response('blocked', { status: 403 });
    throw new TypeError(`no fake for ${url}`);
  };
  const progress = [];
  try {
    const out = await tool.run({ item: '3 seater sofa', max_width_cm: 210, max_depth_cm: 95, budget_gbp: 800 }, { vault: { get: async () => null }, progress: (l, d, t) => progress.push([l, d, t]) });
    assert.match(out, /^<<external content from shop pages/);
    const lines = out.split('\n').filter((l) => /^\d+\. /.test(l));
    // Argos turned the reader away (403): its listing's size is used (it fits with 5 cm to spare), never a price
    assert.match(lines[0], /^1\. Result 4 sofa — Argos — price not on the page — W200 × D90 × H85 cm \(from the search listing\) — FITS: 5 cm spare in depth$/);
    // two tight fits, the cheaper first
    assert.match(lines[1], /^2\. EKHOLMA 3-seat sofa - Hakebo beige — IKEA — £549 — W207 × D85 × H94 cm — FITS \(tight\): 3 cm spare in width$/);
    assert.match(lines[2], /^3\. Habitat Jacob velvet 3 Seater Sofa - Orange — Habitat — £700 — W193 × D91 × H82 cm — FITS \(tight\): 4 cm spare in depth$/);
    // Dunelm's page gives a price but no size: fit unknown, never dropped silently, never sized
    assert.match(lines[3], /^4\. Palmira Made to Measure Curtains — Dunelm — from £99 — size not given — fit unknown: width and depth not given on the page$/);
    assert.match(out, /\n {3}https:\/\/www\.habitat\.co\.uk\/product\/2910246\n/);
    assert.match(out, /\(3 of 4 shop pages read\.\)/);
    const pages = calls.filter((u) => !u.includes('duckduckgo'));
    assert.ok(pages.length <= 8, `${pages.length} page reads`);
    assert.ok(calls.length <= 40, `${calls.length} outbound requests in all`);
    assert.ok(progress.some(([l]) => /reading shop pages/.test(l)));
  } finally {
    globalThis.fetch = saved;
  }
});

test('find_furniture is offered for furniture words and the planner can be opened from the chat', () => {
  const on = (text) => T.selectGroups(text, new Set()).on.map((g) => g.name);
  assert.ok(on('find me a sofa that fits 2 metres').includes('home'));
  assert.ok(on('will a double wardrobe fit?').includes('home'));
  assert.ok(!on('what is the weather tomorrow').includes('home'));
  const names = T.selectTools('make space in my living room', new Set()).map((t) => t.name);
  assert.ok(names.includes('find_furniture') && names.includes('open_space'));
  assert.ok(!T.selectTools('hello', new Set()).some((t) => t.name === 'open_space'), 'not described on a plain turn');
});
