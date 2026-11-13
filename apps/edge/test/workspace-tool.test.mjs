// BRIEF-KERNEL-3 item 3: the `workspace` tool. The brain reads (a page by name, or the project whole, with its databases as tables), searches
// (pages and rows matching his words) and PROPOSES changes (a block's text, a row's cell, a page added under a named page, a block or a row at
// the end of a page); the workspace is the turn's data and nothing is applied here. Named in the test list of package.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

await build({ entryPoints: ['../../packages/shared/src/openwork.ts'], bundle: true, format: 'esm', platform: 'neutral', outfile: 'test/.build/openwork.mjs', logLevel: 'warning' });
const O = await import('./.build/openwork.mjs');
const T = await import('./.build/tools/index.mjs');
const P = await import('./.build/prompt.mjs');
const ws = T.toolByName.get('workspace');
assert.ok(ws, 'the workspace tool is in the list');

const LINES = [
  `page 1 | title ${O.q('Garden')}`,
  `block 1.1 | t h1 | text ${O.q('Garden')}`,
  `block 1.2 | t p | text ${O.q('The beans did well by the fence; the tomatoes need more sun.')}`,
  `block 1.3 | t todo | text ${O.q('Order compost')} | done 0`,
  `table 2 | title ${O.q('Garden list')} | col "Water" | col "Sun"`,
  `row 2.1 | title ${O.q('Tomato')} | v "daily" | v "full sun"`,
  `row 2.2 | title ${O.q('Beans')} | v "weekly" | v "part shade"`,
  `page 3 | title ${O.q('Holiday')}`,
  `block 3.1 | t p | text ${O.q('Book the ferry in March.')}`,
];
const open = (lines = LINES) => O.openWorkBlock('workspace', 'workspace | pages 3', lines);
const message = (words, lines) => `${words}${open(lines)}`;
function world(turns) {
  const m = new Map([['turns', turns.map((text, i) => ({ role: i % 2 ? 'assistant' : 'user', text, at: i }))]]);
  const sent = [];
  const ctx = { storage: { get: async (k) => structuredClone(m.get(k)), put: async (k, v) => void m.set(k, v) }, emit: (e) => sent.push(e) };
  return { ctx, sent, snapshot: () => JSON.stringify([...m]) };
}

test('workspace read: a page by name, or the project whole with its databases as tables; sends nothing; nothing open is said', async () => {
  const w = world([message('what is in my workspace?')]);
  const one = await ws.run({ op: 'read', page: 'garden' }, w.ctx);
  assert.match(one, /^PAGE 1 "Garden"\n\[1\.1\] h1: Garden\n\[1\.2\] p: The beans did well by the fence/m);
  assert.match(one, /\[1\.3\] todo: Order compost$/m);
  assert.ok(!/Holiday|Tomato/.test(one), 'only that page');
  const whole = await ws.run({ op: 'read' }, w.ctx);
  assert.match(whole, /^3 pages, read whole:/);
  assert.match(whole, /TABLE 2 "Garden list" \(columns: Water, Sun\)\n\[2\.1\] Tomato \| daily \| full sun\n\[2\.2\] Beans \| weekly \| part shade/);
  assert.match(whole, /PAGE 3 "Holiday"/);
  assert.equal(w.sent.length, 0, 'reading shows nothing and sends nothing to the screen');
  await assert.rejects(() => ws.run({ op: 'read', page: 'cellar' }, w.ctx), /no page called "cellar": "Garden", "Garden list", "Holiday"/);
  await assert.rejects(() => ws.run({ op: 'read', page: 'gar' }, w.ctx), /more than one page matches "gar"/);
  assert.match(await ws.run({ op: 'read' }, world(['hello']).ctx), /No workspace is open on his phone/);
  assert.match(await ws.run({ op: 'read' }, world([message('x'), 'ok', 'and the weather?']).ctx), /No workspace is open/, 'only his latest message counts');
  await assert.rejects(() => ws.run({ op: 'delete' }, w.ctx), /op is read, search, edit or append/);
});

test('workspace search: pages and rows matching his words, found where they are (a row of a table, a block of a page)', async () => {
  const w = world([message('what did I write about the garden?')]);
  const r = await ws.run({ op: 'search', query: 'what did I write about the garden?' }, w.ctx);
  assert.match(r, /PAGE 1 "Garden"\n {2}\[1\.1\] h1: Garden\n {2}\[1\.2\] p: The beans did well by the fence; the tomatoes need more sun\./, 'a page whose name matches comes with what is on it');
  assert.match(r, /TABLE 2 "Garden list" \(columns: Water, Sun\)\n {2}\[2\.1\] Tomato \| daily \| full sun/, 'and a table with its rows');
  assert.ok(!/Holiday/.test(r), 'and nothing that is not about it');
  const tomato = await ws.run({ op: 'search', query: 'tomatoes sun' }, w.ctx);
  assert.match(tomato, /In "Garden": \[1\.2\] p: The beans did well by the fence; the tomatoes need more sun\./);
  const row = await ws.run({ op: 'search', query: 'weekly beans' }, w.ctx);
  assert.match(row, /In "Garden list": \[2\.2\] Beans \| weekly \| part shade/, 'a row is found by its cell');
  assert.match(await ws.run({ op: 'search', query: 'ferry' }, w.ctx), /In "Holiday": \[3\.1\] p: Book the ferry in March\./);
  assert.match(await ws.run({ op: 'search', query: 'submarine' }, w.ctx), /Nothing in the workspace matches "submarine"/);
  await assert.rejects(() => ws.run({ op: 'search', query: 'the' }, w.ctx), /give query/);
  assert.equal(w.sent.length, 0, 'searching sends nothing');
});

test('workspace edit and append: a block, a row\'s cell, a new page, a block or a row at the end are each a PROPOSAL; nothing is applied here', async () => {
  const w = world([message('fix the garden note')]);
  const before = w.snapshot();
  const r = await ws.run({ op: 'edit', page: 'Garden', block: 2, text: 'The beans did well; the tomatoes need more sun.' }, w.ctx);
  assert.match(r, /^Proposed to him as a marked change to block 2 of "Garden"/);
  assert.match(r, /NOTHING is changed until he taps ACCEPT/);
  assert.deepEqual(w.sent, [{ t: 'client', name: 'workspace', args: { change: 'block', page: 'Garden', block: 2, old: 'The beans did well by the fence; the tomatoes need more sun.', text: 'The beans did well; the tomatoes need more sun.' } }]);
  assert.equal(w.snapshot(), before, 'the brain\'s copy of his pages is untouched: it has no way to change one');
  const c = world([message('x')]);
  await ws.run({ op: 'edit', page: 'Garden list', row: 'tomato', column: 'Water', text: 'twice a day' }, c.ctx);
  assert.deepEqual(c.sent[0].args, { change: 'cell', page: 'Garden list', row: 'Tomato', column: 'Water', old: 'daily', text: 'twice a day' });
  const nm = world([message('x')]);
  await ws.run({ op: 'edit', page: 'Garden list', row: 'Beans', text: 'Runner beans' }, nm.ctx);
  assert.equal(nm.sent[0].args.column, 'Name');
  const np = world([message('x')]);
  await ws.run({ op: 'edit', new_page: 'Greenhouse', page: 'Garden', text: 'Ask about glass.' }, np.ctx);
  assert.deepEqual(np.sent[0].args, { change: 'page', parent: 'Garden', title: 'Greenhouse', text: 'Ask about glass.' });
  const ap = world([message('x')]);
  const a1 = await ws.run({ op: 'append', page: 'Garden list', text: 'buy seeds' }, ap.ctx);
  assert.match(a1, /as a new row "buy seeds" of "Garden list"/);
  assert.deepEqual(ap.sent[0].args, { change: 'append', page: 'Garden list', text: 'buy seeds', row: true });
  const a2 = await ws.run({ op: 'append', page: 'Holiday', text: 'Pack the tent.' }, ap.ctx);
  assert.match(a2, /as a block at the end of "Holiday"/);
  assert.deepEqual(ap.sent[1].args, { change: 'append', page: 'Holiday', text: 'Pack the tent.', row: false });
  // refusals send nothing
  const n = world([message('x')]);
  await assert.rejects(() => ws.run({ op: 'edit', page: 'Garden', block: 9, text: 'x' }, n.ctx), /no such block: give block 1 to 3/);
  await assert.rejects(() => ws.run({ op: 'edit', page: 'Garden list', row: 'Kale', column: 'Water', text: 'x' }, n.ctx), /no row called "Kale" in "Garden list": "Tomato", "Beans"/);
  await assert.rejects(() => ws.run({ op: 'edit', page: 'Garden list', row: 'Beans', column: 'Colour', text: 'x' }, n.ctx), /no column called "Colour": Name, Water, Sun/);
  await assert.rejects(() => ws.run({ op: 'append', page: 'Garden', text: '' }, n.ctx), /missing "text"/);
  await assert.rejects(() => ws.run({ op: 'append', page: 'Cellar', text: 'x' }, n.ctx), /no page called "Cellar"/);
  assert.match(await ws.run({ op: 'edit', page: 'Garden', block: 3, text: 'Order compost' }, n.ctx), /already reads/);
  assert.match(await ws.run({ op: 'edit', page: 'Garden', block: 1, text: 'x' }, world(['hello']).ctx), /No workspace is open/);
  assert.equal(n.sent.length, 0, 'the refusals sent nothing');
});

test('workspace: one tool, nothing it does applies, named when off and described when his words call for it, inside the prompt\'s ceilings', () => {
  assert.equal(ws.risk, 'auto');
  assert.equal(ws.parameters.properties.op.enum.join(), 'read,search,edit,append');
  assert.ok(ws.description.length <= 1000);
  const off = T.selectGroups('hello', new Set(), false);
  assert.ok(off.off.some((g) => g.name === 'pages') && !off.on.some((g) => g.name === 'pages'));
  assert.ok(!T.selectTools('hello', new Set(), false).some((t) => t.name === 'workspace'), 'not described on a plain turn');
  for (const t of ['what did I write about the garden?', "add 'buy seeds' to the garden list", 'open my workspace', 'search my notes for the ferry']) assert.ok(T.selectTools(t, new Set(), false).some((x) => x.name === 'workspace'), t);
  const g = T.TOOL_GROUPS.find((x) => x.name === 'pages');
  assert.match(g.about, /^You can /);
  assert.ok(g.about.length <= 220 && g.about.includes('workspace'));
  const hello = JSON.stringify(T.toolSpecs(T.selectTools('hello', new Set(), false))).length;
  assert.ok(hello < 6500, `hello: ${hello}`);
  const sys = P.systemPrompt({ name: 'boss', now: 'Fri 17 Oct 14:05', tz: 'Europe/London', tab: 'core' }, [], true, [], { code: false, groups: T.selectGroups('hello', new Set(), false) });
  assert.ok(sys.length <= 5500 && /^pages: workspace$/m.test(sys), `plain prompt ${sys.length}`);
});
