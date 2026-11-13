// BRIEF-MACHINE-WALL: THE WALL's brain side (apps/edge/src/wall.ts, mounted under /guardian/wall with the other feature routes). Run from
// router.test.mjs (package.json is protected, so no new file in the test list). A code pairs once and expires; show keeps the last
// picture under the pair and the stream delivers it at once; a kind off the list, or data a camera, a face or a spending line could ride
// in, is refused by the brain too; LEAVE clears; thirty days clears; an hour of the phone's silence rests the wall.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

const mod = await import('./.build/brain.mjs');
const { GhostyAgent } = mod;
const OWNER_KEY = 'test-owner-key-0123456789abcdef';

class Mem {
  m = new Map();
  async get(k) { return Array.isArray(k) ? new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))])) : this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b)); else this.m.set(k, structuredClone(v)); }
  async delete(k) { return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k); }
  async list({ prefix = '' } = {}) { return new Map([...this.m].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)])); }
  async setAlarm() {}
  async getAlarm() { return null; }
}

/** One brain, and a clock the test can move forward (the brain reads Date.now). */
function wallBrain() {
  const pending = [];
  const storage = new Mem();
  const state = { storage, waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() };
  const env = { OWNER_KEY, VAULT_KEY: Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString('base64'), OWNER_EMAIL: 'me@example.com', MOCK_LLM: '1' };
  let agent;
  env.AGENT = { idFromName: (n) => n, get: () => ({ fetch: (r) => (agent ??= new GhostyAgent(state, env)).fetch(r) }) };
  const real = Date.now;
  let skew = 0;
  Date.now = () => real() + skew;
  const call = async (method, path, body) => {
    const r = await mod.default.fetch(new Request(`https://ghosty.test/api/guardian/wall${path}`, { method, headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': OWNER_KEY }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }), env, { waitUntil: (p) => pending.push(p), passThroughOnException() {} });
    return { status: r.status, json: await r.json() };
  };
  return { call, storage, later: (ms) => (skew += ms), done: () => { Date.now = real; } };
}

const SCREEN = 'wall-screen-0001';
const chart = { series: { kind: 'bars', points: [{ label: 'Jan', value: 120 }, { label: 'Feb', value: 95 }, { label: 'Mar', value: 140 }], unit: '£', before: true } };
const stream = (b, screen, seq, hold = 0, pair) => b.call('GET', `/stream?screen=${screen}&seq=${seq}&hold=${hold}${pair ? `&pair=${pair}` : ''}`);

test('wall: a code is six letters with no look-alikes, pairs once and then is spent', async () => {
  const b = wallBrain();
  try {
    const a = await stream(b, SCREEN, -1);
    assert.equal(a.json.state, 'unpaired');
    assert.match(a.json.code, /^[ACDEFGHJKMNPQRTUVWXYZ]{6}$/, 'six letters, none that look like another');
    assert.ok(a.json.expires - Date.now() <= 120_000 && a.json.expires > Date.now(), 'it runs out within two minutes');
    const same = await stream(b, SCREEN, -1);
    assert.equal(same.json.code, a.json.code, 'the same code while it lives');
    const p = await b.call('POST', '/pair', { code: a.json.code.toLowerCase().replace(/(...)(...)/, '$1 $2') });
    assert.equal(p.status, 200, JSON.stringify(p.json));
    assert.equal(p.json.paired, true);
    const wall = await stream(b, SCREEN, -1);
    assert.equal(wall.json.state, 'paired');
    assert.equal(wall.json.picture, null, 'it rests until the phone sends something');
    const again = await b.call('POST', '/pair', { code: a.json.code });
    assert.equal(again.status, 400, 'a spent code pairs nothing');
  } finally {
    b.done();
  }
});

test('wall: a code expires after two minutes and the wall is given a new one', async () => {
  const b = wallBrain();
  try {
    const a = await stream(b, SCREEN, -1);
    b.later(121_000);
    const n = await stream(b, SCREEN, a.json.seq);
    assert.notEqual(n.json.code, a.json.code, 'a new code');
    const old = await b.call('POST', '/pair', { code: a.json.code });
    assert.equal(old.status, 400, 'the old one pairs nothing');
    assert.equal((await b.call('POST', '/pair', { code: n.json.code })).status, 200, 'the new one does');
  } finally {
    b.done();
  }
});

test('wall: three wrong codes wait a minute, even for the right one, and say so', async () => {
  const b = wallBrain();
  try {
    const a = await stream(b, SCREEN, -1);
    const wrong = a.json.code === 'AAAAAA' ? 'CCCCCC' : 'AAAAAA';
    assert.equal((await b.call('POST', '/pair', { code: wrong })).status, 400);
    assert.equal((await b.call('POST', '/pair', { code: wrong })).status, 400);
    const third = await b.call('POST', '/pair', { code: wrong });
    assert.equal(third.status, 429);
    assert.match(third.json.error, /wait a minute/i);
    assert.ok(third.json.retryAt > Date.now(), 'it says when');
    assert.equal((await b.call('POST', '/pair', { code: a.json.code })).status, 429, 'the right code waits too');
    assert.equal((await b.call('GET', '')).json.retryAt > Date.now(), true, 'the phone page can say it');
    b.later(61_000);
    assert.equal((await b.call('POST', '/pair', { code: a.json.code })).status, 200, 'after the minute it pairs');
  } finally {
    b.done();
  }
});

test('wall: show keeps the last picture under the pair and the stream delivers it at once', async () => {
  const b = wallBrain();
  try {
    const a = await stream(b, SCREEN, -1);
    const pair = (await b.call('POST', '/pair', { code: a.json.code })).json.pair;
    const rest = await stream(b, SCREEN, -1);
    // the long poll is waiting when the phone sends: it answers within a breath, not at its end
    const t0 = performance.now();
    const waiting = stream(b, SCREEN, rest.json.seq, 5000, pair);
    await new Promise((r) => setTimeout(r, 60));
    const sent = await b.call('POST', '/show', { kind: 'chart', data: chart, sentence: 'You spent the most in March, £140.', pair });
    assert.equal(sent.status, 200, JSON.stringify(sent.json));
    const got = await waiting;
    assert.ok(performance.now() - t0 < 1000, `the wall heard in ${Math.round(performance.now() - t0)} ms`);
    assert.equal(got.json.picture.kind, 'chart');
    assert.equal(got.json.picture.data.series.points.length, 3);
    assert.equal(got.json.picture.sentence, 'You spent the most in March, £140.');
    // kept: a wall that opens later (or comes back) is given the same picture
    assert.equal((await stream(b, SCREEN, -1, 0, pair)).json.picture.kind, 'chart');
    assert.equal((await b.call('GET', '')).json.showing.kind, 'chart');
    // a wall that is not the paired one never sees it
    assert.equal((await stream(b, 'another-screen-0002', -1)).json.state, 'unpaired');
    // clear rests it
    await b.call('POST', '/clear');
    assert.equal((await stream(b, SCREEN, -1)).json.picture, null);
  } finally {
    b.done();
  }
});

test('wall: a kind off the list is refused by the brain too, and so is anything a camera, a face or a purse could ride in', async () => {
  const b = wallBrain();
  try {
    const a = await stream(b, SCREEN, -1);
    await b.call('POST', '/pair', { code: a.json.code });
    const refused = async (kind, data, what) => {
      const r = await b.call('POST', '/show', { kind, data, sentence: 'x' });
      assert.equal(r.status, 422, `${what}: ${JSON.stringify(r.json)}`);
      assert.equal(r.json.error, 'That stays on the phone.', what);
    };
    await refused('camera', { label: 'x' }, 'the camera');
    await refused('lens', { name: 'a face' }, 'the Lens');
    await refused('journey', { lat: 52, lon: -1, label: 'Home' }, 'a journey');
    await refused('messages', { text: 'hi' }, 'a message');
    await refused('spending', chart, 'a spending line');
    await refused('thing', { name: 'a lemon', face: 'descriptor' }, 'a face key');
    await refused('thing', { name: 'x', frame: 'data:image/jpeg;base64,AAAA' }, 'a camera frame');
    await refused('thing', { name: 'data:image/png;base64,AAAA' }, 'a picture of the screen inside a name');
    await refused('map', { lat: 52.4, lon: -1.9 }, 'a bare point (no name: it could be where he stands)');
    await refused('map', { lat: 52.4, lon: -1.9, label: 'Home', gps: { accuracy: 5 } }, 'a live position');
    await refused('chart', { series: { points: [{ label: 'Jan', value: 1 }] } }, 'one number');
    await refused('document', { title: 'x', paragraphs: [{ t: 'p', text: 'a', message: 'b' }] }, "another person's message");
    await refused('thing', { name: 'x'.repeat(30_000) }, 'a heavy one');
    assert.equal((await b.call('GET', '')).json.showing, null, 'nothing got through');
    // the names that are fine still go
    for (const [kind, data] of [['map', { lat: 38.72, lon: -9.14, label: 'Lisbon', zoom: 11 }], ['thing', { name: 'a lemon' }], ['document', { title: 'Plan', paragraphs: [{ t: 'h1', text: 'Plan' }, { t: 'ul', text: 'Monday: algebra' }] }], ['waveform', { title: 'The tune', peaks: [0.1, 0.5, 0.9, 0.4, 0.2, 0.7, 0.3, 0.6] }], ['car', { name: 'My Golf', lines: ['MOT due 3 March'] }], ['room', { room: { w: 400, d: 300, things: [{ kind: 'sofa', n: 1 }], sized: true } }], ['part', { part: { kind: 'desk', name: 'Desk', dims: { w: 140, d: 70, h: 75 } } }], ['place', { lat: 52.48, lon: -1.9, label: 'Home' }]]) {
      const r = await b.call('POST', '/show', { kind, data, sentence: 'Here.' });
      assert.equal(r.status, 200, `${kind}: ${JSON.stringify(r.json)}`);
    }
  } finally {
    b.done();
  }
});

test('wall: with no wall paired, show says so; LEAVE from either side clears the pair, the picture and the codes', async () => {
  const b = wallBrain();
  try {
    assert.equal((await b.call('POST', '/show', { kind: 'thing', data: { name: 'a lemon' }, sentence: 'x' })).status, 404, 'nothing to send to');
    const a = await stream(b, SCREEN, -1);
    await b.call('POST', '/pair', { code: a.json.code });
    await b.call('POST', '/show', { kind: 'thing', data: { name: 'a lemon' }, sentence: 'A lemon.' });
    // another screen's LEAVE does not unpair this one
    await b.call('POST', '/leave', { screen: 'someone-elses-wall' });
    assert.equal((await b.call('GET', '')).json.paired, true);
    // the wall's own LEAVE
    await b.call('POST', '/leave', { screen: SCREEN });
    assert.equal((await b.call('GET', '')).json.paired, false);
    const after = await stream(b, SCREEN, -1);
    assert.equal(after.json.state, 'unpaired');
    assert.equal(after.json.picture, undefined, 'no picture is left behind');
    assert.notEqual(after.json.code, a.json.code, 'and a new code');
    // the phone's LEAVE
    await b.call('POST', '/pair', { code: after.json.code });
    assert.equal((await b.call('GET', '')).json.paired, true);
    await b.call('POST', '/leave', {});
    assert.equal((await b.call('GET', '')).json.paired, false);
    assert.equal((await b.call('POST', '/show', { kind: 'thing', data: { name: 'a lemon' }, sentence: 'x' })).status, 404);
  } finally {
    b.done();
  }
});

test('wall: a pair is kept thirty days, and an hour of the phone’s silence rests the wall', async () => {
  const b = wallBrain();
  try {
    const a = await stream(b, SCREEN, -1);
    const pair = (await b.call('POST', '/pair', { code: a.json.code })).json.pair;
    await b.call('POST', '/show', { kind: 'thing', data: { name: 'a lemon' }, sentence: 'A lemon.', pair });
    b.later(59 * 60_000);
    assert.equal((await stream(b, SCREEN, -1, 0, pair)).json.picture.kind, 'thing', 'still there at 59 minutes');
    b.later(2 * 60_000);
    const hush = await stream(b, SCREEN, -1, 0, pair);
    assert.equal(hush.json.state, 'paired');
    assert.equal(hush.json.picture, null, 'the hour of silence rests it');
    b.later(29 * 24 * 3_600_000);
    assert.equal((await b.call('GET', '')).json.paired, true, 'still paired inside thirty days');
    b.later(2 * 24 * 3_600_000);
    assert.equal((await b.call('GET', '')).json.paired, false, 'thirty days clears it');
    assert.equal((await b.call('POST', '/show', { kind: 'thing', data: { name: 'x' }, sentence: 'x' })).status, 404);
  } finally {
    b.done();
  }
});

test('wall: a long poll that nothing wakes answers at its end with the same frame, and a wall names itself', async () => {
  const b = wallBrain();
  try {
    const a = await stream(b, SCREEN, -1);
    const t0 = performance.now();
    const quiet = await stream(b, SCREEN, a.json.seq, 400);
    assert.ok(performance.now() - t0 >= 300, 'it waited');
    assert.equal(quiet.json.seq, a.json.seq);
    assert.equal((await b.call('GET', '/stream?seq=1')).status, 400, 'an anonymous screen is turned away');
  } finally {
    b.done();
  }
});
