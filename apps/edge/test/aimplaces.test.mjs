// AIM's brain routes, with the network faked from real answers (aim.fixture.json, fetched
// 2026-10-17): /api/aim/places merges Wikipedia's geosearch with OpenStreetMap landmarks from the
// first Overpass mirror that answers in full (a reset connection, a 500 and a "timed out" inside a
// 200 all move on to the next), drops site-numbered phone masts and repeats, keeps the map's
// heights and the article titles, caps at 60 and caches for ten minutes; /api/aim/iss passes on the
// station's position; /api/aim/about gives a place's first lines; all owner-only through the Worker.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const FIX = JSON.parse(readFileSync(new URL('./aim.fixture.json', import.meta.url), 'utf8'));
const X = await import('./.build/integrations/aim.mjs');
const mod = await import('./.build/brain.mjs');

const calls = [];
let overpass = ['reset', 'ok'];
let wikiDown = false;
globalThis.fetch = async (input) => {
  const u = new URL(typeof input === 'string' ? input : input.url);
  calls.push(u);
  const j = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
  if (u.hostname === 'en.wikipedia.org') {
    if (wikiDown) return new Response('You are making too many requests to the API.', { status: 429 });
    if (u.searchParams.get('list') === 'geosearch') return j(FIX.wikipedia);
    if (u.searchParams.get('prop') === 'extracts') return j(/BT Tower/.test(u.searchParams.get('titles') ?? '') ? FIX.extract : FIX.extractMissing);
  }
  if (u.pathname.endsWith('/api/interpreter')) {
    const step = overpass.shift() ?? 'ok';
    if (step === 'reset') throw new TypeError('Network connection lost.');
    if (step === '500') return new Response('<html>500 Internal Server Error</html>', { status: 500 });
    if (step === 'timeout') return j({ version: 0.6, elements: [], remark: 'runtime error: Query timed out in "query" at line 1 after 27 seconds.' });
    return j(FIX.overpass);
  }
  if (u.hostname === 'api.wheretheiss.at') return j(FIX.iss);
  return new Response('not faked', { status: 599 });
};
const reset = (steps = ['ok']) => {
  calls.length = 0;
  overpass = steps;
  wikiDown = false;
  X._testing.resetCache();
};
const BHAM = { lat: 52.4797, lon: -1.9026 };

test('the Overpass query is a box around the point with a cap per kind', () => {
  const q = X.landmarksQuery(BHAM.lat, BHAM.lon, 15_000);
  assert.match(q, /^\[out:json\]\[timeout:25\]\[bbox:52\.345,-2\.124,52\.614,-1\.681\];/);
  assert.match(q, /node\["natural"="peak"\]\["name"\];out 40;/);
  assert.match(q, /\["tower:type"!="lighting"\];out center 30;/);
  assert.match(q, /nw\["leisure"="stadium"\]\["name"\];out center 20;/);
});

test("OpenStreetMap landmarks from a real answer: heights kept, phone masts named by site number gone, one per name", () => {
  const ps = X.parseLandmarks(FIX.overpass, BHAM, 15_000);
  const by = (n) => ps.filter((p) => p.name === n);
  assert.equal(by('Beacon 3- Unwind 26274').length, 0, 'site-numbered masts dropped');
  assert.equal(by('o2').length, 0);
  const walton = by('Walton Hill')[0];
  assert.equal(walton.kind, 'peak');
  assert.equal(walton.ele, 316);
  assert.equal(walton.wiki, 'Walton Hill');
  const bt = by('BT Tower')[0];
  assert.equal(bt.kind, 'tower');
  assert.equal(bt.height, 117);
  assert.equal(bt.wiki, 'BT Tower, Birmingham');
  assert.ok(bt.dist < 1000, 'a way placed at its centre, near the city centre');
  assert.equal(by('Villa Park')[0].kind, 'stadium');
  assert.equal(by('Utilita Arena Birmingham')[0].kind, 'stadium');
  assert.equal(by("The Metropolitan Cathedral and Basilica of St Chad")[0].kind, 'cathedral');
  for (const p of ps) assert.ok(p.dist <= 15_000, `${p.name} is within 15 km`);
  // in a 5 km circle only the near ones are left
  assert.ok(X.parseLandmarks(FIX.overpass, BHAM, 5000).every((p) => p.dist <= 5000));
});

test('merging: a landmark and its article are one place; stadiums and articles are kept ahead of nameless hillocks; at most 60', () => {
  const osm = X.parseLandmarks(FIX.overpass, BHAM, 15_000);
  const wiki = [
    { id: 'w1', name: 'Villa Park', kind: 'landmark', lat: 52.509, lon: -1.8848, wiki: 'Villa Park', dist: 3500 },
    { id: 'w2', name: 'The River (artwork)', kind: 'landmark', lat: 52.47983, lon: -1.90239, wiki: 'The River (artwork)', dist: 20 },
  ];
  const all = X.mergePlaces(osm, wiki);
  assert.equal(all.filter((p) => p.name === 'Villa Park').length, 1, 'one Villa Park');
  assert.equal(all.find((p) => p.name === 'Villa Park').kind, 'stadium', 'with the map kind');
  assert.equal(all[0].name, 'The River (artwork)', 'nearest first');
  assert.ok(all.some((p) => p.kind === 'cathedral'), 'the cathedral made the cut');
  assert.ok(all.length <= 60);
  const many = Array.from({ length: 90 }, (_, i) => ({ id: `w${i}`, name: `Place ${i}`, kind: 'landmark', lat: 52.48, lon: -1.9, dist: i * 10 }));
  assert.equal(X.mergePlaces([], many).length, 60, 'capped');
});

test('/places: Wikipedia and the second Overpass mirror (the first reset the connection), cached for ten minutes', async () => {
  reset(['reset', 'ok']);
  const r = await X.placesNear(BHAM.lat, BHAM.lon, 15_000);
  assert.equal(r.credit, 'Places: Wikipedia, OpenStreetMap');
  assert.equal(r.note, undefined);
  assert.ok(r.places.length > 30 && r.places.length <= 60, `${r.places.length} places`);
  assert.ok(r.places.some((p) => p.name === 'Birmingham' && p.kind === 'landmark'), 'Wikipedia articles in');
  assert.ok(r.places.some((p) => p.name === 'BT Tower' && p.height === 117), 'map landmarks in');
  const mirrors = calls.filter((u) => u.pathname.endsWith('/api/interpreter')).map((u) => u.hostname);
  assert.deepEqual(mirrors, ['overpass-api.de', 'overpass.openstreetmap.fr']);
  assert.match(decodeURIComponent(calls.find((u) => u.hostname === 'overpass.openstreetmap.fr').search), /\[bbox:52\.345/);
  const geo = calls.find((u) => u.hostname === 'en.wikipedia.org');
  assert.equal(geo.searchParams.get('gsradius'), '10000', "Wikipedia's own limit");
  assert.equal(geo.searchParams.get('gscoord'), '52.48000|-1.90000', 'only the square kilometre leaves the brain, not the exact spot');
  const box = decodeURIComponent(calls.find((u) => u.hostname === 'overpass.openstreetmap.fr').search).match(/\[bbox:([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+)\]/).slice(1).map(Number);
  assert.ok(Math.abs((box[0] + box[2]) / 2 - 52.48) < 0.001 && Math.abs((box[1] + box[3]) / 2 + 1.9) < 0.001, `the box is centred on the square kilometre: ${box}`);
  // the same square kilometre again: no new requests
  const n = calls.length;
  await X.placesNear(BHAM.lat + 0.001, BHAM.lon, 15_000);
  assert.equal(calls.length, n, 'cached');
});

test('/places: a mirror that times out inside a 200 or answers 500 is passed over; with Wikipedia down the map still answers, with a note', async () => {
  reset(['timeout', '500', 'ok']);
  wikiDown = true;
  const r = await X.placesNear(BHAM.lat, BHAM.lon, 15_000);
  assert.ok(r.places.length > 20);
  assert.match(r.note, /Wikipedia did not answer \(HTTP 429\)/);
  assert.equal(calls.filter((u) => u.pathname.endsWith('/api/interpreter')).length, 3);
  // every mirror down and Wikipedia down: an error the phone can show
  reset(['500', '500', '500', '500']);
  wikiDown = true;
  await assert.rejects(X.placesNear(BHAM.lat, BHAM.lon, 15_000), /Wikipedia did not answer.*OpenStreetMap did not answer/);
});

test('/iss and /about from real answers', async () => {
  reset();
  const s = await X.iss();
  assert.equal(s.lat, FIX.iss.latitude);
  assert.equal(Math.round(s.altKm), 430);
  assert.equal(s.speedKmh, 27566);
  assert.equal(s.visibility, 'daylight');
  const a = await X.about('BT Tower, Birmingham');
  assert.equal(a.title, 'BT Tower, Birmingham');
  assert.match(a.extract, /^The BT Tower, formerly known as the Post Office Tower/);
  assert.equal(a.url, 'https://en.wikipedia.org/wiki/BT_Tower%2C_Birmingham');
  const none = await X.about('Nowhere Placezzz');
  assert.equal(none.extract, '');
  await assert.rejects(X.about('  '), /Say which place/);
});

// ---- Through the Worker: owner-only like every other route
const OWNER_KEY = 'aim-owner-key-0123456789abcdef';
class MemStorage {
  m = new Map();
  async get(k) {
    return Array.isArray(k) ? new Map(k.filter((x) => this.m.has(x)).map((x) => [x, this.m.get(x)])) : this.m.get(k);
  }
  async put(k, v) {
    if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, b);
    else this.m.set(k, v);
  }
  async delete(k) {
    return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k);
  }
  async list({ prefix = '' } = {}) {
    return new Map([...this.m].filter(([k]) => k.startsWith(prefix)));
  }
  async setAlarm() {}
  async getAlarm() {
    return null;
  }
}
const state = { storage: new MemStorage(), waitUntil: () => undefined };
const env = { OWNER_KEY, MOCK_LLM: '1' };
let agent;
env.AGENT = { idFromName: (n) => n, get: () => ({ fetch: (r) => (agent ??= new mod.GhostyAgent(state, env)).fetch(r) }) };
const get = (path, owner = true) => mod.default.fetch(new Request(`https://ghosty.me.workers.dev${path}`, { headers: owner ? { 'x-ghosty': '1', 'x-ghosty-key': OWNER_KEY } : {} }), env, { waitUntil: () => undefined });

test('/api/aim/* through the Worker: owner only, plain errors', async () => {
  reset();
  const anon = await get('/api/aim/places?lat=52.48&lon=-1.9', false);
  assert.ok(anon.status === 401 || anon.status === 403, `anonymous: ${anon.status}`);
  const r = await get('/api/aim/places?lat=52.4797&lon=-1.9026&r=15000');
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.ok(j.places.length > 30);
  assert.equal(j.credit, 'Places: Wikipedia, OpenStreetMap');
  const bad = await get('/api/aim/places?lat=north&lon=-1.9');
  assert.equal(bad.status, 400);
  assert.match((await bad.json()).error, /lat and lon/);
  const iss = await (await get('/api/aim/iss')).json();
  assert.equal(Math.round(iss.altKm), 430);
  const about = await (await get('/api/aim/about?title=BT%20Tower%2C%20Birmingham')).json();
  assert.match(about.extract, /telecommunications tower in Birmingham/);
  assert.equal((await get('/api/aim/nothing')).status, 404);
});
