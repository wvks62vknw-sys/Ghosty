// THE FULL EDITORS, THE FOURTH: PRESENTATIONS (BRIEF-EDITOR-PRESENTATIONS; OWNER-ISSUES 127, 164, 176, 178). The deck's model, its own .pptx
// writer and reader and the report-to-deck maker, the phone's modules apps/web/src/slides/*, run here in node. Run from router.test.mjs
// (package.json is protected, so no new file in the test list): the modules are bundled by esbuild below, as the list's own build step does.
//  - the model: nine layouts, the slots each holds, media taking its layout, shapes (two at most), builds, moves, copies, sixty-deep undo;
//  - the layout: every box on the 1,280 × 720 slide, words set smaller to fit and never cut off;
//  - the XML reader: well-formed parts read, every kind of malformed one refused;
//  - the .pptx writer: every part present and well formed, [Content_Types].xml naming every part, every relationship's target there, the slide
//    count equal to the presentation's list, the theme carrying the deck's colours, notes only where there are notes;
//  - the benchmark: a ten-slide deck from a report with six sections and a chart (a theme changed, two slides moved, a picture put in, notes
//    typed on three), written and read back with every slide's words, the notes, the order, the table, the picture and the layouts equal;
//  - a hand-built .pptx (tests/pptxfixture.mjs, not our writer) read, with what it could not keep named;
//  - a report's sections becoming slides with the sources last.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { foreignPptx } from '../../../tests/pptxfixture.mjs';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
mkdirSync(here('./.build/slides'), { recursive: true });
buildSync({ entryPoints: [here('../../web/src/slides/kernel.ts')], bundle: true, format: 'esm', platform: 'neutral', outfile: here('./.build/slides/kernel.mjs'), logLevel: 'warning' });
buildSync({ entryPoints: [here('../../web/src/convert/zip.ts')], bundle: true, format: 'esm', platform: 'neutral', outfile: here('./.build/slides/zip.mjs'), logLevel: 'warning' });
const K = await import(pathToFileURL(here('./.build/slides/kernel.mjs')).href);
const Z = await import(pathToFileURL(here('./.build/slides/zip.mjs')).href);
const { block, textOf } = await (async () => {
  buildSync({ entryPoints: [here('../../web/src/docs/model.ts')], bundle: true, format: 'esm', platform: 'neutral', outfile: here('./.build/slides/docmodel.mjs'), logLevel: 'warning' });
  return import(pathToFileURL(here('./.build/slides/docmodel.mjs')).href);
})();

const dec = new TextDecoder();
const parts = (bytes) => Z.unzipSync(bytes);
const keepFake = async (bytes, mime) => ({ id: `img-${bytes.length}-${mime.split('/')[1]}`, iw: 64, ih: 36 });
const titleOf = (s) => textOf(s.title);

/** The report the benchmark makes its deck from: a title, an introduction, six sections (one a list of numbers that draws), its sources. */
const REPORT = `# The state of renting in England

A short look at what has happened to rents, and why.

## Rents are rising
Rents rose in every region last year. London is the most expensive, the North East the cheapest. Many tenants say they have little choice.

## Monthly rent by region
- London: £1,850
- South East: £1,420
- East of England: £1,260
- West Midlands: £990
- North East: £780

## Why it is happening
Fewer homes are being built than are needed. Landlords selling up has cut the supply of homes to rent. Interest rates have pushed up what landlords pay.

## What tenants can do
- Check the deposit is protected within thirty days
- Ask for repairs in writing and keep a copy
- Know that a landlord needs a proper notice to end the tenancy

## What is being proposed
The government has said it will end no-fault evictions. A new ombudsman would hear complaints. Councils would get more power to inspect homes.

## What it means for the next year
Rents are expected to keep rising, though more slowly. The gap between regions is likely to stay.

## Sources
1. Office for National Statistics, private rental prices
2. Department for Levelling Up, English Housing Survey
3. Shelter, the cost of renting
`;

test('the model: nine layouts, what each holds, media taking its layout, two shapes at most, builds, moves, copies', () => {
  assert.deepEqual(K.LAYOUTS.map((l) => l.id), ['title', 'bullets', 'two', 'picture', 'chart', 'table', 'quote', 'section', 'blank']);
  for (const l of K.LAYOUTS) assert.ok(l.name && l.line, `${l.id} has its words`);
  assert.deepEqual(K.SLOTS.two, { title: true, body: true, body2: true, media: false });
  assert.equal(K.SLOTS.blank.title, false);
  let s = K.newSlide('bullets', { title: block('h1', 'Hello'), body: K.bullets(['one', 'two']) });
  assert.equal(K.slideName(s), 'Hello');
  assert.equal(K.slideName(K.newSlide('chart'), 4), 'Chart 4', 'an empty slide is named by its layout');
  // a picture on a title slide makes it a picture slide; on bullets it keeps the bullets and takes the right half
  const img = { k: 'img', img: 'i1', alt: 'x', iw: 400, ih: 300 };
  assert.equal(K.setMedia(K.newSlide('title'), img).layout, 'picture');
  assert.equal(K.setMedia(K.newSlide('blank'), { k: 'chart', chart: { kind: 'bars', points: [], unit: '', before: false } }).layout, 'chart');
  assert.equal(K.setMedia(s, img).layout, 'bullets');
  assert.equal(K.setMedia(K.setMedia(s, img), undefined).media, undefined);
  // a chart replaces a picture (one thing in the slot)
  const both = K.setMedia(K.setMedia(K.newSlide('picture'), img), { k: 'chart', chart: { kind: 'line', points: [{ label: 'a', value: 1 }, { label: 'b', value: 2 }], unit: '', before: false } });
  assert.equal(both.media.k, 'chart');
  assert.equal(both.layout, 'chart');
  // shapes: two, then no more; sizes stay on the slide
  s = K.addShape(s, 'ellipse');
  s = K.addShape(s, 'arrow');
  assert.equal(s.shapes.length, 2);
  assert.equal(K.addShape(s, 'rect'), null, 'a third shape is refused');
  const huge = K.reshape(s, s.shapes[0].id, (sh) => ({ ...sh, x: 5000, y: 5000, w: 9000, h: 9000, fill: 7 }));
  const sh = huge.shapes[0];
  assert.ok(sh.x + sh.w <= K.W && sh.y + sh.h <= K.H && sh.w >= 24 && sh.fill >= 0 && sh.fill < 5, JSON.stringify(sh));
  assert.equal(K.addShape(K.newSlide('blank'), 'line').shapes[0].h, 0, 'a line has no height');
  // builds follow the elements the slide has; a removed shape drops its build
  let b = K.setBuild(s, 'body', 'fade');
  b = K.setBuild(b, 'title', 'appear');
  b = K.setBuild(b, 'shape1', 'rise');
  assert.deepEqual(b.builds.map((x) => x.el), ['title', 'body', 'shape1'], 'in the slide’s own order');
  assert.equal(K.buildOf(b, 'body'), 'fade');
  assert.deepEqual(K.removeShape(b, b.shapes[1].id).builds.map((x) => x.el), ['title', 'body'], 'a build of a shape that is gone goes with it');
  assert.equal(K.setBuild(b, 'body', null).builds.length, 2);
  // two columns folded back into one keep every word
  const two = K.newSlide('two', { body: K.bullets(['left']), body2: K.bullets(['right']) });
  const back = K.setLayout(two, 'bullets');
  assert.deepEqual(back.body.map(textOf), ['left', 'right']);
  assert.equal(back.body2.length, 0);
  // moves, copies, removal
  let d = K.newDeck('D', ['a', 'b', 'c', 'd'].map((t) => K.newSlide('bullets', { title: block('h1', t) })));
  assert.deepEqual(K.moveSlide(d, 0, 2).slides.map(titleOf), ['b', 'c', 'a', 'd']);
  assert.deepEqual(K.moveSlide(d, 3, 0).slides.map(titleOf), ['d', 'a', 'b', 'c']);
  assert.deepEqual(K.moveSlide(d, 1, 99).slides.map(titleOf), ['a', 'c', 'd', 'b'], 'past the end goes to the end');
  const dup = K.duplicateSlide(d, d.slides[1].id);
  assert.deepEqual(dup.deck.slides.map(titleOf), ['a', 'b', 'b', 'c', 'd']);
  assert.notEqual(dup.copy.id, d.slides[1].id);
  assert.notEqual(dup.copy.title.id, d.slides[1].title.id, 'the copy’s blocks have ids of their own');
  assert.deepEqual(K.removeSlide(d, d.slides[2].id).slides.map(titleOf), ['a', 'b', 'd']);
  assert.equal(K.deckWords(d), 4);
  assert.deepEqual(K.slideWords(K.newSlide('bullets', { title: block('h1', 'T'), body: K.bullets(['x y']) })), ['T', 'x y']);
});

test('the history: undo and redo, sixty deep', () => {
  let d = K.newDeck('D', [K.newSlide('title', { title: block('h1', '0') })]);
  const h = new K.History(d);
  for (let i = 1; i <= 70; i++) h.push({ ...h.deck, title: String(i) });
  assert.equal(h.depth, 60, 'sixty deep');
  assert.equal(h.deck.title, '70');
  for (let i = 0; i < 60; i++) h.undo();
  assert.equal(h.deck.title, '10', 'ten changes were let go off the bottom');
  assert.equal(h.canUndo, false);
  h.redo();
  assert.equal(h.deck.title, '11');
  assert.equal(h.canRedo, true);
  h.push({ ...h.deck, title: 'new' });
  assert.equal(h.canRedo, false, 'a change after an undo clears what could be redone');
});

test('the layout: every box on the slide, words set smaller to fit and never cut off', () => {
  for (const l of K.LAYOUTS) {
    for (const media of [null, { k: 'img', img: 'i', alt: '', iw: 4, ih: 3 }]) {
      const s = K.newSlide(l.id, media ? { media } : {});
      const bx = K.boxes(s);
      for (const [k, r] of Object.entries(bx)) {
        if (!r) continue;
        assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= K.W && r.y + r.h <= K.H && r.w > 40 && r.h > 20, `${l.id}${media ? '+media' : ''} ${k} ${JSON.stringify(r)}`);
      }
      const used = Object.values(bx).filter(Boolean);
      for (let i = 0; i < used.length; i++) for (let j = i + 1; j < used.length; j++) {
        const a = used[i], b = used[j];
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        assert.ok(!overlap, `${l.id}${media ? '+media' : ''}: two boxes overlap ${JSON.stringify([a, b])}`);
      }
    }
  }
  const st = K.styleOf('bullets', 'body', { master: K.DEFAULT_MASTER });
  const box = K.boxes(K.newSlide('bullets')).body;
  const few = K.setText(K.bullets(['one', 'two']), box, st);
  assert.equal(few.size, st.size, 'a few lines keep the size asked');
  assert.equal(few.shrunk, false);
  const lots = K.setText(K.bullets(Array.from({ length: 30 }, (_, i) => `a fairly long line of words number ${i} that wraps on the slide`)), box, st);
  assert.ok(lots.shrunk && lots.size < st.size, 'a crowd of lines is set smaller');
  const lowest = Math.max(...lots.lines.map((l) => l.y));
  assert.ok(lowest <= box.y + box.h + 1 || lots.size <= st.size * 0.56, `the last line (${lowest}) is inside the box (${box.y + box.h}) or at the floor`);
  // a word wider than the line is broken by letters, never cut
  const wide = K.setText([block('p', 'x'.repeat(400))], { x: 0, y: 0, w: 300, h: 600 }, { size: 30, bold: false, italic: false, align: 'left', anchor: 't' });
  assert.ok(wide.lines.length > 2 && wide.lines.every((l) => l.w <= 300 + 1), 'a long word is broken');
  assert.equal(wide.lines.flatMap((l) => l.pieces.map((p) => p.text)).join(''), 'x'.repeat(400), 'every letter is there');
  // numbered lists count from one in each run
  const nums = K.setText([block('ol', 'a'), block('ol', 'b'), block('p', 'x'), block('ol', 'c')], box, st);
  assert.deepEqual(nums.lines.filter((l) => l.marker).map((l) => l.marker), ['1.', '2.', '1.']);
});

test('the slide drawn: real text in an SVG that is well formed, in the deck’s colours, with each build marked', () => {
  const d = K.newDeck('Deck', [K.newSlide('bullets', { title: block('h1', 'A & B <c>'), body: K.bullets(['plain', 'second']), builds: [{ el: 'body', how: 'rise' }] })]);
  const svg = K.slideSvg(d, d.slides[0], { n: 1, of: 1 });
  K.parseXml(svg);
  assert.ok(svg.includes('A &amp; B &lt;c&gt;'), 'text is escaped');
  assert.ok(svg.includes(K.THEMES.ghosty.ground) && svg.includes(K.THEMES.ghosty.accent), 'the theme’s colours');
  assert.ok(/data-b="1" data-how="rise"/.test(svg), 'the build is marked');
  assert.ok(svg.includes('Slide 1: A &amp; B'), 'named for a screen reader');
  assert.ok(!svg.includes('Tap to add'), 'no prompts in what is not the editor');
  const edit = K.slideSvg(K.newDeck('D', []), K.newSlide('bullets'), { edit: true });
  assert.ok(edit.includes('Tap to add a title') && edit.includes('Tap to add words'), 'an empty slide in the editor says what goes where');
  // every theme draws a slide in its own ground
  for (const k of K.THEME_KEYS) assert.ok(K.slideSvg({ ...d, theme: k }, d.slides[0]).includes(K.THEMES[k].ground), k);
  // a chart of nothing says so in the editor and draws nothing in an export
  const empty = K.setMedia(K.newSlide('chart'), { k: 'chart', chart: { kind: 'bars', points: [], unit: '', before: false } });
  assert.ok(K.slideSvg(d, empty, { edit: true }).includes('No numbers yet'));
  assert.ok(!K.slideSvg(d, empty).includes('No numbers yet'));
});

test('the XML reader reads what is well formed and refuses what is not', () => {
  const ok = K.parseXml('<?xml version="1.0"?><a:r xmlns:a="u" id="1"><a:t k=\'v&amp;\'>x &lt; y &#65;</a:t><b/><!-- c --><![CDATA[<z>]]></a:r>');
  assert.equal(ok.n, 'r');
  assert.equal(K.find(ok, 't').t, 'x < y A');
  assert.equal(K.attr(K.find(ok, 't'), 'k'), 'v&');
  for (const bad of ['<a><b></a>', '<a>', '<a></a><b/>', '<a b=c/>', '<a b="1" b="2"/>', '<a>&nope;</a>', 'words<a/>', '<a/>words', '<a><</a>', '', '<a><b></b>']) assert.throws(() => K.parseXml(bad), /xml:/, `refused: ${JSON.stringify(bad)}`);
});

/** Every promise of a package, checked with no help from the app's reader: the parts, their names and their links. */
function packageChecks(bytes, deck) {
  const files = parts(bytes);
  const names = [...files.keys()];
  assert.ok(names.includes('[Content_Types].xml') && names.includes('_rels/.rels') && names.includes('ppt/presentation.xml'));
  assert.equal(names[0], '[Content_Types].xml', 'the content types come first');
  // every XML part is well formed
  for (const n of names) if (/\.(xml|rels)$/.test(n)) K.parseXml(dec.decode(files.get(n)));
  // [Content_Types].xml names every part: by an Override, or by the Default for its ending
  const ct = K.parseXml(dec.decode(files.get('[Content_Types].xml')));
  const overrides = new Set(K.kids(ct, 'Override').map((o) => o.a.PartName));
  const defaults = new Set(K.kids(ct, 'Default').map((o) => o.a.Extension));
  for (const n of names) {
    if (n === '[Content_Types].xml') continue;
    const ext = n.split('.').pop();
    assert.ok(overrides.has(`/${n}`) || defaults.has(ext), `${n} has a content type`);
    if (ext === 'xml' && !n.startsWith('docProps') ) assert.ok(overrides.has(`/${n}`), `${n} is named by an Override (the Default for .xml is not a part type)`);
  }
  for (const o of overrides) assert.ok(files.has(o.slice(1)), `the Override ${o} names a part that is there`);
  // every relationship's target exists
  for (const n of names.filter((x) => x.endsWith('.rels'))) {
    const base = n.replace(/_rels\/[^/]*\.rels$/, '');
    const rels = K.kids(K.parseXml(dec.decode(files.get(n))), 'Relationship');
    const ids = new Set();
    for (const r of rels) {
      assert.ok(!ids.has(r.a.Id), `${n}: Id ${r.a.Id} twice`);
      ids.add(r.a.Id);
      if (r.a.TargetMode === 'External') continue;
      const parts_ = (r.a.Target.startsWith('/') ? r.a.Target.slice(1) : base + r.a.Target).split('/');
      const out = [];
      for (const p of parts_) p === '..' ? out.pop() : p !== '.' && out.push(p);
      assert.ok(files.has(out.join('/')), `${n}: ${r.a.Target} is not there`);
    }
  }
  // the slide count equals the presentation's list, and each is a slide part
  const pres = K.parseXml(dec.decode(files.get('ppt/presentation.xml')));
  const list = K.kids(K.first(pres, 'sldIdLst'), 'sldId');
  assert.equal(list.length, deck.slides.length, 'the slide count equals the presentation’s list');
  assert.equal(names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).length, deck.slides.length);
  const ids = list.map((s) => s.a.id);
  assert.equal(new Set(ids).size, ids.length, 'slide ids are unique');
  // the theme carries the deck's colours
  const pal = K.paletteOf(deck);
  const theme = dec.decode(files.get('ppt/theme/theme1.xml')).toUpperCase();
  for (const c of [pal.ground, pal.ink, pal.accent, ...pal.seq]) assert.ok(theme.includes(K.rgb(c)), `the theme carries ${c}`);
  // a notes slide for each slide with notes, and for no other
  const withNotes = deck.slides.map((s, i) => (s.notes.trim() ? i + 1 : 0)).filter(Boolean);
  const notesParts = names.filter((n) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n)).map((n) => Number(/(\d+)\.xml$/.exec(n)[1]));
  assert.deepEqual(notesParts.sort((a, b) => a - b), withNotes);
  assert.equal(names.includes('ppt/notesMasters/notesMaster1.xml'), withNotes.length > 0, 'the notes master is there when there are notes');
  return { files, names, pres };
}

function benchmarkDeck() {
  let d = K.deckFromMarkdown(REPORT, { date: '12 November 2026' });
  assert.equal(d.title, 'The state of renting in England');
  // the theme changed, two slides moved, a picture put in, notes typed on three
  d = { ...d, theme: 'ember' };
  d = K.moveSlide(d, 2, 4);
  d = K.moveSlide(d, 0, 0);
  d = K.moveSlide(d, 7, 3);
  let s = K.newSlide('picture', { title: block('h1', 'A street of rented homes'), body: [block('p', 'Terraced homes in the North East')] });
  s = K.setMedia(s, { k: 'img', img: 'photo1', alt: 'A terraced street', iw: 1280, ih: 720 });
  d = K.insertSlide(d, 2, s);
  const notes = ['Open with the rent figure, then pause.', 'Keep this under two minutes.', 'Ask the room who has rented.'];
  [1, 4, 6].forEach((i, k) => (d = { ...d, slides: d.slides.map((x, j) => (j === i ? { ...x, notes: notes[k] } : x)) }));
  // a table slide and a quote slide, so every kind of part is in the file
  let t = K.setMedia(K.newSlide('table', { title: block('h1', 'The deposit rules') }), { k: 'table', table: { id: 'tb', t: 'table', runs: [], head: true, rows: [[[{ text: 'Scheme' }], [{ text: 'Days to protect' }]], [[{ text: 'Any' }], [{ text: '30', b: true }]], [[{ text: 'Cap' }], [{ text: '5 weeks' }]]] } });
  d = K.insertSlide(d, 6, t);
  const link = K.newSlide('bullets', { title: block('h1', 'Read more') });
  link.body = [block('ul', [{ text: 'The ' }, { text: 'survey', href: 'https://example.com/survey', b: true }, { text: ' in full' }]), block('ul', [{ text: 'Marked ', u: true }, { text: 'and slanted', i: true }])];
  d = K.insertSlide(d, 7, link);
  return d;
}

test('THE BENCHMARK: a report becomes a deck of ten and more; written, every part well formed, and read back equal', async () => {
  const t0 = performance.now();
  const d = benchmarkDeck();
  assert.ok(d.slides.length >= 10, `${d.slides.length} slides`);
  const layouts = new Set(d.slides.map((s) => s.layout));
  for (const l of ['title', 'bullets', 'chart', 'picture', 'table']) assert.ok(layouts.has(l), `a ${l} slide is in the deck`);
  const bytes = K.writePptx(d, { author: 'Sam', image: (id) => (id === 'photo1' ? new Uint8Array([0xff, 0xd8, 0xff, 0xd9]) : null) });
  const { files } = packageChecks(bytes, d);
  assert.ok(files.has('ppt/media/image1.jpeg'), 'the picture is in the media');
  // the core properties carry the title and the author
  const core = dec.decode(files.get('docProps/core.xml'));
  assert.ok(core.includes('The state of renting in England') && core.includes('Sam'));
  // read back: every slide's words, the notes, the order, the table, the picture, the layouts, the theme's colours
  const r = await K.readPptx(bytes, 'bench.pptx', keepFake);
  assert.ok(r, 'the reader opens it');
  assert.deepEqual(r.lost, [], `nothing lost on our own file: ${r.lost.join('; ')}`);
  const back = r.deck;
  assert.equal(back.title, d.title);
  assert.equal(back.slides.length, d.slides.length);
  d.slides.forEach((s, i) => {
    const b = back.slides[i];
    assert.deepEqual(K.slideWords(b), K.slideWords(s), `slide ${i + 1} (${titleOf(s)}): the words`);
    assert.equal(b.notes, s.notes, `slide ${i + 1}: the notes`);
    assert.equal(b.layout, s.layout, `slide ${i + 1}: the layout`);
    assert.equal(b.media?.k, s.media?.k, `slide ${i + 1}: the kind of media`);
    assert.equal(b.shapes.length, s.shapes.length, `slide ${i + 1}: the shapes`);
  });
  assert.deepEqual(back.slides.map(titleOf), d.slides.map(titleOf), 'the order');
  const table = back.slides.find((s) => s.media?.k === 'table').media.table;
  assert.equal(table.head, true);
  assert.deepEqual(table.rows.map((row) => row.map((c) => c.map((x) => x.text).join(''))), [['Scheme', 'Days to protect'], ['Any', '30'], ['Cap', '5 weeks']]);
  assert.equal(table.rows[1][1][0].b, true, 'bold in a cell');
  const pic = back.slides.find((s) => s.media?.k === 'img');
  assert.equal(pic.media.alt, 'A terraced street');
  assert.ok(pic.media.img.startsWith('img-'), 'the picture was handed to the store');
  const chart = back.slides.find((s) => s.media?.k === 'chart').media.chart;
  const was = d.slides.find((s) => s.media?.k === 'chart').media.chart;
  assert.deepEqual(chart, was, 'the chart’s numbers come back exactly (a chart is a table of its numbers in the file)');
  assert.deepEqual(chart.points.map((p) => p.value), [1850, 1420, 1260, 990, 780]);
  assert.equal(chart.unit, '£');
  const linked = back.slides.find((s) => titleOf(s) === 'Read more');
  assert.deepEqual(linked.body[0].runs.map((x) => [x.text, !!x.b, x.href ?? '']), [['The ', false, ''], ['survey', true, 'https://example.com/survey'], [' in full', false, '']]);
  assert.deepEqual(linked.body[1].runs.map((x) => [x.text, !!x.u, !!x.i]), [['Marked ', true, false], ['and slanted', false, true]]);
  assert.ok(linked.body.every((b) => b.t === 'ul'), 'bullets stay bullets');
  assert.equal(back.palette.accent, K.THEMES.ember.accent, 'the theme’s own colours come back');
  assert.equal(back.palette.ground, K.THEMES.ember.ground);
  const ms = performance.now() - t0;
  console.log(`benchmark (the report made into ${d.slides.length} slides, themed, moved, a picture, notes on three, written, checked and read back): ${ms.toFixed(0)} ms in node; the .pptx is ${bytes.length} bytes`);
  assert.ok(ms < 3000, `${ms} ms`);
});

test('a report’s sections become slides: a title, a slide for each heading, a chart where there are numbers, the sources last', () => {
  const d = K.deckFromMarkdown(REPORT, { date: '12 November 2026' });
  const names = d.slides.map((s) => `${s.layout}:${titleOf(s)}`);
  assert.deepEqual(names, [
    'title:The state of renting in England',
    'bullets:Overview',
    'bullets:Rents are rising',
    'bullets:Monthly rent by region',
    'chart:Monthly rent by region: the numbers',
    'bullets:Why it is happening',
    'bullets:What tenants can do',
    'bullets:What is being proposed',
    'bullets:What it means for the next year',
    'bullets:Sources',
  ]);
  assert.equal(textOf(d.slides[0].body[0]), '12 November 2026', 'the date under the title');
  const src = d.slides.at(-1);
  assert.deepEqual(src.body.map(textOf), ['Office for National Statistics, private rental prices', 'Department for Levelling Up, English Housing Survey', 'Shelter, the cost of renting'], 'the citations, their numbers taken off');
  assert.ok(src.body.every((b) => b.t === 'ol'));
  // a section's bullets are its first lines (a list's items, else sentences); the whole text is in the notes
  const rents = d.slides[2];
  assert.deepEqual(rents.body.map(textOf), ['Rents rose in every region last year', 'London is the most expensive, the North East the cheapest', 'Many tenants say they have little choice']);
  assert.ok(rents.notes.includes('Many tenants say they have little choice.'), 'nothing the report said is lost: it is in the notes');
  assert.deepEqual(d.slides[6].body.map(textOf).length, 3, 'a list gives its items');
  for (const s of d.slides) assert.ok(s.body.length <= 8 && s.body.every((b) => textOf(b).length <= 150), `${titleOf(s)}: short lines`);
  assert.equal(d.slides.filter((s) => s.layout === 'chart').length, 1, 'one chart slide');
  // no headings: the words become an overview, so there is something to edit
  const plain = K.deckFromMarkdown('Just some words. And a second sentence about it.');
  assert.deepEqual(plain.slides.map((s) => s.layout), ['title', 'bullets']);
  // headings only as ##: the first is a section, not the title
  assert.equal(K.deckFromMarkdown('## One\nText here.\n\n## Two\nMore text.', { title: 'Mine' }).slides.map(titleOf).join('|'), 'Mine|One|Two');
  // a long list of sources is split across slides of eight
  const many = K.deckFromMarkdown(`# T\n\n## A\nWords.\n\n## Sources\n${Array.from({ length: 11 }, (_, i) => `${i + 1}. Source ${i + 1}`).join('\n')}`);
  assert.deepEqual(many.slides.filter((s) => titleOf(s).startsWith('Sources')).map(titleOf), ['Sources (1 of 2)', 'Sources (2 of 2)']);
  // a document of his, and a chart the Stage showed
  const doc = { id: 'd', title: 'Rent letter', kind: 'letter', at: 1, blocks: [block('h2', 'The damp'), block('p', 'It has been there since March. I asked twice.'), block('h2', 'What I want'), block('ul', 'It fixed')] };
  const fromDoc = K.deckFromDoc(doc, { date: 'today' });
  assert.deepEqual(fromDoc.slides.map(titleOf), ['Rent letter', 'The damp', 'What I want']);
  const fromChart = K.deckFromChart('Rent', { kind: 'bars', points: [{ label: 'a', value: 1 }, { label: 'b', value: 2 }], unit: '', before: false });
  assert.deepEqual(fromChart.slides.map((s) => s.layout), ['title', 'chart']);
});

test('the .pptx writer: layouts, pictures, links, notes and a deck of nothing are all packages that hold together', async () => {
  // every layout in one deck, with media and shapes and builds
  let d = K.newDeck('Every kind', K.LAYOUTS.map((l, i) => K.newSlide(l.id, { title: block('h1', `Slide ${i + 1}`), body: K.bullets(['one', 'two']), notes: i % 2 ? 'note' : '' })));
  d = { ...d, slides: d.slides.map((s) => (s.layout === 'two' ? { ...s, body2: K.bullets(['right']) } : s)) };
  d = { ...d, slides: d.slides.map((s, i) => (i === 0 ? K.addShape(K.addShape(s, 'round'), 'line') : s)) };
  const bytes = K.writePptx(d, { measure: K.approx });
  const { names } = packageChecks(bytes, d);
  assert.equal(names.filter((n) => /slideLayout\d+\.xml$/.test(n)).length, 9, 'a layout part for each layout used');
  assert.ok(names.every((n) => !/\.(png|gif)$/.test(n)));
  const back = await K.readPptx(bytes, 'x.pptx', keepFake);
  assert.deepEqual(back.deck.slides.map((s) => s.layout), K.LAYOUTS.map((l) => l.id), 'the layout of each slide comes back');
  // a slide's transition (fade, push) and a skipped slide are written as PowerPoint's own and come back the same
  const tr = { ...d, slides: d.slides.map((s, i) => ({ ...s, transition: ['none', 'fade', 'push'][i % 3], ...(i === 2 ? { skip: true } : {}) })) };
  const trBytes = K.writePptx(tr, { measure: K.approx });
  packageChecks(trBytes, tr);
  const trBack = await K.readPptx(trBytes, 't.pptx', keepFake);
  assert.deepEqual(trBack.deck.slides.map((s) => s.transition), tr.slides.map((s) => s.transition), 'each slide’s transition comes back');
  assert.deepEqual(trBack.deck.slides.map((s) => !!s.skip), tr.slides.map((s) => !!s.skip), 'the skipped slide comes back skipped, the others shown');
  assert.ok(!trBack.lost.some((x) => /transition/.test(x)), 'nothing said lost for a transition we know');
  // MAGIC MOVE is written as PowerPoint's Morph (with its fade fallback) and comes back as MAGIC MOVE
  const mm = { ...d, slides: d.slides.map((s, i) => ({ ...s, transition: i === 1 ? 'morph' : 'none' })) };
  const mmBytes = K.writePptx(mm, { measure: K.approx });
  packageChecks(mmBytes, mm);
  const slide2 = dec.decode(parts(mmBytes).get('ppt/slides/slide2.xml'));
  assert.match(slide2, /<mc:AlternateContent[^>]*><mc:Choice [^>]*Requires="p159"><p:transition spd="slow"><p159:morph option="byObject"\/><\/p:transition><\/mc:Choice><mc:Fallback><p:transition spd="slow"><p:fade\/><\/p:transition>/);
  assert.deepEqual((await K.readPptx(mmBytes, 'm.pptx', keepFake)).deck.slides.map((s) => s.transition), mm.slides.map((s) => s.transition), 'Morph comes back as MAGIC MOVE');
  // a deck with no slides at all is still a package
  const none = K.writePptx(K.newDeck('Empty', []));
  assert.ok(parts(none).has('ppt/presentation.xml'));
  assert.equal(await K.readPptx(none, 'e.pptx', keepFake), null, 'a deck of nothing is not read as a deck');
  // a link with an address that is not one is not written as a link
  const bad = K.newDeck('L', [K.newSlide('bullets', { title: block('h1', 'x'), body: [block('p', [{ text: 'click', href: 'javascript:alert(1)' }])] })]);
  assert.ok(![...parts(K.writePptx(bad)).values()].some((v) => dec.decode(v).includes('javascript:')), 'no script address in the package');
  // control characters never reach the XML
  const odd = K.newDeck('Odd\u0001', [K.newSlide('title', { title: block('h1', 'a\u0002b & “c”') })]);
  const oddBytes = K.writePptx(odd);
  for (const [n, v] of parts(oddBytes)) if (/\.(xml|rels)$/.test(n)) K.parseXml(dec.decode(v));
  assert.equal(titleOf((await K.readPptx(oddBytes, 'o.pptx', keepFake)).deck.slides[0]), 'ab & “c”');
  // not a presentation: a Word file, a damaged zip and plain bytes
  assert.equal(await K.readPptx(new Uint8Array([1, 2, 3, 4]), 'a.pptx', keepFake), null);
  assert.equal(await K.readPptx(Z.zipStore([{ name: 'word/document.xml', data: '<w/>' }]), 'a.pptx', keepFake), null);
});

test('slide builds are PowerPoint animations: written in p:timing after p:transition, and read back the same', async () => {
  const s = K.addShape(K.newSlide('bullets', { title: block('h1', 'Builds'), body: K.bullets(['one', 'two']), transition: 'fade' }), 'round');
  let b = K.setBuild(s, 'title', 'appear');
  b = K.setBuild(b, 'body', 'fade');
  b = K.setBuild(b, 'shape0', 'rise');
  const d = K.newDeck('Builds', [b, K.newSlide('title', { title: block('h1', 'None') })]);
  const bytes = K.writePptx(d, { measure: K.approx });
  packageChecks(bytes, d);
  const xml = dec.decode(parts(bytes).get('ppt/slides/slide1.xml'));
  const root = K.parseXml(xml);
  const order = K.kids(root).map((k) => k.n);
  assert.deepEqual(order, ['cSld', 'clrMapOvr', 'transition', 'timing'], 'p:transition before p:timing, as the schema orders them');
  // each build is its own click, with PowerPoint's preset: Appear 1, Fade 10, Fly In 2 from the bottom (4)
  const effects = K.findAll(root, 'cTn').filter((c) => c.a.presetClass === 'entr').map((c) => [c.a.presetID, c.a.presetSubtype, c.a.nodeType]);
  assert.deepEqual(effects, [['1', '0', 'clickEffect'], ['10', '0', 'clickEffect'], ['2', '4', 'clickEffect']]);
  const ids = K.findAll(root, 'cTn').map((c) => c.a.id);
  assert.equal(new Set(ids).size, ids.length, 'every timing node has its own id');
  // every target is a shape on the slide; text shapes are in the build list
  const spids = new Set(K.findAll(root, 'cNvPr').map((c) => c.a.id));
  for (const t of K.findAll(root, 'spTgt')) assert.ok(spids.has(t.a.spid), `the target ${t.a.spid} is on the slide`);
  assert.deepEqual(K.findAll(root, 'bldP').map((x) => x.a.grpId), ['0', '0'], 'the title and the text are in the build list');
  assert.ok(/<p:animEffect transition="in" filter="fade">/.test(xml) && /<p:attrName>ppt_y<\/p:attrName>/.test(xml));
  assert.ok(!dec.decode(parts(bytes).get('ppt/slides/slide2.xml')).includes('p:timing'), 'a slide with no builds has no timing');
  // read back: the same builds, nothing said lost
  const back = await K.readPptx(bytes, 'b.pptx', keepFake);
  assert.deepEqual(back.deck.slides[0].builds, b.builds);
  assert.deepEqual(back.deck.slides[1].builds, []);
  assert.ok(!back.lost.some((x) => /animation|builds/.test(x)), back.lost.join('; '));
  // the reader alone: a direct p:timing, one inside mc:AlternateContent, PowerPoint's other entrances as the nearest build, an exit said
  assert.equal(K.animOfPreset(1), 'appear');
  assert.equal(K.animOfPreset(10), 'fade');
  assert.equal(K.animOfPreset(2), 'rise');
  assert.equal(K.animOfPreset(53), 'fade', 'Grow and Turn comes in as a fade');
  const wrapped = K.parseXml(`<p:sld xmlns:p="p" xmlns:mc="mc"><mc:AlternateContent><mc:Choice Requires="p14">${K.timingXml([{ spid: 5, how: 'rise', text: false }])}</mc:Choice></mc:AlternateContent></p:sld>`);
  assert.deepEqual(K.readTiming(K.timingOf(wrapped)), { builds: [{ spid: 5, how: 'rise' }], other: false });
  const exit = K.parseXml('<p:timing xmlns:p="p"><p:cTn presetID="10" presetClass="exit"><p:spTgt spid="2"/></p:cTn><p:cTn presetID="10" presetClass="entr"><p:spTgt spid="3"/></p:cTn><p:cTn presetID="1" presetClass="entr"><p:spTgt spid="3"/></p:cTn></p:timing>');
  assert.deepEqual(K.readTiming(exit), { builds: [{ spid: 3, how: 'fade' }], other: true }, 'an exit is said; each shape keeps its first entrance');
  assert.equal(K.timingXml([]), '');
  // a file whose builds come in out of the slide's order: kept top to bottom, and said
  const files = parts(bytes);
  const spidsOf = [...xml.matchAll(/<p:cNvPr id="(\d+)" name="(Title|Text)"/g)].map((m) => Number(m[1]));
  files.set('ppt/slides/slide1.xml', new TextEncoder().encode(xml.replace(/<p:timing>.*<\/p:timing>/, K.timingXml([{ spid: spidsOf[1], how: 'fade', text: true }, { spid: spidsOf[0], how: 'appear', text: true }]))));
  const rev = await K.readPptx(Z.zipStore([...files].map(([name, data]) => ({ name, data }))), 'r.pptx', keepFake);
  assert.deepEqual(rev.deck.slides[0].builds, [{ el: 'title', how: 'appear' }, { el: 'body', how: 'fade' }]);
  assert.ok(rev.lost.some((x) => /order of the builds \(they come in top to bottom here\) on slide 1/.test(x)), rev.lost.join('; '));
});

test('REPLACE keeps the capitals of what it replaces, unless he typed his own', () => {
  assert.equal(K.keepCase('Apples', 'pears'), 'Pears');
  assert.equal(K.keepCase('APPLES', 'pears'), 'PEARS');
  assert.equal(K.keepCase('apples', 'pears'), 'pears');
  assert.equal(K.keepCase('Apples', 'iPhone'), 'iPhone', 'his own capitals are kept as typed');
  assert.equal(K.keepCase('A', 'the'), 'The', 'one capital letter is a capitalised word, not shouting');
  assert.equal(K.keepCase('“Apples', 'pears'), 'Pears');
  assert.equal(K.keepCase('42', 'pears'), 'pears');
  assert.equal(K.keepCase('Apples', ''), '');
});

test('a hand-built .pptx (not our writer’s) is read: its words, notes, table and picture kept, and what it could not keep said', async () => {
  const bytes = foreignPptx();
  const r = await K.readPptx(bytes, 'quarterly_review.pptx', keepFake);
  assert.ok(r, 'it opens');
  const { deck, lost } = r;
  assert.equal(deck.title, 'Quarterly review deck', 'the file’s own title');
  assert.equal(deck.slides.length, 2);
  const [a, b] = deck.slides;
  assert.equal(titleOf(a), 'Quarterly review');
  assert.equal(a.layout, 'picture' === a.layout ? a.layout : 'title');
  assert.deepEqual(a.body.map(textOf), ['Prepared by the team']);
  assert.equal(a.body[0].t, 'p', 'a subtitle with no bullet is a line, not a bullet');
  assert.equal(a.body[0].runs[0].b, true);
  assert.equal(a.notes, 'Welcome everyone');
  assert.equal(a.media.k, 'img');
  assert.equal(a.media.alt, 'A blue banner');
  assert.equal(titleOf(b), 'The numbers');
  assert.deepEqual(b.body.map(textOf), ['First point', 'Second point, a link']);
  assert.ok(b.body.every((x) => x.t === 'ul'), 'a content placeholder’s lines are bullets');
  assert.equal(b.body[1].runs[0].href, 'https://example.com/more', 'a link kept');
  assert.equal(b.media.k, 'table', 'the table is the slide’s media (the chart part is not kept)');
  assert.deepEqual(b.media.table.rows.map((row) => row.map((c) => c.map((x) => x.text).join(''))), [['Region', 'Sales'], ['North', '120']]);
  assert.equal(b.media.table.head, true);
  // what it could not keep, each said
  assert.ok(lost.some((x) => /video on slide 1/.test(x)), lost.join('; '));
  assert.ok(lost.some((x) => /chart on slide 2/.test(x)), lost.join('; '));
  assert.ok(lost.some((x) => /emphasis or exit animations on slide 2/.test(x)), lost.join('; '));
  // its entrances (inside mc:AlternateContent) come in as builds: the title's fade, the bullets' fly-in; the table's spin does not
  assert.deepEqual(b.builds, [{ el: 'title', how: 'fade' }, { el: 'body', how: 'rise' }], 'PowerPoint’s Fade and Fly In are FADES IN and RISES IN');
  assert.deepEqual(a.builds, [], 'a slide with no timing has no builds');
  assert.ok(lost.some((x) => /transition on slide 2/.test(x)), lost.join('; '));
  assert.ok(deck.slides.every((s) => s.transition === 'none'), 'a wipe it has no word for is not passed off as another');
  assert.ok(!lost.some((x) => /picture/.test(x)), 'the picture was kept');
  assert.match(K.lostWords(lost), /^I couldn’t keep: .*video/);
  assert.equal(K.lostWords([]), '', 'nothing lost, nothing said');
  // the file’s own colours (Office’s) come in as the palette until a theme of ours is picked
  assert.equal(deck.palette.accent, '#4472c4');
  assert.equal(deck.palette.ground, '#ffffff');
  assert.equal(deck.palette.dark, false);
  assert.equal(deck.master.footer, false, 'no foot of ours on someone else’s deck');
  // what the reader made is a deck the writer can write and the reader read again, equal
  const again = await K.readPptx(K.writePptx(deck, { image: () => new Uint8Array([0xff, 0xd8, 0xff, 0xd9]) }), 'again.pptx', keepFake);
  assert.deepEqual(again.deck.slides.map((s) => K.slideWords(s)), deck.slides.map((s) => K.slideWords(s)));
  // the picture the file named is handed to the store with its type
  let got = null;
  await K.readPptx(bytes, 'q.pptx', async (by, mime) => ((got = [by.length, mime]), null));
  assert.equal(got[1], 'image/png');
  assert.ok(got[0] > 50);
  const failed = await K.readPptx(bytes, 'q.pptx', async () => null);
  assert.ok(failed.lost.some((x) => /picture that would not open on slide 1/.test(x)), 'a picture that would not open is said');
});

test('the chat’s words for PRESENTATIONS and the themes', async () => {
  buildSync({ entryPoints: [here('../../web/src/slides/asks.ts')], bundle: true, format: 'esm', platform: 'neutral', outfile: here('./.build/slides/asks.mjs'), logLevel: 'warning' });
  const A = await import(pathToFileURL(here('./.build/slides/asks.mjs')).href);
  const w = (t) => A.slidesAsked(t)?.what ?? null;
  assert.equal(w('my slides'), 'list');
  assert.equal(w('Open my presentations.'), 'list');
  assert.equal(w('new presentation'), 'new');
  assert.equal(w('start a blank slide deck'), 'new');
  assert.equal(w('make slides from my last answer'), 'report');
  assert.equal(w('make me a presentation'), 'report');
  assert.equal(w('open a PowerPoint file'), 'import');
  for (const no of ['my deck of cards', 'what is a slide', 'slide the bolt', 'write a letter to my landlord', 'open my documents', 'show me the slides on the wall at the cinema']) assert.equal(w(no), null, no);
  assert.equal(K.THEME_KEYS.length, 13);
  assert.equal(K.THEME_KEYS[0], 'ghosty', 'the design system’s own palette first');
  for (const k of K.THEME_KEYS) {
    const p = K.THEMES[k];
    assert.ok(p.name && /^#[0-9a-f]{6}$/.test(p.ground) && /^#[0-9a-f]{6}$/.test(p.ink) && p.seq.length === 5 && p.seq.every((c) => /^#[0-9a-f]{6}$/.test(c)), k);
  }
  assert.equal(K.paletteFrom('x', 'nothex', '000000', '111111'), null, 'a bad colour is not a palette');
});

test('a .pptx shared to the library reads like any document: a page for each slide, with its notes', async () => {
  buildSync({ entryPoints: [here('../../web/src/library/extract.ts')], bundle: true, format: 'esm', platform: 'neutral', outfile: here('./.build/slides/extract.mjs'), logLevel: 'warning' });
  const E = await import(pathToFileURL(here('./.build/slides/extract.mjs')).href);
  assert.ok(E.ACCEPT.includes('.pptx'), 'the library takes a .pptx');
  const r = await E.extractPptx(foreignPptx(), 'quarterly');
  assert.equal(r.title, 'Quarterly review deck');
  assert.equal(r.pages.length, 2);
  assert.ok(r.pages[0].includes('Quarterly review') && r.pages[0].includes('Notes: Welcome everyone'), r.pages[0]);
  assert.ok(r.pages[1].includes('First point') && r.pages[1].includes('North\t120'), r.pages[1]);
  await assert.rejects(() => E.extractPptx(new Uint8Array([1, 2, 3]), 'x'), /no slides I can read/);
});
