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

const B = await bundles(['src/tools/money.ts', 'src/packs/index.ts', 'src/spending.ts', '../../packages/shared/src/money.ts', '../../packages/shared/src/cards.ts', '../../packages/shared/src/packs.ts', 'src/schedule.ts']);
const M = B['src/tools/money.ts'];
const P = B['src/packs/index.ts'];
const SP = B['src/spending.ts'];
const S = B['../../packages/shared/src/money.ts'];
const C = B['../../packages/shared/src/cards.ts'];
const K = B['../../packages/shared/src/packs.ts'];
const J = B['src/schedule.ts'];
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
  assert.match(out.text, /^October: £[\d,]+ out, £[\d,]+ in\. Top five: /);
  assert.match(out.text, /Since September: /);
  assert.match(out.text, /no bank access/);
  const card = out.cards[0];
  assert.equal(card.id, 'money:month:2026-10');
  assert.match(card.title, /^October £[\d,]+ out$/);
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

test('a price watched: the number found on the page, a drop told once with STOP WATCHING, and UNDO stops it', async () => {
  const storage = new Mem();
  let price = '49.99';
  const fetch = fakeFetch({ 'https://shop.example/kettle': () => PAGE(price) });
  const out = await M.MONEY.watch({ url: 'https://shop.example/kettle' }, deps(storage, fetch));
  assert.match(out.text, /^Watching Kettle 1\.7L: £49\.99 now \(read from the page’s own product data\)\. I look twice a day/);
  assert.equal(out.cards[0].acts[0].label, 'UNDO');
  assert.equal(out.cards[0].acts[0].run.args.action, 'unwatch');
  assert.ok((await J.loadJobs(storage)).some((j) => j.kind === 'follow'), 'the follow job is on the clock');
  const told = [];
  const tell = async (title, text, card) => told.push({ title, text, card });
  price = '44.99';
  await M.followTick(deps(storage, fetch, NOW + 13 * 3_600_000), tell);
  await M.followTick(deps(storage, fetch, NOW + 26 * 3_600_000), tell);
  assert.equal(told.length, 1, 'told once');
  assert.match(told[0].text, /Kettle 1\.7L is £44\.99 now, down from £49\.99/);
  assert.equal(told[0].card.acts[0].label, 'STOP WATCHING');
  price = '39.00';
  await M.followTick(deps(storage, fetch, NOW + 39 * 3_600_000), tell);
  assert.equal(told.length, 2);
  // how a price is read: product data, a price tag, else the first £ in the text
  assert.equal(S.priceOf('<meta property="product:price:amount" content="12.50">').price, 12.5);
  assert.equal(S.priceOf('<p>Now only &pound;7.99!</p>').how, 'the first £ price in the page’s text');
  assert.equal(S.priceOf('<p>no price</p>'), null);
  const id = (await storage.get(M.MONEY_KEYS.watches))[0].id;
  assert.match((await M.MONEY.unwatch({ id }, deps(storage, fetch))).text, /^Stopped watching Kettle 1\.7L/);
  assert.ok(!(await J.loadJobs(storage)).some((j) => j.kind === 'follow'), 'nothing left to watch: the job goes');
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
