// THE WORKING ENGINE (BRIEF-WORKING-ENGINE; OWNER-ISSUES 91a, 164 and the audit's "the working 3-D engine"): the engine model made from the
// CarSpec (apps/web/src/car/engine.ts, pure: no three.js, no page):
//  - from three CarSpecs (a 1.0 petrol three, a 2.0 diesel four with a turbo, an electric car) it has the parts the layout needs, and
//    every part has an id (with its sheet in car/parts.ts), a name, a place and a size;
//  - the piston at 0°, 90°, 180° and 360° by the rod geometry, not a sine (at 90° it is below the middle of its stroke);
//  - the valves: closed at top dead centre of the power stroke, both a little open at exhaust top dead centre (the overlap);
//  - the firing order and the stroke names over 720° for the three, the four and the six;
//  - the whole of it inside the bay box (body.ts), whatever the car;
//  - every number in the sheets carries estimate, typical or the MOT record; no word "certified" but the ESTIMATE line's;
//  - TAKE APART's layers: the head goes first, the pistons go with their rods, the block stays.
// Bundles are built here with esbuild's API (as car.test.mjs does).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: [at('../../web/src/car/spec.ts'), at('../../web/src/car/parts.ts'), at('../../web/src/car/engine.ts'), at('../../web/src/car/body.ts'), at('../../web/src/engine3d/shapes.ts')],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outdir: at('./.build/workingengine'),
  outbase: at('../../web/src'),
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning',
});
const S = await import('./.build/workingengine/car/spec.mjs');
const P = await import('./.build/workingengine/car/parts.mjs');
const E = await import('./.build/workingengine/car/engine.mjs');
const B = await import('./.build/workingengine/car/body.mjs');
const SH = await import('./.build/workingengine/engine3d/shapes.mjs');
const src = (f) => readFileSync(at(`../../web/src/${f}`), 'utf8');

const car = (f) => S.specFrom({ plate: 'GH17 OST', ...f });
const model = (f) => E.engineModel(E.factsOf(car(f)));
const three = () => model({ make: 'FORD', model: 'FIESTA', colour: 'Blue', fuel: 'Petrol', year: 2009 });
const diesel = () => model({ make: 'VOLKSWAGEN', model: 'GOLF', colour: 'Grey', fuel: 'Diesel', year: 2016, engineCc: 1968 });
const electric = () => model({ make: 'TESLA', model: 'MODEL 3', colour: 'White', fuel: 'Electric', year: 2021 });
const six = () => model({ make: 'BMW', model: '330D', colour: 'Black', fuel: 'Diesel', year: 2014 });
const count = (m, id) => m.pieces.filter((p) => p.id === id).length;
const ids = (m) => new Set(m.pieces.map((p) => p.id));

// ---------------------------------------------------------------- the model from the car

test('a 1.0 petrol three has the parts a petrol three needs, each with an id, a sheet, a name and a size', () => {
  const m = three();
  assert.equal(m.layout, 'I3');
  assert.equal(m.cyl, 3);
  assert.equal(m.diesel, false);
  assert.equal(m.turbo, false);
  assert.equal(m.ccFrom, 'typical');
  // a petrol three: three of each cylinder part, plugs and coils (no injectors), two cams, a belt or a chain, the casing and the end of the engine
  for (const id of ['piston', 'piston_rings', 'con_rod', 'inlet_valve', 'exhaust_valve', 'plugs', 'coils']) assert.equal(count(m, id), 3, `${id}: one a cylinder`);
  assert.equal(count(m, 'valve_spring'), 6, 'a spring for each valve');
  assert.equal(count(m, 'injectors'), 0);
  assert.equal(count(m, 'camshaft') >= 2, true, 'two camshafts (and their sprockets)');
  for (const id of ['block', 'head', 'head_gasket', 'sump', 'crankshaft', 'flywheel', 'timing_belt', 'timing_tensioner', 'inlet_manifold', 'throttle_body', 'exhaust_manifold', 'alternator', 'water_pump', 'oil_filter', 'oil_pump', 'starter', 'drive_belt', 'oil_passages', 'coolant_passages', 'engine_cover', 'oil_cap', 'dipstick', 'thermostat', 'aircon_compressor']) assert.ok(count(m, id) >= 1, `${id}: the engine has one`);
  assert.equal(count(m, 'turbo'), 0);
  for (const p of m.pieces) {
    assert.ok(P.PARTS[p.id], `${p.id}: a sheet in car/parts.ts`);
    assert.ok(p.inst && p.inst.length > 2, `${p.id}: a name`);
    assert.ok(p.prims.length > 0 && p.prims.every((q) => q.s.every((v) => v > 0)), `${p.inst}: a size`);
    assert.ok(P.isPart(p.id) && P.viewOf(p.id) !== 'wheel', `${p.id}: a part of the engine's own views`);
  }
  assert.match(m.words, /three-cylinder petrol engine/);
  // the same small petrol from 2015 is typically turbocharged (the year makes one typical)
  assert.equal(model({ make: 'FORD', model: 'FIESTA', fuel: 'Petrol', year: 2015 }).turbo, true);
  assert.ok(m.bore > 0.065 && m.bore < 0.08 && m.stroke > 0.07 && m.stroke < 0.09, `a 1.0 three's bore and stroke: ${m.bore} × ${m.stroke}`);
});

test('a 2.0 diesel four with a turbo: four injectors and a rail, a turbo and its pipe, no plugs and no coils', () => {
  const m = diesel();
  assert.equal(m.layout, 'I4');
  assert.equal(m.cyl, 4);
  assert.equal(m.diesel, true);
  assert.equal(m.turbo, true);
  assert.equal(m.ccFrom, 'record');
  assert.equal(m.cc, 1968);
  assert.equal(count(m, 'injectors'), 4);
  assert.equal(count(m, 'fuel_rail'), 1);
  assert.equal(count(m, 'plugs') + count(m, 'coils'), 0);
  assert.equal(count(m, 'turbo'), 1);
  assert.equal(count(m, 'intercooler_pipe'), 1);
  assert.equal(count(m, 'piston'), 4);
  assert.equal(count(m, 'con_rod'), 4);
  // a diesel has the taller block (a longer stroke), and its compression is higher
  assert.ok(m.stroke > three().stroke, 'a diesel stroke is longer than the small petrol’s');
  assert.ok(m.comp > 15 && three().comp < 12, 'a diesel squeezes harder');
  assert.match(m.words, /four-cylinder diesel engine/);
  for (const p of m.pieces) assert.ok(P.PARTS[p.id] && p.inst && p.prims.length, `${p.id}: id, sheet, name, size`);
});

test('an electric car has the motor, the inverter, the charger and the coolant loop; no strokes and no pistons', () => {
  const m = electric();
  assert.equal(m.layout, 'EV');
  assert.equal(m.electric, true);
  assert.equal(m.cyl, 0);
  for (const id of ['motor', 'inverter', 'charger', 'coolant_loop', 'engine_cover']) assert.ok(count(m, id) >= 1, `${id}: the electric car has one`);
  for (const id of ['piston', 'con_rod', 'inlet_valve', 'plugs', 'timing_belt', 'alternator', 'turbo']) assert.equal(count(m, id), 0, `${id}: not on an electric car`);
  assert.deepEqual(m.firing, []);
  assert.ok(m.pieces.some((p) => p.motion.k === 'spin'), 'the motor turns');
  assert.match(E.engineLine(m), /^A typical electric motor for a car like yours, a first estimate; not your exact motor\./);
  // a hybrid has both, said in one line
  const h = model({ make: 'TOYOTA', model: 'PRIUS', fuel: 'Hybrid', year: 2018 });
  assert.equal(h.hybrid, true);
  assert.ok(count(h, 'piston') === 4 && count(h, 'motor') >= 1 && count(h, 'inverter') === 1, 'a hybrid has the engine and the motor');
  assert.match(E.engineLine(h), /A hybrid has an electric motor beside it, drawn too\./);
});

test('every part the model uses is one the car’s own part list has, and every new part has its whole sheet', () => {
  const all = [...ids(three()), ...ids(diesel()), ...ids(electric()), ...ids(six())];
  for (const id of all) assert.ok(P.BAY_IDS.includes(id) || P.UNDER_IDS.includes(id), `${id}: in the bay's list (or the underneath's: the sump, the starter)`);
  for (const id of P.BAY_IDS) {
    const s = P.PARTS[id];
    assert.ok(s.name && s.what.length > 20 && s.check.length > 20 && s.looks && s.cost[0] < s.cost[1], `${id}: a whole sheet`);
  }
  for (const id of ['block', 'head', 'piston', 'con_rod', 'crankshaft', 'camshaft', 'timing_belt', 'motor']) assert.ok(P.BAY_IDS.includes(id), `${id} is a new id in the bay's list`);
});

// ---------------------------------------------------------------- the motion

test('the piston at 0°, 90°, 180° and 360° by the rod geometry, not a sine', () => {
  const m = three();
  const rise = (th) => E.pistonRise(m, 0, th);
  assert.ok(Math.abs(rise(0) - m.stroke) < 1e-9, 'top dead centre at 0°: the whole stroke up');
  assert.ok(Math.abs(rise(180)) < 1e-9, 'bottom dead centre at 180°');
  assert.ok(Math.abs(rise(360) - m.stroke) < 1e-9, 'top again at 360°');
  // by the rod: at 90° the piston has already gone more than half way down (the rod swings): below the middle, by a few millimetres
  const mid = m.stroke / 2;
  assert.ok(rise(90) < mid - 0.002, `at 90° it is below the middle (${(rise(90) * 1000).toFixed(1)} mm of ${(m.stroke * 1000).toFixed(1)} mm, the middle is ${(mid * 1000).toFixed(1)}): a sine would sit exactly on it`);
  assert.ok(rise(90) > mid - 0.012, 'but not by much');
  // the same on the way up: at 270° it is as low as at 90°, and symmetric about the bottom
  assert.ok(Math.abs(rise(270) - rise(90)) < 1e-9);
  // the rod's length is constant: the geometry is a rigid rod from the crank's pin to the piston's pin
  const r = m.stroke / 2;
  for (const th of [0, 37, 90, 123, 180, 251, 300, 360]) {
    const s = E.pistonS(m, 0, th);
    const a = (th * Math.PI) / 180;
    assert.ok(Math.abs(Math.hypot(r * Math.sin(a), s - r * Math.cos(a)) - m.rod) < 1e-9, `the rod keeps its length at ${th}°`);
  }
});

test('valve lift: zero at top dead centre of the power stroke; both a little open at exhaust top dead centre (the overlap)', () => {
  // c is a cylinder's own 720°: 0 the start of its power stroke (top dead centre), 360 the end of its exhaust stroke (top dead centre)
  assert.equal(E.valveLift(true, 0), 0);
  assert.equal(E.valveLift(false, 0), 0);
  assert.equal(E.valveLift(true, 720), 0);
  assert.ok(E.valveLift(true, 360) > 0 && E.valveLift(false, 360) > 0, 'at exhaust top dead centre both valves are a little open');
  for (const c of [350, 360, 370]) assert.ok(E.valveLift(true, c) > 0 && E.valveLift(false, c) > 0, `overlap at ${c}°`);
  // each is fully open once in the cycle: the exhaust on the way up (the exhaust stroke), the inlet on the way down (the intake stroke)
  const max = (intake) => Math.max(...Array.from({ length: 720 }, (_, c) => E.valveLift(intake, c)));
  assert.ok(Math.abs(max(true) - E.VALVE.intake.lift) < 1e-4 && Math.abs(max(false) - E.VALVE.exhaust.lift) < 1e-4);
  assert.ok(E.valveLift(true, 465) > E.valveLift(true, 400) && E.valveLift(false, 255) > E.valveLift(false, 200));
  // both closed through the whole of the power stroke and compression: the exhaust valve outside 135–375, the inlet outside 345–585
  for (const c of [0, 90, 130, 380, 450, 600, 700]) assert.equal(E.valveLift(false, c), 0, `the exhaust valve is shut at ${c}°`);
  for (const c of [0, 90, 180, 300, 340, 590, 700]) assert.equal(E.valveLift(true, c), 0, `the inlet valve is shut at ${c}°`);
  // the engine's own valves follow the same table: at the start of cylinder one's power stroke every valve is shut
  const m = three();
  for (const p of m.pieces.filter((x) => x.motion.k === 'valve')) assert.ok(Math.abs(E.poseOf(m, p, m.fire[p.motion.i]).pos[1]) < 1e-12, `${p.inst} shut at the top of its power stroke`);
});

test('the strokes and the firing order over 720° for the three, the four and the six', () => {
  const cases = [
    [three(), [1, 2, 3]],
    [diesel(), [1, 3, 4, 2]],
    [six(), [1, 5, 3, 6, 2, 4]],
  ];
  for (const [m, order] of cases) {
    assert.deepEqual(m.firing, order, `${m.layout}: the firing order`);
    assert.equal(E.firingWords(m), order.join('-'));
    // cylinder one: power, exhaust, intake, compression, a quarter of the cycle each: 180° apiece
    const names = [90, 270, 450, 630].map((th) => E.strokeAt(m, 0, th));
    assert.deepEqual(names, ['POWER', 'EXHAUST', 'INTAKE', 'COMPRESSION'], `${m.layout}: cylinder one's four strokes`);
    // each cylinder's power stroke starts in the firing order, evenly spread over the 720°
    order.forEach((cyl, k) => {
      const th = (k * 720) / m.cyl;
      assert.equal(E.cycleAt(m, cyl - 1, th), 0, `${m.layout}: cylinder ${cyl} fires at ${th}°`);
      assert.equal(E.strokeAt(m, cyl - 1, th + 1), 'POWER');
      assert.ok(E.powerCylinders(m, th + 1).includes(cyl), `${m.layout}: cylinder ${cyl} is on its power stroke at ${th + 1}°`);
    });
    // every cylinder passes through all four strokes in the 720°, in order
    for (let i = 0; i < m.cyl; i++) {
      const seq = [];
      for (let th = 0; th < 720; th += 10) {
        const s = E.strokeAt(m, i, th);
        if (seq[seq.length - 1] !== s) seq.push(s);
      }
      const cycle = ['POWER', 'EXHAUST', 'INTAKE', 'COMPRESSION'];
      const at0 = cycle.indexOf(seq[0]);
      assert.deepEqual(seq.slice(0, 4), [0, 1, 2, 3].map((k) => cycle[(at0 + k) % 4]), `${m.layout}: cylinder ${i + 1} goes round in order`);
    }
    // the pistons agree: a cylinder at the top of its power stroke is at the top of its travel
    for (let i = 0; i < m.cyl; i++) assert.ok(Math.abs(E.pistonRise(m, i, m.fire[i]) - m.stroke) < 1e-9, `${m.layout}: piston ${i + 1} is at the top as its power stroke starts`);
  }
  // the vee six and the vee eight go round in their own order too
  assert.deepEqual(model({ make: 'AUDI', model: 'S4', fuel: 'Petrol', year: 2018 }).firing, [1, 4, 2, 5, 3, 6]);
  assert.deepEqual(model({ make: 'FORD', model: 'MUSTANG', fuel: 'Petrol', year: 2018 }).firing, [1, 8, 4, 3, 6, 5, 7, 2]);
});

test('the belt’s pulleys turn at their ratios to the crank; the cams at half', () => {
  const m = three();
  const spin = (inst) => m.pieces.find((p) => p.inst === inst).motion.ratio;
  assert.equal(spin('Crankshaft'), 1);
  assert.equal(spin('Flywheel'), 1);
  assert.equal(spin('Inlet camshaft'), 0.5);
  assert.equal(spin('Exhaust camshaft'), 0.5);
  assert.ok(Math.abs(spin('Alternator pulley') - 0.055 / 0.027) < 1e-9, 'the alternator, by its smaller pulley');
  assert.ok(Math.abs(E.poseOf(m, m.pieces.find((p) => p.inst === 'Inlet camshaft'), 720).rx - E.poseOf(m, m.pieces.find((p) => p.inst === 'Inlet camshaft'), 0).rx - Math.PI * 2) < 1e-9, 'a cam turns once for two turns of the crank');
});

// ---------------------------------------------------------------- the fit

test('the whole engine fits inside the car’s bay box (body.ts), whatever the car', () => {
  const cars = [
    { make: 'FORD', model: 'FIESTA', fuel: 'Petrol', year: 2015 },
    { make: 'VOLKSWAGEN', model: 'GOLF', fuel: 'Diesel', year: 2016, engineCc: 1968 },
    { make: 'TESLA', model: 'MODEL 3', fuel: 'Electric', year: 2021 },
    { make: 'BMW', model: '330D', fuel: 'Diesel', year: 2014 },
    { make: 'AUDI', model: 'S4', fuel: 'Petrol', year: 2018 },
    { make: 'FORD', model: 'MUSTANG', fuel: 'Petrol', year: 2018 },
    { make: 'TOYOTA', model: 'PRIUS', fuel: 'Hybrid', year: 2018 },
    { make: 'LAND ROVER', model: 'DISCOVERY', fuel: 'Diesel', year: 2018 },
    { make: 'FORD', model: 'TRANSIT CONNECT', fuel: 'Diesel', year: 2017 },
    { make: 'MAZDA', model: 'MX-5', fuel: 'Petrol', year: 2016 },
    { make: 'NISSAN', model: 'QASHQAI', fuel: 'Petrol', year: 2019, engineCc: 1332 },
    { make: 'SKODA', model: 'OCTAVIA ESTATE', fuel: 'Diesel', year: 2015 },
  ];
  for (const f of cars) {
    const spec = car(f);
    const m = E.engineModel(E.factsOf(spec));
    const bay = B.bayBoxOf(spec);
    const pl = E.placeInBay(m, bay);
    const where = `${f.make} ${f.model} (${m.layout}, scale ${pl.scale.toFixed(2)})`;
    assert.ok(pl.min[0] >= bay.rear - 1e-9 && pl.max[0] <= bay.front + 1e-9, `${where}: inside along the car`);
    assert.ok(pl.min[2] >= -bay.halfW - 1e-9 && pl.max[2] <= bay.halfW + 1e-9, `${where}: inside across the bay`);
    assert.ok(pl.min[1] >= bay.floor - E.SUMP_WELL - 1e-9 && pl.max[1] <= bay.top + 1e-9, `${where}: inside from the sump well to the bonnet`);
    // shrunk only if it had to be, and then only a little
    assert.ok(pl.scale >= 0.8 && pl.scale <= 1, `${where}: drawn at its own size (or within a fifth of it, in a short van’s bay)`);
  }
});

// ---------------------------------------------------------------- the words

test('every number in the sheets carries estimate, typical or the MOT record; nothing is certified but the ESTIMATE line', () => {
  const word = /\b(?:estimate|typical|from the MOT record)\b/;
  for (const m of [three(), diesel(), electric(), six(), model({ make: 'FORD', model: 'MUSTANG', fuel: 'Petrol', year: 2018 }), model({ make: 'TOYOTA', model: 'PRIUS', fuel: 'Hybrid', year: 2018 })]) {
    for (const id of ids(m)) {
      for (const line of E.numbersFor(m, id)) {
        assert.ok(word.test(line), `${m.layout} ${id}: “${line}” says nothing of where its number came from`);
        assert.ok(!/certified/i.test(line), `${id}: “certified”`);
      }
    }
  }
  // a displacement from the record is said to be from it; a typical one is said to be typical
  assert.ok(E.numbersFor(diesel(), 'block').some((l) => /Displacement 2\.0 litres, from the MOT record/.test(l)));
  assert.ok(E.numbersFor(three(), 'block').some((l) => /Displacement 1\.0 litres, typical for this size/.test(l)));
  assert.ok(E.numbersFor(three(), 'timing_belt').some((l) => /Change about every 5 years or 60,000 miles, typical/.test(l)), 'the belt’s change interval, typical');
  assert.ok(E.numbersFor(three(), 'plugs').some((l) => /Gap about 0\.8 mm, typical/.test(l)), 'the plug gap, typical');
  assert.ok(E.numbersFor(three(), 'piston').some((l) => /Compression ratio [\d.]+ to 1, typical/.test(l)));
  // no word "certified" in the engine's code, the new sheets or the numbers: it is said once, in the ESTIMATE line (engine3d/scene.ts)
  assert.ok(!/certified/i.test(src('car/engine.ts')) && !/certified/i.test(src('car/enginemesh.ts')), 'no "certified" in the engine’s code');
  for (const id of P.BAY_IDS) {
    const s = P.PARTS[id];
    assert.ok(!/certified/i.test(`${s.name} ${s.what} ${s.check} ${s.covers} ${s.looks}`), `${id}: no "certified" on a sheet`);
  }
  assert.match(src('engine3d/scene.ts'), /export const ESTIMATE = 'Every size here is a first estimate, never certified\.'/);
  // the one honest line, for the bay: "a typical N-cylinder petrol engine for a car like yours, a first estimate; not your exact engine."
  assert.match(E.engineLine(three()), /^A typical three-cylinder petrol engine for a car like yours, a first estimate; not your exact engine\.$/);
  assert.match(E.engineLine(diesel()), /^A typical four-cylinder diesel engine for a car like yours, a first estimate; not your exact engine\.$/);
  // "typical", never "yours"
  for (const m of [three(), diesel(), six()]) assert.ok(!/your engine/.test(E.engineLine(m).replace('not your exact engine', '')), 'never “your engine”');
});

test('the table of common UK engines: the record’s displacement first, then the table, then the car’s size and fuel; never “yours”', () => {
  const lay = (f) => model(f).layout;
  assert.equal(lay({ make: 'BMW', model: '330D', fuel: 'Diesel' }), 'I6');
  assert.equal(lay({ make: 'AUDI', model: 'S4', fuel: 'Petrol' }), 'V6');
  assert.equal(lay({ make: 'FORD', model: 'MUSTANG', fuel: 'Petrol' }), 'V8');
  assert.equal(lay({ make: 'FORD', model: 'FIESTA', fuel: 'Petrol' }), 'I3', 'a small petrol is a three');
  assert.equal(lay({ make: 'VOLKSWAGEN', model: 'GOLF', fuel: 'Petrol' }), 'I4', 'a family petrol is a four');
  assert.equal(lay({ make: 'VAUXHALL', model: 'CORSA', fuel: 'Petrol', engineCc: 998 }), 'I3', 'the record’s 1.0 is a three');
  assert.equal(lay({ make: 'VAUXHALL', model: 'ASTRA', fuel: 'Diesel', engineCc: 1598 }), 'I4');
  assert.equal(lay({ make: 'VOLVO', model: 'XC90', fuel: 'Petrol', engineCc: 2998 }), 'I6', 'a 3.0 Volvo is a straight six');
  assert.equal(lay({ make: 'SKODA', model: 'SUPERB', fuel: 'Petrol', engineCc: 2995 }), 'V6');
  assert.equal(lay({ make: 'FORD', model: 'KA', fuel: 'Electric' }), 'EV');
  assert.equal(model({ make: 'FORD', model: 'FIESTA', fuel: 'Petrol', engineCc: 1242 }).cc, 1242, 'the record’s size is the engine’s size');
  // a car with no record at all still has an engine, typical for its size
  const none = E.engineModel(E.factsOf(S.specFrom(null)));
  assert.ok(none.cyl >= 3 && none.ccFrom === 'typical');
});

// ---------------------------------------------------------------- take apart, and the 3-D ENGINE's engine

test('TAKE APART: the head flies first, valves and cams next, the pistons with their rods, the block stays', () => {
  const m = diesel();
  const layer = (id) => m.pieces.filter((p) => p.id === id);
  const head = layer('head')[0];
  const block = layer('block')[0];
  assert.deepEqual(block.ex, [0, 0, 0], 'the block does not move');
  assert.ok(head.ex[1] > 0.2 && head.start === 0, 'the head goes up, and first');
  // at half way the head is clear of the block; the valves and cams have started; the pistons are later still
  assert.ok(E.flown(head, 0.5) >= 0.5 && E.flown(layer('inlet_valve')[0], 0.5) > 0 && E.flown(layer('piston')[0], 0.5) > 0);
  assert.ok(E.flown(head, 0.15) > E.flown(layer('piston')[0], 0.15), 'the head is ahead of the pistons');
  assert.equal(E.flown(head, 1), 1);
  assert.equal(E.flown(head, 0), 0);
  // each piston goes with its rod: the same way, the same distance, the same start
  for (let i = 1; i <= m.cyl; i++) {
    const p = m.pieces.find((x) => x.id === 'piston' && x.cyl === i);
    const r = m.pieces.find((x) => x.id === 'con_rod' && x.cyl === i);
    assert.deepEqual(p.ex, r.ex);
    assert.equal(p.start, r.start);
    assert.equal(p.layer, 3);
    assert.equal(m.pieces.find((x) => x.id === 'piston_rings' && x.cyl === i).start, p.start, 'its rings too');
  }
  for (const p of [...layer('inlet_valve'), ...layer('exhaust_valve'), ...layer('camshaft')]) assert.ok(p.layer === 2, `${p.inst}: layer two`);
  assert.ok(layer('head').every((p) => p.layer === 1) && layer('exhaust_manifold').every((p) => p.layer === 1));
  // SECTION cuts the casing and shows the channels
  assert.ok(m.pieces.filter((p) => p.shell).map((p) => p.id).sort().join() === ['block', 'head', 'sump'].sort().join(), 'the casing: block, head, sump');
  assert.ok(m.pieces.filter((p) => p.passage).map((p) => p.id).sort().join() === ['coolant_passages', 'oil_passages'].join(), 'the channels show only in the cutaway');
});

test('the 3-D ENGINE’s tray gets an engine: its primitives, its named parts, in the object’s size', () => {
  const parts = SH.engineParts({ w: 120, d: 60, h: 70 });
  assert.ok(parts.length > 40, `${parts.length} named parts`);
  assert.ok(parts.some((p) => p.name === 'Piston 2') && parts.some((p) => p.name === 'Crankshaft') && parts.some((p) => p.name === 'Engine block'));
  const prims = SH.primsOf({ kind: 'engine', w: 120, d: 60, h: 70 });
  assert.ok(prims.length > 100);
  // inside its box (w × d × h) on the ground
  const tri = SH.triangles(prims);
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < tri.positions.length; i += 3) for (let a = 0; a < 3; a++) {
    min[a] = Math.min(min[a], tri.positions[i + a]);
    max[a] = Math.max(max[a], tri.positions[i + a]);
  }
  assert.ok(max[0] - min[0] <= 1.2 + 1e-6 && max[1] - min[1] <= 0.7 + 1e-6 && max[2] - min[2] <= 0.6 + 1e-6, `inside 120 × 60 × 70 cm: ${max.map((v, a) => ((v - min[a]) * 100).toFixed(0))}`);
  assert.ok(min[1] > -1e-6 && min[1] < 0.01, 'standing on the ground');
  // smaller, smaller
  const small = SH.triangles(SH.primsOf({ kind: 'engine', w: 60, d: 30, h: 35 }));
  const top = (t) => Math.max(...t.positions.filter((_, i) => i % 3 === 1));
  assert.ok(top(small) < top(tri) * 0.6, 'a resized engine is smaller');
  assert.match(src('engine3d/scene.ts'), /kind: 'engine', name: 'Engine', w: 120, d: 60, h: 70/);
});

test('the Stage and the show-me words: "how does an engine work" is a part, the engine', async () => {
  await build({ entryPoints: [at('../../web/src/show/parts.ts')], bundle: true, format: 'esm', platform: 'neutral', outdir: at('./.build/workingengine'), outbase: at('../../web/src'), outExtension: { '.js': '.mjs' }, logLevel: 'warning' });
  const Pa = await import('./.build/workingengine/show/parts.mjs');
  for (const ask of ['how does an engine work', 'show me the four strokes', 'show me a turbo', 'show me an engine', 'draw me a car engine']) {
    const p = Pa.partAsked(ask);
    assert.ok(p && p.kind === 'engine', `“${ask}” is the engine`);
  }
  assert.equal(Pa.partAsked('show me a turbo').turbo, true);
  assert.equal(Pa.partAsked('how much does an engine cost'), null, 'a price question is not a picture');
  assert.ok(Pa.partBoxes('engine', Pa.ENGINE_PART.dims).length >= 8, 'the Stage draws the engine as its main masses');
  // the ten parts of a room are the ten they were
  assert.equal(Pa.PARTS.length, 10);
});
