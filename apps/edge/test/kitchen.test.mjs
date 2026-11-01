// THE KITCHEN PACK (BRIEF-PACKS-1 item 3): timers in his words (several at once, named, stopped by name), dinners from what
// he has (TheMealDB's free open tier from fixtures — a real lookup and filter — and Ghosty's own list when it is down), a
// recipe's time from its own steps, the recipe text marked as data, the fridge photo through the Lens's ASK, the shopping
// list (added, ticked by name and by id, shared as text), a packet's barcode with its allergens (Open Food Facts, nothing
// kept), portions, conversions, the oven line, the week's meal plan, use-it-up and the leftovers reminder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bundles, ctxOf, deps, fakeFetch, fixture, Mem, NOW } from './packs-kit.mjs';

const B = await bundles(['src/tools/kitchen.ts', 'src/packs/index.ts', '../../packages/shared/src/kitchen.ts', 'src/schedule.ts']);
const T = B['src/tools/kitchen.ts'];
const P = B['src/packs/index.ts'];
const S = B['../../packages/shared/src/kitchen.ts'];
const J = B['src/schedule.ts'];
const LOOKUP = JSON.parse(fixture('mealdb-lookup.json'));
const FILTER = JSON.parse(fixture('mealdb-filter.json'));
const DB = 'https://www.themealdb.com/api/json/v1/1';

test('timers in his words: one or several, named, stopped by name or all; not a timer app', () => {
  assert.deepEqual(S.timerAsked('timer 8 minutes for the pasta'), { start: [{ secs: 480, name: 'pasta' }] });
  assert.deepEqual(S.timerAsked('set a timer for 1 hour 20'), { start: [{ secs: 4800, name: 'timer' }] });
  assert.deepEqual(S.timerAsked('timers: pasta 8 minutes, rice 12 minutes'), { start: [{ secs: 480, name: 'pasta' }, { secs: 720, name: 'rice' }] });
  assert.deepEqual(S.timerAsked('timer 8 minutes for the pasta and 12 minutes for the rice'), { start: [{ secs: 480, name: 'pasta' }, { secs: 720, name: 'rice' }] });
  assert.deepEqual(S.timerAsked('egg timer 4 mins'), { start: [{ secs: 240, name: 'egg' }] }, 'the egg timer');
  assert.deepEqual(S.timerAsked('an hour and a half timer for the lamb'), { start: [{ secs: 5400, name: 'lamb' }] });
  assert.deepEqual(S.timerAsked('timer 90 seconds'), { start: [{ secs: 90, name: 'timer' }] });
  assert.deepEqual(S.timerAsked('stop the pasta timer'), { stop: 'pasta' });
  assert.deepEqual(S.timerAsked('cancel all timers'), { stop: '' });
  assert.deepEqual(S.timerAsked('how long left on the timers?'), { list: true });
  for (const t of ['make me a timer app', 'what is a timer', 'remind me in 8 minutes']) assert.equal(S.timerAsked(t), null, t);
  assert.equal(S.mmss(4800), '1:20:00');
  assert.equal(S.spanWords(4800), '1 hour 20 minutes');
});

test('the tool sends the timers to the phone (kitchen_timer), says they ring there, and that Telegram has no phone screen', async () => {
  const tool = T.kitchenTools[0];
  assert.deepEqual(tool.parameters.properties.action.enum, ['fridge', 'dishes', 'recipe', 'shop', 'timer', 'barcode', 'portions', 'convert', 'oven', 'plan', 'useup', 'leftovers']);
  assert.ok(tool.description.length <= 1000, `${tool.description.length}`);
  const { ctx, events } = ctxOf(new Mem());
  const out = await tool.run({ action: 'timer', words: '8 minutes for the pasta and 12 minutes for the rice' }, ctx);
  assert.match(out, /^On your phone: pasta 8:00 \(8 minutes\), rice 12:00 \(12 minutes\)\. It rings with a sound and a buzz while Ghosty is open; on Telegram/);
  assert.deepEqual(events.filter((e) => e.t === 'client').map((e) => [e.name, e.args]), [['kitchen_timer', { timers: [{ secs: 480, name: 'pasta' }, { secs: 720, name: 'rice' }] }]]);
  await tool.run({ action: 'timer', words: 'stop the rice timer' }, ctx);
  assert.deepEqual(events.filter((e) => e.t === 'client').at(-1).args, { stop: 'rice' });
});

const mealdb = (seen = []) =>
  fakeFetch(
    {
      [`${DB}/filter.php?i=chicken`]: { meals: [{ idMeal: '52940' }, ...FILTER.meals] },
      [`${DB}/filter.php?i=rice`]: { meals: [{ idMeal: '52940' }] },
      [`${DB}/filter.php?i=peppers`]: { meals: null },
      [`${DB}/lookup.php?i=`]: (u) => (u.endsWith('=52940') ? LOOKUP : { meals: null }),
      [`${DB}/search.php?s=`]: (u) => (/brown/i.test(decodeURIComponent(u)) ? LOOKUP : { meals: null }),
    },
    seen,
  );

test('dinner from what he has: TheMealDB’s free tier and Ghosty’s own list, three dishes with their times and steps, the recipe text as data', async () => {
  const seen = [];
  const out = await T.KITCHEN.dishes({ words: 'chicken, peppers and rice' }, deps(new Mem(), mealdb(seen)));
  assert.ok(seen.every((u) => u.startsWith(`${DB}/`)), 'only TheMealDB’s open tier, no key');
  assert.match(out.text, /^You have: chicken, peppers, rice\.\nThree dinners:\n<<external content from TheMealDB \(free recipes\)/);
  assert.match(out.text, /1\. Brown Stew Chicken \(about 40 min; you have 2 of its 13 things, you'd need tomato, onions, garlic clove/);
  assert.match(out.text, /2\. Chicken stir-fry \(about 25 min; you have 3 of its 6 things/);
  assert.match(out.text, /3\. Chicken curry \(about 40 min;/);
  assert.match(out.text, /Times: the minutes in each recipe's own steps plus 10 to prepare/);
  assert.equal(out.cards[0].title, 'Dinner ideas for tonight');
  assert.match(out.cards[0].line, /^Brown Stew Chicken 40 min · Chicken stir-fry 25 min · Chicken curry 40 min$/);
  // the meal itself: its 13 ingredients with measures, its steps, its time from "10 minutes" and "another 20 minutes"
  const d = S.mealDish(LOOKUP.meals[0]);
  assert.equal(d.ingredients.length, 13);
  assert.deepEqual(d.ingredients[0], { name: 'Chicken', measure: '1 whole' });
  assert.equal(d.steps.length, 6);
  assert.equal(d.mins, 40);
  assert.equal(S.minutesInSteps('Bake 25-30 mins, then rest 1 hour.'), 90);
  // TheMealDB down: Ghosty's own list still answers
  const own = await T.KITCHEN.dishes({ words: 'eggs, cheese, bread' }, deps(new Mem(), fakeFetch({})));
  assert.match(own.text, /^You have: eggs, cheese, bread\.\nThree dinners:\n1\. Cheese omelette/);
  assert.ok(!own.text.includes('<<external content'));
  assert.match((await T.KITCHEN.dishes({ words: '' }, deps(new Mem()))).text, /Tell me what you’ve got/);
});

test('a recipe in full; the fridge photo goes through the Lens’s ASK to his own brain', async () => {
  const r = await T.KITCHEN.recipe({ words: 'how do I make brown stew chicken?' }, deps(new Mem(), mealdb()));
  assert.match(r.text, /Brown Stew Chicken, about 40 min\.\nYou need: 1 whole Chicken, 1 chopped Tomato/);
  assert.match(r.text, /From TheMealDB: https:\/\/www\.themealdb\.com\/meal\/52940/);
  assert.match((await T.KITCHEN.recipe({ words: 'cheese toastie' }, deps(new Mem(), fakeFetch({})))).text, /^Cheese toastie, about 10 min\.[\s\S]*\(From Ghosty’s own list\.\)$/);
  const f = await T.KITCHEN.fridge({}, deps(new Mem()));
  assert.deepEqual(f.open, { name: 'open_lens', args: { mode: 'ask', question: 'What food is in my fridge? List each ingredient you can see, then give me three dinners I could make from them.' } });
  assert.match(f.text, /it comes to me \(your own brain\)/);
});

test('the shopping list: added by voice, ticked by name and by the phone’s id, shared as text, the ticked cleared', async () => {
  const storage = new Mem();
  const d = deps(storage);
  let out = await T.KITCHEN.shop({ words: 'add milk, eggs and bread to the list' }, d);
  assert.equal(out.text, 'Added: milk, eggs, bread. On the list: milk, eggs, bread.');
  assert.equal(out.cards[0].acts[0].run.name, 'open_kitchen');
  out = await T.KITCHEN.shop({ words: 'tick the milk' }, d);
  assert.equal(out.text, 'Ticked: milk. On the list: eggs, bread.');
  const eggs = out.data.list.find((x) => x.text === 'eggs');
  out = await T.KITCHEN.shop({ id: eggs.id, op: 'tick' }, d);
  assert.equal(out.text, 'Ticked: eggs. On the list: bread.');
  out = await T.KITCHEN.shop({ words: 'share' }, d);
  assert.equal(out.text, 'Here it is as text, ready to send:\nShopping list\n• bread\n\nGot: milk, eggs');
  out = await T.KITCHEN.shop({ words: 'add milk' }, d);
  assert.match(out.text, /^Added: milk\./, 'a ticked thing added again goes back on');
  out = await T.KITCHEN.shop({ words: 'clear ticked' }, d);
  assert.equal(out.text, 'Cleared 1 ticked. On the list: milk, bread.');
  assert.equal((await T.KITCHEN.shop({ words: 'remove the bread' }, d)).text, 'Taken off: bread. On the list: milk.');
});

test('a packet’s barcode: its name, ingredients and allergens from Open Food Facts; nothing kept unless he asks', async () => {
  const FX = JSON.parse(readFileSync(new URL('./lookup.fixture.json', import.meta.url), 'utf8'));
  const real = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const u = typeof input === 'string' ? input : input.url;
    if (u.startsWith('https://world.openfoodfacts.org/api/v2/product/3017620422003.json')) return new Response(JSON.stringify(FX.food), { headers: { 'content-type': 'application/json' } });
    return new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } });
  };
  try {
    const storage = new Mem();
    const out = await T.KITCHEN.barcode({ code: '3017620422003' }, deps(storage));
    assert.match(out.text, /^Allergens: milk, nuts, soybeans\./);
    assert.match(out.text, /Nothing kept unless you ask\.$/);
    assert.equal(await storage.get(T.KITCHEN_KEYS.shop), undefined, 'nothing kept');
    const kept = await T.KITCHEN.barcode({ code: '3017620422003', words: 'add it to the list' }, deps(storage));
    assert.match(kept.text, /except on your shopping list as you asked/);
    assert.equal((await storage.get(T.KITCHEN_KEYS.shop)).length, 1);
  } finally {
    globalThis.fetch = real;
  }
  assert.match((await T.KITCHEN.barcode({ code: '12' }, deps(new Mem()))).text, /Show me the barcode/);
});

test('portions, conversions and the oven line, each saying what it assumed', async () => {
  const s = S.scaleLines('400g pasta\n2 eggs\n1/2 tsp salt\n1 ½ onions', 4, 6);
  assert.deepEqual(s.lines, ['600g pasta', '3 eggs', '0.75 tsp salt', '2.5 onions']);
  assert.equal(s.rounded, true);
  assert.match((await T.KITCHEN.portions({ words: 'serves 4, I need it for 6: 400g pasta, 2 eggs' }, deps(new Mem()))).text, /^From 4 to 6 \(×1\.5\): 600g pasta; 3 eggs\./);
  assert.equal(S.convertWords('200 g of flour in cups'), '200 g of flour is about 1.6 cups. Assumed: a US cup of flour weighs 125 g, spooned and levelled.');
  assert.equal(S.convertWords('1 cup of sugar in grams'), '1 cup of sugar is about 200 grams. Assumed: a US cup of sugar weighs 200 g, spooned and levelled.');
  assert.equal(S.convertWords('350 f in c'), '350 °F is 177 °C.');
  assert.equal(S.convertWords('2 oz in grams'), '2 oz is 56.7 grams.');
  assert.match(S.convertWords('1 pint in ml'), /^1 pint is 568 ml\. Assumed: a US cup \(237 ml\), a UK pint \(568 ml\)/);
  assert.match(S.convertWords('2 cups of mystery in grams'), /I need what it is/);
  assert.equal(S.ovenWords('fan 180'), '200 °C conventional = fan 180 °C = gas mark 6 = 400 °F. Assumed: a fan oven runs 20 °C hotter than its dial.');
  assert.equal(S.ovenWords('gas mark 4'), '180 °C conventional = fan 160 °C = gas mark 4 = 350 °F. Assumed: a fan oven runs 20 °C hotter than its dial.');
  assert.equal(S.ovenWords('350 f'), S.ovenWords('gas mark 4'));
  assert.match(S.ovenWords('fan 170'), /^190 °C conventional = fan 170 °C = gas mark 5 = 375 °F/);
  assert.equal(S.ovenAsked('fan 180 in conventional?'), S.ovenWords('fan 180'));
  assert.equal(S.ovenAsked('my fan oven is broken'), null);
  assert.equal(S.shoppingAsked('show me my shopping list'), true);
});

test('the week’s meal plan by voice and from the phone; tonight’s dinner and what to use up in the Brief', async () => {
  const storage = new Mem();
  const d = deps(storage); // Sun 1 Nov 2026: the week from Mon 26 Oct
  let out = await T.KITCHEN.plan({ words: 'chilli on Monday, pasta bake on Tuesday, tonight: roast chicken' }, d);
  assert.equal(out.text, 'This week’s dinners — Mon: chilli; Tue: pasta bake; Sun: roast chicken.');
  assert.equal(out.cards[0].title, 'This week’s dinners');
  out = await T.KITCHEN.plan({ days: ['chilli', '', 'fish', '', '', '', 'roast chicken'] }, d);
  assert.deepEqual(out.data.plan.days, ['chilli', '', 'fish', '', '', '', 'roast chicken']);
  await T.KITCHEN.useup({ words: 'the spinach is going off tomorrow' }, d);
  out = await T.KITCHEN.useup({ words: 'chicken use by Wednesday' }, d);
  assert.match(out.text, /^Use it up: spinach by Mon 2 Nov, chicken by Wed 4 Nov\./);
  assert.match(out.text, /A use-by date on the packet wins over mine\.$/);
  assert.deepEqual(await P.packLines({ storage, now: () => NOW }), ['Tonight: roast chicken', 'Use up: spinach']);
  out = await T.KITCHEN.useup({ words: 'used the spinach' }, d);
  assert.match(out.text, /^Use it up: chicken by Wed 4 Nov\./);
});

test('leftovers: eaten within two days (rice one), a reminder at 5pm on the last day', async () => {
  const storage = new Mem();
  const out = await T.KITCHEN.leftovers({ words: 'leftover curry from tonight' }, deps(storage));
  assert.match(out.text, /^Noted: eat the curry by Tue 3 Nov\. I’ll remind you at 5pm that day/);
  assert.match(out.text, /the Food Standards Agency’s rule — leftovers within two days, rice within one/);
  const job = (await J.loadJobs(storage)).find((j) => j.kind === 'reminder');
  assert.equal(new Date(job.next).toISOString(), '2026-11-03T17:00:00.000Z');
  assert.deepEqual(S.leftoversBy('fried rice', '2026-11-01'), { by: '2026-11-02', days: 1 });
});
