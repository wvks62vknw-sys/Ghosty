// THE GUARDIAN'S WATCH (guardian.ts, integrations/warnings.ts, guardstate.ts; OWNER-ISSUES 55, 58), with recorded answers
// of every public source (guardian.fixture.json: never the live feeds):
//  - the feeds read as published: the Environment Agency's flood alerts, the Met Office's regional warnings matched to a
//    place's council (and their end honoured), the month's street crime as a count, the place's area from postcodes.io;
//  - the watch: a NEW warning near a place → one notification and a line in the day log and the one mind, never the same
//    warning twice, the all-clear once when it lifts, a failed feed never an all-clear, crime never announced;
//  - the tool group: on by its words only, never always (the plain turn only names it); WATCH on the abilities screen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FX, G, guardian, M, MIN, NOW, W, web } from './guardian-kit.mjs';

const T = await import('./.build/tools/index.mjs');
const A = await import('./.build/abilities.mjs');

test('the Environment Agency: alerts and warnings in force, a lifted one left out, times as UK time', () => {
  const list = W.parseFloods(FX.ea_alert);
  assert.equal(list.length, 1, 'the "no longer in force" item is a lifted one');
  assert.deepEqual({ ...list[0], since: new Date(list[0].since).toISOString() }, {
    id: 'ea:034WAF412',
    feed: 'flood',
    title: 'Flood alert: River Cole at Kings Heath and Moseley',
    level: 3,
    since: '2026-10-31T14:05:00.000Z',
    detail: 'River Cole, Birmingham',
    link: 'https://check-for-flooding.service.gov.uk/target-area/034WAF412',
  });
  assert.equal(W.parseFloods(FX.ea_warning)[0].level, 2);
  assert.deepEqual(W.parseFloods({}), []);
  // summer time: 14:05 in July is 13:05 UTC
  assert.equal(new Date(W.ukTime('2026-07-01T14:05:00')).toISOString(), '2026-07-01T13:05:00.000Z');
});

test('the Met Office: a region\'s warnings with the councils they name, matched to a place, and over when they end', () => {
  const list = W.parseMetRss(FX.met_wm, NOW);
  assert.deepEqual(list.map((w) => w.title), ['Yellow warning of wind'], 'the fog warning ended at 10:00 and is gone');
  const wind = list[0];
  assert.equal(wind.id, 'mo:7a1c2b3d-1111-4c2e-9d0e-5f6a7b8c9d0e');
  assert.equal(wind.level, 3);
  assert.equal(new Date(wind.since).toISOString(), '2026-10-31T15:00:00.000Z');
  assert.equal(new Date(wind.until).toISOString(), '2026-10-31T23:59:00.000Z');
  assert.ok(wind.areas.includes('Birmingham') && wind.areas.includes('Warwickshire'));
  assert.ok(!/referrer=rss/.test(wind.link));
  const early = W.parseMetRss(FX.met_wm, Date.UTC(2026, 9, 31, 6));
  assert.deepEqual(early.map((w) => w.title), ['Yellow warning of fog', 'Yellow warning of wind']);
  const area = W.parseArea(FX.postcode_b13);
  assert.deepEqual(area, { code: 'wm', region: 'West Midlands', district: 'Birmingham', county: '', country: 'England' });
  assert.ok(W.touches(wind, area), 'the wind warning names Birmingham');
  assert.ok(!W.touches(early[0], area), 'the fog warning names only Shropshire and Staffordshire');
  assert.equal(W.metCode('Wales', '', 'Cardiff'), 'wl');
  assert.equal(W.metCode('Scotland', '', 'Glasgow City'), 'st');
  assert.equal(W.metCode('Scotland', '', 'City of Edinburgh'), 'dg');
  assert.equal(W.metCode('England', 'London', 'Camden'), 'se');
  const amber = W.parseMetRss(FX.met_wm_amber, NOW);
  assert.equal(amber[0].title, 'Amber warning of rain', 'worst first');
  assert.equal(new Date(amber[0].until).toISOString(), '2026-11-01T06:00:00.000Z', 'into the next month');
});

test('street crime: the month\'s public count and its categories, nothing about anyone and no streets', () => {
  const c = W.crimeOf(FX.police_b13);
  assert.deepEqual(c, { month: '2026-08', total: 5, top: [['anti-social behaviour', 2], ['violence and sexual offences', 1], ['vehicle crime', 1], ['burglary', 1]] });
  assert.ok(!JSON.stringify(c).includes('Alcester'), 'no street names');
});

test('the watch: a new warning near home is told once, kept in the day log and the one mind; the all-clear once; a failed feed is never an all-clear', async () => {
  const g = guardian();
  web.feeds = { ea: 'ea_alert', met: 'met_wm', police: 'police_b13' };
  const first = await G.watchTick(g.d);
  // (worst first, then the newest)
  assert.deepEqual(first.news, ['Yellow warning of wind near Home (Met Office, since 15:00, until 23:59)', 'Flood alert near Home: River Cole at Kings Heath and Moseley (Environment Agency, since 14:05)']);
  assert.equal(g.out.notes.length, 1, 'one notification for the look');
  assert.deepEqual(g.out.notes[0], { kind: 'error', title: '2 warnings near your places', text: first.news.join('\n') });
  const log = await M.loadLog(g.storage);
  assert.ok(log.some((e) => e.kind === 'place' && /Flood alert near Home/.test(e.text) && e.via === 'guardian'), 'in the day log');
  const mind = await G.guardianMind(g.storage, g.now, 'Europe/London');
  assert.ok(mind.doing.some((l) => /flood alert is active near Home \(Environment Agency, since 14:05\)/.test(l)), mind.doing.join(' | '));
  // the snapshot every feature reads carries it (CONTEXT's "Doing:", the Brief's YOUR DAY)
  const snap = await M.mindSnapshot(g.storage, { client: { tz: 'Europe/London', name: 'Aqis' }, now: g.now });
  assert.ok(snap.today.doing.some((l) => /near Home/.test(l)), snap.today.doing.join(' | '));
  // the same warnings an hour later: nothing new is said
  g.at(NOW + 60 * MIN);
  const again = await G.watchTick(g.d);
  assert.deepEqual([again.news, again.clear], [[], []]);
  assert.equal(g.out.notes.length, 1, 'never the same warning twice');
  // the flood feed cannot be read: the alert is kept, no all-clear
  web.down.add('environment.data.gov.uk');
  g.at(NOW + 120 * MIN);
  const failed = await G.watchTick(g.d);
  web.down.delete('environment.data.gov.uk');
  assert.deepEqual(failed.clear, [], 'a failed look is never an all-clear');
  const info = await G.guardianInfo(g.d);
  assert.match(info.failed.flood, /down/);
  assert.equal(info.places[0].active.filter((w) => w.feed === 'flood').length, 1, 'the alert is still shown');
  // it lifts: the all-clear, once
  web.feeds.ea = 'ea_none';
  g.at(NOW + 180 * MIN);
  const lifted = await G.watchTick(g.d);
  assert.deepEqual(lifted.clear, ['The flood alert near Home has lifted (Environment Agency).']);
  assert.deepEqual(g.out.notes.at(-1), { kind: 'task', title: 'All clear', text: 'The flood alert near Home has lifted (Environment Agency).' });
  g.at(NOW + 240 * MIN);
  assert.deepEqual((await G.watchTick(g.d)).clear, [], 'the all-clear is said once');
  // the wind warning's own end (23:59) is honoured even while the feed still lists it
  g.at(Date.UTC(2026, 10, 1, 0, 30));
  web.feeds.met = 'met_wm';
  const ended = await G.watchTick(g.d);
  assert.deepEqual(ended.clear, ['The yellow wind warning near Home has ended (Met Office).']);
  assert.ok(!(await G.guardianMind(g.storage, g.now, 'Europe/London')).doing.length, 'nothing active left in the one mind');
});

test('the watch: a worse level of the same warning is new; crime is shown, never announced; a removed place is forgotten quietly', async () => {
  const g = guardian();
  web.feeds = { ea: 'ea_alert', met: 'met_wm_fog_only', police: 'police_b13' };
  await G.watchTick(g.d);
  web.feeds.ea = 'ea_warning';
  g.at(NOW + 60 * MIN);
  const worse = await G.watchTick(g.d);
  assert.deepEqual(worse.news, ['Flood warning near Home: River Cole at Kings Heath and Moseley (Environment Agency, since 16:20)']);
  assert.deepEqual(worse.clear, [], 'the alert became a warning: not lifted');
  const info = await G.guardianInfo(g.d);
  assert.deepEqual(info.places[0].crime, { month: '2026-08', total: 5, top: [['anti-social behaviour', 2], ['violence and sexual offences', 1], ['vehicle crime', 1], ['burglary', 1]] });
  assert.ok(g.out.notes.every((n) => !/crime/i.test(n.text)), 'crime is never a notification');
  assert.ok(info.checked.flood && info.checked.weather && info.checked.crime);
  // he removes his home: no all-clear about a place he no longer has
  await g.storage.put('places', []);
  web.feeds.ea = 'ea_none';
  g.at(NOW + 120 * MIN);
  assert.deepEqual(await G.watchTick(g.d), { news: [], clear: [] });
  assert.deepEqual((await G.guardianInfo(g.d)).places, []);
});

test('the tool\'s look is quiet (the hourly watch still tells him what is new), and an hourly job is kept, exactly one', async () => {
  const g = guardian();
  web.feeds = { ea: 'ea_alert', met: 'met_wm_fog_only', police: 'police_b13' };
  await G.watchTick(g.d, { quiet: true });
  assert.equal(g.out.notes.length, 0);
  assert.equal((await G.watchTick(g.d)).news.length, 1, 'still news to the hourly watch');
  await G.ensureGuardJob(g.storage);
  await G.ensureGuardJob(g.storage);
  const jobs = (await g.storage.get('jobs')).filter((j) => j.kind === 'guard');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].repeat, 'hourly');
});

test('the guardian group: turned on by his words, never always — the plain turn only names it — and under WATCH', () => {
  const g = T.TOOL_GROUPS.find((x) => x.name === 'guardian');
  assert.ok(g && g.when instanceof RegExp, 'on by its words');
  assert.ok(g.tools.some((t) => t.name === 'threats_near'));
  const on = (t) => T.selectGroups(t, new Set(), false).on.some((x) => x.name === 'guardian');
  for (const t of ['any flood warnings near home?', 'storm tonight?', 'is it safe round here', 'any weather warnings']) assert.ok(on(t), t);
  for (const t of ['hello', 'fix these typescript warnings', 'what is the weather like']) assert.ok(!on(t), t);
  assert.equal(A.GROUP_CAT.guardian, 'watch');
  assert.equal(A.brainAbilities(() => true).find((a) => a.id === 'g:guardian').line, 'I can watch over you.');
});
