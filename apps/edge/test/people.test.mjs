// THE PEOPLE PACK (BRIEF-PACKS-2): birthdays and dates he gives (a reminder a week before and on the day, 9am, his zone;
// next year's set by the Brief's look), a gift idea from his own notes with a rough price, who's who (and NOTHING looked up
// for a name he never gave: no request is made), a call to make, a message / thank-you / card's words in the shape of his
// own messages (shown, never sent), a group's plans, a contact's details, his people's cars, what is coming, forgetting one
// detail or the whole person. The tool sends its cards as screen commands; the phone's buttons run an action with no model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundles, ctxOf, deps, fakeFetch, Mem, NOW } from './packs-kit.mjs';

const B = await bundles(['src/tools/people.ts', 'src/packs/index.ts', 'src/schedule.ts', 'src/tools/memory.ts', '../../packages/shared/src/people.ts', '../../packages/shared/src/cards.ts', '../../packages/shared/src/packs.ts']);
const T = B['src/tools/people.ts'];
const P = B['src/packs/index.ts'];
const J = B['src/schedule.ts'];
const M = B['src/tools/memory.ts'];
const S = B['../../packages/shared/src/people.ts'];
const C = B['../../packages/shared/src/cards.ts'];

const run = (storage, action, a, now = NOW, seen = []) => T.PEOPLE[action](a, deps(storage, fakeFetch({}, seen), now));
const jobs = async (storage) => (await J.loadJobs(storage)).filter((j) => j.kind === 'reminder').map((j) => [j.title, new Date(j.next).toISOString()]);
const hisMessages = [
  'hey mate, hope your week is going well, cheers',
  'hey, can you do thursday? no worries if not, cheers',
  'hey, running late, be there in 10 😂 cheers',
];

test('a birthday in his words: whose, which day, the year when he gave one, or the age he turns', () => {
  assert.deepEqual(S.parseBirthday('Dad’s birthday is 14 March', '', '2026-11-01'), { name: 'Dad', rel: 'dad', on: '03-14' });
  assert.deepEqual(S.parseBirthday('my cousin Sam was born 3/5/1990', '', '2026-11-01'), { name: 'Sam', rel: 'cousin', on: '05-03', year: 1990 });
  assert.deepEqual(S.parseBirthday('Ali turns 40 on 9 June', '', '2026-11-01'), { name: 'Ali', on: '06-09', year: 1987 }, 'turning 40 next 9 June (2027) means born in 1987');
  assert.deepEqual(S.parseBirthday('birthday March 14th', 'Nan', '2026-11-01'), { name: 'Nan', rel: 'nan', on: '03-14' }, 'a name passed by the model wins');
  assert.equal(S.parseBirthday('Sam’s birthday is 31 Feb', '', '2026-11-01'), null, 'no such day');
  assert.equal(S.parseBirthday('Sam’s birthday is sometime', '', '2026-11-01'), null);
  assert.equal(S.nextOn('02-29', '2026-11-01'), '2027-02-28', '29 February is the 28th in a year without one');
  assert.equal(S.nextOn('11-01', '2026-11-01'), '2026-11-01', 'today counts');
  assert.equal(S.nextOn('10-31', '2026-11-01'), '2027-10-31');
  assert.equal(S.turning('1957-03-14', '2027-03-14'), 70);
});

test('birthday: kept with a reminder a week before and on the day at 9am; a near one only on the day; listed in order; a line in his Memory', async () => {
  const storage = new Mem();
  const out = await run(storage, 'birthday', { words: 'Dad’s birthday is 14 March 1957' });
  assert.match(out.text, /^Kept: Dad’s birthday is 14 March 1957 — next Sun 14 Mar \(in 133 days\)\. I’ll remind you a week before and on the day, at 9am/);
  assert.deepEqual(await jobs(storage), [['Birthday: Dad', '2027-03-07T09:00:00.000Z'], ['Birthday: Dad', '2027-03-14T09:00:00.000Z']]);
  assert.equal(out.cards[0].id.startsWith('people:bday:'), true);
  assert.match(out.cards[0].line, /turning 70/);
  assert.deepEqual(out.cards[0].acts.map((x) => x.label), ['GIFT IDEAS', 'UNDO']);
  // a birthday on Friday: the week before has gone
  const near = await run(storage, 'birthday', { words: 'Ali’s birthday is 6 November' });
  assert.match(near.text, /next Fri 6 Nov \(in 5 days\)\. I’ll remind you on the day at 9am \(it’s in your Agenda\); the week before has gone/);
  assert.equal((await jobs(storage)).filter(([t]) => t === 'Birthday: Ali').length, 1);
  assert.match((await run(storage, 'birthday', {})).text, /^Birthdays coming: Ali: Fri 6 Nov, in 5 days; Dad: Sun 14 Mar, in 133 days \(turning 70\)\.$/);
  // his Memory has one line per person, and it follows the notes
  assert.ok((await M.loadMemory(storage)).some((f) => f.text === 'Dad (his dad): birthday 14 March'));
  await run(storage, 'note', { words: 'Dad loves fishing' });
  const mem = await M.loadMemory(storage);
  assert.equal(mem.filter((f) => /^Dad /.test(f.text)).length, 1, 'one line a person');
  assert.equal(mem.find((f) => /^Dad /.test(f.text)).text, 'Dad (his dad): birthday 14 March; loves fishing');
  assert.match((await run(storage, 'birthday', { words: 'something' })).text, /^Whose, and which day\?/);
});

test('the Brief’s look: a birthday this week as a line, and the next year’s reminders set once the old ones have gone', async () => {
  const storage = new Mem();
  await run(storage, 'birthday', { words: 'Ali’s birthday is 6 November' });
  assert.deepEqual(await P.packLines({ storage, now: () => NOW }), ['Ali’s birthday in 5 days (Fri 6 Nov)']);
  assert.deepEqual(await P.packLines({ storage, now: () => Date.UTC(2026, 10, 5, 12, 0) }), ['Ali’s birthday is tomorrow']);
  // the reminders have fired and gone; a year on, the Brief's look sets the next ones (2027's)
  for (const j of await J.loadJobs(storage)) await J.removeJob(storage, j.id);
  const later = Date.UTC(2026, 10, 8, 12, 0);
  await P.packLines({ storage, now: () => later });
  assert.deepEqual(await jobs(storage), [['Birthday: Ali', '2027-10-30T08:00:00.000Z'], ['Birthday: Ali', '2027-11-06T09:00:00.000Z']]);
  // (30 October 2027 is still summer time in London: 9am there is 08:00 UTC; the clocks go back on the 31st)
  // and not twice
  await P.packLines({ storage, now: () => later });
  assert.equal((await jobs(storage)).length, 2);
});

test('date: an anniversary every year, a one-off once; reminders for both; listed', async () => {
  const storage = new Mem();
  const a = await run(storage, 'date', { words: 'our anniversary is 12 June' });
  assert.match(a.text, /^Kept: Our anniversary on Sat 12 Jun 2027, every year\. I’ll remind you a week before and on the day, at 9am\./);
  const b = await run(storage, 'date', { words: 'Mum’s retirement do is 5 December 2026' });
  assert.match(b.text, /^Kept: Mum’s retirement do on Sat 5 Dec, once\.|^Kept: Mum’s retirement do on Sat 5 Dec\./);
  assert.deepEqual((await jobs(storage)).map(([t]) => t).sort(), ['Date: Mum’s retirement do', 'Date: Mum’s retirement do', 'Date: Our anniversary', 'Date: Our anniversary']);
  assert.match((await run(storage, 'date', {})).text, /^Your dates: Mum’s retirement do Sat 5 Dec; Our anniversary Sat 12 Jun 2027\.$/);
  assert.match((await run(storage, 'date', { words: 'the party is soon' })).text, /^Which day\?/);
});

test('gift: ideas from HIS notes with rough prices, a budget respected, a caution echoed; with no notes it says so and asks; nothing is looked up', async () => {
  const storage = new Mem();
  const seen = [];
  await run(storage, 'note', { words: 'Dad loves fishing', who: 'Dad' }, NOW, seen);
  await run(storage, 'note', { words: 'Dad drinks lots of coffee', who: 'Dad' }, NOW, seen);
  await run(storage, 'note', { words: 'Dad is allergic to nuts', who: 'Dad' }, NOW, seen);
  const g = await run(storage, 'gift', { words: 'gift ideas for Dad under £30', who: 'Dad' }, NOW, seen);
  assert.match(g.text, /^From what you told me about Dad \(coffee, fishing\), gift ideas for under £30:\n- /);
  assert.ok(g.data.gifts.length >= 3 && g.data.gifts.every((x) => x.lo <= 30), 'every idea can be had for £30 or less');
  assert.ok(g.data.gifts.slice(0, 3).every((x) => /they like (coffee|fishing)/.test(x.because)), 'his likes first');
  assert.match(g.text, /Careful: you noted “Dad is allergic to nuts”\./);
  assert.match(g.text, /rough guides for a typical UK shop, not looked up: check the shops\. I haven’t searched for anything about Dad\.$/);
  const none = await run(storage, 'gift', { words: 'what should I get Zed', who: 'Zed' }, NOW, seen);
  assert.match(none.text, /^You haven’t told me what Zed likes yet, so these are safe choices \(tell me, like "Zed loves fishing", and I’ll do better\), gift ideas:/);
  const another = await run(storage, 'gift', { who: 'Dad', variant: 3 }, NOW, seen);
  assert.notEqual(another.text, (await run(storage, 'gift', { who: 'Dad' }, NOW, seen)).text, 'another gives a different set or order');
  assert.deepEqual(S.budgetOf('between £20 and £40'), { lo: 20, hi: 40 });
  assert.deepEqual(S.budgetOf('around £50'), { lo: 35, hi: 65 });
  assert.deepEqual(S.budgetOf('at least £100'), { lo: 100 });
  assert.equal(S.budgetOf('a nice gift'), null);
  assert.deepEqual(S.interestsOf(['loves wine', 'is teetotal']).likes, [], 'a teetotal note drops the drinks');
  assert.equal(seen.length, 0, 'not one request was made');
});

test('who: only the people he introduced; a name he never gave gets "I don’t have anyone called …" and NO request is made', async () => {
  const storage = new Mem();
  const seen = [];
  assert.match((await run(storage, 'who', {}, NOW, seen)).text, /^You haven’t told me about anyone yet\./);
  await run(storage, 'note', { words: 'my cousin Sam loves fishing' }, NOW, seen);
  await run(storage, 'note', { words: 'Ali is my friend' }, NOW, seen);
  await run(storage, 'birthday', { words: 'Sam’s birthday is 3 May' }, NOW, seen);
  const one = await run(storage, 'who', { words: 'who is Sam?' }, NOW, seen);
  assert.match(one.text, /^Sam is your cousin\. Birthday: Mon 3 May, in 183 days\. What you’ve said: loves fishing \(Sun 1 Nov\)\./);
  assert.equal(one.cards[0].kind, 'person');
  assert.equal(one.cards[0].id.startsWith('people:who:'), true, 'its own card id: never the guardian’s person card');
  const all = await run(storage, 'who', { words: 'who’s who' }, NOW, seen);
  assert.match(all.text, /^The people you’ve told me about \(2\):\n- Ali \(friend\)\n- Sam \(cousin\), birthday 3 May; last: loves fishing$/);
  assert.equal(all.data.people.length, 2);
  const nobody = await run(storage, 'who', { who: 'Zed' }, NOW, seen);
  assert.match(nobody.text, /^I don’t have anyone called Zed\. I only know the people you tell me about/);
  assert.match(nobody.text, /I never look anyone up\.$/);
  assert.equal(seen.length, 0, 'no request was made for anyone, ever');
});

test('note: his words about someone, with the name taken off; a relation; the same note twice is once; the name is needed', async () => {
  const storage = new Mem();
  const a = await run(storage, 'note', { words: 'Sam loves fishing' });
  assert.match(a.text, /^Kept about Sam: “loves fishing”\./);
  await run(storage, 'note', { words: 'Sam loves fishing' });
  await run(storage, 'note', { words: 'my mate Haris’s mum is in hospital' });
  await run(storage, 'note', { words: 'Sam is my cousin' });
  const book = await storage.get('people:book');
  assert.deepEqual(book.people.map((p) => [p.name, p.rel ?? '', p.notes.map((n) => n.text)]), [['Sam', 'cousin', ['loves fishing']], ['Haris', 'mate', ['mum is in hospital']]]);
  assert.match((await run(storage, 'note', { words: 'likes cheese' })).text, /^Who is it about\?/);
  assert.match((await run(storage, 'note', { words: 'Sam', who: 'Sam' })).text, /^What about Sam\?/);
  assert.match((await run(storage, 'note', { words: 'is great', who: 'dad' })).text, /^Kept about Dad: “is great”/);
});

test('when: a weekday is the next one, a time from words, a day with no time is 6pm, a day with a time that has gone moves to tomorrow', () => {
  const at = (w, now = '09:00') => S.whenWords(w, '2026-11-01', now);
  assert.deepEqual(at('Sunday'), { date: '2026-11-08', time: '18:00', assumed: ['18:00, as you gave no time'] }, 'today is a Sunday: the next Sunday');
  assert.deepEqual(at('on friday evening'), { date: '2026-11-06', time: '18:00', assumed: [] });
  assert.deepEqual(at('tomorrow at 6'), { date: '2026-11-02', time: '18:00', assumed: ['6 as 6pm'] });
  assert.deepEqual(at('tomorrow at 8am'), { date: '2026-11-02', time: '08:00', assumed: [] });
  assert.deepEqual(at('tomorrow at 6:30pm'), { date: '2026-11-02', time: '18:30', assumed: [] });
  assert.deepEqual(at('friday at 10'), { date: '2026-11-06', time: '10:00', assumed: [] }, '10 and 11 are the morning unless he says pm');
  assert.deepEqual(at('tonight'), { date: '2026-11-01', time: '19:00', assumed: [] });
  assert.deepEqual(at('in 3 days'), { date: '2026-11-04', time: '18:00', assumed: ['18:00, as you gave no time'] });
  assert.deepEqual(at('the 14th'), { date: '2026-11-14', time: '18:00', assumed: ['18:00, as you gave no time'] });
  assert.deepEqual(at('at 3pm'), { date: '2026-11-01', time: '15:00', assumed: ['today, as you gave a time and no day'] });
  assert.deepEqual(at('today at 9am', '12:00'), { date: '2026-11-02', time: '09:00', assumed: ['tomorrow, as that time has gone today'] });
  assert.equal(at('whenever'), null);
  assert.deepEqual(S.callAsk('remind me to call Dad on Sunday'), { verb: 'call', who: 'Dad', rel: 'dad', rest: 'on Sunday' });
  assert.deepEqual(S.callAsk('text Ali tomorrow at 6'), { verb: 'text', who: 'Ali', rest: 'tomorrow at 6' });
  assert.equal(S.callAsk('what is the weather'), null);
});

test('call: a reminder with the person on it, in his zone, saying what it assumed; with no day it asks', async () => {
  const storage = new Mem();
  const out = await run(storage, 'call', { words: 'remind me to call Dad on Sunday' });
  assert.match(out.text, /^Reminder set: Call Dad on Sun 8 Nov at 18:00 \(I took 18:00, as you gave no time\)\. It’s in your Agenda\.$/);
  assert.deepEqual(await jobs(storage), [['Call Dad', '2026-11-08T18:00:00.000Z']]);
  assert.equal(out.cards[0].title, 'Call Dad');
  await run(storage, 'call', { words: 'text Ali tomorrow at 6' });
  assert.deepEqual((await jobs(storage)).map((x) => x[1]), ['2026-11-02T18:00:00.000Z', '2026-11-08T18:00:00.000Z'], 'the Agenda keeps them in time order');
  assert.match((await run(storage, 'call', { words: 'call Dad' })).text, /^When should I remind you to call Dad\?/);
  assert.match((await run(storage, 'call', { words: 'on Sunday' })).text, /^Whom, and when\?/);
});

test('message, thank-you and card: shown first, never sent; the draft takes the shape of the messages he shared; another wording on ask', async () => {
  const storage = new Mem();
  const seen = [];
  await run(storage, 'birthday', { words: 'Sam was born 3 May 1990' }, NOW, seen);
  const plain = await run(storage, 'message', { words: 'a birthday message for Sam', who: 'Sam' }, NOW, seen);
  assert.match(plain.text, /^For Sam \(birthday\), in your voice:\n“Happy birthday, Sam! Hope today is a really good one, and a very happy 37\. Thinking of you\.”\nYour tone: plain and friendly \(you haven’t shared/);
  assert.match(plain.text, /Shown for you to check; nothing is sent\./);
  // a thank-you: its shape follows what for
  assert.match((await run(storage, 'thanks', { words: 'a thank-you note to Auntie Jo for the jumper' }, NOW, seen)).text, /^A thank-you note to Jo:\n\nDear Jo,\n\nThank you so much for the jumper\. It was such a kind thought/);
  assert.match((await run(storage, 'thanks', { who: 'Mr Khan', forWhat: 'the interview for the store role' }, NOW, seen)).text, /Thank you for taking the time to meet me about/);
  assert.match((await run(storage, 'thanks', { who: 'Ali', forWhat: 'having us for dinner' }, NOW, seen)).text, /I had a lovely time/);
  // (and once he has shared his messages, a note takes their shape too)
  // his own messages shape it: lower case, no full stops, "hey", "cheers", an emoji
  const kept = await run(storage, 'voice', { samples: hisMessages }, NOW, seen);
  assert.match(kept.text, /^Kept 3 of your messages as the shape of how you write \(3 in all, only in your brain\)\./);
  const tone = S.toneOf(hisMessages);
  assert.deepEqual({ ...tone }, { n: 3, words: 9, exclaim: 0, emoji: true, lower: true, fullStops: false, greet: 'hey', signoff: 'cheers', kisses: false, contractions: false, formal: false });
  const mine = await run(storage, 'message', { words: 'a birthday message for Sam', who: 'Sam' }, NOW, seen);
  assert.match(mine.text, /“happy birthday, Sam\. Hope today is a really good one, and a very happy 37\. Thinking of you, cheers 🎂”/);
  assert.match((await run(storage, 'thanks', { who: 'Jo', forWhat: 'the jumper' }, NOW, seen)).text, /^A thank-you note to Jo:\n\nhey Jo,\n\nthank you so much for the jumper\./);
  assert.match(mine.text, /Your tone: .*lower case.*no exclamation marks.*opens “hey”.*signs off “cheers”.* \(from 3 of your messages\)/);
  const second = await run(storage, 'message', { words: 'a birthday message for Sam', who: 'Sam', variant: 1 }, NOW, seen);
  assert.notEqual(second.data.draft, mine.data.draft);
  assert.equal(second.data.variant, 1);
  // a card's words, four styles, ours
  assert.match((await run(storage, 'card', { words: 'card words for Dad’s 70th, funny', who: 'Dad' }, NOW, seen)).text, /70 candles is a fire hazard/);
  assert.match((await run(storage, 'card', { who: 'Dad', occasion: 'birthday', style: 'short' }, NOW, seen)).text, /Happy birthday, Dad! Have a great day\./);
  assert.match((await run(storage, 'card', { who: 'Mum', occasion: 'get well', style: 'formal', from: 'Sam' }, NOW, seen)).text, /Dear Mum,\n\n.*\n\nWith best wishes,\nSam/);
  assert.match((await run(storage, 'message', { words: 'say sorry to Dee', who: 'Dee' }, NOW, seen)).text, /^For Dee \(sorry\)/);
  assert.match((await run(storage, 'message', { words: 'hello', who: 'Dee' }, NOW, seen)).text, /^Who is it for, and what for\?/);
  assert.equal(seen.length, 0, 'nothing is fetched');
  assert.equal((await jobs(storage)).length, 2, 'only Sam’s two birthday reminders: a draft sets nothing and sends nothing');
  // forgetting the samples
  assert.match((await run(storage, 'voice', { words: 'forget my writing samples' }, NOW, seen)).text, /^Forgot the samples/);
  assert.match((await run(storage, 'voice', {}, NOW, seen)).text, /^How you write: plain and friendly/);
});

test('plan: a group’s plan kept, who is in, out or maybe from his words, who is still to hear from; moved; closed', async () => {
  const storage = new Mem();
  const a = await run(storage, 'plan', { words: 'plan: pub on Friday at 8pm at the Crown. Ali yes, Sam can’t make it, Jo maybe, asked Dee and Kai.' });
  assert.match(a.text, /^Plan kept: Pub, Fri 6 Nov 20:00, at the Crown\. Yes: Ali \(1\)\. No: Sam\. Maybe: Jo\. Not heard from: Dee, Kai\.$/);
  assert.equal(a.cards[0].line, 'Fri 6 Nov · 1 yes · 1 maybe · 1 no · 2 to hear from');
  const b = await run(storage, 'plan', { words: 'Jo’s in, Dee is out' });
  assert.match(b.text, /^Updated: Pub, Fri 6 Nov 20:00, at the Crown\. Yes: Ali, Jo \(2\)\. No: Sam, Dee\. Not heard from: Kai\.$/);
  assert.match((await run(storage, 'plan', { words: 'move it to Saturday at 7' })).text, /^Updated: Pub, Sat 7 Nov 19:00/);
  assert.match((await run(storage, 'plan', { words: 'blah blah' })).text, /^I didn’t catch who said what\./);
  assert.match((await run(storage, 'plan', {})).text, /^Pub, Sat 7 Nov 19:00, at the Crown\./);
  assert.match((await run(storage, 'plan', { words: 'cancel the plan' })).text, /^Plan closed: Pub\./);
  assert.match((await run(storage, 'plan', {})).text, /^No plan yet\./);
  assert.deepEqual(S.repliesIn('Ali yes, Sam no, Jo maybe, Dee'), [{ name: 'Ali', say: 'yes' }, { name: 'Sam', say: 'no' }, { name: 'Jo', say: 'maybe' }]);
});

test('contact: a number, an email and an address kept and recalled; forgotten one by one; a stranger is not known', async () => {
  const storage = new Mem();
  assert.match((await run(storage, 'contact', { words: 'Sam’s number is 07700900123' })).text, /^Kept for Sam: number 07700 900123\./);
  await run(storage, 'contact', { words: 'Sam’s email is Sam.Smith@Example.com' });
  await run(storage, 'contact', { words: 'Sam’s address is 12 High Street, Leeds LS1 4AB' });
  assert.equal((await run(storage, 'contact', { words: 'what’s Sam’s number?' })).text, 'Sam’s number is 07700 900123.');
  assert.equal((await run(storage, 'contact', { words: 'what’s Sam’s address?', who: 'Sam' })).text, 'Sam’s address is 12 High Street, Leeds LS1 4AB.');
  assert.equal((await run(storage, 'contact', { who: 'Sam', field: 'email' })).text, 'Sam’s email is sam.smith@example.com.');
  assert.match((await run(storage, 'contact', { words: 'what’s Zed’s number?', who: 'Zed' })).text, /^I don’t have anyone called Zed\./);
  assert.match((await run(storage, 'forget', { words: 'forget Sam’s number', who: 'Sam' })).text, /^Forgot Sam’s number\./);
  assert.match((await run(storage, 'contact', { words: 'what’s Sam’s number?' })).text, /^I haven’t got Sam’s number\. Tell me it/);
  assert.equal(S.tidyPhone('+447700900123'), '+44 7700 900123');
  assert.equal(S.tidyPhone('01132 960123'), '01132 960123');
  assert.equal(S.contactAsked('what is his phone number'), 'phone');
  assert.equal(S.contactAsked('Sam’s number is 0770'), null, 'giving a number is not asking for one');
});

test('cars: his people’s cars from the guardian’s list, read-only, with the months their MOT and tax are due', async () => {
  const storage = new Mem();
  assert.match((await run(storage, 'cars', {})).text, /^No one’s car is named yet\./);
  await storage.put('memory', [
    { id: 'c1', at: 1, text: C.carFactText({ whose: 'Dad', plate: 'RX15 KNG', nickname: 'the red Fiesta', mot: '2027-03' }) },
    { id: 'c2', at: 1, text: C.carFactText({ whose: 'me', plate: 'AB12 CDE' }) },
  ]);
  const out = await run(storage, 'cars', {});
  assert.match(out.text, /^Your people’s cars \(from the guardian’s list\):\n- Dad's red Fiesta: RX15 KNG, MOT due 2027-03$/);
  assert.ok(!/AB12/.test(out.text), 'his own car is not "his people’s"');
});

test('coming: birthdays, dates, plans and calls in the next days, in order', async () => {
  const storage = new Mem();
  await run(storage, 'birthday', { words: 'Ali’s birthday is 6 November' });
  await run(storage, 'birthday', { words: 'Dad’s birthday is 14 March' });
  await run(storage, 'date', { words: 'our anniversary is 20 November' });
  await run(storage, 'call', { words: 'call Mum tomorrow at 7pm' });
  await run(storage, 'plan', { words: 'plan: pub on Friday at 8pm at the Crown' });
  const out = await run(storage, 'coming', {});
  assert.equal(out.text, 'Coming up (next 30 days):\n- Mon 2 Nov: Call Mum\n- Fri 6 Nov: Ali’s birthday\n- Fri 6 Nov: Pub at 20:00\n- Fri 20 Nov: Our anniversary');
  assert.match((await run(storage, 'coming', { days: 200 })).text, /Dad’s birthday/);
  assert.match((await run(new Mem(), 'coming', {})).text, /^Nothing coming in the next 30 days\./);
});

test('forget: the whole person (notes, reminders, details, his Memory line), or only the birthday, or a date; never someone he did not name', async () => {
  const storage = new Mem();
  await run(storage, 'birthday', { words: 'Dee’s birthday is 9 December' });
  await run(storage, 'note', { words: 'Dee loves tea' });
  await run(storage, 'contact', { words: 'Dee’s number is 07700 900555' });
  await run(storage, 'date', { words: 'our anniversary is 20 November' });
  assert.match((await run(storage, 'forget', { words: 'forget Dee’s birthday', who: 'Dee' })).text, /^Forgot Dee’s birthday, and its reminders\./);
  assert.ok(!(await jobs(storage)).some(([t]) => t === 'Birthday: Dee'));
  assert.ok((await M.loadMemory(storage)).some((f) => f.text === 'Dee: loves tea'));
  assert.match((await run(storage, 'forget', { words: 'forget the anniversary' })).text, /^Dropped the date: Our anniversary, and its reminders\.$/);
  assert.ok(!(await jobs(storage)).some(([t]) => /^Date:/.test(t)));
  assert.match((await run(storage, 'forget', { words: 'forget Dee', who: 'Dee' })).text, /^Forgot Dee completely: their notes, birthday reminders, details and the line in your Memory\.$/);
  assert.equal((await storage.get('people:book')).people.length, 0);
  assert.equal((await M.loadMemory(storage)).length, 0);
  assert.match((await run(storage, 'forget', { words: 'forget Zed', who: 'Zed' })).text, /^I don’t have anyone called Zed\.$/);
  assert.match((await run(storage, 'forget', { words: 'forget' })).text, /^Whom\?/);
});

test('the tool: one action enum; its cards go to the screen as pack_card; reads work from a scheduled task, writes wait for him', async () => {
  const tool = T.peopleTools[0];
  assert.equal(tool.name, 'people');
  assert.deepEqual(tool.parameters.properties.action.enum, ['birthday', 'date', 'gift', 'note', 'who', 'call', 'thanks', 'message', 'card', 'plan', 'contact', 'cars', 'coming', 'forget', 'voice']);
  assert.ok(tool.description.length <= 1000, `${tool.description.length}`);
  assert.ok(T.PEOPLE_ABOUT.length <= 220 && /^You can/.test(T.PEOPLE_ABOUT), `${T.PEOPLE_ABOUT.length}`);
  for (const a of tool.parameters.properties.action.enum) assert.match(T.PEOPLE_ABOUT, new RegExp(`\\b${a}\\b`));
  assert.equal(tool.pure({ action: 'who' }), true);
  assert.equal(tool.pure({ action: 'message' }), true);
  assert.equal(tool.pure({ action: 'birthday' }), false);
  const storage = new Mem();
  const { ctx, events } = ctxOf(storage);
  const result = await tool.run({ action: 'birthday', words: 'Sam’s birthday is 3 May' }, ctx);
  assert.match(result, /^Kept: Sam’s birthday is 3 May/);
  const shown = events.filter((e) => e.t === 'client').map((e) => ({ name: e.name, args: e.args }));
  assert.equal(shown[0].name, 'pack_card');
  const cards = C.cardsFromTool({ name: 'people', args: {}, result, shown });
  assert.equal(cards.length, 1);
  assert.equal(cards[0].title, 'Sam’s birthday');
  await assert.rejects(tool.run({ action: 'stalk' }, ctx), /people has no action "stalk"/);
  const away = { ...ctx, unattended: true };
  assert.match(await tool.run({ action: 'who', who: 'Sam' }, away), /Sam/);
  await assert.rejects(tool.run({ action: 'note', words: 'Sam likes tea' }, away), /people note changes what he keeps, so it waits for him/);
  await assert.rejects(tool.run({ action: 'call', words: 'call Sam tomorrow' }, away), /waits for him/);
  assert.match('hello', /./);
  for (const t of ['hello', 'thanks', 'how are you', 'what time is it', 'call me a taxi', 'the number of the bus']) assert.ok(!T.PEOPLE_WHEN.test(t), `"${t}" leaves the people pack off`);
  for (const t of ['dad’s birthday is 14 march', 'gift ideas for mum', 'remind me to call dad', 'a thank-you note to jo', 'who’s who', 'call my dad on sunday', 'sam’s number is 0770', 'sound like me']) assert.ok(T.PEOPLE_WHEN.test(t), `"${t}" turns it on`);
});

test('the phone’s buttons: POST /packs/do runs one people action with no model (a card’s UNDO, a yes on the plan); anything else is refused', async () => {
  const storage = new Mem();
  const call = (body) => P.packsRoute(new Request('https://g/api/packs/do', { method: 'POST', body: JSON.stringify(body) }), '/packs/do', 'POST', { storage, notify: async () => undefined, now: () => NOW, fetch: fakeFetch({}) }).then(async (r) => ({ status: r.status, ...(await r.json()) }));
  let r = await call({ pack: 'people', action: 'birthday', args: { words: 'Sam’s birthday is 3 May' } });
  assert.equal(r.status, 200);
  r = await call({ pack: 'people', action: 'forget', args: { words: 'Sam’s birthday', who: 'Sam', what: 'birthday' } });
  assert.match(r.text, /^Forgot Sam’s birthday, and its reminders\./);
  await call({ pack: 'people', action: 'plan', args: { words: 'plan: pub on Friday, asked Ali and Sam' } });
  r = await call({ pack: 'people', action: 'plan', args: { words: 'Ali is in' } });
  assert.deepEqual(r.data.plan.yes, ['Ali']);
  assert.equal((await call({ pack: 'people', action: 'spy' })).status, 400);
});
