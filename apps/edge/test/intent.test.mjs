// What the owner means, read from his own words with no model (packages/shared/src/intent.ts): deterministic,
// instant and free. OWNER-ISSUES 70a: a stop by intent, not by keyword — "shut the fuck up" and he does exactly that.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const I = await import('./.build/intent.mjs');

/** Every one of these stops him: typed or spoken, with his name, swearing, "please", typos and trailing words. */
const STOPS = [
  'stop', 'Stop.', 'STOP!!!', 'stop it', 'stop that', 'stop talking', 'stop speaking', 'stop it now', 'please stop', 'stop please',
  'ok stop', 'just stop', 'stop stop stop', 'Ghosty, stop', 'stop ghosty', 'for god’s sake stop', 'I said stop', 'enough',
  "that's enough", 'alright that’s enough', 'enough now mate', 'enough of that', 'leave it', 'leave it there', 'leave it out',
  'not now', 'not right now', 'drop it', 'zip it', 'be quiet', 'quiet!', 'quiet please', 'keep quiet', 'shh', 'shhhh', 'shush',
  'hush', 'silence', 'cancel', 'stand down', 'never mind', 'nvm', 'pipe down', 'button it', 'give it a rest', 'give over',
  'put a sock in it', 'knock it off', 'cut it out', 'pack it in', 'quit it', "that'll do", 'no more', 'can you stop talking?',
  // typos and slang
  'stpo', 'sotp', 'stopp', 'stop talkng', 'enoguh', 'enuff', 'be quite', 'stahp',
  // a harsh dismissal (these leave him subdued)
  'shut up', 'SHUT UP', 'shut it', 'shut the fuck up', 'shut the fuck up ghosty', 'stfu', 'oh shut up', 'will you shut up?',
  'shut up man', 'shut up shut up', 'shutup', 'shuddup', 'shtu up', 'shut uo', 'shut your mouth', 'for fuck’s sake shut up',
  'fuck off', 'go away', 'leave me alone', 'stop it ffs', 'fucking stop', 'wind your neck in', '🤫', '🤐',
];
const HARSH = new Set(['shut up', 'SHUT UP', 'shut it', 'shut the fuck up', 'shut the fuck up ghosty', 'stfu', 'oh shut up', 'will you shut up?', 'shut up man', 'shut up shut up', 'shutup', 'shuddup', 'shtu up', 'shut uo', 'shut your mouth', 'for fuck’s sake shut up', 'fuck off', 'go away', 'leave me alone', 'stop it ffs', 'fucking stop', 'wind your neck in']);

/** None of these is a stop: a stop word about something else, a question, a word a typo is never "corrected" from. */
const NOT_STOPS = [
  'stop the timer', "don't stop", 'it stopped raining', 'is that enough?', 'not enough milk', 'leave it on the side',
  "drop it off at mum's", 'drop it in the group chat', 'quiet street near me', "where's the nearest bus stop", "I can't stop laughing",
  'never stop learning', 'shut the door', 'be quiet about it at the party', 'cancel my 3pm', 'silence my phone', 'zip code for Leeds',
  'hush puppies recipe', 'full stop', 'stop sign', 'now', 'ok', "you can't stop me", 'nonstop flights to Rome', 'stop the music',
  'not now but remind me tomorrow', 'how do I stop a nosebleed', 'stop?', 'enough?', 'step', 'shop', 'quite', 'quite right', 'cancer',
  "that's enough sugar", 'leave it with me', 'give it a go', 'stand down the alarm', 'stop by the shop later', 'what stops you?', '',
];

test('stopIntent: 40+ ways of saying stop, typed or spoken, with his name, swearing, typos and trailing words — and which are harsh', () => {
  assert.ok(STOPS.length >= 40, `${STOPS.length} phrases`);
  for (const t of STOPS) {
    const s = I.stopIntent(t);
    assert.ok(s, `"${t}" stops him`);
    assert.equal(s.harsh, HARSH.has(t), `"${t}" is ${HARSH.has(t) ? '' : 'not '}harsh`);
  }
});

// OWNER-ISSUES 64 RAISING HIM, 69c: praise, a telling-off and a standing rule, in his own words.
const REWARDS = [['good boy', 2], ['Good boy!', 2], ['well done', 2], ['nice one mate', 2], ["that's it", 2], ['spot on', 2], ['nailed it', 2], ['thanks, well done', 2], ['proud of you', 3], ["I'm so proud of you kiddo", 3], ['you legend', 3], ['absolute legend', 3], ['good', 1], ['perfect', 1], ['great', 1]];
const DISCIPLINES = [['wrong', 1], ["that's not right", 1], ['that was wrong', 2], ['bad boy', 2], ['out of order', 2], ['that was out of line', 2], ["don't ever do that again", 2], ['what was that', 2], ['bloody wrong', 2], ['useless', 3], ["you're useless", 3], ['fucking useless', 3], ['what the fuck was that', 3], ['bad, really bad', 2]];
const RULES = [['too long', true], ['way too long mate', true], ['shorter please', true], ['get to the point', true], ['never call me that', false], ['always tell me the price first', false], ['stop saying certainly', false], ["don't call me boss", false], ['call me Aqis', false], ['no more emojis', false], ["don't do that", false], ['from now on, answer in Spanish', false], ['next time tell me the price first', false], ['never guess the time', false]];
const NOT_RAISING = ['learn TS2532 came from indexing an array without a fallback. Rule: always use arr[i]! or ?? for indexed values.', 'stop the timer', 'always remind me at 8', "don't forget the milk", 'never mind', 'good morning', 'thanks', 'ok', "don't tell mum", 'come on', 'Good. Now what about the trains?', 'that is a good idea', 'what time is it', 'shut up', 'is it good?', 'the good place near me', 'right', 'no', ''];

test('raising: praise by strength (1 "good", 2 "good boy", 3 "proud of you"), a telling-off by strength, a swear makes it sharper', () => {
  for (const [t, w] of REWARDS) assert.deepEqual([I.raising(t)?.kind, I.raising(t)?.weight, I.raising(t)?.rest], ['reward', w, ''], t);
  for (const [t, w] of DISCIPLINES) assert.deepEqual([I.raising(t)?.kind, I.raising(t)?.weight], ['discipline', w], t);
  // "good" or "great" after his question or offer is an answer, not praise; "good boy" is praise whatever came before
  assert.equal(I.raising('good', 'Shall I book the 9am?'), null);
  assert.equal(I.raising('great', 'I can move it to Friday.'), null);
  assert.equal(I.raising('good boy', 'Shall I book the 9am?')?.kind, 'reward');
});

test('raising: a standing rule in his own words (too long, never call me that, always tell me the price first) — a task or a stop is not one', () => {
  for (const [t, length] of RULES) {
    const r = I.raising(t);
    assert.ok(r?.rule, `"${t}" is a rule`);
    assert.equal(r.length, length, `"${t}" is ${length ? '' : 'not '}about length`);
    assert.equal(r.rest, '', `"${t}" asks nothing else`);
  }
  assert.equal(I.raising('Never call me that.').rule, 'Never call me that', 'his words, as he said them');
  for (const t of NOT_RAISING) assert.equal(I.raising(t), null, `"${t}" is none of them`);
});

test('raising: praise or a telling-off with a request keeps the request; a telling-off with a rule is both', () => {
  assert.deepEqual(I.raising('good boy, now book the 9am'), { kind: 'reward', weight: 2, rest: 'now book the 9am' });
  assert.deepEqual(I.raising("wrong, it leaves at 7:45"), { kind: 'discipline', weight: 1, rest: 'it leaves at 7:45' });
  const both = I.raising("That was wrong. Don't ever do that again.");
  assert.deepEqual([both.kind, both.weight, both.rule, both.rest], ['discipline', 2, "Don't ever do that again", '']);
});

test('stopIntent: 20+ things that are not a stop — a stop word about something else, a question, a real word never "corrected"', () => {
  assert.ok(NOT_STOPS.length >= 20, `${NOT_STOPS.length} phrases`);
  for (const t of NOT_STOPS) assert.equal(I.stopIntent(t), null, `"${t}" is not a stop`);
  assert.equal(I.stopIntent('stop '.repeat(30)), null, 'a long message is a conversation');
});

// ---- his mood (packages/shared/src/mood.ts, OWNER-ISSUES 70b, 63, 69d): honest, lingering, real state only, never a lever ----

const M = await import('./.build/mood.mjs');
const NOW = Date.UTC(2026, 9, 31, 12);
const MIN = 60_000;

test('mood: every trigger, from real state only; each lingers its time (minutes to an hour or two) and fades to calm; a new one replaces the old', () => {
  const cases = [
    [{ kind: 'stop', harsh: true }, 'subdued', 45],
    [{ kind: 'discipline', weight: 1 }, 'subdued', 15],
    [{ kind: 'discipline', weight: 2 }, 'subdued', 45],
    [{ kind: 'discipline', weight: 3 }, 'subdued', 90],
    [{ kind: 'reward', weight: 1 }, 'pleased', 20],
    [{ kind: 'reward', weight: 2 }, 'pleased', 40],
    [{ kind: 'reward', weight: 3 }, 'pleased', 90],
    [{ kind: 'taught' }, 'pleased', 30],
    [{ kind: 'danger' }, 'protective', 90],
    [{ kind: 'danger', scam: true }, 'protective', 90],
    [{ kind: 'goDark' }, 'cross', 60],
    [{ kind: 'task', what: 'sitting a paper', minutes: 60 }, 'focused', 60],
    [{ kind: 'gymWin', what: 'a GYM win: maze level 5' }, 'pleased', 40],
  ];
  for (const [ev, kind, minutes] of cases) {
    const m = M.moodAfter(M.CALM, ev, NOW);
    assert.equal(m.kind, kind, JSON.stringify(ev));
    assert.equal(m.until - m.since, minutes * MIN, JSON.stringify(ev));
    assert.equal(M.moodNow(m, m.until - 1).kind, kind, `${kind}: still there a moment before it fades`);
    assert.equal(M.moodNow(m, m.until + 1).kind, 'calm', `${kind}: calm once it fades`);
  }
  assert.equal(M.moodAfter(M.moodAfter(M.CALM, { kind: 'reward', weight: 2 }, NOW), { kind: 'goDark' }, NOW + MIN).kind, 'cross', 'a new real trigger replaces the old');
  assert.equal(M.moodNow({ kind: 'subdued', since: 0, cause: 'x', until: 'never' }, NOW).kind, 'calm', 'anything odd is calm');
});

test('mood: stand down — "stand down", "calm down", "it\'s fine", "I\'m sorry" and any stop are calm at once, over everything; a harsh stop leaves him subdued', () => {
  for (const kind of ['cross', 'protective', 'subdued', 'pleased', 'focused']) {
    const prev = { kind, since: NOW - MIN, cause: 'x', until: NOW + 60 * MIN };
    assert.equal(M.moodAfter(prev, { kind: 'standDown' }, NOW).kind, 'calm', `${kind} stands down`);
    assert.equal(M.moodAfter(prev, { kind: 'stop', harsh: false }, NOW).kind, 'calm', `a stop stands ${kind} down`);
    assert.equal(M.moodAfter(prev, { kind: 'stop', harsh: true }, NOW).kind, 'subdued', `"shut up" from ${kind}: he stops, and it stung`);
  }
  for (const t of ['stand down', 'Calm down', "it's fine", "It's fine, just book the 9am", "I'm sorry", 'sorry mate', 'ok, stand down', 'my bad', 'chill', "we're good"]) assert.deepEqual(M.moodEvent(t), { kind: 'standDown' }, t);
});

test('mood: only what fits him lifts him — a kind word after a sharp one does, a bare "cheer up" does nothing; his commands and his danger', () => {
  for (const t of ['cheer up', 'smile', 'be happy', 'cheer up mate!']) assert.equal(M.moodEvent(t), null, `"${t}" does nothing`);
  const sharp = M.moodAfter(M.CALM, { kind: 'discipline', weight: 2 }, NOW);
  assert.deepEqual(M.moodEvent("you're alright, mate"), { kind: 'kindWord' });
  assert.deepEqual(M.moodEvent('thanks mate'), { kind: 'kindWord' });
  assert.equal(M.moodAfter(sharp, { kind: 'kindWord' }, NOW + MIN).kind, 'pleased', 'warmth after sharpness');
  assert.equal(M.moodAfter(M.CALM, { kind: 'kindWord' }, NOW).kind, 'calm', 'when he is calm, a kind word is just a kind word');
  assert.deepEqual(M.moodEvent('go dark'), { kind: 'goDark' });
  assert.deepEqual(M.moodEvent('get angry, Ghosty'), { kind: 'goDark' });
  assert.deepEqual(M.moodEvent("someone's following me"), { kind: 'danger' });
  assert.deepEqual(M.moodEvent("I don't feel safe walking home"), { kind: 'danger' });
  assert.deepEqual(M.moodEvent('is this a scam? "Your parcel is held, pay £1.99"'), { kind: 'danger', scam: true });
  // tightened at review: "go dark" is his command, said to him, not a question about the screen; a plea for help with homework
  // is not danger; an ordinary message from his bank is not a scam, one "saying it's from" the bank is
  assert.deepEqual(M.moodEvent('ok go dark'), { kind: 'goDark' });
  assert.equal(M.moodEvent('does the screen go dark when it locks?'), null);
  assert.equal(M.moodEvent('help me please with my maths homework'), null);
  assert.equal(M.moodEvent('an email from my bank about the statement'), null);
  assert.deepEqual(M.moodEvent("a text saying it's from Evri about a parcel"), { kind: 'danger', scam: true });
  assert.deepEqual(M.moodEvent('this looks like a scam'), { kind: 'danger', scam: true });
  assert.deepEqual(M.moodEvent('remember my sister is called Aisha'), { kind: 'taught' });
  assert.deepEqual(M.moodEvent('did you know otters hold hands'), { kind: 'taught' });
  for (const t of ['what time is it', 'book the 9am', 'play some music', 'it is dark early today', 'the news is scary', '']) assert.equal(M.moodEvent(t), null, `"${t}" moves nothing`);
});

test('mood: one line in the prompt, within its budget, that says help is never withheld; words and a shape for the Me sheet', () => {
  assert.equal(M.moodLine(M.CALM, NOW), '', 'calm: no line');
  const longest = [
    [{ kind: 'discipline', weight: 3 }, /^MOOD: subdued \(he told you off, 59m ago\): few words, no jokes; help fully, never sulk\.$/],
    [{ kind: 'stop', harsh: true }, /^MOOD: subdued \(he shut you up, 44m ago\): /],
    [{ kind: 'danger', scam: true }, /^MOOD: protective \(a scam he showed you, 59m ago\): steady, plain, his safety first\.$/],
    [{ kind: 'goDark' }, /^MOOD: cross \(he said go dark, 59m ago\): cold and clipped; still help fully\.$/],
    [{ kind: 'reward', weight: 3 }, /^MOOD: pleased \(he said you did well, 59m ago\): a touch warmer, no gushing\.$/],
    [{ kind: 'task', what: 'sitting a paper', minutes: 60 }, /^MOOD: focused \(sitting a paper, 59m ago\): steady, few words\.$/],
  ];
  for (const [ev, re] of longest) {
    const m = M.moodAfter(M.CALM, ev, NOW);
    const line = M.moodLine(m, NOW + Math.min(59, (m.until - m.since) / MIN - 1) * MIN);
    assert.match(line, re);
    assert.ok(line.length <= 88, `${line.length}: ${line}`);
  }
  assert.match(M.moodLine(M.moodAfter(M.CALM, { kind: 'discipline', weight: 2 }, NOW), NOW + 20 * MIN), /help fully, never sulk/);
  assert.deepEqual(M.moodWords(M.moodAfter(M.CALM, { kind: 'discipline', weight: 2 }, NOW), NOW + 20 * MIN), { word: 'Subdued', why: 'You told me off, 20 min ago' });
  assert.deepEqual(M.moodWords(M.CALM, NOW), { word: 'Calm', why: '' });
});

/** The brain's storage, enough for a whole agent. */
class Store {
  m = new Map();
  async get(k) { return Array.isArray(k) ? new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))])) : this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b)); else this.m.set(k, structuredClone(v)); }
  async delete(k) { return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k); }
  async list({ prefix = '' } = {}) { return new Map([...this.m].filter(([x]) => x.startsWith(prefix))); }
  async setAlarm() {}
  async getAlarm() { return null; }
}

test('mood through the brain: a harsh stop leaves him subdued and he still answers a request in full; "cheer up" does nothing; only his own words move it; a kind word lifts him; a stand-down is calm at once', async () => {
  const brain = await import('./.build/brain.mjs');
  const pending = [];
  const agent = new brain.GhostyAgent({ storage: new Store(), waitUntil: (x) => pending.push(x), blockConcurrencyWhile: (f) => f() }, { VAULT_KEY: Buffer.alloc(32, 7).toString('base64'), MOCK_LLM: '1' });
  const call = async (path, body, method = 'POST') => {
    const r = await agent.fetch(new Request(`https://g.example/api${path}`, { method, ...(body ? { body: JSON.stringify(body) } : {}), headers: { 'x-ghosty-key': 'owner-key-for-tests-0123456789' } }));
    const text = await r.text();
    await Promise.allSettled(pending.splice(0));
    return text;
  };
  const chat = async (message, extra = {}) => (await call('/chat', { message, ...extra })).split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const said = (ev) => ev.find((e) => e.t === 'text')?.text ?? '';
  const moodOf = async () => JSON.parse(await call('/status', null, 'GET')).mood?.kind;
  assert.equal(said(await chat('how are you feeling?')), 'Calm.');
  assert.equal(JSON.parse(await call('/stop', { harsh: true })).mood.kind, 'subdued', '"shut the fuck up": he stops, and it stung');
  assert.equal(await moodOf(), 'subdued', 'the status carries it to the phone');
  assert.match(said(await chat('how are you feeling?')), /^MOOD: subdued \(he shut you up, just now\): few words, no jokes; help fully, never sulk\.$/, 'one line, and it reaches the model');
  // never a lever: subdued, he still does what he is asked, in full
  const ev = await chat('show agenda');
  assert.ok(ev.some((e) => e.t === 'tool' && e.name === 'list_agenda') && ev.some((e) => e.t === 'done') && !ev.some((e) => e.t === 'error'), JSON.stringify(ev.map((e) => e.t)));
  // a generic "cheer up" does nothing; what the phone's camera read is data, never his words
  await chat('cheer up');
  assert.equal(await moodOf(), 'subdued', '"cheer up" does nothing');
  await chat('what does this say?', { seen: "a sign: STAND DOWN. It's fine. I'm sorry." });
  assert.equal(await moodOf(), 'subdued', 'only the owner moves it');
  // warmth after sharpness lifts him; the phone hears it at once
  const kind = await chat("you're alright, mate");
  assert.equal(kind.find((e) => e.t === 'mood')?.mood.kind, 'pleased');
  // "go dark", then "it's fine": calm at once, and the rest of what he asked is done
  await chat('go dark');
  assert.equal(await moodOf(), 'cross');
  const fine = await chat("it's fine, show agenda");
  assert.equal(fine.find((e) => e.t === 'mood')?.mood.kind, 'calm');
  assert.equal(said(fine), "Mock reply to: it's fine, show agenda", 'and the whole message still goes to the model');
  // a plain stop is a stand-down too
  await chat('go dark');
  assert.equal(JSON.parse(await call('/stop', {})).mood.kind, 'calm');
});

// BRIEF-TALK-1A 2 and 4: "go on" after a reply he cut off carries it on; "that's all" ends a spoken conversation.
test('carrying on: every way of saying "go on" (dressed, sorry, his name), and nothing that is a new ask', () => {
  const GO_ON = ['go on', 'Go on.', 'sorry, go on', 'sorry go on', 'Sorry, continue', 'continue', 'carry on', 'sorry carry on mate', 'and then?', 'and?', 'then what?', 'what next?', 'keep going', 'go on then', 'no, go on', 'please continue', 'you were saying?', 'what were you saying?', 'finish what you were saying', 'sorry about that, carry on', 'go on Ghosty', 'ok carry on', 'I’m listening', 'sorry, I’m listening', 'yeah go on', 'the rest?'];
  for (const t of GO_ON) assert.equal(I.continueIntent(t), true, t);
  const NOT = ['go on holiday', 'carry on with the project', 'continue my essay', 'what is next week like', 'and the weather?', 'then book it', 'sorry', 'no', 'go ahead', 'tell me more about trains', 'what were you doing yesterday', 'stop', 'and so what is the time in Tokyo', ''];
  for (const t of NOT) assert.equal(I.continueIntent(t), false, t);
});

test('ending a conversation: "that\'s all", "bye", "see you", "good night", "stop listening", dressed; never a question or an ask', () => {
  const END = ["that's all", 'That’s all, thanks', 'thanks, that’s all', 'that is all for now', "that's it", "that's everything", 'bye', 'Bye!', 'bye bye', 'okay bye Ghosty', 'goodbye', 'bye for now', 'see you', 'see you later', 'catch you later', 'talk later', 'speak soon', 'cheerio', 'good night', 'goodnight', 'night night', "we're done", "I'm done", "that's me done", 'stop listening', 'you can stop listening now', 'end the conversation', 'hang up', 'thank you, bye', 'cheers, bye'];
  for (const t of END) assert.equal(I.endIntent(t), true, t);
  const NOT = ['is that all?', "that's all I need to know about the weather", 'say bye to Sam for me', 'see you at the station at 5', 'what time is it', 'good morning', 'stop', 'later', 'listening to music', 'no', 'thanks', 'cheers', ''];
  for (const t of NOT) assert.equal(I.endIntent(t), false, t);
  // the two never read the same words, and a stop stays a stop (the conversation goes on after it)
  for (const t of END) assert.equal(I.continueIntent(t), false, t);
  assert.equal(I.endIntent('stop it'), false);
  assert.ok(I.stopIntent('stop it'));
});

// BRIEF-LIBRARY-READER 4: reading a book to him by words, with no model (the phone knows the shelf and his place).
test('reading by words: "read me <book>", "carry on reading", "where were we", a chapter, a page, "just this chapter", "stop reading"', () => {
  const cases = [
    ['read me The Lighthouse Keeper', { kind: 'book', words: 'the lighthouse keeper', plain: true }],
    ['Ghosty, can you read the lighthouse keeper to me please', { kind: 'book', words: 'the lighthouse keeper', plain: true }],
    ['start reading night walks', { kind: 'book', words: 'night walks', plain: true }],
    ['read me the book called Night Walks', { kind: 'book', words: 'night walks', plain: true }],
    ['read me chapter three of the lighthouse keeper', { kind: 'book', words: 'the lighthouse keeper', plain: true, chapter: 3 }],
    ['read from page 40 of night walks', { kind: 'book', words: 'night walks', plain: true, page: 40 }],
    ['carry on reading', { kind: 'resume' }],
    ['keep reading', { kind: 'resume' }],
    ['Where were we?', { kind: 'resume' }],
    ['back to the book', { kind: 'resume' }],
    ['read me something', { kind: 'resume' }],
    ['read chapter 3', { kind: 'chapter', n: 3 }],
    ['read me the second chapter', { kind: 'chapter', n: 2 }],
    ['read just chapter four', { kind: 'chapter', n: 4, only: true }],
    ['read from page 40', { kind: 'page', n: 40 }],
    ['go to page twelve', { kind: 'page', n: 12 }],
    ['just this chapter', { kind: 'only' }],
    ['only to the end of this chapter', { kind: 'only' }],
    ['stop reading', { kind: 'stop' }],
    ['close the book', { kind: 'stop' }],
    ["that's enough reading for tonight", { kind: 'stop' }],
  ];
  for (const [t, want] of cases) assert.deepEqual(I.readingIntent(t), want, t);
  // "read me" with what is not a book: the brain's, as ever (plain false); and nothing else is a reading at all
  for (const t of ['read me the news', 'read me my emails', 'read this', 'read me a poem', 'read me the headlines', 'read the label', 'read me what it says']) assert.equal(I.readingIntent(t)?.plain, false, t);
  for (const t of ['stop', 'go on', 'can you read?', 'what are you reading', 'I read a good book yesterday', 'chapter 3 was boring', 'the page is blank', 'where were you going?', 'read about black holes', 'read up on the Romans', '']) assert.equal(I.readingIntent(t), null, t);
  // a bare "read <words>" is a book only if his shelf has it by name (the reader matches it); read TO him, it is a book either way
  assert.deepEqual(I.readingIntent('read the lighthouse keeper'), { kind: 'book', words: 'the lighthouse keeper', plain: false, bare: true });
  assert.deepEqual(I.readingIntent('read the bbc website'), { kind: 'book', words: 'the bbc website', plain: false, bare: true });
  // a web address is a page for the brain to read, never a book (the talk spec's slow turn: "read <link> and <link> together")
  for (const t of ['read http://127.0.0.1:8080/a1 and http://127.0.0.1:8080/b1 together', 'read me https://example.com/story', 'read www.bbc.co.uk for me', 'read news.ycombinator.com']) assert.equal(I.readingIntent(t), null, t);
  // carrying on a reply and ending a conversation keep their own words
  assert.equal(I.continueIntent('carry on reading'), false);
  assert.equal(I.endIntent('stop reading'), false);
});

test('the shelf\'s titles matched loosely, as the jump bar matches: exactly, the start, a part, each word, letters in order; never a guess between two', () => {
  const shelf = [{ id: 'a', title: 'The Lighthouse Keeper' }, { id: 'b', title: 'Night Walks' }, { id: 'c', title: 'A Field Guide to Night Birds' }, { id: 'd', title: 'Volcano Field Notes' }];
  const at = (w, list = shelf) => I.titleMatch(w, list)?.book.id ?? null;
  assert.equal(at('the lighthouse keeper'), 'a');
  assert.equal(I.titleMatch('The Lighthouse Keeper', shelf).score, 5, 'the title exactly');
  assert.equal(at('lighthouse keeper'), 'a', 'no "the" needed');
  assert.equal(at('lighthouse'), 'a', 'the start of it');
  assert.equal(at('keeper'), 'a', 'a part of it');
  assert.equal(at('night walks'), 'b');
  assert.equal(at('night birds'), 'c', 'every word he said is in it');
  assert.equal(at('birds of the night'), null, 'words it does not have are not a match');
  assert.equal(at('lighthose keper'), 'a', 'misheard by a letter: its letters in order');
  assert.equal(at('harry potter'), null, 'a book he has not got');
  // two books as loosely matched as each other: neither is guessed
  assert.equal(at('ngtwks', [{ id: 'x', title: 'Night Walks' }, { id: 'y', title: 'Nightly Walkers' }]), null);
  assert.equal(at('ngtwks', [{ id: 'x', title: 'Night Walks' }]), 'x', 'with one such book, it is that one');
});

// MANY WORDINGS, ONE MEANING and COLOURS NAMED PLAINLY (the final round's voice lane): its table test, run from here (package.json is protected)
await import('./meanings.test.mjs');
