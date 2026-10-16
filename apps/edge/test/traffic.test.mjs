// Live cameras and live traffic: honest answers where there are no public cameras
// (Birmingham), TomTom traffic through the brain, Durham cameras parsed. Network faked.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const T = await import('./.build/tools/index.mjs');
const I = await import('./.build/intel.mjs');

const calls = [];
let tomtom = {};
globalThis.fetch = async (input) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  calls.push(url);
  const j = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
  if (url.hostname === 'nominatim.openstreetmap.org') {
    const q = url.searchParams.get('q').toLowerCase();
    if (q.includes('birmingham')) return j([{ lat: '52.4797', lon: '-1.9026', display_name: 'Birmingham, West Midlands, England', name: 'Birmingham City Centre' }]);
    if (q.includes('london')) return j([{ lat: '51.5074', lon: '-0.1278', display_name: 'London, England', name: 'London' }]);
    return j([]);
  }
  if (url.hostname === 'api.tomtom.com') {
    if (url.searchParams.get('key') !== 'TT-KEY') return j({ error: 'bad key' }, 403);
    if (url.pathname.includes('flowSegmentData')) return j(tomtom.flow ?? { flowSegmentData: { frc: 'FRC2', currentSpeed: 14, freeFlowSpeed: 42, currentTravelTime: 300, freeFlowTravelTime: 100, confidence: 0.9, roadClosure: false } });
    if (url.pathname.includes('incidentDetails')) return j(tomtom.inc ?? { incidents: [
      { geometry: { type: 'Point', coordinates: [-1.9, 52.48] }, properties: { iconCategory: 9, magnitudeOfDelay: 1, events: [{ description: 'Roadworks' }], from: 'Moor Street', to: 'Moor Street', delay: 60, roadNumbers: [] } },
      { geometry: { type: 'LineString', coordinates: [[-1.89, 52.49], [-1.88, 52.5]] }, properties: { iconCategory: 1, magnitudeOfDelay: 3, events: [{ description: 'Accident' }], from: 'A38(M) Aston Expressway', to: 'Spaghetti Junction', delay: 840, roadNumbers: ['A38(M)'] } },
    ] });
    if (url.pathname.includes('/tile/flow/')) return new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'content-type': 'image/png' } });
  }
  return new Response('not faked', { status: 599 });
};

const ctxFor = (keys = {}) => {
  const events = [];
  return { events, ctx: { vault: { get: async (k) => keys[k] ?? null }, storage: { get: async () => undefined }, emit: (e) => events.push(e) } };
};

test("show_cameras in Birmingham: the city's own streets have none, so the nearest National Highways motorway camera opens, with live traffic", async () => {
  const tool = T.toolByName.get('show_cameras');
  assert.equal(tool.side ?? 'brain', 'brain');
  const { events, ctx } = ctxFor({ tomtom: 'TT-KEY' });
  const out = await tool.run({ place: 'Birmingham City Centre' }, ctx);
  assert.match(out, /nearest National Highways motorway camera to Birmingham City Centre/);
  assert.match(out, /own streets have no public cameras/);
  assert.match(out, /every 20–30 seconds/);
  assert.doesNotMatch(out, /TomTom key/, 'the key is there');
  assert.deepEqual(events.map((e) => e.name), ['show_cameras', 'show_traffic']);
  assert.ok(Math.abs(events[0].args.lat - 52.48) < 0.01);
});

test('show_cameras says honestly where there are no public cameras at all, and shows live traffic instead', async () => {
  const tool = T.toolByName.get('show_cameras');
  const { events, ctx } = ctxFor({ tomtom: 'TT-KEY' });
  const out = await tool.run({ lat: 55.95, lon: -3.19, place: 'Edinburgh' }, ctx);
  assert.match(out, /no public live cameras in Edinburgh/i);
  assert.match(out, /about \d+ km away/);
  assert.match(out, /live traffic/i);
  // the live Waze map opens first (free), then the TomTom overlay
  assert.deepEqual(events.map((e) => e.name), ['traffic_map', 'show_traffic']);
});

test('show_cameras opens the cameras where they exist, and explains the key when traffic is off', async () => {
  const tool = T.toolByName.get('show_cameras');
  let { events, ctx } = ctxFor();
  assert.match(await tool.run({ place: 'London' }, ctx), /nearest live public camera to London/);
  assert.equal(events[0].name, 'show_cameras');
  ({ events, ctx } = ctxFor());
  assert.match(await tool.run({ lat: 52.48, lon: -1.9, place: 'Birmingham' }, ctx), /TomTom key/);
});

test('traffic_now reads TomTom speeds and incidents, worst first, and needs the key', async () => {
  const tool = T.toolByName.get('traffic_now');
  assert.match(await tool.run({ place: 'Birmingham' }, ctxFor().ctx), /free TomTom key/);
  const { events, ctx } = ctxFor({ tomtom: 'TT-KEY' });
  const out = await tool.run({ place: 'Birmingham city centre', radius_km: 4 }, ctx);
  assert.match(out, /14 km\/h now vs 42 km\/h when clear \(33%/);
  assert.match(out, /2 incidents/);
  assert.ok(out.indexOf('Accident on A38(M)') < out.indexOf('Roadworks'), 'worst incident first');
  assert.match(out, /delay 14 min/);
  // the live map always opens, then the nearest motorway cameras (National Highways), then the TomTom overlay with the key
  assert.deepEqual(events.map((e) => e.name), ['traffic_map', 'show_cameras', 'show_traffic']);
  assert.ok(events[2].args.range_km >= 6);
  const bad = ctxFor({ tomtom: 'WRONG' }).ctx;
  await assert.rejects(tool.run({ place: 'Birmingham' }, bad), /did not accept the traffic key/);
});

test('traffic tools are offered when the owner talks about cameras or traffic', () => {
  const names = (msg) => T.selectTools(msg, new Set()).map((t) => t.name);
  assert.ok(names('show me the cameras in Birmingham City Centre').includes('show_cameras'));
  assert.ok(names("how's the traffic on the M6?").includes('traffic_now'));
});

test('Durham County Council cameras parse to stills on their own host', () => {
  const cams = I.parseDurham({ features: [
    { attributes: { Camera_Nam: 'Framwellgate Peth', Camera_Vie: 'View towards the City Centre', Status: 'Live', USS_Camera_Number: 'Dutmc_24' }, geometry: { x: -1.586, y: 54.784 } },
    { attributes: { Camera_Nam: 'Broken', Status: 'Offline', USS_Camera_Number: 'Dutmc_9' }, geometry: { x: -1.5, y: 54.7 } },
    { attributes: { Camera_Nam: 'Bad id', Status: 'Live', USS_Camera_Number: '../x' }, geometry: { x: -1.5, y: 54.7 } },
  ] });
  assert.equal(cams.length, 1);
  assert.equal(cams[0].img, 'https://dcc.ussgroup.co.uk/images/dutmc_24.jpg');
  assert.match(cams[0].name, /Framwellgate Peth · View towards/);
});

test('major places resolve from the built-in list, without the rate-limited map search', async () => {
  const before = calls.filter((u) => u.hostname === 'nominatim.openstreetmap.org').length;
  const { events, ctx } = ctxFor();
  assert.match(await T.toolByName.get('show_cameras').run({ place: 'london' }, ctx), /camera to London/);
  assert.ok(Math.abs(events[0].args.lat - 51.507) < 0.01);
  const b = ctxFor();
  assert.match(await T.toolByName.get('show_cameras').run({ place: 'Birmingham City Centre' }, b.ctx), /motorway camera to Birmingham City Centre/);
  assert.ok(Math.abs(b.events[0].args.lat - 52.48) < 0.01);
  assert.equal(calls.filter((u) => u.hostname === 'nominatim.openstreetmap.org').length, before, 'no map search for major places');
});

test('a null lat/lon from the model means "not given", not 0°N 0°E', async () => {
  const { events, ctx } = ctxFor();
  assert.match(await T.toolByName.get('show_cameras').run({ place: 'London', lat: null, lon: null }, ctx), /camera to London/);
  assert.ok(Math.abs(events[0].args.lat - 51.507) < 0.01);
});
