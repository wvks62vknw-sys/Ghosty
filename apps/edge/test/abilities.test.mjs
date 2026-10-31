// ABILITIES (OWNER-ISSUES 68, 67b, 67d, 68c): everything the brain can do, made from the tool registry (abilities.ts);
// the owner's learning goals; "can you …?" answered by search; WHY a reply did what it did; what he did today.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sqlStorage } from '../../../tests/sqlite-storage.mjs';

const A = await import('./.build/abilities.mjs');
const T = await import('./.build/tools/index.mjs');
const K = await import('./.build/keys.mjs');
const brain = await import('./.build/brain.mjs');

class MemStorage {
  m = new Map();
  sql = sqlStorage();
  alarm = null;
  async get(k) { return Array.isArray(k) ? new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))])) : this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b)); else this.m.set(k, structuredClone(v)); }
  async delete(k) { return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k); }
  async list({ prefix = '' } = {}) { return new Map([...this.m].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)])); }
  async setAlarm(t) { this.alarm = typeof t === 'number' ? t : t.getTime(); }
  async getAlarm() { return this.alarm; }
}

function agentOf(storage = new MemStorage()) {
  const pending = [];
  const env = { MOCK_LLM: '1', VAULT_KEY: Buffer.alloc(32, 7).toString('base64') };
  const agent = new brain.GhostyAgent({ storage, waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() }, env);
  const call = async (path, init = {}) => {
    const r = await agent.fetch(new Request(`https://ghosty.test/api${path}`, { ...init, headers: { 'x-ghosty-key': 'owner-key-for-tests-0123456789', 'content-type': 'application/json', ...(init.headers ?? {}) } }));
    const text = await r.text();
    await Promise.allSettled(pending.splice(0));
    return { status: r.status, json: () => JSON.parse(text), text };
  };
  return { agent, storage, call };
}

// ---------------------------------------------------------------- item 1: the abilities, from the registry

test('every tool group with tools is an ability (the extras one each), in his voice, with its tools as asks', () => {
  const list = A.brainAbilities(() => true);
  const groups = T.TOOL_GROUPS.filter((g) => g.tools.length);
  for (const g of groups) {
    if (g.name === 'extra') {
      for (const t of g.tools) assert.ok(list.some((a) => a.id === `g:extra:${t.name}`), `extra tool ${t.name} is listed`);
      continue;
    }
    const a = list.find((x) => x.id === `g:${g.name}`);
    assert.ok(a, `group ${g.name} is listed`);
    assert.deepEqual(a.tools, g.tools.map((t) => t.name), `${g.name}: its tools`);
    assert.equal(a.asks.length, g.tools.length, `${g.name}: every tool as an ask`);
  }
  // every tool of the registry is in exactly one ability (so a tool added later appears by itself)
  const tools = list.filter((a) => a.id !== 'g:evolve:learn').flatMap((a) => a.tools);
  assert.deepEqual([...tools].sort(), [...new Set(T.TOOL_GROUPS.flatMap((g) => g.tools.map((t) => t.name)))].sort());
  for (const a of list) {
    assert.match(a.line, /^I can .+\.$/, `${a.id}: "${a.line}"`);
    assert.doesNotMatch(a.line, /\b[a-z]+_[a-z0-9_]+\b/, `${a.id}: no tool name in the line`);
    assert.doesNotMatch(a.line, /\b(?:the owner|owner's|he|his|him)\b/i, `${a.id}: the owner is "you"`);
    assert.doesNotMatch(a.line, /\b(?:DO IT|ALWAYS|NEVER)\b/, `${a.id}: nothing shouted for the model`);
    for (const ask of a.asks) assert.doesNotMatch(ask, /_/, `${a.id}: the ask "${ask}" is words, not an identifier`);
    assert.ok(['see', 'know', 'build', 'watch', 'play', 'learn', 'do', 'talk'].includes(a.cat), `${a.id}: a known group`);
    assert.equal(a.from, 'brain');
  }
  // the line the owner asked for, backed by the self-upgrade tools
  assert.ok(list.some((a) => a.line === 'I can learn anything you teach me.'));
  // a few lines, exactly
  assert.equal(list.find((a) => a.id === 'g:memory').line, 'I can remember lasting facts you tell me, list them, drop one.');
  assert.equal(list.find((a) => a.id === 'g:vehicle').line, 'I can check one UK vehicle by its plate when you ask.');
  assert.equal(list.find((a) => a.id === 'g:learn').line, 'I can be your patient tutor at your level.');
  assert.equal(list.find((a) => a.id === 'g:maps').asks.join(' · '), 'Show map · What is here · Elevation · UK postcode · Measure distance');
});

test('a group that needs a key or a link says so honestly, and GO goes where it is given; with it, it works', () => {
  const none = A.brainAbilities(() => false);
  const all = A.brainAbilities(() => true);
  for (const [name, need] of Object.entries(A.GROUP_NEEDS)) {
    const off = none.find((a) => a.id === `g:${name}`);
    assert.ok(off, `${name} is listed`);
    assert.match(off.off, /^needs (?:a key: SYSTEM → KEYS|linking: LINKS →)/, `${name}: "${off.off}"`);
    assert.deepEqual(off.go, need.open, `${name}: GO goes to the screen that takes it`);
    const on = all.find((a) => a.id === `g:${name}`);
    assert.equal(on.off, undefined, `${name} works once it is there`);
    assert.deepEqual(on.go, { ask: on.asks[0] });
    // every name it needs is a key System → Keys knows (Spotify keeps its link in the vault under its own name)
    for (const k of need.any) assert.ok(K.KEYS.some((d) => d.name === k) || k === 'spotify', `${name} needs "${k}", a real key`);
  }
  // only those: the rest work with no key at all
  assert.deepEqual(none.filter((a) => a.off).map((a) => a.id.slice(2)).sort(), Object.keys(A.GROUP_NEEDS).sort());
  // the vehicle check works with either DVSA's key or DVLA's
  assert.equal(A.brainAbilities((n) => n === 'dvla_ves').find((a) => a.id === 'g:vehicle').off, undefined);
});

test('a tool group added later appears by itself, under DO FOR YOU until it is placed', () => {
  const extra = { name: 'kettle', when: /\bkettle\b/i, about: "You can boil the owner's kettle (boil_kettle) when he asks.", tools: [{ name: 'boil_kettle', description: 'Boil the kettle.', parameters: { type: 'object', properties: {} }, risk: 'auto', run: async () => '' }] };
  const list = A.brainAbilities(() => true, [...T.TOOL_GROUPS, extra]);
  const k = list.find((a) => a.id === 'g:kettle');
  assert.equal(k.line, 'I can boil your kettle when you ask.');
  assert.equal(k.cat, 'do');
  assert.deepEqual(k.asks, ['Boil kettle']);
  assert.match(k.words, /kettle/);
});

test('the words: a line for the model said as his, tool names as asks', () => {
  assert.equal(A.iCan('You can search the web (web_search) and read any page or JSON (web_fetch).'), 'I can search the web and read any page or JSON.');
  assert.equal(A.iCan("You can PUBLISH websites: any site — DO IT, never reply that you can't host or publish: study_site."), 'I can publish websites.');
  assert.equal(A.iCan('You can check any page with check_html before handing it over'), 'I can check any page before handing it over.');
  assert.equal(A.iCan("You can reverse-engineer software the owner owns or may test — never a person's"), 'I can reverse-engineer software you own or may test.');
  assert.equal(A.iCan('You can upgrade yourself in steps: self_audit (what you are now), plan_upgrade'), 'I can upgrade myself in steps.');
  assert.equal(A.askOf('get_directions'), 'Get directions');
  assert.equal(A.askOf('uk_postcode'), 'UK postcode');
  assert.equal(A.askOf('make_3d'), 'Make 3D');
  assert.match(A.patternWords(/\b(mot|mots|vehicle|number ?plates?|car check)\b/i.source), /vehicle.*car check|car/);
});

test('GET /api/abilities through the agent: the abilities, no goals yet, the roadmap’s open steps, nothing offered yet', async () => {
  const { call, storage } = agentOf();
  await storage.put('roadmap', { goal: 'A better me', at: Date.now(), steps: [{ id: 1, title: 'Plan it', status: 'done' }, { id: 2, title: 'Build it', status: 'doing' }, { id: 3, title: 'Ship it', status: 'todo' }] });
  const r = await call('/abilities');
  assert.equal(r.status, 200);
  const info = r.json();
  assert.equal(info.abilities.length, A.brainAbilities(() => true).length);
  assert.ok(info.abilities.find((a) => a.id === 'g:repo').off, 'no GitHub token in this vault: the self-edit tools say so');
  assert.deepEqual(info.goals, []);
  assert.deepEqual(info.roadmap, { goal: 'A better me', steps: ['Build it', 'Ship it'] });
  assert.deepEqual(info.offered, []);
  assert.deepEqual(info.used, []);
  assert.equal((await call('/abilities/nope')).status, 404);
});
