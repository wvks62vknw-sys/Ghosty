// God's Eye intelligence feeds: parsers for every source (interface) + AISstream (brain).
// (TfL, NYC, Caltrans and Fintraffic cameras are covered by tests/cameras.spec.mjs.)
import test from 'node:test';
import assert from 'node:assert/strict';
const I = await import('./.build/intel.mjs');
const { collectAis, foldAis } = await import('./.build/ais.mjs');
const E = await import('./.build/enforce.mjs');

test('Extra camera networks: Ontario, DriveBC, NSW and Calgary', () => {
  const on = I.parseOntario([{ Id: 7, Latitude: 43.6, Longitude: -79.4, Roadway: 'QEW', Location: 'at Hwy 427', Views: [{ Url: 'https://511on.ca/map/Cctv/123', Status: 'Enabled' }] }, { Id: 8, Latitude: 43, Longitude: -79, Views: [{ Url: 'https://511on.ca/map/Cctv/9', Status: 'Disabled' }] }]);
  assert.deepEqual(on.map((c) => c.name), ['QEW · at Hwy 427']);
  const bc = I.parseDriveBc([{ id: 5, name: 'Hwy 1', is_on: true, should_appear: true, location: { coordinates: [-123.1, 49.2] } }, { id: 6, is_on: false, should_appear: true, location: { coordinates: [-123, 49] } }]);
  assert.equal(bc.length, 1);
  const nsw = I.parseNsw({ features: [{ id: 'a', geometry: { coordinates: [151.2, -33.8] }, properties: { href: 'https://webcams.transport.nsw.gov.au/livetraffic-webcams/cameras/a.jpeg', title: 'Harbour Bridge' } }] });
  assert.equal(nsw[0].name, 'Harbour Bridge');
  const yyc = I.parseCalgary([{ camera_url: { url: 'http://trafficcam.calgary.ca/loc12.jpg' }, point: { coordinates: [-114, 51] }, camera_location: 'Deerfoot' }]);
  assert.equal(yyc[0].img, 'https://trafficcam.calgary.ca/loc12.jpg');
});

test('Digitraffic ships: names joined, stale dropped, heading fallback', () => {
  const now = Date.parse('2026-10-15T05:00:00Z');
  const list = I.parseDigitrafficShips(
    { features: [
      { geometry: { coordinates: [24.9, 60.1] }, properties: { mmsi: 230000001, sog: 12.3, cog: 90, heading: 511, navStat: 0, timestampExternal: now - 60_000 } },
      { geometry: { coordinates: [25, 60] }, properties: { mmsi: 230000002, sog: 0, cog: 0, heading: 10, timestampExternal: now - 3 * 3600_000 } },
    ] },
    [{ mmsi: 230000001, name: 'VIKING GRACE ', shipType: 60, destination: 'TURKU' }],
    now,
  );
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'VIKING GRACE');
  assert.equal(list[0].hdg, 90);
  assert.equal(I.shipKind(list[0].type), 'PASSENGER');
  assert.equal(I.shipKind(81), 'TANKER');
  assert.equal(I.shipKind(35), 'MILITARY');
  const p = I.ships.pos({ ...list[0], t: now - 3600_000 }, now);
  assert.ok(p.lon > 24.95 && p.lon < 25, `dead reckoning moved east, capped at 10 min: ${p.lon}`);
});

test('NWS alerts: polygons and multipolygons, expired dropped', () => {
  const now = Date.parse('2026-10-15T05:00:00Z');
  const sq = [[-100, 40], [-99, 40], [-99, 41], [-100, 41], [-100, 40]];
  const a = I.parseNws({ features: [
    { geometry: { type: 'Polygon', coordinates: [sq] }, properties: { id: 'a', event: 'Tornado Warning', severity: 'Extreme', ends: '2026-10-15T06:00:00Z', areaDesc: 'X County' } },
    { geometry: { type: 'MultiPolygon', coordinates: [[sq], [sq]] }, properties: { id: 'b', event: 'Flood Watch', severity: 'Moderate', expires: '2026-10-15T09:00:00Z' } },
    { geometry: { type: 'Polygon', coordinates: [sq] }, properties: { id: 'c', event: 'Old', expires: '2026-10-14T00:00:00Z' } },
    { geometry: null, properties: { id: 'd', event: 'Zone only' } },
  ] }, now);
  assert.deepEqual(a.map((x) => x.id), ['a', 'b']);
  assert.equal(a[1].rings.length, 2);
  assert.deepEqual(a[0].rings[0][0], [40, -100]);
});

test('GDACS disasters deduped; NDBC buoys; aurora; cables; Seattle 911', () => {
  const d = I.parseGdacs({ features: [
    { geometry: { type: 'Point', coordinates: [130, 20] }, properties: { eventtype: 'TC', eventid: 1, name: 'Typhoon X', alertlevel: 'Red', url: { report: 'https://gdacs.org/r' }, severitydata: { severitytext: 'Category 4' } } },
    { geometry: { type: 'Point', coordinates: [130, 20] }, properties: { eventtype: 'TC', eventid: 1 } },
    { geometry: { type: 'Polygon', coordinates: [] }, properties: { eventtype: 'FL', eventid: 2 } },
  ] });
  assert.equal(d.length, 1);
  assert.equal(d[0].kind, 'CYCLONE');
  assert.equal(d[0].severity, 'Category 4');

  const txt = '#STN       LAT      LON  YYYY MM DD hh mm WDIR WSPD   GST WVHT  DPD APD MWD   PRES  PTDY  ATMP  WTMP  DEWP  VIS   TIDE\n#text      deg      deg  yr   mo day hr mn degT m/s    m/s  m    sec sec degT  hPa    hPa   degC  degC  degC  nmi   ft\n41001   34.79  -72.50 2026 10 15 04 50  200  8.0  10.0  2.1    8  MM  MM 1016.2    MM  22.1  25.3    MM   MM     MM\nBAD     MM      MM    2026 10 15 04 50  MM   MM    MM    MM   MM  MM  MM   MM     MM    MM    MM    MM   MM     MM\n';
  const b = I.parseNdbc(txt);
  assert.equal(b.length, 1);
  assert.equal(b[0].wvht, 2.1);
  assert.equal(b[0].wtmp, 25.3);
  assert.equal(b[0].dpd, 8);
  assert.equal(b[0].t, Date.UTC(2026, 9, 15, 4, 50));

  const au = I.parseAurora({ 'Forecast Time': 't', coordinates: [[0, 70, 3], [200, 65, 40], [10, -70, 12]] });
  assert.deepEqual(au.cells, [[65, -160, 40], [-70, 10, 12]]);

  const cb = I.parseCables({ features: [{ properties: { id: 'x', name: 'MAREA', color: '#ff0000' }, geometry: { type: 'MultiLineString', coordinates: [[[-76, 36.8], [-3, 43.3]], [[0, 0]]] } }] });
  assert.equal(cb[0].lines.length, 1);
  assert.deepEqual(cb[0].lines[0][0], [36.8, -76]);

  const now = Date.parse('2026-10-15T05:00:00Z');
  const ds = I.parseDispatch([
    { incident_number: 'F1', type: 'Aid Response', address: '1 Pike St', datetime: '2026-10-14T21:30:00.000', latitude: '47.6', longitude: '-122.3' },
    { incident_number: 'F2', type: 'Fire', datetime: '2026-10-10T21:30:00.000', latitude: '47.6', longitude: '-122.3' },
  ], now);
  assert.deepEqual(ds.map((x) => x.id), ['F1']);
  assert.ok(Math.abs(ds[0].t - now) < 2 * 3600_000, 'Seattle local time converted to UTC');
});

test('AISstream: positions + static data folded; bad rows ignored; socket closed', async () => {
  const t = new Map();
  foldAis(t, JSON.stringify({ MessageType: 'ShipStaticData', MetaData: { MMSI: 1, ShipName: 'EVER GIVEN@@' }, Message: { ShipStaticData: { Type: 70, Destination: 'ROTTERDAM@@' } } }));
  foldAis(t, { MessageType: 'PositionReport', MetaData: { MMSI: 1, ShipName: 'EVER GIVEN' }, Message: { PositionReport: { Latitude: 51.9, Longitude: 4.1, Sog: 12, Cog: 270, TrueHeading: 511, NavigationalStatus: 0 } } });
  foldAis(t, '{not json');
  foldAis(t, { MessageType: 'PositionReport', MetaData: { MMSI: 2 }, Message: { PositionReport: { Latitude: 91, Longitude: 0 } } });
  const s = t.get(1);
  assert.equal(s.name, 'EVER GIVEN');
  assert.equal(s.dest, 'ROTTERDAM');
  assert.equal(s.type, 70);
  assert.equal(s.hdg, 270);
  assert.equal(t.has(2), false);

  let sent = null;
  let closed = false;
  const handlers = [];
  const fake = { accept() {}, send(d) { sent = JSON.parse(d); setTimeout(() => handlers.forEach((h) => h({ data: new TextEncoder().encode(JSON.stringify({ MessageType: 'StandardClassBPositionReport', MetaData: { MMSI: 9, ShipName: 'YACHT' }, Message: { StandardClassBPositionReport: { Latitude: 50.1, Longitude: -1.2, Sog: 6, Cog: 45, TrueHeading: 40 } } })).buffer })), 5); }, close() { closed = true; }, addEventListener(_t, fn) { handlers.push(fn); } };
  const ships = await collectAis('KEY', [-2, 50, -1, 51], 30, async () => fake);
  assert.equal(sent.APIKey, 'KEY');
  assert.deepEqual(sent.BoundingBoxes, [[[50, -2], [51, -1]]]);
  assert.equal(closed, true);
  assert.equal(ships.length, 1);
  assert.equal(ships[0].name, 'YACHT');
});

test('ANPR / speed / red-light cameras from OpenStreetMap are classified', () => {
  const k = (tags) => E.classify(tags);
  assert.equal(k({ man_made: 'surveillance', 'surveillance:type': 'ALPR' }), 'anpr');
  assert.equal(k({ man_made: 'surveillance', 'surveillance:type': 'camera', description: 'ANPR camera, Clean Air Zone' }), 'anpr');
  assert.equal(k({ highway: 'speed_camera', maxspeed: '30 mph' }), 'speed');
  assert.equal(k({ type: 'enforcement', enforcement: 'average_speed' }), 'average');
  assert.equal(k({ type: 'enforcement', enforcement: 'traffic_signals' }), 'redlight');
  assert.equal(k({ man_made: 'surveillance', name: 'Bus lane camera' }), 'buslane');
  assert.equal(k({ man_made: 'surveillance', surveillance: 'public' }), 'cctv');
  assert.equal(k({ amenity: 'cafe' }), null);
  const list = E.parseOverpass({ elements: [
    { type: 'node', id: 1, lat: 52.48, lon: -1.89, tags: { man_made: 'surveillance', 'surveillance:type': 'ALPR', operator: 'Birmingham City Council' } },
    { type: 'relation', id: 2, center: { lat: 52.5, lon: -1.9 }, tags: { type: 'enforcement', enforcement: 'average_speed', maxspeed: '50 mph' } },
    { type: 'node', id: 3, lat: 52.4, lon: -1.8, tags: { amenity: 'bench' } },
  ] });
  assert.deepEqual(list.map((c) => [c.id, c.kind]), [['node/1', 'anpr'], ['relation/2', 'average']]);
  assert.equal(list[0].operator, 'Birmingham City Council');
  assert.match(E.overpassQuery([52.4, -2, 52.6, -1.7]), /speed_camera.*surveillance.*enforcement/);
});

test('West Midlands Police safety-camera sites: kinds mapped, dates converted, bad rows and unknown types skipped', () => {
  const sites = I.parseWmSafety([
    { name: 'A34 Stratford Road, Hall Green', siteno: '101', cat: 'A', area: 'Birmingham', ltt: '52.4283', lgt: '-1.8420', limit: '30', sitetype: 'mobile', totaloffences: 412, highspeed: 58, lastenforced: '14/11/2024' },
    { name: 'M6 J5 to J4A southbound', siteno: 'S12', cat: 'M', area: 'Solihull', ltt: '52.4800', lgt: '-1.7600', limit: '50', sitetype: 'specs', totaloffences: '1583', highspeed: '94', lastenforced: 'No Data' },
    { name: 'M6 J10A gantry', siteno: 'H3', cat: 'M', area: 'Walsall', ltt: '52.6262', lgt: '-2.0387', limit: 'Variable', sitetype: 'hadecs', totaloffences: 77, highspeed: 101, lastenforced: '02/03/2024' },
    { name: 'Broken row', siteno: '999', area: 'Dudley', ltt: 'n/a', lgt: '', limit: '40', sitetype: 'mobile', totaloffences: 1, highspeed: 1, lastenforced: '01/01/2024' },
    { name: 'Unknown type', siteno: '7', area: 'Coventry', ltt: '52.41', lgt: '-1.51', limit: '30', sitetype: 'fixed', totaloffences: 0, highspeed: 0, lastenforced: 'No Data' },
    null,
    'not a site',
  ]);
  assert.deepEqual(sites.map((s) => [s.id, s.kind]), [['wmp-101-mobile', 'mobile'], ['wmp-S12-average', 'average'], ['wmp-H3-variable', 'variable']]);
  assert.equal(sites[0].name, 'A34 Stratford Road, Hall Green');
  assert.equal(sites[0].area, 'Birmingham');
  assert.equal(sites[0].lat, 52.4283);
  assert.equal(sites[0].lon, -1.842);
  assert.equal(sites[0].limit, '30');
  assert.equal(sites[0].offences, 412);
  assert.equal(sites[0].topSpeed, 58);
  assert.equal(sites[0].lastEnforced, '2024-11-14', 'dd/mm/yyyy becomes yyyy-mm-dd');
  assert.equal(sites[1].lastEnforced, '', '"No Data" becomes an empty date');
  assert.equal(sites[1].offences, 1583, 'numbers given as strings are read');
  assert.equal(sites[1].topSpeed, 94);
  assert.equal(sites[2].limit, 'Variable');
  assert.equal(sites[2].lastEnforced, '2024-03-02');
  assert.deepEqual(I.parseWmSafety({ not: 'an array' }), []);
  assert.deepEqual(I.parseWmSafety(null), []);
});

test('Aurora: a low chance stays a faint glow from far away, not a white ring; a strong night and a close look still show', () => {
  // From 16,000 km each glow dot overlaps about 16 neighbours, drawn as light that adds up.
  const far = I.auroraDot(10, 16000);
  const summed = far.rgba[3] * 16;
  assert.ok(summed < 0.3, `16 overlapping 10 % dots add up to ${summed.toFixed(2)} (the old fixed 0.19 each summed to 3)`);
  assert.ok(I.auroraDot(60, 16000).rgba[3] > far.rgba[3] * 3, 'a strong aurora is clearly brighter than a weak one');
  assert.ok(I.auroraDot(10, 3000).rgba[3] >= 0.1, 'zoomed in (few overlaps), a 10 % chance is still visible');
  assert.ok(I.auroraDot(100, 100).rgba[3] <= 0.55 && I.auroraDot(0, 16000).rgba[3] > 0, 'alpha stays in range');
});
