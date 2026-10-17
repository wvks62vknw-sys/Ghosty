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
  assert.match(calls[0].user, /GHOSTY \([^)]*\): Noted/);
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
  assert.deepEqual(kinds, ['digest', 'reflect']);
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
