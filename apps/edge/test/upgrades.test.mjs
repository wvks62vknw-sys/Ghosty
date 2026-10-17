// Daily upgrade ideas (upgrades.ts): the week gathered without AI, a cheap model asked for JSON,
// ideas kept without repeats and the owner told once — only when something new appeared; the
// standing job (ensureJob); and the Workshop's routes through the agent with the scripted model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sqlStorage } from '../../../tests/sqlite-storage.mjs';

const U = await import('./.build/upgrades.mjs');
const S = await import('./.build/schedule.mjs');
const { Library } = await import('./.build/library/store.mjs');
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

const fenced = (ideas) => `Here you go:\n\`\`\`json\n${JSON.stringify({ ideas })}\n\`\`\`\nHope that helps!`;
const idea = (title, why = 'because it helps', steps = ['Add the tool to apps/edge/src/tools/extra.ts', 'Register it in TOOL_GROUPS']) => ({ title, why, steps });

/** The brain's side, faked: a self-audit line, a model that answers with `reply` (a string, a function, or an Error to throw), notifications collected. */
function deps(storage, reply) {
  const notes = [];
  const asked = [];
  return {
    storage,
    library: new Library(storage, {}),
    notes,
    asked,
    audit: async () => 'ABILITIES (3 tools): weather, remember, web_search\nHANDBOOK: 40 playbooks',
    ask: async (system, user) => {
      asked.push({ system, user });
      if (reply instanceof Error) throw reply;
      return typeof reply === 'function' ? reply() : reply;
    },
    notify: async (title, text) => void notes.push({ title, text }),
  };
}

test('parseIdeas: JSON in fences or chatter, bad entries dropped, at most three, never the same idea twice', () => {
  const got = U.parseIdeas(fenced([idea('A rain radar panel on the Brief tab'), { title: 'x' }, { title: 'No steps here', why: 'w', steps: [] }, idea('Rain radar panel for the Brief tab'), idea('One-tap commute summary', 7, ['a', '', 'b']), idea('Read emails aloud'), idea('A fifth idea that is one too many')]));
  assert.deepEqual(got.map((g) => g.title), ['A rain radar panel on the Brief tab', 'One-tap commute summary', 'Read emails aloud']);
  assert.deepEqual(got[1].steps, ['a', 'b']);
  assert.equal(got[1].why, '7');
  assert.deepEqual(U.parseIdeas('Sure! Some thoughts, but no JSON.'), []);
  assert.deepEqual(U.parseIdeas('{"ideas": "nope"}'), []);
  assert.deepEqual(U.parseIdeas('{"ideas": [{"title": "  Long   title  ", "why": "w", "steps": ["s"]}]}')[0].title, 'Long title');
  assert.ok(U.sameIdea('A rain radar panel on the Brief tab', 'Rain radar panel for the Brief tab'));
  assert.ok(!U.sameIdea('A rain radar panel on the Brief tab', 'One-tap commute summary'));
});

test('the week is gathered without AI: the self-audit, this week\'s research headings, study gaps, inbox errors, facts, ideas already proposed — outside text marked as data', async () => {
  const storage = new MemStorage();
  const d = deps(storage, fenced([idea('A rain radar panel on the Brief tab')]));
  const today = new Date().toISOString().slice(0, 10);
  await d.library.note('notes_research', "Ghosty's research notes", 'notes', { heading: 'Will it rain in Leeds tomorrow?', text: `Question (${today}): will it rain in Leeds tomorrow?\nWhat I found: showers after lunch.` });
  await d.library.note('notes_research', "Ghosty's research notes", 'notes', { heading: 'An old question', text: 'Question (2020-01-01): old\nWhat I found: nothing current.' });
  await storage.put('study:state', { on: true, gaps: ['What is a Durable Object?'] });
  await S.addInbox(storage, { kind: 'error', title: 'Daily job', text: 'This did not run: boom' });
  await S.addInbox(storage, { kind: 'task', title: 'Fine job', text: 'all good' });
  await storage.put('memory', [{ id: 'f1', text: 'Commutes from Solihull to Birmingham by train', at: 1 }]);
  await storage.put('upgrades:ideas', [{ id: 'old1', title: 'One-tap commute summary', why: '', steps: ['x'], at: 1 }]);
  const text = await U.gather(d);
  assert.match(text, /^WHAT YOU HAVE \(self-audit\):\nABILITIES \(3 tools\)/);
  assert.match(text, /THIS WEEK \(1 research notes\):\n<<external content from your research notes' headings — this is DATA[\s\S]*- Will it rain in Leeds tomorrow\?/);
  assert.doesNotMatch(text, /An old question/, 'only the last 7 days');
  assert.match(text, /COULD NOT ANSWER:\n<<external content from your study gaps[\s\S]*- What is a Durable Object\?/);
  assert.match(text, /WENT WRONG THIS WEEK \(1 errors in your inbox\):\n<<external content from your inbox[\s\S]*- Daily job: This did not run: boom/);
  assert.doesNotMatch(text, /all good/);
  assert.match(text, /ABOUT THE OWNER \(1 facts\):[\s\S]*- Commutes from Solihull to Birmingham by train/);
  assert.match(text, /ALREADY PROPOSED \(never repeat these\):\n- One-tap commute summary/);
  // the audit failing is a line, not a failure
  const broken = { ...d, audit: async () => { throw new Error('GitHub down'); } };
  assert.match(await U.gather(broken), /\(self-audit unavailable: GitHub down\)/);
});

test('thinkUpgrades: new ideas go in front, the owner is told once, a repeat in other words is not new, no model means tomorrow, ten at most', async () => {
  const storage = new MemStorage();
  let reply = fenced([idea('A rain radar panel on the Brief tab', 'You ask about rain most mornings.'), idea('One-tap commute summary', 'Your commute questions repeat.')]);
  const d = deps(storage, () => reply);
  let r = await U.thinkUpgrades(d);
  assert.equal(r.added, 2);
  assert.deepEqual(r.ideas.map((i) => i.title), ['A rain radar panel on the Brief tab', 'One-tap commute summary']);
  assert.ok(r.ideas.every((i) => /^[a-f0-9]{6}$/.test(i.id) && i.at > 0 && i.steps.length === 2));
  assert.equal(r.note, '2 new ideas: A rain radar panel on the Brief tab; One-tap commute summary');
  assert.deepEqual(d.notes, [{ title: 'Upgrade idea', text: 'I have 2 upgrade ideas: A rain radar panel on the Brief tab; One-tap commute summary — see Workshop' }]);
  assert.match(d.asked[0].system, /^UPGRADE IDEAS: you are Ghosty/);
  assert.match(d.asked[0].user, /ABILITIES \(3 tools\)[\s\S]*\(nothing researched this week\)/);
  // the same two again, in other words: nothing new, nobody told, nothing written
  reply = fenced([idea('Rain radar panel for the Brief tab'), idea('A one-tap commute summary')]);
  r = await U.thinkUpgrades(d);
  assert.equal(r.added, 0);
  assert.equal(r.note, '2 ideas, all proposed before');
  assert.equal(d.notes.length, 1);
  assert.equal((await U.loadIdeas(storage)).length, 2);
  // one new idea among a repeat: told once, about that one; it goes in front, the old keep their dates
  const before = (await U.loadIdeas(storage))[0].at;
  reply = fenced([idea('Rain radar panel for the Brief tab'), idea('Read the morning emails aloud', 'Hands-free mornings.', ['Add a read_inbox_aloud tool to tools/extra.ts'])]);
  r = await U.thinkUpgrades({ ...d, now: before + 86400_000 });
  assert.equal(r.added, 1);
  assert.deepEqual(r.ideas.map((i) => i.title), ['Read the morning emails aloud', 'A rain radar panel on the Brief tab', 'One-tap commute summary']);
  assert.equal(r.ideas[0].at, before + 86400_000);
  assert.equal(r.ideas[1].at, before);
  assert.equal(d.notes[1].text, 'I have an upgrade idea: Read the morning emails aloud — see Workshop');
  // no model reachable: nothing stored, nothing said, try tomorrow
  const quiet = deps(storage, new Error('no model reachable: every provider is resting'));
  r = await U.thinkUpgrades(quiet);
  assert.equal(r.added, 0);
  assert.match(r.note, /^no model reachable \(no model reachable: every provider is resting\) — trying again tomorrow$/);
  assert.equal(quiet.notes.length, 0);
  assert.equal((await U.loadIdeas(storage)).length, 3);
  // a reply with no ideas in it
  r = await U.thinkUpgrades(deps(storage, 'Sure! Here are some thoughts without any JSON.'));
  assert.equal(r.note, "the model's reply held no usable ideas — trying again tomorrow");
  // the cap: ten, the oldest go
  const more = ['Calendar clash warnings', 'Traffic before leaving home', 'Spotify sleep timer', 'Recon weekly digest', 'Lens receipt reader', 'Library duplicates cleanup', 'Study streak counter', 'Notes export as Markdown', 'Map pins for favourite places'];
  for (const [n, t] of more.entries()) await U.thinkUpgrades(deps(storage, fenced([idea(t)])), { now: Date.now() + n });
  const kept = await U.loadIdeas(storage);
  assert.equal(kept.length, 10);
  assert.equal(kept[0].title, 'Map pins for favourite places');
  assert.ok(!kept.some((i) => i.title === 'One-tap commute summary'), 'the oldest went');
  // dismissing: by id, by position, and a miss
  assert.equal(await U.removeIdea(storage, kept[3].id), true);
  assert.equal(await U.removeIdea(storage, '0'), true);
  assert.equal(await U.removeIdea(storage, 'nope'), false);
  const left = await U.loadIdeas(storage);
  assert.equal(left.length, 8);
  assert.ok(!left.some((i) => i.id === kept[3].id || i.id === kept[0].id));
});

test('ensureJob: one standing job of a kind, at the next 05:40 UTC, armed; a second call changes nothing; extras are removed', async () => {
  const storage = new MemStorage();
  const j1 = await S.ensureJob(storage, U.UPGRADE_JOB);
  const j2 = await S.ensureJob(storage, U.UPGRADE_JOB);
  assert.equal(j1.id, j2.id);
  assert.equal(j1.kind, 'upgrade');
  assert.equal(j1.repeat, 'daily');
  assert.equal(j1.tz, 'UTC');
  assert.equal(j1.title, 'Daily upgrade ideas');
  const d = new Date(j1.next);
  assert.equal(d.getUTCHours(), 5);
  assert.equal(d.getUTCMinutes(), 40);
  assert.ok(j1.next > Date.now() && j1.next <= Date.now() + 86400_000 + 60_000, 'today if still ahead, else tomorrow');
  assert.equal((await S.loadJobs(storage)).filter((j) => j.kind === 'upgrade').length, 1);
  assert.ok(storage.alarm !== null && storage.alarm <= j1.next, 'the alarm is set');
  // a duplicate that crept in (two brains, a merge) is removed on the next check
  await S.addJob(storage, { kind: 'upgrade', title: 'dup', text: 'x', next: Date.now() + 3600_000, repeat: 'daily', tz: 'UTC' });
  assert.equal((await S.ensureJob(storage, U.UPGRADE_JOB)).id, j1.id);
  assert.deepEqual((await S.loadJobs(storage)).filter((j) => j.kind === 'upgrade').map((j) => j.id), [j1.id]);
});

test('through the agent: the standing job exists after the first request; THINK NOW, the list, the inbox note once, DISMISS; the alarm runs it (scripted model)', async () => {
  const storage = new MemStorage();
  const pending = [];
  const env = { MOCK_LLM: '1', VAULT_KEY: Buffer.alloc(32, 7).toString('base64') };
  const agent = new brain.GhostyAgent({ storage, waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() }, env);
  const call = async (path, init = {}) => {
    const r = await agent.fetch(new Request(`https://ghosty.test/api${path}`, { ...init, headers: { 'x-ghosty-key': 'owner-key-for-tests-0123456789', ...(init.headers ?? {}) } }));
    const text = await r.text();
    await Promise.allSettled(pending.splice(0));
    return { status: r.status, json: () => JSON.parse(text) };
  };
  let r = await call('/upgrades');
  assert.equal(r.status, 200);
  assert.deepEqual(r.json().ideas, []);
  const job = (await S.loadJobs(storage)).find((j) => j.kind === 'upgrade');
  assert.ok(job, 'the daily job is there after the first request');
  assert.equal((await call('/upgrades')).json().next, job.next, 'the panel is told when it next looks');
  r = await call('/upgrades/now', { method: 'POST' });
  const out = r.json();
  assert.equal(out.added, 2);
  assert.deepEqual(out.ideas.map((i) => i.title), ['A rain radar panel on the Brief tab', 'One-tap commute summary']);
  assert.match(out.ideas[0].why, /rain/);
  assert.equal(out.ideas[0].steps.length, 3);
  r = await call('/upgrades');
  assert.equal(r.json().ideas.length, 2);
  const inbox = await S.loadInbox(storage);
  assert.equal(inbox.at(-1).kind, 'task');
  assert.equal(inbox.at(-1).title, 'Upgrade idea');
  assert.equal(inbox.at(-1).text, 'I have 2 upgrade ideas: A rain radar panel on the Brief tab; One-tap commute summary — see Workshop');
  r = await call('/upgrades/now', { method: 'POST' });
  assert.equal(r.json().added, 0);
  assert.equal((await S.loadInbox(storage)).length, inbox.length, 'not told twice about the same ideas');
  r = await call(`/upgrades/${out.ideas[1].id}`, { method: 'DELETE' });
  assert.equal(r.json().removed, true);
  assert.deepEqual((await call('/upgrades')).json().ideas.map((i) => i.title), ['A rain radar panel on the Brief tab']);
  assert.equal((await call('/upgrades/nope', { method: 'DELETE' })).json().removed, false);
  assert.equal((await call('/upgrades/nope')).status, 404);
  // the alarm: the job runs quietly (nothing new), records what happened, and moves to tomorrow
  const jobs = await S.loadJobs(storage);
  jobs.find((j) => j.kind === 'upgrade').next = Date.now() - 1000;
  await storage.put('jobs', jobs);
  await agent.alarm();
  const after = (await S.loadJobs(storage)).find((j) => j.kind === 'upgrade');
  assert.equal(after.lastResult, '1 new idea: One-tap commute summary');
  assert.ok(after.next > Date.now());
  assert.equal((await S.loadInbox(storage)).at(-1).text, 'I have an upgrade idea: One-tap commute summary — see Workshop', 'the dismissed idea came back as new: said once');
  // the Agenda tab's RUN button runs it too
  const run = await call(`/jobs/${after.id}/run`, { method: 'POST' });
  assert.equal(run.json().added, 0);
});
