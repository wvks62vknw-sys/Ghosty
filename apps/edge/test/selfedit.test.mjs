// Self-edit pipeline test against an in-memory fake of the GitHub API.
// Covers: propose → status (with preview link) → approval → ship → restore, and kernel protection.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto, createHash } from 'node:crypto';

const mod = await import(process.env.BRAIN_BUNDLE ?? './.build/brain.mjs');
const worker = mod.default;

// ---------- fake GitHub ----------
const sha = (s) => createHash('sha1').update(s).digest('hex');
const G = { blobs: new Map(), trees: new Map(), commits: new Map(), refs: new Map(), pulls: [] };
function mkCommit(treeSha, parents, message) {
  const s = sha(`${treeSha}${parents.join()}${message}${Math.random()}`);
  G.commits.set(s, { tree: treeSha, parents, message, date: new Date().toISOString() });
  return s;
}
function mkTree(files) {
  const s = sha(JSON.stringify([...files].sort()) + Math.random());
  G.trees.set(s, new Map(files));
  return s;
}
function blob(content) {
  const s = sha(content);
  G.blobs.set(s, content);
  return s;
}
const root = mkTree([
  ['MAP.md', blob('# map')],
  ['apps/web/src/hello.ts', blob("export const greeting = 'Hello';\n")],
  ['apps/edge/src/kernel/auth.ts', blob('// auth')],
]);
G.refs.set('main', mkCommit(root, [], 'Initial Ghosty'));
const resolve = (ref) => (G.commits.has(ref) ? ref : G.refs.get(ref));
const filesAt = (ref) => G.trees.get(G.commits.get(resolve(ref)).tree);

const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  if (url.hostname !== 'api.github.com') return new Response('blocked in test', { status: 599 });
  const method = (init.method ?? 'GET').toUpperCase();
  const body = init.body ? JSON.parse(init.body) : null;
  const p = url.pathname.replace('/repos/me/ghosty', '');
  const ok = (j, status = 200) => new Response(JSON.stringify(j), { status, headers: { 'content-type': 'application/json' } });
  let m;
  if (p === '' && method === 'GET') return ok({ default_branch: 'main' });
  if ((m = p.match(/^\/git\/ref\/heads\/(.+)$/))) return G.refs.has(decodeURIComponent(m[1])) ? ok({ object: { sha: G.refs.get(decodeURIComponent(m[1])) } }) : ok({ message: 'Not Found' }, 404);
  if ((m = p.match(/^\/git\/trees\/(.+)$/)) && method === 'GET') return ok({ tree: [...filesAt(decodeURIComponent(m[1])).keys()].map((path) => ({ path, type: 'blob' })), truncated: false });
  if ((m = p.match(/^\/contents\/(.+)$/))) {
    const f = filesAt(url.searchParams.get('ref')).get(decodeURIComponent(m[1]));
    return f ? ok({ type: 'file', encoding: 'base64', content: Buffer.from(G.blobs.get(f)).toString('base64') }) : ok({ message: 'Not Found' }, 404);
  }
  if ((m = p.match(/^\/git\/commits\/(.+)$/))) {
    const s = resolve(m[1]);
    const c = G.commits.get(s);
    return ok({ sha: s, tree: { sha: c.tree }, message: c.message });
  }
  if (p === '/git/blobs') return ok({ sha: blob(Buffer.from(body.content, 'base64').toString()) }, 201);
  if (p === '/git/trees') {
    const files = new Map(G.trees.get(body.base_tree));
    for (const e of body.tree) e.sha === null ? files.delete(e.path) : files.set(e.path, e.sha);
    return ok({ sha: mkTree(files) }, 201);
  }
  if (p === '/git/commits' && method === 'POST') return ok({ sha: mkCommit(body.tree, body.parents, body.message) }, 201);
  if (p === '/git/refs' && method === 'POST') {
    G.refs.set(body.ref.replace('refs/heads/', ''), body.sha);
    return ok({}, 201);
  }
  if ((m = p.match(/^\/git\/refs\/heads\/(.+)$/))) {
    const b = decodeURIComponent(m[1]);
    if (method === 'PATCH') G.refs.set(b, body.sha);
    if (method === 'DELETE') G.refs.delete(b);
    return new Response(null, { status: method === 'DELETE' ? 204 : 200 });
  }
  if (p === '/pulls' && method === 'POST') {
    const n = G.pulls.length + 1;
    G.pulls.push({ number: n, title: body.title, head: body.head, base: body.base, state: 'open', merged: false, created_at: new Date().toISOString() });
    return ok({ number: n }, 201);
  }
  const prJson = (pr) => ({ ...pr, head: { ref: pr.head, sha: G.refs.get(pr.head) ?? 'gone', repo: { full_name: pr.fork ?? 'me/ghosty' } }, html_url: `https://github.com/me/ghosty/pull/${pr.number}`, mergeable: true });
  if ((m = p.match(/^\/pulls\/(\d+)\/files$/))) {
    const pr = G.pulls[Number(m[1]) - 1];
    const head = filesAt(pr.head), base = filesAt('main');
    const out = [];
    for (const [f, b] of head) if (base.get(f) !== b) out.push({ filename: f, status: base.has(f) ? 'modified' : 'added' });
    for (const f of base.keys()) if (!head.has(f)) out.push({ filename: f, status: 'removed' });
    return ok(out);
  }
  if (p === '/pulls' && method === 'GET') return ok(G.pulls.filter((x) => x.state === 'open').map(prJson));
  if ((m = p.match(/^\/pulls\/(\d+)$/))) {
    const pr = G.pulls[Number(m[1]) - 1];
    if (method === 'PATCH') pr.state = body.state;
    return ok(prJson(pr));
  }
  if ((m = p.match(/^\/pulls\/(\d+)\/merge$/))) {
    const pr = G.pulls[Number(m[1]) - 1];
    if (body.sha && body.sha !== G.refs.get(pr.head)) return ok({ message: 'Head branch was modified. Review and try the merge again.' }, 409);
    const head = G.commits.get(G.refs.get(pr.head));
    const s = mkCommit(head.tree, [G.refs.get('main')], body.commit_title);
    G.refs.set('main', s);
    pr.state = 'closed';
    pr.merged = true;
    return ok({ sha: s });
  }
  if ((m = p.match(/^\/commits\/([^/]+)\/check-runs$/))) return ok({ check_runs: [{ id: 77, app: { slug: 'github-actions' }, name: 'brain', status: 'completed', conclusion: G.failSha === resolve(m[1]) ? 'failure' : 'success' }, { name: 'interface', status: 'completed', conclusion: 'success' }, { name: 'Workers Builds: ghosty', status: 'completed', conclusion: 'success', details_url: 'https://dash.cloudflare.com/x/workers/services/view/ghosty', output: { summary: 'Preview URL: https://ghosty-rename-the-greeting-ghosty.me.workers.dev' } }] });
  if ((m = p.match(/^\/commits\/([^/]+)\/status$/))) return ok({ statuses: [] });
  if (p === '/commits') {
    const out = [];
    let s = resolve(url.searchParams.get('sha'));
    while (s && out.length < Number(url.searchParams.get('per_page') ?? 15)) {
      const c = G.commits.get(s);
      out.push({ sha: s, commit: { message: c.message, committer: { date: c.date } } });
      s = c.parents[0];
    }
    return ok(out);
  }
  if ((m = p.match(/^\/actions\/jobs\/(\d+)\/logs$/))) return ok('2026-10-15T01:00:00Z src/state/theme.ts(19,3): error TS1117: An object literal cannot have multiple properties with the same name.\n');
  return ok({ message: `fake GitHub does not handle ${method} ${p}` }, 501);
};
process.on('exit', () => (globalThis.fetch = realFetch));

// ---------- brain under test ----------
class MemStorage {
  m = new Map();
  alarm = null;
  async setAlarm(t) { this.alarm = t; }
  async getAlarm() { return this.alarm; }
  async get(k) { return Array.isArray(k) ? new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))])) : this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b)); else this.m.set(k, structuredClone(v)); }
  async delete(k) { return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k); }
  async list({ prefix = '' } = {}) { return new Map([...this.m].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)])); }
}
const OWNER_KEY = 'test-owner-key-0123456789abcdef';
const pending = [];
const state = { storage: new MemStorage(), waitUntil: (p) => pending.push(p) };
const env = {
  OWNER_KEY,
  VAULT_KEY: Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString('base64'),
  MOCK_LLM: '1',
  GITHUB_REPO: 'me/ghosty',
  GITHUB_TOKEN: 'ghp_test',
};
let agent;
env.AGENT = { idFromName: (n) => n, get: () => ({ fetch: (r) => (agent ??= new mod.GhostyAgent(state, env)).fetch(r) }) };
const ctx = { waitUntil: (p) => pending.push(p) };
const call = (path, init = {}) => worker.fetch(new Request(`https://ghosty.me.workers.dev${path}`, { ...init, headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': OWNER_KEY } }), env, ctx);
async function chat(message, path = '/api/chat', body = { message }) {
  const r = await call(path, { method: 'POST', body: JSON.stringify(body) });
  const t = await r.text();
  await Promise.allSettled(pending.splice(0));
  return t.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
const result = (ev) => ev.find((e) => e.t === 'tool_result');

test('propose_change opens a PR with the edit applied on a ghosty/ branch', async () => {
  const r = result(await chat('propose edit'));
  assert.ok(r.ok, r.summary);
  assert.match(r.summary, /Opened change #1 on branch ghosty\//);
  assert.match(r.summary, /workers\.dev/);
  const pr = G.pulls[0];
  const file = G.blobs.get(filesAt(pr.head).get('apps/web/src/hello.ts'));
  assert.equal(file, "export const greeting = 'Good evening';\n");
  assert.equal(G.blobs.get(filesAt('main').get('apps/web/src/hello.ts')), "export const greeting = 'Hello';\n", 'main untouched');
});

test('change_status reports checks and the preview link', async () => {
  const r = result(await chat('status 1'));
  assert.match(r.summary, /Code checks: passed/);
  assert.match(r.summary, /Preview build: ok/);
  assert.match(r.summary, /workers\.dev/);
});

test('kernel edits are refused', async () => {
  const r = result(await chat('propose kernel'));
  assert.equal(r.ok, false);
  assert.match(r.summary, /protected kernel/);
  assert.equal(G.pulls.length, 1, 'no PR created');
});

test('the Workshop lists open changes', async () => {
  const j = await (await call('/api/changes')).json();
  assert.equal(j.changes.length, 1);
  assert.equal(j.changes[0].checks, 'passed');
  assert.ok(j.versions.length >= 1);
});

test('shipping needs approval pinned to the exact commit, then merges', async () => {
  const ap = (await chat('ship 1')).find((e) => e.t === 'approval');
  assert.ok(ap, 'expected an approval request');
  assert.match(ap.reason, /apps\/web\/src\/hello\.ts/, 'approval lists the files');
  assert.equal(ap.args.sha, G.refs.get(G.pulls[0].head), 'approval pinned to the head commit');
  assert.equal(G.pulls[0].state, 'open', 'not merged before approval');
  const r = result(await chat(null, '/api/approve', { id: ap.id, allow: true }));
  assert.ok(r.ok, r.summary);
  assert.equal(G.pulls[0].merged, true);
  assert.equal(G.blobs.get(filesAt('main').get('apps/web/src/hello.ts')), "export const greeting = 'Good evening';\n");
});

test('declining a ship tells the model and merges nothing', async () => {
  await chat('propose file'); // #2
  const ap = (await chat('ship 2')).find((e) => e.t === 'approval');
  const r = result(await chat(null, '/api/approve', { id: ap.id, allow: false }));
  assert.match(r.summary, /declined/);
  assert.equal(G.pulls[1].merged, false);
});

test('a change swapped after approval is refused', async () => {
  const ap = (await chat('ship 2')).find((e) => e.t === 'approval');
  // someone (or an injected update_change) moves the branch after the owner looked at it
  const pr = G.pulls[1];
  const moved = mkCommit(G.commits.get(G.refs.get(pr.head)).tree, [G.refs.get(pr.head)], 'sneaky');
  G.refs.set(pr.head, moved);
  const r = result(await chat(null, '/api/approve', { id: ap.id, allow: true }));
  assert.equal(r.ok, false);
  assert.match(r.summary, /changed after it was approved/);
  assert.equal(G.pulls[1].merged, false);
});

test("a fork's PR is never treated as Ghosty's own", async () => {
  G.refs.set('ghosty/evil', G.refs.get('main'));
  G.pulls.push({ number: G.pulls.length + 1, title: 'Totally harmless', head: 'ghosty/evil', base: 'main', state: 'open', merged: false, created_at: new Date().toISOString(), fork: 'attacker/ghosty' });
  const n = G.pulls.length;
  const ev = await chat(`ship ${n}`);
  assert.ok(!ev.some((e) => e.t === 'approval'));
  assert.match(result(ev).summary, /not one of Ghosty's own changes/);
  const j = await (await call('/api/changes')).json();
  assert.ok(!j.changes.some((c) => c.number === n), 'fork PR hidden from the Workshop');
  const own = await call(`/api/changes/${n}/ship`, { method: 'POST', body: JSON.stringify({ sha: G.refs.get('ghosty/evil') }) });
  assert.equal(own.status, 500);
  assert.equal(G.pulls[n - 1].merged, false);
});

test('restore rolls main back as a new commit', async () => {
  const versions = await (await call('/api/changes')).json();
  const first = versions.versions.at(-1).sha;
  const ap = (await chat(`restore ${first.slice(0, 7)}`)).find((e) => e.t === 'approval');
  assert.match(ap.reason, /Initial Ghosty/);
  const r = result(await chat(null, '/api/approve', { id: ap.id, allow: true }));
  assert.ok(r.ok, r.summary);
  assert.equal(G.blobs.get(filesAt('main').get('apps/web/src/hello.ts')), "export const greeting = 'Hello';\n");
  assert.equal(G.commits.get(G.refs.get('main')).parents.length, 1, 'history kept, not rewritten');
});

test('owner buttons in the Workshop work without the model', async () => {
  const r = await call('/api/changes/2/discard', { method: 'POST' });
  assert.equal(r.status, 200, await r.clone().text());
  assert.equal(G.pulls[1].state, 'closed');
  await chat('propose file');
  const n = G.pulls.length;
  const stale = await call(`/api/changes/${n}/ship`, { method: 'POST', body: JSON.stringify({ sha: 'f'.repeat(40) }) });
  assert.equal(stale.status, 500, 'shipping a commit other than the one shown is refused');
  const ok = await call(`/api/changes/${n}/ship`, { method: 'POST', body: JSON.stringify({ sha: G.refs.get(G.pulls[n - 1].head) }) });
  assert.equal(ok.status, 200, await ok.clone().text());
  assert.equal(G.pulls[n - 1].merged, true);
});

test('shipping is refused while checks fail — even from the Workshop button', async () => {
  const ev = await chat('propose file');
  const n = G.pulls.length;
  const pr = G.pulls[n - 1];
  G.failSha = G.refs.get(pr.head);
  const st = result(await chat(`status ${n}`));
  assert.match(st.summary, /Code checks: failed/);
  const full = await (await call(`/api/changes/${n}/ship`, { method: 'POST', body: JSON.stringify({ sha: G.refs.get(pr.head) }) })).json();
  assert.ok(full.error || /can't ship/.test(full.result ?? ''), JSON.stringify(full));
  assert.ok(!pr.merged, 'not merged');
  G.failSha = null;
  assert.ok(ev.length);
});

test('after shipping, Ghosty checks the deploy: live → told; broken → rolled back by itself', async () => {
  // ship a change whose checks pass
  await chat('propose file');
  const n = G.pulls.length;
  const pr = G.pulls[n - 1];
  const before = G.refs.get('main');
  const r = await call(`/api/changes/${n}/ship`, { method: 'POST', body: JSON.stringify({ sha: G.refs.get(pr.head) }) });
  assert.equal(r.status, 200);
  const shipped = G.refs.get('main');
  assert.notEqual(shipped, before);
  const jobs = () => state.storage.m.get('jobs') ?? [];
  const verify = jobs().find((j) => j.kind === 'verify');
  assert.ok(verify, 'a deploy check was scheduled');
  // the deploy went fine
  verify.next = Date.now() - 1;
  state.storage.m.set('jobs', [verify]);
  await agent.alarm();
  let inbox = state.storage.m.get('inbox');
  assert.match(inbox[inbox.length - 1].title, /is live/);
  assert.equal(G.refs.get('main'), shipped, 'left alone');
  // ship another one, and this time its checks fail after merging
  await chat('propose file');
  const n2 = G.pulls.length;
  const pr2 = G.pulls[n2 - 1];
  await call(`/api/changes/${n2}/ship`, { method: 'POST', body: JSON.stringify({ sha: G.refs.get(pr2.head) }) });
  const bad = G.refs.get('main');
  G.failSha = bad;
  const v2 = jobs().find((j) => j.kind === 'verify');
  v2.next = Date.now() - 1;
  state.storage.m.set('jobs', [v2]);
  await agent.alarm();
  inbox = state.storage.m.get('inbox');
  assert.match(inbox[inbox.length - 1].title, /Rolled back change/);
  const now = G.refs.get('main');
  assert.notEqual(now, bad, 'a new commit was made');
  assert.equal(G.commits.get(now).tree, G.commits.get(shipped).tree, 'Ghosty is exactly as it was before the broken change');
  G.failSha = null;
});

test('the self-check rejects a change that imports a missing file — no PR is opened', async () => {
  const before = G.pulls.length;
  const r = result(await chat('propose broken'));
  assert.equal(r.ok, false);
  assert.match(r.summary, /Self-check found problems.*does-not-exist/s);
  assert.equal(G.pulls.length, before);
});

test('a reply cut off mid-arguments is refused with a clear reason — nothing is run', async () => {
  const before = G.pulls.length;
  const r = result(await chat('propose cut off'));
  assert.equal(r.ok, false);
  assert.match(r.summary, /not valid JSON.*cut off/s);
  assert.equal(G.pulls.length, before);
});
