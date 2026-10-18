// Tools working together, with live progress: a tool at work reports what it is doing under
// its own call (between its `tool` and `tool_result`); several read-only calls in one model
// message run together, their results arriving as each finishes; a write among them keeps the
// model's order; a chain of tools runs in one turn, one result feeding the next. The brain is
// bundled with the scripted mock model and an in-memory Durable Object; the web is faked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { sqlStorage } from '../../../tests/sqlite-storage.mjs';

const B = process.env.PROGRESS_BUILD ?? './.build';
const mod = await import(`${B}/brain.mjs`);
const T = await import(`${B}/tools/index.mjs`);
const worker = mod.default;
const { GhostyAgent } = mod;

class MemStorage {
  m = new Map();
  /** True: every read and write throws the free plan's "allowance used up" error, as a paused database does. */
  down = false;
  constructor(sql = false) {
    if (sql) this.sql = sqlStorage();
  }
  check() {
    if (this.down) throw new Error('Exceeded allowed rows read in Durable Objects free tier.');
  }
  async get(k) {
    this.check();
    if (Array.isArray(k)) return new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))]));
    return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined;
  }
  async put(k, v) {
    this.check();
    if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b));
    else this.m.set(k, structuredClone(v));
  }
  async delete(k) {
    this.check();
    if (Array.isArray(k)) return k.filter((x) => this.m.delete(x)).length;
    return this.m.delete(k);
  }
  async list({ prefix = '' } = {}) {
    this.check();
    return new Map([...this.m].filter(([k]) => k.startsWith(prefix)).sort().map(([k, v]) => [k, structuredClone(v)]));
  }
  async setAlarm() {}
  async getAlarm() { return null; }
}

const OWNER_KEY = 'test-owner-key-0123456789abcdef';
const pending = [];
const state = { storage: new MemStorage(), waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() };
const env = { OWNER_KEY, VAULT_KEY: Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString('base64'), MOCK_LLM: '1' };
let agent;
env.AGENT = { idFromName: (n) => ({ toString: () => n }), get: () => ({ fetch: (r) => (agent ??= new GhostyAgent(state, env)).fetch(r) }) };
const ctx = { waitUntil: (p) => pending.push(p), passThroughOnException() {} };

const call = (path, init = {}) => worker.fetch(new Request(`https://ghosty.test${path}`, { ...init, headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': OWNER_KEY, ...(init.headers ?? {}) } }), env, ctx);

async function chat(message) {
  const r = await call('/api/chat', { method: 'POST', body: JSON.stringify({ message }) });
  assert.equal(r.status, 200, await r.clone().text());
  const text = await r.text();
  await Promise.allSettled(pending.splice(0));
  return text.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

/** A brain of its own on the storage given (SQLite for the library, or a paused database), reached through the Worker like the one above. */
function agentWith(storage) {
  const st = { storage, waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() };
  const e2 = { ...env };
  let a2;
  e2.AGENT = { idFromName: (n) => ({ toString: () => n }), get: () => ({ fetch: (r) => (a2 ??= new GhostyAgent(st, e2)).fetch(r) }) };
  const go = (path, init = {}) => worker.fetch(new Request(`https://ghosty.test${path}`, { ...init, headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': OWNER_KEY, ...(init.headers ?? {}) } }), e2, ctx);
  return {
    go,
    async chat(message) {
      const r = await go('/api/chat', { method: 'POST', body: JSON.stringify({ message }) });
      assert.equal(r.status, 200, await r.clone().text());
      const text = await r.text();
      await Promise.allSettled(pending.splice(0));
      return text.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
    },
  };
}

const page = (title) => new Response(`<html><head><title>${title}</title></head><body><p>${title} body text.</p></body></html>`, { headers: { 'content-type': 'text/html' } });
/** Two pages: the slow one answers well after the quick one (slow2.example and quick2.example too: a page read moments ago is reused, so a test that times reads uses addresses of its own). */
function slowAndQuick() {
  globalThis.fetch = (input) => {
    const url = typeof input === 'string' ? input : input.url;
    if (/^https:\/\/slow\d*\.example\/$/.test(url)) return new Promise((ok) => setTimeout(() => ok(page('Slow page')), 80));
    if (/^https:\/\/quick\d*\.example\/$/.test(url)) return new Promise((ok) => setTimeout(() => ok(page('Quick page')), 5));
    return Promise.reject(new TypeError(`fetch failed: tests have no network (${url})`));
  };
}
const byId = (ev, id) => ev.filter((e) => e.id === id).map((e) => (e.t === 'progress' ? `progress: ${e.label}` : e.t));

test('a tool at work reports progress under its own call, between its tool and tool_result events', async () => {
  slowAndQuick();
  const ev = await chat('read https://slow.example/ and https://quick.example/ together');
  const tools = ev.filter((e) => e.t === 'tool');
  assert.equal(tools.length, 2);
  for (const t of tools) {
    assert.deepEqual(byId(ev, t.id), ['tool', `progress: fetching ${new URL(t.args.url).hostname}…`, 'progress: reading…', 'tool_result'], 'the same id, in order');
    for (const p of ev.filter((e) => e.t === 'progress' && e.id === t.id)) assert.equal(p.name, 'web_fetch');
  }
  assert.ok(ev.filter((e) => e.t === 'progress').every((p) => tools.some((t) => t.id === p.id)), 'progress always belongs to a call');
  assert.deepEqual(ev.map((e) => e.t).filter((t) => t !== 'status' && t !== 'progress').slice(-2), ['text', 'done'], 'the stream still ends text → done');
});

test('two read-only calls in one model message run together: results arrive as each finishes', async () => {
  slowAndQuick();
  const ev = await chat('read https://slow2.example/ and https://quick2.example/ together');
  const tools = ev.filter((e) => e.t === 'tool');
  assert.deepEqual(tools.map((e) => e.args.url), ['https://slow2.example/', 'https://quick2.example/'], 'both started, in the order the model gave');
  const results = ev.filter((e) => e.t === 'tool_result');
  assert.ok(results.every((r) => r.ok), JSON.stringify(results));
  assert.deepEqual(results.map((r) => tools.find((t) => t.id === r.id).args.url), ['https://quick2.example/', 'https://slow2.example/'], 'the quick one answers first');
  assert.ok(ev.findIndex((e) => e.t === 'tool' && e.args?.url === 'https://quick2.example/') < ev.findIndex((e) => e.t === 'tool_result'), 'the second read started before the first finished');
  // The model reads every result, in the order it asked for them, whichever finished first.
  const saved = state.storage.m.get('ctx');
  const asked = [...saved].reverse().find((m) => m.role === 'assistant' && m.tool_calls);
  const answers = saved.slice(saved.indexOf(asked) + 1).filter((m) => m.role === 'tool');
  assert.deepEqual(answers.map((m) => m.tool_call_id), asked.tool_calls.map((c) => c.id));
  assert.match(answers[0].content, /Slow page/);
  assert.match(answers[1].content, /Quick page/);
  assert.match(ev.find((e) => e.t === 'text').text, /Done/);
});

test('a call that writes among them keeps everything in the order the model gave', async () => {
  slowAndQuick();
  const ev = await chat('read https://slow.example/ and https://quick.example/ together and remember them');
  const tools = ev.filter((e) => e.t === 'tool');
  assert.deepEqual(tools.map((e) => e.name), ['web_fetch', 'remember', 'web_fetch']);
  const results = ev.filter((e) => e.t === 'tool_result');
  assert.deepEqual(results.map((r) => r.id), tools.map((t) => t.id), 'each finishes before the next starts');
  assert.ok(ev.findIndex((e) => e.t === 'tool' && e.name === 'remember') > ev.findIndex((e) => e.t === 'tool_result'), 'the slow read finished before the write began');
  assert.ok(results.every((r) => r.ok));
  const mem = await (await call('/api/memory')).json();
  assert.ok(mem.facts.some((f) => /slow\.example/.test(f.text)), 'the write happened');
});

test('a chain of 12 tool steps fits in one turn (the step cap leaves room for real work)', async () => {
  const ev = await chat('chain 12 steps');
  assert.equal(ev.filter((e) => e.t === 'tool' && e.name === 'list_memory').length, 12);
  assert.equal(ev.filter((e) => e.t === 'tool_result' && e.ok).length, 12);
  assert.equal(ev.filter((e) => e.t === 'done').length, 1, 'one turn');
  assert.match(ev.find((e) => e.t === 'text').text, /Done after 12 steps/);
});

test('the mock chains "recon then save": one tool\'s result is the next one\'s input, in one turn', async () => {
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url === 'https://example.com/') return page('Example Domain');
    throw new TypeError(`fetch failed: tests have no network (${url})`);
  };
  const ev = await chat('recon then save example.com');
  const tools = ev.filter((e) => e.t === 'tool');
  if (T.toolByName.has('recon_domain')) {
    assert.equal(tools[0].name, 'recon_domain');
    assert.deepEqual(tools[0].args, { target: 'example.com', save: true });
  } else {
    assert.deepEqual(tools.map((t) => t.name), ['web_fetch', 'learn_lesson']);
    assert.match(tools[1].args.text, /Example Domain/, "what the page said is the lesson's text");
    assert.ok(ev.filter((e) => e.t === 'tool_result').every((r) => r.ok), JSON.stringify(ev));
    const { lessons } = await (await call('/api/lessons')).json();
    assert.ok(lessons.some((l) => /Example Domain/.test(l.text)), 'filed');
  }
  assert.equal(ev.filter((e) => e.t === 'done').length, 1, 'one turn');
  assert.match(ev.find((e) => e.t === 'text').text, /example\.com/);
});

test('the read-only tools are marked pure; anything that writes, publishes or needs approval is not', () => {
  for (const n of ['web_search', 'web_fetch', 'library_search', 'library_list', 'study_progress', 'weather', 'earthquakes', 'motorway_now', 'transit_now', 'traffic_now', 'show_cameras', 'list_sites']) assert.equal(T.toolByName.get(n)?.pure, true, n);
  for (const n of ['remember', 'learn_lesson', 'library_import', 'draft_site', 'publish_site', 'send_email', 'ship_change', 'create_widget', 'fly_to']) assert.ok(!T.toolByName.get(n)?.pure, n);
});

test('library_import and library_export say which file they are on (n of N)', async () => {
  const { Library } = await import(`${B}/library/store.mjs`);
  const { importSource } = await import(`${B}/library/importers.mjs`);
  const { exportLibrary } = await import(`${B}/library/export.mjs`);
  const lib = new Library(new MemStorage(true), {});
  const routes = [
    [/api\.github\.com\/repos\/me\/tiny\/git\/trees/, JSON.stringify({ tree: [{ path: 'README.md', type: 'blob', size: 100 }, { path: 'src/main.py', type: 'blob', size: 100 }] }), 'application/json'],
    [/raw\.githubusercontent\.com\/me\/tiny\/HEAD\/README\.md/, '# Tiny\n\nTiny counts words in files.', 'text/plain'],
    [/raw\.githubusercontent\.com\/me\/tiny\/HEAD\/src\/main\.py/, 'def count_words(path):\n    return 1\n', 'text/plain'],
    [/example\.com\/guide/, '<html><head><title>Sourdough Guide</title></head><body><p>Feed the starter daily.</p></body></html>', 'text/html'],
  ];
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    const hit = routes.find(([re]) => re.test(url));
    return hit ? new Response(hit[1], { headers: { 'content-type': hit[2] } }) : new Response('not found', { status: 404 });
  };
  const seen = [];
  await importSource(lib, 'me/tiny', { onProgress: (label, done, total) => seen.push([label, done, total]) });
  assert.deepEqual(seen, [['listing me/tiny…', undefined, undefined], ['README.md', 1, 2], ['src/main.py', 2, 2]]);
  seen.length = 0;
  await importSource(lib, 'https://example.com/guide', { onProgress: (label, done, total) => seen.push([label, done, total]) });
  assert.deepEqual(seen, [['fetching example.com…', undefined, undefined], ['reading the page…', undefined, undefined]]);
  // export: gathering each notebook, then the commit
  lib.createDoc({ id: 'read_physics', title: 'Reading: Physics', source: 'self-study', kind: 'study' });
  await lib.addPassages('read_physics', [{ text: 'Forces change motion.', heading: 'Newton' }]);
  lib.finish('read_physics');
  const g = {
    defaultBranch: async () => 'main',
    headSha: async (b) => (b === 'main' ? 'base0' : Promise.reject(new Error('404'))),
    createBranch: async () => undefined,
    commitStaged: async () => 'sha1',
    moveBranch: async () => undefined,
  };
  seen.length = 0;
  await exportLibrary(g, lib, 'o/r', { onProgress: (label, done, total) => seen.push([label, done, total]) });
  assert.deepEqual(seen, [['gathering Reading: Physics…', 1, 1], ['writing 1 file to GitHub…', undefined, undefined]]);
});

test('draft_site and publish_site say which part they are on', async () => {
  const storage = new MemStorage();
  const seen = [];
  const tctx = { storage, env: {}, origin: 'https://ghosty.example', emit: () => undefined, progress: (label, done, total) => seen.push([label, done, total]) };
  const part = '<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Parts</title></head>';
  await T.toolByName.get('draft_site').run({ name: 'parts', html_part: part }, tctx);
  await T.toolByName.get('draft_site').run({ name: 'parts', html_part: '<body><h1>Two</h1></body></html>' }, tctx);
  assert.deepEqual(seen.map((s) => s[0]), ['keeping this part of "parts" (1 KB)…', '1 part kept, 1 KB so far', 'keeping this part of "parts" (1 KB)…', '2 parts kept, 1 KB so far']);
  seen.length = 0;
  const out = await T.toolByName.get('publish_site').run({ name: 'parts', from_draft: true }, tctx);
  assert.match(out, /live now at https:\/\/ghosty\.example\/s\/parts/);
  assert.deepEqual(seen.map((s) => s[0]), ['joining the parts of the draft…', 'checking the page (1 KB)…', 'publishing "Parts"…']);
});

test('the chat row: "crt.sh… 3 of 7", a bar only when the total is known', async () => {
  const { progressOf, progressText, progressRatio } = await import(`${B}/progress.mjs`);
  const p = progressOf({ t: 'progress', id: 'x', name: 'cert_search', label: '  crt.sh…  ', done: 3, total: 7 });
  assert.deepEqual(p, { label: 'crt.sh…', done: 3, total: 7 });
  assert.equal(progressText(p), 'crt.sh… 3 of 7');
  assert.equal(progressRatio(p), 3 / 7);
  assert.equal(progressText(progressOf({ label: 'reading…' })), 'reading…');
  assert.equal(progressRatio(progressOf({ label: 'reading…' })), null, 'no bar without a total');
  assert.equal(progressText(progressOf({ label: 'page', done: 2 })), 'page (2)');
  assert.equal(progressRatio(progressOf({ label: 'x', done: 9, total: 4 })), 1, 'never past the end');
  assert.deepEqual(progressOf({ label: 'x', done: -1, total: 0 }), { label: 'x' }, 'nonsense counts dropped');
  assert.deepEqual(progressOf({ label: 'x', done: '3', total: NaN }), { label: 'x' });
  assert.equal(progressOf({ label: 'a'.repeat(300) }).label.length, 120, 'one line');
  assert.equal(progressOf({ label: 'two\n  lines' }).label, 'two lines');
});
