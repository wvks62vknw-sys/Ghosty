// Projects that run for days: the record and its KV mirror, the step runner (research steps on
// the cheap models, build steps on the strong ones, results filed, the next step timed by the
// pace, a quarter-hour wait with no model, three failures pause the project, notifications on
// the right steps), the tools, the Workshop routes and a whole project through the brain.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sqlStorage } from '../../../tests/sqlite-storage.mjs';

const PJ = await import('./.build/projects.mjs');
const S = await import('./.build/schedule.mjs');
const { Library } = await import('./.build/library/store.mjs');
const T = await import('./.build/tools/index.mjs');
const brain = await import('./.build/brain.mjs');

const quota = () => { throw new Error('Exceeded allowed rows read in Durable Objects free tier.'); };
class MemStorage {
  m = new Map();
  sql = sqlStorage();
  down = false;
  async get(k) { if (this.down) quota(); return Array.isArray(k) ? new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))])) : this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { if (this.down) quota(); if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b)); else this.m.set(k, structuredClone(v)); }
  async delete(k) { if (this.down) quota(); return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k); }
  async list({ prefix = '' } = {}) { return new Map([...this.m].filter(([k]) => k.startsWith(prefix))); }
  alarm = null;
  async setAlarm(t) { this.alarm = t; }
  async getAlarm() { return this.alarm; }
}
const fakeKv = () => ({ m: new Map(), async get(k) { return this.m.has(k) ? JSON.parse(this.m.get(k)) : null; }, async put(k, v) { this.m.set(k, v); }, async delete(k) { this.m.delete(k); } });

const STEPS = [
  { title: 'Research the options', instruction: 'Look up the options and list them with sources.' },
  { title: 'Compare the options', instruction: 'Compare what step 1 found.' },
  { title: 'Write the plan', instruction: 'Write the plan for the chosen option.' },
];

/** A fake brain for the runner: records model calls and their options; the model answers a tool call first, then the result. */
function deps(storage, { env = {}, reply, fail } = {}) {
  const calls = [];
  const notes = [];
  let busy = false;
  const tools = [
    { name: 'web_search', description: 'search', parameters: { type: 'object', properties: {} }, risk: 'auto', run: async (a) => `Results for ${a.query}: https://example.com/${encodeURIComponent(a.query)} — ${'x'.repeat(4000)}` },
  ];
  const d = {
    env,
    storage,
    library: new Library(storage, {}),
    tools,
    tctx: {},
    system: async () => 'SYSTEM PROMPT',
    notify: async (item) => { notes.push(item); return item; },
    busy: { get: () => busy, set: (v) => { busy = v; } },
    complete: async (messages, specs, opts) => {
      calls.push({ messages, specs, opts });
      if (fail) throw new Error(typeof fail === 'function' ? fail(calls.length) : fail);
      const last = messages[messages.length - 1];
      if (last.role === 'user') return { message: { role: 'assistant', content: null, tool_calls: [{ id: `c${calls.length}`, type: 'function', function: { name: 'web_search', arguments: JSON.stringify({ query: 'options' }) } }] }, model: 'fake' };
      return { message: { role: 'assistant', content: reply ? reply(calls.length) : `Found: A and B, A is better (https://example.com/a). ${last.content.slice(0, 40)}` }, model: 'fake' };
    },
    calls,
    notes,
  };
  return d;
}

test('start_project: the record in the database and KV, the index, the first step due in seconds; the plan the owner approves', async () => {
  const st = new MemStorage();
  const kv = fakeKv();
  const s = { env: { SITES: kv }, storage: st };
  const t0 = Date.now();
  const p = await PJ.startProject(s, { title: '  Weekend  site ', goal: 'A site by Sunday.', steps: STEPS, pace: 'fast' });
  assert.equal(p.title, 'Weekend site');
  assert.equal(p.status, 'active');
  assert.equal(p.pace, 'fast');
  assert.equal(p.docId, `project_${p.id}`);
  assert.deepEqual(p.steps.map((x) => [x.n, x.status]), [[1, 'todo'], [2, 'todo'], [3, 'todo']]);
  assert.ok(st.m.has(`project:${p.id}`) && kv.m.has(`project:${p.id}`), 'in both places');
  assert.deepEqual((await PJ.loadIndex(s)).map((e) => [e.id, e.status, e.done, e.total]), [[p.id, 'active', 0, 3]]);
  const job = (await S.loadJobs(st)).find((j) => j.kind === 'project');
  assert.equal(job.text, p.id);
  assert.ok(job.next >= t0 + 4000 && job.next <= t0 + 6500, 'the first step in about five seconds');
  assert.equal(job.repeat, 'none');
  // the approval text shows the plan; a plan with too few or malformed steps is refused before the owner sees it
  const tool = T.toolByName.get('start_project');
  const ap = await tool.approval({ title: 'Weekend site', goal: 'A site by Sunday.', steps: STEPS, pace: 'fast' }, {});
  assert.match(ap.reason, /^Start the project "Weekend site"[\s\S]*fast: a step every 3 minutes[\s\S]*1\. Research the options — Look up the options[\s\S]*3\. Write the plan/);
  assert.equal(ap.args.pace, 'fast');
  assert.equal((await tool.approval({ title: 'x', goal: 'y', steps: STEPS }, {})).args.pace, 'steady', 'steady unless asked');
  await assert.rejects(tool.approval({ title: 'x', goal: 'y', steps: STEPS.slice(0, 2) }, {}), /3 to 12 steps/);
  await assert.rejects(tool.approval({ title: 'x', goal: 'y', steps: [{ title: 'a' }, ...STEPS] }, {}), /title and an instruction/);
  assert.ok(T.TOOL_GROUPS.find((g) => g.name === 'projects').when.test('can you keep working on this over the next few days'));
  assert.ok(!T.TOOL_GROUPS.find((g) => g.name === 'projects').when.test('carry on'), '"carry on" is the chat\'s own word for continuing a capped task');
  assert.ok(!T.TOOL_GROUPS.find((g) => g.name === 'projects').when.test('what is the weather'));
  assert.ok(T.TOOL_GROUPS.find((g) => g.name === 'projects').about.length <= 220);
});

test('a step: research goes to the small models in the background lane, the tool result is clipped, the result is filed and kept short, the next step is timed by the pace, the owner is told', async () => {
  const st = new MemStorage();
  const d = deps(st, { reply: () => `Found: A and B, A is better (https://example.com/a). ${'y'.repeat(2000)}` });
  const p = await PJ.startProject(d, { title: 'Weekend site', goal: 'A site by Sunday.', steps: STEPS, pace: 'steady' });
  const job = (await S.loadJobs(st)).find((j) => j.kind === 'project');
  const t0 = Date.now();
  const r = await PJ.runProjectStep(d, job);
  assert.equal(r.did, 'step');
  assert.equal(d.calls.length, 2, 'a tool call, then the result');
  assert.deepEqual(d.calls[0].opts, { tier: 'small', priority: 'background' }, 'research: the small models, in the background lane');
  assert.match(d.calls[0].messages[0].content, /^SYSTEM PROMPT\n\nPROJECT STEP: you are working on your own through the project "Weekend site"[\s\S]*step 1 of 3/);
  assert.match(d.calls[0].messages[1].content, /^PROJECT: Weekend site\n\nGOAL: A site by Sunday\.\n\nThis is the first step\.\n\nStep 1: Research the options — Look up the options and list them with sources\.\n\nWhat you produce is filed/);
  const toolMsg = d.calls[1].messages.find((m) => m.role === 'tool');
  assert.ok(toolMsg.content.length < 2600 && /truncated/.test(toolMsg.content), 'tool results are clipped to 2,500 characters');
  const saved = await PJ.loadProject(d, p.id);
  assert.equal(saved.steps[0].status, 'done');
  assert.equal(saved.steps[0].result.length, 1200, 'the record keeps a short copy');
  assert.ok(saved.steps[0].at >= t0);
  assert.equal(saved.fails, 0);
  const doc = d.library.doc(saved.docId);
  assert.equal(doc.title, 'Project: Weekend site');
  assert.equal(doc.kind, 'project');
  const filed = d.library.sectionText(saved.docId, 'Step 1: Research the options');
  assert.match(filed, /^Found: A and B/);
  assert.match(filed, /\nSources: options$/, 'what the step looked up');
  const next = (await S.loadJobs(st)).find((j) => j.id === job.id);
  assert.ok(next.next >= t0 + 20 * 60_000 - 1000 && next.next <= t0 + 20 * 60_000 + 5000, `steady pace: the next step in 20 minutes (${next.next - t0} ms)`);
  assert.equal(d.notes.length, 1, 'a short project reports every step');
  assert.equal(d.notes[0].kind, 'task');
  assert.equal(d.notes[0].title, 'Weekend site · step 1 of 3');
  assert.ok(d.notes[0].text.length <= 600);
  // the next step: a build step goes to the strong models and sees what step 1 produced
  await PJ.runProjectStep(d, next);
  assert.deepEqual(d.calls[2].opts, { tier: 'small', priority: 'background' }, '"compare" is research');
  assert.match(d.calls[2].messages[1].content, /WHAT THE EARLIER STEPS PRODUCED:\n<<external content from your earlier steps of this project[\s\S]*Step 1: Research the options\nFound: A and B/);
  const third = (await S.loadJobs(st)).find((j) => j.id === job.id);
  const r3 = await PJ.runProjectStep(d, third);
  assert.deepEqual(d.calls[4].opts, { code: true, priority: 'background' }, '"write" is a build step');
  assert.equal(r3.did, 'done');
  assert.equal(r3.project.status, 'done');
  assert.equal((await S.loadJobs(st)).filter((j) => j.kind === 'project').length, 0, 'the job is gone');
  assert.equal(d.notes.length, 3, "the last step's notification is the final report");
  assert.equal(d.notes[2].title, 'Weekend site · done');
  assert.match(d.notes[2].text, /^All 3 steps are done: 1\. Research the options; 2\. Compare the options; 3\. Write the plan\. Last step: Found: A and B[\s\S]* Links: https:\/\/example\.com\/a\./);
  assert.deepEqual((await PJ.loadIndex(d)).map((e) => [e.status, e.done]), [['done', 3]]);
  // a done project's job firing again does nothing
  assert.equal((await PJ.runProjectStep(d, third)).did, 'nothing');
});

test('the pace: a fast project runs a step every 3 minutes; a long project reports every third step and the last', async () => {
  const st = new MemStorage();
  const d = deps(st, { reply: () => 'Result.' });
  const eight = Array.from({ length: 8 }, (_, i) => ({ title: `Step ${i + 1} research`, instruction: 'Find things.' }));
  const p = await PJ.startProject(d, { title: 'Long one', goal: 'Lots.', steps: eight, pace: 'fast' });
  for (let i = 0; i < 8; i++) {
    const job = (await S.loadJobs(st)).find((j) => j.kind === 'project');
    const t0 = Date.now();
    const r = await PJ.runProjectStep(d, job);
    if (i < 7) {
      assert.equal(r.did, 'step');
      const next = (await S.loadJobs(st)).find((j) => j.id === job.id);
      assert.ok(next.next >= t0 + 3 * 60_000 - 1000 && next.next <= t0 + 3 * 60_000 + 5000, `fast pace: ${next.next - t0} ms`);
    } else assert.equal(r.did, 'done');
  }
  assert.deepEqual(d.notes.map((n) => n.title), ['Long one · step 3 of 8', 'Long one · step 6 of 8', 'Long one · done']);
  assert.equal((await PJ.loadProject(d, p.id)).steps.every((s) => s.status === 'done'), true);
  assert.deepEqual([PJ.notifyStep(1, 6), PJ.notifyStep(1, 7), PJ.notifyStep(3, 7), PJ.notifyStep(7, 7)], [true, false, true, true]);
});

test('no model free: the step waits a quarter of an hour, nobody is blamed, the owner is not told; three real failures pause the project and tell them once', async () => {
  const st = new MemStorage();
  const down = deps(st, { fail: 'Every model I can reach is cooling down after rate limits. Another free key in the System tab gives me more room.' });
  const p = await PJ.startProject(down, { title: 'Waiting one', goal: 'g', steps: STEPS, pace: 'fast' });
  let job = (await S.loadJobs(st)).find((j) => j.kind === 'project');
  const t0 = Date.now();
  const w = await PJ.runProjectStep(down, job);
  assert.equal(w.did, 'waiting');
  job = (await S.loadJobs(st)).find((j) => j.id === job.id);
  assert.ok(job.next >= t0 + 15 * 60_000 - 1000 && job.next <= t0 + 15 * 60_000 + 5000, `${job.next - t0} ms`);
  let saved = await PJ.loadProject(down, p.id);
  assert.equal(saved.fails, 0);
  assert.equal(saved.steps[0].status, 'todo');
  assert.match(saved.note, /waiting for a free model/);
  assert.equal(down.notes.length, 0);
  assert.equal(down.busy.get(), false, 'the lock is released');
  // something else breaks three times
  const broken = deps(st, { fail: 'boom' });
  for (let i = 1; i <= 3; i++) {
    const r = await PJ.runProjectStep(broken, job);
    saved = await PJ.loadProject(broken, p.id);
    if (i < 3) {
      assert.equal(r.did, 'retry');
      assert.equal(saved.fails, i);
      assert.equal(saved.status, 'active');
      assert.match(saved.note, new RegExp(`step 1 failed \\(${i} of 3\\): boom`));
      job = (await S.loadJobs(st)).find((j) => j.id === job.id);
      assert.ok(job.next <= Date.now() + 2 * 60_000 + 5000, 'tried again in two minutes');
    } else {
      assert.equal(r.did, 'paused');
      assert.equal(saved.status, 'paused');
      assert.equal(saved.steps[0].status, 'failed');
      assert.equal((await S.loadJobs(st)).filter((j) => j.kind === 'project').length, 0);
    }
  }
  assert.equal(broken.notes.length, 1, 'told once');
  assert.equal(broken.notes[0].kind, 'error');
  assert.match(broken.notes[0].text, /Step 1 "Research the options" failed 3 times \(boom\)/);
  // resume: the failed step is tried again, at once
  const ok = deps(st, { reply: () => 'Fine now.' });
  await PJ.resumeProject(ok, saved);
  saved = await PJ.loadProject(ok, p.id);
  assert.equal(saved.status, 'active');
  assert.equal(saved.fails, 0);
  assert.equal(saved.steps[0].status, 'todo');
  assert.equal(saved.note, undefined);
  job = (await S.loadJobs(st)).find((j) => j.kind === 'project');
  assert.ok(job && job.next <= Date.now() + 6000);
  assert.equal((await PJ.runProjectStep(ok, job)).did, 'step');
  // busy brain: the step waits a minute
  const busy = deps(st, { reply: () => 'x' });
  busy.busy.set(true);
  job = (await S.loadJobs(st)).find((j) => j.kind === 'project');
  assert.equal((await PJ.runProjectStep(busy, job)).did, 'waiting');
  assert.ok((await S.loadJobs(st)).find((j) => j.id === job.id).next <= Date.now() + 61_000);
});

test('a step that hits the free limits halfway carries on from where it stopped next time: its tools are not run again', async () => {
  const st = new MemStorage();
  // The model asks for a search, then the free limits run out before it can write the result.
  const d = deps(st, { fail: (n) => (n >= 2 ? 'Every model I can reach is full for now (free limits). The first one frees up in about 40 seconds.' : '') });
  let searches = 0;
  const realRun = d.tools[0].run;
  d.tools[0].run = async (a) => { searches++; return realRun(a); };
  // the first call works (fail returns '' → falsy, so the fake answers normally)
  const complete = d.complete;
  d.complete = async (m, s, o) => (d.calls.length === 0 ? (d.calls.push({ messages: m, specs: s, opts: o }), { message: { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'web_search', arguments: '{"query":"options"}' } }] }, model: 'fake' }) : complete(m, s, o));
  const p = await PJ.startProject(d, { title: 'Halfway', goal: 'g', steps: STEPS, pace: 'fast' });
  let job = (await S.loadJobs(st)).find((j) => j.kind === 'project');
  const w = await PJ.runProjectStep(d, job);
  assert.equal(w.did, 'waiting', 'a limit is a wait, not a failure');
  assert.equal(searches, 1);
  // next alarm, room again: the chain resumes with the search result already in hand
  const ok = deps(st, { reply: () => 'A is best (https://example.com/a).' });
  let okSearches = 0;
  ok.tools[0].run = async () => { okSearches++; return 'should not run again'; };
  job = (await S.loadJobs(st)).find((j) => j.kind === 'project');
  const r = await PJ.runProjectStep(ok, job);
  assert.equal(r.did, 'step');
  assert.equal(okSearches, 0, 'the search from the first try is not run again');
  assert.equal(ok.calls.length, 1, 'one model call: straight to the result');
  const sent = ok.calls[0].messages;
  assert.ok(sent.some((m) => m.role === 'tool' && /Results for options/.test(m.content)), 'the earlier tool result is in the request');
  const saved = await PJ.loadProject(ok, p.id);
  assert.equal(saved.steps[0].status, 'done');
  assert.match(saved.steps[0].result, /^A is best/);
  assert.equal(st.m.has(`project:work:${p.id}`), false, 'nothing left over once the step is done');
  // the next step starts fresh
  job = (await S.loadJobs(st)).find((j) => j.kind === 'project');
  await PJ.runProjectStep(ok, job);
  assert.equal(ok.calls[1].messages.filter((m) => m.role === 'tool').length, 0, 'step 2 starts from its own prompt');
});

test('with KV bound, a project is kept and listed while the database is paused, and the newest is the one "carry on" means', async () => {
  const st = new MemStorage();
  const kv = fakeKv();
  const s = { env: { SITES: kv }, storage: st };
  const a = await PJ.startProject(s, { title: 'First', goal: 'g', steps: STEPS, pace: 'steady' });
  await new Promise((r) => setTimeout(r, 5));
  const b = await PJ.startProject(s, { title: 'Second', goal: 'g', steps: STEPS, pace: 'steady' });
  await PJ.pauseProject(s, b);
  st.down = true; // the free daily allowance is gone
  assert.equal((await PJ.loadProject(s, a.id)).title, 'First');
  assert.deepEqual((await PJ.listProjects(s)).map((p) => [p.title, p.status]), [['First', 'active'], ['Second', 'paused']], 'running first, then paused');
  assert.equal((await PJ.pickProject(s, undefined, ['paused'])).id, b.id, 'the newest paused one');
  assert.equal((await PJ.pickProject(s, undefined, ['active'])).id, a.id);
  st.down = false;
  // the tools: status, pause, resume ("carry on"), cancel
  const ctx = { env: { SITES: kv }, storage: st };
  const status = await T.toolByName.get('project_status').run({}, ctx);
  assert.match(status, /"First" · ACTIVE · 0\/3 steps done · steady/);
  assert.match(status, /"Second" · PAUSED/);
  assert.match(await T.toolByName.get('project_status').run({ id: a.id }, ctx), /Goal: g\n1\. \[TODO\] Research the options/);
  assert.match(await T.toolByName.get('resume_project').run({}, ctx), /Resumed "Second"/);
  assert.equal((await PJ.loadProject(s, b.id)).status, 'active');
  assert.match(await T.toolByName.get('pause_project').run({ id: a.id }, ctx), /Paused "First"/);
  assert.equal((await S.loadJobs(st)).filter((j) => j.kind === 'project' && j.text === a.id).length, 0, 'a paused project has no job');
  assert.match(await T.toolByName.get('cancel_project').run({}, ctx), /Cancelled "First"/, 'the newest touched one when no id is given');
  assert.equal((await PJ.loadProject(s, a.id)).status, 'cancelled');
  await PJ.resumeProject(s, await PJ.loadProject(s, a.id)).catch(() => undefined);
  assert.equal((await PJ.loadProject(s, a.id)).status, 'cancelled', 'cancelled is for good');
  await PJ.pauseProject(s, await PJ.loadProject(s, b.id));
  assert.match(await T.toolByName.get('cancel_project').run({ id: b.id }, ctx), /Cancelled "Second"/);
  assert.equal((await PJ.loadProject(s, b.id)).status, 'cancelled');
  assert.match(await T.toolByName.get('resume_project').run({ id: b.id }, ctx).catch((e) => e.message), /is cancelled; start a new project/);
  assert.equal(await T.toolByName.get('resume_project').run({}, ctx), 'No paused project to resume.');
  assert.equal(await T.toolByName.get('pause_project').run({ id: 'nope' }, ctx), 'No running project to pause.');
});

test('in the brain: a project from chat (approved), its steps from the alarm with the mock model, the Workshop routes, "carry on"', async () => {
  const storage = new MemStorage();
  const pending = [];
  const state = { storage, waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() };
  const agent = new brain.GhostyAgent(state, { VAULT_KEY: Buffer.alloc(32, 7).toString('base64'), MOCK_LLM: '1' });
  const call = async (method, path, body) => {
    const r = await agent.fetch(new Request(`https://ghosty.test/api${path}`, { method, ...(body ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}) }));
    const text = await r.text();
    await Promise.allSettled(pending.splice(0));
    return text;
  };
  const api = async (method, path, body) => JSON.parse(await call(method, path, body));
  const chat = async (message) => (await call('POST', '/chat', { message })).trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  // the plan is proposed and waits for approval
  let ev = await chat('start project Weekend site');
  const ask = ev.find((e) => e.t === 'approval');
  assert.ok(ask, JSON.stringify(ev));
  assert.equal(ask.name, 'start_project');
  assert.match(ask.reason, /^Start the project "weekend site"/);
  assert.equal(ask.args.steps.length, 3);
  ev = (await call('POST', '/approve', { id: ask.id, allow: true })).trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  assert.match(ev.find((e) => e.t === 'tool_result').summary, /^Started "weekend site"/);
  let list = (await api('GET', '/projects')).projects;
  assert.equal(list.length, 1);
  const p = list[0];
  assert.equal(p.status, 'active');
  // the alarm runs step 1 (the mock answers the step prompt); every step of a short project is a notification
  let jobs = await S.loadJobs(storage);
  const job = jobs.find((j) => j.kind === 'project');
  assert.equal(job.text, p.id);
  job.next = Date.now() - 1000;
  await storage.put('jobs', jobs);
  await agent.alarm();
  list = (await api('GET', '/projects')).projects;
  assert.equal(list[0].steps[0].status, 'done');
  assert.match(list[0].steps[0].result, /^Step 1 \(Research the options\) is done/);
  const inbox = (await api('GET', '/inbox')).items;
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].title, 'weekend site · step 1 of 3');
  const lib = await api('GET', `/library/docs/project_${p.id}/passages`);
  assert.equal(lib.passages[0].heading, 'Step 1: Research the options');
  assert.match(lib.passages[0].text, /Sources: https:\/\/example\.com\/a https:\/\/example\.com\/b$/);
  // RUN NEXT NOW, PAUSE, RESUME, CANCEL from the Workshop
  const run = await api('POST', `/projects/${p.id}/run`);
  assert.equal(run.did, 'step');
  assert.equal(run.project.steps[1].status, 'done');
  assert.equal((await api('POST', `/projects/${p.id}/pause`)).project.status, 'paused');
  assert.equal((await S.loadJobs(storage)).filter((j) => j.kind === 'project').length, 0);
  // "carry on" in chat resumes the newest paused project
  ev = await chat('carry on');
  assert.match(ev.find((e) => e.t === 'tool_result').summary, /^Resumed "weekend site"/);
  assert.equal((await api('GET', '/projects')).projects[0].status, 'active');
  const last = await api('POST', `/projects/${p.id}/run`);
  assert.equal(last.did, 'done');
  assert.equal(last.project.status, 'done');
  assert.match((await api('GET', '/inbox')).items[0].text, /^All 3 steps are done/);
  assert.equal((await api('POST', `/projects/${p.id}/cancel`)).project.status, 'done', 'a finished project cannot be cancelled');
  assert.equal((await api('POST', '/projects/nope/run')).error, 'no such project');
  ev = await chat('project status');
  assert.match(ev.find((e) => e.t === 'tool_result').summary, /"weekend site" · DONE · 3\/3 steps done/);
});
