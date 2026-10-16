// The Lens's pure modules (apps/web/src/vision): box maths and the frame → viewfinder mapping,
// the gesture hold/cool-down state machine, OCR text cleanup, the adaptive frame budget, the
// attributed reverse-image engines and the share request (fetch faked), camera error wording.
// No DOM, no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const B = await import('./.build/boxes.mjs');
const G = await import('./.build/gestures.mjs');
const O = await import('./.build/ocrtext.mjs');
const F = await import('./.build/frame.mjs');
const E = await import('./.build/engines.mjs');
const C = await import('./.build/camera.mjs');

const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);

test('boxes: the frame fills the viewfinder like object-fit cover, and taps map back', () => {
  const t = B.coverTransform({ w: 1280, h: 720 }, { w: 390, h: 520 });
  near(t.scale, 520 / 720);
  near(t.dy, 0);
  near(t.dx, (390 - 1280 * (520 / 720)) / 2);
  const v = B.toView({ x: 640, y: 360, w: 100, h: 50 }, t);
  near(v.x, t.dx + 640 * t.scale);
  near(v.w, 100 * t.scale);
  const back = B.toFrame(v.x, v.y, t);
  near(back.x, 640);
  near(back.y, 360);
  assert.deepEqual(B.coverTransform({ w: 0, h: 0 }, { w: 390, h: 520 }), { scale: 1, dx: 0, dy: 0 }, 'no frame yet: identity');
});

test('boxes: a tap picks the smallest box under it; crops are padded and clamped to the frame', () => {
  const dets = [
    { label: 'car', score: 0.8, box: { x: 0, y: 0, w: 400, h: 300 } },
    { label: 'person', score: 0.9, box: { x: 100, y: 100, w: 50, h: 120 } },
  ];
  assert.equal(B.hitBox(dets, 120, 150), 1, 'the person inside the car box wins');
  assert.equal(B.hitBox(dets, 10, 10), 0);
  assert.equal(B.hitBox(dets, 900, 900), -1);
  const frame = { w: 640, h: 480 };
  const c = B.cropRect({ x: 600, y: 10, w: 100, h: 100 }, frame, 0.1);
  assert.ok(c.x + c.w <= 640 && c.y >= 0, `clamped: ${JSON.stringify(c)}`);
  assert.ok(Number.isInteger(c.x) && Number.isInteger(c.w));
  const inner = B.cropRect({ x: 100, y: 100, w: 100, h: 50 }, frame, 0.1);
  assert.deepEqual(inner, { x: 90, y: 95, w: 120, h: 60 }, 'padded by a tenth on each side');
  assert.deepEqual(B.clampBox({ x: -50, y: -50, w: 2000, h: 20 }, frame), { x: 0, y: 0, w: 640, h: 20 });
  assert.deepEqual(B.wholeFrame(frame), { x: 0, y: 0, w: 640, h: 480 });
});

test('boxes: drawing, resizing and moving a crop never leaves the frame or turns inside out', () => {
  const frame = { w: 640, h: 480 };
  assert.deepEqual(B.normalizeRect(300, 200, 100, 50), { x: 100, y: 50, w: 200, h: 150 }, 'a drag up-left');
  const r = { x: 100, y: 100, w: 200, h: 100 };
  assert.equal(B.handleAt(r, 102, 98, 22), 'nw');
  assert.equal(B.handleAt(r, 300, 200, 22), 'se');
  assert.equal(B.handleAt(r, 200, 150, 22), 'inside');
  assert.equal(B.handleAt(r, 500, 400, 22), null);
  const se = B.resizeRect(r, 'se', 1000, 1000, frame, 24);
  assert.deepEqual(se, { x: 100, y: 100, w: 540, h: 380 }, 'stops at the frame edge');
  const nw = B.resizeRect(r, 'nw', 500, 500, frame, 24);
  assert.deepEqual(nw, { x: 276, y: 176, w: 24, h: 24 }, 'never smaller than the minimum, never inside out');
  assert.deepEqual(B.moveRect(r, -500, 900, frame), { x: 0, y: 380, w: 200, h: 100 });
  near(B.iou(r, r), 1);
  assert.equal(B.iou(r, { x: 400, y: 400, w: 10, h: 10 }), 0);
  near(B.iou({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 0, w: 10, h: 10 }), 50 / 150);
});

test('boxes: counts, plurals, the scene line and the on-device summary read as plain words', () => {
  const dets = [
    { label: 'car', score: 0.8, box: { x: 0, y: 0, w: 1, h: 1 } },
    { label: 'person', score: 0.9, box: { x: 0, y: 0, w: 1, h: 1 } },
    { label: 'car', score: 0.7, box: { x: 0, y: 0, w: 1, h: 1 } },
    { label: 'bus', score: 0.7, box: { x: 0, y: 0, w: 1, h: 1 } },
    { label: 'bus', score: 0.7, box: { x: 0, y: 0, w: 1, h: 1 } },
  ];
  assert.deepEqual(B.countLabels(dets), [{ label: 'bus', n: 2 }, { label: 'car', n: 2 }, { label: 'person', n: 1 }]);
  assert.equal(B.countLine(dets), '2 buses · 2 cars · 1 person');
  assert.equal(B.countLine(dets, 2), '2 buses · 2 cars · +1 more');
  assert.equal(B.countLine([]), '');
  assert.equal(B.plural('person', 2), 'people');
  assert.equal(B.plural('knife', 3), 'knives');
  assert.equal(B.plural('teddy bear', 2), 'teddy bears');
  assert.equal(B.plural('sandwich', 2), 'sandwiches');
  assert.equal(B.pct(0.456), '46%');
  assert.equal(B.sceneLine([{ label: 'desk', score: 0.2 }, { label: 'laptop', score: 0.62 }, { label: 'monitor', score: 0.09 }, { label: 'mouse', score: 0.01 }]), 'laptop 62% · desk 20% · monitor 9%');
  const s = B.onDeviceSummary(dets.slice(0, 2), [{ label: 'street', score: 0.6 }], 'STOP\n  here ');
  assert.equal(s, '[on-device: labels car, person; scene street 60%; text "STOP here"]');
  assert.equal(B.onDeviceSummary([], [], ''), '');
  assert.match(B.onDeviceSummary(dets, [], ''), /car ×2/);
});

test('boxes: MediaPipe results are read defensively', () => {
  const dets = B.fromMediaPipe({ detections: [
    { boundingBox: { originX: 1, originY: 2, width: 30, height: 40 }, categories: [{ categoryName: 'cat', score: 0.9 }] },
    { boundingBox: { originX: 1, originY: 2, width: 0, height: 40 }, categories: [{ categoryName: 'ghost', score: 0.9 }] },
    { categories: [{ categoryName: 'nobox', score: 0.9 }] },
    { boundingBox: { originX: 1, originY: 2, width: 3, height: 4 }, categories: [] },
  ] });
  assert.deepEqual(dets, [{ label: 'cat', score: 0.9, box: { x: 1, y: 2, w: 30, h: 40 } }]);
  assert.deepEqual(B.fromMediaPipe(null), []);
  const cats = B.fromClassifier({ classifications: [{ categories: [{ categoryName: 'desk', score: 0.2 }, { categoryName: 'laptop_computer', displayName: '', score: 0.6 }, { categoryName: '', score: 0.9 }] }] });
  assert.deepEqual(cats, [{ label: 'laptop computer', score: 0.6 }, { label: 'desk', score: 0.2 }]);
  assert.deepEqual(B.fromClassifier(undefined), []);
});

test('gestures: hold ~600 ms → one action → cool-down; the same gesture must be let go of before acting again', () => {
  const d = new G.GestureDebouncer({ hold: 600, cooldown: 1500, minScore: 0.6, grace: 150 });
  assert.equal(d.feed('Thumb_Up', 0.9, 0), null);
  assert.equal(d.feed('Thumb_Up', 0.9, 300), null);
  near(d.progress(300), 0.5);
  assert.equal(d.feed('Thumb_Up', 0.9, 599), null);
  assert.deepEqual(d.feed('Thumb_Up', 0.9, 600), { action: 'save', gesture: 'Thumb_Up' });
  assert.equal(d.progress(700), 0, 'nothing to show during the cool-down');
  assert.ok(d.coolingDown(1000));
  assert.equal(d.feed('Thumb_Up', 0.9, 1200), null, 'cool-down');
  assert.equal(d.feed('Thumb_Up', 0.9, 3000), null, 'held since before: locked');
  assert.equal(d.feed('Thumb_Up', 0.9, 5000), null, 'still locked, however long');
  assert.equal(d.feed(null, 0, 5100), null, 'let go');
  assert.equal(d.feed(null, 0, 5300), null);
  assert.equal(d.feed('Thumb_Up', 0.9, 5400), null);
  assert.deepEqual(d.feed('Thumb_Up', 0.9, 6000), { action: 'save', gesture: 'Thumb_Up' }, 'a fresh hold acts again');
  // a different gesture during the cool-down does not act, and counts as letting go of the first
  const o = new G.GestureDebouncer();
  o.feed('Thumb_Up', 0.9, 0);
  assert.deepEqual(o.feed('Thumb_Up', 0.9, 600), { action: 'save', gesture: 'Thumb_Up' });
  assert.equal(o.feed('Open_Palm', 0.9, 700), null);
  assert.equal(o.feed('Open_Palm', 0.9, 1400), null, 'still in the cool-down');
  assert.equal(o.feed('Open_Palm', 0.9, 2000), null, 'cool-down until 2100');
  assert.deepEqual(o.feed('Open_Palm', 0.9, 2101), { action: 'freeze', gesture: 'Open_Palm' }, 'held since 700: acts as soon as the cool-down ends');
});

test('gestures: a short gap is forgiven, a long one restarts the hold; weak or unknown gestures do nothing', () => {
  const d = new G.GestureDebouncer();
  d.feed('Open_Palm', 0.9, 0);
  d.feed('Open_Palm', 0.9, 100);
  d.feed('Open_Palm', 0.9, 200);
  d.feed('None', 0.9, 300);
  assert.equal(d.held, 'Open_Palm', 'a blink of None keeps the hold');
  d.feed('Open_Palm', 0.9, 400);
  assert.deepEqual(d.feed('Open_Palm', 0.9, 600), { action: 'freeze', gesture: 'Open_Palm' });
  const e = new G.GestureDebouncer();
  e.feed('Victory', 0.9, 0);
  e.feed(null, 0, 300);
  e.feed(null, 0, 500);
  assert.equal(e.held, null, 'gone for longer than the grace: the hold is over');
  e.feed('Victory', 0.9, 600);
  assert.equal(e.feed('Victory', 0.9, 1100), null, 'only 500 ms into the new hold');
  assert.deepEqual(e.feed('Victory', 0.9, 1200), { action: 'flip', gesture: 'Victory' });
  const w = new G.GestureDebouncer();
  w.feed('Closed_Fist', 0.3, 0);
  assert.equal(w.feed('Closed_Fist', 0.3, 2000), null, 'too unsure');
  assert.equal(w.held, null);
  w.feed('ILoveYou', 0.99, 0);
  assert.equal(w.feed('ILoveYou', 0.99, 2000), null, 'no action for that gesture');
  w.feed('Pointing_Up', 0.99, 3000);
  assert.deepEqual(w.feed('Pointing_Up', 0.99, 3600), { action: 'read', gesture: 'Pointing_Up' });
  w.reset();
  assert.equal(w.held, null);
  assert.equal(G.GESTURE_HELP.length, 5);
  assert.ok(G.GESTURE_HELP.every((g) => G.GESTURE_ACTIONS[g.gesture] && /[a-z]/.test(g.does)));
  assert.equal(G.gestureWords('Thumb_Up'), 'thumbs up');
  assert.equal(G.gestureWords('None'), 'no gesture');
  assert.equal(G.gestureWords('ILoveYou'), 'iloveyou');
  assert.equal(G.handSide('Left'), 'right hand', 'raw camera frames are not mirrored: the names swap');
  assert.equal(G.handSide('Right'), 'left hand');
  assert.equal(G.handSide(undefined), '');
  assert.equal(G.HAND_CONNECTIONS.length, 21);
  assert.ok(G.HAND_CONNECTIONS.every(([a, b]) => a >= 0 && a < 21 && b >= 0 && b < 21));
});

test('ocr text: hyphenated breaks join, junk lines go, the title comes from the first real line', () => {
  assert.equal(O.joinHyphens('An exam-\nple of hyphen-\nation, but not the end-\nOf a sentence'), 'An example of hyphenation, but not the end-\nOf a sentence');
  assert.ok(O.isJunkLine('~ -- | . ,'));
  assert.ok(O.isJunkLine('hello', 20));
  assert.ok(!O.isJunkLine('hello', 80));
  assert.ok(!O.isJunkLine('3 apples'));
  assert.ok(O.isJunkLine(''));
  const cleaned = O.cleanOcr({
    text: 'ignored when lines are given',
    confidence: 80,
    lines: [
      { text: 'GHOSTY   USER   GUIDE\n', confidence: 91 },
      { text: '|  ~~ .', confidence: 95 },
      { text: 'The Lens reads docu-', confidence: 88 },
      { text: 'ments on the phone.', confidence: 85 },
      { text: '', confidence: 0 },
      { text: '', confidence: 0 },
      { text: '', confidence: 0 },
      { text: 'noise', confidence: 12 },
      { text: 'Nothing leaves it.', confidence: 77 },
    ],
  });
  assert.equal(cleaned, 'GHOSTY USER GUIDE\nThe Lens reads documents on the phone.\n\nNothing leaves it.', 'junk out, hyphen joined, blank lines kept as one paragraph break');
  assert.equal(O.cleanOcr('one\n\n\n\n\ntwo'), 'one\n\ntwo');
  assert.equal(O.titleFrom(cleaned), 'GHOSTY USER GUIDE');
  assert.equal(O.titleFrom('12\n--\nA real title here\nmore'), 'A real title here');
  assert.equal(O.titleFrom(''), 'Scanned text');
  assert.equal(O.titleFrom('', 'Photo'), 'Photo');
  const long = O.titleFrom(`${'word '.repeat(30)}end`);
  assert.ok(long.length <= 81 && long.endsWith('…'), long);
  const regions = O.wordRegions([
    { text: 'Hello', confidence: 90, bbox: { x0: 10, y0: 20, x1: 60, y1: 40 } },
    { text: '', confidence: 90, bbox: { x0: 10, y0: 20, x1: 60, y1: 40 } },
    { text: 'low', confidence: 10, bbox: { x0: 10, y0: 20, x1: 60, y1: 40 } },
    { text: 'flat', confidence: 90, bbox: { x0: 10, y0: 20, x1: 10, y1: 40 } },
  ]);
  assert.deepEqual(regions, [{ text: 'Hello', confidence: 90, box: { x: 10, y: 20, w: 50, h: 20 } }]);
  assert.equal(O.ocrSummary('three little words', 86.4), '3 words · 86% sure');
  assert.equal(O.ocrSummary('one', 50), '1 word · 50% sure');
  assert.equal(O.ocrSummary('  \n ', 50), 'no text found');
});

test('frame budget: the pause after a run follows the measured time, between 2 and 10 runs a second', () => {
  const b = new F.FrameBudget({ maxHz: 10, minHz: 2, headroom: 0.6 });
  assert.ok(b.due(0));
  b.record(40, 0);
  assert.equal(b.interval, 100, 'fast model: capped at 10 a second');
  assert.ok(!b.due(99));
  assert.ok(b.due(100));
  b.record(300, 100);
  near(b.ms, 40 * 0.7 + 300 * 0.3);
  near(b.interval, b.ms * 1.6);
  assert.ok(!b.due(100 + b.interval - 1));
  assert.ok(b.due(100 + b.interval));
  for (let i = 0; i < 10; i++) b.record(2000, 1000 + i * 500);
  assert.equal(b.interval, 500, 'slow model: never slower than 2 a second');
  const r = new F.FrameBudget();
  for (let t = 0; t <= 900; t += 100) r.record(10, t);
  assert.equal(r.rate(1000), 10);
  assert.equal(r.rate(5000), 0, 'nothing in the last second');
  r.reset();
  assert.equal(r.ms, 0);
  assert.ok(r.due(0));
  assert.equal(F.fpsText(8.4), '8 fps');
  assert.equal(F.fpsText(2.46), '2.5 fps');
  assert.equal(F.fpsText(0), '0 fps');
});

test('engines: four named engines, each pointed at the public picture link', () => {
  const links = E.engineUrls('https://ghosty.example/i/abc123?x=1');
  assert.deepEqual(links.map((l) => l.name), ['Google Lens', 'Bing Visual Search', 'Yandex Images', 'TinEye']);
  const enc = encodeURIComponent('https://ghosty.example/i/abc123?x=1');
  assert.equal(links[0].url, `https://lens.google.com/uploadbyurl?url=${enc}`);
  assert.equal(links[1].url, `https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:${enc}`);
  assert.equal(links[2].url, `https://yandex.com/images/search?rpt=imageview&url=${enc}`);
  assert.equal(links[3].url, `https://tineye.com/search?url=${enc}`);
  assert.ok(links.every((l) => /new tab/.test(l.note) && new RegExp(l.name.split(' ')[0]).test(l.note)), 'each row says plainly who gets the link');
  assert.deepEqual(E.engineUrls('javascript:alert(1)'), []);
  assert.deepEqual(E.engineUrls('not a url'), []);
});

test('engines: the share request posts the JPEG to the brain and reads the link back; limits are refused in plain words', async () => {
  const calls = [];
  const deps = {
    headers: (extra = {}) => ({ 'x-ghosty': '1', 'x-ghosty-key': 'k', ...extra }),
    fetch: async (url, init) => {
      calls.push({ url, init });
      if (init.method === 'DELETE') return new Response(null, { status: 204 });
      return new Response(JSON.stringify({ id: 'AbCd1234EfGh5678', url: 'https://ghosty.example/i/AbCd1234EfGh5678', expires: 1_700_000_000_000 }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  };
  const blob = new Blob([new Uint8Array(1000)], { type: 'image/jpeg' });
  const info = await E.shareImage(blob, deps);
  assert.deepEqual(info, { id: 'AbCd1234EfGh5678', url: 'https://ghosty.example/i/AbCd1234EfGh5678', expires: 1_700_000_000_000 });
  assert.equal(calls[0].url, '/api/lens/share');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['content-type'], 'image/jpeg');
  assert.equal(calls[0].init.headers['x-ghosty'], '1');
  assert.equal(calls[0].init.body, blob, 'the raw bytes, not JSON');
  await E.forgetImage(info.id, deps);
  assert.equal(calls[1].url, '/api/lens/share/AbCd1234EfGh5678');
  assert.equal(calls[1].init.method, 'DELETE');
  // refused before any request: too big, or not a picture
  await assert.rejects(E.shareImage(new Blob([new Uint8Array(E.SHARE_MAX_BYTES + 1)], { type: 'image/jpeg' }), deps), /too big.*1\.5 MB/);
  await assert.rejects(E.shareImage(new Blob(['x'], { type: 'text/plain' }), deps), /JPEG, PNG or WebP/);
  assert.equal(calls.length, 2, 'nothing was sent for those');
  // the brain's own refusals
  const refusing = (status, body = '') => ({ ...deps, fetch: async () => new Response(body, { status, headers: { 'content-type': 'application/json' } }) });
  await assert.rejects(E.shareImage(blob, refusing(413)), /too big/);
  await assert.rejects(E.shareImage(blob, refusing(429)), /30 pictures a day/);
  await assert.rejects(E.shareImage(blob, refusing(500, JSON.stringify({ error: 'storage unavailable' }))), /storage unavailable/);
  await assert.rejects(E.shareImage(blob, refusing(200, JSON.stringify({ id: 'x', url: 'https://a/b' }))), /did not give the picture an id/);
  await assert.rejects(E.shareImage(blob, refusing(200, JSON.stringify({ id: 'AbCd1234EfGh5678', url: 'ftp://a/b' }))), /public link/);
  // an ISO expiry is understood; a missing one means a day
  assert.equal(E.parseShare({ id: 'AbCd1234EfGh5678', url: 'https://a/b', expires: '2030-01-01T00:00:00Z' }).expires, Date.parse('2030-01-01T00:00:00Z'));
  const soon = E.parseShare({ id: 'AbCd1234EfGh5678', url: 'https://a/b' }).expires - Date.now();
  assert.ok(soon > 86_000_000 && soon <= 86_400_000);
  await assert.rejects(E.forgetImage('AbCd1234EfGh5678', refusing(500, JSON.stringify({ error: 'nope' }))), /nope/);
  await E.forgetImage('gone', refusing(404), 'already gone is fine');
  const now = 1_000_000;
  assert.equal(E.expiresText(now + 86_400_000, now), 'reachable by link for 24 hours');
  assert.equal(E.expiresText(now + 3 * 3_600_000, now), 'reachable by link for 3 more hours');
  assert.equal(E.expiresText(now + 3_600_000, now), 'reachable by link for 1 more hour');
  assert.equal(E.expiresText(now + 90_000, now), 'reachable by link for 2 more minutes');
  assert.equal(E.expiresText(now - 1, now), 'no longer reachable by link');
});

test('camera: errors come back as plain words with what to do', () => {
  const err = (name, message = '') => Object.assign(new Error(message), { name });
  assert.match(C.cameraMessage(err('NotAllowedError')), /Camera not allowed: Settings → Safari → Camera/);
  assert.equal(C.cameraMessage(err('NotFoundError')), 'No camera on this device');
  assert.equal(C.cameraMessage(err('OverconstrainedError')), 'No camera on this device');
  assert.equal(C.cameraMessage(err('NotReadableError')), 'The camera is busy in another app');
  assert.equal(C.cameraMessage(new TypeError('navigator.mediaDevices is undefined')), 'This browser cannot open the camera');
  assert.match(C.cameraMessage(err('SecurityError')), /Camera not allowed/);
  assert.equal(C.cameraMessage(err('SomeError', 'needs a secure context (https)')), 'The camera only works over https');
  assert.equal(C.cameraMessage('something odd'), 'Camera error: something odd');
  assert.equal(C.cameraMessage(err('WeirdError', 'boom')), 'Camera error: boom');
  assert.equal(C.cameraSupported(), false, 'no navigator in Node');
});
