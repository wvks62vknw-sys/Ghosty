// 3D STUDIO's pure parts (apps/web/src/studio/*, model3d.ts): where parts go when a model is taken
// apart, splitting one mesh into its connected pieces, a room's JSON into boxes, the Spline link
// check, and reading the Hunyuan3D-2 Space's Gradio answers (fixtures captured from the live Space).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const E = await import('./.build/studio/explode.mjs');
const P = await import('./.build/studio/split.mjs');
const R = await import('./.build/studio/room.mjs');
const SP = await import('./.build/studio/spline.mjs');
const M = await import('./.build/model3d.mjs');
const FX = JSON.parse(readFileSync(new URL('./model3d.fixture.json', import.meta.url), 'utf8'));

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const len = (v) => Math.hypot(...v);

test('take apart: each part moves out along the line from the centre, further when further out; parts at the centre stack along the axis', () => {
  const centre = [0, 0, 0];
  const parts = [[1, 0, 0], [0, 2, 0], [0, 0, -0.5], [0, 0, 0], [0.0001, 0, 0], [0, 0, 0]];
  const off = E.explodeOffsets(centre, parts, 4, 1, [0, 0, 1]);
  assert.equal(off.length, parts.length);
  // direction: same as centre → part
  assert.ok(off[0][0] > 0 && near(off[0][1], 0) && near(off[0][2], 0));
  assert.ok(off[1][1] > 0 && near(off[1][0], 0));
  assert.ok(off[2][2] < 0);
  // further out goes further (1.2 × distance + 0.35 × size)
  assert.ok(near(len(off[0]), 1.2 * 1 + 0.35 * 4));
  assert.ok(near(len(off[1]), 1.2 * 2 + 0.35 * 4));
  // the three at the centre are stacked along z: the middle one stays, the others go either way
  const lone = [off[3], off[4], off[5]];
  for (const v of lone) assert.ok(near(v[0], 0) && near(v[1], 0));
  assert.deepEqual(lone.map((v) => Math.round(v[2] * 100) / 100), [-1.6, 0, 1.6]);
  // a single part at the centre stays put while the others move off it
  const one = E.explodeOffsets(centre, [[1, 0, 0], [0, 0, 0]], 2);
  assert.deepEqual(one[1], [0, 0, 0]);
  // spread scales everything
  const half = E.explodeOffsets(centre, parts, 4, 0.5, [0, 0, 1]);
  assert.ok(near(len(half[0]), len(off[0]) / 2));
  // at() and ease()
  assert.deepEqual(E.at([1, 1, 1], [2, 0, -2], 0.5), [2, 1, 0]);
  assert.equal(E.ease(0), 0);
  assert.equal(E.ease(1), 1);
  assert.ok(near(E.ease(0.5), 0.5));
  assert.equal(E.ease(2), 1);
  assert.deepEqual(E.thinnestAxis([4, 0.5, 3]), [0, 1, 0]);
  assert.deepEqual(E.thinnestAxis([0.1, 0.5, 3]), [1, 0, 0]);
  assert.deepEqual(E.thinnestAxis([4, 5, 3]), [0, 0, 1]);
});

test('measure: distances in cm and m for real-size models, model units otherwise', () => {
  assert.equal(E.fmtLength(0.0304, true), '3.0 cm');
  assert.equal(E.fmtLength(2.345, true), '2.35 m');
  assert.equal(E.fmtLength(1.5, false), '1.500 units');
  assert.equal(E.fmtLength(12.5, false), '12.50 units');
  assert.equal(E.fmtLength(Number.NaN, true), '—');
});

// Two separate quads (two triangles each) and a lone triangle: three pieces. The second quad's
// corners are duplicated (a texture seam): welded by position, it is still one piece.
const quadA = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0];
const quadB = [5, 0, 0, 6, 0, 0, 6, 1, 0, 5, 1, 0, /* seam copies */ 6, 1, 0, 5, 0, 0];
const tri = [10, 0, 0, 11, 0, 0, 10, 1, 0];
const pos = new Float32Array([...quadA, ...quadB, ...tri]);
const index = new Uint32Array([0, 1, 2, 0, 2, 3, /* quad B, the second triangle uses the seam copies */ 4, 5, 6, 9, 8, 7, /* tri */ 10, 11, 12]);

test('split: connected pieces, welded across seams, biggest first', () => {
  const pieces = P.splitPieces(pos, index, { minShare: 0 });
  assert.equal(pieces.length, 3);
  assert.deepEqual(pieces.map((p) => [...p]), [[0, 1], [2, 3], [4]]);
  // non-indexed (every three vertices a triangle): two touching triangles are one piece, a far one another
  const flat = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 9, 9, 9, 10, 9, 9, 9, 10, 9]);
  assert.deepEqual(P.splitPieces(flat, null, { minShare: 0 }).map((p) => [...p]), [[0, 1], [2]]);
  // one piece only
  assert.equal(P.splitPieces(new Float32Array(quadA), new Uint32Array([0, 1, 2, 0, 2, 3])).length, 1);
  assert.deepEqual(P.splitPieces(new Float32Array(0), null), []);
});

test('split: crumbs and pieces past the limit join the nearest kept piece', () => {
  // maxParts 2: the lone triangle (far right) joins quad B, its nearest
  const two = P.splitPieces(pos, index, { maxParts: 2, minShare: 0 });
  assert.equal(two.length, 2);
  assert.deepEqual(two.map((p) => [...p]), [[0, 1], [2, 3, 4]]);
  // a crumb under the minimum share joins too (1 triangle of 5 = 20 % < 25 %)
  const big = P.splitPieces(pos, index, { minShare: 0.25 });
  assert.deepEqual(big.map((p) => [...p]), [[0, 1], [2, 3, 4]]);
  // every triangle is kept exactly once
  const all = big.flatMap((p) => [...p]).sort((a, b) => a - b);
  assert.deepEqual(all, [0, 1, 2, 3, 4]);
});

test('split: a piece as its own small mesh (vertices renumbered)', () => {
  const s = P.subsetIndex(index, [2, 3]);
  assert.deepEqual([...s.vertices], [4, 5, 6, 9, 8, 7]);
  assert.deepEqual([...s.index], [0, 1, 2, 3, 4, 5]);
  const t = P.subsetIndex(null, [1]);
  assert.deepEqual([...t.vertices], [3, 4, 5]);
  assert.deepEqual([...t.index], [0, 1, 2]);
});

test('room: the planner JSON (cm) → floor, four walls and items in metres; misfits named', () => {
  const plan = R.parseRoom(JSON.stringify({ room: { w: 400, d: 300, h: 250 }, items: [{ name: 'Sofa', w: 200, d: 90, h: 85, x: 20, y: 200, rot: 0 }, { name: 'Bed', w: 200, d: 150, x: 300, y: 100, rot: 90 }, { name: 'Lamp', w: 30, d: 30, h: 300, x: 0, y: 0 }, { name: 'bad', w: -1, d: 3, x: 0, y: 0 }] }));
  assert.equal(plan.items.length, 3, 'an item with no real size is dropped');
  const { boxes, warnings } = R.roomBoxes(plan);
  assert.deepEqual(boxes.map((b) => b.kind), ['floor', 'wall', 'wall', 'wall', 'wall', 'item', 'item', 'item']);
  const floor = boxes[0];
  assert.deepEqual(floor.size, [4, 0.02, 3]);
  const back = boxes.find((b) => b.name === 'Back wall');
  assert.ok(near(back.pos[2], -1.5 - R.WALL_M / 2) && near(back.size[1], 2.5) && near(back.pos[1], 1.25));
  const left = boxes.find((b) => b.name === 'Left wall');
  assert.ok(near(left.pos[0], -2 - R.WALL_M / 2) && near(left.size[2], 3));
  // the sofa: corner (20, 200) cm, 200 × 90 → centre (1.2, 2.45) m on the plan → (−0.8, 0.95) about the room's centre
  const sofa = boxes.find((b) => b.name === 'Sofa');
  assert.ok(near(sofa.pos[0], -0.8) && near(sofa.pos[2], 0.95) && near(sofa.pos[1], 0.425), JSON.stringify(sofa));
  assert.deepEqual(sofa.size.map((v) => Math.round(v * 100) / 100), [2, 0.85, 0.9]);
  assert.equal(sofa.rotY, 0);
  // the bed, turned 90° clockwise on the plan: a negative turn about the up axis; it sticks out at the right
  const bed = boxes.find((b) => b.name === 'Bed');
  assert.ok(near(bed.rotY, -Math.PI / 2));
  assert.ok(near(bed.size[1], 0.75), 'height defaults to 75 cm');
  assert.deepEqual(warnings, ['Bed sticks out of the room', 'Lamp is taller than the room']);
  // just sizes, no items; height defaults to 240 cm
  const plain = R.roomBoxes(R.parseRoom({ w: '350', d: 280 }));
  assert.equal(plain.boxes.length, 5);
  assert.ok(near(plain.boxes[1].size[1], 2.4));
  // refusals in words
  assert.throws(() => R.parseRoom('{nope'), /not room JSON/);
  assert.throws(() => R.parseRoom({ room: { w: 400 } }), /width \(w\) and a depth \(d\)/);
  assert.throws(() => R.parseRoom({ room: { w: 10, d: 300 } }), /between 50 cm and 50 m/);
  assert.throws(() => R.parseRoom({ room: { w: 400, d: 300, h: 20 } }), /height/);
});

test('spline: only my.spline.design public scene links; the iframe code works too; everything else refused in words', () => {
  assert.deepEqual(SP.splineEmbedUrl('https://my.spline.design/untitled-abc123def456/'), { ok: true, url: 'https://my.spline.design/untitled-abc123def456/' });
  assert.deepEqual(SP.splineEmbedUrl('https://my.spline.design/robot-0a1B2c?utm=x#y'), { ok: true, url: 'https://my.spline.design/robot-0a1B2c/' });
  assert.deepEqual(SP.splineEmbedUrl('my.spline.design/robot-0a1b2c/'), { ok: true, url: 'https://my.spline.design/robot-0a1b2c/' });
  assert.deepEqual(SP.splineEmbedUrl("<iframe src='https://my.spline.design/robot-0a1b2c/' frameborder='0' width='100%' height='100%'></iframe>"), { ok: true, url: 'https://my.spline.design/robot-0a1b2c/' });
  const no = (u, re) => {
    const r = SP.splineEmbedUrl(u);
    assert.equal(r.ok, false, u);
    assert.match(r.why, re, u);
  };
  no('', /Public URL/);
  no('not a link', /not a web address/);
  no('https://evil.example/robot/', /only Spline public scenes/);
  no('https://my.spline.design.evil.example/robot/', /only Spline public scenes/);
  no('https://evil.example/?https://my.spline.design/robot/', /only Spline public scenes/);
  no('http://my.spline.design/robot/', /https/);
  no('https://user:pw@my.spline.design/robot/', /extra parts/);
  no('https://my.spline.design:8443/robot/', /extra parts/);
  no('https://my.spline.design/a/b/', /not a Spline scene address/);
  no('https://my.spline.design/', /not a Spline scene address/);
  no('https://app.spline.design/file/8a1b-22', /editor/);
  no('https://prod.spline.design/UWoeqiir20o49Dah/scene.splinecode', /code export/);
  no('javascript:alert(1)', /only Spline public scenes|not a web address/);
});

test('gradio: the queue stream, the function names and the file in the answer (live fixtures)', () => {
  const evs = M.parseSse(FX.sseShape);
  assert.deepEqual(evs.map((e) => e.msg), ['estimation', 'process_starts', 'process_completed', 'close_stream']);
  const done = evs[2];
  assert.equal(done.success, true);
  assert.equal(M.fileFrom(done.output.data), 'https://tencent-hunyuan3d-2.hf.space/file=/tmp/gradio/f0c88515f1f3accf7dcedb15b5862d091c266e7eed72976f55e8e3369a201e4b/white_mesh.glb');
  // the lightened copy comes back inside an update, second in the list
  const light = M.parseSse(FX.sseExport).find((e) => e.msg === 'process_completed');
  assert.match(M.fileFrom(light.output.data), /^https:\/\/tencent-hunyuan3d-2\.hf\.space\/file=\/tmp\/gradio\/6f55e7.*\/white_mesh\.glb$/);
  // a path without a url becomes a /file= address; an address on another host is never used
  assert.equal(M.fileFrom([{ path: '/tmp/x.glb' }]), `${M.SPACE}/file=/tmp/x.glb`);
  assert.equal(M.fileFrom([{ url: 'https://evil.example/x.glb' }]), null);
  assert.equal(M.fileFrom('nope'), null);
  // functions by API name (fn index and the click that triggers it)
  assert.deepEqual(M.findFn(FX.config, 'shape_generation'), { fnIndex: 5, triggerId: 18 });
  assert.equal(M.findFn(FX.config, 'on_export_click').fnIndex, 14);
  assert.equal(M.findFn(FX.config, 'nope'), null);
  assert.equal(M.findFn({}, 'shape_generation'), null);
  // half a line at the end of a chunk is skipped, not a crash
  assert.deepEqual(M.parseSse('data: {"msg":"estimation","rank":2}\n\ndata: {"msg":"proc').map((e) => e.msg), ['estimation']);
});

test('gradio: failures in words — the ZeroGPU quota with when to try again, a full queue, no reason', () => {
  const q = M.parseSse(FX.sseQuota).find((e) => e.msg === 'process_completed');
  const f = M.failureText(q, false);
  assert.equal(f.status, 429);
  assert.match(f.text, /used up today's GPU allowance — try again in about 13 h 46 min\./);
  assert.match(f.text, /free Hugging Face token \(SYSTEM → KEYS → Hugging Face\)/);
  assert.doesNotMatch(M.failureText(q, true).text, /token/, 'no token tip when a token is already used');
  // the runs-a-day cap says 0:00:00: no time is named
  assert.match(M.failureText({ msg: 'process_completed', success: false, output: { error: 'You have exceeded your free GPU quota (60s requested vs. 0s left). Try again in 0:00:00' } }, false).text, /try again later today or tomorrow/);
  assert.match(M.failureText({ msg: 'process_completed', success: false, output: { error: 'Unlogged user is runnning out of daily ZeroGPU quotas. <a href="https://huggingface.co/join">Signup</a>' } }, false).text, /GPU allowance/);
  assert.equal(M.failureText({ msg: 'queue_full' }, false).status, 503);
  assert.match(M.failureText({ msg: 'process_completed', success: false, output: { error: null } }, false).text, /plain background/);
  assert.match(M.failureText({ msg: 'process_completed', success: false, output: { error: '<b>Bad</b> image' } }, false).text, /could not do it: Bad image/);
  assert.equal(M.retryIn('Try again in 1:05:00'), 'about 1 h 5 min');
  assert.equal(M.retryIn('Try again in 0:12:30'), 'about 12 min');
  assert.equal(M.retryIn('no time'), null);
});
