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

// ---- THE LENS THAT JUST KNOWS (BRIEF-LENS-KNOWS), pure: the language of some words, the name of a colour, the words of the stamp and the one line
test('the language table names English, French, German, Spanish, Italian, Portuguese and Dutch from a few words, and says UNKNOWN for nonsense (no model)', () => {
  const cases = [
    ['Your bins are changing. From Monday your general waste bin moves to Thursdays.', 'ENGLISH'],
    ['Please put the box by the door and keep it dry', 'ENGLISH'],
    ['SORTIE DE SECOURS', 'FRENCH'],
    ['Nous sommes ouverts du lundi au samedi pour vous servir', 'FRENCH'],
    ['Der Ausgang ist auf der linken Seite des Gebäudes', 'GERMAN'],
    ['NOTAUSGANG', 'GERMAN'],
    ['La salida de emergencia está al final del pasillo', 'SPANISH'],
    ['SALIDA DE EMERGENCIA', 'SPANISH'],
    ['Il biglietto è valido per tutti i giorni della settimana', 'ITALIAN'],
    ['USCITA DI SICUREZZA', 'ITALIAN'],
    ['A saída de emergência fica no fim do corredor', 'PORTUGUESE'],
    ['Os bilhetes são válidos para todos os dias', 'PORTUGUESE'],
    ['De uitgang is aan het einde van de gang', 'DUTCH'],
    ['NOODUITGANG', 'DUTCH'],
    ['xqzv plmk trfd wqs', 'UNKNOWN'],
    ['7734 AB 99', 'UNKNOWN'],
    // (lens.u1) a menu has few common words: its dishes say the language
    ['ENTREES\nSoupe du jour\nSalade niçoise\nPLATS\nBoeuf bourguignon', 'FRENCH'],
    ['Antipasti\nZuppa del giorno\nPrimi piatti\nSpaghetti alla carbonara\nDolci', 'ITALIAN'],
    ['Vorspeisen\nTagessuppe\nHauptgerichte\nSchweinebraten mit Kartoffeln', 'GERMAN'],
    ['Entrantes\nSopa del día\nPlatos principales\nPostres', 'SPANISH'],
    ['Starters\nSoup of the day\nMains\nDesserts', 'ENGLISH'],
  ];
  for (const [text, want] of cases) assert.equal(F.languageOf(text).name, want, text);
  assert.equal(F.needsTranslation(F.languageOf('SORTIE DE SECOURS')), true);
  assert.equal(F.needsTranslation(F.languageOf('xqzv plmk trfd wqs')), false, 'nothing is sent on a guess');
  assert.equal(F.needsTranslation(F.languageOf('Please put the box by the door and keep it dry')), false);
});

test('the colour table names six flat colours (and the other six of its twelve)', () => {
  const flat = [[250, 250, 250, 'WHITE'], [10, 10, 10, 'BLACK'], [220, 30, 30, 'RED'], [30, 70, 220, 'BLUE'], [30, 160, 60, 'GREEN'], [240, 220, 30, 'YELLOW'], [128, 128, 128, 'GREY'], [240, 140, 20, 'ORANGE'], [130, 40, 170, 'PURPLE'], [250, 160, 190, 'PINK'], [120, 70, 30, 'BROWN'], [225, 205, 170, 'BEIGE']];
  for (const [r, g, b, want] of flat) assert.equal(F.colourName(r, g, b), want, `${r},${g},${b}`);
  // the dominant colour of a picture is the colour of most of it (the box's edge does not vote)
  const px = new Uint8ClampedArray(20 * 20 * 4);
  for (let i = 0; i < 400; i++) px.set(i % 20 < 2 ? [30, 70, 220, 255] : [250, 250, 250, 255], i * 4);
  assert.equal(F.dominantColour(px, 20, 20), 'WHITE');
});

test('the stamp says what it looks at, the plate says what a thing is, the one line ends with the act of the nearest thing; a known name never reaches the stamp', () => {
  const letter = { kind: 'text', words: 61, lang: F.languageOf('Your bins are changing. From Monday your general waste bin moves to Thursdays.'), away: 0.2 };
  assert.equal(F.lookingWords([]), 'nothing yet');
  assert.equal(F.lookingWords([letter]), 'a letter');
  assert.equal(F.lookingWords([{ kind: 'text', words: 3, away: 0 }]), 'a sign');
  assert.equal(F.lookingWords([{ kind: 'object', label: 'mug', named: true, away: 0 }]), 'a mug');
  const two = [{ kind: 'face', name: 'Mum', away: 0.3 }, { kind: 'stranger', away: 0.5 }, { kind: 'code', codeKind: 'url', linkWord: 'MENU', away: 0.8 }];
  assert.equal(F.lookingWords(two), 'two people');
  assert.ok(!/mum/i.test(F.lookingWords(two)), 'a name is not in the stamp');
  assert.equal(F.plateWords(letter), 'A LETTER · 61 WORDS');
  assert.equal(F.plateWords({ kind: 'text', words: 3, lang: F.languageOf('SORTIE DE SECOURS'), away: 0 }), 'A SIGN · FRENCH');
  assert.equal(F.plateWords(two[0]), 'Mum');
  assert.equal(F.plateWords(two[1]), 'SOMEONE I DON’T KNOW');
  assert.equal(F.plateWords(two[2]), 'A LINK · MENU');
  assert.equal(F.plateWords({ kind: 'object', label: 'mug', named: true, away: 0 }), 'A MUG');
  const flat = (parts) => parts.map((p) => (typeof p === 'string' ? p : p.text)).join(' · ');
  assert.equal(flat(F.truthParts([letter])), 'A LETTER · ENGLISH · TAP A WORD TO HEAR IT');
  assert.equal(flat(F.truthParts([{ kind: 'text', words: 3, lang: F.languageOf('SORTIE DE SECOURS'), translated: true, away: 0 }])), 'A SIGN · FRENCH · TRANSLATED · TAP TO HEAR IT');
  assert.equal(flat(F.truthParts([{ kind: 'text', words: 3, lang: F.languageOf('SORTIE DE SECOURS'), untranslated: true, away: 0 }])), 'A SIGN · FRENCH · I CAN’T TRANSLATE OFFLINE');
  assert.equal(flat(F.truthParts(two)), 'Mum · SOMEONE I DON’T KNOW · A LINK: TAP IT');
  assert.equal(flat(F.truthParts([{ kind: 'object', label: 'mug', named: true, colour: 'WHITE', away: 0 }])), 'A MUG · WHITE · TAP TO ASK ABOUT IT');
  const last = F.truthParts(two).at(-1);
  assert.equal(last.tone, 'on', 'the act is in his colour');
  assert.equal(F.linkWord('https://example.com/the-menu.html'), 'THE MENU');
  assert.equal(F.linkWord('https://www.example.com/'), 'EXAMPLE.COM');
  assert.equal(F.firstSentence('Your bins are changing. From Monday x.'), 4);
});

test('the Lens takes "keep it", "find this part" and "who is that" by their words', () => {
  assert.equal(F.lensWord('keep it'), 'keep');
  assert.equal(F.lensWord('find this part'), 'part');
  assert.equal(F.lensWord('who is that'), 'who');
});

// ---- FINAL-LENS: the Lens knows its job (vision/jobs.ts, through frame.ts): the job for what is in view, the things in a read text
// he can act on, and a sum worked line by line. Never a guess: what is not a sum, a number or a date is left alone.
test('the job is decided from the frame: a face first, a shop barcode is a product, a letter, a page, text, a place, a living thing, a thing', () => {
  assert.deepEqual(F.jobsOf({}), ['nothing']);
  assert.equal(F.jobOf({ stranger: true, text: 'hello there' }), 'stranger');
  assert.equal(F.jobOf({ known: true }), 'known');
  assert.equal(F.jobOf({ code: { text: '5000159484695', format: 'ean_13' } }), 'product');
  assert.equal(F.jobOf({ code: { text: 'https://example.org/menu', format: 'qr_code' } }), 'code');
  assert.equal(F.jobOf({ code: { text: '5000159484695', format: 'qr_code' } }), 'code', 'digits in a QR code are no shop barcode');
  assert.equal(F.jobOf({ text: 'Dear Sir', letter: true }), 'letter');
  const page = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
  assert.equal(F.jobOf({ text: page, textShare: 0.7 }), 'document');
  assert.equal(F.jobOf({ text: page, textShare: 0.2 }), 'text', 'a long text small in the picture is read, not scanned');
  assert.equal(F.jobOf({ thing: { label: 'robin', score: 0.7 } }), 'living');
  assert.equal(F.jobOf({ thing: { label: 'potted plant', score: 0.7 } }), 'living');
  assert.equal(F.jobOf({ thing: { label: 'clock tower', score: 0.6 } }), 'place');
  assert.equal(F.jobOf({ thing: { label: 'painting', score: 0.6 } }), 'place');
  assert.equal(F.jobOf({ thing: { label: 'mug', score: 0.8 } }), 'thing');
  assert.deepEqual(F.jobsOf({ code: { text: '5000159484695', format: 'ean_13' }, thing: { label: 'mug', score: 0.8 } }), ['product', 'thing']);
  assert.equal(F.sureWords(0.823), '82% sure');
  assert.equal(F.sureWords(1), '99% sure', 'nothing a phone camera sees is certain');
  assert.equal(F.ean({ text: '96385074' }), '96385074');
  assert.equal(F.ean({ text: '12345' }), null);
});

test('a read text gives the things he can act on, in the order they stand: a date, a phone number, a link, an address, an email, a sum', () => {
  const text = "Dr Patel's surgery\nYour appointment is on 4 December 2026 at 10:30.\nCall 0121 496 0123 or visit www.example-surgery.nhs.uk\n12 High Street\nBirmingham B1 1AA\nEmail: reception@example.org\n12 + 7 × 3 =";
  const acts = F.textActs(text, '2026-11-13');
  assert.deepEqual(acts.map((a) => a.kind), ['date', 'phone', 'link', 'address', 'email', 'sum']);
  assert.equal(acts[0].value, '2026-12-04');
  assert.equal(acts[1].value, '01214960123');
  assert.equal(acts[2].value, 'https://www.example-surgery.nhs.uk');
  assert.equal(acts[3].value, '12 High Street, Birmingham B1 1AA');
  assert.equal(acts[4].value, 'reception@example.org');
  assert.equal(acts[5].value, '33');
  assert.deepEqual(acts[5].steps, ['7 × 3 = 21', '12 + 21 = 33']);
  assert.equal(F.telOf('+44 (0)121 496 0123'), '+441214960123');
  assert.equal(F.telOf('12345'), null);
  assert.deepEqual(F.textActs('Opening hours 9:00 to 17:30, closed 25/12/2026', '2026-11-13').map((a) => a.kind), ['date'], 'a time and a date are not sums');
  assert.deepEqual(F.textActs('SORTIE DE SECOURS', '2026-11-13'), [], 'a sign with nothing to act on gives nothing');
});

test('a sum is worked the way it is taught: brackets, powers, × and ÷, + and −; an equation and a percent too; anything else is no sum', () => {
  assert.deepEqual(F.solve('(4 + 6) ÷ 2 - 1'), { answer: '4', steps: ['4 + 6 = 10', '10 ÷ 2 = 5', '5 − 1 = 4'] });
  assert.deepEqual(F.solve('3^2 + 4^2'), { answer: '25', steps: ['3 ^ 2 = 9', '4 ^ 2 = 16', '9 + 16 = 25'] });
  assert.deepEqual(F.solve('2x + 3 = 11'), { answer: 'x = 4', steps: ['2x = 11 − 3 = 8', 'x = 8 ÷ 2 = 4'] });
  assert.deepEqual(F.solve('15% of 80'), { answer: '12', steps: ['15% = 15 ÷ 100 = 0.15', '0.15 × 80 = 12'] });
  assert.equal(F.solve('7 x 6 =').answer, '42');
  assert.equal(F.solve('1 / 3').answer, '0.333333');
  assert.equal(F.solve('7 / 0'), null, 'no answer is made up for a division by nought');
  assert.equal(F.solve('hello world'), null);
  assert.equal(F.solve('42'), null, 'a lone number is no sum');
});

test('the jobs of the cards by his words, in more than one wording (and nothing else taken for them)', () => {
  for (const [w, want] of [['solve that', 'solve'], ['work it out', 'solve'], ["what's the answer", 'solve'], ['call that number', 'call'], ['ring it', 'call'], ['add that to my agenda', 'agenda'], ['put this date in my diary', 'agenda'], ['show that on the map', 'map'], ['where is that address', 'map'], ['what species is that', 'species'], ['what bird is this', 'species'], ['what kind of plant is that', 'species'], ['what building is that', 'place'], ['which painting is this', 'place'], ['read it aloud', 'aloud'], ['read that out loud', 'aloud'], ['copy that', 'copy'], ['copy this number', 'copy']]) assert.equal(F.lensWord(w), want, w);
  for (const w of ['do it', 'call mum', 'play music', 'what is the time', 'show me the map']) assert.equal(F.lensWord(w), null, w);
});

test('WHICH SPECIES asks as the kind the phone’s own name says: a bird, an insect, a plant (to Pl@ntNet), or other', () => {
  assert.equal(F.livingKind('robin'), 'bird');
  assert.equal(F.livingKind('bird'), 'bird');
  assert.equal(F.livingKind('ladybird'), 'insect');
  assert.equal(F.livingKind('butterfly'), 'insect');
  assert.equal(F.livingKind('potted plant'), 'plant');
  assert.equal(F.livingKind('sunflower'), 'plant');
  assert.equal(F.livingKind('fox'), 'other');
  assert.equal(F.livingKind(''), 'other');
});

test('what is no sum, no phone, no postcode and no link is left alone; what is one is found whole (the review’s cases)', () => {
  const kinds = (s) => F.textActs(s, '2026-11-13').map((a) => `${a.kind}:${a.value}`);
  // ranges, spans of years, opening hours and seasons are not sums; a sum that asks with "=" is
  for (const s of ['1914 - 1918', 'OPEN\n9-5', '8 - 22', '9.00 - 17.00', '2024/25']) assert.deepEqual(kinds(s), [], s);
  assert.deepEqual(kinds('12 - 7 ='), ['sum:5']);
  // a homework question's number or letter is not part of the sum
  assert.deepEqual(kinds('1) 5 x 3 ='), ['sum:15']);
  assert.deepEqual(kinds('Q1. 12 + 7 × 3 ='), ['sum:33']);
  assert.deepEqual(kinds('a) 2x + 3 = 11'), ['sum:x = 4']);
  assert.deepEqual(kinds('1. 3x = 12'), ['sum:x = 4']);
  assert.deepEqual(kinds('(a) 15% of 80'), ['sum:12']);
  // product specs, units, ordinals and floor signs are no postcode; a real one is, with its street line only when it is one
  for (const s of ['Samsung Galaxy S24 8GB 256GB', 'PS5 1TB Console', 'CO2 2kg', 'Vitamin B6 1mg', 'Floor 2 Room B1 2ND']) assert.deepEqual(kinds(s), [], s);
  assert.deepEqual(kinds('London SW1A 1AA'), ['address:London SW1A 1AA']);
  assert.deepEqual(kinds('Mon-Fri 9-5\nLondon SW1A 1AA'), ['address:London SW1A 1AA']);
  assert.deepEqual(kinds('Always open\nLondon SW1A 1AA'), ['address:London SW1A 1AA']);
  assert.deepEqual(kinds('Call 0121 496 0123\nBirmingham B1 1AA'), ['phone:01214960123', 'address:Birmingham B1 1AA']);
  // reference numbers are no phone; a bracketed area code is one
  for (const s of ['Order number: 0034567891', 'Invoice 0001234567', 'Customer no. 0123 456 789', 'Account no 0123456789']) assert.deepEqual(kinds(s), [], s);
  assert.deepEqual(kinds('Tel: (020) 7946 0958'), ['phone:02079460958']);
  assert.deepEqual(kinds('Phone number: 0121 496 0123'), ['phone:01214960123']);
  // a link keeps a bracket that closes one of its own, and drops the full stop after it
  assert.deepEqual(kinds('See https://en.wikipedia.org/wiki/Mercury_(planet) for more'), ['link:https://en.wikipedia.org/wiki/Mercury_(planet)']);
  assert.deepEqual(kinds('(see https://example.org/a)'), ['link:https://example.org/a']);
  assert.deepEqual(kinds('Visit www.example.org.'), ['link:https://www.example.org']);
  // a toy and a food named after an animal are things
  assert.equal(F.jobOf({ thing: { label: 'teddy bear', score: 0.8 } }), 'thing');
  assert.equal(F.jobOf({ thing: { label: 'hot dog', score: 0.8 } }), 'thing');
  assert.equal(F.jobOf({ thing: { label: 'dog', score: 0.8 } }), 'living');
});

test('a sign binds after a power and a chain of powers is worked from its top, as taught; separate powers left to right', () => {
  assert.deepEqual(F.solve('-3^2 + 10'), { answer: '1', steps: ['-(3 ^ 2) = -9', '-9 + 10 = 1'] });
  // the sign waits on its number until the power is worked, wherever the number stands
  assert.deepEqual(F.solve('10 ÷ -2^2'), { answer: '-2.5', steps: ['-(2 ^ 2) = -4', '10 ÷ -4 = -2.5'] });
  assert.equal(F.solve('100 / -10^2 =').answer, '-1');
  assert.equal(F.solve('2^-3^2').answer, '0.001953');
  assert.equal(F.solve('-2^3^2').answer, '-512');
  assert.deepEqual(F.solve('(-3)^2'), { answer: '9', steps: ['(-3) ^ 2 = 9'] });
  assert.equal(F.solve('-2^2').answer, '-4');
  assert.equal(F.solve('2 x -3^2').answer, '-18');
  assert.deepEqual(F.solve('2^3^2'), { answer: '512', steps: ['3 ^ 2 = 9', '2 ^ 9 = 512'] });
  assert.equal(F.solve('2 ^ -1').answer, '0.5');
  assert.equal(F.solve('1 + 2^3^2 - 4').answer, '509');
});

test('a phone number is one unless a reference’s label stands right before it (on its line, or ending the line above)', () => {
  const kinds = (s) => F.textActs(s, '2026-11-13').map((a) => `${a.kind}:${a.value}`);
  // the service numbers on a bill or a letter are phones (the second review's cases)
  for (const [s, tel] of [['Customer Services 0800 123 4567', '08001234567'], ['Customer Services: 0345 300 0000', '03453000000'], ['Booking hotline 0161 496 0000', '01614960000'], ['Card services 0345 300 0000', '03453000000'], ['Policy enquiries 0345 300 0000', '03453000000'], ['NHS England: 0300 311 2233', '03003112233'], ['Our ref: JS/123 T: 0161 496 0000', '01614960000'], ['Questions about your bill?\nCustomer Services 0800 123 4567', '08001234567'], ['Tel (0121) 496 0123', '01214960123']]) assert.deepEqual(kinds(s), [`phone:${tel}`], s);
  // a stray digit after a number is not swallowed into it
  assert.deepEqual(kinds('Crimestoppers 0800 555 111  7 days a week'), ['phone:0800555111']);
  // references: the label right before, on the line above, after a bracketed aside, or after an earlier phone on the same line
  for (const s of ['Account number\n0123 456 7890', 'Order number:\n01234567890', 'Account number (please quote): 0123456789', 'Your account number is 0123456789', 'Booking reference: 0161 496 0000', 'Customer number: 0123 456 7890']) assert.deepEqual(kinds(s), [], s);
  assert.deepEqual(kinds('Tel 0800 123 4567 Account 0123456789'), ['phone:08001234567']);
  assert.deepEqual(kinds('ACCOUNT NUMBER\n0123 456 7890\nCALL 0161 496 0000'), ['phone:01614960000']);
});

test('a postcode is a real area’s, in any case, with a space or none; never a storage size or a room; the street line goes with it', () => {
  const kinds = (s) => F.textActs(s, '2026-11-13').map((a) => `${a.kind}:${a.value}`);
  for (const [s, v] of [['Birmingham B33 8TH', 'Birmingham B33 8TH'], ['Leeds LS2 7RD', 'Leeds LS2 7RD'], ['Leeds LS1 1ST', 'Leeds LS1 1ST'], ['london sw1a 1aa', 'london SW1A 1AA'], ['London SW1A1AA', 'London SW1A 1AA'], ['London SW1A 1AA', 'London SW1A 1AA'], ['EC1A 1BB', 'EC1A 1BB'], ['W1A 0AX', 'W1A 0AX']]) assert.deepEqual(kinds(s), [`address:${v}`], s);
  assert.equal(kinds('Galaxy S24 8GB to Leeds LS1 4AP').length, 1, 'a storage size before a real postcode does not hide it');
  for (const s of ['PS5 1TB Console', 'Floor 2 Room B1 2ND', 'Samsung Galaxy S24 8GB 256GB']) assert.deepEqual(kinds(s), [], s);
  assert.deepEqual(kinds('10-12 High Street\nLeeds LS1 6DT'), ['address:10-12 High Street, Leeds LS1 6DT']);
  assert.deepEqual(kinds('Flat 2.01, 5 High St\nLeeds LS1 6DT'), ['address:Flat 2.01, 5 High St, Leeds LS1 6DT']);
  assert.deepEqual(kinds('Dr Jane Patel\nLeeds LS1 4AP'), ['address:Leeds LS1 4AP'], 'a person’s title is no street');
});

// ---- THE NEXT ROUND: the camera as the front door (lens.c1 receipts, lens.u7 what he avoids, lens.u1 a menu line by line)
test('a till receipt is told from a bill, a sum and a page; its spend is one safe CSV row', () => {
  const rc = 'TESCO EXTRA\nMilk 2pt 1.45\nBread 1.10\nApples 2.30\nTOTAL 4.85\nVISA CONTACTLESS\nCHANGE 0.00\nThank you';
  assert.equal(F.looksLikeReceipt(rc), true);
  assert.equal(F.jobOf({ text: rc, receipt: true }), 'receipt');
  assert.equal(F.looksLikeReceipt('BRITISH GAS\nYour balance is £84.20.\nPlease pay by 14 December 2026.'), false, 'a bill is no receipt');
  assert.equal(F.looksLikeReceipt('12 + 7 × 3 = 33'), false);
  assert.equal(F.receiptCsv({ store: 'TESCO EXTRA', date: '2026-11-13', total: 4.85 }, '2026-11-14'), 'Date,Description,Amount\n2026-11-13,TESCO EXTRA,-4.85\n');
  assert.equal(F.receiptCsv({ store: '=HYPERLINK("x"),bad', date: '', total: 2 }, '2026-11-14'), 'Date,Description,Amount\n2026-11-14,HYPERLINK( x ) bad,-2.00\n', 'no cell starts a formula; no comma or quote breaks the row; no date is today');
});

test('a packet against what he avoids: red when it has one, amber when it cannot be told, green when every one is clear', () => {
  assert.equal(F.avoidVerdict([], { allergens: ['milk'] }).tone, 'none', 'an empty list gives no line');
  const red = F.avoidVerdict(['milk', 'gluten'], { allergens: ['gluten', 'milk'], ingredients: 'Wheat flour, sugar, milk' });
  assert.equal(red.tone, 'red');
  assert.equal(red.line, 'Not for you: it has milk and gluten.');
  assert.equal(F.avoidVerdict(['peanuts'], { ingredients: 'Roasted groundnuts, salt' }).tone, 'red', 'the ingredients’ own words count');
  assert.equal(F.avoidVerdict(['peanuts'], {}).line, 'Check the pack: the open database does not say whether it has peanuts.');
  assert.equal(F.avoidVerdict(['low sugar'], { nutrition: { sugars: 16.6 } }).tone, 'amber', 'the middle band (over 5 g, up to 22.5 g per 100 g)');
  assert.equal(F.avoidVerdict(['low sugar'], { nutrition: { sugars: 30 } }).tone, 'red');
  assert.equal(F.avoidVerdict(['low salt'], { nutrition: { salt: 0.2 } }).tone, 'green');
  assert.equal(F.avoidVerdict(['vegan'], { ingredients: 'oats, honey' }).tone, 'red');
  assert.equal(F.avoidVerdict(['vegetarian'], { ingredients: 'oats, honey' }).tone, 'green');
  assert.equal(F.avoidVerdict(['peanuts', 'low salt'], { allergens: ['gluten'], ingredients: 'oats, sugar', nutrition: { salt: 0.2 } }).line, 'Fine for you: nothing you avoid, by its ingredients and figures.');
});

test('what he avoids, in his words; and the Lens takes those words while it is open', () => {
  assert.deepEqual(F.avoidFromWords("I'm allergic to peanuts and milk").sort(), ['milk', 'peanuts'], 'peanuts are not tree nuts');
  assert.deepEqual(F.avoidFromWords('allergic to nuts and peanuts').sort(), ['nuts', 'peanuts']);
  assert.deepEqual(F.avoidFromWords("I'm vegan"), ['vegan']);
  assert.deepEqual(F.avoidFromWords('I avoid gluten and cut down on sugar').sort(), ['gluten', 'low sugar']);
  assert.deepEqual(F.avoidFromWords('I am coeliac'), ['gluten']);
  for (const w of ["I'm allergic to peanuts", 'I avoid gluten', "I can't eat eggs", "I'm vegan", 'what do I avoid', 'my allergy list']) assert.equal(F.lensWord(w), 'avoid', w);
  for (const w of ['I avoid crowds and loud noise and very long sentences that go on and on', 'play music']) assert.equal(F.lensWord(w), null, w);
});

test('a menu is four lines or more, and its English is used line for line only when it lines up', () => {
  assert.equal(F.isMenuLike('ENTREES\nSoupe du jour\nSalade nicoise\nPLATS\nBoeuf bourguignon'), true);
  assert.equal(F.isMenuLike('SORTIE DE SECOURS\nNe pas bloquer'), false, 'a short sign is translated whole, as before');
  assert.deepEqual(F.pairLines(['Soupe', 'Salade'], '1. Soup\n2. Salad'), ['Soup', 'Salad'], 'a numbered answer is read as its lines');
  assert.equal(F.pairLines(['Soupe', 'Salade', 'Boeuf'], 'Soup and salad\nBeef'), null, 'two lines for three: no pairing, the whole translation instead');
});

test('(lens.s1) a business card: its details as printed, into a vCard made on the phone; a notice or a bill is no card', () => {
  const c = F.readBusinessCard('Sarah J. Okafor\nSenior Project Manager\nBrightline Consulting Ltd\nT: 020 7946 0321\nM: +44 7700 900123\nsarah.okafor@brightline.co.uk\nwww.brightline.co.uk\n12 Bank Street, London EC2N 4AB');
  assert.equal(c.name, 'Sarah J. Okafor');
  assert.equal(c.title, 'Senior Project Manager');
  assert.equal(c.org, 'Brightline Consulting Ltd');
  assert.deepEqual(c.phones, ['02079460321', '+447700900123']);
  assert.deepEqual(c.emails, ['sarah.okafor@brightline.co.uk']);
  assert.equal(c.web, 'www.brightline.co.uk');
  assert.match(c.address, /EC2N 4AB/);
  const v = F.vcardOf(c);
  assert.match(v, /^BEGIN:VCARD\r\nVERSION:3\.0\r\nN:Okafor;Sarah J\.;;;\r\nFN:Sarah J\. Okafor\r\n/);
  assert.match(v, /TEL;TYPE=CELL:\+447700900123\r\n/);
  assert.match(v, /TEL;TYPE=WORK:02079460321\r\n/);
  assert.match(v, /ADR;TYPE=WORK:;;12 Bank Street\\, London EC2N 4AB;;;;\r\n/, 'a comma is escaped');
  assert.match(v, /URL:https:\/\/www\.brightline\.co\.uk\r\nADR/);
  assert.match(v, /END:VCARD\r\n$/);
  assert.equal(F.readBusinessCard('Quiz Night at the Village Hall\nFriday 4 December 2026, doors at 7\nTickets: call 0121 496 0123\nwww.example.org\n12 High Street\nBirmingham B1 1AA\nhello@example.org'), null, 'a notice with a number is no business card');
  assert.equal(F.readBusinessCard('BRITISH GAS\nYour balance is £84.20.\nPlease pay by 14 December 2026.\nReference 4471 2290'), null);
  assert.equal(F.readBusinessCard('Village Hall\ncall 0121 496 0123'), null, 'a place is no person');
  assert.equal(F.readBusinessCard('Jamie Patel\nPlumbing and Heating'), null, 'nothing to reach them by');
  assert.deepEqual(F.jobsOf({ text: 'a b c', contact: true, letter: true }), ['contact']);
  assert.equal(F.lensWord('add them to my contacts'), 'contacts');
  assert.equal(F.lensWord('save this card'), 'contacts');
  assert.equal(F.lensWord('save that'), 'keep', 'saving the words is still KEEP');
});

test('(lens.s7) a bus stop sign: its name, letter, buses, where they go and its text code; other signs are no stop', () => {
  assert.deepEqual(F.readBusStop('Oxford Circus\nStop OB\n25 N8 73 390\ntowards Holborn\nText 47589 to 87287'), { name: 'Oxford Circus', letter: 'OB', routes: ['25', 'N8', '73', '390'], towards: 'Holborn', sms: '47589' });
  assert.deepEqual(F.readBusStop('BUS STOP\nHigh Street\n12 X1 50\nTowards City Centre'), { name: 'High Street', letter: '', routes: ['12', 'X1', '50'], towards: 'City Centre', sms: '' });
  assert.equal(F.readBusStop('SORTIE DE SECOURS\nNe pas bloquer cette issue'), null);
  assert.equal(F.readBusStop('STOP\nPolice'), null);
  assert.equal(F.readBusStop('Quiz Night at the Village Hall\nFriday 4 December 2026, doors at 7'), null);
  assert.deepEqual(F.jobsOf({ text: 'a b c', stop: true, letter: true }), ['stop']);
  assert.equal(F.lensWord("when's the next bus"), 'buses');
  assert.equal(F.lensWord('next buses from this stop'), 'buses');
});

test('(lens.s2, s3) a medicine box (its NHS page; never advice) and a rating plate (an hour at his price, a first estimate)', () => {
  assert.deepEqual(F.readMedicine('Paracetamol 500mg Tablets\n16 tablets\nFor oral use\nRead the enclosed leaflet\nPL 12345/0001'), { name: 'Paracetamol', strength: '500mg', form: 'tablets' });
  assert.deepEqual(F.readMedicine('IBUPROFEN\n200 mg film-coated tablets\nKeep out of the sight and reach of children'), { name: 'Ibuprofen', strength: '200mg', form: 'tablets' });
  assert.equal(F.readMedicine('Cetirizine Hydrochloride 10mg\n30 Tablets').name, 'Cetirizine Hydrochloride');
  assert.equal(F.readMedicine('Beef bourguignon'), null);
  assert.equal(F.readMedicine('TESCO EXTRA\nBread 1.10\nTOTAL 4.30\nVISA'), null);
  assert.equal(F.nhsSearch('Paracetamol'), 'https://www.nhs.uk/search/results?q=Paracetamol');
  assert.deepEqual(F.readRating('Model HX200\n220-240V~ 50Hz\n1850-2200W\nMade in China'), { watts: 2200, volts: '220-240' });
  assert.deepEqual(F.readRating('230V 50Hz 3kW'), { watts: 3000, volts: '230' });
  assert.equal(F.readRating('Energy 120 kWh/annum'), null, 'a yearly energy figure is no rating plate');
  assert.equal(F.readRating('TOTAL 4.30 VISA'), null);
  assert.match(F.runningCost(2200, 25).line, /^About 55p an hour at full power, at 25p a unit \(kWh\): £2\.75 for five hours\. A first estimate/);
  assert.match(F.runningCost(60, 25).line, /^About 1\.5p an hour/);
  assert.deepEqual(F.jobsOf({ text: 'a b c', medicine: true, letter: true }), ['medicine']);
  assert.equal(F.lensWord('open the NHS page'), 'nhs');
  assert.equal(F.lensWord('what does it cost to run'), 'running');
});

test('the UK traffic lights on a packet: HIGH over the first line, LOW at or under the second, none for energy or protein', () => {
  assert.equal(F.bandOf('sugars', 16.6), 'medium');
  assert.equal(F.bandOf('sugars', 22.6), 'high');
  assert.equal(F.bandOf('sugars', 5), 'low');
  assert.equal(F.bandOf('fat', 20.9), 'high');
  assert.equal(F.bandOf('saturates', 1.5), 'low');
  assert.equal(F.bandOf('salt', 0.95), 'medium');
  assert.equal(F.bandOf('salt', 1.6), 'high');
  assert.equal(F.bandOf('kcal', 474), '');
  assert.equal(F.bandOf('protein', 7.1), '');
  assert.equal(F.bandOf('fat', undefined), '');
});

test('(the sweep) print he can use: a parcel number, imperial and US measures, prices in another currency', () => {
  const acts = F.textActs('Your parcel AB123456789GB is on its way. Call 0121 496 0123', '2026-11-14');
  assert.deepEqual(acts.map((a) => a.kind), ['parcel', 'phone']);
  assert.equal(acts[0].value, 'https://www.royalmail.com/track-your-item#/tracking-results/AB123456789GB');
  assert.deepEqual(F.unitsIn('Bake at 350°F. 12 fl oz milk, 8 oz flour, 2 lbs beef, 5 in stock, 6 ft wide, 10 km').map((u) => `${u.text}=${u.said}`), ['350°F=about 177 °C', '12 fl oz=about 355 ml', '8 oz=about 227 g', '2 lbs=about 0.9 kg', '6 ft=about 1.8 m', '10 km=about 6.2 miles'], '"5 in stock" is no measure');
  assert.deepEqual(F.pricesIn('Menu €14,50\nVin 6.50 €\nUS$20 or 120 SEK, CHF 12.90, 1.234,50 € and £5').map((p) => `${p.amount} ${p.cur}`), ['14.5 eur', '6.5 eur', '20 usd', '120 sek', '12.9 chf', '1234.5 eur'], 'pounds are his own: never converted');
  assert.deepEqual(F.textActs('TOTAL 4.30\nVISA', '2026-11-14'), [], 'a till total with no currency is no price to convert');
});
