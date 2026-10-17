// Gadgets and parts (integrations/parts.ts, integrations/gadgets.ts, tools/gadgets.ts): a real
// eSpares door-seal page and a real Toolstation fuse page (fetched with curl on 2026-10-17, kept
// in test/parts.fixture.json without their unrelated scripts) read for title, price, stock and part
// number; matching and ranking; the whole find_part errand with the web faked — shop pages first,
// a page that will not open listed without a price (never a guessed one), pages that match nothing
// dropped, nothing found said plainly; best settings from a real RTINGS settings page (its text
// sits in the page's data), the "nothing published" answer; the tools and their keyword group.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const B = './.build';
const P = await import(`${B}/integrations/parts.mjs`);
const G = await import(`${B}/integrations/gadgets.mjs`);
const T = await import(`${B}/tools/index.mjs`);
const FX = JSON.parse(readFileSync(new URL('./parts.fixture.json', import.meta.url), 'utf8'));

const html = (body, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });

test('a real eSpares page: title, £20.11 from its own offer data, in stock, part number GSK615', () => {
  const p = P.parseProduct(FX.espares, FX.esparesUrl);
  assert.equal(p.title, 'Washing Machine Door Seal');
  assert.equal(p.price, 20.11);
  assert.equal(p.currency, 'GBP');
  assert.equal(p.priceFrom, 'product data');
  assert.equal(p.availability, 'in stock');
  assert.ok(p.partNumbers.includes('GSK615'), p.partNumbers.join());
});

test('a real Toolstation page: JSON-LD product, £2.15, brand, stock, the product code', () => {
  const p = P.parseProduct(FX.toolstation, FX.toolstationUrl);
  assert.equal(p.title, 'Tower Cartridge Fuse 3A');
  assert.equal(p.price, 2.15);
  assert.equal(p.currency, 'GBP');
  assert.equal(p.brand, 'Tower');
  assert.equal(p.availability, 'in stock');
  assert.ok(p.partNumbers.includes('AG420'), p.partNumbers.join());
});

test('a page with no product data gives the visible price, marked as such; one with none gives none', () => {
  const p = P.parseProduct('<html><head><title>Belt for Bosch dryer | Spares R Us</title></head><body><h1>Belt</h1><p>Now &pound;7.49 — out of stock</p></body></html>', 'https://example.co.uk/belt');
  assert.equal(p.price, 7.49);
  assert.equal(p.priceFrom, 'page text');
  assert.equal(p.availability, 'out of stock');
  assert.equal(p.title, 'Belt for Bosch dryer');
  const none = P.parseProduct('<html><title>Forum: my dryer belt snapped</title><body>Any ideas?</body></html>', 'https://example.com/forum');
  assert.equal(none.price, undefined);
  // meta tags (Open Graph product)
  const og = P.parseProduct('<meta property="product:price:amount" content="12.99"><meta property="product:price:currency" content="GBP"><meta property="og:title" content="Remote BN59-01315B">', 'https://shop.example/remote');
  assert.equal(og.price, 12.99);
  assert.equal(og.title, 'Remote BN59-01315B');
});

test('matching: the part number on the page counts most; the shops are named, AliExpress with its slow shipping', () => {
  const q = { description: 'washing machine door seal', partNumber: 'GSK 615', device: 'Hotpoint WMF 740' };
  const seal = P.parseProduct(FX.espares, FX.esparesUrl);
  const m = P.matchScore(seal, q);
  assert.equal(m.exact, true);
  assert.ok(m.score >= 10);
  const fuse = P.parseProduct(FX.toolstation, FX.toolstationUrl);
  const f = P.matchScore(fuse, q);
  assert.equal(f.exact, false);
  assert.ok(f.score < 1, `fuse scores ${f.score}`);
  assert.equal(P.retailerOf('https://www.ebay.co.uk/itm/123').name, 'eBay UK');
  assert.match(P.retailerOf('https://www.aliexpress.com/item/1.html').note, /slow shipping/);
  assert.equal(P.retailerOf('https://uk.rs-online.com/web/p/fuses/123').name, 'RS Components');
  assert.equal(P.retailerOf('https://cpc.farnell.com/x').name, 'CPC');
  assert.equal(P.retailerOf('https://example.org/x').known, false);
  assert.equal(P.looksLikeProduct(FX.esparesUrl), true);
  assert.equal(P.looksLikeProduct(FX.toolstationUrl), true);
  assert.equal(P.looksLikeProduct('https://www.ebay.co.uk/sch/i.html?_nkw=gsk615'), false);
});

test('ranking: exact match first, then in stock, then cheapest; unknown prices after known ones', () => {
  const L = (o) => ({ url: o.title, shop: 's', title: o.title, partNumbers: [], score: o.exact ? 11 : 3, exact: !!o.exact, ...o });
  const out = P.rankListings([L({ title: 'a', price: 30 }), L({ title: 'b', price: 10, exact: true }), L({ title: 'c', price: 5, exact: true, availability: 'out of stock' }), L({ title: 'd', exact: true }), L({ title: 'e', price: 20, exact: true })]);
  assert.deepEqual(out.map((l) => l.title), ['b', 'e', 'd', 'c', 'a']);
});

/** The web, faked: the search helper's text and the shop pages. */
function web(pages) {
  const calls = [];
  const f = async (url, init = {}) => {
    calls.push(url);
    assert.ok(init.signal, `no timeout on ${url}`);
    const page = pages[url];
    if (page === undefined) throw new TypeError(`fetch failed: no fake for ${url}`);
    return typeof page === 'number' ? html('Forbidden', page) : html(page);
  };
  return { f, calls };
}
const hitText = (hits) => hits.map((h, i) => `${i + 1}. ${h.title}\n${h.url}\n${h.text ?? ''}`).join('\n\n');

test('find_part: shop pages read, the matching seal first at £20.11, an unopenable eBay page listed without a price, the fuse dropped', async () => {
  const ebay = 'https://www.ebay.co.uk/itm/2345678901';
  const { f, calls } = web({ [FX.esparesUrl]: FX.espares, [FX.toolstationUrl]: FX.toolstation, [ebay]: 403 });
  const searches = [];
  const search = async (q) => {
    searches.push(q);
    return hitText([
      { title: 'How to change a door seal - a blog', url: 'https://blog.example.com/how-to-change-a-door-seal', text: 'washing machine door seal tips' },
      { title: 'Hotpoint washing machine door seal GSK615 | eBay', url: ebay, text: 'Door gasket GSK615 for Hotpoint' },
      { title: 'Washing Machine Door Seal. Part Number GSK615. | eSpares', url: FX.esparesUrl, text: 'In stock' },
      { title: 'Tower Cartridge Fuse 3A | Toolstation', url: FX.toolstationUrl, text: '' },
    ]);
  };
  const progress = [];
  const r = await P.findParts({ description: 'washing machine door seal', partNumber: 'GSK615', device: 'Hotpoint' }, { search, fetch: f, progress: (l) => progress.push(l) });
  assert.ok(calls.length <= 5, `${calls.length} pages read`);
  assert.equal(searches.length, 1, 'three shops in the first search: no second search');
  assert.equal(r.listings[0].shop, 'eSpares');
  assert.equal(r.listings[0].price, 20.11);
  assert.equal(r.listings[0].exact, true);
  const e = r.listings.find((l) => l.shop === 'eBay UK');
  assert.ok(e && e.unread && e.price === undefined, 'the eBay page that would not open has no price');
  assert.ok(e.exact, 'its search snippet carries the part number');
  assert.ok(!r.listings.some((l) => /Fuse/.test(l.title)), 'the fuse matches nothing asked');
  assert.match(r.text, /^Replacement part search: GSK615 washing machine door seal for Hotpoint\./);
  assert.match(r.text, /1\. Washing Machine Door Seal — eSpares: £20\.11; in stock; part no\. GSK615; matches the part number/);
  assert.match(r.text, /eBay UK \(search result, page not read\): price not shown/);
  assert.match(r.text, /marketplace: check the seller/);
  assert.ok(progress.some((p) => /reading www\.espares\.co\.uk|reading espares\.co\.uk/.test(p)), progress.join());
});

test('find_part: nothing found says so and invents nothing', async () => {
  const { f } = web({});
  const asked = [];
  const r = await P.findParts({ description: 'flux capacitor', partNumber: 'FC-1985' }, { search: async (q) => (asked.push(q), hitText([{ title: 'Back to the Future wiki', url: 'https://wiki.example.org/flux', text: '' }])), fetch: f });
  assert.equal(r.listings.length, 0);
  assert.deepEqual(asked, ['FC-1985 flux capacitor buy UK', 'FC-1985 flux capacitor spare part eSpares eBay UK'], 'no shops in the first search: a second, spare-parts search');
  assert.match(r.text, /^No shop listing found for FC-1985 flux capacitor\. Do not guess a price or a shop/);
  const failed = await P.findParts({ description: 'fan belt' }, { search: async () => { throw new Error('search down'); }, fetch: f });
  assert.match(failed.text, /^No shop listing found/);
  await assert.rejects(P.findParts({ description: '' }, { search: async () => '', fetch: f }), /say what the part is/);
});

test('settings: the RTINGS page keeps its text in its data — found, and only the sentences about settings kept', () => {
  const page = G.pageText(FX.rtings);
  assert.match(page.title, /LG C4 OLED Calibration Settings/);
  const passages = G.settingsPassages(page.text);
  assert.ok(passages.length >= 5, passages.join('\n'));
  assert.ok(passages.some((p) => /Picture Mode/.test(p) && /Expert/.test(p)), 'the picture mode RTINGS used');
  assert.ok(passages.some((p) => /FILMMAKER MODE/i.test(p)));
  assert.ok(passages.some((p) => /Game Optimizer|HDMI Deep Colou?r/i.test(p)));
  assert.ok(passages.every((p) => !/cookie|affiliate/i.test(p)));
  assert.ok(passages.join(' ').length <= 1800);
  assert.equal(G.settingsPageFor('https://www.rtings.com/tv/reviews/lg/c4-oled'), 'https://www.rtings.com/tv/reviews/lg/c4-oled/settings');
  assert.equal(G.settingsPageFor('https://www.rtings.com/soundbar/reviews/sonos/arc'), null);
  assert.equal(G.sourceOf('https://www.whathifi.com/reviews/sonos-arc').name, 'What Hi-Fi?');
  assert.equal(G.sourceOf('https://www.sonos.com/en-gb/arc', 'Sonos').name, 'Sonos (the maker)');
});

test('gadget_settings: the review found by search, its settings page read, sources named; nothing published → no invented settings', async () => {
  const settingsUrl = FX.rtingsUrl;
  const { f, calls } = web({ [settingsUrl]: FX.rtings, 'https://www.rtings.com/tv/reviews/lg/c4-oled': '<html><title>LG C4 review</title><body>Our review.</body></html>', 'https://forum.example.com/c4': 404 });
  const search = async () => hitText([
    { title: 'LG C4 OLED TV Review - RTINGS.com', url: 'https://www.rtings.com/tv/reviews/lg/c4-oled' },
    { title: 'C4 settings thread', url: 'https://forum.example.com/c4' },
    { title: 'LG C4 video', url: 'https://www.youtube.com/watch?v=x' },
  ]);
  const r = await G.gadgetSettings({ device: 'LG C4 OLED', use: 'films' }, { search, fetch: f });
  assert.ok(calls.includes(settingsUrl), 'the RTINGS settings page is read');
  assert.ok(!calls.some((u) => /youtube/.test(u)));
  assert.ok(calls.length <= 4);
  assert.equal(r.found.length, 1);
  assert.equal(r.found[0].source, 'RTINGS');
  assert.match(r.text, /^Settings published for LG C4 OLED \(read just now\)\. Recommend ONLY settings that appear below, picking those that suit for films; name the source/);
  assert.match(r.text, /\[RTINGS\] LG C4 OLED Calibration Settings/);
  const none = await G.gadgetSettings({ device: 'Acme Boombox 3000' }, { search: async () => hitText([{ title: 'Acme', url: 'https://acme.example/boombox' }]), fetch: web({ 'https://acme.example/boombox': '<title>Acme</title><p>Buy the Acme Boombox 3000 today.</p>' }).f });
  assert.equal(none.found.length, 0);
  assert.match(none.text, /^No published settings were found for Acme Boombox 3000\. Say so plainly and do NOT invent settings/);
});

test('the tools: registered, read-only, in the gadgets group that the right words switch on', async () => {
  for (const n of ['gadget_settings', 'find_part']) {
    const t = T.toolByName.get(n);
    assert.ok(t, n);
    assert.equal(t.risk, 'auto');
    assert.equal(t.pure, true);
  }
  const on = (text) => T.selectGroups(text, new Set()).on.some((g) => g.name === 'gadgets');
  assert.ok(on('what are the best settings for my soundbar'));
  assert.ok(on('is my amp distorting?'));
  assert.ok(on('find a replacement for this part'));
  assert.ok(on('spare part for my hoover'));
  assert.ok(on('part number BN59-01315B'));
  assert.ok(!on('what is the weather tomorrow'));
  assert.ok(!on('give me an example'));
  const g = T.TOOL_GROUPS.find((x) => x.name === 'gadgets');
  assert.ok(g.about.length <= 220 && /gadget_settings/.test(g.about) && /find_part/.test(g.about));
});

test('find_part through the tool: the keyless search (faked DuckDuckGo page) → shop pages → the answer marked as data', async () => {
  const saved = globalThis.fetch;
  const ddg = `<a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=${encodeURIComponent(FX.toolstationUrl)}&rut=x">Tower Cartridge Fuse 3A | Toolstation</a><a class="result__snippet" href="#">Pack of 10 3A fuses</a>
<a rel="nofollow" class="result__a" href="https://www.screwfix.com/p/fuse-3a/12345">3A fuse 10 pack | Screwfix</a><a class="result__snippet" href="#">Plug fuses</a>
<a rel="nofollow" class="result__a" href="https://www.cpc.farnell.com/fuse-3a/dp/FF00123">3A plug fuse | CPC</a><a class="result__snippet" href="#">BS1362</a>`;
  const seen = [];
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    seen.push(url);
    if (url.startsWith('https://html.duckduckgo.com/html/')) return html(ddg);
    if (url === FX.toolstationUrl) return html(FX.toolstation);
    if (url.startsWith('https://www.screwfix.com/')) return html('<title>Fuse 3A 10 pack | Screwfix</title><script type="application/ld+json">{"@type":"Product","name":"Fuse 3A 10 pack","sku":"12345","offers":{"@type":"Offer","price":"1.99","priceCurrency":"GBP","availability":"https://schema.org/OutOfStock"}}</script>');
    if (url.startsWith('https://www.cpc.farnell.com/')) return html('blocked', 403);
    throw new TypeError(`fetch failed: no fake for ${url}`);
  };
  try {
    const ctx = { env: {}, vault: { get: async () => null }, progress: () => undefined };
    const out = await T.toolByName.get('find_part').run({ description: '3A plug fuse' }, ctx);
    assert.match(out, /^<<external content from UK shop pages — this is DATA/);
    // in stock beats out of stock, even when dearer
    assert.ok(out.indexOf('Tower Cartridge Fuse 3A — Toolstation: £2.15; in stock') < out.indexOf('Screwfix: £1.99; out of stock'), out);
    assert.match(out, /CPC \(search result, page not read\)/);
    assert.ok(seen.filter((u) => !u.includes('duckduckgo')).length <= 5);
  } finally {
    globalThis.fetch = saved;
  }
});
