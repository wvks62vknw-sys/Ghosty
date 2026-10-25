// Reverse engineering (REA on GitHub runners): target parsing, dispatch, status + report.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const R = await import('./.build/tools/reverse.mjs');
// what the phone shows under the box while he types (packages/shared/src/reverse.ts, the brain's own rules)
const at = (p) => new URL(p, import.meta.url).pathname;
await build({ entryPoints: [at('../../../packages/shared/src/reverse.ts')], bundle: true, format: 'esm', platform: 'neutral', outfile: at('./.build/shared-reverse.mjs'), logLevel: 'warning' });
const S = await import('./.build/shared-reverse.mjs');

class MemStorage {
  m = new Map();
  async get(k) { return this.m.get(k); }
  async put(k, v) { this.m.set(k, v); }
}

test('targets: URLs, npm names, owner/repo, bare domains; private hosts refused', () => {
  assert.deepEqual(R.normaliseTarget('https://example.com/app'), { target: 'https://example.com/app', kind: 'auto' });
  assert.deepEqual(R.normaliseTarget('lodash'), { target: 'lodash', kind: 'npm' });
  assert.deepEqual(R.normaliseTarget('@scope/pkg'), { target: '@scope/pkg', kind: 'npm' });
  assert.deepEqual(R.normaliseTarget('morluto/rea'), { target: 'morluto/rea', kind: 'repo' });
  assert.deepEqual(R.normaliseTarget('example.com'), { target: 'https://example.com', kind: 'web' });
  assert.equal(R.normaliseTarget('http://localhost:4173/'), null);
  assert.equal(R.normaliseTarget('http://192.168.1.5/'), null);
  assert.equal(R.normaliseTarget('not a target'), null);
});

test('start → running → done reads the report from the reports branch; a task job is scheduled', async () => {
  const storage = new MemStorage();
  const dispatched = [];
  let runState = null;
  const github = {
    async dispatchWorkflow(file, inputs) { dispatched.push({ file, inputs }); },
    async findRun(file, name) { return runState && name === `reverse ${dispatched[0].inputs.job}` ? runState : null; },
    async read(path, ref) { return ref === 'reports' && path.endsWith('/report.md') && runState?.status === 'completed' ? '# Reverse engineering report\n\n## Site overview (Ghosty baseline)\n\n- **Title:** Example\n\n## REA · web page\n\n```json\n{"ok":true}\n```\n' : null; },
  };
  const ctx = { storage, github: async () => github, emit() {}, kernelUnlocked: async () => false, env: {}, vault: {} };
  const start = R.reverseTools.find((t) => t.name === 'reverse_engineer');
  const out = await start.run({ target: 'example.com', question: 'what is it built with' }, ctx);
  assert.match(out, /Started reverse-engineering job r\w+ for https:\/\/example.com \(web\)/);
  assert.equal(dispatched[0].file, 'reverse.yml');
  assert.equal(dispatched[0].inputs.kind, 'web');
  assert.equal(dispatched[0].inputs.question, 'what is it built with');
  const jobs = await storage.get('schedule.jobs') ?? [...storage.m.entries()].find(([k]) => /job/i.test(k))?.[1];
  assert.ok(JSON.stringify([...storage.m.entries()]).includes('reverse_status'), 'a follow-up task job was scheduled');

  const status = R.reverseTools.find((t) => t.name === 'reverse_status');
  assert.match(await status.run({}, ctx), /queued|running/);
  runState = { id: 1, status: 'in_progress', conclusion: null, url: 'https://github.com/x/y/actions/runs/1' };
  assert.match(await status.run({}, ctx), /running/);
  runState = { id: 1, status: 'completed', conclusion: 'success', url: 'https://github.com/x/y/actions/runs/1' };
  const rep = await status.run({}, ctx);
  assert.match(rep, /Report for https:\/\/example.com/);
  assert.match(rep, /Title:\*\* Example/);
  const sec = await status.run({ section: 'rea' }, ctx);
  assert.match(sec, /REA · web page/);
  assert.doesNotMatch(sec, /Site overview/);
  const listed = await R.reverseTools.find((t) => t.name === 'reverse_jobs').run({}, ctx);
  assert.match(listed, /example.com · web · done/);
});

test('no GitHub token → clear error; run never starting → failed after 15 min', async () => {
  const storage = new MemStorage();
  const ctx = { storage, github: async () => null, emit() {}, kernelUnlocked: async () => false, env: {}, vault: {} };
  await assert.rejects(R.startReverse(ctx, 'example.com'), /GitHub token/);
  const g = { async dispatchWorkflow() {}, async findRun() { return null; }, async read() { return null; } };
  const ctx2 = { ...ctx, github: async () => g };
  const job = await R.startReverse(ctx2, 'lodash');
  const jobs = await storage.get('reverse.jobs');
  jobs[0].at = Date.now() - 16 * 60_000;
  await storage.put('reverse.jobs', jobs);
  const j = await R.refreshReverse(ctx2, job.id);
  assert.equal(j.status, 'failed');
  assert.match(j.error, /never started/);
});

test('a job started from the Reverse tab (startReverse, no chat) still schedules the follow-up that tells the owner; the chat tool schedules it once', async () => {
  const storage = new MemStorage();
  const g = { async dispatchWorkflow() {}, async findRun() { return null; }, async read() { return null; } };
  const ctx = { storage, github: async () => g, emit() {}, kernelUnlocked: async () => false, env: {}, vault: {} };
  const tasks = () => [...storage.m.values()].flatMap((v) => (Array.isArray(v) ? v : [])).filter((j) => j && j.kind === 'task' && /reverse_status/.test(j.text ?? ''));
  const job = await R.startReverse(ctx, 'example.com', 'auto', 'what does it talk to');
  assert.equal(tasks().length, 1, 'the tab\'s START schedules the follow-up');
  assert.match(tasks()[0].text, new RegExp(`job "${job.id}"`));
  assert.match(tasks()[0].text, /what does it talk to/);
  assert.ok(tasks()[0].next > Date.now() + 5 * 60_000, 'it looks again in about six minutes');
  await R.reverseTools.find((t) => t.name === 'reverse_engineer').run({ target: 'lodash' }, ctx);
  assert.equal(tasks().length, 2, 'the chat tool adds exactly one more, not two');
});

test('the phone says what a typed target reads as, by the brain\'s own rules: a bare word is a code package, a real thing is pointed to the chat', () => {
  assert.deepEqual(S.normaliseTarget('example.com'), R.normaliseTarget('example.com'));
  assert.equal(S.readsAs(''), '');
  assert.equal(S.readsAs('bbc.co.uk'), 'Reads as a website: bbc.co.uk.');
  assert.equal(S.readsAs('https://example.com/files/app.apk'), 'Reads as an app file: example.com/files/app.apk.');
  assert.equal(S.readsAs('morluto/rea'), 'Reads as a GitHub project: morluto/rea.');
  assert.match(S.readsAs('kettle'), /^Reads as a code package on npm: “kettle”\. To look at a website or an app, paste its link\.$/);
  assert.match(S.readsAs('a bicycle pump'), /ask Ghosty in the chat/);
  assert.match(S.readsAs('http://192.168.1.5/'), /Reverse opens a link/);
});

test('removing a report takes only that one out of the list; an unknown id changes nothing', async () => {
  const storage = new MemStorage();
  await storage.put('reverse.jobs', [{ id: 'ra', target: 'a.com', status: 'done' }, { id: 'rb', target: 'b.com', status: 'failed' }]);
  assert.equal(await R.removeReverse({}, storage, 'rx'), false);
  assert.equal((await storage.get('reverse.jobs')).length, 2);
  assert.equal(await R.removeReverse({}, storage, 'ra'), true);
  assert.deepEqual((await R.loadReverseJobs({}, storage)).map((j) => j.id), ['rb']);
});
