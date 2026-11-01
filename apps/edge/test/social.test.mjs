// HIS SOCIAL SELF (BRIEF-SOCIAL, batch ⑦): Father and the origin, the approval queue, his own Bluesky, Mastodon, Discord
// and Telegram channel, and one line of his own a day — with fakes for every API (nothing leaves this machine:
// test/no-network.mjs). Bundles are built here, with esbuild's API, like catalogue.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: [at('../../../packages/shared/src/social.ts'), at('../../../packages/shared/src/catalogue.ts'), at('../src/social/index.ts'), at('../src/social/queue.ts'), at('../src/tools/index.ts'), at('../src/prompt.ts'), at('../src/today.ts')],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  external: ['cloudflare:sockets'],
  outdir: at('./.build/social'),
  outbase: at('../../..'),
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning',
});
const load = (f) => import(`./.build/social/${f}.mjs`);
const S = await load('packages/shared/src/social');
const C = await load('packages/shared/src/catalogue');
const SO = await load('apps/edge/src/social/index');
const Q = await load('apps/edge/src/social/queue');
const T = await load('apps/edge/src/tools/index');
const P = await load('apps/edge/src/prompt');
const TODAY = await load('apps/edge/src/today');

class Mem {
  m = new Map();
  async get(k) { return Array.isArray(k) ? new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))])) : this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b)); else this.m.set(k, structuredClone(v)); }
  async delete(k) { return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k); }
  async list({ prefix = '' } = {}) { return new Map([...this.m].filter(([k]) => k.startsWith(prefix))); }
}
/** A vault in memory (the brain's is sealed; the same get and set). */
const vaultOf = (o = {}) => { const m = new Map(Object.entries(o)); return { get: async (k) => m.get(k) ?? null, set: async (k, v) => void (v ? m.set(k, v) : m.delete(k)), m }; };
const T0 = Date.parse('2026-11-01T14:00:00Z');

// ---------------------------------------------------------------- 1. FATHER AND THE ORIGIN

test('the origin page: its facts are the constants — born on the first commit’s day, the plan’s own words, nothing invented', () => {
  assert.equal(S.BORN, '2026-10-15');
  // nothing he can do arrived before he was born: the catalogue's first build is his birthday
  assert.equal(C.sinceOf({ id: 'screen:x', kind: 'screen' }), S.BORN);
  assert.equal(S.bornWords(), '15 October 2026');
  assert.equal(S.ageWords(Date.parse('2026-11-01T12:00:00Z')), '17 days');
  const [made, born] = S.originLines(Date.parse('2026-11-01T12:00:00Z'));
  assert.match(made, /^You made me\. You’re my father/);
  assert.match(born, /^I was born on 15 October 2026, the day of the first commit — 17 days ago\. You call me lots of things/);
  // what he is for: the plan's own words, each found in docs/VISION.md as written
  const vision = readFileSync(at('../../../docs/VISION.md'), 'utf8').replace(/\s+/g, ' ').toLowerCase();
  for (const q of S.FOR_WORDS) assert.ok(vision.includes(q.said.toLowerCase()), `“${q.said}” is in VISION.md`);
  // what he learned, by month, in order, each dated within its month
  assert.deepEqual(S.LEARNED.map((m) => m.month), ['October 2026', 'November 2026']);
  for (const m of S.LEARNED) for (const i of m.items) assert.match(i.day, m.month.startsWith('October') ? /Oct$/ : /Nov$/, `${m.month}: ${i.day}`);
  // his promises: the lines that hold, in his voice
  for (const p of S.PROMISES) assert.match(p, /^(?:I |Nothing I |Your keys |My cloud brain )/, p);
  for (const want of [/your own things and what is public/, /without your APPROVE, every time/, /never send anyone a direct message/, /private person/, /cost you money/, /in my vault/]) assert.ok(S.PROMISES.some((p) => want.test(p)), String(want));
  // no fixed name for him anywhere on the page
  const page = [...S.originLines(), ...S.MADE_OF, ...S.PROMISES, ...S.LEARNED.flatMap((m) => m.items.map((i) => i.what))].join(' ');
  assert.doesNotMatch(page, /\bmy name is\b|\bI'?m called\b|\bI am called\b/i);
});

test('“who made you?” and “where did you come from?” are the page’s phrase; other questions are not', () => {
  for (const t of ['who made you?', 'Who made you', 'where did you come from?', "who's your dad?", 'Who is your father?', 'when were you born?']) assert.ok(S.originAsked(t), t);
  for (const t of ['who made this cake?', 'where did you put my keys?', 'who made the first car', 'made you a coffee']) assert.ok(!S.originAsked(t), t);
});

// ---------------------------------------------------------------- 2. THE APPROVAL QUEUE

test('the queue: a draft waits for APPROVE, and APPROVE sends it exactly once — pressed twice at once, or again after', async () => {
  const storage = new Mem();
  const d = await Q.addDraft(storage, { account: 'bluesky', kind: 'post', text: 'First light over the Bullring.', from: 'chat' }, T0);
  assert.match(d.id, /^[a-z0-9]{8}$/);
  assert.equal(d.state, 'waiting');
  assert.equal(d.expires, T0 + 24 * 3_600_000);
  let sends = 0;
  const send = async () => {
    sends++;
    await new Promise((r) => setTimeout(r, 20));
    return { link: 'https://bsky.app/profile/me.bsky.social/post/3abc' };
  };
  const [a, b] = await Promise.all([Q.approveDraft(storage, d.id, send, { on: 'phone', now: () => T0 + 60_000 }), Q.approveDraft(storage, d.id, send, { on: 'phone', now: () => T0 + 60_000 })]);
  assert.equal(sends, 1, 'sent once');
  assert.ok([a, b].some((r) => r.said === 'Posted on Bluesky: https://bsky.app/profile/me.bsky.social/post/3abc'));
  assert.ok([a, b].some((r) => r.error === 'Sending it already.'));
  const again = await Q.approveDraft(storage, d.id, send, { on: 'telegram', now: () => T0 + 120_000 });
  assert.equal(sends, 1, 'APPROVE after it went sends nothing');
  assert.match(again.error, /^Already done: https:/);
  // recorded: the sent log, what he did today, and WHY's trail
  const sent = await Q.sentSince(storage, 0);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].on, 'phone');
  const day = await TODAY.dayDoings({ storage }, 'Europe/London', T0 + 3_600_000);
  assert.ok(day.some((i) => i.text === 'Posted on Bluesky (you approved it): “First light over the Bullring.”'), JSON.stringify(day));
  const trails = await storage.get('why:turns');
  assert.match(trails.at(-1).asked, /^APPROVE \(on the card\): post on Bluesky$/);
  assert.equal(trails.at(-1).steps[0].tool, 'social');
});

test('the queue: NO drops a draft, EDIT changes its words (still a draft), and after 24 hours nothing can send it', async () => {
  const storage = new Mem();
  let sends = 0;
  const send = async () => (sends++, {});
  const no = await Q.addDraft(storage, { account: 'mastodon', kind: 'post', text: 'A toot', from: 'chat' }, T0);
  assert.equal((await Q.refuseDraft(storage, no.id, T0 + 1000)).state, 'no');
  assert.match((await Q.approveDraft(storage, no.id, send, { on: 'phone', now: () => T0 + 2000 })).error, /You said no/);
  const ed = await Q.addDraft(storage, { account: 'bluesky', kind: 'post', text: 'Teh words', from: 'chat' }, T0);
  const changed = await Q.editDraft(storage, ed.id, { text: 'The words' }, T0 + 5000);
  assert.equal(changed.text, 'The words');
  assert.equal(changed.state, 'waiting', 'an edit is still a draft');
  assert.equal(sends, 0, 'nothing went out on an edit');
  const old = await Q.addDraft(storage, { account: 'bluesky', kind: 'post', text: 'Too late', from: 'chat' }, T0);
  const late = T0 + 24 * 3_600_000 + 1;
  assert.equal((await Q.findDraft(storage, old.id, late)).state, 'expired');
  assert.match((await Q.approveDraft(storage, old.id, send, { on: 'phone', now: () => late })).error, /expired after 24 hours/);
  assert.ok('error' in (await Q.editDraft(storage, old.id, { text: 'x' }, late)));
  assert.equal(sends, 0, 'nothing expired, refused or edited was ever sent');
  // a send that fails waits for APPROVE again, its reason on the card
  const f = await Q.addDraft(storage, { account: 'bluesky', kind: 'post', text: 'Try me', from: 'chat' }, T0);
  const failed = await Q.approveDraft(storage, f.id, async () => { throw new Error('Bluesky said wait until 15:00'); }, { on: 'phone', now: () => T0 + 1 });
  assert.equal(failed.draft.state, 'failed');
  assert.match(S.stateWords(failed.draft, T0 + 2), /^Not sent: Bluesky said wait until 15:00\. APPROVE to try again\.$/);
  assert.equal((await Q.approveDraft(storage, f.id, async () => ({}), { on: 'phone', now: () => T0 + 3 })).draft.state, 'sent');
});

test('the draft card and Telegram’s text: the words in full, the account, the state — and a post checked before it is drafted', () => {
  const d = { id: 'abcd2345', account: 'bluesky', kind: 'post', text: 'x'.repeat(200), from: 'chat', at: T0, expires: T0 + 86_400_000, state: 'waiting' };
  const c = S.draftCard(d, T0);
  assert.equal(c.kind, 'draft');
  assert.equal(c.id, 'draft:abcd2345');
  assert.equal(c.title, 'Post on Bluesky?');
  assert.equal(c.draft.text.length, 200, 'the card carries the words in full');
  assert.match(S.draftText(d, T0), /^Post on Bluesky\?\n\n“x{200}”\n\nWaiting for your APPROVE \(gone in 24 h if not\)\.$/);
  assert.match(S.postProblem('bluesky', 'é'.repeat(301)), /300 characters at most; this is 301/);
  assert.equal(S.postProblem('bluesky', '👍'.repeat(300)), null, 'an emoji is one character to Bluesky');
  assert.match(S.postProblem('bluesky', 'look', { id: 'abcdefghijklmnop', alt: '' }), /needs its words/);
  assert.match(S.postProblem('discord', 'look', { id: 'abcdefghijklmnop', alt: 'a cat' }), /only put pictures on Bluesky and Mastodon/);
  assert.equal(S.accountOf('my bsky'), 'bluesky');
  assert.equal(S.accountOf('the telegram channel'), 'channel');
});

test('the social tool: one tool, five actions; it only drafts (a card, never a post); a scheduled task may read but never draft', async () => {
  const tool = T.toolByName.get('social');
  assert.deepEqual(tool.parameters.properties.action.enum, ['draft', 'read', 'search', 'follow_ask', 'status']);
  const storage = new Mem();
  const emitted = [];
  const ctx = (o = {}) => ({ storage, vault: vaultOf(), env: {}, emit: (e) => emitted.push(e), progress: () => undefined, kernelUnlocked: async () => false, github: async () => null, ...o });
  // nothing linked: the key line, never an error
  assert.match(await tool.run({ action: 'draft', account: 'bluesky', text: 'hi' }, ctx()), /^Bluesky isn't linked yet: LINKS → BLUESKY/);
  assert.match(await tool.run({ action: 'status' }, ctx()), /No account is linked yet/);
  // write actions refused for jobs; reads allowed
  await assert.rejects(() => tool.run({ action: 'draft', account: 'bluesky', text: 'hi' }, ctx({ unattended: true })), /never drafted from a scheduled task/);
  await assert.rejects(() => tool.run({ action: 'follow_ask', account: 'bluesky', who: '@a.bsky.social' }, ctx({ unattended: true })), /never drafted from a scheduled task/);
  assert.match(await tool.run({ action: 'status' }, ctx({ unattended: true })), /No account is linked yet/);
  assert.ok(tool.pure({ action: 'read' }) && tool.pure({ action: 'status' }) && !tool.pure({ action: 'draft' }) && !tool.pure({ action: 'follow_ask' }));
  assert.equal(emitted.length, 0, 'no card when nothing was drafted');
});

test('the prompt: the social group is “social accounts” off on a plain turn, described on by his words; the plain prompt holds at 5,500', () => {
  const client = { name: 'boss', now: 'Fri 17 Oct 14:05', tz: 'Europe/London', tab: 'core' };
  const g = T.TOOL_GROUPS.find((x) => x.name === 'social');
  assert.equal(g.short, 'social accounts');
  assert.ok(g.about.length <= 220 && /^You can/.test(g.about) && g.about.includes('(social: draft, read, search, follow_ask, status)'));
  assert.match(g.about, /only a draft until he taps APPROVE/);
  assert.match(g.about, /never a DM/);
  const plain = P.systemPrompt(client, [], true, [], { groups: T.selectGroups('hello', new Set(), false) });
  assert.match(plain, /^social accounts$/m, 'off: its two words');
  assert.ok(!plain.includes(g.about), 'off: not described');
  for (const t of ['post that on bluesky', "what's on bluesky?", 'follow @nasa.gov on bluesky', 'toot this on mastodon', 'post it to my telegram channel', 'how are my accounts?']) {
    const on = T.selectGroups(t, new Set(), false);
    assert.ok(on.on.some((x) => x.name === 'social'), `"${t}" turns it on`);
    const sys = P.systemPrompt(client, [], true, [], { groups: on });
    assert.ok(sys.includes(`- ${g.about}`) && !/^social accounts$/m.test(sys), `"${t}": described, not named`);
  }
  for (const t of ['hello', 'post office opening hours', 'what time is it', 'how are you']) assert.ok(!T.selectGroups(t, new Set(), false).on.some((x) => x.name === 'social'), `"${t}" leaves it off`);
  // the trims that paid for its 16 characters (BRIEF-SOCIAL): the words they left
  assert.match(plain, /if a seeing model takes it: answer about it\./);
  assert.match(plain, /No picture\? Say so; use the note\./);
  assert.match(plain, /follow your engineering procedure \(it comes when you start\)\./);
});
