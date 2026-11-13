// BRIEF-KERNEL-3 item 2: the `videoedit` tool (named so because `videoTools` in tools/extra.ts already means something else). The brain reads,
// and PROPOSES edits to, the one video project open on the phone: the clips in order with their lengths, the music, the subtitles; each edit
// is a proposal shown on the timeline and nothing is applied here; an export is never started by the tool, only by his tap. Every number the
// tool says is in seconds with its word. Named in the test list of package.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

await build({ entryPoints: ['../../packages/shared/src/openwork.ts'], bundle: true, format: 'esm', platform: 'neutral', outfile: 'test/.build/openwork.mjs', logLevel: 'warning' });
const O = await import('./.build/openwork.mjs');
const T = await import('./.build/tools/index.mjs');
const P = await import('./.build/prompt.mjs');
const v = T.toolByName.get('videoedit');
assert.ok(v, 'the videoedit tool is in the list');

const CLIPS = [
  { src: 'beach.mp4', len: 8400, flags: '' },
  { src: 'dog.mov', len: 12000, flags: 'steadied' },
  { src: 'sunset.mp4', len: 6200, flags: 'reversed,ramped', next: 'crossfade', nextlen: 500 },
];
const open = (o = {}) => {
  const clips = o.clips ?? CLIPS;
  const total = clips.reduce((n, c) => n + c.len, 0);
  return O.openWorkBlock('video', `video | name ${O.q('Beach day')} | clips ${clips.length} | len ${total}`, [
    ...clips.map((c, i) => `clip ${i + 1} | src ${O.q(c.src)} | in 0 | out ${c.len} | len ${c.len} | speed 1 | flags ${c.flags} | next ${c.next ?? 'cut'} | nextlen ${c.nextlen ?? 0}`),
    ...(o.music === false ? [] : ['music m1 | name "song.mp3" | start 0 | len 20000']),
    'audio a1 | name "song.mp3" | len 20000',
    'audio a2 | name "waves.wav" | len 9000',
    ...(o.subs ? [`subs ${o.subs} | first ${O.q('Here we go')}`] : []),
  ]);
};
const message = (words, o) => `${words}${open(o)}`;
function world(turns) {
  const m = new Map([['turns', turns.map((text, i) => ({ role: i % 2 ? 'assistant' : 'user', text, at: i }))]]);
  const sent = [];
  const ctx = { storage: { get: async (k) => structuredClone(m.get(k)), put: async (k, v2) => void m.set(k, v2) }, emit: (e) => sent.push(e) };
  return { ctx, sent, snapshot: () => JSON.stringify([...m]) };
}
const proposal = async (args, o) => {
  const w = world([message('x', o)]);
  const before = w.snapshot();
  const r = await v.run({ op: 'edit', ...args }, w.ctx);
  assert.equal(w.snapshot(), before, 'the brain\'s copy of his project is untouched: it has no way to change one');
  assert.match(r, /NOTHING is changed until he taps ACCEPT/);
  return { r, ev: w.sent };
};

test('videoedit read: the clips in order with their lengths in seconds, the music, the subtitles; sends nothing; nothing open is said', async () => {
  const w = world([message('what is in my video?', { subs: 3 })]);
  const r = await v.run({ op: 'read' }, w.ctx);
  assert.match(r, /^"Beach day": 3 clips, 26\.6 seconds in all\./);
  assert.match(r, /\[1\] beach\.mp4: 8\.4 seconds$/m);
  assert.match(r, /\[2\] dog\.mov: 12 seconds, steadied$/m);
  assert.match(r, /\[3\] sunset\.mp4: 6\.2 seconds, reversed, ramped, crossfade of 0\.5 seconds into the next$/m);
  assert.match(r, /Music: song\.mp3 \(20 seconds\)\./);
  assert.match(r, /Subtitles: 3 lines, the first "Here we go"\./);
  assert.match(r, /Audio in the project: song\.mp3, waves\.wav\./);
  assert.ok(!/\b\d+ ms\b|\bms\b/.test(r), 'no number without its word, never milliseconds');
  assert.equal(w.sent.length, 0, 'reading sends nothing to the screen');
  assert.match(await v.run({ op: 'read' }, world([message('x', { music: false })]).ctx), /No music\.\nNo subtitles\./);
  assert.match(await v.run({ op: 'read' }, world(['hello']).ctx), /No video project is open on his phone/);
  assert.match(await v.run({ op: 'read' }, world([message('x'), 'ok', 'and the weather?']).ctx), /No video project is open/, 'only his latest message counts');
  await assert.rejects(() => v.run({ op: 'delete' }, w.ctx), /op is read, edit or export/);
});

test('videoedit edit: each of trim, swap, remove, transition, music, subtitles, steady, best, beat, reverse and ramp is a PROPOSAL; nothing is applied; numbers are said in seconds', async () => {
  let x = await proposal({ change: 'trim', clip: 1, from: 0, to: 5 });
  assert.match(x.r, /^Proposed to him on the timeline: clip 1 trimmed to 0 seconds to 5 seconds of its 8\.4 seconds\./);
  assert.deepEqual(x.ev, [{ t: 'client', name: 'videoedit', args: { change: 'trim', clip: 1, from: 0, to: 5 } }]);
  x = await proposal({ change: 'swap', clip: 1, with: 3 });
  assert.deepEqual(x.ev[0].args, { change: 'swap', clip: 1, with: 3 });
  x = await proposal({ change: 'remove', clip: 2 });
  assert.match(x.r, /clip 2 \(12 seconds\) taken out/);
  assert.deepEqual(x.ev[0].args, { change: 'remove', clip: 2 });
  x = await proposal({ change: 'transition', clip: 1, kind: 'dip', seconds: 0.8 });
  assert.match(x.r, /a dip of 0\.8 seconds from clip 1 to clip 2/);
  assert.deepEqual(x.ev[0].args, { change: 'transition', clip: 1, kind: 'dip', seconds: 0.8 });
  x = await proposal({ change: 'music', track: 'waves' });
  assert.match(x.r, /waves\.wav \(9 seconds\) as the music/);
  assert.deepEqual(x.ev[0].args, { change: 'music', track: 'waves.wav' });
  x = await proposal({ change: 'subtitles', on: true });
  assert.match(x.r, /subtitles written from the clip.s sound/);
  x = await proposal({ change: 'subtitles', on: false }, { subs: 2 });
  assert.match(x.r, /the 2 subtitle lines taken off/);
  x = await proposal({ change: 'steady', clip: 3 });
  assert.match(x.r, /clip 3 \(6\.2 seconds\) steadied on his phone/);
  x = await proposal({ change: 'best', seconds: 30 });
  assert.match(x.r, /the best 30 seconds chosen from the clips \(he ticks the stretches/);
  assert.deepEqual(x.ev[0].args, { change: 'best', seconds: 30 });
  x = await proposal({ change: 'beat' });
  assert.deepEqual(x.ev[0].args, { change: 'beat' });
  x = await proposal({ change: 'reverse', clip: 1 });
  assert.deepEqual(x.ev[0].args, { change: 'reverse', clip: 1 });
  x = await proposal({ change: 'ramp', clip: 2, ramp_to: 2 });
  assert.match(x.r, /a ramp on clip 2 from 1× to 2×/);
  assert.deepEqual(x.ev[0].args, { change: 'ramp', clip: 2, ramp_to: 2 });
});

test('videoedit edit: what cannot be done is said and nothing is sent (past the clip\'s end, no such clip, no music, the same thing again)', async () => {
  const n = world([message('x')]);
  const no = (args, re) => assert.rejects(() => v.run({ op: 'edit', ...args }, n.ctx), re);
  await no({ change: 'trim', clip: 1, to: 20 }, /clip 1 is only 8\.4 seconds long/);
  await no({ change: 'trim', clip: 1, from: 4, to: 4.1 }, /at least 0\.2 seconds/);
  await no({ change: 'trim', clip: 9, to: 2 }, /no such clip: give clip 1 to 3/);
  await no({ change: 'trim', clip: 1 }, /give "to"/);
  await no({ change: 'swap', clip: 2, with: 2 }, /two different clips/);
  await no({ change: 'transition', clip: 3, kind: 'wipe' }, /last clip has no next clip/);
  await no({ change: 'transition', clip: 1, kind: 'spin' }, /kind is one of cut, crossfade/);
  await no({ change: 'music', track: 'nothing.mp3' }, /no such audio in the project: song\.mp3, waves\.wav/);
  await no({ change: 'best', seconds: 0 }, /1 to 600/);
  await no({ change: 'ramp', clip: 1, ramp_to: 9 }, /0\.25 to 4/);
  await no({ change: 'dance' }, /change is trim, swap/);
  await assert.rejects(() => v.run({ op: 'edit', change: 'beat' }, world([message('x', { music: false })]).ctx), /no music on the timeline/);
  await assert.rejects(() => v.run({ op: 'edit', change: 'remove', clip: 1 }, world([message('x', { clips: [CLIPS[0]] })]).ctx), /at least one clip/);
  assert.match(await v.run({ op: 'edit', change: 'trim', clip: 1, from: 0, to: 8.4 }, n.ctx), /already 8\.4 seconds/);
  assert.match(await v.run({ op: 'edit', change: 'subtitles', on: false }, n.ctx), /no subtitles to take off/);
  assert.match(await v.run({ op: 'edit', change: 'trim', clip: 1, to: 2 }, world(['hello']).ctx), /No video project is open/);
  assert.equal(n.sent.length, 0, 'the refusals sent nothing');
});

test('videoedit export: refused with the sentence he sees; nothing is sent and nothing starts', async () => {
  const w = world([message('export my video')]);
  const r = await v.run({ op: 'export' }, w.ctx);
  assert.equal(r, 'I never start an export: it only starts when you tap EXPORT in the Video editor, with the size said there. Open the video project and tap it when you are ready.');
  assert.equal(w.sent.length, 0);
  // not even with no video open: the same sentence
  assert.equal(await v.run({ op: 'export' }, world(['hello']).ctx), r);
  assert.ok(!v.parameters.properties.change.enum.includes('export'), 'no edit change starts an export');
});

test('videoedit: one tool, nothing it does applies, named when off and described when his words call for it, inside the prompt\'s ceilings', () => {
  assert.equal(v.risk, 'auto');
  assert.equal(v.parameters.properties.op.enum.join(), 'read,edit,export');
  assert.ok(T.TOOLS.filter((t) => t.name === 'videoedit').length === 1 && T.TOOLS.filter((t) => t.name === 'video').length <= 1, 'it does not take videoTools\' name');
  assert.ok(v.description.length <= 1000);
  const off = T.selectGroups('hello', new Set(), false);
  assert.ok(off.off.some((g) => g.name === 'cut') && !off.on.some((g) => g.name === 'cut'));
  assert.ok(!T.selectTools('hello', new Set(), false).some((t) => t.name === 'videoedit'), 'not described on a plain turn');
  for (const t of ['cut the first clip to the first five seconds', 'steady the second clip', 'put subtitles on my video', 'make a best clips cut of the footage']) assert.ok(T.selectTools(t, new Set(), false).some((x) => x.name === 'videoedit'), t);
  const g = T.TOOL_GROUPS.find((x) => x.name === 'cut');
  assert.match(g.about, /^You can /);
  assert.ok(g.about.length <= 220 && g.about.includes('videoedit'));
  const hello = JSON.stringify(T.toolSpecs(T.selectTools('hello', new Set(), false))).length;
  assert.ok(hello < 6500, `hello: ${hello}`);
  const sys = P.systemPrompt({ name: 'boss', now: 'Fri 17 Oct 14:05', tz: 'Europe/London', tab: 'core' }, [], true, [], { code: false, groups: T.selectGroups('hello', new Set(), false) });
  assert.ok(sys.length <= 5500 && /^cut: videoedit$/m.test(sys), `plain prompt ${sys.length}`);
});
