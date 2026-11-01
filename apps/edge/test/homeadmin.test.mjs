// THE HOME PACK (BRIEF-PACKS-3): a bill read from the text of a photo (supplier, amount, day, period — with an OCR slip in it), a
// meter, warranties from a receipt, the maker's own manual page as a link (the web search is stubbed; nothing is downloaded),
// the family cars' renewals (read from the car batch's facts, nothing fetched), bin days (alternating weeks, a council page,
// a move, bank holidays), planning applications near home (the dataset and the point's constraints are REAL captures of
// planning.data.gov.uk — which holds no applications yet — and postcodes.io; an application's fields are built from the
// platform's schema), rent, what repeats, a room's things as CSV, the house's book, his council tax band and own registration,
// a service date, and what is due. Reads for jobs; every write waits for him.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundles, ctxOf, deps, fakeFetch, fixture, Mem, NOW } from './packs-kit.mjs';

const B = await bundles(['src/tools/homeadmin.ts', 'src/packs/index.ts', 'src/schedule.ts', 'src/cars.ts', '../../packages/shared/src/homeadmin.ts', '../../packages/shared/src/cards.ts']);
const T = B['src/tools/homeadmin.ts'];
const P = B['src/packs/index.ts'];
const J = B['src/schedule.ts'];
const CARS = B['src/cars.ts'];
const S = B['../../packages/shared/src/homeadmin.ts'];
const C = B['../../packages/shared/src/cards.ts'];

const run = (storage, action, a, now = NOW, fetch = fakeFetch({})) => T.HOME[action](a, deps(storage, fetch, now));
const reminders = async (storage) => (await J.loadJobs(storage)).filter((j) => j.kind === 'reminder').map((j) => [j.title, new Date(j.next).toISOString().slice(0, 16)]);
const DAY = 86_400_000;

const GAS = `British Gas
Your energy bill
Account number: 1234 5678
Statement date: 28 October 2026
Billing period 1 Oct 2026 to 31 Oct 2026
Gas used 312 kWh
Electricity used 289 kWh
Total amount due £84.20
Please pay by 14 November 2026
Your Direct Debit will be collected on 14 November 2026`;
const WATER_NOISY = `SEVERN TRENT WATER
Water and sewerage charges
Bill for 01/10/2026 - 31/03/2027
Amount to pay £I2O.4O
Payment due date 5 December 2026`;
const COUNCIL = `Birmingham City Council
Council Tax Bill 2026/27
Instalment amount £142.00
Next instalment due 1 December 2026`;
const CREDIT = `Octopus Energy
Your account is in credit
Amount due -£35.12
Billing period 1 Sep 2026 to 30 Sep 2026`;
const RECEIPT = `CURRYS
Unit 4 Fort Shopping Park
03/03/2026 14:22
SAMSUNG 55" QLED TV   £549.00
HDMI CABLE   £9.99
TOTAL   £558.99
Card payment
Thank you`;
const COUNCIL_PAGE = `Your bin collection dates
Black bin (rubbish): Tuesday 3 November, 17 November, 1 December, 15 December
Recycling: Tuesday 10 November, 24 November, 8 December, 22 December
Garden waste: Friday 6 November, 20 November`;

test('dates in a bill’s words: written out, with or without a year, slashed in UK order, ISO', () => {
  const ds = (t) => S.datesIn(t, '2026-11-01').map((d) => d.ymd);
  assert.deepEqual(ds('Pay by 14 November 2026'), ['2026-11-14']);
  assert.deepEqual(ds('due 5 Dec'), ['2026-12-05']);
  assert.deepEqual(ds('Nov 14th, 2026 and 3rd March 25'), ['2026-11-14', '2025-03-03']);
  assert.deepEqual(ds('01/10/2026 - 31/03/2027'), ['2026-10-01', '2027-03-31']);
  assert.deepEqual(ds('2026-11-14'), ['2026-11-14']);
  assert.deepEqual(ds('31 Feb 2026'), [], 'no such day');
});

test('reading a bill: the supplier, the amount next to “amount due”, the due day, the period — and what it could not find', () => {
  const g = S.readBill(GAS, '2026-11-01');
  assert.deepEqual([g.supplier, g.kind, g.amount, g.due, g.from, g.to, g.credit], ['British Gas', 'gas and electricity', 84.2, '2026-11-14', '2026-10-01', '2026-10-31', false]);
  assert.match(g.notes[0], /the amount is the one next to “total amount due”/);
  const w = S.readBill(WATER_NOISY, '2026-11-01');
  assert.deepEqual([w.supplier, w.kind, w.amount, w.due, w.from, w.to], ['Severn Trent', 'water', 120.4, '2026-12-05', '2026-10-01', '2027-03-31'], 'an OCR slip in the pounds (I for 1, O for 0) is read');
  const c = S.readBill(COUNCIL, '2026-11-01');
  assert.deepEqual([c.supplier, c.kind, c.amount, c.due], ['Birmingham Council', 'council tax', 142, '2026-12-01']);
  const cr = S.readBill(CREDIT, '2026-11-01');
  assert.deepEqual([cr.supplier, cr.amount, cr.credit], ['Octopus Energy', 35.12, true]);
  const none = S.readBill('hello there, nothing to see', '2026-11-01');
  assert.equal(none.amount, null);
  assert.ok(none.notes.includes('no due date found'));
  const largest = S.readBill('Acme Ltd\nsubtotal £10.00\nsomething £99.50', '2026-11-01');
  assert.equal(largest.amount, 99.5);
  assert.ok(largest.notes.some((n) => /largest amount on the page: check it/.test(n)));
});

test('bill: kept with a reminder two days before the due day at 9am, once; the card has PAID and UNDO; a credit sets no reminder; bills and what the gas cost', async () => {
  const storage = new Mem();
  const out = await run(storage, 'bill', { text: GAS });
  assert.match(out.text, /^Kept: British Gas \(gas and electricity\) £84\.20, due Sat 14 Nov, for Thu 1 Oct to Sat 31 Oct\. I’ll remind you two days before/);
  assert.match(out.text, /I read this from the text of a photo or a paste, so check it: the amount is the one next to “total amount due”\./);
  assert.deepEqual(await reminders(storage), [['Bill: British Gas 2026-11-14', '2026-11-12T09:00']]);
  assert.deepEqual(out.cards[0].acts.map((x) => x.label), ['PAID', 'UNDO']);
  assert.match((await run(storage, 'bill', { text: GAS })).text, /^That one is kept already: British Gas £84\.20 due Sat 14 Nov/);
  assert.equal((await reminders(storage)).length, 1, 'not twice');
  await run(storage, 'bill', { text: WATER_NOISY });
  const cr = await run(storage, 'bill', { text: CREDIT });
  assert.match(cr.text, /Octopus Energy \(gas and electricity\) in credit by £35\.12, no due date found/);
  assert.equal((await storage.get('home:bills')).find((b) => b.supplier === 'Octopus Energy').credit, 35.12);
  assert.equal((await reminders(storage)).length, 2, 'a credit is not a bill to pay');
  assert.match((await run(storage, 'bill', { text: 'hello' })).text, /^Photograph the bill/);
  assert.match((await run(storage, 'bill', { text: 'Acme is a company that makes anvils and things' })).text, /^I couldn’t find an amount or a due date/);
  // what is to pay, soonest first
  const list = await run(storage, 'bills', {});
  assert.match(list.text, /^Bills still to pay \(2\):\n- British Gas £84\.20 due Sat 14 Nov \(in 13 days\)\n- Severn Trent £120\.40 due Sat 5 Dec/);
  assert.match(list.text, /In the next 30 days: £84\.20\./);
  assert.doesNotMatch(list.text, /Octopus/, 'a statement in credit is not a bill to pay');
  // how much was the gas this year
  const gas = await run(storage, 'bills', { words: 'how much was the gas this year?' });
  assert.match(gas.text, /^Gas and electricity this year: £84\.20 over 1 bill I have\.\n- British Gas £84\.20 to Sat 31 Oct\n/);
  assert.match((await run(storage, 'bills', { words: 'how much was the water this year' })).text, /^Water this year: £120\.40 over 1 bill/);
  assert.match((await run(storage, 'bills', { words: 'how much was the broadband this year' })).text, /^I have no bills like that for 2026/);
  // paid clears the reminder; UNDO forgets the bill
  assert.match((await run(storage, 'paid', { words: 'paid British Gas' })).text, /^Marked paid: British Gas £84\.20\. Its reminder is cleared\./);
  assert.deepEqual(await reminders(storage), [['Bill: Severn Trent 2026-12-05', '2026-12-03T09:00']]);
  const id = (await storage.get('home:bills')).find((b) => b.supplier === 'Severn Trent').id;
  assert.match((await run(storage, 'paid', { id, remove: true })).text, /^Forgot the Severn Trent bill, and its reminder\./);
  assert.deepEqual(await reminders(storage), []);
  assert.match((await run(storage, 'paid', { words: 'paid nobody' })).text, /^Which bill\?/);
  // a bill that is already paid can still be forgotten, by its supplier; marking paid again does not find it
  assert.match((await run(storage, 'paid', { words: 'paid British Gas' })).text, /^Which bill\?/, 'it is paid already');
  assert.match((await run(storage, 'paid', { words: 'forget British Gas' })).text, /^Forgot the British Gas bill, and its reminder\./);
  assert.ok(!(await storage.get('home:bills')).some((b) => b.supplier === 'British Gas'));
});

test('the Brief: the next bill within the week as a line', async () => {
  const storage = new Mem();
  await run(storage, 'bill', { text: GAS });
  assert.deepEqual(await P.packLines({ storage, now: () => NOW }), []);
  assert.deepEqual(await P.packLines({ storage, now: () => Date.UTC(2026, 10, 9, 12, 0) }), ['British Gas £84.20 due Sat 14 Nov (in 5 days)']);
  assert.deepEqual(await P.packLines({ storage, now: () => Date.UTC(2026, 10, 16, 12, 0) }), ['British Gas £84.20 due Sat 14 Nov (2 days overdue)'], 'unpaid and late says so');
});

test('warranties: from his words (the default of 12 months said as one), from a receipt’s text, a reminder a month before, the money pack’s too', async () => {
  const storage = new Mem();
  const rc = S.readReceipt(RECEIPT, '2026-11-01');
  assert.deepEqual(rc, { store: 'Currys', date: '2026-03-03', total: 558.99, item: 'Samsung 55" qled tv' });
  const out = await run(storage, 'warranty', { text: RECEIPT, words: 'the Samsung TV' });
  assert.match(out.text, /^Kept: the Samsung TV from Currys, bought Tue 3 Mar, 12-month warranty — 12 months is a plain default \(most shops give a year\), so check your receipt or the box: it ends Tue 2 Mar 2027\./);
  assert.match(out.text, /I read the receipt from a photo, so check the item and the date\./);
  assert.equal(out.data.warranty.defaulted, true);
  const told = await run(storage, 'warranty', { words: 'washing machine bought 3 March 2026, 2 year warranty' });
  assert.match(told.text, /^Kept: the washing machine, bought Tue 3 Mar, 24-month warranty: it ends Thu 2 Mar 2028\. I’ll remind you on Wed 2 Feb 2028 at 9am, a month before it ends\.$/);
  assert.doesNotMatch(told.text, /default/);
  assert.deepEqual((await reminders(storage)).sort((x, y) => x[1].localeCompare(y[1])), [['Warranty ends: Samsung TV', '2027-02-02T09:00'], ['Warranty ends: washing machine', '2028-02-02T09:00']]);
  // the money pack keeps warranties too: one list
  await storage.put('money:warranties', [{ id: 'm1', thing: 'kettle', bought: '2026-01-10', months: 12, ends: '2027-01-09' }]);
  const all = await run(storage, 'warranty', {});
  assert.match(all.text, /^Warranties:\n- Kettle: until Sat 9 Jan 2027 \(from the money pack\)\n- Samsung tv: until Tue 2 Mar 2027/i);
  assert.match(all.text, /Kettle: until Sat 9 Jan 2027 \(from the money pack\)/);
  assert.match(all.text, /Washing machine: until Thu 2 Mar 2028/);
  assert.match((await run(storage, 'warranty', { words: 'forget the washing machine warranty' })).text, /^Forgot the washing machine warranty, and its reminder\./);
  assert.deepEqual(await reminders(storage), [['Warranty ends: Samsung TV', '2027-02-02T09:00']]);
  assert.match((await run(storage, 'warranty', { words: 'something' })).text, /^What is it\?/);
});

test('the maker’s own manual page, as a link only: found by the web search, picked by the maker’s own host, saved; archives and copies are not used', async () => {
  const storage = new Mem();
  assert.match((await run(storage, 'manual', {})).text, /^I need the model number/);
  const was = T.homeHooks.search;
  const seen = [];
  T.homeHooks.search = async (q) => {
    seen.push(q);
    return [
      { title: 'Bosch SMS24AW01G manual | ManualsLib', url: 'https://www.manualslib.com/manual/1/bosch-sms24aw01g.html' },
      { title: 'SMS24AW01G dishwasher instructions', url: 'https://media3.bosch-home.com/Documents/specsheet/en-GB/SMS24AW01G.pdf' },
      { title: 'A blog about dishwashers', url: 'https://dishwasherblog.example/bosch' },
    ];
  };
  try {
    const out = await run(storage, 'manual', { words: 'manual for my Bosch dishwasher SMS24AW01G' });
    assert.match(out.text, /^Found for Bosch dishwasher SMS24AW01G: “SMS24AW01G dishwasher instructions” — https:\/\/media3\.bosch-home\.com\/Documents\/specsheet\/en-GB\/SMS24AW01G\.pdf \(Bosch's own site\)\. Saved as a link in your home book; I haven’t downloaded or copied the manual/);
    assert.ok(seen[0].includes('Bosch') && seen[1].includes('site:'), seen.join(' | '));
    assert.match((await run(storage, 'manual', { words: 'manual for SMS24AW01G' })).text, /^Saved already: Bosch dishwasher SMS24AW01G/);
    assert.match((await run(storage, 'manual', {})).text, /^Manuals you saved \(links to the maker’s own pages\):\n- Bosch dishwasher SMS24AW01G: https:\/\/media3/);
    // only an archive found: nothing saved
    T.homeHooks.search = async () => [{ title: 'Samsung WW90 manual', url: 'https://www.manualslib.com/manual/2/samsung-ww90.html' }];
    const none = await run(storage, 'manual', { words: 'Samsung washing machine WW90T534DAW manual' });
    assert.match(none.text, /^I couldn’t find Samsung’s own page for Samsung washing machine WW90T534DAW \(1 results, none from the maker’s own site; 1 skipped as not theirs\)\. I only save the maker’s own page/);
    assert.equal((await storage.get('home:manuals')).length, 1);
    T.homeHooks.search = async () => {
      throw new Error('no search');
    };
    assert.match((await run(storage, 'manual', { words: 'LG fridge GBB92STAXP manual' })).text, /the web search gave nothing just now/);
  } finally {
    T.homeHooks.search = was;
  }
  assert.match((await run(storage, 'manual', { words: 'forget the manual for SMS24AW01G' })).text, /^Forgot that manual link\./);
});

test('the family cars’ renewals: the MOT and tax months from the car batch’s facts (nothing fetched), insurance as he told it, a month and a week before', async () => {
  const storage = new Mem();
  assert.match((await run(storage, 'renewals', {})).text, /^No cars named yet\./);
  await CARS.saveCar(storage, { whose: 'Dad', plate: 'AB12 CDE', nickname: 'the Fiesta' }, NOW);
  await CARS.setMonths(storage, 'AB12CDE', { mot: '2027-03', tax: '2027-02' });
  await CARS.saveCar(storage, { whose: 'me', plate: 'XY19 ZZZ' }, NOW);
  const list = await run(storage, 'renewals', {});
  assert.match(list.text, /^Your cars’ renewals \(MOT and tax from the car records you opened; insurance as you told me\):\n- Dad's Fiesta \(AB12 CDE\): MOT due March 2027; tax due February 2027\n/);
  assert.match(list.text, /Your car \(XY19 ZZZ\): MOT not known yet; tax not known yet/);
  const told = await run(storage, 'renewals', { words: 'Dad’s car insurance renews on 3 March 2027' });
  assert.match(told.text, /^Kept: Dad's Fiesta insurance renews Wed 3 Mar 2027\. I’ll remind you a month before and a week before, at 9am \(6 reminders are set for your cars and insurance\)\./);
  assert.match(told.text, /insurance renews Wed 3 Mar 2027/);
  const byDay = (list) => [...list].sort((x, y) => x[1].localeCompare(y[1]) || x[0].localeCompare(y[0]));
  assert.deepEqual(byDay(await reminders(storage)), [
    ['MOT: Dad\'s Fiesta', '2027-02-01T09:00'], ['MOT: Dad\'s Fiesta', '2027-02-22T09:00'],
    ['Tax: Dad\'s Fiesta', '2027-01-01T09:00'], ['Tax: Dad\'s Fiesta', '2027-01-25T09:00'],
    ['Insurance: Dad\'s Fiesta', '2027-02-01T09:00'], ['Insurance: Dad\'s Fiesta', '2027-02-24T09:00'],
  ].sort((x, y) => x[1].localeCompare(y[1]) || x[0].localeCompare(y[0])));
  // not twice, and the Brief keeps them armed
  await P.packLines({ storage, now: () => NOW });
  assert.equal((await reminders(storage)).length, 6);
  assert.match((await run(storage, 'renewals', {})).text, /MOT due March 2027; tax due February 2027; insurance renews Wed 3 Mar 2027/);
  assert.match((await run(storage, 'renewals', { words: 'remind me about the cars’ renewals' })).text, /^Set: reminders a month and a week before each MOT, tax and insurance date I know \(6 in your Agenda\)/);
  assert.deepEqual(await P.packLines({ storage, now: () => Date.UTC(2027, 1, 25, 12, 0) }), ['Dad\'s Fiesta insurance renews Wed 3 Mar'], 'a week out, the Brief says it');
});

test('bin days: weekly, every other week from a day, the council’s printed dates, a move, a bank holiday that slips them — and the night before in the Brief', async () => {
  const bins = S.parseBins('bins are Tuesday, recycling every other Tuesday, next recycling is 10 November', '2026-11-01');
  assert.deepEqual(bins.map((b) => [b.name, b.weekday, b.every, b.anchor ?? '']), [['rubbish', 2, 1, ''], ['recycling', 2, 2, '2026-11-10']]);
  assert.deepEqual(S.parseBins('garden waste every other Friday starting 6 November, food waste every Monday', '2026-11-01').map((b) => [b.name, b.weekday, b.every, b.anchor ?? '']), [['garden waste', 5, 2, '2026-11-06'], ['food waste', 1, 1, '']]);
  assert.equal(S.needsAnchor(S.parseBins('recycling every other Tuesday', '2026-11-01')[0]), true, 'every other week needs one day it is collected');
  const book = { bins, moves: [], slip: false };
  assert.deepEqual(S.binDays(bins[0], book, '2026-11-01', 3), ['2026-11-03', '2026-11-10', '2026-11-17']);
  assert.deepEqual(S.binDays(bins[1], book, '2026-11-01', 3), ['2026-11-10', '2026-11-24', '2026-12-08'], 'the other week’s Tuesdays are not recycling');
  assert.deepEqual(S.binDays(bins[1], book, '2026-11-10', 1), ['2026-11-10'], 'today counts');
  // the council’s printed dates are used as they are
  const page = S.parseBinDates(COUNCIL_PAGE, '2026-11-01');
  assert.deepEqual(page.map((b) => [b.name, b.dates.length]), [['rubbish', 4], ['recycling', 4], ['garden waste', 2]]);
  assert.deepEqual(S.binDays(page[2], book, '2026-11-01', 3), ['2026-11-06', '2026-11-20']);
  // a move he tells it, for the week it is in
  const mv = S.parseMove('bins move to Wednesday this week', bins[0], '2026-11-03');
  assert.deepEqual(mv, { from: '2026-11-03', to: '2026-11-04' });
  assert.deepEqual(S.binDays(bins[0], { bins, moves: [mv], slip: false }, '2026-11-01', 2), ['2026-11-04', '2026-11-10']);
  // England and Wales’s bank holidays, a weekend one moved on
  assert.deepEqual(S.bankHolidays(2026), ['2026-01-01', '2026-04-03', '2026-04-06', '2026-05-04', '2026-05-25', '2026-08-31', '2026-12-25', '2026-12-28']);
  assert.deepEqual(S.bankHolidays(2027).slice(-2), ['2027-12-27', '2027-12-28'], 'Christmas on a Saturday: Monday and Tuesday');
  assert.equal(S.easter(2026), '2026-04-05');
  assert.equal(S.easter(2027), '2027-03-28');
  // “a day late after a bank holiday”: the week of Christmas 2026 (Friday 25th), collections on or after it slip a day
  assert.equal(S.slipped('2026-12-22', true), '2026-12-22', 'before the holiday in the same week: not moved');
  assert.equal(S.slipped('2026-12-25', true), '2026-12-26', 'Friday’s goes to Saturday');
  assert.equal(S.slipped('2027-05-04', true), '2027-05-05', 'Tuesday after the early May bank holiday Monday');
  assert.equal(S.slipped('2027-05-04', false), '2027-05-04');
  // via the tool: told once, answered every time, the night before
  const storage = new Mem();
  const out = await run(storage, 'bins', { words: 'bins are Tuesday, recycling every other Tuesday, next recycling is 10 November' });
  assert.match(out.text, /^Kept: Rubbish: every Tuesday; Recycling: every other Tuesday \(next from Tue 10 Nov\)\.\n/);
  assert.match(out.text, /Rubbish: Tue 3 Nov, then Tue 10 Nov\nRecycling: Tue 10 Nov, then Tue 24 Nov/);
  assert.match((await run(storage, 'bins', {})).text, /^Rubbish: Tue 3 Nov, then Tue 10 Nov/);
  const eve = Date.UTC(2026, 10, 2, 18, 0);
  assert.match((await run(storage, 'bins', {}, eve)).text, /^Bins out tonight: rubbish \(collected tomorrow\)\.\nRubbish: Tue 3 Nov \(tomorrow\), then Tue 10 Nov/);
  assert.deepEqual(await P.packLines({ storage, now: () => eve }), ['Bins out tonight: rubbish']);
  assert.deepEqual(await P.packLines({ storage, now: () => Date.UTC(2026, 10, 3, 8, 0) }), ['Bin day today: rubbish']);
  assert.deepEqual(await P.packLines({ storage, now: () => Date.UTC(2026, 10, 3, 14, 0) }), [], 'past noon on the day: the line goes');
  assert.deepEqual(await P.packLines({ storage, now: () => Date.UTC(2026, 10, 9, 18, 0) }), ['Bins out tonight: rubbish and recycling']);
  assert.match((await run(storage, 'bins', { words: 'the bins move to Wednesday this week' }, Date.UTC(2026, 10, 2, 9, 0))).text, /^Noted: Tue 3 Nov moves to Wed 4 Nov\./);
  assert.match((await run(storage, 'bins', { words: 'collections run a day late after a bank holiday' })).text, /^Noted your rule: after a bank holiday in the week, collections run a day late\./);
  // the council’s page, pasted
  const pasted = await run(new Mem(), 'bins', { text: COUNCIL_PAGE });
  assert.match(pasted.text, /^Kept the days from your council’s page: rubbish \(4 dates\), recycling \(4 dates\), garden waste \(2 dates\)\./);
  assert.match((await run(new Mem(), 'bins', {})).text, /^I don’t know your bin days yet\./);
  assert.match((await run(storage, 'bins', { words: 'forget my bin days' })).text, /^Forgot your bin days\./);
  assert.match((await run(new Mem(), 'bins', { words: 'recycling every other Tuesday' })).text, /I need one day it is collected/);
});

test('planning near home: the national data lists none yet (said plainly, with the council), the point’s constraints, applications where there are some, a watch told once each', async () => {
  const dataset0 = JSON.parse(fixture('planning-dataset.json'));
  assert.equal(dataset0['entity-count'], 0, 'a real capture: the platform holds no applications yet');
  const constraints = JSON.parse(fixture('planning-constraints.json'));
  const reverse = JSON.parse(fixture('postcodes-reverse.json'));
  const net = (dataset, entities) =>
    fakeFetch({
      'https://www.planning.data.gov.uk/dataset/planning-application.json': dataset,
      'https://www.planning.data.gov.uk/entity.json': (u) => (u.includes('dataset=planning-application') ? { entities } : constraints),
      'https://api.postcodes.io/postcodes': reverse,
    });
  const home = { id: 'home', label: 'Home', query: 'B2 4BF', address: 'New Street', lat: 52.4778, lon: -1.8985, at: 0 };
  const store = () => {
    const s = new Mem();
    s.m.set('places', [home]);
    return s;
  };
  const none = await run(store(), 'planning', {}, NOW, net(dataset0, []));
  assert.match(none.text, /^At your home the national planning data lists: CITY WIDE HMO \(an Article 4 direction area\)\./);
  assert.match(none.text, /I can’t list planning applications near you: the national platform \(planning\.data\.gov\.uk\) has begun a planning-application dataset but holds none yet\. Birmingham is your council: its own planning pages hold them, and I can’t search those from here\./);
  assert.match(none.text, /https:\/\/www\.gov\.uk\/find-local-council/);
  // a platform that does hold some (the fields are the platform's schema)
  const apps = [
    { entity: 10000000001, reference: '2026/04567/PA', description: 'Erection of a single-storey rear extension', 'planning-application-status': 'Under consideration', 'documentation-url': 'https://example.test/case/2026-04567', point: 'POINT (-1.8990 52.4781)' },
    { entity: 10000000002, reference: '2026/04571/PA', description: 'Change of use to a café', 'planning-application-status': 'Received' },
  ];
  const some = await run(store(), 'planning', {}, NOW, net({ ...dataset0, 'entity-count': 120 }, apps));
  assert.match(some.text, /Planning applications within 500 m of home:\n- 2026\/04567\/PA: Erection of a single-storey rear extension \(Under consideration\) https:\/\/example\.test\/case\/2026-04567\n- 2026\/04571\/PA: Change of use to a café \(Received\)/);
  const clear = await run(store(), 'planning', {}, NOW, net({ ...dataset0, 'entity-count': 120 }, []));
  assert.match(clear.text, /^At your home .*\nNo planning applications within 500 m of home on the national platform, which only some councils feed so far: Birmingham’s own planning pages are the full list\./s);
  assert.match((await run(store(), 'planning', {}, NOW, fakeFetch({}))).text, /isn’t answering just now, so I can’t list applications\. I won’t guess\./);
  assert.match((await run(new Mem(), 'planning', {})).text, /home|save|remember/i);
  // a watch: the ones there now are the baseline; a new one is told once, and the follow job exists once
  const storage = store();
  const watch = await run(storage, 'planning', { words: 'tell me about new planning applications within 300 metres' }, NOW, net({ ...dataset0, 'entity-count': 120 }, apps));
  assert.match(watch.text, /Watching: I look twice a day and tell you once about each new application within 300 m of home\./);
  assert.deepEqual((await storage.get('home:planning')).seen, ['10000000001', '10000000002']);
  assert.equal((await J.loadJobs(storage)).filter((j) => j.kind === 'follow').length, 1);
  const told = [];
  const tell = async (title, text, card) => told.push([title, text, card.title]);
  const dd = deps(storage, net({ ...dataset0, 'entity-count': 120 }, [...apps, { entity: 10000000003, reference: '2026/04600/PA', description: 'Loft conversion', 'planning-application-status': 'Received' }]), NOW + DAY);
  const next = await T.planningTick(dd, tell);
  assert.deepEqual(told.map((t) => t[0]), ['New planning application']);
  assert.ok(told[0][1].startsWith('2026/04600/PA: Loft conversion (Received) — within 300 m of home.'), told[0][1]);
  assert.equal(next, NOW + DAY + 12 * 3_600_000);
  await T.planningTick(dd, tell);
  assert.equal(told.length, 1, 'told once each');
  assert.match((await run(storage, 'planning', { words: 'stop watching' }, NOW, net(dataset0, []))).text, /^Stopped watching for planning applications near home\./);
  assert.equal((await T.planningTick(deps(storage, net(dataset0, []), NOW), tell)) > 0, true);
  // the follow job runs the planning watch with the price watches
  const viaIndex = [];
  const nextAt = await P.packsTick({ storage: store(), notify: async (i) => viaIndex.push(i), fetch: net(dataset0, []), now: () => NOW });
  assert.equal(nextAt, NOW + 12 * 3_600_000);
  // the radius in his words
  assert.deepEqual(['300 metres', 'half a mile', '1 km', 'within 5 km', 'nothing'].map((w) => S.radiusFrom(w)), [300, 805, 1000, 2000, 500]);
  assert.match(S.circleWkt(52.4778, -1.8985, 500), /^POLYGON\(\(-1\.8985\d* 52\.48[23]\d*,/);
  assert.equal(S.circleWkt(52.4778, -1.8985, 500).split(',').length, 13);
});

test('a meter: the reading from a photo’s digits (a dial split by spaces, a letter O for a zero), the unit and the kind, the usage since last time', async () => {
  assert.deepEqual(S.readMeter('Electricity 0 1 2 3 4 kWh'), { value: 1234, unit: 'kWh', kind: 'electricity', note: 'the only run of digits I could see: check it against the meter' });
  assert.equal(S.readMeter('GAS 00612.45 m3').value, 612.45);
  assert.equal(S.readMeter('GAS 00612.45 m3').kind, 'gas');
  assert.equal(S.readMeter('12O45').value, 12045, 'an O read for a zero');
  assert.equal(S.readMeter('no numbers'), null);
  assert.equal(S.meterUsage([{ on: '2026-10-01', value: 1000 }]), null);
  assert.deepEqual(S.meterUsage([{ on: '2026-10-01', value: 1000 }, { on: '2026-11-01', value: 1310 }]), { units: 310, days: 31, perDay: 10, since: '2026-10-01' });
  assert.equal(S.meterUsage([{ on: '2026-10-01', value: 1000 }, { on: '2026-11-01', value: 90 }]), 'lower');
  const storage = new Mem();
  assert.match((await run(storage, 'meter', {})).text, /^No readings kept\./);
  assert.match((await run(storage, 'meter', { text: '12345' })).text, /^I read 12,345: is that the electricity, gas or water meter\?/);
  const first = await run(storage, 'meter', { text: 'Electricity 0 1 0 0 0 kWh', words: 'meter reading 1 October 2026' });
  assert.match(first.text, /^Kept: Electricity: 1,000 on Thu 1 Oct \(the first reading: I need a second to tell you the usage\)\.\nI took the only run of digits I could see: check it against the meter\.$/);
  const second = await run(storage, 'meter', { text: 'Electricity 0 1 3 1 0 kWh', pence: 27 });
  assert.match(second.text, /^Kept: Electricity: 1,310 on Sun 1 Nov\. Since Thu 1 Oct \(31 days\): 310 units, about 10 a day\. At 27p a unit that is about £83\.70 \(an estimate: standing charges/);
  assert.match((await run(storage, 'meter', { text: '00900', kind: 'electricity' })).text, /lower than the one before: the dial may have gone round or been misread, so no usage/);
  assert.match((await run(storage, 'meter', {})).text, /^Electricity: /);
  // kept readings can be forgotten: one meter's, or all
  await run(storage, 'meter', { text: 'Gas 0 0 4 2 0', kind: 'gas' });
  assert.match((await run(storage, 'meter', { words: 'forget the water readings' })).text, /^I have no water readings to forget\./);
  assert.match((await run(storage, 'meter', { words: 'forget the electricity readings' })).text, /^Forgot the electricity readings\./);
  assert.deepEqual(Object.keys(await storage.get('home:meters')), ['gas'], 'the other meter stays');
  assert.match((await run(storage, 'meter', { words: 'forget my meter readings' })).text, /^Forgot all your meter readings\./);
  assert.equal(await storage.get('home:meters'), undefined);
  assert.match((await run(storage, 'meter', {})).text, /^No readings kept\./);
});

test('rent or a mortgage: the day each month, a monthly reminder at 9am, the Brief the day before, forgotten on request', async () => {
  assert.deepEqual(S.parseRent('rent is due on the 1st, £750'), { kind: 'rent', day: 1, amount: 750 });
  assert.deepEqual(S.parseRent('mortgage £1,150 on the 28th'), { kind: 'mortgage', day: 28, amount: 1150 });
  assert.equal(S.parseRent('hello'), null);
  assert.equal(S.rentNext({ kind: 'rent', day: 31 }, '2026-02-10'), '2026-02-28', 'a day past the month’s end is its last day');
  assert.equal(S.rentNext({ kind: 'rent', day: 1 }, '2026-12-15'), '2027-01-01');
  const storage = new Mem();
  assert.match((await run(storage, 'rent', {})).text, /^Tell me once:/);
  const out = await run(storage, 'rent', { words: 'rent is due on the 1st, £750' });
  assert.match(out.text, /^Kept: your rent \(£750\) is due on day 1 of each month — next Tue 1 Dec\. I’ll remind you at 9am that day, every month/);
  const jobs = (await J.loadJobs(storage)).filter((j) => j.kind === 'reminder');
  assert.deepEqual(jobs.map((j) => [j.title, j.repeat, new Date(j.next).toISOString().slice(0, 16)]), [['Rent due today (£750)', 'monthly', '2026-12-01T09:00']]);
  assert.match((await run(storage, 'rent', {})).text, /^Your rent \(£750\) is due on the 1st of each month — next Tue 1 Dec \(30 days\)\./);
  assert.deepEqual(await P.packLines({ storage, now: () => Date.UTC(2026, 10, 30, 12, 0) }), ['Rent is due tomorrow (£750)']);
  await run(storage, 'rent', { words: 'mortgage £1,150 on the 28th' });
  assert.equal((await J.loadJobs(storage)).filter((j) => j.kind === 'reminder').length, 1, 'the new date replaces the old reminder');
  assert.match((await run(storage, 'rent', { words: 'forget the mortgage date' })).text, /^Forgot the rent date, and its reminder\./);
  assert.equal((await J.loadJobs(storage)).filter((j) => j.kind === 'reminder').length, 0);
});

test('what repeats: his money-pack list and the subscriptions found on statements, once each, a monthly total that says what it assumed', async () => {
  const joined = S.subLines([{ name: 'Netflix', amount: 10.99, every: 'month' }, { name: 'Gym', amount: 360, every: 'year' }], [{ name: 'Netflix', amount: 10.99, cadence: 'monthly' }, { name: 'Spotify', amount: 11.99, cadence: 'monthly' }]);
  assert.deepEqual(joined.lines.map((l) => [l.name, Math.round(l.monthly * 100) / 100, l.src]), [['Gym', 30, 'your list'], ['Spotify', 11.99, 'statements'], ['Netflix', 10.99, 'your list']]);
  assert.equal(joined.monthly, 52.98);
  const storage = new Mem();
  assert.match((await run(storage, 'subs', {})).text, /^Nothing repeating that I can see/);
  await storage.put('money:subs', [{ id: 's1', name: 'Netflix', amount: 10.99, every: 'month', next: '2026-11-20' }]);
  const out = await run(storage, 'subs', {});
  assert.match(out.text, /^What you pay on repeat — about £10\.99 a month \(£132 a year\):\n- Netflix: £10\.99 a month \(monthly, from your list\)/);
  assert.match(out.text, /An estimate: the same amount to the same name/);
});

test('a room’s things for insurance: counts and values in his words, confirmed phone labels, a CSV an insurer can open', async () => {
  assert.deepEqual(S.parseThings('a 55 inch TV worth £400, 2 armchairs, laptop £900 and a lamp'), [
    { name: '55 inch TV', qty: 1, value: 400 }, { name: 'Armchairs', qty: 2 }, { name: 'Laptop', qty: 1, value: 900 }, { name: 'Lamp', qty: 1 },
  ]);
  assert.deepEqual(S.thingsFromLabels(['chair', 'chair', 'couch', 'person', 'tv', 'potted plant']), [{ name: 'Chair', qty: 2 }, { name: 'Sofa', qty: 1 }, { name: 'TV', qty: 1 }, { name: 'Potted plant', qty: 1 }]);
  const storage = new Mem();
  assert.match((await run(storage, 'inventory', {})).text, /^Nothing kept yet\./);
  assert.match((await run(storage, 'inventory', { words: 'a lamp' })).text, /^Nothing kept yet|^Which room\?/);
  const out = await run(storage, 'inventory', { room: 'living room', words: 'a 55 inch TV worth £400, 2 armchairs, laptop £900' });
  assert.match(out.text, /^Kept in the living room: 55 inch TV \(£400\), 2 Armchairs, Laptop \(£900\)\.\nLiving room: 55 inch TV, 2 Armchairs, Laptop\n3 things in 1 room; £1,300 where you gave a value\./);
  await run(storage, 'inventory', { room: 'kitchen', items: ['Kettle £30', { name: 'Toaster', qty: 1, value: 25 }] });
  const csv = (await run(storage, 'inventory', { export: true })).data.csv;
  assert.equal(csv, 'Room,Item,Quantity,Value (GBP)\nLiving room,55 inch TV,1,400\nLiving room,Armchairs,2,\nLiving room,Laptop,1,900\nKitchen,Kettle,1,30\nKitchen,Toaster,1,25');
  assert.equal(S.inventoryCsv([{ id: 'x', room: 'Hall', name: 'Mirror, large "gilt"', qty: 1 }]), 'Room,Item,Quantity,Value (GBP)\nHall,"Mirror, large ""gilt""",1,');
  assert.match((await run(storage, 'inventory', { words: 'forget the kitchen' })).text, /^Forgot 2 things\./);
});

test('the house’s address book: his entries only — a role, a name, a number — asked for by role, forgotten on request', async () => {
  assert.deepEqual(S.parseEntry('the plumber is Dave on 07700 900123'), { role: 'plumber', name: 'Dave', phone: '07700 900123' });
  assert.deepEqual(S.parseEntry('landlord: Mrs Patel 0121 496 0000'), { role: 'landlord', name: 'Mrs Patel', phone: '01214 960000' });
  assert.deepEqual(S.parseEntry('the council’s number is 0121 303 1111'), { role: 'council', name: 'Council', phone: '01213 031111' });
  assert.equal(S.parseEntry('hello there'), null);
  const storage = new Mem();
  assert.match((await run(storage, 'book', {})).text, /^Nothing in the house’s book yet\./);
  assert.match((await run(storage, 'book', { words: 'the plumber is Dave on 07700 900123' })).text, /^Kept in the house’s book: Plumber: Dave, 07700 900123\./);
  await run(storage, 'book', { words: 'landlord: Mrs Patel 0121 496 0000' });
  assert.equal((await run(storage, 'book', { words: 'who’s my plumber?' })).text, 'Plumber: Dave, 07700 900123');
  assert.match((await run(storage, 'book', {})).text, /^The house’s book:\n- Plumber: Dave, 07700 900123\n- Landlord: Mrs Patel/);
  assert.match((await run(storage, 'book', { words: 'forget the plumber' })).text, /^Forgot that entry\./);
  assert.match((await run(storage, 'book', { words: 'who’s my electrician?' })).text, /^The house’s book:\n- Landlord/);
});

test('council tax and the register: the band is public and its ratios are facts, the lookup is GOV.UK’s own form; only HIS registration is noted, and said not to be checkable', async () => {
  assert.equal(S.parseBand('my council tax band is C'), 'C');
  assert.equal(S.parseBand('we are in Band d'), 'D');
  assert.equal(S.parseBand('nothing'), '');
  assert.match(S.bandWords('C'), /^Band C pays 89% of the Band D rate \(England; Wales and Scotland differ\)$/);
  const reverse = JSON.parse(fixture('postcodes-reverse.json'));
  const net = fakeFetch({ 'https://api.postcodes.io/postcodes': reverse });
  const storage = new Mem();
  storage.m.set('places', [{ id: 'home', label: 'Home', query: 'B2 4BF', address: 'x', lat: 52.4778, lon: -1.8985, at: 0 }]);
  const none = await run(storage, 'council', {}, NOW, net);
  assert.match(none.text, /^Council tax band: not kept\. The band of a home is public: GOV\.UK’s “find your council tax band” takes your postcode \(https:\/\/www\.tax\.service\.gov\.uk\/check-council-tax-band\/search\); I can’t fill that form for you\./);
  assert.match(none.text, /Electoral register: I don’t know if you are on it\. It isn’t searchable online; Birmingham council’s electoral services can tell you, and you can register \(or re-register\) at https:\/\/www\.gov\.uk\/register-to-vote\. I only ever note your own registration, never anyone else’s\./);
  const kept = await run(storage, 'council', { words: 'my council tax band is C and I registered to vote on 3 September 2025' }, NOW, net);
  assert.match(kept.text, /^Kept: your council tax band is C\. Band C pays 89% of the Band D rate/);
  assert.match(kept.text, /Kept: you registered to vote on Wed 3 Sep 2025\. That is only your own note\./);
  assert.match(kept.text, /The register isn’t searchable online, so I can’t check it: ask Birmingham council’s electoral services/);
  assert.match(kept.text, /Your council, from your home's postcode: Birmingham\./);
  assert.match((await run(new Mem(), 'council', {})).text, /^Council tax band: not kept\./);
});

test('a boiler or smoke-alarm service: due or done (the next a year on), a month before and on the day; forgotten with its reminders', async () => {
  assert.deepEqual(S.parseService('boiler service is due 14 March 2027', '2026-11-01'), { what: 'Boiler service', next: '2027-03-14', every: 12 });
  assert.deepEqual(S.parseService('smoke alarms tested on 1 October 2026', '2026-11-01'), { what: 'Smoke alarm test', next: '2027-10-01', every: 12, last: '2026-10-01' });
  assert.deepEqual(S.parseService('electrical safety check was done 5 June 2026', '2026-11-01'), { what: 'Electrical safety check', next: '2031-06-05', every: 60, last: '2026-06-05' });
  assert.equal(S.parseService('the weather is nice', '2026-11-01'), null);
  const storage = new Mem();
  assert.match((await run(storage, 'service', {})).text, /^Tell me a date:/);
  const out = await run(storage, 'service', { words: 'boiler service is due 14 March 2027' });
  assert.match(out.text, /^Kept: Boiler service, next due Sun 14 Mar 2027\. I’ll remind you a month before and on the day, at 9am/);
  assert.deepEqual(await reminders(storage), [['Service: Boiler service', '2027-02-12T09:00'], ['Service: Boiler service', '2027-03-14T09:00']]);
  const done = await run(storage, 'service', { words: 'smoke alarms tested on 1 October 2026' });
  assert.match(done.text, /next due Fri 1 Oct 2027 \(done Thu 1 Oct, every year\)/);
  assert.deepEqual(await P.packLines({ storage, now: () => Date.UTC(2027, 2, 13, 12, 0) }), ['Boiler service is due tomorrow']);
  assert.match((await run(storage, 'service', { words: 'forget the boiler service' })).text, /^Forgot Boiler service, and its reminders\./);
  assert.equal((await reminders(storage)).filter(([t]) => t === 'Service: Boiler service').length, 0);
});

test('what is due at home: bills, bins, a car’s MOT month, insurance, a service, the rent and a warranty ending — in date order, nothing invented', async () => {
  const storage = new Mem();
  assert.match((await run(storage, 'due', {})).text, /^Nothing due at home in the next 30 days that I know of\./);
  await run(storage, 'bill', { text: GAS });
  await run(storage, 'bins', { words: 'bins are Tuesday' });
  await CARS.saveCar(storage, { whose: 'Dad', plate: 'AB12 CDE' }, NOW);
  await CARS.setMonths(storage, 'AB12CDE', { mot: '2026-11' });
  await run(storage, 'service', { words: 'boiler service is due 20 November 2026' });
  await run(storage, 'rent', { words: 'rent is due on the 1st, £750' });
  await run(storage, 'warranty', { words: 'kettle bought 25 November 2025, 1 year warranty' });
  const out = await run(storage, 'due', { days: 45 });
  const lines = out.text.split('\n').slice(1);
  assert.ok(lines[0].startsWith('- Sun 1 Nov: Dad\'s car: MOT due November 2026'), lines[0]);
  assert.ok(lines.some((l) => /Tue 3 Nov: Rubbish bin collected/.test(l)));
  assert.ok(lines.some((l) => /Sat 14 Nov: British Gas £84\.20 due Sat 14 Nov/.test(l)));
  assert.ok(lines.some((l) => /Fri 20 Nov: Boiler service due/.test(l)));
  assert.ok(lines.some((l) => /Tue 24 Nov: Kettle warranty ends/.test(l)));
  assert.ok(lines.some((l) => /Tue 1 Dec: Rent due \(£750\)/.test(l)));
  const dates = out.data.lines.map((l) => l.on);
  assert.deepEqual(dates, [...dates].sort());
  assert.equal(out.cards[0].id, 'home:due');
  assert.match((await run(storage, 'due', { days: 3 })).text, /^Due at home in the next 3 days:/);
});

test('the phone’s own phrases for the home sheet, and the group: on by his words about the house, off for small talk; reads for jobs, writes wait; the cards go to the chat', async () => {
  const asked = { 'when are the bins?': 'bins', 'Which bin is it tonight?': 'bins', 'bin day': 'bins', "what's due at home?": 'due', 'my bills': 'bills', 'take a meter reading': 'meter', 'home inventory': 'things', hello: null, 'bills of exchange': null };
  for (const [t, v] of Object.entries(asked)) assert.equal(S.homeAsked(t), v, t);
  const I = await bundles(['src/tools/index.ts']);
  const g = I['src/tools/index.ts'].TOOL_GROUPS.find((x) => x.name === 'homeadmin');
  assert.equal(g.short, 'home pack');
  assert.equal(g.tools[0].name, 'home');
  assert.deepEqual(Object.keys(T.HOME), ['bill', 'bills', 'paid', 'warranty', 'manual', 'renewals', 'bins', 'planning', 'meter', 'rent', 'subs', 'inventory', 'book', 'council', 'service', 'due']);
  for (const t of ['a photo of my gas bill', 'bin day is tuesday', 'my council tax band', 'the warranty on the washing machine', 'what is due at home', 'the boiler service is due in march', 'meter reading', 'rent is due on the 1st']) assert.ok(g.when.test(t), t);
  for (const t of ['hello', 'what time is it', 'how are you', 'thanks', 'tell me a joke']) assert.ok(!g.when.test(t), t);
  const tool = T.homeAdminTools[0];
  const { ctx } = ctxOf(new Mem());
  ctx.unattended = true;
  for (const w of ['bill', 'paid', 'warranty', 'manual', 'renewals', 'bins', 'planning', 'meter', 'rent', 'inventory', 'book', 'council', 'service']) await assert.rejects(tool.run({ action: w, words: 'x', text: 'x' }, ctx), /waits for him/, w);
  for (const r of ['bills', 'subs', 'due']) assert.equal(tool.pure({ action: r }), true, r);
  assert.match(await tool.run({ action: 'due' }, ctx), /^Nothing due at home/);
  const live = ctxOf(new Mem());
  await tool.run({ action: 'bill', text: GAS }, live.ctx);
  const cards = C.cardsFromTool({ name: 'home', args: {}, result: '', shown: live.events.map((e) => ({ name: e.name, args: e.args })) });
  assert.match(cards[0].title, /^British Gas/);
  const r = await P.packsRoute(new Request('http://x/packs/do', { method: 'POST', body: JSON.stringify({ pack: 'homeadmin', action: 'bills', args: {} }) }), '/packs/do', 'POST', { storage: new Mem(), notify: async () => undefined, fetch: fakeFetch({}), now: () => NOW });
  assert.equal(r.status, 200);
  assert.match((await r.json()).text, /^No bills kept yet\./);
});
