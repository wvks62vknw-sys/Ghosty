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
  'job:follow': {
    name: 'Watching prices for you', line: 'I read the pages you asked me to watch twice a day, and tell you once when a price drops.',
    more: 'Only the pages you sent me. A drop comes as a card with STOP WATCHING; nothing is ever bought.',
    say: ['What prices are you watching?'], scene: ['money', 'behind'], cat: 'watch', since: SINCE,
  },
};
