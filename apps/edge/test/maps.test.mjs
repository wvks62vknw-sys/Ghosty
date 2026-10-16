// Maps and places: the flat map (show_map), what is at a spot, elevation, UK postcodes and
// straight-line distances — free, keyless services, mocked here; known places only, no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const T = await import('./.build/tools/index.mjs');
const M = await import('./.build/tools/maps.mjs');
const brain = await import('./.build/brain.mjs');
const ctx = (emit) => ({ emit, vault: { get: async () => '' }, storage: { get: async () => undefined } });

/** Answer named hosts with canned JSON; anything else is "not faked". */
function fakeFetch(routes) {
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    calls.push(url);
    for (const [re, body, status = 200] of routes) if (re.test(url)) return new Response(JSON.stringify(typeof body === 'function' ? body(url) : body), { status, headers: { 'content-type': 'application/json' } });
    return new Response('not faked', { status: 599 });
  };
  return { calls, restore: () => (globalThis.fetch = real) };
}

test('the map tools are offered for the right questions', () => {
  const names = (msg) => T.selectTools(msg, new Set(), false).map((t) => t.name);
  assert.ok(names('show me a map of london').includes('show_map'));
  assert.ok(names('how high is ben nevis').includes('elevation'));
  assert.ok(names('where is B1 1AA').includes('uk_postcode'));
  assert.ok(names('distance between london and birmingham as the crow flies').includes('measure_distance'));
  assert.ok(names("what's here").includes('what_is_here'));
  assert.ok(names('show me the railway lines near leeds on a map').includes('show_map'));
  assert.ok(!names('what is the weather tomorrow').includes('show_map'));
});

test('show_map opens the flat map at a known place with a style, overlays and pins (bad values dropped)', async () => {
  const events = [];
  const out = await T.toolByName.get('show_map').run({ place: 'London', style: 'topo', overlays: ['rail', 'bogus'], points: [{ lat: 51.5, lon: -0.1, label: 'A' }, { lat: 'x', lon: 1 }], zoom: 99 }, ctx((e) => events.push(e)));
  assert.equal(events[0].name, 'show_map');
  const a = events[0].args;
  assert.ok(Math.abs(a.lat - 51.5074) < 0.01 && Math.abs(a.lon + 0.1278) < 0.01);
  assert.equal(a.style, 'topo');
  assert.deepEqual(a.overlays, ['rail']);
  assert.deepEqual(a.points, [{ lat: 51.5, lon: -0.1, label: 'A' }]);
  assert.equal(a.zoom, 19);
  assert.match(out, /map of London is open on God's Eye \(topo\) with rail, 1 pin marked/);
  // "lat,lon" as the place
  const ev2 = [];
  await T.toolByName.get('show_map').run({ place: '48.8584, 2.2945' }, ctx((e) => ev2.push(e)));
  assert.ok(Math.abs(ev2[0].args.lat - 48.8584) < 1e-6 && Math.abs(ev2[0].args.lon - 2.2945) < 1e-6);
});

test('measure_distance: London to Birmingham, straight line, bearing north-west, drawn on the map', async () => {
  const events = [];
  const out = await T.toolByName.get('measure_distance').run({ from: 'London', to: 'Birmingham' }, ctx((e) => events.push(e)));
  assert.match(out, /London to Birmingham: 16\d km \(10\d miles\)/);
  assert.match(out, /\((N|NNW|NW|WNW)\)/);
  assert.equal(events[0].name, 'show_map');
  assert.equal(events[0].args.line, true);
  assert.equal(events[0].args.points.length, 2);
  assert.equal(events[0].args.points[1].label, 'Birmingham');
  // the maths itself
  assert.ok(Math.abs(M.haversineKm({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }) - 111.19) < 0.1);
  assert.equal(Math.round(M.bearingDeg({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })), 0);
  assert.equal(M.compass(90), 'E');
});

test('elevation: metres and feet from Open-Meteo', async () => {
  const f = fakeFetch([[/api\.open-meteo\.com\/v1\/elevation/, { elevation: [1345] }]]);
  try {
    const out = await T.toolByName.get('elevation').run({ place: 'London' }, ctx(() => undefined));
    assert.match(out, /London is about 1345 m \(4413 ft\) above sea level/);
    assert.ok(f.calls.some((u) => /latitude=51\.50/.test(u)));
  } finally {
    f.restore();
  }
});

test('what_is_here: the address, what it is, the UK postcode and council, and Wikipedia landmarks, pinned on the map', async () => {
  const f = fakeFetch([
    [/nominatim\.openstreetmap\.org\/reverse/, { name: 'Big Ben', type: 'attraction', display_name: 'Big Ben, Westminster, London, SW1A 0AA', address: { postcode: 'SW1A 0AA' } }],
    [/en\.wikipedia\.org\/w\/api\.php/, { query: { pages: { 1: { title: 'Big Ben', extract: 'A clock tower at the Palace of Westminster.', coordinates: [{ lat: 51.5007, lon: -0.1246 }] }, 2: { title: 'Westminster Bridge', extract: 'A road bridge over the Thames.', coordinates: [{ lat: 51.5008, lon: -0.122 }] } } } }],
    [/api\.postcodes\.io\/postcodes\?/, { result: [{ postcode: 'SW1A 0AA', latitude: 51.5007, longitude: -0.1246, admin_district: 'Westminster', admin_ward: 'St James', parliamentary_constituency: 'Cities of London and Westminster', distance: 12 }] }],
  ]);
  try {
    const events = [];
    const out = await T.toolByName.get('what_is_here').run({ lat: 51.5007, lon: -0.1246 }, ctx((e) => events.push(e)));
    assert.match(out, /WHERE: Big Ben, Westminster, London/);
    assert.match(out, /WHAT: Big Ben — attraction/);
    assert.match(out, /POSTCODE: SW1A 0AA · Westminster · St James ward · Cities of London and Westminster constituency/);
    assert.match(out, /NEARBY \(Wikipedia, within 800 m\):\n- Big Ben \(\d+ m\): A clock tower/);
    assert.match(out, /- Westminster Bridge \(\d+ m\): A road bridge/);
    assert.equal(events[0].name, 'show_map');
    assert.equal(events[0].args.style, 'streets');
    assert.deepEqual(events[0].args.points.map((p) => p.label), ['Big Ben', 'Big Ben', 'Westminster Bridge']);
  } finally {
    f.restore();
  }
});

test('uk_postcode: a postcode, or the nearest one to a place; outside the UK says so', async () => {
  const f = fakeFetch([
    [/api\.postcodes\.io\/postcodes\/B11AA/, { result: { postcode: 'B1 1AA', latitude: 52.4797, longitude: -1.9026, admin_district: 'Birmingham', admin_ward: 'Ladywood', parliamentary_constituency: 'Birmingham Ladywood', region: 'West Midlands', country: 'England' } }],
    [/api\.postcodes\.io\/postcodes\/ZZ99ZZ/, { error: 'Invalid postcode' }, 404],
    [/api\.postcodes\.io\/postcodes\?/, { result: [{ postcode: 'B2 4QA', latitude: 52.48, longitude: -1.9, admin_district: 'Birmingham', distance: 40 }] }],
  ]);
  try {
    const events = [];
    const out = await T.toolByName.get('uk_postcode').run({ postcode: 'b1 1aa' }, ctx((e) => events.push(e)));
    assert.match(out, /^B1 1AA — Birmingham · Ladywood ward · Birmingham Ladywood constituency · West Midlands · England/);
    assert.equal(events[0].name, 'show_map');
    assert.equal(events[0].args.points[0].label, 'B1 1AA');
    await assert.rejects(T.toolByName.get('uk_postcode').run({ postcode: 'ZZ99 ZZ' }, ctx(() => undefined)), /not a UK postcode/);
    const near = await T.toolByName.get('uk_postcode').run({ place: 'Birmingham' }, ctx(() => undefined));
    assert.match(near, /^Nearest postcode to Birmingham: B2 4QA — Birmingham .*40 m away/);
    await assert.rejects(T.toolByName.get('uk_postcode').run({ place: 'New York' }, ctx(() => undefined)), /not in the UK/);
  } finally {
    f.restore();
  }
});

test('/keys/public hands the interface a public Mapbox token and never anything else', async () => {
  class MemStorage {
    m = new Map();
    async get(k) { return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
    async put(k, v) { this.m.set(k, structuredClone(v)); }
    async delete(k) { return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k); }
    async list({ prefix = '' } = {}) { return new Map([...this.m].filter(([x]) => x.startsWith(prefix))); }
    async setAlarm() {}
    async getAlarm() { return null; }
    get sql() { return { exec: () => { throw new Error('no sql in this test'); }, databaseSize: 0 }; }
  }
  const OWNER = 'owner-key-for-tests-0123456789';
  const f = fakeFetch([]); // key checks (api.mapbox.com) are "not faked": the key is still saved
  try {
    const pending = [];
    const agent = new brain.GhostyAgent({ storage: new MemStorage(), waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (fn) => fn() }, { VAULT_KEY: Buffer.alloc(32, 7).toString('base64') });
    const call = async (path, init = {}) => {
      const r = await agent.fetch(new Request(`https://ghosty.test/api${path}`, { ...init, headers: { 'x-ghosty-key': OWNER, ...(init.headers ?? {}) } }));
      await Promise.allSettled(pending.splice(0));
      return r;
    };
    assert.deepEqual(await (await call('/keys/public')).json(), {});
    await call('/keys', { method: 'POST', body: JSON.stringify({ name: 'mapbox', value: 'pk.eyJ1IjoidGVzdCJ9.abc' }) });
    await call('/keys', { method: 'POST', body: JSON.stringify({ name: 'groq', value: 'gsk_secret_never_public' }) });
    assert.deepEqual(await (await call('/keys/public')).json(), { mapbox: 'pk.eyJ1IjoidGVzdCJ9.abc' });
    // a secret Mapbox token is refused before it reaches the vault: the public one stays, and is still handed out
    const bad = await call('/keys', { method: 'POST', body: JSON.stringify({ name: 'mapbox', value: 'sk.secret' }) });
    assert.equal(bad.status, 400);
    assert.match((await bad.json()).error, /public token/);
    assert.deepEqual(await (await call('/keys/public')).json(), { mapbox: 'pk.eyJ1IjoidGVzdCJ9.abc' });
    // removing the token (an empty value) still works
    await call('/keys', { method: 'POST', body: JSON.stringify({ name: 'mapbox', value: '' }) });
    assert.deepEqual(await (await call('/keys/public')).json(), {});
    // without the owner key: nothing (sign-in is checked by the Worker in front of the brain)
    const env = { OWNER_KEY: 'k'.repeat(32), AGENT: { idFromName: () => 'owner', get: () => ({ fetch: (r) => agent.fetch(r) }) } };
    assert.equal((await brain.default.fetch(new Request('https://ghosty.test/api/keys/public'), env, { waitUntil() {} })).status, 401);
    assert.deepEqual(await (await brain.default.fetch(new Request('https://ghosty.test/api/keys/public', { headers: { 'x-ghosty-key': 'k'.repeat(32) } }), env, { waitUntil() {} })).json(), {});
  } finally {
    f.restore();
  }
});
