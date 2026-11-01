// TRUST BY GRADE and THE INDEPENDENCE METER (BRIEF-OFFLINE-DEFAULT, batch ⑥ part 2; OWNER-ISSUES 72, 78):
//  - the categoriser on fifty asks: each kind the phone's brain may answer first, and the asks whose words touch a tool
//    (a time, a place, "remind", "send", "search") or need the cloud, which are never the phone's first;
//  - the trust table from a grade fixture: SCHOOL's papers per brain into grades per kind (apps/edge/src/school/trust.ts),
//    then the bar, the twenty-question floor and the misses rule on the phone (apps/web/src/offline/trust.ts);
//  - the meter's counts from a chat fixture: every answer counted by where it was answered and by its kind, the model-free
//    asks as his own, ASK THE CLOUD counting the ask where it ended, the seven and thirty days, the Brief's weekly line;
//  - the fail-closed marker test (OWNER-ISSUES 72): a fictional statement with a distinctive marker, the on-phone route
//    forced, the local model unavailable (and then failing): the task stops with an explanation, and the marker reaches no
//    address at all — and no trusted kind ever opens a kept task.
// Bundles are built here, with esbuild's API, like independence.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: [at('../../web/src/offline/trust.ts'), at('../src/school/trust.ts'), at('../../../packages/shared/src/independence.ts')],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outdir: at('./.build/offline2'),
  outbase: at('../../..'),
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning',
});
const T = await import('./.build/offline2/apps/web/src/offline/trust.mjs');
const E = await import('./.build/offline2/apps/edge/src/school/trust.mjs');
const I = await import('./.build/offline2/packages/shared/src/independence.mjs');

const LONG = 'The council met on Tuesday and agreed to repair the old bridge over the river, closing it for six weeks from March while the work is done and the buses go round.';

const ASKS = [
  // greetings and small talk
  ['hello', 'greet'],
  ['Good morning!', 'greet'],
  ['how are you?', 'greet'],
  ['thanks mate', 'greet'],
  ["hiya, how's it going", 'greet'],
  ['cheers', 'greet'],
  // rewording text he gives (a tool's words inside his text are his text, not an ask)
  ['Reword this: I has went to the shops yesterday and buyed bread.', 'reword'],
  ['Fix the grammar: their going too the park later', 'reword'],
  ['Make this more polite:\nGive me the report now.', 'reword'],
  ['rephrase "we regret to inform you that the meeting is off"', 'reword'],
  ['Shorten this: Please send the report by 5pm to the whole team.', 'reword'],
  // summing up text he gives
  [`Summarise this: ${LONG}`, 'summary'],
  [`tl;dr:\n${LONG}`, 'summary'],
  [`Give me the key points of this: ${LONG}`, 'summary'],
  ['Summarise the news', 'cloud'],
  // translating a sentence (the eight languages)
  ['translate good morning into French', 'translate'],
  ['how do I say thank you in Spanish', 'translate'],
  ['translate where is the station into German', 'translate'],
  ['translate thank you into Urdu', 'cloud'],
  // sums and units (a time or a currency is not a sum)
  ['what is 17 × 23?', 'sums'],
  ['15% of 80', 'sums'],
  ['work out (18 + 7) * 4', 'sums'],
  ['convert 5 miles to km', 'sums'],
  ['how many grams in a pound', 'sums'],
  ["what's 5 + 3 at 5pm", 'cloud'],
  ['convert 20 dollars to euros', 'cloud'],
  // spelling
  ['how do you spell necessary', 'spelling'],
  ['spell accommodation', 'spelling'],
  ['is it spelt definately or definitely?', 'spelling'],
  ['how do you spell the name of the cafe near me', 'cloud'],
  // the day read back (a time is a tool's)
  ["what's on my agenda today?", 'agenda'],
  ['what have I got tomorrow', 'agenda'],
  ['read me my day', 'agenda'],
  ["what's on tomorrow at 3pm", 'cloud'],
  // his memory and the library on the phone ("remind" is a tool's)
  ["what's my sister's name?", 'memory'],
  ['do you remember what I said about the boiler?', 'memory'],
  ['when is my birthday', 'memory'],
  ['what does my library say about volcanoes', 'memory'],
  ['remind me what my wife is called', 'cloud'],
  // questions on what he reads
  ['In the book, why did the fox trick the crow?', 'reading'],
  ["who is the main character in Aesop's fables", 'reading'],
  ['what happens in chapter 3', 'reading'],
  // everything else is the cloud's
  ['remind me to call mum at 6', 'cloud'],
  ['send a text to Sam saying I am late', 'cloud'],
  ['search for cheap flights to Rome', 'cloud'],
  ["what's the weather like?", 'cloud'],
  ['hello, can you set a timer for ten minutes', 'cloud'],
  ['write me a 2000 word essay on the Roman empire', 'cloud'],
  ['how far is Leeds from here', 'cloud'],
  ['book me a table for two tonight', 'cloud'],
];

test('the categoriser on fifty asks: each kind by code from the words, and a tool’s words always the cloud’s', () => {
  assert.equal(ASKS.length, 50);
  const wrong = ASKS.map(([ask, want]) => [ask, want, T.categorise(ask)]).filter(([, want, got]) => want !== got);
  assert.deepEqual(wrong, [], wrong.map(([a, w, g]) => `"${a.slice(0, 50)}": wanted ${w}, got ${g}`).join('; '));
  // every kind is covered, and the phone and the brain name the same kinds
  for (const k of [...T.TRUST_CATS, 'cloud']) assert.ok(ASKS.some(([, want]) => want === k), `no ask of kind ${k}`);
  assert.deepEqual([...T.TRUST_CATS], [...E.TRUST_CATS]);
  assert.equal(T.TRANSLATE_LANGS.length, 8);
  // "translate that into French" means the last reply, which is his to translate
  assert.equal(T.categorise('translate that into French', 'See you at the station.'), 'translate');
  // a sum is worked out on the phone with no model, exactly
  assert.equal(T.workedOut('what is 17 × 23?'), '17 × 23 = 391');
  assert.equal(T.workedOut('15% of 80'), '15% of 80 = 12');
  assert.match(T.workedOut('what is 10 / 3') ?? '', /^10 \/ 3 = 10\/3 \(about 3\.33333\)$/);
  assert.equal(T.workedOut('convert 5 miles to km'), null, 'a unit sum is the brain’s to phrase');
});

// ---------------------------------------------------------------- the trust table

const SMOL = 'SmolLM2-360M-Instruct-q4f16_1-MLC@1d9a4bf';
const HALF = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC@a1b2c3d';
const DAY = 86_400_000;
const T0 = Date.parse('2026-10-28T10:00:00Z');
/** A paper of `n` one-mark questions on one topic, `right` of them right. */
const paper = (model, subject, topic, n, right, at = T0) => ({ model, at, subject, items: Array.from({ length: n }, (_, i) => ({ topic, got: i < right ? 1 : 0, max: 1 })) });

test('the trust table from a grade fixture: grades per kind per brain, then the bar, the twenty-question floor and the misses', () => {
  const papers = [
    // SmolLM2: talking 22 of 24 (92%), spelling 21 of 21, writing 14 of 20 (70%), reading 8 of 10 (too few)
    paper(SMOL, 'talk', 'listening to a story', 12, 11), paper(SMOL, 'talk', 'opposites', 12, 11, T0 + 1000),
    paper(SMOL, 'gps', 'spelling', 21, 21), paper(SMOL, 'writing', 'choosing words', 20, 14), paper(SMOL, 'reading', 'retrieval', 10, 8),
    // Qwen2.5 0.5B: the same and more
    paper(HALF, 'talk', 'word meanings', 24, 23), paper(HALF, 'gps', 'spelling', 22, 21), paper(HALF, 'gps', 'tense', 25, 22),
    paper(HALF, 'reading', 'retrieval', 12, 11), paper(HALF, 'reading', 'inference', 12, 10), paper(HALF, 'reading', 'vocabulary', 12, 4),
    // a maths paper's shapes are not sums; its addition is
    paper(HALF, 'maths', 'shapes', 30, 0), paper(HALF, 'maths', 'addition', 10, 10),
  ];
  const table = E.trustTable(papers);
  assert.deepEqual(table.map((b) => b.model), [SMOL, HALF], 'newest report card first');
  const smol = table.find((b) => b.model === SMOL);
  const row = (b, cat) => b.rows.find((r) => r.cat === cat);
  assert.deepEqual(row(smol, 'greet'), { cat: 'greet', pct: 92, items: 24, from: 'talking and listening' });
  assert.deepEqual(row(smol, 'spelling'), { cat: 'spelling', pct: 100, items: 21, from: 'spelling' });
  assert.equal(row(smol, 'reword').pct, 70, 'spelling is its own kind, not rewording');
  assert.equal(row(smol, 'reword').items, 20);
  assert.equal(row(smol, 'translate').pct, null, 'no paper tests translating yet');
  assert.equal(smol.at, T0 + 1000);
  const half = table.find((b) => b.model === HALF);
  assert.deepEqual(row(half, 'sums'), { cat: 'sums', pct: 100, items: 10, from: 'number and sums' }, 'shapes are not sums');
  assert.deepEqual([row(half, 'summary').pct, row(half, 'summary').items], [88, 24], 'finding and inferring');
  assert.deepEqual([row(half, 'reading').pct, row(half, 'reading').items], [69, 36], 'the whole of reading');
  // a paper whose written answers wait for marks is left out; one with its marks is read with its questions' topics
  const result = { paperId: 'p1', stage: 'ks1', subject: 'gps', title: '', official: false, at: T0, where: 'phone', model: SMOL, raw: 2, max: 3, grade: '', top: false, topics: {}, marked: { exact: 3, model: 0, pending: 0 }, answers: [{ id: 'a', given: '', got: 1, max: 1, how: 'exact' }, { id: 'b', given: '', got: 0, max: 1, how: 'exact' }, { id: 'c', given: '', got: 2, max: 2, how: 'model' }] };
  const items = [{ id: 'a', topic: 'spelling', marks: 1 }, { id: 'b', topic: 'spelling', marks: 1 }, { id: 'c', topic: 'tense', marks: 2 }];
  assert.deepEqual(E.satPaper(result, items), { model: SMOL, at: T0, subject: 'gps', items: [{ topic: 'spelling', got: 1, max: 1 }, { topic: 'spelling', got: 0, max: 1 }, { topic: 'tense', got: 2, max: 2 }] });
  assert.equal(E.satPaper({ ...result, marked: { exact: 2, model: 0, pending: 1 } }, items), null);
  assert.equal(E.ITEM_FLOOR, 20);

  // the phone judges: 80% on at least twenty questions
  const judged = (b, o = {}) => Object.fromEntries(T.judge(b, { bar: 80, misses: [], ...o }).map((j) => [j.cat, j]));
  const s = judged(smol);
  assert.equal(s.greet.trusted, true);
  assert.equal(s.greet.why, '92% on 24 questions');
  assert.equal(s.spelling.trusted, true);
  assert.equal(s.reword.trusted, false);
  assert.equal(s.reword.why, '70% on 20 questions: under your 80%');
  assert.equal(s.reading.trusted, false);
  assert.equal(s.reading.why, '80%, but on only 10 questions: 20 are needed', 'the floor holds whatever the grade');
  assert.equal(s.translate.why, 'no paper tests it yet');
  assert.equal(judged(smol, { bar: 70 }).reword.trusted, true, 'his bar moves it');
  assert.equal(judged(smol, { bar: 95 }).greet.trusted, false);
  assert.ok(T.judge(undefined, { bar: 80, misses: [] }).every((j) => !j.trusted && j.why === 'this brain has sat no paper yet'));

  // three ASK THE CLOUD taps on a kind in a week: the cloud's until the brain's next report card
  const miss = (dt, cat = 'greet', model = SMOL) => ({ at: smol.at + dt, cat, model });
  assert.equal(judged(smol, { misses: [miss(DAY), miss(2 * DAY)] }).greet.trusted, true, 'two misses: still trusted');
  const three = [miss(DAY), miss(2 * DAY), miss(3 * DAY)];
  assert.equal(judged(smol, { misses: three }).greet.trusted, false);
  assert.match(judged(smol, { misses: three }).greet.why, /3 times this week: the cloud's until its next report card/);
  assert.equal(judged(smol, { misses: three }).spelling.trusted, true, 'only that kind');
  assert.equal(judged(table.find((b) => b.model === HALF), { misses: three }).greet.trusted, true, 'only that brain');
  assert.equal(judged(smol, { misses: [miss(DAY), miss(5 * DAY), miss(9 * DAY)] }).greet.trusted, true, 'three spread over more than a week');
  assert.equal(judged(smol, { misses: [miss(-3 * DAY), miss(-2 * DAY), miss(-DAY)] }).greet.trusted, true, 'misses before its report card no longer count');
  assert.equal(judged({ ...smol, at: smol.at + 4 * DAY }, { misses: three }).greet.trusted, true, 'a new report card: trusted again');

});

// ---------------------------------------------------------------- the meter

test('the meter’s counts from a chat fixture: by where and by kind, the no-model asks his own, ASK THE CLOUD counted where it ended', () => {
  const D = '2026-11-01';
  // the chat's own records: his ask, and the reply's model line (the line each answer carries)
  const chat = [
    ['hello', 'On this phone · first'],
    ['how are you?', 'On this phone · first'],
    ['what is 17 × 23?', 'On this phone · worked out'],
    ['how do you spell necessary', 'On this phone · first'],
    ['what can you do?', 'On this phone · no model'],
    ["what's the weather like?", 'groq · llama-3.3-70b-versatile'],
    ['search for cheap flights to Rome', 'gemini · flash'],
    ['tell me about black holes', 'Library on this device · offline'],
  ];
  for (const [, model] of chat) assert.equal(I.whereFrom(model).where === 'cloud', /^(groq|gemini)/.test(model), model);
  let days = [];
  for (const [ask, model] of chat) days = I.addAnswer(days, D, model, { cat: T.categorise(ask) });
  // last week, for the trend and the Brief's line: 48% on his own brains
  days = I.addAnswer(days, '2026-10-25', 'groq · x', { cat: 'cloud' });
  for (let i = 0; i < 24; i++) days = I.addAnswer(days, '2026-10-24', i < 12 ? 'On this phone · first' : 'groq · x', { cat: i < 12 ? 'greet' : 'cloud' });
  const today = days.find((x) => x.d === D);
  assert.deepEqual(today.n, { phone: 5, cloud: 2, library: 1 });
  assert.deepEqual(today.g, { greet: { n: 2, o: 2 }, sums: { n: 1, o: 1 }, spelling: { n: 1, o: 1 }, cloud: { n: 4, o: 2 } });
  assert.equal(I.forBrain(days).find((x) => x.d === D).g, undefined, 'the kinds never leave the phone');

  const w7 = T.spanOf(days, D, 7);
  assert.deepEqual([w7.total, w7.own, w7.pct], [8, 6, 75]);
  const w30 = T.spanOf(days, D, 30);
  assert.deepEqual([w30.total, w30.own, w30.pct], [33, 18, 55]);
  assert.deepEqual(w30.cats.greet, { n: 14, o: 14 });
  assert.equal(T.briefLine(days, D), 'This week 75 per cent of what you asked stayed on your phone, up from 48.');

  // ASK THE CLOUD under "hello": the phone's answer comes off, and the cloud's is counted as the cloud's
  days = I.dropAnswer(days, D, 'On this phone · first', { cat: 'greet' });
  days = I.addAnswer(days, D, 'groq · x', { cat: 'greet' });
  const after = days.find((x) => x.d === D);
  assert.deepEqual([after.n.phone, after.n.cloud], [4, 3]);
  assert.deepEqual(after.g.greet, { n: 2, o: 1 });
  assert.equal(T.spanOf(days, D, 7).pct, 63);
  // nothing to take back: unchanged
  assert.deepEqual(I.dropAnswer(days, '2026-01-01', 'On this phone · first', { cat: 'greet' }), days);
  assert.equal(T.briefLine([], D), '');
});

// ---------------------------------------------------------------- the fail-closed marker test (OWNER-ISSUES 72)

test('fail closed: a kept task stops with an explanation when the phone cannot answer, and its marker reaches no address', async () => {
  const MARKER = 'ZORBLAX-7741-QUILLFEATHER';
  const statement = `My neighbour ${MARKER} keeps the spare key under the blue pot by the shed.`;
  // every request anything makes is seen here (the suite's no-network guard stops real ones too)
  const seen = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    seen.push(`${url} ${typeof init.body === 'string' ? init.body : ''}`);
    throw new TypeError('no network in this test');
  };
  try {
    for (const route of [{ mode: 'always' }, { mode: 'auto', here: true }]) {
      // the on-phone route forced: kept, whatever the kind of ask; never answered "first" (a trusted kind changes nothing)
      assert.equal(T.keptTurn(route), true);
      for (const cat of [...T.TRUST_CATS, 'cloud', T.categorise(statement)]) assert.equal(T.mayGoFirst({ ...route, cat }), false);
      // the local model unavailable: the task stops, in words
      const stops = [];
      let asked = 0;
      const answered = await T.keptAnswer(route.mode, { ready: async () => false, answer: async () => ++asked > 0, stop: (why, words) => stops.push({ why, words }) });
      assert.equal(answered, false);
      assert.equal(asked, 0, 'no model to ask');
      assert.deepEqual(stops, [{ why: "my offline brain isn't on this phone yet (Settings → Offline brain → DOWNLOAD, on Wi-Fi)", words: "I can't do this on the phone right now: my offline brain isn't on this phone yet (Settings → Offline brain → DOWNLOAD, on Wi-Fi). Nothing of it left the phone." }]);
      // the model there but failing (a lost device): it stops too; never a retry elsewhere
      const fails = [];
      assert.equal(await T.keptAnswer(route.mode, { ready: async () => true, answer: async () => { throw new Error('Device was lost'); }, stop: (why) => fails.push(why) }), false);
      assert.deepEqual(fails, ["my offline brain couldn't answer it"]);
    }
    // switched off: kept all the same, with its own words
    const off = [];
    await T.keptAnswer('off', { ready: async () => true, answer: async () => true, stop: (why) => off.push(why) });
    assert.deepEqual(off, ['my offline brain is switched off (Settings → Offline brain)']);
    // only his tap (ASK THE BIG BRAIN: `cloud`) takes a message off the phone
    assert.equal(T.keptTurn({ mode: 'always', cloud: true }), false);
    // the marker reached no address at all
    assert.deepEqual(seen.filter((s) => s.includes(MARKER)), []);
    assert.deepEqual(seen, []);
  } finally {
    globalThis.fetch = realFetch;
  }
});
