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

test('stopIntent: 20+ things that are not a stop — a stop word about something else, a question, a real word never "corrected"', () => {
  assert.ok(NOT_STOPS.length >= 20, `${NOT_STOPS.length} phrases`);
  for (const t of NOT_STOPS) assert.equal(I.stopIntent(t), null, `"${t}" is not a stop`);
  assert.equal(I.stopIntent('stop '.repeat(30)), null, 'a long message is a conversation');
});
