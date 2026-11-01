/**
 * The catalogue's words for THE PACKS (BRIEF-PACKS-1): each action of a pack's one tool is an ability of its own
 * (`act:<pack>:<action>`, from the tool's action enum: apps/edge/src/abilities.ts brainItems), the phone's phrases for them
 * (`phrase:<id>`) and the follow job. Rules: packages/shared/src/catalogue.ts `wordProblems`.
 */
import type { CatValue } from '../catalogue';

const SINCE = '2026-11-01';

export const PACK_WORDS: Record<string, CatValue> = {
  // ---------------------------------------------------------------- MONEY
  'tool:money': { same: 'act:money:month' },
  'act:money:month': {
    name: 'Your month in one card', line: 'I can show your month from your statements: the top five things you spent on, and what changed.',
    more: 'From the statements you added or pasted, read by code. The card opens SPENDING for the whole picture. No bank access, ever.',
    say: ['How did my month go?', 'What did I spend most on this month?'], scene: ['money'], cat: 'watch', needs: ['statement'], since: SINCE,
  },
  'phrase:statement': {
    name: 'Paste a bank statement', line: 'You can paste a bank statement in the chat, its CSV or the text from its PDF, and I sort your month.',
    more: 'It goes straight to your brain and is read by code, with a table of rules: no AI sees it, not even the shop names. The chat shows only that a statement came.',
    say: ['(paste the statement in the chat)'], scene: ['money'], cat: 'watch', since: SINCE,
    go: { ask: 'My statement:\n', send: false }, tryText: 'Starts a message in the chat box: paste the statement under it',
  },
  'act:money:spent': {
    name: 'Keep what you spent', line: 'You can tell me what you spent, like "spent 12 on lunch", and I keep it for the week.',
    more: 'Kept in your brain, sorted into eating out, transport, groceries and the rest. Say "undo that" to take the last one back. Only what you tell me, never your bank.',
    say: ['Spent 12 on lunch', 'Spent £30 on petrol yesterday'], scene: ['money'], cat: 'watch', since: SINCE,
    go: { ask: 'Spent ', send: false },
  },
  'act:money:week': {
    name: 'What you spent this week', line: 'I can tell you what you have spent this week, from what you told me, against last week.',
    more: 'Since Monday, by kind of spending, with last week to the same day beside it. It is only what you told me.',
    say: ['What have I spent this week?'], scene: ['money'], cat: 'watch', since: SINCE,
  },
  'act:money:fuel': {
    name: 'Cheapest fuel near a place', line: 'I can find the three cheapest petrol or diesel stations near a place you saved, like your dad’s.',
    more: 'From the fuel retailers’ own public price lists (Asda, Tesco, Sainsbury’s, Morrisons, BP, Shell, Esso and more), with how far each is. Only near a saved place: never where you are.',
    say: ['Cheapest petrol near Dad’s', 'Cheapest diesel near home'], scene: ['money', 'out'], cat: 'watch', needs: ['places'], since: SINCE,
  },
  'act:money:trip': {
    name: 'What a drive costs', line: 'I can work out what a drive costs in fuel from the miles and the car’s miles per gallon.',
    more: 'Litres from UK gallons, at the price you give or today’s average from the retailers’ lists. I say what I assumed.',
    say: ['What does 120 miles cost at 45 mpg?'], scene: ['money', 'out'], cat: 'watch', since: SINCE,
  },
  'act:money:watch': {
    name: 'Watch a price for you', line: 'You can send me a product page and I watch its price, and tell you when it drops.',
    more: 'I read the page twice a day and tell you once when the price is lower. UNDO on the card stops it. Some shops block readers like me; I say so.',
    say: ['Watch the price of this (paste the link)', 'What prices are you watching?'], scene: ['money'], cat: 'watch', since: SINCE,
    go: { ask: 'Watch the price of ', send: false },
  },
  'act:money:unwatch': {
    name: 'Stop watching a price', line: 'You can tell me to stop watching a price, or tap UNDO on its card.',
    more: 'The page goes from my list at once. With nothing left to watch, my twice-a-day look stops too.',
    say: ['Stop watching the price'], scene: ['money'], cat: 'watch', since: SINCE,
    go: { ask: 'Stop watching the price of ', send: false },
  },
  'act:money:subs': {
    name: 'Your subscriptions and renewals', line: 'You can list your subscriptions with their renewal days, and I keep the monthly total.',
    more: 'Say "Netflix £10.99 a month on the 14th" to add one, "drop Netflix" to take it off. The Brief says the day before one renews. You cancel with the company: I never touch your accounts.',
    say: ['What subscriptions do I have?', 'Netflix £10.99 a month on the 14th'], scene: ['money'], cat: 'watch', since: SINCE,
  },
  'act:money:split': {
    name: 'Split a bill', line: 'I can split a bill between names to the penny, with a tip if you say one.',
    more: 'Equal, or by shares like "Ali x2". The odd pennies go to the first names, so it always adds up.',
    say: ['Split £84 between me, Ali and Sam with a 10% tip'], scene: ['money', 'out'], cat: 'watch', since: SINCE,
  },
  'act:money:roundup': {
    name: 'Round-ups from your statements', line: 'I can tell you what rounding every payment up to the next pound would have saved this month.',
    more: 'From your statements, payments out only, with a year at that rate. A suggestion: nothing moves anywhere.',
    say: ['How much would round-ups save me?'], scene: ['money'], cat: 'watch', needs: ['statement'], since: SINCE,
  },
  'act:money:payday': {
    name: 'Count down to payday', line: 'You can tell me your payday and the Brief counts down to it every day.',
    more: 'A day of the month, the last Friday or the last working day. A payday at a weekend moves to the Friday before.',
    say: ['Payday is the 28th', 'When is payday?'], scene: ['money', 'morning'], cat: 'watch', since: SINCE,
    go: { ask: 'Payday is the ', send: false },
  },
  'act:money:whatif': {
    name: 'What if I save', line: 'I can tell you what saving an amount each week or month comes to, with interest if you give a rate.',
    more: 'Three months, six, a year and your own span. It says what it assumed: a week as 52/12 of a month, before tax.',
    say: ['What if I save £50 a week?', 'If I put away £200 a month for 2 years at 4%'], scene: ['money'], cat: 'watch', since: SINCE,
  },
  'act:money:warranty': {
    name: 'Remember a warranty', line: 'You can tell me what you bought and its warranty, and I remind you two weeks before it ends.',
    more: 'Say the thing, the day you bought it and how long. The reminder goes in your Agenda at 9am; the Brief says when one ends within a fortnight.',
    say: ['TV bought 3 March 2025, 2 year warranty', 'What warranties have I got?'], scene: ['money'], cat: 'watch', since: SINCE,
    go: { ask: 'Warranty: ', send: false },
  },
  // ---------------------------------------------------------------- BODY
  'tool:body': { same: 'act:body:reps' },
  'act:body:reps': {
    name: 'Count your reps by camera', line: 'I can count your squats, push-ups or star jumps with the camera and say each one out loud.',
    more: 'Prop the phone up so it sees all of you. A pose model on the phone finds your joints; nothing from the camera leaves it. DONE puts the count in the chat.',
    say: ['Count my squats', 'Count my push-ups', 'Count my star jumps'], scene: ['camera', 'phone'], cat: 'do', needs: ['camera'], since: SINCE,
    go: { run: 'open_body', args: { what: 'reps' } }, tryText: 'Opens the reps counter',
  },
  'phrase:reps': { same: 'act:body:reps' },
  'act:body:run': {
    name: 'A running coach', line: 'I can coach your run with the phone’s GPS: distance and pace said each kilometre, then the run saved.',
    more: 'It works while the screen is on. Your route stays on the phone; RUN SAVED sends me only the distance, the time and the splits.',
    say: ['Start a run', 'Running coach'], scene: ['out', 'phone'], cat: 'do', needs: ['location'], since: SINCE,
    go: { run: 'open_body', args: { what: 'run' } }, tryText: 'Opens the running coach',
  },
  'phrase:run': { same: 'act:body:run' },
  'act:body:log': {
    name: 'Keep a workout', line: 'You can tell me what you did, like "did 30 push-ups" or "ran 5k in 28 minutes", and I keep it.',
    more: 'The camera’s counts and saved runs are kept the same way. It feeds your week and the rest-day line.',
    say: ['Did 30 push-ups', 'Ran 5k in 28 minutes'], scene: ['out'], cat: 'do', since: SINCE,
    go: { ask: 'Did ', send: false },
  },
  'act:body:steps': {
    name: 'Your steps this week', line: 'I can tell you your steps for the week from the Apple Health export you give me.',
    more: 'The export is read on your phone, in code; only the week’s numbers reach me. Where your iPhone and Watch both count, the larger is used. Not medical advice.',
    say: ['How many steps did I do this week?'], scene: ['phone'], cat: 'do', since: SINCE,
  },
  'act:body:sleep': {
    name: 'How you slept this week', line: 'I can tell you how long you slept each night this week, from your Apple Health export.',
    more: 'Asleep time as Health recorded it, with overlaps between your Watch and phone counted once. I never read anything into it: not medical advice.',
    say: ['How did I sleep this week?'], scene: ['morning', 'phone'], cat: 'do', since: SINCE,
  },
  'act:body:health': {
    name: 'Read your Health export', line: 'You can give me the export from Apple’s Health app and I read your week on the phone.',
    more: 'Health → your picture → Export All Health Data → Save to Files, then pick it. Even a huge file is read as it streams, on the phone.',
    say: ['Read my Health export'], scene: ['phone'], cat: 'do', since: SINCE,
    go: { run: 'open_body', args: { what: 'health' } }, tryText: 'Opens the Health import',
  },
  'act:body:water': {
    name: 'A glass of water counted', line: 'You can tell me each glass of water, or tap +1 GLASS, and I keep today’s count.',
    more: 'Eight glasses a day unless you set your own goal. Say "remind me" and I nudge you when you are behind, within my speak-first limit.',
    say: ['Had a glass of water', 'How much water have I had?'], scene: ['morning', 'watching'], cat: 'do', since: SINCE,
    go: { run: 'open_body', args: { what: 'water' } }, tryText: 'Opens today’s water',
  },
  'phrase:water': { same: 'act:body:water' },
  'act:body:breathe': {
    name: 'Breathe with me', line: 'I can breathe with you: box breathing or 4-7-8, a circle to follow and a buzz at each change.',
    more: 'Four rounds, about a minute. It all happens on the phone. Stop if you feel dizzy.',
    say: ['Breathe', 'Box breathing', '4-7-8 breathing'], scene: ['phone', 'watching'], cat: 'do', since: SINCE,
    go: { run: 'open_body', args: { what: 'breathe' } }, tryText: 'Opens the breathing screen',
  },
  'phrase:breathe': { same: 'act:body:breathe' },
  'act:body:stretch': {
    name: 'A stretch set with timer', line: 'I can take you through eight stretches with a timer, one at a time, with a buzz between them.',
    more: 'Neck, shoulders, chest, legs and hips, about four and a half minutes. Gently: a stretch should never hurt.',
    say: ['Stretch with me', 'Stretch set'], scene: ['phone'], cat: 'do', since: SINCE,
    go: { run: 'open_body', args: { what: 'stretch' } }, tryText: 'Opens the stretch set',
  },
  'phrase:stretch': { same: 'act:body:stretch' },
  'act:body:weight': {
    name: 'Your weight’s trend', line: 'You can tell me your weight and I keep the trend: this week’s average against two weeks before.',
    more: 'Kilos, stones or pounds. A kilo either way from day to day is normal. I never judge it, and it is not medical advice.',
    say: ['I weigh 82.5 kg', 'How is my weight going?'], scene: ['morning'], cat: 'do', since: SINCE,
    go: { ask: 'I weigh ', send: false },
  },
  'act:body:rest': {
    name: 'When to rest', line: 'I can tell you when a rest day would help, from the workouts you have done this week.',
    more: 'Four days in a row and I suggest a rest; a walk or the stretch set still counts as rest. It shows in the Brief too.',
    say: ['Should I rest today?'], scene: ['morning'], cat: 'do', since: SINCE,
  },
  'act:body:stand': {
    name: 'Hourly stand-up nudges', line: 'You can ask me to nudge you to stand up each hour on weekdays, within the hours you choose.',
    more: 'Nine to five unless you say otherwise. They go through my speak-first limit, so I never pester you; "stop the stand-ups" turns them off.',
    say: ['Remind me to stand up every hour', 'Stop the stand-ups'], scene: ['watching'], cat: 'do', since: SINCE,
    go: { ask: 'Remind me to stand up every hour from 9 to 5', send: false },
  },
  'act:body:week': {
    name: 'Your body this week', line: 'I can sum up your week: active days, reps, kilometres run, your weight and sleep.',
    more: 'From what you told me and what the phone counted. Not medical advice.',
    say: ['How was my week, body-wise?'], scene: ['morning'], cat: 'do', since: SINCE,
  },
  // ---------------------------------------------------------------- KITCHEN
  'tool:kitchen': { same: 'act:kitchen:dishes' },
  'act:kitchen:fridge': {
    name: 'Dinner from a fridge photo', line: 'You can show me your fridge with the camera and I list what is in it, then three dinners from it.',
    more: 'The Lens opens on ASK; the photo comes to your own brain only. I name what I can see, then find dishes with their times and steps.',
    say: ['What can I make from my fridge?', 'Look in my fridge'], scene: ['camera', 'making'], cat: 'do', needs: ['camera'], since: SINCE,
    go: { run: 'open_lens', args: { mode: 'ask', question: 'What food is in my fridge? List each ingredient you can see, then give me three dinners I could make from them.' } }, tryText: 'Opens the Lens on ASK for your fridge',
  },
  'act:kitchen:dishes': {
    name: 'What can I make with', line: 'You can tell me what you have and I find three dinners, each with its time and its steps.',
    more: 'From TheMealDB’s free recipes, or my own list of simple dinners when that has nothing. I say what you have and what you would need.',
    say: ['What can I make with chicken, peppers and rice?'], scene: ['making'], cat: 'do', since: SINCE,
  },
  'act:kitchen:recipe': {
    name: 'A recipe step by step', line: 'I can give you a dish’s whole recipe: what you need and every step.',
    more: 'From TheMealDB’s free recipes or my own list, with how long it takes. Say the dish.',
    say: ['How do I make a chicken curry?'], scene: ['making'], cat: 'do', since: SINCE,
  },
  'act:kitchen:shop': {
    name: 'Your shopping list', line: 'You can add to your shopping list by voice, tick things off on the phone, and send it as text.',
    more: 'Kept in your brain. "Add milk and eggs to the list", "tick the milk", SHARE AS TEXT to send it to someone. Clear the ticked ones when you are home.',
    say: ['Add milk, eggs and bread to the list', 'What’s on my shopping list?'], scene: ['making', 'out'], cat: 'do', since: SINCE,
    go: { run: 'open_kitchen', args: { what: 'shopping' } }, tryText: 'Opens the shopping list',
  },
  'phrase:shopping': { same: 'act:kitchen:shop' },
  'act:kitchen:timer': {
    name: 'Kitchen timers by voice', line: 'You can say "timer 8 minutes for the pasta" and set several at once, each with its name.',
    more: 'They run on the phone and ring with a sound, a buzz and the words. They ring while Ghosty is open: for a locked phone, ask for a reminder.',
    say: ['Timer 8 minutes for the pasta', 'Timers: rice 12 minutes, eggs 6 minutes'], scene: ['making', 'phone'], cat: 'do', since: SINCE,
    go: { ask: 'Timer 8 minutes for the pasta', send: false },
  },
  'phrase:timer': { same: 'act:kitchen:timer' },
  'act:kitchen:barcode': {
    name: 'What is in a packet', line: 'I can read a packet’s barcode and tell you its name, ingredients and allergens.',
    more: 'From Open Food Facts, free. Nothing is kept unless you ask me to add it to your shopping list.',
    say: ['What allergens are in this? (scan it)'], scene: ['camera', 'making'], cat: 'do', since: SINCE,
    go: { run: 'open_lens', args: { mode: 'scan' } }, tryText: 'Opens the Lens on SCAN',
  },
  'act:kitchen:portions': {
    name: 'A recipe for more people', line: 'I can scale a recipe’s amounts from the people it serves to the people you are feeding.',
    more: 'Grams to the nearest 5, eggs and onions to the nearest half, and I say when I rounded.',
    say: ['Serves 4, I need it for 6: 400g pasta, 2 eggs, 1/2 tsp salt'], scene: ['making'], cat: 'do', since: SINCE,
    go: { ask: 'Serves 4, I need it for 6: ', send: false },
  },
  'act:kitchen:convert': {
    name: 'Cups, grams and spoons', line: 'I can turn cups into grams, ounces into grams, spoons into millilitres and Fahrenheit into Celsius.',
    more: 'A cup of flour weighs less than a cup of sugar, so I use the thing’s own weight and say what I assumed.',
    say: ['200 g of flour in cups', '350 f in c'], scene: ['making'], cat: 'do', since: SINCE,
  },
  'act:kitchen:oven': {
    name: 'Fan, gas mark or conventional', line: 'You can ask what an oven heat is on another kind of oven: fan, conventional, gas mark or °F.',
    more: 'A fan oven runs about 20 °C hotter than its dial. Answered on the phone, no AI.',
    say: ['Fan 180 in conventional?', 'What is gas mark 4?'], scene: ['making'], cat: 'do', since: SINCE,
  },
  'phrase:oven': { same: 'act:kitchen:oven' },
  'act:kitchen:plan': {
    name: 'The week’s meal plan', line: 'You can plan the week’s dinners by voice or edit them on the phone; tonight’s shows in the Brief.',
    more: 'Say "chilli on Monday, pasta bake on Tuesday". The card opens the week to change any day.',
    say: ['Chilli on Monday, pasta bake on Tuesday', 'What’s for dinner this week?'], scene: ['making', 'morning'], cat: 'do', since: SINCE,
    go: { run: 'open_kitchen', args: { what: 'plan' } }, tryText: 'Opens the meal plan',
  },
  'act:kitchen:useup': {
    name: 'Use it up in time', line: 'You can tell me what is going off and when, and I keep a use-it-up list with ideas for it.',
    more: 'The Brief says what to use today or tomorrow. A use-by date on the packet always wins over mine.',
    say: ['The spinach is going off in 2 days'], scene: ['making', 'morning'], cat: 'do', since: SINCE,
    go: { ask: 'The ', send: false },
  },
  'act:kitchen:leftovers': {
    name: 'A leftovers reminder', line: 'You can tell me about leftovers and I remind you to eat them before they go.',
    more: 'Two days in the fridge, rice one: the Food Standards Agency’s rule. The reminder goes in your Agenda for 5pm that day.',
    say: ['Leftover curry from tonight'], scene: ['making'], cat: 'do', since: SINCE,
    go: { ask: 'Leftover ', send: false },
  },
  'job:follow': {
    name: 'Watching prices for you', line: 'I read the pages you asked me to watch twice a day, and tell you once when a price drops.',
    more: 'Only the pages you sent me. A drop comes as a card with STOP WATCHING; nothing is ever bought.',
    say: ['What prices are you watching?'], scene: ['money', 'behind'], cat: 'watch', since: SINCE,
  },
};
