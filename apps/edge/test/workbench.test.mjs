// THE WORKBENCH's solvers (OWNER-ISSUES 61b; packages/shared/src/workbench, bundled by the test script into .build/workbench.mjs):
// each against its textbook cases — beams (PL³/48EI, 5wL⁴/384EI, PL³/3EI, PL³/192EI), Euler π²EI/(KL)², a known UB's section
// properties, a 3-stage gear train and a 50/11 bicycle gear, the Otto efficiency and a 2.0 L engine's power, the standard
// atmosphere, a Cessna-like wing and a hatchback's drag, the vacuum range v²sin2θ/g and the ISS's period, escape velocity, a
// brick wall's U-value and a room's heat loss, the sun at Greenwich and Birmingham, a parallel pair and an LED's resistor —
// then the units' round trips, the answer's shape (≤ 900 characters, every caveat "not certified", the confidence words), a
// case outside a formula's range that says so and stops, and inputs that are not numbers at all (never a throw).
import { test } from 'node:test';
import assert from 'node:assert/strict';

const W = await import('./.build/workbench.mjs');

const close = (got, want, rel, what) => assert.ok(Math.abs(got - want) <= Math.abs(want) * rel, `${what}: ${got} vs ${want} (±${rel * 100}%)`);
const within = (got, lo, hi, what) => assert.ok(got >= lo && got <= hi, `${what}: ${got} not in ${lo}..${hi}`);
const E = 210e9;

test('units: every unit round-trips through SI; his ways of writing a quantity are read; a lone number needs its unit', () => {
  for (const u of W.UNITS) {
    for (const x of [0.37, 12, 4500]) {
      const back = W.fromSI(W.toSI(x, u.u, u.k), u.u, u.k);
      close(back, x, 1e-12, `${u.u} (${u.k})`);
    }
  }
  const q = (t, k, b) => W.parseQuantity(t, k, b)?.si;
  close(q('5 kN', 'force'), 5000, 1e-12, '5 kN');
  close(q('5kN'), 5000, 1e-12, '5kN');
  close(q('1,200 mm', 'length'), 1.2, 1e-12, '1,200 mm');
  close(q('70 mph'), 31.29277, 1e-6, '70 mph');
  close(q('-5 °C', 'temperature'), 268.15, 1e-12, '-5 °C');
  close(q('20 K', 'deltaT'), 20, 1e-12, 'a 20 K difference is 20 K, not −253 °C');
  close(q('36 °F', 'deltaT'), 20, 1e-12, 'a 36 °F difference');
  close(q('6 ft 2 in'), 1.8796, 1e-9, '6 ft 2 in');
  close(q('4k7', 'resistance'), 4700, 1e-12, '4k7');
  close(q('20 mA', 'current'), 0.02, 1e-12, '20 mA');
  close(q('150 bhp'), 111855, 1e-4, '150 bhp');
  close(q('2.0 litres', 'volume'), 0.002, 1e-12, '2.0 litres');
  close(q('220 lb ft'), 298.28, 1e-4, '220 lb ft');
  close(q('3', 'length', 'm'), 3, 1e-12, 'a bare 3 in metres');
  assert.equal(W.parseQuantity('3', 'length'), null, 'a bare number with no unit given is not read');
  assert.equal(W.parseQuantity('five kN', 'force'), null);
  assert.equal(W.parseQuantity('5 kg', 'force'), null, 'a mass is not a force');
  assert.equal(W.fmt(5000, 'kN'), '5 kN');
  assert.equal(W.fmt(0.2009, 'mm'), '201 mm');
  assert.equal(W.show(0.0002009, 'length', 'metric'), '0.201 mm');
  assert.equal(W.show(5000, 'force', 'imperial'), '1,120 lbf');
  assert.equal(W.show(293.15, 'temperature', 'imperial'), '68 °F');
  assert.equal(W.num(122.727), '123');
  assert.equal(W.num(12345.6), '12,300', 'three figures: a first estimate claims no more');
  assert.equal(W.num(1800, 4), '1,800');
  // what a card shows reads back (to its three figures)
  for (const [si, k, sys] of [[0.0031, 'length', 'metric'], [31.3, 'speed', 'imperial'], [120_000, 'power', 'metric'], [218, 'torque', 'imperial'], [42e6, 'pressure', 'metric']]) {
    close(W.parseQuantity(W.show(si, k, sys), k).si, si, 0.006, `${W.show(si, k, sys)} reads back`);
  }
});

test('beams: the textbook deflections and moments, superposed loads, the default card, and a UB 203×133×25', () => {
  const rect = { shape: 'rect', b: 0.1, h: 0.2 };
  const I = (0.1 * 0.2 ** 3) / 12;
  const L = 3;
  const P = 5000;
  const w = 2000;
  const b = (x) => W.solveBeam({ span: L, material: 's275', section: rect, ...x });
  close(b({ support: 'simple', load: P, at: L / 2 }).values.deflection, (P * L ** 3) / (48 * E * I), 1e-6, 'PL³/48EI');
  close(b({ support: 'simple', load: P, at: L / 2 }).values.moment, (P * L) / 4, 1e-9, 'PL/4');
  close(b({ support: 'simple', udl: w }).values.deflection, (5 * w * L ** 4) / (384 * E * I), 1e-6, '5wL⁴/384EI');
  close(b({ support: 'simple', udl: w }).values.moment, (w * L * L) / 8, 1e-6, 'wL²/8');
  close(b({ support: 'cantilever', load: P }).values.deflection, (P * L ** 3) / (3 * E * I), 1e-9, 'PL³/3EI');
  close(b({ support: 'cantilever', load: P }).values.moment, P * L, 1e-9, 'PL at the fixed end');
  close(b({ support: 'cantilever', udl: w }).values.deflection, (w * L ** 4) / (8 * E * I), 1e-9, 'wL⁴/8EI');
  close(b({ support: 'fixed', load: P, at: L / 2 }).values.deflection, (P * L ** 3) / (192 * E * I), 1e-6, 'PL³/192EI');
  close(b({ support: 'fixed', load: P, at: L / 2 }).values.moment, (P * L) / 8, 1e-9, 'PL/8');
  close(b({ support: 'fixed', udl: w }).values.deflection, (w * L ** 4) / (384 * E * I), 1e-6, 'wL⁴/384EI');
  close(b({ support: 'fixed', udl: w }).values.moment, (w * L * L) / 12, 1e-6, 'wL²/12 at the ends');
  // a load off centre: the maximum, Pb(L²−b²)^1.5 / (9√3·EIL), where the formula says
  const a = 1;
  const bb = L - a;
  const off = b({ support: 'simple', load: P, at: 2 });
  close(off.values.deflection, (P * a * (L * L - a * a) ** 1.5) / (9 * Math.sqrt(3) * E * I * L), 1e-4, 'off-centre maximum');
  close(off.values.R1, (P * a) / L, 1e-9, 'the reaction nearer the load');
  void bb;
  // superposed: both symmetric, so the midspan deflections add
  close(b({ support: 'simple', load: P, at: L / 2, udl: w }).values.deflection, (P * L ** 3) / (48 * E * I) + (5 * w * L ** 4) / (384 * E * I), 1e-6, 'point + uniform');
  // the default card is the spec's case: 3 m, 5 kN in the middle, S275, 100 × 200
  const d = W.solveBeam({});
  close(d.values.deflection, (P * L ** 3) / (48 * E * I), 1e-6, 'the default beam');
  assert.equal(d.confidence, 'fair', 'defaults taken → fair');
  assert.equal(W.solveBeam({ support: 'simple', span: 3, load: 5000, at: 1.5, material: 's275', section: rect }).confidence, 'good', 'everything given → good');
  assert.match(d.lines.map((l) => `${l.label} ${l.value}`).join('\n'), /Max deflection 0\.201 mm/);
  // its own weight, when asked: ρ·g·A as a uniform load
  close(b({ load: P, selfWeight: true }).values.selfWeight, 7850 * 9.80665 * 0.02, 1e-9, 'self-weight');
  // a UB 203×133×25 (h 203.2, b 133.2, tw 5.7, tf 7.8 mm): the tables give A 32.0 cm², Iy 2,340 cm⁴, Wel,y 230 cm³, Iz 308 cm⁴
  const ub = W.sectionProps({ shape: 'ibeam', h: 0.2032, b: 0.1332, tw: 0.0057, tf: 0.0078 });
  close(ub.A * 1e4, 32.0, 0.03, 'UB area (root fillets ignored)');
  close(ub.Iy * 1e8, 2340, 0.03, 'UB Iy');
  close(ub.Zy * 1e6, 230, 0.03, 'UB Wel,y');
  close(ub.Iz * 1e8, 308, 0.03, 'UB Iz');
  // Euler: π²EI/(KL)² for each end condition, about the weak axis
  const tube = { shape: 'tube', d: 0.1143, t: 0.0036 };
  const It = W.sectionProps(tube).Iy;
  for (const [ends, K] of [['pinned', 1], ['fixed-free', 2], ['fixed-pinned', 0.699], ['fixed', 0.5]]) {
    close(W.solveColumn({ length: 3, ends, material: 's275', section: tube }).values.euler, (Math.PI ** 2 * E * It) / (K * 3) ** 2, 1e-9, `Euler, ${ends}`);
  }
  const strip = W.solveColumn({ length: 2, ends: 'pinned', material: 's275', section: { shape: 'rect', b: 0.1, h: 0.01 } });
  close(strip.values.I, (0.1 * 0.01 ** 3) / 12, 1e-9, 'a flat strip buckles about its weak axis');
});

test('gears: a 3-stage train and a 50/11 bicycle gear', () => {
  const g = W.solveGears({ stages: [{ driver: 20, driven: 60 }, { driver: 15, driven: 45 }, { driver: 10, driven: 40 }], rpm: 1800, torque: 10 });
  close(g.values.ratio, 36, 1e-12, 'overall 36 : 1');
  close(g.values.outRpm, 50, 1e-12, '1,800 rpm → 50');
  close(g.values.outTorque, 10 * 36 * 0.98 ** 3, 1e-12, '10 N·m × 36 × 0.98³');
  assert.equal(g.values.reversed, 1, 'three external meshes: the output turns the other way');
  assert.match(g.lines[0].value, /^36 : 1$/);
  assert.equal(W.solveGears({ stages: [{ kind: 'belt', driver: 100, driven: 200 }] }).values.reversed, 0, 'a belt keeps the direction');
  const bike = W.solveBike({ chainring: 50, sprocket: 11, wheel: 27 * 0.0254, cadence: 90 });
  close(bike.values.inches, 122.727, 1e-4, '50/11 on a 27-inch wheel: 122.7 gear inches');
  close(bike.values.development, Math.PI * 27 * 0.0254 * (50 / 11), 1e-12, 'development');
  assert.ok(W.solveGears({ stages: [{ driver: 3, driven: 40 }] }).problem, 'a 3-tooth gear is not a gear');
});

test('engine: the Otto efficiency at r = 10, a 2.0 L NA at 6,000 rpm, and the reverse', () => {
  close(W.ottoEfficiency(10), 1 - 10 ** -0.4, 1e-12, 'η = 1 − 1/r^(γ−1)');
  close(W.ottoEfficiency(10), 0.6019, 1e-3, 'η ≈ 60.2 %');
  within(W.dieselEfficiency(18, 2), 0.6, 0.66, 'the Diesel cycle at r 18, cut-off 2');
  const e = W.solveEngine({ displacement: 0.002, rpm: 6000, type: 'na' });
  within(e.values.power, 110_000, 130_000, 'a 2.0 L NA at 6,000 rpm');
  assert.equal(e.confidence, 'rough', 'a guessed BMEP is rough');
  assert.match(W.estimateText(e), /guess/);
  close(e.values.torqueRated, (12e5 * 0.002) / (4 * Math.PI), 1e-12, 'T = BMEP·Vd/4π');
  close(W.torqueShape(0.6), 1, 1e-12, 'the torque curve peaks at 60 % of the rated speed');
  const rev = W.solveEngine({ displacement: 0.002, rpm: 6000, type: 'na', power: 120_000 });
  close(rev.values.bmep, 12e5, 1e-12, 'the implied BMEP');
  assert.match(rev.lines[0].note, /about right/);
  assert.match(W.solveEngine({ displacement: 0.002, rpm: 6000, type: 'na', power: 300_000 }).lines[0].note, /optimistic/);
});

test('aero: the standard atmosphere, a Cessna-like wing at 50 m/s, a hatchback at 70 mph, a terminal velocity', () => {
  close(W.isa(0).rho, 1.225, 1e-3, 'ISA density at sea level');
  close(W.isa(10_000).rho, 0.4135, 5e-3, 'ISA density at 10 km');
  close(W.isa(11_000).T, 216.65, 1e-9, 'the tropopause');
  close(W.zeroLiftAngle(0.02, 0.4) * (180 / Math.PI), -2.08, 0.03, 'NACA 2412 zero-lift angle');
  const wing = W.solveWing({ area: 16.2, span: 11, speed: 50, alpha: (4 * Math.PI) / 180, naca: '2412', mass: 1111 });
  within(wing.values.lift, 9000, 15000, 'a Cessna 172-like wing at 50 m/s and 4°');
  close(wing.values.Cdi, wing.values.Cl ** 2 / (Math.PI * 0.8 * (11 * 11) / 16.2), 1e-9, 'Cdi = Cl²/(π·e·AR)');
  assert.ok(wing.lines.some((l) => /Stall speed/.test(l.label)));
  const car = W.solveCar({ cd: 0.3, area: 2.2, speed: 70 * 0.44704 });
  within(car.values.dragPower, 10_000, 15_000, 'a hatchback at 70 mph');
  close(car.values.dragForce, 0.5 * W.isa(0).rho * (70 * 0.44704) ** 2 * 0.66, 1e-9, '½ρv²CdA');
  const fall = W.solveFall({ mass: 80, cd: 1, area: 0.7 });
  close(0.5 * W.isa(0).rho * fall.values.vt ** 2 * 0.7, 80 * 9.80665, 1e-9, 'at terminal velocity the drag is the weight');
  close(W.reynolds(1.225, 50, 1.47, 1.789e-5), 5.03e6, 0.01, 'Reynolds number');
});

test('motion: the vacuum range v²sin2θ/g, drag by RK4, the ISS period, escape velocity, a Hohmann transfer', () => {
  for (const [v, deg] of [[25, 45], [40, 30], [10, 60]]) {
    const th = (deg * Math.PI) / 180;
    close(W.vacuumPath(v, th).range, (v * v * Math.sin(2 * th)) / 9.80665, 1e-12, `vacuum range ${v} m/s at ${deg}°`);
  }
  const vac = W.vacuumPath(25, Math.PI / 4);
  close(W.dragPath(25, Math.PI / 4, 0, 1e-9).range, vac.range, 1e-3, 'RK4 with no drag lands where the vacuum does');
  const ball = W.solveProjectile({ speed: 25, angle: Math.PI / 4 });
  assert.ok(ball.values.range < vac.range && ball.values.range > 0.5 * vac.range, `a football falls short: ${ball.values.range}`);
  const iss = W.solveOrbit({ body: 'earth', altitude: 420_000 });
  within(iss.values.period / 60, 92, 93, 'the ISS at 420 km');
  close(iss.values.surfaceEscape, 11_186, 0.005, 'escape velocity from the Earth: 11.2 km/s');
  const geo = W.solveOrbit({ body: 'earth', altitude: 300_000, to: 35_786_000 });
  within((geo.values.dv1 + geo.values.dv2) / 1000, 3.85, 3.95, 'LEO 300 km → GEO: about 3.9 km/s');
  within(geo.values.transfer / 3600, 5.2, 5.4, 'the transfer takes about 5¼ h');
  close(W.solveOrbit({ body: 'moon', altitude: 0 }).values.surfaceEscape, 2376, 0.01, 'escape from the Moon: 2.38 km/s');
});

test('heat: a solid brick wall’s U-value, a 20 m² room at 20 K, the layers in his words', () => {
  const wall = W.uValue([{ mat: 'brick', thickness: 0.225 }, { mat: 'plaster', thickness: 0.013 }]);
  close(wall.U, 1 / (0.13 + 0.225 / 0.77 + 0.013 / 0.57 + 0.04), 1e-12, 'U = 1/(Rsi + Σd/λ + Rse)');
  within(wall.U, 1.9, 2.2, 'a solid 9-inch brick wall (the tables: about 2.1)');
  const room = W.solveHeat({ wallU: 2, floor: 20, height: 2.4, wall: 10, window: 2, windowU: 2.8, ach: 1.5, inside: 294.15, outside: 274.15, tariff: 0.06 });
  close(room.values.H, 8 * 2 + 2 * 2.8 + 0.33 * 1.5 * 48, 1e-12, 'W/K: walls + window + air');
  close(room.values.loss, (8 * 2 + 2 * 2.8 + 0.33 * 1.5 * 48) * 20, 1e-12, 'the loss at 20 K');
  assert.equal(room.confidence, 'good');
  const layers = W.layersOf('brick 102, cavity 50, block 100, plaster 13');
  assert.deepEqual(layers.map((l) => l.mat), ['brick', 'cavity', 'block', 'plaster']);
  close(W.uValue(layers).U, 1 / (0.13 + 0.102 / 0.77 + 0.18 + 0.1 / 1.13 + 0.013 / 0.57 + 0.04), 1e-12, 'an unfilled cavity wall');
  assert.equal(W.layersOf('unobtainium 50'), null);
});

test('sun: noon at Greenwich on an equinox, midsummer midday at Birmingham, sunrise and the shadow', () => {
  const peak = (lat, lon, day) => {
    let best = -90;
    for (let m = 0; m < 1440; m += 1) best = Math.max(best, W.sunPosition(lat, lon, day + m * 60_000).altitude);
    return best;
  };
  close(peak(51.4769, 0, Date.UTC(2026, 2, 20)), 38.5, 0.013, 'Greenwich on the March equinox (±0.5°)');
  close(peak(52.4862, -1.8904, Date.UTC(2026, 5, 21)), 61, 0.0082, 'Birmingham at midsummer (±0.5°)');
  const london = W.sunTimes(51.5074, -0.1278, Date.UTC(2026, 5, 21, 12));
  const hm = (ms) => new Date(ms).getUTCHours() * 60 + new Date(ms).getUTCMinutes();
  within(hm(london.rise), 3 * 60 + 40, 3 * 60 + 47, 'London sunrise on 21 June ≈ 04:43 BST');
  within(hm(london.set), 20 * 60 + 18, 20 * 60 + 25, 'London sunset on 21 June ≈ 21:21 BST');
  const s = W.solveSun({ lat: 52.4862, lon: -1.8904, at: Date.UTC(2026, 11, 21, 12, 8), height: 10, tz: 'Europe/London', place: 'Birmingham' });
  close(s.values.shadow, 10 / Math.tan((s.values.altitude * Math.PI) / 180), 1e-12, 'shadow = height ÷ tan(altitude)');
  within(s.values.altitude, 13.5, 14.6, 'midwinter noon at Birmingham: about 14°');
  assert.match(s.lines.find((l) => /Shadow/.test(l.label)).note, /north/, 'a noon shadow in the UK points north');
  assert.equal(W.sunTimes(78.2, 15.6, Date.UTC(2026, 5, 21)).polar, 'day', 'midsummer in Svalbard: the sun never sets');
});

test('circuits: 100 Ω ∥ 100 Ω, an LED from 5 V, Ohm’s law, a divider, an RC time constant', () => {
  close(W.solveCircuit({ mode: 'resistors', rs: [100, 100] }).values.parallel, 50, 1e-12, '100 Ω ∥ 100 Ω = 50 Ω');
  const led = W.solveCircuit({ mode: 'led', supply: 5, vf: 2, current: 0.02 });
  close(led.values.r, 150, 1e-12, 'LED 20 mA from 5 V with Vf 2 V');
  assert.equal(led.values.e12, 150, 'and 150 Ω is an E12 value');
  assert.equal(W.nextE12(151), 180);
  assert.equal(W.nextE12(9.5), 10);
  assert.equal(W.nextE12(820), 820);
  close(W.solveCircuit({ mode: 'ohm', v: 12, r: 4 }).values.i, 3, 1e-12, 'I = V/R');
  close(W.solveCircuit({ mode: 'divider', vin: 9, r1: 10_000, r2: 5_000 }).values.vout, 3, 1e-12, 'a divider');
  close(W.solveCircuit({ mode: 'rc', r: 10_000, c: 100e-6 }).values.tau, 1, 1e-12, 'τ = RC');
  assert.ok(W.solveCircuit({ mode: 'ohm', v: 12 }).problem, "Ohm's law needs two");
  assert.ok(W.solveCircuit({ mode: 'led', supply: 2, vf: 3 }).problem, 'an LED needs more than its forward voltage');
});

test('the answer: every caveat says "not certified", the chat text stays within 900 characters with the caveat whole, the spoken line is one sentence', () => {
  for (const k of W.WORK_KINDS) {
    const e = W.solve(k, {}, 'metric', Date.UTC(2026, 9, 31, 12));
    assert.match(e.caveat, /^First estimate, not certified — /, `${k}: the caveat`);
    assert.ok(['rough', 'fair', 'good'].includes(e.confidence), `${k}: a confidence word`);
    const t = W.estimateText(e);
    assert.ok(t.length <= 900, `${k}: ${t.length} characters`);
    assert.ok(t.endsWith(e.caveat), `${k}: the caveat is last and whole`);
    assert.match(t, /FIRST ESTIMATE · NOT CERTIFIED/);
    assert.ok(!e.problem, `${k}: the defaults solve (${e.problem})`);
    assert.ok(e.lines.length >= 2 && e.assumptions.length && e.method && e.changes.length, `${k}: lines, assumptions, method, changes`);
    assert.doesNotMatch(W.estimateSpoken(e), /\n/);
    assert.match(W.estimateSpoken(e), /^A first estimate, not certified: /);
  }
  for (const k of ['beam', 'column', 'wing']) assert.match(W.caveatFor(k), /A chartered engineer signs this, not me\.$/, `${k}: load-bearing or life-safety`);
  // a long one is shortened, never the caveat
  const long = { ...W.solveBeam({}), assumptions: Array.from({ length: 30 }, (_, i) => `assumption ${i} ${'x'.repeat(40)}`), changes: Array.from({ length: 20 }, () => 'y'.repeat(60)) };
  const t = W.estimateText(long);
  assert.ok(t.length <= 900 && t.endsWith(long.caveat), `${t.length}`);
});

test('a case outside a formula’s range says so and stops; inputs that are not numbers never throw', () => {
  const cases = [
    W.solveBeam({ span: 0 }),
    W.solveBeam({ span: 3, load: 5000, at: 4 }),
    W.solveBeam({ span: 20, load: 500_000, section: { shape: 'rect', b: 0.01, h: 0.01 } }),
    W.solveWing({ alpha: (30 * Math.PI) / 180 }),
    W.solveWing({ alpha: (18 * Math.PI) / 180 }),
    W.solveWing({ naca: 'banana' }),
    W.solveEngine({ displacement: 5 }),
    W.solveOrbit({ altitude: -5 }),
    W.solveHeat({ inside: 280, outside: 290 }),
  ];
  for (const e of cases) {
    assert.ok(e.problem, `${e.title}: stopped`);
    assert.equal(e.lines.length, 0, `${e.title}: no numbers`);
    const t = W.estimateText(e);
    assert.match(t, /not certified/);
    assert.ok(t.length <= 900);
  }
  assert.match(W.solveWing({ alpha: (18 * Math.PI) / 180 }).problem, /stall/);
  for (const k of [...W.WORK_KINDS, 'tunnel', 'nonsense']) {
    for (const junk of [null, { span: 'banana', load: {}, section: 'x', stages: 'x', layers: [null], rs: [null, 'a'] }, { span: Infinity, at: NaN, speed: -1 }]) {
      const e = W.solve(k, junk);
      assert.equal(typeof e.title, 'string', `${k}: an answer`);
      assert.match(e.caveat, /not certified/);
    }
  }
});

test('his words: the kind and the inputs they carry, nothing guessed; what the chat answers with no model', () => {
  const p = (t) => W.parseProblem(t);
  let r = p('3 m steel beam 5 kN in the middle');
  assert.equal(r.kind, 'beam');
  assert.deepEqual({ span: r.inputs.span, load: r.inputs.load, at: r.inputs.at, material: r.inputs.material }, { span: 3, load: 5000, at: 1.5, material: 's275' });
  r = p('how strong is a 3 m steel beam with 5 kn in the middle');
  assert.equal(r.inputs.load, 5000, '"5 kn" on a beam is a force, never five knots');
  assert.equal(r.inputs.span, 3);
  r = p('a 2.4 m timber joist 47x195 with 2 kN/m along it');
  assert.deepEqual({ kind: r.kind, span: r.inputs.span, udl: r.inputs.udl, material: r.inputs.material, sec: r.inputs.section }, { kind: 'beam', span: 2.4, udl: 2000, material: 'c24', sec: { shape: 'rect', b: 0.047, h: 0.195 } });
  r = p('cantilever shelf 600 mm with 20 kg at the end');
  assert.equal(r.inputs.support, 'cantilever');
  close(r.inputs.load, 196.133, 1e-9, 'a mass on a beam is its weight');
  r = p("what's the gear ratio of 50 and 11 teeth");
  assert.deepEqual({ kind: r.kind, stages: r.inputs.stages }, { kind: 'gears', stages: [{ kind: 'gear', driver: 50, driven: 11 }] });
  r = p('gear train 20:60, 15:45 and 10:40 at 1800 rpm');
  assert.deepEqual(r.inputs.stages.map((s) => [s.driver, s.driven]), [[20, 60], [15, 45], [10, 40]]);
  assert.equal(r.inputs.rpm, 1800);
  r = p('bike gear 50/11 on 700c wheels at 90 rpm');
  assert.deepEqual({ kind: r.kind, cr: r.inputs.chainring, sp: r.inputs.sprocket, w: r.inputs.wheel, c: r.inputs.cadence }, { kind: 'bike', cr: 50, sp: 11, w: 0.672, c: 90 });
  r = p('2.0 litre turbo engine at 6000 rpm');
  assert.deepEqual({ kind: r.kind, d: r.inputs.displacement, t: r.inputs.type, rpm: r.inputs.rpm }, { kind: 'engine', d: 0.002, t: 'turbo', rpm: 6000 });
  r = p('led resistor 5v 20ma');
  assert.deepEqual({ kind: r.kind, ...r.inputs }, { kind: 'circuit', mode: 'led', supply: 5, current: 0.02 });
  close(W.solve('circuit', r.inputs).values.r, 150, 1e-12, 'and it solves to 150 Ω');
  r = p('100 and 100 ohm in parallel');
  assert.deepEqual(r.inputs.rs, [100, 100]);
  r = p('orbit at 400 km around mars');
  assert.deepEqual({ kind: r.kind, alt: r.inputs.altitude, body: r.inputs.body }, { kind: 'orbit', alt: 400_000, body: 'mars' });
  r = p('wing naca 4412 at 6 degrees, 60 m/s, 10 m span, 15 m²');
  assert.deepEqual({ kind: r.kind, naca: r.inputs.naca, span: r.inputs.span, area: r.inputs.area, v: r.inputs.speed }, { kind: 'wing', naca: '4412', span: 10, area: 15, v: 60 });
  close(r.inputs.alpha, (6 * Math.PI) / 180, 1e-12, '6 degrees');
  r = p('u-value of brick 102, cavity 50, block 100, plaster 13');
  assert.deepEqual(r.inputs.layers.map((l) => l.mat), ['brick', 'cavity', 'block', 'plaster']);
  r = p('shadow of a 12 m building at 3pm on 21 december');
  assert.deepEqual({ kind: r.kind, h: r.inputs.height, t: r.inputs.time, d: r.inputs.date }, { kind: 'sun', h: 12, t: '15:00', d: '12-21' });
  assert.equal(p('wind tunnel').kind, 'tunnel');
  for (const t of ['hello', 'I ran 5 km in 30 min', 'what time is it', 'remind me at 5pm', 'the sun is out today']) assert.equal(p(t), null, `"${t}" is not a workbench problem`);
  // the chat with no model: a command opens a panel, a bare problem with two numbers is answered, a question goes to the brain
  const a = (t) => W.workbenchAsked(t);
  for (const [t, panel] of [['wind tunnel', 'tunnel'], ['open the workbench', ''], ['beam calculator', 'beam'], ['gear ratio', 'gears'], ['engine power', 'engine'], ['orbit', 'orbit'], ['sun and shadow', 'sun'], ['led resistor', 'circuit'], ['Open the wind tunnel please', 'tunnel'], ['heat loss', 'heat']]) {
    assert.deepEqual(a(t), { panel, problem: null }, `"${t}" opens ${panel || 'the workbench'}`);
  }
  const bare = a('3 m steel beam 5 kN in the middle');
  assert.equal(bare.panel, 'beam');
  assert.equal(bare.problem.inputs.load, 5000);
  assert.equal(a('beam').panel, 'beam');
  for (const t of ['how strong is a 3 m steel beam with 5 kn in the middle', "what's the gear ratio of 50 and 11 teeth", 'is a 3 m steel beam with 5 kN ok?', 'hello', 'steel beam']) assert.equal(a(t), null, `"${t}" goes to the brain`);
});

test('the wind tunnel’s flow: a cylinder’s drag, a flat plate’s lift (none at 0°, some at 10°), the stability guard, the same answer every time', () => {
  // a cylinder 6 cells across in a 64 × 32 tunnel, 400 steps (τ 0.53, inlet 0.1: Re 60)
  const f = W.createFlow({ nx: 64, ny: 32, inlet: 0.1, tau: 0.53 });
  f.setObstacle(W.circleMask(64, 32, 16, 15.5, 3), 6);
  f.step(400);
  const cd = f.meanForce().cd;
  within(cd, 1, 3, 'the cylinder’s Cd after 400 steps');
  assert.ok(f.stable(), 'every number finite, every speed bounded');
  const v = f.velocity();
  assert.ok(v.every((x) => Number.isFinite(x)) && Math.max(...v) < 3, `speeds within 3× the inlet: ${Math.max(...v)}`);
  assert.ok(f.vorticity().every((x) => Number.isFinite(x)));
  close(f.reynolds(), (0.1 * 6) / ((0.53 - 0.5) / 3), 1e-12, 'Re = U·D/ν, ν = (τ − ½)/3');
  // the same flow again gives the same numbers (pure and deterministic)
  const g = W.createFlow({ nx: 64, ny: 32, inlet: 0.1, tau: 0.53 });
  g.setObstacle(W.circleMask(64, 32, 16, 15.5, 3), 6);
  g.step(400);
  assert.equal(g.meanForce().cd, cd);
  // a flat plate: no lift at 0° (by symmetry), lift upwards at 10° nose up
  const plate = (alpha) => {
    const s = W.shapeMask({ kind: 'plate', alpha }, 64, 32);
    const p = W.createFlow({ nx: 64, ny: 32, inlet: 0.1, tau: 0.6 });
    p.setObstacle(s.mask, s.chord);
    p.step(400);
    return p.meanForce().cl;
  };
  assert.ok(Math.abs(plate(0)) < 0.1, `a plate at 0°: Cl ${plate(0)}`);
  assert.ok(plate(10) > 0, `a plate at 10°: Cl ${plate(10)}`);
  // the guard: τ at least 0.52, the inlet at most 0.1, and it says so
  const wild = W.createFlow({ nx: 32, ny: 16, inlet: 0.3, tau: 0.5 });
  assert.equal(wild.tau, 0.52);
  assert.equal(wild.inlet, 0.1);
  assert.equal(wild.clamped.length, 2);
  assert.match(wild.clamped.join(' '), /τ raised from 0\.500 to 0\.52.*inlet slowed from 0\.300 to 0\.1/);
});

test('the wind tunnel’s shapes: the NACA 2412 outline is closed and one chord long, a circle’s cells, a plate symmetric at 0°, a free shape from three points', () => {
  const n = W.nacaOutline('2412');
  assert.ok(n.length > 50);
  const [a, z] = [n[0], n[n.length - 1]];
  assert.ok(Math.hypot(a[0] - z[0], a[1] - z[1]) < 1e-9, 'closed: the first point is the last');
  const xs = n.map((p) => p[0]);
  close(Math.max(...xs) - Math.min(...xs), 1, 1e-6, 'the chord');
  const ys = n.map((p) => p[1]);
  close(Math.max(...ys) - Math.min(...ys), 0.12, 0.05, 'about 12 % of the chord thick (the camber line is nearly flat where it is thickest)');
  assert.ok(Math.max(...ys) > -Math.min(...ys), 'cambered: more above the chord line than below');
  const placed = W.place(n, 40, 0, 50, 20);
  close(Math.max(...placed.map((p) => p[0])) - Math.min(...placed.map((p) => p[0])), 40, 1e-6, 'placed at 40 cells');
  assert.equal(W.nacaOutline('banana'), null);
  const r = 8;
  const cells = W.circleMask(64, 32, 30, 15.5, r).reduce((s, x) => s + x, 0);
  close(cells, Math.PI * r * r, 0.05, 'a circle’s cells ≈ πr² (±5 %)');
  const pl = W.shapeMask({ kind: 'plate', alpha: 0 }, 64, 32).mask;
  for (let y = 0; y < 32; y++) for (let x = 0; x < 64; x++) assert.equal(pl[y * 64 + x], pl[(31 - y) * 64 + x], `the plate mirrors at (${x}, ${y})`);
  const free = W.shapeMask({ kind: 'free', points: [[20, 10], [34, 16], [20, 22]] }, 64, 32);
  close(free.cells, W.area([[20, 10], [34, 16], [20, 22]]), 0.2, 'three points: a triangle');
  assert.equal(free.name, 'your shape');
  const line = W.shapeMask({ kind: 'free', points: [[20, 10], [30, 12]] }, 64, 32);
  assert.ok(line.cells > 10, 'two points: a drawn line, thickened');
  for (const kind of ['naca', 'circle', 'square', 'plate', 'car']) {
    const s = W.shapeMask({ kind, code: '0012', alpha: 5 }, 192, 96);
    assert.ok(s.cells > 20 && s.chord > 5 && s.outline.length >= 2, `${kind}: ${s.cells} cells`);
    assert.ok(![...Array(96).keys()].some((y) => s.mask[y * 192]), `${kind}: the inlet column stays open`);
  }
});

test('the brain’s estimate tool: his words through the shared solvers, fields with their units, the sun at his saved home, the caveat always', async () => {
  const T = await import('./.build/tools/index.mjs');
  const tool = T.toolByName.get('estimate');
  assert.ok(tool && tool.risk === 'auto' && tool.pure === true, 'estimate: pure, never asks');
  assert.ok(tool.description.length <= 1000, `${tool.description.length} characters`);
  const group = T.TOOL_GROUPS.find((g) => g.name === 'workbench');
  assert.deepEqual(group.tools.map((t) => t.name), ['estimate']);
  const store = new Map([['owner:ctx', { tz: 'Europe/London' }], ['places', [{ id: 'home', label: 'Home', lat: 52.443186, lon: -1.892525, at: 1 }]]]);
  const ctx = { storage: { get: async (k) => store.get(k) }, vault: { get: async () => null } };
  const run = (a) => tool.run(a, ctx);
  let t = await run({ kind: 'beam', words: 'how strong is a 3 m steel beam with 5 kn in the middle' });
  assert.match(t, /Max deflection: 0\.201 mm/);
  assert.match(t, /First estimate, not certified — .*A chartered engineer signs this, not me\.\n\n\(Answer his question/);
  t = await run({ kind: 'beam', words: 'a steel beam', span: '4 m', load: '10 kN', b: 100, h: 200 });
  assert.match(t, /Beam: 4 m, simply supported/);
  assert.match(t, /Max deflection: 0\.952 mm/, 'PL³/48EI at 4 m and 10 kN');
  t = await run({ kind: 'gears', words: "what's the gear ratio of 50 and 11 teeth" });
  assert.match(t, /Overall ratio: 1 : 4\.55/);
  t = await run({ kind: 'gears', words: 'a gearbox', teeth: '20:60, 15:45, 10:40', rpm: 1800 });
  assert.match(t, /Overall ratio: 36 : 1/);
  t = await run({ kind: 'sun', words: 'shadow of a 10 m building at noon on 21 june' });
  assert.match(t, /Sun and shadow: his home/);
  assert.match(t, /At noon that day: 61° high/);
  t = await run({ kind: 'car', words: 'hatchback at 70 mph', units: 'imperial' });
  assert.match(t, /Power to push the air: \d+(?:\.\d)? hp/);
  t = await run({ kind: 'nonsense', words: 'hello there' });
  assert.match(t, /^Nothing estimated/);
  t = await run({ kind: 'wing', words: 'wing at 40 degrees' });
  assert.match(t, /far past any stall/);
  assert.match(t, /First estimate, not certified/);
});
