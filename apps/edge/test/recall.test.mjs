// MEMORY AND RECALL (BRIEF-DEPTH-MEMORY): his turns kept 30 days, RECALL in a reply's context within the prompt's ceiling, the
// `recall` tool, FORGET and UNDO on a turn, the chase watcher, and the index code kept away from faces and the speaker.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: ['../src/mind.ts', '../src/prompt.ts', '../src/recall.ts', '../src/memories.ts', '../src/tools/memory.ts', '../src/watchers.ts', '../../../packages/shared/src/recall.ts'].map(at),
  bundle: true, format: 'esm', platform: 'neutral', external: ['cloudflare:sockets'], outdir: at('./.build/recall'), outbase: at('../../..'), outExtension: { '.js': '.mjs' }, logLevel: 'warning',
});
const B = './.build/recall/';
const M = await import(`${B}apps/edge/src/mind.mjs`);
const P = await import(`${B}apps/edge/src/prompt.mjs`);
const R = await import(`${B}apps/edge/src/recall.mjs`);
const Mm = await import(`${B}apps/edge/src/memories.mjs`);
const T = await import(`${B}apps/edge/src/tools/memory.mjs`);
const W = await import(`${B}apps/edge/src/watchers.mjs`);
const S = await import(`${B}packages/shared/src/recall.mjs`);

class Mem {
  m = new Map();
  async get(k) {
    if (Array.isArray(k)) return new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))]));
    return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined;
  }
  async put(k, v) { this.m.set(k, structuredClone(v)); }
  async delete(k) { return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k); }
  async list() { return new Map(); }
}

const TZ = 'Europe/London';
// Thursday 12 November 2026, 10:00 in London (GMT)
const NOW = Date.parse('2026-11-12T10:00:00Z');
const D = 86_400_000;
const client = { name: 'Aqis', tz: TZ };

/** A week of his turns, each with my reply in the history: Tuesday's trains on Telegram, Monday's garden, this morning's dentist. */
async function week() {
  const storage = new Mem();
  await storage.put('owner:ctx', { tz: TZ });
  const said = [
    [NOW - 9 * D, 'app', 'what should I plant in the garden in november', 'Garlic and broad beans go in now.'],
    [NOW - 3 * D, 'app', 'how do I fix a squeaky door', 'A drop of oil on the hinge pin.'],
    [Date.parse('2026-11-10T08:15:00Z'), 'telegram', 'what are the trains to Leeds tomorrow morning', 'The 07:12 from New Street is quickest. It takes two hours.'],
    [NOW - 2.5 * 3600_000, 'app', 'book the dentist for next week', 'Done: Tuesday at 9.'],
  ];
  const turns = [];
  for (const [t, via, q, a] of said) {
    await M.observe(storage, { kind: 'turn', text: M.turnGist(q), via }, t);
    turns.push({ role: 'user', text: q, at: t }, { role: 'assistant', text: a, at: t + 4000 });
  }
  await storage.put('turns', turns);
  return storage;
}

test('a week of turns: RECALL picks the matching turn and today\'s, at most four, with the right day words', async () => {
  const storage = await week();
  // the ask in hand (observe runs before the snapshot, as agent.ts does)
  await M.observe(storage, { kind: 'turn', text: M.turnGist('are there trains to Leeds on Saturday?'), via: 'app' }, NOW - 1000);
  const m = await M.mindSnapshot(storage, { client, now: NOW });
  assert.ok(m.recall && m.recall.length <= S.RECALL_LINES, JSON.stringify(m.recall));
  assert.equal(m.recall[0].day, 'on Tuesday', 'the matching turn first, its day said');
  assert.match(m.recall[0].q, /trains to Leeds tomorrow/);
  assert.match(m.recall[0].a, /^The 07:12 from New Street is quickest\.$/, 'what I said, its first sentence');
  assert.ok(m.recall.some((r) => r.day === 'today' && /dentist/.test(r.q)), 'today\'s earlier turn too');
  assert.ok(!m.recall.some((r) => /Saturday/.test(r.q)), 'never the ask in hand');
  assert.ok(!m.recall.some((r) => /garden/.test(r.q)), 'older than a week and not matching: left out');
  const lines = P.contextLines(m, client);
  const line = lines.find((l) => l.startsWith(P.RECALL_HEAD));
  assert.ok(line && /Tuesday: "what are the trains to Leeds/.test(line), line);
  assert.equal(S.dayWord(NOW - D, NOW, TZ), 'yesterday');
  assert.equal(S.dayWord(NOW - 10 * D, NOW, TZ), 'last week');
  assert.equal(S.dayWord(NOW - 2 * 3600_000, NOW, TZ), 'today');
});

test('the ceiling holds: RECALL shares the Earlier line\'s room, so the CONTEXT block and the whole prompt are no longer than before', () => {
  const base = P.baseMind(client, NOW);
  const long = (i) => `${'x'.repeat(138)} ${i}`;
  const recent = [1, 2, 3].map((i) => ({ at: NOW - i * 3600_000, kind: 'tool', text: long(i) }));
  const before = { ...base, recent };
  const recall = [1, 2, 3, 4].map((i) => ({ at: NOW - i * D, via: 'app', day: 'on Tuesday', q: 'q'.repeat(120), a: 'a'.repeat(120) }));
  const after = { ...base, recent, recall };
  const b = P.contextLines(before, client).join('\n').length;
  const a = P.contextLines(after, client).join('\n').length;
  console.log(`MEASURED the CONTEXT block at its longest: before ${b}, with RECALL ${a} (the room: ${P.HISTORY_CHARS})`);
  assert.ok(a <= b, `with RECALL ${a} > before ${b}`);
  const sysB = P.systemPrompt(client, [], true, [], { mind: before }).length;
  const sysA = P.systemPrompt(client, [], true, [], { mind: after }).length;
  console.log(`MEASURED the whole prompt with a full history: before ${sysB}, with RECALL ${sysA}`);
  assert.ok(sysA <= sysB);
  // and the Earlier line alone is as long as it always was (three 140-character episodes)
  assert.equal(P.contextLines(before, client).find((l) => l.startsWith('Earlier: ')).length, P.HISTORY_CHARS);
});

test('the recall tool: matching turns with their day and channel; nothing for a name he never said', async () => {
  const storage = await week();
  const tool = T.memoryTools.find((t) => t.name === 'recall');
  assert.ok(tool && tool.description.length <= 200, 'a short description');
  const ctx = { storage };
  const RealNow = Date.now;
  Date.now = () => NOW;
  try {
    const out = await tool.run({ about: 'trains' }, ctx);
    assert.match(out, /^Tue 10 Nov · Telegram \(on Tuesday, Telegram\): he asked “what are the trains to Leeds tomorrow morning”; you said “The 07:12/);
    assert.equal(await tool.run({ about: 'Bartholomew' }, ctx), 'Nothing like that in the last 30 days of our chats.');
    // the 30 days: a turn older than that is gone
    await M.observe(storage, { kind: 'turn', text: M.turnGist('trains to Bristol'), via: 'app' }, NOW - 31 * D);
    assert.ok(!(await tool.run({ about: 'Bristol' }, ctx)).includes('Bristol'));
  } finally {
    Date.now = RealNow;
  }
});

test('a forgotten turn is gone from recall and comes back with UNDO', async () => {
  const storage = await week();
  const deps = { storage, library: { available: false } };
  const hit = (await R.recallSearch(storage, 'squeaky door', NOW, TZ))[0];
  assert.ok(hit);
  assert.equal(await Mm.changeMemory(deps, `t:${hit.at}`, 'forget', undefined, NOW), null);
  assert.equal((await R.recallSearch(storage, 'squeaky door', NOW, TZ)).length, 0, 'gone');
  const f = (await Mm.recentlyForgotten(storage, NOW))[0];
  assert.equal(f.id, `t:${hit.at}`);
  assert.match(f.text, /squeaky door/);
  await Mm.changeMemory(deps, `t:${hit.at}`, 'restore', undefined, NOW + 1000);
  assert.equal((await R.recallSearch(storage, 'squeaky door', NOW, TZ)).length, 1, 'back');
});

test('FORGET from the phone, whose clock stamped the turn a moment earlier, still finds the brain\'s gist; CLEAR CONVERSATION takes them all', async () => {
  const storage = await week();
  const deps = { storage, library: { available: false } };
  const hit = (await R.recallSearch(storage, 'squeaky door', NOW, TZ))[0];
  // the phone's time for the same message: 1.5 seconds before the brain noted it
  await Mm.changeMemory(deps, `t:${hit.at - 1500}`, 'forget', undefined, NOW);
  assert.equal((await R.recallSearch(storage, 'squeaky door', NOW, TZ)).length, 0);
  await Mm.changeMemory(deps, `t:${hit.at - 1500}`, 'restore', undefined, NOW + 1000);
  assert.equal((await R.recallSearch(storage, 'squeaky door', NOW, TZ)).length, 1);
  // a time nowhere near a turn forgets nothing
  await assert.rejects(Mm.changeMemory(deps, `t:${hit.at - 10 * 60_000}`, 'forget', undefined, NOW), /not there/);
  await Mm.clearPatterns(storage);
  assert.equal((await R.loadGists(storage)).length, 0, 'CLEAR CONVERSATION and forget_everything take the gists');
});

test('a chase: said once, checked only on its morning, and the right one of its lines; without mail a dated reminder', async () => {
  // Wednesday 11 Nov 2026, 15:00: "remind me to chase this if Sam doesn't reply by Thursday"
  const asked = S.chaseAsked("remind me to chase this if Sam doesn't reply by Thursday");
  assert.deepEqual(asked, { who: 'Sam', day: 'thursday' });
  assert.deepEqual(S.chaseAsked('chase it up if they haven\'t answered by Friday'), { who: '', day: 'friday' });
  assert.equal(S.chaseAsked('chase the cat'), null);
  for (const t of ['what are you chasing?', 'any chases', 'who am I chasing']) assert.ok(S.chasingAsked(t), t);
  assert.ok(!S.chasingAsked('chase the cat'));
  // "by today" said after 9 am: never a time already gone
  const late = Date.parse('2026-11-12T15:00:00Z');
  assert.ok(S.chaseAt('today', late, TZ) > late);
  const run = async (came) => {
    const storage = new Mem();
    await storage.put('owner:ctx', { tz: TZ });
    const notes = [];
    let now = Date.parse('2026-11-11T15:00:00Z');
    const d = { storage, notify: async (n) => void notes.push(n), now: () => now, replied: async () => came };
    const r = await W.addChase(d, { kind: 'reply', who: asked.who, day: asked.day, about: 'the invoice', tz: TZ });
    const w = r.watcher;
    assert.equal(w.by, Date.parse('2026-11-12T09:00:00Z'), 'Thursday 9 am in London');
    now = Date.parse('2026-11-12T08:00:00Z');
    assert.deepEqual(await W.watchersTick(d), [], 'not before its morning');
    now = Date.parse('2026-11-12T09:05:00Z');
    const told = await W.watchersTick(d);
    assert.equal(told.length, 1);
    now += 3600_000;
    assert.deepEqual(await W.watchersTick(d), [], 'told once');
    return { said: r.said, told: told[0], notes, listed: (await W.loadWatchers(storage)).map(W.publicWatcher) };
  };
  const replied = await run(Date.parse('2026-11-11T18:30:00Z'));
  assert.equal(replied.said, "If nothing comes from Sam by Thursday 9 am, I'll remind you to chase it.");
  assert.equal(replied.told, 'Sam replied on Wednesday; nothing to chase.');
  assert.equal(replied.listed[0].kind, 'reply');
  assert.equal(replied.listed[0].state, 'told');
  const none = await run(null);
  assert.equal(none.told, 'No reply from Sam yet: “the invoice”. DRAFT A CHASE writes one for your OK.');
  assert.equal(none.notes[0].title, 'Chase Sam');
  // the mail he meant (the Brief's line from Sam): the morning's look is by its address; a bad address is dropped
  {
    const storage = new Mem();
    let seen = null;
    const d = { storage, notify: async () => undefined, now: () => Date.parse('2026-11-11T15:00:00Z'), replied: async (w) => ((seen = w), null) };
    const r = await W.addChase(d, { kind: 'reply', who: 'Sam', day: 'thursday', about: 'Invoice 42', from: 'sam@example.com', tz: TZ });
    assert.equal(r.watcher.from, 'sam@example.com');
    assert.equal(r.watcher.label, 'Chase Sam: Invoice 42');
    assert.equal((await W.addChase(d, { kind: 'reply', who: 'Sam', day: 'thursday', from: 'not an address', tz: TZ })).watcher.from, undefined);
    void seen;
  }
  const nomail = await run(undefined);
  assert.equal(nomail.said, "No mail account is linked, so on Thursday 9 am I'll simply remind you to chase Sam.");
  assert.equal(nomail.told, 'Time to chase Sam: “the invoice”. DRAFT A CHASE writes one for your OK.');
  assert.equal(nomail.listed[0].mail, false);
});

test('the next round: a chase holds for a second look ("and again Monday"), a parcel is settled by a delivery email, and a pinned turn stays past 30 days', async () => {
  assert.deepEqual(S.chaseAsked("remind me to chase this if Sam doesn't reply by Thursday and again Monday if still nothing"), { who: 'Sam', day: 'thursday', again: 'monday' });
  assert.deepEqual(S.chaseAsked("remind me if the parcel hasn't come by Friday"), { who: '', day: 'friday', wait: 'parcel' });
  for (const t of ['what was I asking you about the boiler', 'did we talk about the holiday', 'what did we decide about the car']) assert.ok(S.recallAsked(t), t);
  const storage = new Mem();
  await storage.put('owner:ctx', { tz: TZ });
  const notes = [];
  let now = Date.parse('2026-11-11T15:00:00Z');
  let came = null;
  const d = { storage, notify: async (n) => void notes.push(n), now: () => now, replied: async () => came };
  const r = await W.addChase(d, { kind: 'reply', who: 'Sam', day: 'thursday', again: 'monday', tz: TZ });
  assert.match(r.said, /If there's still nothing, I'll look again on Monday 9 am\.$/);
  now = Date.parse('2026-11-12T09:05:00Z');
  const first = await W.watchersTick(d);
  assert.match(first[0], /^No reply from Sam yet\. DRAFT A CHASE writes one for your OK\. If there's still nothing, I'll look again on Monday 9 am\.$/);
  assert.equal((await W.loadWatchers(storage))[0].state, 'watching', 'it holds for the second look');
  now = Date.parse('2026-11-16T09:05:00Z');
  came = Date.parse('2026-11-14T10:00:00Z');
  assert.deepEqual(await W.watchersTick(d), ['Sam replied on Saturday; nothing to chase.']);
  assert.equal((await W.loadWatchers(storage))[0].state, 'told');
  // a parcel
  const p = await W.addChase({ ...d, now: () => Date.parse('2026-11-11T15:00:00Z') }, { kind: 'reply', who: '', day: 'friday', wait: 'parcel', tz: TZ });
  assert.equal(p.said, "On Friday 9 am I'll look in your email for a delivery; if there's none, I'll remind you to chase the parcel.");
  assert.equal(p.watcher.label, 'The parcel');
  came = null;
  now = Date.parse('2026-11-13T09:05:00Z');
  assert.deepEqual(await W.watchersTick(d), ['No delivery email yet. Chase the seller, or tell me it came.']);
  // a pinned turn stays past the 30 days; FORGET's neighbour, LOCK on a turn, is its pin
  const st = new Mem();
  await st.put('owner:ctx', { tz: TZ });
  await M.observe(st, { kind: 'turn', text: M.turnGist('the boiler code is E119'), via: 'app' }, NOW - 25 * D);
  await Mm.changeMemory({ storage: st, library: { available: false } }, `t:${NOW - 25 * D - 1500}`, 'lock', undefined, NOW);
  assert.equal((await R.recallSearch(st, 'boiler code', NOW + 10 * D, TZ)).length, 1, 'still there on day 35');
});

test('"what did I ask you about X?" in its wordings; the RECALL chip\'s words; nothing about anyone he never named', () => {
  for (const [t, about] of [['what did I ask you about trains?', 'trains'], ['When did I mention the boiler', 'boiler'], ['did I tell you about my knee', 'knee'], ['find where I said garden', 'garden'], ['what have I asked you about Leeds', 'Leeds']]) assert.equal(S.recallAsked(t), about, t);
  for (const t of ['what did you do today?', 'what trains go to Leeds', 'tell me about trains']) assert.equal(S.recallAsked(t), null, t);
  assert.equal(S.recallSaid('Like you said on Tuesday, the 07:12 is quickest.'), 'on tuesday');
  assert.equal(S.recallSaid('As you mentioned yesterday, it rains.'), 'yesterday');
  assert.equal(S.recallSaid('The 07:12 is quickest.'), null);
  // a gist is his own words and my answer: no other field, nothing inferred
  assert.deepEqual(Object.keys(S.matchGists('trains', [{ at: NOW - D, via: 'app', q: 'trains to Leeds' }], { now: NOW, tz: TZ })[0]).sort(), ['at', 'day', 'q', 'score', 'stamp', 'via']);
});

test('nothing in the recall or index code imports the camera, faces or the speaker', () => {
  const files = ['../src/recall.ts', '../../../packages/shared/src/recall.ts', '../../web/src/features/memory/recall.ts', '../../web/src/features/memory/recallturn.ts', '../../web/src/features/memory/recallcard.ts'];
  for (const f of files) {
    const src = readFileSync(at(f), 'utf8');
    const imports = [...src.matchAll(/from '([^']+)'|import\('([^']+)'\)/g)].map((m) => m[1] ?? m[2]);
    for (const i of imports) assert.ok(!/vision|faces?\b|face\/|speaker|voiceprint|voiceknown|camera/i.test(i), `${f} imports ${i}`);
  }
});
