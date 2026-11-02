// Context budgets: tool results cut to a per-tool budget (half as much again on a coding turn),
// the conversation sent to the model with only the two newest long results whole, and the
// conversation kept between turns capped by messages and by characters — whole exchanges at a
// time, so an assistant's tool calls never lose their results.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const C = await import('./.build/context.mjs');

test('tool results are cut to a budget per tool, half as much again on a coding turn, with the truncated note', () => {
  assert.equal(C.resultBudget('weather'), 3500);
  assert.equal(C.resultBudget('web_fetch'), 6000);
  assert.equal(C.resultBudget('library_search'), 5000);
  assert.equal(C.resultBudget('study_site'), 8000);
  assert.equal(C.resultBudget('recon_domain'), 6000);
  for (const n of ['repo_search', 'change_status', 'wait_for_checks']) assert.equal(C.resultBudget(n), 12000, n);
  // Self-edits quote exact snippets copied from repo_read: a file of up to ~37 KB comes back whole, as before.
  for (const n of ['repo_read', 'repo_read_many']) assert.equal(C.resultBudget(n), 30000, n);
  assert.equal(C.resultBudget('weather', true), 5250);
  assert.equal(C.resultBudget('repo_read', true), 45000);
  const cut = C.clipResult('weather', 'x'.repeat(10000));
  assert.ok(cut.startsWith('x'.repeat(3500)) && !cut.startsWith('x'.repeat(3501)));
  assert.match(cut, /…\[truncated, 6500 more characters\]$/, 'the note the model knows to ask for more on');
  assert.equal(C.clipResult('weather', 'short'), 'short');
  assert.equal(C.clipResult('repo_read', 'y'.repeat(15000), true), 'y'.repeat(15000), 'a file fits a coding turn');
});

test('compact: the two newest long results stay whole, older ones shrink to 300 characters, big edit arguments are shortened', () => {
  const ctx = [{ role: 'user', content: 'q' }];
  for (let i = 0; i < 4; i++) {
    ctx.push({ role: 'assistant', content: null, tool_calls: [{ id: `c${i}`, type: 'function', function: { name: 'web_fetch', arguments: '{}' } }] });
    ctx.push({ role: 'tool', tool_call_id: `c${i}`, content: `R${i} ${'y'.repeat(1000)}` });
  }
  const out = C.compact(ctx);
  assert.equal(out.length, ctx.length);
  const tools = out.filter((m) => m.role === 'tool');
  assert.equal(tools[3].content.length, 1003, 'the newest result is whole');
  assert.equal(tools[2].content.length, 1003, 'and the one before it');
  for (const m of tools.slice(0, 2)) {
    assert.match(m.content, /^R\d y+…\[older result shortened to save tokens — call the tool again if you need it\]$/);
    assert.equal(m.content.indexOf('…'), 300, 'cut at 300 characters');
  }
  assert.deepEqual(C.compact([{ role: 'user', content: 'q' }, { role: 'tool', tool_call_id: 'x', content: 'short' }])[1].content, 'short', 'short results are left alone');
  const big = [
    { role: 'user', content: 'q' },
    { role: 'assistant', content: null, tool_calls: [{ id: 'e', type: 'function', function: { name: 'propose_change', arguments: JSON.stringify({ title: 't', edits: [{ path: 'a.ts', content: 'z'.repeat(5000) }] }) } }] },
    { role: 'tool', tool_call_id: 'e', content: 'ok' },
  ];
  const args = JSON.parse(C.compact(big)[1].tool_calls[0].function.arguments);
  assert.equal(args.title, 't');
  assert.match(args.edits[0].content, /^z{200}…\[5000 chars sent earlier\]$/);
});

test('trimContext: at most 36 messages and 45,000 characters, the oldest whole exchanges dropped first, a tool call never split from its result', () => {
  const ctx = [];
  for (let i = 0; i < 10; i++) {
    ctx.push({ role: 'user', content: `question ${i}` });
    ctx.push({ role: 'assistant', content: null, tool_calls: [{ id: `c${i}`, type: 'function', function: { name: 'web_fetch', arguments: '{}' } }] });
    ctx.push({ role: 'tool', tool_call_id: `c${i}`, content: `R${i} ${'w'.repeat(7000)}` });
    ctx.push({ role: 'assistant', content: `answer ${i} ${'a'.repeat(5000)}` });
  }
  const out = C.trimContext(ctx);
  const size = (list) => list.reduce((n, m) => n + (typeof m.content === 'string' ? m.content.length : 0) + (m.tool_calls ?? []).reduce((k, c) => k + c.function.name.length + c.function.arguments.length, 0), 0);
  assert.ok(size(ctx) > 45000, 'the conversation is over the budget to begin with');
  assert.ok(size(out) <= 45000, `kept ${size(out)} characters`);
  assert.ok(out.length <= 36 && out.length > 0);
  assert.equal(out[0].role, 'user', 'starts at a user message');
  assert.equal(out[0].content, 'question 5', 'the four oldest exchanges went, whole');
  assert.match(out.at(-1).content, /^answer 9 /, 'the newest exchange is there');
  for (const m of out) for (const c of m.tool_calls ?? []) assert.ok(out.some((x) => x.role === 'tool' && x.tool_call_id === c.id), `${c.id} keeps its result`);
  for (const m of out) if (m.role === 'tool') assert.ok(out.some((x) => x.tool_calls?.some((c) => c.id === m.tool_call_id)), `${m.tool_call_id} keeps its call`);
  // older tool outputs are shortened, the newest are whole
  assert.match(out.find((m) => m.tool_call_id === 'c5').content, /…\[older tool output trimmed\]$/);
  assert.equal(out.find((m) => m.tool_call_id === 'c9').content.length, 7003);
  // one huge exchange stays whole rather than being cut mid-way
  const one = [{ role: 'user', content: 'q' }, { role: 'assistant', content: null, tool_calls: [{ id: 'c', type: 'function', function: { name: 'repo_read', arguments: '{}' } }] }, { role: 'tool', tool_call_id: 'c', content: 'z'.repeat(60000) }, { role: 'assistant', content: 'a' }];
  assert.equal(C.trimContext(one).length, 4);
  // the message cap still holds, and a picture never stays
  const many = Array.from({ length: 50 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }));
  assert.equal(C.trimContext(many).length, 36);
  const photo = [{ role: 'user', content: [{ type: 'text', text: 'look' }, { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } }] }];
  assert.ok(!JSON.stringify(C.trimContext(photo)).includes('base64'));
  assert.equal(C.CONTEXT_MESSAGES, 36);
  assert.equal(C.CONTEXT_CHARS, 45000);
});

// BRIEF-TALK-1A 2: a reply he cut off as it was read out says, in the brain's own copy, what he heard of it.
test('a reply cut off as it was read out: the brain’s copy says what he heard, once, and only on that reply', () => {
  const reply = '**The sea:** I could talk about it for hours, but here is the short version. It is older than it looks. It changes with the seasons.';
  const ctx = () => [
    { role: 'user', content: 'talk to me about the sea' },
    { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'list_memory', arguments: '{}' } }] },
    { role: 'tool', tool_call_id: 'c1', content: 'nothing' },
    { role: 'assistant', content: reply },
  ];
  const c = ctx();
  // found by its first words as said (no markdown, no capitals): the note is on the reply, never on the tool call
  assert.equal(C.noteHeard(c, { said: 'The sea: I could talk about it for hours, but here is the short version.', head: 'The sea: I could talk about it' }), true);
  assert.match(c[3].content, /\n\n\[He cut me off while I was saying this\. He heard only: "The sea: I could talk about it for hours, but here is the short version\."\]$/);
  assert.ok(c[3].content.startsWith(reply), 'what was written stays whole');
  assert.equal(c[1].content, null);
  // noted once only
  assert.equal(C.noteHeard(c, { said: 'x', head: 'The sea: I could talk about it' }), false);
  // cut before the first sentence ended: he heard none of it
  const none = ctx();
  assert.equal(C.noteHeard(none, { said: '', head: 'The sea: I could talk' }), true);
  assert.match(none[3].content, /he heard none of this\.\]$/);
  // another reply (its first words differ), or nothing to note: left as it is
  const other = ctx();
  assert.equal(C.noteHeard(other, { said: 'It rained.', head: 'It rained all day' }), false);
  assert.equal(other[3].content, reply);
  assert.equal(C.noteHeard([], { said: 'x', head: 'x' }), false);
  assert.equal(C.noteHeard(ctx(), { said: 'x', head: '' }), false);
});
