// RELIABILITY AND HEALTH (BRIEF-RELIABILITY; apps/edge/src/health.ts, packages/shared/src/health.ts), on the brain's own code:
//  - the four marks from every combination of a missing key, reach, a failed run and a stale feed;
//  - the health object from a seeded trail: one group failing, one back after a failure ("back since"), a feed past its staleness;
//  - a key is named and never its value (a planted value must be absent from the whole answer), and no raw error text goes out;
//  - "that felt off" moments: stored, listed newest first, capped at 300, words only (nothing named image, face or camera is kept,
//    whatever is sent), the visible text trimmed to 600, and counted for the week.
// Imported by router.test.mjs (one line), as kernel-yes.test.mjs is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: [at('../src/health.ts'), at('../src/why.ts'), at('../../../packages/shared/src/health.ts')],
  bundle: true, format: 'esm', platform: 'neutral', external: ['cloudflare:sockets'], outdir: at('./.build/health'), outbase: at('../../..'), outExtension: { '.js': '.mjs' }, logLevel: 'warning',
});
const H = await import('./.build/health/apps/edge/src/health.mjs');
const Y = await import('./.build/health/apps/edge/src/why.mjs');
const S = await import('./.build/health/packages/shared/src/health.mjs');

class Mem {
  m = new Map();
  async get(k) { return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { this.m.set(k, structuredClone(v)); }
  async delete(k) { return this.m.delete(k); }
  async list() { return new Map(); }
}
const NOW = Date.UTC(2026, 10, 12, 14, 30);
const HOUR = 3_600_000;
const deps = (storage, held = {}) => ({ storage, vault: { get: async (n) => held[n] ?? null }, now: () => NOW });

test('the four marks, from every combination of a missing key, reach, a failed run and a stale feed', () => {
  const bools = [false, true];
  let n = 0;
  for (const key of bools) for (const reach of bools) for (const failure of bools) for (const stale of bools) {
    const want = key ? 'NEEDS KEY' : !reach ? 'OFFLINE' : failure || stale ? 'DEGRADED' : 'WORKING';
    assert.equal(S.markOf({ key, reach, failure, stale }), want, JSON.stringify({ key, reach, failure, stale }));
    n++;
  }
  assert.equal(n, 16);
  assert.equal(S.markOf({ key: false, reach: true, failure: false, stale: false, fallback: true }), 'DEGRADED', 'a fallback in use is DEGRADED');
  // every mark is a word, so none is a colour alone
  assert.deepEqual([...S.MARKS].sort(), ['DEGRADED', 'NEEDS KEY', 'OFFLINE', 'WORKING']);
});

test('feeds go stale at their own ages: weather 3 hours, news 6, markets a day, the MOT record a month', () => {
  const ago = (ms) => NOW - ms;
  assert.equal(S.stale('weather', ago(2.9 * HOUR), NOW), false);
  assert.equal(S.stale('weather', ago(3.1 * HOUR), NOW), true);
  assert.equal(S.stale('news', ago(5.9 * HOUR), NOW), false);
  assert.equal(S.stale('news', ago(6.1 * HOUR), NOW), true);
  assert.equal(S.stale('markets', ago(23 * HOUR), NOW), false);
  assert.equal(S.stale('markets', ago(25 * HOUR), NOW), true);
  assert.equal(S.stale('mot', ago(29 * 24 * HOUR), NOW), false);
  assert.equal(S.stale('mot', ago(31 * 24 * HOUR), NOW), true);
  assert.equal(S.stale('weather', 0, NOW), false, 'never read is not "stale": there is nothing to be old');
});

test('the health object from a seeded trail: a group failing, a group back since, a feed past its staleness', async () => {
  const st = new Mem();
  const trails = [
    // the web failed an hour ago and has not gone right since
    { at: NOW - 3 * HOUR, asked: 'news', steps: [{ tool: 'web_search', ok: true }] },
    { at: NOW - HOUR, asked: 'weather', steps: [{ tool: 'web_search', ok: false, note: 'fetch failed: ECONNRESET' }] },
    // the agenda failed two hours ago, then went right ten minutes ago
    { at: NOW - 2 * HOUR, asked: 'remind', steps: [{ tool: 'set_reminder', ok: false, note: 'HTTP 503 from the store' }] },
    { at: NOW - 10 * 60_000, asked: 'remind', steps: [{ tool: 'set_reminder', ok: true }] },
  ];
  await st.put(Y.WHY_KEY, trails);
  await st.put('guardian:watch', { places: {}, told: {}, checked: { flood: NOW - 30 * 60_000, weather: NOW - 5 * HOUR, crime: NOW - HOUR }, failed: { weather: 'fetch failed: the Met Office is down' } });
  const h = await H.buildHealth(deps(st));
  const web = Object.entries(h.groups).find(([, v]) => v.fail?.kind === 'network' && (v.ok ?? 0) < v.fail.at);
  assert.ok(web, `the web group fails: ${JSON.stringify(h.groups)}`);
  const agenda = h.groups.agenda;
  assert.ok(agenda?.ok > agenda?.fail?.at, `the agenda group went right after it failed: ${JSON.stringify(agenda)}`);
  assert.equal(S.groupState(web[1], NOW).failing, true);
  assert.equal(S.groupState(web[1], NOW).kind, 'network');
  assert.equal(S.groupState(agenda, NOW).failing, false);
  assert.equal(S.groupState(agenda, NOW).back, NOW - 10 * 60_000, 'back since ten minutes ago');
  assert.equal(S.groupState(agenda, NOW + 2 * HOUR).back, undefined, 'the "back since" is said for an hour');
  const weather = h.feeds.find((f) => f.id === 'weather');
  assert.equal(weather.failed, 'network');
  assert.equal(S.stale('weather', weather.at, NOW), true, 'the weather feed is 5 hours old');
  assert.equal(S.stale('flood', h.feeds.find((f) => f.id === 'flood').at, NOW), false);
  // a failure is a kind, never the text
  assert.ok(!/ECONNRESET|HTTP 503|Met Office is down/.test(JSON.stringify(h)), 'no raw error text in the answer');
});

test('a key is named and never its value', async () => {
  const st = new Mem();
  const SECRET = 'AIzaSy-THE-VALUE-THAT-MUST-NEVER-LEAVE-123456';
  const h = await H.buildHealth(deps(st, { gemini: SECRET, github: 'github_pat_ANOTHER_SECRET_VALUE_987' }));
  const text = JSON.stringify(h);
  assert.ok(!text.includes(SECRET) && !text.includes('ANOTHER_SECRET_VALUE'), 'a planted value is in the answer');
  assert.deepEqual(h.keys.find((k) => k.name === 'gemini'), { name: 'gemini', label: 'Gemini', set: true });
  assert.equal(h.keys.find((k) => k.name === 'github').set, true);
  assert.equal(h.keys.find((k) => k.name === 'dvsa_mot')?.set, false, 'a key the brain does not have is named and missing');
  // through the route too
  const r = await H.healthRoute(new Request('https://x/guardian/health'), '/guardian/health', 'GET', deps(st, { gemini: SECRET }));
  assert.ok(!(await r.text()).includes(SECRET));
  // a vault that cannot be read counts as missing, not as an error
  const bad = await H.buildHealth({ ...deps(st), vault: { get: async () => { throw new Error('vault sealed'); } } });
  assert.ok(bad.keys.every((k) => k.set === false));
});

test('"that felt off": stored, listed newest first, capped at 300, words only', async () => {
  const st = new Mem();
  const sent = {
    screen: 'agenda', did: ['opened the Agenda', 'asked for a reminder', 'said done', 'a fourth thing that is cut'], text: `${'x'.repeat(900)}`,
    marks: { 'g:agenda': 'DEGRADED', 'g:web': 'bogus' }, hour: 14, words: 'it said done and nothing was there',
    image: 'data:image/png;base64,AAAA', face: [1, 2, 3], camera: 'front', photo: 'x', frame: 'y',
  };
  const m = await H.addFelt(st, sent, NOW);
  assert.ok(m, 'a moment is kept');
  assert.equal(m.text.length, 600, 'the visible text is trimmed to 600');
  assert.deepEqual(m.did.length, 3, 'the last three things he did');
  assert.deepEqual(m.marks, { 'g:agenda': 'DEGRADED' }, 'only real marks');
  const kept = JSON.stringify(await st.get(H.FELT_KEY));
  assert.ok(!/image|face|camera|photo|frame|data:image/i.test(kept), `a picture field was kept: ${kept.slice(0, 200)}`);
  assert.equal(await H.addFelt(st, { text: 'no screen' }, NOW), null, 'a moment with no screen is not kept');
  for (let i = 0; i < 310; i++) await H.addFelt(st, { screen: `s${i}`, text: `t${i}`, hour: 9 }, NOW + i * 1000);
  const l = await H.feltList(st, NOW + 400_000);
  assert.equal(l.moments.length, 300, 'the last 300');
  assert.equal(l.moments[0].screen, 's309', 'newest first');
  assert.equal(l.week, 300);
  // through the routes
  const post = await H.healthRoute(new Request('https://x/guardian/feltoff', { method: 'POST', body: JSON.stringify({ screen: 'brief', text: 'hello', hour: 8, image: 'AAAA' }) }), '/guardian/feltoff', 'POST', deps(st));
  assert.equal(post.status, 200);
  const bad = await H.healthRoute(new Request('https://x/guardian/feltoff', { method: 'POST', body: '{}' }), '/guardian/feltoff', 'POST', deps(st));
  assert.equal(bad.status, 400);
  const list = await (await H.healthRoute(new Request('https://x/guardian/feltoff'), '/guardian/feltoff', 'GET', deps(st))).json();
  assert.equal(list.moments[0].screen, 'brief');
  assert.ok(!/image|AAAA/.test(JSON.stringify(list)));
  // the Sunday note's line
  assert.equal(H.feltLine({ week: 7, top: { screen: 'agenda', n: 3 } }, () => 'the Agenda'), '7 moments felt off this week; the most on the Agenda.');
  assert.equal(H.feltLine({ week: 0 }), '');
});

test('the top line and the Brief\'s line count right', () => {
  assert.equal(S.topLine(['WORKING', 'WORKING']), 'Everything is working.');
  assert.equal(S.topLine(['WORKING', 'DEGRADED', 'NEEDS KEY']), '2 things need you.');
  assert.equal(S.topLine(['WORKING', 'DEGRADED']), '1 thing needs you.');
  assert.equal(S.topLine(['WORKING', 'WORKING', 'OFFLINE'], true), 'Offline: 2 of 3 things still work.');
  assert.equal(S.topLine(['WORKING', 'WORKING', 'OFFLINE']), '1 thing needs you.', 'one dead feed with the brain reachable is a thing that needs him');
  assert.equal(S.briefLine(['WORKING', 'OFFLINE'], true), '', 'with no signal the Brief says nothing about what the signal explains');
  assert.equal(S.briefLine(['WORKING']), '');
  assert.equal(S.briefLine(['DEGRADED', 'NEEDS KEY']), '2 things need you.');
});
