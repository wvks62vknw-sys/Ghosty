// How Ghosty grows: the training ground (fail → feedback → pass → lesson + note), its own
// notes and its own source code in the library, and notifications on demand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sqlStorage } from '../../../tests/sqlite-storage.mjs';

const brain = await import('./.build/brain.mjs');
const { Library } = await import('./.build/library/store.mjs');
const { importSelf, SELF_DOC } = await import('./.build/library/importers.mjs');
const T = await import('./.build/tools/index.mjs');

class MemStorage {
  m = new Map();
  sql = sqlStorage();
  async get(k) { return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { this.m.set(k, structuredClone(v)); }
  async delete(k) { return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k); }
  async list({ prefix = '' } = {}) { return new Map([...this.m].filter(([k]) => k.startsWith(prefix))); }
  async setAlarm() {}
  async getAlarm() { return null; }
}

function agentWith(storage = new MemStorage()) {
  const state = { storage, waitUntil: () => undefined, blockConcurrencyWhile: (f) => f() };
  const agent = new brain.GhostyAgent(state, { MOCK_LLM: '1', VAULT_KEY: Buffer.alloc(32, 3).toString('base64') });
  const call = async (path, body) => (await agent.fetch(new Request(`https://ghosty.test/api${path}`, body === undefined ? {} : { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }))).json();
  return { agent, call, storage };
}

test('training ground: exercises are listed without their answers', async () => {
  const { call } = agentWith();
  const t = await call('/train');
  assert.ok(t.exercises.length >= 40);
  const ex = await call(`/train/exercise/${t.exercises[0].id}`);
  assert.ok(ex.prompt && ex.entry && ex.tests.length >= 6);
  assert.equal(ex.reference, undefined, 'the reference solution never leaves the brain');
});

test('training ground: a failed attempt is shown the failures; the fix is recorded with a lesson and a note', async () => {
  const { call, storage } = agentWith();
  const first = await call('/train/attempt', { id: 'run-length-encode', history: [] });
  assert.match(first.code, /function rleEncode\(\) \{ return null; \}/, 'the scripted model gets it wrong first');
  const second = await call('/train/attempt', { id: 'run-length-encode', history: [{ code: first.code, report: '7 of 7 tests failed' }] });
  assert.ok(second.code.length > first.code.length, 'given the failures, it writes a real solution');
  const res = await call('/train/result', { id: 'run-length-encode', solved: true, attempts: 2, code: second.code, model: 'Mock', firstReport: '7 of 7 tests failed: got null' });
  assert.equal(res.record.solved, true);
  assert.equal(res.record.firstSolve, 2);
  assert.match(res.lesson, /Rule:/);
  const lessons = storage.m.get('lessons');
  assert.ok(lessons.some((l) => /Rule:/.test(l.text) && l.tags.includes('training')));
  const lib = new Library(storage, {});
  assert.match((await lib.search('run length encoding solution'))[0].title, /training solutions/);
  const t = await call('/train');
  assert.equal(t.records['run-length-encode'].solved, true);
});

test("notes: Ghosty's notebook entries are kept once; a section can be replaced", async () => {
  const lib = new Library(new MemStorage(), {});
  assert.equal(await lib.note('notes_research', 'Research', 'notes', { heading: 'Q', text: 'The Thames Barrier closed 221 times up to 2024.' }), true);
  assert.equal(await lib.note('notes_research', 'Research', 'notes', { heading: 'Q', text: 'The Thames Barrier closed 221 times up to 2024.' }), false, 'no duplicates');
  await lib.note('notes_research', 'Research', 'notes', { heading: 'Other', text: 'Something else entirely about owls.' });
  assert.equal(lib.doc('notes_research').passages, 2);
  assert.equal(lib.removeSection('notes_research', 'Q'), 1);
  assert.equal(lib.doc('notes_research').passages, 1);
});

test('Ghosty reads its own source code into the library, 25 files at a time, and re-reads changed files', async () => {
  const files = { 'MAP.md': '# Ghosty — code map\n\nRead this before changing anything.', 'apps/edge/src/agent.ts': 'export class GhostyAgent { /* the agent loop */ }\n', 'apps/edge/wrangler.jsonc': '{ "OWNER_KEY_HASH": "secret" }', 'apps/web/src/main.ts': 'boot();\n' };
  for (let i = 0; i < 30; i++) files[`apps/edge/src/tools/t${i}.ts`] = `export const tool${i} = ${i};\n`;
  const g = { tree: async () => Object.keys(files), read: async (p) => files[p] ?? null };
  const lib = new Library(new MemStorage(), {});
  const a = await importSelf(lib, g, 'main');
  assert.equal(a.files, 25);
  assert.equal(a.next, 25);
  const b = await importSelf(lib, g, 'main', { offset: a.next });
  assert.equal(b.next, null);
  assert.equal(b.total, 33, 'wrangler settings (owner password hash) are never read');
  assert.match((await lib.search('agent loop GhostyAgent'))[0].heading, /agent\.ts/);
  files['apps/edge/src/agent.ts'] = 'export class GhostyAgent { /* now with a hyperdrive */ }\n';
  await importSelf(lib, g, 'main', { only: ['apps/edge/src/agent.ts'] });
  const hits = await lib.search('GhostyAgent');
  assert.equal(hits.filter((h) => h.heading === 'apps/edge/src/agent.ts').length, 1, 'the old version was replaced');
  assert.match(hits[0].text, /hyperdrive/);
  assert.equal(lib.doc(SELF_DOC).title, "Ghosty's own source code");
});

test('push_to_phone: explains how to turn notifications on when no device is registered', async () => {
  const storage = new MemStorage();
  const tool = T.toolByName.get('push_to_phone');
  const r = await tool.run({ text: 'Milk, eggs, bread' }, { storage, env: {}, vault: {}, emit: () => undefined });
  assert.match(r, /no phone or device has notifications turned on/);
  assert.equal(storage.m.get('inbox').at(-1).text, 'Milk, eggs, bread');
  assert.ok(T.selectTools('ping my phone with the list', new Set(), false).some((t) => t.name === 'push_to_phone'));
});
