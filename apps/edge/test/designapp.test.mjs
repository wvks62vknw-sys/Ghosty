// DESIGN (THE APPS ROUND, lane SITES): the model the phone's canvas draws from (packages/shared/src/design/model.ts). Templates
// fit every size, magic resize keeps every part on the page in proportion, snapping finds the page's centre and other parts' edges,
// alignment and order, text wrapping, a design read back from storage drops anything malformed, the SVG carries the words and the
// credits, the print PDF has its bleed outside the TrimBox, and the page for his sites is a picture with its words as the alt text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

await build({ entryPoints: ['../../packages/shared/src/design/model.ts'], bundle: true, format: 'esm', platform: 'neutral', outfile: 'test/.build/designapp/model.mjs', logLevel: 'warning' });
const M = await import('./.build/designapp/model.mjs');
// a stand-in measure: every character is half the size wide
const measure = (text, l) => text.length * (l.size ?? 40) * 0.5;

test('every template at every size: inside the page, text sized from the page, in his brand', () => {
  const brand = M.readBrand({ colours: ['#ff3366', '#101010', '#ffffff'], head: 'serif', body: 'round' });
  assert.ok(M.TEMPLATES.length >= 10);
  assert.ok(M.OCCASIONS.includes('Birthday') && M.OCCASIONS.includes('Menu') && M.OCCASIONS.includes('Social'));
  for (const t of M.TEMPLATES) for (const s of M.SIZES) {
    const d = M.fromTemplate(t, s.id, brand);
    assert.equal(d.w, s.w);
    assert.equal(d.h, s.h);
    for (const l of d.layers) {
      assert.ok(l.x + l.w > 0 && l.x < d.w && l.y + l.h > 0 && l.y < d.h, `${t.id} at ${s.id}: ${l.name} is on the page`);
      if (l.kind === 'text') assert.ok(l.size >= 8 && l.size <= Math.min(d.w, d.h), `${t.id} at ${s.id}: ${l.name} is a sensible size`);
    }
  }
  const party = M.fromTemplate(M.TEMPLATES.find((t) => t.id === 'party'), 'invitation', brand);
  assert.equal(party.layers.find((l) => l.name === 'Title').font, 'serif', 'his heading face');
  assert.equal(party.layers.find((l) => l.name === 'When').font, 'round', 'his body face');
  assert.ok(party.layers.some((l) => l.fill === '#ff3366'), 'his main colour');
  assert.deepEqual(M.readBrand({ colours: ['red', '#abc'], head: 'comic' }), M.DEFAULT_BRAND, 'a broken brand kit falls back whole');
});

test('magic resize: the same parts at another size, each on the page and in proportion; a full-page part fills the new page', () => {
  const d = M.fromTemplate(M.TEMPLATES.find((t) => t.id === 'sale'), 'post');
  d.layers.unshift({ id: 'bg', kind: 'rect', name: 'Ground', x: 0, y: 0, w: d.w, h: d.h, rot: 0, fill: '#000000', opacity: 1 });
  for (const s of M.SIZES) {
    const r = M.magicResize(d, s.id);
    assert.equal(r.layers.length, d.layers.length);
    assert.notEqual(r.id, d.id, 'a copy: the first one is kept');
    assert.deepEqual([r.w, r.h], [s.w, s.h]);
    const bg = r.layers.find((l) => l.id === 'bg');
    assert.deepEqual([bg.x, bg.y, bg.w, bg.h], [0, 0, s.w, s.h], `${s.id}: the ground fills the page`);
    for (const l of r.layers) assert.ok(l.x + l.w > 0 && l.x < r.w && l.y + l.h > 0 && l.y < r.h, `${s.id}: ${l.name} stays on the page`);
    const before = d.layers.find((l) => l.name === 'Title');
    const after = r.layers.find((l) => l.name === 'Title');
    const cx = (after.x + after.w / 2) / r.w;
    assert.ok(Math.abs(cx - (before.x + before.w / 2) / d.w) < 0.02, `${s.id}: the title keeps its place across the page`);
  }
});

test('snapping, alignment and order', () => {
  const d = M.fromTemplate(M.TEMPLATES.find((t) => t.id === 'blank'), 'post');
  d.layers.push({ id: 'a', kind: 'rect', name: 'A', x: 100, y: 100, w: 200, h: 100, rot: 0, fill: '#000000', opacity: 1 }, { id: 'b', kind: 'rect', name: 'B', x: 700, y: 600, w: 100, h: 100, rot: 0, fill: '#000000', opacity: 1 });
  // near the page's centre: it snaps there, with a guide
  const c = M.snapBox(d, 'b', { x: 488, y: 600, w: 100, h: 100 }, 10);
  assert.equal(c.x, 490);
  assert.deepEqual(c.guides.find((g) => g.axis === 'x'), { axis: 'x', at: 540 });
  // near another part's edge
  const e = M.snapBox(d, 'b', { x: 296, y: 207, w: 100, h: 100 }, 10);
  assert.equal(e.x, 300, 'its left edge on A\'s right edge');
  assert.equal(e.y, 200, 'its top on A\'s bottom');
  // far from everything: it stays where the finger is
  const f = M.snapBox(d, 'b', { x: 620, y: 820, w: 100, h: 100 }, 10);
  assert.deepEqual([f.x, f.y, f.guides.length], [620, 820, 0]);
  const centred = M.alignLayers(d, ['a'], 'center');
  assert.equal(centred.layers.find((l) => l.id === 'a').x, 440);
  const both = M.alignLayers(d, ['a', 'b'], 'top');
  assert.deepEqual(both.layers.filter((l) => ['a', 'b'].includes(l.id)).map((l) => l.y), [100, 100]);
  const locked = M.alignLayers({ ...d, layers: d.layers.map((l) => (l.id === 'a' ? { ...l, locked: true } : l)) }, ['a'], 'right');
  assert.equal(locked.layers.find((l) => l.id === 'a').x, 100, 'a locked part never moves');
  assert.deepEqual(M.reorder(d, 'a', 'up').layers.map((l) => l.id), ['b', 'a']);
  assert.deepEqual(M.reorder(d, 'b', 'bottom').layers.map((l) => l.id), ['b', 'a']);
});

test('text: his line breaks kept, each line wrapped to the part\'s width, capitals when asked', () => {
  const l = { id: 't', kind: 'text', name: 'T', x: 0, y: 0, w: 140, h: 100, rot: 0, fill: '#000000', opacity: 1, size: 20, text: 'one two three four five\nsix' };
  assert.deepEqual(M.wrapText(l, measure), ['one two three', 'four five', 'six']);
  assert.deepEqual(M.wrapText({ ...l, text: 'Hi there', upper: true }, measure), ['HI THERE']);
});

test('a design read back from the phone: malformed parts dropped, a picture only as a data image', () => {
  assert.equal(M.readDesign(null), null);
  assert.equal(M.readDesign({ v: 2, id: 'x', layers: [] }), null);
  const d = M.readDesign({ v: 1, id: 'd1', name: 'Mine', size: 'nope', w: 'x', bg: 3, layers: [{ kind: 'script', id: 'z' }, { kind: 'image', id: 'i', src: 'https://tracker.example/x.png', x: 1, y: 2, w: 3, h: 4 }, { kind: 'text', id: 't', text: 'Hi', opacity: 7 }] });
  assert.equal(d.size, 'post');
  assert.equal(d.w, 1080);
  assert.equal(d.bg, '#ffffff');
  assert.deepEqual(d.layers.map((l) => l.kind), ['image', 'text']);
  assert.equal(d.layers[0].src, undefined, 'a picture from the network is never drawn');
  assert.equal(d.layers[1].opacity, 1);
});

test('exports: SVG with its words and credits; a print PDF with 3 mm bleed; the page for his sites', () => {
  const d = M.fromTemplate(M.TEMPLATES.find((t) => t.id === 'event'), 'a4');
  d.layers.push({ id: 'p', kind: 'image', name: 'Photo', x: 0, y: 0, w: 10, h: 10, rot: 0, fill: 'transparent', opacity: 1, src: 'data:image/png;base64,AAAA', credit: 'Photo by A. Person, CC BY 4.0, via Wikimedia Commons' });
  d.layers.push({ id: 'h', kind: 'text', name: 'Hidden', x: 0, y: 0, w: 10, h: 10, rot: 0, fill: '#ffffff', opacity: 1, text: '<script>x</script>', hidden: true });
  const svg = M.toSvg(d, measure);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 2480 3508"/);
  assert.match(svg, />Northern<\/tspan>/);
  assert.match(svg, /<desc>Pictures: Photo by A\. Person, CC BY 4\.0, via Wikimedia Commons<\/desc>/, 'public pictures keep their credit');
  assert.doesNotMatch(svg, /<script/, 'a hidden part is not exported, and words are text');
  // the PDF: A4 plus 3 mm on every side, the TrimBox the finished A4
  const trim = M.printSize(d);
  assert.ok(Math.abs(trim.w - 595.28) < 0.1 && Math.abs(trim.h - 841.89) < 0.1, 'A4 in points');
  const bleed = M.BLEED_MM * M.PT_PER_MM;
  const jpeg = new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);
  const pdf = Buffer.from(M.pdfOf(jpeg, 100, 141, trim, bleed, 'Club night'));
  const text = pdf.toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4'));
  assert.match(text, /\/MediaBox \[0 0 612\.28 858\.90\]/);
  assert.match(text, /\/TrimBox \[8\.50 8\.50 603\.78 850\.39\]/);
  assert.match(text, /\/Width 100 \/Height 141 .*\/Filter \/DCTDecode \/Length 7/);
  const xref = Number(/startxref\n(\d+)/.exec(text)[1]);
  assert.equal(text.slice(xref, xref + 4), 'xref', 'the cross-reference table is where the trailer says');
  for (const [, off, n] of [...text.matchAll(/(\d{10}) 00000 n /g)].map((m, i) => [m, Number(m[1]), i + 1])) assert.equal(text.slice(off, off + `${n} 0 obj`.length), `${n} 0 obj`, `object ${n} is where the table says`);
  assert.match(text, /\/Title \(Club night\)/);
  // a screen size prints at 96 px to the inch
  assert.deepEqual(M.printSize(M.fromTemplate(M.TEMPLATES[0], 'post')), { w: 810, h: 810 });
  // the page for his sites
  const page = M.sitePageOf(d, 'data:image/jpeg;base64,AAAA', M.wordsOf(d));
  assert.match(page, /<img src="data:image\/jpeg;base64,AAAA" width="2480" height="3508" alt="FRIDAY 12 DECEMBER\. Northern Soul Night\./);
  assert.match(page, /<p>Pictures: Photo by A\. Person/);
  assert.doesNotMatch(page, /<script/);
  assert.equal(M.contrastOf('#ffffff', '#000000').toFixed(0), '21');
  assert.equal(M.inkOn('#ffd24d'), '#111111');
  assert.equal(M.inkOn('#0b1220'), '#ffffff');
});
