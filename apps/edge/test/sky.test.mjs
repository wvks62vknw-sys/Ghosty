// AIM's night sky (apps/web/src/aim/sky.ts, carried in the targets bundle), off the phone and with no network:
// the Pole Star stands at the observer's latitude in the north; the Sun's declination at the solstices and its
// height at London's noon on the March equinox; the Moon opposite the Sun at a full moon and with it at a new
// moon (by their ecliptic longitudes, which is what full and new mean: the Moon can sit up to 5° above or below
// the Sun's path), its phase in words; Jupiter, Saturn and Mars opposite the Sun at their oppositions; Venus
// and Mercury never further from the Sun than they can be; and what AIM shows: only what is up, stars only
// once it is dark, every card in plain words with the Sun's warning.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const T = await import('./.build/aim/targets.mjs');

const LONDON = { lat: 51.5, lon: -0.13 };
const near = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what ?? ''} ${a} is not within ${eps} of ${b}`);
const wrap180 = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const sky = (iso, at = LONDON) => {
  const all = T.skyAt(new Date(iso), at.lat, at.lon);
  return Object.fromEntries(all.map((b) => [b.id, b]));
};
const eclLon = (b, iso) => T.toEcliptic(b.ra, b.dec, new Date(iso)).lon;

test('the sky is in the targets bundle, with the Sun, the Moon, the five planets and about fifty named stars', () => {
  const s = T.skyAt(new Date('2026-11-14T22:00:00Z'), LONDON.lat, LONDON.lon);
  for (const id of ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'star:polaris', 'star:sirius', 'star:vega']) assert.ok(s.some((b) => b.id === id), `no ${id}`);
  assert.ok(T.STAR_COUNT >= 40, `only ${T.STAR_COUNT} stars`);
  for (const b of s) {
    assert.ok(b.az >= 0 && b.az < 360, `${b.id} bearing ${b.az}`);
    assert.ok(b.el >= -90 && b.el <= 90, `${b.id} height ${b.el}`);
  }
});

test('Polaris stands at the observer\'s latitude, due north (London, at any hour)', () => {
  for (const iso of ['2026-11-14T22:00:00Z', '2026-05-01T03:00:00Z', '2025-08-10T23:30:00Z', '2024-01-01T00:00:00Z']) {
    const p = sky(iso)['star:polaris'];
    near(p.el, LONDON.lat, 1.5, `Polaris's height at ${iso}`);
    near(wrap180(p.az), 0, 2, `Polaris's bearing at ${iso}`);
  }
});

test('the Sun: +23.4° at the June solstice, -23.4° at the December one, 38.5° up at London\'s noon on the March equinox', () => {
  near(sky('2024-06-20T20:51:00Z').sun.dec, 23.44, 0.5, 'June solstice declination');
  near(sky('2024-12-21T09:20:00Z').sun.dec, -23.44, 0.5, 'December solstice declination');
  // London's solar noon on 20 March 2024: 12:00 UTC, plus the equation of time (about 7.5 min), plus 0.13° of longitude
  const noon = sky('2024-03-20T12:08:00Z').sun;
  near(noon.el, 38.5, 1, 'the Sun at noon on the equinox');
  near(noon.az, 180, 1.5, 'and due south');
  // and it is below the horizon at midnight
  assert.ok(sky('2024-03-20T00:00:00Z').sun.el < -30);
});

test('the Moon: opposite the Sun at the full moon of 25 Jan 2024, with it at the new moon of 11 Jan 2024; its phase in words', () => {
  const fullAt = '2024-01-25T17:54:00Z';
  const f = sky(fullAt);
  near(Math.abs(wrap180(eclLon(f.moon, fullAt) - eclLon(f.sun, fullAt))), 180, 5, 'full moon: Moon less Sun in longitude');
  near(T.separation(f.moon, f.sun), 180, 5, 'full moon: their angle apart on the sky');
  assert.ok(f.moon.phase.lit > 0.97, `full moon lit ${f.moon.phase.lit}`);
  assert.match(f.moon.phase.words, /^full moon \(\d+% lit\)$/);
  const newAt = '2024-01-11T11:57:00Z';
  const n = sky(newAt);
  near(wrap180(eclLon(n.moon, newAt) - eclLon(n.sun, newAt)), 0, 5, 'new moon: Moon less Sun in longitude');
  assert.ok(n.moon.phase.lit < 0.03, `new moon lit ${n.moon.phase.lit}`);
  assert.match(n.moon.phase.words, /^new moon/);
  // a week after the new moon: first quarter, about half lit, waxing
  const q = sky('2024-01-18T03:53:00Z').moon.phase;
  assert.ok(q.waxing && q.lit > 0.4 && q.lit < 0.6, JSON.stringify(q));
  assert.match(q.words, /^first quarter, \d+% lit$/);
  // the phase names follow the age, round the month
  assert.equal(T.phaseWords(120, 0.78), 'waxing gibbous, 78% lit');
  assert.equal(T.phaseWords(300, 0.25), 'waning crescent, 25% lit');
  // the Moon is about 384,000 km away
  assert.ok(f.moon.km > 356_000 && f.moon.km < 407_000, `the Moon at ${f.moon.km} km`);
});

test('the outer planets at opposition: Jupiter on 3 Nov 2023, Saturn on 8 Sep 2024, Mars on 16 Jan 2025', () => {
  for (const [id, iso, mag] of [['jupiter', '2023-11-03T05:00:00Z', -2.9], ['saturn', '2024-09-08T05:00:00Z', 0.6], ['mars', '2025-01-16T02:00:00Z', -1.4]]) {
    const s = sky(iso);
    const e = T.separation(s[id], s.sun);
    assert.ok(e >= 175, `${id} at opposition is only ${e.toFixed(2)}° from the Sun`);
    near(Math.abs(wrap180(eclLon(s[id], iso) - eclLon(s.sun, iso))), 180, 1.5, `${id}: opposite the Sun in longitude`);
    near(s[id].mag, mag, 0.5, `${id}'s brightness at opposition`);
  }
  // and not opposite half a year later
  const later = sky('2024-05-03T05:00:00Z');
  assert.ok(T.separation(later.jupiter, later.sun) < 60);
});

test('Venus is never more than 48° from the Sun, Mercury never more than 28.5° (a year of daily samples)', () => {
  let venus = 0;
  let mercury = 0;
  for (let i = 0; i < 366; i++) {
    const s = T.skyAt(new Date(Date.UTC(2025, 0, 1, 12) + i * 86_400_000), LONDON.lat, LONDON.lon);
    const sun = s.find((b) => b.id === 'sun');
    venus = Math.max(venus, T.separation(s.find((b) => b.id === 'venus'), sun));
    mercury = Math.max(mercury, T.separation(s.find((b) => b.id === 'mercury'), sun));
  }
  assert.ok(venus <= 48 && venus > 40, `Venus at most ${venus.toFixed(2)}° from the Sun`);
  assert.ok(mercury <= 28.5 && mercury > 17, `Mercury at most ${mercury.toFixed(2)}° from the Sun`);
});

test('what AIM shows: only what is up; stars only once the Sun is 6° down, the brighter ones first; the Sun, Moon and planets whenever up', () => {
  // a November evening in Birmingham, the Sun long set: the Moon, Saturn and bright stars, nothing below the horizon
  const night = T.skyAt(new Date('2026-11-20T19:00:00Z'), 52.4797, -1.9026);
  const shown = T.skyShown(night);
  assert.ok(shown.every((b) => b.el > 0), 'something below the horizon is shown');
  assert.ok(shown.some((b) => b.id === 'moon') && shown.some((b) => b.id === 'saturn') && shown.some((b) => b.id === 'star:polaris'), shown.map((b) => b.id).join(','));
  assert.ok(shown.filter((b) => b.body === 'star').length <= 30, 'too many stars');
  // a faint star of the list waits for a properly dark sky; the brightest show from the end of civil twilight
  const sunEl = (d) => T.skyAt(d, 52.4797, -1.9026).find((b) => b.id === 'sun').el;
  let dusk = new Date('2026-11-20T16:00:00Z');
  while (sunEl(dusk) > -8) dusk = new Date(dusk.getTime() + 60_000);
  const twilight = T.skyShown(T.skyAt(dusk, 52.4797, -1.9026)).filter((b) => b.body === 'star');
  assert.ok(twilight.every((b) => b.mag <= 1.0 || b.id === 'star:polaris'), twilight.map((b) => `${b.name} ${b.mag}`).join(','));
  // by day: no stars at all, the Sun is shown
  const day = T.skyShown(T.skyAt(new Date('2026-06-21T12:00:00Z'), 52.4797, -1.9026));
  assert.ok(!day.some((b) => b.body === 'star'), 'stars shown by day');
  assert.ok(day.some((b) => b.id === 'sun'), 'the Sun is not shown at noon in June');
});

test('sky labels: each card in words (what, where, how high), the Moon\'s phase, and the Sun\'s warning never to look at it', () => {
  const at = { lat: 52.4797, lon: -1.9026 };
  const seen = T.skySeen(T.skyShown(T.skyAt(new Date('2026-11-20T19:00:00Z'), at.lat, at.lon)), at);
  const moon = seen.find((t) => t.id === 'moon');
  assert.equal(moon.kind, 'sky');
  assert.equal(moon.title, 'Moon');
  assert.ok(moon.range >= 1e12 && moon.ground >= 1e12, 'a sky label must lie further than anything on the Earth');
  near(Math.hypot(...moon.dir), 1, 1e-9, 'unit direction');
  near(moon.dir[2], Math.sin((moon.elevation * Math.PI) / 180), 1e-9, 'direction up');
  assert.match(moon.facts.find(([k]) => k === 'Phase')[1], /^waxing gibbous, \d+% lit$/);
  assert.match(T.whereLine(moon), /^south-south-east, halfway up the sky \(\d+° up\)$/);
  assert.match(T.labelLine(moon), /^\d+% lit · \d+° up$/);
  assert.match(T.describeTarget(moon), /^aimed at the Moon in the night sky \(1\d\d° from north, \d+\.\d° up, worked out on the phone; /);
  const saturn = seen.find((t) => t.id === 'saturn');
  assert.equal(saturn.facts[0][1], 'a planet');
  assert.match(saturn.facts.find(([k]) => k === 'Distance')[1], /million km$/);
  const polaris = seen.find((t) => t.id === 'star:polaris');
  assert.match(polaris.facts[0][1], /Pole Star.*north/);
  // the Sun at noon: its card says never to look at it
  const sun = T.skySeen(T.skyShown(T.skyAt(new Date('2026-06-21T12:00:00Z'), at.lat, at.lon)), at).find((t) => t.id === 'sun');
  assert.match(sun.facts.map(([, v]) => v).join(' '), /Never look at the Sun, by eye or through the camera/);
  assert.match(T.whereLine(sun), /^south/);
  // words for direction and height
  assert.equal(T.directionWords(0), 'north');
  assert.equal(T.directionWords(135), 'south-east');
  assert.equal(T.directionWords(292.5), 'west-north-west');
  assert.equal(T.heightWords(3), 'just above the horizon');
  assert.equal(T.heightWords(85), 'almost overhead');
});
