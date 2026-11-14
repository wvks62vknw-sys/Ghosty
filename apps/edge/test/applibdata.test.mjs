// THE APP LIBRARY's importers (packages/shared/src/applib/importers, the DATA lane): his own data exports read on the
// phone. The streaming XML reader fed in tiny chunks; the zip reader over a Blob with a deflated entry; the Health
// export's tallies (the busier source a day, never both; nights; heart; workouts; weight; rings); listening history
// (both layouts, skips left out); viewing history (profiles kept apart, trailers left out); the video site's JSON and
// HTML; highlights (a stretched highlight kept once); reading and film exports; GPX, TCX and a hand-encoded FIT file
// (distance, splits, climb, the route as a shape only); calendar, contacts, bank (OFX and QIF), any CSV, bookmarks,
// feeds and subtitles; merging without duplicates; the top list; cancelling. Every fixture is invented. Run from applib.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  stdin: {
    contents: `export * from '../../packages/shared/src/applib/importers/index.ts';
export { DATA } from '../../packages/shared/src/applib/catalogue/data.ts';
export { APP_GLYPHS } from '../../packages/shared/src/applib/types.ts';`,
    resolveDir: at('..'),
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outfile: at('./.build/applibdata.mjs'),
  logLevel: 'warning',
});
const I = await import('./.build/applibdata.mjs');

const enc = new TextEncoder();
/** A zip of these files (deflated), built by hand so the reader is checked against the format itself. */
function zip(files) {
  const locals = [], central = [];
  let off = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = enc.encode(text);
    const data = deflateRawSync(raw);
    const n = enc.encode(name);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(n.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(off, 42);
    locals.push(lh, n, data); central.push(ch, n);
    off += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(central);
  const e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(central.length / 2, 8); e.writeUInt16LE(central.length / 2, 10);
  e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...locals, cd, e]);
}
const file = (name, body) => new File([body], name);
const byKey = (recs, k) => Object.fromEntries(recs.map((r) => [r[k], r]));

// ── the streaming reader ───────────────────────────────────────────────────────────

test('the XML reader: tiny chunks, an inline DOCTYPE, entities, ">" in a value, CDATA and self-closing tags', () => {
  const xml = `<?xml version="1.0"?>\n<!DOCTYPE HealthData [\n<!ELEMENT HealthData (Record)*>\n<!ATTLIST Record type CDATA #REQUIRED>\n]>\n<!-- a comment -->\n<a x="1 &gt; 0" y='b &amp; c'><b>t&#233;xt</b><c/><![CDATA[<raw>]]></a>`;
  const seen = [];
  const sax = new I.Sax({ open: (n, a, s) => seen.push(['open', n, a, s]), close: (n) => seen.push(['close', n]), text: (t) => seen.push(['text', t]) });
  for (let i = 0; i < xml.length; i += 3) sax.push(xml.slice(i, i + 3));
  sax.end();
  assert.deepEqual(seen, [
    ['open', 'a', { x: '1 > 0', y: 'b & c' }, false], ['open', 'b', {}, false], ['text', 'téxt'], ['close', 'b'],
    ['open', 'c', {}, true], ['close', 'c'], ['text', '<raw>'], ['close', 'a'],
  ]);
});

// ── Health ─────────────────────────────────────────────────────────────────────────

const HEALTH = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE HealthData [
<!ELEMENT HealthData (ExportDate,Me,(Record|Workout|ActivitySummary)*)>
<!ATTLIST Record type CDATA #REQUIRED unit CDATA #IMPLIED value CDATA #IMPLIED>
]>
<HealthData locale="en_GB">
 <ExportDate value="2026-11-14 09:00:00 +0000"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Phone" unit="count" startDate="2026-11-10 08:00:00 +0000" endDate="2026-11-10 08:10:00 +0000" value="4000"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Phone" unit="count" startDate="2026-11-10 12:00:00 +0000" endDate="2026-11-10 12:10:00 +0000" value="2000"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Watch" unit="count" startDate="2026-11-10 08:00:00 +0000" endDate="2026-11-10 08:10:00 +0000" value="6500">
  <MetadataEntry key="HKMetadataKeySyncVersion" value="1"/>
 </Record>
 <Record type="HKQuantityTypeIdentifierDistanceWalkingRunning" sourceName="Watch" unit="mi" startDate="2026-11-10 08:00:00 +0000" endDate="2026-11-10 08:10:00 +0000" value="3"/>
 <Record type="HKQuantityTypeIdentifierFlightsClimbed" sourceName="Phone" unit="count" startDate="2026-11-10 08:00:00 +0000" endDate="2026-11-10 08:10:00 +0000" value="7"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Phone" unit="count" startDate="2026-11-11 09:00:00 +0000" endDate="2026-11-11 09:10:00 +0000" value="1234"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Watch" startDate="2026-11-10 23:00:00 +0000" endDate="2026-11-11 01:00:00 +0000" value="HKCategoryValueSleepAnalysisAsleepCore"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Watch" startDate="2026-11-11 01:00:00 +0000" endDate="2026-11-11 02:30:00 +0000" value="HKCategoryValueSleepAnalysisAsleepDeep"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Watch" startDate="2026-11-11 02:30:00 +0000" endDate="2026-11-11 02:45:00 +0000" value="HKCategoryValueSleepAnalysisAwake"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Watch" startDate="2026-11-11 02:45:00 +0000" endDate="2026-11-11 06:45:00 +0000" value="HKCategoryValueSleepAnalysisAsleepREM"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Phone" startDate="2026-11-10 22:40:00 +0000" endDate="2026-11-11 07:00:00 +0000" value="HKCategoryValueSleepAnalysisInBed"/>
 <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Watch" unit="count/min" startDate="2026-11-10 10:00:00 +0000" endDate="2026-11-10 10:00:00 +0000" value="60"/>
 <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Watch" unit="count/min" startDate="2026-11-10 11:00:00 +0000" endDate="2026-11-10 11:00:00 +0000" value="90"/>
 <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Watch" unit="count/min" startDate="2026-11-10 12:00:00 +0000" endDate="2026-11-10 12:00:00 +0000" value="120"/>
 <Record type="HKQuantityTypeIdentifierRestingHeartRate" sourceName="Watch" unit="count/min" startDate="2026-11-10 00:00:00 +0000" endDate="2026-11-10 23:59:00 +0000" value="54"/>
 <Record type="HKQuantityTypeIdentifierHeartRateVariabilitySDNN" sourceName="Watch" unit="ms" startDate="2026-11-10 03:00:00 +0000" endDate="2026-11-10 03:01:00 +0000" value="48.6"/>
 <Record type="HKQuantityTypeIdentifierBodyMass" sourceName="Scales" unit="lb" startDate="2026-11-09 07:00:00 +0000" endDate="2026-11-09 07:00:00 +0000" value="170"/>
 <Record type="HKQuantityTypeIdentifierBodyMass" sourceName="Scales" unit="kg" startDate="2026-11-10 07:00:00 +0000" endDate="2026-11-10 07:00:00 +0000" value="77.4"/>
 <Record type="HKQuantityTypeIdentifierBodyFatPercentage" sourceName="Scales" unit="%" startDate="2026-11-10 07:00:00 +0000" endDate="2026-11-10 07:00:00 +0000" value="0.182"/>
 <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="31.5" durationUnit="min" sourceName="Watch" startDate="2026-11-10 07:05:00 +0000" endDate="2026-11-10 07:36:30 +0000">
  <WorkoutStatistics type="HKQuantityTypeIdentifierDistanceWalkingRunning" startDate="2026-11-10 07:05:00 +0000" endDate="2026-11-10 07:36:30 +0000" sum="5.02" unit="km"/>
  <WorkoutStatistics type="HKQuantityTypeIdentifierActiveEnergyBurned" startDate="2026-11-10 07:05:00 +0000" endDate="2026-11-10 07:36:30 +0000" sum="1300" unit="kJ"/>
 </Workout>
 <Workout workoutActivityType="HKWorkoutActivityTypeTraditionalStrengthTraining" duration="0.75" durationUnit="hr" totalEnergyBurned="210" totalEnergyBurnedUnit="kcal" sourceName="Watch" startDate="2026-11-11 18:00:00 +0000" endDate="2026-11-11 18:45:00 +0000"/>
 <ActivitySummary dateComponents="2026-11-10" activeEnergyBurned="512.3" activeEnergyBurnedGoal="500" activeEnergyBurnedUnit="kcal" appleExerciseTime="38" appleExerciseTimeGoal="30" appleStandHours="11" appleStandHoursGoal="12"/>
 <ActivitySummary dateComponents="2026-11-11" activeEnergyBurned="0" activeEnergyBurnedGoal="500" activeEnergyBurnedUnit="kcal" appleExerciseTime="0" appleStandHours="0"/>
</HealthData>`;

test('Health export: read from the zip as a stream; steps take the busier source a day, never both added', async () => {
  const z = file('export.zip', zip({ 'apple_health_export/export_cda.xml': '<x/>', 'apple_health_export/export.xml': HEALTH }));
  const fr = [];
  const steps = await I.importFile('health-steps', z, { progress: (f) => fr.push(f) });
  assert.deepEqual(byKey(steps, 'date'), {
    '2026-11-10': { _key: '2026-11-10', date: '2026-11-10', steps: 6500, km: 4.83, flights: 7 },
    '2026-11-11': { _key: '2026-11-11', date: '2026-11-11', steps: 1234, km: 0, flights: 0 },
  });
  assert.equal(fr[fr.length - 1], 1, 'progress reaches the end');
  assert.ok(fr.every((f, i) => i === 0 || f >= fr[i - 1]), 'progress only moves forward');
});

test('Health export: a night of sleep, heart rate, workouts, weight and the day rings', async () => {
  const x = file('export.xml', HEALTH);
  const [sleep] = await I.importFile('health-sleep', x);
  assert.deepEqual(sleep, { _key: '2026-11-11', date: '2026-11-11', asleep: 450, inbed: 500, deep: 90, rem: 240, bed: '23:00', wake: '06:45' });
  const heart = await I.importFile('health-heart', x);
  assert.deepEqual(heart, [{ _key: '2026-11-10', date: '2026-11-10', avg: 90, low: 60, high: 120, resting: 54, hrv: 49 }]);
  const wk = await I.importFile('health-workouts', x);
  assert.deepEqual(wk.map(({ _key, ...r }) => r), [
    { date: '2026-11-10', time: '07:05', type: 'Running', mins: 32, km: 5.02, kcal: 311 },
    { date: '2026-11-11', time: '18:00', type: 'Strength', mins: 45, kcal: 210 },
  ]);
  assert.deepEqual((await I.importFile('health-weight', x)).map(({ _key, ...r }) => r), [{ date: '2026-11-09', kg: 77.1 }, { date: '2026-11-10', kg: 77.4, fat: 18.2 }]);
  assert.deepEqual(await I.importFile('health-activity', x), [{ _key: '2026-11-10', date: '2026-11-10', move: 512, goal: 500, exercise: 38, stand: 11 }]);
  assert.equal(I.workoutName('HKWorkoutActivityTypeCrossCountrySkiing'), 'Cross country skiing');
});

test('cancelling stops the read', async () => {
  const ac = new AbortController();
  ac.abort();
  await assert.rejects(I.importFile('health-steps', file('export.xml', HEALTH), { signal: ac.signal }), I.Cancelled);
});

// ── listening, viewing, highlights, reading, films ─────────────────────────────────

test('listening history: both layouts, a track a day folded, skips left out, podcasts kept apart', async () => {
  const short = JSON.stringify([
    { endTime: '2026-11-10 08:00', artistName: 'The Quiet Hours', trackName: 'Low Tide', msPlayed: 200000 },
    { endTime: '2026-11-10 09:00', artistName: 'The Quiet Hours', trackName: 'Low Tide', msPlayed: 190000 },
    { endTime: '2026-11-10 09:05', artistName: 'The Quiet Hours', trackName: 'High Tide', msPlayed: 12000 },
  ]);
  const ext = JSON.stringify([
    { ts: '2026-11-11T20:00:00Z', ms_played: 1800000, master_metadata_track_name: null, episode_name: 'On Bread', episode_show_name: 'Kitchen Talk' },
    { ts: '2026-11-11T21:00:00Z', ms_played: 240000, master_metadata_track_name: 'Glass Roads', master_metadata_album_artist_name: 'Fen Lights', master_metadata_album_album_name: 'North' },
  ]);
  const recs = await I.importFile('listening-year', file('data.zip', zip({ 'Spotify Account Data/StreamingHistory_music_0.json': short, 'Spotify Extended Streaming History/Streaming_History_Audio_2026.json': ext, 'Spotify Account Data/Userdata.json': '{}' })));
  const t = byKey(recs, 'track');
  assert.equal(recs.length, 3);
  assert.deepEqual([t['Low Tide'].plays, t['Low Tide'].minutes], [2, 6.5]);
  assert.equal(t['High Tide'], undefined, 'a 12-second play is a skip');
  assert.deepEqual([t['On Bread'].kind, t['On Bread'].artist, t['Glass Roads'].kind, t['Glass Roads'].album], ['Podcast', 'Kitchen Talk', 'Music', 'North']);
  assert.deepEqual(I.topList(recs, 'artist', { by: 'minutes' }), [{ name: 'Kitchen Talk', value: 30 }, { name: 'The Quiet Hours', value: 6.5 }, { name: 'Fen Lights', value: 4 }]);
  const day = recs.find((r) => r.track === 'Low Tide').date;
  assert.deepEqual(I.topList(recs, 'artist', { by: 'minutes', from: day, to: day }), [{ name: 'The Quiet Hours', value: 6.5 }]);
});

test('viewing history: the simple list, and the full download with each profile kept apart and trailers left out', async () => {
  const simple = '"Title","Date"\n"Harbour Lights: Season 1: The Pier","14/11/2026"\n"A Long Walk","03/11/2026"\n';
  const recs = await I.importFile('watch-history', file('NetflixViewingHistory.csv', simple));
  assert.deepEqual(recs.map(({ _key, ...r }) => r), [
    { date: '2026-11-14', title: 'Harbour Lights: Season 1: The Pier', show: 'Harbour Lights', kind: 'Series', episode: 'The Pier' },
    { date: '2026-11-03', title: 'A Long Walk', show: 'A Long Walk', kind: 'Film' },
  ]);
  const full = 'Profile Name,Start Time,Duration,Attributes,Title,Supplemental Video Type,Device Type,Bookmark,Latest Bookmark,Country\n' +
    'Me,2026-11-10 20:00:00,00:45:30,,Harbour Lights: Season 1: The Pier,,TV,00:45:30,00:45:30,GB\n' +
    'Me,2026-11-10 19:58:00,00:01:00,,Harbour Lights: Season 1 (Trailer),TRAILER,TV,00:01:00,00:01:00,GB\n' +
    'Guest,2026-11-11 10:00:00,01:30:00,,A Long Walk,,TV,01:30:00,01:30:00,GB\n';
  const f = I.watchRecords(full);
  assert.deepEqual(f.map((r) => [r.title, r.mins, r._who]), [['Harbour Lights: Season 1: The Pier', 46, 'Me'], ['A Long Walk', 90, 'Guest']]);
});

test('video history: the JSON and the HTML layouts, ads left out', () => {
  const json = JSON.stringify([
    { header: 'YouTube', title: 'Watched How to Sharpen a Chisel', titleUrl: 'https://www.youtube.com/watch?v=abc', subtitles: [{ name: 'Bench Notes', url: 'https://x' }], time: '2026-11-10T19:00:00.000Z' },
    { header: 'YouTube', title: 'Watched An Advert', time: '2026-11-10T19:05:00.000Z', details: [{ name: 'From Google Ads' }] },
  ]);
  const j = I.videoFromJson(json);
  assert.equal(j.length, 1);
  assert.deepEqual([j[0].title, j[0].channel, j[0].link, j[0].kind], ['How to Sharpen a Chisel', 'Bench Notes', 'https://www.youtube.com/watch?v=abc', 'Video']);
  const html = '<div class="outer-cell mdl-cell"><div class="mdl-grid"><div class="header-cell"><p class="mdl-typography--title">YouTube<br></p></div><div class="content-cell mdl-cell mdl-cell--6-col mdl-typography--body-1">Watched <a href="https://www.youtube.com/watch?v=def">Bread &amp; Butter</a><br><a href="https://www.youtube.com/channel/x">Kitchen Bench</a><br>Nov 9, 2026, 8:15:02 PM GMT<br></div></div></div>';
  assert.deepEqual(I.videoFromHtml(html).map(({ _key, ...r }) => r), [{ date: '2026-11-09', title: 'Bread & Butter', kind: 'Video', time: '20:15', channel: 'Kitchen Bench', link: 'https://www.youtube.com/watch?v=def' }]);
});

test('highlights: notes and highlights kept, bookmarks left out, a stretched highlight kept once (the longer)', async () => {
  const txt = '﻿The Salt Road (Ana Field)\n- Your Highlight on page 12 | Location 170-171 | Added on Tuesday, 10 November 2026 21:04:11\n\nThe sea keeps its own time.\n==========\n' +
    'The Salt Road (Ana Field)\n- Your Highlight on page 12 | Location 170-173 | Added on Tuesday, 10 November 2026 21:05:00\n\nThe sea keeps its own time, and so do we.\n==========\n' +
    'The Salt Road (Ana Field)\n- Your Bookmark on page 30 | Location 400 | Added on Tuesday, 10 November 2026 21:06:00\n\n\n==========\n' +
    'The Salt Road (Ana Field)\n- Your Note on page 31 | Location 410 | Added on Wednesday, 11 November 2026 07:00:00\n\nCompare with chapter two.\n==========\n';
  const recs = await I.importFile('book-highlights', file('My Clippings.txt', txt));
  assert.deepEqual(recs.map(({ _key, ...r }) => r), [
    { book: 'The Salt Road', author: 'Ana Field', kind: 'Highlight', quote: 'The sea keeps its own time, and so do we.', page: 12, location: 170, date: '2026-11-10', time: '21:05' },
    { book: 'The Salt Road', author: 'Ana Field', kind: 'Note', quote: 'Compare with chapter two.', page: 31, location: 410, date: '2026-11-11', time: '07:00' },
  ]);
});

test('reading export and film diary (zip, the diary chosen over the watched list)', async () => {
  const gr = 'Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies\n' +
    '101,The Salt Road,Ana Field,"Field, Ana",,"=""""","=""""",4,3.9,North Press,Paperback,312,2020,2019,2026/10/02,2026/09/01,,,read,"Lovely.<br/>Slow start.",,,1,0\n' +
    '102,Winter Maps,Joe Hale,"Hale, Joe",,,,0,4.1,North Press,Hardcover,,2024,2024,,2026/11/01,to-read,to-read (#1),to-read,,,,0,0\n';
  assert.deepEqual((await I.importFile('reading-history', file('goodreads_library_export.csv', gr))).map(({ _key, ...r }) => r), [
    { title: 'The Salt Road', author: 'Ana Field', shelf: 'Read', rating: 4, pages: 312, year: 2019, read: '2026-10-02', added: '2026-09-01', review: 'Lovely.\nSlow start.' },
    { title: 'Winter Maps', author: 'Joe Hale', shelf: 'To read', year: 2024, added: '2026-11-01' },
  ]);
  const films = await I.importFile('film-history', file('letterboxd-export.zip', zip({
    'watched.csv': 'Date,Name,Year,Letterboxd URI\n2026-11-01,Ignored,2001,https://x\n',
    'diary.csv': 'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n2026-11-02,Harbour Nights,1998,https://x,4.5,Yes,"cinema, rain",2026-11-01\n',
  })));
  assert.deepEqual(films.map(({ _key, ...r }) => r), [{ title: 'Harbour Nights', year: 1998, date: '2026-11-01', stars: 4.5, rewatch: true, tags: 'cinema, rain' }]);
});

// ── runs and rides ─────────────────────────────────────────────────────────────────

// four points due north, 0.0045° apart (500.4 m each on the 6,371 km sphere), 150 s apart: 1,501 m in 7.5 min
const PTS = [0, 1, 2, 3].map((i) => ({ lat: 52 + i * 0.0045, lon: -1.9, ele: 100 + [0, 5, 4, 12][i], t: Date.UTC(2026, 10, 10, 7, 0, i * 150) }));

test('GPX: distance by haversine, pace, kilometre splits, climb, and the route as a shape with no coordinates', async () => {
  const gpx = `<?xml version="1.0"?><gpx version="1.1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"><metadata><name>Morning</name></metadata><trk><name>River Loop</name><type>running</type><trkseg>${PTS.map((p, i) => `<trkpt lat="${p.lat}" lon="${p.lon}"><ele>${p.ele}</ele><time>${new Date(p.t).toISOString()}</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${140 + i * 4}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>`).join('')}</trkseg></trk></gpx>`;
  const [r] = await I.importFile('runs-rides', file('river.gpx', gpx));
  const d = new Date(PTS[0].t);
  assert.deepEqual({ ...r, _route: undefined, _key: undefined }, {
    _key: undefined, _route: undefined, date: I.localDay(d), time: I.localTime(d), sport: 'Run', name: 'River Loop',
    km: 1.5, mins: 8, pace: `${I.mmss(450 / 1.50119)} /km`, kmh: 12, climb: 13, hr: 146, splits: '5:00',
  });
  assert.match(r._route, /^M\d/);
  assert.doesNotMatch(r._route, /52|1\.9/, 'the shape keeps no coordinates');
  assert.equal(r._route.split('L').length, 4);
});

test('TCX: the laps give time and distance, trackpoints give heart rate', async () => {
  const tcx = `<?xml version="1.0"?><TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Biking"><Id>2026-11-10T07:00:00Z</Id><Lap StartTime="2026-11-10T07:00:00Z"><TotalTimeSeconds>1200</TotalTimeSeconds><DistanceMeters>8000</DistanceMeters><Calories>250</Calories><Track>${PTS.map((p, i) => `<Trackpoint><Time>${new Date(p.t).toISOString()}</Time><Position><LatitudeDegrees>${p.lat}</LatitudeDegrees><LongitudeDegrees>${p.lon}</LongitudeDegrees></Position><AltitudeMeters>${p.ele}</AltitudeMeters><DistanceMeters>${i * 500}</DistanceMeters><HeartRateBpm><Value>${120 + i}</Value></HeartRateBpm></Trackpoint>`).join('')}</Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
  const [r] = await I.importFile('runs-rides', file('ride.tcx', tcx));
  assert.deepEqual([r.sport, r.km, r.mins, r.kmh, r.hr, r.kcal, r.splits], ['Ride', 8, 20, 24, 122, 250, undefined]);
});

/** A FIT file encoded by hand from the protocol: a record definition, three records (one by compressed timestamp), a session. */
function fitFile() {
  const body = [];
  const u8 = (...b) => body.push(...b);
  const u16 = (v) => u8(v & 255, v >> 8);
  const u32 = (v) => u8(v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255);
  const s32 = (v) => u32(v >>> 0);
  const ts0 = Date.UTC(2026, 10, 10, 7, 0, 0) / 1000 - 631065600;
  // definition, local 0 = record (20): timestamp, lat, long, altitude, heart rate, distance
  u8(0x40, 0, 0); u16(20); u8(6, 253, 4, 0x86, 0, 4, 0x85, 1, 4, 0x85, 2, 2, 0x84, 3, 1, 0x02, 5, 4, 0x86);
  const semi = (deg) => Math.round(deg / (180 / 2 ** 31));
  PTS.slice(0, 2).forEach((p, i) => { u8(0x00); u32(ts0 + i * 150); s32(semi(p.lat)); s32(semi(p.lon)); u16((p.ele + 500) * 5); u8(150); u32(i * 50040); });
  // a compressed-timestamp record (local 0 in bits 5-6): offset 20 s after the last full timestamp's low 5 bits
  const t2 = ts0 + 150 + 20;
  u8(0x80 | (t2 & 0x1f)); u32(0xffffffff); s32(semi(PTS[2].lat)); s32(semi(PTS[2].lon)); u16(0xffff); u8(0xff); u32(100080);
  // definition, local 1 = session (18), big-endian: start_time, sport, timer time, distance, avg hr, ascent
  u8(0x41, 0, 1); u8(0, 18); u8(6, 2, 4, 0x86, 5, 1, 0x00, 8, 4, 0x86, 9, 4, 0x86, 16, 1, 0x02, 22, 2, 0x84);
  const be32 = (v) => u8((v >>> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255);
  u8(0x01); be32(ts0); u8(1); be32(1800 * 1000); be32(500000); u8(151); u8(0, 42);
  const head = [14, 0x20, 0x08, 0x08, ...[body.length, 0, 0, 0].map((x, i) => (body.length >> (8 * i)) & 255), 0x2e, 0x46, 0x49, 0x54, 0, 0];
  return new Uint8Array([...head, ...body, 0, 0]);
}

test('FIT: definition and data messages, either byte order, a compressed timestamp, the session totals', async () => {
  const bytes = fitFile();
  const msgs = I.fitMessages(bytes);
  assert.deepEqual(msgs.map((m) => m.global), [20, 20, 20, 18]);
  assert.equal(msgs[2].f[253], Date.UTC(2026, 10, 10, 7, 0, 0) / 1000 - 631065600 + 170, 'the compressed timestamp rolled forward');
  assert.equal(msgs[2].f[2], undefined, 'an invalid altitude is left out');
  const [a] = I.fitActivities(bytes);
  assert.deepEqual([a.sport, a.distance, a.moving, a.hrAvg, a.ascent, a.pts.length], ['Run', 5000, 1800, 151, 42, 3]);
  assert.ok(Math.abs(a.pts[1].lat - PTS[1].lat) < 1e-6 && Math.abs(a.pts[0].ele - 100) < 0.01);
  const rec = I.activityRecord(a);
  assert.deepEqual([rec.km, rec.mins, rec.pace, rec.kmh, rec.climb, rec.hr], [5, 30, '6:00 /km', 10, 42, 151]);
  const viaFile = await I.importFile('runs-rides', new File([bytes], 'run.fit'));
  assert.equal(viaFile[0].km, 5);
});

// ── calendar, contacts, money, tables, bookmarks, feeds, subtitles ─────────────────

test('calendar file: folded lines, all-day and timed events, duration, repeats, cancelled left out, no guests kept', async () => {
  const ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:a1\r\nDTSTART;TZID=Europe/London:20261116T093000\r\nDTEND;TZID=Europe/London:20261116T103000\r\nSUMMARY:Dentist\\, check-up\r\nLOCATION:High Street\r\nATTENDEE;CN=Someone:mailto:someone@example.com\r\nRRULE:FREQ=YEARLY\r\nBEGIN:VALARM\r\nTRIGGER:-PT15M\r\nEND:VALARM\r\nEND:VEVENT\r\n' +
    'BEGIN:VEVENT\r\nUID:a2\r\nDTSTART;VALUE=DATE:20261225\r\nSUMMARY:Holiday with a very long name that the calendar\r\n  folded\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:a3\r\nDTSTART:20261117T120000\r\nDURATION:PT1H30M\r\nSUMMARY:Lunch\r\nSTATUS:CANCELLED\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
  const recs = await I.importFile('calendar-file', file('cal.ics', ics));
  assert.deepEqual(recs.map(({ _key, ...r }) => r), [
    { date: '2026-11-16', title: 'Dentist, check-up', time: '09:30', mins: 60, place: 'High Street', repeats: true },
    { date: '2026-12-25', title: 'Holiday with a very long name that the calendar folded', allday: true },
  ]);
  assert.equal(JSON.stringify(recs).includes('someone'), false);
});

test('contacts file: names, numbers, birthday; the photo never kept', async () => {
  const vcf = 'BEGIN:VCARD\nVERSION:3.0\nN:Field;Ana;;;\nFN:Ana Field\nTEL;TYPE=CELL:+44 7700 900123\nEMAIL:ana@example.com\nBDAY:1990-04-02\nPHOTO;ENCODING=b:AAAA\nEND:VCARD\nBEGIN:VCARD\nVERSION:3.0\nN:;;;;\nORG:Corner Garage;Workshop\nTEL:01632 960000\nEND:VCARD\n';
  assert.deepEqual((await I.importFile('contacts-file', file('c.vcf', vcf))).map(({ _key, ...r }) => r), [
    { name: 'Ana Field', phone: '+44 7700 900123', email: 'ana@example.com', birthday: '1990-04-02' },
    { name: 'Corner Garage', phone: '01632 960000', org: 'Corner Garage, Workshop' },
  ]);
});

test('bank statements: OFX in its SGML form, spending and money in apart, the bank\'s ids keep re-imports single', async () => {
  const ofx = 'OFXHEADER:100\nDATA:OFXSGML\n\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>\n<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261110120000[0:GMT]<TRNAMT>-12.50<FITID>T1<NAME>CORNER CAFE<MEMO>CARD 1234\n</STMTTRN>\n<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261111<TRNAMT>1500.00<FITID>T2<NAME>SALARY\n</STMTTRN></BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>';
  const a = await I.importFile('statement-reader', file('s.ofx', ofx));
  assert.deepEqual(a.map(({ _key, ...r }) => r), [
    { date: '2026-11-10', payee: 'CORNER CAFE', spent: 12.5, memo: 'CARD 1234' },
    { date: '2026-11-11', payee: 'SALARY', received: 1500 },
  ]);
  const again = I.mergeRecords([...a, { date: '2026-11-12', payee: 'Typed by hand', spent: 3 }], a, 'merge');
  assert.equal(again.length, 3, 'the same file twice is not doubled, and a hand-made record stays');
  assert.equal(I.mergeRecords(again, [a[0]], 'replace').length, 2, 'replace keeps only the new file (and his own records)');
});

test('QIF: categories, day-first dates worked out from the file, the same payment twice on one day kept twice', () => {
  const qif = '!Type:Bank\nD25/10/2026\nT-4.20\nPBakery\nLFood:Bread\n^\nD25/10/2026\nT-4.20\nPBakery\nLFood\n^\nD01/11/2026\nT20.00\nPRefund\n^\n';
  assert.deepEqual(I.qifRecords(qif).map((r) => [r.date, r.payee, r.spent ?? r.received, r.category]), [
    ['2026-10-25', 'Bakery', 4.2, 'Food'], ['2026-10-25', 'Bakery', 4.2, 'Food'], ['2026-11-01', 'Refund', 20, undefined],
  ]);
  assert.equal(new Set(I.qifRecords(qif).map((r) => r._key)).size, 3);
});

test('any CSV: a title, the other columns as the line, its date and its number found', () => {
  const recs = I.tableRecords('Session;Date;Minutes;Notes\nYoga;14/11/2026;45;"calm; slow"\nRun;13/11/2026;30;\n');
  assert.deepEqual(recs.map(({ _key, ...r }) => r), [
    { title: 'Yoga', details: 'Date: 14/11/2026 · Minutes: 45 · Notes: calm; slow', date: '2026-11-14', value: 45 },
    { title: 'Run', details: 'Date: 13/11/2026 · Minutes: 30', date: '2026-11-13', value: 30 },
  ]);
});

test('bookmarks: the HTML export with folders, and the browser\'s JSON file', () => {
  const html = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<DL><p>\n<DT><H3 ADD_DATE="1">Cooking</H3>\n<DL><p>\n<DT><A HREF="https://www.example.org/bread" ADD_DATE="1794000000">Bread &amp; Rolls</A>\n</DL><p>\n<DT><A HREF="https://example.com/">Home</A>\n<DT><A HREF="javascript:void(0)">Bookmarklet</A>\n</DL>';
  assert.deepEqual(I.bookmarkRecords(html).map(({ _key, added, ...r }) => r), [
    { title: 'Bread & Rolls', link: 'https://www.example.org/bread', site: 'example.org', folder: 'Cooking' },
    { title: 'Home', link: 'https://example.com/', site: 'example.com' },
  ]);
  const json = JSON.stringify({ roots: { bookmark_bar: { type: 'folder', name: 'Bar', children: [{ type: 'url', name: 'Maps', url: 'https://maps.example/', date_added: String((Date.UTC(2026, 0, 2) + 11644473600000) * 1000) }] } } });
  assert.deepEqual(I.bookmarkRecords(json).map(({ _key, ...r }) => r), [{ title: 'Maps', link: 'https://maps.example/', site: 'maps.example', folder: 'Bar', added: I.localDay(new Date(Date.UTC(2026, 0, 2))) }]);
});

test('feeds (OPML) and subtitles (SRT and WebVTT)', () => {
  const opml = '<?xml version="1.0"?><opml version="2.0"><body><outline text="Food"><outline type="rss" text="Kitchen Talk" xmlUrl="https://feeds.example/kitchen" htmlUrl="https://kitchen.example"/></outline><outline type="rss" title="Slow News" text="x" xmlUrl="https://feeds.example/slow"/></body></opml>';
  assert.deepEqual(I.feedRecords(opml).map(({ _key, ...r }) => r), [
    { title: 'Kitchen Talk', feed: 'https://feeds.example/kitchen', site: 'https://kitchen.example', folder: 'Food' },
    { title: 'Slow News', feed: 'https://feeds.example/slow' },
  ]);
  const srt = '1\r\n00:00:01,000 --> 00:00:04,500\r\n<i>Where were you?</i>\r\n\r\n2\r\n01:02:03,250 --> 01:02:05,000\r\nOut by the pier.\r\nAll night.\r\n';
  assert.deepEqual(I.subtitleRecords(srt).map(({ _key, ...r }) => r), [
    { n: 1, start: '0:00:01', secs: 3.5, line: 'Where were you?', words: 3 },
    { n: 2, start: '1:02:03', secs: 1.8, line: 'Out by the pier.\nAll night.', words: 6 },
  ]);
  assert.equal(I.subtitleRecords('WEBVTT\n\n00:01.000 --> 00:02.000\nHello\n')[0].start, '0:00:01');
});

test('dates in the many ways exports write them', () => {
  assert.deepEqual(['2026-11-14', '14/11/2026', '11/14/2026', '14 November 2026', 'Nov 14, 2026', '3rd March 2026'].map((s) => I.parseDay(s, s === '11/14/2026' ? 'mdy' : 'dmy')),
    ['2026-11-14', '2026-11-14', '2026-11-14', '2026-11-14', '2026-11-14', '2026-03-03']);
  assert.equal(I.guessOrder(['03/04/2026', '11/25/2026']), 'mdy');
  assert.equal(I.parseClock('8:15:02 PM GMT'), '20:15');
});

// ── the catalogue ──────────────────────────────────────────────────────────────────

test('the data apps: each has a reader, fields that exist, real sample records and clean words', () => {
  const BRANDS = /apple|spotify|netflix|youtube|google|kindle|amazon|goodreads|letterboxd|garmin|strava|chrome|safari|firefox|fitbit|quicken|outlook|gmail|icloud|wrapped/i;
  const ids = new Set();
  for (const d of I.DATA) {
    const where = d.id;
    assert.ok(!ids.has(d.id), `${where}: unique id`); ids.add(d.id);
    assert.match(d.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, where);
    assert.ok(I.READERS[d.id], `${where}: has a reader`);
    assert.equal(d.archetype, 'importer', where);
    assert.equal(d.family, 'data', where);
    assert.ok(I.APP_GLYPHS.includes(d.glyph), `${where}: glyph ${d.glyph}`);
    assert.ok(d.name.length >= 2 && d.name.length <= 18 && /^[A-Z][a-z]*( (and|[A-Z][a-z]*))*$/.test(d.name), `${where}: name ${d.name}`);
    assert.ok(d.pitch.length >= 30 && d.pitch.length <= 90 && d.pitch.endsWith('.'), `${where}: pitch ${d.pitch.length}`);
    assert.ok(d.keywords.length >= 2 && d.keywords.length <= 8 && d.keywords.every((k) => k === k.toLowerCase()), `${where}: keywords`);
    assert.ok(d.tour.length === 3 && d.tour.every((t) => t.length <= 70), `${where}: tour ${d.tour.map((t) => t.length)}`);
    const log = d.importer.log;
    const f = new Set(log.fields.map((x) => x.id));
    for (const x of log.fields) {
      assert.ok(x.label.split(' ').length <= 2, `${where}: label ${x.label}`);
      if (x.options) assert.ok(x.options.length >= 2 && x.options.length <= 12, `${where}: options`);
    }
    const refs = [log.date, log.sort?.field, log.group, log.chart?.field, ...(log.stats ?? []).map((s) => s.field), ...[log.title, log.sub, log.meta].flatMap((t) => (t ? (t.includes('{') ? [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]) : [t]) : []))];
    for (const r of refs.filter(Boolean)) assert.ok(f.has(r), `${where}: refers to field ${r}`);
    if (log.group) assert.equal(log.fields.find((x) => x.id === log.group).type, 'choice', `${where}: group is a choice`);
    if (log.chart) assert.ok(['number', 'money', 'duration', 'rating', 'scale'].includes(log.fields.find((x) => x.id === log.chart.field).type), `${where}: chart field is a number`);
    assert.ok(d.sample.length >= 2 && d.sample.length <= 6, `${where}: sample count`);
    for (const s of d.sample) for (const k of Object.keys(s)) assert.ok(f.has(k), `${where}: sample key ${k}`);
    assert.ok(d.importer.how.length >= 2, `${where}: how`);
    const words = [d.name, d.pitch, ...d.tour, ...d.importer.how, ...log.fields.map((x) => x.label), ...(log.stats ?? []).map((s) => s.label)].join(' ');
    assert.doesNotMatch(words, BRANDS, `${where}: no brand or app name`);
    assert.doesNotMatch(words, /!|\bcolor|favorite|center\b|organiz|TODO|lorem/i, `${where}: clean British words`);
  }
  assert.ok(I.DATA.length >= 20);
  assert.deepEqual(Object.keys(I.READERS).sort(), [...ids].sort(), 'every reader has an app');
  assert.deepEqual(Object.keys(I.READER_META).sort(), [...ids].sort(), 'and the page knows each one');
});
