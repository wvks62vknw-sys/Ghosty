// THE ONE LENS's rules (BRIEF-LENS), pure: the tag kinds and their acts as a table; the "text present" check on three drawn
// frames (print, an empty wall, sensor noise) and the budget it must keep (under 4 ms a frame here); the steady-frame rule on a
// run of frames (and how its threshold was chosen); the two-second life of a tag; what the Lens tells the brain about its tags
// (counts and kinds, never who); the mark on the bar; the words under a tag ("looks like" only after the namer has looked).
// Run from lens.test.mjs: the test list in package.json is protected. Built from apps/web/src/vision/tags.ts (through frame.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';

const F = await import('./.build/frame.mjs');

// ---- three drawn frames, 160 × 120, from a seeded generator (so the same frames every run)
const W = 160;
const H = 120;
const seeded = (seed) => () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const flat = (v) => ({ data: new Uint8Array(W * H).fill(v), w: W, h: H });
/** Print: three lines of glyphs, each a few thin dark strokes (1 px wide, 4–8 long, across and down) on a light page, with word gaps. */
function print(seed = 7, shift = 0) {
  const rnd = seeded(seed);
  const g = flat(235);
  for (const ly of [20, 38, 56]) {
    let x = 10;
    while (x < 140) {
      const cw = 4 + ((rnd() * 3) | 0);
      for (let s = 0; s < 3; s++) {
        const sx = x + ((rnd() * cw) | 0);
        const sy = ly + ((rnd() * 4) | 0);
        const horiz = rnd() < 0.5;
        const len = 4 + ((rnd() * 5) | 0);
        for (let k = 0; k < len; k++) {
          const px = (horiz ? sx + k : sx) + shift;
          const py = horiz ? sy : sy + k;
          if (px >= 0 && px < W && py < H) g.data[py * W + px] = 40;
        }
      }
      x += cw + 2 + (rnd() < 0.15 ? 5 : 0);
    }
  }
  return g;
}
const noise = (seed = 3) => {
  const rnd = seeded(seed);
  const g = flat(0);
  for (let i = 0; i < g.data.length; i++) g.data[i] = rnd() * 255;
  return g;
};
/** A smooth thing on a plain wall (a lemon's outline: one edge, no strokes) and a gradient. */
const blob = () => {
  const g = flat(240);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (((x - 80) ** 2) / 2500 + ((y - 60) ** 2) / 1600 < 1) g.data[y * W + x] = 150;
  return g;
};
const gradient = () => {
  const g = flat(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g.data[y * W + x] = 60 + x;
  return g;
};

test('the tag kinds and their acts, as a table (a face never has an act; a part also offers FIND THE PART)', () => {
  assert.deepEqual(Object.keys(F.TAG_ACTS).sort(), ['code', 'face', 'object', 'stranger', 'text']);
  assert.deepEqual(F.TAG_ACTS.text.map((a) => a.word), ['READ', 'TRANSLATE', 'ASK']);
  assert.deepEqual(F.TAG_ACTS.code.map((a) => a.word), ['LOOK', 'ASK']);
  assert.deepEqual(F.TAG_ACTS.object.map((a) => a.word), ['NAME IT', 'ASK', 'MEASURE']);
  // a face he knows and a stranger: nothing to ask, nothing to look up: a face never leaves the phone
  assert.deepEqual(F.TAG_ACTS.face, []);
  assert.deepEqual(F.TAG_ACTS.stranger, []);
  // the acts that go to the brain say so (they are greyed with no signal); reading, the codes and measuring do not
  const brain = Object.values(F.TAG_ACTS).flat().filter((a) => a.brain).map((a) => a.word).sort();
  assert.deepEqual([...new Set(brain)], ['ASK', 'TRANSLATE']);
  assert.ok(F.actsFor('object', { named: true, part: true }).map((a) => a.word).includes('FIND THE PART'));
  assert.ok(!F.actsFor('object', { named: true }).some((a) => a.id === 'findpart'));
  // NAME IT only once there is a name; before that the object has ASK and MEASURE
  assert.deepEqual(F.actsFor('object', { named: false }).map((a) => a.word), ['ASK', 'MEASURE']);
  assert.ok(F.FIND_PART.brain, 'finding a part goes to the brain');
  // every act has a name VoiceOver can say
  for (const a of Object.values(F.TAG_ACTS).flat()) assert.ok(a.name.length > 8 && /^[A-Z]/.test(a.name), a.id);
});

test('"text present": print, an empty wall, a gradient, a smooth thing and noise (and it never says what the text is)', () => {
  const p = F.textTiles(print());
  assert.ok(p.length >= 1, 'print is found');
  assert.ok(p[0].tiles >= 8, `a block of print, not a speck: ${p[0].tiles} tiles`);
  const b = p[0].box;
  assert.ok(b.x >= 0 && b.y >= 8 && b.x + b.w <= W && b.y + b.h <= H, 'the box is inside the frame');
  assert.ok(b.w >= 60, `the box spans the line of print: ${b.w}`);
  assert.deepEqual(Object.keys(p[0]).sort(), ['box', 'score', 'tiles'], 'a box and a score: nothing about WHAT it says');
  assert.equal(F.textTiles(flat(120)).length, 0, 'an empty wall');
  assert.equal(F.textTiles(gradient()).length, 0, 'a gradient');
  assert.equal(F.textTiles(blob()).length, 0, 'a smooth thing on a plain wall: its outline is one edge, not strokes');
  assert.equal(F.textTiles(noise()).length, 0, 'noise has an edge everywhere: that is not print');
  // a frame too small to tile says nothing
  assert.equal(F.textTiles({ data: new Uint8Array(16 * 16), w: 16, h: 16 }).length, 0);
});

test('"text present" costs under 4 ms a frame (the budget, on this CPU)', () => {
  const frames = [print(7), print(8), noise(), blob()];
  for (const f of frames) F.textTiles(f);
  const n = 300;
  const t0 = performance.now();
  for (let i = 0; i < n; i++) F.textTiles(frames[i % frames.length]);
  const ms = (performance.now() - t0) / n;
  console.log(`text-present check: ${ms.toFixed(3)} ms a frame (160 × 120)`);
  assert.ok(ms < 4, `${ms.toFixed(2)} ms a frame`);
  // and the grey conversion that feeds it
  const rgba = new Uint8ClampedArray(W * H * 4).fill(200);
  const t1 = performance.now();
  for (let i = 0; i < n; i++) F.greyOf(rgba, W, H);
  assert.ok((performance.now() - t1) / n < 2, 'the grey frame is cheap too');
});

test('the steady frame: under the threshold for 400 ms, once for each stretch of stillness (the threshold sits between sensor noise and a hand moving)', () => {
  assert.equal(F.STEADY_MS, 400);
  const still = (i) => {
    // a held phone: the same page with sensor noise of a grey level or two
    const g = print(7);
    const rnd = seeded(100 + i);
    for (let k = 0; k < g.data.length; k++) g.data[k] = Math.max(0, Math.min(255, g.data[k] + ((rnd() * 5) | 0) - 2));
    return g;
  };
  const noiseDiff = F.frameDiff(still(1), still(2));
  const shake = F.frameDiff(print(7, 0), print(7, 3));
  const slow = F.frameDiff(print(7, 0), print(7, 1));
  console.log(`frame difference: sensor noise ${noiseDiff.toFixed(2)}, a 1 px drift ${slow.toFixed(2)}, a 3 px move ${shake.toFixed(2)}; threshold ${F.STEADY_DIFF}`);
  assert.ok(noiseDiff < F.STEADY_DIFF / 2, `noise ${noiseDiff}`);
  assert.ok(shake > F.STEADY_DIFF, `a 3 px move ${shake} is over the threshold`);
  assert.ok(F.frameDiff(flat(10), { data: new Uint8Array(4), w: 2, h: 2 }) === 255, 'frames of two sizes are never steady');

  const s = new F.Steady();
  let t = 0;
  const step = (g) => s.push(g, (t += 100));
  assert.equal(step(still(0)), false, 'the first frame (100 ms) has nothing to compare with');
  assert.equal(step(still(1)), false, 'still from 200 ms');
  for (const i of [2, 3, 4]) assert.equal(step(still(i)), false, `${(i + 1) * 100} ms: not yet 400 ms of stillness`);
  assert.equal(step(still(5)), true, 'steady at 600 ms: 400 ms of stillness');
  assert.equal(s.epoch, 1);
  assert.equal(step(still(6)), true, 'and stays steady: still the first stretch');
  assert.equal(s.epoch, 1, 'a long hold is one epoch, not one for every frame');
  assert.equal(step(print(7, 3)), false, 'a move ends it');
  assert.equal(s.steady, false);
  for (let i = 0; i < 4; i++) step(print(7, 3));
  assert.equal(step(print(7, 3)), true, 'still again for 400 ms: steady again');
  assert.equal(s.epoch, 2, 'a new stretch of stillness is a new epoch');
  s.reset();
  assert.deepEqual([s.steady, s.epoch], [false, 0]);

  // the heavy gate: one pass at a time, once for each stretch
  const gate = new F.HeavyGate();
  const st = { steady: true, epoch: 1 };
  assert.equal(gate.allow({ steady: false, epoch: 1 }), false, 'never on a frame that is moving');
  assert.equal(gate.allow(st), true);
  gate.start(st);
  assert.equal(gate.allow({ steady: true, epoch: 2 }), false, 'one heavy pass at a time');
  gate.finish();
  assert.equal(gate.allow(st), false, 'the same stretch is not looked at twice');
  assert.equal(gate.allow({ steady: true, epoch: 2 }), true, 'a new stretch is');
  gate.reset();
  assert.equal(gate.allow(st), true);
});

test('a tag lives two seconds after its last sighting, fades, and a sighting under its floor makes none', () => {
  assert.equal(F.TAG_LIFE_MS, 2000);
  const tags = new F.Tags();
  const box = { x: 100, y: 100, w: 200, h: 80 };
  const text = { kind: 'text', box, score: 0.8, truth: F.TEXT_TRUTH };
  assert.equal(tags.see([{ ...text, score: F.FLOOR.text - 0.01 }], 0).length, 0, 'under the floor: no tag');
  assert.equal(tags.see([{ ...text, box: { x: 0, y: 0, w: 0, h: 0 } }], 0).length, 0, 'no box: no tag');
  assert.equal(tags.alive(0).length, 0);
  const born = tags.see([text], 1000);
  assert.equal(born.length, 1);
  // seen again, a little moved: the same tag (a shaking phone does not make three)
  assert.equal(tags.see([{ ...text, box: { ...box, x: 108 } }], 1500).length, 0);
  assert.equal(tags.alive(1500).length, 1);
  assert.equal(tags.alive(3499).length, 1, 'alive until 2 s after the last sighting (1500 + 2000)');
  assert.equal(tags.fade(tags.alive(3499)[0], 3499) > 0.9, true, 'and nearly gone');
  assert.equal(tags.fade(tags.alive(1600)[0], 1600), 0, 'fresh: no fade');
  assert.equal(tags.alive(3500).length, 0, 'gone at 2 s');
  assert.equal(tags.faded, 1);
  // a new sighting afterwards is a new tag
  assert.equal(tags.see([text], 5000).length, 1);
  // a heavy sighting is held while the frame is steady (the frame has not moved, so the thing is still there), then it fades
  const t2 = new F.Tags();
  t2.see([{ kind: 'object', box, score: 0.9, truth: 'looks like a mug', hold: 1 }], 0);
  t2.keep(1, true, 1900);
  t2.keep(1, true, 3800);
  assert.equal(t2.alive(3900).length, 1, 'held while steady');
  t2.keep(1, false, 5000);
  assert.equal(t2.alive(5900).length, 0, 'the frame moved: two seconds later it is gone');
  // and a new stretch of stillness (something covered the lens, or the phone moved on) does not keep what an older one saw
  const t4 = new F.Tags();
  t4.see([{ kind: 'object', box, score: 0.9, truth: 'looks like a mug', hold: 1 }], 0);
  t4.keep(2, true, 1500);
  t4.keep(2, true, 3000);
  assert.equal(t4.alive(3100).length, 0, 'held in epoch 1 only: epoch 2 keeps nothing of it');
  // a code is one tag for as long as its text is the same, wherever it moves
  const t3 = new F.Tags();
  t3.see([{ kind: 'code', box, score: 1, truth: 'a web address', data: { text: 'https://a.example' } }], 0);
  assert.equal(t3.see([{ kind: 'code', box: { x: 400, y: 10, w: 50, h: 50 }, score: 1, truth: 'a web address', data: { text: 'https://a.example' } }], 100).length, 0);
  assert.equal(t3.see([{ kind: 'code', box, score: 1, truth: 'a product barcode', data: { text: '3017620422003' } }], 100).length, 1, 'another code is another tag');
  // a tag can be dropped (a code found where print was seen)
  t3.drop((t) => t.kind === 'code' && t.data.text === 'https://a.example');
  assert.equal(t3.alive(150).length, 1);
});

test('what the Lens tells the brain: counts and kinds, never who', () => {
  assert.equal(F.contextWords([]), 'no tags yet');
  assert.equal(F.contextWords([{ kind: 'text' }, { kind: 'code' }, { kind: 'face' }]), '3 tags: text, a code, someone I know');
  assert.equal(F.contextWords([{ kind: 'face' }]), '1 tag: someone I know');
  assert.equal(F.contextWords([{ kind: 'stranger' }, { kind: 'text' }, { kind: 'text' }]), '3 tags: text, someone I don’t know');
  // the words are made from kinds alone: a tag's label (a known person's name) is not an input
  const line = F.contextWords([{ kind: 'face', data: { label: 'Quorrin Vexmoor' }, truth: 'Quorrin Vexmoor' }]);
  assert.ok(!/Quorrin|Vexmoor/.test(line), line);
  assert.equal(F.contextWords.length, 1, 'one argument: the tags');
});

test('the mark on the bar: WORKING, DEGRADED, OFFLINE', () => {
  assert.equal(F.markOf({ cheap: true, heavy: true, online: true }), 'working');
  assert.equal(F.markOf({ cheap: true, heavy: false, online: true }), 'degraded', 'the heavy detectors are not on the phone');
  assert.equal(F.markOf({ cheap: false, heavy: true, online: true }), 'degraded', 'the cheap pass could not start');
  assert.equal(F.markOf({ cheap: true, heavy: true, online: false }), 'offline');
  assert.equal(F.markOf({ cheap: true, heavy: false, online: false }), 'offline', 'offline says the most');
  assert.deepEqual(F.MARK_WORDS, { working: 'WORKING', degraded: 'DEGRADED', offline: 'OFFLINE' });
});

test('the words under a tag: never a guess, "looks like" only after the namer has looked', () => {
  assert.equal(F.TEXT_TRUTH, 'I see text — tap to read it');
  assert.equal(F.objectTruth(null, false), 'something here · hold still', 'before the namer: only that something is there');
  assert.ok(!/looks like/.test(F.objectTruth({ label: 'mug', p: 0.9 }, false)), 'no name before the heavy pass has run');
  assert.equal(F.objectTruth({ label: 'mug', p: 0.6 }, true), 'looks like a mug');
  assert.equal(F.objectTruth({ label: 'apple', p: 0.6 }, true), 'looks like an apple');
  assert.equal(F.objectTruth({ label: 'mug', p: F.NAME_FLOOR - 0.01 }, true), 'something I can’t name yet', 'under the floor: what it can say');
  assert.equal(F.codeTruth('url'), 'a web address');
  assert.equal(F.codeTruth('product'), 'a product barcode');
  assert.equal(F.codeTruth('anything', false), 'a code I can’t read yet');
  assert.ok(F.isPartName('front brake disc') && F.isPartName('Spark plug') && !F.isPartName('mug'));
  assert.ok(F.isPlantName('fern') && !F.isPlantName('lemon'));
});

test('TRANSLATE only for words that are not English; his words for the Lens', () => {
  assert.equal(F.looksEnglish('Please do not touch the paintings, thank you for your help'), true);
  assert.equal(F.looksEnglish('Ne pas toucher les peintures, merci de votre compréhension'), false);
  assert.equal(F.looksEnglish('Bitte nicht berühren, danke für Ihr Verständnis'), false);
  assert.equal(F.looksEnglish('请勿触摸展品，谢谢您的合作'), false, 'another script');
  assert.equal(F.looksEnglish('STOP'), true, 'too short to say: nothing is translated on a guess');
  const w = F.lensWord;
  for (const t of ['read that', 'Read it', 'please read this text']) assert.equal(w(t), 'read', t);
  for (const t of ["what's that", 'What is that?', 'what is it']) assert.equal(w(t), 'what', t);
  assert.equal(w('translate it'), 'translate');
  assert.equal(w('measure that'), 'measure');
  assert.equal(w('name it'), 'name');
  assert.equal(w('ask about it'), 'ask');
  assert.equal(w('look at that'), 'look');
  assert.equal(w('scan this'), 'look');
  for (const t of ['read me a story about dragons', 'what is the weather', 'translate it into french and email it to my mother later today please', '']) assert.equal(w(t), null, t);
});

// ---- ONE TAG PER KIND, AT MOST THREE (OWNER-ISSUES 153: "loads of text on the screen like translate and read and ask, loads of times").
// Three drawn frames, 640 × 480, as the detectors would see them. On the old code each region of print was a tag with its own row of
// keys, and a page of print had as many tags as the text check found regions.
const FRAME = { w: 640, h: 480 };
const textAt = (x, y, w, h, score = 0.8) => ({ kind: 'text', box: { x, y, w, h }, score, truth: F.TEXT_TRUTH });
/** A page of print: eight regions (headline, two columns of paragraphs, a caption), close together, over most of the page. */
const pageOfPrint = () => [
  textAt(60, 40, 520, 50), textAt(60, 110, 250, 70), textAt(60, 190, 250, 80), textAt(330, 110, 250, 60),
  textAt(330, 180, 250, 90), textAt(60, 290, 250, 60), textAt(330, 290, 250, 70), textAt(60, 370, 520, 40),
];
const keyRows = (tags, now) => tags.alive(now).reduce((n, t) => n + F.actsFor(t.kind, {}).length, 0);

test('a page of print with eight text regions is ONE text tag: the union of the regions, one row of keys', () => {
  assert.equal(pageOfPrint().length, 8);
  const merged = F.mergeSightings(pageOfPrint(), FRAME);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].kind, 'text');
  assert.deepEqual(merged[0].box, { x: 60, y: 40, w: 520, h: 370 }, 'the union of the eight boxes');
  const tags = new F.Tags();
  assert.equal(tags.see(pageOfPrint(), 0, FRAME).length, 1, 'one tag born for the whole page');
  assert.equal(tags.alive(0).length, 1);
  assert.deepEqual(tags.alive(0)[0].box, merged[0].box);
  assert.equal(F.actsFor('text').map((a) => a.word).join(), 'READ,TRANSLATE,ASK');
  assert.equal(keyRows(tags, 0), 3, 'READ · TRANSLATE · ASK once, not once for each region');
  // pass after pass, a different few of the regions each time (the check returns three at most) and a shaking phone: still one
  for (let i = 0; i < 12; i++) {
    const some = pageOfPrint().filter((_, k) => (k + i) % 3 !== 0).map((s) => ({ ...s, box: { ...s.box, x: s.box.x + (i % 2) * 6, y: s.box.y - (i % 3) * 4 } }));
    tags.see(some, 100 * (i + 1), FRAME);
    assert.equal(tags.alive(100 * (i + 1)).filter((t) => t.kind === 'text').length, 1, `pass ${i}: one text tag`);
  }
  // a real drawn page of print through the real text check: whatever blocks it finds are one tag
  const g = print(11);
  const found = F.textTiles(g);
  assert.ok(found.length >= 1);
  const t2 = new F.Tags();
  t2.see(found.map((b) => ({ kind: 'text', box: { x: b.box.x * 4, y: b.box.y * 4, w: b.box.w * 4, h: b.box.h * 4 }, score: Math.max(0.5, b.score), truth: F.TEXT_TRUTH })), 0, FRAME);
  assert.equal(t2.alive(0).length, 1);
});

test('two pieces of print far apart: the larger cluster is the tag, not both', () => {
  const near = [textAt(20, 20, 200, 60), textAt(20, 90, 200, 60), textAt(20, 160, 200, 60)];
  const far = [textAt(500, 380, 120, 40)];
  const merged = F.mergeSightings([...far, ...near], FRAME);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].box, { x: 20, y: 20, w: 200, h: 200 }, 'the big cluster, not the union with the far one');
});

test('a page with a code in the corner: one text tag and one code tag, text not drawn over the code', () => {
  const code = { kind: 'code', box: { x: 540, y: 380, w: 80, h: 80 }, score: 1, truth: 'a web address', data: { text: 'https://a.example', codeKind: 'url' } };
  const page = pageOfPrint().slice(0, 6); // the print stops short of the corner
  const merged = F.mergeSightings([...page, code], FRAME);
  assert.deepEqual(merged.map((s) => s.kind), ['text', 'code']);
  const tags = new F.Tags();
  tags.see(page, 0, FRAME);
  tags.see([code], 10, FRAME);
  assert.deepEqual(tags.alive(10).map((t) => t.kind).sort(), ['code', 'text']);
  assert.equal(keyRows(tags, 10), 3 + 2, 'READ · TRANSLATE · ASK once and LOOK · ASK once');
  // two codes in one look: the bigger one; the other only when it is another code and far from it
  const second = { ...code, box: { x: 20, y: 20, w: 60, h: 60 }, data: { text: '3017620422003', codeKind: 'product' } };
  const nextTo = { ...code, box: { x: 625, y: 380, w: 10, h: 10 }, data: { text: 'https://b.example' } };
  assert.equal(F.mergeSightings([code, nextTo], FRAME).filter((s) => s.kind === 'code').length, 1, 'a second code right beside the first is not another');
  assert.equal(F.mergeSightings([code, second], FRAME).filter((s) => s.kind === 'code').length, 2, 'a clearly other code, far apart, is');
  assert.equal(F.mergeSightings([code, second, { ...second, box: { x: 300, y: 20, w: 50, h: 50 }, data: { text: 'another' } }], FRAME).filter((s) => s.kind === 'code').length, 2, 'two at most');
});

test('a mug on a table: one object tag, the mug (the biggest thing it found), however many things the finder lists', () => {
  const mug = { kind: 'object', box: { x: 250, y: 160, w: 160, h: 170 }, score: 0.8, truth: 'something here', data: { label: 'cup', named: false } };
  const table = { kind: 'object', box: { x: 0, y: 300, w: 640, h: 180 }, score: 0.6, truth: 'something here', data: { label: 'dining table', named: false } };
  const spoon = { kind: 'object', box: { x: 440, y: 330, w: 60, h: 30 }, score: 0.5, truth: 'something here', data: { label: 'spoon', named: false } };
  const merged = F.mergeSightings([spoon, mug, table], FRAME);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].kind, 'object');
  const tags = new F.Tags();
  tags.see([spoon, mug, table], 0, FRAME);
  // the namer speaks about it a moment later, and the same tag is named (not a second one beside it)
  tags.see([{ ...mug, truth: 'looks like a mug', data: { label: 'mug', named: true } }], 500, FRAME);
  const list = tags.alive(500);
  assert.equal(list.length, 1);
  assert.equal(list[0].truth, 'looks like a mug');
  assert.equal(F.actsFor('object', { named: true, still: true }).map((a) => a.word).join(), 'NAME IT,ASK,MEASURE');
});

test('at most three tags on screen, never two key rows of one kind, whatever stands in the list', () => {
  assert.equal(F.MAX_TAGS, 3);
  const tags = new F.Tags();
  const code = (text, x) => ({ kind: 'code', box: { x, y: 20, w: 60, h: 60 }, score: 1, truth: 'a code', data: { text } });
  tags.see(pageOfPrint(), 0, FRAME);
  tags.see([code('a', 20)], 0, FRAME);
  tags.see([code('b', 300)], 0, FRAME);
  tags.see([code('c', 560)], 0, FRAME);
  tags.see([{ kind: 'object', box: { x: 200, y: 200, w: 100, h: 100 }, score: 0.9, truth: 'something here' }], 0, FRAME);
  tags.see([{ kind: 'face', box: { x: 100, y: 100, w: 80, h: 80 }, score: 0.9, truth: '', data: { label: 'ADMIN' } }], 0, FRAME);
  const shown = F.limitTags(tags.alive(0));
  assert.equal(shown.length, 3);
  assert.deepEqual(shown.map((t) => t.kind).sort(), ['code', 'code', 'face'], 'a person first, then codes, then text, then an object');
  assert.equal(F.limitTags([{ kind: 'text', seen: 1 }, { kind: 'object', seen: 2 }]).length, 2, 'two stand as two');
  // the text and object kinds have one slot each, whatever is thrown at them
  const t2 = new F.Tags();
  for (let i = 0; i < 20; i++) t2.see([textAt(10 + i * 30, 10 + i * 20, 90, 40), { kind: 'object', box: { x: i * 25, y: 300, w: 80, h: 80 }, score: 0.9, truth: 'something here' }], i * 50, FRAME);
  const kinds = t2.alive(1000).map((t) => t.kind);
  assert.equal(kinds.filter((k) => k === 'text').length, 1);
  assert.equal(kinds.filter((k) => k === 'object').length, 1);
});

test('without the namer the object says what the finder said and that it is the finder, never "looks like"', () => {
  assert.equal(F.finderTruth('cup'), 'something here · cup');
  assert.equal(F.finderTruth(''), 'something here');
  assert.equal(F.finderTruth(null), 'something here');
  assert.ok(!/looks like/.test(F.finderTruth('cup')));
});
