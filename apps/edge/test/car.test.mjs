// THE CAR IN 3-D (BRIEF-CAR, batch ⑤ part 1; OWNER-ISSUES 91a "i have this car and this is what's wrong with it"):
//  - the CarSpec from the vehicle facts the check gives, for six real-shaped cases: a hatchback, a saloon, an estate, an
//    SUV, a van, and a model I do not know (a sensible fallback, said to be a guess: `exact: false`); the paint from the
//    colour word; the proportions of a real car of that shape;
// Bundles are built here with esbuild's API (as catalogue.test.mjs does).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: [at('../../web/src/car/spec.ts')],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outdir: at('./.build/car'),
  outbase: at('../../web/src/car'),
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning',
});
const S = await import('./.build/car/spec.mjs');

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
