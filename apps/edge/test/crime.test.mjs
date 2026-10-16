// Street crime around a place (police.uk open data): summary, God's Eye hand-off, UK-only, trigger words. Network faked.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const T = await import('./.build/tools/index.mjs');

const crime = (category, street, outcome, month = '2026-08') => ({ category, month, location: { latitude: '52.48', longitude: '-1.9', street: { name: `On or near ${street}` } }, outcome_status: outcome ? { category: outcome, date: month } : null });
const SAMPLE = [
  crime('violent-crime', 'Corporation Street', 'Investigation complete; no suspect identified'),
  crime('violent-crime', 'Corporation Street', null),
  crime('shoplifting', 'Supermarket', 'Offender given a caution'),
  crime('anti-social-behaviour', 'New Street', null),
  crime('vehicle-crime', 'Parking Area', 'Investigation complete; no suspect identified'),
  crime('burglary', 'New Street', 'Under investigation'),
];

const calls = [];
globalThis.fetch = async (input) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  calls.push(url);
  const j = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
  if (url.hostname === 'data.police.uk') {
    if (url.searchParams.get('date') === '2019-01') return new Response('', { status: 404 });
    return j(SAMPLE);
  }
  if (url.hostname === 'nominatim.openstreetmap.org') {
    const q = url.searchParams.get('q').toLowerCase();
    if (q.includes('paris')) return j([{ lat: '48.8566', lon: '2.3522', display_name: 'Paris, France', name: 'Paris' }]);
    return j([]);
  }
  return new Response('not faked', { status: 599 });
};

const ctxFor = () => {
  const events = [];
  return { events, ctx: { vault: { get: async () => null }, storage: { get: async () => undefined }, emit: (e) => events.push(e) } };
};

test('crime_near sums up the latest month around a place and shows it on God\'s Eye', async () => {
  const tool = T.toolByName.get('crime_near');
  assert.ok(tool, 'tool registered');
  const { events, ctx } = ctxFor();
  const out = await tool.run({ place: 'Birmingham City Centre' }, ctx);
  assert.match(out, /6 crimes reported within a mile of Birmingham City Centre in August 2026/);
  assert.match(out, /violence and sexual offences 2/);
  assert.ok(out.indexOf('violence and sexual offences 2') < out.indexOf('shoplifting 1'), 'biggest category first');
  assert.match(out, /Corporation Street \(2\)/);
  assert.doesNotMatch(out, /Supermarket \(/, 'generic location types are not streets');
  assert.match(out, /3 still open, 2 closed with no suspect found, 1 with a charge/);
  assert.deepEqual(events.map((e) => e.name), ['show_crime']);
  assert.ok(Math.abs(events[0].args.lat - 52.48) < 0.01);
  const req = calls.find((u) => u.hostname === 'data.police.uk');
  assert.equal(req.pathname, '/api/crimes-street/all-crime');
  assert.equal(req.searchParams.get('date'), null, 'latest month by default');
});

test('crime_near knows its limits: a missing month, and places outside the UK', async () => {
  const tool = T.toolByName.get('crime_near');
  assert.match(await tool.run({ place: 'Birmingham', month: '2019-01' }, ctxFor().ctx), /no month "2019-01"/);
  const { events, ctx } = ctxFor();
  assert.match(await tool.run({ place: 'Paris' }, ctx), /outside England, Wales and Northern Ireland/);
  assert.equal(events.length, 0, 'no fly-to for places without data');
});

test('crime tools are offered when the owner asks about safety or crime', () => {
  const names = (msg) => T.selectTools(msg, new Set()).map((t) => t.name);
  assert.ok(names('how safe is Moseley at night?').includes('crime_near'));
  assert.ok(names('any burglaries near me recently').includes('crime_near'));
  assert.ok(!names('what is the weather like').includes('crime_near'));
});
