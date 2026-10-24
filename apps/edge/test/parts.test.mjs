// Gadgets and parts (integrations/parts.ts, integrations/gadgets.ts, tools/gadgets.ts): a real
// eSpares door-seal page and a real Toolstation fuse page (fetched with curl on 2026-10-17, kept
// in test/parts.fixture.json without their unrelated scripts) read for title, price, stock and part
// number; matching and ranking; the whole find_part errand with the web faked — shop pages first,
// a page that will not open listed without a price (never a guessed one), pages that match nothing
// dropped, nothing found said plainly; best settings from a real RTINGS settings page (its text
// sits in the page's data), the "nothing published" answer; the tools and their keyword group.
// GADGET MANUALS (integrations/manuals.ts, built here with esbuild's API): the source chosen (the maker's
// own PDF first, a forbidden site skipped with its reason, any other site not used, robots.txt obeyed),
// the manual read and kept on the GADGETS shelf with its record, a fault code answered from the manual's
// own page, the web said to be the web when the manual is silent, and part links with no shop favoured.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { sqlStorage } from '../../../tests/sqlite-storage.mjs';

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
  // the part number as a whole word: a longer number, or letters and digits run together across words, are not it
  const pnq = (partNumber) => ({ description: 'part', partNumber });
  assert.equal(P.matchScore({ title: 'Pump C00119230 for Indesit', partNumbers: [] }, pnq('C0011923')).exact, false);
  assert.equal(P.matchScore({ title: 'Fuses', partNumbers: [], snippet: 'pack of 10 x 13 A fuses' }, pnq('X13A')).exact, false);
  assert.equal(P.matchScore({ title: 'Pump C00119230 for Indesit', partNumbers: [] }, pnq('C00119230')).exact, true);
  assert.equal(P.matchScore({ title: 'Remote control', partNumbers: [], snippet: 'Fits BN59-01315B (bn59 01315b)' }, pnq('BN5901315B')).exact, true, 'a dash inside the number is fine');
  assert.equal(P.matchScore({ title: 'Belt', partNumbers: [], snippet: 'Whirlpool 4812 310 18294' }, pnq('481231018294')).exact, true, 'spaces between digit groups are fine');
  assert.equal(P.matchScore({ title: 'Belt', partNumbers: ['AG-420'] }, pnq('AG420')).exact, true, 'a part number the page states');
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

// ---- GADGET MANUALS ----------------------------------------------------------------------------------------------

const at = (p) => new URL(p, import.meta.url).pathname;
// (only the files that exist: on code without manuals.ts the manual tests then fail one by one, not the whole file)
await build({ entryPoints: [at('../src/integrations/manuals.ts'), at('../src/library/store.ts')].filter((f) => existsSync(f)), bundle: true, format: 'esm', platform: 'neutral', external: ['cloudflare:sockets'], outdir: at('./.build/manuals'), outbase: at('../src'), outExtension: { '.js': '.mjs' }, logLevel: 'warning' }).catch(() => undefined);
const M = await import('./.build/manuals/integrations/manuals.mjs').catch(() => ({}));
const L = await import('./.build/manuals/library/store.mjs');

class MemStorage {
  m = new Map();
  sql = sqlStorage();
  async get(k) { return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { this.m.set(k, structuredClone(v)); }
  async delete(k) { return this.m.delete(k); }
  async list({ prefix = '' } = {}) { return new Map([...this.m].filter(([k]) => k.startsWith(prefix))); }
}

/** A PDF with these pages of text (Helvetica), as a maker's manual's stand-in. */
function makePdf(pages) {
  const esc = (t) => t.replace(/[\\()]/g, (c) => `\\${c}`);
  const n = pages.length;
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${n} >>`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];
  pages.forEach((lines, i) => {
    const content = `BT /F1 11 Tf 50 800 Td ${lines.map((l, j) => `${j ? '0 -16 Td ' : ''}(${esc(l)}) Tj`).join(' ')} ET`;
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  let out = '%PDF-1.4\n';
  const offs = [];
  objs.forEach((o, i) => {
    offs.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}
/** Bosch's SMS24AW01G manual, 12 pages: the fault codes on page 12. */
const MANUAL_PAGES = Array.from({ length: 12 }, (_, i) =>
  i === 0 ? ['Bosch Dishwasher SMS24AW01G', 'User manual', 'Read this manual before using the appliance.', 'Keep it for later use and pass it on to the next owner.']
  : i === 11 ? ['Troubleshooting: fault codes', 'E24 The waste water cannot drain away.', '1. Switch off the appliance and unplug it.', '2. Clean the filters and the waste water pump.', '3. Check that the drain hose is not kinked or blocked.', 'E15 Water protection system has responded. Contact customer service.']
  : [`Page ${i + 1}: loading the dishwasher, programmes and care.`, 'Use dishwasher salt and rinse aid. Clean the filters regularly so water can drain.', 'Programme Eco 50 is the most efficient for normally soiled dishes.']);
const BOSCH_PDF = 'https://media3.bosch-home.com/Documents/specsheet/en-GB/SMS24AW01G.pdf';
const ddgPage = (results) => `<html><body>${results.map(([url, title]) => `<div class="result"><a class="result__a" href="${url}">${title}</a><a class="result__snippet">${title} manual</a></div>`).join('')}</body></html>`;
const searchFor = (results) => async () => results.map(([url, title], i) => `${i + 1}. ${title}\n${url}\n${title} manual`).join('\n\n');
const fetchOf = (routes, seen) => async (input) => {
  const url = typeof input === 'string' ? input : input.url;
  seen.push(url);
  for (const [prefix, res] of routes) if (url.startsWith(prefix)) return typeof res === 'function' ? res() : res;
  return new Response('not found', { status: 404 });
};
const pdfResponse = () => new Response(makePdf(MANUAL_PAGES), { headers: { 'content-type': 'application/pdf' } });

test("the manual finder's source choice: the maker's own PDF first, a forbidden archive skipped with its reason, any other site not used", () => {
  const d = M.parseDevice('find the manual for my bosch dishwasher SMS24AW01G');
  assert.deepEqual(d, { make: 'Bosch', maker: 'bosch', model: 'SMS24AW01G', kind: 'dishwasher' });
  // a rating plate read in Lens READ: the variant after the slash is not part of the model searched
  assert.equal(M.parseDevice('BOSCH  E-Nr. SMS24AW01G/29  FD 9907  Type S9KT1B').model, 'SMS24AW01G');
  const hits = [
    { url: 'https://www.manualslib.com/manual/1234/Bosch-Sms24aw01g.html', title: 'Bosch SMS24AW01G manual - ManualsLib' },
    { url: 'https://some-appliance-blog.example/bosch-manual.pdf', title: 'Bosch manual mirror' },
    { url: 'https://archive.org/details/bosch-sms24', title: 'Bosch dishwasher manual : Internet Archive' },
    { url: 'https://www.bosch-home.co.uk/productslist/SMS24AW01G', title: 'SMS24AW01G | Bosch' },
    { url: BOSCH_PDF, title: 'Instructions for use SMS24AW01G' },
  ];
  const { picks, skipped } = M.pickManual(hits, d);
  assert.deepEqual(picks.map((p) => [p.url, p.source.from]), [[BOSCH_PDF, 'maker'], ['https://www.bosch-home.co.uk/productslist/SMS24AW01G', 'maker'], ['https://archive.org/details/bosch-sms24', 'archive']]);
  assert.match(picks[0].source.licence, /© Bosch.*kept privately for the owner's own use/);
  assert.deepEqual(skipped.map((s) => s.url), [hits[0].url, hits[1].url]);
  assert.match(skipped[0].why, /ManualsLib's robots\.txt shuts robots out of its downloads/);
  assert.match(skipped[1].why, /neither Bosch's own site nor an archive known to allow it/);
  // robots.txt: Bosch's own UK site keeps robots out of /manual/; content signals saying no to AI input forbid it too
  const boschRobots = 'User-agent: *\nDisallow: /*orderCode*\nDisallow: /manual/\nDisallow: /*/manual/\n';
  assert.equal(M.robotsAllows(boschRobots, '/manual/SMS24AW01G.pdf'), false);
  assert.equal(M.robotsAllows(boschRobots, '/productslist/SMS24AW01G'), true);
  assert.equal(M.robotsAllows('User-agent: *\nDisallow: /files/\nAllow: /files/manuals/\n', '/files/manuals/a.pdf'), true);
  assert.equal(M.robotsAllows('User-agent: Googlebot\nDisallow: /\n', '/a.pdf'), true, "another robot's rules are not ours");
  assert.equal(M.robotsAllows('Content-Signal: search=yes, ai-input=no\nUser-agent: *\nAllow: /\n', '/a.pdf'), false);
  assert.equal(M.robotsAllows('', '/a.pdf'), true);
});

test('FIND THE MANUAL: the PDF is read and kept on the GADGETS shelf with the gadget\'s record (model, source, licence, pages); the forbidden site is never fetched', async () => {
  const storage = new MemStorage();
  const lib = new L.Library(storage, {});
  const seen = [];
  const deps = {
    storage, library: lib,
    search: searchFor([['https://www.manualslib.com/manual/1234/Bosch-Sms24aw01g.html', 'Bosch SMS24AW01G - ManualsLib'], [BOSCH_PDF, 'Instructions for use SMS24AW01G']]),
    fetch: fetchOf([['https://media3.bosch-home.com/robots.txt', () => new Response('')], [BOSCH_PDF, pdfResponse]], seen),
    now: () => 1_800_000_000_000,
  };
  const r = await M.findManual(deps, 'Bosch dishwasher SMS24AW01G');
  assert.ok(r.record, r.text);
  assert.match(r.text, /^Found the manual for the Bosch dishwasher SMS24AW01G from Bosch's own site \(media3\.bosch-home\.com\) and kept it in the library on the GADGETS shelf: "Bosch dishwasher SMS24AW01G — manual", 12 pages\./);
  assert.match(r.text, /Licence: © Bosch/);
  assert.match(r.text, /Not used: manualslib\.com \(ManualsLib's robots\.txt/);
  assert.ok(!seen.some((u) => u.includes('manualslib')), seen.join());
  const kept = await storage.get(M.GADGETS_KEY);
  assert.equal(kept.length, 1);
  assert.deepEqual({ ...kept[0], doc: '…' }, { id: 'sms24aw01g', name: 'Bosch dishwasher SMS24AW01G', make: 'Bosch', model: 'SMS24AW01G', kind: 'dishwasher', doc: '…', url: BOSCH_PDF, host: 'media3.bosch-home.com', from: 'maker', source: "from Bosch's own site (media3.bosch-home.com)", licence: "© Bosch: the maker's own manual, free on its site; kept privately for the owner's own use, never shared or published", pages: 12, modelSeen: true, at: 1_800_000_000_000 });
  const doc = lib.doc(kept[0].doc);
  assert.equal(doc.kind, 'manual');
  assert.equal(doc.title, 'Bosch dishwasher SMS24AW01G — manual');
  assert.match(doc.source, /^https:\/\/media3\.bosch-home\.com\/.* · © Bosch/);
  const passages = lib.passagesOf(doc.id).passages;
  assert.equal(passages.find((p) => /E24 The waste water/.test(p.text))?.page, 12, 'each passage keeps its page');
  // asked again: already on the shelf, nothing fetched
  const before = seen.length;
  assert.match((await M.findManual(deps, 'bosch SMS24AW01G')).text, /already on the GADGETS shelf/);
  assert.equal(seen.length, before);
});

test('only forbidden or unknown sites, or a host whose robots.txt says no: nothing is fetched from them and nothing is kept, said plainly', async () => {
  const storage = new MemStorage();
  const seen = [];
  const deps = {
    storage, library: new L.Library(storage, {}),
    search: searchFor([['https://www.manualslib.com/download/1234/Bosch.html', 'ManualsLib'], ['https://www.manualzz.com/doc/1/bosch', 'Manualzz'], [BOSCH_PDF, 'Bosch PDF']]),
    fetch: fetchOf([['https://media3.bosch-home.com/robots.txt', () => new Response('User-agent: *\nDisallow: /Documents/\n')], [BOSCH_PDF, pdfResponse]], seen),
  };
  const r = await M.findManual(deps, 'Bosch dishwasher SMS24AW01G');
  assert.equal(r.record, undefined);
  assert.match(r.text, /^I could not find a manual for the Bosch dishwasher SMS24AW01G that I may use/);
  assert.match(r.text, /media3\.bosch-home\.com \(media3\.bosch-home\.com's robots\.txt does not allow robots to read it\)/);
  assert.match(r.text, /Manualzz's robots\.txt/);
  assert.ok(!seen.some((u) => u === BOSCH_PDF || /manualslib|manualzz/.test(u)), seen.join());
  assert.equal(await storage.get(M.GADGETS_KEY), undefined);
  // no model number: asked for, not guessed
  assert.match((await M.findManual(deps, 'my bosch dishwasher')).text, /^I need the model number/);
});

test('"my dishwasher shows E24" is answered from the manual\'s own page 12 with its steps; a code the manual does not have is "from the web, not the manual"; part links favour no shop and carry no affiliate tag', async () => {
  const storage = new MemStorage();
  const lib = new L.Library(storage, {});
  const queries = [];
  const deps = {
    storage, library: lib,
    search: async (q) => {
      queries.push(q);
      if (/manual pdf/.test(q)) return `1. Instructions for use\n${BOSCH_PDF}\nBosch`;
      if (/E99/.test(q)) return '1. Bosch dishwasher E99 error explained\nhttps://www.fixit-forum.example/bosch-e99?utm_source=x&ref=abc\nA forum thread';
      return '1. Bosch drain pump 00620774 - eSpares\nhttps://www.espares.co.uk/product/bosch-drain-pump?tag=ghosty-21&utm_medium=aff&id=1\nDrain pump\n\n2. Drain pump for Bosch dishwashers | Amazon.co.uk\nhttps://www.amazon.co.uk/dp/B000123/ref=sr_1_1?tag=someone-21&keywords=x\nPump';
    },
    fetch: fetchOf([['https://media3.bosch-home.com/robots.txt', () => new Response('')], [BOSCH_PDF, pdfResponse]], []),
  };
  await M.findManual(deps, 'Bosch dishwasher SMS24AW01G');
  assert.deepEqual(M.faultCodes('my dishwasher shows E24'), ['E24']);
  assert.deepEqual(M.faultCodes('it says E:15 and error 24'), ['E15', '24']);
  const e24 = await M.askManual(deps, 'my dishwasher shows E24');
  assert.equal(e24.from, 'manual');
  assert.deepEqual(e24.pages, [12]);
  assert.match(e24.text, /^From the manual, page 12 \(Bosch dishwasher SMS24AW01G, from Bosch's own site/);
  assert.match(e24.text, /1\. Switch off the appliance and unplug it\.[\s\S]*2\. Clean the filters and the waste water pump\.[\s\S]*3\. Check that the drain hose/);
  const searched = queries.length;
  // a code the manual does not have: a web search, said to be the web
  const e99 = await M.askManual(deps, 'my dishwasher shows E99');
  assert.equal(e99.from, 'web');
  assert.match(e99.text, /^The manual for the Bosch dishwasher SMS24AW01G does not mention E99 \(all 12 pages looked through\)\. From the web, not the manual/);
  assert.equal(queries.length, searched + 1);
  assert.match(queries.at(-1), /^Bosch SMS24AW01G E99 dishwasher error code$/);
  assert.match(e99.text, /https:\/\/www\.fixit-forum\.example\/bosch-e99\n/, 'tracking parameters taken off');
  // replacement parts: the exact part name, plain links in the search's order, no affiliate tags, never a purchase
  const parts = await M.partLinks(deps, { part: 'drain pump' });
  assert.match(queries.at(-1), /^"drain pump" Bosch SMS24AW01G replacement part$/);
  assert.deepEqual(parts.links, ['https://www.espares.co.uk/product/bosch-drain-pump?id=1', 'https://www.amazon.co.uk/dp/B000123']);
  assert.match(parts.text, /No shop is favoured, no link carries an affiliate tag, and Ghosty never buys anything/);
  assert.doesNotMatch(parts.text, /tag=|utm_|ref=/);
  // nothing kept yet: says how to start
  assert.match((await M.askManual({ ...deps, storage: new MemStorage() }, 'my oven shows F2')).text, /^No manual is kept yet/);
});

test('gadget_manual is a gadgets tool (find, ask, parts), read-and-file only, with no purchase in it', () => {
  const g = T.TOOL_GROUPS.find((x) => x.name === 'gadgets');
  const t = g.tools.find((x) => x.name === 'gadget_manual');
  assert.ok(t, 'gadget_manual is in the gadgets group');
  assert.deepEqual(t.parameters.properties.action.enum, ['find', 'ask', 'parts']);
  assert.match(t.description, /never buy/);
  assert.ok(t.description.length <= 240, `${t.description.length} characters`);
});
