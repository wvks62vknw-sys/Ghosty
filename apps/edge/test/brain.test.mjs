// End-to-end test of the bundled brain with an in-memory Durable Object and the
// scripted mock model. Run: npm test  (bundles src/ first, then runs node --test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

const mod = await import(process.env.BRAIN_BUNDLE ?? './.build/brain.mjs');
const worker = mod.default;
const { GhostyAgent } = mod;

class MemStorage {
  m = new Map();
  async get(k) {
    if (Array.isArray(k)) return new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))]));
    return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined;
  }
  async put(k, v) {
    if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b));
    else this.m.set(k, structuredClone(v));
  }
  async delete(k) {
    if (Array.isArray(k)) return k.filter((x) => this.m.delete(x)).length;
    return this.m.delete(k);
  }
  async list({ prefix = '' } = {}) {
    return new Map([...this.m].filter(([k]) => k.startsWith(prefix)).sort().map(([k, v]) => [k, structuredClone(v)]));
  }
  async setAlarm() {}
  async getAlarm() { return null; }
}

const OWNER_KEY = 'test-owner-key-0123456789abcdef';
const pending = [];
const state = { storage: new MemStorage(), waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() };
const env = {
  OWNER_KEY,
  VAULT_KEY: Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString('base64'),
  MOCK_LLM: '1',
  OWNER_EMAIL: 'me@example.com',
};
let agent;
env.AGENT = { idFromName: (n) => ({ toString: () => n }), get: () => ({ fetch: (r) => (agent ??= new GhostyAgent(state, env)).fetch(r) }) };
const ctx = { waitUntil: (p) => pending.push(p), passThroughOnException() {} };

const call = (path, init = {}, key = OWNER_KEY) =>
  worker.fetch(new Request(`https://ghosty.test${path}`, { ...init, headers: { 'content-type': 'application/json', 'x-ghosty': '1', ...(key ? { 'x-ghosty-key': key } : {}), ...(init.headers ?? {}) } }), env, ctx);

async function chat(message, path = '/api/chat', body = { message }) {
  const r = await call(path, { method: 'POST', body: JSON.stringify(body) });
  assert.equal(r.status, 200, await r.clone().text());
  const text = await r.text();
  await Promise.allSettled(pending.splice(0));
  return text.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

test('health is public, everything else needs the owner', async () => {
  assert.equal((await call('/api/health', {}, null)).status, 200);
  assert.equal((await call('/api/status', {}, null)).status, 401);
  assert.equal((await call('/api/status', {}, 'wrong-key-wrong-key-wrong-key')).status, 401);
  assert.equal((await call('/api/status')).status, 200);
});

test('fails closed when nothing is configured', async () => {
  const r = await worker.fetch(new Request('https://ghosty.test/api/status'), { AGENT: env.AGENT }, ctx);
  assert.equal(r.status, 503);
});

test('hashed owner password and a self-made vault key (production setup)', async () => {
  const { createHash } = await import('node:crypto');
  const pw = 'hxg3u-test-password-0123456789';
  const st = { storage: new MemStorage(), waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() };
  const e2 = { OWNER_KEY_HASH: createHash('sha256').update(pw).digest('hex'), MOCK_LLM: '1' };
  let a2;
  e2.AGENT = { idFromName: (n) => n, get: () => ({ fetch: (r) => (a2 ??= new GhostyAgent(st, e2)).fetch(r) }) };
  e2.ASSETS = { fetch: async () => new Response('<html>interface</html>', { headers: { 'content-type': 'text/html' } }) };
  const go = (path, key, init = {}) => worker.fetch(new Request(`https://ghosty.me.workers.dev${path}`, { ...init, headers: { 'content-type': 'application/json', 'x-ghosty': '1', ...(key ? { 'x-ghosty-key': key } : {}) } }), e2, ctx);
  assert.equal((await (await go('/api/health')).json()).secured, true);
  assert.equal((await go('/api/status')).status, 401);
  assert.equal((await go('/api/status', 'wrong-password-wrong-password')).status, 401);
  assert.equal((await go('/api/status', e2.OWNER_KEY_HASH)).status, 401, 'the hash itself is not a password');
  assert.equal((await go('/api/status', pw)).status, 200);
  assert.match(await (await go('/', null)).text(), /interface/, 'non-API paths serve the interface');
  assert.equal((await go('/api/keys', pw, { method: 'POST', body: JSON.stringify({ name: 'groq', value: 'gsk-secret-value' }) })).status, 200);
  await Promise.allSettled(pending.splice(0));
  const raw = st.storage.m.get('vault:groq');
  assert.ok(raw && !raw.includes('secret'), 'encrypted with the self-made key');
  assert.ok(st.storage.m.get('vaultkey'), 'vault key created once');
  const status = await (await go('/api/status', pw)).json();
  assert.equal(status.keys.find((k) => k.name === 'groq').set, true);
  assert.equal(status.previews, '<change>-ghosty.me.workers.dev');
});

test('keys are stored encrypted and never returned', async () => {
  const r = await call('/api/keys', { method: 'POST', body: JSON.stringify({ name: 'gemini', value: 'AIza-secret-value' }) });
  assert.equal(r.status, 200);
  await Promise.allSettled(pending.splice(0));
  const raw = state.storage.m.get('vault:gemini');
  assert.ok(raw && !raw.includes('secret'), 'stored value must be ciphertext');
  const status = await (await call('/api/status')).json();
  assert.equal(status.keys.find((k) => k.name === 'gemini').set, true);
  assert.ok(!JSON.stringify(status).includes('AIza-secret-value'));
});

test('agent loop: remember tool then reply', async () => {
  const ev = await chat('remember I prefer my coffee black');
  assert.deepEqual(ev.map((e) => e.t).filter((t) => t !== 'status'), ['tool', 'tool_result', 'text', 'done']);
  const mem = await (await call('/api/memory')).json();
  assert.equal(mem.facts[0].text, 'i prefer my coffee black');
});

test('Ghosty learns lessons from experience and studies its handbook', async () => {
  let ev = await chat('learn TS2532 came from indexing an array without a fallback. Rule: always use arr[i]! or ?? for indexed values.');
  assert.match(ev.find((e) => e.t === 'tool_result').summary, /Learned/);
  ev = await chat('learn TS2532 came from indexing an array without fallback. Rule: always use arr[i]! or ?? for indexed values');
  assert.match(ev.find((e) => e.t === 'tool_result').summary, /already knew this/);
  let lessons = (await (await call('/api/lessons')).json()).lessons;
  assert.equal(lessons.length, 1);
  assert.equal(lessons[0].hits, 2);
  ev = await chat('study add a new tab');
  const r = ev.find((e) => e.t === 'tool_result');
  assert.ok(r.ok);
  assert.match(r.summary, /add a new tab/i);
  assert.equal((await call(`/api/lessons/${lessons[0].id}`, { method: 'DELETE' })).status, 200);
  lessons = (await (await call('/api/lessons')).json()).lessons;
  assert.equal(lessons.length, 0);
});

test('Ghosty plans an upgrade of itself and tracks it step by step', async () => {
  let ev = await chat('audit yourself');
  assert.match(ev.find((e) => e.t === 'tool_result').summary, /ABILITIES \(\d+ tools\): remember/);
  ev = await chat('plan upgrade');
  assert.match(ev.find((e) => e.t === 'tool_result').summary, /Roadmap saved/);
  ev = await chat('step 1 done #12');
  assert.match(ev.find((e) => e.t === 'tool_result').summary, /1\/3 steps done/);
  ev = await chat('step 9 done');
  assert.equal(ev.find((e) => e.t === 'tool_result').ok, false);
  const { roadmap } = await (await call('/api/roadmap')).json();
  assert.equal(roadmap.goal, 'Become a sharper finance assistant');
  assert.deepEqual(roadmap.steps.map((s) => s.status), ['done', 'todo', 'todo']);
  assert.equal(roadmap.steps[0].pr, 12);
  await call('/api/roadmap', { method: 'DELETE' });
  assert.equal((await (await call('/api/roadmap')).json()).roadmap, null);
});

test('client tools reach the interface', async () => {
  const ev = await chat('fly to tokyo');
  const c = ev.find((e) => e.t === 'client');
  assert.equal(c.name, 'fly_to');
  assert.equal(c.args.place, 'tokyo');
});

test('instant widgets install, and open on screen straight away', async () => {
  const ev = await chat('make a widget');
  const open = ev.find((e) => e.t === 'client' && e.name === 'open_widget');
  assert.ok(open && /<h1/.test(open.args.html), 'opened on screen');
  const w = await (await call('/api/widgets')).json();
  assert.equal(w.widgets[0].name, 'clock');
});

test('without GitHub, shipping explains itself and asks nothing', async () => {
  const ev = await chat('ship 5');
  assert.ok(!ev.some((e) => e.t === 'approval'), 'nothing to approve');
  assert.match(ev.find((e) => e.t === 'tool_result').summary, /Self-editing is not set up/);
});

test('approvals pause the action, and resume or decline it', async () => {
  const ev = await chat('forget everything');
  const ap = ev.find((e) => e.t === 'approval');
  assert.ok(ap && ap.name === 'forget_everything');
  assert.ok(!ev.some((e) => e.t === 'tool'), 'must not run before approval');
  assert.ok((await (await call('/api/memory')).json()).facts.length > 0, 'memory untouched while waiting');
  const no = await chat(null, '/api/approve', { id: ap.id, allow: false });
  assert.match(no.find((e) => e.t === 'tool_result').summary, /declined/);
  assert.ok((await (await call('/api/memory')).json()).facts.length > 0, 'declined: memory kept');
  const ap2 = (await chat('forget everything')).find((e) => e.t === 'approval');
  const moved = await chat('hello'); // moving on without answering keeps the conversation valid
  assert.ok(moved.some((e) => e.t === 'text'));
  for (const m of state.storage.m.get('ctx')) if (m.tool_calls) for (const c of m.tool_calls) assert.ok(state.storage.m.get('ctx').some((x) => x.role === 'tool' && x.tool_call_id === c.id), 'every tool call has a result');
  assert.equal((await call('/api/approve', { method: 'POST', body: JSON.stringify({ id: ap2.id, allow: true }) })).status, 404, 'stale approval cannot be used later');
  const ap3 = (await chat('forget everything')).find((e) => e.t === 'approval');
  const yes = await chat(null, '/api/approve', { id: ap3.id, allow: true });
  assert.match(yes.find((e) => e.t === 'tool_result').summary, /Erased/);
  assert.equal((await (await call('/api/memory')).json()).facts.length, 0);
});

test('cross-site requests are refused', async () => {
  const noHeader = await worker.fetch(new Request('https://ghosty.test/api/memory', { method: 'POST', headers: { 'content-type': 'text/plain', 'x-ghosty-key': OWNER_KEY }, body: '{"text":"x"}' }), env, ctx);
  assert.equal(noHeader.status, 403);
  const crossSite = await call('/api/status', { headers: { 'sec-fetch-site': 'cross-site' } });
  assert.equal(crossSite.status, 403);
  const sameOrigin = await call('/api/status', { headers: { 'sec-fetch-site': 'same-origin' } });
  assert.equal(sameOrigin.status, 200);
});

test('kernel files are protected unless unlocked', async () => {
  const { pathProblem } = await import(process.env.KERNEL_BUNDLE ?? './.build/protected.mjs');
  assert.ok(pathProblem('apps/edge/src/kernel/auth.ts', false));
  assert.ok(pathProblem('apps/web/functions/api/[[path]].ts', false));
  assert.ok(pathProblem('../etc/passwd', true));
  assert.equal(pathProblem('apps/web/src/features/brief/index.ts', false), null);
  assert.equal(pathProblem('apps/edge/src/kernel/auth.ts', true), null);
  for (const p of ['apps/edge/src/index.ts', 'apps/edge/src/agent.ts', 'apps/edge/wrangler.json', 'apps/edge/wrangler.toml', 'apps/edge/package.json', 'apps/web/public/_headers', '.github/workflows/check.yml',
    'APPS/EDGE/SRC/KERNEL/auth.ts', 'apps/edge/src/kernel', 'apps/edge', 'apps', '.github', 'apps/web/functions', 'apps/edge/./src/kernel/auth.ts', 'apps//edge/src/kernel/auth.ts', 'apps/edge/src/tools/index.ts',
    'apps/web/build.mjs', 'apps/web/package.json', 'apps/web/.npmrc', 'apps/edge/.npmrc', 'apps/edge/bunfig.toml', 'apps/edge/bun.lock', 'apps/web/package-lock.json', '.npmrc',
    'package.json', 'package-lock.json', 'packages/shared/package.json', 'apps/web/src/.npmrc', 'apps/web/src/x/.env', 'wrangler.toml', 'apps/web/wrangler.jsonc', 'pnpm-workspace.yaml', 'apps/edge/src/keys.ts']) {
    assert.ok(pathProblem(p, false), `${p} should be protected`);
  }
  assert.equal(pathProblem('apps/edge/src/tools/weather_extra.ts', false), null);
  assert.equal(pathProblem('apps/web/src/features/new/index.ts', false), null);
});

test('history and clear', async () => {
  const h = await (await call('/api/history')).json();
  assert.ok(h.turns.length >= 4);
  await call('/api/history', { method: 'DELETE' });
  assert.equal((await (await call('/api/history')).json()).turns.length, 0);
});

test('a new message takes over from one still running (never "still working on the previous request")', async () => {
  const first = call('/api/chat', { method: 'POST', body: JSON.stringify({ message: 'remember the first thing' }) });
  const second = call('/api/chat', { method: 'POST', body: JSON.stringify({ message: 'remember the second thing' }) });
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  await Promise.all([a.text(), b.text()]);
  await Promise.allSettled(pending.splice(0));
  // and the brain is free afterwards
  const ev = await chat('hello again');
  assert.ok(ev.some((e) => e.t === 'done'));
});
