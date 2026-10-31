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

// ---------------------------------------------------------------- item 2: "can you …?" and "want me to learn it?"

const U = await import('./.build/upgrades.mjs');
/** The brain's abilities and a few of the phone's, shaped as abilities/registry.ts makes them (the deck's lines, the GYM, the Lens). */
const FAKES = [
  ...A.brainAbilities((n) => n !== 'github'),
  { id: 's:core', cat: 'talk', line: 'Talk or type, and I get it done.', asks: ['Ask with sources, each claim checked'], go: { open: 'core' }, from: 'app' },
  { id: 's:lens', cat: 'see', line: 'Point the camera and I name what I see.', asks: ['Translate a sign or a menu', 'Measure a wall or a sofa from a photo', 'Label the planes and ships you point at', 'Read a UK number plate: its MOT history'], go: { open: 'lens' }, from: 'app' },
  { id: 'gym:games', cat: 'play', line: 'I teach myself by playing 22 games, and you can play me at 7 of them.', asks: ['Play me at Tic-tac-toe', 'Play me at Connect 4', 'Play me at Chess', 'Watch me learn Sudoku'], go: { open: 'gym' }, from: 'app' },
];

test('the search: hits, near misses and nothing at all, best first', () => {
  const s = (q) => A.searchAbilities(FAKES, q);
  let r = s("check my car's MOT");
  assert.equal(r.kind, 'hit');
  assert.equal(r.hits[0].ability.id, 'g:vehicle');
  r = s('translate signs');
  assert.equal(r.kind, 'hit');
  assert.ok(r.hits.some((h) => h.ability.id === 's:lens'), 'the Lens translates signs');
  assert.equal(A.bestAsk(FAKES.find((a) => a.id === 's:lens'), 'translate signs'), 0, 'its ask that fits: "Translate a sign or a menu"');
  r = s('beat me at chess');
  assert.equal(r.kind, 'hit');
  assert.equal(r.hits[0].ability.id, 'gym:games');
  assert.equal(A.bestAsk(r.hits[0].ability, 'beat me at chess'), 2, '"Play me at Chess"');
  assert.equal(s('play some music').hits[0].ability.id, 'g:media');
  assert.equal(s('set an alarm').hits[0].ability.id, 'g:agenda');
  assert.equal(s('find a part for my dishwasher').hits[0].ability.id, 'g:gadgets');
  // a near miss: something of it, not what was asked ("fly" is the globe's camera, not a plane)
  r = s('fly a plane');
  assert.equal(r.kind, 'near');
  assert.ok(r.hits.length >= 1);
  r = s('book a flight');
  assert.equal(r.kind, 'near');
  // nothing at all
  assert.deepEqual(s('make me a sandwich'), { kind: 'none', hits: [] });
  assert.deepEqual(s('see in the dark'), { kind: 'none', hits: [] });
  assert.deepEqual(s('   '), { kind: 'none', hits: [] });
  // something said in words alone is the chat's own ability, never "not yet"
  for (const q of ['write a poem', 'tell me a joke', 'explain black holes']) {
    r = s(q);
    assert.equal(r.kind, 'hit', q);
    assert.equal(r.hits[0].ability.id, 's:core', q);
  }
  // a working ability before one that needs a key, when they fit as well
  const keyless = A.brainAbilities(() => false);
  assert.equal(A.searchAbilities(keyless, 'change your own source code').hits[0].ability.off, 'needs a key: SYSTEM → KEYS → GitHub token');
});

test('"can you …?" in chat: a question about him is taken; a request is left for the brain', () => {
  for (const [t, want] of [
    ['can you translate signs?', 'translate signs'],
    ["Can you check my car's MOT", "check my car's MOT"],
    ['hey ghosty, can you beat me at chess?', 'beat me at chess'],
    ['are you able to read my emails', 'read my emails'],
    ['do you know how to play chess?', 'play chess'],
    ['could you ever fly a plane?', 'fly a plane'],
  ]) assert.equal(A.canYouAsked(t), want, t);
  for (const t of [
    'can you remind me to call mum at 5',
    'can you remind me to call mum',
    'could you check the weather in Leeds?',
    'can you summarise this?',
    'can you play it now',
    'can you tell me a joke',
    'can you send Sarah a message',
    'what can you do',
    'can you translate this sign. it is in french',
    'remind me at 5',
  ]) assert.equal(A.canYouAsked(t), null, t);
  assert.equal(A.whatAbout("Can you check my car's MOT?"), "check my car's MOT");
  assert.equal(A.whatAbout('translate signs'), 'translate signs');
});

test('"want me to learn it?" → YES: a learning goal in his words, kept first and never pushed out; the nightly pass reads it first', async () => {
  const storage = new MemStorage();
  const g = await U.addOwnerGoal(storage, "can you check my car's MOT?", 1000);
  assert.equal(g.from, 'owner');
  assert.equal(g.ask, "can you check my car's MOT?");
  assert.equal(g.title, "Learn to check your car's MOT");
  assert.deepEqual(g.steps, []);
  // the same goal asked again is the one goal
  assert.equal((await U.addOwnerGoal(storage, "Can you check my car's MOT", 2000)).id, g.id);
  assert.equal((await U.loadIdeas(storage)).length, 1);
  // another thing that shares most of its words is another goal ("a sandwich" is not "a cheese sandwich")
  assert.notEqual((await U.addOwnerGoal(storage, 'can you make me a sandwich', 2100)).id, (await U.addOwnerGoal(storage, 'can you make me a cheese sandwich', 2200)).id);
  await storage.put(U.UPGRADES_KEY, (await U.loadIdeas(storage)).filter((i) => i.id === g.id));
  assert.equal(U.goalTitle('are you able to beat me at chess'), 'Learn to beat you at chess');
  assert.equal(U.goalTitle('juggle'), 'Learn: juggle');
  // Ghosty's own ideas never push his goal out, and never jump in front of it
  const twelve = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet', 'kilo', 'lima'].map((w) => ({ title: `A ${w} upgrade`, why: 'w', steps: ['s'] }));
  const { list } = U.mergeIdeas(await U.loadIdeas(storage), twelve, 3000);
  assert.equal(list[0].id, g.id, 'his goal first');
  assert.equal(list.filter((i) => i.from !== 'owner').length, 10, 'ten of his own at most');
  await storage.put(U.UPGRADES_KEY, list);
  // the nightly pass: his goals are the first thing it reads, in his words, and not among "already proposed"
  const context = await U.gather({ storage, library: { available: false }, audit: async () => 'ABILITIES (1 tools): weather', ask: async () => '', notify: async () => undefined });
  assert.match(context, /^WHAT THE OWNER ASKED YOU TO LEARN[^\n]*\n[\s\S]*can you check my car's MOT\?/);
  assert.doesNotMatch(context.slice(context.indexOf('ALREADY PROPOSED')), /check your car/);
});

test('through the agent: POST /abilities/learn records it; ABILITIES and the Workshop both show it, his first', async () => {
  const { call } = agentOf();
  assert.equal((await call('/abilities/learn', { method: 'POST', body: JSON.stringify({ ask: '' }) })).status, 400);
  const r = await call('/abilities/learn', { method: 'POST', body: JSON.stringify({ ask: '  can you   translate signs? ' }) });
  assert.equal(r.status, 200);
  assert.equal(r.json().goal.ask, 'can you translate signs?');
  assert.equal(r.json().goal.title, 'Learn to translate signs');
  const info = (await call('/abilities')).json();
  assert.deepEqual(info.goals.map((x) => x.ask), ['can you translate signs?']);
  const ideas = (await call('/upgrades')).json().ideas;
  assert.equal(ideas[0].from, 'owner');
  assert.equal(ideas[0].title, 'Learn to translate signs');
});

// ---------------------------------------------------------------- item 3: WHY did you do that

const W = await import('./.build/why.mjs');

test('the trail from fake events: tools with their arguments in plain words, how each went, the reason from its ability and his own', () => {
  const r = W.trailRecorder('how do I get to New Street by train tomorrow?', 1000);
  r.note({ t: 'status', text: 'thinking' });
  r.note({ t: 'tool', id: 'a', name: 'plan_journey', args: { to: 'Birmingham New Street', when: '07:30', html: '<p>never shown</p>' } });
  r.note({ t: 'progress', id: 'a', name: 'plan_journey', label: 'Transitous…' });
  r.note({ t: 'tool_result', id: 'a', name: 'plan_journey', ok: true, summary: 'Leave 07:12…' });
  r.note({ t: 'tool', id: 'b', name: 'web_search', args: { query: 'rail strike Birmingham' } });
  r.note({ t: 'tool_result', id: 'b', name: 'web_search', ok: false, summary: 'Error: no search key answered' });
  r.note({ t: 'text', text: 'Take the 07:12 from Selly Oak. I checked for strikes because one was planned this week.' });
  const t = r.trail();
  assert.deepEqual(t.steps, [
    { tool: 'plan_journey', args: 'to: Birmingham New Street · when: 07:30', ok: true, note: undefined },
    { tool: 'web_search', args: 'query: rail strike Birmingham', ok: false, note: 'no search key answered' },
  ]);
  const lines = A.whyLines(t, A.brainAbilities(() => true));
  assert.equal(lines[0], 'You asked: “how do I get to New Street by train tomorrow?”');
  assert.equal(lines[1], '1. Planned journey — to: Birmingham New Street · when: 07:30: it worked.');
  assert.match(lines[2], /^ {3}Why: you asked about “train”, and I can plan door-to-door journeys by bus, tram, train/);
  assert.equal(lines[3], '2. Used web search — query: rail strike Birmingham: it didn’t work (no search key answered).');
  assert.match(lines[4], /^ {3}Why: .*I can search the web and read any page or JSON\.$/);
  assert.equal(lines.at(-1), 'In my words: “I checked for strikes because one was planned this week.”');
  // an approval still waiting says so; a turn with nothing run says it answered from what it knows
  const r2 = W.trailRecorder('send the email to Sam');
  r2.note({ t: 'approval', id: 'c', name: 'send_email', args: { to: 'sam@example.com', subject: 'Hi' }, reason: 'Send an email' });
  assert.match(A.whyLines(r2.trail(), []).join('\n'), /1\. Sent email — to: sam@example\.com · subject: Hi: waiting for your approval\.\n {3}Why: it was the way to answer you\./);
  assert.deepEqual(A.whyLines({ at: 1, asked: 'hello', steps: [] }, []), ['You asked: “hello”', 'I didn’t run anything for that one: I answered from what I know.']);
  // a number plate is never kept: not in the question, the arguments or the reply
  const r3 = W.trailRecorder('check AB12 CDE');
  r3.note({ t: 'tool', id: 'v', name: 'vehicle_check', args: { plate: 'AB12CDE' } });
  r3.note({ t: 'tool_result', id: 'v', name: 'vehicle_check', ok: true, summary: 'FORD FIESTA…' });
  r3.note({ t: 'text', text: 'AB12 CDE is a Ford Fiesta.' });
  const v = r3.trail();
  assert.equal(JSON.stringify(v).includes('AB12'), false);
  assert.equal(v.asked, 'a question about a vehicle');
});

test('"why?": the words that ask it, and the last turn kept for it (30 turns, two days)', async () => {
  for (const t of ['why?', 'Why', 'how come?', 'but why']) assert.equal(A.whyAsked(t), 'bare', t);
  for (const t of ['why did you do that?', "why'd you do that", 'what made you do that?', 'why did you open that', 'Why did you do that?!']) assert.equal(A.whyAsked(t), 'full', t);
  for (const t of ['why is the sky blue?', 'why not', 'what did you do today']) assert.equal(A.whyAsked(t), null, t);
  const storage = new MemStorage();
  assert.equal(await W.whyReply(storage, 'why?'), null, 'nothing kept yet');
  const now = Date.now();
  for (let i = 0; i < 35; i++) await W.keepTrail(storage, { at: now - (35 - i) * 1000, asked: `q${i}`, steps: [] }, now);
  await W.keepTrail(storage, { at: now - 3 * 86_400_000, asked: 'old', steps: [] }, now);
  const kept = await W.loadTrails(storage);
  assert.equal(kept.length, 30);
  assert.equal(kept.at(-1).asked, 'old', 'the newest written last');
  await W.keepTrail(storage, { at: now, asked: 'newest', steps: [] }, now);
  assert.ok(!(await W.loadTrails(storage)).some((t) => t.asked === 'old'), 'two days old: gone');
  assert.equal(await W.whyReply(storage, 'why?'), null, 'a bare why after a reply that ran nothing is for the model');
  assert.match(await W.whyReply(storage, 'why did you do that?'), /^Why I did that:\nYou asked: “newest”\nI didn’t run anything/);
  assert.equal(await W.whyReply(storage, 'hello'), null);
});
