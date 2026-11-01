// THE OUTSIDE PACK (BRIEF-PACKS-3): which carriage (only what he told it), car parks, toilets, cash machines and drinking water
// from Overpass (answered once a day; a tap's position never kept), what is open (opening_hours read in code), a walk scored
// against police street reports (the walking route and the three months of reports are REAL captures: Birmingham New Street to
// the Jewellery Quarter, data.police.uk for June to August 2026; the Overpass answers are hand-built in the documented format,
// the sandbox could not reach Overpass), the last way home, the rain plan, a bag, a fare split, a midpoint by time, where he
// parked, a queue from his own notes. The maps are never asked for real: every request is answered from a fixture or refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundles, ctxOf, deps, fakeFetch, fixture, Mem, NOW } from './packs-kit.mjs';

const B = await bundles(['src/tools/outside.ts', 'src/packs/index.ts', 'src/schedule.ts', '../../packages/shared/src/outside.ts', '../../packages/shared/src/cards.ts']);
const T = B['src/tools/outside.ts'];
const P = B['src/packs/index.ts'];
const J = B['src/schedule.ts'];
const S = B['../../packages/shared/src/outside.ts'];
const C = B['../../packages/shared/src/cards.ts'];

const OV = JSON.parse(fixture('overpass-nearby.json'));
const ROUTE = JSON.parse(fixture('walk-route.json'));
const CRIMES = JSON.parse(fixture('police-crimes.json'));
const TRANSITOUS = JSON.parse(fixture('../transitous.fixture.json'));
const HOME = { id: 'home', label: 'Home', query: 'B2 4QA', address: 'New Street, Birmingham', lat: 52.4778, lon: -1.8985, at: 0 };
const WORK = { id: 'work', label: 'Work', query: 'JQ', address: 'Jewellery Quarter', lat: 52.4891, lon: -1.9139, at: 0 };
const withPlaces = () => {
  const s = new Mem();
  s.m.set('places', [HOME, WORK]);
  return s;
};

const overpassFor = (u) => {
  const q = decodeURIComponent(new URL(u).searchParams.get('data') ?? '');
  if (q.includes('"parking"')) return OV.parking;
  if (q.includes('"toilets"')) return OV.toilets;
  if (q.includes('"atm"')) return OV.atm;
  if (q.includes('drinking_water')) return OV.water;
  if (q.includes('railway')) return { elements: [{ type: 'node', id: 90, lat: 52.4778, lon: -1.8999, tags: { railway: 'station', name: 'Birmingham New Street' } }] };
  return OV.open;
};
/** Every public server this pack asks, answered from fixtures (a table entry replaces one). */
const net = (over = {}, seen = []) =>
  fakeFetch(
    {
      'https://overpass-api.de/api/interpreter': overpassFor,
      'https://data.police.uk/api/crime-last-updated': { date: '2026-08-01' },
      'https://data.police.uk/api/crimes-street/all-crime': (u) => CRIMES[new URL(u).searchParams.get('date')] ?? [],
      'https://routing.openstreetmap.de/routed-foot/route/v1/driving/': ROUTE,
      ...over,
    },
    seen,
  );
const run = (storage, action, a, now = NOW, fetch = net()) => T.OUTSIDE[action](a, deps(storage, fetch, now));
const asGlobal = async (table, fn) => {
  const was = globalThis.fetch;
  globalThis.fetch = fakeFetch(table);
  try {
    return await fn();
  } finally {
    globalThis.fetch = was;
  }
};

test('opening_hours read in code: days, lists, past midnight, 24/7, off, public holidays set aside — and what is not read is said so', () => {
  const at = (spec, wd, hm) => S.openNow(spec, wd, +hm.slice(0, 2) * 60 + +hm.slice(3));
  const shop = 'Mo-Fr 09:00-17:30; Sa 10:00-16:00; Su off';
  assert.deepEqual(at(shop, 6, '11:00'), { open: true, at: '16:00', left: 300 });
  assert.deepEqual(at(shop, 0, '12:00'), { open: false, at: 'tomorrow 09:00' });
  assert.deepEqual(at(shop, 3, '08:00'), { open: false, at: '09:00' });
  assert.deepEqual(at(shop, 5, '18:00'), { open: false, at: 'tomorrow 10:00' });
  assert.deepEqual(at(shop, 6, '17:00'), { open: false, at: 'Mon 09:00' });
  assert.deepEqual(at('Mo-Su 08:00-02:00', 2, '01:00'), { open: true, at: '02:00', left: 60 }, 'Monday night’s hours run into Tuesday morning');
  assert.deepEqual(at('Mo-Su 17:00-02:00', 2, '23:00'), { open: true, at: '02:00', left: 180 });
  assert.equal(at('24/7', 4, '03:00').open, true);
  assert.deepEqual(at('Mo-Fr 09:00-12:00,13:00-17:00', 1, '12:30'), { open: false, at: '13:00' });
  assert.equal(at('Mo-Fr 09:00-17:00; PH off', 1, '10:00').open, true, 'a public-holiday rule is set aside, not misread');
  assert.equal(at('Sa,Su 10:00-16:00', 0, '10:30').open, true);
  assert.equal(at('Sa-Mo 10:00-16:00', 1, '10:30').open, true, 'a range that wraps the week');
  assert.equal(at('Mo-Su 00:00-24:00', 3, '23:59').open, true);
  assert.equal(S.openNow('sunrise-sunset', 1, 600), null, 'unreadable: null, never guessed');
  assert.equal(S.openNow('by appointment', 1, 600), null);
  assert.equal(S.openNow('', 1, 600), null);
  assert.equal(S.hhmm(1440), '24:00');
});

test('car parks: free and cheap first, private and permit-only ones left out and counted, the sign’s rules said', () => {
  const home = { lat: 52.4778, lon: -1.8985 };
  const { items, hidden } = S.parkingItems(S.parseOverpass(OV.parking, home));
  assert.equal(hidden, 2);
  assert.equal(items[0].name, 'Cannon Street Free Parking');
  assert.match(items[0].line, /free on the map · max stay 2 hours/);
  assert.match(items[0].line, /30 spaces/);
  assert.equal(items.at(-1).rank, 2, 'paid ones last');
  assert.match(items.find((i) => i.name === 'Moor Street Surface Car Park').line, /charge: £1\.80\/hour/);
  assert.match(items.find((i) => i.name === 'Mailbox Multi-storey').line, /multi-storey · 600 spaces · a fee on the map · 12 disabled bays · hours 24\/7/);
  assert.ok(items.some((i) => i.name === 'Car park' || /car park/i.test(i.name)), 'an unnamed one is still a car park');
});

test('toilets, cash, drinking water and what is open, from the map’s tags (Sunday noon)', () => {
  const home = { lat: 52.4778, lon: -1.8985 };
  const wc = S.toiletItems(S.parseOverpass(OV.toilets, home), 0, 720);
  assert.equal(wc[0].name, 'New Street Station toilets');
  assert.match(wc[0].line, /a fee 30p|fee 30p/);
  assert.match(wc[0].line, /step-free/);
  assert.match(wc[0].line, /open until 24:00/);
  assert.match(wc.find((x) => x.name === 'Public toilets').line, /free · not step-free · open until 17:00/);
  assert.match(S.toiletItems(S.parseOverpass(OV.toilets, home), 0, 17 * 60 + 30).find((x) => x.name === 'Public toilets').line, /closed, opens tomorrow 08:00/);
  assert.equal(wc.at(-1).name, 'Café customers', 'for customers: last');
  const cash = S.cashItems(S.parseOverpass(OV.atm, home));
  assert.match(cash.find((x) => /Cashzone|ATM|Cash machine/.test(x.name + x.line)).line, /may charge a fee · inside a building: check its hours/);
  const water = S.refillItems(S.parseOverpass(OV.water, home));
  assert.match(water[0].line, /fills a bottle/);
  assert.match(water[1].line, /seasonal: may be off in winter/);
  const open = S.openItems(S.parseOverpass(OV.open, home), 0, 720);
  assert.deepEqual(open.items.map((i) => i.name).sort(), ['Boots', 'The Crown']);
  assert.equal(open.unread, 1, 'the sunrise-to-sunset one is not read');
  assert.equal(open.closed, 2, 'Early Bird (Mo-Fr) and Night Noodles (from 17:00) are shut');
  assert.match(open.items.find((i) => i.name === 'Boots').line, /open until 17:00/);
  assert.match(S.openItems(S.parseOverpass(OV.open, home), 0, 17 * 60 - 20).items.find((i) => i.name === 'Boots').line, /closing in 20 min/);
});

test('near a saved place: a car park list from one question, kept for the day; a tap’s position is never kept; the map down says so plainly', async () => {
  const storage = withPlaces();
  const seen = [];
  const out = await run(storage, 'parking', { near: 'home' }, NOW, net({}, seen));
  assert.match(out.text, /^Car parks near Home, free and cheap first:\n1\. Cannon Street Free Parking — /);
  assert.match(out.text, /\(2 private or permit-only ones left out\.\)/);
  assert.match(out.text, /Prices and rules are the sign’s, not ours/);
  assert.equal(seen.length, 1, 'one question to the shared server');
  assert.equal(out.cards[0].id, 'outside:near:parking');
  await run(storage, 'parking', { near: 'home' }, NOW + 3600_000, net({}, seen));
  assert.equal(seen.length, 1, 'the same question the same day is not asked again');
  await run(storage, 'parking', { near: 'home' }, NOW + 25 * 3600_000, net({}, seen));
  assert.equal(seen.length, 2, 'the next day it is');
  // a tapped position: used for the question, kept nowhere (not in any value the brain stored)
  const seen2 = [];
  const tapStore = new Mem();
  await run(tapStore, 'toilets', { lat: 52.48123, lon: -1.90345 }, NOW, net({}, seen2));
  await run(tapStore, 'toilets', { lat: 52.48123, lon: -1.90345 }, NOW, net({}, seen2));
  assert.equal(seen2.length, 2, 'asked again each time, never cached');
  assert.ok(!JSON.stringify([...tapStore.m]).includes('52.4812') && !JSON.stringify([...tapStore.m]).includes('-1.9034'), 'the position is nowhere in his storage');
  // the servers refuse: the plain line, nothing made up
  const down = await run(storage, 'cash', { near: 'work' }, NOW, fakeFetch({}));
  assert.match(down.text, /^I can’t reach the map right now/);
  assert.ok(!/Barclays|Cashzone/.test(down.text));
  // no place and no tap: the line about not tracking, and the sheet to open
  const none = await run(storage, 'toilets', {});
  assert.match(none.text, /^I don’t track where you are\./);
  assert.deepEqual(none.open, { name: 'open_outside', args: { what: 'toilets' } });
  // “home” is not saved yet: how to save it, not a guess
  assert.match((await run(new Mem(), 'toilets', { near: 'home' })).text, /yet|save|remember/i);
});

test('what is open: read in his time, the unreadable counted, bank holidays warned', async () => {
  const out = await run(withPlaces(), 'open', { near: 'home', what: 'anything' });
  assert.match(out.text, /^Open now near Home:\n1\. /);
  assert.match(out.text, /Boots/);
  assert.match(out.text, /1 more have hours I can’t read\. 2 are closed now\./);
  assert.match(out.text, /bank holidays can differ/);
});

test('which carriage: only what he told it, every time; with no note it says so and never guesses a length', async () => {
  const storage = new Mem();
  assert.match((await run(storage, 'carriage', { place: 'New Street' })).text, /^You haven’t told me which carriage suits New Street\./);
  const kept = await run(storage, 'note', { words: 'at New Street the front carriages are nearest the exit I use' });
  assert.match(kept.text, /^Kept for New Street: “the front carriages are nearest the exit I use”\./);
  for (const q of ['New Street', 'new street', 'Birmingham New Street']) {
    const said = await run(storage, 'carriage', { place: q });
    assert.match(said.text, /^At New Street: the front carriages are nearest the exit I use \(your note\)\./, q);
    assert.match(said.text, /National Rail’s formation data .* never guess a carriage or a length/);
  }
  assert.match((await run(storage, 'carriage', { place: 'Snow Hill' })).text, /haven’t told me which carriage suits Snow Hill/);
  assert.match((await run(storage, 'carriage', {})).text, /Your carriage notes:\n- New Street: /);
  // a note about parking is not a carriage note
  await run(storage, 'note', { words: 'Cannon Hill car park: card only, free after 6' });
  assert.match((await run(storage, 'carriage', {})).text, /^Your carriage notes:\n- New Street/);
  assert.doesNotMatch((await run(storage, 'carriage', {})).text, /Cannon Hill/);
  assert.match((await run(storage, 'note', { words: 'something' })).text, /^Which place, and what should I remember\?/);
  // notes can be forgotten: a place's, or all
  assert.match((await run(storage, 'note', { words: 'forget my notes about Snow Hill' })).text, /^I have no note about Snow Hill\. Say “forget all my notes”/);
  assert.match((await run(storage, 'note', { words: 'forget my notes about New Street' })).text, /^Forgot 1 note about New Street\./);
  assert.match((await run(storage, 'carriage', {})).text, /^You haven’t told me any yet\./, 'the carriage note is gone, the parking one stays');
  assert.equal((await storage.get('outside:notes')).length, 1);
  assert.match((await run(storage, 'note', { words: 'forget all my notes' })).text, /^Forgot 1 note\./);
  assert.match((await run(storage, 'note', { words: 'forget all my notes' })).text, /^You haven’t told me any notes about places\./);
  const withNote = await run(storage, 'parking', { near: 'Cannon Hill' }, NOW, net({ 'https://nominatim.openstreetmap.org': [] }));
  assert.ok(typeof withNote.text === 'string');
});

test('a walk against police reports: the real route and three real months — counts, the busiest stretch, a way round, “fewer reports”, never “safe”', async () => {
  const crimes = Object.values(CRIMES).flatMap((m) => S.parseCrimes(m));
  assert.equal(crimes.length, 54);
  const paths = ROUTE.routes.map((r) => r.geometry.coordinates.map(([lo, la]) => [la, lo]));
  const a = S.scoreRoute(paths[0], crimes);
  const b = S.scoreRoute(paths[1], crimes);
  assert.deepEqual([a.reports, Math.round(a.perKm), a.top[0]], [39, 20, ['violent-crime', 19]]);
  assert.deepEqual([b.reports, Math.round(b.perKm), b.top[0]], [50, 24, ['violent-crime', 21]]);
  assert.ok(a.weighted < b.weighted, 'the first way has fewer reports (weighted)');
  assert.equal(a.worst.from, 0, 'the busiest 150 m is by the station, at the start');
  assert.ok(a.worst.reports >= 20 && a.worst.streets.includes('New Street'), JSON.stringify(a.worst));
  assert.ok(S.isDodgy(a) && S.isDodgy(b));
  assert.equal(S.isDodgy(S.scoreRoute(paths[0], [])), false, 'no reports, nothing to steer round');
  // two points to steer through, 230 m either side, the quieter side first
  const via = S.viaOptions(paths[0], a, crimes);
  assert.equal(via.length, 2);
  for (const v of via) assert.ok(Math.abs(S.metresBetween(v, a.worst.at) - 230) < 5, `${S.metresBetween(v, a.worst.at)}`);
  const around = (p) => crimes.filter((c) => S.metresBetween(p, c) <= 160).length;
  assert.ok(around(via[0]) <= around(via[1]));
  // beyond 100 m a report does not count; the same reports far away count nothing
  const far = crimes.map((c) => ({ ...c, lat: c.lat + 0.01 }));
  assert.equal(S.scoreRoute(paths[0], far).reports, 0);
  // months, and the area asked for
  assert.deepEqual(S.crimeMonths('2026-08-01'), ['2026-08', '2026-07', '2026-06']);
  assert.deepEqual(S.crimeMonths('2026-01-15'), ['2026-01', '2025-12', '2025-11']);
  const poly = S.polyAround(paths).split(':');
  assert.equal(poly.length, 4);
  assert.ok(poly.every((p) => /^52\.\d{5},-1\.\d{5}$/.test(p)));
});

test('safewalk: home to work with fixtures — two ways with their counts, the router asked again for a way round, asked once for the day', async () => {
  const storage = withPlaces();
  const seen = [];
  const out = await run(storage, 'safewalk', { from: 'home', to: 'work' }, NOW, net({}, seen));
  assert.match(out.text, /^Walking Home to Work\. Reports to the police within 100 m of each way, Jun–Aug 2026 \(data\.police\.uk\):\n1\. The usual way: 2 km, about 27 min · 39 reports \(20 a km\), mostly violence and sexual offences/);
  assert.match(out.text, /2\. Another way: 2\.1 km, about 29 min · 50 reports \(24 a km\)/);
  assert.match(out.text, /Busiest stretch: near New Street/);
  assert.match(out.text, /I couldn’t find a way with clearly fewer reports than the usual one\./);
  assert.match(out.text, /Fewer reports is not “safe”, and more is not “dangerous”/);
  assert.match(out.text, /WALK ME HOME will watch your walk/);
  assert.doesNotMatch(out.text, /\bis safe\b|\bsafest\b|\bsafer route\b/i);
  assert.equal(seen.filter((u) => u.includes('routed-foot')).length, 2, 'the walking router: the alternatives, then one way round the busiest stretch');
  assert.equal(seen.filter((u) => u.includes('crimes-street')).length, 3, 'one police question a month');
  assert.equal(out.data.best, 0);
  assert.ok(out.data.routes.every((r) => r.path.length <= 70));
  assert.equal(out.cards[0].title, 'Walk: fewer reports');
  const before = seen.length;
  await run(storage, 'safewalk', { from: 'home', to: 'work' }, NOW + 3600_000, net({}, seen));
  assert.equal(seen.length, before, 'kept for the day: no new question');
  // the other order: the usual way is the busier one, so the quieter alternative is named
  const swapped = { code: 'Ok', routes: [ROUTE.routes[1], ROUTE.routes[0]] };
  const out2 = await run(withPlaces(), 'safewalk', { from: 'home', to: 'work' }, NOW, net({ 'https://routing.openstreetmap.de/routed-foot/route/v1/driving/': swapped }));
  assert.match(out2.text, /Way 2 has \d+% fewer reports \(weighted by kind\) than the usual way, and is \d+ min shorter\./);
  assert.equal(out2.data.best, 1);
});

test('safewalk: the honest failures — too far, no start, the police data or the router down — and nothing made up', async () => {
  const storage = withPlaces();
  const farStore = new Mem();
  farStore.m.set('places', [HOME, { ...WORK, lat: 52.6, lon: -1.9 }]);
  assert.match((await run(farStore, 'safewalk', { from: 'home', to: 'work' })).text, /^That is [\d.]+ km as the crow flies — further than I score on foot/);
  const noStart = await run(storage, 'safewalk', { to: 'work' });
  assert.match(noStart.text, /^Where are you setting off from\? I don’t track where you are/);
  assert.deepEqual(noStart.open, { name: 'open_outside', args: { what: 'safewalk' } });
  const police = await run(withPlaces(), 'safewalk', { from: 'home', to: 'work' }, NOW, net({ 'https://data.police.uk/api/crime-last-updated': () => { throw new Error('x'); } }));
  assert.match(police.text, /^The police data \(data\.police\.uk\) isn’t answering/);
  const router = await run(withPlaces(), 'safewalk', { from: 'home', to: 'work' }, NOW, fakeFetch({ 'https://data.police.uk': [] }));
  assert.match(router.text, /^I can’t reach the map right now/);
  const tooMany = await run(withPlaces(), 'safewalk', { from: 'home', to: 'work' }, NOW, (u) => (String(u).includes('crimes-street') ? Promise.resolve(new Response('busy', { status: 503 })) : net()(u)));
  assert.match(tooMany.text, /^There are too many reports in that area/);
  // a tap is the start: used once, nothing of it in his storage
  const tapStore = withPlaces();
  const tapped = await run(tapStore, 'safewalk', { lat: 52.47801, lon: -1.89851, to: 'work' });
  assert.match(tapped.text, /^Walking where you are now to Work\./);
  assert.ok(![...tapStore.m.keys()].some((k) => k.startsWith('outside:c:')), 'nothing cached from a tapped start');
});

test('the last way home: asked of the open journey planner for the late services, the latest one named, with the honest line', async () => {
  const storage = withPlaces();
  const before = Date.UTC(2026, 9, 16, 20, 0);
  const plan = (u) => (String(u).includes('/plan') ? TRANSITOUS.plan : { itineraries: [] });
  const out = await asGlobal({ 'https://api.transitous.org/api/v1/plan': plan }, () => run(storage, 'lasthome', { from: '52.4777,-1.8990', to: 'home' }, before));
  assert.match(out.text, /^The last way I can find from 52\.4777, -1\.8990 to Home: leave 10:27, home by 10:47\./);
  assert.match(out.text, /timetable plus the operators’ live feed/);
  assert.match(out.text, /look at the operator’s own app before you rely on it\./);
  assert.equal(out.cards[0].title, 'Last way home');
  assert.match((await run(storage, 'lasthome', { to: 'home' })).text, /^Where are you setting off from\?/);
  const none = await asGlobal({ 'https://api.transitous.org/api/v1/plan': { itineraries: [] } }, () => run(storage, 'lasthome', { from: '52.4777,-1.8990', to: 'home' }, before));
  assert.match(none.text, /^I can’t find a bus, tram or train from /);
  assert.match((await run(new Mem(), 'lasthome', { from: '52.4777,-1.8990' })).text, /yet|save|remember|home/i);
});

test('the rain plan and a bag: a coat with the hour from the hourly forecast; dry says so; a forecast that does not answer is not guessed', async () => {
  const t0 = Date.UTC(2026, 10, 1, 0, 0) / 1000;
  const hourly = (wet) => ({ hourly: { time: Array.from({ length: 48 }, (_, i) => t0 + i * 3600), precipitation_probability: Array.from({ length: 48 }, (_, i) => (wet.includes(i % 24) ? 80 : 10)), precipitation: Array.from({ length: 48 }, (_, i) => (wet.includes(i % 24) ? 1.2 : 0)), temperature_2m: Array.from({ length: 48 }, () => 9) } });
  const f = (wet) => net({ 'https://api.open-meteo.com/v1/forecast': hourly(wet) });
  const wet = await run(withPlaces(), 'rain', {}, NOW, f([15, 16, 17]));
  assert.match(wet.text, /^Home: Rain is likely from 15:00 to about 18:00 \(up to 80% about 15:00\): take a coat and an umbrella\. A forecast, not a promise\. About 9°C over those hours\.$/);
  assert.deepEqual([wet.cards[0].title, wet.cards[0].brief.icon], ['Take a coat', 'rain']);
  const dry = await run(withPlaces(), 'rain', {}, NOW, f([]));
  assert.match(dry.text, /^Home: No rain likely for the next 14 hours/);
  assert.equal(dry.cards[0].title, 'No coat needed');
  assert.match((await run(withPlaces(), 'rain', {}, NOW, fakeFetch({}))).text, /^I couldn’t get the forecast for Home just now/);
  assert.match((await run(new Mem(), 'rain', {})).text, /^I don't know where home is yet/);
  // a bag: the plan, then the weather
  const bag = await run(withPlaces(), 'pack', { plan: 'the gym and then work' }, NOW, f([15, 16]));
  assert.match(bag.text, /^For “the gym and then work”:\n- phone and charger/);
  for (const item of ['gym kit', 'laptop and charger', 'an umbrella', 'a jumper or fleece']) assert.ok(bag.data.items.includes(item), item);
  assert.match(bag.text, /Weather I used: 80% chance of rain, likeliest about 15:00, about 9°C\./);
  assert.match((await run(withPlaces(), 'pack', { plan: 'a day at the beach' }, NOW, fakeFetch({}))).text, /I didn’t check the weather/);
  assert.match((await run(withPlaces(), 'pack', {})).text, /^What is the day\?/);
  assert.deepEqual(S.bagFor('a flight', { rain: null, temp: 25 }).items.slice(0, 2), ['phone and charger', 'keys']);
  assert.ok(S.bagFor('a walk', { rain: null, temp: 2 }).items.includes('gloves'));
});

test('a fare split to the penny: one payer, several, the odd pennies said, nothing paid or sent', () => {
  const one = S.splitFare(S.parseSplit('taxi £48, I paid, between me, Sam and Jo'));
  assert.deepEqual([one.total, one.each, one.names], [48, 16, ['You', 'Sam', 'Jo']]);
  assert.deepEqual(one.owes.map((x) => `${x.from}>${x.to} ${x.amount}`), ['Sam>You 16', 'Jo>You 16']);
  assert.equal(S.splitWords(one), '£48 between 3: £16 each. Sam owes you £16; Jo owes you £16.');
  const two = S.splitFare(S.parseSplit('I paid £30, Sam paid £12, split 3 ways'));
  assert.equal(two.total, 42);
  assert.deepEqual(two.owes.map((x) => `${x.from}>${x.to} ${x.amount}`), ['Person 3>You 14', 'Sam>You 2'], 'the third pays 14, and Sam’s 12 is 2 short of the 14 share');
  const odd = S.splitFare(S.parseSplit('dinner £100, Sam paid, between Sam, Jo and Dee'));
  assert.equal(odd.each, 33.33);
  assert.match(odd.oddPenny, /^1p over: put on Jo$/);
  assert.equal(odd.owes.reduce((s, x) => s + x.amount, 0).toFixed(2), '66.67');
  assert.match(S.splitWords(S.splitFare(S.parseSplit('£12 between 4'))), /^£12 between 4: £3 each\. \(No one said who paid, so no one owes anyone\.\)$/);
  assert.equal(S.splitFare(S.parseSplit('hello')), null);
  assert.equal(S.splitFare(S.parseSplit('£20 paid by me')), null, 'no one to split with');
});

test('split, via the tool: the words in, who owes whom out', async () => {
  const out = await run(new Mem(), 'split', { words: 'taxi £48, I paid, between me, Sam and Jo' });
  assert.match(out.text, /^£48 between 3: £16 each\. Sam owes you £16; Jo owes you £16\.$/);
  assert.match((await run(new Mem(), 'split', { words: 'taxi' })).text, /^I need the total and who shares it\./);
  const typed = await run(new Mem(), 'split', { total: 90, people: ['You', 'Ali', 'Bo'], words: 'Ali paid' });
  assert.match(typed.text, /^£90 between 3: £30 each\. You owe Ali £30; Bo owes Ali £30\.$/);
});

test('halfway by travel time: the route’s own timings, the time midpoint is not the distance midpoint, places near it, the route drawn', async () => {
  // a route that is quick for its first half of the distance and slow for the second: half the TIME is well before half the distance
  const path = [[52.0, -1.0], [52.1, -1.0], [52.2, -1.0], [52.3, -1.0]];
  const even = S.midpointByTime(path);
  assert.ok(Math.abs(even.at.lat - 52.15) < 0.001, 'no timings: a steady pace by distance');
  const timed = S.midpointByTime(path, [100, 100, 800]);
  assert.ok(timed.at.lat > 52.2 && timed.at.lat < 52.3, `${timed.at.lat}: half the time (500 s of 1,000) is in the slow last leg`);
  const car = { code: 'Ok', routes: [{ distance: 30000, duration: 1800, geometry: { coordinates: [[-1.9, 52.0], [-1.9, 52.1], [-1.9, 52.2]] }, legs: [{ annotation: { duration: [900, 900] }, steps: [] }] }] };
  const out = await run(withPlaces(), 'halfway', { from: 'home', with: 'work' }, NOW, net({ 'https://routing.openstreetmap.de/routed-car/route/v1/driving/': car }));
  assert.match(out.text, /^Halfway by driving time between Home and Work: about 15 min from each \(30\.0 km, 30 min door to door, without traffic\)\./);
  assert.match(out.text, /Places to meet within 500 m of the middle: /);
  assert.match(out.text, /An estimate: it takes the route's own timings/);
  assert.equal(out.open.name, 'show_route');
  assert.deepEqual([out.open.args.from, out.open.args.to, out.open.args.mode], ['Home', 'Work', 'driving']);
  assert.match((await run(withPlaces(), 'halfway', { from: 'home' })).text, /^Which two places\?/);
});

test('lost: the nearest saved place, the nearest station and the way, from a tap (or a name); the spot is not kept', async () => {
  const route = { code: 'Ok', routes: [{ distance: 900, duration: 700, geometry: { coordinates: [[-1.9, 52.48], [-1.8985, 52.4778]] }, legs: [{ steps: [{ distance: 300, name: 'Cannon Street', maneuver: { type: 'depart' } }, { distance: 600, name: 'New Street', maneuver: { type: 'turn', modifier: 'left' } }] }] }] };
  const storage = withPlaces();
  const out = await run(storage, 'lost', { lat: 52.4801, lon: -1.9003 }, NOW, net({ 'https://routing.openstreetmap.de/routed-foot/route/v1/driving/': route }));
  assert.match(out.text, /^Nearest place you saved: Home, \d+ m (south|south-east|east) /);
  assert.match(out.text, /Nearest station: Birmingham New Street, /);
  assert.match(out.text, /The way to Home on foot: 0\.9 km, about 12 min\.\n1\. Head off along Cannon Street \(300 m\)\n2\. Turn left onto New Street \(600 m\)/);
  assert.match(out.text, /I’m not tracking you\. If you feel unsafe, call 999\./);
  assert.equal(out.open.name, 'show_route');
  assert.ok(!JSON.stringify([...storage.m]).includes('52.4801'), 'the spot is not kept');
  assert.match((await run(storage, 'lost', {})).text, /^I don’t track where you are\./);
  assert.deepEqual((await run(storage, 'lost', {})).open, { name: 'open_outside', args: { what: 'lost' } });
});

test('where I parked: kept with the street, the rule and the ticket (a reminder 15 minutes before), asked for later, forgotten', async () => {
  const storage = withPlaces();
  const out = await run(storage, 'parked', { words: 'I parked on Cannon Street until 3pm, free after 6' });
  assert.match(out.text, /^Kept: the car is at Cannon Street, parked 12:00\. Note: free after 6\. Paid until 15:00\. I’ll remind you 15 minutes before/);
  assert.equal(out.cards[0].title, 'Where I parked');
  assert.equal(out.cards[0].brief.icon, 'car');
  const jobs = (await J.loadJobs(storage)).filter((j) => j.kind === 'reminder');
  assert.deepEqual(jobs.map((j) => [j.title, new Date(j.next).toISOString()]), [['Parking runs out', '2026-11-01T14:45:00.000Z']]);
  assert.match((await run(storage, 'parked', {}, NOW + 3600_000)).text, /^The car: Cannon Street, parked 1 hour ago\. Your note: free after 6\. Paid until 15:00\.$/);
  // asked with the spot he is at (a tap): how far and which way, from the spot he kept
  const withSpot = await run(storage, 'parked', { place: 'home', note: 'back door' }, NOW + 7200_000);
  assert.match(withSpot.text, /the car is at home, parked 14:00\. Note: back door/);
  const where = await run(storage, 'parked', { lat: 52.4801, lon: -1.9003, ask: true }, NOW + 7300_000);
  assert.match(where.text, /From the spot you gave me it is about \d+ m (south|south-east|east)/);
  assert.equal((await J.loadJobs(storage)).filter((j) => j.title === 'Parking runs out').length, 0, 'the new spot has no ticket, so the old reminder went');
  // a new ticket replaces the old reminder
  await run(storage, 'parked', { words: 'I parked on Bull Street for 2 hours' });
  await run(storage, 'parked', { words: 'I parked on Bull Street for 2 hours' });
  assert.equal((await J.loadJobs(storage)).filter((j) => j.title === 'Parking runs out').length, 1);
  assert.deepEqual(await P.packLines({ storage, now: () => NOW + 1.6 * 3600_000 }), ['Parking at Bull Street runs out at 14:00']);
  assert.deepEqual(await P.packLines({ storage, now: () => NOW + 4 * 3600_000 }), [], 'after it ran out, nothing');
  assert.match((await run(storage, 'parked', { words: 'forget' })).text, /^Forgot where the car is\./);
  assert.match((await run(storage, 'parked', {})).text, /^I don’t know where the car is/);
  // “I parked” with no place: asks, and opens the sheet; a tap alone keeps the spot he tapped
  const ask = await run(new Mem(), 'parked', { words: 'I parked here' });
  assert.match(ask.text, /^Where\? Tell me the street or the car park/);
  assert.deepEqual(ask.open, { name: 'open_outside', args: { what: 'car' } });
  const tapStore = new Mem();
  assert.match((await run(tapStore, 'parked', { lat: 52.4801, lon: -1.9003 })).text, /the car is at where you tapped/);
  assert.equal((await tapStore.get('outside:parked')).lat, 52.4801, 'the one exception: the spot he asked it to keep');
});

test('a queue from his own notes only: logged with the day and hour, the estimate by this kind of day and hour, no guess without notes', async () => {
  const storage = new Mem();
  assert.match((await run(storage, 'queue', {})).text, /^I have no queue notes yet\./);
  assert.match((await run(storage, 'queue', { words: 'is the queue at the post office worth it?' })).text, /^I have no notes about the queue at post office, so I won’t guess\./);
  const sat = Date.UTC(2026, 10, 7, 10, 0);
  let last;
  // a Saturday 10:00 twice, a Sunday noon, a Tuesday 17:00
  for (const [at, m] of [[sat, 25], [sat + 7 * 86_400_000, 15], [NOW, 5], [Date.UTC(2026, 10, 3, 17, 0), 40]]) last = await run(storage, 'queue', { words: `the queue at the post office was ${m} minutes` }, at);
  assert.equal(last.text, 'Kept: the queue at post office was 40 minutes (4 notes for it now). I only ever use your own notes.');
  // a Saturday morning: the weekend notes within two hours of now (25, 15 and Sunday’s 5)
  assert.match((await run(storage, 'queue', { words: 'queue at the post office' }, Date.UTC(2026, 10, 14, 10, 30))).text, /^From your 3 notes about post office at about this time of day: 5–25 minutes, middle 15\. Go if you can spare about 25\. An estimate from your own notes only/);
  // a Wednesday evening: only one note is near it, so all four are used, and it says it is any time
  assert.match((await run(storage, 'queue', { words: 'queue at the post office' }, Date.UTC(2026, 10, 4, 17, 30))).text, /^From your 4 notes about post office: 5–40 minutes, middle 20\. Go if you can spare about 40\./);
  assert.match((await run(storage, 'queue', { words: 'is the queue at the bank ok' })).text, /no notes about the queue at bank ok/);
  // queue notes can be forgotten: a place's, or all
  await run(storage, 'queue', { words: 'the queue at the bank was 10 minutes' });
  assert.match((await run(storage, 'queue', { words: 'forget my queue notes for the cinema' })).text, /^I have no queue notes for cinema\./);
  assert.match((await run(storage, 'queue', { words: 'forget my queue notes for the post office' })).text, /^Forgot 4 queue notes for post office\./);
  assert.match((await run(storage, 'queue', { words: 'forget all my queue notes' })).text, /^Forgot 1 queue note\./);
  assert.match((await run(storage, 'queue', { words: 'forget all my queue notes' })).text, /^I have no queue notes to forget\./);
  assert.deepEqual(S.parseWait('the queue at Tesco was half an hour'), { place: 'Tesco', minutes: 30 });
  assert.equal(S.parseWait('nothing here'), null);
  assert.equal(S.queueEstimate([], 'x', 1, 9), null);
});

test('his words: notes, tickets, a car park, “where did I park”, the phone’s own phrases', () => {
  assert.deepEqual(S.parseNote('at New Street the front carriages are nearest the exit I use', ''), { place: 'New Street', text: 'the front carriages are nearest the exit I use', kind: 'carriage' });
  assert.deepEqual(S.parseNote('Cannon Hill car park: card only, free after 6', ''), { place: 'Cannon Hill car park', text: 'card only, free after 6', kind: 'parking' });
  assert.deepEqual(S.parseNote('the lift is on the left', 'Snow Hill'), { place: 'Snow Hill', text: 'the lift is on the left', kind: 'carriage' });
  assert.equal(S.parseNote('hello', ''), null);
  assert.deepEqual(S.parseTicket('until 3pm'), { hm: '15:00' });
  assert.deepEqual(S.parseTicket('till 15:30'), { hm: '15:30' });
  assert.deepEqual(S.parseTicket('for 2 hours'), { forMinutes: 120 });
  assert.deepEqual(S.parseTicket('for half an hour'), { forMinutes: 30 });
  assert.deepEqual(S.parseTicket('on the street'), {});
  assert.deepEqual(S.parseParked('I parked on Cannon Street until 3pm, free after 6'), { place: 'Cannon Street', note: 'free after 6', ticket: { hm: '15:00' } });
  assert.equal(S.parseParked('I parked here').place, '');
  assert.equal(S.agoWords(30_000), 'just now');
  assert.equal(S.agoWords(3 * 3600_000), '3 hours ago');
  const asked = {
    'where did I park?': 'car', 'Where’s the car?': 'car', "where's the car": 'car', 'I parked here': 'parkedhere', 'I parked on Cannon Street': 'parkedhere', "I'm lost": 'lost',
    'toilets near me': 'toilets', 'nearest cash machine': 'cash', 'free water refill': 'refill', 'car parks near the Bullring': 'parking', "what's open now": 'open', 'a safer walk home': 'safewalk',
    'hello': null, 'where are my keys': null, 'park the idea': null,
  };
  for (const [t, v] of Object.entries(asked)) assert.equal(S.outsideAsked(t), v, t);
  assert.equal(S.compass({ lat: 52, lon: 0 }, { lat: 52.1, lon: 0 }), 'north');
  assert.equal(S.compass({ lat: 52, lon: 0 }, { lat: 51.9, lon: -0.1 }), 'south-west');
});

test('the group is on by his words about a day out, off for small talk; one tool with the sixteen actions; reads for jobs, writes wait for him', async () => {
  const I = await bundles(['src/tools/index.ts']);
  const g = I['src/tools/index.ts'].TOOL_GROUPS.find((x) => x.name === 'outside');
  assert.equal(g.short, 'outside pack');
  assert.deepEqual(Object.keys(T.OUTSIDE), ['note', 'carriage', 'parking', 'safewalk', 'lasthome', 'open', 'toilets', 'cash', 'refill', 'rain', 'split', 'halfway', 'pack', 'parked', 'lost', 'queue']);
  for (const t of ['which carriage at new street', 'car parks near the bullring', 'a safer walk home', 'last train home', 'toilets near the station', 'where did i park the car', 'split the taxi fare', 'will it rain this afternoon', "i'm lost", 'what is open now']) assert.ok(g.when.test(t), t);
  for (const t of ['hello', 'what time is it', 'how are you', 'thanks', 'tell me a joke']) assert.ok(!g.when.test(t), t);
  const tool = T.outsideTools[0];
  assert.equal(tool.name, 'outside');
  // a scheduled task or a project step may read, never write
  const { ctx } = ctxOf(new Mem());
  ctx.unattended = true;
  for (const w of ['note', 'parked', 'queue']) await assert.rejects(tool.run({ action: w, words: 'x' }, ctx), /waits for him/, w);
  assert.equal(tool.pure({ action: 'rain' }), true);
  assert.equal(tool.pure({ action: 'parked' }), false);
  assert.match(await tool.run({ action: 'split', words: 'taxi £48, I paid, between me, Sam and Jo' }, ctx), /^£48 between 3/);
  // the cards go to the chat as pack_card commands, built by code
  const live = ctxOf(new Mem());
  await tool.run({ action: 'parked', words: 'I parked on Bull Street' }, live.ctx);
  assert.equal(live.events.find((e) => e.name === 'pack_card').args.card.id, 'outside:car');
  const cards = C.cardsFromTool({ name: 'outside', args: {}, result: '', shown: live.events.map((e) => ({ name: e.name, args: e.args })) });
  assert.equal(cards[0].title, 'Where I parked');
});

test('the phone’s buttons run an action with no model: POST /packs/do', async () => {
  const storage = new Mem();
  const r = await P.packsRoute(new Request('http://x/packs/do', { method: 'POST', body: JSON.stringify({ pack: 'outside', action: 'split', args: { words: 'taxi £48, I paid, between me, Sam and Jo' } }) }), '/packs/do', 'POST', { storage, notify: async () => undefined, fetch: net(), now: () => NOW });
  assert.equal(r.status, 200);
  assert.match((await r.json()).text, /^£48 between 3/);
  const bad = await P.packsRoute(new Request('http://x/packs/do', { method: 'POST', body: JSON.stringify({ pack: 'outside', action: 'nope', args: {} }) }), '/packs/do', 'POST', { storage, notify: async () => undefined });
  assert.equal(bad.status, 400);
});
