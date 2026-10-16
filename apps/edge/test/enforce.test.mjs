// West Midlands Police safety-camera sites merged into God's Eye's ANPR / speed layer
// (apps/web/src/data/enforce.ts): kinds counted, limit text, source and detail, the change
// event, the once-per-page loader through the brain's proxy. Network faked.
import test from 'node:test';
import assert from 'node:assert/strict';
const E = await import('./.build/enforce.mjs');

const SITES = [
  { id: 'wmp-101-mobile', kind: 'mobile', name: 'A34 Stratford Road, Hall Green', area: 'Birmingham', lat: 52.4283, lon: -1.842, limit: '30', offences: 412, topSpeed: 58, lastEnforced: '2024-11-14' },
  { id: 'wmp-S12-average', kind: 'average', name: 'M6 J5 to J4A southbound', area: 'Solihull', lat: 52.48, lon: -1.76, limit: '50', offences: 1583, topSpeed: 94, lastEnforced: '' },
  { id: 'wmp-H3-variable', kind: 'variable', name: 'M6 J10A gantry', area: 'Walsall', lat: 52.6262, lon: -2.0387, limit: 'Variable', offences: 77, topSpeed: 101, lastEnforced: '2024-03-02' },
];

const RAW = [
  { name: 'A34 Stratford Road, Hall Green', siteno: '101', cat: 'A', area: 'Birmingham', ltt: '52.4283', lgt: '-1.8420', limit: '30', sitetype: 'mobile', totaloffences: 412, highspeed: 58, lastenforced: '14/11/2024' },
  { name: 'M6 J10A gantry', siteno: 'H3', cat: 'M', area: 'Walsall', ltt: '52.6262', lgt: '-2.0387', limit: 'Variable', sitetype: 'hadecs', totaloffences: 77, highspeed: 101, lastenforced: '02/03/2024' },
  { name: 'Broken row', siteno: '999', ltt: 'n/a', lgt: '', limit: '40', sitetype: 'mobile' },
];

test('mergeSafety: every site becomes an enforcement camera with its kind, limit text, source and detail; one change event', () => {
  const feed = new E.EnforceFeed();
  let changes = 0;
  feed.events.on('change', () => changes++);
  assert.equal(E.mergeSafety(feed, SITES), 3);
  assert.equal(changes, 1, 'listeners are told once per merge');
  const c = feed.counts();
  assert.equal(c.mobile, 1);
  assert.equal(c.average, 1);
  assert.equal(c.variable, 1);
  assert.equal(c.speed + c.anpr + c.redlight + c.buslane + c.cctv, 0);
  const van = feed.list.get('wmp-101-mobile');
  assert.equal(van.kind, 'mobile');
  assert.equal(van.maxspeed, '30 mph');
  assert.equal(van.operator, 'West Midlands Police');
  assert.equal(van.source, 'wmp');
  assert.deepEqual(van.tags, {});
  assert.deepEqual(van.detail, { limit: '30', offences: 412, topSpeed: 58, lastEnforced: '2024-11-14', area: 'Birmingham' });
  assert.equal(feed.list.get('wmp-S12-average').maxspeed, '50 mph');
  assert.equal(feed.list.get('wmp-H3-variable').maxspeed, 'variable', 'gantries have no fixed limit');
  assert.equal(feed.list.get('wmp-H3-variable').detail.lastEnforced, '2024-03-02');
  // near() still works with the merged sites
  assert.deepEqual(feed.near(52.4283, -1.842, 1).map((x) => x.id), ['wmp-101-mobile']);
  assert.equal(feed.near(52.5, -1.9, 60).length, 3);
  // merging the same list again replaces, never duplicates
  assert.equal(E.mergeSafety(feed, SITES), 3);
  assert.equal(feed.list.size, 3);
  assert.equal(changes, 2);
  assert.equal(E.mergeSafety(feed, []), 0, 'an empty list merges nothing');
});

test('the new kinds have labels and colours; the OpenStreetMap path is unchanged', () => {
  assert.equal(E.ENFORCE_LABEL.mobile, 'MOBILE SPEED ENFORCEMENT SITE');
  assert.equal(E.ENFORCE_LABEL.variable, 'VARIABLE-SPEED GANTRY CAMERA');
  for (const k of ['anpr', 'speed', 'average', 'redlight', 'buslane', 'cctv', 'mobile', 'variable']) {
    assert.ok(E.ENFORCE_LABEL[k], `label for ${k}`);
    assert.equal(E.ENFORCE_COLORS[k].length, 3, `colour for ${k}`);
  }
  const osm = E.parseOverpass({ elements: [{ type: 'node', id: 1, lat: 52.48, lon: -1.89, tags: { highway: 'speed_camera', maxspeed: '30 mph' } }] });
  assert.equal(osm[0].kind, 'speed');
  assert.equal(osm[0].source, undefined, 'OSM cameras carry no source field');
  assert.equal(osm[0].detail, undefined);
  const feed = new E.EnforceFeed();
  for (const x of osm) feed.list.set(x.id, x);
  E.mergeSafety(feed, SITES);
  assert.equal(feed.list.size, 4, 'police sites sit beside the OSM cameras');
  assert.equal(feed.counts().speed, 1);
});

test('inWestMidlands: the box the eye tab uses to decide when to load the police list', () => {
  assert.equal(E.inWestMidlands(52.48, -1.9), true, 'Birmingham');
  assert.equal(E.inWestMidlands(52.586, -2.129), true, 'Wolverhampton');
  assert.equal(E.inWestMidlands(52.407, -1.52), true, 'Coventry');
  assert.equal(E.inWestMidlands(51.507, -0.128), false, 'London');
  assert.equal(E.inWestMidlands(53.48, -2.24), false, 'Manchester');
});

test('loadWmSafety: fetched once per page life through the brain proxy (a day in the cache), merged into the shared feed', async () => {
  const urls = [];
  globalThis.fetch = async (input, init) => {
    const url = String(typeof input === 'string' ? input : input.url);
    urls.push(url);
    assert.equal(init?.headers?.['x-ghosty'], '1', 'the brain proxy call carries the interface headers');
    return new Response(JSON.stringify(RAW), { headers: { 'content-type': 'application/json' } });
  };
  let changes = 0;
  E.enforce.events.on('change', () => changes++);
  const [a, b] = await Promise.all([E.loadWmSafety(), E.loadWmSafety()]);
  assert.equal(a, 2, 'two good rows, the broken one skipped');
  assert.equal(b, 2);
  assert.equal(await E.loadWmSafety(), 2);
  assert.equal(urls.length, 1, 'one upstream fetch for the whole page life');
  assert.equal(urls[0], `/api/proxy?ttl=86400&url=${encodeURIComponent('https://wmsafetycameras.co.uk/camera_map/manage/data.json')}`);
  assert.equal(changes, 1);
  assert.equal(E.enforce.list.get('wmp-101-mobile').kind, 'mobile');
  assert.equal(E.enforce.list.get('wmp-H3-variable').maxspeed, 'variable');
  assert.equal(E.enforce.counts().mobile, 1);
  assert.equal(E.enforce.counts().variable, 1);
});
