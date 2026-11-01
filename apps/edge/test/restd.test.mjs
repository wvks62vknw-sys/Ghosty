// BRIEF-REST-D (batch ⑧ part D): DESIGN AND SHOW A BUILD — the kits (a 3 × 2 shed's frame, cladding, roof pitch and cut
// list; a garden room's insulation; a shelf's load line), the bill's totals and its CSV, the PC check (a socket mismatch
// refused, a power shortfall said), the concept-only rule for a car or a robot, the price table's date and his words —
// and THE HOME ASSISTANT BRIDGE: the allowlist and the guarded set, a job refused on a guarded call, the vault's address
// and token never in a response, the service calls' shaping, his words matched to his things and "which one?".
// The phone's modules and the bridge are bundled here with esbuild (as resta.test.mjs does); the house is the stand-in
// box of tests/fixtures/house-api.mjs; nothing here asks a model or the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { HOUSE_TOKEN, HOUSE_URL, houseApi, houseCalls, resetHouse } from '../../../tests/fixtures/house-api.mjs';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: {
    kits: at('../../web/src/build/kits.ts'),
    words: at('../../web/src/build/words.ts'),
    bom: at('../../web/src/build/bom.ts'),
    prices: at('../../web/src/build/prices.ts'),
    pc: at('../../web/src/build/pc.ts'),
    concept: at('../../web/src/build/concept.ts'),
    phrases: at('../../web/src/assistant/phrases.ts'),
    restd: at('../../../packages/shared/src/catalogue/restd.ts'),
    house: at('../../../packages/shared/src/house.ts'),
    bridge: at('../src/house.ts'),
    why: at('../src/why.ts'),
    speak: at('../src/speak.ts'),
  },
  bundle: true,
  external: ['cloudflare:sockets'],
  format: 'esm',
  platform: 'neutral',
  outdir: at('./.build/restd'),
  outExtension: { '.js': '.mjs' },
  logLevel: 'error',
});
const K = await import('./.build/restd/kits.mjs');
const W = await import('./.build/restd/words.mjs');
const B = await import('./.build/restd/bom.mjs');
const P = await import('./.build/restd/prices.mjs');
const PC = await import('./.build/restd/pc.mjs');
const C = await import('./.build/restd/concept.mjs');
const { LOCAL_ASKS } = await import('./.build/restd/phrases.mjs');
const R = await import('./.build/restd/restd.mjs');
const H = await import('./.build/restd/house.mjs');
const BR = await import('./.build/restd/bridge.mjs');
const WHY = await import('./.build/restd/why.mjs');

const shed = () => K.design(K.paramsFor('shed', { w: 3, d: 2 }));
const line = (d, group, price) => d.lines.find((l) => l.group === group && l.price === price);

// ---------------------------------------------------------------- the shed

test('a 3 × 2 shed: studs at 600 centres (27 with the door and window), the frame cut from stock lengths', () => {
  const d = shed();
  assert.equal(d.kind, 'shed');
  const frame = line(d, 'frame', 't47x75');
  assert.match(frame.note, /^27 studs at 600 mm centres/);
  // every bar is a length timber is sold in, and the waste is the bought less the used
  for (const b of frame.cut.bars) assert.ok(P.STOCK.includes(b.len), `a ${b.len} m bar`);
  assert.equal(Math.round((frame.cut.bought - frame.cut.used) * 1000) / 1000, frame.cut.waste);
  assert.equal(frame.qty, frame.cut.bought);
  assert.equal(frame.total, Math.round(frame.cut.bought * P.PRICES.t47x75.gbp * 100) / 100);
  // a stud never longer than the front wall's 2.1 m, never shorter than a cripple's 5 cm
  const studs = frame.cut.bars.flatMap((b) => b.pieces);
  assert.ok(studs.every((s) => s > 0.05 && s <= 4.8));
});

test('a 3 × 2 shed: 17.8 m² of cladding, a pent roof at 8.5° on six 2.22 m rafters', () => {
  const d = shed();
  const clad = line(d, 'cladding', 'shiplap');
  assert.match(clad.note, /^17\.8 m² of wall/);
  const rafters = line(d, 'roof', 't47x100');
  assert.match(rafters.note, /^6 rafters at 600 mm centres, a pent roof at 8\.5°/);
  assert.ok(rafters.cut.bars.flatMap((b) => b.pieces).filter((p) => p === 2.22).length === 6, 'six rafters of 2.22 m: √(2.2² + 0.3²)');
  // the pitch is the rise over the run: 0.3 m over 2 m
  assert.equal(Math.round((Math.atan2(0.3, 2) * 180) / Math.PI * 10) / 10, 8.5);
  assert.ok(d.views.some((v) => /pent roof 8\.5°/.test(v.items.filter((i) => i.t === 'text').map((i) => i.text).join(' '))), 'the drawing says the pitch');
  // an apex roof: 25°, two sets of rafters and a ridge
  const apex = K.design(K.paramsFor('shed', { w: 3, d: 2, roof: 'apex' }));
  assert.match(line(apex, 'roof', 't47x100').note, /^12 rafters .* a 25° apex/);
  // the base it needs is in the bill, and said
  assert.ok(line(d, 'base', 'slab600').n === 6 * 4, '6 × 4 slabs under 3.1 × 2.1 m');
  assert.ok(d.notes.some((n) => /base is needed/.test(n)));
  // the law lines: rules of thumb with the official words
  assert.ok(d.law.some((l) => /maximum eaves height of 2\.5 metres/.test(l.words) && /gov\.uk/.test(l.source) && /check with your council/i.test(l.words)));
});

test('the cut list rounds up to 2.4, 3.0, 3.6 and 4.8 m and says the waste', () => {
  const c = P.cutList([{ len: 2.0, n: 3 }]);
  assert.equal(c.bought, 7.2);
  assert.equal(c.used, 6);
  assert.equal(c.waste, 1.2);
  assert.equal(c.wastePct, 16.7);
  assert.match(P.cutWords(c), /1\.20 m waste \(17%\)/);
  // a short piece takes the shortest bar; a long one the next up; one longer than 4.8 m is joined
  assert.deepEqual(P.cutList([{ len: 1.0, n: 1 }]).stock, [{ len: 2.4, n: 1 }]);
  assert.deepEqual(P.cutList([{ len: 3.3, n: 1 }]).stock, [{ len: 3.6, n: 1 }]);
  assert.equal(P.cutList([{ len: 5.2, n: 1 }]).joined, 1);
  // the saw's cut is allowed for: two 1.2 m pieces do not fit one 2.4 m bar
  assert.equal(P.cutList([{ len: 1.2, n: 2 }]).bars[0].len, 3.0);
});

// ---------------------------------------------------------------- the garden room, the room, the garage

test('a 4 × 3 garden room: 10 boards of 75 mm PIR in the walls, 6 of 100 mm on the roof, 5 of 50 mm in the floor', () => {
  const d = K.design(K.paramsFor('gardenroom', { desk: true }));
  assert.equal(line(d, 'insulation', 'pir75').n, 10);
  assert.match(line(d, 'insulation', 'pir75').note, /^25\.2 m² of wall/);
  assert.equal(line(d, 'insulation', 'pir100').n, 6);
  assert.equal(line(d, 'insulation', 'pir50').n, 5);
  assert.ok(line(d, 'electrics', 'electrician'), 'the electrics are one line for a registered electrician');
  assert.ok(d.law.some((l) => /Part P/.test(l.title)) && d.law.some((l) => /incidental/.test(l.words)));
  assert.ok(d.groups.some((g) => g.id === 'desk') && d.lines.some((l) => l.group === 'desk'), 'with a desk');
  assert.ok(d.views[1].words.includes('2.45 m high'), 'under 2.5 m, said');
});

test('a bedroom 4 × 3 with a wardrobe wall: the radiator sized by the rule of thumb; underfloor heating by its own', () => {
  const d = K.design(W.paramsFromWords('a bedroom 4 by 3 with a wardrobe wall'));
  assert.equal(d.kind, 'room');
  const need = K.heatNeed(4, 3, 2.4, 'bedroom');
  assert.equal(need.watts, 1440);
  assert.equal(K.radiatorLength(need.watts), 0.8);
  assert.match(d.heat, /about 1440 W .* 800 mm long gives about 1440 W/);
  assert.ok(d.lines.some((l) => l.group === 'wardrobe' && l.price === 'mfc18'));
  const ufh = K.design(K.paramsFor('room', { heat: 'underfloor', room: 'living room' }));
  assert.ok(line(ufh, 'heating', 'ufhmat') && ufh.law.some((l) => /Part P/.test(l.title)));
  // the skirting: a 4 m wall's board from a 4.8 m length
  assert.ok(line(d, 'flooring', 'skirting').cut.stock.some((s) => s.len === 4.8));
});

test('a single garage: blocks at ten a square metre with piers, the slab on hardcore, the up-and-over door', () => {
  const d = K.design(K.paramsFor('garage'));
  const blocks = line(d, 'walls', 'block');
  assert.ok(blocks.n > 300 && blocks.n < 600, `${blocks.n} blocks`);
  assert.ok(line(d, 'walls', 'mortar').n === Math.ceil(blocks.n / 20));
  assert.ok(line(d, 'slab', 'concrete') && line(d, 'slab', 'hardcore') && line(d, 'door', 'garagedoor'));
  assert.ok(d.notes.some((n) => /rule of thumb/.test(n)));
});

// ---------------------------------------------------------------- furniture: the load line

test('a bookshelf 2 m wide: four sides, three bays of 640 mm, each shelf about 70 kg spread evenly', () => {
  const d = K.design(W.paramsFromWords('a bookshelf for this wall, 2 metres'));
  assert.equal(d.params.w, 2);
  assert.match(d.summary, /3 bays of 6 shelves/);
  // δ = L/360 for an even load: w = δ·384EI / 5L⁴, I = bh³/12 (18 mm pine, E = 9 GPa)
  const L = 0.64;
  const I = (0.3 * 0.018 ** 3) / 12;
  const kg = Math.round((((L / 360) * 384 * 9e9 * I) / (5 * L ** 4)) * L / 9.81);
  assert.equal(kg, 70);
  assert.equal(K.evenLoadKg(L, 0.3, 0.018, 9), kg);
  assert.match(d.load, /^Each shelf takes about 70 kg spread evenly/);
  // MDF bends more: less than half
  assert.ok(K.evenLoadKg(L, 0.3, 0.018, 3.5) < kg / 2);
  assert.ok(d.safety.some((s) => /Fix every tall case to the wall/.test(s)));
  for (const k of ['desk', 'bench']) assert.match(K.design(K.paramsFor(k)).load, /\d+ kg/);
});

test('every kit, at its defaults and at its edges: every box, line and drawing in finite numbers, every line priced', () => {
  const finite = (...xs) => xs.every((x) => Number.isFinite(x));
  for (const kind of ['shed', 'gardenroom', 'garage', 'room', 'shelf', 'desk', 'bench', 'pc']) {
    for (const over of [{}, { w: 1, d: 1, h: 1 }, { w: 9, d: 9, h: 9, roof: 'apex', windows: 4, doors: 'double', walls: 'timber', heat: 'underfloor', wardrobe: true, desk: true, material: 'mdf' }]) {
      const d = K.design(K.paramsFor(kind, over));
      const tag = `${kind} ${JSON.stringify(over)}`;
      assert.ok(d.boxes.length > 0 && d.lines.length > 0 && d.views.length > 0, tag);
      for (const b of d.boxes) assert.ok(finite(b.x, b.y, b.z, b.w, b.h, b.d, ...b.out) && b.w > 0 && b.h > 0 && b.d > 0, `${tag}: box ${b.id}`);
      for (const l of d.lines) assert.ok(finite(l.n, l.qty, l.rate, l.total) && l.total >= 0 && d.groups.some((g) => g.id === l.group), `${tag}: line ${l.id}`);
      for (const v of d.views) {
        assert.ok(finite(v.w, v.h) && v.words.length > 20, `${tag}: view ${v.title}`);
        for (const it of v.items) assert.ok(JSON.stringify(it).match(/null|NaN/) === null, `${tag}: ${JSON.stringify(it).slice(0, 80)}`);
      }
      assert.ok(new Set(d.lines.map((l) => l.id)).size === d.lines.length, `${tag}: line ids are unique`);
      assert.equal(d.total, B.totals(d).total, tag);
    }
  }
  // a live price stays with its line when the design changes (the ids are what a line is, not where it is)
  const a = K.design(K.paramsFor('shed', { windows: 1 }));
  const b = K.design(K.paramsFor('shed', { windows: 2 }));
  assert.equal(a.lines.find((l) => l.price === 'felt').id, b.lines.find((l) => l.price === 'felt').id);
});

// ---------------------------------------------------------------- the bill and its CSV

test('the bill: its total is its lines; a live price from a shop page counts in, dated; the CSV carries every line and the honest lines', () => {
  const d = shed();
  const t = B.totals(d);
  assert.equal(t.total, Math.round(d.lines.reduce((s, l) => s + l.total, 0) * 100) / 100);
  assert.equal(t.total, d.total);
  assert.equal(t.byGroup.reduce((s, g) => s + g.total, 0).toFixed(2), t.total.toFixed(2));
  const felt = line(d, 'roof', 'felt');
  const live = { [felt.id]: { url: 'https://shop.example/felt', gbp: 40, at: Date.UTC(2026, 10, 1) } };
  const t2 = B.totals(d, live);
  assert.equal(t2.liveLines, 1);
  assert.equal(Math.round((t2.total - t.total) * 100) / 100, Math.round((40 - felt.rate) * felt.qty * 100) / 100);
  const csv = B.toCsv(d, live);
  const rows = csv.trim().split('\n');
  assert.ok(rows.includes('Group,Part,Size,Material,Buy,Unit,Rate (£),Per,Line (£),Cut list,Live price (£),Live price read,Shop page,Note'));
  assert.equal(rows.filter((r) => /^(Base|Floor|Frame|Roof|Cladding|Door|Windows|Fixings|Finish),/.test(r)).length, d.lines.length);
  assert.ok(rows.some((r) => r.includes('40.00') && r.includes('2026-11-01') && r.includes('https://shop.example/felt')));
  assert.ok(rows.some((r) => r.startsWith(`Total,,,,,,,,${t2.total.toFixed(2)}`)));
  assert.ok(csv.includes('Typical prices from October 2026, not quotes') && csv.includes('FIRST ESTIMATE · NEVER CERTIFIED'));
  assert.ok(rows.some((r) => /Cut list|lengths/.test(r) && /waste/.test(r)), 'the cut list goes with its line');
  const text = B.toText(d, live);
  assert.ok(text.includes('THE BUILD') && text.includes('FIRST ESTIMATE · NEVER CERTIFIED') && /check with your council/.test(text));
  // no trade word without its plain gloss
  const words = K.glossFor(d).map((g) => g.term);
  for (const w of ['Stud', 'Noggin', 'Bearer', 'Joist', 'Rafter', 'Pitch', 'Pent roof', 'OSB3', 'Shiplap', 'Cut list']) assert.ok(words.includes(w), `${w} glossed`);
  assert.ok(text.includes('WHAT THE WORDS MEAN') && /- Noggin: a short timber across between two studs/.test(text));
  assert.ok(K.glossFor(K.design(K.paramsFor('pc'))).some((g) => g.term === 'Socket'), 'a PC’s words too');
  assert.equal(B.priceFromWatch('Watching 47 x 75 mm treated: £12.49 now (read from the page’s product data).'), 12.49);
});

test('the price table: written October 2026, every price a first estimate in pounds', () => {
  assert.equal(P.PRICE_MONTH, '2026-10');
  assert.equal(P.PRICE_LINE, 'Typical prices from October 2026, not quotes');
  assert.equal(P.ESTIMATE, 'FIRST ESTIMATE · NEVER CERTIFIED');
  for (const [id, p] of Object.entries(P.PRICES)) assert.ok(p.name && p.unit && p.gbp >= 0, id);
  assert.match(PC.PC_LINE, /move weekly.*October 2026, not quotes/);
});

// ---------------------------------------------------------------- the PC

test('a gaming PC under £800: the dearest build that fits, every part checked', () => {
  const p = W.paramsFromWords('spec me a gaming PC under £800');
  assert.equal(p.budget, 800);
  const d = K.design(p);
  assert.equal(d.kind, 'pc');
  assert.ok(d.total <= 800 && d.total > 700, `£${d.total}`);
  assert.ok(d.compat.length >= 6 && d.compat.every((c) => c.ok), JSON.stringify(d.compat));
  assert.ok(d.notes.includes(PC.PC_LINE));
  // every preset passes its own check
  for (const x of PC.PRESETS) assert.ok(PC.checkPc(x.parts).every((c) => c.ok), `${x.use} £${PC.priceOf(x.parts)}`);
  // a school PC has no card: the processor's own graphics, said
  assert.ok(K.design(K.paramsFor('pc', { use: 'school', budget: 500 })).compat.some((c) => c.ok && /own graphics/.test(c.text)));
});

test('the PC check: a socket mismatch is refused; a power shortfall is said; a CPU of another socket brings its board', () => {
  const { parts } = PC.pickPc(800, 'gaming');
  const r = PC.pickPart(parts, 'board', 'b550');
  assert.ok('refused' in r && /AM4/.test(r.refused) && /AM5/.test(r.refused), JSON.stringify(r));
  const bad = PC.checkPc({ ...parts, board: 'b550' });
  assert.ok(bad.some((c) => !c.ok && /will not fit/.test(c.text)));
  const big = PC.PRESETS.find((x) => x.parts.gpu === 'rx-9070xt').parts;
  const short = PC.checkPc({ ...big, psu: 'psu550' });
  assert.ok(short.some((c) => !c.ok && /short by 200 W/.test(c.text) && /750 W/.test(c.text)), JSON.stringify(short));
  const swap = PC.pickPart(parts, 'cpu', 'i5-14400f');
  assert.ok('build' in swap && swap.build.board === 'b760' && PC.partById(swap.build.ram).mem === 'DDR4' && /swapped/.test(swap.said));
  assert.ok(PC.checkPc(swap.build).every((c) => c.ok), JSON.stringify(PC.checkPc(swap.build)));
  // the card's length and the cooler's height are measured against the case
  assert.ok(PC.checkPc(big).some((c) => c.ok && /The card \(about 320 mm\) fits the case \(up to 405 mm\)/.test(c.text)));
  assert.ok(PC.checkPc(big).some((c) => c.ok && /The cooler \(155 mm\) fits under the case’s 170 mm/.test(c.text)));
  // a full ATX board will not go in a micro-ATX case
  assert.ok(PC.checkPc({ ...parts, board: 'b650', case: 'q300l' }).some((c) => !c.ok && /only takes micro-ATX/.test(c.text)));
});

// ---------------------------------------------------------------- a car, a robot: concepts only

test('a car or a robot is a concept with real parts named, and nothing is drawn as if it were a build', () => {
  for (const kind of ['car', 'robot', 'tv']) {
    const d = K.design(K.paramsFor(kind));
    assert.equal(d.concept, true, kind);
    assert.equal(d.boxes.length, 0, `${kind}: no 3-D`);
    assert.equal(d.views.length, 0, `${kind}: no plan`);
    assert.equal(d.lines.length, 0, `${kind}: no bill`);
    assert.equal(d.total, 0);
    assert.ok(d.summary.includes(C.CONCEPT_LINE) && d.notes.includes(C.CONCEPT_LINE));
    assert.match(K.planWords(d), /a concept with real parts, not a build plan, so nothing is drawn/);
  }
  const car = K.design(K.paramsFor('car'));
  const roles = car.parts.map((p) => p.role);
  for (const r of ['Motor', 'Controller', 'Battery', 'Sensors', 'Frame']) assert.ok(roles.includes(r), r);
  assert.match(car.parts.find((p) => p.role === 'Battery').name, /lithium iron phosphate \(LiFePO4\)/);
  assert.ok(car.law.some((l) => /Individual Vehicle Approval/.test(l.words)));
  const robot = K.design(K.paramsFor('robot'));
  assert.match(robot.parts.find((p) => p.role === 'Battery').name, /lithium-ion/);
  assert.ok(robot.parts.some((p) => p.role === 'Motor controller') && robot.parts.some((p) => p.role === 'Sensors') && robot.parts.some((p) => p.role === 'Frame'));
});

// ---------------------------------------------------------------- his words

test('his words: the six from the brief, "show me the build", "price the roof", the changes; never a picture, a home or a booking', () => {
  const kinds = {
    'design me a shed three by two': ['shed', 3, 2],
    'design me a garden shed 3 m by 2 m': ['shed', 3, 2],
    'build me a garden room with a desk': ['gardenroom', 4, 3],
    'design me a single garage': ['garage', 3.2, 5.6],
    'design me a bedroom 4 by 3 with a wardrobe wall': ['room', 4, 3],
    'I want a bookshelf for this wall, 2 metres': ['shelf', 2, 0.3],
    'design me a desk': ['desk', 1.2, 0.6],
    'spec me a gaming PC under £800': ['pc'],
    'build me a robot': ['robot'],
    'design me an 8 by 6 shed': ['shed', 2.44, 1.83],
  };
  for (const [say, [kind, w, d]] of Object.entries(kinds)) {
    const a = W.buildAsked(say);
    assert.equal(a?.kind, 'design', say);
    assert.equal(a.params.kind, kind, say);
    if (w) assert.deepEqual([a.params.w, a.params.d], [w, d], say);
  }
  assert.match(W.buildAsked('design me an 8 by 6 shed').params.notes[0], /read as feet/);
  assert.deepEqual(W.buildAsked('show me the build'), { kind: 'show' });
  assert.deepEqual(W.buildAsked('price the roof'), { kind: 'price', group: 'roof' });
  assert.deepEqual(W.buildAsked('make it 4 by 3').change, { w: 4, d: 3 });
  assert.deepEqual(W.buildAsked('make it 3.5 m wide').change, { w: 3.5 });
  assert.deepEqual(W.buildAsked('an apex roof').change, { roof: 'apex' });
  const p = K.paramsFor('shed', { w: 3, d: 2, windows: 1 });
  assert.equal(W.applyChange(p, W.buildAsked('add a window').change).windows, 2);
  assert.equal(W.applyChange(p, { w: 9 }).w, 6, 'held to a shed’s six metres');
  for (const no of ['make me a coffee', 'make the room darker', 'draw me a car', 'design my home', 'design me a house with a garage', 'create a study plan', 'make a 3d model of a shed', 'set it to 21', 'turn off the hall light', 'my dad’s car makes a grinding noise when I brake', 'make it wider', 'design a room with my hands', 'build a shed using my fingers', 'draw a room in the air']) assert.equal(W.buildAsked(no), null, no);
  // the phrases registry tries it (after the car's, before the Workbench)
  const ids = LOCAL_ASKS.map((x) => x.id);
  assert.ok(ids.indexOf('build') > ids.indexOf('carfault') && ids.indexOf('build') < ids.indexOf('workbench'));
  assert.ok(LOCAL_ASKS.find((x) => x.id === 'build').test('design me a shed three by two'));
});

test('the catalogue has words for the sample, the pane and the phrase, each saying first estimate', () => {
  for (const id of ['studio:sample:build', 'studio:pane:build', 'phrase:build']) assert.ok(R.RESTD_WORDS[id], id);
  assert.ok(Object.values(R.RESTD_WORDS).some((w) => /first estimate, never certified/i.test(w.more)));
});

// ================================================================ THE HOME ASSISTANT BRIDGE

const { sqlStorage } = await import('../../../tests/sqlite-storage.mjs');
class Mem {
  m = new Map();
  sql = sqlStorage();
  async get(k) { return Array.isArray(k) ? new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))])) : this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b)); else this.m.set(k, structuredClone(v)); }
  async delete(k) { return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k); }
  async list({ prefix = '' } = {}) { return new Map([...this.m].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)])); }
  async setAlarm() {}
  async getAlarm() { return null; }
}
const KEY = `${HOUSE_URL}\n${HOUSE_TOKEN}`;
const houseFetch = async (input, init) => houseApi(new URL(typeof input === 'string' ? input : input.url), init) ?? new Response('', { status: 404 });
function deps(key = KEY) {
  BR.resetHouseCache();
  resetHouse();
  return { storage: new Mem(), vault: { get: async (k) => (k === 'homeassistant' ? key : null) }, fetch: houseFetch };
}
const call = (d, path, method = 'GET', body) => BR.houseRoute(new Request(`https://ghosty.test/api${path}`, { method, ...(body ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}) }), path.split('?')[0], method, d);
const entitiesOf = async () => (await BR.readHouse(deps())).entities;

test('the house: rooms from its own areas, the allowlist as code (a camera never shown), each thing in plain words', async () => {
  const list = await entitiesOf();
  const ids = list.map((e) => e.id);
  assert.ok(!ids.includes('camera.front_door'), 'a camera is off the list: never shown');
  assert.deepEqual([...new Set(list.map((e) => e.area).filter(Boolean))].sort(), ['Garage', 'Hall', 'Kitchen', 'Living room'], 'three rooms from Home Assistant, the garage guessed from its name');
  const by = Object.fromEntries(list.map((e) => [e.id, e]));
  assert.equal(H.stateWords(by['light.hall_light']), 'on, 80%');
  assert.equal(H.stateWords(by['climate.heating']), '19.5 °C, set to 20 °C, heating');
  assert.equal(H.stateWords(by['binary_sensor.back_door']), 'open');
  assert.equal(H.stateWords(by['media_player.living_room_tv']), 'playing “The News”');
  assert.equal(H.stateWords(by['sensor.living_room_temperature']), '18.5 °C');
  assert.equal(H.houseLine(list), '2 lights on · coldest: Living room 18.5 °C · heating: 19.5 °C, set to 20 °C, heating');
  assert.ok(by['lock.back_door_lock'].guarded && by['cover.garage_door'].guarded && !by['light.hall_light'].guarded);
});

test('the allowlist and the guarded set: a domain off the list refused by name, a sensor only read, a lock and a garage door only by his tap with a confirm, never a job', () => {
  const e = (id, extra = {}) => ({ id, domain: H.domainOf(id), name: id, ...extra });
  assert.deepEqual(H.policy(e('light.hall_light'), 'turn_off', { origin: 'chat' }), { ok: true, guarded: false });
  const cam = H.policy(e('camera.front_door'), 'turn_on', { origin: 'tap', confirm: true });
  assert.ok(!cam.ok && /“camera”/.test(cam.why) && !cam.needs, cam.why);
  assert.ok(!H.policy(e('sensor.x'), 'turn_on', { origin: 'tap' }).ok);
  assert.ok(!H.policy(e('light.hall_light'), 'flash', { origin: 'tap' }).ok, 'a service off the list');
  for (const [id, service, extra] of [['lock.back_door_lock', 'unlock', {}], ['alarm_control_panel.home', 'alarm_disarm', {}], ['cover.garage_door', 'open_cover', { cls: 'garage' }], ['cover.drive_gate', 'open_cover', { cls: 'gate' }], ['switch.kettle', 'turn_on', {}]]) {
    const marked = id === 'switch.kettle' ? ['switch.kettle'] : [];
    const x = e(id, extra);
    assert.equal(H.isGuarded(x, marked), true, id);
    assert.equal(H.policy(x, service, { origin: 'chat', marked }).needs, 'confirm', `${id} from words`);
    assert.equal(H.policy(x, service, { origin: 'tap', marked }).needs, 'confirm', `${id} tapped with no confirm`);
    assert.deepEqual(H.policy(x, service, { origin: 'tap', confirm: true, marked }), { ok: true, guarded: true }, `${id} tapped and confirmed`);
    const job = H.policy(x, service, { origin: 'job', confirm: true, marked });
    assert.ok(!job.ok && !job.needs && /A scheduled job never touches/.test(job.why), `${id} from a job`);
  }
  // a blind is not guarded: a job may close it
  assert.deepEqual(H.policy(e('cover.bedroom_blind', { cls: 'blind' }), 'close_cover', { origin: 'job' }), { ok: true, guarded: false });
  assert.equal(H.isGuarded(e('switch.kettle'), []), false, 'a switch only when he marks it');
});

test('a scheduled job: "turn off the hall light" is done and kept in WHY; "unlock the back door" is refused, never sent, and kept too', async () => {
  const d = deps();
  const done = await BR.houseJob(d, { text: 'turn off the hall light', title: 'Lights out at eleven' });
  assert.equal(done, 'Done: the Hall light is off.');
  assert.deepEqual(houseCalls(), [{ domain: 'light', service: 'turn_off', body: { entity_id: 'light.hall_light' } }]);
  const no = await BR.houseJob(d, { text: 'unlock the back door', title: 'Let the dog walker in' });
  assert.match(no, /^A scheduled job never touches the Back door lock \(a lock\): only your own tap, with a confirm, does\.$/);
  const garage = await BR.houseJob(d, { text: 'open the garage', title: 'Garage at 8' });
  assert.match(garage, /A scheduled job never touches the Garage door/);
  assert.equal(houseCalls().length, 1, 'nothing guarded reached the box');
  const trails = await WHY.loadTrails(d.storage);
  assert.equal(trails.length, 3);
  assert.deepEqual(trails[0].steps, [{ tool: 'set_lights', args: 'Hall light: off', ok: true }]);
  assert.match(trails[0].asked, /your scheduled job “Lights out at eleven”/);
  assert.equal(trails[1].steps[0].ok, false);
  assert.match(trails[1].steps[0].note, /refused: A scheduled job never touches/);
  // not a house action: the task runs as ever
  assert.equal(await BR.houseJob(d, { text: 'brief me on the news', title: 'News' }), null);
  // unlinked: said, nothing done
  assert.match(await BR.houseJob(deps(''), { text: 'turn off the hall light', title: 'Lights' }), /Link your Home Assistant first/);
});

test('the vault’s address and token never in a response: the house, an action, a refusal, a wrong token, the key check', async () => {
  const d = deps();
  const leak = (s) => s.includes('house.example.test') || s.includes(HOUSE_TOKEN) || s.includes('0123456789abcdef');
  const got = await (await call(d, '/house')).text();
  assert.ok(JSON.parse(got).linked && JSON.parse(got).entities.length === 9 && !leak(got));
  for (const body of [{ entity: 'light.kitchen_light', service: 'turn_on', origin: 'tap' }, { entity: 'lock.back_door_lock', service: 'unlock', origin: 'chat' }, { entity: 'camera.front_door', service: 'turn_on', origin: 'tap', confirm: true }]) {
    const t = await (await call(d, '/house/act', 'POST', body)).text();
    assert.ok(!leak(t), t);
  }
  const bad = deps(`${HOUSE_URL}\nnot-the-right-token-at-all-0000`);
  const t = await (await call(bad, '/house?fresh=1')).text();
  assert.ok(/turned the token away/.test(t) && !leak(t), t);
  const ok = await BR.testHouse(KEY, houseFetch);
  assert.ok(ok.ok && !leak(ok.info), ok.info);
  const wrong = await BR.testHouse(`${HOUSE_URL}\nnot-the-right-token-at-all-0000`, houseFetch);
  assert.ok(!wrong.ok && !leak(wrong.info), wrong.info);
  const unreachable = await BR.testHouse(`https://nowhere.example.test\n${HOUSE_TOKEN}`, async () => { throw new Error('getaddrinfo ENOTFOUND nowhere.example.test'); });
  assert.ok(!unreachable.ok && !leak(unreachable.info) && !/nowhere/.test(unreachable.info), unreachable.info);
  // the phone may say "tap" or "chat", never "job"
  const asJob = await (await call(d, '/house/act', 'POST', { entity: 'light.kitchen_light', service: 'turn_off', origin: 'job' })).json();
  assert.equal(asJob.ok, true);
  assert.equal((await WHY.loadTrails(d.storage)).at(-1).asked, 'your words in the chat');
  // the key as he pastes it: either order, labels, a path after the address; never plain http
  assert.deepEqual(BR.parseHouseKey(`URL: https://me.duckdns.org:8123/lovelace/0\nToken: ${HOUSE_TOKEN}`), { url: 'https://me.duckdns.org:8123', token: HOUSE_TOKEN });
  assert.deepEqual(BR.parseHouseKey(`${HOUSE_TOKEN} https://me.duckdns.org`), { url: 'https://me.duckdns.org', token: HOUSE_TOKEN });
  assert.equal(BR.parseHouseKey(`http://me.duckdns.org\n${HOUSE_TOKEN}`), null);
});

test('the service calls, shaped: only the fields a service takes, each held to its range', () => {
  assert.deepEqual(H.shapeCall('light', 'turn_on', 'light.hall_light', { brightness_pct: 150, colour: 'red' }), { path: '/api/services/light/turn_on', body: { entity_id: 'light.hall_light', brightness_pct: 100 } });
  assert.deepEqual(H.shapeCall('climate', 'set_temperature', 'climate.heating', { temperature: '21.3', hvac_mode: 'heat' }, { modes: ['off', 'heat'] }).body, { entity_id: 'climate.heating', temperature: 21.5, hvac_mode: 'heat' });
  assert.match(H.shapeCall('climate', 'set_temperature', 'climate.heating', { temperature: 40 }).error, /between 5 and 30/);
  assert.match(H.shapeCall('climate', 'set_hvac_mode', 'climate.heating', { hvac_mode: 'cool' }, { modes: ['off', 'heat'] }).error, /no “cool” mode/);
  assert.deepEqual(H.shapeCall('media_player', 'volume_set', 'media_player.tv', { volume_level: 1.5 }).body, { entity_id: 'media_player.tv', volume_level: 1 });
  assert.deepEqual(H.shapeCall('cover', 'set_cover_position', 'cover.blind', { position: -4 }).body, { entity_id: 'cover.blind', position: 0 });
  assert.deepEqual(H.shapeCall('lock', 'unlock', 'lock.back_door_lock', { code: '1234' }).body, { entity_id: 'lock.back_door_lock' }, 'a code is never passed on');
  assert.ok('error' in H.shapeCall('light', 'turn_on', 'switch.kettle'), 'a domain and an entity that disagree');
  assert.ok('error' in H.shapeCall('light', 'turn_on', 'light.x; drop'), 'never an odd name');
});

test('his words: the brief’s asks matched to his things, "which one?" when two match, and none of the car’s or the weather’s', async () => {
  const list = await entitiesOf();
  const r = (t) => H.resolveAsk(H.houseAsked(t), list, [], Date.now());
  assert.deepEqual(H.houseAsked('turn off the hall light'), { kind: 'power', on: false, name: 'hall light' });
  assert.deepEqual(H.houseAsked('Turn the hall light on.'), { kind: 'power', on: true, name: 'hall light' });
  assert.deepEqual(H.houseAsked('dim the living room lamp to 40'), { kind: 'dim', name: 'living room lamp', pct: 40 });
  assert.deepEqual(H.houseAsked('set the heating to 21'), { kind: 'heat', temp: 21, name: '' });
  assert.deepEqual(H.houseAsked('is the back door open?'), { kind: 'is', name: 'back door', want: 'open' });
  assert.deepEqual(H.houseAsked("what's the temperature in the living room?"), { kind: 'temp', room: 'living room' });
  assert.deepEqual(H.houseAsked('pause the telly'), { kind: 'media', act: 'pause', name: 'telly' });
  assert.deepEqual(H.houseAsked('close the blinds'), { kind: 'cover', open: false, name: 'blinds' });
  // a scheduled task's words often carry their time: the name is the thing alone
  assert.deepEqual(H.houseAsked('Turn off the hall light at 11pm'), { kind: 'power', on: false, name: 'hall light' });
  assert.deepEqual(H.houseAsked('turn the heating off every night'), { kind: 'power', on: false, name: 'heating' });
  let x = r('turn off the hall light');
  assert.ok(x.kind === 'act' && x.entity.id === 'light.hall_light' && x.service === 'turn_off' && !x.guarded);
  x = r('set the heating to 21');
  assert.ok(x.kind === 'act' && x.entity.id === 'climate.heating' && x.service === 'set_temperature' && x.data.temperature === 21);
  x = r('is the back door open?');
  assert.ok(x.kind === 'answer' && /^Yes: the Back door is open \(since 12 min ago\)\.$/.test(x.text), x.text);
  x = r("what's the temperature in the living room?");
  assert.ok(x.kind === 'answer' && /^It’s 18\.5 °C in the living room/.test(x.text), x.text);
  x = r('pause the telly');
  assert.ok(x.kind === 'act' && x.entity.id === 'media_player.living_room_tv' && x.service === 'media_pause');
  x = r('unlock the back door');
  assert.ok(x.kind === 'act' && x.entity.id === 'lock.back_door_lock' && x.guarded, 'a lock is found, and guarded');
  x = r('open the garage');
  assert.ok(x.kind === 'act' && x.entity.id === 'cover.garage_door' && x.guarded);
  x = r('turn on the light');
  assert.ok(x.kind === 'which' && x.options.length === 3 && /^Which one\? /.test(x.text), JSON.stringify(x).slice(0, 200));
  x = r('turn off the lights in the hall');
  assert.equal(x.kind, 'act');
  assert.equal(r('close the blinds').kind, 'none', 'no blind in this house; a garage door is never “the blinds”');
  for (const no of ['open the bonnet', 'is the shop open?', 'how cold is it', "what's the temperature in london", 'turn off my phone', 'set a timer for 10 minutes', 'my dad’s car makes a grinding noise when I brake', 'design me a shed three by two', 'play some music', 'turn on TV mode', 'switch off the tv layout']) assert.equal(H.houseAsked(no), null, no);
  // his own names count once the phone has read them
  assert.equal(H.houseAsked('turn on the christmas tree'), null);
  H.setHouseNames(['Christmas tree']);
  assert.deepEqual(H.houseAsked('turn on the christmas tree'), { kind: 'power', on: true, name: 'christmas tree' });
  H.setHouseNames([]);
  const ids = LOCAL_ASKS.map((p) => p.id);
  assert.ok(ids.indexOf('house') > ids.indexOf('build') && ids.indexOf('house') < ids.indexOf('workbench'));
});

test('a turn about the house gets its state as a fact; the morning gets one short line; neither when unlinked', async () => {
  const d = deps();
  const facts = await BR.houseTurnFacts(d, 'is it cold in the house?');
  assert.ok(facts.startsWith('2 lights on · coldest: Living room 18.5 °C') && /Kitchen: .*Back door open/.test(facts), facts);
  assert.equal(await BR.houseTurnFacts(d, 'what is the capital of France?'), '');
  assert.equal(await BR.houseTurnFacts(deps(''), 'is it cold in the house?'), '');
  const line = await BR.morningHouseLine(d);
  assert.equal(line, 'Living room 18.5 °C (the coldest), heating set to 20 °C');
  assert.ok(line.length <= 60);
  assert.equal(await BR.morningHouseLine(deps('')), null);
});

test('the morning piece carries one house line when it fits the line’s cap, and leaves it out when it does not', async () => {
  const S = await import('./.build/restd/speak.mjs');
  const morning = async (houseLine) => {
    const storage = new Mem();
    await storage.put('owner:ctx', { tz: 'Europe/London' });
    await storage.put('places', [{ id: 'home', label: 'Home', query: 'x', address: '12 Acacia Avenue', lat: 52.44, lon: -1.88, at: 1 }]);
    const sent = [];
    const rain = async () => ({ time: Array.from({ length: 24 }, (_, i) => Date.UTC(2026, 10, 4, i)), prob: Array.from({ length: 24 }, (_, i) => (i >= 15 ? 70 : 10)) });
    await S.speakTick({ storage, vault: { get: async () => null }, now: () => Date.UTC(2026, 10, 4, 7, 40), notify: async (item) => void sent.push(item), rain, ...(houseLine ? { houseLine } : {}) });
    return sent[0]?.card.line;
  };
  assert.equal(await morning(async () => 'Living room 18.5 °C (the coldest), heating set to 20 °C'), 'Rain likely from 15:00 · nothing in your diary today · Living room 18.5 °C (the coldest), heating set to 20 °C');
  assert.equal(await morning(async () => 'x'.repeat(70)), 'Rain likely from 15:00 · nothing in your diary today', 'past the cap: the house line is left out, never the rain or the diary');
  assert.equal(await morning(async () => null), 'Rain likely from 15:00 · nothing in your diary today', 'unlinked: no house line');
  assert.equal(await morning(null), 'Rain likely from 15:00 · nothing in your diary today');
});

test('the catalogue has words for LINKS → HOME ASSISTANT and the house’s words', () => {
  for (const id of ['panel:links:HOME ASSISTANT', 'phrase:house']) assert.ok(R.RESTD_WORDS[id], id);
  assert.match(R.RESTD_WORDS['panel:links:HOME ASSISTANT'].more, /token stays in my vault/);
  assert.match(R.RESTD_WORDS['phrase:house'].more, /your tap and a confirm/);
});
