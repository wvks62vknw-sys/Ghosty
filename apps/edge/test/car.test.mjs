// THE CAR IN 3-D (BRIEF-CAR, batch ⑤ part 1; OWNER-ISSUES 91a "i have this car and this is what's wrong with it"):
//  - the CarSpec from the vehicle facts the check gives, for six real-shaped cases: a hatchback, a saloon, an estate, an
//    SUV, a van, and a model I do not know (a sensible fallback, said to be a guess: `exact: false`); the paint from the
//    colour word; the proportions of a real car of that shape;
//  - the fault table (no model): about forty symptoms, each with at least one suspect whose parts are in the engine bay,
//    the wheel or the underneath models (the builders' own source names every one); every cost a range; every
//    dangerous symptom with its safety line; the MOT's advisories and failures raise the suspects they point to; an
//    electric car drops what it has not got; his words pick the symptom, and the view words open the views;
// Bundles are built here with esbuild's API (as catalogue.test.mjs does).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: [at('../../web/src/car/spec.ts'), at('../../web/src/car/parts.ts'), at('../../web/src/car/faults.ts')],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outdir: at('./.build/car'),
  outbase: at('../../web/src/car'),
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning',
});
const S = await import('./.build/car/spec.mjs');
const P = await import('./.build/car/parts.mjs');
const F = await import('./.build/car/faults.mjs');
const src = (f) => readFileSync(at(`../../web/src/car/${f}`), 'utf8');

// ---------------------------------------------------------------- the car from the facts

const record = (r) => ({ ok: true, text: '', links: [], report: { plate: 'GH17 OST', make: '', model: '', colour: '', fuel: '', firstUsed: '2017-03-28', engineCc: null, recall: 'No', mot: { state: 'valid', date: '2027-03-19', text: 'MOT valid' }, tests: [], mileage: { last: null, unit: null, at: null, points: [], drops: [] }, advisories: 0, verdict: '', sources: [], ...r } });

test('six real-shaped cars become their shapes; a model I do not know is a family hatchback, said to be a guess', () => {
  const cases = [
    [{ make: 'FORD', model: 'FOCUS', colour: 'Silver', fuel: 'Petrol' }, 'hatchback', true],
    [{ make: 'BMW', model: '3 SERIES 320D SE', colour: 'Black', fuel: 'Diesel' }, 'saloon', true],
    [{ make: 'VOLKSWAGEN', model: 'PASSAT ESTATE', colour: 'Grey', fuel: 'Diesel' }, 'estate', true],
    [{ make: 'NISSAN', model: 'QASHQAI', colour: 'White', fuel: 'Petrol' }, 'suv', true],
    [{ make: 'FORD', model: 'TRANSIT CUSTOM 290 LIMITED', colour: 'White', fuel: 'Diesel' }, 'van', true],
    [{ make: 'ZYXMOTORS', model: 'QWERTY 9', colour: 'Red', fuel: 'Petrol' }, 'hatchback', false],
  ];
  for (const [r, shape, exact] of cases) {
    const facts = S.factsFrom(record(r));
    const c = S.specFrom(facts);
    assert.equal(c.silhouette, shape, `${r.make} ${r.model}`);
    assert.equal(c.exact, exact, `${r.make} ${r.model}: exact`);
    assert.equal(c.known, true);
    assert.equal(c.plate, 'GH17 OST');
    assert.equal(c.year, 2017, 'the year from the first use');
    const d = c.dims;
    // the proportions of a real car: the wheelbase inside the length, both overhangs there, the wheels under the body
    assert.ok(d.wheelbase > d.length * 0.5 && d.wheelbase < d.length * 0.75, `${shape}: wheelbase ${d.wheelbase} of ${d.length}`);
    assert.ok(d.front > 0.6 && d.rear > 0.5, `${shape}: overhangs ${d.front} / ${d.rear}`);
    assert.ok(Math.abs(d.front + d.wheelbase + d.rear - d.length) < 1e-6);
    assert.ok(d.tyreR > d.rimR + 0.07 && d.tyreR * 2 < d.height * 0.55, `${shape}: wheels`);
    // the side line: a bonnet, a windscreen, a roof, from the front to the back
    const p = c.profile;
    assert.ok(p.ws0 < p.ws1 && p.ws1 <= p.r1 && p.r1 <= p.tail && p.a < p.c, `${shape}: the side line in order`);
    assert.ok(S.topAt(p, (p.ws1 + p.r1) / 2) > 0.95 && S.topAt(p, p.ws0) < 0.75, `${shape}: a roof above a bonnet`);
  }
  const unknown = S.specFrom(S.factsFrom(record({ make: 'ZYXMOTORS', model: 'QWERTY 9', colour: 'Red' })));
  assert.match(S.standInLine(unknown), /the shape is a guess/);
  const golf = S.specFrom(S.factsFrom(record({ make: 'VOLKSWAGEN', model: 'GOLF', colour: 'Blue' })));
  assert.equal(S.standInLine(golf), 'A stand-in: the shape, colour and plate are the car’s; the parts are where they are on most cars like it.');
  assert.equal(golf.title, 'Blue Volkswagen Golf');
});

test('the details follow the shape: a saloon’s boot line, an estate’s roof rails, a van’s three doors; body words outrank the family', () => {
  const spec = (make, model, colour = 'Blue') => S.specFrom({ plate: 'AB12 CDE', make, model, colour });
  assert.equal(spec('BMW', '3 SERIES').bootLine, true);
  assert.equal(spec('FORD', 'FOCUS').bootLine, false);
  assert.equal(spec('SKODA', 'SUPERB ESTATE').roofRails, true);
  assert.equal(spec('SKODA', 'SUPERB ESTATE').silhouette, 'estate');
  assert.equal(spec('FORD', 'FOCUS ESTATE').silhouette, 'estate', 'the record’s body word');
  assert.equal(spec('VAUXHALL', 'ZAFIRA TOURER').silhouette, 'mpv', 'a family whose own name holds the word keeps its shape');
  assert.equal(spec('FORD', 'FIESTA ST-3').silhouette, 'hatchback', 'a trim is not a body');
  assert.equal(spec('FORD', 'TRANSIT').size, 'L');
  assert.equal(spec('FORD', 'TRANSIT CONNECT').size, 'S', 'the longest family name first');
  assert.equal(spec('LAND ROVER', 'RANGE ROVER SPORT').silhouette, 'suv');
  assert.equal(spec('TOYOTA', 'HILUX').bed, true);
  assert.equal(spec('MAZDA', 'MX-5').silhouette, 'coupe');
  assert.equal(spec('FORD', 'PUMA').silhouette, 'suv');
  assert.equal(S.specFrom({ plate: 'P123 ABC', make: 'FORD', model: 'PUMA', year: 1999 }).silhouette, 'coupe', 'the old Puma');
  assert.equal(spec('LAND ROVER', 'SOMETHING NEW').silhouette, 'suv', 'the make, when the model is new to me');
  assert.equal(spec('FORD', 'TRANSIT CUSTOM').doors, 3);
  assert.equal(spec('TESLA', 'MODEL 3').silhouette, 'saloon');
  assert.equal(S.specFrom({ plate: 'X', make: 'TESLA', model: 'MODEL Y', fuel: 'Electricity' }).electric, true);
});

test('the paint from the colour word; nothing on record is a stand-in with only the plate', () => {
  assert.deepEqual(S.paintFor('SILVER'), S.PAINTS.silver);
  assert.equal(S.paintFor('Grey'), S.paintFor('gray'));
  assert.equal(S.paintFor('Silver').metallic, true);
  assert.equal(S.paintFor('red').metallic, false);
  assert.equal(S.paintFor('MULTI-COLOUR'), S.NO_PAINT);
  assert.equal(S.paintFor(''), S.NO_PAINT);
  for (const p of Object.values(S.PAINTS)) assert.ok(p.hex >= 0 && p.hex <= 0xffffff && /^(?:metallic|solid) /.test(p.name));
  const none = S.specFrom(null, 'rx15kng');
  assert.equal(none.known, false);
  assert.equal(none.exact, false);
  assert.equal(none.plate, 'RX15 KNG');
  assert.match(S.standInLine(none), /the plate is the car’s; the shape and colour are guesses/);
  assert.equal(S.factsFrom({ ok: false, reason: 'no_key', message: '', links: [] }), null, 'no record: no facts');
  assert.equal(S.specFrom(null).title, 'A car');
});

// ---------------------------------------------------------------- the fault table

test('every part has its sheet, and every part of a view is built by that view’s model (its source names it)', () => {
  const built = { bay: src('bay.ts'), wheel: src('wheel.ts'), under: src('under.ts'), car: src('body.ts') };
  for (const id of P.ALL_IDS) {
    const sh = P.PARTS[id];
    assert.ok(sh.name && sh.what.length > 20 && sh.check.length > 20 && sh.looks, `${id}: a whole sheet`);
    assert.ok(['DIY', 'GARAGE', 'DIY OR GARAGE'].includes(sh.diy), `${id}: DIY or garage`);
    assert.ok(Array.isArray(sh.cost) && sh.cost.length === 2 && sh.cost[0] < sh.cost[1], `${id}: a cost range ${sh.cost}`);
    assert.match(P.money(sh.cost), /^£[\d,]+–£[\d,]+$/);
    // the bay's table builds by key; the others name the id where they tag the part
    const named = Object.values(built).some((t) => t.includes(`'${id}'`)) || new RegExp(`\\n\\s+${id}: \\(\\) =>`).test(built.bay);
    assert.ok(named, `${id}: the ${P.viewOf(id)} model builds it`);
  }
  // the bay's build table is typed on BAY_IDS; the wheel's and the underneath's name theirs
  assert.match(built.bay, /const BUILD: Record<BayId,/);
});

test('about forty symptoms; each has suspects in the models, every cost a range, a safety line where it matters', () => {
  assert.ok(F.SYMPTOMS.length >= 40, `${F.SYMPTOMS.length} symptoms`);
  const ids = new Set();
  for (const s of F.SYMPTOMS) {
    assert.ok(!ids.has(s.id), `${s.id}: once`);
    ids.add(s.id);
    assert.ok(s.suspects.length >= 2 && s.says.length >= 1 && s.title, `${s.id}: suspects and words`);
    const inModels = s.suspects.filter((x) => x.parts.length && x.parts.every((p) => ['bay', 'wheel', 'under'].includes(P.viewOf(p))));
    assert.ok(inModels.length >= 1, `${s.id}: a suspect whose parts are in the bay, the wheel or underneath`);
    const sum = s.suspects.reduce((a, x) => a + x.p, 0);
    assert.ok(Math.abs(sum - 1) < 0.02, `${s.id}: likelihoods sum to ${sum}`);
    for (const x of s.suspects) {
      for (const p of x.parts) assert.ok(P.isPart(p), `${s.id}/${x.id}: ${p} is a part`);
      const cost = x.cost ?? P.PARTS[x.parts[0]].cost;
      assert.ok(cost.length === 2 && cost[0] <= cost[1] && (cost[1] > 0 || /nothing/.test(x.covers ?? '')), `${s.id}/${x.id}: a cost range ${cost}`);
      assert.ok(x.quick.length <= 60, `${s.id}/${x.id}: the card’s check is short`);
    }
  }
  for (const id of F.DANGEROUS) {
    const s = F.SYMPTOMS.find((x) => x.id === id);
    assert.ok(s, `${id} is a symptom`);
    assert.ok(s.safety && s.safety.length > 20, `${id}: a safety line`);
  }
  assert.equal(F.SYMPTOMS.find((s) => s.id === 'brake_grind').safety, 'Brakes: do not drive it; a garage, today.');
});

test('his words pick the symptom; the top suspect, its check and a first-estimate cost; the parts lit in the view', () => {
  const cases = [
    ["my dad's car makes a grinding noise when I brake", 'brake_grind', 'wheel', 'pads'],
    ['grinding when I brake', 'brake_grind', 'wheel', 'pads'],
    ['the brakes squeal', 'brake_squeal', 'wheel', 'pads'],
    ['the battery light is on', 'battery_light', 'bay', 'alternator'],
    ['car won’t start, it just clicks', 'no_start_click', 'bay', 'battery'],
    ['the engine cranks but won’t start', 'no_start_crank', 'under', 'fuel_tank'],
    ['oil light came on', 'oil_light', 'bay', 'dipstick'],
    ['my car is overheating', 'overheating', 'bay', 'coolant_tank'],
    ['white smoke from the exhaust', 'white_smoke', 'under', 'exhaust'],
    ['there’s a rattle underneath the car', 'rattle', 'under', 'heat_shield'],
    ['the front tyre is wearing on the inside edge', 'tyre_edge', 'under', 'tyre_wear'],
    ['number plate light not working', 'plate_lamp_out', 'car', 'plate_lamp'],
    ['the aircon is blowing warm', 'aircon_warm', 'bay', 'condenser'],
    ['clicking when turning on full lock', 'click_turning', 'wheel', 'cv_boot'],
    ['the car smells of petrol', 'fuel_smell', 'under', 'fuel_line'],
  ];
  for (const [words, id, view, part] of cases) {
    const f = F.pickFault(words);
    assert.ok(f, `"${words}": a fault`);
    assert.equal(f.symptom.id, id, `"${words}"`);
    assert.equal(f.view, view, `"${words}": the view`);
    assert.equal(f.lit[0], part, `"${words}": lights ${f.lit.join(', ')}`);
    assert.ok(f.next.length > 20, `"${words}": a next step`);
    for (let i = 1; i < f.suspects.length; i++) assert.ok(f.suspects[i - 1].likely >= f.suspects[i].likely, `"${words}": in order`);
  }
  const g = F.pickFault('grinding when I brake');
  assert.equal(F.faultLine(g), 'Likely: brake pads worn to the metal. Look at the pads through the wheel. £100–£220, a first estimate.');
  assert.equal(g.safety, 'Brakes: do not drive it; a garage, today.');
  assert.match(F.costWords(g.suspects[0]), /^£100–£220: a pair of front pads fitted\. A first estimate, not a quote\.$/);
  // not a car, not a symptom: nothing
  for (const words of ['my laptop won’t start, it just clicks', 'the lights keep flickering in my bedroom', 'my phone battery keeps going flat', "my dad's car is RX15 KNG", 'is my dad’s car due its MOT?', 'how do brakes work', 'what time is it', 'I am overheating in this jumper']) {
    assert.equal(F.pickFault(words), null, `"${words}": no fault`);
  }
});

test('the MOT history raises the suspects it points to; an electric car drops what it has not got', () => {
  const plain = F.pickFault('the brakes are squealing');
  assert.equal(plain.suspects[0].id, 'pads_indicator');
  const discs = F.pickFault('the brakes are squealing', { lines: [{ type: 'ADVISORY', text: 'Nearside Front Brake disc worn, pitted or scored, but not seriously weakened (1.1.14 (a) (ii))', date: '2026-03-20' }] });
  const before = plain.suspects.find((s) => s.id === 'glazed');
  const after = discs.suspects.find((s) => s.id === 'glazed');
  assert.ok(after.likely > before.likely && /Brake disc worn/.test(after.mot.text), 'the disc advisory raises the glazed pads-and-discs suspect');
  const pads = F.pickFault('grinding when I brake', { lines: [{ type: 'ADVISORY', text: 'Nearside Front Brake pad(s) wearing thin (1.1.13 (a) (ii))' }] });
  assert.equal(pads.suspects[0].id, 'pads_gone');
  assert.ok(pads.suspects[0].likely > F.pickFault('grinding when I brake').suspects[0].likely && pads.suspects[0].mot, 'pads wearing thin raise the worn pads');
  const tyre = F.pickFault('my car pulls to the left', { lines: [{ type: 'ADVISORY', text: 'Offside Front Tyre worn close to legal limit (5.2.3 (e))' }] });
  const worn = (f) => f.suspects.find((s) => s.id === 'tyre_worn');
  assert.ok(worn(tyre).likely > worn(F.pickFault('my car pulls to the left')).likely && worn(tyre).mot, 'a tyre near the limit raises the worn tyre');
  const edge = F.pickFault('my car pulls to the left', { lines: [{ type: 'ADVISORY', text: 'Offside Front Tyre worn on its inner edge (5.2.3 (e))' }] });
  assert.equal(edge.suspects[0].id, 'alignment', 'a tyre worn on its edge points to the alignment');
  const rust = F.pickFault('a clunk over speed bumps', { lines: [{ type: 'MAJOR', text: 'Offside Front Coil spring fractured or seriously weakened (5.3.1 (b) (i))' }] });
  assert.equal(rust.suspects[0].id, 'spring_broken', 'a failure counts more than an advisory');
  const lamp = F.pickFault('number plate light not working', { lines: [{ type: 'MAJOR', text: 'Registration plate lamp inoperative in the case of a single lamp (4.7.1 (b) (ii))' }] });
  assert.ok(lamp.suspects[0].mot, 'a lamp the MOT named');
  assert.ok(P.motFor('subframe', [{ type: 'ADVISORY', text: 'Nearside Sill corroded but not seriously weakened' }]).length === 1, 'corrosion points to the floor and sills');
  const ev = F.pickFault('white smoke from the exhaust', { electric: true });
  assert.ok(ev.dropped >= 1 && ev.suspects.every((s) => !s.parts.every((p) => P.PARTS[p].ice)), 'an electric car has no exhaust to blame');
});

test('the view words open the views, and nothing else does', () => {
  const yes = [['open the bonnet', 'bay'], ['Open the hood', 'bay'], ['show me the engine', 'bay'], ['can you open the bonnet?', 'bay'], ["what's under the bonnet", 'bay'], ['show me the brakes', 'wheel'], ['take a wheel off', 'wheel'], ["what's under it", 'under'], ['show me underneath', 'under'], ['show me the car', 'car'], ['close the bonnet', 'car']];
  for (const [w, v] of yes) assert.equal(F.viewAsked(w), v, `"${w}"`);
  for (const w of ['open the door', 'show me the news', "what's under the sofa", 'show me the engine of a Boeing 747', 'show me the wheel of fortune', 'open the bonnet of the box and tell me', 'the brakes are squealing']) assert.equal(F.viewAsked(w), null, `"${w}"`);
  assert.equal(F.whoseIn("my dad's car makes a grinding noise"), 'dad');
  assert.equal(F.whoseIn("Haris's van won't start"), 'haris');
  assert.equal(F.whoseIn('my car is overheating'), 'me');
  assert.equal(F.whoseIn('grinding when I brake'), '');
});
