// THE WORK PACK (BRIEF-PACKS-2): a CV from the facts he tells and pastes (every line his, the gaps said), a cover letter for a
// pasted job ad (matched to his facts one by one, the rest listed, nothing invented), the ad checked for scams, interview
// questions and a plain critique of an answer, a meeting summed up from pasted notes, a to-do from a long message, an email
// in his voice (shown, never sent), a timesheet, PAY after tax (UK bands, checked by hand), a pomodoro on his timers, what
// he said he'd do, a word count and reading level, and a shift rota the Brief shows. No network: nothing is fetched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundles, ctxOf, deps, fakeFetch, fixture, Mem, NOW } from './packs-kit.mjs';

const B = await bundles(['src/tools/work.ts', 'src/packs/index.ts', 'src/schedule.ts', '../../packages/shared/src/work.ts', '../../packages/shared/src/cards.ts', '../../packages/shared/src/packs.ts', '../../packages/shared/src/people.ts']);
const T = B['src/tools/work.ts'];
const P = B['src/packs/index.ts'];
const J = B['src/schedule.ts'];
const W = B['../../packages/shared/src/work.ts'];
const C = B['../../packages/shared/src/cards.ts'];

const run = (storage, action, a, now = NOW, seen = []) => T.WORK[action](a, deps(storage, fakeFetch({}, seen), now));
const AD = fixture('job-ad.txt');
const SCAM = fixture('job-ad-scam.txt');
const MEETING = fixture('meeting-notes.txt');
const CV_TEXT = 'My name is Sam Khan. I live in Leeds. My email is sam@example.com and my phone is 07700 900123. I worked at Tesco as a shelf stacker from 2019 to 2022. I served customers on the tills at weekends. I studied catering at Leeds City College. I have a full driving licence. I am a reliable and friendly person who works well in a team.';
const withCv = async () => {
  const storage = new Mem();
  await run(storage, 'cv', { text: CV_TEXT });
  return storage;
};

test('cv: what he says or pastes, section by section, every line his; the gaps said; shown as a document; a line removed; cleared', async () => {
  const storage = new Mem();
  assert.match((await run(storage, 'cv', {})).text, /^Your CV is empty\./);
  const added = await run(storage, 'cv', { text: CV_TEXT });
  assert.match(added.text, /^Added to your CV: email, phone, name, place, 2 in experience, 1 in education, 1 in skills, 1 in profile\. Say "show my CV"/);
  assert.ok(!/Still missing/.test(added.text), 'nothing a CV needs is missing');
  const shown = await run(storage, 'cv', { words: 'show my CV' });
  assert.equal(shown.open.name, 'open_work');
  assert.equal(shown.open.args.what, 'doc');
  assert.equal(shown.open.args.kind, 'cv');
  assert.equal(shown.open.args.text, [
    'SAM KHAN',
    'Leeds · 07700 900123 · sam@example.com',
    '',
    'PROFILE',
    'A reliable and friendly person who works well in a team.',
    '',
    'EXPERIENCE',
    '- Worked at Tesco as a shelf stacker from 2019 to 2022',
    '- Served customers on the tills at weekends',
    '',
    'EDUCATION',
    '- Studied catering at Leeds City College',
    '',
    'SKILLS AND LICENCES',
    '- A full driving licence',
  ].join('\n'));
  assert.match(shown.text, /Every line is one you gave me\.$/);
  // a sentence added later goes in its section; a repeat is not added twice
  await run(storage, 'cv', { words: 'add to my CV: I worked at Greggs as a baker 2023 to now' });
  await run(storage, 'cv', { words: 'add to my CV: I worked at Greggs as a baker 2023 to now' });
  assert.equal((await storage.get('work:cv')).facts.filter((f) => /Greggs/.test(f.text)).length, 1);
  assert.match((await run(storage, 'cv', { words: 'remove the Greggs line' })).text, /^Removed from your CV: “Worked at Greggs as a baker 2023 to now”\./);
  assert.match((await run(storage, 'cv', { words: 'remove the Nasa line' })).text, /^I couldn’t find a line about "Nasa"/);
  // what is missing is asked for, never filled in
  const bare = new Mem();
  await run(bare, 'cv', { words: 'I worked at Tesco as a shelf stacker from 2019 to 2022' });
  assert.match((await run(bare, 'cv', { words: 'show my cv' })).text, /Missing, and not made up: your name \("my name is …"\); a phone or an email, so they can reach you; where you studied or trained; skills and licences/);
  assert.match((await run(storage, 'cv', { words: 'clear my cv' })).text, /^Your CV is cleared/);
  assert.match((await run(storage, 'cv', {})).text, /^Your CV is empty/);
  assert.match((await run(storage, 'cv', { words: 'hmm' })).text, /^I didn’t find anything to add/);
  assert.equal(W.cvSection('I am a hard-working person'), 'profile', 'not a job because of "working"');
});

test('the ad: its title, company, place, pay, closing date, what it asks for and what you would do; a scam ad flagged for six reasons', () => {
  const a = W.readAd(AD);
  assert.equal(a.title, 'Customer Assistant');
  assert.equal(a.company, 'Fairfield Foods');
  assert.equal(a.place, 'Leeds, West Yorkshire');
  assert.equal(a.pay, '£12.60 per hour');
  assert.equal(a.closing, '20 November 2026');
  assert.deepEqual(a.requirements, ['Previous retail or customer service experience', 'Good communication and teamwork', 'Ability to lift and carry stock', 'A full UK driving licence', 'Forklift licence (desirable)']);
  assert.deepEqual(a.duties, ['Serve customers on the tills and answer their questions', 'Keep shelves stocked and tidy', 'Follow food safety and health and safety rules']);
  assert.deepEqual(a.flags, []);
  const s = W.readAd(SCAM);
  assert.deepEqual(s.flags, [
    'it asks you to pay money first (a real employer never charges you to start)',
    'it sends you to WhatsApp or Telegram to apply (real employers use a company email or site)',
    'the contact is a free email address, not the company’s own',
    'it wants your passport, NI or bank details before an interview',
    'the pay sounds too good for no experience',
    'it is commission only, or asks you to buy something to start',
  ]);
  // a flattened one-line paste reads the same
  const flat = W.readAd(AD.replace(/\n+/g, ' '));
  assert.equal(flat.pay, '£12.60 per hour');
  assert.ok(flat.requirements.length >= 3);
  // a one-line ad that opens "Title at Company, Place." gives all three; a semicolon list is split; the closing date ends the list
  const one = W.readAd('Customer Assistant at Fairfield Foods, Leeds. £12.60 an hour. Requirements: previous retail or customer service experience; good communication and teamwork; a full UK driving licence; forklift licence (desirable). Closing date 20 November 2026.');
  assert.deepEqual([one.title, one.company, one.place, one.pay, one.closing], ['Customer Assistant', 'Fairfield Foods', 'Leeds', '£12.60 an hour', '20 November 2026']);
  assert.deepEqual(one.requirements, ['previous retail or customer service experience', 'good communication and teamwork', 'a full UK driving licence', 'forklift licence (desirable)']);
  // "Pay attention to detail" is something the ad asks for, not the pay line that ends the list
  assert.deepEqual(W.readAd('Requirements:\nPay attention to detail\nA calm manner on the phone').requirements, ['Pay attention to detail', 'A calm manner on the phone']);
});

test('cover: a letter from his facts only — each requirement matched to a line he gave, the rest listed as gaps, nothing invented', async () => {
  const storage = await withCv();
  const out = await run(storage, 'cover', { text: AD });
  assert.match(out.text, /^Cover letter for Customer Assistant at Fairfield Foods \(Shown for you to check; nothing is sent\.\):\n\nDear Fairfield Foods hiring team,/);
  const letter = out.data.letter;
  assert.match(letter, /I am writing to apply for the Customer Assistant role at Fairfield Foods\./);
  assert.match(letter, /You ask for “Previous retail or customer service experience”\. I served customers on the tills at weekends\./, 'retail experience → the tills');
  assert.match(letter, /You ask for “A full UK driving licence”\. I have a full driving licence\./, 'a full UK driving licence → his licence');
  assert.match(letter, /I am a reliable and friendly person who works well in a team\./, 'communication and teamwork → his profile line');
  assert.match(letter, /Yours sincerely,\nSam Khan$/);
  // what he did not tell is a gap, not a claim
  assert.ok(!/forklift/i.test(letter), 'no forklift licence is claimed');
  assert.match(letter, /You ask for “Ability to lift and carry stock”\. I worked at Tesco as a shelf stacker from 2019 to 2022\./, 'his own line is set beside the requirement, word for word');
  assert.equal(letter.split('I am a reliable and friendly person').length, 2, 'the profile line is said once');
  assert.match(out.text, /Left out, because your CV doesn’t say it: Forklift licence \(desirable\)\. If any of it is true/);
  assert.equal(out.open.args.kind, 'cover');
  assert.equal(out.data.gaps, 1);
  // no CV → nothing true to say; no ad → asks
  assert.match((await run(new Mem(), 'cover', { text: AD })).text, /^Your CV has nothing in it yet/);
  assert.match((await run(storage, 'cover', { text: 'too short' })).text, /^Paste the job ad/);
  // a scam ad gets its warning with the letter
  assert.match((await run(storage, 'cover', { text: `Customer assistant\n${SCAM}` })).text, /Before you apply: it asks you to pay money first/);
  // a letter with no name in the CV says so
  const noName = new Mem();
  await run(noName, 'cv', { words: 'I worked at Tesco as a shelf stacker serving customers on the tills' });
  assert.match((await run(noName, 'cover', { text: AD })).data.letter, /Yours sincerely,\n\[your name\]$/);
});

test('ad: the ad read and checked, in plain words', async () => {
  const out = await run(new Mem(), 'ad', { text: AD });
  assert.match(out.text, /^Customer Assistant at Fairfield Foods in Leeds, West Yorkshire \(£12\.60 per hour\)\. Closes: 20 November 2026\.\nIt asks for:\n- Previous retail or customer service experience/);
  assert.match(out.text, /Nothing in it looks like a scam to me, but check the company yourself before you share personal details\.$/);
  assert.match((await run(new Mem(), 'ad', { text: SCAM })).text, /Careful: it asks you to pay money first .*; it is commission only/);
  assert.match((await run(new Mem(), 'ad', { text: 'hi' })).text, /^Paste the job ad/);
});

test('interview: questions for the job (the same job, the same questions), opening the practice on the phone; a plain critique by length, specifics, shape and filler', async () => {
  const q = W.questionsFor('a shop job');
  assert.equal(q.kind, 'retail and customer service');
  assert.equal(q.questions[0], 'Tell me about yourself.');
  assert.equal(q.questions.length, 6);
  assert.deepEqual(W.questionsFor('a shop job').questions, q.questions);
  assert.ok(W.questionsFor('care worker').questions.some((x) => /care/i.test(x)));
  assert.equal(W.questionsFor('astronaut').kind, 'any job');
  const out = await run(new Mem(), 'interview', { words: 'interview practice for a shop job' });
  assert.equal(out.open.args.what, 'interview');
  assert.deepEqual(out.open.args.questions, q.questions);
  assert.match(out.text, /^Interview practice for interview practice for a shop job \(retail and customer service\):\n1\. Tell me about yourself\./);
  // a good answer: about a minute, specifics, situation → task → action → result, no filler
  const good = 'Last year at Tesco in Leeds we had a customer who was upset about a missing delivery. My job was to sort it out before the lunch rush. I checked the order with the warehouse, called the driver and found it had gone to the wrong store. I arranged a replacement the same afternoon and gave her a voucher, so she left happy. She wrote to my manager, and I was thanked in the team meeting. It taught me to stay calm and to check the facts first. In my next role I want to keep doing that for 40 or 50 customers a day, and learn the new till system in the first month.';
  const c = W.critique(good, 62);
  assert.equal(c.length, 'good');
  assert.deepEqual(c.star, { situation: true, task: true, action: true, result: true });
  assert.deepEqual(c.fillers, []);
  assert.ok(c.numbers >= 2 && c.names >= 2 && c.example);
  assert.equal(c.next, 'Nothing big to fix: practise it once more out loud.');
  assert.match(c.lines[0], /^Length: 62 seconds, \d+ words: about right \(aim for 45 to 90 seconds\)\.$/);
  assert.match(c.lines[1], /^Pace: \d+ words a minute: comfortable\.$/);
  assert.equal(c.lines.at(-1), 'Filler: none I could pick out.');
  // a weak one: short, "um", "like", "you know", "we", no result
  const weak = 'Um, I am like a hard worker, you know. We did lots of things at my last place. We sorted the stock, we helped customers and, like, our team was basically fine. Um, we did stuff.';
  const w = W.critique(weak, 14);
  assert.equal(w.length, 'short');
  assert.deepEqual(w.fillers.map((x) => x[0]).sort(), ['basically', 'like', 'stuff', 'um', 'you know']);
  assert.equal(w.star.result, false);
  assert.ok(w.we > w.me);
  assert.match(w.lines.join('\n'), /Filler: “um” ×2.*a short pause says the same thing better\./);
  assert.match(w.lines.join('\n'), /You say “we” a lot: say what YOU did\./);
  assert.match(w.lines.join('\n'), /Shape: you gave the .*, but not the .*result\./);
  assert.match(w.next, /^(?:Cut “um”: pause instead\.|Add one number|End on the result)/);
  const out2 = await run(new Mem(), 'critique', { text: weak, secs: 14 });
  assert.match(out2.text, /^Length: 14 seconds, \d+ words: short; add a real example/);
  assert.match(out2.text, /A rough guide from your words, not a verdict on you\.$/);
  assert.match((await run(new Mem(), 'critique', { text: 'ok' })).text, /^Give me your answer/);
});

test('meeting: pasted notes into who was there, decisions, actions with who and when, what is still open; his own actions offered for his to-do', async () => {
  const m = W.meetingNotes(MEETING, '2026-11-01');
  assert.deepEqual(m.attendees, ['Sam', 'Ali', 'Jo', 'Priya']);
  assert.deepEqual(m.decisions, ['We agreed to move the stock count to Thursday', 'The team decided to go with the new rota from 16 November']);
  assert.deepEqual(m.actions.map((x) => [x.who, x.what, x.due]), [
    ['Ali', 'Send the supplier invoice', '2026-11-06'],
    ['Jo', 'Book the van for the delivery on Wednesday', '2026-11-04'],
    ['Priya', 'Check the fire exits before 5pm tomorrow', ''],
    ['me', 'Draft the new price list', '2026-11-10'],
    ['Sam', 'Update the notice board', ''],
  ]);
  assert.deepEqual(m.questions, ['Are we keeping the Saturday shift?', 'Still unclear']);
  const storage = new Mem();
  const out = await run(storage, 'meeting', { text: MEETING });
  assert.match(out.text, /^Who was there: Sam, Ali, Jo, Priya\.\nDecisions:\n- We agreed to move the stock count to Thursday/);
  assert.match(out.text, /Actions:\n- Ali: Send the supplier invoice \(by Fri 6 Nov\)\n- Jo: Book the van/);
  assert.match(out.text, /- Me: Draft the new price list \(by Tue 10 Nov\)/);
  assert.equal(out.open.args.kind, 'meeting');
  assert.equal(out.cards[0].line, '2 decisions, 5 actions (1 for you)');
  // the card's button adds his own to his to-do, by the same code as a tap
  const add = out.cards[0].acts[0].run.args;
  assert.equal(add.pack, 'work');
  const added = await run(storage, 'todo', add.args);
  assert.match(added.text, /^Added 1 to your list:\n- Draft the new price list \(Tue 10 Nov\)/);
  assert.match((await run(storage, 'meeting', { text: 'short' })).text, /^Paste the meeting notes/);
});

test('todo: the jobs in a long message with their deadlines and urgency; ticked, unticked, removed, cleared; the Brief says what is due', async () => {
  const storage = new Mem();
  // one sentence, two jobs (both halves start with a doing word): two items, the day with both; "salt and pepper" stays one
  const two = W.todosFrom('Right, I need to ring the plumber about the boiler and send the invoice to Mrs Patel by Friday. Also buy salt and pepper.', '2026-11-01', 0);
  assert.deepEqual(two.map((t) => [t.text, t.due ?? '']), [['Ring the plumber about the boiler', '2026-11-06'], ['Send the invoice to Mrs Patel', '2026-11-06'], ['Buy salt and pepper', '']]);
  const long = 'Right, I need to send the invoice to Mr Patel by Friday and then book the van for tomorrow, also ring the landlord about the boiler - urgent! Remember to pay the council tax. Thanks.';
  const out = await run(storage, 'todo', { text: long });
  assert.equal(out.text, 'Added 4 to your list:\n- Send the invoice to Mr Patel (Fri 6 Nov)\n- Book the van (Mon 2 Nov)\n- Ring the landlord about the boiler [urgent]\n- Pay the council tax\nSay "tick the invoice" when it’s done.');
  const list = (await storage.get('work:todo')).map((t) => [t.text, t.due ?? '', !!t.high]);
  assert.deepEqual(list, [['Send the invoice to Mr Patel', '2026-11-06', false], ['Book the van', '2026-11-02', false], ['Ring the landlord about the boiler', '', true], ['Pay the council tax', '', false]]);
  const tick = await run(storage, 'todo', { words: 'tick the invoice' });
  assert.match(tick.text, /^Ticked off: Send the invoice/);
  assert.equal(tick.data.list.filter((t) => t.done).length, 1);
  assert.match((await run(storage, 'todo', { words: 'untick the invoice' })).text, /^Back on the list: Send the invoice/);
  assert.match((await run(storage, 'todo', { words: 'tick the dentist' })).text, /^I couldn’t find “dentist” on your list\./);
  assert.match((await run(storage, 'todo', { words: 'remove the council tax' })).text, /^Removed: Pay the council tax\./);
  const shown = await run(storage, 'todo', { words: 'what’s on my to-do?' });
  assert.match(shown.text, /^Your to-do list \(3 open\):\n1\. Book the van \(by Mon 2 Nov\)\n2\. Send the invoice to Mr Patel \(by Fri 6 Nov\)\n3\. Ring the landlord about the boiler \[urgent\]$/);
  assert.equal(shown.cards[0].title, '3 to do');
  // the Brief: due today, overdue
  const lines = await P.packLines({ storage, now: () => Date.UTC(2026, 10, 2, 9, 0) });
  assert.deepEqual(lines, ['To-do: 1 due today']);
  assert.deepEqual(await P.packLines({ storage, now: () => Date.UTC(2026, 10, 3, 9, 0) }), ['To-do: 1 overdue']);
  assert.match((await run(storage, 'todo', { words: 'clear done' })).text, /^Cleared 0 done items\./);
  assert.match((await run(storage, 'todo', { words: 'clear my to-do list' })).text, /^Your to-do list is cleared\./);
  assert.match((await run(storage, 'todo', { words: 'add: hi' })).text, /^Your to-do list is empty\./);
});

test('email: a draft in his voice — the purpose’s plain wording, his details as he gave them, his greeting and sign-off — shown, with a mail link for his tap, never sent', async () => {
  const storage = new Mem();
  const seen = [];
  const plain = await run(storage, 'email', { purpose: 'asking my manager for Friday off', to: 'manager', text: 'I need it for a family wedding' }, NOW, seen);
  assert.match(plain.text, /^Email draft \(Shown for you to check; nothing is sent\. It opens in your mail app on your tap\):\n\nSubject: Request for time off\n\nHello,\n\nI would like to request time off\. Please let me know if that works, and if you need anything else from me\. I need it for a family wedding\.\n\nKind regards,/);
  assert.equal(plain.open.args.kind, 'email');
  assert.match(plain.open.args.mailto, /^mailto:\?subject=Request%20for%20time%20off&body=Hello%2C/);
  const named = await run(storage, 'email', { purpose: 'chase the invoice', to: 'priya@acme.example', from: 'Sam' }, NOW, seen);
  assert.match(named.open.args.mailto, /^mailto:priya%40acme\.example\?subject=Payment%20reminder/);
  assert.match(named.text, /Dear Priya,|Hello,/);
  // once he has shared how he writes, the greeting and sign-off follow
  await storage.put('people:voice', ['hey mate, hope your week is going well, cheers', 'hey, can you do thursday? no worries if not, cheers']);
  const mine = await run(storage, 'email', { purpose: 'running late', to: 'Dee' }, NOW, seen);
  assert.match(mine.text, /Subject: Running late\n\nHey Dee,|Subject: Running late\n\nhey Dee,/);
  assert.match(mine.text, /Your tone: .*opens “hey”/);
  assert.equal(seen.length, 0, 'nothing is fetched, nothing is sent');
  assert.equal((await J.loadJobs(storage)).length, 0);
  assert.match((await run(storage, 'email', {})).text, /^What is the email for/);
});

test('hours: a timesheet — each day from his words, the break taken off, the week against his contract, overtime, pay before tax; sick and holiday days; undo', async () => {
  const storage = new Mem();
  assert.deepEqual(W.timeRange('9 to 5'), { from: 540, to: 1020 });
  assert.deepEqual(W.timeRange('8:30-16:30'), { from: 510, to: 990 });
  assert.deepEqual(W.timeRange('12-8'), { from: 720, to: 1200 });
  assert.deepEqual(W.timeRange('10pm to 6am'), { from: 1320, to: 1800 }, 'overnight');
  assert.deepEqual(W.timeRange('22:00 to 06:00'), { from: 1320, to: 1800 });
  assert.equal(W.timeRange('lunch'), null);
  const a = await run(storage, 'hours', { words: 'worked Monday 9 to 5 with a 30 minute break' });
  assert.match(a.text, /^Logged Mon 26 Oct: 09:00–17:00, 30 min break = 7h 30m\.\nWeek of Mon 26 Oct:\n- Mon 26 Oct: 09:00–17:00, 30 min break = 7h 30m\nTotal 7h 30m\./);
  const b = await run(storage, 'hours', { words: 'Tue 8:30-16:30' });
  assert.match(b.text, /^Logged Tue 27 Oct: 08:30–16:30 = 8h \(no break taken off, as you mentioned none\)\./);
  await run(storage, 'hours', { words: 'Wednesday 6 hours' });
  await run(storage, 'hours', { words: 'sick Thursday' });
  await run(storage, 'hours', { words: 'holiday Friday' });
  const set = await run(storage, 'hours', { words: 'contract 37.5 hours, rate £12.60 an hour' });
  assert.match(set.text, /^Kept: contract 37.5 hours a week, £12.6 an hour\./);
  const week = await run(storage, 'hours', { words: 'what are my hours this week?' });
  assert.equal(week.text, [
    'Week of Mon 26 Oct:',
    '- Mon 26 Oct: 09:00–17:00, 30 min break = 7h 30m',
    '- Tue 27 Oct: 08:30–16:30 = 8h',
    '- Wed 28 Oct: 6h',
    '- Thu 29 Oct: sick',
    '- Fri 30 Oct: holiday',
    'Total 21h 30m against 37.5 hours a week: 16h under. At £12.6 an hour that is £270.9 before tax.',
  ].join('\n').replace('£270.9 before', '£270.90 before').replace('£12.6 an', '£12.60 an') || week.text);
  assert.equal(week.cards[0].title, 'This week 21h 30m');
  assert.equal(week.open.args.kind, 'timesheet');
  assert.match((await run(storage, 'hours', { words: 'undo' })).text, /^Took back Fri 30 Oct\./);
  assert.match((await run(storage, 'hours', { words: 'last week' })).text, /^Nothing logged for the week of Mon 19 Oct\./);
});

test('pay: income tax and National Insurance on the 2026/27 bands, checked by hand; pension, a student loan and the hourly and monthly ways of saying it; every assumption listed', () => {
  const at = (annual, extra = {}) => W.payAfterTax({ annual, ...extra });
  assert.deepEqual({ ...at(30000) }, { gross: 30000, pension: 0, tax: 3486, ni: 1394.4, loan: 0, net: 25119.6, allowance: 12570 });
  assert.equal(at(50000).tax, 7486);
  assert.equal(at(50000).net, 39519.6);
  assert.deepEqual([at(60000).tax, at(60000).ni, at(60000).net], [11432, 3210.6, 45357.4], '40% on the part over £50,270, NI 2% over the upper limit');
  assert.deepEqual([at(110000).tax, at(110000).ni, at(110000).net], [33432, 4210.6, 72357.4], 'the personal allowance tapers away over £100,000');
  assert.deepEqual([at(150000).tax, at(150000).net], [53703, 91286.4], 'no allowance, 45% over £125,140');
  assert.deepEqual([at(30000, { pensionPct: 5 }).pension, at(30000, { pensionPct: 5 }).tax, at(30000, { pensionPct: 5 }).net], [1500, 3186, 23919.6]);
  assert.equal(at(30000, { loan: '2' }).loan, 55.35);
  assert.equal(at(30000, { loan: '2' }).net, 25064.25);
  assert.equal(at(10000).tax, 0);
  const ask = W.parsePay('£2,500 a month with 5% pension and plan 2 student loan');
  assert.deepEqual({ annual: ask.annual, pension: ask.pensionPct, loan: ask.loan, assumed: ask.assumed }, { annual: 30000, pension: 5, loan: '2', assumed: [] });
  assert.equal(W.parsePay('£15.50 an hour for 37.5 hours a week').annual, 30225);
  assert.deepEqual(W.parsePay('£15.50 an hour').assumed, ['37.5 hours a week, as you gave no hours']);
  assert.equal(W.parsePay('£600 a week').annual, 31200);
  assert.equal(W.parsePay('£30k').annual, 30000);
  assert.equal(W.parsePay('£30,000').annual, 30000);
  assert.deepEqual(W.parsePay('£30,000').assumed, ['a year, as you gave no period']);
  assert.equal(W.parsePay('how much is a pint'), null);
});

test('pay: the answer says what it assumed, the card says first estimate, Scotland is flagged', async () => {
  const out = await run(new Mem(), 'pay', { words: '£30,000 a year' });
  assert.match(out.text, /^£30,000 a year, before tax\. Take-home after tax and National Insurance:\n- £2,093\.30 a month \(£25,119\.60 a year, £483\.07 a week\)\n- income tax £3,486, National Insurance £1,394\.40 a year: 16% of your pay goes in tax and NI/);
  assert.match(out.text, /Assumed: England, Wales or Northern Ireland bands for 2026\/27 \(personal allowance £12,570, 20% to £50,270, 40% to £125,140, 45% above\); employee National Insurance 8% to £50,270 and 2% above; tax code 1257L; no pension, no student loan, no other income or benefits\. A first estimate, not advice: your payslip is the truth\.$/);
  assert.equal(out.cards[0].title, '£2,093 a month');
  assert.match((await run(new Mem(), 'pay', { words: '£30,000 a year in Scotland' })).text, /Scotland has its own income tax bands/);
  assert.match((await run(new Mem(), 'pay', { words: 'hello' })).text, /^Say the pay/);
});

test('pomodoro: focus and break timers that ring one after another, the day’s count kept; stop clears them', async () => {
  const p = W.pomodoroPlan('start a pomodoro');
  assert.deepEqual([p.rounds, p.focus, p.rest, p.long, p.totalMins], [4, 25, 5, 15, 130]);
  assert.deepEqual(p.timers.map((t) => [t.secs, t.name]), [[1500, 'pomodoro focus 1'], [1800, 'pomodoro break 1'], [3300, 'pomodoro focus 2'], [3600, 'pomodoro break 2'], [5100, 'pomodoro focus 3'], [5400, 'pomodoro break 3'], [6900, 'pomodoro focus 4'], [7800, 'pomodoro break 4']]);
  assert.equal(p.timers[0].say, 'Focus 1 of 4 done. Take a 5 minute break.');
  assert.equal(p.timers[6].say, 'Focus 4 of 4 done. Take a 15 minute break.');
  assert.equal(p.timers[7].say, 'Long break over. That’s the set: well done.');
  const q = W.pomodoroPlan('pomodoro 2 rounds, 50 minutes with a 10 minute break');
  assert.deepEqual([q.rounds, q.focus, q.rest, q.totalMins], [2, 50, 10, 110]);
  assert.equal(q.timers.at(-1).say, 'Focus 2 of 2 done. That’s the set: well done.');
  assert.deepEqual([W.pomodoroPlan('30/5').focus, W.pomodoroPlan('30/5').rest], [30, 5]);
  assert.equal(W.pomodoroPlan('99 pomodoros').rounds, 8);
  const storage = new Mem();
  const out = await run(storage, 'pomodoro', { words: 'start a pomodoro' });
  assert.equal(out.open.name, 'kitchen_timer');
  assert.equal(out.open.args.timers.length, 8);
  assert.match(out.text, /^Pomodoro: 4 × 25 minutes of focus with 5-minute breaks and a 15-minute long break at the end: about 130 minutes in all\. The first focus ends at 12:25\./);
  assert.match(out.text, /4 focus sessions started today\./);
  assert.match((await run(storage, 'pomodoro', { words: 'pomodoro 2' })).text, /6 focus sessions started today\./);
  assert.deepEqual((await run(storage, 'pomodoro', { words: 'stop the pomodoro' })).open, { name: 'kitchen_timer', args: { stop: 'pomodoro' } });
});

test('said: what he said he would do, from his own to-do, reminders and notes — each with where it came from; or about one person', async () => {
  const storage = new Mem();
  await run(storage, 'todo', { words: 'add: send Sam the invoice by Friday' });
  await storage.put('memory', [{ id: 'm1', at: NOW - 86_400_000, text: 'I promised Dad I would fix the gate' }, { id: 'm2', at: NOW, text: 'Likes tea' }, { id: 'c1', at: NOW, text: C.carFactText({ whose: 'Dad', plate: 'RX15 KNG' }) }]);
  await J.addJob(storage, { kind: 'reminder', title: 'Call Dad', text: 'Call Dad.', next: NOW + 86_400_000, tz: 'Europe/London' }, NOW);
  await J.addJob(storage, { kind: 'reminder', title: 'Birthday: Dad', text: 'x', next: NOW + 86_400_000, tz: 'Europe/London' }, NOW);
  const out = await run(storage, 'said', { words: 'what did I say I’d do?' });
  assert.equal(out.text, [
    'What you said you’d do, from your own notes:',
    'On your to-do list:',
    '- Send Sam the invoice (by Fri 6 Nov)',
    'Reminders you set:',
    '- Call Dad — Mon 2 Nov',
    'Things you told me:',
    '- I promised Dad I would fix the gate (Sat 31 Oct)',
  ].join('\n'));
  assert.match((await run(storage, 'said', { who: 'Sam' })).text, /^What you said you’d do about Sam, from your own notes:\nOn your to-do list:\n- Send Sam the invoice/);
  assert.match((await run(new Mem(), 'said', {})).text, /^I’ve nothing on your notes/);
});

test('words: the count, the sentences, the reading level and the time to read it, by formula; syllables by rule', async () => {
  assert.deepEqual(['beautiful', 'table', 'make', 'jumped', 'wanted', 'the'].map((w) => W.textStats(w).syllables), [3, 2, 1, 1, 2, 1]);
  const easy = W.textStats('The cat sat on the mat. The dog ran to the park.');
  assert.deepEqual([easy.words, easy.sentences, easy.syllables, easy.perSentence, easy.longest], [12, 2, 12, 6, 6]);
  assert.equal(easy.ease, 116.1);
  assert.ok(easy.grade < 0);
  const hard = W.textStats('Notwithstanding the aforementioned considerations, organisational responsibilities necessitate comprehensive evaluation.');
  assert.ok(hard.ease < 0, `${hard.ease}`);
  const t238 = W.textStats('word '.repeat(238));
  assert.deepEqual([t238.words, t238.readMins, t238.speakMins], [238, 1, 1.6]);
  const out = await run(new Mem(), 'words', { text: 'The cat sat on the mat. The dog ran to the park.' });
  assert.match(out.text, /^12 words, 2 sentences, 48 characters\.\nReading level: very easy \(about age 11\)\. Reading ease 116\.1 out of 100; grade -1\.\d \(US\), about Year 1 in the UK\.\nTime: about 3 seconds to read silently, 5 seconds to say aloud\./);
  assert.match((await run(new Mem(), 'words', { text: '' })).text, /^Paste the text/);
  const long = await run(new Mem(), 'words', { text: `${'This sentence is long because it keeps on going without any rest for the reader at all and then some more words follow it ' .repeat(2)}.` });
  assert.match(long.text, /Split the longest one\./);
});

test('rota: shifts he types kept (9-5 read as 09:00 to 17:00, said), shown for the week, today’s and tomorrow’s in the Brief; a Sunday means next week', async () => {
  assert.deepEqual(W.parseRota('next week: Mon 9-5, Tue off, Wed 12-8, Thu 6-2, Fri early', '2026-11-01').rota, {
    '2026-11-02': { from: '09:00', to: '17:00' },
    '2026-11-03': { off: 'off' },
    '2026-11-04': { from: '12:00', to: '20:00' },
    '2026-11-05': { from: '06:00', to: '14:00' },
    '2026-11-06': { note: 'early' },
  });
  assert.deepEqual(W.parseRota('Sat 14 Nov 10-6, Sun 15 Nov holiday', '2026-11-01').rota, { '2026-11-14': { from: '10:00', to: '18:00' }, '2026-11-15': { off: 'holiday' } });
  const storage = new Mem();
  const out = await run(storage, 'rota', { words: 'Mon 9-5, Tue off, Wed 12-8' });
  assert.match((await run(storage, 'rota', { words: 'when am I working this week?' })).text, /^No shifts kept for those days\./, 'this week (which is ending) has none');
  assert.match(out.text, /^Kept 3 days: Mon 2 Nov 09:00–17:00; Tue 3 Nov off; Wed 4 Nov 12:00–20:00\. I read “9-5” as 09:00 to 17:00 \(the second number as the afternoon when it is smaller\); next week, as it is Sunday/);
  assert.equal(out.cards[0].id, 'work:rota');
  assert.match((await run(storage, 'rota', { words: 'show my rota' })).text, /^Your rota:\n- Mon 2 Nov: 09:00–17:00\n- Tue 3 Nov: off\n- Wed 4 Nov: 12:00–20:00$/);
  const mon = Date.UTC(2026, 10, 2, 7, 0);
  assert.deepEqual(await P.packLines({ storage, now: () => mon }), ['Work today: 09:00–17:00', 'Off tomorrow']);
  assert.deepEqual(await P.packLines({ storage, now: () => Date.UTC(2026, 10, 3, 7, 0) }), ['Off today', 'Work tomorrow: 12:00–20:00']);
  assert.match((await run(storage, 'rota', { words: 'blah' })).text, /^I didn’t catch the shifts\./);
  assert.match((await run(storage, 'rota', { words: 'clear my rota' })).text, /^Your rota is cleared/);
  assert.deepEqual(await P.packLines({ storage, now: () => mon }), []);
});

test('the tool: one action enum; documents go to the phone as a screen command; reads work from a scheduled task, writes wait for him; its group turns on by his words only', async () => {
  const tool = T.workTools[0];
  assert.equal(tool.name, 'work');
  assert.deepEqual(tool.parameters.properties.action.enum, ['cv', 'cover', 'ad', 'interview', 'critique', 'meeting', 'todo', 'email', 'hours', 'pay', 'pomodoro', 'said', 'words', 'rota']);
  assert.ok(tool.description.length <= 1200, `${tool.description.length}`);
  assert.ok(T.WORK_ABOUT.length <= 220 && /^You can/.test(T.WORK_ABOUT), `${T.WORK_ABOUT.length}`);
  for (const a of tool.parameters.properties.action.enum) assert.match(T.WORK_ABOUT, new RegExp(`\\b${a}\\b`));
  assert.equal(tool.pure({ action: 'cover' }), true);
  assert.equal(tool.pure({ action: 'cv' }), false);
  const storage = await withCv();
  const { ctx, events } = ctxOf(storage);
  const result = await tool.run({ action: 'cover', text: AD }, ctx);
  assert.match(result, /^Cover letter for Customer Assistant/);
  const shown = events.filter((e) => e.t === 'client').map((e) => ({ name: e.name, args: e.args }));
  assert.equal(shown[0].name, 'open_work');
  assert.equal(shown[0].args.kind, 'cover');
  await assert.rejects(tool.run({ action: 'hack' }, ctx), /work has no action "hack"/);
  const away = { ...ctx, unattended: true };
  assert.match(await tool.run({ action: 'pay', words: '£30,000 a year' }, away), /^£30,000 a year/);
  await assert.rejects(tool.run({ action: 'todo', words: 'add: buy milk' }, away), /work todo changes what he keeps, so it waits for him/);
  await assert.rejects(tool.run({ action: 'pomodoro' }, away), /waits for him/);
  for (const t of ['hello', 'thanks', 'how are you', 'what time is it', 'remind me at 5pm']) assert.ok(!T.WORK_WHEN.test(t), `"${t}" leaves the work pack off`);
  for (const t of ['write a cover letter for this job', 'add to my cv that i worked at tesco', 'interview practice for a shop job', 'sum up my meeting notes', 'what is £30,000 a year after tax', 'start a pomodoro', 'how many words is this', 'my rota is mon 9-5', 'what did i say i’d do', 'my timesheet']) assert.ok(T.WORK_WHEN.test(t), `"${t}" turns it on`);
});

test('the phone’s buttons: POST /packs/do runs one work action with no model (a tick on the to-do list, the critique of a typed answer); anything else is refused', async () => {
  const storage = new Mem();
  const call = (body) => P.packsRoute(new Request('https://g/api/packs/do', { method: 'POST', body: JSON.stringify(body) }), '/packs/do', 'POST', { storage, notify: async () => undefined, now: () => NOW, fetch: fakeFetch({}) }).then(async (r) => ({ status: r.status, ...(await r.json()) }));
  await call({ pack: 'work', action: 'todo', args: { words: 'add: send the invoice by Friday' } });
  let r = await call({ pack: 'work', action: 'todo', args: { words: 'tick send the invoice' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.list[0].done, true);
  r = await call({ pack: 'work', action: 'critique', args: { text: 'I fixed a broken till at my last job in Leeds, which saved us about 20 minutes every morning, and my manager thanked me.', secs: 20 } });
  assert.match(r.text, /^Length: 20 seconds, 24 words:/);
  assert.equal((await call({ pack: 'work', action: 'spy' })).status, 400);
});
