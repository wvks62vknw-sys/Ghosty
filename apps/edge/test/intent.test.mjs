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
const NOT_RAISING = ['learn TS2532 came from indexing an array without a fallback. Rule: always use arr[i]! or ?? for indexed values.', 'stop the timer', 'always remind me at 8', "don't forget the milk", 'never mind', 'good morning', 'thanks', 'ok', "don't tell mum", 'that is a good idea', 'what time is it', 'shut up', 'is it good?', 'the good place near me', 'right', 'no', ''];

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
