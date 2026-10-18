// A memory of the owner: the profile (lines in their own words, the summary, what goes to the
// prompt), the nightly reflection (one cheap model call over the day's turns → facts, profile
// lines, a diary entry; never a secret, never twice over the same turns, skipped quietly with no
// model), the daily jobs (exactly one of each), and the Memory tab's routes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sqlStorage } from '../../../tests/sqlite-storage.mjs';

const P = await import('./.build/profile.mjs');
const S = await import('./.build/schedule.mjs');
const { Library } = await import('./.build/library/store.mjs');
const brain = await import('./.build/brain.mjs');

class MemStorage {
  m = new Map();
  sql = sqlStorage();
  async get(k) { return Array.isArray(k) ? new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))])) : this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b)); else this.m.set(k, structuredClone(v)); }
  async delete(k) { return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k); }
  async list({ prefix = '' } = {}) { return new Map([...this.m].filter(([k]) => k.startsWith(prefix))); }
  alarm = null;
  async setAlarm(t) { this.alarm = t; }
  async getAlarm() { return this.alarm; }
}

const profileWith = (sections, summary = '') => {
  const p = P.emptyProfile();
  p.summary = summary;
  for (const [s, lines] of Object.entries(sections)) p.sections[s] = lines;
  return p;
};

test('profileLines: the summary first, then the fullest sections in turn, newest first, up to the limit', () => {
  const p = profileWith({ likes: ['tea', 'rain', 'jazz'], people: ['Ann is my sister'], work: ['builds bridges', 'works from home'] }, 'A bridge engineer in Birmingham.');
  assert.deepEqual(P.profileLines(p, 14), ['A bridge engineer in Birmingham.', 'likes: jazz', 'work: works from home', 'people: Ann is my sister', 'likes: rain', 'work: builds bridges', 'likes: tea']);
  assert.deepEqual(P.profileLines(p, 3), ['A bridge engineer in Birmingham.', 'likes: jazz', 'work: works from home']);
  assert.deepEqual(P.profileLines(P.emptyProfile()), []);
});

test('lines: deduped whatever the case or section, cut to 160 characters, at most 40 a section, secrets refused, removable by index', () => {
  const p = P.emptyProfile();
  assert.equal(P.addProfileLine(p, 'likes', '  flat   whites '), true);
  assert.equal(P.addProfileLine(p, 'likes', 'Flat whites'), false, 'already there');
  assert.equal(P.addProfileLine(p, 'other', 'flat whites'), false, 'already there under another section');
  assert.equal(P.addProfileLine(p, 'about', 'my card is 4111 1111 1111 1111'), false, 'a card number never goes in');
  assert.equal(P.addProfileLine(p, 'about', 'the wifi password is hunter2'), false);
  assert.equal(P.addProfileLine(p, 'about', ''), false);
  assert.equal(P.addProfileLine(p, 'about', 'x'.repeat(300)), true);
  assert.equal(p.sections.about[0].length, 160);
  for (let i = 0; i < 45; i++) P.addProfileLine(p, 'goals', `goal ${i}`);
  assert.equal(p.sections.goals.length, 40);
  assert.equal(p.sections.goals[0], 'goal 5', 'the oldest went');
  assert.equal(P.removeProfileLine(p, 'likes', 0), true);
  assert.deepEqual(p.sections.likes, []);
  assert.equal(P.removeProfileLine(p, 'likes', 0), false);
  assert.equal(P.removeProfileLine(p, 'goals', -1), false);
  assert.ok(p.updatedAt > 0);
  assert.equal(P.looksSecret('I was born in 1990'), false);
  assert.equal(P.looksSecret('my api key is abc'), true);
});

test('parseReflection: the JSON object out of fences and prose, with the shapes checked', () => {
  const r = P.parseReflection('Sure! ```json\n{"summary": " Likes tea. ", "facts": ["drinks tea", 7], "sections": {"likes": ["tea"], "nope": ["x"]}, "diary": "A quiet day."}\n```');
  assert.equal(r.summary, 'Likes tea.');
  assert.deepEqual(r.facts, ['drinks tea']);
  assert.deepEqual(r.sections.likes, ['tea']);
  assert.equal(r.sections.nope, undefined);
  assert.equal(r.diary, 'A quiet day.');
  assert.equal(P.parseReflection('no json here'), null);
  assert.equal(P.parseReflection('[1,2]'), null);
});

const T0 = Date.UTC(2026, 9, 17, 12, 0); // Sat 17 Oct 2026 12:00 UTC
const turns = (list, at = T0) => list.map(([role, text], i) => ({ role, text, at: at + i * 60_000 }));

test('the reflection: facts to the memory, lines to the profile, the diary to the library; secrets and web facts kept out; the same turns never twice', async () => {
  const st = new MemStorage();
  const lib = new Library(st, {});
  await st.put('owner:ctx', { tz: 'Europe/London' });
  await st.put('turns', turns([
    ['user', 'I like flat whites and I live in Kings Heath'],
    ['assistant', 'Noted. The web page I read says the moon is cheese.'],
    ['user', 'My sister Ann visits on Sundays'],
    ['assistant', 'Lovely.'],
  ]));
  const calls = [];
  const ai = async (system, user) => {
    calls.push({ system, user });
    return JSON.stringify({
      summary: 'Lives in Kings Heath, likes flat whites.',
      facts: ['likes flat whites', 'lives in Kings Heath', 'wifi password is hunter2'],
      sections: { likes: ['flat whites'], places: ['Kings Heath'], people: ['sister Ann visits on Sundays'], about: ['card 4111 1111 1111 1111'] },
      diary: 'Today the owner told me about their coffee and their sister. We decided nothing. Follow up: Sunday.',
    });
  };
  const r = await P.reflect({ storage: st, library: lib, ai }, T0 + 10 * 60_000);
  assert.equal(r.ok, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].user, /<<external content from today's conversation/);
  assert.match(calls[0].user, /OWNER \([^)]*\): I like flat whites/);
  assert.ok(!/GHOSTY \(/.test(calls[0].user), "Ghosty's own replies (which quote the web) stay out of the reflection");
  assert.match(calls[0].system, /ONLY things the OWNER said/);
  // the facts about the owner are kept; a password never is, whatever the model said
  assert.deepEqual(r.facts, ['likes flat whites', 'lives in Kings Heath']);
  const facts = st.m.get('memory').map((f) => f.text);
  assert.ok(!facts.some((f) => /hunter2/.test(f)), 'a password never becomes a fact');
  assert.deepEqual(r.lines, [{ section: 'likes', text: 'flat whites' }, { section: 'people', text: 'sister Ann visits on Sundays' }, { section: 'places', text: 'Kings Heath' }]);
  const profile = await P.loadProfile(st);
  assert.deepEqual(profile.sections.about, [], 'the card number never reaches the profile');
  assert.equal(profile.summary, 'Lives in Kings Heath, likes flat whites.');
  assert.equal(r.diary, 'Today the owner told me about their coffee and their sister. We decided nothing. Follow up: Sunday.');
  const diary = P.diaryEntries(lib);
  assert.equal(diary.length, 1);
  assert.equal(diary[0].heading, '2026-10-17', "the owner's day");
  assert.equal(lib.doc('notes_diary').kind, 'notes');
  assert.equal(st.m.get('reflect:last'), T0 + 10 * 60_000);
  // the same turns again: nothing new
  const again = await P.reflect({ storage: st, library: lib, ai }, T0 + 11 * 60_000);
  assert.equal(again.ok, false);
  assert.match(again.skipped, /nothing new/);
  assert.equal(calls.length, 1, 'no model call for nothing');
  // one more owner turn only: still nothing (two are needed)
  await st.put('turns', [...st.m.get('turns'), ...turns([['user', 'thanks']], T0 + 20 * 60_000)]);
  assert.equal((await P.reflect({ storage: st, library: lib, ai }, T0 + 30 * 60_000)).ok, false);
  // two more, and the second reflection of the day carries on the day's diary entry rather than adding a second
  await st.put('turns', [...st.m.get('turns'), ...turns([['user', 'I prefer tea in the evening'], ['user', 'and I go running on Tuesdays']], T0 + 40 * 60_000)]);
  const more = await P.reflect({ storage: st, library: lib, ai: async () => JSON.stringify({ sections: { routines: ['runs on Tuesdays'] }, diary: 'Later: running on Tuesdays.' }) }, T0 + 50 * 60_000);
  assert.equal(more.ok, true);
  assert.deepEqual(more.lines, [{ section: 'routines', text: 'runs on Tuesdays' }]);
  assert.equal(P.diaryEntries(lib).length, 1);
  assert.match(P.diaryEntries(lib)[0].text, /^Today the owner told me[\s\S]*\n\nLater: running on Tuesdays\.$/);
  assert.equal((await P.loadProfile(st)).summary, 'Lives in Kings Heath, likes flat whites.', 'no new summary keeps the old one');
});

test('no model free: the reflection is skipped quietly and the turns wait for the next run; a reply without JSON changes nothing', async () => {
  const st = new MemStorage();
  const lib = new Library(st, {});
  await st.put('turns', turns([['user', 'I like tea'], ['user', 'I like rain']]));
  const down = async () => { throw new Error('Every model I can reach is cooling down after rate limits.'); };
  const r = await P.reflect({ storage: st, library: lib, ai: down }, T0 + 60_000 * 5);
  assert.equal(r.ok, false);
  assert.match(r.skipped, /no model free/);
  assert.equal(st.m.get('reflect:last'), undefined, 'tomorrow looks at the same turns');
  assert.equal(st.m.get('profile'), undefined);
  const prose = await P.reflect({ storage: st, library: lib, ai: async () => 'I would rather not.' }, T0 + 60_000 * 5);
  assert.equal(prose.ok, false);
  assert.match(prose.skipped, /JSON/);
  assert.equal(st.m.get('reflect:last'), undefined);
});

test('ensureJob: exactly one job of a kind, due at the wall-clock time in the given zone; extras go; a new zone re-times it', async () => {
  const st = new MemStorage();
  const j1 = await S.ensureJob(st, { kind: 'reflect', title: 'Nightly reflection', text: 'x', hour: 3, minute: 20, tz: 'Europe/London', repeat: 'daily' });
  const j2 = await S.ensureJob(st, { kind: 'reflect', title: 'Nightly reflection', text: 'x', hour: 3, minute: 20, tz: 'Europe/London', repeat: 'daily' });
  assert.equal(j1.id, j2.id);
  assert.equal((await S.loadJobs(st)).length, 1);
  assert.equal(j1.repeat, 'daily');
  assert.ok(j1.next > Date.now() && j1.next <= Date.now() + 86_400_000, 'within a day');
  const d = new Date(j1.next).toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' });
  assert.equal(d, '03:20');
  // a stray second job of the kind is removed; the first is kept
  const jobs = await S.loadJobs(st);
  jobs.push({ ...jobs[0], id: 'extra' });
  await st.put('jobs', jobs);
  const j3 = await S.ensureJob(st, { kind: 'reflect', title: 'Nightly reflection', text: 'x', hour: 3, minute: 20, tz: 'Europe/London', repeat: 'daily' });
  assert.equal(j3.id, j1.id);
  assert.equal((await S.loadJobs(st)).length, 1);
  // the owner moved zones: the same job, re-timed
  const j4 = await S.ensureJob(st, { kind: 'reflect', title: 'Nightly reflection', text: 'x', hour: 3, minute: 20, tz: 'Asia/Tokyo', repeat: 'daily' });
  assert.equal(j4.id, j1.id);
  assert.equal(j4.tz, 'Asia/Tokyo');
  assert.equal(new Date(j4.next).toLocaleTimeString('en-GB', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' }), '03:20');
  assert.ok(st.alarm !== null, 'the alarm is armed');
});

test('in the brain: the ME and DIARY routes, REFLECT NOW through the mock model, the daily jobs made once, the nightly job quiet', async () => {
  const storage = new MemStorage();
  const pending = [];
  const state = { storage, waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() };
  const agent = new brain.GhostyAgent(state, { VAULT_KEY: Buffer.alloc(32, 7).toString('base64'), MOCK_LLM: '1' });
  const api = async (method, path, body) => {
    const r = await agent.fetch(new Request(`https://ghosty.test/api${path}`, { method, ...(body ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}) }));
    const text = await r.text();
    await Promise.allSettled(pending.splice(0));
    return { status: r.status, ...(text ? JSON.parse(text) : {}) };
  };
  // the daily jobs: one reflection, one digest, however many requests arrive
  await api('GET', '/profile');
  await api('GET', '/profile');
  const kinds = (await S.loadJobs(storage)).map((j) => j.kind).filter((k) => k !== 'study').sort();
  assert.deepEqual(kinds, ['digest', 'reflect', 'upgrade']);
  const empty = await api('GET', '/profile');
  assert.deepEqual(empty.profile.sections.likes, []);
  assert.deepEqual(empty.diary, []);
  assert.equal(empty.lastReflect, null);
  // add and remove by hand
  const added = await api('POST', '/profile', { section: 'people', text: 'Ann is my sister' });
  assert.equal(added.added, true);
  assert.deepEqual(added.profile.sections.people, ['Ann is my sister']);
  assert.equal((await api('POST', '/profile', { section: 'people', text: 'ann is my sister' })).added, false);
  assert.equal((await api('POST', '/profile', { section: 'about', text: 'my pin code is 1234' })).status, 400, 'secrets refused');
  assert.equal((await api('POST', '/profile', { section: 'about', text: '' })).status, 400);
  assert.equal((await api('DELETE', '/profile?section=nope&i=0')).status, 400);
  const removed = await api('DELETE', '/profile?section=people&i=0');
  assert.equal(removed.removed, true);
  assert.deepEqual(removed.profile.sections.people, []);
  // a day's chat, then REFLECT NOW: the mock model turns "I like …" into a fact, a profile line and a diary entry
  for (const message of ['I like flat whites', 'remember I like Birmingham']) {
    const r = await agent.fetch(new Request('https://ghosty.test/api/chat', { method: 'POST', body: JSON.stringify({ message }), headers: { 'content-type': 'application/json' } }));
    await r.text();
    await Promise.allSettled(pending.splice(0));
  }
  const ref = await api('POST', '/profile/reflect', {});
  assert.equal(ref.ok, true, JSON.stringify(ref));
  assert.deepEqual(ref.lines.map((l) => l.text), ['flat whites', 'Birmingham']);
  assert.ok(ref.facts.includes('likes flat whites'));
  const after = await api('GET', '/profile');
  assert.deepEqual(after.profile.sections.likes, ['flat whites', 'Birmingham']);
  assert.match(after.profile.summary, /flat whites/);
  assert.equal(after.diary.length, 1);
  assert.match(after.diary[0].text, /flat whites/);
  assert.ok(after.lastReflect > 0);
  assert.ok((await api('GET', '/memory')).facts.some((f) => f.text === 'likes flat whites'));
  // the nightly job from the alarm: quiet (no inbox item), and nothing new to look at
  const jobs = await S.loadJobs(storage);
  const job = jobs.find((j) => j.kind === 'reflect');
  job.next = Date.now() - 1000;
  await storage.put('jobs', jobs);
  await agent.alarm();
  const again = (await S.loadJobs(storage)).find((j) => j.kind === 'reflect');
  assert.ok(again && again.next > Date.now(), 'the job moved to tomorrow');
  assert.match(again.lastResult, /nothing new/);
  assert.equal((await api('GET', '/inbox')).items.length, 0, 'never a notification');
  // the Agenda tab's RUN NOW on the job is quiet too
  assert.match((await api('POST', `/jobs/${job.id}/run`)).result, /nothing new/);
});

// ---------- the TIMELINE: sources, edit / forget / UNDO / lock, and locks surviving the reflection (memories.ts) ----------

test('locked memories survive a reflection that tries to reword or drop them; unlocked ones change as the owner said', async () => {
  const st = new MemStorage();
  const lib = new Library(st, {});
  await st.put('owner:ctx', { tz: 'Europe/London' });
  const deps = { storage: st, library: lib };
  // what is known: two lines and two facts, one of each locked by the owner
  const p = P.emptyProfile();
  p.sections.places = ['lives in Kings Heath', 'works in Digbeth'];
  await st.put('profile', p);
  await st.put('memory', [
    { id: 'f1', text: 'drinks flat whites', at: T0 - 86_400_000, src: { kind: 'owner', at: T0 - 86_400_000 } },
    { id: 'f2', text: 'has a cat called Biscuit', at: T0 - 86_400_000 },
  ]);
  const before = await P.timeline(deps);
  const lineId = before.find((x) => x.text === 'lives in Kings Heath').id;
  assert.equal((await P.changeMemory(deps, lineId, 'lock')).locked, true);
  assert.equal((await P.changeMemory(deps, 'f:f1', 'lock')).locked, true);
  await st.put('turns', turns([['user', 'We moved to Moseley last week'], ['user', 'I stopped drinking coffee and I work from home now'], ['user', 'the cat is fine']]));
  // the model tries to rewrite and drop everything it knows
  const r = await P.reflect({ ...deps, ai: async () => JSON.stringify({
    summary: 'Lives in Moseley.',
    replace: [{ old: 'places: lives in Kings Heath', new: 'lives in Moseley' }, { old: 'works in Digbeth', new: 'works from home' }, { old: 'drinks flat whites', new: 'off coffee' }],
    drop: ['lives in Kings Heath', 'drinks flat whites', 'has a cat called Biscuit'],
  }) }, T0 + 10 * 60_000);
  assert.equal(r.ok, true);
  const after = await P.loadProfile(st);
  assert.ok(after.sections.places.includes('lives in Kings Heath'), 'the locked line is still there, word for word');
  assert.ok(!after.sections.places.includes('lives in Moseley'), 'and was not reworded');
  assert.ok(after.sections.places.includes('works from home'), 'an unlocked line is updated as the owner said');
  assert.ok(!after.sections.places.includes('works in Digbeth'));
  const facts = st.m.get('memory');
  assert.deepEqual(facts.find((f) => f.id === 'f1').text, 'drinks flat whites', 'the locked fact is untouched');
  assert.equal(facts.find((f) => f.id === 'f1').locked, true);
  assert.ok(!facts.some((f) => f.id === 'f2'), 'the unlocked fact the owner said is gone was dropped');
  assert.equal(r.refused, 4, 'two rewrites and two drops of locked memories refused');
  assert.deepEqual(r.revised, [{ from: 'works in Digbeth', to: 'works from home' }]);
  assert.deepEqual(r.dropped, ['has a cat called Biscuit']);
  assert.match(P.reflectSummary(r), /1 updated, 1 dropped, 4 locked kept/);
  // the lock and the source are kept through all of it
  const tl = await P.timeline(deps);
  const locked = tl.find((x) => x.text === 'lives in Kings Heath');
  assert.equal(locked.locked, true);
  const updated = tl.find((x) => x.text === 'works from home');
  assert.equal(updated.src.kind, 'reflection');
  assert.equal(updated.src.turnAt, T0 + 60_000, 'points at the message it came from');
  assert.equal(updated.src.quote, 'I stopped drinking coffee and I work from home now');
});

test('locked lines are never pushed out when a section is full; a section full of locked lines takes no more', () => {
  const p = P.emptyProfile();
  for (let i = 0; i < 40; i++) P.addProfileLine(p, 'goals', `goal ${i}`);
  const locked = new Set(['goal 0', 'goal 1']);
  assert.equal(P.addProfileLine(p, 'goals', 'goal new', locked), true);
  assert.deepEqual(p.sections.goals.slice(0, 3), ['goal 0', 'goal 1', 'goal 3'], 'the oldest UNLOCKED line went');
  const all = new Set(p.sections.goals.map((x) => x.toLowerCase()));
  assert.equal(P.addProfileLine(p, 'goals', 'one too many', all), false);
  assert.equal(p.sections.goals.length, 40);
});

test('sources, edit, forget with UNDO, lock: in the brain through /api/profile/timeline and /api/profile/item', async () => {
  const storage = new MemStorage();
  const pending = [];
  const state = { storage, waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() };
  const agent = new brain.GhostyAgent(state, { VAULT_KEY: Buffer.alloc(32, 7).toString('base64'), MOCK_LLM: '1' });
  const api = async (method, path, body) => {
    const r = await agent.fetch(new Request(`https://ghosty.test/api${path}`, { method, ...(body ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}) }));
    const text = await r.text();
    await Promise.allSettled(pending.splice(0));
    return { status: r.status, ...(text ? JSON.parse(text) : {}) };
  };
  const chat = async (message) => {
    const r = await agent.fetch(new Request('https://ghosty.test/api/chat', { method: 'POST', body: JSON.stringify({ message }), headers: { 'content-type': 'application/json' } }));
    await r.text();
    await Promise.allSettled(pending.splice(0));
  };
  // typed in the Memory tab: "you added it"
  await api('POST', '/profile', { section: 'people', text: 'Ann is my sister' });
  await api('POST', '/memory', { text: 'allergic to nothing' });
  // said in a chat: the remember tool saves it, with that chat as its source
  await chat('remember my bike is green');
  let tl = await api('GET', '/profile/timeline');
  assert.equal(tl.status, 200);
  assert.ok(Array.isArray(tl.patterns));
  const line = tl.items.find((x) => x.text === 'Ann is my sister');
  assert.equal(line.kind, 'profile');
  assert.equal(line.section, 'people');
  assert.equal(line.src.kind, 'owner');
  assert.equal(tl.items.find((x) => x.text === 'allergic to nothing').src.kind, 'owner');
  const bike = tl.items.find((x) => x.text === 'my bike is green');
  assert.ok(bike, JSON.stringify(tl.items));
  assert.equal(bike.kind, 'fact');
  assert.equal(bike.src.kind, 'chat');
  assert.equal(bike.src.quote, 'remember my bike is green', "the owner's own message, to open that chat");
  assert.ok(bike.src.turnAt > 0);
  for (let i = 1; i < tl.items.length; i++) assert.ok(tl.items[i - 1].at >= tl.items[i].at, 'newest first');
  // edit: new words, source kept, marked edited; a secret refused; an empty edit refused
  const ed = await api('POST', '/profile/item', { id: bike.id, op: 'edit', text: 'my bike is dark green' });
  assert.equal(ed.item.text, 'my bike is dark green');
  assert.equal(ed.item.src.kind, 'chat');
  assert.ok(ed.item.edited > 0);
  assert.equal((await api('POST', '/profile/item', { id: bike.id, op: 'edit', text: 'my password is hunter2' })).status, 400);
  assert.equal((await api('POST', '/profile/item', { id: bike.id, op: 'edit', text: '  ' })).status, 400);
  const led = await api('POST', '/profile/item', { id: line.id, op: 'edit', text: 'Ann is my older sister' });
  assert.equal(led.item.text, 'Ann is my older sister');
  assert.equal(led.item.src.kind, 'owner', 'the source follows the line to its new words');
  assert.deepEqual((await api('GET', '/profile')).profile.sections.people, ['Ann is my older sister']);
  // lock, then forget and UNDO: back exactly as it was, lock and source included
  assert.equal((await api('POST', '/profile/item', { id: led.item.id, op: 'lock' })).item.locked, true);
  const gone = await api('POST', '/profile/item', { id: led.item.id, op: 'forget' });
  assert.equal(gone.item, null);
  assert.deepEqual((await api('GET', '/profile')).profile.sections.people, []);
  const back = await api('POST', '/profile/item', { id: led.item.id, op: 'restore' });
  assert.equal(back.item.text, 'Ann is my older sister');
  assert.equal(back.item.locked, true);
  assert.equal(back.item.src.kind, 'owner');
  assert.equal((await api('POST', '/profile/item', { id: led.item.id, op: 'restore' })).status, 404, 'nothing left to undo');
  // a fact forgotten and undone keeps its id; unlock works; unknown ids and changes are refused
  await api('POST', '/profile/item', { id: bike.id, op: 'forget' });
  assert.ok(!(await api('GET', '/memory')).facts.some((f) => f.id === bike.id.slice(2)));
  assert.equal((await api('POST', '/profile/item', { id: bike.id, op: 'restore' })).item.text, 'my bike is dark green');
  assert.equal((await api('POST', '/profile/item', { id: back.item.id, op: 'unlock' })).item.locked, false);
  assert.equal((await api('POST', '/profile/item', { id: 'x:1', op: 'lock' })).status, 400);
  assert.equal((await api('POST', '/profile/item', { id: 'f:nope', op: 'lock' })).status, 404);
  assert.equal((await api('POST', '/profile/item', { id: bike.id, op: 'explode' })).status, 400);
  // a locked fact is not forgotten by the chat's forget tool (only by the owner here)
  await api('POST', '/profile/item', { id: bike.id, op: 'lock' });
  await chat('forget bike');
  assert.ok((await api('GET', '/memory')).facts.some((f) => f.id === bike.id.slice(2)));
  tl = await api('GET', '/profile/timeline');
  assert.ok(tl.items.some((x) => x.id === bike.id && x.locked));
});

test('lessons: a locked lesson keeps its words when learned again, and is never dropped by forget_lesson or the cap', async () => {
  const K = await import('./.build/knowledge/index.mjs');
  const st = new MemStorage();
  const { lesson } = await K.addLesson(st, 'TS2532 in the brief tab: indexed an array. Rule: use a fallback.');
  const list = st.m.get('lessons');
  list[0].locked = true;
  await st.put('lessons', list);
  await K.addLesson(st, 'TS2532 in the brief tab: indexed an array without a fallback. Rule: always use a fallback for indexed values.');
  assert.equal(st.m.get('lessons')[0].text, lesson.text);
  assert.equal(await K.removeLesson(st, lesson.id), 0);
  for (let i = 0; i < 90; i++) await K.addLesson(st, `lesson number ${i} about ${['apples', 'bridges', 'clocks', 'drums', 'eggs', 'forks', 'gates', 'hats', 'irons'][i % 9]} ${'q'.repeat(i + 1)} zz${i}`);
  assert.ok(st.m.get('lessons').some((l) => l.id === lesson.id), 'the cap never drops the locked lesson');
});

test('a locked diary day is never added to by a later reflection', async () => {
  const st = new MemStorage();
  const lib = new Library(st, {});
  await st.put('owner:ctx', { tz: 'Europe/London' });
  const deps = { storage: st, library: lib };
  await st.put('turns', turns([['user', 'I like tea'], ['user', 'I like rain']]));
  await P.reflect({ ...deps, ai: async () => JSON.stringify({ diary: 'A morning of tea.' }) }, T0 + 5 * 60_000);
  await P.changeMemory(deps, 'd:2026-10-17', 'edit', 'A morning of tea, as I want it remembered.');
  await P.changeMemory(deps, 'd:2026-10-17', 'lock');
  await st.put('turns', [...st.m.get('turns'), ...turns([['user', 'I like jazz'], ['user', 'I like walks']], T0 + 60 * 60_000)]);
  await P.reflect({ ...deps, ai: async () => JSON.stringify({ diary: 'An afternoon of jazz.' }) }, T0 + 90 * 60_000);
  const days = P.diaryEntries(lib);
  assert.equal(days.find((d) => d.heading === '2026-10-17').text, 'A morning of tea, as I want it remembered.');
  assert.equal(days.find((d) => d.heading === '2026-10-17 (later)').text, 'An afternoon of jazz.');
});

// ---------- PATTERNS: counted from what is stored, never made up ----------

const DAY = 86_400_000;
/** Owner messages: [day offset, hour UTC, text], from 1 Sep 2026 (London is UTC+1 then). */
const said = (list) => list.map(([d, h, text]) => ({ role: 'user', text, at: Date.UTC(2026, 8, 1, h) + d * DAY }));

test('patterns: time of day, topics and moods on several days, themes in memory — each with its evidence; nothing from too little', () => {
  const tz = 'Europe/London';
  // too little: two messages, one day
  assert.deepEqual(P.findPatterns(P.tallyDays(said([[0, 19, 'football tonight'], [0, 20, 'football again']]), tz), []), []);
  const msgs = [];
  for (let d = 0; d < 16; d++) {
    msgs.push([d, 18, d % 4 === 0 ? "I'm knackered after the football" : 'how did the football go']); // evening (19:00 BST)
    if (d % 3 === 0) msgs.push([d, 9, 'what is the weather']);
  }
  msgs.push([2, 18, 'I feel a bit stressed about work'], [5, 18, "I'm worried about the deadline"], [9, 18, 'feeling anxious today']);
  const days = P.tallyDays(said(msgs), tz);
  const pats = P.findPatterns(days, ['Ann is my sister', 'Ann visits on Sundays', 'Ann likes jazz', 'likes tea']);
  const by = Object.fromEntries(pats.map((p) => [p.id, p]));
  assert.ok(by['time:2'], JSON.stringify(pats));
  assert.equal(by['time:2'].text, 'You mostly talk to me in the evening — 19 of your last 25 messages.');
  assert.equal(by['time:2'].evidence, 19);
  assert.equal(by['topic:football'].evidence, 16);
  assert.match(by['topic:football'].text, /“football” — on 16 different days/);
  assert.equal(by['mood:tired'].evidence, 4, 'knackered on days 0, 4, 8, 12');
  assert.match(by['mood:tired'].text, /feeling tired on 4 different days/);
  assert.equal(by['mood:stressed'].evidence, 3);
  assert.equal(by['theme:ann'].evidence, 3);
  assert.equal(by['theme:ann'].text, '3 of the things I remember about you mention “ann”.');
  assert.ok(!pats.some((p) => p.kind === 'mood' && /happy/.test(p.text)), 'no mood the owner never said');
  for (const p of pats) assert.ok(p.evidence > 0 && p.unit, JSON.stringify(p));
  // moods only as the owner says them of themselves
  assert.deepEqual(P.moodsIn('The match was tired and boring'), []);
  assert.deepEqual(P.moodsIn("I'm absolutely shattered"), ['tired']);
  // a message that looks like a secret is never tallied
  assert.deepEqual(P.tallyDays(said([[0, 9, 'my password is football']]), tz), []);
});

test('patterns in the brain: the day log filed by the reflection, dismissed patterns stay hidden', async () => {
  const storage = new MemStorage();
  const pending = [];
  const state = { storage, waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() };
  const agent = new brain.GhostyAgent(state, { VAULT_KEY: Buffer.alloc(32, 7).toString('base64'), MOCK_LLM: '1' });
  const api = async (method, path, body) => {
    const r = await agent.fetch(new Request(`https://ghosty.test/api${path}`, { method, ...(body ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}) }));
    const text = await r.text();
    await Promise.allSettled(pending.splice(0));
    return { status: r.status, ...(text ? JSON.parse(text) : {}) };
  };
  const now = Date.now();
  const list = [];
  for (let d = 0; d < 5; d++) list.push({ role: 'user', text: 'tell me about the allotment', at: now - (5 - d) * DAY }, { role: 'assistant', text: 'ok', at: now - (5 - d) * DAY + 1 });
  await storage.put('turns', list);
  let tl = await api('GET', '/profile/timeline');
  assert.ok(tl.patterns.some((p) => p.id === 'topic:allotment' && p.evidence === 5), JSON.stringify(tl.patterns));
  // the nightly reflection files the tallies (no model needed); the history can then roll on
  await P.noteDays(storage, now);
  await storage.put('turns', []);
  tl = await api('GET', '/profile/timeline');
  assert.ok(tl.patterns.some((p) => p.id === 'topic:allotment' && p.evidence === 5), 'still known from the day log');
  assert.equal((await api('POST', '/profile/patterns/dismiss', {})).status, 400);
  const d = await api('POST', '/profile/patterns/dismiss', { id: 'topic:allotment' });
  assert.ok(!d.patterns.some((p) => p.id === 'topic:allotment'));
  assert.ok(!(await api('GET', '/profile/timeline')).patterns.some((p) => p.id === 'topic:allotment'), 'stays dismissed');
  // the day log never holds whole messages
  assert.ok(!JSON.stringify(storage.m.get('patterns:days')).includes('tell me about'));
});

test('the day log: messages sent in late (after a pause, with earlier times) are filed once, never twice', async () => {
  const st = new MemStorage();
  const now = Date.UTC(2026, 9, 10, 12);
  await st.put('turns', [{ role: 'user', text: 'the allotment is muddy', at: now - 1000 }]);
  assert.equal(await P.noteDays(st, now), 1);
  assert.equal(await P.noteDays(st, now), 0, 'nothing new: nothing filed twice');
  // two days' messages from a paused spell arrive afterwards, older than what was filed
  await st.put('turns', [{ role: 'user', text: 'allotment again', at: now - 3 * DAY }, { role: 'user', text: 'allotment once more', at: now - 2 * DAY }, ...st.m.get('turns')]);
  assert.equal(await P.noteDays(st, now), 2);
  const pats = await P.patterns({ storage: st }, now);
  assert.ok(pats.some((p) => p.id === 'topic:allotment' && p.evidence === 3), JSON.stringify(pats));
  assert.equal(st.m.get('patterns:days').reduce((k, d) => k + d.n, 0), 3);
});

// ---------- review fixes: UNDO's day, recently forgotten, health, moods, diary headings, forget_everything ----------

test('a forgotten memory can be undone for a day, never after: expired ones are dropped on every read and write and by the nightly reflection', async () => {
  const st = new MemStorage();
  const lib = new Library(st, {});
  const deps = { storage: st, library: lib };
  const DAY = 86_400_000;
  const now = Date.now();
  await st.put('memory', [{ id: 'old1', text: 'something I wanted gone', at: 1 }, { id: 'new1', text: 'something recent', at: 2 }]);
  await P.changeMemory(deps, 'f:old1', 'forget', undefined, now - 30 * DAY);
  await assert.rejects(P.changeMemory(deps, 'f:old1', 'restore', undefined, now), /too long ago/, 'thirty days on: no UNDO');
  assert.deepEqual(st.m.get('memory:forgotten'), [], 'and the old copy is gone from storage');
  // forgotten 23 hours ago: still there; 25 hours: gone, even if nobody tried to undo it
  await P.changeMemory(deps, 'f:new1', 'forget', undefined, now - 23 * 3600_000);
  assert.equal((await P.recentlyForgotten(st, now)).length, 1);
  assert.equal((await P.recentlyForgotten(st, now + 2 * 3600_000)).length, 0);
  assert.equal(st.m.get('memory:forgotten').length, 0, 'pruned on read');
  // the nightly reflection prunes too
  await st.put('memory:forgotten', [{ id: 'f:x', gone: now - 2 * DAY, fact: { id: 'x', text: 'stale', at: 1 } }]);
  await P.reflect({ ...deps, ai: async () => '{}' }, now);
  assert.deepEqual(st.m.get('memory:forgotten'), []);
});

test('RECENTLY FORGOTTEN: every way of forgetting (the timeline, ME ✕) lands in one list with UNDO; FORGET EVERYTHING keeps locked facts and can be undone', async () => {
  const storage = new MemStorage();
  const pending = [];
  const state = { storage, waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() };
  const agent = new brain.GhostyAgent(state, { VAULT_KEY: Buffer.alloc(32, 7).toString('base64'), MOCK_LLM: '1' });
  const api = async (method, path, body) => {
    const r = await agent.fetch(new Request(`https://ghosty.test/api${path}`, { method, ...(body ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}) }));
    const text = await r.text();
    await Promise.allSettled(pending.splice(0));
    return { status: r.status, ...(text ? JSON.parse(text) : {}) };
  };
  const chat = async (message) => {
    const r = await agent.fetch(new Request('https://ghosty.test/api/chat', { method: 'POST', body: JSON.stringify({ message }), headers: { 'content-type': 'application/json' } }));
    const lines = (await r.text()).trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
    await Promise.allSettled(pending.splice(0));
    return lines;
  };
  await api('POST', '/profile', { section: 'people', text: 'Ann is my sister' });
  await api('POST', '/profile', { section: 'likes', text: 'jazz on Sundays' });
  // the old ME ✕ (DELETE /profile) now forgets the same way: kept a day for UNDO
  const del = await api('DELETE', '/profile?section=people&i=0');
  assert.equal(del.removed, true);
  assert.deepEqual(del.profile.sections.people, []);
  let tl = await api('GET', '/profile/timeline');
  assert.deepEqual(tl.forgotten.map((f) => [f.kind, f.text]), [['profile', 'Ann is my sister']]);
  const back = await api('POST', '/profile/item', { id: tl.forgotten[0].id, op: 'restore' });
  assert.equal(back.item.text, 'Ann is my sister');
  // a second forget does not lose the first one's UNDO
  const a = (await api('GET', '/profile/timeline')).items.find((x) => x.text === 'Ann is my sister');
  const b = (await api('GET', '/profile/timeline')).items.find((x) => x.text === 'jazz on Sundays');
  await api('POST', '/profile/item', { id: a.id, op: 'forget' });
  await api('POST', '/profile/item', { id: b.id, op: 'forget' });
  tl = await api('GET', '/profile/timeline');
  assert.deepEqual(tl.forgotten.map((f) => f.text), ['jazz on Sundays', 'Ann is my sister'], 'newest first, both still undoable');
  assert.equal((await api('POST', '/profile/item', { id: a.id, op: 'restore' })).item.text, 'Ann is my sister');
  // FORGET EVERYTHING: the locked fact stays, the reply says so, the rest can come back for a day
  await api('POST', '/memory', { text: 'my bike is green' });
  await api('POST', '/memory', { text: 'my kettle is red' });
  const bike = (await api('GET', '/profile/timeline')).items.find((x) => x.text === 'my bike is green');
  await api('POST', '/profile/item', { id: bike.id, op: 'lock' });
  const ap = (await chat('forget everything')).find((e) => e.t === 'approval');
  const r = await agent.fetch(new Request('https://ghosty.test/api/approve', { method: 'POST', body: JSON.stringify({ id: ap.id, allow: true }), headers: { 'content-type': 'application/json' } }));
  const done = (await r.text()).trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  await Promise.allSettled(pending.splice(0));
  assert.match(done.find((e) => e.t === 'tool_result').summary, /Erased \d+ fact\(s\)\. Kept 1 locked one/);
  const facts = (await api('GET', '/memory')).facts;
  assert.deepEqual(facts.map((f) => f.text), ['my bike is green'], 'only the locked fact is left');
  tl = await api('GET', '/profile/timeline');
  const all = tl.forgotten.find((f) => f.count);
  assert.ok(all && all.count >= 1, JSON.stringify(tl.forgotten));
  await api('POST', '/profile/item', { id: all.id, op: 'restore' });
  assert.ok((await api('GET', '/memory')).facts.some((f) => f.text === 'my kettle is red'), 'UNDO brought them back');
});

test('patterns never mention health; moods only from feeling language; a dismissed topic leaves the day log; CLEAR clears it', async () => {
  const tz = 'Europe/London';
  const sick = ['2026-10-01', '2026-10-03', '2026-10-05'].map((d) => ({ role: 'user', text: 'My chemo is on Thursday and my insulin dose changed, the oncologist said', at: Date.parse(`${d}T10:00:00Z`) }));
  const t = P.tallyDays(sick, tz);
  for (const w of ['chemo', 'insulin', 'oncologist', 'dose']) assert.ok(!(w in t[0].t), `${w} is never tallied`);
  assert.ok(!P.findPatterns(t, ['my insulin is in the fridge', 'insulin twice a day', 'my insulin pen']).some((p) => /chemo|insulin|oncolog/i.test(p.text)), 'nor a theme');
  // not moods
  for (const s of ["I'm low on milk", 'I was down the pub with Tom', "I'm down to my last tenner", 'I am great at chess', 'feeling cross-eyed', "I'm happy to help with that"]) assert.deepEqual(P.moodsIn(s), [], s);
  // moods
  assert.deepEqual(P.moodsIn("I'm knackered."), ['tired']);
  assert.deepEqual(P.moodsIn('I feel a bit low today'), ['low']);
  assert.deepEqual(P.moodsIn("I'm so stressed about work"), ['stressed']);
  assert.deepEqual(P.moodsIn('feeling anxious'), ['stressed']);
  assert.deepEqual(P.moodsIn("Honestly I'm fed up, and tired"), ['low']);
  // dismissing a topic takes the word out of the stored tallies; CLEAR takes everything
  const st = new MemStorage();
  const now = Date.now();
  await st.put('turns', [1, 2, 3].map((d) => ({ role: 'user', text: 'the allotment again', at: now - d * DAY })));
  await P.noteDays(st, now);
  assert.ok(st.m.get('patterns:days').some((d) => d.t.allotment));
  const brainStorage = st;
  const r = await P.profileRoute(new Request('https://x/api/profile/patterns/dismiss', { method: 'POST', body: JSON.stringify({ id: 'topic:allotment' }) }), '/profile/patterns/dismiss', 'POST', new URL('https://x'), { storage: brainStorage, library: new Library(st, {}), ai: async () => '' });
  assert.equal(r.status, 200);
  assert.ok(!st.m.get('patterns:days').some((d) => 'allotment' in d.t), 'the word is no longer kept');
  await P.profileRoute(new Request('https://x/api/profile/patterns/clear', { method: 'POST' }), '/profile/patterns/clear', 'POST', new URL('https://x'), { storage: st, library: new Library(st, {}), ai: async () => '' });
  assert.equal(st.m.get('patterns:days'), undefined);
  assert.equal(st.m.get('patterns:filed'), undefined);
});

test('a locked "(later)" diary heading is never rewritten either: the next reflection steps on to "(later 2)"', async () => {
  const st = new MemStorage();
  const lib = new Library(st, {});
  await st.put('owner:ctx', { tz: 'Europe/London' });
  const deps = { storage: st, library: lib };
  const say = async (words, at, diary) => {
    await st.put('turns', [...(st.m.get('turns') ?? []), ...turns(words.map((w) => ['user', w]), at)]);
    await P.reflect({ ...deps, ai: async () => JSON.stringify({ diary }) }, at + 5 * 60_000);
  };
  await say(['I like tea', 'I like rain'], T0, 'Morning.');
  await P.changeMemory(deps, 'd:2026-10-17', 'lock');
  await say(['I like jazz', 'I like walks'], T0 + 3600_000, 'Afternoon.');
  await P.changeMemory(deps, 'd:2026-10-17 (later)', 'lock');
  await say(['I like toast', 'I like books'], T0 + 7200_000, 'Evening.');
  const days = Object.fromEntries(P.diaryEntries(lib).map((d) => [d.heading, d.text]));
  assert.equal(days['2026-10-17'], 'Morning.');
  assert.equal(days['2026-10-17 (later)'], 'Afternoon.', 'the locked later entry is untouched');
  assert.equal(days['2026-10-17 (later 2)'], 'Evening.');
});
