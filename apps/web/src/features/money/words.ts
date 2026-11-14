/**
 * THE MONEY APP'S WORDS (FINAL ROUND, the money lane), pure: the plain things he says that open one of its pages, each in more than
 * one wording. Narrow on purpose: a question about his money ("how much did I spend on fuel?") stays the brain's (tools/money.ts);
 * only the words that name a page open it here, with no model.
 */
export type MoneyAsk = 'month' | 'budgets' | 'bills' | 'trends' | 'safe' | 'calendar' | 'goals' | 'year';

const LEAD = String.raw`^(?:(?:ok(?:ay)?|please|hey ghosty)[, ]+)?(?:(?:show|open|give|take)(?: me)?(?: to)? |let me see |see |go to )?(?:my |the )?`;
const TAIL = String.raw`(?: page| screen| please)?[.!?]*$`;
const ASKS: [MoneyAsk, RegExp][] = [
  ['budgets', new RegExp(`${LEAD}(?:budgets?|monthly budgets?|budget page)${TAIL}`, 'i')],
  ['bills', new RegExp(`${LEAD}(?:subscriptions?|bills and subscriptions|subscriptions and bills|direct debits|regular payments)${TAIL}`, 'i')],
  ['trends', new RegExp(`${LEAD}(?:spending trends|money trends|spending over time|spending by month)${TAIL}`, 'i')],
  // [moneynext] money and papers handled for you: safe to spend, the calendar, goals and the year (features/money/plan.ts)
  ['safe', new RegExp(`${LEAD}(?:safe to spend|(?:what(?:['’]s| is) )?safe to spend(?: until payday)?|left until payday|money (?:left )?(?:until|till|before) payday)${TAIL}`, 'i')],
  ['calendar', new RegExp(`${LEAD}(?:money calendar|bills calendar|bill calendar|calendar of (?:my )?bills|when (?:are|is) my bills due)${TAIL}`, 'i')],
  ['goals', new RegExp(`${LEAD}(?:savings goals?|saving goals?|money goals?|goals? (?:i(?:['’]m| am) )?saving for)${TAIL}`, 'i')],
  ['year', new RegExp(`${LEAD}(?:year in money|money year|(?:my )?year in review|(?:my )?money this year|spending this year)${TAIL}`, 'i')],
  ['month', new RegExp(`${LEAD}(?:spending|money|money app|month(?:['’]s)? (?:spending|money)|spending this month|money this month)${TAIL}`, 'i')],
];

/** The page his words name, or null. */
export function moneyAsked(text: string): MoneyAsk | null {
  const t = text.trim();
  if (!t || t.length > 60) return null;
  for (const [page, re] of ASKS) if (re.test(t)) return page;
  return null;
}

/** The MONEY screen's section his words open (safe to spend stands at the top of YOUR MONTH). */
export const moneySection = (a: MoneyAsk): string => (a === 'safe' ? 'month' : a);

/** What I say as the page opens. */
export const MONEY_OPENS: Record<MoneyAsk, string> = {
  month: 'Your month: money out, money in, what is left over, and every payment. All from the statements you gave me.',
  budgets: 'Your budgets: what is left in each, and what that is a day. Set one or take one away there.',
  bills: 'Your bills and subscriptions, in the order they are due, with what they come to a month and a year.',
  trends: 'Your last six months side by side, with the average, the dearest and the cheapest.',
  safe: 'Safe to spend is at the top of your month: what is left until payday after the bills still due. Plain sums, not a forecast.',
  calendar: 'Your money calendar: every bill, subscription and payday on its day, with the heavy days marked.',
  goals: 'Your savings goals: each one’s bar, and what it needs a month to land on its date.',
  year: 'Your year in money: the totals, the dearest months, where it went, and the subscriptions you started and stopped.',
};
