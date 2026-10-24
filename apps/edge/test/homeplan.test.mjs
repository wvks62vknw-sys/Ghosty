// DESIGN MY HOME, part 1 (apps/edge/src/tools/homeplan.ts): the owner's plain words → a floor plan the
// SPACE PLANNER imports and the 3D STUDIO builds. Sizes in any unit, rooms and how they sit, doors on
// shared walls, windows on outside walls, furniture inside its room and out of door swings, tight
// walkways flagged, every assumption said, the reply within the model's budget, and the plan
// round-tripping through the planner's own readers. Part 2: the whole plan goes to the phone as the
// `home_plan` client event (never cut), the phone reads it whole (space/homeplan.ts), the scripted model
// turns "Design my home …" into the tool, and the brain streams the event through a real chat turn.
// Run by design.test.mjs (one import line), so the protected package.json test list is unchanged; it
// builds what it needs itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const here = (p) => new URL(p, import.meta.url).pathname;
const opts = { bundle: true, format: 'esm', platform: 'neutral', external: ['cloudflare:sockets'], logLevel: 'warning' };
await build({ ...opts, entryPoints: [here('../src/tools/homeplan.ts')], outfile: here('./.build/homeplan/homeplan.mjs') });
await build({ ...opts, entryPoints: [here('../../../packages/shared/src/design.ts')], outfile: here('./.build/homeplan/design.mjs') });
await build({ ...opts, entryPoints: [here('../../web/src/space/roomjson.ts')], outfile: here('./.build/homeplan/roomjson.mjs') });
await build({ ...opts, entryPoints: [here('../../web/src/studio/room.ts')], outfile: here('./.build/homeplan/room.mjs') });
await build({ ...opts, entryPoints: [here('../src/prompt.ts')], outfile: here('./.build/homeplan/prompt.mjs') });
await build({ ...opts, entryPoints: [here('../src/tools/index.ts')], outfile: here('./.build/homeplan/tools.mjs') });
await build({ ...opts, entryPoints: [here('../src/context.ts')], outfile: here('./.build/homeplan/context.mjs') });
await build({ ...opts, entryPoints: [here('../../../packages/shared/src/protocol.ts')], outfile: here('./.build/homeplan/protocol.mjs') });
await build({ ...opts, entryPoints: [here('../src/llm/mock.ts')], outfile: here('./.build/homeplan/mock.mjs') });
await build({ ...opts, entryPoints: [here('../../web/src/space/homeplan.ts')], outfile: here('./.build/homeplan/webhome.mjs') });
await build({ ...opts, entryPoints: [here('../src/index.ts')], outfile: here('./.build/homeplan/brain.mjs') });
const H = await import('./.build/homeplan/homeplan.mjs');
const D = await import('./.build/homeplan/design.mjs');
const RJ = await import('./.build/homeplan/roomjson.mjs');
const R = await import('./.build/homeplan/room.mjs');
const P = await import('./.build/homeplan/prompt.mjs');
const T = await import('./.build/homeplan/tools.mjs');
const C = await import('./.build/homeplan/context.mjs');
const PR = await import('./.build/homeplan/protocol.mjs');
const M = await import('./.build/homeplan/mock.mjs');
const W = await import('./.build/homeplan/webhome.mjs');

const near = (a, b, eps = 0.01) => Math.abs(a - b) <= eps;
const roomOf = (s, name) => s.rooms.find((r) => r.name === name);
const box = (r) => D.bounds(r.poly);
const shared = (a, b) => D.sharedWalls(a.poly, b.poly).reduce((n, x) => n + x.to - x.from, 0);
const plan = (text, unit) => H.designHome(text, unit);
const json = (s) => H.storeyJson(s);

test('sizes in any unit: 36 phrases — feet and inches, metres, cm, mm, mixed, rough, ranges, areas, no unit', () => {
  const FT = 30.48;
  const IN = 2.54;
  // [phrase, w, d, what else must hold]
  const cases = [
    ['12 by 10 feet', 12 * FT, 10 * FT],
    ['3.6 m × 4.2 m', 360, 420],
    ['360cm wide', 360, undefined, (x) => x.side === 'w'],
    ['10ft 6in', 10 * FT + 6 * IN],
    ['about four metres', 400, undefined, (x) => x.approx],
    ["12' x 10'", 12 * FT, 10 * FT],
    ['10\' 6" by 9\'', 10 * FT + 6 * IN, 9 * FT],
    ['3.6x4.2m', 360, 420],
    ['4m by 12ft', 400, 12 * FT],
    ['3 to 3.5 m', 325, undefined, (x) => x.approx && near(x.range[0], 300) && near(x.range[1], 350)],
    ['between 10 and 12 feet', 11 * FT, undefined, (x) => near(x.range[1], 12 * FT)],
    ['10-12ft', 11 * FT, undefined, (x) => !!x.range],
    ['3600 x 2400 mm', 360, 240],
    ['3600mm', 360],
    ['2,400 mm', 240],
    ['3,6 m', 360],
    ['4.5 metres long', 450, undefined, (x) => x.side === 'long'],
    ['3 metres deep', 300, undefined, (x) => x.side === 'd'],
    ['2.4 m high', 240, undefined, (x) => x.side === 'h'],
    ['twelve by ten feet', 12 * FT, 10 * FT],
    ['four and a half metres', 450],
    ['half a metre', 50],
    ['roughly 3m', 300, undefined, (x) => x.approx],
    ['4m-ish', 400, undefined, (x) => x.approx],
    ['16 m²', 0, undefined, (x) => near(x.area, 160000)],
    ['150 sq ft', 0, undefined, (x) => near(x.area, 150 * FT * FT)],
    ['12 feet square', 12 * FT, 12 * FT, (x) => x.square],
    ['4 x 3', 400, 300, (x) => x.guessed && x.unit === 'm'],
    ['12 x 10', 12 * FT, 10 * FT, (x) => x.guessed && x.unit === 'ft'],
    ['450 x 380', 450, 380, (x) => x.guessed && x.unit === 'cm'],
    ['6 yards', 6 * 91.44],
    ['10ft6', 10 * FT + 6 * IN],
    ['3m60', 360],
    ['3 m 60 cm', 360],
    ['3.6 by 4.2 by 2.4 m', 360, 420, (x) => near(x.h, 240)],
    ['a metre and a half', 150],
  ];
  assert.ok(cases.length >= 30);
  for (const [phrase, w, d, more] of cases) {
    const x = H.parseSize(phrase);
    assert.ok(x, `${phrase}: read`);
    if (w) assert.ok(near(x.w, w), `${phrase}: w ${x.w} ≠ ${w}`);
    if (d !== undefined) assert.ok(near(x.d, d), `${phrase}: d ${x.d} ≠ ${d}`);
    else if (!x.square) assert.equal(x.d, undefined, `${phrase}: one side only`);
    if (more) assert.ok(more(x), `${phrase}: ${JSON.stringify(x)}`);
  }
  // numbers that are not sizes stay out
  for (const phrase of ['2 bedrooms', 'bedroom 2', '2 in the kitchen', 'a 3-seater sofa', '4 chairs']) assert.equal(H.parseSize(phrase), null, phrase);
  // the owner's unit decides a bare number, and sizes are shown back in it
  assert.equal(H.parseSize('4 x 3', 'imperial').unit, 'ft');
  assert.equal(H.parseSize('12 x 10', 'metric').unit, 'm');
  assert.equal(H.lengthText(10 * FT + 6 * IN, 'imperial'), '10 ft 6 in');
  assert.equal(H.lengthText(420, 'metric'), '4.2 m');
  assert.equal(H.sizeText(420, 360, 'metric'), '4.2 × 3.6 m');
  assert.equal(H.sizeText(12 * FT, 10 * FT, 'imperial'), '12 ft × 10 ft');
});

test('rooms and how they sit: one room, two side by side, a flat off a hall, an upstairs, an en suite, a side, "between", an L', () => {
  // 1. one room, the size as said
  const one = plan('A bedroom 3.5 by 3 m.');
  assert.equal(one.storeys.length, 1);
  assert.deepEqual(one.storeys[0].rooms.map((r) => [r.name, box(r).w, box(r).h]), [['Bedroom', 350, 300]]);

  // 2. two rooms side by side share a wall long enough for a door
  const two = plan('A 3 by 3 m kitchen and a 5 by 4 m living room side by side.');
  const [k, l] = ['Kitchen', 'Living room'].map((n) => roomOf(two.storeys[0], n));
  assert.ok(k && l, 'both rooms');
  assert.ok(shared(k, l) >= 90, `kitchen and living room share ${shared(k, l)} cm`);
  assert.deepEqual([box(k).w, box(k).h, box(l).w, box(l).h].sort(), [300, 300, 500, 400].sort());

  // 3. a flat: kitchen, living room, bathroom, two bedrooms and a hall — each opening off the hall
  const flat = plan('A flat with a kitchen, living room, bathroom, two bedrooms and a hall.');
  const f = flat.storeys[0];
  assert.deepEqual(f.rooms.map((r) => r.name).sort(), ['Bathroom', 'Bedroom 1', 'Bedroom 2', 'Hall', 'Kitchen', 'Living room']);
  const hall = roomOf(f, 'Hall');
  for (const r of f.rooms.filter((x) => x !== hall)) assert.ok(shared(r, hall) >= 90, `${r.name} opens off the hall`);

  // 4. an upstairs is a second storey, with a landing and the stairs
  const house = plan('Downstairs a hall, a living room and a kitchen. Upstairs two bedrooms and a bathroom.');
  assert.deepEqual(house.storeys.map((s) => s.name), ['Ground floor', 'First floor']);
  assert.deepEqual(house.storeys[0].rooms.map((r) => r.name).sort(), ['Hall', 'Kitchen', 'Living room']);
  assert.deepEqual(house.storeys[1].rooms.map((r) => r.name).sort(), ['Bathroom', 'Bedroom 1', 'Bedroom 2', 'Landing']);
  assert.ok(house.storeys.every((s) => s.items.some((i) => i.name === 'Stairs')), 'the stairs on both floors');

  // two storeys named in one sentence; a storey said after its rooms
  const mixed = plan('The kitchen is downstairs and the bedroom is upstairs.');
  assert.deepEqual(mixed.storeys.map((s) => s.rooms.map((r) => r.name)), [['Kitchen'], ['Bedroom']]);
  const after = plan('A hall and a lounge, two bedrooms and a bathroom upstairs.');
  assert.deepEqual(after.storeys.map((s) => s.rooms.map((r) => r.name).sort()), [['Hall', 'Living room'], ['Bathroom', 'Bedroom 1', 'Bedroom 2', 'Landing']]);

  // 5. an en suite opens off its bedroom only
  const suite = plan('A hall with two bedrooms off it. Bedroom 1 has an en suite.');
  const s5 = suite.storeys[0];
  const es = roomOf(s5, 'En suite');
  assert.ok(shared(es, roomOf(s5, 'Bedroom 1')) >= 90);
  assert.equal(doorsBetween(s5, es).sort().join(), 'Bedroom 1', 'the en suite has one door, into bedroom 1');

  // 6. "the kitchen is off the living room to the right"
  const right = plan('The living room is 5 by 4 m. The kitchen is off the living room to the right.').storeys[0];
  assert.ok(box(roomOf(right, 'Kitchen')).x >= box(roomOf(right, 'Living room')).x + 499, 'the kitchen is on the right');
  assert.deepEqual(doorsBetween(right, roomOf(right, 'Kitchen')), ['Living room']);

  // 7. "between"
  const bw = plan('Three rooms in a row off the landing: the bathroom is between bedroom 1 and bedroom 2.').storeys[0];
  const [b1, ba, b2] = ['Bedroom 1', 'Bathroom', 'Bedroom 2'].map((n) => box(roomOf(bw, n)));
  assert.ok(b1.x + b1.w <= ba.x + 1 && ba.x + ba.w <= b2.x + 1, `bedroom 1 | bathroom | bedroom 2: ${[b1.x, ba.x, b2.x]}`);

  // 8. an L-shaped room, and its neighbour on a straight wall
  const el = plan('An L-shaped living room 6 by 5 m with the kitchen off it.').storeys[0];
  const lv = roomOf(el, 'Living room');
  assert.equal(lv.poly.length, 6, 'an L has six corners');
  assert.deepEqual([box(lv).w, box(lv).h], [600, 500]);
  assert.ok(shared(lv, roomOf(el, 'Kitchen')) >= 90);
});

/** The rooms a room has doors to (its own doors and its neighbours' doors on its walls). */
function doorsBetween(s, room) {
  const out = [];
  for (const o of s.openings.filter((x) => x.type === 'door')) {
    const owner = s.rooms.find((r) => r.id === o.room);
    const { mid, edge } = D.openingSpan(owner, o);
    const probe = (k) => [mid[0] + edge.nx * k, mid[1] + edge.ny * k];
    const inside = (p) => s.rooms.find((r) => D.pointInPoly(p, r.poly, 0));
    const a = inside(probe(-3));
    const b = inside(probe(3));
    if (a === room && b) out.push(b.name);
    else if (b === room && a) out.push(a.name);
  }
  return out;
}

const SAMPLES = [
  'A flat with a kitchen, living room, bathroom, two bedrooms and a hall.',
  'The living room is 15 by 12 feet with a sofa against the long wall, a TV opposite and a coffee table. The kitchen is off the living room to the right, about 10ft by 9ft, with a fridge, a cooker and a sink under the window. There is a back door from the kitchen to the garden.',
  'Downstairs: a hall, a 4.2 x 3.6 m lounge and a kitchen diner 5 by 3.5 m with a dining table for 6. Upstairs there are three bedrooms and a bathroom. The main bedroom has an en suite and a king size bed. The bathroom is between bedroom 2 and bedroom 3.',
  'An L-shaped living room 6 by 5 metres, open plan to a 3m x 3m kitchen on the left. A bedroom 360cm wide next to the living room, with a double bed against the far wall, two bedside tables and a wardrobe. The bathroom, about 2 by 1.8 m, is off the bedroom, with a bath, a toilet and a basin.',
  'A bedroom 3 by 3 m with a window on the left wall, a single bed under the window and a desk.',
];

test('doors and windows sit on real walls: each fits its wall, doors on the walls rooms share, windows on outside walls, every room reached', () => {
  for (const text of SAMPLES) {
    const p = plan(text);
    for (const s of p.storeys) {
      for (const o of s.openings) {
        const room = s.rooms.find((r) => r.id === o.room);
        assert.equal(D.openingProblem(room, o, s.openings, s.h), null, `${text.slice(0, 30)}: ${o.id}`);
        const { mid, edge } = D.openingSpan(room, o);
        const outside = [mid[0] + edge.nx * 3, mid[1] + edge.ny * 3];
        const across = s.rooms.find((r) => r.id !== room.id && D.pointInPoly(outside, r.poly, 0));
        if (o.type === 'window') assert.ok(!across, `${o.id}: a window looks outside, not into ${across?.name}`);
        if (o.type === 'door' && across) {
          // a door between rooms lies wholly on the wall they share
          const span = D.sharedWalls(room.poly, across.poly).find((x) => x.wall === o.wall && o.at >= x.from - 0.5 && o.at + o.w <= x.to + 0.5);
          assert.ok(span, `${o.id}: on the wall ${room.name} shares with ${across.name}`);
        }
      }
      // every room can be reached through doors from the way in
      const doors = s.openings.filter((o) => o.type === 'door');
      const links = doors.map((o) => {
        const room = s.rooms.find((r) => r.id === o.room);
        const { mid, edge } = D.openingSpan(room, o);
        const other = s.rooms.find((r) => r.id !== room.id && D.pointInPoly([mid[0] + edge.nx * 3, mid[1] + edge.ny * 3], r.poly, 0));
        return [room.id, other?.id ?? 'outside'];
      });
      const start = s.name === 'First floor' ? s.rooms.find((r) => r.name === 'Landing').id : 'outside';
      const seen = new Set([start]);
      for (let i = 0; i < 20; i++) for (const [a, b] of links) if (seen.has(a) || seen.has(b)) [a, b].forEach((x) => seen.add(x));
      for (const r of s.rooms) assert.ok(seen.has(r.id), `${text.slice(0, 30)}: ${r.name} can be reached`);
    }
  }
  // a window where the words put it; the front door where the 3-D walk starts (the first opening)
  const one = plan(SAMPLES[4]).storeys[0];
  const win = one.openings.find((o) => o.type === 'window');
  assert.equal(win.wall, 3, 'the left wall');
  assert.equal(one.openings[0].type, 'door');
  const back = plan(SAMPLES[1]).storeys[0];
  const kitchen = roomOf(back, 'Kitchen');
  assert.ok(back.openings.some((o) => o.type === 'door' && o.room === kitchen.id && D.edgeOf(kitchen.poly, o.wall).ny === -1), 'the back door to the garden is on the back (top) wall');
});

test('furniture: inside its room, off the other pieces, out of every door swing and doorway; tight walkways flagged; what does not fit is said', () => {
  for (const text of SAMPLES) {
    const p = plan(text);
    for (const s of p.storeys) {
      const dp = { rooms: s.rooms, openings: s.openings, items: s.items };
      assert.deepEqual(D.designProblems(dp), [], `${text.slice(0, 40)}: no clashes, nothing outside a room or in a door swing`);
      for (const it of s.items) assert.ok(s.rooms.some((r) => D.rectInPoly(D.itemRect(it), r.poly)), `${it.name} inside a room`);
    }
  }
  // what the words said: a sofa on the long wall with the TV facing it; a bed under the window
  const lr = plan(SAMPLES[1]).storeys[0];
  const living = roomOf(lr, 'Living room');
  const sofa = lr.items.find((i) => i.name === 'Sofa, 3-seater');
  const tv = lr.items.find((i) => i.name === 'TV unit');
  assert.ok(D.rectInPoly(D.itemRect(sofa), living.poly), 'the sofa is in the living room');
  assert.equal(Math.abs((sofa.rot ?? 0) - (tv.rot ?? 0)) % 360, 180, 'the TV faces the sofa');
  const longWall = D.itemRect(sofa);
  assert.ok(near(longWall.y, 0, 1) || near(longWall.y + longWall.h, box(living).h, 1), 'the sofa stands on a long (15 ft) wall');
  for (const n of ['Fridge freezer', 'Cooker', 'Sink unit']) assert.ok(D.rectInPoly(D.itemRect(lr.items.find((i) => i.name === n)), roomOf(lr, 'Kitchen').poly), `${n} in the kitchen`);
  const bedroom = plan(SAMPLES[4]).storeys[0];
  const bed = bedroom.items.find((i) => i.name === 'Bed, single');
  const w = bedroom.openings.find((o) => o.type === 'window');
  const span = D.openingSpan(bedroom.rooms[0], w);
  const r = D.itemRect(bed);
  assert.ok(r.x < 1 && r.y < span.mid[1] && r.y + r.h > span.mid[1], 'the bed is under the window on the left wall');
  // a walkway under 70 cm is flagged
  const tight = plan('A study 1.5 by 1.6 m with a small window on the back wall, a desk against the left wall and a bookcase against the right wall.');
  assert.ok(tight.walkways.some((x) => /Desk and Bookcase are 60 cm apart/.test(x) || /Bookcase and Desk are 60 cm apart/.test(x)), JSON.stringify(tight.walkways));
  // a piece that cannot fit is said, never squeezed in
  const small = plan('A 2 by 2 m box room with a king size bed.');
  assert.equal(small.storeys[0].items.length, 0);
  assert.ok(small.cannot.some((x) => /king bed \(160 × 215 cm\) did not fit/.test(x)), JSON.stringify(small.cannot));
});

test('the plan round-trips: readLayout drops nothing, the planner\'s IMPORT and the 3D STUDIO read every room, door, window and piece', () => {
  for (const text of SAMPLES) {
    for (const s of plan(text).storeys) {
      for (const level of [0, 1, 2, 3]) {
        const j = JSON.parse(JSON.stringify(H.storeyJson(s, level)));
        const lay = D.readLayout(j);
        assert.deepEqual(lay.dropped, [], `${text.slice(0, 30)} level ${level}`);
        assert.equal(lay.rooms.length, s.rooms.length);
        assert.equal(lay.openings.length, s.openings.length);
        for (const [i, r] of s.rooms.entries()) assert.ok(near(D.polyArea(lay.rooms[i].poly), D.polyArea(r.poly), level ? D.polyPerimeter(r.poly) : 1), `${r.name} keeps its floor`);
        // every opening comes back with the same size and place (defaults left out at the higher levels)
        for (const [i, o] of s.openings.entries()) {
          const b = lay.openings[i];
          const roomAt = (lay2, id) => lay2.rooms.findIndex((r) => r.id === id);
          assert.deepEqual([b.type, roomAt(lay, b.room), b.wall, b.hinge, b.swing], [o.type, s.rooms.findIndex((r) => r.id === o.room), o.wall, o.hinge, o.swing]);
          assert.ok(near(b.w, o.w, 0.6) && near(b.h, o.h, 0.6) && near(b.sill, o.sill, 0.6) && near(b.at, o.at, 0.6));
        }
        const d = D.readDesign(j);
        assert.equal(d.items.length, s.items.length);
        assert.deepEqual(D.designProblems(d), [], `${text.slice(0, 30)} level ${level}: nothing clashes after rounding`);
        const planner = RJ.roomToPlan(j);
        assert.equal(planner.rooms.length, s.rooms.length, 'the planner imports every room');
        assert.equal(planner.openings.length, s.openings.length, 'and every door and window');
        assert.equal(planner.items.length, s.items.length, 'and every piece');
        const studio = R.parseRoom(j);
        assert.equal(studio.rooms.length, s.rooms.length);
        assert.equal(studio.openings.length, s.openings.length);
        const built = R.roomBoxes(studio, { ceiling: true });
        assert.deepEqual(built.warnings, [], 'nothing sticks out of a room in 3-D');
        assert.ok(built.boxes.filter((b) => b.kind === 'door').length === s.openings.filter((o) => o.type === 'door').length);
      }
    }
  }
});

const BIG = 'A big house. Downstairs: a hall, a living room 5 by 4 m with a corner sofa, two armchairs, a coffee table, a TV unit and a bookcase; a dining room with a table for 8 and a sideboard; a kitchen 4 by 3.5 m with a fridge freezer, a cooker, a sink, a dishwasher and an island; a utility room with a washing machine and a tumble dryer; a downstairs toilet; a study with a desk and two bookcases; a playroom; a conservatory at the back; a garage. Upstairs: four bedrooms, each with a double bed, two bedside tables and a wardrobe; the main bedroom has an en suite with a shower, a toilet and a basin; a family bathroom with a bath, a toilet and a basin; a dressing room.';

test('the reply: a plain summary, the assumptions, what could not be done, the hand-off, and every storey\'s plan — within the model\'s budget, every room kept', async () => {
  assert.equal(H.REPLY_MAX, C.resultBudget('design_home'), 'the budget is what the model is given of a tool result');
  for (const text of [...SAMPLES, BIG]) {
    const p = plan(text);
    const reply = H.homeReply(p);
    assert.ok(reply.length <= H.REPLY_MAX, `${text.slice(0, 30)}: ${reply.length} characters`);
    const plans = reply.split('\n').filter((l) => l.startsWith('PLAN'));
    assert.equal(plans.length, p.storeys.length, 'a line for every floor');
    plans.forEach((l, i) => {
      // a floor's plan is in the reply whole, or the reply says how to get it — never a floor with rooms missing
      if (!l.includes('{')) {
        assert.match(l, new RegExp(`call design_home again with the same description and floor: ${i}`));
        return;
      }
      const j = JSON.parse(l.slice(l.indexOf('{')));
      assert.equal(j.rooms.length, p.storeys[i].rooms.length, 'every room is in the plan text');
      assert.deepEqual(D.readLayout(j).dropped, []);
    });
    if (p.storeys.length === 1) assert.ok(plans.every((l) => l.includes('{')), 'a one-storey home comes whole in one reply');
    if (text !== BIG) assert.ok(H.homeReply(p, 9000).split('\n').filter((l) => l.startsWith('PLAN')).every((l) => l.includes('{')), 'with 9,000 characters every floor comes in one reply');
    assert.match(reply, /SPACE → IMPORT/);
    assert.match(reply, /says nothing about planning permission or building regulations/);
    assert.ok(!/\b(?:complies|compliant|meets (?:the )?(?:building|planning))/i.test(reply), 'never claims the rules are met');
  }
  // a big house: its floors come whole, one per call when they must; asked for, each floor fits alone
  const big = plan(BIG);
  assert.ok(big.storeys.reduce((n, s) => n + s.rooms.length, 0) >= 15, 'every room of the big house');
  assert.ok(H.homeReply(big, 1e9).length > H.REPLY_MAX, 'the full reply would be too long');
  const ctx = { storage: {}, env: {}, emit: () => undefined, progress: () => undefined, vault: { get: async () => null } };
  for (const floor of [0, 1]) {
    const one = await H.homePlanTools[0].run({ description: BIG, floor }, ctx);
    assert.ok(one.length <= H.REPLY_MAX, `floor ${floor}: ${one.length}`);
    const l = one.split('\n').find((x) => x.startsWith('PLAN'));
    assert.equal(JSON.parse(l.slice(l.indexOf('{'))).rooms.length, big.storeys[floor].rooms.length, `floor ${floor}: every room`);
  }
  // with more room (context.ts budget raised for design_home) the whole house comes in one reply
  const roomy = H.homeReply(big, 9000);
  assert.equal(roomy.split('\n').filter((x) => x.startsWith('PLAN') && x.includes('{')).length, 2);
  // the summary line for the owner, in their unit
  const imp = H.homeReply(plan(SAMPLES[1]));
  assert.match(imp, /Living room 15 ft × 12 ft/);
  const met = H.homeReply(plan(SAMPLES[1], 'metric'));
  assert.match(met, /Living room 4\.57 × 3\.66 m/);
});

test('the assumptions are listed: sizes chosen, a unit guessed, a range\'s middle, the front door, windows, usual furniture sizes, the ceiling', () => {
  const p = plan('A flat with a 12 by 10 living room, a kitchen of 3 to 3.5 m by 3 m and a bathroom. The living room has a sofa.');
  const all = p.assumed.join('\n');
  assert.match(all, /sizes I chose \(you didn't say\):.*Bathroom 2\.1 × 1\.8 m/);
  assert.match(all, /you gave 12 by 10 without a unit: I took it as feet/);
  assert.match(all, /Kitchen: you gave a range \(3 to 3\.5 m by 3 m\): I used the middle, 3\.25 m/);
  assert.match(all, /the front door is here: you didn't say where it is/);
  assert.match(all, /a window I added on an outside wall/);
  assert.match(all, /furniture at the usual UK size \(you didn't give one\): 3-seater sofa 210 × 95 cm/);
  assert.match(all, /ceilings 2\.4 m: you didn't say/);
  // said sizes are not listed as assumed; a said ceiling is used
  assert.ok(!/Living room \d/.test(all.split('\n').find((l) => l.startsWith('sizes I chose')) ?? ''));
  const both = plan('Downstairs a hall and a kitchen. Upstairs a bedroom. Ceilings are 8 foot.');
  assert.deepEqual(both.storeys.map((x) => Math.round(x.h)), [244, 244], 'a ceiling said on its own is every floor');
  const upper = plan('Downstairs a hall and a kitchen. Upstairs a bedroom; upstairs the ceilings are 2.2 m.');
  assert.deepEqual(upper.storeys.map((x) => x.h), [240, 220]);
  const h = plan('A 4 by 4 m bedroom with 2.7 m ceilings.');
  assert.equal(h.storeys[0].h, 270);
  assert.ok(!h.assumed.some((x) => /ceilings/.test(x)));
  // honesty: things it cannot draw are said
  const odd = plan('A living room 5 by 4 m with a bay window and a skylight, open plan to the kitchen.');
  const cannot = odd.cannot.join('\n');
  assert.match(cannot, /bay windows are drawn as flat windows/);
  assert.match(cannot, /skylight/);
  assert.match(cannot, /open plan: the planner has no wall-less openings yet/);
});

test('more ways of saying it: a total that later lines share out, a fresh clause in a list, "off it" for a whole list, "at the end", a studio, an open-plan room, "the bed" in the last bedroom, "face south"', () => {
  // "a 3 bed semi" is the total: the bedrooms said upstairs are those three, not three more
  const semi = plan('3 bed semi. Downstairs: hall, front room 3.5 x 3.8, kitchen diner 5.8 x 3 at the back. Upstairs: two double bedrooms, a box room and a bathroom.');
  assert.deepEqual(semi.storeys.map((s) => s.rooms.map((r) => r.name).sort()), [['Hall', 'Kitchen diner', 'Living room'], ['Bathroom', 'Bedroom 1', 'Bedroom 2', 'Box room', 'Landing']]);
  assert.ok(semi.assumed.some((x) => /you gave 3\.5 x 3\.8 without a unit: I took it as metres/.test(x)));
  // a list where each room brings its own place
  const list = plan('Lounge 450cm x 380cm, kitchen 300cm x 280cm to the right of the lounge, bathroom behind the kitchen.').storeys[0];
  const [lo, ki, ba] = ['Living room', 'Kitchen', 'Bathroom'].map((n) => box(roomOf(list, n)));
  assert.ok(ki.x >= lo.x + lo.w - 1, 'the kitchen is right of the lounge');
  assert.ok(ba.y + ba.h <= ki.y + 1, 'the bathroom is behind (above) the kitchen');
  assert.deepEqual(list.rooms.map((r) => [r.name, box(r).w, box(r).h]).filter(([n]) => n !== 'Bathroom').sort(), [['Kitchen', 300, 280], ['Living room', 450, 380]]);
  // "a hallway … with the living room, kitchen and two bedrooms off it, and the bathroom at the end"
  const hw = plan('hallway 1.2 m wide and 5 m long with the living room, kitchen and two bedrooms off it, and the bathroom at the end').storeys[0];
  const hall = roomOf(hw, 'Hall');
  assert.equal(box(hall).h, 120, 'the hall is 1.2 m wide');
  for (const r of hw.rooms.filter((x) => x !== hall)) assert.deepEqual(doorsBetween(hw, r), ['Hall'], `${r.name} opens off the hall only`);
  const bath = box(roomOf(hw, 'Bathroom'));
  assert.ok(bath.x >= box(hall).x + box(hall).w - 1, 'the bathroom is at the end of the hall');
  // a studio is one room, its kitchen area a run of units in it
  const studio = plan('I live in a studio: one room 6m by 4m with a double bed, a sofa, a small kitchen area and a shower room 2 by 1.5 m').storeys[0];
  assert.deepEqual(studio.rooms.map((r) => [r.name, box(r).w, box(r).h]), [['Studio', 600, 400], ['Bathroom', 200, 150]]);
  assert.ok(studio.items.some((i) => i.name === 'Kitchen units'));
  // an open-plan room said as one, its size before the adjectives
  const open = plan('A 20 by 15 open-plan living and kitchen area with a sofa and a dining table, high ceilings');
  assert.deepEqual(open.storeys[0].rooms.map((r) => [r.name, Math.round(box(r).w), Math.round(box(r).h)]), [['Kitchen and living room', 610, 457]]);
  assert.equal(open.storeys[0].h, 270);
  // "a kitchen, living room, …" is still two rooms
  assert.equal(plan('A flat with a kitchen, living room and bathroom.').storeys[0].rooms.length, 3);
  // no room in the sentence: the bed goes in the last bedroom named, the windows in the last room with windows
  const suite = plan('A master bedroom 4.5 x 4 m with an en suite shower room and a walk-in wardrobe. The bed goes against the back wall with bedside tables either side. The windows face south.').storeys[0];
  const bedroom = roomOf(suite, 'Bedroom');
  for (const it of suite.items) assert.ok(D.rectInPoly(D.itemRect(it), bedroom.poly), `${it.name} in the bedroom`);
  const wins = suite.openings.filter((o) => o.type === 'window' && o.room === bedroom.id);
  assert.equal(wins.length, 2);
  for (const o of wins) assert.equal(D.edgeOf(bedroom.poly, o.wall).ny, 1, 'facing south: the bottom of the plan, north being up');
  // the size after "next to the bathroom," is the bedroom's
  const flat = plan('My flat: you come in to a hallway. At the end of the hall is the bathroom. The bedroom is next to the bathroom, 12\' x 10\'6".').storeys[0];
  assert.deepEqual([box(roomOf(flat, 'Bedroom')).w, box(roomOf(flat, 'Bedroom')).h].map(Math.round), [366, 320]);
});

const ODD = [
  '',
  '12 by 10',
  'four bedrooms',
  'a room',
  'kitchen kitchen kitchen',
  'a 0.2 by 0.3 m bathroom and a 90 m long hall',
  'Two bedroom bungalow. Lounge 5m x 4m with patio doors to the garden. Kitchen 3m x 2.7m off the lounge. Bedroom 1 3.6m x 3.2m, bedroom 2 2.8m x 2.5m, bathroom 2.2m x 1.9m, all off the hall.',
  'Ground floor: entrance hall, cloakroom, living room 18ft by 13ft with a fireplace on the left wall, dining room 12ft by 11ft, kitchen 14ft by 9ft. First floor: landing, bedroom 1 14ft x 12ft, bedroom 2 12ft x 11ft, bedroom 3 9ft x 8ft, bathroom 8ft x 6ft.',
  'The kitchen diner is 6 by 4 m with an island in the middle, a range cooker, an American fridge freezer, a double sink under the window and a table for 6. The utility room is off the kitchen. The back door is in the utility.',
  'Bedroom: 3m by 3m. Ceiling height 2.5m. Window on the north wall. Single bed against the east wall, wardrobe in the corner.',
  'A conservatory 4 x 3 m behind the living room which is 5 x 4.',
  'The garage is 6 m by 3 m and it\'s next to the kitchen.',
  `A mansion with ${Array.from({ length: 16 }, (_, i) => `bedroom ${i + 1}`).join(', ')}, and a ballroom.`,
  'x'.repeat(5000),
  'A kitchen 3 by 3 m with 9 fridges, 8 cookers and 7 sinks.',
];

test('it never breaks: odd, empty, huge and crowded descriptions give a checked plan or a plain "no rooms", always within the reply budget', () => {
  for (const text of [...ODD, ...SAMPLES, BIG]) {
    const p = plan(text);
    for (const s of p.storeys) {
      assert.ok(s.rooms.length >= 1 && s.rooms.length <= D.LIMITS.rooms, `${text.slice(0, 30)}: ${s.rooms.length} rooms`);
      assert.deepEqual(D.readLayout(H.storeyJson(s)).dropped, [], text.slice(0, 30));
      assert.deepEqual(D.designProblems({ rooms: s.rooms, openings: s.openings, items: s.items }), [], text.slice(0, 30));
      assert.ok(s.items.length <= 60, 'the planner keeps at most 60 pieces');
    }
    if (p.storeys.length) assert.ok(H.homeReply(p).length <= H.REPLY_MAX, text.slice(0, 30));
  }
  assert.equal(plan('').storeys.length, 0);
  assert.equal(plan('x'.repeat(5000)).storeys.length, 0);
  // more than 12 rooms on a floor: the rest are named as left out, never silently lost
  const mansion = plan(ODD[12]);
  assert.ok(mansion.cannot.some((x) => /at most 12 rooms/.test(x)), JSON.stringify(mansion.cannot));
  // sizes no room can be are refused in words and the usual size used
  const silly = plan(ODD[5]);
  assert.ok(silly.cannot.some((x) => /not a room size I can draw/.test(x)), JSON.stringify(silly.cannot));
  // what does not fit is said, never squeezed
  const crowded = plan(ODD[14]);
  assert.ok(crowded.cannot.some((x) => /did not fit/.test(x)));
  // and it is quick: the big house (18 rooms, 42 pieces) is planned well inside the brain's time
  const t0 = performance.now();
  H.homeReply(plan(BIG));
  assert.ok(performance.now() - t0 < 2000, `${Math.round(performance.now() - t0)} ms`);
});

test('design_home: one call returns the plan; a question about an existing plan goes to design_review; no rooms is said plainly', async () => {
  const tool = H.homePlanTools[0];
  assert.equal(tool.name, 'design_home');
  const ctx = { storage: {}, env: {}, emit: () => undefined, progress: () => undefined, vault: { get: async () => null } };
  const text = await tool.run({ description: SAMPLES[0] }, ctx);
  assert.match(text, /^HOME PLAN/);
  assert.match(text, /PLAN: \{"v":2/);
  const imperial = await tool.run({ description: 'A bedroom 3.5 by 3 m', unit: 'imperial' }, ctx);
  assert.match(imperial, /Bedroom 11 ft 6 in × 9 ft 10 in/);
  // a question about the owner's own plan is design_review's (which asks for the plan from SPACE)
  for (const q of ['What do you think of my layout?', 'Can you review my floor plan?', 'Is my kitchen big enough?']) {
    assert.equal(H.isPlanQuestion(q), true, q);
    await assert.rejects(tool.run({ description: q }, ctx), /open SPACE and press REVIEW/, q);
  }
  for (const d of [SAMPLES[0], 'Can you design my flat? A kitchen 3 by 3 m and a bedroom.', 'Draw me a floor plan of a two bedroom house']) assert.equal(H.isPlanQuestion(d), false, d);
  await assert.rejects(tool.run({ description: 'make it nice please' }, ctx), /couldn't find any rooms/);
});

test('registration: the group line follows the prompt rules, the words turn it on, and the plain prompt stays within its budget with it', () => {
  assert.match(H.HOMEPLAN_ABOUT, /^You can/);
  assert.ok(H.HOMEPLAN_ABOUT.length <= 220, `${H.HOMEPLAN_ABOUT.length} characters`);
  assert.ok(H.HOMEPLAN_ABOUT.includes('design_home') && !/\n/.test(H.HOMEPLAN_ABOUT));
  assert.ok(H.homePlanTools.every((t) => t.description.length <= 1000));
  assert.equal(H.homePlanTools[0].pure({ description: SAMPLES[0] }), true, 'drawing a plan changes nothing');
  assert.equal(H.homePlanTools[0].pure({ description: 'What do you think of my layout?' }), false, 'a question goes to design_review');
  for (const m of [SAMPLES[0], 'design my house', 'draw me a floor plan', 'two bedrooms upstairs', 'my lounge is 12 ft by 10 ft']) assert.ok(H.HOMEPLAN_WHEN.test(m), m);
  for (const m of ['hello', "what's the weather", 'play some music', 'how are the markets']) assert.ok(!H.HOMEPLAN_WHEN.test(m), m);
  // the plain chat turn with the group named (as tools/index.ts will name it) is still within 5,500 characters
  const client = { name: 'boss', now: 'Fri 17 Oct 14:05', tz: 'Europe/London', tab: 'core', location: { name: 'Birmingham', lat: 52.48, lon: -1.9 } };
  const groups = T.selectGroups('hello', new Set(), false);
  // (once the group is registered in tools/index.ts it is already in `off`; before that the test adds it)
  const withIt = groups.off.some((g) => g.name === 'homeplan') ? groups : { on: groups.on, off: [...groups.off, { name: 'homeplan', tools: H.homePlanTools, when: H.HOMEPLAN_WHEN, about: H.HOMEPLAN_ABOUT }] };
  const plain = P.systemPrompt(client, [], true, [], { code: false, groups: withIt });
  assert.ok(plain.length <= 5500, `plain chat turn with homeplan: ${plain.length} characters`);
  assert.match(plain, /^homeplan: design_home$/m);
  // and a turn that turns it on describes it within the 6,500 characters of tool descriptions a plain turn may have... for the words that do
  const on = T.selectGroups(SAMPLES[0], new Set(), false).on.flatMap((g) => g.tools);
  const described = JSON.stringify(T.toolSpecs([...on, ...H.homePlanTools])).length;
  assert.ok(described < 14000, `${described} characters of tool descriptions`);
  // the name is free, or it is this very tool (the bundles differ, so compare the specs, not the objects)
  const reg = T.TOOLS.find((t) => t.name === 'design_home');
  assert.ok(!reg || JSON.stringify(T.toolSpecs([reg])) === JSON.stringify(T.toolSpecs([H.homePlanTools[0]])), 'design_home is registered with this spec');
});

// ------------------------------------------------------------------ part 2: the hand-off to the phone

const SEMI = 'A three-bed semi. Downstairs: a hall, a living room 4.5 by 3.6 m with a sofa against the long wall, and a kitchen diner 5 by 3 m at the back with a table for 4. Upstairs: a main bedroom 3.8 by 3.2 m with a double bed, a second bedroom 3 by 2.8 m, a small third bedroom and a bathroom.';

/** design_home run as the brain runs it, with the events it sends to the phone. */
async function runTool(args) {
  const events = [];
  const ctx = { storage: {}, env: {}, emit: (e) => events.push(e), progress: () => undefined, vault: { get: async () => null } };
  const text = await H.homePlanTools[0].run(args, ctx);
  return { text, events, sent: events.filter((e) => e.t === 'client' && e.name === 'home_plan') };
}

test('the hand-off: design_home sends the whole plan to the phone as one client event — every floor at full precision, never cut — while the reply stays within budget', async () => {
  assert.ok(PR.CLIENT_COMMANDS.includes('home_plan'), 'home_plan is a command the interface runs');
  for (const [text, floors] of [[SAMPLES[0], 1], [SAMPLES[3], 1], [SEMI, 2], [SAMPLES[2], 2], [BIG, 2]]) {
    const p = plan(text);
    assert.equal(p.storeys.length, floors, text.slice(0, 30));
    const { text: reply, sent } = await runTool({ description: text });
    assert.ok(reply.length <= H.REPLY_MAX, `${text.slice(0, 30)}: the reply is ${reply.length} characters`);
    assert.equal(sent.length, 1, 'one plan event per call');
    const ev = sent[0].args;
    assert.deepEqual(ev, JSON.parse(JSON.stringify(ev)), 'the event is plain JSON');
    assert.equal(ev.words, text);
    assert.equal(ev.unit, p.unit);
    assert.deepEqual(ev.assumed, p.assumed);
    assert.deepEqual(ev.cannot, p.cannot);
    assert.equal(ev.storeys.length, floors, 'every floor');
    ev.storeys.forEach((st, i) => {
      const s = p.storeys[i];
      assert.equal(st.name, s.name);
      // the plan exactly as the planner's own export would write it at full precision: nothing rounded, nothing left out
      assert.deepEqual(st.plan, JSON.parse(JSON.stringify(H.storeyJson(s, 0))));
      assert.equal(st.plan.rooms.length, s.rooms.length);
      assert.equal(st.plan.openings.length, s.openings.length);
      assert.equal(st.plan.items.length, s.items.length, 'every piece of furniture, even when the reply had to leave them out');
      assert.ok(st.plan.items.every((it) => it.id && it.kind && it.h), 'the pieces keep their ids, kinds and heights');
      assert.deepEqual(D.readLayout(st.plan).dropped, []);
    });
  }
  // the big house: the reply had to cut (a floor per call, or less precision) — the event did not
  const big = plan(BIG);
  const { text: bigReply, sent: bigSent } = await runTool({ description: BIG });
  assert.ok(JSON.stringify(bigSent[0].args).length > H.REPLY_MAX, 'the event is bigger than the model may be given');
  assert.ok(bigReply.split('\n').some((l) => /^PLAN \(.*\): too long to send/.test(l)) || bigReply.split('\n').filter((l) => l.startsWith('PLAN') && l.includes('{')).some((l) => JSON.parse(l.slice(l.indexOf('{'))).items.length === 0 || !('id' in JSON.parse(l.slice(l.indexOf('{'))).openings[0])), 'the reply cut something');
  assert.deepEqual(bigSent[0].args.storeys.map((s) => s.plan.rooms.length), big.storeys.map((s) => s.rooms.length));
  // one floor asked for: the reply has that floor, the phone still gets the whole house
  const { sent: one } = await runTool({ description: BIG, floor: 1 });
  assert.equal(one[0].args.storeys.length, 2);
  // the reply tells the model the plan is on the phone already, with the buttons it has; still no rules claimed
  assert.match(bigReply, /already on the owner's phone: the card under your reply has OPEN IN SPACE and SEE IN 3-D/);
  assert.match(bigReply, /says nothing about planning permission or building regulations/);
  // a question about a plan the owner already has sends no plan
  const q = await runTool({ description: 'What do you think of my layout?' }).catch((e) => e);
  assert.ok(q instanceof Error);
  const none = [];
  await H.homePlanTools[0].run({ description: 'What do you think of my layout?' }, { storage: {}, env: {}, emit: (e) => none.push(e), progress: () => undefined, vault: { get: async () => null } }).catch(() => undefined);
  assert.ok(!none.some((e) => e.name === 'home_plan'));
});

test('the phone reads the plan whole: every floor into the planner with every room, door, window and piece; a damaged plan is refused; the lines it shows', async () => {
  for (const text of [SAMPLES[0], SEMI, BIG]) {
    const { sent } = await runTool({ description: text });
    const p = plan(text);
    const kept = W.readHomePlan(sent[0].args, 1700000000000);
    assert.ok(kept, text.slice(0, 30));
    assert.equal(kept.id, '1700000000000');
    assert.equal(kept.storeys.length, p.storeys.length);
    assert.equal(kept.rooms, p.storeys.reduce((n, s) => n + s.rooms.length, 0));
    const m2 = p.storeys.reduce((n, s) => n + s.rooms.reduce((a, r) => a + D.polyArea(r.poly), 0), 0) / 10000;
    assert.ok(near(kept.m2, m2, 0.11), `${kept.m2} m² vs ${m2}`);
    kept.storeys.forEach((st, i) => {
      const planner = RJ.roomToPlan(st.plan);
      assert.equal(planner.rooms.length, p.storeys[i].rooms.length);
      assert.equal(planner.openings.length, p.storeys[i].openings.length);
      assert.equal(planner.items.length, p.storeys[i].items.length);
      assert.ok(W.holdsStorey(planner, st), 'the planner holds the floor it was given');
      assert.ok(!W.holdsStorey(planner, kept.storeys[(i + 1) % kept.storeys.length]) || kept.storeys.length === 1, 'and not another floor');
    });
    assert.deepEqual(kept.assumed, p.assumed);
  }
  // the lines: "Drawn from your words · 6 rooms · 55.8 m²", a house's floors, the owner's unit
  const flat = W.readHomePlan((await runTool({ description: SAMPLES[0] })).sent[0].args);
  assert.match(W.homeLine(flat, 'metric'), /^Drawn from your words · 6 rooms · \d+\.\d m²$/);
  assert.match(W.homeLine(flat, 'imperial'), /^Drawn from your words · 6 rooms · \d+ ft²$/);
  const semi = W.readHomePlan((await runTool({ description: SEMI })).sent[0].args);
  assert.match(W.homeLine(semi, 'metric'), /^Drawn from your words · 2 floors · 8 rooms · \d+\.\d m²$/);
  assert.equal(W.cardLine(6, 55.8, 'metric'), 'Your plan: 6 rooms, 55.8 m²');
  assert.equal(W.cardLine(1, 25.2, 'imperial'), 'Your plan: 1 room, 271 ft²');
  // damaged or empty: refused whole, never shown with parts missing
  const args = (await runTool({ description: SAMPLES[0] })).sent[0].args;
  const broken = structuredClone(args);
  broken.storeys[0].plan.openings[0].wall = 99;
  assert.equal(W.readHomePlan(broken), null, 'a door on a wall that is not there');
  const noRooms = structuredClone(args);
  noRooms.storeys[0].plan.rooms = [];
  assert.equal(W.readHomePlan(noRooms), null);
  assert.equal(W.readHomePlan({}), null);
  assert.equal(W.readHomePlan(null), null);
  assert.equal(W.readHomePlan({ storeys: [1, 2, 3, 4].map(() => args.storeys[0]) }), null, 'four floors is not a home Ghosty draws');
  // the chat card goes under the reply it came with, not above it
  const log = [{ kind: 'user' }, { kind: 'activity' }, { kind: 'home', id: 'a' }, { kind: 'activity' }, { kind: 'assistant' }, { kind: 'user' }, { kind: 'home', id: 'b' }];
  assert.deepEqual(W.homeAfterReply(log).map((e) => e.id ?? e.kind), ['user', 'activity', 'activity', 'assistant', 'a', 'user', 'b']);
});

test('the scripted model (MOCK_LLM): "Design my home …" → design_home with the owner\'s words, the unit said', async () => {
  const tools = [{ type: 'function', function: { name: 'design_home', description: '', parameters: { type: 'object', properties: {} } } }];
  const ask = async (content) => (await M.mockComplete([{ role: 'system', content: 'x' }, { role: 'user', content }], tools)).message.tool_calls?.[0]?.function;
  const a = await ask('Design my home (sizes in metres): A bedroom 3 by 3 m with a double bed.');
  assert.equal(a.name, 'design_home');
  assert.deepEqual(JSON.parse(a.arguments), { description: 'A bedroom 3 by 3 m with a double bed.', unit: 'metric' });
  const b = await ask('Design my home (sizes in feet and inches): A lounge 15 by 12 feet.\nA kitchen off it.');
  assert.deepEqual(JSON.parse(b.arguments), { description: 'A lounge 15 by 12 feet.\nA kitchen off it.', unit: 'imperial' });
  const c = await ask('design my flat: a kitchen and a bedroom');
  assert.deepEqual(JSON.parse(c.arguments), { description: 'a kitchen and a bedroom' });
  // the words turn the group on, so the real brain offers the tool for that message
  assert.ok(H.HOMEPLAN_WHEN.test('Design my home (sizes in metres): A bedroom 3 by 3 m'));
});

test('a real chat turn: the brain streams the plan to the phone as the home_plan event, between the tool and its result, every floor whole', async () => {
  const mod = await import('./.build/homeplan/brain.mjs');
  class Mem {
    m = new Map();
    async get(k) { return Array.isArray(k) ? new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))])) : this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
    async put(k, v) { if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b)); else this.m.set(k, structuredClone(v)); }
    async delete(k) { return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k); }
    async list({ prefix = '' } = {}) { return new Map([...this.m].filter(([k]) => k.startsWith(prefix)).sort().map(([k, v]) => [k, structuredClone(v)])); }
    async setAlarm() {}
    async getAlarm() { return null; }
  }
  const { webcrypto } = await import('node:crypto');
  const OWNER_KEY = 'test-owner-key-0123456789abcdef';
  const pending = [];
  const state = { storage: new Mem(), waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() };
  const env = { OWNER_KEY, VAULT_KEY: Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString('base64'), MOCK_LLM: '1' };
  let agent;
  env.AGENT = { idFromName: (n) => ({ toString: () => n }), get: () => ({ fetch: (r) => (agent ??= new mod.GhostyAgent(state, env)).fetch(r) }) };
  const wctx = { waitUntil: (p) => pending.push(p), passThroughOnException() {} };
  const r = await mod.default.fetch(new Request('https://ghosty.test/api/chat', { method: 'POST', body: JSON.stringify({ message: `Design my home (sizes in metres): ${SEMI}` }), headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': OWNER_KEY } }), env, wctx);
  assert.equal(r.status, 200);
  const events = (await r.text()).trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  await Promise.allSettled(pending.splice(0));
  const tool = events.findIndex((e) => e.t === 'tool' && e.name === 'design_home');
  const client = events.findIndex((e) => e.t === 'client' && e.name === 'home_plan');
  const result = events.findIndex((e) => e.t === 'tool_result' && e.name === 'design_home');
  assert.ok(tool >= 0 && client > tool && result > client, JSON.stringify(events.map((e) => `${e.t}:${e.name ?? ''}`)));
  assert.equal(events[result].ok, true);
  const ev = events[client].args;
  const p = plan(SEMI, 'metric');
  assert.equal(ev.unit, 'metric');
  assert.deepEqual(ev.storeys.map((s) => s.plan.rooms.length), p.storeys.map((s) => s.rooms.length));
  assert.deepEqual(ev.storeys[1].plan, JSON.parse(JSON.stringify(H.storeyJson(p.storeys[1], 0))), 'the upstairs whole, as the tool drew it');
  assert.ok(W.readHomePlan(ev), 'and the phone takes it');
  assert.ok(events.some((e) => e.t === 'text'), 'and the chat gets its reply');
});
