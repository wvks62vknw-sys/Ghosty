// HIS SOCIAL SELF (BRIEF-SOCIAL, batch ⑦): Father and the origin, the approval queue, his own Bluesky, Mastodon, Discord
// and Telegram channel, and one line of his own a day — with fakes for every API (nothing leaves this machine:
// test/no-network.mjs). Bundles are built here, with esbuild's API, like catalogue.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: [at('../../../packages/shared/src/social.ts'), at('../../../packages/shared/src/catalogue.ts')],
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
