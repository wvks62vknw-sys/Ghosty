// The stopwatch (SPEED, part 1): the brain's ring and daily medians (speed.ts), its plain-words
// lines, the router's timing hooks, and the phone's medians (apps/web/src/core/stopwatch.ts).
// Run from router.test.mjs (package.json is protected, so no new file in the test list).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const here = (p) => new URL(p, import.meta.url).pathname;
await build({ entryPoints: [here('../src/speed.ts')], bundle: true, format: 'esm', platform: 'neutral', outfile: here('./.build/speed.mjs'), logLevel: 'warning' });
await build({ entryPoints: [here('../../web/src/core/stopwatch.ts')], bundle: true, format: 'esm', platform: 'neutral', outfile: here('./.build/stopwatch.mjs'), logLevel: 'warning' });
const S = await import('./.build/speed.mjs');
const W = await import('./.build/stopwatch.mjs');
const R = await import('./.build/llm/router.mjs');

class MemStorage {
  m = new Map();
  puts = 0;
  async get(k) { return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { this.puts++; this.m.set(k, structuredClone(v)); }
  async delete(k) { return this.m.delete(k); }
}
const settle = () => new Promise((r) => setTimeout(r, 5));
const DAY = 86_400_000;
const NOON = Date.parse('2026-10-20T12:00:00Z');

test('speed: quantiles, the ring of 300, and one write a minute at most', async () => {
  assert.equal(S.quantile([5, 1, 4, 2, 3], 0.5), 3);
  assert.equal(S.quantile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9), 9);
  assert.deepEqual(S.stat([]), null);
  let now = NOON;
  const storage = new MemStorage();
  const sw = new S.Stopwatch(storage, () => now);
  for (let i = 0; i < 320; i++) {
    sw.model({ provider: 'Groq', model: 'llama', first: 100 + i, ms: 200 + i, ok: true, chat: true });
    now += 100; // 32 s in all: still inside the first minute
  }
  await settle();
  assert.equal(storage.puts, 1, 'the first entry is saved at once, the rest wait for the minute');
  now += 60_000;
  sw.tool('weather', 600);
  await settle();
  assert.equal(storage.puts, 2, 'a minute later, one more write');
  const kept = storage.m.get(S.SPEED_KEY);
  assert.equal(kept.ring.length, S.RING, 'the ring keeps the last 300');
  assert.equal(kept.ring.at(-1).k, 't');
  assert.equal(kept.ring[0].f, 100 + 21, 'the oldest fell out');
  // a new brain picks up where the last one left off, and what it times meanwhile is kept too
  const again = new S.Stopwatch(storage, () => now);
  again.tool('weather', 400);
  await again.load();
  const sum = again.summary();
  assert.deepEqual(sum.today.tools, [{ name: 'weather', median: 400, n: 2 }]);
  assert.equal(sum.today.firstToken.n, 120, "today's samples are capped (the newest kept)");
});

test('speed: a new day folds into daily medians per provider and per tool, 14 days kept', async () => {
  let now = NOON - 20 * DAY;
  const sw = new S.Stopwatch(null, () => now);
  for (let d = 0; d < 20; d++) {
    sw.model({ provider: 'Groq', model: 'llama', first: 1000 + d, ms: 2000, tokens: 400, ok: true, chat: true });
    sw.model({ provider: 'Gemini', model: 'flash', first: 3000, ms: 5000, ok: true, chat: true });
    sw.model({ provider: 'Gemini', model: 'flash', first: 90_000, ms: 90_000, ok: false, chat: true });
    sw.tool('web_search', 2300);
    now += DAY;
  }
  const s = sw.summary();
  assert.equal(sw['days'].length, S.KEEP_DAYS);
  const y = sw['days'].at(-1);
  assert.equal(y.day, new Date(NOON - DAY).toISOString().slice(0, 10));
  assert.deepEqual(y.providers.map((p) => p.provider), ['Groq', 'Gemini'], 'fastest first');
  assert.equal(y.providers[0].tps, 200, 'tokens a second from the provider\'s count over the call');
  assert.equal(y.providers[1].total, 5000, 'a failed call is left out of the medians');
  assert.deepEqual(y.tools, [{ name: 'web_search', median: 2300, n: 1 }]);
  assert.equal(s.today.firstToken, null, 'nothing timed today yet');
  assert.equal(s.week.firstToken.median, 1016, 'the week: the middle of the last 7 daily medians');
  assert.equal(s.lines[0], 'No model calls timed yet today · last week the first word came in 1.0 s');
});

test('speed: the plain-words lines and where the time goes', () => {
  const now = NOON;
  const sw = new S.Stopwatch(null, () => now);
  for (const f of [1400, 1500, 3900, 4200]) sw.model({ provider: 'Gemini', model: 'flash', first: f, ms: f + 900, ok: true, chat: true });
  for (const f of [900, 1000]) sw.model({ provider: 'Groq', model: 'llama', first: f, ms: f + 100, ok: true, chat: true });
  sw.tool('web_search', 2300);
  sw.tool('weather', 600);
  sw.tool('library_search', 80);
  sw.turn({ ms: 6800, wait: 300, model: 4100, tools: 1900, calls: 2 });
  sw.turn({ ms: 6800, wait: 300, model: 4100, tools: 1900, calls: 2 });
  const s = sw.summary();
  assert.equal(s.today.firstToken.median, 1400);
  assert.equal(s.today.firstToken.p90, 4200);
  assert.deepEqual(s.lines, [
    'First word in 1.4 s (median), 4.2 s at the slow end · Groq fastest today',
    "Replies take 6.8 s in the brain (today's median, 2 replies)",
    "Where a reply's time goes (average): the model 4.1 s, tools 1.9 s, waiting for free room 0.3 s, the rest 0.5 s",
    'Tools: web search 2.3 s, weather 0.6 s, library search 80 ms',
  ]);
  assert.equal(S.dur(84), '84 ms');
  assert.equal(S.dur(65_000), '1 min 5 s');
  assert.equal(s.recent[0].k, 'r', 'newest first');
});

test('speed: the router times each call with its provider and the wait, and a turn with its tools', async () => {
  let n = 0;
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    if (n++ === 0) return new Response('{"error":{"message":"rate limit"}}', { status: 429, headers: { 'retry-after': '1' } });
    const msg = n === 2 ? { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'weather', arguments: '{}' } }] } : { role: 'assistant', content: `hi from ${body.model}` };
    return new Response(JSON.stringify({ choices: [{ message: msg }], usage: { total_tokens: 900, completion_tokens: 50 } }), { headers: { 'content-type': 'application/json' } });
  };
  const storage = new MemStorage();
  const r = new R.Router(storage, { get: async (k) => (k === 'gemini' ? 'g' : null), has: async (k) => k === 'gemini' }, {});
  const turn = new AbortController();
  const first = await r.complete([{ role: 'user', content: 'weather?' }], [{ type: 'function', function: { name: 'weather', description: 'x', parameters: {} } }], turn.signal);
  assert.equal(first.message.tool_calls[0].function.name, 'weather');
  await new Promise((ok) => setTimeout(ok, 80)); // the tool at work
  await r.complete([{ role: 'user', content: 'weather?' }, first.message, { role: 'tool', tool_call_id: 'c1', content: 'sunny' }], [], turn.signal);
  const s = await R.speedSummary(storage);
  const calls = s.recent.filter((x) => x.k === 'm').reverse();
  assert.equal(calls.length, 3, 'the refused call and both answers');
  assert.equal(calls[0].bad, 1, 'the rate-limited call is kept, marked');
  assert.equal(calls[1].p, 'Gemini');
  assert.equal(calls[1].m, 'gemini-3.8-flash');
  assert.ok(calls[1].w >= 1000, `it says it waited for the rate limit (${calls[1].w} ms)`);
  assert.ok(calls[1].f <= calls[1].ms);
  assert.ok(calls[2].w === 0, 'the next call did not wait');
  const tool = s.recent.find((x) => x.k === 't');
  assert.equal(tool.name, 'weather');
  assert.ok(tool.ms >= 70, `the tool's time is the gap between the calls (${tool.ms} ms)`);
  const t = s.recent.find((x) => x.k === 'r');
  assert.ok(t, 'the turn was timed');
  assert.equal(t.calls, 2);
  assert.ok(t.wait >= 1000 && t.tools >= 70 && t.ms >= t.wait + t.tools, JSON.stringify(t));
  assert.equal(s.today.providers[0].provider, 'Gemini');
  assert.match(s.lines.join('\n'), /Tools: weather/);
  assert.ok(storage.m.get('speed:ring'), 'kept in the database');
});

test("stopwatch (phone): medians per screen, for replies, the start and the round trip, in plain words", () => {
  const now = Date.parse('2026-10-20T15:00:00');
  const at = (h) => now - h * 3600_000;
  const s = [
    { k: 'start', at: at(5), paint: 600, screen: 1200 },
    { k: 'tab', at: at(4), id: 'eye', title: "GOD'S EYE", ms: 400, first: 1 },
    { k: 'tab', at: at(3), id: 'eye', title: "GOD'S EYE", ms: 300 },
    { k: 'tab', at: at(3), id: 'eye', title: "GOD'S EYE", ms: 500 },
    { k: 'tab', at: at(2), id: 'library', title: 'LIBRARY', ms: 300 },
    { k: 'tab', at: at(2), id: 'workshop', title: 'WORKSHOP', ms: 1100 },
    { k: 'reply', at: at(1), first: 1400, done: 6800 },
    { k: 'reply', at: at(1), first: 1300, done: 7000 },
    { k: 'reply', at: at(1), first: 1500, done: 6000 },
    { k: 'reply', at: now - 3 * 86_400_000, first: 2100, done: 8000 },
    { k: 'reply', at: now - 30 * 86_400_000, first: 9000, done: 9000 },
    { k: 'trip', at: at(1), path: '/status', ms: 84 },
    { k: 'trip', at: at(1), path: '/status', ms: 90 },
    { k: 'trip', at: at(1), path: '/agenda', ms: 70 },
    { k: 'trip', at: at(1), path: '/library', ms: 1200 },
  ];
  const sum = W.summarise(s, now);
  assert.deepEqual(sum.screens.map((x) => [x.id, x.median, x.n]), [['eye', 400, 3], ['library', 300, 1], ['workshop', 1100, 1]]);
  assert.equal(sum.replies.today.first.median, 1400);
  assert.equal(sum.replies.week.done.median, 8000, 'last week, not a month ago');
  assert.deepEqual(sum.lines, [
    "Replies: first word in 1.4 s, done in 6.8 s (today's medians, 3 replies) · last week 2.1 s / 8.0 s",
    "Screens: God's Eye opens in 0.4 s, Library 0.3 s, Workshop 1.1 s (slowest)",
    'Start: first paint 0.6 s, first screen 1.2 s (median of 1 start)',
    'Brain round trip 84 ms · slowest: /library 1.2 s',
  ]);
  // the newest 500 kept, round trips at most 150 of them
  let list = [];
  for (let i = 0; i < 400; i++) list = W.keep(list, { k: 'trip', at: i, path: '/status', ms: i });
  for (let i = 0; i < 400; i++) list = W.keep(list, { k: 'tab', at: i, id: 'eye', title: 'EYE', ms: i });
  assert.equal(list.length, W.KEEP);
  assert.equal(list.filter((x) => x.k === 'trip').length, 100, 'trips only ever 150, and the oldest go first');
  assert.equal(list.at(-1).ms, 399);
});

test('speed: the scripted mock (the tests and the preview) is timed like a real model, as provider Mock', async () => {
  const storage = new MemStorage();
  const r = new R.Router(storage, { get: async () => null, has: async () => false }, { MOCK_LLM: '1' });
  const turn = new AbortController();
  const out = await r.complete([{ role: 'user', content: 'hello' }], [], turn.signal);
  assert.ok(out.message.content, 'the mock answered');
  const s = await R.speedSummary(storage);
  const call = s.recent.find((x) => x.k === 'm');
  assert.ok(call, 'the mock call was timed');
  assert.equal(call.p, 'Mock');
  assert.ok(!call.bad && !call.bg, 'an answered call for the owner');
  assert.ok(s.recent.some((x) => x.k === 'r' && x.calls === 1), 'and its turn');
  assert.equal(s.today.firstToken?.n, 1);
  assert.match(s.lines[0], /^First word in /);
});
