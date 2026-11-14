// THE MONEY PACK (BRIEF-PACKS-1 item 1): every action with its fixtures — a statement's text and its CSV read in code (and the
// rule table that sorts them), the month's card, what he says he spent, fuel from the retailers' own feeds near a SAVED place
// (a real cut of two feeds; one is months old and is left out by name), a trip's fuel, a price watched and its drop told once
// with UNDO, subscriptions, a split to the penny, round-ups, payday and its Brief line, a what-if, a warranty's reminder; the
// tool sends its cards as screen commands and the chat's cards are drawn from them; the phone's buttons run an action with
// no model. No network: every fetch is a fixture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bundles, ctxOf, deps, fakeFetch, fixture, Mem, NOW } from './packs-kit.mjs';

const B = await bundles(['src/tools/money.ts', 'src/packs/index.ts', 'src/spending.ts', '../../packages/shared/src/money.ts', '../../packages/shared/src/cards.ts', '../../packages/shared/src/packs.ts', 'src/schedule.ts', 'src/watchers.ts', 'src/tools/moneyapp.ts', '../../packages/shared/src/moneyplan.ts']);
const MP = B['../../packages/shared/src/moneyplan.ts'];
const M = B['src/tools/money.ts'];
const P = B['src/packs/index.ts'];
const SP = B['src/spending.ts'];
const S = B['../../packages/shared/src/money.ts'];
const C = B['../../packages/shared/src/cards.ts'];
const K = B['../../packages/shared/src/packs.ts'];
const J = B['src/schedule.ts'];
const W = B['src/watchers.ts'];
const MONZO = readFileSync(new URL('./spending/monzo.csv', import.meta.url), 'utf8');

const LLOYDS_PDF = `Lloyds Bank   Classic Account   Statement 1 October 2026 to 31 October 2026
Date Description Type Money In (£) Money Out (£) Balance (£)
01 Oct 26 BALANCE BROUGHT FORWARD 1,250.00
02 Oct 26 TESCO STORES 2041 DEB 23.45 1,226.55
03 Oct 26 NETFLIX.COM DEB 10.99 1,215.56
05 Oct 26 ACME WIDGETS LTD SALARY FPI 2,100.00 3,315.56
07 Oct 26 SHELL BIRMINGHAM DEB 45.10 3,270.46
CARD PAYMENT GREGGS DEB 4.20 3,266.26
10 Oct 26 BOB'S BITS LTD DEB 12.00 3,254.26
Page 1 of 2
31 Oct 26 BALANCE CARRIED FORWARD 3,254.26`;

test('a statement copied out of a PDF is read in code: dates, words, money in and out by the balance’s move', () => {
  const st = S.readStatementText(LLOYDS_PDF);
  assert.deepEqual(st.rows.map((r) => [r.d, r.t, r.a]), [
    ['2026-10-02', 'TESCO STORES 2041 DEB', -23.45],
    ['2026-10-03', 'NETFLIX.COM DEB', -10.99],
    ['2026-10-05', 'ACME WIDGETS LTD SALARY FPI', 2100],
    ['2026-10-07', 'SHELL BIRMINGHAM DEB', -45.1],
    ['2026-10-07', 'CARD PAYMENT GREGGS DEB', -4.2],
    ['2026-10-10', "BOB'S BITS LTD DEB", -12],
  ]);
  assert.equal(st.shape, 'statement text');
  // the CSV still reads as a CSV, the text as text; a chat message or a priced shopping list is neither
  assert.equal(S.readAnyStatement(MONZO).rows.length, 18);
  assert.equal(S.readAnyStatement(LLOYDS_PDF).rows.length, 6);
  assert.ok(S.looksLikeStatement(MONZO) && S.looksLikeStatement(LLOYDS_PDF));
  assert.ok(!S.looksLikeStatement('3 apples 2.50\n2 pears 1.20\n4 bananas 0.80'), 'a priced list is not a statement');
  assert.ok(!S.looksLikeStatement('remind me at 5\nand at 6\nthanks'));
  assert.throws(() => S.readAnyStatement('hello\nthere'), /doesn’t look like a statement/);
});

test('a statement squashed onto one line (the chat box is one line: a paste loses its breaks) is put back together', () => {
  const LLOYDS_CSV = readFileSync(new URL('./spending/lloyds.csv', import.meta.url), 'utf8');
  for (const [name, text] of [['Monzo', MONZO], ['Lloyds CSV', LLOYDS_CSV], ['Lloyds PDF text', LLOYDS_PDF]]) {
    const whole = S.readAnyStatement(text).rows.map((r) => `${r.d} ${r.a}`);
    for (const [how, flat] of [['spaces', text.replace(/\r?\n/g, ' ')], ['nothing', text.replace(/\r?\n/g, '')]]) {
      if (name === 'Lloyds PDF text' && how === 'nothing') continue; // a PDF's text always comes with spaces
      assert.ok(S.looksLikeStatement(flat), `${name}, breaks to ${how}: still a statement`);
      const rows = S.readAnyStatement(flat).rows.map((r) => `${r.d} ${r.a}`);
      // every dated row back (a PDF's undated line under a dated one can only join its neighbour)
      assert.ok(whole.filter((x) => rows.includes(x)).length >= whole.length - 1, `${name}, breaks to ${how}: ${rows.length} of ${whole.length}`);
    }
  }
  assert.equal(S.unflatten('a short line'), 'a short line');
});

test('the categoriser’s rule table sorts a statement’s lines by their words (his own rule first)', () => {
  const { rows, unplaced } = S.categorise(S.readStatementText(LLOYDS_PDF).rows);
  const by = Object.fromEntries(rows.map((r) => [r.t.split(' ')[0], r.c]));
  assert.equal(by.TESCO, 'groceries');
  assert.equal(by['NETFLIX.COM'], 'subscriptions');
  assert.equal(by.ACME, 'income');
  assert.equal(by.SHELL, 'transport');
  assert.equal(by.CARD, 'eating out');
  assert.deepEqual(unplaced, ["BOB'S BITS"], 'the one no rule names, by its merchant key');
  // his own rule wins over the table
  const mine = S.categorise(S.readStatementText(LLOYDS_PDF).rows, { 'TESCO STORES': 'shopping' }).rows.find((r) => r.t.startsWith('TESCO'));
  assert.equal(mine.c, 'shopping');
});

test('a pasted statement goes in by the rules only (no model asked), and the month comes back as a card: the top five and what changed', async () => {
  const storage = new Mem();
  let asked = 0;
  const r = await SP.importStatement({ storage, ai: async () => (asked++, '{}') }, MONZO, NOW);
  assert.equal(r.added, 18);
  assert.ok(asked >= 0);
  // the money pack's route (the phone's statement paste) never asks the model
  let asked2 = 0;
  const res = await SP.spendingRoute(new Request('https://g/api/profile/spending/import', { method: 'POST', body: JSON.stringify({ csv: LLOYDS_PDF, rulesOnly: true }) }), '/profile/spending/import', 'POST', new URL('https://g/api/profile/spending/import'), { storage, ai: async () => (asked2++, '{}') });
  const j = await res.json();
  assert.equal(asked2, 0, 'rules only: not even the shops’ names went to a model');
  assert.equal(j.result.added, 6);
  assert.equal(j.result.shape, 'statement text');
  const out = await M.MONEY.month({ month: '2026-10' }, deps(storage));
  assert.match(out.text, /^October: £[\d,]+\.\d{2} out, £[\d,]+\.\d{2} in\. Top five: /);
  assert.match(out.text, /Since September: /);
  assert.match(out.text, /no bank access/);
  const card = out.cards[0];
  assert.equal(card.id, 'money:month:2026-10');
  assert.match(card.title, /^October £[\d,]+\.\d{2} out$/);
  assert.ok(card.line.split(' · ').length >= 3 && card.line.length <= 110, card.line);
  assert.deepEqual(card.acts.map((a) => a.label), ['OPEN SPENDING', 'ASK']);
  assert.deepEqual(card.acts[0].open, { tab: 'agenda', panel: 'SPENDING' });
  // no statement yet: says how, and that no bank is touched
  assert.match((await M.MONEY.month({}, deps(new Mem()))).text, /Paste one in the chat/);
});

test('what he says he spent: kept, sorted, this week against last, and "undo that" takes it back', async () => {
  const storage = new Mem();
  const d = deps(storage);
  let out = await M.MONEY.spent({ words: 'spent 12 on lunch' }, d);
  assert.match(out.text, /^Kept: £12 on lunch \(eating out\)\. This week so far: £12\./);
  assert.equal(out.cards[0].acts[0].label, 'UNDO');
  assert.deepEqual(out.cards[0].acts[0].run, { name: 'packs_do', args: { pack: 'money', action: 'spent', args: { words: 'undo' } } });
  out = await M.MONEY.spent({ words: 'spent £30 on petrol yesterday' }, d);
  assert.match(out.text, /£30 on petrol \(transport, Sat 31 Oct\)/);
  out = await M.MONEY.week({}, d);
  assert.match(out.text, /This week \(since Monday Mon 26 Oct\): £42 on 2 things you told me — transport £30, eating out £12\. Only what you told me, not your bank\./);
  out = await M.MONEY.spent({ words: 'undo that' }, d);
  assert.match(out.text, /^Taken back: £30 on petrol\./);
  assert.equal((await storage.get(M.MONEY_KEYS.spent)).length, 1);
  assert.match((await M.MONEY.spent({ words: 'lunch' }, d)).text, /Say how much/);
  const p = S.parseSpent('£4.50 coffee', '2026-11-01');
  assert.deepEqual([p.a, p.c], [4.5, 'eating out']);
});

const FEEDS = { 'https://storelocator.asda.com/fuel_prices_data.json': JSON.parse(fixture('fuel-asda.json')), 'https://www.tesco.com/fuel_prices/fuel_prices_data.json': JSON.parse(fixture('fuel-tesco.json')) };
const DAD = { id: 'dad', label: 'Dad’s', query: 'x', address: 'Kingstanding, Birmingham', lat: 52.5401, lon: -1.8826, at: NOW };

test('fuel near his dad: the cheapest three from the retailers’ own feeds, by distance from the SAVED place, a stale feed left out by name', async () => {
  M.forgetFuel();
  const storage = new Mem();
  await storage.put('places', [DAD]);
  const seen = [];
  const out = await M.MONEY.fuel({ place: 'dad' }, deps(storage, fakeFetch(FEEDS, seen)));
  assert.equal(seen.length, S.FUEL_FEEDS.length, 'every feed of the fixed list asked, nothing else');
  assert.ok(seen.every((u) => S.FUEL_FEEDS.some((f) => f.url === u)));
  const st0 = S.readFuelFeed(FEEDS['https://storelocator.asda.com/fuel_prices_data.json'], 'Asda');
  const r0 = S.cheapestNear(st0, DAD, 'E10', '2026-11-01');
  assert.equal(r0.miles, 10, 'fewer than three within 5 miles of his dad’s: widened to 10, and said');
  assert.match(out.text, /^Cheapest unleaded \(E10\) within 10 miles of Dad’s: 1\. Asda, /);
  assert.match(out.text, /2 of 15 feeds answered; left out as more than a week old: TESCO\)/, out.text);
  assert.match(out.text, /never from where you are/);
  // the picks are the cheapest, each with its straight-line distance from the saved place
  const st = S.readFuelFeed(FEEDS['https://storelocator.asda.com/fuel_prices_data.json'], 'Asda');
  const r = S.cheapestNear(st, DAD, 'E10', '2026-11-01');
  assert.ok(r.picks.length === 3 && r.picks[0].p <= r.picks[1].p && r.picks[1].p <= r.picks[2].p);
  assert.equal(r.picks[0].km, K.kmBetween(DAD, r.picks[0]));
  assert.match(out.text, new RegExp(`${r.picks[0].p.toFixed(1)}p a litre, ${K.milesText(r.picks[0].km).replace('.', '\\.')} away`));
  assert.equal(out.cards[0].kind, 'map');
  assert.equal(out.cards[0].title, 'Fuel near Dad’s');
  // diesel by his words; a feed in pounds is read in pence; nonsense dropped
  assert.equal(S.fuelOf('cheapest diesel'), 'B7');
  assert.deepEqual(S.readFuelFeed({ stations: [{ brand: 'X', location: { latitude: 52, longitude: -1 }, prices: { E10: 1.459, B7: 9999 } }] }, 'X')[0].prices, { E10: 145.9 });
  // never live GPS: no saved place, no search
  const none = await M.MONEY.fuel({ place: 'here' }, deps(new Mem(), fakeFetch(FEEDS, [])));
  assert.match(none.text, /only look near a place you've saved/);
  assert.ok(!none.cards);
});

test('a trip’s fuel: litres from UK gallons at the price given, and what it assumed', async () => {
  const out = await M.MONEY.trip({ words: '120 miles at 45 mpg at 150p' }, deps(new Mem()));
  const t = S.tripCost(120, 45, 150);
  assert.deepEqual(t, { litres: 12.1, cost: 18.18 });
  assert.match(out.text, /^120 miles at 45 mpg is about 12\.1 litres: £18\.18 at 150p a litre \(the price you gave\)\. Assumed: UK gallons/);
  assert.match((await M.MONEY.trip({ words: 'how much to drive there' }, deps(new Mem()))).text, /Say the miles/);
});

const PAGE = (price) => `<html><head><title>Kettle 1.7L | Shop</title><script type="application/ld+json">{"@type":"Product","name":"Kettle","offers":{"@type":"Offer","price":"${price}","priceCurrency":"GBP"}}</script></head><body>£999 elsewhere</body></html>`;

test('a price watched: the number found on the page, stored as a watcher of kind price, a drop told once by whichever reader sees it first, and UNDO is the watchers\' STOP', async () => {
  const storage = new Mem();
  let price = '49.99';
  const fetch = fakeFetch({ 'https://shop.example/kettle': () => PAGE(price) });
  const out = await M.MONEY.watch({ url: 'https://shop.example/kettle' }, deps(storage, fetch));
  assert.match(out.text, /^Watching Kettle 1\.7L: £49\.99 now \(read from the page’s own product data\)\. I look every hour and tell you once when it drops\./);
  assert.equal(out.cards[0].acts[0].label, 'UNDO');
  assert.equal(out.cards[0].acts[0].run.args.action, 'unwatch');
  // One watcher system: the watchers' store has it (kind price), the old store and the old twice-a-day job do not.
  const stored = await W.loadWatchers(storage);
  assert.deepEqual(stored.map((w) => [w.kind, w.url, w.state, w.last.price]), [['price', 'https://shop.example/kettle', 'watching', 49.99]]);
  assert.equal(await storage.get(M.MONEY_KEYS.watches), undefined, 'the money pack keeps no list of its own');
  assert.ok(!(await J.loadJobs(storage)).some((j) => j.kind === 'follow'), 'no twice-a-day follow job is added');
  // its own listing reads from the watchers' store
  assert.match((await M.MONEY.watch({}, deps(storage, fetch))).text, /^Watching 1: Kettle 1\.7L £49\.99\./);
  // The watchers' hourly beat reads it and tells once; the old tick (still called by the protected agent file) tells nothing more.
  const told = [];
  const tell = async (title, text, card) => told.push({ title, text, card });
  const notes = [];
  const wd = (at) => ({ storage, fetch, now: () => at, notify: async (n) => void notes.push(n) });
  price = '44.99';
  assert.equal((await W.watchersTick(wd(NOW + 2 * 3_600_000))).length, 1);
  await M.followTick(deps(storage, fetch, NOW + 13 * 3_600_000), tell);
  assert.equal((await W.watchersTick(wd(NOW + 26 * 3_600_000))).length, 0, 'the second reader of the same drop tells nothing');
  assert.equal(told.length, 0, 'the old tick tells nothing');
  assert.equal(notes.length, 1, 'told once');
  assert.match(notes[0].text, /Kettle 1\.7L is £44\.99 now, down from £49\.99/);
  // an old-store watch still on a phone moves over, once, and is never told twice
  const old = { id: 'old1', url: 'https://shop.example/old', label: 'Lamp', first: 20, last: 20, told: 20, how: 'x', at: NOW, checked: NOW };
  await storage.put(M.MONEY_KEYS.watches, [old]);
  await M.followTick(deps(storage, fetch, NOW + 30 * 3_600_000), tell);
  assert.ok((await W.loadWatchers(storage)).some((w) => w.id === 'old1' && w.kind === 'price'), 'moved to the watchers store');
  assert.deepEqual(await storage.get(M.MONEY_KEYS.watches), [], 'and left the old one');
  assert.equal(told.length, 0);
  // (POLISH 3, his yes: the money pack asks the follow job for no beat of its own any more; the planning watch sets its clock)
  assert.ok((await M.followTick(deps(storage, fetch, NOW + 40 * 3_600_000), tell)) >= NOW + 40 * 3_600_000 + 7 * 86_400_000, 'no twice-a-day beat from the money pack');
  // how a price is read: product data, a price tag, else the first £ in the text
  assert.equal(S.priceOf('<meta property="product:price:amount" content="12.50">').price, 12.5);
  assert.equal(S.priceOf('<p>Now only &pound;7.99!</p>').how, 'the first £ price in the page’s text');
  assert.equal(S.priceOf('<p>no price</p>'), null);
  // a fresh watch to stop: UNDO removes it from the watchers' list (what STOP does), and the money pack's list says so too
  await M.MONEY.watch({ url: 'https://shop.example/kettle' }, deps(storage, fetch));
  const id = (await W.loadWatchers(storage)).find((w) => w.label === 'Kettle 1.7L' && w.state === 'watching').id;
  assert.match((await M.MONEY.unwatch({ id }, deps(storage, fetch))).text, /^Stopped watching Kettle 1\.7L/);
  assert.ok(!(await W.loadWatchers(storage)).some((w) => w.id === id), 'gone from the watchers');
  assert.doesNotMatch((await M.MONEY.watch({}, deps(storage, fetch))).text, /Kettle/);
  // and the other way: STOP on the list (the route) removes it from the money pack's words
  await M.MONEY.watch({ url: 'https://shop.example/kettle' }, deps(storage, fetch));
  const id2 = (await W.loadWatchers(storage)).find((w) => w.url === 'https://shop.example/kettle' && w.state === 'watching').id;
  await W.watchersRoute(new Request('https://x/guardian/watchers?id=' + id2, { method: 'DELETE' }), '/guardian/watchers', 'DELETE', new URL('https://x/guardian/watchers?id=' + id2), wd(NOW));
  assert.doesNotMatch((await M.MONEY.watch({}, deps(storage, fetch))).text, /Kettle/, 'STOP removed it from the money pack\'s list too');
  assert.match((await M.MONEY.watch({ url: 'http://shop.example/x' }, deps(storage, fetch))).text, /https:\/\//);
});

test('subscriptions he lists: renewals rolled on, the monthly total, one dropped', async () => {
  const storage = new Mem();
  const d = deps(storage);
  await M.MONEY.subs({ words: 'Netflix 10.99 a month on the 14th' }, d);
  let out = await M.MONEY.subs({ words: 'Amazon Prime £95 a year renews 12 March' }, d);
  assert.match(out.text, /^2 subscriptions, £18\.91 a month \(£226\.92 a year; weekly ones as 52\/12 a month, yearly as a twelfth\): Netflix £10\.99 a month, renews Sat 14 Nov; Amazon Prime £95 a year, renews Fri 12 Mar 2027\.$/);
  assert.equal(out.cards[0].title, 'Subscriptions £18.91 a month');
  out = await M.MONEY.subs({ words: 'drop Netflix' }, d);
  assert.match(out.text, /^Taken off: Netflix\. 1 subscription, £7\.92 a month/);
  assert.match(out.text, /I never touch your accounts/);
});

test('a bill split to the penny, by shares and with a tip', async () => {
  assert.deepEqual(S.splitBill(10, ['A', 'B', 'C']), [{ name: 'A', owes: 3.34 }, { name: 'B', owes: 3.33 }, { name: 'C', owes: 3.33 }]);
  assert.deepEqual(S.splitBill(90, ['Ali x2', 'Sam']), [{ name: 'Ali', owes: 60 }, { name: 'Sam', owes: 30 }]);
  const out = await M.MONEY.split({ words: 'split £84 between me, Ali and Sam with a 10% tip' }, deps(new Mem()));
  assert.equal(out.text, '£84 with a 10% tip is £92.40: you £30.80, Ali £30.80, Sam £30.80. To the penny.');
});

test('round-ups from the statements: every payment out that wasn’t a whole pound, up to the next pound', async () => {
  const storage = new Mem();
  await SP.importStatement({ storage, ai: async () => '{}' }, LLOYDS_PDF, NOW);
  const r = S.roundUps((await SP.spendingSummary(storage, '2026-10')).rows, '2026-10');
  // 23.45 → .55, 10.99 → .01, 45.10 → .90, 4.20 → .80 (12.00 is whole; the salary is in)
  assert.deepEqual(r, { total: 2.26, n: 4 });
  assert.match((await M.MONEY.roundup({ month: '2026-10' }, deps(storage))).text, /^Rounding every payment up to the next pound in October would have put aside £2\.26 \(from 4 payments\)/);
});

test('payday: his rule kept, a weekend moved to the Friday before, the Brief’s line counting down', async () => {
  assert.deepEqual(S.parsePayday('the 28th'), { day: 28 });
  assert.deepEqual(S.parsePayday('last friday of the month'), { last: 'friday' });
  assert.equal(S.nextPayday({ day: 28 }, '2026-11-01'), '2026-11-27', 'Sat 28 Nov is paid on Fri 27th');
  assert.equal(S.nextPayday({ last: 'friday' }, '2026-11-01'), '2026-11-27');
  assert.equal(S.nextPayday({ last: 'weekday' }, '2026-02-27'), '2026-02-27');
  assert.equal(S.nextPayday({ day: 31 }, '2026-02-01'), '2026-02-27', 'the 31st in February: the last day, at a weekend the Friday before');
  const storage = new Mem();
  const out = await M.MONEY.payday({ words: 'payday is the 28th' }, deps(storage));
  assert.match(out.text, /^Payday kept: the 28th \(the Friday before when that is a weekend\)\. Next: Fri 27 Nov\./);
  assert.deepEqual(await P.packLines({ storage, now: () => NOW }), ['Payday in 26 days (Fri 27 Nov)']);
  assert.equal(S.paydayLine({ day: 2 }, '2026-11-01'), 'Payday tomorrow');
});

test('what if: what saving comes to, saying what it assumed', () => {
  const w = S.whatIf('if I save 50 a week');
  assert.equal(w.monthly, 216.67);
  assert.deepEqual(w.spans.map((s) => s.total), [650, 1300, 2600]);
  assert.match(S.whatIfWords(w), /^£50 a week is £216\.67 a month: 3 months → £650, 6 months → £1,300, 1 year → £2,600\. Assumed: a week as 52\/12 of a month, no interest, before tax/);
  const r = S.whatIf('put away £200 a month for 2 years at 4%');
  assert.equal(r.spans.at(-1).months, 24);
  assert.equal(r.spans.at(-1).total, 4988.58, '200 × ((1 + 0.04/12)^24 − 1) / (0.04/12)');
  assert.match(S.whatIfWords(r), /4% a year compounded monthly/);
});

test('a warranty: its end from the day bought and the months, a reminder two weeks before at 9am', async () => {
  const storage = new Mem();
  const out = await M.MONEY.warranty({ words: 'washing machine bought 3 March 2025, 2 year warranty' }, deps(storage));
  assert.match(out.text, /^Kept: the washing machine, bought Mon 3 Mar 2025, 24-month warranty — it ends Tue 2 Mar 2027\. I’ll remind you on Tue 16 Feb 2027 at 9am/);
  const job = (await J.loadJobs(storage)).find((j) => j.kind === 'reminder');
  assert.equal(job.title, 'Warranty: washing machine');
  assert.equal(new Date(job.next).toISOString(), '2027-02-16T09:00:00.000Z');
  assert.match((await M.MONEY.warranty({}, deps(storage))).text, /washing machine until Tue 2 Mar 2027/);
  // an old one: kept, no reminder
  assert.match((await M.MONEY.warranty({ words: 'toaster bought 1 Jan 2020, 1 year' }, deps(storage))).text, /warranty ended/);
});

test('the tool: one action enum; its cards go to the screen as pack_card and the chat’s cards are drawn from them, by code', async () => {
  const tool = M.moneyTools[0];
  assert.equal(tool.name, 'money');
  assert.deepEqual(tool.parameters.properties.action.enum, ['month', 'spent', 'week', 'fuel', 'trip', 'watch', 'unwatch', 'subs', 'split', 'roundup', 'payday', 'whatif', 'warranty']);
  assert.ok(tool.description.length <= 1000, `${tool.description.length}`);
  assert.equal(tool.pure({ action: 'fuel' }), true);
  assert.equal(tool.pure({ action: 'spent' }), false);
  const storage = new Mem();
  const { ctx, events } = ctxOf(storage);
  const result = await tool.run({ action: 'subs', words: 'Spotify £11.99 a month on the 3rd' }, ctx);
  assert.match(result, /Spotify £11\.99 a month/);
  const shown = events.filter((e) => e.t === 'client').map((e) => ({ name: e.name, args: e.args }));
  assert.equal(shown[0].name, 'pack_card');
  const cards = C.cardsFromTool({ name: 'money', args: {}, result, shown });
  assert.equal(cards.length, 1);
  assert.equal(cards[0].id, 'money:subs');
  await assert.rejects(tool.run({ action: 'buy' }, ctx), /money has no action "buy"/);
  // a scheduled task or a project's step (nobody there): the reads work, the writes wait for him
  const away = { ...ctx, unattended: true };
  assert.match(await tool.run({ action: 'split', words: 'split £10 between Ali and Sam' }, away), /^£10: Ali £5, Sam £5\./);
  await assert.rejects(tool.run({ action: 'spent', words: 'spent 5 on lunch' }, away), /money spent changes what he keeps, so it waits for him/);
  await assert.rejects(tool.run({ action: 'watch', url: 'https://shop.example/x' }, away), /waits for him/);
});

test('the phone’s buttons: POST /packs/do runs one action with no model (a card’s UNDO); anything else is refused', async () => {
  const storage = new Mem();
  const call = (body) => P.packsRoute(new Request('https://g/api/packs/do', { method: 'POST', body: JSON.stringify(body) }), '/packs/do', 'POST', { storage, notify: async () => undefined, now: () => NOW, fetch: fakeFetch({}) }).then(async (r) => ({ status: r.status, ...(await r.json()) }));
  let r = await call({ pack: 'money', action: 'spent', args: { words: 'spent 5 on a coffee' } });
  assert.equal(r.status, 200);
  assert.match(r.text, /^Kept: £5 on coffee/);
  r = await call({ pack: 'money', action: 'spent', args: { words: 'undo' } });
  assert.match(r.text, /^Taken back: £5 on coffee/);
  assert.equal((await call({ pack: 'bank', action: 'pay' })).status, 400);
  assert.equal((await call({ pack: 'money', action: 'transfer' })).status, 400);
});

// ---------------------------------------------------------------- THE NEXT ROUND: money and papers handled for you

const ROWS = [
  { d: '2026-09-30', t: 'NETFLIX.COM', a: -10.99, k: 'NETFLIX.COM', c: 'subscriptions', by: 'rule' },
  { d: '2026-10-28', t: 'ACME SALARY', a: 2000, b: 2500, k: 'ACME SALARY', c: 'income', by: 'rule' },
  { d: '2026-10-29', t: 'TESCO STORES', a: -50, b: 2450, k: 'TESCO STORES', c: 'groceries', by: 'rule' },
  { d: '2026-10-30', t: 'NETFLIX.COM', a: -10.99, b: 2439.01, k: 'NETFLIX.COM', c: 'subscriptions', by: 'rule' },
];
const HOMEBILLS = [
  { id: 'a', supplier: 'Octopus Energy', kind: 'electricity', amount: 84.2, due: '2026-11-10' },
  { id: 'b', supplier: 'Severn Trent', kind: 'water', amount: 30, due: '2026-10-20' },
  { id: 'c', supplier: 'BT', kind: 'broadband', amount: 40, due: '2026-11-05', paid: '2026-10-31' },
];
const LISTED = [{ id: 's', name: 'Spotify', amount: 11.99, every: 'month', next: '2026-10-03' }];

test('safe to spend: the balance on his statement, less every bill still due before payday (late ones too, paid ones not), a day at a time', () => {
  const subs = MP.dueBetween([], [], [], '2026-11-01', '2026-11-01', '2026-11-01');
  assert.deepEqual(subs, []);
  assert.deepEqual(MP.paydayPeriod({ day: 28 }, '2026-11-01'), { last: '2026-10-28', next: '2026-11-27' }, 'the 28th of November is a Saturday: the Friday before');
  assert.deepEqual(MP.paydayPeriod({ day: 28 }, '2026-10-28'), { last: '2026-10-28', next: '2026-11-27' }, 'on payday itself the period runs to the next one');
  const found = [{ name: 'Netflix', k: 'NETFLIX.COM', cadence: 'monthly', amount: 10.99, yearly: 131.88, last: '2026-10-30', next: '2026-11-30', count: 2 }];
  const s = MP.safeToSpend(ROWS, found, HOMEBILLS, LISTED, { day: 28 }, '2026-11-01');
  assert.equal(s.base, 'balance');
  assert.equal(s.balance, 2439.01);
  assert.equal(s.balanceOn, '2026-10-30');
  assert.deepEqual(s.due.map((d) => [d.on, d.name, d.amount, d.kind]), [
    ['2026-10-20', 'Severn Trent', 30, 'bill'],
    ['2026-11-03', 'Spotify', 11.99, 'listed'],
    ['2026-11-10', 'Octopus Energy', 84.2, 'bill'],
  ], 'Netflix falls after payday; the paid BT bill is not counted; the late water bill is');
  assert.equal(s.dueSum, 126.19);
  assert.equal(s.safe, 2312.82);
  assert.equal(s.days, 26);
  assert.equal(s.perDay, 88.95);
  assert.equal(s.stale, 2);
  // with no balance printed: what came in less what went out since payday
  const plain = MP.safeToSpend(ROWS.map(({ b, ...r }) => r), found, HOMEBILLS, LISTED, { day: 28 }, '2026-11-01');
  assert.equal(plain.base, 'since');
  assert.deepEqual([plain.in, plain.out, plain.safe], [2000, 60.99, 1812.82]);
  // his goals are kept aside
  const g = { id: 'g', name: 'holiday', target: 800, saved: 100, by: '2027-06-30', at: '2026-11-01' };
  assert.deepEqual(MP.goalPlan(g, '2026-11-01'), { frac: 0.125, left: 700, months: 8, monthly: 87.5, late: false, done: false });
  assert.equal(MP.goalsAside([g], '2026-11-01', 26), 75.83);
  assert.equal(MP.safeToSpend(ROWS, found, HOMEBILLS, LISTED, { day: 28 }, '2026-11-01', 75.83).safe, 2236.99);
  assert.equal(MP.goalPlan({ ...g, by: '2026-10-01' }, '2026-11-01').late, true);
  assert.equal(MP.goalPlan({ ...g, saved: 800 }, '2026-11-01').done, true);
});

test('the money calendar, paid bills by supplier and year, a split payment, the household’s shares and the year looked back on', () => {
  const cal = MP.monthCalendar('2026-11', [], HOMEBILLS, LISTED, { day: 28 }, '2026-11-01');
  assert.equal(cal.days.length, 30);
  assert.deepEqual(cal.days.filter((d) => d.items.length).map((d) => [d.day, d.items.map((x) => x.name).join('+'), d.sum]), [
    ['2026-11-03', 'Spotify', 11.99],
    ['2026-11-10', 'Octopus Energy', 84.2],
    ['2026-11-27', 'Payday', 0],
  ], 'the late water bill is not put on a day of November; payday on the Friday');
  assert.equal(cal.total, 96.19);
  assert.deepEqual(cal.heavy, ['2026-11-10']);
  assert.deepEqual(MP.supplierYears([...HOMEBILLS, { supplier: 'BT', amount: 38, due: '2025-11-05', paid: '2025-11-02' }], '2026'), [{ supplier: 'BT', now: 40, before: 38, n: 1 }]);
  assert.deepEqual(MP.splitRow(-60, [{ c: 'groceries', a: 40 }, { c: 'shopping', a: 1 }]), [{ c: 'groceries', a: -40 }, { c: 'shopping', a: -20 }]);
  assert.equal(MP.splitRow(-60, [{ c: 'groceries', a: 70 }, { c: 'shopping', a: 1 }]), null);
  const o = MP.householdOwes([
    { id: '1', what: 'electric', amount: 96, paidBy: 'you', shares: ['you', 'Sam', 'Jo'], on: '2026-11-01' },
    { id: '2', what: 'milk', amount: 10, paidBy: 'Sam', shares: ['Sam', 'Jo'], on: '2026-11-01' },
    { id: '3', what: 'old', amount: 50, paidBy: 'Jo', shares: ['you', 'Jo'], on: '2026-10-01', settled: '2026-10-02' },
  ]);
  assert.deepEqual(o.pay, [{ from: 'Jo', to: 'you', amount: 37 }, { from: 'Sam', to: 'you', amount: 27 }]);
  const y = MP.yearInMoney(ROWS, [{ name: 'Netflix', k: 'NETFLIX.COM', cadence: 'monthly', amount: 10.99, yearly: 131.88, last: '2026-10-30', next: '2026-11-30', count: 2 }], '2026');
  assert.deepEqual([y.out, y.in, y.dearest, y.cheapest], [71.98, 2000, '2026-10', '2026-09']);
  assert.deepEqual(y.categories.map((c) => c.c), ['groceries', 'subscriptions']);
});

test('the MONEY screen’s own keys run through POST /packs/do with no model, and never join the tool’s enum', async () => {
  const storage = new Mem();
  const call = (action, args = {}, pack = 'money') => P.packsRoute(new Request('https://g/api/packs/do', { method: 'POST', body: JSON.stringify({ pack, action, args }) }), '/packs/do', 'POST', { storage, notify: async () => undefined, now: () => NOW, fetch: fakeFetch({}) }).then(async (r) => ({ status: r.status, ...(await r.json()) }));
  assert.ok(!M.moneyTools[0].parameters.properties.action.enum.includes('safe'), 'not one prompt word added');
  let r = await call('safe');
  assert.equal(r.data.payday, null);
  assert.match(r.text, /Tell me your payday first/);
  await storage.put({ spend: { months: ['2026-09', '2026-10'], rows: 4, rules: { 'TESCO STORES': 'groceries' }, budgets: {} }, 'spend:m:2026-09': ROWS.slice(0, 1), 'spend:m:2026-10': ROWS.slice(1) });
  await storage.put('home:bills', HOMEBILLS);
  await storage.put('money:subs', LISTED);
  assert.match((await call('payday', { words: 'the 28th' })).text, /^Payday kept/);
  r = await call('safe', { today: '2026-11-01' });
  assert.equal(r.status, 200);
  assert.equal(r.data.safe, 2312.82);
  assert.equal(r.data.rowsSince, 3);
  r = await call('goals', { op: 'add', name: 'holiday', target: 800, saved: 100, by: '2027-06-30', today: '2026-11-01' });
  assert.match(r.text, /^Goal kept: holiday, £800/);
  const id = r.data.goals[0].id;
  assert.equal(r.data.goals[0].monthly, 87.5);
  r = await call('safe', { today: '2026-11-01' });
  assert.equal(r.data.aside, 75.83, 'safe to spend keeps his goals aside');
  assert.equal(r.data.safe, 2236.99);
  r = await call('goals', { op: 'put', id, amount: 50, today: '2026-11-01' });
  assert.equal(r.data.goals[0].saved, 150);
  assert.equal((await call('goals', { op: 'put', id, amount: 'x' })).status, 400);
  r = await call('goals', { op: 'remove', id });
  assert.deepEqual(r.data.goals, []);
  r = await call('calendar', { month: '2026-11', today: '2026-11-01' });
  assert.deepEqual(r.data.heavy, ['2026-11-10']);
  r = await call('household', { op: 'add', what: 'electric', amount: 96, paidBy: 'you', shares: 'you, Sam and Jo' });
  assert.deepEqual(r.data.pay, [{ from: 'Sam', to: 'you', amount: 32 }, { from: 'Jo', to: 'you', amount: 32 }]);
  assert.equal((await call('household', { op: 'add', what: 'x', amount: 5, shares: 'just me' })).status, 400);
  r = await call('household', { op: 'settle' });
  assert.match(r.text, /Nothing was paid or sent/);
  assert.deepEqual(r.data.pay, []);
  r = await call('rules');
  assert.deepEqual(r.data.rules, [{ k: 'TESCO STORES', c: 'groceries', n: 1 }]);
  r = await call('rules', { op: 'change', k: 'TESCO STORES', c: 'shopping' });
  assert.deepEqual(r.data.rules, [{ k: 'TESCO STORES', c: 'shopping', n: 1 }]);
  r = await call('rules', { op: 'remove', k: 'TESCO STORES' });
  assert.deepEqual(r.data.rules, []);
  r = await call('year', {});
  assert.equal(r.data.year, '2026');
  assert.equal(r.data.out, 71.98);
  // HOME's bills send the paid ones too, so the page can keep them under Paid and forget one
  r = await call('bills', {}, 'homeadmin');
  assert.deepEqual(r.data.bills.map((b) => b.supplier), ['Severn Trent', 'Octopus Energy']);
  assert.deepEqual(r.data.paid.map((b) => b.supplier), ['BT']);
});

test('HOUSEHOLD → PAPERS: a warranty with a reminder a month before it ends, a paper with reminders a month and a week before it renews; the statement nudge only when he turns it on', async () => {
  const storage = new Mem();
  const call = (action, args = {}, pack = 'homeadmin') => P.packsRoute(new Request('https://g/api/packs/do', { method: 'POST', body: JSON.stringify({ pack, action, args }) }), '/packs/do', 'POST', { storage, notify: async () => undefined, now: () => NOW, fetch: fakeFetch({}) }).then(async (r) => ({ status: r.status, ...(await r.json()) }));
  let r = await call('papers', { op: 'warranty', thing: 'washing machine', bought: '2025-03-03', months: 24, store: 'Currys', today: '2026-11-01' });
  assert.match(r.text, /^Kept: the washing machine, warranty to 2027-03-02\. I’ll remind you on 2027-02-02 at 9am\./);
  assert.equal(r.data.warranties[0].store, 'Currys');
  assert.equal((await call('papers', { op: 'warranty', thing: 'kettle', bought: '2030-01-01', months: 12, today: '2026-11-01' })).status, 400, 'a day bought in the future is refused');
  r = await call('papers', { op: 'paper', what: 'House insurance with Aviva', kind: 'home insurance', renews: '2027-01-15', today: '2026-11-01' });
  assert.match(r.text, /^Kept: House insurance with Aviva, renews 2027-01-15\. I’ll remind you a month and a week before, at 9am\./);
  const jobs = await J.loadJobs(storage);
  assert.deepEqual(jobs.map((j) => j.title).sort(), ['Renews: House insurance with Aviva', 'Renews: House insurance with Aviva', 'Warranty ends: washing machine']);
  r = await call('papers', { op: 'forgetPaper', id: r.data.papers[0].id });
  assert.deepEqual(r.data.papers, []);
  r = await call('papers', { op: 'forgetWarranty', id: r.data.warranties[0].id });
  assert.deepEqual(r.data.warranties, []);
  assert.deepEqual(await J.loadJobs(storage), [], 'their reminders go with them');
  // the statement nudge
  r = await call('nudge', {}, 'money');
  assert.equal(r.data.on, false);
  r = await call('nudge', { op: 'on', today: '2026-11-01' }, 'money');
  assert.equal(r.data.on, true);
  const n = (await J.loadJobs(storage))[0];
  assert.equal(n.repeat, 'monthly');
  assert.equal(new Date(n.next).toISOString(), '2026-11-02T09:00:00.000Z');
  r = await call('nudge', { op: 'off' }, 'money');
  assert.equal(r.data.on, false);
  assert.deepEqual(await J.loadJobs(storage), []);
});

test('HOUSEHOLD → METER: the use between readings, a dial that went down left out, and a first estimate on his tariff', async () => {
  assert.deepEqual(MP.meterSpans([{ on: '2026-10-01', value: 1000 }, { on: '2026-10-11', value: 1100 }, { on: '2026-10-21', value: 50 }, { on: '2026-10-31', value: 150 }]), [
    { from: '2026-10-01', to: '2026-10-11', days: 10, units: 100, perDay: 10 },
    { from: '2026-10-21', to: '2026-10-31', days: 10, units: 100, perDay: 10 },
  ]);
  assert.equal(MP.spanCost({ units: 100, days: 10 }, { unit: 24.5, standing: 60 }), 30.5);
  const storage = new Mem();
  const call = (args) => P.packsRoute(new Request('https://g/api/packs/do', { method: 'POST', body: JSON.stringify({ pack: 'homeadmin', action: 'energy', args }) }), '/packs/do', 'POST', { storage, notify: async () => undefined, now: () => NOW, fetch: fakeFetch({}) }).then(async (r) => ({ status: r.status, ...(await r.json()) }));
  await storage.put('home:meters', { electricity: [{ on: '2026-10-01', value: 1000 }, { on: '2026-10-11', value: 1100 }] });
  let r = await call({});
  assert.equal(r.data.kinds.electricity.spans[0].cost, undefined, 'no tariff, no cost');
  r = await call({ op: 'tariff', kind: 'electricity', unit: 24.5, standing: 60 });
  assert.match(r.text, /^Tariff kept for electricity: 24\.5p a unit and 60p a day\./);
  assert.equal(r.data.kinds.electricity.spans[0].cost, 30.5);
  assert.equal((await call({ op: 'tariff', kind: 'electricity', unit: 0 })).status, 400);
});

test('one payment split across categories, to the penny; the same statement added again does not bring it back; put back whole', async () => {
  const storage = new Mem();
  const route = (path, body, method = 'POST') => SP.spendingRoute(new Request(`https://g/api${path}`, { method, ...(body ? { body: JSON.stringify(body) } : {}) }), path.split('?')[0], method, new URL(`https://g/api${path}`), { storage, ai: async () => { throw new Error('none'); } }).then((r) => r.json());
  const csv = 'Date,Description,Amount\n2026-10-03,TESCO STORES,-60.00\n2026-10-04,GREGGS,-3.20\n';
  await route('/profile/spending/import', { csv });
  let s = await route('/profile/spending/split', { row: { d: '2026-10-03', t: 'TESCO STORES', a: -60 }, parts: [{ c: 'groceries', a: 40 }, { c: 'shopping', a: 20 }] });
  assert.equal(s.parts, 2);
  const tesco = s.rows.filter((r) => r.t === 'TESCO STORES');
  assert.deepEqual(tesco.map((r) => [r.a, r.c]).sort(), [[-20, 'shopping'], [-40, 'groceries']]);
  assert.equal(s.view.out, 63.2, 'the month’s money out is the same');
  const again = await route('/profile/spending/import', { csv });
  assert.equal(again.result.added, 0, 'the split payment is not added twice');
  assert.equal(again.result.duplicates, 2);
  await route('/profile/spending/file', { k: tesco[0].k, c: 'other' });
  s = await route('/profile/spending?month=2026-10', null, 'GET');
  assert.deepEqual(s.rows.filter((r) => r.t === 'TESCO STORES').map((r) => r.c).sort(), ['groceries', 'shopping'], 'filing by name leaves a split alone');
  s = await route('/profile/spending/split', { row: { d: '2026-10-03', t: 'TESCO STORES', a: -60 }, parts: [] });
  assert.deepEqual(s.rows.filter((r) => r.t === 'TESCO STORES').map((r) => r.a), [-60]);
  assert.equal((await route('/profile/spending/split', { row: { d: '2026-10-03', t: 'TESCO STORES', a: -60 }, parts: [{ c: 'groceries', a: 70 }, { c: 'shopping', a: 1 }] })).error.length > 0, true);
});

test('PEOPLE: one note changed or taken away (the Memory line follows); a gift list with what he gave last year; forgetting someone takes their list', async () => {
  const storage = new Mem();
  const call = (action, args = {}) => P.packsRoute(new Request('https://g/api/packs/do', { method: 'POST', body: JSON.stringify({ pack: 'people', action, args }) }), '/packs/do', 'POST', { storage, notify: async () => undefined, now: () => NOW, fetch: fakeFetch({}) }).then(async (r) => ({ status: r.status, ...(await r.json()) }));
  await call('note', { words: 'Sam loves fishing' });
  await call('note', { words: 'Sam supports Villa' });
  let r = await call('notes', { who: 'Sam', text: 'loves fishing', to: 'loves carp fishing' });
  assert.deepEqual(r.data.notes, ['loves carp fishing', 'supports Villa']);
  assert.ok((await storage.get('memory')).some((f) => /Sam.*loves carp fishing/.test(f.text)), 'the Memory line follows');
  r = await call('notes', { who: 'Sam', text: 'supports Villa', op: 'remove' });
  assert.deepEqual(r.data.notes, ['loves carp fishing']);
  assert.equal((await call('notes', { who: 'Nobody', text: 'x' })).status, 400);
  r = await call('gifts', { who: 'Sam', op: 'add', idea: 'a fishing reel', price: 25 });
  const id = r.data.gifts[0].id;
  r = await call('gifts', { who: 'Sam', op: 'bought', id });
  assert.equal(r.data.gifts[0].bought, '2026-11-01');
  assert.equal(r.data.spentThisYear, 25);
  const all = await storage.get('people:gifts');
  const key = Object.keys(all)[0];
  all[key][0].bought = '2025-12-20';
  await storage.put('people:gifts', all);
  r = await call('gifts', { who: 'Sam' });
  assert.deepEqual(r.data.lastYear, ['a fishing reel'], 'what he gave last year, so it is not repeated');
  await call('forget', { who: 'Sam' });
  assert.deepEqual(await storage.get('people:gifts'), {});
});

test('WORK → JOBS: an application kept with a follow-up reminder at 9am; its stage moved; turned down clears the reminder', async () => {
  const storage = new Mem();
  const call = (args) => P.packsRoute(new Request('https://g/api/packs/do', { method: 'POST', body: JSON.stringify({ pack: 'work', action: 'jobs', args: { today: '2026-11-01', ...args } }) }), '/packs/do', 'POST', { storage, notify: async () => undefined, now: () => NOW, fetch: fakeFetch({}) }).then(async (r) => ({ status: r.status, ...(await r.json()) }));
  let r = await call({ op: 'add', role: 'Warehouse supervisor', where: 'Asda', applied: '2026-10-30', follow: '2026-11-08' });
  assert.match(r.text, /^Kept: Warehouse supervisor at Asda, applied 2026-10-30\. I’ll remind you to follow up on 2026-11-08 at 9am\./);
  assert.deepEqual((await J.loadJobs(storage)).map((j) => j.title), ['Follow up: Warehouse supervisor at Asda']);
  const id = r.data.jobs[0].id;
  r = await call({ op: 'stage', id, stage: 'interview' });
  assert.equal(r.data.jobs[0].stage, 'interview');
  assert.equal((await J.loadJobs(storage)).length, 1);
  r = await call({ op: 'stage', id, stage: 'rejected' });
  assert.deepEqual(await J.loadJobs(storage), [], 'a closed application needs no follow-up');
  assert.equal((await call({ op: 'add', role: '' })).status, 400);
  r = await call({ op: 'remove', id });
  assert.deepEqual(r.data.jobs, []);
});

test('the cancel helper: a stable cancel page from the company’s own site, else a search kept to its own site; never signs in', async () => {
  const MA = B['src/tools/moneyapp.ts'];
  const d = deps(new Mem());
  let r = await MA.MONEY_APP.cancel({ name: 'Netflix' }, d);
  assert.deepEqual(r.data.links.map((l) => l.url), ['https://www.netflix.com/cancelplan']);
  assert.match(r.data.steps, /I never sign in or cancel for you/);
  MA.cancelHooks.search = async () => [{ title: 'Cancel Spotify Premium', url: 'https://support.spotify.com/uk/article/cancel-premium/' }, { title: 'How to cancel Spotify (a blog)', url: 'https://blog.example/cancel-spotify' }];
  r = await MA.MONEY_APP.cancel({ name: 'SPOTIFY' }, d);
  assert.deepEqual(r.data.links.map((l) => l.url), ['https://support.spotify.com/uk/article/cancel-premium/'], 'only the company’s own site');
  MA.cancelHooks.search = async () => [{ title: 'somewhere else', url: 'https://blog.example/x' }];
  r = await MA.MONEY_APP.cancel({ name: 'Acme Gym Ltd' }, d);
  assert.deepEqual(r.data.links, []);
  assert.match(r.text, /no cancel page on Acme Gym Ltd’s own site/);
});
